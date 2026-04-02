-- Private bucket + anonymous INSERT-only policies for match uploads.
-- Run after 001_match_submissions.sql in Supabase SQL Editor.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('match-uploads', 'match-uploads', false, 52428800)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "match_uploads_insert_anon" ON storage.objects;
DROP POLICY IF EXISTS "match_uploads_insert_authenticated" ON storage.objects;

-- Allow uploads only under matches/<uuid>/original.zip or parsed.json
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

-- No SELECT/UPDATE/DELETE policies for anon or authenticated: objects are not publicly readable.
