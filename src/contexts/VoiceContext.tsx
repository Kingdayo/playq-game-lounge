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

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export const useVoice = () => {
  const context = useContext(VoiceContext);
  if (!context) {
    throw new Error('useVoice must be used within a VoiceProvider');
  }
  return context;
};

// Audio Element for remote streams
function AudioElement({ stream, volume }: { stream: MediaStream, volume: number }) {
  const audioRef = useRef<HTMLAudioElement>(null);

  const attemptPlay = useCallback(async () => {
    if (!audioRef.current) return;
    try {
      await audioRef.current.play();
    } catch (e) {
      console.warn('Autoplay prevented, waiting for user interaction:', e);
      // Fallback: retry play on next body click
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
      audioRef.current.volume = volume / 100;
      attemptPlay();
    }
  }, [stream, volume, attemptPlay]);

  return <audio ref={audioRef} autoPlay playsInline />;
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
  const remoteStreamsRef = useRef<Record<string, MediaStream>>({});
  const iceQueuesRef = useRef<Record<string, RTCIceCandidateInit[]>>({});
  const channelRef = useRef<any>(null);
  const localPlayerRef = useRef<Player | null>(null);
  const lobbyCodeRef = useRef<string | null>(null);

  // Audio Analysis Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef<Record<string, AnalyserNode>>({});

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

  const setupAudioAnalysis = useCallback((stream: MediaStream, playerId: string) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const source = audioContextRef.current.createMediaStreamSource(stream);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analysersRef.current[playerId] = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkSpeaking = () => {
        if (!analysersRef.current?.[playerId]) return;
        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const isSpeaking = average > 15; // Slightly more sensitive for mobile

        setSpeakingStates(prev => {
          if (prev[playerId] === isSpeaking) return prev;
          return { ...prev, [playerId]: isSpeaking };
        });

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
  }, []);

  const createPeerConnection = useCallback((remoteId: string, shouldCreateOffer: boolean) => {
    if (pcsRef.current[remoteId]) return pcsRef.current[remoteId];

    console.log(`Creating PeerConnection for ${remoteId}, shouldCreateOffer: ${shouldCreateOffer}`);
    const pc = new RTCPeerConnection(ICE_SERVERS);

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
      setupAudioAnalysis(stream, remoteId);
      updateParticipantsList();
    };

    pc.oniceconnectionstatechange = () => {
        console.log(`ICE state for ${remoteId}: ${pc.iceConnectionState}`);
        if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
            console.log(`Cleaning up connection for ${remoteId}`);
            delete pcsRef.current[remoteId];
            delete remoteStreamsRef.current[remoteId];
            delete analysersRef.current[remoteId];
            delete iceQueuesRef.current[remoteId];
            pc.close();
            updateParticipantsList();

            if (pc.iceConnectionState === 'failed' && channelRef.current) {
                 channelRef.current.send({
                    type: 'broadcast',
                    event: 'signal',
                    payload: { from: localPlayerRef.current?.id, type: 'join' }
                  });
            }
        }
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pcsRef.current[remoteId] = pc;

    if (shouldCreateOffer) {
      pc.createOffer({ offerToReceiveAudio: true }).then(offer => {
        return pc.setLocalDescription(offer);
      }).then(() => {
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'signal',
            payload: {
              from: localPlayerRef.current?.id,
              to: remoteId,
              type: 'offer',
              data: pc.localDescription
            }
          });
        }
      });
    }

    return pc;
  }, [setupAudioAnalysis, updateParticipantsList]);

  const handleSignal = useCallback(async ({ payload }: { payload: any }) => {
    const { from, to, type, data } = payload;

    if (type === 'join') {
        if (from === localPlayerRef.current?.id) return;
        if (localPlayerRef.current && localPlayerRef.current.id < from) {
            createPeerConnection(from, true);
        }
        return;
    }

    if (to !== localPlayerRef.current?.id) return;

    try {
        if (type === 'offer') {
            const pc = createPeerConnection(from, false);
            await pc.setRemoteDescription(new RTCSessionDescription(data));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            channelRef.current.send({
                type: 'broadcast',
                event: 'signal',
                payload: {
                    from: localPlayerRef.current?.id,
                    to: from,
                    type: 'answer',
                    data: pc.localDescription
                }
            });
            await processIceQueue(from, pc);
        } else if (type === 'answer') {
            const pc = pcsRef.current[from];
            if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(data));
                await processIceQueue(from, pc);
            }
        } else if (type === 'ice-candidate') {
            const pc = pcsRef.current[from];
            if (pc && pc.remoteDescription) {
                await pc.addIceCandidate(new RTCIceCandidate(data));
            } else {
                if (!iceQueuesRef.current[from]) iceQueuesRef.current[from] = [];
                iceQueuesRef.current[from].push(data);
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

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    remoteStreamsRef.current = {};
    analysersRef.current = {};
    iceQueuesRef.current = {};

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
          autoGainControl: true
        }
      });

      localStreamRef.current = stream;
      setupAudioAnalysis(stream, player.id);

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
  }, [isConnected, isConnecting, handleSignal, setupAudioAnalysis, disconnect]);

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
  }, []);

  useEffect(() => {
    updateParticipantsList();
  }, [currentLobby, speakingStates, isMuted, updateParticipantsList]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isConnected) {
        resumeAudio();
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
      <div className="hidden">
        {participants.map(p => {
          if (p.id !== localPlayerRef.current?.id && p.stream) {
            return <AudioElement key={p.id} stream={p.stream} volume={volume} />;
          }
          return null;
        })}
      </div>
    </VoiceContext.Provider>
  );
};
