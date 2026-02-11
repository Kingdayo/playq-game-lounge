import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { UnoCard, UnoColor, UnoGameState, initializeGame, isPlayable, getNextPlayerIndex, shuffle, createDeck } from '../lib/uno';
import { useGame } from './GameContext';
import { useSound } from './SoundContext';
import { SoundName } from '@/types/game';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { sendPushToPlayers } from '@/hooks/usePushNotifications';

interface UnoContextType {
  gameState: UnoGameState | null;
  playCard: (cardId: string, wildColor?: UnoColor) => void;
  drawCard: () => void;
  callUno: () => void;
  catchUno: (targetPlayerId: string) => void;
  selectWildColor: (color: UnoColor) => void;
  startGame: () => void;
  resetGame: () => void;
}

const UnoContext = createContext<UnoContextType | undefined>(undefined);

export const useUno = () => {
  const context = useContext(UnoContext);
  if (!context) {
    throw new Error('useUno must be used within an UnoProvider');
  }
  return context;
};

export const UnoProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentLobby, currentPlayer } = useGame();
  const { playSound, playBGM, stopBGM } = useSound();
  const [gameState, setGameState] = useState<UnoGameState | null>(null);
  const gameStateRef = useRef<UnoGameState | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastPersistenceRef = useRef<number>(0);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const lobbyCode = currentLobby?.code;
  const storageKey = lobbyCode ? `playq-uno-game-${lobbyCode}` : null;

  // Sync state with others via Supabase Broadcast
  useEffect(() => {
    if (!lobbyCode || !currentPlayer) return;

    const channel = supabase.channel(`uno-game-${lobbyCode}`, {
        config: {
            broadcast: { self: false }
        }
    });

    channel
        .on('broadcast', { event: 'state_update' }, ({ payload }) => {
            console.log('Received UNO state update:', payload);
            setGameState(payload);
        })
        .on('broadcast', { event: 'play_sound' }, ({ payload }: { payload: { soundName: SoundName } }) => {
            playSound(payload.soundName);
        })
        .on('broadcast', { event: 'request_state' }, () => {
            // If I am the host, I should respond with the current state
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
                // If I am not the host and don't have a state, request it
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
  }, [lobbyCode, currentPlayer, playSound]);

  // Load game state from localStorage (Initial cache)
  useEffect(() => {
    if (storageKey) {
      const stored = localStorage.getItem(storageKey);
      if (stored && !gameState) {
        setGameState(JSON.parse(stored));
      }
    }
  }, [storageKey, gameState]);

  const broadcastSound = useCallback((soundName: SoundName) => {
    if (channelRef.current) {
        channelRef.current.send({
            type: 'broadcast',
            event: 'play_sound',
            payload: { soundName }
        });
    }
    playSound(soundName);
  }, [playSound]);

  const saveGameState = useCallback((newState: UnoGameState) => {
    setGameState(newState);
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(newState));
    }

    // Broadcast new state to all players
    if (channelRef.current) {
        channelRef.current.send({
            type: 'broadcast',
            event: 'state_update',
            payload: newState
        });
    }

    // Also persist to Supabase house_rules for reliable multi-device sync/refreshes
    // Throttle DB updates to once every 3 seconds unless the game is finished
    const now = Date.now();
    if (currentLobby?.id && currentPlayer && (now - lastPersistenceRef.current > 3000 || newState.status === 'finished')) {
      lastPersistenceRef.current = now;
      const currentHouseRules = currentLobby.settings?.houseRules || {};
        supabase
            .from('lobbies')
            .update({
                house_rules: {
                  ...currentHouseRules,
                    unoGameState: newState
                } as any
            })
            .eq('id', currentLobby.id)
            .then(({ error }) => {
                if (error) console.error('Failed to persist UNO state to Supabase:', error);
            });
    }
  }, [storageKey, channelRef, currentLobby, currentPlayer]);

  // Sync state from Supabase on mount or lobby update (initial load/refresh)
  useEffect(() => {
    const dbState = currentLobby?.settings?.houseRules?.unoGameState as UnoGameState | undefined;
      if (dbState && !gameState) {
          setGameState(dbState);
      }
}, [currentLobby?.settings?.houseRules?.unoGameState, gameState]);

  useEffect(() => {
    if (gameState && gameState.status === 'playing') {
      playBGM('uno');
    } else if (!gameState || gameState.status === 'finished') {
      stopBGM();
    }
  }, [gameState?.status, playBGM, stopBGM, gameState]);

  const startGame = useCallback(() => {
    if (!currentLobby || !currentPlayer?.isHost) return;

    const players = currentLobby.players.map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar
    }));

    const newState = initializeGame(currentLobby.code, players);
    saveGameState(newState);
    broadcastSound('move');

    toast({
      title: "Game Started!",
      description: "Good luck everyone!",
    });
  }, [currentLobby, currentPlayer, saveGameState, broadcastSound]);

  const playCard = useCallback((cardId: string, wildColor?: UnoColor) => {
    if (!gameState || !currentPlayer) return;

    const playerIndex = gameState.players.findIndex(p => p.id === currentPlayer.id);
    if (playerIndex !== gameState.currentPlayerIndex) {
      toast({ title: "Not your turn!", variant: "destructive" });
      return;
    }

    const player = gameState.players[playerIndex];
    const cardIndex = player.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;

    const card = player.hand[cardIndex];
    const topCard = gameState.discardPile[gameState.discardPile.length - 1];

    if (!isPlayable(card, topCard, gameState.selectedColor)) {
      toast({ title: "Invalid move!", description: "Card doesn't match color or value.", variant: "destructive" });
      return;
    }

    // Apply card effects
    const newState = { ...gameState };
    newState.players = [...newState.players];
    const newHand = player.hand.filter(c => c.id !== cardId);
    newState.players[playerIndex] = {
      ...player,
      hand: newHand
    };

    // Reset UNO call if they no longer have exactly 1 card (or if they just played their last card)
    if (newHand.length !== 1) {
      newState.unoCalled = { ...newState.unoCalled, [player.id]: false };
    }

    newState.discardPile = [...newState.discardPile, card];
    newState.selectedColor = null;
    newState.lastActionMessage = `${player.name} played ${card.color} ${card.value}`;

    // Win condition
    if (newState.players[playerIndex].hand.length === 0) {
      newState.status = 'finished';
      newState.winnerId = player.id;
      newState.lastActionMessage = `${player.name} wins!`;
      saveGameState(newState);
      broadcastSound('win');
      return;
    }

    // Handle action cards
    let skipNext = false;
    if (card.value === 'skip') {
      skipNext = true;
    } else if (card.value === 'reverse') {
      if (newState.players.length === 2) {
        skipNext = true;
      } else {
        newState.direction *= -1;
      }
    } else if (card.value === 'draw2') {
      const nextIndex = getNextPlayerIndex(playerIndex, newState.players.length, newState.direction);
      const drawnCards = newState.deck.splice(0, 2);
      // If deck is low, reshuffle
      if (newState.deck.length < 5) {
          const topDiscard = newState.discardPile.pop()!;
          newState.deck = shuffle([...newState.deck, ...newState.discardPile]);
          newState.discardPile = [topDiscard];
      }
      newState.players[nextIndex].hand.push(...drawnCards);
      skipNext = true;
      newState.lastActionMessage = `${newState.players[nextIndex].name} drew 2 and was skipped!`;
    } else if (card.value === 'draw4') {
      const nextIndex = getNextPlayerIndex(playerIndex, newState.players.length, newState.direction);
      const drawnCards = newState.deck.splice(0, 4);
      if (newState.deck.length < 5) {
          const topDiscard = newState.discardPile.pop()!;
          newState.deck = shuffle([...newState.deck, ...newState.discardPile]);
          newState.discardPile = [topDiscard];
      }
      newState.players[nextIndex].hand.push(...drawnCards);
      skipNext = true;
      newState.lastActionMessage = `${newState.players[nextIndex].name} drew 4 and was skipped!`;
    }

    // Move to next player
    let nextPlayerIndex = getNextPlayerIndex(playerIndex, newState.players.length, newState.direction);
    if (skipNext) {
      nextPlayerIndex = getNextPlayerIndex(nextPlayerIndex, newState.players.length, newState.direction);
    }

    newState.currentPlayerIndex = nextPlayerIndex;
    broadcastSound('card');

    // Wild cards need color selection
    if (card.color === 'wild') {
      if (wildColor) {
        newState.selectedColor = wildColor;
        newState.lastActionMessage = `${player.name} played ${card.value} and chose ${wildColor}`;
        newState.turnActionTaken = false;
        // Keep the nextPlayerIndex we already calculated
      } else {
        newState.status = 'playing'; // Still playing, but UI should show color picker
        newState.currentPlayerIndex = playerIndex; // Stay on current player
        newState.turnActionTaken = true; // But they've played
      }
    }

    saveGameState(newState);

    // Notify next player via push if turn changed
    if (newState.currentPlayerIndex !== playerIndex && newState.status === 'playing') {
      const nextPlayer = newState.players[newState.currentPlayerIndex];
      if (nextPlayer.id !== currentPlayer.id) {
        sendPushToPlayers([nextPlayer.id], {
          title: '🃏 Your Turn!',
          body: `It's your turn in Uno! ${currentPlayer.name} played a card.`,
          tag: 'uno-turn',
          data: { type: 'turn', gameType: 'uno', lobbyCode }
        });
      }
    }
  }, [gameState, currentPlayer, saveGameState, broadcastSound, lobbyCode]);

  const selectWildColor = useCallback((color: UnoColor) => {
    if (!gameState || !currentPlayer) return;

    const playerIndex = gameState.players.findIndex(p => p.id === currentPlayer.id);
    if (playerIndex !== gameState.currentPlayerIndex) return;

    const newState = { ...gameState };
    newState.selectedColor = color;

    // Only move to next player if the current player has already taken their action (e.g. played a wild card)
    // If it's the start of the game and the first card is wild, they choose color THEN play their turn.
    if (newState.turnActionTaken) {
        const topCard = newState.discardPile[newState.discardPile.length - 1];
        let skipNext = false;
        if (topCard.value === 'draw4') skipNext = true;

        let nextPlayerIndex = getNextPlayerIndex(playerIndex, newState.players.length, newState.direction);
        if (skipNext) {
          nextPlayerIndex = getNextPlayerIndex(nextPlayerIndex, newState.players.length, newState.direction);
        }

        newState.currentPlayerIndex = nextPlayerIndex;
        newState.turnActionTaken = false;
    }

    newState.lastActionMessage = `${currentPlayer.name} chose ${color}`;

    saveGameState(newState);
    broadcastSound('move');

    // Notify next player via push if turn changed
    if (newState.currentPlayerIndex !== playerIndex && newState.status === 'playing') {
      const nextPlayer = newState.players[newState.currentPlayerIndex];
      if (nextPlayer.id !== currentPlayer.id) {
        sendPushToPlayers([nextPlayer.id], {
          title: '🃏 Your Turn!',
          body: `It's your turn in Uno! ${currentPlayer.name} chose ${color}.`,
          tag: 'uno-turn',
          data: { type: 'turn', gameType: 'uno', lobbyCode }
        });
      }
    }
  }, [gameState, currentPlayer, saveGameState, broadcastSound, lobbyCode]);

  const drawCard = useCallback(() => {
    if (!gameState || !currentPlayer) return;

    const playerIndex = gameState.players.findIndex(p => p.id === currentPlayer.id);
    if (playerIndex !== gameState.currentPlayerIndex) {
      toast({ title: "Not your turn!", variant: "destructive" });
      return;
    }

    const newState = { ...gameState };
    if (newState.deck.length === 0) {
      const topDiscard = newState.discardPile.pop()!;
      newState.deck = shuffle([...newState.discardPile]);
      newState.discardPile = [topDiscard];
    }

    const card = newState.deck.shift();
    if (card) {
      newState.players[playerIndex].hand.push(card);
      // Reset UNO call since they now have more than 1 card
      newState.unoCalled = { ...newState.unoCalled, [currentPlayer.id]: false };
      newState.lastActionMessage = `${currentPlayer.name} drew a card`;

      newState.currentPlayerIndex = getNextPlayerIndex(playerIndex, newState.players.length, newState.direction);
    }

    saveGameState(newState);
    broadcastSound('card');

    // Notify next player via push if turn changed
    if (newState.currentPlayerIndex !== playerIndex && newState.status === 'playing') {
      const nextPlayer = newState.players[newState.currentPlayerIndex];
      if (nextPlayer.id !== currentPlayer.id) {
        sendPushToPlayers([nextPlayer.id], {
          title: '🃏 Your Turn!',
          body: `It's your turn in Uno! ${currentPlayer.name} drew a card.`,
          tag: 'uno-turn',
          data: { type: 'turn', gameType: 'uno', lobbyCode }
        });
      }
    }
  }, [gameState, currentPlayer, saveGameState, broadcastSound, lobbyCode]);

  const callUno = useCallback(() => {
    if (!gameState || !currentPlayer) return;

    const newState = { ...gameState };
    newState.unoCalled = { ...newState.unoCalled, [currentPlayer.id]: true };
    newState.lastActionMessage = `${currentPlayer.name} called UNO!`;
    saveGameState(newState);
    broadcastSound('success');

    toast({ title: "UNO!", description: `${currentPlayer.name} called UNO!` });
  }, [gameState, currentPlayer, saveGameState, broadcastSound]);

  const catchUno = useCallback((targetPlayerId: string) => {
    if (!gameState || !currentPlayer) return;

    const targetIndex = gameState.players.findIndex(p => p.id === targetPlayerId);
    if (targetIndex === -1) return;

    const target = gameState.players[targetIndex];
    if (target.hand.length === 1 && !gameState.unoCalled[targetPlayerId]) {
      const newState = { ...gameState };
      const drawnCards = newState.deck.splice(0, 2);
      newState.players[targetIndex].hand.push(...drawnCards);
      newState.lastActionMessage = `${currentPlayer.name} caught ${target.name} not saying UNO!`;
      saveGameState(newState);
      broadcastSound('error');
      toast({ title: "Caught!", description: `${target.name} drew 2 cards.` });
    }
  }, [gameState, currentPlayer, saveGameState, broadcastSound]);

  const resetGame = useCallback(() => {
    if (storageKey) {
      localStorage.removeItem(storageKey);
      setGameState(null);
    }
    if (currentLobby?.id && currentPlayer) {
        const currentHouseRules = currentLobby.settings?.houseRules || {};
        supabase
            .from('lobbies')
            .update({
                house_rules: {
                    ...currentHouseRules,
                    unoGameState: null
                }
            })
            .eq('id', currentLobby.id)
            .then(() => {
                window.location.reload();
            });
    }
  }, [storageKey, currentLobby, currentPlayer]);

  return (
    <UnoContext.Provider value={{
      gameState,
      playCard,
      drawCard,
      callUno,
      selectWildColor,
      startGame,
      catchUno,
      resetGame
    }}>
      {children}
    </UnoContext.Provider>
  );
};
