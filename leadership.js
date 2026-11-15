/* ============ LEADERSHIP VIEW (Leadership role only) ============
   Live summary of leads, progress and recent updates, plus a ready-to-send update e-mail and a PowerPoint progress deck.
   Everything is calculated in the browser from the leads Leadership can already read; nothing new is stored in the database.
   The narrative fields (key message, decisions needed) are kept only on this device. */
let execPeriod=14;
const EXEC_NOTE_KEY='hub-exec-notes';
function execNotes(){try{return JSON.parse(localStorage.getItem(EXEC_NOTE_KEY)||'{}')}catch(e){return {}}}
function setExecNote(k,v){const n=execNotes();n[k]=v;try{localStorage.setItem(EXEC_NOTE_KEY,JSON.stringify(n))}catch(e){}}
const dAdd=(days)=>{const d=new Date(Date.now()+days*864e5);return new Date(d.getTime()-d.getTimezoneOffset()*6e4).toISOString().slice(0,10)};
const fmtDate=s=>{if(!s)return '';const d=new Date(String(s).slice(0,10)+'T12:00:00');return d.toLocaleDateString(lang==='ar'?'ar-SA-u-ca-gregory-nu-latn':'en-GB',{day:'numeric',month:'short',year:'numeric'})};
const isOpen=l=>!['won','lost'].includes(l.stage);
const pName=id=>{const p=PRODUCTS.find(x=>x.id===id);return p?p.name:id};
const ACT_ICON={call:'📞',meeting:'👥',email:'✉',demo:'▶',note:'📝'};

/* ---- one place that computes every number used by the page, the e-mail and the deck ---- */
function execData(){
  const today=todayStr(), since=dAdd(-execPeriod), soon=dAdd(14), staleDate=dAdd(-14);
  const open=LEADS.filter(isOpen), won=LEADS.filter(l=>l.stage==='won'), lost=LEADS.filter(l=>l.stage==='lost');
  const sum=(a,f)=>a.reduce((s,l)=>s+f(l),0);
  const closeDate=l=>(l.outcome&&l.outcome.date)||l.closeDate||String(l.updatedAt||'').slice(0,10);
  const wonP=won.filter(l=>closeDate(l)>=since), lostP=lost.filter(l=>closeDate(l)>=since);
  const newP=LEADS.filter(l=>String(l.createdAt||'').slice(0,10)>=since);
  const decided=won.length+lost.length;
  const stages=STAGES.map(s=>{const a=LEADS.filter(l=>l.stage===s.id);return {id:s.id,name:stageName(s.id),c:s.c,n:a.length,v:sum(a,leadVal)}});
  const products=PRODUCTS.map(p=>{const a=open.filter(l=>(l.products||[]).includes(p.id));return {id:p.id,name:p.name,short:p.short||p.name,c:p.color||'#6B009D',n:a.length,v:sum(a,leadVal),won:won.filter(l=>(l.products||[]).includes(p.id)).length}}).filter(x=>x.n||x.won);
  const owners=[...new Set(open.map(l=>(l.owner||'').trim()||L('Unassigned','غير مسند')))].map(o=>{const a=open.filter(l=>((l.owner||'').trim()||L('Unassigned','غير مسند'))===o);return {o,n:a.length,v:sum(a,leadVal),late:a.filter(l=>l.nextDate&&l.nextDate<today).length}}).sort((a,b)=>b.v-a.v||b.n-a.n);
  const top=open.slice().sort((a,b)=>leadVal(b)*leadProb(b)-leadVal(a)*leadProb(a)||leadVal(b)-leadVal(a)).slice(0,6);
  const updates=[];LEADS.forEach(l=>(l.activities||[]).forEach(a=>{if(a.d&&a.d>=since)updates.push({d:a.d,org:l.org,id:l.id,type:a.type,text:a.text})}));
  updates.sort((a,b)=>b.d.localeCompare(a.d));
  const overdue=open.filter(l=>l.nextDate&&l.nextDate<today).sort((a,b)=>a.nextDate.localeCompare(b.nextDate));
  const noNext=open.filter(l=>!l.nextStep&&!l.nextDate);
  const stale=open.filter(l=>String(l.updatedAt||l.createdAt||'').slice(0,10)<staleDate);
  const upcoming=open.filter(l=>l.nextDate&&l.nextDate>=today&&l.nextDate<=soon).sort((a,b)=>a.nextDate.localeCompare(b.nextDate));
  const closing=open.filter(l=>l.closeDate&&l.closeDate>=today&&l.closeDate<=dAdd(60)).sort((a,b)=>a.closeDate.localeCompare(b.closeDate));
  return {today,since,open,won,lost,wonP,lostP,newP,stages,products,owners,top,updates,overdue,noNext,stale,upcoming,closing,
    pipe:sum(open,leadVal),wtd:sum(open,l=>leadVal(l)*leadProb(l)/100),wonV:sum(won,leadVal),wonPV:sum(wonP,leadVal),
    winRate:decided?Math.round(won.length/decided*100):null,total:LEADS.length};
}
const periodLabel=()=>L(`last ${execPeriod} days`,`آخر ${execPeriod} يوماً`);

