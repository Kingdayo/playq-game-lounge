import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { Send, Users, Search, Plus, ChevronLeft, MessageSquare, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import PlayerAvatar from '@/components/PlayerAvatar';
import { useGame } from '@/contexts/GameContext';
import { useChat, ChatRoom, ChatMessage } from '@/contexts/ChatContext';
import { cn } from '@/lib/utils';
import { Suspense, lazy } from 'react';

const NewChatDialog = lazy(() => import('@/components/NewChatDialog'));

const Chat: React.FC = () => {
  const { currentPlayer } = useGame();
  const {
    rooms,
    currentRoomMessages,
    activeRoomId,
    setActiveRoomId,
    sendMessage,
    markAsRead,
    loadRooms,
    deleteRoom,
  } = useChat();

  const [searchParams] = useSearchParams();
  const roomIdFromUrl = searchParams.get('roomId');
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [visibleMessagesCount, setVisibleMessagesCount] = useState(50);
  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedRoom = rooms.find(r => r.id === activeRoomId);

  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [currentRoomMessages, activeRoomId]);

  useEffect(() => {
    if (activeRoomId) {
      markAsRead(activeRoomId);
    }
  }, [activeRoomId, markAsRead, currentRoomMessages.length]);

  // Handle roomId from URL
  useEffect(() => {
    if (roomIdFromUrl && rooms.length > 0) {
      const roomExists = rooms.some(r => r.id === roomIdFromUrl);
      if (roomExists && activeRoomId !== roomIdFromUrl) {
        setActiveRoomId(roomIdFromUrl);
        setIsMobileChatOpen(true);
      }
    }
  }, [roomIdFromUrl, rooms, activeRoomId, setActiveRoomId]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !currentPlayer || !activeRoomId) return;
    const msg = inputValue.trim();
    setInputValue('');
    await sendMessage(activeRoomId, msg);
  };

  const handleSelectRoom = (roomId: string) => {
    setActiveRoomId(roomId);
    setIsMobileChatOpen(true);
    markAsRead(roomId);
    setVisibleMessagesCount(50); // Reset count when switching rooms
  };

  const handleChatCreated = (roomId: string) => {
    setActiveRoomId(roomId);
    setIsMobileChatOpen(true);
    loadRooms();
  };

  const formatTime = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = diff / 3600000;

    if (hours < 1) return 'Just now';
    if (hours < 24) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getRoomAvatar = (room: ChatRoom) => {
    if (room.type === 'direct' && room.otherParticipantAvatar) {
      return room.otherParticipantAvatar;
    }
    if (room.type === 'group') return '👥';
    if (room.type === 'lobby') return '🎮';
    return '💬';
  };

  const filteredRooms = rooms.filter((room) =>
    room.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeleteChat = async () => {
    if (roomToDelete) {
      await deleteRoom(roomToDelete);
      setRoomToDelete(null);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="h-[calc(100dvh-5rem)] sm:h-screen flex overflow-hidden">
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
            <Button variant="ghost" size="icon" onClick={() => setIsNewChatOpen(true)}>
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
            {filteredRooms.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No conversations yet</p>
                <p className="text-xs mt-1">Tap + to start a chat</p>
              </div>
            ) : (
              filteredRooms.map((room) => (
              <div key={room.id} className="relative overflow-hidden rounded-xl group">
                {/* Delete Background */}
                <div className="absolute inset-0 bg-destructive flex items-center justify-end px-6">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRoomToDelete(room.id);
                      setShowDeleteConfirm(true);
                    }}
                  >
                    <Trash2 className="w-5 h-5" />
                  </Button>
                </div>

                {/* Swipeable Chat Item */}
                <motion.button
                  drag="x"
                  dragConstraints={{ left: -80, right: 0 }}
                  dragElastic={0.1}
                  animate={{ x: roomToDelete === room.id ? -80 : 0 }}
                  transition={{ type: "spring", damping: 20, stiffness: 300 }}
                  onDragEnd={(_, info) => {
                    if (info.offset.x < -60) {
                      setRoomToDelete(room.id);
                      setShowDeleteConfirm(true);
                    }
                  }}
                  whileHover={{ x: roomToDelete === room.id ? -80 : (activeRoomId === room.id ? 0 : 4) }}
                  onClick={() => handleSelectRoom(room.id)}
                  className={cn(
                    "relative w-full p-3 rounded-xl text-left transition-colors bg-card",
                    activeRoomId === room.id
                      ? 'bg-primary/10 border border-primary/20'
                      : 'hover:bg-muted'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-xl">
                        {getRoomAvatar(room)}
                      </div>
                      {room.type === 'group' && (
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
                          {formatTime(room.lastMessageTime)}
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
              </div>
              ))
            )}
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
                onClick={() => {
                  setIsMobileChatOpen(false);
                  setActiveRoomId(null);
                }}
              >
                <ChevronLeft className="w-6 h-6" />
              </Button>
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg flex-shrink-0">
                {getRoomAvatar(selectedRoom)}
              </div>
              <div>
                <h3 className="font-display font-bold text-foreground">
                  {selectedRoom.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {selectedRoom.type === 'group' ? `${selectedRoom.memberCount || 2} members` : 'Direct message'}
                </p>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea ref={scrollRef} className="flex-1 p-4">
              <div className="space-y-4">
                {currentRoomMessages.length > visibleMessagesCount && (
                  <div className="flex justify-center pb-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setVisibleMessagesCount(prev => prev + 50)}
                      className="text-xs text-primary hover:bg-primary/10"
                    >
                      Load older messages
                    </Button>
                  </div>
                )}
                {currentRoomMessages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm italic pt-20">
                    No messages yet. Say hello!
                  </div>
                ) : (
                  currentRoomMessages.slice(-visibleMessagesCount).map((message, index) => {
                    const isMe = message.sender_id === currentPlayer?.id;
                    const isSystem = message.is_system;

                    if (isSystem) {
                      return (
                        <div key={message.id} className="text-center">
                          <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                            {message.content}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`flex items-start gap-3 max-w-[70%] ${isMe ? 'flex-row-reverse' : ''}`}
                        >
                          <PlayerAvatar
                            avatar={message.sender_avatar}
                            name={message.sender_name}
                            size="sm"
                            showName={false}
                          />
                          <div
                            className={cn(
                              "rounded-2xl px-4 py-2",
                              isMe
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-foreground'
                            )}
                          >
                            {!isMe && (
                              <p className="text-xs font-medium mb-1 opacity-70">
                                {message.sender_name}
                              </p>
                            )}
                            <p className="text-sm">{message.content}</p>
                            <p
                              className={cn(
                                "text-xs mt-1",
                                isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'
                              )}
                            >
                              {formatTime(message.created_at)}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
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
              <p className="text-muted-foreground mb-4">
                Choose a chat or start a new conversation
              </p>
              <Button onClick={() => setIsNewChatOpen(true)} className="btn-gaming">
                <Plus className="w-4 h-4 mr-2" />
                New Conversation
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* New Chat Dialog */}
      <Suspense fallback={null}>
        <NewChatDialog
          isOpen={isNewChatOpen}
          onClose={() => setIsNewChatOpen(false)}
          onChatCreated={handleChatCreated}
        />
      </Suspense>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={(open) => {
        setShowDeleteConfirm(open);
        if (!open) setRoomToDelete(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this conversation? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRoomToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteChat}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Chat;
