import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';

export type SoundName = 'dice' | 'card' | 'move' | 'win' | 'error' | 'success';

interface SoundContextType {
  soundEnabled: boolean;
  soundVolume: number;
  setSoundEnabled: (enabled: boolean) => void;
  setSoundVolume: (volume: number) => void;
  playSound: (soundName: SoundName) => void;
}

const SoundContext = createContext<SoundContextType | undefined>(undefined);

export const useSound = () => {
  const context = useContext(SoundContext);
  if (!context) {
    throw new Error('useSound must be used within a SoundProvider');
  }
  return context;
};

const SOUNDS = {
  dice: 'https://assets.mixkit.co/active_storage/sfx/1003/1003-preview.mp3',
  card: 'https://assets.mixkit.co/active_storage/sfx/2012/2012-preview.mp3',
  move: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
  win: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
  error: 'https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3',
  success: 'https://assets.mixkit.co/active_storage/sfx/1110/1110-preview.mp3',
};

export const SoundProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const stored = localStorage.getItem('playq-sound-enabled');
    return stored !== null ? JSON.parse(stored) : true;
  });

  const [soundVolume, setSoundVolume] = useState(() => {
    const stored = localStorage.getItem('playq-sound-volume');
    return stored !== null ? JSON.parse(stored) : 80;
  });

  const audioCache = useRef<Record<string, HTMLAudioElement>>({});

  useEffect(() => {
    localStorage.setItem('playq-sound-enabled', JSON.stringify(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    localStorage.setItem('playq-sound-volume', JSON.stringify(soundVolume));
  }, [soundVolume]);

  useEffect(() => {
    // Preload sounds
    Object.entries(SOUNDS).forEach(([name, url]) => {
      const audio = new Audio(url);
      audio.load();
      audioCache.current[name] = audio;
    });
  }, []);

  const playSound = useCallback((soundName: keyof typeof SOUNDS) => {
    if (!soundEnabled) return;

    const audio = audioCache.current[soundName];
    if (audio) {
      // Create a new Audio object or clone the cached one to allow overlapping sounds
      const playInstance = audio.cloneNode() as HTMLAudioElement;
      playInstance.volume = soundVolume / 100;
      playInstance.play().catch(err => {
        // Only log error if it's not the "user didn't interact" error
        if (err.name !== 'NotAllowedError') {
          console.error('Error playing sound:', err);
        }
      });
    }
  }, [soundEnabled, soundVolume]);

  return (
    <SoundContext.Provider value={{
      soundEnabled,
      soundVolume,
      setSoundEnabled,
      setSoundVolume,
      playSound
    }}>
      {children}
    </SoundContext.Provider>
  );
};
