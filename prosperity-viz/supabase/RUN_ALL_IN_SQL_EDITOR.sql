-- Run this entire file once in Supabase Dashboard → SQL Editor → New query → Run.
-- Equivalent to running 001_match_submissions.sql then 002_storage_match_uploads.sql.

-- === 001: match_submissions =================================================

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

-- === 002: storage bucket + policies ==========================================

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('match-uploads', 'match-uploads', false, 52428800)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "match_uploads_insert_anon" ON storage.objects;
DROP POLICY IF EXISTS "match_uploads_insert_authenticated" ON storage.objects;

CREATE POLICY "match_uploads_insert_anon"
  ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (
    bucket_id = 'match-uploads'
    AND (
      name LIKE 'matches/%/original.zip'
      OR name LIKE 'matches/%/parsed.json'
    )
  );

CREATE POLICY "match_uploads_insert_authenticated"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'match-uploads'
    AND (
      name LIKE 'matches/%/original.zip'
      OR name LIKE 'matches/%/parsed.json'
    )
  );
