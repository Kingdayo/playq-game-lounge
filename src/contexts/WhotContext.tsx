import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { WhotCard, WhotShape, WhotGameState, initializeGame, isPlayable, getNextPlayerIndex, shuffle, createDeck } from '../lib/whot';
import { useGame } from './GameContext';
import { useSound } from './SoundContext';
import { SoundName } from '@/types/game';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { sendPushToPlayers } from '@/hooks/usePushNotifications';

interface WhotContextType {
  gameState: WhotGameState | null;
  playCard: (cardId: string, selectedShape?: WhotShape) => void;
  drawCard: () => void;
  callLastCard: () => void;
  catchLastCard: (targetPlayerId: string) => void;
  selectWhotShape: (shape: WhotShape) => void;
  startGame: () => void;
  resetGame: () => void;
}

const WhotContext = createContext<WhotContextType | undefined>(undefined);

export const useWhot = () => {
  const context = useContext(WhotContext);
  if (!context) {
    throw new Error('useWhot must be used within a WhotProvider');
  }
  return context;
};

export const WhotProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentLobby, currentPlayer } = useGame();
  const { playSound, playBGM, stopBGM } = useSound();
  const [gameState, setGameState] = useState<WhotGameState | null>(null);
  const gameStateRef = useRef<WhotGameState | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastPersistenceRef = useRef<number>(0);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const lobbyCode = currentLobby?.code;
  const storageKey = lobbyCode ? `playq-whot-game-${lobbyCode}` : null;

  // Sync state with others via Supabase Broadcast
  useEffect(() => {
    if (!lobbyCode || !currentPlayer) return;

    const channel = supabase.channel(`whot-game-${lobbyCode}`, {
        config: {
            broadcast: { self: false }
        }
    });

    channel
        .on('broadcast', { event: 'state_update' }, ({ payload }) => {
            setGameState(payload);
        })
        .on('broadcast', { event: 'play_sound' }, ({ payload }: { payload: { soundName: SoundName } }) => {
            playSound(payload.soundName);
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

  const saveGameState = useCallback((newState: WhotGameState) => {
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

    const now = Date.now();
    if (currentLobby?.id && currentPlayer && (now - lastPersistenceRef.current > 3000 || newState.status === 'finished')) {
      lastPersistenceRef.current = now;
      const currentHouseRules = currentLobby.settings?.houseRules || {};
        supabase
            .from('lobbies')
            .update({
                house_rules: {
                  ...currentHouseRules,
                    whotGameState: newState
                } as any
            })
            .eq('id', currentLobby.id)
            .then(({ error }) => {
                if (error) console.error('Failed to persist WHOT state to Supabase:', error);
            });
    }
  }, [storageKey, channelRef, currentLobby, currentPlayer]);

  useEffect(() => {
    const dbState = currentLobby?.settings?.houseRules?.whotGameState as WhotGameState | undefined;
      if (dbState && !gameState) {
          setGameState(dbState);
      }
}, [currentLobby?.settings?.houseRules?.whotGameState, gameState]);

  useEffect(() => {
    if (gameState && gameState.status === 'playing') {
      playBGM('whot');
    } else if (!gameState || gameState.status === 'finished') {
      stopBGM();
    }
  }, [gameState?.status, playBGM, stopBGM]);

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
      description: "Match shapes or numbers!",
    });
  }, [currentLobby, currentPlayer, saveGameState, broadcastSound]);

  const playCard = useCallback((cardId: string, selectedShape?: WhotShape) => {
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

    if (!isPlayable(card, topCard, gameState.selectedShape)) {
      toast({ title: "Invalid move!", description: "Card doesn't match shape or number.", variant: "destructive" });
      return;
    }

    const newState = { ...gameState };
    newState.players = [...newState.players];
    const newHand = player.hand.filter(c => c.id !== cardId);
    newState.players[playerIndex] = { ...player, hand: newHand };

    // Reset calls
    newState.lastCardCalled = { ...newState.lastCardCalled, [player.id]: false };
    newState.checkCalled = { ...newState.checkCalled, [player.id]: false };

    newState.discardPile = [...newState.discardPile, card];
    newState.selectedShape = null;
    newState.lastActionMessage = `${player.name} played ${card.shape} ${card.value}`;

    if (newHand.length === 0) {
      newState.status = 'finished';
      newState.winnerId = player.id;
      newState.lastActionMessage = `${player.name} wins!`;
      saveGameState(newState);
      broadcastSound('win');
      return;
    }

    // Handle special cards
    let skipNextCount = 0;
    let cardsToDraw = 0;
    let nextPlayerAffected = false;

    if (card.value === 1 || card.value === 8) {
      skipNextCount = 1;
      newState.lastActionMessage = `${player.name} played ${card.value}, next player skipped!`;
    } else if (card.value === 2) {
      cardsToDraw = 2;
      skipNextCount = 1;
      nextPlayerAffected = true;
      newState.lastActionMessage = `${player.name} played Pick Two!`;
    } else if (card.value === 5) {
      cardsToDraw = 3;
      skipNextCount = 1;
      nextPlayerAffected = true;
      newState.lastActionMessage = `${player.name} played Pick Three!`;
    } else if (card.value === 14) {
      newState.players.forEach((p, idx) => {
        if (idx !== playerIndex) {
          const drawn = newState.deck.splice(0, 1);
          p.hand.push(...drawn);
        }
      });
      newState.lastActionMessage = `General Market! Everyone else draws 1.`;
    }

    if (nextPlayerAffected) {
      const targetIndex = getNextPlayerIndex(playerIndex, newState.players.length, newState.direction);
      const drawn = newState.deck.splice(0, cardsToDraw);
      newState.players[targetIndex].hand.push(...drawn);
      newState.lastCardCalled[newState.players[targetIndex].id] = false;
    }

    let nextPlayerIndex = playerIndex;
    for (let i = 0; i <= skipNextCount; i++) {
        nextPlayerIndex = getNextPlayerIndex(nextPlayerIndex, newState.players.length, newState.direction);
    }

    newState.currentPlayerIndex = nextPlayerIndex;
    broadcastSound('card');

    if (card.value === 20) {
      if (selectedShape) {
        newState.selectedShape = selectedShape;
        newState.lastActionMessage = `${player.name} played WHOT and chose ${selectedShape}`;
        newState.turnActionTaken = false;
      } else {
        newState.currentPlayerIndex = playerIndex;
        newState.turnActionTaken = true;
      }
    }

    // Check for deck replenishment
    if (newState.deck.length < 5) {
        const top = newState.discardPile.pop()!;
        newState.deck = shuffle([...newState.deck, ...newState.discardPile]);
        newState.discardPile = [top];
    }

    saveGameState(newState);

    if (newState.currentPlayerIndex !== playerIndex && newState.status === 'playing') {
      const nextPlayer = newState.players[newState.currentPlayerIndex];
      if (nextPlayer.id !== currentPlayer.id) {
        sendPushToPlayers([nextPlayer.id], {
          title: '🃏 Your Turn!',
          body: `It's your turn in Whot! ${currentPlayer.name} played a card.`,
          tag: 'whot-turn',
          data: { type: 'turn', gameType: 'whot', lobbyCode }
        });
      }
    }
  }, [gameState, currentPlayer, saveGameState, broadcastSound, lobbyCode]);

  const selectWhotShape = useCallback((shape: WhotShape) => {
    if (!gameState || !currentPlayer) return;

    const playerIndex = gameState.players.findIndex(p => p.id === currentPlayer.id);
    if (playerIndex !== gameState.currentPlayerIndex) return;

    const newState = { ...gameState };
    newState.selectedShape = shape;

    if (newState.turnActionTaken) {
        newState.currentPlayerIndex = getNextPlayerIndex(playerIndex, newState.players.length, newState.direction);
        newState.turnActionTaken = false;
    }

    newState.lastActionMessage = `${currentPlayer.name} chose ${shape}`;
    saveGameState(newState);
    broadcastSound('move');

    if (newState.currentPlayerIndex !== playerIndex) {
        const nextPlayer = newState.players[newState.currentPlayerIndex];
        sendPushToPlayers([nextPlayer.id], {
            title: '🃏 Your Turn!',
            body: `Whot shape: ${shape}! It's your turn.`,
            tag: 'whot-turn',
            data: { type: 'turn', gameType: 'whot', lobbyCode }
        });
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
      newState.lastCardCalled[currentPlayer.id] = false;
      newState.checkCalled[currentPlayer.id] = false;
      newState.lastActionMessage = `${currentPlayer.name} drew a card`;
      newState.currentPlayerIndex = getNextPlayerIndex(playerIndex, newState.players.length, newState.direction);
    }

    saveGameState(newState);
    broadcastSound('card');
  }, [gameState, currentPlayer, saveGameState, broadcastSound]);

  const callLastCard = useCallback(() => {
    if (!gameState || !currentPlayer) return;
    const player = gameState.players.find(p => p.id === currentPlayer.id);
    if (!player) return;

    const newState = { ...gameState };
    if (player.hand.length === 1) {
        newState.lastCardCalled[currentPlayer.id] = true;
        newState.lastActionMessage = `${currentPlayer.name} called LAST CARD!`;
    } else if (player.hand.length === 2) {
        newState.checkCalled[currentPlayer.id] = true;
        newState.lastActionMessage = `${currentPlayer.name} called CHECK!`;
    }

    saveGameState(newState);
    broadcastSound('success');
    toast({ title: "Called!", description: `You called ${player.hand.length === 1 ? 'Last Card' : 'Check'}` });
  }, [gameState, currentPlayer, saveGameState, broadcastSound]);

  const catchLastCard = useCallback((targetPlayerId: string) => {
    if (!gameState || !currentPlayer) return;

    const targetIndex = gameState.players.findIndex(p => p.id === targetPlayerId);
    if (targetIndex === -1) return;

    const target = gameState.players[targetIndex];
    if (target.hand.length === 1 && !gameState.lastCardCalled[targetPlayerId]) {
      const newState = { ...gameState };
      const drawnCards = newState.deck.splice(0, 2);
      newState.players[targetIndex].hand.push(...drawnCards);
      newState.lastActionMessage = `${currentPlayer.name} caught ${target.name}! Penalty: 2 cards.`;
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
                    whotGameState: null
                }
            })
            .eq('id', currentLobby.id)
            .then(() => {
                window.location.reload();
            });
    }
  }, [storageKey, currentLobby, currentPlayer]);

  return (
    <WhotContext.Provider value={{
      gameState,
      playCard,
      drawCard,
      callLastCard,
      catchLastCard,
      selectWhotShape,
      startGame,
      resetGame
    }}>
      {children}
    </WhotContext.Provider>
  );
};
