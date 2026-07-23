/**
 * api/ocr.js
 * Vercel Serverless Function: Claude Vision APIを使ったOCR処理
 * 受給者証・相談支援原案・利用予定表の画像から情報を自動抽出する
 */

import { requireUser } from "./_auth.js";

// ==================== JSON抽出・修復ユーティリティ ====================
// Claudeは基本的にJSONのみを返すが、実運用では以下の揺れが起こりうる。
//  (a) ```json ... ``` のコードブロックで囲む
//  (b) 「はい、解析しました」等の説明文が前後に付く
//  (c) max_tokens に達して応答が途中で切れる ← 31日分の予定表で実際に発生
// これらを自動補正し、JSON以外が返っても可能な限り読み取れるようにする。

/** 開いたままの括弧を閉じて、途中で切れたJSONを復元する（(c)対策） */
export function repairTruncatedJson(s) {
  // 最後に完結しているオブジェクト（＝最後の "}"）までを採用する
  const cut = s.lastIndexOf("}");
  if (cut < 0) return null;
  let cand = s.slice(0, cut + 1);

  // 文字列リテラルを考慮しつつ、開いている括弧を数える
  let inStr = false, esc = false;
  const stack = [];
  for (const c of cand) {
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") stack.push("}");
    else if (c === "[") stack.push("]");
    else if (c === "}" || c === "]") stack.pop();
  }
  if (inStr) return null;                 // 文字列の途中で切れている場合は復元しない
  if (stack.length === 0) return cand;

  cand = cand.replace(/,\s*$/, "");       // 末尾の余分なカンマを除去
  while (stack.length) cand += stack.pop();
  return cand;
}

/** 応答テキストからJSONを取り出す。戻り値: {ok, data, repaired, reason, cleaned} */
export function extractJson(text) {
  let s = String(text || "").trim();
  if (!s) return { ok: false, reason: "応答が空でした", cleaned: "" };

  // (a) コードブロックを除去
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  else s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

  // (b) 最初の "{" より前の説明文を除去
  const start = s.indexOf("{");
  if (start < 0) return { ok: false, reason: "JSONが見つかりません", cleaned: s.slice(0, 500) };
  s = s.slice(start);

  // まずはそのまま／最後の "}" までで試す
  const lastBrace = s.lastIndexOf("}");
  for (const cand of [s, lastBrace >= 0 ? s.slice(0, lastBrace + 1) : null]) {
    if (!cand) continue;
    try { return { ok: true, data: JSON.parse(cand), repaired: false }; } catch { /* 次の手段へ */ }
  }

  // (c) 途中で切れたJSONを修復して再挑戦
  const repaired = repairTruncatedJson(s);
  if (repaired) {
    try { return { ok: true, data: JSON.parse(repaired), repaired: true }; } catch { /* 修復失敗 */ }
  }
  return { ok: false, reason: "JSON解析失敗", cleaned: s.slice(0, 500) };
}

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

  // ★ 31日分の利用予定表は 2048 では応答が途中で切れて壊れたJSONになる
  //   （「JSON解析失敗」の直接原因）。モードごとに十分な上限を与える。
  const maxTokens = mode === "yotei" ? 8192 : 4096;
  // 個人情報を常時ログに残さないため、応答全文は OCR_DEBUG=1 のときのみ出力する
  const DEBUG = process.env.OCR_DEBUG === "1";

  // ── ログ1: 画像アップロード受信 ──
  console.log(`[OCR] 1.画像受信 mode=${mode} mediaType=${mediaType} base64=${Math.round(imageBase64.length/1024)}KB`);

  try {
    // ── ログ2: Claudeへ送信 ──
    console.log(`[OCR] 2.Claude送信 model=claude-opus-4-5 max_tokens=${maxTokens} promptLen=${prompt.length}`);
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: maxTokens,
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
      console.error(`[OCR] 3.Claude応答エラー status=${response.status} body=${errText.slice(0, 500)}`);
      return res.status(500).json({ error: "Claude API エラー: " + errText });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "";
    const stopReason = data.stop_reason;

    // ── ログ3: Claudeレスポンス ──
    console.log(`[OCR] 3.Claude応答 stop_reason=${stopReason} textLen=${text.length} usage=${JSON.stringify(data.usage||{})}`);
    if (DEBUG) console.log(`[OCR] 3-full.応答全文\n${text}`);
    else       console.log(`[OCR] 3-preview.先頭300字: ${text.slice(0, 300).replace(/\n/g, "\\n")}`);

    // 応答が上限で切れた場合は明示（修復を試みるが、日付が欠ける可能性がある）
    if (stopReason === "max_tokens") {
      console.warn(`[OCR] ⚠ max_tokens(${maxTokens})に到達し応答が途中で切れました。修復を試みます。`);
    }

    // ── ログ4: JSON.parse前の文字列 ──
    console.log(`[OCR] 4.parse前 先頭200字=${text.trim().slice(0, 200).replace(/\n/g, "\\n")}`);
    console.log(`[OCR] 4.parse前 末尾200字=${text.trim().slice(-200).replace(/\n/g, "\\n")}`);

    // ```json除去 → 説明文除去 → 途中切れの修復、の順に自動補正する
    const ext = extractJson(text);

    if (ext.ok) {
      const n = Array.isArray(ext.data?.visits) ? ext.data.visits.length : null;
      console.log(`[OCR] ✅ 解析成功 repaired=${!!ext.repaired} visits=${n ?? "-"}`);
      return res.json({
        success: true,
        data: ext.data,
        rawText: text,
        // 修復・途中切れがあったことをクライアントに伝える（確認画面で警告表示に使える）
        truncated: stopReason === "max_tokens" || !!ext.repaired,
      });
    }

    // ── ログ5: JSON.parseエラー ──
    console.error(`[OCR] 5.JSON解析失敗 reason=${ext.reason} stop_reason=${stopReason} textLen=${text.length}`);
    console.error(`[OCR] 5.解析対象(先頭500字)=${(ext.cleaned || "").replace(/\n/g, "\\n")}`);
    return res.json({
      success: false,
      rawText: text,
      error: stopReason === "max_tokens"
        ? "読み取り結果が長すぎて途中で切れました。撮影範囲を狭めて再度お試しください。"
        : ext.reason,
      stopReason,
    });

  } catch (e) {
    console.error(`[OCR] 例外 ${e?.message}`);
    return res.status(500).json({ error: e.message });
  }
}
