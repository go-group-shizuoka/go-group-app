-- GO GROUP アプリ 不足テーブル作成SQL
-- Supabase ダッシュボード → SQL Editor に貼り付けて実行してください

-- 1. フェイスシート
CREATE TABLE IF NOT EXISTS public.facesheets (
  id TEXT PRIMARY KEY,
  facility_id TEXT,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.facesheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON public.facesheets FOR ALL USING (true) WITH CHECK (true);

-- 2. アセスメント
CREATE TABLE IF NOT EXISTS public.assessments (
  id TEXT PRIMARY KEY,
  facility_id TEXT,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON public.assessments FOR ALL USING (true) WITH CHECK (true);

-- 3. モニタリング
CREATE TABLE IF NOT EXISTS public.monitorings (
  id TEXT PRIMARY KEY,
  facility_id TEXT,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.monitorings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON public.monitorings FOR ALL USING (true) WITH CHECK (true);

-- 4. 個別支援計画
CREATE TABLE IF NOT EXISTS public.isps (
  id TEXT PRIMARY KEY,
  facility_id TEXT,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.isps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON public.isps FOR ALL USING (true) WITH CHECK (true);

-- 5. 有給申請
CREATE TABLE IF NOT EXISTS public.paid_leave_reqs (
  id TEXT PRIMARY KEY,
  facility_id TEXT,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.paid_leave_reqs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON public.paid_leave_reqs FOR ALL USING (true) WITH CHECK (true);

-- 6. 資格・証書
CREATE TABLE IF NOT EXISTS public.qual_docs (
  id TEXT PRIMARY KEY,
  facility_id TEXT,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.qual_docs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON public.qual_docs FOR ALL USING (true) WITH CHECK (true);

-- 7. 出欠データ
CREATE TABLE IF NOT EXISTS public.att_data (
  id TEXT PRIMARY KEY,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.att_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON public.att_data FOR ALL USING (true) WITH CHECK (true);

-- 8. 送迎データ
CREATE TABLE IF NOT EXISTS public.transport_data (
  id TEXT PRIMARY KEY,
  facility_id TEXT,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.transport_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON public.transport_data FOR ALL USING (true) WITH CHECK (true);

-- 9. 国保連請求データ
CREATE TABLE IF NOT EXISTS public.kokuho_data (
  id TEXT PRIMARY KEY,
  facility_id TEXT,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.kokuho_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON public.kokuho_data FOR ALL USING (true) WITH CHECK (true);

-- 10. 個別支援計画 統合レコード（承認フロー対応）
-- docType: assessment / isp_plan / weekly_plan / monitoring / meeting / consent
CREATE TABLE IF NOT EXISTS public.isp_records (
  id TEXT PRIMARY KEY,
  facility_id TEXT,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.isp_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON public.isp_records FOR ALL USING (true) WITH CHECK (true);

-- 11. 個別支援計画 下書き
CREATE TABLE IF NOT EXISTS public.isp_drafts (
  id TEXT PRIMARY KEY,
  facility_id TEXT,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.isp_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON public.isp_drafts FOR ALL USING (true) WITH CHECK (true);
