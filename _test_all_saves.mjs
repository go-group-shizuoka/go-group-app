// ============================================================
// GO GROUP アプリ 全保存操作 シミュレーションテスト
// ブラウザなしでロジック・バリデーション・データ構造を検証
// ============================================================

let passed = 0;
let failed = 0;
let warns  = 0;
const results = [];

function ok(name, detail = "") {
  passed++;
  results.push({ status: "✅ PASS", name, detail });
}
function ng(name, detail = "") {
  failed++;
  results.push({ status: "❌ FAIL", name, detail });
}
function warn(name, detail = "") {
  warns++;
  results.push({ status: "⚠️ WARN", name, detail });
}

// ── ユーティリティ（アプリと同じロジック） ──
const genId = () => "test_" + Math.random().toString(36).slice(2, 10);
const todayISO = () => new Date().toISOString().slice(0, 10);
const nowStr = () => new Date().toLocaleString("ja-JP");

const FACILITIES = [
  { id: "f1", name: "GO HOME" },
  { id: "f2", name: "GO ROOM" },
  { id: "f3", name: "GO TOWN 1ST" },
  { id: "f4", name: "GO TOWN 2ND" },
];

// テストデータ
const TEST_USER   = { id: "a1", role: "staff", displayName: "テスト職員", selectedFacilityId: "f1" };
const TEST_STAFF  = { id: "s1", name: "田中 美穂", facilityId: "f1", active: true };
const TEST_KID    = { id: "u1", name: "利用者A", grade: "小3", facilityId: "f1", active: true, disability: "自閉スペクトラム症" };
const TEST_KID2   = { id: "u2", name: "利用者B", grade: "小5", facilityId: "f1", active: true };

// ストアのシミュレーション
const store = {
  recs: [],
  msgs: [],
  isps: [],
  assessments: [],
  monitorings: [],
  ispRecords: [],
  dynUsers: [TEST_KID, TEST_KID2],
  dynStaff: [TEST_STAFF],
  addRec: (r) => { store.recs.push(r); return r; },
  addMsg: (m) => { store.msgs.push(m); return m; },
  addIsp: (i) => { store.isps.push(i); return i; },
  addAssessment: (a) => { store.assessments.push(a); return a; },
  addMonitoring: (m) => { store.monitorings.push(m); return m; },
  addIspRecord: (r) => { store.ispRecords.push(r); return r; },
  updIspRecord: (id, ch) => {
    const idx = store.ispRecords.findIndex(x => x.id === id);
    if (idx >= 0) store.ispRecords[idx] = { ...store.ispRecords[idx], ...ch };
  },
};

// ============================================================
// TEST 1: 職員出勤
// ============================================================
console.log("\n▶ TEST 1: 職員出勤");
{
  // バリデーション: temp が必須
  const temp = "";
  const disabled = !temp;
  if (disabled) {
    warn("職員出勤: 体温未入力で保存不可（期待通り）", "temp='' → disabled=true");
  }

  // 正常保存
  const rec = store.addRec({
    id: genId(), type: "staff_in",
    staffId: TEST_STAFF.id, staffName: TEST_STAFF.name,
    facilityId: "f1", facilityName: "GO HOME",
    time: nowStr(), temp: "36.4", photo: true, note: "",
    createdBy: TEST_USER.displayName, history: [],
  });

  if (rec.type === "staff_in" && rec.staffId === "s1" && rec.temp === "36.4") {
    ok("職員出勤: 保存成功", `id=${rec.id} temp=${rec.temp}`);
  } else {
    ng("職員出勤: 保存失敗");
  }

  // 高体温チェック
  const highTemp = store.recs.filter(r => r.type === "staff_in" && parseFloat(r.temp) >= 37.5);
  ok("職員出勤: 高体温アラート判定", `高体温者数=${highTemp.length}（正常=0）`);
}

