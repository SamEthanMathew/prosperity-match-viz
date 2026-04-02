-- Match submission metadata (paths point to Storage objects under match-uploads).
-- Run in Supabase SQL Editor or via supabase db push.

CREATE TABLE IF NOT EXISTS public.match_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  zip_object_path text NOT NULL,
  parsed_object_path text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.match_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "match_submissions_insert_anon" ON public.match_submissions;
DROP POLICY IF EXISTS "match_submissions_insert_authenticated" ON public.match_submissions;

-- Clients may insert rows; they cannot read or modify others' data via anon/authenticated keys.
CREATE POLICY "match_submissions_insert_anon"
  ON public.match_submissions
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "match_submissions_insert_authenticated"
  ON public.match_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

GRANT INSERT ON public.match_submissions TO anon, authenticated;

COMMENT ON TABLE public.match_submissions IS 'One row per uploaded match; zip + parsed JSON live in Storage.';
