import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import Peer, { MediaConnection } from 'peerjs';
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

export const useVoice = () => {
  const context = useContext(VoiceContext);
  if (!context) {
    throw new Error('useVoice must be used within a VoiceProvider');
  }
  return context;
};

// Hoisted helper components
function AudioElement({ stream, volume }: { stream: MediaStream, volume: number }) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.srcObject = stream;
      audioRef.current.volume = volume / 100;
    }
  }, [stream, volume]);

  return <audio ref={audioRef} autoPlay />;
}

function RemoteAudioStreams({ participants, localId, volume }: { participants: VoiceParticipant[], localId?: string, volume: number }) {
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
}

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
        const isSpeaking = average > 20;

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

  const updateParticipantsListRef = useRef(updateParticipantsList);
  useEffect(() => {
    updateParticipantsListRef.current = updateParticipantsList;
  });

  const connectToPeer = useCallback((remotePeerId: string, playerId: string) => {
    if (!peerRef.current || !localStreamRef.current || connectionsRef.current[playerId]) return;

    console.log(`Calling peer: ${remotePeerId}`);
    const call = peerRef.current.call(remotePeerId, localStreamRef.current);

    call.on('stream', (remoteStream) => {
      console.log(`Received stream from: ${playerId}`);
      remoteStreamsRef.current[playerId] = remoteStream;
      setupAudioAnalysis(remoteStream, playerId);
      updateParticipantsListRef.current();
    });

    call.on('close', () => {
      delete connectionsRef.current[playerId];
      delete remoteStreamsRef.current[playerId];
      delete analysersRef.current[playerId];
      updateParticipantsListRef.current();
    });

    connectionsRef.current[playerId] = call;
  }, [setupAudioAnalysis]);

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
      });

      newPeer.on('call', (call) => {
        console.log('Receiving call from:', call.peer);
        call.answer(localStreamRef.current!);

        const remotePlayerId = call.peer.split('-').pop()!;

        call.on('stream', (remoteStream) => {
          remoteStreamsRef.current[remotePlayerId] = remoteStream;
          setupAudioAnalysis(remoteStream, remotePlayerId);
          updateParticipantsListRef.current();
        });

        call.on('close', () => {
          delete connectionsRef.current[remotePlayerId];
          delete remoteStreamsRef.current[remotePlayerId];
          delete analysersRef.current[remotePlayerId];
          updateParticipantsListRef.current();
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
  }, [isConnecting, setupAudioAnalysis]);

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
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  useEffect(() => {
    updateParticipantsList();

    if (isConnected && peerRef.current && currentLobby) {
        const localPlayerId = peerRef.current.id.split('-').pop();
        const roomName = peerRef.current.id.split('-').slice(1, -1).join('-');

        currentLobby.players.forEach(p => {
            if (p.id !== localPlayerId && !connectionsRef.current[p.id]) {
                if (localPlayerId! < p.id) {
                    connectToPeer(`playq-${roomName}-${p.id}`, p.id);
                }
            }
        });
    }
  }, [currentLobby, speakingStates, updateParticipantsList, isConnected, connectToPeer]);

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
        <RemoteAudioStreams participants={participants} localId={peerRef.current?.id.split('-').pop()} volume={volume} />
      </div>
    </VoiceContext.Provider>
  );
};
