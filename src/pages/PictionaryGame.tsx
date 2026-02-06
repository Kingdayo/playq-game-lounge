import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brush,
  Eraser,
  Trash2,
  RotateCcw,
  Send,
  Trophy,
  Timer,
  Users,
  LogOut,
  Palette as PaletteIcon
} from 'lucide-react';
import { useGame } from '@/contexts/GameContext';
import { usePictionary } from '@/contexts/PictionaryContext';
import { GamingButton } from '@/components/GamingButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PlayerAvatar from '@/components/PlayerAvatar';
import { useVoice } from '@/contexts/VoiceContext';
import { toast } from '@/components/ui/use-toast';
import { Stroke, Point } from '@/lib/pictionary';
import Confetti from '@/components/Confetti';
import { cn } from '@/lib/utils';

const COLORS = [
  '#FFFFFF', '#000000', '#FF0000', '#00FF00', '#0000FF',
  '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#8B4513'
];

const BRUSH_SIZES = [2, 5, 10, 20];

const PictionaryCanvas: React.FC<{
  isDrawer: boolean;
  strokes: Stroke[];
  onDrawStroke: (stroke: Stroke) => void;
  onUpdateStroke: (points: Point[]) => void;
  brushColor: string;
  brushSize: number;
  tool: 'brush' | 'eraser';
}> = ({ isDrawer, strokes, onDrawStroke, onUpdateStroke, brushColor, brushSize, tool }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const currentStrokePoints = useRef<Point[]>([]);

  const drawAllStrokes = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    strokes.forEach(stroke => {
      if (stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = stroke.tool === 'eraser' ? '#1A1A1A' : stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    });
  }, [strokes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
        const parent = canvas.parentElement;
        if (parent) {
            canvas.width = parent.clientWidth;
            canvas.height = parent.clientHeight;
            drawAllStrokes(ctx);
        }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [drawAllStrokes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawAllStrokes(ctx);
  }, [strokes, drawAllStrokes]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as MouseEvent).clientX;
      clientY = (e as MouseEvent).clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawer) return;
    setIsDrawing(true);
    const pos = getCoordinates(e);
    currentStrokePoints.current = [pos];

    const newStroke: Stroke = {
        id: Math.random().toString(36).substr(2, 9),
        points: [pos],
        color: brushColor,
        width: brushSize,
        tool: tool
    };
    onDrawStroke(newStroke);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !isDrawer) return;
    const pos = getCoordinates(e);
    currentStrokePoints.current.push(pos);

    // Throttle updates to avoid too many broadcasts?
    // For now just send every point
    onUpdateStroke([...currentStrokePoints.current]);
  };

  const stopDrawing = () => {
    if (!isDrawer) return;
    setIsDrawing(false);
    currentStrokePoints.current = [];
  };

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full cursor-crosshair touch-none bg-[#1A1A1A] rounded-lg"
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={stopDrawing}
      onMouseLeave={stopDrawing}
      onTouchStart={startDrawing}
      onTouchMove={draw}
      onTouchEnd={stopDrawing}
    />
  );
};

