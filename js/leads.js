/* ============ LEADS (shared database) ============ */
const STAGES=[
 {id:'new',en:'New lead',ar:'فرصة جديدة',c:'#8A94A6'},
 {id:'contacted',en:'Contacted',ar:'تم التواصل',c:'#1F8FB3'},
 {id:'discovery',en:'Discovery',ar:'الاستكشاف',c:'#7B61C4'},
 {id:'demo',en:'Demo',ar:'العرض التوضيحي',c:'#3A1F80'},
 {id:'scope',en:'Scope & Vision',ar:'النطاق والرؤية',c:'#9C1C69'},
 {id:'proposal',en:'Proposal',ar:'العرض الفني والمالي',c:'#E0592E'},
 {id:'negotiation',en:'Negotiation',ar:'التفاوض',c:'#C9A24B'},
 {id:'won',en:'Won',ar:'تم الفوز',c:'#25A27F'},
 {id:'lost',en:'Lost',ar:'لم تنجح',c:'#B23A3A'}];
const ACT_TYPES=[['call','Call','مكالمة'],['meeting','Meeting','اجتماع'],['email','Email','بريد إلكتروني'],['demo','Demo','عرض توضيحي'],['note','Note','ملاحظة']];
const STG_NAMES=[['Requirements and analysis','التحليل وجمع المتطلبات'],['Design','التصميم'],['Development and configuration','التطوير والإعداد'],['Testing and UAT','الاختبار وقبول المستخدم (UAT)'],['Deployment and go-live','الإطلاق والتشغيل']];
const stg=id=>STAGES.find(s=>s.id===id)||STAGES[0];
const stageName=id=>L(stg(id).en,stg(id).ar);
const STAGE_PROB={new:5,contacted:10,discovery:20,demo:35,scope:50,proposal:65,negotiation:80,won:100,lost:0};
const LOSS_REASONS=[['price','Price','السعر'],['competitor','Lost to a competitor','خسرنا أمام منافس'],['budget','No budget','لا توجد ميزانية'],['nodecision','No decision / project paused','لا قرار / توقف المشروع'],['fit','Requirements not met','المتطلبات غير مستوفاة'],['timing','Timing','التوقيت'],['incumbent','Incumbent / relationship','مورّد حالي / علاقة'],['other','Other','أخرى']];
const WIN_REASONS=[['fit','Product fit','ملاءمة المنتج'],['value','Price / value','السعر / القيمة'],['relationship','Relationship','العلاقة'],['speed','Speed of delivery','سرعة التنفيذ'],['local','Arabic & local support','الدعم العربي والمحلي'],['compliance','Compliance / hosting in KSA','الامتثال / الاستضافة في المملكة'],['other','Other','أخرى']];
const leadVal=l=>{if(l.valueNum!=null&&l.valueNum!=='')return +l.valueNum||0;const n=parseFloat(String(l.value||'').replace(/[^\d.]/g,''));return isNaN(n)?0:n};
const leadProb=l=>['won','lost'].includes(l.stage)?STAGE_PROB[l.stage]:(l.prob!=null&&l.prob!==''?+l.prob:STAGE_PROB[l.stage]??0);
const sar=n=>(n>=1e6?(n/1e6).toFixed(n>=1e7?0:1)+'M':n>=1e3?Math.round(n/1e3)+'K':String(Math.round(n)))+' '+L('SAR','ر.س');
const stageProgress=id=>id==='lost'?0:Math.round((STAGES.findIndex(s=>s.id===id)+1)/8*100);

