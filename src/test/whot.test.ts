import { describe, it, expect } from 'vitest';
import { createDeck, isPlayable, initializeGame } from '../lib/whot';

describe('Whot Game Logic', () => {
  it('should create a deck with 54 cards', () => {
    const deck = createDeck();
    expect(deck.length).toBe(54);
  });

  it('should have 5 whot cards', () => {
    const deck = createDeck();
    const whotCards = deck.filter(c => c.shape === 'whot');
    expect(whotCards.length).toBe(5);
  });

  it('should correctly identify playable cards', () => {
    const topCard = { id: '1', shape: 'circle' as const, value: 5 };

    // Match by shape
    expect(isPlayable({ id: '2', shape: 'circle', value: 7 }, topCard, null)).toBe(true);

    // Match by value
    expect(isPlayable({ id: '3', shape: 'triangle', value: 5 }, topCard, null)).toBe(true);

    // Whot card is always playable
    expect(isPlayable({ id: '4', shape: 'whot', value: 20 }, topCard, null)).toBe(true);

    // No match
    expect(isPlayable({ id: '5', shape: 'triangle', value: 7 }, topCard, null)).toBe(false);
  });

  it('should respect selected shape for whot cards', () => {
    const topCard = { id: '1', shape: 'whot' as const, value: 20 };

    expect(isPlayable({ id: '2', shape: 'triangle', value: 7 }, topCard, 'triangle')).toBe(true);
    expect(isPlayable({ id: '3', shape: 'circle', value: 7 }, topCard, 'triangle')).toBe(false);
  });

  it('should initialize game with 5 cards per player', () => {
    const players = [
        { id: 'p1', name: 'Player 1', avatar: 'A' },
        { id: 'p2', name: 'Player 2', avatar: 'B' }
    ];
    const gameState = initializeGame('test', players);

    expect(gameState.players[0].hand.length).toBe(5);
    expect(gameState.players[1].hand.length).toBe(5);
    expect(gameState.deck.length).toBe(54 - 10 - 1); // 54 - (5*2) - 1 top card
    expect(gameState.status).toBe('playing');
  });
});
