import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Palette, 
  Brush, 
  Layers, 
  Dices, 
  ArrowRight
} from 'lucide-react';
import GameCard from '@/components/GameCard';
import { useGame } from '@/contexts/GameContext';

const games = [
  {
    id: 'uno',
    title: 'Uno',
    description: 'Match colors and numbers, use action cards like Skip, Reverse, and Draw to outplay opponents. Call "UNO!" when you have one card left!',
    icon: Layers,
    playerCount: '2-10 Players',
    gradient: 'linear-gradient(135deg, #f43f5e 0%, #f97316 100%)',
    glowColor: 'rgba(244, 63, 94, 0.3)',
    rules: [
      'Match by color or number',
      'Use action cards strategically',
      'Call "UNO!" on your last card',
      'First to empty hand wins',
    ],
  },
  {
    id: 'pictionary',
    title: 'Pictionary',
    description: 'Draw and guess words in timed rounds. The artist draws while teammates try to guess the word. Quick guesses earn more points!',
    icon: Brush,
    playerCount: '4-8 Players',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)',
    glowColor: 'rgba(139, 92, 246, 0.3)',
    rules: [
      'Artist draws, others guess',
      '60 seconds per round',
      'No letters or numbers in drawings',
      'Fastest correct guess wins',
    ],
  },
  {
    id: 'ludo',
    title: 'Ludo',
    description: 'Roll the dice and race your pieces around the board. Capture opponents, use safe zones strategically, and get all pieces home first!',
    icon: Dices,
    playerCount: '2-4 Players',
    gradient: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
    glowColor: 'rgba(6, 182, 212, 0.3)',
    rules: [
      'Roll 6 to leave base',
      'Capture opponents to send them back',
      'Safe zones protect your pieces',
      'First to get all pieces home wins',
    ],
  },
  {
    id: 'dominoes',
    title: 'Dominoes',
    description: 'Match tiles strategically to build chains. Doubles act as spinners. Score points on multiples of five and empty your hand to win!',
    icon: Palette,
    playerCount: '2-4 Players',
    gradient: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',
    glowColor: 'rgba(16, 185, 129, 0.3)',
    rules: [
      'Match tile ends to play',
      'Doubles are spinners',
      'Score on multiples of 5',
      'Empty hand or lowest sum wins',
    ],
  },
];

const Games: React.FC = () => {
  const navigate = useNavigate();
  const { createLobby } = useGame();

  const handleCreateGame = async (gameId: string) => {
    const lobby = await createLobby(gameId as 'uno' | 'ludo' | 'pictionary' | 'dominoes');
    navigate(`/lobby/${lobby.code}`);
  };

  return (
    <div className="min-h-screen p-4 sm:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto"
      >
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold gradient-text mb-2">
            All Games
          </h1>
          <p className="text-muted-foreground">
            Choose a game to create a new lobby
          </p>
        </div>

        {/* Games Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {games.map((game, index) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="glass-card rounded-2xl overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  <motion.div
                    className="w-16 h-16 rounded-xl flex items-center justify-center"
                    style={{ background: game.gradient }}
                    whileHover={{ rotate: [0, -5, 5, 0] }}
                    transition={{ duration: 0.5 }}
                  >
                    <game.icon className="w-8 h-8 text-white" />
                  </motion.div>
                  <div className="flex-1">
                    <h2 className="font-display text-2xl font-bold text-foreground">
                      {game.title}
                    </h2>
                    <span
                      className="inline-block px-3 py-1 rounded-full text-xs font-medium text-white mt-2"
                      style={{ background: game.gradient }}
                    >
                      {game.playerCount}
                    </span>
                  </div>
                </div>

                <p className="text-muted-foreground mb-6">
                  {game.description}
                </p>

                {/* Rules */}
                <div className="mb-6">
                  <h3 className="font-display text-sm font-bold text-foreground mb-3">
                    Quick Rules
                  </h3>
                  <ul className="space-y-2">
                    {game.rules.map((rule, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <ArrowRight className="w-3 h-3 text-primary" />
                        {rule}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Play button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleCreateGame(game.id)}
                  className="w-full py-3 rounded-xl font-display font-semibold text-white transition-all"
                  style={{
                    background: game.gradient,
                    boxShadow: `0 0 30px ${game.glowColor}`,
                  }}
                >
                  Create Lobby
                </motion.button>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default Games;
