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

    // 利用予定表モード（P1: GO GROUP実物フォーム最適化・手書き/○囲み/斜線対応）
    yotei: `これは放課後等デイサービスの月間利用予定表（手書き・保護者記入）です。正確に解析してください。

【表の構造】
- 一番左の数字は「その月の日付(1〜31)」です。日付の欄に○印を探す必要はありません（行番号＝日付）。
- 列は概ね：日付 / 曜日 / 利用時間(開始〜終了) / 送迎(「迎」「送」の文字が印字) / 備考。
- ヘッダに「令和◯年 ◯月」と対象年月、氏名（「名前 ◯◯ さん」）、施設名が書かれています。

【各行(日)の判定ルール ★重要】
1) 利用時間に時刻(例 9:00〜17:00)が手書きされている → status:"来所"
2) 利用時間の欄に斜線(／)が引かれている、または備考に「休み」「欠」「欠席」「×」 → status:"欠席"
3) それ以外（時刻も斜線も無く完全に空欄）→ その日は出力しない（利用なし）
   ※備考にイベント名(プール等)だけが書かれていても、時刻や斜線が無ければ利用なしとして出力しない。

【送迎(迎・送)の判定 ★重要】
- 印字された「迎」の文字が手書きの○で囲まれている → pickup:true、囲まれていなければ false
- 印字された「送」の文字が手書きの○で囲まれている → dropoff:true、囲まれていなければ false
- status:"欠席" の日は pickup/dropoff を false、startTime/endTime を null。

【和暦】令和◯年は西暦へ（令和7年=2025、令和8年=2026）。

以下のJSONのみ返す（説明文不要）：
{
  "childName": "利用者氏名（漢字）",
  "nameConfidence": 0〜100,
  "facilityName": "施設名（例: GO TOWN 1st/2nd）",
  "year": 2026,
  "month": 8,
  "visits": [
    {
      "date": 3,
      "dayOfWeek": "月",
      "status": "来所",
      "startTime": "09:00",
      "endTime": "17:00",
      "pickup": true,
      "dropoff": true,
      "memo": "備考テキスト（イベント名含む。なければnull）",
      "event": "イベント名（プール/マック/大社お祭り/避難訓練/誕生会/ビンゴ大会等。なければnull）",
      "confidence": 0〜100
    }
  ]
}

・visits は「来所」または「欠席」の日だけを日付順で含める（利用なしの空欄日は含めない）。
・表の外の手書きメモ（例:「8/20 ありがとうございます」）や締切注記は無視する。
・confidence・nameConfidence は手書きのかすれ・○囲みの不明瞭さを反映した正直な値
（はっきり=90〜100、やや不明瞭=60〜79、判読困難=60未満）。`,

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
