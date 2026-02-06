import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Copy, 
  Check, 
  Play, 
  Users, 
  Settings as SettingsIcon, 
  MessageSquare,
  ArrowLeft,
  Crown
} from 'lucide-react';
import CircularProgress from '@mui/material/CircularProgress';
import Skeleton from '@mui/material/Skeleton';
import { GamingButton } from '@/components/GamingButton';
import { Button } from '@/components/ui/button';
import PlayerAvatar from '@/components/PlayerAvatar';
import VoiceChat from '@/components/VoiceChat';
import ChatPanel from '@/components/ChatPanel';
import { useGame } from '@/contexts/GameContext';
import { useChat } from '@/contexts/ChatContext';
import { useUno } from '@/contexts/UnoContext';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const Lobby: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { currentLobby, currentPlayer, setPlayerReady, leaveLobby, startGame: startLobbyGame } = useGame();
  const { sendMessage, roomMessages, createLobbyRoom } = useChat();
  const { startGame: startUnoGame } = useUno();
  
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [voiceConnected, setVoiceConnected] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [voiceVolume, setVoiceVolume] = useState(75);

  const roomId = code ? `lobby-${code}` : '';
  const messages = roomId ? roomMessages[roomId] || [] : [];

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setIsLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (code) {
      createLobbyRoom(code);
    }
  }, [code, createLobbyRoom]);

  // Handle game start synchronization
  useEffect(() => {
    if (currentLobby?.status === 'in-progress') {
      navigate(`/game/${currentLobby.gameType}/${code}`);
    }
  }, [currentLobby?.status, currentLobby?.gameType, code, navigate]);

  const handleCopyCode = () => {
    if (code) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSendMessage = (content: string) => {
    if (!currentPlayer || !roomId) return;
    
    sendMessage(
      roomId,
      content,
      currentPlayer.name,
      currentPlayer.avatar
    );
  };

  const handleStartGame = async () => {
    if (!currentLobby) return;

    try {
      if (currentLobby.gameType === 'uno') {
        startUnoGame();
      }
      await startLobbyGame();
    } catch (error) {
      console.error('Failed to start game:', error);
    }
  };

  const handleLeaveLobby = () => {
    leaveLobby();
    navigate('/');
  };

  const allPlayersReady = currentLobby?.players.every((p) => p.isReady) || false;
  const canStartGame = currentPlayer?.isHost && allPlayersReady && (currentLobby?.players.length || 0) >= 2;

  const gameInfo = {
    uno: { name: 'Uno', color: 'from-red-500 to-orange-500', minPlayers: 2 },
    pictionary: { name: 'Pictionary', color: 'from-purple-500 to-pink-500', minPlayers: 4 },
    ludo: { name: 'Ludo', color: 'from-cyan-500 to-blue-500', minPlayers: 2 },
    dominoes: { name: 'Dominoes', color: 'from-green-500 to-teal-500', minPlayers: 2 },
  };

  const currentGame = currentLobby ? gameInfo[currentLobby.gameType] : null;

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <CircularProgress
          size={60}
          thickness={2}
          sx={{ color: 'hsl(187, 100%, 50%)' }}
        />
        <p className="mt-4 text-muted-foreground">Loading lobby...</p>
      </div>
    );
  }

  if (!currentLobby) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h2 className="font-display text-2xl font-bold text-foreground mb-4">
            Lobby Not Found
          </h2>
          <p className="text-muted-foreground mb-6">
            This lobby doesn't exist or has expired.
          </p>
          <GamingButton variant="primary" onClick={() => navigate('/')}>
            Back to Home
          </GamingButton>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button
            variant="ghost"
            onClick={handleLeaveLobby}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Leave
          </Button>
          
          <div className="flex items-center gap-4">
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
          </div>
        </div>

        {/* Game Info */}
        <motion.div
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          className="glass-card rounded-2xl p-6 mb-6 text-center"
        >
          <span
            className={`inline-block px-4 py-2 rounded-full bg-gradient-to-r ${currentGame?.color} text-white font-medium mb-4`}
          >
            {currentGame?.name}
          </span>
          
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">
            Game Lobby
          </h1>
          
          {/* Lobby Code */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="font-display text-4xl tracking-[0.3em] font-bold gradient-text">
              {code}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopyCode}
              className="h-10 w-10"
            >
              <AnimatePresence mode="wait">
                {copied ? (
                  <motion.div
                    key="check"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <Check className="w-4 h-4 text-success" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="copy"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <Copy className="w-4 h-4" />
                  </motion.div>
                )}
              </AnimatePresence>
            </Button>
          </div>
          
          <p className="text-muted-foreground">
            Share this code with friends to join
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Players */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2"
          >
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-xl font-bold flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Players ({currentLobby.players.length}/{currentLobby.settings.maxPlayers})
                </h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {currentLobby.players.map((player, index) => (
                  <motion.div
                    key={player.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 + index * 0.1 }}
                    className="glass-card rounded-xl p-4 text-center"
                  >
                    <PlayerAvatar
                      avatar={player.avatar}
                      name={player.name}
                      isReady={player.isReady}
                      isHost={player.isHost}
                      size="lg"
                    />
                  </motion.div>
                ))}

                {/* Empty slots */}
                {Array.from({
                  length: Math.max(0, 4 - currentLobby.players.length),
                }).map((_, index) => (
                  <motion.div
                    key={`empty-${index}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    className="glass-card rounded-xl p-4 flex items-center justify-center border-2 border-dashed border-muted"
                  >
                    <div className="text-center text-muted-foreground">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <span className="text-xs">Waiting...</span>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Ready toggle */}
              {!currentPlayer?.isHost && (
                <div className="flex items-center justify-center gap-3 mt-6 pt-6 border-t border-border">
                  <Label htmlFor="ready-toggle" className="text-sm">
                    Ready to play?
                  </Label>
                  <Switch
                    id="ready-toggle"
                    checked={currentPlayer?.isReady || false}
                    onCheckedChange={(checked) => setPlayerReady(checked)}
                  />
                </div>
              )}

              {/* Start game button */}
              {currentPlayer?.isHost && (
                <div className="mt-6 pt-6 border-t border-border">
                  <GamingButton
                    variant="success"
                    size="lg"
                    className="w-full"
                    onClick={handleStartGame}
                    disabled={!canStartGame}
                    pulseEffect={canStartGame}
                  >
                    <Play className="w-5 h-5" />
                    {!allPlayersReady
                      ? 'Waiting for players...'
                      : currentLobby.players.length < 2
                      ? 'Need more players...'
                      : 'Start Game'}
                  </GamingButton>
                  {!allPlayersReady && (
                    <p className="text-center text-muted-foreground text-sm mt-2">
                      All players must be ready to start
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.div>

          {/* Side panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            {/* Voice Chat */}
            <VoiceChat
              isConnected={voiceConnected}
              isMuted={voiceMuted}
              volume={voiceVolume}
              users={currentLobby.players.map((p) => ({
                id: p.id,
                name: p.name,
                avatar: p.avatar,
                isSpeaking: false,
                isMuted: p.id === currentPlayer?.id ? voiceMuted : false,
              }))}
              onConnect={() => setVoiceConnected(true)}
              onDisconnect={() => setVoiceConnected(false)}
              onToggleMute={() => setVoiceMuted(!voiceMuted)}
              onVolumeChange={setVoiceVolume}
            />

            {/* Game Settings */}
            <div className="glass-card rounded-xl p-4">
              <h3 className="font-display text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <SettingsIcon className="w-4 h-4" />
                Game Settings
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Max Players</span>
                  <span className="text-foreground">{currentLobby.settings.maxPlayers}</span>
                </div>
                {currentLobby.settings.timeLimit && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Time Limit</span>
                    <span className="text-foreground">{currentLobby.settings.timeLimit}s</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>

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

export default Lobby;
