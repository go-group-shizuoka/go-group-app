/**
 * api/staff-doc-ai.js
 * Vercel Serverless Function: 職員書類 AI/OCR解析
 * 雇用契約書・履歴書・資格証等の画像から情報を自動抽出し、AI判定を行う
 *
 * ⚠️ AI判定はあくまで補助情報です。必ず管理者が内容を確認してください。
 */

import { requireUser } from "./_auth.js";
import { extractJson } from "./_json.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Phase1: 認証必須（認証済みユーザーのみ実行可）
  const _auth = await requireUser(req);
  if (!_auth.ok) return res.status(_auth.status).json({ error: _auth.error });


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

    // ★ 身分証モード
    // 【重要】以前は「個人情報保護のため住所・番号は抽出不要」とだけ書いていたため、
    // モデルが身分証の読み取り自体を控えて説明文を返し、JSONが得られず
    // 「JSON解析失敗」になっていた。用途（事業所が自社職員の必須書類を管理する
    // 法令上の義務）と、何を出し何を出さないかを明示して解消する。
    id_document: `あなたは障害福祉サービス事業所の労務担当を補助するシステムです。
これは、事業所が自社の職員から提出を受けた身分証明書です。事業所には職員の
本人確認書類と有効期限を管理する法令上の義務があり、その台帳登録のために
記載事項を読み取ります。正規の業務利用です。

【抽出する項目（これだけ）】
- 氏名
- 身分証の種別
- 有効期限
- 生年月日

【抽出しない項目】
住所、免許証番号、マイナンバー（個人番号）、旅券番号、在留カード番号、
本籍、顔写真の特徴、臓器提供意思表示。これらは読み取らず、出力にも含めないこと。

【対応する身分証の例と、有効期限の見つけ方】
- 運転免許証: 「平成◯年◯月◯日まで有効」の帯（多くは券面下部・色帯の中）
- マイナンバーカード（個人番号カード）: 表面の「電子証明書の有効期限」ではなく
  「有効期限」欄を優先。個人番号は裏面にあるが読み取らないこと
- 健康保険証（被保険者証）: 「有効期限」欄。記載が無い場合は null
- パスポート: 「有効期間満了日 / Date of expiry」
- 在留カード: 「在留期間（満了日）」
- 住民基本台帳カード・身体障害者手帳等その他の公的身分証も同様に扱う

【和暦の変換】
令和◯年＝2018+◯年（令和8年=2026年）、平成◯年＝1988+◯年（平成31年=2019年）。
必ず西暦のYYYY-MM-DD形式にすること。

【読み取れない場合】
画像が不鮮明・該当欄が写っていない項目は、その項目だけ null にする。
文章での説明や断りは書かず、必ず下記のJSONだけを返すこと。

{
  "detectedName": "氏名（姓名。フリガナは含めない）",
  "documentKind": "身分証種別（運転免許証/マイナンバーカード/健康保険証/パスポート/在留カード/その他）",
  "expiryDate": "有効期限（YYYY-MM-DD、無ければnull）",
  "birthDate": "生年月日（YYYY-MM-DD、無ければnull）"
}

必ずJSONのみを返してください。説明文は不要です。`,

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

  // 身分証は個人情報を含むため、応答全文は OCR_DEBUG=1 のときのみ出力する
  const DEBUG = process.env.OCR_DEBUG === "1";
  // ── ログ1・2: 受信とClaude送信 ──
  console.log(`[STAFFDOC] 1.画像受信 type=${documentType} mediaType=${mediaType} base64=${Math.round(imageBase64.length/1024)}KB`);
  console.log(`[STAFFDOC] 2.Claude送信 model=claude-opus-4-5 max_tokens=2048 promptLen=${prompt.length}`);

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
        max_tokens: 2048,
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
      console.error(`[STAFFDOC] 3.Claude応答エラー status=${ocrResp.status} body=${errText.slice(0, 500)}`);
      return res.status(500).json({ error: "Claude API エラー: " + errText });
    }

    const ocrData = await ocrResp.json();
    const ocrText = ocrData.content?.[0]?.text || "";
    const stopReason = ocrData.stop_reason;

    // ── ログ3: Claude応答 ──（身分証は個人情報のため全文は DEBUG 時のみ）
    console.log(`[STAFFDOC] 3.Claude応答 type=${documentType} stop_reason=${stopReason} textLen=${ocrText.length} usage=${JSON.stringify(ocrData.usage||{})}`);
    if (DEBUG) console.log(`[STAFFDOC] 3-full.応答全文\n${ocrText}`);

    // ```json除去 → 説明文除去 → 途中切れの修復（api/_json.js の共通処理）
    const ext = extractJson(ocrText);
    if (!ext.ok) {
      // ★ モデルが「個人情報のため回答できません」等の説明文を返した場合をここで検出する。
      //   身分証OCRが動かなかった原因がこれだったため、拒否と判読不能を区別して返す。
      const looksRefusal = /申し訳|できません|お答えできない|個人情報|プライバシー|cannot|unable|sorry/i.test(ocrText);
      console.error(`[STAFFDOC] 5.JSON解析失敗 type=${documentType} reason=${ext.reason} refusal=${looksRefusal} stop_reason=${stopReason}`);
      console.error(`[STAFFDOC] 5.解析対象(先頭300字)=${(ext.cleaned || ocrText).slice(0, 300).replace(/\n/g, "\\n")}`);
      return res.json({
        success: false, rawText: ocrText,
        error: looksRefusal
          ? "AIが読み取りを控えました。もう一度お試しいただくか、有効期限を手入力してください。"
          : (stopReason === "max_tokens" ? "読み取り結果が途中で切れました。もう一度お試しください。" : ext.reason),
        aiStatus: "error",
        aiWarnings: [looksRefusal ? "AIが読み取りを控えました（手入力で登録できます）" : "OCR解析に失敗しました"],
      });
    }
    const extracted = ext.data;
    console.log(`[STAFFDOC] ✅ 解析成功 type=${documentType} repaired=${!!ext.repaired} keys=${Object.keys(extracted||{}).join(",")}`);

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
