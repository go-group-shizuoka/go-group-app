-- =============================================================
-- migration_storage_buckets.sql
-- Supabase Storage バケット作成
-- ⚠️ Supabase SQL Editor で実行してください
-- =============================================================

-- ─── バケット作成 ───
-- album-photos   : 活動写真アルバム（保護者公開用）public=true
-- daily-photos   : 訪問記録・日常写真       public=true
-- staff-documents: 職員書類（資格証・雇用契約等）private
-- child-documents: 児童書類（受給者証等）    private

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'album-photos',
    'album-photos',
    true,
    10485760,  -- 10MB
    ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']
  ),
  (
    'daily-photos',
    'daily-photos',
    true,
    10485760,  -- 10MB
    ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']
  ),
  (
    'staff-documents',
    'staff-documents',
    false,
    52428800,  -- 50MB（PDF対応）
    ARRAY['image/jpeg','image/png','image/webp','application/pdf']
  ),
  (
    'child-documents',
    'child-documents',
    false,
    52428800,  -- 50MB（PDF対応）
    ARRAY['image/jpeg','image/png','image/webp','application/pdf']
  )
ON CONFLICT (id) DO NOTHING;

-- ─── Storage RLS ポリシー ───
-- service_role（api/upload.js）は RLS をバイパスするので書き込み可
-- 公開バケットは anon でも読み取り可（public=true で自動設定）
-- private バケットは将来 signed URL で対応（現在は service_role のみ）

-- album-photos: 認証ユーザーは読み取り可
CREATE POLICY IF NOT EXISTS "album_photos_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'album-photos');

-- daily-photos: 認証ユーザーは読み取り可
CREATE POLICY IF NOT EXISTS "daily_photos_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'daily-photos');

-- ─── 確認クエリ ───
SELECT id, name, public, file_size_limit,
       array_length(allowed_mime_types,1) AS mime_count,
       created_at
FROM storage.buckets
WHERE id IN ('photos','album-photos','daily-photos','staff-documents','child-documents')
ORDER BY created_at;
