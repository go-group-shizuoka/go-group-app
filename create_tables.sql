-- ============================================================
-- GO GROUP アプリ — 統合DBスキーマ (v2)
-- ============================================================
-- 設計方針：
--   ・利用者ID = U-{施設コード}-{連番4桁}  例: U-GH-0001
--   ・職員ID   = S-{施設コード}-{連番4桁}  例: S-GH-0001
--   ・施設コード: GH=GO HOME / GR=GO ROOM / T1=GO TOWN 1ST / T2=GO TOWN 2ND
--   ・全テーブルに user_id / staff_id の明示カラムを持たせる
--   ・JSONB(data)はその他詳細の格納庫として残す
--   ・国保請求・監査・ISP・シフト連携まで対応した構造
-- ============================================================
-- Supabase ダッシュボード → SQL Editor に貼り付けて実行してください
-- ============================================================


-- ============================================================
-- 1. 利用者マスタ (users_data)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users_data (
  id              TEXT PRIMARY KEY,          -- U-GH-0001 形式
  facility_id     TEXT NOT NULL,             -- f1/f2/f3/f4
  name            TEXT,                      -- 氏名
  name_kana       TEXT,                      -- 氏名カナ
  jukyusha_no     TEXT,                      -- 受給者証番号（国保請求で必須）
  jukyusha_expiry DATE,                      -- 受給者証有効期限
  jukyusha_city   TEXT,                      -- 支給決定市区町村
  service_type    TEXT DEFAULT '放デイ',     -- 放デイ / 児発
  active          BOOLEAN DEFAULT TRUE,      -- 在籍中フラグ
  enroll_date     DATE,                      -- 入所日
  data            JSONB,                     -- 保護者情報・医療情報など詳細
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.users_data ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all" ON public.users_data;
CREATE POLICY "anon_all" ON public.users_data FOR ALL USING (true) WITH CHECK (true);

-- インデックス（施設別・受給者証番号検索用）
CREATE INDEX IF NOT EXISTS idx_users_facility  ON public.users_data(facility_id);
CREATE INDEX IF NOT EXISTS idx_users_jukyusha  ON public.users_data(jukyusha_no);
CREATE INDEX IF NOT EXISTS idx_users_active    ON public.users_data(active);


-- ============================================================
-- 2. 職員マスタ (staff_data)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.staff_data (
  id               TEXT PRIMARY KEY,         -- S-GH-0001 形式
  facility_id      TEXT NOT NULL,            -- f1/f2/f3/f4
  name             TEXT,                     -- 氏名
  name_kana        TEXT,                     -- 氏名カナ
  role             TEXT DEFAULT 'staff',     -- manager / staff / support_staff / driver
  employment_type  TEXT DEFAULT '正社員',   -- 正社員 / パート / 非常勤
  active           BOOLEAN DEFAULT TRUE,     -- 在職中フラグ
  hire_date        DATE,                     -- 入社日
  data             JSONB,                    -- 資格・口座・緊急連絡先など詳細
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.staff_data ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all" ON public.staff_data;
CREATE POLICY "anon_all" ON public.staff_data FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_staff_facility ON public.staff_data(facility_id);
CREATE INDEX IF NOT EXISTS idx_staff_role     ON public.staff_data(role);


-- ============================================================
-- 3. 入退室・活動記録 (records) ← 既存構造を維持しカラム追加対応
-- ============================================================
CREATE TABLE IF NOT EXISTS public.records (
  id            TEXT PRIMARY KEY,
  type          TEXT,                        -- user_in / user_out / staff_in / staff_out / service / photo
  facility_id   TEXT,
  facility_name TEXT,
  staff_id      TEXT,                        -- 記録者職員ID (S-XX-XXXX)
  staff_name    TEXT,
  user_id       TEXT,                        -- 対象利用者ID (U-XX-XXXX)
  user_name     TEXT,
  time          TEXT,                        -- 記録日時 (ja-JP ロケール文字列)
  temp          TEXT,                        -- 体温
  transport     TEXT,                        -- 送迎あり/なし
  photo         BOOLEAN DEFAULT FALSE,       -- 写真撮影済
  note          TEXT,                        -- メモ
  data          JSONB,                       -- その他詳細
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all" ON public.records;
CREATE POLICY "anon_all" ON public.records FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_records_user_id    ON public.records(user_id);
CREATE INDEX IF NOT EXISTS idx_records_staff_id   ON public.records(staff_id);
CREATE INDEX IF NOT EXISTS idx_records_facility   ON public.records(facility_id);
CREATE INDEX IF NOT EXISTS idx_records_type       ON public.records(type);


-- ============================================================
-- 4. フェイスシート (facesheets)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.facesheets (
  id          TEXT PRIMARY KEY,              -- user_id と同値
  facility_id TEXT,
  user_id     TEXT,                          -- 対象利用者ID
  data        JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.facesheets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all" ON public.facesheets;
CREATE POLICY "anon_all" ON public.facesheets FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_facesheets_user ON public.facesheets(user_id);


-- ============================================================
-- 5. アセスメント (assessments)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.assessments (
  id          TEXT PRIMARY KEY,
  facility_id TEXT,
  user_id     TEXT,                          -- 対象利用者ID
  assessor    TEXT,                          -- 評価者氏名
  assess_date DATE,                          -- 評価日
  data        JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all" ON public.assessments;
CREATE POLICY "anon_all" ON public.assessments FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_assessments_user ON public.assessments(user_id);


-- ============================================================
-- 6. モニタリング (monitorings)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.monitorings (
  id               TEXT PRIMARY KEY,
  facility_id      TEXT,
  user_id          TEXT,
  monitoring_date  DATE,                     -- モニタリング実施日
  staff_id         TEXT,                     -- 担当職員ID
  data             JSONB,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.monitorings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all" ON public.monitorings;
CREATE POLICY "anon_all" ON public.monitorings FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_monitorings_user ON public.monitorings(user_id);


-- ============================================================
-- 7. 個別支援計画 旧テーブル (isps) ← 互換維持
-- ============================================================
CREATE TABLE IF NOT EXISTS public.isps (
  id          TEXT PRIMARY KEY,
  facility_id TEXT,
  user_id     TEXT,
  data        JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.isps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all" ON public.isps;
CREATE POLICY "anon_all" ON public.isps FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_isps_user ON public.isps(user_id);


-- ============================================================
-- 8. 個別支援計画 統合レコード (isp_records)
--    docType: assessment / isp_plan / weekly_plan / monitoring / meeting / consent
-- ============================================================
CREATE TABLE IF NOT EXISTS public.isp_records (
  id          TEXT PRIMARY KEY,
  facility_id TEXT,
  user_id     TEXT,                          -- 対象利用者ID ★明示カラム
  doc_type    TEXT,                          -- ドキュメント種別 ★明示カラム
  status      TEXT DEFAULT 'ai_draft',       -- 承認ステータス ★明示カラム
  -- 承認フロー: ai_draft→staff_checked→cdsm_approved→manager_confirmed
  --            →parent_explained→parent_consented→finalized
  data        JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.isp_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all" ON public.isp_records;
CREATE POLICY "anon_all" ON public.isp_records FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_isp_records_user     ON public.isp_records(user_id);
CREATE INDEX IF NOT EXISTS idx_isp_records_doc_type ON public.isp_records(doc_type);
CREATE INDEX IF NOT EXISTS idx_isp_records_status   ON public.isp_records(status);


-- ============================================================
-- 9. 個別支援計画 下書き (isp_drafts)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.isp_drafts (
  id          TEXT PRIMARY KEY,
  facility_id TEXT,
  user_id     TEXT,
  data        JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.isp_drafts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all" ON public.isp_drafts;
CREATE POLICY "anon_all" ON public.isp_drafts FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_isp_drafts_user ON public.isp_drafts(user_id);


-- ============================================================
-- 10. 日々のモニタリング蓄積ノート (monitoring_notes)
--     ISP連携サービス記録から自動生成・モニタリング作成時に参照
-- ============================================================
CREATE TABLE IF NOT EXISTS public.monitoring_notes (
  id          TEXT PRIMARY KEY,
  facility_id TEXT,
  user_id     TEXT,                          -- 対象利用者ID ★明示カラム
  isp_id      TEXT,                          -- 連携ISP ID
  note_date   DATE,                          -- 記録日 ★明示カラム
  data        JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.monitoring_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all" ON public.monitoring_notes;
CREATE POLICY "anon_all" ON public.monitoring_notes FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_monitoring_notes_user ON public.monitoring_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_notes_date ON public.monitoring_notes(note_date);


-- ============================================================
-- 11. 国保連請求データ (kokuho_data)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kokuho_data (
  id              TEXT PRIMARY KEY,          -- {user_id}_{year}_{month} 形式推奨
  facility_id     TEXT,
  user_id         TEXT,                      -- 対象利用者ID ★明示カラム
  year            INTEGER,                   -- 請求年 ★明示カラム
  month           INTEGER,                   -- 請求月 ★明示カラム
  service_days    INTEGER DEFAULT 0,         -- 利用日数 ★明示カラム
  transport_days  INTEGER DEFAULT 0,         -- 送迎日数 ★明示カラム
  billing_status  TEXT DEFAULT '未請求',    -- 未請求/請求済/過誤 ★明示カラム
  data            JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.kokuho_data ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all" ON public.kokuho_data;
CREATE POLICY "anon_all" ON public.kokuho_data FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_kokuho_user         ON public.kokuho_data(user_id);
CREATE INDEX IF NOT EXISTS idx_kokuho_year_month   ON public.kokuho_data(year, month);
CREATE INDEX IF NOT EXISTS idx_kokuho_status       ON public.kokuho_data(billing_status);


-- ============================================================
-- 12. 出欠データ (att_data)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.att_data (
  id          TEXT PRIMARY KEY,              -- {user_id}_{date} 形式
  user_id     TEXT,                          -- ★明示カラム
  att_date    DATE,                          -- 出欠日 ★明示カラム
  status      TEXT,                          -- 出席/欠席/遅刻/早退/未定
  data        JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.att_data ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all" ON public.att_data;
CREATE POLICY "anon_all" ON public.att_data FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_att_user ON public.att_data(user_id);
CREATE INDEX IF NOT EXISTS idx_att_date ON public.att_data(att_date);


-- ============================================================
-- 13. 送迎データ (transport_data)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.transport_data (
  id          TEXT PRIMARY KEY,
  facility_id TEXT,
  data        JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.transport_data ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all" ON public.transport_data;
CREATE POLICY "anon_all" ON public.transport_data FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 14. 日報 (daily_reports)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.daily_reports (
  id          TEXT PRIMARY KEY,              -- {date}_{facility_id} 形式
  facility_id TEXT,
  report_date DATE,                          -- 日報日付 ★明示カラム
  status      TEXT DEFAULT '下書き',        -- 下書き/確認済/承認済
  data        JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all" ON public.daily_reports;
CREATE POLICY "anon_all" ON public.daily_reports FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_daily_reports_facility ON public.daily_reports(facility_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_date     ON public.daily_reports(report_date);


-- ============================================================
-- 15. メッセージ (messages)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id          TEXT PRIMARY KEY,
  user_id     TEXT,
  user_name   TEXT,
  facility_id TEXT,
  from_name   TEXT,
  body        TEXT,
  time        TEXT,
  read        BOOLEAN DEFAULT FALSE,
  replies     JSONB DEFAULT '[]',
  data        JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all" ON public.messages;
CREATE POLICY "anon_all" ON public.messages FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_messages_user     ON public.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_facility ON public.messages(facility_id);


-- ============================================================
-- 16. シフト (shifts)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.shifts (
  id          TEXT PRIMARY KEY,              -- {staff_id}_{date} 形式
  staff_id    TEXT,                          -- S-XX-XXXX ★明示カラム
  date        DATE,                          -- シフト日 ★明示カラム
  shift_type  TEXT,                          -- 出勤/休み/午前/午後/有給
  data        JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all" ON public.shifts;
CREATE POLICY "anon_all" ON public.shifts FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_shifts_staff ON public.shifts(staff_id);
CREATE INDEX IF NOT EXISTS idx_shifts_date  ON public.shifts(date);


-- ============================================================
-- 17. 有給申請 (paid_leave_reqs)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.paid_leave_reqs (
  id          TEXT PRIMARY KEY,
  facility_id TEXT,
  staff_id    TEXT,                          -- 申請者職員ID ★明示カラム
  leave_date  DATE,                          -- 取得希望日 ★明示カラム
  status      TEXT DEFAULT '申請中',        -- 申請中/承認済/却下
  data        JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.paid_leave_reqs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all" ON public.paid_leave_reqs;
CREATE POLICY "anon_all" ON public.paid_leave_reqs FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_paid_leave_staff  ON public.paid_leave_reqs(staff_id);
CREATE INDEX IF NOT EXISTS idx_paid_leave_status ON public.paid_leave_reqs(status);


-- ============================================================
-- 18. 資格・証書 (qual_docs)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.qual_docs (
  id          TEXT PRIMARY KEY,
  facility_id TEXT,
  staff_id    TEXT,                          -- 所持者職員ID ★明示カラム
  data        JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.qual_docs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all" ON public.qual_docs;
CREATE POLICY "anon_all" ON public.qual_docs FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_qual_docs_staff ON public.qual_docs(staff_id);


-- ============================================================
-- 19. スケジュール (schedules)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.schedules (
  id          TEXT PRIMARY KEY,
  facility_id TEXT,
  staff_id    TEXT,
  date        DATE,
  data        JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all" ON public.schedules;
CREATE POLICY "anon_all" ON public.schedules FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 20. 既存テーブルへのカラム追加 (ALTER TABLE)
--     ※テーブルが既に作成済みの場合はこちらを実行してください
-- ============================================================

-- users_data にカラム追加（既存の場合）
ALTER TABLE public.users_data ADD COLUMN IF NOT EXISTS name           TEXT;
ALTER TABLE public.users_data ADD COLUMN IF NOT EXISTS name_kana      TEXT;
ALTER TABLE public.users_data ADD COLUMN IF NOT EXISTS jukyusha_no    TEXT;
ALTER TABLE public.users_data ADD COLUMN IF NOT EXISTS jukyusha_expiry DATE;
ALTER TABLE public.users_data ADD COLUMN IF NOT EXISTS jukyusha_city  TEXT;
ALTER TABLE public.users_data ADD COLUMN IF NOT EXISTS service_type   TEXT DEFAULT '放デイ';
ALTER TABLE public.users_data ADD COLUMN IF NOT EXISTS active         BOOLEAN DEFAULT TRUE;
ALTER TABLE public.users_data ADD COLUMN IF NOT EXISTS enroll_date    DATE;
ALTER TABLE public.users_data ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ DEFAULT NOW();

-- staff_data にカラム追加（既存の場合）
ALTER TABLE public.staff_data ADD COLUMN IF NOT EXISTS name            TEXT;
ALTER TABLE public.staff_data ADD COLUMN IF NOT EXISTS name_kana       TEXT;
ALTER TABLE public.staff_data ADD COLUMN IF NOT EXISTS role            TEXT DEFAULT 'staff';
ALTER TABLE public.staff_data ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT '正社員';
ALTER TABLE public.staff_data ADD COLUMN IF NOT EXISTS active          BOOLEAN DEFAULT TRUE;
ALTER TABLE public.staff_data ADD COLUMN IF NOT EXISTS hire_date       DATE;
ALTER TABLE public.staff_data ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ DEFAULT NOW();

-- isp_records にカラム追加（既存の場合）
ALTER TABLE public.isp_records ADD COLUMN IF NOT EXISTS user_id    TEXT;
ALTER TABLE public.isp_records ADD COLUMN IF NOT EXISTS doc_type   TEXT;
ALTER TABLE public.isp_records ADD COLUMN IF NOT EXISTS status     TEXT DEFAULT 'ai_draft';
ALTER TABLE public.isp_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- kokuho_data にカラム追加（既存の場合）
ALTER TABLE public.kokuho_data ADD COLUMN IF NOT EXISTS user_id        TEXT;
ALTER TABLE public.kokuho_data ADD COLUMN IF NOT EXISTS year           INTEGER;
ALTER TABLE public.kokuho_data ADD COLUMN IF NOT EXISTS month          INTEGER;
ALTER TABLE public.kokuho_data ADD COLUMN IF NOT EXISTS service_days   INTEGER DEFAULT 0;
ALTER TABLE public.kokuho_data ADD COLUMN IF NOT EXISTS transport_days INTEGER DEFAULT 0;
ALTER TABLE public.kokuho_data ADD COLUMN IF NOT EXISTS billing_status TEXT DEFAULT '未請求';
ALTER TABLE public.kokuho_data ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ DEFAULT NOW();

-- monitoring_notes にカラム追加（既存の場合）
ALTER TABLE public.monitoring_notes ADD COLUMN IF NOT EXISTS user_id   TEXT;
ALTER TABLE public.monitoring_notes ADD COLUMN IF NOT EXISTS isp_id    TEXT;
ALTER TABLE public.monitoring_notes ADD COLUMN IF NOT EXISTS note_date DATE;

-- att_data にカラム追加（既存の場合）
ALTER TABLE public.att_data ADD COLUMN IF NOT EXISTS user_id  TEXT;
ALTER TABLE public.att_data ADD COLUMN IF NOT EXISTS att_date DATE;
ALTER TABLE public.att_data ADD COLUMN IF NOT EXISTS status   TEXT;

-- daily_reports にカラム追加（既存の場合）
ALTER TABLE public.daily_reports ADD COLUMN IF NOT EXISTS report_date DATE;
ALTER TABLE public.daily_reports ADD COLUMN IF NOT EXISTS status      TEXT DEFAULT '下書き';
ALTER TABLE public.daily_reports ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ DEFAULT NOW();

-- facesheets にカラム追加（既存の場合）
ALTER TABLE public.facesheets ADD COLUMN IF NOT EXISTS user_id    TEXT;
ALTER TABLE public.facesheets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- assessments にカラム追加（既存の場合）
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS user_id      TEXT;
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS assessor     TEXT;
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS assess_date  DATE;

-- monitorings にカラム追加（既存の場合）
ALTER TABLE public.monitorings ADD COLUMN IF NOT EXISTS user_id         TEXT;
ALTER TABLE public.monitorings ADD COLUMN IF NOT EXISTS staff_id        TEXT;
ALTER TABLE public.monitorings ADD COLUMN IF NOT EXISTS monitoring_date DATE;

-- isps にカラム追加（既存の場合）
ALTER TABLE public.isps ADD COLUMN IF NOT EXISTS user_id TEXT;

-- isp_drafts にカラム追加（既存の場合）
ALTER TABLE public.isp_drafts ADD COLUMN IF NOT EXISTS user_id    TEXT;
ALTER TABLE public.isp_drafts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- qual_docs にカラム追加（既存の場合）
ALTER TABLE public.qual_docs ADD COLUMN IF NOT EXISTS staff_id TEXT;

-- paid_leave_reqs にカラム追加（既存の場合）
ALTER TABLE public.paid_leave_reqs ADD COLUMN IF NOT EXISTS staff_id   TEXT;
ALTER TABLE public.paid_leave_reqs ADD COLUMN IF NOT EXISTS leave_date DATE;
ALTER TABLE public.paid_leave_reqs ADD COLUMN IF NOT EXISTS status     TEXT DEFAULT '申請中';

-- ============================================================
-- 完了！
-- ・セクション1〜19: 新規環境用 (CREATE TABLE IF NOT EXISTS)
-- ・セクション20   : 既存環境用 (ALTER TABLE ADD COLUMN IF NOT EXISTS)
-- 既存環境では主にセクション20だけ実行すればOKです
-- ============================================================
