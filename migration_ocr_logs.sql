-- ============================================================
-- GO GROUP — OCR解析ログテーブル
-- 作成日: 2026-05-19
-- 用途: 受給者証・書類OCR実行履歴を保存する
--       「いつ・誰が・何枚解析・どの項目が取得できたか」を確認可能にする
-- ============================================================
-- Supabase ダッシュボード → SQL Editor に貼り付けて実行してください
-- ============================================================

-- ============================================================
-- ocr_analysis_logs テーブル作成
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ocr_analysis_logs (
  id                TEXT        PRIMARY KEY,
  child_id          TEXT,                         -- 解析対象の利用者ID
  child_name        TEXT,                         -- 利用者名（参照表示用）
  facility_id       TEXT,                         -- 施設ID
  document_type     TEXT        DEFAULT 'jukyusha', -- jukyusha / soudan / yotei など
  photo_count       INTEGER     DEFAULT 0,        -- 送信した写真枚数
  success_count     INTEGER     DEFAULT 0,        -- OCR成功枚数
  failed_count      INTEGER     DEFAULT 0,        -- OCR失敗枚数
  raw_ocr_results   JSONB,                        -- Promise.allSettled の生結果（枚数分の配列）
  merged_result     JSONB,                        -- 全写真の結果をマージした最終JSON
  error_messages    JSONB,                        -- 失敗時のエラーメッセージ配列
  created_by        TEXT,                         -- 実行した職員名
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- RLS（Row Level Security）有効化
ALTER TABLE public.ocr_analysis_logs ENABLE ROW LEVEL SECURITY;

-- 全操作を許可するポリシー（既存テーブルと統一）
DROP POLICY IF EXISTS "anon_all" ON public.ocr_analysis_logs;
CREATE POLICY "anon_all" ON public.ocr_analysis_logs
  FOR ALL USING (true) WITH CHECK (true);

-- ⚠️ 2026-05-30以降の仕様変更対応: GRANT必須
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.ocr_analysis_logs TO anon, authenticated;

-- インデックス（利用者・施設・日時検索用）
CREATE INDEX IF NOT EXISTS idx_ocr_logs_child    ON public.ocr_analysis_logs(child_id);
CREATE INDEX IF NOT EXISTS idx_ocr_logs_facility ON public.ocr_analysis_logs(facility_id);
CREATE INDEX IF NOT EXISTS idx_ocr_logs_created  ON public.ocr_analysis_logs(created_at DESC);
