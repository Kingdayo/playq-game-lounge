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

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.srcObject = stream;
      audioRef.current.volume = volume / 100;

      const playAudio = async () => {
        try {
          if (audioRef.current) {
            await audioRef.current.play();
          }
        } catch (e) {
          console.error('Autoplay failed:', e);
        }
      };
      playAudio();
    }
  }, [stream, volume]);

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

  const updateParticipantsList = useCallback(() => {
    if (!currentLobby) return;

    const list: VoiceParticipant[] = currentLobby.players.map(player => {
      const isLocal = player.id === localPlayerRef.current?.id;
      return {
        id: player.id,
        name: player.name,
        avatar: player.avatar,
        isSpeaking: speakingStates[player.id] || false,
        isMuted: false,
        stream: isLocal ? localStreamRef.current || undefined : remoteStreamsRef.current[player.id]
      };
    });
    setParticipants(list);
  }, [currentLobby, speakingStates]);

  const setupAudioAnalysis = useCallback((stream: MediaStream, playerId: string) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
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
        const isSpeaking = average > 20;

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

            // Re-attempt connection if it was a failure and we are still in the room
            if (pc.iceConnectionState === 'failed' && channelRef.current) {
                 console.log(`Re-announcing to trigger reconnection with ${remoteId}`);
                 channelRef.current.send({
                    type: 'broadcast',
                    event: 'signal',
                    payload: {
                      from: localPlayerRef.current?.id,
                      type: 'join'
                    }
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

    // Global signals
    if (type === 'join') {
        if (from === localPlayerRef.current?.id) return;
        console.log(`Player ${from} joined voice lounge`);
        // If our ID is "lower", we initiate the call
        if (localPlayerRef.current && localPlayerRef.current.id < from) {
            createPeerConnection(from, true);
        }
        return;
    }

    // Direct signals
    if (to !== localPlayerRef.current?.id) return;

    console.log(`Received signal ${type} from ${from}`);

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
    console.log('Disconnecting voice...');
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

    console.log(`Connecting to voice lobby: ${roomName} as ${player.name}`);
    setIsConnecting(true);
    setError(null);
    localPlayerRef.current = player;
    lobbyCodeRef.current = roomName;

    try {
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
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Subscribed to voice signaling channel');
            setIsConnected(true);
            setIsConnecting(false);

            // Announce presence
            channel.send({
              type: 'broadcast',
              event: 'signal',
              payload: {
                from: player.id,
                type: 'join'
              }
            });
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
              console.error('Voice channel error:', status);
              setIsConnected(false);
          }
        });

      channelRef.current = channel;
    } catch (err: any) {
      console.error('Failed to connect to voice:', err);
      if (err.name === 'NotAllowedError') {
          setError('Microphone access denied. Please allow microphone access to use voice chat.');
      } else {
          setError(err.message || 'Failed to access microphone');
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
  }, [currentLobby, speakingStates, updateParticipantsList]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

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