/* ---- the page ---- */
function vExec(){
  if(role!=='leadership'||realRole!=='leadership')return `<div class="card" style="text-align:center;padding:40px"><div style="font-size:34px">🔒</div><h2>${L('Leadership only','للقيادة فقط')}</h2></div>`;
  if(dbState!=='live')return dbBanner();
  const D=execData(),N=execNotes();
  const kpi=(t,v,s,c)=>`<div class="card kpi-c" style="${c?`border-top:4px solid ${c}`:''}"><span class="muted small">${t}</span><b>${v}</b><span class="small muted">${s}</span></div>`;
  const maxN=Math.max(1,...D.stages.map(s=>s.n)), maxP=Math.max(1,...D.products.map(p=>p.n));
  const leadLink=l=>`<a class="lk" href="javascript:go('lead','${l.id}')">${esc(l.org||L('(no name)','(بدون اسم)'))}</a>`;
  const list=(arr,f,empty)=>arr.length?arr.map(f).join(''):`<div class="small muted">${empty}</div>`;
  return `<div class="page-hd"><div><span class="pill" style="background:#6B009D;color:#fff">★ ${L('Leadership','القيادة')}</span><h1 style="margin-top:6px">${L('Leadership summary','ملخص القيادة')}</h1>
    <p class="muted">${L('Where every lead stands, what moved and what needs attention. Visible to Leadership only.','أين تقف كل فرصة، وما الذي تحرك، وما الذي يحتاج إلى اهتمام. يظهر للقيادة فقط.')} · ${L('As of','حتى تاريخ')} ${fmtDate(D.today)}</p></div>
   <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
    <select class="txt" style="width:auto" onchange="execPeriod=+this.value;render()">${[7,14,30,90].map(n=>`<option value="${n}" ${n===execPeriod?'selected':''}>${L(`Last ${n} days`,`آخر ${n} يوماً`)}</option>`).join('')}</select>
    <button class="btn" onclick="execEmail()">✉ ${L('Update e-mail','بريد التحديث')}</button>
    <button class="btn primary" onclick="execDeck()">⬇ ${L('Progress deck (PowerPoint)','عرض التقدم (PowerPoint)')}</button></div></div>
  ${!D.total?`<div class="note-info">${L('No leads yet. The summary, e-mail and deck fill in automatically as the team adds leads.','لا توجد فرص بعد. يمتلئ الملخص والبريد والعرض تلقائياً عند إضافة الفريق للفرص.')}</div>`:''}
  <div class="grid g4" style="margin-bottom:14px">
   ${kpi(L('Open leads','الفرص المفتوحة'),D.open.length,`+${D.newP.length} ${L('new','جديدة')} · ${periodLabel()}`,'#6B009D')}
   ${kpi(L('Open pipeline','قيمة الفرص المفتوحة'),sar(D.pipe),`${L('Weighted','مرجّح')}: ${sar(D.wtd)}`,'#8E2DBA')}
   ${kpi(L('Won','تم الفوز'),sar(D.wonV),`${D.won.length} ${L('deals','صفقة')} · ${D.wonP.length} ${L('in period','خلال الفترة')}`,'#25A27F')}
   ${kpi(L('Win rate','نسبة الفوز'),D.winRate==null?'—':D.winRate+'%',`${D.won.length} ${L('won','فوز')} / ${D.lost.length} ${L('lost','خسارة')}`,'#C9A24B')}</div>
  <div class="grid g2" style="margin-bottom:14px">
   <div class="card"><h3 class="h3s">${L('Pipeline by stage','الفرص حسب المرحلة')}</h3>${D.stages.map(s=>`<div class="ob"><span style="min-width:150px">${esc(s.name)}</span><i style="width:${Math.round(s.n/maxN*200)}px;background:${s.c};min-width:${s.n?4:0}px"></i><b>${s.n}</b><span class="small muted" style="margin-inline-start:auto">${s.v?sar(s.v):''}</span></div>`).join('')}</div>
   <div class="card"><h3 class="h3s">${L('Demand by product (open leads)','الطلب حسب المنتج (الفرص المفتوحة)')}</h3>${list(D.products,p=>`<div class="ob"><span style="min-width:150px">${esc(p.name)}</span><i style="width:${Math.round(p.n/maxP*200)}px;background:${p.c};min-width:${p.n?4:0}px"></i><b>${p.n}</b><span class="small muted" style="margin-inline-start:auto">${p.v?sar(p.v):''}${p.won?` · 🏆 ${p.won}`:''}</span></div>`,L('No products linked to leads yet.','لا توجد منتجات مرتبطة بالفرص بعد.'))}</div></div>
  <div class="card" style="margin-bottom:14px;padding:0;overflow:auto"><h3 class="h3s" style="padding:16px 16px 0">${L('Top opportunities (by weighted value)','أهم الفرص (حسب القيمة المرجحة)')}</h3>
   ${D.top.length?`<table class="leads"><thead><tr><th>${L('Client','العميل')}</th><th>${L('Stage','المرحلة')}</th><th>${L('Products','المنتجات')}</th><th>${L('Value','القيمة')}</th><th>${L('Next step','الخطوة التالية')}</th><th>${L('Owner','المسؤول')}</th></tr></thead><tbody>${D.top.map(l=>`<tr onclick="go('lead','${l.id}')"><td><b class="lk">${esc(l.org||'')}</b></td><td><span class="spill" style="--c:${stg(l.stage).c}">${stageName(l.stage)}</span></td><td class="small">${(l.products||[]).map(pName).map(esc).join(', ')||'—'}</td><td>${leadVal(l)?`<b>${sar(leadVal(l))}</b> <span class="small muted">${leadProb(l)}%</span>`:'—'}</td><td class="small">${esc(l.nextStep||'—')}${l.nextDate?` <span class="${l.nextDate<D.today?'late':'muted'}">· ${esc(l.nextDate)}</span>`:''}</td><td class="small">${esc(l.owner||'—')}</td></tr>`).join('')}</tbody></table>`:`<div class="small muted" style="padding:0 16px 16px">${L('No open leads.','لا توجد فرص مفتوحة.')}</div>`}</div>
  <div class="grid g2" style="margin-bottom:14px">
   <div class="card"><h3 class="h3s">🔄 ${L('What moved','ما الذي تحرك')} · ${periodLabel()}</h3>
    <div class="small" style="margin-bottom:8px">${[[L('New leads','فرص جديدة'),D.newP],[L('Won','فوز'),D.wonP],[L('Lost','خسارة'),D.lostP]].map(([t,a])=>`<b>${t}: ${a.length}</b>${a.length?' — '+a.map(leadLink).join(', '):''}`).join('<br>')}</div>
    <div class="exec-feed">${list(D.updates.slice(0,15),u=>`<div class="fu-row" onclick="go('lead','${u.id}')"><span class="small muted" style="min-width:82px">${esc(u.d)}</span><span>${ACT_ICON[u.type]||'•'}</span><b>${esc(u.org||'')}</b><span class="muted small">— ${esc(u.text||'')}</span></div>`,L('No updates logged in this period.','لا توجد تحديثات مسجلة خلال هذه الفترة.'))}</div></div>
   <div class="card"><h3 class="h3s">⚠ ${L('Needs attention','يحتاج إلى اهتمام')}</h3>
    ${[[L('Overdue follow-ups','متابعات متأخرة'),D.overdue,l=>`${leadLink(l)} <span class="late small">${esc(l.nextDate)}</span> <span class="small muted">${esc(l.nextStep||'')} · ${esc(l.owner||'')}</span>`],
       [L('No update for 14+ days','دون تحديث لأكثر من 14 يوماً'),D.stale,l=>`${leadLink(l)} <span class="small muted">${esc(String(l.updatedAt||'').slice(0,10))} · ${esc(l.owner||'')}</span>`],
       [L('No next step set','لا توجد خطوة تالية'),D.noNext,l=>`${leadLink(l)} <span class="small muted">${esc(l.owner||'')}</span>`]]
      .map(([t,a,f])=>`<div style="margin-bottom:10px"><b class="small">${t} (${a.length})</b>${a.length?`<div class="small" style="margin-top:4px;line-height:1.9">${a.slice(0,8).map(f).join('<br>')}${a.length>8?`<br><span class="muted">+${a.length-8}</span>`:''}</div>`:`<div class="small muted">✓ ${L('None','لا يوجد')}</div>`}</div>`).join('')}</div></div>
  <div class="grid g2" style="margin-bottom:14px">
   <div class="card"><h3 class="h3s">📅 ${L('Coming up (next 14 days)','القادم (خلال 14 يوماً)')}</h3>${list(D.upcoming.slice(0,10),l=>`<div class="fu-row" onclick="go('lead','${l.id}')"><span class="small muted" style="min-width:82px">${esc(l.nextDate)}</span><b>${esc(l.org||'')}</b><span class="muted small">— ${esc(l.nextStep||'')}</span><span style="flex:1"></span><span class="small muted">${esc(l.owner||'')}</span></div>`,L('Nothing scheduled.','لا يوجد شيء مجدول.'))}</div>
   <div class="card"><h3 class="h3s">👤 ${L('By owner','حسب المسؤول')}</h3>${D.owners.length?`<table class="users"><tr><th>${L('Owner','المسؤول')}</th><th>${L('Open','مفتوحة')}</th><th>${L('Pipeline','القيمة')}</th><th>${L('Overdue','متأخرة')}</th></tr>${D.owners.map(o=>`<tr><td>${esc(o.o)}</td><td>${o.n}</td><td>${sar(o.v)}</td><td class="${o.late?'late':''}">${o.late}</td></tr>`).join('')}</table>`:`<div class="small muted">—</div>`}</div></div>
  <div class="card" style="border-top:4px solid #6B009D"><h3 class="h3s">✍ ${L('Your message for the e-mail and deck','رسالتك للبريد والعرض')}</h3><p class="small muted" style="margin-top:0">${L('Optional. Saved on this device only, and added to the update e-mail and the deck.','اختياري. يُحفظ على هذا الجهاز فقط، ويُضاف إلى بريد التحديث والعرض.')}</p>
   <div class="grid g2"><div class="field"><label>${L('Key message / highlights','الرسالة الرئيسية / أبرز النقاط')}</label><textarea class="txt" rows="4" oninput="setExecNote('msg',this.value)" placeholder="${L('e.g. Two demos completed this week; Ministry of Culture moved to proposal.','مثال: أنجزنا عرضين توضيحيين هذا الأسبوع؛ وانتقلت وزارة الثقافة إلى مرحلة العرض.')}">${esc(N.msg||'')}</textarea></div>
   <div class="field"><label>${L('Decisions or support needed from leadership','القرارات أو الدعم المطلوب من القيادة')}</label><textarea class="txt" rows="4" oninput="setExecNote('ask',this.value)" placeholder="${L('One per line','بند في كل سطر')}">${esc(N.ask||'')}</textarea></div></div></div>`;
}

