/**
 * api/ocr.js
 * Vercel Serverless Function: Claude Vision APIを使ったOCR処理
 * 受給者証・相談支援原案・利用予定表の画像から情報を自動抽出する
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
    return res.status(500).json({
      error: "ANTHROPIC_API_KEY が設定されていません。Vercel Dashboard → Settings → Environment Variables に追加してください。"
    });
  }

  const { imageBase64, mediaType = "image/jpeg", mode = "jukyusha" } = req.body;
  if (!imageBase64) return res.status(400).json({ error: "imageBase64 が必要です" });

  // ── モードごとのプロンプト ──
  const prompts = {

    // 受給者証モード（複数枚対応：表面・裏面・別ページのどれが来ても全フィールドを抽出）
    jukyusha: `この受給者証（または関連書類）の画像を解析して、以下の項目をJSON形式で抽出してください。
読み取れない項目・記載のない項目は null としてください。日付はYYYY-MM-DD形式で返してください。
和暦（令和・平成）は西暦に変換してください（令和7年=2025年、令和8年=2026年）。

{
  "name": "利用者氏名（ふりがなは含めない）",
  "nameKana": "ふりがな（ひらがな）",
  "guardianName": "保護者氏名（保護者・保護者名・親権者などの欄）",
  "jukyushaNo": "受給者証番号（通常10桁の数字）",
  "city": "支給自治体名（市区町村名、例: 静岡市）",
  "expiryDate": "有効期限・給付決定期間の終了日（YYYY-MM-DD）",
  "startDate": "給付決定期間の開始日・支給決定開始日（YYYY-MM-DD）",
  "grantDate": "交付日・決定日（YYYY-MM-DD）",
  "serviceType": "サービス種別（例: 放課後等デイサービス、児童発達支援）",
  "serviceAmount": "支給量・支給日数（例: 23日/月）",
  "maxBurden": "負担上限月額（数字のみ、例: 4600。「0円」の場合は0）",
  "monitoringInterval": "モニタリング期間・頻度（例: 6ヶ月ごと、3ヶ月ごと）",
  "specialNotes": "特記事項・備考欄のテキスト（あれば原文そのまま）"
}

必ずJSONのみを返してください。説明文は不要です。`,

    // 相談支援計画書モード
    soudan: `この障害児支援利用計画（相談支援計画書）の画像を解析して、以下の項目をJSONで抽出してください。
読み取れない項目は null としてください。日付はYYYY-MM-DD形式で返してください。
和暦（令和・平成）は西暦に変換してください（令和7年=2025年、令和8年=2026年）。

{
  "userName": "利用者氏名（ふりがなは除く）",
  "guardianName": "保護者氏名",
  "specialistName": "計画作成担当者名（相談支援専門員名）",
  "specialistOrg": "相談支援事業者名（相談支援事業所名）",
  "jukyushaNo": "通所受給者証番号",
  "maxBurden": "利用者負担上限額（数字のみ、例: 37200）",
  "planCreatedDate": "計画作成日（YYYY-MM-DD）",
  "monitoringInterval": "モニタリング期間（例: 6ヶ月ごと）",
  "planPeriodStart": "計画期間開始日（YYYY-MM-DD、不明ならnull）",
  "planPeriodEnd": "計画期間終了日（YYYY-MM-DD、不明ならnull）",
  "userNeeds": "本人の意向・ニーズ（「本人：」以降の原文そのまま）",
  "parentNeeds": "保護者の意向・ニーズ（「母親：」「父：」以降の原文そのまま）",
  "supportPolicy": "総合的な援助の方針（原文そのまま）",
  "longTermGoal": "長期目標（原文そのまま）",
  "shortTermGoal": "短期目標（原文そのまま）",
  "specialistComment": "相談支援専門員のコメント・所見（あれば）",
  "nextMonitoringDate": "次回モニタリング予定日（YYYY-MM-DD、不明ならnull）",
  "priorityItems": [
    {
      "priority": 1,
      "issue": "解決すべき課題（本人が求めている生活）の原文",
      "supportGoal": "支援目標の原文",
      "achievementPeriod": "達成時期（例: 1年）",
      "serviceType": "サービス種別・内容・量（例: 児童発達支援 月23日）",
      "provider": "提供事業者名・担当者名・電話番号",
      "personRole": "課題解決のための本人の役割",
      "evaluationPeriod": "評価時期（例: 6ヶ月）"
    }
  ]
}

priorityItemsは表の行数分（優先順位1、2、3…）すべて配列で返してください。
必ずJSONのみを返してください。説明文は不要です。`,

    // 相談支援原案（簡易版）モード — 個別支援計画作成の補助資料読み取り
    isp_draft: `この相談支援原案または個別支援計画関連書類を解析して、以下の項目をJSONで抽出してください。
読み取れない項目はnullとしてください。和暦は西暦に変換してください（令和7年=2025年、令和8年=2026年）。

{
  "childName": "利用者氏名",
  "planType": "計画種別（放課後等デイサービス/児童発達支援/保育所等訪問支援）",
  "startDate": "開始日（YYYY-MM-DD）",
  "endDate": "終了日（YYYY-MM-DD）",
  "longTermGoal": "長期目標（原文そのまま）",
  "shortTermGoal": "短期目標（原文そのまま）",
  "supportPolicy": "支援方針・支援内容（原文そのまま）",
  "parentNeeds": "保護者の要望・ニーズ（原文そのまま）",
  "schoolInfo": "学校からの情報（あれば）",
  "monitoringInterval": "モニタリング頻度（例：6ヶ月ごと）",
  "specialistName": "相談支援専門員名",
  "specialistOrg": "相談支援事業所名"
}

必ずJSONのみを返してください。説明文は不要です。`,

    // モニタリングメモモード — 手書きメモや簡易記録からモニタリング要点を抽出
    monitoring_memo: `このモニタリング記録・手書きメモを解析して、以下の項目をJSONで抽出してください。
読み取れない項目はnullとしてください。

{
  "childName": "利用者氏名",
  "monitoringDate": "モニタリング実施日（YYYY-MM-DD）",
  "attendanceStatus": "出席状況の要約",
  "goalAchievement": "目標達成状況（原文そのまま）",
  "behaviorChanges": "行動面の変化・気づき",
  "communicationChanges": "コミュニケーション面の変化",
  "parentFeedback": "保護者からのフィードバック",
  "schoolFeedback": "学校からのフィードバック",
  "nextActions": "次回に向けた対応・課題",
  "specialNotes": "特記事項（ヒヤリハット等）",
  "summary": "モニタリング総括文（100字程度）"
}

必ずJSONのみを返してください。説明文は不要です。`,

    // 利用予定表モード（Phase1: 欠席検出＋信頼度対応）
    yotei: `この利用予定表の画像を解析してください。
和暦は西暦に変換してください（令和7年=2025年、令和8年=2026年）。

各日について、記入があれば「予定あり」として抽出してください（記入が全く無い日は含めない）。
- 日付に○、または利用時間（開始・終了）の記入がある → status:"来所"
- 「欠」「欠席」「休」「休み」「お休み」「キャンセル」「×」等の記載がある → status:"欠席"

以下のJSON形式で返してください：
{
  "childName": "利用者氏名（ひらがな・漢字どちらでも）",
  "nameConfidence": 利用者名の読み取り信頼度(0〜100の整数),
  "facilityName": "施設名",
  "year": 年(半角数字),
  "month": 月(半角数字),
  "visits": [
    {
      "date": 日付(半角数字のみ、例:2),
      "dayOfWeek": "曜日(月/火/水/木/金/土/日)",
      "status": "来所" または "欠席",
      "startTime": "開始時刻(HH:MM形式、例:15:00。欠席・空欄ならnull)",
      "endTime": "終了時刻(HH:MM形式、例:16:30。欠席・空欄ならnull)",
      "pickup": true,
      "dropoff": true,
      "memo": "備考欄のテキスト（なければnull）",
      "event": "備考欄にあるイベント名（体育館・誕生会・おやつ作り等、なければnull）",
      "confidence": この行の読み取り信頼度(0〜100の整数)
    }
  ]
}

pickup は迎の欄に○があればtrue、なければfalse。
dropoff は送の欄に○があればtrue、なければfalse。
status が "欠席" の日は pickup/dropoff を false、startTime/endTime を null にしてください。
confidence・nameConfidence は文字のかすれや手書きの判読しにくさを反映した正直な数値にしてください
（はっきり読めた=90〜100、やや不明瞭=60〜79、判読困難=60未満）。
JSONのみ返してください。説明文は不要です。`,

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
        max_tokens: 2048,
        messages: [{
          role: "user",
          content: [
            // PDF と 画像 を両対応（mediaType で自動切替）
            mediaType === "application/pdf"
              ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: imageBase64 } }
              : { type: "image",    source: { type: "base64", media_type: mediaType, data: imageBase64 } },
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
