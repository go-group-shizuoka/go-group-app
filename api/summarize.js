/**
 * api/summarize.js
 * Vercel Serverless Function: OCR抽出データをAIで3〜5行の日本語に要約する
 * 支援スタッフが書類の内容を素早く把握できるよう、重要情報を優先して要約
 */

export default async function handler(req, res) {
  // CORSヘッダー
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY が未設定です" });

  const { extractedFields, documentType = "jukyusha" } = req.body;
  if (!extractedFields) return res.status(400).json({ error: "extractedFields が必要です" });

  // 書類種別ラベル
  const DOC_LABELS = {
    jukyusha:       "受給者証（通所受給者証）",
    isp:            "個別支援計画書",
    monitoring:     "モニタリング記録",
    service_plan:   "サービス等利用計画（障害児支援利用計画）",
    medical_opinion:"医師意見書・診断書",
    assessment:     "アセスメントシート",
    support_record: "支援記録・支援日誌",
  };
  const docLabel = DOC_LABELS[documentType] || "書類";

  // 書類種別ごとに優先すべきフィールドを指示
  const priorityHints = {
    jukyusha:     "有効期限・受給者証番号・負担上限月額・サービス種別・支給量を優先",
    isp:          "長期目標・短期目標・支援内容・計画期間を優先",
    monitoring:   "目標達成状況・行動変化・次回の課題を優先",
    service_plan: "計画期間・モニタリング間隔・優先課題・サービス提供事業者を優先",
    medical_opinion: "診断名・医学的所見・医師の推奨事項を優先",
    assessment:   "主要課題・強み・支援ニーズを優先",
    support_record: "活動内容・子どもの様子・特記事項を優先",
  };
  const hint = priorityHints[documentType] || "重要な情報を優先";

  const prompt = `以下は「${docLabel}」からOCRで抽出されたデータです。
放課後等デイサービス・児童発達支援の支援スタッフが書類の内容を素早く把握できるよう、
3〜5行の日本語で要約してください。

【優先情報】${hint}

抽出データ:
${JSON.stringify(extractedFields, null, 2)}

【要約の形式】
- 自然な日本語の文章（箇条書きは使わない）
- 3〜5行以内
- null や空欄の項目には触れない
- 数値（日付・金額・日数）は正確に記載
- 支援スタッフが即座に理解できる表現

要約のみを返してください（説明文・前置きは不要）:`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",   // 要約はHaikuで十分（コスト節約）
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({ error: "Claude API エラー: " + errText });
    }

    const data = await response.json();
    const summary = (data.content?.[0]?.text || "").trim();
    return res.json({ success: true, summary });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
