import { describe, it, expect } from 'vitest';
import { createSet, shuffle, initializeGame, getHighestDouble, canPlayTile } from '../lib/dominoes';

describe('Dominoes Logic', () => {
  it('creates a correct double-six set', () => {
    const set = createSet(6);
    expect(set.length).toBe(28); // (7 * 8) / 2 = 28
  });

  it('shuffles the set', () => {
    const set = createSet(6);
    const shuffled = shuffle(set);
    expect(shuffled.length).toBe(set.length);
    // There's a tiny chance they are identical, but shuffle should generally change it
    expect(shuffled).not.toEqual(set);
  });

  it('detects highest double correctly', () => {
    const hand = [
      { id: '1', sideA: 1, sideB: 2 },
      { id: '2', sideA: 5, sideB: 5 },
      { id: '3', sideA: 3, sideB: 3 },
    ];
    expect(getHighestDouble(hand)).toBe(5);
  });

  it('returns -1 if no double in hand', () => {
    const hand = [
      { id: '1', sideA: 1, sideB: 2 },
      { id: '2', sideA: 0, sideB: 5 },
    ];
    expect(getHighestDouble(hand)).toBe(-1);
  });

  it('initializes a 2-player game with 7 tiles each', () => {
    const players = [
      { id: 'p1', name: 'Player 1', avatar: 'A' },
      { id: 'p2', name: 'Player 2', avatar: 'B' },
    ];
    const state = initializeGame('test-lobby', players);
    expect(state.players[0].hand.length).toBe(7);
    expect(state.players[1].hand.length).toBe(7);
    expect(state.boneyard.length).toBe(28 - 14);
  });

  it('validates legal moves correctly', () => {
    const tile = { id: 't1', sideA: 3, sideB: 5 };
    // Empty board
    expect(canPlayTile(tile, null, null)).toBe(true);
    // Matching left end
    expect(canPlayTile(tile, 3, 1)).toBe(true);
    // Matching right end
    expect(canPlayTile(tile, 2, 5)).toBe(true);
    // No match
    expect(canPlayTile(tile, 1, 2)).toBe(false);
  });

  it('determines starting player based on highest double', () => {
    const players = [
      { id: 'p1', name: 'Player 1', avatar: 'A' },
      { id: 'p2', name: 'Player 2', avatar: 'B' },
    ];
    // We'll mock the shuffle or just check the logic by ensuring someone with a double starts
    const state = initializeGame('test-lobby', players);
    const p1Double = getHighestDouble(state.players[0].hand);
    const p2Double = getHighestDouble(state.players[1].hand);

    if (p1Double > p2Double) {
      expect(state.currentPlayerIndex).toBe(0);
    } else if (p2Double > p1Double) {
      expect(state.currentPlayerIndex).toBe(1);
    }
  });
});
