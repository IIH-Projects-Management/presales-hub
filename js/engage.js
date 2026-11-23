/* =====================================================================
   CLIENT ENGAGEMENT MANAGEMENT — v4 (accounts → engagements → activities → actions → outcomes)
   Collections: accounts, engagements, actions, risks, requirements, decisions, audit (append-only),
                config/stages. No commercial fields (value, probability, pricing, outcome) are written here.
   History rule: existing dates, ids and texts are never rewritten; new events are appended.
   ===================================================================== */
const DEFAULT_STAGES=[
 {id:'intake',en:'Account intake & assignment',ar:'استقبال الحساب والتكليف',c:'#9A97A8',purpose:['Register the engagement and establish ownership.','تسجيل الارتباط وتحديد المسؤوليات.'],crit:[['Account and engagement registered','تسجيل الحساب والارتباط'],['Account manager and presales PM assigned','تعيين مدير الحساب ومدير مشروع ما قبل البيع'],['Primary client contact identified','تحديد جهة الاتصال الرئيسية لدى العميل']]},
 {id:'planning',en:'Engagement planning',ar:'تخطيط الارتباط',c:'#3F1F55',purpose:['Confirm stakeholders, objectives, resources and activities.','تأكيد أصحاب العلاقة والأهداف والموارد والأنشطة.'],crit:[['Stakeholders confirmed','تأكيد أصحاب العلاقة'],['Engagement objective agreed','الاتفاق على هدف الارتباط'],['Resources and next activities scheduled','جدولة الموارد والأنشطة القادمة']]},
 {id:'discovery',en:'Discovery & requirements',ar:'الاستكشاف والمتطلبات',c:'#5B2C83',purpose:['Understand business needs and define requirements.','فهم احتياجات العمل وتحديد المتطلبات.'],crit:[['Business needs documented','توثيق احتياجات العمل'],['Outstanding clarifications identified','تحديد الإيضاحات المعلّقة'],['Requirements baseline reviewed','مراجعة خط أساس المتطلبات']]},
 {id:'alignment',en:'Solution alignment',ar:'مواءمة الحل',c:'#8E2DBA',purpose:['Assess product fit and technical feasibility.','تقييم ملاءمة المنتج والجدوى الفنية.'],crit:[['Product fit assessed','تقييم ملاءمة المنتج'],['Technical feasibility reviewed by the technical owner','مراجعة الجدوى الفنية من المسؤول الفني'],['Gaps and assumptions recorded','تسجيل الفجوات والافتراضات']]},
 {id:'demo',en:'Demo & client validation',ar:'العرض التوضيحي وتحقق العميل',c:'#6B009D',purpose:['Demonstrate capabilities and capture feedback.','عرض القدرات وتوثيق ملاحظات العميل.'],crit:[['Demo delivered','تقديم العرض التوضيحي'],['Client feedback captured','توثيق ملاحظات العميل'],['Follow-up actions assigned','إسناد إجراءات المتابعة']]},
 {id:'scope',en:'Technical scope & readiness',ar:'النطاق الفني والجاهزية',c:'#B700A5',purpose:['Validate scope, assumptions and dependencies.','التحقق من النطاق والافتراضات والاعتماديات.'],crit:[['Scope and assumptions validated','التحقق من النطاق والافتراضات'],['Dependencies identified','تحديد الاعتماديات'],['Integration, security and hosting needs documented','توثيق احتياجات التكامل والأمن والاستضافة']]},
 {id:'evaluation',en:'Client evaluation & follow-up',ar:'تقييم العميل والمتابعة',c:'#D9468F',purpose:['Manage clarifications, feedback and decisions.','إدارة الإيضاحات والملاحظات والقرارات.'],crit:[['Client clarifications answered','الإجابة على إيضاحات العميل'],['Client decision or feedback recorded','تسجيل قرار العميل أو ملاحظاته']]},
 {id:'handover',en:'Handover or closure',ar:'التسليم أو الإغلاق',c:'#1FA27A',purpose:['Transition the engagement or formally close it.','تسليم الارتباط أو إغلاقه رسمياً.'],crit:[['Handover checklist complete, or closure reason recorded','اكتمال قائمة التسليم أو تسجيل سبب الإغلاق'],['Receiving owner confirmed','تأكيد المستلم']]}];
/* Stage names used before v4 — kept only to show old history entries under their original names */
const LEGACY_STAGE={initial:['Initial engagement','التواصل الأولي'],clarify:['Technical clarifications','الإيضاحات الفنية'],proposal:['Proposal preparation & review','إعداد العرض ومراجعته'],feedback:['Client feedback / evaluation','ملاحظات العميل والتقييم'],new:['New lead','فرصة جديدة'],contacted:['Contacted','تم التواصل'],negotiation:['Negotiation','التفاوض'],won:['Won','فوز'],lost:['Lost','خسارة']};
const LEAD_TO_STAGE={new:'intake',contacted:'intake',discovery:'discovery',demo:'demo',scope:'scope',proposal:'evaluation',negotiation:'evaluation',won:'handover',lost:'handover'};
const OUTCOMES={active:['Active','نشط','#6B009D'],onhold:['On hold','معلّق','#6E6A7C'],cancelled:['Cancelled','ملغى','#B8B4C2'],closed:['Closed','مغلق','#3F1F55'],handedover:['Handed over','تم التسليم','#1FA27A']};
const HEALTH={ontrack:['On track','في المسار','#1FA27A'],atrisk:['At risk','معرّض للخطر','#E0A13A'],blocked:['Blocked','متوقف','#C0392B'],hold:['On hold','معلّق','#6E6A7C'],done:['Completed','مكتمل','#3F1F55']};
const EACT=[['meeting','Client meeting','اجتماع مع العميل','👥'],['workshop','Discovery workshop','ورشة استكشاف','🧭'],['reqworkshop','Requirements workshop','ورشة متطلبات','📋'],['technical','Technical discussion','نقاش فني','⚙'],['demo','Product demonstration','عرض توضيحي للمنتج','▶'],['presentation','Presentation','عرض تقديمي','📊'],['internal','Internal alignment','مواءمة داخلية','🏠'],['email','Email / correspondence','بريد / مراسلات','✉'],['feedback','Client feedback session','جلسة ملاحظات العميل','💬'],['followup','Follow-up call','مكالمة متابعة','📞'],['walkthrough','Solution walkthrough','استعراض الحل','🧩'],['other','Other','أخرى','•']];
const A_STATUS=[['notstarted','Not started','لم يبدأ','#9A97A8'],['inprogress','In progress','قيد التنفيذ','#6B009D'],['pendclient','Pending client','بانتظار العميل','#E0A13A'],['pendinternal','Pending internal team','بانتظار الفريق الداخلي','#D9468F'],['pendvendor','Pending vendor','بانتظار المورّد','#B07D2B'],['blocked','Blocked','متوقف','#C0392B'],['done','Completed','مكتمل','#1FA27A'],['cancelled','Cancelled','ملغى','#B8B4C2']];
const PRIO=[['low','Low','منخفضة','#9A97A8'],['medium','Medium','متوسطة','#3F1F55'],['high','High','عالية','#E0A13A'],['critical','Critical','حرجة','#C0392B']];
const TEAMS=[['presales','Presales','ما قبل البيع'],['solution','Solution architecture','هندسة الحلول'],['product','Product team','فريق المنتج'],['delivery','Delivery','فريق التنفيذ'],['partner','Partner / vendor','الشريك / المورّد'],['client','Client','العميل'],['management','Management','الإدارة'],['other','Other','أخرى']];
const R_TYPES=[['risk','Risk','خطر'],['issue','Issue','مشكلة'],['blocker','Blocker','عائق'],['dependency','Dependency','اعتمادية']];
const PARTIES=[['client','Client','العميل'],['internal','Internal team','الفريق الداخلي'],['vendor','Vendor / partner','المورّد / الشريك'],['management','Management','الإدارة']];
const R_STATUS=[['open','Open','مفتوح','#C0392B'],['monitoring','Monitoring','تحت المراقبة','#E0A13A'],['resolved','Resolved','تم الحل','#1FA27A'],['closed','Closed','مغلق','#9A97A8']];
const REQ_CAT=[['objective','Business objective','هدف العمل'],['usecase','Business use case','حالة استخدام'],['functional','Functional','وظيفي'],['nonfunctional','Non-functional','غير وظيفي'],['integration','Integration','تكامل'],['security','Security','أمن'],['hosting','Hosting','استضافة'],['dependency','Technical dependency','اعتمادية فنية'],['limitation','Product limitation','قيد في المنتج'],['assumption','Solution assumption','افتراض'],['clarification','Clarification request','طلب إيضاح']];
const REQ_STATUS=[['identified','Identified','مرصود','#9A97A8'],['review','Under review','قيد المراجعة','#6B009D'],['clarify','Clarification required','يتطلب إيضاحاً','#E0A13A'],['confirmed','Confirmed','مؤكد','#1FA27A'],['deferred','Deferred','مؤجل','#3F1F55'],['outofscope','Out of scope','خارج النطاق','#B8B4C2']];
const FEAS=[['pending','Not assessed','لم يُقيَّم','#9A97A8'],['feasible','Feasible','ممكن','#1FA27A'],['partial','Partly feasible','ممكن جزئياً','#E0A13A'],['notfeasible','Not feasible','غير ممكن','#C0392B']];
const DEC_STATUS=[['pending','Pending','معلّق','#E0A13A'],['decided','Decided','تم القرار','#1FA27A'],['deferred','Deferred','مؤجل','#3F1F55'],['cancelled','Cancelled','ملغى','#B8B4C2']];
const OLD_ACT={call:'followup',meeting:'meeting',email:'email',demo:'demo',note:'other'};

