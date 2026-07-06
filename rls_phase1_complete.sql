-- ============================================================================
-- rls_phase1_complete.sql
-- Phase1 段階4: 全テーブル RLS 完全有効化（テナント＝施設単位の分離）
-- ----------------------------------------------------------------------------
-- ⚠️⚠️ 実行タイミング厳守（順序を誤ると本番が「ログインできるのに空表示」になる）⚠️⚠️
--   前提: 段階1(migration_phase1_auth.mjs --apply 済み)
--        段階2(JWT対応コードを本番デプロイ済み)
--        全職員が一度 Supabase Auth でログインし直している
--   → その状態を確認してから、このSQLを最後に実行する。
--
-- 方針:
--   ・全テーブルの開放ポリシー anon_all(USING true) を廃止
--   ・JWT app_metadata.role / facility_id を参照して施設単位に分離
--   ・読み取り: admin/viewer=全施設、manager/staff/parent=自施設のみ
--   ・書き込み: admin=全施設、manager/staff=自施設のみ（viewer/parentは不可）
--   ・staff_data は書き込みを admin/manager のみに限定（権限昇格防止）
--   ・att_data(user_id)・shifts(staff_id) は所属施設を辿って判定
--   ※ 本アプリは現状「単一法人・複数施設」。将来のSaaS(複数法人)は
--     org_id 層の追加が必要（案B: 販売用は別Supabase）。ここでは施設=テナント境界。
--
-- ロールバックは末尾（コメントアウト）参照。
-- ============================================================================

-- ─── ヘルパー関数（JWTクレーム読み取り）───
CREATE OR REPLACE FUNCTION public.auth_facility_id() RETURNS TEXT
  LANGUAGE sql STABLE AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'facility_id'), '')
$$;

CREATE OR REPLACE FUNCTION public.auth_role() RETURNS TEXT
  LANGUAGE sql STABLE AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role'), auth.role())
$$;

CREATE OR REPLACE FUNCTION public.auth_child_id() RETURNS TEXT
  LANGUAGE sql STABLE AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'child_id'), '')
$$;

-- ============================================================================
-- A. facility_id を直接持つテーブル（22件）に read/write ポリシーを一括適用
-- ============================================================================
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'assessments','daily_reports','dev_records','facesheets','isp_drafts',
    'isp_records','isps','jukyusha_docs','kokuho_data','messages',
    'monitoring_notes','monitorings','parent_support_records','paid_leave_reqs',
    'qual_docs','records','schedules','soudan_genans','transport_data',
    'users_data','visit_dests','visit_records'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'skip (not found): %', t;  CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    -- 旧ポリシー廃棄（開放・旧facility版）
    EXECUTE format('DROP POLICY IF EXISTS "anon_all" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "allow_all" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_facility_policy" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_read" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_write" ON public.%I', t, t);

    -- 読み取り: admin/viewer=全施設、その他=自施設
    EXECUTE format($f$
      CREATE POLICY "%1$s_read" ON public.%1$I FOR SELECT TO authenticated
      USING (
        public.auth_role() IN ('admin','viewer')
        OR facility_id = public.auth_facility_id()
      )$f$, t);

    -- 書き込み: admin=全施設、manager/staff=自施設のみ
    EXECUTE format($f$
      CREATE POLICY "%1$s_write" ON public.%1$I FOR ALL TO authenticated
      USING (
        public.auth_role() = 'admin'
        OR (public.auth_role() IN ('manager','staff') AND facility_id = public.auth_facility_id())
      )
      WITH CHECK (
        public.auth_role() = 'admin'
        OR (public.auth_role() IN ('manager','staff') AND facility_id = public.auth_facility_id())
      )$f$, t);
  END LOOP;
END $$;

-- ============================================================================
-- B. staff_data（職員情報）: 読みは自施設、書きは admin/manager のみ
--    → 一般職員が自分や他者の role を書き換える権限昇格を防ぐ
-- ============================================================================
ALTER TABLE public.staff_data ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all" ON public.staff_data;
DROP POLICY IF EXISTS "allow_all" ON public.staff_data;
DROP POLICY IF EXISTS "staff_data_facility_policy" ON public.staff_data;
DROP POLICY IF EXISTS "staff_data_read" ON public.staff_data;
DROP POLICY IF EXISTS "staff_data_write" ON public.staff_data;

CREATE POLICY "staff_data_read" ON public.staff_data FOR SELECT TO authenticated
  USING (
    public.auth_role() IN ('admin','viewer')
    OR facility_id = public.auth_facility_id()
  );

