import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  ArrowLeft,
  RotateCcw,
  Users,
  Info,
  ChevronRight,
  ChevronLeft,
  Hand
} from 'lucide-react';
import { useGame } from '@/contexts/GameContext';
import { useDominoes } from '@/contexts/DominoesContext';
import DominoTileComponent from '@/components/DominoTile';
import { GamingButton } from '@/components/GamingButton';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import Confetti from '@/components/Confetti';
import PlayerAvatar from '@/components/PlayerAvatar';
import { cn } from '@/lib/utils';
import { canPlayTile } from '@/lib/dominoes';

const DominoesGame: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { currentLobby, currentPlayer } = useGame();
  const {
    gameState,
    playTile,
    drawTile,
    passTurn,
    startGame,
    resetGame
  } = useDominoes();

  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [showPlacementChoice, setShowPlacementChoice] = useState(false);

  const myPlayer = gameState?.players.find(p => p.id === currentPlayer?.id);
  const isMyTurn = gameState?.currentPlayerIndex === gameState?.players.findIndex(p => p.id === currentPlayer?.id);

  const handleTileClick = (tileId: string) => {
    if (!isMyTurn || !gameState) return;

    const tile = myPlayer?.hand.find(t => t.id === tileId);
    if (!tile) return;

    const { leftEnd, rightEnd } = gameState.board;

    if (leftEnd === null) {
      // First tile, no choice needed
      playTile(tileId, 'right');
      return;
    }

    const canPlayLeft = tile.sideA === leftEnd || tile.sideB === leftEnd;
    const canPlayRight = tile.sideA === rightEnd || tile.sideB === rightEnd;

    if (canPlayLeft && canPlayRight && leftEnd !== rightEnd) {
      setSelectedTileId(tileId);
      setShowPlacementChoice(true);
    } else if (canPlayLeft) {
      playTile(tileId, 'left');
    } else if (canPlayRight) {
      playTile(tileId, 'right');
    } else {
      toast({ title: "Cannot play this tile!", variant: "destructive" });
    }
  };

  const handlePlacementChoice = (side: 'left' | 'right') => {
    if (selectedTileId) {
      playTile(selectedTileId, side);
      setSelectedTileId(null);
      setShowPlacementChoice(false);
    }
  };

  if (!currentLobby) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="font-display text-2xl font-bold mb-4 text-white">Connecting to Lobby...</h2>
        </motion.div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center glass-card p-8 rounded-3xl"
        >
          <Hand className="w-16 h-16 text-primary mx-auto mb-4 animate-bounce" />
          <h2 className="font-display text-2xl font-bold mb-4 text-white">Dominoes</h2>
          <p className="text-muted-foreground mb-6">Waiting for the host to start the game</p>
          {currentPlayer?.isHost && (
            <GamingButton variant="primary" onClick={startGame}>
              Start Game
            </GamingButton>
          )}
          <Button variant="ghost" className="mt-4 text-white" onClick={() => navigate(`/lobby/${code}`)}>
            Back to Lobby
          </Button>
        </motion.div>
      </div>
    );
  }

  const otherPlayers = gameState.players.filter(p => p.id !== currentPlayer?.id);

  return (
    <div className="min-h-screen relative overflow-hidden bg-zinc-950 p-4 sm:p-8 flex flex-col">
      <Confetti isActive={gameState.status === 'finished'} duration={5000} />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(`/lobby/${code}`)} className="text-white hover:bg-white/10">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Lobby
          </Button>
          <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10">
            <span className="text-xs font-bold uppercase tracking-widest text-white/60">
              {gameState.settings.variant} variant
            </span>
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs font-bold text-primary uppercase tracking-[0.2em] mb-1">Status</p>
          <p className="text-sm text-white/80 italic">{gameState.lastActionMessage || "The game begins!"}</p>
        </div>

        <Button variant="outline" size="icon" onClick={() => resetGame()} title="Reset Game (Debug)" className="text-white border-white/20 hover:bg-white/10">
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      {/* Main Game Area */}
      <div className="flex-1 flex flex-col relative z-10 max-w-7xl mx-auto w-full gap-4">

        {/* Opponents (Top) */}
        <div className="flex justify-center gap-4 sm:gap-8 py-2">
          {otherPlayers.map((player) => (
            <motion.div
              key={player.id}
              className={cn(
                "relative flex flex-col items-center p-2 rounded-xl transition-all",
                gameState.currentPlayerIndex === gameState.players.findIndex(p => p.id === player.id) && "bg-primary/10 ring-1 ring-primary/50"
              )}
            >
              <PlayerAvatar avatar={player.avatar} name={player.name} size="sm" />
              <div className="absolute -top-1 -right-1 bg-zinc-900 border border-white/20 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white">
                {player.hand.length}
              </div>
              <span className="text-[10px] sm:text-xs font-medium text-white/70 mt-1 max-w-[60px] truncate">{player.name}</span>
            </motion.div>
          ))}
        </div>

        {/* Board (Center) */}
        <div className="flex-1 glass-card rounded-3xl overflow-auto p-8 flex items-center justify-center min-h-[300px]">
          <div className="flex items-center gap-1 min-w-max">
            {gameState.board.tiles.length === 0 ? (
              <div className="text-white/20 font-display text-xl uppercase tracking-widest border-2 border-dashed border-white/10 p-12 rounded-2xl">
                Board is empty
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {gameState.board.tiles.map((placed, idx) => {
                  // Determine visual orientation and rotation
                  // If it's a double, it stands vertical in a horizontal chain
                  const isDouble = placed.tile.sideA === placed.tile.sideB;

                  let rotation = 0;
                  if (!isDouble) {
                      const isLeftmost = idx === 0;
                      const isRightmost = idx === gameState.board.tiles.length - 1;

                      if (isLeftmost) {
                          // The side that is NOT connected is on the left.
                          if (placed.connectionPoint === 'sideA') rotation = 180; // sideB is on left
                          else rotation = 0; // sideA is on left
                      } else {
                          // Connects to the left (idx-1). So the connected side is on the left.
                          if (placed.connectionPoint === 'sideA') rotation = 0; // sideA is on left
                          else rotation = 180; // sideB is on left
                      }
                  }

                  return (
                    <motion.div
                      key={`${placed.tile.id}-${idx}`}
                      layout
                      initial={{
                        scale: 0.5,
                        opacity: 0,
                        x: idx === 0 ? -100 : 100
                      }}
                      animate={{ scale: 1, opacity: 1, x: 0 }}
                      transition={{ type: "spring", damping: 15, stiffness: 200 }}
                    >
                      <DominoTileComponent
                        tile={placed.tile}
                        size="md"
                        orientation={isDouble ? 'vertical' : 'horizontal'}
                        rotation={rotation}
                        disabled
                      />
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* My Section (Bottom) */}
        <div className="glass-card rounded-3xl p-6 bg-zinc-900/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <PlayerAvatar avatar={myPlayer?.avatar || ''} name={myPlayer?.name || ''} size="sm" isReady />
              <div>
                <p className="text-sm font-bold text-white">{myPlayer?.name}</p>
                <p className="text-[10px] text-primary uppercase font-black tracking-tighter">Your Hand</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-[10px] text-white/40 uppercase font-bold">Boneyard</p>
                <p className="text-sm font-bold text-white">{gameState.boneyard.length} Tiles</p>
              </div>

              <div className="h-8 w-px bg-white/10" />

              <div className="flex gap-2">
                <GamingButton
                  variant="primary"
                  size="sm"
                  onClick={drawTile}
                  disabled={!isMyTurn || gameState.boneyard.length === 0}
                >
                  Draw
                </GamingButton>
                <GamingButton
                  variant="secondary"
                  size="sm"
                  onClick={passTurn}
                  disabled={!isMyTurn}
                >
                  Pass
                </GamingButton>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-3 py-4 min-h-[120px]">
            <AnimatePresence mode="popLayout">
              {myPlayer?.hand.map((tile, idx) => (
                <motion.div
                  key={tile.id}
                  layout
                  initial={{ y: 50, opacity: 0, rotate: -10 }}
                  animate={{ y: 0, opacity: 1, rotate: 0 }}
                  exit={{ scale: 0.5, opacity: 0, y: -50 }}
                  transition={{ delay: idx * 0.03, type: "spring", damping: 20 }}
                >
                  <DominoTileComponent
                    tile={tile}
                    isPlayable={isMyTurn && canPlayTile(tile, gameState.board.leftEnd, gameState.board.rightEnd)}
                    onClick={() => handleTileClick(tile.id)}
                    disabled={!isMyTurn}
                    size="md"
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Placement Choice Overlay */}
      <AnimatePresence>
        {showPlacementChoice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <div className="glass-card p-8 rounded-3xl max-w-sm w-full text-center border-t-4 border-primary">
              <h3 className="font-display text-2xl font-bold mb-6 text-white uppercase">Choose Side</h3>
              <p className="text-white/60 mb-8">Where do you want to place this tile?</p>
              <div className="grid grid-cols-2 gap-4">
                <Button
                  onClick={() => handlePlacementChoice('left')}
                  className="h-20 rounded-2xl bg-zinc-800 hover:bg-primary text-white border-2 border-white/5"
                >
                  <ChevronLeft className="w-6 h-6 mr-2" />
                  Left End
                </Button>
                <Button
                  onClick={() => handlePlacementChoice('right')}
                  className="h-20 rounded-2xl bg-zinc-800 hover:bg-primary text-white border-2 border-white/5"
                >
                  Right End
                  <ChevronRight className="w-6 h-6 ml-2" />
                </Button>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowPlacementChoice(false);
                  setSelectedTileId(null);
                }}
                className="mt-6 text-white/40 hover:text-white"
              >
                Cancel
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Winner Overlay */}
      <AnimatePresence>
        {gameState.status === 'finished' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="glass-card p-12 rounded-[3rem] max-w-lg w-full text-center border-t-4 border-primary relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />

              <div className="relative inline-block mb-6">
                <Trophy className="w-24 h-24 text-primary animate-bounce" />
                <div className="absolute -inset-4 bg-primary/20 rounded-full blur-2xl -z-10" />
              </div>

              <h2 className="font-display text-5xl font-black mb-2 gradient-text uppercase tracking-tighter italic">Victory!</h2>
              <div className="mb-8">
                <p className="text-2xl text-white font-bold mb-1">
                  {gameState.players.find(p => p.id === gameState.winnerId)?.name}
                </p>
                <p className="text-white/60 uppercase text-xs tracking-widest font-black">Round Champion</p>
              </div>

              <div className="bg-white/5 rounded-2xl p-6 mb-8 border border-white/10">
                <h4 className="text-[10px] uppercase font-black tracking-widest text-primary mb-4 text-left">Final Pip Totals</h4>
                <div className="space-y-3">
                    {gameState.players.map(p => (
                        <div key={p.id} className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <PlayerAvatar avatar={p.avatar} name={p.name} size="xs" />
                                <span className={cn("text-sm", p.id === gameState.winnerId ? "text-white font-bold" : "text-white/60")}>{p.name}</span>
                            </div>
                            <span className="text-white font-mono">{p.hand.reduce((sum, t) => sum + t.sideA + t.sideB, 0)} Pips</span>
                        </div>
                    ))}
                </div>
              </div>

              <div className="space-y-4">
                <GamingButton
                  variant="primary"
                  className="w-full h-14 text-lg"
                  onClick={() => {
                    resetGame();
                    navigate(`/lobby/${code}`);
                  }}
                >
                  Return to Lobby
                </GamingButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DominoesGame;
