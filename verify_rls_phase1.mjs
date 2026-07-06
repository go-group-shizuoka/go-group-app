/**
 * verify_rls_phase1.mjs
 * RLS適用（rls_phase1_complete.sql）後の検証スクリプト。
 * ・匿名(anonキーのみ)では機微テーブルが読めなくなること
 * ・施設staffのJWTでは自施設のみ、adminは全施設が読めること
 *
 * 実行: node verify_rls_phase1.mjs
 *   環境変数: SUPABASE_URL（無ければ NEXT_PUBLIC_SUPABASE_URL / VITE_SUPABASE_URL）
 * anonキーは go-group-app.jsx から自動抽出。
 */
import fs from "node:fs";

const URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://jjouwtsjykxnmvuaqhbc.supabase.co";
const ANON = (fs.readFileSync("go-group-app.jsx", "utf8").match(/const SUPABASE_KEY = "([^"]+)"/) || [])[1];
const DOMAIN = "go-group-sys.app";

async function signIn(username, password) {
  const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: `${username}@${DOMAIN}`, password }),
  });
  const j = await r.json();
  return j.access_token;
}

async function count(table, token) {
  const r = await fetch(`${URL}/rest/v1/${table}?select=id`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token || ANON}`, Prefer: "count=exact", Range: "0-0" },
  });
  const cr = r.headers.get("content-range") || "";
  const total = cr.includes("/") ? cr.split("/")[1] : "?";
  return { status: r.status, total };
}

const SENSITIVE = ["users_data", "jukyusha_docs", "facesheets", "kokuho_data", "staff_data"];

(async () => {
  console.log(`\n=== RLS検証  ${URL} ===\n`);

  console.log("① 匿名(anonキーのみ・未ログイン) → 機微データは 401 or 0件 になるべき");
  for (const t of SENSITIVE) {
    const { status, total } = await count(t, null);
    const ok = status === 401 || status === 403 || total === "0";
    console.log(`   ${ok ? "✅" : "🔴"} ${t}: HTTP ${status} / 件数 ${total}`);
  }

  // パスワードは秘密情報のためコードに埋め込まず環境変数から受け取る:
  //   GG_STAFF_USER / GG_STAFF_PW … 施設スタッフ（例: homestaff）
  //   GG_ADMIN_USER / GG_ADMIN_PW … 本部管理者（例: admin）
  const staffUser = process.env.GG_STAFF_USER, staffPw = process.env.GG_STAFF_PW;
  const adminUser = process.env.GG_ADMIN_USER, adminPw = process.env.GG_ADMIN_PW;
  if (staffPw && adminPw) {
    console.log(`\n② ${staffUser}ログイン → 自施設のみ見えるべき`);
    const s = await count("users_data", await signIn(staffUser, staffPw));
    console.log(`   users_data(${staffUser}): HTTP ${s.status} / 見える件数 ${s.total}`);
    console.log(`\n③ ${adminUser}ログイン → 全施設が見えるべき（②より多いはず）`);
    const a = await count("users_data", await signIn(adminUser, adminPw));
    console.log(`   users_data(${adminUser}): HTTP ${a.status} / 見える件数 ${a.total}`);
    console.log("\n判定: ①が全て✅ かつ ②<③ なら施設分離が有効。\n");
  } else {
    console.log("\n（②③はスキップ: GG_STAFF_USER/PW, GG_ADMIN_USER/PW を環境変数で渡すと施設分離も検証します）\n");
  }
})().catch(e => { console.error(e); process.exit(1); });
