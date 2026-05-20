-- ============================================================
-- GO GROUP アプリ — users_data テーブル 不足カラム追加
-- 実行日: 2026-05-20
-- 目的: PGRST204 エラー対応
--       "Could not find the 'birth_date' column of 'users_data' in the schema cache"
-- ============================================================
-- Supabase ダッシュボード → SQL Editor に貼り付けて実行
-- ※ ADD COLUMN IF NOT EXISTS で既存カラムは変更しない（安全）
-- ============================================================

ALTER TABLE public.users_data
  ADD COLUMN IF NOT EXISTS child_id             TEXT,
  ADD COLUMN IF NOT EXISTS facility_id          TEXT,
  ADD COLUMN IF NOT EXISTS name                 TEXT,
  ADD COLUMN IF NOT EXISTS name_kana            TEXT,
  ADD COLUMN IF NOT EXISTS birth_date           DATE,
  ADD COLUMN IF NOT EXISTS gender               TEXT,
  ADD COLUMN IF NOT EXISTS jukyusha_no          TEXT,
  ADD COLUMN IF NOT EXISTS jukyusha_expiry      DATE,
  ADD COLUMN IF NOT EXISTS jukyusha_city        TEXT,
  ADD COLUMN IF NOT EXISTS service_type         TEXT,
  ADD COLUMN IF NOT EXISTS diagnosis            TEXT,
  ADD COLUMN IF NOT EXISTS disability_level     TEXT,
  ADD COLUMN IF NOT EXISTS consultation_office  TEXT,
  ADD COLUMN IF NOT EXISTS transport_required   BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS support_grade        TEXT,
  ADD COLUMN IF NOT EXISTS active               BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS enroll_date          DATE,
  ADD COLUMN IF NOT EXISTS data                 JSONB,
  ADD COLUMN IF NOT EXISTS created_at           TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS is_deleted           BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by           TEXT;

-- RLS が有効でない場合は有効化
ALTER TABLE public.users_data ENABLE ROW LEVEL SECURITY;

-- 既存ポリシーを削除して再作成（冪等）
DROP POLICY IF EXISTS "anon_all" ON public.users_data;
CREATE POLICY "anon_all" ON public.users_data
  FOR ALL USING (true) WITH CHECK (true);

-- GRANT（2026-05-30以降の仕様変更対応）
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.users_data TO anon, authenticated;

-- ============================================================
-- スキーマキャッシュ強制リロード（PGRST204対策）
-- ============================================================
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- 完了確認: users_data のカラム一覧
-- ============================================================
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'users_data'
ORDER BY ordinal_position;
