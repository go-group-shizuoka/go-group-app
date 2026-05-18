/**
 * api/activity-ai.js
 * Vercel Serverless Function: 活動記録 AI文章生成
 * 活動種別・参加児童情報から、活動記録文・保護者メッセージ・個別メモを提案する
 *
 * ⚠️ AI提案は必ず人間が確認・修正してから使用すること。自動確定禁止。
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

  const {
    activityType = "",
    activityId = "",
    date = "",
    children = [],      // [{id, name, age}, ...]
    additionalInfo = "",
    facilityName = "",
  } = req.body;

  if (!activityType) return res.status(400).json({ error: "activityType が必要です" });
  if (!children || children.length === 0) return res.status(400).json({ error: "children が必要です" });

  // 参加児童リスト文字列
  const childrenStr = children
    .map(c => `・${c.name}（${c.age ? c.age + "歳" : "年齢不明"}）`)
    .join("\n");

  // 個別メモ用の児童ID一覧（JSON例示）
  const childIdList = children.map(c => `"${c.id}": "（${c.name}の個別メモ）"`).join(",\n    ");

  const prompt = `
あなたは放課後等デイサービスの支援員です。
以下の情報をもとに、活動記録・保護者向けメッセージ・個別メモを作成してください。

【施設名】${facilityName || "GO GROUP"}
【活動日】${date}
【活動種別】${activityType}
【参加児童】
${childrenStr}
${additionalInfo ? "【追加情報・特記事項】\n" + additionalInfo : ""}

以下のJSON形式のみで返答してください。説明文・前置き・マークダウン等は不要です。

{
  "activityDescription": "活動の様子を詳しく記した記録文（150〜300字）。子どもたちの様子・支援のポイント・成果を含める。「〜しました」「〜できました」等の文体で。",
  "parentMessage": "保護者向けのメッセージ（80〜150字）。今日の活動の良い点・お子さんの様子を温かく伝える文体で。",
  "individualNotes": {
    ${childIdList}
  }
}

individualNotes は各児童の個別観察メモ（30〜60字）。その児童特有の様子・頑張り・気づきを記載。
必ずJSONのみを返してください。
`.trim();

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      }),
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
        return res.json({
          success: true,
          activityDescription: parsed.activityDescription || "",
          parentMessage: parsed.parentMessage || "",
          individualNotes: parsed.individualNotes || {},
        });
      } catch (e) {
        return res.json({ success: false, rawText: text, error: "JSON解析失敗" });
      }
    }

    return res.json({ success: false, rawText: text, error: "JSONが見つかりません" });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
