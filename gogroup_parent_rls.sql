-- ============================================================================
-- gogroup_parent_rls.sql  【GO GROUP本番(jjouwts)・単一テナント版】
-- 🔴1: 保護者(parent)を「自分の子のみ」閲覧に限定する。
-- ・admin/viewer=全件、manager/staff=自施設（現状維持）
-- ・parent = 自分の子(JWT app_metadata.child_id)に紐づく行のみ／児童キー無い表は不可
-- ・org_id条件なし（本番は単一テナント）。write・施設/管理者権限は不変。
-- 既存の各テーブル "<t>_read" ポリシーを動的に書き換える（児童キー列は自動判定）。
-- ============================================================================

-- child_id クレーム取得関数（無ければ作成）
CREATE OR REPLACE FUNCTION public.auth_child_id() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'child_id'), '')
$$;

DO $$
DECLARE
  r record; childcol text; facclause text; parentclause text;
BEGIN
  FOR r IN
    SELECT DISTINCT tablename FROM pg_policies
    WHERE schemaname='public' AND policyname = tablename || '_read'
  LOOP
    -- 児童を指す列を判定
    IF r.tablename = 'users_data' THEN
      childcol := 'id';
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name=r.tablename AND column_name='child_id') THEN
      childcol := 'child_id';
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name=r.tablename AND column_name='user_id') THEN
      childcol := 'user_id';
    ELSE
      childcol := NULL;
    END IF;

    -- 施設列の有無
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name=r.tablename AND column_name='facility_id') THEN
      facclause := 'facility_id = public.auth_facility_id()';
    ELSE
      facclause := 'true';
    END IF;

    parentclause := CASE WHEN childcol IS NOT NULL
      THEN format('%I = public.auth_child_id()', childcol) ELSE 'false' END;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.tablename||'_read', r.tablename);
    EXECUTE format(
      $f$CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (
           public.auth_role() IN ('admin','viewer')
           OR (public.auth_role() IN ('manager','staff') AND (%s))
           OR (public.auth_role() = 'parent' AND (%s))
         )$f$,
      r.tablename||'_read', r.tablename, facclause, parentclause);
  END LOOP;
END $$;

-- 確認: 保護者関連（parentを含む）read ポリシーが再作成されたこと
SELECT tablename, policyname FROM pg_policies
WHERE schemaname='public' AND policyname LIKE '%_read'
ORDER BY tablename LIMIT 60;
