export type LudoColor = 'red' | 'green' | 'yellow' | 'blue';

export interface LudoToken {
  id: string;
  color: LudoColor;
  position: number; // -1 for home, 0-51 for main track, 52-57 for home column, 58 for finished
  index: number; // 0-3 (which token of the player)
}

export interface LudoPlayer {
  id: string;
  name: string;
  avatar: string;
  color: LudoColor;
  tokens: LudoToken[];
  hasFinished: boolean;
  finishRank?: number;
}

export interface LudoGameState {
  lobbyCode: string;
  players: LudoPlayer[];
  currentPlayerIndex: number;
  diceValue: number | null;
  status: 'waiting' | 'playing' | 'finished';
  winnerId: string | null;
  lastActionMessage: string | null;
  extraRolls: number;
  isRolling: boolean;
}

export const COLORS: LudoColor[] = ['red', 'green', 'yellow', 'blue'];

export const BOARD_CONFIG = {
  red: {
    start: 1,
    exit: 51,
    safeSquares: [1, 9],
    homeColumn: [
      { r: 7, c: 1 }, { r: 7, c: 2 }, { r: 7, c: 3 }, { r: 7, c: 4 }, { r: 7, c: 5 }, { r: 7, c: 6 }
    ],
    homeArea: [
      { r: 2, c: 2 }, { r: 2, c: 3 }, { r: 3, c: 2 }, { r: 3, c: 3 }
    ]
  },
  green: {
    start: 14,
    exit: 12,
    safeSquares: [14, 22],
    homeColumn: [
      { r: 1, c: 7 }, { r: 2, c: 7 }, { r: 3, c: 7 }, { r: 4, c: 7 }, { r: 5, c: 7 }, { r: 6, c: 7 }
    ],
    homeArea: [
      { r: 2, c: 11 }, { r: 2, c: 12 }, { r: 3, c: 11 }, { r: 3, c: 12 }
    ]
  },
  yellow: {
    start: 27,
    exit: 25,
    safeSquares: [27, 35],
    homeColumn: [
      { r: 7, c: 13 }, { r: 7, c: 12 }, { r: 7, c: 11 }, { r: 7, c: 10 }, { r: 7, c: 9 }, { r: 7, c: 8 }
    ],
    homeArea: [
      { r: 11, c: 11 }, { r: 11, c: 12 }, { r: 12, c: 11 }, { r: 12, c: 12 }
    ]
  },
  blue: {
    start: 40,
    exit: 38,
    safeSquares: [40, 48],
    homeColumn: [
      { r: 13, c: 7 }, { r: 12, c: 7 }, { r: 11, c: 7 }, { r: 10, c: 7 }, { r: 9, c: 7 }, { r: 8, c: 7 }
    ],
    homeArea: [
      { r: 11, c: 2 }, { r: 11, c: 3 }, { r: 12, c: 2 }, { r: 12, c: 3 }
    ]
  },
  finish: { r: 7, c: 7 },
  mainTrack: [
    { r: 6, c: 0 }, { r: 6, c: 1 }, { r: 6, c: 2 }, { r: 6, c: 3 }, { r: 6, c: 4 }, { r: 6, c: 5 },
    { r: 5, c: 6 }, { r: 4, c: 6 }, { r: 3, c: 6 }, { r: 2, c: 6 }, { r: 1, c: 6 }, { r: 0, c: 6 },
    { r: 0, c: 7 },
    { r: 0, c: 8 }, { r: 1, c: 8 }, { r: 2, c: 8 }, { r: 3, c: 8 }, { r: 4, c: 8 }, { r: 5, c: 8 },
    { r: 6, c: 9 }, { r: 6, c: 10 }, { r: 6, c: 11 }, { r: 6, c: 12 }, { r: 6, c: 13 }, { r: 6, c: 14 },
    { r: 7, c: 14 },
    { r: 8, c: 14 }, { r: 8, c: 13 }, { r: 8, c: 12 }, { r: 8, c: 11 }, { r: 8, c: 10 }, { r: 8, c: 9 },
    { r: 9, c: 8 }, { r: 10, c: 8 }, { r: 11, c: 8 }, { r: 12, c: 8 }, { r: 13, c: 8 }, { r: 14, c: 8 },
    { r: 14, c: 7 },
    { r: 14, c: 6 }, { r: 13, c: 6 }, { r: 12, c: 6 }, { r: 11, c: 6 }, { r: 10, c: 6 }, { r: 9, c: 6 },
    { r: 8, c: 5 }, { r: 8, c: 4 }, { r: 8, c: 3 }, { r: 8, c: 2 }, { r: 8, c: 1 }, { r: 8, c: 0 },
    { r: 7, c: 0 }
  ]
};

export const GLOBAL_SAFE_SQUARES = [1, 9, 14, 22, 27, 35, 40, 48];

export const initializeGame = (lobbyCode: string, players: { id: string, name: string, avatar: string }[]): LudoGameState => {
  const ludoPlayers: LudoPlayer[] = players.map((p, i) => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    color: COLORS[i],
    tokens: Array.from({ length: 4 }).map((_, j) => ({
      id: `token-${p.id}-${j}`,
      color: COLORS[i],
      position: -1,
      index: j
    })),
    hasFinished: false
  }));

  return {
    lobbyCode,
    players: ludoPlayers,
    currentPlayerIndex: 0,
    diceValue: null,
    status: 'playing',
    winnerId: null,
    lastActionMessage: 'Game started! Red goes first.',
    extraRolls: 0,
    isRolling: false
  };
};

