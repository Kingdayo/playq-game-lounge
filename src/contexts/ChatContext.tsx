import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { ChatMessage, ChatRoom } from '@/types/game';

interface ChatContextType {
  rooms: ChatRoom[];
  roomMessages: Record<string, ChatMessage[]>;
  sendMessage: (roomId: string, content: string, sender: string, avatar: string, isSystem?: boolean) => void;
  markAsRead: (roomId: string) => void;
  getUnreadTotal: () => number;
  getRoom: (roomId: string) => ChatRoom | undefined;
  createLobbyRoom: (code: string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const initialRooms: ChatRoom[] = [
  {
    id: 'general',
    name: 'General',
    unreadCount: 0,
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=General',
    isGroup: true,
    memberCount: 12
  },
  {
    id: 'uno-fans',
    name: 'Uno Fans',
    unreadCount: 0,
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Uno',
    isGroup: true,
    memberCount: 8
  },
  {
    id: 'progamer123',
    name: 'ProGamer123',
    unreadCount: 0,
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ProGamer123',
    isGroup: false
  }
];

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [rooms, setRooms] = useState<ChatRoom[]>(initialRooms);
  const [roomMessages, setRoomMessages] = useState<Record<string, ChatMessage[]>>({});

  const sendMessage = useCallback((roomId: string, content: string, sender: string, avatar: string, isSystem = false) => {
    const newMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sender,
      avatar,
      content,
      timestamp: new Date(),
      isSystem
    };

    setRoomMessages(prev => ({
      ...prev,
      [roomId]: [...(prev[roomId] || []), newMessage]
    }));

    setRooms(prevRooms => prevRooms.map(room => {
      if (room.id === roomId) {
        return {
          ...room,
          lastMessage: content,
          timestamp: 'Just now',
          unreadCount: room.unreadCount + (isSystem ? 0 : 1) // Simple unread logic
        };
      }
      return room;
    }));
  }, []);

  useEffect(() => {
    // Simulate incoming messages to test "real-time" updates
    const timers: NodeJS.Timeout[] = [];

    // Message 1 at 2s (General) - System message (no badge)
    timers.push(setTimeout(() => {
      sendMessage('general', 'Welcome to the real-time chat! 🚀', 'System', '🎮', true);
    }, 2000));

    // Message 2 at 5s (ProGamer123) - Normal message (SHOULD show badge)
    timers.push(setTimeout(() => {
      sendMessage(
        'progamer123',
        'Hey! Ready for the tournament?',
        'ProGamer123',
        'https://api.dicebear.com/7.x/avataaars/svg?seed=ProGamer123',
        false
      );
    }, 5000));

    return () => timers.forEach(t => clearTimeout(t));
  }, [sendMessage]);

  const markAsRead = useCallback((roomId: string) => {
    setRooms(prevRooms => prevRooms.map(room => {
      if (room.id === roomId) {
        return { ...room, unreadCount: 0 };
      }
      return room;
    }));
  }, []);

  const getUnreadTotal = useCallback(() => {
    return rooms.reduce((acc, room) => acc + room.unreadCount, 0);
  }, [rooms]);

  const getRoom = useCallback((roomId: string) => {
    return rooms.find(r => r.id === roomId);
  }, [rooms]);

  const createLobbyRoom = useCallback((code: string) => {
    setRooms(prev => {
      if (prev.find(r => r.id === `lobby-${code}`)) return prev;
      return [
        ...prev,
        {
          id: `lobby-${code}`,
          name: `Lobby: ${code}`,
          unreadCount: 0,
          avatar: '🎮',
          isGroup: true,
          memberCount: 1
        }
      ];
    });
  }, []);

  return (
    <ChatContext.Provider value={{
      rooms,
      roomMessages,
      sendMessage,
      markAsRead,
      getUnreadTotal,
      getRoom,
      createLobbyRoom
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
