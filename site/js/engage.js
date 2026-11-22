/* =====================================================================
   CLIENT ENGAGEMENT MANAGEMENT  (Presales Project Manager module)
   Collections: engagements/{id} (operational client record — same id as the lead when one exists)
                actions/{id}     (centralised action tracker)
                risks/{id}       (risks, issues, blockers, dependencies)
   No commercial fields (value, probability, pricing, outcome) are ever written here.
   ===================================================================== */
const OPS_STAGES=[['initial','Initial engagement','التواصل الأولي','#9A97A8'],['discovery','Discovery & requirements','الاستكشاف والمتطلبات','#3F1F55'],['alignment','Solution alignment','مواءمة الحل','#8E2DBA'],['demo','Demo / presentation','العرض التوضيحي','#6B009D'],['clarify','Technical clarifications','الإيضاحات الفنية','#B700A5'],['proposal','Proposal preparation & review','إعداد العرض ومراجعته','#D9468F'],['feedback','Client feedback / evaluation','ملاحظات العميل والتقييم','#E0A13A'],['handover','Handover / closure','التسليم والإغلاق','#1FA27A']];
const LEAD_TO_OPS={new:'initial',contacted:'initial',discovery:'discovery',demo:'demo',scope:'alignment',proposal:'proposal',negotiation:'feedback',won:'handover',lost:'handover'};
const HEALTH={ontrack:['On track','في المسار','#1FA27A'],atrisk:['At risk','معرّض للخطر','#E0A13A'],blocked:['Blocked','متوقف','#C0392B'],hold:['On hold','معلّق','#6E6A7C'],done:['Completed','مكتمل','#3F1F55']};
const EACT=[['meeting','Client meeting','اجتماع مع العميل','👥'],['workshop','Discovery workshop','ورشة استكشاف','🧭'],['demo','Product demonstration','عرض توضيحي للمنتج','▶'],['technical','Technical discussion','نقاش فني','⚙'],['internal','Internal alignment','مواءمة داخلية','🏠'],['email','Email / correspondence','بريد / مراسلات','✉'],['presentation','Presentation','عرض تقديمي','📊'],['followup','Follow-up','متابعة','📞'],['reqreview','Requirements review','مراجعة المتطلبات','📋'],['other','Other','أخرى','•']];
const A_STATUS=[['notstarted','Not started','لم يبدأ','#9A97A8'],['inprogress','In progress','قيد التنفيذ','#6B009D'],['pendclient','Pending client','بانتظار العميل','#E0A13A'],['pendinternal','Pending internal team','بانتظار الفريق الداخلي','#D9468F'],['blocked','Blocked','متوقف','#C0392B'],['done','Completed','مكتمل','#1FA27A'],['cancelled','Cancelled','ملغى','#B8B4C2']];
const PRIO=[['low','Low','منخفضة','#9A97A8'],['medium','Medium','متوسطة','#3F1F55'],['high','High','عالية','#E0A13A'],['critical','Critical','حرجة','#C0392B']];
const TEAMS=[['presales','Presales','ما قبل البيع'],['solution','Solution architecture','هندسة الحلول'],['product','Product team','فريق المنتج'],['delivery','Delivery','فريق التنفيذ'],['partner','Partner / vendor','الشريك / المورّد'],['client','Client','العميل'],['management','Management','الإدارة'],['other','Other','أخرى']];
const R_TYPES=[['risk','Risk','خطر'],['issue','Issue','مشكلة'],['blocker','Blocker','عائق'],['dependency','Dependency','اعتمادية']];
const PARTIES=[['client','Client','العميل'],['internal','Internal team','الفريق الداخلي'],['vendor','Vendor / partner','المورّد / الشريك'],['management','Management decision','قرار الإدارة']];
const R_STATUS=[['open','Open','مفتوح','#C0392B'],['monitoring','Monitoring','تحت المراقبة','#E0A13A'],['resolved','Resolved','تم الحل','#1FA27A'],['closed','Closed','مغلق','#9A97A8']];
const tsNorm=o=>{for(const k in o){const v=o[k];if(v&&typeof v==='object'&&typeof v.toDate==='function')o[k]=v.toDate().toISOString()}return o};
const OLD_ACT={call:'followup',meeting:'meeting',email:'email',demo:'demo',note:'other'};

