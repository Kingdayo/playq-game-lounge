export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  id: string;
  points: Point[];
  color: string;
  width: number;
  tool: 'brush' | 'eraser';
}

export interface Guess {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  isCorrect: boolean;
  timestamp: number;
}

export interface PictionaryGameState {
  lobbyCode: string;
  players: {
    id: string;
    name: string;
    avatar: string;
    score: number;
    hasGuessedCorrectly: boolean;
  }[];
  currentDrawerIndex: number;
  currentWord: string | null;
  status: 'waiting' | 'starting' | 'drawing' | 'round_end' | 'finished';
  timer: number;
  totalRounds: number;
  currentRound: number;
  strokes: Stroke[];
  guesses: Guess[];
  winnerId: string | null;
  lastActionMessage: string | null;
}

export const PICTIONARY_WORDS = [
  'Apple', 'Banana', 'Cat', 'Dog', 'Elephant', 'Flower', 'Guitar', 'House', 'Ice Cream', 'Jellyfish',
  'Kangaroo', 'Lion', 'Mountain', 'Notebook', 'Orange', 'Penguin', 'Queen', 'Rainbow', 'Sun', 'Tree',
  'Umbrella', 'Violin', 'Whale', 'Xylophone', 'Yo-yo', 'Zebra', 'Airplane', 'Bicycle', 'Car', 'Drum',
  'Egg', 'Frog', 'Ghost', 'Hat', 'Igloo', 'Jacket', 'Key', 'Lamp', 'Moon', 'Nest', 'Owl', 'Pizza',
  'Robot', 'Snake', 'Train', 'Unicorn', 'Vase', 'Watch', 'Yacht', 'Zipper', 'Beach', 'Castle', 'Dragon',
  'Earth', 'Forest', 'Garden', 'Hammer', 'Island', 'Jungle', 'Knight', 'Lemon', 'Mushroom', 'Ninja',
  'Ocean', 'Pirate', 'Rocket', 'Star', 'Tornado', 'Volcano', 'Wizard', 'Anchor', 'Butterfly', 'Cactus',
  'Dolphin', 'Eagle', 'Flamingo', 'Giraffe', 'Hippopotamus', 'Insects', 'Juice', 'Koala', 'Lizard',
  'Monkey', 'Night', 'Octopus', 'Parrot', 'Quilt', 'Rabbit', 'Spider', 'Tiger', 'Underwear', 'Vulture',
  'Worm', 'X-ray', 'Yellow', 'Zucchini'
];

export const getNextDrawerIndex = (currentIndex: number, playerCount: number): number => {
  return (currentIndex + 1) % playerCount;
};

export const getRandomWord = (): string => {
  return PICTIONARY_WORDS[Math.floor(Math.random() * PICTIONARY_WORDS.length)];
};

export const initializeGame = (lobbyCode: string, players: { id: string, name: string, avatar: string }[]): PictionaryGameState => {
  return {
    lobbyCode,
    players: players.map(p => ({ ...p, score: 0, hasGuessedCorrectly: false })),
    currentDrawerIndex: 0,
    currentWord: null,
    status: 'waiting',
    timer: 60,
    totalRounds: players.length * 2, // Each player draws twice
    currentRound: 1,
    strokes: [],
    guesses: [],
    winnerId: null,
    lastActionMessage: 'Game is about to start!'
  };
};

export const checkGuess = (guess: string, word: string): boolean => {
  return guess.toLowerCase().trim() === word.toLowerCase().trim();
};
