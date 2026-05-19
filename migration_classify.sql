-- ============================================================
-- GO GROUP — 書類種別自動判定 マイグレーション
-- 作成日: 2026-05-21
-- 内容:
--   1. manual_review_queue テーブル新規作成（未分類・低信頼度書類の保留キュー）
--   2. ocr_analysis_logs に分類カラム3本を追加
-- ============================================================
-- Supabase ダッシュボード → SQL Editor に貼り付けて実行してください
-- ============================================================

-- ============================================================
-- 1. manual_review_queue テーブル
-- ============================================================
CREATE TABLE IF NOT EXISTS public.manual_review_queue (
  id              TEXT        PRIMARY KEY,
  child_id        TEXT,                         -- 関連する利用者ID
  child_name      TEXT,                         -- 利用者名（表示用）
  facility_id     TEXT,                         -- 施設ID
  photo_count     INTEGER     DEFAULT 0,        -- 書類の枚数
  predicted_type  TEXT,                         -- AIが予測した書類種別
  confidence      INTEGER     DEFAULT 0,        -- AI判定の信頼度（0-100）
  reason          TEXT,                         -- AI判定の理由
  status          TEXT        DEFAULT 'pending',-- pending / reviewed / resolved
  reviewed_by     TEXT,                         -- 確認した職員名
  reviewed_at     TIMESTAMPTZ,                  -- 確認日時
  resolved_type   TEXT,                         -- 最終的に確定した書類種別
  notes           TEXT,                         -- 職員メモ
  ocr_log_id      TEXT,                         -- 関連するOCRログID
  created_by      TEXT,                         -- 登録した職員名
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  data            JSONB                         -- 追加データ（拡張用）
);

-- RLS有効化
ALTER TABLE public.manual_review_queue ENABLE ROW LEVEL SECURITY;

-- ポリシー（既存テーブルと統一）
DROP POLICY IF EXISTS "anon_all" ON public.manual_review_queue;
CREATE POLICY "anon_all" ON public.manual_review_queue
  FOR ALL USING (true) WITH CHECK (true);

-- ⚠️ 2026-05-30以降の仕様変更対応: GRANT必須
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.manual_review_queue TO anon, authenticated;

-- インデックス
CREATE INDEX IF NOT EXISTS idx_manual_review_status   ON public.manual_review_queue(status);
CREATE INDEX IF NOT EXISTS idx_manual_review_facility ON public.manual_review_queue(facility_id);
CREATE INDEX IF NOT EXISTS idx_manual_review_created  ON public.manual_review_queue(created_at DESC);

-- ============================================================
-- 2. ocr_analysis_logs に分類カラムを追加
-- ============================================================
ALTER TABLE public.ocr_analysis_logs
  ADD COLUMN IF NOT EXISTS predicted_document_type TEXT,        -- AI判定の書類種別
  ADD COLUMN IF NOT EXISTS confidence              INTEGER DEFAULT 0,  -- AI判定の信頼度（0-100）
  ADD COLUMN IF NOT EXISTS classification_reason  TEXT;         -- AI判定の理由

-- ============================================================
-- 確認クエリ
-- ============================================================
SELECT 'manual_review_queue' AS table_name, count(*) AS rows FROM public.manual_review_queue
UNION ALL
SELECT 'ocr_analysis_logs (predicted_document_type)', count(*) FROM public.ocr_analysis_logs WHERE predicted_document_type IS NOT NULL;
