import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume2, VolumeX, Phone, PhoneOff, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useVoice } from '@/contexts/VoiceContext';
import { useGame } from '@/contexts/GameContext';

const VoiceChat: React.FC = () => {
  const {
    isConnected,
    isConnecting,
    isMuted,
    volume,
    participants,
    connect,
    disconnect,
    toggleMute,
    setVolume,
    error
  } = useVoice();

  const { currentLobby, currentPlayer } = useGame();

  const handleConnect = () => {
    if (currentLobby && currentPlayer) {
      connect(`voice-lobby-${currentLobby.code}`, currentPlayer);
    }
  };

  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-display text-sm font-bold text-foreground">Voice Chat</h4>
        {isConnected ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex items-center gap-2"
          >
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs text-success">Connected</span>
          </motion.div>
        ) : isConnecting ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2"
          >
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs text-primary">Connecting...</span>
          </motion.div>
        ) : (
          <span className="text-xs text-muted-foreground">Disconnected</span>
        )}
      </div>

      {error && (
        <div className="mb-4 p-2 rounded bg-destructive/10 border border-destructive/20 flex items-start gap-2 text-xs text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* User list */}
      <AnimatePresence mode="popLayout">
        {isConnected && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2 mb-4"
          >
            {participants.map((user) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                  user.isSpeaking ? 'bg-primary/10' : 'bg-muted/50'
                }`}
              >
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center text-sm">
                    {user.avatar}
                  </div>
                  {user.isSpeaking && (
                    <motion.div
                      className="absolute -inset-1 rounded-full border-2 border-primary"
                      animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                  )}
                </div>
                <span className="text-sm font-medium flex-1 truncate">{user.name}</span>
                {user.isMuted && (
                  <MicOff className="w-4 h-4 text-destructive" />
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <div className="space-y-4">
        {isConnected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {/* Volume control */}
            <div className="flex items-center gap-3">
              {volume === 0 ? (
                <VolumeX className="w-4 h-4 text-muted-foreground" />
              ) : (
                <Volume2 className="w-4 h-4 text-muted-foreground" />
              )}
              <Slider
                value={[volume]}
                onValueChange={(values) => setVolume(values[0])}
                max={100}
                step={1}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground w-8">
                {volume}%
              </span>
            </div>

            {/* Mute button */}
            <Button
              variant={isMuted ? 'destructive' : 'outline'}
              onClick={toggleMute}
              className="w-full"
            >
              {isMuted ? (
                <>
                  <MicOff className="w-4 h-4 mr-2" />
                  Unmute
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 mr-2" />
                  Mute
                </>
              )}
            </Button>
          </motion.div>
        )}

        {/* Connect/Disconnect button */}
        <Button
          variant={isConnected ? 'destructive' : 'default'}
          onClick={isConnected ? disconnect : handleConnect}
          disabled={isConnecting}
          className={`w-full ${!isConnected && !isConnecting ? 'btn-gaming' : ''}`}
        >
          {isConnected ? (
            <>
              <PhoneOff className="w-4 h-4 mr-2" />
              Leave Voice
            </>
          ) : isConnecting ? (
            <>
              <Phone className="w-4 h-4 mr-2 animate-pulse" />
              Connecting...
            </>
          ) : (
            <>
              <Phone className="w-4 h-4 mr-2" />
              Join Voice
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default VoiceChat;
