/**
 * lib/ocr-utils.test.mjs
 * 予定表OCRユーティリティの単体テスト
 *   実行: node --test lib/ocr-utils.test.mjs
 *
 * 本番障害（iPhone Safari「The string did not match the expected pattern.」）の
 * 再現ケースを含む。413(text/plain) を resp.json() せずに段階別メッセージへ
 * 変換できることを回帰テストとして固定する。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { ocrTime, ocrDate, ocrText, ocrFlag, ocrReadJson,
         ocrFileToBase64, ocrPrepareUpload, OCR_MAX_B64_BYTES } from "./ocr-utils.js";

// ── アップロード前処理（PDF分岐はブラウザ非依存なのでNodeで検証できる）─────
// 画像分岐は canvas/Image が要るためブラウザ実機（プレビュー）で確認する。

test("PDFは圧縮できないのでそのまま送るが、mediaTypeは application/pdf になる", async () => {
  const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], "a.pdf", { type: "application/pdf" });
  const r = await ocrPrepareUpload(file);
  assert.equal(r.isPdf, true);
  assert.equal(r.mediaType, "application/pdf");
  assert.equal(r.base64, "JVBERi0=");                    // "%PDF-"
  assert.ok(r.dataUrl.startsWith("data:application/pdf;base64,"));
});

test("★回帰: 上限を超えるPDFは送信前に弾く（413で text/plain が返るのを防ぐ）", async () => {
  const big = new File([new Uint8Array(OCR_MAX_B64_BYTES)], "big.pdf", { type: "application/pdf" });
  await assert.rejects(() => ocrPrepareUpload(big), e => {
    assert.equal(e.stage, "画像の準備");
    assert.match(e.message, /大きすぎます/);
    return true;
  });
});

test("ファイル未選択は段階つきエラーにする（undefinedで落とさない）", async () => {
  await assert.rejects(() => ocrPrepareUpload(null), /ファイルが選択されていません/);
});

test("base64化: バイト列を正しく符号化する", async () => {
  const f = new File([new TextEncoder().encode("こんにちは")], "a.bin", { type: "application/octet-stream" });
  assert.equal(ocrFileToBase64 && typeof ocrFileToBase64, "function");
  assert.equal(await ocrFileToBase64(f), Buffer.from("こんにちは", "utf8").toString("base64"));
});

// ── 時刻の正規化 ──────────────────────────────
test("時刻: 「9:00〜17:00」の一般形", () => {
  assert.equal(ocrTime("9:00"),  "09:00");
  assert.equal(ocrTime("17:00"), "17:00");
  assert.equal(ocrTime("09:30"), "09:30");
});

test("時刻: 手書き由来の揺れ（全角・全角コロン・時分・ドット・空白）", () => {
  assert.equal(ocrTime("９：００"),  "09:00");
  assert.equal(ocrTime("9時30分"),  "09:30");
  assert.equal(ocrTime("9.00"),     "09:00");
  assert.equal(ocrTime(" 9:00 "),   "09:00");
  assert.equal(ocrTime("9"),        "09:00");   // 時のみ記入
});

test("時刻: 空欄・波線・判読不能は null（例外にしない）", () => {
  for (const v of ["", "〜", "~", "ー", "—", null, undefined, "abc", "25:00", "9:70", "----"])
    assert.equal(ocrTime(v), null, `入力=${JSON.stringify(v)}`);
});

// ── 日付の正規化 ──────────────────────────────
test("日付: 31日分すべてが YYYY-MM-DD になる（2026年8月）", () => {
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const out  = days.map(d => ocrDate(2026, 8, d));
  assert.equal(out.filter(Boolean).length, 31);
  assert.equal(out[0],  "2026-08-01");
  assert.equal(out[30], "2026-08-31");
});

test("日付: 月末を超える日・不正値は null（Invalid Date を DB へ送らない）", () => {
  assert.equal(ocrDate(2026, 2, 30), null);   // 2月30日
  assert.equal(ocrDate(2026, 4, 31), null);   // 4月31日
  assert.equal(ocrDate(2026, 13, 1), null);   // 13月
  assert.equal(ocrDate(2026, 8, 0),  null);
  assert.equal(ocrDate(2026, 8, undefined), null);
  assert.equal(ocrDate(2026, 8, NaN), null);
  assert.equal(ocrDate(undefined, 8, 3), null);
  assert.equal(ocrDate(2026, 8, "あ"), null);
});

test("日付: うるう年を正しく扱う", () => {
  assert.equal(ocrDate(2028, 2, 29), "2028-02-29"); // うるう年
  assert.equal(ocrDate(2026, 2, 29), null);         // 平年
});

// ── 送迎の丸印 ────────────────────────────────
test("送迎: 手書きの丸印を boolean へ", () => {
  for (const v of ["○", "◯", "〇", "●", "✓", "有", "あり", true, "1"])
    assert.equal(ocrFlag(v), true, `入力=${JSON.stringify(v)}`);
  for (const v of ["", "×", "なし", null, undefined, false, "-"])
    assert.equal(ocrFlag(v), false, `入力=${JSON.stringify(v)}`);
});

// ── 備考欄 ────────────────────────────────────
test("備考: 日本語・改行・全角空白を整理し、実質空は null", () => {
  assert.equal(ocrText("プール"), "プール");
  assert.equal(ocrText("大社お祭り①"), "大社お祭り①");
  assert.equal(ocrText("マックに\n行こう"), "マックに 行こう");
  assert.equal(ocrText("　避難訓練　"), "避難訓練");
  assert.equal(ocrText("休み"), "休み");
  for (const v of ["", "   ", "—", "〜", null, undefined])
    assert.equal(ocrText(v), null, `入力=${JSON.stringify(v)}`);
});

// ── 応答の解釈（本番障害の回帰テスト）────────────
const mkRes = (body, status, ct) =>
  new Response(body, { status, headers: { "content-type": ct } });

test("★回帰: 413 text/plain を段階別メッセージに変換（Safariの不可解な例外を防ぐ）", async () => {
  const res = mkRes("Request Entity Too Large\n\nFUNCTION_PAYLOAD_TOO_LARGE", 413, "text/plain");
  await assert.rejects(() => ocrReadJson(res), err => {
    assert.equal(err.stage, "画像送信");
    assert.match(err.message, /画像のデータが大きすぎます/);
    assert.doesNotMatch(err.message, /did not match the expected pattern/);
    return true;
  });
});

test("401 / 403 / 500 をそれぞれ分かりやすい文言にする", async () => {
  await assert.rejects(() => ocrReadJson(mkRes('{"error":"x"}', 401, "application/json")),
    e => /再ログイン/.test(e.message));
  await assert.rejects(() => ocrReadJson(mkRes('{"error":"x"}', 403, "application/json")),
    e => /権限がありません/.test(e.message));
  await assert.rejects(() => ocrReadJson(mkRes("Internal Error", 500, "text/plain")),
    e => /サーバー設定を確認/.test(e.message));
});

test("正常系: JSONをそのまま解析できる", async () => {
  const body = JSON.stringify({ success: true, data: { year: 2026, month: 8, visits: [] } });
  const out  = await ocrReadJson(mkRes(body, 200, "application/json"));
  assert.equal(out.success, true);
  assert.equal(out.data.year, 2026);
});

test("markdownコードブロック・前後の説明文が付いていても解析できる", async () => {
  const fenced = "```json\n{\"success\":true,\"data\":{\"visits\":[]}}\n```";
  assert.equal((await ocrReadJson(mkRes(fenced, 200, "text/plain"))).success, true);

  const chatty = 'はい、解析しました。\n{"success":true,"data":{"visits":[]}}\nご確認ください。';
  assert.equal((await ocrReadJson(mkRes(chatty, 200, "text/plain"))).success, true);
});

test("200なのに本文がJSONでない場合は「OCR結果の解析」段階のエラーにする", async () => {
  await assert.rejects(() => ocrReadJson(mkRes("<html>error</html>", 200, "text/html")), err => {
    assert.equal(err.stage, "OCR結果の解析");
    assert.match(err.message, /読み取れませんでした/);
    return true;
  });
});

// ── 実データ相当の統合ケース ──────────────────
test("統合: 実物予約表(2026年8月)の1か月分を正規化しても落ちない", () => {
  // 来所16日 / 休み9日 / 空欄6日 を含む、OCRが返しうる揺れを混ぜた入力
  const raw = [
    { date: 3,  status: "来所", startTime: "9:00",  endTime: "17:00", pickup: "○", dropoff: "○", memo: null },
    { date: 6,  status: "来所", startTime: "９：００", endTime: "17：00", pickup: "◯", dropoff: "○", memo: "プール" },
    { date: 8,  status: "欠席", startTime: "〜",     endTime: "〜",     pickup: "",  dropoff: "",  memo: "休み" },
    { date: 11, status: "欠席", startTime: null,     endTime: undefined, pickup: null, dropoff: null, memo: "ビンゴ大会" },
    { date: 15, status: "欠席", startTime: "",       endTime: "",       pickup: "×", dropoff: "×", memo: "大社お祭り①" },
    { date: 27, status: "来所", startTime: "9時",    endTime: "17:00",  pickup: "有", dropoff: "あり", memo: "避難訓練" },
    { date: 31, status: "来所", startTime: "9:00",   endTime: "17:00",  pickup: true, dropoff: true, memo: "" },
    // 異常データ（登録処理全体を止めてはいけない）
    { date: 99, status: "来所", startTime: "9:00",   endTime: "17:00",  pickup: "○", dropoff: "○", memo: null },
    { date: undefined, status: "来所", startTime: "x", endTime: "y",    pickup: "○", dropoff: "○", memo: null },
  ];

  const normalized = raw.map(v => {
    const st = v.status === "欠席" ? "欠席" : "来所";
    return {
      date: parseInt(v.date, 10),
      status: st,
      startTime: st === "欠席" ? null : ocrTime(v.startTime),
      endTime:   st === "欠席" ? null : ocrTime(v.endTime),
      pickup:    st === "欠席" ? false : ocrFlag(v.pickup),
      dropoff:   st === "欠席" ? false : ocrFlag(v.dropoff),
      memo: ocrText(v.memo),
    };
  }).filter(v => Number.isFinite(v.date) && v.date >= 1 && v.date <= 31);

  // date=99 と date=undefined は除外される
  assert.equal(normalized.length, 7);

  // 保存時に日付へ変換できる行だけが登録対象になる
  const rows = normalized.map(v => ({ ...v, visit_date: ocrDate(2026, 8, v.date) }))
                         .filter(r => r.visit_date);
  assert.equal(rows.length, 7);

  // undefined / NaN / Invalid Date が一切含まれないこと
  for (const r of rows) {
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(r.visit_date));
    for (const k of ["startTime", "endTime", "memo"])
      assert.ok(r[k] === null || typeof r[k] === "string", `${k} が不正: ${r[k]}`);
    for (const k of ["pickup", "dropoff"])
      assert.equal(typeof r[k], "boolean");
  }

  // 個別の期待値
  const d6 = rows.find(r => r.date === 6);
  assert.deepEqual([d6.startTime, d6.endTime, d6.pickup, d6.memo], ["09:00", "17:00", true, "プール"]);

  const d8 = rows.find(r => r.date === 8);   // 休み（斜線）
  assert.deepEqual([d8.startTime, d8.endTime, d8.pickup, d8.dropoff], [null, null, false, false]);

  const d27 = rows.find(r => r.date === 27); // 「9時」＋「有/あり」
  assert.deepEqual([d27.startTime, d27.pickup, d27.dropoff], ["09:00", true, true]);

  const d31 = rows.find(r => r.date === 31); // 備考が空文字 → null
  assert.equal(d31.memo, null);
});
