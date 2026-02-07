import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import {
  PictionaryGameState,
  Stroke,
  Guess,
  initializeGame,
  getNextDrawerIndex,
  getRandomWord,
  checkGuess
} from '../lib/pictionary';
import { useGame } from './GameContext';
import { useSound } from './SoundContext';
import { SoundName } from '@/types/game';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface PictionaryContextType {
  gameState: PictionaryGameState | null;
  startGame: () => void;
  startRound: () => void;
  drawStroke: (stroke: Stroke) => void;
  updateCurrentStroke: (points: {x: number, y: number}[]) => void;
  submitGuess: (text: string) => void;
  clearCanvas: () => void;
  undoStroke: () => void;
  resetGame: () => void;
}

const PictionaryContext = createContext<PictionaryContextType | undefined>(undefined);

export const usePictionary = () => {
  const context = useContext(PictionaryContext);
  if (!context) {
    throw new Error('usePictionary must be used within a PictionaryProvider');
  }
  return context;
};

export const PictionaryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentLobby, currentPlayer } = useGame();
  const { playSound, playBGM, stopBGM } = useSound();
  const [gameState, setGameState] = useState<PictionaryGameState | null>(null);
  const gameStateRef = useRef<PictionaryGameState | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const lobbyCode = currentLobby?.code;
  const storageKey = lobbyCode ? `playq-pictionary-game-${lobbyCode}` : null;

  const broadcastSound = useCallback((soundName: SoundName) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'play_sound',
        payload: { soundName }
      });
    }
    playSound(soundName);
  }, [playSound]);

  const saveGameState = useCallback((newState: PictionaryGameState, broadcast = true) => {
    setGameState(newState);
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(newState));
    }

    if (broadcast && channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'state_update',
        payload: newState
      });
    }

    // Persist to Supabase
    if (currentLobby?.id && currentPlayer?.isHost) {
      const currentHouseRules = currentLobby.settings?.houseRules || {};
      supabase
        .from('lobbies')
        .update({
          house_rules: {
            ...currentHouseRules,
            pictionaryGameState: newState
          }
        })
        .eq('id', currentLobby.id)
        .then(({ error }) => {
          if (error) console.error('Failed to persist Pictionary state:', error);
        });
    }
  }, [storageKey, currentLobby, currentPlayer]);

  // Sync state with others
  useEffect(() => {
    if (!lobbyCode || !currentPlayer) return;

    const channel = supabase.channel(`pictionary-game-${lobbyCode}`, {
      config: { broadcast: { self: false } }
    });

    channel
      .on('broadcast', { event: 'state_update' }, ({ payload }) => {
        setGameState(payload);
      })
      .on('broadcast', { event: 'play_sound' }, ({ payload }: { payload: { soundName: SoundName } }) => {
        playSound(payload.soundName);
      })
      .on('broadcast', { event: 'new_stroke' }, ({ payload }) => {
        if (gameStateRef.current) {
          setGameState({
            ...gameStateRef.current,
            strokes: [...gameStateRef.current.strokes, payload]
          });
        }
      })
      .on('broadcast', { event: 'update_current_stroke' }, ({ payload }) => {
        if (gameStateRef.current && gameStateRef.current.strokes.length > 0) {
            const newStrokes = [...gameStateRef.current.strokes];
            newStrokes[newStrokes.length - 1] = {
                ...newStrokes[newStrokes.length - 1],
                points: payload
            };
            setGameState({
                ...gameStateRef.current,
                strokes: newStrokes
            });
        }
      })
      .on('broadcast', { event: 'clear_canvas' }, () => {
        if (gameStateRef.current) {
          setGameState({ ...gameStateRef.current, strokes: [] });
        }
      })
      .on('broadcast', { event: 'undo_stroke' }, () => {
        if (gameStateRef.current) {
          setGameState({
            ...gameStateRef.current,
            strokes: gameStateRef.current.strokes.slice(0, -1)
          });
        }
      })
      .on('broadcast', { event: 'request_state' }, () => {
        if (currentPlayer.isHost && gameStateRef.current) {
          channel.send({
            type: 'broadcast',
            event: 'state_update',
            payload: gameStateRef.current
          });
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          if (!currentPlayer.isHost && !gameStateRef.current) {
            channel.send({
              type: 'broadcast',
              event: 'request_state',
              payload: {}
            });
          }
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lobbyCode, currentPlayer, playSound]);

  // Load game state from localStorage (Initial cache)
  useEffect(() => {
    if (storageKey) {
      const stored = localStorage.getItem(storageKey);
      if (stored && !gameState) {
        setGameState(JSON.parse(stored));
      }
    }
  }, [storageKey, gameState]);

  // Sync state from Supabase on mount or lobby update (initial load/refresh)
  useEffect(() => {
    const dbState = currentLobby?.settings?.houseRules?.pictionaryGameState as PictionaryGameState | undefined;
    if (dbState && !gameState) {
      setGameState(dbState);
    }
  }, [currentLobby?.settings?.houseRules?.pictionaryGameState, gameState]);

  useEffect(() => {
    if (gameState && (gameState.status === 'drawing' || gameState.status === 'starting' || gameState.status === 'round_end')) {
      playBGM('pictionary');
    } else if (!gameState || gameState.status === 'finished') {
      stopBGM();
    }
  }, [gameState?.status, playBGM, stopBGM, gameState]);

  const startRound = useCallback(() => {
    if (!gameStateRef.current || !currentPlayer?.isHost) return;

    const newState = { ...gameStateRef.current };
    newState.status = 'drawing';
    newState.currentWord = getRandomWord();
    newState.strokes = [];
    newState.guesses = [];
    newState.timer = 60;
    newState.players = newState.players.map(p => ({ ...p, hasGuessedCorrectly: false }));
    newState.lastActionMessage = `${newState.players[newState.currentDrawerIndex].name} is drawing!`;

    saveGameState(newState);
    broadcastSound('move');
  }, [currentPlayer, saveGameState, broadcastSound]);

  const startGame = useCallback(() => {
    if (!currentLobby || !currentPlayer?.isHost) return;

    const players = currentLobby.players.map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar
    }));

    const newState = initializeGame(currentLobby.code, players);
    newState.status = 'starting';
    saveGameState(newState);
    broadcastSound('move');

    // After a short delay, start the first round
    setTimeout(() => {
        startRound();
    }, 3000);

  }, [currentLobby, currentPlayer, saveGameState, broadcastSound, startRound]);

  const advanceTurn = useCallback(() => {
      if (!gameStateRef.current || !currentPlayer?.isHost) return;

      const newState = { ...gameStateRef.current };

      if (newState.currentRound >= newState.totalRounds) {
          newState.status = 'finished';
          const winner = [...newState.players].sort((a, b) => b.score - a.score)[0];
          newState.winnerId = winner.id;
          newState.lastActionMessage = `Game over! ${winner.name} wins!`;
          broadcastSound('win');
      } else {
          newState.status = 'round_end';
          newState.currentRound += 1;
          newState.currentDrawerIndex = getNextDrawerIndex(newState.currentDrawerIndex, newState.players.length);
          newState.lastActionMessage = `Round ended. The word was: ${newState.currentWord}`;

          setTimeout(() => {
              startRound();
          }, 5000);
      }

      saveGameState(newState);
  }, [currentPlayer, saveGameState, startRound, broadcastSound]);

  // Timer logic (Host only)
  useEffect(() => {
    if (currentPlayer?.isHost && gameState?.status === 'drawing') {
      timerRef.current = setInterval(() => {
        if (gameStateRef.current && gameStateRef.current.timer > 0) {
          const newState = { ...gameStateRef.current, timer: gameStateRef.current.timer - 1 };

          // Check if everyone (except drawer) guessed correctly
          const totalGuessers = newState.players.length - 1;
          const correctGuessers = newState.players.filter(p => p.hasGuessedCorrectly).length;

          if (newState.timer === 0 || (totalGuessers > 0 && correctGuessers === totalGuessers)) {
              clearInterval(timerRef.current!);
              advanceTurn();
          } else {
              // We don't want to persist every second to DB, just broadcast
              setGameState(newState);
              if (channelRef.current) {
                  channelRef.current.send({
                      type: 'broadcast',
                      event: 'state_update',
                      payload: newState
                  });
              }
          }
        }
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentPlayer?.isHost, gameState?.status, advanceTurn]);

  const drawStroke = useCallback((stroke: Stroke) => {
    if (!gameState || !currentPlayer) return;

    // Only current drawer can draw
    if (gameState.players[gameState.currentDrawerIndex].id !== currentPlayer.id) return;

    if (channelRef.current) {
        channelRef.current.send({
            type: 'broadcast',
            event: 'new_stroke',
            payload: stroke
        });
    }

    // Local update
    setGameState(prev => {
        if (!prev) return null;
        return { ...prev, strokes: [...prev.strokes, stroke] };
    });
  }, [gameState, currentPlayer]);

  const updateCurrentStroke = useCallback((points: {x: number, y: number}[]) => {
      if (!gameState || !currentPlayer) return;
      if (gameState.players[gameState.currentDrawerIndex].id !== currentPlayer.id) return;

      if (channelRef.current) {
          channelRef.current.send({
              type: 'broadcast',
              event: 'update_current_stroke',
              payload: points
          });
      }

      setGameState(prev => {
          if (!prev || prev.strokes.length === 0) return prev;
          const newStrokes = [...prev.strokes];
          newStrokes[newStrokes.length - 1] = {
              ...newStrokes[newStrokes.length - 1],
              points
          };
          return { ...prev, strokes: newStrokes };
      });
  }, [gameState, currentPlayer]);

  const submitGuess = useCallback((text: string) => {
    if (!gameState || !currentPlayer || gameState.status !== 'drawing') return;

    // Drawer cannot guess
    if (gameState.players[gameState.currentDrawerIndex].id === currentPlayer.id) return;

    // Already guessed correctly
    const player = gameState.players.find(p => p.id === currentPlayer.id);
    if (player?.hasGuessedCorrectly) return;

    const isCorrect = checkGuess(text, gameState.currentWord || '');
    const newGuess: Guess = {
      id: Math.random().toString(36).substr(2, 9),
      playerId: currentPlayer.id,
      playerName: currentPlayer.name,
      text: isCorrect ? 'Guessed correctly!' : text,
      isCorrect,
      timestamp: Date.now()
    };

    const newState = { ...gameState };
    newState.guesses = [...newState.guesses, newGuess];

    if (isCorrect) {
      newState.players = newState.players.map(p => {
        if (p.id === currentPlayer.id) {
          // Award points: faster guess = more points (max 500, min 100)
          const points = Math.max(100, Math.floor((gameState.timer / 60) * 500));
          return { ...p, score: p.score + points, hasGuessedCorrectly: true };
        }
        if (p.id === newState.players[newState.currentDrawerIndex].id) {
            // Drawer also gets points (e.g., 50 per correct guesser)
            return { ...p, score: p.score + 50 };
        }
        return p;
      });

      broadcastSound('success');
      toast({ title: "Correct!", description: "You found the word!" });
    } else {
      broadcastSound('error');
    }

    saveGameState(newState);
  }, [gameState, currentPlayer, saveGameState, broadcastSound]);

  const clearCanvas = useCallback(() => {
    if (!gameState || !currentPlayer) return;
    if (gameState.players[gameState.currentDrawerIndex].id !== currentPlayer.id) return;

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'clear_canvas',
        payload: {}
      });
    }

    setGameState(prev => prev ? { ...prev, strokes: [] } : null);
  }, [gameState, currentPlayer]);

  const undoStroke = useCallback(() => {
    if (!gameState || !currentPlayer) return;
    if (gameState.players[gameState.currentDrawerIndex].id !== currentPlayer.id) return;

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'undo_stroke',
        payload: {}
      });
    }

    setGameState(prev => prev ? { ...prev, strokes: prev.strokes.slice(0, -1) } : null);
  }, [gameState, currentPlayer]);

  const resetGame = useCallback(() => {
    if (storageKey) {
      localStorage.removeItem(storageKey);
      setGameState(null);
    }
    if (currentLobby?.id && currentPlayer) {
      const currentHouseRules = currentLobby.settings?.houseRules || {};
      supabase
        .from('lobbies')
        .update({
          house_rules: {
            ...currentHouseRules,
            pictionaryGameState: null
          }
        })
        .eq('id', currentLobby.id)
        .then(() => {
          window.location.reload();
        });
    }
  }, [storageKey, currentLobby, currentPlayer]);

  return (
    <PictionaryContext.Provider value={{
      gameState,
      startGame,
      startRound,
      drawStroke,
      updateCurrentStroke,
      submitGuess,
      clearCanvas,
      undoStroke,
      resetGame
    }}>
      {children}
    </PictionaryContext.Provider>
  );
};