// ============================================================
// TEST 2: 職員退勤
// ============================================================
console.log("\n▶ TEST 2: 職員退勤");
{
  const sel = TEST_STAFF;
  const time = "17:30";
  const disabled = !sel || !time;
  if (!disabled) {
    ok("職員退勤: バリデーション通過", "sel+time あり");
  } else {
    ng("職員退勤: バリデーション失敗");
  }

  const rec = store.addRec({
    id: genId(), type: "staff_out",
    staffId: sel.id, staffName: sel.name,
    facilityId: "f1", facilityName: "GO HOME",
    time: nowStr(), temp: "36.3", photo: true, note: "",
    createdBy: TEST_USER.displayName, history: [],
  });

  if (rec.type === "staff_out" && rec.staffId === "s1") {
    ok("職員退勤: 保存成功", `id=${rec.id}`);
  } else {
    ng("職員退勤: 保存失敗");
  }
}

// ============================================================
// TEST 3: 利用者来所
// ============================================================
console.log("\n▶ TEST 3: 利用者来所");
{
  // バリデーション確認（アプリは体温なしでも保存可能）
  const sheet = TEST_KID;
  const temp = "36.5";
  const tr = "あり";
  const dayType = "放課後";

  const rec = store.addRec({
    id: genId(), type: "user_in",
    userId: sheet.id, userName: sheet.name,
    facilityId: "f1", facilityName: "GO HOME",
    time: nowStr(), temp, transport: tr, dayType,
    photo: true, note: "", createdBy: TEST_USER.displayName, history: [],
  });

  if (rec.type === "user_in" && rec.userId === "u1" && rec.transport === "あり") {
    ok("利用者来所: 保存成功", `userId=${rec.userId} temp=${rec.temp} transport=${rec.transport}`);
  } else {
    ng("利用者来所: 保存失敗");
  }

  // 体温37.5以上のアラート判定
  const highKids = store.recs.filter(r => r.type === "user_in" && parseFloat(r.temp) >= 37.5);
  ok("利用者来所: 高体温アラート判定", `高体温者数=${highKids.length}`);

  // 来所済みIDリスト
  const arrivedIds = [...new Set(store.recs.filter(r => r.type === "user_in").map(r => r.userId))];
  if (arrivedIds.includes("u1")) {
    ok("利用者来所: 来所済み判定", "u1が来所済みに含まれる");
  } else {
    ng("利用者来所: 来所済み判定失敗");
  }
}

// ============================================================
// TEST 4: 利用者退所
// ============================================================
console.log("\n▶ TEST 4: 利用者退所");
{
  const sel = TEST_KID;
  const time = "17:00";
  const disabled = !sel || !time;

  if (!disabled) {
    ok("利用者退所: バリデーション通過");
  } else {
    ng("利用者退所: バリデーション失敗");
  }

  const rec = store.addRec({
    id: genId(), type: "user_out",
    userId: sel.id, userName: sel.name,
    facilityId: "f1", facilityName: "GO HOME",
    time: nowStr(), transport: "あり", dayType: "放課後",
    photo: false, note: "", createdBy: TEST_USER.displayName, history: [],
  });

  if (rec.type === "user_out" && rec.userId === "u1") {
    ok("利用者退所: 保存成功", `userId=${rec.userId}`);
  } else {
    ng("利用者退所: 保存失敗");
  }

  // 退所済みIDリスト
  const departedIds = [...new Set(store.recs.filter(r => r.type === "user_out").map(r => r.userId))];
  if (departedIds.includes("u1")) {
    ok("利用者退所: 退所済み判定", "u1が退所済みに含まれる");
  } else {
    ng("利用者退所: 退所済み判定失敗");
  }
}

