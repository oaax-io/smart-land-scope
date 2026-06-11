
CREATE POLICY "regdoc_storage_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'regulation-documents');
CREATE POLICY "regdoc_storage_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'regulation-documents' AND public.is_platform_admin(auth.uid()));
CREATE POLICY "regdoc_storage_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'regulation-documents' AND public.is_platform_admin(auth.uid()));
CREATE POLICY "regdoc_storage_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'regulation-documents' AND public.is_platform_admin(auth.uid()));
