import { describe, it, expect } from 'vitest';
import { initializeGame, checkGuess, getNextDrawerIndex } from '../lib/pictionary';

describe('Pictionary Game Logic', () => {
  const players = [
    { id: '1', name: 'Player 1', avatar: 'avatar1' },
    { id: '2', name: 'Player 2', avatar: 'avatar2' },
    { id: '3', name: 'Player 3', avatar: 'avatar3' }
  ];

  it('should initialize game correctly', () => {
    const gameState = initializeGame('LOBBY123', players);
    expect(gameState.lobbyCode).toBe('LOBBY123');
    expect(gameState.players).toHaveLength(3);
    expect(gameState.players[0].score).toBe(0);
    expect(gameState.currentDrawerIndex).toBe(0);
    expect(gameState.status).toBe('waiting');
    expect(gameState.totalRounds).toBe(6); // 3 players * 2 rounds
  });

  it('should check guess correctly', () => {
    expect(checkGuess('apple', 'Apple')).toBe(true);
    expect(checkGuess('  APPLE  ', 'apple')).toBe(true);
    expect(checkGuess('banana', 'apple')).toBe(false);
  });

  it('should get next drawer index correctly', () => {
    expect(getNextDrawerIndex(0, 3)).toBe(1);
    expect(getNextDrawerIndex(2, 3)).toBe(0);
  });
});
