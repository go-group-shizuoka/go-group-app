/**
 * api/line-webhook.js
 * Vercel Serverless Function: LINE Webhookイベント受信
 * 保護者がGO GROUP LINEを「友だち追加」したときのLINE User IDを取得・保存する
 */

import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method === "GET") {
    // Webhook URL確認用（LINE Developersコンソールの検証ボタン対応）
    return res.status(200).send("OK");
  }

  if (req.method !== "POST") return res.status(405).end();

  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) return res.status(500).json({ error: "LINE_CHANNEL_SECRET が未設定" });

  // 署名検証（セキュリティ: LINEからのリクエストか確認）
  const signature = req.headers["x-line-signature"];
  const body = JSON.stringify(req.body);
  const hash = crypto.createHmac("sha256", secret).update(body).digest("base64");
  if (signature !== hash) {
    console.error("署名不一致: 不正なリクエストの可能性があります");
    return res.status(401).json({ error: "Invalid signature" });
  }

  const events = req.body?.events || [];

  for (const event of events) {
    // 友だち追加イベント
    if (event.type === "follow") {
      const lineUserId = event.source?.userId;
      console.log("新しい友だち追加:", lineUserId);

      // ここでSupabaseにLINE User IDを保存することができます
      // 現時点ではログ出力のみ（手動でユーザーに紐付ける設計）
      // 今後: lineUserId → 保護者の電話番号などで照合して自動紐付け

      // ウェルカムメッセージを返信
      const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
      if (token && event.replyToken) {
        await fetch("https://api.line.me/v2/bot/message/reply", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            replyToken: event.replyToken,
            messages: [{
              type: "text",
              text: "GO GROUPの保護者連絡LINEへようこそ！\n\nこちらから活動報告・お迎え時間・お知らせをお送りします。\n\nご不明点は施設へ直接お問い合わせください。"
            }]
          })
        });
      }
    }

    // ブロックイベント
    if (event.type === "unfollow") {
      console.log("ブロックされました:", event.source?.userId);
    }
  }

  return res.status(200).json({ ok: true });
}
