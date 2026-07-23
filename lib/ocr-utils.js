/**
 * lib/ocr-utils.js
 * 予定表・書類OCRの共通ユーティリティ（画像圧縮 / 応答解釈 / 値の正規化）
 *
 * 【このモジュールが生まれた背景 = 本番障害の根本原因】
 * Vercelサーバーレス関数のリクエストボディ上限は 4.5MB。
 * iPhoneで撮影した写真(3〜5MBのJPEG)をそのまま base64 にすると 4〜7MB になり、
 * 上限超過で関数に到達しないまま Vercel が 413 を **text/plain** で返す。
 * クライアントが resp.json() を無条件に呼んでいたため JSON パースに失敗し、
 * WebKit(iOS Safari) 特有の文言
 *   「The string did not match the expected pattern.」
 * が「通信エラー」として表示されていた（実際には通信は成立している）。
 *
 * 対策:
 *  1) 送信前に必ず縮小＋JPEG再エンコードして base64 を上限内に収める（HEIC/PNG対策も兼ねる）
 *  2) 応答は必ず text() で受けてから JSON 化し、HTTPエラー・非JSONを段階別メッセージへ変換
 *  3) OCRが返す空欄・「〜」・丸印・全角数字・改行を安全に正規化し、不正値は null に倒す
 */

// 約2.8MB（JSON全体でも4.5MB上限に十分な余裕を持たせる）
export const OCR_MAX_B64_BYTES = 2_800_000;

// 開発時のみデバッグログを出す（Nodeでのテスト実行時は false）
export const OCR_DEV = (() => {
  try { return !!(import.meta && import.meta.env && import.meta.env.DEV); }
  catch { return false; }
})();

// ──────────────────────────────────────────────
// 画像圧縮
// ──────────────────────────────────────────────

/**
 * 画像ファイルを長辺 maxPx に縮小し、JPEG の dataURL へ再エンコードする。
 * HEIC/PNG/巨大写真も一律 JPEG 化されるため mediaType の不一致も同時に解消される。
 * @returns {Promise<string>} "data:image/jpeg;base64,..." 形式
 */
export function ocrCompressImage(file, { maxPx = 1600, quality = 0.82 } = {}) {
  return new Promise((resolve, reject) => {
    const objUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight));
        let w = Math.max(1, Math.round(img.naturalWidth  * scale));
        let h = Math.max(1, Math.round(img.naturalHeight * scale));
        let q = quality, dataUrl = "";
        // 上限に収まるまで 品質 → 寸法 の順に落とす（最大6回）
        for (let i = 0; i < 6; i++) {
          const cv = document.createElement("canvas");
          cv.width = w; cv.height = h;
          const cx = cv.getContext("2d");
          cx.fillStyle = "#fff"; cx.fillRect(0, 0, w, h);   // 透過PNGが黒くなるのを防ぐ
          cx.drawImage(img, 0, 0, w, h);
          dataUrl = cv.toDataURL("image/jpeg", q);
          if (dataUrl.length - dataUrl.indexOf(",") - 1 <= OCR_MAX_B64_BYTES) break;
          if (q > 0.5) q -= 0.12;
          else { w = Math.max(1, Math.round(w * 0.8)); h = Math.max(1, Math.round(h * 0.8)); }
        }
        URL.revokeObjectURL(objUrl);
        if (!dataUrl || dataUrl.indexOf(",") < 0) return reject(new Error("画像の変換に失敗しました"));
        resolve(dataUrl);
      } catch (e) { URL.revokeObjectURL(objUrl); reject(e); }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      reject(new Error("画像を読み込めませんでした（対応していない形式の可能性があります）"));
    };
    img.src = objUrl;
  });
}

// ──────────────────────────────────────────────
// 応答の解釈
// ──────────────────────────────────────────────

/** 処理段階つきエラー（画面には段階名＋短い説明、consoleには詳細を出す） */
export function ocrError(stage, userMsg, detail) {
  const e = new Error(userMsg);
  e.stage = stage;
  e.detail = detail || "";
  return e;
}

