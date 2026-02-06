import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Lobby, Player } from '@/types/game';

interface UseLobbyParams {
  lobbyCode: string | null;
  onLobbyUpdate: (lobby: Lobby | null) => void;
}

// Convert DB rows into our Lobby interface
const toLobby = (
  row: {
    id: string;
    code: string;
    game_type: string;
    status: string;
    max_players: number;
    time_limit: number | null;
    house_rules: unknown;
    created_at: string;
  },
  players: Player[]
): Lobby => {
  const host = players.find((p) => p.isHost) || players[0];
  return {
    id: row.id,
    code: row.code,
    gameType: row.game_type as Lobby['gameType'],
    host,
    players,
    settings: {
      maxPlayers: row.max_players,
      timeLimit: row.time_limit ?? undefined,
      houseRules: (row.house_rules as Record<string, boolean>) || {},
    },
    status: row.status as Lobby['status'],
    createdAt: new Date(row.created_at),
  };
};

const toPlayer = (row: {
  player_id: string;
  name: string;
  avatar: string;
  is_host: boolean;
  is_ready: boolean;
  is_online: boolean;
}): Player => ({
  id: row.player_id,
  name: row.name,
  avatar: row.avatar,
  isHost: row.is_host,
  isReady: row.is_ready,
  isOnline: row.is_online,
});

export function useLobbySync({ lobbyCode, onLobbyUpdate }: UseLobbyParams) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchLobby = useCallback(async (code: string) => {
    const { data: lobbyRow, error: lobbyErr } = await supabase
      .from('lobbies')
      .select('*')
      .eq('code', code)
      .maybeSingle();

    if (lobbyErr || !lobbyRow) {
      onLobbyUpdate(null);
      return;
    }

    const { data: playerRows, error: playerErr } = await supabase
      .from('lobby_players')
      .select('*')
      .eq('lobby_id', lobbyRow.id)
      .order('joined_at', { ascending: true });

    if (playerErr) {
      console.error('Error fetching lobby players:', playerErr);
      onLobbyUpdate(null);
      return;
    }

    const players = (playerRows || []).map(toPlayer);
    onLobbyUpdate(toLobby(lobbyRow, players));
  }, [onLobbyUpdate]);

  useEffect(() => {
    if (!lobbyCode) {
      // Clean up any existing channel
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    // Initial fetch
    fetchLobby(lobbyCode);

    // Subscribe to realtime changes on both tables
    const channel = supabase
      .channel(`lobby-${lobbyCode}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lobbies' },
        () => {
          fetchLobby(lobbyCode);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lobby_players' },
        () => {
          fetchLobby(lobbyCode);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [lobbyCode, fetchLobby]);

  return { refetch: () => lobbyCode && fetchLobby(lobbyCode) };
}
