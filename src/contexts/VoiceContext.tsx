import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useGame } from './GameContext';
import { Player, VoiceParticipant } from '@/types/game';

interface VoiceContextType {
  isConnected: boolean;
  isConnecting: boolean;
  isMuted: boolean;
  volume: number;
  participants: VoiceParticipant[];
  connect: (roomName: string, player: Player) => Promise<void>;
  disconnect: () => void;
  toggleMute: () => void;
  setVolume: (volume: number) => void;
  error: string | null;
  resumeAudio: () => Promise<void>;
}

const VoiceContext = createContext<VoiceContextType | undefined>(undefined);

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    // TURN servers are required for reliable connections on mobile networks.
    // To add a TURN server, set the following environment variables in your .env file:
    // VITE_TURN_SERVER_URL=turn:your-turn-server.com:3478
    // VITE_TURN_SERVER_USER=your-username
    // VITE_TURN_SERVER_PASS=your-password
    ...(import.meta.env.VITE_TURN_SERVER_URL ? [{
      urls: import.meta.env.VITE_TURN_SERVER_URL,
      username: import.meta.env.VITE_TURN_SERVER_USER,
      credential: import.meta.env.VITE_TURN_SERVER_PASS,
    }] : []),
  ],
};

export const useVoice = () => {
  const context = useContext(VoiceContext);
  if (!context) {
    throw new Error('useVoice must be used within a VoiceProvider');
  }
  return context;
};

// Audio Element for remote streams (Required for iOS Safari audio routing)
function AudioElement({ stream }: { stream: MediaStream }) {
  const audioRef = useRef<HTMLAudioElement>(null);

  const attemptPlay = useCallback(async () => {
    if (!audioRef.current) return;
    try {
      await audioRef.current.play();
    } catch (e) {
      console.warn('Autoplay prevented for hidden audio, waiting for user interaction:', e);
      const retry = () => {
        audioRef.current?.play().catch(() => {});
        window.removeEventListener('click', retry);
        window.removeEventListener('touchstart', retry);
      };
      window.addEventListener('click', retry);
      window.addEventListener('touchstart', retry);
    }
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.srcObject = stream;
      attemptPlay();
    }
  }, [stream, attemptPlay]);

  // We keep this muted because AudioContext handles the actual audible playback.
  // The element just needs to be "playing" in the DOM for iOS to route WebRTC audio.
  return <audio ref={audioRef} autoPlay playsInline muted className="hidden" aria-hidden="true" />;
}

