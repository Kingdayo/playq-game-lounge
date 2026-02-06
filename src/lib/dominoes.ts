export interface DominoTile {
  id: string;
  sideA: number;
  sideB: number;
}

export interface PlacedTile {
  tile: DominoTile;
  sideAValue: number;
  sideBValue: number;
  connectionPoint: 'sideA' | 'sideB'; // which side of this tile connects to the previous tile
  isDouble: boolean;
}

export interface DominoGameState {
  lobbyCode: string;
  boneyard: DominoTile[];
  board: {
    tiles: PlacedTile[];
    leftEnd: number | null;
    rightEnd: number | null;
  };
  players: {
    id: string;
    name: string;
    avatar: string;
    hand: DominoTile[];
    score: number;
  }[];
  currentPlayerIndex: number;
  status: 'waiting' | 'playing' | 'finished';
  winnerId: string | null;
  lastActionMessage: string | null;
  settings: {
    variant: 'draw' | 'block';
    setSize: 6 | 9 | 12;
  };
}

export const createSet = (setSize: number = 6): DominoTile[] => {
  const set: DominoTile[] = [];
  let idCount = 0;
  for (let i = 0; i <= setSize; i++) {
    for (let j = i; j <= setSize; j++) {
      set.push({
        id: `tile-${idCount++}`,
        sideA: i,
        sideB: j,
      });
    }
  }
  return set;
};

export const shuffle = <T>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

export const getHighestDouble = (hand: DominoTile[]): number => {
  let highest = -1;
  for (const tile of hand) {
    if (tile.sideA === tile.sideB) {
      if (tile.sideA > highest) {
        highest = tile.sideA;
      }
    }
  }
  return highest;
};

export const initializeGame = (
  lobbyCode: string,
  players: { id: string; name: string; avatar: string }[],
  settings: { variant: 'draw' | 'block'; setSize: 6 | 9 | 12 } = { variant: 'draw', setSize: 6 }
): DominoGameState => {
  let boneyard = shuffle(createSet(settings.setSize));

  const tilesPerPlayer = players.length === 2 ? 7 : 5;

  const dealtPlayers = players.map((player) => {
    const hand = boneyard.splice(0, tilesPerPlayer);
    return { ...player, hand, score: 0 };
  });

  // Determine starting player: highest double starts
  let startingPlayerIndex = 0;
  let maxDouble = -1;

  dealtPlayers.forEach((player, index) => {
    const hd = getHighestDouble(player.hand);
    if (hd > maxDouble) {
      maxDouble = hd;
      startingPlayerIndex = index;
    }
  });

  // If no one has a double, highest tile starts
  if (maxDouble === -1) {
    let maxPipSum = -1;
    dealtPlayers.forEach((player, index) => {
      player.hand.forEach((tile) => {
        const sum = tile.sideA + tile.sideB;
        if (sum > maxPipSum) {
          maxPipSum = sum;
          startingPlayerIndex = index;
        }
      });
    });
  }

  return {
    lobbyCode,
    boneyard,
    board: {
      tiles: [],
      leftEnd: null,
      rightEnd: null,
    },
    players: dealtPlayers,
    currentPlayerIndex: startingPlayerIndex,
    status: 'playing',
    winnerId: null,
    lastActionMessage: 'Game started!',
    settings,
  };
};

export const canPlayTile = (tile: DominoTile, leftEnd: number | null, rightEnd: number | null): boolean => {
  if (leftEnd === null || rightEnd === null) return true; // First tile
  return (
    tile.sideA === leftEnd ||
    tile.sideB === leftEnd ||
    tile.sideA === rightEnd ||
    tile.sideB === rightEnd
  );
};

export const getLegalMoves = (hand: DominoTile[], leftEnd: number | null, rightEnd: number | null) => {
  return hand.filter((tile) => canPlayTile(tile, leftEnd, rightEnd));
};

export const calculateHandScore = (hand: DominoTile[]): number => {
  return hand.reduce((sum, tile) => sum + tile.sideA + tile.sideB, 0);
};
