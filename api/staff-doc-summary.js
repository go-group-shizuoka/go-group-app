/**
 * api/staff-doc-summary.js
 * Vercel Serverless Function: 職員書類 AIプロファイル要約生成
 * 職員の全書類情報をもとに、書類状況・資格・期限リスク・推奨アクションを生成する
 *
 * ⚠️ AI提案は必ず管理者が確認してから使用すること。
 */

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY が設定されていません" });

  const { staffName = "", staffRole = "", documents = [] } = req.body;
  if (!staffName) return res.status(400).json({ error: "staffName が必要です" });
  if (!documents || documents.length === 0) return res.status(400).json({ error: "documents が必要です" });

  // 書類情報をまとめる
  const docSummaries = documents.map(d => {
    const parts = [`・${d.typeLabel || d.documentType}`];
    if (d.qualificationName) parts.push(`（${d.qualificationName}）`);
    if (d.expiryDate) parts.push(`有効期限: ${d.expiryDate}`);
    if (d.issueDate) parts.push(`取得日: ${d.issueDate}`);
    if (d.issuingAuthority) parts.push(`発行: ${d.issuingAuthority}`);
    if (d.employmentType) parts.push(`雇用形態: ${d.employmentType}`);
    if (d.aiWarnings && d.aiWarnings.length > 0) parts.push(`⚠️ ${d.aiWarnings.join(" / ")}`);
    return parts.join("、");
  }).join("\n");

  const today = new Date().toISOString().slice(0, 10);

  const prompt = `
あなたは放課後等デイサービスの人事・管理担当者です。
以下の職員情報と書類リストをもとに、職員の書類プロファイルサマリーを作成してください。

【職員名】${staffName}
【役職・区分】${staffRole || "未設定"}
【確認日】${today}
【登録書類一覧（${documents.length}件）】
${docSummaries}

以下のJSON形式のみで返してください。説明文・前置き不要です。

{
  "profileSummary": "職員の書類状況を200字以内でまとめた文章。資格・契約状況・期限管理の観点から客観的に記述。",
  "qualifications": ["保有資格・免許の名称リスト（配列）。書類から確認できるもののみ。"],
  "expiryRisks": ["期限リスクのある書類の説明リスト（配列）。期限切れ・30日以内のものを具体的に。"],
  "missingRisks": ["不足・懸念が感じられる書類種別または注意点のリスト（配列）"],
  "overallRating": "総合評価（良好 / 要確認 / 要対応 のいずれか）",
  "recommendations": "管理者へのアドバイス（100字以内）"
}

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
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({ error: "Claude API エラー: " + errText });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return res.json({
          success: true,
          profileSummary: parsed.profileSummary || "",
          qualifications: parsed.qualifications || [],
          expiryRisks: parsed.expiryRisks || [],
          missingRisks: parsed.missingRisks || [],
          overallRating: parsed.overallRating || "要確認",
          recommendations: parsed.recommendations || "",
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
