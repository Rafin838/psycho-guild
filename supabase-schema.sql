-- 1. Create the exact table structure the code expects
CREATE TABLE IF NOT EXISTS public.submissions (
  id text PRIMARY KEY,
  submission_secret text NOT NULL,
  game_name text NOT NULL,
  game_uid text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  submission_date text,
  submission_time text,
  ip_address text,
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone
);

-- 2. Enforce Row Level Security (RLS) to block public access
-- Since the application uses the secure server-side SUPABASE_SERVICE_ROLE_KEY,
-- it will bypass this RLS natively, but any leaked public keys will be blocked.
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- 3. Create an index to keep UID lookups fast
CREATE INDEX IF NOT EXISTS submissions_game_uid_idx ON public.submissions(game_uid);

-- 4. CRITICAL: Force Supabase to immediately flush its API Schema Cache.
NOTIFY pgrst, 'reload schema';