/* ---- update e-mail ---- */
function execEmailParts(){
  const D=execData(),N=execNotes(),rtl=lang==='ar',al=rtl?'right':'left',hub=location.origin+location.pathname;
  const subject=L(`Presales progress update — ${fmtDate(D.today)}`,`تحديث تقدم ما قبل البيع — ${fmtDate(D.today)}`);
  const asks=(N.ask||'').split('\n').map(s=>s.trim()).filter(Boolean);
  const S='font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#1E1F31;';
  const h=t=>`<h3 style="${S}font-size:15px;color:#6B009D;margin:18px 0 6px">${t}</h3>`;
  const ul=a=>a.length?`<ul style="${S}margin:0;padding-${rtl?'right':'left'}:20px">${a.map(x=>`<li style="margin:3px 0">${x}</li>`).join('')}</ul>`:`<p style="${S}color:#6B6680;margin:0">${L('None','لا يوجد')}</p>`;
  const kp=[[L('Open leads','الفرص المفتوحة'),D.open.length],[L('Open pipeline','قيمة الفرص المفتوحة'),sar(D.pipe)],[L('Weighted forecast','التوقع المرجّح'),sar(D.wtd)],[L('Won to date','الفوز حتى الآن'),`${sar(D.wonV)} (${D.won.length})`],[L('Win rate','نسبة الفوز'),D.winRate==null?'—':D.winRate+'%']];
  const leadLine=l=>`<b>${esc(l.org||'')}</b> — ${esc(stageName(l.stage))}${leadVal(l)?`, ${sar(leadVal(l))}`:''}${l.nextStep?` · ${L('Next','التالي')}: ${esc(l.nextStep)}${l.nextDate?` (${esc(l.nextDate)})`:''}`:''}`;
  const moved=[...D.newP.map(l=>`🆕 ${L('New lead','فرصة جديدة')}: <b>${esc(l.org||'')}</b>${(l.products||[]).length?' ('+(l.products||[]).map(pName).map(esc).join(', ')+')':''}`),
    ...D.wonP.map(l=>`🏆 ${L('Won','فوز')}: <b>${esc(l.org||'')}</b>${leadVal(l)?' — '+sar(leadVal(l)):''}`),
    ...D.lostP.map(l=>`✕ ${L('Lost','خسارة')}: <b>${esc(l.org||'')}</b>${l.outcome&&l.outcome.competitor?' — '+L('to','أمام')+' '+esc(l.outcome.competitor):''}`)];
  const attn=[...D.overdue.map(l=>`${L('Overdue follow-up','متابعة متأخرة')}: <b>${esc(l.org||'')}</b> (${esc(l.nextDate)}, ${esc(l.owner||L('unassigned','غير مسند'))})`),
    ...D.stale.filter(l=>!D.overdue.includes(l)).map(l=>`${L('No update for 14+ days','دون تحديث لأكثر من 14 يوماً')}: <b>${esc(l.org||'')}</b>`)].slice(0,8);
  const html=`<div dir="${rtl?'rtl':'ltr'}" style="${S}text-align:${al};max-width:680px">
<p style="${S}">${L('Dear all,','السادة الكرام،')}</p>
<p style="${S}">${L(`Here is the presales progress as of ${fmtDate(D.today)}, covering the ${periodLabel()}.`,`فيما يلي تقدم أعمال ما قبل البيع حتى ${fmtDate(D.today)}، ويغطي ${periodLabel()}.`)}</p>
${N.msg?`<p style="${S}background:#F5EEF9;border-${rtl?'right':'left'}:4px solid #6B009D;padding:10px 12px">${esc(N.msg).replace(/\n/g,'<br>')}</p>`:''}
${h(L('Headline numbers','الأرقام الرئيسية'))}
<table cellpadding="8" cellspacing="0" style="border-collapse:collapse;${S}"><tr>${kp.map(([t,v])=>`<td style="border:1px solid #E3DFEE;text-align:center;min-width:100px"><div style="font-size:12px;color:#6B6680">${t}</div><div style="font-size:18px;font-weight:700;color:#6B009D">${v}</div></td>`).join('')}</tr></table>
${h(L('Pipeline by stage','الفرص حسب المرحلة'))}
<p style="${S}margin:0">${D.stages.filter(s=>s.n).map(s=>`${esc(s.name)}: <b>${s.n}</b>`).join(' · ')||L('No leads yet.','لا توجد فرص بعد.')}</p>
${D.products.length?`${h(L('Demand by product','الطلب حسب المنتج'))}<p style="${S}margin:0">${D.products.map(p=>`${esc(p.name)}: <b>${p.n}</b>`).join(' · ')}</p>`:''}
${h(L('What moved','ما الذي تحرك')+' · '+periodLabel())}${ul(moved)}
${h(L('Top opportunities','أهم الفرص'))}${ul(D.top.slice(0,5).map(leadLine))}
${h(L('Needs attention','يحتاج إلى اهتمام'))}${ul(attn)}
${asks.length?`${h(L('Decisions / support needed','القرارات / الدعم المطلوب'))}${ul(asks.map(esc))}`:''}
${h(L('Coming up (next 14 days)','القادم (خلال 14 يوماً)'))}${ul(D.upcoming.slice(0,6).map(l=>`${esc(l.nextDate)} — <b>${esc(l.org||'')}</b>: ${esc(l.nextStep||'')}`))}
<p style="${S}margin-top:18px">${L('Full details are in the Presales Hub','التفاصيل الكاملة في مركز ما قبل البيع')}: <a href="${hub}#exec">${hub}#exec</a></p>
<p style="${S}">${L('Best regards,','مع خالص التحية،')}<br>${esc(ME.name||ME.email)}</p></div>`;
  const tmp=document.createElement('div');tmp.innerHTML=html.replace(/<li[^>]*>/g,'<li>• ').replace(/<\/(p|h3|li|tr|ul)>/g,'$&\n').replace(/<td/g,' | <td');
  const text=tmp.innerText.replace(/\n{3,}/g,'\n\n').trim();
  return {subject,html,text};
}
let EXEC_TO=[];
async function execEmail(){
  try{const q=await DB.collection('users').where('role','==','leadership').get();EXEC_TO=q.docs.map(d=>d.data().email).filter(e=>e&&e!==ME.email)}catch(e){EXEC_TO=[]}
  const E=execEmailParts();
  $('#mt').textContent=L('Leadership update e-mail','بريد التحديث للقيادة');
  $('#mb').innerHTML=`<div class="field"><label>${L('To','إلى')}</label><input class="txt" id="exTo" dir="ltr" value="${esc(EXEC_TO.join('; '))}" placeholder="${L('Leadership e-mails, separated by ;','بريد القيادة، مفصول بـ ;')}"></div>
   <div class="field"><label>${L('Subject','الموضوع')}</label><input class="txt" id="exSub" value="${esc(E.subject)}"></div>
   <div class="field"><label>${L('Preview','معاينة')}</label><div style="border:1px solid #E3DFEE;border-radius:10px;padding:14px;max-height:46vh;overflow:auto;background:#fff">${E.html}</div></div>
   <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
    <button class="btn" onclick="execCopy()">⎘ ${L('Copy (formatted)','نسخ (منسق)')}</button>
    <button class="btn" onclick="execMailto()">✉ ${L('Open in mail app','فتح في تطبيق البريد')}</button>
    <button class="btn primary" onclick="execEml()">⬇ ${L('Download as Outlook draft (.eml)','تنزيل كمسودة Outlook (.eml)')}</button></div>
   <p class="small muted" style="margin-bottom:0">${L('Best result: download the .eml and open it — Outlook opens it as a ready draft with the formatting. "Copy" lets you paste the formatted text into any e-mail.','أفضل نتيجة: نزّل ملف .eml وافتحه — يفتحه Outlook كمسودة جاهزة بالتنسيق. "نسخ" يتيح لصق النص المنسق في أي بريد.')}</p>`;
  $('#modal').classList.add('show');
}
async function execCopy(){const E=execEmailParts();
  try{await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([E.html],{type:'text/html'}),'text/plain':new Blob([E.text],{type:'text/plain'})})]);toast(L('Copied — paste into your e-mail','تم النسخ — الصقه في بريدك'))}
  catch(e){copyText(E.text,L('Copied as plain text','تم النسخ كنص عادي'))}}
