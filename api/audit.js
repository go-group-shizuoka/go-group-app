/**
 * api/audit.js
 * Vercel Serverless Function: 監査チェック結果をClaude Haikuで一括AI分析
 * AuditCenterTabの「AI一括分析」ボタンから呼ばれる
 * 優先対応事項・繰り返しパターン・改善提案を返す
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

  const { checks, facilityName = "GO GROUP" } = req.body;
  if (!checks || !Array.isArray(checks)) {
    return res.status(400).json({ error: "checks（配列）が必要です" });
  }

  const critical = checks.filter(c => c.severity === "critical");
  const warning  = checks.filter(c => c.severity === "warning");
  const info     = checks.filter(c => c.severity === "info");

  // 重複パターン検出（同じcheck_typeが複数件ある場合）
  const typeCounts = {};
  checks.forEach(c => { typeCounts[c.checkType] = (typeCounts[c.checkType] || 0) + 1; });
  const patterns = Object.entries(typeCounts)
    .filter(([,cnt]) => cnt >= 2)
    .map(([type, cnt]) => `${type}: ${cnt}件`);

  const formatChecks = (arr, limit = 8) =>
    arr.slice(0, limit)
       .map(c => `・${c.childName||"施設全体"}: ${c.title}`)
       .join("\n");

  const prompt = `あなたは放課後等デイサービス・児童発達支援施設の監査サポートAIです。
以下は「${facilityName}」の今日の自動監査チェック結果です。

【緊急 critical: ${critical.length}件】
${formatChecks(critical) || "なし"}

【警告 warning: ${warning.length}件】
${formatChecks(warning) || "なし"}

【情報 info: ${info.length}件】
${formatChecks(info) || "なし"}

【繰り返しパターン】
${patterns.length > 0 ? patterns.join("\n") : "特定のパターンなし"}

以下3点を、合計200字以内の日本語で返してください:
①最優先で対応すべき具体的な内容
②繰り返し発生している問題のパターンと根本原因
③今後の予防・改善策

分析結果のみを返してください（番号・箇条書きなし、自然な文章で）:`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",  // コスト最適化
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({ error: "Claude API エラー: " + errText });
    }

    const data = await response.json();
    const analysis = (data.content?.[0]?.text || "").trim();
    return res.json({
      success: true,
      analysis,
      stats: {
        critical: critical.length,
        warning: warning.length,
        info: info.length,
        total: checks.length,
        patterns,
      },
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
