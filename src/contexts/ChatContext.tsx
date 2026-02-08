import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useGame } from '@/contexts/GameContext';

export interface ChatRoom {
  id: string;
  name: string;
  type: 'direct' | 'group' | 'lobby';
  created_by: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
  memberCount?: number;
  otherParticipantName?: string;
  otherParticipantAvatar?: string;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar: string;
  content: string;
  is_system: boolean;
  created_at: string;
}

interface ChatContextType {
  rooms: ChatRoom[];
  currentRoomMessages: ChatMessage[];
  activeRoomId: string | null;
  setActiveRoomId: (id: string | null) => void;
  sendMessage: (roomId: string, content: string) => Promise<void>;
  loadRooms: () => Promise<void>;
  loadMessages: (roomId: string) => Promise<void>;
  createDirectChat: (targetPlayerId: string, targetName: string, targetAvatar: string) => Promise<string>;
  createGroupChat: (name: string, memberIds: string[]) => Promise<string>;
  searchUsers: (query: string) => Promise<Array<{ player_id: string; name: string; avatar: string }>>;
  getUnreadTotal: () => number;
  markAsRead: (roomId: string) => void;
  isLoading: boolean;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentPlayer } = useGame();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [currentRoomMessages, setCurrentRoomMessages] = useState<ChatMessage[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [readRooms, setReadRooms] = useState<Set<string>>(new Set());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Ensure profile exists for current player
  useEffect(() => {
    if (!currentPlayer) return;
    const upsertProfile = async () => {
      await supabase
        .from('profiles')
        .upsert(
          {
            player_id: currentPlayer.id,
            name: currentPlayer.name,
            avatar: currentPlayer.avatar,
            last_seen: new Date().toISOString(),
          },
          { onConflict: 'player_id' }
        );
    };
    upsertProfile();
  }, [currentPlayer]);

  const loadRooms = useCallback(async () => {
    if (!currentPlayer) return;

    // Get rooms the player is a participant of
    const { data: participations } = await supabase
      .from('chat_participants')
      .select('room_id')
      .eq('player_id', currentPlayer.id);

    if (!participations || participations.length === 0) {
      setRooms([]);
      return;
    }

    const roomIds = participations.map(p => p.room_id);

    const { data: roomRows } = await supabase
      .from('chat_rooms')
      .select('*')
      .in('id', roomIds);

    if (!roomRows) {
      setRooms([]);
      return;
    }

    // Get participant info for each room
    const { data: allParticipants } = await supabase
      .from('chat_participants')
      .select('room_id, player_id')
      .in('room_id', roomIds);

    // Get last message per room
    const { data: lastMessages } = await supabase
      .from('chat_messages')
      .select('room_id, content, created_at')
      .in('room_id', roomIds)
      .order('created_at', { ascending: false });

    // Get profiles for other participants in direct chats
    const otherPlayerIds = new Set<string>();
    roomRows.forEach(room => {
      if (room.type === 'direct') {
        const participants = (allParticipants || []).filter(p => p.room_id === room.id);
        participants.forEach(p => {
          if (p.player_id !== currentPlayer.id) otherPlayerIds.add(p.player_id);
        });
      }
    });

    let profileMap: Record<string, { name: string; avatar: string }> = {};
    if (otherPlayerIds.size > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('player_id, name, avatar')
        .in('player_id', Array.from(otherPlayerIds));
      if (profiles) {
        profiles.forEach(p => {
          profileMap[p.player_id] = { name: p.name, avatar: p.avatar };
        });
      }
    }

    // Build room objects with deduplication for last messages
    const lastMessageMap: Record<string, { content: string; created_at: string }> = {};
    (lastMessages || []).forEach(msg => {
      if (!lastMessageMap[msg.room_id]) {
        lastMessageMap[msg.room_id] = { content: msg.content, created_at: msg.created_at };
      }
    });

    const mappedRooms: ChatRoom[] = roomRows.map(room => {
      const participants = (allParticipants || []).filter(p => p.room_id === room.id);
      const otherParticipant = participants.find(p => p.player_id !== currentPlayer.id);
      const profile = otherParticipant ? profileMap[otherParticipant.player_id] : undefined;
      const lastMsg = lastMessageMap[room.id];

      return {
        id: room.id,
        name: room.type === 'direct' && profile ? profile.name : (room.name || 'Unnamed Group'),
        type: room.type as ChatRoom['type'],
        created_by: room.created_by,
        lastMessage: lastMsg?.content,
        lastMessageTime: lastMsg?.created_at,
        unreadCount: 0, // Will be managed client-side
        memberCount: participants.length,
        otherParticipantName: profile?.name,
        otherParticipantAvatar: profile?.avatar,
      };
    });

    // Sort by last message time
    mappedRooms.sort((a, b) => {
      const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      return timeB - timeA;
    });

    setRooms(mappedRooms);
  }, [currentPlayer]);

  const loadMessages = useCallback(async (roomId: string) => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(200);

    setCurrentRoomMessages(data || []);
  }, []);

  const sendMessage = useCallback(async (roomId: string, content: string) => {
    if (!currentPlayer || !content.trim()) return;

    await supabase
      .from('chat_messages')
      .insert({
        room_id: roomId,
        sender_id: currentPlayer.id,
        sender_name: currentPlayer.name,
        sender_avatar: currentPlayer.avatar,
        content: content.trim(),
        is_system: false,
      });
  }, [currentPlayer]);

  const createDirectChat = useCallback(async (targetPlayerId: string, targetName: string, targetAvatar: string): Promise<string> => {
    if (!currentPlayer) throw new Error('No player');

    // Check if a direct chat already exists between these two users
    const { data: myRooms } = await supabase
      .from('chat_participants')
      .select('room_id')
      .eq('player_id', currentPlayer.id);

    const { data: theirRooms } = await supabase
      .from('chat_participants')
      .select('room_id')
      .eq('player_id', targetPlayerId);

    if (myRooms && theirRooms) {
      const myRoomIds = new Set(myRooms.map(r => r.room_id));
      const commonRoomIds = theirRooms.filter(r => myRoomIds.has(r.room_id)).map(r => r.room_id);

      if (commonRoomIds.length > 0) {
        // Check if any of these common rooms is a direct chat
        const { data: directRooms } = await supabase
          .from('chat_rooms')
          .select('id')
          .in('id', commonRoomIds)
          .eq('type', 'direct');

        if (directRooms && directRooms.length > 0) {
          return directRooms[0].id;
        }
      }
    }

    // Create new direct chat room
    const { data: room, error } = await supabase
      .from('chat_rooms')
      .insert({
        type: 'direct',
        name: null,
        created_by: currentPlayer.id,
      })
      .select()
      .single();

    if (error || !room) throw new Error('Failed to create chat room');

    // Add both participants
    await supabase.from('chat_participants').insert([
      { room_id: room.id, player_id: currentPlayer.id },
      { room_id: room.id, player_id: targetPlayerId },
    ]);

    await loadRooms();
    return room.id;
  }, [currentPlayer, loadRooms]);

  const createGroupChat = useCallback(async (name: string, memberIds: string[]): Promise<string> => {
    if (!currentPlayer) throw new Error('No player');

    const { data: room, error } = await supabase
      .from('chat_rooms')
      .insert({
        type: 'group',
        name,
        created_by: currentPlayer.id,
      })
      .select()
      .single();

    if (error || !room) throw new Error('Failed to create group');

    // Add all members including the creator
    const allMembers = [currentPlayer.id, ...memberIds.filter(id => id !== currentPlayer.id)];
    await supabase.from('chat_participants').insert(
      allMembers.map(playerId => ({ room_id: room.id, player_id: playerId }))
    );

    // Send a system message
    await supabase.from('chat_messages').insert({
      room_id: room.id,
      sender_id: currentPlayer.id,
      sender_name: 'System',
      sender_avatar: '🎮',
      content: `${currentPlayer.name} created the group "${name}"`,
      is_system: true,
    });

    await loadRooms();
    return room.id;
  }, [currentPlayer, loadRooms]);

  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim() || !currentPlayer) return [];

    const { data } = await supabase
      .from('profiles')
      .select('player_id, name, avatar')
      .ilike('name', `%${query}%`)
      .neq('player_id', currentPlayer.id)
      .limit(20);

    return data || [];
  }, [currentPlayer]);

  const markAsRead = useCallback((roomId: string) => {
    setReadRooms(prev => new Set(prev).add(roomId));
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, unreadCount: 0 } : r));
  }, []);

  const deleteRoom = useCallback((roomId: string) => {
    setRooms(prev => prev.filter(r => r.id !== roomId));
    if (activeRoomId === roomId) {
      setCurrentRoomMessages([]);
      setActiveRoomId(null);
    }
  }, [activeRoomId]);

  const getUnreadTotal = useCallback(() => {
    return rooms.reduce((acc, room) => acc + room.unreadCount, 0);
  }, [rooms]);

  // Load rooms on mount and when player changes
  useEffect(() => {
    if (currentPlayer) {
      loadRooms();
    }
  }, [currentPlayer, loadRooms]);

  // Load messages when active room changes
  useEffect(() => {
    if (activeRoomId) {
      loadMessages(activeRoomId);
      markAsRead(activeRoomId);
    } else {
      setCurrentRoomMessages([]);
    }
  }, [activeRoomId, loadMessages, markAsRead]);

  // Real-time subscription for new messages
  useEffect(() => {
    if (!currentPlayer) return;

    // Clean up previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel('chat-messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;

          // If this message is in the active room, append it
          if (newMsg.room_id === activeRoomId) {
            setCurrentRoomMessages(prev => {
              // Prevent duplicates
              if (prev.find(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          } else {
            // Increment unread count for the room
            setRooms(prev => prev.map(r => {
              if (r.id === newMsg.room_id && newMsg.sender_id !== currentPlayer.id) {
                return { ...r, unreadCount: r.unreadCount + 1 };
              }
              return r;
            }));
          }

          // Update last message in rooms list
          setRooms(prev => prev.map(r => {
            if (r.id === newMsg.room_id) {
              return {
                ...r,
                lastMessage: newMsg.content,
                lastMessageTime: newMsg.created_at,
              };
            }
            return r;
          }));
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentPlayer, activeRoomId]);

  return (
    <ChatContext.Provider value={{
      rooms,
      currentRoomMessages,
      activeRoomId,
      setActiveRoomId,
      sendMessage,
      loadRooms,
      loadMessages,
      createDirectChat,
      createGroupChat,
      searchUsers,
      getUnreadTotal,
      markAsRead,
      isLoading,
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
