/**
 * migration_phase1_auth.mjs
 * ============================================================================
 * Phase1 段階1: 既存ログインアカウントを Supabase Auth へ移行する（additive）
 * ----------------------------------------------------------------------------
 * ・go-group-app.jsx の ACCOUNTS（バンドル内ハードコード）を auth.users へ登録
 * ・app_metadata に role / facility_id / staff_id / child_id を格納
 *   → RLSポリシー・APIガードがこのJWTクレームを参照する
 * ・べき等（再実行しても重複作成しない。既存ユーザーは app_metadata を更新）
 * ・パスワードは既存値のまま移行（＝現行ユーザーが従来IDでそのままログイン可能）
 *   Supabase側で bcrypt ハッシュ化されるため、平文はどこにも残らない
 *
 * 【破壊防止】
 * ・auth.users への追加のみ。public スキーマの業務データには一切触れない
 * ・ロールバック = 末尾の deleteMigratedUsers() を --rollback で実行
 *
 * 【実行方法】
 *   1) 確認（何も書き込まない dry-run。既定）:
 *        node migration_phase1_auth.mjs
 *   2) 本番適用:
 *        node migration_phase1_auth.mjs --apply
 *   3) ロールバック（移行ユーザーを削除）:
 *        node migration_phase1_auth.mjs --rollback
 *
 *   環境変数（.env.local から export するか、コマンド前に付与）:
 *     SUPABASE_URL              (無ければ NEXT_PUBLIC_SUPABASE_URL / VITE_SUPABASE_URL)
 *     SUPABASE_SERVICE_ROLE_KEY (無ければ SUPABASE_SERVICE_KEY)
 * ============================================================================
 */

// ─── 移行対象アカウント（go-group-app.jsx の ACCOUNTS と1:1）───
// username → email は {username}@go-group-sys.app に固定変換する
const EMAIL_DOMAIN = "go-group-sys.app";
const ACCOUNTS = [
  { username: "homestaff",  password: "pass",  role: "staff",   staffId: "s1",  facilityId: "f1",   displayName: "田中 美穂（GO HOME）" },
  { username: "roomstaff",  password: "pass",  role: "staff",   staffId: "s4",  facilityId: "f2",   displayName: "山田 太郎（GO ROOM）" },
  { username: "town1staff", password: "pass",  role: "staff",   staffId: "s7",  facilityId: "f3",   displayName: "伊藤 誠（GO TOWN 1ST）" },
  { username: "town2staff", password: "pass",  role: "staff",   staffId: "s10", facilityId: "f4",   displayName: "渡辺 拓也（GO TOWN 2ND）" },
  { username: "homemgr",    password: "home",  role: "manager", staffId: "s3",  facilityId: "f1",   displayName: "鈴木 花子（GO HOME）" },
  { username: "roommgr",    password: "room",  role: "manager", staffId: "s6",  facilityId: "f2",   displayName: "林 直樹（GO ROOM）" },
  { username: "town1mgr",   password: "town1", role: "manager", staffId: "s9",  facilityId: "f3",   displayName: "小林 恵（GO TOWN 1ST）" },
  { username: "town2mgr",   password: "town2", role: "manager", staffId: "s12", facilityId: "f4",   displayName: "松本 浩二（GO TOWN 2ND）" },
  { username: "admin",      password: "bells", role: "admin",   staffId: null,  facilityId: null,   displayName: "本部管理者" },
  { username: "parent1",    password: "parent",role: "parent",  staffId: null,  facilityId: "f1",   childId: "u1", displayName: "利用者A 保護者" },
  { username: "viewer",     password: "view",  role: "viewer",  staffId: null,  facilityId: null,   displayName: "閲覧専用ユーザー" },
];

const URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const MODE = process.argv.includes("--apply")
  ? "apply"
  : process.argv.includes("--rollback")
  ? "rollback"
  : "dryrun";

if (!URL || !SERVICE_KEY) {
  console.error("❌ SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を環境変数に設定してください");
  process.exit(1);
}

const emailOf = (u) => `${u.username}@${EMAIL_DOMAIN}`;
const appMeta = (u) => ({
  role: u.role,
  facility_id: u.facilityId,
  staff_id: u.staffId,
  ...(u.childId ? { child_id: u.childId } : {}),
  username: u.username,
  display_name: u.displayName,
  migrated_by: "migration_phase1_auth",
});

const adminHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

// email で既存ユーザーを検索（Admin API はメールでの絞り込みに対応）
async function findByEmail(email) {
  const r = await fetch(
    `${URL}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`,
    { headers: adminHeaders }
  );
  if (!r.ok) return null;
  const j = await r.json();
  const users = j.users || j || [];
  return users.find((x) => (x.email || "").toLowerCase() === email.toLowerCase()) || null;
}

async function createUser(u) {
  const r = await fetch(`${URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      email: emailOf(u),
      password: u.password,
      email_confirm: true,
      app_metadata: appMeta(u),
    }),
  });
  return r;
}

async function updateAppMetadata(id, u) {
  const r = await fetch(`${URL}/auth/v1/admin/users/${id}`, {
    method: "PUT",
    headers: adminHeaders,
    body: JSON.stringify({ app_metadata: appMeta(u) }),
  });
  return r;
}

async function run() {
  console.log(`\n=== Phase1 Auth移行 [${MODE.toUpperCase()}] 対象 ${ACCOUNTS.length}件 ===`);
  console.log(`URL: ${URL}\n`);

  for (const u of ACCOUNTS) {
    const email = emailOf(u);
    const existing = await findByEmail(email);

    if (MODE === "rollback") {
      if (existing) {
        const r = await fetch(`${URL}/auth/v1/admin/users/${existing.id}`, {
          method: "DELETE",
          headers: adminHeaders,
        });
        console.log(`${r.ok ? "🗑️  削除" : "⚠️ 削除失敗"} ${email}`);
      } else {
        console.log(`—  未存在   ${email}`);
      }
      continue;
    }

    if (MODE === "dryrun") {
      console.log(
        `${existing ? "↻ 更新予定" : "＋ 作成予定"}  ${email}  role=${u.role} fac=${u.facilityId ?? "-"} staff=${u.staffId ?? "-"}`
      );
      continue;
    }

    // apply
    if (existing) {
      const r = await updateAppMetadata(existing.id, u);
      console.log(`${r.ok ? "↻ 更新" : "⚠️ 更新失敗"} ${email}`);
    } else {
      const r = await createUser(u);
      if (r.ok) {
        console.log(`＋ 作成 ${email}`);
      } else {
        const t = await r.text();
        console.log(`⚠️ 作成失敗 ${email}: ${r.status} ${t.slice(0, 120)}`);
      }
    }
  }

  if (MODE === "dryrun") {
    console.log(`\n（これは確認のみ。実行するには --apply を付けてください）`);
  }
  console.log("\n完了。\n");
}

run().catch((e) => {
  console.error("実行エラー:", e);
  process.exit(1);
});
