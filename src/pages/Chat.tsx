import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, Users, Search, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import PlayerAvatar from '@/components/PlayerAvatar';
import { useGame } from '@/contexts/GameContext';

interface ChatRoom {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: Date;
  unread: number;
  avatar: string;
  isGroup: boolean;
}

interface Message {
  id: string;
  sender: string;
  avatar: string;
  content: string;
  timestamp: Date;
  isSelf: boolean;
}

const mockRooms: ChatRoom[] = [
  { id: '1', name: 'General', lastMessage: 'Anyone up for a game?', timestamp: new Date(), unread: 3, avatar: '🎮', isGroup: true },
  { id: '2', name: 'Uno Fans', lastMessage: 'That +4 was brutal!', timestamp: new Date(Date.now() - 3600000), unread: 0, avatar: '🃏', isGroup: true },
  { id: '3', name: 'ProGamer123', lastMessage: 'GG!', timestamp: new Date(Date.now() - 7200000), unread: 1, avatar: '🦊', isGroup: false },
  { id: '4', name: 'CardMaster', lastMessage: 'Rematch tomorrow?', timestamp: new Date(Date.now() - 86400000), unread: 0, avatar: '🐺', isGroup: false },
];

const mockMessages: Message[] = [
  { id: '1', sender: 'ProGamer123', avatar: '🦊', content: 'Hey everyone!', timestamp: new Date(Date.now() - 300000), isSelf: false },
  { id: '2', sender: 'CardMaster', avatar: '🐺', content: 'Anyone want to play Uno?', timestamp: new Date(Date.now() - 240000), isSelf: false },
  { id: '3', sender: 'You', avatar: '🎮', content: 'I\'m in! Create a lobby?', timestamp: new Date(Date.now() - 180000), isSelf: true },
  { id: '4', sender: 'ProGamer123', avatar: '🦊', content: 'Let\'s go! I\'ll create one now', timestamp: new Date(Date.now() - 120000), isSelf: false },
  { id: '5', sender: 'CardMaster', avatar: '🐺', content: 'Code is ABC123', timestamp: new Date(Date.now() - 60000), isSelf: false },
];

const Chat: React.FC = () => {
  const { currentPlayer } = useGame();
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(mockRooms[0]);
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const handleSendMessage = () => {
    if (!inputValue.trim() || !currentPlayer) return;
    
    const newMessage: Message = {
      id: crypto.randomUUID(),
      sender: 'You',
      avatar: currentPlayer.avatar,
      content: inputValue.trim(),
      timestamp: new Date(),
      isSelf: true,
    };
    
    setMessages((prev) => [...prev, newMessage]);
    setInputValue('');
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = diff / 3600000;
    
    if (hours < 1) return 'Just now';
    if (hours < 24) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const filteredRooms = mockRooms.filter((room) =>
    room.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-screen flex">
      {/* Sidebar - Room List */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-full sm:w-80 flex-shrink-0 glass-card border-r border-border flex flex-col"
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
                onClick={() => setSelectedRoom(room)}
                className={`w-full p-3 rounded-xl text-left transition-colors ${
                  selectedRoom?.id === room.id
                    ? 'bg-primary/10 border border-primary/20'
                    : 'hover:bg-muted'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center text-xl">
                      {room.avatar}
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
                      {room.lastMessage}
                    </p>
                  </div>
                  {room.unread > 0 && (
                    <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-medium">
                      {room.unread}
                    </span>
                  )}
                </div>
              </motion.button>
            ))}
          </div>
        </ScrollArea>
      </motion.div>

      {/* Main Chat Area */}
      <div className="hidden sm:flex flex-1 flex-col">
        {selectedRoom ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-border flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-lg">
                {selectedRoom.avatar}
              </div>
              <div>
                <h3 className="font-display font-bold text-foreground">
                  {selectedRoom.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {selectedRoom.isGroup ? '12 members' : 'Online'}
                </p>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`flex ${message.isSelf ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`flex items-start gap-3 max-w-[70%] ${
                        message.isSelf ? 'flex-row-reverse' : ''
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
                          message.isSelf
                            ? 'bg-gradient-primary text-primary-foreground'
                            : 'bg-muted text-foreground'
                        }`}
                      >
                        {!message.isSelf && (
                          <p className="text-xs font-medium mb-1 opacity-70">
                            {message.sender}
                          </p>
                        )}
                        <p className="text-sm">{message.content}</p>
                        <p
                          className={`text-xs mt-1 ${
                            message.isSelf ? 'text-primary-foreground/70' : 'text-muted-foreground'
                          }`}
                        >
                          {formatTime(message.timestamp)}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
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
