/**
 * saas_rls.mjs — 新SaaS DBに法人単位RLSを適用。
 * ・全テナントテーブル: org_id = auth_org_id() を必須（法人完全分離）
 *   read : 自法人内で admin/viewer=全施設 / その他=自施設（facility_id列がある場合）
 *   write: 自法人内で admin=全施設 / manager,staff=自施設（viewer/parentは不可）
 * ・facility_id 列が無いテーブルは org 単位のみで分離
 * ・organizations/facilities は自法人の参照のみ
 * anonはorg_idクレームが無い＝''で一致せず全行0件（自動遮断）。
 */
import fs from "node:fs";
import pg from "pg";
const env = Object.fromEntries(fs.readFileSync(".saas-env","utf8").trim().split("\n").map(l=>l.split("=")));
const client = new pg.Client({host:env.SAAS_HOST,port:+env.SAAS_PORT,user:env.SAAS_USER,database:env.SAAS_DB,password:env.SAAS_PASSWORD,ssl:{rejectUnauthorized:false}});
const schema = JSON.parse(fs.readFileSync("phase2_schema_map.json","utf8"));

const q = (s)=>client.query(s);
const run = async () => {
  await client.connect();
  let facCount=0, orgOnly=0;
  for (const [t, info] of Object.entries(schema)) {
    const hasFac = !!(info.cols && info.cols.facility_id);
    await q(`ALTER TABLE public."${t}" ENABLE ROW LEVEL SECURITY`);
    // 既存ポリシー全削除
    const pol = await q(`SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='${t}'`);
    for (const r of pol.rows) await q(`DROP POLICY IF EXISTS "${r.policyname}" ON public."${t}"`);

    if (hasFac) {
      await q(`CREATE POLICY "${t}_read" ON public."${t}" FOR SELECT TO authenticated
        USING (org_id = public.auth_org_id()
               AND (public.auth_role() IN ('admin','viewer') OR facility_id = public.auth_facility_id()))`);
      await q(`CREATE POLICY "${t}_write" ON public."${t}" FOR ALL TO authenticated
        USING (org_id = public.auth_org_id()
               AND (public.auth_role()='admin' OR (public.auth_role() IN ('manager','staff') AND facility_id = public.auth_facility_id())))
        WITH CHECK (org_id = public.auth_org_id()
               AND (public.auth_role()='admin' OR (public.auth_role() IN ('manager','staff') AND facility_id = public.auth_facility_id())))`);
      facCount++;
    } else {
      await q(`CREATE POLICY "${t}_read" ON public."${t}" FOR SELECT TO authenticated
        USING (org_id = public.auth_org_id())`);
      await q(`CREATE POLICY "${t}_write" ON public."${t}" FOR ALL TO authenticated
        USING (org_id = public.auth_org_id() AND public.auth_role() IN ('admin','manager','staff'))
        WITH CHECK (org_id = public.auth_org_id() AND public.auth_role() IN ('admin','manager','staff'))`);
      orgOnly++;
    }
  }
  // organizations / facilities
  await q(`ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY`);
  await q(`DROP POLICY IF EXISTS org_read ON public.organizations`);
  await q(`CREATE POLICY org_read ON public.organizations FOR SELECT TO authenticated USING (id = public.auth_org_id())`);
  await q(`ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY`);
  await q(`DROP POLICY IF EXISTS fac_read ON public.facilities`);
  await q(`DROP POLICY IF EXISTS fac_write ON public.facilities`);
  await q(`CREATE POLICY fac_read ON public.facilities FOR SELECT TO authenticated USING (org_id = public.auth_org_id())`);
  await q(`CREATE POLICY fac_write ON public.facilities FOR ALL TO authenticated
    USING (org_id = public.auth_org_id() AND public.auth_role()='admin')
    WITH CHECK (org_id = public.auth_org_id() AND public.auth_role()='admin')`);

  console.log(`✅ RLS適用完了: 施設分離テーブル ${facCount} / org単位のみ ${orgOnly} / organizations・facilities`);
  const c = await q(`SELECT count(*) FROM pg_policies WHERE schemaname='public'`);
  console.log(`   総ポリシー数: ${c.rows[0].count}`);
  await client.end();
};
run().catch(e=>{console.error("エラー:",e.message);process.exit(1);});
