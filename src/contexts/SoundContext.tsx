import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { SoundName, BGMType } from '@/types/game';

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
  dice: 'https://assets.mixkit.co/active_storage/sfx/1012/1012-preview.mp3',
  card: 'https://assets.mixkit.co/active_storage/sfx/2011/2011-preview.mp3',
  move: 'https://assets.mixkit.co/active_storage/sfx/2561/2561-preview.mp3',
  win: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
  error: 'https://assets.mixkit.co/active_storage/sfx/2567/2567-preview.mp3',
  success: 'https://assets.mixkit.co/active_storage/sfx/1103/1103-preview.mp3',
  chat: 'https://assets.mixkit.co/active_storage/sfx/2357/2357-preview.mp3',
};

const BGM_URLS = {
  uno: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  ludo: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
  dominoes: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  pictionary: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
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

  const sfxCache = useRef<Record<string, HTMLAudioElement>>({});
  const bgmCache = useRef<Record<string, HTMLAudioElement>>({});
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const currentBGMType = useRef<BGMType | null>(null);

  useEffect(() => {
    localStorage.setItem('playq-sound-enabled', JSON.stringify(soundEnabled));
    if (bgmRef.current) {
      if (!soundEnabled) {
        bgmRef.current.pause();
      } else if (currentBGMType.current) {
        const playPromise = bgmRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {});
        }
      }
    }
  }, [soundEnabled]);

  useEffect(() => {
    localStorage.setItem('playq-sound-volume', JSON.stringify(soundVolume));
    if (bgmRef.current) {
      bgmRef.current.volume = (soundVolume / 100) * 0.15;
    }
  }, [soundVolume]);

  useEffect(() => {
    // Preload sounds
    Object.entries(SOUNDS).forEach(([name, url]) => {
      const audio = new Audio(url);
      audio.load();
      sfxCache.current[name] = audio;
    });

    // Preload BGMs
    Object.entries(BGM_URLS).forEach(([name, url]) => {
      const audio = new Audio(url);
      audio.loop = true;
      audio.load();
      bgmCache.current[name] = audio;
    });
  }, []);

  const playSound = useCallback((soundName: SoundName) => {
    if (!soundEnabled) return;

    const audio = sfxCache.current[soundName];
    if (audio) {
      const playInstance = audio.cloneNode() as HTMLAudioElement;
      playInstance.volume = (soundVolume / 100) * 0.3;
      const playPromise = playInstance.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
            console.error('Error playing sound:', err);
          }
        });
      }
    }
  }, [soundEnabled, soundVolume]);

  const stopBGM = useCallback(() => {
    if (bgmRef.current) {
      bgmRef.current.pause();
      bgmRef.current.currentTime = 0; // Reset for better "stopped" behavior
      bgmRef.current = null;
      currentBGMType.current = null;
    }
  }, []);

  const playBGM = useCallback((type: BGMType) => {
    if (currentBGMType.current === type) return;

    stopBGM();

    const audio = bgmCache.current[type];
    if (audio) {
      audio.volume = (soundVolume / 100) * 0.15;
      bgmRef.current = audio;
      currentBGMType.current = type;

      if (soundEnabled) {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(err => {
            if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
              console.error('Error playing BGM:', err);
            }
          });
        }
      }
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
