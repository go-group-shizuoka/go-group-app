/**
 * saas_isolation_test.mjs — 法人間分離の実測検証（SET LOCAL方式）。
 * ① org_1/org_2 に 児童・職員・書類・写真 のテストデータ投入（postgres=RLSバイパス）
 * ② トランザクション内で authenticated ロール＋JWTクレームをシミュレートし可視件数を測定
 * ③ 越境書込の拒否を確認  ④ 後片付け
 */
import fs from "node:fs";
import pg from "pg";
const env = Object.fromEntries(fs.readFileSync(".saas-env","utf8").trim().split("\n").map(l=>l.split("=")));
const c = new pg.Client({host:env.SAAS_HOST,port:+env.SAAS_PORT,user:env.SAAS_USER,database:env.SAAS_DB,password:env.SAAS_PASSWORD,ssl:{rejectUnauthorized:false}});
const q=(s)=>c.query(s);
const claims=(org,role,fac)=>JSON.stringify({role:"authenticated",app_metadata:{org_id:org,role,facility_id:fac}});

// トランザクション内で指定ユーザーとして fn を実行し必ずROLLBACK
async function runAsUser(org,role,fac,fn){
  await q(`BEGIN`);
  await q(`SELECT set_config('request.jwt.claims', '${claims(org,role,fac)}', true)`); // true=local
  await q(`SET LOCAL ROLE authenticated`);
  const out = await fn();
  await q(`ROLLBACK`);
  return out;
}
const tables=["users_data","staff_data","child_documents","photo_albums"];
async function visible(t){ const r=await q(`SELECT count(*)::int n FROM public."${t}" WHERE id LIKE 'ISOTEST_%'`); return r.rows[0].n; }

const run=async()=>{
  await c.connect();
  // ① 投入（postgres）
  for(const t of tables) await q(`DELETE FROM public."${t}" WHERE id LIKE 'ISOTEST_%'`);
  const seed=[["users_data","u"],["staff_data","s"],["child_documents","d"],["photo_albums","p"]];
  for(const [t,k] of seed){
    await q(`INSERT INTO public."${t}"(id,org_id,facility_id) VALUES('ISOTEST_${k}_o1','org_1','f1')`);
    await q(`INSERT INTO public."${t}"(id,org_id,facility_id) VALUES('ISOTEST_${k}_o2','org_2','g1')`);
  }
  console.log("① 投入完了: 各テーブル org_1×1 + org_2×1（児童・職員・書類・写真）\n");

  console.log("② 法人間分離（各ロールから見えるテスト行数 / 相手法人=0 が正解）");
  for(const [label,org,role,fac] of [["org_1 職員(f1)","org_1","staff","f1"],["org_1 管理者","org_1","admin",""],["org_2 職員(g1)","org_2","staff","g1"]]){
    const res=await runAsUser(org,role,fac, async()=>{
      const o={}; for(const t of tables) o[t]=await visible(t); return o;
    });
    console.log(`  【${label}】 ` + tables.map(t=>`${t}=${res[t]}`).join("  "));
  }

  console.log("\n③ 越境書込（別トランザクションで測定）");
  const cross=await runAsUser("org_1","staff","f1", async()=>{
    try{ await q(`INSERT INTO public.users_data(id,org_id,facility_id) VALUES('ISOTEST_cross','org_2','g1')`); return "書けた"; }catch(e){ return "拒否"; }
  });
  const own=await runAsUser("org_1","staff","f1", async()=>{
    try{ await q(`INSERT INTO public.users_data(id,org_id,facility_id) VALUES('ISOTEST_own','org_1','f1')`); return "成功"; }catch(e){ return "失敗:"+e.message.slice(0,40); }
  });
  console.log(`   org_1職員 → org_2書込: ${cross==="拒否"?"✅ 拒否(正常＝越境不可)":"🔴 "+cross}`);
  console.log(`   org_1職員 → org_1書込: ${own==="成功"?"✅ 成功(正常＝自法人は書ける)":"🔴 "+own}`);

  // ④ cleanup
  for(const t of tables) await q(`DELETE FROM public."${t}" WHERE id LIKE 'ISOTEST_%'`);
  console.log("\n④ テストデータ削除完了。");
  await c.end();
};
run().catch(e=>{console.error("エラー:",e.message);process.exit(1);});