let LEADS=[], dbState='connecting', dbWritable=null, leadDraft=null, leadTab='overview', leadFilter={q:'',stage:'',product:''};
const todayStr=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*6e4).toISOString().slice(0,10)};
const canEditLeads=()=>['leadership','lead'].includes(role)&&dbWritable!==false&&dbState!=='error';
/* Leads live in Firestore (collection "leads"). The security rules let only Leadership and Presales leads read or write them. */
let leadsUnsub=null;
function initLeads(){
  if(!['leadership','lead'].includes(realRole)){dbState='live';dbWritable=false;return}
  leadsUnsub=DB.collection('leads').onSnapshot(q=>{
    LEADS=q.docs.map(d=>{let x={};try{x=JSON.parse(d.data().json||'{}')}catch(e){}return {...x,id:d.id}}).sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
    dbState='live';refreshLeads()},e=>{dbState='error';refreshLeads()});
}
function refreshLeads(){if(typeof cur==='undefined')return;if(cur.view==='leads'||(cur.view==='lead'&&!document.activeElement?.closest?.('#leadForm')))render()}
let writeQ=Promise.resolve();
function saveLead(l){
  l.updatedAt=new Date().toISOString();
  const body=JSON.parse(JSON.stringify(l)); delete body.id;
  const i=LEADS.findIndex(x=>x.id===l.id); if(i>=0)LEADS[i]=JSON.parse(JSON.stringify(l)); else LEADS.unshift(JSON.parse(JSON.stringify(l)));
  writeQ=writeQ.then(async()=>{let error=null;try{await DB.collection('leads').doc(l.id).set({org:l.org||'',stage:l.stage||'new',owner:l.owner||'',json:JSON.stringify(body),updatedAt:l.updatedAt,updatedBy:ME.id})}catch(e){error=e}
    if(error){if(isDenied(error)){dbWritable=false;toast(L('You have read-only access to leads.','لديك صلاحية قراءة فقط للفرص.'))}else toast(L('Could not save — please try again.','تعذّر الحفظ، حاول مرة أخرى.'));render();throw error}});
  return writeQ.catch(()=>{});
}
function newId(){return 'L'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function blankLead(){return {id:newId(),org:'',dept:'',sector:'',city:'',website:'',source:'',owner:'',value:'',stage:'new',nextStep:'',nextDate:'',notes:'',products:[],contacts:[],activities:[],timeline:{start:nextSunday(),phases:[]},scope:null,createdAt:new Date().toISOString()}}
function nextSunday(){const d=new Date();d.setDate(d.getDate()+((7-d.getDay())%7||7));return d.toISOString().slice(0,10)}

/* ---- Leads list ---- */
function dbBanner(){
  if(dbState==='live')return dbWritable===false?`<div class="viewer-note" style="display:block">👁 ${L('You have read-only access to leads.','لديك صلاحية قراءة فقط للفرص.')}</div>`:'';
  if(dbState==='connecting')return `<div class="note-info">⏳ ${L('Connecting to the shared lead database…','جارٍ الاتصال بقاعدة بيانات الفرص المشتركة…')}</div>`;
  return `<div class="note-warn">⚠ ${L('Could not reach the lead database. Check your connection and reload the page.','تعذّر الوصول إلى قاعدة بيانات الفرص. تحقق من الاتصال وأعد تحميل الصفحة.')}</div>`;
}
function leadsLocked(){return ['presales','client'].includes(role)||(dbState==='live'&&dbWritable===false)}
function lockedCard(){return `<div class="card" style="text-align:center;padding:40px"><div style="font-size:34px">🔒</div><h2>${L('Leads are visible to the sales team only','الفرص متاحة لفريق المبيعات فقط')}</h2><p class="muted" style="max-width:560px;margin:8px auto 0">${L('Client names, e-mails and mobile numbers are restricted. Ask the hub owner for Contributor access if you need to work on leads.','أسماء العملاء وبريدهم الإلكتروني وأرقام الجوال محمية. اطلب من مالك المركز صلاحية "مساهم" إذا كنت تحتاج للعمل على الفرص.')}</p></div>`}
function vLeads(){
  if(leadsLocked())return lockedCard();
  const f=leadFilter, q=f.q.toLowerCase();
  const list=LEADS.filter(l=>(!f.stage||l.stage===f.stage)&&(!f.product||(l.products||[]).includes(f.product))&&(!q||[l.org,l.dept,l.sector,l.owner,...(l.contacts||[]).map(c=>c.name+' '+c.email)].join(' ').toLowerCase().includes(q)))
    .sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));
  const openL=LEADS.filter(l=>!['won','lost'].includes(l.stage)), wonL=LEADS.filter(l=>l.stage==='won');
  const pipe=openL.reduce((s,l)=>s+leadVal(l),0), wtd=openL.reduce((s,l)=>s+leadVal(l)*leadProb(l)/100,0), wonV=wonL.reduce((s,l)=>s+leadVal(l),0);
  const closed=LEADS.filter(l=>l.outcome&&['won','lost'].includes(l.stage));
  return `${dbBanner()}
  <div class="page-hd"><div><h1>${L('Leads','الفرص')}</h1><p class="muted">${L('Every client we have started talking to: progress, products, contacts, delivery timeline and scope document.','كل العملاء الذين بدأنا التواصل معهم: التقدم والمنتجات وجهات الاتصال والجدول الزمني ووثيقة النطاق.')}</p></div>
   ${canEditLeads()?`<button class="btn green" onclick="addLead()">＋ ${L('New lead','فرصة جديدة')}</button>`:''}</div>
  <div class="grid g4" style="margin-bottom:14px">${[[L('Open leads','الفرص المفتوحة'),openL.length,L('of','من')+' '+LEADS.length+' '+L('leads','فرصة')],[L('Open pipeline','قيمة الفرص المفتوحة'),sar(pipe),L('total deal value','إجمالي قيمة الصفقات')],[L('Weighted forecast','التوقع المرجّح'),sar(wtd),L('value × win probability','القيمة × احتمالية الفوز')],[L('Won','تم الفوز'),sar(wonV),wonL.length+' '+L('deals','صفقة')]].map(([a,b,c])=>`<div class="card kpi-c"><span class="muted small">${a}</span><b>${b}</b><span class="small muted">${c}</span></div>`).join('')}</div>
  ${followUps()}${closed.length?outcomeSummary(closed):''}
  <div class="pipe">${STAGES.map(s=>{const n=LEADS.filter(l=>l.stage===s.id).length;return `<button class="pipe-s ${f.stage===s.id?'on':''}" style="--c:${s.c}" onclick="leadFilter.stage=leadFilter.stage==='${s.id}'?'':'${s.id}';render()"><b>${n}</b><span>${stageName(s.id)}</span></button>`}).join('')}</div>
  <div class="filters"><input class="txt" placeholder="${L('Search client, contact or owner…','ابحث عن عميل أو جهة اتصال أو مسؤول…')}" value="${esc(f.q)}" oninput="leadFilter.q=this.value;clearTimeout(window._lf);window._lf=setTimeout(()=>{render();const i=document.querySelector('.filters input');i.focus();i.setSelectionRange(i.value.length,i.value.length)},250)">
   <select class="txt" onchange="leadFilter.product=this.value;render()"><option value="">${L('All products','كل المنتجات')}</option>${PRODUCTS.map(p=>`<option value="${p.id}" ${f.product===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select>
   ${f.stage||f.product||f.q?`<button class="btn" onclick="leadFilter={q:'',stage:'',product:''};render()">${L('Clear filters','مسح التصفية')}</button>`:''}</div>
  ${list.length?`<div class="card" style="padding:0;overflow:auto"><table class="leads"><thead><tr><th>${L('Client','العميل')}</th><th>${L('Stage','المرحلة')}</th><th>${L('Products','المنتجات')}</th><th>${L('Main contact','جهة الاتصال الرئيسية')}</th><th>${L('Value','القيمة')}</th><th>${L('Next step','الخطوة التالية')}</th><th>${L('Owner','المسؤول')}</th></tr></thead><tbody>
  ${list.map(l=>{const c=(l.contacts||[]).find(x=>x.primary)||(l.contacts||[])[0];return `<tr onclick="go('lead','${l.id}')">
   <td><b class="lk">${esc(l.org||L('(no name)','(بدون اسم)'))}</b><div class="small muted">${esc([l.dept,l.city].filter(Boolean).join(' · '))}</div></td>
   <td><span class="spill" style="--c:${stg(l.stage).c}">${stageName(l.stage)}</span><div class="meter" style="margin-top:6px;width:110px"><i style="width:${stageProgress(l.stage)}%;background:${stg(l.stage).c}"></i></div></td>
   <td>${(l.products||[]).map(id=>{const p=PRODUCTS.find(x=>x.id===id);return p?`<span class="pchip" style="--c:${p.color}">${esc(p.short)}</span>`:''}).join('')||'<span class="muted small">—</span>'}</td>
   <td>${c?`<b>${esc(c.name)}</b><div class="small muted">${esc(c.position||'')}</div>`:'<span class="muted small">—</span>'}</td>
   <td>${leadVal(l)?`<b>${sar(leadVal(l))}</b><div class="small muted">${leadProb(l)}% ${l.closeDate?'· '+esc(l.closeDate):''}</div>`:'<span class="muted small">—</span>'}</td>
   <td>${esc(l.nextStep||'—')}${l.nextDate?`<div class="small ${l.nextDate<todayStr()&&!['won','lost'].includes(l.stage)?'late':'muted'}">${esc(l.nextDate)}</div>`:''}</td>
   <td class="small">${esc(l.owner||'—')}</td></tr>`}).join('')}</tbody></table></div>`
  :`<div class="empty">${LEADS.length?L('No leads match these filters.','لا توجد فرص تطابق التصفية.'):L('No leads yet.','لا توجد فرص بعد.')+(canEditLeads()?` <a href="javascript:addLead()">${L('Add the first lead','أضف أول فرصة')}</a>`:'')}</div>`}`;
}
function followUps(){const today=todayStr(), wk=new Date(Date.now()+7*864e5).toISOString().slice(0,10);
  const owners=[...new Set(LEADS.map(l=>(l.owner||'').trim()).filter(Boolean))].sort(), me=leadFilter.owner||'';
  const due=LEADS.filter(l=>!['won','lost'].includes(l.stage)&&l.nextDate&&l.nextDate<=wk&&(!me||(l.owner||'').trim()===me)).sort((a,b)=>a.nextDate.localeCompare(b.nextDate));
  if(!LEADS.length)return '';
  return `<div class="card fu"><div class="fu-hd"><h3 class="h3s" style="margin:0">⏰ ${L('Follow-ups: overdue and due this week','المتابعات: المتأخرة والمستحقة هذا الأسبوع')}</h3><select class="txt" style="width:auto" onchange="leadFilter.owner=this.value;render()"><option value="">${L('Everyone','الجميع')}</option>${owners.map(o=>`<option ${o===me?'selected':''}>${esc(o)}</option>`).join('')}</select></div>
   ${due.length?due.map(l=>`<div class="fu-row" onclick="go('lead','${l.id}')"><span class="${l.nextDate<today?'late':'muted'} small" style="min-width:92px">${l.nextDate<today?'⚠ ':''}${esc(l.nextDate)}</span><b>${esc(l.org)}</b><span class="muted">— ${esc(l.nextStep||L('(no next step written)','(لم تُكتب خطوة تالية)'))}</span><span style="flex:1"></span><span class="small muted">${esc(l.owner||'')}</span></div>`).join(''):`<div class="small muted">${L('Nothing overdue or due this week.','لا توجد متابعات متأخرة أو مستحقة هذا الأسبوع.')}</div>`}</div>`}
function outcomeSummary(closed){const cnt=(type,list)=>list.map(r=>[r,closed.filter(l=>l.stage===type&&l.outcome.reason===r[0]).length]).filter(x=>x[1]);
  const lost=cnt('lost',LOSS_REASONS), won=cnt('won',WIN_REASONS), comps=closed.filter(l=>l.stage==='lost'&&l.outcome.competitor).map(l=>l.outcome.competitor);
  const bars=(arr,c)=>arr.map(([r,n])=>`<div class="ob"><span>${L(r[1],r[2])}</span><i style="width:${n*28}px;background:${c}"></i><b>${n}</b></div>`).join('')||`<span class="small muted">—</span>`;
  return `<div class="grid g2" style="margin-bottom:14px"><div class="card"><h3 class="h3s">${L('Why we win','لماذا نفوز')}</h3>${bars(won,'#25A27F')}</div><div class="card"><h3 class="h3s">${L('Why we lose','لماذا نخسر')}</h3>${bars(lost,'#B23A3A')}${comps.length?`<div class="small muted" style="margin-top:8px">${L('Lost to','خسرنا أمام')}: ${esc([...new Set(comps)].join(', '))}</div>`:''}</div></div>`}
function addLead(){const l=blankLead();leadDraft=l;leadTab='overview';cur={view:'lead',prod:l.id,cat:'new'};history.replaceState(null,'','#leads');render();}

/* ---- Lead detail ---- */
function getLead(){if(leadDraft&&leadDraft.id===cur.prod)return leadDraft;const l=LEADS.find(x=>x.id===cur.prod);leadDraft=l?JSON.parse(JSON.stringify(l)):null;return leadDraft}
const isNew=()=>!LEADS.find(x=>x.id===cur.prod);
function vLead(){
  if(leadsLocked())return lockedCard();
  const l=getLead(); if(!l)return dbState==='connecting'?`<div class="empty">${L('Loading…','جارٍ التحميل…')}</div>`:`<div class="empty">${L('Lead not found.','لم يتم العثور على الفرصة.')} <a href="javascript:go('leads')">${L('Back to leads','العودة إلى الفرص')}</a></div>`;
  const ed=canEditLeads(), tabs=[['overview',L('Overview','نظرة عامة')],['contacts',L('Contacts','جهات الاتصال')+` <span class="n">${l.contacts.length}</span>`],['products',L('Products','المنتجات')+` <span class="n">${l.products.length}</span>`],['prep','📋 '+L('Meeting prep','تحضير الاجتماع')],['timeline',L('Delivery timeline','الجدول الزمني للتنفيذ')],['scope',L('Scope & Vision','النطاق والرؤية')],['activity',L('Activity','سجل النشاط')+` <span class="n">${l.activities.length}</span>`]];
  const si=STAGES.findIndex(s=>s.id===l.stage);
  return `${dbBanner()}<button class="back" onclick="leadDraft=null;go('leads')">${L('← All leads','→ كل الفرص')}</button>
  <div class="card lead-hd"><div style="flex:1"><div class="pc-cat">${esc(l.sector||L('Lead','فرصة'))}</div><h1>${esc(l.org||L('New lead','فرصة جديدة'))}</h1><div class="muted">${esc([l.dept,l.city].filter(Boolean).join(' · '))}</div>
   <div class="meta"><span class="spill" style="--c:${stg(l.stage).c}">${stageName(l.stage)}</span><span>${L('Owner','المسؤول')}: ${esc(l.owner||'—')}</span>${l.updatedAt?`<span>${L('Updated','آخر تحديث')}: ${esc(l.updatedAt.slice(0,10))}</span>`:''}${leadVal(l)?`<span>${L('Value','القيمة')}: <b>${sar(leadVal(l))}</b> · ${leadProb(l)}%</span>`:''}</div>
   ${l.outcome&&['won','lost'].includes(l.stage)?`<div class="oc ${l.stage}">${l.stage==='won'?'🏆 '+L('Won','تم الفوز'):'✕ '+L('Lost','لم تنجح')} — ${(()=>{const r=(l.stage==='won'?WIN_REASONS:LOSS_REASONS).find(x=>x[0]===l.outcome.reason);return r?L(r[1],r[2]):''})()}${l.outcome.competitor?' ('+esc(l.outcome.competitor)+')':''}${l.outcome.note?` · <span class="muted">${esc(l.outcome.note)}</span>`:''}</div>`:''}</div>
   ${ed&&!isNew()?`<button class="btn" onclick="delLead()">🗑 ${L('Delete','حذف')}</button>`:''}</div>
  <div class="stepper">${STAGES.filter(s=>s.id!=='lost').map((s,i)=>`<button class="step ${l.stage===s.id?'on':''} ${si>i&&l.stage!=='lost'?'done':''}" style="--c:${s.c}" ${ed?`onclick="setStage('${s.id}')"`:'disabled'}><i>${si>i&&l.stage!=='lost'?'✓':i+1}</i><span>${L(s.en,s.ar)}</span></button>`).join('')}
   <button class="step lost ${l.stage==='lost'?'on':''}" ${ed?`onclick="setStage('lost')"`:'disabled'}><i>✕</i><span>${L('Lost','لم تنجح')}</span></button></div>
  <div class="ptabs">${tabs.map(([id,n])=>`<button class="pt ${leadTab===id?'on':''}" onclick="leadTab='${id}';render()">${n}</button>`).join('')}</div>
  <div id="leadForm">${({overview:lOverview,contacts:lContacts,products:lProducts,prep:lPrep,timeline:lTimeline,scope:lScope,activity:lActivity})[leadTab](l,ed)}</div>`;
}
function fld(l,k,label,ed,type,ph){return `<div class="field"><label>${label}</label>${ed?(type==='area'?`<textarea class="txt" rows="3" oninput="leadDraft.${k}=this.value">${esc(l[k]||'')}</textarea>`:`<input class="txt" type="${type||'text'}" value="${esc(l[k]||'')}" placeholder="${esc(ph||'')}" oninput="leadDraft.${k}=this.value">`):`<div class="ro">${esc(l[k]||'—')}</div>`}</div>`}
function saveBar(ed,label){return ed?`<div class="savebar"><button class="btn primary" onclick="commitLead()">💾 ${label||L('Save','حفظ')}</button>${isNew()?`<button class="btn" onclick="leadDraft=null;go('leads')">${L('Cancel','إلغاء')}</button>`:''}</div>`:''}
function commitLead(msg){const l=leadDraft;if(!l.org.trim()){toast(L('Enter the client name first.','أدخل اسم العميل أولاً.'));leadTab='overview';render();return}
  const wasNew=isNew();saveLead(l).then(()=>{toast(msg||L('Saved','تم الحفظ'));if(wasNew){cur.cat='';history.replaceState(null,'','#lead-'+l.id)}render()});}
function setStage(s,force){const l=leadDraft;if(l.stage===s)return;if((s==='won'||s==='lost')&&!force){outcomeForm(s);return}const from=l.stage;l.stage=s;l.activities.unshift({d:todayStr(),type:'note',text:`${L('Stage changed','تغيّرت المرحلة')}: ${stageName(from)} → ${stageName(s)}`});if(isNew()){render();return}commitLead(L('Stage updated','تم تحديث المرحلة'));}
function outcomeForm(s){const W=s==='won',R=W?WIN_REASONS:LOSS_REASONS;window._oc={type:s,reason:'',competitor:'',note:''};
  $('#mt').textContent=W?L('Mark as won','تسجيل الفوز'):L('Mark as lost','تسجيل عدم النجاح');
  $('#mb').innerHTML=`<p class="muted" style="margin-top:0">${W?L('What made us win? This feeds the success stories.','ما سبب الفوز؟ يُستخدم في قصص النجاح.'):L('Why did we lose? This feeds the battle cards and product feedback.','لماذا لم ننجح؟ يُستخدم في بطاقات المنافسة وملاحظات المنتج.')}</p>
   <div class="field"><label>${L('Main reason','السبب الرئيسي')} *</label><div class="seg">${R.map(r=>`<label><input type="radio" name="ocr" onchange="_oc.reason='${r[0]}';segOn(this);document.getElementById('ocC').style.display=('${r[0]}'==='competitor')?'block':'none'">${L(r[1],r[2])}</label>`).join('')}</div></div>
   <div class="field" id="ocC" style="display:none"><label>${L('Which competitor?','أي منافس؟')}</label><input class="txt" oninput="_oc.competitor=this.value"></div>
   <div class="field"><label>${L('What happened (optional)','ماذا حدث (اختياري)')}</label><textarea class="txt" rows="3" oninput="_oc.note=this.value"></textarea></div>
   ${W?'':`<div class="field"><label>${L('Close date','تاريخ الإغلاق')}</label><input class="txt" type="date" value="${todayStr()}" oninput="_oc.date=this.value"></div>`}
   <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" onclick="closeModal()">${L('Cancel','إلغاء')}</button><button class="btn primary" onclick="saveOutcome()">${L('Save','حفظ')}</button></div>`;$('#modal').classList.add('show');}
function saveOutcome(){const o=_oc;if(!o.reason){toast(L('Choose the main reason.','اختر السبب الرئيسي.'));return}
  o.date=o.date||todayStr();leadDraft.outcome=o;leadDraft.closeDate=leadDraft.closeDate||o.date;closeModal();
  const R=o.type==='won'?WIN_REASONS:LOSS_REASONS,r=R.find(x=>x[0]===o.reason);setStage(o.type,true);
  leadDraft.activities[0].text+=` · ${L('Reason','السبب')}: ${r[1]}${o.competitor?' ('+o.competitor+')':''}${o.note?' — '+o.note:''}`;if(!isNew())saveLead(leadDraft);}
function delLead(){const l=leadDraft;$('#mt').textContent=L('Delete lead','حذف الفرصة');$('#mb').innerHTML=`<p>${L('Delete','حذف')} <b>${esc(l.org)}</b> ${L('and all its contacts, timeline and scope? This cannot be undone.','وكل جهات الاتصال والجدول الزمني والنطاق؟ لا يمكن التراجع عن ذلك.')}</p><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" onclick="closeModal()">${L('Cancel','إلغاء')}</button><button class="btn" style="background:#B23A3A;color:#fff;border-color:#B23A3A" onclick="doDelLead()">${L('Delete','حذف')}</button></div>`;$('#modal').classList.add('show');}
function doDelLead(){const id=leadDraft.id;closeModal();
  writeQ=writeQ.then(async()=>{await DB.collection('leads').doc(id).delete();LEADS=LEADS.filter(x=>x.id!==id);toast(L('Lead deleted','تم حذف الفرصة'));leadDraft=null;go('leads')}).catch(()=>toast(L('Could not delete.','تعذّر الحذف.')));}

function lOverview(l,ed){return `<div class="grid g2"><div class="card"><h3 class="h3s">${L('Client details','بيانات العميل')}</h3>
  ${fld(l,'org',L('Client / organisation name','اسم العميل / الجهة')+' *',ed)}${fld(l,'dept',L('Department / sector','الإدارة / القطاع'),ed)}
  <div class="grid g2" style="gap:12px">${fld(l,'sector',L('Industry','المجال'),ed,'text',L('Government, banking…','حكومي، مصرفي…'))}${fld(l,'city',L('City','المدينة'),ed)}</div>
  <div class="grid g2" style="gap:12px">${fld(l,'website',L('Website','الموقع الإلكتروني'),ed)}${fld(l,'source',L('Lead source','مصدر الفرصة'),ed,'text',L('Referral, event, tender…','ترشيح، فعالية، منافسة…'))}</div></div>
  <div class="card"><h3 class="h3s">${L('Progress','التقدم')}</h3>
  <div class="grid g2" style="gap:12px">${fld(l,'owner',L('Account owner (IIH)','المسؤول عن الحساب (IIH)'),ed)}<div class="field"><label>${L('Deal value (SAR)','قيمة الصفقة (ر.س)')}</label>${ed?`<input class="txt" type="number" min="0" step="1000" value="${leadVal(l)||''}" placeholder="0" oninput="leadDraft.valueNum=this.value===''?'':+this.value">`:`<div class="ro">${leadVal(l)?sar(leadVal(l)):'—'}</div>`}</div></div>
  <div class="grid g2" style="gap:12px">${fld(l,'closeDate',L('Expected close date','تاريخ الإغلاق المتوقع'),ed,'date')}<div class="field"><label>${L('Win probability (%)','احتمالية الفوز (%)')}</label>${ed&&!['won','lost'].includes(l.stage)?`<input class="txt" type="number" min="0" max="100" value="${leadProb(l)}" oninput="leadDraft.prob=this.value===''?'':Math.max(0,Math.min(100,+this.value))"><small class="muted">${L('Stage default','الافتراضي للمرحلة')}: ${STAGE_PROB[l.stage]}%</small>`:`<div class="ro">${leadProb(l)}%</div>`}</div></div>
  ${fld(l,'nextStep',L('Next step','الخطوة التالية'),ed)}${fld(l,'nextDate',L('Next step date','تاريخ الخطوة التالية'),ed,'date')}${fld(l,'notes',L('Notes','ملاحظات'),ed,'area')}</div></div>${saveBar(ed,isNew()?L('Create lead','إنشاء الفرصة'):'')}`}

function lContacts(l,ed){return `${l.contacts.length?`<div class="grid g2">${l.contacts.map((c,i)=>`<div class="card contact">${ed?`<div class="grid g2" style="gap:10px">
   <div class="field"><label>${L('Full name','الاسم الكامل')}</label><input class="txt" value="${esc(c.name)}" oninput="leadDraft.contacts[${i}].name=this.value"></div>
   <div class="field"><label>${L('Position','المنصب')}</label><input class="txt" value="${esc(c.position)}" oninput="leadDraft.contacts[${i}].position=this.value"></div>
   <div class="field"><label>${L('Email','البريد الإلكتروني')}</label><input class="txt" type="email" dir="ltr" value="${esc(c.email)}" oninput="leadDraft.contacts[${i}].email=this.value"></div>
   <div class="field"><label>${L('Mobile','الجوال')}</label><input class="txt" type="tel" dir="ltr" value="${esc(c.mobile)}" placeholder="+966 5x xxx xxxx" oninput="leadDraft.contacts[${i}].mobile=this.value"></div></div>
   <div style="display:flex;justify-content:space-between;align-items:center"><label class="small"><input type="radio" name="prim" ${c.primary?'checked':''} onchange="leadDraft.contacts.forEach((x,j)=>x.primary=j===${i})"> ${L('Main contact','جهة الاتصال الرئيسية')}</label><button class="btn" onclick="leadDraft.contacts.splice(${i},1);render()">🗑</button></div>`
   :`<div style="display:flex;justify-content:space-between"><div><b style="font-size:16px;color:var(--navy)">${esc(c.name)}</b>${c.primary?` <span class="pill green">${L('Main contact','جهة الاتصال الرئيسية')}</span>`:''}<div class="muted">${esc(c.position||'')}</div></div><div class="avatar2">${esc((c.name||'?').trim().slice(0,1))}</div></div>
   <div class="cline">✉ <span dir="ltr">${esc(c.email||'—')}</span>${c.email?`<button class="btn mini" onclick="copyText('${esc(c.email)}')">⎘</button>`:''}</div><div class="cline">📱 <span dir="ltr">${esc(c.mobile||'—')}</span>${c.mobile?`<button class="btn mini" onclick="copyText('${esc(c.mobile)}')">⎘</button>`:''}</div>`}</div>`).join('')}</div>`:`<div class="empty">${L('No contacts yet.','لا توجد جهات اتصال بعد.')}</div>`}
  ${ed?`<div class="savebar"><button class="btn" onclick="leadDraft.contacts.push({name:'',position:'',email:'',mobile:'',primary:!leadDraft.contacts.length});render()">＋ ${L('Add contact','إضافة جهة اتصال')}</button><button class="btn primary" onclick="commitLead()">💾 ${L('Save contacts','حفظ جهات الاتصال')}</button></div>`:''}`}

function lProducts(l,ed){return `<p class="muted">${L('Select the products this client needs. They feed the delivery timeline and the scope document.','اختر المنتجات التي يحتاجها العميل. تُستخدم في الجدول الزمني ووثيقة النطاق.')}</p>
  <div class="grid g4">${PRODUCTS.map(p=>{const on=l.products.includes(p.id);return `<div class="card psel ${on?'on':''}" style="--c:${p.color}" ${ed?`onclick="togProd('${p.id}')"`:''}><div class="ck">${on?'✓':''}</div><div style="height:40px;display:flex;align-items:center">${logoImg(p,p.logo!=='qiyas'?40:24)}</div><b>${esc(p.name)}</b><div class="small muted">${esc(PT(p,'cat'))}</div><a class="small" href="javascript:void(0)" onclick="event.stopPropagation();go('product','${p.id}')">${L('Open product kit →','افتح ملف المنتج ←')}</a></div>`}).join('')}</div>${saveBar(ed,L('Save products','حفظ المنتجات'))}`}
function togProd(id){const a=leadDraft.products,i=a.indexOf(id);i>=0?a.splice(i,1):a.push(id);render()}

function lActivity(l,ed){return `${ed?`<div class="card" style="margin-bottom:14px"><div style="display:grid;grid-template-columns:150px 160px 1fr auto;gap:10px;align-items:end">
   <div class="field" style="margin:0"><label>${L('Date','التاريخ')}</label><input class="txt" type="date" id="acD" value="${todayStr()}"></div>
   <div class="field" style="margin:0"><label>${L('Type','النوع')}</label><select class="txt" id="acT">${ACT_TYPES.map(t=>`<option value="${t[0]}">${L(t[1],t[2])}</option>`).join('')}</select></div>
   <div class="field" style="margin:0"><label>${L('What happened','ماذا حدث')}</label><input class="txt" id="acX" placeholder="${L('e.g. Demo of Qiyas MAPE to HR director','مثال: عرض Qiyas MAPE لمدير الموارد البشرية')}"></div>
   <button class="btn primary" onclick="addAct()">＋ ${L('Log','تسجيل')}</button></div></div>`:''}
  ${l.activities.length?`<div class="card"><div class="feed">${l.activities.map((a,i)=>{const t=ACT_TYPES.find(x=>x[0]===a.type)||ACT_TYPES[4];return `<div><span class="ico" style="background:var(--soft)">${{call:'📞',meeting:'👥',email:'✉',demo:'▶',note:'✎'}[a.type]||'✎'}</span><div style="flex:1"><b>${L(t[1],t[2])}</b> · <span class="small muted">${esc(a.d)}</span><div>${esc(a.text)}</div></div>${ed?`<button class="btn mini" onclick="leadDraft.activities.splice(${i},1);commitLead()">🗑</button>`:''}</div>`}).join('')}</div></div>`:`<div class="empty">${L('No activity logged yet.','لا يوجد نشاط مسجل بعد.')}</div>`}`}
function addAct(){const x=$('#acX').value.trim();if(!x)return;leadDraft.activities.unshift({d:$('#acD').value,type:$('#acT').value,text:x});commitLead(L('Activity logged','تم تسجيل النشاط'))}

/* ---- Delivery timeline (IIH template rules, form-based) ---- */
const fmtD=t=>{const d=new Date(t);return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`};
function lTimeline(l,ed){
  const tl=normTl(l.timeline||(l.timeline={start:nextSunday(),phases:[]}));
  if(tl.titleAr==null)tl.titleAr=l.org||''; if(tl.titleEn==null)tl.titleEn=l.org||'';
  const rows=timelineRows(tl), weeks=Math.max(12,...rows.filter(r=>r.kind!=='phase').map(r=>r.sw+r.dur+1));
  const end=rows.filter(r=>r.kind==='item').reduce((m,r)=>Math.max(m,r.end),0), startT=new Date(tl.start+'T00:00:00').getTime();
  const itemRow=id=>rows.find(r=>r.kind==='item'&&r.id===id);
  const settings=`<div class="card" style="margin-bottom:14px"><h3 class="h3s">${L('Timeline details','بيانات الجدول الزمني')}</h3>
   ${ed?`<div class="grid g4" style="gap:12px;align-items:end">
    <div class="field" style="margin:0"><label>${L('Project start date','تاريخ بداية المشروع')}</label><input class="txt" type="date" value="${tl.start}" onchange="leadDraft.timeline.start=this.value;render()"></div>
    <div class="field" style="margin:0"><label>${L('Version','الإصدار')}</label><input class="txt" value="${esc(tl.version)}" oninput="leadDraft.timeline.version=this.value"></div>
    <div class="field" style="margin:0"><label>${L('Client name in the title (Arabic)','اسم العميل في العنوان (عربي)')}</label><input class="txt" dir="rtl" value="${esc(tl.titleAr)}" oninput="leadDraft.timeline.titleAr=this.value"></div>
    <div class="field" style="margin:0"><label>${L('Client name in the title (English)','اسم العميل في العنوان (إنجليزي)')}</label><input class="txt" dir="ltr" value="${esc(tl.titleEn)}" oninput="leadDraft.timeline.titleEn=this.value"></div></div>
    <div class="savebar"><button class="btn" onclick="phaseForm()">＋ ${L('Add phase','إضافة مرحلة')}</button><button class="btn" onclick="tlFromProducts()">⚡ ${L('Draft from selected products','مسودة من المنتجات المختارة')}</button><span style="flex:1"></span><button class="btn primary" onclick="commitLead(L('Timeline saved','تم حفظ الجدول الزمني'))">💾 ${L('Save timeline','حفظ الجدول الزمني')}</button></div>`
   :`<div class="tl-sum" style="margin:0"><span>${L('Version','الإصدار')}: <b>${esc(tl.version)}</b></span><span>${esc(lang==='ar'?tl.titleAr:tl.titleEn)}</span></div>`}</div>`;
  const phases=tl.phases.map((ph,pi)=>`<div class="card tl-phase"><div class="tl-ph-hd"><span class="ph-badge">${pi+1}</span><div style="flex:1"><b>${esc(lang==='ar'?(ph.nameAr||ph.nameEn):(ph.nameEn||ph.nameAr))||L('Phase','مرحلة')+' '+(pi+1)}</b><div class="small muted">${esc(lang==='ar'?ph.nameEn:ph.nameAr)}</div></div>
     ${ed?`<button class="btn mini" onclick="phaseForm(${pi})">✎ ${L('Edit','تعديل')}</button><button class="btn mini" onclick="if(leadDraft.timeline.phases[${pi}].items.length&&!window._cfm${pi}){window._cfm${pi}=1;toast(L('Click again to delete the phase and its items','اضغط مرة أخرى لحذف المرحلة وبنودها'));return}leadDraft.timeline.phases.splice(${pi},1);render()">🗑</button>`:''}</div>
    ${ph.items.length?ph.items.map((it,ii)=>{const r=itemRow(it.id);return `<div class="tl-item"><span class="opp">${esc(it.opp)}</span><div style="flex:1;min-width:0"><b>${esc(r.name||L('(unnamed item)','(بند بلا اسم)'))}</b>
       <div class="small muted">${fmtD(r.startD)} → ${fmtD(r.end)} · ${r.dur} ${L('weeks','أسابيع')} · ${L('starts week','يبدأ الأسبوع')} ${r.sw}${it.startMode==='after'&&itemRow(it.after)?` (${L('after','بعد')} ${esc(itemRow(it.after).code)})`:''}</div>
       <div class="mini-bar">${it.durs.map((d,di)=>`<i style="flex:${Math.max(+d,0.0001)};background:#${STAGE_COL[di]}" title="${L(STG_NAMES[di][0],STG_NAMES[di][1])}: ${d}"></i>`).join('')}</div></div>
       <div class="tl-tags">${it.products.map(id=>{const p=PRODUCTS.find(x=>x.id===id);return p?`<span class="pchip" style="--c:${p.color}">${esc(p.short)}</span>`:''}).join('')}<span class="pill ${it.type==='build'?'orange':'green'}">${it.type==='build'?L('New build','تطوير جديد'):L('Ready product','منتج جاهز')}</span></div>
       ${ed?`<button class="btn mini" onclick="itemForm(${pi},${ii})">✎</button><button class="btn mini" onclick="leadDraft.timeline.phases[${pi}].items.splice(${ii},1);render()">🗑</button>`:''}</div>`}).join('')
     :`<div class="small muted" style="padding:6px 0">${L('No items in this phase yet.','لا توجد بنود في هذه المرحلة بعد.')}</div>`}
    ${ed?`<button class="btn" style="margin-top:8px" onclick="itemForm(${pi})">＋ ${L('Add item','إضافة بند')}</button>`:''}</div>`).join('');
  const head=`<div class="tl-sum"><span>${L('Start','البداية')}: <b>${fmtD(startT)}</b></span><span>${L('Expected project end','نهاية المشروع المتوقعة')}: <b>${end?fmtD(end):'—'}</b></span><span>${L('Work week Sunday to Thursday','أسبوع العمل من الأحد إلى الخميس')}</span><span style="flex:1"></span>${rows.some(r=>r.kind==='item')?`<button class="btn green" onclick="dlTimeline()">⬇ ${L('Download Excel (AR + EN)','تنزيل Excel (عربي + إنجليزي)')}</button>`:''}</div>
   <div class="legend">${STG_NAMES.map((s,i)=>`<span><i style="background:#${STAGE_COL[i]}"></i>${L(s[0],s[1])}</span>`).join('')}</div>`;
  const gantt=rows.some(r=>r.kind==='item')?`<div class="gantt-wrap"><table class="gantt"><tr><th class="gl">${L('Item and stage','البند والمرحلة')}</th><th>${L('Start','البداية')}</th><th>${L('End','النهاية')}</th>${Array.from({length:weeks},(_,w)=>{const d=new Date(startT+7*w*864e5);return `<th class="wk">${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}</th>`}).join('')}</tr>
   ${rows.map(r=>{const col=r.kind==='stage'?'#'+STAGE_COL[r.stage]:r.kind==='item'?'#C9C0E3':'#9C1C69';
     const label=r.kind==='stage'?L(STG_NAMES[r.stage][0],STG_NAMES[r.stage][1]):r.kind==='item'?`<b>${esc(r.code)}</b> ${esc(r.name||'')}`:esc(r.name);
     return `<tr class="${r.kind}"><td class="gl">${label}</td><td class="dt">${r.dur?fmtD(r.startD):''}</td><td class="dt">${r.dur?fmtD(r.end):''}</td>${Array.from({length:weeks},(_,w)=>`<td class="wk">${w>=r.sw&&w<r.sw+r.dur?`<i style="background:${col}"></i>`:''}</td>`).join('')}</tr>`}).join('')}</table></div>
   <p class="small muted">${L('Durations are first estimates pending confirmation by the technical team and the client. Each item has five sequential SDLC stages, each starting when the previous one ends. For ready products, development means configuration and customisation; for new builds it means actual development.','المدد تقديرات أولية بانتظار تأكيد الفريق التقني والعميل. لكل بند خمس مراحل متتالية، تبدأ كل منها عند انتهاء السابقة. في المنتجات الجاهزة، مرحلة التطوير تعني الإعداد والتخصيص. وفي الحلول الجديدة تعني تطويراً فعلياً.')}</p>`:'';
  return settings+(tl.phases.length?`<div class="grid g2" style="margin-bottom:14px">${phases}</div>`:`<div class="empty" style="margin-bottom:14px">${L('No phases yet.','لا توجد مراحل بعد.')} ${ed?L('Add a phase, then add each item with the form.','أضف مرحلة، ثم أضف كل بند من خلال النموذج.'):''}</div>`)+head+gantt;
}
function phaseForm(pi){const ph=pi!=null?leadDraft.timeline.phases[pi]:{nameAr:'المرحلة '+['الأولى','الثانية','الثالثة','الرابعة','الخامسة'][leadDraft.timeline.phases.length]||'',nameEn:'Phase '+(leadDraft.timeline.phases.length+1)+': ',items:[]};
  window._ph={...ph};$('#mt').textContent=pi!=null?L('Edit phase','تعديل المرحلة'):L('Add phase','إضافة مرحلة');
  $('#mb').innerHTML=`<div class="field"><label>${L('Phase name (Arabic)','اسم المرحلة (عربي)')}</label><input class="txt" dir="rtl" value="${esc(_ph.nameAr||'')}" placeholder="المرحلة الأولى: الأساس" oninput="_ph.nameAr=this.value"></div>
   <div class="field"><label>${L('Phase name (English)','اسم المرحلة (إنجليزي)')}</label><input class="txt" dir="ltr" value="${esc(_ph.nameEn||'')}" placeholder="Phase 1: Foundation" oninput="_ph.nameEn=this.value"></div>
   <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" onclick="closeModal()">${L('Cancel','إلغاء')}</button><button class="btn primary" onclick="savePhase(${pi!=null?pi:'null'})">${L('Save phase','حفظ المرحلة')}</button></div>`;$('#modal').classList.add('show');}
function savePhase(pi){const tl=leadDraft.timeline;if(pi==null)tl.phases.push({id:'P'+Date.now().toString(36),nameAr:_ph.nameAr,nameEn:_ph.nameEn,items:[]});else{tl.phases[pi].nameAr=_ph.nameAr;tl.phases[pi].nameEn=_ph.nameEn}closeModal();render()}
function itemForm(pi,ii){const tl=leadDraft.timeline,all=tl.phases.flatMap(p=>p.items),nextOpp='Opp'+(new Set(all.map(i=>i.opp)).size+1);
  const it=ii!=null?JSON.parse(JSON.stringify(tl.phases[pi].items[ii])):{id:'I'+Date.now().toString(36),opp:nextOpp,nameAr:'',nameEn:'',products:[],type:'ready',startMode:all.length?'after':'week',after:all.length?all[all.length-1].id:'',week:0,durs:[1,1,2,1,1],notes:''};
  window._it=it;window._itPos=[pi,ii];$('#mt').textContent=ii!=null?L('Edit item','تعديل البند'):L('Add item','إضافة بند');
  const others=all.filter(x=>x.id!==it.id), opps=[...new Set(all.map(i=>i.opp))];
  $('#mb').innerHTML=`<div class="itf">
   <div class="grid g2" style="gap:12px"><div class="field"><label>${L('Phase','المرحلة')}</label><select class="txt" onchange="_itPos[2]=+this.value">${tl.phases.map((p,i)=>`<option value="${i}" ${i===pi?'selected':''}>${esc(lang==='ar'?(p.nameAr||p.nameEn):(p.nameEn||p.nameAr))}</option>`).join('')}</select></div>
    <div class="field"><label>${L('Opportunity code','رمز الفرصة')}</label><input class="txt" list="oppList" dir="ltr" value="${esc(it.opp)}" oninput="_it.opp=this.value"><datalist id="oppList">${opps.map(o=>`<option value="${esc(o)}">`).join('')}</datalist><small class="muted">${L('Items under the same opportunity share a code, e.g. Opp1.','البنود التابعة للفرصة نفسها تشترك في الرمز، مثل Opp1.')}</small></div></div>
   <div class="grid g2" style="gap:12px"><div class="field"><label>${L('Item name (Arabic)','اسم البند (عربي)')} *</label><input class="txt" dir="rtl" value="${esc(it.nameAr)}" placeholder="تفعيل قياس في إدارة الموارد البشرية" oninput="_it.nameAr=this.value"></div>
    <div class="field"><label>${L('Item name (English)','اسم البند (إنجليزي)')} *</label><input class="txt" dir="ltr" value="${esc(it.nameEn)}" placeholder="Qiyas activation in the HR department" oninput="_it.nameEn=this.value"></div></div>
   <div class="field"><label>${L('Products in this item','المنتجات في هذا البند')}</label><div class="chips">${PRODUCTS.map(p=>`<label class="chip ${it.products.includes(p.id)?'on':''}" style="--c:${p.color}"><input type="checkbox" ${it.products.includes(p.id)?'checked':''} onchange="itProd('${p.id}',this)">${esc(p.short)}</label>`).join('')}</div></div>
   <div class="field"><label>${L('Type of work','نوع العمل')}</label><div class="seg"><label class="${it.type==='ready'?'on':''}"><input type="radio" name="ty" ${it.type==='ready'?'checked':''} onchange="_it.type='ready';segOn(this)">${L('Ready product — configuration and customisation','منتج جاهز — إعداد وتخصيص')}</label><label class="${it.type==='build'?'on':''}"><input type="radio" name="ty" ${it.type==='build'?'checked':''} onchange="_it.type='build';segOn(this)">${L('New build — actual development','تطوير جديد — تطوير فعلي')}</label></div></div>
   <div class="field"><label>${L('When does it start?','متى يبدأ؟')}</label><div class="startopt">
     <label><input type="radio" name="sm" ${it.startMode!=='after'?'checked':''} onchange="_it.startMode='week';itPrev()"> ${L('In week','في الأسبوع')} <input class="txt num" type="number" min="0" value="${it.week}" oninput="_it.week=+this.value;_it.startMode='week';this.closest('.startopt').querySelectorAll('input[name=sm]')[0].checked=true;itPrev()"> <span class="muted small">${L('(0 = project start week)','(0 = أسبوع بداية المشروع)')}</span></label>
     ${others.length?`<label><input type="radio" name="sm" ${it.startMode==='after'?'checked':''} onchange="_it.startMode='after';itPrev()"> ${L('Right after','مباشرة بعد انتهاء')} <select class="txt" style="width:auto;max-width:340px" onchange="_it.after=this.value;_it.startMode='after';this.closest('.startopt').querySelectorAll('input[name=sm]')[1].checked=true;itPrev()">${others.map(o=>`<option value="${o.id}" ${it.after===o.id?'selected':''}>${esc(o.opp)} — ${esc(lang==='ar'?(o.nameAr||o.nameEn):(o.nameEn||o.nameAr))}</option>`).join('')}</select></label>`:''}</div></div>
   <div class="field"><label>${L('Duration of each stage (weeks)','مدة كل مرحلة (بالأسابيع)')}</label><div class="durs">${STG_NAMES.map((s,i)=>`<div><span class="sdot" style="background:#${STAGE_COL[i]}"></span><small>${L(s[0],s[1])}</small><input class="txt num" type="number" min="0" step="1" value="${it.durs[i]}" oninput="_it.durs[${i}]=+this.value;itPrev()"></div>`).join('')}</div></div>
   <div class="itprev" id="itPrev"></div>
   <div class="field"><label>${L('Notes (optional)','ملاحظات (اختياري)')}</label><textarea class="txt" rows="2" oninput="_it.notes=this.value">${esc(it.notes)}</textarea></div>
   <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" onclick="closeModal()">${L('Cancel','إلغاء')}</button><button class="btn primary" onclick="saveItem()">${L('Save item','حفظ البند')}</button></div></div>`;
  $('#modal').classList.add('show');itPrev();}
function segOn(el){el.closest('.seg').querySelectorAll('label').forEach(l=>l.classList.toggle('on',l.contains(el)))}
function itProd(id,el){const a=_it.products,i=a.indexOf(id);el.checked?(i<0&&a.push(id)):(i>=0&&a.splice(i,1));el.parentElement.classList.toggle('on',el.checked);
  if(el.checked&&!_it.nameEn&&!_it.nameAr){const p=PRODUCTS.find(x=>x.id===id);const ins=document.querySelectorAll('.itf input[dir]');_it.nameEn=p.name+' implementation';_it.nameAr='تفعيل '+p.name;ins[1].value=_it.nameAr;ins[2].value=_it.nameEn}}
function itPrev(){const tl=JSON.parse(JSON.stringify(leadDraft.timeline)),[pi,ii]=_itPos;const ph=tl.phases[pi];if(ii!=null)ph.items[ii]=_it;else ph.items.push(_it);
  const r=timelineRows(tl).find(x=>x.kind==='item'&&x.id===_it.id);const e=document.getElementById('itPrev');if(!e||!r)return;
  e.innerHTML=`📅 ${L('Starts','يبدأ')} <b>${fmtD(r.startD)}</b> (${L('week','الأسبوع')} ${r.sw}) · ${L('ends','وينتهي')} <b>${fmtD(r.end)}</b> · ${L('total','الإجمالي')} <b>${r.dur}</b> ${L('weeks','أسابيع')}`}
function saveItem(){const it=_it;if(!it.nameAr.trim()&&!it.nameEn.trim()){toast(L('Enter the item name (Arabic or English).','أدخل اسم البند (عربي أو إنجليزي).'));return}
  if(!it.opp.trim())it.opp='Opp1';const tl=leadDraft.timeline,[pi,ii,np]=_itPos,dest=np!=null?np:pi;
  if(ii!=null)tl.phases[pi].items.splice(ii,1,...(dest===pi?[it]:[]));if(ii==null||dest!==pi)tl.phases[dest].items.push(it);
  closeModal();if(isNew())render();else commitLead(L('Item saved','تم حفظ البند'));}
function tlFromProducts(){const l=leadDraft;if(!l.products.length){toast(L('Select products first (Products tab).','اختر المنتجات أولاً (تبويب المنتجات).'));return}
  const core=l.products.filter(id=>id!=='orbit'), other=l.products.filter(id=>id==='orbit');let n=0,prev=null;
  const mk=(ids,offset)=>ids.map((id,i)=>{n++;const p=PRODUCTS.find(x=>x.id===id),it={id:'I'+Date.now().toString(36)+n,opp:'Opp'+n,nameAr:'تفعيل '+p.name,nameEn:p.name+' implementation',products:[id],type:'ready',startMode:'week',week:offset+i,durs:[1,1,2,1,1],notes:''};return it});
  l.timeline.phases=[{id:'P1',nameAr:'المرحلة الأولى',nameEn:'Phase 1',items:mk(core.length?core:other,0)}];
  if(core.length&&other.length)l.timeline.phases.push({id:'P2',nameAr:'المرحلة الثانية',nameEn:'Phase 2',items:mk(other,8)});
  render();toast(L('Draft created — edit each item with ✎, then save.','تم إنشاء مسودة — عدّل كل بند بزر ✎ ثم احفظ.'));}
function saveBlob(name,blob){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(u);a.remove()},1500)}
const dl={save:async({filename,data})=>saveBlob(filename,data)};
async function dlTimeline(){const l=leadDraft;const blob=buildTimelineXlsx(l);
  const name=`IIH_Delivery_Timeline_${(l.org||'client').replace(/[^\w؀-ۿ]+/g,'_')}.xlsx`;
  if(!dl){toast(L('Downloads are not available in this view.','التنزيل غير متاح في هذا العرض.'));return}
  try{await dl.save({filename:name,data:blob})}catch(e){if(e&&e.code!=='declined')toast(L('Download failed.','تعذّر التنزيل.'))}}

