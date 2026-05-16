
// ==================== 個別支援計画 管理システム ====================
// 設計原則: AIは原案作成まで。最終確定は児発管責任者が承認する。
// 承認フロー: AI生成→担当確認→児発管承認→管理者確認→保護者説明→保護者同意→確定
// 監査対応: 誰が作成・修正・承認したかの完全な履歴を保持する

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
    if(record){
      store.updIspRecord(record.id,{content:f,status:"staff_checked",updatedAt:nowStr(),
        history:[...(record.history||[]),histEntry]});
    } else {
      store.addIspRecord({id:genId(),userId:u.id,facilityId:u.facilityId,
        docType:"assessment",status:"staff_checked",content:f,
        createdBy:user.displayName,createdAt:nowStr(),updatedAt:nowStr(),
        history:[histEntry]});
    }
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
    staffInCharge:user.displayName,frequency:"週3〜4回",achievementDate:"",
    evaluationMethod:"",reviewDate:"",validFrom:"",validTo:"",...init,
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
    if(record){
      store.updIspRecord(record.id,{content:f,updatedAt:nowStr(),
        history:[...(record.history||[]),histEntry]});
    } else {
      store.addIspRecord({id:genId(),userId:u.id,facilityId:u.facilityId,
        docType:"isp_plan",status:"ai_draft",content:f,
        createdBy:user.displayName,createdAt:nowStr(),updatedAt:nowStr(),
        history:[histEntry]});
    }
    setSaving(false);
    onSave();
  };

  return <div style={{paddingBottom:28}}>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
      <button className="bback" onClick={onCancel}>← 戻る</button>
      <div style={{fontSize:15,fontWeight:900}}>📄 個別支援計画 {record?"編集":"作成"}</div>
    </div>

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
        <div className="fg" style={{marginBottom:0}}><label className="fl">担当者</label>
          <input className="fi" value={f.staffInCharge} onChange={e=>upd("staffInCharge",e.target.value)}/></div>
        <div className="fg" style={{marginBottom:0}}><label className="fl">支援頻度</label>
          <input className="fi" value={f.frequency} onChange={e=>upd("frequency",e.target.value)} placeholder="例: 週3〜4回"/></div>
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
          {saving?"保存中…":"💾 原案を保存する"}
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
    if(record){
      store.updIspRecord(record.id,{content:{slots,staffNote},status:"staff_checked",updatedAt:nowStr(),
        history:[...(record.history||[]),histEntry]});
    } else {
      store.addIspRecord({id:genId(),userId:u.id,facilityId:u.facilityId,
        docType:"weekly_plan",status:"staff_checked",content:{slots,staffNote},
        createdBy:user.displayName,createdAt:nowStr(),updatedAt:nowStr(),history:[histEntry]});
    }
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
  const [f,setF]=useState({
    targetPeriod: init.targetPeriod || (latestIsp ? `${latestIsp.content?.validFrom||""}〜${latestIsp.content?.validTo||""}` : ""),
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

  const handleSave=()=>{
    setSaving(true);
    const histEntry={actor:user.displayName,role:user.role,action:record?"更新":"新規作成",at:nowStr(),note:""};
    if(record){
      store.updIspRecord(record.id,{content:f,status:"staff_checked",updatedAt:nowStr(),
        history:[...(record.history||[]),histEntry]});
    } else {
      store.addIspRecord({id:genId(),userId:u.id,facilityId:u.facilityId,
        docType:"monitoring",status:"staff_checked",content:f,
        createdBy:user.displayName,createdAt:nowStr(),updatedAt:nowStr(),history:[histEntry]});
    }
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
    {latestIsp&&<div style={{background:"rgba(44,170,96,0.08)",border:"1px solid rgba(44,170,96,0.25)",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:11}}>
      <div style={{fontWeight:700,color:"var(--gr)",marginBottom:4}}>参照中の個別支援計画</div>
      <div style={{color:"var(--tx2)"}}>期間: {latestIsp.content?.validFrom}〜{latestIsp.content?.validTo}</div>
      <div style={{color:"var(--tx2)",marginTop:2}}>長期目標: {latestIsp.content?.longGoal}</div>
      <div style={{color:"var(--tx2)",marginTop:2}}>短期目標: {latestIsp.content?.shortGoal}</div>
    </div>}
    <div style={{background:"var(--wh)",border:"1px solid var(--bd)",borderRadius:11,padding:16,boxShadow:"var(--sh)"}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        <div className="fg" style={{marginBottom:0}}><label className="fl">実施日</label>
          <input className="fi" type="date" value={f.date} onChange={e=>upd("date",e.target.value)}/></div>
        <div className="fg" style={{marginBottom:0}}><label className="fl">対象期間</label>
          <input className="fi" value={f.targetPeriod} onChange={e=>upd("targetPeriod",e.target.value)} placeholder="例: 2026年4月〜9月"/></div>
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
    if(record){
      store.updIspRecord(record.id,{content:f,updatedAt:nowStr(),
        history:[...(record.history||[]),histEntry]});
    } else {
      store.addIspRecord({id:genId(),userId:u.id,facilityId:u.facilityId,
        docType:"meeting",status:"staff_checked",content:f,
        createdBy:user.displayName,createdAt:nowStr(),updatedAt:nowStr(),history:[histEntry]});
    }
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
function IspDocCard({rec, onOpen, onNew}){
  const docLabel = ISP_DOC_LABELS[rec.docType]||rec.docType;
  const finalized = rec.status==="finalized";
  return <div style={{background:"var(--wh)",border:`1.5px solid ${finalized?"rgba(44,170,96,0.4)":"var(--bd)"}`,borderRadius:11,padding:14,marginBottom:10,boxShadow:"var(--sh)",cursor:"pointer"}}
    onClick={()=>onOpen(rec)}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
      <div style={{fontWeight:700,fontSize:13}}>{ISP_DOC_LABELS[rec.docType]||rec.docType}</div>
      <IspStatusBadge status={rec.status} small/>
    </div>
    <div style={{fontSize:11,color:"var(--tx3)"}}>
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
          onClick={()=>{setEditRec(viewRec);setViewRec(null);}}>✏️ 編集</button>
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
      :tabRecs.map(rec=><IspDocCard key={rec.id} rec={rec} onOpen={r=>{setViewRec(r);setTab(r.docType);}} onNew={()=>setCreating(true)}/>)
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
