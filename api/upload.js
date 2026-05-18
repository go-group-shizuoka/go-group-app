/**
 * api/upload.js
 * Vercel Serverless Function: 写真アップロード → Supabase Storage
 * Base64画像を受け取り、Supabase Storage (photosバケット) にアップロードして公開URLを返す
 *
 * フロントコードからはservice_roleキーを隠したまま Storage に書き込める
 *
 * 環境変数:
 *   SUPABASE_URL         - SupabaseプロジェクトURL
 *   SUPABASE_SERVICE_KEY - service_roleキー（Storage書き込みに必要）
 */

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const SUPABASE_URL  = process.env.SUPABASE_URL  || "https://jjouwtsjykxnmvuaqhbc.supabase.co";
  const SERVICE_KEY   = process.env.SUPABASE_SERVICE_KEY;

  if (!SERVICE_KEY) {
    return res.status(500).json({ error: "SUPABASE_SERVICE_KEY が設定されていません" });
  }

  // 許可バケット一覧（セキュリティ: 指定外バケットへの書き込みを防ぐ）
  const ALLOWED_BUCKETS = ["photos", "staff-documents", "child-documents", "daily-photos", "album-photos"];

  const { imageBase64, mediaType = "image/jpeg", folder = "uploads", fileName, bucket = "daily-photos" } = req.body || {};
  if (!imageBase64) {
    return res.status(400).json({ error: "imageBase64 が必要です" });
  }

  // バケット名バリデーション
  if (!ALLOWED_BUCKETS.includes(bucket)) {
    return res.status(400).json({ error: `無効なバケット名です: ${bucket}` });
  }

  // ファイル名生成（指定なければタイムスタンプ+UUID）
  const ext = mediaType === "image/png" ? "png"
            : mediaType === "application/pdf" ? "pdf"
            : mediaType === "image/webp" ? "webp"
            : "jpg";
  const name = fileName || `${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
  const storagePath = `${folder}/${name}`;

  try {
    // Base64 → Buffer
    const buf = Buffer.from(imageBase64, "base64");

    // Supabase Storage へアップロード（指定バケット）
    const uploadRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${bucket}/${storagePath}`,
      {
        method: "POST",
        headers: {
          "apikey":        SERVICE_KEY,
          "Authorization": `Bearer ${SERVICE_KEY}`,
          "Content-Type":  mediaType,
          "x-upsert":      "true",
        },
        body: buf,
      }
    );

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      return res.status(500).json({ error: "Storage アップロードエラー: " + errText });
    }

    // 公開URL生成
    // public=true のバケット（daily-photos, album-photos, photos）は直接アクセス可
    // private バケット（staff-documents, child-documents）はservice_role経由でのみアクセス可
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${storagePath}`;

    return res.json({
      success: true,
      url:     publicUrl,
      path:    storagePath,
      size:    buf.length,
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
