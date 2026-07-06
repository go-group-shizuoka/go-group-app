/**
 * api/file-url.js  — 法人(org)分離された署名URL発行（Phase2 SaaS Storage制御・A方式）
 * ・非公開バケットのファイルは、この経由でしか取得できない
 * ・呼び出しユーザーの JWT(app_metadata.org_id) と、要求パスの先頭フォルダ(org_id)が
 *   一致する場合のみ署名URLを発行 → 他法人のファイルは 403（直URL・越境ともに不可）
 * ・保存パス規約: {org_id}/{facility_id}/... （アップロード側も同規約で保存する）
 */
import { requireUser } from "./_auth.js";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://jjouwtsjykxnmvuaqhbc.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED_BUCKETS = ["album-photos", "daily-photos", "staff-documents", "child-documents"];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // 認証必須
  const auth = await requireUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const { bucket, path, expiresIn = 3600 } = req.body || {};
  if (!bucket || !path) return res.status(400).json({ error: "bucket と path は必須です" });
  if (!ALLOWED_BUCKETS.includes(bucket)) return res.status(400).json({ error: "不正なバケットです" });

  // ★法人分離: パス先頭フォルダ = 呼び出し元の org_id のみ許可
  const org = auth.meta.org_id;
  if (!org) return res.status(403).json({ error: "法人が特定できません" });
  const first = String(path).split("/")[0];
  if (first !== org) {
    return res.status(403).json({ error: "他法人のファイルにはアクセスできません" });
  }

  if (!SERVICE_KEY) return res.status(500).json({ error: "サーバー設定エラー" });

  // service_role で署名URL発行（RLSバイパス・サーバー側でorg検証済み）
  try {
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${bucket}/${encodeURI(path)}`, {
      method: "POST",
      headers: { apikey: SERVICE_KEY, Authorization: "Bearer " + SERVICE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn }),
    });
    const j = await r.json();
    if (!r.ok || !j.signedURL) return res.status(r.status).json({ error: j.message || "署名URL発行に失敗しました" });
    return res.json({ signedUrl: `${SUPABASE_URL}/storage/v1${j.signedURL}`, expiresIn });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
