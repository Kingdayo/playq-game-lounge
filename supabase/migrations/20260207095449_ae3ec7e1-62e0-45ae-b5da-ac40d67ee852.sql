
-- Profiles table for user discovery and search
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  avatar TEXT NOT NULL,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Anyone can insert profiles" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update profiles" ON public.profiles FOR UPDATE USING (true);

CREATE INDEX idx_profiles_name ON public.profiles USING btree (lower(name));
CREATE INDEX idx_profiles_player_id ON public.profiles USING btree (player_id);

-- Chat rooms
CREATE TABLE public.chat_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  type TEXT NOT NULL DEFAULT 'direct',
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view chat rooms" ON public.chat_rooms FOR SELECT USING (true);
CREATE POLICY "Anyone can create chat rooms" ON public.chat_rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update chat rooms" ON public.chat_rooms FOR UPDATE USING (true);

-- Chat participants
CREATE TABLE public.chat_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(room_id, player_id)
);

ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view participants" ON public.chat_participants FOR SELECT USING (true);
CREATE POLICY "Anyone can join rooms" ON public.chat_participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can leave rooms" ON public.chat_participants FOR DELETE USING (true);

CREATE INDEX idx_chat_participants_player ON public.chat_participants USING btree (player_id);
CREATE INDEX idx_chat_participants_room ON public.chat_participants USING btree (room_id);

-- Chat messages
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_avatar TEXT NOT NULL,
  content TEXT NOT NULL,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view messages" ON public.chat_messages FOR SELECT USING (true);
CREATE POLICY "Anyone can send messages" ON public.chat_messages FOR INSERT WITH CHECK (true);

CREATE INDEX idx_chat_messages_room ON public.chat_messages USING btree (room_id);
CREATE INDEX idx_chat_messages_created ON public.chat_messages USING btree (created_at);

-- Enable realtime for messages and participants
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;