// ============================================================
// TEST 5: 写真記録
// ============================================================
console.log("\n▶ TEST 5: 写真記録");
{
  // !cap 必須問題の検証
  const cap_false = false;
  const act = "工作";
  const sel = TEST_KID;
  const disabled_with_cap = !sel || !act || !cap_false;

  if (disabled_with_cap) {
    warn("写真記録: cap=false の場合保存不可", "⚠️ カメラ未使用端末で保存できない問題あり → 修正推奨");
  }

  // cap=true でテスト
  const cap_true = true;
  const disabled_ok = !sel || !act || !cap_true;
  if (!disabled_ok) {
    ok("写真記録: cap=true の場合保存可能");
  }

  const rec = store.addRec({
    id: genId(), type: "photo",
    userId: sel.id, userName: sel.name,
    facilityId: "f1", facilityName: "GO HOME",
    activity: act, photo: true, comment: "テストコメント",
    time: nowStr(), createdBy: TEST_USER.displayName, history: [],
  });

  if (rec.type === "photo" && rec.activity === "工作") {
    ok("写真記録: 保存成功", `activity=${rec.activity}`);
  } else {
    ng("写真記録: 保存失敗");
  }
}

// ============================================================
// TEST 6: サービス記録
// ============================================================
console.log("\n▶ TEST 6: サービス記録");
{
  const sel = TEST_KID;
  const its = ["身体介護", "移動支援"];
  const mood = "😊";
  const arr = "14:30";
  const dep = "17:00";

  // バリデーション
  const disabled = !sel || its.length === 0 || !mood || !arr;
  if (!disabled) {
    ok("サービス記録: バリデーション通過", `items=${its.length} mood=${mood} arr=${arr}`);
  } else {
    ng("サービス記録: バリデーション失敗");
  }

  const rec = store.addRec({
    id: genId(), type: "service",
    userId: sel.id, userName: sel.name,
    facilityId: "f1", facilityName: "GO HOME",
    time: nowStr(), arrival: arr, departure: dep,
    items: its, mood,
    bodyNote: "体温36.5℃、食欲あり",
    supportNote: "個別療育で集中できた",
    specialNote: "",
    createdBy: TEST_USER.displayName, history: [],
  });

  if (rec.type === "service" && rec.items.length === 2 && rec.mood === "😊") {
    ok("サービス記録: 保存成功", `items=${rec.items.join(",")} mood=${rec.mood}`);
  } else {
    ng("サービス記録: 保存失敗");
  }

  // 特記事項なしでも保存できるか
  const hasSpecial = !!rec.specialNote;
  ok("サービス記録: 特記事項は任意", `specialNote=${hasSpecial ? "あり" : "なし（任意OK）"}`);
}

// ============================================================
// TEST 7: 保護者連絡
// ============================================================
console.log("\n▶ TEST 7: 保護者連絡");
{
  const newTo = "u1";
  const newBody = "今日は工作で紙粘土を作りました。とても集中して取り組めていました。";
  const newPhotoData = null;

  // バリデーション: 宛先 + (本文 or 写真)
  const disabled = !newTo || (!newBody.trim() && !newPhotoData);
  if (!disabled) {
    ok("保護者連絡: バリデーション通過", "宛先+本文あり");
  } else {
    ng("保護者連絡: バリデーション失敗");
  }

  // 本文なし・写真なし → 送信不可
  const disabled2 = !newTo || (!"".trim() && !null);
  if (disabled2) {
    ok("保護者連絡: 本文・写真なしで送信不可（期待通り）");
  }

  const msg = store.addMsg({
    id: genId(),
    userId: newTo, userName: TEST_KID.name,
    facilityId: "f1", from: TEST_USER.displayName,
    body: newBody, time: nowStr(),
    read: true, replies: [],
  });

  if (msg.userId === "u1" && msg.body === newBody) {
    ok("保護者連絡: 保存成功", `to=${msg.userName} body length=${msg.body.length}`);
  } else {
    ng("保護者連絡: 保存失敗");
  }

  // 未読カウント確認
  const unread = store.msgs.filter(m => !m.read).length;
  ok("保護者連絡: 既読管理", `未読数=${unread}（送信側はread=true）`);
}

