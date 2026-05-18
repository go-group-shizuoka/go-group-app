-- =============================================================
-- migration_soft_delete.sql
-- 論理削除カラム追加（sbDelete論理削除対応）
-- 対象テーブル: sbDeleteで削除が行われる15テーブル
-- Supabase SQL Editor に貼り付けて「Run」してください
-- ※ 既存データへの影響なし（DEFAULT false）
-- =============================================================

DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'records',
    'qual_docs',
    'staff_data',
    'users_data',
    'isp_drafts',
    'isp_records',
    'visit_dests',
    'visit_records',
    'dev_records',
    'parent_support_records',
    'jukyusha_docs',
    'soudan_genans',
    'photo_albums',
    'staff_documents',
    'staff_doc_update_requests'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    -- is_deleted カラムがなければ追加
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name  = tbl
        AND column_name = 'is_deleted'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT false', tbl);
      RAISE NOTICE 'Added is_deleted to %', tbl;
    ELSE
      RAISE NOTICE 'is_deleted already exists in %', tbl;
    END IF;

    -- deleted_at カラムがなければ追加
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name  = tbl
        AND column_name = 'deleted_at'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN deleted_at TIMESTAMPTZ', tbl);
      RAISE NOTICE 'Added deleted_at to %', tbl;
    ELSE
      RAISE NOTICE 'deleted_at already exists in %', tbl;
    END IF;

    -- パフォーマンス用インデックス
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_%s_is_deleted ON public.%I(is_deleted)',
      replace(tbl, '_', ''), tbl
    );
  END LOOP;
END $$;

-- 確認クエリ
SELECT table_name, column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name IN ('is_deleted', 'deleted_at')
  AND table_name IN (
    'records','qual_docs','staff_data','users_data','isp_drafts',
    'isp_records','visit_dests','visit_records','dev_records',
    'parent_support_records','jukyusha_docs','soudan_genans',
    'photo_albums','staff_documents','staff_doc_update_requests'
  )
ORDER BY table_name, column_name;
