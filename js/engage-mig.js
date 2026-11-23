/* ===== v4 migration: existing leads (and any v3 engagements) → client account + engagement =====
   Rules this file follows:
   - The lead document is never written. Commercial fields stay only in the lead.
   - Every historical date is copied as recorded. No date is invented, regenerated or replaced by today.
   - Missing values stay empty and are listed in the impact assessment.
   - Record IDs are preserved: engagement id = lead id, account id = 'A' + lead id.
   - Backup → dry run → explicit approval → run → validation → rollback by batch. */
const isStageNote=a=>/^(Stage changed|تغيّرت المرحلة)/.test((a&&a.text)||'');
const MIG_ACCT=l=>'A'+l.id;
function migPlanLead(l,batch,at){
  const acts=(l.activities||[]),keep=acts.filter(a=>!isStageNote(a)),notes=acts.filter(isStageNote);
  const acc={...accBlank(),id:MIG_ACCT(l),name:l.org||'',sector:l.sector||'',dept:l.dept||'',city:l.city||'',website:l.website||'',am:{name:l.owner||'',uid:''},leadId:l.id,
    stakeholders:(l.contacts||[]).map(c=>({name:c.name||'',org:l.org||'',role:c.position||'',dept:'',email:c.email||'',mobile:c.mobile||'',engagementIds:[l.id],relOwner:'',commPref:'',notes:c.notes||'',primary:!!c.primary,source:{lead:l.id}})),
    createdAt:l.createdAt||'',createdBy:'',importedAt:at,importedBy:myName(),migrationBatch:batch};
  const st=LEAD_TO_STAGE[l.stage]||'intake';
  const eng={...engBlank(),id:l.id,code:'ENG-'+String(l.id).slice(-6).toUpperCase(),accountId:acc.id,name:(l.products||[]).length?(l.products||[]).map(p=>typeof pName==='function'?pName(p):p).join(' + '):(l.org||''),
    products:(l.products||[]).slice(),am:{name:l.owner||'',uid:''},leadId:l.id,stage:st,
    outcome:l.stage==='lost'?'closed':'active',
    stageLog:[{stage:st,enteredAt:'',owner:'',checks:{},note:L('Mapped from lead stage','مُطابق من مرحلة الفرصة')+' "'+l.stage+'" — '+L('entry date not recorded','لم يُسجّل تاريخ الدخول')}],
    stageHistory:[],
    activities:keep.map((a,i)=>({id:'M'+l.id+'-'+i,code:'',title:String(a.text||'').replace(/^\[[^\]]*\]\s*/,'').split('\n')[0].slice(0,90),type:OLD_ACT[a.type]||'other',origType:a.type||'',d:a.d||'',time:'',status:'done',organizer:'',intP:'',extP:'',objectives:'',summary:a.text||'',decisions:'',requests:'',commitments:'',nextSteps:'',nextMeeting:'',links:'',by:'',source:{lead:l.id,index:acts.indexOf(a)},importedAt:at,importedBy:myName()})),
    legacyStageNotes:notes.map(a=>({d:a.d||'',text:a.text||'',source:{lead:l.id,index:acts.indexOf(a)}})),
    createdAt:l.createdAt||'',createdBy:'',importedAt:at,importedBy:myName(),migrationBatch:batch};
  const gaps=[];if(!l.createdAt)gaps.push(L('lead has no creation date (left empty)','لا يوجد تاريخ إنشاء للفرصة (تُرك فارغاً)'));keep.concat(notes).forEach(a=>{if(!a.d)gaps.push(L('an activity has no date (left empty)','نشاط بلا تاريخ (تُرك فارغاً)'))});if(!l.org)gaps.push(L('no organisation name','لا يوجد اسم جهة'));
  return {lead:l,acc,eng,gaps};
}
/* v3 engagements stored the client on the engagement itself; give them an account without touching their history */
function migPlanV3(e,batch,at){const acc={...accBlank(),id:'A'+e.id,name:e.org||e.name||'',sector:e.sector||'',dept:e.dept||'',city:e.city||'',am:{name:e.accountManager||'',uid:''},leadId:e.leadId||'',stakeholders:(e.contacts||[]).map(c=>({...c,role:c.role||c.position||'',engagementIds:[e.id]})),createdAt:e.createdAt||'',importedAt:at,importedBy:myName(),migrationBatch:batch};
  const n=clone(e);n.accountId=acc.id;if(!n.name)n.name=(n.products||[]).join(' + ')||acc.name;n.v3Stage=e.opsStage||'';return {acc,eng:n,gaps:[]}}
