-- ============================================================
-- GO GROUP — 児童別 AIドキュメントBOX マイグレーション
-- 作成日: 2026-05-21
-- 内容:
--   child_documents テーブル新規作成
--   OCR・AI分類済み書類を児童ごとに時系列・バージョン管理する
-- ============================================================
-- Supabase ダッシュボード → SQL Editor に貼り付けて実行してください
-- ============================================================

CREATE TABLE IF NOT EXISTS public.child_documents (
  id               TEXT        PRIMARY KEY,
  child_id         TEXT,                         -- 利用者ID（自動紐付けまたは手動）
  document_type    TEXT,                         -- jukyusha / isp / monitoring / service_plan / medical_opinion / assessment / support_record / unknown
  document_date    DATE,                         -- 書類の日付（交付日・計画作成日など）
  expiry_date      DATE,                         -- 有効期限（受給者証・計画期間終了日など）
  file_url         TEXT,                         -- Storageファイルパス（将来拡張用）
  thumbnail_url    TEXT,                         -- サムネイルURL（将来拡張用）
  ocr_log_id       TEXT,                         -- 関連するOCR解析ログID
  ai_summary       TEXT,                         -- AI生成の3〜5行要約
  extracted_fields JSONB,                        -- OCRで抽出したフィールド全体
  version_no       INTEGER     DEFAULT 1,        -- バージョン番号（同種類の書類が追加されるたびに+1）
  is_latest        BOOLEAN     DEFAULT true,     -- 最新版フラグ（同種類の最新のみtrue）
  match_confidence INTEGER     DEFAULT 0,        -- 児童紐付け信頼度（0-100）
  match_status     TEXT        DEFAULT 'confirmed', -- confirmed / pending_review
  uploaded_by      TEXT,                         -- アップロードした職員名
  facility_id      TEXT,                         -- 施設ID
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- RLS有効化
ALTER TABLE public.child_documents ENABLE ROW LEVEL SECURITY;

-- ポリシー（既存テーブルと統一）
DROP POLICY IF EXISTS "anon_all" ON public.child_documents;
CREATE POLICY "anon_all" ON public.child_documents
  FOR ALL USING (true) WITH CHECK (true);

-- ⚠️ 2026-05-30以降の仕様変更対応: GRANT必須
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.child_documents TO anon, authenticated;

-- インデックス
CREATE INDEX IF NOT EXISTS idx_child_docs_child    ON public.child_documents(child_id);
CREATE INDEX IF NOT EXISTS idx_child_docs_type     ON public.child_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_child_docs_latest   ON public.child_documents(child_id, document_type, is_latest);
CREATE INDEX IF NOT EXISTS idx_child_docs_expiry   ON public.child_documents(expiry_date);
CREATE INDEX IF NOT EXISTS idx_child_docs_facility ON public.child_documents(facility_id);
CREATE INDEX IF NOT EXISTS idx_child_docs_created  ON public.child_documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_child_docs_status   ON public.child_documents(match_status);

-- ============================================================
-- 確認クエリ
-- ============================================================
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'child_documents'
ORDER BY ordinal_position;
