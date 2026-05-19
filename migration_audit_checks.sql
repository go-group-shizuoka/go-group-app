-- ============================================================
-- GO GROUP — AI監査チェック マイグレーション
-- 作成日: 2026-05-21
-- 内容: audit_checks テーブル新規作成
--       毎日の自動監査結果・解決履歴を保存する
-- ============================================================
-- Supabase ダッシュボード → SQL Editor に貼り付けて実行してください
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_checks (
  id              TEXT        PRIMARY KEY,
  check_type      TEXT,                         -- jukyusha_expired / isp_missing / monitoring_overdue など
  severity        TEXT        DEFAULT 'info',   -- critical / warning / info
  child_id        TEXT,                         -- 対象利用者ID（施設全体チェックはnull）
  child_name      TEXT,                         -- 対象利用者名（表示用）
  facility_id     TEXT,                         -- 対象施設ID
  title           TEXT,                         -- 問題のタイトル（短文）
  description     TEXT,                         -- 問題の詳細説明
  recommendation  TEXT,                         -- AI推奨対応
  status          TEXT        DEFAULT 'open',   -- open / resolved / dismissed / auto_resolved
  resolved_by     TEXT,                         -- 解決した職員名
  resolved_at     TIMESTAMPTZ,                  -- 解決日時
  resolved_note   TEXT,                         -- 解決メモ
  related_id      TEXT,                         -- 関連ID（OCRログID / 書類IDなど）
  check_date      DATE        DEFAULT CURRENT_DATE, -- 監査実施日
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- RLS有効化
ALTER TABLE public.audit_checks ENABLE ROW LEVEL SECURITY;

-- ポリシー（既存テーブルと統一）
DROP POLICY IF EXISTS "anon_all" ON public.audit_checks;
CREATE POLICY "anon_all" ON public.audit_checks
  FOR ALL USING (true) WITH CHECK (true);

-- ⚠️ 2026-05-30以降の仕様変更対応: GRANT必須
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.audit_checks TO anon, authenticated;

-- インデックス
CREATE INDEX IF NOT EXISTS idx_audit_status   ON public.audit_checks(status);
CREATE INDEX IF NOT EXISTS idx_audit_severity ON public.audit_checks(severity);
CREATE INDEX IF NOT EXISTS idx_audit_child    ON public.audit_checks(child_id);
CREATE INDEX IF NOT EXISTS idx_audit_facility ON public.audit_checks(facility_id);
CREATE INDEX IF NOT EXISTS idx_audit_type     ON public.audit_checks(check_type);
CREATE INDEX IF NOT EXISTS idx_audit_date     ON public.audit_checks(check_date DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created  ON public.audit_checks(created_at DESC);

-- ============================================================
-- 確認クエリ
-- ============================================================
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'audit_checks'
ORDER BY ordinal_position;
