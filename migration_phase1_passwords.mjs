/**
 * migration_phase1_passwords.mjs
 * ============================================================================
 * Phase1 残課題②: テスト用弱パスワードを廃止し、全アカウントに強力な
 * パスワードを再設定する（Supabase Auth Admin API）。
 * ・既存の弱いPW（pass/home/room/bells 等）を上書き
 * ・生成した新パスワードを一覧表示（管理者が各職員へ安全に配布する）
 * ・auth.users のみ操作。業務データには触れない
 *
 * 実行:
 *   node migration_phase1_passwords.mjs            # dry-run（生成PWを表示するのみ・未適用）
 *   node migration_phase1_passwords.mjs --apply    # 本番適用
 *
 * 環境変数: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY(or SUPABASE_SERVICE_KEY)
 * ============================================================================
 */
import crypto from "node:crypto";

const URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const DOMAIN = "go-group-sys.app";
const APPLY = process.argv.includes("--apply");

if (!URL || !SERVICE_KEY) { console.error("❌ SUPABASE_URL と SERVICE KEY が必要です"); process.exit(1); }

// 対象アカウント（表示名は配布時の目印用）
const USERS = [
  { u: "homestaff",  label: "田中 美穂（GO HOME 職員）" },
  { u: "roomstaff",  label: "山田 太郎（GO ROOM 職員）" },
  { u: "town1staff", label: "伊藤 誠（GO TOWN 1ST 職員）" },
  { u: "town2staff", label: "渡辺 拓也（GO TOWN 2ND 職員）" },
  { u: "homemgr",    label: "鈴木 花子（GO HOME 施設長）" },
  { u: "roommgr",    label: "林 直樹（GO ROOM 施設長）" },
  { u: "town1mgr",   label: "小林 恵（GO TOWN 1ST 施設長）" },
  { u: "town2mgr",   label: "松本 浩二（GO TOWN 2ND 施設長）" },
  { u: "admin",      label: "本部管理者" },
  { u: "viewer",     label: "閲覧専用" },
  { u: "parent1",    label: "保護者テスト（不要なら削除推奨）" },
];

// 強力で読み取り可能なパスワード生成（14文字・大小英字+数字、紛らわしい文字を除外）
function genPassword() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";   // I,O除外
  const lower = "abcdefghijkmnpqrstuvwxyz";   // l,o除外
  const digit = "23456789";                   // 0,1除外
  const all = upper + lower + digit;
  const pick = (set) => set[crypto.randomInt(set.length)];
  let pw = pick(upper) + pick(lower) + pick(digit);       // 各種別を最低1つ保証
  for (let i = 0; i < 11; i++) pw += pick(all);
  // シャッフル
  return pw.split("").sort(() => crypto.randomInt(3) - 1).join("");
}

const H = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" };

async function findId(email) {
  const r = await fetch(`${URL}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`, { headers: H });
  const j = await r.json().catch(() => ({}));
  const users = j.users || [];
  return (users.find(x => (x.email || "").toLowerCase() === email.toLowerCase()) || {}).id || null;
}
async function setPassword(id, pw) {
  const r = await fetch(`${URL}/auth/v1/admin/users/${id}`, {
    method: "PUT", headers: H, body: JSON.stringify({ password: pw }),
  });
  return r.ok ? { ok: true } : { ok: false, err: await r.text() };
}

(async () => {
  console.log(`\n=== パスワード強化 [${APPLY ? "APPLY" : "DRY-RUN"}] ===`);
  console.log(`${URL}\n`);
  const out = [];
  for (const acc of USERS) {
    const email = `${acc.u}@${DOMAIN}`;
    const pw = genPassword();
    let status = "（dry-run・未適用）";
    if (APPLY) {
      const id = await findId(email);
      if (!id) { status = "⚠️ ユーザー未検出"; }
      else {
        const res = await setPassword(id, pw);
        status = res.ok ? "✅ 適用済" : `⚠️ 失敗: ${String(res.err).slice(0,80)}`;
      }
    }
    out.push({ login: acc.u, pw, label: acc.label, status });
  }
  console.log("ログインID          新パスワード        状態            対象");
  console.log("─".repeat(90));
  for (const r of out) {
    console.log(`${r.login.padEnd(18)} ${r.pw.padEnd(16)} ${r.status.padEnd(14)} ${r.label}`);
  }
  console.log("\n※ この一覧を安全な手段で各職員へ配布し、配布後はこの出力を破棄してください。");
  if (!APPLY) console.log("※ 適用するには --apply を付けて再実行してください。");
})().catch(e => { console.error(e); process.exit(1); });
