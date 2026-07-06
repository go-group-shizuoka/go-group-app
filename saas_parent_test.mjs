/**
 * saas_parent_test.mjs — 保護者 児童単位RLS の検証（4ケース）
 * ① 保護者A → 児童Aのみ / ② 保護者A → 児童B不可 / ③ 職員 → 施設範囲 / ④ 管理者 → 全体
 */
import fs from "node:fs";
import pg from "pg";
const env=Object.fromEntries(fs.readFileSync(".saas-env","utf8").trim().split("\n").map(l=>l.split("=")));
const c=new pg.Client({host:env.SAAS_HOST,port:+env.SAAS_PORT,user:env.SAAS_USER,database:env.SAAS_DB,password:env.SAAS_PASSWORD,ssl:{rejectUnauthorized:false}});
const q=(s)=>c.query(s);
const claims=(o)=>JSON.stringify({role:"authenticated",app_metadata:o});
async function asUser(meta,fn){ await q(`BEGIN`); await q(`SELECT set_config('request.jwt.claims','${claims(meta)}',true)`); await q(`SET LOCAL ROLE authenticated`); const r=await fn(); await q(`ROLLBACK`); return r; }
async function seen(table){ const r=await q(`SELECT id FROM public."${table}" WHERE id LIKE 'PT_%' ORDER BY id`); return r.rows.map(x=>x.id); }

const run=async()=>{
  await c.connect();
  // seed: 児童A/B（同一法人org_1・同一施設f1）＋ 子ごとの記録(service_records) ＋ 職員
  for(const t of ["users_data","service_records","staff_data"]) await q(`DELETE FROM public."${t}" WHERE id LIKE 'PT_%'`);
  await q(`INSERT INTO public.users_data(id,org_id,facility_id) VALUES('PT_childA','org_1','f1'),('PT_childB','org_1','f1')`);
  await q(`INSERT INTO public.service_records(id,org_id,facility_id,child_id) VALUES('PT_recA','org_1','f1','PT_childA'),('PT_recB','org_1','f1','PT_childB')`);
  await q(`INSERT INTO public.staff_data(id,org_id,facility_id) VALUES('PT_staff1','org_1','f1')`);
  console.log("seed: 児童A/B・記録A/B(service_records)・職員1 を投入\n");

  console.log("① 保護者A(child_id=PT_childA) の可視範囲 ─────────");
  const pa=await asUser({org_id:"org_1",role:"parent",facility_id:"f1",child_id:"PT_childA"}, async()=>({
    users:await seen("users_data"), recs:await seen("service_records"), staff:await seen("staff_data")
  }));
  console.log("   児童(users_data):", pa.users.join(",")||"なし", pa.users.length===1&&pa.users[0]==="PT_childA"?"✅Aのみ":"🔴");
  console.log("   子の記録(service):", pa.recs.join(",")||"なし", pa.recs.length===1&&pa.recs[0]==="PT_recA"?"✅Aのみ":"🔴");
  console.log("   職員(staff_data):", pa.staff.join(",")||"なし", pa.staff.length===0?"✅不可(正常)":"🔴見えてる");

  console.log("\n② 保護者A → 児童B は見えないか ─────────");
  console.log("   PT_childB 含む?:", pa.users.includes("PT_childB")?"🔴含む":"✅含まない(正常)");
  console.log("   PT_recB 含む?  :", pa.recs.includes("PT_recB")?"🔴含む":"✅含まない(正常)");

  console.log("\n③ 職員(f1) の可視範囲（施設の児童=両方見える＝現状維持） ─────────");
  const st=await asUser({org_id:"org_1",role:"staff",facility_id:"f1"}, async()=>({users:await seen("users_data"),staff:await seen("staff_data")}));
  console.log("   児童:", st.users.join(",")||"なし", st.users.length===2?"✅A+B両方(施設権限維持)":"⚠️");
  console.log("   職員:", st.staff.join(",")||"なし", st.staff.length>=1?"✅閲覧可(維持)":"⚠️");

  console.log("\n④ 管理者 の可視範囲（全体） ─────────");
  const ad=await asUser({org_id:"org_1",role:"admin",facility_id:""}, async()=>({users:await seen("users_data"),staff:await seen("staff_data")}));
  console.log("   児童:", ad.users.join(",")||"なし", ad.users.length===2?"✅全体":"⚠️");
  console.log("   職員:", ad.staff.join(",")||"なし", ad.staff.length>=1?"✅全体":"⚠️");

  console.log("\n(参考) 他法人org_2の保護者からは？ ─────────");
  const o2=await asUser({org_id:"org_2",role:"parent",facility_id:"g1",child_id:"PT_childA"}, async()=>({users:await seen("users_data")}));
  console.log("   org_2保護者が org_1児童Aを見える?:", o2.users.length===0?"✅不可(法人分離維持)":"🔴漏洩");

  for(const t of ["users_data","service_records","staff_data"]) await q(`DELETE FROM public."${t}" WHERE id LIKE 'PT_%'`);
  console.log("\ncleanup 完了。");
  await c.end();
};
run().catch(e=>{console.error("エラー:",e.message);process.exit(1);});
