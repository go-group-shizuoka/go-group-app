/**
 * saas_storage.mjs — Storageを法人単位で分離。
 * ・4バケット作成（全て private＝公開URLでの他法人流出を防ぐ）
 * ・storage.objects に org 単位RLS: パス先頭フォルダ = org_id のみ許可
 *   （アップロード時パスを "{org_id}/{facility_id}/..." にする前提。コード側はSTEP-2で対応）
 * ・org_1/org_2 の疑似オブジェクトで分離を実測
 */
import fs from "node:fs";
import pg from "pg";
const env=Object.fromEntries(fs.readFileSync(".saas-env","utf8").trim().split("\n").map(l=>l.split("=")));
const c=new pg.Client({host:env.SAAS_HOST,port:+env.SAAS_PORT,user:env.SAAS_USER,database:env.SAAS_DB,password:env.SAAS_PASSWORD,ssl:{rejectUnauthorized:false}});
const q=(s)=>c.query(s);
const claims=(org)=>JSON.stringify({role:"authenticated",app_metadata:{org_id:org,role:"staff",facility_id:"f1"}});

const run=async()=>{
  await c.connect();
  // ① バケット作成（全private）
  await q(`INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types) VALUES
    ('album-photos','album-photos',false,10485760,ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']),
    ('daily-photos','daily-photos',false,10485760,ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']),
    ('staff-documents','staff-documents',false,52428800,ARRAY['image/jpeg','image/png','image/webp','application/pdf']),
    ('child-documents','child-documents',false,52428800,ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
    ON CONFLICT (id) DO UPDATE SET public=false`);
  console.log("① 4バケット作成（全private）");

  // ② storage.objects に org 単位RLS（所有者ロールに切替）
  await q(`SET ROLE supabase_storage_admin`);
  await q(`ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY`);
  for(const p of ["obj_org_read","obj_org_write"]) await q(`DROP POLICY IF EXISTS ${p} ON storage.objects`);
  await q(`CREATE POLICY obj_org_read ON storage.objects FOR SELECT TO authenticated
    USING ((storage.foldername(name))[1] = public.auth_org_id())`);
  await q(`CREATE POLICY obj_org_write ON storage.objects FOR ALL TO authenticated
    USING ((storage.foldername(name))[1] = public.auth_org_id())
    WITH CHECK ((storage.foldername(name))[1] = public.auth_org_id())`);
  await q(`RESET ROLE`);
  console.log("② storage.objects に法人単位RLS適用（パス先頭=org_id）");

  // ③ 疑似オブジェクトで分離テスト（storage_adminで投入=RLSバイパス）
  await q(`SET ROLE supabase_storage_admin`);
  await q(`DELETE FROM storage.objects WHERE name LIKE 'org_%/ISOTEST_%'`);
  await q(`INSERT INTO storage.objects(bucket_id,name,owner) VALUES
    ('child-documents','org_1/ISOTEST_a.pdf',NULL),
    ('child-documents','org_2/ISOTEST_b.pdf',NULL),
    ('album-photos','org_1/ISOTEST_c.jpg',NULL),
    ('album-photos','org_2/ISOTEST_d.jpg',NULL)`);
  await q(`RESET ROLE`);
  console.log("③ 疑似ファイル投入: org_1×2 + org_2×2\n");

  async function seenBy(org){
    await q(`BEGIN`);
    await q(`SELECT set_config('request.jwt.claims','${claims(org)}',true)`);
    await q(`SET LOCAL ROLE authenticated`);
    const r=await q(`SELECT count(*)::int n, string_agg(name,', ') names FROM storage.objects WHERE name LIKE 'org_%/ISOTEST_%'`);
    await q(`ROLLBACK`);
    return r.rows[0];
  }
  const o1=await seenBy("org_1"), o2=await seenBy("org_2");
  console.log("Storage法人分離（各法人ユーザーから見える疑似ファイル）:");
  console.log(`  org_1ユーザー: ${o1.n}件  [${o1.names||""}]`);
  console.log(`  org_2ユーザー: ${o2.n}件  [${o2.names||""}]`);
  const pass = o1.n===2 && o2.n===2 && !(o1.names||"").includes("org_2") && !(o2.names||"").includes("org_1");
  console.log(`  判定: ${pass?"✅ 各法人は自法人のファイルのみ・相手法人は不可視":"🔴 分離不十分"}`);

  // cleanup
  await q(`SET ROLE supabase_storage_admin`);
  await q(`DELETE FROM storage.objects WHERE name LIKE 'org_%/ISOTEST_%'`);
  await q(`RESET ROLE`);
  console.log("\n④ 疑似ファイル削除完了。");
  await c.end();
};
run().catch(e=>{console.error("エラー:",e.message);process.exit(1);});
