/**
 * saas_parent_rls.mjs — 🔴1修正: 保護者(parent)を児童単位RLSに変更。
 * 各テーブルの _read ポリシーを 3分岐に書き換え:
 *   admin/viewer   → 自法人 全件
 *   manager/staff  → 自法人 自施設（facility_idある表）/ 自法人（無い表）＝現状維持
 *   parent         → 自法人 かつ 自分の子(child_id列 or user_id列 or users_data.id)のみ
 *                    児童キーが無い表(staff_data等)は parent アクセス不可
 * write ポリシーは不変（parentは元々write不可）。org分離・施設職員権限は維持。
 */
import fs from "node:fs";
import pg from "pg";
const env=Object.fromEntries(fs.readFileSync(".saas-env","utf8").trim().split("\n").map(l=>l.split("=")));
const c=new pg.Client({host:env.SAAS_HOST,port:+env.SAAS_PORT,user:env.SAAS_USER,database:env.SAAS_DB,password:env.SAAS_PASSWORD,ssl:{rejectUnauthorized:false}});
const schema=JSON.parse(fs.readFileSync("phase2_schema_map.json","utf8"));
const q=(s)=>c.query(s);

const run=async()=>{
  await c.connect();
  // 児童キー列を取得
  const r=await q(`select table_name, column_name from information_schema.columns
    where table_schema='public' and column_name in ('child_id','user_id')`);
  const cols={};
  r.rows.forEach(x=>{ (cols[x.table_name]=cols[x.table_name]||[]).push(x.column_name); });

  let updated=0, parentOK=0, parentNo=0;
  for(const [t,info] of Object.entries(schema)){
    const hasFac = !!(info.cols && info.cols.facility_id);
    let childCol=null;
    if(t==='users_data') childCol='id';
    else if((cols[t]||[]).includes('child_id')) childCol='child_id';
    else if((cols[t]||[]).includes('user_id')) childCol='user_id';

    const facClause = hasFac ? 'facility_id = public.auth_facility_id()' : 'true';
    const parentClause = childCol ? `"${childCol}" = public.auth_child_id()` : 'false';
    if(childCol) parentOK++; else parentNo++;

    await q(`DROP POLICY IF EXISTS "${t}_read" ON public."${t}"`);
    await q(`CREATE POLICY "${t}_read" ON public."${t}" FOR SELECT TO authenticated
      USING (
        org_id = public.auth_org_id() AND (
          public.auth_role() IN ('admin','viewer')
          OR (public.auth_role() IN ('manager','staff') AND (${facClause}))
          OR (public.auth_role() = 'parent' AND (${parentClause}))
        )
      )`);
    updated++;
  }
  console.log(`✅ readポリシー書換: ${updated}テーブル`);
  console.log(`   保護者アクセス可(児童キー有): ${parentOK} / 不可(キー無=staff等): ${parentNo}`);
  await c.end();
};
run().catch(e=>{console.error("エラー:",e.message);process.exit(1);});
