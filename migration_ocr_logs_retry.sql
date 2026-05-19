-- ============================================================
-- GO GROUP — OCR解析ログ 再解析機能追加マイグレーション
-- 作成日: 2026-05-21
-- 用途: 失敗写真の再解析機能に必要な4カラムを追加する
-- ============================================================
-- Supabase ダッシュボード → SQL Editor に貼り付けて実行してください
-- ============================================================

ALTER TABLE public.ocr_analysis_logs
  ADD COLUMN IF NOT EXISTS retry_count    INTEGER     DEFAULT 0,    -- 再解析実行回数
  ADD COLUMN IF NOT EXISTS retried_at     TIMESTAMPTZ,              -- 最終再解析日時
  ADD COLUMN IF NOT EXISTS retried_by     TEXT,                     -- 最終再解析実行者
  ADD COLUMN IF NOT EXISTS retry_history  JSONB;                    -- 再解析履歴（前後比較を含む配列）

-- 確認クエリ（実行後にカラムが追加されていることを確認）
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'ocr_analysis_logs'
  AND column_name  IN ('retry_count','retried_at','retried_by','retry_history')
ORDER BY column_name;
