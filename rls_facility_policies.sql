-- =============================================================
-- rls_facility_policies.sql
-- 施設別RLSポリシー設計
-- ⚠️ 注意: このSQLはSupabase Auth移行後に実行してください
--          現在はフロントコードでのフィルタ（暫定）を使用中
-- =============================================================
-- 前提: auth.jwt() -> app_metadata.facility_id / app_metadata.role が設定済みであること
-- Supabase Auth でログイン後、カスタムJWTクレームが必要:
--   facility_id: "f1" | "f2" | "f3" | "f4"
--   role:        "admin" | "manager" | "staff" | "parent"
-- =============================================================

-- ─── ヘルパー関数: JWTクレームから施設IDを取得 ───
CREATE OR REPLACE FUNCTION public.auth_facility_id()
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'facility_id'),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_role()
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    auth.role()
  );
$$;

-- =============================================================
-- records（入退室記録）
-- =============================================================
DROP POLICY IF EXISTS "records_facility_policy" ON public.records;
CREATE POLICY "records_facility_policy" ON public.records
  FOR ALL USING (
    public.auth_role() = 'admin'                        -- admin: 全施設
    OR facility_id = public.auth_facility_id()          -- manager/staff: 自施設のみ
  )
  WITH CHECK (
    public.auth_role() = 'admin'
    OR facility_id = public.auth_facility_id()
  );

-- =============================================================
-- users_data（利用者情報）
-- =============================================================
DROP POLICY IF EXISTS "users_data_facility_policy" ON public.users_data;
CREATE POLICY "users_data_facility_policy" ON public.users_data
  FOR ALL USING (
    public.auth_role() = 'admin'
    OR facility_id = public.auth_facility_id()
  )
  WITH CHECK (
    public.auth_role() = 'admin'
    OR facility_id = public.auth_facility_id()
  );

-- =============================================================
-- staff_data（職員情報）
-- =============================================================
DROP POLICY IF EXISTS "staff_data_facility_policy" ON public.staff_data;
CREATE POLICY "staff_data_facility_policy" ON public.staff_data
  FOR ALL USING (
    public.auth_role() = 'admin'
    OR facility_id = public.auth_facility_id()
    OR id = (auth.jwt() -> 'app_metadata' ->> 'staff_id')  -- staff: 自分自身のみ
  )
  WITH CHECK (
    public.auth_role() IN ('admin','manager')
    OR facility_id = public.auth_facility_id()
  );

-- =============================================================
-- messages（保護者連絡）
-- =============================================================
DROP POLICY IF EXISTS "messages_facility_policy" ON public.messages;
CREATE POLICY "messages_facility_policy" ON public.messages
  FOR ALL USING (
    public.auth_role() = 'admin'
    OR facility_id = public.auth_facility_id()
  )
  WITH CHECK (
    public.auth_role() IN ('admin','manager','staff')
    AND (public.auth_role() = 'admin' OR facility_id = public.auth_facility_id())
  );

-- =============================================================
-- claim_history / billing_audit_log（請求データ）
-- admin / manager のみ
-- =============================================================
DROP POLICY IF EXISTS "claim_history_mgr_policy" ON public.claim_history;
CREATE POLICY "claim_history_mgr_policy" ON public.claim_history
  FOR ALL USING (
    public.auth_role() IN ('admin','manager')
    AND (public.auth_role() = 'admin' OR facility_id = public.auth_facility_id())
  );

DROP POLICY IF EXISTS "billing_audit_log_mgr_policy" ON public.billing_audit_log;
CREATE POLICY "billing_audit_log_mgr_policy" ON public.billing_audit_log
  FOR ALL USING (
    public.auth_role() IN ('admin','manager')
    AND (public.auth_role() = 'admin' OR facility_id = public.auth_facility_id())
  );

-- =============================================================
-- staff_documents（職員書類）
-- admin / manager のみ
-- =============================================================
DROP POLICY IF EXISTS "staff_documents_mgr_policy" ON public.staff_documents;
CREATE POLICY "staff_documents_mgr_policy" ON public.staff_documents
  FOR ALL USING (
    public.auth_role() IN ('admin','manager')
    AND (public.auth_role() = 'admin' OR facility_id = public.auth_facility_id())
  );

-- =============================================================
-- shifts / staff_attendance（勤怠）
-- manager以上 OR 自分のデータのみ
-- =============================================================
DROP POLICY IF EXISTS "shifts_policy" ON public.shifts;
CREATE POLICY "shifts_policy" ON public.shifts
  FOR ALL USING (
    public.auth_role() IN ('admin','manager')
    OR (facility_id = public.auth_facility_id()
        AND staff_id = (auth.jwt() -> 'app_metadata' ->> 'staff_id'))
  );

-- =============================================================
-- isps / monitoring（個別支援計画）
-- manager以上 OR 自施設staff
-- =============================================================
DROP POLICY IF EXISTS "isps_policy" ON public.isps;
CREATE POLICY "isps_policy" ON public.isps
  FOR ALL USING (
    public.auth_role() = 'admin'
    OR facility_id = public.auth_facility_id()
  );

-- =============================================================
-- ⚠️ 適用チェックリスト（実行前に必ず確認）
-- [ ] Supabase Auth への完全移行済み
-- [ ] app_metadata に facility_id / role / staff_id が設定済み
-- [ ] 全テーブルの既存 "allow_all_xxx" ポリシーを DROP済み
-- [ ] ステージング環境でテスト済み
-- [ ] 本番データのバックアップ取得済み
-- =============================================================