function migTodo(){const leads=typeof LEADS!=='undefined'?LEADS.filter(l=>!ENG[l.id]&&!ACC[MIG_ACCT(l)]):[];const v3=Object.values(ENG).filter(e=>!e.accountId);return {leads,v3}}
function migrationPanel(){if(realRole!=='leadership')return '';const {leads,v3}=migTodo(),batches=[...new Set([...Object.values(ACC),...Object.values(ENG)].map(x=>x.migrationBatch).filter(Boolean))];
  if(!leads.length&&!v3.length&&!batches.length)return '';const S=window._mig||(window._mig={});
  return `<div class="card" style="border-top:4px solid #6B009D;margin-bottom:16px"><h3 class="h3s">⇄ ${L('Move existing records to client accounts and engagements','نقل السجلات الحالية إلى حسابات العملاء والارتباطات')}</h3>
   ${leads.length||v3.length?`<p class="small">${leads.length} ${L('lead(s)','فرصة')}${v3.length?` + ${v3.length} ${L('earlier engagement(s)','ارتباط سابق')}`:''} ${L('need a client account and engagement. The leads are not changed. Every activity keeps its original date and text; "Stage changed" entries are kept word for word as sales stage history. Nothing is filled in where a date is missing.','تحتاج إلى حساب عميل وارتباط. لا تتغير الفرص. يحتفظ كل نشاط بتاريخه ونصه الأصليين؛ وتُحفظ قيود "تغيّرت المرحلة" حرفياً كسجل مراحل البيع. لا يُملأ أي تاريخ مفقود.')}</p>
   <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button class="btn ${S.bk?'':'primary'}" onclick="migBackup()">⬇ 1. ${L('Download backup','تنزيل نسخة احتياطية')}${S.bk?' ✓':''}</button><button class="btn ${S.bk&&!S.dry?'primary':''}" onclick="migDry()">👁 2. ${L('Dry run (impact assessment)','تجربة (تقييم الأثر)')}${S.dry?' ✓':''}</button>
    <label class="small"><input type="checkbox" id="migOk" ${S.ok?'checked':''} onchange="window._mig.ok=this.checked"> 3. ${L('I approve running this migration on the live database','أوافق على تنفيذ هذا الترحيل على قاعدة البيانات الفعلية')}</label><button class="btn ${S.dry?'primary':''}" onclick="migRun()">▶ 4. ${L('Run','تنفيذ')}</button></div>`:''}
   <div id="migOut" class="small" style="margin-top:10px">${S.out||''}</div>
   ${batches.length?`<p class="small muted" style="margin-bottom:0">${L('Validate or undo a batch (undo removes only the records it created, and refuses if anything was added to them since):','التحقق من دفعة أو التراجع عنها (يحذف التراجع فقط ما أنشأته، ويُرفض إن أُضيف إليها شيء):')} ${batches.map(b=>`<button class="btn sm" onclick="migValidate('${b}')">✓ ${esc(b)}</button> <button class="btn sm" onclick="migRollback('${b}')">↶</button>`).join(' ')}</p>`:''}</div>`}