export const getLegalMoves = (gameState: LudoGameState): string[] => {
  if (gameState.diceValue === null) return [];

  const player = gameState.players[gameState.currentPlayerIndex];
  const diceValue = gameState.diceValue;
  const legalTokenIds: string[] = [];

  for (const token of player.tokens) {
    if (token.position === 58) continue; // Already finished

    if (token.position === -1) {
      if (diceValue === 6) {
        legalTokenIds.push(token.id);
      }
    } else if (token.position >= 0 && token.position <= 51) {
      // On main track
      legalTokenIds.push(token.id);
    } else if (token.position >= 52 && token.position <= 57) {
      // In home column
      if (token.position + diceValue <= 58) {
        legalTokenIds.push(token.id);
      }
    }
  }

  return legalTokenIds;
};

export const moveToken = (gameState: LudoGameState, tokenId: string): LudoGameState => {
  if (gameState.diceValue === null) return gameState;

  const newState = { ...gameState };
  const playerIndex = newState.currentPlayerIndex;
  const player = { ...newState.players[playerIndex] };
  const tokenIndex = player.tokens.findIndex(t => t.id === tokenId);
  const token = { ...player.tokens[tokenIndex] };
  const diceValue = newState.diceValue;
  const config = BOARD_CONFIG[token.color];

  let captureOccurred = false;
  let finishedOccurred = false;

  if (token.position === -1) {
    // Move out of home
    if (diceValue === 6) {
      token.position = config.start;
      newState.lastActionMessage = `${player.name} moved a token out of home!`;
    }
  } else if (token.position >= 0 && token.position <= 51) {
    // Moving on main track
    let currentPos = token.position;
    let remainingMoves = diceValue;
    let movedIntoHomeColumn = false;

    while (remainingMoves > 0) {
      if (currentPos === config.exit) {
        // Enter home column
        currentPos = 52;
        movedIntoHomeColumn = true;
        remainingMoves--;
        break; // Stop here and handle remaining moves in home column logic
      } else {
        currentPos = (currentPos + 1) % 52;
        remainingMoves--;
      }
    }

    if (movedIntoHomeColumn && remainingMoves > 0) {
      currentPos += remainingMoves;
      if (currentPos > 58) currentPos = 58; // Should not happen with legal moves check
    }

    token.position = currentPos;
    newState.lastActionMessage = `${player.name} moved a token.`;
  } else {
    // Moving in home column
    token.position += diceValue;
    newState.lastActionMessage = `${player.name} moved a token towards home.`;
  }

  // Check for finish
  if (token.position === 58) {
    finishedOccurred = true;
    newState.lastActionMessage = `${player.name} got a token home!`;
  }

  // Check for capture (only on main track and not on safe squares)
  if (token.position >= 0 && token.position <= 51 && !GLOBAL_SAFE_SQUARES.includes(token.position)) {
    newState.players.forEach((p, pIdx) => {
      if (pIdx === playerIndex) return; // Don't capture own tokens (or maybe stacking?)

      p.tokens.forEach((t, tIdx) => {
        if (t.position === token.position) {
          // CAPTURE!
          const capturedPlayer = { ...newState.players[pIdx] };
          const capturedToken = { ...capturedPlayer.tokens[tIdx] };
          capturedToken.position = -1;
          capturedPlayer.tokens[tIdx] = capturedToken;
          newState.players[pIdx] = capturedPlayer;
          captureOccurred = true;
          newState.lastActionMessage = `${player.name} captured ${capturedPlayer.name}'s token!`;
        }
      });
    });
  }

  // Update token and player
  player.tokens[tokenIndex] = token;

  // Check if player has finished all tokens
  if (player.tokens.every(t => t.position === 58)) {
    player.hasFinished = true;
    if (!player.finishRank) {
      const finishedCount = newState.players.filter(p => p.hasFinished).length;
      player.finishRank = finishedCount + 1;
    }
    newState.lastActionMessage = `${player.name} has finished all their tokens!`;

    // Check if only one player left
    const remainingPlayers = newState.players.filter(p => !p.hasFinished);
    if (remainingPlayers.length <= 1) {
        newState.status = 'finished';
        newState.winnerId = newState.players.find(p => p.finishRank === 1)?.id || player.id;
    }
  }

  newState.players[playerIndex] = player;

  // Rule: Capture or Finish gives an extra roll
  if (captureOccurred || finishedOccurred) {
    newState.extraRolls += 1;
  }

  // Handle turn transition
  if (diceValue === 6) {
    newState.extraRolls += 1;
    // Check for 3 sixes? Let's keep it simple.
  }

  if (newState.extraRolls > 0) {
    newState.diceValue = null;
    newState.extraRolls -= 1;
  } else {
    newState.diceValue = null;
    newState.currentPlayerIndex = getNextActivePlayerIndex(newState);
  }

  return newState;
};

const getNextActivePlayerIndex = (gameState: LudoGameState): number => {
    let nextIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
    while (gameState.players[nextIndex].hasFinished && gameState.players.some(p => !p.hasFinished)) {
        nextIndex = (nextIndex + 1) % gameState.players.length;
    }
    return nextIndex;
};

export const skipTurn = (gameState: LudoGameState): LudoGameState => {
    const newState = { ...gameState };
    const playerWhoSkipped = gameState.players[gameState.currentPlayerIndex];

    // If they rolled a 6, they might have extra rolls
    if (newState.diceValue === 6) {
        newState.extraRolls += 1;
    }

    if (newState.extraRolls > 0) {
        newState.diceValue = null;
        newState.extraRolls -= 1;
        newState.lastActionMessage = `${playerWhoSkipped.name} had no moves but gets an extra roll!`;
    } else {
        newState.diceValue = null;
        newState.extraRolls = 0;
        newState.currentPlayerIndex = getNextActivePlayerIndex(newState);
        newState.lastActionMessage = `${playerWhoSkipped.name} had no legal moves and skipped turn.`;
    }
    return newState;
};
