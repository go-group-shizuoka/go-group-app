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

// ==================== サービス種別マスタ ====================
// ⚠️ 単価・加算をコードへ直書き禁止。法改正時はここを更新する。
const SERVICE_TYPES = [
  {
    id: "houkago",
    name: "放課後等デイサービス",
    short: "放デイ",
    color: "#3aa0d8",
    bg: "rgba(58,160,216,0.15)",
    icon: "🏫",
    requiredDocs: ["個別支援計画","フェイスシート","アセスメント","サービス提供記録","業務日報","モニタリング"],
    alertRules: ["isp","assessment","monitoring","jukyusha"],
  },
  {
    id: "jidouhattatsu",
    name: "児童発達支援",
    short: "児発",
    color: "#e07020",
    bg: "rgba(240,112,32,0.15)",
    icon: "🌱",
    requiredDocs: ["個別支援計画","フェイスシート","アセスメント","発達段階記録","保護者支援記録","サービス提供記録","業務日報","モニタリング"],
    alertRules: ["isp","assessment","monitoring","jukyusha","dev_record","parent_support"],
  },
  {
    id: "hoikuvisit",
    name: "保育所等訪問支援",
    short: "訪問",
    color: "#2caa60",
    bg: "rgba(44,170,96,0.15)",
    icon: "🚌",
    requiredDocs: ["訪問計画書","訪問記録","学校連携記録","保護者同意書","個別支援計画"],
    alertRules: ["isp","jukyusha","visit_record"],
  },
];

// 施設ごとに運営しているサービス種別（GO GROUP 施設構成）
const FACILITY_SERVICES = {
  "f1": ["houkago","jidouhattatsu"],   // GO HOME：多機能型
  "f2": ["houkago"],                    // GO ROOM：放デイ
  "f3": ["houkago","hoikuvisit"],       // GO TOWN 1ST：放デイ＋保育所等訪問
  "f4": ["houkago"],                    // GO TOWN 2ND：放デイ
};

// ==================== 報酬単価マスタ ====================
// ⚠️ 法改正・地域区分変更時はここを更新する（コードへ直書き禁止）
const REWARD_MASTER = {
  houkago: {
    label: "放課後等デイサービス",
    timeTypes: [
      { key:"放課後", code:"6612B", unitPrice:530, label:"放課後（平日）" },
      { key:"休日",   code:"6612C", unitPrice:684, label:"休日・長期休暇" },
    ],
    addons: [
      { id:"transport_one",  name:"送迎加算（片道）",        unit:54  },
      { id:"transport_both", name:"送迎加算（往復）",        unit:108 },
      { id:"meal",           name:"食事提供加算",            unit:30  },
      { id:"medical",        name:"医療連携体制加算",        unit:100 },
      { id:"support_staff",  name:"専門的支援加算",          unit:120 },
      { id:"behavior",       name:"行動障害支援加算",        unit:155 },
    ],
  },
  jidouhattatsu: {
    label: "児童発達支援",
    timeTypes: [
      { key:"未就学", code:"7111B", unitPrice:611, label:"未就学児（平日）" },
      { key:"休日",   code:"7111C", unitPrice:790, label:"休日" },
    ],
    addons: [
      { id:"transport_one",   name:"送迎加算（片道）",       unit:54  },
      { id:"transport_both",  name:"送迎加算（往復）",       unit:108 },
      { id:"parent_support",  name:"保護者支援加算",         unit:80  },
      { id:"family_support",  name:"家族支援加算",           unit:150 },
      { id:"meal",            name:"食事提供加算",           unit:30  },
      { id:"support_staff",   name:"専門的支援加算",         unit:120 },
      { id:"early_support",   name:"早期支援加算",           unit:200 },
    ],
  },
  hoikuvisit: {
    label: "保育所等訪問支援",
    timeTypes: [
      { key:"初回",     code:"8111B", unitPrice:794, label:"初回訪問" },
      { key:"2回目以降", code:"8112B", unitPrice:686, label:"2回目以降" },
    ],
    addons: [
      { id:"specialist", name:"専門支援加算",               unit:250 },
      { id:"long",       name:"長時間支援加算（2h以上）",   unit:100 },
    ],
  },
};

// 施設のサービス種別一覧を返すヘルパー
function getFacilityServiceTypes(facilityId) {
  const ids = FACILITY_SERVICES[facilityId] || ["houkago"];
  return ids.map(id => SERVICE_TYPES.find(s=>s.id===id)).filter(Boolean);
}

// 利用者のサービス種別オブジェクトを返す
function getUserServiceType(u) {
  return SERVICE_TYPES.find(s=>s.id===(u.serviceType||"houkago")) || SERVICE_TYPES[0];
}

// 訪問種別
const VISIT_DEST_TYPES = ["保育園","幼稚園","認定こども園","小学校","中学校","高等学校","その他"];
// 発達5領域（児発用）
const DEV_DOMAINS = ["身体・運動","認知・学習","言語・コミュニケーション","社会性・対人関係","生活習慣・自立"];
// 保護者支援種別
const PARENT_SUPPORT_TYPES = ["個別相談","家族支援","電話相談","グループ支援","情報提供","その他"];

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

// ── 施設コードマップ ──
// f1=GO HOME / f2=GO ROOM / f3=GO TOWN 1ST / f4=GO TOWN 2ND
const FACILITY_CODES = { f1:"GH", f2:"GR", f3:"T1", f4:"T2" };

// ── 利用者ID生成: U-{施設コード}-{連番4桁} 例: U-GH-0001 ──
const genUserId = (facilityId, existingUsers=[]) => {
  const code = FACILITY_CODES[facilityId] || "XX";
  // 同じ施設コードで始まるIDの最大連番を取得
  const prefix = `U-${code}-`;
  const maxSeq = existingUsers
    .filter(u => u.id && u.id.startsWith(prefix))
    .map(u => parseInt(u.id.replace(prefix, ""), 10))
    .filter(n => !isNaN(n))
    .reduce((max, n) => Math.max(max, n), 0);
  return `${prefix}${String(maxSeq + 1).padStart(4, "0")}`;
};

// ── 職員ID生成: S-{施設コード}-{連番4桁} 例: S-GH-0001 ──
const genStaffId = (facilityId, existingStaff=[]) => {
  const code = FACILITY_CODES[facilityId] || "XX";
  const prefix = `S-${code}-`;
  const maxSeq = existingStaff
    .filter(s => s.id && s.id.startsWith(prefix))
    .map(s => parseInt(s.id.replace(prefix, ""), 10))
    .filter(n => !isNaN(n))
    .reduce((max, n) => Math.max(max, n), 0);
  return `${prefix}${String(maxSeq + 1).padStart(4, "0")}`;
};
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

// ─── ISP書類印刷（isp_records形式・全docType対応）A4縦 ───
function printIspRecord(rec, u, facilityName){
  const c = rec.content || {};
  const statusLabels = {
    ai_draft:"AI原案",staff_checked:"職員確認済",cdsm_approved:"児発管承認",
    manager_confirmed:"管理者確認",parent_explained:"保護者説明済",
    parent_consented:"保護者同意済",finalized:"確定"
  };
  const statusLabel = statusLabels[rec.status] || rec.status;
  const docLabel = {
    isp_plan:"個別支援計画書", assessment:"アセスメント記録票",
    weekly_plan:"週間支援計画", monitoring:"モニタリング記録",
    meeting:"支援会議記録", consent:"保護者同意書"
  }[rec.docType] || rec.docType;

  const row=(label,val,full=false)=>{
    if(!val) return "";
    return `<tr>
      <td style="border:1px solid #ccc;padding:6px 8px;font-size:11px;font-weight:700;background:#f5f5f5;width:${full?"100%":"140px"};vertical-align:top;white-space:nowrap;">${label}</td>
      <td style="border:1px solid #ccc;padding:6px 8px;font-size:12px;vertical-align:top;white-space:pre-wrap;">${String(val).replace(/</g,"&lt;").replace(/>/g,"&gt;")}</td>
    </tr>`;
  };

  const header = `
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
    <div>
      <h2 style="font-size:18px;font-weight:900;margin:0 0 4px;">${docLabel}</h2>
      <div style="font-size:11px;color:#666;">ステータス：${statusLabel}　／　作成者：${rec.createdBy||""}　／　作成日：${(rec.createdAt||"").slice(0,10)}</div>
    </div>
    <div style="text-align:right;font-size:11px;color:#666;border:1px solid #ccc;padding:6px 10px;border-radius:6px;">
      <div style="font-weight:700;font-size:13px;">${u.name||""}</div>
      <div>${u.grade||""} / ${u.jukyushaNo||""}</div>
      <div>${facilityName}</div>
    </div>
  </div>`;

  let bodyRows = "";

  if(rec.docType === "isp_plan"){
    bodyRows = [
      row("計画期間", c.validFrom&&c.validTo ? `${c.validFrom} 〜 ${c.validTo}` : (c.validFrom||"")),
      row("支援期間", c.supportPeriod),
      row("本人のニーズ", c.userNeeds),
      row("保護者のニーズ", c.parentNeeds),
      row("長期目標", c.longGoal),
      row("長期目標期間", c.longGoalTerm),
      row("短期目標", c.shortGoal),
      row("短期目標期間", c.shortGoalTerm),
      row("支援内容", c.supportContent),
      row("具体的な手立て", c.specificMethods),
      row("担当者", c.staffInCharge),
      row("児発管名", c.cdsmName),
      row("支援頻度", c.frequency),
      row("達成時期", c.achievementDate),
      row("評価方法", c.evaluationMethod),
      row("見直し予定日", c.reviewDate),
    ].filter(Boolean).join("");
  } else if(rec.docType === "assessment"){
    bodyRows = [
      row("障害種別", c.disabilityType),
      row("障害特性", c.characteristics),
      row("本人の困りごと", c.concerns),
      row("保護者の希望", c.parentWishes),
      row("学校での様子", c.schoolSituation),
      row("家庭での様子", c.homeLife),
      row("本人の強み", c.strengths),
      row("前回振り返り", c.previousIspReview),
      row("職員所見", c.staffObservations),
    ].filter(Boolean).join("");
  } else if(rec.docType === "weekly_plan"){
    const slots = c.slots||[];
    const slotRows = slots.filter(s=>s.attend).map(s=>`
      <tr>
        <td style="border:1px solid #ccc;padding:6px 8px;font-size:12px;font-weight:700;background:#f5f5f5;width:60px;text-align:center;">${s.day}曜</td>
        <td style="border:1px solid #ccc;padding:6px 8px;font-size:11px;">${s.time||""}</td>
        <td style="border:1px solid #ccc;padding:6px 8px;font-size:11px;white-space:pre-wrap;">${s.activities||""}</td>
        <td style="border:1px solid #ccc;padding:6px 8px;font-size:11px;white-space:pre-wrap;">${s.goals||""}</td>
        <td style="border:1px solid #ccc;padding:6px 8px;font-size:11px;white-space:pre-wrap;">${s.notes||""}</td>
      </tr>`).join("");
    bodyRows = `<tr style="background:#f5f5f5;">
      <th style="border:1px solid #ccc;padding:5px;font-size:11px;">曜日</th>
      <th style="border:1px solid #ccc;padding:5px;font-size:11px;">時間帯</th>
      <th style="border:1px solid #ccc;padding:5px;font-size:11px;">活動内容</th>
      <th style="border:1px solid #ccc;padding:5px;font-size:11px;">支援目標</th>
      <th style="border:1px solid #ccc;padding:5px;font-size:11px;">特記事項</th>
    </tr>${slotRows}`;
    if(c.staffNote) bodyRows += row("職員全体方針", c.staffNote);
  } else if(rec.docType === "monitoring"){
    bodyRows = [
      row("実施日", c.monitoringDate||c.date),
      row("対象期間", c.targetPeriod),
      row("担当者", c.responsibleStaff),
      row("児発管名", c.cdsmName),
      row("長期目標達成状況", c.longGoalResult),
      row("短期目標達成状況", c.shortGoalResult),
      row("できるようになったこと", c.achievedItems),
      row("残る課題", c.remainingChallenges),
      row("支援変更案", c.supportChanges),
      row("次回計画への反映", c.nextPlanReflection),
      row("保護者意見", c.parentOpinion),
      row("職員所見", c.staffObservation),
      row("総合評価", c.overallEval),
    ].filter(Boolean).join("");
  } else if(rec.docType === "meeting"){
    bodyRows = [
      row("会議種別", c.meetingType),
      row("開催日", c.date),
      row("場所", c.location),
      row("出席者", c.attendees),
      row("議題", c.agenda),
      row("討議内容", c.discussion),
      row("決定事項", c.decisions),
      row("次回予定", c.nextMeeting),
    ].filter(Boolean).join("");
  } else if(rec.docType === "consent"){
    bodyRows = [
      row("説明日", c.explanationDate||c.date),
      row("説明者", c.explainedBy),
      row("保護者名", c.parentName),
      row("続柄", c.relationship),
      row("同意文書", c.consentContent),
      row("署名日", c.parentSignedAt),
      row("備考", c.notes),
    ].filter(Boolean).join("");
  } else {
    // 未知のdocTypeは全フィールドを汎用表示
    bodyRows = Object.entries(c).filter(([k,v])=>v&&k!=="generatedFrom").map(([k,v])=>row(k,v)).join("");
  }

  // 署名欄（全docTypeに共通）
  const signArea = `
  <table style="width:100%;border-collapse:collapse;margin-top:18px;">
    <tr>
      <td style="border:1px solid #ccc;padding:14px 12px;font-size:11px;width:50%;">
        説明・同意日　　令和　　年　　月　　日<br/><br/>
        保護者氏名　　　　　　　　　　　　　　㊞
      </td>
      <td style="border:1px solid #ccc;padding:14px 12px;font-size:11px;">
        ${facilityName}<br/><br/>
        児童発達支援管理責任者　${c.cdsmName||c.explainedBy||""}　　㊞
      </td>
    </tr>
  </table>`;

  const html = `<div style="font-family:'Noto Sans JP',sans-serif;max-width:760px;margin:0 auto;padding:24px 20px;">
    ${header}
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      ${bodyRows}
    </table>
    ${rec.docType==="isp_plan"||rec.docType==="consent"||rec.docType==="monitoring" ? signArea : ""}
  </div>`;

  printHTML(html, `${docLabel}_${u.name}_${(rec.content?.validFrom||rec.content?.date||rec.createdAt||"").slice(0,10)}`);
}

// ─── ISP全書類 一括印刷（利用者の全確定書類をまとめてA4印刷）───
function printIspAllRecords(myRecs, u, facilityName){
  const statusLabels = {
    ai_draft:"AI原案",staff_checked:"職員確認済",cdsm_approved:"児発管承認",
    manager_confirmed:"管理者確認",parent_explained:"保護者説明済",
    parent_consented:"保護者同意済",finalized:"確定"
  };
  const docLabel = {
    isp_plan:"個別支援計画書", assessment:"アセスメント記録票",
    weekly_plan:"週間支援計画", monitoring:"モニタリング記録",
    meeting:"支援会議記録", consent:"保護者同意書"
  };

  const docOrder = ["assessment","isp_plan","weekly_plan","monitoring","meeting","consent"];
  const sortedRecs = [...myRecs].sort((a,b)=>{
    const ai = docOrder.indexOf(a.docType); const bi = docOrder.indexOf(b.docType);
    if(ai!==bi) return ai-bi;
    return a.createdAt > b.createdAt ? -1 : 1;
  });

  if(sortedRecs.length===0){ alert("印刷できる書類がありません"); return; }

  const pages = sortedRecs.map((rec,idx)=>{
    const c = rec.content||{};
    const label = docLabel[rec.docType]||rec.docType;
    const status = statusLabels[rec.status]||rec.status;
    const pb = idx<sortedRecs.length-1 ? `<div style="page-break-after:always;"></div>` : "";

    const fieldMap = {
      isp_plan:["validFrom:計画開始日","validTo:計画終了日","supportPeriod:支援期間","userNeeds:本人のニーズ","parentNeeds:保護者のニーズ","longGoal:長期目標","longGoalTerm:長期目標期間","shortGoal:短期目標","shortGoalTerm:短期目標期間","supportContent:支援内容","specificMethods:具体的な手立て","staffInCharge:担当者","cdsmName:児発管","frequency:支援頻度","achievementDate:達成時期","evaluationMethod:評価方法","reviewDate:見直し予定日"],
      assessment:["disabilityType:障害種別","characteristics:障害特性","concerns:本人の困りごと","parentWishes:保護者の希望","schoolSituation:学校での様子","homeLife:家庭での様子","strengths:強み","previousIspReview:前回振り返り","staffObservations:職員所見"],
      monitoring:["monitoringDate:実施日","targetPeriod:対象期間","responsibleStaff:担当","longGoalResult:長期目標達成状況","shortGoalResult:短期目標達成状況","achievedItems:できるようになったこと","remainingChallenges:残る課題","supportChanges:支援変更案","nextPlanReflection:次回反映","parentOpinion:保護者意見","overallEval:総合評価"],
      meeting:["date:開催日","meetingType:会議種別","location:場所","attendees:出席者","agenda:議題","discussion:討議内容","decisions:決定事項","nextMeeting:次回予定"],
      consent:["date:説明日","explainedBy:説明者","parentName:保護者名","relationship:続柄","consentContent:同意内容","parentSignedAt:署名日"],
      weekly_plan:["staffNote:職員全体方針"],
    };
    const fields = fieldMap[rec.docType]||[];
    const rows = fields.map(f=>{
      const [key,lbl]=f.split(":");
      const val=c[key];
      if(!val) return "";
      return `<tr><td style="border:1px solid #ccc;padding:5px 7px;font-size:10px;font-weight:700;background:#f5f5f5;width:130px;white-space:nowrap;">${lbl}</td><td style="border:1px solid #ccc;padding:5px 7px;font-size:11px;white-space:pre-wrap;">${String(val).replace(/</g,"&lt;").replace(/>/g,"&gt;")}</td></tr>`
    }).join("");

    return `<div style="font-family:'Noto Sans JP',sans-serif;padding:20px 18px;">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #3aa0d8;padding-bottom:8px;margin-bottom:12px;">
        <div>
          <span style="font-size:17px;font-weight:900;">${label}</span>
          <span style="margin-left:10px;font-size:10px;color:#888;border:1px solid #ccc;border-radius:4px;padding:2px 7px;">${status}</span>
        </div>
        <div style="text-align:right;font-size:11px;color:#555;">
          <span style="font-weight:700;">${u.name}</span> 　${u.grade||""}　${facilityName}
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">${rows}</table>
      <div style="font-size:10px;color:#aaa;text-align:right;margin-top:8px;">作成: ${rec.createdBy||""}　${(rec.createdAt||"").slice(0,10)}</div>
    </div>${pb}`;
  }).join("");

  printHTML(`<div>${pages}</div>`, `ISP全書類_${u.name}_${new Date().toLocaleDateString("ja-JP")}`);
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
/* ===== サービス種別バッジ ===== */
.svc-badge{display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:10px;font-size:10px;font-weight:700;border:1px solid transparent;}
.svc-houkago{background:rgba(58,160,216,0.18);color:#2070a0;border-color:rgba(58,160,216,0.4);}
.svc-jidouhattatsu{background:rgba(240,112,32,0.18);color:#c05000;border-color:rgba(240,112,32,0.4);}
.svc-hoikuvisit{background:rgba(44,170,96,0.18);color:#1a7040;border-color:rgba(44,170,96,0.4);}
/* ===== 訪問支援 ===== */
.visit-card{background:var(--wh);border:1px solid var(--bd);border-radius:12px;padding:14px;margin-bottom:9px;cursor:pointer;transition:all .15s;box-shadow:var(--sh);}
.visit-card:hover{border-color:var(--gr2);box-shadow:var(--sh2);}
.visit-dest-card{background:var(--wh);border:1px solid var(--bd);border-radius:11px;padding:13px;margin-bottom:8px;box-shadow:var(--sh);}
.visit-report{background:var(--bg3);border:1px solid var(--bd);border-radius:10px;padding:12px;margin-top:10px;}
/* ===== 発達記録 ===== */
.dev-domain{background:var(--bg3);border:1.5px solid var(--bd);border-radius:9px;padding:10px 12px;margin-bottom:8px;cursor:pointer;transition:all .13s;}
.dev-domain.on{border-color:var(--ac);background:rgba(240,112,32,0.08);}
.dev-record-card{background:var(--wh);border:1px solid var(--bd);border-radius:11px;padding:13px;margin-bottom:8px;box-shadow:var(--sh);}
/* ===== 保護者支援 ===== */
.ps-card{background:var(--wh);border:1px solid var(--bd);border-radius:11px;padding:13px;margin-bottom:8px;box-shadow:var(--sh);}
/* ===== 報酬マスタ表 ===== */
.reward-table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px;}
.reward-table th{padding:7px 10px;background:var(--bg3);font-size:10px;font-weight:700;color:var(--tx2);text-align:left;border-bottom:2px solid var(--bd);}
.reward-table td{padding:8px 10px;border-bottom:1px solid var(--bd);color:var(--tx);}
.reward-table tr:hover td{background:var(--bg3);}
/* ===== OCR・受給者証・相談支援原案 ===== */
.ocr-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;display:flex;align-items:flex-end;justify-content:center;}
.ocr-modal{background:var(--wh);border-radius:18px 18px 0 0;padding:20px 16px 32px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;}
.ocr-preview{width:100%;max-height:220px;object-fit:contain;border-radius:10px;margin:10px 0;border:1px solid var(--bd);}
.ocr-result-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--bd);gap:8px;}
.ocr-result-label{font-size:11px;font-weight:700;color:var(--tx2);min-width:110px;flex-shrink:0;}
.ocr-result-val{font-size:13px;color:var(--tx);text-align:right;flex:1;}
.ocr-badge-ok{display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:8px;font-size:10px;font-weight:700;background:rgba(44,170,96,0.18);color:var(--gr2);border:1px solid rgba(44,170,96,0.4);}
.ocr-badge-warn{display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:8px;font-size:10px;font-weight:700;background:rgba(224,168,40,0.18);color:#8a6200;border:1px solid rgba(224,168,40,0.4);}
.ocr-badge-err{display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:8px;font-size:10px;font-weight:700;background:rgba(224,56,56,0.15);color:var(--ro);border:1px solid rgba(224,56,56,0.4);}
.jukyusha-card{background:var(--wh);border:1.5px solid var(--bd);border-radius:12px;padding:14px;margin-bottom:10px;box-shadow:var(--sh);transition:all .15s;}
.jukyusha-card.expired{border-color:rgba(224,56,56,0.5);background:rgba(224,56,56,0.04);}
.jukyusha-card.expiring{border-color:rgba(224,168,40,0.5);background:rgba(224,168,40,0.04);}
.soudan-card{background:var(--wh);border:1.5px solid var(--bd);border-radius:12px;padding:14px;margin-bottom:10px;box-shadow:var(--sh);}
.soudan-goal-box{background:var(--bg3);border-radius:9px;padding:10px 12px;margin-bottom:8px;font-size:12px;line-height:1.6;}
.timeline-item{display:flex;gap:12px;margin-bottom:0;position:relative;}
.timeline-item::before{content:"";position:absolute;left:18px;top:36px;bottom:-8px;width:2px;background:var(--bd);}
.timeline-item:last-child::before{display:none;}
.timeline-dot{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;border:2px solid var(--wh);box-shadow:0 0 0 2px var(--bd);}
.timeline-body{flex:1;background:var(--wh);border:1px solid var(--bd);border-radius:10px;padding:10px 12px;margin-bottom:8px;box-shadow:var(--sh);}
.timeline-date{font-size:10px;color:var(--tx3);font-weight:700;margin-bottom:3px;}
.timeline-title{font-size:13px;font-weight:700;color:var(--tx);margin-bottom:2px;}
.timeline-sub{font-size:11px;color:var(--tx2);line-height:1.5;}
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
  // 送迎ルートデータ（ルートごとに停留所リストを管理）
  const [routes, setRoutes] = useState([
    {id:"rt1",facilityId:"f1",name:"ルートA（午後）",direction:"来所",driver:"田中 美穂",vehicle:"白いワンボックス",color:"#3aa0d8",
      stops:[
        {order:1,userId:"u1",userName:"利用者 A",address:"〇〇市△△1-2-3",estimatedTime:"14:00",note:""},
        {order:2,userId:"u3",userName:"利用者 C",address:"〇〇市△△4-5-6",estimatedTime:"14:15",note:""},
      ]},
    {id:"rt2",facilityId:"f1",name:"ルートA（帰宅）",direction:"退所",driver:"田中 美穂",vehicle:"白いワンボックス",color:"#2caa60",
      stops:[
        {order:1,userId:"u3",userName:"利用者 C",address:"〇〇市△△4-5-6",estimatedTime:"17:30",note:""},
        {order:2,userId:"u1",userName:"利用者 A",address:"〇〇市△△1-2-3",estimatedTime:"17:45",note:""},
      ]},
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
  // 記録を完全削除（Supabaseからも削除）
  const delRec = (id) => {
    setRecs(p=>p.filter(r=>r.id!==id));
    sbDelete("records", id);
  };
  const setShift = (sid,date,type) => {setShifts(p=>({...p,[sid]:{...(p[sid]||{}),[date]:type}}));sbSave("shifts",{id:sid+"_"+date,staff_id:sid,date:date,shift_type:type});};
  const getShift = (sid,date) => shifts[sid]?.[date]||"none";
  const setAtt = (uid,date,status) => {
    setAtt2(p=>({...p,[uid]:{...(p[uid]||{}),[date]:status}}));
    sbSave("att_data", {id:uid+"_"+date, user_id:uid, att_date:date, status, data:{userId:uid,date,status}});
  };
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
  // メッセージのプロパティを任意に更新（parentRead管理など）
  const updMsg = (id, changes) => setMsgs(p=>p.map(m=>{
    if(m.id!==id) return m;
    const updated={...m,...changes};
    sbSave("messages",{id:updated.id,user_id:updated.userId,user_name:updated.userName,
      facility_id:updated.facilityId,from_name:updated.from,body:updated.body,
      time:updated.time,read:updated.read,replies:updated.replies||[],data:updated});
    return updated;
  }));
  const updTr = data => { setTrData(data); data.forEach(t=>sbSave("transport_data",{id:t.id,facility_id:t.facilityId||null,data:t})); };
  // ─ 送迎ルートCRUD ─
  const addRoute = r => setRoutes(p=>[...p,r]);
  const updRoute = (id,ch) => setRoutes(p=>p.map(r=>r.id===id?{...r,...ch}:r));
  const delRoute = id => setRoutes(p=>p.filter(r=>r.id!==id));
  const addIsp = isp => {
    setIsps(p=>[...p,isp]);
    sbSave("isps", {id:isp.id, facility_id:isp.facilityId||null, user_id:isp.userId||null, data:isp});
  };
  const updIsp = (id,ch) => setIsps(p=>p.map(x=>{
    if(x.id!==id) return x;
    const u={...x,...ch};
    sbSave("isps", {id, facility_id:u.facilityId||null, user_id:u.userId||null, data:u});
    return u;
  }));
  const updKokuho = (id,ch) => setKokuho(p=>p.map(x=>{
    if(x.id!==id) return x;
    const u={...x,...ch};
    sbSave("kokuho_data", {
      id,
      facility_id:    u.facilityId || null,
      user_id:        u.userId     || null,
      year:           u.year       || null,
      month:          u.month      || null,
      service_days:   u.serviceDays   || 0,
      transport_days: u.transportDays || 0,
      billing_status: u.billingStatus || "未請求",
      updated_at:     new Date().toISOString(),
      data:           u
    });
    return u;
  }));
  // 新規請求レコード追加（確定日報から自動生成時に使用）
  const addKokuho = k => {
    setKokuho(p=>[...p,k]);
    sbSave("kokuho_data", {
      id:             k.id,
      facility_id:    k.facilityId || null,
      user_id:        k.userId || null,            // ★明示カラム
      year:           k.year   || null,            // ★明示カラム
      month:          k.month  || null,            // ★明示カラム
      service_days:   k.serviceDays   || 0,        // ★明示カラム
      transport_days: k.transportDays || 0,        // ★明示カラム
      billing_status: k.billingStatus || "未請求", // ★明示カラム
      updated_at:     new Date().toISOString(),
      data:           k
    });
  };

  // ============================================================
  // 全体パイプライン同期
  // ISP → 実績(recs) → 日報(dailyReports) → 請求(kokuho)
  // 呼び出し元: 日報確定・月次請求画面・手動ボタン
  // ============================================================
  const fullPipelineSync = (facilityId, yearMonth, city="その他") => {
    const [y, m] = yearMonth.split("-").map(Number);
    const ISP_BILLING_STAT = ["finalized","parent_consented","manager_confirmed"];

    // ── Step1: 実績レコード（recs）から来所日数・送迎日数を集計 ──
    const monthRecs = recs.filter(r=>
      r.facilityId===facilityId &&
      (r.time||"").slice(0,7)===yearMonth &&
      r.type==="service"
    );
    // ── Step2: 確定日報からも補完（実績レコードにない日を拾う） ──
    const confirmedReps = dailyReports.filter(r=>
      r.facilityId===facilityId &&
      r.date.startsWith(yearMonth) &&
      (r.status==="確認済"||r.status==="確定")
    );

    // userId → {days:Set<date>, transportDays, ispId}
    const attendMap = {};
    const ensure = (uid, name) => {
      if(!attendMap[uid]) attendMap[uid]={userId:uid,userName:name,days:new Set(),transportDays:0,ispId:""};
    };

    // 実績レコードから
    monthRecs.forEach(r=>{
      ensure(r.userId, r.userName||"");
      const d=(r.time||"").slice(0,10);
      if(d) attendMap[r.userId].days.add(d);
      if(r.transport==="あり") attendMap[r.userId].transportDays++;
      if(r.ispId&&!attendMap[r.userId].ispId) attendMap[r.userId].ispId=r.ispId;
    });
    // 確定日報から（実績にない日を補完）
    confirmedReps.forEach(rep=>{
      (rep.userList||[]).filter(u=>u.status==="出席"||u.status==="早退").forEach(u=>{
        ensure(u.id||u.userId, u.name||u.userName||"");
        const uid=u.id||u.userId;
        if(rep.date&&!attendMap[uid].days.has(rep.date)){
          attendMap[uid].days.add(rep.date);
          if(u.transport==="あり"||u.transport==="送迎") attendMap[uid].transportDays++;
        }
      });
    });

    let synced=0;
    Object.values(attendMap).forEach(agg=>{
      const days=agg.days.size;
      if(days===0) return;

      // ISP状態から加算を自動設定
      const activeIsp=(ispRecords||[])
        .filter(r=>r.userId===agg.userId&&r.docType==="isp_plan"&&ISP_BILLING_STAT.includes(r.status))
        .sort((a,b)=>b.createdAt>a.createdAt?1:-1)[0];

      const ex=kokuho.find(k=>
        k.userId===agg.userId&&k.facilityId===facilityId&&k.year===y&&k.month===m
      );
      let newAddons=[...(ex?.addons||[])];

      // 送迎加算を自動追加（往復）
      if(agg.transportDays>0&&!newAddons.some(a=>a.key?.startsWith("tr_"))){
        const tr=ADDON_MASTER.find(a=>a.key==="tr_both");
        if(tr) newAddons.push({...tr,autoAdded:true,autoAddedAt:new Date().toISOString()});
      }
      // 個別サポート加算を自動追加（ISP確定済み）
      if(activeIsp&&!newAddons.some(a=>a.key==="indiv")){
        const ind=ADDON_MASTER.find(a=>a.key==="indiv");
        if(ind) newAddons.push({...ind,autoAdded:true,ispId:activeIsp.id,autoAddedAt:new Date().toISOString()});
      }

      if(ex){
        updKokuho(ex.id,{
          serviceDays:days,
          transportDays:agg.transportDays,
          addons:newAddons,
          lastSyncedAt:new Date().toISOString(),
          lastSyncedFrom:"pipeline",
        });
      } else {
        addKokuho({
          id:genId(),userId:agg.userId,userName:agg.userName,
          facilityId,year:y,month:m,
          serviceDays:days,transportDays:agg.transportDays,
          serviceCode:"6612B",unitPrice:530,timeType:"放課後",
          addons:newAddons,city,status:"未請求",
          lastSyncedAt:new Date().toISOString(),lastSyncedFrom:"pipeline",
        });
      }
      synced++;
    });
    return synced;
  };

  const [dynUsers, setDynUsers] = useState(INITIAL_USERS);
  const [dynStaff, setDynStaff] = useState(INITIAL_STAFF);
  const [dailyReports, setDailyReports] = useState([]);
  const saveFS = fs => {
    setFacesheets(p=>[...p.filter(x=>x.userId!==fs.userId),fs]);
    sbSave("facesheets", {id:fs.userId, facility_id:fs.facilityId||null, user_id:fs.userId||null, updated_at:new Date().toISOString(), data:fs});
  };
  const addAssessment = a => {
    setAssessments(p=>[...p,a]);
    sbSave("assessments", {id:a.id, facility_id:a.facilityId||null, user_id:a.userId||null, assessor:a.assessor||null, assess_date:a.date||null, data:a});
  };
  const addMonitoring = m => {
    setMonitorings(p=>[...p,m]);
    sbSave("monitorings", {id:m.id, facility_id:m.facilityId||null, user_id:m.userId||null, staff_id:m.staffId||null, monitoring_date:m.date||null, data:m});
  };
  const updAssessment = (id,ch) => setAssessments(p=>p.map(a=>{
    if(a.id!==id) return a;
    const u={...a,...ch};
    sbSave("assessments", {id, facility_id:u.facilityId||null, user_id:u.userId||null, assessor:u.assessor||null, assess_date:u.date||null, data:u});
    return u;
  }));
  const updMonitoring = (id,ch) => setMonitorings(p=>p.map(m=>{
    if(m.id!==id) return m;
    const u={...m,...ch};
    sbSave("monitorings", {id, facility_id:u.facilityId||null, user_id:u.userId||null, staff_id:u.staffId||null, monitoring_date:u.date||null, data:u});
    return u;
  }));

  const addDailyReport = r => {
    setDailyReports(p=>[...p.filter(x=>!(x.date===r.date&&x.facilityId===r.facilityId)),r]);
    sbSave("daily_reports", {id: r.date+"_"+r.facilityId, facility_id: r.facilityId, date: r.date, data: r});
  };
  const addUser = u => {
    setDynUsers(p=>[...p,u]);
    // 明示カラム + JSONB data で保存（国保請求・監査・ISP連携に対応）
    sbSave("users_data", {
      id:              u.id,
      facility_id:     u.facilityId,
      name:            u.name || null,
      name_kana:       u.nameKana || null,
      jukyusha_no:     u.jukyushaNo || null,
      jukyusha_expiry: u.jukyushaExpiry || null,
      jukyusha_city:   u.jukyushaCity || null,
      service_type:    u.serviceType || "放デイ",
      active:          u.active !== false,
      enroll_date:     u.enrollDate || null,
      updated_at:      new Date().toISOString(),
      data:            u
    });
  };
  const updUser2 = (id,ch) => {
    setDynUsers(p=>p.map(u=>{
      if(u.id!==id) return u;
      const updated = {...u,...ch};
      sbSave("users_data", {
        id,
        facility_id:     updated.facilityId,
        name:            updated.name || null,
        name_kana:       updated.nameKana || null,
        jukyusha_no:     updated.jukyushaNo || null,
        jukyusha_expiry: updated.jukyushaExpiry || null,
        jukyusha_city:   updated.jukyushaCity || null,
        service_type:    updated.serviceType || "放デイ",
        active:          updated.active !== false,
        enroll_date:     updated.enrollDate || null,
        updated_at:      new Date().toISOString(),
        data:            updated
      });
      return updated;
    }));
  };
  const addStaff = s => {
    setDynStaff(p=>[...p,s]);
    // 明示カラム + JSONB data で保存（シフト・資格・監査連携に対応）
    sbSave("staff_data", {
      id:              s.id,
      facility_id:     s.facilityId,
      name:            s.name || null,
      name_kana:       s.nameKana || null,
      role:            s.role || "staff",
      employment_type: s.employmentType || "正社員",
      active:          s.active !== false,
      hire_date:       s.hireDate || null,
      updated_at:      new Date().toISOString(),
      data:            s
    });
  };
  const updStaff2 = (id,ch) => {
    setDynStaff(p=>p.map(s=>{
      if(s.id!==id) return s;
      const updated = {...s,...ch};
      sbSave("staff_data", {
        id,
        facility_id:     updated.facilityId,
        name:            updated.name || null,
        name_kana:       updated.nameKana || null,
        role:            updated.role || "staff",
        employment_type: updated.employmentType || "正社員",
        active:          updated.active !== false,
        hire_date:       updated.hireDate || null,
        updated_at:      new Date().toISOString(),
        data:            updated
      });
      return updated;
    }));
  };
  const [qualDocs, setQualDocs] = useState([]);
  const addQualDoc = d => {
    setQualDocs(p=>[...p,d]);
    sbSave("qual_docs", {id:d.id, facility_id:d.facilityId||null, staff_id:d.staffId||null, data:d});
  };
  const updQualDoc = (id,ch) => setQualDocs(p=>p.map(d=>{
    if(d.id!==id) return d;
    const u={...d,...ch};
    sbSave("qual_docs", {id, facility_id:u.facilityId||null, staff_id:u.staffId||null, data:u});
    return u;
  }));
  const delQualDoc = id => { setQualDocs(p=>p.filter(d=>d.id!==id)); sbDelete("qual_docs",id); };
  const delStaff = id => { setDynStaff(p=>p.filter(s=>s.id!==id)); sbDelete("staff_data",id); };
  const delUser = id => { setDynUsers(p=>p.filter(u=>u.id!==id)); sbDelete("users_data",id); };
  const [paidLeaveReqs, setPaidLeaveReqs] = useState([]);
  const addPaidLeaveReq = r => {
    setPaidLeaveReqs(p=>[...p,r]);
    sbSave("paid_leave_reqs", {id:r.id, facility_id:r.facilityId||null, staff_id:r.staffId||null, leave_date:r.leaveDate||r.date||null, status:r.status||"申請中", data:r});
  };const [scheduleData, setScheduleData] = useState({});
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
  
  const updPaidLeaveReq = (id,ch) => setPaidLeaveReqs(p=>p.map(r=>{
    if(r.id!==id) return r;
    const u={...r,...ch};
    sbSave("paid_leave_reqs", {id, facility_id:u.facilityId||null, staff_id:u.staffId||null, leave_date:u.leaveDate||u.date||null, status:u.status||"申請中", data:u});
    return u;
  }));
  const [ispDrafts, setIspDrafts] = useState([]);
  const addIspDraft = d => {
    setIspDrafts(p=>[...p,d]);
    sbSave("isp_drafts", {id:d.id, facility_id:d.facilityId||null, user_id:d.userId||null, updated_at:new Date().toISOString(), data:d});
  };
  const updIspDraft = (id,ch) => setIspDrafts(p=>p.map(d=>{
    if(d.id!==id) return d;
    const u={...d,...ch};
    sbSave("isp_drafts", {id, facility_id:u.facilityId||null, user_id:u.userId||null, updated_at:new Date().toISOString(), data:u});
    return u;
  }));
  const delIspDraft = id => { setIspDrafts(p=>p.filter(d=>d.id!==id)); sbDelete("isp_drafts",id); };
  // ─── 個別支援計画 統合管理レコード ───
  const [ispRecords, setIspRecords] = useState([]);
  const addIspRecord = r => {
    setIspRecords(p=>[...p,r]);
    sbSave("isp_records", {
      id:          r.id,
      facility_id: r.facilityId || null,
      user_id:     r.userId     || null,   // ★明示カラム（国保・監査で検索可能に）
      doc_type:    r.docType    || null,   // ★明示カラム
      status:      r.status     || "ai_draft", // ★明示カラム
      updated_at:  new Date().toISOString(),
      data:        r
    });
  };
  const updIspRecord = (id,ch) => setIspRecords(p=>p.map(x=>{
    if(x.id!==id) return x;
    const u={...x,...ch};
    sbSave("isp_records", {
      id,
      facility_id: u.facilityId || null,
      user_id:     u.userId     || null,
      doc_type:    u.docType    || null,
      status:      u.status     || null,
      updated_at:  new Date().toISOString(),
      data:        u
    });
    return u;
  }));
  // ─── 日々のモニタリング蓄積ノート（ISP連携サービス記録から自動生成） ───
  const [monitoringNotes, setMonitoringNotes] = useState([]);
  const addMonitoringNote = n => {
    setMonitoringNotes(p=>[...p,n]);
    sbSave("monitoring_notes", {
      id:          n.id,
      facility_id: n.facilityId || null,
      user_id:     n.userId     || null,   // ★明示カラム（モニタリング作成時に集計可能）
      isp_id:      n.ispId      || null,   // ★明示カラム
      note_date:   n.date       || null,   // ★明示カラム
      data:        n
    });
  };
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
  // ─── 訪問先マスタ（保育所等訪問支援） ───
  const [visitDests, setVisitDests] = useState([
    {id:"vd1",facilityId:"f3",name:"ひかり保育園",type:"保育園",address:"静岡市〇〇1-2-3",contactPerson:"鈴木先生",phone:"054-000-0001",note:""},
    {id:"vd2",facilityId:"f3",name:"みどり小学校",type:"小学校",address:"静岡市〇〇4-5-6",contactPerson:"田中先生",phone:"054-000-0002",note:""},
  ]);
  const addVisitDest = d => { setVisitDests(p=>[...p,d]); sbSave("visit_dests",{id:d.id,facility_id:d.facilityId,data:d}); };
  const updVisitDest = (id,ch) => setVisitDests(p=>p.map(d=>{ if(d.id!==id) return d; const u={...d,...ch}; sbSave("visit_dests",{id,facility_id:u.facilityId,data:u}); return u; }));
  const delVisitDest = id => { setVisitDests(p=>p.filter(d=>d.id!==id)); sbDelete("visit_dests",id); };

  // ─── 訪問記録（保育所等訪問支援） ───
  const [visitRecords, setVisitRecords] = useState([]);
  const addVisitRecord = r => { setVisitRecords(p=>[...p,r]); sbSave("visit_records",{id:r.id,facility_id:r.facilityId,user_id:r.userId||null,visit_date:r.date,data:r}); };
  const updVisitRecord = (id,ch) => setVisitRecords(p=>p.map(r=>{ if(r.id!==id) return r; const u={...r,...ch}; sbSave("visit_records",{id,facility_id:u.facilityId,user_id:u.userId||null,visit_date:u.date,data:u}); return u; }));
  const delVisitRecord = id => { setVisitRecords(p=>p.filter(r=>r.id!==id)); sbDelete("visit_records",id); };

  // ─── 発達段階記録（児童発達支援） ───
  const [devRecords, setDevRecords] = useState([]);
  const addDevRecord = r => { setDevRecords(p=>[...p,r]); sbSave("dev_records",{id:r.id,facility_id:r.facilityId,user_id:r.userId,record_date:r.date,data:r}); };
  const updDevRecord = (id,ch) => setDevRecords(p=>p.map(r=>{ if(r.id!==id) return r; const u={...r,...ch}; sbSave("dev_records",{id,facility_id:u.facilityId,user_id:u.userId,record_date:u.date,data:u}); return u; }));
  const delDevRecord = id => { setDevRecords(p=>p.filter(r=>r.id!==id)); sbDelete("dev_records",id); };

  // ─── 保護者支援記録（児童発達支援） ───
  const [parentSupportRecords, setParentSupportRecords] = useState([]);
  const addParentSupportRecord = r => { setParentSupportRecords(p=>[...p,r]); sbSave("parent_support_records",{id:r.id,facility_id:r.facilityId,user_id:r.userId,record_date:r.date,data:r}); };
  const updParentSupportRecord = (id,ch) => setParentSupportRecords(p=>p.map(r=>{ if(r.id!==id) return r; const u={...r,...ch}; sbSave("parent_support_records",{id,facility_id:u.facilityId,user_id:u.userId,record_date:u.date,data:u}); return u; }));
  const delParentSupportRecord = id => { setParentSupportRecords(p=>p.filter(r=>r.id!==id)); sbDelete("parent_support_records",id); };

  // ─── 受給者証OCR履歴 ───
  const [jukyushaDocs, setJukyushaDocs] = useState([]);
  const addJukyushaDoc = d => {
    setJukyushaDocs(p=>[...p,d]);
    sbSave("jukyusha_docs",{id:d.id,facility_id:d.facilityId,user_id:d.userId,expiry_date:d.expiryDate||null,jukyusha_no:d.jukyushaNo||null,status:d.status||"有効",data:d});
  };
  const updJukyushaDoc = (id,ch) => setJukyushaDocs(p=>p.map(d=>{ if(d.id!==id) return d; const u={...d,...ch}; sbSave("jukyusha_docs",{id,facility_id:u.facilityId,user_id:u.userId,expiry_date:u.expiryDate||null,jukyusha_no:u.jukyushaNo||null,status:u.status||"有効",data:u}); return u; }));
  const delJukyushaDoc = id => { setJukyushaDocs(p=>p.filter(d=>d.id!==id)); sbDelete("jukyusha_docs",id); };

  // ─── 相談支援原案 ───
  const [soudanGenans, setSoudanGenans] = useState([]);
  const addSoudanGenan = g => {
    setSoudanGenans(p=>[...p,g]);
    sbSave("soudan_genans",{id:g.id,facility_id:g.facilityId,user_id:g.userId,received_date:g.receivedDate||null,specialist_name:g.specialistName||null,plan_period_end:g.planPeriodEnd||null,data:g});
  };
  const updSoudanGenan = (id,ch) => setSoudanGenans(p=>p.map(g=>{ if(g.id!==id) return g; const u={...g,...ch}; sbSave("soudan_genans",{id,facility_id:u.facilityId,user_id:u.userId,received_date:u.receivedDate||null,specialist_name:u.specialistName||null,plan_period_end:u.planPeriodEnd||null,data:u}); return u; }));
  const delSoudanGenan = id => { setSoudanGenans(p=>p.filter(g=>g.id!==id)); sbDelete("soudan_genans",id); };

  // ─── トースト通知 ───
  const [toastMsg, setToastMsg] = useState("");
  const [toastType, setToastType] = useState("success");
  const showToast = (msg, type="success") => {
    setToastMsg(msg); setToastType(type);
    setTimeout(()=>setToastMsg(""), 3000);
  };
  return {recs,addRec,updRec,delRec,hist,shifts,setShift,getShift,att,setAtt,getAtt,msgs,addMsg,replyMsg,markRead,updMsg,trData,updTr,routes,addRoute,updRoute,delRoute,isps,addIsp,updIsp,kokuho,addKokuho,updKokuho,fullPipelineSync,facesheets,saveFS,assessments,addAssessment,updAssessment,monitorings,addMonitoring,updMonitoring,dailyReports,addDailyReport,dynUsers,addUser,updUser2,delUser,dynStaff,addStaff,updStaff2,delStaff,paidLeaveReqs,addPaidLeaveReq,updPaidLeaveReq,qualDocs,addQualDoc,updQualDoc,delQualDoc,scheduleData,setScheduleData,saveScheduleRow,ispDrafts,addIspDraft,updIspDraft,delIspDraft,ispRecords,addIspRecord,updIspRecord,monitoringNotes,addMonitoringNote,facilityBillingSettings,saveFacilityBillingSetting,staffConfigs,saveStaffConfig,getStaffConfig,billingStatus,saveBillingStatus,showToast,toastMsg,toastType,visitDests,addVisitDest,updVisitDest,delVisitDest,visitRecords,addVisitRecord,updVisitRecord,delVisitRecord,devRecords,addDevRecord,updDevRecord,delDevRecord,parentSupportRecords,addParentSupportRecord,updParentSupportRecord,delParentSupportRecord,jukyushaDocs,addJukyushaDoc,updJukyushaDoc,delJukyushaDoc,soudanGenans,addSoudanGenan,updSoudanGenan,delSoudanGenan};
}


// ==================== IME対応 テキスト入力ヘルパー ====================
// 日本語入力（IME変換中）にReactのcontrolled inputが確定してしまう問題を防ぐ。
// 使い方: const imeProps = useImeInput(value, onChange);
//         <input {...imeProps} className="fi" />
//         <textarea {...imeProps} className="fta" />
function useImeInput(value, onChange) {
  const composingRef = useRef(false);
  return {
    value: value||"",
    onChange: e => { if(!composingRef.current) onChange(e.target.value); },
    onCompositionStart: () => { composingRef.current = true; },
    onCompositionEnd: e => { composingRef.current = false; onChange(e.target.value); },
  };
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
function LoginScreen({onLogin, store}){
  const [un,setUn]=useState(""); const [pw,setPw]=useState(""); const [fac,setFac]=useState("f1"); const [err,setErr]=useState("");
  const go=()=>{
    // 1) 固定アカウント（デモ・管理者）で検索
    let a=ACCOUNTS.find(x=>x.username===un&&x.password===pw);
    // 2) なければdynStaff（スタッフ管理で登録した職員）で検索
    if(!a && store){
      const ds=(store.dynStaff||[]).find(s=>s.loginId&&s.loginId===un&&s.loginPassword===pw&&s.active!==false);
      if(ds) a={id:ds.id,username:ds.loginId,password:ds.loginPassword,role:ds.role||"staff",staffId:ds.id,facilityId:ds.facilityId,displayName:ds.name};
    }
    if(!a){setErr("IDまたはパスワードが正しくありません");return;}
    onLogin({...a,selectedFacilityId:a.facilityId||fac});
  };
  return <div className="lw"><div className="lc"><div className="brand">GO <span>GROUP</span></div><div className="bsub">勤怠・検温・利用記録システム</div>
    <div className="fg"><label className="fl">スタッフID</label><input className="fi" placeholder="homestaff / homemgr / admin" value={un} onChange={e=>{setUn(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&go()}/></div>
    <div className="fg"><label className="fl">パスワード</label><input className="fi" type="password" placeholder="pass" value={pw} onChange={e=>{setPw(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&go()}/></div>
    {un==="admin"&&<div className="fg"><label className="fl">操作する施設</label><select className="fi" value={fac} onChange={e=>setFac(e.target.value)}>{FACILITIES.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></div>}
    <button className="bpri" onClick={go}>ログイン</button>
    {err&&<p className="err">{err}</p>}
    <p className="hint">デモID: homestaff / homemgr / admin</p>
    {/* Produce By バッジ */}
    <div style={{marginTop:28,display:"flex",justifyContent:"center"}}>
      <div style={{display:"inline-flex",alignItems:"center",gap:12,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:12,padding:"10px 20px"}}>
        <span style={{fontSize:11,color:"rgba(255,255,255,0.5)",letterSpacing:1,fontWeight:500,whiteSpace:"nowrap"}}>Produce By</span>
        <div style={{background:"#fff",borderRadius:8,padding:"4px 8px",display:"flex",alignItems:"center"}}>
          <img src="/bells-logo.jpg" alt="株式会社BELLSインターナショナル" style={{height:36,width:"auto",display:"block"}}/>
        </div>
      </div>
    </div>
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
  const [vm,setVm]=useState(()=>{const d=new Date();return{y:d.getFullYear(),m:d.getMonth()+1};});
  const [cell,setCell]=useState(null);
  const [tab,setTab]=useState("calendar");
  const [minStaff,setMinStaff]=useState(2); // 法定最低人数（施設設定で変更可能）
  const [copyMsg,setCopyMsg]=useState("");

  // 月が変わったら平日を自動でCに設定（未入力のみ・土日は除く）
  useEffect(()=>{
    if(!store.setShift) return;
    const isMgrUser=user.role==="manager"||user.role==="admin";
    if(!isMgrUser) return;
    const targetStaff=store.dynStaff.filter(s=>user.role==="admin"||s.facilityId===user.selectedFacilityId);
    const days2=daysInMonth(vm.y,vm.m);
    const mk2=d=>`${vm.y}-${String(vm.m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    // 少し遅延させてstoreのロード完了後に実行
    const tid=setTimeout(()=>{
      targetStaff.forEach(s=>{
        for(let d=1;d<=days2;d++){
          const dw=new Date(vm.y,vm.m-1,d).getDay();
          if(dw===0) continue; // 日曜スキップ
          if(dw===6&&s.facilityId!=="f3") continue; // TOWN 1ST以外は土曜スキップ
          const existing=store.getShift(s.id,mk2(d));
          if(!existing||existing==="none") store.setShift(s.id,mk2(d),"C");
        }
      });
    },600);
    return ()=>clearTimeout(tid);
  },[vm.y,vm.m,user.selectedFacilityId,store.dynStaff.length]);

  const isMgr=user.role==="manager"||user.role==="admin";
  const fStaff=store.dynStaff.filter(s=>user.role==="admin"||s.facilityId===user.selectedFacilityId);
  const facilityId=user.selectedFacilityId;
  const facName=FACILITIES.find(f=>f.id===facilityId)?.name||"";
  const days=daysInMonth(vm.y,vm.m);
  const mk=d=>`${vm.y}-${String(vm.m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const dow=["日","月","火","水","木","金","土"];
  const dcol=d=>{const w=new Date(vm.y,vm.m-1,d).getDay();return w===0?"var(--ro)":w===6?"var(--tl)":"var(--tx)";};

  // GO TOWN 1STは土曜も営業
  const isTown1st = facilityId==="f3";

  // スタッフ表示順: 林康義→渡邊詳子→南條徹→木村信哉→入社日順
  const SHIFT_PRIORITY=["林康義","渡邊詳子","南條徹","木村信哉"];
  const sortedStaff=[...fStaff].sort((a,b)=>{
    const ai=SHIFT_PRIORITY.indexOf(a.name),bi=SHIFT_PRIORITY.indexOf(b.name);
    if(ai!==-1&&bi!==-1) return ai-bi;
    if(ai!==-1) return -1;
    if(bi!==-1) return 1;
    return (a.joinDate||a.createdAt||"").localeCompare(b.joinDate||b.createdAt||"");
  });

  // 各日の勤務タイプ別集計
  const counts={A:0,B:0,C:0,off:0,holiday:0};
  sortedStaff.forEach(s=>{for(let i=1;i<=days;i++){const t=store.getShift(s.id,mk(i));if(counts[t]!==undefined)counts[t]++;}});

  // 各日の出勤人数（TOWN 1STは土曜も含む）
  const dayWorkCount=d=>{
    const dw=new Date(vm.y,vm.m-1,d).getDay();
    if(dw===0) return null; // 日曜は常にnull
    if(dw===6&&!isTown1st) return null; // 土曜はTOWN 1ST以外null
    return fStaff.filter(s=>{const t=store.getShift(s.id,mk(d));return t&&t!=="off"&&t!=="holiday"&&t!=="none";}).length;
  };

  // 月間勤務時間計算
  const SHIFT_HOURS={A:8,B:8,C:8,off:0,holiday:0,P1:5,P2:4,P3:4,none:0};
  const calcHours=sid=>{let h=0;for(let i=1;i<=days;i++){h+=SHIFT_HOURS[store.getShift(sid,mk(i))]||0;}return h;};

  // 先月コピー
  const copyFromPrev=()=>{
    const pvm=vm.m===1?{y:vm.y-1,m:12}:{y:vm.y,m:vm.m-1};
    const pdays=daysInMonth(pvm.y,pvm.m);
    const pmk=d=>`${pvm.y}-${String(pvm.m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    let cnt=0;
    fStaff.forEach(s=>{
      for(let i=1;i<=Math.min(days,pdays);i++){
        const t=store.getShift(s.id,pmk(i));
        if(t&&t!=="none"){store.setShift(s.id,mk(i),t);cnt++;}
      }
    });
    setCopyMsg(`先月から${cnt}件のシフトをコピーしました`);
    setTimeout(()=>setCopyMsg(""),3000);
  };

  // 平日（TOWN 1STは土曜も）をCで一括設定（未入力のみ）
  const fillWeekdaysWithC=()=>{
    let cnt=0;
    sortedStaff.forEach(s=>{
      for(let d=1;d<=days;d++){
        const dw=new Date(vm.y,vm.m-1,d).getDay();
        if(dw===0) continue; // 日曜スキップ
        if(dw===6&&s.facilityId!=="f3") continue; // TOWN 1ST以外は土曜スキップ
        const existing=store.getShift(s.id,mk(d));
        if(!existing||existing==="none"){store.setShift(s.id,mk(d),"C");cnt++;}
      }
    });
    setCopyMsg(`${cnt}日分をCシフトで設定しました（既存シフトは変更しません）`);
    setTimeout(()=>setCopyMsg(""),4000);
  };

  // 有給申請承認済みをシフトに反映
  const applyApprovedLeave=()=>{
    const yearMonth=vm.y+"-"+String(vm.m).padStart(2,"0");
    const approved=(store.paidLeaveReqs||[]).filter(r=>
      r.status==="承認済"&&(r.leaveDate||r.date||"").startsWith(yearMonth)
    );
    let cnt=0;
    approved.forEach(r=>{
      const date=r.leaveDate||r.date||"";
      if(date){store.setShift(r.staffId,date,"holiday");cnt++;}
    });
    setCopyMsg(cnt>0?`承認済み有給${cnt}件をシフトに反映しました`:"この月の承認済み有給申請がありません");
    setTimeout(()=>setCopyMsg(""),3000);
  };

  // CSV出力
  const csv=()=>{
    const h=["職員ID","氏名",...Array.from({length:days},(_,i)=>i+1),"勤務日数","勤務時間(h)"];
    const rows=fStaff.map(s=>{
      const shiftRow=Array.from({length:days},(_,i)=>store.getShift(s.id,mk(i+1))||"");
      const wdays=shiftRow.filter(t=>t&&t!=="off"&&t!=="holiday"&&t!=="none").length;
      return [s.id,s.name,...shiftRow,wdays,calcHours(s.id)];
    });
    const c=[h,...rows].map(r=>r.join(",")).join("\n");
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["﻿"+c],{type:"text/csv"}));
    a.download=`shift_${vm.y}${String(vm.m).padStart(2,"0")}.csv`;a.click();
  };

  // ラベル
  const shiftLabel=t=>({A:"A",B:"B",C:"C",off:"休",holiday:"有",P1:"P1",P2:"P2",P3:"P3",none:"-"}[t]||"-");
  const shiftClass=t=>`scell sc${t||"none"}`;

  return <div className="fl-wrap">
    <div className="fl-hd">
      <button className="bback" onClick={onBack}>← 戻る</button>
      <div className="fl-title">📆 シフト管理</div>
    </div>

    {/* 年月ナビ + タブ */}
    <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:12,flexWrap:"wrap"}}>
      <button className="cn" onClick={()=>setVm(v=>v.m===1?{y:v.y-1,m:12}:{y:v.y,m:v.m-1})}>‹</button>
      <div style={{fontSize:16,fontWeight:900,minWidth:90,textAlign:"center"}}>{vm.y}年 {vm.m}月</div>
      <button className="cn" onClick={()=>setVm(v=>v.m===12?{y:v.y+1,m:1}:{y:v.y,m:v.m+1})}>›</button>
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginLeft:8}}>
        {[{id:"calendar",icon:"📅",label:"シフト表"},{id:"facilities",icon:"🏢",label:"店舗別"},{id:"check",icon:"✅",label:"充足チェック"},{id:"summary",icon:"📊",label:"勤務集計"}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{padding:"7px 13px",borderRadius:9,border:"2px solid",cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",fontSize:12,fontWeight:700,
              borderColor:tab===t.id?"var(--tl)":"var(--bd)",background:tab===t.id?"rgba(58,160,216,0.2)":"var(--bg)",color:tab===t.id?"var(--tl)":"var(--tx3)"}}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {isMgr&&<div style={{display:"flex",gap:6,marginLeft:"auto",flexWrap:"wrap"}}>
        <button className="bexp" onClick={csv}>⬇ CSV</button>
        <button className="bexp" style={{background:"#fff8f0",borderColor:"var(--ac)",color:"var(--ac)"}} onClick={()=>printShift(fStaff,vm,days,store.getShift,facName)}>🖨️ 印刷</button>
      </div>}
    </div>

    {/* コピー通知 */}
    {copyMsg&&<div style={{background:"rgba(44,170,96,0.15)",border:"1px solid rgba(44,170,96,0.4)",borderRadius:9,padding:"8px 14px",marginBottom:10,fontSize:12,fontWeight:700,color:"var(--gr)"}}>✅ {copyMsg}</div>}

    {/* ── シフト表タブ ── */}
    {tab==="calendar"&&<>
      {isMgr&&<div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
        <button onClick={fillWeekdaysWithC}
          style={{padding:"7px 14px",borderRadius:9,border:"1px solid rgba(58,160,216,0.5)",background:"rgba(58,160,216,0.1)",color:"var(--tl)",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>
          🗓️ 平日をCで一括設定
        </button>
        <button onClick={copyFromPrev}
          style={{padding:"7px 14px",borderRadius:9,border:"1px solid var(--bd)",background:"var(--wh)",color:"var(--tx)",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>
          📋 先月のシフトをコピー
        </button>
        <button onClick={applyApprovedLeave}
          style={{padding:"7px 14px",borderRadius:9,border:"1px solid rgba(144,72,216,0.4)",background:"rgba(144,72,216,0.08)",color:"var(--pu)",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>
          🎫 承認済み有給を反映
        </button>
      </div>}
      <div className="sleg">{SHIFT_TYPES.map(s=><div key={s.key} className="leg"><div className="ld" style={{background:s.color,border:"1px solid "+s.text}}/><span>{s.label}（{s.time}）</span></div>)}</div>
      <div className="ssum2">{SHIFT_TYPES.filter(s=>s.key!=="none").map(s=><div key={s.key} className="ss"><div className="ssn" style={{color:s.text}}>{counts[s.key]||0}</div><div className="ssl">{s.label}</div></div>)}</div>
      <div className="sto"><table className="stbl"><thead>
        <tr>
          <th className="nh">職員名</th>
          {Array.from({length:days},(_,i)=>{
            const d=i+1;const dw=new Date(vm.y,vm.m-1,d).getDay();
            return <th key={d} style={{color:dcol(d)}}>{d}<br/><span style={{fontSize:8}}>{dow[dw]}</span></th>;
          })}
          <th style={{whiteSpace:"nowrap",paddingRight:6,fontSize:10}}>合計h</th>
        </tr>
        {/* 出勤人数行 */}
        <tr style={{background:"var(--bg2)"}}>
          <th style={{fontSize:10,color:"var(--tx3)",textAlign:"left",paddingLeft:6}}>出勤人数</th>
          {Array.from({length:days},(_,i)=>{
            const d=i+1;const cnt=dayWorkCount(d);
            const ok=cnt===null||cnt>=minStaff;
            return <th key={d} style={{fontSize:9,fontWeight:700,color:cnt===null?"var(--tx3)":ok?"var(--gr)":"var(--ro)",background:cnt!==null&&!ok?"rgba(224,56,56,0.1)":""}}>
              {cnt===null?"—":cnt}
            </th>;
          })}
          <th/>
        </tr>
      </thead><tbody>
        {sortedStaff.map(s=><tr key={s.id}>
          <td className="nc">{s.name}</td>
          {Array.from({length:days},(_,i)=>{
            const date=mk(i+1);const type=store.getShift(s.id,date);
            const dw=new Date(vm.y,vm.m-1,i+1).getDay();
            // TOWN 1STスタッフは土曜も編集可
            const isSatWork=s.facilityId==="f3";
            const we=dw===0||(dw===6&&!isSatWork);
            return <td key={i}>
              <div className={shiftClass(we?"off":type)} onClick={()=>!we&&isMgr&&setCell({staffId:s.id,date})} style={{cursor:isMgr&&!we?"pointer":"default"}}>
                {we?"":shiftLabel(type)}
              </div>
            </td>;
          })}
          <td style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"var(--tl)",paddingRight:6}}>{calcHours(s.id)}h</td>
        </tr>)}
      </tbody></table></div>

      {/* セル編集モーダル */}
      {cell&&<div className="ov" onClick={e=>e.target===e.currentTarget&&setCell(null)}>
        <div className="md">
          <div className="mdtit">シフトを設定</div>
          <div style={{fontSize:12,color:"var(--tx3)",marginBottom:10}}>{store.dynStaff.find(s=>s.id===cell.staffId)?.name} — {dlabel(cell.date)}</div>
          <div className="sogrid">{SHIFT_TYPES.map(s=>{
            const cur=store.getShift(cell.staffId,cell.date);
            return <button key={s.key} className="soBtn"
              style={{borderColor:cur===s.key?"var(--tl)":"",background:cur===s.key?s.color:""}}
              onClick={()=>{store.setShift(cell.staffId,cell.date,s.key);setCell(null);}}>
              <div style={{color:s.text,fontSize:13}}>{s.label}</div>
              <div style={{fontSize:10,color:"var(--tx3)",marginTop:2}}>{s.time}</div>
            </button>;
          })}</div>
          <div className="mda"><button className="bcancel" onClick={()=>setCell(null)}>閉じる</button></div>
        </div>
      </div>}
    </>}

    {/* ── 店舗別シフト表タブ ── */}
    {tab==="facilities"&&<>
      <div style={{marginBottom:8,fontSize:11,color:"var(--tx3)"}}>各店舗のスタッフシフトを一覧表示します</div>
      {FACILITIES.map(fac=>{
        const facStaff=[...store.dynStaff.filter(s=>s.facilityId===fac.id&&s.active!==false)].sort((a,b)=>{
          const ai=SHIFT_PRIORITY.indexOf(a.name),bi=SHIFT_PRIORITY.indexOf(b.name);
          if(ai!==-1&&bi!==-1) return ai-bi;
          if(ai!==-1) return -1; if(bi!==-1) return 1;
          return (a.joinDate||a.createdAt||"").localeCompare(b.joinDate||b.createdAt||"");
        });
        if(facStaff.length===0) return null;
        const isFacTown1st=fac.id==="f3";
        return <div key={fac.id} style={{marginBottom:20}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,padding:"8px 12px",background:"rgba(58,160,216,0.12)",borderRadius:9,border:"1px solid rgba(58,160,216,0.3)"}}>
            <span style={{fontSize:14,fontWeight:900,color:"var(--tl)"}}>🏢 {fac.name}</span>
            <span style={{fontSize:11,color:"var(--tx3)"}}>{facStaff.length}名</span>
            {isMgr&&<button onClick={()=>printShift(facStaff,vm,days,store.getShift,fac.name)} style={{marginLeft:"auto",padding:"5px 11px",borderRadius:8,border:"1px solid var(--ac)",background:"#fff8f0",color:"var(--ac)",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>🖨️ 印刷</button>}
          </div>
          <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
            <table className="stbl" style={{fontSize:10,minWidth:"max-content"}}>
              <thead>
                <tr>
                  <th className="nh" style={{fontSize:11}}>職員名</th>
                  {Array.from({length:days},(_,i)=>{
                    const d=i+1;const dw=new Date(vm.y,vm.m-1,d).getDay();
                    const isSat=dw===6;const isSun=dw===0;
                    const isWe=(isSun)||(isSat&&!isFacTown1st);
                    return <th key={d} style={{color:dw===0?"var(--ro)":dw===6?"var(--tl)":"var(--tx)",opacity:isWe?0.4:1,minWidth:22,fontSize:9}}>
                      {d}<br/><span style={{fontSize:7}}>{dow[dw]}</span>
                    </th>;
                  })}
                  <th style={{fontSize:9,whiteSpace:"nowrap",paddingRight:4}}>合計h</th>
                </tr>
              </thead>
              <tbody>
                {facStaff.map(s=><tr key={s.id}>
                  <td className="nc" style={{fontSize:11,whiteSpace:"nowrap"}}>{s.name}</td>
                  {Array.from({length:days},(_,i)=>{
                    const date=mk(i+1);const type=store.getShift(s.id,date);
                    const dw=new Date(vm.y,vm.m-1,i+1).getDay();
                    const we=dw===0||(dw===6&&!isFacTown1st);
                    return <td key={i}>
                      <div className={shiftClass(we?"off":type)} onClick={()=>!we&&isMgr&&setCell({staffId:s.id,date})} style={{cursor:isMgr&&!we?"pointer":"default",fontSize:10}}>
                        {we?"":shiftLabel(type)}
                      </div>
                    </td>;
                  })}
                  <td style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"var(--tl)",paddingRight:4}}>{calcHours(s.id)}h</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </div>;
      })}
      {/* セル編集モーダル（店舗別タブでも使用） */}
      {cell&&<div className="ov" onClick={e=>e.target===e.currentTarget&&setCell(null)}>
        <div className="md">
          <div className="mdtit">シフトを設定</div>
          <div style={{fontSize:12,color:"var(--tx3)",marginBottom:10}}>{store.dynStaff.find(s=>s.id===cell.staffId)?.name} — {dlabel(cell.date)}</div>
          <div className="sogrid">{SHIFT_TYPES.map(s=>{
            const cur=store.getShift(cell.staffId,cell.date);
            return <button key={s.key} className="soBtn"
              style={{borderColor:cur===s.key?"var(--tl)":"",background:cur===s.key?s.color:""}}
              onClick={()=>{store.setShift(cell.staffId,cell.date,s.key);setCell(null);}}>
              <div style={{color:s.text,fontSize:13}}>{s.label}</div>
              <div style={{fontSize:10,color:"var(--tx3)",marginTop:2}}>{s.time}</div>
            </button>;
          })}</div>
          <div className="mda"><button className="bcancel" onClick={()=>setCell(null)}>閉じる</button></div>
        </div>
      </div>}
    </>}

    {/* ── 充足チェックタブ ── */}
    {tab==="check"&&<>
      <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:12,flexWrap:"wrap"}}>
        <div style={{fontSize:12,fontWeight:700,color:"var(--tx3)"}}>法定最低人数：</div>
        <select value={minStaff} onChange={e=>setMinStaff(+e.target.value)}
          style={{padding:"6px 10px",borderRadius:8,border:"1.5px solid var(--bd)",background:"var(--bg)",color:"var(--tx)",fontSize:14,fontFamily:"'DM Mono',monospace",outline:"none"}}>
          {[1,2,3,4,5,6].map(n=><option key={n} value={n}>{n}名</option>)}
        </select>
        <div style={{fontSize:11,color:"var(--tx3)"}}>※ 放課後等デイサービスは原則2名以上（児童指導員or保育士1名含む）</div>
      </div>
      {/* カレンダー形式の充足状況 */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:5,marginBottom:16}}>
        {dow.map(d=><div key={d} style={{textAlign:"center",fontSize:11,fontWeight:700,padding:"5px 0",color:d==="日"?"var(--ro)":d==="土"?"var(--tl)":"var(--tx3)"}}>{d}</div>)}
        {/* 月初の空白 */}
        {Array.from({length:new Date(vm.y,vm.m-1,1).getDay()},(_,i)=><div key={"b"+i}/>)}
        {Array.from({length:days},(_,i)=>{
          const d=i+1;const dw=new Date(vm.y,vm.m-1,d).getDay();
          const isWe=dw===0||dw===6;
          const cnt=isWe?null:dayWorkCount(d);
          const ok=cnt===null||cnt>=minStaff;
          const isToday=mk(d)===todayISO();
          const staffOnDay=isWe?[]:fStaff.filter(s=>{const t=store.getShift(s.id,mk(d));return t&&t!=="off"&&t!=="holiday"&&t!=="none";});
          return <div key={d} style={{
            background:isWe?"var(--bg)":ok?"rgba(44,170,96,0.12)":"rgba(224,56,56,0.1)",
            border:`2px solid ${isToday?"var(--tl)":isWe?"var(--bd)":ok?"rgba(44,170,96,0.4)":"rgba(224,56,56,0.5)"}`,
            borderRadius:10,padding:"7px 5px",minHeight:80,
          }}>
            <div style={{textAlign:"center",fontWeight:700,fontSize:12,color:isWe?"var(--tx3)":ok?"var(--gr)":"var(--ro)",marginBottom:4}}>
              {d}日
              {!isWe&&<div style={{fontSize:16,fontWeight:900,fontFamily:"'DM Mono',monospace"}}>{cnt}</div>}
              {!isWe&&<div style={{fontSize:9,fontWeight:700,color:ok?"var(--gr)":"var(--ro)"}}>{ok?"✓ 充足":"✗ 不足"}</div>}
            </div>
            {!isWe&&staffOnDay.slice(0,3).map(s=>(
              <div key={s.id} style={{fontSize:9,color:"var(--tx3)",textOverflow:"ellipsis",overflow:"hidden",whiteSpace:"nowrap"}}>{s.name}</div>
            ))}
            {!isWe&&staffOnDay.length>3&&<div style={{fontSize:9,color:"var(--tx3)"}}>+{staffOnDay.length-3}名</div>}
          </div>;
        })}
      </div>
      {/* 充足不足日のリスト */}
      {(()=>{
        const shortDays=Array.from({length:days},(_,i)=>i+1).filter(d=>{
          const dw=new Date(vm.y,vm.m-1,d).getDay();
          if(dw===0||dw===6) return false;
          return dayWorkCount(d)<minStaff;
        });
        return shortDays.length>0?<div style={{background:"rgba(224,56,56,0.08)",border:"1px solid rgba(224,56,56,0.3)",borderRadius:10,padding:"10px 14px",marginBottom:12}}>
          <div style={{fontWeight:700,fontSize:12,color:"var(--ro)",marginBottom:6}}>🚨 充足人数不足の日（{shortDays.length}日）</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
            {shortDays.map(d=><span key={d} style={{fontSize:11,padding:"3px 9px",borderRadius:7,background:"rgba(224,56,56,0.15)",color:"var(--ro)",fontWeight:700,fontFamily:"'DM Mono',monospace"}}>
              {vm.m}/{d}（{dow[new Date(vm.y,vm.m-1,d).getDay()]}）{dayWorkCount(d)}名
            </span>)}
          </div>
        </div>:<div style={{background:"rgba(44,170,96,0.1)",border:"1px solid rgba(44,170,96,0.4)",borderRadius:10,padding:"10px 14px",marginBottom:12,display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontSize:18}}>✅</span><span style={{fontWeight:700,color:"var(--gr)",fontSize:13}}>全平日で{minStaff}名以上の配置が確保されています</span>
        </div>;
      })()}
    </>}

    {/* ── 勤務集計タブ ── */}
    {tab==="summary"&&<>
      <div style={{overflowX:"auto",marginBottom:16}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:500}}>
          <thead><tr style={{background:"var(--bg2)"}}>
            {["職員名","職種","出勤日数","公休日数","有給取得","勤務時間","月40h超過","残日数目安"].map(h=>(
              <th key={h} style={{padding:"8px 9px",textAlign:"left",color:"var(--tx2)",fontSize:10,fontWeight:700,borderBottom:"2px solid var(--bd)",whiteSpace:"nowrap"}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>{fStaff.map(s=>{
            const shifts=Array.from({length:days},(_,i)=>store.getShift(s.id,mk(i+1))||"none");
            const wdays=shifts.filter(t=>t&&t!=="off"&&t!=="holiday"&&t!=="none").length;
            const offdays=shifts.filter(t=>t==="off").length;
            const holdays=shifts.filter(t=>t==="holiday").length;
            const hours=calcHours(s.id);
            const over=Math.max(0,hours-160); // 月160h基準（概算）
            // 残日数（残りの平日に最低何日出れば帳尻が合うか）
            const remainDays=Array.from({length:days},(_,i)=>i+1).filter(d=>{
              const dw=new Date(vm.y,vm.m-1,d).getDay();
              const t=store.getShift(s.id,mk(d));
              return dw!==0&&dw!==6&&(!t||t==="none");
            }).length;
            const sd=s.data||s;
            return <tr key={s.id} style={{borderBottom:"1px solid var(--bd)"}}>
              <td style={{padding:"8px 9px",fontWeight:700}}>{s.name}</td>
              <td style={{padding:"8px 9px",fontSize:11,color:"var(--tx3)"}}>{sd.role==="manager"?"管理者":sd.role==="driver"?"運転手":sd.employmentType||"—"}</td>
              <td style={{padding:"8px 9px",textAlign:"right",fontFamily:"'DM Mono',monospace",fontWeight:700,color:"var(--gr)"}}>{wdays}日</td>
              <td style={{padding:"8px 9px",textAlign:"right",fontFamily:"'DM Mono',monospace",color:"var(--tx3)"}}>{offdays}日</td>
              <td style={{padding:"8px 9px",textAlign:"right",fontFamily:"'DM Mono',monospace",color:"var(--pu)",fontWeight:holdays>0?700:400}}>{holdays}日</td>
              <td style={{padding:"8px 9px",textAlign:"right",fontFamily:"'DM Mono',monospace",fontWeight:700,color:hours>160?"var(--ro)":"var(--tl)"}}>{hours}h</td>
              <td style={{padding:"8px 9px",textAlign:"right",fontFamily:"'DM Mono',monospace",fontWeight:over>0?700:400,color:over>0?"var(--ro)":"var(--tx3)"}}>{over>0?"+"+over+"h":"—"}</td>
              <td style={{padding:"8px 9px",textAlign:"right",fontFamily:"'DM Mono',monospace",fontSize:11,color:"var(--tx3)"}}>{remainDays}日</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      {/* 月全体サマリー */}
      <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:12,padding:"12px 16px"}}>
        <div style={{fontWeight:700,fontSize:13,marginBottom:10,color:"var(--tl)"}}>📊 {vm.y}年{vm.m}月 全体集計</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:8}}>
          {[
            {label:"在籍職員数",val:fStaff.length+"名",color:"var(--tl)"},
            {label:"延べ出勤日数",val:fStaff.reduce((s,st)=>{let n=0;for(let i=1;i<=days;i++){const t=store.getShift(st.id,mk(i));if(t&&t!=="off"&&t!=="holiday"&&t!=="none")n++;}return s+n;},0)+"日",color:"var(--gr)"},
            {label:"有給取得計",val:fStaff.reduce((s,st)=>{let n=0;for(let i=1;i<=days;i++){if(store.getShift(st.id,mk(i))==="holiday")n++;}return s+n;},0)+"日",color:"var(--pu)"},
            {label:"総勤務時間",val:fStaff.reduce((s,st)=>s+calcHours(st.id),0)+"h",color:"var(--am)"},
            {label:"申請中有給",val:(store.paidLeaveReqs||[]).filter(r=>r.staffId&&fStaff.find(s=>s.id===r.staffId)&&r.status==="申請中").length+"件",color:"var(--ro)"},
          ].map(c=>(
            <div key={c.label} style={{background:"var(--bg2)",borderRadius:9,padding:"10px 12px",textAlign:"center"}}>
              <div style={{fontSize:18,fontWeight:900,color:c.color,fontFamily:"'DM Mono',monospace"}}>{c.val}</div>
              <div style={{fontSize:10,color:"var(--tx3)",marginTop:3}}>{c.label}</div>
            </div>
          ))}
        </div>
      </div>
      {/* 有給申請一覧 */}
      {(()=>{
        const pending=(store.paidLeaveReqs||[]).filter(r=>fStaff.find(s=>s.id===r.staffId));
        if(!pending.length) return null;
        return <div style={{marginTop:14}}>
          <div style={{fontWeight:700,fontSize:13,marginBottom:8,color:"var(--tx)"}}>🎫 有給申請一覧（この施設の職員）</div>
          {pending.map(r=>{
            const s=fStaff.find(st=>st.id===r.staffId);
            return <div key={r.id} style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:10,padding:"10px 13px",marginBottom:7,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:13}}>{s?.name||r.staffName||"—"}</div>
                <div style={{fontSize:11,color:"var(--tx3)",marginTop:2}}>
                  申請日: {r.leaveDate||r.date||"—"}　種別: {r.leaveType||"有給"}　理由: {r.reason||"—"}
                </div>
              </div>
              <span style={{fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:8,
                background:r.status==="承認済"?"rgba(44,170,96,0.15)":r.status==="却下"?"rgba(224,56,56,0.1)":"rgba(255,160,0,0.15)",
                color:r.status==="承認済"?"var(--gr)":r.status==="却下"?"var(--ro)":"var(--am)"}}>
                {r.status||"申請中"}
              </span>
              {isMgr&&r.status==="申請中"&&<div style={{display:"flex",gap:5}}>
                <button onClick={()=>store.updPaidLeaveReq(r.id,{status:"承認済"})}
                  style={{padding:"5px 11px",borderRadius:7,background:"var(--gr)",color:"#fff",border:"none",fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>✓ 承認</button>
                <button onClick={()=>store.updPaidLeaveReq(r.id,{status:"却下"})}
                  style={{padding:"5px 11px",borderRadius:7,background:"var(--ro)",color:"#fff",border:"none",fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>✗ 却下</button>
              </div>}
            </div>;
          })}
        </div>;
      })()}
    </>}
  </div>;
}

// ==================== TRANSPORT ====================
// ─── 送迎管理画面（強化版）─── 3タブ: 本日の送迎 / ルート管理 / 記録履歴
function TransportScreen({user,store,onBack}){
  const [tab,setTab]=useState("today");          // today / routes / history
  const [dir,setDir]=useState("来所");
  const [editRoute,setEditRoute]=useState(null); // ルート編集中
  const [showNewRoute,setShowNewRoute]=useState(false);

  const facId=user.selectedFacilityId;
  const facName=FACILITIES.find(f=>f.id===facId)?.name||"";
  const today=todayISO();

  // 施設の利用者一覧
  const facUsers=store.dynUsers.filter(u=>u.facilityId===facId&&u.active!==false);
  // 本日のルート（方向フィルタ）
  const todayRoutes=(store.routes||[]).filter(r=>r.facilityId===facId&&r.direction===dir);
  // 本日のrecs（来所/退所）
  const todayRecs=store.recs.filter(r=>r.facilityId===facId&&r.time?.slice(0,10)===today);
  const arrivals=todayRecs.filter(r=>r.type==="user_in");
  const departures=todayRecs.filter(r=>r.type==="user_out");

  // ルート印刷
  const printRoute=(route)=>{
    const stopsHtml=(route.stops||[]).map((s,i)=>`
      <tr>
        <td style="border:1px solid #ccc;padding:8px;text-align:center;font-weight:700;">${s.order||i+1}</td>
        <td style="border:1px solid #ccc;padding:8px;font-weight:700;">${s.userName||""}</td>
        <td style="border:1px solid #ccc;padding:8px;">${s.address||""}</td>
        <td style="border:1px solid #ccc;padding:8px;text-align:center;">${s.estimatedTime||""}</td>
        <td style="border:1px solid #ccc;padding:8px;">${s.note||""}</td>
        <td style="border:1px solid #ccc;padding:8px;width:80px;"></td>
      </tr>`).join("");
    const html=`<div style="font-family:'Noto Sans JP',sans-serif;max-width:780px;margin:0 auto;padding:20px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;border-bottom:2px solid #3aa0d8;padding-bottom:10px;">
        <div>
          <h2 style="font-size:18px;font-weight:900;margin:0 0 4px;">送迎ルート表</h2>
          <div style="font-size:14px;font-weight:700;color:#3aa0d8;">${route.name} — ${route.direction}</div>
        </div>
        <div style="text-align:right;font-size:11px;color:#666;">
          <div>${facName}</div>
          <div>ドライバー: ${route.driver||"未設定"}</div>
          <div>車両: ${route.vehicle||"未設定"}</div>
          <div style="margin-top:4px;font-size:10px;">印刷日: ${new Date().toLocaleDateString("ja-JP")}</div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <thead>
          <tr style="background:#e8f0ff;">
            <th style="border:1px solid #ccc;padding:8px;width:50px;">順番</th>
            <th style="border:1px solid #ccc;padding:8px;width:130px;">利用者名</th>
            <th style="border:1px solid #ccc;padding:8px;">住所</th>
            <th style="border:1px solid #ccc;padding:8px;width:80px;">予定時刻</th>
            <th style="border:1px solid #ccc;padding:8px;">備考</th>
            <th style="border:1px solid #ccc;padding:8px;width:80px;">実施確認</th>
          </tr>
        </thead>
        <tbody>${stopsHtml}</tbody>
      </table>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="border:1px solid #ccc;padding:14px;">出発時刻：　　：　　</td>
          <td style="border:1px solid #ccc;padding:14px;">帰着時刻：　　：　　</td>
          <td style="border:1px solid #ccc;padding:14px;">担当者確認印：　　　　㊞</td>
        </tr>
      </table>
    </div>`;
    printHTML(html, `送迎ルート_${route.name}_${today}`);
  };

  // ─── ルート編集フォーム ───
  if(editRoute!==null||showNewRoute){
    const isNew=showNewRoute&&editRoute===null;
    const initRoute=isNew
      ?{id:genId(),facilityId:facId,name:"",direction:dir,driver:"",vehicle:"",color:"#3aa0d8",stops:[]}
      :editRoute;
    return <RouteEditForm
      route={initRoute} facUsers={facUsers} isNew={isNew}
      onSave={r=>{
        if(isNew) store.addRoute(r); else store.updRoute(r.id,r);
        setEditRoute(null);setShowNewRoute(false);
        store.showToast(isNew?"ルートを作成しました":"ルートを更新しました");
      }}
      onCancel={()=>{setEditRoute(null);setShowNewRoute(false);}}
      onDelete={id=>{store.delRoute(id);setEditRoute(null);store.showToast("ルートを削除しました","warn");}}
    />;
  }

  return <div className="fl-wrap">
    {/* ヘッダー */}
    <div className="fl-hd">
      <button className="bback" onClick={onBack}>← 戻る</button>
      <div className="fl-title">🚌 送迎管理</div>
      {tab==="today"&&<button className="bexp" style={{marginLeft:"auto",fontSize:11,padding:"5px 10px"}}
        onClick={()=>printTransport(store.trData.filter(t=>t.facilityId===facId&&t.direction===dir),dir,facName)}>
        🖨 従来印刷
      </button>}
    </div>

    {/* タブ */}
    <div style={{display:"flex",gap:6,padding:"10px 14px",background:"var(--bg)",borderBottom:"1px solid var(--bd)"}}>
      {[
        {id:"today", icon:"🚌", label:"本日の送迎"},
        {id:"routes",icon:"📍", label:`ルート管理 (${(store.routes||[]).filter(r=>r.facilityId===facId).length})`},
        {id:"history",icon:"📋", label:"記録履歴"},
      ].map(t=>(
        <button key={t.id} onClick={()=>setTab(t.id)}
          style={{padding:"7px 12px",borderRadius:9,fontWeight:700,fontSize:11,cursor:"pointer",border:"1.5px solid",fontFamily:"'Noto Sans JP',sans-serif",
            background:tab===t.id?"var(--tl)":"var(--wh)",color:tab===t.id?"#fff":"var(--tx3)",borderColor:tab===t.id?"var(--tl)":"var(--bd)"}}>
          {t.icon} {t.label}
        </button>
      ))}
    </div>

    <div style={{padding:14}}>

    {/* ═══ 本日の送迎タブ ═══ */}
    {tab==="today"&&<div>
      {/* 方向切替 */}
      <div className="togr" style={{marginBottom:14}}>
        {["来所","退所"].map(d=><button key={d} className={`tg ${dir===d?"on":""}`} onClick={()=>setDir(d)}>{d}</button>)}
      </div>

      {/* 本日の状況サマリー */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
        {[
          {label:dir==="来所"?"来所済み":"退所済み", val:dir==="来所"?arrivals.filter(r=>r.transport==="あり").length:departures.filter(r=>r.transport==="あり").length, color:"var(--gr)"},
          {label:"送迎予定数", val:todayRoutes.reduce((s,r)=>s+(r.stops||[]).length,0), color:"var(--tl)"},
          {label:"ルート数", val:todayRoutes.length, color:"var(--pu)"},
        ].map(s=>(
          <div key={s.label} style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:10,padding:"10px 8px",textAlign:"center",boxShadow:"var(--sh)"}}>
            <div style={{fontSize:22,fontWeight:900,color:s.color,fontFamily:"'DM Mono',monospace"}}>{s.val}</div>
            <div style={{fontSize:10,color:"var(--tx3)",marginTop:2}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ルートごとの送迎状況 */}
      {todayRoutes.length===0
        ?<div style={{background:"var(--bg)",borderRadius:11,padding:"20px 14px",textAlign:"center",color:"var(--tx3)",fontSize:13}}>
          {dir}の送迎ルートが未設定です。「ルート管理」タブから追加してください。
        </div>
        :todayRoutes.map(route=>{
          const completedStops=(route.stops||[]).filter(s=>{
            const rec=(dir==="来所"?arrivals:departures).find(r=>r.userId===s.userId);
            return !!rec&&rec.transport==="あり";
          });
          const pct=(route.stops||[]).length>0?completedStops.length/(route.stops||[]).length*100:0;
          return <div key={route.id} style={{background:"var(--wh)",border:`2px solid ${route.color||"var(--tl)"}`,borderRadius:12,padding:14,marginBottom:14,boxShadow:"var(--sh)"}}>
            {/* ルートヘッダー */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div>
                <div style={{fontWeight:900,fontSize:14,color:route.color||"var(--tl)"}}>{route.name}</div>
                <div style={{fontSize:11,color:"var(--tx3)",marginTop:3}}>
                  🚗 {route.vehicle||"車両未設定"} 　👤 {route.driver||"担当未設定"}
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:12,fontWeight:700,color:route.color||"var(--tl)"}}>
                  {completedStops.length}/{(route.stops||[]).length}件完了
                </div>
                <div style={{marginTop:4,width:80,height:6,borderRadius:3,background:"var(--bd)",overflow:"hidden"}}>
                  <div style={{height:"100%",borderRadius:3,background:route.color||"var(--tl)",width:`${pct}%`,transition:"width .3s"}}/>
                </div>
              </div>
            </div>
            {/* 停留所リスト */}
            {(route.stops||[]).sort((a,b)=>a.order-b.order).map((s,i)=>{
              const rec=(dir==="来所"?arrivals:departures).find(r=>r.userId===s.userId);
              const done=rec&&rec.transport==="あり";
              return <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderTop:i>0?"1px dashed var(--bd)":"none"}}>
                {/* 順番バッジ */}
                <div style={{width:28,height:28,borderRadius:"50%",background:done?(route.color||"var(--tl)"):"var(--bg)",border:`2px solid ${done?(route.color||"var(--tl)"):"var(--bd)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:900,color:done?"#fff":"var(--tx3)",flexShrink:0}}>
                  {s.order||i+1}
                </div>
                {/* 利用者情報 */}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:13,color:done?"var(--gr)":"var(--tx)"}}>{s.userName}</div>
                  <div style={{fontSize:10,color:"var(--tx3)",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>📍 {s.address||"住所未設定"}</div>
                  {s.note&&<div style={{fontSize:10,color:"var(--am)"}}>{s.note}</div>}
                </div>
                {/* 時刻 */}
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:12,fontWeight:700,color:"var(--tx3)"}}>{s.estimatedTime||"--:--"}</div>
                  {done&&<div style={{fontSize:10,color:"var(--gr)",fontWeight:700}}>
                    ✅ {rec.time?.slice(-8,-3)||"完了"}
                  </div>}
                  {!done&&<div style={{fontSize:10,color:"var(--am)"}}>未完了</div>}
                </div>
              </div>;
            })}
            {/* ルート印刷ボタン */}
            <div style={{marginTop:10,borderTop:"1px solid var(--bd)",paddingTop:10}}>
              <button className="bexp" style={{width:"100%",fontSize:11,padding:"7px"}}
                onClick={()=>printRoute(route)}>
                🖨 このルートの送迎表を印刷
              </button>
            </div>
          </div>;
        })
      }

      {/* ルートに含まれていない送迎利用者 */}
      {(()=>{
        const routeUserIds=(todayRoutes.flatMap(r=>r.stops||[])).map(s=>s.userId);
        const unrouted=store.trData.filter(t=>t.facilityId===facId&&t.direction===dir&&!routeUserIds.includes(t.userId));
        if(unrouted.length===0) return null;
        return <div style={{background:"var(--bg)",borderRadius:11,padding:12,border:"1px dashed var(--bd)"}}>
          <div style={{fontSize:11,fontWeight:700,color:"var(--tx3)",marginBottom:8}}>ルート未割当の送迎利用者</div>
          {unrouted.map(t=>{
            const rec=(dir==="来所"?arrivals:departures).find(r=>r.userId===t.userId&&r.transport==="あり");
            return <div key={t.id} className="trc" style={{marginBottom:6}}>
              <div className="trh2">
                <div>
                  <div className="trn">{t.userName}</div>
                  <div style={{fontSize:11,color:"var(--tx3)",marginTop:2}}>📍 {t.address}</div>
                </div>
                {rec&&<span style={{fontSize:11,color:"var(--gr)",fontWeight:700}}>✅ {rec.time?.slice(-8,-3)}</span>}
              </div>
              <div style={{fontSize:11,color:"var(--tx3)"}}>担当: {t.driver||"未設定"}</div>
            </div>;
          })}
        </div>;
      })()}
    </div>}

    {/* ═══ ルート管理タブ ═══ */}
    {tab==="routes"&&<div>
      <div className="togr" style={{marginBottom:14}}>
        {["来所","退所"].map(d=><button key={d} className={`tg ${dir===d?"on":""}`} onClick={()=>setDir(d)}>{d}</button>)}
      </div>

      <button className="bsave" style={{marginBottom:14}} onClick={()=>setShowNewRoute(true)}>
        ＋ 新しいルートを作成
      </button>

      {(store.routes||[]).filter(r=>r.facilityId===facId&&r.direction===dir).map(route=>(
        <div key={route.id} style={{background:"var(--wh)",border:`2px solid ${route.color||"var(--tl)"}`,borderRadius:12,padding:14,marginBottom:12,boxShadow:"var(--sh)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
            <div>
              <div style={{fontWeight:900,fontSize:14,color:route.color||"var(--tl)"}}>{route.name}</div>
              <div style={{fontSize:11,color:"var(--tx3)",marginTop:3}}>
                🚗 {route.vehicle||"車両未設定"} 　👤 {route.driver||"担当未設定"}
                　🛑 {(route.stops||[]).length}停留所
              </div>
            </div>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>printRoute(route)}
                style={{padding:"5px 10px",borderRadius:8,fontSize:11,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"rgba(58,160,216,0.1)",border:"1.5px solid var(--tl)",color:"var(--tl)",fontWeight:700}}>
                🖨
              </button>
              <button onClick={()=>setEditRoute({...route})}
                style={{padding:"5px 10px",borderRadius:8,fontSize:11,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"var(--bg)",border:"1.5px solid var(--tl)",color:"var(--tl)",fontWeight:700}}>
                ✏️ 編集
              </button>
            </div>
          </div>
          {(route.stops||[]).sort((a,b)=>a.order-b.order).map((s,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderTop:i>0?"1px dashed var(--bd)":"none"}}>
              <div style={{width:22,height:22,borderRadius:"50%",background:route.color||"var(--tl)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:900,color:"#fff",flexShrink:0}}>
                {s.order||i+1}
              </div>
              <div style={{flex:1}}>
                <span style={{fontWeight:700,fontSize:12}}>{s.userName}</span>
                <span style={{fontSize:10,color:"var(--tx3)",marginLeft:8}}>{s.address||""}</span>
              </div>
              <div style={{fontSize:11,fontWeight:700,color:"var(--tx3)"}}>{s.estimatedTime||""}</div>
            </div>
          ))}
        </div>
      ))}
      {(store.routes||[]).filter(r=>r.facilityId===facId&&r.direction===dir).length===0&&
        <div style={{background:"rgba(58,160,216,0.06)",border:"1px solid rgba(58,160,216,0.2)",borderRadius:11,padding:"20px 14px",textAlign:"center",color:"var(--tx3)",fontSize:13}}>
          {dir}のルートがまだありません
        </div>}
    </div>}

    {/* ═══ 記録履歴タブ ═══ */}
    {tab==="history"&&<div>
      <div className="togr" style={{marginBottom:14}}>
        {["来所","退所"].map(d=><button key={d} className={`tg ${dir===d?"on":""}`} onClick={()=>setDir(d)}>{d}</button>)}
      </div>
      {(()=>{
        const histRecs=store.recs.filter(r=>r.facilityId===facId&&r.type===(dir==="来所"?"user_in":"user_out")&&r.transport==="あり")
          .sort((a,b)=>b.time>a.time?1:-1);
        if(histRecs.length===0) return <div style={{textAlign:"center",color:"var(--tx3)",padding:24}}>送迎記録がありません</div>;

        // 日付ごとにグループ
        const byDate={};
        histRecs.forEach(r=>{
          const d=r.time?.slice(0,10)||"";
          if(!byDate[d]) byDate[d]=[];
          byDate[d].push(r);
        });
        return Object.entries(byDate).sort((a,b)=>b[0]>a[0]?1:-1).slice(0,20).map(([date,recs])=>(
          <div key={date} style={{marginBottom:14}}>
            <div style={{fontSize:12,fontWeight:700,color:"var(--tl)",marginBottom:8,paddingBottom:4,borderBottom:"1px solid var(--bd)"}}>
              📅 {date} ({recs.length}件)
            </div>
            {recs.map((r,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:"var(--wh)",borderRadius:9,border:"1px solid var(--bd)",marginBottom:6,boxShadow:"var(--sh)"}}>
                <div>
                  <div style={{fontWeight:700,fontSize:13}}>{r.userName}</div>
                  <div style={{fontSize:10,color:"var(--tx3)"}}>体温: {r.temp||"-"}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:11,fontWeight:700,color:"var(--tl)"}}>{r.time?.slice(-8,-3)||""}</div>
                  <div style={{fontSize:10,color:"var(--tx3)"}}>記録: {r.createdBy||""}</div>
                </div>
              </div>
            ))}
          </div>
        ));
      })()}
    </div>}

    </div>
  </div>;
}

// ─── ルート編集フォーム（TransportScreen から分離） ───
function RouteEditForm({route, facUsers, isNew, onSave, onCancel, onDelete}){
  const [f,setF]=useState({...route});
  const [stops,setStops]=useState(route.stops?[...route.stops.map(s=>({...s}))]:[] );
  const upd=(k,v)=>setF(p=>({...p,[k]:v}));

  const addStop=()=>{
    const next={order:stops.length+1,userId:"",userName:"",address:"",estimatedTime:"",note:""};
    setStops(p=>[...p,next]);
  };
  const removeStop=(i)=>setStops(p=>p.filter((_,j)=>j!==i).map((s,j)=>({...s,order:j+1})));
  const updStop=(i,k,v)=>{
    setStops(p=>p.map((s,j)=>{
      if(j!==i) return s;
      // ユーザー選択時は名前と住所を自動入力
      if(k==="userId"){
        const u=facUsers.find(x=>x.id===v);
        return {...s,userId:v,userName:u?.name||"",address:u?.address||""};
      }
      return {...s,[k]:v};
    }));
  };
  const moveStop=(i,dir2)=>{
    if(dir2===-1&&i===0) return;
    if(dir2===1&&i===stops.length-1) return;
    const arr=[...stops];
    [arr[i],arr[i+dir2]]=[arr[i+dir2],arr[i]];
    setStops(arr.map((s,j)=>({...s,order:j+1})));
  };

  const ROUTE_COLORS=["#3aa0d8","#2caa60","#f07020","#9048d8","#e03838","#a08020"];

  return <div style={{paddingBottom:28}}>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
      <button className="bback" onClick={onCancel}>← 戻る</button>
      <div style={{fontSize:15,fontWeight:900}}>{isNew?"📍 新しいルートを作成":"📍 ルートを編集"}</div>
    </div>

    {/* 基本情報 */}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:16,marginBottom:12,boxShadow:"var(--sh)"}}>
      <div style={{fontSize:11,fontWeight:700,color:"var(--tl)",marginBottom:12}}>▍基本情報</div>
      <div className="fg"><label className="fl">ルート名 <span style={{color:"var(--ro)"}}>*</span></label>
        <input className="fi" value={f.name} onChange={e=>upd("name",e.target.value)} placeholder="例: ルートA（午後）"/></div>
      <div className="fg"><label className="fl">方向</label>
        <div style={{display:"flex",gap:8}}>
          {["来所","退所"].map(d=><button key={d} onClick={()=>upd("direction",d)}
            style={{padding:"7px 16px",borderRadius:9,fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",
              background:f.direction===d?"var(--tl)":"var(--bg)",color:f.direction===d?"#fff":"var(--tx3)",border:`1.5px solid ${f.direction===d?"var(--tl)":"var(--bd)"}`}}>
            {d}
          </button>)}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div className="fg" style={{marginBottom:0}}><label className="fl">担当ドライバー</label>
          <input className="fi" value={f.driver} onChange={e=>upd("driver",e.target.value)} placeholder="担当者名"/></div>
        <div className="fg" style={{marginBottom:0}}><label className="fl">車両</label>
          <input className="fi" value={f.vehicle} onChange={e=>upd("vehicle",e.target.value)} placeholder="例: 白いワンボックス"/></div>
      </div>
      <div className="fg" style={{marginTop:10}}><label className="fl">ルートカラー</label>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {ROUTE_COLORS.map(c=><button key={c} onClick={()=>upd("color",c)}
            style={{width:28,height:28,borderRadius:"50%",background:c,border:`3px solid ${f.color===c?"var(--tx)":"transparent"}`,cursor:"pointer",flexShrink:0}}/>)}
        </div>
      </div>
    </div>

    {/* 停留所リスト */}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:16,marginBottom:12,boxShadow:"var(--sh)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontSize:11,fontWeight:700,color:"var(--tl)"}}>▍停留所リスト</div>
        <button onClick={addStop}
          style={{padding:"5px 12px",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"rgba(58,160,216,0.1)",border:"1.5px solid var(--tl)",color:"var(--tl)"}}>
          ＋ 停留所追加
        </button>
      </div>
      {stops.length===0&&<div style={{textAlign:"center",color:"var(--tx3)",fontSize:12,padding:"16px 0"}}>停留所がありません。追加してください。</div>}
      {stops.map((s,i)=>(
        <div key={i} style={{background:"var(--bg)",borderRadius:10,padding:12,marginBottom:10,border:"1px solid var(--bd)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:24,height:24,borderRadius:"50%",background:f.color||"var(--tl)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:900,color:"#fff"}}>
                {i+1}
              </div>
              <span style={{fontSize:11,fontWeight:700,color:"var(--tx2)"}}>停留所 {i+1}</span>
            </div>
            <div style={{display:"flex",gap:4}}>
              <button onClick={()=>moveStop(i,-1)} disabled={i===0}
                style={{padding:"3px 7px",borderRadius:7,fontSize:12,cursor:i===0?"default":"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"var(--bg)",border:"1px solid var(--bd)",color:i===0?"var(--bd)":"var(--tx3)",opacity:i===0?0.4:1}}>▲</button>
              <button onClick={()=>moveStop(i,1)} disabled={i===stops.length-1}
                style={{padding:"3px 7px",borderRadius:7,fontSize:12,cursor:i===stops.length-1?"default":"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"var(--bg)",border:"1px solid var(--bd)",color:i===stops.length-1?"var(--bd)":"var(--tx3)",opacity:i===stops.length-1?0.4:1}}>▼</button>
              <button onClick={()=>removeStop(i)}
                style={{padding:"3px 8px",borderRadius:7,fontSize:11,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"rgba(224,56,56,0.08)",border:"1px solid rgba(224,56,56,0.25)",color:"var(--ro)"}}>
                ✕
              </button>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div className="fg" style={{marginBottom:0}}><label className="fl">利用者</label>
              <select className="fi" style={{marginBottom:0}} value={s.userId} onChange={e=>updStop(i,"userId",e.target.value)}>
                <option value="">選択してください</option>
                {facUsers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="fg" style={{marginBottom:0}}><label className="fl">予定時刻</label>
              <input className="fi" style={{marginBottom:0}} type="time" value={s.estimatedTime} onChange={e=>updStop(i,"estimatedTime",e.target.value)}/></div>
          </div>
          <div className="fg" style={{marginTop:8,marginBottom:0}}><label className="fl">住所</label>
            <input className="fi" style={{marginBottom:0}} value={s.address} onChange={e=>updStop(i,"address",e.target.value)} placeholder="自宅住所"/></div>
          <div className="fg" style={{marginTop:8,marginBottom:0}}><label className="fl">備考</label>
            <input className="fi" style={{marginBottom:0}} value={s.note} onChange={e=>updStop(i,"note",e.target.value)} placeholder="注意事項など"/></div>
        </div>
      ))}
    </div>

    <div style={{display:"flex",gap:10}}>
      <button className="bcancel" onClick={onCancel}>キャンセル</button>
      {!isNew&&<button onClick={()=>{if(window.confirm("このルートを削除しますか？"))onDelete(f.id);}}
        style={{padding:"10px 16px",borderRadius:10,background:"rgba(224,56,56,0.1)",color:"var(--ro)",fontWeight:700,fontSize:13,border:"1.5px solid rgba(224,56,56,0.3)",cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>
        🗑 削除
      </button>}
      <button className="bsave" onClick={()=>onSave({...f,stops})}
        disabled={!f.name.trim()}
        style={{opacity:!f.name.trim()?0.5:1,flex:1}}>
        💾 {isNew?"ルートを作成":"ルートを更新"}
      </button>
    </div>
  </div>;
}

// ==================== PARENT MESSAGES (LINE風) ====================
function ParentMessages({user,store,onBack}){
  // ─ 基本ステート ─
  const [selUserId,setSelUserId]=useState(null);
  const [newMode,setNewMode]=useState(false);       // 新規1件送信
  const [broadcastMode,setBroadcastMode]=useState(false); // 一斉送信
  const [msgFilter,setMsgFilter]=useState("all");   // all / unread / waiting / urgent
  const [inputText,setInputText]=useState("");
  const [photoData,setPhotoData]=useState(null);
  const [isUrgent,setIsUrgent]=useState(false);     // 🚨 緊急フラグ
  const [newTo,setNewTo]=useState("");
  const [newBody,setNewBody]=useState("");
  const [newPhotoData,setNewPhotoData]=useState(null);
  const [newUrgent,setNewUrgent]=useState(false);   // 新規送信の緊急フラグ
  const [tmplCategory,setTmplCategory]=useState("日常"); // テンプレートカテゴリー
  // 一斉送信用
  const [bcText,setBcText]=useState("");
  const [bcPhoto,setBcPhoto]=useState(null);
  const [bcSelected,setBcSelected]=useState([]);    // 送信先userId[]
  const [bcSent,setBcSent]=useState(false);         // 送信完了フラグ
  const [bcUrgent,setBcUrgent]=useState(false);     // 一斉送信の緊急フラグ
  const msgEndRef=useRef(null);
  const photoInputRef=useRef(null);
  const newPhotoInputRef=useRef(null);
  const bcPhotoRef=useRef(null);

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

  // 施設→保護者 / 保護者→施設 判定
  const isFromFacility=(m)=>m.from&&m.from!=="保護者"&&!m.from.includes("保護者");

  // スレッド集計
  const threads=allThreadUsers.map(u=>{
    const uMsgs=allMsgs.filter(m=>m.userId===u.id).sort((a,b)=>a.time>b.time?1:-1);
    const unread=uMsgs.filter(m=>!m.read).length;
    const latest=uMsgs[uMsgs.length-1];
    // 施設→保護者メッセージで「未送信既読」（parentReadがfalse）のもの
    const waitingRead=uMsgs.filter(m=>isFromFacility(m)&&m.parentRead===false).length;
    return {user:u,msgs:uMsgs,unread,waitingRead,latest};
  }).filter(t=>t.msgs.length>0||facUsers.some(u=>u.id===t.user.id));

  // フィルター適用
  const filteredThreads=threads.filter(t=>{
    if(msgFilter==="unread") return t.unread>0;
    if(msgFilter==="waiting") return t.waitingRead>0;
    if(msgFilter==="urgent") return t.msgs.some(m=>m.isUrgent&&!m.parentRead);
    return true;
  }).sort((a,b)=>{
    // 緊急メッセージがあるスレッドを最上位に
    const aUrgent=a.msgs.some(m=>m.isUrgent&&!m.parentRead)?1:0;
    const bUrgent=b.msgs.some(m=>m.isUrgent&&!m.parentRead)?1:0;
    if(bUrgent!==aUrgent) return bUrgent-aUrgent;
    return b.unread-a.unread||(b.latest?.time||"")>(a.latest?.time||"")?1:-1;
  });

  const selThread=filteredThreads.find(t=>t.user.id===selUserId)||threads.find(t=>t.user.id===selUserId);
  const selUser=selThread?.user;

  // スクロール
  useEffect(()=>{msgEndRef.current?.scrollIntoView({behavior:"smooth"});},[selUserId,allMsgs.length]);

  // スレッドを開いたとき・新着時に未読を既読にする
  useEffect(()=>{
    if(!selUserId) return;
    allMsgs.filter(m=>m.userId===selUserId&&!m.read).forEach(m=>store.markRead(m.id));
  },[selUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─ スレッド内送信 ─
  const sendInThread=()=>{
    if(!inputText.trim()&&!photoData) return;
    if(!selUserId) return;
    store.addMsg({
      id:genId(),userId:selUserId,userName:selUser?.name||"",
      facilityId:user.selectedFacilityId,from:user.displayName,
      body:inputText,time:nowStr(),read:true,
      parentRead:false,parentReadAt:null,
      replies:[],isBroadcast:false,
      isUrgent:isUrgent,          // 🚨 緊急フラグ
      ...(photoData?{photoData}:{})
    });
    setInputText("");setPhotoData(null);setIsUrgent(false);
  };

  // ─ 新規1件送信 ─
  const sendNew=()=>{
    if(!newTo||(!newBody.trim()&&!newPhotoData)) return;
    const u=facUsers.find(x=>x.id===newTo);
    store.addMsg({
      id:genId(),userId:newTo,userName:u?.name||"",
      facilityId:user.selectedFacilityId,from:user.displayName,
      body:newBody,time:nowStr(),read:true,
      parentRead:false,parentReadAt:null,
      replies:[],isBroadcast:false,
      isUrgent:newUrgent,
      ...(newPhotoData?{photoData:newPhotoData}:{})
    });
    setNewMode(false);setNewTo("");setNewBody("");setNewPhotoData(null);setNewUrgent(false);
    setSelUserId(newTo);
  };

  // ─ 一斉送信 ─
  const sendBroadcast=()=>{
    if(!bcText.trim()&&!bcPhoto) return;
    if(bcSelected.length===0) return;
    const batchId=genId(); // 一斉送信グループID
    bcSelected.forEach(uid=>{
      const u=facUsers.find(x=>x.id===uid);
      store.addMsg({
        id:genId(),userId:uid,userName:u?.name||"",
        facilityId:user.selectedFacilityId,from:user.displayName,
        body:bcText,time:nowStr(),read:true,
        parentRead:false,parentReadAt:null,
        replies:[],isBroadcast:true,broadcastId:batchId,
        isUrgent:bcUrgent,
        ...(bcPhoto?{photoData:bcPhoto}:{})
      });
    });
    store.showToast(`📢 ${bcSelected.length}名に一斉送信しました`);
    setBcSent(true);
    setBcText("");setBcPhoto(null);
  };

  // ─ 保護者既読を手動確認 ─
  const markParentRead=(msgId)=>{
    store.updMsg(msgId,{parentRead:true,parentReadAt:nowStr()});
    store.showToast("既読確認を記録しました");
  };

  // ─── テンプレートメッセージ（カテゴリー別） ───
  const MSG_TEMPLATE_MAP={
    "日常":[
      "本日も元気に参加できました。",
      "本日の活動の様子をお伝えします。",
      "今日もよく頑張っていました。",
      "笑顔で一日過ごすことができました。",
      "今週の活動の振り返りをお送りします。",
    ],
    "体調":[
      "本日、体調が優れない様子が見られました。ご自宅での様子をお聞かせください。",
      "発熱が確認されました。お迎えをお願いできますでしょうか。",
      "本日は食欲が少ない様子でした。ご自宅での様子はいかがでしょうか。",
      "体調にご注意ください。無理をせずお休みいただいても大丈夫です。",
    ],
    "お知らせ":[
      "次回のご利用日についてご確認ください。",
      "施設からのお知らせです。",
      "持ち物についてご確認をお願いします。",
      "個別支援計画についてご確認いただきたい事項があります。",
      "来月のイベントについてお知らせします。",
    ],
    "緊急":[
      "【緊急】お子様の状態について至急ご連絡ください。",
      "【緊急】発熱（38℃以上）のため至急お迎えをお願いします。",
      "【緊急】ケガがありました。詳細をお電話でお伝えします。",
    ],
  };
  const MSG_TEMPLATES = MSG_TEMPLATE_MAP[tmplCategory] || MSG_TEMPLATE_MAP["日常"];

  // ===== 一斉送信画面 =====
  if(broadcastMode) {
    const allSelected=bcSelected.length===facUsers.length;
    const toggleAll=()=>setBcSelected(allSelected?[]:facUsers.map(u=>u.id));
    const toggleUser=(uid)=>setBcSelected(p=>p.includes(uid)?p.filter(x=>x!==uid):[...p,uid]);

    if(bcSent){
      // 送信完了後の既読率表示
      const sentMsgs=allMsgs.filter(m=>m.isBroadcast&&m.from===user.displayName)
        .filter((m,_,arr)=>arr.some(x=>x.broadcastId===m.broadcastId));
      const latestBatch=[...new Set(sentMsgs.map(m=>m.broadcastId))][0];
      const batchMsgs=allMsgs.filter(m=>m.broadcastId===latestBatch);
      const readCount=batchMsgs.filter(m=>m.parentRead).length;
      return <FlowWrap title="📢 一斉送信 — 送信完了" onBack={()=>{setBroadcastMode(false);setBcSent(false);}}>
        <div style={{textAlign:"center",padding:"20px 0"}}>
          <div style={{fontSize:40,marginBottom:8}}>✅</div>
          <div style={{fontSize:15,fontWeight:700,color:"var(--gr)"}}>送信完了</div>
          <div style={{fontSize:12,color:"var(--tx3)",marginTop:4}}>{bcSelected.length}名に送信しました</div>
        </div>
        {batchMsgs.length>0&&<>
          <div style={{fontSize:12,fontWeight:700,color:"var(--tx2)",marginBottom:8}}>📊 既読確認状況</div>
          <div style={{background:"var(--bg)",borderRadius:12,padding:14,marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              <span style={{fontSize:13,fontWeight:700}}>既読率</span>
              <span style={{fontSize:13,fontWeight:700,color:"var(--tl)"}}>{readCount}/{batchMsgs.length}名</span>
            </div>
            <div style={{height:8,borderRadius:4,background:"var(--bd)",overflow:"hidden"}}>
              <div style={{height:"100%",borderRadius:4,background:"var(--tl)",width:`${batchMsgs.length>0?readCount/batchMsgs.length*100:0}%`,transition:"width .5s"}}/>
            </div>
            <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:8}}>
              {batchMsgs.map(m=>{
                const u2=facUsers.find(x=>x.id===m.userId);
                return <div key={m.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:"var(--wh)",borderRadius:9,border:"1px solid var(--bd)"}}>
                  <span style={{fontSize:12,fontWeight:700}}>{u2?.name||m.userName}</span>
                  {m.parentRead
                    ?<span style={{fontSize:11,color:"var(--gr)",fontWeight:700}}>✅ 既読 {m.parentReadAt?.slice(-8)||""}</span>
                    :<button onClick={()=>markParentRead(m.id)}
                      style={{fontSize:11,padding:"4px 10px",borderRadius:8,background:"rgba(58,160,216,0.1)",border:"1.5px solid var(--tl)",color:"var(--tl)",fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>
                      未読 → 確認済みに
                    </button>}
                </div>;
              })}
            </div>
          </div>
        </>}
        <button className="bsave" onClick={()=>{setBroadcastMode(false);setBcSent(false);}}>スレッド一覧に戻る</button>
      </FlowWrap>;
    }

    return <FlowWrap title="📢 一斉送信" onBack={()=>setBroadcastMode(false)}>
      {/* テンプレートカテゴリー */}
      <div style={{display:"flex",gap:5,marginBottom:8}}>
        {Object.keys(MSG_TEMPLATE_MAP).map(cat=>(
          <button key={cat} onClick={()=>setTmplCategory(cat)}
            style={{padding:"4px 10px",borderRadius:7,fontSize:11,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",fontWeight:700,
              background:tmplCategory===cat?(cat==="緊急"?"var(--ro)":"var(--tl)"):"var(--bg)",
              color:tmplCategory===cat?"#fff":"var(--tx3)",border:"1.5px solid",
              borderColor:tmplCategory===cat?(cat==="緊急"?"var(--ro)":"var(--tl)"):"var(--bd)"}}>
            {cat==="緊急"?"🚨 "+cat:cat}
          </button>
        ))}
      </div>
      {/* テンプレート選択 */}
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:14}}>
        {MSG_TEMPLATES.map(t=><button key={t} onClick={()=>{setBcText(t);if(tmplCategory==="緊急")setBcUrgent(true);}}
          style={{padding:"5px 10px",borderRadius:9,fontSize:11,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",
            background:bcText===t?(tmplCategory==="緊急"?"rgba(224,56,56,0.15)":"var(--tl)"):"var(--bg)",
            color:bcText===t?(tmplCategory==="緊急"?"var(--ro)":"#fff"):"var(--tx3)",
            border:`1.5px solid ${bcText===t?(tmplCategory==="緊急"?"var(--ro)":"var(--tl)"):"var(--bd)"}`}}>
          {t}
        </button>)}
      </div>

      {/* 緊急フラグ */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,padding:"8px 12px",background:bcUrgent?"rgba(224,56,56,0.08)":"var(--bg)",borderRadius:10,border:`1.5px solid ${bcUrgent?"var(--ro)":"var(--bd)"}`}}>
        <button onClick={()=>setBcUrgent(p=>!p)}
          style={{padding:"5px 12px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",
            background:bcUrgent?"var(--ro)":"var(--wh)",color:bcUrgent?"#fff":"var(--tx3)",border:`1.5px solid ${bcUrgent?"var(--ro)":"var(--bd)"}`}}>
          🚨 緊急フラグ
        </button>
        <span style={{fontSize:11,color:bcUrgent?"var(--ro)":"var(--tx3)"}}>
          {bcUrgent?"全員に緊急メッセージとして送信":"通常メッセージ"}
        </span>
      </div>

      {/* メッセージ入力 */}
      <div className="slbl">メッセージ内容 <span style={{color:"var(--ro)"}}>*</span></div>
      <textarea className="fta" style={{minHeight:100,borderColor:bcUrgent?"var(--ro)":"var(--bd)"}} placeholder="全員に送るメッセージを入力..." value={bcText} onChange={e=>setBcText(e.target.value)}/>

      {/* 写真添付 */}
      <input type="file" accept="image/*" ref={bcPhotoRef} style={{display:"none"}}
        onChange={e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>setBcPhoto(ev.target.result);r.readAsDataURL(f);e.target.value="";}}/>
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:14}}>
        <button onClick={()=>bcPhotoRef.current?.click()}
          style={{padding:"8px 12px",background:"var(--bg)",border:"1.5px solid var(--bd)",borderRadius:9,cursor:"pointer",fontSize:13,fontFamily:"'Noto Sans JP',sans-serif"}}>
          📷 写真を添付
        </button>
        {bcPhoto&&<div style={{position:"relative",display:"inline-block"}}>
          <img src={bcPhoto} alt="" style={{height:50,borderRadius:6,border:"1.5px solid var(--bd)"}}/>
          <button onClick={()=>setBcPhoto(null)} style={{position:"absolute",top:-7,right:-7,background:"var(--ro)",color:"#fff",border:"none",borderRadius:"50%",width:18,height:18,fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>×</button>
        </div>}
      </div>

      {/* 宛先選択 */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{fontSize:11,fontWeight:700,color:"var(--tl)"}}>👥 送信先 — {bcSelected.length}/{facUsers.length}名選択</div>
        <button onClick={toggleAll}
          style={{fontSize:11,padding:"5px 10px",borderRadius:8,background:allSelected?"var(--tl)":"var(--bg)",color:allSelected?"#fff":"var(--tx3)",border:`1.5px solid ${allSelected?"var(--tl)":"var(--bd)"}`,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",fontWeight:700}}>
          {allSelected?"選択解除":"全員選択"}
        </button>
      </div>
      <div style={{background:"var(--bg)",borderRadius:10,padding:"6px 0",marginBottom:16}}>
        {facUsers.map(u=>(
          <label key={u.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 14px",cursor:"pointer",borderBottom:"1px solid var(--bd)"}}>
            <input type="checkbox" checked={bcSelected.includes(u.id)} onChange={()=>toggleUser(u.id)} style={{width:16,height:16}}/>
            <div style={{width:32,height:32,borderRadius:"50%",background:"var(--tl)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"#fff",fontWeight:700,flexShrink:0}}>
              {u.name?.[0]||"?"}
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700}}>{u.name}</div>
              <div style={{fontSize:10,color:"var(--tx3)"}}>{u.grade||""}</div>
            </div>
            {bcSelected.includes(u.id)&&<span style={{fontSize:11,color:"var(--gr)",fontWeight:700}}>✓</span>}
          </label>
        ))}
      </div>

      <button className="bsave" onClick={sendBroadcast}
        disabled={(!bcText.trim()&&!bcPhoto)||bcSelected.length===0}
        style={{opacity:(!bcText.trim()&&!bcPhoto)||bcSelected.length===0?0.5:1,background:bcUrgent?"var(--ro)":undefined}}>
        {bcUrgent?"🚨 ":"📢 "}{bcSelected.length}名に{bcUrgent?"緊急":"一斉"}送信する
      </button>
    </FlowWrap>;
  }

  // ===== 新規1件送信画面 =====
  if(newMode) return <FlowWrap title="✉️ 新規メッセージ" onBack={()=>setNewMode(false)}>
    <div className="slbl">宛先（利用者）</div>
    <select className="fi" style={{marginBottom:14}} value={newTo} onChange={e=>setNewTo(e.target.value)}>
      <option value="">選択してください</option>
      {facUsers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
    </select>

    {/* テンプレートカテゴリー */}
    <div style={{display:"flex",gap:5,marginBottom:8}}>
      {Object.keys(MSG_TEMPLATE_MAP).map(cat=>(
        <button key={cat} onClick={()=>setTmplCategory(cat)}
          style={{padding:"4px 10px",borderRadius:7,fontSize:11,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",fontWeight:700,
            background:tmplCategory===cat?(cat==="緊急"?"var(--ro)":"var(--tl)"):"var(--bg)",
            color:tmplCategory===cat?"#fff":"var(--tx3)",border:"1.5px solid",
            borderColor:tmplCategory===cat?(cat==="緊急"?"var(--ro)":"var(--tl)"):"var(--bd)"}}>
          {cat==="緊急"?"🚨 "+cat:cat}
        </button>
      ))}
    </div>
    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
      {MSG_TEMPLATES.map(t=><button key={t} onClick={()=>{setNewBody(t);if(tmplCategory==="緊急")setNewUrgent(true);}}
        style={{padding:"5px 10px",borderRadius:9,fontSize:11,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",
          background:newBody===t?(tmplCategory==="緊急"?"rgba(224,56,56,0.15)":"var(--tl)"):"var(--bg)",
          color:newBody===t?(tmplCategory==="緊急"?"var(--ro)":"#fff"):"var(--tx3)",
          border:`1.5px solid ${newBody===t?(tmplCategory==="緊急"?"var(--ro)":"var(--tl)"):"var(--bd)"}`}}>
        {t}
      </button>)}
    </div>

    {/* 緊急フラグ */}
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,padding:"8px 12px",background:newUrgent?"rgba(224,56,56,0.08)":"var(--bg)",borderRadius:10,border:`1.5px solid ${newUrgent?"var(--ro)":"var(--bd)"}`}}>
      <button onClick={()=>setNewUrgent(p=>!p)}
        style={{padding:"5px 12px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",
          background:newUrgent?"var(--ro)":"var(--wh)",color:newUrgent?"#fff":"var(--tx3)",border:`1.5px solid ${newUrgent?"var(--ro)":"var(--bd)"}`}}>
        🚨 緊急フラグ
      </button>
      <span style={{fontSize:11,color:newUrgent?"var(--ro)":"var(--tx3)"}}>
        {newUrgent?"緊急メッセージとして送信します":"通常メッセージ"}
      </span>
    </div>

    <div className="slbl">メッセージ内容</div>
    <textarea className="fta" style={{minHeight:120,borderColor:newUrgent?"var(--ro)":"var(--bd)"}} placeholder="保護者へのメッセージを入力..." value={newBody} onChange={e=>setNewBody(e.target.value)}/>
    <input type="file" accept="image/*" ref={newPhotoInputRef} style={{display:"none"}}
      onChange={e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>setNewPhotoData(ev.target.result);r.readAsDataURL(f);e.target.value="";}}/>
    {newPhotoData&&<div style={{margin:"10px 0",position:"relative",display:"inline-block"}}>
      <img src={newPhotoData} alt="" style={{maxWidth:200,maxHeight:160,borderRadius:8,border:"1.5px solid var(--bd)"}}/>
      <button onClick={()=>setNewPhotoData(null)} style={{position:"absolute",top:-8,right:-8,background:"var(--ro)",color:"#fff",border:"none",borderRadius:"50%",width:20,height:20,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>×</button>
    </div>}
    <div style={{display:"flex",gap:8,marginTop:14}}>
      <button onClick={()=>newPhotoInputRef.current?.click()} style={{padding:"9px 14px",background:"var(--bg)",border:"1.5px solid var(--bd)",borderRadius:10,cursor:"pointer",fontSize:18}}>📷</button>
      <button className="bsave" disabled={!newTo||(!newBody.trim()&&!newPhotoData)} onClick={sendNew}
        style={{flex:1,background:newUrgent?"var(--ro)":undefined}}>
        {newUrgent?"🚨 緊急送信する":"送信する"}
      </button>
    </div>
  </FlowWrap>;

  // ===== チャット画面（利用者スレッド選択時）=====
  if(selUserId&&selUser) {
    const threadMsgs=allMsgs.filter(m=>m.userId===selUserId).sort((a,b)=>a.time>b.time?-1:1).reverse();
    // 施設→保護者で未既読のメッセージ数
    const unconfirmedCount=threadMsgs.filter(m=>isFromFacility(m)&&m.parentRead===false).length;

    return <div className="fl-wrap" style={{display:"flex",flexDirection:"column",height:"100vh",maxHeight:"100vh"}}>
      {/* ヘッダー */}
      <div className="fl-hd" style={{flexShrink:0}}>
        <button className="bback" onClick={()=>setSelUserId(null)}>← 戻る</button>
        <div style={{flex:1}}>
          <div className="fl-title" style={{marginBottom:0}}>💬 {selUser.name}</div>
          <div style={{fontSize:10,color:"var(--tx3)",marginTop:1}}>
            {facName}
            {unconfirmedCount>0&&<span style={{marginLeft:6,color:"var(--am)",fontWeight:700}}>保護者未読 {unconfirmedCount}件</span>}
          </div>
        </div>
        <button className="bexp" style={{background:"#fff8f0",borderColor:"var(--ac)",color:"var(--ac)",fontSize:11,padding:"5px 10px"}}
          onClick={()=>{
            const lines=threadMsgs.map(m=>`[${m.time}] ${isFromFacility(m)?m.from:"保護者"}: ${m.body}${m.parentRead?" (既読)":""}`).join("\n");
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
          const isRead=m.parentRead===true;
          const isUnread=fromFac&&m.parentRead===false;
          return <div key={m.id||i} style={{display:"flex",flexDirection:"column",alignItems:fromFac?"flex-end":"flex-start"}}>
            {/* 緊急ラベル */}
            {m.isUrgent&&fromFac&&<div style={{fontSize:10,color:"var(--ro)",fontWeight:700,marginBottom:2,paddingRight:4}}>🚨 緊急メッセージ</div>}
            {/* 一斉送信ラベル */}
            {m.isBroadcast&&fromFac&&<div style={{fontSize:9,color:"var(--am)",marginBottom:2,paddingRight:4}}>📢 一斉送信</div>}
            {/* 送信者名 */}
            <div style={{fontSize:10,color:"var(--tx3)",marginBottom:2,paddingLeft:fromFac?0:4,paddingRight:fromFac?4:0}}>
              {fromFac?(m.from||"施設スタッフ"):"保護者"}
            </div>
            <div style={{display:"flex",alignItems:"flex-end",gap:6,flexDirection:fromFac?"row-reverse":"row"}}>
              {/* アバター */}
              <div style={{width:32,height:32,borderRadius:"50%",background:fromFac?"var(--tl)":"#98a0b0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0,color:"#fff"}}>
                {fromFac?"🏥":"👨‍👩‍👧"}
              </div>
              {/* 吹き出し */}
              <div style={{
                maxWidth:"70%",padding:"9px 13px",
                borderRadius:fromFac?"16px 4px 16px 16px":"4px 16px 16px 16px",
                background:fromFac?(m.isUrgent?"var(--ro)":"var(--tl)"):"#fff",
                color:fromFac?"#fff":"var(--tx)",
                fontSize:13,lineHeight:1.65,
                boxShadow:m.isUrgent?"0 2px 8px rgba(224,56,56,0.35)":"0 1px 3px rgba(0,0,0,0.12)",
                wordBreak:"break-word",whiteSpace:"pre-wrap",
                border:m.isUrgent&&!fromFac?"1.5px solid rgba(224,56,56,0.4)":"none"
              }}>
                {m.body}
                {m.photoData&&<img src={m.photoData} alt="添付画像" style={{display:"block",maxWidth:200,maxHeight:200,borderRadius:8,marginTop:m.body?8:0,cursor:"pointer"}} onClick={()=>window.open(m.photoData)}/>}
              </div>
              {/* 既読・時刻 */}
              <div style={{fontSize:10,color:"var(--tx3)",flexShrink:0,textAlign:fromFac?"right":"left",minWidth:40}}>
                {fromFac&&(
                  isRead
                    ?<div style={{color:"var(--gr)",fontWeight:700}}>✅ 既読{m.parentReadAt?<span style={{display:"block",fontSize:9}}>{m.parentReadAt.slice(-8)}</span>:null}</div>
                    :<button onClick={()=>markParentRead(m.id)}
                      style={{fontSize:10,color:"var(--am)",fontWeight:700,background:"none",border:"1px dashed var(--am)",borderRadius:5,padding:"2px 5px",cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",display:"block",marginBottom:2}}>
                      未読
                    </button>
                )}
                <div style={{fontFamily:"'DM Mono',monospace"}}>{m.time?.slice(-5)||""}</div>
              </div>
            </div>
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

      {/* テンプレートカテゴリーバー */}
      <div style={{flexShrink:0,padding:"4px 12px 0",background:"var(--bg)",borderTop:"1px solid var(--bd)",display:"flex",gap:4}}>
        {Object.keys(MSG_TEMPLATE_MAP).map(cat=>(
          <button key={cat} onClick={()=>setTmplCategory(cat)}
            style={{padding:"3px 9px",borderRadius:7,fontSize:10,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",fontWeight:700,
              background:tmplCategory===cat?(cat==="緊急"?"var(--ro)":"var(--tl)"):"transparent",
              color:tmplCategory===cat?"#fff":"var(--tx3)",border:"none"}}>
            {cat==="緊急"?"🚨 "+cat:cat}
          </button>
        ))}
      </div>
      {/* テンプレートバー */}
      <div style={{flexShrink:0,padding:"4px 12px 6px",background:"var(--bg)",overflowX:"auto",whiteSpace:"nowrap",display:"flex",gap:6}}>
        {MSG_TEMPLATES.map(t=><button key={t} onClick={()=>{setInputText(t);if(tmplCategory==="緊急")setIsUrgent(true);}}
          style={{padding:"5px 10px",borderRadius:9,fontSize:11,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",
            background:"var(--wh)",border:`1px solid ${tmplCategory==="緊急"?"rgba(224,56,56,0.4)":"var(--bd)"}`,
            color:tmplCategory==="緊急"?"var(--ro)":"var(--tx3)",flexShrink:0}}>
          {t}
        </button>)}
      </div>

      {/* 入力エリア */}
      <input type="file" accept="image/*" ref={photoInputRef} style={{display:"none"}}
        onChange={e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>setPhotoData(ev.target.result);r.readAsDataURL(f);e.target.value="";}}/>
      {/* 緊急フラグ表示バー */}
      {isUrgent&&<div style={{flexShrink:0,padding:"5px 14px",background:"rgba(224,56,56,0.1)",borderTop:"1px solid rgba(224,56,56,0.3)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:11,fontWeight:700,color:"var(--ro)"}}>🚨 緊急メッセージとして送信</span>
        <button onClick={()=>setIsUrgent(false)} style={{fontSize:10,color:"var(--ro)",background:"none",border:"none",cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>解除</button>
      </div>}
      <div style={{flexShrink:0,padding:"10px 12px",background:"var(--wh)",borderTop:"1px solid var(--bd)",display:"flex",gap:8,alignItems:"flex-end"}}>
        <button onClick={()=>photoInputRef.current?.click()}
          style={{padding:"8px",background:"var(--bg)",border:"1.5px solid var(--bd)",borderRadius:10,cursor:"pointer",fontSize:18,flexShrink:0,height:40,width:40,display:"flex",alignItems:"center",justifyContent:"center"}}>📷</button>
        <button onClick={()=>setIsUrgent(p=>!p)}
          style={{padding:"8px",background:isUrgent?"rgba(224,56,56,0.15)":"var(--bg)",border:`1.5px solid ${isUrgent?"var(--ro)":"var(--bd)"}`,borderRadius:10,cursor:"pointer",fontSize:16,flexShrink:0,height:40,width:40,display:"flex",alignItems:"center",justifyContent:"center"}}>🚨</button>
        <textarea
          style={{flex:1,border:`1.5px solid ${isUrgent?"var(--ro)":"var(--bd)"}`,borderRadius:12,padding:"9px 12px",fontSize:13,fontFamily:"'Noto Sans JP',sans-serif",resize:"none",lineHeight:1.5,background:"var(--bg)",color:"var(--tx)",outline:"none",maxHeight:120,minHeight:40}}
          placeholder={isUrgent?"🚨 緊急メッセージを入力...":"メッセージを入力..."}
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
  const totalWaiting=allMsgs.filter(m=>isFromFacility(m)&&m.parentRead===false).length;
  const totalUrgent=allMsgs.filter(m=>m.isUrgent&&!m.parentRead).length;

  return <div className="fl-wrap">
    <div className="fl-hd">
      <button className="bback" onClick={onBack}>← 戻る</button>
      <div className="fl-title" style={{flex:1}}>
        💬 保護者連絡
        {totalUrgent>0&&<span style={{fontSize:11,background:"var(--ro)",color:"#fff",borderRadius:9,padding:"1px 7px",marginLeft:6}}>🚨 緊急 {totalUrgent}件</span>}
        {totalUrgent===0&&totalUnread>0&&<span style={{fontSize:11,background:"var(--ro)",color:"#fff",borderRadius:9,padding:"1px 7px",marginLeft:6}}>{totalUnread}件未読</span>}
      </div>
      <div style={{display:"flex",gap:6}}>
        <button className="bexp" style={{fontSize:11,padding:"6px 10px",whiteSpace:"nowrap"}}
          onClick={()=>{setBcSelected(facUsers.map(u=>u.id));setBroadcastMode(true);}}>
          📢 一斉送信
        </button>
        <button className="bnew" style={{fontSize:12,padding:"6px 12px"}} onClick={()=>setNewMode(true)}>＋ 新規</button>
      </div>
    </div>

    {/* フィルター + 統計 */}
    <div style={{padding:"8px 14px",background:"var(--bg)",borderBottom:"1px solid var(--bd)"}}>
      <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
        {[
          {id:"all",    label:"全員"},
          {id:"urgent", label:`🚨 緊急${totalUrgent>0?` (${totalUrgent})`:""}`,isRed:true},
          {id:"unread", label:`未読あり${totalUnread>0?` (${totalUnread})`:""}` },
          {id:"waiting",label:`保護者未既読${totalWaiting>0?` (${totalWaiting})`:""}` },
        ].map(f=>(
          <button key={f.id} onClick={()=>setMsgFilter(f.id)}
            style={{padding:"5px 11px",borderRadius:9,fontSize:11,cursor:"pointer",fontWeight:700,fontFamily:"'Noto Sans JP',sans-serif",
              background:msgFilter===f.id?(f.isRed?"var(--ro)":"var(--tl)"):"var(--wh)",
              color:msgFilter===f.id?"#fff":"var(--tx3)",
              border:`1.5px solid ${msgFilter===f.id?(f.isRed?"var(--ro)":"var(--tl)"):"var(--bd)"}`}}>
            {f.label}
          </button>
        ))}
      </div>
      <div style={{fontSize:10,color:"var(--tx3)"}}>
        表示中: {filteredThreads.length}件 　総メッセージ: {allMsgs.length}件
      </div>
    </div>

    {filteredThreads.length===0
      ?<div style={{textAlign:"center",color:"var(--tx3)",padding:"48px 0",fontSize:13}}>
        {msgFilter==="all"?"利用者が登録されていません":"該当するスレッドがありません"}
      </div>
      :<div style={{display:"flex",flexDirection:"column",gap:0}}>
        {filteredThreads.map(({user:u,msgs:uMsgs,unread,waitingRead,latest})=>{
          const hasUrgent=uMsgs.some(m=>m.isUrgent&&!m.parentRead);
          return <div key={u.id}
            onClick={()=>setSelUserId(u.id)}
            style={{display:"flex",alignItems:"center",gap:12,padding:"13px 14px",
              background:hasUrgent?"rgba(224,56,56,0.04)":"var(--wh)",
              borderBottom:`1px solid ${hasUrgent?"rgba(224,56,56,0.2)":"var(--bd)"}`,
              borderLeft:hasUrgent?"3px solid var(--ro)":"3px solid transparent",
              cursor:"pointer",transition:"background .1s"}}
            onMouseEnter={e=>e.currentTarget.style.background=hasUrgent?"rgba(224,56,56,0.08)":"var(--bg)"}
            onMouseLeave={e=>e.currentTarget.style.background=hasUrgent?"rgba(224,56,56,0.04)":"var(--wh)"}
          >
            {/* アバター */}
            <div style={{width:46,height:46,borderRadius:"50%",background:hasUrgent?"var(--ro)":unread>0?"var(--tl)":"#c0c8d8",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0,color:"#fff",fontWeight:700}}>
              {hasUrgent?"🚨":u.name?.[0]||"?"}
            </div>
            {/* テキスト */}
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                <div style={{fontWeight:700,fontSize:14,color:hasUrgent?"var(--ro)":"var(--tx)",display:"flex",alignItems:"center",gap:5}}>
                  {u.name}
                  {hasUrgent&&<span style={{fontSize:10,background:"var(--ro)",color:"#fff",borderRadius:5,padding:"1px 5px",fontWeight:700}}>緊急</span>}
                </div>
                <div style={{fontSize:10,color:"var(--tx3)",fontFamily:"'DM Mono',monospace",flexShrink:0,marginLeft:8}}>
                  {latest?.time?.slice(0,10)||""}
                </div>
              </div>
              <div style={{fontSize:12,color:"var(--tx2)",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>
                {latest?`${isFromFacility(latest)?latest.from||"施設":"保護者"}: ${latest.body}`:"メッセージなし"}
              </div>
              {waitingRead>0&&<div style={{fontSize:10,color:"var(--am)",fontWeight:700,marginTop:2}}>
                保護者未既読 {waitingRead}件
              </div>}
            </div>
            {/* バッジエリア */}
            <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"center"}}>
              {unread>0&&<div style={{minWidth:20,height:20,borderRadius:10,background:"var(--ro)",color:"#fff",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 5px"}}>
                {unread}
              </div>}
              {waitingRead>0&&<div style={{minWidth:20,height:20,borderRadius:10,background:"var(--am)",color:"#fff",fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 5px"}}>
                {waitingRead}
              </div>}
            </div>
            <div style={{color:"var(--bd)",fontSize:14}}>›</div>
          </div>;
        })}
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
        {/* サービス種別（施設ごとに選択肢が変わる） */}
        <div style={{marginBottom:12}}>
          <label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",letterSpacing:1,display:"block",marginBottom:7}}>サービス種別 <span style={{color:"var(--ro)"}}>*</span></label>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {getFacilityServiceTypes(form.facilityId||user.selectedFacilityId||"f1").map(st=><button key={st.id}
              onClick={()=>upd("serviceType",st.id)}
              style={{padding:"8px 16px",borderRadius:9,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",
                borderColor:form.serviceType===st.id?st.color:"var(--bd)",
                background:form.serviceType===st.id?st.bg:"var(--bg)",
                color:form.serviceType===st.id?st.color:"var(--tx3)"}}>
              {st.icon} {st.name}
            </button>)}
          </div>
          {!form.serviceType&&<div style={{fontSize:11,color:"var(--ro)",marginTop:4}}>※ サービス種別を選択してください（請求・記録様式が変わります）</div>}
        </div>
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
  const [bulkMode,setBulkMode]=useState(false); // 一括削除モード
  const [checked,setChecked]=useState([]);       // 選択中の利用者ID
  const users=store.dynUsers.filter(u=>user.role==="admin"||u.facilityId===user.selectedFacilityId);

  const isMgr = user.role==="manager"||user.role==="admin";

  // 一括削除実行
  const bulkDelete=()=>{
    if(checked.length===0) return;
    if(!window.confirm(`選択した ${checked.length} 名を完全に削除しますか？\nこの操作は取り消せません。`)) return;
    checked.forEach(id=>store.delUser(id));
    setChecked([]);setBulkMode(false);
  };
  const toggleCheck=(id)=>setChecked(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  const checkAll=()=>setChecked(users.map(u=>u.id));

  // ===== ユーザー選択画面 =====
  if(screen==="list") return (
    <div className="fl-wrap">
      <div className="fl-hd"><button className="bback" onClick={onBack}>← 戻る</button><div className="fl-title">👤 利用者管理</div></div>

      {/* ボタンエリア */}
      {isMgr&&!bulkMode&&<div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        <button className="bsave" style={{maxWidth:200}} onClick={()=>setScreen("register")}>＋ 新規利用者登録</button>
        <button onClick={()=>{setBulkMode(true);setChecked([]);}}
          style={{padding:"9px 16px",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"rgba(224,56,56,0.1)",border:"1.5px solid rgba(224,56,56,0.4)",color:"var(--ro)"}}>
          🗑️ まとめて削除
        </button>
      </div>}

      {/* 一括削除モード バー */}
      {bulkMode&&<div style={{background:"rgba(224,56,56,0.08)",border:"1.5px solid rgba(224,56,56,0.4)",borderRadius:11,padding:"12px 14px",marginBottom:14,display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        <span style={{fontSize:13,fontWeight:700,color:"var(--ro)"}}>🗑️ 削除モード</span>
        <span style={{fontSize:12,color:"var(--tx3)"}}>{checked.length}名選択中</span>
        <button onClick={checkAll} style={{padding:"6px 12px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"var(--bg)",border:"1.5px solid var(--bd)",color:"var(--tx2)"}}>全選択</button>
        <button onClick={()=>setChecked([])} style={{padding:"6px 12px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"var(--bg)",border:"1.5px solid var(--bd)",color:"var(--tx2)"}}>選択解除</button>
        <button onClick={bulkDelete} disabled={checked.length===0}
          style={{padding:"6px 16px",borderRadius:8,fontSize:12,fontWeight:700,cursor:checked.length===0?"not-allowed":"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:checked.length===0?"var(--bg)":"var(--ro)",border:"none",color:checked.length===0?"var(--tx3)":"#fff",opacity:checked.length===0?.5:1}}>
          {checked.length}名を削除
        </button>
        <button onClick={()=>{setBulkMode(false);setChecked([]);}}
          style={{padding:"6px 12px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"var(--bg)",border:"1.5px solid var(--bd)",color:"var(--tx3)",marginLeft:"auto"}}>
          キャンセル
        </button>
      </div>}
      {/* 全体アラートサマリー（人数ベースでカウント） */}
      {(()=>{
        // 件数ではなく「該当する利用者の人数」でカウント
        const urgentCount=users.filter(u=>getUserAlerts(u,store).some(a=>a.status==="expired"||a.status==="urgent")).length;
        const soonCount=users.filter(u=>!getUserAlerts(u,store).some(a=>a.status==="expired"||a.status==="urgent")&&getUserAlerts(u,store).some(a=>a.status==="soon")).length;
        return (urgentCount+soonCount)>0&&<div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
          {urgentCount>0&&<div style={{background:"rgba(224,56,56,0.15)",border:"1.5px solid rgba(224,56,56,0.4)",borderRadius:10,padding:"10px 16px",display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:20}}>🔴</span>
            <div><div style={{fontSize:12,fontWeight:900,color:"var(--ro)"}}>要対応 {urgentCount}名</div><div style={{fontSize:10,color:"var(--ro)",opacity:.8}}>期限切れ・30日以内</div></div>
          </div>}
          {soonCount>0&&<div style={{background:"#fef8e6",border:"1.5px solid #e8d870",borderRadius:10,padding:"10px 16px",display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:20}}>🟡</span>
            <div><div style={{fontSize:12,fontWeight:900,color:"#8a6200"}}>期限間近 {soonCount}名</div><div style={{fontSize:10,color:"#8a6200",opacity:.8}}>90日以内に期限</div></div>
          </div>}
        </div>;
      })()}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10,paddingBottom:28}}>
        {users.map(u=>{
          const age=calcAge(u.dob);
          const ispCount=store.isps.filter(x=>x.userId===u.id).length;
          const latestIsp=store.isps.filter(x=>x.userId===u.id).sort((a,b)=>b.createdAt>a.createdAt?1:-1)[0];
          const isChecked=checked.includes(u.id);
          return <div key={u.id}
            style={{background:bulkMode&&isChecked?"rgba(224,56,56,0.08)":"var(--wh)",border:`1.5px solid ${bulkMode&&isChecked?"var(--ro)":"var(--bd)"}`,borderRadius:12,padding:"14px 13px",cursor:"pointer",boxShadow:"var(--sh)",transition:"all .18s"}}
            onClick={bulkMode?()=>toggleCheck(u.id):()=>{setSelUser(u);setScreen("hub");}}
            onMouseEnter={e=>{if(!bulkMode){e.currentTarget.style.borderColor="var(--tl)";e.currentTarget.style.boxShadow="var(--sh2)";}}}
            onMouseLeave={e=>{if(!bulkMode){e.currentTarget.style.borderColor="var(--bd)";e.currentTarget.style.boxShadow="var(--sh)";}}} >
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              {/* 削除モード時はチェックボックス＋アイコン */}
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                {bulkMode&&<input type="checkbox" checked={isChecked} onChange={()=>toggleCheck(u.id)}
                  onClick={e=>e.stopPropagation()}
                  style={{width:18,height:18,accentColor:"var(--ro)",cursor:"pointer",flexShrink:0}}/>}
                <div style={{width:40,height:40,borderRadius:"50%",background:u.active===false?"var(--bg2)":"linear-gradient(135deg,var(--tl),var(--gr))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>👤</div>
              </div>
              {isMgr&&!bulkMode&&<button onClick={e=>{e.stopPropagation();setSelUser(u);setScreen("edit");}} style={{padding:"3px 8px",borderRadius:6,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"var(--bg)",border:"1.5px solid var(--bd)",color:"var(--tx3)"}}>編集</button>}
            </div>
            <div style={{fontWeight:900,fontSize:14,marginBottom:2,color:u.active===false?"var(--tx3)":"var(--tx)"}}>{u.name}{u.active===false&&<span style={{fontSize:10,color:"var(--bda)",marginLeft:5}}>（無効）</span>}</div>
            <div style={{fontSize:11,color:"var(--tx3)",marginBottom:4}}>{age}歳 ／ {u.diagnosis}</div>
            {/* サービス種別バッジ */}
            {(()=>{const st=getUserServiceType(u);return <span className={`svc-badge svc-${st.id}`} style={{marginBottom:5,display:"inline-flex"}}>{st.icon} {st.short}</span>;})()}
            <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:4,marginTop:4}}>
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
        if(isEdit){ store.updUser2(u.id,u); setSelUser(u); }
        else {
          // 意味のあるID: U-GH-0001 形式で採番
          const newId = genUserId(u.facilityId||user.selectedFacilityId, store.dynUsers);
          store.addUser({...u, id: newId});
        }
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
    const svcType = getUserServiceType(u);
    const isJidou   = u.serviceType==="jidouhattatsu";
    const isVisit   = u.serviceType==="hoikuvisit";
    const TABS=[
      {k:"facesheet",l:"フェイスシート",ic:"📋"},
      {k:"assessment",l:"アセスメント",ic:"📊"},
      {k:"isp_draft",l:"個別支援計画（原案）",ic:"📄"},
      {k:"isp",l:"個別支援計画",ic:"📝"},
      {k:"monitoring",l:"モニタリング",ic:"🔍"},
      {k:"jukyusha",l:"受給者証",ic:"🪪"},
      {k:"soudan_genan",l:"相談支援原案",ic:"📑"},
      ...(isJidou?[
        {k:"dev_record",l:"発達段階記録",ic:"🌱"},
        {k:"parent_support",l:"保護者支援記録",ic:"👨‍👩‍👧"},
      ]:[]),
      ...(isVisit?[
        {k:"visit_record",l:"訪問記録",ic:"🚌"},
      ]:[]),
    ];
    return (
      <div className="fl-wrap">
        <div className="fl-hd"><button className="bback" onClick={()=>setScreen("list")}>← 戻る</button><div className="fl-title">👤 {u.name}</div></div>
        {/* アラートバナー */}
        {(()=>{const alerts=getUserAlerts(u,store);return alerts.filter(a=>a.status!=="ok").length>0&&<AlertBanner alerts={alerts.filter(a=>a.status!=="ok")} onTabClick={setHubTab}/>;})()}
        {/* プロフィールバナー */}
        <div style={{background:"linear-gradient(135deg,var(--tl),var(--gr))",borderRadius:12,padding:"14px 16px",marginBottom:14,color:"#fff",display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:52,height:52,borderRadius:"50%",background:"rgba(255,255,255,0.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0}}>👤</div>
          <div style={{flex:1}}>
            <div style={{fontSize:20,fontWeight:900}}>{u.name}</div>
            <div style={{fontSize:12,opacity:.85,marginTop:2}}>{age}歳（{u.dob}生）／ {u.diagnosis}</div>
            <div style={{fontSize:11,opacity:.75,marginTop:1}}>{FACILITIES.find(f=>f.id===u.facilityId)?.name} ／ 送迎: {u.hasTransport?"あり":"なし"}</div>
            {/* サービス種別バッジ（白抜き） */}
            <span style={{display:"inline-flex",alignItems:"center",gap:4,marginTop:5,padding:"2px 9px",borderRadius:10,fontSize:10,fontWeight:700,background:"rgba(255,255,255,0.22)",border:"1px solid rgba(255,255,255,0.5)",color:"#fff"}}>{svcType.icon} {svcType.name}</span>
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
        {hubTab==="isp"&&<IspUserDetail u={u} user={user} store={store} onBack={()=>setHubTab("facesheet")}/>}
        {/* ===== 個別支援計画（原案） ===== */}
        {hubTab==="isp_draft"&&<IspDraftTab u={u} myIspDrafts={myIspDrafts} user={user} store={store}/>}
        {/* ===== モニタリング ===== */}
        {hubTab==="monitoring"&&<MonitoringTab u={u} myMonitorings={myMonitorings} myIsps={myIsps} user={user} store={store}/>}
        {/* ===== 発達段階記録（児発のみ） ===== */}
        {hubTab==="dev_record"&&<DevRecordTab u={u} user={user} store={store}/>}
        {/* ===== 保護者支援記録（児発のみ） ===== */}
        {hubTab==="parent_support"&&<ParentSupportTab u={u} user={user} store={store}/>}
        {/* ===== 受給者証OCR ===== */}
        {hubTab==="jukyusha"&&<JukyushaTab u={u} user={user} store={store}/>}
        {/* ===== 相談支援原案OCR ===== */}
        {hubTab==="soudan_genan"&&<SoudanGenanTab u={u} user={user} store={store}/>}
        {/* ===== 訪問記録（保育所等訪問のみ） ===== */}
        {hubTab==="visit_record"&&<UserVisitTab u={u} user={user} store={store}/>}
      </div>
    );
  }
  return null;
}

// ===== フェイスシート 入力フィールド（モジュールレベル定義） =====
// ★ 重要1: モジュールレベルで定義（内側に定義すると毎レンダーで再マウントされフォーカスが外れる）
// ★ 重要2: defaultValue（非制御）を使う
//    → controlled input(value=)だとReactが毎キー入力後にDOM値を上書きし、
//      iOS日本語IMEの入力バッファを壊してフォーカスが外れる根本原因になる
//    → 非制御にすることでブラウザ／IMEが入力を自然に処理できる
//    → フォーカスがないときだけrefで外部valueをDOMに同期する
function FacesheetField({label, edit, value, onChange, placeholder="", multi=false}){
  const ref = useRef(null);

  // フォーカスが外れているときのみ、外部から変わったvalueをDOMに同期する
  // （フォーカス中はIMEが入力を管理しているので絶対に触らない）
  useEffect(()=>{
    if(ref.current && document.activeElement !== ref.current){
      ref.current.value = value||"";
    }
  },[value]);

  return <div style={{marginBottom:12}}>
    <label style={{display:"block",fontSize:10,fontWeight:700,color:"var(--tl)",letterSpacing:1,marginBottom:5}}>{label}</label>
    {edit
      ? multi
        ? <textarea ref={ref} className="fta" style={{minHeight:60}}
            defaultValue={value||""} placeholder={placeholder}
            onChange={e=>onChange(e.target.value)}/>
        : <input ref={ref} className="fi"
            defaultValue={value||""} placeholder={placeholder}
            onChange={e=>onChange(e.target.value)}/>
      : <div style={{fontSize:13,color:value?"var(--tx)":"var(--tx3)",padding:"8px 0",borderBottom:"1px solid var(--bg2)",lineHeight:1.6,minHeight:28}}>{value||"未記入"}</div>
    }
  </div>;
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

  // FacesheetField に渡す onChange ヘルパー（各フィールド用）
  const fld=(fkey)=>({
    edit,
    value: fs[fkey]||"",
    onChange: v=>upd(fkey,v),
  });

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
        <FacesheetField {...fld("dob2")} label="生年月日" placeholder="2015-04-10"/>
        <FacesheetField {...fld("gender")} label="性別" placeholder="男・女・その他"/>
        <FacesheetField {...fld("disabilityGrade")} label="障害種別・等級" placeholder="例）療育手帳 B1"/>
        <FacesheetField {...fld("diagDetail")} label="診断名" placeholder="例）自閉スペクトラム症（ASD）"/>
      </div>
      <FacesheetField {...fld("disabilityNote")} label="障害の特記事項" multi placeholder="手帳番号、診断詳細など"/>
    </div>
    {/* 保護者情報 */}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:"16px",marginBottom:12,boxShadow:"var(--sh)"}}>
      <div style={{fontSize:11,fontWeight:700,color:"var(--tl)",letterSpacing:2,marginBottom:12,paddingBottom:8,borderBottom:"2px solid var(--tl)"}}>保護者情報</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
        <FacesheetField {...fld("parentName")} label="保護者氏名" placeholder="山田 花子"/>
        <FacesheetField {...fld("parentRelation")} label="続柄" placeholder="母"/>
        <FacesheetField {...fld("parentTel")} label="連絡先（携帯）" placeholder="090-XXXX-XXXX"/>
        <FacesheetField {...fld("emergencyTel")} label="緊急連絡先" placeholder="090-XXXX-XXXX"/>
        <FacesheetField {...fld("emergencyName")} label="緊急連絡先氏名" placeholder="山田 太郎"/>
        <FacesheetField {...fld("emergencyRelation")} label="緊急連絡先続柄" placeholder="父"/>
      </div>
      <FacesheetField {...fld("address")} label="住所" placeholder="○○市△△1-2-3"/>
    </div>
    {/* 学校情報 */}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:"16px",marginBottom:12,boxShadow:"var(--sh)"}}>
      <div style={{fontSize:11,fontWeight:700,color:"var(--gr)",letterSpacing:2,marginBottom:12,paddingBottom:8,borderBottom:"2px solid var(--gr)"}}>学校情報</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
        <FacesheetField {...fld("school")} label="学校名" placeholder="○○小学校 特別支援学級"/>
        <FacesheetField {...fld("schoolYear")} label="学年" placeholder="4年生"/>
        <FacesheetField {...fld("schoolContact")} label="担任・支援員" placeholder="鈴木 先生"/>
      </div>
    </div>
    {/* 医療情報 */}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:"16px",marginBottom:12,boxShadow:"var(--sh)"}}>
      <div style={{fontSize:11,fontWeight:700,color:"var(--ro)",letterSpacing:2,marginBottom:12,paddingBottom:8,borderBottom:"2px solid var(--ro)"}}>医療情報</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
        <FacesheetField {...fld("medicalInstitution")} label="医療機関名" placeholder="○○クリニック"/>
        <FacesheetField {...fld("doctor")} label="主治医" placeholder="田中 医師"/>
      </div>
      <FacesheetField {...fld("medications")} label="服薬状況" multi placeholder="例）リスパダール 0.5mg 朝・夕食後"/>
      <FacesheetField {...fld("allergies")} label="アレルギー・禁忌事項" multi placeholder="例）卵アレルギー（重篤）、蜂毒アレルギー"/>
    </div>
    {/* 特性・支援情報 */}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:"16px",marginBottom:12,boxShadow:"var(--sh)"}}>
      <div style={{fontSize:11,fontWeight:700,color:"var(--pu)",letterSpacing:2,marginBottom:12,paddingBottom:8,borderBottom:"2px solid var(--pu)"}}>特性・支援情報</div>
      <FacesheetField {...fld("strengths")} label="得意なこと・強み" multi placeholder="例）記憶力が高い、電車の知識が豊富、手先が器用"/>
      <FacesheetField {...fld("challenges")} label="苦手なこと・課題" multi placeholder="例）突然の予定変更が苦手、大きな音が苦手"/>
      <FacesheetField {...fld("triggers")} label="パニックのきっかけ" multi placeholder="例）急な予定変更、大きな声、特定の感触"/>
      <FacesheetField {...fld("calming")} label="落ち着くための方法" multi placeholder="例）一人になれる静かな空間、好きな音楽を聴く"/>
      <FacesheetField {...fld("notes")} label="支援上の特記事項" multi placeholder="その他、支援員が把握すべき情報"/>
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
  const [editId,setEditId]=useState(null); // null=新規, id=編集中

  const setScore=(akey,ikey,val)=>setScores(p=>({...p,[akey]:{...(p[akey]||{}),[ikey]:val}}));
  const setNote=(akey,val)=>setNotes(p=>({...p,[akey]:val}));
  const areaScore=akey=>{const s=scores[akey]||{};const vals=Object.values(s).filter(Boolean);return vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length*10)/10:null;};
  const totalScore=()=>{const areas=ASSESSMENT_AREAS.map(a=>areaScore(a.key)).filter(Boolean);return areas.length?Math.round(areas.reduce((a,b)=>a+b,0)/areas.length*10)/10:null;};

  const save=()=>{
    if(editId){
      store.updAssessment(editId,{date,assessor,scores,notes,overall,updatedAt:todayISO()});
      setEditId(null);
    } else {
      const rec={id:genId(),userId:u.id,facilityId:u.facilityId,date,assessor,scores,notes,overall,createdAt:todayISO()};
      store.addAssessment(rec);
    }
    setDone(true);
  };
  const reset=()=>{setDone(false);setMode("list");setScores({});setNotes({});setOverall("");setDate(todayISO());setEditId(null);};

  // 編集モードに入る
  const startEdit=(a)=>{
    setDate(a.date||todayISO());
    setAssessor(a.assessor||user.displayName);
    setScores(a.scores||{});
    setNotes(a.notes||{});
    setOverall(a.overall||"");
    setEditId(a.id);
    setSelA(null);
    setMode("new");
  };

  const ScoreColor=s=>s>=4?"var(--gr2)":s>=3?"var(--tl)":s>=2?"var(--am)":"var(--ro)";
  const ScoreBg=s=>s>=4?"rgba(44,170,96,0.2)":s>=3?"rgba(58,160,216,0.2)":s>=2?"rgba(224,168,40,0.18)":"rgba(224,56,56,0.15)";

  if(done) return <div className="succ"><div className="si">📊</div><div className="st">アセスメント完了</div><div className="sd">{u.name} さんのアセスメントを保存しました</div><div style={{display:"flex",gap:10,marginTop:12}}><button className="bpri" style={{maxWidth:160}} onClick={reset}>続けて入力</button></div></div>;

  if(mode==="view"&&selA) return <div style={{paddingBottom:28}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}><button className="bback" onClick={()=>setMode("list")}>← 戻る</button><div style={{fontSize:15,fontWeight:900}}>📊 アセスメント詳細</div></div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>startEdit(selA)} style={{padding:"7px 14px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid var(--tl)",background:"rgba(58,160,216,0.1)",color:"var(--tl)"}}>✏️ 編集</button>
        <button className="bexp" onClick={()=>printAssessment(u,selA,FACILITIES.find(f=>f.id===u.facilityId)?.name||"")} style={{background:"#fff8f0",borderColor:"var(--ac)",color:"var(--ac)"}}>🖨️ 印刷</button>
      </div>
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
      <button className="bback" onClick={()=>{setMode("list");setEditId(null);}}>← 戻る</button>
      <div style={{fontSize:15,fontWeight:900}}>📊 アセスメント{editId?"編集":"記入"}</div>
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
  const [editId,setEditId]=useState(null); // null=新規, id=編集中
  const tog=g=>setGoals(p=>p.includes(g)?p.filter(x=>x!==g):[...p,g]);
  const save=()=>{
    if(editId){
      store.updIsp(editId,{period,goals,longGoal,shortGoal,support,evaluation,staffName,updatedAt:todayISO()});
      setEditId(null);
    } else {
      store.addIsp({id:genId(),userId:u.id,facilityId:u.facilityId,period,createdAt:todayISO(),goals,longGoal,shortGoal,support,evaluation,staffName,progress:0,status:"実施中"});
    }
    setDone(true);
  };
  const reset=()=>{setDone(false);setMode("list");setGoals([]);setLongGoal("");setShortGoal("");setSupport("");setEval("");setEditId(null);};
  const startEdit=(x)=>{
    setPeriod(x.period||"");setGoals(x.goals||[]);setLongGoal(x.longGoal||"");
    setShortGoal(x.shortGoal||"");setSupport(x.support||"");setEval(x.evaluation||"");
    setStaffName(x.staffName||user.displayName);setEditId(x.id);
    setView(null);setMode("new");
  };

  if(done) return <div className="succ"><div className="si">📝</div><div className="st">計画を作成しました</div><div className="sd">{u.name} さんの個別支援計画を保存しました</div><div style={{display:"flex",gap:10,marginTop:12}}><button className="bpri" style={{maxWidth:160}} onClick={reset}>続けて作成</button></div></div>;

  if(view) return <div style={{paddingBottom:28}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}><button className="bback" onClick={()=>setView(null)}>← 戻る</button><div style={{fontSize:15,fontWeight:900}}>📝 個別支援計画 詳細</div></div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>startEdit(view)} style={{padding:"7px 14px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid var(--tl)",background:"rgba(58,160,216,0.1)",color:"var(--tl)"}}>✏️ 編集</button>
        <button className="bexp" onClick={()=>printISP(u,view,FACILITIES.find(f=>f.id===u.facilityId)?.name||"")} style={{background:"#fff8f0",borderColor:"var(--ac)",color:"var(--ac)"}}>🖨️ 印刷</button>
      </div>
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
  const [editId,setEditId]=useState(null); // null=新規, id=編集中

  const setIS=(k,v)=>setItemScores(p=>({...p,[k]:v}));
  const setIN=(k,v)=>setItemNotes(p=>({...p,[k]:v}));
  const RESULT_OPTS=[{v:"達成",c:"var(--gr2)",bg:"rgba(44,170,96,0.2)"},{v:"概ね達成",c:"var(--tl)",bg:"rgba(58,160,216,0.2)"},{v:"一部達成",c:"var(--am)",bg:"rgba(224,168,40,0.18)"},{v:"未達成",c:"var(--ro)",bg:"rgba(224,56,56,0.15)"},{v:"継続",c:"var(--pu)",bg:"rgba(144,72,216,0.18)"}];

  const [monDoneInfo, setMonDoneInfo] = useState(null); // 完了後の情報表示
  const SCORE_MAP={"達成":100,"概ね達成":80,"一部達成":50,"未達成":20,"継続":50};

  // 編集モードに入る
  const startEdit=(m)=>{
    setSelIsp(m.ispId||myIsps[0]?.id||"");
    setDate(m.date||todayISO());
    setStaffName(m.staffName||user.displayName);
    setItemScores(m.itemScores||{});
    setItemNotes(m.itemNotes||{});
    setNextPlan(m.nextPlan||"");
    setParentComment(m.parentComment||"");
    setOverallNote(m.overallNote||"");
    setEditId(m.id);
    setView(null);
    setMode("new");
  };

  const save=()=>{
    const isp=myIsps.find(x=>x.id===selIsp);
    if(editId){
      store.updMonitoring(editId,{ispId:selIsp,ispPeriod:isp?.period||"",date,staffName,itemScores,itemNotes,nextPlan,parentComment,overallNote,updatedAt:todayISO()});
      setEditId(null);
      setDone(true);
      return;
    }
    const rec={id:genId(),userId:u.id,facilityId:u.facilityId,ispId:selIsp,ispPeriod:isp?.period||"",date,staffName,itemScores,itemNotes,nextPlan,parentComment,overallNote,createdAt:todayISO()};
    store.addMonitoring(rec);

    // ★ ISP進捗を自動更新（評価スコアの平均 → progress%）
    const scores=Object.values(itemScores).filter(Boolean);
    let progress=isp?.progress||0;
    let avgScore=0;
    if(scores.length>0){
      avgScore=Math.round(scores.reduce((s,v)=>s+(SCORE_MAP[v]||50),0)/scores.length);
      progress=avgScore;
      // ispsテーブルの進捗を更新
      if(isp) store.updIsp(isp.id,{progress,lastMonitoringDate:date,lastMonitoringNote:overallNote.slice(0,100)});
    }

    // ★ 次期ISP更新が必要か判定
    const needsNewIsp=avgScore>=80||nextPlan.length>0;
    // ispRecordのmonitoring docも自動作成
    store.addIspRecord({
      id:genId(),userId:u.id,facilityId:u.facilityId,docType:"monitoring",
      status:"finalized",
      content:{date,staffName,ispId:selIsp,ispPeriod:isp?.period||"",
        progress,avgScore,itemScores,itemNotes,nextPlan,parentComment,overallNote,
        needsNewIsp},
      createdAt:nowStr(),updatedAt:nowStr(),
      createdBy:user.displayName,
    });

    setMonDoneInfo({progress,avgScore,needsNewIsp,userName:u.name});
    setDone(true);
  };
  const reset=()=>{setDone(false);setMode("list");setItemScores({});setItemNotes({});setNextPlan("");setParentComment("");setOverallNote("");setMonDoneInfo(null);setEditId(null);};

  if(done) return <div className="succ">
    <div className="si">🔍</div>
    <div className="st">モニタリング完了</div>
    <div className="sd">{u.name} さんのモニタリングを保存しました</div>
    {monDoneInfo&&<>
      <div style={{margin:"10px auto",maxWidth:280,background:"rgba(255,255,255,0.15)",borderRadius:10,padding:"10px 14px",textAlign:"left",fontSize:12}}>
        <div style={{fontWeight:700,marginBottom:5}}>📊 自動更新された内容</div>
        <div>ISP達成度: <strong>{monDoneInfo.progress}%</strong>（評価スコア平均）</div>
        {monDoneInfo.needsNewIsp&&<div style={{marginTop:6,color:"#ffe08a",fontWeight:700}}>
          💡 達成度{monDoneInfo.avgScore}% — 次期個別支援計画の更新をご検討ください
        </div>}
      </div>
    </>}
    <div style={{display:"flex",gap:10,marginTop:12}}><button className="bpri" style={{maxWidth:160}} onClick={reset}>続けて入力</button></div>
  </div>;

  if(mode==="view"&&view) return <div style={{paddingBottom:28}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}><button className="bback" onClick={()=>setMode("list")}>← 戻る</button><div style={{fontSize:15,fontWeight:900}}>🔍 モニタリング詳細</div></div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>startEdit(view)} style={{padding:"7px 14px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid var(--tl)",background:"rgba(58,160,216,0.1)",color:"var(--tl)"}}>✏️ 編集</button>
        <button className="bexp" onClick={()=>printMonitoring(u,view,FACILITIES.find(f=>f.id===u.facilityId)?.name||"")} style={{background:"#fff8f0",borderColor:"var(--ac)",color:"var(--ac)"}}>🖨️ 印刷</button>
      </div>
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

// ==================== OCR共通ユーティリティ ====================

// 画像ファイル → Base64変換
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 期限ステータス判定
function jukyushaStatus(expiryDate) {
  if (!expiryDate) return "unknown";
  const exp = new Date(expiryDate);
  const now = new Date();
  const diff = (exp - now) / (1000 * 60 * 60 * 24);
  if (diff < 0) return "expired";
  if (diff <= 30) return "warn";
  return "ok";
}

// ==================== ① 受給者証OCRタブ ====================
function JukyushaTab({u, user, store}) {
  const [mode, setMode] = useState("list"); // list | scan | result | edit
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState(null);
  const [ocrResult, setOcrResult] = useState(null);
  const [ocrError, setOcrError] = useState("");
  const [form, setForm] = useState({});
  const fileRef = useRef(null);

  const myDocs = (store.jukyushaDocs||[]).filter(d=>d.userId===u.id).sort((a,b)=>b.scanDate>a.scanDate?1:-1);

  // ファイル選択 → OCR実行
  const handleFile = async (file) => {
    if (!file) return;
    setOcrError("");
    setPreview(URL.createObjectURL(file));
    setScanning(true);
    setMode("scan");
    try {
      const base64 = await fileToBase64(file);
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ imageBase64: base64, mediaType: file.type, mode: "jukyusha" })
      });
      const data = await res.json();
      if (data.success && data.data) {
        setOcrResult(data.data);
        setForm({
          name: data.data.name || u.name || "",
          nameKana: data.data.nameKana || "",
          jukyushaNo: data.data.jukyushaNo || "",
          city: data.data.city || "",
          expiryDate: data.data.expiryDate || "",
          serviceType: data.data.serviceType || "",
          serviceAmount: data.data.serviceAmount || "",
          maxBurden: data.data.maxBurden || "",
          startDate: data.data.startDate || "",
        });
        setMode("result");
      } else {
        setOcrError(data.error || "OCRの解析に失敗しました。手動で入力してください。");
        setForm({ name: u.name || "", jukyushaNo: u.jukyushaNo || "", city: u.jukyushaCity || "", expiryDate: u.jukyushaExpiry || "" });
        setMode("result");
      }
    } catch(e) {
      setOcrError("通信エラー: " + e.message);
      setMode("result");
    } finally {
      setScanning(false);
    }
  };

  // 保存
  const handleSave = () => {
    const id = "jd_" + Date.now();
    const doc = {
      id, facilityId: u.facilityId, userId: u.id,
      scanDate: new Date().toISOString().slice(0,10),
      name: form.name, jukyushaNo: form.jukyushaNo,
      city: form.city, expiryDate: form.expiryDate,
      serviceType: form.serviceType, serviceAmount: form.serviceAmount,
      maxBurden: form.maxBurden ? parseInt(form.maxBurden) : null,
      startDate: form.startDate, status: "有効",
      imagePreview: preview, ocrData: ocrResult,
      createdBy: user.displayName
    };
    // 旧受給者証を「旧」に変更
    myDocs.filter(d=>d.status==="有効").forEach(d=>store.updJukyushaDoc(d.id,{status:"旧"}));
    store.addJukyushaDoc(doc);
    // 利用者の受給者証情報も更新
    store.updUser2(u.id, { jukyushaNo: form.jukyushaNo, jukyushaCity: form.city, jukyushaExpiry: form.expiryDate });
    store.showToast("✅ 受給者証を保存しました");
    setMode("list"); setPreview(null); setOcrResult(null);
  };

  const upd = (k,v) => setForm(p=>({...p,[k]:v}));

  // ===== リスト表示 =====
  if (mode === "list") return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:700,color:"var(--tx)"}}>📋 受給者証一覧</div>
        <button className="bsave" style={{padding:"8px 14px",fontSize:12}} onClick={()=>fileRef.current?.click()}>
          📷 受給者証を撮影・読取
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{display:"none"}}
          onChange={e=>handleFile(e.target.files[0])}/>
      </div>

      {/* APIキー未設定の場合の案内 */}
      <div style={{background:"rgba(58,160,216,0.08)",border:"1px solid rgba(58,160,216,0.3)",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,color:"var(--tl)"}}>
        💡 OCR機能はAnthropic APIキーが必要です。Vercel Dashboard → Settings → Environment Variables に
        <strong> ANTHROPIC_API_KEY </strong>を設定してください。未設定の場合は手動入力になります。
      </div>

      {myDocs.length === 0 && (
        <div style={{textAlign:"center",padding:"32px 16px",color:"var(--tx3)"}}>
          <div style={{fontSize:32,marginBottom:8}}>📄</div>
          <div style={{fontSize:13}}>受給者証が登録されていません</div>
          <div style={{fontSize:11,marginTop:4}}>「📷 受給者証を撮影・読取」から登録できます</div>
        </div>
      )}

      {myDocs.map(doc => {
        const st = jukyushaStatus(doc.expiryDate);
        return (
          <div key={doc.id} className={`jukyusha-card ${st==="expired"?"expired":st==="warn"?"expiring":""}`}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div>
                <div style={{fontSize:12,fontWeight:900,color:"var(--tx)",marginBottom:2}}>
                  {doc.status==="有効"?"✅ 現行受給者証":doc.status==="旧"?"📁 旧受給者証":"📄"}
                  <span style={{marginLeft:6,fontSize:10,color:"var(--tx3)"}}>{doc.scanDate}</span>
                </div>
                <div style={{fontSize:11,color:"var(--tx2)"}}>受給者証番号: <strong>{doc.jukyushaNo||"—"}</strong></div>
              </div>
              {st==="expired"&&<span className="ocr-badge-err">⚠️ 期限切れ</span>}
              {st==="warn"&&<span className="ocr-badge-warn">⏰ 期限間近</span>}
              {st==="ok"&&doc.status==="有効"&&<span className="ocr-badge-ok">✅ 有効</span>}
            </div>
            <div className="ocr-result-row"><span className="ocr-result-label">有効期限</span><span className="ocr-result-val" style={{color:st==="expired"?"var(--ro)":st==="warn"?"#8a6200":"var(--tx)"}}>{doc.expiryDate||"—"}</span></div>
            <div className="ocr-result-row"><span className="ocr-result-label">自治体</span><span className="ocr-result-val">{doc.city||"—"}</span></div>
            <div className="ocr-result-row"><span className="ocr-result-label">支給量</span><span className="ocr-result-val">{doc.serviceAmount||"—"}</span></div>
            <div className="ocr-result-row" style={{borderBottom:"none"}}><span className="ocr-result-label">負担上限月額</span><span className="ocr-result-val">{doc.maxBurden!=null?doc.maxBurden+"円":"—"}</span></div>
            <div style={{marginTop:8,display:"flex",gap:8}}>
              <button onClick={()=>store.delJukyushaDoc(doc.id)} style={{padding:"4px 10px",borderRadius:7,fontSize:11,fontWeight:700,border:"1px solid rgba(224,56,56,0.4)",background:"rgba(224,56,56,0.08)",color:"var(--ro)",cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>削除</button>
            </div>
          </div>
        );
      })}
    </div>
  );

  // ===== スキャン中 =====
  if (mode === "scan") return (
    <div style={{textAlign:"center",padding:"48px 16px"}}>
      <div style={{fontSize:40,marginBottom:16}}>🔍</div>
      <div style={{fontSize:15,fontWeight:700,color:"var(--tx)",marginBottom:8}}>OCR解析中...</div>
      <div style={{fontSize:12,color:"var(--tx3)"}}>Claude AIが受給者証を読み取っています</div>
      {preview && <img src={preview} className="ocr-preview" alt="preview"/>}
    </div>
  );

  // ===== OCR結果・確認 =====
  if (mode === "result") return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
        <button className="bback" onClick={()=>{setMode("list");setPreview(null);}} style={{padding:"6px 12px",fontSize:12}}>← 戻る</button>
        <div style={{fontSize:13,fontWeight:700}}>📋 読み取り結果を確認</div>
      </div>
      {preview && <img src={preview} className="ocr-preview" alt="撮影画像"/>}
      {ocrError && <div style={{background:"rgba(224,168,40,0.15)",border:"1px solid rgba(224,168,40,0.4)",borderRadius:9,padding:"10px 12px",fontSize:12,color:"#8a6200",marginBottom:12}}>⚠️ {ocrError}<br/>内容を手動で入力してください。</div>}
      {ocrResult && <div style={{background:"rgba(44,170,96,0.1)",border:"1px solid rgba(44,170,96,0.3)",borderRadius:9,padding:"8px 12px",fontSize:11,color:"var(--gr2)",marginBottom:12}}>✅ AIが自動読み取りしました。内容を確認して保存してください。</div>}

      <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:12,padding:16}}>
        {[
          {label:"氏名",key:"name"}, {label:"ふりがな",key:"nameKana"},
          {label:"受給者証番号",key:"jukyushaNo"}, {label:"自治体名",key:"city"},
          {label:"有効期限",key:"expiryDate",type:"date"}, {label:"支給開始日",key:"startDate",type:"date"},
          {label:"サービス種別",key:"serviceType"}, {label:"支給量",key:"serviceAmount"},
          {label:"負担上限月額(円)",key:"maxBurden",type:"number"},
        ].map(({label,key,type="text"})=>(
          <div key={key} style={{marginBottom:10}}>
            <label style={{display:"block",fontSize:10,fontWeight:700,color:"var(--tx2)",marginBottom:4}}>{label}</label>
            <input className="fi" type={type} value={form[key]||""} onChange={e=>upd(key,e.target.value)} placeholder={label+"を入力"}/>
          </div>
        ))}
      </div>
      <button className="bsave" style={{marginTop:14,width:"100%"}} onClick={handleSave}>💾 保存する</button>
    </div>
  );

  return null;
}

// ==================== ② 相談支援原案OCRタブ ====================
function SoudanGenanTab({u, user, store}) {
  const [mode, setMode] = useState("list"); // list | scan | result | detail
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState(null);
  const [ocrResult, setOcrResult] = useState(null);
  const [ocrError, setOcrError] = useState("");
  const [form, setForm] = useState({});
  const [selDoc, setSelDoc] = useState(null);
  const fileRef = useRef(null);

  const myDocs = (store.soudanGenans||[]).filter(d=>d.userId===u.id).sort((a,b)=>b.receivedDate>a.receivedDate?1:-1);
  const upd = (k,v) => setForm(p=>({...p,[k]:v}));

  // ファイル選択 → OCR実行
  const handleFile = async (file) => {
    if (!file) return;
    setOcrError(""); setPreview(URL.createObjectURL(file));
    setScanning(true); setMode("scan");
    try {
      const base64 = await fileToBase64(file);
      const res = await fetch("/api/ocr", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ imageBase64: base64, mediaType: file.type, mode: "soudan" })
      });
      const data = await res.json();
      if (data.success && data.data) {
        setOcrResult(data.data);
        setForm({
          specialistName: data.data.specialistName || "",
          specialistOrg:  data.data.specialistOrg  || "",
          planPeriodStart: data.data.planPeriodStart || "",
          planPeriodEnd:   data.data.planPeriodEnd   || "",
          userNeeds:       data.data.userNeeds        || "",
          parentNeeds:     data.data.parentNeeds      || "",
          longTermGoal:    data.data.longTermGoal     || "",
          shortTermGoal:   data.data.shortTermGoal    || "",
          supportPolicy:   data.data.supportPolicy    || "",
          specialistComment: data.data.specialistComment || "",
          nextMonitoringDate: data.data.nextMonitoringDate || "",
        });
        setMode("result");
      } else {
        setOcrError(data.error || "OCR解析に失敗しました。手動で入力してください。");
        setForm({ specialistName:"", specialistOrg:"", planPeriodStart:"", planPeriodEnd:"",
          userNeeds:"", parentNeeds:"", longTermGoal:"", shortTermGoal:"",
          supportPolicy:"", specialistComment:"", nextMonitoringDate:"" });
        setMode("result");
      }
    } catch(e) {
      setOcrError("通信エラー: " + e.message); setMode("result");
    } finally { setScanning(false); }
  };

  // 保存
  const handleSave = () => {
    const id = "sg_" + Date.now();
    const doc = {
      id, facilityId: u.facilityId, userId: u.id,
      receivedDate: new Date().toISOString().slice(0,10),
      specialistName: form.specialistName, specialistOrg: form.specialistOrg,
      planPeriodStart: form.planPeriodStart, planPeriodEnd: form.planPeriodEnd,
      userNeeds: form.userNeeds, parentNeeds: form.parentNeeds,
      longTermGoal: form.longTermGoal, shortTermGoal: form.shortTermGoal,
      supportPolicy: form.supportPolicy, specialistComment: form.specialistComment,
      nextMonitoringDate: form.nextMonitoringDate,
      status: "受領済み", imagePreview: preview, ocrData: ocrResult,
      createdBy: user.displayName
    };
    store.addSoudanGenan(doc);
    store.showToast("✅ 相談支援原案を保存しました");
    setMode("list"); setPreview(null); setOcrResult(null);
  };

  // ===== リスト =====
  if (mode==="list") return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:700,color:"var(--tx)"}}>📑 相談支援原案一覧</div>
        <button className="bsave" style={{padding:"8px 14px",fontSize:12}} onClick={()=>fileRef.current?.click()}>
          📷 原案を撮影・読取
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{display:"none"}}
          onChange={e=>handleFile(e.target.files[0])}/>
      </div>

      {/* 説明バナー */}
      <div style={{background:"rgba(144,72,216,0.08)",border:"1px solid rgba(144,72,216,0.25)",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,color:"var(--pu)"}}>
        💡 相談支援事業所から受け取った原案・計画書を撮影するだけで、ニーズや目標を自動抽出します。
      </div>

      {myDocs.length===0 && (
        <div style={{textAlign:"center",padding:"32px 16px",color:"var(--tx3)"}}>
          <div style={{fontSize:32,marginBottom:8}}>📑</div>
          <div style={{fontSize:13}}>相談支援原案が登録されていません</div>
          <div style={{fontSize:11,marginTop:4}}>「📷 原案を撮影・読取」から登録できます</div>
        </div>
      )}

      {myDocs.map(doc=>{
        const isExpired = doc.planPeriodEnd && doc.planPeriodEnd < new Date().toISOString().slice(0,10);
        const isSoon = !isExpired && doc.planPeriodEnd && (
          (new Date(doc.planPeriodEnd)-new Date()) / (1000*60*60*24) < 30
        );
        return (
          <div key={doc.id} className="soudan-card" onClick={()=>{setSelDoc(doc);setMode("detail");}}
            style={{cursor:"pointer",borderColor:isExpired?"rgba(224,56,56,0.4)":isSoon?"rgba(224,168,40,0.5)":"var(--bd)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
              <div>
                <div style={{fontSize:12,fontWeight:900,color:"var(--pu)",marginBottom:2}}>
                  📑 {doc.specialistOrg||"相談支援事業所"}
                  <span style={{marginLeft:6,fontSize:10,color:"var(--tx3)",fontWeight:400}}>{doc.receivedDate}</span>
                </div>
                <div style={{fontSize:11,color:"var(--tx2)"}}>担当: <strong>{doc.specialistName||"—"}</strong></div>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3}}>
                {isExpired&&<span className="ocr-badge-err">⚠️ 計画期間終了</span>}
                {isSoon&&<span className="ocr-badge-warn">⏰ 期限間近</span>}
                {!isExpired&&!isSoon&&<span className="ocr-badge-ok">✅ 有効</span>}
              </div>
            </div>
            <div className="ocr-result-row"><span className="ocr-result-label">計画期間</span><span className="ocr-result-val">{doc.planPeriodStart||"—"} 〜 {doc.planPeriodEnd||"—"}</span></div>
            {doc.longTermGoal&&<div style={{marginTop:6,fontSize:11,color:"var(--tx2)",background:"var(--bg)",borderRadius:6,padding:"6px 8px",lineHeight:1.5}}>
              🎯 長期目標: {doc.longTermGoal.slice(0,60)}{doc.longTermGoal.length>60?"…":""}
            </div>}
            <div style={{marginTop:8,display:"flex",gap:8}}>
              <button onClick={e=>{e.stopPropagation();store.delSoudanGenan(doc.id);}}
                style={{padding:"4px 10px",borderRadius:7,fontSize:11,fontWeight:700,border:"1px solid rgba(224,56,56,0.4)",background:"rgba(224,56,56,0.08)",color:"var(--ro)",cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>削除</button>
            </div>
          </div>
        );
      })}
    </div>
  );

  // ===== スキャン中 =====
  if (mode==="scan") return (
    <div style={{textAlign:"center",padding:"48px 16px"}}>
      <div style={{fontSize:40,marginBottom:16}}>🔍</div>
      <div style={{fontSize:15,fontWeight:700,color:"var(--tx)",marginBottom:8}}>OCR解析中...</div>
      <div style={{fontSize:12,color:"var(--tx3)"}}>Claude AIが相談支援原案を読み取っています</div>
      {preview&&<img src={preview} className="ocr-preview" alt="preview"/>}
    </div>
  );

  // ===== OCR結果・確認 =====
  if (mode==="result") return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
        <button className="bback" onClick={()=>{setMode("list");setPreview(null);}} style={{padding:"6px 12px",fontSize:12}}>← 戻る</button>
        <div style={{fontSize:13,fontWeight:700}}>📑 読み取り結果を確認</div>
      </div>
      {preview&&<img src={preview} className="ocr-preview" alt="撮影画像"/>}
      {ocrError&&<div style={{background:"rgba(224,168,40,0.15)",border:"1px solid rgba(224,168,40,0.4)",borderRadius:9,padding:"10px 12px",fontSize:12,color:"#8a6200",marginBottom:12}}>⚠️ {ocrError}<br/>内容を手動で入力してください。</div>}
      {ocrResult&&<div style={{background:"rgba(144,72,216,0.1)",border:"1px solid rgba(144,72,216,0.3)",borderRadius:9,padding:"8px 12px",fontSize:11,color:"var(--pu)",marginBottom:12}}>✅ AIが自動読み取りしました。内容を確認・修正して保存してください。</div>}

      <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:12,padding:16}}>
        {/* 事業所・専門員 */}
        <div style={{fontSize:11,fontWeight:900,color:"var(--pu)",marginBottom:8,letterSpacing:1}}>相談支援事業所</div>
        {[
          {label:"相談支援専門員名",key:"specialistName"},
          {label:"相談支援事業所名",key:"specialistOrg"},
        ].map(({label,key})=>(
          <div key={key} style={{marginBottom:10}}>
            <label style={{display:"block",fontSize:10,fontWeight:700,color:"var(--tx2)",marginBottom:4}}>{label}</label>
            <input className="fi" value={form[key]||""} onChange={e=>upd(key,e.target.value)} placeholder={label}/>
          </div>
        ))}

        {/* 計画期間 */}
        <div style={{fontSize:11,fontWeight:900,color:"var(--pu)",margin:"12px 0 8px",letterSpacing:1}}>計画期間</div>
        <div style={{display:"flex",gap:8,marginBottom:10}}>
          <div style={{flex:1}}>
            <label style={{display:"block",fontSize:10,fontWeight:700,color:"var(--tx2)",marginBottom:4}}>開始日</label>
            <input className="fi" type="date" value={form.planPeriodStart||""} onChange={e=>upd("planPeriodStart",e.target.value)}/>
          </div>
          <div style={{flex:1}}>
            <label style={{display:"block",fontSize:10,fontWeight:700,color:"var(--tx2)",marginBottom:4}}>終了日</label>
            <input className="fi" type="date" value={form.planPeriodEnd||""} onChange={e=>upd("planPeriodEnd",e.target.value)}/>
          </div>
        </div>

        {/* ニーズ・目標 */}
        <div style={{fontSize:11,fontWeight:900,color:"var(--pu)",margin:"12px 0 8px",letterSpacing:1}}>ニーズ・目標</div>
        {[
          {label:"本人の意向・ニーズ",key:"userNeeds",multi:true},
          {label:"保護者の意向・ニーズ",key:"parentNeeds",multi:true},
          {label:"長期目標",key:"longTermGoal",multi:true},
          {label:"短期目標",key:"shortTermGoal",multi:true},
          {label:"支援方針・総合的な援助方針",key:"supportPolicy",multi:true},
          {label:"相談支援専門員コメント",key:"specialistComment",multi:true},
        ].map(({label,key,multi})=>(
          <div key={key} style={{marginBottom:10}}>
            <label style={{display:"block",fontSize:10,fontWeight:700,color:"var(--tx2)",marginBottom:4}}>{label}</label>
            {multi
              ? <textarea className="fta" style={{minHeight:60}} value={form[key]||""} onChange={e=>upd(key,e.target.value)} placeholder={label}/>
              : <input className="fi" value={form[key]||""} onChange={e=>upd(key,e.target.value)} placeholder={label}/>
            }
          </div>
        ))}
        <div style={{marginBottom:10}}>
          <label style={{display:"block",fontSize:10,fontWeight:700,color:"var(--tx2)",marginBottom:4}}>次回モニタリング予定日</label>
          <input className="fi" type="date" value={form.nextMonitoringDate||""} onChange={e=>upd("nextMonitoringDate",e.target.value)}/>
        </div>
      </div>
      <button className="bsave" style={{marginTop:14,width:"100%"}} onClick={handleSave}>💾 保存する</button>
    </div>
  );

  // ===== 詳細表示 =====
  if (mode==="detail"&&selDoc) return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
        <button className="bback" onClick={()=>{setMode("list");setSelDoc(null);}} style={{padding:"6px 12px",fontSize:12}}>← 一覧へ</button>
        <div style={{fontSize:13,fontWeight:700}}>📑 相談支援原案 詳細</div>
      </div>
      <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:12,padding:16}}>
        <div style={{marginBottom:12,paddingBottom:12,borderBottom:"1px solid var(--bg2)"}}>
          <div style={{fontSize:12,fontWeight:900,color:"var(--pu)",marginBottom:4}}>{selDoc.specialistOrg||"相談支援事業所"}</div>
          <div style={{fontSize:11,color:"var(--tx2)"}}>担当: {selDoc.specialistName||"—"} ／ 受領日: {selDoc.receivedDate}</div>
          <div style={{fontSize:11,color:"var(--tx2)",marginTop:2}}>計画期間: {selDoc.planPeriodStart||"—"} 〜 {selDoc.planPeriodEnd||"—"}</div>
        </div>
        {[
          {label:"本人の意向・ニーズ",val:selDoc.userNeeds},
          {label:"保護者の意向・ニーズ",val:selDoc.parentNeeds},
          {label:"長期目標",val:selDoc.longTermGoal},
          {label:"短期目標",val:selDoc.shortTermGoal},
          {label:"支援方針",val:selDoc.supportPolicy},
          {label:"専門員コメント",val:selDoc.specialistComment},
          {label:"次回モニタリング予定日",val:selDoc.nextMonitoringDate},
        ].filter(x=>x.val).map(({label,val})=>(
          <div key={label} style={{marginBottom:12}}>
            <div style={{fontSize:10,fontWeight:700,color:"var(--tl)",letterSpacing:1,marginBottom:4}}>{label}</div>
            <div style={{fontSize:12,color:"var(--tx)",lineHeight:1.7,background:"var(--bg)",borderRadius:7,padding:"8px 10px"}}>{val}</div>
          </div>
        ))}
      </div>
    </div>
  );

  return null;
}

// ==================== 発達段階記録タブ（児童発達支援専用） ====================
function DevRecordTab({u, user, store}) {
  const [mode, setMode] = useState("list"); // list | new
  const [form, setForm] = useState({date:todayISO(), domain:"", level:"", goal:"", content:"", staffName:user.displayName||""});
  const [saved, setSaved] = useState(false);
  const myRecs = (store.devRecords||[]).filter(r=>r.userId===u.id).sort((a,b)=>b.date>a.date?1:-1);

  const handleSave = () => {
    if(!form.domain||!form.content) return;
    store.addDevRecord({...form, id:genId(), userId:u.id, facilityId:u.facilityId});
    setSaved(true);
    setTimeout(()=>{setSaved(false);setMode("list");setForm(p=>({...p,domain:"",level:"",goal:"",content:""}));},1500);
  };

  if(mode==="new") return <div>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
      <button className="bback" onClick={()=>setMode("list")}>← 戻る</button>
      <div style={{fontSize:14,fontWeight:900}}>🌱 発達段階記録 入力</div>
    </div>
    {saved&&<div className="succ"><div className="si">✅</div><div className="st">保存しました</div></div>}
    {!saved&&<>
      <div className="fg"><label className="fl">記録日</label><input className="fi" type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}/></div>
      <div className="fg"><label className="fl">発達領域 <span style={{color:"var(--ro)"}}>*</span></label>
        <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
          {DEV_DOMAINS.map(d=><button key={d} onClick={()=>setForm(p=>({...p,domain:d}))}
            style={{padding:"7px 12px",borderRadius:9,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",
              borderColor:form.domain===d?"var(--ac)":"var(--bd)",background:form.domain===d?"rgba(240,112,32,0.15)":"var(--bg)",color:form.domain===d?"var(--ac)":"var(--tx3)"}}>
            {d}
          </button>)}
        </div>
      </div>
      <div className="fg"><label className="fl">達成レベル</label>
        <div style={{display:"flex",gap:7}}>
          {["できた","一部できた","難しかった","未実施"].map(lv=><button key={lv} onClick={()=>setForm(p=>({...p,level:lv}))}
            style={{padding:"7px 11px",borderRadius:9,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",flex:1,
              borderColor:form.level===lv?({できた:"var(--gr2)",一部できた:"var(--am)",難しかった:"var(--ro)",未実施:"var(--tx3)"}[lv]||"var(--bd)"):"var(--bd)",
              background:form.level===lv?({できた:"rgba(44,170,96,0.2)",一部できた:"rgba(224,168,40,0.2)",難しかった:"rgba(224,56,56,0.15)",未実施:"var(--bg3)"}[lv]||"var(--bg)"):"var(--bg)",
              color:form.level===lv?({できた:"var(--gr2)",一部できた:"var(--am)",難しかった:"var(--ro)",未実施:"var(--tx3)"}[lv]||"var(--tx)"):"var(--tx3)"}}>
            {lv}
          </button>)}
        </div>
      </div>
      <div className="fg"><label className="fl">支援目標（ISP短期目標）</label><input className="fi" placeholder="例：絵カードを見て3語文で話せる" value={form.goal} onChange={e=>setForm(p=>({...p,goal:e.target.value}))}/></div>
      <div className="fg"><label className="fl">記録内容 <span style={{color:"var(--ro)"}}>*</span></label><textarea className="fta" placeholder="本日の様子・支援内容・気づきを記録してください" value={form.content} onChange={e=>setForm(p=>({...p,content:e.target.value}))} style={{minHeight:90}}/></div>
      <div className="fg"><label className="fl">担当職員</label><input className="fi" value={form.staffName} onChange={e=>setForm(p=>({...p,staffName:e.target.value}))}/></div>
      <button className="bsave" onClick={handleSave} disabled={!form.domain||!form.content}>保存する</button>
    </>}
  </div>;

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <div style={{fontSize:13,fontWeight:900,color:"var(--ac)"}}>🌱 発達段階記録 — {u.name}</div>
      <button className="bsave" style={{maxWidth:130,padding:"8px 14px",fontSize:12}} onClick={()=>setMode("new")}>＋ 新規記録</button>
    </div>
    {/* 5領域サマリー */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:8,marginBottom:16}}>
      {DEV_DOMAINS.map(d=>{
        const cnt=myRecs.filter(r=>r.domain===d).length;
        const last=myRecs.find(r=>r.domain===d);
        return <div key={d} style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:10,padding:"10px 12px",boxShadow:"var(--sh)"}}>
          <div style={{fontSize:10,fontWeight:700,color:"var(--tx3)",marginBottom:4}}>{d}</div>
          <div style={{fontSize:20,fontWeight:900,color:"var(--ac)"}}>{cnt}<span style={{fontSize:11,fontWeight:400,color:"var(--tx3)"}}>件</span></div>
          {last&&<div style={{fontSize:10,color:"var(--tx3)",marginTop:3}}>{last.level||"—"}</div>}
        </div>;
      })}
    </div>
    {myRecs.length===0&&<div style={{textAlign:"center",padding:"30px 0",color:"var(--tx3)",fontSize:13}}>まだ記録がありません</div>}
    {myRecs.map(r=><div key={r.id} className="dev-record-card">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{fontSize:12,fontWeight:900,color:"var(--ac)"}}>{r.domain}</span>
          {r.level&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:8,fontWeight:700,background:r.level==="できた"?"rgba(44,170,96,0.2)":r.level==="一部できた"?"rgba(224,168,40,0.2)":"rgba(224,56,56,0.15)",color:r.level==="できた"?"var(--gr2)":r.level==="一部できた"?"var(--am)":"var(--ro)"}}>{r.level}</span>}
        </div>
        <div style={{fontSize:10,color:"var(--tx3)"}}>{r.date}</div>
      </div>
      {r.goal&&<div style={{fontSize:11,color:"var(--tl)",marginBottom:4}}>目標: {r.goal}</div>}
      <div style={{fontSize:12,color:"var(--tx)",lineHeight:1.6}}>{r.content}</div>
      <div style={{fontSize:10,color:"var(--tx3)",marginTop:5}}>{r.staffName}</div>
    </div>)}
  </div>;
}

// ==================== 保護者支援記録タブ（児童発達支援専用） ====================
function ParentSupportTab({u, user, store}) {
  const [mode, setMode] = useState("list");
  const [form, setForm] = useState({date:todayISO(), type:"", content:"", nextAction:"", staffName:user.displayName||""});
  const [saved, setSaved] = useState(false);
  const myRecs = (store.parentSupportRecords||[]).filter(r=>r.userId===u.id).sort((a,b)=>b.date>a.date?1:-1);

  const handleSave = () => {
    if(!form.type||!form.content) return;
    store.addParentSupportRecord({...form, id:genId(), userId:u.id, facilityId:u.facilityId});
    setSaved(true);
    setTimeout(()=>{setSaved(false);setMode("list");setForm(p=>({...p,type:"",content:"",nextAction:""}));},1500);
  };

  if(mode==="new") return <div>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
      <button className="bback" onClick={()=>setMode("list")}>← 戻る</button>
      <div style={{fontSize:14,fontWeight:900}}>👨‍👩‍👧 保護者支援記録 入力</div>
    </div>
    {saved&&<div className="succ"><div className="si">✅</div><div className="st">保存しました</div></div>}
    {!saved&&<>
      <div className="fg"><label className="fl">日付</label><input className="fi" type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}/></div>
      <div className="fg"><label className="fl">支援種別 <span style={{color:"var(--ro)"}}>*</span></label>
        <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
          {PARENT_SUPPORT_TYPES.map(t=><button key={t} onClick={()=>setForm(p=>({...p,type:t}))}
            style={{padding:"7px 12px",borderRadius:9,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",
              borderColor:form.type===t?"var(--tl)":"var(--bd)",background:form.type===t?"rgba(58,160,216,0.18)":"var(--bg)",color:form.type===t?"var(--tl)":"var(--tx3)"}}>
            {t}
          </button>)}
        </div>
      </div>
      <div className="fg"><label className="fl">支援内容 <span style={{color:"var(--ro)"}}>*</span></label><textarea className="fta" placeholder="相談内容・対応内容・保護者の様子などを記録" value={form.content} onChange={e=>setForm(p=>({...p,content:e.target.value}))} style={{minHeight:90}}/></div>
      <div className="fg"><label className="fl">次回の対応・フォロー</label><input className="fi" placeholder="例：来月の個別面談を設定予定" value={form.nextAction} onChange={e=>setForm(p=>({...p,nextAction:e.target.value}))}/></div>
      <div className="fg"><label className="fl">担当職員</label><input className="fi" value={form.staffName} onChange={e=>setForm(p=>({...p,staffName:e.target.value}))}/></div>
      <button className="bsave" onClick={handleSave} disabled={!form.type||!form.content}>保存する</button>
    </>}
  </div>;

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <div style={{fontSize:13,fontWeight:900,color:"var(--tl)"}}>👨‍👩‍👧 保護者支援記録 — {u.name}</div>
      <button className="bsave" style={{maxWidth:130,padding:"8px 14px",fontSize:12}} onClick={()=>setMode("new")}>＋ 新規記録</button>
    </div>
    {/* 支援種別集計 */}
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
      {PARENT_SUPPORT_TYPES.map(t=>{const cnt=myRecs.filter(r=>r.type===t).length;return cnt>0&&<div key={t} style={{padding:"4px 12px",borderRadius:10,background:"rgba(58,160,216,0.15)",border:"1px solid rgba(58,160,216,0.35)",fontSize:11,fontWeight:700,color:"var(--tl)"}}>{t}: {cnt}件</div>;})}
    </div>
    {myRecs.length===0&&<div style={{textAlign:"center",padding:"30px 0",color:"var(--tx3)",fontSize:13}}>まだ記録がありません</div>}
    {myRecs.map(r=><div key={r.id} className="ps-card">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
        <span style={{fontSize:12,padding:"2px 9px",borderRadius:9,fontWeight:700,background:"rgba(58,160,216,0.15)",color:"var(--tl)",border:"1px solid rgba(58,160,216,0.35)"}}>{r.type}</span>
        <div style={{fontSize:10,color:"var(--tx3)"}}>{r.date}</div>
      </div>
      <div style={{fontSize:12,color:"var(--tx)",lineHeight:1.6,marginBottom:4}}>{r.content}</div>
      {r.nextAction&&<div style={{fontSize:11,color:"var(--am)",background:"rgba(224,168,40,0.1)",borderRadius:7,padding:"4px 9px"}}>📌 {r.nextAction}</div>}
      <div style={{fontSize:10,color:"var(--tx3)",marginTop:5}}>{r.staffName}</div>
    </div>)}
  </div>;
}

// ==================== 利用者個別 訪問記録タブ（保育所等訪問支援専用） ====================
function UserVisitTab({u, user, store}) {
  const [mode, setMode] = useState("list");
  const [form, setForm] = useState({date:todayISO(), destId:"", visitType:"初回", duration:"", supportContent:"", schoolFeedback:"", advice:"", staffName:user.displayName||""});
  const [saved, setSaved] = useState(false);
  const myVisits = (store.visitRecords||[]).filter(r=>r.userId===u.id).sort((a,b)=>b.date>a.date?1:-1);
  const facilityDests = (store.visitDests||[]).filter(d=>d.facilityId===u.facilityId);

  const handleSave = () => {
    if(!form.destId||!form.supportContent) return;
    store.addVisitRecord({...form, id:genId(), userId:u.id, facilityId:u.facilityId});
    setSaved(true);
    setTimeout(()=>{setSaved(false);setMode("list");setForm(p=>({...p,destId:"",supportContent:"",schoolFeedback:"",advice:""}));},1500);
  };

  const destName = (id) => facilityDests.find(d=>d.id===id)?.name||id||"—";

  if(mode==="new") return <div>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
      <button className="bback" onClick={()=>setMode("list")}>← 戻る</button>
      <div style={{fontSize:14,fontWeight:900}}>🚌 訪問記録 入力</div>
    </div>
    {saved&&<div className="succ"><div className="si">✅</div><div className="st">保存しました</div></div>}
    {!saved&&<>
      <div className="fg"><label className="fl">訪問日</label><input className="fi" type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}/></div>
      <div className="fg"><label className="fl">訪問先 <span style={{color:"var(--ro)"}}>*</span></label>
        <select className="fi" value={form.destId} onChange={e=>setForm(p=>({...p,destId:e.target.value}))}>
          <option value="">選択してください</option>
          {facilityDests.map(d=><option key={d.id} value={d.id}>{d.name}（{d.type}）</option>)}
        </select>
        {facilityDests.length===0&&<div style={{fontSize:11,color:"var(--ro)",marginTop:4}}>訪問先が未登録です。「保育所等訪問支援」画面から登録してください。</div>}
      </div>
      <div className="fg"><label className="fl">訪問種別（報酬算定用）</label>
        <div style={{display:"flex",gap:8}}>
          {["初回","2回目以降"].map(t=><button key={t} onClick={()=>setForm(p=>({...p,visitType:t}))}
            style={{padding:"8px 16px",borderRadius:9,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",flex:1,
              borderColor:form.visitType===t?"var(--gr2)":"var(--bd)",background:form.visitType===t?"rgba(44,170,96,0.18)":"var(--bg)",color:form.visitType===t?"var(--gr2)":"var(--tx3)"}}>
            {t}
          </button>)}
        </div>
      </div>
      <div className="fg"><label className="fl">訪問時間（分）</label><input className="fi" type="number" placeholder="例: 90" value={form.duration} onChange={e=>setForm(p=>({...p,duration:e.target.value}))}/></div>
      <div className="fg"><label className="fl">支援内容 <span style={{color:"var(--ro)"}}>*</span></label><textarea className="fta" placeholder="訪問で行った支援・助言内容を記録" value={form.supportContent} onChange={e=>setForm(p=>({...p,supportContent:e.target.value}))} style={{minHeight:80}}/></div>
      <div className="fg"><label className="fl">学校・施設からのフィードバック</label><textarea className="fta" placeholder="担任・保育士からの意見・気づきなど" value={form.schoolFeedback} onChange={e=>setForm(p=>({...p,schoolFeedback:e.target.value}))} style={{minHeight:60}}/></div>
      <div className="fg"><label className="fl">助言内容（学校・施設への提案）</label><textarea className="fta" placeholder="具体的な支援方法・環境調整の提案" value={form.advice} onChange={e=>setForm(p=>({...p,advice:e.target.value}))} style={{minHeight:60}}/></div>
      <div className="fg"><label className="fl">担当職員</label><input className="fi" value={form.staffName} onChange={e=>setForm(p=>({...p,staffName:e.target.value}))}/></div>
      <button className="bsave" onClick={handleSave} disabled={!form.destId||!form.supportContent}>保存する</button>
    </>}
  </div>;

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <div style={{fontSize:13,fontWeight:900,color:"var(--gr2)"}}>🚌 訪問記録 — {u.name}</div>
      <button className="bsave" style={{maxWidth:130,padding:"8px 14px",fontSize:12,background:"var(--gr2)"}} onClick={()=>setMode("new")}>＋ 新規訪問</button>
    </div>
    <div style={{display:"flex",gap:12,marginBottom:14,flexWrap:"wrap"}}>
      <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:10,padding:"10px 16px",boxShadow:"var(--sh)"}}>
        <div style={{fontSize:22,fontWeight:900,color:"var(--gr2)"}}>{myVisits.length}<span style={{fontSize:11,color:"var(--tx3)",fontWeight:400}}>回</span></div>
        <div style={{fontSize:10,color:"var(--tx3)"}}>総訪問回数</div>
      </div>
      <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:10,padding:"10px 16px",boxShadow:"var(--sh)"}}>
        <div style={{fontSize:22,fontWeight:900,color:"var(--tl)"}}>{myVisits.filter(r=>r.visitType==="初回").length}<span style={{fontSize:11,color:"var(--tx3)",fontWeight:400}}>回</span></div>
        <div style={{fontSize:10,color:"var(--tx3)"}}>初回</div>
      </div>
      <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:10,padding:"10px 16px",boxShadow:"var(--sh)"}}>
        <div style={{fontSize:22,fontWeight:900,color:"var(--am)"}}>{myVisits.filter(r=>r.visitType==="2回目以降").length}<span style={{fontSize:11,color:"var(--tx3)",fontWeight:400}}>回</span></div>
        <div style={{fontSize:10,color:"var(--tx3)"}}>2回目以降</div>
      </div>
    </div>
    {myVisits.length===0&&<div style={{textAlign:"center",padding:"30px 0",color:"var(--tx3)",fontSize:13}}>まだ訪問記録がありません</div>}
    {myVisits.map(r=><div key={r.id} className="visit-card">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
        <div>
          <span style={{fontSize:12,fontWeight:900,color:"var(--gr2)"}}>{destName(r.destId)}</span>
          <span style={{marginLeft:8,fontSize:10,padding:"2px 7px",borderRadius:8,fontWeight:700,background:r.visitType==="初回"?"rgba(58,160,216,0.18)":"rgba(44,170,96,0.18)",color:r.visitType==="初回"?"var(--tl)":"var(--gr2)"}}>{r.visitType}</span>
        </div>
        <div style={{fontSize:10,color:"var(--tx3)"}}>{r.date}{r.duration&&` / ${r.duration}分`}</div>
      </div>
      <div style={{fontSize:12,color:"var(--tx)",lineHeight:1.6,marginBottom:4}}>{r.supportContent}</div>
      {r.advice&&<div style={{fontSize:11,color:"var(--tl)",background:"rgba(58,160,216,0.08)",borderRadius:7,padding:"5px 9px",marginBottom:4}}>💡 助言: {r.advice}</div>}
      {r.schoolFeedback&&<div style={{fontSize:11,color:"var(--am)",background:"rgba(224,168,40,0.08)",borderRadius:7,padding:"5px 9px"}}>🏫 施設FB: {r.schoolFeedback}</div>}
      <div style={{fontSize:10,color:"var(--tx3)",marginTop:5}}>{r.staffName}</div>
    </div>)}
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
  const [editId, setEditId] = useState(null); // null=新規, id=編集中
  const facName = FACILITIES.find(f=>f.id===u.facilityId)?.name||"";

  const upd = (k,v) => setForm(p=>({...p,[k]:v}));
  const updSched = (day,k,v) => setForm(p=>({...p,schedule:{...p.schedule,[day]:{...p.schedule[day],[k]:v}}}));
  const updExt = (type,day,v) => setForm(p=>({...p,[type]:{...p[type],[day]:v}}));
  const addGoalRow = () => setForm(p=>({...p,goals:[...p.goals,{id:genId(),priority:"本人支援",achievement:"",domains:[],period:"12ヶ月",reflection:"",no:p.goals.length+1}]}));
  const removeGoalRow = id => setForm(p=>({...p,goals:p.goals.filter(g=>g.id!==id)}));
  const updGoal = (id,k,v) => setForm(p=>({...p,goals:p.goals.map(g=>g.id===id?{...g,[k]:v}:g)}));
  const togDomain = (id,dom) => setForm(p=>({...p,goals:p.goals.map(g=>g.id!==id?g:{...g,domains:g.domains.includes(dom)?g.domains.filter(d=>d!==dom):[...g.domains,dom]})}));

  const save = () => {
    if(editId){
      // 既存レコードを更新
      store.updIspDraft(editId, {...form, updatedAt:todayISO()});
      setEditId(null);
    } else {
      // 新規作成
      const draft={...form,id:genId(),userId:u.id,facilityId:u.facilityId,createdAt:todayISO()};
      store.addIspDraft(draft);
    }
    setForm(newDraftForm(user.displayName));
    setMode("list");
  };

  // 編集モードに入る
  const startEdit = (item) => {
    setForm({...item});
    setEditId(item.id);
    setViewItem(null);
    setMode("new");
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
          <button onClick={()=>startEdit(viewItem)} style={{padding:"7px 14px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid var(--tl)",background:"rgba(58,160,216,0.1)",color:"var(--tl)"}}>✏️ 編集</button>
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
        <div style={{fontSize:15,fontWeight:900}}>📋 個別支援計画（原案）{editId?"編集":"作成"}</div>
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

  // ★ バグ修正: 保存後に再度編集ボタンを押すと useState の初期値が使われず
  // フォームが空になる問題を修正。record が変わったとき（record.id が変わったとき）
  // にフォーム状態を record.content で再初期化する。
  useEffect(()=>{
    if(record?.content){
      setF({
        userNeeds:"",parentNeeds:"",longGoal:"",longGoalTerm:"1年間",
        shortGoal:"",shortGoalTerm:"6ヶ月",supportContent:"",specificMethods:"",
        staffInCharge:user.displayName,cdsmName:"",frequency:"週3〜4回",
        achievementDate:"",evaluationMethod:"",reviewDate:"",
        validFrom:"",validTo:"",supportPeriod:"",...record.content,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[record?.id]);

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

// ─── 会議・記録フォーム（強化版）───
// 出席者リスト動的管理 + 議題リスト + テンプレート対応
function IspMeetingForm({record, u, user, store, onSave, onCancel}){
  const init = record?.content || {};

  // 会議種別テンプレート（議題を自動入力）
  const MEETING_TEMPLATES = {
    "個別支援会議": {
      agenda: "①現在の支援状況の確認\n②目標の達成状況と課題の整理\n③支援内容の見直し・変更",
      defaultAttendees: [{name:u.name||"本人",role:"本人",org:"",signed:false},{name:"",role:"保護者",org:"",signed:false},{name:user.displayName,role:"児発管",org:"施設",signed:true}]
    },
    "保護者面談": {
      agenda: "①家庭での様子の共有\n②施設での取り組みの報告\n③保護者からの要望・質問",
      defaultAttendees: [{name:"",role:"保護者",org:"",signed:false},{name:user.displayName,role:"担当職員",org:"施設",signed:true}]
    },
    "担当者会議": {
      agenda: "①情報共有\n②支援方針の確認\n③役割分担の確認",
      defaultAttendees: [{name:user.displayName,role:"担当職員",org:"施設",signed:true}]
    },
    "モニタリング会議": {
      agenda: "①前回計画の振り返り\n②目標達成状況の確認\n③次期計画への反映事項",
      defaultAttendees: [{name:"",role:"保護者",org:"",signed:false},{name:user.displayName,role:"児発管",org:"施設",signed:true}]
    },
    "サービス担当者会議": {
      agenda: "①各サービスの現状報告\n②総合的な支援方針の確認\n③連絡調整事項",
      defaultAttendees: [{name:"",role:"相談支援専門員",org:"",signed:false},{name:"",role:"保護者",org:"",signed:false},{name:user.displayName,role:"児発管",org:"施設",signed:true}]
    },
    "その他": { agenda:"", defaultAttendees:[{name:user.displayName,role:"職員",org:"施設",signed:true}] }
  };

  const defaultAttList = init.attendeeList || MEETING_TEMPLATES["個別支援会議"].defaultAttendees;
  const defaultTopics = init.topics || [{topic:"",discussion:"",decision:""}];

  const [meetingType,setMeetingType]=useState(init.meetingType||"個別支援会議");
  const [date,setDate]=useState(init.date||todayISO());
  const [location,setLocation]=useState(init.location||"");
  const [attendeeList,setAttList]=useState(defaultAttList);
  const [agenda,setAgenda]=useState(init.agenda||MEETING_TEMPLATES["個別支援会議"].agenda);
  const [topics,setTopics]=useState(defaultTopics);  // 議題リスト
  const [parentOpinion,setParentOpinion]=useState(init.parentOpinion||"");
  const [nextMeeting,setNextMeeting]=useState(init.nextMeeting||"");
  const [notes,setNotes]=useState(init.notes||"");
  const [saving,setSaving]=useState(false);

  // テンプレート適用
  const applyTemplate=(type)=>{
    setMeetingType(type);
    const tmpl = MEETING_TEMPLATES[type];
    if(!init.agenda) setAgenda(tmpl.agenda);
    if(!init.attendeeList) setAttList(tmpl.defaultAttendees.map(a=>({...a})));
  };

  // 出席者操作
  const addAtt=()=>setAttList(p=>[...p,{name:"",role:"",org:"",signed:false}]);
  const removeAtt=(i)=>setAttList(p=>p.filter((_,j)=>j!==i));
  const updAtt=(i,k,v)=>setAttList(p=>p.map((a,j)=>j===i?{...a,[k]:v}:a));

  // 議題操作
  const addTopic=()=>setTopics(p=>[...p,{topic:"",discussion:"",decision:""}]);
  const removeTopic=(i)=>setTopics(p=>p.filter((_,j)=>j!==i));
  const updTopic=(i,k,v)=>setTopics(p=>p.map((t,j)=>j===i?{...t,[k]:v}:t));

  const handleSave=()=>{
    setSaving(true);
    const content={meetingType,date,location,attendeeList,agenda,topics,parentOpinion,nextMeeting,notes};
    const histEntry={actor:user.displayName,role:user.role,action:record?"更新":"新規作成",at:nowStr(),note:""};
    try{
      if(record){
        store.updIspRecord(record.id,{content,updatedAt:nowStr(),history:[...(record.history||[]),histEntry]});
      } else {
        store.addIspRecord({id:genId(),userId:u.id,facilityId:u.facilityId,
          docType:"meeting",status:"staff_checked",content,
          createdBy:user.displayName,createdAt:nowStr(),updatedAt:nowStr(),history:[histEntry]});
      }
      store.showToast(record?"会議記録を更新しました":"会議記録を保存しました");
    }catch(e){ store.showToast("保存に失敗しました","error"); }
    setSaving(false);
    onSave();
  };

  const mtypes=Object.keys(MEETING_TEMPLATES);
  const signedCount = attendeeList.filter(a=>a.signed).length;

  return <div style={{paddingBottom:28}}>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
      <button className="bback" onClick={onCancel}>← 戻る</button>
      <div style={{fontSize:15,fontWeight:900}}>📝 支援会議記録</div>
    </div>

    {/* 会議基本情報 */}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:16,boxShadow:"var(--sh)",marginBottom:12}}>
      <div style={{fontSize:11,fontWeight:700,color:"var(--tl)",marginBottom:10}}>▍基本情報</div>
      <div className="fg"><label className="fl">会議種別</label>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
          {mtypes.map(t=><button key={t} onClick={()=>applyTemplate(t)}
            style={{padding:"6px 11px",borderRadius:9,fontWeight:700,fontSize:11,cursor:"pointer",border:"1.5px solid",fontFamily:"'Noto Sans JP',sans-serif",
              background:meetingType===t?"var(--tl)":"var(--bg)",color:meetingType===t?"#fff":"var(--tx3)",borderColor:meetingType===t?"var(--tl)":"var(--bd)"}}>
            {t}
          </button>)}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div className="fg" style={{marginBottom:0}}><label className="fl">開催日 <span style={{color:"var(--ro)"}}>*</span></label>
          <input className="fi" type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
        <div className="fg" style={{marginBottom:0}}><label className="fl">場所</label>
          <input className="fi" value={location} onChange={e=>setLocation(e.target.value)} placeholder="例: GO HOME 相談室"/></div>
      </div>
    </div>

    {/* 出席者リスト */}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:16,boxShadow:"var(--sh)",marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontSize:11,fontWeight:700,color:"var(--tl)"}}>▍出席者リスト
          <span style={{marginLeft:8,fontSize:10,color:"var(--gr)"}}>署名取得: {signedCount}/{attendeeList.length}</span>
        </div>
        <button onClick={addAtt}
          style={{padding:"5px 12px",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"rgba(58,160,216,0.1)",border:"1.5px solid var(--tl)",color:"var(--tl)"}}>
          ＋ 追加
        </button>
      </div>
      {attendeeList.map((a,i)=>(
        <div key={i} style={{display:"grid",gridTemplateColumns:"2fr 1.5fr 1.5fr auto auto",gap:6,marginBottom:8,alignItems:"center"}}>
          <input className="fi" style={{marginBottom:0}} value={a.name} onChange={e=>updAtt(i,"name",e.target.value)} placeholder="氏名"/>
          <input className="fi" style={{marginBottom:0}} value={a.role} onChange={e=>updAtt(i,"role",e.target.value)} placeholder="役職・続柄"/>
          <input className="fi" style={{marginBottom:0}} value={a.org} onChange={e=>updAtt(i,"org",e.target.value)} placeholder="所属"/>
          <label style={{display:"flex",alignItems:"center",gap:4,cursor:"pointer",fontSize:11,fontWeight:700,color:a.signed?"var(--gr)":"var(--tx3)",whiteSpace:"nowrap"}}>
            <input type="checkbox" checked={a.signed} onChange={e=>updAtt(i,"signed",e.target.checked)} style={{width:14,height:14}}/>
            署名
          </label>
          <button onClick={()=>removeAtt(i)}
            style={{padding:"4px 8px",borderRadius:7,fontSize:11,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"rgba(224,56,56,0.08)",border:"1px solid rgba(224,56,56,0.25)",color:"var(--ro)"}}>
            ✕
          </button>
        </div>
      ))}
    </div>

    {/* 議題リスト */}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:16,boxShadow:"var(--sh)",marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontSize:11,fontWeight:700,color:"var(--tl)"}}>▍議題・討議内容</div>
        <button onClick={addTopic}
          style={{padding:"5px 12px",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"rgba(58,160,216,0.1)",border:"1.5px solid var(--tl)",color:"var(--tl)"}}>
          ＋ 議題追加
        </button>
      </div>
      <div className="fg" style={{marginBottom:14}}>
        <label className="fl">共通議題・会議の目的</label>
        <textarea className="fta" rows={2} value={agenda} onChange={e=>setAgenda(e.target.value)} placeholder="会議全体の目的・共通議題を記入"/>
      </div>
      {topics.map((t,i)=>(
        <div key={i} style={{background:"var(--bg)",border:"1px solid var(--bd)",borderRadius:10,padding:12,marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontSize:11,fontWeight:700,color:"var(--tl)"}}>議題 {i+1}</div>
            {topics.length>1&&<button onClick={()=>removeTopic(i)}
              style={{padding:"3px 8px",borderRadius:7,fontSize:10,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"rgba(224,56,56,0.08)",border:"1px solid rgba(224,56,56,0.25)",color:"var(--ro)"}}>
              削除
            </button>}
          </div>
          <div className="fg" style={{marginBottom:8}}><label className="fl">議題タイトル</label>
            <input className="fi" value={t.topic} onChange={e=>updTopic(i,"topic",e.target.value)} placeholder="例: 来期の支援目標について"/></div>
          <div className="fg" style={{marginBottom:8}}><label className="fl">討議内容・経過 <span style={{color:"var(--ro)"}}>*</span></label>
            <textarea className="fta" rows={3} value={t.discussion} onChange={e=>updTopic(i,"discussion",e.target.value)} placeholder="討議の内容・各参加者の発言要旨を記入"/></div>
          <div className="fg" style={{marginBottom:0}}><label className="fl">決定事項・合意内容</label>
            <textarea className="fta" rows={2} value={t.decision} onChange={e=>updTopic(i,"decision",e.target.value)} placeholder="この議題での決定・合意事項"/></div>
        </div>
      ))}
    </div>

    {/* その他 */}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:16,boxShadow:"var(--sh)",marginBottom:12}}>
      <div style={{fontSize:11,fontWeight:700,color:"var(--tl)",marginBottom:10}}>▍保護者意見・次回予定</div>
      <div className="fg"><label className="fl">保護者意見・要望</label>
        <textarea className="fta" rows={2} value={parentOpinion} onChange={e=>setParentOpinion(e.target.value)} placeholder="保護者からの発言・要望を記入"/></div>
      <div className="fg"><label className="fl">次回会議予定</label>
        <input className="fi" type="date" value={nextMeeting} onChange={e=>setNextMeeting(e.target.value)}/></div>
      <div className="fg"><label className="fl">特記事項・備考</label>
        <textarea className="fta" rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="その他特記事項"/></div>
    </div>

    <div style={{display:"flex",gap:10}}>
      <button className="bcancel" onClick={onCancel}>キャンセル</button>
      <button className="bsave" onClick={handleSave}
        disabled={saving||topics.every(t=>!t.discussion)}
        style={{opacity:saving||topics.every(t=>!t.discussion)?0.5:1}}>
        {saving?"保存中…":"💾 保存する"}
      </button>
    </div>
  </div>;
}

// ─── 保護者同意書フォーム（強化版）───
// 同意タイプ選択・有効期限・同意事項チェックリスト対応
function IspConsentForm({record, u, user, store, onSave, onCancel}){
  const init = record?.content || {};
  const latestIsp = [...(store.ispRecords||[])].filter(r=>r.userId===u.id&&r.docType==="isp_plan")
    .sort((a,b)=>b.createdAt>a.createdAt?1:-1)[0];

  // 同意タイプ定義
  const CONSENT_TYPES = [
    {id:"isp",       label:"個別支援計画への同意",     required:true,  desc:"個別支援計画の内容について説明を受け、上記計画に基づいた支援を実施することに同意します。"},
    {id:"photo",     label:"写真・動画の撮影・使用",    required:false, desc:"支援活動中の写真・動画の撮影、および施設内での活用（連絡帳・保護者向け記録等）に同意します。"},
    {id:"info_share",label:"個人情報の共有",            required:false, desc:"支援の質向上のため、関係機関（学校・相談支援事業所等）との必要な情報共有に同意します。"},
    {id:"transport", label:"送迎サービスの利用",        required:false, desc:"施設による送迎サービスを利用することに同意します。"},
    {id:"medical",   label:"緊急時の医療対応",          required:false, desc:"緊急時に必要な救急対応（119番通報・医療機関への搬送）について同意します。"},
    {id:"other",     label:"その他の同意事項",          required:false, desc:""},
  ];

  // 初期化（既存レコードから or 新規）
  const initChecked = init.checkedTypes || (latestIsp ? ["isp"] : []);
  const [checkedTypes, setCheckedTypes] = useState(initChecked);
  const [f,setF]=useState({
    ispPlanRef:  init.ispPlanRef||(latestIsp?.id||""),
    explanationDate: init.explanationDate||todayISO(),
    explainedBy: init.explainedBy||user.displayName,
    parentName:  init.parentName||u.parentName||"",
    relationship:init.relationship||"保護者",
    parentSignedAt: init.parentSignedAt||"",
    validUntil:  init.validUntil||"",  // 有効期限
    consentContent: init.consentContent||"",
    customDesc:  init.customDesc||"",  // 「その他」用カスタム文
    notes:       init.notes||"",
  });
  const upd=(k,v)=>setF(p=>({...p,[k]:v}));
  const toggleType=(id)=>setCheckedTypes(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  const [saving,setSaving]=useState(false);

  // 次の期限を自動計算（説明日から1年後）
  const autoExpiry=()=>{
    if(f.explanationDate){
      const d=new Date(f.explanationDate);
      d.setFullYear(d.getFullYear()+1);
      upd("validUntil", d.toISOString().slice(0,10));
    }
  };

  const handleSave=()=>{
    setSaving(true);
    const signed = !!f.parentSignedAt;
    const content={...f, checkedTypes};
    const histEntry={actor:user.displayName,role:user.role,action:record?"更新":(signed?"保護者署名取得":"説明済み記録"),at:nowStr(),note:""};
    const newStatus = signed ? "parent_consented" : "parent_explained";
    try{
      if(record){
        store.updIspRecord(record.id,{content,status:newStatus,updatedAt:nowStr(),
          history:[...(record.history||[]),histEntry]});
        if(signed&&latestIsp&&latestIsp.status==="parent_explained"){
          store.updIspRecord(latestIsp.id,{status:"parent_consented",
            history:[...(latestIsp.history||[]),{...histEntry,action:"保護者同意取得（同意書より）"}]});
        }
      } else {
        store.addIspRecord({id:genId(),userId:u.id,facilityId:u.facilityId,
          docType:"consent",status:newStatus,content,
          createdBy:user.displayName,createdAt:nowStr(),updatedAt:nowStr(),history:[histEntry]});
      }
      store.showToast(signed?"✍️ 保護者署名を記録しました":"説明済みとして保存しました");
    }catch(e){ store.showToast("保存に失敗しました","error"); }
    setSaving(false);
    onSave();
  };

  // 有効期限の警告
  const today = todayISO();
  const expExpired = f.validUntil && f.validUntil < today;
  const expSoon = f.validUntil && !expExpired &&
    new Date(f.validUntil)-new Date(today) < 60*86400000;

  return <div style={{paddingBottom:28}}>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
      <button className="bback" onClick={onCancel}>← 戻る</button>
      <div style={{fontSize:15,fontWeight:900}}>✍️ 保護者説明・同意書</div>
    </div>

    {/* 参照ISP計画 */}
    {latestIsp&&<div style={{background:"rgba(44,170,96,0.08)",border:"1px solid rgba(44,170,96,0.25)",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:11}}>
      <div style={{fontWeight:700,color:"var(--gr)"}}>参照中の個別支援計画: {latestIsp.content?.validFrom}〜{latestIsp.content?.validTo}</div>
      <div style={{color:"var(--tx3)",marginTop:2}}>ステータス: <IspStatusBadge status={latestIsp.status} small/></div>
    </div>}

    {/* 同意タイプ選択 */}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:16,boxShadow:"var(--sh)",marginBottom:12}}>
      <div style={{fontSize:11,fontWeight:700,color:"var(--tl)",marginBottom:10}}>▍同意事項の選択</div>
      {CONSENT_TYPES.map(ct=>(
        <div key={ct.id} style={{padding:"10px 0",borderBottom:"1px solid var(--bg2)"}}>
          <label style={{display:"flex",alignItems:"flex-start",gap:10,cursor:"pointer"}}>
            <input type="checkbox" checked={checkedTypes.includes(ct.id)}
              onChange={()=>toggleType(ct.id)}
              style={{width:16,height:16,marginTop:2,cursor:"pointer"}}/>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:12,color:checkedTypes.includes(ct.id)?"var(--tl)":"var(--tx2)"}}>
                {ct.label}{ct.required&&<span style={{fontSize:10,color:"var(--ro)",marginLeft:6}}>必須</span>}
              </div>
              {checkedTypes.includes(ct.id)&&ct.id!=="other"&&<div style={{fontSize:11,color:"var(--tx3)",marginTop:4,lineHeight:1.5}}>{ct.desc}</div>}
              {checkedTypes.includes(ct.id)&&ct.id==="other"&&
                <textarea className="fta" rows={2} style={{marginTop:6}} value={f.customDesc}
                  onChange={e=>upd("customDesc",e.target.value)} placeholder="その他の同意事項を記入してください"/>}
            </div>
          </label>
        </div>
      ))}
      {checkedTypes.length===0&&<div style={{fontSize:11,color:"var(--ro)",marginTop:8}}>⚠️ 同意事項を1つ以上選択してください</div>}
    </div>

    {/* 説明・署名情報 */}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:16,boxShadow:"var(--sh)",marginBottom:12}}>
      <div style={{fontSize:11,fontWeight:700,color:"var(--tl)",marginBottom:10}}>▍説明・署名情報</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div className="fg" style={{marginBottom:0}}><label className="fl">説明日 <span style={{color:"var(--ro)"}}>*</span></label>
          <input className="fi" type="date" value={f.explanationDate} onChange={e=>upd("explanationDate",e.target.value)}/></div>
        <div className="fg" style={{marginBottom:0}}><label className="fl">説明者</label>
          <input className="fi" value={f.explainedBy} onChange={e=>upd("explainedBy",e.target.value)}/></div>
        <div className="fg" style={{marginBottom:0}}><label className="fl">保護者名 <span style={{color:"var(--ro)"}}>*</span></label>
          <input className="fi" value={f.parentName} onChange={e=>upd("parentName",e.target.value)} placeholder="保護者氏名"/></div>
        <div className="fg" style={{marginBottom:0}}><label className="fl">続柄</label>
          <input className="fi" value={f.relationship} onChange={e=>upd("relationship",e.target.value)} placeholder="例: 母"/></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:8,alignItems:"end",marginTop:10}}>
        <div className="fg" style={{marginBottom:0}}>
          <label className="fl">有効期限</label>
          <input className="fi" type="date" value={f.validUntil} onChange={e=>upd("validUntil",e.target.value)}/>
        </div>
        <button onClick={autoExpiry}
          style={{padding:"9px 10px",borderRadius:9,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"rgba(58,160,216,0.1)",border:"1.5px solid var(--tl)",color:"var(--tl)",marginBottom:4,whiteSpace:"nowrap"}}>
          1年後を設定
        </button>
        <div className="fg" style={{marginBottom:0}}>
          <label className="fl">保護者署名日（署名取得済みの場合）</label>
          <input className="fi" type="date" value={f.parentSignedAt} onChange={e=>upd("parentSignedAt",e.target.value)}/>
        </div>
      </div>
      {expExpired&&<div style={{fontSize:11,color:"var(--ro)",fontWeight:700,marginTop:6}}>⚠️ この同意書は有効期限が切れています。再取得が必要です。</div>}
      {expSoon&&<div style={{fontSize:11,color:"var(--am)",fontWeight:700,marginTop:6}}>⚠️ 有効期限が60日以内です（{f.validUntil}）。更新を検討してください。</div>}
      <div className="fg" style={{marginTop:10}}><label className="fl">追加の同意文・特記事項</label>
        <textarea className="fta" rows={2} value={f.consentContent} onChange={e=>upd("consentContent",e.target.value)} placeholder="その他の同意文や特記事項があれば記入"/></div>
      <div className="fg"><label className="fl">備考</label>
        <textarea className="fta" rows={2} value={f.notes} onChange={e=>upd("notes",e.target.value)} placeholder="保護者からの要望・質問への回答など"/></div>
    </div>

    <div style={{display:"flex",gap:10}}>
      <button className="bcancel" onClick={onCancel}>キャンセル</button>
      <button className="bsave" onClick={handleSave}
        disabled={saving||checkedTypes.length===0||!f.parentName||!f.explanationDate}
        style={{opacity:saving||checkedTypes.length===0||!f.parentName||!f.explanationDate?0.5:1}}>
        {saving?"保存中…":(f.parentSignedAt?"✍️ 同意署名取得を記録":"💾 説明済みとして保存")}
      </button>
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
function IspDocCard({rec, onOpen, onEdit, onPrint}){
  const finalized = rec.status==="finalized";
  return <div style={{background:"var(--wh)",border:`1.5px solid ${finalized?"rgba(44,170,96,0.4)":"var(--bd)"}`,borderRadius:11,padding:14,marginBottom:10,boxShadow:"var(--sh)"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
      <div style={{fontWeight:700,fontSize:13,cursor:"pointer",flex:1}} onClick={()=>onOpen(rec)}>{ISP_DOC_LABELS[rec.docType]||rec.docType}</div>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <IspStatusBadge status={rec.status} small/>
        {onPrint&&<button onClick={e=>{e.stopPropagation();onPrint(rec);}}
          style={{padding:"3px 8px",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"var(--bg)",border:"1.5px solid var(--gr)",color:"var(--gr)"}}>
          🖨
        </button>}
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
  // 施設名（印刷用）
  const facName = FACILITIES.find(f=>f.id===u.facilityId)?.name || "GO GROUP";

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
    // ★ バグ修正: key={editRec?.id||"new"} を付けることで、新規作成と編集で
    // コンポーネントが確実に再マウントされ、useState が正しく再初期化される。
    if(tab==="assessment")  return <IspAssessmentForm  key={editRec?.id||"new"} record={rec} u={u} user={user} store={store} onSave={saved} onCancel={cancel}/>;
    if(tab==="isp_plan")    return <IspPlanForm        key={editRec?.id||"new"} record={rec} u={u} user={user} store={store} onSave={saved} onCancel={cancel}/>;
    if(tab==="weekly_plan") return <IspWeeklyPlanForm  key={editRec?.id||"new"} record={rec} u={u} user={user} store={store} onSave={saved} onCancel={cancel}/>;
    if(tab==="monitoring")  return <IspMonitoringForm  key={editRec?.id||"new"} record={rec} u={u} user={user} store={store} onSave={saved} onCancel={cancel}/>;
    if(tab==="meeting")     return <IspMeetingForm     key={editRec?.id||"new"} record={rec} u={u} user={user} store={store} onSave={saved} onCancel={cancel}/>;
    if(tab==="consent")     return <IspConsentForm     key={editRec?.id||"new"} record={rec} u={u} user={user} store={store} onSave={saved} onCancel={cancel}/>;
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
        <div style={{display:"flex",gap:8}}>
          <button className="bexp" style={{width:"auto",padding:"7px 14px",marginTop:0,fontSize:12}}
            onClick={()=>printIspRecord(viewRec, u, facName)}>🖨 印刷・PDF</button>
          <button className="bsave" style={{width:"auto",padding:"7px 16px",marginTop:0,fontSize:12}}
            onClick={()=>{setTab(viewRec.docType);setEditRec(viewRec);setViewRec(null);}}>✏️ 編集</button>
        </div>
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
        <div style={{fontSize:11,color:"var(--tx3)"}}>{u.grade} ／ {facName}</div>
      </div>
      <button className="bexp" style={{width:"auto",padding:"7px 12px",marginTop:0,fontSize:12,flexShrink:0}}
        onClick={()=>printIspAllRecords(myRecs, u, facName)}>
        📋 一括印刷
      </button>
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
      :tabRecs.map(rec=><IspDocCard key={rec.id} rec={rec}
          onOpen={r=>{setViewRec(r);setTab(r.docType);}}
          onEdit={r=>{setTab(r.docType);setEditRec(r);}}
          onPrint={r=>printIspRecord(r, u, facName)}/>)
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
  const [screenTab,setScreenTab]=useState("users"); // users / meetings / consents
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

  // ─── 会議録管理ビュー ───
  const allMeetings = (store.ispRecords||[])
    .filter(r=>r.docType==="meeting"&&(!fac||myUsers.some(u=>u.id===r.userId)))
    .sort((a,b)=>b.content?.date>a.content?.date?1:-1);

  // ─── 同意書管理ビュー ───
  const allConsents = (store.ispRecords||[])
    .filter(r=>r.docType==="consent"&&(!fac||myUsers.some(u=>u.id===r.userId)))
    .sort((a,b)=>b.content?.explanationDate>a.content?.explanationDate?1:-1);
  const expiredConsents = allConsents.filter(c=>c.content?.validUntil&&c.content.validUntil<today);
  const expiringSoonConsents = allConsents.filter(c=>c.content?.validUntil&&c.content.validUntil>=today&&
    new Date(c.content.validUntil)-new Date(today)<60*86400000);
  const noConsentUsers = myUsers.filter(u=>!allConsents.some(c=>c.userId===u.id&&c.content?.checkedTypes?.includes("isp")));

  return <div style={{paddingBottom:28}}>
    {/* ヘッダー */}
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
      <button className="bback" onClick={onBack}>← 戻る</button>
      <div style={{flex:1}}>
        <div style={{fontSize:17,fontWeight:900}}>📋 個別支援計画</div>
        <div style={{fontSize:11,color:"var(--tx3)"}}>アセスメント・計画原案・承認フロー・モニタリング</div>
      </div>
    </div>

    {/* スクリーンタブ */}
    <div style={{display:"flex",gap:6,marginBottom:16}}>
      {[
        {id:"users",   icon:"👤", label:"利用者別"},
        {id:"meetings",icon:"📝", label:`会議録管理${allMeetings.length>0?` (${allMeetings.length})`:""}` },
        {id:"consents",icon:"✍️", label:`同意書管理${expiredConsents.length>0?` ⚠️${expiredConsents.length}`:""}` },
      ].map(t=>(
        <button key={t.id} onClick={()=>setScreenTab(t.id)}
          style={{padding:"8px 14px",borderRadius:10,fontWeight:700,fontSize:12,cursor:"pointer",border:"1.5px solid",fontFamily:"'Noto Sans JP',sans-serif",
            background:screenTab===t.id?"var(--tl)":"var(--bg)",
            color:screenTab===t.id?"#fff":"var(--tx3)",
            borderColor:screenTab===t.id?"var(--tl)":"var(--bd)"}}>
          {t.icon} {t.label}
        </button>
      ))}
    </div>

    {/* ─── 会議録管理タブ ─── */}
    {screenTab==="meetings"&&<div>
      <div style={{fontSize:13,fontWeight:700,color:"var(--tx2)",marginBottom:12}}>
        施設内の支援会議記録一覧 — {allMeetings.length}件
      </div>
      {allMeetings.length===0
        ?<div style={{textAlign:"center",color:"var(--tx3)",padding:24,background:"var(--bg)",borderRadius:11}}>
          会議記録がありません。各利用者の書類から作成してください。
        </div>
        :allMeetings.map(rec=>{
          const u2=myUsers.find(u=>u.id===rec.userId);
          const c=rec.content||{};
          const sigCount=(c.attendeeList||[]).filter(a=>a.signed).length;
          const attTotal=(c.attendeeList||[]).length;
          return <div key={rec.id} style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:14,marginBottom:10,boxShadow:"var(--sh)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <div style={{fontWeight:700,fontSize:13}}>{c.meetingType||"会議記録"}</div>
                <div style={{fontSize:11,color:"var(--tx3)",marginTop:3}}>
                  📅 {c.date||""} 　📍 {c.location||"場所未記入"}
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:11,color:"var(--tl)",fontWeight:700}}>{u2?.name||rec.userId}</div>
                <div style={{fontSize:10,color:"var(--tx3)",marginTop:2}}>
                  署名 {sigCount}/{attTotal}名
                </div>
              </div>
            </div>
            {(c.topics||[]).filter(t=>t.topic).length>0&&
              <div style={{fontSize:11,color:"var(--tx3)",marginTop:6}}>
                議題: {(c.topics||[]).map(t=>t.topic).filter(Boolean).join(" / ")}
              </div>}
            {c.nextMeeting&&<div style={{fontSize:11,color:c.nextMeeting<today?"var(--ro)":"var(--gr)",marginTop:4,fontWeight:700}}>
              次回予定: {c.nextMeeting}{c.nextMeeting<today?" ⚠️ 期日超過":""}
            </div>}
            <div style={{fontSize:10,color:"var(--tx3)",marginTop:4}}>
              作成: {rec.createdBy} / {rec.createdAt?.slice(0,10)}
            </div>
          </div>;
        })
      }
    </div>}

    {/* ─── 同意書管理タブ ─── */}
    {screenTab==="consents"&&<div>
      {/* サマリーアラート */}
      {expiredConsents.length>0&&<div className="alert-danger" style={{borderRadius:10,padding:"10px 14px",marginBottom:10,fontSize:12,fontWeight:700}}>
        🔴 同意書の有効期限切れ: {expiredConsents.length}件 — 早急に再取得してください
      </div>}
      {expiringSoonConsents.length>0&&<div style={{background:"rgba(240,112,32,0.1)",border:"1px solid rgba(240,112,32,0.3)",borderRadius:10,padding:"10px 14px",marginBottom:10,fontSize:12,fontWeight:700,color:"var(--am)"}}>
        🟡 60日以内に有効期限切れ: {expiringSoonConsents.length}件
      </div>}
      {noConsentUsers.length>0&&<div style={{background:"rgba(58,160,216,0.08)",border:"1px solid rgba(58,160,216,0.2)",borderRadius:10,padding:"10px 14px",marginBottom:10,fontSize:12}}>
        🔵 ISP同意書未取得: <span style={{fontWeight:700}}>{noConsentUsers.map(u=>u.name).join("、")}</span>
      </div>}

      <div style={{fontSize:13,fontWeight:700,color:"var(--tx2)",marginBottom:12}}>
        同意書一覧 — {allConsents.length}件
      </div>
      {allConsents.length===0
        ?<div style={{textAlign:"center",color:"var(--tx3)",padding:24,background:"var(--bg)",borderRadius:11}}>
          同意書がありません。各利用者の書類から作成してください。
        </div>
        :allConsents.map(rec=>{
          const u2=myUsers.find(u=>u.id===rec.userId);
          const c=rec.content||{};
          const expired=c.validUntil&&c.validUntil<today;
          const soon=c.validUntil&&!expired&&new Date(c.validUntil)-new Date(today)<60*86400000;
          const CONSENT_LABELS={isp:"ISP同意",photo:"写真撮影",info_share:"情報共有",transport:"送迎",medical:"緊急対応",other:"その他"};
          return <div key={rec.id} style={{background:"var(--wh)",border:`1.5px solid ${expired?"rgba(224,56,56,0.4)":soon?"rgba(240,112,32,0.3)":"var(--bd)"}`,borderRadius:11,padding:14,marginBottom:10,boxShadow:"var(--sh)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <div style={{fontWeight:700,fontSize:13}}>{u2?.name||rec.userId}</div>
                <div style={{fontSize:11,color:"var(--tx3)",marginTop:3}}>
                  説明日: {c.explanationDate||"未記入"} 　保護者: {c.parentName||"未記入"}
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <IspStatusBadge status={rec.status} small/>
                {c.parentSignedAt&&<div style={{fontSize:10,color:"var(--gr)",marginTop:3,fontWeight:700}}>✅ 署名済 {c.parentSignedAt}</div>}
              </div>
            </div>
            {(c.checkedTypes||[]).length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:8}}>
              {(c.checkedTypes||[]).map(ct=><span key={ct} style={{fontSize:10,padding:"2px 7px",borderRadius:7,background:"rgba(58,160,216,0.12)",color:"var(--tl)",fontWeight:700}}>{CONSENT_LABELS[ct]||ct}</span>)}
            </div>}
            {c.validUntil&&<div style={{fontSize:11,fontWeight:700,marginTop:6,color:expired?"var(--ro)":soon?"var(--am)":"var(--gr)"}}>
              有効期限: {c.validUntil}{expired?" 🔴 期限切れ":soon?" 🟡 まもなく期限切れ":" ✅"}
            </div>}
          </div>;
        })
      }
    </div>}

    {/* ─── 利用者別タブ ─── */}
    {screenTab==="users"&&<>

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
    </>}
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

// ─── 国保連出力タブ ───
function KokuhoOutputTab({user,store,facilityId,yearMonth,vm}){
  const fac = FACILITIES.find(f=>f.id===facilityId)||{};
  const facSettings = store.facilityBillingSettings[facilityId]||{};
  const TANKA = getShizuokaTanka(facSettings.city||"その他");
  const master = getBillingMaster(yearMonth);
  // この月の請求データ
  const kk = store.kokuho.filter(k=>k.facilityId===facilityId&&k.year===vm.y&&k.month===vm.m);
  // 利用者マスタ（受給者証番号などを取得）
  const userMap = {};
  store.dynUsers.forEach(u=>{ userMap[u.id]=u; });
  // 月の来所記録（実績記録票用）
  const inMonth = r => (r.time||"").slice(0,7)===yearMonth && (r.facilityId===facilityId||r.facility_id===facilityId);
  const monthRecs = store.recs.filter(inMonth);

  // ─── 出力前チェック ───
  const checks = kk.map(k=>{
    const u = userMap[k.userId]||{};
    const issues=[];
    if(!u.jukyushaNo && !u.data?.jukyushaNo) issues.push("受給者証番号未入力");
    if(!u.jukyushaExpiry && !u.data?.jukyushaExpiry) issues.push("有効期限未入力");
    else {
      const exp = u.jukyushaExpiry||u.data?.jukyushaExpiry||"";
      if(exp < yearMonth+"-28") issues.push("受給者証期限切れ");
    }
    if(!u.jukyushaCity && !u.data?.jukyushaCity && !u.data?.jukyushaCityName) issues.push("市区町村未入力");
    if(!(k.serviceDays>0)) issues.push("利用日数が0");
    return {k, u, issues};
  });
  const ngCount = checks.filter(c=>c.issues.length>0).length;
  const okCount = checks.filter(c=>c.issues.length===0).length;

  // ─── 詳細CSVダウンロード ───
  const downloadCSV = () => {
    const headers = [
      "利用者ID","受給者証番号","氏名","フリガナ","生年月日","市区町村",
      "サービス種別","利用日数","送迎日数","基本単位数","加算単位数","合計単位数",
      "地域単価","請求額(円)","自己負担率","自己負担額(円)","状態","備考"
    ];
    const rows = kk.map(k=>{
      const u = userMap[k.userId]||{};
      const ud = u.data||u;
      const jukyushaNo  = ud.jukyushaNo  || "";
      const nameKana    = ud.nameKana    || "";
      const dob         = ud.dob         || "";
      const city        = ud.jukyushaCity||ud.jukyushaCityName||facSettings.city||"";
      const svcType     = ud.serviceType || (ud.facilityId==="f1"||ud.facilityId==="f2"?"放デイ":"放デイ");
      const tu          = calcTotalUnits(k);
      const baseUnits   = k.serviceDays*(k.unitPrice||576);
      const addUnits    = tu - baseUnits;
      const billingAmt  = Math.round(tu * TANKA);
      const copayRate   = 0.1; // 1割負担（実際は受給者証の上限管理あり）
      const copayAmt    = Math.round(billingAmt * copayRate);
      return [
        k.userId, jukyushaNo, k.userName, nameKana, dob, city,
        svcType, k.serviceDays||0, k.transportDays||0, baseUnits, addUnits, tu,
        TANKA, billingAmt, "10%", copayAmt, k.status||"未請求", ""
      ];
    });
    const csvContent = [headers, ...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿"+csvContent], {type:"text/csv;charset=utf-8;"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `kokuho_${yearMonth}_${fac.name||facilityId}.csv`;
    a.click();
  };

  // ─── サービス提供実績記録票（印刷）───
  const printJisseki = () => {
    const facName = fac.name||"";
    const jigyoshoNo = facSettings.jigyoshoNo||"（番号未設定）";
    const daysInMonth = new Date(vm.y, vm.m, 0).getDate();
    const dayHeaders = Array.from({length:daysInMonth},(_,i)=>i+1).map(d=>`<th>${d}</th>`).join("");

    const userRows = kk.map(k=>{
      const u = userMap[k.userId]||{};
      const ud = u.data||u;
      const jukyushaNo = ud.jukyushaNo||"";
      // その利用者の来所日を取得
      const arrivals = monthRecs.filter(r=>r.type==="user_in"&&r.userId===k.userId);
      const arrivedDates = new Set(arrivals.map(r=>(r.time||"").slice(8,10).replace(/^0/,"")));
      const daysCells = Array.from({length:daysInMonth},(_,i)=>{
        const d = String(i+1);
        const arrived = arrivedDates.has(d);
        return `<td style="background:${arrived?"#e6f5ec":"#fff"};color:${arrived?"#1a7a3a":"#ccc"};font-size:9pt;">${arrived?"○":""}</td>`;
      }).join("");
      const tu = calcTotalUnits(k);
      return `<tr>
        <td style="text-align:left;font-weight:700;padding:3px 6px;min-width:80px;">${k.userName}</td>
        <td style="font-size:8pt;padding:3px 4px;min-width:90px;">${jukyushaNo}</td>
        ${daysCells}
        <td style="font-weight:700;color:#1a4a8a;">${k.serviceDays||0}</td>
        <td style="font-weight:700;color:#1a4a8a;">${k.transportDays||0}</td>
        <td style="font-weight:700;">${tu.toLocaleString()}</td>
        <td style="font-weight:700;color:#8a2010;">${Math.round(tu*TANKA).toLocaleString()}円</td>
      </tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"/>
    <title>サービス提供実績記録票 ${yearMonth}</title>
    <style>
      @page{size:A3 landscape;margin:10mm 8mm;}
      *{box-sizing:border-box;} body{font-family:'MS Gothic',Meiryo,sans-serif;font-size:9pt;color:#111;}
      h2{font-size:13pt;margin-bottom:3px;} .meta{font-size:8pt;color:#555;margin-bottom:10px;}
      table{border-collapse:collapse;width:100%;font-size:8pt;}
      th,td{border:1px solid #bbb;padding:2px 3px;text-align:center;}
      th{background:#dce8f8;font-weight:700;}
      .sign-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:14px;}
      .sign-box{border:1px solid #aaa;padding:6px;min-height:44px;border-radius:3px;}
      .sign-lbl{font-size:8pt;color:#666;margin-bottom:3px;}
    </style></head><body>
    <h2>📋 サービス提供実績記録票</h2>
    <div class="meta">
      事業所名: ${facName}　事業所番号: ${jigyoshoNo}
      対象年月: ${vm.y}年${vm.m}月　出力日時: ${new Date().toLocaleString("ja-JP")}
      適用マスタ: ${master.name}
    </div>
    <table>
      <thead><tr>
        <th style="min-width:80px;">利用者名</th>
        <th style="min-width:90px;">受給者証番号</th>
        ${dayHeaders}
        <th>利用<br/>日数</th>
        <th>送迎<br/>日数</th>
        <th>単位数</th>
        <th>請求額</th>
      </tr></thead>
      <tbody>${userRows}</tbody>
    </table>
    <div class="sign-row">
      <div class="sign-box"><div class="sign-lbl">管理者 確認印</div></div>
      <div class="sign-box"><div class="sign-lbl">児発管 確認印</div></div>
      <div class="sign-box"><div class="sign-lbl">担当職員</div></div>
      <div class="sign-box"><div class="sign-lbl">確認日: ${new Date().toLocaleDateString("ja-JP")}</div></div>
    </div>
    </body></html>`;
    const w = window.open("","_blank","width=1200,height=800");
    if(w){ w.document.write(html); w.document.close(); setTimeout(()=>w.print(),400); }
  };

  // ─── 個別請求明細書（印刷）───
  const printMeisai = (k) => {
    const u = userMap[k.userId]||{};
    const ud = u.data||u;
    const tu = calcTotalUnits(k);
    const billingAmt = Math.round(tu*TANKA);
    const copayAmt = Math.round(billingAmt*0.1);
    const arrivals = monthRecs.filter(r=>r.type==="user_in"&&r.userId===k.userId);
    const datesHtml = arrivals.map(r=>`<li>${(r.time||"").slice(0,16)}　送迎:${r.transport||"なし"}　体温:${r.temp||"-"}</li>`).join("");
    const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"/>
    <title>請求明細書 ${k.userName}</title>
    <style>
      @page{size:A4;margin:20mm 15mm;}
      body{font-family:'MS Gothic',Meiryo,sans-serif;font-size:10pt;color:#111;}
      h2{font-size:14pt;border-bottom:2px solid #333;padding-bottom:6px;margin-bottom:10px;}
      .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;}
      .info-item{border:1px solid #bbb;padding:7px 10px;border-radius:3px;}
      .info-lbl{font-size:8pt;color:#555;margin-bottom:2px;}
      .info-val{font-size:11pt;font-weight:700;}
      table{border-collapse:collapse;width:100%;font-size:9pt;margin-top:8px;}
      th,td{border:1px solid #bbb;padding:5px 8px;}
      th{background:#e8eef8;font-weight:700;text-align:center;}
      .total-row{font-weight:700;font-size:11pt;}
      ul{padding-left:18px;font-size:9pt;margin:0;}
      li{margin-bottom:3px;}
    </style></head><body>
    <h2>給付費請求明細書</h2>
    <div class="info-grid">
      <div class="info-item"><div class="info-lbl">利用者氏名</div><div class="info-val">${k.userName}</div></div>
      <div class="info-item"><div class="info-lbl">受給者証番号</div><div class="info-val">${ud.jukyushaNo||"（未入力）"}</div></div>
      <div class="info-item"><div class="info-lbl">支給決定市区町村</div><div class="info-val">${ud.jukyushaCity||ud.jukyushaCityName||"—"}</div></div>
      <div class="info-item"><div class="info-lbl">サービス提供年月</div><div class="info-val">${vm.y}年${vm.m}月</div></div>
      <div class="info-item"><div class="info-lbl">事業所名</div><div class="info-val">${fac.name||""}</div></div>
      <div class="info-item"><div class="info-lbl">適用マスタ</div><div class="info-val">${master.name}</div></div>
    </div>
    <table>
      <thead><tr><th>項目</th><th>日数</th><th>単位数</th><th>金額（円）</th></tr></thead>
      <tbody>
        <tr><td>基本報酬（${ud.serviceType||"放デイ"}）</td><td>${k.serviceDays||0}日</td>
          <td>${(k.serviceDays*(k.unitPrice||576)).toLocaleString()}</td>
          <td>${Math.round(k.serviceDays*(k.unitPrice||576)*TANKA).toLocaleString()}</td></tr>
        ${(k.addons||[]).map(a=>`<tr><td>${a.name||a.key}</td><td>${a.perDay?k.serviceDays+"日":"1回"}</td>
          <td>${(a.perDay?a.units*k.serviceDays:a.units).toLocaleString()}</td>
          <td>${Math.round((a.perDay?a.units*k.serviceDays:a.units)*TANKA).toLocaleString()}</td></tr>`).join("")}
        <tr class="total-row" style="background:#f5f8ff;"><td colspan="2"><strong>合計</strong></td>
          <td><strong>${tu.toLocaleString()}</strong></td>
          <td><strong>${billingAmt.toLocaleString()}</strong></td></tr>
        <tr><td colspan="3">自己負担（1割）</td><td>${copayAmt.toLocaleString()}</td></tr>
        <tr style="background:#fff8e6;"><td colspan="3"><strong>給付費請求額（9割）</strong></td>
          <td><strong>${(billingAmt-copayAmt).toLocaleString()}</strong></td></tr>
      </tbody>
    </table>
    <div style="margin-top:16px;font-size:9pt;">
      <div style="font-weight:700;margin-bottom:6px;">■ サービス提供日一覧</div>
      <ul>${datesHtml||"<li>記録なし</li>"}</ul>
    </div>
    <div style="margin-top:20px;display:grid;grid-template-columns:1fr 1fr;gap:14px;">
      <div style="border:1px solid #aaa;padding:10px;min-height:52px;border-radius:3px;">
        <div style="font-size:8pt;color:#555;">事業所 確認印</div>
      </div>
      <div style="border:1px solid #aaa;padding:10px;min-height:52px;border-radius:3px;">
        <div style="font-size:8pt;color:#555;">保護者 確認サイン　　　　　　　年　月　日</div>
      </div>
    </div>
    </body></html>`;
    const w = window.open("","_blank","width=900,height=700");
    if(w){ w.document.write(html); w.document.close(); setTimeout(()=>w.print(),400); }
  };

  return <div>
    {/* ─── 出力前チェック ─── */}
    <div style={{marginBottom:16}}>
      <div className="dash-title" style={{marginBottom:10}}>📋 出力前チェック</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
        <div style={{background:"rgba(44,170,96,0.1)",border:"1px solid rgba(44,170,96,0.35)",borderRadius:10,padding:"10px 14px",textAlign:"center"}}>
          <div style={{fontSize:22,fontWeight:900,color:"var(--gr)"}}>{okCount}</div>
          <div style={{fontSize:11,color:"var(--gr)",fontWeight:700}}>✅ 問題なし</div>
        </div>
        <div style={{background:ngCount>0?"rgba(224,56,56,0.08)":"rgba(44,170,96,0.05)",border:`1px solid ${ngCount>0?"rgba(224,56,56,0.35)":"rgba(44,170,96,0.2)"}`,borderRadius:10,padding:"10px 14px",textAlign:"center"}}>
          <div style={{fontSize:22,fontWeight:900,color:ngCount>0?"var(--ro)":"var(--tx3)"}}>{ngCount}</div>
          <div style={{fontSize:11,color:ngCount>0?"var(--ro)":"var(--tx3)",fontWeight:700}}>⚠️ 要確認</div>
        </div>
      </div>
      {checks.map(({k,u,issues})=>{
        const ud = u.data||u;
        return <div key={k.id} style={{background:"var(--wh)",border:`2px solid ${issues.length>0?"rgba(224,56,56,0.3)":"rgba(44,170,96,0.3)"}`,borderRadius:11,padding:"10px 13px",marginBottom:8,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:120}}>
            <div style={{fontWeight:700,fontSize:13,marginBottom:3}}>{issues.length>0?"⚠️":"✅"} {k.userName}</div>
            <div style={{fontSize:10,color:"var(--tx3)",fontFamily:"'DM Mono',monospace"}}>
              受給者証番号: <span style={{color:ud.jukyushaNo?"var(--tx)":"var(--ro)",fontWeight:700}}>{ud.jukyushaNo||"未入力"}</span>
              　市区町村: <span style={{color:ud.jukyushaCity||ud.jukyushaCityName?"var(--tx)":"var(--ro)",fontWeight:700}}>{ud.jukyushaCity||ud.jukyushaCityName||"未入力"}</span>
            </div>
            {issues.length>0&&<div style={{marginTop:4}}>
              {issues.map((iss,i)=><span key={i} style={{display:"inline-block",fontSize:10,padding:"2px 7px",borderRadius:6,background:"rgba(224,56,56,0.1)",color:"var(--ro)",fontWeight:700,marginRight:4,marginTop:2}}>✗ {iss}</span>)}
            </div>}
          </div>
          <div style={{display:"flex",gap:7,alignItems:"center",flexShrink:0}}>
            <div style={{textAlign:"right",fontFamily:"'DM Mono',monospace",fontSize:12}}>
              <div style={{fontWeight:700,color:"var(--am)"}}>{Math.round(calcTotalUnits(k)*TANKA).toLocaleString()}円</div>
              <div style={{fontSize:10,color:"var(--tx3)"}}>{k.serviceDays||0}日/{calcTotalUnits(k)}単位</div>
            </div>
            <button onClick={()=>printMeisai(k)}
              style={{padding:"7px 12px",borderRadius:9,background:"rgba(58,160,216,0.12)",border:"1px solid rgba(58,160,216,0.4)",color:"var(--tl)",fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",whiteSpace:"nowrap"}}>
              🖨 明細書
            </button>
          </div>
        </div>;
      })}
      {kk.length===0&&<div style={{padding:24,textAlign:"center",color:"var(--tx3)",fontSize:13}}>
        この月の請求データがありません。<br/>
        <span style={{fontSize:11}}>先に「月次サマリー」タブで「確定日報から自動集計」を実行してください。</span>
      </div>}
    </div>

    {/* ─── 出力ボタン群 ─── */}
    {kk.length>0&&<div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:12,padding:"14px 16px",marginBottom:14}}>
      <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>📤 出力メニュー</div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        {/* CSV出力 */}
        <button onClick={downloadCSV}
          style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,padding:"14px 20px",borderRadius:12,background:"linear-gradient(135deg,#1a6b3a,#2d9e58)",color:"#fff",border:"none",cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",fontWeight:700,fontSize:12,minWidth:120}}>
          <span style={{fontSize:22}}>📊</span>
          <span>給付費請求CSV</span>
          <span style={{fontSize:10,opacity:.8}}>{kk.length}名・全カラム</span>
        </button>
        {/* 実績記録票 */}
        <button onClick={printJisseki}
          style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,padding:"14px 20px",borderRadius:12,background:"linear-gradient(135deg,#1a4a8a,#2d6ed6)",color:"#fff",border:"none",cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",fontWeight:700,fontSize:12,minWidth:120}}>
          <span style={{fontSize:22}}>📋</span>
          <span>実績記録票印刷</span>
          <span style={{fontSize:10,opacity:.8}}>A3横・全利用者</span>
        </button>
      </div>
      {ngCount>0&&<div style={{marginTop:10,fontSize:11,color:"var(--am)",display:"flex",gap:6,alignItems:"center"}}>
        <span>⚠️</span>
        <span>{ngCount}名で受給者証番号・市区町村の未入力があります。「利用者管理」で入力してから出力することを推奨します。</span>
      </div>}
    </div>}

    {/* ─── 請求ステータス個別管理 ─── */}
    {kk.length>0&&<div>
      <div className="dash-title" style={{marginBottom:10}}>💴 請求ステータス管理（利用者別）</div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:600}}>
          <thead><tr style={{background:"var(--bg2)"}}>
            {["利用者ID","氏名","受給者証番号","利用日数","請求額","ステータス","操作"].map(h=>(
              <th key={h} style={{padding:"7px 9px",textAlign:"left",color:"var(--tx2)",fontSize:10,fontWeight:700,borderBottom:"2px solid var(--bd)",whiteSpace:"nowrap"}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>{kk.map(k=>{
            const u = userMap[k.userId]||{};
            const ud = u.data||u;
            const tu = calcTotalUnits(k);
            const statusColor = {未請求:"var(--tx3)",請求済:"var(--tl)",入金済:"var(--gr)",過誤:"var(--ro)"}[k.status||"未請求"]||"var(--tx3)";
            return <tr key={k.id} style={{borderBottom:"1px solid var(--bd)"}}>
              <td style={{padding:"7px 9px",fontFamily:"'DM Mono',monospace",fontSize:10,color:"var(--tx3)"}}>{k.userId||"—"}</td>
              <td style={{padding:"7px 9px",fontWeight:700}}>{k.userName}</td>
              <td style={{padding:"7px 9px",fontFamily:"'DM Mono',monospace",color:ud.jukyushaNo?"var(--tx)":"var(--ro)",fontSize:11}}>{ud.jukyushaNo||"未入力"}</td>
              <td style={{padding:"7px 9px",textAlign:"right",fontFamily:"'DM Mono',monospace"}}>{k.serviceDays||0}</td>
              <td style={{padding:"7px 9px",textAlign:"right",fontFamily:"'DM Mono',monospace",fontWeight:700,color:"var(--am)"}}>{Math.round(tu*TANKA).toLocaleString()}円</td>
              <td style={{padding:"7px 9px"}}>
                <select value={k.status||"未請求"}
                  onChange={e=>store.updKokuho(k.id,{status:e.target.value})}
                  style={{fontSize:11,fontWeight:700,color:statusColor,background:"transparent",border:"1px solid var(--bd)",borderRadius:7,padding:"3px 6px",fontFamily:"'Noto Sans JP',sans-serif",cursor:"pointer"}}>
                  {["未請求","請求済","入金済","過誤"].map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </td>
              <td style={{padding:"7px 9px"}}>
                <button onClick={()=>printMeisai(k)}
                  style={{fontSize:11,padding:"4px 9px",borderRadius:7,background:"rgba(58,160,216,0.1)",border:"1px solid rgba(58,160,216,0.4)",color:"var(--tl)",fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>
                  🖨 明細書
                </button>
              </td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </div>}
  </div>;
}

// ─── 月次サマリータブ ───
function BillingSummaryTab({user,store,facilityId,yearMonth,vm,setVm}){
  const [city,setCity]=useState(()=>store.facilityBillingSettings[facilityId]?.city||"その他");
  const [linking,setLinking]=useState(false);
  const TANKA=getShizuokaTanka(city);
  const master=getBillingMaster(yearMonth);
  const kk=store.kokuho.filter(k=>k.facilityId===facilityId&&k.year===vm.y&&k.month===vm.m);

  // ─── 全体パイプライン同期（ISP→実績→日報→請求＋加算自動設定）───
  const autoLinkFromReports=()=>{
    setLinking(true);
    // fullPipelineSyncを呼び出し（実績+日報両方から集計、送迎・個別加算を自動設定）
    const synced=store.fullPipelineSync(facilityId, yearMonth, city);
    if(synced===0){
      store.showToast(`${vm.y}年${vm.m}月の実績データがありません`,"warn");
    } else {
      store.showToast(`✅ ${synced}名分をパイプライン同期しました（送迎加算・個別サポート加算を自動設定）`);
    }
    setLinking(false);
  };

  // ─── パイプライン状況を計算（ISP→実績→請求の連携状態） ───
  const myUsers=store.dynUsers.filter(u=>u.active!==false&&u.facilityId===facilityId);
  const ISP_ACTIVE_ST=["finalized","parent_consented","manager_confirmed"];
  const pipelineRows=myUsers.map(u=>{
    const monthRecs=store.recs.filter(r=>r.facilityId===facilityId&&r.type==="service"&&r.userId===u.id&&(r.time||"").slice(0,7)===yearMonth);
    const activeIsp=(store.ispRecords||[]).filter(r=>r.userId===u.id&&r.docType==="isp_plan"&&ISP_ACTIVE_ST.includes(r.status)).sort((a,b)=>b.createdAt>a.createdAt?1:-1)[0];
    const billing=kk.find(k=>k.userId===u.id);
    const hasLinkedRec=monthRecs.some(r=>r.ispId);
    const lastMon=store.monitorings.filter(m=>m.userId===u.id).sort((a,b)=>b.date>a.date?1:-1)[0];
    const d180=new Date();d180.setDate(d180.getDate()-180);
    const monDue=!lastMon||(lastMon.date<d180.toISOString().slice(0,10));
    return {u,activeIsp,monthRecs,billing,hasLinkedRec,lastMon,monDue,
      ispOk:!!activeIsp, recOk:monthRecs.length>0, billingOk:!!billing&&billing.serviceDays>0,
      ispLinked:hasLinkedRec};
  }).filter(r=>r.recOk||r.ispOk);
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
    {/* ─── 全体パイプライン同期バナー ─── */}
    <div style={{background:"linear-gradient(135deg,rgba(26,58,106,0.12),rgba(44,170,96,0.1))",border:"2px solid rgba(44,170,96,0.35)",borderRadius:14,padding:"14px 16px",marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:10}}>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:700,color:"var(--gr)",marginBottom:3}}>🔗 全体パイプライン同期</div>
          <div style={{fontSize:11,color:"var(--tx3)"}}>
            個別支援計画 → 実績 → 日報 → <strong>請求</strong> を一括同期します。<br/>
            送迎加算・個別サポート加算を自動設定します。既存データは上書きされます。
          </div>
        </div>
        <button onClick={autoLinkFromReports} disabled={linking}
          style={{padding:"12px 20px",borderRadius:10,background:linking?"var(--bg)":"linear-gradient(135deg,#1a6b3a,#2d9e58)",color:linking?"var(--tx3)":"#fff",fontWeight:700,fontSize:13,border:"none",cursor:linking?"not-allowed":"pointer",fontFamily:"'Noto Sans JP',sans-serif",whiteSpace:"nowrap",flexShrink:0,boxShadow:"0 2px 10px rgba(44,170,96,0.3)"}}>
          {linking?"同期中…":"⚡ 一括パイプライン同期"}
        </button>
      </div>
      {/* パイプライン状況フロー表示 */}
      <div style={{display:"flex",alignItems:"center",gap:4,flexWrap:"wrap",fontSize:11,fontWeight:700}}>
        {[
          {icon:"📋",label:"ISP",ok:pipelineRows.filter(r=>r.ispOk).length,total:pipelineRows.length},
          null,
          {icon:"📝",label:"実績",ok:pipelineRows.filter(r=>r.recOk).length,total:pipelineRows.length},
          null,
          {icon:"🔍",label:"モニタリング",ok:pipelineRows.filter(r=>!r.monDue).length,total:pipelineRows.length},
          null,
          {icon:"💴",label:"請求",ok:pipelineRows.filter(r=>r.billingOk).length,total:pipelineRows.length},
        ].map((s,i)=>s===null
          ?<span key={i} style={{color:"var(--gr)",fontSize:14}}>→</span>
          :<span key={i} style={{padding:"3px 10px",borderRadius:8,background:s.ok===s.total&&s.total>0?"rgba(44,170,96,0.2)":"rgba(58,160,216,0.12)",color:s.ok===s.total&&s.total>0?"var(--gr)":"var(--tl)",border:"1px solid",borderColor:s.ok===s.total&&s.total>0?"rgba(44,170,96,0.4)":"rgba(58,160,216,0.3)"}}>
              {s.icon} {s.label} {s.ok}/{s.total}
            </span>
        )}
      </div>
    </div>

    {/* ─── パイプライン状況テーブル ─── */}
    {pipelineRows.length>0&&<div style={{marginBottom:16}}>
      <div className="dash-title" style={{marginBottom:8}}>📊 連携状況（{vm.y}年{vm.m}月）</div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:500}}>
          <thead><tr style={{background:"var(--bg2)"}}>
            {["利用者名","ISP","実績日数","ISP紐付","モニタリング","請求"].map(h=>(
              <th key={h} style={{padding:"6px 9px",textAlign:"left",color:"var(--tx2)",fontSize:10,fontWeight:700,borderBottom:"2px solid var(--bd)",whiteSpace:"nowrap"}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>{pipelineRows.map(({u,activeIsp,monthRecs,billing,hasLinkedRec,lastMon,monDue,ispOk,recOk,billingOk})=>(
            <tr key={u.id} style={{borderBottom:"1px solid var(--bd)"}}>
              <td style={{padding:"7px 9px",fontWeight:700}}>{u.name}</td>
              <td style={{padding:"7px 9px"}}>
                {ispOk
                  ?<span style={{fontSize:10,fontWeight:700,color:"var(--gr)",background:"rgba(44,170,96,0.12)",borderRadius:6,padding:"2px 7px"}}>✅ {activeIsp?.status==="finalized"?"確定":"承認中"}</span>
                  :<span style={{fontSize:10,fontWeight:700,color:"var(--ro)",background:"rgba(224,56,56,0.1)",borderRadius:6,padding:"2px 7px"}}>✗ 未作成</span>}
              </td>
              <td style={{padding:"7px 9px",fontFamily:"'DM Mono',monospace",textAlign:"center",fontWeight:700,color:recOk?"var(--tx)":"var(--tx3)"}}>
                {monthRecs.length}日
              </td>
              <td style={{padding:"7px 9px",textAlign:"center"}}>
                {hasLinkedRec
                  ?<span style={{fontSize:10,color:"var(--gr)",fontWeight:700}}>🔗 連携済</span>
                  :<span style={{fontSize:10,color:"var(--tx3)"}}>— 未連携</span>}
              </td>
              <td style={{padding:"7px 9px"}}>
                {lastMon
                  ?<span style={{fontSize:10,color:monDue?"var(--am)":"var(--gr)",fontWeight:700}}>
                    {monDue?"⚠ 期日超過":"✅ "}{lastMon.date}
                  </span>
                  :<span style={{fontSize:10,color:"var(--ro)",fontWeight:700}}>✗ 未実施</span>}
              </td>
              <td style={{padding:"7px 9px"}}>
                {billingOk
                  ?<span style={{fontSize:10,color:"var(--gr)",fontWeight:700}}>✅ {billing.serviceDays}日</span>
                  :<span style={{fontSize:10,color:"var(--tx3)"}}>— 未設定</span>}
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>}
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
// ─── 児童発達支援 請求タブ ───
function JidouBillingTab({user, store, facilityId, vm, setVm}) {
  const master = REWARD_MASTER.jidouhattatsu;
  const yearMonth = vm.y+"-"+String(vm.m).padStart(2,"0");
  const users = store.dynUsers.filter(u=>u.facilityId===facilityId&&u.serviceType==="jidouhattatsu");

  const rows = users.map(u=>{
    const arrivals = store.recs.filter(r=>r.type==="user_in"&&r.userId===u.id&&r.time&&r.time.includes(vm.y+"/"+vm.m));
    const serviceDays = arrivals.length;
    const hasTransport = u.hasTransport;
    const baseUnit = master.timeTypes[0].unitPrice;
    const transportUnit = hasTransport ? master.addons.find(a=>a.id==="transport_both")?.unit||108 : 0;
    const base = serviceDays * baseUnit;
    const transport = serviceDays * transportUnit;
    return {u, serviceDays, base, transport, total: base+transport};
  });
  const grandTotal = rows.reduce((s,r)=>s+r.total,0);

  return <div>
    <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}>
      <div style={{fontSize:13,fontWeight:900,color:"var(--ac)"}}>🌱 児童発達支援 請求</div>
      <select className="fsm" value={vm.y} onChange={e=>setVm(v=>({...v,y:+e.target.value}))}>
        {Array.from({length:4},(_,i)=>2024+i).map(y=><option key={y} value={y}>{y}年</option>)}
      </select>
      <select className="fsm" value={vm.m} onChange={e=>setVm(v=>({...v,m:+e.target.value}))}>
        {Array.from({length:12},(_,i)=>i+1).map(m=><option key={m} value={m}>{m}月</option>)}
      </select>
    </div>
    {/* 報酬マスタ */}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:14,marginBottom:16}}>
      <div style={{fontSize:11,fontWeight:700,color:"var(--ac)",marginBottom:10,letterSpacing:1}}>📋 REWARD MASTER — 児童発達支援</div>
      <table className="reward-table">
        <thead><tr><th>種別</th><th>コード</th><th>単価（単位）</th></tr></thead>
        <tbody>
          {master.timeTypes.map(t=><tr key={t.key}><td>{t.label}</td><td style={{fontFamily:"'DM Mono',monospace"}}>{t.code}</td><td style={{fontWeight:700,color:"var(--ac)"}}>{t.unitPrice.toLocaleString()} 単位</td></tr>)}
        </tbody>
      </table>
      <div style={{fontSize:10,color:"var(--tx3)",marginTop:6}}>主な加算: {master.addons.map(a=>`${a.name}(+${a.unit}単位)`).join(" / ")}</div>
    </div>
    {/* 月次集計 */}
    {users.length===0&&<div style={{textAlign:"center",padding:"24px",color:"var(--tx3)"}}>児童発達支援の利用者がいません（利用者管理でサービス種別を「児発」に設定）</div>}
    {users.length>0&&<>
      <div style={{fontSize:12,fontWeight:900,color:"var(--tx)",marginBottom:10}}>💴 {vm.y}年{vm.m}月 児発 請求サマリー</div>
      <div style={{overflowX:"auto"}}>
        <table className="reward-table">
          <thead><tr><th>利用者</th><th>利用日数</th><th>基本報酬</th><th>送迎加算</th><th>合計（単位）</th></tr></thead>
          <tbody>
            {rows.map(r=><tr key={r.u.id}>
              <td style={{fontWeight:700}}>{r.u.name}</td>
              <td>{r.serviceDays}日</td>
              <td>{r.base.toLocaleString()}</td>
              <td>{r.transport.toLocaleString()}</td>
              <td style={{fontWeight:700,color:"var(--ac)"}}>{r.total.toLocaleString()}</td>
            </tr>)}
            <tr style={{fontWeight:900,background:"var(--bg3)"}}>
              <td>合計</td><td>—</td><td colSpan={2}>—</td>
              <td style={{color:"var(--ac)"}}>{grandTotal.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{fontSize:10,color:"var(--tx3)",marginTop:6}}>※ 地域区分・各加算は含まれません。国保連出力タブで最終確定してください。</div>
    </>}
  </div>;
}

// ─── 報酬マスタ 閲覧タブ ───
function RewardMasterTab({facilityId}) {
  const svcTypes = getFacilityServiceTypes(facilityId);
  return <div>
    <div style={{fontSize:12,color:"var(--tx3)",marginBottom:14,lineHeight:1.7}}>
      報酬単価・加算をここで一元管理します。法改正時は <code style={{background:"var(--bg2)",padding:"1px 5px",borderRadius:4}}>REWARD_MASTER</code> を更新してください（コードへの直書き禁止）。
    </div>
    {svcTypes.map(st=>{
      const m = REWARD_MASTER[st.id];
      if(!m) return null;
      return <div key={st.id} style={{background:"var(--wh)",border:"1.5px solid var(--bd)",borderRadius:12,padding:14,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
          <span className={`svc-badge svc-${st.id}`}>{st.icon} {st.name}</span>
          <span style={{fontSize:10,color:"var(--tx3)"}}>— {m.label}</span>
        </div>
        <div style={{fontSize:11,fontWeight:700,color:"var(--tx2)",marginBottom:6}}>基本報酬</div>
        <table className="reward-table" style={{marginBottom:12}}>
          <thead><tr><th>区分</th><th>サービスコード</th><th>単価（単位）</th></tr></thead>
          <tbody>
            {m.timeTypes.map(t=><tr key={t.key}>
              <td>{t.label}</td>
              <td style={{fontFamily:"'DM Mono',monospace",fontSize:11}}>{t.code}</td>
              <td style={{fontWeight:700,color:st.color}}>{t.unitPrice.toLocaleString()} 単位</td>
            </tr>)}
          </tbody>
        </table>
        <div style={{fontSize:11,fontWeight:700,color:"var(--tx2)",marginBottom:6}}>主な加算</div>
        <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
          {m.addons.map(a=><div key={a.id} style={{padding:"4px 11px",borderRadius:9,fontSize:11,fontWeight:700,background:"var(--bg3)",border:"1px solid var(--bd)",color:"var(--tx2)"}}>
            {a.name} <span style={{color:st.color}}>+{a.unit}単位</span>
          </div>)}
        </div>
      </div>;
    })}
    {/* 放デイも含めて表示 */}
    {!svcTypes.some(s=>s.id==="houkago")&&<div style={{background:"var(--wh)",border:"1.5px solid var(--bd)",borderRadius:12,padding:14,marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><span className="svc-badge svc-houkago">🏫 放課後等デイサービス</span></div>
      <table className="reward-table">
        <thead><tr><th>区分</th><th>コード</th><th>単価</th></tr></thead>
        <tbody>
          {REWARD_MASTER.houkago.timeTypes.map(t=><tr key={t.key}><td>{t.label}</td><td style={{fontFamily:"'DM Mono',monospace",fontSize:11}}>{t.code}</td><td style={{fontWeight:700,color:"#2070a0"}}>{t.unitPrice.toLocaleString()} 単位</td></tr>)}
        </tbody>
      </table>
    </div>}
  </div>;
}

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

// ==================== 保育所等訪問支援 管理画面 ====================
function VisitManagementScreen({user, store, onBack}) {
  const [tab, setTab] = useState("record");  // record | dest | billing | report
  const facilityId = user.selectedFacilityId||"f3";
  const vm = useState(()=>{const d=new Date();return{y:d.getFullYear(),m:d.getMonth()+1};})[0];

  const tabs = [
    {id:"record",  icon:"📝", label:"訪問記録一覧"},
    {id:"dest",    icon:"🏫", label:"訪問先管理"},
    {id:"billing", icon:"💴", label:"請求（訪問）"},
    {id:"report",  icon:"📄", label:"訪問報告書"},
  ];

  return <div className="fl-wrap">
    <div className="fl-hd">
      <button className="bback" onClick={onBack}>← 戻る</button>
      <div className="fl-title">🚌 保育所等訪問支援</div>
    </div>
    {/* 施設確認バナー */}
    <div style={{background:"rgba(44,170,96,0.12)",border:"1.5px solid rgba(44,170,96,0.4)",borderRadius:11,padding:"10px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
      <span style={{fontSize:18}}>🏢</span>
      <div>
        <div style={{fontSize:12,fontWeight:900,color:"var(--gr2)"}}>{FACILITIES.find(f=>f.id===facilityId)?.name}</div>
        <div style={{fontSize:10,color:"var(--tx3)"}}>保育所等訪問支援（GO TOWN 1ST対応）</div>
      </div>
    </div>
    {/* タブナビ */}
    <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:16}}>
      {tabs.map(t=><button key={t.id} onClick={()=>setTab(t.id)}
        style={{padding:"8px 14px",borderRadius:9,border:"2px solid",cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",fontSize:12,fontWeight:700,transition:"all .15s",
          borderColor:tab===t.id?"var(--gr2)":"var(--bd)",
          background:tab===t.id?"rgba(44,170,96,0.2)":"var(--bg)",
          color:tab===t.id?"var(--gr2)":"var(--tx3)"}}>
        {t.icon} {t.label}
      </button>)}
    </div>
    {tab==="record"  && <VisitRecordListTab  user={user} store={store} facilityId={facilityId}/>}
    {tab==="dest"    && <VisitDestTab        user={user} store={store} facilityId={facilityId}/>}
    {tab==="billing" && <VisitBillingTab     user={user} store={store} facilityId={facilityId}/>}
    {tab==="report"  && <VisitReportTab      user={user} store={store} facilityId={facilityId}/>}
  </div>;
}

// ─── 訪問記録一覧 ───
function VisitRecordListTab({user, store, facilityId}) {
  const [filterUser, setFilterUser] = useState("");
  const users = store.dynUsers.filter(u=>u.facilityId===facilityId&&u.serviceType==="hoikuvisit");
  const allVisits = (store.visitRecords||[]).filter(r=>r.facilityId===facilityId).sort((a,b)=>b.date>a.date?1:-1);
  const filtered = filterUser ? allVisits.filter(r=>r.userId===filterUser) : allVisits;
  const destName = (id) => (store.visitDests||[]).find(d=>d.id===id)?.name||id||"—";

  return <div>
    <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}>
      <select className="fsm" value={filterUser} onChange={e=>setFilterUser(e.target.value)}>
        <option value="">全利用者</option>
        {users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
      <div style={{fontSize:12,color:"var(--tx3)",marginLeft:"auto"}}>計 {filtered.length}件</div>
    </div>
    {users.length===0&&<div style={{background:"rgba(44,170,96,0.08)",border:"1.5px solid rgba(44,170,96,0.3)",borderRadius:11,padding:"16px",marginBottom:16}}>
      <div style={{fontSize:13,fontWeight:700,color:"var(--gr2)",marginBottom:6}}>🚌 訪問支援対象利用者がいません</div>
      <div style={{fontSize:12,color:"var(--tx3)"}}>利用者管理 → 利用者編集 → サービス種別を「保育所等訪問支援」に設定すると表示されます。</div>
    </div>}
    {filtered.length===0&&users.length>0&&<div style={{textAlign:"center",padding:"30px 0",color:"var(--tx3)"}}>訪問記録がありません</div>}
    {filtered.map(r=>{
      const u=store.dynUsers.find(x=>x.id===r.userId);
      return <div key={r.id} className="visit-card">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <span style={{fontSize:13,fontWeight:900,color:"var(--tx)"}}>{u?.name||"—"}</span>
            <span style={{fontSize:10,padding:"2px 8px",borderRadius:8,fontWeight:700,background:r.visitType==="初回"?"rgba(58,160,216,0.18)":"rgba(44,170,96,0.18)",color:r.visitType==="初回"?"var(--tl)":"var(--gr2)"}}>{r.visitType}</span>
          </div>
          <div style={{fontSize:10,color:"var(--tx3)"}}>{r.date}{r.duration&&` / ${r.duration}分`}</div>
        </div>
        <div style={{fontSize:11,color:"var(--gr2)",marginBottom:4}}>🏫 {destName(r.destId)}</div>
        <div style={{fontSize:12,color:"var(--tx)",lineHeight:1.5}}>{r.supportContent}</div>
        {r.advice&&<div style={{fontSize:11,color:"var(--tl)",marginTop:5}}>💡 助言: {r.advice}</div>}
        <div style={{fontSize:10,color:"var(--tx3)",marginTop:5}}>{r.staffName}</div>
      </div>;
    })}
  </div>;
}

// ─── 訪問先管理 ───
function VisitDestTab({user, store, facilityId}) {
  const [mode, setMode] = useState("list");
  const [form, setForm] = useState({name:"", type:"保育園", address:"", contactPerson:"", phone:"", note:""});
  const [saved, setSaved] = useState(false);
  const dests = (store.visitDests||[]).filter(d=>d.facilityId===facilityId);

  const handleSave = () => {
    if(!form.name) return;
    store.addVisitDest({...form, id:genId(), facilityId});
    setSaved(true);
    setTimeout(()=>{setSaved(false);setMode("list");setForm({name:"",type:"保育園",address:"",contactPerson:"",phone:"",note:""});},1200);
  };

  if(mode==="new") return <div>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
      <button className="bback" onClick={()=>setMode("list")}>← 戻る</button>
      <div style={{fontSize:14,fontWeight:900}}>🏫 訪問先 登録</div>
    </div>
    {saved&&<div className="succ"><div className="si">✅</div><div className="st">登録しました</div></div>}
    {!saved&&<>
      <div className="fg"><label className="fl">施設名 <span style={{color:"var(--ro)"}}>*</span></label><input className="fi" placeholder="ひかり保育園" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}/></div>
      <div className="fg"><label className="fl">種別</label>
        <select className="fi" value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))}>
          {VISIT_DEST_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="fg"><label className="fl">住所</label><input className="fi" placeholder="静岡市〇〇1-2-3" value={form.address} onChange={e=>setForm(p=>({...p,address:e.target.value}))}/></div>
      <div className="fg"><label className="fl">担当者名</label><input className="fi" placeholder="田中先生" value={form.contactPerson} onChange={e=>setForm(p=>({...p,contactPerson:e.target.value}))}/></div>
      <div className="fg"><label className="fl">電話番号</label><input className="fi" placeholder="054-000-0000" value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))}/></div>
      <div className="fg"><label className="fl">備考</label><textarea className="fta" value={form.note} onChange={e=>setForm(p=>({...p,note:e.target.value}))} style={{minHeight:50}}/></div>
      <button className="bsave" onClick={handleSave} disabled={!form.name}>登録する</button>
    </>}
  </div>;

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <div style={{fontSize:13,fontWeight:900}}>🏫 訪問先一覧 ({dests.length}件)</div>
      <button className="bsave" style={{maxWidth:120,padding:"8px 12px",fontSize:12}} onClick={()=>setMode("new")}>＋ 登録</button>
    </div>
    {dests.length===0&&<div style={{textAlign:"center",padding:"30px 0",color:"var(--tx3)"}}>訪問先が登録されていません</div>}
    {dests.map(d=><div key={d.id} className="visit-dest-card">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <div style={{fontSize:14,fontWeight:900,color:"var(--tx)"}}>{d.name}</div>
          <div style={{fontSize:11,color:"var(--gr2)",marginTop:2}}>{d.type}</div>
        </div>
        <button onClick={()=>store.delVisitDest(d.id)}
          style={{padding:"3px 9px",borderRadius:7,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"rgba(224,56,56,0.08)",border:"1px solid rgba(224,56,56,0.3)",color:"var(--ro)"}}>削除</button>
      </div>
      {d.address&&<div style={{fontSize:11,color:"var(--tx3)",marginTop:5}}>📍 {d.address}</div>}
      {d.contactPerson&&<div style={{fontSize:11,color:"var(--tx3)",marginTop:2}}>👤 {d.contactPerson} {d.phone&&`/ ${d.phone}`}</div>}
      {d.note&&<div style={{fontSize:11,color:"var(--tx3)",marginTop:2}}>{d.note}</div>}
    </div>)}
  </div>;
}

// ─── 訪問支援 請求タブ ───
function VisitBillingTab({user, store, facilityId}) {
  const [vm, setVm] = useState(()=>{const d=new Date();return{y:d.getFullYear(),m:d.getMonth()+1};});
  const master = REWARD_MASTER.hoikuvisit;
  const users = store.dynUsers.filter(u=>u.facilityId===facilityId&&u.serviceType==="hoikuvisit");
  const yearMonth = vm.y+"-"+String(vm.m).padStart(2,"0");

  const rows = users.map(u=>{
    const visits = (store.visitRecords||[]).filter(r=>r.userId===u.id&&r.date&&r.date.startsWith(yearMonth));
    const initial = visits.filter(r=>r.visitType==="初回");
    const subsequent = visits.filter(r=>r.visitType==="2回目以降");
    const initMaster = master.timeTypes.find(t=>t.key==="初回");
    const subMaster = master.timeTypes.find(t=>t.key==="2回目以降");
    const total = (initial.length*(initMaster?.unitPrice||794)) + (subsequent.length*(subMaster?.unitPrice||686));
    return {u, visits, initial, subsequent, total};
  });

  const grandTotal = rows.reduce((s,r)=>s+r.total,0);

  return <div>
    <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}>
      <select className="fsm" value={vm.y} onChange={e=>setVm(v=>({...v,y:+e.target.value}))}>
        {Array.from({length:4},(_,i)=>2024+i).map(y=><option key={y} value={y}>{y}年</option>)}
      </select>
      <select className="fsm" value={vm.m} onChange={e=>setVm(v=>({...v,m:+e.target.value}))}>
        {Array.from({length:12},(_,i)=>i+1).map(m=><option key={m} value={m}>{m}月</option>)}
      </select>
    </div>
    {/* 報酬マスタ表示 */}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:14,marginBottom:16}}>
      <div style={{fontSize:11,fontWeight:700,color:"var(--gr2)",marginBottom:10,letterSpacing:1}}>📋 REWARD MASTER — 保育所等訪問支援</div>
      <table className="reward-table">
        <thead><tr><th>種別</th><th>サービスコード</th><th>単価（単位）</th></tr></thead>
        <tbody>
          {master.timeTypes.map(t=><tr key={t.key}>
            <td>{t.label}</td><td style={{fontFamily:"'DM Mono',monospace"}}>{t.code}</td><td style={{fontWeight:700,color:"var(--gr2)"}}>{t.unitPrice.toLocaleString()} 単位</td>
          </tr>)}
        </tbody>
      </table>
      <div style={{fontSize:10,color:"var(--tx3)"}}>加算: {master.addons.map(a=>a.name).join(" / ")}</div>
    </div>
    {/* 月次集計 */}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:14,marginBottom:14}}>
      <div style={{fontSize:12,fontWeight:900,color:"var(--tx)",marginBottom:10}}>💴 {vm.y}年{vm.m}月 請求サマリー</div>
      {rows.length===0&&<div style={{textAlign:"center",color:"var(--tx3)",padding:"16px 0"}}>訪問支援対象利用者がいません</div>}
      <table className="reward-table">
        <thead><tr><th>利用者</th><th>初回</th><th>2回目以降</th><th>合計（単位）</th></tr></thead>
        <tbody>
          {rows.map(r=><tr key={r.u.id}>
            <td style={{fontWeight:700}}>{r.u.name}</td>
            <td>{r.initial.length}回</td>
            <td>{r.subsequent.length}回</td>
            <td style={{fontWeight:700,color:"var(--gr2)"}}>{r.total.toLocaleString()}</td>
          </tr>)}
          {rows.length>0&&<tr style={{fontWeight:900,background:"var(--bg3)"}}>
            <td>合計</td><td colSpan={2}>{rows.reduce((s,r)=>s+r.visits.length,0)}回</td>
            <td style={{color:"var(--gr2)"}}>{grandTotal.toLocaleString()}</td>
          </tr>}
        </tbody>
      </table>
    </div>
    <div style={{fontSize:10,color:"var(--tx3)"}}>※ 地域区分乗算・加算は含まれません。国保連請求時に反映してください。</div>
  </div>;
}

// ─── 訪問報告書タブ ───
function VisitReportTab({user, store, facilityId}) {
  const [selUserId, setSelUserId] = useState("");
  const users = store.dynUsers.filter(u=>u.facilityId===facilityId&&u.serviceType==="hoikuvisit");
  const selUser2 = users.find(u=>u.id===selUserId);
  const visits = selUserId ? (store.visitRecords||[]).filter(r=>r.userId===selUserId).sort((a,b)=>b.date>a.date?1:-1) : [];
  const destName = (id) => (store.visitDests||[]).find(d=>d.id===id)?.name||id||"—";

  const printReport = () => {
    if(!selUser2||visits.length===0) return;
    const rows = visits.map(r=>`
      <tr>
        <td>${r.date}</td>
        <td>${destName(r.destId)}</td>
        <td>${r.visitType}</td>
        <td>${r.duration||"—"}分</td>
        <td style="font-size:11px;">${r.supportContent||""}</td>
        <td style="font-size:11px;">${r.advice||""}</td>
        <td style="font-size:11px;">${r.schoolFeedback||""}</td>
        <td>${r.staffName||""}</td>
      </tr>`).join("");
    const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><title>訪問報告書</title>
    <style>body{font-family:'Yu Gothic',sans-serif;padding:20px;font-size:12px;}
    h2{font-size:16px;margin-bottom:8px;}
    table{width:100%;border-collapse:collapse;}
    th,td{border:1px solid #aaa;padding:6px;text-align:left;vertical-align:top;}
    th{background:#f0f0f0;font-weight:700;font-size:11px;}
    </style></head><body>
    <div style="text-align:center;margin-bottom:16px;">
      <h2>保育所等訪問支援 訪問報告書</h2>
      <div>${FACILITIES.find(f=>f.id===facilityId)?.name} ／ 対象児：${selUser2.name}（${calcAge(selUser2.dob)}歳）</div>
    </div>
    <table>
      <thead><tr><th>訪問日</th><th>訪問先</th><th>種別</th><th>時間</th><th>支援内容</th><th>助言内容</th><th>施設FB</th><th>担当</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top:20px;font-size:10px;color:#666;">計${visits.length}回訪問</div>
    </body></html>`;
    printHTML(html, `訪問報告書_${selUser2.name}`);
  };

  return <div>
    <div style={{marginBottom:14}}>
      <label className="fl">対象利用者を選択</label>
      <select className="fi" value={selUserId} onChange={e=>setSelUserId(e.target.value)}>
        <option value="">選択してください</option>
        {users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
    </div>
    {selUserId&&visits.length===0&&<div style={{textAlign:"center",padding:"24px",color:"var(--tx3)"}}>訪問記録がありません</div>}
    {selUserId&&visits.length>0&&<>
      <div style={{marginBottom:12}}>
        <div style={{fontSize:13,fontWeight:900,marginBottom:8}}>{selUser2?.name} ─ {visits.length}件の訪問記録</div>
        {visits.slice(0,3).map(r=><div key={r.id} className="visit-report">
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,fontWeight:700,marginBottom:4}}>
            <span>{r.date} / {destName(r.destId)}</span><span style={{color:"var(--gr2)"}}>{r.visitType}</span>
          </div>
          <div style={{fontSize:11,color:"var(--tx2)"}}>{r.supportContent?.slice(0,60)}{r.supportContent?.length>60?"…":""}</div>
        </div>)}
        {visits.length>3&&<div style={{fontSize:11,color:"var(--tx3)",textAlign:"center",marginTop:4}}>他 {visits.length-3} 件</div>}
      </div>
      <button className="bsave" onClick={printReport}>🖨️ 訪問報告書 印刷</button>
    </>}
    {!selUserId&&<div style={{background:"rgba(44,170,96,0.08)",border:"1px solid rgba(44,170,96,0.3)",borderRadius:11,padding:"20px",textAlign:"center",color:"var(--tx3)"}}>
      <div style={{fontSize:28,marginBottom:8}}>📄</div>
      <div style={{fontSize:13}}>利用者を選択すると訪問報告書を印刷できます</div>
    </div>}
  </div>;
}

// ─── メイン KokuhoScreen ───
function KokuhoScreen({user,store,onBack}){
  const [vm,setVm]=useState(()=>{const d=new Date();return{y:d.getFullYear(),m:d.getMonth()+1};});
  const [tab,setTab]=useState("check");
  const [facilityId,setFacilityId]=useState(user.selectedFacilityId||FACILITIES[0].id);
  const isAdmin=user.role==="admin";
  const yearMonth=vm.y+"-"+String(vm.m).padStart(2,"0");

  // 施設で利用可能なサービス種別を取得し、種別別の請求タブを動的生成
  const facilityServiceTypes = getFacilityServiceTypes(facilityId);
  const hasJidou   = facilityServiceTypes.some(s=>s.id==="jidouhattatsu");
  const hasVisit   = facilityServiceTypes.some(s=>s.id==="hoikuvisit");

  const tabs=[
    {id:"check",   icon:"🔍",label:"請求前チェック"},
    {id:"summary", icon:"💴",label:"月次サマリー"},
    ...(hasJidou?[{id:"jidou_billing",icon:"🌱",label:"児発 請求"}]:[]),
    ...(hasVisit?[{id:"visit_billing",icon:"🚌",label:"訪問 請求"}]:[]),
    {id:"output",  icon:"📤",label:"国保連出力"},
    {id:"addons",  icon:"⚙️",label:"加算設定"},
    {id:"staff",   icon:"👥",label:"職員体制"},
    {id:"facility",icon:"🏢",label:"事業所設定"},
    {id:"reward_master",icon:"📊",label:"報酬マスタ"},
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
    {tab==="check"        &&<BillingCheckTab    user={user} store={store} facilityId={facilityId} yearMonth={yearMonth}/>}
    {tab==="summary"      &&<BillingSummaryTab  user={user} store={store} facilityId={facilityId} yearMonth={yearMonth} vm={vm} setVm={setVm}/>}
    {tab==="jidou_billing"&&<JidouBillingTab    user={user} store={store} facilityId={facilityId} vm={vm} setVm={setVm}/>}
    {tab==="visit_billing"&&<VisitBillingTab    user={user} store={store} facilityId={facilityId}/>}
    {tab==="output"       &&<KokuhoOutputTab    user={user} store={store} facilityId={facilityId} yearMonth={yearMonth} vm={vm}/>}
    {tab==="addons"       &&<BillingAddonsTab   user={user} store={store} facilityId={facilityId} yearMonth={yearMonth}/>}
    {tab==="staff"        &&<BillingStaffTab    user={user} store={store} facilityId={facilityId} yearMonth={yearMonth}/>}
    {tab==="facility"     &&<BillingFacilityTab user={user} store={store} facilityId={facilityId}/>}
    {tab==="reward_master"&&<RewardMasterTab    facilityId={facilityId}/>}
    {tab==="master"       &&<BillingMasterTab/>}
  </div>;
}


// ==================== EDIT MODAL ====================
function EditModal({rec,user,store,onClose}){
  const [temp,setTemp]=useState(rec.temp||"");const [note,setNote]=useState(rec.note||"");const [reason,setReason]=useState("");
  const handleDelete=()=>{
    const name=rec.staffName||rec.userName||"この記録";
    if(!window.confirm(`「${name}」の記録を削除しますか？\nこの操作は取り消せません。`)) return;
    store.delRec(rec.id);
    onClose();
  };
  return <div className="ov" onClick={e=>e.target===e.currentTarget&&onClose()}><div className="md">
    <div className="mdtit">📝 記録を修正</div>
    <div className="fg"><label className="fl">対象</label><p style={{color:"var(--g2)",fontSize:12}}>{rec.staffName||rec.userName} — {rec.time}</p></div>
    {rec.temp&&rec.temp!=="-"&&<div className="fg"><label className="fl">体温 (℃)</label><input className="fi" type="number" step="0.1" value={temp} onChange={e=>setTemp(e.target.value)}/></div>}
    <div className="fg"><label className="fl">備考</label><textarea className="fta" value={note} onChange={e=>setNote(e.target.value)} style={{minHeight:52}}/></div>
    <div className="fg"><label className="fl">修正理由 <span style={{color:"var(--ro)"}}>*</span></label><textarea className="fta" placeholder="修正理由を入力してください" value={reason} onChange={e=>setReason(e.target.value)} style={{minHeight:52}}/></div>
    {/* 削除ボタン（記録が誤って登録された場合などに使用） */}
    <div style={{borderTop:"1px solid var(--bd)",marginTop:12,paddingTop:12}}>
      <button onClick={handleDelete} style={{width:"100%",padding:"9px",background:"rgba(224,56,56,0.08)",border:"1px solid rgba(224,56,56,0.3)",borderRadius:8,color:"var(--ro)",fontWeight:700,fontSize:13,cursor:"pointer"}}>🗑️ この記録を削除する</button>
    </div>
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
    // ─── 確定時：実績レコードを自動生成 + ISP連携 ───
    if(status==="確認済"){
      const ISP_ACTIVE=["staff_checked","cdsm_approved","manager_confirmed","parent_explained","parent_consented","finalized"];
      let autoCount=0;
      const monDue=[]; // モニタリング期日アラート対象

      (r.userList||[]).filter(u=>u.status==="出席"||u.status==="早退").forEach(u=>{
        // 重複防止：同日・同利用者の自動生成済みレコードがあればスキップ
        const exists=store.recs.some(rec=>rec.type==="service"&&rec.userId===u.id&&rec.date===r.date&&rec.facilityId===r.facilityId&&rec.autoLinked===true);
        if(!exists){
          // ★ ISPを取得してispIdを紐付け
          const isp=(store.ispRecords||[]).filter(ir=>ir.userId===u.id&&ir.docType==="isp_plan"&&ISP_ACTIVE.includes(ir.status)).sort((a,b)=>b.createdAt>a.createdAt?1:-1)[0];
          store.addRec({
            id:genId(), type:"service", userId:u.id, userName:u.name,
            facilityId:r.facilityId, date:r.date,
            time:r.date+" "+(u.arrivalTime||"00:00"),
            arrival:u.arrivalTime||"", departure:u.departTime||"",
            temp:u.temp||"", transport:u.transport||"",
            items:(r.activities||[]).filter(a=>a.title&&!a.autoFromIsp).map(a=>a.title).slice(0,5),
            // ★ ISP短期目標 + ispId を保存
            ispId:isp?.id||"",
            ispGoal:isp?.content?.shortGoal||"",
            supportNote:isp?`【ISP連携】短期目標：${isp.content?.shortGoal||""}　担当：${isp.content?.staffInCharge||""}`:"",
            createdBy:r.author, autoLinked:true, dailyReportDate:r.date,
          });
          autoCount++;
        }

        // ★ モニタリング期日チェック（6ヶ月以上未実施）
        const d180=new Date();d180.setDate(d180.getDate()-180);
        const lastMon=store.monitorings.filter(m=>m.userId===u.id).sort((a,b)=>b.date>a.date?1:-1)[0];
        const lastMonRec=(store.ispRecords||[]).filter(ir=>ir.userId===u.id&&ir.docType==="monitoring").sort((a,b)=>b.createdAt>a.createdAt?1:-1)[0];
        const lastDate=lastMon?.date||(lastMonRec?.createdAt||"").slice(0,10)||"";
        if(!lastDate||lastDate<d180.toISOString().slice(0,10)) monDue.push(u.name||u.userName||"");
      });

      // ★ 月次請求データを自動同期（日報確定のたびに実績→請求を更新）
      const yearMonth=r.date.slice(0,7);
      store.fullPipelineSync(r.facilityId, yearMonth);

      // トースト通知
      let msg=`日報を確定しました`;
      if(autoCount>0) msg+=`。実績${autoCount}名を自動生成`;
      if(monDue.length>0) msg+=`　⚠ モニタリング期日: ${monDue.slice(0,2).join("、")}${monDue.length>2?`他${monDue.length-2}名`:""}`;
      store.showToast(msg, monDue.length>0?"warn":"success");
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
  const svcType = getUserServiceType(u);
  const rules = svcType.alertRules || [];

  // ─── 共通：受給者証 ───
  if(rules.includes("jukyusha")) {
    const fs = store.facesheets.find(f=>f.userId===u.id);
    const jExpiry = (fs?.jukyushaExpiry) || u.jukyushaExpiry;
    if(jExpiry) {
      const st = expiryStatus(jExpiry);
      if(st && st!=="ok") alerts.push({type:"受給者証",date:jExpiry,status:st,tab:"facesheet"});
    }
  }

  // ─── 共通：個別支援計画 ───
  if(rules.includes("isp")) {
    const latestIsp = store.isps.filter(x=>x.userId===u.id).sort((a,b)=>b.createdAt>a.createdAt?1:-1)[0];
    if(latestIsp && latestIsp.status==="実施中") {
      const end = ispEndDate(latestIsp.period);
      if(end) { const st=expiryStatus(end); if(st&&st!=="ok") alerts.push({type:"個別支援計画",date:end,status:st,tab:"isp"}); }
    } else if(!latestIsp) {
      alerts.push({type:"個別支援計画",date:null,status:"expired",tab:"isp",msg:"未作成"});
    }
  }

  // ─── 共通：アセスメント ───
  if(rules.includes("assessment")) {
    const lastAssessment = store.assessments.filter(a=>a.userId===u.id).sort((a,b)=>b.date>a.date?1:-1)[0];
    if(lastAssessment) {
      const sixM=new Date(lastAssessment.date); sixM.setMonth(sixM.getMonth()+6);
      const st=expiryStatus(sixM.toISOString().slice(0,10));
      if(st&&st!=="ok") alerts.push({type:"アセスメント更新",date:sixM.toISOString().slice(0,10),status:st,tab:"assessment"});
    } else {
      alerts.push({type:"アセスメント",date:null,status:"expired",tab:"assessment",msg:"未実施"});
    }
  }

  // ─── 共通：モニタリング ───
  if(rules.includes("monitoring")) {
    const lastMon = store.monitorings.filter(m=>m.userId===u.id).sort((a,b)=>b.date>a.date?1:-1)[0];
    if(lastMon) {
      const sixM=new Date(lastMon.date); sixM.setMonth(sixM.getMonth()+6);
      const st=expiryStatus(sixM.toISOString().slice(0,10));
      if(st&&st!=="ok") alerts.push({type:"モニタリング更新",date:sixM.toISOString().slice(0,10),status:st,tab:"monitoring"});
    } else {
      alerts.push({type:"モニタリング",date:null,status:"expired",tab:"monitoring",msg:"未実施"});
    }
  }

  // ─── 児発専用：発達段階記録（3ヶ月以上未記録はアラート） ───
  if(rules.includes("dev_record")) {
    const lastDev = (store.devRecords||[]).filter(r=>r.userId===u.id).sort((a,b)=>b.date>a.date?1:-1)[0];
    if(lastDev) {
      const threeM=new Date(lastDev.date); threeM.setMonth(threeM.getMonth()+3);
      const st=expiryStatus(threeM.toISOString().slice(0,10));
      if(st&&st!=="ok") alerts.push({type:"発達段階記録",date:threeM.toISOString().slice(0,10),status:st,tab:"dev_record"});
    } else {
      alerts.push({type:"発達段階記録",date:null,status:"urgent",tab:"dev_record",msg:"未記録（児発必須）"});
    }
  }

  // ─── 児発専用：保護者支援記録（3ヶ月未記録はアラート） ───
  if(rules.includes("parent_support")) {
    const lastPS = (store.parentSupportRecords||[]).filter(r=>r.userId===u.id).sort((a,b)=>b.date>a.date?1:-1)[0];
    if(!lastPS) {
      alerts.push({type:"保護者支援記録",date:null,status:"warn",tab:"parent_support",msg:"未記録"});
    }
  }

  // ─── 保育所等訪問支援専用：訪問記録（当月なければアラート） ───
  if(rules.includes("visit_record")) {
    const thisMonth = new Date().toISOString().slice(0,7);
    const thisMonthVisits = (store.visitRecords||[]).filter(r=>r.userId===u.id&&(r.date||"").startsWith(thisMonth));
    if(thisMonthVisits.length===0) {
      alerts.push({type:"訪問記録",date:null,status:"warn",tab:"visit_record",msg:"当月訪問なし"});
    }
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
  const [bulkMode, setBulkMode] = useState(false); // 一括削除モード
  const [checked, setChecked] = useState([]);       // 選択中のスタッフID
  const isMgr = user.role==="manager"||user.role==="admin";
  const staffList = store.dynStaff.filter(s=>user.role==="admin"||s.facilityId===user.selectedFacilityId);
  const active = staffList.filter(s=>s.active!==false);
  const inactive = staffList.filter(s=>s.active===false);

  // 一括削除実行
  const bulkDelete = () => {
    if(checked.length===0) return;
    if(!window.confirm(`選択した ${checked.length} 名を完全に削除しますか？\nこの操作は取り消せません。`)) return;
    checked.forEach(id => store.delStaff(id));
    setChecked([]);
    setBulkMode(false);
  };
  const toggleCheck = (id) => setChecked(p => p.includes(id) ? p.filter(x=>x!==id) : [...p, id]);
  const checkAll = () => setChecked(active.map(s=>s.id));

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
      loginId:"", loginPassword:"",
      note:"", active:true
    };
    return <RegisterStaff init={init} isEdit={isEdit} user={user} store={store}
      onBack={()=>setScreen("list")}
      onSave={s=>{
        if(isEdit){ store.updStaff2(s.id,s); }
        else {
          // 意味のあるID: S-GH-0001 形式で採番
          const newId = genStaffId(s.facilityId||user.selectedFacilityId, store.dynStaff);
          store.addStaff({...s, id: newId});
        }
        setScreen("list");
      }}
    />;
  }

  // ===== 一覧 =====
  const StaffCard = ({s}) => {
    const fac = FACILITIES.find(f=>f.id===s.facilityId);
    const isChecked = checked.includes(s.id);
    return <div onClick={bulkMode?()=>toggleCheck(s.id):undefined}
      style={{background:bulkMode&&isChecked?"rgba(224,56,56,0.08)":"var(--wh)",border:`1.5px solid ${bulkMode&&isChecked?"var(--ro)":"var(--bd)"}`,borderRadius:12,padding:14,boxShadow:"var(--sh)",transition:"all .15s",opacity:s.active===false?.6:1,cursor:bulkMode?"pointer":"default"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:9}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {/* 一括削除モード時はチェックボックス表示 */}
          {bulkMode&&<input type="checkbox" checked={isChecked} onChange={()=>toggleCheck(s.id)}
            onClick={e=>e.stopPropagation()}
            style={{width:18,height:18,accentColor:"var(--ro)",cursor:"pointer",flexShrink:0}}/>}
          <div style={{width:42,height:42,borderRadius:"50%",background:s.role==="manager"?"linear-gradient(135deg,var(--tl),var(--tl))":"linear-gradient(135deg,var(--gr),var(--tl))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:"#fff",fontWeight:700,flexShrink:0}}>
            {s.name.charAt(0)}
          </div>
          <div>
            <div style={{fontWeight:900,fontSize:14}}>{s.name}{s.active===false&&<span style={{fontSize:10,color:"var(--bda)",marginLeft:5}}>（無効）</span>}</div>
            <div style={{fontSize:11,color:"var(--tx3)",marginTop:1}}>{fac?.name}</div>
          </div>
        </div>
        {!bulkMode&&<div style={{display:"flex",gap:6,alignItems:"center"}}>
          <span style={{fontSize:10,padding:"3px 9px",borderRadius:10,fontWeight:700,background:s.role==="manager"?"rgba(58,160,216,0.2)":s.role==="admin"?"rgba(144,72,216,0.18)":"rgba(44,170,96,0.2)",color:s.role==="manager"?"var(--tl)":s.role==="admin"?"var(--pu)":"var(--gr)"}}>
            {s.role==="manager"?"施設管理者":s.role==="admin"?"本部管理者":"一般職員"}
          </span>
          <button onClick={()=>{setSelStaff(s);setScreen("detail");}} style={{padding:"4px 9px",borderRadius:7,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"rgba(58,160,216,0.1)",border:"1.5px solid rgba(58,160,216,0.35)",color:"var(--tl)"}}>詳細</button>
          {isMgr&&<button onClick={()=>{setSelStaff(s);setScreen("edit");}} style={{padding:"4px 9px",borderRadius:7,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"var(--bg)",border:"1.5px solid var(--bd)",color:"var(--tx3)"}}>編集</button>}
        </div>}
        {bulkMode&&<span style={{fontSize:10,padding:"3px 9px",borderRadius:10,fontWeight:700,background:s.role==="manager"?"rgba(58,160,216,0.2)":s.role==="admin"?"rgba(144,72,216,0.18)":"rgba(44,170,96,0.2)",color:s.role==="manager"?"var(--tl)":s.role==="admin"?"var(--pu)":"var(--gr)"}}>
          {s.role==="manager"?"施設管理者":s.role==="admin"?"本部管理者":"一般職員"}
        </span>}
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

    {/* ボタンエリア */}
    {isMgr&&!bulkMode&&<div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
      <button className="bsave" style={{maxWidth:200}} onClick={()=>setScreen("register")}>＋ 新規スタッフ登録</button>
      <button onClick={()=>{setBulkMode(true);setChecked([]);}}
        style={{padding:"9px 16px",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"rgba(224,56,56,0.1)",border:"1.5px solid rgba(224,56,56,0.4)",color:"var(--ro)"}}>
        🗑️ まとめて削除
      </button>
    </div>}

    {/* 一括削除モード バー */}
    {bulkMode&&<div style={{background:"rgba(224,56,56,0.08)",border:"1.5px solid rgba(224,56,56,0.4)",borderRadius:11,padding:"12px 14px",marginBottom:14,display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
      <span style={{fontSize:13,fontWeight:700,color:"var(--ro)"}}>🗑️ 削除モード</span>
      <span style={{fontSize:12,color:"var(--tx3)"}}>{checked.length}名選択中</span>
      <button onClick={checkAll} style={{padding:"6px 12px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"var(--bg)",border:"1.5px solid var(--bd)",color:"var(--tx2)"}}>全選択</button>
      <button onClick={()=>setChecked([])} style={{padding:"6px 12px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"var(--bg)",border:"1.5px solid var(--bd)",color:"var(--tx2)"}}>選択解除</button>
      <button onClick={bulkDelete} disabled={checked.length===0}
        style={{padding:"6px 16px",borderRadius:8,fontSize:12,fontWeight:700,cursor:checked.length===0?"not-allowed":"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:checked.length===0?"var(--bg)":"var(--ro)",border:"none",color:checked.length===0?"var(--tx3)":"#fff",opacity:checked.length===0?.5:1}}>
        {checked.length}名を削除
      </button>
      <button onClick={()=>{setBulkMode(false);setChecked([]);}}
        style={{padding:"6px 12px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"var(--bg)",border:"1.5px solid var(--bd)",color:"var(--tx3)",marginLeft:"auto"}}>
        キャンセル
      </button>
    </div>}

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
    // ログインIDの重複チェック（新規登録時のみ）
    if(!isEdit && form.loginId?.trim()){
      const taken = ACCOUNTS.some(a=>a.username===form.loginId)
        || (store.dynStaff||[]).some(s=>s.id!==form.id && s.loginId===form.loginId);
      if(taken) e.loginId = "このログインIDは既に使われています";
    }
    if(!isEdit && form.loginId?.trim() && !form.loginPassword?.trim()) e.loginPassword = "パスワードを入力してください";
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

    {/* ===== ログイン情報 ===== */}
    <FormSection title="■ ログイン情報" color="var(--pu)">
      <div style={{background:"rgba(144,72,216,0.07)",border:"1px solid rgba(144,72,216,0.25)",borderRadius:9,padding:"10px 12px",marginBottom:10,fontSize:12,color:"var(--tx3)"}}>
        🔑 ここで設定したIDとパスワードでアプリにログインできます。<br/>空欄のままにするとログイン不可となります。
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
        <FormField form={form} upd={upd} errors={errors} label="ログインID" fkey="loginId" placeholder="例）tanaka-miho"/>
        <FormField form={form} upd={upd} errors={errors} label="パスワード" fkey="loginPassword" placeholder="例）pass1234"/>
      </div>
      {isEdit&&<div style={{fontSize:11,color:"var(--tx3)",marginTop:4}}>※ パスワードを変更しない場合は空欄のままにしてください</div>}
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

// ── アラートセクション ヘルパーコンポーネント ──
function AlertSection({icon,title,color,count,children}){
  const [open,setOpen]=useState(true);
  return <div style={{marginBottom:14,background:"var(--wh)",border:`2px solid ${count>0?color:"var(--bd)"}`,borderRadius:12,overflow:"hidden"}}>
    <div onClick={()=>setOpen(o=>!o)} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",cursor:"pointer",background:count>0?`${color}18`:"var(--bg2)",userSelect:"none"}}>
      <span style={{fontSize:18}}>{icon}</span>
      <span style={{fontWeight:700,fontSize:13,flex:1,color:count>0?color:"var(--tx2)"}}>{title}</span>
      {count>0
        ?<span style={{background:color,color:"#fff",borderRadius:14,padding:"1px 10px",fontSize:12,fontWeight:700}}>{count}件</span>
        :<span style={{background:"var(--gr)",color:"#fff",borderRadius:14,padding:"1px 10px",fontSize:11,fontWeight:700}}>✅ 問題なし</span>
      }
      <span style={{fontSize:11,color:"var(--tx3)",marginLeft:4}}>{open?"▲":"▼"}</span>
    </div>
    {open&&<div style={{padding:"10px 14px"}}>{children}</div>}
  </div>;
}

// ==================== 監査モード ====================
function AuditScreen({user,onBack,store}){
  const today=todayISO();
  const [tab,setTab]=useState("daily");
  const [dateFrom,setDateFrom]=useState(today);
  const [dateTo,setDateTo]=useState(today);
  const [expandUser,setExpandUser]=useState(null);
  const [vm,setVm]=useState(()=>{const d=new Date();return{y:d.getFullYear(),m:d.getMonth()+1};});

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

  // ===== 月次帳票: 月次サービス提供記録表 =====
  const printMonthlyServiceTable=()=>{
    const facName=fac?.name||"";
    const yearMonth=vm.y+"-"+String(vm.m).padStart(2,"0");
    const inMonth=r=>(r.time||"").slice(0,7)===yearMonth&&myFac(r);
    const monthRecs=store.recs.filter(inMonth);
    const daysInM=new Date(vm.y,vm.m,0).getDate();
    const dayHeaders=Array.from({length:daysInM},(_,i)=>`<th style="min-width:18px;font-size:7pt;">${i+1}</th>`).join("");
    const dow=["日","月","火","水","木","金","土"];
    const dowHeaders=Array.from({length:daysInM},(_,i)=>{
      const d=new Date(vm.y,vm.m-1,i+1).getDay();
      const col=d===0?"#c0392b":d===6?"#1a4a8a":"#333";
      return `<th style="min-width:18px;font-size:7pt;color:${col};">${dow[d]}</th>`;
    }).join("");
    const userRows=myUsers.map(u=>{
      const arrivals=monthRecs.filter(r=>r.type==="user_in"&&r.userId===u.id);
      const services=monthRecs.filter(r=>r.type==="service"&&r.userId===u.id);
      const arrivedDates=new Set(arrivals.map(r=>(r.time||"").slice(8,10).replace(/^0/,"")));
      const svcDates=new Set(services.map(r=>(r.time||"").slice(8,10).replace(/^0/,"")));
      const tempMap={};arrivals.forEach(r=>{const d=(r.time||"").slice(8,10).replace(/^0/,"");tempMap[d]=r.temp||"";});
      const cells=Array.from({length:daysInM},(_,i)=>{
        const d=String(i+1);
        const arr=arrivedDates.has(d);const svc=svcDates.has(d);const tmp=tempMap[d]||"";
        const bg=arr?(svc?"#e6f5ec":"#fdf0ee"):"";
        const content=arr?`<div style="font-size:7pt;color:${svc?"#155a30":"#c0392b"};font-weight:700;">${svc?"○":"△"}</div>${tmp?`<div style="font-size:6pt;color:#444;">${tmp}℃</div>`:""}`:""
        return `<td style="background:${bg};padding:1px;text-align:center;vertical-align:top;height:28px;">${content}</td>`;
      }).join("");
      const totalDays=arrivedDates.size;const svcTotal=svcDates.size;
      return `<tr>
        <td style="text-align:left;padding:3px 5px;font-weight:700;font-size:9pt;white-space:nowrap;border-right:2px solid #bbb;">${u.name}</td>
        <td style="font-size:7pt;padding:1px 4px;color:#555;border-right:1px solid #ccc;">${(u.data||u).jukyushaNo||"—"}</td>
        ${cells}
        <td style="font-weight:700;text-align:center;color:#1a4a8a;border-left:2px solid #bbb;">${totalDays}</td>
        <td style="font-weight:700;text-align:center;color:${svcTotal<totalDays?"#c0392b":"#1a7a3a"};">${svcTotal}</td>
      </tr>`;
    }).join("");
    const html=`<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"/>
    <title>月次サービス提供記録表 ${vm.y}年${vm.m}月</title>
    <style>
      @page{size:A3 landscape;margin:8mm 6mm;}
      *{box-sizing:border-box;} body{font-family:'MS Gothic',Meiryo,sans-serif;font-size:9pt;color:#111;}
      h2{font-size:13pt;margin-bottom:3px;} .meta{font-size:8pt;color:#555;margin-bottom:8px;}
      table{border-collapse:collapse;width:100%;}
      th,td{border:1px solid #ccc;padding:1px 2px;text-align:center;}
      th{background:#dce8f8;font-weight:700;}
      .sign-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:12px;}
      .sign-box{border:1px solid #aaa;padding:6px;min-height:40px;border-radius:3px;}
      .sign-lbl{font-size:7pt;color:#666;}
      .legend{display:flex;gap:10px;margin-bottom:6px;font-size:8pt;}
      .leg{display:flex;align-items:center;gap:3px;}
    </style></head><body>
    <h2>📋 月次サービス提供記録表</h2>
    <div class="meta">事業所: ${facName}　対象: ${vm.y}年${vm.m}月　出力日: ${new Date().toLocaleDateString("ja-JP")}</div>
    <div class="legend">
      <div class="leg"><div style="width:14px;height:14px;background:#e6f5ec;border:1px solid #90c090;"></div>○ 来所+記録完備</div>
      <div class="leg"><div style="width:14px;height:14px;background:#fdf0ee;border:1px solid #e09090;"></div>△ 来所のみ（記録不足）</div>
      <div style="font-size:7pt;color:#888;">数字は体温(℃)</div>
    </div>
    <table>
      <thead>
        <tr><th rowspan="2" style="min-width:70px;text-align:left;padding:3px 5px;">利用者名</th>
        <th rowspan="2" style="min-width:80px;">受給者証番号</th>
        ${dayHeaders}
        <th rowspan="2" style="min-width:24px;">来所<br/>日数</th>
        <th rowspan="2" style="min-width:24px;">記録<br/>日数</th></tr>
        <tr>${dowHeaders}</tr>
      </thead>
      <tbody>${userRows}</tbody>
    </table>
    <div class="sign-row">
      <div class="sign-box"><div class="sign-lbl">管理者 確認印</div></div>
      <div class="sign-box"><div class="sign-lbl">児発管 確認印</div></div>
      <div class="sign-box"><div class="sign-lbl">担当職員</div></div>
      <div class="sign-box"><div class="sign-lbl">確認日: ${new Date().toLocaleDateString("ja-JP")}</div></div>
    </div></body></html>`;
    const w=window.open("","_blank","width=1300,height=800");
    if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),400);}
  };

  // ===== 月次帳票: 利用者別支援記録台帳 =====
  const printUserLedger=(userId)=>{
    const u=myUsers.find(x=>x.id===userId);
    if(!u) return;
    const yearMonth=vm.y+"-"+String(vm.m).padStart(2,"0");
    const inMonth=r=>(r.time||"").slice(0,7)===yearMonth&&r.userId===userId;
    const svcRecs=store.recs.filter(r=>inMonth(r)&&r.type==="service").sort((a,b)=>a.time>b.time?1:-1);
    const arrRecs=store.recs.filter(r=>inMonth(r)&&r.type==="user_in").sort((a,b)=>a.time>b.time?1:-1);
    const ud=u.data||u;
    // 有効ISP
    const activeIsp=(store.isps||[]).filter(x=>x.userId===userId).sort((a,b)=>b.createdAt>a.createdAt?1:-1)[0];
    const ispRecAct=(store.ispRecords||[]).filter(r=>r.userId===userId&&r.docType==="isp_plan"&&["finalized","parent_consented","manager_confirmed"].includes(r.status)).sort((a,b)=>b.createdAt>a.createdAt?1:-1)[0];
    const ispGoal=ispRecAct?.content?.shortGoal||activeIsp?.shortGoal||"—";
    const ispDomains=ispRecAct?.content?.domains?.join("・")||activeIsp?.goals?.map(g=>g.domain||"").join("・")||"—";
    const recRows=svcRecs.map(s=>{
      const arrOnDate=arrRecs.find(r=>r.time?.slice(0,10)===s.time?.slice(0,10));
      return `<tr style="page-break-inside:avoid;">
        <td style="padding:5px 7px;white-space:nowrap;font-weight:700;">${(s.time||"").slice(0,16)}</td>
        <td style="padding:5px 7px;white-space:nowrap;">${s.arrival||arrOnDate?.time?.slice(11,16)||"—"} 〜 ${s.departure||"—"}</td>
        <td style="padding:5px 7px;text-align:center;">${arrOnDate?.temp||"—"}</td>
        <td style="padding:5px 7px;text-align:center;">${arrOnDate?.transport||"—"}</td>
        <td style="padding:5px 7px;font-size:9pt;">${(s.items||[]).join("・")||"—"}</td>
        <td style="padding:5px 7px;font-size:9pt;">${s.supportNote||s.note||"—"}</td>
        <td style="padding:5px 7px;text-align:center;font-size:9pt;">${s.staffName||s.createdBy||"—"}</td>
      </tr>`;
    }).join("");
    const html=`<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"/>
    <title>支援記録台帳 ${u.name}</title>
    <style>
      @page{size:A4 portrait;margin:15mm 12mm;}
      *{box-sizing:border-box;} body{font-family:'MS Gothic',Meiryo,sans-serif;font-size:10pt;color:#111;}
      h2{font-size:14pt;border-bottom:2px solid #1a3a6a;padding-bottom:5px;margin-bottom:10px;}
      .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:12px;}
      .info-item{border:1px solid #ccc;padding:5px 8px;border-radius:3px;}
      .info-lbl{font-size:7pt;color:#666;margin-bottom:1px;}
      .info-val{font-size:10pt;font-weight:700;}
      table{border-collapse:collapse;width:100%;font-size:9pt;margin-top:8px;}
      th,td{border:1px solid #ccc;padding:4px 6px;}
      th{background:#dce8f8;font-weight:700;text-align:center;}
      .isp-box{background:#e8f5ec;border:1px solid #90c090;border-radius:4px;padding:8px;margin-bottom:10px;font-size:9pt;}
      .sign-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px;}
      .sign-box{border:1px solid #aaa;padding:8px;min-height:48px;border-radius:3px;}
      .sign-lbl{font-size:8pt;color:#666;}
    </style></head><body>
    <h2>📋 個別支援記録台帳</h2>
    <div class="info-grid">
      <div class="info-item"><div class="info-lbl">氏名</div><div class="info-val">${u.name}</div></div>
      <div class="info-item"><div class="info-lbl">受給者証番号</div><div class="info-val">${ud.jukyushaNo||"（未入力）"}</div></div>
      <div class="info-item"><div class="info-lbl">対象年月</div><div class="info-val">${vm.y}年${vm.m}月</div></div>
      <div class="info-item"><div class="info-lbl">事業所名</div><div class="info-val">${fac?.name||""}</div></div>
    </div>
    <div class="isp-box">
      <div style="font-weight:700;margin-bottom:3px;">📋 適用中の個別支援計画</div>
      <div>短期目標: ${ispGoal}</div>
      <div style="font-size:8pt;color:#444;margin-top:2px;">支援領域: ${ispDomains}</div>
    </div>
    <table>
      <thead><tr>
        <th>日時</th><th>在所時間</th><th>体温</th><th>送迎</th>
        <th>支援内容・活動</th><th>支援の記録・様子</th><th>担当者</th>
      </tr></thead>
      <tbody>${recRows||`<tr><td colspan="7" style="text-align:center;color:#999;padding:12px;">この月の記録なし</td></tr>`}</tbody>
    </table>
    <div class="sign-row">
      <div class="sign-box"><div class="sign-lbl">担当職員 確認サイン</div></div>
      <div class="sign-box"><div class="sign-lbl">管理者 確認サイン　　確認日: ${new Date().toLocaleDateString("ja-JP")}</div></div>
    </div>
    </body></html>`;
    const w=window.open("","_blank","width=900,height=750");
    if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),400);}
  };

  // ===== 月次帳票: ISP整合確認表 =====
  const printIspCompliance=()=>{
    const yearMonth=vm.y+"-"+String(vm.m).padStart(2,"0");
    const facName=fac?.name||"";
    const inMonth=r=>(r.time||"").slice(0,7)===yearMonth&&myFac(r);
    const monthSvcRecs=store.recs.filter(r=>inMonth(r)&&r.type==="service");
    const userRows=myUsers.map(u=>{
      const ud=u.data||u;
      const urecs=monthSvcRecs.filter(r=>r.userId===u.id);
      const activeIsp=(store.isps||[]).filter(x=>x.userId===u.id).sort((a,b)=>b.createdAt>a.createdAt?1:-1)[0];
      const ispRec=(store.ispRecords||[]).filter(r=>r.userId===u.id&&r.docType==="isp_plan").sort((a,b)=>b.createdAt>a.createdAt?1:-1)[0];
      const ispGoal=ispRec?.content?.shortGoal||activeIsp?.shortGoal||"—";
      const ispStatus=ispRec?.status||"—";
      const ispColor={"finalized":"#155a30","parent_consented":"#1a4a8a","manager_confirmed":"#7a5000"}[ispStatus]||"#c0392b";
      const ispStatusLabel={"finalized":"確定済","parent_consented":"保護者同意済","manager_confirmed":"管理者確認済","cdsm_approved":"児発管承認","staff_checked":"職員確認","ai_draft":"下書き","—":"未作成"}[ispStatus]||ispStatus;
      const recCount=urecs.length;
      // ISP連携率（ispId or shortGoalへの言及を含む記録）
      const linked=urecs.filter(r=>r.ispId||(r.supportNote||"").includes(ispGoal.slice(0,10))).length;
      const linkRate=recCount>0?Math.round(linked/recCount*100):0;
      const statusColor=linkRate>=80?"#155a30":linkRate>=50?"#7a5000":"#c0392b";
      return `<tr>
        <td style="padding:5px 7px;font-weight:700;">${u.name}</td>
        <td style="padding:5px 7px;font-size:8pt;">${ud.jukyushaNo||"—"}</td>
        <td style="padding:5px 7px;font-size:9pt;">${ispGoal.slice(0,40)}${ispGoal.length>40?"…":""}</td>
        <td style="padding:5px 7px;text-align:center;color:${ispColor};font-weight:700;">${ispStatusLabel}</td>
        <td style="padding:5px 7px;text-align:center;">${recCount}</td>
        <td style="padding:5px 7px;text-align:center;">${linked}</td>
        <td style="padding:5px 7px;text-align:center;font-weight:700;color:${statusColor};">${linkRate}%</td>
        <td style="padding:5px 7px;text-align:center;">${ispRec?.content?.supportPeriod||activeIsp?.period||"—"}</td>
      </tr>`;
    }).join("");
    const html=`<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"/>
    <title>ISP整合確認表 ${vm.y}年${vm.m}月</title>
    <style>
      @page{size:A4 landscape;margin:12mm 10mm;}
      *{box-sizing:border-box;} body{font-family:'MS Gothic',Meiryo,sans-serif;font-size:9pt;color:#111;}
      h2{font-size:13pt;margin-bottom:4px;} .meta{font-size:8pt;color:#555;margin-bottom:8px;}
      table{border-collapse:collapse;width:100%;font-size:9pt;}
      th,td{border:1px solid #ccc;padding:5px 7px;}
      th{background:#dce8f8;font-weight:700;text-align:center;}
      .sign-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:14px;}
      .sign-box{border:1px solid #aaa;padding:8px;min-height:44px;border-radius:3px;}
      .sign-lbl{font-size:8pt;color:#666;}
    </style></head><body>
    <h2>📊 個別支援計画 整合確認表</h2>
    <div class="meta">事業所: ${facName}　対象: ${vm.y}年${vm.m}月　出力日: ${new Date().toLocaleDateString("ja-JP")}</div>
    <div style="font-size:8pt;color:#666;margin-bottom:8px;">※ ISP連携率 = サービス記録のうちISP目標に言及した記録の割合（80%以上推奨）</div>
    <table>
      <thead><tr>
        <th>利用者名</th><th>受給者証番号</th><th>ISP短期目標</th>
        <th>ISPステータス</th><th>記録件数</th><th>ISP連携件数</th><th>ISP連携率</th><th>支援期間</th>
      </tr></thead>
      <tbody>${userRows}</tbody>
    </table>
    <div class="sign-row">
      <div class="sign-box"><div class="sign-lbl">管理者 確認印</div></div>
      <div class="sign-box"><div class="sign-lbl">児発管 確認印</div></div>
      <div class="sign-box"><div class="sign-lbl">確認日: ${new Date().toLocaleDateString("ja-JP")}</div></div>
    </div></body></html>`;
    const w=window.open("","_blank","width=1200,height=800");
    if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),400);}
  };

  // ===== 月次帳票: 欠落チェックレポート =====
  const printGapReport=()=>{
    const yearMonth=vm.y+"-"+String(vm.m).padStart(2,"0");
    const facName=fac?.name||"";
    const inMonth=r=>(r.time||"").slice(0,7)===yearMonth&&myFac(r);
    const monthRecs=store.recs.filter(inMonth);
    const reportRows=myUsers.map(u=>{
      const arr=monthRecs.filter(r=>r.type==="user_in"&&r.userId===u.id);
      const svc=monthRecs.filter(r=>r.type==="service"&&r.userId===u.id);
      const dep=monthRecs.filter(r=>r.type==="user_out"&&r.userId===u.id);
      const arrDates=[...new Set(arr.map(r=>r.time?.slice(0,10)))].filter(Boolean);
      const svcDates=[...new Set(svc.map(r=>r.time?.slice(0,10)))].filter(Boolean);
      const depDates=[...new Set(dep.map(r=>r.time?.slice(0,10)))].filter(Boolean);
      const noTemp=arr.filter(r=>!r.temp||r.temp==="").length;
      const noSvc=arrDates.filter(d=>!svcDates.includes(d));
      const noDep=arrDates.filter(d=>!depDates.includes(d));
      const isp=(store.isps||[]).filter(x=>x.userId===u.id).sort((a,b)=>b.endDate>a.endDate?1:-1)[0];
      const fs=store.facesheets.find(f=>f.userId===u.id);
      const issues=[];
      if(noTemp>0) issues.push(`体温未入力 ${noTemp}件`);
      if(noSvc.length>0) issues.push(`サービス記録なし ${noSvc.length}日 (${noSvc.join(",").slice(0,20)})`);
      if(noDep.length>0) issues.push(`退所記録なし ${noDep.length}日`);
      if(!isp) issues.push("ISP未作成");
      else if(isp.endDate<yearMonth+"-01") issues.push(`ISP期限切れ(${isp.endDate})`);
      if(!fs) issues.push("フェイスシート未作成");
      const level=issues.length===0?"ok":issues.some(i=>i.includes("サービス記録")||i.includes("ISP"))?"ng":"warn";
      const bg=level==="ok"?"#e6f5ec":level==="ng"?"#fdf0ee":"#fffaec";
      return `<tr style="background:${bg};">
        <td style="padding:5px 7px;font-weight:700;">${level==="ok"?"✅":level==="ng"?"🚨":"⚠️"} ${u.name}</td>
        <td style="padding:5px 7px;text-align:center;">${arrDates.length}</td>
        <td style="padding:5px 7px;text-align:center;color:${noTemp>0?"#c0392b":"#1a7a3a"};font-weight:700;">${noTemp>0?"✗ "+noTemp+"件":"✓"}</td>
        <td style="padding:5px 7px;text-align:center;color:${noSvc.length>0?"#c0392b":"#1a7a3a"};font-weight:700;">${noSvc.length>0?"✗ "+noSvc.length+"日":"✓"}</td>
        <td style="padding:5px 7px;text-align:center;color:${noDep.length>0?"#e08020":"#1a7a3a"};">${noDep.length>0?"△ "+noDep.length+"日":"✓"}</td>
        <td style="padding:5px 7px;text-align:center;color:${!isp||isp.endDate<yearMonth+"-01"?"#c0392b":"#1a7a3a"};font-weight:700;">${!isp?"✗ 未作成":isp.endDate<yearMonth+"-01"?"✗ 期限切れ":"✓ 有効"}</td>
        <td style="padding:5px 7px;text-align:center;color:${!fs?"#e08020":"#1a7a3a"};">${!fs?"△ 未作成":"✓"}</td>
        <td style="padding:5px 7px;font-size:8pt;color:#444;">${issues.join(" / ")||"—"}</td>
      </tr>`;
    }).join("");
    const ngCount=myUsers.filter(u=>{
      const arr=monthRecs.filter(r=>r.type==="user_in"&&r.userId===u.id);
      const svc=monthRecs.filter(r=>r.type==="service"&&r.userId===u.id);
      return arr.length>0&&svc.length===0;
    }).length;
    const html=`<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"/>
    <title>欠落チェックレポート ${vm.y}年${vm.m}月</title>
    <style>
      @page{size:A4 landscape;margin:12mm 10mm;}
      *{box-sizing:border-box;} body{font-family:'MS Gothic',Meiryo,sans-serif;font-size:9pt;color:#111;}
      h2{font-size:13pt;margin-bottom:4px;} .meta{font-size:8pt;color:#555;margin-bottom:8px;}
      table{border-collapse:collapse;width:100%;font-size:9pt;}
      th,td{border:1px solid #ccc;padding:4px 7px;}
      th{background:#dce8f8;font-weight:700;text-align:center;}
      .sign-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:14px;}
      .sign-box{border:1px solid #aaa;padding:8px;min-height:44px;border-radius:3px;}
      .sign-lbl{font-size:8pt;color:#666;}
    </style></head><body>
    <h2>🔍 監査対応 欠落チェックレポート</h2>
    <div class="meta">事業所: ${facName}　対象: ${vm.y}年${vm.m}月　出力日: ${new Date().toLocaleDateString("ja-JP")}</div>
    ${ngCount>0?`<div style="background:#fdf0ee;border:1px solid #e09090;padding:6px 10px;border-radius:4px;margin-bottom:8px;font-size:9pt;color:#8a2010;font-weight:700;">🚨 サービス記録が不足している利用者が ${ngCount}名 います。提出前に確認してください。</div>`:""}
    <table>
      <thead><tr>
        <th>利用者名</th><th>来所日数</th><th>体温入力</th><th>サービス記録</th><th>退所記録</th><th>ISP</th><th>フェイスシート</th><th>課題内容</th>
      </tr></thead>
      <tbody>${reportRows}</tbody>
    </table>
    <div class="sign-row">
      <div class="sign-box"><div class="sign-lbl">管理者 確認印</div></div>
      <div class="sign-box"><div class="sign-lbl">児発管 確認印</div></div>
      <div class="sign-box"><div class="sign-lbl">確認日: ${new Date().toLocaleDateString("ja-JP")}</div></div>
    </div></body></html>`;
    const w=window.open("","_blank","width=1200,height=800");
    if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),400);}
  };

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

  // 書類一覧: 利用者別の帳票完備状況
  const docStatusRows=myUsers.map(u=>{
    const ud=u.data||u;
    const fs=store.facesheets.find(f=>f.userId===u.id);
    const asses=(store.assessments||[]).filter(a=>a.userId===u.id);
    const isps=(store.isps||[]).filter(x=>x.userId===u.id);
    const ispRecs=(store.ispRecords||[]).filter(r=>r.userId===u.id&&r.docType==="isp_plan");
    const mons=(store.monitorings||[]).filter(m=>m.userId===u.id);
    const latestIsp=isps.sort((a,b)=>b.createdAt>a.createdAt?1:-1)[0];
    const latestIspRec=ispRecs.sort((a,b)=>b.createdAt>a.createdAt?1:-1)[0];
    const ispOk=latestIsp||latestIspRec;
    const ispExpired=latestIsp&&latestIsp.endDate&&latestIsp.endDate<todayISO();
    const jukyushaOk=ud.jukyushaNo||false;
    const score=[!!fs,!!asses.length,ispOk&&!ispExpired,!!mons.length,jukyushaOk].filter(Boolean).length;
    return {u,ud,fs,asses,latestIsp,latestIspRec,mons,score,jukyushaOk,ispExpired};
  });

  // ── アラート計算（vmで選択中の年月をベースに算出）──
  const alertYM=vm.y+"-"+String(vm.m).padStart(2,"0");
  const alertMonthRecs=store.recs.filter(r=>myFac(r)&&(r.time||"").slice(0,7)===alertYM);

  // 1. 未記録アラート（来所日にサービス記録なし）
  const noSvcAlerts=[];
  myUsers.forEach(u=>{
    const arrDates=[...new Set(alertMonthRecs.filter(r=>r.type==="user_in"&&r.userId===u.id).map(r=>r.time?.slice(0,10)))].filter(Boolean);
    const svcDates=new Set(alertMonthRecs.filter(r=>r.type==="service"&&r.userId===u.id).map(r=>r.time?.slice(0,10)));
    arrDates.forEach(d=>{if(!svcDates.has(d))noSvcAlerts.push({userId:u.id,userName:u.name,date:d});});
  });

  // 2. 署名漏れ（ISP承認フロー停滞 / 同意書署名未取得）
  const signAlerts=[];
  const ISP_NEED_SIGN_STATES=["staff_checked","cdsm_approved","manager_confirmed","parent_explained"];
  const ISP_SIGN_LABELS={"staff_checked":"職員確認待ち","cdsm_approved":"児発管承認待ち","manager_confirmed":"保護者説明待ち","parent_explained":"保護者同意待ち"};
  (store.ispRecords||[]).filter(r=>myFac(r)&&r.docType==="isp_plan"&&ISP_NEED_SIGN_STATES.includes(r.status)).forEach(r=>{
    const u=myUsers.find(x=>x.id===r.userId);if(!u)return;
    signAlerts.push({userId:u.id,userName:u.name,doc:"個別支援計画",status:ISP_SIGN_LABELS[r.status]||r.status,date:(r.updatedAt||r.createdAt||"").slice(0,10)});
  });
  (store.ispRecords||[]).filter(r=>myFac(r)&&r.docType==="consent"&&!r.content?.parentSignedAt).forEach(r=>{
    const u=myUsers.find(x=>x.id===r.userId);if(!u)return;
    signAlerts.push({userId:u.id,userName:u.name,doc:"同意書",status:"保護者署名未取得"+(r.content?.checkedTypes?.includes("isp")?" (ISP同意含む)":""),date:(r.createdAt||"").slice(0,10)});
  });

  // 3. 支援時間不足（2時間未満 or 退所時刻未入力）
  const shortAlerts=[];
  alertMonthRecs.filter(r=>r.type==="service").forEach(r=>{
    const u=myUsers.find(x=>x.id===r.userId);if(!u)return;
    if(r.arrival&&r.departure){
      const toMin=t=>{const[h,m]=t.split(":").map(Number);return h*60+(m||0);};
      const mins=toMin(r.departure)-toMin(r.arrival);
      if(mins>0&&mins<120)shortAlerts.push({userId:u.id,userName:u.name,date:r.time?.slice(0,10)||"",arrival:r.arrival,departure:r.departure,mins,type:"short"});
    }else if(r.arrival&&!r.departure){
      shortAlerts.push({userId:u.id,userName:u.name,date:r.time?.slice(0,10)||"",arrival:r.arrival,departure:null,mins:null,type:"nodep"});
    }
  });

  // 4. 加算漏れ（送迎加算・個別サポート加算の請求設定確認）
  const addonAlerts=[];
  const facKokuho=(store.kokuho||[]).filter(k=>k.facilityId===user.selectedFacilityId&&k.yearMonth===alertYM);
  myUsers.forEach(u=>{
    const hasTr=alertMonthRecs.some(r=>r.type==="user_in"&&r.userId===u.id&&r.transport==="あり");
    const billing=facKokuho.find(k=>k.userId===u.id);
    const billAddons=billing?.addons||[];
    // 送迎記録があるのに送迎加算が請求に未設定
    if(hasTr&&!billAddons.some(a=>a.key?.startsWith("tr_"))){
      addonAlerts.push({userId:u.id,userName:u.name,type:"送迎加算",detail:"送迎記録あり・請求に加算未設定"});
    }
    // ISP確定済で請求データがあるのに個別サポート加算が未設定
    if(billing&&billing.serviceDays>0){
      const hasIspFinal=(store.ispRecords||[]).some(r=>r.userId===u.id&&r.docType==="isp_plan"&&["finalized","parent_consented"].includes(r.status));
      if(hasIspFinal&&!billAddons.some(a=>a.key==="indiv"||a.key==="indiv2")){
        addonAlerts.push({userId:u.id,userName:u.name,type:"個別サポート加算",detail:"ISP確定済・個別サポート加算の確認を推奨"});
      }
    }
  });

  // 5. モニタリング期限（ISP有効期限・モニタリング未実施）
  const monAlerts=[];
  const d60=new Date(today);d60.setDate(d60.getDate()+60);const d60ISO=d60.toISOString().slice(0,10);
  const d180=new Date(today);d180.setDate(d180.getDate()-180);const d180ISO=d180.toISOString().slice(0,10);
  const seenMonUser=new Set();
  myUsers.forEach(u=>{
    // ISP有効期限チェック
    const ispRecs=(store.ispRecords||[]).filter(r=>r.userId===u.id&&r.docType==="isp_plan"&&["finalized","parent_consented","manager_confirmed"].includes(r.status)).sort((a,b)=>b.createdAt>a.createdAt?1:-1);
    if(ispRecs.length>0){
      const lat=ispRecs[0];
      const validTo=lat.content?.validTo||lat.content?.supportPeriodTo||"";
      if(validTo&&validTo<=d60ISO){
        const days=Math.round((new Date(validTo)-new Date(today))/(1000*60*60*24));
        monAlerts.push({userId:u.id,userName:u.name,type:days<0?"ISP期限切れ":"ISP期限間近",detail:`有効期限: ${validTo}`,days,level:days<0?"danger":"warn"});
      }
    }
    // モニタリング未実施チェック（monitoringsテーブル＋ispRecordsのmonitoring）
    const lastMon=store.monitorings.filter(m=>m.userId===u.id).sort((a,b)=>b.date>a.date?1:-1)[0];
    const lastMonRec=(store.ispRecords||[]).filter(r=>r.userId===u.id&&r.docType==="monitoring").sort((a,b)=>b.createdAt>a.createdAt?1:-1)[0];
    const lastMonDate=lastMon?.date||(lastMonRec?.createdAt||"").slice(0,10)||"";
    if(!seenMonUser.has(u.id)&&(!lastMonDate||lastMonDate<d180ISO)){
      seenMonUser.add(u.id);
      monAlerts.push({userId:u.id,userName:u.name,type:"モニタリング未実施",detail:lastMonDate?`最終: ${lastMonDate}（6ヶ月超経過）`:"記録なし",level:"warn"});
    }
  });

  // アラート合計件数
  const totalAlerts=noSvcAlerts.length+signAlerts.length+shortAlerts.length+addonAlerts.length+monAlerts.length;

  // ── アラートレポートPDF印刷 ──
  const printAlertReport=()=>{
    const facName=fac?.name||"";
    const now=new Date().toLocaleString("ja-JP");
    const section=(title,rows,cols)=>`
      <h3 style="font-size:12pt;font-weight:700;border-left:4px solid #1a3a6a;padding-left:8px;margin:16px 0 6px;">${title}</h3>
      ${rows.length===0?`<p style="color:#1a7a3a;font-size:10pt;">✅ 問題なし</p>`:`
      <table style="border-collapse:collapse;width:100%;font-size:9pt;margin-bottom:6px;">
        <thead><tr>${cols.map(c=>`<th style="background:#dce8f8;border:1px solid #ccc;padding:4px 8px;text-align:left;">${c}</th>`).join("")}</tr></thead>
        <tbody>${rows}</tbody>
      </table>`}`;
    const noSvcRows=noSvcAlerts.map(a=>`<tr style="background:#fdf0ee;"><td style="border:1px solid #ccc;padding:4px 8px;">${a.date}</td><td style="border:1px solid #ccc;padding:4px 8px;font-weight:700;">${a.userName}</td><td style="border:1px solid #ccc;padding:4px 8px;color:#c0392b;font-weight:700;">サービス記録なし</td></tr>`).join("");
    const signRows=signAlerts.map(a=>`<tr style="background:#fffaec;"><td style="border:1px solid #ccc;padding:4px 8px;font-weight:700;">${a.userName}</td><td style="border:1px solid #ccc;padding:4px 8px;">${a.doc}</td><td style="border:1px solid #ccc;padding:4px 8px;color:#c0392b;">${a.status}</td><td style="border:1px solid #ccc;padding:4px 8px;color:#888;">${a.date}</td></tr>`).join("");
    const shortRows=shortAlerts.map(a=>`<tr style="background:#fffaec;"><td style="border:1px solid #ccc;padding:4px 8px;">${a.date}</td><td style="border:1px solid #ccc;padding:4px 8px;font-weight:700;">${a.userName}</td><td style="border:1px solid #ccc;padding:4px 8px;">${a.arrival||"—"}〜${a.departure||"未記録"}</td><td style="border:1px solid #ccc;padding:4px 8px;color:#c0392b;">${a.type==="nodep"?"退所未記録":a.mins+"分（2時間未満）"}</td></tr>`).join("");
    const addonRows=addonAlerts.map(a=>`<tr style="background:#f3eeff;"><td style="border:1px solid #ccc;padding:4px 8px;font-weight:700;">${a.userName}</td><td style="border:1px solid #ccc;padding:4px 8px;color:#6020a0;font-weight:700;">${a.type}</td><td style="border:1px solid #ccc;padding:4px 8px;">${a.detail}</td></tr>`).join("");
    const monRows=monAlerts.map(a=>`<tr style="background:${a.level==="danger"?"#fdf0ee":"#fffaec"};"><td style="border:1px solid #ccc;padding:4px 8px;font-weight:700;">${a.userName}</td><td style="border:1px solid #ccc;padding:4px 8px;color:${a.level==="danger"?"#c0392b":"#e08020"};font-weight:700;">${a.type}</td><td style="border:1px solid #ccc;padding:4px 8px;">${a.detail}${a.days!=null&&a.days>=0?` (残${a.days}日)`:""}</td></tr>`).join("");
    const html=`<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"/>
    <title>監査アラートレポート ${alertYM}</title>
    <style>@page{size:A4 portrait;margin:14mm 12mm;}*{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'MS Gothic',Meiryo,sans-serif;font-size:10pt;color:#111;}
    .hd{text-align:center;border-bottom:3px solid #1a3a6a;padding-bottom:10px;margin-bottom:14px;}
    .hd h1{font-size:18pt;font-weight:900;color:#1a3a6a;}
    .hd .sub{font-size:10pt;color:#555;margin-top:4px;}
    .summary{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:14px;}
    .sc{border:1px solid #ccc;border-radius:4px;padding:6px 4px;text-align:center;}
    .sc .val{font-size:18pt;font-weight:900;font-family:monospace;}
    .sc .lbl{font-size:8pt;color:#666;}
    .sign-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:18px;}
    .sign-box{border:1px solid #aaa;padding:8px;min-height:44px;border-radius:3px;}
    .sign-lbl{font-size:8pt;color:#666;}
    </style></head><body>
    <div class="hd"><h1>🔍 監査アラートレポート</h1>
    <div class="sub">事業所: ${facName}　対象: ${vm.y}年${vm.m}月　出力: ${now}</div></div>
    <div class="summary">
      <div class="sc"><div class="val" style="color:${noSvcAlerts.length>0?"#c0392b":"#1a7a3a"}">${noSvcAlerts.length}</div><div class="lbl">未記録</div></div>
      <div class="sc"><div class="val" style="color:${signAlerts.length>0?"#c0392b":"#1a7a3a"}">${signAlerts.length}</div><div class="lbl">署名漏れ</div></div>
      <div class="sc"><div class="val" style="color:${shortAlerts.length>0?"#e08020":"#1a7a3a"}">${shortAlerts.length}</div><div class="lbl">時間不足</div></div>
      <div class="sc"><div class="val" style="color:${addonAlerts.length>0?"#6020a0":"#1a7a3a"}">${addonAlerts.length}</div><div class="lbl">加算漏れ</div></div>
      <div class="sc"><div class="val" style="color:${monAlerts.length>0?"#1a4a8a":"#1a7a3a"}">${monAlerts.length}</div><div class="lbl">期限</div></div>
    </div>
    ${section("📝 未記録アラート（来所日にサービス記録なし）",noSvcRows,["日付","利用者名","状態"])}
    ${section("✍️ 署名漏れ（ISP承認フロー停滞・同意書署名未取得）",signRows,["利用者名","書類種別","状態","作成日"])}
    ${section("⏱ 支援時間不足（2時間未満・退所未記録）",shortRows,["日付","利用者名","時刻","内容"])}
    ${section("💴 加算漏れ（請求加算の確認）",addonRows,["利用者名","加算種別","詳細"])}
    ${section("📅 モニタリング期限（ISP有効期限・モニタリング未実施）",monRows,["利用者名","種別","詳細"])}
    <div class="sign-row">
      <div class="sign-box"><div class="sign-lbl">管理者 確認印</div></div>
      <div class="sign-box"><div class="sign-lbl">確認日: ${new Date().toLocaleDateString("ja-JP")}</div></div>
    </div></body></html>`;
    const w=window.open("","_blank","width=900,height=750");
    if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),400);}
  };

  return <div className="fl-wrap">
    <div className="fl-hd">
      <button className="bback" onClick={onBack}>← 戻る</button>
      <div className="fl-title">🔍 監査モード</div>
    </div>

    {/* タブ */}
    <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:16,alignItems:"center"}}>
      {[
        {id:"daily",  icon:"📅",label:"日次チェック"},
        {id:"monthly",icon:"📋",label:"月次帳票出力"},
        {id:"docs",   icon:"📂",label:"書類一覧"},
        {id:"alerts", icon:"🚨",label:"アラート一覧",badge:totalAlerts},
      ].map(t=><button key={t.id} onClick={()=>setTab(t.id)}
        style={{position:"relative",padding:"8px 16px",borderRadius:9,border:"2px solid",cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",fontSize:12,fontWeight:700,transition:"all .15s",
          borderColor:tab===t.id?"var(--tl)":"var(--bd)",
          background:tab===t.id?"rgba(58,160,216,0.2)":"var(--bg)",
          color:tab===t.id?"var(--tl)":"var(--tx3)"}}>
        {t.icon} {t.label}
        {t.badge>0&&<span style={{position:"absolute",top:-7,right:-7,background:"var(--ro)",color:"#fff",borderRadius:"50%",width:18,height:18,fontSize:10,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>{t.badge>9?"9+":t.badge}</span>}
      </button>)}
    </div>

    {/* ── 日次チェックタブ ── */}
    {tab==="daily"&&<>
      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",marginBottom:16,background:"var(--wh)",padding:14,borderRadius:12,border:"1px solid var(--bd)"}}>
        <span style={{fontSize:12,fontWeight:700,color:"var(--tx3)"}}>期間：</span>
        <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
          style={{padding:"8px 10px",borderRadius:8,border:"1.5px solid var(--bd)",background:"var(--bg)",color:"var(--tx)",fontSize:16,fontFamily:"'DM Mono',monospace",outline:"none"}}/>
        <span style={{color:"var(--tx3)"}}>〜</span>
        <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
          style={{padding:"8px 10px",borderRadius:8,border:"1.5px solid var(--bd)",background:"var(--bg)",color:"var(--tx)",fontSize:16,fontFamily:"'DM Mono',monospace",outline:"none"}}/>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {[["今日",0,0],["今週",-(new Date().getDay()||7)+1,0],["今月",-(new Date().getDate()-1),0]].map(([label,from,to])=>(
            <button key={label} onClick={()=>{
              const d=new Date();const f=new Date(d);f.setDate(d.getDate()+from);const t2=new Date(d);t2.setDate(d.getDate()+to);
              setDateFrom(f.toISOString().slice(0,10));setDateTo(t2.toISOString().slice(0,10));
            }} style={{padding:"6px 12px",borderRadius:8,border:"1px solid var(--bd)",background:"var(--bg)",color:"var(--tx3)",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>
              {label}
            </button>
          ))}
        </div>
        <button className="bexp" style={{marginLeft:"auto",background:"#fff8f0",borderColor:"var(--ac)",color:"var(--ac)"}} onClick={printAudit}>🖨️ 監査PDF</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:9,marginBottom:18}}>
        {[{label:"来所者数",val:total,color:"var(--tl)"},{label:"記録完備",val:fullOk,color:"var(--gr)"},{label:"未完備",val:total-fullOk,color:total-fullOk>0?"var(--ro)":"var(--tx3)"},{label:"高体温者",val:highTempIds.length,color:highTempIds.length>0?"var(--ro)":"var(--tx3)"}].map(s=>(
          <div key={s.label} className="stat-card"><div className="stat-label">{s.label}</div><div className="stat-val" style={{color:s.color,fontSize:22}}>{s.val}</div></div>
        ))}
      </div>
      {arrivedUserIds.length===0
        ?<div style={{textAlign:"center",color:"var(--tx3)",padding:"32px 0",fontSize:13,background:"var(--wh)",borderRadius:12,border:"1px solid var(--bd)"}}>指定期間内に来所記録がありません</div>
        :myUsers.filter(u=>arrivedUserIds.includes(u.id)).map(u=>{
          const hasTemp=tempOkIds.includes(u.id),hasService=serviceUserIds.includes(u.id);
          const hasPhoto=photoUserIds.includes(u.id),hasHigh=highTempIds.includes(u.id);
          const allOk=hasTemp&&hasService,expanded=expandUser===u.id;
          const tempHist=getTempHistory(u.id),changeHist=getChangeHistory(u.id);
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
    </>}

    {/* ── 月次帳票出力タブ ── */}
    {tab==="monthly"&&<>
      {/* 年月選択 */}
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:16,background:"var(--wh)",padding:12,borderRadius:12,border:"1px solid var(--bd)"}}>
        <span style={{fontSize:12,fontWeight:700,color:"var(--tx3)"}}>対象年月：</span>
        <select className="fsm" value={vm.y} onChange={e=>setVm(v=>({...v,y:+e.target.value}))}>
          {Array.from({length:5},(_,i)=>2024+i).map(y=><option key={y} value={y}>{y}年</option>)}
        </select>
        <select className="fsm" value={vm.m} onChange={e=>setVm(v=>({...v,m:+e.target.value}))}>
          {Array.from({length:12},(_,i)=>i+1).map(m=><option key={m} value={m}>{m}月</option>)}
        </select>
        <span style={{fontSize:11,color:"var(--tx3)",marginLeft:8}}>👉 帳票を選んで印刷してください</span>
      </div>
      {/* 帳票カード一覧 */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:12,marginBottom:20}}>
        {[
          {icon:"📊",title:"月次サービス提供記録表",desc:"全利用者の来所日をA3カレンダーで確認。体温・記録状況を色で表示",color:"linear-gradient(135deg,#1a6b3a,#2d9e58)",action:printMonthlyServiceTable},
          {icon:"📋",title:"欠落チェックレポート",desc:"体温未入力・サービス記録不足・ISP期限切れを一覧で確認",color:"linear-gradient(135deg,#8a2010,#c0392b)",action:printGapReport},
          {icon:"📊",title:"ISP整合確認表",desc:"ISP目標とサービス記録の連携率を利用者ごとに数値で確認",color:"linear-gradient(135deg,#1a4a8a,#2d6ed6)",action:printIspCompliance},
        ].map(c=>(
          <button key={c.title} onClick={c.action}
            style={{display:"flex",flexDirection:"column",gap:8,padding:"16px 14px",borderRadius:14,background:c.color,color:"#fff",border:"none",cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",textAlign:"left",transition:"transform .1s,box-shadow .1s",boxShadow:"0 4px 16px rgba(0,0,0,0.2)"}}>
            <div style={{fontSize:26}}>{c.icon}</div>
            <div style={{fontWeight:700,fontSize:13,lineHeight:1.4}}>{c.title}</div>
            <div style={{fontSize:11,opacity:.85,lineHeight:1.5}}>{c.desc}</div>
            <div style={{marginTop:4,fontSize:11,fontWeight:700,opacity:.9}}>🖨 クリックして印刷</div>
          </button>
        ))}
      </div>
      {/* 利用者別支援記録台帳 */}
      <div className="dash-title" style={{marginBottom:10}}>📋 利用者別 支援記録台帳（個別印刷）</div>
      <div style={{display:"flex",flexDirection:"column",gap:7}}>
        {myUsers.map(u=>{
          const yearMonth=vm.y+"-"+String(vm.m).padStart(2,"0");
          const svcCount=store.recs.filter(r=>r.type==="service"&&r.userId===u.id&&(r.time||"").slice(0,7)===yearMonth).length;
          const arrCount=store.recs.filter(r=>r.type==="user_in"&&r.userId===u.id&&(r.time||"").slice(0,7)===yearMonth).length;
          return <div key={u.id} style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:"10px 13px",display:"flex",alignItems:"center",gap:10}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:13}}>{u.name}</div>
              <div style={{fontSize:11,color:"var(--tx3)",marginTop:2}}>
                来所 <span style={{fontWeight:700,color:"var(--tl)"}}>{arrCount}日</span>
                サービス記録 <span style={{fontWeight:700,color:svcCount>=arrCount?"var(--gr)":svcCount>0?"var(--am)":"var(--ro)"}}>{svcCount}件</span>
              </div>
            </div>
            <button onClick={()=>printUserLedger(u.id)}
              style={{padding:"8px 14px",borderRadius:9,background:"rgba(58,160,216,0.12)",border:"1px solid rgba(58,160,216,0.4)",color:"var(--tl)",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",whiteSpace:"nowrap"}}>
              🖨 台帳印刷
            </button>
          </div>;
        })}
        {myUsers.length===0&&<div style={{textAlign:"center",color:"var(--tx3)",padding:24}}>利用者が登録されていません</div>}
      </div>
    </>}

    {/* ── 書類一覧タブ ── */}
    {tab==="docs"&&<>
      <div className="dash-title" style={{marginBottom:10}}>📂 利用者別 書類完備状況</div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:600}}>
          <thead><tr style={{background:"var(--bg2)"}}>
            {["利用者名","受給者証番号","フェイスシート","アセスメント","個別支援計画","モニタリング","完備スコア"].map(h=>(
              <th key={h} style={{padding:"7px 9px",textAlign:"left",color:"var(--tx2)",fontSize:10,fontWeight:700,borderBottom:"2px solid var(--bd)",whiteSpace:"nowrap"}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>{docStatusRows.map(({u,ud,fs,asses,latestIsp,latestIspRec,mons,score,jukyushaOk,ispExpired})=>{
            const Cell=({ok,warn,text})=><td style={{padding:"7px 9px"}}>
              <span style={{fontSize:11,fontWeight:700,color:ok?"var(--gr)":warn?"var(--am)":"var(--ro)"}}>{ok?"✅":warn?"⚠️":"✗"} {text}</span>
            </td>;
            const ispOk=(latestIsp||latestIspRec)&&!ispExpired;
            const ispText=latestIspRec?`${latestIspRec.status==="finalized"?"確定済":"作成中"}`
              :latestIsp?`${ispExpired?"期限切れ":"有効"}(〜${latestIsp.endDate||"?"})` :"未作成";
            return <tr key={u.id} style={{borderBottom:"1px solid var(--bd)"}}>
              <td style={{padding:"7px 9px",fontWeight:700}}>{u.name}</td>
              <td style={{padding:"7px 9px",fontFamily:"'DM Mono',monospace",fontSize:11,color:jukyushaOk?"var(--tx)":"var(--ro)"}}>{ud.jukyushaNo||"未入力"}</td>
              <Cell ok={!!fs} text={fs?"作成済":"未作成"}/>
              <Cell ok={asses.length>0} text={asses.length>0?`${asses.length}件`:"未作成"}/>
              <Cell ok={ispOk} warn={latestIsp&&ispExpired} text={ispText}/>
              <Cell ok={mons.length>0} text={mons.length>0?`${mons.length}件`:"未作成"}/>
              <td style={{padding:"7px 9px"}}>
                <div style={{display:"flex",alignItems:"center",gap:7}}>
                  <div style={{flex:1,height:8,background:"var(--bd)",borderRadius:4,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${score/5*100}%`,background:score>=4?"var(--gr)":score>=2?"var(--am)":"var(--ro)",borderRadius:4,transition:"width .3s"}}/>
                  </div>
                  <span style={{fontSize:11,fontWeight:700,color:score>=4?"var(--gr)":score>=2?"var(--am)":"var(--ro)"}}>{score}/5</span>
                </div>
              </td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </>}

    {/* ── アラート一覧タブ ── */}
    {tab==="alerts"&&<>
      {/* 年月選択 + サマリーバー */}
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:14,background:"var(--wh)",padding:12,borderRadius:12,border:"1px solid var(--bd)"}}>
        <span style={{fontSize:12,fontWeight:700,color:"var(--tx3)"}}>対象年月：</span>
        <select className="fsm" value={vm.y} onChange={e=>setVm(v=>({...v,y:+e.target.value}))}>
          {Array.from({length:5},(_,i)=>2024+i).map(y=><option key={y} value={y}>{y}年</option>)}
        </select>
        <select className="fsm" value={vm.m} onChange={e=>setVm(v=>({...v,m:+e.target.value}))}>
          {Array.from({length:12},(_,i)=>i+1).map(m=><option key={m} value={m}>{m}月</option>)}
        </select>
        {totalAlerts>0
          ?<span style={{marginLeft:6,background:"var(--ro)",color:"#fff",borderRadius:20,padding:"3px 12px",fontSize:12,fontWeight:700}}>⚠ {totalAlerts}件のアラート</span>
          :<span style={{marginLeft:6,color:"var(--gr)",fontWeight:700,fontSize:12}}>✅ 全て問題なし</span>}
        <button className="bexp" style={{marginLeft:"auto",background:"#fff8f0",borderColor:"var(--ac)",color:"var(--ac)"}} onClick={printAlertReport}>🖨 アラートレポート印刷</button>
      </div>

      {/* アラートサマリーカード（5種） */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(145px,1fr))",gap:9,marginBottom:18}}>
        {[
          {label:"未記録",count:noSvcAlerts.length,icon:"📝",color:"var(--ro)",desc:"来所→記録なし"},
          {label:"署名漏れ",count:signAlerts.length,icon:"✍️",color:"var(--am)",desc:"ISP・同意書"},
          {label:"時間不足",count:shortAlerts.length,icon:"⏱",color:"var(--am)",desc:"2時間未満・退所漏れ"},
          {label:"加算漏れ",count:addonAlerts.length,icon:"💴",color:"#9048d8",desc:"請求加算確認"},
          {label:"期限アラート",count:monAlerts.length,icon:"📅",color:"var(--tl)",desc:"ISP期限・モニタリング"},
        ].map(s=>(
          <div key={s.label} style={{background:"var(--wh)",border:`2px solid ${s.count>0?s.color:"var(--bd)"}`,borderRadius:12,padding:"12px 8px",textAlign:"center"}}>
            <div style={{fontSize:22}}>{s.icon}</div>
            <div style={{fontSize:26,fontWeight:900,color:s.count>0?s.color:"var(--tx3)",fontFamily:"'DM Mono',monospace",marginTop:2}}>{s.count}</div>
            <div style={{fontSize:11,fontWeight:700,color:"var(--tx2)",marginTop:2}}>{s.label}</div>
            <div style={{fontSize:10,color:"var(--tx3)",marginTop:1}}>{s.desc}</div>
          </div>
        ))}
      </div>

      {/* 1. 未記録アラート */}
      <AlertSection icon="📝" title="未記録アラート" color="var(--ro)" count={noSvcAlerts.length}>
        {noSvcAlerts.length===0
          ?<div style={{color:"var(--gr)",fontSize:12,padding:"6px 0"}}>✅ 全来所日にサービス記録があります</div>
          :<div style={{display:"flex",flexDirection:"column",gap:5}}>
            <div style={{fontSize:11,color:"var(--tx3)",marginBottom:4}}>来所記録はあるが、サービス（活動）記録が入力されていない日があります。</div>
            {noSvcAlerts.map((a,i)=><div key={i} style={{display:"flex",gap:10,alignItems:"center",padding:"7px 11px",background:"rgba(224,56,56,0.06)",borderRadius:8,border:"1px solid rgba(224,56,56,0.2)"}}>
              <span style={{fontSize:11,fontFamily:"'DM Mono',monospace",color:"var(--tx3)",whiteSpace:"nowrap",minWidth:80}}>{a.date}</span>
              <span style={{fontWeight:700,fontSize:13}}>{a.userName}</span>
              <span style={{fontSize:11,color:"var(--ro)",fontWeight:700,marginLeft:"auto",whiteSpace:"nowrap"}}>サービス記録なし 🚨</span>
            </div>)}
          </div>
        }
      </AlertSection>

      {/* 2. 署名漏れ */}
      <AlertSection icon="✍️" title="署名漏れ" color="var(--am)" count={signAlerts.length}>
        {signAlerts.length===0
          ?<div style={{color:"var(--gr)",fontSize:12,padding:"6px 0"}}>✅ 署名・同意書の漏れはありません</div>
          :<div style={{display:"flex",flexDirection:"column",gap:5}}>
            <div style={{fontSize:11,color:"var(--tx3)",marginBottom:4}}>ISP承認フローが途中で止まっている、または同意書の保護者署名が未取得です。</div>
            {signAlerts.map((a,i)=><div key={i} style={{display:"flex",gap:8,alignItems:"center",padding:"7px 11px",background:"rgba(240,112,32,0.06)",borderRadius:8,border:"1px solid rgba(240,112,32,0.2)"}}>
              <span style={{fontWeight:700,fontSize:13,minWidth:80}}>{a.userName}</span>
              <span style={{fontSize:11,color:"var(--tx3)",background:"var(--bg2)",borderRadius:6,padding:"2px 7px"}}>{a.doc}</span>
              <span style={{fontSize:11,color:"var(--am)",fontWeight:700,marginLeft:"auto",whiteSpace:"nowrap"}}>{a.status} ✍</span>
              {a.date&&<span style={{fontSize:10,color:"var(--tx3)",fontFamily:"'DM Mono',monospace"}}>{a.date}</span>}
            </div>)}
          </div>
        }
      </AlertSection>

      {/* 3. 支援時間不足 */}
      <AlertSection icon="⏱" title="支援時間不足" color="var(--am)" count={shortAlerts.length}>
        {shortAlerts.length===0
          ?<div style={{color:"var(--gr)",fontSize:12,padding:"6px 0"}}>✅ 全記録で2時間以上の支援が確認されています</div>
          :<div style={{display:"flex",flexDirection:"column",gap:5}}>
            <div style={{fontSize:11,color:"var(--tx3)",marginBottom:4}}>支援時間が2時間未満、または退所時刻が未入力のサービス記録があります。放課後等デイサービスの算定要件に注意してください。</div>
            {shortAlerts.map((a,i)=><div key={i} style={{display:"flex",gap:8,alignItems:"center",padding:"7px 11px",background:"rgba(240,112,32,0.06)",borderRadius:8,border:"1px solid rgba(240,112,32,0.2)"}}>
              <span style={{fontSize:11,fontFamily:"'DM Mono',monospace",color:"var(--tx3)",whiteSpace:"nowrap",minWidth:80}}>{a.date}</span>
              <span style={{fontWeight:700,fontSize:13}}>{a.userName}</span>
              <span style={{fontSize:11,fontFamily:"'DM Mono',monospace",color:"var(--tx3)"}}>{a.arrival}〜{a.departure||"?"}</span>
              <span style={{fontSize:11,color:"var(--am)",fontWeight:700,marginLeft:"auto",whiteSpace:"nowrap"}}>
                {a.type==="nodep"?"退所未記録 ⚠":`${a.mins}分（2時間未満） ⚠`}
              </span>
            </div>)}
          </div>
        }
      </AlertSection>

      {/* 4. 加算漏れ */}
      <AlertSection icon="💴" title="加算漏れ" color="#9048d8" count={addonAlerts.length}>
        {addonAlerts.length===0
          ?<div style={{color:"var(--gr)",fontSize:12,padding:"6px 0"}}>✅ 加算漏れは検出されませんでした</div>
          :<div style={{display:"flex",flexDirection:"column",gap:5}}>
            <div style={{fontSize:11,color:"var(--tx3)",marginBottom:4}}>請求データに加算が設定されていない可能性があります。国保連請求画面で確認・設定してください。</div>
            {addonAlerts.map((a,i)=><div key={i} style={{display:"flex",gap:8,alignItems:"center",padding:"7px 11px",background:"rgba(144,72,216,0.06)",borderRadius:8,border:"1px solid rgba(144,72,216,0.2)"}}>
              <span style={{fontWeight:700,fontSize:13,minWidth:80}}>{a.userName}</span>
              <span style={{fontSize:11,fontWeight:700,color:"#9048d8",background:"rgba(144,72,216,0.1)",borderRadius:6,padding:"2px 8px"}}>{a.type}</span>
              <span style={{fontSize:11,color:"var(--tx3)",marginLeft:"auto"}}>{a.detail}</span>
            </div>)}
          </div>
        }
      </AlertSection>

      {/* 5. モニタリング期限 */}
      <AlertSection icon="📅" title="モニタリング期限" color="var(--tl)" count={monAlerts.length}>
        {monAlerts.length===0
          ?<div style={{color:"var(--gr)",fontSize:12,padding:"6px 0"}}>✅ 期限切れ・モニタリング未実施はありません</div>
          :<div style={{display:"flex",flexDirection:"column",gap:5}}>
            <div style={{fontSize:11,color:"var(--tx3)",marginBottom:4}}>ISP有効期限が近い、または半年以上モニタリングが実施されていない利用者がいます。</div>
            {monAlerts.map((a,i)=>{
              const c=a.level==="danger"?"var(--ro)":a.level==="warn"?"var(--am)":"var(--tl)";
              const bg=a.level==="danger"?"rgba(224,56,56,0.06)":a.level==="warn"?"rgba(240,112,32,0.06)":"rgba(58,160,216,0.06)";
              const bc=a.level==="danger"?"rgba(224,56,56,0.2)":a.level==="warn"?"rgba(240,112,32,0.2)":"rgba(58,160,216,0.2)";
              return <div key={i} style={{display:"flex",gap:8,alignItems:"center",padding:"7px 11px",background:bg,borderRadius:8,border:`1px solid ${bc}`}}>
                <span style={{fontWeight:700,fontSize:13,minWidth:80}}>{a.userName}</span>
                <span style={{fontSize:11,fontWeight:700,color:c,background:`${c}18`,borderRadius:6,padding:"2px 8px"}}>{a.type}</span>
                <span style={{fontSize:11,color:"var(--tx3)",marginLeft:"auto"}}>{a.detail}{a.days!=null&&a.days>=0?` (残${a.days}日)`:""}</span>
              </div>;
            })}
          </div>
        }
      </AlertSection>
    </>}
  </div>;
}

// ==================== 勤務実績 ====================
function WorkRecordScreen({user,store,onBack}){
  const [vm,setVm]=useState(()=>{const d=new Date();return{y:d.getFullYear(),m:d.getMonth()+1};});
  const [tab,setTab]=useState("summary");
  const [selStaffId,setSelStaffId]=useState(null);

  const isMgr=user.role==="manager"||user.role==="admin";
  const fStaff=store.dynStaff.filter(s=>user.role==="admin"||s.facilityId===user.selectedFacilityId);
  const facName=FACILITIES.find(f=>f.id===user.selectedFacilityId)?.name||"";
  const days=daysInMonth(vm.y,vm.m);
  const mk=d=>`${vm.y}-${String(vm.m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const yearMonth=vm.y+"-"+String(vm.m).padStart(2,"0");
  const dow=["日","月","火","水","木","金","土"];

  // シフトの開始・終了時刻をパース (例: "8:00〜17:00" → {start:480, end:1020})
  const parseShiftTime=key=>{
    const st=SHIFT_TYPES.find(s=>s.key===key);
    if(!st||!st.time.includes("〜")) return null;
    const [s,e]=st.time.split("〜");
    const toMin=t=>{const [h,m]=t.trim().split(":").map(Number);return h*60+(m||0);};
    return {start:toMin(s),end:toMin(e),hours:(toMin(e)-toMin(s)-60)/60}; // 休憩1h控除
  };

  // 実打刻を取得 (in:最早, out:最遅)
  const getActual=(staffId,dateStr)=>{
    const ins=store.recs.filter(r=>r.type==="staff_in"&&r.staffId===staffId&&(r.time||"").startsWith(dateStr));
    const outs=store.recs.filter(r=>r.type==="staff_out"&&r.staffId===staffId&&(r.time||"").startsWith(dateStr));
    const parseTime=t=>{
      // "2025/06/10 8:30:00" → minutes from midnight
      const m=t.match(/(\d+):(\d+)/);return m?+m[1]*60+ +m[2]:null;
    };
    const inTimes=ins.map(r=>parseTime(r.time)).filter(t=>t!==null);
    const outTimes=outs.map(r=>parseTime(r.time)).filter(t=>t!==null);
    const actualIn=inTimes.length?Math.min(...inTimes):null;
    const actualOut=outTimes.length?Math.max(...outTimes):null;
    const inRec=ins.length?ins.reduce((a,b)=>(parseTime(a.time)||9999)<(parseTime(b.time)||9999)?a:b):null;
    const outRec=outs.length?outs.reduce((a,b)=>(parseTime(a.time)||0)>(parseTime(b.time)||0)?a:b):null;
    return {actualIn,actualOut,inRec,outRec};
  };

  // 1日の勤務実績計算
  const calcDay=(staffId,dateStr)=>{
    const shiftKey=store.getShift(staffId,dateStr)||"none";
    const dw=new Date(dateStr).getDay();
    const isWe=dw===0||dw===6;
    if(isWe||shiftKey==="none") return {shiftKey,isWe,status:"休日"};
    if(shiftKey==="off") return {shiftKey,isWe:false,status:"公休"};
    if(shiftKey==="holiday") return {shiftKey,isWe:false,status:"有給"};
    const sched=parseShiftTime(shiftKey);
    const {actualIn,actualOut,inRec,outRec}=getActual(staffId,dateStr);
    if(actualIn===null) return {shiftKey,sched,status:"未打刻",actualIn:null,actualOut:null,workedH:0,overtimeH:0,lateMin:0,earlyMin:0};
    const workedH=actualOut!==null?(actualOut-actualIn-60)/60:null; // 休憩1h控除
    const lateMin=sched&&actualIn>sched.start+5?actualIn-sched.start:0;
    const earlyMin=sched&&actualOut!==null&&actualOut<sched.end-5?sched.end-actualOut:0;
    const overtimeH=sched&&workedH!==null&&workedH>sched.hours+0.5?workedH-sched.hours:0;
    const fmtMin=m=>{if(m===null) return "—";const h=Math.floor(m/60);const min=m%60;return h>0?`${h}:${String(min).padStart(2,"0")}`:`${String(min).padStart(2,"0")}`;}
    return {shiftKey,sched,status:outRec?"出勤":"退勤未打刻",actualIn,actualOut,workedH,overtimeH,lateMin,earlyMin,inTime:fmtMin(actualIn),outTime:fmtMin(actualOut),inRec,outRec};
  };

  // 職員ごとの月次集計
  const calcMonthSummary=staffId=>{
    let workDays=0,totalH=0,overtimeH=0,lateDays=0,earlyDays=0,noClockDays=0,punchDays=0;
    for(let i=1;i<=days;i++){
      const r=calcDay(staffId,mk(i));
      if(r.status==="出勤"||r.status==="退勤未打刻"){
        workDays++;
        if(r.workedH>0){totalH+=r.workedH;punchDays++;}
        else if(r.status==="退勤未打刻") noClockDays++;
        if(r.overtimeH>0) overtimeH+=r.overtimeH;
        if(r.lateMin>0) lateDays++;
        if(r.earlyMin>0) earlyDays++;
      } else if(r.status==="未打刻"&&store.getShift(staffId,mk(i))&&store.getShift(staffId,mk(i))!=="none"&&store.getShift(staffId,mk(i))!=="off"&&store.getShift(staffId,mk(i))!=="holiday"){
        noClockDays++;workDays++;
      }
    }
    return {workDays,totalH:Math.round(totalH*10)/10,overtimeH:Math.round(overtimeH*10)/10,lateDays,earlyDays,noClockDays,punchDays};
  };

  // 月次集計印刷
  const printMonthly=()=>{
    const rows=fStaff.map(s=>{
      const m=calcMonthSummary(s.id);
      return `<tr>
        <td style="font-weight:700;text-align:left;padding:5px 7px;">${s.name}</td>
        <td style="text-align:center;">${(s.data||s).role==="manager"?"管理者":(s.data||s).employmentType||"—"}</td>
        <td style="text-align:center;font-weight:700;color:#1a4a8a;">${m.workDays}日</td>
        <td style="text-align:center;font-weight:700;color:#1a7a3a;">${m.totalH}h</td>
        <td style="text-align:center;color:${m.overtimeH>0?"#c0392b":"#999"};font-weight:${m.overtimeH>0?700:400};">${m.overtimeH>0?"+"+m.overtimeH+"h":"—"}</td>
        <td style="text-align:center;color:${m.lateDays>0?"#e08020":"#999"};">${m.lateDays>0?m.lateDays+"日":"—"}</td>
        <td style="text-align:center;color:${m.earlyDays>0?"#e08020":"#999"};">${m.earlyDays>0?m.earlyDays+"日":"—"}</td>
        <td style="text-align:center;color:${m.noClockDays>0?"#c0392b":"#999"};font-weight:${m.noClockDays>0?700:400};">${m.noClockDays>0?m.noClockDays+"日":"—"}</td>
        <td style="border-left:1px dashed #ccc;min-width:60px;"></td>
      </tr>`;
    }).join("");
    const html=`<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"/>
    <title>勤務実績集計表 ${vm.y}年${vm.m}月</title>
    <style>
      @page{size:A4 landscape;margin:12mm 10mm;}
      *{box-sizing:border-box;} body{font-family:'MS Gothic',Meiryo,sans-serif;font-size:9pt;color:#111;}
      h2{font-size:13pt;margin-bottom:4px;} .meta{font-size:8pt;color:#555;margin-bottom:8px;}
      table{border-collapse:collapse;width:100%;font-size:9pt;}
      th,td{border:1px solid #ccc;padding:4px 6px;}
      th{background:#dce8f8;font-weight:700;text-align:center;}
      .sign-row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:14px;}
      .sign-box{border:1px solid #aaa;padding:8px;min-height:44px;border-radius:3px;}
      .sign-lbl{font-size:8pt;color:#666;}
    </style></head><body>
    <h2>⏱ 勤務実績集計表</h2>
    <div class="meta">事業所: ${facName}　対象: ${vm.y}年${vm.m}月　出力日: ${new Date().toLocaleDateString("ja-JP")}</div>
    <div style="font-size:8pt;color:#888;margin-bottom:6px;">※ 勤務時間は打刻データから自動計算（休憩1時間控除）。シフトと打刻の差から遅刻・残業を判定。</div>
    <table>
      <thead><tr>
        <th style="text-align:left;">氏名</th><th>職種・雇用</th>
        <th>出勤日数</th><th>実働時間</th><th>時間外</th><th>遅刻日数</th><th>早退日数</th><th>未打刻日</th>
        <th>確認サイン</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="sign-row">
      <div class="sign-box"><div class="sign-lbl">管理者 確認印</div></div>
      <div class="sign-box"><div class="sign-lbl">作成者</div></div>
      <div class="sign-box"><div class="sign-lbl">確認日: ${new Date().toLocaleDateString("ja-JP")}</div></div>
    </div></body></html>`;
    const w=window.open("","_blank","width=1200,height=800");
    if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),400);}
  };

  // 個人別勤怠台帳 印刷
  const printPersonal=staffId=>{
    const s=fStaff.find(x=>x.id===staffId);if(!s) return;
    const rows=Array.from({length:days},(_,i)=>{
      const d=i+1;const date=mk(d);const dw=new Date(date).getDay();
      const r=calcDay(staffId,date);
      const st=SHIFT_TYPES.find(x=>x.key===r.shiftKey);
      const rowBg=r.status==="公休"?"#f8f8f8":r.status==="有給"?"#f5eeff":r.status==="未打刻"?"#fdf0ee":"";
      return `<tr style="background:${rowBg};">
        <td style="text-align:center;font-size:8pt;color:${dw===0?"#c0392b":dw===6?"#1a4a8a":"#333"};font-weight:700;">${d}（${dow[dw]}）</td>
        <td style="text-align:center;font-size:8pt;color:${st?.text||"#999"};">${st?.label||"—"}</td>
        <td style="text-align:center;font-family:monospace;">${r.inTime||"—"}</td>
        <td style="text-align:center;font-family:monospace;">${r.outTime||"—"}</td>
        <td style="text-align:center;font-family:monospace;font-weight:700;">${r.workedH!=null&&r.workedH>0?r.workedH+"h":"—"}</td>
        <td style="text-align:center;color:${r.overtimeH>0?"#c0392b":"#999"};">${r.overtimeH>0?"+"+r.overtimeH+"h":"—"}</td>
        <td style="text-align:center;font-size:9pt;">
          ${r.lateMin>0?`<span style="color:#e08020;font-weight:700;">遅${r.lateMin}分</span>`:""}
          ${r.earlyMin>0?`<span style="color:#e08020;font-weight:700;">早${r.earlyMin}分</span>`:""}
          ${r.status==="未打刻"||r.status==="退勤未打刻"?`<span style="color:#c0392b;font-weight:700;">${r.status}</span>`:""}
          ${r.status==="公休"?"公休":r.status==="有給"?"有給":""}
        </td>
        <td style="min-width:50px;border-left:1px dashed #ccc;"></td>
      </tr>`;
    }).join("");
    const m=calcMonthSummary(staffId);
    const html=`<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"/>
    <title>勤怠台帳 ${s.name} ${vm.y}年${vm.m}月</title>
    <style>
      @page{size:A4 portrait;margin:15mm 12mm;}
      *{box-sizing:border-box;} body{font-family:'MS Gothic',Meiryo,sans-serif;font-size:9pt;color:#111;}
      h2{font-size:14pt;border-bottom:2px solid #1a3a6a;padding-bottom:5px;margin-bottom:8px;}
      .info-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px;}
      .info-item{border:1px solid #ccc;padding:5px 8px;border-radius:3px;}
      .info-lbl{font-size:7pt;color:#666;margin-bottom:1px;}
      .info-val{font-size:10pt;font-weight:700;}
      .sum-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:10px;}
      .sum-box{border:1px solid #ccc;padding:5px 7px;text-align:center;border-radius:3px;}
      .sum-val{font-size:13pt;font-weight:900;font-family:monospace;}
      .sum-lbl{font-size:7pt;color:#666;}
      table{border-collapse:collapse;width:100%;font-size:9pt;}
      th,td{border:1px solid #ccc;padding:4px 6px;}
      th{background:#dce8f8;font-weight:700;text-align:center;}
      .sign-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px;}
      .sign-box{border:1px solid #aaa;padding:8px;min-height:48px;border-radius:3px;}
      .sign-lbl{font-size:8pt;color:#666;}
    </style></head><body>
    <h2>⏱ 勤怠台帳（個人）</h2>
    <div class="info-grid">
      <div class="info-item"><div class="info-lbl">氏名</div><div class="info-val">${s.name}</div></div>
      <div class="info-item"><div class="info-lbl">所属施設</div><div class="info-val">${facName}</div></div>
      <div class="info-item"><div class="info-lbl">対象年月</div><div class="info-val">${vm.y}年${vm.m}月</div></div>
    </div>
    <div class="sum-grid">
      <div class="sum-box"><div class="sum-val" style="color:#1a4a8a;">${m.workDays}</div><div class="sum-lbl">出勤日数</div></div>
      <div class="sum-box"><div class="sum-val" style="color:#1a7a3a;">${m.totalH}h</div><div class="sum-lbl">実働時間</div></div>
      <div class="sum-box"><div class="sum-val" style="color:${m.overtimeH>0?"#c0392b":"#999"};">${m.overtimeH>0?"+"+m.overtimeH:"0"}h</div><div class="sum-lbl">時間外</div></div>
      <div class="sum-box"><div class="sum-val" style="color:${m.noClockDays>0?"#c0392b":"#999"};">${m.noClockDays}</div><div class="sum-lbl">未打刻日</div></div>
    </div>
    <table>
      <thead><tr><th>日付</th><th>シフト</th><th>出勤</th><th>退勤</th><th>実働</th><th>残業</th><th>備考</th><th>確認</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="sign-row">
      <div class="sign-box"><div class="sign-lbl">本人 確認サイン</div></div>
      <div class="sign-box"><div class="sign-lbl">管理者 確認印　　確認日: ${new Date().toLocaleDateString("ja-JP")}</div></div>
    </div></body></html>`;
    const w=window.open("","_blank","width=900,height=750");
    if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),400);}
  };

  // CSV出力
  const downloadCSV=()=>{
    const headers=["職員ID","氏名","雇用区分","出勤日数","実働時間(h)","時間外(h)","遅刻日数","早退日数","未打刻日数"];
    const rows=fStaff.map(s=>{
      const m=calcMonthSummary(s.id);
      const sd=s.data||s;
      return [s.id,s.name,sd.employmentType||"—",m.workDays,m.totalH,m.overtimeH,m.lateDays,m.earlyDays,m.noClockDays];
    });
    const csv=[headers,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["﻿"+csv],{type:"text/csv;charset=utf-8;"}));
    a.download=`kintai_${yearMonth}_${facName}.csv`;a.click();
  };

  const selStaff=fStaff.find(s=>s.id===selStaffId)||fStaff[0];

  return <div className="fl-wrap">
    <div className="fl-hd">
      <button className="bback" onClick={onBack}>← 戻る</button>
      <div className="fl-title">⏱ 勤務実績</div>
    </div>

    {/* 年月ナビ */}
    <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:12,flexWrap:"wrap"}}>
      <button className="cn" onClick={()=>setVm(v=>v.m===1?{y:v.y-1,m:12}:{y:v.y,m:v.m-1})}>‹</button>
      <div style={{fontSize:16,fontWeight:900,minWidth:90,textAlign:"center"}}>{vm.y}年 {vm.m}月</div>
      <button className="cn" onClick={()=>setVm(v=>v.m===12?{y:v.y+1,m:1}:{y:v.y,m:v.m+1})}>›</button>
      <div style={{display:"flex",gap:5,marginLeft:8,flexWrap:"wrap"}}>
        {[{id:"summary",icon:"📊",label:"月次集計"},{id:"personal",icon:"👤",label:"個人別実績"},{id:"alert",icon:"🚨",label:"アラート"}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{padding:"7px 13px",borderRadius:9,border:"2px solid",cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",fontSize:12,fontWeight:700,
              borderColor:tab===t.id?"var(--tl)":"var(--bd)",background:tab===t.id?"rgba(58,160,216,0.2)":"var(--bg)",color:tab===t.id?"var(--tl)":"var(--tx3)"}}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {isMgr&&<div style={{display:"flex",gap:6,marginLeft:"auto"}}>
        <button className="bexp" onClick={downloadCSV}>⬇ CSV</button>
        <button className="bexp" style={{background:"#fff8f0",borderColor:"var(--ac)",color:"var(--ac)"}} onClick={printMonthly}>🖨️ 集計印刷</button>
      </div>}
    </div>

    {/* ── 月次集計タブ ── */}
    {tab==="summary"&&<>
      <div style={{overflowX:"auto",marginBottom:16}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:560}}>
          <thead><tr style={{background:"var(--bg2)"}}>
            {["職員名","雇用区分","出勤日数","実働時間","時間外","遅刻","早退","未打刻","台帳"].map(h=>(
              <th key={h} style={{padding:"8px 9px",textAlign:"left",color:"var(--tx2)",fontSize:10,fontWeight:700,borderBottom:"2px solid var(--bd)",whiteSpace:"nowrap"}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>{fStaff.map(s=>{
            const m=calcMonthSummary(s.id);const sd=s.data||s;
            return <tr key={s.id} style={{borderBottom:"1px solid var(--bd)"}}>
              <td style={{padding:"8px 9px",fontWeight:700}}>{s.name}</td>
              <td style={{padding:"8px 9px",fontSize:11,color:"var(--tx3)"}}>{sd.role==="manager"?"管理者":sd.employmentType||"—"}</td>
              <td style={{padding:"8px 9px",textAlign:"right",fontFamily:"'DM Mono',monospace",fontWeight:700,color:"var(--tl)"}}>{m.workDays}日</td>
              <td style={{padding:"8px 9px",textAlign:"right",fontFamily:"'DM Mono',monospace",fontWeight:700,color:"var(--gr)"}}>{m.totalH}h</td>
              <td style={{padding:"8px 9px",textAlign:"right",fontFamily:"'DM Mono',monospace",fontWeight:m.overtimeH>0?700:400,color:m.overtimeH>0?"var(--ro)":"var(--tx3)"}}>{m.overtimeH>0?"+"+m.overtimeH+"h":"—"}</td>
              <td style={{padding:"8px 9px",textAlign:"right",color:m.lateDays>0?"var(--am)":"var(--tx3)",fontWeight:m.lateDays>0?700:400}}>{m.lateDays>0?m.lateDays+"日":"—"}</td>
              <td style={{padding:"8px 9px",textAlign:"right",color:m.earlyDays>0?"var(--am)":"var(--tx3)",fontWeight:m.earlyDays>0?700:400}}>{m.earlyDays>0?m.earlyDays+"日":"—"}</td>
              <td style={{padding:"8px 9px",textAlign:"right",color:m.noClockDays>0?"var(--ro)":"var(--tx3)",fontWeight:m.noClockDays>0?700:400}}>{m.noClockDays>0?m.noClockDays+"日":"—"}</td>
              <td style={{padding:"8px 9px"}}>
                <button onClick={()=>printPersonal(s.id)}
                  style={{fontSize:11,padding:"4px 9px",borderRadius:7,background:"rgba(58,160,216,0.1)",border:"1px solid rgba(58,160,216,0.4)",color:"var(--tl)",fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>
                  🖨
                </button>
              </td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      {/* 全体集計カード */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:8}}>
        {(()=>{
          const all=fStaff.map(s=>calcMonthSummary(s.id));
          return [
            {label:"総出勤日数",val:all.reduce((s,m)=>s+m.workDays,0)+"日",color:"var(--tl)"},
            {label:"総実働時間",val:Math.round(all.reduce((s,m)=>s+m.totalH,0)*10)/10+"h",color:"var(--gr)"},
            {label:"時間外合計",val:Math.round(all.reduce((s,m)=>s+m.overtimeH,0)*10)/10+"h",color:"var(--ro)"},
            {label:"遅刻延べ日数",val:all.reduce((s,m)=>s+m.lateDays,0)+"日",color:"var(--am)"},
            {label:"未打刻件数",val:all.reduce((s,m)=>s+m.noClockDays,0)+"件",color:"var(--ro)"},
          ].map(c=>(
            <div key={c.label} style={{background:"var(--bg2)",borderRadius:9,padding:"10px 12px",textAlign:"center"}}>
              <div style={{fontSize:18,fontWeight:900,color:c.color,fontFamily:"'DM Mono',monospace"}}>{c.val}</div>
              <div style={{fontSize:10,color:"var(--tx3)",marginTop:3}}>{c.label}</div>
            </div>
          ));
        })()}
      </div>
    </>}

    {/* ── 個人別実績タブ ── */}
    {tab==="personal"&&<>
      <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:12}}>
        {fStaff.map(s=>(
          <button key={s.id} onClick={()=>setSelStaffId(s.id)}
            style={{padding:"8px 14px",borderRadius:9,border:"2px solid",cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",fontSize:12,fontWeight:700,
              borderColor:(selStaffId||fStaff[0]?.id)===s.id?"var(--tl)":"var(--bd)",
              background:(selStaffId||fStaff[0]?.id)===s.id?"rgba(58,160,216,0.2)":"var(--bg)",
              color:(selStaffId||fStaff[0]?.id)===s.id?"var(--tl)":"var(--tx3)"}}>
            {s.name}
          </button>
        ))}
      </div>
      {selStaff&&(()=>{
        const m=calcMonthSummary(selStaff.id);
        return <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:12}}>
            {[{label:"出勤日数",val:m.workDays+"日",c:"var(--tl)"},{label:"実働時間",val:m.totalH+"h",c:"var(--gr)"},{label:"時間外",val:m.overtimeH>0?"+"+m.overtimeH+"h":"0h",c:m.overtimeH>0?"var(--ro)":"var(--tx3)"},{label:"未打刻",val:m.noClockDays+"日",c:m.noClockDays>0?"var(--ro)":"var(--tx3)"}].map(c=>(
              <div key={c.label} className="stat-card"><div className="stat-label">{c.label}</div><div className="stat-val" style={{color:c.c,fontSize:20}}>{c.val}</div></div>
            ))}
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:500}}>
              <thead><tr style={{background:"var(--bg2)"}}>
                {["日付","シフト","出勤打刻","退勤打刻","実働時間","時間外","備考"].map(h=>(
                  <th key={h} style={{padding:"7px 8px",textAlign:"center",color:"var(--tx2)",fontSize:10,fontWeight:700,borderBottom:"2px solid var(--bd)",whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{Array.from({length:days},(_,i)=>{
                const d=i+1;const date=mk(d);const dw=new Date(date).getDay();
                const r=calcDay(selStaff.id,date);
                const st=SHIFT_TYPES.find(x=>x.key===r.shiftKey);
                const rowBg=r.status==="公休"?"rgba(100,116,139,0.07)":r.status==="有給"?"rgba(144,72,216,0.07)":r.status==="未打刻"||r.status==="退勤未打刻"?"rgba(224,56,56,0.06)":"";
                return <tr key={d} style={{borderBottom:"1px solid var(--bd)",background:rowBg}}>
                  <td style={{padding:"6px 8px",textAlign:"center",fontWeight:700,color:dw===0?"var(--ro)":dw===6?"var(--tl)":"var(--tx)",fontFamily:"'DM Mono',monospace",fontSize:11}}>
                    {vm.m}/{d}（{dow[dw]}）
                  </td>
                  <td style={{padding:"6px 8px",textAlign:"center"}}>
                    {st?<span style={{fontSize:10,padding:"2px 7px",borderRadius:6,background:st.color,color:st.text,fontWeight:700}}>{st.label}</span>:<span style={{color:"var(--tx3)",fontSize:10}}>—</span>}
                  </td>
                  <td style={{padding:"6px 8px",textAlign:"center",fontFamily:"'DM Mono',monospace",color:r.lateMin>0?"var(--am)":"var(--tx)"}}>
                    {r.inTime||<span style={{color:"var(--tx3)"}}>—</span>}
                    {r.lateMin>0&&<span style={{fontSize:9,color:"var(--am)",marginLeft:3}}>+{r.lateMin}分</span>}
                  </td>
                  <td style={{padding:"6px 8px",textAlign:"center",fontFamily:"'DM Mono',monospace",color:r.earlyMin>0?"var(--am)":"var(--tx)"}}>
                    {r.outTime||<span style={{color:"var(--tx3)"}}>—</span>}
                    {r.earlyMin>0&&<span style={{fontSize:9,color:"var(--am)",marginLeft:3}}>-{r.earlyMin}分</span>}
                  </td>
                  <td style={{padding:"6px 8px",textAlign:"center",fontFamily:"'DM Mono',monospace",fontWeight:700,color:"var(--tl)"}}>
                    {r.workedH>0?r.workedH+"h":"—"}
                  </td>
                  <td style={{padding:"6px 8px",textAlign:"center",fontFamily:"'DM Mono',monospace",color:"var(--ro)",fontWeight:700}}>
                    {r.overtimeH>0?"+"+r.overtimeH+"h":"—"}
                  </td>
                  <td style={{padding:"6px 8px",textAlign:"center",fontSize:10}}>
                    {r.status==="公休"&&<span style={{color:"var(--tx3)"}}>公休</span>}
                    {r.status==="有給"&&<span style={{color:"var(--pu)",fontWeight:700}}>有給</span>}
                    {r.status==="未打刻"&&<span style={{color:"var(--ro)",fontWeight:700}}>未打刻</span>}
                    {r.status==="退勤未打刻"&&<span style={{color:"var(--am)",fontWeight:700}}>退勤未打刻</span>}
                  </td>
                </tr>;
              })}</tbody>
            </table>
          </div>
          <div style={{marginTop:10,display:"flex",justifyContent:"flex-end"}}>
            <button onClick={()=>printPersonal(selStaff.id)}
              style={{padding:"9px 18px",borderRadius:10,background:"linear-gradient(135deg,#1a4a8a,#2d6ed6)",color:"#fff",border:"none",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>
              🖨 勤怠台帳を印刷
            </button>
          </div>
        </>;
      })()}
    </>}

    {/* ── アラートタブ ── */}
    {tab==="alert"&&<>
      <div className="dash-title" style={{marginBottom:10}}>🚨 打刻アラート（{vm.y}年{vm.m}月）</div>
      {(()=>{
        const alerts=[];
        fStaff.forEach(s=>{
          for(let i=1;i<=days;i++){
            const date=mk(i);const r=calcDay(s.id,date);
            if(r.status==="未打刻") alerts.push({level:"danger",text:`${s.name}：${vm.m}/${i}（${dow[new Date(date).getDay()]}）出勤打刻なし（シフト: ${SHIFT_TYPES.find(x=>x.key===r.shiftKey)?.label||r.shiftKey}）`,staffId:s.id,date});
            else if(r.status==="退勤未打刻") alerts.push({level:"warn",text:`${s.name}：${vm.m}/${i}（${dow[new Date(date).getDay()]}）退勤打刻なし`,staffId:s.id,date});
            else if(r.lateMin>=10) alerts.push({level:"warn",text:`${s.name}：${vm.m}/${i}（${dow[new Date(date).getDay()]}）遅刻 ${r.lateMin}分`,staffId:s.id,date});
            else if(r.overtimeH>=1) alerts.push({level:"info",text:`${s.name}：${vm.m}/${i}（${dow[new Date(date).getDay()]}）残業 ${r.overtimeH}時間`,staffId:s.id,date});
          }
        });
        if(alerts.length===0) return <div style={{background:"rgba(44,170,96,0.1)",border:"1px solid rgba(44,170,96,0.4)",borderRadius:10,padding:"14px 16px",display:"flex",gap:10,alignItems:"center"}}>
          <span style={{fontSize:20}}>✅</span><span style={{fontWeight:700,color:"var(--gr)"}}>打刻アラートはありません</span>
        </div>;
        return <div>{alerts.map((a,i)=>(
          <div key={i} className={"alert-row alert-"+(a.level==="danger"?"danger":a.level==="warn"?"warn":"na")} style={{marginBottom:5}}>
            <span className="alert-icon">{a.level==="danger"?"🚨":a.level==="warn"?"⚠️":"ℹ️"}</span>
            <span className="alert-text" style={{color:a.level==="danger"?"var(--ro)":a.level==="warn"?"var(--am)":"var(--tl)"}}>{a.text}</span>
          </div>
        ))}</div>;
      })()}
    </>}
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
  // 一括登録モーダル用state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkUserId, setBulkUserId] = useState("");
  const [bulkDays, setBulkDays] = useState([]);
  const [bulkStatus, setBulkStatus] = useState("来所予定");
  const [bulkTo, setBulkTo] = useState(false);
  const [bulkFrom, setBulkFrom] = useState(false);

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
        {isMgr&&<button onClick={()=>{setBulkUserId(users.length>0?users[0].id:"");setBulkDays([]);setBulkStatus("来所予定");setBulkTo(false);setBulkFrom(false);setShowBulkModal(true);}} style={{marginLeft:"auto",padding:"7px 13px",borderRadius:16,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"var(--tl)",color:"#fff",border:"none",boxShadow:"var(--sh)"}}>📅 一括登録</button>}
        <button className="bexp" style={{background:"#fff8f0",borderColor:"var(--ac)",color:"var(--ac)"}} onClick={printSchedule}>🖨️ 印刷</button>
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

      {/* ==================== 一括登録モーダル ==================== */}
      {showBulkModal&&(()=>{
        const fw2 = new Date(vm.y, vm.m-1, 1).getDay();
        const toggleDay = (d) => setBulkDays(p=>p.includes(d)?p.filter(x=>x!==d):[...p,d]);
        const applyPattern = (pat) => {
          setBulkDays(dayList.filter(d=>{
            if(isWe(d)) return false;
            const dow=getDow(d);
            if(pat==="all") return true;
            if(pat==="mwf") return dow===1||dow===3||dow===5;
            if(pat==="tt")  return dow===2||dow===4;
            if(pat==="mon") return dow===1;
            if(pat==="tue") return dow===2;
            if(pat==="wed") return dow===3;
            if(pat==="thu") return dow===4;
            if(pat==="fri") return dow===5;
            return false;
          }));
        };
        const confirmBulk = () => {
          if(!bulkUserId||bulkDays.length===0) return;
          bulkDays.forEach(d=>setSchedule(bulkUserId,d,bulkStatus,bulkTo,bulkFrom));
          setShowBulkModal(false);
        };
        const patterns=[
          {k:"all",l:"毎日（平日）"},{k:"mwf",l:"月・水・金"},
          {k:"tt",l:"火・木"},{k:"mon",l:"毎週月"},
          {k:"tue",l:"毎週火"},{k:"wed",l:"毎週水"},
          {k:"thu",l:"毎週木"},{k:"fri",l:"毎週金"},
        ];
        return <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"flex-end"}} onClick={()=>setShowBulkModal(false)}>
          <div style={{background:"var(--wh)",borderRadius:"18px 18px 0 0",padding:"20px 16px 32px",width:"100%",maxHeight:"90vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>

            {/* ヘッダー */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontSize:15,fontWeight:900}}>📅 今月の利用日を一括登録</div>
              <button onClick={()=>setShowBulkModal(false)} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:"var(--tx3)"}}>×</button>
            </div>
            <div style={{fontSize:11,color:"var(--tx3)",marginBottom:14}}>{vm.y}年{vm.m}月 — カレンダーで来所日をまとめてチェックして登録できます</div>

            {/* ① 生徒選択 */}
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:700,color:"var(--tl)",letterSpacing:1,marginBottom:6}}>① 生徒を選択</div>
              <select value={bulkUserId} onChange={e=>setBulkUserId(e.target.value)} className="fi" style={{fontSize:13}}>
                <option value="">-- 生徒を選んでください --</option>
                {users.map(u=><option key={u.id} value={u.id}>{u.name}{selFac==="all"?" ("+FACILITIES.find(f=>f.id===u.facilityId)?.name+")":""}</option>)}
              </select>
            </div>

            {/* ② ステータス */}
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:700,color:"var(--tl)",letterSpacing:1,marginBottom:6}}>② 登録する状態</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {["来所予定","来所","欠席","休所"].map(s=>{
                  const v=SCHEDULE_STATUS[s];
                  return <button key={s} onClick={()=>setBulkStatus(s)} style={{padding:"7px 12px",borderRadius:9,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:bulkStatus===s?v.bg:"var(--bg)",color:bulkStatus===s?v.color:"var(--tx3)",border:"2px solid "+(bulkStatus===s?v.color:"var(--bd)")}}>
                    {v.label}
                  </button>;
                })}
              </div>
            </div>

            {/* ③ 日付選択 */}
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:700,color:"var(--tl)",letterSpacing:1,marginBottom:6}}>③ 日付を選択</div>
              {/* クイック選択 */}
              <div style={{fontSize:10,color:"var(--tx3)",marginBottom:5}}>クイック選択：</div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
                {patterns.map(p=>(
                  <button key={p.k} onClick={()=>applyPattern(p.k)} style={{padding:"5px 10px",borderRadius:14,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"var(--bg2)",color:"var(--tl)",border:"1.5px solid var(--tl)"}}>
                    {p.l}
                  </button>
                ))}
                <button onClick={()=>setBulkDays([])} style={{padding:"5px 10px",borderRadius:14,fontSize:11,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"var(--bg)",color:"var(--tx3)",border:"1.5px solid var(--bd)",fontWeight:700}}>
                  クリア
                </button>
              </div>
              {/* カレンダーグリッド */}
              <div style={{background:"var(--bg2)",borderRadius:12,padding:10}}>
                <div style={{textAlign:"center",fontSize:13,fontWeight:900,marginBottom:8}}>{vm.y}年 {vm.m}月</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:4}}>
                  {["日","月","火","水","木","金","土"].map((d,i)=>(
                    <div key={d} style={{textAlign:"center",fontSize:10,fontWeight:700,color:i===0?"var(--ro)":i===6?"var(--tl)":"var(--tx3)",padding:"2px 0"}}>{d}</div>
                  ))}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
                  {Array.from({length:fw2}).map((_,i)=><div key={"e"+i}/>)}
                  {dayList.map(d=>{
                    const we=isWe(d); const sel=bulkDays.includes(d); const dow=getDow(d);
                    const isTd=getDateStr(d)===todayISO();
                    return <div key={d} onClick={()=>!we&&toggleDay(d)} style={{
                      aspectRatio:"1",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                      borderRadius:7,border:"2px solid "+(sel?"var(--tl)":we?"transparent":"var(--bd)"),
                      background:sel?"rgba(58,160,216,0.25)":we?"rgba(0,0,0,0.04)":isTd?"rgba(58,160,216,0.08)":"var(--wh)",
                      cursor:we?"default":"pointer",opacity:we?0.35:1,
                      transition:"all .1s",
                    }}>
                      <span style={{fontSize:12,fontWeight:900,color:sel?"var(--tl)":dow===0?"var(--ro)":dow===6?"#2196F3":"var(--tx)"}}>{d}</span>
                      {sel&&<span style={{fontSize:7,color:"var(--tl)",lineHeight:1}}>✓</span>}
                    </div>;
                  })}
                </div>
              </div>
              <div style={{marginTop:8,fontSize:12,fontWeight:700,color:bulkDays.length>0?"var(--tl)":"var(--tx3)",textAlign:"center"}}>
                {bulkDays.length>0?`✅ ${bulkDays.length}日選択中`:"日付をタップして選択（土日は除外）"}
              </div>
            </div>

            {/* ④ 送迎 */}
            <div style={{marginBottom:18}}>
              <div style={{fontSize:11,fontWeight:700,color:"var(--tl)",letterSpacing:1,marginBottom:6}}>④ 送迎設定（任意）</div>
              <div style={{display:"flex",gap:10}}>
                <button onClick={()=>setBulkTo(!bulkTo)} style={{flex:1,padding:"9px",borderRadius:9,background:bulkTo?"rgba(58,160,216,0.2)":"var(--bg)",color:bulkTo?"var(--tl)":"var(--tx3)",border:"2px solid "+(bulkTo?"var(--tl)":"var(--bd)"),fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>🚌 迎（来所）</button>
                <button onClick={()=>setBulkFrom(!bulkFrom)} style={{flex:1,padding:"9px",borderRadius:9,background:bulkFrom?"rgba(44,170,96,0.2)":"var(--bg)",color:bulkFrom?"var(--gr)":"var(--tx3)",border:"2px solid "+(bulkFrom?"var(--gr)":"var(--bd)"),fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>🚌 送（帰り）</button>
              </div>
            </div>

            {/* 確定ボタン */}
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setShowBulkModal(false)} style={{flex:1,padding:"13px",borderRadius:10,border:"1.5px solid var(--bd)",background:"var(--bg)",fontFamily:"'Noto Sans JP',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer",color:"var(--tx)"}}>キャンセル</button>
              <button onClick={confirmBulk} disabled={!bulkUserId||bulkDays.length===0}
                style={{flex:2,padding:"13px",borderRadius:10,border:"none",fontFamily:"'Noto Sans JP',sans-serif",fontWeight:700,fontSize:13,
                  background:bulkUserId&&bulkDays.length>0?"var(--tl)":"var(--bd)",
                  color:"#fff",cursor:bulkUserId&&bulkDays.length>0?"pointer":"default"}}>
                {bulkDays.length>0&&bulkUserId?`✅ ${bulkDays.length}日分を一括登録する`:"生徒と日付を選んでください"}
              </button>
            </div>
          </div>
        </div>;
      })()}
    </div>
  );
}
// ==================== SIDEBAR ====================
function Sidebar({user,screen,onNav,onLogout,unreadCount,open,onClose,onChangeFacility}){
  const isMgr=user.role==="manager"||user.role==="admin";
  const fac=FACILITIES.find(f=>f.id===user.selectedFacilityId);
  const [facOpen,setFacOpen]=useState(false);
  const roleLabel={staff:"支援員",specialist:"専門職員",cdsm:"児発管責任者",manager:"管理者",part_qual:"パート(指導員)",part_noqual:"パート",consultant:"相談支援員",admin:"本部管理者"}[user.role]||user.role;

  // 現在の施設が保育所等訪問支援を持つか判定
  const facSvcTypes = getFacilityServiceTypes(user.selectedFacilityId||"f1");
  const hasVisitNav = facSvcTypes.some(s=>s.id==="hoikuvisit");

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
    ...(hasVisitNav?[{id:"visit",icon:"🚌",label:"保育所等訪問支援"}]:[]),
    {sec:"管理"},
    {id:"schedule",icon:"📅",label:"生徒予定表"},
    {id:"users",icon:"👤",label:"利用者管理"},
    {id:"shift",icon:"📆",label:"シフト管理"},
    {id:"kintai",icon:"⏱",label:"勤務実績"},
    {id:"paidleave",icon:"🌴",label:"有給管理"},
    ...(isMgr?[
      {sec:"管理者専用"},
      {id:"attendance",icon:"📋",label:"出欠管理"},
      {id:"transport",icon:"🚗",label:"送迎管理"},
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
        <div className="sb-logo-sub">{facSvcTypes.map(s=>s.short).join(" / ")} 管理システム</div>
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
        {/* Produce By バッジ */}
        <div style={{margin:"8px 12px 4px",display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"7px 10px"}}>
          <span style={{fontSize:9,color:"rgba(255,255,255,0.4)",letterSpacing:1,fontWeight:500,whiteSpace:"nowrap"}}>Produce By</span>
          <div style={{background:"#fff",borderRadius:6,padding:"2px 6px",display:"flex",alignItems:"center"}}>
            <img src="/bells-logo.jpg" alt="株式会社BELLSインターナショナル" style={{height:24,width:"auto",display:"block"}}/>
          </div>
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

  if(!user)return <><style>{CSS}</style><div className="app"><LoginScreen store={store} onLogin={u=>{
    try{localStorage.setItem('gogroup_user',JSON.stringify(u));}catch(e){}
    setUser(u);setScreen("home");
  }}/></div></>;

  const unreadCount=store.msgs.filter(m=>(user.role==="admin"||m.facilityId===user.selectedFacilityId)&&!m.read).length;

  const screenTitles={
    home:"ダッシュボード",clock_in:"職員 出勤打刻",clock_out:"職員 退勤打刻",
    user_arrive:"利用者 来所",user_depart:"利用者 退所",photo:"写真記録",
    service:"サービス提供記録",messages:"保護者連絡",schedule:"生徒予定表",
    daily:"業務日報",paidleave:"有給管理",users:"利用者管理",
    shift:"シフト管理",kintai:"勤務実績",attendance:"出欠管理",transport:"送迎管理",
    kokuho:"国保連請求",staffmgmt:"スタッフ管理",admin:"管理画面",audit:"監査モード",
    isp:"個別支援計画",visit:"保育所等訪問支援",
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
    case "kintai":return <WorkRecordScreen user={user} store={store} onBack={()=>setScreen("home")}/>;
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
    case "visit":return <VisitManagementScreen user={user} store={store} onBack={()=>setScreen("home")}/>;
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
