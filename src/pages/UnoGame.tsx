import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  ArrowLeft,
  RotateCcw,
  Users,
  Layers,
  Info,
  ChevronRight,
  ChevronLeft,
  MessageSquare
} from 'lucide-react';
import { useGame } from '@/contexts/GameContext';
import { useUno } from '@/contexts/UnoContext';
import { useChat } from '@/contexts/ChatContext';
import UnoCard from '@/components/UnoCard';
import { GamingButton } from '@/components/GamingButton';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { UnoColor, isPlayable } from '@/lib/uno';
import Confetti from '@/components/Confetti';
import PlayerAvatar from '@/components/PlayerAvatar';
import { useVoice } from '@/contexts/VoiceContext';
import VoiceControls from '@/components/VoiceControls';
import ChatPanel from '@/components/ChatPanel';
import { cn } from '@/lib/utils';

const UnoGame: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { currentLobby, currentPlayer, leaveLobby } = useGame();
  const { sendMessage, roomMessages, createLobbyRoom } = useChat();
  const { participants: voiceParticipants, resumeAudio, connect: connectVoice, disconnect: disconnectVoice } = useVoice();
  const {
    gameState,
    playCard,
    drawCard,
    callUno,
    catchUno,
    selectWildColor,
    startGame,
    resetGame
  } = useUno();

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedWildCardId, setSelectedWildCardId] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);

  const roomId = code ? `lobby-${code}` : '';
  const messages = roomId ? roomMessages[roomId] || [] : [];

  useEffect(() => {
    if (code) {
      createLobbyRoom(code);
    }
  }, [code, createLobbyRoom]);

  const handleSendMessage = (content: string) => {
    if (!currentPlayer || !roomId) return;

    sendMessage(
      roomId,
      content,
      currentPlayer.name,
      currentPlayer.avatar
    );
  };

  const handleLeave = () => {
    disconnectVoice();
    leaveLobby();
    navigate('/');
  };

  useEffect(() => {
    if (!gameState && currentPlayer?.isHost && currentLobby) {
        // Automatically start if we are host and no game exists
        // But maybe wait for button? The prompt says "When Start Playing is clicked"
    }
  }, [gameState, currentPlayer, currentLobby]);

  // Auto-connect to voice
  useEffect(() => {
    if (code && currentPlayer) {
      connectVoice(`voice-lobby-${code}`, currentPlayer);
    }
  }, [code, currentPlayer?.id, connectVoice, currentPlayer]);

  // Handle wild card play - show color picker
  const handlePlayCard = (cardId: string) => {
    const card = gameState?.players.find(p => p.id === currentPlayer?.id)?.hand.find(c => c.id === cardId);
    if (card?.color === 'wild') {
        setSelectedWildCardId(cardId);
        setShowColorPicker(true);
    } else {
        playCard(cardId);
    }
  };

  const handleSelectColor = (color: UnoColor) => {
    if (selectedWildCardId) {
        playCard(selectedWildCardId, color);
        setShowColorPicker(false);
        setSelectedWildCardId(null);
    }
  };

  if (!currentLobby) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-zinc-950">
        <VoiceControls />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <Layers className="w-16 h-16 text-primary mx-auto mb-4 animate-pulse" />
          <h2 className="font-display text-2xl font-bold mb-4 text-white">Connecting to Lobby...</h2>
        </motion.div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-zinc-950" onClick={resumeAudio} onTouchStart={resumeAudio}>
        <VoiceControls />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center glass-card p-8 rounded-3xl"
        >
          <Layers className="w-16 h-16 text-primary mx-auto mb-4 animate-bounce" />
          <h2 className="font-display text-2xl font-bold mb-4">Waiting for Host to Start...</h2>
          {currentPlayer?.isHost && (
            <GamingButton variant="primary" onClick={startGame}>
                Start Game
            </GamingButton>
          )}
          <Button variant="ghost" className="mt-4" onClick={handleLeave}>
              Leave Lobby
          </Button>
        </motion.div>
      </div>
    );
  }

  const myPlayer = gameState.players.find(p => p.id === currentPlayer?.id);
  const otherPlayers = gameState.players.filter(p => p.id !== currentPlayer?.id);
  const isMyTurn = gameState.currentPlayerIndex === gameState.players.findIndex(p => p.id === currentPlayer?.id);
  const topCard = gameState.discardPile[gameState.discardPile.length - 1];

  return (
    <div className="min-h-screen relative overflow-y-auto bg-zinc-950 p-4 sm:p-8" onClick={resumeAudio} onTouchStart={resumeAudio}>
      <Confetti isActive={gameState.status === 'finished'} duration={5000} />
      <VoiceControls />

      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-10">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={handleLeave}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Leave
            </Button>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10">
                <div className={cn(
                    "w-2 h-2 rounded-full",
                    gameState.direction === 1 ? "bg-success" : "bg-warning"
                )} />
                <span className="text-xs font-bold uppercase tracking-widest text-white/60">
                    {gameState.direction === 1 ? "Clockwise" : "Counter-Clockwise"}
                </span>
            </div>
        </div>

        <div className="text-center hidden sm:block">
            <p className="text-xs font-bold text-primary uppercase tracking-[0.2em] mb-1">Last Action</p>
            <p className="text-sm text-white/80 italic">{gameState.lastActionMessage || "The game begins!"}</p>
        </div>

        <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowChat(true)}
              className="relative"
            >
              <MessageSquare className="w-4 h-4" />
              {messages.length > 0 && (
                 <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full animate-pulse" />
              )}
            </Button>
            <Button variant="outline" size="icon" onClick={() => resetGame()} title="Reset Game (Debug)">
                <RotateCcw className="w-4 h-4" />
            </Button>
        </div>
      </div>

      {/* Game Area */}
      <div className="relative z-10 max-w-6xl mx-auto min-h-[calc(100vh-200px)] flex flex-col justify-between">

        {/* Opponents */}
        <div className="flex justify-center gap-8 py-4">
            {otherPlayers.map((player) => (
                <motion.div
                    key={player.id}
                    className={cn(
                        "relative flex flex-col items-center",
                        gameState.currentPlayerIndex === gameState.players.findIndex(p => p.id === player.id) && "scale-110"
                    )}
                >
                    <div className="relative mb-2">
                        <PlayerAvatar
                            avatar={player.avatar}
                            name={player.name}
                            isSpeaking={voiceParticipants.some(p => p.id === player.id && p.isSpeaking)}
                            size="md"
                        />
                        {gameState.currentPlayerIndex === gameState.players.findIndex(p => p.id === player.id) && (
                            <div className="absolute -inset-1 border-2 border-primary rounded-full animate-pulse" />
                        )}
                        <div className="absolute -bottom-1 -right-1 bg-zinc-900 border border-white/20 rounded-full px-2 py-0.5 text-[10px] font-bold">
                            {player.hand.length}
                        </div>
                    </div>
                    <span className="text-xs font-medium text-white/70 max-w-[80px] truncate">{player.name}</span>
                    {player.hand.length === 1 && (
                        <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ repeat: Infinity }}
                            className="mt-1 px-2 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded"
                        >
                            UNO!
                        </motion.div>
                    )}
                    {player.hand.length === 1 && !gameState.unoCalled[player.id] && (
                         <Button
                            variant="destructive"
                            size="sm"
                            className="mt-2 h-6 text-[10px]"
                            onClick={() => catchUno(player.id)}
                        >
                            Catch!
                        </Button>
                    )}
                </motion.div>
            ))}
        </div>

        {/* Center: Deck and Discard */}
        <div className="flex-1 flex items-center justify-center gap-12">
            {/* Deck */}
            <div className="relative group">
                <div className="absolute -inset-2 bg-primary/20 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                <div
                    className="relative cursor-pointer"
                    onClick={() => isMyTurn && drawCard()}
                >
                    <UnoCard card={gameState.deck[0]} isBack size="lg" />
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-zinc-900 border border-white/20 rounded-full px-3 py-1 text-xs font-bold text-white">
                        {gameState.deck.length}
                    </div>
                </div>
            </div>

            {/* Discard Pile */}
            <div className="relative">
                <AnimatePresence mode="popLayout">
                    <motion.div
                        key={topCard.id}
                        initial={{ scale: 0.8, opacity: 0, rotate: -20, y: 50 }}
                        animate={{ scale: 1, opacity: 1, rotate: 0, y: 0 }}
                        className="relative"
                    >
                        <UnoCard card={topCard} size="lg" />
                        {gameState.selectedColor && topCard.color === 'wild' && (
                             <div className={cn(
                                "absolute -bottom-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full border-2 border-white shadow-lg",
                                colorMap[gameState.selectedColor]
                            )} />
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>

        {/* My Hand */}
        <div className="relative pt-12 pb-4">
             {isMyTurn && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 flex items-center gap-2 px-6 py-2 bg-primary/20 border border-primary/30 rounded-full backdrop-blur-md">
                    <span className="text-sm font-display font-bold text-primary uppercase tracking-widest animate-pulse">Your Turn</span>
                </div>
             )}

             <div className="flex flex-wrap justify-center gap-2 max-w-4xl mx-auto px-4">
                {myPlayer?.hand.map((card, idx) => (
                    <motion.div
                        key={card.id}
                        initial={{ y: 50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: idx * 0.05 }}
                    >
                        <UnoCard
                            card={card}
                            isPlayable={isMyTurn && isPlayable(card, topCard, gameState.selectedColor)}
                            disabled={!isMyTurn}
                            onClick={() => handlePlayCard(card.id)}
                            size="md"
                        />
                    </motion.div>
                ))}
             </div>

             {/* Action Bar */}
             <div className="mt-8 flex justify-center gap-4">
                <AnimatePresence>
                    {myPlayer?.hand.length === 2 && (
                        <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{
                                scale: [1, 1.1, 1],
                                opacity: 1,
                            }}
                            transition={{
                                scale: { repeat: Infinity, duration: 1 },
                                initial: { type: "spring", damping: 15 }
                            }}
                            exit={{ scale: 0, opacity: 0 }}
                        >
                            <GamingButton
                                variant="warning"
                                onClick={callUno}
                                disabled={gameState.unoCalled[myPlayer.id]}
                                pulseEffect={!gameState.unoCalled[myPlayer.id]}
                            >
                                Call UNO!
                            </GamingButton>
                        </motion.div>
                    )}
                </AnimatePresence>
             </div>
        </div>
      </div>

      {/* Color Picker Overlay */}
      <AnimatePresence>
        {showColorPicker && (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            >
                <motion.div
                    initial={{ scale: 0.5, y: 100 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.5, y: 100 }}
                    className="glass-card p-8 rounded-[2rem] max-w-sm w-full text-center border-t-4 border-primary"
                >
                    <h3 className="font-display text-2xl font-bold mb-6 gradient-text">Choose a Color</h3>
                    <div className="grid grid-cols-2 gap-4">
                        {(['red', 'blue', 'green', 'yellow'] as UnoColor[]).map((color, idx) => (
                            <motion.button
                                key={color}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: idx * 0.1 }}
                                whileHover={{
                                    scale: 1.05,
                                    boxShadow: `0 0 20px ${color === 'yellow' ? 'rgba(250, 204, 21, 0.4)' : `rgba(var(--${color}), 0.4)`}`
                                }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleSelectColor(color)}
                                className={cn(
                                    "h-24 rounded-2xl border-4 border-white/10 shadow-xl flex items-center justify-center transition-all",
                                    colorMap[color]
                                )}
                            >
                                <span className="font-bold uppercase text-white drop-shadow-md">{color}</span>
                            </motion.button>
                        ))}
                    </div>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>

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
                            onClick={handleLeave}
                        >
                            Back to Home
                        </Button>
                    </div>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <ChatPanel
        isOpen={showChat}
        onClose={() => setShowChat(false)}
        messages={messages}
        onSendMessage={handleSendMessage}
      />
    </div>
  );
};

const colorMap: Record<string, string> = {
    red: 'bg-red-500',
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-400',
    wild: 'bg-zinc-900',
};

export default UnoGame;
