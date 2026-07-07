/**
 * api/create-staff.js  — 職員のSupabase Authアカウント作成/更新（🔴2修正）
 * ・スタッフ管理UIで職員を登録/編集した時にこのAPIを呼び、ログインできるAuthユーザーを作る
 * ・パスワードは本APIでAuthにのみセットされDBには平文保存しない（🔴3対応）
 * ・app_metadata に role / facility_id / staff_id / org_id を格納（RLS・権限の分離キー）
 * ・呼び出しは admin / manager のみ。権限昇格防止:
 *     - admin以外は admin を作成不可
 *     - manager は自施設のみ作成可
 */
import { requireUser } from "./_auth.js";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://jjouwtsjykxnmvuaqhbc.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL_DOMAIN = "go-group-sys.app";

const H = () => ({ apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY, "Content-Type": "application/json" });

async function findByEmail(email) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`, { headers: H() });
  if (!r.ok) return null;
  const j = await r.json();
  return (j.users || []).find((u) => (u.email || "").toLowerCase() === email.toLowerCase()) || null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  if (!["admin", "manager"].includes(auth.meta.role)) {
    return res.status(403).json({ error: "職員作成の権限がありません" });
  }
  if (!SERVICE_KEY) return res.status(500).json({ error: "サーバー設定エラー" });

  const { loginId, password, name, role = "staff", facilityId, staffId } = req.body || {};
  if (!loginId || !password) return res.status(400).json({ error: "ログインIDとパスワードは必須です" });
  if (String(password).length < 6) return res.status(400).json({ error: "パスワードは6文字以上にしてください" });
  if (!["admin", "manager", "staff", "viewer", "parent"].includes(role)) {
    return res.status(400).json({ error: "不正なロールです" });
  }

  // 権限昇格・越境防止
  if (role === "admin" && auth.meta.role !== "admin") {
    return res.status(403).json({ error: "管理者アカウントは本部管理者のみ作成できます" });
  }
  if (auth.meta.role === "manager" && facilityId && facilityId !== auth.meta.facility_id) {
    return res.status(403).json({ error: "他施設の職員は作成できません" });
  }

  const email = `${loginId}@${EMAIL_DOMAIN}`;
  const app_metadata = {
    role,
    facility_id: facilityId || auth.meta.facility_id || null,
    staff_id: staffId || null,
    ...(auth.meta.org_id ? { org_id: auth.meta.org_id } : {}),
    username: loginId,
    display_name: name || loginId,
  };

  try {
    const existing = await findByEmail(email);
    if (existing) {
      // 既存Authユーザー → パスワード＆メタ更新
      const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${existing.id}`, {
        method: "PUT", headers: H(), body: JSON.stringify({ password, app_metadata }),
      });
      if (!r.ok) return res.status(r.status).json({ error: (await r.json().catch(()=>({}))).msg || "更新に失敗しました" });
      return res.json({ success: true, action: "updated", loginId });
    } else {
      // 新規Authユーザー作成
      const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: "POST", headers: H(),
        body: JSON.stringify({ email, password, email_confirm: true, app_metadata }),
      });
      if (!r.ok) return res.status(r.status).json({ error: (await r.json().catch(()=>({}))).msg || "作成に失敗しました" });
      return res.json({ success: true, action: "created", loginId });
    }
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
