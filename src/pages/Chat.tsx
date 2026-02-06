import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Send, Users, Search, Plus, ChevronLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import PlayerAvatar from '@/components/PlayerAvatar';
import { useGame } from '@/contexts/GameContext';
import { useChat } from '@/contexts/ChatContext';
import { ChatRoom, ChatMessage } from '@/types/game';
import { cn } from '@/lib/utils';

const Chat: React.FC = () => {
  const { currentPlayer } = useGame();
  const { rooms, roomMessages, sendMessage, markAsRead } = useChat();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedRoom = rooms.find(r => r.id === selectedRoomId);
  const messages = selectedRoomId ? roomMessages[selectedRoomId] || [] : [];

  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, selectedRoomId]);

  useEffect(() => {
    if (selectedRoomId) {
      markAsRead(selectedRoomId);
    }
  }, [selectedRoomId, markAsRead, messages.length]);

  const handleSendMessage = () => {
    if (!inputValue.trim() || !currentPlayer || !selectedRoomId) return;
    
    sendMessage(
      selectedRoomId,
      inputValue.trim(),
      currentPlayer.name,
      currentPlayer.avatar
    );

    setInputValue('');
  };

  const handleSelectRoom = (roomId: string) => {
    setSelectedRoomId(roomId);
    setIsMobileChatOpen(true);
    markAsRead(roomId);
  };

  const formatTime = (date: Date | string | undefined) => {
    if (!date) return '';
    if (typeof date === 'string') return date;

    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = diff / 3600000;
    
    if (hours < 1) return 'Just now';
    if (hours < 24) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const filteredRooms = rooms.filter((room) =>
    room.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-5rem)] sm:h-screen flex overflow-hidden">
      {/* Sidebar - Room List */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className={cn(
          "w-full sm:w-80 flex-shrink-0 glass-card border-r border-border flex flex-col",
          isMobileChatOpen && "hidden sm:flex"
        )}
      >
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-bold gradient-text">Messages</h2>
            <Button variant="ghost" size="icon">
              <Plus className="w-5 h-5" />
            </Button>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="pl-10 bg-muted border-0"
            />
          </div>
        </div>

        {/* Room List */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {filteredRooms.map((room) => (
              <motion.button
                key={room.id}
                whileHover={{ x: 4 }}
                onClick={() => handleSelectRoom(room.id)}
                className={cn(
                  "w-full p-3 rounded-xl text-left transition-colors",
                  selectedRoomId === room.id
                    ? 'bg-primary/10 border border-primary/20'
                    : 'hover:bg-muted'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center text-xl">
                      {room.avatar.startsWith('http') ? (
                        <img src={room.avatar} alt={room.name} className="w-full h-full rounded-full" />
                      ) : (
                        room.avatar
                      )}
                    </div>
                    {room.isGroup && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                        <Users className="w-3 h-3 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground truncate">
                        {room.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(room.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {room.lastMessage || 'No messages yet'}
                    </p>
                  </div>
                  {room.unreadCount > 0 && (
                    <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-medium">
                      {room.unreadCount}
                    </span>
                  )}
                </div>
              </motion.button>
            ))}
          </div>
        </ScrollArea>
      </motion.div>

      {/* Main Chat Area */}
      <div className={cn(
        "flex-1 flex flex-col bg-background/50",
        !isMobileChatOpen && "hidden sm:flex"
      )}>
        {selectedRoom ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-border flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="sm:hidden"
                onClick={() => setIsMobileChatOpen(false)}
              >
                <ChevronLeft className="w-6 h-6" />
              </Button>
              <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-lg flex-shrink-0">
                {selectedRoom.avatar.startsWith('http') ? (
                  <img src={selectedRoom.avatar} alt={selectedRoom.name} className="w-full h-full rounded-full" />
                ) : (
                  selectedRoom.avatar
                )}
              </div>
              <div>
                <h3 className="font-display font-bold text-foreground">
                  {selectedRoom.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {selectedRoom.isGroup ? `${selectedRoom.memberCount || 2} members` : 'Online'}
                </p>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea ref={scrollRef} className="flex-1 p-4">
              <div className="space-y-4">
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm italic">
                    No messages yet. Say hello!
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`flex ${message.sender === currentPlayer?.name ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`flex items-start gap-3 max-w-[70%] ${
                          message.sender === currentPlayer?.name ? 'flex-row-reverse' : ''
                        }`}
                      >
                        <PlayerAvatar
                          avatar={message.avatar}
                          name={message.sender}
                          size="sm"
                          showName={false}
                        />
                        <div
                          className={`rounded-2xl px-4 py-2 ${
                            message.sender === currentPlayer?.name
                              ? 'bg-gradient-primary text-primary-foreground'
                              : 'bg-muted text-foreground'
                          }`}
                        >
                          {message.sender !== currentPlayer?.name && (
                            <p className="text-xs font-medium mb-1 opacity-70">
                              {message.sender}
                            </p>
                          )}
                          <p className="text-sm">{message.content}</p>
                          <p
                            className={`text-xs mt-1 ${
                              message.sender === currentPlayer?.name ? 'text-primary-foreground/70' : 'text-muted-foreground'
                            }`}
                          >
                            {formatTime(message.timestamp)}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t border-border">
              <div className="flex items-center gap-3">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Type a message..."
                  className="flex-1 bg-muted border-0"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim()}
                  className="btn-gaming px-4"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-display text-xl font-bold text-foreground mb-2">
                Select a conversation
              </h3>
              <p className="text-muted-foreground">
                Choose a chat room or start a new conversation
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
