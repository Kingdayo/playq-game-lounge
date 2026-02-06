import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import DailyIframe, { DailyCall, DailyEventObjectActiveSpeakerChange } from '@daily-co/daily-js';
import { Player } from './GameContext';

export interface VoiceParticipant {
  id: string;
  name: string;
  avatar: string;
  isSpeaking: boolean;
  isMuted: boolean;
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
  const [callObject, setCallObject] = useState<DailyCall | null>(null);
  const callObjectRef = useRef<DailyCall | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolumeState] = useState(100);
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [error, setError] = useState<string | null>(null);

  const domain = import.meta.env.VITE_DAILY_DOMAIN || 'playq';

  const updateParticipants = useCallback((call: DailyCall) => {
    const dailyParticipants = call.participants();
    const voiceParticipants: VoiceParticipant[] = Object.values(dailyParticipants).map((p) => {
      let name = p.user_name || 'Unknown';
      let avatar = '👤';

      try {
        if (p.user_name && p.user_name.includes('|')) {
            const parts = p.user_name.split('|');
            name = parts[0];
            avatar = parts[1];
        }
      } catch (e) {
          console.error('Error parsing participant metadata', e);
      }

      return {
        id: p.session_id,
        name: name,
        avatar: avatar,
        isSpeaking: false, // Default to false, handled by active-speaker-change
        isMuted: !p.audio,
      };
    });
    setParticipants(voiceParticipants);
  }, []);

  const connect = useCallback(async (roomName: string, player: Player) => {
    if (callObjectRef.current || isConnecting) return;

    setIsConnecting(true);
    setError(null);

    try {
      const roomUrl = `https://${domain}.daily.co/${roomName}`;
      const newCallObject = DailyIframe.createCallObject({
        audioSource: true,
        videoSource: false,
      });

      callObjectRef.current = newCallObject;
      setCallObject(newCallObject);

      // Set up events
      newCallObject.on('joined-meeting', () => {
        setIsConnected(true);
        setIsConnecting(false);
        updateParticipants(newCallObject);
      });

      newCallObject.on('participant-joined', () => updateParticipants(newCallObject));
      newCallObject.on('participant-updated', () => updateParticipants(newCallObject));
      newCallObject.on('participant-left', () => updateParticipants(newCallObject));

      newCallObject.on('active-speaker-change', (evt: DailyEventObjectActiveSpeakerChange) => {
        setParticipants(prev => prev.map(p => ({
            ...p,
            isSpeaking: p.id === evt.activeSpeaker.peerId
        })));
      });

      newCallObject.on('error', (evt: any) => {
        console.error('Daily error:', evt);
        setError(evt.errorMsg || 'An unknown error occurred');
        setIsConnecting(false);
      });

      await newCallObject.join({
        url: roomUrl,
        userName: `${player.name}|${player.avatar}`,
      });
    } catch (err: any) {
      console.error('Failed to connect to voice:', err);
      setError(err.message || 'Failed to connect to voice');
      setIsConnecting(false);
      setCallObject(null);
    }
  }, [callObject, isConnecting, domain, updateParticipants]);

  const disconnect = useCallback(() => {
    if (callObjectRef.current) {
      callObjectRef.current.leave();
      callObjectRef.current.destroy();
      callObjectRef.current = null;
      setCallObject(null);
      setIsConnected(false);
      setParticipants([]);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (callObject) {
      const newMuteState = !isMuted;
      callObject.setLocalAudio(!newMuteState);
      setIsMuted(newMuteState);
    }
  }, [callObject, isMuted]);

  const setVolume = useCallback((newVolume: number) => {
    setVolumeState(newVolume);
  }, []);

  useEffect(() => {
    return () => {
      if (callObjectRef.current) {
        callObjectRef.current.leave();
        callObjectRef.current.destroy();
        callObjectRef.current = null;
      }
    };
  }, []);

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
    </VoiceContext.Provider>
  );
};