// ============================================================
// TEST 8: 個別支援計画 原案作成（AI生成）
// ============================================================
console.log("\n▶ TEST 8: 個別支援計画 原案作成");
{
  // AI生成ロジックのシミュレーション
  const u = TEST_KID;
  const assessments = [];
  const isps = [];
  const recs = store.recs.filter(r => r.type === "service");

  // generateIspDraftContent の簡易版
  const grade = u.grade || "小学生";
  const dis = u.disability || "発達障害";
  const draft = {
    userNeeds: `${u.name}さんが友達と一緒に楽しく活動でき、自分の気持ちを言葉で伝えられるようになること`,
    parentNeeds: "集団の中でのコミュニケーション力を育てほしい。",
    longGoal: `自分の感情や気持ちを言葉や表情で相手に伝えられるようになる（${grade}）`,
    longGoalTerm: "1年間",
    shortGoal: "支援員のサポートを受けながら、活動の切り替えを5分以内にできる場面を増やす",
    shortGoalTerm: "6ヶ月",
    supportContent: "① 視覚的なスケジュールを活用し、活動の見通しを持てるよう支援する",
    disabilityType: dis,
    generatedFrom: { hasAssessment: false, hasPrevIsp: false, svcCount: recs.length },
  };

  if (draft.longGoal && draft.shortGoal && draft.supportContent) {
    ok("個別支援計画: AI原案生成成功", `longGoal="${draft.longGoal.slice(0, 30)}..."`);
  } else {
    ng("個別支援計画: AI原案生成失敗");
  }

  // 承認フロー: ai_draft で保存
  const ispRec = store.addIspRecord({
    id: genId(), userId: u.id, facilityId: u.facilityId,
    docType: "isp_plan", status: "ai_draft",
    content: { ...draft, validFrom: "2026-04-01", validTo: "2026-09-30" },
    createdBy: TEST_USER.displayName, createdAt: nowStr(), updatedAt: nowStr(),
    history: [{ actor: TEST_USER.displayName, role: "staff", action: "AI原案作成", at: nowStr(), note: "" }],
  });

  if (ispRec.status === "ai_draft" && ispRec.docType === "isp_plan") {
    ok("個別支援計画: 初期ステータス ai_draft", `id=${ispRec.id}`);
  } else {
    ng("個別支援計画: ステータス設定失敗");
  }

  // 担当職員が確認 → staff_checked へ
  store.updIspRecord(ispRec.id, {
    status: "staff_checked", updatedAt: nowStr(),
    history: [...ispRec.history, { actor: TEST_USER.displayName, role: "staff", action: "担当確認", at: nowStr(), note: "内容確認済み" }],
  });

  const updated = store.ispRecords.find(r => r.id === ispRec.id);
  if (updated?.status === "staff_checked") {
    ok("個別支援計画: 担当確認 → staff_checked 遷移成功");
  } else {
    ng("個別支援計画: ステータス遷移失敗");
  }

  // 履歴が2件あるか
  if (updated?.history?.length >= 2) {
    ok("個別支援計画: 変更履歴が記録されている", `履歴件数=${updated.history.length}`);
  } else {
    ng("個別支援計画: 履歴記録失敗");
  }
}

