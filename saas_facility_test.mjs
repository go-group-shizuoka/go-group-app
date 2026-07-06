/**
 * saas_facility_test.mjs — 施設セレクタ動的化＆施設分離の検証
 * ① 別会社(org_A/org_B)＋施設を作成
 * ② 各会社ユーザーが facilities を読むと「自社施設のみ」返る（アプリのsbLoad("facilities")相当）
 * ③ 他社施設は見えない  ④ 施設の追加は admin のみ・自社のみ  ⑤ 職員/保護者も自社施設のみ
 */
import fs from "node:fs";
import pg from "pg";
const env=Object.fromEntries(fs.readFileSync(".saas-env","utf8").trim().split("\n").map(l=>l.split("=")));
const c=new pg.Client({host:env.SAAS_HOST,port:+env.SAAS_PORT,user:env.SAAS_USER,database:env.SAAS_DB,password:env.SAAS_PASSWORD,ssl:{rejectUnauthorized:false}});
const q=(s)=>c.query(s);
const cl=(o)=>JSON.stringify({role:"authenticated",app_metadata:o});
async function asU(meta,fn){await q("BEGIN");await q(`SELECT set_config('request.jwt.claims','${cl(meta)}',true)`);await q("SET LOCAL ROLE authenticated");let r;try{r=await fn();}finally{await q("ROLLBACK");}return r;}
async function facs(){ return (await q("select id from public.facilities where id like 'FT_%' order by id")).rows.map(x=>x.id); }

const run=async()=>{
  await c.connect();
  // ① seed: org_A(FT_a1,FT_a2) / org_B(FT_b1)
  await q("delete from public.facilities where id like 'FT_%'");
  await q("delete from public.organizations where id in ('org_ftA','org_ftB')");
  await q("insert into public.organizations(id,name) values ('org_ftA','A社'),('org_ftB','B社')");
  await q("insert into public.facilities(id,org_id,name) values ('FT_a1','org_ftA','A本院'),('FT_a2','org_ftA','A分院'),('FT_b1','org_ftB','B院')");
  console.log("① seed: A社(FT_a1,FT_a2) / B社(FT_b1)\n");

  console.log("② 各ロールが読める施設（アプリの施設セレクタに出る一覧＝自社のみが正解）");
  const aAdmin=await asU({role:"admin",org_id:"org_ftA",facility_id:"FT_a1"},facs);
  const aStaff=await asU({role:"staff",org_id:"org_ftA",facility_id:"FT_a1"},facs);
  const aParent=await asU({role:"parent",org_id:"org_ftA",facility_id:"FT_a1",child_id:"x"},facs);
  const bAdmin=await asU({role:"admin",org_id:"org_ftB",facility_id:"FT_b1"},facs);
  console.log("   A社管理者:", aAdmin.join(","), aAdmin.join()==="FT_a1,FT_a2"?"✅自社2施設のみ":"🔴");
  console.log("   A社職員  :", aStaff.join(","), aStaff.join()==="FT_a1,FT_a2"?"✅自社のみ":"🔴");
  console.log("   A社保護者:", aParent.join(","), aParent.join()==="FT_a1,FT_a2"?"✅自社のみ":"🔴");
  console.log("   B社管理者:", bAdmin.join(","), bAdmin.join()==="FT_b1"?"✅自社のみ":"🔴");

  console.log("\n③ 他社施設は見えないか");
  console.log("   A社管理者に B社施設(FT_b1)が含まれる?:", aAdmin.includes("FT_b1")?"🔴含む(漏洩)":"✅含まない(正常)");

  console.log("\n④ 施設の追加権限（admin=可 / 職員=不可 / 他社=不可）");
  const adminAdd=await asU({role:"admin",org_id:"org_ftA",facility_id:"FT_a1"}, async()=>{
    try{await q("insert into public.facilities(id,org_id,name) values('FT_a3','org_ftA','A追加')");return "成功";}catch(e){return "拒否";}});
  const staffAdd=await asU({role:"staff",org_id:"org_ftA",facility_id:"FT_a1"}, async()=>{
    try{await q("insert into public.facilities(id,org_id,name) values('FT_x','org_ftA','x')");return "書けた";}catch(e){return "拒否";}});
  const crossAdd=await asU({role:"admin",org_id:"org_ftA",facility_id:"FT_a1"}, async()=>{
    try{await q("insert into public.facilities(id,org_id,name) values('FT_x','org_ftB','x')");return "書けた";}catch(e){return "拒否";}});
  console.log("   A社管理者→自社施設追加:", adminAdd==="成功"?"✅可(正常)":"🔴"+adminAdd);
  console.log("   A社職員→施設追加      :", staffAdd==="拒否"?"✅不可(正常)":"🔴"+staffAdd);
  console.log("   A社管理者→他社に施設追加:", crossAdd==="拒否"?"✅不可(正常＝越境防止)":"🔴"+crossAdd);

  // cleanup
  await q("delete from public.facilities where id like 'FT_%'");
  await q("delete from public.organizations where id in ('org_ftA','org_ftB')");
  console.log("\n⑤ cleanup 完了。");
  await c.end();
};
run().catch(e=>{console.error("エラー:",e.message);process.exit(1);});
