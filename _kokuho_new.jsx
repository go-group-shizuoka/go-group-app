
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
  const TANKA=getShizuokaTanka(city);
  const master=getBillingMaster(yearMonth);
  const kk=store.kokuho.filter(k=>k.facilityId===facilityId&&k.year===vm.y&&k.month===vm.m);
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
