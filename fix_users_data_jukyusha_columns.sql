-- ============================================================
-- GO GROUP アプリ — users_data 受給者証カラム追加
-- 実行日: 2026-05-20
-- 目的: 受給者証情報を users_data に一元管理するためのカラム追加
-- ============================================================
-- Supabase ダッシュボード → SQL Editor に貼り付けて実行
-- ADD COLUMN IF NOT EXISTS で既存カラムは変更しない（安全）
-- ============================================================

ALTER TABLE public.users_data
  -- 受給者証：既存カラム（念のため）
  ADD COLUMN IF NOT EXISTS jukyusha_no          TEXT,
  ADD COLUMN IF NOT EXISTS jukyusha_expiry      DATE,
  ADD COLUMN IF NOT EXISTS jukyusha_city        TEXT,
  ADD COLUMN IF NOT EXISTS transport_required   BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS support_grade        TEXT,
  -- 受給者証：新規カラム
  ADD COLUMN IF NOT EXISTS upper_limit_amount   INTEGER,
  ADD COLUMN IF NOT EXISTS upper_limit_office   BOOLEAN DEFAULT false,
  -- 利用者基本情報：既存カラム（念のため）
  ADD COLUMN IF NOT EXISTS birth_date           DATE,
  ADD COLUMN IF NOT EXISTS gender               TEXT,
  ADD COLUMN IF NOT EXISTS diagnosis            TEXT,
  ADD COLUMN IF NOT EXISTS disability_level     TEXT,
  ADD COLUMN IF NOT EXISTS consultation_office  TEXT,
  -- data JSONB（既存）
  ADD COLUMN IF NOT EXISTS data                 JSONB,
  ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMPTZ DEFAULT NOW();

-- ============================================================
-- スキーマキャッシュ強制リロード
-- ============================================================
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- 完了確認
-- ============================================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'users_data'
  AND column_name IN (
    'upper_limit_amount','upper_limit_office',
    'birth_date','gender','diagnosis','disability_level',
    'jukyusha_no','jukyusha_expiry','transport_required'
  )
ORDER BY column_name;
