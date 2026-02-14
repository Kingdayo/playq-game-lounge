import { Circle, Triangle, Plus, Square, Star, Zap } from 'lucide-react';

export type WhotShape = 'circle' | 'triangle' | 'cross' | 'square' | 'star' | 'whot';

export interface WhotCard {
  id: string;
  shape: WhotShape;
  value: number;
}

export interface WhotGameState {
  lobbyCode: string;
  deck: WhotCard[];
  discardPile: WhotCard[];
  players: {
    id: string;
    name: string;
    avatar: string;
    hand: WhotCard[];
  }[];
  currentPlayerIndex: number;
  direction: 1 | -1;
  status: 'waiting' | 'playing' | 'finished';
  winnerId: string | null;
  selectedShape: WhotShape | null; // For Whot (20) cards
  lastCardCalled: Record<string, boolean>;
  checkCalled: Record<string, boolean>; // For when player has 2 cards
  turnActionTaken: boolean;
  lastActionMessage: string | null;
  pendingDrawCount: number; // For stacked pick two/three? (Optional, let's keep it simple first)
}

export const createDeck = (): WhotCard[] => {
  const deck: WhotCard[] = [];
  let idCount = 0;

  const shapes: Record<Exclude<WhotShape, 'whot'>, number[]> = {
    circle: [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14],
    triangle: [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14],
    cross: [1, 2, 3, 5, 7, 10, 11, 13, 14],
    square: [1, 2, 3, 5, 7, 10, 11, 13, 14],
    star: [1, 2, 3, 4, 5, 7, 8],
  };

  for (const [shape, values] of Object.entries(shapes)) {
    for (const value of values) {
      deck.push({
        id: `whot-${idCount++}`,
        shape: shape as WhotShape,
        value,
      });
    }
  }

  // 5 Whot cards (Wild)
  for (let i = 0; i < 5; i++) {
    deck.push({
      id: `whot-${idCount++}`,
      shape: 'whot',
      value: 20,
    });
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

export const isPlayable = (card: WhotCard, topCard: WhotCard, selectedShape: WhotShape | null): boolean => {
  if (card.shape === 'whot') return true;

  const effectiveTopShape = topCard.shape === 'whot' ? selectedShape : topCard.shape;

  if (card.shape === effectiveTopShape) return true;
  if (card.value === topCard.value) return true;

  return false;
};

export const getNextPlayerIndex = (currentIndex: number, playerCount: number, direction: 1 | -1): number => {
  let next = currentIndex + direction;
  if (next >= playerCount) next = 0;
  if (next < 0) next = playerCount - 1;
  return next;
};

export const initializeGame = (lobbyCode: string, players: { id: string, name: string, avatar: string }[]): WhotGameState => {
  let deck = shuffle(createDeck());

  const dealtPlayers = players.map(player => {
    const hand = deck.splice(0, 5); // Deal 5 cards each
    return { ...player, hand };
  });

  // Initial discard - must not be a special card for simplicity, or we handle it
  // In Whot, if the first card is a special card, its effect might apply or we reshuffle.
  // Common rule: if first card is special, it doesn't apply to the first player, or we pick another.
  let discardIndex = deck.findIndex(card => ![1, 2, 5, 8, 14, 20].includes(card.value));
  if (discardIndex === -1) discardIndex = 0;

  const [initialDiscard] = deck.splice(discardIndex, 1);
  const discardPile = [initialDiscard];

  return {
    lobbyCode,
    deck,
    discardPile,
    players: dealtPlayers,
    currentPlayerIndex: 0,
    direction: 1,
    status: 'playing',
    winnerId: null,
    selectedShape: null,
    lastCardCalled: {},
    checkCalled: {},
    turnActionTaken: false,
    lastActionMessage: 'Game started!',
    pendingDrawCount: 0
  };
};

export const calculateScore = (hand: WhotCard[]): number => {
  return hand.reduce((acc, card) => {
    if (card.shape === 'star') return acc + (card.value * 2);
    if (card.shape === 'whot') return acc + 20;
    return acc + card.value;
  }, 0);
};

export const shapeStyles: Record<WhotShape, { text: string, bg: string, border: string, icon: string }> = {
  circle: {
    text: 'text-red-500',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    icon: 'text-red-500'
  },
  triangle: {
    text: 'text-green-500',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    icon: 'text-green-500'
  },
  cross: {
    text: 'text-blue-500',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    icon: 'text-blue-500'
  },
  square: {
    text: 'text-orange-500',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    icon: 'text-orange-500'
  },
  star: {
    text: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    icon: 'text-yellow-500'
  },
  whot: {
    text: 'text-purple-500',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    icon: 'text-purple-500'
  }
};

export const shapeIcons: Record<WhotShape, any> = {
  circle: Circle,
  triangle: Triangle,
  cross: Plus,
  square: Square,
  star: Star,
  whot: Zap,
};
