CREATE TABLE public.rooms (
  code text PRIMARY KEY,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rooms TO anon, authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public room state is readable" ON public.rooms FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.room_private (
  code text PRIMARY KEY REFERENCES public.rooms(code) ON DELETE CASCADE,
  game jsonb NOT NULL,
  version integer NOT NULL DEFAULT 0
);
GRANT ALL ON public.room_private TO service_role;
ALTER TABLE public.room_private ENABLE ROW LEVEL SECURITY;

ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;