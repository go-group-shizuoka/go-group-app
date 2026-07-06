/**
 * api/_auth.js
 * ============================================================================
 * Phase1: サーバーレスAPI共通の認証ガード
 * ----------------------------------------------------------------------------
 * Authorization: Bearer <access_token> を Supabase Auth で検証し、
 * 有効な認証済みユーザーのみ API 実行を許可する。
 * ・ファイル名が "_" 始まりのため Vercel のエンドポイントにはならない（ヘルパー扱い）
 * ・トークン検証は Supabase の /auth/v1/user を呼ぶ（apikey に service key を使用）
 * ============================================================================
 */

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://jjouwtsjykxnmvuaqhbc.supabase.co";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * リクエストの Bearer トークンを検証する。
 * @returns {Promise<{ok:true, user:object, meta:object} | {ok:false, status:number, error:string}>}
 */
export async function requireUser(req) {
  const raw = req.headers.authorization || req.headers.Authorization || "";
  const token = raw.startsWith("Bearer ") ? raw.slice(7) : "";
  if (!token) {
    return { ok: false, status: 401, error: "認証が必要です（ログインしてください）" };
  }
  if (!SERVICE_KEY) {
    return { ok: false, status: 500, error: "サーバー認証設定エラー" };
  }
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_KEY, Authorization: "Bearer " + token },
    });
    if (!r.ok) {
      return { ok: false, status: 401, error: "セッションが無効です。再ログインしてください" };
    }
    const user = await r.json();
    return { ok: true, user, meta: (user && user.app_metadata) || {} };
  } catch (e) {
    return { ok: false, status: 500, error: "認証確認に失敗しました" };
  }
}

/**
 * 管理系APIで admin / manager のみ許可したい場合に使う（任意）。
 */
export async function requireRole(req, roles) {
  const res = await requireUser(req);
  if (!res.ok) return res;
  const role = res.meta.role;
  if (!roles.includes(role)) {
    return { ok: false, status: 403, error: "この操作の権限がありません" };
  }
  return res;
}
