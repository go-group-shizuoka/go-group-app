/**
 * api/classify.js
 * Vercel Serverless Function: 書類種別自動判定AI
 * アップロードされた画像/PDFが何の書類かをClaude Vision APIで判定する
 *
 * 対応書類:
 *   jukyusha      → 受給者証
 *   isp           → 個別支援計画
 *   monitoring    → モニタリング記録
 *   service_plan  → サービス等利用計画
 *   medical_opinion → 医師意見書
 *   assessment    → アセスメント
 *   support_record → 支援記録
 *   unknown       → 不明書類
 */

export default async function handler(req, res) {
  // CORSヘッダー
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY が設定されていません" });
  }

  const { imageBase64, mediaType = "image/jpeg" } = req.body;
  if (!imageBase64) return res.status(400).json({ error: "imageBase64 が必要です" });

  const isPdf = mediaType === "application/pdf";

  // ── 書類判定プロンプト ──
  const prompt = `この書類の画像を解析して、書類の種別を判定してください。
タイトル・見出し・特徴的なキーワード・レイアウト・印刷フォーマットを総合的に分析してください。

【書類種別（8種類）】
- jukyusha       : 受給者証（通所受給者証/入所受給者証）
    特徴: 受給者証番号(10桁)・有効期限・給付量・負担上限月額・自治体名の記載
- isp            : 個別支援計画（個別支援計画書）
    特徴: 長期目標・短期目標・支援内容・計画作成日・計画者名
- monitoring     : モニタリング記録（モニタリングシート）
    特徴: モニタリング実施日・目標達成状況・次回モニタリング予定
- service_plan   : サービス等利用計画（障害児支援利用計画）
    特徴: 相談支援専門員・優先順位・サービス提供事業者・計画期間
- medical_opinion: 医師意見書（診断書）
    特徴: 医師署名・診断名・医学的所見・病院名・診察日
- assessment     : アセスメント（アセスメントシート・現状把握票）
    特徴: アセスメント項目・評価スコア・課題・ニーズ
- support_record : 支援記録（支援日誌・個別記録・活動記録）
    特徴: 日付・活動内容・職員名・子どもの様子・場所
- unknown        : 上記に該当しない・判定不能

JSONのみ返してください（説明文不要）:
{
  "documentType": "上記8種類のキーのいずれか",
  "confidence": 0から100の整数（確信度。特徴が多いほど高くする）,
  "reason": "判定根拠（タイトル・キーワード・レイアウトの具体的な特徴を50字以内で）",
  "suggestedOcrMode": "jukyusha|isp_draft|monitoring_memo|soudan|manual"
}`;

  // コンテンツブロック（画像 or PDF）
  const contentBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: imageBase64 } }
    : { type: "image",    source: { type: "base64", media_type: mediaType, data: imageBase64 } };

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 512,
        messages: [{
          role: "user",
          content: [contentBlock, { type: "text", text: prompt }]
        }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({ error: "Claude API エラー: " + errText });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "";

    // JSONを抽出
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        // 必須フィールドを保証
        const classification = {
          documentType:     parsed.documentType     || "unknown",
          confidence:       Number(parsed.confidence) || 0,
          reason:           parsed.reason            || "判定根拠不明",
          suggestedOcrMode: parsed.suggestedOcrMode  || "manual",
        };
        return res.json({ success: true, classification });
      } catch(e) {
        return res.json({ success: false, rawText: text, error: "JSON解析失敗" });
      }
    }

    return res.json({ success: false, rawText: text, error: "JSONが見つかりません" });

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
