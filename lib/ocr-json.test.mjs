/**
 * lib/ocr-json.test.mjs
 * サーバ側(api/ocr.js)のJSON抽出・修復ロジックの単体テスト
 *   実行: node --test lib/ocr-json.test.mjs
 *
 * 本番障害「OCR結果の解析に失敗しました：JSON解析失敗」の再現ケースを含む。
 * 原因は max_tokens:2048 で31日分の応答が途中で切れ、壊れたJSONになっていたこと。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { extractJson, repairTruncatedJson } from "../api/ocr.js";

// ── 正常系 ────────────────────────────────────
test("素のJSONをそのまま解析できる", () => {
  const r = extractJson('{"year":2026,"month":8,"visits":[]}');
  assert.equal(r.ok, true);
  assert.equal(r.data.year, 2026);
  assert.equal(r.repaired, false);
});

test("```json ... ``` のコードブロックを除去できる", () => {
  const r = extractJson('```json\n{"year":2026,"visits":[{"date":3}]}\n```');
  assert.equal(r.ok, true);
  assert.equal(r.data.visits[0].date, 3);
});

test("``` だけ（json表記なし）のコードブロックも除去できる", () => {
  const r = extractJson('```\n{"year":2026,"visits":[]}\n```');
  assert.equal(r.ok, true);
  assert.equal(r.data.year, 2026);
});

test("前後に説明文が付いていても抽出できる", () => {
  const txt = 'はい、画像を解析しました。\n{"year":2026,"visits":[{"date":5}]}\n以上です。ご確認ください。';
  const r = extractJson(txt);
  assert.equal(r.ok, true);
  assert.equal(r.data.visits[0].date, 5);
});

// ── ★本番障害の再現: 途中で切れたJSON ──────────
test("★回帰: max_tokensで途中が切れたJSONを修復して読み取れる", () => {
  // 実際の失敗パターン: 最後のvisitオブジェクトの途中で応答が終了している
  const truncated = `{
  "childName": "野々村 佳澄",
  "year": 2026,
  "month": 8,
  "visits": [
    {"date":3,"dayOfWeek":"月","status":"来所","startTime":"09:00","endTime":"17:00","pickup":true,"dropoff":true,"memo":null,"confidence":92},
    {"date":4,"dayOfWeek":"火","status":"来所","startTime":"09:00","endTime":"17:00","pickup":true,"dropoff":true,"memo":null,"confidence":92},
    {"date":6,"dayOfWeek":"木","status":"来所","startTime":"09:00","endTime":"17:00","pickup":true,"dropoff":true,"memo":"プール","confidence":90},
    {"date":7,"dayOfWeek":"金","status":"来所","startTime":"09:00","endTime":"1`;

  const r = extractJson(truncated);
  assert.equal(r.ok, true, "修復して解析できること");
  assert.equal(r.repaired, true, "修復フラグが立つこと");
  assert.equal(r.data.childName, "野々村 佳澄");
  // 完結していた3件は保持され、切れかけの1件だけが落ちる
  assert.equal(r.data.visits.length, 3);
  assert.deepEqual(r.data.visits.map(v => v.date), [3, 4, 6]);
});

test("配列が閉じていないだけのケースも修復できる", () => {
  const s = '{"year":2026,"visits":[{"date":1},{"date":2}';
  const r = extractJson(s);
  assert.equal(r.ok, true);
  assert.equal(r.repaired, true);
  assert.equal(r.data.visits.length, 2);
});

test("文字列リテラルの途中で切れた場合は誤った復元をしない", () => {
  // memoの文字列が閉じていない → 直前の完結オブジェクトまでで復元される
  const s = '{"visits":[{"date":1,"memo":"プール"},{"date":2,"memo":"大社お';
  const r = extractJson(s);
  assert.equal(r.ok, true);
  assert.equal(r.data.visits.length, 1);
  assert.equal(r.data.visits[0].memo, "プール");
});

test("エスケープされた引用符を含む文字列を壊さない", () => {
  const s = '{"visits":[{"date":1,"memo":"\\"特別\\"活動"}]}';
  const r = extractJson(s);
  assert.equal(r.ok, true);
  assert.equal(r.data.visits[0].memo, '"特別"活動');
});

// ── 異常系 ────────────────────────────────────
test("JSONが全く含まれない場合は理由付きで失敗する", () => {
  const r = extractJson("申し訳ありませんが、画像が不鮮明で読み取れませんでした。");
  assert.equal(r.ok, false);
  assert.equal(r.reason, "JSONが見つかりません");
  assert.ok(r.cleaned.length > 0, "原因調査用に本文を返すこと");
});

test("空の応答は理由付きで失敗する", () => {
  for (const v of ["", "   ", null, undefined]) {
    const r = extractJson(v);
    assert.equal(r.ok, false);
    assert.equal(r.reason, "応答が空でした");
  }
});

test("修復不能な壊れ方でも例外を投げずに失敗を返す", () => {
  const r = extractJson('{"visits":[{"date":');
  assert.equal(r.ok, false);
  assert.equal(r.reason, "JSON解析失敗");
});

// ── repairTruncatedJson 単体 ──────────────────
test("repairTruncatedJson: 壊れていないJSONはそのまま返す", () => {
  const s = '{"a":1}';
  assert.equal(repairTruncatedJson(s), s);
});

test("repairTruncatedJson: '}' が1つも無ければ null", () => {
  assert.equal(repairTruncatedJson('{"a":'), null);
});

// ── 共通モジュール化の回帰（api/_json.js を staff-doc-ai.js からも使う）──
test("身分証OCR: 拒否文＋JSONが混在しても抽出できる", () => {
  const txt = "個人情報保護の観点から一部のみ記載します。\n" +
    '{"detectedName":"山田 太郎","documentKind":"運転免許証","expiryDate":"2029-05-20","birthDate":"1990-01-15"}';
  const r = extractJson(txt);
  assert.equal(r.ok, true);
  assert.equal(r.data.documentKind, "運転免許証");
  assert.equal(r.data.expiryDate, "2029-05-20");
});

test("身分証OCR: JSONを一切含まない拒否文は失敗として検出できる", () => {
  const r = extractJson("申し訳ありませんが、個人情報を含むため読み取りできません。");
  assert.equal(r.ok, false);
  // 呼び出し側はこの本文から「拒否」を判定して手入力を案内する
  assert.match(r.cleaned || "", /申し訳|個人情報/);
});
