/**
 * api/ocr.js
 * Vercel Serverless Function: Claude Vision APIを使ったOCR処理
 * 受給者証・相談支援原案の画像から情報を自動抽出する
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
    return res.status(500).json({
      error: "ANTHROPIC_API_KEY が設定されていません。Vercel Dashboard → Settings → Environment Variables に追加してください。"
    });
  }

  const { imageBase64, mediaType = "image/jpeg", mode = "jukyusha" } = req.body;
  if (!imageBase64) return res.status(400).json({ error: "imageBase64 が必要です" });

  // モードごとのプロンプト
  const prompts = {
    jukyusha: `この受給者証の画像を解析して、以下の項目をJSON形式で抽出してください。
読み取れない項目は null としてください。日付はYYYY-MM-DD形式で返してください。

{
  "name": "氏名（ふりがなは含めない）",
  "nameKana": "ふりがな",
  "jukyushaNo": "受給者証番号（10桁の数字）",
  "city": "支給自治体名（例: 静岡市）",
  "expiryDate": "有効期限（YYYY-MM-DD）",
  "serviceType": "サービス種別（例: 放課後等デイサービス）",
  "serviceAmount": "支給量（例: 23日/月）",
  "maxBurden": "負担上限月額（数字のみ、例: 4600）",
  "startDate": "支給決定開始日（YYYY-MM-DD）"
}

必ずJSONのみを返してください。説明文は不要です。`,

    soudan: `この相談支援計画書（個別支援計画原案）の画像を解析して、以下の項目をJSONで抽出してください。
読み取れない項目は null としてください。

{
  "userName": "利用者氏名",
  "specialistName": "相談支援専門員名",
  "specialistOrg": "相談支援事業所名",
  "planPeriodStart": "計画期間開始日（YYYY-MM-DD）",
  "planPeriodEnd": "計画期間終了日（YYYY-MM-DD）",
  "userNeeds": "本人の意向・ニーズ（原文そのまま）",
  "parentNeeds": "保護者の意向・ニーズ（原文そのまま）",
  "longTermGoal": "長期目標（原文そのまま）",
  "shortTermGoal": "短期目標（原文そのまま）",
  "supportPolicy": "支援方針・総合的な援助方針",
  "specialistComment": "相談支援専門員のコメント・所見",
  "nextMonitoringDate": "次回モニタリング予定日（YYYY-MM-DD）"
}

必ずJSONのみを返してください。説明文は不要です。`
  };

  const prompt = prompts[mode] || prompts.jukyusha;

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
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: imageBase64
              }
            },
            { type: "text", text: prompt }
          ]
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
        return res.json({ success: true, data: parsed, rawText: text });
      } catch (e) {
        return res.json({ success: false, rawText: text, error: "JSON解析失敗" });
      }
    }

    return res.json({ success: false, rawText: text, error: "JSONが見つかりません" });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