/* ---- Scope & Vision (IIH template) ---- */
const SC_LISTS=[['drivers','2. Background — drivers','2. الخلفية — الدوافع'],['problems','3. Problem definition','3. تعريف المشكلة'],['value','6. Expected business value','6. القيمة المتوقعة للأعمال'],['inScope','7.1 In scope','7.1 ضمن النطاق'],['outScope','7.2 Out of scope','7.2 خارج النطاق'],['assumptions','13. Assumptions','13. الافتراضات'],['constraints','14. Constraints','14. القيود']];
const SC_TABLES={objectives:[['o','Objective','الهدف'],['d','Description','الوصف']],stakeholders:[['n','Stakeholder','صاحب المصلحة'],['r','Role','الدور'],['i','Influence','مستوى التأثير']],users:[['u','User category','فئة المستخدم'],['t','Tasks','المهام'],['n','Main need','الاحتياج الرئيسي']],ai:[['a','Agent / capability','الوكيل / القدرة'],['m','Mission','المهمة'],['f','Function and outputs','الوظيفة والمخرجات']],kpis:[['i','Indicator','المؤشر'],['d','Definition','التعريف'],['b','Baseline','خط الأساس'],['t','Target','المستهدف'],['f','Frequency','الدورية']],risks:[['r','Risk','الخطر'],['o','Owner','المسؤول'],['i','Impact','الأثر'],['p','Probability','الاحتمالية'],['m','Mitigation','إجراء التخفيف']],next:[['m','Milestone','المحطة'],['o','Owner','المسؤول'],['d','Target date','التاريخ المستهدف']]};
const SC_TNAMES={objectives:['5. Strategic objectives','5. الأهداف الاستراتيجية'],stakeholders:['8. Stakeholders','8. أصحاب المصلحة'],users:['9. Target users','9. المستخدمون المستهدفون'],ai:['10. Expected AI capabilities','10. قدرات الذكاء الاصطناعي المتوقعة'],kpis:['12. Success measurement indicators','12. مؤشرات قياس النجاح'],risks:['15. Risks','15. المخاطر'],next:['16. Next steps','16. الخطوات التالية']};
const dmy=d=>{const x=d?new Date(d+'T00:00:00'):new Date();return `${String(x.getDate()).padStart(2,'0')}-${String(x.getMonth()+1).padStart(2,'0')}-${x.getFullYear()}`};
function prefillScope(l,lang){const A=lang==='ar', prods=l.products.map(id=>PRODUCTS.find(p=>p.id===id)).filter(Boolean);
  const S=l.scope||{}; const keep=(k,v)=>S[k]&&(Array.isArray(S[k])?S[k].length:String(S[k]).trim())?S[k]:v;
  return {lang, client:keep('client',l.org), dept:keep('dept',l.dept), solution:keep('solution',prods.map(p=>p.name).join(', ')), version:keep('version','0.1'), date:keep('date',dmy()), classification:keep('classification',A?'سري، للاستخدام الداخلي':'Confidential, for internal use'), preparedBy:keep('preparedBy',l.owner),
   exec:keep('exec',''), background:keep('background',''), vision:keep('vision',''), overview:keep('overview',''),
   drivers:keep('drivers',[]), problems:keep('problems',[]), value:keep('value',A?['الكفاءة: ','الجودة: ','دعم القرار: ','الخدمة: ']:['Efficiency: ','Quality: ','Decision support: ','Service: ']), inScope:keep('inScope',prods.map(p=>p.name+(A?' — ':' — ')+(A?(PROD_AR[p.id]||{}).cat||p.cat:p.cat))), outScope:keep('outScope',[]), assumptions:keep('assumptions',[]), constraints:keep('constraints',[]),
   objectives:keep('objectives',[]), stakeholders:keep('stakeholders',l.contacts.map(c=>({n:c.name+(c.position?(A?'، ':', ')+c.position:''),r:c.primary?(A?'مالك الأعمال والمعتمد':'Business owner and approver'):'',i:c.primary?(A?'عالٍ':'High'):(A?'متوسط':'Medium')}))),
   users:keep('users',[]), ai:keep('ai',prods.map(p=>({a:p.name,m:A?(PROD_AR[p.id]||{}).tagline||p.tagline:p.tagline,f:''}))), kpis:keep('kpis',[]), risks:keep('risks',[]),
   next:keep('next',(A?[['اعتماد وثيقة النطاق والرؤية','مالك الحل'],['جلسات جمع المتطلبات مع كل إدارة','محلل الأعمال'],['تسليم وثيقة المتطلبات واعتمادها','محلل الأعمال / مالك الحل'],['تصميم الحل','فريق التنفيذ'],['التطوير والاختبار والإطلاق','فريق التنفيذ']]:[['Scope and Vision sign-off','Solution owner'],['Requirements sessions with each department','Business analyst'],['BRD submission and approval','Business analyst / solution owner'],['Solution design','Implementation team'],['Build, testing and go-live','Implementation team']]).map(([m,o])=>({m,o,d:''})))}}
