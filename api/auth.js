/**
 * api/auth.js
 * Vercel Serverless Function: 認証エンドポイント
 * PBKDF2-SHA256 でパスワードをハッシュ化して比較する
 * フロントコードに平文パスワードを持たないための段階移行用エンドポイント
 *
 * 環境変数:
 *   AUTH_SALT          - パスワードハッシュ用ソルト（Vercel環境変数に設定）
 *   SUPABASE_URL       - SupabaseプロジェクトURL
 *   SUPABASE_SERVICE_KEY - service_roleキー（サーバー専用）
 */

import crypto from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://jjouwtsjykxnmvuaqhbc.supabase.co";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const AUTH_SALT    = process.env.AUTH_SALT || "gogroup2026SecureS@lt!";

// PBKDF2-SHA256 ハッシュ生成（10,000回反復、32バイト出力）
function hashPassword(password) {
  return crypto.pbkdf2Sync(password, AUTH_SALT, 10000, 32, "sha256").toString("hex");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "username と password が必要です" });
  }

  if (!SERVICE_KEY) {
    return res.status(500).json({ error: "サーバー設定エラー（SUPABASE_SERVICE_KEY未設定）" });
  }

  try {
    const hash = hashPassword(password);

    // staff_accounts テーブルからハッシュ照合
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/staff_accounts?username=eq.${encodeURIComponent(username)}&password_hash=eq.${hash}&select=*`,
      {
        headers: {
          "apikey": SERVICE_KEY,
          "Authorization": `Bearer ${SERVICE_KEY}`,
        },
      }
    );

    if (!r.ok) {
      const errText = await r.text();
      return res.status(500).json({ error: "DB照会エラー: " + errText });
    }

    const rows = await r.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(401).json({ error: "ユーザー名またはパスワードが違います" });
    }

    const account = rows[0];

    // パスワードハッシュを除いてユーザー情報を返す
    const { password_hash, ...userInfo } = account;
    return res.json({ success: true, user: userInfo });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