export const VoiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentLobby } = useGame();

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolumeState] = useState(100);
  const [error, setError] = useState<string | null>(null);

  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [speakingStates, setSpeakingStates] = useState<Record<string, boolean>>({});

  // Refs for WebRTC management
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Record<string, RTCPeerConnection>>({});
  const makingOfferRef = useRef<Record<string, boolean>>({});
  const ignoreOfferRef = useRef<Record<string, boolean>>({});
  const remoteStreamsRef = useRef<Record<string, MediaStream>>({});
  const iceQueuesRef = useRef<Record<string, RTCIceCandidateInit[]>>({});
  const cleanupTimeoutsRef = useRef<Record<string, any>>({});
  const channelRef = useRef<any>(null);
  const localPlayerRef = useRef<Player | null>(null);
  const lobbyCodeRef = useRef<string | null>(null);

  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef<Record<string, AnalyserNode>>({});
  const sourceNodesRef = useRef<Record<string, MediaStreamAudioSourceNode>>({});
  const masterGainRef = useRef<GainNode | null>(null);

  const resumeAudio = useCallback(async () => {
    if (audioContextRef.current) {
        if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
        }
    }
  }, []);

  const updateParticipantsList = useCallback(() => {
    if (!currentLobby) return;

    const list: VoiceParticipant[] = currentLobby.players.map(player => {
      const isLocal = player.id === localPlayerRef.current?.id;
      return {
        id: player.id,
        name: player.name,
        avatar: player.avatar,
        isSpeaking: speakingStates[player.id] || false,
        isMuted: isLocal ? isMuted : false,
        stream: isLocal ? localStreamRef.current || undefined : remoteStreamsRef.current[player.id]
      };
    });
    setParticipants(list);
  }, [currentLobby, speakingStates, isMuted]);

  const setupAudioSystem = useCallback((stream: MediaStream, playerId: string, isRemote: boolean = false) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        masterGainRef.current = audioContextRef.current.createGain();
        masterGainRef.current.connect(audioContextRef.current.destination);
      }

      // Cleanup existing if any
      if (sourceNodesRef.current[playerId]) {
        sourceNodesRef.current[playerId].disconnect();
      }

      const source = audioContextRef.current.createMediaStreamSource(stream);
      sourceNodesRef.current[playerId] = source;

      // Setup Analyser for VAD
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analysersRef.current[playerId] = analyser;

      // If remote, connect to master gain for playback
      if (isRemote && masterGainRef.current) {
        source.connect(masterGainRef.current);
      }

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      let speakingFrames = 0;
      let silentFrames = 0;
      const FRAME_THRESHOLD = 5;

      const checkSpeaking = () => {
        if (!analysersRef.current?.[playerId]) return;
        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const levelDetected = average > 15;

        if (levelDetected) {
            speakingFrames++;
            silentFrames = 0;
        } else {
            silentFrames++;
            speakingFrames = 0;
        }

        if (speakingFrames >= FRAME_THRESHOLD) {
            setSpeakingStates(prev => {
                if (prev[playerId]) return prev;
                return { ...prev, [playerId]: true };
            });
        } else if (silentFrames >= FRAME_THRESHOLD * 2) { // Allow more silence before switching off
            setSpeakingStates(prev => {
                if (!prev[playerId]) return prev;
                return { ...prev, [playerId]: false };
            });
        }

        if (localStreamRef.current || remoteStreamsRef.current[playerId]) {
          requestAnimationFrame(checkSpeaking);
        }
      };

      checkSpeaking();
    } catch (e) {
      console.error('Error setting up audio analysis:', e);
    }
  }, []);

  const processIceQueue = useCallback(async (remoteId: string, pc: RTCPeerConnection) => {
    const queue = iceQueuesRef.current[remoteId] || [];
    while (queue.length > 0) {
      const candidate = queue.shift();
      if (candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error(`Error adding queued ICE candidate for ${remoteId}:`, e);
        }
      }
    }
    delete iceQueuesRef.current[remoteId];
  }, []);

  const createPeerConnection = useCallback((remoteId: string) => {
    if (pcsRef.current[remoteId]) return pcsRef.current[remoteId];

    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onnegotiationneeded = async () => {
      try {
        makingOfferRef.current[remoteId] = true;
        await pc.setLocalDescription();
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'signal',
            payload: {
              from: localPlayerRef.current?.id,
              to: remoteId,
              type: 'description',
              data: pc.localDescription
            }
          });
        }
      } catch (err) {
        console.error(`Error in onnegotiationneeded for ${remoteId}:`, err);
      } finally {
        makingOfferRef.current[remoteId] = false;
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'signal',
          payload: {
            from: localPlayerRef.current?.id,
            to: remoteId,
            type: 'ice-candidate',
            data: event.candidate
          }
        });
      }
    };

    pc.ontrack = (event) => {
      console.log(`Received remote track from ${remoteId}`);
      const stream = event.streams[0];
      remoteStreamsRef.current[remoteId] = stream;
      setupAudioSystem(stream, remoteId, true);
      updateParticipantsList();
    };

    pc.oniceconnectionstatechange = () => {
        console.log(`ICE state for ${remoteId}: ${pc.iceConnectionState}`);

        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
            if (cleanupTimeoutsRef.current[remoteId]) {
                clearTimeout(cleanupTimeoutsRef.current[remoteId]);
                delete cleanupTimeoutsRef.current[remoteId];
            }
        }

        if (pc.iceConnectionState === 'failed') {
            console.log(`ICE failed for ${remoteId}, restarting...`);
            pc.restartIce();
        }

        if (pc.iceConnectionState === 'closed' || pc.iceConnectionState === 'disconnected') {
            if (cleanupTimeoutsRef.current[remoteId]) return;

            // Give it a moment to potentially reconnect before cleaning up
            cleanupTimeoutsRef.current[remoteId] = setTimeout(() => {
              if (pc.iceConnectionState === 'closed' || pc.iceConnectionState === 'disconnected') {
                console.log(`Cleaning up connection for ${remoteId}`);
                if (sourceNodesRef.current[remoteId]) {
                  sourceNodesRef.current[remoteId].disconnect();
                  delete sourceNodesRef.current[remoteId];
                }
                delete pcsRef.current[remoteId];
                delete remoteStreamsRef.current[remoteId];
                delete analysersRef.current[remoteId];
                delete makingOfferRef.current[remoteId];
                delete ignoreOfferRef.current[remoteId];
                delete cleanupTimeoutsRef.current[remoteId];
                pc.close();
                updateParticipantsList();
              }
            }, 5000);
        }
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pcsRef.current[remoteId] = pc;
    return pc;
  }, [setupAudioSystem, updateParticipantsList]);

  const handleSignal = useCallback(async ({ payload }: { payload: any }) => {
    const { from, to, type, data } = payload;

    if (type === 'join') {
        if (from === localPlayerRef.current?.id) return;
        createPeerConnection(from);
        return;
    }

    if (to !== localPlayerRef.current?.id) return;

    try {
        const pc = createPeerConnection(from);
        const polite = localPlayerRef.current && localPlayerRef.current.id < from;

        if (type === 'description') {
            const offerCollision = (data.type === 'offer') &&
                                   (makingOfferRef.current[from] || pc.signalingState !== 'stable');

            ignoreOfferRef.current[from] = !polite && offerCollision;
            if (ignoreOfferRef.current[from]) {
                console.log(`Ignoring offer collision from ${from} (impolite)`);
                return;
            }

            if (offerCollision) {
                await Promise.all([
                    pc.setLocalDescription({ type: 'rollback' } as RTCSessionDescriptionInit),
                    pc.setRemoteDescription(new RTCSessionDescription(data))
                ]);
            } else {
                await pc.setRemoteDescription(new RTCSessionDescription(data));
            }

            await processIceQueue(from, pc);

            if (data.type === 'offer') {
                await pc.setLocalDescription();
                if (channelRef.current) {
                    channelRef.current.send({
                        type: 'broadcast',
                        event: 'signal',
                        payload: {
                            from: localPlayerRef.current?.id,
                            to: from,
                            type: 'description',
                            data: pc.localDescription
                        }
                    });
                }
            }
        } else if (type === 'ice-candidate') {
            try {
                if (pc.remoteDescription) {
                    await pc.addIceCandidate(new RTCIceCandidate(data));
                } else {
                    if (!iceQueuesRef.current[from]) iceQueuesRef.current[from] = [];
                    iceQueuesRef.current[from].push(data);
                }
            } catch (err) {
                if (!ignoreOfferRef.current[from]) {
                    throw err;
                }
            }
        }
    } catch (err) {
        console.error('Error handling signal:', err);
    }
  }, [createPeerConnection, processIceQueue]);

  const disconnect = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    Object.values(pcsRef.current).forEach(pc => {
        try { pc.close(); } catch(e) {}
    });
    pcsRef.current = {};

    Object.values(sourceNodesRef.current).forEach(node => {
        try { node.disconnect(); } catch(e) {}
    });
    sourceNodesRef.current = {};

    Object.values(cleanupTimeoutsRef.current).forEach(timeout => {
        clearTimeout(timeout);
    });
    cleanupTimeoutsRef.current = {};

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    remoteStreamsRef.current = {};
    analysersRef.current = {};

    setIsConnected(false);
    setIsConnecting(false);
    setParticipants([]);
    setSpeakingStates({});
  }, []);

  const connect = useCallback(async (roomName: string, player: Player) => {
    if (isConnected || isConnecting) return;

    setIsConnecting(true);
    setError(null);
    localPlayerRef.current = player;
    lobbyCodeRef.current = roomName;

    try {
      if (!window.isSecureContext) {
        throw new Error('Voice chat requires a secure context (HTTPS).');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1,
        }
      });

      localStreamRef.current = stream;
      setupAudioSystem(stream, player.id, false);

      const channel = supabase.channel(`voice-${roomName}`);

      channel
        .on('broadcast', { event: 'signal' }, handleSignal)
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            setIsConnected(true);
            setIsConnecting(false);

            channel.send({
              type: 'broadcast',
              event: 'signal',
              payload: { from: player.id, type: 'join' }
            });
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
              setIsConnected(false);
              setIsConnecting(false);
          }
        });

      channelRef.current = channel;
    } catch (err: any) {
      console.error('Failed to connect to voice:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Microphone access denied. Please check your browser settings and try again.');
      } else {
          setError(err.message || 'Could not access microphone.');
      }
      setIsConnecting(false);
      disconnect();
    }
  }, [isConnected, isConnecting, handleSignal, setupAudioSystem, disconnect]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        const newMuteState = !isMuted;
        audioTrack.enabled = !newMuteState;
        setIsMuted(newMuteState);
      }
    }
  }, [isMuted]);

  const setVolume = useCallback((newVolume: number) => {
    setVolumeState(newVolume);
    if (masterGainRef.current) {
        masterGainRef.current.gain.setTargetAtTime(newVolume / 100, audioContextRef.current?.currentTime || 0, 0.1);
    }
  }, []);

  useEffect(() => {
    updateParticipantsList();
  }, [currentLobby, speakingStates, isMuted, updateParticipantsList]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isConnected) {
        resumeAudio();

        // Check health of all peer connections
        Object.entries(pcsRef.current).forEach(([id, pc]) => {
          if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
            console.log(`Connection to ${id} is ${pc.iceConnectionState}, attempting ICE restart...`);
            pc.restartIce();
          }
        });

        // Send a join signal again to refresh connections if any dropped
        if (channelRef.current && localPlayerRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'signal',
            payload: { from: localPlayerRef.current.id, type: 'join' }
          });
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      disconnect();
    };
  }, [disconnect, isConnected, resumeAudio]);

  return (
    <VoiceContext.Provider
      value={{
        isConnected,
        isConnecting,
        isMuted,
        volume,
        participants,
        connect,
        disconnect,
        toggleMute,
        setVolume,
        error,
        resumeAudio
      }}
    >
      {children}
      <div className="hidden" aria-hidden="true">
        {participants.map(p => {
          if (p.id !== localPlayerRef.current?.id && p.stream) {
            return <AudioElement key={p.id} stream={p.stream} />;
          }
          return null;
        })}
      </div>
    </VoiceContext.Provider>
  );
};
