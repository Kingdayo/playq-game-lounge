import { describe, it, expect } from 'vitest';
import { createDeck, shuffle, isPlayable, initializeGame } from '../lib/uno';

describe('UNO Logic', () => {
  it('creates a deck of 108 cards', () => {
    const deck = createDeck();
    expect(deck.length).toBe(108);
  });

  it('shuffles the deck', () => {
    const deck = createDeck();
    const shuffled = shuffle(deck);
    expect(shuffled).not.toEqual(deck);
    expect(shuffled.length).toBe(108);
  });

  it('identifies playable cards', () => {
    const topCard = { id: '1', color: 'red', value: '5' } as any;

    // Match by color
    expect(isPlayable({ id: '2', color: 'red', value: '2' } as any, topCard, null)).toBe(true);
    // Match by value
    expect(isPlayable({ id: '3', color: 'blue', value: '5' } as any, topCard, null)).toBe(true);
    // Wild card
    expect(isPlayable({ id: '4', color: 'wild', value: 'wild' } as any, topCard, null)).toBe(true);
    // No match
    expect(isPlayable({ id: '5', color: 'green', value: '7' } as any, topCard, null)).toBe(false);
  });

  it('initializes a game correctly', () => {
    const players = [
      { id: '1', name: 'Player 1', avatar: 'A' },
      { id: '2', name: 'Player 2', avatar: 'B' }
    ];
    const gameState = initializeGame('test-lobby', players);

    expect(gameState.players.length).toBe(2);
    // Might be 7 or 9 if initial discard is Draw 2
    expect([7, 9]).toContain(gameState.players[0].hand.length);
    expect(gameState.discardPile.length).toBe(1);
    expect(gameState.status).toBe('playing');
  });
});
