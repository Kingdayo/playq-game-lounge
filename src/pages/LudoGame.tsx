import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  ArrowLeft,
  RotateCcw,
  Users,
  Info,
  Dices,
} from 'lucide-react';
import { useGame } from '@/contexts/GameContext';
import { useLudo } from '@/contexts/LudoContext';
import { GamingButton } from '@/components/GamingButton';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { LudoColor, BOARD_CONFIG, COLORS, GLOBAL_SAFE_SQUARES, getLegalMoves, initializeGame } from '@/lib/ludo';
import Confetti from '@/components/Confetti';
import PlayerAvatar from '@/components/PlayerAvatar';
import { cn } from '@/lib/utils';

const LudoGame: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { currentLobby, currentPlayer } = useGame();
  const {
    gameState,
    rollDice,
    selectToken,
    startGame,
    resetGame
  } = useLudo();

  if (!currentLobby) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
          <Dices className="w-16 h-16 text-primary mx-auto mb-4 animate-pulse" />
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
          <Dices className="w-16 h-16 text-primary mx-auto mb-4 animate-bounce" />
          <h2 className="font-display text-2xl font-bold mb-4">Waiting for Host to Start...</h2>
          {currentPlayer?.isHost && (
            <GamingButton variant="primary" onClick={startGame}>
                Start Game
            </GamingButton>
          )}
          <Button variant="ghost" className="mt-4" onClick={() => navigate(`/lobby/${code}`)}>
              Back to Lobby
          </Button>
        </motion.div>
      </div>
    );
  }

  const myPlayerIndex = gameState.players.findIndex(p => p.id === currentPlayer?.id);
  const isMyTurn = gameState.currentPlayerIndex === myPlayerIndex;
  const legalMoves = isMyTurn ? getLegalMoves(gameState) : [];

  const getTokensAtPosition = (type: 'main' | 'homeCol' | 'homeArea' | 'finish', posIdx: number, color?: LudoColor) => {
    const tokens: any[] = [];
    gameState.players.forEach(p => {
      p.tokens.forEach(t => {
        if (type === 'main' && t.position === posIdx) tokens.push(t);
        else if (type === 'homeCol' && t.position === 52 + posIdx && t.color === color) tokens.push(t);
        else if (type === 'homeArea' && t.position === -1 && t.color === color && t.index === posIdx) tokens.push(t);
        else if (type === 'finish' && t.position === 58) {
            // Finished tokens are handled in the center cell render
        }
      });
    });
    return tokens;
  };

  const renderCell = (r: number, c: number) => {
    // Determine cell type
    let cellClass = "w-full h-full border border-white/10 flex items-center justify-center relative";
    let bgClass = "bg-zinc-800/50";
    let content: React.ReactNode = null;
    let onClick: (() => void) | undefined = undefined;

    // Check Home Areas
    for (const color of COLORS) {
      const area = BOARD_CONFIG[color].homeArea;
      const areaIdx = area.findIndex(cell => cell.r === r && cell.c === c);
      if (areaIdx !== -1) {
        bgClass = color === 'red' ? 'bg-red-500/20' : color === 'green' ? 'bg-green-500/20' : color === 'yellow' ? 'bg-yellow-500/20' : 'bg-blue-500/20';
        const tokens = getTokensAtPosition('homeArea', areaIdx, color);
        content = tokens.map(t => (
            <Token
                key={t.id}
                token={t}
                isSelectable={legalMoves.includes(t.id)}
                onClick={() => selectToken(t.id)}
            />
        ));
      }

      // Home base background
      if (r >= (color === 'red' || color === 'green' ? 0 : 9) &&
          r <= (color === 'red' || color === 'green' ? 5 : 14) &&
          c >= (color === 'red' || color === 'blue' ? 0 : 9) &&
          c <= (color === 'red' || color === 'blue' ? 5 : 14)) {
          bgClass = color === 'red' ? 'bg-red-500/10' : color === 'green' ? 'bg-green-500/10' : color === 'yellow' ? 'bg-yellow-500/10' : 'bg-blue-500/10';
      }
    }

    // Check Main Track
    const trackIdx = BOARD_CONFIG.mainTrack.findIndex(cell => cell.r === r && cell.c === c);
    if (trackIdx !== -1) {
      bgClass = "bg-zinc-700/50";
      if (GLOBAL_SAFE_SQUARES.includes(trackIdx)) {
          bgClass = "bg-zinc-600/80";
          content = <Info className="w-2 h-2 text-white/20 absolute top-0.5 right-0.5" />;
      }

      // Color starting squares
      for (const color of COLORS) {
          if (BOARD_CONFIG[color].start === trackIdx) {
              bgClass = color === 'red' ? 'bg-red-500/60' : color === 'green' ? 'bg-green-500/60' : color === 'yellow' ? 'bg-yellow-500/60' : 'bg-blue-500/60';
          }
      }

      const tokens = getTokensAtPosition('main', trackIdx);
      content = (
          <div className="flex flex-wrap items-center justify-center gap-0.5">
              {tokens.map(t => (
                <Token
                    key={t.id}
                    token={t}
                    isSelectable={legalMoves.includes(t.id)}
                    onClick={() => selectToken(t.id)}
                    isStacked={tokens.length > 1}
                />
              ))}
          </div>
      );
    }

    // Check Home Columns
    for (const color of COLORS) {
      const homeColIdx = BOARD_CONFIG[color].homeColumn.findIndex(cell => cell.r === r && cell.c === c);
      if (homeColIdx !== -1) {
        bgClass = color === 'red' ? 'bg-red-500/40' : color === 'green' ? 'bg-green-500/40' : color === 'yellow' ? 'bg-yellow-500/40' : 'bg-blue-500/40';
        const tokens = getTokensAtPosition('homeCol', homeColIdx, color);
        content = (
            <div className="flex flex-wrap items-center justify-center gap-0.5">
                {tokens.map(t => (
                  <Token
                      key={t.id}
                      token={t}
                      isSelectable={legalMoves.includes(t.id)}
                      onClick={() => selectToken(t.id)}
                      isStacked={tokens.length > 1}
                  />
                ))}
            </div>
        );
      }
    }

    // Center / Finish
    if (r >= 6 && r <= 8 && c >= 6 && c <= 8) {
        if (r === 7 && c === 7) {
            bgClass = "bg-gradient-to-br from-red-500 via-green-500 to-blue-500";
            const finishedTokens = gameState.players.flatMap(p => p.tokens.filter(t => t.position === 58));
            content = (
                <div className="grid grid-cols-2 gap-0.5">
                    {COLORS.map(color => {
                        const count = finishedTokens.filter(t => t.color === color).length;
                        if (count === 0) return null;
                        const bgColor = color === 'red' ? 'bg-red-500' : color === 'green' ? 'bg-green-500' : color === 'yellow' ? 'bg-yellow-500' : 'bg-blue-500';
                        return (
                            <div key={color} className={cn("w-3 h-3 rounded-full flex items-center justify-center text-[8px] font-bold text-white", bgColor)}>
                                {count}
                            </div>
                        );
                    })}
                </div>
            );
        } else {
            // Triangle parts of the center
            if (r === 6 && c === 7) bgClass = "bg-green-500/60";
            if (r === 8 && c === 7) bgClass = "bg-blue-500/60";
            if (r === 7 && c === 6) bgClass = "bg-red-500/60";
            if (r === 7 && c === 8) bgClass = "bg-yellow-500/60";
        }
    }

    return (
      <div key={`${r}-${c}`} className={cn(cellClass, bgClass)} onClick={onClick}>
        {content}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-950 p-4 sm:p-8 flex flex-col items-center">
      <Confetti isActive={gameState.status === 'finished'} duration={5000} />

      <div className="w-full max-w-5xl flex flex-col lg:flex-row gap-8 items-start">
        {/* Left Side: Players & Info */}
        <div className="w-full lg:w-64 space-y-6 order-2 lg:order-1">
            <div className="glass-card p-4 rounded-2xl">
                <h3 className="font-display text-sm font-bold text-primary mb-4 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Players
                </h3>
                <div className="space-y-3">
                    {gameState.players.map((player, idx) => (
                        <div
                            key={player.id}
                            className={cn(
                                "flex items-center gap-3 p-2 rounded-xl border transition-all",
                                gameState.currentPlayerIndex === idx ? "border-primary bg-primary/10 scale-105" : "border-white/5 bg-white/5"
                            )}
                        >
                            <div className="relative">
                                <PlayerAvatar avatar={player.avatar} name={player.name} size="sm" />
                                <div className={cn(
                                    "absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-zinc-950",
                                    player.color === 'red' ? 'bg-red-500' : player.color === 'green' ? 'bg-green-500' : player.color === 'yellow' ? 'bg-yellow-500' : player.color === 'blue' ? 'bg-blue-500'
                                )} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold truncate">{player.name}</p>
                                {player.hasFinished && (
                                    <span className="text-[10px] text-success font-bold uppercase">Rank: {player.finishRank}</span>
                                )}
                            </div>
                            {gameState.currentPlayerIndex === idx && (
                                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div className="glass-card p-4 rounded-2xl">
                <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Last Action</p>
                <p className="text-sm text-white/80 italic">{gameState.lastActionMessage}</p>
            </div>

            <Button variant="ghost" className="w-full" onClick={() => navigate(`/lobby/${code}`)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Lobby
            </Button>

            <Button variant="outline" size="sm" className="w-full opacity-50" onClick={() => resetGame()}>
                <RotateCcw className="w-3 h-3 mr-2" />
                Reset Game
            </Button>
        </div>

        {/* Center: Board */}
        <div className="flex-1 flex flex-col items-center gap-6 order-1 lg:order-2">
            <div className="relative aspect-square w-full max-w-[min(80vw,600px)] glass-card p-1 rounded-xl shadow-2xl overflow-hidden">
                <div className="grid grid-cols-15 grid-rows-15 w-full h-full bg-zinc-900 border border-white/10">
                    {Array.from({ length: 15 * 15 }).map((_, i) => {
                        const r = Math.floor(i / 15);
                        const c = i % 15;
                        return renderCell(r, c);
                    })}
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-6">
                <div className="relative flex flex-col items-center">
                    <AnimatePresence mode="wait">
                        {gameState.isRolling ? (
                            <motion.div
                                key="rolling"
                                initial={{ rotate: 0 }}
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 0.5, ease: "linear" }}
                                className="w-16 h-16 bg-white/10 rounded-xl flex items-center justify-center border-2 border-primary/50"
                            >
                                <Dices className="w-10 h-10 text-primary" />
                            </motion.div>
                        ) : (
                            <motion.div
                                key={gameState.diceValue || 'empty'}
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className={cn(
                                    "w-16 h-16 rounded-xl flex items-center justify-center border-2 text-3xl font-black shadow-lg",
                                    gameState.diceValue ? "bg-white text-zinc-950 border-white" : "bg-white/5 text-white/20 border-white/10"
                                )}
                            >
                                {gameState.diceValue || '?'}
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <p className="text-[10px] font-bold uppercase tracking-tighter mt-2 text-white/40">Dice</p>
                </div>

                <div className="space-y-2">
                    {isMyTurn && gameState.diceValue === null && !gameState.isRolling && (
                        <GamingButton
                            variant="primary"
                            size="lg"
                            onClick={rollDice}
                            pulseEffect
                        >
                            <Dices className="w-5 h-5" />
                            Roll Dice
                        </GamingButton>
                    )}

                    {isMyTurn && gameState.diceValue !== null && (
                         <div className="px-4 py-2 bg-primary/20 border border-primary/30 rounded-xl text-center">
                            <p className="text-xs font-bold text-primary uppercase animate-pulse">Select a token to move</p>
                         </div>
                    )}

                    {!isMyTurn && (
                        <div className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-center">
                            <p className="text-sm font-medium text-white/60 italic tracking-wide">
                                Waiting for {gameState.players[gameState.currentPlayerIndex].name}...
                            </p>
                        </div>
                    )}
                </div>

                {gameState.extraRolls > 0 && (
                    <div className="bg-warning/20 border border-warning/30 px-3 py-1 rounded-full">
                        <span className="text-[10px] font-bold text-warning uppercase">+{gameState.extraRolls} Extra Roll</span>
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* Winner Overlay */}
      <AnimatePresence>
        {gameState.status === 'finished' && (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
            >
                <motion.div
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    className="glass-card p-12 rounded-[3rem] max-w-lg w-full text-center border-t-4 border-primary"
                >
                    <div className="relative inline-block mb-6">
                        <Trophy className="w-24 h-24 text-primary animate-bounce" />
                        <div className="absolute -inset-4 bg-primary/20 rounded-full blur-2xl -z-10" />
                    </div>

                    <h2 className="font-display text-4xl font-black mb-2 gradient-text uppercase tracking-tighter">Winner!</h2>
                    <p className="text-xl text-white/80 mb-8">
                        {gameState.players.find(p => p.id === gameState.winnerId)?.name} has won the game!
                    </p>

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
                        <Button
                            variant="ghost"
                            className="w-full"
                            onClick={() => navigate('/')}
                        >
                            Back to Home
                        </Button>
                    </div>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface TokenProps {
    token: any;
    isSelectable: boolean;
    onClick: () => void;
    isStacked?: boolean;
}

const Token: React.FC<TokenProps> = ({ token, isSelectable, onClick, isStacked }) => {
    const bgColor = token.color === 'red' ? 'bg-red-500' : token.color === 'green' ? 'bg-green-500' : token.color === 'yellow' ? 'bg-yellow-500' : 'bg-blue-500';

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (isSelectable && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick();
        }
    };

    return (
        <motion.div
            layoutId={token.id}
            role="button"
            tabIndex={isSelectable ? 0 : -1}
            aria-label={`Token ${token.index + 1} (${token.color})`}
            whileHover={isSelectable ? { scale: 1.2 } : {}}
            whileTap={isSelectable ? { scale: 0.9 } : {}}
            onClick={(e) => {
                if (isSelectable) {
                    e.stopPropagation();
                    onClick();
                }
            }}
            onKeyDown={handleKeyDown}
            className={cn(
                "w-4 h-4 sm:w-6 sm:h-6 rounded-full border-2 border-white/40 shadow-lg cursor-pointer transition-shadow focus:outline-none",
                bgColor,
                isSelectable && "ring-4 ring-primary ring-offset-2 ring-offset-zinc-900 z-10 animate-pulse",
                isStacked && "w-3 h-3 sm:w-4 sm:h-4 border-1"
            )}
        />
    );
};

export default LudoGame;
