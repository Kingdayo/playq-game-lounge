import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import Peer, { MediaConnection } from 'peerjs';
import { Player, useGame } from './GameContext';

export interface VoiceParticipant {
  id: string;
  name: string;
  avatar: string;
  isSpeaking: boolean;
  isMuted: boolean;
  stream?: MediaStream;
}

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

export const useVoice = () => {
  const context = useContext(VoiceContext);
  if (!context) {
    throw new Error('useVoice must be used within a VoiceProvider');
  }
  return context;
};

interface VoiceProviderProps {
  children: React.ReactNode;
}

export const VoiceProvider: React.FC<VoiceProviderProps> = ({ children }) => {
  const { currentLobby } = useGame();
  const [peer, setPeer] = useState<Peer | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolumeState] = useState(100);
  const [error, setError] = useState<string | null>(null);

  // Track connections and streams
  const connectionsRef = useRef<Record<string, MediaConnection>>({});
  const remoteStreamsRef = useRef<Record<string, MediaStream>>({});
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);

  // VAD logic
  const [speakingStates, setSpeakingStates] = useState<Record<string, boolean>>({});
  const audioContextRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef<Record<string, AnalyserNode>>({});

  const updateParticipantsList = useCallback(() => {
    if (!currentLobby) return;

    const list: VoiceParticipant[] = currentLobby.players.map(player => {
      const isLocal = player.id === peerRef.current?.id.split('-').pop();
      return {
        id: player.id,
        name: player.name,
        avatar: player.avatar,
        isSpeaking: speakingStates[player.id] || false,
        isMuted: false, // In P2P we don't easily know if others are muted unless we send data
        stream: isLocal ? localStreamRef.current || undefined : remoteStreamsRef.current[player.id]
      };
    });
    setParticipants(list);
  }, [currentLobby, speakingStates]);

  useEffect(() => {
    updateParticipantsList();

    // Auto-connect to new players
    if (isConnected && peerRef.current && currentLobby) {
        const localPlayerId = peerRef.current.id.split('-').pop();
        const roomName = peerRef.current.id.split('-').slice(1, -1).join('-');

        currentLobby.players.forEach(p => {
            if (p.id !== localPlayerId && !connectionsRef.current[p.id]) {
                // To avoid race conditions where both peers call each other,
                // only the peer with the lexicographically "smaller" ID initiates the call.
                if (localPlayerId! < p.id) {
                    connectToPeer(`playq-${roomName}-${p.id}`, p.id);
                }
            }
        });
    }
  }, [currentLobby, speakingStates, updateParticipantsList, isConnected, connectToPeer]);

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
        if (!analysersRef.current[playerId]) return;
        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const isSpeaking = average > 20; // Threshold

        setSpeakingStates(prev => {
          if (prev[playerId] === isSpeaking) return prev;
          return { ...prev, [playerId]: isSpeaking };
        });

        if (peerRef.current) {
            requestAnimationFrame(checkSpeaking);
        }
      };

      checkSpeaking();
    } catch (e) {
      console.error('Error setting up audio analysis:', e);
    }
  }, []);

  const connectToPeer = useCallback((remotePeerId: string, playerId: string) => {
    if (!peerRef.current || !localStreamRef.current || connectionsRef.current[playerId]) return;

    console.log(`Calling peer: ${remotePeerId}`);
    const call = peerRef.current.call(remotePeerId, localStreamRef.current);

    call.on('stream', (remoteStream) => {
      console.log(`Received stream from: ${playerId}`);
      remoteStreamsRef.current[playerId] = remoteStream;
      setupAudioAnalysis(remoteStream, playerId);
      updateParticipantsList();
    });

    call.on('close', () => {
      delete connectionsRef.current[playerId];
      delete remoteStreamsRef.current[playerId];
      delete analysersRef.current[playerId];
      updateParticipantsList();
    });

    connectionsRef.current[playerId] = call;
  }, [setupAudioAnalysis, updateParticipantsList]);

  const connect = useCallback(async (roomName: string, player: Player) => {
    if (peerRef.current || isConnecting) return;

    setIsConnecting(true);
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setLocalStream(stream);
      localStreamRef.current = stream;
      setupAudioAnalysis(stream, player.id);

      const newPeer = new Peer(`playq-${roomName}-${player.id}`, {
        debug: 1
      });

      newPeer.on('open', (id) => {
        console.log('Peer connected with ID:', id);
        setIsConnected(true);
        setIsConnecting(false);
        setPeer(newPeer);
        peerRef.current = newPeer;

        // Initial connections will be handled by the useEffect watching currentLobby
      });

      newPeer.on('call', (call) => {
        console.log('Receiving call from:', call.peer);
        call.answer(localStreamRef.current!);

        const remotePlayerId = call.peer.split('-').pop()!;

        call.on('stream', (remoteStream) => {
          remoteStreamsRef.current[remotePlayerId] = remoteStream;
          setupAudioAnalysis(remoteStream, remotePlayerId);
          updateParticipantsList();
        });

        call.on('close', () => {
          delete connectionsRef.current[remotePlayerId];
          delete remoteStreamsRef.current[remotePlayerId];
          delete analysersRef.current[remotePlayerId];
          updateParticipantsList();
        });

        connectionsRef.current[remotePlayerId] = call;
      });

      newPeer.on('error', (err) => {
        console.error('PeerJS error:', err);
        setError(`Connection error: ${err.type}`);
        setIsConnecting(false);
      });

    } catch (err: any) {
      console.error('Failed to get media devices:', err);
      setError('Could not access microphone');
      setIsConnecting(false);
    }
  }, [isConnecting, currentLobby, connectToPeer, setupAudioAnalysis, updateParticipantsList]);

  const disconnect = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
      setPeer(null);
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }

    // Cleanup connections
    Object.values(connectionsRef.current).forEach(conn => conn.close());
    connectionsRef.current = {};
    remoteStreamsRef.current = {};
    analysersRef.current = {};

    setIsConnected(false);
    setParticipants([]);
    setSpeakingStates({});
  }, []);

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
    // In P2P we'd need to adjust volume on the actual <audio> elements
    // This state will be used by the UI
  }, []);

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

      {/* Hidden audio elements for remote streams */}
      <div className="hidden">
        {participants.map(p => {
          if (p.id !== currentLobby?.players.find(pl => pl.name === p.name)?.id && p.stream) {
              // Only render audio for remote streams
              // Find if this participant is me
              const isMe = currentLobby?.players.find(pl => pl.id === p.id)?.name === p.name;
              // Wait, participant id IS player id now in my mapping
              // Let's check against local player
              return null; // We'll handle audio elements in a better way
          }
          return null;
        })}
        {/* We need to actually play the remote streams */}
        <RemoteAudioStreams participants={participants} localId={peerRef.current?.id.split('-').pop()} volume={volume} />
      </div>
    </VoiceContext.Provider>
  );
};

const RemoteAudioStreams: React.FC<{ participants: VoiceParticipant[], localId?: string, volume: number }> = ({ participants, localId, volume }) => {
    return (
        <>
            {participants.map(p => {
                if (p.id !== localId && p.stream) {
                    return <AudioElement key={p.id} stream={p.stream} volume={volume} />;
                }
                return null;
            })}
        </>
    );
};

const AudioElement: React.FC<{ stream: MediaStream, volume: number }> = ({ stream, volume }) => {
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.srcObject = stream;
            audioRef.current.volume = volume / 100;
        }
    }, [stream, volume]);

    return <audio ref={audioRef} autoPlay />;
};
