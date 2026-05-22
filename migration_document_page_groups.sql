-- ============================================================
-- migration_document_page_groups.sql
-- OCRページ自動結合AIのページグループ管理テーブル
-- 目的: 複数ページ書類のページ単位管理 / 結合履歴 / 監査ログ
-- 作成日: 2026-05-22
-- ⚠️ 2026年5月以降: publicスキーマはGRANT必須
-- ============================================================

-- ──────────────────────────────────────────────
-- ① document_page_groups テーブル
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.document_page_groups (
  id              TEXT PRIMARY KEY,

  -- グループ識別子（同一書類の複数ページを束ねるID）
  group_id        TEXT NOT NULL,

  -- 施設・利用者
  child_id        TEXT,
  facility_id     TEXT,

  -- 書類種別
  -- "soudan" / "isp" / "monitoring" / "service_plan" / "medical_opinion"
  document_type   TEXT NOT NULL DEFAULT 'soudan',

  -- ページ情報
  page_no         INTEGER NOT NULL DEFAULT 1,
  total_pages     INTEGER,                      -- 確定後に更新

  -- ファイル情報
  thumbnail_url   TEXT,                         -- 将来: Supabase Storageへのアップロード後URL

  -- OCR結果
  ocr_text        TEXT,                         -- api/ocr の rawText（生テキスト）
  ocr_data        JSONB,                        -- api/ocr の data（構造化JSON）

  -- AI判定結果
  -- "first"             : 1ページ目（表紙）
  -- "continuation"      : 同一書類の続きページ
  -- "different_document": 別書類の可能性が高い
  -- "unknown"           : OCR失敗・判定不能
  ai_page_role    TEXT NOT NULL DEFAULT 'first',
  confidence      INTEGER DEFAULT 100,          -- 同一書類一致度（0-100）
  is_same_doc     BOOLEAN NOT NULL DEFAULT true,
  warnings        JSONB,                        -- 警告メッセージ配列
  mismatch_fields JSONB,                        -- 不一致フィールド名配列

  -- 親ドキュメント参照
  soudan_genan_id TEXT,                         -- soudan_genans.id
  child_doc_id    TEXT,                         -- child_documents.id

  -- 操作者・日時
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- ② page_merge_history テーブル（監査ログ）
-- ページ結合・並び替え・削除の履歴
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.page_merge_history (
  id              TEXT PRIMARY KEY,

  -- 対象グループ
  group_id        TEXT NOT NULL,
  child_id        TEXT,
  facility_id     TEXT,
  document_type   TEXT NOT NULL DEFAULT 'soudan',

  -- マージ情報
  page_count      INTEGER NOT NULL DEFAULT 1,
  merge_confidence INTEGER DEFAULT 100,         -- 全ページの平均一致度
  combined_text   TEXT,                         -- 結合テキスト（AI解析用）

  -- 操作者
  merged_by       TEXT,
  reordered_by    TEXT,                         -- 並び替えを行ったユーザー

  -- ページ構成スナップショット（JSON）
  page_snapshot   JSONB,                        -- [{pageNo, pageRole, isSameDoc, confidence, warnings}]

  -- 日時
  merged_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- RLS（Row Level Security）
-- ──────────────────────────────────────────────
ALTER TABLE public.document_page_groups  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_merge_history    ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────
-- GRANT（2026年5月30日以降 必須）
-- ──────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.document_page_groups
  TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.page_merge_history
  TO anon, authenticated;

-- ──────────────────────────────────────────────
-- RLSポリシー
-- ──────────────────────────────────────────────
DROP POLICY IF EXISTS "document_page_groups_access" ON public.document_page_groups;
CREATE POLICY "document_page_groups_access"
  ON public.document_page_groups FOR ALL
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "page_merge_history_access" ON public.page_merge_history;
CREATE POLICY "page_merge_history_access"
  ON public.page_merge_history FOR ALL
  USING (true) WITH CHECK (true);

-- ──────────────────────────────────────────────
-- インデックス
-- ──────────────────────────────────────────────

-- グループIDでページを一括取得
CREATE INDEX IF NOT EXISTS idx_dpg_group_id
  ON public.document_page_groups(group_id);

-- 利用者ごとのページ履歴
CREATE INDEX IF NOT EXISTS idx_dpg_child_id
  ON public.document_page_groups(child_id);

-- 書類種別ごとの分析
CREATE INDEX IF NOT EXISTS idx_dpg_document_type
  ON public.document_page_groups(document_type);

-- AIページ役割ごとの集計（別書類混入率など）
CREATE INDEX IF NOT EXISTS idx_dpg_ai_page_role
  ON public.document_page_groups(ai_page_role);

-- マージ履歴: グループID
CREATE INDEX IF NOT EXISTS idx_pmh_group_id
  ON public.page_merge_history(group_id);

-- マージ履歴: 利用者
CREATE INDEX IF NOT EXISTS idx_pmh_child_id
  ON public.page_merge_history(child_id);

-- ──────────────────────────────────────────────
-- 確認クエリ
-- ──────────────────────────────────────────────
-- SELECT COUNT(*) FROM public.document_page_groups;
-- SELECT COUNT(*) FROM public.page_merge_history;
--
-- 別書類混入の疑いがあるページ一覧:
-- SELECT child_id, page_no, confidence, warnings
-- FROM public.document_page_groups
-- WHERE ai_page_role = 'different_document'
-- ORDER BY created_at DESC;