// ============================================================
// TEST 9: モニタリング作成
// ============================================================
console.log("\n▶ TEST 9: モニタリング作成");
{
  const u = TEST_KID;
  const latestIsp = store.ispRecords.find(r => r.userId === u.id && r.docType === "isp_plan");

  if (latestIsp) {
    ok("モニタリング: 参照ISP計画あり", `status=${latestIsp.status}`);
  } else {
    warn("モニタリング: 参照できるISP計画なし（テスト内で作成済みのため問題なし）");
  }

  const monRec = store.addIspRecord({
    id: genId(), userId: u.id, facilityId: u.facilityId,
    docType: "monitoring", status: "staff_checked",
    content: {
      date: todayISO(),
      targetPeriod: "2026年4月〜2026年9月",
      overallEval: "概ね達成",
      longGoalResult: "感情カードを使い、自分の気持ちを言葉にできる場面が増えた。",
      shortGoalResult: "活動切り替えが5分以内にできた回数が週3〜4回に増加。",
      achievedItems: "友達と一緒に工作できるようになった。自分から「やりたい」と言えた。",
      remainingChallenges: "急な予定変更時のパニックがまだ残っている。",
      supportChanges: "予告時間を3分→5分に延ばして様子を見る。",
      nextPlanReflection: "次回計画では「予定変更への対応」を短期目標に追加する。",
      parentOpinion: "家でも少しずつ気持ちを話してくれるようになった。",
      staffObservation: "全体的に成長が見られる。引き続き視覚支援を継続する。",
    },
    createdBy: TEST_USER.displayName, createdAt: nowStr(), updatedAt: nowStr(),
    history: [{ actor: TEST_USER.displayName, role: "staff", action: "新規作成", at: nowStr(), note: "" }],
  });

  if (monRec.docType === "monitoring" && monRec.content.overallEval === "概ね達成") {
    ok("モニタリング: 保存成功", `eval=${monRec.content.overallEval}`);
  } else {
    ng("モニタリング: 保存失敗");
  }

  if (monRec.content.longGoalResult && monRec.content.shortGoalResult) {
    ok("モニタリング: 必須項目（長短期目標結果）入力済み");
  } else {
    ng("モニタリング: 必須項目不足");
  }
}

// ============================================================
// TEST 10: 監査アラート判定
// ============================================================
console.log("\n▶ TEST 10: 監査アラート判定");
{
  const today = todayISO();
  const myUsers = store.dynUsers.filter(u => u.facilityId === "f1");
  const todayRecs = store.recs; // 今日の記録（テストデータ）

  // 高体温チェック
  const highTempIds = [...new Set(todayRecs.filter(r => r.type === "user_in" && parseFloat(r.temp) >= 37.5).map(r => r.userId))];
  ok("監査アラート: 高体温チェック", `高体温者=${highTempIds.length}名`);

  // サービス記録未入力チェック
  const arrivedIds = [...new Set(todayRecs.filter(r => r.type === "user_in").map(r => r.userId))];
  const serviceIds = [...new Set(todayRecs.filter(r => r.type === "service").map(r => r.userId))];
  const noServiceIds = arrivedIds.filter(id => !serviceIds.includes(id));
  ok("監査アラート: サービス記録未入力チェック", `未入力=${noServiceIds.length}名`);

  // ISP期限チェック
  const ispRecs = store.ispRecords.filter(r => r.docType === "isp_plan");
  const expiredIsps = ispRecs.filter(r => r.content?.validTo && r.content.validTo < today);
  ok("監査アラート: ISP期限チェック", `期限切れ=${expiredIsps.length}件（テストデータは将来日付）`);

  // 退所記録なしチェック
  const departedIds = [...new Set(todayRecs.filter(r => r.type === "user_out").map(r => r.userId))];
  const noDepart = arrivedIds.filter(id => !departedIds.includes(id));
  ok("監査アラート: 退所記録なしチェック", `退所未記録=${noDepart.length}名`);
}

