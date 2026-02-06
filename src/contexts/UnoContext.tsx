import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { UnoCard, UnoColor, UnoGameState, initializeGame, isPlayable, getNextPlayerIndex, shuffle, createDeck } from '../lib/uno';
import { useGame } from './GameContext';
import { toast } from '@/components/ui/use-toast';

interface UnoContextType {
  gameState: UnoGameState | null;
  playCard: (cardId: string) => void;
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
  const [gameState, setGameState] = useState<UnoGameState | null>(null);

  const lobbyCode = currentLobby?.code;
  const storageKey = lobbyCode ? `playq-uno-game-${lobbyCode}` : null;

  // Load game state from localStorage
  useEffect(() => {
    if (storageKey) {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setGameState(JSON.parse(stored));
      }
    } else {
      setGameState(null);
    }
  }, [storageKey]);

  // Sync game state across tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        setGameState(JSON.parse(e.newValue));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [storageKey]);

  const saveGameState = useCallback((newState: UnoGameState) => {
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(newState));
      setGameState(newState);
    }
  }, [storageKey]);

  const startGame = useCallback(() => {
    if (!currentLobby || !currentPlayer?.isHost) return;

    const players = currentLobby.players.map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar
    }));

    const newState = initializeGame(currentLobby.code, players);
    saveGameState(newState);

    toast({
      title: "Game Started!",
      description: "Good luck everyone!",
    });
  }, [currentLobby, currentPlayer, saveGameState]);

  const playCard = useCallback((cardId: string) => {
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
    let newState = { ...gameState };
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

    // Wild cards need color selection
    if (card.color === 'wild') {
      newState.status = 'playing'; // Still playing, but UI should show color picker
      // We don't move turn until color is selected? Actually in UNO turn moves AFTER color is selected.
      // To simplify, let's keep the turn on current player until they select color, OR
      // let them select color as part of playing.
      // Let's make it so if a wild is played, newState.selectedColor is null and it's still current player's "sub-turn"
      // to pick a color.
      newState.currentPlayerIndex = playerIndex; // Stay on current player
      newState.turnActionTaken = true; // But they've played
    }

    saveGameState(newState);
  }, [gameState, currentPlayer, saveGameState]);

  const selectWildColor = useCallback((color: UnoColor) => {
    if (!gameState || !currentPlayer) return;

    const playerIndex = gameState.players.findIndex(p => p.id === currentPlayer.id);
    if (playerIndex !== gameState.currentPlayerIndex) return;

    let newState = { ...gameState };
    newState.selectedColor = color;

    // Now move to next player
    const topCard = newState.discardPile[newState.discardPile.length - 1];
    let skipNext = false;
    if (topCard.value === 'draw4') skipNext = true;

    let nextPlayerIndex = getNextPlayerIndex(playerIndex, newState.players.length, newState.direction);
    if (skipNext) {
      nextPlayerIndex = getNextPlayerIndex(nextPlayerIndex, newState.players.length, newState.direction);
    }

    newState.currentPlayerIndex = nextPlayerIndex;
    newState.turnActionTaken = false;
    newState.lastActionMessage = `${currentPlayer.name} chose ${color}`;

    saveGameState(newState);
  }, [gameState, currentPlayer, saveGameState]);

  const drawCard = useCallback(() => {
    if (!gameState || !currentPlayer) return;

    const playerIndex = gameState.players.findIndex(p => p.id === currentPlayer.id);
    if (playerIndex !== gameState.currentPlayerIndex) {
      toast({ title: "Not your turn!", variant: "destructive" });
      return;
    }

    let newState = { ...gameState };
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

      // After drawing, if the card is playable, standard UNO lets you play it immediately.
      // For simplicity, we'll just move to the next turn, or let the player choose.
      // Let's implement: they draw, and their turn ends unless they can play it.
      // To keep it simple: draw ends turn.
      newState.currentPlayerIndex = getNextPlayerIndex(playerIndex, newState.players.length, newState.direction);
    }

    saveGameState(newState);
  }, [gameState, currentPlayer, saveGameState]);

  const callUno = useCallback(() => {
    if (!gameState || !currentPlayer) return;

    let newState = { ...gameState };
    newState.unoCalled = { ...newState.unoCalled, [currentPlayer.id]: true };
    newState.lastActionMessage = `${currentPlayer.name} called UNO!`;
    saveGameState(newState);

    toast({ title: "UNO!", description: `${currentPlayer.name} called UNO!` });
  }, [gameState, currentPlayer, saveGameState]);

  const catchUno = useCallback((targetPlayerId: string) => {
    if (!gameState || !currentPlayer) return;

    const targetIndex = gameState.players.findIndex(p => p.id === targetPlayerId);
    if (targetIndex === -1) return;

    const target = gameState.players[targetIndex];
    if (target.hand.length === 1 && !gameState.unoCalled[targetPlayerId]) {
      let newState = { ...gameState };
      const drawnCards = newState.deck.splice(0, 2);
      newState.players[targetIndex].hand.push(...drawnCards);
      newState.lastActionMessage = `${currentPlayer.name} caught ${target.name} not saying UNO!`;
      saveGameState(newState);
      toast({ title: "Caught!", description: `${target.name} drew 2 cards.` });
    }
  }, [gameState, currentPlayer, saveGameState]);

  const resetGame = useCallback(() => {
    if (storageKey) {
      localStorage.removeItem(storageKey);
      setGameState(null);
    }
  }, [storageKey]);

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
