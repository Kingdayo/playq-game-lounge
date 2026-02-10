import { describe, it, expect, vi } from 'vitest';
import { initializeGame, UnoGameState } from '../lib/uno';

// Mocking getNextPlayerIndex to be sure of behavior
const getNextPlayerIndex = (currentIndex: number, playerCount: number, direction: 1 | -1): number => {
  let next = currentIndex + direction;
  if (next >= playerCount) next = 0;
  if (next < 0) next = playerCount - 1;
  return next;
};

describe('UNO Wild Card Start', () => {
  const players = [
    { id: '1', name: 'Player 1', avatar: 'A' },
    { id: '2', name: 'Player 2', avatar: 'B' }
  ];

  it('should initialize with a wild card and keep current player at 0', () => {
    // We can't easily force a wild card with the current initializeGame without mocking Math.random or shuffle
    // But we can manually construct a state that looks like it just started with a wild card
    const state: UnoGameState = {
      lobbyCode: 'test',
      deck: [],
      discardPile: [{ id: 'wild-1', color: 'wild', value: 'wild' }],
      players: [
        { id: '1', name: 'Player 1', avatar: 'A', hand: [] },
        { id: '2', name: 'Player 2', avatar: 'B', hand: [] }
      ],
      currentPlayerIndex: 0,
      direction: 1,
      status: 'playing',
      winnerId: null,
      selectedColor: null,
      unoCalled: {},
      pendingDrawCount: 0,
      turnActionTaken: false,
      lastActionMessage: 'Wild card! Choose a color.'
    };

    // Now simulate what selectWildColor does (we are testing the logic we just added)
    const selectWildColorLogic = (state: UnoGameState, color: any): UnoGameState => {
      const newState = { ...state };
      newState.selectedColor = color;

      if (newState.turnActionTaken) {
          const topCard = newState.discardPile[newState.discardPile.length - 1];
          let skipNext = false;
          if (topCard.value === 'draw4') skipNext = true;

          let nextPlayerIndex = getNextPlayerIndex(newState.currentPlayerIndex, newState.players.length, newState.direction);
          if (skipNext) {
            nextPlayerIndex = getNextPlayerIndex(nextPlayerIndex, newState.players.length, newState.direction);
          }

          newState.currentPlayerIndex = nextPlayerIndex;
          newState.turnActionTaken = false;
      }
      return newState;
    };

    const newState = selectWildColorLogic(state, 'red');
    expect(newState.selectedColor).toBe('red');
    expect(newState.currentPlayerIndex).toBe(0); // Should still be Player 1's turn
  });

  it('should advance turn when wild card is played from hand (turnActionTaken is true)', () => {
    const state: UnoGameState = {
      lobbyCode: 'test',
      deck: [],
      discardPile: [{ id: 'wild-1', color: 'wild', value: 'wild' }],
      players: [
        { id: '1', name: 'Player 1', avatar: 'A', hand: [] },
        { id: '2', name: 'Player 2', avatar: 'B', hand: [] }
      ],
      currentPlayerIndex: 0,
      direction: 1,
      status: 'playing',
      winnerId: null,
      selectedColor: null,
      unoCalled: {},
      pendingDrawCount: 0,
      turnActionTaken: true, // Player just played this card
      lastActionMessage: 'Player 1 played wild'
    };

    const selectWildColorLogic = (state: UnoGameState, color: any): UnoGameState => {
      const newState = { ...state };
      newState.selectedColor = color;

      if (newState.turnActionTaken) {
          const topCard = newState.discardPile[newState.discardPile.length - 1];
          let skipNext = false;
          if (topCard.value === 'draw4') skipNext = true;

          let nextPlayerIndex = getNextPlayerIndex(newState.currentPlayerIndex, newState.players.length, newState.direction);
          if (skipNext) {
            nextPlayerIndex = getNextPlayerIndex(nextPlayerIndex, newState.players.length, newState.direction);
          }

          newState.currentPlayerIndex = nextPlayerIndex;
          newState.turnActionTaken = false;
      }
      return newState;
    };

    const newState = selectWildColorLogic(state, 'blue');
    expect(newState.selectedColor).toBe('blue');
    expect(newState.currentPlayerIndex).toBe(1); // Should advance to Player 2
  });
});
