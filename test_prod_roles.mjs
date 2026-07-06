/**
 * test_prod_roles.mjs
 * 本番品質確認: 3ロール(+viewer/他施設)で各機能テーブルの read/write を実測。
 * ・READ: 各ロールが見える件数（空表示・過剰制限の検出）
 * ・WRITE: facility_id=f1 のテスト行をINSERT→HTTP status（403/保存不可の検出）
 *          テスト行(id: QATEST_*)は最後に service_role で全削除（非破壊）
 * 実データには一切変更を残さない。
 */
import fs from "node:fs";
const URL = process.env.SUPABASE_URL;
const ANON = (fs.readFileSync("go-group-app.jsx","utf8").match(/const SUPABASE_KEY = "([^"]+)"/)||[])[1];
const SK = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

// ロール（パスワードは環境変数から）
const ROLES = [
  { key:"admin",    user:"admin",     pw:process.env.PW_ADMIN,   fac:"全" },
  { key:"manager",  user:"homemgr",   pw:process.env.PW_HOMEMGR, fac:"f1" },
  { key:"staff",    user:"homestaff", pw:process.env.PW_HOMESTAFF,fac:"f1" },
  { key:"viewer",   user:"viewer",    pw:process.env.PW_VIEWER,  fac:"閲覧" },
  { key:"他施設mgr", user:"roommgr",   pw:process.env.PW_ROOMMGR, fac:"f2" },
];

// 機能→テーブル→INSERT最小行（facility_id=f1）
const FEATURES = [
  { feat:"利用者登録",     table:"users_data",     row:{facility_id:"f1", name:"__QA__", data:{}} },
  { feat:"フェイスシート", table:"facesheets",     row:{facility_id:"f1", user_id:"__qa__", data:{}} },
  { feat:"受給者証",       table:"jukyusha_docs",  row:{facility_id:"f1", user_id:"__qa__", data:{}} },
  { feat:"個別支援計画",   table:"isps",           row:{facility_id:"f1", user_id:"__qa__", data:{}} },
  { feat:"送迎",           table:"transport_data", row:{facility_id:"f1", data:{}} },
  { feat:"請求",           table:"kokuho_data",    row:{facility_id:"f1", user_id:"__qa__", year:2026, month:1, data:{}} },
  { feat:"入退室記録",     table:"records",        row:{facility_id:"f1", type:"__qa__", data:{}} },
  { feat:"書類(アセス)",   table:"assessments",    row:{facility_id:"f1", user_id:"__qa__", data:{}} },
  { feat:"モニタリング",   table:"monitorings",    row:{facility_id:"f1", user_id:"__qa__", data:{}} },
];

async function signIn(u,pw){
  const r=await fetch(`${URL}/auth/v1/token?grant_type=password`,{method:"POST",headers:{apikey:ANON,"Content-Type":"application/json"},body:JSON.stringify({email:`${u}@go-group-sys.app`,password:pw})});
  const j=await r.json(); return j.access_token;
}
async function count(table, tok){
  const r=await fetch(`${URL}/rest/v1/${table}?select=id`,{headers:{apikey:ANON,Authorization:`Bearer ${tok}`,Prefer:"count=exact",Range:"0-0"}});
  const cr=r.headers.get("content-range")||""; return {status:r.status, n: cr.includes("/")?cr.split("/")[1]:"?"};
}
async function insert(table, row, id, tok){
  const r=await fetch(`${URL}/rest/v1/${table}`,{method:"POST",headers:{apikey:ANON,Authorization:`Bearer ${tok}`,"Content-Type":"application/json",Prefer:"return=minimal"},body:JSON.stringify({id, ...row})});
  return r.status;
}

(async()=>{
  const toks={};
  for(const r of ROLES) toks[r.key]=await signIn(r.user, r.pw);

  console.log("\n========== READ（各ロールが見える件数） ==========");
  console.log("機能".padEnd(16)+ROLES.map(r=>r.key.padEnd(9)).join(""));
  for(const f of FEATURES){
    let line=f.feat.padEnd(14);
    for(const r of ROLES){ const c=await count(f.table,toks[r.key]); line+=String(c.n).padEnd(9); }
    console.log(line);
  }

  console.log("\n========== WRITE（facility_id=f1のテスト行INSERT / HTTP status） ==========");
  console.log("期待: admin/manager(f1)/staff(f1)=201  他施設mgr(f2)=403  viewer=401/403");
  console.log("機能".padEnd(16)+ROLES.map(r=>r.key.padEnd(9)).join(""));
  for(const f of FEATURES){
    let line=f.feat.padEnd(14);
    for(const r of ROLES){
      const id=`QATEST_${f.table}_${r.key}`;
      const st=await insert(f.table, f.row, id, toks[r.key]);
      line+=String(st).padEnd(9);
    }
    console.log(line);
  }

  // cleanup: QATEST_* を service_role で全削除
  console.log("\n---- cleanup（テスト行を削除）----");
  for(const f of FEATURES){
    const r=await fetch(`${URL}/rest/v1/${f.table}?id=like.QATEST_*`,{method:"DELETE",headers:{apikey:SK,Authorization:`Bearer ${SK}`,Prefer:"return=minimal"}});
    process.stdout.write(`${f.table}:${r.status} `);
  }
  console.log("\n");
})().catch(e=>{console.error(e);process.exit(1);});
