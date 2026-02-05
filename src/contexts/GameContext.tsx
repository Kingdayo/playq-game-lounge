import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface Player {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  isReady: boolean;
  isOnline: boolean;
}

export interface GameSettings {
  maxPlayers: number;
  timeLimit?: number;
  houseRules: Record<string, boolean>;
}

export interface Lobby {
  id: string;
  code: string;
  gameType: 'uno' | 'ludo' | 'pictionary' | 'dominoes';
  host: Player;
  players: Player[];
  settings: GameSettings;
  status: 'waiting' | 'starting' | 'in-progress' | 'finished';
  createdAt: Date;
}

interface GameContextType {
  currentPlayer: Player | null;
  currentLobby: Lobby | null;
  setCurrentPlayer: (player: Player | null) => void;
  createLobby: (gameType: Lobby['gameType']) => Lobby;
  joinLobby: (code: string) => Promise<boolean>;
  leaveLobby: () => void;
  setPlayerReady: (ready: boolean) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};

const generateCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const avatars = [
  '🎮', '🎯', '🎲', '🃏', '🎨', '🏆', '⭐', '🔥', '💎', '🌟',
  '🦊', '🐺', '🦁', '🐯', '🐻', '🐼', '🐨', '🐸', '🐙', '🦄'
];

const LOBBIES_STORAGE_KEY = 'playq-lobbies';

// Helper to get all lobbies
const getStoredLobbies = (): Record<string, Lobby> => {
  try {
    const stored = localStorage.getItem(LOBBIES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Error reading lobbies from localStorage:', error);
    return {};
  }
};

// Helper to save a lobby
const saveLobbyToStore = (lobby: Lobby) => {
  try {
    const lobbies = getStoredLobbies();
    lobbies[lobby.code] = lobby;
    localStorage.setItem(LOBBIES_STORAGE_KEY, JSON.stringify(lobbies));
    // Dispatch a storage event manually for the current tab
    window.dispatchEvent(new Event('storage-update'));
  } catch (error) {
    console.error('Error saving lobby to localStorage:', error);
  }
};

interface GameProviderProps {
  children: ReactNode;
}

export const GameProvider: React.FC<GameProviderProps> = ({ children }) => {
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(() => {
    const stored = localStorage.getItem('playq-player');
    if (stored) {
      return JSON.parse(stored);
    }
    // Create default player
    const player: Player = {
      id: crypto.randomUUID(),
      name: `Player${Math.floor(Math.random() * 9999)}`,
      avatar: avatars[Math.floor(Math.random() * avatars.length)],
      isHost: false,
      isReady: false,
      isOnline: true,
    };
    localStorage.setItem('playq-player', JSON.stringify(player));
    return player;
  });

  const [currentLobby, setCurrentLobby] = useState<Lobby | null>(null);

  // Rehydrate lobby from URL if needed
  React.useEffect(() => {
    const path = window.location.pathname;
    const lobbyMatch = path.match(/\/lobby\/([A-Z0-9]{6})/);
    if (lobbyMatch && !currentLobby) {
      const code = lobbyMatch[1];
      const lobbies = getStoredLobbies();
      const lobby = lobbies[code];
      if (lobby) {
        setCurrentLobby(lobby);
      }
    }
  }, [currentLobby]);

  // Sync with localStorage
  React.useEffect(() => {
    const syncLobby = () => {
      if (currentLobby) {
        const lobbies = getStoredLobbies();
        const updatedLobby = lobbies[currentLobby.code];
        if (updatedLobby && JSON.stringify(updatedLobby) !== JSON.stringify(currentLobby)) {
          setCurrentLobby(updatedLobby);
        }
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === LOBBIES_STORAGE_KEY) {
        syncLobby();
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('storage-update', syncLobby);

    // Polling as a fallback for some environments or single-tab testing if needed
    const interval = setInterval(syncLobby, 2000);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('storage-update', syncLobby);
      clearInterval(interval);
    };
  }, [currentLobby]);

  const createLobby = (gameType: Lobby['gameType']): Lobby => {
    if (!currentPlayer) throw new Error('No player set');

    const maxPlayersMap = {
      uno: 10,
      ludo: 4,
      pictionary: 8,
      dominoes: 4,
    };

    const hostPlayer: Player = { ...currentPlayer, isHost: true, isReady: true };
    
    const lobby: Lobby = {
      id: crypto.randomUUID(),
      code: generateCode(),
      gameType,
      host: hostPlayer,
      players: [hostPlayer],
      settings: {
        maxPlayers: maxPlayersMap[gameType],
        timeLimit: gameType === 'pictionary' ? 60 : undefined,
        houseRules: {},
      },
      status: 'waiting',
      createdAt: new Date(),
    };

    saveLobbyToStore(lobby);
    setCurrentLobby(lobby);
    setCurrentPlayer(hostPlayer);
    return lobby;
  };

  const joinLobby = async (code: string): Promise<boolean> => {
    if (!currentPlayer) throw new Error('No player set');

    console.log('Attempting to join lobby:', code);
    
    // Simulate a delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const lobbies = getStoredLobbies();
    const lobby = lobbies[code.toUpperCase()];

    if (lobby) {
      // Check if player is already in lobby
      const isAlreadyIn = lobby.players.find(p => p.id === currentPlayer.id);

      if (!isAlreadyIn) {
        if (lobby.players.length >= lobby.settings.maxPlayers) {
          throw new Error('Lobby is full');
        }

        const updatedPlayer = { ...currentPlayer, isHost: false, isReady: false };
        lobby.players.push(updatedPlayer);
        saveLobbyToStore(lobby);
        setCurrentPlayer(updatedPlayer);
      }

      setCurrentLobby(lobby);
      return true;
    }

    return false;
  };

  const leaveLobby = () => {
    if (currentPlayer) {
      setCurrentPlayer({ ...currentPlayer, isHost: false, isReady: false });
    }
    setCurrentLobby(null);
  };

  const setPlayerReady = (ready: boolean) => {
    if (!currentPlayer || !currentLobby) return;

    const updatedPlayer = { ...currentPlayer, isReady: ready };
    setCurrentPlayer(updatedPlayer);

    const updatedPlayers = currentLobby.players.map(p =>
      p.id === currentPlayer.id ? updatedPlayer : p
    );
    const updatedLobby = { ...currentLobby, players: updatedPlayers };
    setCurrentLobby(updatedLobby);
    saveLobbyToStore(updatedLobby);
  };

  const updateCurrentPlayer = (player: Player | null) => {
    setCurrentPlayer(player);
    if (player) {
      localStorage.setItem('playq-player', JSON.stringify(player));
    } else {
      localStorage.removeItem('playq-player');
    }
  };

  return (
    <GameContext.Provider
      value={{
        currentPlayer,
        currentLobby,
        setCurrentPlayer: updateCurrentPlayer,
        createLobby,
        joinLobby,
        leaveLobby,
        setPlayerReady,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};
