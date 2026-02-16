
-- Table to track user engagement with push notifications
CREATE TABLE public.notification_engagement (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id TEXT,
  event_type TEXT NOT NULL, -- 'click', 'close', 'action'
  action_id TEXT, -- identifier for the action button clicked
  notification_tag TEXT,
  notification_type TEXT,
  lobby_code TEXT,
  device_info JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_engagement ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert notification engagement"
  ON public.notification_engagement FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can read notification engagement"
  ON public.notification_engagement FOR SELECT USING (true);

-- No updates or deletes allowed for engagement logs
