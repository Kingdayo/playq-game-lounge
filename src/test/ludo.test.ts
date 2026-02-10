import { describe, it, expect } from 'vitest';
import { initializeGame, getLegalMoves, moveToken, LudoGameState } from '../lib/ludo';

describe('Ludo Logic', () => {
  const players = [
    { id: '1', name: 'Player 1', avatar: '1' },
    { id: '2', name: 'Player 2', avatar: '2' }
  ];

  it('should initialize game correctly', () => {
    const state = initializeGame('test', players);
    expect(state.players.length).toBe(2);
    expect(state.players[0].color).toBe('red');
    expect(state.players[1].color).toBe('green');
    expect(state.players[0].tokens.length).toBe(4);
    expect(state.players[0].tokens[0].position).toBe(-1);
    expect(state.status).toBe('playing');
  });

  it('should only allow moving out of home on 6', () => {
    let state = initializeGame('test', players);
    state.diceValue = 5;
    let legalMoves = getLegalMoves(state);
    expect(legalMoves.length).toBe(0);

    state.diceValue = 6;
    legalMoves = getLegalMoves(state);
    expect(legalMoves.length).toBe(4);
  });

  it('should move token out of home on 6', () => {
    let state = initializeGame('test', players);
    state.diceValue = 6;
    const tokenId = state.players[0].tokens[0].id;
    state = moveToken(state, tokenId);

    expect(state.players[0].tokens[0].position).toBe(1); // Red start is 1
    expect(state.diceValue).toBeNull();
    expect(state.currentPlayerIndex).toBe(0); // Should still be Red's turn
  });

  it('should capture opponent token', () => {
    let state = initializeGame('test', players);

    // Move Red to position 5
    state.players[0].tokens[0].position = 5;

    // Move Green to position 14 (start) then to 5?
    // Wait, track is 52 squares.
    // Red start: 1
    // Green start: 14

    // Let's put Red at 16 (not safe)
    state.players[0].tokens[0].position = 16;

    // Green is at its start (14). Roll 2.
    state.players[1].tokens[0].position = 14;
    state.currentPlayerIndex = 1; // Green's turn
    state.diceValue = 2;
    const greenTokenId = state.players[1].tokens[0].id;

    state = moveToken(state, greenTokenId);

    expect(state.players[1].tokens[0].position).toBe(16);
    expect(state.players[0].tokens[0].position).toBe(-1); // Red captured
    expect(state.currentPlayerIndex).toBe(1); // Should still be Green's turn due to capture
  });

  it('should move into home column', () => {
    let state = initializeGame('test', players);

    // Red exit is now 51.
    state.players[0].tokens[0].position = 50; // One square before exit
    state.diceValue = 1;
    state = moveToken(state, state.players[0].tokens[0].id);
    expect(state.players[0].tokens[0].position).toBe(51);

    state.currentPlayerIndex = 0;
    state.diceValue = 1;
    state = moveToken(state, state.players[0].tokens[0].id);
    expect(state.players[0].tokens[0].position).toBe(52); // Home column index 0 (enters from 51)
  });

  it('should enter home column with remaining moves', () => {
    let state = initializeGame('test', players);

    // Red exit is 51.
    state.players[0].tokens[0].position = 51;
    state.diceValue = 3;
    state = moveToken(state, state.players[0].tokens[0].id);
    // 51 is exit, so 1st move enters home path (52), then 2 moves more -> 54
    expect(state.players[0].tokens[0].position).toBe(54);
  });

  it('should finish token on exact roll', () => {
    let state = initializeGame('test', players);

    // Home column is 52-57. 58 is finish.
    state.players[0].tokens[0].position = 57;
    state.diceValue = 1;
    state = moveToken(state, state.players[0].tokens[0].id);
    expect(state.players[0].tokens[0].position).toBe(58);
    expect(state.currentPlayerIndex).toBe(0); // Should still be Red's turn
  });

  it('should handle extra rolls from 6', () => {
    let state = initializeGame('test', players);
    state.diceValue = 6;
    state = moveToken(state, state.players[0].tokens[0].id);
    expect(state.currentPlayerIndex).toBe(0); // Still Red's turn
    expect(state.extraRolls).toBe(0); // Extra roll consumed (wait, moveToken sets diceValue to null and adjusts extraRolls)
    // Actually moveToken logic:
    // if (diceValue === 6) newState.extraRolls += 1;
    // if (newState.extraRolls > 0) { newState.diceValue = null; newState.extraRolls -= 1; }
    // So if it was 6, extraRolls becomes 1, then immediately reduced to 0 but currentPlayerIndex stays same.

    expect(state.diceValue).toBeNull();
  });
});
