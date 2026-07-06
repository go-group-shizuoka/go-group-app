-- ============================================================================
-- rls_phase1_fix.sql
-- rls_phase1_complete.sql の補正版。
-- 過去マイグレーションで作られた「別名の開放ポリシー」が残って分離が効かない問題を解消。
-- → 対象25テーブルの【既存ポリシーを名前に関係なく全削除】してから貼り直す。
-- 既存の業務データには一切触れない（ポリシー定義のみ操作）。
-- ============================================================================

-- ヘルパー関数（存在すれば置き換え）
CREATE OR REPLACE FUNCTION public.auth_facility_id() RETURNS TEXT
  LANGUAGE sql STABLE AS $$ SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'facility_id'), '') $$;
CREATE OR REPLACE FUNCTION public.auth_role() RETURNS TEXT
  LANGUAGE sql STABLE AS $$ SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role'), auth.role()) $$;
CREATE OR REPLACE FUNCTION public.auth_child_id() RETURNS TEXT
  LANGUAGE sql STABLE AS $$ SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'child_id'), '') $$;

DO $$
DECLARE
  t text;
  pol record;
  fac_tables text[] := ARRAY[
    'assessments','daily_reports','dev_records','facesheets','isp_drafts',
    'isp_records','isps','jukyusha_docs','kokuho_data','messages',
    'monitoring_notes','monitorings','parent_support_records','paid_leave_reqs',
    'qual_docs','records','schedules','soudan_genans','transport_data',
    'users_data','visit_dests','visit_records','staff_data'
  ];
  all_tables text[];
BEGIN
  all_tables := fac_tables || ARRAY['att_data','shifts'];

  -- ① 対象テーブルの既存ポリシーを名前に関係なく全削除 + RLS有効化
  FOREACH t IN ARRAY all_tables LOOP
    IF to_regclass('public.'||t) IS NULL THEN
      RAISE NOTICE 'skip (not found): %', t;  CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename=t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;
  END LOOP;

  -- ② facility_id 直持ちテーブル: read/write ポリシー作成
  FOREACH t IN ARRAY fac_tables LOOP
    IF to_regclass('public.'||t) IS NULL THEN CONTINUE; END IF;

    IF t = 'staff_data' THEN
      -- staff_data は書き込みを admin/manager のみに限定
      EXECUTE format($f$
        CREATE POLICY "%1$s_read" ON public.%1$I FOR SELECT TO authenticated
        USING (public.auth_role() IN ('admin','viewer') OR facility_id = public.auth_facility_id())$f$, t);
      EXECUTE format($f$
        CREATE POLICY "%1$s_write" ON public.%1$I FOR ALL TO authenticated
        USING (public.auth_role() = 'admin' OR (public.auth_role() = 'manager' AND facility_id = public.auth_facility_id()))
        WITH CHECK (public.auth_role() = 'admin' OR (public.auth_role() = 'manager' AND facility_id = public.auth_facility_id()))$f$, t);
    ELSE
      EXECUTE format($f$
        CREATE POLICY "%1$s_read" ON public.%1$I FOR SELECT TO authenticated
        USING (public.auth_role() IN ('admin','viewer') OR facility_id = public.auth_facility_id())$f$, t);
      EXECUTE format($f$
        CREATE POLICY "%1$s_write" ON public.%1$I FOR ALL TO authenticated
        USING (public.auth_role() = 'admin' OR (public.auth_role() IN ('manager','staff') AND facility_id = public.auth_facility_id()))
        WITH CHECK (public.auth_role() = 'admin' OR (public.auth_role() IN ('manager','staff') AND facility_id = public.auth_facility_id()))$f$, t);
    END IF;
  END LOOP;

  -- ③ att_data（user_id経由で施設判定）
  IF to_regclass('public.att_data') IS NOT NULL THEN
    CREATE POLICY "att_data_read" ON public.att_data FOR SELECT TO authenticated
      USING (public.auth_role() IN ('admin','viewer')
             OR EXISTS (SELECT 1 FROM public.users_data u WHERE u.id = att_data.user_id AND u.facility_id = public.auth_facility_id()));
    CREATE POLICY "att_data_write" ON public.att_data FOR ALL TO authenticated
      USING (public.auth_role() = 'admin'
             OR (public.auth_role() IN ('manager','staff')
                 AND EXISTS (SELECT 1 FROM public.users_data u WHERE u.id = att_data.user_id AND u.facility_id = public.auth_facility_id())))
      WITH CHECK (public.auth_role() = 'admin'
             OR (public.auth_role() IN ('manager','staff')
                 AND EXISTS (SELECT 1 FROM public.users_data u WHERE u.id = att_data.user_id AND u.facility_id = public.auth_facility_id())));
  END IF;

  -- ④ shifts（staff_id経由で施設判定）
  IF to_regclass('public.shifts') IS NOT NULL THEN
    CREATE POLICY "shifts_read" ON public.shifts FOR SELECT TO authenticated
      USING (public.auth_role() IN ('admin','viewer')
             OR EXISTS (SELECT 1 FROM public.staff_data s WHERE s.id = shifts.staff_id AND s.facility_id = public.auth_facility_id()));
    CREATE POLICY "shifts_write" ON public.shifts FOR ALL TO authenticated
      USING (public.auth_role() = 'admin'
             OR (public.auth_role() IN ('manager','staff')
                 AND EXISTS (SELECT 1 FROM public.staff_data s WHERE s.id = shifts.staff_id AND s.facility_id = public.auth_facility_id())))
      WITH CHECK (public.auth_role() = 'admin'
             OR (public.auth_role() IN ('manager','staff')
                 AND EXISTS (SELECT 1 FROM public.staff_data s WHERE s.id = shifts.staff_id AND s.facility_id = public.auth_facility_id())));
  END IF;
END $$;

-- ============================================================================
-- 最終確認（この結果が画面に表示される）:
-- 各テーブルに残るポリシーは *_read / *_write のみのはず。開放ポリシーが無いこと。
-- ============================================================================
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname='public'
  AND tablename IN (
    'assessments','att_data','daily_reports','dev_records','facesheets','isp_drafts',
    'isp_records','isps','jukyusha_docs','kokuho_data','messages','monitoring_notes',
    'monitorings','paid_leave_reqs','parent_support_records','qual_docs','records',
    'schedules','shifts','soudan_genans','staff_data','transport_data','users_data',
    'visit_dests','visit_records')
ORDER BY tablename, policyname;
