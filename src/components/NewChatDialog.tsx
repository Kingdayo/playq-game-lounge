import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Users, MessageSquare, Plus, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChat } from '@/contexts/ChatContext';
import { cn } from '@/lib/utils';

interface NewChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onChatCreated: (roomId: string) => void;
}

type Mode = 'choose' | 'direct' | 'group';

const NewChatDialog: React.FC<NewChatDialogProps> = ({ isOpen, onClose, onChatCreated }) => {
  const { searchUsers, createDirectChat, createGroupChat } = useChat();
  const [mode, setMode] = useState<Mode>('choose');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ player_id: string; name: string; avatar: string }>>([]);
  const [selectedMembers, setSelectedMembers] = useState<Array<{ player_id: string; name: string; avatar: string }>>([]);
  const [groupName, setGroupName] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setMode('choose');
      setSearchQuery('');
      setSearchResults([]);
      setSelectedMembers([]);
      setGroupName('');
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim() || mode === 'choose') {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const results = await searchUsers(searchQuery);
      setSearchResults(results);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchUsers, mode]);

  const handleDirectChat = async (user: { player_id: string; name: string; avatar: string }) => {
    setIsCreating(true);
    try {
      const roomId = await createDirectChat(user.player_id, user.name, user.avatar);
      onChatCreated(roomId);
      onClose();
    } catch (e) {
      console.error('Failed to create direct chat:', e);
    }
    setIsCreating(false);
  };

  const toggleMember = (user: { player_id: string; name: string; avatar: string }) => {
    setSelectedMembers(prev => {
      const exists = prev.find(m => m.player_id === user.player_id);
      if (exists) return prev.filter(m => m.player_id !== user.player_id);
      return [...prev, user];
    });
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedMembers.length === 0) return;
    setIsCreating(true);
    try {
      const roomId = await createGroupChat(groupName, selectedMembers.map(m => m.player_id));
      onChatCreated(roomId);
      onClose();
    } catch (e) {
      console.error('Failed to create group:', e);
    }
    setIsCreating(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md glass-card border border-border rounded-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="font-display text-lg font-bold gradient-text">
              {mode === 'choose' ? 'New Conversation' : mode === 'direct' ? 'New Chat' : 'New Group'}
            </h3>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Choose mode */}
          {mode === 'choose' && (
            <div className="p-4 space-y-3">
              <button
                onClick={() => setMode('direct')}
                className="w-full p-4 rounded-xl bg-muted hover:bg-muted/80 transition-colors flex items-center gap-4 text-left"
              >
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">New Chat</p>
                  <p className="text-sm text-muted-foreground">Start a conversation with a player</p>
                </div>
              </button>
              <button
                onClick={() => setMode('group')}
                className="w-full p-4 rounded-xl bg-muted hover:bg-muted/80 transition-colors flex items-center gap-4 text-left"
              >
                <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center">
                  <Users className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">New Group</p>
                  <p className="text-sm text-muted-foreground">Create a group chat with multiple players</p>
                </div>
              </button>
            </div>
          )}

          {/* Direct chat / Group member search */}
          {(mode === 'direct' || mode === 'group') && (
            <div className="flex flex-col max-h-[60vh]">
              {/* Group name input */}
              {mode === 'group' && (
                <div className="p-4 pb-0">
                  <Input
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Group name..."
                    className="bg-muted border-0 mb-3"
                  />
                  {/* Selected members */}
                  {selectedMembers.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {selectedMembers.map(m => (
                        <span
                          key={m.player_id}
                          onClick={() => toggleMember(m)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/20 text-primary text-sm cursor-pointer hover:bg-primary/30 transition-colors"
                        >
                          <span>{m.avatar}</span>
                          <span>{m.name}</span>
                          <X className="w-3 h-3" />
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Search input */}
              <div className="p-4 pt-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by username..."
                    className="pl-10 bg-muted border-0"
                    autoFocus
                  />
                </div>
              </div>

              {/* Results */}
              <ScrollArea className="flex-1 max-h-[300px]">
                <div className="px-4 pb-4 space-y-1">
                  {isSearching && (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {!isSearching && searchQuery && searchResults.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No users found matching "{searchQuery}"
                    </div>
                  )}
                  {!isSearching && searchResults.map(user => {
                    const isSelected = selectedMembers.some(m => m.player_id === user.player_id);
                    return (
                      <button
                        key={user.player_id}
                        onClick={() => mode === 'direct' ? handleDirectChat(user) : toggleMember(user)}
                        disabled={isCreating}
                        className={cn(
                          "w-full p-3 rounded-xl flex items-center gap-3 transition-colors text-left",
                          isSelected ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted'
                        )}
                      >
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg flex-shrink-0">
                          {user.avatar}
                        </div>
                        <span className="font-medium text-foreground flex-1">{user.name}</span>
                        {mode === 'group' && isSelected && (
                          <Check className="w-5 h-5 text-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>

              {/* Create group button */}
              {mode === 'group' && (
                <div className="p-4 border-t border-border">
                  <Button
                    onClick={handleCreateGroup}
                    disabled={!groupName.trim() || selectedMembers.length === 0 || isCreating}
                    className="w-full btn-gaming"
                  >
                    {isCreating ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    Create Group ({selectedMembers.length} members)
                  </Button>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default NewChatDialog;