/**
 * APIレスポンスを安全に JSON 化する。
 * HTTPエラー・非JSON応答(413のtext/plain等)を段階別の日本語メッセージへ変換し、
 * resp.json() が Safari で不可解な例外になるのを防ぐ。
 * ※画面には環境変数・個人情報を出さない。consoleにも本文は先頭200字まで。
 */
export async function ocrReadJson(resp) {
  const ct  = (resp.headers && resp.headers.get("content-type")) || "";
  const raw = await resp.text();
  if (OCR_DEV) console.log(`[OCR] status=${resp.status} content-type=${ct} bodyLen=${raw.length}`);
  if (!resp.ok) {
    const msg =
      resp.status === 413 ? "画像のデータが大きすぎます。もう一度撮影し直してください。"
      : resp.status === 401 ? "ログインの有効期限が切れています。再ログインしてください。"
      : resp.status === 403 ? "この操作を行う権限がありません。"
      : resp.status >= 500  ? "サーバー側でエラーが発生しました。サーバー設定を確認してください。"
      : `画像の送信に失敗しました（コード ${resp.status}）`;
    throw ocrError("画像送信", msg, `status=${resp.status} ct=${ct} body=${raw.slice(0, 200)}`);
  }
  // markdownコードブロックや前後の説明文を除去してから解析
  let s = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  if (s && s[0] !== "{" && s[0] !== "[") {
    const i = s.search(/[{[]/), j = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
    if (i >= 0 && j > i) s = s.slice(i, j + 1);
  }
  try { return JSON.parse(s); }
  catch {
    throw ocrError("OCR結果の解析", "OCR結果を読み取れませんでした。もう一度お試しください。",
                   `ct=${ct} head=${raw.slice(0, 120)}`);
  }
}

// ──────────────────────────────────────────────
// 値の正規化（不正値は例外にせず null にして「未登録／要確認」に倒す）
// ──────────────────────────────────────────────

const z2 = n => String(n).padStart(2, "0");

/** 「9:00」「9：00」「０９時００分」「9.00」「〜」→ "09:00" / 変換不能は null */
export function ocrTime(v) {
  if (v == null) return null;
  const s = String(v)
    .replace(/[　\s]/g, "")
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[：.,、]/g, ":").replace(/時/g, ":").replace(/分/g, "");
  if (!s || /^[~〜ー―\-–—]+$/.test(s)) return null;
  const m = s.match(/^(\d{1,2}):?(\d{0,2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10), mi = m[2] === "" ? 0 : parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(mi) || h > 23 || mi > 59) return null;
  return `${z2(h)}:${z2(mi)}`;
}

/** 年月＋日 → "YYYY-MM-DD"。月の範囲外・数値でない場合は null（Invalid Date を DB に送らない） */
export function ocrDate(y, m, d) {
  const yy = parseInt(y, 10), mm = parseInt(m, 10), dd = parseInt(d, 10);
  if (![yy, mm, dd].every(Number.isFinite)) return null;
  if (mm < 1 || mm > 12 || yy < 2000 || yy > 2100) return null;
  const last = new Date(yy, mm, 0).getDate();
  if (dd < 1 || dd > last) return null;
  return `${yy}-${z2(mm)}-${z2(dd)}`;
}

/** 備考など自由記述（改行・全角空白を整理。実質空なら null） */
export function ocrText(v) {
  if (v == null) return null;
  const s = String(v).replace(/\r?\n/g, " ").replace(/[　\s]+/g, " ").trim();
  return (s === "" || /^[-—–ー~〜]+$/.test(s)) ? null : s;
}

/** ○/◯/●/✓/有 などの手書き丸印を boolean に正規化 */
export function ocrFlag(v) {
  if (typeof v === "boolean") return v;
  if (v == null) return false;
  return /^(true|1|○|◯|〇|●|✓|✔|レ|有|あり)$/i.test(String(v).trim());
}
