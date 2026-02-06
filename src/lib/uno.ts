export type UnoColor = 'red' | 'blue' | 'green' | 'yellow' | 'wild';
export type UnoValue = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'draw4';

export interface UnoCard {
  id: string;
  color: UnoColor;
  value: UnoValue;
}

export interface UnoGameState {
  lobbyCode: string;
  deck: UnoCard[];
  discardPile: UnoCard[];
  players: {
    id: string;
    name: string;
    avatar: string;
    hand: UnoCard[];
  }[];
  currentPlayerIndex: number;
  direction: 1 | -1;
  status: 'waiting' | 'playing' | 'finished';
  winnerId: string | null;
  selectedColor: UnoColor | null; // For wild cards
  unoCalled: Record<string, boolean>;
  pendingDrawCount: number; // For stacked draw2/draw4 if we want, but standard UNO is usually not stacked. Let's stick to standard.
  turnActionTaken: boolean; // Whether the player has already played or drawn this turn
  lastActionMessage: string | null;
}

export const createDeck = (): UnoCard[] => {
  const deck: UnoCard[] = [];
  const colors: Exclude<UnoColor, 'wild'>[] = ['red', 'blue', 'green', 'yellow'];
  const values: UnoValue[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2'];

  let idCount = 0;

  for (const color of colors) {
    for (const value of values) {
      // One '0' per color, two of every other number and action card
      const count = value === '0' ? 1 : 2;
      for (let i = 0; i < count; i++) {
        deck.push({ id: `card-${idCount++}`, color, value });
      }
    }
  }

  // 4 Wild and 4 Wild Draw Four
  for (let i = 0; i < 4; i++) {
    deck.push({ id: `card-${idCount++}`, color: 'wild', value: 'wild' });
    deck.push({ id: `card-${idCount++}`, color: 'wild', value: 'draw4' });
  }

  return deck;
};

export const shuffle = <T>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

export const isPlayable = (card: UnoCard, topCard: UnoCard, selectedColor: UnoColor | null): boolean => {
  if (card.color === 'wild') return true;

  const effectiveTopColor = topCard.color === 'wild' ? selectedColor : topCard.color;

  if (card.color === effectiveTopColor) return true;
  if (card.value === topCard.value) return true;

  return false;
};

export const getNextPlayerIndex = (currentIndex: number, playerCount: number, direction: 1 | -1): number => {
  let next = currentIndex + direction;
  if (next >= playerCount) next = 0;
  if (next < 0) next = playerCount - 1;
  return next;
};

export const initializeGame = (lobbyCode: string, players: { id: string, name: string, avatar: string }[]): UnoGameState => {
  let deck = shuffle(createDeck());

  const dealtPlayers = players.map(player => {
    const hand = deck.splice(0, 7);
    return { ...player, hand };
  });

  // Initial discard - must not be a Wild Draw Four
  let discardIndex = deck.findIndex(card => card.value !== 'draw4');
  if (discardIndex === -1) discardIndex = 0; // Should never happen

  const [initialDiscard] = deck.splice(discardIndex, 1);
  const discardPile = [initialDiscard];

  // Handle initial discard effects
  let currentPlayerIndex = 0;
  let direction: 1 | -1 = 1;
  let selectedColor: UnoColor | null = null;
  let lastActionMessage = 'Game started!';

  if (initialDiscard.value === 'skip') {
    currentPlayerIndex = getNextPlayerIndex(0, players.length, 1);
    lastActionMessage = `${players[0].name} was skipped!`;
  } else if (initialDiscard.value === 'reverse') {
    direction = -1;
    currentPlayerIndex = players.length - 1;
    lastActionMessage = 'Direction reversed!';
  } else if (initialDiscard.value === 'draw2') {
    // In some rules, first player draws 2 and is skipped.
    dealtPlayers[0].hand.push(...deck.splice(0, 2));
    currentPlayerIndex = getNextPlayerIndex(0, players.length, 1);
    lastActionMessage = `${players[0].name} drew 2 and was skipped!`;
  } else if (initialDiscard.value === 'wild') {
    // In some rules, first player chooses color. Let's just say it starts as the player's choice.
    // To simplify, let's pick a random color or wait for first player.
    // Standard rules: Player to the left of dealer chooses. We'll let the first player choose.
    lastActionMessage = 'Wild card! Choose a color.';
  }

  return {
    lobbyCode,
    deck,
    discardPile,
    players: dealtPlayers,
    currentPlayerIndex,
    direction,
    status: 'playing',
    winnerId: null,
    selectedColor: null,
    unoCalled: {},
    pendingDrawCount: 0,
    turnActionTaken: false,
    lastActionMessage
  };
};
