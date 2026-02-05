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

    setCurrentLobby(lobby);
    setCurrentPlayer(hostPlayer);
    return lobby;
  };

  const joinLobby = async (code: string): Promise<boolean> => {
    // Simulate finding a lobby (in real app, this would be a server call)
    // For now, we'll just simulate joining
    console.log('Attempting to join lobby:', code);
    
    // Simulate a delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // In a real app, this would check the server
    // For demo purposes, just return false (no lobby found)
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
    setCurrentLobby({ ...currentLobby, players: updatedPlayers });
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