function migBackup(){const {leads,v3}=migTodo(),man={leads:leads.map(l=>({id:l.id,org:l.org,stage:l.stage,createdAt:l.createdAt||'',activities:(l.activities||[]).length,activityDates:(l.activities||[]).map(a=>a.d||''),contacts:(l.contacts||[]).length})),v3:v3.map(e=>({id:e.id,activities:(e.activities||[]).length,activityDates:(e.activities||[]).map(a=>a.d||'')}))};
  window._migSnap=JSON.stringify(LEADS);
  saveBlob(`IIH_hub_backup_${todayStr()}.json`,new Blob([JSON.stringify({exported:nowIso(),by:ME.email,version:HUB_VERSION,manifest:man,leads:LEADS,accounts:Object.values(ACC).map(clone),engagements:Object.values(ENG).map(clone),actions:ACTIONS,risks:RISKS,requirements:REQS,decisions:DECS},null,1)],{type:'application/json'}));
  window._mig.bk=true;toast(L('Backup downloaded — keep this file','تم تنزيل النسخة الاحتياطية — احتفظ بالملف'));render()}
function migDry(){if(!window._mig.bk)return toast(L('Download the backup first.','نزّل النسخة الاحتياطية أولاً.'));const {leads,v3}=migTodo(),at=nowIso();
  const P=[...leads.map(l=>migPlanLead(l,'dry',at)),...v3.map(e=>migPlanV3(e,'dry',at))];
  const tot=P.reduce((s,p)=>(s.a+=p.eng.activities.length,s.n+=(p.eng.legacyStageNotes||[]).length,s.c+=p.acc.stakeholders.length,s),{a:0,n:0,c:0});
  window._mig.out=`<b>${L('Impact assessment — nothing has been saved','تقييم الأثر — لم يُحفظ شيء')}</b><p>${L('Will create','سيُنشئ')} ${P.length} ${L('accounts and','حساباً و')} ${P.length} ${L('engagements','ارتباطاً')}; ${tot.a} ${L('activities copied with original dates','نشاطاً تُنسخ بتواريخها الأصلية')}; ${tot.n} ${L('stage-change notes kept as history','قيد تغيير مرحلة يُحفظ كسجل')}; ${tot.c} ${L('contacts become stakeholders','جهة اتصال تصبح أصحاب علاقة')}. ${L('Leads changed','الفرص المتغيرة')}: 0.</p>
   <table class="users"><tr><th>${L('Client','العميل')}</th><th>${L('Stage','المرحلة')}</th><th>${L('Activities','الأنشطة')}</th><th>${L('Date range','نطاق التواريخ')}</th><th>${L('Notes','ملاحظات')}</th></tr>${P.map(p=>{const ds=p.eng.activities.map(a=>a.d).concat((p.eng.legacyStageNotes||[]).map(n=>n.d)).filter(Boolean).sort();
    return `<tr><td><b>${esc(p.acc.name)}</b><div class="muted">${esc(p.eng.id)}</div></td><td>${p.lead?esc(p.lead.stage)+' → ':''}${stageLabel(p.eng.stage)}${p.eng.outcome!=='active'?' · '+L(...OUTCOMES[p.eng.outcome].slice(0,2)):''}</td><td>${p.eng.activities.length} + ${(p.eng.legacyStageNotes||[]).length} ${L('stage notes','قيود مرحلة')}</td><td>${ds.length?esc(ds[0])+' → '+esc(ds.at(-1)):'—'}</td><td>${p.gaps.length?'⚠ '+[...new Set(p.gaps)].map(esc).join('; '):'✓'}</td></tr>`}).join('')}</table>`;
  window._mig.dry=true;render()}
