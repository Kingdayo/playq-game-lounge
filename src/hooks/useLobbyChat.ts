import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useGame } from '@/contexts/GameContext';
import { useNotifications } from '@/hooks/useNotifications';
import { sendPushToPlayers } from '@/hooks/usePushNotifications';

interface LobbyMessage {
  id: string;
  sender: string;
  avatar: string;
  content: string;
  timestamp: Date;
  isSystem?: boolean;
}

/**
 * Hook for in-lobby chat using Supabase real-time.
 * Creates a chat room for the lobby code and syncs messages.
 */
export function useLobbyChat(lobbyCode: string | undefined) {
  const { currentPlayer } = useGame();
  const { notifyChatMessage } = useNotifications();
  const [messages, setMessages] = useState<LobbyMessage[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Create or find the lobby chat room
  useEffect(() => {
    if (!lobbyCode || !currentPlayer) return;

    const initRoom = async () => {
      const lobbyRoomName = `Lobby: ${lobbyCode}`;

      // Check if room already exists
      const { data: existing } = await supabase
        .from('chat_rooms')
        .select('id')
        .eq('name', lobbyRoomName)
        .eq('type', 'lobby')
        .maybeSingle();

      let id: string;

      if (existing) {
        id = existing.id;
      } else {
        const { data: created, error } = await supabase
          .from('chat_rooms')
          .insert({
            name: lobbyRoomName,
            type: 'lobby',
            created_by: currentPlayer.id,
          })
          .select()
          .single();

        if (error || !created) {
          console.error('Failed to create lobby chat room:', error);
          return;
        }
        id = created.id;
      }

      // Join the room
      const { data: alreadyJoined } = await supabase
        .from('chat_participants')
        .select('id')
        .eq('room_id', id)
        .eq('player_id', currentPlayer.id)
        .maybeSingle();

      if (!alreadyJoined) {
        await supabase.from('chat_participants').insert({
          room_id: id,
          player_id: currentPlayer.id,
        });
      }

      setRoomId(id);

      // Load existing messages
      const { data: msgs } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', id)
        .order('created_at', { ascending: true })
        .limit(100);

      if (msgs) {
        setMessages(msgs.map(m => ({
          id: m.id,
          sender: m.sender_name,
          avatar: m.sender_avatar,
          content: m.content,
          timestamp: new Date(m.created_at),
          isSystem: m.is_system || false,
        })));
      }
    };

    initRoom();
  }, [lobbyCode, currentPlayer]);

  // Real-time subscription
  useEffect(() => {
    if (!roomId) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`lobby-chat-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const m = payload.new as any;
          setMessages(prev => {
            if (prev.find(msg => msg.id === m.id)) return prev;
            return [...prev, {
              id: m.id,
              sender: m.sender_name,
              avatar: m.sender_avatar,
              content: m.content,
              timestamp: new Date(m.created_at),
              isSystem: m.is_system || false,
            }];
          });
          // Notify for messages from other players
          if (currentPlayer && m.sender_id !== currentPlayer.id && !m.is_system) {
            notifyChatMessage(m.sender_name, m.content, roomId);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const sendMessage = useCallback(async (content: string) => {
    if (!currentPlayer || !roomId || !content.trim()) return;

    await supabase.from('chat_messages').insert({
      room_id: roomId,
      sender_id: currentPlayer.id,
      sender_name: currentPlayer.name,
      sender_avatar: currentPlayer.avatar,
      content: content.trim(),
      is_system: false,
    });

    // Send background push to other participants in this room
    const { data: participants } = await supabase
      .from('chat_participants')
      .select('player_id')
      .eq('room_id', roomId)
      .neq('player_id', currentPlayer.id);

    if (participants && participants.length > 0) {
      const otherPlayerIds = participants.map(p => p.player_id);
      sendPushToPlayers(otherPlayerIds, {
        title: `💬 Lobby: ${currentPlayer.name}`,
        body: content.trim().length > 100 ? content.trim().substring(0, 100) + '…' : content.trim(),
        tag: `chat-${roomId}`,
        data: { type: 'chat', roomId },
      });
    }
  }, [currentPlayer, roomId]);

  return { messages, sendMessage, roomId };
}
