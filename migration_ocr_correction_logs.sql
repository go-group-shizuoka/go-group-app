-- ============================================================
-- migration_ocr_correction_logs.sql
-- AI抽出確認UIでのスタッフ修正履歴を永続化するテーブル
-- 目的: AI改善学習 / 監査説明 / 誤抽出分析 / 修正傾向把握
-- 作成日: 2026-05-22
-- ⚠️ 2026年5月以降: publicスキーマはGRANT必須
-- ============================================================

-- テーブル作成（存在しない場合のみ）
CREATE TABLE IF NOT EXISTS public.ocr_correction_logs (
  id                  TEXT PRIMARY KEY,

  -- 施設・利用者
  facility_id         TEXT,
  child_id            TEXT,

  -- 書類情報
  document_type       TEXT NOT NULL DEFAULT 'soudan',
  -- field_name: specialistName / userNeeds / longTermGoal etc.
  field_name          TEXT NOT NULL,
  field_label         TEXT,                -- 日本語ラベル（表示用）

  -- AI原文 vs スタッフ確認後テキスト（AI改善学習の核心データ）
  ai_original_text    TEXT,               -- AIが抽出したテキスト（修正前）
  user_corrected_text TEXT,               -- スタッフが確認・修正した後のテキスト

  -- 採用状況
  -- "ai_adopted"   : AI抽出をそのまま採用
  -- "ai_modified"  : AI抽出をスタッフが修正
  -- "manual_added" : AI未検出・スタッフが手動入力
  -- "ai_deleted"   : AI抽出をスタッフが削除（空にした）
  -- "unchecked"    : 確認未実施
  adoption_status     TEXT,

  -- 修正理由（任意記入・監査説明用）
  correction_reason   TEXT,

  -- 修正フラグ（ai_original_text と user_corrected_text が異なる場合 true）
  is_corrected        BOOLEAN NOT NULL DEFAULT false,

  -- 操作者・日時
  corrected_by        TEXT,
  corrected_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 標準カラム
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- RLS（Row Level Security）を有効化
-- ──────────────────────────────────────────────
ALTER TABLE public.ocr_correction_logs ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────
-- GRANT（2026年5月30日以降 必須）
-- ──────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.ocr_correction_logs
  TO anon, authenticated;

-- ──────────────────────────────────────────────
-- RLSポリシー（施設単位アクセス）
-- ──────────────────────────────────────────────
-- 既存ポリシーを削除してから再作成（冪等性確保）
DROP POLICY IF EXISTS "ocr_correction_logs_access" ON public.ocr_correction_logs;

CREATE POLICY "ocr_correction_logs_access"
  ON public.ocr_correction_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ──────────────────────────────────────────────
-- インデックス（AI誤抽出分析・監査クエリ用）
-- ──────────────────────────────────────────────

-- 利用者ごとの修正履歴検索
CREATE INDEX IF NOT EXISTS idx_ocr_corr_child_id
  ON public.ocr_correction_logs(child_id);

-- フィールド名ごとの修正傾向分析（どのフィールドがよく誤読されるか）
CREATE INDEX IF NOT EXISTS idx_ocr_corr_field_name
  ON public.ocr_correction_logs(field_name);

-- 採用ステータスごとの集計（AI採用率の計算）
CREATE INDEX IF NOT EXISTS idx_ocr_corr_adoption_status
  ON public.ocr_correction_logs(adoption_status);

-- 日時順（最新の修正ログを素早く取得）
CREATE INDEX IF NOT EXISTS idx_ocr_corr_corrected_at
  ON public.ocr_correction_logs(corrected_at DESC);

-- 書類種別ごとの分析（受給者証 vs 相談支援原案）
CREATE INDEX IF NOT EXISTS idx_ocr_corr_document_type
  ON public.ocr_correction_logs(document_type);

-- 施設ごとのアクセス
CREATE INDEX IF NOT EXISTS idx_ocr_corr_facility_id
  ON public.ocr_correction_logs(facility_id);

-- ──────────────────────────────────────────────
-- 確認クエリ（実行後に確認）
-- ──────────────────────────────────────────────
-- SELECT COUNT(*) FROM public.ocr_correction_logs;
-- SELECT adoption_status, COUNT(*),
--        ROUND(COUNT(*)*100.0/SUM(COUNT(*)) OVER(), 1) AS pct
-- FROM public.ocr_correction_logs
-- GROUP BY adoption_status
-- ORDER BY COUNT(*) DESC;
