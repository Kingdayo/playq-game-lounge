import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { DominoTile, DominoGameState, PlacedTile, initializeGame, canPlayTile, calculateHandScore, shuffle, createSet } from '../lib/dominoes';
import { useGame } from './GameContext';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface DominoesContextType {
  gameState: DominoGameState | null;
  playTile: (tileId: string, side: 'left' | 'right') => void;
  drawTile: () => void;
  passTurn: () => void;
  startGame: () => void;
  resetGame: () => void;
}

const DominoesContext = createContext<DominoesContextType | undefined>(undefined);

export const useDominoes = () => {
  const context = useContext(DominoesContext);
  if (!context) {
    throw new Error('useDominoes must be used within a DominoesProvider');
  }
  return context;
};

export const DominoesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentLobby, currentPlayer } = useGame();
  const [gameState, setGameState] = useState<DominoGameState | null>(null);
  const gameStateRef = useRef<DominoGameState | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const lobbyCode = currentLobby?.code;
  const storageKey = lobbyCode ? `playq-dominoes-game-${lobbyCode}` : null;

  // Sync state with others via Supabase Broadcast
  useEffect(() => {
    if (!lobbyCode || !currentPlayer) return;

    const channel = supabase.channel(`dominoes-game-${lobbyCode}`, {
      config: {
        broadcast: { self: false }
      }
    });

    channel
      .on('broadcast', { event: 'state_update' }, ({ payload }) => {
        setGameState(payload);
      })
      .on('broadcast', { event: 'request_state' }, () => {
        if (currentPlayer.isHost && gameStateRef.current) {
          channel.send({
            type: 'broadcast',
            event: 'state_update',
            payload: gameStateRef.current
          });
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          if (!currentPlayer.isHost && !gameStateRef.current) {
            channel.send({
              type: 'broadcast',
              event: 'request_state',
              payload: {}
            });
          }
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lobbyCode, currentPlayer]);

  // Load from localStorage
  useEffect(() => {
    if (storageKey) {
      const stored = localStorage.getItem(storageKey);
      if (stored && !gameState) {
        setGameState(JSON.parse(stored));
      }
    }
  }, [storageKey, gameState]);

  // Sync from Supabase house_rules
  useEffect(() => {
    const dbState = currentLobby?.settings.houseRules?.dominoesGameState as DominoGameState | undefined;
    if (dbState && !gameState) {
      setGameState(dbState);
    }
  }, [currentLobby?.settings.houseRules?.dominoesGameState, gameState]);

  const saveGameState = useCallback((newState: DominoGameState) => {
    setGameState(newState);
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(newState));
    }

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'state_update',
        payload: newState
      });
    }

    if (currentLobby?.id && currentPlayer) {
      supabase
        .from('lobbies')
        .update({
          house_rules: {
            ...(currentLobby.settings.houseRules || {}),
            dominoesGameState: newState
          }
        })
        .eq('id', currentLobby.id)
        .catch(err => console.error('Failed to persist Dominoes state:', err));
    }
  }, [storageKey, currentLobby, currentPlayer]);

  const startGame = useCallback(() => {
    if (!currentLobby || !currentPlayer?.isHost) return;

    const players = currentLobby.players.map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar
    }));

    const newState = initializeGame(currentLobby.code, players, {
        variant: (currentLobby.settings.houseRules?.variant as 'draw' | 'block') || 'draw',
        setSize: (currentLobby.settings.houseRules?.setSize as 6 | 9 | 12) || 6
    });
    saveGameState(newState);

    toast({
      title: "Dominoes Started!",
      description: "Match those tiles!",
    });
  }, [currentLobby, currentPlayer, saveGameState]);

  const playTile = useCallback((tileId: string, side: 'left' | 'right') => {
    if (!gameState || !currentPlayer) return;

    const playerIndex = gameState.players.findIndex(p => p.id === currentPlayer.id);
    if (playerIndex !== gameState.currentPlayerIndex) {
      toast({ title: "Not your turn!", variant: "destructive" });
      return;
    }

    const player = gameState.players[playerIndex];
    const tileIndex = player.hand.findIndex(t => t.id === tileId);
    if (tileIndex === -1) return;

    const tile = player.hand[tileIndex];
    const { leftEnd, rightEnd } = gameState.board;

    let newState = { ...gameState };
    newState.players = [...newState.players];
    newState.board = { ...newState.board, tiles: [...newState.board.tiles] };

    let placedTile: PlacedTile;

    if (leftEnd === null || rightEnd === null) {
      // First tile
      placedTile = {
        tile,
        sideAValue: tile.sideA,
        sideBValue: tile.sideB,
        connectionPoint: 'sideA', // arbitrary for first tile
        isDouble: tile.sideA === tile.sideB
      };
      newState.board.leftEnd = tile.sideA;
      newState.board.rightEnd = tile.sideB;
      newState.board.tiles.push(placedTile);
    } else {
      // Check if legal move on chosen side
      const targetEndValue = side === 'left' ? leftEnd : rightEnd;
      if (tile.sideA !== targetEndValue && tile.sideB !== targetEndValue) {
        toast({ title: "Invalid move!", description: "Tile doesn't match the end value.", variant: "destructive" });
        return;
      }

      const connectionPoint = tile.sideA === targetEndValue ? 'sideA' : 'sideB';
      const newValue = connectionPoint === 'sideA' ? tile.sideB : tile.sideA;

      placedTile = {
        tile,
        sideAValue: tile.sideA,
        sideBValue: tile.sideB,
        connectionPoint,
        isDouble: tile.sideA === tile.sideB
      };

      if (side === 'left') {
        newState.board.tiles.unshift(placedTile);
        newState.board.leftEnd = newValue;
      } else {
        newState.board.tiles.push(placedTile);
        newState.board.rightEnd = newValue;
      }
    }

    // Remove tile from hand
    newState.players[playerIndex].hand = player.hand.filter(t => t.id !== tileId);

    // Win condition: empty hand
    if (newState.players[playerIndex].hand.length === 0) {
      newState.status = 'finished';
      newState.winnerId = player.id;
      // Score calculation
      const totalOpponentPips = newState.players.reduce((sum, p) => sum + calculateHandScore(p.hand), 0);
      newState.players[playerIndex].score += totalOpponentPips;
      newState.lastActionMessage = `${player.name} dominoed! and scored ${totalOpponentPips} points!`;
    } else {
      newState.lastActionMessage = `${player.name} played a tile.`;
      // Next player
      newState.currentPlayerIndex = (newState.currentPlayerIndex + 1) % newState.players.length;
    }

    saveGameState(newState);
  }, [gameState, currentPlayer, saveGameState]);

  const drawTile = useCallback(() => {
    if (!gameState || !currentPlayer) return;

    const playerIndex = gameState.players.findIndex(p => p.id === currentPlayer.id);
    if (playerIndex !== gameState.currentPlayerIndex) {
      toast({ title: "Not your turn!", variant: "destructive" });
      return;
    }

    if (gameState.boneyard.length === 0) {
      toast({ title: "Boneyard is empty!", variant: "destructive" });
      return;
    }

    let newState = { ...gameState };
    newState.boneyard = [...newState.boneyard];
    newState.players = [...newState.players];

    const tile = newState.boneyard.shift();
    if (tile) {
      newState.players[playerIndex].hand.push(tile);
      newState.lastActionMessage = `${currentPlayer.name} drew a tile.`;

      // In Draw variant, player might be able to play immediately, but usually they draw until they can play or until boneyard is empty.
      // Let's check if the drawn tile is playable.
      const canPlay = canPlayTile(tile, newState.board.leftEnd, newState.board.rightEnd);

      // If they still can't play and boneyard is empty, they must pass.
      // If they can play, we keep the turn on them so they can play it.
      if (!canPlay && newState.boneyard.length === 0) {
          // Auto-pass if no moves possible and boneyard empty
          // But maybe wait for player to click pass?
      }
    }

    saveGameState(newState);
  }, [gameState, currentPlayer, saveGameState]);

  const passTurn = useCallback(() => {
    if (!gameState || !currentPlayer) return;

    const playerIndex = gameState.players.findIndex(p => p.id === currentPlayer.id);
    if (playerIndex !== gameState.currentPlayerIndex) {
      toast({ title: "Not your turn!", variant: "destructive" });
      return;
    }

    // Check if they really can't play and boneyard is empty (or Block variant)
    const hasLegalMoves = gameState.players[playerIndex].hand.some(t =>
        canPlayTile(t, gameState.board.leftEnd, gameState.board.rightEnd)
    );

    if (hasLegalMoves) {
        toast({ title: "You have legal moves!", variant: "destructive" });
        return;
    }

    if (gameState.settings.variant === 'draw' && gameState.boneyard.length > 0) {
        toast({ title: "You must draw from the boneyard!", variant: "destructive" });
        return;
    }

    let newState = { ...gameState };
    newState.lastActionMessage = `${currentPlayer.name} passed.`;
    newState.currentPlayerIndex = (newState.currentPlayerIndex + 1) % newState.players.length;

    // Check if game is blocked (everyone passed)
    // Simplified: if everyone passes consecutively, game ends.
    // We'd need to track consecutive passes in state.
    // For now, let's just move to next player.

    saveGameState(newState);
  }, [gameState, currentPlayer, saveGameState]);

  const resetGame = useCallback(async () => {
    setGameState(null);
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
    if (currentLobby?.id && currentPlayer?.isHost) {
      try {
        await supabase
          .from('lobbies')
          .update({
            house_rules: {
              ...(currentLobby.settings.houseRules || {}),
              dominoesGameState: null
            }
          })
          .eq('id', currentLobby.id);
      } catch (err) {
        console.error('Failed to reset game:', err);
      }
    }
  }, [storageKey, currentLobby, currentPlayer]);

  return (
    <DominoesContext.Provider value={{
      gameState,
      playTile,
      drawTile,
      passTurn,
      startGame,
      resetGame
    }}>
      {children}
    </DominoesContext.Provider>
  );
};