async function migRun(){const S=window._mig;if(!S.bk||!S.dry)return toast(L('Download the backup and run the dry run first.','نزّل النسخة الاحتياطية ونفّذ التجربة أولاً.'));if(!S.ok)return toast(L('Tick the approval box first.','حدّد مربع الموافقة أولاً.'));
  const batch='M'+todayStr().replace(/-/g,'')+'-'+Math.random().toString(36).slice(2,6),at=nowIso(),{leads,v3}=migTodo(),P=[...leads.map(l=>migPlanLead(l,batch,at)),...v3.map(e=>migPlanV3(e,batch,at))];let ok=0,fail=[];
  for(const p of P){try{const a=p.acc,e=p.eng;
      await DB.collection('accounts').doc(a.id).set({name:a.name||'—',json:JSON.stringify((({id,_top,...r})=>r)(a)),pmUid:'',amUid:'',leadId:a.leadId||'',migrationBatch:batch,createdAt:a.createdAt||'',updatedAt:at,updatedBy:ME.id});
      await DB.collection('engagements').doc(e.id).set({accountId:a.id,name:e.name||'',stage:e.stage||'intake',pmUid:e.pm&&e.pm.uid||'',amUid:'',json:JSON.stringify((({id,_top,...r})=>r)(e)),leadId:e.leadId||'',migrationBatch:batch,createdAt:e.createdAt||'',updatedAt:at,updatedBy:ME.id});
      audit('migration',e.id,L('Created from lead by migration','أُنشئ من الفرصة بالترحيل')+' '+batch,[],{accountId:a.id,engagementId:e.id});ok++}catch(err){fail.push((p.acc.name||p.eng.id)+': '+err.message)}}
  S.ok=false;S.out=`✅ ${ok}/${P.length} ${L('migrated','تم ترحيلها')} · ${L('batch','الدفعة')} <b>${batch}</b>${fail.length?`<div class="note-warn">⚠ ${fail.map(esc).join('<br>')}</div>`:''}<div id="migVal"></div>`;render();await migValidate(batch,P)}
/* re-read what was written and compare it with the source — counts, dates, texts, and the lead itself */
async function migValidate(batch,plan){const rows=[];let bad=0;const snap=window._migSnap?JSON.parse(window._migSnap):null;
  const es=(await DB.collection('engagements').where('migrationBatch','==',batch).get()).docs;
  for(const d of es){const e=JSON.parse(d.data().json||'{}'),id=d.id,chk=[];let l=null;
    if(e.leadId){const ld=await DB.collection('leads').doc(e.leadId).get().catch(()=>null);l=ld&&ld.exists?JSON.parse(ld.data().json||'{}'):null}
    const acc=await DB.collection('accounts').doc(d.data().accountId).get();chk.push([L('account exists','الحساب موجود'),acc.exists]);
    if(l){const src=(l.activities||[]),keep=src.filter(a=>!isStageNote(a)),notes=src.filter(isStageNote),ea=(e.activities||[]).filter(a=>a.source&&a.source.lead);
      chk.push([L('activity count','عدد الأنشطة'),ea.length===keep.length]);chk.push([L('activity dates identical','تطابق تواريخ الأنشطة'),JSON.stringify(ea.map(a=>a.d))===JSON.stringify(keep.map(a=>a.d||''))]);chk.push([L('activity texts identical','تطابق نصوص الأنشطة'),ea.every((a,i)=>a.summary===(keep[i].text||''))]);
      chk.push([L('stage history kept','حفظ سجل المراحل'),JSON.stringify((e.legacyStageNotes||[]).map(n=>[n.d,n.text]))===JSON.stringify(notes.map(a=>[a.d||'',a.text||'']))]);
      chk.push([L('contacts kept','حفظ جهات الاتصال'),acc.exists&&(JSON.parse(acc.data().json||'{}').stakeholders||[]).filter(s=>s.source&&s.source.lead===e.leadId).length===(l.contacts||[]).length]);
      chk.push([L('creation date kept','حفظ تاريخ الإنشاء'),(e.createdAt||'')===(l.createdAt||'')]);
      const before=snap&&snap.find(x=>x.id===l.id);if(before)chk.push([L('lead unchanged','الفرصة لم تتغير'),JSON.stringify(before)===JSON.stringify({...l,id:l.id})||JSON.stringify((({id,...r})=>r)(before))===JSON.stringify((({id,...r})=>r)(l))])}
    const f=chk.filter(c=>!c[1]);bad+=f.length;rows.push(`<tr><td>${esc(e.name||id)}<div class="muted">${esc(id)}</div></td><td>${f.length?'⚠ '+f.map(c=>esc(c[0])).join(', '):'✓ '+chk.length+' '+L('checks passed','فحص ناجح')}</td></tr>`)}
  const h=`<b>${L('Validation of batch','التحقق من الدفعة')} ${esc(batch)}:</b> ${bad?`<span class="late">⚠ ${bad} ${L('check(s) failed — use the backup file and undo the batch','فحص فشل — استخدم النسخة الاحتياطية وتراجع عن الدفعة')}</span>`:`✅ ${L('all records match their source','كل السجلات تطابق مصدرها')}`}<table class="users">${rows.join('')}</table>`;
  const o=document.getElementById('migVal')||document.getElementById('migOut');if(o)o.innerHTML=h;window._mig.out=(window._mig.out||'').replace(/<div id="migVal">[\s\S]*$/,'')+`<div id="migVal">${h}</div>`;return bad}
