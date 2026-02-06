import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLobbySync } from '@/hooks/useLobbySync';
import { Player, GameSettings, Lobby } from '@/types/game';

interface GameContextType {
  currentPlayer: Player | null;
  currentLobby: Lobby | null;
  setCurrentPlayer: (player: Player | null) => void;
  createLobby: (gameType: Lobby['gameType']) => Promise<Lobby>;
  joinLobby: (code: string) => Promise<boolean>;
  leaveLobby: () => Promise<void>;
  setPlayerReady: (ready: boolean) => Promise<void>;
  updateLobbySettings: (settings: Partial<GameSettings>) => Promise<void>;
  startGame: () => Promise<void>;
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

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

const avatars = [
  '🎮', '🎯', '🎲', '🃏', '🎨', '🏆', '⭐', '🔥', '💎', '🌟',
  '🦊', '🐺', '🦁', '🐯', '🐻', '🐼', '🐨', '🐸', '🐙', '🦄',
];

interface GameProviderProps {
  children: ReactNode;
}

export const GameProvider: React.FC<GameProviderProps> = ({ children }) => {
  const [currentPlayer, setCurrentPlayerState] = useState<Player | null>(() => {
    const stored = localStorage.getItem('playq-player');
    if (stored) return JSON.parse(stored);
    const player: Player = {
      id: generateId(),
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
  const [activeLobbyCode, setActiveLobbyCode] = useState<string | null>(null);

  // Realtime lobby sync
  const handleLobbyUpdate = useCallback((lobby: Lobby | null) => {
    if (lobby) {
      setCurrentLobby(lobby);
    } else if (activeLobbyCode) {
      // Fallback rehydration from localStorage if Supabase is unavailable
      try {
        const stored = localStorage.getItem('playq-lobbies');
        if (stored) {
          const lobbies = JSON.parse(stored);
          if (lobbies[activeLobbyCode]) {
            setCurrentLobby(lobbies[activeLobbyCode]);
            return;
          }
        }
      } catch (e) {
        console.error('Failed to load lobby from localStorage fallback:', e);
      }
      setCurrentLobby(null);
    } else {
      setCurrentLobby(null);
    }
  }, [activeLobbyCode]);

  useLobbySync({ lobbyCode: activeLobbyCode, onLobbyUpdate: handleLobbyUpdate });

  // Rehydrate lobby from URL on mount
  React.useEffect(() => {
    const rehydrate = () => {
        const path = window.location.pathname;
        const match = path.match(/\/(lobby|game\/uno|game\/ludo|game\/dominoes|game\/pictionary)\/([a-zA-Z0-9]+)/);
        if (match) {
            const code = match[2].toUpperCase();
            if (code !== activeLobbyCode) {
                setActiveLobbyCode(code);
            }
        }
    };

    rehydrate();
    window.addEventListener('popstate', rehydrate);
    return () => window.removeEventListener('popstate', rehydrate);
  }, [activeLobbyCode]);

  const updateCurrentPlayer = useCallback((player: Player | null) => {
    setCurrentPlayerState(player);
    if (player) {
      localStorage.setItem('playq-player', JSON.stringify(player));
    } else {
      localStorage.removeItem('playq-player');
    }
  }, []);

  const createLobby = useCallback(async (gameType: Lobby['gameType']): Promise<Lobby> => {
    if (!currentPlayer) throw new Error('No player set');

    const maxPlayersMap: Record<string, number> = {
      uno: 10,
      ludo: 4,
      pictionary: 8,
      dominoes: 4,
    };

    const code = generateCode();

    // Insert the lobby row
    const { data: lobbyRow, error: lobbyErr } = await supabase
      .from('lobbies')
      .insert({
        code,
        game_type: gameType,
        status: 'waiting',
        max_players: maxPlayersMap[gameType] || 4,
        time_limit: gameType === 'pictionary' ? 60 : null,
        house_rules: {},
      })
      .select()
      .single();

    if (lobbyErr || !lobbyRow) {
      console.error('Error creating lobby:', lobbyErr);
      throw new Error('Failed to create lobby');
    }

    // Insert the host player
    const hostPlayer: Player = { ...currentPlayer, isHost: true, isReady: true };
    const { error: playerErr } = await supabase
      .from('lobby_players')
      .insert({
        lobby_id: lobbyRow.id,
        player_id: hostPlayer.id,
        name: hostPlayer.name,
        avatar: hostPlayer.avatar,
        is_host: true,
        is_ready: true,
        is_online: true,
      });

    if (playerErr) {
      console.error('Error adding host player:', playerErr);
      throw new Error('Failed to add host to lobby');
    }

    updateCurrentPlayer(hostPlayer);
    setActiveLobbyCode(code);

    // Return a constructed Lobby object immediately
    const lobby: Lobby = {
      id: lobbyRow.id,
      code,
      gameType,
      host: hostPlayer,
      players: [hostPlayer],
      settings: {
        maxPlayers: maxPlayersMap[gameType] || 4,
        timeLimit: gameType === 'pictionary' ? 60 : undefined,
        houseRules: {},
      },
      status: 'waiting',
      createdAt: new Date(lobbyRow.created_at),
    };
    setCurrentLobby(lobby);
    return lobby;
  }, [currentPlayer, updateCurrentPlayer]);

  const joinLobby = useCallback(async (code: string): Promise<boolean> => {
    if (!currentPlayer) throw new Error('No player set');

    const normalizedCode = code.replace(/\s/g, '').toUpperCase();

    // Fetch the lobby from the database
    const { data: lobbyRow, error: lobbyErr } = await supabase
      .from('lobbies')
      .select('*')
      .eq('code', normalizedCode)
      .maybeSingle();

    if (lobbyErr || !lobbyRow) return false;

    if (lobbyRow.status !== 'waiting') {
      throw new Error('This game has already started');
    }

    // Check existing players
    const { data: existingPlayers, error: playersErr } = await supabase
      .from('lobby_players')
      .select('*')
      .eq('lobby_id', lobbyRow.id);

    if (playersErr) throw new Error('Failed to check lobby');

    const alreadyIn = (existingPlayers || []).find(
      (p) => p.player_id === currentPlayer.id
    );

    if (!alreadyIn) {
      if ((existingPlayers || []).length >= lobbyRow.max_players) {
        throw new Error('Lobby is full');
      }

      const joiningPlayer: Player = { ...currentPlayer, isHost: false, isReady: false };
      const { error: insertErr } = await supabase
        .from('lobby_players')
        .insert({
          lobby_id: lobbyRow.id,
          player_id: joiningPlayer.id,
          name: joiningPlayer.name,
          avatar: joiningPlayer.avatar,
          is_host: false,
          is_ready: false,
          is_online: true,
        });

      if (insertErr) {
        console.error('Error joining lobby:', insertErr);
        throw new Error('Failed to join lobby');
      }

      updateCurrentPlayer(joiningPlayer);
    }

    setActiveLobbyCode(normalizedCode);
    return true;
  }, [currentPlayer, updateCurrentPlayer]);

  const leaveLobby = useCallback(async () => {
    if (!currentPlayer || !currentLobby) {
      setCurrentLobby(null);
      setActiveLobbyCode(null);
      return;
    }

    // Remove the player from the lobby
    await supabase
      .from('lobby_players')
      .delete()
      .eq('lobby_id', currentLobby.id)
      .eq('player_id', currentPlayer.id);

    // Check remaining players
    const { data: remaining } = await supabase
      .from('lobby_players')
      .select('*')
      .eq('lobby_id', currentLobby.id);

    if (!remaining || remaining.length === 0) {
      // Delete the empty lobby
      await supabase.from('lobbies').delete().eq('id', currentLobby.id);
    } else if (currentPlayer.isHost) {
      // Assign new host to the first remaining player
      const newHost = remaining[0];
      await supabase
        .from('lobby_players')
        .update({ is_host: true, is_ready: true })
        .eq('id', newHost.id);
    }

    updateCurrentPlayer({ ...currentPlayer, isHost: false, isReady: false });
    setCurrentLobby(null);
    setActiveLobbyCode(null);
  }, [currentPlayer, currentLobby, updateCurrentPlayer]);

  const setPlayerReady = useCallback(async (ready: boolean) => {
    if (!currentPlayer || !currentLobby) return;

    const { error } = await supabase
      .from('lobby_players')
      .update({ is_ready: ready })
      .eq('lobby_id', currentLobby.id)
      .eq('player_id', currentPlayer.id);

    if (error) {
      console.error('Error setting ready state:', error);
      return;
    }

    // Optimistic update
    const updatedPlayer = { ...currentPlayer, isReady: ready };
    updateCurrentPlayer(updatedPlayer);
  }, [currentPlayer, currentLobby, updateCurrentPlayer]);

  const updateLobbySettings = useCallback(async (settings: Partial<GameSettings>) => {
    if (!currentLobby) return;

    const updatedSettings = { ...currentLobby.settings, ...settings };

    const { error } = await supabase
      .from('lobbies')
      .update({
        max_players: updatedSettings.maxPlayers,
        time_limit: updatedSettings.timeLimit,
        house_rules: updatedSettings.houseRules,
      })
      .eq('id', currentLobby.id);

    if (error) {
      console.error('Error updating lobby settings:', error);
      throw error;
    }
  }, [currentLobby]);

  const startGame = useCallback(async () => {
    if (!currentLobby || !currentPlayer?.isHost) return;

    const { error } = await supabase
      .from('lobbies')
      .update({ status: 'in-progress' })
      .eq('id', currentLobby.id);

    if (error) {
      console.error('Error starting game:', error);
      throw new Error('Failed to start game');
    }
  }, [currentLobby, currentPlayer]);

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
        updateLobbySettings,
        startGame,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};
