import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Palette, 
  Brush, 
  Layers, 
  Dices, 
  Plus, 
  LogIn, 
  Sparkles,
  Users,
  Zap
} from 'lucide-react';
import CircularProgress from '@mui/material/CircularProgress';
import Skeleton from '@mui/material/Skeleton';
import GameCard from '@/components/GameCard';
import { GamingButton } from '@/components/GamingButton';
import { useGame } from '@/contexts/GameContext';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const games = [
  {
    id: 'uno',
    title: 'Uno',
    description: 'Match colors and numbers, use action cards to outplay opponents!',
    icon: Layers,
    playerCount: '2-10 Players',
    gradient: 'linear-gradient(135deg, #f43f5e 0%, #f97316 100%)',
    glowColor: 'rgba(244, 63, 94, 0.3)',
  },
  {
    id: 'pictionary',
    title: 'Pictionary',
    description: 'Draw and guess words in timed rounds with your friends!',
    icon: Brush,
    playerCount: '4-8 Players',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)',
    glowColor: 'rgba(139, 92, 246, 0.3)',
  },
  {
    id: 'ludo',
    title: 'Ludo',
    description: 'Race your pieces home while blocking opponents on the board!',
    icon: Dices,
    playerCount: '2-4 Players',
    gradient: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
    glowColor: 'rgba(6, 182, 212, 0.3)',
  },
  {
    id: 'dominoes',
    title: 'Dominoes',
    description: 'Match tiles strategically to score points and empty your hand!',
    icon: Palette,
    playerCount: '2-4 Players',
    gradient: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',
    glowColor: 'rgba(16, 185, 129, 0.3)',
  },
];

const Index: React.FC = () => {
  const navigate = useNavigate();
  const { createLobby, joinLobby } = useGame();
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  const handleCreateGame = async (gameId: string) => {
    const lobby = await createLobby(gameId as 'uno' | 'ludo' | 'pictionary' | 'dominoes');
    navigate(`/lobby/${lobby.code}`);
  };

  const handleJoinGame = async () => {
    const cleanedCode = joinCode.replace(/\s/g, '').toUpperCase();
    if (cleanedCode.length !== 6) {
      setJoinError('Code must be 6 characters');
      return;
    }
    
    setIsJoining(true);
    setJoinError('');
    
    try {
      const success = await joinLobby(cleanedCode);
      if (success) {
        setShowJoinDialog(false);
        setJoinCode('');
        navigate(`/lobby/${cleanedCode}`);
      } else {
        setJoinError('Lobby not found. Check the code and try again.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to join. Please try again.';
      setJoinError(message);
    } finally {
      setIsJoining(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="min-h-screen p-4 sm:p-8">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-7xl mx-auto"
      >
        {/* Hero Section */}
        <motion.div variants={itemVariants} className="text-center mb-12">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="inline-block mb-4"
          >
            <span className="px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium border border-primary/20">
              <Sparkles className="w-4 h-4 inline-block mr-2" />
              Welcome to the future of gaming
            </span>
          </motion.div>
          
          <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-bold mb-4">
            Play Together,{' '}
            <span className="gradient-text">Win Together</span>
          </h1>
          
          <p className="text-muted-foreground text-lg sm:text-xl max-w-2xl mx-auto mb-8">
            Experience classic multiplayer games with stunning visuals, real-time gameplay,
            and friends from anywhere in the world.
          </p>

          {/* Quick Actions */}
          <div className="flex flex-wrap justify-center gap-4">
            <GamingButton
              variant="primary"
              size="lg"
              onClick={() => document.getElementById('games-section')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <Plus className="w-5 h-5" />
              Create Game
            </GamingButton>
            
            <GamingButton
              variant="outline"
              size="lg"
              onClick={() => setShowJoinDialog(true)}
            >
              <LogIn className="w-5 h-5" />
              Join Game
            </GamingButton>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          variants={itemVariants}
          className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-12"
        >
          {[
            { icon: Users, label: 'Active Players', value: '2.4K' },
            { icon: Zap, label: 'Games Today', value: '847' },
            { icon: Sparkles, label: 'Games Available', value: '4' },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className="glass-card rounded-xl p-4 text-center"
            >
              <stat.icon className="w-5 h-5 text-primary mx-auto mb-2" />
              <p className="font-display text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Games Section */}
        <motion.div variants={itemVariants} id="games-section">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-2xl font-bold text-foreground">
              Choose Your Game
            </h2>
            <span className="text-sm text-muted-foreground">
              {games.length} games available
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {games.map((game, index) => (
              <motion.div
                key={game.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + index * 0.1 }}
              >
                <GameCard
                  title={game.title}
                  description={game.description}
                  icon={game.icon}
                  playerCount={game.playerCount}
                  gradient={game.gradient}
                  glowColor={game.glowColor}
                  onClick={() => handleCreateGame(game.id)}
                />
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* How to Play Section */}
        <motion.div variants={itemVariants} className="mt-16">
          <h2 className="font-display text-2xl font-bold text-foreground text-center mb-8">
            How It Works
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                title: 'Choose a Game',
                description: 'Pick from Uno, Pictionary, Ludo, or Dominoes',
              },
              {
                step: '02',
                title: 'Create or Join',
                description: 'Start a lobby or enter a friend\'s 6-character code',
              },
              {
                step: '03',
                title: 'Play & Win',
                description: 'Enjoy real-time gameplay with voice and text chat',
              },
            ].map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + index * 0.1 }}
                className="glass-card rounded-xl p-6 text-center"
              >
                <span className="font-display text-4xl font-bold gradient-text">
                  {item.step}
                </span>
                <h3 className="font-display text-lg font-bold text-foreground mt-4 mb-2">
                  {item.title}
                </h3>
                <p className="text-muted-foreground text-sm">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.div>

      {/* Join Game Dialog */}
      <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <DialogContent className="glass-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Join a Game</DialogTitle>
            <DialogDescription>
              Enter the 6-character code shared by your friend
            </DialogDescription>
          </DialogHeader>
          
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (joinCode.replace(/\s/g, '').length === 6 && !isJoining) {
                handleJoinGame();
              }
            }}
            className="space-y-4 pt-4"
          >
            <div>
              <Input
                value={joinCode}
                onChange={(e) => {
                  setJoinCode(e.target.value.toUpperCase());
                  setJoinError('');
                }}
                placeholder="ABC123"
                className="text-center font-display text-2xl tracking-widest bg-muted border-0 h-14"
                maxLength={10}
              />
              {joinError && (
                <p className="text-destructive text-sm mt-2 text-center">{joinError}</p>
              )}
            </div>
            
            <GamingButton
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              disabled={joinCode.replace(/\s/g, '').length !== 6 || isJoining}
            >
              {isJoining ? (
                <>
                  <CircularProgress size={20} sx={{ color: 'inherit' }} />
                  Joining...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Join Game
                </>
              )}
            </GamingButton>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
