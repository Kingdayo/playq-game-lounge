import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume2, PhoneOff, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVoice } from '@/contexts/VoiceContext';
import { useGame } from '@/contexts/GameContext';
import VoiceChat from './VoiceChat';
import { cn } from '@/lib/utils';

const VoiceControls: React.FC = () => {
  const { isConnected, isMuted, toggleMute, resumeAudio, participants } = useVoice();
  const { currentPlayer } = useGame();
  const [isOpen, setIsOpen] = useState(false);

  const isSpeaking = participants.find(p => p.id === currentPlayer?.id)?.isSpeaking;

  if (!isConnected) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-2">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="mb-2 w-72"
          >
            <VoiceChat />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-2">
        <Button
          variant={isMuted ? "destructive" : "secondary"}
          size="icon"
          className={cn(
            "rounded-full shadow-lg border border-white/10 relative",
            !isMuted && "hover:bg-primary/20"
          )}
          onClick={async () => {
            await resumeAudio();
            toggleMute();
          }}
        >
          {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          {!isMuted && isSpeaking && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-primary"
                animate={{ scale: [1, 2, 1], opacity: [0.8, 0, 0.8] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
          )}
        </Button>

        <Button
          variant="primary"
          size="icon"
          className="rounded-full shadow-lg btn-gaming"
          onClick={() => setIsOpen(!isOpen)}
        >
          <Settings className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default VoiceControls;