async function migRollback(b){const es=Object.values(ENG).filter(e=>e.migrationBatch===b),as=Object.values(ACC).filter(a=>a.migrationBatch===b);
  const dep=es.filter(e=>engActions(e.id).length||engRisks(e.id).length||engReqs(e.id).length||engDecs(e.id).length||(e.activities||[]).some(a=>!a.source)||(e.stageHistory||[]).length);
  if(dep.length)return toast(L('Not undone: records were added to these engagements since the migration — ','لم يتم التراجع: أُضيفت سجلات إلى هذه الارتباطات منذ الترحيل — ')+dep.map(e=>e.name||e.id).join(', '));
  if(!confirmDel('mig'+b))return;let n=0;for(const e of es){try{if(e.v3Stage!==undefined)continue;await DB.collection('engagements').doc(e.id).delete();delete ENG[e.id];n++}catch(err){}}
  for(const a of as){try{await DB.collection('accounts').doc(a.id).delete();delete ACC[a.id];n++}catch(err){}}
  audit('migration',b,L('Migration batch undone','التراجع عن دفعة الترحيل'),[],{});toast(`↶ ${n} ${L('record(s) removed; the leads were never changed','سجل حُذف؛ ولم تتغير الفرص أبداً')}`);render()}

/* keep the client identity in step when sales edit a lead; give brand-new leads an account and engagement */
async function syncEngFromLead(l){if(!['leadership','lead'].includes(realRole)||engState!=='live')return;try{
  const e=ENG[l.id],aid=e?e.accountId:MIG_ACCT(l);
  if(!e){/* older leads are left for the validated migration; only a lead created in the last day is set up here */if(!l.createdAt||Date.now()-Date.parse(l.createdAt)>864e5)return;
    const p=migPlanLead(l,null,nowIso());delete p.acc.migrationBatch;delete p.eng.migrationBatch;p.acc.createdAt=p.acc.createdAt||nowIso();p.eng.createdAt=p.eng.createdAt||nowIso();p.acc.createdBy=p.eng.createdBy=ME.id;
    if(!ACC[aid])await saveAcc(p.acc);await saveEng(p.eng);audit('engagement',l.id,L('Created with the lead','أُنشئ مع الفرصة'),[],{accountId:aid,engagementId:l.id});return}
  const a=ACC[aid];if(!a)return;const n=clone(a);let ch=[];[['org','name'],['dept','dept'],['sector','sector'],['city','city'],['website','website']].forEach(([lk,ak])=>{if((l[lk]||'')&&(l[lk]||'')!==(n[ak]||'')){ch.push([ak,n[ak],l[lk]]);n[ak]=l[lk]}});
  if(ch.length){await saveAcc(n);audit('account',aid,L('Client details synced from the lead','مزامنة بيانات العميل من الفرصة'),ch,{accountId:aid})}
  const pr=[...new Set([...(e.products||[]),...(l.products||[])])];if(pr.length!==(e.products||[]).length){const m=clone(e);m.products=pr;await saveEng(m)}
}catch(err){console.warn('engagement sync',err)}}
