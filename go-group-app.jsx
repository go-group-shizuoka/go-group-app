import React, { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";

// ==================== SUPABASE CLIENT ====================
const SUPABASE_URL = "https://jjouwtsjykxnmvuaqhbc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impqb3V3dHNqeWt4bm12dWFxaGJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMTg1OTgsImV4cCI6MjA5MDc5NDU5OH0.pLWwbpsVTtS5-6iyJXjcUhrX_vXutd7dhRKjqHR4Knc";

const sb = {
  from: function(table) {
    const base = SUPABASE_URL + "/rest/v1/" + table;
    const headers = {
      "apikey": SUPABASE_KEY,
      "Authorization": "Bearer " + SUPABASE_KEY,
      "Content-Type": "application/json",
      "Prefer": "return=minimal"
    };
    return {
      select: async function(cols) {
        cols = cols || "*";
        const r = await fetch(base + "?select=" + cols, {headers});
        return r.json();
      },
      insert: async function(data) {
        const r = await fetch(base, {method:"POST", headers, body: JSON.stringify(data)});
        if(!r.ok) { const e = await r.text(); console.error("SB insert error:", e); }
        return r;
      },
      upsert: async function(data) {
        const h = {...headers, "Prefer": "resolution=merge-duplicates,return=minimal"};
        const r = await fetch(base, {method:"POST", headers:h, body: JSON.stringify(data)});
        if(!r.ok) { const e = await r.text(); console.error("SB upsert error:", e); }
        return r;
      },
      delete: async function(id) {
        const r = await fetch(base + "?id=eq." + id, {method:"DELETE", headers});
        return r;
      },
      eq: function(col, val) {
        return {
          select: async function(cols) {
            cols = cols || "*";
            const r = await fetch(base + "?select=" + cols + "&" + col + "=eq." + encodeURIComponent(val), {headers});
            return r.json();
          }
        };
      }
    };
  }
};

// Supabaseへの保存ヘルパー
async function sbSave(table, data) {
  try { await sb.from(table).upsert(data); } catch(e) { console.error("Save error:", e); }
}
async function sbLoad(table) {
  try { return await sb.from(table).select("*"); } catch(e) { console.error("Load error:", e); return []; }
}
async function sbDelete(table, id) {
  try {
    const headers = {"apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY};
    await fetch(SUPABASE_URL + "/rest/v1/" + table + "?id=eq." + encodeURIComponent(id), {method:"DELETE", headers});
  } catch(e) { console.error("SB delete error:", e); }
}


// ==================== MASTER DATA ====================
const FACILITIES = [
  { id: "f1", name: "GO HOME" },
  { id: "f2", name: "GO ROOM" },
  { id: "f3", name: "GO TOWN 1ST" },
  { id: "f4", name: "GO TOWN 2ND" },
];
const INITIAL_STAFF = [];
const INITIAL_USERS = [];
const ACCOUNTS = [
  { id: "a1", username: "homestaff", password: "pass", role: "staff", staffId: "s1", facilityId: "f1", displayName: "田中 美穂（GO HOME）" },
  { id: "a2", username: "roomstaff", password: "pass", role: "staff", staffId: "s4", facilityId: "f2", displayName: "山田 太郎（GO ROOM）" },
  { id: "a3", username: "town1staff", password: "pass", role: "staff", staffId: "s7", facilityId: "f3", displayName: "伊藤 誠（GO TOWN 1ST）" },
  { id: "a4", username: "town2staff", password: "pass", role: "staff", staffId: "s10", facilityId: "f4", displayName: "渡辺 拓也（GO TOWN 2ND）" },
  { id: "a5", username: "homemgr", password: "home", role: "manager", staffId: "s3", facilityId: "f1", displayName: "鈴木 花子（GO HOME）" },
  { id: "a6", username: "roommgr", password: "room", role: "manager", staffId: "s6", facilityId: "f2", displayName: "林 直樹（GO ROOM）" },
  { id: "a7", username: "town1mgr", password: "town1", role: "manager", staffId: "s9", facilityId: "f3", displayName: "小林 恵（GO TOWN 1ST）" },
  { id: "a8", username: "town2mgr", password: "town2", role: "manager", staffId: "s12", facilityId: "f4", displayName: "松本 浩二（GO TOWN 2ND）" },
  { id: "a9", username: "admin", password: "bells", role: "admin", staffId: null, facilityId: null, displayName: "本部管理者" },
];
const ACTIVITY_TYPES = ["個別支援","集団療育","運動療育","言語療育","学習支援","リハビリ","外出支援","イベント","制作活動","その他"];
const SERVICE_ITEMS = ["着替え支援","排泄支援","食事支援","水分補給","服薬確認","健康観察","個別療育","集団活動","運動・体操","学習支援","創作活動","外出・散歩","コミュニケーション支援","その他"];
const MOODS = ["😄","🙂","😐","😔","😢"];
// 個別支援計画 5領域（IspServicePanel・利用者管理両方で使用するため上位に定義）
const ISP_DOMAINS = ["健康・生活","運動・感覚","認知・行動","言語・コミュニケーション","人間関係・社会性"];

// ─── サービス記録テンプレート（現場3秒入力用） ───
const RECORD_TEMPLATES = [
  {cat:"体調",icon:"🌡️",texts:["体調良好、笑顔で来所","体温正常・食欲あり、活動に積極的","やや疲れ気味だったが活動中は集中できた","体調不良の訴えなし、終日元気に過ごした"]},
  {cat:"活動",icon:"🎨",texts:["積極的に活動へ参加できた","友達と協力して取り組めた","指示を理解し行動できた","最後まで粘り強く取り組んだ","苦手な場面も職員の声かけで参加できた"]},
  {cat:"コミュニ",icon:"💬",texts:["自分の気持ちを言葉で伝えられた","友達・職員に自ら声をかけた","「ありがとう」「ごめんなさい」が言えた","順番を守って活動できた","相手の話を最後まで聞くことができた"]},
  {cat:"支援",icon:"🤝",texts:["視覚スケジュールで見通しを持てた","切り替えが上手くできた","落ち着きスペースで自己調整できた","好きな活動を通じて達成感を得られた","保護者へ連絡帳で支援内容を共有"]},
  {cat:"監査向け",icon:"📎",texts:["個別支援計画に基づき支援を実施した","本日の支援目標に沿った活動を行った","安全確認を実施し特記事項なし","支援記録は個別支援計画と整合しています","担当職員が個別に対応し適切に支援した"]},
];

// ISP情報＋チェック項目から支援記録文を自動生成（AIテンプレートベース）
function generateAutoNote(checkedItems, ispGoal, mood, domains){
  const parts=[];
  if(ispGoal) parts.push(`個別支援計画の短期目標「${ispGoal.length>25?ispGoal.slice(0,25)+"…":ispGoal}」に沿って支援を実施した。`);
  if(checkedItems.length>0) parts.push(checkedItems.slice(0,3).join("、")+"を実施した。");
  const moodMap={"😄":"終始笑顔で意欲的に過ごした","🙂":"概ね落ち着いて参加できた","😐":"普通の様子で活動に参加した","😔":"やや意欲が低下していたが職員のフォローで参加できた","😢":"不安な様子がみられたが支援により落ち着くことができた"};
  if(mood&&moodMap[mood]) parts.push(moodMap[mood]+"。");
  if(domains?.length>0) parts.push(`【${domains.join("・")}】の領域に関連した支援を実施した。`);
  return parts.join(" ");
}
const SHIFT_TYPES = [
  { key: "A", label: "早番", time: "8:00〜17:00", color: "rgba(0,180,216,0.22)", text: "#48cae4" },
  { key: "B", label: "遅番", time: "11:00〜20:00", color: "rgba(82,183,136,0.22)", text: "#52b788" },
  { key: "C", label: "通常", time: "9:00〜18:00", color: "rgba(244,162,97,0.22)", text: "#f4a261" },
  { key: "off", label: "公休", time: "休み", color: "rgba(255,255,255,0.05)", text: "#64748b" },
  { key: "holiday", label: "有休", time: "有給", color: "rgba(199,125,255,0.18)", text: "#c77dff" },
  { key: "P1", label: "パート①", time: "13:00〜18:00", color: "rgba(255,182,193,0.3)", text: "#e75480" },
  { key: "P2", label: "パート②", time: "14:00〜18:00", color: "rgba(255,160,122,0.3)", text: "#e8734a" },
  { key: "P3", label: "午前パート", time: "9:00〜13:00", color: "rgba(173,216,230,0.3)", text: "#4682b4" },
];
// ==================== 静岡県 放課後等デイサービス 単価マスター ====================
// 令和6年度報酬改定 ＋ 静岡県地域区分
// 地域区分: 静岡市・浜松市=6級地(10.72円) / 沼津市・富士市・磐田市等=その他(10.40円)
const SHIZUOKA_TANKA = {
  "静岡市":  10.72, "浜松市": 10.72,
  "沼津市":  10.40, "富士市": 10.40, "磐田市": 10.40,
  "焼津市":  10.40, "掛川市": 10.40, "藤枝市": 10.40,
  "島田市":  10.40, "袋井市": 10.40, "湖西市": 10.40,
  "御殿場市":10.40, "裾野市": 10.40, "伊豆市": 10.40,
  "その他":  10.40,
};

// 放課後等デイサービス 基本報酬（単位数）
// 区分1・区分2 × 放課後/休日/重症
const SERVICE_TYPE_MASTER = [
  // ── 区分1（指導員加配あり等・上位区分）──
  { code:"6610B", label:"放課後デイ1・放課後",       unit:576,  kubun:1, timeType:"放課後", note:"指導員加配・重症以外" },
  { code:"6610C", label:"放課後デイ1・休日",          unit:664,  kubun:1, timeType:"休日",   note:"指導員加配・重症以外" },
  { code:"6610D", label:"放課後デイ1・放課後（重症）",unit:1004, kubun:1, timeType:"放課後", note:"重症心身障害児" },
  { code:"6610E", label:"放課後デイ1・休日（重症）",  unit:1159, kubun:1, timeType:"休日",   note:"重症心身障害児" },
  // ── 区分2（標準）──
  { code:"6612B", label:"放課後デイ2・放課後",        unit:530,  kubun:2, timeType:"放課後", note:"標準・重症以外" },
  { code:"6612C", label:"放課後デイ2・休日",          unit:611,  kubun:2, timeType:"休日",   note:"標準・重症以外" },
  { code:"6612D", label:"放課後デイ2・放課後（重症）",unit:955,  kubun:2, timeType:"放課後", note:"重症心身障害児" },
  { code:"6612E", label:"放課後デイ2・休日（重症）",  unit:1101, kubun:2, timeType:"休日",   note:"重症心身障害児" },
];

// 加算マスター（令和6年度改定・静岡県準拠）
const ADDON_MASTER = [
  // ── 送迎（往路・復路を分けて管理）──
  { key:"tr_to",     label:"送迎加算（往路・来所）",     unit:54,  category:"送迎", perDay:true,  dir:"往路", note:"自宅→施設" },
  { key:"tr_from",   label:"送迎加算（復路・帰宅）",     unit:54,  category:"送迎", perDay:true,  dir:"復路", note:"施設→自宅" },
  { key:"tr_both",   label:"送迎加算（往復）",           unit:108, category:"送迎", perDay:true,  dir:"往復", note:"往路＋復路（同日）" },
  { key:"tr_sp",     label:"送迎加算（重症・同乗）",     unit:108, category:"送迎", perDay:true,  dir:"—",   note:"重症心身障害児の送迎" },
  // ── 延長支援 ──
  { key:"ext_1h",  label:"延長支援加算（1時間以内）",    unit:61,  category:"延長", perDay:true  },
  { key:"ext_2h",  label:"延長支援加算（1〜2時間）",     unit:92,  category:"延長", perDay:true  },
  { key:"ext_3h",  label:"延長支援加算（2時間超）",      unit:123, category:"延長", perDay:true  },
  // ── 専門的支援・有資格者 ──
  { key:"spec",      label:"専門的支援加算",             unit:204, category:"専門", perDay:true  },
  { key:"qual_st",   label:"福祉専門職員等連携加算",     unit:80,  category:"専門", perDay:false },
  { key:"qual_it",   label:"関係機関連携加算（Ⅰ）",     unit:100, category:"専門", perDay:false },
  { key:"qual_it2",  label:"関係機関連携加算（Ⅱ）",     unit:300, category:"専門", perDay:false },
  // ── 人員配置・体制 ──
  { key:"staff_add",  label:"人員配置体制加算（Ⅰ）",    unit:155, category:"体制", perDay:true  },
  { key:"staff_add2", label:"人員配置体制加算（Ⅱ）",    unit:92,  category:"体制", perDay:true  },
  { key:"child_sp",   label:"児童指導員等配置加算（Ⅰ）",unit:187, category:"体制", perDay:true  },
  { key:"child_sp2",  label:"児童指導員等配置加算（Ⅱ）",unit:125, category:"体制", perDay:true  },
  { key:"child_sp3",  label:"児童指導員等配置加算（Ⅲ）",unit:63,  category:"体制", perDay:true  },
  // ── 個別サポート ──
  { key:"indiv",   label:"個別サポート加算（Ⅰ）",       unit:100, category:"個別", perDay:true  },
  { key:"indiv2",  label:"個別サポート加算（Ⅱ）",       unit:100, category:"個別", perDay:true  },
  // ── 欠席対応 ──
  { key:"abs1",    label:"欠席時対応加算（Ⅰ）",         unit:94,  category:"欠席", perDay:true  },
  { key:"abs2",    label:"欠席時対応加算（Ⅱ）",         unit:47,  category:"欠席", perDay:true  },
  // ── 処遇改善 ──
  { key:"shokaizenI",  label:"福祉職員処遇改善加算（Ⅰ）",  unit:0, category:"処遇", perDay:false, rate:0.133 },
  { key:"shokaizenII", label:"福祉職員処遇改善加算（Ⅱ）",  unit:0, category:"処遇", perDay:false, rate:0.101 },
  { key:"shokaizenIII",label:"福祉職員処遇改善加算（Ⅲ）",  unit:0, category:"処遇", perDay:false, rate:0.034 },
  // ── その他 ──
  { key:"medical",   label:"医療連携体制加算（Ⅰ）",     unit:500, category:"医療", perDay:false },
  { key:"medical2",  label:"医療連携体制加算（Ⅱ）",     unit:250, category:"医療", perDay:true  },
  { key:"after_sch", label:"学校連携加算",               unit:90,  category:"連携", perDay:false },
];
const ADDON_CATEGORIES = ["送迎","延長","専門","体制","個別","欠席","処遇","医療","連携"];

// =====================================================================
// 報酬マスタ（年度・法改正ごとに配列で管理）
// effectiveFrom <= 対象年月 <= effectiveTo（null=現在有効）
// 法改正時は新エントリを追加するだけでOK。コード変更不要。
// =====================================================================
const BILLING_MASTERS = [
  // ─────────────────────────────────────────
  // 令和6年度 (2024-04-01 〜 2026-05-31)
  // ─────────────────────────────────────────
  {
    id: "BM_R6",
    name: "令和6年度 報酬基準",
    effectiveFrom: "2024-04-01",
    effectiveTo:   "2026-05-31",
    // 地域区分別 1単位単価（円）
    regionUnitPrice: {
      "1級地": 11.40, "2級地": 11.12, "3級地": 10.84,
      "4級地": 10.70, "5級地": 10.55, "6級地": 10.27, "その他": 10.00,
    },
    // 静岡県市区町村 → 地域区分 マッピング
    cityRegionMap: {
      "静岡市": "6級地", "浜松市": "6級地",
      "沼津市": "その他", "富士市": "その他", "磐田市": "その他",
      "焼津市": "その他", "掛川市": "その他", "藤枝市": "その他",
      "その他": "その他",
    },
    // 基本報酬マスタ（サービスコード → 単位数）
    basicRewards: [
      { code:"6610B", label:"放課後デイ区分1・放課後",        units: 576, dayType:"放課後", kubun:1, note:"指導員加配等" },
      { code:"6610C", label:"放課後デイ区分1・休日",          units: 664, dayType:"休日",   kubun:1 },
      { code:"6610D", label:"放課後デイ区分1・放課後（重症）",units:1004, dayType:"放課後", kubun:1, note:"重症心身障害児" },
      { code:"6610E", label:"放課後デイ区分1・休日（重症）",  units:1159, dayType:"休日",   kubun:1, note:"重症心身障害児" },
      { code:"6612B", label:"放課後デイ区分2・放課後",        units: 530, dayType:"放課後", kubun:2, note:"標準" },
      { code:"6612C", label:"放課後デイ区分2・休日",          units: 611, dayType:"休日",   kubun:2 },
      { code:"6612D", label:"放課後デイ区分2・放課後（重症）",units: 955, dayType:"放課後", kubun:2, note:"重症心身障害児" },
      { code:"6612E", label:"放課後デイ区分2・休日（重症）",  units:1101, dayType:"休日",   kubun:2, note:"重症心身障害児" },
    ],
    // 加算マスタ
    // autoCheck: null=手動 / "transport"=送迎記録 / "absence"=欠席記録 / "staff_qual"=資格 / "staff_ratio"=配置比
    additions: [
      { key:"tr_to",     label:"送迎加算（往路）",           units: 54,  perDay:true,  category:"送迎", autoCheck:"transport",   maxPerMonth:null, note:"来所時送迎記録がある日" },
      { key:"tr_from",   label:"送迎加算（復路）",           units: 54,  perDay:true,  category:"送迎", autoCheck:"transport",   maxPerMonth:null, note:"退所時送迎記録がある日" },
      { key:"ext_1h",    label:"延長支援加算（1時間以内）",  units: 61,  perDay:true,  category:"延長", autoCheck:null,           note:"所定時間を超えた支援" },
      { key:"ext_2h",    label:"延長支援加算（1〜2時間）",   units: 92,  perDay:true,  category:"延長", autoCheck:null },
      { key:"ext_3h",    label:"延長支援加算（2時間超）",    units:123,  perDay:true,  category:"延長", autoCheck:null },
      { key:"spec",      label:"専門的支援加算",             units:204,  perDay:true,  category:"専門", autoCheck:"staff_qual",   note:"理学療法士・作業療法士・言語聴覚士等が配置" },
      { key:"staff_add", label:"人員配置体制加算（Ⅰ）",     units:155,  perDay:true,  category:"体制", autoCheck:"staff_ratio",  note:"利用者5人に職員2人以上（常勤換算）" },
      { key:"staff_add2",label:"人員配置体制加算（Ⅱ）",     units: 92,  perDay:true,  category:"体制", autoCheck:"staff_ratio2", note:"利用者5人に職員1.5人以上" },
      { key:"child_sp",  label:"児童指導員等加配加算（Ⅰ）", units:187,  perDay:true,  category:"体制", autoCheck:"child_staff",  note:"児童指導員等有資格者が加配" },
      { key:"child_sp2", label:"児童指導員等加配加算（Ⅱ）", units:125,  perDay:true,  category:"体制", autoCheck:"child_staff2" },
      { key:"child_sp3", label:"児童指導員等加配加算（Ⅲ）", units: 63,  perDay:true,  category:"体制", autoCheck:"child_staff3" },
      { key:"indiv",     label:"個別サポート加算（Ⅰ）",     units:100,  perDay:true,  category:"個別", autoCheck:null,           note:"ケアニーズが高い利用者（医療的ケア等）" },
      { key:"abs1",      label:"欠席時対応加算（Ⅰ）",       units: 94,  perDay:true,  category:"欠席", autoCheck:"absence",      maxPerMonth:4, note:"月4回まで。欠席当日に家庭連絡" },
      { key:"abs2",      label:"欠席時対応加算（Ⅱ）",       units: 47,  perDay:true,  category:"欠席", autoCheck:"absence",      maxPerMonth:4 },
      { key:"katei",     label:"家庭連携加算",               units:187,  perDay:false, category:"連携", autoCheck:null,           maxPerMonth:1, note:"月1回・居宅訪問または保護者来所" },
      { key:"kanren1",   label:"関係機関連携加算（Ⅰ）",     units:100,  perDay:false, category:"連携", autoCheck:null,           note:"保育所・学校等との会議参加" },
      { key:"kanren2",   label:"関係機関連携加算（Ⅱ）",     units:300,  perDay:false, category:"連携", autoCheck:null },
      { key:"qual_st",   label:"福祉専門職員配置等加算（Ⅰ）",units:15,  perDay:true,  category:"体制", autoCheck:"welfare_qual",  note:"社会福祉士等35%以上" },
      { key:"qual_st2",  label:"福祉専門職員配置等加算（Ⅱ）",units:10,  perDay:true,  category:"体制", autoCheck:"welfare_qual2" },
      { key:"shoguu1",   label:"福祉職員処遇改善加算（Ⅰ）", units:0,   perDay:false, category:"処遇", autoCheck:null, rate:0.133, note:"計画書・実績報告が必要" },
      { key:"shoguu2",   label:"福祉職員処遇改善加算（Ⅱ）", units:0,   perDay:false, category:"処遇", autoCheck:null, rate:0.101 },
      { key:"shoguu3",   label:"福祉職員処遇改善加算（Ⅲ）", units:0,   perDay:false, category:"処遇", autoCheck:null, rate:0.034 },
      { key:"medical1",  label:"医療連携体制加算（Ⅰ）",     units:500,  perDay:false, category:"医療", autoCheck:"nurse_staff",  note:"看護職員を配置" },
      { key:"medical2",  label:"医療連携体制加算（Ⅱ）",     units:250,  perDay:true,  category:"医療", autoCheck:"nurse_staff" },
      { key:"gakko",     label:"学校連携加算",               units: 90,  perDay:false, category:"連携", autoCheck:null,           note:"学校との連絡会・訪問等" },
    ],
  },
  // ─────────────────────────────────────────
  // 令和8年6月改正 (2026-06-01 〜)
  // 新規指定事業所と既存事業所で基本報酬が異なる
  // ※単位数は改正告示確定後に更新すること
  // ─────────────────────────────────────────
  {
    id: "BM_R8_06",
    name: "令和8年6月 報酬改正（2026年6月〜）",
    effectiveFrom: "2026-06-01",
    effectiveTo:   null,
    regionUnitPrice: {
      "1級地": 11.40, "2級地": 11.12, "3級地": 10.84,
      "4級地": 10.70, "5級地": 10.55, "6級地": 10.27, "その他": 10.00,
    },
    cityRegionMap: {
      "静岡市": "6級地", "浜松市": "6級地",
      "沼津市": "その他", "富士市": "その他", "磐田市": "その他",
      "その他": "その他",
    },
    basicRewards: [
      // 既存事業所（令和8年6月以前から指定）
      { code:"6610B_E", label:"放課後デイ区分1・放課後（既存）",        units: 576, dayType:"放課後", kubun:1, condition:"existing" },
      { code:"6610C_E", label:"放課後デイ区分1・休日（既存）",          units: 664, dayType:"休日",   kubun:1, condition:"existing" },
      { code:"6612B_E", label:"放課後デイ区分2・放課後（既存）",        units: 530, dayType:"放課後", kubun:2, condition:"existing" },
      { code:"6612C_E", label:"放課後デイ区分2・休日（既存）",          units: 611, dayType:"休日",   kubun:2, condition:"existing" },
      // 新規指定事業所（令和8年6月以降に指定）※単位数は改正告示確定後に更新
      { code:"6610B_N", label:"放課後デイ区分1・放課後（新規）",        units: 576, dayType:"放課後", kubun:1, condition:"new", note:"※改正後単価に更新してください" },
      { code:"6610C_N", label:"放課後デイ区分1・休日（新規）",          units: 664, dayType:"休日",   kubun:1, condition:"new", note:"※改正後単価に更新してください" },
      { code:"6612B_N", label:"放課後デイ区分2・放課後（新規）",        units: 530, dayType:"放課後", kubun:2, condition:"new" },
      { code:"6612C_N", label:"放課後デイ区分2・休日（新規）",          units: 611, dayType:"休日",   kubun:2, condition:"new" },
    ],
    // 改正後の加算（変更分のみ記載。変更なき場合は同値）
    additions: [
      // 令和6年度と同じ加算を継承（改正時にここを変更）
      { key:"tr_to",    label:"送迎加算（往路）",    units: 54,  perDay:true,  category:"送迎", autoCheck:"transport" },
      { key:"tr_from",  label:"送迎加算（復路）",    units: 54,  perDay:true,  category:"送迎", autoCheck:"transport" },
      { key:"spec",     label:"専門的支援加算",      units:204,  perDay:true,  category:"専門", autoCheck:"staff_qual" },
      { key:"staff_add",label:"人員配置体制加算（Ⅰ）",units:155, perDay:true,  category:"体制", autoCheck:"staff_ratio" },
      { key:"child_sp", label:"児童指導員等加配加算（Ⅰ）",units:187, perDay:true, category:"体制", autoCheck:"child_staff" },
      { key:"abs1",     label:"欠席時対応加算（Ⅰ）",units: 94,  perDay:true,  category:"欠席", autoCheck:"absence", maxPerMonth:4 },
      { key:"katei",    label:"家庭連携加算",        units:187,  perDay:false, category:"連携", autoCheck:null, maxPerMonth:1 },
      { key:"shoguu1",  label:"福祉職員処遇改善加算（Ⅰ）",units:0, perDay:false, category:"処遇", autoCheck:null, rate:0.133 },
      // 令和8年6月新設加算（改正告示後に追加・単位数更新）
      { key:"new_r8_01",label:"【R8.6新設】加算（仮称）",units:0, perDay:true,  category:"体制", autoCheck:null, note:"改正告示確定後に単位数・条件を更新してください" },
    ],
  },
];

// 指定年月に有効な報酬マスタを返す（過去月も正しく計算できる）
function getBillingMaster(yearMonth) {
  const date = (yearMonth||"2024-04") + "-01";
  const valid = BILLING_MASTERS.filter(m =>
    m.effectiveFrom <= date && (m.effectiveTo === null || m.effectiveTo >= date)
  );
  if(valid.length === 0) return BILLING_MASTERS[0];
  return valid.reduce((a,b) => a.effectiveFrom > b.effectiveFrom ? a : b);
}

// 地域区分から1単位単価を返す
function getUnitPrice(yearMonth, cityOrRegion) {
  const m = getBillingMaster(yearMonth);
  const region = m.cityRegionMap?.[cityOrRegion] || cityOrRegion || "その他";
  return m.regionUnitPrice?.[region] ?? 10.00;
}

// 月内の記録から請求前アラートを自動生成
function checkBillingAlerts(facilityId, yearMonth, store, staffCfg) {
  const alerts = [];
  const myUsers = store.dynUsers.filter(u=>u.active!==false&&u.facilityId===facilityId);
  const [y,mo] = yearMonth.split("-").map(Number);
  const inMonth = r => {
    const d = r.time?.slice(0,7)||"";
    return d===yearMonth && (r.facilityId===facilityId||r.facility_id===facilityId);
  };
  const monthRecs = store.recs.filter(inMonth);

  myUsers.forEach(u => {
    const arrivals  = monthRecs.filter(r=>r.type==="user_in" &&r.userId===u.id);
    const departures= monthRecs.filter(r=>r.type==="user_out"&&r.userId===u.id);
    const services  = monthRecs.filter(r=>r.type==="service" &&r.userId===u.id);
    const arrDates  = [...new Set(arrivals.map(r=>r.time?.slice(0,10)))].filter(Boolean);
    const svcDates  = [...new Set(services.map(r=>r.time?.slice(0,10)))].filter(Boolean);

    // ① サービス記録未入力（来所日にサービス記録がない）
    const missingSvc = arrDates.filter(d=>!svcDates.includes(d));
    if(missingSvc.length>0) alerts.push({level:"danger",userId:u.id,userName:u.name,type:"missing_service",
      text:`${u.name} — サービス記録未入力 ${missingSvc.length}日（${missingSvc.join("・")}）`});

    // ② 体温未記録
    const missingTemp = arrivals.filter(r=>!r.temp||r.temp==="");
    if(missingTemp.length>0) alerts.push({level:"warn",userId:u.id,userName:u.name,type:"missing_temp",
      text:`${u.name} — 体温未記録 ${missingTemp.length}件`});

    // ③ 退所記録なし（来所があるが退所記録がない日）
    const depDates = [...new Set(departures.map(r=>r.time?.slice(0,10)))].filter(Boolean);
    const missingDep = arrDates.filter(d=>!depDates.includes(d));
    if(missingDep.length>0) alerts.push({level:"warn",userId:u.id,userName:u.name,type:"missing_depart",
      text:`${u.name} — 退所記録なし ${missingDep.length}日`});

    // ④ ISP（個別支援計画）確認
    const isp = (store.isps||[]).filter(i=>i.userId===u.id).sort((a,b)=>b.endDate>a.endDate?1:-1)[0];
    const monthEnd = yearMonth+"-31";
    if(!isp){
      alerts.push({level:"danger",userId:u.id,userName:u.name,type:"no_isp",
        text:`${u.name} — 個別支援計画が未作成です（算定根拠なし）`});
    } else if(isp.endDate < yearMonth+"-01"){
      alerts.push({level:"danger",userId:u.id,userName:u.name,type:"isp_expired",
        text:`${u.name} — 個別支援計画 期限切れ（${isp.endDate}まで）`});
    } else if(isp.endDate < yearMonth+"-30"){
      alerts.push({level:"warn",userId:u.id,userName:u.name,type:"isp_near",
        text:`${u.name} — 個別支援計画 月内期限切れ（${isp.endDate}）`});
    }

    // ⑤ フェイスシート確認
    const fs = (store.facesheets||[]).find(f=>f.userId===u.id);
    if(!fs) alerts.push({level:"warn",userId:u.id,userName:u.name,type:"no_facesheet",
      text:`${u.name} — フェイスシート未作成`});
  });

  // ⑥ 職員配置チェック（staffCfgがある場合）
  if(staffCfg){
    if(!staffCfg.hasCDSM) alerts.push({level:"danger",type:"no_cdsm",
      text:"児童発達支援管理責任者が未配置 — 算定不可"});
    const users = myUsers.length||1;
    const fte = staffCfg.fullTimeEquivalent||0;
    if(fte/users < 0.2) alerts.push({level:"warn",type:"staff_ratio",
      text:`職員配置 常勤換算 ${fte.toFixed(1)}名 / 利用者 ${users}名（基準：5人に1人以上）`});
  }

  return alerts;
}

// 旧コード互換（国保連提出用）
const KOKUHO_CODES = [
  { code: "66137", label: "放課後等デイサービス1（重症心身障害児以外）", unit: 1094 },
  { code: "66138", label: "放課後等デイサービス2（重症心身障害児以外）", unit: 999 },
  { code: "66107", label: "放課後等デイサービス（重症心身障害児）", unit: 1553 },
];

// 利用者1件分の総単位数を計算（静岡県対応・送迎往路復路分離版）
function calcTotalUnits(k) {
  const base = (k.serviceDays||0) * (k.unitPrice||576);
  const addons = (k.addons||[]).reduce((sum, a) => {
    const m = ADDON_MASTER.find(x=>x.key===a.key);
    if(!m) return sum;
    if(m.rate) return sum + Math.round(base * m.rate);
    if(m.perDay) return sum + (a.days||k.serviceDays||0) * m.unit;
    return sum + (a.count||1) * m.unit;
  }, 0);
  return base + addons;
}
// 静岡県の地域単価を返す
function getShizuokaTanka(city) {
  return SHIZUOKA_TANKA[city] || 10.40;
}

const SUPPORT_GOALS = [
"コミュニケーション能力の向上","生活自立スキルの習得","社会性・対人関係スキルの向上","感情調整能力の向上","運動・身体機能の維持・向上","学習支援・学力向上","余暇活動・趣味の開発","就労準備スキルの向上"];

// ==================== HELPERS ====================
const genId = () => Math.random().toString(36).substr(2,9);
const nowStr = () => new Date().toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"});
const nowHM = () => { const d=new Date(); return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0"); };
const buildDT = t => { const d=new Date(); const [h,m]=t.split(":"); d.setHours(+h,+m,0); return d.toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"}); };
const todayISO = () => { const d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
const todayDisplay = () => new Date().toLocaleDateString("ja-JP",{year:"numeric",month:"2-digit",day:"2-digit"});
// 記録が今日かどうか判定（複数日付フォーマット対応）
const isTodayRec = (r) => {
  if(!r||!r.time) return false;
  const d = todayISO();
  const [y,mo,dy] = d.split("-");
  const padded = d.replace(/-/g,"/");
  const short = y+"/"+Number(mo)+"/"+Number(dy);
  return r.time.includes(padded)||r.time.includes(short)||r.time.startsWith(d);
};
// 今日のアラートを生成する共通ヘルパー（danger=赤/warn=橙/info=青）
const buildTodayAlerts = (user, store) => {
  const myFac = r => user.role==="admin" || (r.facilityId||r.facility_id)===user.selectedFacilityId;
  const todayRecs = store.recs.filter(r => isTodayRec(r) && myFac(r));
  const arrivedIds  = [...new Set(todayRecs.filter(r=>r.type==="user_in").map(r=>r.userId))];
  const departedIds = [...new Set(todayRecs.filter(r=>r.type==="user_out").map(r=>r.userId))];
  const serviceIds  = [...new Set(todayRecs.filter(r=>r.type==="service").map(r=>r.userId))];
  // サービス記録未入力（来所済み）
  const noService = arrivedIds.filter(id=>!serviceIds.includes(id));
  // 体温未入力（来所記録で体温なし）
  const noTempIds = [...new Set(todayRecs.filter(r=>r.type==="user_in"&&(!r.temp||r.temp==="")).map(r=>r.userId))];
  // 送迎未完了（送迎あり・来所済み・退所記録なし）
  const transportIncomplete = arrivedIds.filter(id=>{
    const rec = todayRecs.filter(r=>r.type==="user_in"&&r.userId===id).slice(-1)[0];
    return rec?.transport==="あり" && !departedIds.includes(id);
  });
  const unread = store.msgs.filter(m=>myFac(m)&&!m.read);
  const now = new Date();
  // ISP期限切れ（赤）と期限間近30日（橙）を区別
  const allIsps = store.isps||[];
  const ispExpired = allIsps.filter(isp=>{
    if(!isp.endDate) return false;
    return Math.ceil((new Date(isp.endDate)-now)/(1000*60*60*24)) < 0;
  });
  const ispSoon = allIsps.filter(isp=>{
    if(!isp.endDate) return false;
    const d = Math.ceil((new Date(isp.endDate)-now)/(1000*60*60*24));
    return d>=0 && d<=30;
  });
  const alerts = [];
  // danger（赤）— 今すぐ対応
  if(ispExpired.length>0) alerts.push({level:"danger",icon:"🚨",text:`ISP 期限切れ ${ispExpired.length}件`,screen:"users",ids:ispExpired.map(i=>i.userName||i.userId)});
  // warn（橙）— 本日中に対応
  if(noService.length>0) alerts.push({level:"warn",icon:"📋",text:`サービス記録 未入力 ${noService.length}名`,screen:"service",ids:noService});
  if(noTempIds.length>0) alerts.push({level:"warn",icon:"🌡️",text:`体温 未入力 ${noTempIds.length}名`,screen:"user_arrive",ids:noTempIds});
  if(ispSoon.length>0)   alerts.push({level:"warn",icon:"📄",text:`ISP 期限間近 ${ispSoon.length}件（30日以内）`,screen:"users"});
  // info（青）— 確認事項
  if(transportIncomplete.length>0) alerts.push({level:"info",icon:"🚌",text:`送迎 未完了 ${transportIncomplete.length}名`,screen:"transport",ids:transportIncomplete});
  if(unread.length>0) alerts.push({level:"info",icon:"💬",text:`保護者連絡 未読 ${unread.length}件`,screen:"messages"});
  return alerts;
};
const daysInMonth = (y,m) => new Date(y,m,0).getDate();
const dlabel = s => { const d=new Date(s+"T00:00:00"); return (d.getMonth()+1)+"/"+(d.getDate())+"（"+"日月火水木金土"[d.getDay()]+"）"; };
const fmtYen = n => "¥" + Number(n).toLocaleString();
const calcAge = dob => { const today=new Date(); const b=new Date(dob); let age=today.getFullYear()-b.getFullYear(); if(today.getMonth()<b.getMonth()||(today.getMonth()===b.getMonth()&&today.getDate()<b.getDate())) age--; return age; };

// ==================== 印刷ユーティリティ ====================
function printHTML(htmlContent, title="GO GROUP") {
  const win = window.open("","_blank","width=900,height=700");
  win.document.write(`<!DOCTYPE html><html lang="ja"><head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  @page { size: A4 portrait; margin: 15mm 12mm; }
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Noto Sans JP','Hiragino Kaku Gothic Pro',Meiryo,sans-serif;font-size:10pt;color:#111;background:#fff;line-height:1.5;}
  .print-wrap{max-width:100%;}
  .print-header{background:linear-gradient(135deg,#1a3a6a,#d95a18);color:#fff;padding:12px 16px;border-radius:6px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:flex-end;}
  .print-header .facility{font-size:9pt;opacity:.8;}
  .print-header .title{font-size:16pt;font-weight:900;}
  .print-header .name{font-size:13pt;font-weight:700;}
  .print-header .meta{font-size:9pt;opacity:.8;text-align:right;}
  .section{border:1px solid #c8ccd8;border-radius:6px;margin-bottom:10px;overflow:hidden;page-break-inside:avoid;}
  .section-head{padding:7px 12px;font-size:9pt;font-weight:700;letter-spacing:1px;}
  .section-head.blue{background:#e8f4fc;color:#005a8a;border-bottom:2px solid #0080b8;}
  .section-head.green{background:#e8f5ec;color:#155a30;border-bottom:2px solid #1e9050;}
  .section-head.red{background:#fdf0ee;color:#8a2010;border-bottom:2px solid #c83028;}
  .section-head.purple{background:#f3eaf8;color:#4a1880;border-bottom:2px solid #7030b8;}
  .section-head.orange{background:#fef3e8;color:#8a4a00;border-bottom:2px solid #d08010;}
  .section-head.gray{background:#f0f2f5;color:#333;border-bottom:2px solid #888;}
  .section-body{padding:10px 12px;}
  .field-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:6px 16px;}
  .field{margin-bottom:6px;}
  .field-label{font-size:8pt;color:#555;font-weight:700;letter-spacing:.5px;margin-bottom:2px;}
  .field-value{font-size:10pt;color:#111;border-bottom:1px solid #ddd;padding-bottom:3px;min-height:18px;word-break:break-all;}
  .field-value.multi{border-bottom:none;background:#f8f9fa;padding:5px 7px;border-radius:4px;min-height:36px;}
  .score-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;}
  .score-box{border-radius:5px;padding:7px 9px;text-align:center;}
  .score-label{font-size:8pt;font-weight:700;margin-bottom:3px;}
  .score-val{font-size:16pt;font-weight:900;}
  .score-bar-wrap{height:5px;background:#e0e0e0;border-radius:3px;margin-top:4px;overflow:hidden;}
  .score-bar{height:100%;border-radius:3px;}
  .item-row{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #eee;}
  .item-row:last-child{border-bottom:none;}
  .item-label{font-size:9.5pt;flex:1;}
  .item-score{font-size:9pt;font-weight:700;padding:2px 8px;border-radius:8px;white-space:nowrap;margin-left:8px;}
  .goal-box{background:#eef6fc;border-left:3px solid #0080b8;padding:8px 10px;border-radius:0 4px 4px 0;font-size:10pt;line-height:1.6;margin-bottom:6px;}
  .tag{display:inline-block;padding:2px 8px;border-radius:8px;font-size:8pt;font-weight:700;margin:2px 3px 2px 0;}
  .tag.blue{background:#cce6f5;color:#005080;}
  .progress-wrap{height:8px;background:#e0e0e0;border-radius:4px;overflow:hidden;margin:6px 0;}
  .progress-fill{height:100%;background:linear-gradient(90deg,#0080b8,#1e9050);border-radius:4px;}
  .monitor-item{border:1px solid #ddd;border-radius:5px;padding:7px 10px;margin-bottom:6px;}
  .monitor-label{font-size:9pt;font-weight:700;margin-bottom:4px;}
  .monitor-result{display:inline-block;padding:2px 9px;border-radius:8px;font-size:9pt;font-weight:700;margin-right:6px;}
  .comment-box{background:#f8f9fa;padding:6px 9px;border-radius:4px;font-size:9.5pt;line-height:1.6;margin-top:4px;}
  .signature-row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:14px;}
  .sig-box{border:1px solid #bbb;border-radius:5px;padding:8px 10px;text-align:center;}
  .sig-label{font-size:8pt;color:#555;margin-bottom:20px;}
  .sig-line{border-top:1px solid #999;margin-top:4px;font-size:8pt;color:#777;padding-top:3px;}
  .no-print{display:none!important;}
  .page-break{page-break-before:always;}
</style>
</head><body>${htmlContent}</body></html>`);
  win.document.close();
  setTimeout(()=>win.print(),400);
}

// フェイスシート印刷
function printFacesheet(u, fs, facilityName) {
  const age = calcAge(u.dob);
  const F = (label,val,multi=false) => `<div class="field">
    <div class="field-label">${label}</div>
    <div class="field-value${multi?" multi":""}">${val||"&nbsp;"}</div>
  </div>`;
  const html = `<div class="print-wrap">
    <div class="print-header">
      <div><div class="facility">${facilityName}</div><div class="title">フェイスシート</div></div>
      <div class="meta"><div class="name">${u.name}（${age}歳）</div><div>${u.diagnosis}</div><div>作成日: ${fs?.updatedAt||todayISO()}</div></div>
    </div>
    <div class="section">
      <div class="section-head blue">■ 基本情報</div>
      <div class="section-body"><div class="field-grid">
        ${F("氏名",u.name)} ${F("生年月日",u.dob+" ("+age+"歳)")}
        ${F("障害種別・等級",fs?.disabilityGrade)} ${F("診断名",u.diagnosis)}
      </div>${F("障害の特記事項",fs?.disabilityNote,true)}</div>
    </div>
    <div class="section">
      <div class="section-head orange">■ 保護者情報</div>
      <div class="section-body"><div class="field-grid">
        ${F("保護者氏名",fs?.parentName)} ${F("続柄",fs?.parentRelation)}
        ${F("連絡先（携帯）",fs?.parentTel)} ${F("緊急連絡先",fs?.emergencyTel)}
        ${F("緊急連絡先氏名",fs?.emergencyName)} ${F("緊急連絡先続柄",fs?.emergencyRelation)}
      </div>${F("住所",fs?.address)}</div>
    </div>
    <div class="section">
      <div class="section-head green">■ 学校情報</div>
      <div class="section-body"><div class="field-grid">
        ${F("学校名",fs?.school)} ${F("学年",fs?.schoolYear)} ${F("担任・支援員",fs?.schoolContact)}
      </div></div>
    </div>
    <div class="section">
      <div class="section-head red">■ 医療情報</div>
      <div class="section-body"><div class="field-grid">
        ${F("医療機関名",fs?.medicalInstitution)} ${F("主治医",fs?.doctor)}
      </div>${F("服薬状況",fs?.medications,true)}${F("アレルギー・禁忌事項",fs?.allergies,true)}</div>
    </div>
    <div class="section">
      <div class="section-head purple">■ 特性・支援情報</div>
      <div class="section-body">
        ${F("得意なこと・強み",fs?.strengths,true)}
        ${F("苦手なこと・課題",fs?.challenges,true)}
        ${F("パニックのきっかけ",fs?.triggers,true)}
        ${F("落ち着くための方法",fs?.calming,true)}
        ${F("支援上の特記事項",fs?.notes,true)}
      </div>
    </div>
    <div class="signature-row">
      <div class="sig-box"><div class="sig-label">作成者</div><div class="sig-line">印</div></div>
      <div class="sig-box"><div class="sig-label">管理者確認</div><div class="sig-line">印</div></div>
      <div class="sig-box"><div class="sig-label">保護者確認</div><div class="sig-line">印</div></div>
    </div>
  </div>`;
  printHTML(html, `フェイスシート_${u.name}`);
}

// アセスメント印刷
function printAssessment(u, a, facilityName) {
  const ScoreColor=s=>s>=4?"#186838":s>=3?"#005a8a":s>=2?"#a06010":"#a02818";
  const ScoreBg=s=>s>=4?"#d0eedd":s>=3?"#cce6f5":s>=2?"#fce8c8":"#fad4d0";
  const areas = ASSESSMENT_AREAS.map(ar=>{
    const s=a.scores[ar.key]||{};const vals=Object.values(s).filter(Boolean);
    const avg=vals.length?Math.round(vals.reduce((x,y)=>x+y,0)/vals.length*10)/10:null;
    return {...ar,avg};
  });
  const totalAvg=(()=>{const v=areas.map(ar=>ar.avg).filter(Boolean);return v.length?Math.round(v.reduce((x,y)=>x+y,0)/v.length*10)/10:null;})();
  const html = `<div class="print-wrap">
    <div class="print-header">
      <div><div class="facility">${facilityName}</div><div class="title">アセスメント表</div></div>
      <div class="meta"><div class="name">${u.name}（${calcAge(u.dob)}歳）</div><div>評価日: ${a.date}</div><div>評価者: ${a.assessor}</div></div>
    </div>
    <div class="section">
      <div class="section-head blue">■ 領域別スコアサマリー</div>
      <div class="section-body">
        <div class="score-grid">
          ${areas.map(ar=>`<div class="score-box" style="background:${ar.avg?ScoreBg(ar.avg):"#f0f2f5"}">
            <div class="score-label" style="color:${ar.avg?ScoreColor(ar.avg):"#888"}">${ar.label}</div>
            <div class="score-val" style="color:${ar.avg?ScoreColor(ar.avg):"#ccc"}">${ar.avg||"−"}<span style="font-size:9pt">/5</span></div>
            <div class="score-bar-wrap"><div class="score-bar" style="width:${ar.avg?ar.avg/5*100:0}%;background:${ar.avg?ScoreColor(ar.avg):"#ccc"}"></div></div>
          </div>`).join("")}
        </div>
        <div style="margin-top:10px;text-align:center;background:${totalAvg?ScoreBg(totalAvg):"#f0f2f5"};border-radius:6px;padding:10px">
          <div style="font-size:9pt;color:#555">総合平均スコア</div>
          <div style="font-size:22pt;font-weight:900;color:${totalAvg?ScoreColor(totalAvg):"#ccc"}">${totalAvg||"−"}<span style="font-size:10pt">/5</span></div>
        </div>
      </div>
    </div>
    ${ASSESSMENT_AREAS.map(ar=>`<div class="section">
      <div class="section-head gray">■ ${ar.label}</div>
      <div class="section-body">
        ${ar.items.map((item,i)=>{const s=(a.scores[ar.key]||{})[i]||0;return `<div class="item-row">
          <div class="item-label">${item}</div>
          <div class="item-score" style="background:${s?ScoreBg(s):"#f0f2f5"};color:${s?ScoreColor(s):"#aaa"}">${s?LEVEL_LABELS[s-1]:"未評価"}</div>
        </div>`;}).join("")}
        ${a.notes?.[ar.key]?`<div class="comment-box" style="margin-top:6px">📝 ${a.notes[ar.key]}</div>`:""}
      </div>
    </div>`).join("")}
    ${a.overall?`<div class="section"><div class="section-head blue">■ 総合所見</div><div class="section-body"><div class="comment-box">${a.overall}</div></div></div>`:""}
    <div class="signature-row">
      <div class="sig-box"><div class="sig-label">評価者</div><div class="sig-line">印</div></div>
      <div class="sig-box"><div class="sig-label">管理者確認</div><div class="sig-line">印</div></div>
      <div class="sig-box"><div class="sig-label">保護者確認</div><div class="sig-line">印</div></div>
    </div>
  </div>`;
  printHTML(html, `アセスメント_${u.name}_${a.date}`);
}

// 個別支援計画印刷
function printISP(u, isp, facilityName) {
  const html = `<div class="print-wrap">
    <div class="print-header">
      <div><div class="facility">${facilityName}</div><div class="title">個別支援計画書</div></div>
      <div class="meta"><div class="name">${u.name}（${calcAge(u.dob)}歳）</div><div>支援期間: ${isp.period}</div><div>作成日: ${isp.createdAt} ／ 担当: ${isp.staffName||""}</div></div>
    </div>
    <div class="section">
      <div class="section-head blue">■ 基本情報</div>
      <div class="section-body"><div class="field-grid">
        <div class="field"><div class="field-label">利用者氏名</div><div class="field-value">${u.name}</div></div>
        <div class="field"><div class="field-label">生年月日・年齢</div><div class="field-value">${u.dob}（${calcAge(u.dob)}歳）</div></div>
        <div class="field"><div class="field-label">診断名</div><div class="field-value">${u.diagnosis}</div></div>
        <div class="field"><div class="field-label">支援状況</div><div class="field-value">${isp.status}</div></div>
      </div></div>
    </div>
    <div class="section">
      <div class="section-head orange">■ 支援領域</div>
      <div class="section-body">${(isp.goals||[]).map(g=>`<span class="tag blue">${g}</span>`).join("")}</div>
    </div>
    <div class="section">
      <div class="section-head blue">■ 支援目標</div>
      <div class="section-body">
        <div class="field-label" style="margin-bottom:5px">長期目標</div>
        <div class="goal-box">${isp.longGoal||""}</div>
        <div class="field-label" style="margin-bottom:5px;margin-top:10px">短期目標</div>
        <div class="comment-box">${isp.shortGoal||""}</div>
      </div>
    </div>
    <div class="section">
      <div class="section-head green">■ 支援内容・方法</div>
      <div class="section-body"><div class="comment-box">${isp.support||""}</div></div>
    </div>
    <div class="section">
      <div class="section-head gray">■ 評価方法・時期</div>
      <div class="section-body"><div class="comment-box">${isp.evaluation||""}</div></div>
    </div>
    <div class="section">
      <div class="section-head blue">■ 達成度</div>
      <div class="section-body">
        <div style="display:flex;justify-content:space-between;margin-bottom:5px"><span>進捗状況</span><strong>${isp.progress}%</strong></div>
        <div class="progress-wrap"><div class="progress-fill" style="width:${isp.progress}%"></div></div>
      </div>
    </div>
    <div class="signature-row">
      <div class="sig-box"><div class="sig-label">作成担当者</div><div style="font-size:10pt;margin-bottom:12px">${isp.staffName||""}</div><div class="sig-line">印</div></div>
      <div class="sig-box"><div class="sig-label">管理者確認</div><div class="sig-line">印</div></div>
      <div class="sig-box"><div class="sig-label">保護者同意</div><div class="sig-line">印</div></div>
    </div>
  </div>`;
  printHTML(html, `個別支援計画_${u.name}_${isp.period}`);
}

// 個別支援計画（原案）印刷
function printIspDraft(u, d, facilityName) {
  const WD = ["月","火","水","木","金","土","日・祝"];
  const WK = ["mon","tue","wed","thu","fri","sat","sun"];
  const goalRows = (d.goals||[]).map((g,i)=>`
    <tr>
      <td style="font-size:11px;padding:6px 5px;border:1px solid #ccc;text-align:center;vertical-align:top;">${g.priority||""}</td>
      <td style="font-size:11px;padding:6px 5px;border:1px solid #ccc;vertical-align:top;">${(g.achievement||"").replace(/\n/g,"<br/>")}</td>
      <td style="font-size:11px;padding:6px 5px;border:1px solid #ccc;vertical-align:top;">${(g.domains||[]).join("、")}</td>
      <td style="font-size:11px;padding:6px 5px;border:1px solid #ccc;text-align:center;vertical-align:top;">${g.period||""}</td>
      <td style="font-size:11px;padding:6px 5px;border:1px solid #ccc;vertical-align:top;">${(g.reflection||"").replace(/\n/g,"<br/>")}</td>
      <td style="font-size:11px;padding:6px 5px;border:1px solid #ccc;text-align:center;vertical-align:top;">${i+1}</td>
    </tr>`).join("");
  const schedRows = WD.map((wd,i)=>{
    const k=WK[i]; const sc=d.schedule?.[k]||{};
    return `<td style="border:1px solid #ccc;padding:4px;text-align:center;font-size:10px;">${sc.start||""}<br/>〜<br/>${sc.end||""}</td>`;
  }).join("");
  const extBeforeRows = WD.map((_,i)=>{const k=WK[i];return `<td style="border:1px solid #ccc;padding:4px;text-align:center;font-size:10px;">${(d.extBefore||{})[k]||""}</td>`;}).join("");
  const extAfterRows = WD.map((_,i)=>{const k=WK[i];return `<td style="border:1px solid #ccc;padding:4px;text-align:center;font-size:10px;">${(d.extAfter||{})[k]||""}</td>`;}).join("");
  const html=`<div style="font-family:'Noto Sans JP',sans-serif;max-width:900px;margin:0 auto;padding:20px;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
    <h2 style="font-size:17px;font-weight:900;margin:0;">${u.name}さんの個別支援計画（原案）</h2>
    <div style="text-align:right;font-size:11px;color:#555;">
      <div>施設名：${facilityName}</div>
      <div>利用サービス：放課後等デイサービス</div>
      <div>作成日：${d.createdAt||""}</div>
    </div>
  </div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
    <tr>
      <td style="border:1px solid #ccc;padding:5px 8px;font-size:11px;font-weight:700;background:#f0f0f0;width:120px;">受給者証番号</td>
      <td style="border:1px solid #ccc;padding:5px 8px;font-size:12px;">${d.jukyushaCertNo||""}</td>
      <td style="border:1px solid #ccc;padding:5px 8px;font-size:11px;font-weight:700;background:#f0f0f0;width:80px;">開始日</td>
      <td style="border:1px solid #ccc;padding:5px 8px;font-size:12px;">${d.startDate||""}</td>
      <td style="border:1px solid #ccc;padding:5px 8px;font-size:11px;font-weight:700;background:#f0f0f0;width:80px;">有効期限</td>
      <td style="border:1px solid #ccc;padding:5px 8px;font-size:12px;">${d.expiryDate||""}</td>
      <td style="border:1px solid #ccc;padding:5px 8px;font-size:11px;font-weight:700;background:#f0f0f0;width:80px;">作成回数</td>
      <td style="border:1px solid #ccc;padding:5px 8px;font-size:12px;">${d.creationCount||1}</td>
    </tr>
  </table>
  <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
    <tr>
      <td style="border:1px solid #ccc;padding:6px 8px;font-size:11px;font-weight:700;background:#f0f0f0;width:160px;vertical-align:top;">利用児及び家族の<br/>生活に対する意向</td>
      <td style="border:1px solid #ccc;padding:6px 8px;font-size:11px;vertical-align:top;">
        <div style="margin-bottom:4px;font-weight:700;color:#555;">〜 本人 〜</div>
        <div style="white-space:pre-wrap;margin-bottom:8px;">${d.childWish||""}</div>
        <div style="margin-bottom:4px;font-weight:700;color:#555;">〜 家族 〜</div>
        <div style="white-space:pre-wrap;">${d.familyWish||""}</div>
      </td>
    </tr>
    <tr>
      <td style="border:1px solid #ccc;padding:6px 8px;font-size:11px;font-weight:700;background:#f0f0f0;vertical-align:top;">総合的な支援の方針</td>
      <td style="border:1px solid #ccc;padding:6px 8px;font-size:11px;white-space:pre-wrap;">${d.overallPolicy||""}</td>
    </tr>
    <tr>
      <td style="border:1px solid #ccc;padding:6px 8px;font-size:11px;font-weight:700;background:#f0f0f0;vertical-align:top;">長期目標<br/>（内容・期間等）</td>
      <td style="border:1px solid #ccc;padding:6px 8px;font-size:11px;vertical-align:top;">
        <div style="white-space:pre-wrap;">${d.longTermGoal||""}</div>
        <div style="font-size:10px;color:#666;margin-top:4px;">期間：${d.longTermPeriod||""}</div>
      </td>
    </tr>
    <tr>
      <td style="border:1px solid #ccc;padding:6px 8px;font-size:11px;font-weight:700;background:#f0f0f0;vertical-align:top;">支援の標準的な<br/>提供時間帯</td>
      <td style="border:1px solid #ccc;padding:6px 8px;font-size:11px;white-space:pre-wrap;">${d.supportTimeSlot||""}</td>
    </tr>
    <tr>
      <td style="border:1px solid #ccc;padding:6px 8px;font-size:11px;font-weight:700;background:#f0f0f0;vertical-align:top;">短期目標<br/>（内容・期間等）</td>
      <td style="border:1px solid #ccc;padding:6px 8px;font-size:11px;vertical-align:top;">
        <div style="white-space:pre-wrap;">${d.shortTermGoal||""}</div>
        <div style="font-size:10px;color:#666;margin-top:4px;">期間：${d.shortTermPeriod||""}</div>
      </td>
    </tr>
    <tr>
      <td style="border:1px solid #ccc;padding:6px 8px;font-size:11px;font-weight:700;background:#f0f0f0;">利用日数</td>
      <td style="border:1px solid #ccc;padding:6px 8px;font-size:11px;">${d.usageDays||""}</td>
    </tr>
    <tr>
      <td style="border:1px solid #ccc;padding:6px 8px;font-size:11px;font-weight:700;background:#f0f0f0;vertical-align:top;">送迎</td>
      <td style="border:1px solid #ccc;padding:6px 8px;font-size:11px;">
        <div>迎え：${d.pickupNote||""}</div>
        <div>送り：${d.dropoffNote||""}</div>
      </td>
    </tr>
  </table>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
    <thead>
      <tr style="background:#f0f0f0;">
        <th style="border:1px solid #ccc;padding:5px;font-size:10px;width:70px;">優先順位<br/>（本人のニーズ）</th>
        <th style="border:1px solid #ccc;padding:5px;font-size:10px;">具体的な達成目標</th>
        <th style="border:1px solid #ccc;padding:5px;font-size:10px;width:130px;">支援内容<br/>（5領域との関連）</th>
        <th style="border:1px solid #ccc;padding:5px;font-size:10px;width:60px;">達成見込</th>
        <th style="border:1px solid #ccc;padding:5px;font-size:10px;">振り返り欄</th>
        <th style="border:1px solid #ccc;padding:5px;font-size:10px;width:30px;">番号</th>
      </tr>
    </thead>
    <tbody>${goalRows}</tbody>
  </table>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
    <tr>
      <td style="border:1px solid #ccc;padding:8px;font-size:11px;width:50%;">説明同意日　令和　　年　　月　　日<br/><br/>保護者氏名　　　　　　　　　　　　　㊞</td>
      <td style="border:1px solid #ccc;padding:8px;font-size:11px;">${facilityName}<br/><br/>児童発達支援管理責任者　${d.staffName||""}</td>
    </tr>
  </table>
  <div style="page-break-before:always;"></div>
  <h3 style="font-size:14px;font-weight:900;margin:16px 0 8px;">個別支援計画案別表</h3>
  <table style="width:100%;border-collapse:collapse;margin-bottom:6px;">
    <tr>
      <td style="border:1px solid #ccc;padding:5px 8px;font-size:11px;font-weight:700;background:#f0f0f0;width:100px;">利用児氏名</td>
      <td style="border:1px solid #ccc;padding:5px 8px;font-size:12px;">${u.name}</td>
      <td style="border:1px solid #ccc;padding:5px 8px;font-size:11px;font-weight:700;background:#f0f0f0;width:100px;">利用開始日</td>
      <td style="border:1px solid #ccc;padding:5px 8px;font-size:12px;">${d.startDate||""}</td>
    </tr>
  </table>
  <table style="width:100%;border-collapse:collapse;margin-bottom:8px;font-size:10px;">
    <thead>
      <tr style="background:#f0f0f0;">
        <th style="border:1px solid #ccc;padding:4px;width:80px;"></th>
        ${WD.map(w=>`<th style="border:1px solid #ccc;padding:4px;text-align:center;">${w}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      <tr><td style="border:1px solid #ccc;padding:4px;font-size:10px;font-weight:700;background:#f8f8f8;">提供時間</td>${schedRows}</tr>
      <tr><td style="border:1px solid #ccc;padding:4px;font-size:10px;font-weight:700;background:#f8f8f8;">特記事項</td><td colspan="7" style="border:1px solid #ccc;padding:4px;">${d.specialNote||""}</td></tr>
      <tr><td style="border:1px solid #ccc;padding:4px;font-size:10px;font-weight:700;background:#f8f8f8;">延長支援<br/>（支援前）</td>${extBeforeRows}</tr>
      <tr><td style="border:1px solid #ccc;padding:4px;font-size:10px;font-weight:700;background:#f8f8f8;">延長支援<br/>（支援後）</td>${extAfterRows}</tr>
      <tr><td style="border:1px solid #ccc;padding:4px;font-size:10px;font-weight:700;background:#f8f8f8;">延長理由<br/>及び時数</td><td colspan="7" style="border:1px solid #ccc;padding:4px;">${d.extReason||""}</td></tr>
    </tbody>
  </table>
  <table style="width:100%;border-collapse:collapse;">
    <tr>
      <td style="border:1px solid #ccc;padding:8px;font-size:11px;width:50%;">説明同意日　令和　　年　　月　　日<br/><br/>保護者氏名　　　　　　　　　　　　　㊞</td>
      <td style="border:1px solid #ccc;padding:8px;font-size:11px;">${facilityName}<br/><br/>児童発達支援管理責任者　${d.staffName||""}</td>
    </tr>
  </table>
</div>`;
  printHTML(html, `個別支援計画原案_${u.name}_${d.createdAt}`);
}

// モニタリング印刷
function printMonitoring(u, m, facilityName) {
  const RESULT_COLORS={"達成":["#186838","#d0eedd"],"概ね達成":["#005a8a","#cce6f5"],"一部達成":["#a06010","#fce8c8"],"未達成":["#a02818","#fad4d0"],"継続":["#4a1880","#e8d4f4"]};
  const achieved=Object.values(m.itemScores||{}).filter(s=>s==="達成"||s==="概ね達成").length;
  const total=Object.keys(m.itemScores||{}).length;
  const html = `<div class="print-wrap">
    <div class="print-header">
      <div><div class="facility">${facilityName}</div><div class="title">モニタリング記録</div></div>
      <div class="meta"><div class="name">${u.name}（${calcAge(u.dob)}歳）</div><div>実施日: ${m.date}</div><div>担当: ${m.staffName}</div></div>
    </div>
    ${m.ispPeriod?`<div style="background:#eef6fc;border:1px solid #90c8e8;border-radius:6px;padding:8px 12px;margin-bottom:10px;font-size:10pt;color:#005080">📋 対象計画: ${m.ispPeriod}</div>`:""}
    <div class="section">
      <div class="section-head blue">■ 評価結果サマリー</div>
      <div class="section-body" style="text-align:center;padding:12px">
        <div style="font-size:9pt;color:#555;margin-bottom:4px">達成・概ね達成 項目数</div>
        <div style="font-size:28pt;font-weight:900;color:#186838">${achieved}<span style="font-size:12pt;color:#555"> / ${total} 項目</span></div>
      </div>
    </div>
    <div class="section">
      <div class="section-head blue">■ 評価項目</div>
      <div class="section-body">
        ${MONITORING_ITEMS.map((item,i)=>{const sc=m.itemScores?.[i];const col=RESULT_COLORS[sc]||["#888","#f0f2f5"];return `<div class="monitor-item">
          <div class="monitor-label">${item}</div>
          ${sc?`<span class="monitor-result" style="background:${col[1]};color:${col[0]}">${sc}</span>`:"<span style='color:#aaa;font-size:9pt'>未評価</span>"}
          ${m.itemNotes?.[i]?`<div class="comment-box">${m.itemNotes[i]}</div>`:""}
        </div>`;}).join("")}
      </div>
    </div>
    ${m.parentComment?`<div class="section"><div class="section-head orange">■ 保護者の意見・要望</div><div class="section-body"><div class="comment-box">${m.parentComment}</div></div></div>`:""}
    ${m.nextPlan?`<div class="section"><div class="section-head green">■ 次期支援方針・計画変更</div><div class="section-body"><div class="comment-box">${m.nextPlan}</div></div></div>`:""}
    ${m.overallNote?`<div class="section"><div class="section-head gray">■ 総合所見</div><div class="section-body"><div class="comment-box">${m.overallNote}</div></div></div>`:""}
    <div class="signature-row">
      <div class="sig-box"><div class="sig-label">担当者</div><div style="font-size:10pt;margin-bottom:12px">${m.staffName}</div><div class="sig-line">印</div></div>
      <div class="sig-box"><div class="sig-label">管理者確認</div><div class="sig-line">印</div></div>
      <div class="sig-box"><div class="sig-label">保護者確認</div><div class="sig-line">印</div></div>
    </div>
  </div>`;
  printHTML(html, `モニタリング_${u.name}_${m.date}`);
}

// サービス提供記録 印刷
function printServiceRecord(rec, facilityName) {
  const html = `<div class="print-wrap">
    <div class="print-header">
      <div><div class="facility">${facilityName}</div><div class="title">サービス提供記録</div></div>
      <div class="meta"><div class="name">${rec.userName} ${rec.mood||""}</div><div>${rec.time}</div><div>記録者: ${rec.createdBy}</div></div>
    </div>
    <div class="section">
      <div class="section-head blue">■ 基本情報</div>
      <div class="section-body"><div class="field-grid">
        <div class="field"><div class="field-label">利用者氏名</div><div class="field-value">${rec.userName}</div></div>
        <div class="field"><div class="field-label">在所時間</div><div class="field-value">${rec.arrival||""}〜${rec.departure||""}</div></div>
        <div class="field"><div class="field-label">今日の様子</div><div class="field-value">${rec.mood||"未記入"}</div></div>
        <div class="field"><div class="field-label">記録日時</div><div class="field-value">${rec.time}</div></div>
      </div></div>
    </div>
    <div class="section">
      <div class="section-head orange">■ 提供サービス</div>
      <div class="section-body">${(rec.items||[]).map(i=>`<span class="tag blue">${i}</span>`).join("")}</div>
    </div>
    ${rec.bodyNote?`<div class="section"><div class="section-head green">■ 体調・健康状態</div><div class="section-body"><div class="comment-box">${rec.bodyNote}</div></div></div>`:""}
    ${rec.supportNote?`<div class="section"><div class="section-head blue">■ 支援内容・様子</div><div class="section-body"><div class="comment-box">${rec.supportNote}</div></div></div>`:""}
    ${rec.specialNote?`<div class="section"><div class="section-head red">⚠ 特記事項</div><div class="section-body"><div class="comment-box" style="border-left:3px solid #c83028">${rec.specialNote}</div></div></div>`:""}
    <div class="signature-row">
      <div class="sig-box"><div class="sig-label">記録者: ${rec.createdBy}</div><div class="sig-line">印</div></div>
      <div class="sig-box"><div class="sig-label">管理者確認</div><div class="sig-line">印</div></div>
      <div class="sig-box"><div class="sig-label">保護者確認</div><div class="sig-line">印</div></div>
    </div>
  </div>`;
  printHTML(html, `サービス提供記録_${rec.userName}_${rec.time.slice(0,10)}`);
}

// シフト表 印刷
function printShift(fStaff, vm, days, getShift, facilityName) {
  const mk = d => `${vm.y}-${String(vm.m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const SHIFT_COLORS = {A:["#005a8a","#cce6f5"], B:["#155a30","#d0eedd"], C:["#a06010","#fce8c8"], off:["#666","#f0f2f5"], holiday:["#4a1880","#e8d4f4"]};
  const shiftLabel = t => t==="off"?"休":t==="holiday"?"有":t||"-";
  const headers = Array.from({length:days},(_,i)=>{const d=i+1;const dow=new Date(vm.y,vm.m-1,d).getDay();const isWe=dow===0||dow===6;return `<th style="min-width:22px;padding:4px 2px;text-align:center;font-size:7pt;background:#e8edf3;border:1px solid #ccc;color:${dow===0?"#c83028":dow===6?"#005a8a":"#333"};${isWe?"opacity:.7":""}">${d}<br>${["日","月","火","水","木","金","土"][dow]}</th>`;}).join("");
  const rows = fStaff.map(s => {
    const cells = Array.from({length:days},(_,i)=>{
      const date=mk(i+1);const t=getShift(s.id,date);const dow=new Date(vm.y,vm.m-1,i+1).getDay();const isWe=dow===0||dow===6;
      const col=SHIFT_COLORS[t]||["#bbb","#f8f8f8"];
      return `<td style="padding:3px 1px;text-align:center;border:1px solid #ddd;font-size:8pt;font-weight:700;background:${isWe?"#f0f2f5":col[1]};color:${isWe?"#aaa":col[0]}">${isWe?"":shiftLabel(t)}</td>`;
    }).join("");
    const wdays=Array.from({length:days},(_,i)=>getShift(s.id,mk(i+1))).filter(t=>t!=="off"&&t!=="holiday"&&t!=="none").length;
    return `<tr><td style="padding:5px 8px;border:1px solid #ddd;font-weight:700;font-size:9pt;white-space:nowrap;background:#f8f9fa">${s.name}</td>${cells}<td style="padding:3px 6px;text-align:center;border:1px solid #ddd;font-size:8pt;font-weight:700;color:#005a8a">${wdays}日</td></tr>`;
  }).join("");
  const legend = [["A 早番","#005a8a","#cce6f5"],["B 遅番","#155a30","#d0eedd"],["C 通常","#a06010","#fce8c8"],["休 公休","#666","#f0f2f5"],["有 有休","#4a1880","#e8d4f4"]].map(([l,c,bg])=>`<span style="display:inline-flex;align-items:center;gap:4px;margin-right:10px;font-size:8pt"><span style="width:14px;height:14px;border-radius:3px;background:${bg};border:1px solid ${c};display:inline-block"></span><span style="color:${c};font-weight:700">${l}</span></span>`).join("");
  const html = `<div class="print-wrap">
    <div class="print-header">
      <div><div class="facility">${facilityName}</div><div class="title">シフト表</div></div>
      <div class="meta"><div style="font-size:14pt;font-weight:700">${vm.y}年 ${vm.m}月</div><div>職員数: ${fStaff.length}名</div></div>
    </div>
    <div style="margin-bottom:10px">${legend}</div>
    <div style="overflow-x:auto">
      <table style="border-collapse:collapse;font-size:9pt;width:100%">
        <thead><tr>
          <th style="padding:5px 8px;background:#e8edf3;border:1px solid #ccc;font-size:9pt;text-align:left">職員名</th>
          ${headers}
          <th style="padding:4px 6px;background:#e8edf3;border:1px solid #ccc;font-size:8pt">出勤日数</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
  printHTML(html, `シフト表_${facilityName}_${vm.y}${String(vm.m).padStart(2,"0")}`);
}

// 出欠管理 印刷（月間）
function printAttendance(users, vm, days, getAtt, facilityName) {
  const mk = d => `${vm.y}-${String(vm.m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const ATT_COLORS = {"出席":["#155a30","#d0eedd"],"欠席":["#a02818","#fad4d0"],"予定":["#005a8a","#cce6f5"],"未定":["#888","#f0f2f5"]};
  const headers = Array.from({length:days},(_,i)=>{const d=i+1;const dow=new Date(vm.y,vm.m-1,d).getDay();const isWe=dow===0||dow===6;return `<th style="min-width:20px;padding:4px 1px;text-align:center;font-size:7pt;background:#e8edf3;border:1px solid #ccc;color:${dow===0?"#c83028":dow===6?"#005a8a":"#333"};${isWe?"opacity:.6":""}">${d}<br>${["日","月","火","水","木","金","土"][dow]}</th>`;}).join("");
  const rows = users.map(u => {
    const cells = Array.from({length:days},(_,i)=>{
      const date=mk(i+1);const dow=new Date(vm.y,vm.m-1,i+1).getDay();const isWe=dow===0||dow===6;
      const st=getAtt(u.id,date);const col=ATT_COLORS[st]||["#bbb","#fff"];
      const label=st==="出席"?"○":st==="欠席"?"×":st==="予定"?"△":"";
      return `<td style="padding:2px;text-align:center;border:1px solid #ddd;font-size:8pt;font-weight:700;background:${isWe?"#f0f2f5":col[1]};color:${isWe?"#ccc":col[0]}">${isWe?"":label}</td>`;
    }).join("");
    const present=Array.from({length:days},(_,i)=>getAtt(u.id,mk(i+1))).filter(s=>s==="出席").length;
    const absent=Array.from({length:days},(_,i)=>getAtt(u.id,mk(i+1))).filter(s=>s==="欠席").length;
    return `<tr><td style="padding:5px 8px;border:1px solid #ddd;font-weight:700;font-size:9pt;white-space:nowrap;background:#f8f9fa">${u.name}</td>${cells}<td style="padding:3px 5px;text-align:center;border:1px solid #ddd;font-size:8pt;color:#155a30;font-weight:700">${present}</td><td style="padding:3px 5px;text-align:center;border:1px solid #ddd;font-size:8pt;color:#a02818;font-weight:700">${absent}</td></tr>`;
  }).join("");
  const html = `<div class="print-wrap">
    <div class="print-header">
      <div><div class="facility">${facilityName}</div><div class="title">出欠管理表</div></div>
      <div class="meta"><div style="font-size:14pt;font-weight:700">${vm.y}年 ${vm.m}月</div><div>利用者数: ${users.length}名</div></div>
    </div>
    <div style="margin-bottom:8px;font-size:8pt">
      <span style="margin-right:10px"><span style="color:#155a30;font-weight:700">○ 出席</span></span>
      <span style="margin-right:10px"><span style="color:#a02818;font-weight:700">× 欠席</span></span>
      <span style="margin-right:10px"><span style="color:#005a8a;font-weight:700">△ 予定</span></span>
    </div>
    <div style="overflow-x:auto">
      <table style="border-collapse:collapse;font-size:9pt;width:100%">
        <thead><tr>
          <th style="padding:5px 8px;background:#e8edf3;border:1px solid #ccc;font-size:9pt;text-align:left">利用者名</th>
          ${headers}
          <th style="padding:4px 4px;background:#d0eedd;border:1px solid #ccc;font-size:8pt;color:#155a30">出席</th>
          <th style="padding:4px 4px;background:#fad4d0;border:1px solid #ccc;font-size:8pt;color:#a02818">欠席</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
  printHTML(html, `出欠管理_${facilityName}_${vm.y}${String(vm.m).padStart(2,"0")}`);
}

// 送迎管理 印刷
function printTransport(list, dir, facilityName) {
  const html = `<div class="print-wrap">
    <div class="print-header">
      <div><div class="facility">${facilityName}</div><div class="title">送迎管理表（${dir}）</div></div>
      <div class="meta"><div style="font-size:13pt;font-weight:700">${todayDisplay()}</div><div>${dir}送迎 ${list.length}件</div></div>
    </div>
    <div class="section">
      <div class="section-head blue">■ ${dir}送迎一覧</div>
      <div class="section-body">
        <table style="width:100%;border-collapse:collapse;font-size:10pt">
          <thead><tr style="background:#e8edf3">
            <th style="padding:7px 10px;border:1px solid #ccc;text-align:left">利用者名</th>
            <th style="padding:7px 10px;border:1px solid #ccc;text-align:left">住所</th>
            <th style="padding:7px 10px;border:1px solid #ccc;text-align:center">方法</th>
            <th style="padding:7px 10px;border:1px solid #ccc;text-align:center">担当</th>
            <th style="padding:7px 10px;border:1px solid #ccc;text-align:center">確認</th>
          </tr></thead>
          <tbody>
            ${list.map(t=>`<tr>
              <td style="padding:8px 10px;border:1px solid #ddd;font-weight:700">${t.userName}</td>
              <td style="padding:8px 10px;border:1px solid #ddd;font-size:9pt;color:#555">${t.address}</td>
              <td style="padding:8px 10px;border:1px solid #ddd;text-align:center;font-weight:700;color:${t.method==="車"?"#005a8a":t.method==="徒歩"?"#155a30":"#888"}">${t.method}</td>
              <td style="padding:8px 10px;border:1px solid #ddd;text-align:center">${t.driver}</td>
              <td style="padding:8px 10px;border:1px solid #ddd;text-align:center">□</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>
    <div style="margin-top:14px;font-size:9pt;color:#666">作成日時: ${new Date().toLocaleString("ja-JP")}</div>
  </div>`;
  printHTML(html, `送迎管理_${facilityName}_${dir}_${todayISO()}`);
}

// 保護者連絡 印刷
function printMessage(msg, facilityName) {
  const html = `<div class="print-wrap">
    <div class="print-header">
      <div><div class="facility">${facilityName}</div><div class="title">保護者連絡記録</div></div>
      <div class="meta"><div class="name">${msg.userName}</div><div>${msg.time}</div></div>
    </div>
    <div class="section">
      <div class="section-head orange">■ 保護者からのメッセージ</div>
      <div class="section-body">
        <div style="font-size:10pt;color:#555;margin-bottom:6px">送信者: ${msg.from} ／ ${msg.time}</div>
        <div class="comment-box" style="border-left:3px solid #d08010">${msg.body}</div>
      </div>
    </div>
    ${msg.replies?.length>0?`<div class="section">
      <div class="section-head blue">■ 施設からの返信</div>
      <div class="section-body">
        ${msg.replies.map((r,i)=>`<div style="margin-bottom:8px"><div style="font-size:9pt;color:#555;margin-bottom:3px">返信${i+1}</div><div class="comment-box" style="border-left:3px solid #0080b8">${r}</div></div>`).join("")}
      </div>
    </div>`:""}
    <div class="signature-row">
      <div class="sig-box"><div class="sig-label">担当者確認</div><div class="sig-line">印</div></div>
      <div class="sig-box"><div class="sig-label">管理者確認</div><div class="sig-line">印</div></div>
    </div>
  </div>`;
  printHTML(html, `保護者連絡_${msg.userName}_${msg.time.slice(0,10)}`);
}

// 売上管理 印刷
function printSales(visibleFacs, vm, kokuho, facilityName) {
  const TANKA = 10.40;
  const facRows = visibleFacs.map(f => {
    const kk = kokuho.filter(k=>k.facilityId===f.id&&k.year===vm.y&&k.month===vm.m);
    const totalSvc = kk.reduce((s,k)=>s+k.serviceDays,0);
    const totalTr = kk.reduce((s,k)=>s+k.transportDays,0);
    const totalUnits = kk.reduce((s,k)=>s+k.serviceDays*k.unitPrice+(k.transportDays>0?k.transportDays*108:0),0);
    const totalYen = Math.round(totalUnits*TANKA);
    return {f, kk, totalSvc, totalTr, totalUnits, totalYen};
  });
  const grandTotal = facRows.reduce((s,r)=>s+r.totalYen,0);
  const html = `<div class="print-wrap">
    <div class="print-header">
      <div><div class="facility">GO GROUP</div><div class="title">売上管理レポート</div></div>
      <div class="meta"><div style="font-size:14pt;font-weight:700">${vm.y}年${vm.m}月</div><div>出力日: ${todayDisplay()}</div></div>
    </div>
    <div class="section">
      <div class="section-head blue">■ 施設別売上サマリー</div>
      <div class="section-body">
        <table style="width:100%;border-collapse:collapse;font-size:10pt">
          <thead><tr style="background:#e8edf3">
            <th style="padding:8px 10px;border:1px solid #ccc;text-align:left">施設名</th>
            <th style="padding:8px 10px;border:1px solid #ccc;text-align:center">利用者数</th>
            <th style="padding:8px 10px;border:1px solid #ccc;text-align:center">サービス日数</th>
            <th style="padding:8px 10px;border:1px solid #ccc;text-align:center">送迎日数</th>
            <th style="padding:8px 10px;border:1px solid #ccc;text-align:right">請求額（概算）</th>
          </tr></thead>
          <tbody>
            ${facRows.map(r=>`<tr>
              <td style="padding:8px 10px;border:1px solid #ddd;font-weight:700">${r.f.name}</td>
              <td style="padding:8px 10px;border:1px solid #ddd;text-align:center">${r.kk.length}名</td>
              <td style="padding:8px 10px;border:1px solid #ddd;text-align:center">${r.totalSvc}日</td>
              <td style="padding:8px 10px;border:1px solid #ddd;text-align:center">${r.totalTr}日</td>
              <td style="padding:8px 10px;border:1px solid #ddd;text-align:right;font-weight:700;color:#a06010">${r.totalYen.toLocaleString()}円</td>
            </tr>`).join("")}
            <tr style="background:#e8f5ec">
              <td style="padding:9px 10px;border:1px solid #ccc;font-weight:900">合計</td>
              <td colspan="3" style="padding:9px 10px;border:1px solid #ccc"></td>
              <td style="padding:9px 10px;border:1px solid #ccc;text-align:right;font-weight:900;font-size:13pt;color:#155a30">${grandTotal.toLocaleString()}円</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    ${facRows.map(r=>`<div class="section" style="page-break-inside:avoid">
      <div class="section-head gray">■ ${r.f.name} 利用者内訳</div>
      <div class="section-body">
        <table style="width:100%;border-collapse:collapse;font-size:9.5pt">
          <thead><tr style="background:#f0f2f5">
            <th style="padding:5px 8px;border:1px solid #ccc;text-align:left">利用者名</th>
            <th style="padding:5px 8px;border:1px solid #ccc;text-align:center">日数</th>
            <th style="padding:5px 8px;border:1px solid #ccc;text-align:center">送迎</th>
            <th style="padding:5px 8px;border:1px solid #ccc;text-align:right">請求額</th>
            <th style="padding:5px 8px;border:1px solid #ccc;text-align:center">状態</th>
          </tr></thead>
          <tbody>
            ${r.kk.map(k=>{const amt=Math.round((k.serviceDays*k.unitPrice+(k.transportDays>0?k.transportDays*108:0))*TANKA);return `<tr>
              <td style="padding:6px 8px;border:1px solid #ddd;font-weight:600">${k.userName}</td>
              <td style="padding:6px 8px;border:1px solid #ddd;text-align:center">${k.serviceDays}日</td>
              <td style="padding:6px 8px;border:1px solid #ddd;text-align:center">${k.transportDays>0?k.transportDays+"日":"-"}</td>
              <td style="padding:6px 8px;border:1px solid #ddd;text-align:right;font-weight:700">${amt.toLocaleString()}円</td>
              <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;font-size:9pt;color:${k.status==="入金済"?"#155a30":k.status==="請求済"?"#005a8a":"#888"}">${k.status}</td>
            </tr>`;}).join("")}
          </tbody>
        </table>
      </div>
    </div>`).join("")}
    <div style="margin-top:14px;font-size:9pt;color:#666;text-align:right">出力日時: ${new Date().toLocaleString("ja-JP")} ／ 1単位 ${TANKA}円換算</div>
  </div>`;
  printHTML(html, `売上管理_${vm.y}${String(vm.m).padStart(2,"0")}`);
}


// 業務日報 印刷
function printDailyReport(report, facilityName) {
  const photoPlaceholders = Array.from({length:6},(_,i)=>{
    const p = report.photos?.[i];
    const bg = p ? "#e8f4fc" : "#f8f9fa";
    let inner = "";
    if(p) {
      const commentHtml = p.comment ? '<div style="font-size:8pt;color:#666;margin-top:3px">'+p.comment+'</div>' : "";
      inner = '<div style="font-size:18pt">📸</div>'
        + '<div style="color:#005a8a;font-weight:700;font-size:9pt;margin-top:4px">'+p.activity+'</div>'
        + '<div style="font-size:8pt;color:#555;margin-top:2px">'+p.userName+'</div>'
        + commentHtml;
    } else {
      inner = '<div style="font-size:18pt">📷</div><div>写真'+(i+1)+'</div>';
    }
    return '<div style="border:1px solid #ccc;border-radius:6px;overflow:hidden;aspect-ratio:4/3;display:flex;flex-direction:column;align-items:center;justify-content:center;background:'+bg+';font-size:9pt;color:#999;text-align:center;padding:6px">'
      + inner + '</div>';
  }).join("");

  const staffRows = (report.staffList||[]).map(s=>
    `<tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:600">${s.name}</td>
     <td style="padding:6px 10px;border:1px solid #ddd;text-align:center">${s.clockIn||"-"}</td>
     <td style="padding:6px 10px;border:1px solid #ddd;text-align:center">${s.clockOut||"-"}</td>
     <td style="padding:6px 10px;border:1px solid #ddd;text-align:center">${s.temp?""+s.temp+"℃":"-"}</td>
     <td style="padding:6px 10px;border:1px solid #ddd;text-align:center;color:${s.role==="manager"?"#005a8a":"#333"}">${s.role==="manager"?"管理者":"一般"}</td></tr>`
  ).join("");

  const userRows = (report.userList||[]).map(u=>
    `<tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:600">${u.name}</td>
     <td style="padding:6px 10px;border:1px solid #ddd;text-align:center">${u.arrivalTime||"-"}</td>
     <td style="padding:6px 10px;border:1px solid #ddd;text-align:center">${u.departTime||"-"}</td>
     <td style="padding:6px 10px;border:1px solid #ddd;text-align:center">${u.temp?""+u.temp+"℃":"-"}</td>
     <td style="padding:6px 10px;border:1px solid #ddd;text-align:center">${u.transport||"-"}</td>
     <td style="padding:6px 10px;border:1px solid #ddd;text-align:center">${u.status||"-"}</td></tr>`
  ).join("");

  const actRows = (report.activities||[]).map((a,i)=>
    `<tr><td style="padding:6px 8px;border:1px solid #ddd;text-align:center;color:#888;font-size:9pt">${i+1}</td>
     <td style="padding:6px 8px;border:1px solid #ddd">${a.time||""}</td>
     <td style="padding:6px 8px;border:1px solid #ddd;font-weight:600">${a.title||""}</td>
     <td style="padding:6px 8px;border:1px solid #ddd;font-size:9pt">${a.detail||""}</td>
     <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;font-size:9pt">${a.staff||""}</td></tr>`
  ).join("");

  const html = `<div class="print-wrap">
    <div class="print-header">
      <div><div class="facility">${facilityName}</div><div class="title">業 務 日 報</div></div>
      <div class="meta">
        <div style="font-size:14pt;font-weight:700">${report.date}</div>
        <div>天気: ${report.weather||"—"} ／ 気温: ${report.temperature||"—"}</div>
        <div>作成者: ${report.author||"—"}</div>
      </div>
    </div>

    <!-- 出勤・利用者サマリー -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px">
      <div style="border:1px solid #90c8e8;border-radius:6px;padding:10px;text-align:center;background:#eef6fc">
        <div style="font-size:9pt;color:#005a8a;font-weight:700">出勤職員</div>
        <div style="font-size:22pt;font-weight:900;color:#005a8a">${(report.staffList||[]).length}<span style="font-size:10pt">名</span></div>
      </div>
      <div style="border:1px solid #98d8b0;border-radius:6px;padding:10px;text-align:center;background:#eef8f2">
        <div style="font-size:9pt;color:#155a30;font-weight:700">来所利用者</div>
        <div style="font-size:22pt;font-weight:900;color:#155a30">${(report.userList||[]).length}<span style="font-size:10pt">名</span></div>
      </div>
      <div style="border:1px solid #e8b870;border-radius:6px;padding:10px;text-align:center;background:#fef8ec">
        <div style="font-size:9pt;color:#a06010;font-weight:700">活動数</div>
        <div style="font-size:22pt;font-weight:900;color:#a06010">${(report.activities||[]).length}<span style="font-size:10pt">件</span></div>
      </div>
      <div style="border:1px solid #f0a090;border-radius:6px;padding:10px;text-align:center;background:#fdf5f4">
        <div style="font-size:9pt;color:#a02818;font-weight:700">特記事項</div>
        <div style="font-size:22pt;font-weight:900;color:#a02818">${report.incidents||0}<span style="font-size:10pt">件</span></div>
      </div>
    </div>

    <!-- 職員一覧 -->
    <div class="section">
      <div class="section-head blue">■ 出勤職員一覧</div>
      <div class="section-body">
        <table style="width:100%;border-collapse:collapse;font-size:10pt">
          <thead><tr style="background:#e8edf3">
            <th style="padding:6px 10px;border:1px solid #ccc;text-align:left">氏名</th>
            <th style="padding:6px 10px;border:1px solid #ccc;text-align:center">出勤時刻</th>
            <th style="padding:6px 10px;border:1px solid #ccc;text-align:center">退勤時刻</th>
            <th style="padding:6px 10px;border:1px solid #ccc;text-align:center">体温</th>
            <th style="padding:6px 10px;border:1px solid #ccc;text-align:center">役職</th>
          </tr></thead>
          <tbody>${staffRows||`<tr><td colspan="5" style="padding:12px;text-align:center;color:#aaa">記録なし</td></tr>`}</tbody>
        </table>
      </div>
    </div>

    <!-- 利用者一覧 -->
    <div class="section">
      <div class="section-head green">■ 利用者来所一覧</div>
      <div class="section-body">
        <table style="width:100%;border-collapse:collapse;font-size:10pt">
          <thead><tr style="background:#e8f5ec">
            <th style="padding:6px 10px;border:1px solid #ccc;text-align:left">氏名</th>
            <th style="padding:6px 10px;border:1px solid #ccc;text-align:center">来所</th>
            <th style="padding:6px 10px;border:1px solid #ccc;text-align:center">退所</th>
            <th style="padding:6px 10px;border:1px solid #ccc;text-align:center">体温</th>
            <th style="padding:6px 10px;border:1px solid #ccc;text-align:center">送迎</th>
            <th style="padding:6px 10px;border:1px solid #ccc;text-align:center">出欠</th>
          </tr></thead>
          <tbody>${userRows||`<tr><td colspan="6" style="padding:12px;text-align:center;color:#aaa">記録なし</td></tr>`}</tbody>
        </table>
      </div>
    </div>

    <!-- 活動内容 -->
    <div class="section">
      <div class="section-head orange">■ 活動・支援内容</div>
      <div class="section-body">
        <table style="width:100%;border-collapse:collapse;font-size:10pt">
          <thead><tr style="background:#fef3e8">
            <th style="padding:6px 8px;border:1px solid #ccc;width:28px">#</th>
            <th style="padding:6px 8px;border:1px solid #ccc;width:70px">時刻</th>
            <th style="padding:6px 8px;border:1px solid #ccc;width:100px">活動名</th>
            <th style="padding:6px 8px;border:1px solid #ccc;text-align:left">内容・詳細</th>
            <th style="padding:6px 8px;border:1px solid #ccc;width:80px">担当</th>
          </tr></thead>
          <tbody>${actRows||`<tr><td colspan="5" style="padding:12px;text-align:center;color:#aaa">活動記録なし</td></tr>`}</tbody>
        </table>
      </div>
    </div>

    <!-- 活動写真 -->
    <div class="section">
      <div class="section-head purple">■ 活動写真（${(report.photos||[]).filter(Boolean).length}枚）</div>
      <div class="section-body">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${photoPlaceholders}</div>
      </div>
    </div>

    ${report.incidentDetail?`<div class="section"><div class="section-head red">⚠ 特記事項・ヒヤリハット</div><div class="section-body"><div class="comment-box" style="border-left:3px solid #c83028">${report.incidentDetail}</div></div></div>`:""}
    ${report.parentNote?`<div class="section"><div class="section-head orange">■ 保護者連絡・引継ぎ事項</div><div class="section-body"><div class="comment-box">${report.parentNote}</div></div></div>`:""}
    ${report.tomorrowNote?`<div class="section"><div class="section-head gray">■ 明日への引継ぎ・準備事項</div><div class="section-body"><div class="comment-box">${report.tomorrowNote}</div></div></div>`:""}
    ${report.managerNote?`<div class="section"><div class="section-head blue">■ 管理者コメント</div><div class="section-body"><div class="comment-box" style="border-left:3px solid #0080b8">${report.managerNote}</div><div style="margin-top:10px;font-size:9pt">管理者: <span style="border-bottom:1px solid #999;display:inline-block;width:100px">&nbsp;</span> 印</div></div></div>`:""}

    <div class="signature-row">
      <div class="sig-box"><div class="sig-label">作成者: ${report.author||""}</div><div class="sig-line">印</div></div>
      <div class="sig-box"><div class="sig-label">管理者確認</div><div class="sig-line">印</div></div>
      <div class="sig-box"><div class="sig-label">確認日: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</div><div class="sig-line"></div></div>
    </div>
    <div style="margin-top:8px;font-size:8pt;color:#999;text-align:right">出力日時: ${new Date().toLocaleString("ja-JP")}</div>
  </div>`;
  printHTML(html, `業務日報_${facilityName}_${report.date}`);
}




const seedShifts = () => {
  const d=new Date(); const y=d.getFullYear(); const m=d.getMonth()+1;
  const days=daysInMonth(y,m); const out={};
  INITIAL_STAFF.forEach(s=>{ out[s.id]={}; for(let i=1;i<=days;i++){
    const dow=new Date(y,m-1,i).getDay();
    const dk=y+"-"+String(m).padStart(2,"0")+"-"+String(i).padStart(2,"0");
    if(dow===0||dow===6){out[s.id][dk]="off";continue;}
    const r=Math.random(); out[s.id][dk]=r<0.6?"C":r<0.75?"A":r<0.85?"B":"off";
  }});
  return out;
};
const seedAtt = () => {
  const d=new Date(); const y=d.getFullYear(); const m=d.getMonth()+1;
  const days=daysInMonth(y,m); const out={};
  INITIAL_USERS.forEach(u=>{ out[u.id]={}; for(let i=1;i<=days;i++){
    const dow=new Date(y,m-1,i).getDay();
    const dk=y+"-"+String(m).padStart(2,"0")+"-"+String(i).padStart(2,"0");
    if(dow===0||dow===6) continue;
    if(Math.random()>0.25) out[u.id][dk]="予定";
  }});
  return out;
};

// ==================== CSS ====================
// ==================== CSS ====================
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&family=DM+Mono:wght@400;500&display=swap');
:root{--bg:#0d0d12;--bg2:#13131a;--bg3:#1c1c26;--bg4:#24242f;--wh:#1e1e2a;--tx:#eeeef5;--tx2:#9898b8;--tx3:#8888aa;--ac:#f07020;--ac2:#ff8a38;--tl:#3aa0d8;--tl2:#52b8f0;--gr:#2caa60;--gr2:#3dc870;--am:#e0a828;--ro:#e03838;--pu:#9048d8;--bd:#28283a;--bda:#38384e;--sh:0 2px 12px rgba(0,0,0,0.6);--sh2:0 6px 28px rgba(0,0,0,0.85);--sidebar-w:230px;--header-h:56px;}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Noto Sans JP',sans-serif;background:var(--bg);color:var(--tx);min-height:100vh;overflow-x:hidden;}
/* ===== APP SHELL ===== */
.app{min-height:100vh;background:var(--bg);}
.app-shell{display:flex;min-height:100vh;}
/* ===== SIDEBAR ===== */
.sidebar{width:var(--sidebar-w);background:var(--bg2);border-right:1px solid var(--bd);position:fixed;top:0;left:0;height:100vh;overflow-y:auto;z-index:300;display:flex;flex-direction:column;scrollbar-width:none;}
.sidebar::-webkit-scrollbar{display:none;}
.sb-brand{padding:16px 18px 14px;border-bottom:1px solid var(--bd);flex-shrink:0;}
.sb-logo{font-size:19px;font-weight:900;color:var(--ac);letter-spacing:1px;line-height:1.2;}
.sb-logo-sub{font-size:10px;color:var(--tx3);font-weight:400;letter-spacing:0;margin-top:3px;}
.sb-fac{margin:10px 12px 4px;padding:8px 11px;background:var(--bg3);border:1px solid var(--bd);border-radius:8px;}
.sb-fac-label{font-size:10px;color:var(--tx3);margin-bottom:2px;}
.sb-fac-name{font-size:13px;font-weight:700;color:var(--tx);}
.sb-section{padding:12px 14px 4px;font-size:9px;font-weight:700;color:var(--tx3);letter-spacing:2px;text-transform:uppercase;}
.sb-item{display:flex;align-items:center;gap:10px;padding:9px 14px;margin:1px 8px;border-radius:8px;cursor:pointer;transition:all .15s;color:var(--tx2);font-size:13px;font-weight:500;position:relative;user-select:none;}
.sb-item:hover{background:var(--bg3);color:var(--tx);}
.sb-item.active{background:rgba(240,112,32,0.14);color:var(--ac);font-weight:700;}
.sb-item.active::before{content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);width:3px;height:20px;background:var(--ac);border-radius:0 3px 3px 0;}
.sb-icon{font-size:15px;flex-shrink:0;width:20px;text-align:center;}
.sb-badge{margin-left:auto;padding:1px 6px;border-radius:10px;background:var(--ro);color:#fff;font-size:9px;font-weight:700;}
.sb-bottom{padding:10px 12px;border-top:1px solid var(--bd);flex-shrink:0;}
.sb-user{display:flex;align-items:center;gap:9px;padding:6px 4px;}
.sb-avatar{width:32px;height:32px;border-radius:50%;background:var(--bg3);border:1px solid var(--bd);display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;}
.sb-user-info{flex:1;min-width:0;}
.sb-user-name{font-size:12px;font-weight:700;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.sb-user-role{font-size:10px;color:var(--tx3);margin-top:1px;}
.sb-logout{padding:5px 9px;background:rgba(224,56,56,0.12);border:1px solid rgba(224,56,56,0.25);border-radius:6px;color:var(--ro);font-size:11px;font-weight:700;cursor:pointer;font-family:'Noto Sans JP',sans-serif;white-space:nowrap;flex-shrink:0;}
.sb-logout:hover{background:rgba(224,56,56,0.22);}
/* OVERLAY for mobile sidebar */
.sb-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:290;}
.sb-overlay.open{display:block;}
/* ===== MAIN AREA ===== */
.main-wrap{margin-left:var(--sidebar-w);flex:1;min-height:100vh;display:flex;flex-direction:column;}
.top-bar{height:var(--header-h);background:var(--bg2);border-bottom:1px solid var(--bd);position:sticky;top:0;z-index:100;display:flex;align-items:center;padding:0 20px;justify-content:space-between;gap:12px;}
.top-bar-left{display:flex;align-items:center;gap:12px;}
.top-bar-title{font-size:15px;font-weight:900;color:var(--tx);}
.top-bar-right{display:flex;align-items:center;gap:10px;}
.top-bar-date{font-size:11px;color:var(--tx3);font-family:'DM Mono',monospace;}
.hmb{display:none;width:38px;height:38px;background:none;border:1px solid var(--bd);border-radius:8px;cursor:pointer;color:var(--tx2);font-size:18px;align-items:center;justify-content:center;flex-shrink:0;}
.main-content{padding:20px;flex:1;}
/* ===== BOTTOM NAV (mobile) ===== */
.bottom-nav{display:none;position:fixed;bottom:0;left:0;right:0;height:62px;background:var(--bg2);border-top:1px solid var(--bd);z-index:250;}
.bn-row{display:flex;height:100%;}
.bn-item{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;color:var(--tx3);font-size:10px;padding:4px 2px;transition:color .15s;position:relative;-webkit-tap-highlight-color:transparent;}
.bn-item.active{color:var(--ac);}
.bn-icon{font-size:20px;line-height:1;}
.bn-badge{position:absolute;top:5px;right:calc(50% - 20px);background:var(--ro);color:#fff;font-size:9px;font-weight:700;padding:1px 4px;border-radius:8px;min-width:14px;text-align:center;}
/* ===== RESPONSIVE ===== */
@media(max-width:768px){
  .sidebar{transform:translateX(-100%);transition:transform .25s cubic-bezier(.4,0,.2,1);}
  .sidebar.open{transform:translateX(0);}
  .main-wrap{margin-left:0;}
  .main-content{padding:12px;padding-bottom:74px;}
  .bottom-nav{display:block;}
  .hmb{display:flex;}
  .top-bar-date{display:none;}
  .hg{grid-template-columns:repeat(2,1fr);}
}
@media(min-width:769px){.bottom-nav{display:none!important;}}
/* ===== WRAP ===== */
.wrap{max-width:980px;margin:0 auto;}
/* ===== LOGIN ===== */
.lw{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;background:radial-gradient(ellipse at 20% 20%,rgba(240,112,32,0.18) 0%,transparent 55%),radial-gradient(ellipse at 80% 80%,rgba(58,160,216,0.12) 0%,transparent 55%),var(--bg);}
.lc{background:var(--bg2);border:1px solid var(--bd);border-radius:16px;padding:38px 30px;width:100%;max-width:400px;box-shadow:var(--sh2);}
.brand{font-size:28px;font-weight:900;text-align:center;margin-bottom:4px;color:var(--ac);letter-spacing:2px;}
.brand span{color:var(--tx2);}
.bsub{font-size:11px;color:var(--tx3);text-align:center;letter-spacing:2px;margin-bottom:26px;}
.fg{margin-bottom:16px;}
.fl{display:block;font-size:11px;font-weight:700;color:var(--tx2);letter-spacing:1px;margin-bottom:6px;}
.fi{width:100%;padding:11px 13px;background:var(--bg3);border:1.5px solid var(--bd);border-radius:8px;color:var(--tx);font-family:'Noto Sans JP',sans-serif;font-size:14px;outline:none;transition:border-color .2s;}
.fi:focus{border-color:var(--ac);}
.fi::placeholder{color:var(--tx3);}
select.fi{appearance:none;cursor:pointer;}
select.fi option{background:var(--bg2);color:var(--tx);}
.bpri{width:100%;padding:13px;background:var(--ac);border:none;border-radius:9px;color:#fff;font-family:'Noto Sans JP',sans-serif;font-size:15px;font-weight:700;cursor:pointer;transition:all .2s;}
.bpri:hover{background:var(--ac2);box-shadow:0 4px 18px rgba(240,112,32,0.45);}
.err{color:var(--ro);font-size:13px;text-align:center;margin-top:10px;}
.hint{font-size:11px;color:var(--tx3);text-align:center;margin-top:14px;line-height:1.7;}
/* ===== NAV (legacy — hidden) ===== */
.nav{display:none!important;}
/* ===== HOME / DASHBOARD ===== */
.hh{padding:16px 0 14px;color:var(--tx);}
.ht{font-size:10px;color:var(--tx3);letter-spacing:2px;font-weight:700;margin-bottom:4px;text-transform:uppercase;}
.hs{font-size:22px;font-weight:900;color:var(--tx);}
.hd{font-size:11px;color:var(--tx3);margin-top:4px;font-family:'DM Mono',monospace;}
.hg{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;padding:10px 0 20px;}
.hc{background:var(--wh);border:1px solid var(--bd);border-radius:12px;padding:16px 14px;cursor:pointer;transition:all .18s;position:relative;overflow:hidden;display:flex;flex-direction:column;gap:7px;box-shadow:var(--sh);}
.hc:hover{transform:translateY(-2px);box-shadow:var(--sh2);border-color:var(--bda);}
.hc::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;}
.c1::before{background:var(--tl);}
.c2::before{background:var(--am);}
.c3::before{background:var(--gr);}
.c4::before{background:#4488cc;}
.c5::before{background:var(--pu);}
.c6::before{background:var(--ro);}
.c7::before{background:var(--tl2);}
.c8::before{background:var(--gr2);}
.c9::before{background:var(--ac);}
.c10::before{background:var(--pu);}
.ci{font-size:26px;}
.ct{font-size:13px;font-weight:700;color:var(--tx);}
.cd2{font-size:10px;color:var(--tx3);line-height:1.4;}
/* ===== PAGE LAYOUT ===== */
.fl-wrap{padding:0 0 30px;}
.fl-hd{display:flex;align-items:center;gap:10px;margin-bottom:16px;}
.bback{padding:7px 13px;background:var(--wh);border:1.5px solid var(--bd);border-radius:7px;color:var(--tx2);font-size:12px;cursor:pointer;font-family:'Noto Sans JP',sans-serif;box-shadow:var(--sh);}
.bback:hover{border-color:var(--ac);color:var(--ac);}
.fl-title{font-size:18px;font-weight:900;color:var(--tx);}
.fc{background:var(--wh);border:1px solid var(--bd);border-radius:12px;padding:18px 16px;box-shadow:var(--sh);}
.slbl{font-size:10px;font-weight:700;color:var(--ac);letter-spacing:2px;margin-bottom:9px;}
.div{border:none;border-top:1.5px solid var(--bd);margin:16px 0;}
.ng{display:grid;grid-template-columns:repeat(auto-fill,minmax(115px,1fr));gap:7px;}
.nb{padding:9px 8px;background:var(--bg3);border:1.5px solid var(--bd);border-radius:8px;color:var(--tx2);font-family:'Noto Sans JP',sans-serif;font-size:12px;font-weight:500;cursor:pointer;transition:all .15s;text-align:center;}
.nb:hover{border-color:var(--ac);background:var(--bg4);}
.nb.s{border-color:var(--ac);background:rgba(240,112,32,0.15);color:var(--ac);font-weight:700;}
.cam{width:100%;max-width:240px;aspect-ratio:4/3;background:var(--bg3);border:2px dashed var(--bda);border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:all .2s;margin:0 auto;gap:6px;}
.cam.cp{border-style:solid;border-color:var(--ac);background:rgba(240,112,32,0.08);}
.ci2{font-size:32px;}
.ct2{font-size:11px;color:var(--tx3);}
.tr{display:flex;align-items:center;gap:10px;}
.ti{width:108px;padding:10px 11px;background:var(--bg3);border:1.5px solid var(--bd);border-radius:8px;color:var(--tx);font-family:'DM Mono',monospace;font-size:18px;font-weight:500;outline:none;text-align:center;}
.ti:focus{border-color:var(--ac);}
.tunit{font-size:14px;color:var(--tx3);}
.togr{display:flex;gap:7px;flex-wrap:wrap;}
.tg{padding:8px 16px;background:var(--bg3);border:1.5px solid var(--bd);border-radius:8px;color:var(--tx2);font-family:'Noto Sans JP',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all .15s;}
.tg.on{border-color:var(--gr);background:rgba(44,170,96,0.15);color:var(--gr);font-weight:700;}
.fta{width:100%;padding:10px 12px;background:var(--bg3);border:1.5px solid var(--bd);border-radius:8px;color:var(--tx);font-family:'Noto Sans JP',sans-serif;font-size:13px;resize:vertical;min-height:64px;outline:none;}
.fta:focus{border-color:var(--ac);}
.bsave{width:100%;padding:13px;background:var(--ac);border:none;border-radius:10px;color:#fff;font-family:'Noto Sans JP',sans-serif;font-size:14px;font-weight:900;cursor:pointer;transition:all .2s;margin-top:6px;}
.bsave:hover{background:var(--ac2);box-shadow:0 4px 14px rgba(240,112,32,0.4);}
.bsave:disabled{background:var(--bda);cursor:not-allowed;}
.succ{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:55vh;gap:12px;text-align:center;padding:20px;}
.si{font-size:54px;}
.st{font-size:20px;font-weight:900;color:var(--ac);}
.sd{color:var(--tx3);font-size:13px;line-height:1.7;}
.sm{font-family:'DM Mono',monospace;font-size:14px;color:var(--gr);}
.ah{padding:16px 0 8px;}
.at{font-size:18px;font-weight:900;margin-bottom:3px;color:var(--tx);}
.as{font-size:12px;color:var(--tx3);}
.sr2{display:flex;gap:8px;padding:0 0 12px;flex-wrap:wrap;}
.sc2{background:var(--wh);border:1px solid var(--bd);border-radius:10px;padding:11px 14px;flex:1;min-width:82px;box-shadow:var(--sh);}
.sn{font-size:22px;font-weight:900;font-family:'DM Mono',monospace;}
.sl{font-size:10px;color:var(--tx3);margin-top:2px;letter-spacing:1px;}
.tabs{display:flex;gap:5px;overflow-x:auto;padding:0 0 10px;scrollbar-width:none;}
.tabs::-webkit-scrollbar{display:none;}
.tab{padding:5px 13px;border-radius:16px;white-space:nowrap;background:var(--bg3);border:1.5px solid var(--bd);color:var(--tx3);font-size:12px;font-weight:700;cursor:pointer;transition:all .2s;font-family:'Noto Sans JP',sans-serif;}
.tab.on{background:var(--ac);border-color:var(--ac);color:#fff;}
.frow{display:flex;gap:7px;flex-wrap:wrap;padding:0 0 9px;}
.fsm{padding:6px 10px;background:var(--bg3);border:1.5px solid var(--bd);border-radius:7px;color:var(--tx);font-family:'Noto Sans JP',sans-serif;font-size:12px;outline:none;}
.fsm:focus{border-color:var(--ac);}
.fsm option{background:var(--bg2);color:var(--tx);}
.ebar{display:flex;gap:7px;flex-wrap:wrap;padding:0 0 10px;}
.bexp{padding:7px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Noto Sans JP',sans-serif;border:1.5px solid var(--tl);background:rgba(58,160,216,0.1);color:var(--tl);}
.bexp:hover{background:rgba(58,160,216,0.22);}
.tw{overflow-x:auto;padding:0 0 16px;}
.tbl{width:100%;border-collapse:collapse;font-size:12px;}
.tbl th{padding:8px 9px;text-align:left;background:var(--bg3);color:var(--tx2);font-size:10px;font-weight:700;letter-spacing:1px;border-bottom:2px solid var(--bd);white-space:nowrap;}
.tbl td{padding:9px 9px;border-bottom:1px solid var(--bd);color:var(--tx);vertical-align:middle;white-space:nowrap;}
.tbl tr:hover td{background:var(--bg3);}
.badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700;}
.bg{background:rgba(44,170,96,0.2);color:var(--gr2);border:1px solid rgba(44,170,96,0.35);}
.ba{background:rgba(224,168,40,0.2);color:var(--am);border:1px solid rgba(224,168,40,0.35);}
.bb{background:rgba(58,160,216,0.2);color:var(--tl);border:1px solid rgba(58,160,216,0.35);}
.br{background:rgba(224,56,56,0.2);color:var(--ro);border:1px solid rgba(224,56,56,0.35);}
.bp{background:rgba(144,72,216,0.2);color:var(--pu);border:1px solid rgba(144,72,216,0.35);}
.bedit{padding:4px 9px;border-radius:5px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Noto Sans JP',sans-serif;background:rgba(58,160,216,0.15);border:1.5px solid var(--tl);color:var(--tl);}
.ov{position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:200;display:flex;align-items:center;justify-content:center;padding:18px;overflow-y:auto;}
.md{background:var(--bg2);border:1px solid var(--bd);border-radius:14px;padding:22px;width:100%;max-width:500px;box-shadow:var(--sh2);}
.mdtit{font-size:15px;font-weight:900;margin-bottom:14px;color:var(--tx);}
.mda{display:flex;gap:9px;justify-content:flex-end;margin-top:16px;}
.bcancel{padding:8px 16px;border-radius:8px;background:var(--bg3);border:1.5px solid var(--bd);color:var(--tx2);font-size:13px;font-weight:700;cursor:pointer;font-family:'Noto Sans JP',sans-serif;}
.bconf{padding:8px 16px;border-radius:8px;background:var(--ac);border:none;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:'Noto Sans JP',sans-serif;}
.bconf:disabled{background:var(--bda);cursor:not-allowed;}
.ch{display:flex;align-items:center;justify-content:space-between;margin-bottom:11px;}
.cm{font-size:15px;font-weight:900;color:var(--tx);}
.cn{padding:5px 11px;background:var(--bg3);border:1.5px solid var(--bd);border-radius:7px;color:var(--tx2);cursor:pointer;font-size:14px;}
.cn:hover{border-color:var(--ac);}
.cgrid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:12px;}
.cdow{text-align:center;font-size:10px;font-weight:700;color:var(--tx3);padding:3px 0;}
.cdow.su{color:var(--ro);}
.cdow.sa{color:var(--tl);}
.cday{aspect-ratio:1;border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;background:var(--bg3);border:1.5px solid var(--bd);font-size:11px;transition:all .15s;gap:2px;color:var(--tx);}
.cday:hover{border-color:var(--ac);background:rgba(240,112,32,0.1);}
.cday.td{border-color:var(--ac);background:rgba(240,112,32,0.15);font-weight:700;}
.cday.sel{border-color:var(--ac2);background:rgba(255,138,56,0.2);font-weight:700;}
.cday.we{background:var(--bg2);border-color:var(--bd);opacity:.45;cursor:default;}
.cday.emp{background:transparent;border-color:transparent;cursor:default;}
.dot{width:5px;height:5px;border-radius:50%;}
.dg{background:var(--gr);}
.da{background:var(--am);}
.dr{background:var(--ro);}
.dots{display:flex;gap:2px;}
.panel{background:var(--wh);border:1px solid var(--bd);border-radius:12px;padding:14px;box-shadow:var(--sh);}
.ptit{font-size:10px;font-weight:700;color:var(--ac);letter-spacing:2px;margin-bottom:9px;}
.urow{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--bd);}
.urow:last-child{border-bottom:none;}
.un{font-size:13px;font-weight:600;color:var(--tx);}
.chips{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:11px;}
.chip{padding:4px 11px;border-radius:12px;font-size:11px;font-weight:700;}
.cg{background:rgba(44,170,96,0.2);color:var(--gr2);border:1px solid rgba(44,170,96,0.35);}
.cr{background:rgba(224,56,56,0.2);color:var(--ro);border:1px solid rgba(224,56,56,0.35);}
.cb2{background:rgba(58,160,216,0.2);color:var(--tl);border:1px solid rgba(58,160,216,0.35);}
.cw{background:var(--bg3);color:var(--tx3);border:1px solid var(--bd);}
.sbtn{padding:3px 9px;border-radius:12px;font-size:11px;font-weight:700;cursor:pointer;border:1.5px solid transparent;transition:all .15s;font-family:'Noto Sans JP',sans-serif;}
.sp{background:rgba(44,170,96,0.2);border-color:rgba(44,170,96,0.35);color:var(--gr2);}
.sab{background:rgba(224,56,56,0.2);border-color:rgba(224,56,56,0.35);color:var(--ro);}
.sc{background:rgba(58,160,216,0.2);border-color:rgba(58,160,216,0.35);color:var(--tl);}
.sn2{background:var(--bg3);border-color:var(--bd);color:var(--tx3);}
.sto{overflow-x:auto;border-radius:10px;border:1px solid var(--bd);background:var(--wh);box-shadow:var(--sh);}
.stbl{border-collapse:collapse;font-size:11px;min-width:100%;}
.stbl th{padding:7px 5px;background:var(--bg3);color:var(--tx2);font-size:9px;font-weight:700;white-space:nowrap;text-align:center;border-bottom:2px solid var(--bd);}
.stbl th.nh{text-align:left;padding-left:11px;position:sticky;left:0;z-index:2;background:var(--bg3);}
.stbl td{padding:3px 2px;border-bottom:1px solid var(--bd);text-align:center;vertical-align:middle;}
.stbl td.nc{text-align:left;padding-left:11px;font-weight:700;font-size:12px;white-space:nowrap;position:sticky;left:0;background:var(--wh);border-right:1px solid var(--bd);color:var(--tx);}
.stbl tr:hover td{background:var(--bg4);}
.scell{width:30px;height:26px;border-radius:4px;font-size:8px;font-weight:700;cursor:pointer;border:1.5px solid transparent;display:flex;align-items:center;justify-content:center;margin:0 auto;transition:all .12s;}
.scell:hover{transform:scale(1.12);}
.scA{background:rgba(58,160,216,0.25);color:var(--tl2);border-color:rgba(58,160,216,0.5);}
.scB{background:rgba(44,170,96,0.25);color:var(--gr2);border-color:rgba(44,170,96,0.5);}
.scC{background:rgba(224,168,40,0.25);color:var(--am);border-color:rgba(224,168,40,0.5);}
.scoff{background:var(--bg3);color:var(--tx3);}
.schol{background:rgba(144,72,216,0.2);color:var(--pu);border-color:rgba(144,72,216,0.4);}
.scP1{background:rgba(231,84,128,0.2);color:#e75480;border-color:rgba(231,84,128,0.4);}
.scP2{background:rgba(232,115,74,0.2);color:#e8734a;border-color:rgba(232,115,74,0.4);}
.scP3{background:rgba(70,130,180,0.2);color:#4682b4;border-color:rgba(70,130,180,0.4);}
.scnone{background:var(--bg2);color:var(--bda);}
.sleg{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:11px;}
.leg{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--tx2);}
.ld{width:9px;height:9px;border-radius:3px;}
.ssum2{display:flex;gap:8px;margin-bottom:11px;flex-wrap:wrap;}
.ss{background:var(--wh);border:1px solid var(--bd);border-radius:8px;padding:8px 12px;min-width:76px;box-shadow:var(--sh);}
.ssn{font-size:18px;font-weight:900;font-family:'DM Mono',monospace;}
.ssl{font-size:10px;color:var(--tx3);margin-top:2px;}
.sogrid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:10px;}
.soBtn{padding:10px 5px;border-radius:9px;font-size:12px;font-weight:700;cursor:pointer;border:1.5px solid var(--bd);background:var(--bg3);color:var(--tx2);font-family:'Noto Sans JP',sans-serif;text-align:center;transition:all .15s;}
.soBtn:hover{border-color:var(--ac);background:rgba(240,112,32,0.1);}
.src{background:var(--wh);border:1px solid var(--bd);border-radius:11px;padding:13px;margin-bottom:8px;cursor:pointer;transition:all .15s;box-shadow:var(--sh);}
.src:hover{border-color:var(--ac);box-shadow:var(--sh2);}
.srh{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:7px;}
.srn{font-size:14px;font-weight:700;color:var(--tx);}
.srd{font-size:10px;color:var(--tx3);font-family:'DM Mono',monospace;}
.srtags{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;}
.srtag{padding:2px 8px;border-radius:9px;font-size:10px;font-weight:700;background:rgba(58,160,216,0.18);color:var(--tl);border:1px solid rgba(58,160,216,0.35);}
.srb{font-size:12px;color:var(--tx2);line-height:1.5;}
.srf{font-size:10px;color:var(--tx3);margin-top:5px;}
.cbg{display:flex;flex-wrap:wrap;gap:6px;}
.cb{padding:6px 11px;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;border:1.5px solid var(--bd);background:var(--bg3);color:var(--tx2);font-family:'Noto Sans JP',sans-serif;transition:all .15s;}
.cb.on{background:rgba(58,160,216,0.18);border-color:var(--tl);color:var(--tl);}
.mr{display:flex;gap:7px;}
.mbtn{width:40px;height:40px;border-radius:50%;font-size:19px;cursor:pointer;border:2px solid var(--bd);background:var(--bg3);display:flex;align-items:center;justify-content:center;transition:all .15s;}
.mbtn.on{border-color:var(--am);background:rgba(224,168,40,0.2);transform:scale(1.15);}
.spbadge{font-size:10px;padding:2px 6px;border-radius:7px;background:rgba(224,56,56,0.2);color:var(--ro);border:1px solid rgba(224,56,56,0.35);font-weight:700;white-space:nowrap;}
.trc{background:var(--wh);border:1px solid var(--bd);border-radius:10px;padding:13px;margin-bottom:7px;box-shadow:var(--sh);}
.trh2{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px;}
.trn{font-size:13px;font-weight:700;color:var(--tx);}
.tra{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px;}
.trb{padding:4px 11px;border-radius:12px;font-size:11px;font-weight:700;cursor:pointer;border:1.5px solid transparent;font-family:'Noto Sans JP',sans-serif;transition:all .15s;}
.trcar{background:rgba(58,160,216,0.2);border-color:rgba(58,160,216,0.35);color:var(--tl);}
.trwalk{background:rgba(44,170,96,0.2);border-color:rgba(44,170,96,0.35);color:var(--gr2);}
.trnone{background:var(--bg3);border-color:var(--bd);color:var(--tx3);}
.mc{background:var(--wh);border:1px solid var(--bd);border-radius:10px;padding:13px;margin-bottom:7px;cursor:pointer;transition:all .15s;box-shadow:var(--sh);}
.mc:hover{border-color:var(--tl);box-shadow:var(--sh2);}
.mc.unr{border-color:var(--ac);border-left:4px solid var(--ac);background:rgba(240,112,32,0.06);}
.mh{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:5px;}
.mfrom{font-size:13px;font-weight:700;color:var(--tx);}
.mtime{font-size:10px;color:var(--tx3);font-family:'DM Mono',monospace;}
.mbody{font-size:12px;color:var(--tx2);line-height:1.5;}
.udot{width:7px;height:7px;border-radius:50%;background:var(--ac);flex-shrink:0;margin-top:3px;}
.bnew{padding:7px 15px;background:var(--tl);border:none;border-radius:8px;color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:'Noto Sans JP',sans-serif;}
.bsend{padding:9px 18px;background:var(--tl);border:none;border-radius:9px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:'Noto Sans JP',sans-serif;white-space:nowrap;}
.isp-card{background:var(--wh);border:1px solid var(--bd);border-radius:11px;padding:14px;margin-bottom:8px;cursor:pointer;transition:all .15s;box-shadow:var(--sh);}
.isp-card:hover{border-color:var(--tl);box-shadow:var(--sh2);}
.isp-name{font-size:15px;font-weight:900;margin-bottom:3px;color:var(--tx);}
.isp-date{font-size:11px;color:var(--tx3);font-family:'DM Mono',monospace;}
.isp-goal{font-size:12px;color:var(--tx2);margin-top:7px;line-height:1.6;}
.progress-bar{width:100%;height:7px;background:var(--bg2);border-radius:4px;overflow:hidden;margin-top:5px;}
.progress-fill{height:100%;border-radius:4px;background:linear-gradient(90deg,var(--tl),var(--gr));transition:width .4s;}
.prog-label{font-size:10px;color:var(--tx3);margin-top:3px;}
.kk-card{background:var(--wh);border:1px solid var(--bd);border-radius:11px;padding:14px;margin-bottom:8px;box-shadow:var(--sh);}
.kk-user{font-size:14px;font-weight:700;margin-bottom:8px;color:var(--tx);}
.kk-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--bd);}
.kk-row:last-child{border-bottom:none;}
.kk-label{font-size:12px;color:var(--tx2);}
.kk-val{font-size:13px;font-weight:700;font-family:'DM Mono',monospace;color:var(--tl);}
.kk-total{background:linear-gradient(135deg,rgba(10,26,50,0.9),rgba(14,56,32,0.9));border:1px solid var(--bd);border-radius:10px;padding:14px;}
.kk-total-label{font-size:11px;color:rgba(255,255,255,0.6);letter-spacing:1px;}
.kk-total-val{font-size:28px;font-weight:900;font-family:'DM Mono',monospace;color:#fff;margin-top:3px;}
.mt-card{background:var(--wh);border:1px solid var(--bd);border-radius:10px;padding:14px;margin-bottom:8px;box-shadow:var(--sh);}
.mt-name{font-size:14px;font-weight:700;margin-bottom:9px;color:var(--tx);}
.mt-row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--bd);font-size:12px;}
.mt-row:last-child{border-bottom:none;}
.mt-key{color:var(--tx3);}
.mt-val{font-weight:700;font-family:'DM Mono',monospace;color:var(--tx);}
.photo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(135px,1fr));gap:10px;margin-bottom:14px;}
.photo-item{background:var(--wh);border:1px solid var(--bd);border-radius:10px;padding:10px;cursor:pointer;transition:all .15s;box-shadow:var(--sh);}
.photo-item:hover{border-color:var(--tl);box-shadow:var(--sh2);}
.photo-thumb{width:100%;aspect-ratio:4/3;background:var(--bg3);border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:26px;margin-bottom:7px;}
.photo-user{font-size:12px;font-weight:700;color:var(--tx);}
.photo-act{font-size:10px;color:var(--ac);margin-top:2px;}
.photo-time{font-size:10px;color:var(--tx3);}
@media(max-width:520px){.hg{gap:8px;}.hc{padding:12px 10px;}.ct{font-size:12px;}.lc{padding:26px 16px;}.ng{grid-template-columns:repeat(auto-fill,minmax(94px,1fr));}}

/* ===== UX改善：タッチターゲット最適化 ===== */
/* 主要ボタン最小52px（指先でも確実に押せる） */
.bsave,.bpri{min-height:52px;font-size:15px;letter-spacing:.5px;}
.bconf{min-height:46px;}
.bback{min-height:40px;display:inline-flex;align-items:center;}
/* タブ・チップ系は最小40px */
.tab,.nb,.tg,.cb{min-height:40px;display:inline-flex;align-items:center;justify-content:center;}
/* ホームカード最小高 */
.hc{min-height:82px;}
/* ===== iOS入力フォームズーム防止 ===== */
/* 16px未満だとiOSが自動ズームしてしまう */
.fi,.fta,.ti,.fsm{font-size:16px;}
@media(max-width:768px){
  .fi,.fta,.ti,.fsm{font-size:16px!important;}
  .hc{min-height:92px;padding:16px 12px;}
  .ci{font-size:28px;}
  .ct{font-size:14px;}
  .bsave{padding:15px;}
  /* スマホでのコンテンツ幅調整 */
  .hg{grid-template-columns:repeat(2,1fr);gap:12px;}
}
/* ===== トーストアニメーション ===== */
@keyframes toastIn{from{opacity:0;transform:translate(-50%,16px);}to{opacity:1;transform:translate(-50%,0);}}
/* ===== アラートカード ===== */
.alert-row{display:flex;align-items:center;gap:12px;padding:13px 15px;border-radius:10px;margin-bottom:7px;cursor:pointer;transition:transform .12s,opacity .12s;-webkit-tap-highlight-color:transparent;}
.alert-row:active{transform:scale(0.98);opacity:.85;}
.alert-warn{background:rgba(240,112,32,0.13);border:1px solid rgba(240,112,32,0.4);}
.alert-info{background:rgba(58,160,216,0.11);border:1px solid rgba(58,160,216,0.35);}
.alert-danger{background:rgba(224,56,56,0.13);border:1px solid rgba(224,56,56,0.4);}
.alert-ok{background:rgba(44,170,96,0.11);border:1px solid rgba(44,170,96,0.35);}
.alert-icon{font-size:20px;flex-shrink:0;width:24px;text-align:center;}
.alert-text{flex:1;font-size:13px;font-weight:700;}
.alert-arrow{font-size:16px;color:var(--tx3);flex-shrink:0;}
/* ===== 現場ダッシュボード ===== */
.dash-section{margin-bottom:18px;}
.dash-title{font-size:10px;font-weight:700;color:var(--tx3);letter-spacing:2px;margin-bottom:9px;text-transform:uppercase;display:flex;align-items:center;gap:6px;}
.stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px;}
.stat-card{background:var(--wh);border:1px solid var(--bd);border-radius:12px;padding:14px 10px;text-align:center;box-shadow:var(--sh);}
.stat-label{font-size:10px;color:var(--tx3);margin-bottom:5px;}
.stat-val{font-size:28px;font-weight:900;font-family:'DM Mono',monospace;line-height:1;}
/* 在所中・来所待ちユーザーバッジ */
.user-tag{display:inline-flex;align-items:center;gap:5px;padding:8px 13px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;transition:all .15s;-webkit-tap-highlight-color:transparent;margin:3px;}
.user-tag:active{transform:scale(0.95);}
.user-tag-in{background:rgba(44,170,96,0.2);color:var(--gr2);border:1px solid rgba(44,170,96,0.4);}
.user-tag-pending{background:rgba(58,160,216,0.15);color:var(--tl);border:1px solid rgba(58,160,216,0.35);}
.user-tag-unrecorded{background:rgba(240,112,32,0.15);color:var(--ac);border:1px solid rgba(240,112,32,0.4);}
/* セクション区切り */
.dash-divider{border:none;border-top:1px solid var(--bd);margin:16px 0;}
/* ===== 優先度カラー統一（全画面共通） ===== */
/* danger=赤 / warn=オレンジ / info=青 / success=緑 */
.alert-danger{background:rgba(224,56,56,0.13);border:1px solid rgba(224,56,56,0.45);}
.alert-warn{background:rgba(240,112,32,0.13);border:1px solid rgba(240,112,32,0.4);}
.alert-info{background:rgba(58,160,216,0.11);border:1px solid rgba(58,160,216,0.35);}
.alert-success{background:rgba(44,170,96,0.13);border:1px solid rgba(44,170,96,0.4);}
.lv-danger{color:var(--ro)!important;}
.lv-warn{color:var(--ac)!important;}
.lv-info{color:var(--tl)!important;}
.lv-success{color:var(--gr)!important;}
/* 残件カード level */
.todo-card.danger{border-color:rgba(224,56,56,0.4);background:rgba(224,56,56,0.06);}
.todo-card.warn{border-color:rgba(240,112,32,0.35);background:rgba(240,112,32,0.05);}
.todo-card.info{border-color:rgba(58,160,216,0.3);background:rgba(58,160,216,0.05);}
.todo-card-count.danger{background:rgba(224,56,56,0.2);color:var(--ro);}
.todo-card-count.warn{background:rgba(240,112,32,0.2);color:var(--ac);}
.todo-card-count.info{background:rgba(58,160,216,0.2);color:var(--tl);}
.todo-name-chip.danger{background:rgba(224,56,56,0.12);color:var(--ro);border-color:rgba(224,56,56,0.3);}
.todo-name-chip.info{background:rgba(58,160,216,0.12);color:var(--tl);border-color:rgba(58,160,216,0.3);}
/* ===== クイック体温ボタン ===== */
.temp-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:6px;}
.temp-btn{padding:11px 4px;border-radius:10px;border:2px solid var(--bd);background:var(--bg);color:var(--tx2);font-size:15px;font-weight:700;cursor:pointer;font-family:'DM Mono',monospace;text-align:center;transition:all .12s;-webkit-tap-highlight-color:transparent;min-height:48px;}
.temp-btn:active{transform:scale(0.92);}
.temp-btn.t-on{border-color:var(--tl);background:rgba(58,160,216,0.22);color:var(--tl);}
.temp-btn.t-warn{border-color:var(--am);background:rgba(224,168,40,0.2);color:var(--am);}
.temp-btn.t-on.t-warn{border-color:var(--am);background:rgba(224,168,40,0.35);color:var(--am);}
.temp-btn.t-danger{border-color:var(--ro);background:rgba(224,56,56,0.2);color:var(--ro);}
.temp-btn.t-on.t-danger{border-color:var(--ro);background:rgba(224,56,56,0.35);color:var(--ro);}
.temp-manual{width:100%;padding:9px 10px;background:var(--bg);border:1.5px solid var(--bd);border-radius:8px;color:var(--tx);font-family:'DM Mono',monospace;font-size:16px;text-align:center;outline:none;margin-top:4px;}
.temp-manual:focus{border-color:var(--tl);}
/* ===== ワンタップ記録 ユーザーカード ===== */
.tap-card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-bottom:24px;}
.tap-card{padding:16px 10px;border-radius:14px;border:2px solid var(--bd);background:var(--wh);text-align:center;cursor:pointer;transition:transform .1s,border-color .1s;box-shadow:var(--sh);-webkit-tap-highlight-color:transparent;user-select:none;}
.tap-card:active{transform:scale(0.95);}
.tap-card.arrived{border-color:var(--gr);background:rgba(44,170,96,0.08);opacity:0.72;cursor:default;}
.tap-card-avatar{font-size:28px;margin-bottom:5px;}
.tap-card-name{font-weight:700;font-size:13px;color:var(--tx);line-height:1.3;}
.tap-card-status{font-size:10px;margin-top:4px;font-weight:700;}
/* QRスキャンボタン */
.qr-scan-btn{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px 20px;border-radius:12px;border:1.5px dashed var(--tl);background:rgba(58,160,216,0.08);color:var(--tl);font-size:14px;font-weight:700;cursor:pointer;font-family:'Noto Sans JP',sans-serif;width:100%;margin-bottom:14px;}
.qr-scan-btn:active{background:rgba(58,160,216,0.18);}
/* ボトムシート */
.bsheet-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.55);z-index:300;display:flex;align-items:flex-end;}
.bsheet{background:var(--wh);border-radius:18px 18px 0 0;padding:20px 20px 32px;width:100%;max-height:82vh;overflow-y:auto;}
.bsheet-hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;}
.bsheet-title{font-size:18px;font-weight:900;color:var(--tx);}
.bsheet-close{background:none;border:none;font-size:22px;cursor:pointer;color:var(--tx3);line-height:1;}
.bsheet-field{margin-bottom:14px;}
.bsheet-label{font-size:11px;font-weight:700;color:var(--tx3);margin-bottom:6px;}
.bsheet-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.bsheet-toggle{display:flex;gap:8px;}
.bsheet-toggle button{flex:1;padding:10px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:'Noto Sans JP',sans-serif;border:2px solid var(--bd);background:var(--bg);color:var(--tx3);transition:all .15s;}
.bsheet-toggle button.on{border-color:var(--tl);background:rgba(58,160,216,0.2);color:var(--tl);}
.bsheet-toggle button.on-ac{border-color:var(--ac);background:rgba(240,112,32,0.15);color:var(--ac);}
/* ===== 今日の残件 ===== */
.todo-card{background:var(--wh);border:1px solid var(--bd);border-radius:12px;padding:14px;margin-bottom:10px;}
.todo-card-hd{display:flex;align-items:center;gap:8px;margin-bottom:8px;}
.todo-card-icon{font-size:18px;}
.todo-card-title{font-size:13px;font-weight:700;color:var(--tx);}
.todo-card-count{margin-left:auto;font-size:11px;font-weight:700;padding:2px 9px;border-radius:9px;background:rgba(240,112,32,0.2);color:var(--ac);}
.todo-names{display:flex;flex-wrap:wrap;gap:5px;}
.todo-name-chip{font-size:11px;padding:3px 9px;border-radius:8px;background:rgba(240,112,32,0.1);color:var(--ac);border:1px solid rgba(240,112,32,0.3);font-weight:700;}
/* ===== 監査モード ===== */
.audit-user-row{background:var(--wh);border:1px solid var(--bd);border-radius:11px;padding:13px;margin-bottom:8px;}
.audit-user-name{font-size:14px;font-weight:700;color:var(--tx);margin-bottom:8px;}
.audit-checks{display:flex;flex-wrap:wrap;gap:6px;}
.audit-check{font-size:11px;padding:4px 11px;border-radius:8px;font-weight:700;}
.audit-ok{background:rgba(44,170,96,0.2);color:var(--gr);border:1px solid rgba(44,170,96,0.4);}
.audit-ng{background:rgba(224,56,56,0.15);color:var(--ro);border:1px solid rgba(224,56,56,0.4);}
.audit-na{background:var(--bg);color:var(--tx3);border:1px solid var(--bd);}
`;


// ==================== STORE ====================
function useStore() {
  // Supabaseからデータ読み込み
  const loadFromSupabase = async (setRecs, setMsgs, setDailyReports, setDynUsers, setDynStaff) => {
    try {
      const [recs, msgs, reports, users, staff] = await Promise.all([
        sbLoad("records"),
        sbLoad("messages"),
        sbLoad("daily_reports"),
        sbLoad("users_data"),
        sbLoad("staff_data"),
      ]);
      if(recs && recs.length > 0) setRecs(recs.map(r => ({...r, ...(r.data||{})})));
      if(msgs && msgs.length > 0) setMsgs(msgs.map(m => {
        // DBカラム名(snake_case) → アプリ変数名(camelCase) のマッピング
        const base = {
          id: m.id,
          userId: m.user_id || m.userId,
          userName: m.user_name || m.userName,
          facilityId: m.facility_id || m.facilityId,
          from: m.from_name || m.from,
          body: m.body,
          time: m.time,
          read: m.read,
          replies: m.replies || [],
        };
        return {...base, ...(m.data||{})};
      }));
      if(reports && reports.length > 0) setDailyReports(reports.map(r => {
        // dataフィールドが存在する場合はそちらを優先、なければDB列を使う
        const d = r.data || {};
        return {
          ...d,
          date: d.date || r.date,
          facilityId: d.facilityId || r.facility_id,
        };
      }));
      if(users && users.length > 0) setDynUsers(p => {
        const sbIds = users.map(u => u.id);
        const existing = p.filter(u => !sbIds.includes(u.id));
        return [...existing, ...users.map(u => { const d=u.data||u; return {...d, dob: d.dob||d.birthDate||""}; })];
      });
      if(staff && staff.length > 0) setDynStaff(p => {
        const sbIds = staff.map(s => s.id);
        const existing = p.filter(s => !sbIds.includes(s.id));
        return [...existing, ...staff.map(s => s.data||s)];
      });
    } catch(e) { console.error("Load error:", e); }
  };

  const [recs, setRecs] = useState(() => {
    const b=new Date();
    const ts=(h,m)=>{const d=new Date(b);d.setHours(h,m,0);return d.toLocaleString("ja-JP");};
    return [
      {id:"r1",type:"staff_in",staffId:"s1",staffName:"田中 美穂",facilityId:"f1",facilityName:"GO HOME",time:ts(8,30),temp:"36.4",photo:true,note:"",createdBy:"田中 美穂",history:[]},
      {id:"r2",type:"staff_in",staffId:"s2",staffName:"佐藤 健太",facilityId:"f1",facilityName:"GO HOME",time:ts(9,0),temp:"36.7",photo:true,note:"",createdBy:"佐藤 健太",history:[]},
      {id:"r3",type:"user_in",userId:"u1",userName:"利用者 A",facilityId:"f1",facilityName:"GO HOME",time:ts(14,10),temp:"36.5",transport:"あり",photo:true,note:"",createdBy:"田中 美穂",history:[]},
      {id:"r4",type:"user_in",userId:"u2",userName:"利用者 B",facilityId:"f1",facilityName:"GO HOME",time:ts(14,25),temp:"36.8",transport:"なし",photo:true,note:"",createdBy:"佐藤 健太",history:[]},
      {id:"r5",type:"service",userId:"u1",userName:"利用者 A",facilityId:"f1",facilityName:"GO HOME",time:ts(16,0),arrival:"14:10",departure:"17:30",items:["個別療育","運動・体操","水分補給"],mood:"😄",bodyNote:"体調良好",supportNote:"集中して取り組めた",specialNote:"",createdBy:"田中 美穂",history:[]},
    ];
  });
  const [hist, setHist] = useState([]);
  const [shifts, setShifts] = useState(() => seedShifts());
  const [att, setAtt2] = useState(() => seedAtt());
  const [msgs, setMsgs] = useState([
    {id:"m1",userId:"u1",userName:"利用者 A",facilityId:"f1",from:"保護者",body:"本日は少し鼻水が出ています。体調に変化があればご連絡ください。",time:"2026/03/28 8:15",read:false,replies:[]},
    {id:"m2",userId:"u2",userName:"利用者 B",facilityId:"f1",from:"保護者",body:"今週は送迎不要です。自力で来所します。",time:"2026/03/27 18:40",read:true,replies:["承知しました！"]},
    {id:"m3",userId:"u4",userName:"利用者 D",facilityId:"f2",from:"保護者",body:"明日の活動内容を教えていただけますか？",time:"2026/03/28 7:50",read:false,replies:[]},
  ]);
  const [trData, setTrData] = useState([
    {id:"t1",userId:"u1",userName:"利用者 A",facilityId:"f1",direction:"来所",driver:"田中 美穂",method:"車",address:"〇〇市△△1-2-3",note:""},
    {id:"t2",userId:"u3",userName:"利用者 C",facilityId:"f1",direction:"来所",driver:"佐藤 健太",method:"車",address:"〇〇市△△4-5-6",note:""},
    {id:"t3",userId:"u1",userName:"利用者 A",facilityId:"f1",direction:"退所",driver:"田中 美穂",method:"車",address:"〇〇市△△1-2-3",note:""},
    {id:"t4",userId:"u3",userName:"利用者 C",facilityId:"f1",direction:"退所",driver:"佐藤 健太",method:"車",address:"〇〇市△△4-5-6",note:""},
  ]);
  // 個別支援計画
  const [isps, setIsps] = useState([
    {id:"isp1",userId:"u1",facilityId:"f1",period:"2026年4月〜2026年9月",createdAt:"2026-03-01",goals:["コミュニケーション能力の向上","運動・身体機能の維持・向上"],longGoal:"友達と一緒に楽しく活動できるようになる",shortGoal:"挨拶や簡単な会話を自発的に行う",support:"ソーシャルスキルトレーニングを週2回実施",evaluation:"月1回モニタリングを実施",progress:45,status:"実施中"},
    {id:"isp2",userId:"u2",facilityId:"f1",period:"2026年4月〜2026年9月",createdAt:"2026-03-01",goals:["学習支援・学力向上","感情調整能力の向上"],longGoal:"学校の勉強についていけるようになる",shortGoal:"集中できる時間を15分以上に延ばす",support:"個別学習支援を週3回実施",evaluation:"月1回モニタリングを実施",progress:30,status:"実施中"},
  ]);
  // 国保連請求データ
  const [kokuho, setKokuho] = useState(() => {
    const d=new Date(); const y=d.getFullYear(); const m=d.getMonth()+1;
    const days=daysInMonth(y,m); const out=[];
    INITIAL_USERS.forEach(u=>{
      const serviceDays=Math.floor(Math.random()*12)+8;
      out.push({id:genId(),userId:u.id,userName:u.name,facilityId:u.facilityId,year:y,month:m,
        serviceDays, transportDays: u.hasTransport ? serviceDays : 0,
        serviceCode:"6612B",unitPrice:530,timeType:"放課後",addons:[],city:"その他",status:"未請求"});
    });
    return out;
  });

  const [facesheets, setFacesheets] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [monitorings, setMonitorings] = useState([]);

  // ===== 請求関連 =====
  // 施設ごとの請求基本設定（地域区分・サービス種別・指定年月日等）
  const [facilityBillingSettings, setFacilityBillingSettings] = useState(()=>{
    try{ const s=localStorage.getItem("gogroup_billing_settings"); return s?JSON.parse(s):{}; }catch(e){return {};}
  });
  const saveFacilityBillingSetting = (facilityId, cfg) => {
    setFacilityBillingSettings(p=>{
      const next={...p,[facilityId]:{...p[facilityId],...cfg}};
      try{localStorage.setItem("gogroup_billing_settings",JSON.stringify(next));}catch(e){}
      return next;
    });
  };
  // 職員体制（施設ID + 年月 → 配置データ）
  const [staffConfigs, setStaffConfigs] = useState(()=>{
    try{ const s=localStorage.getItem("gogroup_staff_configs"); return s?JSON.parse(s):{}; }catch(e){return {};}
  });
  const saveStaffConfig = (facilityId, yearMonth, cfg) => {
    const key=facilityId+"_"+yearMonth;
    setStaffConfigs(p=>{
      const next={...p,[key]:{...p[key],...cfg,facilityId,yearMonth}};
      try{localStorage.setItem("gogroup_staff_configs",JSON.stringify(next));}catch(e){}
      return next;
    });
  };
  const getStaffConfig = (facilityId, yearMonth) => staffConfigs[facilityId+"_"+yearMonth]||null;
  // 月次請求確定ステータス（施設+年月 → confirmed|draft）
  const [billingStatus, setBillingStatus] = useState(()=>{
    try{ const s=localStorage.getItem("gogroup_billing_status"); return s?JSON.parse(s):{}; }catch(e){return {};}
  });
  const saveBillingStatus = (facilityId, yearMonth, status) => {
    const key=facilityId+"_"+yearMonth;
    setBillingStatus(p=>{
      const next={...p,[key]:status};
      try{localStorage.setItem("gogroup_billing_status",JSON.stringify(next));}catch(e){}
      return next;
    });
  };

  const addRec = r => {
    setRecs(p=>[...p,r]);
    sbSave("records", {id: r.id, type: r.type, facility_id: r.facilityId, facility_name: r.facilityName,
      staff_id: r.staffId||null, staff_name: r.staffName||null,
      user_id: r.userId||null, user_name: r.userName||null,
      time: r.time, temp: r.temp||null, transport: r.transport||null,
      photo: r.photo||false, note: r.note||null, data: r});
  };
  const updRec = (id,ch,by,reason) => setRecs(p=>p.map(r=>{
    if(r.id!==id) return r;
    const h={at:nowStr(),by,before:{...r},after:{...r,...ch},reason};
    setHist(h2=>[...h2,{id:genId(),recordId:id,...h}]);
    return {...r,...ch,history:[...(r.history||[]),h]};
  }));
  const setShift = (sid,date,type) => {setShifts(p=>({...p,[sid]:{...(p[sid]||{}),[date]:type}}));sbSave("shifts",{id:sid+"_"+date,staff_id:sid,date:date,shift_type:type});};
  const getShift = (sid,date) => shifts[sid]?.[date]||"none";
  const setAtt = (uid,date,status) => { setAtt2(p=>({...p,[uid]:{...(p[uid]||{}),[date]:status}})); sbSave("att_data",{id:uid+"_"+date,data:{userId:uid,date,status}}); };
  const getAtt = (uid,date) => att[uid]?.[date]||"未定";
  const addMsg = m => {
    setMsgs(p=>[...p,m]);
    sbSave("messages", {id: m.id, user_id: m.userId, user_name: m.userName,
      facility_id: m.facilityId, from_name: m.from, body: m.body,
      time: m.time, read: m.read, replies: m.replies, data: m});
  };
  const replyMsg = (id,txt) => setMsgs(p=>p.map(m=>{
    if(m.id!==id) return m;
    const updated={...m,replies:[...(m.replies||[]),txt],read:true};
    sbSave("messages",{id:updated.id,user_id:updated.userId,user_name:updated.userName,
      facility_id:updated.facilityId,from_name:updated.from,body:updated.body,
      time:updated.time,read:true,replies:updated.replies,data:updated});
    return updated;
  }));
  const markRead = id => setMsgs(p=>p.map(m=>{
    if(m.id!==id||m.read) return m;
    const updated={...m,read:true};
    sbSave("messages",{id:updated.id,user_id:updated.userId,user_name:updated.userName,
      facility_id:updated.facilityId,from_name:updated.from,body:updated.body,
      time:updated.time,read:true,replies:updated.replies||[],data:updated});
    return updated;
  }));
  const updTr = data => { setTrData(data); data.forEach(t=>sbSave("transport_data",{id:t.id,facility_id:t.facilityId||null,data:t})); };
  const addIsp = isp => { setIsps(p=>[...p,isp]); sbSave("isps",{id:isp.id,facility_id:isp.facilityId||null,data:isp}); };
  const updIsp = (id,ch) => setIsps(p=>p.map(x=>{ if(x.id!==id) return x; const u={...x,...ch}; sbSave("isps",{id,facility_id:u.facilityId||null,data:u}); return u; }));
  const updKokuho = (id,ch) => setKokuho(p=>p.map(x=>{ if(x.id!==id) return x; const u={...x,...ch}; sbSave("kokuho_data",{id,facility_id:u.facilityId||null,data:u}); return u; }));
  // 新規請求レコード追加（確定日報から自動生成時に使用）
  const addKokuho = k => { setKokuho(p=>[...p,k]); sbSave("kokuho_data",{id:k.id,facility_id:k.facilityId||null,data:k}); };

  const [dynUsers, setDynUsers] = useState(INITIAL_USERS);
  const [dynStaff, setDynStaff] = useState(INITIAL_STAFF);
  const [dailyReports, setDailyReports] = useState([]);
  const saveFS = fs => { setFacesheets(p=>[...p.filter(x=>x.userId!==fs.userId),fs]); sbSave("facesheets",{id:fs.userId,facility_id:fs.facilityId||null,data:fs}); };
  const addAssessment = a => { setAssessments(p=>[...p,a]); sbSave("assessments",{id:a.id,facility_id:a.facilityId||null,data:a}); };
  const addMonitoring = m => { setMonitorings(p=>[...p,m]); sbSave("monitorings",{id:m.id,facility_id:m.facilityId||null,data:m}); };

  const addDailyReport = r => {
    setDailyReports(p=>[...p.filter(x=>!(x.date===r.date&&x.facilityId===r.facilityId)),r]);
    sbSave("daily_reports", {id: r.date+"_"+r.facilityId, facility_id: r.facilityId, date: r.date, data: r});
  };
  const addUser = u => {
    setDynUsers(p=>[...p,u]);
    sbSave("users_data", {id: u.id, facility_id: u.facilityId, data: u});
  };
  const updUser2 = (id,ch) => {
    setDynUsers(p=>p.map(u=>{
      if(u.id!==id) return u;
      const updated = {...u,...ch};
      sbSave("users_data", {id, facility_id: updated.facilityId, data: updated});
      return updated;
    }));
  };
  const addStaff = s => {
    setDynStaff(p=>[...p,s]);
    sbSave("staff_data", {id: s.id, facility_id: s.facilityId, data: s});
  };
  const updStaff2 = (id,ch) => {
    setDynStaff(p=>p.map(s=>{
      if(s.id!==id) return s;
      const updated = {...s,...ch};
      sbSave("staff_data", {id, facility_id: updated.facilityId, data: updated});
      return updated;
    }));
  };
  const [qualDocs, setQualDocs] = useState([]);
  const addQualDoc = d => { setQualDocs(p=>[...p,d]); sbSave("qual_docs",{id:d.id,facility_id:d.facilityId||null,data:d}); };
  const updQualDoc = (id,ch) => setQualDocs(p=>p.map(d=>{ if(d.id!==id) return d; const u={...d,...ch}; sbSave("qual_docs",{id,facility_id:u.facilityId||null,data:u}); return u; }));
  const delQualDoc = id => { setQualDocs(p=>p.filter(d=>d.id!==id)); sbDelete("qual_docs",id); };
  const delStaff = id => { setDynStaff(p=>p.filter(s=>s.id!==id)); sbDelete("staff_data",id); };
  const delUser = id => { setDynUsers(p=>p.filter(u=>u.id!==id)); sbDelete("users_data",id); };
  const [paidLeaveReqs, setPaidLeaveReqs] = useState([]);
  const addPaidLeaveReq = r => { setPaidLeaveReqs(p=>[...p,r]); sbSave("paid_leave_reqs",{id:r.id,facility_id:r.facilityId||null,data:r}); };const [scheduleData, setScheduleData] = useState({});
  const saveScheduleRow = async (row) => {
    try {
      await fetch(SUPABASE_URL + "/rest/v1/schedules", {
        method: "POST",
        headers: {"apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal"},
        body: JSON.stringify(row)
      });
    } catch(e) {}
  };
  const loadSchedules = async () => {
    try {
      const r = await fetch(SUPABASE_URL + "/rest/v1/schedules?select=*", {headers: {"apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY}});
      if(r.ok) { const rows = await r.json(); if(Array.isArray(rows)){const map={};rows.forEach(row=>{map[row.id]=row;});setScheduleData(map);} }
    } catch(e) {}
  };
  
  const updPaidLeaveReq = (id,ch) => setPaidLeaveReqs(p=>p.map(r=>{ if(r.id!==id) return r; const u={...r,...ch}; sbSave("paid_leave_reqs",{id,facility_id:u.facilityId||null,data:u}); return u; }));
  const [ispDrafts, setIspDrafts] = useState([]);
  const addIspDraft = d => { setIspDrafts(p=>[...p,d]); sbSave("isp_drafts",{id:d.id,facility_id:d.facilityId||null,data:d}); };
  const updIspDraft = (id,ch) => setIspDrafts(p=>p.map(d=>{ if(d.id!==id) return d; const u={...d,...ch}; sbSave("isp_drafts",{id,facility_id:u.facilityId||null,data:u}); return u; }));
  const delIspDraft = id => { setIspDrafts(p=>p.filter(d=>d.id!==id)); sbDelete("isp_drafts",id); };
  // ─── 個別支援計画 統合管理レコード ───
  const [ispRecords, setIspRecords] = useState([]);
  const addIspRecord = r => { setIspRecords(p=>[...p,r]); sbSave("isp_records",{id:r.id,facility_id:r.facilityId||null,data:r}); };
  const updIspRecord = (id,ch) => setIspRecords(p=>p.map(x=>{ if(x.id!==id) return x; const u={...x,...ch}; sbSave("isp_records",{id,facility_id:u.facilityId||null,data:u}); return u; }));
  // ─── 日々のモニタリング蓄積ノート（ISP連携サービス記録から自動生成） ───
  const [monitoringNotes, setMonitoringNotes] = useState([]);
  const addMonitoringNote = n => { setMonitoringNotes(p=>[...p,n]); sbSave("monitoring_notes",{id:n.id,facility_id:n.facilityId||null,data:n}); };
  // 起動時にSupabaseからデータ読み込み
  useEffect(() => {
    loadFromSupabase(setRecs, setMsgs, setDailyReports, setDynUsers, setDynStaff);
    sbLoad("shifts").then(shiftsData => {
      if(shiftsData && shiftsData.length > 0) {
        const newShifts = {};
        shiftsData.forEach(s => {
          if(!newShifts[s.staff_id]) newShifts[s.staff_id] = {};
          newShifts[s.staff_id][s.date] = s.shift_type;
        });
        setShifts(p => ({...p, ...newShifts}));
      }
    });
    loadSchedules();
    sbLoad("facesheets").then(d=>{ if(d?.length) setFacesheets(d.map(x=>x.data||x)); });
    sbLoad("assessments").then(d=>{ if(d?.length) setAssessments(d.map(x=>x.data||x)); });
    sbLoad("monitorings").then(d=>{ if(d?.length) setMonitorings(d.map(x=>x.data||x)); });
    sbLoad("isps").then(d=>{ if(d?.length) setIsps(p=>{ const ids=d.map(x=>x.id); return [...p.filter(x=>!ids.includes(x.id)),...d.map(x=>x.data||x)]; }); });
    sbLoad("paid_leave_reqs").then(d=>{ if(d?.length) setPaidLeaveReqs(d.map(x=>x.data||x)); });
    sbLoad("qual_docs").then(d=>{ if(d?.length) setQualDocs(d.map(x=>x.data||x)); });
    sbLoad("att_data").then(d=>{ if(d?.length){ const map={}; d.forEach(a=>{ const r=a.data||a; if(!map[r.userId]) map[r.userId]={}; map[r.userId][r.date]=r.status; }); setAtt2(p=>({...p,...map})); }});
    sbLoad("transport_data").then(d=>{ if(d?.length) setTrData(d.map(x=>x.data||x)); });
    sbLoad("kokuho_data").then(d=>{ if(d?.length) setKokuho(p=>{ const ids=d.map(x=>x.id); return [...p.filter(x=>!ids.includes(x.id)),...d.map(x=>x.data||x)]; }); });
    sbLoad("isp_drafts").then(d=>{ if(d?.length) setIspDrafts(d.map(x=>x.data||x)); });
    sbLoad("isp_records").then(d=>{ if(d?.length) setIspRecords(d.map(x=>x.data||x)); });
    sbLoad("monitoring_notes").then(d=>{ if(d?.length) setMonitoringNotes(d.map(x=>x.data||x)); });
  }, []);
  // ─── トースト通知 ───
  const [toastMsg, setToastMsg] = useState("");
  const [toastType, setToastType] = useState("success");
  const showToast = (msg, type="success") => {
    setToastMsg(msg); setToastType(type);
    setTimeout(()=>setToastMsg(""), 3000);
  };
  return {recs,addRec,updRec,hist,shifts,setShift,getShift,att,setAtt,getAtt,msgs,addMsg,replyMsg,markRead,trData,updTr,isps,addIsp,updIsp,kokuho,addKokuho,updKokuho,facesheets,saveFS,assessments,addAssessment,monitorings,addMonitoring,dailyReports,addDailyReport,dynUsers,addUser,updUser2,delUser,dynStaff,addStaff,updStaff2,delStaff,paidLeaveReqs,addPaidLeaveReq,updPaidLeaveReq,qualDocs,addQualDoc,updQualDoc,delQualDoc,scheduleData,setScheduleData,saveScheduleRow,ispDrafts,addIspDraft,updIspDraft,delIspDraft,ispRecords,addIspRecord,updIspRecord,monitoringNotes,addMonitoringNote,facilityBillingSettings,saveFacilityBillingSetting,staffConfigs,saveStaffConfig,getStaffConfig,billingStatus,saveBillingStatus,showToast,toastMsg,toastType};
}


// ==================== TIME PICKER（ドラムロール式） ====================
function TimePicker({value, onChange, label=""}){
  const [open, setOpen] = useState(false);
  const [hh, mm] = (value||"00:00").split(":").map(Number);
  const [tmpH, setTmpH] = useState(hh);
  const [tmpM, setTmpM] = useState(mm);
  const hRef = useRef(null);
  const mRef = useRef(null);

  const hours   = Array.from({length:24},(_,i)=>i);
  const minutes = Array.from({length:12},(_,i)=>i*5); // 5分刻み

  const ITEM_H = 44;

  const scrollToCenter = (ref, idx) => {
    if(ref.current) ref.current.scrollTo({top: idx * ITEM_H, behavior:"smooth"});
  };

  useEffect(()=>{
    if(open){
      setTimeout(()=>{
        scrollToCenter(hRef, tmpH);
        // 5分刻みのindexに変換
        const mIdx = minutes.findIndex(m=>m>=tmpM);
        scrollToCenter(mRef, mIdx>=0?mIdx:0);
      }, 50);
    }
  }, [open]);

  const handleScroll = (ref, list, setter) => {
    if(!ref.current) return;
    const idx = Math.round(ref.current.scrollTop / ITEM_H);
    setter(list[Math.max(0, Math.min(idx, list.length-1))]);
  };

  const confirm = () => {
    const hStr = String(tmpH).padStart(2,"0");
    const mStr = String(tmpM).padStart(2,"0");
    onChange(`${hStr}:${mStr}`);
    setOpen(false);
  };

  const displayVal = value ? value : "--:--";

  return <>
    {/* トリガーボタン */}
    <button onClick={()=>{setTmpH(hh);setTmpM(mm);setOpen(true);}}
      style={{display:"flex",alignItems:"center",gap:8,padding:"10px 16px",background:"var(--wh)",border:"1.5px solid var(--bd)",borderRadius:10,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:20,fontWeight:700,color:"var(--tx)",minWidth:120,justifyContent:"center",boxShadow:"var(--sh)",transition:"all .15s"}}
      onMouseEnter={e=>e.currentTarget.style.borderColor="var(--tl)"}
      onMouseLeave={e=>e.currentTarget.style.borderColor="var(--bd)"}>
      <span style={{fontSize:16,marginRight:2}}>🕐</span>
      <span style={{color:value?"var(--tx)":"var(--tx3)"}}>{displayVal}</span>
    </button>

    {/* モーダル */}
    {open && <div style={{position:"fixed",top:0,right:0,bottom:0,left:0,background:"rgba(0,0,0,0.45)",zIndex:300,display:"flex",alignItems:"flex-end",justifyContent:"center"}}
      onClick={e=>e.target===e.currentTarget&&setOpen(false)}>
      <div style={{background:"var(--wh)",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:420,padding:"0 0 24px",boxShadow:"0 -4px 24px rgba(0,0,0,0.18)"}}>
        {/* ヘッダー */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px 12px",borderBottom:"1px solid var(--bg2)"}}>
          <button onClick={()=>setOpen(false)} style={{padding:"6px 16px",borderRadius:8,background:"var(--bg)",border:"1.5px solid var(--bd)",color:"var(--tx2)",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>キャンセル</button>
          <div style={{fontSize:15,fontWeight:900,color:"var(--tx)"}}>{label||"時刻を選択"}</div>
          <button onClick={confirm} style={{padding:"6px 16px",borderRadius:8,background:"var(--tl)",border:"none",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>確定</button>
        </div>

        {/* 選択プレビュー */}
        <div style={{textAlign:"center",padding:"12px 0 8px",fontSize:32,fontWeight:900,fontFamily:"'DM Mono',monospace",color:"var(--tl)",letterSpacing:4}}>
          {String(tmpH).padStart(2,"0")} : {String(tmpM).padStart(2,"0")}
        </div>

        {/* ドラムロール */}
        <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:4,padding:"0 20px",position:"relative"}}>
          {/* 選択ハイライト */}
          <div style={{position:"absolute",top:"50%",left:20,right:20,height:ITEM_H,transform:"translateY(-50%)",background:"rgba(0,128,184,0.08)",borderRadius:10,border:"2px solid rgba(0,128,184,0.2)",pointerEvents:"none",zIndex:1}}/>

          {/* 時 */}
          <div style={{flex:1,position:"relative"}}>
            <div style={{fontSize:10,fontWeight:700,color:"var(--tx3)",textAlign:"center",marginBottom:6,letterSpacing:1}}>時</div>
            <div ref={hRef}
              style={{height:ITEM_H*5,overflowY:"scroll",scrollSnapType:"y mandatory",scrollbarWidth:"none",WebkitOverflowScrolling:"touch"}}
              onScroll={()=>handleScroll(hRef,hours,setTmpH)}>
              <div style={{paddingTop:ITEM_H*2,paddingBottom:ITEM_H*2}}>
                {hours.map(h=><div key={h}
                  style={{height:ITEM_H,display:"flex",alignItems:"center",justifyContent:"center",scrollSnapAlign:"center",fontSize:h===tmpH?26:20,fontWeight:h===tmpH?900:400,fontFamily:"'DM Mono',monospace",color:h===tmpH?"var(--tl)":"var(--tx3)",cursor:"pointer",transition:"all .15s",userSelect:"none"}}
                  onClick={()=>{setTmpH(h);scrollToCenter(hRef,h);}}>
                  {String(h).padStart(2,"0")}
                </div>)}
              </div>
            </div>
          </div>

          <div style={{fontSize:28,fontWeight:900,color:"var(--tl)",paddingTop:20}}>:</div>

          {/* 分 */}
          <div style={{flex:1,position:"relative"}}>
            <div style={{fontSize:10,fontWeight:700,color:"var(--tx3)",textAlign:"center",marginBottom:6,letterSpacing:1}}>分</div>
            <div ref={mRef}
              style={{height:ITEM_H*5,overflowY:"scroll",scrollSnapType:"y mandatory",scrollbarWidth:"none",WebkitOverflowScrolling:"touch"}}
              onScroll={()=>handleScroll(mRef,minutes,v=>{setTmpM(v);})}>
              <div style={{paddingTop:ITEM_H*2,paddingBottom:ITEM_H*2}}>
                {minutes.map((m,idx)=><div key={m}
                  style={{height:ITEM_H,display:"flex",alignItems:"center",justifyContent:"center",scrollSnapAlign:"center",fontSize:m===tmpM?26:20,fontWeight:m===tmpM?900:400,fontFamily:"'DM Mono',monospace",color:m===tmpM?"var(--tl)":"var(--tx3)",cursor:"pointer",transition:"all .15s",userSelect:"none"}}
                  onClick={()=>{setTmpM(m);scrollToCenter(mRef,idx);}}>
                  {String(m).padStart(2,"0")}
                </div>)}
              </div>
            </div>
          </div>
        </div>

        {/* クイック選択 */}
        <div style={{padding:"12px 20px 0"}}>
          <div style={{fontSize:10,fontWeight:700,color:"var(--tx3)",letterSpacing:1,marginBottom:8}}>よく使う時刻</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {["08:00","08:30","09:00","13:00","14:00","14:30","15:00","16:00","17:00","17:30","18:00","19:00"].map(t=><button key={t}
              onClick={()=>{const [h,m]=t.split(":").map(Number);setTmpH(h);setTmpM(m);scrollToCenter(hRef,h);const mIdx=minutes.findIndex(x=>x>=m);scrollToCenter(mRef,mIdx>=0?mIdx:0);}}
              style={{padding:"5px 10px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'DM Mono',monospace",border:"1.5px solid",borderColor:value===t?"var(--tl)":"var(--bd)",background:value===t?"rgba(58,160,216,0.2)":"var(--bg)",color:value===t?"var(--tl)":"var(--tx2)"}}>
              {t}
            </button>)}
          </div>
        </div>
      </div>
    </div>}
  </>;
}

// ==================== COMMON COMPONENTS ====================
function Cam({cap,onCap}){return <div className={`cam ${cap?"cp":""}`} onClick={onCap}><div className="ci2">{cap?"✅":"📷"}</div><div className="ct2">{cap?"撮影済み（再撮影）":"タップして撮影"}</div></div>;}
function FlowWrap({title,onBack,children}){return <div className="fl-wrap"><div className="fl-hd"><button className="bback" onClick={onBack}>← 戻る</button><div className="fl-title">{title}</div></div><div className="fc">{children}</div></div>;}
function LoginScreen({onLogin}){
  const [un,setUn]=useState(""); const [pw,setPw]=useState(""); const [fac,setFac]=useState("f1"); const [err,setErr]=useState("");
  const go=()=>{const a=ACCOUNTS.find(x=>x.username===un&&x.password===pw);if(!a){setErr("IDまたはパスワードが正しくありません");return;}onLogin({...a,selectedFacilityId:a.facilityId||fac});};
  return <div className="lw"><div className="lc"><div className="brand">GO <span>GROUP</span></div><div className="bsub">勤怠・検温・利用記録システム</div>
    <div className="fg"><label className="fl">スタッフID</label><input className="fi" placeholder="homestaff / homemgr / admin" value={un} onChange={e=>{setUn(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&go()}/></div>
    <div className="fg"><label className="fl">パスワード</label><input className="fi" type="password" placeholder="pass" value={pw} onChange={e=>{setPw(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&go()}/></div>
    {un==="admin"&&<div className="fg"><label className="fl">操作する施設</label><select className="fi" value={fac} onChange={e=>setFac(e.target.value)}>{FACILITIES.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></div>}
    <button className="bpri" onClick={go}>ログイン</button>
    {err&&<p className="err">{err}</p>}
    <p className="hint">デモID: homestaff / homemgr / admin</p>
  </div></div>;
}

// ==================== CLOCK IN/OUT ====================
function StaffClockIn({user,onBack,store}){
  // ワンタップ出勤記録 — カードをタップ→ボトムシートで即保存
  const [sheet,setSheet]=useState(null);
  const [temp,setTemp]=useState("");
  const [note,setNote]=useState("");
  const [time,setTime]=useState(nowHM());
  const [done,setDone]=useState(null);

  const staffList=store.dynStaff.filter(s=>s.facilityId===user.selectedFacilityId&&s.active!==false);
  const fac=FACILITIES.find(f=>f.id===user.selectedFacilityId);
  // 今日出勤済みのID
  const clockedIds=[...new Set(store.recs.filter(r=>isTodayRec(r)&&r.type==="staff_in"&&(r.facilityId===user.selectedFacilityId||user.role==="admin")).map(r=>r.staffId))];

  const openSheet=(s)=>{setSheet(s);setTemp("");setNote("");setTime(nowHM());};
  const closeSheet=()=>setSheet(null);
  const save=()=>{
    if(!sheet) return;
    const t=buildDT(time);
    store.addRec({id:genId(),type:"staff_in",staffId:sheet.id,staffName:sheet.name,facilityId:user.selectedFacilityId,facilityName:fac?.name,time:t,temp,photo:true,note,createdBy:user.displayName,history:[]});
    setDone(sheet.name);setSheet(null);
  };

  if(done)return <div className="succ">
    <div className="si">🎉</div>
    <div className="st">出勤登録完了</div>
    <div className="sd">{done} さんの出勤を記録しました</div>
    <div style={{display:"flex",gap:10,marginTop:14}}>
      <button className="bpri" style={{maxWidth:200}} onClick={()=>setDone(null)}>続けて登録</button>
      <button className="bpri" style={{maxWidth:160,background:"rgba(255,255,255,0.1)"}} onClick={onBack}>ホームへ</button>
    </div>
  </div>;

  return <div className="fl-wrap">
    <div className="fl-hd"><button className="bback" onClick={onBack}>← 戻る</button><div className="fl-title">🟢 職員 出勤</div></div>
    <div style={{fontSize:11,color:"var(--tx3)",marginBottom:12,textAlign:"center"}}>職員カードをタップして出勤記録</div>

    {/* 職員カードグリッド */}
    <div className="tap-card-grid">
      {staffList.map(s=>{
        const clocked=clockedIds.includes(s.id);
        return <div key={s.id} className={`tap-card${clocked?" arrived":""}`} onClick={()=>!clocked&&openSheet(s)}>
          <div className="tap-card-avatar">🧑‍💼</div>
          <div className="tap-card-name">{s.name}</div>
          <div className="tap-card-status" style={{color:clocked?"var(--gr)":"var(--tl)"}}>{clocked?"✓ 出勤済":"タップで記録"}</div>
        </div>;
      })}
    </div>

    {/* ボトムシート */}
    {sheet&&<div className="bsheet-overlay" onClick={closeSheet}>
      <div className="bsheet" onClick={e=>e.stopPropagation()}>
        <div className="bsheet-hd">
          <div>
            <div className="bsheet-title">🟢 {sheet.name}</div>
            <div style={{fontSize:11,color:"var(--tx3)",marginTop:2}}>出勤時刻と体温を入力してください</div>
          </div>
          <button className="bsheet-close" onClick={closeSheet}>×</button>
        </div>

        {/* 出勤時刻 */}
        <div className="bsheet-field">
          <div className="bsheet-label">出勤時刻</div>
          <TimePicker value={time} onChange={setTime} label="時刻"/>
        </div>

        {/* クイック体温ボタン（キーボード不要） */}
        <div className="bsheet-field">
          <div className="bsheet-label">体温 <span style={{color:"var(--ro)"}}>*</span>　<span style={{fontSize:10,fontWeight:400,color:"var(--tx3)"}}>タップで即入力</span></div>
          <div className="temp-grid">
            {[["36.0",""],["36.5",""],["37.0","t-warn"],["37.5","t-danger"]].map(([v,cls])=>(
              <button key={v} className={`temp-btn ${cls} ${temp===v?"t-on":""}`} onClick={()=>setTemp(v)}>{v}</button>
            ))}
          </div>
          <input className="temp-manual" type="number" placeholder="その他（手入力）" step="0.1" min="35" max="42" value={temp} onChange={e=>setTemp(e.target.value)}/>
          {temp&&parseFloat(temp)>=37.5&&<div style={{fontSize:11,color:"var(--ro)",fontWeight:700,marginTop:4}}>⚠ 発熱注意（37.5℃以上）</div>}
        </div>

        <button className="bsave" disabled={!temp} style={{marginTop:8,background:parseFloat(temp)>=37.5?"rgba(224,56,56,0.7)":undefined}} onClick={save}>
          ✓ {sheet.name} の出勤を記録する
        </button>
      </div>
    </div>}
  </div>;
}
function StaffClockOut({user,onBack,store}){
  const [sel,setSel]=useState(null);const [cap,setCap]=useState(false);const [temp,setTemp]=useState("");const [note,setNote]=useState("");const [time,setTime]=useState(nowHM());const [done,setDone]=useState(false);const [saved,setSaved]=useState("");
  const staff=store.dynStaff.filter(s=>s.facilityId===user.selectedFacilityId&&s.active!==false);const fac=FACILITIES.find(f=>f.id===user.selectedFacilityId);
  const save=()=>{const t=buildDT(time);store.addRec({id:genId(),type:"staff_out",staffId:sel.id,staffName:sel.name,facilityId:user.selectedFacilityId,facilityName:fac?.name,time:t,temp:temp||"-",photo:true,note,createdBy:user.displayName,history:[]});setSaved(t);setDone(true);};
  if(done)return <div className="succ"><div className="si">👋</div><div className="st">退勤登録完了</div><div className="sd">{sel?.name} さんの退勤を記録しました</div><div className="sm">{saved}</div><button className="bpri" style={{maxWidth:200,marginTop:8}} onClick={onBack}>ホームに戻る</button></div>;
  return <FlowWrap title="🟡 職員 退勤" onBack={onBack}>
    <div className="slbl">STEP 1 — 職員を選択</div><div className="ng">{staff.map(s=><button key={s.id} className={`nb ${sel?.id===s.id?"s":""}`} onClick={()=>setSel(s)}>{s.name}</button>)}</div>
    <hr className="div"/><div className="slbl">STEP 2 — 退勤時刻</div><div className="tr"><TimePicker value={time} onChange={setTime} label="退勤時刻"/></div>
    <hr className="div"/><div className="slbl">STEP 3 — 写真撮影</div><Cam cap={cap} onCap={()=>setCap(!cap)}/>
    <hr className="div"/><div className="slbl">STEP 4 — 体温（任意）</div><div className="tr"><input className="ti" type="number" placeholder="36.5" step="0.1" value={temp} onChange={e=>setTemp(e.target.value)}/><span className="tunit">℃</span></div>
    <hr className="div"/><div className="slbl">備考（任意）</div><textarea className="fta" value={note} onChange={e=>setNote(e.target.value)}/>
    <button className="bsave" disabled={!sel||!time} onClick={save} style={{marginTop:14}}>保存する</button>
  </FlowWrap>;
}
function UserArrive({user,onBack,store}){
  // ワンタップ来所記録 — カードをタップ→ボトムシートで即保存
  const [sheet,setSheet]=useState(null);   // 選択中の利用者
  const [temp,setTemp]=useState("");
  const [tr,setTr]=useState("あり");
  const [note,setNote]=useState("");
  const [time,setTime]=useState(nowHM());
  const [dayType,setDayType]=useState("放課後");
  const [done,setDone]=useState(null);     // 完了した利用者名
  const [scanning,setScanning]=useState(false);
  const [scanErr,setScanErr]=useState("");
  const videoRef=useRef(null);
  const streamRef=useRef(null);

  const users=store.dynUsers.filter(u=>u.facilityId===user.selectedFacilityId&&u.active!==false);
  const fac=FACILITIES.find(f=>f.id===user.selectedFacilityId);
  // 今日来所済みのID
  const arrivedIds=[...new Set(store.recs.filter(r=>isTodayRec(r)&&r.type==="user_in"&&(r.facilityId===user.selectedFacilityId||user.role==="admin")).map(r=>r.userId))];

  const openSheet=(u)=>{
    setSheet(u);setTemp("");setTr("あり");setNote("");setTime(nowHM());setDayType("放課後");
  };
  const closeSheet=()=>setSheet(null);

  const save=()=>{
    if(!sheet) return;
    const t=buildDT(time);
    store.addRec({id:genId(),type:"user_in",userId:sheet.id,userName:sheet.name,facilityId:user.selectedFacilityId,facilityName:fac?.name,time:t,temp,transport:tr,dayType,photo:true,note,createdBy:user.displayName,history:[]});
    setDone(sheet.name);
    setSheet(null);
  };

  // QRスキャン（BarcodeDetector API）
  const startScan=async()=>{
    setScanErr("");
    if(!("BarcodeDetector" in window)){setScanErr("このブラウザはQRスキャン非対応です。リストから選択してください。");return;}
    setScanning(true);
    try{
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});
      streamRef.current=stream;
      if(videoRef.current){videoRef.current.srcObject=stream;await videoRef.current.play();}
      const detector=new window.BarcodeDetector({formats:["qr_code"]});
      const scan=async()=>{
        if(!streamRef.current) return;
        try{
          const codes=await detector.detect(videoRef.current);
          if(codes.length>0){
            const val=codes[0].rawValue;
            stopScan();
            const found=users.find(u=>u.id===val||u.name===val);
            if(found) openSheet(found);
            else setScanErr("対応する利用者が見つかりませんでした（"+val+"）");
          } else { requestAnimationFrame(scan); }
        }catch(e){requestAnimationFrame(scan);}
      };
      requestAnimationFrame(scan);
    }catch(e){setScanning(false);setScanErr("カメラへのアクセスが拒否されました");}
  };
  const stopScan=()=>{
    if(streamRef.current){streamRef.current.getTracks().forEach(t=>t.stop());streamRef.current=null;}
    setScanning(false);
  };

  // 完了画面
  if(done)return <div className="succ">
    <div className="si">🌟</div>
    <div className="st">来所登録完了</div>
    <div className="sd">{done} さんの来所を記録しました</div>
    <div style={{display:"flex",gap:10,marginTop:14}}>
      <button className="bpri" style={{maxWidth:200}} onClick={()=>setDone(null)}>続けて登録</button>
      <button className="bpri" style={{maxWidth:160,background:"rgba(255,255,255,0.1)"}} onClick={onBack}>ホームへ</button>
    </div>
  </div>;

  return <div className="fl-wrap">
    <div className="fl-hd"><button className="bback" onClick={onBack}>← 戻る</button><div className="fl-title">🌟 利用者 来所</div></div>

    {/* QRスキャン */}
    {!scanning
      ? <button className="qr-scan-btn" onClick={startScan}>📷 QRコードでスキャン（ワンタップ）</button>
      : <div style={{position:"relative",borderRadius:14,overflow:"hidden",border:"2px solid var(--tl)",marginBottom:14}}>
          <video ref={videoRef} style={{width:"100%",maxHeight:220,objectFit:"cover",display:"block"}} playsInline muted/>
          <button onClick={stopScan} style={{position:"absolute",top:8,right:8,padding:"6px 14px",borderRadius:8,border:"none",background:"rgba(0,0,0,0.65)",color:"#fff",fontSize:12,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>✕ 停止</button>
          <div style={{position:"absolute",bottom:8,left:0,right:0,textAlign:"center",color:"var(--tl)",fontSize:12,fontWeight:700,textShadow:"0 1px 4px rgba(0,0,0,0.8)"}}>QRコードをカメラに向けてください</div>
        </div>
    }
    {scanErr&&<div style={{fontSize:11,color:"var(--ro)",marginBottom:10,textAlign:"center"}}>{scanErr}</div>}

    <div style={{fontSize:11,color:"var(--tx3)",marginBottom:12,textAlign:"center"}}>— または下のカードをタップ —</div>

    {/* 利用者カードグリッド */}
    <div className="tap-card-grid">
      {users.map(u=>{
        const arrived=arrivedIds.includes(u.id);
        return <div key={u.id} className={`tap-card${arrived?" arrived":""}`} onClick={()=>!arrived&&openSheet(u)}>
          <div className="tap-card-avatar">👤</div>
          <div className="tap-card-name">{u.name}</div>
          <div className="tap-card-status" style={{color:arrived?"var(--gr)":"var(--ac)"}}>{arrived?"✓ 来所済":"タップで記録"}</div>
        </div>;
      })}
    </div>

    {/* ボトムシート */}
    {sheet&&<div className="bsheet-overlay" onClick={closeSheet}>
      <div className="bsheet" onClick={e=>e.stopPropagation()}>
        <div className="bsheet-hd">
          <div>
            <div className="bsheet-title">🌟 {sheet.name}</div>
            <div style={{fontSize:11,color:"var(--tx3)",marginTop:2}}>来所記録を入力してください</div>
          </div>
          <button className="bsheet-close" onClick={closeSheet}>×</button>
        </div>

        {/* 来所時刻 */}
        <div className="bsheet-field">
          <div className="bsheet-label">来所時刻</div>
          <TimePicker value={time} onChange={setTime} label="時刻"/>
        </div>

        {/* クイック体温ボタン（キーボード不要） */}
        <div className="bsheet-field">
          <div className="bsheet-label">体温　<span style={{fontSize:10,fontWeight:400,color:"var(--tx3)"}}>タップで即入力</span></div>
          <div className="temp-grid">
            {[["36.0",""],["36.5",""],["37.0","t-warn"],["37.5","t-danger"]].map(([v,cls])=>(
              <button key={v} className={`temp-btn ${cls} ${temp===v?"t-on":""}`} onClick={()=>setTemp(v)}>{v}</button>
            ))}
          </div>
          <input className="temp-manual" type="number" placeholder="その他（手入力）" step="0.1" min="35" max="42" value={temp} onChange={e=>setTemp(e.target.value)}/>
          {temp&&parseFloat(temp)>=37.5&&<div style={{fontSize:11,color:"var(--ro)",fontWeight:700,marginTop:4}}>⚠ 発熱注意（37.5℃以上）— 保護者連絡を検討してください</div>}
        </div>

        {/* 日区分 + 送迎（2列） */}
        <div className="bsheet-row" style={{marginBottom:14}}>
          <div>
            <div className="bsheet-label">日区分</div>
            <div className="bsheet-toggle" style={{flexDirection:"column",gap:6}}>
              {["放課後","休日"].map(v=><button key={v} className={dayType===v?"on":""} onClick={()=>setDayType(v)} style={{padding:"8px"}}>
                {v==="休日"?"🎌 休日":"🏫 放課後"}
              </button>)}
            </div>
          </div>
          <div>
            <div className="bsheet-label">送迎</div>
            <div className="bsheet-toggle" style={{flexDirection:"column",gap:6}}>
              {["あり","なし"].map(v=><button key={v} className={tr===v?"on-ac":""} onClick={()=>setTr(v)} style={{padding:"8px"}}>
                🚌 送迎{v}
              </button>)}
            </div>
          </div>
        </div>

        <button className="bsave" style={{marginTop:4,background:temp&&parseFloat(temp)>=37.5?"rgba(224,56,56,0.7)":undefined}} onClick={save}>
          ✓ {sheet.name} の来所を記録する
        </button>
      </div>
    </div>}
  </div>;
}
function UserDepart({user,onBack,store}){
  const [sel,setSel]=useState(null);const [cap,setCap]=useState(false);const [tr,setTr]=useState("あり");const [note,setNote]=useState("");const [time,setTime]=useState(nowHM());const [done,setDone]=useState(false);const [saved,setSaved]=useState("");const [dayType,setDayType]=useState("放課後");
  const users=store.dynUsers.filter(u=>u.facilityId===user.selectedFacilityId&&u.active!==false);const fac=FACILITIES.find(f=>f.id===user.selectedFacilityId);
  const save=()=>{const t=buildDT(time);store.addRec({id:genId(),type:"user_out",userId:sel.id,userName:sel.name,facilityId:user.selectedFacilityId,facilityName:fac?.name,time:t,transport:tr,dayType,photo:cap,note,createdBy:user.displayName,history:[]});setSaved(t);setDone(true);};
  if(done)return <div className="succ"><div className="si">🏠</div><div className="st">退所登録完了</div><div className="sd">{sel?.name} さんの退所を記録しました<br/>送迎: {tr}　区分: {dayType}</div><div className="sm">{saved}</div><button className="bpri" style={{maxWidth:200,marginTop:8}} onClick={onBack}>ホームに戻る</button></div>;
  return <FlowWrap title="🏠 利用者 退所" onBack={onBack}>
    <div className="slbl">STEP 1 — 利用者を選択</div><div className="ng">{users.map(u=><button key={u.id} className={`nb ${sel?.id===u.id?"s":""}`} onClick={()=>setSel(u)}>{u.name}</button>)}</div>
    <hr className="div"/><div className="slbl">STEP 2 — 日区分</div>
    <div className="togr">{["放課後","休日"].map(v=><button key={v} className={`tg ${dayType===v?"on":""}`} onClick={()=>setDayType(v)}>{v==="休日"?"🎌 休日":"🏫 放課後"}</button>)}</div>
    <hr className="div"/><div className="slbl">STEP 3 — 退所時刻</div><div className="tr"><TimePicker value={time} onChange={setTime} label="退所時刻"/></div>
    <hr className="div"/><div className="slbl">STEP 4 — 写真（任意）</div><Cam cap={cap} onCap={()=>setCap(!cap)}/>
    <hr className="div"/><div className="slbl">STEP 5 — 送迎</div><div className="togr">{["あり","なし"].map(v=><button key={v} className={`tg ${tr===v?"on":""}`} onClick={()=>setTr(v)}>送迎{v}</button>)}</div>
    <hr className="div"/><div className="slbl">備考（任意）</div><textarea className="fta" value={note} onChange={e=>setNote(e.target.value)}/>
    <button className="bsave" disabled={!sel||!time} onClick={save} style={{marginTop:14}}>保存する</button>
  </FlowWrap>;
}

// ==================== PHOTO RECORD ====================
function PhotoRecord({user,onBack,store}){
  const [mode,setMode]=useState("gallery");const [sel,setSel]=useState(null);const [act,setAct]=useState("");const [cap,setCap]=useState(false);const [cmt,setCmt]=useState("");const [done,setDone]=useState(false);
  const users=store.dynUsers.filter(u=>u.facilityId===user.selectedFacilityId&&u.active!==false);const fac=FACILITIES.find(f=>f.id===user.selectedFacilityId);
  const photos=store.recs.filter(r=>r.type==="photo"&&(user.role==="admin"||r.facilityId===user.selectedFacilityId));
  const save=()=>{store.addRec({id:genId(),type:"photo",userId:sel.id,userName:sel.name,facilityId:user.selectedFacilityId,facilityName:fac?.name,activity:act,photo:true,comment:cmt,time:nowStr(),createdBy:user.displayName,history:[]});setDone(true);};
  const reset=()=>{setDone(false);setMode("gallery");setSel(null);setAct("");setCap(false);setCmt("");};
  if(done)return <div className="succ"><div className="si">📸</div><div className="st">写真記録完了</div><div className="sd">{sel?.name} さんの「{act}」を記録しました</div><div style={{display:"flex",gap:10,marginTop:12}}><button className="bpri" style={{maxWidth:160}} onClick={reset}>続けて撮影</button><button className="bpri" style={{maxWidth:140,background:"rgba(255,255,255,0.1)"}} onClick={onBack}>ホームへ</button></div></div>;
  if(mode==="new")return <FlowWrap title="📸 写真記録" onBack={()=>setMode("gallery")}>
    <div className="slbl">STEP 1 — 利用者を選択</div><div className="ng">{users.map(u=><button key={u.id} className={`nb ${sel?.id===u.id?"s":""}`} onClick={()=>setSel(u)}>{u.name}</button>)}</div>
    <hr className="div"/><div className="slbl">STEP 2 — 活動種別</div><div className="ng">{ACTIVITY_TYPES.map(a=><button key={a} className={`nb ${act===a?"s":""}`} onClick={()=>setAct(a)} style={{fontSize:12}}>{a}</button>)}</div>
    <hr className="div"/><div className="slbl">STEP 3 — 写真撮影 <span style={{fontSize:10,color:"var(--tx3)",fontWeight:400}}>（任意）</span></div><Cam cap={cap} onCap={()=>setCap(!cap)}/>
    <hr className="div"/><div className="slbl">コメント（任意）</div><textarea className="fta" placeholder="活動の様子を記入..." value={cmt} onChange={e=>setCmt(e.target.value)}/>
    <button className="bsave" disabled={!sel||!act} onClick={save} style={{marginTop:14}}>保存する</button>
  </FlowWrap>;
  return <div className="fl-wrap"><div className="fl-hd"><button className="bback" onClick={onBack}>← 戻る</button><div className="fl-title">📸 写真ギャラリー</div></div>
    <div style={{paddingBottom:8,marginBottom:12}}><button className="bsave" onClick={()=>setMode("new")} style={{maxWidth:200}}>＋ 写真を撮影・記録</button></div>
    {photos.length===0?<div style={{textAlign:"center",color:"var(--g6)",padding:"36px 0"}}>写真記録がありません</div>
    :<div className="photo-grid">{photos.map(r=><div key={r.id} className="photo-item"><div className="photo-thumb">📸</div><div className="photo-user">{r.userName}</div><div className="photo-act">{r.activity}</div>{r.comment&&<div style={{fontSize:10,color:"var(--g4)",marginTop:3}}>{r.comment.length>20?r.comment.slice(0,20)+"…":r.comment}</div>}<div className="photo-time">{r.time?.slice(0,16)}</div></div>)}
    </div>}
  </div>;
}

// ==================== ISP連携パネル ====================
// サービス記録入力時にISP情報・5領域・チェックリスト・テンプレートを表示
function IspServicePanel({userId,store,checkedItems,onToggleItem,domains,onToggleDomain,supp,onSuppChange,onAutoNote}){
  const ISP_ACTIVE=["staff_checked","cdsm_approved","manager_confirmed","parent_explained","parent_consented","finalized"];
  const isp=(store.ispRecords||[]).filter(r=>r.userId===userId&&r.docType==="isp_plan"&&ISP_ACTIVE.includes(r.status)).sort((a,b)=>b.createdAt>a.createdAt?1:-1)[0];
  const [tmplCat,setTmplCat]=useState(0);
  const [showSuggest,setShowSuggest]=useState(false);

  if(!isp) return null;
  const c=isp.content||{};
  // ISPのsupportContentを行ごとに分割してチェックリスト項目化
  const supportLines=(c.supportContent||"").split("\n").map(s=>s.replace(/^[①②③④⑤⑥⑦⑧⑨⑩\d\.\-・\s]+/,"").trim()).filter(s=>s.length>3).slice(0,7);
  // 最近のモニタリングノート（直近3件）
  const recentNotes=(store.monitoringNotes||[]).filter(n=>n.userId===userId).sort((a,b)=>b.date>a.date?1:-1).slice(0,3);

  return <div style={{marginBottom:16}}>
    {/* ISP目標バナー */}
    <div style={{background:"rgba(58,160,216,0.09)",border:"1px solid rgba(58,160,216,0.28)",borderRadius:12,padding:"11px 14px",marginBottom:10}}>
      <div style={{fontSize:10,fontWeight:700,color:"var(--tl)",marginBottom:6,letterSpacing:1}}>📋 個別支援計画 連携中</div>
      <div style={{fontSize:13,fontWeight:700,color:"var(--tx)",lineHeight:1.6,marginBottom:8}}>{c.shortGoal||"目標未設定"}</div>
      {/* 5領域バッジ */}
      {c.supportContent&&<div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
        {ISP_DOMAINS.map(d=>{
          const selected=domains.includes(d);
          return <button key={d} onClick={()=>onToggleDomain(d)} style={{padding:"4px 9px",borderRadius:8,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",transition:"all .15s",
            borderColor:selected?"#7030b8":"var(--bd)",background:selected?"rgba(144,72,216,0.2)":"var(--bg)",color:selected?"var(--pu)":"var(--tx3)"}}>
            {d}
          </button>;
        })}
        <span style={{fontSize:10,color:"var(--tx3)",alignSelf:"center",marginLeft:2}}>（タップして関連領域を選択）</span>
      </div>}
      {/* 直近の記録件数 */}
      {recentNotes.length>0&&<div style={{fontSize:10,color:"var(--tx3)"}}>📊 直近の記録：{recentNotes[0].date} — {recentNotes[0].result?.slice(0,20)||"記録あり"}</div>}
    </div>

    {/* 支援内容チェックリスト（ISPから自動生成） */}
    {supportLines.length>0&&<div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:10,padding:"10px 12px",marginBottom:10}}>
      <div style={{fontSize:10,fontWeight:700,color:"var(--tx2)",marginBottom:8,letterSpacing:1}}>✅ 本日の支援（ISPより）</div>
      <div style={{display:"flex",flexDirection:"column",gap:5}}>
        {supportLines.map((line,i)=>{
          const checked=checkedItems.includes(line);
          return <label key={i} style={{display:"flex",alignItems:"flex-start",gap:8,cursor:"pointer",padding:"6px 8px",borderRadius:8,background:checked?"rgba(44,170,96,0.1)":"transparent",border:checked?"1px solid rgba(44,170,96,0.3)":"1px solid transparent",transition:"all .15s"}}>
            <input type="checkbox" checked={checked} onChange={()=>onToggleItem(line)} style={{marginTop:2,width:16,height:16,cursor:"pointer",flexShrink:0}}/>
            <span style={{fontSize:12,color:checked?"var(--gr)":"var(--tx2)",fontWeight:checked?700:400,lineHeight:1.5}}>{line}</span>
          </label>;
        })}
      </div>
    </div>}

    {/* テンプレート文章 */}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:10,padding:"10px 12px",marginBottom:10}}>
      <div style={{fontSize:10,fontWeight:700,color:"var(--tx2)",marginBottom:7,letterSpacing:1}}>⚡ テンプレート挿入</div>
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
        {RECORD_TEMPLATES.map((t,i)=><button key={i} onClick={()=>setTmplCat(i)}
          style={{padding:"4px 10px",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",
            borderColor:tmplCat===i?"var(--tl)":"var(--bd)",background:tmplCat===i?"rgba(58,160,216,0.18)":"var(--bg)",color:tmplCat===i?"var(--tl)":"var(--tx3)"}}>
          {t.icon} {t.cat}
        </button>)}
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
        {RECORD_TEMPLATES[tmplCat].texts.map((txt,i)=><button key={i}
          onClick={()=>onSuppChange(supp?(supp+"\n"+txt):txt)}
          style={{padding:"5px 10px",borderRadius:8,fontSize:11,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"var(--bg2)",border:"1px solid var(--bd)",color:"var(--tx2)",textAlign:"left"}}>
          {txt}
        </button>)}
      </div>
    </div>

    {/* AI自動提案ボタン */}
    <div style={{display:"flex",gap:8,marginBottom:4}}>
      <button onClick={()=>{const note=generateAutoNote(checkedItems,c.shortGoal,null,domains);onSuppChange(note);setShowSuggest(true);}}
        style={{flex:1,padding:"9px",borderRadius:10,background:"rgba(144,72,216,0.12)",color:"var(--pu)",fontWeight:700,fontSize:12,border:"1px solid rgba(144,72,216,0.3)",cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>
        🤖 AI記録を自動生成
      </button>
      {supp&&<button onClick={()=>{const audit=`個別支援計画に基づき支援を実施した。${supp.length>50?supp.slice(0,50)+"…":supp}（記録者確認済み）`;onSuppChange(audit);}}
        style={{flex:1,padding:"9px",borderRadius:10,background:"rgba(240,112,32,0.1)",color:"var(--am)",fontWeight:700,fontSize:12,border:"1px solid rgba(240,112,32,0.3)",cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>
        📎 監査向けに整形
      </button>}
    </div>
    {showSuggest&&<div style={{fontSize:10,color:"var(--tl)",marginBottom:4}}>✅ AI提案を入力欄に反映しました。内容を確認・修正してください。</div>}
  </div>;
}

// ==================== SERVICE RECORD ====================
function ServiceRecord({user,onBack,store}){
  const [mode,setMode]=useState("list");const [sel,setSel]=useState(null);const [its,setIts]=useState([]);const [mood,setMood]=useState("");const [arr,setArr]=useState(nowHM());const [dep,setDep]=useState("");const [body,setBody]=useState("");const [supp,setSupp]=useState("");const [spec,setSpec]=useState("");const [done,setDone]=useState(false);const [view,setView]=useState(null);
  // ISP連携用の追加state
  const [ispDomains,setIspDomains]=useState([]);  // 選択された5領域
  const [ispChecked,setIspChecked]=useState([]); // チェックされた支援項目
  const users=store.dynUsers.filter(u=>u.facilityId===user.selectedFacilityId&&u.active!==false);const fac=FACILITIES.find(f=>f.id===user.selectedFacilityId);
  const recs=store.recs.filter(r=>r.type==="service"&&(user.role==="admin"||r.facilityId===user.selectedFacilityId)).sort((a,b)=>b.time>a.time?1:-1);
  const tog=i=>setIts(p=>p.includes(i)?p.filter(x=>x!==i):[...p,i]);
  const togDomain=d=>setIspDomains(p=>p.includes(d)?p.filter(x=>x!==d):[...p,d]);
  const togChecked=item=>setIspChecked(p=>p.includes(item)?p.filter(x=>x!==item):[...p,item]);
  // 利用者選択時：今日の来所記録から来所時刻を自動取得
  const selectUser=(u)=>{
    setSel(u); setIspDomains([]); setIspChecked([]);
    const todayIn=store.recs.filter(r=>r.type==="user_in"&&r.userId===u.id&&matchDateStr(r.time,todayISO())).sort((a,b)=>b.time>a.time?1:-1)[0];
    if(todayIn) setArr(extractHM2(todayIn.time));
    const todayOut=store.recs.filter(r=>r.type==="user_out"&&r.userId===u.id&&matchDateStr(r.time,todayISO())).sort((a,b)=>b.time>a.time?1:-1)[0];
    if(todayOut) setDep(extractHM2(todayOut.time));
  };
  const matchDateStr=(t,d)=>{ if(!t)return false; const p=d.replace(/-/g,"/"); const [y,mo,dy]=d.split("-"); return t.includes(p)||t.includes(y+"/"+Number(mo)+"/"+Number(dy))||t.startsWith(d); };
  const extractHM2=(t)=>{ if(!t)return""; const m=t.match(/(\d{1,2}:\d{2})/); return m?m[1]:""; };
  const save=()=>{
    // ISP情報を取得してsupportNoteに含める
    const ISP_ACTIVE=["staff_checked","cdsm_approved","manager_confirmed","parent_explained","parent_consented","finalized"];
    const activeIsp=(store.ispRecords||[]).filter(r=>r.userId===sel.id&&r.docType==="isp_plan"&&ISP_ACTIVE.includes(r.status)).sort((a,b)=>b.createdAt>a.createdAt?1:-1)[0];
    const finalSupp=supp||(ispChecked.length>0?generateAutoNote(ispChecked,activeIsp?.content?.shortGoal,mood,ispDomains):"");
    const recId=genId();
    store.addRec({id:recId,type:"service",userId:sel.id,userName:sel.name,facilityId:user.selectedFacilityId,facilityName:fac?.name,time:nowStr(),arrival:arr,departure:dep,items:its,mood,bodyNote:body,supportNote:finalSupp,specialNote:spec,createdBy:user.displayName,history:[],ispLinked:!!activeIsp,ispId:activeIsp?.id||null,ispDomains,ispCheckedItems:ispChecked});
    // モニタリング蓄積ノートを保存
    if(activeIsp){
      store.addMonitoringNote({id:genId(),userId:sel.id,facilityId:user.selectedFacilityId,date:todayISO(),ispId:activeIsp.id,shortGoal:activeIsp.content?.shortGoal||"",checkedItems:ispChecked,domains:ispDomains,note:finalSupp,mood,result:finalSupp.slice(0,80),createdBy:user.displayName,createdAt:nowStr()});
    }
    setDone(true);
  };
  const reset=()=>{setDone(false);setMode("list");setSel(null);setIts([]);setMood("");setBody("");setSupp("");setSpec("");setDep("");setArr(nowHM());setIspDomains([]);setIspChecked([]);};
  if(done)return <div className="succ"><div className="si">📋</div><div className="st">記録完了</div><div className="sd">{sel?.name} さんのサービス提供記録を保存しました</div><div style={{display:"flex",gap:10,marginTop:12}}><button className="bpri" style={{maxWidth:180}} onClick={reset}>続けて入力</button><button className="bpri" style={{maxWidth:150,background:"rgba(255,255,255,0.1)"}} onClick={onBack}>ホームへ</button></div></div>;
  if(view)return <div className="fl-wrap"><div className="fl-hd"><button className="bback" onClick={()=>setView(null)}>← 戻る</button><div className="fl-title">📋 記録詳細</div><button className="bexp" style={{marginLeft:"auto",background:"#fff8f0",borderColor:"var(--ac)",color:"var(--ac)"}} onClick={()=>printServiceRecord(view,fac?.name||"")}>🖨️ 印刷</button></div><div className="fc">
    <div style={{marginBottom:12}}><div style={{fontSize:18,fontWeight:900,marginBottom:3}}>{view.userName} <span style={{fontSize:22}}>{view.mood}</span></div><div style={{fontSize:11,color:"var(--g4)",fontFamily:"'DM Mono',monospace"}}>{view.time}</div></div>
    <hr className="div"/><div className="slbl">在所時間</div><div style={{fontSize:14,fontWeight:700,marginBottom:12,fontFamily:"'DM Mono',monospace"}}>{view.arrival} 〜 {view.departure||"未記入"}</div>
    <div className="slbl">提供サービス</div><div className="srtags" style={{marginBottom:12}}>{view.items?.map(i=><span key={i} className="srtag">{i}</span>)}</div>
    {view.bodyNote&&<><div className="slbl">体調・健康状態</div><div style={{fontSize:12,color:"var(--g2)",marginBottom:12,lineHeight:1.6}}>{view.bodyNote}</div></>}
    {view.supportNote&&<><div className="slbl">支援内容・様子</div><div style={{fontSize:12,color:"var(--g2)",marginBottom:12,lineHeight:1.6}}>{view.supportNote}</div></>}
    {view.specialNote&&<><div className="slbl" style={{color:"var(--ro)"}}>⚠ 特記事項</div><div style={{fontSize:12,color:"var(--ro)",marginBottom:12,lineHeight:1.6}}>{view.specialNote}</div></>}
    <hr className="div"/><div style={{fontSize:11,color:"var(--g4)"}}>記録者: {view.createdBy}</div>
  </div></div>;
  if(mode==="new")return <div className="fl-wrap"><div className="fl-hd"><button className="bback" onClick={()=>setMode("list")}>← 戻る</button><div className="fl-title">📋 サービス提供記録</div></div><div className="fc">
    {/* STEP 1 — 利用者を選択 */}
    <div className="slbl">STEP 1 — 利用者を選択</div>
    <div className="ng">{users.map(u=><button key={u.id} className={`nb ${sel?.id===u.id?"s":""}`} onClick={()=>selectUser(u)}>{u.name}</button>)}</div>

    {/* STEP 2 — 在所時間（来所記録から自動取得） */}
    <hr className="div"/>
    <div className="slbl">STEP 2 — 在所時間 <span style={{fontSize:10,color:"var(--tl)",fontWeight:400}}>(来所記録から自動取得)</span></div>
    <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
      <div style={{display:"flex",alignItems:"center",gap:7}}><span style={{fontSize:11,color:"var(--tx3)"}}>来所</span><TimePicker value={arr} onChange={setArr} label="来所時刻"/></div>
      <span style={{color:"var(--tx3)"}}>〜</span>
      <div style={{display:"flex",alignItems:"center",gap:7}}><span style={{fontSize:11,color:"var(--tx3)"}}>退所</span><TimePicker value={dep} onChange={setDep} label="退所時刻"/></div>
    </div>

    {/* STEP 3 — 今日の様子 */}
    <hr className="div"/>
    <div className="slbl">STEP 3 — 今日の様子</div>
    <div className="mr">{MOODS.map(m=><button key={m} className={`mbtn ${mood===m?"on":""}`} onClick={()=>setMood(m)}>{m}</button>)}</div>

    {/* ISP連携パネル（個別支援計画がある場合に自動表示） */}
    {sel&&<><hr className="div"/>
    <div className="slbl">STEP 4 — 個別支援計画 × 支援記録</div>
    <IspServicePanel userId={sel.id} store={store}
      checkedItems={ispChecked} onToggleItem={togChecked}
      domains={ispDomains} onToggleDomain={togDomain}
      supp={supp} onSuppChange={setSupp} onAutoNote={()=>{}}/></>}

    {/* STEP 5 — 提供サービス */}
    <hr className="div"/>
    <div className="slbl">STEP {sel?"5":"4"} — 提供サービス（複数OK）</div>
    <div className="cbg">{SERVICE_ITEMS.map(i=><button key={i} className={`cb ${its.includes(i)?"on":""}`} onClick={()=>tog(i)}>{i}</button>)}</div>

    {/* 体調・支援記録 */}
    <hr className="div"/>
    <div className="slbl">体調・健康状態</div>
    <textarea className="fta" placeholder="例）体温36.5℃、食欲あり、元気に過ごした" value={body} onChange={e=>setBody(e.target.value)}/>
    <hr className="div"/>
    <div className="slbl">支援内容・様子 <span style={{fontSize:10,color:"var(--tl)",fontWeight:400}}>(テンプレートやAI生成を活用できます)</span></div>
    <textarea className="fta" rows={4} placeholder="支援内容を入力（テンプレート挿入やAI生成ボタンも使えます）" value={supp} onChange={e=>setSupp(e.target.value)}/>
    <hr className="div"/>
    <div className="slbl" style={{color:"var(--ro)"}}>⚠ 特記事項（任意）</div>
    <textarea className="fta" placeholder="例）帰りに転倒、膝に擦り傷あり。保護者に報告済み。" value={spec} onChange={e=>setSpec(e.target.value)} style={{borderColor:"rgba(231,111,81,0.3)"}}/>

    {/* ISP連携バッジ */}
    {ispChecked.length>0&&<div style={{fontSize:11,color:"var(--gr)",fontWeight:700,margin:"8px 0",background:"rgba(44,170,96,0.1)",borderRadius:8,padding:"6px 10px"}}>
      ✅ {ispChecked.length}項目チェック済み — モニタリングに自動蓄積されます
    </div>}

    <button className="bsave" disabled={!sel||!mood||!arr} onClick={save} style={{marginTop:14}}>記録を保存する</button>
  </div></div>;
  return <div className="fl-wrap"><div className="fl-hd"><button className="bback" onClick={onBack}>← 戻る</button><div className="fl-title">📋 サービス提供記録</div></div>
    <div style={{paddingBottom:8}}><button className="bsave" onClick={()=>setMode("new")} style={{maxWidth:220}}>＋ 新しい記録を作成</button></div>
    <div style={{paddingBottom:28}}>{recs.length===0?<div style={{textAlign:"center",color:"var(--g6)",padding:"36px 0",fontSize:13}}>まだ記録がありません</div>:recs.map(r=><div key={r.id} className="src" onClick={()=>setView(r)}><div className="srh"><div><div className="srn">{r.userName} <span style={{fontSize:18}}>{r.mood}</span></div><div className="srd">{r.time} ／ {r.facilityName}</div><div style={{fontSize:10,color:"var(--g4)",marginTop:2}}>在所: {r.arrival}〜{r.departure||"未"}</div></div>{r.specialNote&&<span className="spbadge">特記あり</span>}</div><div className="srtags">{r.items?.slice(0,4).map(i=><span key={i} className="srtag">{i}</span>)}{r.items?.length>4&&<span className="srtag">+{r.items.length-4}</span>}</div>{r.supportNote&&<div className="srb">{r.supportNote.length>60?r.supportNote.slice(0,60)+"…":r.supportNote}</div>}<div className="srf">記録者: {r.createdBy}</div></div>)}
    </div>
  </div>;
}

// ==================== ATTENDANCE ====================
function AttendanceScreen({user,store,onBack}){
  const td=todayISO();const [sel,setSel]=useState(td);const [vm,setVm]=useState(()=>{const d=new Date();return{y:d.getFullYear(),m:d.getMonth()+1};});
  const users=store.dynUsers.filter(u=>u.facilityId===user.selectedFacilityId&&u.active!==false);
  const days=daysInMonth(vm.y,vm.m);const fw=new Date(vm.y,vm.m-1,1).getDay();
  const mk=d=>`${vm.y}-${String(vm.m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const cnt=date=>({p:users.filter(u=>store.getAtt(u.id,date)==="出席").length,a:users.filter(u=>store.getAtt(u.id,date)==="欠席").length,s:users.filter(u=>store.getAtt(u.id,date)==="予定").length});
  const sc=cnt(sel);const STATS=["予定","出席","欠席","未定"];const scls={"出席":"sbtn sp","欠席":"sbtn sab","予定":"sbtn sc","未定":"sbtn sn2"};
  const facName=FACILITIES.find(f=>f.id===user.selectedFacilityId)?.name||"";

  // 日付ごとの区分（放課後/休日）管理
  const dayTypeKey = date => "daytype_"+user.selectedFacilityId+"_"+date;
  const getDayType = date => {
    try { return localStorage.getItem(dayTypeKey(date)) || "放課後"; } catch(e) { return "放課後"; }
  };
  const setDayType = (date, type) => {
    try { localStorage.setItem(dayTypeKey(date), type); } catch(e) {}
  };
  const [dayTypeRefresh, setDayTypeRefresh] = useState(0);
  const currentDayType = getDayType(sel);

  return <div className="fl-wrap"><div className="fl-hd"><button className="bback" onClick={onBack}>← 戻る</button><div className="fl-title">📅 出欠管理</div><button className="bexp" style={{marginLeft:"auto",background:"#fff8f0",borderColor:"var(--ac)",color:"var(--ac)"}} onClick={()=>printAttendance(users,vm,days,store.getAtt,facName)}>🖨️ 印刷</button></div>
    <div><div className="panel" style={{marginBottom:12}}>
      <div className="ch"><button className="cn" onClick={()=>setVm(v=>v.m===1?{y:v.y-1,m:12}:{y:v.y,m:v.m-1})}>‹</button><div className="cm">{vm.y}年 {vm.m}月</div><button className="cn" onClick={()=>setVm(v=>v.m===12?{y:v.y+1,m:1}:{y:v.y,m:v.m+1})}>›</button></div>
      <div className="cgrid">
        {["日","月","火","水","木","金","土"].map((d,i)=><div key={d} className={`cdow ${i===0?"su":""} ${i===6?"sa":""}`}>{d}</div>)}
        {Array.from({length:fw}).map((_,i)=><div key={"e"+i} className="cday emp"/>)}
        {Array.from({length:days}).map((_,i)=>{const d=i+1;const ds=mk(d);const dow=new Date(vm.y,vm.m-1,d).getDay();const we=dow===0||dow===6;const c=cnt(ds);const dtype=getDayType(ds);
          return <div key={d} className={`cday ${ds===td?"td":""} ${ds===sel?"sel":""} ${we?"we":""}`} onClick={()=>!we&&setSel(ds)}>
            <span style={{fontSize:10}}>{d}</span>
            {!we&&dtype==="休日"&&<div style={{fontSize:7,color:"var(--am)",fontWeight:700,lineHeight:1}}>休</div>}
            {!we&&(c.p>0||c.s>0||c.a>0)&&<div className="dots">{c.p>0&&<div className="dot dg"/>}{c.s>0&&<div className="dot da"/>}{c.a>0&&<div className="dot dr"/>}</div>}
          </div>;
        })}
      </div>
    </div>
    <div style={{marginBottom:10}}>
      <div style={{fontSize:14,fontWeight:900,marginBottom:9}}>{dlabel(sel)} の出欠状況</div>
      {/* 放課後/休日 切替 */}
      <div style={{display:"flex",gap:8,marginBottom:10,alignItems:"center"}}>
        <span style={{fontSize:12,fontWeight:700,color:"var(--tx2)"}}>日区分：</span>
        {["放課後","休日"].map(type=>(
          <button key={type} onClick={()=>{setDayType(sel,type);setDayTypeRefresh(p=>p+1);}}
            style={{padding:"6px 16px",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",
              borderColor:currentDayType===type?(type==="休日"?"var(--am)":"var(--tl)"):"var(--bd)",
              background:currentDayType===type?(type==="休日"?"#fff8ec":"rgba(58,160,216,0.2)"):"var(--bg)",
              color:currentDayType===type?(type==="休日"?"var(--am)":"var(--tl)"):"var(--tx3)"}}>
            {type==="休日"?"🎌 休日":"🏫 放課後"}
          </button>
        ))}
        <span style={{fontSize:11,color:currentDayType==="休日"?"var(--am)":"var(--tl)",fontWeight:700,marginLeft:4}}>
          現在：{currentDayType}（{currentDayType==="休日"?"休日単価適用":"放課後単価適用"}）
        </span>
      </div>
      <div className="chips"><div className="chip cg">出席 {sc.p}名</div><div className="chip cr">欠席 {sc.a}名</div><div className="chip cb2">予定 {sc.s}名</div><div className="chip cw">未定 {users.length-sc.p-sc.a-sc.s}名</div></div>
    </div>
    <div className="panel"><div className="ptit">利用者 出欠一覧</div>
      {users.map(u=><div key={u.id} className="urow"><div className="un">{u.name}</div><div style={{display:"flex",gap:4}}>{STATS.map(s=><button key={s} className={store.getAtt(u.id,sel)===s?scls[s]:"sbtn sn2"} onClick={()=>store.setAtt(u.id,sel,s)}>{s}</button>)}</div></div>)}
    </div></div>
  </div>;
}

// ==================== SHIFT ====================
function ShiftScreen({user,store,onBack}){
  const [vm,setVm]=useState(()=>{const d=new Date();return{y:d.getFullYear(),m:d.getMonth()+1};});const [cell,setCell]=useState(null);
  const isMgr=user.role==="manager"||user.role==="admin"; // スタッフは閲覧のみ
  const fStaff=store.dynStaff.filter(s=>user.role==="admin"||s.facilityId===user.selectedFacilityId);
  const days=daysInMonth(vm.y,vm.m);const mk=d=>`${vm.y}-${String(vm.m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const counts={A:0,B:0,C:0,off:0,holiday:0};
  fStaff.forEach(s=>{for(let i=1;i<=days;i++){const t=store.getShift(s.id,mk(i));if(counts[t]!==undefined)counts[t]++;}});
  const dcol=d=>{const dow=new Date(vm.y,vm.m-1,d).getDay();return dow===0?{color:"var(--ro)"}:dow===6?{color:"var(--tl)"}:{};};
  const csv=()=>{const h=["氏名",...Array.from({length:days},(_,i)=>i+1)];const rows=fStaff.map(s=>[s.name,...Array.from({length:days},(_,i)=>store.getShift(s.id,mk(i+1)))]);const c=[h,...rows].map(r=>r.join(",")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["﻿"+c],{type:"text/csv"}));a.download=`shift_${vm.y}${String(vm.m).padStart(2,"0")}.csv`;a.click();};
  // 月間勤務時間計算
  const calcHours=sid=>{const shiftHours={A:9,B:9,C:9,off:0,holiday:0,P1:5,P2:4,P3:4,none:0};let h=0;for(let i=1;i<=days;i++){h+=shiftHours[store.getShift(sid,mk(i))]||0;}return h;};
  return <div className="fl-wrap"><div className="fl-hd"><button className="bback" onClick={onBack}>← 戻る</button><div className="fl-title">📆 シフト管理</div></div>
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}><button className="cn" onClick={()=>setVm(v=>v.m===1?{y:v.y-1,m:12}:{y:v.y,m:v.m-1})}>‹</button><div style={{fontSize:16,fontWeight:900}}>{vm.y}年 {vm.m}月</div><button className="cn" onClick={()=>setVm(v=>v.m===12?{y:v.y+1,m:1}:{y:v.y,m:v.m+1})}>›</button></div>
        <button className="bexp" onClick={csv}>⬇ CSV</button>
        <button className="bexp" style={{background:"#fff8f0",borderColor:"var(--ac)",color:"var(--ac)"}} onClick={()=>printShift(fStaff,vm,days,store.getShift,FACILITIES.find(f=>f.id===user.selectedFacilityId)?.name||"")}>🖨️ 印刷</button>
      </div>
      <div className="sleg">{SHIFT_TYPES.map(s=><div key={s.key} className="leg"><div className="ld" style={{background:s.color,border:"1px solid "+s.text}}/><span>{s.label}（{s.time}）</span></div>)}</div>
      <div className="ssum2">{SHIFT_TYPES.filter(s=>s.key!=="none").map(s=><div key={s.key} className="ss"><div className="ssn" style={{color:s.text}}>{counts[s.key]||0}</div><div className="ssl">{s.label}</div></div>)}</div>
      <div className="sto"><table className="stbl"><thead><tr>
        <th className="nh">職員名</th>
        {Array.from({length:days},(_,i)=>{const d=i+1;const dow=new Date(vm.y,vm.m-1,d).getDay();return <th key={d} style={dcol(d)}>{d}<br/><span style={{fontSize:8}}>{["日","月","火","水","木","金","土"][dow]}</span></th>;})}
        <th style={{whiteSpace:"nowrap",paddingRight:8}}>合計時間</th>
      </tr></thead><tbody>
        {fStaff.map(s=><tr key={s.id}>
          <td className="nc">{s.name}</td>
          {Array.from({length:days},(_,i)=>{const date=mk(i+1);const type=store.getShift(s.id,date);const dow=new Date(vm.y,vm.m-1,i+1).getDay();const we=dow===0||dow===6;
            return <td key={i}><div className={`scell sc${we?"off":type||"none"}`} onClick={()=>!we&&isMgr&&setCell({staffId:s.id,date})} style={{cursor:isMgr&&!we?"pointer":"default"}}>{we?"":type==="none"||!type?"-":type==="off"?"休":type==="holiday"?"有":type==="P1"?"P1":type==="P2"?"P2":type}</div></td>;
          })}
          <td style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"var(--tb)",paddingRight:8}}>{calcHours(s.id)}h</td>
        </tr>)}
      </tbody></table></div>
      {/* 月間勤務表サマリー */}
      <div style={{marginTop:16}}>
        <div style={{fontSize:13,fontWeight:700,marginBottom:10,color:"var(--tl)"}}>📊 月間勤務サマリー</div>
        {fStaff.map(s=>{
          const wdays=Array.from({length:days},(_,i)=>store.getShift(s.id,mk(i+1))).filter(t=>t!=="off"&&t!=="holiday"&&t!=="none").length;
          const offdays=Array.from({length:days},(_,i)=>store.getShift(s.id,mk(i+1))).filter(t=>t==="off").length;
          const holdays=Array.from({length:days},(_,i)=>store.getShift(s.id,mk(i+1))).filter(t=>t==="holiday").length;
          return <div key={s.id} className="mt-card"><div className="mt-name">{s.name}</div>
            <div className="mt-row"><span className="mt-key">出勤日数</span><span className="mt-val" style={{color:"var(--gr)"}}>{wdays}日</span></div>
            <div className="mt-row"><span className="mt-key">公休日数</span><span className="mt-val" style={{color:"var(--g4)"}}>{offdays}日</span></div>
            <div className="mt-row"><span className="mt-key">有休取得</span><span className="mt-val" style={{color:"var(--pu)"}}>{holdays}日</span></div>
            <div className="mt-row"><span className="mt-key">勤務時間（概算）</span><span className="mt-val" style={{color:"var(--tb)"}}>{calcHours(s.id)}h</span></div>
          </div>;
        })}
      </div>
      {cell&&<div className="ov" onClick={e=>e.target===e.currentTarget&&setCell(null)}><div className="md"><div className="mdtit">シフトを設定</div><div style={{fontSize:12,color:"var(--g4)",marginBottom:10}}>{store.dynStaff.find(s=>s.id===cell.staffId)?.name} — {dlabel(cell.date)}</div>
        <div className="sogrid">{SHIFT_TYPES.map(s=><button key={s.key} className="soBtn" style={{borderColor:store.getShift(cell.staffId,cell.date)===s.key?"var(--tl)":"",background:store.getShift(cell.staffId,cell.date)===s.key?s.color:""}} onClick={()=>{store.setShift(cell.staffId,cell.date,s.key);setCell(null);}}>
          <div style={{color:s.text,fontSize:13}}>{s.label}</div><div style={{fontSize:10,color:"var(--g4)",marginTop:2}}>{s.time}</div>
        </button>)}</div>
        <div className="mda"><button className="bcancel" onClick={()=>setCell(null)}>閉じる</button></div>
      </div></div>}
    </div>
  </div>;
}

// ==================== TRANSPORT ====================
function TransportScreen({user,store,onBack}){
  const [dir,setDir]=useState("来所");
  const fac=FACILITIES.find(f=>f.id===user.selectedFacilityId);
  const list=store.trData.filter(t=>t.facilityId===user.selectedFacilityId&&t.direction===dir);
  const METHODS=["車","徒歩","なし"];const mcls={"車":"trb trcar","徒歩":"trb trwalk","なし":"trb trnone"};
  const setMethod=(id,m)=>store.updTr(store.trData.map(t=>t.id===id?{...t,method:m}:t));
  const facNameTr=FACILITIES.find(f=>f.id===user.selectedFacilityId)?.name||"";
  return <div className="fl-wrap"><div className="fl-hd"><button className="bback" onClick={onBack}>← 戻る</button><div className="fl-title">🚌 送迎管理</div><button className="bexp" style={{marginLeft:"auto",background:"#fff8f0",borderColor:"var(--ac)",color:"var(--ac)"}} onClick={()=>printTransport(list,dir,facNameTr)}>🖨️ 印刷</button></div>
    <div>
      <div className="togr" style={{marginBottom:14}}>{["来所","退所"].map(d=><button key={d} className={`tg ${dir===d?"on":""}`} onClick={()=>setDir(d)}>{d}送迎</button>)}</div>
      <div className="panel" style={{marginBottom:12}}><div className="ptit">本日の{dir}送迎一覧 — {fac?.name}</div>
        {list.length===0?<div style={{color:"var(--g6)",fontSize:12,padding:"14px 0"}}>本日の{dir}送迎予定はありません</div>
        :list.map(t=><div key={t.id} className="trc"><div className="trh2"><div><div className="trn">{t.userName}</div><div style={{fontSize:11,color:"var(--g4)",marginTop:3}}>📍 {t.address}</div></div></div>
          <div className="tra">{METHODS.map(m=><button key={m} className={t.method===m?mcls[m]:"trb trnone"} onClick={()=>setMethod(t.id,m)}>{m}</button>)}</div>
          <div style={{fontSize:11,color:"var(--g4)",marginTop:6}}>担当: <strong style={{color:"var(--wh)"}}>{t.driver}</strong>{t.note&&(" ／ "+t.note)}</div>
        </div>)}
      </div>
    </div>
  </div>;
}

// ==================== PARENT MESSAGES (LINE風) ====================
function ParentMessages({user,store,onBack}){
  // 利用者ごとのスレッド表示
  const [selUserId,setSelUserId]=useState(null);
  const [newMode,setNewMode]=useState(false);
  const [newTo,setNewTo]=useState("");
  const [newBody,setNewBody]=useState("");
  const [inputText,setInputText]=useState("");
  const [photoData,setPhotoData]=useState(null);
  const [newPhotoData,setNewPhotoData]=useState(null);
  const msgEndRef=useRef(null);
  const photoInputRef=useRef(null);
  const newPhotoInputRef=useRef(null);

  const allMsgs=store.msgs.filter(m=>user.role==="admin"||m.facilityId===user.selectedFacilityId);
  const facUsers=store.dynUsers.filter(u=>(user.role==="admin"||u.facilityId===user.selectedFacilityId)&&u.active!==false);
  const facName=FACILITIES.find(f=>f.id===user.selectedFacilityId)?.name||"";

  // dynUsersにいないがメッセージにある利用者もスレッド表示対象にする
  const msgUserIds=[...new Set(allMsgs.map(m=>m.userId).filter(Boolean))];
  const allThreadUsers=[...facUsers];
  msgUserIds.forEach(uid=>{
    if(!allThreadUsers.find(u=>u.id===uid)){
      const m=allMsgs.find(x=>x.userId===uid);
      if(m) allThreadUsers.push({id:uid,name:m.userName||uid,facilityId:m.facilityId||user.selectedFacilityId,active:true});
    }
  });

  // 利用者ごとの最新メッセージと未読数を集計（メッセージがある利用者のみ表示）
  const threads=allThreadUsers.map(u=>{
    const uMsgs=allMsgs.filter(m=>m.userId===u.id).sort((a,b)=>a.time>b.time?1:-1);
    const unread=uMsgs.filter(m=>!m.read).length;
    const latest=uMsgs[uMsgs.length-1];
    return {user:u,msgs:uMsgs,unread,latest};
  }).filter(t=>t.msgs.length>0).sort((a,b)=>b.unread-a.unread||(b.latest?.time||"")>(a.latest?.time||"")?1:-1);

  const selThread=threads.find(t=>t.user.id===selUserId);
  const selUser=selThread?.user;

  // 施設→保護者への送信（右吹き出し）と保護者→施設（左吹き出し）を区別
  const isFromFacility=(m)=>m.from&&m.from!=="保護者"&&!m.from.includes("保護者");

  // メッセージ一覧が更新されたら最下部にスクロール
  useEffect(()=>{msgEndRef.current?.scrollIntoView({behavior:"smooth"});},[selUserId,allMsgs.length]);

  // スレッド内でメッセージ送信
  const sendInThread=()=>{
    if(!inputText.trim()&&!photoData) return;
    if(!selUserId) return;
    store.addMsg({
      id:genId(),userId:selUserId,userName:selUser?.name||"",
      facilityId:user.selectedFacilityId,from:user.displayName,
      body:inputText,time:nowStr(),read:true,replies:[],
      ...(photoData?{photoData}:{})
    });
    setInputText("");
    setPhotoData(null);
  };

  // 新規メッセージ送信
  const sendNew=()=>{
    if(!newTo||(!newBody.trim()&&!newPhotoData)) return;
    const u=facUsers.find(x=>x.id===newTo);
    store.addMsg({id:genId(),userId:newTo,userName:u?.name||"",facilityId:user.selectedFacilityId,from:user.displayName,body:newBody,time:nowStr(),read:true,replies:[],
      ...(newPhotoData?{photoData:newPhotoData}:{})
    });
    setNewMode(false);setNewTo("");setNewBody("");setNewPhotoData(null);
    setSelUserId(newTo);
  };

  // ===== 新規作成画面 =====
  if(newMode) return <FlowWrap title="✉️ 新規メッセージ" onBack={()=>setNewMode(false)}>
    <div className="slbl">宛先（利用者）</div>
    <select className="fi" style={{marginBottom:14}} value={newTo} onChange={e=>setNewTo(e.target.value)}>
      <option value="">選択してください</option>
      {facUsers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
    </select>
    <div className="slbl">メッセージ内容</div>
    <textarea className="fta" style={{minHeight:120}} placeholder="保護者へのメッセージを入力..." value={newBody} onChange={e=>setNewBody(e.target.value)}/>
    <input type="file" accept="image/*" ref={newPhotoInputRef} style={{display:"none"}}
      onChange={e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>setNewPhotoData(ev.target.result);r.readAsDataURL(f);e.target.value="";}}/>
    {newPhotoData&&<div style={{margin:"10px 0",position:"relative",display:"inline-block"}}>
      <img src={newPhotoData} alt="" style={{maxWidth:200,maxHeight:160,borderRadius:8,border:"1.5px solid var(--bd)"}}/>
      <button onClick={()=>setNewPhotoData(null)} style={{position:"absolute",top:-8,right:-8,background:"var(--ro)",color:"#fff",border:"none",borderRadius:"50%",width:20,height:20,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>×</button>
    </div>}
    <div style={{display:"flex",gap:8,marginTop:14}}>
      <button onClick={()=>newPhotoInputRef.current?.click()} style={{padding:"9px 14px",background:"var(--bg)",border:"1.5px solid var(--bd)",borderRadius:10,cursor:"pointer",fontSize:18}}>📷</button>
      <button className="bsave" disabled={!newTo||(!newBody.trim()&&!newPhotoData)} onClick={sendNew} style={{flex:1}}>送信する</button>
    </div>
  </FlowWrap>;

  // スレッドを開いたとき・新着時に未読を既読にする（renderではなくeffectで実行）
  useEffect(()=>{
    if(!selUserId) return;
    allMsgs.filter(m=>m.userId===selUserId&&!m.read).forEach(m=>store.markRead(m.id));
  },[selUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ===== チャット画面（利用者スレッド選択時）=====
  if(selUserId&&selUser) {
    const threadMsgs=allMsgs.filter(m=>m.userId===selUserId).sort((a,b)=>a.time>b.time?-1:1).reverse();

    return <div className="fl-wrap" style={{display:"flex",flexDirection:"column",height:"100vh",maxHeight:"100vh"}}>
      {/* ヘッダー */}
      <div className="fl-hd" style={{flexShrink:0}}>
        <button className="bback" onClick={()=>setSelUserId(null)}>← 戻る</button>
        <div style={{flex:1}}>
          <div className="fl-title" style={{marginBottom:0}}>💬 {selUser.name}</div>
          <div style={{fontSize:10,color:"var(--tx3)",marginTop:1}}>{facName} ／ 保護者連絡</div>
        </div>
        <button className="bexp" style={{background:"#fff8f0",borderColor:"var(--ac)",color:"var(--ac)",fontSize:11,padding:"5px 10px"}}
          onClick={()=>{
            const lines=threadMsgs.map(m=>`[${m.time}] ${m.from}: ${m.body}`).join("\n");
            const blob=new Blob(["﻿"+lines],{type:"text/plain"});
            const a=document.createElement("a");a.href=URL.createObjectURL(blob);
            a.download=`連絡帳_${selUser.name}_${todayISO()}.txt`;a.click();
          }}>⬇ 出力</button>
      </div>

      {/* メッセージエリア */}
      <div style={{flex:1,overflowY:"auto",padding:"12px 14px",background:"#eef2f7",display:"flex",flexDirection:"column",gap:10}}>
        {threadMsgs.length===0&&<div style={{textAlign:"center",color:"var(--tx3)",fontSize:13,marginTop:40}}>まだメッセージがありません</div>}
        {threadMsgs.map((m,i)=>{
          const fromFac=isFromFacility(m);
          return <div key={m.id||i} style={{display:"flex",flexDirection:"column",alignItems:fromFac?"flex-end":"flex-start"}}>
            {/* 送信者名 */}
            <div style={{fontSize:10,color:"var(--tx3)",marginBottom:2,paddingLeft:fromFac?0:4,paddingRight:fromFac?4:0}}>
              {fromFac?m.from:"保護者"}
            </div>
            <div style={{display:"flex",alignItems:"flex-end",gap:6,flexDirection:fromFac?"row-reverse":"row"}}>
              {/* アバター */}
              <div style={{width:32,height:32,borderRadius:"50%",background:fromFac?"var(--tl)":"#98a0b0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0,color:"#fff"}}>
                {fromFac?"🏥":"👨‍👩‍👧"}
              </div>
              {/* 吹き出し */}
              <div style={{
                maxWidth:"70%",padding:"9px 13px",borderRadius:fromFac?"16px 4px 16px 16px":"4px 16px 16px 16px",
                background:fromFac?"var(--tl)":"#fff",
                color:fromFac?"#fff":"var(--tx)",
                fontSize:13,lineHeight:1.65,
                boxShadow:"0 1px 3px rgba(0,0,0,0.12)",
                wordBreak:"break-word",whiteSpace:"pre-wrap"
              }}>
                {m.body}
                {m.photoData&&<img src={m.photoData} alt="添付画像" style={{display:"block",maxWidth:200,maxHeight:200,borderRadius:8,marginTop:m.body?8:0,cursor:"pointer"}} onClick={()=>window.open(m.photoData)}/>}
              </div>
              {/* 既読・時刻 */}
              <div style={{fontSize:10,color:"var(--tx3)",flexShrink:0,textAlign:fromFac?"right":"left",minWidth:36}}>
                {fromFac&&<div style={{color:"var(--tl)",fontWeight:700}}>既読</div>}
                <div style={{fontFamily:"'DM Mono',monospace"}}>{m.time?.slice(-5)||""}</div>
              </div>
            </div>
            {/* 返信（旧データとの互換）*/}
            {(m.replies||[]).map((r,ri)=><div key={ri} style={{display:"flex",flexDirection:"column",alignItems:"flex-end",marginTop:6}}>
              <div style={{fontSize:10,color:"var(--tx3)",marginBottom:2,paddingRight:4}}>{user.displayName}</div>
              <div style={{display:"flex",alignItems:"flex-end",gap:6,flexDirection:"row-reverse"}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:"var(--tl)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"#fff"}}>🏥</div>
                <div style={{maxWidth:"70%",padding:"9px 13px",borderRadius:"16px 4px 16px 16px",background:"var(--tl)",color:"#fff",fontSize:13,lineHeight:1.65,boxShadow:"0 1px 3px rgba(0,0,0,0.12)",wordBreak:"break-word"}}>{r}</div>
                <div style={{fontSize:10,color:"var(--tx3)",minWidth:36,textAlign:"right"}}><div style={{color:"var(--tl)",fontWeight:700}}>既読</div></div>
              </div>
            </div>)}
          </div>;
        })}
        <div ref={msgEndRef}/>
      </div>

      {/* 写真プレビュー */}
      {photoData&&<div style={{flexShrink:0,padding:"6px 14px",background:"var(--wh)",borderTop:"1px solid var(--bd)",display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:11,color:"var(--tx3)"}}>添付:</span>
        <div style={{position:"relative",display:"inline-block"}}>
          <img src={photoData} alt="" style={{height:60,maxWidth:100,borderRadius:6,border:"1.5px solid var(--bd)",objectFit:"cover"}}/>
          <button onClick={()=>setPhotoData(null)} style={{position:"absolute",top:-7,right:-7,background:"var(--ro)",color:"#fff",border:"none",borderRadius:"50%",width:18,height:18,fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>×</button>
        </div>
      </div>}

      {/* 入力エリア */}
      <input type="file" accept="image/*" ref={photoInputRef} style={{display:"none"}}
        onChange={e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>setPhotoData(ev.target.result);r.readAsDataURL(f);e.target.value="";}}/>
      <div style={{flexShrink:0,padding:"10px 12px",background:"var(--wh)",borderTop:"1px solid var(--bd)",display:"flex",gap:8,alignItems:"flex-end"}}>
        <button onClick={()=>photoInputRef.current?.click()}
          style={{padding:"8px",background:"var(--bg)",border:"1.5px solid var(--bd)",borderRadius:10,cursor:"pointer",fontSize:18,flexShrink:0,height:40,width:40,display:"flex",alignItems:"center",justifyContent:"center"}}>📷</button>
        <textarea
          style={{flex:1,border:"1.5px solid var(--bd)",borderRadius:12,padding:"9px 12px",fontSize:13,fontFamily:"'Noto Sans JP',sans-serif",resize:"none",lineHeight:1.5,background:"var(--bg)",color:"var(--tx)",outline:"none",maxHeight:120,minHeight:40}}
          placeholder="メッセージを入力..."
          value={inputText}
          onChange={e=>setInputText(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendInThread();}}}
          rows={1}
        />
        <button onClick={sendInThread} disabled={!inputText.trim()&&!photoData}
          style={{padding:"9px 16px",background:(inputText.trim()||photoData)?"var(--tl)":"var(--bd)",border:"none",borderRadius:12,color:"#fff",fontSize:13,fontWeight:700,cursor:(inputText.trim()||photoData)?"pointer":"default",fontFamily:"'Noto Sans JP',sans-serif",flexShrink:0,transition:"background .15s"}}>
          送信
        </button>
      </div>
    </div>;
  }

  // ===== スレッド一覧画面 =====
  const totalUnread=allMsgs.filter(m=>!m.read).length;
  return <div className="fl-wrap">
    <div className="fl-hd">
      <button className="bback" onClick={onBack}>← 戻る</button>
      <div className="fl-title">
        💬 保護者連絡
        {totalUnread>0&&<span style={{fontSize:11,background:"var(--ro)",color:"#fff",borderRadius:9,padding:"1px 7px",marginLeft:6}}>{totalUnread}件未読</span>}
      </div>
      <button className="bnew" style={{marginLeft:"auto",fontSize:12,padding:"6px 12px"}} onClick={()=>setNewMode(true)}>＋ 新規</button>
    </div>

    {threads.length===0
      ?<div style={{textAlign:"center",color:"var(--tx3)",padding:"48px 0",fontSize:13}}>利用者が登録されていません</div>
      :<div style={{display:"flex",flexDirection:"column",gap:0}}>
        {threads.map(({user:u,msgs:uMsgs,unread,latest})=><div key={u.id}
          onClick={()=>setSelUserId(u.id)}
          style={{display:"flex",alignItems:"center",gap:12,padding:"13px 14px",background:"var(--wh)",borderBottom:"1px solid var(--bd)",cursor:"pointer",transition:"background .1s"}}
          onMouseEnter={e=>e.currentTarget.style.background="var(--bg)"}
          onMouseLeave={e=>e.currentTarget.style.background="var(--wh)"}
        >
          {/* アバター */}
          <div style={{width:46,height:46,borderRadius:"50%",background:unread>0?"var(--tl)":"#c0c8d8",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0,color:"#fff",fontWeight:700}}>
            {u.name?.[0]||"?"}
          </div>
          {/* テキスト */}
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
              <div style={{fontWeight:700,fontSize:14,color:"var(--tx)"}}>{u.name}</div>
              <div style={{fontSize:10,color:"var(--tx3)",fontFamily:"'DM Mono',monospace",flexShrink:0,marginLeft:8}}>
                {latest?.time?.slice(0,10)||""}
              </div>
            </div>
            <div style={{fontSize:12,color:"var(--tx2)",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>
              {latest?`${isFromFacility(latest)?"施設":"保護者"}: ${latest.body}`:"メッセージなし"}
            </div>
          </div>
          {/* 未読バッジ */}
          {unread>0&&<div style={{minWidth:20,height:20,borderRadius:10,background:"var(--ro)",color:"#fff",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,padding:"0 5px"}}>
            {unread}
          </div>}
          <div style={{color:"var(--bd)",fontSize:14}}>›</div>
        </div>)}
      </div>
    }
  </div>;
}

// ==================== 個別支援計画 ====================

// ==================== 利用者登録・編集フォーム ====================

// ===== 共通フォームコンポーネント（関数外で定義） =====
function FormSection({title, color="var(--tl)", children}) {
  return (
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:16,marginBottom:12,boxShadow:"var(--sh)"}}>
      <div style={{fontSize:11,fontWeight:700,color:color,letterSpacing:2,marginBottom:12,paddingBottom:8,borderBottom:"2px solid "+color}}>{title}</div>
      {children}
    </div>
  );
}

function FormField({label, fkey, placeholder="", required=false, type="text", options=null, half=false, form, upd, errors={}}) {
  return (
    <div style={{marginBottom:12, ...(half?{display:"inline-block",width:"calc(50% - 6px)",marginRight:12}:{})}}>
      <label style={{display:"block",fontSize:10,fontWeight:700,color:"var(--tx2)",letterSpacing:1,marginBottom:5}}>
        {label}{required&&<span style={{color:"var(--ro)",marginLeft:3}}>*</span>}
      </label>
      {options
        ? <select className="fi" value={form[fkey]||""} onChange={e=>upd(fkey,e.target.value)}>
            {options.map(o=><option key={o.value||o} value={o.value||o}>{o.label||o}</option>)}
          </select>
        : <input className="fi" type={type} value={form[fkey]||""} placeholder={placeholder}
            onChange={e=>upd(fkey,e.target.value)}
            style={errors[fkey]?{borderColor:"var(--ro)"}:{}}/>
      }
      {errors[fkey]&&<div style={{fontSize:10,color:"var(--ro)",marginTop:3}}>{errors[fkey]}</div>}
    </div>
  );
}

function RegisterUser({init, isEdit, user, store, onBack, onSave}){
  const [form, setForm] = useState({...init});
  const upd = (k,v) => setForm(p=>({...p,[k]:v}));
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if(!form.name?.trim()) e.name = "氏名は必須です";
    if(!form.dob) e.dob = "生年月日は必須です";
    if(!form.facilityId) e.facilityId = "施設は必須です";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if(!validate()) return;
    onSave(form);
  };

  // FormSection・FormFieldは外部定義を使用
  return (
    <div className="fl-wrap">
      <div className="fl-hd">
        <button className="bback" onClick={onBack}>← 戻る</button>
        <div className="fl-title">{isEdit?"✏️ 利用者情報 編集":"➕ 利用者 新規登録"}</div>
      </div>

      {/* 基本情報 */}
      <FormSection title="■ 基本情報" color="var(--tl)">
        <FormField form={form} upd={upd} errors={errors}  label="氏名（フルネーム）" fkey="name" placeholder="山田 花子" required/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
          <FormField form={form} upd={upd} errors={errors}  label="生年月日" fkey="dob" type="date" required/>
          <FormField form={form} upd={upd} errors={errors}  label="性別" fkey="gender" options={[{value:"",label:"選択してください"},{value:"男",label:"男"},{value:"女",label:"女"},{value:"その他",label:"その他"}]}/>
        </div>
        <FormField form={form} upd={upd} errors={errors}  label="所属施設" fkey="facilityId" required
          options={[{value:"",label:"選択してください"},...FACILITIES.map(f=>({value:f.id,label:f.name}))]}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
          <FormField form={form} upd={upd} errors={errors}  label="診断名" fkey="diagnosis" placeholder="自閉スペクトラム症"/>
          <FormField form={form} upd={upd} errors={errors}  label="障害種別・等級" fkey="disabilityGrade" placeholder="療育手帳 B1"/>
        </div>
        <div style={{marginBottom:12}}>
          <label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",letterSpacing:1,display:"block",marginBottom:7}}>送迎</label>
          <div style={{display:"flex",gap:8}}>
            {["あり","なし"].map(v=><button key={v} onClick={()=>upd("hasTransport",v==="あり")}
              style={{padding:"8px 20px",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",borderColor:(form.hasTransport&&v==="あり")||(!form.hasTransport&&v==="なし")?"var(--tl)":"var(--bd)",background:(form.hasTransport&&v==="あり")||(!form.hasTransport&&v==="なし")?"rgba(58,160,216,0.2)":"var(--bg)",color:(form.hasTransport&&v==="あり")||(!form.hasTransport&&v==="なし")?"var(--tl)":"var(--tx3)"}}>
              送迎{v}
            </button>)}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
          <FormField form={form} upd={upd} errors={errors}  label="利用開始日" fkey="enrollDate" type="date"/>
          <FormField form={form} upd={upd} errors={errors}  label="利用状況" fkey="active"
            options={[{value:true,label:"在籍中"},{value:false,label:"退所・無効"}]}/>
        </div>
      </FormSection>

      {/* 受給者証情報 */}
      <FormSection title="■ 受給者証情報" color="var(--pu)">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
          <FormField form={form} upd={upd} errors={errors}  label="受給者証番号" fkey="jukyushaNo" placeholder="0000000000" required/>
          <FormField form={form} upd={upd} errors={errors}  label="有効期限" fkey="jukyushaExpiry" type="date"/>
        </div>
        <FormField form={form} upd={upd} errors={errors}  label="支給自治体（市区町村）" fkey="jukyushaCity" placeholder="○○市"/>
        {/* 受給者証コピー */}
        <div style={{marginBottom:8}}>
          <label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",letterSpacing:1,display:"block",marginBottom:6}}>受給者証コピー</label>
          <div style={{border:"2px dashed var(--bd)",borderRadius:10,padding:16,background:"var(--bg)",textAlign:"center"}}>
            {form.jukyushaCopy
              ? <div style={{color:"var(--gr)",fontWeight:700,fontSize:13}}>
                  <div style={{fontSize:28,marginBottom:5}}>✅</div>
                  コピー済み（登録済み）
                  <button onClick={()=>upd("jukyushaCopy",false)} style={{display:"block",margin:"8px auto 0",padding:"4px 12px",borderRadius:7,fontSize:11,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"rgba(224,56,56,0.15)",border:"1px solid rgba(224,56,56,0.4)",color:"var(--ro)",fontWeight:700}}>削除</button>
                </div>
              : <div>
                  <div style={{fontSize:28,marginBottom:6,opacity:.4}}>📄</div>
                  <div style={{fontSize:12,color:"var(--tx3)",marginBottom:10}}>受給者証のコピーを撮影・登録します</div>
                  <button onClick={()=>upd("jukyushaCopy",true)} style={{padding:"9px 20px",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"var(--tl)",border:"none",color:"#fff"}}>📷 コピーを撮影・登録</button>
                </div>
            }
          </div>
          {form.jukyushaCopy&&<div style={{marginTop:8,fontSize:11,color:"var(--tx3)",display:"flex",gap:8,flexWrap:"wrap"}}>
            <span style={{padding:"3px 9px",borderRadius:8,background:"rgba(44,170,96,0.2)",color:"var(--gr)",fontWeight:700,fontSize:10}}>✅ コピー登録済</span>
            <span style={{fontSize:11,color:"var(--tx3)"}}>登録日: {todayISO()}</span>
          </div>}
        </div>
      </FormSection>

      {/* 保護者情報 */}
      <FormSection title="■ 保護者情報" color="var(--ac)">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
          <FormField form={form} upd={upd} errors={errors}  label="保護者氏名" fkey="parentName" placeholder="山田 次郎"/>
          <FormField form={form} upd={upd} errors={errors}  label="続柄" fkey="parentRelation" options={["母","父","祖母","祖父","その他"].map(v=>({value:v,label:v}))}/>
          <FormField form={form} upd={upd} errors={errors}  label="連絡先（携帯）" fkey="parentTel" placeholder="090-XXXX-XXXX" type="tel"/>
          <FormField form={form} upd={upd} errors={errors}  label="緊急連絡先" fkey="emergencyTel" placeholder="090-XXXX-XXXX" type="tel"/>
        </div>
        <FormField form={form} upd={upd} errors={errors}  label="住所" fkey="address" placeholder="○○市△△1-2-3"/>
      </FormSection>

      {/* 学校情報 */}
      <FormSection title="■ 学校情報" color="var(--gr)">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
          <FormField form={form} upd={upd} errors={errors}  label="学校名" fkey="school" placeholder="○○小学校 特別支援学級"/>
          <FormField form={form} upd={upd} errors={errors}  label="学年" fkey="schoolYear" placeholder="4年生"/>
          <FormField form={form} upd={upd} errors={errors}  label="担任・支援員" fkey="schoolContact" placeholder="鈴木 先生"/>
        </div>
      </FormSection>

      {/* 医療情報 */}
      <FormSection title="■ 医療情報" color="var(--ro)">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
          <FormField form={form} upd={upd} errors={errors}  label="医療機関名" fkey="medicalInstitution" placeholder="○○クリニック"/>
          <FormField form={form} upd={upd} errors={errors}  label="主治医" fkey="doctor" placeholder="田中 医師"/>
        </div>
        <div style={{marginBottom:12}}>
          <label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",letterSpacing:1,display:"block",marginBottom:5}}>服薬状況</label>
          <textarea className="fta" style={{minHeight:56}} placeholder="例）リスパダール 0.5mg 朝・夕食後" value={form.medications||""} onChange={e=>upd("medications",e.target.value)}/>
        </div>
        <div style={{marginBottom:12}}>
          <label style={{fontSize:10,fontWeight:700,color:"var(--ro)",letterSpacing:1,display:"block",marginBottom:5}}>⚠ アレルギー・禁忌事項</label>
          <textarea className="fta" style={{minHeight:56,borderColor:"rgba(200,48,40,0.3)"}} placeholder="例）卵アレルギー（重篤）" value={form.allergies||""} onChange={e=>upd("allergies",e.target.value)}/>
        </div>
      </FormSection>

      {/* 備考 */}
      <FormSection title="■ 備考" color="var(--tx3)">
        <textarea className="fta" style={{minHeight:72}} placeholder="その他、支援員が把握すべき情報" value={form.note||""} onChange={e=>upd("note",e.target.value)}/>
      </FormSection>

      {/* 無効化（編集時のみ） */}
      {isEdit&&<div style={{background:"rgba(224,56,56,0.08)",border:"1px solid rgba(224,56,56,0.4)",borderRadius:11,padding:14,marginBottom:12}}>
        <div style={{fontSize:11,fontWeight:700,color:"var(--ro)",marginBottom:8}}>⚠ 利用状況の変更</div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>upd("active",true)} style={{padding:"8px 18px",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",borderColor:form.active!==false?"rgba(44,170,96,0.4)":"var(--bd)",background:form.active!==false?"rgba(44,170,96,0.2)":"var(--bg)",color:form.active!==false?"var(--gr)":"var(--tx3)"}}>在籍中</button>
          <button onClick={()=>upd("active",false)} style={{padding:"8px 18px",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",borderColor:form.active===false?"rgba(224,56,56,0.4)":"var(--bd)",background:form.active===false?"rgba(224,56,56,0.15)":"var(--bg)",color:form.active===false?"var(--ro)":"var(--tx3)"}}>退所・無効</button>
        </div>
      </div>}

      <div style={{display:"flex",gap:10,paddingBottom:32}}>
        <button className="bsave" style={{background:"var(--bg)",color:"var(--tx2)",border:"1.5px solid var(--bd)"}} onClick={onBack}>キャンセル</button>
        <button className="bsave" style={{flex:2}} onClick={handleSave}>{isEdit?"変更を保存する":"登録する"}</button>
      </div>
    </div>
  );
}

// ==================== 利用者管理（フェイスシート・アセスメント・個別支援計画・モニタリング） ====================

// --- マスターデータ定数 ---
const ASSESSMENT_AREAS = [
  {key:"comm",label:"コミュニケーション",items:["言葉で意思を伝えられる","他者の話を聞ける","挨拶ができる","困ったとき助けを求められる","感情を言葉で表現できる"]},
  {key:"social",label:"社会性・対人関係",items:["友達と一緒に遊べる","ルールを守れる","順番を待てる","他者の気持ちを考えられる","集団活動に参加できる"]},
  {key:"daily",label:"日常生活スキル",items:["着替えができる","食事が自立している","排泄が自立している","整理整頓ができる","時間を守れる"]},
  {key:"learning",label:"学習・認知",items:["読み書きができる","数の概念を理解している","指示を理解して行動できる","集中して取り組める（15分以上）","学習意欲がある"]},
  {key:"motor",label:"運動・身体",items:["走る・跳ぶ等の基本運動ができる","手先の細かい作業ができる","姿勢保持ができる","体力がある","感覚過敏がない"]},
  {key:"emotion",label:"情緒・行動",items:["気持ちのコントロールができる","切り替えがスムーズ","パニックが少ない","自己肯定感がある","行動の見通しが持てる"]},
];
const LEVEL_LABELS = ["1 できない","2 援助あればできる","3 だいたいできる","4 できる","5 得意"];
const MONITORING_ITEMS = ["目標の達成度","支援方法の適切さ","本人の意欲・取組み状況","家族の意見・要望","次期目標の方向性"];

function UserManagement({user,store,onBack}){
  const [screen,setScreen]=useState("list"); // list | hub | facesheet | assessment | isp | monitoring
  const [selUser,setSelUser]=useState(null);
  const [hubTab,setHubTab]=useState("facesheet");
  const users=store.dynUsers.filter(u=>user.role==="admin"||u.facilityId===user.selectedFacilityId);

  const isMgr = user.role==="manager"||user.role==="admin";
  // ===== ユーザー選択画面 =====
  if(screen==="list") return (
    <div className="fl-wrap">
      <div className="fl-hd"><button className="bback" onClick={onBack}>← 戻る</button><div className="fl-title">👤 利用者管理</div></div>
      {isMgr&&<div style={{marginBottom:12}}><button className="bsave" style={{maxWidth:200}} onClick={()=>setScreen("register")}>＋ 新規利用者登録</button></div>}
      {/* 全体アラートサマリー */}
      {(()=>{
        const allAlerts=users.flatMap(u=>getUserAlerts(u,store).filter(a=>a.status!=="ok"));
        const urgentCount=allAlerts.filter(a=>a.status==="expired"||a.status==="urgent").length;
        const soonCount=allAlerts.filter(a=>a.status==="soon").length;
        return (urgentCount+soonCount)>0&&<div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
          {urgentCount>0&&<div style={{background:"rgba(224,56,56,0.15)",border:"1.5px solid rgba(224,56,56,0.4)",borderRadius:10,padding:"10px 16px",display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:20}}>🔴</span>
            <div><div style={{fontSize:12,fontWeight:900,color:"var(--ro)"}}>要対応 {urgentCount}件</div><div style={{fontSize:10,color:"var(--ro)",opacity:.8}}>期限切れ・30日以内</div></div>
          </div>}
          {soonCount>0&&<div style={{background:"#fef8e6",border:"1.5px solid #e8d870",borderRadius:10,padding:"10px 16px",display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:20}}>🟡</span>
            <div><div style={{fontSize:12,fontWeight:900,color:"#8a6200"}}>期限間近 {soonCount}件</div><div style={{fontSize:10,color:"#8a6200",opacity:.8}}>90日以内に期限</div></div>
          </div>}
        </div>;
      })()}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10,paddingBottom:28}}>
        {users.map(u=>{
          const age=calcAge(u.dob);
          const ispCount=store.isps.filter(x=>x.userId===u.id).length;
          const latestIsp=store.isps.filter(x=>x.userId===u.id).sort((a,b)=>b.createdAt>a.createdAt?1:-1)[0];
          return <div key={u.id} style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:12,padding:"14px 13px",cursor:"pointer",boxShadow:"var(--sh)",transition:"all .18s"}}
            onClick={()=>{setSelUser(u);setScreen("hub");}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--tl)";e.currentTarget.style.boxShadow="var(--sh2)";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--bd)";e.currentTarget.style.boxShadow="var(--sh)";}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div style={{width:40,height:40,borderRadius:"50%",background:u.active===false?"var(--bg2)":"linear-gradient(135deg,var(--tl),var(--gr))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>👤</div>
              {isMgr&&<button onClick={e=>{e.stopPropagation();setSelUser(u);setScreen("edit");}} style={{padding:"3px 8px",borderRadius:6,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"var(--bg)",border:"1.5px solid var(--bd)",color:"var(--tx3)"}}>編集</button>}
            </div>
            <div style={{fontWeight:900,fontSize:14,marginBottom:2,color:u.active===false?"var(--tx3)":"var(--tx)"}}>{u.name}{u.active===false&&<span style={{fontSize:10,color:"var(--bda)",marginLeft:5}}>（無効）</span>}</div>
            <div style={{fontSize:11,color:"var(--tx3)",marginBottom:6}}>{age}歳 ／ {u.diagnosis}</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:4}}>
              {ispCount>0&&<span style={{fontSize:9,padding:"2px 6px",borderRadius:8,background:"rgba(58,160,216,0.2)",color:"var(--tl)",fontWeight:700}}>計画{ispCount}件</span>}
              {latestIsp&&<span style={{fontSize:9,padding:"2px 6px",borderRadius:8,background:latestIsp.progress>=80?"rgba(44,170,96,0.2)":"rgba(224,168,40,0.18)",color:latestIsp.progress>=80?"var(--gr2)":"var(--am)",fontWeight:700}}>{latestIsp.progress}%</span>}
              {store.facesheets.find(f=>f.userId===u.id)&&<span style={{fontSize:9,padding:"2px 6px",borderRadius:8,background:"rgba(144,72,216,0.18)",color:"var(--pu)",fontWeight:700}}>FS有</span>}
            </div>
            {(()=>{const alerts=getUserAlerts(u,store);const hasUrgent=alerts.some(a=>a.status==="expired"||a.status==="urgent");const hasSoon=alerts.some(a=>a.status==="soon");return (hasUrgent||hasSoon)&&<div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {hasUrgent&&<span style={{fontSize:9,padding:"2px 7px",borderRadius:7,background:"rgba(224,56,56,0.15)",color:"var(--ro)",fontWeight:700,border:"1px solid rgba(224,56,56,0.4)"}}>🔴 要対応</span>}
              {!hasUrgent&&hasSoon&&<span style={{fontSize:9,padding:"2px 7px",borderRadius:7,background:"#fef8e6",color:"#8a6200",fontWeight:700,border:"1px solid #e8d870"}}>🟡 期限間近</span>}
            </div>;})()} 
          </div>;
        })}
      </div>
    </div>
  );

  // ===== 新規登録 / 編集画面 =====
  if(screen==="register"||screen==="edit"){
    const isEdit = screen==="edit";
    const init = isEdit&&selUser ? {...selUser} : {
      id:"", name:"", facilityId:user.selectedFacilityId||"f1",
      hasTransport:false, dob:"", diagnosis:"", gender:"",
      disabilityGrade:"", parentName:"", parentTel:"", parentRelation:"母",
      address:"", emergencyTel:"", emergencyName:"",
      school:"", schoolYear:"", schoolContact:"",
      medicalInstitution:"", doctor:"", medications:"", allergies:"",
      active:true, enrollDate:todayISO(), note:"",
      jukyushaNo:"", jukyushaExpiry:"", jukyushaCity:"", jukyushaCopy:false
    };
    return <RegisterUser
      init={init} isEdit={isEdit} user={user} store={store}
      onBack={()=>setScreen("list")}
      onSave={(u)=>{
        if(isEdit){ store.updUser2(u.id,u); }
        else { store.addUser({...u,id:genId()}); }
        setScreen("list");
      }}
    />;
  }

  // ===== ハブ画面（タブ切替） =====
  if(screen==="hub"&&selUser){
    const u=selUser;
    const age=calcAge(u.dob);
    const myIsps=store.isps.filter(x=>x.userId===u.id).sort((a,b)=>b.createdAt>a.createdAt?1:-1);
    const myFS=store.facesheets.find(f=>f.userId===u.id)||null;
    const myAssessments=store.assessments.filter(a=>a.userId===u.id);
    const myMonitorings=store.monitorings.filter(m=>m.userId===u.id);
    const myIspDrafts=(store.ispDrafts||[]).filter(d=>d.userId===u.id).sort((a,b)=>b.createdAt>a.createdAt?1:-1);
    const TABS=[
      {k:"facesheet",l:"フェイスシート",ic:"📋"},
      {k:"assessment",l:"アセスメント",ic:"📊"},
      {k:"isp_draft",l:"個別支援計画（原案）",ic:"📄"},
      {k:"isp",l:"個別支援計画",ic:"📝"},
      {k:"monitoring",l:"モニタリング",ic:"🔍"},
    ];
    return (
      <div className="fl-wrap">
        <div className="fl-hd"><button className="bback" onClick={()=>setScreen("list")}>← 戻る</button><div className="fl-title">👤 {u.name}</div></div>
        {/* アラートバナー */}
        {(()=>{const alerts=getUserAlerts(u,store);return alerts.filter(a=>a.status!=="ok").length>0&&<AlertBanner alerts={alerts.filter(a=>a.status!=="ok")} onTabClick={setHubTab}/>;})()}
        {/* プロフィールバナー */}
        <div style={{background:"linear-gradient(135deg,var(--tl),var(--gr))",borderRadius:12,padding:"14px 16px",marginBottom:14,color:"#fff",display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:52,height:52,borderRadius:"50%",background:"rgba(255,255,255,0.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0}}>👤</div>
          <div>
            <div style={{fontSize:20,fontWeight:900}}>{u.name}</div>
            <div style={{fontSize:12,opacity:.85,marginTop:2}}>{age}歳（{u.dob}生）／ {u.diagnosis}</div>
            <div style={{fontSize:11,opacity:.75,marginTop:1}}>{FACILITIES.find(f=>f.id===u.facilityId)?.name} ／ 送迎: {u.hasTransport?"あり":"なし"}</div>
          </div>
        </div>
        {/* タブ */}
        {(()=>{const allAlerts=getUserAlerts(u,store);return <div style={{display:"flex",gap:6,marginBottom:14,overflowX:"auto",paddingBottom:4,scrollbarWidth:"none"}}>
          {TABS.map(t=>{const tabAlerts=allAlerts.filter(a=>a.tab===t.k&&a.status!=="ok");const hasUrgent=tabAlerts.some(a=>a.status==="expired"||a.status==="urgent");const hasSoon=tabAlerts.some(a=>a.status==="soon");
            const tabBorder = hubTab===t.k?"none":hasUrgent?"1.5px solid rgba(224,56,56,0.4)":hasSoon?"1.5px solid #e8d870":"1.5px solid var(--bd)";
            return <button key={t.k} onClick={()=>setHubTab(t.k)} style={{padding:"8px 14px",borderRadius:20,whiteSpace:"nowrap",fontFamily:"'Noto Sans JP',sans-serif",fontSize:12,fontWeight:700,cursor:"pointer",background:hubTab===t.k?"var(--tl)":"var(--wh)",color:hubTab===t.k?"#fff":"var(--tx3)",border:tabBorder,boxShadow:hubTab===t.k?"0 2px 8px rgba(0,128,184,0.3)":"var(--sh)",transition:"all .18s",position:"relative"}}>
              {t.ic} {t.l}
              {(hasUrgent||hasSoon)&&<span style={{position:"absolute",top:-4,right:-4,width:10,height:10,borderRadius:"50%",background:hasUrgent?"var(--ro)":"#8a6200",border:"2px solid var(--wh)"}}/>}
            </button>;
          })}
        </div>;})()}

        {/* ===== フェイスシート ===== */}
        {hubTab==="facesheet"&&<FacesheetTab u={u} myFS={myFS} user={user} store={store}/>}
        {/* ===== アセスメント ===== */}
        {hubTab==="assessment"&&<AssessmentTab u={u} myAssessments={myAssessments} user={user} store={store}/>}
        {/* ===== 個別支援計画 ===== */}
        {hubTab==="isp"&&<IspTab u={u} myIsps={myIsps} user={user} store={store}/>}
        {/* ===== 個別支援計画（原案） ===== */}
        {hubTab==="isp_draft"&&<IspDraftTab u={u} myIspDrafts={myIspDrafts} user={user} store={store}/>}
        {/* ===== モニタリング ===== */}
        {hubTab==="monitoring"&&<MonitoringTab u={u} myMonitorings={myMonitorings} myIsps={myIsps} user={user} store={store}/>}
      </div>
    );
  }
  return null;
}

// ===== フェイスシートタブ =====
function FacesheetTab({u,myFS,user,store}){
  const [edit,setEdit]=useState(!myFS);
  const init=myFS||{userId:u.id,facilityId:u.facilityId,
    parentName:"",parentTel:"",parentRelation:"母",address:"",emergencyTel:"",emergencyName:"",emergencyRelation:"",
    school:"",schoolYear:"",schoolContact:"",
    medicalInstitution:"",doctor:"",medications:"",allergies:"",
    characteristics:"",strengths:"",challenges:"",triggers:"",calming:"",
    disabilityGrade:"",disabilityNote:"",therapyHistory:"",
    notes:"",updatedAt:""};
  const [fs,setFs]=useState(init);
  const upd=(k,v)=>setFs(p=>({...p,[k]:v}));
  const save=()=>{const d={...fs,updatedAt:todayISO()};store.saveFS(d);setEdit(false);};

  const Field=({label,fkey,placeholder="",multi=false})=><div style={{marginBottom:12}}>
    <label style={{display:"block",fontSize:10,fontWeight:700,color:"var(--tl)",letterSpacing:1,marginBottom:5}}>{label}</label>
    {edit
      ?multi?<textarea className="fta" style={{minHeight:60}} value={fs[fkey]||""} placeholder={placeholder} onChange={e=>upd(fkey,e.target.value)}/>
             :<input className="fi" value={fs[fkey]||""} placeholder={placeholder} onChange={e=>upd(fkey,e.target.value)}/>
      :<div style={{fontSize:13,color:fs[fkey]?"var(--tx)":"var(--tx3)",padding:"8px 0",borderBottom:"1px solid var(--bg2)",lineHeight:1.6,minHeight:28}}>{fs[fkey]||"未記入"}</div>
    }
  </div>;

  return <div style={{paddingBottom:28}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <div style={{fontSize:13,fontWeight:700,color:"var(--tx)"}}>📋 フェイスシート</div>
      <div style={{display:"flex",gap:8}}>
        {!edit&&<button className="bexp" onClick={()=>printFacesheet(u,fs,FACILITIES.find(f=>f.id===u.facilityId)?.name||"")} style={{background:"#fff8f0",borderColor:"var(--ac)",color:"var(--ac)"}}>🖨️ 印刷</button>}
        {!edit&&<button className="bexp" onClick={()=>setEdit(true)}>✏️ 編集</button>}
        {edit&&<><button className="bexp" onClick={()=>setEdit(false)} style={{borderColor:"var(--bda)",color:"var(--tx3)"}}>キャンセル</button><button className="bsave" style={{width:"auto",padding:"7px 18px",marginTop:0}} onClick={save}>保存</button></>}
      </div>
    </div>
    {/* 基本情報 */}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:"16px",marginBottom:12,boxShadow:"var(--sh)"}}>
      <div style={{fontSize:11,fontWeight:700,color:"var(--ac)",letterSpacing:2,marginBottom:12,paddingBottom:8,borderBottom:"2px solid var(--ac)"}}>基本情報</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
        <Field label="生年月日" fkey="dob2" placeholder="2015-04-10"/>
        <Field label="性別" fkey="gender" placeholder="男・女・その他"/>
        <Field label="障害種別・等級" fkey="disabilityGrade" placeholder="例）療育手帳 B1"/>
        <Field label="診断名" fkey="diagDetail" placeholder="例）自閉スペクトラム症（ASD）"/>
      </div>
      <Field label="障害の特記事項" fkey="disabilityNote" multi placeholder="手帳番号、診断詳細など"/>
    </div>
    {/* 保護者情報 */}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:"16px",marginBottom:12,boxShadow:"var(--sh)"}}>
      <div style={{fontSize:11,fontWeight:700,color:"var(--tl)",letterSpacing:2,marginBottom:12,paddingBottom:8,borderBottom:"2px solid var(--tl)"}}>保護者情報</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
        <Field label="保護者氏名" fkey="parentName" placeholder="山田 花子"/>
        <Field label="続柄" fkey="parentRelation" placeholder="母"/>
        <Field label="連絡先（携帯）" fkey="parentTel" placeholder="090-XXXX-XXXX"/>
        <Field label="緊急連絡先" fkey="emergencyTel" placeholder="090-XXXX-XXXX"/>
        <Field label="緊急連絡先氏名" fkey="emergencyName" placeholder="山田 太郎"/>
        <Field label="緊急連絡先続柄" fkey="emergencyRelation" placeholder="父"/>
      </div>
      <Field label="住所" fkey="address" placeholder="○○市△△1-2-3"/>
    </div>
    {/* 学校情報 */}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:"16px",marginBottom:12,boxShadow:"var(--sh)"}}>
      <div style={{fontSize:11,fontWeight:700,color:"var(--gr)",letterSpacing:2,marginBottom:12,paddingBottom:8,borderBottom:"2px solid var(--gr)"}}>学校情報</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
        <Field label="学校名" fkey="school" placeholder="○○小学校 特別支援学級"/>
        <Field label="学年" fkey="schoolYear" placeholder="4年生"/>
        <Field label="担任・支援員" fkey="schoolContact" placeholder="鈴木 先生"/>
      </div>
    </div>
    {/* 医療情報 */}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:"16px",marginBottom:12,boxShadow:"var(--sh)"}}>
      <div style={{fontSize:11,fontWeight:700,color:"var(--ro)",letterSpacing:2,marginBottom:12,paddingBottom:8,borderBottom:"2px solid var(--ro)"}}>医療情報</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
        <Field label="医療機関名" fkey="medicalInstitution" placeholder="○○クリニック"/>
        <Field label="主治医" fkey="doctor" placeholder="田中 医師"/>
      </div>
      <Field label="服薬状況" fkey="medications" multi placeholder="例）リスパダール 0.5mg 朝・夕食後"/>
      <Field label="アレルギー・禁忌事項" fkey="allergies" multi placeholder="例）卵アレルギー（重篤）、蜂毒アレルギー"/>
    </div>
    {/* 特性・支援情報 */}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:"16px",marginBottom:12,boxShadow:"var(--sh)"}}>
      <div style={{fontSize:11,fontWeight:700,color:"var(--pu)",letterSpacing:2,marginBottom:12,paddingBottom:8,borderBottom:"2px solid var(--pu)"}}>特性・支援情報</div>
      <Field label="得意なこと・強み" fkey="strengths" multi placeholder="例）記憶力が高い、電車の知識が豊富、手先が器用"/>
      <Field label="苦手なこと・課題" fkey="challenges" multi placeholder="例）突然の予定変更が苦手、大きな音が苦手"/>
      <Field label="パニックのきっかけ" fkey="triggers" multi placeholder="例）急な予定変更、大きな声、特定の感触"/>
      <Field label="落ち着くための方法" fkey="calming" multi placeholder="例）一人になれる静かな空間、好きな音楽を聴く"/>
      <Field label="支援上の特記事項" fkey="notes" multi placeholder="その他、支援員が把握すべき情報"/>
    </div>
    {/* 受給者証期限アラート */}
    {(u.jukyushaExpiry||(myFS?.jukyushaExpiry))&&(()=>{
      const exp=myFS?.jukyushaExpiry||u.jukyushaExpiry;
      const st=expiryStatus(exp);const es=expiryStyle(st);const d=daysUntil(exp);
      return st&&st!=="ok"&&<div style={{background:es.bg,border:"1.5px solid "+es.border,borderRadius:10,padding:"10px 14px",marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><span style={{fontSize:13,fontWeight:700,color:es.color}}>{es.icon} 受給者証</span><span style={{fontSize:12,color:es.color,marginLeft:8}}>{exp}</span></div>
        <span style={{fontSize:12,fontWeight:700,color:es.color}}>{d<0?"期限切れ":d+"日後"}</span>
      </div>;
    })()}
    {myFS?.updatedAt&&<div style={{fontSize:11,color:"var(--tx3)",textAlign:"right"}}>最終更新: {myFS.updatedAt}</div>}
  </div>;
}

// ===== アセスメントタブ =====
function AssessmentTab({u,myAssessments,user,store}){
  const [mode,setMode]=useState("list"); // list | new | view
  const [selA,setSelA]=useState(null);
  const [date,setDate]=useState(todayISO());
  const [assessor,setAssessor]=useState(user.displayName);
  const [scores,setScores]=useState({});
  const [notes,setNotes]=useState({});
  const [overall,setOverall]=useState("");
  const [done,setDone]=useState(false);

  const setScore=(akey,ikey,val)=>setScores(p=>({...p,[akey]:{...(p[akey]||{}),[ikey]:val}}));
  const setNote=(akey,val)=>setNotes(p=>({...p,[akey]:val}));
  const areaScore=akey=>{const s=scores[akey]||{};const vals=Object.values(s).filter(Boolean);return vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length*10)/10:null;};
  const totalScore=()=>{const areas=ASSESSMENT_AREAS.map(a=>areaScore(a.key)).filter(Boolean);return areas.length?Math.round(areas.reduce((a,b)=>a+b,0)/areas.length*10)/10:null;};

  const save=()=>{
    const rec={id:genId(),userId:u.id,facilityId:u.facilityId,date,assessor,scores,notes,overall,createdAt:todayISO()};
    store.addAssessment(rec);
    setDone(true);
  };
  const reset=()=>{setDone(false);setMode("list");setScores({});setNotes({});setOverall("");setDate(todayISO());};

  const ScoreColor=s=>s>=4?"var(--gr2)":s>=3?"var(--tl)":s>=2?"var(--am)":"var(--ro)";
  const ScoreBg=s=>s>=4?"rgba(44,170,96,0.2)":s>=3?"rgba(58,160,216,0.2)":s>=2?"rgba(224,168,40,0.18)":"rgba(224,56,56,0.15)";

  if(done) return <div className="succ"><div className="si">📊</div><div className="st">アセスメント完了</div><div className="sd">{u.name} さんのアセスメントを保存しました</div><div style={{display:"flex",gap:10,marginTop:12}}><button className="bpri" style={{maxWidth:160}} onClick={reset}>続けて入力</button></div></div>;

  if(mode==="view"&&selA) return <div style={{paddingBottom:28}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}><button className="bback" onClick={()=>setMode("list")}>← 戻る</button><div style={{fontSize:15,fontWeight:900}}>📊 アセスメント詳細</div></div>
      <button className="bexp" onClick={()=>printAssessment(u,selA,FACILITIES.find(f=>f.id===u.facilityId)?.name||"")} style={{background:"#fff8f0",borderColor:"var(--ac)",color:"var(--ac)"}}>🖨️ 印刷</button>
    </div>
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:14,marginBottom:12,boxShadow:"var(--sh)"}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
        <div style={{fontSize:13,fontWeight:700}}>{selA.date}</div>
        <div style={{fontSize:12,color:"var(--tx3)"}}>評価者: {selA.assessor}</div>
      </div>
      {/* レーダー風サマリー */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:12}}>
        {ASSESSMENT_AREAS.map(a=>{
          const s=selA.scores[a.key]||{};const vals=Object.values(s).filter(Boolean);
          const avg=vals.length?Math.round(vals.reduce((x,y)=>x+y,0)/vals.length*10)/10:null;
          return <div key={a.key} style={{background:avg?ScoreBg(avg):"var(--bg)",borderRadius:8,padding:"10px 12px"}}>
            <div style={{fontSize:11,fontWeight:700,color:"var(--tx2)",marginBottom:4}}>{a.label}</div>
            <div style={{fontSize:20,fontWeight:900,fontFamily:"'DM Mono',monospace",color:avg?ScoreColor(avg):"var(--tx3)"}}>{avg?avg:"—"}<span style={{fontSize:11,fontWeight:400}}>/5</span></div>
            {/* スコアバー */}
            <div style={{height:5,background:"var(--bg2)",borderRadius:3,marginTop:5,overflow:"hidden"}}>
              <div style={{height:"100%",width:(avg?avg/5*100:0)+"%",background:avg?ScoreColor(avg):"var(--bda)",borderRadius:3,transition:"width .4s"}}/>
            </div>
          </div>;
        })}
      </div>
      <div style={{background:totalScore()!=null?ScoreBg(totalScore()):"var(--bg)",borderRadius:9,padding:"12px 14px",textAlign:"center",marginBottom:12}}>
        <div style={{fontSize:11,color:"var(--tx3)",marginBottom:2}}>総合平均スコア</div>
        <div style={{fontSize:28,fontWeight:900,fontFamily:"'DM Mono',monospace",color:ScoreColor(totalScore())}}>{totalScore()||"—"}<span style={{fontSize:13}}>/5</span></div>
      </div>
      {selA.overall&&<><div style={{fontSize:10,fontWeight:700,color:"var(--tl)",letterSpacing:1,marginBottom:6}}>総合所見</div><div style={{fontSize:13,color:"var(--tx2)",lineHeight:1.7,padding:"10px",background:"var(--bg)",borderRadius:8}}>{selA.overall}</div></>}
    </div>
    {ASSESSMENT_AREAS.map(a=><div key={a.key} style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:14,marginBottom:10,boxShadow:"var(--sh)"}}>
      <div style={{fontWeight:700,fontSize:13,marginBottom:10}}>{a.label}</div>
      {a.items.map((item,i)=>{const s=(selA.scores[a.key]||{})[i]||0;return <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid var(--bg2)"}}>
        <div style={{fontSize:12,color:"var(--tx2)",flex:1}}>{item}</div>
        <div style={{padding:"3px 10px",borderRadius:10,background:s?ScoreBg(s):"var(--bg)",color:s?ScoreColor(s):"var(--tx3)",fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>{s?LEVEL_LABELS[s-1]:"未評価"}</div>
      </div>;})}
      {selA.notes?.[a.key]&&<div style={{fontSize:12,color:"var(--tx3)",marginTop:8,padding:"8px",background:"var(--bg)",borderRadius:7}}>{selA.notes[a.key]}</div>}
    </div>)}
  </div>;

  if(mode==="new") return <div style={{paddingBottom:28}}>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
      <button className="bback" onClick={()=>setMode("list")}>← 戻る</button>
      <div style={{fontSize:15,fontWeight:900}}>📊 アセスメント記入</div>
    </div>
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:14,marginBottom:12,boxShadow:"var(--sh)"}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div><label style={{fontSize:10,fontWeight:700,color:"var(--tl)",letterSpacing:1,display:"block",marginBottom:5}}>評価日</label><input className="fi" type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
        <div><label style={{fontSize:10,fontWeight:700,color:"var(--tl)",letterSpacing:1,display:"block",marginBottom:5}}>評価者</label><input className="fi" value={assessor} onChange={e=>setAssessor(e.target.value)}/></div>
      </div>
    </div>
    {ASSESSMENT_AREAS.map(a=><div key={a.key} style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:14,marginBottom:10,boxShadow:"var(--sh)"}}>
      <div style={{fontWeight:700,fontSize:13,marginBottom:3,color:"var(--tx)"}}>{a.label}</div>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
        <span style={{fontSize:10,color:"var(--tx3)"}}>領域平均:</span>
        {areaScore(a.key)!=null?<span style={{fontSize:13,fontWeight:700,color:ScoreColor(areaScore(a.key))}}>{areaScore(a.key)}/5</span>:<span style={{fontSize:12,color:"var(--tx3)"}}>-</span>}
      </div>
      {a.items.map((item,i)=><div key={i} style={{marginBottom:10}}>
        <div style={{fontSize:12,color:"var(--tx2)",marginBottom:5}}>{item}</div>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {[1,2,3,4,5].map(v=><button key={v} onClick={()=>setScore(a.key,i,v)} style={{padding:"5px 8px",borderRadius:8,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",borderColor:(scores[a.key]||{})[i]===v?ScoreColor(v):"var(--bd)",background:(scores[a.key]||{})[i]===v?ScoreBg(v):"var(--bg)",color:(scores[a.key]||{})[i]===v?ScoreColor(v):"var(--tx3)",transition:"all .12s",whiteSpace:"nowrap"}}>{v} {["×","△","○","◎","★"][v-1]}</button>)}
        </div>
      </div>)}
      <textarea className="fta" style={{minHeight:52}} placeholder={a.label+"の所見・コメント"} value={notes[a.key]||""} onChange={e=>setNote(a.key,e.target.value)}/>
    </div>)}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:14,marginBottom:12,boxShadow:"var(--sh)"}}>
      <div style={{fontSize:11,fontWeight:700,color:"var(--tl)",letterSpacing:1,marginBottom:8}}>総合所見</div>
      <textarea className="fta" style={{minHeight:80}} placeholder="全体を通しての評価・所見・今後の支援方針など" value={overall} onChange={e=>setOverall(e.target.value)}/>
    </div>
    <button className="bsave" onClick={save}>アセスメントを保存する</button>
  </div>;

  return <div style={{paddingBottom:28}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <div style={{fontSize:13,fontWeight:700}}>📊 アセスメント一覧</div>
      <button className="bsave" style={{width:"auto",padding:"7px 16px",marginTop:0}} onClick={()=>setMode("new")}>＋ 新規評価</button>
    </div>
    {myAssessments.length===0?<div style={{textAlign:"center",color:"var(--tx3)",padding:"36px 0",fontSize:13}}>アセスメントがありません</div>
    :myAssessments.sort((a,b)=>b.date>a.date?1:-1).map(a=>{
      const areas=ASSESSMENT_AREAS.map(ar=>{const s=a.scores[ar.key]||{};const vals=Object.values(s).filter(Boolean);return vals.length?vals.reduce((x,y)=>x+y,0)/vals.length:null;}).filter(Boolean);
      const avg=areas.length?Math.round(areas.reduce((x,y)=>x+y,0)/areas.length*10)/10:null;
      return <div key={a.id} style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:14,marginBottom:9,cursor:"pointer",boxShadow:"var(--sh)",transition:"all .15s"}} onClick={()=>{setSelA(a);setMode("view");}}
        onMouseEnter={e=>e.currentTarget.style.borderColor="var(--tl)"}
        onMouseLeave={e=>e.currentTarget.style.borderColor="var(--bd)"}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{fontWeight:700,fontSize:14}}>{a.date}</div>
          {avg&&<div style={{padding:"4px 12px",borderRadius:12,background:ScoreBg(avg),color:ScoreColor(avg),fontWeight:900,fontSize:14,fontFamily:"'DM Mono',monospace"}}>総合 {avg}/5</div>}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{fontSize:11,color:"var(--tx3)"}}>評価者: {a.assessor}</div>
          {(()=>{const nextDate=new Date(a.date);nextDate.setMonth(nextDate.getMonth()+6);const st=expiryStatus(nextDate.toISOString().slice(0,10));const es=expiryStyle(st);const d=daysUntil(nextDate.toISOString().slice(0,10));return st&&st!=="ok"&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:8,fontWeight:700,background:es.bg,color:es.color,border:"1px solid "+es.border}}>{es.icon} 更新{d<0?"期限切れ":d+"日後"}</span>;})()}
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {ASSESSMENT_AREAS.map(ar=>{const s=a.scores[ar.key]||{};const vals=Object.values(s).filter(Boolean);const avg2=vals.length?Math.round(vals.reduce((x,y)=>x+y,0)/vals.length*10)/10:null;
            return <div key={ar.key} style={{fontSize:10,padding:"3px 8px",borderRadius:8,background:avg2?ScoreBg(avg2):"var(--bg)",color:avg2?ScoreColor(avg2):"var(--tx3)",fontWeight:700}}>{ar.label} {avg2||"−"}</div>;
          })}
        </div>
      </div>;
    })}
  </div>;
}

// ===== 個別支援計画タブ =====
function IspTab({u,myIsps,user,store}){
  const [mode,setMode]=useState("list");const [view,setView]=useState(null);
  const [goals,setGoals]=useState([]);const [longGoal,setLongGoal]=useState("");const [shortGoal,setShortGoal]=useState("");
  const [support,setSupport]=useState("");const [evaluation,setEval]=useState("");const [period,setPeriod]=useState("2026年4月〜2026年9月");
  const [staffName,setStaffName]=useState(user.displayName);const [done,setDone]=useState(false);
  const tog=g=>setGoals(p=>p.includes(g)?p.filter(x=>x!==g):[...p,g]);
  const save=()=>{store.addIsp({id:genId(),userId:u.id,facilityId:u.facilityId,period,createdAt:todayISO(),goals,longGoal,shortGoal,support,evaluation,staffName,progress:0,status:"実施中"});setDone(true);};
  const reset=()=>{setDone(false);setMode("list");setGoals([]);setLongGoal("");setShortGoal("");setSupport("");setEval("");};

  if(done) return <div className="succ"><div className="si">📝</div><div className="st">計画を作成しました</div><div className="sd">{u.name} さんの個別支援計画を保存しました</div><div style={{display:"flex",gap:10,marginTop:12}}><button className="bpri" style={{maxWidth:160}} onClick={reset}>続けて作成</button></div></div>;

  if(view) return <div style={{paddingBottom:28}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}><button className="bback" onClick={()=>setView(null)}>← 戻る</button><div style={{fontSize:15,fontWeight:900}}>📝 個別支援計画 詳細</div></div>
      <button className="bexp" onClick={()=>printISP(u,view,FACILITIES.find(f=>f.id===u.facilityId)?.name||"")} style={{background:"#fff8f0",borderColor:"var(--ac)",color:"var(--ac)"}}>🖨️ 印刷</button>
    </div>
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:16,marginBottom:12,boxShadow:"var(--sh)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
        <div><div style={{fontSize:15,fontWeight:900}}>{view.period}</div><div style={{fontSize:11,color:"var(--tx3)",marginTop:2}}>作成日: {view.createdAt} ／ 担当: {view.staffName}</div></div>
        <span style={{padding:"4px 10px",borderRadius:10,fontSize:11,fontWeight:700,background:view.status==="実施中"?"rgba(58,160,216,0.2)":"rgba(44,170,96,0.2)",color:view.status==="実施中"?"var(--tl)":"var(--gr2)"}}>{view.status}</span>
      </div>
      <div style={{fontSize:10,fontWeight:700,color:"var(--tl)",letterSpacing:1,marginBottom:6}}>長期目標</div>
      <div style={{fontSize:13,color:"var(--tx2)",lineHeight:1.7,padding:"10px 12px",background:"rgba(58,160,216,0.1)",borderRadius:8,borderLeft:"3px solid var(--tl)",marginBottom:12}}>{view.longGoal}</div>
      <div style={{fontSize:10,fontWeight:700,color:"var(--gr)",letterSpacing:1,marginBottom:6}}>短期目標</div>
      <div style={{fontSize:13,color:"var(--tx2)",lineHeight:1.7,marginBottom:12}}>{view.shortGoal}</div>
      <div style={{fontSize:10,fontWeight:700,color:"var(--am)",letterSpacing:1,marginBottom:6}}>支援領域</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:12}}>{view.goals?.map(g=><span key={g} style={{padding:"3px 9px",borderRadius:9,fontSize:10,fontWeight:700,background:"rgba(58,160,216,0.2)",color:"var(--tl)"}}>{g}</span>)}</div>
      <div style={{fontSize:10,fontWeight:700,color:"var(--tx2)",letterSpacing:1,marginBottom:6}}>支援内容・方法</div>
      <div style={{fontSize:13,color:"var(--tx2)",lineHeight:1.7,marginBottom:12}}>{view.support}</div>
      <div style={{fontSize:10,fontWeight:700,color:"var(--tx2)",letterSpacing:1,marginBottom:6}}>評価方法・時期</div>
      <div style={{fontSize:13,color:"var(--tx2)",lineHeight:1.7,marginBottom:14}}>{view.evaluation}</div>
      <div style={{fontSize:10,fontWeight:700,color:"var(--tl)",letterSpacing:1,marginBottom:6}}>達成度</div>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:12,color:"var(--tx3)"}}>進捗</span><span style={{fontSize:14,fontWeight:700,color:"var(--tl)",fontFamily:"'DM Mono',monospace"}}>{view.progress}%</span></div>
      <div className="progress-bar"><div className="progress-fill" style={{width:view.progress+"%"}}/></div>
      <div style={{display:"flex",gap:6,marginTop:12,flexWrap:"wrap"}}>
        {[0,10,20,30,40,50,60,70,80,90,100].map(p=><button key={p} onClick={()=>{store.updIsp(view.id,{progress:p});setView({...view,progress:p});}} style={{padding:"4px 9px",borderRadius:10,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",borderColor:view.progress===p?"var(--tl)":"var(--bd)",background:view.progress===p?"rgba(58,160,216,0.2)":"var(--bg)",color:view.progress===p?"var(--tl)":"var(--tx3)"}}>{p}%</button>)}
      </div>
      <div style={{display:"flex",gap:8,marginTop:14}}>
        <button className="bexp" onClick={()=>store.updIsp(view.id,{status:"完了"})&&setView({...view,status:"完了"})}>✅ 完了にする</button>
      </div>
    </div>
  </div>;

  if(mode==="new") return <div style={{paddingBottom:28}}>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}><button className="bback" onClick={()=>setMode("list")}>← 戻る</button><div style={{fontSize:15,fontWeight:900}}>📝 個別支援計画 作成</div></div>
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:16,marginBottom:12,boxShadow:"var(--sh)"}}>
      <div style={{fontSize:10,fontWeight:700,color:"var(--tl)",letterSpacing:1,marginBottom:6}}>支援期間</div>
      <input className="fi" value={period} onChange={e=>setPeriod(e.target.value)} placeholder="例: 2026年4月〜2026年9月" style={{marginBottom:12}}/>
      <div style={{fontSize:10,fontWeight:700,color:"var(--tl)",letterSpacing:1,marginBottom:6}}>担当者名</div>
      <input className="fi" value={staffName} onChange={e=>setStaffName(e.target.value)} style={{marginBottom:0}}/>
    </div>
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:16,marginBottom:12,boxShadow:"var(--sh)"}}>
      <div style={{fontSize:10,fontWeight:700,color:"var(--am)",letterSpacing:1,marginBottom:8}}>支援領域（複数選択可）</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
        {SUPPORT_GOALS.map(g=><button key={g} onClick={()=>tog(g)} style={{padding:"6px 11px",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",borderColor:goals.includes(g)?"var(--tl)":"var(--bd)",background:goals.includes(g)?"rgba(58,160,216,0.2)":"var(--bg)",color:goals.includes(g)?"var(--tl)":"var(--tx2)"}}>{g}</button>)}
      </div>
    </div>
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:16,marginBottom:12,boxShadow:"var(--sh)"}}>
      <div style={{fontSize:10,fontWeight:700,color:"var(--tl)",letterSpacing:1,marginBottom:6}}>長期目標</div>
      <textarea className="fta" placeholder="例）友達と一緒に楽しく活動できるようになる" value={longGoal} onChange={e=>setLongGoal(e.target.value)} style={{marginBottom:12}}/>
      <div style={{fontSize:10,fontWeight:700,color:"var(--gr)",letterSpacing:1,marginBottom:6}}>短期目標</div>
      <textarea className="fta" placeholder="例）挨拶や簡単な会話を自発的に行う" value={shortGoal} onChange={e=>setShortGoal(e.target.value)} style={{marginBottom:12}}/>
      <div style={{fontSize:10,fontWeight:700,color:"var(--tx2)",letterSpacing:1,marginBottom:6}}>支援内容・方法</div>
      <textarea className="fta" placeholder="例）ソーシャルスキルトレーニングを週2回実施" value={support} onChange={e=>setSupport(e.target.value)} style={{marginBottom:12}}/>
      <div style={{fontSize:10,fontWeight:700,color:"var(--tx2)",letterSpacing:1,marginBottom:6}}>評価方法・時期</div>
      <textarea className="fta" placeholder="例）月1回モニタリングを実施。半年後に計画を見直す。" value={evaluation} onChange={e=>setEval(e.target.value)}/>
    </div>
    <button className="bsave" disabled={!longGoal||goals.length===0} onClick={save}>計画を保存する</button>
  </div>;

  return <div style={{paddingBottom:28}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <div style={{fontSize:13,fontWeight:700}}>📝 個別支援計画一覧</div>
      <button className="bsave" style={{width:"auto",padding:"7px 16px",marginTop:0}} onClick={()=>setMode("new")}>＋ 新規作成</button>
    </div>
    {myIsps.length===0?<div style={{textAlign:"center",color:"var(--tx3)",padding:"36px 0",fontSize:13}}>個別支援計画がありません</div>
    :myIsps.map(x=><div key={x.id} style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:14,marginBottom:9,cursor:"pointer",boxShadow:"var(--sh)",transition:"all .15s"}} onClick={()=>setView(x)}
        onMouseEnter={e=>e.currentTarget.style.borderColor="var(--tl)"}
        onMouseLeave={e=>e.currentTarget.style.borderColor="var(--bd)"}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:7}}>
        <div><div style={{fontWeight:700,fontSize:14}}>{x.period}</div><div style={{fontSize:11,color:"var(--tx3)",marginTop:2}}>作成日: {x.createdAt}</div></div>
        <div style={{display:"flex",gap:5,alignItems:"center"}}>
          {(()=>{const end=ispEndDate(x.period);const st=end?expiryStatus(end):null;const es=expiryStyle(st);const d=end?daysUntil(end):null;return st&&st!=="ok"&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:8,fontWeight:700,background:es.bg,color:es.color,border:"1px solid "+es.border}}>{es.icon} {d!==null&&d<0?"期限切れ":d+"日"}</span>;})()}
          <span style={{padding:"3px 9px",borderRadius:9,fontSize:11,fontWeight:700,background:x.status==="完了"?"rgba(44,170,96,0.2)":"rgba(58,160,216,0.2)",color:x.status==="完了"?"var(--gr2)":"var(--tl)"}}>{x.status}</span>
        </div>
      </div>
      {x.goals?.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:7}}>{x.goals.slice(0,3).map(g=><span key={g} style={{fontSize:9,padding:"2px 7px",borderRadius:8,background:"rgba(58,160,216,0.2)",color:"var(--tl)",fontWeight:700}}>{g}</span>)}{x.goals.length>3&&<span style={{fontSize:9,color:"var(--tx3)"}}>+{x.goals.length-3}</span>}</div>}
      <div style={{fontSize:12,color:"var(--tx2)",marginBottom:8}}>{x.longGoal?.length>55?x.longGoal.slice(0,55)+"…":x.longGoal}</div>
      <div className="progress-bar"><div className="progress-fill" style={{width:x.progress+"%"}}/></div>
      <div style={{fontSize:10,color:"var(--tx3)",marginTop:3}}>達成度 {x.progress}%</div>
    </div>)}
  </div>;
}

// ===== モニタリングタブ =====
function MonitoringTab({u,myMonitorings,myIsps,user,store}){
  const [mode,setMode]=useState("list");const [view,setView]=useState(null);
  const [selIsp,setSelIsp]=useState(myIsps[0]?.id||"");
  const [date,setDate]=useState(todayISO());
  const [staffName,setStaffName]=useState(user.displayName);
  const [itemScores,setItemScores]=useState({});
  const [itemNotes,setItemNotes]=useState({});
  const [nextPlan,setNextPlan]=useState("");const [parentComment,setParentComment]=useState("");const [overallNote,setOverallNote]=useState("");
  const [done,setDone]=useState(false);

  const setIS=(k,v)=>setItemScores(p=>({...p,[k]:v}));
  const setIN=(k,v)=>setItemNotes(p=>({...p,[k]:v}));
  const RESULT_OPTS=[{v:"達成",c:"var(--gr2)",bg:"rgba(44,170,96,0.2)"},{v:"概ね達成",c:"var(--tl)",bg:"rgba(58,160,216,0.2)"},{v:"一部達成",c:"var(--am)",bg:"rgba(224,168,40,0.18)"},{v:"未達成",c:"var(--ro)",bg:"rgba(224,56,56,0.15)"},{v:"継続",c:"var(--pu)",bg:"rgba(144,72,216,0.18)"}];

  const save=()=>{
    const isp=myIsps.find(x=>x.id===selIsp);
    const rec={id:genId(),userId:u.id,facilityId:u.facilityId,ispId:selIsp,ispPeriod:isp?.period||"",date,staffName,itemScores,itemNotes,nextPlan,parentComment,overallNote,createdAt:todayISO()};
    store.addMonitoring(rec);
    setDone(true);
  };
  const reset=()=>{setDone(false);setMode("list");setItemScores({});setItemNotes({});setNextPlan("");setParentComment("");setOverallNote("");};

  if(done) return <div className="succ"><div className="si">🔍</div><div className="st">モニタリング完了</div><div className="sd">{u.name} さんのモニタリングを保存しました</div><div style={{display:"flex",gap:10,marginTop:12}}><button className="bpri" style={{maxWidth:160}} onClick={reset}>続けて入力</button></div></div>;

  if(mode==="view"&&view) return <div style={{paddingBottom:28}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}><button className="bback" onClick={()=>setMode("list")}>← 戻る</button><div style={{fontSize:15,fontWeight:900}}>🔍 モニタリング詳細</div></div>
      <button className="bexp" onClick={()=>printMonitoring(u,view,FACILITIES.find(f=>f.id===u.facilityId)?.name||"")} style={{background:"#fff8f0",borderColor:"var(--ac)",color:"var(--ac)"}}>🖨️ 印刷</button>
    </div>
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:16,marginBottom:12,boxShadow:"var(--sh)"}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
        <div style={{fontWeight:700,fontSize:14}}>{view.date}</div>
        <div style={{fontSize:12,color:"var(--tx3)"}}>担当: {view.staffName}</div>
      </div>
      {view.ispPeriod&&<div style={{fontSize:12,color:"var(--tl)",fontWeight:700,marginBottom:12}}>対象計画: {view.ispPeriod}</div>}
      <div style={{fontSize:10,fontWeight:700,color:"var(--tl)",letterSpacing:1,marginBottom:8}}>評価項目</div>
      {MONITORING_ITEMS.map((item,i)=>{const score=view.itemScores?.[i];const opt=RESULT_OPTS.find(o=>o.v===score);return <div key={i} style={{marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:opt?opt.bg:"var(--bg)",borderRadius:8,marginBottom:view.itemNotes?.[i]?4:0}}>
          <div style={{fontSize:12,color:"var(--tx2)"}}>{item}</div>
          {score&&<span style={{fontSize:11,fontWeight:700,color:opt?.c,whiteSpace:"nowrap",marginLeft:8}}>{score}</span>}
        </div>
        {view.itemNotes?.[i]&&<div style={{fontSize:12,color:"var(--tx3)",padding:"6px 10px",background:"var(--bg)",borderRadius:"0 0 8px 8px"}}>{view.itemNotes[i]}</div>}
      </div>;})}
      {view.parentComment&&<><div style={{fontSize:10,fontWeight:700,color:"var(--ac)",letterSpacing:1,margin:"12px 0 6px"}}>保護者の意見・要望</div><div style={{fontSize:13,color:"var(--tx2)",lineHeight:1.7,padding:"10px",background:"#fff8f0",borderRadius:8,borderLeft:"3px solid var(--ac)"}}>{view.parentComment}</div></>}
      {view.nextPlan&&<><div style={{fontSize:10,fontWeight:700,color:"var(--gr)",letterSpacing:1,margin:"12px 0 6px"}}>次期支援方針・計画変更</div><div style={{fontSize:13,color:"var(--tx2)",lineHeight:1.7}}>{view.nextPlan}</div></>}
      {view.overallNote&&<><div style={{fontSize:10,fontWeight:700,color:"var(--tl)",letterSpacing:1,margin:"12px 0 6px"}}>総合所見</div><div style={{fontSize:13,color:"var(--tx2)",lineHeight:1.7}}>{view.overallNote}</div></>}
    </div>
  </div>;

  if(mode==="new") return <div style={{paddingBottom:28}}>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}><button className="bback" onClick={()=>setMode("list")}>← 戻る</button><div style={{fontSize:15,fontWeight:900}}>🔍 モニタリング記入</div></div>
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:16,marginBottom:12,boxShadow:"var(--sh)"}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        <div><label style={{fontSize:10,fontWeight:700,color:"var(--tl)",letterSpacing:1,display:"block",marginBottom:5}}>実施日</label><input className="fi" type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
        <div><label style={{fontSize:10,fontWeight:700,color:"var(--tl)",letterSpacing:1,display:"block",marginBottom:5}}>担当者</label><input className="fi" value={staffName} onChange={e=>setStaffName(e.target.value)}/></div>
      </div>
      {myIsps.length>0&&<><label style={{fontSize:10,fontWeight:700,color:"var(--tl)",letterSpacing:1,display:"block",marginBottom:5}}>対象の個別支援計画</label>
      <select className="fi" value={selIsp} onChange={e=>setSelIsp(e.target.value)}>
        {myIsps.map(x=><option key={x.id} value={x.id}>{x.period}（{x.status}）</option>)}
      </select></>}
    </div>
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:16,marginBottom:12,boxShadow:"var(--sh)"}}>
      <div style={{fontSize:10,fontWeight:700,color:"var(--tl)",letterSpacing:1,marginBottom:12}}>評価項目</div>
      {MONITORING_ITEMS.map((item,i)=><div key={i} style={{marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:600,color:"var(--tx)",marginBottom:7}}>{item}</div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>
          {RESULT_OPTS.map(o=><button key={o.v} onClick={()=>setIS(i,o.v)} style={{padding:"5px 10px",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",borderColor:itemScores[i]===o.v?o.c:"var(--bd)",background:itemScores[i]===o.v?o.bg:"var(--bg)",color:itemScores[i]===o.v?o.c:"var(--tx3)",transition:"all .12s"}}>{o.v}</button>)}
        </div>
        <input className="fi" value={itemNotes[i]||""} placeholder="コメント（任意）" onChange={e=>setIN(i,e.target.value)} style={{fontSize:12}}/>
      </div>)}
    </div>
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:16,marginBottom:12,boxShadow:"var(--sh)"}}>
      <div style={{fontSize:10,fontWeight:700,color:"var(--ac)",letterSpacing:1,marginBottom:6}}>保護者の意見・要望</div>
      <textarea className="fta" style={{minHeight:60}} placeholder="保護者からの意見・要望・家庭での様子など" value={parentComment} onChange={e=>setParentComment(e.target.value)}/>
      <div style={{fontSize:10,fontWeight:700,color:"var(--gr)",letterSpacing:1,margin:"12px 0 6px"}}>次期支援方針・計画変更</div>
      <textarea className="fta" style={{minHeight:60}} placeholder="次回の計画への反映事項、支援方針の変更点など" value={nextPlan} onChange={e=>setNextPlan(e.target.value)}/>
      <div style={{fontSize:10,fontWeight:700,color:"var(--tl)",letterSpacing:1,margin:"12px 0 6px"}}>総合所見</div>
      <textarea className="fta" style={{minHeight:80}} placeholder="モニタリング全体の総合評価・総合所見" value={overallNote} onChange={e=>setOverallNote(e.target.value)}/>
    </div>
    <button className="bsave" onClick={save}>モニタリングを保存する</button>
  </div>;

  return <div style={{paddingBottom:28}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <div style={{fontSize:13,fontWeight:700}}>🔍 モニタリング一覧</div>
      <button className="bsave" style={{width:"auto",padding:"7px 16px",marginTop:0}} onClick={()=>setMode("new")}>＋ 新規記録</button>
    </div>
    {myIsps.length===0&&<div style={{background:"#fff8f0",border:"1px solid var(--am)",borderRadius:10,padding:"12px 14px",fontSize:13,color:"var(--am)",marginBottom:12}}>⚠ まず「個別支援計画」タブで計画を作成してください</div>}
    {myMonitorings.length===0?<div style={{textAlign:"center",color:"var(--tx3)",padding:"36px 0",fontSize:13}}>モニタリング記録がありません</div>
    :myMonitorings.sort((a,b)=>b.date>a.date?1:-1).map(m=>{
      const achieved=Object.values(m.itemScores||{}).filter(s=>s==="達成"||s==="概ね達成").length;
      const total=Object.keys(m.itemScores||{}).length;
      return <div key={m.id} style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:14,marginBottom:9,cursor:"pointer",boxShadow:"var(--sh)",transition:"all .15s"}} onClick={()=>{setView(m);setMode("view");}}
          onMouseEnter={e=>e.currentTarget.style.borderColor="var(--tl)"}
          onMouseLeave={e=>e.currentTarget.style.borderColor="var(--bd)"}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <div style={{fontWeight:700,fontSize:14}}>{m.date}</div>
          {total>0&&<span style={{padding:"3px 10px",borderRadius:10,fontSize:11,fontWeight:700,background:"rgba(44,170,96,0.2)",color:"var(--gr2)"}}>{achieved}/{total} 項目達成</span>}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <div style={{fontSize:11,color:"var(--tx3)"}}>担当: {m.staffName} {m.ispPeriod&&("／ 計画: "+m.ispPeriod)}</div>
          {(()=>{const nextDate=new Date(m.date);nextDate.setMonth(nextDate.getMonth()+6);const st=expiryStatus(nextDate.toISOString().slice(0,10));const es=expiryStyle(st);const d=daysUntil(nextDate.toISOString().slice(0,10));return st&&st!=="ok"&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:8,fontWeight:700,background:es.bg,color:es.color,border:"1px solid "+es.border}}>{es.icon} 更新{d<0?"期限切れ":d+"日後"}</span>;})()}
        </div>
        {m.overallNote&&<div style={{fontSize:12,color:"var(--tx2)",lineHeight:1.5}}>{m.overallNote.length>70?m.overallNote.slice(0,70)+"…":m.overallNote}</div>}
      </div>;
    })}
  </div>;
}

// ==================== 個別支援計画（原案）タブ ====================
// ISP_DOMAINS は上部（MOODS近く）で定義済み
const ISP_PRIORITY_TYPES = ["本人支援","家族支援","地域支援"];
const WEEKDAY_LABELS = ["月","火","水","木","金","土","日・祝"];
const WEEKDAY_KEYS2 = ["mon","tue","wed","thu","fri","sat","sun"];

function newDraftForm(displayName) {
  return {
    jukyushaCertNo:"", startDate:"", expiryDate:"", creationCount:1,
    childWish:"", familyWish:"", overallPolicy:"",
    longTermGoal:"", longTermPeriod:"12ヶ月",
    supportTimeSlot:"", shortTermGoal:"", shortTermPeriod:"6ヶ月",
    usageDays:"", pickupNote:"", dropoffNote:"",
    goals:[{id:genId(),priority:"本人支援",achievement:"",domains:[],period:"12ヶ月",reflection:"",no:1}],
    staffName: displayName||"",
    schedule:{mon:{start:"",end:""},tue:{start:"",end:""},wed:{start:"",end:""},thu:{start:"",end:""},fri:{start:"",end:""},sat:{start:"",end:""},sun:{start:"",end:""}},
    specialNote:"",
    extBefore:{mon:"",tue:"",wed:"",thu:"",fri:"",sat:"",sun:""},
    extAfter:{mon:"",tue:"",wed:"",thu:"",fri:"",sat:"",sun:""},
    extReason:""
  };
}

function IspDraftTab({u, myIspDrafts, user, store}) {
  const [mode, setMode] = useState("list");
  const [viewItem, setViewItem] = useState(null);
  const [form, setForm] = useState(()=>newDraftForm(user.displayName));
  const facName = FACILITIES.find(f=>f.id===u.facilityId)?.name||"";

  const upd = (k,v) => setForm(p=>({...p,[k]:v}));
  const updSched = (day,k,v) => setForm(p=>({...p,schedule:{...p.schedule,[day]:{...p.schedule[day],[k]:v}}}));
  const updExt = (type,day,v) => setForm(p=>({...p,[type]:{...p[type],[day]:v}}));
  const addGoalRow = () => setForm(p=>({...p,goals:[...p.goals,{id:genId(),priority:"本人支援",achievement:"",domains:[],period:"12ヶ月",reflection:"",no:p.goals.length+1}]}));
  const removeGoalRow = id => setForm(p=>({...p,goals:p.goals.filter(g=>g.id!==id)}));
  const updGoal = (id,k,v) => setForm(p=>({...p,goals:p.goals.map(g=>g.id===id?{...g,[k]:v}:g)}));
  const togDomain = (id,dom) => setForm(p=>({...p,goals:p.goals.map(g=>g.id!==id?g:{...g,domains:g.domains.includes(dom)?g.domains.filter(d=>d!==dom):[...g.domains,dom]})}));

  const save = () => {
    const draft={...form,id:genId(),userId:u.id,facilityId:u.facilityId,createdAt:todayISO()};
    store.addIspDraft(draft);
    setForm(newDraftForm(user.displayName));
    setMode("list");
  };

  // --- 詳細表示 ---
  if(mode==="view"&&viewItem) return (
    <div style={{paddingBottom:28}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button className="bback" onClick={()=>{setViewItem(null);setMode("list");}}>← 戻る</button>
          <div style={{fontSize:15,fontWeight:900}}>📋 個別支援計画（原案）</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button className="bexp" onClick={()=>printIspDraft(u,viewItem,facName)} style={{background:"#fff8f0",borderColor:"var(--ac)",color:"var(--ac)"}}>🖨️ 印刷・PDF</button>
          <button onClick={()=>{store.delIspDraft(viewItem.id);setViewItem(null);setMode("list");}} style={{padding:"7px 14px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid rgba(224,56,56,0.4)",background:"rgba(224,56,56,0.08)",color:"var(--ro)"}}>削除</button>
        </div>
      </div>
      {[
        ["受給者証番号",viewItem.jukyushaCertNo],["開始日",viewItem.startDate],["有効期限",viewItem.expiryDate],["作成回数",viewItem.creationCount],
      ].map(([l,v])=><div key={l} style={{display:"flex",gap:8,marginBottom:6,fontSize:12}}><span style={{color:"var(--tx3)",minWidth:100}}>{l}</span><span style={{fontWeight:700}}>{v}</span></div>)}
      {[["本人の意向",viewItem.childWish],["家族の意向",viewItem.familyWish],["総合的な支援の方針",viewItem.overallPolicy],
        ["長期目標",viewItem.longTermGoal],["支援の標準的な提供時間帯",viewItem.supportTimeSlot],["短期目標",viewItem.shortTermGoal],
        ["利用日数",viewItem.usageDays],["迎え",viewItem.pickupNote],["送り",viewItem.dropoffNote],
      ].map(([l,v])=>v&&<div key={l} style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:9,padding:"10px 13px",marginBottom:8}}>
        <div style={{fontSize:10,fontWeight:700,color:"var(--tl)",letterSpacing:1,marginBottom:4}}>{l}</div>
        <div style={{fontSize:12,color:"var(--tx2)",whiteSpace:"pre-wrap",lineHeight:1.7}}>{v}</div>
      </div>)}
      <div style={{fontSize:12,fontWeight:700,margin:"12px 0 8px"}}>支援目標</div>
      {(viewItem.goals||[]).map((g,i)=>(
        <div key={g.id||i} style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:9,padding:"10px 13px",marginBottom:8}}>
          <div style={{display:"flex",gap:8,marginBottom:6,flexWrap:"wrap"}}>
            <span style={{padding:"2px 8px",borderRadius:7,fontSize:10,fontWeight:700,background:"rgba(58,160,216,0.2)",color:"var(--tl)"}}>{g.priority}</span>
            <span style={{padding:"2px 8px",borderRadius:7,fontSize:10,fontWeight:700,background:"#f0f0f0",color:"#555"}}>No.{i+1}</span>
            <span style={{padding:"2px 8px",borderRadius:7,fontSize:10,fontWeight:700,background:"rgba(224,168,40,0.18)",color:"var(--am)"}}>{g.period}</span>
          </div>
          <div style={{fontSize:11,color:"var(--tx2)",marginBottom:4}}><b>達成目標:</b> {g.achievement}</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:4}}>{(g.domains||[]).map(d=><span key={d} style={{padding:"2px 7px",borderRadius:6,fontSize:10,background:"rgba(144,72,216,0.18)",color:"var(--pu)",fontWeight:700}}>{d}</span>)}</div>
          {g.reflection&&<div style={{fontSize:11,color:"var(--tx3)"}}>振り返り: {g.reflection}</div>}
        </div>
      ))}
    </div>
  );

  // --- 新規作成フォーム ---
  if(mode==="new") return (
    <div style={{paddingBottom:32}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
        <button className="bback" onClick={()=>setMode("list")}>← 戻る</button>
        <div style={{fontSize:15,fontWeight:900}}>📋 個別支援計画（原案）作成</div>
      </div>

      {/* 基本情報 */}
      <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:14,marginBottom:10}}>
        <div style={{fontSize:11,fontWeight:700,color:"var(--tl)",letterSpacing:1,marginBottom:10}}>■ 基本情報</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
          <div style={{marginBottom:10}}><label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",display:"block",marginBottom:4}}>受給者証番号</label><input className="fi" value={form.jukyushaCertNo} onChange={e=>upd("jukyushaCertNo",e.target.value)} placeholder="例）22341001 50"/></div>
          <div style={{marginBottom:10}}><label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",display:"block",marginBottom:4}}>作成回数</label><input className="fi" type="number" min="1" value={form.creationCount} onChange={e=>upd("creationCount",+e.target.value)}/></div>
          <div style={{marginBottom:10}}><label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",display:"block",marginBottom:4}}>開始日</label><input className="fi" type="date" value={form.startDate} onChange={e=>upd("startDate",e.target.value)}/></div>
          <div style={{marginBottom:10}}><label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",display:"block",marginBottom:4}}>有効期限</label><input className="fi" type="date" value={form.expiryDate} onChange={e=>upd("expiryDate",e.target.value)}/></div>
        </div>
        <div style={{marginBottom:10}}><label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",display:"block",marginBottom:4}}>児童発達支援管理責任者</label><input className="fi" value={form.staffName} onChange={e=>upd("staffName",e.target.value)}/></div>
      </div>

      {/* 意向 */}
      <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:14,marginBottom:10}}>
        <div style={{fontSize:11,fontWeight:700,color:"var(--tl)",letterSpacing:1,marginBottom:10}}>■ 利用児及び家族の生活に対する意向</div>
        <div style={{marginBottom:10}}><label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",display:"block",marginBottom:4}}>〜 本人 〜</label><textarea className="fta" style={{minHeight:70}} value={form.childWish} onChange={e=>upd("childWish",e.target.value)} placeholder="本人の希望・意向を記入"/></div>
        <div><label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",display:"block",marginBottom:4}}>〜 家族 〜</label><textarea className="fta" style={{minHeight:70}} value={form.familyWish} onChange={e=>upd("familyWish",e.target.value)} placeholder="保護者の希望・意向を記入"/></div>
      </div>

      {/* 方針・目標 */}
      <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:14,marginBottom:10}}>
        <div style={{fontSize:11,fontWeight:700,color:"var(--tl)",letterSpacing:1,marginBottom:10}}>■ 支援方針・目標</div>
        <div style={{marginBottom:10}}><label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",display:"block",marginBottom:4}}>総合的な支援の方針</label><textarea className="fta" style={{minHeight:60}} value={form.overallPolicy} onChange={e=>upd("overallPolicy",e.target.value)}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 120px",gap:"0 10px",marginBottom:10}}>
          <div><label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",display:"block",marginBottom:4}}>長期目標（内容）</label><textarea className="fta" style={{minHeight:60}} value={form.longTermGoal} onChange={e=>upd("longTermGoal",e.target.value)}/></div>
          <div><label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",display:"block",marginBottom:4}}>期間</label><input className="fi" value={form.longTermPeriod} onChange={e=>upd("longTermPeriod",e.target.value)} placeholder="12ヶ月"/></div>
        </div>
        <div style={{marginBottom:10}}><label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",display:"block",marginBottom:4}}>支援の標準的な提供時間帯（曜日・頻度・時間）</label><textarea className="fta" style={{minHeight:50}} value={form.supportTimeSlot} onChange={e=>upd("supportTimeSlot",e.target.value)} placeholder="例）毎週月曜日から金曜日（長期休暇も利用）"/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 120px",gap:"0 10px",marginBottom:10}}>
          <div><label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",display:"block",marginBottom:4}}>短期目標（内容）</label><textarea className="fta" style={{minHeight:60}} value={form.shortTermGoal} onChange={e=>upd("shortTermGoal",e.target.value)}/></div>
          <div><label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",display:"block",marginBottom:4}}>期間</label><input className="fi" value={form.shortTermPeriod} onChange={e=>upd("shortTermPeriod",e.target.value)} placeholder="6ヶ月"/></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 12px"}}>
          <div style={{marginBottom:10}}><label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",display:"block",marginBottom:4}}>利用日数</label><input className="fi" value={form.usageDays} onChange={e=>upd("usageDays",e.target.value)} placeholder="例）月〜金 週5日"/></div>
          <div style={{marginBottom:10}}><label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",display:"block",marginBottom:4}}>迎え</label><input className="fi" value={form.pickupNote} onChange={e=>upd("pickupNote",e.target.value)} placeholder="あり 学校・自宅"/></div>
          <div style={{marginBottom:10}}><label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",display:"block",marginBottom:4}}>送り</label><input className="fi" value={form.dropoffNote} onChange={e=>upd("dropoffNote",e.target.value)} placeholder="あり 自宅"/></div>
        </div>
      </div>

      {/* 支援目標テーブル */}
      <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:14,marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:700,color:"var(--tl)",letterSpacing:1}}>■ 支援目標</div>
          <button onClick={addGoalRow} style={{padding:"5px 12px",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid var(--tl)",background:"rgba(58,160,216,0.1)",color:"var(--tl)"}}>＋ 行を追加</button>
        </div>
        {form.goals.map((g,i)=>(
          <div key={g.id} style={{border:"1px solid var(--bd)",borderRadius:9,padding:12,marginBottom:10,background:"var(--bg)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontSize:12,fontWeight:700,color:"var(--tl)"}}>No.{i+1}</span>
              {form.goals.length>1&&<button onClick={()=>removeGoalRow(g.id)} style={{padding:"3px 9px",borderRadius:7,fontSize:11,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1px solid rgba(224,56,56,0.4)",background:"rgba(224,56,56,0.08)",color:"var(--ro)",fontWeight:700}}>削除</button>}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px",marginBottom:8}}>
              <div><label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",display:"block",marginBottom:4}}>優先順位（種別）</label>
                <div style={{display:"flex",gap:6}}>{ISP_PRIORITY_TYPES.map(t=><button key={t} onClick={()=>updGoal(g.id,"priority",t)} style={{padding:"5px 10px",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",borderColor:g.priority===t?"var(--tl)":"var(--bd)",background:g.priority===t?"rgba(58,160,216,0.2)":"var(--bg)",color:g.priority===t?"var(--tl)":"var(--tx3)"}}>{t}</button>)}</div>
              </div>
              <div><label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",display:"block",marginBottom:4}}>達成見込</label><input className="fi" value={g.period} onChange={e=>updGoal(g.id,"period",e.target.value)} placeholder="12ヶ月"/></div>
            </div>
            <div style={{marginBottom:8}}><label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",display:"block",marginBottom:4}}>具体的な達成目標</label><textarea className="fta" style={{minHeight:60}} value={g.achievement} onChange={e=>updGoal(g.id,"achievement",e.target.value)}/></div>
            <div style={{marginBottom:8}}>
              <label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",display:"block",marginBottom:6}}>支援内容（5領域との関連　複数選択可）</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{ISP_DOMAINS.map(d=><button key={d} onClick={()=>togDomain(g.id,d)} style={{padding:"5px 10px",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",borderColor:g.domains.includes(d)?"#7030b8":"var(--bd)",background:g.domains.includes(d)?"rgba(144,72,216,0.18)":"var(--bg)",color:g.domains.includes(d)?"var(--pu)":"var(--tx3)"}}>{d}</button>)}</div>
            </div>
            <div><label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",display:"block",marginBottom:4}}>振り返り欄</label><textarea className="fta" style={{minHeight:50}} value={g.reflection} onChange={e=>updGoal(g.id,"reflection",e.target.value)} placeholder="支援後の振り返り・変化を記入"/></div>
          </div>
        ))}
      </div>

      {/* 別表：週間予定 */}
      <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:14,marginBottom:10}}>
        <div style={{fontSize:11,fontWeight:700,color:"var(--tl)",letterSpacing:1,marginBottom:10}}>■ 別表：週間提供時間</div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:500}}>
            <thead>
              <tr style={{background:"var(--bg2)"}}><th style={{border:"1px solid var(--bd)",padding:"5px 4px",fontSize:10}}></th>
                {WEEKDAY_LABELS.map(w=><th key={w} style={{border:"1px solid var(--bd)",padding:"5px 4px",fontSize:10,textAlign:"center"}}>{w}</th>)}</tr>
            </thead>
            <tbody>
              <tr><td style={{border:"1px solid var(--bd)",padding:"4px 6px",fontSize:10,fontWeight:700,background:"var(--bg2)",whiteSpace:"nowrap"}}>開始時間</td>
                {WEEKDAY_KEYS2.map(k=><td key={k} style={{border:"1px solid var(--bd)",padding:3}}><input style={{width:"100%",border:"none",background:"transparent",textAlign:"center",fontSize:11,fontFamily:"'Noto Sans JP',sans-serif",color:"var(--tx)"}} value={form.schedule[k].start} onChange={e=>updSched(k,"start",e.target.value)} placeholder="--:--"/></td>)}</tr>
              <tr><td style={{border:"1px solid var(--bd)",padding:"4px 6px",fontSize:10,fontWeight:700,background:"var(--bg2)",whiteSpace:"nowrap"}}>終了時間</td>
                {WEEKDAY_KEYS2.map(k=><td key={k} style={{border:"1px solid var(--bd)",padding:3}}><input style={{width:"100%",border:"none",background:"transparent",textAlign:"center",fontSize:11,fontFamily:"'Noto Sans JP',sans-serif",color:"var(--tx)"}} value={form.schedule[k].end} onChange={e=>updSched(k,"end",e.target.value)} placeholder="--:--"/></td>)}</tr>
              <tr><td style={{border:"1px solid var(--bd)",padding:"4px 6px",fontSize:10,fontWeight:700,background:"var(--bg2)",whiteSpace:"nowrap"}}>延長（支援前）</td>
                {WEEKDAY_KEYS2.map(k=><td key={k} style={{border:"1px solid var(--bd)",padding:3}}><input style={{width:"100%",border:"none",background:"transparent",textAlign:"center",fontSize:11,fontFamily:"'Noto Sans JP',sans-serif",color:"var(--tx)"}} value={form.extBefore[k]} onChange={e=>updExt("extBefore",k,e.target.value)} placeholder=""/></td>)}</tr>
              <tr><td style={{border:"1px solid var(--bd)",padding:"4px 6px",fontSize:10,fontWeight:700,background:"var(--bg2)",whiteSpace:"nowrap"}}>延長（支援後）</td>
                {WEEKDAY_KEYS2.map(k=><td key={k} style={{border:"1px solid var(--bd)",padding:3}}><input style={{width:"100%",border:"none",background:"transparent",textAlign:"center",fontSize:11,fontFamily:"'Noto Sans JP',sans-serif",color:"var(--tx)"}} value={form.extAfter[k]} onChange={e=>updExt("extAfter",k,e.target.value)} placeholder=""/></td>)}</tr>
            </tbody>
          </table>
        </div>
        <div style={{marginTop:10}}><label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",display:"block",marginBottom:4}}>特記事項</label><textarea className="fta" style={{minHeight:50}} value={form.specialNote} onChange={e=>upd("specialNote",e.target.value)}/></div>
        <div style={{marginTop:8}}><label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",display:"block",marginBottom:4}}>延長を必要とする理由及び時数</label><textarea className="fta" style={{minHeight:50}} value={form.extReason} onChange={e=>upd("extReason",e.target.value)}/></div>
      </div>

      <button className="bsave" onClick={save}>保存する</button>
    </div>
  );

  // --- 一覧 ---
  return (
    <div style={{paddingBottom:28}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontSize:13,fontWeight:700}}>📋 個別支援計画（原案）一覧</div>
        <button className="bsave" style={{width:"auto",padding:"7px 16px",marginTop:0}} onClick={()=>setMode("new")}>＋ 新規作成</button>
      </div>
      {myIspDrafts.length===0
        ? <div style={{textAlign:"center",color:"var(--tx3)",padding:"36px 0",fontSize:13}}>個別支援計画（原案）がありません</div>
        : myIspDrafts.map(d=>(
          <div key={d.id} className="isp-card" onClick={()=>{setViewItem(d);setMode("view");}}>
            <div className="isp-name">第{d.creationCount}回　作成日：{d.createdAt}</div>
            <div className="isp-date">開始日：{d.startDate}　有効期限：{d.expiryDate}</div>
            {d.longTermGoal&&<div className="isp-goal">{d.longTermGoal.slice(0,50)}{d.longTermGoal.length>50?"…":""}</div>}
          </div>
        ))
      }
    </div>
  );
}


// ==================== 個別支援計画 管理システム ====================
// 設計原則: AIは原案作成まで。最終確定は児発管責任者が承認する。
// 承認フロー: AI生成→担当確認→児発管承認→管理者確認→保護者説明→保護者同意→確定
// 監査対応: 誰が作成・修正・承認したかの完全な履歴を保持する

// ─── トースト通知コンポーネント ───
function Toast({msg, type}){
  if(!msg) return null;
  const bg = type==="error" ? "var(--ro)" : type==="warn" ? "var(--am)" : "var(--gr)";
  const icon = type==="error" ? "❌" : type==="warn" ? "⚠️" : "✅";
  return <div style={{
    position:"fixed",bottom:28,left:"50%",transform:"translateX(-50%)",
    background:bg,color:"#fff",padding:"12px 24px",borderRadius:14,
    fontWeight:700,fontSize:13,zIndex:99999,whiteSpace:"nowrap",
    boxShadow:"0 6px 24px rgba(0,0,0,0.35)",
    fontFamily:"'Noto Sans JP',sans-serif",
    animation:"toastIn .25s cubic-bezier(.4,0,.2,1)"
  }}>{icon} {msg}</div>;
}

// ─── 承認フロー定義 ───
const ISP_FLOW_STEPS = [
  {key:"ai_draft",          label:"AI原案",     icon:"🤖", color:"#888"},
  {key:"staff_checked",     label:"担当確認",   icon:"✏️", color:"var(--tl)"},
  {key:"cdsm_approved",     label:"児発管承認", icon:"🎓", color:"var(--am)"},
  {key:"manager_confirmed", label:"管理者確認", icon:"👔", color:"var(--ac)"},
  {key:"parent_explained",  label:"保護者説明", icon:"💬", color:"var(--gr)"},
  {key:"parent_consented",  label:"保護者同意", icon:"✍️", color:"var(--gr)"},
  {key:"finalized",         label:"確定",       icon:"✅", color:"var(--gr2)"},
];

// 各ステータスで次に進める役割とアクション
const ISP_NEXT_ACTION = {
  "ai_draft":          {roles:["staff","specialist","cdsm","manager","admin"], label:"担当職員として内容を確認した", next:"staff_checked"},
  "staff_checked":     {roles:["cdsm","admin"],                               label:"児発管として修正・承認した",    next:"cdsm_approved"},
  "cdsm_approved":     {roles:["manager","admin"],                            label:"管理者として確認した",          next:"manager_confirmed"},
  "manager_confirmed": {roles:["manager","admin","cdsm"],                     label:"保護者への説明が完了した",      next:"parent_explained"},
  "parent_explained":  {roles:["cdsm","manager","admin"],                     label:"保護者の同意を取得した",        next:"parent_consented"},
  "parent_consented":  {roles:["cdsm","manager","admin"],                     label:"計画を確定する",               next:"finalized"},
};

const ISP_STATUS_COLOR = {
  ai_draft:"var(--tx3)",         staff_checked:"var(--tl)",
  cdsm_approved:"var(--am)",     manager_confirmed:"var(--ac)",
  parent_explained:"var(--gr)",  parent_consented:"var(--gr)",
  finalized:"var(--gr2)",
};

const ISP_DOC_LABELS = {
  assessment:"アセスメント", isp_plan:"個別支援計画",
  weekly_plan:"週間支援計画", monitoring:"モニタリング",
  meeting:"会議記録",        consent:"保護者同意書",
};

// ─── AI原案生成（テンプレートベース） ───
function generateIspDraftContent(u, assessments, isps, recs) {
  const latestA = [...assessments].filter(a=>a.userId===u.id)
    .sort((a,b)=>b.date>a.date?1:-1)[0] || {};
  const latestIsp = [...isps].filter(i=>i.userId===u.id)
    .sort((a,b)=>b.createdAt>a.createdAt?1:-1)[0] || {};
  const svcs = recs.filter(r=>r.userId===u.id && r.type==="service").slice(-30);

  const grade  = u.grade  ? `${u.grade}` : "小学生";
  const gender = u.gender==="男"?"彼":(u.gender==="女"?"彼女":"本人");
  const dis    = u.disability || latestA.disabilityType || "発達障害";

  // 支援実績からキーワード抽出
  const svcNotes = svcs.map(s=>s.note||s.serviceContent||"").filter(Boolean).join("、");
  const svcHint  = svcNotes.length>0 ? `（支援実績: ${svcNotes.slice(0,50)}）` : "";

  const prevLong  = latestIsp.longGoal  || "";
  const prevShort = latestIsp.shortGoal || "";

  return {
    // 本人・保護者のニーズ
    userNeeds: latestA.concerns || `${u.name}さんが友達と一緒に楽しく活動でき、自分の気持ちを言葉で伝えられるようになること`,
    parentNeeds: latestA.parentWishes || "集団の中でのコミュニケーション力を育てほしい。学校生活に必要な生活習慣を身につけてほしい。",
    // 長期目標（前回あれば引き継ぎ、なければ生成）
    longGoal: prevLong || `自分の感情や気持ちを言葉や表情で相手に伝えられるようになる（${grade}）${svcHint}`,
    longGoalTerm: "1年間",
    // 短期目標
    shortGoal: prevShort || `支援員のサポートを受けながら、活動の切り替えを5分以内にできる場面を増やす`,
    shortGoalTerm: "6ヶ月",
    // 支援内容
    supportContent: `① 視覚的なスケジュールを活用し、活動の見通しを持てるよう支援する\n② 気持ちカードや感情チャートを使い、感情の言語化を促す\n③ 成功体験を積み重ね、自己肯定感を高める支援を行う\n④ 保護者と連携し、家庭でも継続した支援ができるよう情報共有する`,
    specificMethods: `・入室時にその日の活動スケジュールをホワイトボードで提示する\n・活動移行時は3分前予告を実施し、切り替えやすい環境を整える\n・感情が高ぶった際は別室での落ち着きスペースを提供する\n・毎回の連絡帳に具体的なエピソードを記録し保護者と共有する`,
    staffInCharge: "",
    frequency: "週3〜4回",
    achievementDate: "",
    evaluationMethod: "月1回の職員ミーティングでの実績確認、3ヶ月ごとのモニタリング実施",
    reviewDate: "",
    // 障害特性・環境
    disabilityType: dis,
    characteristics: latestA.characteristics || `感覚過敏（聴覚・触覚）があり、急な予定変更が苦手。言語理解は年齢相応だが、表出言語に遅れがある。`,
    environment: latestA.schoolSituation || "通常学級在籍。学校での集団活動は概ね参加できているが、昼休みは一人で過ごすことが多い。",
    staffObservation: latestA.staffObservations || "活動への意欲は高い。好きな活動（工作・読書）では集中して取り組める。",
    // メタ情報
    generatedFrom: {
      hasAssessment: !!latestA.id,
      hasPrevIsp: !!latestIsp.id,
      svcCount: svcs.length,
      assessmentDate: latestA.date || null,
      prevIspPeriod: latestIsp.period || null,
    },
  };
}

// ─── ステータスバッジ ───
function IspStatusBadge({status, small}){
  const step = ISP_FLOW_STEPS.find(s=>s.key===status) || ISP_FLOW_STEPS[0];
  return <span style={{
    display:"inline-flex",alignItems:"center",gap:3,
    padding:small?"2px 7px":"4px 10px",
    borderRadius:20,fontSize:small?10:11,fontWeight:700,
    background:`${step.color}22`,color:step.color,border:`1px solid ${step.color}55`,
  }}>{step.icon} {step.label}</span>;
}

// ─── 承認フローバー ───
function IspFlowBar({status}){
  const idx = ISP_FLOW_STEPS.findIndex(s=>s.key===status);
  return <div style={{display:"flex",alignItems:"center",gap:0,marginBottom:14,overflowX:"auto",paddingBottom:4}}>
    {ISP_FLOW_STEPS.map((step,i)=>{
      const done = i < idx;
      const curr = i === idx;
      return <React.Fragment key={step.key}>
        {i>0&&<div style={{flex:"0 0 16px",height:2,background:done?"var(--tl)":"var(--bd)",transition:"background .3s"}}/>}
        <div style={{
          display:"flex",flexDirection:"column",alignItems:"center",gap:2,
          opacity: done||curr ? 1 : 0.4,
          transition:"opacity .3s",
        }}>
          <div style={{
            width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:13,background:curr?step.color:done?"var(--tl)":"var(--bd)",
            color:curr||done?"#fff":"var(--tx3)",fontWeight:700,flexShrink:0,
          }}>{done?"✓":step.icon}</div>
          <div style={{fontSize:9,color:curr?step.color:done?"var(--tl)":"var(--tx3)",fontWeight:curr?700:400,whiteSpace:"nowrap"}}>{step.label}</div>
        </div>
      </React.Fragment>;
    })}
  </div>;
}

// ─── アセスメントフォーム ───
function IspAssessmentForm({record, u, user, store, onSave, onCancel}){
  const init = record?.content || {};
  const [f,setF] = useState({
    disabilityType: init.disabilityType||u.disability||"",
    characteristics: init.characteristics||"",
    concerns: init.concerns||"",
    parentWishes: init.parentWishes||"",
    schoolSituation: init.schoolSituation||"",
    homeLife: init.homeLife||"",
    strengths: init.strengths||"",
    staffObservations: init.staffObservations||"",
    previousIspReview: init.previousIspReview||"",
    date: init.date||todayISO(),
  });
  const upd=(k,v)=>setF(p=>({...p,[k]:v}));
  const [saving,setSaving]=useState(false);

  const fields = [
    {key:"disabilityType",    label:"障害種別・診断名",       rows:1, req:true},
    {key:"characteristics",   label:"障害特性・行動特性",     rows:3, req:true},
    {key:"concerns",          label:"本人の困りごと・ニーズ", rows:3, req:true},
    {key:"parentWishes",      label:"保護者の希望・要望",     rows:3, req:true},
    {key:"schoolSituation",   label:"学校・園での様子",       rows:3},
    {key:"homeLife",          label:"家庭での様子",           rows:2},
    {key:"strengths",         label:"本人の強み・得意なこと", rows:2},
    {key:"staffObservations", label:"職員の気づき・所見",     rows:3},
    {key:"previousIspReview", label:"前回計画の振り返り",     rows:2},
  ];

  const handleSave=()=>{
    setSaving(true);
    const histEntry={actor:user.displayName,role:user.role,action:record?"更新":"新規作成",at:nowStr(),note:""};
    try{
      if(record){
        store.updIspRecord(record.id,{content:f,status:"staff_checked",updatedAt:nowStr(),
          history:[...(record.history||[]),histEntry]});
      } else {
        store.addIspRecord({id:genId(),userId:u.id,facilityId:u.facilityId,
          docType:"assessment",status:"staff_checked",content:f,
          createdBy:user.displayName,createdAt:nowStr(),updatedAt:nowStr(),
          history:[histEntry]});
      }
      store.showToast(record?"アセスメントを更新しました":"アセスメントを保存しました");
    }catch(e){ store.showToast("保存に失敗しました","error"); }
    setSaving(false);
    onSave();
  };

  return <div style={{paddingBottom:28}}>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
      <button className="bback" onClick={onCancel}>← 戻る</button>
      <div style={{fontSize:15,fontWeight:900}}>🔍 アセスメントシート</div>
    </div>
    <div style={{background:"rgba(58,160,216,0.07)",border:"1px solid rgba(58,160,216,0.2)",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,color:"var(--tl)"}}>
      📋 アセスメントは個別支援計画原案の基礎となります。できるだけ具体的に記入してください。
    </div>
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:16,boxShadow:"var(--sh)"}}>
      <div className="fg"><label className="fl">実施日</label>
        <input className="fi" type="date" value={f.date} onChange={e=>upd("date",e.target.value)}/></div>
      {fields.map(({key,label,rows,req})=>(
        <div key={key} className="fg">
          <label className="fl">{label}{req&&<span style={{color:"var(--ro)"}}> *</span>}</label>
          {rows===1
            ? <input className="fi" value={f[key]} onChange={e=>upd(key,e.target.value)} placeholder={label+"を入力"}/>
            : <textarea className="fta" rows={rows} value={f[key]} onChange={e=>upd(key,e.target.value)}
                style={{minHeight:rows*28}} placeholder={label+"を入力"}/>}
        </div>
      ))}
      <div style={{display:"flex",gap:10,marginTop:8}}>
        <button className="bcancel" onClick={onCancel}>キャンセル</button>
        <button className="bsave" onClick={handleSave} disabled={saving||!f.disabilityType||!f.concerns}
          style={{opacity:saving||!f.disabilityType||!f.concerns?0.5:1}}>
          {saving?"保存中…":"💾 保存する"}
        </button>
      </div>
    </div>
  </div>;
}

// ─── 個別支援計画フォーム（AI原案生成つき） ───
function IspPlanForm({record, u, user, store, onSave, onCancel}){
  const init = record?.content || {};
  const [f,setF] = useState({
    userNeeds:"",parentNeeds:"",longGoal:"",longGoalTerm:"1年間",
    shortGoal:"",shortGoalTerm:"6ヶ月",supportContent:"",specificMethods:"",
    staffInCharge:user.displayName,cdsmName:"",frequency:"週3〜4回",
    achievementDate:"",evaluationMethod:"",reviewDate:"",
    validFrom:"",validTo:"",supportPeriod:"",...init,
  });
  const upd=(k,v)=>setF(p=>({...p,[k]:v}));
  const [generating,setGenerating]=useState(false);
  const [generated,setGenerated]=useState(false);
  const [saving,setSaving]=useState(false);
  const [note,setNote]=useState("");

  const handleGenerate=()=>{
    setGenerating(true);
    setTimeout(()=>{
      const draft = generateIspDraftContent(u, store.assessments||[], store.isps||[], store.recs||[]);
      setF(p=>({...p,...draft}));
      setGenerating(false);
      setGenerated(true);
    }, 900);
  };

  const handleSave=()=>{
    setSaving(true);
    const histEntry={actor:user.displayName,role:user.role,action:record?"更新":"AI原案作成",at:nowStr(),note};
    try{
      if(record){
        // 確定済みを編集した場合は再確認が必要なため staff_checked に戻す
        const newStatus = record.status==="finalized" ? "staff_checked" : record.status;
        store.updIspRecord(record.id,{content:f,status:newStatus,updatedAt:nowStr(),
          history:[...(record.history||[]),histEntry]});
      } else {
        store.addIspRecord({id:genId(),userId:u.id,facilityId:u.facilityId,
          docType:"isp_plan",status:"ai_draft",content:f,
          createdBy:user.displayName,createdAt:nowStr(),updatedAt:nowStr(),
          history:[histEntry]});
      }
      store.showToast(record?"個別支援計画を更新しました":"個別支援計画の原案を保存しました");
    }catch(e){ store.showToast("保存に失敗しました","error"); }
    setSaving(false);
    onSave();
  };

  return <div style={{paddingBottom:28}}>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
      <button className="bback" onClick={onCancel}>← 戻る</button>
      <div style={{fontSize:15,fontWeight:900}}>📄 個別支援計画 {record?"編集":"作成"}</div>
    </div>

    {/* 確定済み編集の注意バナー */}
    {record?.status==="finalized"&&<div style={{background:"rgba(240,112,32,0.1)",border:"1px solid rgba(240,112,32,0.4)",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,color:"var(--am)",fontWeight:700}}>
      ⚠️ 確定済みの計画を編集しています。保存後は「担当確認待ち」に戻り、再承認が必要になります。
    </div>}

    {/* AI生成ボタン */}
    {!record&&<div style={{background:"rgba(58,160,216,0.08)",border:"1px solid rgba(58,160,216,0.3)",borderRadius:12,padding:14,marginBottom:16}}>
      <div style={{fontSize:13,fontWeight:700,color:"var(--tl)",marginBottom:6}}>🤖 AI原案自動生成</div>
      <div style={{fontSize:11,color:"var(--tx3)",marginBottom:10}}>アセスメント・過去の計画・支援記録をもとに原案を自動生成します。<br/>生成後は必ず担当職員が内容を確認・修正してください。</div>
      <button onClick={handleGenerate} disabled={generating}
        style={{padding:"10px 20px",borderRadius:10,background:"var(--tl)",color:"#fff",fontWeight:700,fontSize:13,border:"none",cursor:"pointer",opacity:generating?0.7:1,fontFamily:"'Noto Sans JP',sans-serif"}}>
        {generating?"⏳ 生成中…（約1秒）":"🤖 AI原案を生成する"}
      </button>
      {generated&&<div style={{marginTop:8,fontSize:11,color:"var(--gr)",fontWeight:700}}>✅ 原案を生成しました。内容を確認・修正してから保存してください。</div>}
    </div>}

    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:16,boxShadow:"var(--sh)"}}>
      {/* 計画期間 */}
      <div style={{fontSize:11,fontWeight:700,color:"var(--tl)",letterSpacing:1,marginBottom:10}}>▍計画期間</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <div className="fg" style={{marginBottom:0}}><label className="fl">開始日</label>
          <input className="fi" type="date" value={f.validFrom} onChange={e=>upd("validFrom",e.target.value)}/></div>
        <div className="fg" style={{marginBottom:0}}><label className="fl">終了日</label>
          <input className="fi" type="date" value={f.validTo} onChange={e=>upd("validTo",e.target.value)}/></div>
      </div>

      {/* ニーズ */}
      <div style={{fontSize:11,fontWeight:700,color:"var(--tl)",letterSpacing:1,marginBottom:10}}>▍ニーズ</div>
      {[{k:"userNeeds",l:"本人のニーズ",req:true},{k:"parentNeeds",l:"保護者のニーズ",req:true}].map(({k,l,req})=>(
        <div key={k} className="fg">
          <label className="fl">{l}{req&&<span style={{color:"var(--ro)"}}> *</span>}</label>
          <textarea className="fta" rows={2} value={f[k]} onChange={e=>upd(k,e.target.value)} placeholder={l+"を入力"}/>
        </div>
      ))}

      {/* 目標 */}
      <div style={{fontSize:11,fontWeight:700,color:"var(--tl)",letterSpacing:1,marginBottom:10,marginTop:6}}>▍目標</div>
      <div className="fg"><label className="fl">長期目標 <span style={{color:"var(--ro)"}}>*</span></label>
        <textarea className="fta" rows={2} value={f.longGoal} onChange={e=>upd("longGoal",e.target.value)} placeholder="長期目標（例：自分の気持ちを言葉で伝えられるようになる）"/></div>
      <div className="fg"><label className="fl">長期目標の期間</label>
        <input className="fi" value={f.longGoalTerm} onChange={e=>upd("longGoalTerm",e.target.value)} placeholder="例: 1年間"/></div>
      <div className="fg"><label className="fl">短期目標 <span style={{color:"var(--ro)"}}>*</span></label>
        <textarea className="fta" rows={2} value={f.shortGoal} onChange={e=>upd("shortGoal",e.target.value)} placeholder="短期目標（例：支援員のサポートを受けながら…）"/></div>
      <div className="fg"><label className="fl">短期目標の期間</label>
        <input className="fi" value={f.shortGoalTerm} onChange={e=>upd("shortGoalTerm",e.target.value)} placeholder="例: 6ヶ月"/></div>

      {/* 支援内容 */}
      <div style={{fontSize:11,fontWeight:700,color:"var(--tl)",letterSpacing:1,marginBottom:10,marginTop:6}}>▍支援内容</div>
      <div className="fg"><label className="fl">支援内容 <span style={{color:"var(--ro)"}}>*</span></label>
        <textarea className="fta" rows={4} value={f.supportContent} onChange={e=>upd("supportContent",e.target.value)} placeholder="支援内容を箇条書きで入力"/></div>
      <div className="fg"><label className="fl">具体的な手立て</label>
        <textarea className="fta" rows={4} value={f.specificMethods} onChange={e=>upd("specificMethods",e.target.value)} placeholder="具体的な支援手順・方法を記入"/></div>

      {/* 実施体制 */}
      <div style={{fontSize:11,fontWeight:700,color:"var(--tl)",letterSpacing:1,marginBottom:10,marginTop:6}}>▍実施体制・評価</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div className="fg" style={{marginBottom:0}}><label className="fl">担当職員</label>
          <input className="fi" value={f.staffInCharge} onChange={e=>upd("staffInCharge",e.target.value)} placeholder="担当職員名"/></div>
        <div className="fg" style={{marginBottom:0}}><label className="fl">児発管名</label>
          <input className="fi" value={f.cdsmName} onChange={e=>upd("cdsmName",e.target.value)} placeholder="児童発達支援管理責任者名"/></div>
        <div className="fg" style={{marginBottom:0}}><label className="fl">支援頻度</label>
          <input className="fi" value={f.frequency} onChange={e=>upd("frequency",e.target.value)} placeholder="例: 週3〜4回"/></div>
        <div className="fg" style={{marginBottom:0}}><label className="fl">支援期間</label>
          <input className="fi" value={f.supportPeriod} onChange={e=>upd("supportPeriod",e.target.value)} placeholder="例: 2026年4月〜2027年3月"/></div>
      </div>
      <div className="fg"><label className="fl">達成時期</label>
        <input className="fi" type="date" value={f.achievementDate} onChange={e=>upd("achievementDate",e.target.value)}/></div>
      <div className="fg"><label className="fl">評価方法</label>
        <textarea className="fta" rows={2} value={f.evaluationMethod} onChange={e=>upd("evaluationMethod",e.target.value)} placeholder="評価方法・評価時期を記入"/></div>
      <div className="fg"><label className="fl">見直し予定日</label>
        <input className="fi" type="date" value={f.reviewDate} onChange={e=>upd("reviewDate",e.target.value)}/></div>

      {/* 作成メモ */}
      <div className="fg"><label className="fl">作成・更新メモ（監査用）</label>
        <textarea className="fta" rows={2} value={note} onChange={e=>setNote(e.target.value)} placeholder="変更理由や特記事項があれば記入"/></div>

      <div style={{display:"flex",gap:10,marginTop:8}}>
        <button className="bcancel" onClick={onCancel}>キャンセル</button>
        <button className="bsave" onClick={handleSave}
          disabled={saving||!f.longGoal||!f.shortGoal||!f.supportContent}
          style={{opacity:saving||!f.longGoal||!f.shortGoal||!f.supportContent?0.5:1}}>
          {saving?"保存中…":(record?"💾 更新する":"💾 原案を保存する")}
        </button>
      </div>
    </div>
  </div>;
}

// ─── 週間支援計画フォーム ───
function IspWeeklyPlanForm({record, u, user, store, onSave, onCancel}){
  const DAYS = ["月","火","水","木","金","土"];
  const TIMES = ["放課後（14:00〜17:00）","夏休み等（10:00〜16:00）","その他"];
  const init = record?.content || {};
  const [slots,setSlots]=useState(init.slots||DAYS.map(d=>({day:d,attend:false,time:"放課後（14:00〜17:00）",activities:"",goals:"",notes:""})));
  const [staffNote,setStaffNote]=useState(init.staffNote||"");
  const updSlot=(i,k,v)=>setSlots(p=>p.map((s,j)=>j===i?{...s,[k]:v}:s));
  const [saving,setSaving]=useState(false);

  const handleSave=()=>{
    setSaving(true);
    const histEntry={actor:user.displayName,role:user.role,action:record?"更新":"新規作成",at:nowStr(),note:""};
    try{
      if(record){
        store.updIspRecord(record.id,{content:{slots,staffNote},status:"staff_checked",updatedAt:nowStr(),
          history:[...(record.history||[]),histEntry]});
      } else {
        store.addIspRecord({id:genId(),userId:u.id,facilityId:u.facilityId,
          docType:"weekly_plan",status:"staff_checked",content:{slots,staffNote},
          createdBy:user.displayName,createdAt:nowStr(),updatedAt:nowStr(),history:[histEntry]});
      }
      store.showToast(record?"週間支援計画を更新しました":"週間支援計画を保存しました");
    }catch(e){ store.showToast("保存に失敗しました","error"); }
    setSaving(false);
    onSave();
  };

  return <div style={{paddingBottom:28}}>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
      <button className="bback" onClick={onCancel}>← 戻る</button>
      <div style={{fontSize:15,fontWeight:900}}>📅 週間支援計画</div>
    </div>
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:16,boxShadow:"var(--sh)"}}>
      {slots.map((s,i)=>(
        <div key={s.day} style={{padding:"12px 0",borderBottom:"1px solid var(--bd)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:s.attend?10:0}}>
            <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontWeight:700,fontSize:13}}>
              <input type="checkbox" checked={s.attend} onChange={e=>updSlot(i,"attend",e.target.checked)}
                style={{width:16,height:16,cursor:"pointer"}}/>
              {s.day}曜日
            </label>
            {s.attend&&<select className="fi" style={{maxWidth:220,marginBottom:0}} value={s.time} onChange={e=>updSlot(i,"time",e.target.value)}>
              {TIMES.map(t=><option key={t}>{t}</option>)}
            </select>}
          </div>
          {s.attend&&<div style={{paddingLeft:26,display:"grid",gap:6}}>
            <div className="fg" style={{marginBottom:0}}>
              <label className="fl">活動内容</label>
              <input className="fi" value={s.activities} onChange={e=>updSlot(i,"activities",e.target.value)} placeholder="例: 工作・運動・SST"/>
            </div>
            <div className="fg" style={{marginBottom:0}}>
              <label className="fl">支援目標</label>
              <input className="fi" value={s.goals} onChange={e=>updSlot(i,"goals",e.target.value)} placeholder="この日の重点目標"/>
            </div>
            <div className="fg" style={{marginBottom:0}}>
              <label className="fl">特記事項</label>
              <input className="fi" value={s.notes} onChange={e=>updSlot(i,"notes",e.target.value)} placeholder="配慮事項・注意点など"/>
            </div>
          </div>}
        </div>
      ))}
      <div className="fg" style={{marginTop:10}}><label className="fl">職員全体の方針・注意事項</label>
        <textarea className="fta" rows={3} value={staffNote} onChange={e=>setStaffNote(e.target.value)} placeholder="全職員が把握すべき支援方針や引き継ぎ事項を記入"/></div>
      <div style={{display:"flex",gap:10,marginTop:8}}>
        <button className="bcancel" onClick={onCancel}>キャンセル</button>
        <button className="bsave" onClick={handleSave} disabled={saving} style={{opacity:saving?0.5:1}}>
          {saving?"保存中…":"💾 保存する"}
        </button>
      </div>
    </div>
  </div>;
}

// ─── モニタリング記録フォーム ───
function IspMonitoringForm({record, u, user, store, onSave, onCancel}){
  const init = record?.content || {};
  const latestIsp = [...(store.ispRecords||[])].filter(r=>r.userId===u.id&&r.docType==="isp_plan"&&r.status==="finalized")
    .sort((a,b)=>b.createdAt>a.createdAt?1:-1)[0];
  // 蓄積されたモニタリングノートを取得（ISP連携サービス記録から自動生成）
  const accNotes=(store.monitoringNotes||[]).filter(n=>n.userId===u.id).sort((a,b)=>b.date>a.date?1:-1).slice(0,20);
  const [showAcc,setShowAcc]=useState(accNotes.length>0);
  const [f,setF]=useState({
    monitoringDate: init.monitoringDate||init.date||todayISO(),
    targetPeriod: init.targetPeriod || (latestIsp ? `${latestIsp.content?.validFrom||""}〜${latestIsp.content?.validTo||""}` : ""),
    responsibleStaff: init.responsibleStaff||user.displayName,
    cdsmName: init.cdsmName||"",
    longGoalResult: init.longGoalResult||"",
    shortGoalResult: init.shortGoalResult||"",
    achievedItems: init.achievedItems||"",
    remainingChallenges: init.remainingChallenges||"",
    supportChanges: init.supportChanges||"",
    nextPlanReflection: init.nextPlanReflection||"",
    parentOpinion: init.parentOpinion||"",
    staffObservation: init.staffObservation||"",
    overallEval: init.overallEval||"概ね達成",
    date: init.date||todayISO(),
  });
  const upd=(k,v)=>setF(p=>({...p,[k]:v}));
  const [saving,setSaving]=useState(false);

  // 蓄積記録から自動入力（ワンクリック反映）
  const autoFillFromNotes=()=>{
    if(accNotes.length===0) return;
    const notes=accNotes;
    // チェック項目の頻出ワードを抽出
    const allChecked=notes.flatMap(n=>n.checkedItems||[]);
    const freq={}; allChecked.forEach(x=>{freq[x]=(freq[x]||0)+1;});
    const topItems=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k])=>k);
    // 気分の傾向
    const moods=notes.map(n=>n.mood).filter(Boolean);
    const moodSummary=moods.length>0?`（気分記録：${moods.slice(0,5).join("")}）`:"";
    const achieved=topItems.length>0?`以下の支援項目を継続して実施できた：${topItems.join("、")}。${moodSummary}`:"蓄積された記録を確認してください。";
    const staffObs=notes.slice(0,3).map(n=>n.result||n.note).filter(Boolean).join("\n");
    upd("achievedItems", achieved);
    upd("staffObservation", staffObs.slice(0,300));
    upd("shortGoalResult", `${notes.length}回の支援記録を蓄積。${notes.filter(n=>n.mood==="😄"||n.mood==="🙂").length}回は良好な様子で参加。`);
  };

  const handleSave=()=>{
    setSaving(true);
    // monitoringDateをdateにも同期して保存
    const saveContent = {...f, date:f.monitoringDate||f.date};
    const histEntry={actor:user.displayName,role:user.role,action:record?"更新":"新規作成",at:nowStr(),note:""};
    try{
      if(record){
        store.updIspRecord(record.id,{content:saveContent,status:"staff_checked",updatedAt:nowStr(),
          history:[...(record.history||[]),histEntry]});
      } else {
        store.addIspRecord({id:genId(),userId:u.id,facilityId:u.facilityId,
          docType:"monitoring",status:"staff_checked",content:saveContent,
          createdBy:user.displayName,createdAt:nowStr(),updatedAt:nowStr(),history:[histEntry]});
      }
      store.showToast(record?"モニタリングを更新しました":"モニタリングを保存しました");
    }catch(e){ store.showToast("保存に失敗しました","error"); }
    setSaving(false);
    onSave();
  };

  const evalOpts=["十分達成","概ね達成","一部達成","未達成","評価困難"];
  const evalColors={"十分達成":"var(--gr2)","概ね達成":"var(--gr)","一部達成":"var(--am)","未達成":"var(--ro)","評価困難":"var(--tx3)"};

  return <div style={{paddingBottom:28}}>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
      <button className="bback" onClick={onCancel}>← 戻る</button>
      <div style={{fontSize:15,fontWeight:900}}>📊 モニタリング記録</div>
    </div>
    {/* 蓄積データパネル（サービス記録から自動蓄積） */}
    {accNotes.length>0&&<div style={{background:"rgba(144,72,216,0.07)",border:"1px solid rgba(144,72,216,0.28)",borderRadius:12,padding:"11px 14px",marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <div style={{fontSize:12,fontWeight:700,color:"var(--pu)"}}>📊 蓄積された支援記録 ({accNotes.length}件)</div>
        <button onClick={()=>setShowAcc(p=>!p)}
          style={{fontSize:11,color:"var(--pu)",background:"none",border:"none",cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>
          {showAcc?"▲ 閉じる":"▼ 開く"}
        </button>
      </div>
      {showAcc&&<>
        <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
          {accNotes.slice(0,8).map((n,i)=>(
            <div key={i} style={{background:"var(--bg2)",borderRadius:7,padding:"3px 8px",fontSize:10,color:"var(--tx3)"}}>
              {n.date} {n.mood||""} <span style={{color:"var(--tx2)"}}>{n.result?.slice(0,15)||"記録"}</span>
            </div>
          ))}
          {accNotes.length>8&&<div style={{fontSize:10,color:"var(--tx3)"}}>…他{accNotes.length-8}件</div>}
        </div>
        <button onClick={autoFillFromNotes}
          style={{width:"100%",padding:"9px",borderRadius:10,background:"var(--pu)",color:"#fff",fontWeight:700,fontSize:12,border:"none",cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>
          🤖 蓄積記録からモニタリングを自動入力
        </button>
      </>}
    </div>}
    {latestIsp&&<div style={{background:"rgba(44,170,96,0.08)",border:"1px solid rgba(44,170,96,0.25)",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:11}}>
      <div style={{fontWeight:700,color:"var(--gr)",marginBottom:4}}>参照中の個別支援計画</div>
      <div style={{color:"var(--tx2)"}}>期間: {latestIsp.content?.validFrom}〜{latestIsp.content?.validTo}</div>
      <div style={{color:"var(--tx2)",marginTop:2}}>長期目標: {latestIsp.content?.longGoal}</div>
      <div style={{color:"var(--tx2)",marginTop:2}}>短期目標: {latestIsp.content?.shortGoal}</div>
    </div>}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:16,boxShadow:"var(--sh)"}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        <div className="fg" style={{marginBottom:0}}><label className="fl">モニタリング日 <span style={{color:"var(--ro)"}}>*</span></label>
          <input className="fi" type="date" value={f.monitoringDate} onChange={e=>upd("monitoringDate",e.target.value)}/></div>
        <div className="fg" style={{marginBottom:0}}><label className="fl">対象期間</label>
          <input className="fi" value={f.targetPeriod} onChange={e=>upd("targetPeriod",e.target.value)} placeholder="例: 2026年4月〜9月"/></div>
        <div className="fg" style={{marginBottom:0}}><label className="fl">担当職員</label>
          <input className="fi" value={f.responsibleStaff} onChange={e=>upd("responsibleStaff",e.target.value)} placeholder="担当職員名"/></div>
        <div className="fg" style={{marginBottom:0}}><label className="fl">児発管名</label>
          <input className="fi" value={f.cdsmName} onChange={e=>upd("cdsmName",e.target.value)} placeholder="児童発達支援管理責任者名"/></div>
      </div>

      {/* 総合評価 */}
      <div className="fg"><label className="fl">総合評価</label>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {evalOpts.map(o=><button key={o} onClick={()=>upd("overallEval",o)}
            style={{padding:"7px 12px",borderRadius:10,fontWeight:700,fontSize:12,cursor:"pointer",border:"1.5px solid",fontFamily:"'Noto Sans JP',sans-serif",
              borderColor:f.overallEval===o?evalColors[o]:"var(--bd)",
              background:f.overallEval===o?`${evalColors[o]}22`:"var(--bg)",
              color:f.overallEval===o?evalColors[o]:"var(--tx3)"}}>
            {o}</button>)}
        </div>
      </div>

      {[
        {k:"longGoalResult",  l:"長期目標の達成状況", rows:3, req:true},
        {k:"shortGoalResult", l:"短期目標の達成状況", rows:3, req:true},
        {k:"achievedItems",   l:"できるようになったこと・成長した点", rows:3},
        {k:"remainingChallenges",l:"まだ課題として残ること", rows:3},
        {k:"supportChanges",  l:"支援内容の変更案・改善点", rows:3},
        {k:"nextPlanReflection",l:"次回計画への反映事項", rows:3},
        {k:"parentOpinion",   l:"保護者意見・コメント", rows:3},
        {k:"staffObservation",l:"職員所見・総括", rows:3},
      ].map(({k,l,rows,req})=>(
        <div key={k} className="fg">
          <label className="fl">{l}{req&&<span style={{color:"var(--ro)"}}> *</span>}</label>
          <textarea className="fta" rows={rows} value={f[k]} onChange={e=>upd(k,e.target.value)} style={{minHeight:rows*26}} placeholder={l+"を入力"}/>
        </div>
      ))}

      <div style={{display:"flex",gap:10,marginTop:8}}>
        <button className="bcancel" onClick={onCancel}>キャンセル</button>
        <button className="bsave" onClick={handleSave}
          disabled={saving||!f.longGoalResult||!f.shortGoalResult}
          style={{opacity:saving||!f.longGoalResult||!f.shortGoalResult?0.5:1}}>
          {saving?"保存中…":"💾 保存する"}
        </button>
      </div>
    </div>
  </div>;
}

// ─── 会議・記録フォーム ───
function IspMeetingForm({record, u, user, store, onSave, onCancel}){
  const init = record?.content || {};
  const [f,setF]=useState({
    meetingType:init.meetingType||"個別支援会議",
    date:init.date||todayISO(),
    location:init.location||"",
    attendees:init.attendees||"",
    agenda:init.agenda||"",
    discussion:init.discussion||"",
    decisions:init.decisions||"",
    nextMeeting:init.nextMeeting||"",
    parentOpinion:init.parentOpinion||"",
    notes:init.notes||"",
  });
  const upd=(k,v)=>setF(p=>({...p,[k]:v}));
  const [saving,setSaving]=useState(false);

  const handleSave=()=>{
    setSaving(true);
    const histEntry={actor:user.displayName,role:user.role,action:record?"更新":"新規作成",at:nowStr(),note:""};
    try{
      if(record){
        store.updIspRecord(record.id,{content:f,updatedAt:nowStr(),
          history:[...(record.history||[]),histEntry]});
      } else {
        store.addIspRecord({id:genId(),userId:u.id,facilityId:u.facilityId,
          docType:"meeting",status:"staff_checked",content:f,
          createdBy:user.displayName,createdAt:nowStr(),updatedAt:nowStr(),history:[histEntry]});
      }
      store.showToast(record?"会議記録を更新しました":"会議記録を保存しました");
    }catch(e){ store.showToast("保存に失敗しました","error"); }
    setSaving(false);
    onSave();
  };

  const mtypes=["個別支援会議","保護者面談","担当者会議","モニタリング会議","サービス担当者会議","その他"];
  return <div style={{paddingBottom:28}}>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
      <button className="bback" onClick={onCancel}>← 戻る</button>
      <div style={{fontSize:15,fontWeight:900}}>📝 会議・記録</div>
    </div>
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:16,boxShadow:"var(--sh)"}}>
      <div className="fg"><label className="fl">会議種別</label>
        <select className="fi" value={f.meetingType} onChange={e=>upd("meetingType",e.target.value)}>
          {mtypes.map(t=><option key={t}>{t}</option>)}</select></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div className="fg" style={{marginBottom:0}}><label className="fl">開催日</label>
          <input className="fi" type="date" value={f.date} onChange={e=>upd("date",e.target.value)}/></div>
        <div className="fg" style={{marginBottom:0}}><label className="fl">場所</label>
          <input className="fi" value={f.location} onChange={e=>upd("location",e.target.value)} placeholder="例: GO HOME 相談室"/></div>
      </div>
      {[
        {k:"attendees", l:"出席者（役職・氏名）",rows:2},
        {k:"agenda",    l:"議題・協議内容",      rows:2},
        {k:"discussion",l:"討議内容・経過",       rows:4, req:true},
        {k:"decisions", l:"決定事項・合意事項",   rows:3},
        {k:"parentOpinion",l:"保護者意見・要望",  rows:2},
        {k:"nextMeeting",l:"次回会議予定",        rows:1},
        {k:"notes",     l:"特記事項",             rows:2},
      ].map(({k,l,rows,req})=>(
        <div key={k} className="fg">
          <label className="fl">{l}{req&&<span style={{color:"var(--ro)"}}> *</span>}</label>
          {rows===1
            ?<input className="fi" value={f[k]} onChange={e=>upd(k,e.target.value)} placeholder={l}/>
            :<textarea className="fta" rows={rows} value={f[k]} onChange={e=>upd(k,e.target.value)} style={{minHeight:rows*26}} placeholder={l+"を記入"}/>}
        </div>
      ))}
      <div style={{display:"flex",gap:10,marginTop:8}}>
        <button className="bcancel" onClick={onCancel}>キャンセル</button>
        <button className="bsave" onClick={handleSave}
          disabled={saving||!f.discussion} style={{opacity:saving||!f.discussion?0.5:1}}>
          {saving?"保存中…":"💾 保存する"}
        </button>
      </div>
    </div>
  </div>;
}

// ─── 保護者同意書フォーム ───
function IspConsentForm({record, u, user, store, onSave, onCancel}){
  const init = record?.content || {};
  const latestIsp = [...(store.ispRecords||[])].filter(r=>r.userId===u.id&&r.docType==="isp_plan")
    .sort((a,b)=>b.createdAt>a.createdAt?1:-1)[0];
  const [f,setF]=useState({
    ispPlanRef:init.ispPlanRef||(latestIsp?.id||""),
    explanationDate:init.explanationDate||todayISO(),
    explainedBy:init.explainedBy||user.displayName,
    parentName:init.parentName||u.parentName||"",
    relationship:init.relationship||"保護者",
    parentSignedAt:init.parentSignedAt||"",
    consentContent:init.consentContent||"個別支援計画の内容について説明を受け、内容を確認しました。上記計画に基づいた支援を実施することに同意します。",
    notes:init.notes||"",
  });
  const upd=(k,v)=>setF(p=>({...p,[k]:v}));
  const [saving,setSaving]=useState(false);

  const handleSave=()=>{
    setSaving(true);
    const signed = !!f.parentSignedAt;
    const histEntry={actor:user.displayName,role:user.role,action:record?"更新":(signed?"保護者署名取得":"説明済み記録"),at:nowStr(),note:""};
    const newStatus = signed ? "parent_consented" : "parent_explained";
    try{
      if(record){
        store.updIspRecord(record.id,{content:f,status:newStatus,updatedAt:nowStr(),
          history:[...(record.history||[]),histEntry]});
        // 関連ISP計画も進める
        if(signed&&latestIsp&&latestIsp.status==="parent_explained"){
          store.updIspRecord(latestIsp.id,{status:"parent_consented",
            history:[...(latestIsp.history||[]),{...histEntry,action:"保護者同意取得（同意書より）"}]});
        }
      } else {
        store.addIspRecord({id:genId(),userId:u.id,facilityId:u.facilityId,
          docType:"consent",status:newStatus,content:f,
          createdBy:user.displayName,createdAt:nowStr(),updatedAt:nowStr(),history:[histEntry]});
      }
      store.showToast(signed?"保護者署名を記録しました":"説明済みとして保存しました");
    }catch(e){ store.showToast("保存に失敗しました","error"); }
    setSaving(false);
    onSave();
  };

  return <div style={{paddingBottom:28}}>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
      <button className="bback" onClick={onCancel}>← 戻る</button>
      <div style={{fontSize:15,fontWeight:900}}>✍️ 保護者説明・同意書</div>
    </div>
    {latestIsp&&<div style={{background:"rgba(44,170,96,0.08)",border:"1px solid rgba(44,170,96,0.25)",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:11}}>
      <div style={{fontWeight:700,color:"var(--gr)"}}>参照中の個別支援計画: {latestIsp.content?.validFrom}〜{latestIsp.content?.validTo}</div>
      <div style={{color:"var(--tx3)",marginTop:2}}>ステータス: <IspStatusBadge status={latestIsp.status} small/></div>
    </div>}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:16,boxShadow:"var(--sh)"}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div className="fg" style={{marginBottom:0}}><label className="fl">説明日</label>
          <input className="fi" type="date" value={f.explanationDate} onChange={e=>upd("explanationDate",e.target.value)}/></div>
        <div className="fg" style={{marginBottom:0}}><label className="fl">説明者</label>
          <input className="fi" value={f.explainedBy} onChange={e=>upd("explainedBy",e.target.value)}/></div>
        <div className="fg" style={{marginBottom:0}}><label className="fl">保護者名</label>
          <input className="fi" value={f.parentName} onChange={e=>upd("parentName",e.target.value)} placeholder="保護者氏名"/></div>
        <div className="fg" style={{marginBottom:0}}><label className="fl">続柄</label>
          <input className="fi" value={f.relationship} onChange={e=>upd("relationship",e.target.value)} placeholder="例: 母"/></div>
      </div>
      <div className="fg"><label className="fl">同意文書</label>
        <textarea className="fta" rows={3} value={f.consentContent} onChange={e=>upd("consentContent",e.target.value)}/></div>
      <div className="fg"><label className="fl">保護者署名日（取得済みの場合）</label>
        <input className="fi" type="date" value={f.parentSignedAt} onChange={e=>upd("parentSignedAt",e.target.value)}/></div>
      <div className="fg"><label className="fl">備考・特記事項</label>
        <textarea className="fta" rows={2} value={f.notes} onChange={e=>upd("notes",e.target.value)} placeholder="保護者からの要望・質問への回答など"/></div>
      <div style={{display:"flex",gap:10,marginTop:8}}>
        <button className="bcancel" onClick={onCancel}>キャンセル</button>
        <button className="bsave" onClick={handleSave} disabled={saving} style={{opacity:saving?0.5:1}}>
          {saving?"保存中…":(f.parentSignedAt?"✍️ 同意署名取得を記録":"💾 説明済みとして保存")}
        </button>
      </div>
    </div>
  </div>;
}

// ─── 承認フローアクションバー ───
function IspApprovalPanel({rec, u, user, store}){
  const [note,setNote]=useState("");
  const [saving,setSaving]=useState(false);
  const next = ISP_NEXT_ACTION[rec.status];
  if(!next) return null; // finalized: no next step
  const canAct = next.roles.includes(user.role);
  const step = ISP_FLOW_STEPS.find(s=>s.key===rec.status)||ISP_FLOW_STEPS[0];

  const handleAdvance=()=>{
    if(!canAct) return;
    setSaving(true);
    const histEntry={actor:user.displayName,role:user.role,action:next.label,at:nowStr(),note};
    store.updIspRecord(rec.id,{status:next.next,updatedAt:nowStr(),
      history:[...(rec.history||[]),histEntry]});
    store.showToast(`${next.label}しました`);
    setSaving(false);
    setNote("");
  };

  const handleReject=()=>{
    if(!canAct) return;
    const reason=prompt("差し戻し理由を入力してください");
    if(!reason) return;
    const histEntry={actor:user.displayName,role:user.role,action:"差し戻し",at:nowStr(),note:reason};
    store.updIspRecord(rec.id,{status:"ai_draft",updatedAt:nowStr(),
      history:[...(rec.history||[]),histEntry]});
    store.showToast("差し戻しました","warn");
  };

  return <div style={{background:canAct?"rgba(58,160,216,0.07)":"rgba(200,200,200,0.08)",border:`1px solid ${canAct?"rgba(58,160,216,0.25)":"var(--bd)"}`,borderRadius:12,padding:14,marginBottom:14}}>
    <div style={{fontSize:12,fontWeight:700,color:canAct?"var(--tl)":"var(--tx3)",marginBottom:8}}>
      {canAct?"⚡ 次のアクション":"⏳ 承認待ち"}
    </div>
    {canAct
      ?<>
        <div style={{fontSize:12,color:"var(--tx2)",marginBottom:8}}>現在のステータス: <IspStatusBadge status={rec.status} small/> → 次のステップ: <span style={{fontWeight:700}}>{next.label}</span></div>
        <textarea className="fta" rows={2} value={note} onChange={e=>setNote(e.target.value)} placeholder="コメント・確認メモ（任意）" style={{marginBottom:8}}/>
        <div style={{display:"flex",gap:8}}>
          <button onClick={handleAdvance} disabled={saving}
            style={{flex:1,padding:"10px",borderRadius:10,background:"var(--tl)",color:"#fff",fontWeight:700,fontSize:13,border:"none",cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>
            {saving?"処理中…":`${next.label} ✓`}
          </button>
          {(rec.status!=="ai_draft")&&<button onClick={handleReject}
            style={{padding:"10px 16px",borderRadius:10,background:"rgba(224,56,56,0.1)",color:"var(--ro)",fontWeight:700,fontSize:12,border:"1px solid rgba(224,56,56,0.3)",cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>
            ↩ 差し戻し
          </button>}
        </div>
      </>
      :<div style={{fontSize:12,color:"var(--tx3)"}}>現在: <IspStatusBadge status={rec.status} small/> — 次のステップには <strong>{next.roles.map(r=>({staff:"職員",cdsm:"児発管",manager:"管理者",admin:"管理者"})[r]||r).join("・")}</strong> の操作が必要です</div>
    }
  </div>;
}

// ─── 変更履歴パネル ───
function IspHistoryPanel({rec}){
  const [open,setOpen]=useState(false);
  const hist = rec.history||[];
  if(hist.length===0) return null;
  return <div style={{marginTop:10}}>
    <button onClick={()=>setOpen(o=>!o)}
      style={{fontSize:11,color:"var(--tx3)",background:"none",border:"1px solid var(--bd)",borderRadius:8,padding:"4px 10px",cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>
      🕐 変更履歴 ({hist.length}件) {open?"▲":"▼"}
    </button>
    {open&&<div style={{marginTop:8,background:"var(--bg)",borderRadius:10,padding:10}}>
      {[...hist].reverse().map((h,i)=>(
        <div key={i} style={{padding:"6px 0",borderBottom:"1px dotted var(--bd)",fontSize:11}}>
          <span style={{color:"var(--tl)",fontWeight:700}}>{h.actor}</span>
          <span style={{color:"var(--tx3)",marginLeft:6}}>({h.role})</span>
          <span style={{marginLeft:8,color:"var(--tx2)",fontWeight:700}}>{h.action}</span>
          <span style={{marginLeft:8,color:"var(--tx3)"}}>{h.at}</span>
          {h.note&&<div style={{color:"var(--tx3)",marginTop:2,paddingLeft:4}}>メモ: {h.note}</div>}
        </div>
      ))}
    </div>}
  </div>;
}

// ─── 書類カード（一覧表示用） ───
function IspDocCard({rec, onOpen, onEdit}){
  const finalized = rec.status==="finalized";
  return <div style={{background:"var(--wh)",border:`1.5px solid ${finalized?"rgba(44,170,96,0.4)":"var(--bd)"}`,borderRadius:11,padding:14,marginBottom:10,boxShadow:"var(--sh)"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
      <div style={{fontWeight:700,fontSize:13,cursor:"pointer",flex:1}} onClick={()=>onOpen(rec)}>{ISP_DOC_LABELS[rec.docType]||rec.docType}</div>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <IspStatusBadge status={rec.status} small/>
        <button onClick={e=>{e.stopPropagation();onEdit(rec);}}
          style={{padding:"3px 10px",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"var(--bg)",border:"1.5px solid var(--tl)",color:"var(--tl)"}}>
          ✏️ 編集
        </button>
      </div>
    </div>
    <div style={{fontSize:11,color:"var(--tx3)",cursor:"pointer"}} onClick={()=>onOpen(rec)}>
      {rec.content?.date||rec.content?.validFrom||""} 　作成: {rec.createdBy}　更新: {rec.updatedAt?.slice(0,10)||""}
    </div>
    {rec.content?.validFrom&&<div style={{fontSize:11,color:"var(--tl)",marginTop:2}}>
      期間: {rec.content.validFrom} 〜 {rec.content.validTo||"未設定"}
    </div>}
    {rec.content?.longGoal&&<div style={{fontSize:11,color:"var(--tx2)",marginTop:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
      目標: {rec.content.longGoal}
    </div>}
    {(rec.history||[]).length>0&&<div style={{fontSize:10,color:"var(--tx3)",marginTop:3}}>
      履歴 {rec.history.length}件 / 最終更新: {rec.history.slice(-1)[0]?.actor}
    </div>}
  </div>;
}

// ─── 利用者別 ISP詳細ビュー ───
function IspUserDetail({u, user, store, onBack}){
  const [tab,setTab]=useState("isp_plan");
  const [editRec,setEditRec]=useState(null);
  const [creating,setCreating]=useState(false);
  const [viewRec,setViewRec]=useState(null);

  const myRecs = (store.ispRecords||[]).filter(r=>r.userId===u.id)
    .sort((a,b)=>b.createdAt>a.createdAt?1:-1);
  const tabRecs = myRecs.filter(r=>r.docType===tab);

  const TABS=[
    {k:"isp_plan",   l:"個別支援計画",  icon:"📄"},
    {k:"assessment", l:"アセスメント",   icon:"🔍"},
    {k:"weekly_plan",l:"週間支援計画",   icon:"📅"},
    {k:"monitoring", l:"モニタリング",   icon:"📊"},
    {k:"meeting",    l:"会議記録",       icon:"📝"},
    {k:"consent",    l:"保護者同意書",   icon:"✍️"},
  ];

  // アラートチェック（この利用者分）
  const today = todayISO();
  const latestIsp = myRecs.filter(r=>r.docType==="isp_plan").sort((a,b)=>b.createdAt>a.createdAt?1:-1)[0];
  const ispExpired = latestIsp && latestIsp.content?.validTo && latestIsp.content.validTo < today;
  const ispExpireSoon = latestIsp && latestIsp.content?.validTo &&
    new Date(latestIsp.content.validTo)-new Date(today) < 30*86400000 && !ispExpired;
  const pendingApproval = myRecs.filter(r=>r.status!=="finalized"&&r.status!=="ai_draft").length;
  const noConsent = latestIsp && latestIsp.status==="parent_explained" &&
    !myRecs.find(r=>r.docType==="consent"&&r.status==="parent_consented");
  const draftUnreviewed = myRecs.filter(r=>r.status==="ai_draft").length;

  const alerts=[];
  if(ispExpired) alerts.push({level:"danger",text:"個別支援計画の期限が切れています"});
  if(ispExpireSoon) alerts.push({level:"warn",text:`個別支援計画が30日以内に期限切れになります（${latestIsp.content.validTo}）`});
  if(draftUnreviewed>0) alerts.push({level:"warn",text:`AI原案 ${draftUnreviewed}件が職員確認待ちです`});
  if(pendingApproval>0) alerts.push({level:"info",text:`承認待ち書類 ${pendingApproval}件`});
  if(noConsent) alerts.push({level:"warn",text:"保護者説明済みですが同意書が未取得です"});

  // フォームを表示中
  if(creating||editRec){
    const rec = editRec;
    const cancel=()=>{setCreating(false);setEditRec(null);};
    const saved=()=>{setCreating(false);setEditRec(null);};
    if(tab==="assessment")  return <IspAssessmentForm  record={rec} u={u} user={user} store={store} onSave={saved} onCancel={cancel}/>;
    if(tab==="isp_plan")    return <IspPlanForm        record={rec} u={u} user={user} store={store} onSave={saved} onCancel={cancel}/>;
    if(tab==="weekly_plan") return <IspWeeklyPlanForm  record={rec} u={u} user={user} store={store} onSave={saved} onCancel={cancel}/>;
    if(tab==="monitoring")  return <IspMonitoringForm  record={rec} u={u} user={user} store={store} onSave={saved} onCancel={cancel}/>;
    if(tab==="meeting")     return <IspMeetingForm     record={rec} u={u} user={user} store={store} onSave={saved} onCancel={cancel}/>;
    if(tab==="consent")     return <IspConsentForm     record={rec} u={u} user={user} store={store} onSave={saved} onCancel={cancel}/>;
  }

  // 詳細ビュー（承認フロー付き）
  if(viewRec){
    const docLabel = ISP_DOC_LABELS[viewRec.docType]||viewRec.docType;
    const content = viewRec.content||{};
    return <div style={{paddingBottom:28}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button className="bback" onClick={()=>setViewRec(null)}>← 戻る</button>
          <div style={{fontSize:15,fontWeight:900}}>{docLabel}</div>
        </div>
        <button className="bsave" style={{width:"auto",padding:"7px 16px",marginTop:0,fontSize:12}}
          onClick={()=>{setTab(viewRec.docType);setEditRec(viewRec);setViewRec(null);}}>✏️ 編集</button>
      </div>

      {/* 承認フローバー */}
      {viewRec.docType==="isp_plan"&&<>
        <IspFlowBar status={viewRec.status}/>
        <IspApprovalPanel rec={viewRec} u={u} user={user} store={store}/>
      </>}

      {/* 内容表示 */}
      <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:16,boxShadow:"var(--sh)"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
          <div>
            <IspStatusBadge status={viewRec.status}/>
            <div style={{fontSize:11,color:"var(--tx3)",marginTop:4}}>作成: {viewRec.createdBy} / {viewRec.createdAt?.slice(0,10)}</div>
          </div>
        </div>
        {Object.entries(content).map(([k,v])=>{
          if(!v||k==="generatedFrom") return null;
          const labels={
            validFrom:"計画開始日",validTo:"計画終了日",
            userNeeds:"本人のニーズ",parentNeeds:"保護者のニーズ",
            longGoal:"長期目標",longGoalTerm:"長期目標期間",
            shortGoal:"短期目標",shortGoalTerm:"短期目標期間",
            supportContent:"支援内容",specificMethods:"具体的な手立て",
            staffInCharge:"担当者",frequency:"支援頻度",
            achievementDate:"達成時期",evaluationMethod:"評価方法",reviewDate:"見直し予定日",
            disabilityType:"障害種別",characteristics:"障害特性",
            concerns:"本人の困りごと",parentWishes:"保護者の希望",
            schoolSituation:"学校での様子",homeLife:"家庭での様子",
            strengths:"本人の強み",staffObservations:"職員所見",
            previousIspReview:"前回振り返り",date:"実施日",
            targetPeriod:"対象期間",overallEval:"総合評価",
            longGoalResult:"長期目標達成状況",shortGoalResult:"短期目標達成状況",
            achievedItems:"できるようになったこと",remainingChallenges:"残る課題",
            supportChanges:"支援変更案",nextPlanReflection:"次回反映",
            parentOpinion:"保護者意見",staffObservation:"職員所見",
            meetingType:"会議種別",location:"場所",attendees:"出席者",
            agenda:"議題",discussion:"討議内容",decisions:"決定事項",
            nextMeeting:"次回予定",
            explanationDate:"説明日",explainedBy:"説明者",
            parentName:"保護者名",relationship:"続柄",
            parentSignedAt:"署名日",consentContent:"同意文書",
            notes:"備考",staffNote:"職員方針",
          };
          const label = labels[k]||k;
          return <div key={k} style={{marginBottom:10}}>
            <div style={{fontSize:10,fontWeight:700,color:"var(--tl)",letterSpacing:1,marginBottom:3}}>{label}</div>
            <div style={{fontSize:13,color:"var(--tx2)",lineHeight:1.7,background:"var(--bg)",borderRadius:8,padding:"8px 10px",whiteSpace:"pre-wrap"}}>{String(v)}</div>
          </div>;
        })}
        <IspHistoryPanel rec={viewRec}/>
      </div>
    </div>;
  }

  return <div style={{paddingBottom:28}}>
    {/* ヘッダー */}
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
      <button className="bback" onClick={onBack}>← 一覧へ</button>
      <div style={{flex:1}}>
        <div style={{fontSize:15,fontWeight:900}}>{u.name}</div>
        <div style={{fontSize:11,color:"var(--tx3)"}}>{u.grade} ／ {FACILITIES.find(f=>f.id===u.facilityId)?.name}</div>
      </div>
    </div>

    {/* アラート */}
    {alerts.map((a,i)=>(
      <div key={i} className={`alert-${a.level}`} style={{borderRadius:9,padding:"9px 12px",marginBottom:8,fontSize:12,fontWeight:700}}>
        {a.level==="danger"?"🔴":a.level==="warn"?"🟡":"🔵"} {a.text}
      </div>
    ))}

    {/* タブ */}
    <div style={{display:"flex",gap:4,marginBottom:14,overflowX:"auto",paddingBottom:4}}>
      {TABS.map(t=>(
        <button key={t.k} onClick={()=>setTab(t.k)}
          style={{padding:"7px 12px",borderRadius:10,fontWeight:700,fontSize:11,cursor:"pointer",border:"1.5px solid",whiteSpace:"nowrap",fontFamily:"'Noto Sans JP',sans-serif",
            background:tab===t.k?"var(--tl)":"var(--bg)",
            color:tab===t.k?"#fff":"var(--tx3)",
            borderColor:tab===t.k?"var(--tl)":"var(--bd)"}}>
          {t.icon} {t.l}
          {myRecs.filter(r=>r.docType===t.k).length>0&&
            <span style={{marginLeft:5,background:tab===t.k?"rgba(255,255,255,0.3)":"var(--tl)",color:tab===t.k?"#fff":"#fff",borderRadius:8,padding:"1px 6px",fontSize:10}}>
              {myRecs.filter(r=>r.docType===t.k).length}
            </span>}
        </button>
      ))}
    </div>

    {/* ISP計画タブ: 最新計画のフローバーを常時表示 */}
    {tab==="isp_plan"&&latestIsp&&<>
      <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:14,marginBottom:12,boxShadow:"var(--sh)"}}>
        <div style={{fontSize:12,fontWeight:700,color:"var(--tx2)",marginBottom:8}}>最新計画の承認状況</div>
        <IspFlowBar status={latestIsp.status}/>
        <IspApprovalPanel rec={latestIsp} u={u} user={user} store={store}/>
      </div>
    </>}

    {/* 書類一覧 */}
    {tabRecs.length===0
      ?<div style={{background:"rgba(58,160,216,0.06)",border:"1px solid rgba(58,160,216,0.2)",borderRadius:11,padding:"20px 14px",textAlign:"center",color:"var(--tx3)",fontSize:13}}>
        {ISP_DOC_LABELS[tab]||tab}がまだありません
        {tab==="isp_plan"&&<div style={{fontSize:11,color:"var(--tx3)",marginTop:6}}>💡 まずアセスメントを完成させてから、AI原案生成をお試しください</div>}
      </div>
      :tabRecs.map(rec=><IspDocCard key={rec.id} rec={rec} onOpen={r=>{setViewRec(r);setTab(r.docType);}} onEdit={r=>{setTab(r.docType);setEditRec(r);}}/>)
    }

    {/* 新規作成ボタン */}
    <button className="bsave" style={{marginTop:8}} onClick={()=>setCreating(true)}>
      ＋ {ISP_DOC_LABELS[tab]||tab}を新規作成
    </button>
  </div>;
}

// ─── ISPスクリーン（トップレベル） ───
function IspScreen({user, store, onBack}){
  const [selUser,setSelUser]=useState(null);
  const [searchQ,setSearchQ]=useState("");
  const fac = user.selectedFacilityId;
  const today = todayISO();

  // 対象施設の利用者一覧
  const allUsers=[...(store.dynUsers||[])];
  const myUsers = allUsers.filter(u=>!fac||u.facilityId===fac||user.role==="admin");
  const filteredUsers = myUsers.filter(u=>
    !searchQ || u.name.includes(searchQ) || (u.grade||"").includes(searchQ)
  );

  // 利用者ごとのISP状況サマリー
  const getIspSummary=(uid)=>{
    const recs = (store.ispRecords||[]).filter(r=>r.userId===uid);
    const latestIsp = recs.filter(r=>r.docType==="isp_plan").sort((a,b)=>b.createdAt>a.createdAt?1:-1)[0];
    const hasAssessment = recs.some(r=>r.docType==="assessment");
    const pendingCount = recs.filter(r=>r.status!=="finalized"&&r.status!=="ai_draft").length;
    const draftCount = recs.filter(r=>r.status==="ai_draft").length;
    const lastMonitoring = recs.filter(r=>r.docType==="monitoring").sort((a,b)=>b.createdAt>a.createdAt?1:-1)[0];

    let urgency = "none";
    let urgencyText = "記録なし";
    let urgencyColor = "var(--tx3)";

    if(!latestIsp){
      urgency="warn"; urgencyText="計画未作成"; urgencyColor="var(--am)";
    } else if(latestIsp.content?.validTo && latestIsp.content.validTo < today){
      urgency="danger"; urgencyText="計画期限切れ"; urgencyColor="var(--ro)";
    } else if(latestIsp.status==="finalized"){
      urgency="ok"; urgencyText="計画有効"; urgencyColor="var(--gr)";
    } else {
      urgency="info"; urgencyText="承認フロー中"; urgencyColor="var(--tl)";
    }
    if(draftCount>0) { urgency="warn"; urgencyText=`AI原案 ${draftCount}件 未確認`; urgencyColor="var(--am)"; }

    return {latestIsp,hasAssessment,pendingCount,draftCount,lastMonitoring,urgency,urgencyText,urgencyColor};
  };

  // 集計
  const totalUsers = myUsers.length;
  const noIspCount = myUsers.filter(u=>!(store.ispRecords||[]).some(r=>r.userId===u.id&&r.docType==="isp_plan")).length;
  const expiredCount = myUsers.filter(u=>{
    const recs=(store.ispRecords||[]).filter(r=>r.userId===u.id&&r.docType==="isp_plan");
    const latest=recs.sort((a,b)=>b.createdAt>a.createdAt?1:-1)[0];
    return latest&&latest.content?.validTo&&latest.content.validTo<today;
  }).length;
  const pendingApprovalCount = (store.ispRecords||[]).filter(r=>r.docType==="isp_plan"&&r.status!=="finalized"&&r.status!=="ai_draft").length;

  if(selUser) return <IspUserDetail u={selUser} user={user} store={store} onBack={()=>setSelUser(null)}/>;

  return <div style={{paddingBottom:28}}>
    {/* ヘッダー */}
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
      <button className="bback" onClick={onBack}>← 戻る</button>
      <div style={{flex:1}}>
        <div style={{fontSize:17,fontWeight:900}}>📋 個別支援計画</div>
        <div style={{fontSize:11,color:"var(--tx3)"}}>アセスメント・計画原案・承認フロー・モニタリング</div>
      </div>
    </div>

    {/* サマリーカード */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:16}}>
      {[
        {label:"対象利用者",val:totalUsers,color:"var(--tl)",icon:"👤"},
        {label:"計画未作成",val:noIspCount,color:noIspCount>0?"var(--am)":"var(--tx3)",icon:"📄"},
        {label:"期限切れ",  val:expiredCount,color:expiredCount>0?"var(--ro)":"var(--tx3)",icon:"⚠️"},
        {label:"承認待ち",  val:pendingApprovalCount,color:pendingApprovalCount>0?"var(--tl)":"var(--tx3)",icon:"⏳"},
      ].map(s=>(
        <div key={s.label} style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:10,padding:"10px 8px",textAlign:"center",boxShadow:"var(--sh)"}}>
          <div style={{fontSize:18,marginBottom:3}}>{s.icon}</div>
          <div style={{fontSize:20,fontWeight:900,color:s.color,fontFamily:"'DM Mono',monospace"}}>{s.val}</div>
          <div style={{fontSize:10,color:"var(--tx3)",marginTop:2}}>{s.label}</div>
        </div>
      ))}
    </div>

    {/* 期限切れ緊急アラート */}
    {expiredCount>0&&<div className="alert-danger" style={{borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:12,fontWeight:700}}>
      🔴 個別支援計画の期限が切れている利用者が {expiredCount}名 います。早急に更新してください。
    </div>}

    {/* 承認フロー説明 */}
    <div style={{background:"rgba(58,160,216,0.06)",border:"1px solid rgba(58,160,216,0.2)",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:11}}>
      <div style={{fontWeight:700,color:"var(--tl)",marginBottom:6}}>📌 承認フロー（7ステップ）</div>
      <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
        {ISP_FLOW_STEPS.map((s,i)=>(
          <React.Fragment key={s.key}>
            {i>0&&<span style={{color:"var(--tx3)",fontSize:10}}>→</span>}
            <span style={{fontSize:10,color:s.color,fontWeight:700}}>{s.icon}{s.label}</span>
          </React.Fragment>
        ))}
      </div>
      <div style={{color:"var(--tx3)",marginTop:5}}>⚠️ AIは原案作成まで。最終確定は<strong>児発管責任者</strong>の承認が必要です。</div>
    </div>

    {/* 検索 */}
    <input className="fi" value={searchQ} onChange={e=>setSearchQ(e.target.value)}
      placeholder="🔍 利用者名・学年で絞り込み" style={{marginBottom:12}}/>

    {/* 利用者一覧 */}
    {filteredUsers.length===0
      ?<div style={{textAlign:"center",color:"var(--tx3)",padding:24}}>利用者が見つかりません</div>
      :filteredUsers.map(u=>{
        const s = getIspSummary(u.id);
        return <div key={u.id} style={{background:"var(--wh)",border:`1.5px solid ${s.urgency==="danger"?"rgba(224,56,56,0.4)":s.urgency==="warn"?"rgba(240,112,32,0.3)":"var(--bd)"}`,borderRadius:12,padding:14,marginBottom:10,boxShadow:"var(--sh)",cursor:"pointer",transition:"box-shadow .15s"}}
          onClick={()=>setSelUser(u)}
          onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.12)"}
          onMouseLeave={e=>e.currentTarget.style.boxShadow="var(--sh)"}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{fontWeight:700,fontSize:14}}>{u.name}</div>
              <div style={{fontSize:11,color:"var(--tx3)",marginTop:2}}>{u.grade} ／ {FACILITIES.find(f=>f.id===u.facilityId)?.name}</div>
            </div>
            <span style={{padding:"4px 10px",borderRadius:10,fontSize:11,fontWeight:700,
              background:`${s.urgencyColor}20`,color:s.urgencyColor}}>
              {s.urgencyText}
            </span>
          </div>
          <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
            <span style={{fontSize:10,padding:"2px 7px",borderRadius:7,background:s.hasAssessment?"rgba(58,160,216,0.15)":"rgba(200,200,200,0.2)",color:s.hasAssessment?"var(--tl)":"var(--tx3)",fontWeight:700}}>
              {s.hasAssessment?"✅ AS":"❌ AS未"}</span>
            {s.latestIsp&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:7,background:"rgba(44,170,96,0.15)",color:"var(--gr)",fontWeight:700}}>
              計画: {s.latestIsp.content?.validFrom||""}〜{s.latestIsp.content?.validTo||""}
            </span>}
            {s.lastMonitoring&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:7,background:"rgba(240,112,32,0.12)",color:"var(--am)",fontWeight:700}}>
              最終MR: {s.lastMonitoring.content?.date||s.lastMonitoring.createdAt?.slice(0,10)}
            </span>}
            {s.pendingCount>0&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:7,background:"rgba(58,160,216,0.15)",color:"var(--tl)",fontWeight:700}}>
              承認待 {s.pendingCount}件
            </span>}
          </div>
        </div>;
      })
    }
  </div>;
}

// ==================== 国保連請求 管理システム ====================
// 設計原則: 単価・加算条件はBILLING_MASTERSで管理。コードに直書きしない。
// 法改正時はBILLING_MASTERSに新エントリを追加するだけで対応可能。

// ─── 施設設定タブ ───
function BillingFacilityTab({user,store,facilityId}){
  const cfg=store.facilityBillingSettings[facilityId]||{};
  const upd=(k,v)=>store.saveFacilityBillingSetting(facilityId,{[k]:v});
  const [saved,setSaved]=useState(false);
  const ym=(new Date()).toISOString().slice(0,7);
  const master=getBillingMaster(ym);
  const regionOptions=Object.keys(master.regionUnitPrice||{});
  const cityOptions=Object.keys(master.cityRegionMap||{});
  return <div>
    <div style={{background:"rgba(58,160,216,0.08)",border:"1px solid rgba(58,160,216,0.25)",borderRadius:10,padding:12,marginBottom:16}}>
      <div style={{fontSize:11,color:"var(--tl)",fontWeight:700}}>💡 適用マスタ: {master.name}</div>
      <div style={{fontSize:11,color:"var(--tx3)",marginTop:3}}>有効期間: {master.effectiveFrom} 〜 {master.effectiveTo||"（現在有効）"}</div>
    </div>
    <div style={{display:"grid",gap:14}}>
      {[
        {label:"サービス種別",key:"serviceType",type:"select",opts:["放課後等デイサービス","児童発達支援","放課後等デイ＋児発"]},
        {label:"定員",key:"capacity",type:"number",placeholder:"10"},
        {label:"市区町村（地域区分決定）",key:"city",type:"select",opts:cityOptions},
        {label:"地域区分",key:"regionClass",type:"select",opts:regionOptions},
        {label:"基本報酬区分",key:"basicRewardClass",type:"select",opts:["区分1（指導員加配等）","区分2（標準）"]},
        {label:"指定年月日",key:"designationDate",type:"date"},
        {label:"営業時間（開始）",key:"openTime",type:"time"},
        {label:"営業時間（終了）",key:"closeTime",type:"time"},
      ].map(({label,key,type,opts,placeholder})=>(
        <div key={key}>
          <div style={{fontSize:11,fontWeight:700,color:"var(--tx3)",marginBottom:5}}>{label}</div>
          {type==="select"
            ? <select className="fi" value={cfg[key]||""} onChange={e=>upd(key,e.target.value)}>
                <option value="">-- 選択 --</option>
                {(opts||[]).map(o=><option key={o} value={o}>{o}</option>)}
              </select>
            : <input className="fi" type={type} placeholder={placeholder} value={cfg[key]||""} onChange={e=>upd(key,e.target.value)}/>
          }
        </div>
      ))}
      <div>
        <div style={{fontSize:11,fontWeight:700,color:"var(--tx3)",marginBottom:6}}>令和8年6月以降 新規指定対象か</div>
        <div style={{display:"flex",gap:8}}>
          {["はい（新規指定）","いいえ（既存事業所）"].map(v=><button key={v}
            onClick={()=>upd("isNewAfter2026",v==="はい（新規指定）")}
            style={{padding:"9px 16px",borderRadius:9,border:"2px solid",cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",fontSize:13,fontWeight:700,
              borderColor:cfg.isNewAfter2026===(v==="はい（新規指定）")?"var(--tl)":"var(--bd)",
              background:cfg.isNewAfter2026===(v==="はい（新規指定）")?"rgba(58,160,216,0.2)":"var(--bg)",
              color:cfg.isNewAfter2026===(v==="はい（新規指定）")?"var(--tl)":"var(--tx3)"}}>
            {v}
          </button>)}
        </div>
      </div>
    </div>
    <button className="bsave" style={{marginTop:18,maxWidth:220}} onClick={()=>{setSaved(true);setTimeout(()=>setSaved(false),2000);}}>
      {saved?"✅ 保存しました":"設定を保存する"}
    </button>
  </div>;
}

// ─── 職員体制タブ ───
function BillingStaffTab({user,store,facilityId,yearMonth}){
  const cfg=store.getStaffConfig(facilityId,yearMonth)||{};
  const upd=(k,v)=>store.saveStaffConfig(facilityId,yearMonth,{[k]:v});
  const [saved,setSaved]=useState(false);
  const ft=parseFloat(cfg.fullTimeEquivalent||0);
  const users=store.dynUsers.filter(u=>u.facilityId===facilityId&&u.active!==false).length||1;
  const ratio=(ft/users).toFixed(2);
  const ratioOk=ft/users>=0.2;
  return <div>
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:12,padding:14,marginBottom:14}}>
      <div style={{fontSize:13,fontWeight:700,marginBottom:10}}>{yearMonth} の職員体制</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        {[
          {key:"fullTimeCount",  label:"常勤職員数",   unit:"名"},
          {key:"partTimeCount",  label:"非常勤職員数", unit:"名"},
          {key:"fullTimeEquivalent",label:"常勤換算合計",unit:"名",step:"0.1"},
        ].map(f=><div key={f.key}>
          <div style={{fontSize:11,fontWeight:700,color:"var(--tx3)",marginBottom:5}}>{f.label}</div>
          <div style={{display:"flex",alignItems:"center",gap:5}}>
            <input className="fi" type="number" step={f.step||"1"} min="0" placeholder="0"
              value={cfg[f.key]||""} onChange={e=>upd(f.key,e.target.value)} style={{maxWidth:100}}/>
            <span style={{fontSize:12,color:"var(--tx3)"}}>{f.unit}</span>
          </div>
        </div>)}
      </div>
      <div style={{padding:"10px 12px",borderRadius:9,border:"1px solid",
        borderColor:ratioOk?"rgba(44,170,96,0.4)":"rgba(224,56,56,0.4)",
        background:ratioOk?"rgba(44,170,96,0.08)":"rgba(224,56,56,0.08)"}}>
        <div style={{fontSize:12,fontWeight:700,color:ratioOk?"var(--gr)":"var(--ro)"}}>
          {ratioOk?"✅":"⚠️"} 配置比率: {ratio}（利用者 {users}名 / 常勤換算 {ft}名）
        </div>
        <div style={{fontSize:10,color:"var(--tx3)",marginTop:2}}>基準: 利用者5人に職員1人以上（0.20以上）</div>
      </div>
    </div>
    <div style={{fontSize:12,fontWeight:700,color:"var(--tx2)",marginBottom:10}}>有資格者・専門職配置</div>
    <div style={{display:"grid",gap:10}}>
      {[
        {key:"hasCDSM",         label:"児童発達支援管理責任者（CDSM）",type:"bool",required:true},
        {key:"nurseryTeachers", label:"保育士",type:"number"},
        {key:"childInstructors",label:"児童指導員",type:"number"},
        {key:"specStaff",       label:"専門的支援員（理学・作業・言語・心理等）",type:"number"},
        {key:"nurseStaff",      label:"看護職員",type:"number"},
        {key:"funcTrainer",     label:"機能訓練担当職員",type:"number"},
      ].map(f=><div key={f.key} style={{display:"flex",alignItems:"center",gap:10,background:"var(--wh)",padding:"10px 12px",borderRadius:9,border:"1px solid var(--bd)"}}>
        <div style={{flex:1,fontSize:13,fontWeight:700}}>{f.label}{f.required&&<span style={{color:"var(--ro)",fontSize:10,marginLeft:4}}>必須</span>}</div>
        {f.type==="number"
          ? <input className="fi" type="number" min="0" placeholder="0" value={cfg[f.key]||""}
              onChange={e=>upd(f.key,e.target.value)} style={{maxWidth:70,textAlign:"center"}}/>
          : <div style={{display:"flex",gap:6}}>
              <button onClick={()=>upd(f.key,true)} style={{padding:"6px 14px",borderRadius:8,border:"2px solid",cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",fontSize:12,fontWeight:700,borderColor:cfg[f.key]===true?"var(--gr)":"var(--bd)",background:cfg[f.key]===true?"rgba(44,170,96,0.2)":"var(--bg)",color:cfg[f.key]===true?"var(--gr)":"var(--tx3)"}}>配置あり</button>
              <button onClick={()=>upd(f.key,false)} style={{padding:"6px 14px",borderRadius:8,border:"2px solid",cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",fontSize:12,fontWeight:700,borderColor:cfg[f.key]===false?"var(--ro)":"var(--bd)",background:cfg[f.key]===false?"rgba(224,56,56,0.12)":"var(--bg)",color:cfg[f.key]===false?"var(--ro)":"var(--tx3)"}}>なし</button>
            </div>
        }
      </div>)}
    </div>
    <button className="bsave" style={{marginTop:14,maxWidth:220}} onClick={()=>{setSaved(true);setTimeout(()=>setSaved(false),2000);}}>
      {saved?"✅ 保存しました":"体制を保存する"}
    </button>
  </div>;
}

// ─── 加算設定タブ ───
function BillingAddonsTab({user,store,facilityId,yearMonth}){
  const master=getBillingMaster(yearMonth);
  const saved=store.facilityBillingSettings[facilityId]||{};
  const enabled=saved.enabledAddons||[];
  const toggle=key=>{
    const next=enabled.includes(key)?enabled.filter(k=>k!==key):[...enabled,key];
    store.saveFacilityBillingSetting(facilityId,{enabledAddons:next});
  };
  const cats=[...new Set((master.additions||[]).map(a=>a.category))];
  return <div>
    <div style={{background:"rgba(240,112,32,0.08)",border:"1px solid rgba(240,112,32,0.3)",borderRadius:10,padding:11,marginBottom:14}}>
      <div style={{fontSize:11,color:"var(--ac)",fontWeight:700}}>⚙ 加算マスタ: {master.name}</div>
      <div style={{fontSize:11,color:"var(--tx3)",marginTop:2}}>✅ チェックした加算が請求前チェックの自動判定対象になります</div>
    </div>
    {cats.map(cat=>{
      const items=(master.additions||[]).filter(a=>a.category===cat);
      return <div key={cat} style={{marginBottom:14}}>
        <div style={{fontSize:10,fontWeight:700,color:"var(--tx3)",letterSpacing:2,marginBottom:7,textTransform:"uppercase"}}>{cat}</div>
        <div style={{display:"grid",gap:6}}>
          {items.map(a=>{
            const on=enabled.includes(a.key);
            return <div key={a.key} onClick={()=>toggle(a.key)}
              style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,border:"2px solid",cursor:"pointer",transition:"all .15s",
                borderColor:on?"var(--tl)":"var(--bd)",background:on?"rgba(58,160,216,0.1)":"var(--wh)"}}>
              <div style={{width:20,height:20,borderRadius:5,border:"2px solid",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
                borderColor:on?"var(--tl)":"var(--bd)",background:on?"var(--tl)":"transparent"}}>
                {on&&<span style={{color:"#fff",fontSize:12,fontWeight:900}}>✓</span>}
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:"var(--tx)"}}>{a.label}</div>
                {a.units>0&&<div style={{fontSize:10,color:"var(--tl)",fontFamily:"'DM Mono',monospace"}}>
                  {a.units}単位/{a.perDay?"日":"月"}
                  {a.rate&&<span> ({(a.rate*100).toFixed(1)}%加算)</span>}
                  {a.maxPerMonth&&<span style={{color:"var(--am)"}}> 月{a.maxPerMonth}回まで</span>}
                </div>}
                {a.note&&<div style={{fontSize:10,color:"var(--tx3)",marginTop:1}}>{a.note}</div>}
                {a.autoCheck&&<div style={{fontSize:9,color:"var(--gr)",marginTop:1}}>🤖 自動判定: {a.autoCheck}</div>}
              </div>
            </div>;
          })}
        </div>
      </div>;
    })}
  </div>;
}

// ─── 請求前チェックタブ ───
function BillingCheckTab({user,store,facilityId,yearMonth}){
  const master=getBillingMaster(yearMonth);
  const facilitySettings=store.facilityBillingSettings[facilityId]||{};
  const staffCfg=store.getStaffConfig(facilityId,yearMonth);
  const alerts=checkBillingAlerts(facilityId,yearMonth,store,staffCfg);
  const myUsers=store.dynUsers.filter(u=>u.active!==false&&u.facilityId===facilityId);
  const inMonth=r=>{const d=r.time?.slice(0,7)||"";return d===yearMonth&&(r.facilityId===facilityId||r.facility_id===facilityId);};
  const monthRecs=store.recs.filter(inMonth);
  const enabledAddons=facilitySettings.enabledAddons||[];

  const userChecks=myUsers.map(u=>{
    const arrivals =monthRecs.filter(r=>r.type==="user_in" &&r.userId===u.id);
    const departures=monthRecs.filter(r=>r.type==="user_out"&&r.userId===u.id);
    const services =monthRecs.filter(r=>r.type==="service" &&r.userId===u.id);
    const absences =monthRecs.filter(r=>r.type==="absence" &&r.userId===u.id);
    const transports=arrivals.filter(r=>r.transport==="あり");
    const arrDates=[...new Set(arrivals.map(r=>r.time?.slice(0,10)))].filter(Boolean);
    const svcDates=[...new Set(services.map(r=>r.time?.slice(0,10)))].filter(Boolean);
    const serviceDays=svcDates.length;
    const arrivalDays=arrDates.length;
    const missingSvc=arrDates.filter(d=>!svcDates.includes(d));
    const missingTemp=arrivals.filter(r=>!r.temp||r.temp==="");
    const depDates=[...new Set(departures.map(r=>r.time?.slice(0,10)))].filter(Boolean);
    const missingDep=arrDates.filter(d=>!depDates.includes(d));
    const isp=(store.isps||[]).filter(i=>i.userId===u.id).sort((a,b)=>b.endDate>a.endDate?1:-1)[0];
    const ispOk=isp&&isp.endDate>=(yearMonth+"-01");
    const addResults=enabledAddons.map(key=>{
      const addDef=(master.additions||[]).find(a=>a.key===key);
      if(!addDef) return null;
      let eligible=null; let reason="";
      if(addDef.autoCheck==="transport"){eligible=transports.length>0;reason=eligible?("送迎記録 "+transports.length+"日"):"送迎記録なし";}
      else if(addDef.autoCheck==="absence"){const cnt=Math.min(absences.length,addDef.maxPerMonth||4);eligible=cnt>0;reason=eligible?("欠席対応 "+cnt+"回"):"欠席記録なし";}
      else if(addDef.autoCheck==="staff_qual"){eligible=staffCfg&&parseInt(staffCfg.specStaff||0)>0;reason=eligible?"専門職配置あり":"専門職員が未登録";}
      else if(addDef.autoCheck==="staff_ratio"){const fte=parseFloat(staffCfg?.fullTimeEquivalent||0);eligible=fte/myUsers.length>=0.4;reason=eligible?("常勤換算 "+fte+"名"):"配置基準未達";}
      else if(addDef.autoCheck==="child_staff"){eligible=staffCfg&&parseInt(staffCfg.childInstructors||0)>0;reason=eligible?"児童指導員配置あり":"未登録";}
      else if(addDef.autoCheck==="nurse_staff"){eligible=staffCfg&&parseInt(staffCfg.nurseStaff||0)>0;reason=eligible?"看護職員配置あり":"未登録";}
      return {key,label:addDef.label,units:addDef.units,perDay:addDef.perDay,eligible,reason};
    }).filter(Boolean);
    return {u,arrivalDays,serviceDays,missingSvc,missingTemp,missingDep,ispOk,isp,addResults};
  });

  const dangerCount=alerts.filter(a=>a.level==="danger").length;
  const warnCount=alerts.filter(a=>a.level==="warn").length;
  const okCount=myUsers.length-[...new Set(alerts.map(a=>a.userId).filter(Boolean))].length;

  const printCheck=()=>{
    const facName=FACILITIES.find(f=>f.id===facilityId)?.name||"";
    const tbody=userChecks.map(uc=>`<tr>
      <td style="text-align:left;font-weight:700;">${uc.u.name}</td>
      <td>${uc.arrivalDays}</td>
      <td style="color:${uc.missingSvc.length===0?"#1a7a3a":"#c0392b"};font-weight:700;">${uc.serviceDays}${uc.missingSvc.length>0?" ⚠ "+uc.missingSvc.length+"日不足":""}</td>
      <td style="color:${uc.missingTemp.length===0?"#1a7a3a":"#c0392b"};">${uc.missingTemp.length===0?"✓":"✗ "+uc.missingTemp.length+"件"}</td>
      <td style="color:${uc.missingDep.length===0?"#1a7a3a":"#e08020"};">${uc.missingDep.length===0?"✓":"△ "+uc.missingDep.length+"件"}</td>
      <td style="color:${uc.ispOk?"#1a7a3a":"#c0392b"};font-weight:700;">${uc.ispOk?"✓ "+uc.isp?.endDate:"✗ "+(uc.isp?"期限切れ":"未作成")}</td>
    </tr>`).join("");
    const alertHtml=alerts.map(a=>`<div class="alert-${a.level}">${a.level==="danger"?"🚨":"⚠️"} ${a.text}</div>`).join("");
    const html=`<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"/><title>請求前チェックリスト</title>
    <style>@page{size:A4;margin:15mm 12mm;}*{box-sizing:border-box;}body{font-family:'MS Gothic',Meiryo,sans-serif;font-size:10pt;color:#111;}
    h2{font-size:14pt;margin-bottom:4px;}.meta{font-size:9pt;color:#666;margin-bottom:12px;}
    .alert-danger{background:#fdf0ee;border:1px solid #e09090;padding:5px 10px;border-radius:4px;margin-bottom:4px;font-size:9pt;color:#8a2010;}
    .alert-warn{background:#fffaec;border:1px solid #ddb860;padding:5px 10px;border-radius:4px;margin-bottom:4px;font-size:9pt;color:#7a5000;}
    table{border-collapse:collapse;width:100%;font-size:9pt;margin-top:12px;}
    th,td{border:1px solid #bbb;padding:5px 8px;text-align:center;}th{background:#e8eef8;font-weight:700;}
    .sign-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:20px;}
    .sign-box{border:1px solid #aaa;padding:8px;min-height:52px;border-radius:4px;}
    .sign-lbl{font-size:9pt;color:#666;margin-bottom:4px;}
    </style></head><body>
    <h2>📋 請求前チェックリスト — ${facName}</h2>
    <div class="meta">対象年月: ${yearMonth}　適用マスタ: ${master.name}　出力日時: ${new Date().toLocaleString("ja-JP")}</div>
    ${dangerCount>0?`<div class="alert-danger">🚨 重大エラー ${dangerCount}件</div>`:""}
    ${warnCount>0?`<div class="alert-warn">⚠ 警告 ${warnCount}件</div>`:""}
    ${alertHtml}
    <table><thead><tr><th>利用者名</th><th>来所日数</th><th>サービス記録</th><th>体温記録</th><th>退所記録</th><th>ISP有効期限</th></tr></thead>
    <tbody>${tbody}</tbody></table>
    <div class="sign-row">
      <div class="sign-box"><div class="sign-lbl">管理者 確認サイン</div></div>
      <div class="sign-box"><div class="sign-lbl">児発管 確認サイン</div></div>
      <div class="sign-box"><div class="sign-lbl">確認日: ${new Date().toLocaleDateString("ja-JP")}</div></div>
    </div></body></html>`;
    const w=window.open("","_blank","width=900,height=700");
    if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),300);}
  };

  return <div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
      {[{label:"🚨 重大エラー",count:dangerCount,color:"var(--ro)"},{label:"⚠️ 警告",count:warnCount,color:"var(--ac)"},{label:"✅ 問題なし",count:okCount,color:"var(--gr)"}].map(s=>(
        <div key={s.label} className="stat-card">
          <div className="stat-label">{s.label}</div>
          <div className="stat-val" style={{fontSize:22,color:s.color}}>{s.count}</div>
        </div>
      ))}
    </div>
    {alerts.length===0?<div style={{background:"rgba(44,170,96,0.1)",border:"1px solid rgba(44,170,96,0.4)",borderRadius:10,padding:12,marginBottom:14,display:"flex",gap:10,alignItems:"center"}}>
      <span style={{fontSize:20}}>✅</span><span style={{fontSize:13,fontWeight:700,color:"var(--gr)"}}>全チェック通過 — 請求可能な状態です</span>
    </div>:<div style={{marginBottom:14}}>
      {alerts.map((a,i)=><div key={i} className={"alert-row alert-"+a.level} style={{marginBottom:5}}>
        <span className="alert-icon">{a.level==="danger"?"🚨":"⚠️"}</span>
        <span className="alert-text" style={{color:a.level==="danger"?"var(--ro)":"var(--ac)"}}>{a.text}</span>
      </div>)}
    </div>}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
      <div className="dash-title">利用者別 算定チェック</div>
      <button className="bexp" style={{background:"#fff8f0",borderColor:"var(--ac)",color:"var(--ac)"}} onClick={printCheck}>🖨️ チェックリストPDF</button>
    </div>
    {userChecks.map(uc=>{
      const hasIssue=uc.missingSvc.length>0||uc.missingTemp.length>0||!uc.ispOk;
      return <div key={uc.u.id} style={{background:"var(--wh)",border:"2px solid",borderColor:hasIssue?"rgba(224,56,56,0.35)":"rgba(44,170,96,0.35)",borderRadius:12,padding:13,marginBottom:9}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
          <span style={{fontWeight:700,fontSize:14}}>{hasIssue?"⚠️":"✅"} {uc.u.name}</span>
          <span style={{fontSize:10,padding:"2px 7px",borderRadius:6,fontWeight:700,
            background:hasIssue?"rgba(224,56,56,0.15)":"rgba(44,170,96,0.15)",
            color:hasIssue?"var(--ro)":"var(--gr)"}}>
            {hasIssue?"要確認":"問題なし"}
          </span>
          <span style={{fontSize:10,color:"var(--tx3)",marginLeft:"auto"}}>来所 {uc.arrivalDays}日</span>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:uc.addResults.length>0?8:0}}>
          <span className={"audit-check "+(uc.missingSvc.length===0?"audit-ok":"audit-ng")}>サービス記録 {uc.missingSvc.length===0?"✓":"✗ "+uc.missingSvc.length+"日不足"}</span>
          <span className={"audit-check "+(uc.missingTemp.length===0?"audit-ok":"audit-ng")}>体温 {uc.missingTemp.length===0?"✓":"✗ "+uc.missingTemp.length+"件"}</span>
          <span className={"audit-check "+(uc.missingDep.length===0?"audit-ok":"audit-na")}>退所記録 {uc.missingDep.length===0?"✓":"△ "+uc.missingDep.length+"件"}</span>
          <span className={"audit-check "+(uc.ispOk?"audit-ok":"audit-ng")}>ISP {uc.ispOk?"✓ 有効（〜"+uc.isp?.endDate+")":"✗ "+(uc.isp?"期限切れ":"未作成")}</span>
        </div>
        {uc.addResults.length>0&&<div style={{paddingTop:8,borderTop:"1px solid var(--bd)"}}>
          <div style={{fontSize:10,fontWeight:700,color:"var(--tx3)",marginBottom:5}}>加算 自動判定結果</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
            {uc.addResults.map(ar=><span key={ar.key} title={ar.reason}
              style={{fontSize:10,padding:"3px 8px",borderRadius:7,fontWeight:700,
                background:ar.eligible?"rgba(58,160,216,0.15)":ar.eligible===false?"rgba(224,56,56,0.1)":"var(--bg)",
                color:ar.eligible?"var(--tl)":ar.eligible===false?"var(--ro)":"var(--tx3)",
                border:"1px solid",borderColor:ar.eligible?"rgba(58,160,216,0.4)":ar.eligible===false?"rgba(224,56,56,0.3)":"var(--bd)"}}>
              {ar.eligible?"✓":"✗"} {ar.label}{ar.eligible&&ar.units>0&&<span style={{fontFamily:"'DM Mono',monospace",marginLeft:3}}>{ar.units}単位/{ar.perDay?"日":"月"}</span>}
            </span>)}
          </div>
        </div>}
      </div>;
    })}
  </div>;
}

// ─── 月次サマリータブ ───
function BillingSummaryTab({user,store,facilityId,yearMonth,vm,setVm}){
  const [city,setCity]=useState(()=>store.facilityBillingSettings[facilityId]?.city||"その他");
  const [linking,setLinking]=useState(false);
  const TANKA=getShizuokaTanka(city);
  const master=getBillingMaster(yearMonth);
  const kk=store.kokuho.filter(k=>k.facilityId===facilityId&&k.year===vm.y&&k.month===vm.m);

  // ─── 確定日報 → 請求への自動連携 ───
  const autoLinkFromReports=()=>{
    setLinking(true);
    // その月の確定日報を収集
    const confirmed=(store.dailyReports||[]).filter(r=>
      r.facilityId===facilityId && r.date.startsWith(yearMonth) &&
      (r.status==="確認済"||r.status==="確定")
    );
    if(confirmed.length===0){ store.showToast(`${vm.y}年${vm.m}月の確定日報がありません`,"warn"); setLinking(false); return; }
    // 利用者ごとの出席日数・送迎日数を集計
    const attendMap={};
    confirmed.forEach(r=>{
      (r.userList||[]).filter(u=>u.status==="出席"||u.status==="早退").forEach(u=>{
        if(!attendMap[u.id]) attendMap[u.id]={userId:u.id,userName:u.name,days:0,transportDays:0};
        attendMap[u.id].days++;
        if(u.transport==="あり"||u.transport==="送迎") attendMap[u.id].transportDays++;
      });
    });
    let updated=0; let created=0;
    Object.values(attendMap).forEach(agg=>{
      const ex=store.kokuho.find(k=>k.userId===agg.userId&&k.facilityId===facilityId&&k.year===vm.y&&k.month===vm.m);
      if(ex){
        store.updKokuho(ex.id,{serviceDays:agg.days,transportDays:agg.transportDays});
        updated++;
      } else {
        store.addKokuho({id:genId(),userId:agg.userId,userName:agg.userName,facilityId,
          year:vm.y,month:vm.m,serviceDays:agg.days,transportDays:agg.transportDays,
          serviceCode:"6612B",unitPrice:530,timeType:"放課後",addons:[],city,status:"未請求"});
        created++;
      }
    });
    store.showToast(`${updated}名更新・${created}名新規追加しました（${confirmed.length}日分の日報から集計）`);
    setLinking(false);
  };
  const totalUnits=kk.reduce((s,k)=>s+calcTotalUnits(k),0);
  const totalYen=Math.round(totalUnits*TANKA);
  const isMgr=user.role==="manager"||user.role==="admin";
  const bsKey=facilityId+"_"+yearMonth;
  const bStatus=store.billingStatus[bsKey]||"draft";
  const statusColors={"未請求":"var(--tx3)","請求済":"var(--tl)","入金済":"var(--gr)"};

  const csv=()=>{
    const rows=[["利用者名","日数","基本単位","加算単位","合計単位","請求額（円）","状態"],...kk.map(k=>{const tu=calcTotalUnits(k);return [k.userName,k.serviceDays,k.serviceDays*(k.unitPrice||576),tu-(k.serviceDays*(k.unitPrice||576)),tu,Math.round(tu*TANKA),k.status];})];
    const c=rows.map(r=>r.join(",")).join("\n");
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["﻿"+c],{type:"text/csv"}));
    a.download="billing_"+yearMonth+".csv";a.click();
  };

  return <div>
    <div style={{background:"rgba(58,160,216,0.08)",border:"1px solid rgba(58,160,216,0.2)",borderRadius:9,padding:10,marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
      <div style={{fontSize:11,color:"var(--tl)",fontWeight:700}}>📋 {master.name}</div>
      <div style={{display:"flex",gap:6,alignItems:"center"}}>
        <span style={{fontSize:11,color:"var(--tx3)"}}>地域単価（市区町村）：</span>
        <select className="fsm" value={city} onChange={e=>setCity(e.target.value)}>
          {Object.keys(SHIZUOKA_TANKA).map(c=><option key={c} value={c}>{c}（{SHIZUOKA_TANKA[c]}円）</option>)}
        </select>
      </div>
    </div>
    {/* ─── 自動連携バナー ─── */}
    <div style={{background:"rgba(44,170,96,0.08)",border:"1px solid rgba(44,170,96,0.3)",borderRadius:12,padding:"12px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
      <div style={{flex:1}}>
        <div style={{fontSize:12,fontWeight:700,color:"var(--gr)",marginBottom:3}}>🔗 自動連携：確定日報 → 請求実績</div>
        <div style={{fontSize:11,color:"var(--tx3)"}}>
          {vm.y}年{vm.m}月の確定済み日報から利用者ごとの出席日数を集計し、請求データに自動反映します。<br/>
          <span style={{color:"var(--am)"}}>※ 既存データは上書きされます。実行後は内容を確認してください。</span>
        </div>
      </div>
      <button onClick={autoLinkFromReports} disabled={linking}
        style={{padding:"10px 18px",borderRadius:10,background:linking?"var(--bg)":"var(--gr)",color:linking?"var(--tx3)":"#fff",fontWeight:700,fontSize:12,border:"none",cursor:linking?"not-allowed":"pointer",fontFamily:"'Noto Sans JP',sans-serif",whiteSpace:"nowrap",flexShrink:0}}>
        {linking?"集計中…":"📅 確定日報から自動集計"}
      </button>
    </div>
    <div style={{background:"linear-gradient(135deg,#1a6b3a,#2d9e58)",borderRadius:12,padding:"14px 18px",marginBottom:14,color:"#fff"}}>
      <div style={{fontSize:12,opacity:.8,marginBottom:4}}>{vm.y}年{vm.m}月 請求合計</div>
      <div style={{fontSize:28,fontWeight:900,fontFamily:"'DM Mono',monospace"}}>{totalYen.toLocaleString()}円</div>
      <div style={{fontSize:11,opacity:.7,marginTop:4}}>{totalUnits.toLocaleString()}単位　{kk.length}名</div>
    </div>
    {isMgr&&<div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
      <span style={{fontSize:11,fontWeight:700,color:"var(--tx3)"}}>請求ステータス：</span>
      {[["draft","📝 下書き"],["confirmed","✅ 請求確定"],["submitted","📮 国保連提出済"]].map(([s,l])=><button key={s}
        onClick={()=>store.saveBillingStatus(facilityId,yearMonth,s)}
        style={{padding:"8px 14px",borderRadius:9,border:"2px solid",cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",fontSize:12,fontWeight:700,
          borderColor:bStatus===s?"var(--tl)":"var(--bd)",background:bStatus===s?"rgba(58,160,216,0.2)":"var(--bg)",color:bStatus===s?"var(--tl)":"var(--tx3)"}}>
        {l}
      </button>)}
      <button className="bexp" style={{marginLeft:"auto"}} onClick={csv}>⬇ CSV</button>
    </div>}
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:"max-content"}}>
        <thead><tr style={{background:"var(--bg2)"}}>
          {["利用者名","日数","基本単位","加算単位","合計単位","請求額","状態"].map(h=><th key={h} style={{padding:"7px 9px",textAlign:"left",color:"var(--tx2)",fontSize:10,fontWeight:700,borderBottom:"2px solid var(--bd)",whiteSpace:"nowrap"}}>{h}</th>)}
        </tr></thead>
        <tbody>{kk.length===0?<tr><td colSpan={7} style={{padding:24,textAlign:"center",color:"var(--tx3)"}}>この月の請求データがありません</td></tr>:kk.map(k=>{
          const tu=calcTotalUnits(k);const addU=tu-k.serviceDays*(k.unitPrice||576);
          return <tr key={k.id} style={{borderBottom:"1px solid var(--bd)"}}>
            <td style={{padding:"8px 9px",fontWeight:700}}>{k.userName}</td>
            <td style={{padding:"8px 9px",fontFamily:"'DM Mono',monospace",textAlign:"right"}}>{k.serviceDays}</td>
            <td style={{padding:"8px 9px",fontFamily:"'DM Mono',monospace",textAlign:"right",color:"var(--tx2)"}}>{(k.serviceDays*(k.unitPrice||576)).toLocaleString()}</td>
            <td style={{padding:"8px 9px",fontFamily:"'DM Mono',monospace",textAlign:"right",color:"var(--tl)"}}>{addU>0?"+"+addU.toLocaleString():"—"}</td>
            <td style={{padding:"8px 9px",fontFamily:"'DM Mono',monospace",fontWeight:700,textAlign:"right"}}>{tu.toLocaleString()}</td>
            <td style={{padding:"8px 9px",fontFamily:"'DM Mono',monospace",fontWeight:700,textAlign:"right",color:"var(--am)"}}>{Math.round(tu*TANKA).toLocaleString()}円</td>
            <td style={{padding:"8px 9px"}}><span style={{fontSize:10,fontWeight:700,color:statusColors[k.status]||"var(--tx3)"}}>{k.status||"未請求"}</span></td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  </div>;
}

// ─── マスタ管理タブ（管理者専用）───
function BillingMasterTab(){
  return <div>
    <div style={{fontSize:12,color:"var(--tx3)",marginBottom:14,lineHeight:1.7}}>
      法改正時は <code style={{background:"var(--bg2)",padding:"1px 5px",borderRadius:4,fontFamily:"monospace"}}>BILLING_MASTERS</code> 配列に新エントリを追加することで、指定日から自動切替されます。過去月の請求は当時のマスタで再計算されます。
    </div>
    {BILLING_MASTERS.map(m=><div key={m.id} style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:12,padding:14,marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div>
          <div style={{fontSize:14,fontWeight:700}}>{m.name}</div>
          <div style={{fontSize:11,color:"var(--tx3)",fontFamily:"'DM Mono',monospace",marginTop:2}}>{m.effectiveFrom} 〜 {m.effectiveTo||"（終了日未設定・現在有効）"}</div>
        </div>
        {!m.effectiveTo&&<span style={{fontSize:10,fontWeight:700,padding:"3px 9px",borderRadius:7,background:"rgba(44,170,96,0.2)",color:"var(--gr)",flexShrink:0}}>現在適用中</span>}
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
        {Object.entries(m.regionUnitPrice||{}).map(([r,p])=>(
          <div key={r} style={{background:"var(--bg2)",borderRadius:7,padding:"5px 9px",fontSize:10}}>
            <div style={{color:"var(--tx3)",fontSize:9}}>{r}</div>
            <div style={{fontWeight:700,fontFamily:"'DM Mono',monospace",color:"var(--tl)"}}>{p}円</div>
          </div>
        ))}
      </div>
      <div style={{fontSize:11,color:"var(--tx3)"}}>加算項目: {(m.additions||[]).length}件　基本報酬パターン: {(m.basicRewards||[]).length}件</div>
    </div>)}
    <div style={{background:"rgba(240,112,32,0.08)",border:"1px dashed rgba(240,112,32,0.4)",borderRadius:10,padding:14,marginTop:4}}>
      <div style={{fontSize:12,fontWeight:700,color:"var(--ac)",marginBottom:8}}>📋 法改正対応の手順</div>
      <ol style={{fontSize:11,color:"var(--tx3)",paddingLeft:18,lineHeight:2.2}}>
        <li><strong>BILLING_MASTERS</strong> 配列に新しいオブジェクトを追加する</li>
        <li><strong>effectiveFrom</strong> に改正施行日（例: "2028-04-01"）を設定する</li>
        <li>前マスタの <strong>effectiveTo</strong> に施行前日（例: "2028-03-31"）を設定する</li>
        <li><strong>basicRewards・additions</strong> の単位数・条件を改正内容に更新する</li>
        <li>過去月の請求は <strong>getBillingMaster(yearMonth)</strong> が自動的に旧マスタを参照する</li>
      </ol>
    </div>
  </div>;
}

// ─── メイン KokuhoScreen ───
function KokuhoScreen({user,store,onBack}){
  const [vm,setVm]=useState(()=>{const d=new Date();return{y:d.getFullYear(),m:d.getMonth()+1};});
  const [tab,setTab]=useState("check");
  const [facilityId,setFacilityId]=useState(user.selectedFacilityId||FACILITIES[0].id);
  const isAdmin=user.role==="admin";
  const yearMonth=vm.y+"-"+String(vm.m).padStart(2,"0");

  const tabs=[
    {id:"check",   icon:"🔍",label:"請求前チェック"},
    {id:"summary", icon:"💴",label:"月次サマリー"},
    {id:"addons",  icon:"⚙️",label:"加算設定"},
    {id:"staff",   icon:"👥",label:"職員体制"},
    {id:"facility",icon:"🏢",label:"事業所設定"},
    ...(isAdmin?[{id:"master",icon:"📋",label:"マスタ管理"}]:[]),
  ];

  return <div className="fl-wrap">
    <div className="fl-hd">
      <button className="bback" onClick={onBack}>← 戻る</button>
      <div className="fl-title">💴 請求管理</div>
    </div>
    {/* 施設・年月 */}
    <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:14,background:"var(--wh)",padding:"10px 12px",borderRadius:11,border:"1px solid var(--bd)"}}>
      {!isAdmin&&<div style={{fontWeight:700,fontSize:13,color:"var(--tx)"}}>{FACILITIES.find(f=>f.id===facilityId)?.name}</div>}
      {isAdmin&&<select className="fsm" value={facilityId} onChange={e=>setFacilityId(e.target.value)}>
        {FACILITIES.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
      </select>}
      <select className="fsm" value={vm.y} onChange={e=>setVm(v=>({...v,y:+e.target.value}))}>
        {Array.from({length:6},(_,i)=>2024+i).map(y=><option key={y} value={y}>{y}年</option>)}
      </select>
      <select className="fsm" value={vm.m} onChange={e=>setVm(v=>({...v,m:+e.target.value}))}>
        {Array.from({length:12},(_,i)=>i+1).map(m=><option key={m} value={m}>{m}月</option>)}
      </select>
      <div style={{fontSize:10,color:"var(--tx3)",fontFamily:"'DM Mono',monospace",marginLeft:"auto"}}>
        {getBillingMaster(yearMonth).name}
      </div>
    </div>
    {/* タブナビ */}
    <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:16}}>
      {tabs.map(t=><button key={t.id} onClick={()=>setTab(t.id)}
        style={{padding:"8px 14px",borderRadius:9,border:"2px solid",cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",fontSize:12,fontWeight:700,transition:"all .15s",
          borderColor:tab===t.id?"var(--tl)":"var(--bd)",
          background:tab===t.id?"rgba(58,160,216,0.2)":"var(--bg)",
          color:tab===t.id?"var(--tl)":"var(--tx3)"}}>
        {t.icon} {t.label}
      </button>)}
    </div>
    {/* コンテンツ */}
    {tab==="check"   &&<BillingCheckTab   user={user} store={store} facilityId={facilityId} yearMonth={yearMonth}/>}
    {tab==="summary" &&<BillingSummaryTab user={user} store={store} facilityId={facilityId} yearMonth={yearMonth} vm={vm} setVm={setVm}/>}
    {tab==="addons"  &&<BillingAddonsTab  user={user} store={store} facilityId={facilityId} yearMonth={yearMonth}/>}
    {tab==="staff"   &&<BillingStaffTab   user={user} store={store} facilityId={facilityId} yearMonth={yearMonth}/>}
    {tab==="facility"&&<BillingFacilityTab user={user} store={store} facilityId={facilityId}/>}
    {tab==="master"  &&<BillingMasterTab/>}
  </div>;
}


// ==================== EDIT MODAL ====================
function EditModal({rec,user,store,onClose}){
  const [temp,setTemp]=useState(rec.temp||"");const [note,setNote]=useState(rec.note||"");const [reason,setReason]=useState("");
  return <div className="ov" onClick={e=>e.target===e.currentTarget&&onClose()}><div className="md">
    <div className="mdtit">📝 記録を修正</div>
    <div className="fg"><label className="fl">対象</label><p style={{color:"var(--g2)",fontSize:12}}>{rec.staffName||rec.userName} — {rec.time}</p></div>
    {rec.temp&&rec.temp!=="-"&&<div className="fg"><label className="fl">体温 (℃)</label><input className="fi" type="number" step="0.1" value={temp} onChange={e=>setTemp(e.target.value)}/></div>}
    <div className="fg"><label className="fl">備考</label><textarea className="fta" value={note} onChange={e=>setNote(e.target.value)} style={{minHeight:52}}/></div>
    <div className="fg"><label className="fl">修正理由 <span style={{color:"var(--ro)"}}>*</span></label><textarea className="fta" placeholder="修正理由を入力してください" value={reason} onChange={e=>setReason(e.target.value)} style={{minHeight:52}}/></div>
    <div className="mda"><button className="bcancel" onClick={onClose}>キャンセル</button><button className="bconf" disabled={!reason} onClick={()=>{store.updRec(rec.id,{temp,note},user.displayName,reason);onClose();}}>保存</button></div>
  </div></div>;
}

// ==================== ADMIN ====================
function AdminScreen({user,store,onBack}){
  const [tab,setTab]=useState("staff_in");const [fFac,setFFac]=useState(user.selectedFacilityId||"all");const [fName,setFName]=useState("");const [editRec,setEditRec]=useState(null);
  const TABS=[{k:"staff_in",l:"出勤"},{k:"staff_out",l:"退勤"},{k:"user_in",l:"来所"},{k:"user_out",l:"退所"},{k:"photo",l:"写真"},{k:"service",l:"サービス記録"},{k:"history",l:"修正履歴"}];
  const fil=store.recs.filter(r=>r.type===tab&&(fFac==="all"||r.facilityId===fFac)&&(fName===""||((r.staffName||r.userName||"").includes(fName))));
  const cnt=t=>store.recs.filter(r=>r.type===t&&(fFac==="all"||r.facilityId===fFac)).length;
  const tl=t=>({staff_in:"出勤",staff_out:"退勤",user_in:"来所",user_out:"退所",photo:"写真",service:"サービス"}[t]||t);
  const bc=t=>({staff_in:"bg",staff_out:"ba",user_in:"bb",user_out:"br",photo:"bp",service:"bb"}[t]||"bb");
  const canEdit=user.role==="manager"||user.role==="admin";
  const csv=()=>{const rows=fil.map(r=>[r.staffName||r.userName||"",r.facilityName,tl(r.type),r.time,r.temp||"",r.transport||"",r.note||""].join(","));const c=["氏名,施設,区分,記録日時,体温,送迎,備考",...rows].join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["﻿"+c],{type:"text/csv"}));a.download=`gogroup_${tab}_${todayISO()}.csv`;a.click();};
  const todayPl=store.dynUsers.filter(u=>(fFac==="all"||u.facilityId===fFac)&&(store.getAtt(u.id,todayISO())==="予定"||store.getAtt(u.id,todayISO())==="出席"));
  const unread=store.msgs.filter(m=>(fFac==="all"||m.facilityId===fFac)&&!m.read).length;
  return <div>
    <div className="ah"><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}><button className="bback" onClick={onBack}>← 戻る</button><div className="at">📊 管理画面</div></div><div className="as">{todayDisplay()} 現在</div></div>
    <div className="sr2">
      <div className="sc2"><div className="sn" style={{color:"var(--tl)"}}>{cnt("staff_in")}</div><div className="sl">出勤</div></div>
      <div className="sc2"><div className="sn" style={{color:"var(--am)"}}>{cnt("staff_out")}</div><div className="sl">退勤</div></div>
      <div className="sc2"><div className="sn" style={{color:"var(--gr)"}}>{cnt("user_in")}</div><div className="sl">来所</div></div>
      <div className="sc2"><div className="sn" style={{color:"var(--ro)"}}>{cnt("user_out")}</div><div className="sl">退所</div></div>
      {unread>0&&<div className="sc2"><div className="sn" style={{color:"var(--pu)"}}>{unread}</div><div className="sl">未読連絡</div></div>}
    </div>
    {todayPl.length>0&&<div style={{marginBottom:12}}><div className="panel"><div className="ptit">本日の予定利用者</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{todayPl.map(u=>{const isPresent=store.getAtt(u.id,todayISO())==="出席";return <span key={u.id} style={{padding:"3px 10px",borderRadius:14,fontSize:11,fontWeight:700,background:isPresent?"rgba(82,183,136,0.2)":"rgba(0,180,216,0.12)",color:isPresent?"var(--gr)":"var(--tb)",border:"1px solid "+(isPresent?"rgba(82,183,136,0.3)":"rgba(0,180,216,0.25)")}}>{u.name}</span>;})}</div></div></div>}
    <div className="tabs">{TABS.map(t=><button key={t.k} className={`tab ${tab===t.k?"on":""}`} onClick={()=>setTab(t.k)}>{t.l}</button>)}</div>
    <div className="frow">{user.role==="admin"&&<select className="fsm" value={fFac} onChange={e=>setFFac(e.target.value)}><option value="all">全施設</option>{FACILITIES.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select>}<input className="fsm" placeholder="氏名で絞込" value={fName} onChange={e=>setFName(e.target.value)}/></div>
    <div className="ebar"><button className="bexp" onClick={csv}>⬇ CSV出力</button></div>
    {tab==="history"?<div className="tw"><table className="tbl"><thead><tr><th>修正日時</th><th>修正者</th><th>対象</th><th>修正理由</th></tr></thead><tbody>
      {store.hist.length===0?<tr><td colSpan={4} style={{textAlign:"center",color:"var(--g6)",padding:"28px"}}>修正履歴はありません</td></tr>:store.hist.map(h=><tr key={h.id}><td style={{fontFamily:"'DM Mono',monospace",fontSize:10}}>{h.at}</td><td>{h.by}</td><td>{h.before.staffName||h.before.userName||"-"}</td><td>{h.reason}</td></tr>)}
    </tbody></table></div>
    :<div className="tw"><table className="tbl"><thead><tr><th>氏名</th><th>施設</th><th>区分</th><th>記録日時</th><th>体温</th>{(tab==="user_in"||tab==="user_out")&&<th>送迎</th>}{tab==="photo"&&<th>活動</th>}{tab==="service"&&<th>様子</th>}<th>写真</th><th>備考</th>{canEdit&&<th>操作</th>}</tr></thead><tbody>
      {fil.length===0?<tr><td colSpan={10} style={{textAlign:"center",color:"var(--g6)",padding:"28px"}}>記録がありません</td></tr>
      :fil.map(r=><tr key={r.id}><td style={{fontWeight:700}}>{r.staffName||r.userName||"-"}</td><td style={{fontSize:10,color:"var(--g4)"}}>{r.facilityName}</td><td><span className={`badge ${bc(r.type)}`}>{tl(r.type)}</span></td><td style={{fontFamily:"'DM Mono',monospace",fontSize:10}}>{r.time}</td><td>{r.temp&&r.temp!=="-"?<span style={{fontFamily:"'DM Mono',monospace",color:parseFloat(r.temp)>=37.5?"var(--ro)":"var(--gr)"}}>{r.temp}℃</span>:"-"}</td>{(tab==="user_in"||tab==="user_out")&&<td>{r.transport?<span className={`badge ${r.transport==="あり"?"bg":"ba"}`}>{r.transport}</span>:"-"}</td>}{tab==="photo"&&<td>{r.activity||"-"}</td>}{tab==="service"&&<td style={{fontSize:16}}>{r.mood||"-"}</td>}<td>{r.photo?"✅":"-"}</td><td style={{maxWidth:90,overflow:"hidden",textOverflow:"ellipsis"}}>{r.note||"-"}</td>{canEdit&&<td><button className="bedit" onClick={()=>setEditRec(r)}>修正</button></td>}</tr>)}
    </tbody></table></div>}
    {editRec&&<EditModal rec={editRec} user={user} store={store} onClose={()=>setEditRec(null)}/>}
  </div>;
}


// ==================== 業務日報 ====================
function DailyReport({user,store,onBack}){
  const fac=FACILITIES.find(f=>f.id===user.selectedFacilityId);
  const [mode,setMode]=useState("list"); // list | edit | view
  const [selDate,setSelDate]=useState(todayISO());
  const [viewRep,setViewRep]=useState(null);

  // 既存レポートを読み込む or 新規
  const existingRep=store.dailyReports.find(r=>r.date===selDate&&r.facilityId===user.selectedFacilityId);

  // 今日のデータを記録から自動集計
  // 時刻文字列から HH:MM を安全に抽出
  const extractHM=(t)=>{if(!t)return"";const m=t.match(/(\d{1,2}:\d{2})/);return m?m[1]:"";};
  // 記録が指定日付かどうか判定（YYYY/MM/DD・YYYY/M/D・YYYY-MM-DD 全対応）
  const matchDate=(t,d)=>{
    if(!t)return false;
    const padded=d.replace(/-/g,"/"); // "2026/05/11"
    const [y,mo,dy]=d.split("-");
    const short=y+"/"+Number(mo)+"/"+Number(dy); // "2026/5/11"（toLocaleString形式）
    return t.includes(padded)||t.includes(short)||t.startsWith(d);
  };

  const buildAuto=(date)=>{
    const dk=date;
    const fid=user.selectedFacilityId;
    const inFac=(r)=>r.facilityId===fid;
    const onDate=(r)=>matchDate(r.time,date);

    const staffIns=store.recs.filter(r=>r.type==="staff_in"&&inFac(r)&&onDate(r));
    const staffOuts=store.recs.filter(r=>r.type==="staff_out"&&inFac(r)&&onDate(r));
    const userIns=store.recs.filter(r=>r.type==="user_in"&&inFac(r)&&onDate(r));
    const userOuts=store.recs.filter(r=>r.type==="user_out"&&inFac(r)&&onDate(r));
    const photos=store.recs.filter(r=>r.type==="photo"&&inFac(r)&&onDate(r));
    const services=store.recs.filter(r=>r.type==="service"&&inFac(r)&&onDate(r));

    // 職員リスト（シフト登録済みスタッフも含める）
    const staffList=staffIns.map(r=>{
      const out=staffOuts.find(o=>o.staffId===r.staffId);
      const s=store.dynStaff.find(s=>s.id===r.staffId);
      return {id:r.staffId,name:r.staffName||s?.name||"",clockIn:extractHM(r.time),clockOut:extractHM(out?.time),temp:r.temp||"",role:s?.role||"staff"};
    });
    // 出勤記録はないがシフトが入っているスタッフも追加
    store.dynStaff.filter(s=>s.facilityId===fid&&s.active!==false&&store.getShift(s.id,date)&&store.getShift(s.id,date)!=="none"&&store.getShift(s.id,date)!=="off"&&!staffList.find(x=>x.id===s.id))
      .forEach(s=>staffList.push({id:s.id,name:s.name,clockIn:"",clockOut:"",temp:"",role:s.role||"staff"}));

    // 利用者リスト（来所記録から）
    const userList=userIns.map(r=>{
      const out=userOuts.find(o=>o.userId===r.userId);
      const attStatus=store.getAtt(r.userId,dk);
      return {id:r.userId,name:r.userName,arrivalTime:extractHM(r.time),departTime:extractHM(out?.time),temp:r.temp||"",transport:r.transport||"",status:attStatus||"出席"};
    });
    // 予定者（来所記録がないが出欠予定が入っている利用者）
    store.dynUsers.filter(u=>u.facilityId===fid&&u.active!==false&&store.getAtt(u.id,dk)==="予定"&&!userList.find(x=>x.id===u.id))
      .forEach(u=>userList.push({id:u.id,name:u.name,arrivalTime:"",departTime:"",temp:"",transport:u.hasTransport?"あり":"なし",status:"予定"}));
    // スケジュールデータからも来所予定を追加
    if(store.scheduleData){
      Object.values(store.scheduleData).filter(sc=>sc.facility_id===fid&&sc.date===date&&(sc.status==="来所予定"||sc.status==="来所")&&!userList.find(x=>x.id===sc.user_id))
        .forEach(sc=>userList.push({id:sc.user_id,name:sc.user_name,arrivalTime:"",departTime:"",temp:"",transport:sc.transport_to?"あり":"なし",status:sc.status}));
    }

    // サービス記録から活動内容を自動生成
    const serviceActivities=services.map(s=>({
      time:s.arrival||extractHM(s.time)||"",
      title:"サービス提供（"+(s.items||[]).slice(0,3).join("・")+"）",
      detail:[s.supportNote,s.bodyNote].filter(Boolean).join(" / "),
      staff:s.createdBy||""
    }));
    // デフォルト活動テンプレート
    const defaultActivities=[
      {time:"14:00",title:"来所・体温チェック",detail:"利用者の来所確認・健康観察を実施",staff:""},
      {time:"14:30",title:"",detail:"",staff:""},
      {time:"15:30",title:"",detail:"",staff:""},
      {time:"17:00",title:"退所準備",detail:"",staff:""},
    ];
    const activities=serviceActivities.length>0?[...serviceActivities,{time:"",title:"",detail:"",staff:""}]:defaultActivities;

    // ─── ISP短期目標を各ユーザーに自動注入 ───
    const ISP_ACTIVE = ["staff_checked","cdsm_approved","manager_confirmed","parent_explained","parent_consented","finalized"];
    userList.forEach(u => {
      const isp = (store.ispRecords||[])
        .filter(r=>r.userId===u.id&&r.docType==="isp_plan"&&ISP_ACTIVE.includes(r.status))
        .sort((a,b)=>b.createdAt>a.createdAt?1:-1)[0];
      if(isp){ u.ispGoal=isp.content?.shortGoal||""; u.ispStaff=isp.content?.staffInCharge||""; }
    });
    // ISP目標がある場合は活動欄の先頭にも反映（サービス記録がない場合のみ）
    if(serviceActivities.length===0){
      const ispHints=userList.filter(u=>u.ispGoal).map(u=>({
        time:"",title:`【ISP目標】${u.name}`,detail:u.ispGoal,staff:u.ispStaff||"",autoFromIsp:true
      }));
      if(ispHints.length>0) ispHints.forEach(h=>defaultActivities.splice(1,0,h));
    }

    return {staffList,userList,activities,photos:photos.slice(0,6).map(p=>({activity:p.activity,userName:p.userName,comment:p.comment}))};
  };

  const initReport=(date)=>{
    const auto=buildAuto(date);
    return existingRep||{
      date, facilityId:user.selectedFacilityId,
      weather:"晴れ", temperature:"",
      author:user.displayName,
      staffList:auto.staffList,
      userList:auto.userList,
      photos:auto.photos,
      activities:auto.activities,
      incidentDetail:"", parentNote:"", tomorrowNote:"", managerNote:"",
      incidents:0, status:"下書き",
    };
  };

  const [rep,setRep]=useState(()=>initReport(todayISO()));
  const updRep=(k,v)=>setRep(p=>({...p,[k]:v}));
  const updActivity=(i,k,v)=>setRep(p=>({...p,activities:p.activities.map((a,idx)=>idx===i?{...a,[k]:v}:a)}));
  const updStaff=(i,k,v)=>setRep(p=>({...p,staffList:p.staffList.map((s,idx)=>idx===i?{...s,[k]:v}:s)}));
  const updUser=(i,k,v)=>setRep(p=>({...p,userList:p.userList.map((u,idx)=>idx===i?{...u,[k]:v}:u)}));
  const updPhoto=(i,k,v)=>setRep(p=>{const ph=[...(p.photos||Array(6).fill(null))];ph[i]={...(ph[i]||{}), [k]:v};return {...p,photos:ph};});
  const addActivity=()=>setRep(p=>({...p,activities:[...p.activities,{time:"",title:"",detail:"",staff:""}]}));
  const removeActivity=(i)=>setRep(p=>({...p,activities:p.activities.filter((_,idx)=>idx!==i)}));
  const save=(status)=>{
    const r={...rep,status,savedAt:nowStr()};
    store.addDailyReport(r);
    // ─── 確定時：実績レコードを自動生成 ───
    if(status==="確認済"){
      const ISP_ACTIVE=["staff_checked","cdsm_approved","manager_confirmed","parent_explained","parent_consented","finalized"];
      let autoCount=0;
      (r.userList||[]).filter(u=>u.status==="出席"||u.status==="早退").forEach(u=>{
        // 重複防止：同日・同利用者の自動生成済みレコードがあればスキップ
        const exists=store.recs.some(rec=>rec.type==="service"&&rec.userId===u.id&&rec.date===r.date&&rec.facilityId===r.facilityId&&rec.autoLinked===true);
        if(!exists){
          const isp=(store.ispRecords||[]).filter(ir=>ir.userId===u.id&&ir.docType==="isp_plan"&&ISP_ACTIVE.includes(ir.status)).sort((a,b)=>b.createdAt>a.createdAt?1:-1)[0];
          store.addRec({
            id:genId(), type:"service", userId:u.id, userName:u.name,
            facilityId:r.facilityId, date:r.date,
            time:r.date+" "+(u.arrivalTime||"00:00"),
            arrival:u.arrivalTime||"", departure:u.departTime||"",
            temp:u.temp||"", transport:u.transport||"",
            items:(r.activities||[]).filter(a=>a.title&&!a.autoFromIsp).map(a=>a.title).slice(0,5),
            supportNote:isp?`短期目標：${isp.content?.shortGoal||""}　担当：${isp.content?.staffInCharge||""}`:"",
            createdBy:r.author, autoLinked:true, dailyReportDate:r.date,
          });
          autoCount++;
        }
      });
      if(autoCount>0) store.showToast(`日報を確定しました。${autoCount}名の実績を自動生成しました`);
      else store.showToast("日報を確定しました");
    }
    setRep(r); setMode("list");
  };

  // 日付変更時にレポートを再セット
  const changeDate=(d)=>{setSelDate(d);const ex=store.dailyReports.find(r=>r.date===d&&r.facilityId===user.selectedFacilityId);setRep(ex||initReport(d));};

  const WEATHER_OPTS=["晴れ","曇り","雨","雪","晴れのち曇り","曇りのち雨"];
  const reports=store.dailyReports.filter(r=>r.facilityId===user.selectedFacilityId).sort((a,b)=>b.date>a.date?1:-1);

  // 日報CSV出力
  const exportDailyCSV=(r)=>{
    const rows=[];
    rows.push(["日付",r.date]);
    rows.push(["施設",fac?.name||""]);
    rows.push(["天気",r.weather||""]);
    rows.push(["気温",r.temperature||""]);
    rows.push(["作成者",r.author||""]);
    rows.push(["ステータス",r.status||""]);
    rows.push([]);
    rows.push(["【出勤職員】"]);
    rows.push(["氏名","出勤","退勤","体温","役職"]);
    (r.staffList||[]).forEach(s=>rows.push([s.name,s.clockIn||"",s.clockOut||"",s.temp||"",s.role==="manager"?"管理者":"一般"]));
    rows.push([]);
    rows.push(["【利用者来所】"]);
    rows.push(["氏名","来所","退所","体温","送迎","状態"]);
    (r.userList||[]).forEach(u=>rows.push([u.name,u.arrivalTime||"",u.departTime||"",u.temp||"",u.transport||"",u.status||""]));
    rows.push([]);
    rows.push(["【活動内容】"]);
    rows.push(["時刻","タイトル","内容","担当"]);
    (r.activities||[]).filter(a=>a.title).forEach(a=>rows.push([a.time||"",a.title||"",a.detail||"",a.staff||""]));
    rows.push([]);
    rows.push(["【特記事項】",r.incidentDetail||""]);
    rows.push(["【保護者連絡】",r.parentNote||""]);
    rows.push(["【翌日連絡】",r.tomorrowNote||""]);
    rows.push(["【管理者メモ】",r.managerNote||""]);
    const csv=rows.map(row=>row.map(v=>'"'+(String(v).replace(/"/g,'""'))+'"').join(",")).join("\n");
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob(["﻿"+csv],{type:"text/csv"}));
    a.download=`日報_${r.date}_${fac?.name||""}.csv`;
    a.click();
  };

  // ===== 詳細表示 =====
  if(mode==="view"&&viewRep) return <div className="fl-wrap">
    <div className="fl-hd">
      <button className="bback" onClick={()=>setMode("list")}>← 戻る</button>
      <div className="fl-title">📓 {viewRep.date} 業務日報</div>
      <div style={{display:"flex",gap:6,marginLeft:"auto"}}>
        <button className="bexp" style={{background:"#f0f8e8",borderColor:"var(--gr)",color:"var(--gr)",fontSize:11,padding:"5px 9px"}}
          onClick={()=>exportDailyCSV(viewRep)}>⬇ CSV</button>
        <button className="bexp" style={{background:"#fff8f0",borderColor:"var(--ac)",color:"var(--ac)"}}
          onClick={()=>printDailyReport(viewRep,fac?.name||"")}>🖨️ 印刷</button>
      </div>
    </div>
    {/* サマリーカード */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:12}}>
      {[
        {label:"出勤職員",val:(viewRep.staffList||[]).length+"名",color:"var(--tl)"},
        {label:"来所利用者",val:(viewRep.userList||[]).length+"名",color:"var(--gr)"},
        {label:"活動数",val:(viewRep.activities||[]).filter(a=>a.title).length+"件",color:"var(--am)"},
        {label:"特記事項",val:(viewRep.incidents||0)+"件",color:viewRep.incidents>0?"var(--ro)":"var(--tx3)"},
      ].map(c=><div key={c.label} style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:10,padding:"12px 14px",textAlign:"center",boxShadow:"var(--sh)"}}>
        <div style={{fontSize:10,color:"var(--tx3)",marginBottom:3}}>{c.label}</div>
        <div style={{fontSize:22,fontWeight:900,color:c.color}}>{c.val}</div>
      </div>)}
    </div>
    {/* 基本情報 */}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:14,marginBottom:10,boxShadow:"var(--sh)"}}>
      <div style={{fontSize:10,fontWeight:700,color:"var(--tl)",letterSpacing:2,marginBottom:8}}>基本情報</div>
      <div style={{display:"flex",gap:16,flexWrap:"wrap",fontSize:13}}>
        <span>📅 {viewRep.date}</span><span>🌤️ {viewRep.weather}</span>
        {viewRep.temperature&&<span>🌡️ {viewRep.temperature}</span>}
        <span>✍️ {viewRep.author}</span>
        <span style={{padding:"2px 9px",borderRadius:10,fontSize:11,fontWeight:700,background:viewRep.status==="確認済"?"rgba(44,170,96,0.2)":"rgba(224,168,40,0.18)",color:viewRep.status==="確認済"?"var(--gr)":"var(--am)"}}>{viewRep.status}</span>
      </div>
    </div>
    {/* 出勤職員 */}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:14,marginBottom:10,boxShadow:"var(--sh)"}}>
      <div style={{fontSize:10,fontWeight:700,color:"var(--tl)",letterSpacing:2,marginBottom:10}}>出勤職員一覧</div>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <thead><tr style={{background:"var(--bg2)"}}>
          {["氏名","出勤","退勤","体温","役職"].map(h=><th key={h} style={{padding:"6px 8px",textAlign:h==="氏名"?"left":"center",fontSize:10,fontWeight:700,color:"var(--tx2)",borderBottom:"2px solid var(--bd)"}}>{h}</th>)}
        </tr></thead>
        <tbody>{(viewRep.staffList||[]).map((s,i)=><tr key={i} style={{borderBottom:"1px solid var(--bg2)"}}>
          <td style={{padding:"7px 8px",fontWeight:700}}>{s.name}</td>
          <td style={{padding:"7px 8px",textAlign:"center",fontFamily:"'DM Mono',monospace"}}>{s.clockIn||"—"}</td>
          <td style={{padding:"7px 8px",textAlign:"center",fontFamily:"'DM Mono',monospace"}}>{s.clockOut||"—"}</td>
          <td style={{padding:"7px 8px",textAlign:"center",color:parseFloat(s.temp)>=37.5?"var(--ro)":"var(--gr)",fontWeight:700}}>{s.temp?""+s.temp+"℃":"—"}</td>
          <td style={{padding:"7px 8px",textAlign:"center"}}><span style={{fontSize:10,padding:"2px 7px",borderRadius:8,background:s.role==="manager"?"rgba(58,160,216,0.2)":"var(--bg)",color:s.role==="manager"?"var(--tl)":"var(--tx3)",fontWeight:700}}>{s.role==="manager"?"管理者":"一般"}</span></td>
        </tr>)}</tbody>
      </table></div>
    </div>
    {/* 利用者一覧 */}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:14,marginBottom:10,boxShadow:"var(--sh)"}}>
      <div style={{fontSize:10,fontWeight:700,color:"var(--gr)",letterSpacing:2,marginBottom:10}}>利用者来所一覧</div>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <thead><tr style={{background:"#eef8f2"}}>
          {["氏名","来所","退所","体温","送迎","状態"].map(h=><th key={h} style={{padding:"6px 8px",textAlign:h==="氏名"?"left":"center",fontSize:10,fontWeight:700,color:"var(--tx2)",borderBottom:"2px solid rgba(44,170,96,0.4)"}}>{h}</th>)}
        </tr></thead>
        <tbody>{(viewRep.userList||[]).map((u,i)=><tr key={i} style={{borderBottom:"1px solid var(--bg2)"}}>
          <td style={{padding:"7px 8px",fontWeight:700}}>{u.name}</td>
          <td style={{padding:"7px 8px",textAlign:"center",fontFamily:"'DM Mono',monospace"}}>{u.arrivalTime||"—"}</td>
          <td style={{padding:"7px 8px",textAlign:"center",fontFamily:"'DM Mono',monospace"}}>{u.departTime||"—"}</td>
          <td style={{padding:"7px 8px",textAlign:"center",color:parseFloat(u.temp)>=37.5?"var(--ro)":"var(--gr)",fontWeight:700}}>{u.temp?""+u.temp+"℃":"—"}</td>
          <td style={{padding:"7px 8px",textAlign:"center"}}>{u.transport||"—"}</td>
          <td style={{padding:"7px 8px",textAlign:"center"}}><span style={{fontSize:10,padding:"2px 7px",borderRadius:8,fontWeight:700,background:u.status==="出席"?"rgba(44,170,96,0.2)":u.status==="欠席"?"rgba(224,56,56,0.15)":"rgba(58,160,216,0.2)",color:u.status==="出席"?"var(--gr)":u.status==="欠席"?"var(--ro)":"var(--tl)"}}>{u.status}</span></td>
        </tr>)}</tbody>
      </table></div>
    </div>
    {/* 活動内容 */}
    {(viewRep.activities||[]).filter(a=>a.title).length>0&&<div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:14,marginBottom:10,boxShadow:"var(--sh)"}}>
      <div style={{fontSize:10,fontWeight:700,color:"var(--am)",letterSpacing:2,marginBottom:10}}>活動・支援内容</div>
      {viewRep.activities.filter(a=>a.title).map((a,i)=><div key={i} style={{display:"flex",gap:10,padding:"8px 0",borderBottom:"1px solid var(--bg2)",alignItems:"flex-start"}}>
        <span style={{fontSize:11,fontFamily:"'DM Mono',monospace",color:"var(--tl)",minWidth:42,marginTop:1}}>{a.time||""}</span>
        <div style={{flex:1}}><div style={{fontWeight:700,fontSize:13,marginBottom:2}}>{a.title}</div>{a.detail&&<div style={{fontSize:12,color:"var(--tx2)"}}>{a.detail}</div>}</div>
        {a.staff&&<span style={{fontSize:11,color:"var(--tx3)",whiteSpace:"nowrap"}}>{a.staff}</span>}
      </div>)}
    </div>}
    {/* 活動写真 */}
    {(viewRep.photos||[]).filter(Boolean).length>0&&<div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:14,marginBottom:10,boxShadow:"var(--sh)"}}>
      <div style={{fontSize:10,fontWeight:700,color:"var(--pu)",letterSpacing:2,marginBottom:10}}>活動写真 ({(viewRep.photos||[]).filter(p=>p?.activity).length}枚)</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
        {Array.from({length:6},(_,i)=>{const p=(viewRep.photos||[])[i];return <div key={i} style={{aspectRatio:"4/3",borderRadius:9,border:"1px solid var(--bd)",background:p?.activity?"rgba(58,160,216,0.12)":"var(--bg)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,padding:8}}>
          {p?.activity?<><div style={{fontSize:26}}>📸</div><div style={{fontSize:11,fontWeight:700,color:"var(--tl)",textAlign:"center"}}>{p.activity}</div><div style={{fontSize:10,color:"var(--tx3)"}}>{p.userName}</div>{p.comment&&<div style={{fontSize:10,color:"var(--tx3)",textAlign:"center"}}>{p.comment}</div>}</>
          :<><div style={{fontSize:22,opacity:.3}}>📷</div><div style={{fontSize:10,color:"var(--bda)"}}>写真{i+1}</div></>}
        </div>;})}
      </div>
    </div>}
    {viewRep.incidentDetail&&<div style={{background:"rgba(224,56,56,0.08)",border:"1px solid rgba(224,56,56,0.4)",borderRadius:11,padding:14,marginBottom:10}}><div style={{fontSize:10,fontWeight:700,color:"var(--ro)",letterSpacing:2,marginBottom:7}}>⚠ 特記事項・ヒヤリハット</div><div style={{fontSize:13,color:"var(--tx2)",lineHeight:1.7}}>{viewRep.incidentDetail}</div></div>}
    {viewRep.parentNote&&<div style={{background:"#fff8f0",border:"1px solid rgba(224,168,40,0.4)",borderRadius:11,padding:14,marginBottom:10}}><div style={{fontSize:10,fontWeight:700,color:"var(--am)",letterSpacing:2,marginBottom:7}}>保護者連絡・引継ぎ</div><div style={{fontSize:13,color:"var(--tx2)",lineHeight:1.7}}>{viewRep.parentNote}</div></div>}
    {viewRep.tomorrowNote&&<div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:14,marginBottom:10,boxShadow:"var(--sh)"}}><div style={{fontSize:10,fontWeight:700,color:"var(--tx2)",letterSpacing:2,marginBottom:7}}>明日への引継ぎ</div><div style={{fontSize:13,color:"var(--tx2)",lineHeight:1.7}}>{viewRep.tomorrowNote}</div></div>}
  </div>;

  // ===== 編集画面 =====
  if(mode==="edit") return <div className="fl-wrap">
    <div className="fl-hd"><button className="bback" onClick={()=>setMode("list")}>← 戻る</button><div className="fl-title">📓 業務日報 入力</div></div>
    {/* 基本情報 */}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:14,marginBottom:10,boxShadow:"var(--sh)"}}>
      <div style={{fontSize:10,fontWeight:700,color:"var(--tl)",letterSpacing:2,marginBottom:10}}>基本情報</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        <div><label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",display:"block",marginBottom:4}}>日付</label><input className="fi" type="date" value={rep.date} onChange={e=>updRep("date",e.target.value)}/></div>
        <div><label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",display:"block",marginBottom:4}}>作成者</label><input className="fi" value={rep.author} onChange={e=>updRep("author",e.target.value)}/></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div><label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",display:"block",marginBottom:4}}>天気</label>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{WEATHER_OPTS.map(w=><button key={w} onClick={()=>updRep("weather",w)} style={{padding:"5px 10px",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",borderColor:rep.weather===w?"var(--tl)":"var(--bd)",background:rep.weather===w?"rgba(58,160,216,0.2)":"var(--bg)",color:rep.weather===w?"var(--tl)":"var(--tx3)"}}>{w}</button>)}</div>
        </div>
        <div><label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",display:"block",marginBottom:4}}>外気温</label><input className="fi" placeholder="例: 22℃" value={rep.temperature} onChange={e=>updRep("temperature",e.target.value)}/></div>
      </div>
    </div>
    {/* 出勤職員 */}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:14,marginBottom:10,boxShadow:"var(--sh)"}}>
      <div style={{fontSize:10,fontWeight:700,color:"var(--tl)",letterSpacing:2,marginBottom:10}}>出勤職員一覧 <span style={{fontSize:10,color:"var(--tx3)",fontWeight:400}}>(自動取込済・手動修正可)</span></div>
      {(rep.staffList||[]).map((s,i)=><div key={i} style={{display:"grid",gridTemplateColumns:"1fr auto auto 70px",gap:6,marginBottom:6,alignItems:"center"}}>
        <div style={{fontWeight:700,fontSize:13,padding:"6px 2px"}}>{s.name}</div>
        <TimePicker value={s.clockIn||""} onChange={v=>updStaff(i,"clockIn",v)} label="出勤時刻"/>
        <TimePicker value={s.clockOut||""} onChange={v=>updStaff(i,"clockOut",v)} label="退勤時刻"/>
        <input className="fi" value={s.temp||""} placeholder="36.5℃" onChange={e=>updStaff(i,"temp",e.target.value)} style={{fontSize:12,padding:"6px 8px",textAlign:"center"}}/>
      </div>)}
      <div style={{display:"grid",gridTemplateColumns:"1fr auto auto 70px",gap:6,marginBottom:4}}>
        <div style={{fontSize:10,color:"var(--tx3)",textAlign:"center"}}>氏名</div>
        <div style={{fontSize:10,color:"var(--tx3)",textAlign:"center"}}>出勤</div>
        <div style={{fontSize:10,color:"var(--tx3)",textAlign:"center"}}>退勤</div>
        <div style={{fontSize:10,color:"var(--tx3)",textAlign:"center"}}>体温</div>
      </div>
    </div>
    {/* 利用者一覧 */}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:14,marginBottom:10,boxShadow:"var(--sh)"}}>
      <div style={{fontSize:10,fontWeight:700,color:"var(--gr)",letterSpacing:2,marginBottom:10}}>利用者来所一覧 <span style={{fontSize:10,color:"var(--tx3)",fontWeight:400}}>(自動取込済・手動修正可)</span></div>
      {(rep.userList||[]).map((u,i)=><div key={i} style={{marginBottom:8}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr auto auto 60px 50px",gap:5,alignItems:"center"}}>
          <div style={{fontWeight:700,fontSize:12,padding:"4px 2px"}}>{u.name}</div>
          <TimePicker value={u.arrivalTime||""} onChange={v=>updUser(i,"arrivalTime",v)} label="来所時刻"/>
          <TimePicker value={u.departTime||""} onChange={v=>updUser(i,"departTime",v)} label="退所時刻"/>
          <input className="fi" value={u.temp||""} placeholder="36.5" onChange={e=>updUser(i,"temp",e.target.value)} style={{fontSize:11,padding:"5px 6px",textAlign:"center"}}/>
          <select className="fi" value={u.status||"出席"} onChange={e=>updUser(i,"status",e.target.value)} style={{fontSize:11,padding:"5px 4px"}}>
            {["出席","欠席","予定","早退"].map(s=><option key={s}>{s}</option>)}
          </select>
        </div>
        {/* ISP短期目標バッジ（自動連携） */}
        {u.ispGoal&&<div style={{fontSize:10,color:"var(--tl)",background:"rgba(58,160,216,0.09)",border:"1px solid rgba(58,160,216,0.2)",borderRadius:6,padding:"3px 8px",marginTop:3,marginLeft:2}}>📋 ISP目標：{u.ispGoal}</div>}
      </div>)}
      <div style={{display:"grid",gridTemplateColumns:"1fr auto auto 60px 50px",gap:5}}>
        {["氏名","来所","退所","体温","状態"].map(h=><div key={h} style={{fontSize:10,color:"var(--tx3)",textAlign:"center"}}>{h}</div>)}
      </div>
    </div>
    {/* 活動内容 */}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:14,marginBottom:10,boxShadow:"var(--sh)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontSize:10,fontWeight:700,color:"var(--am)",letterSpacing:2}}>活動・支援内容</div>
        <button className="bexp" style={{padding:"5px 11px"}} onClick={addActivity}>＋ 追加</button>
      </div>
      {(rep.activities||[]).map((a,i)=><div key={i} style={{display:"grid",gridTemplateColumns:"auto 1fr 1.5fr 70px 32px",gap:5,marginBottom:6,alignItems:"flex-start"}}>
        <TimePicker value={a.time||""} onChange={v=>updActivity(i,"time",v)} label="時刻"/>
        <input className="fi" value={a.title} placeholder="活動名" onChange={e=>updActivity(i,"title",e.target.value)} style={{fontSize:12,padding:"6px 8px"}}/>
        <input className="fi" value={a.detail} placeholder="内容・詳細" onChange={e=>updActivity(i,"detail",e.target.value)} style={{fontSize:12,padding:"6px 8px"}}/>
        <input className="fi" value={a.staff} placeholder="担当者" onChange={e=>updActivity(i,"staff",e.target.value)} style={{fontSize:12,padding:"6px 6px"}}/>
        <button onClick={()=>removeActivity(i)} style={{padding:"5px",borderRadius:6,background:"rgba(224,56,56,0.15)",border:"1px solid rgba(224,56,56,0.4)",color:"var(--ro)",cursor:"pointer",fontSize:12,lineHeight:1}}>×</button>
      </div>)}
      <div style={{display:"grid",gridTemplateColumns:"auto 1fr 1.5fr 70px 32px",gap:5,marginTop:4}}>
        {["時刻","活動名","内容・詳細","担当者",""].map((h,i)=><div key={i} style={{fontSize:10,color:"var(--tx3)",textAlign:"center"}}>{h}</div>)}
      </div>
    </div>
    {/* 活動写真（4〜6枚） */}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:14,marginBottom:10,boxShadow:"var(--sh)"}}>
      <div style={{fontSize:10,fontWeight:700,color:"var(--pu)",letterSpacing:2,marginBottom:10}}>活動写真（最大6枚）<span style={{fontSize:10,color:"var(--tx3)",fontWeight:400}}> ※写真記録から自動取込・手動入力も可</span></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
        {Array.from({length:6},(_,i)=>{const p=(rep.photos||[])[i]||{};return <div key={i} style={{border:"1.5px dashed var(--bd)",borderRadius:9,padding:10,background:p.activity?"rgba(58,160,216,0.1)":"var(--bg)"}}>
          <div style={{aspectRatio:"4/3",background:p.activity?"rgba(58,160,216,0.12)":"var(--bg2)",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:p.activity?28:22,marginBottom:7,opacity:p.activity?1:.5}}>
            {p.activity?"📸":"📷"}
          </div>
          <input className="fi" value={p.activity||""} placeholder="活動名" onChange={e=>updPhoto(i,"activity",e.target.value)} style={{fontSize:11,padding:"5px 8px",marginBottom:5}}/>
          <input className="fi" value={p.userName||""} placeholder="利用者名" onChange={e=>updPhoto(i,"userName",e.target.value)} style={{fontSize:11,padding:"5px 8px",marginBottom:5}}/>
          <input className="fi" value={p.comment||""} placeholder="コメント" onChange={e=>updPhoto(i,"comment",e.target.value)} style={{fontSize:11,padding:"5px 8px"}}/>
        </div>;})}
      </div>
    </div>
    {/* テキスト項目 */}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:14,marginBottom:10,boxShadow:"var(--sh)"}}>
      <div style={{fontSize:10,fontWeight:700,color:"var(--ro)",letterSpacing:2,marginBottom:6}}>⚠ 特記事項・ヒヤリハット</div>
      <textarea className="fta" style={{minHeight:60}} placeholder="ヒヤリハット・事故・怪我・体調不良など" value={rep.incidentDetail} onChange={e=>{updRep("incidentDetail",e.target.value);updRep("incidents",e.target.value?1:0);}}/>
      <div style={{fontSize:10,fontWeight:700,color:"var(--am)",letterSpacing:2,margin:"12px 0 6px"}}>保護者連絡・引継ぎ事項</div>
      <textarea className="fta" style={{minHeight:60}} placeholder="保護者への伝達事項・連絡内容" value={rep.parentNote} onChange={e=>updRep("parentNote",e.target.value)}/>
      <div style={{fontSize:10,fontWeight:700,color:"var(--tx2)",letterSpacing:2,margin:"12px 0 6px"}}>明日への引継ぎ・準備事項</div>
      <textarea className="fta" style={{minHeight:60}} placeholder="翌日の担当者への引継ぎ事項・準備物" value={rep.tomorrowNote} onChange={e=>updRep("tomorrowNote",e.target.value)}/>
      {(user.role==="manager"||user.role==="admin")&&<><div style={{fontSize:10,fontWeight:700,color:"var(--tl)",letterSpacing:2,margin:"12px 0 6px"}}>管理者コメント</div>
      <textarea className="fta" style={{minHeight:60}} placeholder="管理者からのコメント・指示" value={rep.managerNote} onChange={e=>updRep("managerNote",e.target.value)}/></>}
    </div>
    <div style={{display:"flex",gap:10,paddingBottom:32}}>
      <button className="bsave" style={{background:"var(--bg)",color:"var(--tx2)",border:"1.5px solid var(--bd)",flex:1}} onClick={()=>save("下書き")}>下書き保存</button>
      <button className="bsave" style={{flex:1.5}} onClick={()=>save("確認済")}>確定・保存する</button>
    </div>
  </div>;

  // ===== 一覧 =====
  return <div className="fl-wrap">
    <div className="fl-hd"><button className="bback" onClick={onBack}>← 戻る</button><div className="fl-title">📓 業務日報</div></div>
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:14,marginBottom:12,boxShadow:"var(--sh)"}}>
      <div style={{fontSize:10,fontWeight:700,color:"var(--tl)",letterSpacing:2,marginBottom:8}}>日付を選択して作成・編集</div>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        <input className="fi" type="date" value={selDate} onChange={e=>changeDate(e.target.value)} style={{flex:1,maxWidth:180}}/>
        <button className="bsave" style={{flex:"0 0 auto",width:"auto",padding:"10px 20px",marginTop:0}}
          onClick={()=>setMode("edit")}>
          {existingRep?"✏️ 編集":"＋ 新規作成"}
        </button>
      </div>
    </div>
    <div style={{fontSize:13,fontWeight:700,marginBottom:10}}>📋 過去の日報一覧</div>
    {reports.length===0?<div style={{textAlign:"center",color:"var(--tx3)",padding:"36px 0",fontSize:13}}>業務日報がありません</div>
    :reports.map(r=><div key={r.date} style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:14,marginBottom:8,cursor:"pointer",boxShadow:"var(--sh)",transition:"all .15s"}}
      onClick={()=>{setViewRep(r);setMode("view");}}
      onMouseEnter={e=>e.currentTarget.style.borderColor="var(--tl)"}
      onMouseLeave={e=>e.currentTarget.style.borderColor="var(--bd)"}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{fontWeight:900,fontSize:15}}>{r.date} <span style={{fontSize:12,fontWeight:400}}>({r.weather})</span></div>
        <span style={{fontSize:11,padding:"2px 9px",borderRadius:10,fontWeight:700,background:r.status==="確認済"?"rgba(44,170,96,0.2)":"rgba(224,168,40,0.18)",color:r.status==="確認済"?"var(--gr)":"var(--am)"}}>{r.status}</span>
      </div>
      <div style={{display:"flex",gap:14,fontSize:12,color:"var(--tx3)"}}>
        <span>👥 職員 <strong style={{color:"var(--tl)"}}>{(r.staffList||[]).length}名</strong></span>
        <span>🧒 利用者 <strong style={{color:"var(--gr)"}}>{(r.userList||[]).length}名</strong></span>
        <span>📸 写真 <strong style={{color:"var(--pu)"}}>{(r.photos||[]).filter(p=>p?.activity).length}枚</strong></span>
        {r.incidents>0&&<span style={{color:"var(--ro)"}}>⚠ 特記{r.incidents}件</span>}
      </div>
    </div>)}
  </div>;
}




// ==================== 期限判定ユーティリティ ====================
// 残り日数を計算
function daysUntil(dateStr) {
  if(!dateStr) return null;
  const target = new Date(dateStr + "T00:00:00");
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.ceil((target - today) / (1000*60*60*24));
}
// ステータス判定: "expired" | "urgent" | "soon" | "ok" | null
function expiryStatus(dateStr) {
  const d = daysUntil(dateStr);
  if(d === null) return null;
  if(d < 0)   return "expired";
  if(d <= 30)  return "urgent";
  if(d <= 90)  return "soon";
  return "ok";
}
// ステータス → スタイル
function expiryStyle(status) {
  return {
    expired: {bg:"rgba(224,56,56,0.15)", color:"var(--ro)", border:"rgba(224,56,56,0.4)", label:"期限切れ",    icon:"🔴"},
    urgent:  {bg:"rgba(224,168,40,0.18)", color:"var(--am)", border:"rgba(224,168,40,0.4)", label:"30日以内",    icon:"🟠"},
    soon:    {bg:"#fef8e6", color:"#8a6200", border:"#e8d870", label:"90日以内",    icon:"🟡"},
    ok:      {bg:"rgba(44,170,96,0.2)", color:"var(--gr)", border:"rgba(44,170,96,0.4)", label:"有効",         icon:"🟢"},
    null:    {bg:"var(--bg)",color:"var(--tx3)",border:"var(--bd)",label:"期限なし", icon:"⚪"},
  }[status||"null"] || {bg:"var(--bg)",color:"var(--tx3)",border:"var(--bd)",label:"—",icon:"⚪"};
}
// ISP の期限をパース（例: "2026年4月〜2026年9月" の末尾日付）
function ispEndDate(period) {
  if(!period) return null;
  // "〜YYYY年M月" または "〜YYYY-MM-DD" を抽出
  const m1 = period.match(/〜(\d{4})年(\d{1,2})月(?:(\d{1,2})日)?/);
  if(m1) {
    const y=+m1[1], mo=+m1[2], d=m1[3]?+m1[3]:1;
    // 月末を返す
    return `${y}-${String(mo).padStart(2,"0")}-${String(new Date(y,mo,0).getDate()).padStart(2,"0")}`;
  }
  const m2 = period.match(/〜(\d{4}-\d{2}-\d{2})/);
  if(m2) return m2[1];
  return null;
}
// 利用者ごとの全期限アラートをまとめて返す
function getUserAlerts(u, store) {
  const alerts = [];
  // 受給者証
  const fs = store.facesheets.find(f=>f.userId===u.id);
  const jExpiry = (fs?.jukyushaExpiry) || u.jukyushaExpiry;
  if(jExpiry) {
    const st = expiryStatus(jExpiry);
    if(st && st!=="ok") alerts.push({type:"受給者証",date:jExpiry,status:st,tab:"facesheet"});
  }
  // 個別支援計画（最新）
  const latestIsp = store.isps.filter(x=>x.userId===u.id).sort((a,b)=>b.createdAt>a.createdAt?1:-1)[0];
  if(latestIsp && latestIsp.status==="実施中") {
    const end = ispEndDate(latestIsp.period);
    if(end) {
      const st = expiryStatus(end);
      if(st && st!=="ok") alerts.push({type:"個別支援計画",date:end,status:st,tab:"isp"});
    }
  }
  // アセスメント（最後の実施から半年以上経過）
  const lastAssessment = store.assessments.filter(a=>a.userId===u.id).sort((a,b)=>b.date>a.date?1:-1)[0];
  if(lastAssessment) {
    const last = new Date(lastAssessment.date);
    const sixMonthsLater = new Date(last); sixMonthsLater.setMonth(sixMonthsLater.getMonth()+6);
    const st = expiryStatus(sixMonthsLater.toISOString().slice(0,10));
    if(st && st!=="ok") alerts.push({type:"アセスメント更新",date:sixMonthsLater.toISOString().slice(0,10),status:st,tab:"assessment"});
  } else {
    alerts.push({type:"アセスメント",date:null,status:"expired",tab:"assessment",msg:"未実施"});
  }
  // モニタリング（最後の実施から半年以上）
  const lastMon = store.monitorings.filter(m=>m.userId===u.id).sort((a,b)=>b.date>a.date?1:-1)[0];
  if(lastMon) {
    const last = new Date(lastMon.date);
    const sixMonthsLater = new Date(last); sixMonthsLater.setMonth(sixMonthsLater.getMonth()+6);
    const st = expiryStatus(sixMonthsLater.toISOString().slice(0,10));
    if(st && st!=="ok") alerts.push({type:"モニタリング更新",date:sixMonthsLater.toISOString().slice(0,10),status:st,tab:"monitoring"});
  } else {
    alerts.push({type:"モニタリング",date:null,status:"expired",tab:"monitoring",msg:"未実施"});
  }
  return alerts;
}

// アラートバナーコンポーネント
function AlertBanner({alerts, onTabClick}) {
  if(!alerts || alerts.length===0) return null;
  const urgent = alerts.filter(a=>a.status==="expired"||a.status==="urgent");
  const soon   = alerts.filter(a=>a.status==="soon");
  return <div style={{marginBottom:14}}>
    {urgent.length>0&&<div style={{background:"rgba(224,56,56,0.08)",border:"1.5px solid rgba(224,56,56,0.4)",borderRadius:11,padding:"12px 14px",marginBottom:8}}>
      <div style={{fontSize:12,fontWeight:900,color:"var(--ro)",marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
        🔴 要対応 ({urgent.length}件)
      </div>
      {urgent.map((a,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:i<urgent.length-1?"1px solid rgba(240,160,144,0.3)":"none"}}>
        <div>
          <span style={{fontSize:12,fontWeight:700,color:"var(--ro)"}}>{a.type}</span>
          {a.msg
            ? <span style={{fontSize:11,color:"var(--ro)",marginLeft:6}}>（{a.msg}）</span>
            : <span style={{fontSize:11,color:"var(--ro)",marginLeft:6}}>
                {a.status==="expired"?"期限切れ: ":"30日以内: "}{a.date||""}
              </span>
          }
        </div>
        {onTabClick&&<button onClick={()=>onTabClick(a.tab)} style={{padding:"3px 10px",borderRadius:7,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"var(--ro)",border:"none",color:"#fff"}}>確認 →</button>}
      </div>)}
    </div>}
    {soon.length>0&&<div style={{background:"#fef8e6",border:"1.5px solid #e8d870",borderRadius:11,padding:"12px 14px"}}>
      <div style={{fontSize:12,fontWeight:900,color:"#8a6200",marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
        🟡 期限間近 ({soon.length}件)
      </div>
      {soon.map((a,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:i<soon.length-1?"1px solid rgba(232,216,112,0.4)":"none"}}>
        <div>
          <span style={{fontSize:12,fontWeight:700,color:"#8a6200"}}>{a.type}</span>
          <span style={{fontSize:11,color:"#8a6200",marginLeft:6}}>90日以内: {a.date}</span>
        </div>
        {onTabClick&&<button onClick={()=>onTabClick(a.tab)} style={{padding:"3px 10px",borderRadius:7,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"#8a6200",border:"none",color:"#fff"}}>確認 →</button>}
      </div>)}
    </div>}
  </div>;
}

// ==================== 有給管理ユーティリティ ====================
const PAID_LEAVE_TABLE = [
  { months: 6,  days: 10 },{ months: 18, days: 12 },{ months: 30, days: 14 },
  { months: 42, days: 16 },{ months: 54, days: 18 },{ months: 66, days: 20 },{ months: 78, days: 20 },
];
const PART_LEAVE_TABLE = {
  4:[7,8,9,10,12,13,15], 3:[5,6,6,8,9,10,11], 2:[3,4,4,5,6,6,7], 1:[1,2,2,2,3,3,3]
};
function calcGrantedDays(hireDate, wdpw=5) {
  if(!hireDate) return 0;
  const hire=new Date(hireDate); const today=new Date();
  const totalMonths=(today.getFullYear()-hire.getFullYear())*12+(today.getMonth()-hire.getMonth());
  if(totalMonths<6) return 0;
  if(wdpw>=5){let g=0;for(const r of PAID_LEAVE_TABLE){if(totalMonths>=r.months)g=r.days;}return g;}
  const tbl=PART_LEAVE_TABLE[Math.min(4,Math.max(1,wdpw))]||[];
  const idx=[6,18,30,42,54,66,78].findIndex(m=>totalMonths<m);
  return tbl[idx===-1?tbl.length-1:Math.max(0,idx-1)]||0;
}
function calcUsedDays(staffId, reqs) {
  return reqs.filter(r=>r.staffId===staffId&&r.status==="承認").reduce((s,r)=>s+(r.days||1),0);
}
function calcRemainingDays(staffId, hireDate, reqs, wdpw=5) {
  return Math.max(0, calcGrantedDays(hireDate,wdpw) - calcUsedDays(staffId,reqs));
}
function nextGrantDate(hireDate) {
  if(!hireDate) return "—";
  const hire=new Date(hireDate); const today=new Date();
  const totalMonths=(today.getFullYear()-hire.getFullYear())*12+(today.getMonth()-hire.getMonth());
  const next=[6,18,30,42,54,66,78].find(m=>m>totalMonths);
  if(!next) return "上限（20日）到達";
  const d=new Date(hire); d.setMonth(d.getMonth()+next);
  return d.toLocaleDateString("ja-JP",{year:"numeric",month:"2-digit",day:"2-digit"});
}


// ==================== 有給申請承認カード ====================
function ApprovalCard({r, store}){
  const [comment,setComment]=useState("");
  const SS={"申請中":["rgba(224,168,40,0.18)","var(--am)"],"承認":["rgba(44,170,96,0.2)","var(--gr)"],"却下":["rgba(224,56,56,0.15)","var(--ro)"]};
  const ss=SS[r.status]||["var(--bg)","var(--tx3)"];
  return <div style={{background:"var(--wh)",border:"2px solid var(--am)",borderRadius:12,padding:14,marginBottom:10,boxShadow:"var(--sh)"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
      <div><div style={{fontWeight:900,fontSize:14,marginBottom:2}}>{r.staffName}</div><div style={{fontSize:11,color:"var(--tx3)"}}>申請日: {r.appliedAt}</div></div>
      <span style={{fontSize:11,padding:"3px 10px",borderRadius:9,fontWeight:700,background:ss[0],color:ss[1]}}>{r.status}</span>
    </div>
    <div style={{background:"var(--bg)",borderRadius:8,padding:"9px 11px",marginBottom:10}}>
      <div style={{fontSize:12,marginBottom:4}}><strong>{r.startDate}</strong>{r.startDate!==r.endDate?" 〜 "+r.endDate:""} / {r.type} / <strong style={{color:"var(--tl)"}}>{r.days}日</strong></div>
      <div style={{fontSize:13,color:"var(--tx2)"}}>{r.reason}</div>
    </div>
    <textarea className="fta" style={{minHeight:48,marginBottom:8}} placeholder="コメント（任意）" value={comment} onChange={e=>setComment(e.target.value)}/>
    <div style={{display:"flex",gap:8}}>
      <button onClick={()=>store.updPaidLeaveReq(r.id,{status:"承認",comment,approvedAt:todayISO()})} style={{flex:1,padding:"10px",borderRadius:9,background:"rgba(44,170,96,0.2)",border:"1.5px solid rgba(44,170,96,0.4)",color:"var(--gr)",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>✅ 承認</button>
      <button onClick={()=>store.updPaidLeaveReq(r.id,{status:"却下",comment,approvedAt:todayISO()})} style={{flex:1,padding:"10px",borderRadius:9,background:"rgba(224,56,56,0.15)",border:"1.5px solid rgba(224,56,56,0.4)",color:"var(--ro)",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>❌ 却下</button>
    </div>
  </div>;
}

// ==================== 有給管理画面 ====================
function PaidLeaveScreen({user, store, onBack}){
  const [tab,setTab]=useState("list");
  const [form,setForm]=useState({startDate:todayISO(),endDate:todayISO(),days:1,reason:"",type:"全日"});
  const [filterFac,setFilterFac]=useState(user.selectedFacilityId||"all");
  const isMgr=user.role==="manager"||user.role==="admin";
  const upd=(k,v)=>setForm(p=>({...p,[k]:v}));
  const myStaff=store.dynStaff.find(s=>s.id===user.staffId);
  const myGranted=myStaff?calcGrantedDays(myStaff.hireDate,myStaff.workDaysPerWeek||5):0;
  const myUsed=myStaff?calcUsedDays(myStaff.id,store.paidLeaveReqs):0;
  const myRemaining=myGranted-myUsed;
  const myReqs=store.paidLeaveReqs.filter(r=>r.staffId===user.staffId);
  const mgrStaff=store.dynStaff.filter(s=>(filterFac==="all"||s.facilityId===filterFac)&&s.active!==false);
  const pendingReqs=store.paidLeaveReqs.filter(r=>r.status==="申請中"&&(filterFac==="all"||r.facilityId===filterFac));
  const SS={"申請中":["rgba(224,168,40,0.18)","var(--am)"],"承認":["rgba(44,170,96,0.2)","var(--gr)"],"却下":["rgba(224,56,56,0.15)","var(--ro)"]};
  const submit=()=>{
    if(!form.reason.trim()) return;
    store.addPaidLeaveReq({id:genId(),staffId:user.staffId,staffName:user.displayName,facilityId:user.selectedFacilityId,...form,status:"申請中",appliedAt:todayISO()});
    setForm({startDate:todayISO(),endDate:todayISO(),days:1,reason:"",type:"全日"});
    setTab("list");
  };
  const csvExport=()=>{
    const rows=mgrStaff.map(s=>{const g=calcGrantedDays(s.hireDate,s.workDaysPerWeek||5);const u=calcUsedDays(s.id,store.paidLeaveReqs);return [s.name,FACILITIES.find(f=>f.id===s.facilityId)?.name,s.employmentType||"",s.hireDate||"",g,u,Math.max(0,g-u),nextGrantDate(s.hireDate)].join(",");});
    const csv=["氏名,施設,雇用形態,入職日,付与日数,取得済,残日数,次回付与日",...rows].join("\n");
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["﻿"+csv],{type:"text/csv"}));a.download="有給管理_"+todayISO()+".csv";a.click();
  };

  return <div className="fl-wrap">
    <div className="fl-hd"><button className="bback" onClick={onBack}>← 戻る</button><div className="fl-title">🌴 有給管理</div></div>

    {/* 自分の有給サマリー */}
    {myStaff&&<div style={{background:"linear-gradient(135deg,#1a6b3a,#0080b8)",borderRadius:12,padding:"16px 18px",marginBottom:14,color:"#fff"}}>
      <div style={{fontSize:11,opacity:.8,marginBottom:8}}>{myStaff.name} の有給状況</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:10}}>
        {[["付与日数",myGranted+"日","今年度"],["取得済み",myUsed+"日","承認済み"],["残日数",myRemaining+"日","利用可能"]].map(([l,v,s],i)=><div key={l} style={{background:"rgba(255,255,255,0.15)",borderRadius:8,padding:"10px",textAlign:"center"}}>
          <div style={{fontSize:9,opacity:.8,marginBottom:2}}>{l}</div>
          <div style={{fontSize:i===2?26:20,fontWeight:900,fontFamily:"'DM Mono',monospace"}}>{v}</div>
          <div style={{fontSize:9,opacity:.7,marginTop:1}}>{s}</div>
        </div>)}
      </div>
      <div style={{fontSize:11,opacity:.75}}>入職日: {myStaff.hireDate||"未設定"} ／ 次回付与: {nextGrantDate(myStaff.hireDate)}</div>
      <div style={{marginTop:8,height:5,background:"rgba(255,255,255,0.2)",borderRadius:3,overflow:"hidden"}}>
        <div style={{height:"100%",width:(myGranted>0?Math.min(100,myRemaining/myGranted*100):0)+"%",background:"#fff",borderRadius:3}}/>
      </div>
    </div>}

    {/* タブ */}
    <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
      {[["list","申請履歴"],["apply","📝 有給申請"],
        ...(isMgr?[["manage","👔 承認管理"],["staff","📊 スタッフ一覧"]]:[])]
        .map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={{padding:"7px 14px",borderRadius:16,fontFamily:"'Noto Sans JP',sans-serif",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",background:tab===k?"var(--tl)":"var(--wh)",color:tab===k?"#fff":"var(--tx3)",border:tab===k?"none":"1.5px solid var(--bd)",boxShadow:"var(--sh)"}}>
          {l}{k==="manage"&&pendingReqs.length>0&&<span style={{background:"var(--ro)",color:"#fff",borderRadius:8,padding:"1px 6px",fontSize:10,marginLeft:3}}>{pendingReqs.length}</span>}
        </button>)}
    </div>

    {/* 申請履歴 */}
    {tab==="list"&&<div>
      {myReqs.length===0?<div style={{textAlign:"center",color:"var(--tx3)",padding:"36px 0",fontSize:13}}>申請履歴がありません</div>
      :myReqs.sort((a,b)=>b.appliedAt>a.appliedAt?1:-1).map(r=>{const ss=SS[r.status]||["var(--bg)","var(--tx3)"];return <div key={r.id} style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:14,marginBottom:8,boxShadow:"var(--sh)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <div style={{fontWeight:700,fontSize:14}}>{r.startDate}{r.startDate!==r.endDate?" 〜 "+r.endDate:""}</div>
          <span style={{fontSize:11,padding:"3px 10px",borderRadius:10,fontWeight:700,background:ss[0],color:ss[1]}}>{r.status}</span>
        </div>
        <div style={{fontSize:12,color:"var(--tx3)",marginBottom:6}}>種別: {r.type} ／ {r.days}日 ／ 申請: {r.appliedAt}</div>
        <div style={{fontSize:13,color:"var(--tx2)",background:"var(--bg)",borderRadius:7,padding:"7px 9px"}}>{r.reason}</div>
        {r.comment&&<div style={{fontSize:12,color:"var(--tx3)",marginTop:5}}>管理者: {r.comment}</div>}
      </div>;})}
    </div>}

    {/* 有給申請 */}
    {tab==="apply"&&<div style={{paddingBottom:28}}>
      {myRemaining<=0&&<div style={{background:"rgba(224,56,56,0.08)",border:"1px solid rgba(224,56,56,0.4)",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:13,color:"var(--ro)",fontWeight:700}}>⚠ 有給残日数がありません（残: {myRemaining}日）</div>}
      <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:16,marginBottom:12,boxShadow:"var(--sh)"}}>
        <div style={{fontSize:10,fontWeight:700,color:"var(--tl)",letterSpacing:2,marginBottom:12}}>有給休暇申請</div>
        <div style={{marginBottom:12}}>
          <label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",display:"block",marginBottom:6}}>取得種別</label>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {["全日","半日（午前）","半日（午後）","時間休"].map(t=><button key={t} onClick={()=>upd("type",t)} style={{padding:"7px 12px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",borderColor:form.type===t?"var(--tl)":"var(--bd)",background:form.type===t?"rgba(58,160,216,0.2)":"var(--bg)",color:form.type===t?"var(--tl)":"var(--tx3)"}}>
              {t}
            </button>)}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px",marginBottom:12}}>
          <div><label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",display:"block",marginBottom:5}}>開始日</label><input className="fi" type="date" value={form.startDate} onChange={e=>{upd("startDate",e.target.value);upd("endDate",e.target.value);}}/></div>
          <div><label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",display:"block",marginBottom:5}}>終了日</label><input className="fi" type="date" value={form.endDate} onChange={e=>upd("endDate",e.target.value)}/></div>
        </div>
        <div style={{marginBottom:12}}>
          <label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",display:"block",marginBottom:6}}>取得日数</label>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {[0.5,1,2,3,4,5].map(d=><button key={d} onClick={()=>upd("days",d)} style={{padding:"7px 11px",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'DM Mono',monospace",border:"1.5px solid",borderColor:form.days===d?"var(--tl)":"var(--bd)",background:form.days===d?"rgba(58,160,216,0.2)":"var(--bg)",color:form.days===d?"var(--tl)":"var(--tx3)"}}>
              {d}日
            </button>)}
          </div>
        </div>
        <div style={{marginBottom:12}}>
          <label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",display:"block",marginBottom:5}}>取得理由 <span style={{color:"var(--ro)"}}>*</span></label>
          <textarea className="fta" style={{minHeight:72}} placeholder="例）私用のため / 子の学校行事 / 通院" value={form.reason} onChange={e=>upd("reason",e.target.value)}/>
        </div>
        <div style={{background:"rgba(58,160,216,0.1)",borderRadius:9,padding:"9px 12px",marginBottom:12,fontSize:12}}>
          申請後の残日数: <strong style={{color:myRemaining-form.days<0?"var(--ro)":"var(--gr)",fontSize:15}}>{myRemaining-form.days}日</strong>
        </div>
        <button className="bsave" disabled={!form.reason.trim()||myRemaining<form.days} onClick={submit}>申請する</button>
      </div>
    </div>}

    {/* 承認管理 */}
    {tab==="manage"&&isMgr&&<div>
      {user.role==="admin"&&<div style={{marginBottom:10}}><select className="fsm" value={filterFac} onChange={e=>setFilterFac(e.target.value)}><option value="all">全施設</option>{FACILITIES.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></div>}
      {pendingReqs.length===0?<div style={{textAlign:"center",color:"var(--tx3)",padding:"28px 0",fontSize:13}}>承認待ちの申請はありません ✅</div>
      :pendingReqs.map(r=><ApprovalCard key={r.id} r={r} store={store}/>)}
      <div style={{fontSize:12,fontWeight:700,color:"var(--tx3)",margin:"16px 0 8px"}}>処理済み申請</div>
      {store.paidLeaveReqs.filter(r=>r.status!=="申請中"&&(filterFac==="all"||r.facilityId===filterFac)).sort((a,b)=>b.appliedAt>a.appliedAt?1:-1).map(r=>{const ss=SS[r.status]||[];return <div key={r.id} style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:10,padding:11,marginBottom:6,boxShadow:"var(--sh)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
          <div style={{fontWeight:700,fontSize:13}}>{r.staffName}</div>
          <span style={{fontSize:10,padding:"2px 8px",borderRadius:8,fontWeight:700,background:ss[0],color:ss[1]}}>{r.status}</span>
        </div>
        <div style={{fontSize:11,color:"var(--tx3)"}}>{r.startDate}〜{r.endDate} / {r.type} / {r.days}日</div>
      </div>;})}
    </div>}

    {/* スタッフ別一覧 */}
    {tab==="staff"&&isMgr&&<div>
      {user.role==="admin"&&<div style={{marginBottom:10}}><select className="fsm" value={filterFac} onChange={e=>setFilterFac(e.target.value)}><option value="all">全施設</option>{FACILITIES.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></div>}
      <div style={{overflowX:"auto",marginBottom:12}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:560}}>
          <thead><tr style={{background:"#e4e8f0"}}>
            {["氏名","施設","入職日","付与","取得","残","次回付与日"].map(h=><th key={h} style={{padding:"8px 10px",textAlign:h==="氏名"?"left":"center",fontSize:10,fontWeight:700,color:"var(--tx2)",borderBottom:"2px solid var(--bd)",whiteSpace:"nowrap"}}>{h}</th>)}
          </tr></thead>
          <tbody>{mgrStaff.map(s=>{
            const g=calcGrantedDays(s.hireDate,s.workDaysPerWeek||5);
            const u=calcUsedDays(s.id,store.paidLeaveReqs);
            const rem=Math.max(0,g-u);
            return <tr key={s.id} style={{borderBottom:"1px solid var(--bg2)"}}>
              <td style={{padding:"9px 10px",fontWeight:700}}>{s.name}</td>
              <td style={{padding:"9px 10px",textAlign:"center",fontSize:11,color:"var(--tx3)"}}>{FACILITIES.find(f=>f.id===s.facilityId)?.name}</td>
              <td style={{padding:"9px 10px",textAlign:"center",fontFamily:"'DM Mono',monospace",fontSize:11}}>{s.hireDate||"—"}</td>
              <td style={{padding:"9px 10px",textAlign:"center",fontWeight:700,color:"var(--tl)"}}>{g}日</td>
              <td style={{padding:"9px 10px",textAlign:"center",color:"var(--am)",fontWeight:700}}>{u}日</td>
              <td style={{padding:"9px 10px",textAlign:"center"}}><span style={{padding:"3px 9px",borderRadius:8,fontWeight:900,background:rem<=3?"rgba(224,56,56,0.15)":rem<=7?"rgba(224,168,40,0.18)":"rgba(44,170,96,0.2)",color:rem<=3?"var(--ro)":rem<=7?"var(--am)":"var(--gr)"}}>{rem}日</span></td>
              <td style={{padding:"9px 10px",textAlign:"center",fontSize:11,color:"var(--tx3)"}}>{nextGrantDate(s.hireDate)}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      <button className="bexp" onClick={csvExport}>⬇ CSV出力</button>
    </div>}
  </div>;
}


// ==================== スタッフ詳細・資格証書管理 ====================
const QUAL_CATEGORIES = [
  "保育士",
  "社会福祉士",
  "精神保健福祉士",
  "介護福祉士",
  "児童指導員",
  "児童指導員5年以上",
  "児童発達支援管理責任者",
  "管理者",
  "臨床心理士・公認心理師",
  "作業療法士",
  "理学療法士",
  "言語聴覚士",
  "看護師・准看護師",
  "健康診断書",
  "その他",
];

function StaffDetail({s, store, isMgr, onBack, onEdit}){
  const [addMode, setAddMode] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [form, setForm] = useState({
    category:"保育士", name:"", issueDate:"", expiryDate:"",
    issuer:"", number:"", hasCopy:false, note:""
  });
  const [viewDoc, setViewDoc] = useState(null);
  const upd = (k,v) => setForm(p=>({...p,[k]:v}));

  const myDocs = store.qualDocs.filter(d=>d.staffId===s.id)
    .sort((a,b)=>a.category>b.category?1:-1);

  const fac = FACILITIES.find(f=>f.id===s.facilityId);
  const age = calcAge(s.dob);
  const granted = calcGrantedDays(s.hireDate, s.workDaysPerWeek||5);
  const used = calcUsedDays(s.id, store.paidLeaveReqs);
  const remaining = Math.max(0, granted - used);

  const saveDoc = () => {
    store.addQualDoc({
      id:genId(), staffId:s.id, staffName:s.name,
      facilityId:s.facilityId, registeredAt:todayISO(), ...form
    });
    setForm({category:"保育士",name:"",issueDate:"",expiryDate:"",issuer:"",number:"",hasCopy:false,note:""});
    setAddMode(false);
  };

  // 有効期限チェック
  const isExpiring = d => {
    if(!d.expiryDate) return null;
    const exp = new Date(d.expiryDate);
    const today = new Date();
    const diff = (exp - today) / (1000*60*60*24);
    if(diff < 0) return "expired";
    if(diff < 90) return "soon";
    return "ok";
  };

  const expStyle = status => ({
    expired: {bg:"rgba(224,56,56,0.15)",color:"var(--ro)",label:"期限切れ"},
    soon:    {bg:"rgba(224,168,40,0.18)",color:"var(--am)",label:"期限間近"},
    ok:      {bg:"rgba(44,170,96,0.2)",color:"var(--gr)",label:"有効"},
    null:    {bg:"var(--bg)",color:"var(--tx3)",label:"期限なし"},
  }[status||"null"]);

  // 詳細モーダル
  if(viewDoc) return (
    <div className="fl-wrap">
      <div className="fl-hd">
        <button className="bback" onClick={()=>setViewDoc(null)}>← 戻る</button>
        <div className="fl-title">📄 資格証書詳細</div>
      </div>
      <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:12,padding:18,marginBottom:12,boxShadow:"var(--sh)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
          <div>
            <div style={{fontSize:18,fontWeight:900,marginBottom:3}}>{viewDoc.name||viewDoc.category}</div>
            <div style={{fontSize:12,color:"var(--tx3)"}}>{viewDoc.category}</div>
          </div>
          {(()=>{const st=isExpiring(viewDoc);const es=expStyle(st);return <span style={{padding:"4px 12px",borderRadius:10,fontSize:12,fontWeight:700,background:es.bg,color:es.color}}>{es.label}</span>;})()}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
          {[
            ["登録者",viewDoc.staffName],
            ["資格番号",viewDoc.number||"—"],
            ["発行機関",viewDoc.issuer||"—"],
            ["取得日",viewDoc.issueDate||"—"],
            ["有効期限",viewDoc.expiryDate||"期限なし"],
            ["登録日",viewDoc.registeredAt],
          ].map(([l,v])=><div key={l} style={{marginBottom:12}}>
            <div style={{fontSize:10,fontWeight:700,color:"var(--tl)",letterSpacing:1,marginBottom:4}}>{l}</div>
            <div style={{fontSize:13,color:"var(--tx)",borderBottom:"1px solid var(--bg2)",paddingBottom:4}}>{v}</div>
          </div>)}
        </div>
        {/* コピー画像欄 */}
        <div style={{marginTop:8}}>
          <div style={{fontSize:10,fontWeight:700,color:"var(--tl)",letterSpacing:1,marginBottom:8}}>証書コピー</div>
          {viewDoc.hasCopy
            ? <div style={{border:"1.5px solid rgba(44,170,96,0.4)",borderRadius:10,padding:"20px",background:"#eef8f2",textAlign:"center"}}>
                <div style={{fontSize:40,marginBottom:8}}>📄</div>
                <div style={{fontWeight:700,color:"var(--gr)",fontSize:13,marginBottom:4}}>コピー登録済み</div>
                <div style={{fontSize:11,color:"var(--tx3)"}}>登録日: {viewDoc.registeredAt}</div>
              </div>
            : <div style={{border:"2px dashed var(--bd)",borderRadius:10,padding:"20px",background:"var(--bg)",textAlign:"center",color:"var(--tx3)",fontSize:13}}>
                コピー未登録
              </div>
          }
        </div>
        {viewDoc.note&&<div style={{marginTop:12}}>
          <div style={{fontSize:10,fontWeight:700,color:"var(--tx2)",letterSpacing:1,marginBottom:4}}>備考</div>
          <div style={{fontSize:13,color:"var(--tx2)",background:"var(--bg)",borderRadius:8,padding:"9px 11px"}}>{viewDoc.note}</div>
        </div>}
        {isMgr&&<div style={{marginTop:14,display:"flex",gap:8}}>
          <button onClick={()=>{store.delQualDoc(viewDoc.id);setViewDoc(null);}} style={{padding:"8px 18px",borderRadius:9,background:"rgba(224,56,56,0.15)",border:"1.5px solid rgba(224,56,56,0.4)",color:"var(--ro)",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>🗑️ 削除</button>
        </div>}
      </div>
    </div>
  );

  // 追加フォーム
  if(addMode) return (
    <div className="fl-wrap">
      <div className="fl-hd">
        <button className="bback" onClick={()=>setAddMode(false)}>← 戻る</button>
        <div className="fl-title">➕ 資格証書を登録</div>
      </div>
      <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:12,padding:18,marginBottom:12,boxShadow:"var(--sh)"}}>
        <div style={{fontSize:10,fontWeight:700,color:"var(--tl)",letterSpacing:2,marginBottom:12}}>資格・証書の種類</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:16}}>
          {QUAL_CATEGORIES.map(c=><button key={c} onClick={()=>upd("category",c)} style={{padding:"7px 12px",borderRadius:9,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",borderColor:form.category===c?"var(--tl)":"var(--bd)",background:form.category===c?"rgba(58,160,216,0.2)":"var(--bg)",color:form.category===c?"var(--tl)":"var(--tx2)"}}>
            {c}
          </button>)}
        </div>

        <div style={{marginBottom:12}}>
          <label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",letterSpacing:1,display:"block",marginBottom:5}}>資格名・証書名（詳細）</label>
          <input className="fi" value={form.name} placeholder={"例）"+form.category+" 第〇〇号"} onChange={e=>upd("name",e.target.value)}/>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px",marginBottom:0}}>
          <div style={{marginBottom:12}}>
            <label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",letterSpacing:1,display:"block",marginBottom:5}}>資格番号</label>
            <input className="fi" value={form.number} placeholder="例）第12345号" onChange={e=>upd("number",e.target.value)}/>
          </div>
          <div style={{marginBottom:12}}>
            <label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",letterSpacing:1,display:"block",marginBottom:5}}>発行機関</label>
            <input className="fi" value={form.issuer} placeholder="例）厚生労働大臣" onChange={e=>upd("issuer",e.target.value)}/>
          </div>
          <div style={{marginBottom:12}}>
            <label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",letterSpacing:1,display:"block",marginBottom:5}}>取得日</label>
            <input className="fi" type="date" value={form.issueDate} onChange={e=>upd("issueDate",e.target.value)}/>
          </div>
          <div style={{marginBottom:12}}>
            <label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",letterSpacing:1,display:"block",marginBottom:5}}>有効期限（任意）</label>
            <input className="fi" type="date" value={form.expiryDate} onChange={e=>upd("expiryDate",e.target.value)}/>
          </div>
        </div>

        {/* 証書コピー撮影 */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:10,fontWeight:700,color:"var(--pu)",letterSpacing:1,marginBottom:8}}>証書コピー</div>
          <div style={{border:"2px dashed var(--bd)",borderRadius:11,padding:18,background:form.hasCopy?"#eef8f2":"var(--bg)",textAlign:"center",transition:"all .2s"}}>
            {form.hasCopy
              ? <div>
                  <div style={{fontSize:36,marginBottom:6}}>✅</div>
                  <div style={{fontWeight:700,color:"var(--gr)",fontSize:13,marginBottom:4}}>コピー登録済み</div>
                  <div style={{fontSize:11,color:"var(--tx3)",marginBottom:10}}>実際の証書コピーが登録されました</div>
                  <button onClick={()=>upd("hasCopy",false)} style={{padding:"6px 14px",borderRadius:8,background:"rgba(224,56,56,0.15)",border:"1px solid rgba(224,56,56,0.4)",color:"var(--ro)",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>
                    削除して撮り直す
                  </button>
                </div>
              : <div>
                  <div style={{fontSize:36,marginBottom:6,opacity:.4}}>📄</div>
                  <div style={{fontSize:12,color:"var(--tx3)",marginBottom:12}}>資格証書・免許証のコピーを撮影して登録できます</div>
                  <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
                    <button onClick={()=>upd("hasCopy",true)} style={{padding:"10px 20px",borderRadius:10,background:"var(--tl)",border:"none",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>
                      📷 カメラで撮影
                    </button>
                    <button onClick={()=>upd("hasCopy",true)} style={{padding:"10px 20px",borderRadius:10,background:"var(--wh)",border:"1.5px solid var(--tl)",color:"var(--tl)",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>
                      🖼️ ファイルから選択
                    </button>
                  </div>
                </div>
            }
          </div>
        </div>

        <div style={{marginBottom:16}}>
          <label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",letterSpacing:1,display:"block",marginBottom:5}}>備考</label>
          <textarea className="fta" style={{minHeight:60}} placeholder="更新予定・注意事項など" value={form.note} onChange={e=>upd("note",e.target.value)}/>
        </div>

        <button className="bsave" onClick={saveDoc}>資格証書を登録する</button>
      </div>
    </div>
  );

  // ===== 詳細メイン =====
  return (
    <div className="fl-wrap">
      <div className="fl-hd">
        <button className="bback" onClick={onBack}>← 戻る</button>
        <div className="fl-title">👤 {s.name}</div>
        {isMgr&&<button className="bexp" style={{marginLeft:"auto"}} onClick={onEdit}>✏️ 編集</button>}
        {isMgr&&<button onClick={()=>{
          if(window.confirm(s.name+"さんのデータを完全に削除しますか？\nこの操作は取り消せません。")){
            store.delStaff(s.id);
            onBack();
          }
        }} style={{padding:"6px 12px",borderRadius:8,background:"rgba(224,56,56,0.15)",border:"1.5px solid rgba(224,56,56,0.4)",color:"var(--ro)",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",marginLeft:6}}>🗑️ 削除</button>}
      </div>

      {/* プロフィール */}
      <div style={{background:"linear-gradient(135deg,var(--tl),var(--gr))",borderRadius:12,padding:"16px 18px",marginBottom:14,color:"#fff",display:"flex",gap:14,alignItems:"center"}}>
        <div style={{width:56,height:56,borderRadius:"50%",background:"rgba(255,255,255,0.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,fontWeight:900,flexShrink:0}}>
          {s.name.charAt(0)}
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:20,fontWeight:900,marginBottom:2}}>{s.name}</div>
          <div style={{fontSize:12,opacity:.85}}>{fac?.name} ／ {s.role==="manager"?"管理者":s.role==="cdsm"?"児童発達支援管理責任者":s.role==="specialist"?"専門職員":s.role==="part_qual"?"パート（指導員）":s.role==="part_noqual"?"パート（資格なし）":s.role==="consultant"?"相談支援員":"支援員"} ／ {s.employmentType||"正社員"}</div>
          {s.dob&&<div style={{fontSize:11,opacity:.75,marginTop:2}}>{s.dob}生（{age}歳）</div>}
        </div>
      </div>

      {/* 基本情報タイル */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:14}}>
        {[
          {label:"入職日",val:s.hireDate||"—",icon:"📅"},
          {label:"携帯",val:s.tel||"—",icon:"📞"},
          {label:"有給残",val:remaining+"日",icon:"🌴",color:remaining<=3?"var(--ro)":remaining<=7?"var(--am)":"var(--gr)"},
          {label:"次回有給付与",val:nextGrantDate(s.hireDate),icon:"🎁"},
        ].map(item=><div key={item.label} style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:10,padding:"11px 13px",boxShadow:"var(--sh)"}}>
          <div style={{fontSize:10,color:"var(--tx3)",marginBottom:3}}>{item.icon} {item.label}</div>
          <div style={{fontSize:13,fontWeight:700,color:item.color||"var(--tx)"}}>{item.val}</div>
        </div>)}
      </div>

      {/* 資格・証書一覧 */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontSize:14,fontWeight:900,color:"var(--tx)"}}>📄 資格・証書一覧</div>
        {isMgr&&<button className="bsave" style={{width:"auto",padding:"8px 16px",marginTop:0,fontSize:12}} onClick={()=>setAddMode(true)}>
          ＋ 登録する
        </button>}
      </div>

      {/* 有効期限アラート */}
      {myDocs.filter(d=>isExpiring(d)==="expired"||isExpiring(d)==="soon").length>0&&(
        <div style={{background:"rgba(224,56,56,0.08)",border:"1px solid rgba(224,56,56,0.4)",borderRadius:10,padding:"10px 14px",marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:700,color:"var(--ro)",marginBottom:4}}>⚠ 要確認の資格証書</div>
          {myDocs.filter(d=>isExpiring(d)==="expired").map(d=><div key={d.id} style={{fontSize:12,color:"var(--ro)"}}>・{d.name||d.category}（期限切れ: {d.expiryDate}）</div>)}
          {myDocs.filter(d=>isExpiring(d)==="soon").map(d=><div key={d.id} style={{fontSize:12,color:"var(--am)"}}>・{d.name||d.category}（期限間近: {d.expiryDate}）</div>)}
        </div>
      )}

      {myDocs.length===0
        ? <div style={{textAlign:"center",color:"var(--tx3)",padding:"36px 0",fontSize:13,background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,boxShadow:"var(--sh)"}}>
            資格証書が登録されていません<br/>
            {isMgr&&<button className="bsave" style={{width:"auto",padding:"9px 20px",marginTop:14,fontSize:13}} onClick={()=>setAddMode(true)}>＋ 最初の証書を登録する</button>}
          </div>
        : <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:10,paddingBottom:28}}>
            {myDocs.map(d=>{
              const st=isExpiring(d);
              const es=expStyle(st);
              const cardBorderColor = st==="expired"?"rgba(224,56,56,0.4)":st==="soon"?"rgba(224,168,40,0.4)":"var(--bd)";
              return <div key={d.id} style={{background:"var(--wh)",border:"1.5px solid "+cardBorderColor,borderRadius:11,padding:13,cursor:"pointer",boxShadow:"var(--sh)",transition:"all .15s"}}
                onClick={()=>setViewDoc(d)}
                onMouseEnter={e=>e.currentTarget.style.borderColor="var(--tl)"}
                onMouseLeave={e=>e.currentTarget.style.borderColor=st==="expired"?"rgba(224,56,56,0.4)":st==="soon"?"rgba(224,168,40,0.4)":"var(--bd)"}>
                {/* アイコン */}
                <div style={{width:"100%",aspectRatio:"4/3",background:d.hasCopy?"rgba(58,160,216,0.12)":"var(--bg2)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,marginBottom:9}}>
                  {d.hasCopy?"📄":"🔖"}
                </div>
                <div style={{fontSize:11,fontWeight:900,marginBottom:3,lineHeight:1.4}}>{d.name||d.category}</div>
                <div style={{fontSize:10,color:"var(--tx3)",marginBottom:6}}>{d.category}</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:9,padding:"2px 7px",borderRadius:7,fontWeight:700,background:es.bg,color:es.color}}>{es.label}</span>
                  {d.hasCopy&&<span style={{fontSize:9,color:"var(--tl)",fontWeight:700}}>📷コピー有</span>}
                </div>
                {d.expiryDate&&<div style={{fontSize:9,color:"var(--tx3)",marginTop:4}}>期限: {d.expiryDate}</div>}
              </div>;
            })}
          </div>
      }
    </div>
  );
}

// ==================== スタッフ管理 ====================
function StaffManagement({user, store, onBack}){
  const [screen, setScreen] = useState("list"); // list | register | edit | detail
  const [selStaff, setSelStaff] = useState(null);
  const isMgr = user.role==="manager"||user.role==="admin";
  const staffList = store.dynStaff.filter(s=>user.role==="admin"||s.facilityId===user.selectedFacilityId);
  const active = staffList.filter(s=>s.active!==false);
  const inactive = staffList.filter(s=>s.active===false);

  // ===== 詳細・資格証書 =====
  if(screen==="detail"&&selStaff){
    return <StaffDetail s={selStaff} store={store} isMgr={isMgr}
      onBack={()=>setScreen("list")}
      onEdit={()=>setScreen("edit")}
    />;
  }

  // ===== 登録 / 編集 =====
  if(screen==="register"||screen==="edit"){
    const isEdit = screen==="edit";
    const init = isEdit&&selStaff ? {...selStaff} : {
      id:"", name:"", facilityId:user.selectedFacilityId||"f1",
      role:"staff", dob:"", gender:"", tel:"", email:"",
      address:"", emergencyName:"", emergencyTel:"", emergencyRelation:"",
      qualification:"", qualifications:[], hireDate:todayISO(), employmentType:"正社員",
      bankName:"", bankBranch:"", bankAccountType:"普通", bankAccountNo:"", bankAccountName:"",
      note:"", active:true
    };
    return <RegisterStaff init={init} isEdit={isEdit} user={user} store={store}
      onBack={()=>setScreen("list")}
      onSave={s=>{
        if(isEdit){ store.updStaff2(s.id,s); }
        else { store.addStaff({...s,id:genId()}); }
        setScreen("list");
      }}
    />;
  }

  // ===== 一覧 =====
  const StaffCard = ({s}) => {
    const fac = FACILITIES.find(f=>f.id===s.facilityId);
    return <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:12,padding:14,boxShadow:"var(--sh)",transition:"all .15s",opacity:s.active===false?.6:1}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:9}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:42,height:42,borderRadius:"50%",background:s.role==="manager"?"linear-gradient(135deg,var(--tl),var(--tl))":"linear-gradient(135deg,var(--gr),var(--tl))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:"#fff",fontWeight:700,flexShrink:0}}>
            {s.name.charAt(0)}
          </div>
          <div>
            <div style={{fontWeight:900,fontSize:14}}>{s.name}{s.active===false&&<span style={{fontSize:10,color:"var(--bda)",marginLeft:5}}>（無効）</span>}</div>
            <div style={{fontSize:11,color:"var(--tx3)",marginTop:1}}>{fac?.name}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <span style={{fontSize:10,padding:"3px 9px",borderRadius:10,fontWeight:700,background:s.role==="manager"?"rgba(58,160,216,0.2)":s.role==="admin"?"rgba(144,72,216,0.18)":"rgba(44,170,96,0.2)",color:s.role==="manager"?"var(--tl)":s.role==="admin"?"var(--pu)":"var(--gr)"}}>
            {s.role==="manager"?"施設管理者":s.role==="admin"?"本部管理者":"一般職員"}
          </span>
          <button onClick={()=>{setSelStaff(s);setScreen("detail");}} style={{padding:"4px 9px",borderRadius:7,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"rgba(58,160,216,0.1)",border:"1.5px solid rgba(58,160,216,0.35)",color:"var(--tl)"}}>詳細</button>
          {isMgr&&<button onClick={()=>{setSelStaff(s);setScreen("edit");}} style={{padding:"4px 9px",borderRadius:7,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"var(--bg)",border:"1.5px solid var(--bd)",color:"var(--tx3)"}}>編集</button>}
        </div>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",fontSize:11,color:"var(--tx3)"}}>
        {s.employmentType&&<span style={{padding:"2px 7px",borderRadius:7,background:"var(--bg)",border:"1px solid var(--bd)"}}>{s.employmentType}</span>}
        {s.hireDate&&<span>入職: {s.hireDate}</span>}
        {(s.qualifications&&s.qualifications.length>0)
        ? s.qualifications.map(q=><span key={q} style={{padding:"2px 7px",borderRadius:7,background:"rgba(58,160,216,0.1)",border:"1px solid rgba(58,160,216,0.35)",color:"var(--tl)",marginRight:4,marginBottom:4,display:"inline-block"}}>{q}</span>)
        : s.qualification&&<span style={{padding:"2px 7px",borderRadius:7,background:"rgba(58,160,216,0.1)",border:"1px solid rgba(58,160,216,0.35)",color:"var(--tl)"}}>{s.qualification}</span>}
        {s.tel&&<span>📞 {s.tel}</span>}
      </div>
      <div style={{marginTop:7,padding:"6px 10px",background:"var(--bg)",borderRadius:7,display:"flex",gap:12,fontSize:11}}>
        {(()=>{const g=calcGrantedDays(s.hireDate,s.workDaysPerWeek||5);const u=calcUsedDays(s.id,store.paidLeaveReqs);const r=Math.max(0,g-u);return <>
          <span>付与: <strong style={{color:"var(--tl)"}}>{g}日</strong></span>
          <span>取得: <strong style={{color:"var(--am)"}}>{u}日</strong></span>
          <span>残: <strong style={{color:r<=3?"var(--ro)":r<=7?"var(--am)":"var(--gr)"}}>{r}日</strong></span>
        </>;})()} 
      </div>
    </div>;
  };

  return <div className="fl-wrap">
    <div className="fl-hd"><button className="bback" onClick={onBack}>← 戻る</button><div className="fl-title">👥 スタッフ管理</div></div>
    {isMgr&&<div style={{marginBottom:14}}><button className="bsave" style={{maxWidth:200}} onClick={()=>setScreen("register")}>＋ 新規スタッフ登録</button></div>}
    <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
      <div style={{background:"rgba(58,160,216,0.2)",borderRadius:9,padding:"9px 14px",fontSize:13,fontWeight:700,color:"var(--tl)"}}>在籍 {active.length}名</div>
      {inactive.length>0&&<div style={{background:"var(--bg)",borderRadius:9,padding:"9px 14px",fontSize:13,fontWeight:700,color:"var(--tx3)"}}>退職 {inactive.length}名</div>}
    </div>
    <div style={{fontSize:11,fontWeight:700,color:"var(--tl)",letterSpacing:2,marginBottom:8}}>在籍スタッフ</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:10,marginBottom:20}}>
      {active.map(s=><StaffCard key={s.id} s={s}/>)}
      {active.length===0&&<div style={{color:"var(--tx3)",fontSize:13,padding:"20px 0"}}>スタッフがいません</div>}
    </div>
    {inactive.length>0&&<><div style={{fontSize:11,fontWeight:700,color:"var(--tx3)",letterSpacing:2,marginBottom:8}}>退職・無効スタッフ</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:10,paddingBottom:28}}>
      {inactive.map(s=><StaffCard key={s.id} s={s}/>)}
    </div></>}
  </div>;
}

function RegisterStaff({init, isEdit, user, store, onBack, onSave}){
  const [form, setForm] = useState({...init});
  const upd = (k,v) => setForm(p=>({...p,[k]:v}));
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if(!form.name?.trim()) e.name = "氏名は必須です";
    if(!form.facilityId) e.facilityId = "施設は必須です";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // FormSection・FormFieldは外部定義を使用
  return <div className="fl-wrap">
    <div className="fl-hd">
      <button className="bback" onClick={onBack}>← 戻る</button>
      <div className="fl-title">{isEdit?"✏️ スタッフ情報 編集":"➕ スタッフ 新規登録"}</div>
    </div>

    <FormSection title="■ 基本情報" color="var(--tl)">
      <FormField form={form} upd={upd} errors={errors}  label="氏名（フルネーム）" fkey="name" placeholder="田中 美穂" required/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
        <FormField form={form} upd={upd} errors={errors}  label="生年月日" fkey="dob" type="date"/>
        <FormField form={form} upd={upd} errors={errors}  label="性別" fkey="gender" options={[{value:"",label:"選択"},{value:"男",label:"男"},{value:"女",label:"女"},{value:"その他",label:"その他"}]}/>
      </div>
      <FormField form={form} upd={upd} errors={errors}  label="所属施設" fkey="facilityId" required
        options={[{value:"",label:"選択してください"},...FACILITIES.map(f=>({value:f.id,label:f.name}))]}/>
      <FormField form={form} upd={upd} errors={errors}  label="役職・権限" fkey="role"
        options={[{value:"staff",label:"支援員"},{value:"specialist",label:"専門職員"},{value:"cdsm",label:"児童発達支援管理責任者"},{value:"manager",label:"管理者"},{value:"part_qual",label:"パート（指導員）"},{value:"part_noqual",label:"パート（資格なし）"},{value:"consultant",label:"相談支援員"}]}/>
      <FormField form={form} upd={upd} errors={errors}  label="雇用形態" fkey="employmentType"
        options={["正社員","パート・アルバイト","契約社員","派遣","業務委託"].map(v=>({value:v,label:v}))}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
        <FormField form={form} upd={upd} errors={errors}  label="入職日" fkey="hireDate" type="date"/>
      </div>
      <div style={{marginBottom:12}}>
        <label style={{display:"block",fontSize:10,fontWeight:700,color:"var(--tx2)",letterSpacing:1,marginBottom:6}}>資格・役職（複数選択可）</label>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {QUAL_CATEGORIES.map(c=>{
            const selected = (form.qualifications||[]).includes(c);
            return <button key={c} type="button" onClick={()=>{
              const cur = form.qualifications||[];
              upd("qualifications", selected ? cur.filter(x=>x!==c) : [...cur, c]);
            }} style={{padding:"6px 12px",borderRadius:9,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",borderColor:selected?"var(--tl)":"var(--bd)",background:selected?"rgba(58,160,216,0.2)":"var(--bg)",color:selected?"var(--tl)":"var(--tx2)"}}>
              {selected?"✓ ":""}{c}
            </button>;
          })}
        </div>
        {(form.qualifications||[]).length>0&&<div style={{marginTop:8,fontSize:11,color:"var(--tx3)"}}>選択中: {(form.qualifications||[]).join("・")}</div>}
      </div>
    </FormSection>

    <FormSection title="■ 連絡先情報" color="var(--ac)">
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
        <FormField form={form} upd={upd} errors={errors}  label="携帯電話" fkey="tel" placeholder="090-XXXX-XXXX" type="tel"/>
        <FormField form={form} upd={upd} errors={errors}  label="メールアドレス" fkey="email" placeholder="xxx@example.com" type="email"/>
      </div>
      <FormField form={form} upd={upd} errors={errors}  label="住所" fkey="address" placeholder="○○市△△1-2-3"/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0 12px"}}>
        <FormField form={form} upd={upd} errors={errors}  label="緊急連絡先 氏名" fkey="emergencyName" placeholder="田中 次郎"/>
        <FormField form={form} upd={upd} errors={errors}  label="続柄" fkey="emergencyRelation" placeholder="父"/>
        <FormField form={form} upd={upd} errors={errors}  label="緊急連絡先 電話" fkey="emergencyTel" placeholder="090-XXXX-XXXX" type="tel"/>
      </div>
    </FormSection>

    <FormSection title="■ 給与振込口座" color="var(--gr)">
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
        <FormField form={form} upd={upd} errors={errors}  label="銀行名" fkey="bankName" placeholder="○○銀行"/>
        <FormField form={form} upd={upd} errors={errors}  label="支店名" fkey="bankBranch" placeholder="○○支店"/>
        <FormField form={form} upd={upd} errors={errors}  label="口座種別" fkey="bankAccountType"
          options={["普通","当座"].map(v=>({value:v,label:v}))}/>
        <FormField form={form} upd={upd} errors={errors}  label="口座番号" fkey="bankAccountNo" placeholder="1234567"/>
      </div>
      <FormField form={form} upd={upd} errors={errors}  label="口座名義（カタカナ）" fkey="bankAccountName" placeholder="タナカ ミホ"/>
    </FormSection>

    <FormSection title="■ 備考" color="var(--tx3)">
      <textarea className="fta" style={{minHeight:72}} placeholder="特記事項・備考など" value={form.note||""} onChange={e=>upd("note",e.target.value)}/>
    </FormSection>

    {isEdit&&<div style={{background:"rgba(224,56,56,0.08)",border:"1px solid rgba(224,56,56,0.4)",borderRadius:11,padding:14,marginBottom:12}}>
      <div style={{fontSize:11,fontWeight:700,color:"var(--ro)",marginBottom:8}}>⚠ 在籍状況の変更</div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>upd("active",true)} style={{padding:"8px 18px",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",borderColor:form.active!==false?"rgba(44,170,96,0.4)":"var(--bd)",background:form.active!==false?"rgba(44,170,96,0.2)":"var(--bg)",color:form.active!==false?"var(--gr)":"var(--tx3)"}}>在籍中</button>
        <button onClick={()=>upd("active",false)} style={{padding:"8px 18px",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",borderColor:form.active===false?"rgba(224,56,56,0.4)":"var(--bd)",background:form.active===false?"rgba(224,56,56,0.15)":"var(--bg)",color:form.active===false?"var(--ro)":"var(--tx3)"}}>退職・無効</button>
      </div>
    </div>}

    <div style={{display:"flex",gap:10,paddingBottom:32}}>
      <button className="bsave" style={{background:"var(--bg)",color:"var(--tx2)",border:"1.5px solid var(--bd)"}} onClick={onBack}>キャンセル</button>
      <button className="bsave" style={{flex:2}} onClick={()=>{if(validate()) onSave(form);}}>{isEdit?"変更を保存する":"登録する"}</button>
    </div>
  </div>;
}

// ==================== HOME ====================
function HomeScreen({user,onNav,store}){
  const fac=FACILITIES.find(f=>f.id===user.selectedFacilityId);
  const isMgr=user.role==="manager"||user.role==="admin";
  const today=todayISO();

  // ===== 今日のデータ集計 =====
  const myFac = r => user.role==="admin" || (r.facilityId||r.facility_id)===user.selectedFacilityId;
  const todayRecs = store.recs.filter(r=>isTodayRec(r)&&myFac(r));

  const staffInToday = [...new Set(todayRecs.filter(r=>r.type==="staff_in").map(r=>r.staffId))].length;
  const arrivedIds   = [...new Set(todayRecs.filter(r=>r.type==="user_in").map(r=>r.userId))];
  const departedIds  = [...new Set(todayRecs.filter(r=>r.type==="user_out").map(r=>r.userId))];
  const serviceIds   = [...new Set(todayRecs.filter(r=>r.type==="service").map(r=>r.userId))];

  // 現在在所中（来所済み & 退所していない）
  const inFacility = arrivedIds.filter(id=>!departedIds.includes(id));
  // サービス記録未入力（来所済みだが未入力）
  const unrecordedIds = inFacility.filter(id=>!serviceIds.includes(id));
  // 今日の来所予定者（attデータから）
  const myUsers = store.dynUsers.filter(u=>u.active!==false&&(user.role==="admin"||u.facilityId===user.selectedFacilityId));
  const scheduledToday = myUsers.filter(u=>{
    const att=store.getAtt(u.id,today);
    return att==="予定"||att==="出席";
  });
  // 送迎予定（送迎フラグ付きの来所予定者）
  const transportUsers = scheduledToday.filter(u=>{
    const tr=store.trData.find(t=>t.userId===u.id);
    return tr&&(tr.method==="car"||tr.method==="bus");
  });

  // ===== アラート生成 =====
  const alerts = buildTodayAlerts(user,store);
  // 送迎予定アラートを先頭に追加（来所前）
  if(transportUsers.length>0){
    alerts.unshift({level:"info",icon:"🚗",text:`送迎予定 ${transportUsers.length}名（来所前）`,screen:"transport"});
  }

  // ===== 今日の残件（名前付き・優先度カラー） =====
  const getId2Name=id=>myUsers.find(u=>u.id===id)?.name||id;
  const todoItems=[];
  // danger: 体温 37.5以上の利用者（要注意）
  const highTempIds=[...new Set(todayRecs.filter(r=>r.type==="user_in"&&parseFloat(r.temp)>=37.5).map(r=>r.userId))];
  if(highTempIds.length>0){
    todoItems.push({level:"danger",icon:"🌡️",title:"高体温 要確認",names:highTempIds.map(getId2Name).filter(Boolean),screen:"user_arrive"});
  }
  // warn: サービス記録未入力
  if(unrecordedIds.length>0){
    todoItems.push({level:"warn",icon:"📋",title:"サービス記録 未入力",names:unrecordedIds.map(getId2Name).filter(Boolean),screen:"service"});
  }
  // warn: 体温未入力（来所済み）
  const noTempUserIds=[...new Set(todayRecs.filter(r=>r.type==="user_in"&&(!r.temp||r.temp==="")).map(r=>r.userId))];
  if(noTempUserIds.length>0){
    todoItems.push({level:"warn",icon:"🌡️",title:"体温 未入力",names:noTempUserIds.map(getId2Name).filter(Boolean),screen:"user_arrive"});
  }
  // warn: 写真記録なし（在所中）
  const photoIds=[...new Set(todayRecs.filter(r=>r.type==="photo").map(r=>r.userId))];
  const noPhotoIds=inFacility.filter(id=>!photoIds.includes(id));
  if(noPhotoIds.length>0){
    todoItems.push({level:"warn",icon:"📸",title:"写真記録 未撮影",names:noPhotoIds.map(getId2Name).filter(Boolean),screen:"photo"});
  }
  // info: 送迎未完了（来所済み・退所記録なし・送迎あり）
  const transportDoneIds=[...new Set(todayRecs.filter(r=>r.type==="user_out").map(r=>r.userId))];
  const transportWaitIds=inFacility.filter(id=>{
    const rec=todayRecs.filter(r=>r.type==="user_in"&&r.userId===id).slice(-1)[0];
    return rec?.transport==="あり";
  }).filter(id=>!transportDoneIds.includes(id));
  if(transportWaitIds.length>0){
    todoItems.push({level:"info",icon:"🚌",title:"送迎 未完了",names:transportWaitIds.map(getId2Name).filter(Boolean),screen:"transport"});
  }
  // info: 未読連絡
  const unreadCount2=store.msgs.filter(m=>(user.role==="admin"||m.facilityId===user.selectedFacilityId)&&!m.read).length;
  if(unreadCount2>0){
    todoItems.push({level:"info",icon:"💬",title:`保護者連絡 未読`,names:[`${unreadCount2}件の未読メッセージ`],screen:"messages"});
  }
  // info: ISP期限間近（30日以内）
  const now2=new Date();
  const ispSoonNames=(store.isps||[]).filter(isp=>{
    if(!isp.endDate) return false;
    const d=Math.ceil((new Date(isp.endDate)-now2)/(1000*60*60*24));
    return d>=0&&d<=30;
  }).map(isp=>isp.userName||(myUsers.find(u=>u.id===isp.userId)?.name)||"不明");
  if(ispSoonNames.length>0){
    todoItems.push({level:"info",icon:"📄",title:"ISP 期限間近（30日以内）",names:ispSoonNames,screen:"users"});
  }

  // ===== クイックアクション =====
  const quickCards=[
    {id:"clock_in",  icon:"🟢",title:"職員 出勤",  desc:"打刻・体温",  cls:"c1"},
    {id:"clock_out", icon:"🟡",title:"職員 退勤",  desc:"退勤打刻",    cls:"c2"},
    {id:"user_arrive",icon:"🌟",title:"利用者 来所",desc:"来所・体温",  cls:"c3"},
    {id:"user_depart",icon:"🏠",title:"利用者 退所",desc:"退所記録",    cls:"c4"},
    {id:"service",   icon:"📋",title:"サービス記録",desc:"支援内容",    cls:"c3"},
    {id:"messages",  icon:"💬",title:"保護者連絡", desc:"連絡帳",      cls:"c9"},
    {id:"daily",     icon:"📓",title:"業務日報",   desc:"日報作成",    cls:"c8"},
    {id:"photo",     icon:"📸",title:"写真記録",   desc:"活動・撮影",  cls:"c5"},
  ];

  const getName=id=>(store.dynUsers.find(u=>u.id===id)?.name)||id;

  return <div>
    {/* ===== ヘッダー ===== */}
    <div className="hh">
      <div className="ht">{fac?.name||"全店舗"}</div>
      <div className="hs">今日の現場</div>
      <div className="hd">{todayDisplay()}</div>
    </div>

    {/* ===== アラートセクション ===== */}
    {alerts.length>0&&<div className="dash-section">
      <div className="dash-title">⚠ 要確認</div>
      {alerts.map((a,i)=>(
        <div key={i} className={`alert-row alert-${a.level}`} onClick={()=>onNav(a.screen)}>
          <span className="alert-icon">{a.icon}</span>
          <span className="alert-text lv-${a.level}" style={{color:a.level==="danger"?"var(--ro)":a.level==="warn"?"var(--ac)":a.level==="success"?"var(--gr)":"var(--tl)"}}>{a.text}</span>
          <span className="alert-arrow" style={{color:a.level==="danger"?"var(--ro)":a.level==="warn"?"var(--ac)":"var(--tl)"}}>›</span>
        </div>
      ))}
    </div>}

    {/* ===== 今日の残件（優先度カラー付き） ===== */}
    {todoItems.length>0&&<div className="dash-section">
      <div className="dash-title">📌 今日の残件</div>
      {todoItems.map((item,i)=>(
        <div key={i} className={`todo-card ${item.level||"warn"}`} onClick={()=>onNav(item.screen)} style={{cursor:"pointer"}}>
          <div className="todo-card-hd">
            <span className="todo-card-icon">{item.icon}</span>
            <span className="todo-card-title" style={{color:item.level==="danger"?"var(--ro)":item.level==="info"?"var(--tl)":"var(--ac)"}}>{item.title}</span>
            <span className={`todo-card-count ${item.level||"warn"}`}>{item.names.length}</span>
          </div>
          <div className="todo-names">
            {item.names.map(n=><span key={n} className={`todo-name-chip ${item.level||"warn"}`}>{n}</span>)}
          </div>
        </div>
      ))}
    </div>}

    {/* ===== 今日のサマリー ===== */}
    <div className="stat-grid">
      {[
        {label:"出勤職員",     val:staffInToday,        color:"var(--tl)", icon:"👤"},
        {label:"在所中",       val:inFacility.length,   color:"var(--gr)", icon:"🌟"},
        {label:"来所予定",     val:scheduledToday.length,color:"var(--tx2)",icon:"📅"},
      ].map(s=><div key={s.label} className="stat-card">
        <div className="stat-label">{s.icon} {s.label}</div>
        <div className="stat-val" style={{color:s.color}}>{s.val}</div>
      </div>)}
    </div>

    {/* ===== 在所中ユーザー（サービス記録状況つき）===== */}
    {inFacility.length>0&&<div className="dash-section">
      <div className="dash-title">🌟 在所中 ({inFacility.length}名)</div>
      <div style={{display:"flex",flexWrap:"wrap"}}>
        {inFacility.map(id=>{
          const recorded=serviceIds.includes(id);
          return <span key={id}
            className={`user-tag ${recorded?"user-tag-in":"user-tag-unrecorded"}`}
            onClick={()=>!recorded&&onNav("service")}
            title={recorded?"記録済":"タップでサービス記録へ"}>
            {getName(id)}{recorded?" ✓":" 未記録"}
          </span>;
        })}
      </div>
    </div>}

    {/* ===== 来所待ち（予定だが未到着）===== */}
    {(()=>{
      const waiting=scheduledToday.filter(u=>!arrivedIds.includes(u.id)&&!departedIds.includes(u.id));
      if(waiting.length===0) return null;
      return <div className="dash-section">
        <div className="dash-title">📅 来所待ち ({waiting.length}名)</div>
        <div style={{display:"flex",flexWrap:"wrap"}}>
          {waiting.map(u=><span key={u.id} className="user-tag user-tag-pending">
            {u.name}
          </span>)}
        </div>
      </div>;
    })()}

    <hr className="dash-divider"/>

    {/* ===== クイックアクション ===== */}
    <div className="dash-title">Quick Actions</div>
    <div className="hg">
      {quickCards.map(c=>(
        <div key={c.id} className={`hc ${c.cls}`} onClick={()=>onNav(c.id)}>
          <div className="ci">{c.icon}</div>
          <div className="ct">{c.title}</div>
          <div className="cd2">{c.desc}</div>
        </div>
      ))}
    </div>
  </div>;
}

// ==================== 監査モード ====================
function AuditScreen({user,onBack,store}){
  const today=todayISO();
  const [dateFrom,setDateFrom]=useState(today);
  const [dateTo,setDateTo]=useState(today);
  const [expandUser,setExpandUser]=useState(null); // 詳細展開

  const myFac=r=>(user.role==="admin")||(r.facilityId||r.facility_id)===user.selectedFacilityId;
  const myUsers=store.dynUsers.filter(u=>u.active!==false&&(user.role==="admin"||u.facilityId===user.selectedFacilityId));
  const fac=FACILITIES.find(f=>f.id===user.selectedFacilityId);

  // 期間フィルタ
  const inRange=r=>{const d=r.time?.slice(0,10)||"";return d>=dateFrom&&d<=dateTo;};
  const rangeRecs=store.recs.filter(r=>myFac(r)&&inRange(r));

  // 利用者ごとの集計
  const arrivedUserIds=[...new Set(rangeRecs.filter(r=>r.type==="user_in").map(r=>r.userId))];
  const serviceUserIds=[...new Set(rangeRecs.filter(r=>r.type==="service").map(r=>r.userId))];
  const photoUserIds  =[...new Set(rangeRecs.filter(r=>r.type==="photo").map(r=>r.userId))];
  const tempOkIds     =[...new Set(rangeRecs.filter(r=>r.type==="user_in"&&r.temp&&r.temp!=="").map(r=>r.userId))];
  const highTempIds   =[...new Set(rangeRecs.filter(r=>r.type==="user_in"&&parseFloat(r.temp)>=37.5).map(r=>r.userId))];

  const total=arrivedUserIds.length;
  const fullOk=arrivedUserIds.filter(id=>serviceUserIds.includes(id)&&tempOkIds.includes(id)).length;

  // 利用者ごとの体温履歴
  const getTempHistory=uid=>rangeRecs.filter(r=>r.type==="user_in"&&r.userId===uid&&r.temp).map(r=>({date:r.time?.slice(0,16)||"",temp:r.temp,by:r.createdBy||""}));
  // 変更履歴（record.history配列）
  const getChangeHistory=uid=>rangeRecs.filter(r=>r.userId===uid&&(r.history||[]).length>0).flatMap(r=>(r.history||[]).map(h=>({...h,recordType:r.type,recordTime:r.time?.slice(0,16)||""})));

  // ===== 強化版監査PDF =====
  const printAudit=()=>{
    const facName=fac?.name||"全施設";
    const rows=myUsers.filter(u=>arrivedUserIds.includes(u.id));
    const now=new Date().toLocaleString("ja-JP");

    const userDetailHtml=rows.map(u=>{
      const tempHist=getTempHistory(u.id);
      const svcRecs=rangeRecs.filter(r=>r.type==="service"&&r.userId===u.id);
      const inRecs=rangeRecs.filter(r=>r.type==="user_in"&&r.userId===u.id);
      const changeHist=getChangeHistory(u.id);
      const hasTemp=tempOkIds.includes(u.id);
      const hasSvc=serviceUserIds.includes(u.id);
      const hasHigh=highTempIds.includes(u.id);
      return `
      <div class="user-block" style="page-break-inside:avoid;margin-bottom:18px;border:1px solid #bbb;border-radius:6px;overflow:hidden;">
        <div class="user-hd" style="background:${hasSvc&&hasTemp?"#e8f5ec":"#fdf0ee"};padding:8px 12px;border-bottom:1px solid #bbb;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:14px;font-weight:700;">${u.name}</span>
          <span style="font-size:11px;color:${hasSvc&&hasTemp?"#155a30":"#c0392b"};font-weight:700;">${hasSvc&&hasTemp?"✅ 記録完備":"⚠ 要確認"}</span>
        </div>
        <div style="padding:8px 12px;">
          <!-- チェックリスト -->
          <table style="border-collapse:collapse;width:100%;font-size:11px;margin-bottom:8px;">
            <tr>
              <td style="border:1px solid #ddd;padding:4px 8px;">来所</td><td style="border:1px solid #ddd;padding:4px 8px;color:#1a7a3a;font-weight:700;">✓ ${inRecs.length}回</td>
              <td style="border:1px solid #ddd;padding:4px 8px;">体温</td><td style="border:1px solid #ddd;padding:4px 8px;color:${hasTemp?"#1a7a3a":"#c0392b"};font-weight:700;">${hasTemp?"✓ 記録あり":"✗ 未入力"}${hasHigh?" 🔴発熱あり":""}</td>
              <td style="border:1px solid #ddd;padding:4px 8px;">サービス記録</td><td style="border:1px solid #ddd;padding:4px 8px;color:${hasSvc?"#1a7a3a":"#c0392b"};font-weight:700;">${hasSvc?"✓ 入力済":"✗ 未入力"}</td>
              <td style="border:1px solid #ddd;padding:4px 8px;">写真</td><td style="border:1px solid #ddd;padding:4px 8px;color:${photoUserIds.includes(u.id)?"#1a7a3a":"#999"};">${photoUserIds.includes(u.id)?"✓ あり":"— なし"}</td>
            </tr>
          </table>
          <!-- 体温履歴 -->
          ${tempHist.length>0?`<div style="margin-bottom:6px;"><div style="font-size:10px;font-weight:700;color:#555;margin-bottom:3px;">🌡 体温履歴</div><div style="display:flex;flex-wrap:wrap;gap:5px;">${tempHist.map(t=>`<span style="background:${parseFloat(t.temp)>=37.5?"#fdf0ee":"#f0f8f0"};border:1px solid ${parseFloat(t.temp)>=37.5?"#e09090":"#90c090"};border-radius:4px;padding:2px 7px;font-size:10px;font-family:monospace;">${t.date.slice(5)} ${t.temp}℃</span>`).join("")}</div></div>`:""}
          <!-- サービス記録概要 -->
          ${svcRecs.length>0?`<div style="margin-bottom:6px;"><div style="font-size:10px;font-weight:700;color:#555;margin-bottom:3px;">📋 サービス提供記録</div>${svcRecs.map(s=>`<div style="font-size:10px;padding:3px 0;border-bottom:1px dotted #ddd;">${s.time?.slice(0,16)||""} 在所:${s.arrival||"-"}〜${s.departure||"-"} ${(s.items||[]).slice(0,3).join("・")}</div>`).join("")}</div>`:""}
          <!-- 変更履歴 -->
          ${changeHist.length>0?`<div><div style="font-size:10px;font-weight:700;color:#555;margin-bottom:3px;">📝 変更履歴</div>${changeHist.slice(0,5).map(h=>`<div style="font-size:9px;color:#666;padding:2px 0;">${h.at||""} ${h.by||""}: ${h.desc||h.action||""}</div>`).join("")}</div>`:""}
        </div>
      </div>`;
    }).join("");

    const html=`<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"/>
    <title>監査提出書類 — ${facName}</title>
    <style>
      @page{size:A4 portrait;margin:15mm 12mm;}
      *{box-sizing:border-box;margin:0;padding:0;}
      body{font-family:'MS Gothic','Hiragino Kaku Gothic Pro',Meiryo,sans-serif;font-size:10pt;color:#111;background:#fff;}
      .cover{text-align:center;padding:30px 20px 20px;border-bottom:3px solid #1a3a6a;margin-bottom:20px;}
      .cover h1{font-size:20pt;font-weight:900;color:#1a3a6a;}
      .cover .sub{font-size:11pt;color:#555;margin-top:8px;}
      .summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px;}
      .summary-box{border:1px solid #ccc;border-radius:6px;padding:10px;text-align:center;}
      .summary-box .val{font-size:22pt;font-weight:900;font-family:monospace;}
      .summary-box .lbl{font-size:9pt;color:#666;}
      .sign-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin:24px 0 16px;}
      .sign-box{border:1px solid #aaa;border-radius:6px;padding:10px 12px;min-height:64px;}
      .sign-box .sign-lbl{font-size:9pt;color:#555;margin-bottom:8px;}
      .sign-box .sign-line{border-bottom:1px solid #888;margin-top:32px;}
    </style></head><body>
    <div class="cover">
      <h1>📋 監査提出書類</h1>
      <div class="sub">${facName}　　期間：${dateFrom} 〜 ${dateTo}</div>
      <div class="sub" style="font-size:9pt;color:#888;margin-top:4px;">出力日時：${now}</div>
    </div>
    <!-- サマリー -->
    <div class="summary-grid">
      <div class="summary-box"><div class="val" style="color:#005a9a">${total}</div><div class="lbl">来所者数</div></div>
      <div class="summary-box"><div class="val" style="color:#1a7a3a">${fullOk}</div><div class="lbl">記録完備</div></div>
      <div class="summary-box"><div class="val" style="color:${total-fullOk>0?"#c0392b":"#999"}">${total-fullOk}</div><div class="lbl">未完備</div></div>
      <div class="summary-box"><div class="val" style="color:${highTempIds.length>0?"#c0392b":"#999"}">${highTempIds.length}</div><div class="lbl">高体温者数</div></div>
    </div>
    <!-- 利用者別詳細 -->
    ${userDetailHtml}
    <!-- サイン欄 -->
    <div class="sign-row">
      <div class="sign-box"><div class="sign-lbl">管理者 確認サイン</div><div class="sign-line"></div></div>
      <div class="sign-box"><div class="sign-lbl">担当職員 サイン</div><div class="sign-line"></div></div>
      <div class="sign-box"><div class="sign-lbl">確認日時</div><div style="font-size:11pt;font-weight:700;margin-top:12px;">${new Date().toLocaleDateString("ja-JP")}</div></div>
    </div>
    </body></html>`;
    const w=window.open("","_blank","width=900,height=750");
    if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),400);}
  };

  return <div className="fl-wrap">
    <div className="fl-hd">
      <button className="bback" onClick={onBack}>← 戻る</button>
      <div className="fl-title">🔍 監査モード</div>
      <button className="bexp" style={{marginLeft:"auto",background:"#fff8f0",borderColor:"var(--ac)",color:"var(--ac)"}} onClick={printAudit}>🖨️ 監査PDF</button>
    </div>

    {/* 期間選択 */}
    <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",marginBottom:16,background:"var(--wh)",padding:14,borderRadius:12,border:"1px solid var(--bd)"}}>
      <span style={{fontSize:12,fontWeight:700,color:"var(--tx3)"}}>期間：</span>
      <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
        style={{padding:"8px 10px",borderRadius:8,border:"1.5px solid var(--bd)",background:"var(--bg)",color:"var(--tx)",fontSize:16,fontFamily:"'DM Mono',monospace",outline:"none"}}/>
      <span style={{color:"var(--tx3)"}}>〜</span>
      <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
        style={{padding:"8px 10px",borderRadius:8,border:"1.5px solid var(--bd)",background:"var(--bg)",color:"var(--tx)",fontSize:16,fontFamily:"'DM Mono',monospace",outline:"none"}}/>
      {/* クイック選択 */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {[["今日",0,0],["今週",-(new Date().getDay()||7)+1,0],["今月",-(new Date().getDate()-1),0]].map(([label,from,to])=>(
          <button key={label} onClick={()=>{
            const d=new Date();
            const f=new Date(d);f.setDate(d.getDate()+from);
            const t=new Date(d);t.setDate(d.getDate()+to);
            setDateFrom(f.toISOString().slice(0,10));
            setDateTo(t.toISOString().slice(0,10));
          }} style={{padding:"6px 12px",borderRadius:8,border:"1px solid var(--bd)",background:"var(--bg)",color:"var(--tx3)",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>
            {label}
          </button>
        ))}
      </div>
    </div>

    {/* サマリーカード */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:9,marginBottom:18}}>
      {[
        {label:"来所者数",    val:total,           color:"var(--tl)"},
        {label:"記録完備",   val:fullOk,          color:"var(--gr)"},
        {label:"未完備",     val:total-fullOk,    color:total-fullOk>0?"var(--ro)":"var(--tx3)"},
        {label:"高体温者",   val:highTempIds.length,color:highTempIds.length>0?"var(--ro)":"var(--tx3)"},
      ].map(s=><div key={s.label} className="stat-card">
        <div className="stat-label">{s.label}</div>
        <div className="stat-val" style={{color:s.color,fontSize:22}}>{s.val}</div>
      </div>)}
    </div>

    {/* 利用者ごとのチェックリスト */}
    {arrivedUserIds.length===0
      ? <div style={{textAlign:"center",color:"var(--tx3)",padding:"32px 0",fontSize:13,background:"var(--wh)",borderRadius:12,border:"1px solid var(--bd)"}}>
          指定期間内に来所記録がありません
        </div>
      : myUsers.filter(u=>arrivedUserIds.includes(u.id)).map(u=>{
          const hasTemp=tempOkIds.includes(u.id);
          const hasService=serviceUserIds.includes(u.id);
          const hasPhoto=photoUserIds.includes(u.id);
          const hasHigh=highTempIds.includes(u.id);
          const allOk=hasTemp&&hasService;
          const expanded=expandUser===u.id;
          const tempHist=getTempHistory(u.id);
          const changeHist=getChangeHistory(u.id);
          return <div key={u.id} className="audit-user-row"
            style={{borderColor:hasHigh?"rgba(224,56,56,0.6)":allOk?"rgba(44,170,96,0.4)":"rgba(224,56,56,0.3)",cursor:"pointer"}}
            onClick={()=>setExpandUser(expanded?null:u.id)}>
            <div className="audit-user-name" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span>{allOk&&!hasHigh?"✅":"⚠️"} {u.name}{hasHigh&&<span style={{fontSize:10,fontWeight:700,color:"var(--ro)",marginLeft:6}}>🌡 高体温</span>}</span>
              <span style={{fontSize:11,color:"var(--tx3)"}}>{expanded?"▲ 閉じる":"▼ 詳細"}</span>
            </div>
            <div className="audit-checks">
              <span className="audit-check audit-ok">来所 ✓</span>
              <span className={`audit-check ${hasTemp?"audit-ok":"audit-ng"}`}>体温 {hasTemp?"✓":"✗"}</span>
              <span className={`audit-check ${hasService?"audit-ok":"audit-ng"}`}>サービス記録 {hasService?"✓":"✗"}</span>
              <span className={`audit-check ${hasPhoto?"audit-ok":"audit-na"}`}>写真 {hasPhoto?"✓":"—"}</span>
            </div>
            {/* 展開：体温履歴・変更履歴 */}
            {expanded&&<div style={{marginTop:10,paddingTop:10,borderTop:"1px solid var(--bd)"}}>
              {tempHist.length>0&&<div style={{marginBottom:8}}>
                <div style={{fontSize:10,fontWeight:700,color:"var(--tx3)",marginBottom:5}}>🌡 体温履歴</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                  {tempHist.map((t,i)=><span key={i} style={{fontSize:11,padding:"3px 9px",borderRadius:7,border:"1px solid",fontFamily:"'DM Mono',monospace",fontWeight:700,
                    borderColor:parseFloat(t.temp)>=37.5?"rgba(224,56,56,0.5)":"rgba(44,170,96,0.4)",
                    background:parseFloat(t.temp)>=37.5?"rgba(224,56,56,0.1)":"rgba(44,170,96,0.1)",
                    color:parseFloat(t.temp)>=37.5?"var(--ro)":"var(--gr)"}}>
                    {t.date.slice(5,16)} {t.temp}℃
                  </span>)}
                </div>
              </div>}
              {changeHist.length>0&&<div>
                <div style={{fontSize:10,fontWeight:700,color:"var(--tx3)",marginBottom:5}}>📝 変更履歴</div>
                {changeHist.slice(0,8).map((h,i)=><div key={i} style={{fontSize:11,color:"var(--tx3)",padding:"3px 0",borderBottom:"1px dotted var(--bd)"}}>
                  {h.at||h.recordTime||""} {h.by&&<span style={{color:"var(--tl)"}}>{h.by}</span>} {h.desc||h.action||""}
                </div>)}
              </div>}
              {tempHist.length===0&&changeHist.length===0&&<div style={{fontSize:11,color:"var(--tx3)"}}>詳細履歴なし</div>}
            </div>}
          </div>;
        })
    }
  </div>;
}

// ==================== APP ROOT ====================

// ==================== 生徒予定表 ====================
const SCHEDULE_STATUS = {
  "来所予定": { label:"来所予定", color:"var(--tl)", bg:"rgba(58,160,216,0.2)", short:"予" },
  "来所":     { label:"来所（入室）", color:"var(--gr)", bg:"rgba(44,170,96,0.2)", short:"来" },
  "欠席":     { label:"欠席", color:"var(--ro)", bg:"rgba(224,56,56,0.15)", short:"欠" },
  "体調不良": { label:"体調不良", color:"#8a6200", bg:"#fef8e6", short:"体" },
  "キャンセル":{ label:"キャンセル", color:"#555", bg:"#e8e8e8", short:"キャ" },
  "休所":     { label:"休所", color:"#7030b8", bg:"rgba(144,72,216,0.18)", short:"休" },
};

function ScheduleScreen({ user, store, onBack }) {
  const today = new Date();
  const [vm, setVm] = useState({ y: today.getFullYear(), m: today.getMonth() + 1 });
  const [selFac, setSelFac] = useState(user.selectedFacilityId || "all");
  const [viewMode, setViewMode] = useState("calendar");
  const [editCell, setEditCell] = useState(null);
  const [selDate, setSelDate] = useState(todayISO());
  const [showAddModal, setShowAddModal] = useState(false); // 生徒追加モーダル
  const [addChecked, setAddChecked] = useState([]); // 追加選択中の生徒ID

  const isAdmin = user.role === "admin";
  const isMgr = user.role === "manager" || user.role === "admin";
  const days = daysInMonth(vm.y, vm.m);
  const dayList = Array.from({ length: days }, (_, i) => i + 1);
  const dowLabel = ["日","月","火","水","木","金","土"];

  const facOptions = isAdmin
    ? [{ id: "all", name: "全店舗" }, ...FACILITIES]
    : FACILITIES.filter(f => f.id === user.selectedFacilityId);

  const users = store.dynUsers.filter(u => {
    if (u.active === false) return false;
    if (selFac === "all") return true;
    return u.facilityId === selFac;
  });

  const getKey = (uid, day) =>
    uid + "_" + vm.y + "_" + String(vm.m).padStart(2,"0") + "_" + String(day).padStart(2,"0");

  const getDateStr = (day) =>
    vm.y + "-" + String(vm.m).padStart(2,"0") + "-" + String(day).padStart(2,"0");

  const getRow = (uid, day) => {
    const key = getKey(uid, day);
    if (store.scheduleData && store.scheduleData[key]) return store.scheduleData[key];
    const attStatus = store.getAtt(uid, getDateStr(day));
    if (attStatus === "出席") return { status: "来所", transport_to: false, transport_from: false };
    if (attStatus === "欠席") return { status: "欠席", transport_to: false, transport_from: false };
    if (attStatus === "予定") return { status: "来所予定", transport_to: false, transport_from: false };
    return null;
  };

  const getStatus = (uid, day) => getRow(uid, day)?.status || "";
  const getTransportTo = (uid, day) => getRow(uid, day)?.transport_to || false;
  const getTransportFrom = (uid, day) => getRow(uid, day)?.transport_from || false;

  const setSchedule = (uid, day, status, transportTo, transportFrom) => {
    const key = getKey(uid, day);
    const u = store.dynUsers.find(x => x.id === uid);
    const row = {
      id: key, user_id: uid, user_name: u?.name || "",
      facility_id: u?.facilityId || "", date: getDateStr(day),
      status: status, transport_to: transportTo, transport_from: transportFrom,
      updated_at: nowStr(),
    };
    if (store.setScheduleData) store.setScheduleData(p => ({ ...p, [key]: row }));
    if (store.saveScheduleRow) store.saveScheduleRow(row);
    if (status === "来所" || status === "来所予定") {
      store.setAtt(uid, getDateStr(day), status === "来所" ? "出席" : "予定");
    } else if (status === "欠席") {
      store.setAtt(uid, getDateStr(day), "欠席");
    }
    setEditCell(null);
  };

  const getDow = (day) => new Date(vm.y, vm.m - 1, day).getDay();
  const isWe = (day) => getDow(day) === 0 || getDow(day) === 6;

  const countByDay = (day) => ({
    come: users.filter(u => { const st=getStatus(u.id,day); return st==="来所"||st==="来所予定"; }).length,
    absent: users.filter(u => getStatus(u.id,day)==="欠席").length,
  });

  const countByUser = (uid) => ({
    come: dayList.filter(d => getStatus(uid,d)==="来所"||getStatus(uid,d)==="来所予定").length,
    actual: dayList.filter(d => getStatus(uid,d)==="来所").length,
    absent: dayList.filter(d => getStatus(uid,d)==="欠席").length,
  });

  const selDay = parseInt(selDate.split("-")[2]);
  const selDayUsers = users.map(u => ({
    ...u,
    status: getStatus(u.id, selDay),
    transportTo: getTransportTo(u.id, selDay),
    transportFrom: getTransportFrom(u.id, selDay),
  }));

  const printSchedule = () => {
    const facName = selFac === "all" ? "全店舗" : FACILITIES.find(f => f.id === selFac)?.name || "";
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>body{font-family:'Noto Sans JP',sans-serif;font-size:8pt;margin:10mm;}h2{font-size:13pt;}table{border-collapse:collapse;width:100%;}th,td{border:1px solid #ccc;padding:3px 4px;text-align:center;white-space:nowrap;font-size:7.5pt;}th{background:#e8f0ff;font-weight:700;}.we{background:#f5f5f5;color:#bbb;}.come{background:rgba(44,170,96,0.2);color:var(--gr);font-weight:700;}.plan{background:rgba(58,160,216,0.2);color:var(--tl);}.absent{background:rgba(224,56,56,0.15);color:var(--ro);}.name{text-align:left;font-weight:700;}</style></head><body><h2>生徒予定表 ${facName} ${vm.y}年${vm.m}月</h2><table><thead><tr><th class="name">利用者名</th>${dayList.map(d=>`<th class="${isWe(d)?"we":""}">${d}<br/>${dowLabel[getDow(d)]}</th>`).join("")}<th>予定</th><th>来所</th><th>欠席</th></tr></thead><tbody>${users.map(u=>{const cnt=countByUser(u.id);return `<tr><td class="name">${u.name}</td>${dayList.map(d=>{if(isWe(d))return`<td class="we"></td>`;const st=getStatus(u.id,d);const cls=st==="来所"?"come":st==="来所予定"?"plan":st==="欠席"?"absent":"";const short={"来所":"来","来所予定":"予","欠席":"欠","体調不良":"体","キャンセル":"キャ","休所":"休"}[st]||"";return`<td class="${cls}">${short}</td>`;}).join("")}<td style="background:#eef8f2;font-weight:700">${cnt.come}</td><td style="background:#eef8f2;color:var(--gr);font-weight:700">${cnt.actual}</td><td style="background:rgba(224,56,56,0.08);color:var(--ro);font-weight:700">${cnt.absent}</td></tr>`;}).join("")}</tbody></table><div style="margin-top:8px;font-size:7pt;color:#888">出力: ${new Date().toLocaleString("ja-JP")}</div></body></html>`;
    const win = window.open("","_blank"); win.document.write(html); win.document.close(); setTimeout(()=>win.print(),400);
  };

  const fw = new Date(vm.y, vm.m - 1, 1).getDay();

  const CalendarView = () => (
    <div>
      <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:12,padding:14,marginBottom:14,boxShadow:"var(--sh)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <button className="cn" onClick={()=>setVm(v=>v.m===1?{y:v.y-1,m:12}:{y:v.y,m:v.m-1})}>‹</button>
          <div style={{fontSize:16,fontWeight:900}}>{vm.y}年 {vm.m}月</div>
          <button className="cn" onClick={()=>setVm(v=>v.m===12?{y:v.y+1,m:1}:{y:v.y,m:v.m+1})}>›</button>
        </div>
        <div className="cgrid">
          {["日","月","火","水","木","金","土"].map((d,i)=><div key={d} className={`cdow ${i===0?"su":""} ${i===6?"sa":""}`}>{d}</div>)}
          {Array.from({length:fw}).map((_,i)=><div key={"e"+i} className="cday emp"/>)}
          {dayList.map(d=>{
            const ds=getDateStr(d); const we=isWe(d); const c=countByDay(d);
            const isToday=ds===todayISO(); const isSel=ds===selDate;
            return <div key={d} className={`cday ${isToday?"td":""} ${isSel?"sel":""} ${we?"we":""}`} onClick={()=>!we&&setSelDate(ds)}>
              <span style={{fontSize:10}}>{d}</span>
              {!we&&c.come>0&&<div style={{fontSize:9,fontWeight:700,color:"var(--gr)",lineHeight:1}}>{c.come}人</div>}
              {!we&&(c.come>0||c.absent>0)&&<div className="dots">{c.come>0&&<div className="dot dg"/>}{c.absent>0&&<div className="dot dr"/>}</div>}
            </div>;
          })}
        </div>
      </div>
      <div style={{marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{fontSize:15,fontWeight:900}}>{dlabel(selDate)} の状況</div>
          {isMgr&&<button onClick={()=>{setAddChecked([]);setShowAddModal(true);}} style={{padding:"7px 14px",borderRadius:20,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"var(--ac)",color:"#fff",border:"none",boxShadow:"var(--sh)"}}>＋ 生徒を追加</button>}
        </div>
        {(()=>{const d=parseInt(selDate.split("-")[2]);const c=countByDay(d);const total=users.length;return(
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
            <div style={{background:"rgba(44,170,96,0.2)",borderRadius:10,padding:"8px 14px",display:"flex",gap:6,alignItems:"center"}}><span style={{fontSize:20,fontWeight:900,color:"var(--gr)"}}>{c.come}</span><span style={{fontSize:11,color:"var(--gr)"}}>来所予定</span></div>
            <div style={{background:"rgba(224,56,56,0.15)",borderRadius:10,padding:"8px 14px",display:"flex",gap:6,alignItems:"center"}}><span style={{fontSize:20,fontWeight:900,color:"var(--ro)"}}>{c.absent}</span><span style={{fontSize:11,color:"var(--ro)"}}>欠席</span></div>
            <div style={{background:"var(--bg)",borderRadius:10,padding:"8px 14px",display:"flex",gap:6,alignItems:"center"}}><span style={{fontSize:20,fontWeight:900,color:"var(--tx3)"}}>{total-c.come-c.absent}</span><span style={{fontSize:11,color:"var(--tx3)"}}>未定</span></div>
          </div>
        );})()}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:8}}>
          {selDayUsers.map(u=>{
            const stObj=SCHEDULE_STATUS[u.status];
            const d=parseInt(selDate.split("-")[2]);
            return <div key={u.id} style={{background:"var(--wh)",border:"2px solid "+(stObj?stObj.color:"var(--bd)"),borderRadius:11,padding:11,boxShadow:"var(--sh)"}}>
              <div style={{fontWeight:700,fontSize:13,marginBottom:4}}>{u.name}</div>
              {selFac==="all"&&<div style={{fontSize:10,color:"var(--tx3)",marginBottom:4}}>{FACILITIES.find(f=>f.id===u.facilityId)?.name}</div>}
              <div style={{padding:"4px 10px",borderRadius:9,fontSize:11,fontWeight:700,background:stObj?stObj.bg:"var(--bg)",color:stObj?stObj.color:"var(--tx3)",marginBottom:8,display:"inline-block"}}>{stObj?stObj.label:"未定"}</div>
              <div style={{display:"flex",gap:5,marginBottom:8}}>
                <span style={{fontSize:10,padding:"2px 7px",borderRadius:7,fontWeight:700,background:u.transportTo?"rgba(58,160,216,0.2)":"var(--bg)",color:u.transportTo?"var(--tl)":"var(--tx3)",border:"1px solid "+(u.transportTo?"rgba(58,160,216,0.4)":"var(--bd)")}}>迎</span>
                <span style={{fontSize:10,padding:"2px 7px",borderRadius:7,fontWeight:700,background:u.transportFrom?"rgba(44,170,96,0.2)":"var(--bg)",color:u.transportFrom?"var(--gr)":"var(--tx3)",border:"1px solid "+(u.transportFrom?"rgba(44,170,96,0.4)":"var(--bd)")}}>送</span>
              </div>
              {isMgr&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
                <button onClick={()=>setSchedule(u.id,d,"来所",u.transportTo,u.transportFrom)} style={{padding:"7px 4px",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",borderColor:u.status==="来所"?"var(--gr)":"var(--bd)",background:u.status==="来所"?"rgba(44,170,96,0.2)":"var(--wh)",color:u.status==="来所"?"var(--gr)":"var(--tx2)"}}>✅ 入室</button>
                <button onClick={()=>setSchedule(u.id,d,"欠席",false,false)} style={{padding:"7px 4px",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",borderColor:u.status==="欠席"?"var(--ro)":"var(--bd)",background:u.status==="欠席"?"rgba(224,56,56,0.15)":"var(--wh)",color:u.status==="欠席"?"var(--ro)":"var(--tx2)"}}>❌ 欠席</button>
                <button onClick={()=>setEditCell({uid:u.id,day:d,name:u.name,status:u.status,transportTo:u.transportTo,transportFrom:u.transportFrom})} style={{padding:"6px 4px",borderRadius:8,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid var(--bd)",background:"var(--bg)",color:"var(--tx3)",gridColumn:"span 2"}}>✏️ 詳細設定</button>
              </div>}
            </div>;
          })}
        </div>
      </div>

      {/* 生徒追加モーダル */}
      {showAddModal&&(()=>{
        const d=parseInt(selDate.split("-")[2]);
        // 全施設の生徒から「未定・欠席」の生徒を選択可能に表示
        const allUsers=store.dynUsers.filter(u=>u.active!==false);
        const toggle=id=>setAddChecked(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
        const confirm=()=>{
          addChecked.forEach(id=>{
            const u=store.dynUsers.find(x=>x.id===id);
            if(u) setSchedule(id,d,"来所予定",false,false);
          });
          setShowAddModal(false);
        };
        return <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.45)",zIndex:1000,display:"flex",alignItems:"flex-end"}} onClick={()=>setShowAddModal(false)}>
          <div style={{background:"var(--wh)",borderRadius:"18px 18px 0 0",padding:20,width:"100%",maxHeight:"75vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontSize:15,fontWeight:900}}>📋 {dlabel(selDate)}　生徒を追加</div>
              <button onClick={()=>setShowAddModal(false)} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:"var(--tx3)"}}>×</button>
            </div>
            <div style={{fontSize:11,color:"var(--tx3)",marginBottom:12}}>来所予定にする生徒を選んでください</div>
            {/* 施設ごとにグルーピング */}
            {FACILITIES.map(fac=>{
              const facUsers=allUsers.filter(u=>u.facilityId===fac.id);
              if(facUsers.length===0) return null;
              return <div key={fac.id} style={{marginBottom:14}}>
                <div style={{fontSize:11,fontWeight:700,color:"var(--tl)",marginBottom:6,padding:"3px 8px",background:"var(--bg2)",borderRadius:6}}>{fac.name}</div>
                {facUsers.map(u=>{
                  const st=getStatus(u.id,d);
                  const checked=addChecked.includes(u.id);
                  return <div key={u.id} onClick={()=>toggle(u.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 8px",borderRadius:9,marginBottom:4,background:checked?"#e8f4fd":"var(--bg)",border:"1.5px solid "+(checked?"var(--tl)":"var(--bd)"),cursor:"pointer"}}>
                    <div style={{width:20,height:20,borderRadius:5,border:"2px solid "+(checked?"var(--tl)":"var(--bd)"),background:checked?"var(--tl)":"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      {checked&&<span style={{color:"#fff",fontSize:13,fontWeight:900}}>✓</span>}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:13}}>{u.name}</div>
                      {st&&<div style={{fontSize:10,color:SCHEDULE_STATUS[st]?.color||"var(--tx3)"}}>{SCHEDULE_STATUS[st]?.label||st}</div>}
                    </div>
                  </div>;
                })}
              </div>;
            })}
            <div style={{display:"flex",gap:10,paddingTop:10}}>
              <button onClick={()=>setShowAddModal(false)} style={{flex:1,padding:"12px",borderRadius:10,border:"1.5px solid var(--bd)",background:"var(--bg)",fontFamily:"'Noto Sans JP',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer"}}>キャンセル</button>
              <button onClick={confirm} disabled={addChecked.length===0} style={{flex:2,padding:"12px",borderRadius:10,border:"none",background:addChecked.length>0?"var(--ac)":"var(--bd)",color:"#fff",fontFamily:"'Noto Sans JP',sans-serif",fontWeight:700,fontSize:13,cursor:addChecked.length>0?"pointer":"default"}}>
                {addChecked.length>0?`✅ ${addChecked.length}名を来所予定に追加`:"生徒を選んでください"}
              </button>
            </div>
          </div>
        </div>;
      })()}
    </div>
  );

  const TableView = () => (
    <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
      <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:12}}>
        <button className="cn" onClick={()=>setVm(v=>v.m===1?{y:v.y-1,m:12}:{y:v.y,m:v.m-1})}>‹</button>
        <div style={{fontSize:15,fontWeight:900}}>{vm.y}年 {vm.m}月</div>
        <button className="cn" onClick={()=>setVm(v=>v.m===12?{y:v.y+1,m:1}:{y:v.y,m:v.m+1})}>›</button>
      </div>
      <table style={{borderCollapse:"collapse",fontSize:11,minWidth:"max-content"}}>
        <thead>
          <tr>
            <th style={{border:"1px solid var(--bd)",padding:"6px 10px",background:"var(--bg2)",textAlign:"left",minWidth:90,position:"sticky",left:0,zIndex:2}}>利用者名</th>
            {dayList.map(d=><th key={d} style={{border:"1px solid var(--bd)",padding:"4px 2px",background:isWe(d)?"#f5f5f5":getDateStr(d)===todayISO()?"rgba(58,160,216,0.2)":"var(--bg2)",color:isWe(d)?"#aaa":getDow(d)===0?"var(--ro)":getDow(d)===6?"var(--tl)":"var(--tx2)",minWidth:34,textAlign:"center",fontSize:9}}>{d}<br/>{dowLabel[getDow(d)]}</th>)}
            <th style={{border:"1px solid var(--bd)",padding:"4px 5px",background:"var(--bg2)",minWidth:36,fontSize:9}}>予定</th>
            <th style={{border:"1px solid var(--bd)",padding:"4px 5px",background:"rgba(44,170,96,0.2)",minWidth:36,fontSize:9}}>来所</th>
            <th style={{border:"1px solid var(--bd)",padding:"4px 5px",background:"rgba(224,56,56,0.15)",minWidth:36,fontSize:9}}>欠席</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u=>{
            const cnt=countByUser(u.id);
            return <tr key={u.id}>
              <td style={{border:"1px solid var(--bd)",padding:"5px 8px",fontWeight:700,fontSize:12,background:"var(--wh)",position:"sticky",left:0,zIndex:1,whiteSpace:"nowrap"}}>
                {u.name}
                {selFac==="all"&&<div style={{fontSize:9,color:"var(--tx3)",fontWeight:400}}>{FACILITIES.find(f=>f.id===u.facilityId)?.name}</div>}
              </td>
              {dayList.map(d=>{
                const st=getStatus(u.id,d); const stObj=SCHEDULE_STATUS[st];
                const tr_to=getTransportTo(u.id,d); const tr_fr=getTransportFrom(u.id,d);
                return <td key={d} onClick={()=>isMgr&&setEditCell({uid:u.id,day:d,name:u.name,status:st,transportTo:tr_to,transportFrom:tr_fr})}
                  style={{border:"1px solid var(--bd)",padding:"2px 1px",textAlign:"center",background:stObj?stObj.bg:isWe(d)?"#fafafa":"var(--wh)",cursor:isMgr?"pointer":"default",minWidth:34}}>
                  {stObj&&<div style={{fontSize:10,fontWeight:700,color:stObj.color,lineHeight:1.2}}>{stObj.short}</div>}
                  {(tr_to||tr_fr)&&<div style={{fontSize:8,color:"#555",lineHeight:1}}>{tr_to?"迎":""}{tr_fr?"送":""}</div>}
                </td>;
              })}
              <td style={{border:"1px solid var(--bd)",padding:"4px 5px",textAlign:"center",fontWeight:700,color:"var(--tl)",background:"var(--bg)"}}>{cnt.come}</td>
              <td style={{border:"1px solid var(--bd)",padding:"4px 5px",textAlign:"center",fontWeight:700,color:"var(--gr)",background:"#eef8f2"}}>{cnt.actual}</td>
              <td style={{border:"1px solid var(--bd)",padding:"4px 5px",textAlign:"center",fontWeight:700,color:"var(--ro)",background:"rgba(224,56,56,0.08)"}}>{cnt.absent}</td>
            </tr>;
          })}
          <tr style={{background:"#f0f5ff",borderTop:"2px solid var(--bd)"}}>
            <td style={{padding:"6px 8px",fontWeight:700,fontSize:11,position:"sticky",left:0,background:"#f0f5ff",border:"1px solid var(--bd)"}}>日別来所数</td>
            {dayList.map(d=>{
              if(isWe(d)) return <td key={d} style={{border:"1px solid var(--bd)",background:"#f5f5f5"}}></td>;
              const c=countByDay(d);
              return <td key={d} style={{border:"1px solid var(--bd)",padding:"3px 1px",textAlign:"center"}}>
                <div style={{fontSize:9,fontWeight:700,color:"var(--gr)"}}>{c.come}</div>
                {c.absent>0&&<div style={{fontSize:8,color:"var(--ro)"}}>欠{c.absent}</div>}
              </td>;
            })}
            <td colSpan={3} style={{border:"1px solid var(--bd)"}}></td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  const EditModal = () => {
    if (!editCell) return null;
    const [tmpStatus, setTmpStatus] = useState(editCell.status||"");
    const [tmpTo, setTmpTo] = useState(editCell.transportTo||false);
    const [tmpFrom, setTmpFrom] = useState(editCell.transportFrom||false);
    return (
      <div style={{position:"fixed",top:0,right:0,bottom:0,left:0,background:"rgba(0,0,0,0.5)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={e=>e.target===e.currentTarget&&setEditCell(null)}>
        <div style={{background:"var(--wh)",borderRadius:"16px 16px 0 0",width:"100%",maxWidth:420,padding:"20px 18px 32px",boxShadow:"0 -4px 24px rgba(0,0,0,0.18)"}}>
          <div style={{fontWeight:900,fontSize:16,marginBottom:2}}>{editCell.name}</div>
          <div style={{fontSize:12,color:"var(--tx3)",marginBottom:14}}>{vm.y}年{vm.m}月{editCell.day}日（{dowLabel[getDow(editCell.day)]}）</div>
          <div style={{fontSize:10,fontWeight:700,color:"var(--tl)",letterSpacing:1,marginBottom:8}}>状態を選択</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:14}}>
            {Object.entries(SCHEDULE_STATUS).map(([k,v])=>(
              <button key={k} onClick={()=>setTmpStatus(k)} style={{padding:"10px 5px",borderRadius:10,background:tmpStatus===k?v.bg:"var(--bg)",color:tmpStatus===k?v.color:"var(--tx3)",border:"2px solid "+(tmpStatus===k?v.color:"var(--bd)"),fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>{v.label}</button>
            ))}
            <button onClick={()=>setTmpStatus("")} style={{padding:"10px 5px",borderRadius:10,background:tmpStatus===""?"#e8e8e8":"var(--bg)",color:"var(--tx3)",border:"2px solid "+(tmpStatus===""?"#aaa":"var(--bd)"),fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>クリア</button>
          </div>
          <div style={{fontSize:10,fontWeight:700,color:"var(--tl)",letterSpacing:1,marginBottom:8}}>送迎設定</div>
          <div style={{display:"flex",gap:10,marginBottom:16}}>
            <button onClick={()=>setTmpTo(!tmpTo)} style={{flex:1,padding:"10px",borderRadius:10,background:tmpTo?"rgba(58,160,216,0.2)":"var(--bg)",color:tmpTo?"var(--tl)":"var(--tx3)",border:"2px solid "+(tmpTo?"var(--tl)":"var(--bd)"),fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>🚌 迎（来所時）</button>
            <button onClick={()=>setTmpFrom(!tmpFrom)} style={{flex:1,padding:"10px",borderRadius:10,background:tmpFrom?"rgba(44,170,96,0.2)":"var(--bg)",color:tmpFrom?"var(--gr)":"var(--tx3)",border:"2px solid "+(tmpFrom?"var(--gr)":"var(--bd)"),fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>🚌 送（帰り）</button>
          </div>
          <button onClick={()=>setSchedule(editCell.uid,editCell.day,tmpStatus,tmpTo,tmpFrom)} style={{width:"100%",padding:"13px",borderRadius:12,background:"var(--tl)",border:"none",color:"#fff",fontWeight:900,fontSize:14,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>保存する</button>
        </div>
      </div>
    );
  };

  return (
    <div className="fl-wrap">
      <div className="fl-hd">
        <button className="bback" onClick={onBack}>← 戻る</button>
        <div className="fl-title">📅 生徒予定表</div>
        <button className="bexp" style={{marginLeft:"auto",background:"#fff8f0",borderColor:"var(--ac)",color:"var(--ac)"}} onClick={printSchedule}>🖨️ 印刷</button>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12,alignItems:"center"}}>
        {isAdmin&&<select className="fsm" value={selFac} onChange={e=>setSelFac(e.target.value)}>{facOptions.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select>}
        <div style={{display:"flex",gap:5}}>
          <button onClick={()=>setViewMode("calendar")} style={{padding:"7px 14px",borderRadius:16,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:viewMode==="calendar"?"var(--tl)":"var(--wh)",color:viewMode==="calendar"?"#fff":"var(--tx3)",border:viewMode==="calendar"?"none":"1.5px solid var(--bd)"}}>📅 カレンダー</button>
          <button onClick={()=>setViewMode("table")} style={{padding:"7px 14px",borderRadius:16,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:viewMode==="table"?"var(--tl)":"var(--wh)",color:viewMode==="table"?"#fff":"var(--tx3)",border:viewMode==="table"?"none":"1.5px solid var(--bd)"}}>📊 表形式</button>
        </div>
      </div>
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:12}}>
        {Object.entries(SCHEDULE_STATUS).map(([k,v])=>(
          <span key={k} style={{padding:"3px 9px",borderRadius:8,background:v.bg,color:v.color,fontSize:10,fontWeight:700}}>{v.label}</span>
        ))}
      </div>
      {users.length===0
        ? <div style={{textAlign:"center",color:"var(--tx3)",padding:32,background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11}}>利用者が登録されていません</div>
        : viewMode==="calendar" ? <CalendarView /> : <TableView />
      }
      <EditModal />
    </div>
  );
}
// ==================== SIDEBAR ====================
function Sidebar({user,screen,onNav,onLogout,unreadCount,open,onClose,onChangeFacility}){
  const isMgr=user.role==="manager"||user.role==="admin";
  const fac=FACILITIES.find(f=>f.id===user.selectedFacilityId);
  const [facOpen,setFacOpen]=useState(false);
  const roleLabel={staff:"支援員",specialist:"専門職員",cdsm:"児発管責任者",manager:"管理者",part_qual:"パート(指導員)",part_noqual:"パート",consultant:"相談支援員",admin:"本部管理者"}[user.role]||user.role;

  const nav=[
    {id:"home",icon:"🏠",label:"ダッシュボード"},
    {sec:"今日の記録"},
    {id:"clock_in",icon:"🟢",label:"職員 出勤"},
    {id:"clock_out",icon:"🟡",label:"職員 退勤"},
    {id:"user_arrive",icon:"🌟",label:"利用者 来所"},
    {id:"user_depart",icon:"🏠",label:"利用者 退所"},
    {sec:"支援・記録"},
    {id:"service",icon:"📋",label:"サービス記録"},
    {id:"photo",icon:"📸",label:"写真記録"},
    {id:"messages",icon:"💬",label:"保護者連絡",badge:unreadCount>0?unreadCount:null},
    {id:"daily",icon:"📓",label:"業務日報"},
    {id:"isp",icon:"📝",label:"個別支援計画"},
    {sec:"管理"},
    {id:"schedule",icon:"📅",label:"生徒予定表"},
    {id:"users",icon:"👤",label:"利用者管理"},
    {id:"shift",icon:"📆",label:"シフト管理"},
    {id:"paidleave",icon:"🌴",label:"有給管理"},
    ...(isMgr?[
      {sec:"管理者専用"},
      {id:"attendance",icon:"📋",label:"出欠管理"},
      {id:"transport",icon:"🚌",label:"送迎管理"},
      {id:"kokuho",icon:"💴",label:"国保連請求"},
      {id:"staffmgmt",icon:"👥",label:"スタッフ管理"},
      {id:"admin",icon:"📊",label:"管理画面"},
      {id:"audit",icon:"🔍",label:"監査モード"},
    ]:[]),
  ];

  const go=(id)=>{onNav(id);onClose();};

  return <>
    <div className={`sb-overlay${open?" open":""}`} onClick={onClose}/>
    <div className={`sidebar${open?" open":""}`}>
      {/* ロゴ */}
      <div className="sb-brand">
        <div className="sb-logo">GO GROUP</div>
        <div className="sb-logo-sub">放課後等デイサービス管理システム</div>
      </div>
      {/* 施設切替 */}
      <div style={{margin:"10px 12px 4px",position:"relative"}}>
        <button onClick={()=>setFacOpen(o=>!o)} style={{width:"100%",background:"var(--bg3)",border:"1px solid var(--bd)",borderRadius:8,padding:"8px 11px",textAlign:"left",cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:10,color:"var(--tx3)",marginBottom:2}}>📍 現在の施設</div>
            <div style={{fontSize:13,fontWeight:700,color:"var(--tx)"}}>{fac?.name||"未選択"}</div>
          </div>
          <span style={{fontSize:12,color:"var(--tx3)",marginLeft:6}}>{facOpen?"▲":"▼"}</span>
        </button>
        {facOpen&&<div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:999,background:"var(--bg2)",border:"1px solid var(--tl)",borderRadius:8,marginTop:4,overflow:"hidden",boxShadow:"0 4px 16px rgba(0,0,0,0.3)"}}>
          {FACILITIES.map(f=>(
            <button key={f.id} onClick={()=>{onChangeFacility(f.id);setFacOpen(false);}}
              style={{width:"100%",padding:"10px 14px",textAlign:"left",background:f.id===user.selectedFacilityId?"rgba(58,160,216,0.2)":"transparent",border:"none",borderBottom:"1px solid var(--bd)",cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",fontSize:13,fontWeight:f.id===user.selectedFacilityId?700:400,color:f.id===user.selectedFacilityId?"var(--tl)":"var(--tx)",display:"flex",alignItems:"center",gap:8}}>
              {f.id===user.selectedFacilityId&&<span style={{color:"var(--tl)"}}>✓</span>}
              {f.name}
            </button>
          ))}
        </div>}
      </div>
      {/* ナビゲーション */}
      <div style={{flex:1,overflowY:"auto",padding:"6px 0",scrollbarWidth:"none"}}>
        {nav.map((item,i)=>{
          if(item.sec!==undefined){
            return <div key={i} className="sb-section">{item.sec}</div>;
          }
          return <div key={item.id} className={`sb-item${screen===item.id?" active":""}`} onClick={()=>go(item.id)}>
            <span className="sb-icon">{item.icon}</span>
            <span style={{flex:1}}>{item.label}</span>
            {item.badge&&<span className="sb-badge">{item.badge}</span>}
          </div>;
        })}
      </div>
      {/* ユーザー情報 */}
      <div className="sb-bottom">
        <div className="sb-user">
          <div className="sb-avatar">👤</div>
          <div className="sb-user-info">
            <div className="sb-user-name">{user.displayName}</div>
            <div className="sb-user-role">{roleLabel}</div>
          </div>
          <button className="sb-logout" onClick={onLogout}>退出</button>
        </div>
      </div>
    </div>
  </>;
}

// ==================== APP ROOT ====================
export default function App(){
  const [user,setUser]=useState(()=>{
    try{const s=localStorage.getItem('gogroup_user');return s?JSON.parse(s):null;}catch(e){return null;}
  });
  const [screen,setScreen]=useState("home");
  const [sbOpen,setSbOpen]=useState(false);
  const store=useStore();

  const logout=()=>{
    localStorage.removeItem('gogroup_user');
    setUser(null);setScreen("home");
  };

  if(!user)return <><style>{CSS}</style><div className="app"><LoginScreen onLogin={u=>{
    try{localStorage.setItem('gogroup_user',JSON.stringify(u));}catch(e){}
    setUser(u);setScreen("home");
  }}/></div></>;

  const unreadCount=store.msgs.filter(m=>(user.role==="admin"||m.facilityId===user.selectedFacilityId)&&!m.read).length;

  const screenTitles={
    home:"ダッシュボード",clock_in:"職員 出勤打刻",clock_out:"職員 退勤打刻",
    user_arrive:"利用者 来所",user_depart:"利用者 退所",photo:"写真記録",
    service:"サービス提供記録",messages:"保護者連絡",schedule:"生徒予定表",
    daily:"業務日報",paidleave:"有給管理",users:"利用者管理",
    shift:"シフト管理",attendance:"出欠管理",transport:"送迎管理",
    kokuho:"国保連請求",staffmgmt:"スタッフ管理",admin:"管理画面",audit:"監査モード",
    isp:"個別支援計画",
  };

  const render=()=>{switch(screen){
    case "home":return <HomeScreen user={user} onNav={setScreen} store={store}/>;
    case "clock_in":return <StaffClockIn user={user} onBack={()=>setScreen("home")} store={store}/>;
    case "clock_out":return <StaffClockOut user={user} onBack={()=>setScreen("home")} store={store}/>;
    case "user_arrive":return <UserArrive user={user} onBack={()=>setScreen("home")} store={store}/>;
    case "user_depart":return <UserDepart user={user} onBack={()=>setScreen("home")} store={store}/>;
    case "photo":return <PhotoRecord user={user} onBack={()=>setScreen("home")} store={store}/>;
    case "service":return <ServiceRecord user={user} onBack={()=>setScreen("home")} store={store}/>;
    case "attendance":return <AttendanceScreen user={user} store={store} onBack={()=>setScreen("home")}/>;
    case "shift":return <ShiftScreen user={user} store={store} onBack={()=>setScreen("home")}/>;
    case "transport":return <TransportScreen user={user} store={store} onBack={()=>setScreen("home")}/>;
    case "messages":return <ParentMessages user={user} store={store} onBack={()=>setScreen("home")}/>;
    case "daily":return <DailyReport user={user} store={store} onBack={()=>setScreen("home")}/>;
    case "users":return <UserManagement user={user} store={store} onBack={()=>setScreen("home")}/>;
    case "kokuho":return <KokuhoScreen user={user} store={store} onBack={()=>setScreen("home")}/>;
    case "paidleave":return <PaidLeaveScreen user={user} store={store} onBack={()=>setScreen("home")}/>
    case "schedule":return <ScheduleScreen user={user} store={store} onBack={()=>setScreen("home")}/>
    case "staffmgmt":return <StaffManagement user={user} store={store} onBack={()=>setScreen("home")}/>
    case "admin":return <AdminScreen user={user} store={store} onBack={()=>setScreen("home")}/>;
    case "audit":return <AuditScreen user={user} store={store} onBack={()=>setScreen("home")}/>;
    case "isp":return <IspScreen user={user} store={store} onBack={()=>setScreen("home")}/>;
    default:return <HomeScreen user={user} onNav={setScreen} store={store}/>;
  }};

  // モバイル ボトムナビ
  const bnItems=[
    {id:"home",icon:"🏠",label:"ホーム"},
    {id:"clock_in",icon:"🟢",label:"出勤"},
    {id:"user_arrive",icon:"🌟",label:"来所"},
    {id:"messages",icon:"💬",label:"連絡",badge:unreadCount>0?unreadCount:null},
    {id:"schedule",icon:"📅",label:"予定表"},
  ];

  return <>
    <style>{CSS}</style>
    <div className="app">
      <div className="app-shell">
        <Sidebar user={user} screen={screen} onNav={setScreen} onLogout={logout}
          unreadCount={unreadCount} open={sbOpen} onClose={()=>setSbOpen(false)}
          onChangeFacility={fid=>{const u2={...user,selectedFacilityId:fid};setUser(u2);try{localStorage.setItem('gogroup_user',JSON.stringify(u2));}catch(e){}setScreen("home");setSbOpen(false);}}/>
        <div className="main-wrap">
          {/* トップバー */}
          <div className="top-bar">
            <div className="top-bar-left">
              <button className="hmb" onClick={()=>setSbOpen(o=>!o)}>☰</button>
              <div className="top-bar-title">{screenTitles[screen]||"GO GROUP"}</div>
            </div>
            <div className="top-bar-right">
              <div className="top-bar-date">{todayDisplay()}</div>
            </div>
          </div>
          {/* メインコンテンツ */}
          <div className="main-content">
            <div className="wrap">{render()}</div>
          </div>
        </div>
      </div>
      {/* モバイル ボトムナビ */}
      <div className="bottom-nav">
        <div className="bn-row">
          {bnItems.map(item=>(
            <div key={item.id} className={`bn-item${screen===item.id?" active":""}`} onClick={()=>setScreen(item.id)}>
              <span className="bn-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge&&<span className="bn-badge">{item.badge}</span>}
            </div>
          ))}
        </div>
      </div>
      {/* グローバルトースト */}
      <Toast msg={store.toastMsg} type={store.toastType}/>
    </div>
  </>;
}

// エントリーポイント（Vite HMRで多重createRootしないよう対策）
const _rootEl = document.getElementById("root");
if (_rootEl) {
  // HMRリロード時は既存ルートを再利用する
  let _appRoot = import.meta.hot?.data?.root;
  if (!_appRoot) {
    _appRoot = createRoot(_rootEl);
    if (import.meta.hot) import.meta.hot.data.root = _appRoot;
  }
  _appRoot.render(<App />);
}