CREATE POLICY "staff_data_write" ON public.staff_data FOR ALL TO authenticated
  USING (
    public.auth_role() = 'admin'
    OR (public.auth_role() = 'manager' AND facility_id = public.auth_facility_id())
  )
  WITH CHECK (
    public.auth_role() = 'admin'
    OR (public.auth_role() = 'manager' AND facility_id = public.auth_facility_id())
  );

-- ============================================================================
-- C. att_data（出欠・user_id経由で施設判定）
-- ============================================================================
ALTER TABLE public.att_data ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all" ON public.att_data;
DROP POLICY IF EXISTS "allow_all" ON public.att_data;
DROP POLICY IF EXISTS "att_data_read" ON public.att_data;
DROP POLICY IF EXISTS "att_data_write" ON public.att_data;

CREATE POLICY "att_data_read" ON public.att_data FOR SELECT TO authenticated
  USING (
    public.auth_role() IN ('admin','viewer')
    OR EXISTS (SELECT 1 FROM public.users_data u
               WHERE u.id = att_data.user_id AND u.facility_id = public.auth_facility_id())
  );

CREATE POLICY "att_data_write" ON public.att_data FOR ALL TO authenticated
  USING (
    public.auth_role() = 'admin'
    OR (public.auth_role() IN ('manager','staff')
        AND EXISTS (SELECT 1 FROM public.users_data u
                    WHERE u.id = att_data.user_id AND u.facility_id = public.auth_facility_id()))
  )
  WITH CHECK (
    public.auth_role() = 'admin'
    OR (public.auth_role() IN ('manager','staff')
        AND EXISTS (SELECT 1 FROM public.users_data u
                    WHERE u.id = att_data.user_id AND u.facility_id = public.auth_facility_id()))
  );

-- ============================================================================
-- D. shifts（シフト・staff_id経由で施設判定）
-- ============================================================================
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all" ON public.shifts;
DROP POLICY IF EXISTS "allow_all" ON public.shifts;
DROP POLICY IF EXISTS "shifts_facility_policy" ON public.shifts;
DROP POLICY IF EXISTS "shifts_read" ON public.shifts;
DROP POLICY IF EXISTS "shifts_write" ON public.shifts;

CREATE POLICY "shifts_read" ON public.shifts FOR SELECT TO authenticated
  USING (
    public.auth_role() IN ('admin','viewer')
    OR EXISTS (SELECT 1 FROM public.staff_data s
               WHERE s.id = shifts.staff_id AND s.facility_id = public.auth_facility_id())
  );

CREATE POLICY "shifts_write" ON public.shifts FOR ALL TO authenticated
  USING (
    public.auth_role() = 'admin'
    OR (public.auth_role() IN ('manager','staff')
        AND EXISTS (SELECT 1 FROM public.staff_data s
                    WHERE s.id = shifts.staff_id AND s.facility_id = public.auth_facility_id()))
  )
  WITH CHECK (
    public.auth_role() = 'admin'
    OR (public.auth_role() IN ('manager','staff')
        AND EXISTS (SELECT 1 FROM public.staff_data s
                    WHERE s.id = shifts.staff_id AND s.facility_id = public.auth_facility_id()))
  );

-- ============================================================================
-- E. 検証クエリ（適用後に流して確認）
--   ・開放ポリシーが残っていないこと
--   ・全対象テーブルで rowsecurity = true であること
-- ============================================================================
-- SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE schemaname='public' AND policyname IN ('anon_all','allow_all');   -- 0件であること
-- SELECT relname, relrowsecurity FROM pg_class
--   WHERE relnamespace='public'::regnamespace AND relkind='r' ORDER BY relname;

-- ============================================================================
-- F. ロールバック（緊急時のみ・実行するとテナント分離が無効に戻る）
-- ============================================================================
-- DO $$
-- DECLARE t text; tables text[] := ARRAY[
--   'assessments','att_data','daily_reports','dev_records','facesheets','isp_drafts',
--   'isp_records','isps','jukyusha_docs','kokuho_data','messages','monitoring_notes',
--   'monitorings','paid_leave_reqs','parent_support_records','qual_docs','records',
--   'schedules','shifts','soudan_genans','staff_data','transport_data','users_data',
--   'visit_dests','visit_records'];
-- BEGIN
--   FOREACH t IN ARRAY tables LOOP
--     IF to_regclass('public.'||t) IS NULL THEN CONTINUE; END IF;
--     EXECUTE format('DROP POLICY IF EXISTS "%1$s_read" ON public.%1$I', t);
--     EXECUTE format('DROP POLICY IF EXISTS "%1$s_write" ON public.%1$I', t);
--     EXECUTE format('CREATE POLICY "anon_all" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t);
--   END LOOP;
-- END $$;
