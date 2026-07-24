/**
 * api/_json.js
 * Claude応答からJSONを取り出す共通ユーティリティ（サーバー側）
 * ・ファイル名が "_" 始まりのため Vercel のエンドポイントにはならない（ヘルパー扱い）
 *
 * Claudeは基本的にJSONのみを返すが、実運用では以下の揺れが起こりうる。
 *  (a) ```json ... ``` のコードブロックで囲む
 *  (b) 「はい、解析しました」等の説明文が前後に付く
 *  (c) max_tokens に達して応答が途中で切れる ← 31日分の予定表で実際に発生
 * これらを自動補正し、JSON以外が返っても可能な限り読み取れるようにする。
 */

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