function execMailto(){const E=execEmailParts();const to=$('#exTo').value.replace(/\s*;\s*/g,',');let body=E.text;if(body.length>1800)body=body.slice(0,1800)+'\n…\n'+location.origin+location.pathname+'#exec';
  location.href=`mailto:${encodeURIComponent(to).replace(/%2C/g,',').replace(/%40/g,'@')}?subject=${encodeURIComponent($('#exSub').value)}&body=${encodeURIComponent(body)}`}
function execEml(){const E=execEmailParts();const b64=s=>btoa(unescape(encodeURIComponent(s)));const sub=$('#exSub').value;
  const to=$('#exTo').value.split(/[;,]/).map(s=>s.trim()).filter(Boolean).join(', ');
  const eml=[`To: ${to}`,`Subject: =?UTF-8?B?${b64(sub)}?=`,'X-Unsent: 1','MIME-Version: 1.0','Content-Type: text/html; charset=UTF-8','Content-Transfer-Encoding: base64','',
    b64(`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${E.html}</body></html>`).replace(/(.{76})/g,'$1\r\n')].join('\r\n');
  saveBlob(`Presales_update_${todayStr()}.eml`,new Blob([eml],{type:'message/rfc822'}));toast(L('Downloaded — open it to send from Outlook','تم التنزيل — افتحه للإرسال من Outlook'))}