function lScope(l,ed){
  if(!l.scope)return `<div class="card" style="text-align:center;padding:30px"><img src="assets/iih.png" alt="IIH" style="height:44px;margin-bottom:10px"><h3>${L('Scope and Vision document','وثيقة النطاق والرؤية')}</h3><p class="muted" style="max-width:620px;margin:6px auto 16px">${L('The first document after discovery. It fixes what the solution covers before any BRD work starts. We pre-fill it from this lead (client, department, products, contacts) using the IIH template; the sales team completes the rest and downloads it as Word to share with the client.','أول وثيقة بعد مرحلة الاكتشاف، وتثبّت ما يغطيه الحل قبل البدء في وثيقة متطلبات الأعمال. نعبئها مبدئياً من بيانات هذه الفرصة (العميل والإدارة والمنتجات وجهات الاتصال) باستخدام قالب IIH، ويكمل فريق المبيعات الباقي ثم ينزّلها بصيغة Word لمشاركتها مع العميل.')}</p>
   ${ed?`<button class="btn primary" onclick="leadDraft.scope=prefillScope(leadDraft,'en');render()">${L('Start in English','ابدأ بالإنجليزية')}</button> <button class="btn primary" onclick="leadDraft.scope=prefillScope(leadDraft,'ar');render()">${L('Start in Arabic','ابدأ بالعربية')}</button>`:''}</div>`;
  const S=l.scope, A=S.lang==='ar', dirA=A?'rtl':'ltr';
  const inp=(k,lab,area)=>`<div class="field"><label>${lab}</label>${ed?(area?`<textarea class="txt" dir="${dirA}" rows="${area}" oninput="leadDraft.scope.${k}=this.value">${esc(S[k]||'')}</textarea>`:`<input class="txt" dir="${dirA}" value="${esc(S[k]||'')}" oninput="leadDraft.scope.${k}=this.value">`):`<div class="ro" dir="${dirA}">${esc(S[k]||'—')}</div>`}</div>`;
  const list=([k,en,ar])=>`<div class="sc-blk"><h4>${A?ar:en}</h4>${(S[k]||[]).map((v,i)=>ed?`<div class="li"><span>•</span><input class="txt" dir="${dirA}" value="${esc(v)}" oninput="leadDraft.scope.${k}[${i}]=this.value"><button class="btn mini" onclick="leadDraft.scope.${k}.splice(${i},1);render()">✕</button></div>`:`<div class="li ro" dir="${dirA}">• ${esc(v)}</div>`).join('')}${ed?`<button class="btn mini" onclick="leadDraft.scope.${k}.push('');render()">＋ ${L('Add line','إضافة سطر')}</button>`:''}</div>`;
  const table=k=>{const cols=SC_TABLES[k];return `<div class="sc-blk"><h4>${A?SC_TNAMES[k][1]:SC_TNAMES[k][0]}</h4><table class="sc-t" dir="${dirA}"><tr>${cols.map(c=>`<th>${A?c[2]:c[1]}</th>`).join('')}${ed?'<th></th>':''}</tr>${(S[k]||[]).map((row,i)=>`<tr>${cols.map(c=>`<td>${ed?`<input class="txt" value="${esc(row[c[0]]||'')}" oninput="leadDraft.scope.${k}[${i}].${c[0]}=this.value">`:esc(row[c[0]]||'')}</td>`).join('')}${ed?`<td><button class="btn mini" onclick="leadDraft.scope.${k}.splice(${i},1);render()">✕</button></td>`:''}</tr>`).join('')}</table>${ed?`<button class="btn mini" onclick="leadDraft.scope.${k}.push({});render()">＋ ${L('Add row','إضافة صف')}</button>`:''}</div>`};
  return `<div class="card sc-bar"><img src="assets/iih.png" alt="IIH" style="height:30px"><div style="flex:1"><b>${L('Scope and Vision document','وثيقة النطاق والرؤية')}</b> · <span class="muted small">${L('Document language','لغة الوثيقة')}: ${A?'العربية':'English'}</span></div>
   ${ed?`<button class="btn" onclick="leadDraft.scope.lang=leadDraft.scope.lang==='ar'?'en':'ar';render()">⇄ ${A?L('Switch to English template','التحويل إلى القالب الإنجليزي'):L('Switch to Arabic template','التحويل إلى القالب العربي')}</button><button class="btn" onclick="leadDraft.scope=prefillScope({...leadDraft,scope:{...leadDraft.scope,client:'',dept:'',solution:'',stakeholders:[],ai:[],inScope:[],preparedBy:''}},leadDraft.scope.lang);render();toast(L('Refreshed from lead details','تم التحديث من بيانات الفرصة'))">↻ ${L('Refresh from lead','تحديث من بيانات الفرصة')}</button><button class="btn primary" onclick="commitLead(L('Scope saved','تم حفظ النطاق'))">💾 ${L('Save','حفظ')}</button>`:''}
   <button class="btn green" onclick="dlScope()">⬇ ${L('Download Word','تنزيل Word')}</button></div>
  <div class="grid g2 sc" dir="${dirA}"><div class="card"><h4>${A?'ضبط الوثيقة':'Document control'}</h4>${inp('client',A?'الجهة':'Client')}${inp('dept',A?'الإدارة / القطاع':'Department / sector')}${inp('solution',A?'اسم الحل':'Solution name')}
    <div class="grid g2" style="gap:10px">${inp('version',A?'الإصدار':'Version')}${inp('date',A?'التاريخ':'Date')}</div>${inp('classification',A?'التصنيف':'Classification')}${inp('preparedBy',A?'المُعِد':'Prepared by')}</div>
   <div class="card">${inp('exec',A?'1. الملخص التنفيذي':'1. Executive summary',4)}${inp('background',A?'2. خلفية المبادرة':'2. Background of the initiative',3)}${inp('vision',A?'4. رؤية المبادرة':'4. Vision of the initiative',2)}${inp('overview',A?'11. التصور العام للحل':'11. High-level overview of the solution',3)}</div></div>
  <div class="grid g2 sc" dir="${dirA}"><div class="card">${SC_LISTS.slice(0,3).map(list).join('')}</div><div class="card">${SC_LISTS.slice(3).map(list).join('')}</div></div>
  <div class="card sc" dir="${dirA}">${Object.keys(SC_TABLES).map(table).join('')}</div>
  <p class="small muted">${L('The approvals table (solution owner, project manager, technology lead) is left blank in the Word file for signatures.','يُترك جدول الاعتمادات (مالك الحل، مدير المشروع، قائد التقنية) فارغاً في ملف Word للتوقيع.')}</p>`;
}
async function dlScope(){const l=leadDraft,S=l.scope;
  if(!dl){toast(L('Downloads are not available in this view.','التنزيل غير متاح في هذا العرض.'));return}
  toast(L('Preparing document…','جارٍ تجهيز الوثيقة…'));
  try{const blob=await buildScopeDocx(S,S.lang);const name=`IIH_Scope_Vision_${(l.org||'client').replace(/[^\w؀-ۿ]+/g,'_')}_${S.lang.toUpperCase()}.docx`;await dl.save({filename:name,data:blob})}
  catch(e){if(!e||e.code!=='declined')toast(L('Download failed.','تعذّر التنزيل.'))}}

