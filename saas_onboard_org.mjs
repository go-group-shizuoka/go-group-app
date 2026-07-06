/**
 * saas_onboard_org.mjs — SaaS新規法人オンボード管理スクリプト（UI追加なし・🔴4対応/A案）
 * ============================================================================
 * SaaS導入時に GO GROUP 管理者が実行し、以下を一括セットアップする:
 *   ① 法人(organizations) 作成
 *   ② 施設(facilities) 作成
 *   ③ 初期管理者(admin) の Supabase Auth アカウント作成（app_metadataにorg_id/role等）
 *   ④ 初期管理者の staff_data レコード作成
 * ・org_id 分離RLSはそのまま有効（本スクリプトは正しい org_id を各行に付与するだけ）
 * ・べき等: org/施設は ON CONFLICT DO NOTHING、管理者は作成 or 更新
 *
 * 使い方:
 *   1) 設定ファイルを用意（例 onboard.json。フォーマットは下記）
 *   2) 確認（dry-run・何も書き込まない）:  node saas_onboard_org.mjs onboard.json
 *   3) 実行:                               node saas_onboard_org.mjs onboard.json --apply
 *
 * onboard.json フォーマット:
 * {
 *   "org":        { "id": "org_abc", "name": "ABCグループ", "plan": "standard" },
 *   "facilities": [ { "id": "abc_f1", "name": "ABC本院" }, { "id": "abc_f2", "name": "ABC分院" } ],
 *   "admin":      { "loginId": "abc_admin", "password": "StrongPass123", "name": "ABC管理者", "facilityId": "abc_f1" }
 * }
 * 接続情報は .saas-env（SAAS_HOST/PORT/USER/DB/PASSWORD/SAAS_SERVICE/SAAS_URL）から読む。
 * ============================================================================
 */
import fs from "node:fs";
import pg from "pg";

const env = Object.fromEntries(fs.readFileSync(".saas-env", "utf8").trim().split("\n").map((l) => l.split("=")));
const EMAIL_DOMAIN = "go-group-sys.app";
const APPLY = process.argv.includes("--apply");
const cfgPath = process.argv.find((a) => a.endsWith(".json"));

if (!cfgPath) { console.error("❌ 設定ファイル(onboard.json)を指定してください"); process.exit(1); }
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));

// ---- バリデーション ----
function fail(m) { console.error("❌ " + m); process.exit(1); }
if (!cfg.org?.id || !cfg.org?.name) fail("org.id と org.name は必須");
if (!Array.isArray(cfg.facilities) || cfg.facilities.length === 0) fail("facilities を1つ以上");
for (const f of cfg.facilities) if (!f.id || !f.name) fail("各施設に id と name が必要");
if (!cfg.admin?.loginId || !cfg.admin?.password) fail("admin.loginId と admin.password は必須");
if (String(cfg.admin.password).length < 6) fail("admin.password は6文字以上");
if (!cfg.facilities.find((f) => f.id === cfg.admin.facilityId)) fail("admin.facilityId は facilities のいずれかに一致させる");

const SVC = env.SAAS_SERVICE;
const URL = env.SAAS_URL || `https://${env.SAAS_REF}.supabase.co`;
const H = () => ({ apikey: SVC, Authorization: "Bearer " + SVC, "Content-Type": "application/json" });
const adminEmail = `${cfg.admin.loginId}@${EMAIL_DOMAIN}`;

async function findAuth(email) {
  const r = await fetch(`${URL}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`, { headers: H() });
  if (!r.ok) return null;
  return ((await r.json()).users || []).find((u) => (u.email || "").toLowerCase() === email.toLowerCase()) || null;
}

async function run() {
  console.log(`\n=== SaaS法人オンボード [${APPLY ? "APPLY" : "DRY-RUN"}] ===`);
  console.log(`  法人   : ${cfg.org.id}  ${cfg.org.name}`);
  console.log(`  施設   : ${cfg.facilities.map((f) => `${f.id}(${f.name})`).join(", ")}`);
  console.log(`  管理者 : ${cfg.admin.loginId}  (${cfg.admin.name || "-"})  施設=${cfg.admin.facilityId}\n`);

  if (!APPLY) { console.log("（確認のみ。実行するには --apply を付けてください）\n"); return; }

  const c = new pg.Client({ host: env.SAAS_HOST, port: +env.SAAS_PORT, user: env.SAAS_USER, database: env.SAAS_DB, password: env.SAAS_PASSWORD, ssl: { rejectUnauthorized: false } });
  await c.connect();

  // ① 法人
  await c.query(`INSERT INTO public.organizations (id,name,plan) VALUES ('${cfg.org.id}','${cfg.org.name}','${cfg.org.plan || "standard"}') ON CONFLICT (id) DO NOTHING`);
  console.log(`✅ ① 法人 ${cfg.org.id} 作成`);

  // ② 施設
  for (const f of cfg.facilities) {
    await c.query(`INSERT INTO public.facilities (id,org_id,name) VALUES ('${f.id}','${cfg.org.id}','${f.name}') ON CONFLICT (id) DO NOTHING`);
  }
  console.log(`✅ ② 施設 ${cfg.facilities.length}件 作成`);

  // ③ 初期管理者 Auth
  const app_metadata = { role: "admin", org_id: cfg.org.id, facility_id: cfg.admin.facilityId, username: cfg.admin.loginId, display_name: cfg.admin.name || cfg.admin.loginId };
  const staffId = `S-${cfg.org.id}-ADMIN`;
  app_metadata.staff_id = staffId;
  const existing = await findAuth(adminEmail);
  if (existing) {
    await fetch(`${URL}/auth/v1/admin/users/${existing.id}`, { method: "PUT", headers: H(), body: JSON.stringify({ password: cfg.admin.password, app_metadata }) });
    console.log(`✅ ③ 初期管理者 Auth 更新 (${adminEmail})`);
  } else {
    const r = await fetch(`${URL}/auth/v1/admin/users`, { method: "POST", headers: H(), body: JSON.stringify({ email: adminEmail, password: cfg.admin.password, email_confirm: true, app_metadata }) });
    console.log(`${r.ok ? "✅" : "⚠️"} ③ 初期管理者 Auth 作成 (${adminEmail})${r.ok ? "" : " : " + (await r.text()).slice(0, 100)}`);
  }

  // ④ 管理者の staff_data
  await c.query(`INSERT INTO public.staff_data (id,org_id,facility_id,name,role,active)
    VALUES ('${staffId}','${cfg.org.id}','${cfg.admin.facilityId}','${(cfg.admin.name || cfg.admin.loginId).replace(/'/g, "''")}','admin',true)
    ON CONFLICT (id) DO UPDATE SET org_id=EXCLUDED.org_id, facility_id=EXCLUDED.facility_id, role='admin'`);
  console.log(`✅ ④ 管理者 staff_data 作成 (${staffId})`);

  await c.end();
  console.log(`\n🎉 オンボード完了。ログイン: ${cfg.admin.loginId} / （設定したパスワード）\n`);
}
run().catch((e) => { console.error("エラー:", e.message); process.exit(1); });
