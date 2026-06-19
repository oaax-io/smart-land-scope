
CREATE POLICY "Users upload own feedback screenshots"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'feedback-screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users read own feedback screenshots"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'feedback-screenshots'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_platform_admin(auth.uid())
    )
  );

CREATE POLICY "Users delete own feedback screenshots"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'feedback-screenshots'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_platform_admin(auth.uid())
    )
  );
