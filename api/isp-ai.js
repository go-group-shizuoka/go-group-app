/**
 * api/isp-ai.js
 * Vercel Serverless Function: 個別支援計画 AI文章生成
 * アセスメントデータ・実績記録を元に、目標・支援内容等のテキストを提案する
 *
 * ⚠️ AI提案は必ず人間が確認・修正してから使用すること。自動確定禁止。
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


  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY が設定されていません" });
  }

  const { mode, field, childName, childAge, assessmentData = {}, planForm = {}, serviceRecords = [] } = req.body;

  if (!field) return res.status(400).json({ error: "field が必要です" });

  // ── アセスメントサマリーを作成 ──
  const assessSummary = [
    assessmentData.home_situation    && `【家庭状況】${assessmentData.home_situation}`,
    assessmentData.school_situation  && `【学校状況】${assessmentData.school_situation}`,
    assessmentData.difficulties      && `【困りごと】${assessmentData.difficulties}`,
    assessmentData.strengths         && `【強み】${assessmentData.strengths}`,
    assessmentData.emotional         && `【感情面】${assessmentData.emotional}`,
    assessmentData.communication     && `【コミュニケーション】${assessmentData.communication}`,
    assessmentData.group_participation && `【集団参加】${assessmentData.group_participation}`,
    assessmentData.sensory_characteristics && `【感覚特性】${assessmentData.sensory_characteristics}`,
    assessmentData.behavioral_characteristics && `【行動特性】${assessmentData.behavioral_characteristics}`,
  ].filter(Boolean).join("\n");

  // ── 実績サマリーを作成 ──
  const recSummary = serviceRecords.length > 0
    ? `【最近の来所実績（直近${serviceRecords.length}件）】\n`
      + serviceRecords.map(r => `${r.visit_date||""}：${r.service_type||""}（${r.attendance_status||""}）`).join("\n")
    : "";

  // ── フィールドごとのプロンプト ──
  const fieldPrompts = {
    long_term_goal: `
放課後等デイサービスの個別支援計画における「長期目標」を提案してください。

【利用者情報】
氏名：${childName || ""}
年齢：${childAge || "不明"}

${assessSummary ? "【アセスメント情報】\n" + assessSummary : ""}
${recSummary}
${planForm.parent_request ? "【保護者の要望】\n" + planForm.parent_request : ""}
${planForm.school_request ? "【学校からの情報】\n" + planForm.school_request : ""}

要件：
- 1〜2年程度の期間で達成を目指す目標
- 子どもの強みを活かした前向きな表現
- 具体的で評価可能な内容
- 100〜200字程度
- 「〜できるようになる」「〜を高める」などの表現で締める
- 本人・家族が理解しやすい言葉を使う
- 複数の案は不要。最も適切な1案のみ提案してください
`,

    short_term_goal: `
放課後等デイサービスの個別支援計画における「短期目標」を提案してください。

【利用者情報】
氏名：${childName || ""}
年齢：${childAge || "不明"}

${assessSummary ? "【アセスメント情報】\n" + assessSummary : ""}
${planForm.long_term_goal ? "【長期目標（参考）】\n" + planForm.long_term_goal : ""}
${planForm.parent_request ? "【保護者の要望】\n" + planForm.parent_request : ""}

要件：
- 3〜6ヶ月程度で達成を目指す目標
- 長期目標を達成するための中間目標
- より具体的・行動的な内容（何を・どれくらい・どんな状況で）
- 80〜150字程度
- 1案のみ提案してください
`,

    support_content: `
放課後等デイサービスの個別支援計画における「支援内容」を提案してください。

【利用者情報】
氏名：${childName || ""}
年齢：${childAge || "不明"}

${assessSummary ? "【アセスメント情報】\n" + assessSummary : ""}
${planForm.long_term_goal ? "【長期目標】\n" + planForm.long_term_goal : ""}
${planForm.short_term_goal ? "【短期目標】\n" + planForm.short_term_goal : ""}
${recSummary}

要件：
- 目標達成のための具体的な支援方法・活動内容
- 頻度・手順・配慮事項を含める
- 5領域（健康・生活、運動・感覚、認知・行動、言語・コミュニケーション、人間関係・社会性）を意識する
- 150〜300字程度
- 箇条書きまたは段落形式で
- 1案のみ提案してください
`,

    monitoring_summary: `
放課後等デイサービスのモニタリング要約文を作成してください。

【利用者情報】
氏名：${childName || ""}
年齢：${childAge || "不明"}

${assessSummary ? "【アセスメント情報】\n" + assessSummary : ""}
${planForm.long_term_goal ? "【長期目標】\n" + planForm.long_term_goal : ""}
${planForm.short_term_goal ? "【短期目標】\n" + planForm.short_term_goal : ""}
${recSummary}

要件：
- この期間の変化・成長・課題をまとめる
- 次回計画への提言を含める
- 保護者・相談支援専門員に説明できる内容
- 200〜400字程度
- 客観的・具体的な表現で
- 1案のみ提案してください
`,
  };

  const prompt = fieldPrompts[field];
  if (!prompt) {
    return res.status(400).json({ error: `未対応のフィールド: ${field}` });
  }

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
        messages: [{ role: "user", content: prompt.trim() }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({ error: "Claude API エラー: " + errText });
    }

    const data = await response.json();
    const suggestion = data.content?.[0]?.text || "";

    return res.json({
      success: true,
      suggestion: suggestion.trim(),
      field,
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