/* ---- PowerPoint progress deck (pptxgenjs, loaded only when needed) — styled after iih.ai ---- */
function loadScript(src){return new Promise((ok,bad)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>bad(new Error('load '+src));document.head.appendChild(s)})}
async function imgData(u){const b=await (await fetch(u)).blob();return await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(b)})}
/* gradients are painted on a canvas because PowerPoint shapes from pptxgenjs only take flat colours */
function cvs(w,h,paint){const c=document.createElement('canvas');c.width=w;c.height=h;paint(c.getContext('2d'),w,h);return c.toDataURL('image/png')}
const gradStrip=(w=1200,h=24,rtl)=>cvs(w,h,(g,W,H)=>{const x=g.createLinearGradient(rtl?W:0,0,rtl?0:W,0);x.addColorStop(0,'#6B009D');x.addColorStop(1,'#B700A5');g.fillStyle=x;g.fillRect(0,0,W,H)});
const glowBg=()=>cvs(1600,900,(g,W,H)=>{g.fillStyle='#010113';g.fillRect(0,0,W,H);
  [[W*.86,H*.18,W*.42,'rgba(183,0,165,0.55)'],[W*.12,H*.95,W*.5,'rgba(107,0,157,0.65)'],[W*.55,H*.55,W*.35,'rgba(63,31,85,0.45)']].forEach(([x,y,r,c])=>{const rg=g.createRadialGradient(x,y,0,x,y,r);rg.addColorStop(0,c);rg.addColorStop(1,'rgba(1,1,19,0)');g.fillStyle=rg;g.fillRect(0,0,W,H)});
  g.strokeStyle='rgba(255,255,255,0.05)';g.lineWidth=1;for(let i=0;i<W;i+=64){g.beginPath();g.moveTo(i,0);g.lineTo(i,H);g.stroke()}for(let j=0;j<H;j+=64){g.beginPath();g.moveTo(0,j);g.lineTo(W,j);g.stroke()}});