/* ---- Meeting prep pack (built from the lead's products) ---- */
const KW={hr:['hr','human','chro','people','talent','recruit','موارد','بشرية','توظيف','استقطاب','مواهب'],it:['cio','cto','it ','technology','digital','ciso','security','تقنية','رقمي','أمن'],proc:['procure','purchas','contract','مشتريات','عقود'],exec:['ceo','secretary','general manager','gm','owner','president','minister','deputy','وكيل','مدير عام','رئيس','أمين'],fin:['cfo','finance','financial','مالية','مالي'],strat:['strategy','pmo','transformation','planning','استراتيج','تخطيط','تحول'],ops:['operation','عمليات','تشغيل'],data:['data','بيانات'],cx:['customer','experience','beneficiar','عملاء','تجربة','مستفيد'],mgr:['manager','head','director','lead','مدير','رئيس قسم']};
const kwOf=t=>{t=' '+String(t||'').toLowerCase()+' ';return Object.keys(KW).filter(k=>KW[k].some(w=>/^[a-z ]+$/.test(w)?new RegExp('(^|[^a-z])'+w.trim()).test(t):t.includes(w)))};
const GOALS={new:['Qualify interest and book a discovery meeting','تأهيل الاهتمام وحجز اجتماع استكشاف'],contacted:['Book a discovery meeting with the right people','حجز اجتماع استكشاف مع الأشخاص المناسبين'],discovery:['Confirm the pain, the decision maker, budget and timeline','تأكيد المشكلة وصاحب القرار والميزانية والتوقيت'],demo:['Show the 3 benefits that match their pains and agree the next step','عرض 3 فوائد تطابق مشكلاتهم والاتفاق على الخطوة التالية'],scope:['Agree the Scope & Vision document and the delivery timeline','الاتفاق على وثيقة النطاق والرؤية والجدول الزمني'],proposal:['Walk through the proposal and handle objections','استعراض العرض والتعامل مع الاعتراضات'],negotiation:['Close open terms and agree the signature date','إغلاق البنود المفتوحة والاتفاق على موعد التوقيع'],won:['Kick-off and handover to delivery','بدء المشروع والتسليم لفريق التنفيذ'],lost:['Learn why and keep the relationship','فهم السبب والحفاظ على العلاقة']};
function lPrep(l){
  const prods=l.products.map(id=>PRODUCTS.find(p=>p.id===id)).filter(Boolean);
  if(!prods.length)return `<div class="empty">${L('Select the products this client needs (Products tab) and the meeting prep pack builds itself.','اختر المنتجات التي يحتاجها العميل (تبويب المنتجات) وسيُنشأ ملف تحضير الاجتماع تلقائياً.')}</div>`;
  const g=GOALS[l.stage]||GOALS.new;
  const people=l.contacts.map(c=>{const k=kwOf(c.position+' '+c.name);const m=[];prods.forEach(p=>p.personas.forEach(ps=>{const pk=kwOf(ps.r);if(k.length&&pk.some(x=>k.includes(x)&&x!=='mgr'))m.push({p,ps})}));return {c,m:m.slice(0,3)}});
  const checks=[[!!l.contacts.find(c=>c.primary),L('Main contact identified','تحديد جهة الاتصال الرئيسية')],[l.contacts.some(c=>kwOf(c.position).includes('exec')),L('Decision maker among the contacts','صاحب القرار ضمن جهات الاتصال')],[leadVal(l)>0,L('Deal value estimated','تقدير قيمة الصفقة')],[!!l.closeDate,L('Expected close date set','تحديد تاريخ الإغلاق المتوقع')],[!!(l.nextStep&&l.nextDate),L('Next step and date agreed','الاتفاق على الخطوة التالية وتاريخها')],[!!l.scope,L('Scope & Vision started','بدء وثيقة النطاق والرؤية')],[(l.timeline&&l.timeline.phases||[]).some(p=>p.items&&p.items.length),L('Delivery timeline drafted','إعداد الجدول الزمني المبدئي')]];
  return `<div class="card prep-hd"><div style="flex:1"><div class="pc-cat">${L('Meeting prep pack','ملف تحضير الاجتماع')} · ${stageName(l.stage)}</div><h2 style="margin:4px 0">${L('Goal of the next meeting','هدف الاجتماع القادم')}: ${L(g[0],g[1])}</h2>
   <div class="muted small">${L('Built automatically from this lead\'s products and contacts. Detailed product content is in English.','يُنشأ تلقائياً من منتجات الفرصة وجهات الاتصال. المحتوى التفصيلي للمنتجات باللغة الإنجليزية.')}</div></div>
   <button class="btn primary" onclick="copyText(prepText(),L('Brief copied — paste it into an e-mail or notes','تم نسخ الملخص — الصقه في بريد أو ملاحظات'))">⎘ ${L('Copy brief','نسخ الملخص')}</button></div>
  <div class="grid g2" style="margin-bottom:14px"><div class="card"><h3 class="h3s">👥 ${L('Who is in the room','من سيحضر')}</h3>
   ${people.length?people.map(({c,m})=>`<div class="pp"><div class="avatar2">${esc((c.name||'?').trim().slice(0,1))}</div><div style="flex:1"><b>${esc(c.name)}</b> <span class="muted small">${esc(c.position||'')}</span>${c.primary?` <span class="pill green">${L('Main','رئيسي')}</span>`:''}
     ${m.length?m.map(({p,ps})=>`<div class="small" style="margin-top:4px"><span class="pchip" style="--c:${p.color}">${esc(p.short)}</span> <b>${esc(ps.r)}</b> — ${L('cares about','يهتم بـ')}: ${esc(ps.c)}. <i>${L('Show','اعرض')}: ${esc(ps.s)}</i></div>`).join(''):`<div class="small muted" style="margin-top:4px">${L('No buyer profile matched this position — ask what they care about.','لم يطابق المنصب أي شخصية — اسأل عمّا يهمه.')}</div>`}</div></div>`).join(''):`<div class="small muted">${L('No contacts yet — add them on the Contacts tab.','لا توجد جهات اتصال — أضفها من تبويب جهات الاتصال.')}</div>`}</div>
   <div class="card"><h3 class="h3s">✅ ${L('Before you go','قبل الاجتماع')}</h3>${checks.map(([ok,t])=>`<div class="ck-row ${ok?'ok':''}"><span>${ok?'✓':'○'}</span>${t}</div>`).join('')}</div></div>
  ${prods.map(p=>`<details class="acc prep-p" open><summary><span class="pchip" style="--c:${p.color}">${esc(p.short)}</span> ${esc(p.name)}</summary><div class="body">
    ${p.notYet?`<div class="note-warn">⚠ ${esc(PT(p,'notYet'))}</div>`:''}
    <div class="label">${L('30-second pitch','العرض المختصر')}</div><div class="pitch" style="font-size:16px">${esc(PT(p,'pitch'))}</div>
    <div class="grid g2" style="gap:16px">
     <div><div class="label">${L('Discovery questions','أسئلة الاستكشاف')}</div>${p.pains.length?p.pains.map(x=>`<label class="q"><input type="checkbox"><div><b>${esc(x.q)}</b><small>${L('Uncovers','يكشف')}: ${esc(x.p)}</small></div></label>`).join(''):`<div class="small muted">—</div>`}</div>
     <div><div class="label">${L('Benefits to lead with','الفوائد التي تبدأ بها')}</div>${p.features.slice(0,5).map(f=>`<div class="ben"><b>${esc(f.b)}</b><div class="small muted">${esc(f.f)}</div></div>`).join('')}
      ${p.obj.length?`<div class="label">${L('Objections to expect','اعتراضات متوقعة')}</div>${p.obj.slice(0,4).map(o=>`<div class="ben"><b>${esc(o.o)}</b><div class="small">${esc(o.r)}</div></div>`).join('')}`:''}</div></div>
    ${p.demoScript.length?`<div class="label">${L('Demo click-path','سيناريو العرض')}</div><ol class="small" style="margin:4px 0;padding-inline-start:20px">${p.demoScript.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>`:''}
    <a class="small" href="javascript:go('product','${p.id}')">${L('Open the full product kit →','افتح ملف المنتج كاملاً ←')}</a></div></details>`).join('')}`;
}
function prepText(){const l=leadDraft,prods=l.products.map(id=>PRODUCTS.find(p=>p.id===id)).filter(Boolean),g=GOALS[l.stage]||GOALS.new;
  let t=`MEETING PREP — ${l.org}\nStage: ${stg(l.stage).en} · Goal: ${g[0]}\n`;
  if(l.contacts.length)t+=`\nWHO IS IN THE ROOM\n`+l.contacts.map(c=>`- ${c.name}${c.position?', '+c.position:''}`).join('\n')+'\n';
  prods.forEach(p=>{t+=`\n=== ${p.name} ===\n${p.notYet?'NOTE: '+p.notYet+'\n':''}Pitch: ${p.pitch}\n\nDiscovery questions:\n`+p.pains.map((x,i)=>`${i+1}. ${x.q}`).join('\n')+`\n\nBenefits to lead with:\n`+p.features.slice(0,5).map(f=>`- ${f.b} (${f.f})`).join('\n');
    if(p.obj.length)t+=`\n\nObjections to expect:\n`+p.obj.slice(0,4).map(o=>`- ${o.o} → ${o.r}`).join('\n');t+='\n'});
  return t;}