let ENG={},ACTIONS=[],RISKS=[],PEOPLE=[],engState='off',engUnsubs=[];
let AF={preset:'open',client:'',owner:'',team:'',priority:'',status:'',due:'',q:''},RF={preset:'open',client:'',type:'',impact:'',party:''};
const lbl=(arr,id)=>{const x=arr.find(a=>a[0]===id);return x?L(x[1],x[2]):(id||'—')};
const col=(arr,id)=>{const x=arr.find(a=>a[0]===id);return x&&x[3]&&x[3][0]==='#'?x[3]:'#9A97A8'};
const isOps=()=>['leadership','lead','pm'].includes(realRole);
const opsView=()=>isOps()&&role!=='presales'&&role!=='client';
const nowIso=()=>new Date().toISOString();
const eid=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const myName=()=>ME.name||ME.email;
const openA=a=>!['done','cancelled'].includes(a.status);
const openR=r=>['open','monitoring'].includes(r.status);
const isOverdue=a=>openA(a)&&a.due&&a.due<todayStr();
const dueWeek=a=>openA(a)&&a.due&&a.due>=todayStr()&&a.due<=dAdd(7);
const optList=(arr,v,blank)=>(blank!=null?`<option value="">${blank}</option>`:'')+arr.map(a=>`<option value="${a[0]}" ${a[0]===v?'selected':''}>${L(a[1],a[2])}</option>`).join('');
const badge=(arr,id)=>`<span class="spill" style="--c:${col(arr,id)}">${lbl(arr,id)}</span>`;
const norm=s=>String(s||'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();

/* ---------------- data ---------------- */
function engRender(){if(cur.view==='eng'){const a=document.activeElement;if(a&&a.closest&&a.closest('#main')&&/INPUT|TEXTAREA/.test(a.tagName))return;render()}else if(['lead','exec','leads'].includes(cur.view)&&document.activeElement?.tagName!=='TEXTAREA')render();else renderTabs()}
function initEngage(){
  engUnsubs.forEach(u=>{try{u()}catch(e){}});engUnsubs=[];
  if(isOps()){engState='connecting';
    engUnsubs.push(DB.collection('engagements').onSnapshot(q=>{ENG={};q.docs.forEach(d=>{let x={};try{x=JSON.parse(d.data().json||'{}')}catch(e){}ENG[d.id]={...engBlank(),...x,id:d.id,migrationBatch:d.data().migrationBatch||x.migrationBatch||null}});engState='live';engRender()},e=>{engState='error';engRender()}));
    engUnsubs.push(DB.collection('actions').onSnapshot(q=>{ACTIONS=q.docs.map(d=>tsNorm({...d.data(),id:d.id}));engRender()},e=>{}));
    engUnsubs.push(DB.collection('risks').onSnapshot(q=>{RISKS=q.docs.map(d=>tsNorm({...d.data(),id:d.id}));engRender()},e=>{}));
    DB.collection('users').get().then(q=>{PEOPLE=q.docs.map(d=>({uid:d.id,name:d.data().name||d.data().email,email:d.data().email,role:d.data().role})).filter(p=>p.role&&p.role!=='pending')}).catch(()=>{});
  }else if(['presales'].includes(realRole)){engState='live';
    engUnsubs.push(DB.collection('actions').where('ownerUid','==',ME.id).onSnapshot(q=>{ACTIONS=q.docs.map(d=>tsNorm({...d.data(),id:d.id}));engRender()},e=>{}));}
}
function engBlank(){return {id:'',org:'',dept:'',sector:'',city:'',products:[],contacts:[],accountManager:'',pm:{uid:'',name:''},tech:[],description:'',opsStage:'initial',stageHistory:[],healthOverride:null,activities:[],closed:false,leadId:'',createdAt:'',createdBy:''}}
async function saveEng(e){e.updatedAt=nowIso();const body={...e};delete body.id;
  const doc={org:e.org||'',opsStage:e.opsStage||'initial',json:JSON.stringify(body),leadId:e.leadId||'',createdAt:e.createdAt||e.updatedAt,updatedAt:e.updatedAt,updatedBy:ME.id};
  if(e.migrationBatch)doc.migrationBatch=e.migrationBatch;
  await DB.collection('engagements').doc(e.id).set(doc);ENG[e.id]=e;}
async function saveEngSafe(e,msg){try{await saveEng(e);if(msg)toast(msg);return true}catch(err){toast(isDenied(err)?L('You do not have permission to change client accounts.','لا تملك صلاحية تعديل حسابات العملاء.'):L('Could not save: ','تعذّر الحفظ: ')+err.message);return false}}
const engActs=e=>(e.activities||[]).slice().sort((a,b)=>String(b.d).localeCompare(String(a.d)));
const lastDone=e=>engActs(e).find(a=>a.status!=='planned'&&a.d<=todayStr());
const nextPlanned=e=>(e.activities||[]).filter(a=>a.status==='planned'&&a.d>=todayStr()).sort((a,b)=>a.d.localeCompare(b.d))[0];
const engActions=id=>ACTIONS.filter(a=>a.clientId===id);
const engRisks=id=>RISKS.filter(r=>r.clientId===id);

/* ---------------- operational health (explicit, explainable criteria) ---------------- */
const HEALTH_RULES=()=>[
  ['blocked',L('An open Blocker rated High or Critical, or a Critical action marked Blocked','عائق مفتوح بدرجة عالية أو حرجة، أو إجراء حرج متوقف')],
  ['atrisk',L('An open risk, issue or dependency rated Critical; or an open Blocker rated Low/Medium; or any overdue High/Critical action; or 3+ overdue actions; or no activity for 14+ days with nothing scheduled','خطر أو مشكلة أو اعتمادية حرجة مفتوحة؛ أو عائق منخفض/متوسط؛ أو إجراء عالي/حرج متأخر؛ أو 3 إجراءات متأخرة فأكثر؛ أو لا نشاط منذ 14 يوماً دون أي موعد قادم')],
  ['ontrack',L('None of the above','لا شيء مما سبق')],
  ['hold',L('Only set manually, with a reason','يُحدد يدوياً فقط مع ذكر السبب')],
  ['done',L('Stage is Handover / closure and the account is marked closed','المرحلة التسليم والإغلاق والحساب مغلق')]];
function engHealth(e){
  if(e.healthOverride&&e.healthOverride.status)return {s:e.healthOverride.status,reasons:[L('Set manually','محدد يدوياً')+': '+(e.healthOverride.reason||'')],override:true};
  if(e.closed)return {s:'done',reasons:[L('Account closed','الحساب مغلق')]};
  const rs=engRisks(e.id).filter(openR),as=engActions(e.id).filter(openA),why=[];
  const bHigh=rs.filter(r=>r.type==='blocker'&&['high','critical'].includes(r.impact)),aBlk=as.filter(a=>a.status==='blocked'&&a.priority==='critical');
  if(bHigh.length||aBlk.length){bHigh.forEach(r=>why.push('⛔ '+r.title));aBlk.forEach(a=>why.push('⛔ '+a.title));return {s:'blocked',reasons:why}}
  rs.filter(r=>r.type!=='blocker'&&r.impact==='critical').forEach(r=>why.push(lbl(R_TYPES,r.type)+': '+r.title));
  rs.filter(r=>r.type==='blocker').forEach(r=>why.push(L('Blocker','عائق')+': '+r.title));
  const od=as.filter(isOverdue),odHigh=od.filter(a=>['high','critical'].includes(a.priority));
  if(odHigh.length)why.push(`${odHigh.length} ${L('overdue high/critical action(s)','إجراء عالي/حرج متأخر')}`);
  else if(od.length>=3)why.push(`${od.length} ${L('overdue actions','إجراءات متأخرة')}`);
  const ld=lastDone(e);if((!ld||ld.d<dAdd(-14))&&!nextPlanned(e))why.push(L('No activity for 14+ days and nothing scheduled','لا نشاط منذ 14 يوماً ولا يوجد موعد قادم'));
  return why.length?{s:'atrisk',reasons:why}:{s:'ontrack',reasons:[]};
}
const healthPill=(h,small)=>`<span class="hp" style="--c:${HEALTH[h.s][2]}" title="${esc((h.reasons||[]).join(' · '))}">${L(HEALTH[h.s][0],HEALTH[h.s][1])}${h.override?' ✎':''}</span>`;

/* ---------------- shell ---------------- */
function vEng(){
  if(!['leadership','lead','pm','presales'].includes(realRole))return `<div class="card empty">🔒 ${L('No access','لا يوجد وصول')}</div>`;
  const sub=cur.prod||(opsView()?'dash':'actions');
  if(!opsView())return engActionsView(cur.cat==='overview'?'mine':cur.cat);
  if(engState==='connecting')return `<div class="empty">${L('Loading…','جارٍ التحميل…')}</div>`;
  if(engState==='error')return `<div class="note-warn">${L('Could not load client engagements. If the database rules were not updated yet, ask Leadership to publish the new rules.','تعذّر تحميل ارتباطات العملاء. إذا لم تُحدَّث قواعد قاعدة البيانات بعد، اطلب من القيادة نشر القواعد الجديدة.')}</div>`;
  const nav=opsView()?`<div class="subnav">${[['dash','▦ '+L('Dashboard','لوحة المتابعة')],['accounts','🏢 '+L('Client accounts','حسابات العملاء')],['actions','✓ '+L('Action tracker','متتبع الإجراءات')],['risks','⚠ '+L('Risks & blockers','المخاطر والعوائق')]].map(([k,t])=>`<button class="${sub===k||(sub==='acct'&&k==='accounts')?'on':''}" onclick="go('eng','${k}')">${t}</button>`).join('')}</div>`:'';
  const cat=cur.cat==='overview'?'':cur.cat;const body=sub==='dash'?engDash():sub==='accounts'?engAccounts():sub==='acct'?engAccount(cat):sub==='risks'?engRisksView(cat):engActionsView(cat);
  return nav+body;
}

/* ---------------- dashboard ---------------- */
function engDash(){
  const es=Object.values(ENG),active=es.filter(e=>!e.closed),hs=Object.fromEntries(es.map(e=>[e.id,engHealth(e)]));
  const cnt=s=>active.filter(e=>hs[e.id].s===s).length;
  const od=ACTIONS.filter(isOverdue),wk=ACTIONS.filter(dueWeek),pc=ACTIONS.filter(a=>a.status==='pendclient'),pi=ACTIONS.filter(a=>openA(a)&&['notstarted','inprogress','pendinternal'].includes(a.status)&&a.team!=='client');
  const up=[];es.forEach(e=>(e.activities||[]).forEach(a=>{if(a.status==='planned'&&a.d>=todayStr()&&a.d<=dAdd(14))up.push({...a,eid:e.id,org:e.org})}));up.sort((a,b)=>a.d.localeCompare(b.d));
  const k=(t,v,c,go_)=>`<button class="card kpi-c kbtn" style="border-top:4px solid ${c}" onclick="${go_}"><span class="muted small">${t}</span><b>${v}</b></button>`;
  const crit=RISKS.filter(r=>openR(r)&&(r.impact==='critical'||(r.type==='blocker'&&r.impact==='high')));
  const mgmt=RISKS.filter(r=>openR(r)&&(r.party==='management'||r.escalation));
  const mine=od.filter(a=>a.ownerUid===ME.id);
  const lst=(arr,f,empty)=>arr.length?arr.slice(0,8).map(f).join('')+(arr.length>8?`<div class="small muted">+${arr.length-8}</div>`:''):`<div class="small muted">✓ ${empty||L('None','لا يوجد')}</div>`;
  const aRow=a=>`<div class="fu-row" onclick="actionView('${a.id}')"><span class="small ${isOverdue(a)?'late':'muted'}" style="min-width:82px">${esc(a.due||'—')}</span><b>${esc(a.clientName||'')}</b><span class="small">— ${esc(a.title)}</span><span style="flex:1"></span><span class="small muted">${esc(a.ownerName||'')}</span></div>`;
  const rRow=r=>`<div class="fu-row" onclick="riskForm('${r.id}')">${badge(PRIO,r.impact)}<b>${esc(r.clientName||'')}</b><span class="small">— ${esc(r.title)}</span><span style="flex:1"></span><span class="small muted">${lbl(PARTIES,r.party)}</span></div>`;
  return `<div class="page-hd"><div><h1>${L('Presales engagement dashboard','لوحة متابعة ارتباطات ما قبل البيع')}</h1><p class="muted">${L('Operational status of every client engagement. Every number below is counted from stored records; click one to open the list behind it.','الحالة التشغيلية لكل ارتباط مع العملاء. كل رقم محسوب من السجلات المحفوظة؛ اضغط عليه لفتح القائمة.')}</p></div>
   <div style="display:flex;gap:8px"><button class="btn" onclick="activityForm()">＋ ${L('Log activity','تسجيل نشاط')}</button><button class="btn primary" onclick="actionForm()">＋ ${L('New action','إجراء جديد')}</button></div></div>
  ${migrationPanel()}
  <div class="grid g5" style="margin-bottom:12px">
   ${k(L('Active engagements','الارتباطات النشطة'),active.length,'#6B009D',"go('eng','accounts')")}
   ${k(L('On track','في المسار'),cnt('ontrack'),HEALTH.ontrack[2],"ACF='ontrack';go('eng','accounts')")}
   ${k(L('At risk','معرّض للخطر'),cnt('atrisk'),HEALTH.atrisk[2],"ACF='atrisk';go('eng','accounts')")}
   ${k(L('Blocked','متوقف'),cnt('blocked'),HEALTH.blocked[2],"ACF='blocked';go('eng','accounts')")}
   ${k(L('Upcoming meetings & demos (14 days)','الاجتماعات والعروض القادمة (14 يوماً)'),up.length,'#8E2DBA',"document.getElementById('upc').scrollIntoView({behavior:'smooth'})")}</div>
  <div class="grid g4" style="margin-bottom:16px">
   ${k(L('Overdue actions','إجراءات متأخرة'),od.length,'#C0392B',"go('eng','actions','overdue')")}
   ${k(L('Actions due this week','إجراءات مستحقة هذا الأسبوع'),wk.length,'#E0A13A',"go('eng','actions','week')")}
   ${k(L('Client responses pending','ردود العميل المعلّقة'),pc.length,'#D9468F',"go('eng','actions','pendclient')")}
   ${k(L('Internal deliverables pending','تسليمات داخلية معلّقة'),pi.length,'#3F1F55',"go('eng','actions','pendinternal')")}</div>
  <div class="card" style="padding:0;overflow:auto;margin-bottom:16px"><h3 class="h3s" style="padding:14px 16px 0">${L('Client engagement overview','نظرة عامة على ارتباطات العملاء')}</h3>${accountsTable(active.sort((a,b)=>({blocked:0,atrisk:1,hold:2,ontrack:3,done:4})[hs[a.id].s]-({blocked:0,atrisk:1,hold:2,ontrack:3,done:4})[hs[b.id].s]),hs)}</div>
  <div class="grid g3" style="margin-bottom:16px">
   <div class="card"><h3 class="h3s">⏰ ${L('My overdue actions','إجراءاتي المتأخرة')} (${mine.length})</h3>${lst(mine,aRow)}</div>
   <div class="card"><h3 class="h3s">👥 ${L('Team overdue actions','إجراءات الفريق المتأخرة')} (${od.length})</h3>${lst(od,aRow)}</div>
   <div class="card"><h3 class="h3s">⏳ ${L('Waiting on the client','بانتظار العميل')} (${pc.length})</h3>${lst(pc,aRow)}</div>
   <div class="card"><h3 class="h3s">⚙ ${L('Pending technical clarifications','إيضاحات فنية معلّقة')}</h3>${lst(ACTIONS.filter(a=>openA(a)&&['solution','product'].includes(a.team)),aRow)}</div>
   <div class="card"><h3 class="h3s">⛔ ${L('Critical blockers','العوائق الحرجة')} (${crit.length})</h3>${lst(crit,rRow)}</div>
   <div class="card"><h3 class="h3s">🏛 ${L('Management decisions & escalations','قرارات الإدارة والتصعيد')} (${mgmt.length})</h3>${lst(mgmt,rRow)}</div></div>
  <div class="card" id="upc"><h3 class="h3s">📅 ${L('Upcoming activities (next 14 days)','الأنشطة القادمة (14 يوماً)')}</h3>${up.length?up.map(a=>`<div class="fu-row" onclick="go('eng','acct','${a.eid}')"><span class="small muted" style="min-width:82px">${esc(a.d)}</span><span>${(EACT.find(t=>t[0]===a.type)||[])[3]||'•'}</span><b>${esc(a.org)}</b><span class="small">— ${esc(a.title)}</span><span style="flex:1"></span><span class="small muted">${lbl(EACT,a.type)}</span></div>`).join(''):`<div class="small muted">${L('Nothing scheduled. Log a planned meeting or demo from a client account.','لا يوجد شيء مجدول. سجّل اجتماعاً أو عرضاً مخططاً من حساب العميل.')}</div>`}</div>`;
}
let ACF='';
function accountsTable(list,hs){
  if(!list.length)return `<div class="small muted" style="padding:0 16px 16px">${L('No client accounts yet.','لا توجد حسابات عملاء بعد.')}</div>`;
  return `<table class="leads"><thead><tr><th>${L('Client','العميل')}</th><th>${L('Solution / product','الحل / المنتج')}</th><th>${L('Stage','المرحلة')}</th><th>${L('Health','الحالة')}</th><th>${L('Last activity','آخر نشاط')}</th><th>${L('Next activity','النشاط القادم')}</th><th>${L('Open actions','إجراءات مفتوحة')}</th><th>${L('Critical blockers','عوائق حرجة')}</th><th>${L('Account owner','مسؤول الحساب')}</th></tr></thead><tbody>
  ${list.map(e=>{const h=hs[e.id],ld=lastDone(e),np=nextPlanned(e),oa=engActions(e.id).filter(openA),odn=oa.filter(isOverdue).length,cb=engRisks(e.id).filter(r=>openR(r)&&(r.impact==='critical'||r.type==='blocker')).length;
   return `<tr onclick="go('eng','acct','${e.id}')"><td><b class="lk">${esc(e.org)}</b><div class="small muted">${esc(e.dept||'')}</div></td><td class="small">${(e.products||[]).map(pName).map(esc).join(', ')||'—'}</td><td>${badge(OPS_STAGES,e.opsStage)}</td><td>${healthPill(h)}</td><td class="small">${ld?esc(ld.d):'—'}</td><td class="small">${np?`${esc(np.d)} · ${esc(np.title)}`:'—'}</td><td>${oa.length}${odn?` <span class="late small">(${odn} ${L('overdue','متأخر')})</span>`:''}</td><td>${cb?`<b class="late">${cb}</b>`:'0'}</td><td class="small">${esc(e.accountManager||'—')}</td></tr>`}).join('')}</tbody></table>`;
}

/* ---------------- accounts ---------------- */
function engAccounts(){
  const hs=Object.fromEntries(Object.values(ENG).map(e=>[e.id,engHealth(e)]));
  let list=Object.values(ENG).filter(e=>!ACF||hs[e.id].s===ACF).sort((a,b)=>a.org.localeCompare(b.org));
  return `<div class="page-hd"><div><h1>${L('Client accounts','حسابات العملاء')}</h1><p class="muted">${L('One operational record per client: stage, health, owners, activities, actions and risks. No commercial data.','سجل تشغيلي واحد لكل عميل: المرحلة والحالة والمسؤولون والأنشطة والإجراءات والمخاطر. دون بيانات تجارية.')}</p></div>
   <button class="btn primary" onclick="engForm()">＋ ${L('New client account','حساب عميل جديد')}</button></div>
   <div class="chips">${[['',L('All','الكل')],...Object.entries(HEALTH).map(([k,v])=>[k,L(v[0],v[1])])].map(([k,t])=>`<button class="${ACF===k?'on':''}" onclick="ACF='${k}';render()">${t}</button>`).join('')}</div>
   <div class="card" style="padding:0;overflow:auto">${accountsTable(list,hs)}</div>`;
}
function engForm(id){
  const e=id?JSON.parse(JSON.stringify(ENG[id])):{...engBlank(),id:eid('E'),createdAt:nowIso(),createdBy:ME.id};
  window._ef=e;const pp=PEOPLE.map(p=>`<option value="${esc(p.name)}">`).join('');
  $('#mt').textContent=id?L('Edit client account','تعديل حساب العميل'):L('New client account','حساب عميل جديد');
  $('#mb').innerHTML=`<datalist id="ppl">${pp}</datalist><div class="grid g2" style="gap:10px">
   <div class="field"><label>${L('Client / organisation','العميل / الجهة')} *</label><input class="txt" id="ef_org" value="${esc(e.org)}"></div>
   <div class="field"><label>${L('Department / unit','الإدارة / الوحدة')}</label><input class="txt" id="ef_dept" value="${esc(e.dept)}"></div>
   <div class="field"><label>${L('Sector','القطاع')}</label><input class="txt" id="ef_sector" value="${esc(e.sector)}"></div>
   <div class="field"><label>${L('City','المدينة')}</label><input class="txt" id="ef_city" value="${esc(e.city)}"></div>
   <div class="field"><label>${L('Account manager','مدير الحساب')}</label><input class="txt" id="ef_am" list="ppl" value="${esc(e.accountManager)}"></div>
   <div class="field"><label>${L('Presales project manager','مدير مشروع ما قبل البيع')}</label><input class="txt" id="ef_pm" list="ppl" value="${esc(e.pm&&e.pm.name||'')}"></div></div>
   <div class="field"><label>${L('Assigned technical resources — one per line: Name | area','الموارد الفنية — واحد في كل سطر: الاسم | المجال')}</label><textarea class="txt" id="ef_tech" rows="3" placeholder="Saed Al-Sammak | AI solution lead">${esc((e.tech||[]).map(t=>t.name+(t.area?' | '+t.area:'')).join('\n'))}</textarea></div>
   <div class="field"><label>${L('Products / solutions under discussion','المنتجات / الحلول قيد النقاش')}</label><div class="chk">${PRODUCTS.map(p=>`<label><input type="checkbox" class="ef_p" value="${p.id}" ${(e.products||[]).includes(p.id)?'checked':''}> ${esc(p.name)}</label>`).join('')}</div></div>
   <div class="field"><label>${L('Engagement description','وصف الارتباط')}</label><textarea class="txt" id="ef_desc" rows="4">${esc(e.description)}</textarea></div>
   ${id?`<label class="small"><input type="checkbox" id="ef_closed" ${e.closed?'checked':''}> ${L('Engagement closed (handed over or ended)','الارتباط مغلق (تم التسليم أو انتهى)')}</label>`:''}
   <div class="savebar"><button class="btn primary" onclick="engFormSave(${id?'true':'false'})">💾 ${L('Save','حفظ')}</button></div>`;
  $('#modal').classList.add('show');
}
async function engFormSave(existing){const e=window._ef;e.org=$('#ef_org').value.trim();if(!e.org)return toast(L('Enter the client name.','أدخل اسم العميل.'));
  if(!existing&&Object.values(ENG).some(x=>norm(x.org)===norm(e.org)))return toast(L('A client account with this name already exists.','يوجد حساب عميل بهذا الاسم مسبقاً.'));
  e.dept=$('#ef_dept').value.trim();e.sector=$('#ef_sector').value.trim();e.city=$('#ef_city').value.trim();e.accountManager=$('#ef_am').value.trim();
  const pn=$('#ef_pm').value.trim(),pu=PEOPLE.find(p=>p.name===pn);e.pm={name:pn,uid:pu?pu.uid:''};
  e.tech=$('#ef_tech').value.split('\n').map(s=>s.trim()).filter(Boolean).map(s=>{const [n,a]=s.split('|').map(x=>x.trim());const pu=PEOPLE.find(p=>p.name===n);return {name:n,area:a||'',uid:pu?pu.uid:''}});
  e.products=[...document.querySelectorAll('.ef_p:checked')].map(x=>x.value);e.description=$('#ef_desc').value.trim();
  if(existing){const c=$('#ef_closed').checked;if(c!==!!e.closed){e.closed=c;e.stageHistory=[...(e.stageHistory||[]),{at:nowIso(),by:myName(),from:e.opsStage,to:e.opsStage,note:c?L('Engagement closed','تم إغلاق الارتباط'):L('Engagement reopened','تمت إعادة فتح الارتباط')}]}}
  if(await saveEngSafe(e,L('Saved','تم الحفظ'))){closeModal();go('eng','acct',e.id)}}

function engAccount(id){
  const [eidv,tab='overview']=String(id||'').split('~');const e=ENG[eidv];
  if(!e)return `<div class="empty">${L('Client account not found.','لم يتم العثور على حساب العميل.')} <a href="javascript:go('eng','accounts')">${L('All accounts','كل الحسابات')}</a></div>`;
  const h=engHealth(e),oa=engActions(e.id),rs=engRisks(e.id),si=OPS_STAGES.findIndex(s=>s[0]===e.opsStage);
  const tabs=[['overview',L('Overview','نظرة عامة')],['activities',L('Activities','الأنشطة')+` <span class="n">${(e.activities||[]).length}</span>`],['actions',L('Actions','الإجراءات')+` <span class="n">${oa.filter(openA).length}</span>`],['risks',L('Risks & blockers','المخاطر والعوائق')+` <span class="n">${rs.filter(openR).length}</span>`],['contacts',L('Stakeholders','أصحاب العلاقة')+` <span class="n">${(e.contacts||[]).length}</span>`],['timeline',L('Timeline','الخط الزمني')]];
  const lead=(typeof LEADS!=='undefined'&&['leadership','lead'].includes(realRole))?LEADS.find(l=>l.id===(e.leadId||e.id)):null;
  return `<button class="back" onclick="go('eng','accounts')">${L('← All client accounts','→ كل حسابات العملاء')}</button>
  <div class="card lead-hd"><div style="flex:1"><div class="pc-cat">${esc(e.sector||L('Client account','حساب عميل'))}</div><h1>${esc(e.org)}</h1><div class="muted">${esc([e.dept,e.city].filter(Boolean).join(' · '))}</div>
   <div class="meta">${healthPill(h)}<span>${L('Account manager','مدير الحساب')}: <b>${esc(e.accountManager||'—')}</b></span><span>${L('Presales PM','مدير مشروع ما قبل البيع')}: <b>${esc(e.pm&&e.pm.name||'—')}</b></span><span>${L('Technical','الفني')}: ${esc((e.tech||[]).map(t=>t.name).join(', ')||'—')}</span></div>
   ${h.reasons.length?`<div class="small" style="margin-top:6px;color:${HEALTH[h.s][2]}">${h.reasons.map(esc).join(' · ')}</div>`:''}</div>
   <div style="display:flex;flex-direction:column;gap:6px"><button class="btn" onclick="engForm('${e.id}')">✎ ${L('Edit account','تعديل الحساب')}</button><button class="btn" onclick="healthForm('${e.id}')">◐ ${L('Set health','تحديد الحالة')}</button>${lead?`<button class="btn" onclick="go('lead','${lead.id}')">◈ ${L('Commercial lead','الفرصة التجارية')}</button>`:''}</div></div>
  ${(()=>{const seen=new Set((e.stageHistory||[]).flatMap(h=>[h.from,h.to]).filter(Boolean));return `<div class="stepper">${OPS_STAGES.map((s,i)=>{const done=si>i&&seen.has(s[0]),skip=si>i&&!seen.has(s[0]);return `<button class="step ${e.opsStage===s[0]?'on':''} ${done?'done':''} ${skip?'skipped':''}" style="--c:${s[3]}" title="${skip?L('Skipped','تم تخطيها'):''}" onclick="stageForm('${e.id}','${s[0]}')"><i>${done?'✓':skip?'–':i+1}</i><span>${L(s[1],s[2])}</span></button>`}).join('')}</div>`})()}
  <p class="small muted" style="margin:-6px 0 0">${L('Stages show operational progress, not sales probability. Skip or go back as needed — every move is recorded.','تعكس المراحل التقدم التشغيلي وليس احتمالية البيع. يمكن تخطي المراحل أو العودة إليها — وتُسجَّل كل حركة.')}</p>
  <div class="ptabs">${tabs.map(([k,n])=>`<button class="pt ${tab===k?'on':''}" onclick="go('eng','acct','${e.id}~${k}')">${n}</button>`).join('')}</div>
  ${({overview:acctOverview,activities:acctActivities,actions:acctActions,risks:acctRisks,contacts:acctContacts,timeline:acctTimeline})[tab]?.(e)||''}`;
}
function acctOverview(e){
  const oa=engActions(e.id).filter(openA),ld=lastDone(e),np=nextPlanned(e),rs=engRisks(e.id).filter(openR);
  const box=(t,arr,f,empty)=>`<div class="card"><h3 class="h3s">${t} (${arr.length})</h3>${arr.length?arr.slice(0,8).map(f).join(''):`<div class="small muted">✓ ${empty||L('None','لا يوجد')}</div>`}</div>`;
  const aRow=a=>`<div class="fu-row" onclick="actionView('${a.id}')">${badge(A_STATUS,a.status)}<span class="small">${esc(a.title)}</span><span style="flex:1"></span><span class="small ${isOverdue(a)?'late':'muted'}">${esc(a.due||'')}</span></div>`;
  return `<div class="grid g2" style="margin-bottom:14px">
   <div class="card"><h3 class="h3s">${L('Engagement','الارتباط')}</h3><p style="white-space:pre-wrap;margin-top:0">${esc(e.description||'—')}</p>
    <div class="small"><b>${L('Products / solutions','المنتجات / الحلول')}:</b> ${(e.products||[]).map(pName).map(esc).join(', ')||'—'}</div></div>
   <div class="card"><h3 class="h3s">${L('Latest and next','الأحدث والقادم')}</h3>
    <div class="small"><b>${L('Last engagement','آخر تواصل')}:</b> ${ld?`${esc(ld.d)} — ${esc(ld.title)}`:'—'}</div>
    <div class="small" style="margin-top:6px"><b>${L('Next scheduled activity','النشاط المجدول القادم')}:</b> ${np?`${esc(np.d)} — ${esc(np.title)}`:`<span class="late">${L('Nothing scheduled','لا يوجد موعد')}</span>`}</div>
    ${ld&&ld.summary?`<div class="small" style="margin-top:10px"><b>${L('Most recent update','آخر تحديث')}:</b><div class="muted" style="white-space:pre-wrap">${esc(ld.summary.slice(0,500))}</div></div>`:''}
    <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" onclick="activityForm('${e.id}')">＋ ${L('Log activity','تسجيل نشاط')}</button><button class="btn" onclick="activityForm('${e.id}',null,true)">📅 ${L('Schedule activity','جدولة نشاط')}</button><button class="btn" onclick="actionForm(null,{clientId:'${e.id}'})">＋ ${L('Action','إجراء')}</button><button class="btn" onclick="riskForm(null,'${e.id}')">＋ ${L('Risk / blocker','خطر / عائق')}</button></div></div></div>
  <div class="grid g2">
   ${box('📥 '+L('Outstanding client requests (we owe)','طلبات العميل المعلّقة (علينا)'),oa.filter(a=>a.source==='client'),aRow)}
   ${box('🏠 '+L('Internal pending actions','إجراءات داخلية معلّقة'),oa.filter(a=>a.source!=='client'&&a.status!=='pendclient'),aRow)}
   ${box('⏳ '+L('Waiting on the client','بانتظار العميل'),oa.filter(a=>a.status==='pendclient'),aRow)}
   ${box('⚠ '+L('Key risks and blockers','أهم المخاطر والعوائق'),rs.sort((a,b)=>PRIO.findIndex(p=>p[0]===b.impact)-PRIO.findIndex(p=>p[0]===a.impact)),r=>`<div class="fu-row" onclick="riskForm('${r.id}')">${badge(PRIO,r.impact)}<span class="small"><b>${lbl(R_TYPES,r.type)}</b> — ${esc(r.title)}</span><span style="flex:1"></span><span class="small muted">${lbl(PARTIES,r.party)}</span></div>`)}</div>`;
}
function acctActivities(e){
  const acts=engActs(e);
  return `<div style="display:flex;gap:8px;margin-bottom:12px"><button class="btn primary" onclick="activityForm('${e.id}')">＋ ${L('Log activity','تسجيل نشاط')}</button><button class="btn" onclick="activityForm('${e.id}',null,true)">📅 ${L('Schedule activity','جدولة نشاط')}</button></div>
  ${acts.length?acts.map(a=>{const linked=ACTIONS.filter(x=>x.activityId===a.id);const t=EACT.find(x=>x[0]===a.type)||EACT[9];
   return `<div class="card act" id="act-${a.id}"><div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap"><span style="font-size:18px">${t[3]}</span><b>${esc(a.title)}</b><span class="small muted">${esc(a.d)} · ${L(t[1],t[2])}</span>${a.status==='planned'?`<span class="spill" style="--c:#8E2DBA">${L('Planned','مخطط')}</span>`:''}<span style="flex:1"></span><button class="btn sm" onclick="activityForm('${e.id}','${a.id}')">✎</button></div>
    ${a.intP||a.extP?`<div class="small muted" style="margin-top:4px">${a.intP?`${L('Internal','داخلي')}: ${esc(a.intP)}`:''}${a.intP&&a.extP?' · ':''}${a.extP?`${L('Client / external','العميل / خارجي')}: ${esc(a.extP)}`:''}</div>`:''}
    ${[[L('Summary','الملخص'),a.summary],[L('Decisions','القرارات'),a.decisions],[L('Client requests','طلبات العميل'),a.requests],[L('Our commitments','التزاماتنا'),a.commitments],[L('Next steps','الخطوات التالية'),a.nextSteps],[L('Links','الروابط'),a.links]].filter(x=>x[1]).map(([k,v])=>`<div class="small" style="margin-top:6px"><b>${k}:</b> <span style="white-space:pre-wrap">${esc(v)}</span></div>`).join('')}
    ${linked.length?`<div class="small" style="margin-top:8px"><b>${L('Actions from this activity','الإجراءات الناتجة')}:</b> ${linked.map(x=>`<a href="javascript:actionView('${x.id}')">${esc(x.title)}</a> ${badge(A_STATUS,x.status)}`).join(' · ')}</div>`:''}
    <div style="margin-top:8px"><button class="btn sm" onclick="actionForm(null,{clientId:'${e.id}',activityId:'${a.id}'})">＋ ${L('Create action from this activity','إنشاء إجراء من هذا النشاط')}</button></div></div>`}).join(''):`<div class="empty">${L('No activities logged yet.','لم تُسجَّل أنشطة بعد.')}</div>`}`;
}
function acctActions(e){return `<div style="margin-bottom:12px"><button class="btn primary" onclick="actionForm(null,{clientId:'${e.id}'})">＋ ${L('New action','إجراء جديد')}</button></div>${actionsTable(engActions(e.id).sort(sortActions),true)}`}
function acctRisks(e){return `<div style="margin-bottom:12px"><button class="btn primary" onclick="riskForm(null,'${e.id}')">＋ ${L('Risk / issue / blocker / dependency','خطر / مشكلة / عائق / اعتمادية')}</button></div>${risksTable(engRisks(e.id),true)}`}
function acctContacts(e){
  const cs=e.contacts||[];
  return `<div style="margin-bottom:12px"><button class="btn primary" onclick="contactForm('${e.id}')">＋ ${L('Stakeholder','صاحب علاقة')}</button></div>
  ${cs.length?`<div class="grid g2">${cs.map((c,i)=>`<div class="card contact"><div style="display:flex;justify-content:space-between;gap:8px"><div><b>${esc(c.name)}</b>${c.primary?` <span class="spill" style="--c:#6B009D">${L('Primary','رئيسي')}</span>`:''}<div class="small muted">${esc(c.position||'')}</div></div><button class="btn sm" onclick="contactForm('${e.id}',${i})">✎</button></div>
   <div class="small" style="margin-top:6px">${c.email?`✉ <a href="mailto:${esc(c.email)}">${esc(c.email)}</a> `:''}${c.mobile?`📱 <span dir="ltr">${esc(c.mobile)}</span>`:''}</div></div>`).join('')}</div>`:`<div class="empty">${L('No stakeholders yet.','لا يوجد أصحاب علاقة بعد.')}</div>`}`;
}
function contactForm(id,i){const e=ENG[id],c=i!=null?{...e.contacts[i]}:{name:'',position:'',email:'',mobile:'',primary:false};
  $('#mt').textContent=L('Stakeholder','صاحب العلاقة');
  $('#mb').innerHTML=`<div class="grid g2" style="gap:10px">${[['name',L('Full name','الاسم الكامل')],['position',L('Position / role','المنصب / الدور')],['email',L('Email','البريد')],['mobile',L('Mobile','الجوال')]].map(([k,t])=>`<div class="field"><label>${t}</label><input class="txt" id="cf_${k}" value="${esc(c[k]||'')}" ${k==='email'||k==='mobile'?'dir="ltr"':''}></div>`).join('')}</div>
   <label class="small"><input type="checkbox" id="cf_primary" ${c.primary?'checked':''}> ${L('Primary contact','جهة الاتصال الرئيسية')}</label>
   <div class="savebar"><button class="btn primary" onclick="contactSave('${id}',${i??'null'})">💾 ${L('Save','حفظ')}</button>${i!=null?`<button class="btn" onclick="contactSave('${id}',${i},true)">🗑 ${L('Remove','إزالة')}</button>`:''}</div>`;
  $('#modal').classList.add('show')}
async function contactSave(id,i,del){if(del&&!confirmDel('ct'+id+i))return;const e=JSON.parse(JSON.stringify(ENG[id]));e.contacts=e.contacts||[];
  if(del)e.contacts.splice(i,1);else{const c={};['name','position','email','mobile'].forEach(k=>c[k]=$('#cf_'+k).value.trim());c.primary=$('#cf_primary').checked;if(!c.name)return toast(L('Enter a name.','أدخل الاسم.'));
    if(c.primary)e.contacts.forEach(x=>x.primary=false);if(i!=null)e.contacts[i]=c;else e.contacts.push(c)}
  if(await saveEngSafe(e,L('Saved','تم الحفظ')))closeModal()}

/* ---------------- stage & health ---------------- */
function stageForm(id,to){const e=ENG[id];if(e.opsStage===to)return;
  $('#mt').textContent=L('Move stage','نقل المرحلة');
  $('#mb').innerHTML=`<p>${badge(OPS_STAGES,e.opsStage)} → ${badge(OPS_STAGES,to)}</p><div class="field"><label>${L('Note (why / what changed)','ملاحظة (السبب / ما الذي تغيّر)')}</label><textarea class="txt" id="sf_note" rows="3"></textarea></div><div class="savebar"><button class="btn primary" onclick="stageSave('${id}','${to}')">✓ ${L('Move','نقل')}</button></div>`;
  $('#modal').classList.add('show')}
async function stageSave(id,to){const e=JSON.parse(JSON.stringify(ENG[id]));e.stageHistory=[...(e.stageHistory||[]),{at:nowIso(),by:myName(),from:e.opsStage,to,note:$('#sf_note').value.trim()}];e.opsStage=to;if(await saveEngSafe(e,L('Stage updated','تم تحديث المرحلة')))closeModal()}
function healthForm(id){const e=ENG[id],auto=engHealth({...e,healthOverride:null});
  $('#mt').textContent=L('Engagement health','حالة الارتباط');
  $('#mb').innerHTML=`<p>${L('Suggested from the records','المقترحة من السجلات')}: ${healthPill(auto)} ${auto.reasons.length?`<span class="small muted">${auto.reasons.map(esc).join(' · ')}</span>`:''}</p>
   <details class="small" style="margin-bottom:12px"><summary>${L('How health is suggested','كيف تُقترح الحالة')}</summary><ul>${HEALTH_RULES().map(([k,t])=>`<li><b>${L(HEALTH[k][0],HEALTH[k][1])}</b>: ${t}</li>`).join('')}</ul></details>
   <div class="grid g2" style="gap:10px"><div class="field"><label>${L('Override with','استبدال بـ')}</label><select class="txt" id="hf_s"><option value="">${L('— use the suggested health —','— استخدم الحالة المقترحة —')}</option>${Object.entries(HEALTH).map(([k,v])=>`<option value="${k}" ${e.healthOverride&&e.healthOverride.status===k?'selected':''}>${L(v[0],v[1])}</option>`).join('')}</select></div>
   <div class="field"><label>${L('Reason (required for an override)','السبب (مطلوب عند الاستبدال)')}</label><input class="txt" id="hf_r" value="${esc(e.healthOverride&&e.healthOverride.reason||'')}"></div></div>
   ${e.healthOverride?`<p class="small muted">${L('Current override by','الاستبدال الحالي بواسطة')} ${esc(e.healthOverride.by)} · ${esc(String(e.healthOverride.at).slice(0,10))}</p>`:''}
   <div class="savebar"><button class="btn primary" onclick="healthSave('${id}')">💾 ${L('Save','حفظ')}</button></div>`;
  $('#modal').classList.add('show')}
async function healthSave(id){const e=JSON.parse(JSON.stringify(ENG[id])),s=$('#hf_s').value,r=$('#hf_r').value.trim();
  if(s&&!r)return toast(L('Give a reason for the override.','اذكر سبب الاستبدال.'));
  const prev=e.healthOverride;e.healthOverride=s?{status:s,reason:r,by:myName(),at:nowIso()}:null;
  e.stageHistory=[...(e.stageHistory||[]),{at:nowIso(),by:myName(),from:e.opsStage,to:e.opsStage,note:s?`${L('Health set to','تم ضبط الحالة إلى')} ${L(...HEALTH[s].slice(0,2))}: ${r}`:(prev?L('Health override removed','أُلغي الاستبدال اليدوي للحالة'):'')}].filter(x=>x.note);
  if(await saveEngSafe(e,L('Saved','تم الحفظ')))closeModal()}

/* ---------------- activities (and actions created from them) ---------------- */
function activityForm(id,aid,planned){
  if(!id){const list=Object.values(ENG).sort((a,b)=>a.org.localeCompare(b.org));if(!list.length)return toast(L('Create a client account first.','أنشئ حساب عميل أولاً.'));
    $('#mt').textContent=L('Log activity','تسجيل نشاط');$('#mb').innerHTML=`<div class="field"><label>${L('Client','العميل')}</label><select class="txt" id="pick">${list.map(e=>`<option value="${e.id}">${esc(e.org)}</option>`).join('')}</select></div><div class="savebar"><button class="btn primary" onclick="activityForm($('#pick').value)">${L('Continue','متابعة')} →</button></div>`;$('#modal').classList.add('show');return}
  const e=ENG[id],a=aid?{...(e.activities||[]).find(x=>x.id===aid)}:{id:eid('A'),title:'',type:planned?'meeting':'meeting',d:planned?dAdd(7):todayStr(),status:planned?'planned':'done',intP:'',extP:'',summary:'',decisions:'',requests:'',commitments:'',nextSteps:'',links:''};
  window._af={eid:id,a,isNew:!aid};window._newActs=[];
  $('#mt').textContent=`${e.org} — ${aid?L('Edit activity','تعديل النشاط'):planned?L('Schedule activity','جدولة نشاط'):L('Log activity','تسجيل نشاط')}`;
  const ta=(k,t,r=2)=>`<div class="field"><label>${t}</label><textarea class="txt" id="af_${k}" rows="${r}">${esc(a[k]||'')}</textarea></div>`;
  $('#mb').innerHTML=`<div class="grid g3" style="gap:10px"><div class="field" style="grid-column:span 2"><label>${L('Title','العنوان')} *</label><input class="txt" id="af_title" value="${esc(a.title)}"></div>
   <div class="field"><label>${L('Date','التاريخ')}</label><input class="txt" type="date" id="af_d" value="${esc(a.d)}"></div>
   <div class="field"><label>${L('Type','النوع')}</label><select class="txt" id="af_type">${optList(EACT,a.type)}</select></div>
   <div class="field"><label>${L('Status','الحالة')}</label><select class="txt" id="af_status"><option value="done" ${a.status!=='planned'?'selected':''}>${L('Took place','تم')}</option><option value="planned" ${a.status==='planned'?'selected':''}>${L('Planned / upcoming','مخطط / قادم')}</option></select></div>
   <div class="field"><label>${L('Internal participants','المشاركون الداخليون')}</label><input class="txt" id="af_intP" value="${esc(a.intP)}"></div>
   <div class="field" style="grid-column:span 3"><label>${L('Client / external participants','المشاركون من العميل / الخارجيون')}</label><input class="txt" id="af_extP" value="${esc(a.extP)}"></div></div>
   ${ta('summary',L('Discussion summary','ملخص النقاش'),3)}<div class="grid g2" style="gap:10px">${ta('decisions',L('Key decisions','القرارات الرئيسية'))}${ta('requests',L('Client requests','طلبات العميل'))}${ta('commitments',L('Internal commitments','الالتزامات الداخلية'))}${ta('nextSteps',L('Next steps','الخطوات التالية'))}</div>${ta('links',L('Attachments / reference links','المرفقات / الروابط المرجعية'),1)}
   <div class="card" style="background:var(--soft);margin-top:6px"><b>✓ ${L('Actions from this activity','الإجراءات الناتجة عن هذا النشاط')}</b><p class="small muted" style="margin:4px 0 8px">${L('Logging the meeting does not complete anything — each action below is tracked separately until its owner closes it.','تسجيل الاجتماع لا يُكمل أي شيء — يُتابَع كل إجراء أدناه بشكل مستقل حتى يغلقه المسؤول عنه.')}</p><div id="na"></div><button class="btn sm" onclick="naAdd()">＋ ${L('Add action','إضافة إجراء')}</button></div>
   <div class="savebar"><button class="btn primary" onclick="activitySave()">💾 ${L('Save activity','حفظ النشاط')}</button>${aid?`<button class="btn" onclick="activitySave(true)">🗑 ${L('Delete','حذف')}</button>`:''}</div>`;
  $('#modal').classList.add('show');
}
const ownerInput=(idp,v)=>`<input class="txt" id="${idp}" list="ppl2" value="${esc(v||'')}" placeholder="${L('Owner','المسؤول')}"><datalist id="ppl2">${PEOPLE.map(p=>`<option value="${esc(p.name)}">`).join('')}</datalist>`;
function naAdd(){const i=window._newActs.length;window._newActs.push(1);const d=document.createElement('div');d.className='na-row';d.innerHTML=`<input class="txt" id="na_t${i}" placeholder="${L('Action title','عنوان الإجراء')}">${ownerInput('na_o'+i,'')}<select class="txt" id="na_tm${i}">${optList(TEAMS,'presales')}</select><input class="txt" type="date" id="na_d${i}" value="${dAdd(7)}"><select class="txt" id="na_p${i}">${optList(PRIO,'medium')}</select><select class="txt" id="na_s${i}"><option value="internal">${L('We committed','التزام منّا')}</option><option value="client">${L('Client asked','طلب من العميل')}</option><option value="clientdep">${L('Client must provide','على العميل تقديمه')}</option></select>`;$('#na').appendChild(d)}
async function activitySave(del){const {eid:id,a,isNew}=window._af;const e=JSON.parse(JSON.stringify(ENG[id]));e.activities=e.activities||[];
  if(del){if(!confirmDel('act'+a.id))return;e.activities=e.activities.filter(x=>x.id!==a.id);if(await saveEngSafe(e,L('Deleted','تم الحذف')))closeModal();return}
  ['title','d','type','status','intP','extP','summary','decisions','requests','commitments','nextSteps','links'].forEach(k=>a[k]=$('#af_'+k).value.trim());
  if(!a.title)return toast(L('Enter a title.','أدخل العنوان.'));if(!a.d)return toast(L('Enter a date.','أدخل التاريخ.'));
  a.by=a.by||myName();a.at=a.at||nowIso();a.editedAt=isNew?undefined:nowIso();
  const i=e.activities.findIndex(x=>x.id===a.id);if(i>=0)e.activities[i]=a;else e.activities.push(a);
  if(!(await saveEngSafe(e)))return;
  let made=0,linked=0;
  for(let k=0;k<window._newActs.length;k++){const t=$('#na_t'+k).value.trim();if(!t)continue;const src=$('#na_s'+k).value;
    const dup=ACTIONS.find(x=>x.clientId===id&&openA(x)&&(norm(x.title)===norm(t)||(norm(t).length>12&&(norm(x.title).includes(norm(t))||norm(t).includes(norm(x.title))))));
    if(dup){await actionComment(dup.id,`${L('Raised again in','أُثير مجدداً في')}: ${a.title} (${a.d})`,true);linked++;continue}
    await actionCreate({clientId:id,activityId:a.id,title:t,ownerName:$('#na_o'+k).value.trim(),team:src==='clientdep'?'client':$('#na_tm'+k).value,due:$('#na_d'+k).value,priority:$('#na_p'+k).value,source:src==='client'?'client':'internal',status:src==='clientdep'?'pendclient':'notstarted',description:''});made++}
  toast(L('Activity saved','تم حفظ النشاط')+(made?` · ${made} ${L('action(s) created','إجراء جديد')}`:'')+(linked?` · ${linked} ${L('matched existing actions (no duplicate)','طابق إجراءات قائمة (دون تكرار)')}`:''));closeModal();
}
let _armed='';function confirmDel(k){if(_armed===k){_armed='';return true}_armed=k;toast(L('Press Delete again to confirm','اضغط حذف مرة أخرى للتأكيد'));setTimeout(()=>{if(_armed===k)_armed=''},5000);return false}

/* ---------------- action tracker ---------------- */
const sortActions=(a,b)=>(openA(b)-openA(a))||String(a.due||'9999').localeCompare(String(b.due||'9999'))||PRIO.findIndex(p=>p[0]===b.priority)-PRIO.findIndex(p=>p[0]===a.priority);
const PRESETS=()=>[['mine',L('My actions','إجراءاتي'),a=>a.ownerUid===ME.id||(!a.ownerUid&&a.ownerName&&a.ownerName===myName())],['open',L('All open','كل المفتوحة'),openA],['overdue',L('Overdue','متأخرة'),isOverdue],['week',L('Due this week','مستحقة هذا الأسبوع'),dueWeek],['pendclient',L('Pending client','بانتظار العميل'),a=>a.status==='pendclient'],['pendinternal',L('Pending internal','بانتظار الفريق الداخلي'),a=>openA(a)&&['notstarted','inprogress','pendinternal'].includes(a.status)&&a.team!=='client'],['blocked',L('Blocked','متوقفة'),a=>a.status==='blocked'],['done',L('Completed','مكتملة'),a=>a.status==='done'],['all',L('All','الكل'),()=>true]];
function engActionsView(preset){
  if(preset)AF.preset=preset;if(!opsView())AF.preset=AF.preset==='done'?'done':'mine';
  const P=PRESETS(),pf=(P.find(p=>p[0]===AF.preset)||P[1])[2];
  let list=ACTIONS.filter(pf).filter(a=>(!AF.client||a.clientId===AF.client)&&(!AF.owner||a.ownerName===AF.owner)&&(!AF.team||a.team===AF.team)&&(!AF.priority||a.priority===AF.priority)&&(!AF.status||a.status===AF.status)&&(!AF.due||(a.due&&a.due<=AF.due))&&(!AF.q||norm(a.title+' '+a.description+' '+a.clientName).includes(norm(AF.q))));
  list.sort(sortActions);
  const owners=[...new Set(ACTIONS.map(a=>a.ownerName).filter(Boolean))].sort();
  const clients=[...new Map(ACTIONS.map(a=>[a.clientId,a.clientName])).entries()].sort((a,b)=>String(a[1]).localeCompare(String(b[1])));
  const pc=k=>ACTIONS.filter((P.find(p=>p[0]===k)||[0,0,()=>0])[2]).length;
  return `<div class="page-hd"><div><h1>${opsView()?L('Action tracker','متتبع الإجراءات'):L('My actions','إجراءاتي')}</h1><p class="muted">${opsView()?L('Every follow-up, deliverable and client dependency in one list. Overdue items are highlighted.','كل متابعة وتسليم واعتمادية على العميل في قائمة واحدة. تُبرز العناصر المتأخرة.'):L('Actions assigned to you. Update the status and add comments as you progress.','الإجراءات المسندة إليك. حدّث الحالة وأضف التعليقات أثناء التقدم.')}</p></div>
   ${opsView()?`<div style="display:flex;gap:8px"><button class="btn" onclick="exportActions()">⬇ Excel</button><button class="btn primary" onclick="actionForm()">＋ ${L('New action','إجراء جديد')}</button></div>`:''}</div>
  <div class="chips">${P.filter(p=>opsView()||['mine','done'].includes(p[0])).map(([k,t])=>`<button class="${AF.preset===k?'on':''}" onclick="AF.preset='${k}';render()">${t} <span class="n">${pc(k)}</span></button>`).join('')}</div>
  ${opsView()?`<div class="filters"><input class="txt" placeholder="🔍 ${L('Search','بحث')}" value="${esc(AF.q)}" onchange="AF.q=this.value;render()">
   <select class="txt" onchange="AF.client=this.value;render()"><option value="">${L('All clients','كل العملاء')}</option>${clients.map(([id,n])=>`<option value="${id}" ${AF.client===id?'selected':''}>${esc(n)}</option>`).join('')}</select>
   <select class="txt" onchange="AF.owner=this.value;render()"><option value="">${L('All owners','كل المسؤولين')}</option>${owners.map(o=>`<option ${AF.owner===o?'selected':''}>${esc(o)}</option>`).join('')}</select>
   <select class="txt" onchange="AF.team=this.value;render()">${optList(TEAMS,AF.team,L('All teams','كل الفرق'))}</select>
   <select class="txt" onchange="AF.priority=this.value;render()">${optList(PRIO,AF.priority,L('All priorities','كل الأولويات'))}</select>
   <select class="txt" onchange="AF.status=this.value;render()">${optList(A_STATUS,AF.status,L('All statuses','كل الحالات'))}</select>
   <label class="small muted">${L('Due by','مستحق حتى')} <input class="txt" type="date" value="${esc(AF.due)}" onchange="AF.due=this.value;render()" style="width:auto"></label>
   ${AF.client||AF.owner||AF.team||AF.priority||AF.status||AF.due||AF.q?`<button class="btn sm" onclick="Object.assign(AF,{client:'',owner:'',team:'',priority:'',status:'',due:'',q:''});render()">✕ ${L('Clear','مسح')}</button>`:''}</div>`:''}
  ${actionsTable(list)}`;
}
function actionsTable(list,inAcct){
  if(!list.length)return `<div class="empty">${L('No actions here.','لا توجد إجراءات هنا.')}</div>`;
  return `<div class="card" style="padding:0;overflow:auto"><table class="leads"><thead><tr><th>${L('Action','الإجراء')}</th>${inAcct?'':`<th>${L('Client','العميل')}</th>`}<th>${L('Owner / team','المسؤول / الفريق')}</th><th>${L('Due','الاستحقاق')}</th><th>${L('Priority','الأولوية')}</th><th>${L('Status','الحالة')}</th><th>${L('Updated','آخر تحديث')}</th></tr></thead><tbody>
  ${list.map(a=>`<tr class="${isOverdue(a)?'od':''}" onclick="actionView('${a.id}')"><td><b class="lk">${esc(a.title)}</b>${a.source==='client'?` <span class="small muted">· ${L('client request','طلب العميل')}</span>`:''}</td>${inAcct?'':`<td class="small">${esc(a.clientName||'')}</td>`}<td class="small">${esc(a.ownerName||'—')}<div class="muted">${lbl(TEAMS,a.team)}</div></td><td class="small ${isOverdue(a)?'late':''}">${esc(a.due||'—')}${isOverdue(a)?' ⚠':''}</td><td>${badge(PRIO,a.priority)}</td><td onclick="event.stopPropagation()"><select class="txt sm" onchange="actionStatus('${a.id}',this.value)" ${canEditAction(a)?'':'disabled'}>${optList(A_STATUS,a.status)}</select></td><td class="small muted">${esc(String(a.updatedAt||a.createdAt||'').slice(0,10))}</td></tr>`).join('')}</tbody></table></div>`;
}
const canEditAction=a=>isOps()||a.ownerUid===ME.id;
function actionForm(aid,pre){
  const ex=aid?ACTIONS.find(x=>x.id===aid):null,a=ex?{...ex}:{clientId:'',activityId:'',title:'',description:'',ownerName:'',team:'presales',due:dAdd(7),priority:'medium',status:'notstarted',source:'internal',...(pre||{})};
  const list=Object.values(ENG).sort((x,y)=>x.org.localeCompare(y.org));if(!list.length)return toast(L('Create a client account first.','أنشئ حساب عميل أولاً.'));
  window._ac={aid,a};const e=ENG[a.clientId];const acts=e?engActs(e):[];
  $('#mt').textContent=aid?L('Edit action','تعديل الإجراء'):L('New action','إجراء جديد');
  $('#mb').innerHTML=`<div class="field"><label>${L('Action title','عنوان الإجراء')} *</label><input class="txt" id="ac_title" value="${esc(a.title)}"></div>
   <div class="field"><label>${L('Description','الوصف')}</label><textarea class="txt" id="ac_description" rows="3">${esc(a.description)}</textarea></div>
   <div class="grid g3" style="gap:10px"><div class="field"><label>${L('Client account','حساب العميل')} *</label><select class="txt" id="ac_clientId" onchange="window._ac.a.clientId=this.value;window._ac.a.title=$('#ac_title').value;actionForm(window._ac.aid,{...window._ac.a,clientId:this.value})">${list.map(x=>`<option value="${x.id}" ${x.id===a.clientId?'selected':''}>${esc(x.org)}</option>`).join('')}</select></div>
   <div class="field"><label>${L('Related activity','النشاط المرتبط')}</label><select class="txt" id="ac_activityId"><option value="">—</option>${acts.map(x=>`<option value="${x.id}" ${x.id===a.activityId?'selected':''}>${esc(x.d)} · ${esc(x.title.slice(0,50))}</option>`).join('')}</select></div>
   <div class="field"><label>${L('Owner','المسؤول')}</label>${ownerInput('ac_ownerName',a.ownerName)}</div>
   <div class="field"><label>${L('Responsible team','الفريق المسؤول')}</label><select class="txt" id="ac_team">${optList(TEAMS,a.team)}</select></div>
   <div class="field"><label>${L('Due date','تاريخ الاستحقاق')}</label><input class="txt" type="date" id="ac_due" value="${esc(a.due)}"></div>
   <div class="field"><label>${L('Priority','الأولوية')}</label><select class="txt" id="ac_priority">${optList(PRIO,a.priority)}</select></div>
   <div class="field"><label>${L('Status','الحالة')}</label><select class="txt" id="ac_status">${optList(A_STATUS,a.status)}</select></div>
   <div class="field"><label>${L('Origin','المصدر')}</label><select class="txt" id="ac_source"><option value="internal" ${a.source!=='client'?'selected':''}>${L('Internal commitment / follow-up','التزام داخلي / متابعة')}</option><option value="client" ${a.source==='client'?'selected':''}>${L('Client request (we owe the client)','طلب من العميل (علينا)')}</option></select></div></div>
   <p class="small muted">${L('Pick an owner from the list to let them update the action themselves. External names (client or partner staff) are fine too.','اختر المسؤول من القائمة ليتمكن من تحديث الإجراء بنفسه. يمكن أيضاً كتابة أسماء خارجية (من العميل أو الشريك).')}</p>
   <div class="savebar"><button class="btn primary" onclick="actionSave()">💾 ${L('Save','حفظ')}</button>${aid?`<button class="btn" onclick="actionDelete('${aid}')">🗑 ${L('Delete','حذف')}</button>`:''}</div>`;
  $('#modal').classList.add('show');
}
async function actionCreate(f){const e=ENG[f.clientId],pu=PEOPLE.find(p=>p.name===f.ownerName),t=nowIso();
  const doc={clientId:f.clientId,clientName:e?e.org:'',activityId:f.activityId||'',title:f.title,description:f.description||'',ownerName:f.ownerName||'',ownerUid:pu?pu.uid:'',team:f.team||'presales',due:f.due||'',priority:f.priority||'medium',status:f.status||'notstarted',source:f.source||'internal',
    createdAt:t,createdBy:ME.id,createdByName:myName(),updatedAt:t,updatedBy:ME.id,updatedByName:myName(),completedAt:f.status==='done'?t:'',history:[{at:t,by:myName(),from:'',to:f.status||'notstarted',note:L('Created','تم الإنشاء')}],comments:[]};
  const r=await DB.collection('actions').add(doc);return r.id}
async function actionSave(){const {aid,a}=window._ac;const f={};['title','description','clientId','activityId','ownerName','team','due','priority','status','source'].forEach(k=>f[k]=$('#ac_'+k).value.trim());
  if(!f.title||f.title.length<2)return toast(L('Enter a title.','أدخل العنوان.'));
  try{if(!aid){const dup=ACTIONS.find(x=>x.clientId===f.clientId&&openA(x)&&norm(x.title)===norm(f.title));if(dup){toast(L('An open action with this title already exists for this client.','يوجد إجراء مفتوح بنفس العنوان لهذا العميل.'));return actionView(dup.id)}
      await actionCreate(f)}
    else{const ex=ACTIONS.find(x=>x.id===aid),pu=PEOPLE.find(p=>p.name===f.ownerName),t=nowIso(),e=ENG[f.clientId];
      const upd={...f,clientName:e?e.org:ex.clientName,ownerUid:pu?pu.uid:(f.ownerName===ex.ownerName?ex.ownerUid||'':''),updatedAt:t,updatedBy:ME.id,updatedByName:myName()};
      if(f.status!==ex.status){upd.history=[...(ex.history||[]),{at:t,by:myName(),from:ex.status,to:f.status,note:''}];upd.completedAt=f.status==='done'?t:''}
      await DB.collection('actions').doc(aid).update(upd)}
    toast(L('Saved','تم الحفظ'));closeModal()}catch(err){toast(isDenied(err)?L('You do not have permission.','لا تملك الصلاحية.'):err.message)}}
async function actionDelete(id){if(!confirmDel('ac'+id))return;try{await DB.collection('actions').doc(id).delete();toast(L('Deleted','تم الحذف'));closeModal()}catch(e){toast(L('Could not delete','تعذّر الحذف'))}}
async function actionStatus(id,s,note){const a=ACTIONS.find(x=>x.id===id);if(!a||a.status===s)return;const t=nowIso();
  try{await DB.collection('actions').doc(id).update({status:s,history:[...(a.history||[]),{at:t,by:myName(),from:a.status,to:s,note:note||''}],completedAt:s==='done'?t:'',updatedAt:t,updatedBy:ME.id,updatedByName:myName()});toast(L('Status updated','تم تحديث الحالة'))}
  catch(e){toast(isDenied(e)?L('Only the owner or a project manager can update this action.','يمكن للمسؤول عن الإجراء أو مدير المشروع فقط تحديثه.'):e.message);render()}}
async function actionComment(id,text,silent){const a=ACTIONS.find(x=>x.id===id);if(!a||!text)return;const t=nowIso();
  try{await DB.collection('actions').doc(id).update({comments:[...(a.comments||[]),{at:t,by:myName(),text}],updatedAt:t,updatedBy:ME.id,updatedByName:myName()});if(!silent)toast(L('Comment added','تمت إضافة التعليق'))}catch(e){if(!silent)toast(L('Could not add comment','تعذّرت إضافة التعليق'))}}
function actionView(id){const a=ACTIONS.find(x=>x.id===id);if(!a)return;const e=ENG[a.clientId],act=e&&(e.activities||[]).find(x=>x.id===a.activityId);
  $('#mt').textContent=a.title;
  $('#mb').innerHTML=`<div class="meta" style="margin-bottom:10px">${badge(A_STATUS,a.status)} ${badge(PRIO,a.priority)} <span class="small">${L('Client','العميل')}: ${e&&isOps()?`<a href="javascript:closeModal();go('eng','acct','${a.clientId}')">${esc(a.clientName)}</a>`:esc(a.clientName)}</span> <span class="small">${L('Owner','المسؤول')}: <b>${esc(a.ownerName||'—')}</b> · ${lbl(TEAMS,a.team)}</span> <span class="small ${isOverdue(a)?'late':''}">${L('Due','الاستحقاق')}: ${esc(a.due||'—')}</span></div>
   ${a.description?`<p style="white-space:pre-wrap">${esc(a.description)}</p>`:''}
   ${act?`<p class="small">${L('From activity','من النشاط')}: ${isOps()?`<a href="javascript:closeModal();go('eng','acct','${a.clientId}~activities')">${esc(act.d)} · ${esc(act.title)}</a>`:`${esc(act.d)} · ${esc(act.title)}`}</p>`:''}
   <p class="small muted">${L('Created','أُنشئ')} ${esc(String(a.createdAt).slice(0,10))} ${L('by','بواسطة')} ${esc(a.createdByName||'')}${a.completedAt?` · ${L('Completed','اكتمل')} ${esc(String(a.completedAt).slice(0,10))}`:''}</p>
   ${canEditAction(a)?`<div class="card" style="background:var(--soft)"><div class="grid g3" style="gap:10px;align-items:end"><div class="field"><label>${L('Update status','تحديث الحالة')}</label><select class="txt" id="av_s">${optList(A_STATUS,a.status)}</select></div><div class="field" style="grid-column:span 2"><label>${L('Note / comment','ملاحظة / تعليق')}</label><input class="txt" id="av_c"></div></div>
    <div style="display:flex;gap:8px"><button class="btn primary" onclick="actionUpdateFromView('${a.id}')">💾 ${L('Update','تحديث')}</button>${isOps()?`<button class="btn" onclick="actionForm('${a.id}')">✎ ${L('Edit details','تعديل التفاصيل')}</button>`:''}</div></div>`:''}
   <div class="grid g2" style="margin-top:12px"><div><h4>${L('Comments','التعليقات')}</h4>${(a.comments||[]).length?(a.comments||[]).slice().reverse().map(c=>`<div class="small" style="margin-bottom:8px"><b>${esc(c.by)}</b> <span class="muted">${esc(String(c.at).slice(0,16).replace('T',' '))}</span><div style="white-space:pre-wrap">${esc(c.text)}</div></div>`).join(''):`<div class="small muted">—</div>`}</div>
   <div><h4>${L('Status history','سجل الحالة')}</h4>${(a.history||[]).slice().reverse().map(h=>`<div class="small" style="margin-bottom:6px">${esc(String(h.at).slice(0,16).replace('T',' '))} · <b>${esc(h.by)}</b>: ${h.from?lbl(A_STATUS,h.from)+' → ':''}${lbl(A_STATUS,h.to)}${h.note?` <span class="muted">— ${esc(h.note)}</span>`:''}</div>`).join('')}</div></div>`;
  $('#modal').classList.add('show')}
async function actionUpdateFromView(id){const s=$('#av_s').value,c=$('#av_c').value.trim(),a=ACTIONS.find(x=>x.id===id);
  if(s!==a.status)await actionStatus(id,s,c);else if(c)await actionComment(id,c);closeModal()}
function exportActions(){const P=PRESETS(),pf=(P.find(p=>p[0]===AF.preset)||P[1])[2];const rows=ACTIONS.filter(pf).sort(sortActions);
  const hd=[L('Action','الإجراء'),L('Client','العميل'),L('Owner','المسؤول'),L('Team','الفريق'),L('Priority','الأولوية'),L('Status','الحالة'),L('Due','الاستحقاق'),L('Overdue','متأخر'),L('Created','أُنشئ'),L('Completed','اكتمل'),L('Origin','المصدر'),L('Description','الوصف')];
  const csv=[hd,...rows.map(a=>[a.title,a.clientName,a.ownerName,lbl(TEAMS,a.team),lbl(PRIO,a.priority),lbl(A_STATUS,a.status),a.due,isOverdue(a)?'✓':'',String(a.createdAt).slice(0,10),String(a.completedAt||'').slice(0,10),a.source==='client'?L('Client request','طلب العميل'):L('Internal','داخلي'),a.description])].map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
  saveBlob(`IIH_Actions_${AF.preset}_${todayStr()}.csv`,new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'}))}

/* ---------------- risks, issues, blockers, dependencies ---------------- */
const RPRE=()=>[['open',L('Open','مفتوحة'),openR],['critical',L('Critical / high','حرجة / عالية'),r=>openR(r)&&['critical','high'].includes(r.impact)],['blockers',L('Blockers','العوائق'),r=>openR(r)&&r.type==='blocker'],['escalate',L('Escalation required','تتطلب تصعيداً'),r=>openR(r)&&r.escalation],['client',L('Pending client','بانتظار العميل'),r=>openR(r)&&r.party==='client'],['internal',L('Internal team','الفريق الداخلي'),r=>openR(r)&&r.party==='internal'],['vendor',L('Vendor','المورّد'),r=>openR(r)&&r.party==='vendor'],['management',L('Management decision','قرار الإدارة'),r=>openR(r)&&r.party==='management'],['resolved',L('Resolved / closed','محلولة / مغلقة'),r=>!openR(r)]];
function engRisksView(p){if(p)RF.preset=p;const P=RPRE(),pf=(P.find(x=>x[0]===RF.preset)||P[0])[2];
  const list=RISKS.filter(pf).filter(r=>(!RF.client||r.clientId===RF.client)&&(!RF.type||r.type===RF.type)&&(!RF.impact||r.impact===RF.impact));
  const clients=Object.values(ENG).sort((a,b)=>a.org.localeCompare(b.org));
  return `<div class="page-hd"><div><h1>${L('Risks & blockers','المخاطر والعوائق')}</h1><p class="muted">${L('Risks, issues, blockers and dependencies — and who has to act: the client, our team, a vendor or management.','المخاطر والمشكلات والعوائق والاعتماديات — ومن عليه التصرف: العميل أو فريقنا أو المورّد أو الإدارة.')}</p></div><button class="btn primary" onclick="riskForm()">＋ ${L('New entry','إدخال جديد')}</button></div>
  <div class="chips">${P.map(([k,t,f])=>`<button class="${RF.preset===k?'on':''}" onclick="RF.preset='${k}';render()">${t} <span class="n">${RISKS.filter(f).length}</span></button>`).join('')}</div>
  <div class="filters"><select class="txt" onchange="RF.client=this.value;render()"><option value="">${L('All clients','كل العملاء')}</option>${clients.map(e=>`<option value="${e.id}" ${RF.client===e.id?'selected':''}>${esc(e.org)}</option>`).join('')}</select><select class="txt" onchange="RF.type=this.value;render()">${optList(R_TYPES,RF.type,L('All types','كل الأنواع'))}</select><select class="txt" onchange="RF.impact=this.value;render()">${optList(PRIO,RF.impact,L('All impacts','كل التأثيرات'))}</select></div>
  ${risksTable(list)}`}
function risksTable(list,inAcct){
  if(!list.length)return `<div class="empty">${L('Nothing here.','لا يوجد شيء هنا.')}</div>`;
  list=list.slice().sort((a,b)=>(openR(b)-openR(a))||PRIO.findIndex(p=>p[0]===b.impact)-PRIO.findIndex(p=>p[0]===a.impact));
  return `<div class="card" style="padding:0;overflow:auto"><table class="leads"><thead><tr><th>${L('Title','العنوان')}</th>${inAcct?'':`<th>${L('Client','العميل')}</th>`}<th>${L('Type','النوع')}</th><th>${L('Impact','التأثير')}</th><th>${L('Who must act','من عليه التصرف')}</th><th>${L('Owner','المسؤول')}</th><th>${L('Target date','التاريخ المستهدف')}</th><th>${L('Status','الحالة')}</th></tr></thead><tbody>
  ${list.map(r=>`<tr class="${openR(r)&&r.target&&r.target<todayStr()?'od':''}" onclick="riskForm('${r.id}')"><td><b class="lk">${esc(r.title)}</b>${r.escalation&&openR(r)?' <span class="spill" style="--c:#C0392B">⬆ '+L('Escalate','تصعيد')+'</span>':''}</td>${inAcct?'':`<td class="small">${esc(r.clientName||'')}</td>`}<td class="small">${lbl(R_TYPES,r.type)}</td><td>${badge(PRIO,r.impact)}</td><td class="small">${lbl(PARTIES,r.party)}</td><td class="small">${esc(r.ownerName||'—')}</td><td class="small">${esc(r.target||'—')}</td><td>${badge(R_STATUS,r.status)}</td></tr>`).join('')}</tbody></table></div>`}
function riskForm(id,clientId){const ex=id?RISKS.find(x=>x.id===id):null;const r=ex?{...ex}:{clientId:clientId||'',type:'risk',title:'',description:'',impact:'medium',ownerName:'',party:'internal',identified:todayStr(),target:dAdd(14),mitigation:'',status:'open',escalation:false};
  const list=Object.values(ENG).sort((a,b)=>a.org.localeCompare(b.org));if(!list.length)return toast(L('Create a client account first.','أنشئ حساب عميل أولاً.'));
  $('#mt').textContent=id?L('Risk / blocker','خطر / عائق'):L('New risk, issue, blocker or dependency','خطر أو مشكلة أو عائق أو اعتمادية جديدة');
  $('#mb').innerHTML=`<div class="grid g3" style="gap:10px"><div class="field" style="grid-column:span 2"><label>${L('Title','العنوان')} *</label><input class="txt" id="rf_title" value="${esc(r.title)}"></div><div class="field"><label>${L('Client account','حساب العميل')}</label><select class="txt" id="rf_clientId">${list.map(e=>`<option value="${e.id}" ${e.id===r.clientId?'selected':''}>${esc(e.org)}</option>`).join('')}</select></div>
   <div class="field"><label>${L('Type','النوع')}</label><select class="txt" id="rf_type">${optList(R_TYPES,r.type)}</select></div><div class="field"><label>${L('Impact','التأثير')}</label><select class="txt" id="rf_impact">${optList(PRIO,r.impact)}</select></div><div class="field"><label>${L('Who must act','من عليه التصرف')}</label><select class="txt" id="rf_party">${optList(PARTIES,r.party)}</select></div>
   <div class="field"><label>${L('Responsible owner','المسؤول')}</label>${ownerInput('rf_ownerName',r.ownerName)}</div><div class="field"><label>${L('Date identified','تاريخ الرصد')}</label><input class="txt" type="date" id="rf_identified" value="${esc(r.identified)}"></div><div class="field"><label>${L('Target resolution','تاريخ الحل المستهدف')}</label><input class="txt" type="date" id="rf_target" value="${esc(r.target)}"></div>
   <div class="field"><label>${L('Status','الحالة')}</label><select class="txt" id="rf_status">${optList(R_STATUS,r.status)}</select></div><div class="field" style="grid-column:span 2;align-self:end"><label class="small"><input type="checkbox" id="rf_escalation" ${r.escalation?'checked':''}> ${L('Escalation required','يتطلب تصعيداً')}</label></div></div>
   <div class="field"><label>${L('Description','الوصف')}</label><textarea class="txt" id="rf_description" rows="3">${esc(r.description)}</textarea></div>
   <div class="field"><label>${L('Mitigation / resolution action','إجراء المعالجة / الحل')}</label><textarea class="txt" id="rf_mitigation" rows="2">${esc(r.mitigation)}</textarea></div>
   ${ex?`<p class="small muted">${L('Identified','رُصد')} ${esc(r.identified)}${r.resolvedAt?` · ${L('Resolved','حُل')} ${esc(String(r.resolvedAt).slice(0,10))}`:''} · ${(r.history||[]).map(h=>`${esc(String(h.at).slice(0,10))} ${esc(h.by)}: ${esc(h.note)}`).join(' · ')}</p>`:''}
   <div class="savebar"><button class="btn primary" onclick="riskSave(${id?`'${id}'`:'null'})">💾 ${L('Save','حفظ')}</button>${id?`<button class="btn" onclick="actionForm(null,{clientId:$('#rf_clientId').value,title:$('#rf_title').value,priority:$('#rf_impact').value,description:$('#rf_mitigation').value})">＋ ${L('Create action for this','إنشاء إجراء لهذا')}</button><button class="btn" onclick="riskDelete('${id}')">🗑</button>`:''}</div>`;
  $('#modal').classList.add('show')}
async function riskSave(id){const f={};['title','clientId','type','impact','party','ownerName','identified','target','status','description','mitigation'].forEach(k=>f[k]=$('#rf_'+k).value.trim());f.escalation=$('#rf_escalation').checked;
  if(!f.title)return toast(L('Enter a title.','أدخل العنوان.'));const e=ENG[f.clientId],t=nowIso();f.clientName=e?e.org:'';f.updatedAt=t;f.updatedBy=myName();
  try{if(id){const ex=RISKS.find(x=>x.id===id);const notes=[];if(ex.status!==f.status)notes.push(`${lbl(R_STATUS,ex.status)} → ${lbl(R_STATUS,f.status)}`);if(ex.impact!==f.impact)notes.push(`${L('impact','التأثير')} ${lbl(PRIO,ex.impact)} → ${lbl(PRIO,f.impact)}`);if(!ex.escalation&&f.escalation)notes.push(L('escalated','تم التصعيد'));
      f.resolvedAt=['resolved','closed'].includes(f.status)?(ex.resolvedAt||t):'';f.history=[...(ex.history||[]),...(notes.length?[{at:t,by:myName(),note:notes.join(', ')}]:[])];await DB.collection('risks').doc(id).update(f)}
    else{f.createdAt=t;f.createdBy=ME.id;f.resolvedAt='';f.history=[{at:t,by:myName(),note:L('Identified','تم الرصد')}];await DB.collection('risks').add(f)}
    toast(L('Saved','تم الحفظ'));closeModal()}catch(err){toast(isDenied(err)?L('You do not have permission.','لا تملك الصلاحية.'):err.message)}}
async function riskDelete(id){if(!confirmDel('rk'+id))return;try{await DB.collection('risks').doc(id).delete();closeModal();toast(L('Deleted','تم الحذف'))}catch(e){toast(L('Could not delete','تعذّر الحذف'))}}

/* ---------------- engagement timeline (built from source records, nothing duplicated) ---------------- */
function acctTimeline(e){const ev=[];
  (e.activities||[]).forEach(a=>ev.push({at:a.d,icon:(EACT.find(t=>t[0]===a.type)||[])[3]||'•',t:`${a.status==='planned'?L('Planned','مخطط')+': ':''}${a.title}`,s:[a.decisions&&L('Decisions','القرارات')+': '+a.decisions].filter(Boolean).join(''),go:`go('eng','acct','${e.id}~activities')`}));
  (e.stageHistory||[]).forEach(h=>ev.push({at:String(h.at).slice(0,10),icon:'➜',t:h.from!==h.to?`${L('Stage','المرحلة')}: ${lbl(OPS_STAGES,h.from)} → ${lbl(OPS_STAGES,h.to)}`:h.note,s:h.from!==h.to?h.note:'',by:h.by}));
  engActions(e.id).forEach(a=>{ev.push({at:String(a.createdAt).slice(0,10),icon:'✚',t:`${L('Action created','إجراء جديد')}: ${a.title}`,s:a.ownerName,go:`actionView('${a.id}')`});if(a.status==='done'&&a.completedAt)ev.push({at:String(a.completedAt).slice(0,10),icon:'✔',t:`${L('Action completed','اكتمل الإجراء')}: ${a.title}`,go:`actionView('${a.id}')`})});
  engRisks(e.id).forEach(r=>{ev.push({at:r.identified||String(r.createdAt).slice(0,10),icon:'⚠',t:`${lbl(R_TYPES,r.type)}: ${r.title}`,s:lbl(PRIO,r.impact),go:`riskForm('${r.id}')`});(r.history||[]).filter(h=>/escalat|تصعيد/i.test(h.note)).forEach(h=>ev.push({at:String(h.at).slice(0,10),icon:'⬆',t:`${L('Escalated','تم التصعيد')}: ${r.title}`,go:`riskForm('${r.id}')`}));if(r.resolvedAt)ev.push({at:String(r.resolvedAt).slice(0,10),icon:'✓',t:`${L('Resolved','تم الحل')}: ${r.title}`,go:`riskForm('${r.id}')`})});
  ev.sort((a,b)=>String(b.at).localeCompare(String(a.at)));
  return ev.length?`<div class="tl">${ev.map(x=>`<div class="tl-i" ${x.go?`onclick="${x.go}" style="cursor:pointer"`:''}><span class="tl-d">${esc(x.at)}</span><span class="tl-ic">${x.icon}</span><div><b>${esc(x.t)}</b>${x.s?`<div class="small muted" style="white-space:pre-wrap">${esc(String(x.s).slice(0,300))}</div>`:''}</div></div>`).join('')}</div>`:`<div class="empty">${L('Nothing recorded yet.','لا يوجد شيء مسجل بعد.')}</div>`}

/* ---------------- link with commercial leads (leadership / presales lead only) ---------------- */
function engFromLead(l,batch){const t=nowIso();return {...engBlank(),id:l.id,leadId:l.id,org:l.org||'',dept:l.dept||'',sector:l.sector||'',city:l.city||'',products:(l.products||[]).slice(),contacts:JSON.parse(JSON.stringify(l.contacts||[])),accountManager:l.owner||'',opsStage:LEAD_TO_OPS[l.stage]||'initial',closed:false,
  activities:(l.activities||[]).filter(a=>!/^(Stage changed|تغيّرت المرحلة)/.test(a.text||'')).map((a,i)=>({id:'A'+l.id.slice(-6)+i,title:String(a.text||'').replace(/^\[[^\]]*\]\s*/,'').slice(0,90),type:OLD_ACT[a.type]||'other',d:a.d||todayStr(),status:'done',intP:'',extP:'',summary:a.text||'',decisions:'',requests:'',commitments:'',nextSteps:'',links:'',by:'migration',at:t})),
  stageHistory:[{at:t,by:batch?L('Migration','الترحيل'):myName(),from:'',to:LEAD_TO_OPS[l.stage]||'initial',note:batch?L('Created from the commercial lead','أُنشئ من الفرصة التجارية'):L('Created with the lead','أُنشئ مع الفرصة')}],createdAt:t,createdBy:ME.id,migrationBatch:batch||null}}
/* keep the client identity in step when sales edit the lead; create the account for brand-new leads */
async function syncEngFromLead(l){if(!['leadership','lead'].includes(realRole))return;try{const e=ENG[l.id];
  if(!e){if(engState!=='live')return;await saveEng(engFromLead(l,null));return}
  const n=JSON.parse(JSON.stringify(e));let ch=false;['org','dept','sector','city'].forEach(k=>{if((l[k]||'')!==(n[k]||'')){n[k]=l[k]||'';ch=true}});
  const pr=[...new Set([...(n.products||[]),...(l.products||[])])];if(pr.length!==(n.products||[]).length){n.products=pr;ch=true}
  if(ch)await saveEng(n)}catch(err){console.warn('engagement sync',err)}}

/* ---------------- one-time migration of existing leads (leadership only) ---------------- */
function migrationPanel(){if(realRole!=='leadership'||typeof LEADS==='undefined')return '';
  const todo=LEADS.filter(l=>!ENG[l.id]),batches=[...new Set(Object.values(ENG).map(e=>e.migrationBatch).filter(Boolean))];
  if(!todo.length&&!batches.length)return '';
  return `<div class="card" style="border-top:4px solid #6B009D;margin-bottom:16px"><h3 class="h3s">⇄ ${L('Create client accounts from existing leads','إنشاء حسابات العملاء من الفرص الحالية')}</h3>
   ${todo.length?`<p class="small">${todo.length} ${L('lead(s) have no client account yet. Migration copies the organisation, products, contacts, owner and activity log into a new client account. The lead itself is not changed; deal value, probability, notes and outcome stay only in the lead. "Stage changed" entries are not copied (they are sales history).','فرصة ليس لها حساب عميل بعد. ينسخ الترحيل اسم الجهة والمنتجات وجهات الاتصال والمسؤول وسجل الأنشطة إلى حساب عميل جديد. لا تتغير الفرصة نفسها؛ وتبقى قيمة الصفقة والاحتمالية والملاحظات والنتيجة في الفرصة فقط. لا تُنسخ قيود "تغيّرت المرحلة" (فهي سجل مبيعات).')}</p>
   <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" onclick="migBackup()">⬇ 1. ${L('Download backup','تنزيل نسخة احتياطية')}</button><button class="btn" onclick="migDry()">👁 2. ${L('Dry run','تجربة دون حفظ')}</button><button class="btn primary" onclick="migRun()">▶ 3. ${L('Run migration','تنفيذ الترحيل')}</button></div><div id="migOut" class="small" style="margin-top:10px"></div>`:''}
   ${batches.length?`<p class="small muted" style="margin-bottom:0">${L('Undo a migration (removes only the accounts it created, and only if no actions or risks were added to them):','التراجع عن الترحيل (يحذف فقط الحسابات التي أنشأها، وفقط إن لم تُضف لها إجراءات أو مخاطر):')} ${batches.map(b=>`<button class="btn sm" onclick="migRollback('${b}')">↶ ${esc(b)}</button>`).join(' ')}</p>`:''}</div>`}
function migBackup(){saveBlob(`IIH_hub_backup_${todayStr()}.json`,new Blob([JSON.stringify({exported:nowIso(),by:ME.email,leads:LEADS,engagements:Object.values(ENG),actions:ACTIONS,risks:RISKS},null,1)],{type:'application/json'}));window._migBk=true;toast(L('Backup downloaded','تم تنزيل النسخة الاحتياطية'))}
function migDry(){const todo=LEADS.filter(l=>!ENG[l.id]);$('#migOut').innerHTML=`<b>${L('Dry run — nothing saved','تجربة — لم يُحفظ شيء')}:</b><table class="users">${todo.map(l=>{const e=engFromLead(l,'dry');return `<tr><td><b>${esc(l.org)}</b></td><td>${stageName(l.stage)} → ${lbl(OPS_STAGES,e.opsStage)}</td><td>${e.contacts.length} ${L('contacts','جهات اتصال')}</td><td>${e.activities.length} ${L('activities','أنشطة')} (${(l.activities||[]).length-e.activities.length} ${L('stage-change entries left in the lead','قيود تغيّر مرحلة تبقى في الفرصة')})</td><td>${(e.products||[]).length} ${L('products','منتجات')}</td></tr>`}).join('')}</table>`;window._migDry=true}
async function migRun(){if(!window._migBk||!window._migDry)return toast(L('Download the backup and run the dry run first.','نزّل النسخة الاحتياطية ونفّذ التجربة أولاً.'));
  const batch='M'+todayStr().replace(/-/g,'')+'-'+Math.random().toString(36).slice(2,5),todo=LEADS.filter(l=>!ENG[l.id]);let ok=0,fail=0;
  for(const l of todo){try{await saveEng(engFromLead(l,batch));ok++}catch(e){fail++}}
  $('#migOut').innerHTML=`✅ ${ok} ${L('client account(s) created','حساب عميل أُنشئ')}${fail?` · ⚠ ${fail} ${L('failed','فشل')}`:''} · ${L('batch','الدفعة')} <b>${batch}</b>`;toast(L('Migration finished','اكتمل الترحيل'))}
async function migRollback(b){const es=Object.values(ENG).filter(e=>e.migrationBatch===b),blocked=es.filter(e=>engActions(e.id).length||engRisks(e.id).length);
  if(blocked.length)return toast(L('Not undone: these accounts already have actions or risks — ','لم يتم التراجع: هذه الحسابات لديها إجراءات أو مخاطر — ')+blocked.map(e=>e.org).join(', '));
  let n=0;for(const e of es){try{await DB.collection('engagements').doc(e.id).delete();delete ENG[e.id];n++}catch(err){}}toast(`↶ ${n} ${L('account(s) removed','حساب حُذف')}`);render()}