const PictionaryGame: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { currentLobby, currentPlayer } = useGame();
  const { participants: voiceParticipants } = useVoice();
  const {
    gameState,
    drawStroke,
    updateCurrentStroke,
    submitGuess,
    clearCanvas,
    undoStroke,
    resetGame
  } = usePictionary();

  const [guessText, setGuessText] = useState('');
  const [brushColor, setBrushColor] = useState(COLORS[0]);
  const [brushSize, setBrushSize] = useState(BRUSH_SIZES[1]);
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameState?.guesses]);

  if (!gameState || !currentPlayer || !gameState.players || !gameState.players[gameState.currentDrawerIndex]) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <p className="text-muted-foreground">Connecting to game...</p>
      </div>
    );
  }

  const isDrawer = gameState.players[gameState.currentDrawerIndex].id === currentPlayer.id;
  const currentDrawer = gameState.players[gameState.currentDrawerIndex];

  const handleGuess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guessText.trim()) return;
    submitGuess(guessText);
    setGuessText('');
  };

  return (
    <div className="min-h-screen p-4 sm:p-8 flex flex-col relative overflow-y-auto bg-zinc-950">
      <Confetti isActive={gameState.status === 'finished'} duration={5000} />

      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-5">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <div className="max-w-7xl mx-auto w-full flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/lobby/${code}`)}>
            <LogOut className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-display text-2xl font-bold gradient-text">Pictionary</h1>
            <p className="text-xs text-muted-foreground">Room: {code}</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex flex-col items-center">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Round</span>
            <span className="font-display text-xl font-bold">{gameState.currentRound}/{gameState.totalRounds}</span>
          </div>
          <div className={`flex flex-col items-center ${gameState.timer <= 10 ? 'text-destructive animate-pulse' : 'text-primary'}`}>
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Time</span>
            <div className="flex items-center gap-1">
              <Timer className="w-4 h-4" />
              <span className="font-display text-xl font-bold">{gameState.timer}s</span>
            </div>
          </div>
        </div>

        <div className="glass-card px-6 py-2 rounded-full">
            {isDrawer ? (
                <div className="text-center">
                    <span className="text-xs text-muted-foreground uppercase block">Your Word</span>
                    <span className="font-display text-xl font-bold text-primary">{gameState.currentWord}</span>
                </div>
            ) : (
                <div className="text-center">
                    <span className="text-xs text-muted-foreground uppercase block">Drawing</span>
                    <span className="font-display text-xl font-bold">{currentDrawer.name}</span>
                </div>
            )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
        {/* Scoreboard */}
        <div className="lg:col-span-1 space-y-4 flex flex-col min-h-0">
          <div className="glass-card p-4 rounded-2xl flex-1 overflow-hidden flex flex-col">
            <h2 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Scoreboard
            </h2>
            <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar">
              {gameState.players.sort((a, b) => b.score - a.score).map((player) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-2 rounded-xl transition-colors ${
                    player.id === currentPlayer.id ? 'bg-primary/10 border border-primary/20' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <PlayerAvatar
                      avatar={player.avatar}
                      name={player.name}
                      isSpeaking={voiceParticipants.some(vp => vp.name === player.name && vp.isSpeaking)}
                      size="sm"
                      isReady={player.hasGuessedCorrectly}
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium truncate max-w-[100px]">{player.name}</span>
                      {gameState.players[gameState.currentDrawerIndex].id === player.id && (
                        <span className="text-[10px] text-primary uppercase">Drawing</span>
                      )}
                    </div>
                  </div>
                  <span className="font-display font-bold text-primary">{player.score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="lg:col-span-2 flex flex-col gap-4 min-h-0">
          <div className="glass-card relative rounded-2xl overflow-hidden flex-1 bg-[#1A1A1A] border-2 border-primary/20 shadow-2xl shadow-primary/5">
            <PictionaryCanvas
              isDrawer={isDrawer && gameState.status === 'drawing'}
              strokes={gameState.strokes}
              onDrawStroke={drawStroke}
              onUpdateStroke={updateCurrentStroke}
              brushColor={brushColor}
              brushSize={brushSize}
              tool={tool}
            />

            <AnimatePresence>
              {gameState.status !== 'drawing' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 text-center z-10"
                >
                  <div className="max-w-md">
                    {gameState.status === 'starting' && (
                      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
                        <h2 className="font-display text-4xl font-bold text-primary mb-4 italic">Get Ready!</h2>
                        <p className="text-xl text-foreground">Game is starting in a few seconds...</p>
                      </motion.div>
                    )}
                    {gameState.status === 'round_end' && (
                      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
                        <h2 className="font-display text-3xl font-bold text-primary mb-2 italic">Round Over!</h2>
                        <p className="text-lg mb-4">The word was: <span className="text-2xl font-bold text-foreground underline decoration-primary decoration-4">{gameState.currentWord}</span></p>
                        <p className="text-muted-foreground">Next round starting soon...</p>
                      </motion.div>
                    )}
                    {gameState.status === 'finished' && (
                      <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", damping: 15 }}
                      >
                        <div className="relative inline-block mb-4">
                            <Trophy className="w-20 h-20 text-yellow-500 mx-auto animate-bounce" />
                            <div className="absolute -inset-4 bg-yellow-500/20 rounded-full blur-xl -z-10" />
                        </div>
                        <h2 className="font-display text-5xl font-black text-primary mb-2 italic tracking-tighter uppercase">Victory!</h2>
                        <p className="text-2xl font-bold text-white mb-8">
                            {gameState.players.find(p => p.id === gameState.winnerId)?.name} is the Master Artist!
                        </p>
                        <GamingButton variant="primary" size="lg" className="w-full h-14" onClick={resetGame}>
                            Return to Lobby
                        </GamingButton>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Floating Drawer Tools */}
            {isDrawer && gameState.status === 'drawing' && (
              <motion.div
                initial={{ y: 100, x: "-50%", opacity: 0 }}
                animate={{ y: 0, x: "-50%", opacity: 1 }}
                transition={{ type: "spring", damping: 20, stiffness: 200 }}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 p-3 glass-card rounded-2xl border-primary/30 z-20"
              >
                <div className="flex items-center gap-1 border-r border-border pr-2">
                    {COLORS.map(color => (
                        <button
                            key={color}
                            onClick={() => { setBrushColor(color); setTool('brush'); }}
                            className={`w-6 h-6 rounded-full border border-white/20 transition-transform ${brushColor === color && tool === 'brush' ? 'scale-125 ring-2 ring-primary ring-offset-2 ring-offset-[#1A1A1A]' : 'hover:scale-110'}`}
                            style={{ backgroundColor: color }}
                        />
                    ))}
                </div>

                <div className="flex items-center gap-1 border-r border-border pr-2">
                    <Button
                        variant={tool === 'brush' ? 'primary' : 'ghost'}
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setTool('brush')}
                    >
                        <Brush className="w-4 h-4" />
                    </Button>
                    <Button
                        variant={tool === 'eraser' ? 'primary' : 'ghost'}
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setTool('eraser')}
                    >
                        <Eraser className="w-4 h-4" />
                    </Button>
                </div>

                <div className="flex items-center gap-1 border-r border-border pr-2">
                    {BRUSH_SIZES.map(size => (
                        <button
                            key={size}
                            onClick={() => setBrushSize(size)}
                            className={`rounded-full bg-white transition-all ${brushSize === size ? 'ring-2 ring-primary ring-offset-2 ring-offset-[#1A1A1A]' : 'opacity-40 hover:opacity-100'}`}
                            style={{ width: size + 4, height: size + 4 }}
                        />
                    ))}
                </div>

                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={undoStroke}>
                        <RotateCcw className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={clearCanvas}>
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
              </motion.div>
            )}
          </div>

          <div className="glass-card p-2 rounded-xl flex items-center justify-center text-sm text-muted-foreground italic">
            {gameState.lastActionMessage}
          </div>
        </div>

        {/* Guesses / Chat */}
        <div className="lg:col-span-1 flex flex-col gap-4 min-h-0">
          <div className="glass-card p-4 rounded-2xl flex-1 flex flex-col min-h-0">
            <h2 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Guesses
            </h2>
            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {gameState.guesses.map((guess, idx) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, x: 20, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  key={guess.id}
                  className={cn(
                    "p-3 rounded-xl text-sm transition-all",
                    guess.isCorrect
                      ? 'bg-success/20 border border-success/30 text-success font-bold shadow-[0_0_10px_rgba(var(--success),0.2)]'
                      : 'bg-white/5 border border-white/10 text-white/80'
                  )}
                >
                  <span className="font-bold">{guess.playerName}: </span>
                  <span>{guess.text}</span>
                </motion.div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {!isDrawer && gameState.status === 'drawing' && !gameState.players.find(p => p.id === currentPlayer.id)?.hasGuessedCorrectly && (
              <form onSubmit={handleGuess} className="mt-4 flex gap-2">
                <Input
                  value={guessText}
                  onChange={(e) => setGuessText(e.target.value)}
                  placeholder="Type your guess..."
                  className="flex-1"
                />
                <Button type="submit" variant="primary" size="icon">
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            )}

            {gameState.players.find(p => p.id === currentPlayer.id)?.hasGuessedCorrectly && (
                <div className="mt-4 p-3 bg-success/20 rounded-xl text-success text-center text-sm font-bold">
                    You've guessed it! Wait for others.
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PictionaryGame;
