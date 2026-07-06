/**
 * api/line-push.js
 * Vercel Serverless Function: LINE Messaging API プッシュ送信
 * 保護者のLINE User IDに対してメッセージ・写真を送信する
 */

import { requireUser } from "./_auth.js";

export default async function handler(req, res) {
  // CORSヘッダー
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Phase1: 認証必須（認証済みユーザーのみ実行可）
  const _auth = await requireUser(req);
  if (!_auth.ok) return res.status(_auth.status).json({ error: _auth.error });


  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    return res.status(500).json({ error: "LINE_CHANNEL_ACCESS_TOKEN が設定されていません" });
  }

  const { lineUserId, message, imageBase64, imageUrl } = req.body;
  if (!lineUserId) return res.status(400).json({ error: "lineUserId が必要です" });
  if (!message && !imageBase64 && !imageUrl) return res.status(400).json({ error: "message または image が必要です" });

  // 送信するメッセージを組み立て
  const messages = [];

  // テキストメッセージ
  if (message) {
    messages.push({ type: "text", text: message });
  }

  // 画像メッセージ（URLがある場合）
  if (imageUrl) {
    messages.push({
      type: "image",
      originalContentUrl: imageUrl,
      previewImageUrl: imageUrl
    });
  }

  // Base64画像は直接送れないため、テキストで代替案を添付
  // ※ LINE APIは画像URLのみ受け付けるため、base64画像はメッセージで代替
  if (imageBase64 && !imageUrl) {
    messages.push({
      type: "text",
      text: "📸 写真が添付されています（アプリからご確認ください）"
    });
  }

  try {
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: messages
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("LINE API Error:", errText);
      return res.status(500).json({ error: "LINE送信失敗: " + errText });
    }

    return res.json({ success: true, sent: messages.length });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
