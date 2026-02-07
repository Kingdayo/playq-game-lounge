import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';

export type SoundName = 'dice' | 'card' | 'move' | 'win' | 'error' | 'success';
export type BGMType = 'uno' | 'ludo' | 'dominoes' | 'pictionary';

interface SoundContextType {
  soundEnabled: boolean;
  soundVolume: number;
  setSoundEnabled: (enabled: boolean) => void;
  setSoundVolume: (volume: number) => void;
  playSound: (soundName: SoundName) => void;
  playBGM: (type: BGMType) => void;
  stopBGM: () => void;
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

const BGM_URLS = {
  uno: 'https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3',
  ludo: 'https://assets.mixkit.co/music/preview/mixkit-games-worldbeat-466.mp3',
  dominoes: 'https://assets.mixkit.co/music/preview/mixkit-jazzy-abstract-beat-1122.mp3',
  pictionary: 'https://assets.mixkit.co/music/preview/mixkit-dreaming-big-31.mp3',
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
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const currentBGMType = useRef<BGMType | null>(null);

  useEffect(() => {
    localStorage.setItem('playq-sound-enabled', JSON.stringify(soundEnabled));
    if (bgmRef.current) {
      if (!soundEnabled) {
        bgmRef.current.pause();
      } else if (currentBGMType.current) {
        bgmRef.current.play().catch(() => {});
      }
    }
  }, [soundEnabled]);

  useEffect(() => {
    localStorage.setItem('playq-sound-volume', JSON.stringify(soundVolume));
    if (bgmRef.current) {
      bgmRef.current.volume = (soundVolume / 100) * 0.4; // BGM is quieter (40% of master)
    }
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
      const playInstance = audio.cloneNode() as HTMLAudioElement;
      playInstance.volume = soundVolume / 100;
      playInstance.play().catch(err => {
        if (err.name !== 'NotAllowedError') {
          console.error('Error playing sound:', err);
        }
      });
    }
  }, [soundEnabled, soundVolume]);

  const stopBGM = useCallback(() => {
    if (bgmRef.current) {
      bgmRef.current.pause();
      bgmRef.current = null;
      currentBGMType.current = null;
    }
  }, []);

  const playBGM = useCallback((type: BGMType) => {
    if (currentBGMType.current === type) return;

    stopBGM();

    const audio = new Audio(BGM_URLS[type]);
    audio.loop = true;
    audio.volume = (soundVolume / 100) * 0.4;
    bgmRef.current = audio;
    currentBGMType.current = type;

    if (soundEnabled) {
      audio.play().catch(err => {
        if (err.name !== 'NotAllowedError') {
          console.error('Error playing BGM:', err);
        }
      });
    }
  }, [soundEnabled, soundVolume, stopBGM]);

  return (
    <SoundContext.Provider value={{
      soundEnabled,
      soundVolume,
      setSoundEnabled,
      setSoundVolume,
      playSound,
      playBGM,
      stopBGM
    }}>
      {children}
    </SoundContext.Provider>
  );
};
