import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, Medal, Crown, Star, TrendingUp } from 'lucide-react';
import PlayerAvatar from '@/components/PlayerAvatar';

interface LeaderboardEntry {
  rank: number;
  name: string;
  avatar: string;
  wins: number;
  gamesPlayed: number;
  winRate: number;
  streak: number;
}

const mockLeaderboard: LeaderboardEntry[] = [
  { rank: 1, name: 'ProGamer123', avatar: '🦊', wins: 156, gamesPlayed: 200, winRate: 78, streak: 12 },
  { rank: 2, name: 'CardMaster', avatar: '🐺', wins: 142, gamesPlayed: 195, winRate: 73, streak: 8 },
  { rank: 3, name: 'LudoKing', avatar: '🦁', wins: 138, gamesPlayed: 190, winRate: 73, streak: 5 },
  { rank: 4, name: 'DrawNinja', avatar: '🐯', wins: 125, gamesPlayed: 180, winRate: 69, streak: 3 },
  { rank: 5, name: 'DominosPro', avatar: '🐻', wins: 118, gamesPlayed: 175, winRate: 67, streak: 6 },
  { rank: 6, name: 'GameWizard', avatar: '🧙', wins: 110, gamesPlayed: 170, winRate: 65, streak: 2 },
  { rank: 7, name: 'QuickDraw', avatar: '🎨', wins: 105, gamesPlayed: 165, winRate: 64, streak: 4 },
  { rank: 8, name: 'StrategyKing', avatar: '👑', wins: 98, gamesPlayed: 160, winRate: 61, streak: 1 },
  { rank: 9, name: 'LuckyPlayer', avatar: '🍀', wins: 92, gamesPlayed: 155, winRate: 59, streak: 7 },
  { rank: 10, name: 'TopTenner', avatar: '🔟', wins: 85, gamesPlayed: 150, winRate: 57, streak: 0 },
];

const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1:
      return <Crown className="w-6 h-6 text-yellow-400" />;
    case 2:
      return <Medal className="w-6 h-6 text-gray-300" />;
    case 3:
      return <Medal className="w-6 h-6 text-amber-600" />;
    default:
      return <span className="text-lg font-bold text-muted-foreground">#{rank}</span>;
  }
};

const getRankGradient = (rank: number) => {
  switch (rank) {
    case 1:
      return 'from-yellow-500/20 to-orange-500/20 border-yellow-500/30';
    case 2:
      return 'from-gray-300/20 to-gray-500/20 border-gray-400/30';
    case 3:
      return 'from-amber-600/20 to-orange-700/20 border-amber-600/30';
    default:
      return 'from-transparent to-transparent border-border';
  }
};

const Leaderboard: React.FC = () => {
  return (
    <div className="min-h-screen p-4 sm:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4"
          >
            <Trophy className="w-5 h-5 text-primary" />
            <span className="font-medium text-primary">Global Rankings</span>
          </motion.div>
          
          <h1 className="font-display text-3xl sm:text-4xl font-bold gradient-text mb-2">
            Leaderboard
          </h1>
          <p className="text-muted-foreground">
            Top players across all games
          </p>
        </div>

        {/* Top 3 Podium */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-3 gap-4 mb-8"
        >
          {/* 2nd Place */}
          <div className="flex flex-col items-center pt-8">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="glass-card rounded-2xl p-4 text-center w-full border border-gray-400/30"
            >
              <Medal className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <PlayerAvatar
                avatar={mockLeaderboard[1].avatar}
                name={mockLeaderboard[1].name}
                size="lg"
                className="mx-auto"
              />
              <p className="font-display text-2xl font-bold mt-2">{mockLeaderboard[1].wins}</p>
              <p className="text-xs text-muted-foreground">wins</p>
            </motion.div>
          </div>

          {/* 1st Place */}
          <div className="flex flex-col items-center">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="glass-card rounded-2xl p-4 text-center w-full border border-yellow-500/30 bg-gradient-to-b from-yellow-500/10 to-transparent"
            >
              <Crown className="w-10 h-10 text-yellow-400 mx-auto mb-2" />
              <PlayerAvatar
                avatar={mockLeaderboard[0].avatar}
                name={mockLeaderboard[0].name}
                size="xl"
                isActive
                className="mx-auto"
              />
              <p className="font-display text-3xl font-bold mt-2 gradient-text">{mockLeaderboard[0].wins}</p>
              <p className="text-xs text-muted-foreground">wins</p>
            </motion.div>
          </div>

          {/* 3rd Place */}
          <div className="flex flex-col items-center pt-12">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="glass-card rounded-2xl p-4 text-center w-full border border-amber-600/30"
            >
              <Medal className="w-6 h-6 text-amber-600 mx-auto mb-2" />
              <PlayerAvatar
                avatar={mockLeaderboard[2].avatar}
                name={mockLeaderboard[2].name}
                size="md"
                className="mx-auto"
              />
              <p className="font-display text-xl font-bold mt-2">{mockLeaderboard[2].wins}</p>
              <p className="text-xs text-muted-foreground">wins</p>
            </motion.div>
          </div>
        </motion.div>

        {/* Full Leaderboard */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="glass-card rounded-2xl overflow-hidden"
        >
          <div className="p-4 border-b border-border">
            <div className="grid grid-cols-12 gap-4 text-xs font-medium text-muted-foreground uppercase">
              <div className="col-span-1">Rank</div>
              <div className="col-span-5">Player</div>
              <div className="col-span-2 text-center">Wins</div>
              <div className="col-span-2 text-center">Win Rate</div>
              <div className="col-span-2 text-center">Streak</div>
            </div>
          </div>

          <div className="divide-y divide-border">
            {mockLeaderboard.map((entry, index) => (
              <motion.div
                key={entry.rank}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
                className={`grid grid-cols-12 gap-4 p-4 items-center transition-colors hover:bg-muted/50 bg-gradient-to-r ${getRankGradient(entry.rank)}`}
              >
                <div className="col-span-1 flex items-center justify-center">
                  {getRankIcon(entry.rank)}
                </div>
                <div className="col-span-5 flex items-center gap-3">
                  <PlayerAvatar
                    avatar={entry.avatar}
                    name={entry.name}
                    size="sm"
                    showName={false}
                  />
                  <div>
                    <p className="font-medium text-foreground">{entry.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.gamesPlayed} games played
                    </p>
                  </div>
                </div>
                <div className="col-span-2 text-center">
                  <p className="font-display font-bold text-foreground">{entry.wins}</p>
                </div>
                <div className="col-span-2 text-center">
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    {entry.winRate}%
                  </span>
                </div>
                <div className="col-span-2 text-center">
                  {entry.streak > 0 ? (
                    <span className="flex items-center justify-center gap-1 text-success">
                      <TrendingUp className="w-4 h-4" />
                      {entry.streak}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Leaderboard;
