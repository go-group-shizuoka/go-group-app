/**
 * api/staff-doc-ai.js
 * Vercel Serverless Function: 職員書類 AI/OCR解析
 * 雇用契約書・履歴書・資格証等の画像から情報を自動抽出し、AI判定を行う
 *
 * ⚠️ AI判定はあくまで補助情報です。必ず管理者が内容を確認してください。
 */

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY が設定されていません" });

  const { imageBase64, mediaType = "image/jpeg", documentType = "other", staffName = "" } = req.body;
  if (!imageBase64) return res.status(400).json({ error: "imageBase64 が必要です" });

  // ─── 書類種別ごとの抽出プロンプト ───
  const extractPrompts = {
    employment_contract: `この雇用契約書を解析して、以下の項目をJSONで抽出してください。
読み取れない項目はnullとしてください。日付はYYYY-MM-DD形式で返してください。
和暦（令和・平成）は西暦に変換してください（令和7年=2025年）。

{
  "detectedName": "職員氏名",
  "employmentType": "雇用形態（正職員/パート/アルバイト/契約社員/派遣）",
  "startDate": "契約開始日（YYYY-MM-DD）",
  "endDate": "契約終了日（YYYY-MM-DD、期間の定めなしの場合null）",
  "workHours": "勤務時間（例：9:00〜18:00）",
  "salary": "時給または月給（数字のみ、例：1050）",
  "salaryType": "給与種別（時給/月給/日給）",
  "renewalClause": "更新有無（自動更新あり/更新なし/条件付き更新/不明）",
  "workplace": "勤務先施設名",
  "contractNote": "特記事項・備考（あれば）"
}

必ずJSONのみを返してください。`,

    resume: `この履歴書を解析して、以下の項目をJSONで抽出してください。
読み取れない項目はnullとしてください。日付はYYYY-MM-DD形式で返してください。

{
  "detectedName": "氏名",
  "birthDate": "生年月日（YYYY-MM-DD）",
  "address": "現住所（都道府県・市区町村まで）",
  "phone": "電話番号",
  "email": "メールアドレス",
  "educationHistory": "最終学歴（学校名・卒業年月）",
  "workHistory": "職歴要約（直近2社まで、社名・期間）",
  "qualifications": "資格・免許欄（資格名のみ、配列として）",
  "applicationDate": "記入日（YYYY-MM-DD）",
  "selfPR": "自己PR・志望動機の有無（あり/なし）"
}

必ずJSONのみを返してください。`,

    qualification: `この資格証・免許証を解析して、以下の項目をJSONで抽出してください。
読み取れない項目はnullとしてください。日付はYYYY-MM-DD形式で返してください。
和暦（令和・平成・昭和）は西暦に変換してください。

{
  "detectedName": "氏名",
  "qualificationName": "資格・免許の正式名称",
  "registrationNumber": "登録番号・証書番号",
  "issueDate": "発行日・取得日（YYYY-MM-DD）",
  "expiryDate": "有効期限（YYYY-MM-DD、有効期限なしの場合null）",
  "issuingAuthority": "発行機関・発行者名",
  "level": "等級・レベル（あれば）",
  "category": "種別・区分（あれば）"
}

必ずJSONのみを返してください。`,

    training_cert: `この研修修了証・修了書を解析して、以下の項目をJSONで抽出してください。
読み取れない項目はnullとしてください。日付はYYYY-MM-DD形式で返してください。
和暦は西暦に変換してください。

{
  "detectedName": "受講者氏名",
  "trainingName": "研修名・講座名",
  "completionDate": "修了日（YYYY-MM-DD）",
  "expiryDate": "有効期限（YYYY-MM-DD、なければnull）",
  "issuingAuthority": "発行機関・主催者名",
  "trainingHours": "研修時間（数字のみ、なければnull）",
  "category": "研修区分（例：虐待防止研修/感染症研修/緊急時対応/その他）"
}

必ずJSONのみを返してください。`,

    id_document: `この身分証明書（運転免許証・マイナンバーカード等）を解析してください。
個人情報保護のため、氏名・有効期限・身分証種別のみ抽出してください。
住所・番号等の詳細情報は抽出不要です。

{
  "detectedName": "氏名",
  "documentKind": "身分証種別（運転免許証/マイナンバーカード/パスポート/在留カード/その他）",
  "expiryDate": "有効期限（YYYY-MM-DD）",
  "birthDate": "生年月日（YYYY-MM-DD、記載があれば）"
}

必ずJSONのみを返してください。`,

    other: `この書類を解析して、以下の項目をJSONで抽出してください。
読み取れない項目はnullとしてください。

{
  "detectedName": "氏名（あれば）",
  "documentTitle": "書類のタイトル・種別名",
  "issueDate": "発行日（YYYY-MM-DD、あれば）",
  "expiryDate": "有効期限（YYYY-MM-DD、あれば）",
  "issuingAuthority": "発行機関（あれば）",
  "summary": "書類の概要（50字以内）"
}

必ずJSONのみを返してください。`,
  };

  const prompt = extractPrompts[documentType] || extractPrompts.other;

  try {
    // ① OCR抽出
    const ocrResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
            { type: "text", text: prompt },
          ],
        }],
      }),
    });

    if (!ocrResp.ok) {
      const errText = await ocrResp.text();
      return res.status(500).json({ error: "Claude API エラー: " + errText });
    }

    const ocrData = await ocrResp.json();
    const ocrText = ocrData.content?.[0]?.text || "";

    // JSONを抽出
    const jsonMatch = ocrText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.json({ success: false, rawText: ocrText, error: "JSON解析失敗", aiStatus: "error", aiWarnings: ["OCR解析に失敗しました"] });
    }

    let extracted;
    try { extracted = JSON.parse(jsonMatch[0]); }
    catch (e) { return res.json({ success: false, rawText: ocrText, error: "JSON解析エラー", aiStatus: "error", aiWarnings: ["データの読み取りに失敗しました"] }); }

    // ② AI判定（期限・氏名一致・必須項目チェック）
    const warnings = [];
    const today = new Date();

    // 氏名不一致チェック
    const detectedName = extracted.detectedName || extracted.detectedname || "";
    if (staffName && detectedName && !detectedNameMatch(staffName, detectedName)) {
      warnings.push(`氏名不一致: 登録名「${staffName}」/ 書類「${detectedName}」`);
    }

    // 有効期限チェック
    const expiryStr = extracted.expiryDate || extracted.endDate || null;
    if (expiryStr) {
      const expiry = new Date(expiryStr);
      const diffDays = Math.floor((expiry - today) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) warnings.push(`有効期限切れ: ${expiryStr}（${Math.abs(diffDays)}日経過）`);
      else if (diffDays <= 30) warnings.push(`有効期限30日以内: ${expiryStr}（残${diffDays}日）`);
      else if (diffDays <= 60) warnings.push(`有効期限60日以内: ${expiryStr}（残${diffDays}日）`);
    }

    // 雇用契約書：契約終了日チェック
    if (documentType === "employment_contract" && extracted.endDate) {
      const endDate = new Date(extracted.endDate);
      const diffDays = Math.floor((endDate - today) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) warnings.push(`契約終了日超過: ${extracted.endDate}（更新確認が必要）`);
      else if (diffDays <= 30) warnings.push(`契約終了日30日以内: ${extracted.endDate}（更新手続きを確認してください）`);
    }

    // AI判定ステータス決定
    let aiStatus = "ok";
    if (warnings.some(w => w.includes("期限切れ") || w.includes("超過"))) aiStatus = "expired";
    else if (warnings.length > 0) aiStatus = "warning";

    // ③ AI要約文生成
    const summaryLines = [];
    if (detectedName) summaryLines.push(`氏名: ${detectedName}`);
    if (extracted.qualificationName || extracted.trainingName || extracted.documentTitle) {
      summaryLines.push(`書類: ${extracted.qualificationName || extracted.trainingName || extracted.documentTitle}`);
    }
    if (extracted.startDate) summaryLines.push(`開始: ${extracted.startDate}`);
    if (expiryStr) summaryLines.push(`期限: ${expiryStr}`);
    if (extracted.employmentType) summaryLines.push(`雇用形態: ${extracted.employmentType}`);
    if (extracted.issuingAuthority) summaryLines.push(`発行: ${extracted.issuingAuthority}`);
    const aiSummary = summaryLines.join(" / ");

    return res.json({
      success: true,
      extracted,
      aiStatus,
      aiWarnings: warnings,
      aiSummary,
      aiDetectedName: detectedName,
      // フィールドマッピング（フロントエンドで直接使用）
      expiryDate: expiryStr || null,
      startDate: extracted.startDate || null,
      endDate: extracted.endDate || null,
      issueDate: extracted.issueDate || extracted.completionDate || null,
      qualificationName: extracted.qualificationName || extracted.trainingName || extracted.documentKind || null,
      registrationNumber: extracted.registrationNumber || null,
      issuingAuthority: extracted.issuingAuthority || null,
      employmentType: extracted.employmentType || null,
    });

  } catch (e) {
    return res.status(500).json({ error: e.message, aiStatus: "error", aiWarnings: ["処理中にエラーが発生しました"] });
  }
}

// 氏名一致チェック（姓名逆順・スペース差異を許容）
function detectedNameMatch(registeredName, detectedName) {
  const normalize = s => (s || "").replace(/[\s　]/g, "").toLowerCase();
  const r = normalize(registeredName);
  const d = normalize(detectedName);
  if (r === d) return true;
  // 姓名逆順チェック
  const rParts = registeredName.trim().split(/[\s　]+/);
  if (rParts.length === 2) {
    const rReversed = normalize(rParts[1] + rParts[0]);
    if (rReversed === d) return true;
  }
  // 部分一致（登録名がdetectedNameに含まれる）
  if (d.includes(r) || r.includes(d)) return true;
  return false;
}
