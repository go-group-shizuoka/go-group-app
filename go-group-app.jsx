import React, { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";

// ==================== SUPABASE CLIENT ====================
const SUPABASE_URL = "https://ctqnxvgfysoegxmpequa.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0cW54dmdmeXNvZWd4bXBlcXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2Nzg0NzEsImV4cCI6MjA5MDI1NDQ3MX0.5ghhbuG-SEaaunQIP_kY16ezAy265nxvPyDMjpLSkFE";

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
  { id: "a1", username: "home_staff", password: "pass", role: "staff", staffId: "s1", facilityId: "f1", displayName: "田中 美穂（GO HOME）" },
  { id: "a2", username: "room_staff", password: "pass", role: "staff", staffId: "s4", facilityId: "f2", displayName: "山田 太郎（GO ROOM）" },
  { id: "a3", username: "town1_staff", password: "pass", role: "staff", staffId: "s7", facilityId: "f3", displayName: "伊藤 誠（GO TOWN 1ST）" },
  { id: "a4", username: "town2_staff", password: "pass", role: "staff", staffId: "s10", facilityId: "f4", displayName: "渡辺 拓也（GO TOWN 2ND）" },
  { id: "a5", username: "home_mgr", password: "pass", role: "manager", staffId: "s3", facilityId: "f1", displayName: "鈴木 花子（GO HOME）" },
  { id: "a6", username: "room_mgr", password: "pass", role: "manager", staffId: "s6", facilityId: "f2", displayName: "林 直樹（GO ROOM）" },
  { id: "a7", username: "town1_mgr", password: "pass", role: "manager", staffId: "s9", facilityId: "f3", displayName: "小林 恵（GO TOWN 1ST）" },
  { id: "a8", username: "town2_mgr", password: "pass", role: "manager", staffId: "s12", facilityId: "f4", displayName: "松本 浩二（GO TOWN 2ND）" },
  { id: "a9", username: "admin", password: "pass", role: "admin", staffId: null, facilityId: null, displayName: "本部管理者" },
];
const ACTIVITY_TYPES = ["個別支援","集団療育","運動療育","言語療育","学習支援","リハビリ","外出支援","イベント","制作活動","その他"];
const SERVICE_ITEMS = ["着替え支援","排泄支援","食事支援","水分補給","服薬確認","健康観察","個別療育","集団活動","運動・体操","学習支援","創作活動","外出・散歩","コミュニケーション支援","その他"];
const MOODS = ["😄","🙂","😐","😔","😢"];
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
:root{--bg:#f0f2f5;--bg2:#e4e7ec;--wh:#ffffff;--tx:#1a1a2e;--tx2:#444466;--tx3:#8888aa;--ac:#d95a18;--ac2:#f06a28;--tl:#0080b8;--tl2:#009ad8;--gr:#1e9050;--gr2:#28b060;--am:#d08010;--ro:#c83028;--pu:#7030b8;--bd:#c8ccd8;--bda:#a8acc0;--sh:0 2px 8px rgba(0,0,0,0.09);--sh2:0 4px 18px rgba(0,0,0,0.14);}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Noto Sans JP',sans-serif;background:var(--bg);color:var(--tx);min-height:100vh;overflow-x:hidden;}
.app{min-height:100vh;background:var(--bg);}
.wrap{max-width:960px;margin:0 auto;padding:0 14px;}
.lw{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;background:linear-gradient(135deg,#1a3a6a 0%,#d95a18 100%);}
.lc{background:var(--wh);border-radius:16px;padding:38px 30px;width:100%;max-width:400px;box-shadow:0 8px 32px rgba(0,0,0,0.2);}
.brand{font-size:26px;font-weight:900;text-align:center;margin-bottom:4px;color:var(--ac);}
.brand span{color:var(--tl);}
.bsub{font-size:12px;color:var(--tx3);text-align:center;letter-spacing:1px;margin-bottom:26px;}
.fg{margin-bottom:16px;}
.fl{display:block;font-size:11px;font-weight:700;color:var(--tx2);letter-spacing:1px;margin-bottom:6px;}
.fi{width:100%;padding:11px 13px;background:var(--wh);border:1.5px solid var(--bd);border-radius:8px;color:var(--tx);font-family:'Noto Sans JP',sans-serif;font-size:14px;outline:none;transition:border-color .2s;}
.fi:focus{border-color:var(--tl);}
.fi::placeholder{color:var(--tx3);}
select.fi{appearance:none;cursor:pointer;}
select.fi option{background:var(--wh);color:var(--tx);}
.bpri{width:100%;padding:13px;background:var(--ac);border:none;border-radius:9px;color:var(--wh);font-family:'Noto Sans JP',sans-serif;font-size:15px;font-weight:700;cursor:pointer;transition:all .2s;}
.bpri:hover{background:var(--ac2);box-shadow:0 4px 14px rgba(217,90,24,0.35);}
.err{color:var(--ro);font-size:13px;text-align:center;margin-top:10px;}
.hint{font-size:11px;color:var(--tx3);text-align:center;margin-top:14px;line-height:1.7;}
.nav{background:var(--ac);padding:0 18px;display:flex;align-items:center;justify-content:space-between;height:52px;position:sticky;top:0;z-index:100;box-shadow:0 2px 6px rgba(0,0,0,0.18);}
.nbrand{font-size:18px;font-weight:900;color:var(--wh);}
.nbrand span{color:#ffe0c0;}
.nr{display:flex;align-items:center;gap:10px;}
.nu{font-size:12px;color:rgba(255,255,255,0.88);}
.nu strong{color:var(--wh);}
.rbadge{margin-left:5px;font-size:10px;padding:2px 7px;border-radius:10px;background:rgba(255,255,255,0.22);color:var(--wh);font-weight:700;}
.blg{padding:6px 12px;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.35);border-radius:7px;color:var(--wh);font-size:12px;font-weight:700;cursor:pointer;font-family:'Noto Sans JP',sans-serif;}
.hh{padding:18px 14px 12px;background:linear-gradient(135deg,#1a3a6a,#d95a18);color:var(--wh);}
.ht{font-size:11px;color:rgba(255,255,255,0.75);letter-spacing:2px;font-weight:700;margin-bottom:4px;}
.hs{font-size:22px;font-weight:900;}
.hd{font-size:11px;color:rgba(255,255,255,0.7);margin-top:4px;font-family:'DM Mono',monospace;}
.hg{display:grid;grid-template-columns:repeat(2,1fr);gap:9px;padding:12px 0 22px;}
.hc{background:var(--wh);border:1px solid var(--bd);border-radius:11px;padding:15px 12px;cursor:pointer;transition:all .18s;position:relative;overflow:hidden;display:flex;flex-direction:column;gap:6px;box-shadow:var(--sh);}
.hc:hover{transform:translateY(-2px);box-shadow:var(--sh2);border-color:var(--tl);}
.hc::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;}
.c1::before{background:var(--tl);}
.c2::before{background:var(--am);}
.c3::before{background:var(--gr);}
.c4::before{background:#4488bb;}
.c5::before{background:var(--pu);}
.c6::before{background:var(--ro);}
.c7::before{background:var(--tl2);}
.c8::before{background:var(--gr2);}
.c9::before{background:var(--ac);}
.c10::before{background:var(--pu);}
.ci{font-size:24px;}
.ct{font-size:13px;font-weight:700;color:var(--tx);}
.cd2{font-size:10px;color:var(--tx3);line-height:1.4;}
.fl-wrap{padding:14px 0 30px;}
.fl-hd{display:flex;align-items:center;gap:10px;margin-bottom:16px;}
.bback{padding:6px 12px;background:var(--wh);border:1.5px solid var(--bd);border-radius:7px;color:var(--tx2);font-size:12px;cursor:pointer;font-family:'Noto Sans JP',sans-serif;box-shadow:var(--sh);}
.bback:hover{border-color:var(--tl);color:var(--tl);}
.fl-title{font-size:18px;font-weight:900;color:var(--tx);}
.fc{background:var(--wh);border:1px solid var(--bd);border-radius:12px;padding:18px 16px;box-shadow:var(--sh);}
.slbl{font-size:10px;font-weight:700;color:var(--tl);letter-spacing:2px;margin-bottom:9px;}
.div{border:none;border-top:1.5px solid var(--bg2);margin:16px 0;}
.ng{display:grid;grid-template-columns:repeat(auto-fill,minmax(115px,1fr));gap:7px;}
.nb{padding:9px 8px;background:var(--bg);border:1.5px solid var(--bd);border-radius:8px;color:var(--tx2);font-family:'Noto Sans JP',sans-serif;font-size:12px;font-weight:500;cursor:pointer;transition:all .15s;text-align:center;}
.nb:hover{border-color:var(--tl);background:var(--wh);}
.nb.s{border-color:var(--tl);background:#daeef8;color:var(--tl);font-weight:700;}
.cam{width:100%;max-width:240px;aspect-ratio:4/3;background:var(--bg);border:2px dashed var(--bda);border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:all .2s;margin:0 auto;gap:6px;}
.cam.cp{border-style:solid;border-color:var(--tl);background:#daeef8;}
.ci2{font-size:32px;}
.ct2{font-size:11px;color:var(--tx3);}
.tr{display:flex;align-items:center;gap:10px;}
.ti{width:108px;padding:10px 11px;background:var(--wh);border:1.5px solid var(--bd);border-radius:8px;color:var(--tx);font-family:'DM Mono',monospace;font-size:18px;font-weight:500;outline:none;text-align:center;}
.ti:focus{border-color:var(--tl);}
.tunit{font-size:14px;color:var(--tx3);}
.togr{display:flex;gap:7px;flex-wrap:wrap;}
.tg{padding:8px 16px;background:var(--bg);border:1.5px solid var(--bd);border-radius:8px;color:var(--tx2);font-family:'Noto Sans JP',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all .15s;}
.tg.on{border-color:var(--gr);background:#d8f0e4;color:var(--gr);font-weight:700;}
.fta{width:100%;padding:10px 12px;background:var(--wh);border:1.5px solid var(--bd);border-radius:8px;color:var(--tx);font-family:'Noto Sans JP',sans-serif;font-size:13px;resize:vertical;min-height:64px;outline:none;}
.fta:focus{border-color:var(--tl);}
.bsave{width:100%;padding:13px;background:var(--ac);border:none;border-radius:10px;color:var(--wh);font-family:'Noto Sans JP',sans-serif;font-size:14px;font-weight:900;cursor:pointer;transition:all .2s;margin-top:6px;}
.bsave:hover{background:var(--ac2);box-shadow:0 4px 12px rgba(217,90,24,0.3);}
.bsave:disabled{background:var(--bda);cursor:not-allowed;}
.succ{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:55vh;gap:12px;text-align:center;padding:20px;}
.si{font-size:54px;}
.st{font-size:20px;font-weight:900;color:var(--tl);}
.sd{color:var(--tx3);font-size:13px;line-height:1.7;}
.sm{font-family:'DM Mono',monospace;font-size:14px;color:var(--gr);}
.ah{padding:16px 14px 8px;}
.at{font-size:18px;font-weight:900;margin-bottom:3px;color:var(--tx);}
.as{font-size:12px;color:var(--tx3);}
.sr2{display:flex;gap:8px;padding:0 0 12px;flex-wrap:wrap;}
.sc2{background:var(--wh);border:1px solid var(--bd);border-radius:10px;padding:11px 14px;flex:1;min-width:82px;box-shadow:var(--sh);}
.sn{font-size:22px;font-weight:900;font-family:'DM Mono',monospace;}
.sl{font-size:10px;color:var(--tx3);margin-top:2px;letter-spacing:1px;}
.tabs{display:flex;gap:5px;overflow-x:auto;padding:0 0 10px;scrollbar-width:none;}
.tabs::-webkit-scrollbar{display:none;}
.tab{padding:5px 13px;border-radius:16px;white-space:nowrap;background:var(--bg);border:1.5px solid var(--bd);color:var(--tx3);font-size:12px;font-weight:700;cursor:pointer;transition:all .2s;font-family:'Noto Sans JP',sans-serif;}
.tab.on{background:var(--tl);border-color:var(--tl);color:var(--wh);}
.frow{display:flex;gap:7px;flex-wrap:wrap;padding:0 0 9px;}
.fsm{padding:6px 10px;background:var(--wh);border:1.5px solid var(--bd);border-radius:7px;color:var(--tx);font-family:'Noto Sans JP',sans-serif;font-size:12px;outline:none;}
.fsm:focus{border-color:var(--tl);}
.fsm option{background:var(--wh);color:var(--tx);}
.ebar{display:flex;gap:7px;flex-wrap:wrap;padding:0 0 10px;}
.bexp{padding:7px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Noto Sans JP',sans-serif;border:1.5px solid var(--tl);background:var(--wh);color:var(--tl);}
.bexp:hover{background:#daeef8;}
.tw{overflow-x:auto;padding:0 0 16px;}
.tbl{width:100%;border-collapse:collapse;font-size:12px;}
.tbl th{padding:8px 9px;text-align:left;background:#e4e8f0;color:var(--tx2);font-size:10px;font-weight:700;letter-spacing:1px;border-bottom:2px solid var(--bd);white-space:nowrap;}
.tbl td{padding:9px 9px;border-bottom:1px solid var(--bg2);color:var(--tx);vertical-align:middle;white-space:nowrap;}
.tbl tr:hover td{background:#eef4fa;}
.badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700;}
.bg{background:#d0eedd;color:#186838;border:1px solid #98d8b0;}
.ba{background:#fce8c8;color:#a06010;border:1px solid #e8b870;}
.bb{background:#cce6f5;color:#006090;border:1px solid #88c4e8;}
.br{background:#fad4d0;color:#a02818;border:1px solid #e89888;}
.bp{background:#e8d4f4;color:#5820a0;border:1px solid #c088d8;}
.bedit{padding:4px 9px;border-radius:5px;font-size:11px;font-weight:700;cursor:pointer;font-family:'Noto Sans JP',sans-serif;background:#daeef8;border:1.5px solid var(--tl);color:var(--tl);}
.ov{position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:200;display:flex;align-items:center;justify-content:center;padding:18px;overflow-y:auto;}
.md{background:var(--wh);border-radius:14px;padding:22px;width:100%;max-width:500px;box-shadow:0 8px 36px rgba(0,0,0,0.22);}
.mdtit{font-size:15px;font-weight:900;margin-bottom:14px;color:var(--tx);}
.mda{display:flex;gap:9px;justify-content:flex-end;margin-top:16px;}
.bcancel{padding:8px 16px;border-radius:8px;background:var(--bg);border:1.5px solid var(--bd);color:var(--tx2);font-size:13px;font-weight:700;cursor:pointer;font-family:'Noto Sans JP',sans-serif;}
.bconf{padding:8px 16px;border-radius:8px;background:var(--tl);border:none;color:var(--wh);font-size:13px;font-weight:700;cursor:pointer;font-family:'Noto Sans JP',sans-serif;}
.bconf:disabled{background:var(--bda);cursor:not-allowed;}
.ch{display:flex;align-items:center;justify-content:space-between;margin-bottom:11px;}
.cm{font-size:15px;font-weight:900;color:var(--tx);}
.cn{padding:5px 11px;background:var(--wh);border:1.5px solid var(--bd);border-radius:7px;color:var(--tx2);cursor:pointer;font-size:14px;}
.cn:hover{border-color:var(--tl);}
.cgrid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:12px;}
.cdow{text-align:center;font-size:10px;font-weight:700;color:var(--tx3);padding:3px 0;}
.cdow.su{color:var(--ro);}
.cdow.sa{color:var(--tl);}
.cday{aspect-ratio:1;border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;background:var(--wh);border:1.5px solid var(--bd);font-size:11px;transition:all .15s;gap:2px;color:var(--tx);}
.cday:hover{border-color:var(--tl);background:#daeef8;}
.cday.td{border-color:var(--tl);background:#cce6f5;font-weight:700;}
.cday.sel{border-color:var(--ac);background:#fce4d8;font-weight:700;}
.cday.we{background:var(--bg2);border-color:var(--bg2);opacity:.75;cursor:default;}
.cday.emp{background:transparent;border-color:transparent;cursor:default;}
.dot{width:5px;height:5px;border-radius:50%;}
.dg{background:var(--gr);}
.da{background:var(--am);}
.dr{background:var(--ro);}
.dots{display:flex;gap:2px;}
.panel{background:var(--wh);border:1px solid var(--bd);border-radius:12px;padding:14px;box-shadow:var(--sh);}
.ptit{font-size:10px;font-weight:700;color:var(--tl);letter-spacing:2px;margin-bottom:9px;}
.urow{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--bg2);}
.urow:last-child{border-bottom:none;}
.un{font-size:13px;font-weight:600;color:var(--tx);}
.chips{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:11px;}
.chip{padding:4px 11px;border-radius:12px;font-size:11px;font-weight:700;}
.cg{background:#d0eedd;color:#186838;border:1px solid #98d8b0;}
.cr{background:#fad4d0;color:#a02818;border:1px solid #e89888;}
.cb2{background:#cce6f5;color:#006090;border:1px solid #88c4e8;}
.cw{background:var(--bg);color:var(--tx3);border:1px solid var(--bd);}
.sbtn{padding:3px 9px;border-radius:12px;font-size:11px;font-weight:700;cursor:pointer;border:1.5px solid transparent;transition:all .15s;font-family:'Noto Sans JP',sans-serif;}
.sp{background:#d0eedd;border-color:#98d8b0;color:#186838;}
.sab{background:#fad4d0;border-color:#e89888;color:#a02818;}
.sc{background:#cce6f5;border-color:#88c4e8;color:#006090;}
.sn2{background:var(--bg);border-color:var(--bd);color:var(--tx3);}
.sto{overflow-x:auto;border-radius:10px;border:1px solid var(--bd);background:var(--wh);box-shadow:var(--sh);}
.stbl{border-collapse:collapse;font-size:11px;min-width:100%;}
.stbl th{padding:7px 5px;background:#e4e8f0;color:var(--tx2);font-size:9px;font-weight:700;white-space:nowrap;text-align:center;border-bottom:2px solid var(--bd);}
.stbl th.nh{text-align:left;padding-left:11px;position:sticky;left:0;z-index:2;background:#e4e8f0;}
.stbl td{padding:3px 2px;border-bottom:1px solid var(--bg2);text-align:center;vertical-align:middle;}
.stbl td.nc{text-align:left;padding-left:11px;font-weight:700;font-size:12px;white-space:nowrap;position:sticky;left:0;background:var(--wh);border-right:1px solid var(--bd);color:var(--tx);}
.stbl tr:hover td{background:#f0f5fa;}
.scell{width:30px;height:26px;border-radius:4px;font-size:8px;font-weight:700;cursor:pointer;border:1.5px solid transparent;display:flex;align-items:center;justify-content:center;margin:0 auto;transition:all .12s;}
.scell:hover{transform:scale(1.12);}
.scA{background:#cce6f5;color:#006090;border-color:#88c4e8;}
.scB{background:#d0eedd;color:#186838;border-color:#98d8b0;}
.scC{background:#fce8c8;color:#a06010;border-color:#e8b870;}
.scoff{background:var(--bg);color:var(--tx3);}
.schol{background:#e8d4f4;color:#5820a0;border-color:#c088d8;} .scP1{background:#ffe4e8;color:#e75480;border-color:#ffb6c1;} .scP2{background:#ffe8e0;color:#e8734a;border-color:#ffa07a;} .scP3{background:#e0f0ff;color:#4682b4;border-color:#add8e6;}
.scnone{background:var(--bg2);color:var(--bda);}
.sleg{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:11px;}
.leg{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--tx2);}
.ld{width:9px;height:9px;border-radius:3px;}
.ssum2{display:flex;gap:8px;margin-bottom:11px;flex-wrap:wrap;}
.ss{background:var(--wh);border:1px solid var(--bd);border-radius:8px;padding:8px 12px;min-width:76px;box-shadow:var(--sh);}
.ssn{font-size:18px;font-weight:900;font-family:'DM Mono',monospace;}
.ssl{font-size:10px;color:var(--tx3);margin-top:2px;}
.sogrid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:10px;}
.soBtn{padding:10px 5px;border-radius:9px;font-size:12px;font-weight:700;cursor:pointer;border:1.5px solid var(--bd);background:var(--bg);color:var(--tx2);font-family:'Noto Sans JP',sans-serif;text-align:center;transition:all .15s;}
.soBtn:hover{border-color:var(--tl);background:#daeef8;}
.src{background:var(--wh);border:1px solid var(--bd);border-radius:11px;padding:13px;margin-bottom:8px;cursor:pointer;transition:all .15s;box-shadow:var(--sh);}
.src:hover{border-color:var(--tl);box-shadow:var(--sh2);}
.srh{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:7px;}
.srn{font-size:14px;font-weight:700;color:var(--tx);}
.srd{font-size:10px;color:var(--tx3);font-family:'DM Mono',monospace;}
.srtags{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;}
.srtag{padding:2px 8px;border-radius:9px;font-size:10px;font-weight:700;background:#cce6f5;color:#006090;border:1px solid #88c4e8;}
.srb{font-size:12px;color:var(--tx2);line-height:1.5;}
.srf{font-size:10px;color:var(--tx3);margin-top:5px;}
.cbg{display:flex;flex-wrap:wrap;gap:6px;}
.cb{padding:6px 11px;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;border:1.5px solid var(--bd);background:var(--bg);color:var(--tx2);font-family:'Noto Sans JP',sans-serif;transition:all .15s;}
.cb.on{background:#cce6f5;border-color:var(--tl);color:var(--tl);}
.mr{display:flex;gap:7px;}
.mbtn{width:40px;height:40px;border-radius:50%;font-size:19px;cursor:pointer;border:2px solid var(--bd);background:var(--bg);display:flex;align-items:center;justify-content:center;transition:all .15s;}
.mbtn.on{border-color:var(--am);background:#fce8c8;transform:scale(1.15);}
.spbadge{font-size:10px;padding:2px 6px;border-radius:7px;background:#fad4d0;color:#a02818;border:1px solid #e89888;font-weight:700;white-space:nowrap;}
.trc{background:var(--wh);border:1px solid var(--bd);border-radius:10px;padding:13px;margin-bottom:7px;box-shadow:var(--sh);}
.trh2{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px;}
.trn{font-size:13px;font-weight:700;color:var(--tx);}
.tra{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px;}
.trb{padding:4px 11px;border-radius:12px;font-size:11px;font-weight:700;cursor:pointer;border:1.5px solid transparent;font-family:'Noto Sans JP',sans-serif;transition:all .15s;}
.trcar{background:#cce6f5;border-color:#88c4e8;color:#006090;}
.trwalk{background:#d0eedd;border-color:#98d8b0;color:#186838;}
.trnone{background:var(--bg);border-color:var(--bd);color:var(--tx3);}
.mc{background:var(--wh);border:1px solid var(--bd);border-radius:10px;padding:13px;margin-bottom:7px;cursor:pointer;transition:all .15s;box-shadow:var(--sh);}
.mc:hover{border-color:var(--tl);box-shadow:var(--sh2);}
.mc.unr{border-color:var(--tl);border-left:4px solid var(--tl);background:#eef6fc;}
.mh{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:5px;}
.mfrom{font-size:13px;font-weight:700;color:var(--tx);}
.mtime{font-size:10px;color:var(--tx3);font-family:'DM Mono',monospace;}
.mbody{font-size:12px;color:var(--tx2);line-height:1.5;}
.udot{width:7px;height:7px;border-radius:50%;background:var(--tl);flex-shrink:0;margin-top:3px;}
.bnew{padding:7px 15px;background:var(--tl);border:none;border-radius:8px;color:var(--wh);font-size:12px;font-weight:700;cursor:pointer;font-family:'Noto Sans JP',sans-serif;}
.bsend{padding:9px 18px;background:var(--tl);border:none;border-radius:9px;color:var(--wh);font-size:13px;font-weight:700;cursor:pointer;font-family:'Noto Sans JP',sans-serif;white-space:nowrap;}
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
.kk-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--bg2);}
.kk-row:last-child{border-bottom:none;}
.kk-label{font-size:12px;color:var(--tx2);}
.kk-val{font-size:13px;font-weight:700;font-family:'DM Mono',monospace;color:var(--tl);}
.kk-total{background:linear-gradient(135deg,#1a3a6a,#1e6e40);border-radius:10px;padding:14px;}
.kk-total-label{font-size:11px;color:rgba(255,255,255,0.75);letter-spacing:1px;}
.kk-total-val{font-size:28px;font-weight:900;font-family:'DM Mono',monospace;color:var(--wh);margin-top:3px;}
.mt-card{background:var(--wh);border:1px solid var(--bd);border-radius:10px;padding:14px;margin-bottom:8px;box-shadow:var(--sh);}
.mt-name{font-size:14px;font-weight:700;margin-bottom:9px;color:var(--tx);}
.mt-row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--bg2);font-size:12px;}
.mt-row:last-child{border-bottom:none;}
.mt-key{color:var(--tx3);}
.mt-val{font-weight:700;font-family:'DM Mono',monospace;color:var(--tx);}
.photo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(135px,1fr));gap:10px;margin-bottom:14px;}
.photo-item{background:var(--wh);border:1px solid var(--bd);border-radius:10px;padding:10px;cursor:pointer;transition:all .15s;box-shadow:var(--sh);}
.photo-item:hover{border-color:var(--tl);box-shadow:var(--sh2);}
.photo-thumb{width:100%;aspect-ratio:4/3;background:#daeef8;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:26px;margin-bottom:7px;}
.photo-user{font-size:12px;font-weight:700;color:var(--tx);}
.photo-act{font-size:10px;color:var(--tl);margin-top:2px;}
.photo-time{font-size:10px;color:var(--tx3);}
@media(max-width:520px){.hg{gap:8px;}.hc{padding:12px 10px;}.ct{font-size:12px;}.lc{padding:26px 16px;}.ng{grid-template-columns:repeat(auto-fill,minmax(94px,1fr));}}
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
      if(msgs && msgs.length > 0) setMsgs(msgs.map(m => ({...m, ...(m.data||{})})));
      if(reports && reports.length > 0) setDailyReports(reports.map(r => r.data||r));
      if(users && users.length > 0) setDynUsers(p => {
        const sbIds = users.map(u => u.id);
        const existing = p.filter(u => !sbIds.includes(u.id));
        return [...existing, ...users.map(u => u.data||u)];
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
  const setShift = (sid,date,type) => setShifts(p=>({...p,[sid]:{...(p[sid]||{}),[date]:type}}));
  const getShift = (sid,date) => shifts[sid]?.[date]||"none";
  const setAtt = (uid,date,status) => setAtt2(p=>({...p,[uid]:{...(p[uid]||{}),[date]:status}}));
  const getAtt = (uid,date) => att[uid]?.[date]||"未定";
  const addMsg = m => {
    setMsgs(p=>[...p,m]);
    sbSave("messages", {id: m.id, user_id: m.userId, user_name: m.userName,
      facility_id: m.facilityId, from_name: m.from, body: m.body,
      time: m.time, read: m.read, replies: m.replies, data: m});
  };
  const replyMsg = (id,txt) => setMsgs(p=>p.map(m=>m.id===id?{...m,replies:[...m.replies,txt],read:true}:m));
  const markRead = id => setMsgs(p=>p.map(m=>m.id===id?{...m,read:true}:m));
  const updTr = data => setTrData(data);
  const addIsp = isp => setIsps(p=>[...p,isp]);
  const updIsp = (id,ch) => setIsps(p=>p.map(x=>x.id===id?{...x,...ch}:x));
  const updKokuho = (id,ch) => setKokuho(p=>p.map(x=>x.id===id?{...x,...ch}:x));

  const [dynUsers, setDynUsers] = useState(INITIAL_USERS);
  const [dynStaff, setDynStaff] = useState(INITIAL_STAFF);
  const [dailyReports, setDailyReports] = useState([]);
  const saveFS = fs => setFacesheets(p=>[...p.filter(x=>x.userId!==fs.userId),fs]);
  const addAssessment = a => setAssessments(p=>[...p,a]);
  const addMonitoring = m => setMonitorings(p=>[...p,m]);

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
  const addQualDoc = d => setQualDocs(p=>[...p,d]);
  const updQualDoc = (id,ch) => setQualDocs(p=>p.map(d=>d.id===id?{...d,...ch}:d));
  const delQualDoc = id => setQualDocs(p=>p.filter(d=>d.id!==id));
  const delStaff = id => setDynStaff(p=>p.filter(s=>s.id!==id));
  const delUser = id => setDynUsers(p=>p.filter(u=>u.id!==id));
  const [paidLeaveReqs, setPaidLeaveReqs] = useState([]);
  const addPaidLeaveReq = r => setPaidLeaveReqs(p=>[...p,r]);const [scheduleData, setScheduleData] = useState({});
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
  
  const updPaidLeaveReq = (id,ch) => setPaidLeaveReqs(p=>p.map(r=>r.id===id?{...r,...ch}:r));
  // 起動時にSupabaseからデータ読み込み
  useEffect(() => {
    loadFromSupabase(setRecs, setMsgs, setDailyReports, setDynUsers, setDynStaff);
    loadSchedules();

    
  }, []);
  return {recs,addRec,updRec,hist,shifts,setShift,getShift,att,setAtt,getAtt,msgs,addMsg,replyMsg,markRead,trData,updTr,isps,addIsp,updIsp,kokuho,updKokuho,facesheets,saveFS,assessments,addAssessment,monitorings,addMonitoring,dailyReports,addDailyReport,dynUsers,addUser,updUser2,delUser,dynStaff,addStaff,updStaff2,delStaff,paidLeaveReqs,addPaidLeaveReq,updPaidLeaveReq,qualDocs,addQualDoc,updQualDoc,delQualDoc};
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
              style={{padding:"5px 10px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'DM Mono',monospace",border:"1.5px solid",borderColor:value===t?"var(--tl)":"var(--bd)",background:value===t?"#cce6f5":"var(--bg)",color:value===t?"var(--tl)":"var(--tx2)"}}>
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
    <div className="fg"><label className="fl">スタッフID</label><input className="fi" placeholder="home_staff / home_mgr / admin" value={un} onChange={e=>{setUn(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&go()}/></div>
    <div className="fg"><label className="fl">パスワード</label><input className="fi" type="password" placeholder="pass" value={pw} onChange={e=>{setPw(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&go()}/></div>
    {un==="admin"&&<div className="fg"><label className="fl">操作する施設</label><select className="fi" value={fac} onChange={e=>setFac(e.target.value)}>{FACILITIES.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></div>}
    <button className="bpri" onClick={go}>ログイン</button>
    {err&&<p className="err">{err}</p>}
    <p className="hint">デモID: home_staff / home_mgr / admin　パスワード: pass</p>
  </div></div>;
}

// ==================== CLOCK IN/OUT ====================
function StaffClockIn({user,onBack,store}){
  const [sel,setSel]=useState(null);const [cap,setCap]=useState(false);const [temp,setTemp]=useState("");const [note,setNote]=useState("");const [time,setTime]=useState(nowHM());const [done,setDone]=useState(false);const [saved,setSaved]=useState("");
  const staff=store.dynStaff.filter(s=>s.facilityId===user.selectedFacilityId&&s.active!==false);const fac=FACILITIES.find(f=>f.id===user.selectedFacilityId);
  const save=()=>{const t=buildDT(time);store.addRec({id:genId(),type:"staff_in",staffId:sel.id,staffName:sel.name,facilityId:user.selectedFacilityId,facilityName:fac?.name,time:t,temp,photo:true,note,createdBy:user.displayName,history:[]});setSaved(t);setDone(true);};
  if(done)return <div className="succ"><div className="si">🎉</div><div className="st">出勤登録完了</div><div className="sd">{sel?.name} さんの出勤を記録しました<br/>体温: {temp}℃</div><div className="sm">{saved}</div><button className="bpri" style={{maxWidth:200,marginTop:8}} onClick={onBack}>ホームに戻る</button></div>;
  return <FlowWrap title="🟢 職員 出勤" onBack={onBack}>
    <div className="slbl">STEP 1 — 職員を選択</div><div className="ng">{staff.map(s=><button key={s.id} className={`nb ${sel?.id===s.id?"s":""}`} onClick={()=>setSel(s)}>{s.name}</button>)}</div>
    <hr className="div"/><div className="slbl">STEP 2 — 出勤時刻</div><div className="tr"><TimePicker value={time} onChange={setTime} label="出勤時刻"/><span className="tunit" style={{fontSize:11,marginLeft:8}}>※自動入力</span></div>
    <hr className="div"/><div className="slbl">STEP 3 — 写真撮影</div><Cam cap={cap} onCap={()=>setCap(!cap)}/>
    <hr className="div"/><div className="slbl">STEP 4 — 体温</div><div className="tr"><input className="ti" type="number" placeholder="36.5" step="0.1" min="35" max="42" value={temp} onChange={e=>setTemp(e.target.value)}/><span className="tunit">℃</span></div>
    <hr className="div"/><div className="slbl">備考（任意）</div><textarea className="fta" value={note} onChange={e=>setNote(e.target.value)}/>
    <button className="bsave" disabled={!sel||!cap||!temp||!time} onClick={save} style={{marginTop:14}}>保存する</button>
  </FlowWrap>;
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
    <button className="bsave" disabled={!sel||!cap||!time} onClick={save} style={{marginTop:14}}>保存する</button>
  </FlowWrap>;
}
function UserArrive({user,onBack,store}){
  const [sel,setSel]=useState(null);const [cap,setCap]=useState(false);const [temp,setTemp]=useState("");const [tr,setTr]=useState("あり");const [note,setNote]=useState("");const [time,setTime]=useState(nowHM());const [done,setDone]=useState(false);const [saved,setSaved]=useState("");const [dayType,setDayType]=useState("放課後");
  const users=store.dynUsers.filter(u=>u.facilityId===user.selectedFacilityId&&u.active!==false);const fac=FACILITIES.find(f=>f.id===user.selectedFacilityId);
  const save=()=>{const t=buildDT(time);store.addRec({id:genId(),type:"user_in",userId:sel.id,userName:sel.name,facilityId:user.selectedFacilityId,facilityName:fac?.name,time:t,temp,transport:tr,dayType,photo:true,note,createdBy:user.displayName,history:[]});setSaved(t);setDone(true);};
  if(done)return <div className="succ"><div className="si">🌟</div><div className="st">来所登録完了</div><div className="sd">{sel?.name} さんの来所を記録しました<br/>体温: {temp}℃　送迎: {tr}　区分: {dayType}</div><div className="sm">{saved}</div><button className="bpri" style={{maxWidth:200,marginTop:8}} onClick={onBack}>ホームに戻る</button></div>;
  return <FlowWrap title="🌟 利用者 来所" onBack={onBack}>
    <div className="slbl">STEP 1 — 利用者を選択</div><div className="ng">{users.map(u=><button key={u.id} className={`nb ${sel?.id===u.id?"s":""}`} onClick={()=>setSel(u)}>{u.name}</button>)}</div>
    <hr className="div"/><div className="slbl">STEP 2 — 日区分</div>
    <div className="togr">{["放課後","休日"].map(v=><button key={v} className={`tg ${dayType===v?"on":""}`} onClick={()=>setDayType(v)}>{v==="休日"?"🎌 休日":"🏫 放課後"}</button>)}</div>
    <hr className="div"/><div className="slbl">STEP 3 — 来所時刻</div><div className="tr"><TimePicker value={time} onChange={setTime} label="来所時刻"/></div>
    <hr className="div"/><div className="slbl">STEP 4 — 写真撮影</div><Cam cap={cap} onCap={()=>setCap(!cap)}/>
    <hr className="div"/><div className="slbl">STEP 5 — 体温</div><div className="tr"><input className="ti" type="number" placeholder="36.5" step="0.1" min="35" max="42" value={temp} onChange={e=>setTemp(e.target.value)}/><span className="tunit">℃</span></div>
    <hr className="div"/><div className="slbl">STEP 6 — 送迎</div><div className="togr">{["あり","なし"].map(v=><button key={v} className={`tg ${tr===v?"on":""}`} onClick={()=>setTr(v)}>送迎{v}</button>)}</div>
    <hr className="div"/><div className="slbl">備考（任意）</div><textarea className="fta" value={note} onChange={e=>setNote(e.target.value)}/>
    <button className="bsave" disabled={!sel||!cap||!temp||!time} onClick={save} style={{marginTop:14}}>保存する</button>
  </FlowWrap>;
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
    <hr className="div"/><div className="slbl">STEP 3 — 写真撮影</div><Cam cap={cap} onCap={()=>setCap(!cap)}/>
    <hr className="div"/><div className="slbl">コメント（任意）</div><textarea className="fta" placeholder="活動の様子を記入..." value={cmt} onChange={e=>setCmt(e.target.value)}/>
    <button className="bsave" disabled={!sel||!act||!cap} onClick={save} style={{marginTop:14}}>保存する</button>
  </FlowWrap>;
  return <div className="fl-wrap"><div className="fl-hd"><button className="bback" onClick={onBack}>← 戻る</button><div className="fl-title">📸 写真ギャラリー</div></div>
    <div style={{paddingBottom:8,marginBottom:12}}><button className="bsave" onClick={()=>setMode("new")} style={{maxWidth:200}}>＋ 写真を撮影・記録</button></div>
    {photos.length===0?<div style={{textAlign:"center",color:"var(--g6)",padding:"36px 0"}}>写真記録がありません</div>
    :<div className="photo-grid">{photos.map(r=><div key={r.id} className="photo-item"><div className="photo-thumb">📸</div><div className="photo-user">{r.userName}</div><div className="photo-act">{r.activity}</div>{r.comment&&<div style={{fontSize:10,color:"var(--g4)",marginTop:3}}>{r.comment.length>20?r.comment.slice(0,20)+"…":r.comment}</div>}<div className="photo-time">{r.time?.slice(0,16)}</div></div>)}
    </div>}
  </div>;
}

// ==================== SERVICE RECORD ====================
function ServiceRecord({user,onBack,store}){
  const [mode,setMode]=useState("list");const [sel,setSel]=useState(null);const [its,setIts]=useState([]);const [mood,setMood]=useState("");const [arr,setArr]=useState(nowHM());const [dep,setDep]=useState("");const [body,setBody]=useState("");const [supp,setSupp]=useState("");const [spec,setSpec]=useState("");const [done,setDone]=useState(false);const [view,setView]=useState(null);
  const users=store.dynUsers.filter(u=>u.facilityId===user.selectedFacilityId&&u.active!==false);const fac=FACILITIES.find(f=>f.id===user.selectedFacilityId);
  const recs=store.recs.filter(r=>r.type==="service"&&(user.role==="admin"||r.facilityId===user.selectedFacilityId)).sort((a,b)=>b.time>a.time?1:-1);
  const tog=i=>setIts(p=>p.includes(i)?p.filter(x=>x!==i):[...p,i]);
  const save=()=>{store.addRec({id:genId(),type:"service",userId:sel.id,userName:sel.name,facilityId:user.selectedFacilityId,facilityName:fac?.name,time:nowStr(),arrival:arr,departure:dep,items:its,mood,bodyNote:body,supportNote:supp,specialNote:spec,createdBy:user.displayName,history:[]});setDone(true);};
  const reset=()=>{setDone(false);setMode("list");setSel(null);setIts([]);setMood("");setBody("");setSupp("");setSpec("");setDep("");setArr(nowHM());};
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
    <div className="slbl">STEP 1 — 利用者を選択</div><div className="ng">{users.map(u=><button key={u.id} className={`nb ${sel?.id===u.id?"s":""}`} onClick={()=>setSel(u)}>{u.name}</button>)}</div>
    <hr className="div"/><div className="slbl">STEP 2 — 在所時間</div>
    <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
      <div style={{display:"flex",alignItems:"center",gap:7}}><span style={{fontSize:11,color:"var(--tx3)"}}>来所</span><TimePicker value={arr} onChange={setArr} label="来所時刻"/></div>
      <span style={{color:"var(--tx3)"}}>〜</span>
      <div style={{display:"flex",alignItems:"center",gap:7}}><span style={{fontSize:11,color:"var(--tx3)"}}>退所</span><TimePicker value={dep} onChange={setDep} label="退所時刻"/></div>
    </div>
    <hr className="div"/><div className="slbl">STEP 3 — 今日の様子</div><div className="mr">{MOODS.map(m=><button key={m} className={`mbtn ${mood===m?"on":""}`} onClick={()=>setMood(m)}>{m}</button>)}</div>
    <hr className="div"/><div className="slbl">STEP 4 — 提供サービス（複数OK）</div><div className="cbg">{SERVICE_ITEMS.map(i=><button key={i} className={`cb ${its.includes(i)?"on":""}`} onClick={()=>tog(i)}>{i}</button>)}</div>
    <hr className="div"/><div className="slbl">体調・健康状態</div><textarea className="fta" placeholder="例）体温36.5℃、食欲あり、元気に過ごした" value={body} onChange={e=>setBody(e.target.value)}/>
    <hr className="div"/><div className="slbl">支援内容・様子</div><textarea className="fta" placeholder="例）個別療育で集中できた。友達との関わりも増えている。" value={supp} onChange={e=>setSupp(e.target.value)}/>
    <hr className="div"/><div className="slbl" style={{color:"var(--ro)"}}>⚠ 特記事項（任意）</div><textarea className="fta" placeholder="例）帰りに転倒、膝に擦り傷あり。保護者に報告済み。" value={spec} onChange={e=>setSpec(e.target.value)} style={{borderColor:"rgba(231,111,81,0.3)"}}/>
    <button className="bsave" disabled={!sel||its.length===0||!mood||!arr} onClick={save} style={{marginTop:14}}>記録を保存する</button>
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
              background:currentDayType===type?(type==="休日"?"#fff8ec":"#cce6f5"):"var(--bg)",
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
            return <td key={i}><div className={`scell sc${we?"off":type||"none"}`} onClick={()=>!we&&setCell({staffId:s.id,date})}>{we?"":type==="none"||!type?"-":type==="off"?"休":type==="holiday"?"有":type==="P1"?"P1":type==="P2"?"P2":type}</div></td>;
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

// ==================== PARENT MESSAGES ====================
function ParentMessages({user,store,onBack}){
  const [selMsg,setSelMsg]=useState(null);const [reply,setReply]=useState("");const [newMode,setNewMode]=useState(false);const [newTo,setNewTo]=useState("");const [newBody,setNewBody]=useState("");
  const msgs=store.msgs.filter(m=>user.role==="admin"||m.facilityId===user.selectedFacilityId);
  const unread=msgs.filter(m=>!m.read).length;
  const users=store.dynUsers.filter(u=>u.facilityId===user.selectedFacilityId&&u.active!==false);
  const sendR=()=>{if(!reply.trim())return;store.replyMsg(selMsg.id,reply);const updated={...selMsg,replies:[...selMsg.replies,reply],read:true};setSelMsg(updated);setReply("");};
  const sendN=()=>{if(!newTo||!newBody.trim())return;store.addMsg({id:genId(),userId:newTo,userName:users.find(u=>u.id===newTo)?.name||"",facilityId:user.selectedFacilityId,from:user.displayName,body:newBody,time:nowStr(),read:false,replies:[]});setNewMode(false);setNewTo("");setNewBody("");};
  if(newMode)return <FlowWrap title="✉️ 新規連絡" onBack={()=>setNewMode(false)}>
    <div className="slbl">宛先（利用者）</div><select className="fi" style={{marginBottom:14}} value={newTo} onChange={e=>setNewTo(e.target.value)}><option value="">選択してください</option>{users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select>
    <div className="slbl">メッセージ</div><textarea className="fta" style={{minHeight:110}} placeholder="保護者へのメッセージを入力..." value={newBody} onChange={e=>setNewBody(e.target.value)}/>
    <button className="bsave" disabled={!newTo||!newBody.trim()} onClick={sendN} style={{marginTop:14}}>送信する</button>
  </FlowWrap>;
  if(selMsg)return <div className="fl-wrap"><div className="fl-hd"><button className="bback" onClick={()=>setSelMsg(null)}>← 戻る</button><div className="fl-title">💬 連絡詳細</div><button className="bexp" style={{marginLeft:"auto",background:"#fff8f0",borderColor:"var(--ac)",color:"var(--ac)"}} onClick={()=>printMessage(selMsg,FACILITIES.find(f=>f.id===user.selectedFacilityId)?.name||"")}>🖨️ 印刷</button></div>
    <div><div className="panel" style={{marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}><div style={{fontWeight:700,fontSize:14}}>{selMsg.from} → {selMsg.userName}</div><div style={{fontSize:10,color:"var(--g4)",fontFamily:"'DM Mono',monospace"}}>{selMsg.time}</div></div>
      <div style={{fontSize:13,color:"var(--g2)",lineHeight:1.7,marginBottom:10,padding:"10px",background:"rgba(0,0,0,0.2)",borderRadius:7}}>{selMsg.body}</div>
      {selMsg.replies.map((r,i)=><div key={i} style={{fontSize:12,color:"var(--tb)",background:"rgba(0,180,216,0.08)",borderRadius:7,padding:"9px 11px",marginBottom:5,borderLeft:"3px solid var(--tl)"}}>↩ {r}</div>)}
    </div>
    <div className="panel"><div className="slbl">返信を入力</div><textarea className="fta" placeholder="返信メッセージを入力..." value={reply} onChange={e=>setReply(e.target.value)} style={{minHeight:72}}/><button className="bsend" style={{marginTop:9,width:"100%"}} onClick={sendR}>送信</button></div>
    </div>
  </div>;
  return <div className="fl-wrap"><div className="fl-hd"><button className="bback" onClick={onBack}>← 戻る</button><div className="fl-title">💬 保護者連絡 {unread>0&&<span style={{fontSize:11,background:"var(--ro)",color:"#fff",borderRadius:9,padding:"1px 7px",marginLeft:5}}>{unread}件未読</span>}</div></div>
    <div><div style={{marginBottom:10}}><button className="bnew" onClick={()=>setNewMode(true)}>＋ 新規連絡を作成</button></div>
    {msgs.length===0?<div style={{textAlign:"center",color:"var(--g6)",padding:"36px 0",fontSize:13}}>連絡事項はありません</div>
    :msgs.sort((a,b)=>!a.read&&b.read?-1:1).map(m=><div key={m.id} className={`mc ${!m.read?"unr":""}`} onClick={()=>{store.markRead(m.id);setSelMsg(m);}}>
      <div className="mh"><div><div className="mfrom">{m.from} → {m.userName}</div><div style={{fontSize:10,color:"var(--g4)",marginTop:1}}>{m.facilityId&&FACILITIES.find(f=>f.id===m.facilityId)?.name}</div></div><div style={{display:"flex",alignItems:"center",gap:7}}>{!m.read&&<div className="udot"/>}<div className="mtime">{m.time}</div></div></div>
      <div className="mbody">{m.body.length>80?m.body.slice(0,80)+"…":m.body}</div>
      {m.replies.length>0&&<div style={{fontSize:11,color:"var(--tl)",marginTop:5}}>↩ 返信 {m.replies.length}件</div>}
    </div>)}
    </div>
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
              style={{padding:"8px 20px",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",borderColor:(form.hasTransport&&v==="あり")||(!form.hasTransport&&v==="なし")?"var(--tl)":"var(--bd)",background:(form.hasTransport&&v==="あり")||(!form.hasTransport&&v==="なし")?"#cce6f5":"var(--bg)",color:(form.hasTransport&&v==="あり")||(!form.hasTransport&&v==="なし")?"var(--tl)":"var(--tx3)"}}>
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
                  <button onClick={()=>upd("jukyushaCopy",false)} style={{display:"block",margin:"8px auto 0",padding:"4px 12px",borderRadius:7,fontSize:11,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"#fad4d0",border:"1px solid #f0a090",color:"#a02818",fontWeight:700}}>削除</button>
                </div>
              : <div>
                  <div style={{fontSize:28,marginBottom:6,opacity:.4}}>📄</div>
                  <div style={{fontSize:12,color:"var(--tx3)",marginBottom:10}}>受給者証のコピーを撮影・登録します</div>
                  <button onClick={()=>upd("jukyushaCopy",true)} style={{padding:"9px 20px",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"var(--tl)",border:"none",color:"#fff"}}>📷 コピーを撮影・登録</button>
                </div>
            }
          </div>
          {form.jukyushaCopy&&<div style={{marginTop:8,fontSize:11,color:"var(--tx3)",display:"flex",gap:8,flexWrap:"wrap"}}>
            <span style={{padding:"3px 9px",borderRadius:8,background:"#d0eedd",color:"#155a30",fontWeight:700,fontSize:10}}>✅ コピー登録済</span>
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
      {isEdit&&<div style={{background:"#fdf5f4",border:"1px solid #f0a090",borderRadius:11,padding:14,marginBottom:12}}>
        <div style={{fontSize:11,fontWeight:700,color:"var(--ro)",marginBottom:8}}>⚠ 利用状況の変更</div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>upd("active",true)} style={{padding:"8px 18px",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",borderColor:form.active!==false?"#98d8b0":"var(--bd)",background:form.active!==false?"#d0eedd":"var(--bg)",color:form.active!==false?"#155a30":"var(--tx3)"}}>在籍中</button>
          <button onClick={()=>upd("active",false)} style={{padding:"8px 18px",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",borderColor:form.active===false?"#f0a090":"var(--bd)",background:form.active===false?"#fad4d0":"var(--bg)",color:form.active===false?"#a02818":"var(--tx3)"}}>退所・無効</button>
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
          {urgentCount>0&&<div style={{background:"#fad4d0",border:"1.5px solid #f0a090",borderRadius:10,padding:"10px 16px",display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:20}}>🔴</span>
            <div><div style={{fontSize:12,fontWeight:900,color:"#a02818"}}>要対応 {urgentCount}件</div><div style={{fontSize:10,color:"#a02818",opacity:.8}}>期限切れ・30日以内</div></div>
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
              {ispCount>0&&<span style={{fontSize:9,padding:"2px 6px",borderRadius:8,background:"#cce6f5",color:"#006090",fontWeight:700}}>計画{ispCount}件</span>}
              {latestIsp&&<span style={{fontSize:9,padding:"2px 6px",borderRadius:8,background:latestIsp.progress>=80?"#d0eedd":"#fce8c8",color:latestIsp.progress>=80?"#186838":"#a06010",fontWeight:700}}>{latestIsp.progress}%</span>}
              {store.facesheets.find(f=>f.userId===u.id)&&<span style={{fontSize:9,padding:"2px 6px",borderRadius:8,background:"#e8d4f4",color:"#5820a0",fontWeight:700}}>FS有</span>}
            </div>
            {(()=>{const alerts=getUserAlerts(u,store);const hasUrgent=alerts.some(a=>a.status==="expired"||a.status==="urgent");const hasSoon=alerts.some(a=>a.status==="soon");return (hasUrgent||hasSoon)&&<div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {hasUrgent&&<span style={{fontSize:9,padding:"2px 7px",borderRadius:7,background:"#fad4d0",color:"#a02818",fontWeight:700,border:"1px solid #f0a090"}}>🔴 要対応</span>}
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
    const TABS=[
      {k:"facesheet",l:"フェイスシート",ic:"📋"},
      {k:"assessment",l:"アセスメント",ic:"📊"},
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
            const tabBorder = hubTab===t.k?"none":hasUrgent?"1.5px solid #f0a090":hasSoon?"1.5px solid #e8d870":"1.5px solid var(--bd)";
            return <button key={t.k} onClick={()=>setHubTab(t.k)} style={{padding:"8px 14px",borderRadius:20,whiteSpace:"nowrap",fontFamily:"'Noto Sans JP',sans-serif",fontSize:12,fontWeight:700,cursor:"pointer",background:hubTab===t.k?"var(--tl)":"var(--wh)",color:hubTab===t.k?"#fff":"var(--tx3)",border:tabBorder,boxShadow:hubTab===t.k?"0 2px 8px rgba(0,128,184,0.3)":"var(--sh)",transition:"all .18s",position:"relative"}}>
              {t.ic} {t.l}
              {(hasUrgent||hasSoon)&&<span style={{position:"absolute",top:-4,right:-4,width:10,height:10,borderRadius:"50%",background:hasUrgent?"#a02818":"#8a6200",border:"2px solid var(--wh)"}}/>}
            </button>;
          })}
        </div>;})()}

        {/* ===== フェイスシート ===== */}
        {hubTab==="facesheet"&&<FacesheetTab u={u} myFS={myFS} user={user} store={store}/>}
        {/* ===== アセスメント ===== */}
        {hubTab==="assessment"&&<AssessmentTab u={u} myAssessments={myAssessments} user={user} store={store}/>}
        {/* ===== 個別支援計画 ===== */}
        {hubTab==="isp"&&<IspTab u={u} myIsps={myIsps} user={user} store={store}/>}
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
        <FormField form={form} upd={upd} errors={errors}  label="生年月日" fkey="dob2" placeholder="2015-04-10"/>
        <FormField form={form} upd={upd} errors={errors}  label="性別" fkey="gender" placeholder="男・女・その他"/>
        <FormField form={form} upd={upd} errors={errors}  label="障害種別・等級" fkey="disabilityGrade" placeholder="例）療育手帳 B1"/>
        <FormField form={form} upd={upd} errors={errors}  label="診断名" fkey="diagDetail" placeholder="例）自閉スペクトラム症（ASD）"/>
      </div>
      <FormField form={form} upd={upd} errors={errors}  label="障害の特記事項" fkey="disabilityNote" multi placeholder="手帳番号、診断詳細など"/>
    </div>
    {/* 保護者情報 */}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:"16px",marginBottom:12,boxShadow:"var(--sh)"}}>
      <div style={{fontSize:11,fontWeight:700,color:"var(--tl)",letterSpacing:2,marginBottom:12,paddingBottom:8,borderBottom:"2px solid var(--tl)"}}>保護者情報</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
        <FormField form={form} upd={upd} errors={errors}  label="保護者氏名" fkey="parentName" placeholder="山田 花子"/>
        <FormField form={form} upd={upd} errors={errors}  label="続柄" fkey="parentRelation" placeholder="母"/>
        <FormField form={form} upd={upd} errors={errors}  label="連絡先（携帯）" fkey="parentTel" placeholder="090-XXXX-XXXX"/>
        <FormField form={form} upd={upd} errors={errors}  label="緊急連絡先" fkey="emergencyTel" placeholder="090-XXXX-XXXX"/>
        <FormField form={form} upd={upd} errors={errors}  label="緊急連絡先氏名" fkey="emergencyName" placeholder="山田 太郎"/>
        <FormField form={form} upd={upd} errors={errors}  label="緊急連絡先続柄" fkey="emergencyRelation" placeholder="父"/>
      </div>
      <FormField form={form} upd={upd} errors={errors}  label="住所" fkey="address" placeholder="○○市△△1-2-3"/>
    </div>
    {/* 学校情報 */}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:"16px",marginBottom:12,boxShadow:"var(--sh)"}}>
      <div style={{fontSize:11,fontWeight:700,color:"var(--gr)",letterSpacing:2,marginBottom:12,paddingBottom:8,borderBottom:"2px solid var(--gr)"}}>学校情報</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
        <FormField form={form} upd={upd} errors={errors}  label="学校名" fkey="school" placeholder="○○小学校 特別支援学級"/>
        <FormField form={form} upd={upd} errors={errors}  label="学年" fkey="schoolYear" placeholder="4年生"/>
        <FormField form={form} upd={upd} errors={errors}  label="担任・支援員" fkey="schoolContact" placeholder="鈴木 先生"/>
      </div>
    </div>
    {/* 医療情報 */}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:"16px",marginBottom:12,boxShadow:"var(--sh)"}}>
      <div style={{fontSize:11,fontWeight:700,color:"var(--ro)",letterSpacing:2,marginBottom:12,paddingBottom:8,borderBottom:"2px solid var(--ro)"}}>医療情報</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
        <FormField form={form} upd={upd} errors={errors}  label="医療機関名" fkey="medicalInstitution" placeholder="○○クリニック"/>
        <FormField form={form} upd={upd} errors={errors}  label="主治医" fkey="doctor" placeholder="田中 医師"/>
      </div>
      <FormField form={form} upd={upd} errors={errors}  label="服薬状況" fkey="medications" placeholder="例）リスパダール 0.5mg 朝・夕食後"/>
      <FormField form={form} upd={upd} errors={errors}  label="アレルギー・禁忌事項" fkey="allergies" placeholder="例）卵アレルギー（重篤）、蜂毒アレルギー"/>
    </div>
    {/* 特性・支援情報 */}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:"16px",marginBottom:12,boxShadow:"var(--sh)"}}>
      <div style={{fontSize:11,fontWeight:700,color:"var(--pu)",letterSpacing:2,marginBottom:12,paddingBottom:8,borderBottom:"2px solid var(--pu)"}}>特性・支援情報</div>
      <FormField form={form} upd={upd} errors={errors}  label="得意なこと・強み" fkey="strengths" multi placeholder="例）記憶力が高い、電車の知識が豊富、手先が器用"/>
      <FormField form={form} upd={upd} errors={errors}  label="苦手なこと・課題" fkey="challenges" multi placeholder="例）突然の予定変更が苦手、大きな音が苦手"/>
      <FormField form={form} upd={upd} errors={errors}  label="パニックのきっかけ" fkey="triggers" multi placeholder="例）急な予定変更、大きな声、特定の感触"/>
      <FormField form={form} upd={upd} errors={errors}  label="落ち着くための方法" fkey="calming" multi placeholder="例）一人になれる静かな空間、好きな音楽を聴く"/>
      <FormField form={form} upd={upd} errors={errors}  label="支援上の特記事項" fkey="notes" multi placeholder="その他、支援員が把握すべき情報"/>
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

  const ScoreColor=s=>s>=4?"#186838":s>=3?"#0070a0":s>=2?"#a06010":"#a02818";
  const ScoreBg=s=>s>=4?"#d0eedd":s>=3?"#cce6f5":s>=2?"#fce8c8":"#fad4d0";

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
        <span style={{padding:"4px 10px",borderRadius:10,fontSize:11,fontWeight:700,background:view.status==="実施中"?"#cce6f5":"#d0eedd",color:view.status==="実施中"?"#006090":"#186838"}}>{view.status}</span>
      </div>
      <div style={{fontSize:10,fontWeight:700,color:"var(--tl)",letterSpacing:1,marginBottom:6}}>長期目標</div>
      <div style={{fontSize:13,color:"var(--tx2)",lineHeight:1.7,padding:"10px 12px",background:"#eef6fc",borderRadius:8,borderLeft:"3px solid var(--tl)",marginBottom:12}}>{view.longGoal}</div>
      <div style={{fontSize:10,fontWeight:700,color:"var(--gr)",letterSpacing:1,marginBottom:6}}>短期目標</div>
      <div style={{fontSize:13,color:"var(--tx2)",lineHeight:1.7,marginBottom:12}}>{view.shortGoal}</div>
      <div style={{fontSize:10,fontWeight:700,color:"var(--am)",letterSpacing:1,marginBottom:6}}>支援領域</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:12}}>{view.goals?.map(g=><span key={g} style={{padding:"3px 9px",borderRadius:9,fontSize:10,fontWeight:700,background:"#cce6f5",color:"#006090"}}>{g}</span>)}</div>
      <div style={{fontSize:10,fontWeight:700,color:"var(--tx2)",letterSpacing:1,marginBottom:6}}>支援内容・方法</div>
      <div style={{fontSize:13,color:"var(--tx2)",lineHeight:1.7,marginBottom:12}}>{view.support}</div>
      <div style={{fontSize:10,fontWeight:700,color:"var(--tx2)",letterSpacing:1,marginBottom:6}}>評価方法・時期</div>
      <div style={{fontSize:13,color:"var(--tx2)",lineHeight:1.7,marginBottom:14}}>{view.evaluation}</div>
      <div style={{fontSize:10,fontWeight:700,color:"var(--tl)",letterSpacing:1,marginBottom:6}}>達成度</div>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:12,color:"var(--tx3)"}}>進捗</span><span style={{fontSize:14,fontWeight:700,color:"var(--tl)",fontFamily:"'DM Mono',monospace"}}>{view.progress}%</span></div>
      <div className="progress-bar"><div className="progress-fill" style={{width:view.progress+"%"}}/></div>
      <div style={{display:"flex",gap:6,marginTop:12,flexWrap:"wrap"}}>
        {[0,10,20,30,40,50,60,70,80,90,100].map(p=><button key={p} onClick={()=>{store.updIsp(view.id,{progress:p});setView({...view,progress:p});}} style={{padding:"4px 9px",borderRadius:10,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",borderColor:view.progress===p?"var(--tl)":"var(--bd)",background:view.progress===p?"#cce6f5":"var(--bg)",color:view.progress===p?"var(--tl)":"var(--tx3)"}}>{p}%</button>)}
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
        {SUPPORT_GOALS.map(g=><button key={g} onClick={()=>tog(g)} style={{padding:"6px 11px",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",borderColor:goals.includes(g)?"var(--tl)":"var(--bd)",background:goals.includes(g)?"#cce6f5":"var(--bg)",color:goals.includes(g)?"var(--tl)":"var(--tx2)"}}>{g}</button>)}
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
          <span style={{padding:"3px 9px",borderRadius:9,fontSize:11,fontWeight:700,background:x.status==="完了"?"#d0eedd":"#cce6f5",color:x.status==="完了"?"#186838":"#006090"}}>{x.status}</span>
        </div>
      </div>
      {x.goals?.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:7}}>{x.goals.slice(0,3).map(g=><span key={g} style={{fontSize:9,padding:"2px 7px",borderRadius:8,background:"#cce6f5",color:"#006090",fontWeight:700}}>{g}</span>)}{x.goals.length>3&&<span style={{fontSize:9,color:"var(--tx3)"}}>+{x.goals.length-3}</span>}</div>}
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
  const RESULT_OPTS=[{v:"達成",c:"#186838",bg:"#d0eedd"},{v:"概ね達成",c:"#0070a0",bg:"#cce6f5"},{v:"一部達成",c:"#a06010",bg:"#fce8c8"},{v:"未達成",c:"#a02818",bg:"#fad4d0"},{v:"継続",c:"#5820a0",bg:"#e8d4f4"}];

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
          {total>0&&<span style={{padding:"3px 10px",borderRadius:10,fontSize:11,fontWeight:700,background:"#d0eedd",color:"#186838"}}>{achieved}/{total} 項目達成</span>}
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

// ==================== 国保連請求 ====================
function KokuhoScreen({user,store,onBack}){
  const [vm,setVm]=useState(()=>{const d=new Date();return{y:d.getFullYear(),m:d.getMonth()+1};});
  const [view,setView]=useState("summary"); // summary | detail | calendar
  const [selFacs,setSelFacs]=useState(FACILITIES.map(f=>f.id));
  const [editId,setEditId]=useState(null); // 編集中のkokuho id
  const [city,setCity]=useState('その他');
  const TANKA=getShizuokaTanka(city);
  const days=daysInMonth(vm.y,vm.m);
  const isMgr=user.role==="manager"||user.role==="admin";

  // 1件の総単位・金額
  const calcAmount=k=>Math.round(calcTotalUnits(k)*TANKA);

  // 施設ごと月集計
  const facData=fid=>{
    const kk=store.kokuho.filter(k=>k.facilityId===fid&&k.year===vm.y&&k.month===vm.m);
    const totalUnits=kk.reduce((s,k)=>s+calcTotalUnits(k),0);
    const totalYen=Math.round(totalUnits*TANKA);
    return {kk,totalUnits,totalYen,
      totalSvcDays:kk.reduce((s,k)=>s+k.serviceDays,0),
      users:kk.length};
  };
  const visibleFacs=FACILITIES.filter(f=>selFacs.includes(f.id));
  const grandTotal=visibleFacs.reduce((s,f)=>s+facData(f.id).totalYen,0);

  const dayCount=(fid,d)=>{
    const dk=vm.y+"-"+String(vm.m).padStart(2,"0")+"-"+String(d).padStart(2,"0");
    const us=store.dynUsers.filter(u=>u.facilityId===fid);
    return {att:us.filter(u=>store.getAtt(u.id,dk)==="出席"||store.getAtt(u.id,dk)==="予定").length,
            abs:us.filter(u=>store.getAtt(u.id,dk)==="欠席").length};
  };
  const csv=()=>{
    const rows=[];
    visibleFacs.forEach(f=>{const d=facData(f.id);rows.push([f.name,d.totalSvcDays,"",d.users,fmtYen(d.totalYen)].join(","));});
    rows.push(["合計","","","",fmtYen(grandTotal)]);
    const c=["施設名,サービス日数,送迎日数,利用者数,請求額",...rows].join("\n");
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["﻿"+c],{type:"text/csv"}));
    a.download=`sales_${vm.y}${String(vm.m).padStart(2,"0")}.csv`;a.click();
  };

  // ===== 加算編集モーダル =====
  if(editId){
    const k=store.kokuho.find(x=>x.id===editId);
    if(!k) {setEditId(null);return null;}
    return <KokuhoEditModal k={k} store={store} TANKA={TANKA} onClose={()=>setEditId(null)}/>;
  }

  return <div className="fl-wrap"><div className="fl-hd"><button className="bback" onClick={onBack}>← 戻る</button><div className="fl-title">💴 売上管理・請求</div></div>
  <div>
    {/* 操作パネル */}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:12,padding:"14px 16px",marginBottom:14,boxShadow:"var(--sh)"}}>
      <div style={{fontSize:11,fontWeight:700,color:"var(--tl)",letterSpacing:2,marginBottom:10}}>操作オプション</div>
      <div style={{display:"flex",gap:7,flexWrap:"wrap",alignItems:"center",marginBottom:10}}>
        <span style={{fontSize:12,color:"var(--tx2)",fontWeight:700}}>表示する施設：</span>
        <button className="sbtn sc" style={{fontSize:11}} onClick={()=>setSelFacs(FACILITIES.map(f=>f.id))}>すべてチェック</button>
        <button className="sbtn sn2" style={{fontSize:11}} onClick={()=>setSelFacs([])}>すべて解除</button>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
        {FACILITIES.map(f=>{const facSel=selFacs.includes(f.id);return <label key={f.id} onClick={()=>setSelFacs(p=>p.includes(f.id)?p.filter(x=>x!==f.id):[...p,f.id])} style={{display:"flex",alignItems:"center",gap:5,cursor:"pointer",fontSize:13,fontWeight:600,padding:"5px 10px",borderRadius:8,background:facSel?"#cce6f5":"var(--bg)",border:"1.5px solid "+(facSel?"var(--tl)":"var(--bd)"),color:facSel?"var(--tl)":"var(--tx3)",transition:"all .15s"}}>
          <span>{facSel?"☑":"☐"}</span>{f.name}
        </label>;})}
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        <span style={{fontSize:12,color:"var(--tx2)",fontWeight:700}}>市区町村（地域単価）：</span>
        <select className="fsm" value={city} onChange={e=>setCity(e.target.value)} style={{fontSize:13,fontWeight:700}}>
          {Object.entries(SHIZUOKA_TANKA).map(([c,t])=><option key={c} value={c}>{c}（{t}円/単位）</option>)}
        </select>
        <span style={{fontSize:12,color:"var(--tx2)",fontWeight:700,marginLeft:4}}>年月：</span>
        <select className="fsm" value={vm.y} onChange={e=>setVm(v=>({...v,y:+e.target.value}))} style={{fontSize:14,fontWeight:700}}>
          {Array.from({length:13},(_,i)=>2015+i).map(y=><option key={y} value={y}>{y}年</option>)}
        </select>
        <select className="fsm" value={vm.m} onChange={e=>setVm(v=>({...v,m:+e.target.value}))} style={{fontSize:14,fontWeight:700}}>
          {Array.from({length:12},(_,i)=>i+1).map(m=><option key={m} value={m}>{m}月</option>)}
        </select>
        <div style={{display:"flex",gap:6}}>
          {["summary","detail","calendar"].map(v=><button key={v} className={`sbtn ${view===v?"sc":"sn2"}`} onClick={()=>setView(v)}>
            {{summary:"サマリー",detail:"加算詳細",calendar:"カレンダー"}[v]}
          </button>)}
        </div>
        <button className="bexp" onClick={csv}>⬇ CSV</button>
        <button className="bexp" style={{background:"#fff8f0",borderColor:"var(--ac)",color:"var(--ac)"}} onClick={()=>printSales(visibleFacs,vm,store.kokuho,"")}>🖨️ 印刷</button>
      </div>
    </div>

    {/* 総売上バナー */}
    <div style={{background:"linear-gradient(135deg,#1a6b3a,#2d9e58)",borderRadius:12,padding:"14px 18px",marginBottom:14,color:"#fff"}}>
      <div style={{fontSize:12,opacity:.8,marginBottom:4}}>{vm.y}年{String(vm.m).padStart(2,"0")}月の総売上</div>
      <div style={{fontSize:28,fontWeight:900,fontFamily:"'DM Mono',monospace",letterSpacing:1}}>{grandTotal.toLocaleString()}円</div>
      <div style={{fontSize:11,opacity:.7,marginTop:4}}>静岡県 {city} ／ 1単位 {TANKA}円 ／ {visibleFacs.length}店舗</div>
    </div>

    {/* ===== サマリービュー ===== */}
    {view==="summary"&&<>
      <div style={{overflowX:"auto",marginBottom:14}}>
        <div style={{display:"flex",gap:10,minWidth:"max-content",paddingBottom:4}}>
          {visibleFacs.map(f=>{const d=facData(f.id);return <div key={f.id} style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:12,padding:"14px 16px",minWidth:160,flex:"0 0 auto",boxShadow:"var(--sh)"}}>
            <div style={{fontSize:13,fontWeight:900,color:"var(--tl)",marginBottom:8,paddingBottom:7,borderBottom:"1px solid var(--bg2)"}}>{f.name}</div>
            <div style={{fontSize:22,fontWeight:900,fontFamily:"'DM Mono',monospace",color:"var(--am)",marginBottom:8}}>{d.totalYen.toLocaleString()}円</div>
            <div style={{fontSize:11,color:"var(--tx3)",lineHeight:1.9}}>
              <div>利用者: <strong style={{color:"var(--tx)"}}>{d.users}名</strong></div>
              <div>サービス日数: <strong style={{color:"var(--tx)"}}>{d.totalSvcDays}日</strong></div>
              <div>合計単位: <strong style={{color:"var(--tl)"}}>{d.totalUnits.toLocaleString()}</strong></div>
            </div>
            <div style={{marginTop:8,display:"flex",gap:4,flexWrap:"wrap"}}>
              {["未請求","請求済","入金済"].map(s=>{const cnt=d.kk.filter(k=>k.status===s).length;return cnt>0?<span key={s} style={{fontSize:9,padding:"2px 6px",borderRadius:7,fontWeight:700,background:s==="入金済"?"#d0eedd":s==="請求済"?"#cce6f5":"var(--bg)",color:s==="入金済"?"#155a30":s==="請求済"?"#005a8a":"var(--tx3)"}}>{s} {cnt}</span>:null;})}
            </div>
          </div>;})}
        </div>
      </div>

      {/* 施設別テーブル（加算詳細なし） */}
      {visibleFacs.map(f=>{const d=facData(f.id);return <div key={f.id} style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:12,marginBottom:12,overflow:"hidden",boxShadow:"var(--sh)"}}>
        <div style={{background:"var(--bg2)",padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontWeight:900,fontSize:14}}>{f.name}</div>
          <div style={{fontWeight:900,fontSize:16,fontFamily:"'DM Mono',monospace",color:"var(--am)"}}>{d.totalYen.toLocaleString()}円</div>
        </div>
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{background:""}}>{["利用者名","基本日数","基本単価","加算単位","合計単位","請求額","状態",""].map(h=><th key={h} style={{padding:"7px 9px",textAlign:"left",color:"var(--tx2)",fontSize:10,fontWeight:700,borderBottom:"2px solid var(--bg2)",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
          <tbody>{d.kk.map(k=>{const totalU=calcTotalUnits(k);const addU=totalU-k.serviceDays*k.unitPrice;return <tr key={k.id} style={{borderBottom:"1px solid var(--bg2)"}}>
            <td style={{padding:"8px 9px",fontWeight:600}}>{k.userName}</td>
            <td style={{padding:"8px 9px",fontFamily:"'DM Mono',monospace"}}>{k.serviceDays}日</td>
            <td style={{padding:"8px 9px",fontFamily:"'DM Mono',monospace",fontSize:11,color:"var(--tx3)"}}>{k.unitPrice}/日</td>
            <td style={{padding:"8px 9px",fontFamily:"'DM Mono',monospace",color:addU>0?"var(--tl)":"var(--tx3)",fontWeight:addU>0?700:400}}>+{addU.toLocaleString()}</td>
            <td style={{padding:"8px 9px",fontFamily:"'DM Mono',monospace",color:"var(--tl)",fontWeight:700}}>{totalU.toLocaleString()}</td>
            <td style={{padding:"8px 9px",fontFamily:"'DM Mono',monospace",fontWeight:700,color:"var(--am)"}}>{calcAmount(k).toLocaleString()}円</td>
            <td style={{padding:"8px 9px"}}><div style={{display:"flex",gap:4}}>
              {["未請求","請求済","入金済"].map(s=><button key={s} onClick={()=>store.updKokuho(k.id,{status:s})} style={{padding:"2px 7px",borderRadius:8,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",borderColor:k.status===s?(s==="入金済"?"#98d8b0":s==="請求済"?"#90c8e8":"var(--bd)"):"transparent",background:k.status===s?(s==="入金済"?"#d0eedd":s==="請求済"?"#cce6f5":"var(--bg)"):"transparent",color:k.status===s?(s==="入金済"?"#155a30":s==="請求済"?"#005a8a":"var(--tx3)"):"var(--tx3)"}}>{s}</button>)}
            </div></td>
            {isMgr&&<td style={{padding:"8px 9px"}}><button onClick={()=>setEditId(k.id)} style={{padding:"3px 9px",borderRadius:7,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"#eef6fc",border:"1.5px solid #90c8e8",color:"#005a8a"}}>加算編集</button></td>}
          </tr>;})}
          <tr style={{background:"#eef8f2",borderTop:"2px solid #98d8b0"}}>
            <td style={{padding:"8px 9px",fontWeight:900,color:"#155a30"}}>合計</td>
            <td style={{padding:"8px 9px",fontWeight:700}}>{d.totalSvcDays}日</td>
            <td/><td/>
            <td style={{padding:"8px 9px",fontWeight:700,color:"var(--tl)",fontFamily:"'DM Mono',monospace"}}>{d.totalUnits.toLocaleString()}</td>
            <td style={{padding:"8px 9px",fontWeight:900,color:"var(--am)",fontSize:14,fontFamily:"'DM Mono',monospace"}}>{d.totalYen.toLocaleString()}円</td>
            <td/>{isMgr&&<td/>}
          </tr>
        </tbody></table></div>
      </div>;})}
    </>}

    {/* ===== 加算詳細ビュー ===== */}
    {view==="detail"&&<>
      {visibleFacs.map(f=>{const d=facData(f.id);return <div key={f.id} style={{marginBottom:16}}>
        <div style={{fontSize:14,fontWeight:900,color:"var(--tx)",marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span>{f.name}</span>
          <span style={{fontSize:16,fontWeight:900,fontFamily:"'DM Mono',monospace",color:"var(--am)"}}>{d.totalYen.toLocaleString()}円</span>
        </div>
        {d.kk.map(k=>{
          const baseUnits=k.serviceDays*k.unitPrice;
          const addons=k.addons||[];
          const totalU=calcTotalUnits(k);
          return <div key={k.id} style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:14,marginBottom:8,boxShadow:"var(--sh)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div>
                <div style={{fontWeight:900,fontSize:14,marginBottom:3}}>{k.userName}</div>
                <div style={{fontSize:11,color:"var(--tx3)"}}>{SERVICE_TYPE_MASTER.find(s=>s.code===k.serviceCode)?.label||"放課後等デイ"}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:18,fontWeight:900,fontFamily:"'DM Mono',monospace",color:"var(--am)"}}>{calcAmount(k).toLocaleString()}円</div>
                <div style={{fontSize:11,color:"var(--tx3)"}}>{totalU.toLocaleString()}単位</div>
              </div>
            </div>
            {/* 内訳 */}
            <div style={{background:"var(--bg)",borderRadius:8,padding:"10px 12px",marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid var(--bg2)"}}>
                <span style={{fontSize:12}}>基本報酬 {k.serviceDays}日 × {k.unitPrice}単位</span>
                <span style={{fontSize:12,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{baseUnits.toLocaleString()}単位</span>
              </div>
              {addons.map((a,i)=>{
                const m=ADDON_MASTER.find(x=>x.key===a.key);if(!m)return null;
                const u=m.rate?Math.round(baseUnits*m.rate):m.perDay?(a.days||k.serviceDays)*m.unit:(a.count||1)*m.unit;
                return <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid var(--bg2)"}}>
                  <span style={{fontSize:12,color:"var(--tl)"}}>{m.label} {m.perDay?(a.days||k.serviceDays)+"日×"+m.unit+"単位":m.rate?"基本×"+(m.rate*100).toFixed(1)+"%":(a.count||1)+"回"}</span>
                  <span style={{fontSize:12,fontWeight:700,color:"var(--tl)",fontFamily:"'DM Mono',monospace"}}>+{u.toLocaleString()}単位</span>
                </div>;
              })}
              <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0 0",marginTop:2}}>
                <span style={{fontSize:13,fontWeight:700}}>合計単位</span>
                <span style={{fontSize:13,fontWeight:900,fontFamily:"'DM Mono',monospace",color:"var(--tl)"}}>{totalU.toLocaleString()}単位</span>
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{display:"flex",gap:4}}>
                {["未請求","請求済","入金済"].map(s=><button key={s} onClick={()=>store.updKokuho(k.id,{status:s})} style={{padding:"3px 9px",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",borderColor:k.status===s?(s==="入金済"?"#98d8b0":s==="請求済"?"#90c8e8":"var(--bd)"):"transparent",background:k.status===s?(s==="入金済"?"#d0eedd":s==="請求済"?"#cce6f5":"var(--bg)"):"transparent",color:k.status===s?(s==="入金済"?"#155a30":s==="請求済"?"#005a8a":"var(--tx3)"):"var(--tx3)"}}>{s}</button>)}
              </div>
              {isMgr&&<button onClick={()=>setEditId(k.id)} style={{padding:"6px 14px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"#eef6fc",border:"1.5px solid #90c8e8",color:"#005a8a"}}>✏️ 加算を編集</button>}
            </div>
          </div>;
        })}
      </div>;})}
    </>}

    {/* ===== カレンダービュー ===== */}
    {view==="calendar"&&<div style={{overflowX:"auto"}}>
      <table style={{borderCollapse:"collapse",fontSize:11,minWidth:"100%"}}>
        <thead><tr style={{background:"var(--bg2)"}}>
          <th style={{padding:"8px 6px",color:"var(--tx2)",fontSize:10,fontWeight:700,borderBottom:"2px solid var(--bd)",whiteSpace:"nowrap",minWidth:36,position:"sticky",left:0,background:"var(--bg2)",zIndex:2}}>日</th>
          {visibleFacs.map(f=><th key={f.id} style={{padding:"8px 14px",color:"var(--tx2)",fontSize:11,fontWeight:700,borderBottom:"2px solid var(--bd)",whiteSpace:"nowrap",minWidth:110,textAlign:"center"}}>{f.name}</th>)}
        </tr></thead>
        <tbody>
          {Array.from({length:days},(_,i)=>{
            const d=i+1;const dow=new Date(vm.y,vm.m-1,d).getDay();
            const dowLabel="日月火水木金土"[dow];const isWe=dow===0||dow===6;
            return <tr key={d} style={{background:isWe?"var(--bg2)":"var(--wh)",borderBottom:"1px solid var(--bg2)"}}>
              <td style={{padding:"7px 6px",textAlign:"center",fontWeight:700,fontSize:11,position:"sticky",left:0,background:isWe?"var(--bg2)":"var(--wh)",borderRight:"1px solid var(--bd)",zIndex:1,color:dow===0?"var(--ro)":dow===6?"var(--tl)":"var(--tx)"}}>
                {d}<br/><span style={{fontSize:9}}>{dowLabel}</span>
              </td>
              {visibleFacs.map(f=>{const c=dayCount(f.id,d);return <td key={f.id} style={{padding:"6px 10px",textAlign:"center",verticalAlign:"middle"}}>
                {isWe?<span style={{fontSize:11,color:"var(--tx3)"}}>休日</span>
                :c.att===0&&c.abs===0?<span style={{fontSize:11,color:"var(--tx3)"}}>-</span>
                :<div style={{display:"flex",flexDirection:"column",gap:2,alignItems:"center"}}>
                  {c.att>0&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:8,background:"#cce6f5",color:"#005a8a",fontWeight:700}}>出席 {c.att}</span>}
                  {c.abs>0&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:8,background:"#fad4d0",color:"#a02818",fontWeight:700}}>欠席 {c.abs}</span>}
                </div>}
              </td>;})}
            </tr>;
          })}
          <tr style={{background:"#eef8f2",borderTop:"2px solid #98d8b0"}}>
            <td style={{padding:"9px 6px",textAlign:"center",fontWeight:900,fontSize:11,color:"#155a30",position:"sticky",left:0,background:"#eef8f2",borderRight:"1px solid var(--bd)",zIndex:1}}>合計</td>
            {visibleFacs.map(f=>{const d=facData(f.id);return <td key={f.id} style={{padding:"9px 10px",textAlign:"center"}}>
              <div style={{fontSize:13,fontWeight:900,fontFamily:"'DM Mono',monospace",color:"var(--am)"}}>{d.totalYen.toLocaleString()}円</div>
              <div style={{fontSize:10,color:"var(--tx3)",marginTop:2}}>{d.totalSvcDays}日</div>
            </td>;})}
          </tr>
        </tbody>
      </table>
    </div>}
  </div></div>;
}

// ===== 加算編集モーダル =====
function KokuhoEditModal({k, store, TANKA, onClose}){
  const initForm = {
    serviceCode: k.serviceCode || "6612B",
    unitPrice: k.unitPrice || 530,
    serviceDays: k.serviceDays || 0,
    holidayDays: k.holidayDays || 0,
    city: k.city || "その他",
    addons: (k.addons || []).slice(),
  };
  const [form, setForm] = useState(initForm);
  const upd = function(key, val){ setForm(function(p){ return Object.assign({}, p, {[key]: val}); }); };

  const toggleAddon = function(akey){
    const existing = form.addons.find(function(a){ return a.key === akey; });
    if(existing){
      setForm(function(p){ return Object.assign({}, p, {addons: p.addons.filter(function(a){ return a.key !== akey; })}); });
    } else {
      setForm(function(p){ return Object.assign({}, p, {addons: p.addons.concat([{key: akey, days: p.serviceDays, count: 1}])}); });
    }
  };

  const updAddonDays = function(akey, days){
    setForm(function(p){
      return Object.assign({}, p, {addons: p.addons.map(function(a){ return a.key === akey ? Object.assign({}, a, {days: days}) : a; })});
    });
  };

  const localTanka = getShizuokaTanka(form.city);

  const findHolidayUnit = function(){
    const ht = SERVICE_TYPE_MASTER.find(function(s){ return s.code === form.serviceCode; });
    if(!ht) return form.unitPrice + 88;
    const hc = SERVICE_TYPE_MASTER.find(function(s){
      return s.kubun === ht.kubun && s.timeType === "放課後" && s.note === ht.note ? false : s.kubun === ht.kubun && s.note === ht.note && s.timeType !== ht.timeType;
    });
    return (hc && hc.unit) ? hc.unit : (form.unitPrice + 88);
  };
  const holidayUnit = findHolidayUnit();

  const baseUnits = (form.serviceDays || 0) * (form.unitPrice || 0) + (form.holidayDays || 0) * holidayUnit;

  const calcAddonUnits = function(addons){
    return (addons || []).reduce(function(sum, a){
      const m = ADDON_MASTER.find(function(x){ return x.key === a.key; });
      if(!m) return sum;
      if(m.rate) return sum + Math.round(baseUnits * m.rate);
      if(m.perDay) return sum + (a.days || form.serviceDays || 0) * m.unit;
      return sum + (a.count || 1) * m.unit;
    }, 0);
  };

  const totalU = baseUnits + calcAddonUnits(form.addons);
  const totalYen = Math.round(totalU * localTanka);

  const save = function(){
    store.updKokuho(k.id, {
      serviceCode: form.serviceCode,
      unitPrice: form.unitPrice,
      serviceDays: form.serviceDays,
      holidayDays: form.holidayDays,
      city: form.city,
      addons: form.addons
    });
    onClose();
  };

  const ModalOverlay = {
    position: "fixed", top: 0, right: 0, bottom: 0, left: 0,
    background: "rgba(0,0,0,0.45)", zIndex: 200,
    display: "flex", alignItems: "flex-end", justifyContent: "center"
  };

  return (
    <div style={ModalOverlay} onClick={function(e){ if(e.target === e.currentTarget) onClose(); }}>
      <div style={{background:"var(--wh)",borderRadius:"16px 16px 0 0",width:"100%",maxWidth:600,maxHeight:"90vh",overflow:"auto",boxShadow:"0 -4px 24px rgba(0,0,0,0.18)"}}>
        <div style={{position:"sticky",top:0,background:"var(--wh)",padding:"14px 18px 10px",borderBottom:"1px solid var(--bg2)",zIndex:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontWeight:900,fontSize:16}}>加算設定 — {k.userName}</div>
            <button onClick={onClose} style={{padding:"5px 12px",borderRadius:8,background:"var(--bg)",border:"1.5px solid var(--bd)",color:"var(--tx2)",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>✕ 閉じる</button>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <div style={{background:"#eef8f2",borderRadius:9,padding:"8px 14px",flex:1,textAlign:"center"}}>
              <div style={{fontSize:10,color:"var(--tx3)",marginBottom:2}}>合計単位</div>
              <div style={{fontSize:20,fontWeight:900,fontFamily:"'DM Mono',monospace",color:"var(--tl)"}}>{totalU.toLocaleString()}</div>
            </div>
            <div style={{fontSize:20,color:"var(--tx3)"}}>→</div>
            <div style={{background:"#fff8ec",borderRadius:9,padding:"8px 14px",flex:1,textAlign:"center"}}>
              <div style={{fontSize:10,color:"var(--tx3)",marginBottom:2}}>請求額（概算）</div>
              <div style={{fontSize:20,fontWeight:900,fontFamily:"'DM Mono',monospace",color:"var(--am)"}}>{totalYen.toLocaleString()}円</div>
            </div>
          </div>
        </div>

        <div style={{padding:"16px 18px 32px"}}>
          <div style={{background:"var(--bg)",borderRadius:10,padding:"12px 14px",marginBottom:14}}>
            <div style={{fontSize:11,fontWeight:700,color:"var(--tl)",letterSpacing:2,marginBottom:10}}>基本設定</div>
            <div style={{marginBottom:10}}>
              <label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",display:"block",marginBottom:4}}>市区町村（地域単価）</label>
              <select className="fi" value={form.city} onChange={function(e){ upd("city", e.target.value); }} style={{fontWeight:700}}>
                {Object.entries(SHIZUOKA_TANKA).map(function(entry){
                  const c = entry[0]; const t = entry[1];
                  return <option key={c} value={c}>{c}（{t}円/単位）</option>;
                })}
              </select>
            </div>
            <div style={{marginBottom:10}}>
              <label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",display:"block",marginBottom:6}}>サービス種別</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {SERVICE_TYPE_MASTER.map(function(s){
                  const isActive = form.serviceCode === s.code;
                  return (
                    <button key={s.code}
                      onClick={function(){ upd("serviceCode", s.code); upd("unitPrice", s.unit); }}
                      style={{padding:"7px 10px",borderRadius:9,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",borderColor:isActive?"var(--tl)":"var(--bd)",background:isActive?"#cce6f5":"var(--bg)",color:isActive?"var(--tl)":"var(--tx2)",lineHeight:1.4,textAlign:"left"}}>
                      <div>{s.label}</div>
                      <div style={{fontSize:10,opacity:.75,marginTop:2}}>{s.unit}単位/日</div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
              <div>
                <label style={{fontSize:10,fontWeight:700,color:"var(--tl)",display:"block",marginBottom:4}}>🏫 放課後日数</label>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <input className="fi" type="number" value={form.serviceDays} min={0} max={31} onChange={function(e){ upd("serviceDays", +e.target.value); }} style={{maxWidth:80,textAlign:"center"}}/>
                  <span style={{fontSize:11,color:"var(--tx3)"}}>日 × {form.unitPrice}</span>
                </div>
              </div>
              <div>
                <label style={{fontSize:10,fontWeight:700,color:"var(--am)",display:"block",marginBottom:4}}>🎌 休日日数</label>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <input className="fi" type="number" value={form.holidayDays || 0} min={0} max={31} onChange={function(e){ upd("holidayDays", +e.target.value); }} style={{maxWidth:80,textAlign:"center"}}/>
                  <span style={{fontSize:11,color:"var(--tx3)"}}>日 × {holidayUnit}</span>
                </div>
              </div>
            </div>
            <div style={{background:"#eef6fc",borderRadius:8,padding:"8px 12px",fontSize:12,color:"var(--tx2)"}}>
              放課後{form.serviceDays}日×{form.unitPrice} + 休日{form.holidayDays || 0}日×{holidayUnit} = <strong style={{color:"var(--tl)"}}>{baseUnits.toLocaleString()}単位</strong>（{Math.round(baseUnits * localTanka).toLocaleString()}円）
            </div>
          </div>

          {ADDON_CATEGORIES.map(function(cat){
            const catAddons = ADDON_MASTER.filter(function(a){ return a.category === cat; });
            return (
              <div key={cat} style={{marginBottom:12}}>
                <div style={{fontSize:11,fontWeight:700,color:"var(--tx2)",letterSpacing:2,marginBottom:7,paddingLeft:2}}>{cat}加算</div>
                <div style={{display:"flex",flexDirection:"column",gap:7}}>
                  {catAddons.map(function(m){
                    const active = form.addons.find(function(a){ return a.key === m.key; });
                    const adDays = (active && active.days) ? active.days : form.serviceDays;
                    const units = m.rate ? Math.round(baseUnits * m.rate) : m.perDay ? adDays * m.unit : ((active && active.count) || 1) * m.unit;
                    const borderCol = active ? "var(--tl)" : "var(--bd)";
                    const bgCol = active ? "#eef6fc" : "var(--bg)";
                    const checkBgCol = active ? "var(--tl)" : "var(--wh)";
                    return (
                      <div key={m.key} style={{background:bgCol,border:"1.5px solid "+borderCol,borderRadius:10,padding:"10px 12px",transition:"all .15s"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",flex:1}} onClick={function(){ toggleAddon(m.key); }}>
                            <div style={{width:20,height:20,borderRadius:5,border:"2px solid "+borderCol,background:checkBgCol,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s"}}>
                              {active && <span style={{color:"#fff",fontSize:13,lineHeight:1}}>✓</span>}
                            </div>
                            <div>
                              <div style={{fontSize:13,fontWeight:active?700:500,color:active?"var(--tl)":"var(--tx2)"}}>{m.label}</div>
                              <div style={{fontSize:10,color:"var(--tx3)",marginTop:1}}>
                                {m.rate ? ("基本報酬×"+(m.rate*100).toFixed(1)+"%") : m.perDay ? (m.unit+"単位/日") : (m.unit+"単位/回")}
                              </div>
                            </div>
                          </label>
                          {active && <div style={{fontSize:13,fontWeight:700,fontFamily:"'DM Mono',monospace",color:"var(--tl)",minWidth:70,textAlign:"right"}}>+{units.toLocaleString()}単位</div>}
                        </div>
                        {active && m.perDay && (
                          <div style={{marginTop:8,display:"flex",alignItems:"center",gap:8}}>
                            <label style={{fontSize:10,color:"var(--tx3)",whiteSpace:"nowrap"}}>適用日数:</label>
                            <input type="number" value={adDays} min={0} max={31}
                              onChange={function(e){ updAddonDays(m.key, +e.target.value); }}
                              style={{width:64,padding:"4px 8px",borderRadius:7,border:"1.5px solid var(--bd)",fontSize:12,fontFamily:"'DM Mono',monospace",textAlign:"center",background:"var(--wh)"}}/>
                            <span style={{fontSize:10,color:"var(--tx3)"}}>日</span>
                            {adDays !== form.serviceDays && <span style={{fontSize:10,color:"var(--am)",fontWeight:700}}>※全日数と異なります</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div style={{background:"#eef8f2",border:"1.5px solid #98d8b0",borderRadius:10,padding:"12px 14px",marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:700,color:"#155a30",letterSpacing:2,marginBottom:8}}>請求内訳プレビュー</div>
            <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid rgba(152,216,176,0.3)"}}>
              <span style={{fontSize:12}}>🏫 放課後 {form.serviceDays}日 × {form.unitPrice}単位</span>
              <span style={{fontSize:12,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{((form.serviceDays||0)*(form.unitPrice||0)).toLocaleString()}単位</span>
            </div>
            {(form.holidayDays || 0) > 0 && (
              <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid rgba(152,216,176,0.3)"}}>
                <span style={{fontSize:12}}>🎌 休日 {form.holidayDays}日 × {holidayUnit}単位</span>
                <span style={{fontSize:12,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{((form.holidayDays||0)*holidayUnit).toLocaleString()}単位</span>
              </div>
            )}
            {form.addons.map(function(a){
              const m = ADDON_MASTER.find(function(x){ return x.key === a.key; });
              if(!m) return null;
              const u = m.rate ? Math.round(baseUnits*m.rate) : m.perDay ? (a.days||form.serviceDays)*m.unit : (a.count||1)*m.unit;
              return (
                <div key={a.key} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid rgba(152,216,176,0.3)"}}>
                  <span style={{fontSize:12,color:"var(--tl)"}}>{m.label}</span>
                  <span style={{fontSize:12,fontWeight:700,color:"var(--tl)",fontFamily:"'DM Mono',monospace"}}>+{u.toLocaleString()}単位</span>
                </div>
              );
            })}
            <div style={{display:"flex",justifyContent:"space-between",padding:"7px 0 0",marginTop:3}}>
              <span style={{fontSize:14,fontWeight:900,color:"#155a30"}}>合計</span>
              <span style={{fontSize:14,fontWeight:900,fontFamily:"'DM Mono',monospace",color:"#155a30"}}>{totalU.toLocaleString()}単位 = <span style={{color:"var(--am)"}}>{totalYen.toLocaleString()}円</span></span>
            </div>
          </div>

          <button className="bsave" onClick={save}>この設定を保存する</button>
        </div>
      </div>
    </div>
  );
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
  const buildAuto=(date)=>{
    const dk=date;
    const staffIns=store.recs.filter(r=>r.type==="staff_in"&&r.facilityId===user.selectedFacilityId&&r.time?.includes(date.replace(/-/g,"/")));
    const staffOuts=store.recs.filter(r=>r.type==="staff_out"&&r.facilityId===user.selectedFacilityId&&r.time?.includes(date.replace(/-/g,"/")));
    const userIns=store.recs.filter(r=>r.type==="user_in"&&r.facilityId===user.selectedFacilityId&&r.time?.includes(date.replace(/-/g,"/")));
    const userOuts=store.recs.filter(r=>r.type==="user_out"&&r.facilityId===user.selectedFacilityId&&r.time?.includes(date.replace(/-/g,"/")));
    const photos=store.recs.filter(r=>r.type==="photo"&&r.facilityId===user.selectedFacilityId&&r.time?.includes(date.replace(/-/g,"/")));
    const staffList=staffIns.map(r=>{
      const out=staffOuts.find(o=>o.staffId===r.staffId);
      const s=store.dynStaff.find(s=>s.id===r.staffId);
      return {id:r.staffId,name:r.staffName,clockIn:r.time?.slice(-8,-3)||"",clockOut:out?.time?.slice(-8,-3)||"",temp:r.temp,role:s?.role||"staff"};
    });
    const userList=userIns.map(r=>{
      const out=userOuts.find(o=>o.userId===r.userId);
      const attStatus=store.getAtt(r.userId,dk);
      return {id:r.userId,name:r.userName,arrivalTime:r.time?.slice(-8,-3)||"",departTime:out?.time?.slice(-8,-3)||"",temp:r.temp,transport:r.transport,status:attStatus||"出席"};
    });
    // 出欠データから予定者も含める
    const plannedUsers=store.dynUsers.filter(u=>u.facilityId===user.selectedFacilityId&&u.active!==false&&store.getAtt(u.id,dk)==="予定"&&!userList.find(x=>x.id===u.id));
    plannedUsers.forEach(u=>userList.push({id:u.id,name:u.name,arrivalTime:"",departTime:"",temp:"",transport:u.hasTransport?"あり":"なし",status:"予定"}));
    return {staffList,userList,photos:photos.slice(0,6).map(p=>({activity:p.activity,userName:p.userName,comment:p.comment}))};
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
      activities:[
        {time:"14:00",title:"来所・体温チェック",detail:"利用者の来所確認・健康観察を実施",staff:""},
        {time:"14:30",title:"",detail:"",staff:""},
        {time:"15:30",title:"",detail:"",staff:""},
        {time:"17:00",title:"退所準備",detail:"",staff:""},
      ],
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
  const save=(status)=>{const r={...rep,status,savedAt:nowStr()};store.addDailyReport(r);setRep(r);setMode("list");};

  // 日付変更時にレポートを再セット
  const changeDate=(d)=>{setSelDate(d);const ex=store.dailyReports.find(r=>r.date===d&&r.facilityId===user.selectedFacilityId);setRep(ex||initReport(d));};

  const WEATHER_OPTS=["晴れ","曇り","雨","雪","晴れのち曇り","曇りのち雨"];
  const reports=store.dailyReports.filter(r=>r.facilityId===user.selectedFacilityId).sort((a,b)=>b.date>a.date?1:-1);

  // ===== 詳細表示 =====
  if(mode==="view"&&viewRep) return <div className="fl-wrap">
    <div className="fl-hd">
      <button className="bback" onClick={()=>setMode("list")}>← 戻る</button>
      <div className="fl-title">📓 {viewRep.date} 業務日報</div>
      <button className="bexp" style={{marginLeft:"auto",background:"#fff8f0",borderColor:"var(--ac)",color:"var(--ac)"}}
        onClick={()=>printDailyReport(viewRep,fac?.name||"")}>🖨️ 印刷</button>
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
        <span style={{padding:"2px 9px",borderRadius:10,fontSize:11,fontWeight:700,background:viewRep.status==="確認済"?"#d0eedd":"#fce8c8",color:viewRep.status==="確認済"?"#155a30":"#a06010"}}>{viewRep.status}</span>
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
          <td style={{padding:"7px 8px",textAlign:"center"}}><span style={{fontSize:10,padding:"2px 7px",borderRadius:8,background:s.role==="manager"?"#cce6f5":"var(--bg)",color:s.role==="manager"?"#005a8a":"var(--tx3)",fontWeight:700}}>{s.role==="manager"?"管理者":"一般"}</span></td>
        </tr>)}</tbody>
      </table></div>
    </div>
    {/* 利用者一覧 */}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:14,marginBottom:10,boxShadow:"var(--sh)"}}>
      <div style={{fontSize:10,fontWeight:700,color:"var(--gr)",letterSpacing:2,marginBottom:10}}>利用者来所一覧</div>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <thead><tr style={{background:"#eef8f2"}}>
          {["氏名","来所","退所","体温","送迎","状態"].map(h=><th key={h} style={{padding:"6px 8px",textAlign:h==="氏名"?"left":"center",fontSize:10,fontWeight:700,color:"var(--tx2)",borderBottom:"2px solid #98d8b0"}}>{h}</th>)}
        </tr></thead>
        <tbody>{(viewRep.userList||[]).map((u,i)=><tr key={i} style={{borderBottom:"1px solid var(--bg2)"}}>
          <td style={{padding:"7px 8px",fontWeight:700}}>{u.name}</td>
          <td style={{padding:"7px 8px",textAlign:"center",fontFamily:"'DM Mono',monospace"}}>{u.arrivalTime||"—"}</td>
          <td style={{padding:"7px 8px",textAlign:"center",fontFamily:"'DM Mono',monospace"}}>{u.departTime||"—"}</td>
          <td style={{padding:"7px 8px",textAlign:"center",color:parseFloat(u.temp)>=37.5?"var(--ro)":"var(--gr)",fontWeight:700}}>{u.temp?""+u.temp+"℃":"—"}</td>
          <td style={{padding:"7px 8px",textAlign:"center"}}>{u.transport||"—"}</td>
          <td style={{padding:"7px 8px",textAlign:"center"}}><span style={{fontSize:10,padding:"2px 7px",borderRadius:8,fontWeight:700,background:u.status==="出席"?"#d0eedd":u.status==="欠席"?"#fad4d0":"#cce6f5",color:u.status==="出席"?"#155a30":u.status==="欠席"?"#a02818":"#005a8a"}}>{u.status}</span></td>
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
        {Array.from({length:6},(_,i)=>{const p=(viewRep.photos||[])[i];return <div key={i} style={{aspectRatio:"4/3",borderRadius:9,border:"1px solid var(--bd)",background:p?.activity?"#daeef8":"var(--bg)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,padding:8}}>
          {p?.activity?<><div style={{fontSize:26}}>📸</div><div style={{fontSize:11,fontWeight:700,color:"var(--tl)",textAlign:"center"}}>{p.activity}</div><div style={{fontSize:10,color:"var(--tx3)"}}>{p.userName}</div>{p.comment&&<div style={{fontSize:10,color:"var(--tx3)",textAlign:"center"}}>{p.comment}</div>}</>
          :<><div style={{fontSize:22,opacity:.3}}>📷</div><div style={{fontSize:10,color:"var(--bda)"}}>写真{i+1}</div></>}
        </div>;})}
      </div>
    </div>}
    {viewRep.incidentDetail&&<div style={{background:"#fdf5f4",border:"1px solid #f0a090",borderRadius:11,padding:14,marginBottom:10}}><div style={{fontSize:10,fontWeight:700,color:"var(--ro)",letterSpacing:2,marginBottom:7}}>⚠ 特記事項・ヒヤリハット</div><div style={{fontSize:13,color:"var(--tx2)",lineHeight:1.7}}>{viewRep.incidentDetail}</div></div>}
    {viewRep.parentNote&&<div style={{background:"#fff8f0",border:"1px solid #e8b870",borderRadius:11,padding:14,marginBottom:10}}><div style={{fontSize:10,fontWeight:700,color:"var(--am)",letterSpacing:2,marginBottom:7}}>保護者連絡・引継ぎ</div><div style={{fontSize:13,color:"var(--tx2)",lineHeight:1.7}}>{viewRep.parentNote}</div></div>}
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
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{WEATHER_OPTS.map(w=><button key={w} onClick={()=>updRep("weather",w)} style={{padding:"5px 10px",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",borderColor:rep.weather===w?"var(--tl)":"var(--bd)",background:rep.weather===w?"#cce6f5":"var(--bg)",color:rep.weather===w?"var(--tl)":"var(--tx3)"}}>{w}</button>)}</div>
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
      {(rep.userList||[]).map((u,i)=><div key={i} style={{display:"grid",gridTemplateColumns:"1fr auto auto 60px 50px",gap:5,marginBottom:6,alignItems:"center"}}>
        <div style={{fontWeight:700,fontSize:12,padding:"4px 2px"}}>{u.name}</div>
        <TimePicker value={u.arrivalTime||""} onChange={v=>updUser(i,"arrivalTime",v)} label="来所時刻"/>
        <TimePicker value={u.departTime||""} onChange={v=>updUser(i,"departTime",v)} label="退所時刻"/>
        <input className="fi" value={u.temp||""} placeholder="36.5" onChange={e=>updUser(i,"temp",e.target.value)} style={{fontSize:11,padding:"5px 6px",textAlign:"center"}}/>
        <select className="fi" value={u.status||"出席"} onChange={e=>updUser(i,"status",e.target.value)} style={{fontSize:11,padding:"5px 4px"}}>
          {["出席","欠席","予定","早退"].map(s=><option key={s}>{s}</option>)}
        </select>
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
        <button onClick={()=>removeActivity(i)} style={{padding:"5px",borderRadius:6,background:"#fad4d0",border:"1px solid #f0a090",color:"#a02818",cursor:"pointer",fontSize:12,lineHeight:1}}>×</button>
      </div>)}
      <div style={{display:"grid",gridTemplateColumns:"auto 1fr 1.5fr 70px 32px",gap:5,marginTop:4}}>
        {["時刻","活動名","内容・詳細","担当者",""].map((h,i)=><div key={i} style={{fontSize:10,color:"var(--tx3)",textAlign:"center"}}>{h}</div>)}
      </div>
    </div>
    {/* 活動写真（4〜6枚） */}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:14,marginBottom:10,boxShadow:"var(--sh)"}}>
      <div style={{fontSize:10,fontWeight:700,color:"var(--pu)",letterSpacing:2,marginBottom:10}}>活動写真（最大6枚）<span style={{fontSize:10,color:"var(--tx3)",fontWeight:400}}> ※写真記録から自動取込・手動入力も可</span></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
        {Array.from({length:6},(_,i)=>{const p=(rep.photos||[])[i]||{};return <div key={i} style={{border:"1.5px dashed var(--bd)",borderRadius:9,padding:10,background:p.activity?"#eef6fc":"var(--bg)"}}>
          <div style={{aspectRatio:"4/3",background:p.activity?"#daeef8":"var(--bg2)",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:p.activity?28:22,marginBottom:7,opacity:p.activity?1:.5}}>
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
        <span style={{fontSize:11,padding:"2px 9px",borderRadius:10,fontWeight:700,background:r.status==="確認済"?"#d0eedd":"#fce8c8",color:r.status==="確認済"?"#155a30":"#a06010"}}>{r.status}</span>
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
    expired: {bg:"#fad4d0", color:"#a02818", border:"#f0a090", label:"期限切れ",    icon:"🔴"},
    urgent:  {bg:"#fce8c8", color:"#a06010", border:"#e8b870", label:"30日以内",    icon:"🟠"},
    soon:    {bg:"#fef8e6", color:"#8a6200", border:"#e8d870", label:"90日以内",    icon:"🟡"},
    ok:      {bg:"#d0eedd", color:"#155a30", border:"#98d8b0", label:"有効",         icon:"🟢"},
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
    {urgent.length>0&&<div style={{background:"#fdf5f4",border:"1.5px solid #f0a090",borderRadius:11,padding:"12px 14px",marginBottom:8}}>
      <div style={{fontSize:12,fontWeight:900,color:"#a02818",marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
        🔴 要対応 ({urgent.length}件)
      </div>
      {urgent.map((a,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:i<urgent.length-1?"1px solid rgba(240,160,144,0.3)":"none"}}>
        <div>
          <span style={{fontSize:12,fontWeight:700,color:"#a02818"}}>{a.type}</span>
          {a.msg
            ? <span style={{fontSize:11,color:"#a02818",marginLeft:6}}>（{a.msg}）</span>
            : <span style={{fontSize:11,color:"#a02818",marginLeft:6}}>
                {a.status==="expired"?"期限切れ: ":"30日以内: "}{a.date||""}
              </span>
          }
        </div>
        {onTabClick&&<button onClick={()=>onTabClick(a.tab)} style={{padding:"3px 10px",borderRadius:7,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"#a02818",border:"none",color:"#fff"}}>確認 →</button>}
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
  const SS={"申請中":["#fce8c8","#a06010"],"承認":["#d0eedd","#155a30"],"却下":["#fad4d0","#a02818"]};
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
      <button onClick={()=>store.updPaidLeaveReq(r.id,{status:"承認",comment,approvedAt:todayISO()})} style={{flex:1,padding:"10px",borderRadius:9,background:"#d0eedd",border:"1.5px solid #98d8b0",color:"#155a30",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>✅ 承認</button>
      <button onClick={()=>store.updPaidLeaveReq(r.id,{status:"却下",comment,approvedAt:todayISO()})} style={{flex:1,padding:"10px",borderRadius:9,background:"#fad4d0",border:"1.5px solid #f0a090",color:"#a02818",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>❌ 却下</button>
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
  const SS={"申請中":["#fce8c8","#a06010"],"承認":["#d0eedd","#155a30"],"却下":["#fad4d0","#a02818"]};
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
      {myRemaining<=0&&<div style={{background:"#fdf5f4",border:"1px solid #f0a090",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:13,color:"var(--ro)",fontWeight:700}}>⚠ 有給残日数がありません（残: {myRemaining}日）</div>}
      <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:16,marginBottom:12,boxShadow:"var(--sh)"}}>
        <div style={{fontSize:10,fontWeight:700,color:"var(--tl)",letterSpacing:2,marginBottom:12}}>有給休暇申請</div>
        <div style={{marginBottom:12}}>
          <label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",display:"block",marginBottom:6}}>取得種別</label>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {["全日","半日（午前）","半日（午後）","時間休"].map(t=><button key={t} onClick={()=>upd("type",t)} style={{padding:"7px 12px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",borderColor:form.type===t?"var(--tl)":"var(--bd)",background:form.type===t?"#cce6f5":"var(--bg)",color:form.type===t?"var(--tl)":"var(--tx3)"}}>
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
            {[0.5,1,2,3,4,5].map(d=><button key={d} onClick={()=>upd("days",d)} style={{padding:"7px 11px",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'DM Mono',monospace",border:"1.5px solid",borderColor:form.days===d?"var(--tl)":"var(--bd)",background:form.days===d?"#cce6f5":"var(--bg)",color:form.days===d?"var(--tl)":"var(--tx3)"}}>
              {d}日
            </button>)}
          </div>
        </div>
        <div style={{marginBottom:12}}>
          <label style={{fontSize:10,fontWeight:700,color:"var(--tx2)",display:"block",marginBottom:5}}>取得理由 <span style={{color:"var(--ro)"}}>*</span></label>
          <textarea className="fta" style={{minHeight:72}} placeholder="例）私用のため / 子の学校行事 / 通院" value={form.reason} onChange={e=>upd("reason",e.target.value)}/>
        </div>
        <div style={{background:"#eef6fc",borderRadius:9,padding:"9px 12px",marginBottom:12,fontSize:12}}>
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
              <td style={{padding:"9px 10px",textAlign:"center"}}><span style={{padding:"3px 9px",borderRadius:8,fontWeight:900,background:rem<=3?"#fad4d0":rem<=7?"#fce8c8":"#d0eedd",color:rem<=3?"#a02818":rem<=7?"#a06010":"#155a30"}}>{rem}日</span></td>
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
  "児童発達支援管理責任者",
  "管理者",
  "臨床心理士・公認心理師",
  "作業療法士",
  "理学療法士",
  "言語聴覚士",
  "看護師・准看護師",
  "普通自動車免許",
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
    expired: {bg:"#fad4d0",color:"#a02818",label:"期限切れ"},
    soon:    {bg:"#fce8c8",color:"#a06010",label:"期限間近"},
    ok:      {bg:"#d0eedd",color:"#155a30",label:"有効"},
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
            ? <div style={{border:"1.5px solid #98d8b0",borderRadius:10,padding:"20px",background:"#eef8f2",textAlign:"center"}}>
                <div style={{fontSize:40,marginBottom:8}}>📄</div>
                <div style={{fontWeight:700,color:"#155a30",fontSize:13,marginBottom:4}}>コピー登録済み</div>
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
          <button onClick={()=>{store.delQualDoc(viewDoc.id);setViewDoc(null);}} style={{padding:"8px 18px",borderRadius:9,background:"#fad4d0",border:"1.5px solid #f0a090",color:"#a02818",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>🗑️ 削除</button>
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
          {QUAL_CATEGORIES.map(c=><button key={c} onClick={()=>upd("category",c)} style={{padding:"7px 12px",borderRadius:9,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",borderColor:form.category===c?"var(--tl)":"var(--bd)",background:form.category===c?"#cce6f5":"var(--bg)",color:form.category===c?"var(--tl)":"var(--tx2)"}}>
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
                  <div style={{fontWeight:700,color:"#155a30",fontSize:13,marginBottom:4}}>コピー登録済み</div>
                  <div style={{fontSize:11,color:"var(--tx3)",marginBottom:10}}>実際の証書コピーが登録されました</div>
                  <button onClick={()=>upd("hasCopy",false)} style={{padding:"6px 14px",borderRadius:8,background:"#fad4d0",border:"1px solid #f0a090",color:"#a02818",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>
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
        }} style={{padding:"6px 12px",borderRadius:8,background:"#fad4d0",border:"1.5px solid #f0a090",color:"#a02818",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",marginLeft:6}}>🗑️ 削除</button>}
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
        <div style={{background:"#fdf5f4",border:"1px solid #f0a090",borderRadius:10,padding:"10px 14px",marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:700,color:"var(--ro)",marginBottom:4}}>⚠ 要確認の資格証書</div>
          {myDocs.filter(d=>isExpiring(d)==="expired").map(d=><div key={d.id} style={{fontSize:12,color:"#a02818"}}>・{d.name||d.category}（期限切れ: {d.expiryDate}）</div>)}
          {myDocs.filter(d=>isExpiring(d)==="soon").map(d=><div key={d.id} style={{fontSize:12,color:"#a06010"}}>・{d.name||d.category}（期限間近: {d.expiryDate}）</div>)}
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
              const cardBorderColor = st==="expired"?"#f0a090":st==="soon"?"#e8b870":"var(--bd)";
              return <div key={d.id} style={{background:"var(--wh)",border:"1.5px solid "+cardBorderColor,borderRadius:11,padding:13,cursor:"pointer",boxShadow:"var(--sh)",transition:"all .15s"}}
                onClick={()=>setViewDoc(d)}
                onMouseEnter={e=>e.currentTarget.style.borderColor="var(--tl)"}
                onMouseLeave={e=>e.currentTarget.style.borderColor=st==="expired"?"#f0a090":st==="soon"?"#e8b870":"var(--bd)"}>
                {/* アイコン */}
                <div style={{width:"100%",aspectRatio:"4/3",background:d.hasCopy?"#daeef8":"var(--bg2)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,marginBottom:9}}>
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
          <div style={{width:42,height:42,borderRadius:"50%",background:s.role==="manager"?"linear-gradient(135deg,var(--tl),#0070a0)":"linear-gradient(135deg,var(--gr),var(--tl))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:"#fff",fontWeight:700,flexShrink:0}}>
            {s.name.charAt(0)}
          </div>
          <div>
            <div style={{fontWeight:900,fontSize:14}}>{s.name}{s.active===false&&<span style={{fontSize:10,color:"var(--bda)",marginLeft:5}}>（無効）</span>}</div>
            <div style={{fontSize:11,color:"var(--tx3)",marginTop:1}}>{fac?.name}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <span style={{fontSize:10,padding:"3px 9px",borderRadius:10,fontWeight:700,background:s.role==="manager"?"#cce6f5":s.role==="admin"?"#e8d4f4":"#d0eedd",color:s.role==="manager"?"#005a8a":s.role==="admin"?"#4a1880":"#155a30"}}>
            {s.role==="manager"?"施設管理者":s.role==="admin"?"本部管理者":"一般職員"}
          </span>
          <button onClick={()=>{setSelStaff(s);setScreen("detail");}} style={{padding:"4px 9px",borderRadius:7,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"#eef6fc",border:"1.5px solid #90c8e8",color:"#005a8a"}}>詳細</button>
          {isMgr&&<button onClick={()=>{setSelStaff(s);setScreen("edit");}} style={{padding:"4px 9px",borderRadius:7,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",background:"var(--bg)",border:"1.5px solid var(--bd)",color:"var(--tx3)"}}>編集</button>}
        </div>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",fontSize:11,color:"var(--tx3)"}}>
        {s.employmentType&&<span style={{padding:"2px 7px",borderRadius:7,background:"var(--bg)",border:"1px solid var(--bd)"}}>{s.employmentType}</span>}
        {s.hireDate&&<span>入職: {s.hireDate}</span>}
        {(s.qualifications&&s.qualifications.length>0)
        ? s.qualifications.map(q=><span key={q} style={{padding:"2px 7px",borderRadius:7,background:"#eef6fc",border:"1px solid #90c8e8",color:"#005a8a",marginRight:4,marginBottom:4,display:"inline-block"}}>{q}</span>)
        : s.qualification&&<span style={{padding:"2px 7px",borderRadius:7,background:"#eef6fc",border:"1px solid #90c8e8",color:"#005a8a"}}>{s.qualification}</span>}
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
      <div style={{background:"#cce6f5",borderRadius:9,padding:"9px 14px",fontSize:13,fontWeight:700,color:"#005a8a"}}>在籍 {active.length}名</div>
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
            }} style={{padding:"6px 12px",borderRadius:9,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",borderColor:selected?"var(--tl)":"var(--bd)",background:selected?"#cce6f5":"var(--bg)",color:selected?"var(--tl)":"var(--tx2)"}}>
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

    {isEdit&&<div style={{background:"#fdf5f4",border:"1px solid #f0a090",borderRadius:11,padding:14,marginBottom:12}}>
      <div style={{fontSize:11,fontWeight:700,color:"var(--ro)",marginBottom:8}}>⚠ 在籍状況の変更</div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>upd("active",true)} style={{padding:"8px 18px",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",borderColor:form.active!==false?"#98d8b0":"var(--bd)",background:form.active!==false?"#d0eedd":"var(--bg)",color:form.active!==false?"#155a30":"var(--tx3)"}}>在籍中</button>
        <button onClick={()=>upd("active",false)} style={{padding:"8px 18px",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",borderColor:form.active===false?"#f0a090":"var(--bd)",background:form.active===false?"#fad4d0":"var(--bg)",color:form.active===false?"#a02818":"var(--tx3)"}}>退職・無効</button>
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
  const unread=store.msgs.filter(m=>(user.role==="admin"||m.facilityId===user.selectedFacilityId)&&!m.read).length;
  const cards=[
    {id:"clock_in",icon:"🟢",title:"職員 出勤",desc:"出勤打刻・体温記録",cls:"c1"},
    {id:"clock_out",icon:"🟡",title:"職員 退勤",desc:"退勤打刻",cls:"c2"},
    {id:"user_arrive",icon:"🌟",title:"利用者 来所",desc:"来所・体温・送迎",cls:"c3"},
    {id:"user_depart",icon:"🏠",title:"利用者 退所",desc:"退所・送迎記録",cls:"c4"},
    {id:"photo",icon:"📸",title:"写真ギャラリー",desc:"撮影・活動記録・一覧",cls:"c5"},
    {id:"service",icon:"📋",title:"サービス提供記録",desc:"日々の支援内容",cls:"c3"},
    {id:"messages",icon:"💬",title:"保護者連絡"+(unread>0?` (${unread})`:``),desc:"メッセージ・連絡帳",cls:"c9"},
    {id:"schedule",icon:"📅",title:"生徒予定表",desc:"月間予定・来所管理",cls:"c6"},
    {id:"daily",icon:"📓",title:"業務日報",desc:"日報作成・職員・利用者一覧",cls:"c8"},
    {id:"paidleave",icon:"🌴",title:"有給管理",desc:"申請・残日数・承認",cls:"c3"},
    {id:"users",icon:"👤",title:"利用者管理",desc:"フェイスシート・計画・モニタリング",cls:"c4"},
    ...(isMgr?[
      {id:"attendance",icon:"📅",title:"出欠管理",desc:"利用者カレンダー",cls:"c7"},
      {id:"shift",icon:"📆",title:"シフト管理",desc:"出勤予定・月間勤務表",cls:"c2"},
      {id:"transport",icon:"🚌",title:"送迎管理",desc:"送迎ルート・担当",cls:"c8"},
      {id:"kokuho",icon:"💴",title:"国保連請求",desc:"サービス利用・請求管理",cls:"c6"},
      {id:"staffmgmt",icon:"👥",title:"スタッフ管理",desc:"登録・編集・給与口座",cls:"c1"},
      {id:"admin",icon:"📊",title:"管理画面",desc:"一覧・修正・CSV出力",cls:"c10"},
    ]:[]),
  ];
  return <div><div className="hh"><div className="ht">GO GROUP</div><div className="hs">勤怠・検温・利用記録</div><div className="hd">{todayDisplay()} ｜ {fac?.name}</div></div>
    <div className="hg">{cards.map(c=><div key={c.id} className={`hc ${c.cls}`} onClick={()=>onNav(c.id)}><div className="ci">{c.icon}</div><div className="ct">{c.title}</div><div className="cd2">{c.desc}</div></div>)}</div>
  </div>;
}

// ==================== APP ROOT ====================

// ==================== 生徒予定表 ====================
const SCHEDULE_STATUS = {
  "来所予定": { label:"来所予定", color:"#005a8a", bg:"#cce6f5", short:"予" },
  "来所":     { label:"来所（入室）", color:"#155a30", bg:"#d0eedd", short:"来" },
  "欠席":     { label:"欠席", color:"#a02818", bg:"#fad4d0", short:"欠" },
  "体調不良": { label:"体調不良", color:"#8a6200", bg:"#fef8e6", short:"体" },
  "キャンセル":{ label:"キャンセル", color:"#555", bg:"#e8e8e8", short:"キャ" },
  "休所":     { label:"休所", color:"#7030b8", bg:"#e8d4f4", short:"休" },
};

function ScheduleScreen({ user, store, onBack }) {
  const today = new Date();
  const [vm, setVm] = useState({ y: today.getFullYear(), m: today.getMonth() + 1 });
  const [selFac, setSelFac] = useState(user.selectedFacilityId || "all");
  const [viewMode, setViewMode] = useState("calendar");
  const [editCell, setEditCell] = useState(null);
  const [selDate, setSelDate] = useState(todayISO());

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
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>body{font-family:'Noto Sans JP',sans-serif;font-size:8pt;margin:10mm;}h2{font-size:13pt;}table{border-collapse:collapse;width:100%;}th,td{border:1px solid #ccc;padding:3px 4px;text-align:center;white-space:nowrap;font-size:7.5pt;}th{background:#e8f0ff;font-weight:700;}.we{background:#f5f5f5;color:#bbb;}.come{background:#d0eedd;color:#155a30;font-weight:700;}.plan{background:#cce6f5;color:#005a8a;}.absent{background:#fad4d0;color:#a02818;}.name{text-align:left;font-weight:700;}</style></head><body><h2>生徒予定表 ${facName} ${vm.y}年${vm.m}月</h2><table><thead><tr><th class="name">利用者名</th>${dayList.map(d=>`<th class="${isWe(d)?"we":""}">${d}<br/>${dowLabel[getDow(d)]}</th>`).join("")}<th>予定</th><th>来所</th><th>欠席</th></tr></thead><tbody>${users.map(u=>{const cnt=countByUser(u.id);return `<tr><td class="name">${u.name}</td>${dayList.map(d=>{if(isWe(d))return`<td class="we"></td>`;const st=getStatus(u.id,d);const cls=st==="来所"?"come":st==="来所予定"?"plan":st==="欠席"?"absent":"";const short={"来所":"来","来所予定":"予","欠席":"欠","体調不良":"体","キャンセル":"キャ","休所":"休"}[st]||"";return`<td class="${cls}">${short}</td>`;}).join("")}<td style="background:#eef8f2;font-weight:700">${cnt.come}</td><td style="background:#eef8f2;color:#155a30;font-weight:700">${cnt.actual}</td><td style="background:#fdf5f4;color:#a02818;font-weight:700">${cnt.absent}</td></tr>`;}).join("")}</tbody></table><div style="margin-top:8px;font-size:7pt;color:#888">出力: ${new Date().toLocaleString("ja-JP")}</div></body></html>`;
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
              {!we&&c.come>0&&<div style={{fontSize:9,fontWeight:700,color:"#155a30",lineHeight:1}}>{c.come}人</div>}
              {!we&&(c.come>0||c.absent>0)&&<div className="dots">{c.come>0&&<div className="dot dg"/>}{c.absent>0&&<div className="dot dr"/>}</div>}
            </div>;
          })}
        </div>
      </div>
      <div style={{marginBottom:12}}>
        <div style={{fontSize:15,fontWeight:900,marginBottom:8}}>{dlabel(selDate)} の状況</div>
        {(()=>{const d=parseInt(selDate.split("-")[2]);const c=countByDay(d);const total=users.length;return(
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
            <div style={{background:"#d0eedd",borderRadius:10,padding:"8px 14px",display:"flex",gap:6,alignItems:"center"}}><span style={{fontSize:20,fontWeight:900,color:"#155a30"}}>{c.come}</span><span style={{fontSize:11,color:"#155a30"}}>来所予定</span></div>
            <div style={{background:"#fad4d0",borderRadius:10,padding:"8px 14px",display:"flex",gap:6,alignItems:"center"}}><span style={{fontSize:20,fontWeight:900,color:"#a02818"}}>{c.absent}</span><span style={{fontSize:11,color:"#a02818"}}>欠席</span></div>
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
                <span style={{fontSize:10,padding:"2px 7px",borderRadius:7,fontWeight:700,background:u.transportTo?"#cce6f5":"var(--bg)",color:u.transportTo?"#005a8a":"var(--tx3)",border:"1px solid "+(u.transportTo?"#88c4e8":"var(--bd)")}}>迎</span>
                <span style={{fontSize:10,padding:"2px 7px",borderRadius:7,fontWeight:700,background:u.transportFrom?"#d0eedd":"var(--bg)",color:u.transportFrom?"#155a30":"var(--tx3)",border:"1px solid "+(u.transportFrom?"#98d8b0":"var(--bd)")}}>送</span>
              </div>
              {isMgr&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
                <button onClick={()=>setSchedule(u.id,d,"来所",u.transportTo,u.transportFrom)} style={{padding:"7px 4px",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",borderColor:u.status==="来所"?"#155a30":"var(--bd)",background:u.status==="来所"?"#d0eedd":"var(--wh)",color:u.status==="来所"?"#155a30":"var(--tx2)"}}>✅ 入室</button>
                <button onClick={()=>setSchedule(u.id,d,"欠席",false,false)} style={{padding:"7px 4px",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid",borderColor:u.status==="欠席"?"#a02818":"var(--bd)",background:u.status==="欠席"?"#fad4d0":"var(--wh)",color:u.status==="欠席"?"#a02818":"var(--tx2)"}}>❌ 欠席</button>
                <button onClick={()=>setEditCell({uid:u.id,day:d,name:u.name,status:u.status,transportTo:u.transportTo,transportFrom:u.transportFrom})} style={{padding:"6px 4px",borderRadius:8,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif",border:"1.5px solid var(--bd)",background:"var(--bg)",color:"var(--tx3)",gridColumn:"span 2"}}>✏️ 詳細設定</button>
              </div>}
            </div>;
          })}
        </div>
      </div>
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
            {dayList.map(d=><th key={d} style={{border:"1px solid var(--bd)",padding:"4px 2px",background:isWe(d)?"#f5f5f5":getDateStr(d)===todayISO()?"#cce6f5":"var(--bg2)",color:isWe(d)?"#aaa":getDow(d)===0?"var(--ro)":getDow(d)===6?"#005a8a":"var(--tx2)",minWidth:34,textAlign:"center",fontSize:9}}>{d}<br/>{dowLabel[getDow(d)]}</th>)}
            <th style={{border:"1px solid var(--bd)",padding:"4px 5px",background:"var(--bg2)",minWidth:36,fontSize:9}}>予定</th>
            <th style={{border:"1px solid var(--bd)",padding:"4px 5px",background:"#d0eedd",minWidth:36,fontSize:9}}>来所</th>
            <th style={{border:"1px solid var(--bd)",padding:"4px 5px",background:"#fad4d0",minWidth:36,fontSize:9}}>欠席</th>
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
              <td style={{border:"1px solid var(--bd)",padding:"4px 5px",textAlign:"center",fontWeight:700,color:"#155a30",background:"#eef8f2"}}>{cnt.actual}</td>
              <td style={{border:"1px solid var(--bd)",padding:"4px 5px",textAlign:"center",fontWeight:700,color:"#a02818",background:"#fdf5f4"}}>{cnt.absent}</td>
            </tr>;
          })}
          <tr style={{background:"#f0f5ff",borderTop:"2px solid var(--bd)"}}>
            <td style={{padding:"6px 8px",fontWeight:700,fontSize:11,position:"sticky",left:0,background:"#f0f5ff",border:"1px solid var(--bd)"}}>日別来所数</td>
            {dayList.map(d=>{
              if(isWe(d)) return <td key={d} style={{border:"1px solid var(--bd)",background:"#f5f5f5"}}></td>;
              const c=countByDay(d);
              return <td key={d} style={{border:"1px solid var(--bd)",padding:"3px 1px",textAlign:"center"}}>
                <div style={{fontSize:9,fontWeight:700,color:"#155a30"}}>{c.come}</div>
                {c.absent>0&&<div style={{fontSize:8,color:"#a02818"}}>欠{c.absent}</div>}
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
            <button onClick={()=>setTmpTo(!tmpTo)} style={{flex:1,padding:"10px",borderRadius:10,background:tmpTo?"#cce6f5":"var(--bg)",color:tmpTo?"#005a8a":"var(--tx3)",border:"2px solid "+(tmpTo?"#005a8a":"var(--bd)"),fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>🚌 迎（来所時）</button>
            <button onClick={()=>setTmpFrom(!tmpFrom)} style={{flex:1,padding:"10px",borderRadius:10,background:tmpFrom?"#d0eedd":"var(--bg)",color:tmpFrom?"#155a30":"var(--tx3)",border:"2px solid "+(tmpFrom?"#155a30":"var(--bd)"),fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"'Noto Sans JP',sans-serif"}}>🚌 送（帰り）</button>
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
export default function App(){
  const [user,setUser]=useState(()=>{
    try {
      const saved = localStorage.getItem('gogroup_user');
      return saved ? JSON.parse(saved) : null;
    } catch(e) { return null; }
  });
  const [screen,setScreen]=useState("home");
  const store=useStore();
  const logout=()=>{
    localStorage.removeItem('gogroup_user');
    setUser(null);
    setScreen("home");
  };
  if(!user)return <><style>{CSS}</style><div className="app"><LoginScreen onLogin={u=>{
    try { localStorage.setItem('gogroup_user', JSON.stringify(u)); } catch(e) {}
    setUser(u);setScreen("home");
  }}/></div></>;
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
    default:return <HomeScreen user={user} onNav={setScreen} store={store}/>;
  }};
  return <><style>{CSS}</style><div className="app"><nav className="nav"><div className="nbrand">GO <span>GROUP</span></div><div className="nr"><div className="nu"><strong>{user.displayName}</strong><span className="rbadge">{{staff:"支援員",specialist:"専門職員",cdsm:"児童発達支援管理責任者",manager:"管理者",part_qual:"パート（指導員）",part_noqual:"パート（資格なし）",consultant:"相談支援員",admin:"本部管理者"}[user.role]}</span></div><button className="blg" onClick={logout}>ログアウト</button></div></nav><div className="wrap">{render()}</div></div></>;
}

// エントリーポイント
const _root = document.getElementById("root");
if (_root) {
  createRoot(_root).render(<App />);
}