async function execDeck(){
  toast(L('Building the deck…','جارٍ إعداد العرض…'));
  try{if(!window.PptxGenJS)await loadScript('js/vendor/pptxgen.bundle.js');
    const D=execData(),N=execNotes(),rtl=lang==='ar',F=rtl?'Arial':'Segoe UI',FB=rtl?'Arial':'Segoe UI Semibold',al=rtl?'right':'left';
    const V='6B009D',M='B700A5',NI='010113',PN='1E1F31',PL='3F1F55',GR='A2A2A2',MU='6E6A7C',LI='F5EEF9',W='FFFFFF',INK='1E1F31';
    const pptx=new PptxGenJS();pptx.layout='LAYOUT_WIDE';pptx.rtlMode=rtl;pptx.author=ME.name||ME.email;pptx.company='Ideal Innovation House';pptx.title=L('Presales progress update','تحديث تقدم ما قبل البيع');
    let logoW=null,logo=null;try{logoW=await imgData('assets/iih-white.png');logo=await imgData('assets/iih.png')}catch(e){}
    const BG=glowBg(),GS=gradStrip(1200,24,rtl),GV=cvs(24,600,(g,Wd,H)=>{const x=g.createLinearGradient(0,0,0,H);x.addColorStop(0,'#6B009D');x.addColorStop(1,'#B700A5');g.fillStyle=x;g.fillRect(0,0,Wd,H)});
    const T=(o)=>({fontFace:F,color:INK,rtlMode:rtl,align:al,...o});
    const rv=a=>rtl?a.slice().reverse():a, X=(x,w)=>rtl?13.33-x-w:x;   // mirror positions for Arabic
    let n=0,sec=0;
    const slide=(title,sub)=>{const s=pptx.addSlide();n++;sec++;s.background={color:W};
      s.addImage({data:GV,x:rtl?13.21:0,y:0,w:0.12,h:7.5});
      s.addText(String(sec).padStart(2,'0'),T({x:X(0.6,0.8),w:0.8,y:0.42,h:0.4,fontSize:13,bold:true,color:M}));
      s.addImage({data:GS,x:X(1.35,0.9),y:0.6,w:0.9,h:0.05});
      s.addText(title,T({x:X(0.6,10),y:0.82,w:10,h:0.62,fontSize:28,fontFace:FB,bold:true,color:INK}));
      if(sub)s.addText(sub,T({x:X(0.6,10),y:1.42,w:10,h:0.35,fontSize:12.5,color:MU}));
      if(logo)s.addImage({data:logo,x:X(11.45,1.3),y:0.45,w:1.3,h:0.52,sizing:{type:'contain',w:1.3,h:0.52}});
      s.addImage({data:GS,x:0.6,y:7.0,w:12.13,h:0.015});
      s.addText(`IIH · ${L('Presales progress update','تحديث تقدم ما قبل البيع')} · ${fmtDate(D.today)}`,T({x:X(0.6,8),y:7.05,w:8,h:0.3,fontSize:9,color:GR}));
      s.addText(String(n),{x:X(12.1,0.63),y:7.05,w:0.63,h:0.3,fontSize:9,bold:true,color:V,align:rtl?'left':'right',fontFace:F});return s};
    const empty=(s,t,y=2.0)=>s.addText(t,T({x:X(0.6,12),y,w:12,h:0.5,fontSize:14,color:MU,italic:true}));
    const tbl=(s,head,rows,opt={})=>{const o={x:0.6,y:2.0,w:12.13,...opt};o.x=X(o.x,o.w);if(o.colW)o.colW=rv(o.colW);
      s.addTable([rv(head).map(h=>({text:h,options:{bold:true,color:W,fill:{color:V},fontFace:F,fontSize:o.fs?o.fs+0.5:12,align:al,valign:'middle'}})),...rows.map((r,i)=>rv(r).map(c=>({text:String(c),options:{fontFace:F,fontSize:o.fs||11.5,color:INK,align:al,valign:'middle',fill:{color:i%2?LI:W}}})))],{border:{type:'solid',pt:0.5,color:'E7E1EE'},autoPage:false,rowH:o.rowH||0.38,...o})};
    const darkCard=(s,x,y,w,h,label,value,sub,accent)=>{s.addShape(pptx.ShapeType.roundRect,{x,y,w,h,fill:{color:PN},line:{color:PN},rectRadius:0.12});
      s.addImage({data:GS,x:x+0.25,y:y+0.25,w:0.6,h:0.05});
      s.addText(label,T({x:x+0.25,y:y+0.38,w:w-0.5,h:0.35,fontSize:11.5,color:GR}));
      s.addText(value,T({x:x+0.25,y:y+0.72,w:w-0.5,h:0.7,fontSize:30,bold:true,fontFace:FB,color:accent||W}));
      if(sub)s.addText(sub,T({x:x+0.25,y:y+h-0.5,w:w-0.5,h:0.35,fontSize:10.5,color:'CFC8DA'}))};
    const chartOpt={valAxisHidden:true,valGridLine:{style:'none'},catAxisLabelFontFace:F,catAxisLabelFontSize:11,catAxisLabelColor:INK,catAxisLineShow:false,showValue:true,dataLabelFontSize:11,dataLabelColor:INK,dataLabelFontFace:F,showLegend:false};

    // 1 Title
    let s=pptx.addSlide();n++;s.background={data:BG};
    if(logoW)s.addImage({data:logoW,x:X(0.8,2.4),y:0.7,w:2.4,h:0.95,sizing:{type:'contain',w:2.4,h:0.95}});
    s.addText(L('PRESALES','ما قبل البيع').toUpperCase(),T({x:X(0.8,9),y:2.55,w:9,h:0.4,fontSize:14,bold:true,color:'D36BDB',charSpacing:rtl?0:4}));
    s.addText(L('Progress update','تحديث التقدم'),T({x:X(0.8,11),y:2.95,w:11,h:1.1,fontSize:48,bold:true,fontFace:FB,color:W}));
    s.addImage({data:GS,x:X(0.8,1.6),y:4.15,w:1.6,h:0.07});
    s.addText(`${fmtDate(D.today)}  ·  ${periodLabel()}`,T({x:X(0.8,11),y:4.4,w:11,h:0.45,fontSize:18,color:'DCD6E6'}));
    s.addText(`${L('Prepared by','إعداد')}: ${ME.name||ME.email}`,T({x:X(0.8,11),y:6.5,w:11,h:0.4,fontSize:12,color:GR}));

    // 2 Executive summary
    s=slide(L('Executive summary','الملخص التنفيذي'),L(`Position as of ${fmtDate(D.today)}`,`الوضع حتى ${fmtDate(D.today)}`));
    const K=[[L('Open leads','الفرص المفتوحة'),String(D.open.length),`+${D.newP.length} ${L('new','جديدة')} · ${periodLabel()}`],[L('Open pipeline','قيمة الفرص المفتوحة'),sar(D.pipe),`${L('Weighted','مرجّح')}: ${sar(D.wtd)}`],[L('Won to date','الفوز حتى الآن'),sar(D.wonV),`${D.won.length} ${L('deals','صفقة')}`],[L('Win rate','نسبة الفوز'),D.winRate==null?'—':D.winRate+'%',`${D.won.length} ${L('won','فوز')} / ${D.lost.length} ${L('lost','خسارة')}`]];
    K.forEach(([t,v,sb],i)=>darkCard(s,X(0.6+(i%2)*3.15,3.0),2.0+Math.floor(i/2)*2.45,3.0,2.25,t,v,sb,i===2?'7FE0BE':W));
    s.addShape(pptx.ShapeType.roundRect,{x:X(7.1,5.63),y:2.0,w:5.63,h:4.7,fill:{color:LI},line:{color:LI},rectRadius:0.12});
    s.addText(L('Highlights','أبرز النقاط'),T({x:X(7.4,5),y:2.2,w:5,h:0.45,fontSize:16,bold:true,fontFace:FB,color:V}));
    const hl=[...(N.msg?N.msg.split('\n').filter(x=>x.trim()):[]),
      `${D.newP.length} ${L('new leads','فرص جديدة')}, ${D.wonP.length} ${L('won','فوز')}, ${D.lostP.length} ${L('lost','خسارة')} · ${periodLabel()}`,
      D.overdue.length?`${L('Overdue follow-ups','متابعات متأخرة')}: ${D.overdue.length}`:L('No overdue follow-ups','لا توجد متابعات متأخرة'),
      ...(D.top[0]?[`${L('Largest open opportunity','أكبر فرصة مفتوحة')}: ${D.top[0].org}${leadVal(D.top[0])?' ('+sar(leadVal(D.top[0]))+')':''}`]:[])];
    s.addText(hl.map(t=>({text:t,options:{bullet:{code:'25A0'},breakLine:true}})),T({x:X(7.4,5.1),y:2.7,w:5.1,h:3.8,fontSize:14,valign:'top',paraSpaceAfter:8}));

    // 3 Pipeline by stage
    s=slide(L('Pipeline by stage','الفرص حسب المرحلة'),L('Number of leads in each stage, with total value','عدد الفرص في كل مرحلة مع إجمالي القيمة'));
    if(D.total){const st=D.stages;s.addChart(pptx.ChartType.bar,[{name:L('Leads','الفرص'),labels:st.map(x=>x.name),values:st.map(x=>x.n)}],{x:X(0.6,7.3),y:1.95,w:7.3,h:4.9,barDir:'bar',barGapWidthPct:45,chartColors:st.map(x=>x.c.replace('#','')),catAxisOrientation:'maxMin',...chartOpt});
      tbl(s,[L('Stage','المرحلة'),L('Leads','الفرص'),L('Value','القيمة')],st.map(x=>[x.name,String(x.n),x.v?sar(x.v):'—']),{x:8.2,y:2.05,w:4.53,colW:[2.2,0.9,1.43],fs:10.5,rowH:0.32})}
    else empty(s,L('No leads yet.','لا توجد فرص بعد.'));

    // 4 Product demand
    s=slide(L('Demand by product','الطلب حسب المنتج'),L('Open leads that include each product','الفرص المفتوحة التي تتضمن كل منتج'));
    if(D.products.length){s.addChart(pptx.ChartType.bar,[{name:L('Open leads','الفرص المفتوحة'),labels:D.products.map(p=>p.name),values:D.products.map(p=>p.n)}],{x:X(0.6,7.3),y:1.95,w:7.3,h:4.9,barDir:'col',barGapWidthPct:55,chartColors:D.products.map((p,i)=>i%2?M:V),...chartOpt});
      tbl(s,[L('Product','المنتج'),L('Open','مفتوحة'),L('Value','القيمة'),L('Won','فوز')],D.products.map(p=>[p.name,String(p.n),p.v?sar(p.v):'—',String(p.won)]),{x:8.2,y:2.05,w:4.53,colW:[1.9,0.75,1.2,0.68],fs:10.5,rowH:0.32})}
    else empty(s,L('No products linked to leads yet.','لا توجد منتجات مرتبطة بالفرص بعد.'));

    // 5 Top opportunities
    s=slide(L('Top opportunities','أهم الفرص'),L('Open leads ranked by value × win probability','الفرص المفتوحة مرتبة حسب القيمة × احتمالية الفوز'));
    if(D.top.length)tbl(s,[L('Client','العميل'),L('Stage','المرحلة'),L('Products','المنتجات'),L('Value','القيمة'),L('Win %','احتمال الفوز'),L('Next step','الخطوة التالية'),L('Owner','المسؤول')],
      D.top.map(l=>[l.org||'',stageName(l.stage),(l.products||[]).map(pName).join(', ')||'—',leadVal(l)?sar(leadVal(l)):'—',leadProb(l)+'%',(l.nextStep||'—')+(l.nextDate?` (${l.nextDate})`:''),l.owner||'—']),{colW:[2.2,1.4,2.1,1.2,0.93,3.0,1.3],rowH:0.62});
    else empty(s,L('No open leads.','لا توجد فرص مفتوحة.'));

    // 6 What moved
    s=slide(L('What moved','ما الذي تحرك'),periodLabel());
    [[L('New leads','فرص جديدة'),D.newP,W],[L('Won','فوز'),D.wonP,'7FE0BE'],[L('Lost','خسارة'),D.lostP,'FF9AA2']].forEach(([t,a,c],i)=>darkCard(s,X(0.6+i*4.1,3.93),1.95,3.93,1.85,t,String(a.length),a.slice(0,3).map(l=>l.org||'').join(', ')||'—',c));
    if(D.updates.length)tbl(s,[L('Date','التاريخ'),L('Client','العميل'),L('Update','التحديث')],D.updates.slice(0,7).map(u=>[u.d,u.org||'',(u.text||'').slice(0,120)]),{y:4.0,colW:[1.4,2.6,8.13]});
    else empty(s,L('No updates logged in this period.','لا توجد تحديثات مسجلة خلال هذه الفترة.'),3.7);

    // 7 Attention and decisions
    s=slide(L('Needs attention & decisions','ما يحتاج إلى اهتمام وقرارات'),L('Where leadership support can unblock progress','حيث يمكن لدعم القيادة تسريع التقدم'));
    const att=[...D.overdue.map(l=>`${L('Overdue','متأخرة')}: ${l.org} — ${l.nextStep||''} (${l.nextDate}, ${l.owner||L('unassigned','غير مسند')})`),...D.stale.filter(l=>!D.overdue.includes(l)).map(l=>`${L('No update for 14+ days','دون تحديث لأكثر من 14 يوماً')}: ${l.org}`),...D.noNext.map(l=>`${L('No next step','لا توجد خطوة تالية')}: ${l.org}`)].slice(0,8);
    const asks=(N.ask||'').split('\n').map(x=>x.trim()).filter(Boolean);
    const box=(x,title,items,dark,emptyT)=>{x=X(x,5.98);s.addShape(pptx.ShapeType.roundRect,{x,y:1.95,w:5.98,h:4.85,fill:{color:dark?PN:LI},line:{color:dark?PN:LI},rectRadius:0.12});
      s.addImage({data:GS,x:x+0.3,y:2.2,w:0.7,h:0.05});
      s.addText(title,T({x:x+0.3,y:2.32,w:5.4,h:0.5,fontSize:17,bold:true,fontFace:FB,color:dark?W:V}));
      s.addText(items.length?items.map(t=>({text:t,options:{bullet:{code:'25A0'},breakLine:true}})):[{text:emptyT,options:{italic:true}}],T({x:x+0.3,y:2.9,w:5.4,h:3.7,fontSize:13,valign:'top',paraSpaceAfter:6,color:dark?'E6E1EE':INK}))};
    box(0.6,L('Needs attention','يحتاج إلى اهتمام'),att,false,L('Nothing overdue or stalled.','لا يوجد ما هو متأخر أو متوقف.'));
    box(6.75,L('Decisions / support needed','القرارات / الدعم المطلوب'),asks,true,L('No decisions requested this period.','لا توجد قرارات مطلوبة في هذه الفترة.'));

    // 8 Coming up
    s=slide(L('Coming up','القادم'),L('Next steps due in the next 14 days, and deals expected to close in 60 days','الخطوات المستحقة خلال 14 يوماً، والصفقات المتوقع إغلاقها خلال 60 يوماً'));
    if(D.upcoming.length||D.closing.length){
      if(D.upcoming.length)tbl(s,[L('Date','التاريخ'),L('Client','العميل'),L('Next step','الخطوة التالية'),L('Owner','المسؤول')],D.upcoming.slice(0,6).map(l=>[l.nextDate,l.org||'',l.nextStep||'',l.owner||'—']),{colW:[1.4,3.0,5.93,1.8]});
      if(D.closing.length){const y=D.upcoming.length?4.75:2.0;s.addText(L('Expected to close','المتوقع إغلاقها'),T({x:X(0.6,6),y:y-0.45,w:6,h:0.4,fontSize:14,bold:true,color:V}));
        tbl(s,[L('Expected close','الإغلاق المتوقع'),L('Client','العميل'),L('Stage','المرحلة'),L('Value','القيمة')],D.closing.slice(0,4).map(l=>[l.closeDate,l.org||'',stageName(l.stage),leadVal(l)?sar(leadVal(l)):'—']),{y,colW:[1.8,4.3,3.43,2.6]})}}
    else empty(s,L('Nothing scheduled.','لا يوجد شيء مجدول.'));

    // 9 Closing
    s=pptx.addSlide();n++;s.background={data:BG};
    if(logoW)s.addImage({data:logoW,x:(13.33-2.6)/2,y:2.0,w:2.6,h:1.05,sizing:{type:'contain',w:2.6,h:1.05}});
    s.addText(L('Thank you','شكراً لكم'),{x:0,y:3.35,w:13.33,h:0.9,fontSize:40,bold:true,fontFace:FB,color:W,align:'center'});
    s.addImage({data:GS,x:(13.33-1.6)/2,y:4.3,w:1.6,h:0.07});
    s.addText(L('Full details in the Presales Hub','التفاصيل الكاملة في مركز ما قبل البيع'),{x:0,y:4.55,w:13.33,h:0.4,fontSize:15,color:'DCD6E6',align:'center',fontFace:F});
    s.addText(location.origin+location.pathname,{x:0,y:4.95,w:13.33,h:0.4,fontSize:12,color:'D36BDB',align:'center',fontFace:F,hyperlink:{url:location.origin+location.pathname+'#exec'}});

    await pptx.writeFile({fileName:`IIH_Presales_Progress_${todayStr()}_${lang.toUpperCase()}.pptx`});
    toast(L('Deck downloaded','تم تنزيل العرض'));
  }catch(e){console.error(e);toast(L('Could not build the deck.','تعذّر إعداد العرض.')+' '+(e.message||''))}
}
