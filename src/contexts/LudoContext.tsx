import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { LudoGameState, initializeGame, moveToken, getLegalMoves, skipTurn } from '../lib/ludo';
import { useGame } from './GameContext';
import { useSound } from './SoundContext';
import { SoundName } from '@/types/game';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { sendPushToPlayers } from '@/hooks/usePushNotifications';

interface LudoContextType {
  gameState: LudoGameState | null;
  rollDice: () => void;
  selectToken: (tokenId: string) => void;
  startGame: () => void;
  resetGame: () => void;
}

const LudoContext = createContext<LudoContextType | undefined>(undefined);

export const useLudo = () => {
  const context = useContext(LudoContext);
  if (!context) {
    throw new Error('useLudo must be used within a LudoProvider');
  }
  return context;
};

export const LudoProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentLobby, currentPlayer } = useGame();
  const { playSound, playBGM, stopBGM } = useSound();
  const [gameState, setGameState] = useState<LudoGameState | null>(null);
  const gameStateRef = useRef<LudoGameState | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastPersistenceRef = useRef<number>(0);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const lobbyCode = currentLobby?.code;
  const storageKey = lobbyCode ? `playq-ludo-game-${lobbyCode}` : null;

  // Sync state with others via Supabase Broadcast
  useEffect(() => {
    if (!lobbyCode || !currentPlayer) return;

    const channel = supabase.channel(`ludo-game-${lobbyCode}`, {
        config: {
            broadcast: { self: false }
        }
    });

    channel
        .on('broadcast', { event: 'state_update' }, ({ payload }) => {
            console.log('Received LUDO state update:', payload);
            setGameState(payload);
        })
        .on('broadcast', { event: 'play_sound' }, ({ payload }: { payload: { soundName: SoundName } }) => {
            playSound(payload.soundName);
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

  const saveGameState = useCallback((newState: LudoGameState) => {
    setGameState(newState);
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(newState));
    }

    if (channelRef.current) {
        channelRef.current.send({
            type: 'broadcast',
            event: 'state_update',
            payload: newState
        });
    }

    // Throttle DB updates to once every 3 seconds unless the game is finished
    const now = Date.now();
    if (currentLobby?.id && currentPlayer && (now - lastPersistenceRef.current > 3000 || newState.status === 'finished')) {
        lastPersistenceRef.current = now;
        const currentHouseRules = currentLobby.settings?.houseRules || {};
        supabase
            .from('lobbies')
            .update({
                house_rules: {
                    ...currentHouseRules,
                    ludoGameState: newState
                } as any
            })
            .eq('id', currentLobby.id)
            .then(({ error }) => {
                if (error) console.error('Failed to persist LUDO state to Supabase:', error);
            });
    }
  }, [storageKey, channelRef, currentLobby, currentPlayer]);

  useEffect(() => {
    const dbState = currentLobby?.settings?.houseRules?.ludoGameState as LudoGameState | undefined;
    if (dbState && !gameState) {
      setGameState(dbState);
    }
  }, [currentLobby?.settings?.houseRules?.ludoGameState, gameState]);

  useEffect(() => {
    if (gameState && gameState.status === 'playing') {
      playBGM('ludo');
    } else if (!gameState || gameState.status === 'finished') {
      stopBGM();
    }
  }, [gameState?.status, playBGM, stopBGM, gameState]);

  const startGame = useCallback(() => {
    if (!currentLobby || !currentPlayer?.isHost) return;

    const players = currentLobby.players.map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar
    }));

    const newState = initializeGame(currentLobby.code, players);
    saveGameState(newState);
    broadcastSound('move');

    toast({
      title: "Ludo Started!",
      description: "May the dice be with you!",
    });
  }, [currentLobby, currentPlayer, saveGameState, broadcastSound]);

  const rollDice = useCallback(() => {
    if (!gameState || !currentPlayer || gameState.isRolling) return;

    const playerIndex = gameState.players.findIndex(p => p.id === currentPlayer.id);
    if (playerIndex !== gameState.currentPlayerIndex) {
      toast({ title: "Not your turn!", variant: "destructive" });
      return;
    }

    if (gameState.diceValue !== null) {
        toast({ title: "Already rolled!", variant: "destructive" });
        return;
    }

    // Start rolling animation - broadcast so others see it
    saveGameState({ ...gameState, isRolling: true });
    broadcastSound('dice');

    // Simulate rolling delay
    setTimeout(() => {
        const diceValue = Math.floor(Math.random() * 6) + 1;
        const stateAfterRoll = { ...gameStateRef.current!, isRolling: false, diceValue };

        const legalMoves = getLegalMoves(stateAfterRoll);
        if (legalMoves.length === 0) {
            stateAfterRoll.lastActionMessage = `${currentPlayer.name} rolled a ${diceValue} but has no legal moves.`;
            // Save state first so everyone sees the dice value and the message
            saveGameState(stateAfterRoll);

            toast({ title: `Rolled ${diceValue}`, description: "No legal moves available." });

            // Wait a bit before skipping turn
            setTimeout(() => {
                const stateAfterSkip = skipTurn(gameStateRef.current!);
                saveGameState(stateAfterSkip);

                // Notify next player via push
                if (stateAfterSkip.currentPlayerIndex !== playerIndex && stateAfterSkip.status === 'playing') {
                  const nextPlayer = stateAfterSkip.players[stateAfterSkip.currentPlayerIndex];
                  sendPushToPlayers([nextPlayer.id], {
                    title: '🎲 Your Turn!',
                    body: `It's your turn in Ludo! ${currentPlayer.name} had no legal moves.`,
                    tag: 'ludo-turn',
                    data: { type: 'turn', gameType: 'ludo', lobbyCode }
                  });
                }
            }, 2000);
        } else {
            stateAfterRoll.lastActionMessage = `${currentPlayer.name} rolled a ${diceValue}.`;
            saveGameState(stateAfterRoll);
        }
    }, 800);
  }, [gameState, currentPlayer, saveGameState, broadcastSound]);

  const selectToken = useCallback((tokenId: string) => {
    if (!gameState || !currentPlayer) return;

    const playerIndex = gameState.players.findIndex(p => p.id === currentPlayer.id);
    if (playerIndex !== gameState.currentPlayerIndex) return;

    if (gameState.diceValue === null || gameState.isRolling) return;

    const legalMoves = getLegalMoves(gameState);
    if (!legalMoves.includes(tokenId)) {
        toast({ title: "Invalid move!", variant: "destructive" });
        return;
    }

    const newState = moveToken(gameState, tokenId);
    saveGameState(newState);

    if (newState.status === 'finished') {
        broadcastSound('win');
    } else {
        broadcastSound('move');

        // Notify next player via push if turn changed
        if (newState.currentPlayerIndex !== playerIndex && newState.status === 'playing') {
          const nextPlayer = newState.players[newState.currentPlayerIndex];
          sendPushToPlayers([nextPlayer.id], {
            title: '🎲 Your Turn!',
            body: `It's your turn in Ludo! ${currentPlayer.name} moved a token.`,
            tag: 'ludo-turn',
            data: { type: 'turn', gameType: 'ludo', lobbyCode }
          });
        }
    }
  }, [gameState, currentPlayer, saveGameState, broadcastSound, lobbyCode]);

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
                    ludoGameState: null
                }
            })
            .eq('id', currentLobby.id)
            .then(() => {
                window.location.reload();
            });
    }
  }, [storageKey, currentLobby, currentPlayer]);

  return (
    <LudoContext.Provider value={{
      gameState,
      rollDice,
      selectToken,
      startGame,
      resetGame
    }}>
      {children}
    </LudoContext.Provider>
  );
};
