
-- Create lobbies table
CREATE TABLE public.lobbies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  game_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting',
  max_players INT NOT NULL DEFAULT 4,
  time_limit INT,
  house_rules JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create lobby_players table
CREATE TABLE public.lobby_players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lobby_id UUID NOT NULL REFERENCES public.lobbies(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar TEXT NOT NULL,
  is_host BOOLEAN NOT NULL DEFAULT false,
  is_ready BOOLEAN NOT NULL DEFAULT false,
  is_online BOOLEAN NOT NULL DEFAULT true,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lobby_id, player_id)
);

-- Enable RLS
ALTER TABLE public.lobbies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lobby_players ENABLE ROW LEVEL SECURITY;

-- Public read/write policies for lobbies (no auth, game data only - no PII)
CREATE POLICY "Anyone can view lobbies"
  ON public.lobbies FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create lobbies"
  ON public.lobbies FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update lobbies"
  ON public.lobbies FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete lobbies"
  ON public.lobbies FOR DELETE
  USING (true);

-- Public read/write policies for lobby_players
CREATE POLICY "Anyone can view lobby players"
  ON public.lobby_players FOR SELECT
  USING (true);

CREATE POLICY "Anyone can join lobbies"
  ON public.lobby_players FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update their status"
  ON public.lobby_players FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can leave lobbies"
  ON public.lobby_players FOR DELETE
  USING (true);

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.lobbies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lobby_players;

-- Index for fast lobby lookup by code
CREATE INDEX idx_lobbies_code ON public.lobbies(code);
CREATE INDEX idx_lobby_players_lobby_id ON public.lobby_players(lobby_id);
