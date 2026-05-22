/**
 * api/merge-pages.js
 * 複数ページのOCRデータを統合してAIが再解析するエンドポイント
 * 用途: OCRページ自動結合AI の「結合テキスト再解析」機能
 *
 * リクエスト例:
 * {
 *   "pageResults": [
 *     { "pageNo": 1, "structuredData": {...}, "rawText": "..." },
 *     { "pageNo": 2, "structuredData": {...}, "rawText": "..." }
 *   ],
 *   "documentType": "soudan"
 * }
 */

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")   return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY が設定されていません" });
  }

  const { pageResults, documentType = "soudan" } = req.body;
  if (!pageResults?.length) {
    return res.status(400).json({ error: "pageResults が必要です" });
  }

  // ── 結合テキストを構築 ──
  const combinedText = pageResults.map(p => {
    const d = p.structuredData || {};
    const lines = [
      `=== ページ ${p.pageNo} ===`,
      // rawTextがあれば使う（精度向上）
      p.rawText ? `[OCR原文]\n${p.rawText}` : null,
      // structuredDataからの補完
      d.guardianName    && `保護者: ${d.guardianName}`,
      d.specialistName  && `担当専門員: ${d.specialistName}`,
      d.specialistOrg   && `事業所: ${d.specialistOrg}`,
      d.jukyushaNo      && `受給者証番号: ${d.jukyushaNo}`,
      d.planCreatedDate && `計画作成日: ${d.planCreatedDate}`,
      d.planPeriodStart && `計画期間: ${d.planPeriodStart}〜${d.planPeriodEnd || "?"}`,
      d.userNeeds       && `本人の意向: ${d.userNeeds}`,
      d.parentNeeds     && `保護者の意向: ${d.parentNeeds}`,
      d.longTermGoal    && `長期目標: ${d.longTermGoal}`,
      d.shortTermGoal   && `短期目標: ${d.shortTermGoal}`,
      d.supportPolicy   && `援助方針: ${d.supportPolicy}`,
      d.specialistComment && `専門員コメント: ${d.specialistComment}`,
      (d.priorityItems||[]).length && `優先課題: ${JSON.stringify(d.priorityItems)}`,
    ].filter(Boolean);
    return lines.join("\n");
  }).join("\n\n");

  // ── 書類種別別プロンプト ──
  const mergePrompt = `以下は${pageResults.length}ページに分かれた障害児支援利用計画書のOCR結果です。
各ページの内容を統合して、最終的な1つのJSONとして抽出してください。
同じフィールドが複数ページに記載されている場合は、より詳細・正確な方を採用してください。
priorityItemsは全ページ分を連結してください（重複は除去）。
日付はYYYY-MM-DD形式、和暦は西暦に変換（令和7年=2025年、令和8年=2026年）。

${combinedText}

以下のJSONのみを返してください（説明不要）:
{
  "userName": "利用者氏名",
  "guardianName": "保護者氏名",
  "specialistName": "計画作成担当者名",
  "specialistOrg": "相談支援事業者名",
  "jukyushaNo": "通所受給者証番号",
  "maxBurden": "負担上限額（数字のみ）",
  "planCreatedDate": "計画作成日（YYYY-MM-DD）",
  "monitoringInterval": "モニタリング期間",
  "planPeriodStart": "計画期間開始日（YYYY-MM-DD）",
  "planPeriodEnd": "計画期間終了日（YYYY-MM-DD）",
  "userNeeds": "本人の意向・ニーズ（原文）",
  "parentNeeds": "保護者の意向・ニーズ（原文）",
  "supportPolicy": "総合的な援助の方針（原文）",
  "longTermGoal": "長期目標（原文）",
  "shortTermGoal": "短期目標（原文）",
  "specialistComment": "専門員コメント",
  "nextMonitoringDate": "次回モニタリング予定日（YYYY-MM-DD）",
  "priorityItems": [{ "priority":1, "issue":"...", "supportGoal":"...", "achievementPeriod":"...", "serviceType":"...", "provider":"...", "personRole":"...", "evaluationPeriod":"..." }]
}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method:  "POST",
      headers: {
        "x-api-key":          apiKey,
        "anthropic-version":  "2023-06-01",
        "content-type":       "application/json",
      },
      body: JSON.stringify({
        model:      "claude-opus-4-5",
        max_tokens: 2048,
        messages:   [{ role: "user", content: mergePrompt }],
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
          success:      true,
          data:         parsed,
          rawText:      text,
          pageCount:    pageResults.length,
          combinedText: combinedText.slice(0, 500) + "...", // ログ用（先頭500文字）
        });
      } catch(e) {
        return res.json({ success: false, rawText: text, error: "JSON解析失敗" });
      }
    }

    return res.json({ success: false, rawText: text, error: "JSONが見つかりません" });

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
