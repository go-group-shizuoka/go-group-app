-- ============================================================================
-- rls_phase1_gap.sql
-- 本番品質確認で判明した「RLS未適用テーブル（匿名で実データが読めるギャップ）」を封鎖。
-- 対象: アプリが使用するがコア25テーブルに含まれていなかった残りのテーブル群。
-- 方式（列の有無を動的判定して自動適用・UI変更なし・既存データ不変）:
--   ・facility_id 列がある → 施設分離（read: admin/viewer=全, 他=自施設 / write: admin or 自施設manager/staff）
--   ・facility_id 列がない → 認証必須のみ（匿名遮断・ログイン中は全員可）
-- 既存ポリシーは名前に関係なく全削除してから貼り直す（旧開放ポリシー掃除）。
-- ============================================================================

DO $$
DECLARE
  t text;
  pol record;
  has_fac boolean;
  gap_tables text[] := ARRAY[
    'absence_reports','activity_records','addition_items','announcement_reads','announcements',
    'audit_checks','billing_audit_log','billing_check_results','billing_items','child_documents',
    'claim_history','document_page_groups','isp_audit_log','kintai_corrections','manual_review_queue',
    'monthly_locks','ocr_analysis_logs','ocr_correction_logs','page_merge_history','parent_contacts',
    'photo_albums','planned_visits','service_records','staff_attendance','staff_doc_audit_log',
    'staff_doc_notifications','staff_doc_update_requests','staff_documents','support_plans',
    'survey_responses','surveys','transport_logs'
  ];
BEGIN
  FOREACH t IN ARRAY gap_tables LOOP
    IF to_regclass('public.'||t) IS NULL THEN
      RAISE NOTICE 'skip (not found): %', t;  CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    -- 既存ポリシー全削除
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;

    -- facility_id 列の有無を判定
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=t AND column_name='facility_id'
    ) INTO has_fac;

    IF has_fac THEN
      -- 施設分離（コアテーブルと同じ方針）
      EXECUTE format($f$
        CREATE POLICY "%1$s_read" ON public.%1$I FOR SELECT TO authenticated
        USING (public.auth_role() IN ('admin','viewer') OR facility_id = public.auth_facility_id())$f$, t);
      EXECUTE format($f$
        CREATE POLICY "%1$s_write" ON public.%1$I FOR ALL TO authenticated
        USING (public.auth_role() = 'admin' OR (public.auth_role() IN ('manager','staff') AND facility_id = public.auth_facility_id()))
        WITH CHECK (public.auth_role() = 'admin' OR (public.auth_role() IN ('manager','staff') AND facility_id = public.auth_facility_id()))$f$, t);
    ELSE
      -- facility_id が無いテーブル: 匿名遮断のみ（ログイン済みは全員可）
      EXECUTE format($f$
        CREATE POLICY "%1$s_authed" ON public.%1$I FOR ALL TO authenticated
        USING (true) WITH CHECK (true)$f$, t);
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- 確認（この結果が表示される）: 対象テーブルにポリシーが付き、rowsecurity=trueであること
-- ============================================================================
SELECT c.relname AS tablename, c.relrowsecurity AS rls_on,
       count(p.policyname) AS policies
FROM pg_class c
LEFT JOIN pg_policies p ON p.schemaname='public' AND p.tablename=c.relname
WHERE c.relnamespace='public'::regnamespace AND c.relkind='r'
  AND c.relname IN (
    'absence_reports','activity_records','addition_items','announcement_reads','announcements',
    'audit_checks','billing_audit_log','billing_check_results','billing_items','child_documents',
    'claim_history','document_page_groups','isp_audit_log','kintai_corrections','manual_review_queue',
    'monthly_locks','ocr_analysis_logs','ocr_correction_logs','page_merge_history','parent_contacts',
    'photo_albums','planned_visits','service_records','staff_attendance','staff_doc_audit_log',
    'staff_doc_notifications','staff_doc_update_requests','staff_documents','support_plans',
    'survey_responses','surveys','transport_logs')
GROUP BY c.relname, c.relrowsecurity
ORDER BY c.relname;