let ACC={},ENG={},ACTIONS=[],RISKS=[],REQS=[],DECS=[],AUDIT=[],PEOPLE=[],STAGECFG=null,engState='off',engUnsubs=[];
let AF={preset:'open',client:'',eng:'',owner:'',team:'',priority:'',status:'',due:'',q:''},RF={preset:'open',client:'',type:'',impact:'',party:''},RQF={status:'',cat:'',eng:''},DF={preset:'pending'},ACF='';
const tsNorm=o=>{for(const k in o){const v=o[k];if(v&&typeof v==='object'&&typeof v.toDate==='function')o[k]=v.toDate().toISOString()}return o};
const lbl=(arr,id)=>{const x=arr.find(a=>a[0]===id);return x?L(x[1],x[2]):(id||'—')};
const col=(arr,id)=>{const x=arr.find(a=>a[0]===id);return x&&x[3]&&x[3][0]==='#'?x[3]:'#9A97A8'};
const badge=(arr,id)=>`<span class="spill" style="--c:${col(arr,id)}">${lbl(arr,id)}</span>`;
const optList=(arr,v,blank)=>(blank!=null?`<option value="">${blank}</option>`:'')+arr.map(a=>`<option value="${a[0]}" ${a[0]===v?'selected':''}>${L(a[1],a[2])}</option>`).join('');
const isOps=()=>['leadership','lead','pm'].includes(realRole)&&['leadership','lead','pm'].includes(role);
const canReadOps=()=>['leadership','lead','pm','viewer'].includes(realRole)&&role!=='presales';
const opsView=canReadOps;
const isViewer=()=>realRole==='viewer';
const canEditRec=r=>isOps()&&(realRole!=='pm'||!r||!r.pm||!r.pm.uid||r.pm.uid===ME.id);
const nowIso=()=>new Date().toISOString();
const eid=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const mkCode=p=>p+'-'+(Date.now().toString(36).slice(-4)+Math.random().toString(36).slice(2,4)).toUpperCase();
const myName=()=>ME.name||ME.email;
const openA=a=>!['done','cancelled'].includes(a.status);
const openR=r=>['open','monitoring'].includes(r.status);
const isOverdue=a=>openA(a)&&a.due&&a.due<todayStr();
const dueToday=a=>openA(a)&&a.due===todayStr();
const dueWeek=a=>openA(a)&&a.due&&a.due>=todayStr()&&a.due<=dAdd(7);
const riskOverdue=r=>openR(r)&&r.target&&r.target<todayStr();
const norm=s=>String(s||'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const accOf=e=>e&&ACC[e.accountId];
const engName=e=>e?(e.name||accOf(e)?.name||e.org||''):'';
const accName=id=>ACC[id]?.name||ENG[id]?.org||'';

/* ---------------- stages (configurable by Leadership) ---------------- */
const stages=()=>(STAGECFG&&STAGECFG.stages&&STAGECFG.stages.length?STAGECFG.stages:DEFAULT_STAGES).filter(s=>s.active!==false);
const allStages=()=>(STAGECFG&&STAGECFG.stages&&STAGECFG.stages.length?STAGECFG.stages:DEFAULT_STAGES);
const settings=()=>({inactiveDays:14,...(STAGECFG&&STAGECFG.settings||{})});
const stageOf=id=>allStages().find(s=>s.id===id);
const stageLabel=id=>{const s=stageOf(id);if(s)return L(s.en,s.ar);const g=LEGACY_STAGE[id];return g?L(...g):(id||'—')};
const stageColor=id=>stageOf(id)?.c||'#9A97A8';
const stageBadge=id=>`<span class="spill" style="--c:${stageColor(id)}">${stageLabel(id)}</span>`;
/* engagements created before v4 may hold an old stage id: show the nearest v4 stage without rewriting it */
const V3_TO_V4={initial:'intake',clarify:'scope',proposal:'evaluation',feedback:'evaluation'};
const curStage=e=>stageOf(e.stage)?e.stage:(V3_TO_V4[e.stage]||e.stage||'intake');

/* ---------------- data ---------------- */
function engRender(){if(cur.view==='eng'){const a=document.activeElement;if(a&&a.closest&&a.closest('#main')&&/INPUT|TEXTAREA|SELECT/.test(a.tagName))return;render()}else if(['lead','exec','leads'].includes(cur.view)&&document.activeElement?.tagName!=='TEXTAREA')render();else renderTabs()}
function jsonDocs(q,blank){const m={};q.docs.forEach(d=>{let x={};try{x=JSON.parse(d.data().json||'{}')}catch(e){}const top=tsNorm({...d.data()});delete top.json;m[d.id]={...blank(),...x,id:d.id,_top:top}});return m}
function initEngage(){
  engUnsubs.forEach(u=>{try{u()}catch(e){}});engUnsubs=[];
  const sub=(c,f,err)=>engUnsubs.push(DB.collection(c).onSnapshot(f,err||(()=>{})));
  DB.collection('config').doc('stages').get().then(d=>{STAGECFG=null;if(d.exists){const x=d.data();try{STAGECFG=x.json?JSON.parse(x.json):x}catch(e){}}engRender()}).catch(()=>{});
  if(canReadOps()){engState='connecting';
    sub('accounts',q=>{ACC=jsonDocs(q,accBlank);engRender()});
    sub('engagements',q=>{ENG=jsonDocs(q,engBlank);Object.values(ENG).forEach(e=>{if(!e.accountId)e.accountId=e._top.accountId||'';if(!e.name&&e.org)e.name='';});engState='live';engRender()},e=>{engState='error';engRender()});
    sub('actions',q=>{ACTIONS=q.docs.map(d=>tsNorm({...d.data(),id:d.id}));engRender()});
    sub('risks',q=>{RISKS=q.docs.map(d=>tsNorm({...d.data(),id:d.id}));engRender()});
    sub('requirements',q=>{REQS=q.docs.map(d=>tsNorm({...d.data(),id:d.id}));engRender()});
    sub('decisions',q=>{DECS=q.docs.map(d=>tsNorm({...d.data(),id:d.id}));engRender()});
    engUnsubs.push(DB.collection('audit').orderBy('at','desc').limit(400).onSnapshot(q=>{AUDIT=q.docs.map(d=>tsNorm({...d.data(),id:d.id}))},()=>{}));
    if(isOps())DB.collection('users').get().then(q=>{PEOPLE=q.docs.map(d=>({uid:d.id,name:d.data().name||d.data().email,email:d.data().email,role:d.data().role})).filter(p=>p.role&&p.role!=='pending')}).catch(()=>{});
  }else if(realRole==='presales'){engState='live';
    engUnsubs.push(DB.collection('actions').where('ownerUid','==',ME.id).onSnapshot(q=>{ACTIONS=q.docs.map(d=>tsNorm({...d.data(),id:d.id}));engRender()},()=>{}));}
}
function accBlank(){return {id:'',name:'',sector:'',dept:'',city:'',website:'',am:{name:'',uid:''},pm:{name:'',uid:''},strategicNotes:'',stakeholders:[],leadId:'',createdAt:'',createdBy:''}}
function engBlank(){return {id:'',code:'',accountId:'',name:'',objective:'',challenges:'',products:[],solution:'',stage:'intake',stageLog:[],stageHistory:[],outcome:'active',healthLog:[],healthOverride:null,am:{name:'',uid:''},pm:{name:'',uid:''},techLead:{name:'',uid:''},teams:[],activities:[],documents:[],nextMilestone:{title:'',date:''},targetDate:'',latestUpdate:null,leadId:'',legacyStageNotes:[],createdAt:'',createdBy:''}}
function topOf(o,keys){const t={};keys.forEach(k=>{if(o[k]!==undefined&&o[k]!==null)t[k]=o[k]});return t}
async function saveAcc(a){a.updatedAt=nowIso();const body={...a};delete body.id;delete body._top;
  const doc={name:a.name,json:JSON.stringify(body),pmUid:a.pm&&a.pm.uid||'',amUid:a.am&&a.am.uid||'',leadId:a.leadId||'',createdAt:a.createdAt||a.updatedAt,updatedAt:a.updatedAt,updatedBy:ME.id};if(a.migrationBatch)doc.migrationBatch=a.migrationBatch;
  await DB.collection('accounts').doc(a.id).set(doc);ACC[a.id]={...a,_top:doc}}
async function saveEng(e){e.updatedAt=nowIso();const body={...e};delete body.id;delete body._top;
  const doc={accountId:e.accountId||'',name:e.name||'',stage:e.stage||'intake',pmUid:e.pm&&e.pm.uid||'',amUid:e.am&&e.am.uid||'',json:JSON.stringify(body),leadId:e.leadId||'',createdAt:e.createdAt||e.updatedAt,updatedAt:e.updatedAt,updatedBy:ME.id};if(e.migrationBatch)doc.migrationBatch=e.migrationBatch;
  await DB.collection('engagements').doc(e.id).set(doc);ENG[e.id]={...e,_top:doc}}
const deny=err=>toast(isDenied(err)?L('You do not have permission to change this record.','لا تملك صلاحية تعديل هذا السجل.'):L('Could not save: ','تعذّر الحفظ: ')+err.message);
async function saveSafe(fn,obj,msg){try{await fn(obj);if(msg)toast(msg);return true}catch(err){deny(err);return false}}
const clone=o=>{const c=JSON.parse(JSON.stringify(o));delete c._top;return c};
/* append-only audit trail — who, what, when, previous and new value */
function audit(entity,id,summary,changes,ctx){try{DB.collection('audit').add({at:nowIso(),byUid:ME.id,byName:myName(),entity,entityId:id,accountId:ctx&&ctx.accountId||'',engagementId:ctx&&ctx.engagementId||'',summary,changes:(changes||[]).map(c=>({f:c[0],prev:c[1]==null?'':String(c[1]).slice(0,300),next:c[2]==null?'':String(c[2]).slice(0,300)}))}).catch(()=>{})}catch(e){}}
const diffs=(a,b,keys)=>keys.filter(k=>JSON.stringify(a[k]??'')!==JSON.stringify(b[k]??'')).map(k=>[k,typeof a[k]==='object'?JSON.stringify(a[k]):a[k],typeof b[k]==='object'?JSON.stringify(b[k]):b[k]]);
const engActs=e=>(e.activities||[]).slice().sort((a,b)=>String(b.d).localeCompare(String(a.d))||String(b.time||'').localeCompare(String(a.time||'')));
const lastDone=e=>engActs(e).find(a=>a.status!=='planned'&&a.d<=todayStr());
const nextPlanned=e=>(e.activities||[]).filter(a=>a.status==='planned'&&a.d>=todayStr()).sort((a,b)=>(a.d+(a.time||'')).localeCompare(b.d+(b.time||'')))[0];
const engActions=id=>ACTIONS.filter(a=>(a.engagementId||a.clientId)===id);
const engRisks=id=>RISKS.filter(r=>(r.engagementId||r.clientId)===id);
const engReqs=id=>REQS.filter(r=>r.engagementId===id);
const engDecs=id=>DECS.filter(d=>d.engagementId===id);
const accEngs=aid=>Object.values(ENG).filter(e=>e.accountId===aid);
const isActive=e=>!['cancelled','closed','handedover'].includes(e.outcome||'active');
function reqReadiness(id){const rs=engReqs(id);if(!rs.length)return null;const ready=rs.filter(r=>['confirmed','deferred','outofscope'].includes(r.status)).length;return {ready,total:rs.length,pct:Math.round(ready/rs.length*100),clarify:rs.filter(r=>r.status==='clarify').length}}
const nextAction=id=>engActions(id).filter(openA).sort((a,b)=>String(a.due||'9999').localeCompare(String(b.due||'9999')))[0];

/* ---------------- engagement health: explicit, explainable rules ---------------- */
const HEALTH_RULES=()=>[
  ['blocked',L('An open blocker rated High or Critical; a Critical action marked Blocked; or a Critical dependency past its target date','عائق مفتوح عالي أو حرج؛ أو إجراء حرج متوقف؛ أو اعتمادية حرجة تجاوزت تاريخها المستهدف')],
  ['atrisk',L(`An open Critical risk, issue or dependency; an open Low/Medium blocker; an overdue High/Critical action; 3+ overdue actions; the next milestone date has passed; requirement clarifications still open after Discovery; or no activity for ${settings().inactiveDays}+ days with nothing scheduled`,`خطر أو مشكلة أو اعتمادية حرجة مفتوحة؛ أو عائق منخفض/متوسط؛ أو إجراء عالي/حرج متأخر؛ أو 3 إجراءات متأخرة فأكثر؛ أو تجاوز تاريخ المعلم القادم؛ أو إيضاحات متطلبات مفتوحة بعد مرحلة الاستكشاف؛ أو لا نشاط منذ ${settings().inactiveDays} يوماً دون موعد قادم`)],
  ['ontrack',L('None of the above','لا شيء مما سبق')],
  ['hold',L('The engagement is on hold (client pause or decision) — set explicitly','الارتباط معلّق (توقف أو قرار من العميل) — يُحدد صراحةً')],
  ['done',L('The engagement is handed over, closed or cancelled','تم تسليم الارتباط أو إغلاقه أو إلغاؤه')]];
function engHealth(e){
  if(e.healthOverride&&e.healthOverride.status)return {s:e.healthOverride.status,reasons:[L('Set manually','محدد يدوياً')+': '+(e.healthOverride.reason||'')],override:true};
  const oc=e.outcome||'active';if(oc==='onhold')return {s:'hold',reasons:[L('On hold','معلّق')]};if(oc!=='active')return {s:'done',reasons:[lbl(Object.entries(OUTCOMES).map(([k,v])=>[k,...v]),oc)]};
  const rs=engRisks(e.id).filter(openR),as=engActions(e.id).filter(openA),why=[];
  const bHigh=rs.filter(r=>r.type==='blocker'&&['high','critical'].includes(r.impact)),aBlk=as.filter(a=>a.status==='blocked'&&a.priority==='critical'),depLate=rs.filter(r=>r.type==='dependency'&&r.impact==='critical'&&riskOverdue(r));
  if(bHigh.length||aBlk.length||depLate.length){[...bHigh,...depLate].forEach(r=>why.push('⛔ '+r.title));aBlk.forEach(a=>why.push('⛔ '+a.title));return {s:'blocked',reasons:why}}
  rs.filter(r=>r.type!=='blocker'&&r.impact==='critical').forEach(r=>why.push(lbl(R_TYPES,r.type)+': '+r.title));
  rs.filter(r=>r.type==='blocker').forEach(r=>why.push(L('Blocker','عائق')+': '+r.title));
  const od=as.filter(isOverdue),odHigh=od.filter(a=>['high','critical'].includes(a.priority));
  if(odHigh.length)why.push(`${odHigh.length} ${L('overdue high/critical action(s)','إجراء عالي/حرج متأخر')}`);else if(od.length>=3)why.push(`${od.length} ${L('overdue actions','إجراءات متأخرة')}`);
  if(e.nextMilestone&&e.nextMilestone.date&&e.nextMilestone.date<todayStr())why.push(`${L('Milestone date passed','تجاوز تاريخ المعلم')}: ${e.nextMilestone.title||''} (${e.nextMilestone.date})`);
  const rr=reqReadiness(e.id),si=stages().findIndex(s=>s.id===curStage(e)),di=stages().findIndex(s=>s.id==='discovery');
  if(rr&&rr.clarify&&di>=0&&si>di)why.push(`${rr.clarify} ${L('requirement clarification(s) still open','إيضاح متطلبات ما زال مفتوحاً')}`);
  const ld=lastDone(e),since=ld?ld.d:String(e.createdAt||e.importedAt||'').slice(0,10);if(since&&since<dAdd(-settings().inactiveDays)&&!nextPlanned(e))why.push(L(`No activity for ${settings().inactiveDays}+ days and nothing scheduled`,`لا نشاط منذ ${settings().inactiveDays} يوماً ولا يوجد موعد قادم`));
  return why.length?{s:'atrisk',reasons:why}:{s:'ontrack',reasons:[]};
}
const healthPill=h=>`<span class="hp" style="--c:${HEALTH[h.s][2]}" title="${esc((h.reasons||[]).join(' · '))}">${L(HEALTH[h.s][0],HEALTH[h.s][1])}${h.override?' ✎':''}</span>`;
function accHealth(a){const es=accEngs(a.id).filter(isActive);if(!es.length)return null;const order=['blocked','atrisk','hold','ontrack','done'];return es.map(engHealth).sort((x,y)=>order.indexOf(x.s)-order.indexOf(y.s))[0]}

/* ---------------- shell ---------------- */
function vEng(){
  if(!['leadership','lead','pm','presales','viewer'].includes(realRole))return `<div class="card empty">🔒 ${L('No access','لا يوجد وصول')}</div>`;
  const cat=cur.cat==='overview'?'':cur.cat;
  if(!opsView())return engActionsView(cat||'mine');
  const sub=cur.prod||'dash';
  if(engState==='connecting')return `<div class="skel"></div><div class="skel"></div><div class="skel short"></div>`;
  if(engState==='error')return `<div class="note-warn">${L('Could not load client engagements. If the new database rules were not published yet, ask Leadership to publish them.','تعذّر تحميل ارتباطات العملاء. إذا لم تُنشر قواعد قاعدة البيانات الجديدة بعد، اطلب من القيادة نشرها.')}</div>`;
  const items=[['dash','▦',L('Dashboard','لوحة المتابعة')],['accounts','🏢',L('Accounts','الحسابات')],['engs','◎',L('Engagements','الارتباطات')],['actions','✓',L('Actions','الإجراءات')],['commit','🤝',L('Commitments','الالتزامات')],['reqs','📋',L('Requirements','المتطلبات')],['decs','⚖',L('Decisions','القرارات')],['risks','⚠',L('Risks & blockers','المخاطر والعوائق')]];
  if(realRole==='leadership')items.push(['stages','⚙',L('Stages','المراحل')]);
  items.push(['audit','🕘',L('Audit trail','سجل التدقيق')]);
  const on=k=>sub===k||(sub==='acct'&&k==='accounts')||(sub==='eng'&&k==='engs');
  const nav=`<div class="subnav">${items.map(([k,i,t])=>`<button class="${on(k)?'on':''}" onclick="go('eng','${k}')">${i} ${t}</button>`).join('')}</div>${isViewer()?`<div class="note-info small">${L('Read-only access: you can view everything here but not change it.','وصول للقراءة فقط: يمكنك الاطلاع على كل شيء دون تعديل.')}</div>`:''}`;
  const V={dash:engDash,accounts:engAccounts,acct:()=>accountView(cat),engs:engList,eng:()=>engagementView(cat),actions:()=>engActionsView(cat),commit:commitView,reqs:reqView,decs:()=>decView(cat),risks:()=>engRisksView(cat),stages:stageConfigView,audit:auditView}[sub]||engDash;
  return nav+V();
}
const btnIf=(c,h)=>c?h:'';
const ctaBar=()=>isOps()?`<div class="qa-bar"><button class="btn" onclick="activityForm()">＋ ${L('Add activity','إضافة نشاط')}</button><button class="btn" onclick="actionForm()">＋ ${L('Create action','إنشاء إجراء')}</button><button class="btn" onclick="riskForm()">＋ ${L('Register risk','تسجيل خطر')}</button><button class="btn" onclick="decisionForm()">＋ ${L('Record decision','تسجيل قرار')}</button><button class="btn" onclick="activityForm(null,null,true)">📅 ${L('Schedule follow-up','جدولة متابعة')}</button><button class="btn primary" onclick="engForm()">＋ ${L('New engagement','ارتباط جديد')}</button></div>`:'';

/* ---------------- dashboard (operational) ---------------- */
function engDash(){
  const es=Object.values(ENG),active=es.filter(isActive),hs=Object.fromEntries(es.map(e=>[e.id,engHealth(e)]));
  const cnt=s=>active.filter(e=>hs[e.id].s===s).length;
  const od=ACTIONS.filter(isOverdue),wk=ACTIONS.filter(dueWeek),pc=ACTIONS.filter(a=>a.status==='pendclient'),pi=ACTIONS.filter(a=>openA(a)&&['notstarted','inprogress','pendinternal'].includes(a.status)&&a.team!=='client'),pv=ACTIONS.filter(a=>a.status==='pendvendor');
  const up=[];es.forEach(e=>(e.activities||[]).forEach(a=>{if(a.status==='planned'&&a.d>=todayStr()&&a.d<=dAdd(14))up.push({...a,eid:e.id,org:accName(e.accountId)||e.org,en:e.name})}));up.sort((a,b)=>(a.d+(a.time||'')).localeCompare(b.d+(b.time||'')));
  const decL=DECS.filter(d=>d.status==='pending'&&d.leadership);
  const k=(t,v,c,go_)=>`<button class="card kpi-c kbtn" style="border-top:4px solid ${c}" onclick="${go_}"><span class="muted small">${t}</span><b>${v}</b></button>`;
  const crit=RISKS.filter(r=>openR(r)&&(r.impact==='critical'||(r.type==='blocker'&&r.impact==='high')||(r.type==='blocker'&&riskOverdue(r))));
  const mine=od.filter(a=>a.ownerUid===ME.id);
  const lst=(arr,f,empty)=>arr.length?arr.slice(0,8).map(f).join('')+(arr.length>8?`<div class="small muted">+${arr.length-8}</div>`:''):`<div class="small muted">✓ ${empty||L('None','لا يوجد')}</div>`;
  const aRow=a=>`<div class="fu-row" onclick="actionView('${a.id}')"><span class="small ${isOverdue(a)?'late':'muted'}" style="min-width:82px">${esc(a.due||'—')}</span><b>${esc(a.clientName||'')}</b><span class="small">— ${esc(a.title)}</span><span style="flex:1"></span><span class="small muted">${esc(a.ownerName||'')}</span></div>`;
  const rRow=r=>`<div class="fu-row" onclick="riskForm('${r.id}')">${badge(PRIO,r.impact)}<b>${esc(r.clientName||'')}</b><span class="small">— ${esc(r.title)}</span><span style="flex:1"></span><span class="small muted">${lbl(PARTIES,r.party)}</span></div>`;
  return `<div class="page-hd"><div><h1>${L('Presales engagement dashboard','لوحة متابعة ارتباطات ما قبل البيع')}</h1><p class="muted">${L('Every number is counted from stored records; click one to open the list behind it.','كل رقم محسوب من السجلات المحفوظة؛ اضغط عليه لفتح القائمة.')}</p></div></div>
  ${ctaBar()}${typeof migrationPanel==='function'?migrationPanel():''}
  <div class="grid g5" style="margin-bottom:12px">
   ${k(L('Active accounts','الحسابات النشطة'),new Set(active.map(e=>e.accountId)).size,'#3F1F55',"go('eng','accounts')")}
   ${k(L('Active engagements','الارتباطات النشطة'),active.length,'#6B009D',"ACF='';go('eng','engs')")}
   ${k(L('On track','في المسار'),cnt('ontrack'),HEALTH.ontrack[2],"ACF='ontrack';go('eng','engs')")}
   ${k(L('At risk','معرّض للخطر'),cnt('atrisk'),HEALTH.atrisk[2],"ACF='atrisk';go('eng','engs')")}
   ${k(L('Blocked','متوقف'),cnt('blocked'),HEALTH.blocked[2],"ACF='blocked';go('eng','engs')")}</div>
  <div class="grid g5" style="margin-bottom:16px">
   ${k(L('Overdue actions','إجراءات متأخرة'),od.length,'#C0392B',"go('eng','actions','overdue')")}
   ${k(L('Due this week','مستحقة هذا الأسبوع'),wk.length,'#E0A13A',"go('eng','actions','week')")}
   ${k(L('Pending client responses','ردود العميل المعلّقة'),pc.length,'#D9468F',"go('eng','actions','pendclient')")}
   ${k(L('Pending internal / vendor','معلّقة داخلياً / لدى المورّد'),`${pi.length} / ${pv.length}`,'#3F1F55',"go('eng','actions','pendinternal')")}
   ${k(L('Decisions for leadership','قرارات للقيادة'),decL.length,'#8E2DBA',"go('eng','decs','leadership')")}</div>
  <div class="card" style="padding:0;overflow:auto;margin-bottom:16px"><h3 class="h3s" style="padding:14px 16px 0">${L('Engagement overview','نظرة عامة على الارتباطات')}</h3>${engTable(active.sort((a,b)=>['blocked','atrisk','hold','ontrack','done'].indexOf(hs[a.id].s)-['blocked','atrisk','hold','ontrack','done'].indexOf(hs[b.id].s)),hs)}</div>
  <div class="grid g3" style="margin-bottom:16px">
   <div class="card"><h3 class="h3s">⏰ ${L('My overdue actions','إجراءاتي المتأخرة')} (${mine.length})</h3>${lst(mine,aRow)}</div>
   <div class="card"><h3 class="h3s">👥 ${L('Team overdue actions','إجراءات الفريق المتأخرة')} (${od.length})</h3>${lst(od,aRow)}</div>
   <div class="card"><h3 class="h3s">⏳ ${L('Waiting on the client','بانتظار العميل')} (${pc.length})</h3>${lst(pc,aRow)}</div>
   <div class="card"><h3 class="h3s">⚙ ${L('Pending technical clarifications','إيضاحات فنية معلّقة')}</h3>${lst([...ACTIONS.filter(a=>openA(a)&&['solution','product'].includes(a.team))],aRow)}</div>
   <div class="card"><h3 class="h3s">⛔ ${L('Critical and overdue blockers','العوائق الحرجة والمتأخرة')} (${crit.length})</h3>${lst(crit,rRow)}</div>
   <div class="card"><h3 class="h3s">⚖ ${L('Decisions requiring leadership','قرارات تتطلب القيادة')} (${decL.length})</h3>${lst(decL,d=>`<div class="fu-row" onclick="decisionForm('${d.id}')"><span class="small ${d.deadline&&d.deadline<todayStr()?'late':'muted'}" style="min-width:82px">${esc(d.deadline||'—')}</span><b>${esc(d.clientName||'')}</b><span class="small">— ${esc(d.title)}</span></div>`)}</div></div>
  <div class="card" id="upc"><h3 class="h3s">📅 ${L('Upcoming activities (next 14 days)','الأنشطة القادمة (14 يوماً)')}</h3>${up.length?up.map(a=>`<div class="fu-row" onclick="go('eng','eng','${a.eid}~activities')"><span class="small muted" style="min-width:110px">${esc(a.d)}${a.time?' '+esc(a.time):''}</span><span>${(EACT.find(t=>t[0]===a.type)||[])[3]||'•'}</span><b>${esc(a.org)}</b><span class="small">— ${esc(a.title)}</span><span style="flex:1"></span><span class="small muted">${lbl(EACT,a.type)}</span></div>`).join(''):`<div class="small muted">${L('Nothing scheduled.','لا يوجد شيء مجدول.')}</div>`}</div>`;
}
function engTable(list,hs){
  if(!list.length)return `<div class="small muted" style="padding:0 16px 16px">${L('No engagements yet.','لا توجد ارتباطات بعد.')}</div>`;
  return `<table class="leads"><thead><tr><th>${L('Account','الحساب')}</th><th>${L('Engagement','الارتباط')}</th><th>${L('Stage','المرحلة')}</th><th>${L('Health','الحالة')}</th><th>${L('Last activity','آخر نشاط')}</th><th>${L('Next activity','النشاط القادم')}</th><th>${L('Open actions','إجراءات مفتوحة')}</th><th>${L('Critical blockers','عوائق حرجة')}</th><th>${L('PM','مدير المشروع')}</th></tr></thead><tbody>
  ${list.map(e=>{const h=hs[e.id],ld=lastDone(e),np=nextPlanned(e),oa=engActions(e.id).filter(openA),odn=oa.filter(isOverdue).length,cb=engRisks(e.id).filter(r=>openR(r)&&(r.impact==='critical'||r.type==='blocker')).length;
   return `<tr onclick="go('eng','eng','${e.id}')"><td><b class="lk">${esc(accName(e.accountId)||e.org||'')}</b></td><td class="small">${esc(e.code||'')} ${esc(e.name||'')}<div class="muted">${(e.products||[]).map(pName).map(esc).join(', ')}</div></td><td>${stageBadge(curStage(e))}</td><td>${healthPill(h)}</td><td class="small">${ld?esc(ld.d):'—'}</td><td class="small">${np?`${esc(np.d)} · ${esc(np.title)}`:'—'}</td><td>${oa.length}${odn?` <span class="late small">(${odn} ${L('overdue','متأخر')})</span>`:''}</td><td>${cb?`<b class="late">${cb}</b>`:'0'}</td><td class="small">${esc(e.pm&&e.pm.name||'—')}</td></tr>`}).join('')}</tbody></table>`;
}

/* ---------------- accounts ---------------- */
function engAccounts(){
  const list=Object.values(ACC).sort((a,b)=>a.name.localeCompare(b.name));
  return `<div class="page-hd"><div><h1>${L('Client accounts','حسابات العملاء')}</h1><p class="muted">${L('One record per client. An account can hold several independent engagements.','سجل واحد لكل عميل. يمكن أن يضم الحساب عدة ارتباطات مستقلة.')}</p></div>${btnIf(isOps(),`<button class="btn primary" onclick="accForm()">＋ ${L('New account','حساب جديد')}</button>`)}</div>
  ${list.length?`<div class="card" style="padding:0;overflow:auto"><table class="leads"><thead><tr><th>${L('Account','الحساب')}</th><th>${L('Sector','القطاع')}</th><th>${L('Account manager','مدير الحساب')}</th><th>${L('Presales PM','مدير المشروع')}</th><th>${L('Engagements','الارتباطات')}</th><th>${L('Health','الحالة')}</th><th>${L('Last engagement','آخر تواصل')}</th><th>${L('Next activity','النشاط القادم')}</th><th>${L('Open commitments','التزامات مفتوحة')}</th></tr></thead><tbody>
   ${list.map(a=>{const es=accEngs(a.id),h=accHealth(a),lds=es.map(lastDone).filter(Boolean).map(x=>x.d).sort().reverse(),nps=es.map(nextPlanned).filter(Boolean).sort((x,y)=>x.d.localeCompare(y.d)),cm=ACTIONS.filter(x=>es.some(e=>e.id===(x.engagementId||x.clientId))&&x.commitment&&openA(x)).length;
    return `<tr onclick="go('eng','acct','${a.id}')"><td><b class="lk">${esc(a.name)}</b></td><td class="small">${esc(a.sector||'—')}</td><td class="small">${esc(a.am&&a.am.name||'—')}</td><td class="small">${esc(a.pm&&a.pm.name||'—')}</td><td>${es.filter(isActive).length}<span class="small muted"> / ${es.length}</span></td><td>${h?healthPill(h):'—'}</td><td class="small">${esc(lds[0]||'—')}</td><td class="small">${nps[0]?esc(nps[0].d)+' · '+esc(nps[0].title):'—'}</td><td>${cm}</td></tr>`}).join('')}</tbody></table></div>`:`<div class="empty">${L('No client accounts yet.','لا توجد حسابات عملاء بعد.')}</div>`}`;
}
function engList(){
  const hs=Object.fromEntries(Object.values(ENG).map(e=>[e.id,engHealth(e)]));
  const list=Object.values(ENG).filter(e=>!ACF||hs[e.id].s===ACF).sort((a,b)=>(accName(a.accountId)+a.name).localeCompare(accName(b.accountId)+b.name));
  return `<div class="page-hd"><div><h1>${L('Engagements','الارتباطات')}</h1><p class="muted">${L('Each initiative with a client — its own stage, health, team and records.','كل مبادرة مع عميل — لها مرحلتها وحالتها وفريقها وسجلاتها.')}</p></div>${btnIf(isOps(),`<button class="btn primary" onclick="engForm()">＋ ${L('New engagement','ارتباط جديد')}</button>`)}</div>
  <div class="chips">${[['',L('All','الكل')],...Object.entries(HEALTH).map(([k,v])=>[k,L(v[0],v[1])])].map(([k,t])=>`<button class="${ACF===k?'on':''}" onclick="ACF='${k}';render()">${t} <span class="n">${k?Object.values(ENG).filter(e=>hs[e.id].s===k).length:Object.keys(ENG).length}</span></button>`).join('')}</div>
  <div class="card" style="padding:0;overflow:auto">${engTable(list,hs)}</div>`;
}
function accForm(id){
  const a=id?clone(ACC[id]):{...accBlank(),id:eid('C'),createdAt:nowIso(),createdBy:ME.id};window._af2={a,isNew:!id};
  const pp=PEOPLE.map(p=>`<option value="${esc(p.name)}">`).join('');
  $('#mt').textContent=id?L('Edit account','تعديل الحساب'):L('New client account','حساب عميل جديد');
  $('#mb').innerHTML=`<datalist id="ppl">${pp}</datalist><div class="grid g2" style="gap:10px">
   ${[['name',L('Client / organisation','العميل / الجهة')+' *'],['sector',L('Industry / sector','القطاع')],['dept',L('Department / unit','الإدارة')],['city',L('City','المدينة')],['website',L('Website','الموقع')]].map(([k,t])=>`<div class="field"><label>${t}</label><input class="txt" id="ac2_${k}" value="${esc(a[k]||'')}"></div>`).join('')}
   <div class="field"><label>${L('Account manager (owner)','مدير الحساب (المالك)')}</label><input class="txt" id="ac2_am" list="ppl" value="${esc(a.am&&a.am.name||'')}"></div>
   <div class="field"><label>${L('Presales PM','مدير مشروع ما قبل البيع')}</label><input class="txt" id="ac2_pm" list="ppl" value="${esc(a.pm&&a.pm.name||'')}"></div></div>
   <div class="field"><label>${L('Strategic notes (relationship history, context)','ملاحظات استراتيجية (تاريخ العلاقة والسياق)')}</label><textarea class="txt" id="ac2_notes" rows="4">${esc(a.strategicNotes||'')}</textarea></div>
   <div class="savebar"><button class="btn primary" onclick="accSave()">💾 ${L('Save','حفظ')}</button></div>`;
  $('#modal').classList.add('show')}
const person=n=>{const p=PEOPLE.find(x=>x.name===n);return {name:n,uid:p?p.uid:''}};
async function accSave(){const {a,isNew}=window._af2,before=clone(a);a.name=$('#ac2_name').value.trim();if(!a.name)return toast(L('Enter the client name.','أدخل اسم العميل.'));
  if(isNew&&Object.values(ACC).some(x=>norm(x.name)===norm(a.name)))return toast(L('An account with this name already exists.','يوجد حساب بهذا الاسم مسبقاً.'));
  ['sector','dept','city','website'].forEach(k=>a[k]=$('#ac2_'+k).value.trim());a.am=person($('#ac2_am').value.trim());a.pm=person($('#ac2_pm').value.trim());a.strategicNotes=$('#ac2_notes').value.trim();
  if(await saveSafe(saveAcc,a,L('Saved','تم الحفظ'))){audit('account',a.id,isNew?L('Account created','إنشاء حساب'):L('Account updated','تحديث الحساب'),isNew?[]:diffs(before,a,['name','sector','dept','city','am','pm','strategicNotes']),{accountId:a.id});closeModal();go('eng','acct',a.id)}}
function accountView(arg){
  const [id,tab='overview']=String(arg||'').split('~');const a=ACC[id];if(!a)return `<div class="empty">${L('Account not found.','لم يتم العثور على الحساب.')} <a href="javascript:go('eng','accounts')">${L('All accounts','كل الحسابات')}</a></div>`;
  const es=accEngs(id),h=accHealth(a),ids=es.map(e=>e.id),acts=es.flatMap(e=>(e.activities||[]).map(x=>({...x,eid:e.id,en:e.name})));
  const tabs=[['overview',L('Overview','نظرة عامة')],['engs',L('Engagements','الارتباطات')+` <span class="n">${es.length}</span>`],['people',L('Stakeholders','أصحاب العلاقة')+` <span class="n">${(a.stakeholders||[]).length}</span>`],['acts',L('Activities','الأنشطة')+` <span class="n">${acts.length}</span>`],['actions',L('Actions','الإجراءات')+` <span class="n">${ACTIONS.filter(x=>ids.includes(x.engagementId||x.clientId)&&openA(x)).length}</span>`]];
  const body=tab==='engs'?engCards(es):tab==='people'?stakeholderList(a):tab==='acts'?activityTimeline(acts):tab==='actions'?actionsTable(ACTIONS.filter(x=>ids.includes(x.engagementId||x.clientId)).sort(sortActions)):accOverview(a,es,acts);
  return `<button class="back" onclick="go('eng','accounts')">${L('← All accounts','→ كل الحسابات')}</button>
  <div class="card lead-hd"><div style="flex:1"><div class="pc-cat">${esc(a.sector||L('Client account','حساب عميل'))}</div><h1>${esc(a.name)}</h1><div class="muted">${esc([a.dept,a.city].filter(Boolean).join(' · '))}</div>
   <div class="meta">${h?healthPill(h):''}<span>${L('Account manager','مدير الحساب')}: <b>${esc(a.am&&a.am.name||'—')}</b></span><span>${L('Presales PM','مدير المشروع')}: <b>${esc(a.pm&&a.pm.name||'—')}</b></span><span>${es.filter(isActive).length} ${L('active engagement(s)','ارتباط نشط')}</span></div></div>
   <div style="display:flex;flex-direction:column;gap:6px">${btnIf(canEditRec(a),`<button class="btn" onclick="accForm('${a.id}')">✎ ${L('Edit account','تعديل الحساب')}</button>`)}${btnIf(isOps(),`<button class="btn primary" onclick="engForm(null,'${a.id}')">＋ ${L('New engagement','ارتباط جديد')}</button>`)}</div></div>
  <div class="ptabs">${tabs.map(([k,n])=>`<button class="pt ${tab===k?'on':''}" onclick="go('eng','acct','${a.id}~${k}')">${n}</button>`).join('')}</div>${body}`;
}
function engCards(es){return es.length?`<div class="grid g2">${es.map(e=>{const h=engHealth(e),rr=reqReadiness(e.id),na=nextAction(e.id);return `<div class="card eng-card" onclick="go('eng','eng','${e.id}')"><div style="display:flex;justify-content:space-between;gap:8px;align-items:start"><div><div class="small muted">${esc(e.code||'')}</div><b>${esc(e.name||L('Untitled engagement','ارتباط بلا عنوان'))}</b></div>${healthPill(h)}</div>
  <div style="margin:8px 0">${stageBadge(curStage(e))} ${(e.outcome&&e.outcome!=='active')?`<span class="spill" style="--c:${OUTCOMES[e.outcome][2]}">${L(OUTCOMES[e.outcome][0],OUTCOMES[e.outcome][1])}</span>`:''}</div>
  <div class="small">${L('Next milestone','المعلم القادم')}: ${e.nextMilestone&&e.nextMilestone.title?`${esc(e.nextMilestone.title)} · ${esc(e.nextMilestone.date||'')}`:'—'}</div><div class="small">${L('Next action','الإجراء التالي')}: ${na?`${esc(na.title)} · ${esc(na.ownerName||'')} · ${esc(na.due||'')}`:'—'}</div>
  ${rr?`<div class="small" style="margin-top:6px">${L('Requirements readiness','جاهزية المتطلبات')}: <b>${rr.pct}%</b> <div class="bar"><i style="width:${rr.pct}%"></i></div></div>`:''}</div>`}).join('')}</div>`:`<div class="empty">${L('No engagements yet.','لا توجد ارتباطات بعد.')}</div>`}
function accOverview(a,es,acts){
  const ids=es.map(e=>e.id),up=acts.filter(x=>x.status==='planned'&&x.d>=todayStr()).sort((x,y)=>x.d.localeCompare(y.d)),cm=ACTIONS.filter(x=>ids.includes(x.engagementId||x.clientId)&&x.commitment&&openA(x)),rs=RISKS.filter(r=>ids.includes(r.engagementId||r.clientId)&&openR(r)),ds=DECS.filter(d=>ids.includes(d.engagementId)&&d.status==='pending');
  const box=(t,arr,f)=>`<div class="card"><h3 class="h3s">${t} (${arr.length})</h3>${arr.length?arr.slice(0,6).map(f).join(''):`<div class="small muted">✓ ${L('None','لا يوجد')}</div>`}</div>`;
  return `<div class="grid g2" style="margin-bottom:14px"><div class="card"><h3 class="h3s">${L('Strategic notes','ملاحظات استراتيجية')}</h3><p style="white-space:pre-wrap;margin:0">${esc(a.strategicNotes||'—')}</p>
   <div class="small" style="margin-top:10px"><b>${L('Products discussed','المنتجات قيد النقاش')}:</b> ${[...new Set(es.flatMap(e=>e.products||[]))].map(pName).map(esc).join(', ')||'—'}</div></div>
   <div class="card"><h3 class="h3s">${L('Active engagements','الارتباطات النشطة')}</h3>${es.filter(isActive).map(e=>`<div class="fu-row" onclick="go('eng','eng','${e.id}')">${healthPill(engHealth(e))}<b>${esc(e.name||e.code)}</b><span style="flex:1"></span>${stageBadge(curStage(e))}</div>`).join('')||`<div class="small muted">—</div>`}</div></div>
  <div class="grid g2">${box('📅 '+L('Upcoming client activities','أنشطة العميل القادمة'),up,x=>`<div class="fu-row" onclick="go('eng','eng','${x.eid}~activities')"><span class="small muted" style="min-width:82px">${esc(x.d)}</span><b>${esc(x.title)}</b><span class="small muted">— ${esc(x.en||'')}</span></div>`)}
   ${box('🤝 '+L('Outstanding commitments','الالتزامات المعلّقة'),cm,x=>`<div class="fu-row" onclick="actionView('${x.id}')"><span class="small ${isOverdue(x)?'late':'muted'}" style="min-width:82px">${esc(x.due||'')}</span><span class="small">${esc(x.title)}</span></div>`)}
   ${box('⚠ '+L('Open risks and blockers','المخاطر والعوائق المفتوحة'),rs,r=>`<div class="fu-row" onclick="riskForm('${r.id}')">${badge(PRIO,r.impact)}<span class="small">${esc(r.title)}</span></div>`)}
   ${box('⚖ '+L('Pending decisions','القرارات المعلّقة'),ds,d=>`<div class="fu-row" onclick="decisionForm('${d.id}')"><span class="small">${esc(d.title)}</span><span style="flex:1"></span><span class="small muted">${esc(d.deadline||'')}</span></div>`)}</div>`;
}

/* ---------------- engagements ---------------- */
function engForm(id,accountId){
  const e=id?clone(ENG[id]):{...engBlank(),id:eid('E'),code:mkCode('ENG'),accountId:accountId||'',createdAt:nowIso(),createdBy:ME.id,stage:stages()[0].id,stageLog:[{stage:stages()[0].id,enteredAt:todayStr(),owner:myName(),checks:{}}]};
  const accs=Object.values(ACC).sort((a,b)=>a.name.localeCompare(b.name));if(!accs.length)return accForm();
  window._ef={e,isNew:!id};const pp=PEOPLE.map(p=>`<option value="${esc(p.name)}">`).join('');
  $('#mt').textContent=id?L('Edit engagement','تعديل الارتباط'):L('New engagement','ارتباط جديد');
  $('#mb').innerHTML=`<datalist id="ppl">${pp}</datalist><div class="grid g2" style="gap:10px">
   <div class="field"><label>${L('Client account','حساب العميل')} *</label><select class="txt" id="ef_acc" ${id?'disabled':''}>${accs.map(a=>`<option value="${a.id}" ${a.id===e.accountId?'selected':''}>${esc(a.name)}</option>`).join('')}</select></div>
   <div class="field"><label>${L('Engagement name','اسم الارتباط')} *</label><input class="txt" id="ef_name" value="${esc(e.name)}" placeholder="${L('e.g. Top-up verification PoC','مثال: إثبات مفهوم التحقق من الشحن')}"></div>
   <div class="field"><label>${L('Account manager','مدير الحساب')}</label><input class="txt" id="ef_am" list="ppl" value="${esc(e.am&&e.am.name||'')}"></div>
   <div class="field"><label>${L('Presales PM','مدير المشروع')}</label><input class="txt" id="ef_pm" list="ppl" value="${esc(e.pm&&e.pm.name||'')}" ${realRole==='pm'&&id&&e.pm&&e.pm.uid&&e.pm.uid!==ME.id?'disabled':''}></div>
   <div class="field"><label>${L('Technical lead','القائد الفني')}</label><input class="txt" id="ef_tl" list="ppl" value="${esc(e.techLead&&e.techLead.name||'')}"></div>
   <div class="field"><label>${L('Target date','التاريخ المستهدف')}</label><input class="txt" type="date" id="ef_target" value="${esc(e.targetDate||'')}"></div>
   <div class="field"><label>${L('Next milestone','المعلم القادم')}</label><input class="txt" id="ef_ms" value="${esc(e.nextMilestone&&e.nextMilestone.title||'')}"></div>
   <div class="field"><label>${L('Milestone date','تاريخ المعلم')}</label><input class="txt" type="date" id="ef_msd" value="${esc(e.nextMilestone&&e.nextMilestone.date||'')}"></div></div>
   <div class="field"><label>${L('Participating teams','الفرق المشاركة')}</label><div class="chk">${TEAMS.map(t=>`<label><input type="checkbox" class="ef_t" value="${t[0]}" ${(e.teams||[]).includes(t[0])?'checked':''}> ${L(t[1],t[2])}</label>`).join('')}</div></div>
   <div class="field"><label>${L('Products / solutions requested','المنتجات / الحلول المطلوبة')}</label><div class="chk">${PRODUCTS.map(p=>`<label><input type="checkbox" class="ef_p" value="${p.id}" ${(e.products||[]).includes(p.id)?'checked':''}> ${esc(p.name)}</label>`).join('')}</div></div>
   ${[['objective',L('Business objective','هدف العمل')],['challenges',L('Business challenges','تحديات العمل')],['solution',L('Requested solution (in the client’s words)','الحل المطلوب (بكلمات العميل)')]].map(([k,t])=>`<div class="field"><label>${t}</label><textarea class="txt" id="ef_${k}" rows="2">${esc(e[k]||'')}</textarea></div>`).join('')}
   <div class="savebar"><button class="btn primary" onclick="engSave()">💾 ${L('Save','حفظ')}</button></div>`;
  $('#modal').classList.add('show')}
async function engSave(){const {e,isNew}=window._ef,before=clone(e);e.name=$('#ef_name').value.trim();if(!e.name)return toast(L('Give the engagement a name.','أدخل اسم الارتباط.'));
  if(isNew){e.accountId=$('#ef_acc').value;if(engsOf(e.accountId).some(x=>norm(x.name)===norm(e.name)&&isActive(x)))return toast(L('This account already has an active engagement with this name.','لدى هذا الحساب ارتباط نشط بنفس الاسم.'))}
  e.am=person($('#ef_am').value.trim());if(!$('#ef_pm').disabled)e.pm=person($('#ef_pm').value.trim());e.techLead=person($('#ef_tl').value.trim());e.targetDate=$('#ef_target').value;e.nextMilestone={title:$('#ef_ms').value.trim(),date:$('#ef_msd').value};
  e.teams=[...document.querySelectorAll('.ef_t:checked')].map(x=>x.value);e.products=[...document.querySelectorAll('.ef_p:checked')].map(x=>x.value);['objective','challenges','solution'].forEach(k=>e[k]=$('#ef_'+k).value.trim());
  if(isNew)e.stageHistory=[{at:nowIso(),by:myName(),from:'',to:e.stage,note:L('Engagement created','إنشاء الارتباط')}];
  if(await saveSafe(saveEng,e,L('Saved','تم الحفظ'))){audit('engagement',e.id,isNew?L('Engagement created','إنشاء ارتباط'):L('Engagement updated','تحديث الارتباط'),isNew?[]:diffs(before,e,['name','am','pm','techLead','targetDate','nextMilestone','teams','products','objective','challenges','solution']),{accountId:e.accountId,engagementId:e.id});closeModal();go('eng','eng',e.id)}}
const engsOf=aid=>Object.values(ENG).filter(e=>e.accountId===aid);
function engagementView(arg){
  const [id,tab='overview']=String(arg||'').split('~');const e=ENG[id];
  if(!e)return `<div class="empty">${L('Engagement not found.','لم يتم العثور على الارتباط.')} <a href="javascript:go('eng','engs')">${L('All engagements','كل الارتباطات')}</a></div>`;
  const h=engHealth(e),a=accOf(e),ed=canEditRec(e),oa=engActions(e.id),rs=engRisks(e.id),rq=engReqs(e.id),dc=engDecs(e.id);
  const lead=(typeof LEADS!=='undefined'&&['leadership','lead'].includes(realRole))?LEADS.find(l=>l.id===(e.leadId||e.id)):null;
  const tabs=[['overview',L('Overview','نظرة عامة')],['activities',L('Activities','الأنشطة')+` <span class="n">${(e.activities||[]).length}</span>`],['actions',L('Actions','الإجراءات')+` <span class="n">${oa.filter(openA).length}</span>`],['reqs',L('Requirements','المتطلبات')+` <span class="n">${rq.length}</span>`],['decs',L('Decisions','القرارات')+` <span class="n">${dc.filter(d=>d.status==='pending').length}</span>`],['risks',L('Risks','المخاطر')+` <span class="n">${rs.filter(openR).length}</span>`],['docs',L('Documents','المستندات')+` <span class="n">${(e.documents||[]).length}</span>`],['timeline',L('Timeline','الخط الزمني')]];
  const body={overview:engOverview,activities:engActivities,actions:x=>`${btnIf(isOps(),`<div style="margin-bottom:12px"><button class="btn primary" onclick="actionForm(null,{engagementId:'${x.id}'})">＋ ${L('New action','إجراء جديد')}</button></div>`)}${actionsTable(engActions(x.id).sort(sortActions),true)}`,reqs:x=>reqTable(engReqs(x.id),x.id),decs:x=>decTable(engDecs(x.id),x.id),risks:x=>`${btnIf(isOps(),`<div style="margin-bottom:12px"><button class="btn primary" onclick="riskForm(null,'${x.id}')">＋ ${L('Risk / issue / blocker / dependency','خطر / مشكلة / عائق / اعتمادية')}</button></div>`)}${risksTable(engRisks(x.id),true)}`,docs:docsView,timeline:engTimeline}[tab]||engOverview;
  return `<button class="back" onclick="go('eng','acct','${e.accountId}')">← ${esc(a?a.name:L('Account','الحساب'))}</button>
  <div class="card lead-hd"><div style="flex:1"><div class="pc-cat">${esc(e.code||'')} · ${esc(a?a.name:'')}</div><h1>${esc(e.name||L('Untitled engagement','ارتباط بلا عنوان'))}</h1>
   <div class="meta">${healthPill(h)}${e.outcome&&e.outcome!=='active'?`<span class="spill" style="--c:${OUTCOMES[e.outcome][2]}">${L(OUTCOMES[e.outcome][0],OUTCOMES[e.outcome][1])}</span>`:''}<span>${L('PM','مدير المشروع')}: <b>${esc(e.pm&&e.pm.name||'—')}</b></span><span>${L('Account manager','مدير الحساب')}: <b>${esc(e.am&&e.am.name||'—')}</b></span><span>${L('Technical lead','القائد الفني')}: <b>${esc(e.techLead&&e.techLead.name||'—')}</b></span></div>
   ${h.reasons.length?`<div class="small" style="margin-top:6px;color:${HEALTH[h.s][2]}">${h.reasons.map(esc).join(' · ')}</div>`:''}</div>
   <div style="display:flex;flex-direction:column;gap:6px">${btnIf(ed,`<button class="btn" onclick="engForm('${e.id}')">✎ ${L('Update engagement','تحديث الارتباط')}</button><button class="btn" onclick="healthForm('${e.id}')">◐ ${L('Health','الحالة')}</button><button class="btn" onclick="statusUpdateForm('${e.id}')">📝 ${L('Status update','تحديث الوضع')}</button>`)}${lead?`<button class="btn" onclick="go('lead','${lead.id}')">◈ ${L('Commercial lead','الفرصة التجارية')}</button>`:''}</div></div>
  ${stageBar(e,ed)}
  <div class="ptabs">${tabs.map(([k,n])=>`<button class="pt ${tab===k?'on':''}" onclick="go('eng','eng','${e.id}~${k}')">${n}</button>`).join('')}</div>${body(e)}`;
}
function stageBar(e,ed){
  const ss=stages(),cs=curStage(e),si=ss.findIndex(s=>s.id===cs),log=e.stageLog||[],seen=new Set([...log.map(x=>x.stage),...(e.stageHistory||[]).flatMap(h=>[h.from,h.to])].filter(Boolean));
  const st=stageOf(cs)||ss[0],le=[...log].reverse().find(x=>x.stage===cs)||{checks:{}},crit=st.crit||[];
  const done=crit.filter((c,i)=>le.checks&&le.checks[i]&&le.checks[i].s).length;
  const first=Math.min(...ss.map((s,i)=>seen.has(s.id)?i:99),si);
  return `<div class="stepper">${ss.map((s,i)=>{const isDone=si>i&&seen.has(s.id),skip=si>i&&i>first&&!seen.has(s.id),lg=[...log].reverse().find(x=>x.stage===s.id);return `<button class="step ${cs===s.id?'on':''} ${isDone?'done':''} ${skip?'skipped':''}" style="--c:${s.c}" title="${esc(lg?`${L('Entered','دخول')} ${lg.enteredAt||'—'}${lg.exitedAt?' · '+L('Exited','خروج')+' '+lg.exitedAt:''}`:(skip?L('Skipped','تم تخطيها'):i<first?L('Before the first recorded stage','قبل أول مرحلة مسجلة'):''))}" ${ed?`onclick="stageForm('${e.id}','${s.id}')"`:''}><i>${isDone?'✓':skip?'–':i+1}</i><span>${L(s.en,s.ar)}</span></button>`}).join('')}</div>
  <div class="card stage-card"><div style="display:flex;gap:12px;flex-wrap:wrap;align-items:start"><div style="flex:1;min-width:260px"><div class="small muted">${L('Current stage','المرحلة الحالية')}${le.enteredAt?` · ${L('since','منذ')} ${esc(le.enteredAt)}`:''}${le.owner?` · ${L('owner','المسؤول')} ${esc(le.owner)}`:''}</div><b>${stageLabel(cs)}</b>
   <div class="small muted">${esc(st.purpose?L(st.purpose[0],st.purpose[1]):'')}</div></div>
   <div style="flex:2;min-width:300px"><div class="small"><b>${L('Exit criteria','معايير الخروج')}</b> <span class="muted">${done}/${crit.length}</span></div>${crit.map((c,i)=>{const ck=le.checks&&le.checks[i];return `<label class="crit"><input type="checkbox" ${ck&&ck.s==='done'?'checked':''} ${ed?`onchange="critSet('${e.id}',${i},this.checked?'done':'')"`:'disabled'}> ${esc(L(c[0],c[1]))}${ck&&ck.s==='na'?` <span class="spill" style="--c:#9A97A8">${L('N/A','لا ينطبق')}</span> <span class="small muted">${esc(ck.reason||'')}</span>`:''}${ed&&!(ck&&ck.s)?` <a class="small" href="javascript:critNA('${e.id}',${i})">${L('not applicable','لا ينطبق')}</a>`:''}</label>`}).join('')}</div>
   ${ed?`<div style="display:flex;flex-direction:column;gap:6px">${si<ss.length-1?`<button class="btn primary" onclick="stageComplete('${e.id}')">✓ ${L('Complete stage','إكمال المرحلة')} →</button>`:''}<button class="btn" onclick="engOutcomeForm('${e.id}')">⏸ ${L('Hold / close / cancel','تعليق / إغلاق / إلغاء')}</button></div>`:''}</div>
   <p class="small muted" style="margin:8px 0 0">${L('A meeting taking place does not complete a stage. Tick each criterion when it is met, mark it not applicable with a reason, or complete the stage with a written justification.','عقد اجتماع لا يُكمل المرحلة. حدّد كل معيار عند تحققه، أو اعتبره غير منطبق مع ذكر السبب، أو أكمل المرحلة مع مبرر مكتوب.')}</p></div>`;
}
function engOverview(e){
  const oa=engActions(e.id).filter(openA),ld=lastDone(e),np=nextPlanned(e),rr=reqReadiness(e.id),na=nextAction(e.id),cm=oa.filter(a=>a.commitment);
  const box=(t,arr,f)=>`<div class="card"><h3 class="h3s">${t} (${arr.length})</h3>${arr.length?arr.slice(0,8).map(f).join(''):`<div class="small muted">✓ ${L('None','لا يوجد')}</div>`}</div>`;
  const aRow=a=>`<div class="fu-row" onclick="actionView('${a.id}')">${badge(A_STATUS,a.status)}<span class="small">${esc(a.title)}</span><span style="flex:1"></span><span class="small ${isOverdue(a)?'late':'muted'}">${esc(a.due||'')}</span></div>`;
  return `<div class="grid g2" style="margin-bottom:14px">
   <div class="card"><h3 class="h3s">${L('Engagement','الارتباط')}</h3>${[[L('Business objective','هدف العمل'),e.objective],[L('Business challenges','تحديات العمل'),e.challenges],[L('Requested solution','الحل المطلوب'),e.solution]].map(([k,v])=>`<div class="small" style="margin-bottom:6px"><b>${k}:</b> <span style="white-space:pre-wrap">${esc(v||'—')}</span></div>`).join('')}
    <div class="small"><b>${L('Products','المنتجات')}:</b> ${(e.products||[]).map(pName).map(esc).join(', ')||'—'} · <b>${L('Teams','الفرق')}:</b> ${(e.teams||[]).map(t=>lbl(TEAMS,t)).join(', ')||'—'}</div></div>
   <div class="card"><h3 class="h3s">${L('Status','الوضع')}</h3>
    <div class="small"><b>${L('Latest status update','آخر تحديث للوضع')}:</b> ${e.latestUpdate?`<span class="muted">${esc(String(e.latestUpdate.at).slice(0,10))} · ${esc(e.latestUpdate.by)}</span><div style="white-space:pre-wrap">${esc(e.latestUpdate.text)}</div>`:'—'}</div>
    <div class="small" style="margin-top:6px"><b>${L('Next milestone','المعلم القادم')}:</b> ${e.nextMilestone&&e.nextMilestone.title?`${esc(e.nextMilestone.title)} · <span class="${e.nextMilestone.date&&e.nextMilestone.date<todayStr()?'late':''}">${esc(e.nextMilestone.date||'')}</span>`:'—'} · <b>${L('Target','المستهدف')}:</b> ${esc(e.targetDate||'—')}</div>
    <div class="small" style="margin-top:6px"><b>${L('Next action','الإجراء التالي')}:</b> ${na?`<a href="javascript:actionView('${na.id}')">${esc(na.title)}</a> · ${esc(na.ownerName||'—')} · <span class="${isOverdue(na)?'late':''}">${esc(na.due||'')}</span>`:`<span class="late">${L('None set','غير محدد')}</span>`}</div>
    <div class="small" style="margin-top:6px"><b>${L('Last engagement','آخر تواصل')}:</b> ${ld?`${esc(ld.d)} — ${esc(ld.title)}`:'—'} · <b>${L('Next activity','النشاط القادم')}:</b> ${np?`${esc(np.d)} — ${esc(np.title)}`:'—'}</div>
    ${rr?`<div class="small" style="margin-top:8px"><b>${L('Requirements readiness','جاهزية المتطلبات')}:</b> ${rr.ready}/${rr.total} (${rr.pct}%)${rr.clarify?` · <span class="late">${rr.clarify} ${L('need clarification','تتطلب إيضاحاً')}</span>`:''}<div class="bar"><i style="width:${rr.pct}%"></i></div></div>`:''}</div></div>
  <div class="grid g2">${box('📥 '+L('Client requests we owe','طلبات العميل المستحقة علينا'),oa.filter(a=>a.source==='client'),aRow)}${box('🤝 '+L('Commitments to the client','الالتزامات تجاه العميل'),cm,aRow)}${box('⏳ '+L('Waiting on the client','بانتظار العميل'),oa.filter(a=>a.status==='pendclient'),aRow)}${box('⚠ '+L('Key risks and blockers','أهم المخاطر والعوائق'),engRisks(e.id).filter(openR).sort((a,b)=>PRIO.findIndex(p=>p[0]===b.impact)-PRIO.findIndex(p=>p[0]===a.impact)),r=>`<div class="fu-row" onclick="riskForm('${r.id}')">${badge(PRIO,r.impact)}<span class="small"><b>${lbl(R_TYPES,r.type)}</b> — ${esc(r.title)}</span></div>`)}</div>`;
}