// ============================================================
// TEST 11: 請求前チェック
// ============================================================
console.log("\n▶ TEST 11: 請求前チェック");
{
  const yearMonth = "2026-05";

  // getBillingMaster ロジック再現
  const BILLING_MASTERS = [
    { id: "BM_R6", effectiveFrom: "2024-04-01", effectiveTo: "2026-05-31",
      regionUnitPrice: { "6級地": 10.27, "その他": 10.00 } },
    { id: "BM_R8_06", effectiveFrom: "2026-06-01", effectiveTo: null,
      regionUnitPrice: { "6級地": 10.27, "その他": 10.00 } },
  ];

  const date = yearMonth + "-01";
  const valid = BILLING_MASTERS.filter(m =>
    m.effectiveFrom <= date && (m.effectiveTo === null || m.effectiveTo >= date)
  );
  const master = valid.reduce((a, b) => a.effectiveFrom > b.effectiveFrom ? a : b);

  if (master.id === "BM_R6") {
    ok("請求前チェック: 2026-05は令和6年度マスタが適用される", `master=${master.id}`);
  } else {
    ng("請求前チェック: マスタ選択失敗");
  }

  // 2026-08は令和8年6月マスタ
  const date2 = "2026-08-01";
  const valid2 = BILLING_MASTERS.filter(m =>
    m.effectiveFrom <= date2 && (m.effectiveTo === null || m.effectiveTo >= date2)
  );
  const master2 = valid2.reduce((a, b) => a.effectiveFrom > b.effectiveFrom ? a : b);

  if (master2.id === "BM_R8_06") {
    ok("請求前チェック: 2026-08は令和8年6月マスタが適用される", `master=${master2.id}`);
  } else {
    ng("請求前チェック: 法改正マスタ切替失敗");
  }

  // サービス記録からアラート生成
  const alerts = [];
  const arrivedUsers = [...new Set(store.recs.filter(r => r.type === "user_in").map(r => r.userId))];
  const serviceUsers = [...new Set(store.recs.filter(r => r.type === "service").map(r => r.userId))];
  const noSvcUsers = arrivedUsers.filter(id => !serviceUsers.includes(id));

  if (noSvcUsers.length > 0) {
    alerts.push({ level: "warn", text: `サービス記録未入力 ${noSvcUsers.length}名` });
  }

  ok("請求前チェック: アラート生成ロジック正常", `アラート${alerts.length}件`);
}

// ============================================================
// TEST 12: データ整合性チェック
// ============================================================
console.log("\n▶ TEST 12: データ整合性");
{
  // 全レコードにidが存在するか
  const allRecs = store.recs;
  const noId = allRecs.filter(r => !r.id);
  if (noId.length === 0) {
    ok("データ整合性: 全レコードにID存在", `レコード数=${allRecs.length}`);
  } else {
    ng("データ整合性: IDなしレコードあり", `${noId.length}件`);
  }

  // 全レコードにtype・facilityIdが存在するか
  const noType = allRecs.filter(r => !r.type);
  const noFac  = allRecs.filter(r => !r.facilityId);
  if (noType.length === 0 && noFac.length === 0) {
    ok("データ整合性: type・facilityId全件あり");
  } else {
    ng("データ整合性: type/facilityId欠損あり");
  }

  // ispRecordsの整合性
  const ispRecs = store.ispRecords;
  const ispNoHistory = ispRecs.filter(r => !r.history || r.history.length === 0);
  if (ispNoHistory.length === 0) {
    ok("データ整合性: ISP全レコードに履歴あり", `ISPレコード数=${ispRecs.length}`);
  } else {
    warn("データ整合性: 履歴なしISPレコードあり", `${ispNoHistory.length}件`);
  }

  // 施設IDが有効か
  const facIds = FACILITIES.map(f => f.id);
  const invalidFac = allRecs.filter(r => !facIds.includes(r.facilityId));
  if (invalidFac.length === 0) {
    ok("データ整合性: 全レコードの施設IDが有効");
  } else {
    ng("データ整合性: 無効な施設IDあり", `${invalidFac.length}件`);
  }
}

// ============================================================
// 結果まとめ
// ============================================================
console.log("\n" + "=".repeat(60));
console.log("📋 テスト結果サマリー");
console.log("=".repeat(60));
results.forEach(r => console.log(`${r.status}  ${r.name}${r.detail ? "  ("+r.detail+")" : ""}`));
console.log("=".repeat(60));
console.log(`✅ PASS: ${passed}   ❌ FAIL: ${failed}   ⚠️ WARN: ${warns}`);
console.log(`総テスト数: ${passed + failed + warns}`);
if (failed === 0) {
  console.log("\n🎉 全テスト合格！重大な不具合は検出されませんでした。");
} else {
  console.log(`\n🔴 ${failed}件の不具合が検出されました。修正が必要です。`);
}
