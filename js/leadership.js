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
  const products=PRODUCTS.map(p=>{const a=open.filter(l=>(l.products||[]).includes(p.id));return {id:p.id,name:p.name,short:p.short||p.name,c:p.color||'#3A1F80',n:a.length,v:sum(a,leadVal),won:won.filter(l=>(l.products||[]).includes(p.id)).length}}).filter(x=>x.n||x.won);
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
  return `<div class="page-hd"><div><span class="pill" style="background:#3A1F80;color:#fff">★ ${L('Leadership','القيادة')}</span><h1 style="margin-top:6px">${L('Leadership summary','ملخص القيادة')}</h1>
    <p class="muted">${L('Where every lead stands, what moved and what needs attention. Visible to Leadership only.','أين تقف كل فرصة، وما الذي تحرك، وما الذي يحتاج إلى اهتمام. يظهر للقيادة فقط.')} · ${L('As of','حتى تاريخ')} ${fmtDate(D.today)}</p></div>
   <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
    <select class="txt" style="width:auto" onchange="execPeriod=+this.value;render()">${[7,14,30,90].map(n=>`<option value="${n}" ${n===execPeriod?'selected':''}>${L(`Last ${n} days`,`آخر ${n} يوماً`)}</option>`).join('')}</select>
    <button class="btn" onclick="execEmail()">✉ ${L('Update e-mail','بريد التحديث')}</button>
    <button class="btn primary" onclick="execDeck()">⬇ ${L('Progress deck (PowerPoint)','عرض التقدم (PowerPoint)')}</button></div></div>
  ${!D.total?`<div class="note-info">${L('No leads yet. The summary, e-mail and deck fill in automatically as the team adds leads.','لا توجد فرص بعد. يمتلئ الملخص والبريد والعرض تلقائياً عند إضافة الفريق للفرص.')}</div>`:''}
  <div class="grid g4" style="margin-bottom:14px">
   ${kpi(L('Open leads','الفرص المفتوحة'),D.open.length,`+${D.newP.length} ${L('new','جديدة')} · ${periodLabel()}`,'#3A1F80')}
   ${kpi(L('Open pipeline','قيمة الفرص المفتوحة'),sar(D.pipe),`${L('Weighted','مرجّح')}: ${sar(D.wtd)}`,'#7B61C4')}
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
  <div class="card" style="border-top:4px solid #3A1F80"><h3 class="h3s">✍ ${L('Your message for the e-mail and deck','رسالتك للبريد والعرض')}</h3><p class="small muted" style="margin-top:0">${L('Optional. Saved on this device only, and added to the update e-mail and the deck.','اختياري. يُحفظ على هذا الجهاز فقط، ويُضاف إلى بريد التحديث والعرض.')}</p>
   <div class="grid g2"><div class="field"><label>${L('Key message / highlights','الرسالة الرئيسية / أبرز النقاط')}</label><textarea class="txt" rows="4" oninput="setExecNote('msg',this.value)" placeholder="${L('e.g. Two demos completed this week; Ministry of Culture moved to proposal.','مثال: أنجزنا عرضين توضيحيين هذا الأسبوع؛ وانتقلت وزارة الثقافة إلى مرحلة العرض.')}">${esc(N.msg||'')}</textarea></div>
   <div class="field"><label>${L('Decisions or support needed from leadership','القرارات أو الدعم المطلوب من القيادة')}</label><textarea class="txt" rows="4" oninput="setExecNote('ask',this.value)" placeholder="${L('One per line','بند في كل سطر')}">${esc(N.ask||'')}</textarea></div></div></div>`;
}

/* ---- update e-mail ---- */
function execEmailParts(){
  const D=execData(),N=execNotes(),rtl=lang==='ar',al=rtl?'right':'left',hub=location.origin+location.pathname;
  const subject=L(`Presales progress update — ${fmtDate(D.today)}`,`تحديث تقدم ما قبل البيع — ${fmtDate(D.today)}`);
  const asks=(N.ask||'').split('\n').map(s=>s.trim()).filter(Boolean);
  const S='font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#231C3A;';
  const h=t=>`<h3 style="${S}font-size:15px;color:#3A1F80;margin:18px 0 6px">${t}</h3>`;
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
${N.msg?`<p style="${S}background:#F1EEF8;border-${rtl?'right':'left'}:4px solid #3A1F80;padding:10px 12px">${esc(N.msg).replace(/\n/g,'<br>')}</p>`:''}
${h(L('Headline numbers','الأرقام الرئيسية'))}
<table cellpadding="8" cellspacing="0" style="border-collapse:collapse;${S}"><tr>${kp.map(([t,v])=>`<td style="border:1px solid #E3DFEE;text-align:center;min-width:100px"><div style="font-size:12px;color:#6B6680">${t}</div><div style="font-size:18px;font-weight:700;color:#3A1F80">${v}</div></td>`).join('')}</tr></table>
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

/* ---- PowerPoint progress deck (pptxgenjs, loaded only when needed) ---- */
function loadScript(src){return new Promise((ok,bad)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>bad(new Error('load '+src));document.head.appendChild(s)})}
async function imgData(u){const b=await (await fetch(u)).blob();return await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(b)})}
async function execDeck(){
  toast(L('Building the deck…','جارٍ إعداد العرض…'));
  try{if(!window.PptxGenJS)await loadScript('js/vendor/pptxgen.bundle.js');
    const D=execData(),N=execNotes(),rtl=lang==='ar',F=rtl?'Arial':'Segoe UI',al=rtl?'right':'left';
    const P='3A1F80',DK='231C3A',MU='6B6680',LI='F1EEF8',W='FFFFFF';
    const pptx=new PptxGenJS();pptx.layout='LAYOUT_WIDE';pptx.rtlMode=rtl;pptx.author=ME.name||ME.email;pptx.company='Ideal Innovation House';pptx.title=L('Presales progress update','تحديث تقدم ما قبل البيع');
    let logoW=null,logo=null;try{logoW=await imgData('assets/iih-white.png');logo=await imgData('assets/iih.png')}catch(e){}
    const T=(o)=>({fontFace:F,color:DK,rtlMode:rtl,align:al,...o});
    let n=0;const slide=(title,sub)=>{const s=pptx.addSlide();n++;s.background={color:W};
      s.addShape(pptx.ShapeType.rect,{x:0,y:0,w:13.33,h:0.12,fill:{color:P}});
      s.addText(title,T({x:0.6,y:0.35,w:10.5,h:0.6,fontSize:26,bold:true,color:P}));
      if(sub)s.addText(sub,T({x:0.6,y:0.92,w:10.5,h:0.35,fontSize:13,color:MU}));
      if(logo)s.addImage({data:logo,x:rtl?0.5:11.55,y:0.32,w:1.25,h:0.5,sizing:{type:'contain',w:1.25,h:0.5}});
      s.addText(`${L('IIH Presales','IIH ما قبل البيع')} · ${fmtDate(D.today)}`,T({x:0.6,y:7.05,w:8,h:0.3,fontSize:9,color:MU}));
      s.addText(String(n),{x:12.2,y:7.05,w:0.6,h:0.3,fontSize:9,color:MU,align:'right',fontFace:F});return s};
    const empty=(s,t,y=1.6)=>s.addText(t,T({x:0.6,y,w:12,h:0.5,fontSize:14,color:MU,italic:true}));
    const rv=a=>rtl?a.slice().reverse():a;
    const tbl=(s,head,rows,opt={})=>{const o={x:0.6,y:1.45,w:12.1,...opt};if(o.colW)o.colW=rv(o.colW);
      s.addTable([rv(head).map(h=>({text:h,options:{bold:true,color:W,fill:{color:P},fontFace:F,fontSize:11,align:al}})),...rows.map((r,i)=>rv(r).map(c=>({text:String(c),options:{fontFace:F,fontSize:10.5,color:DK,align:al,fill:{color:i%2?'F8F7FB':W}}})))],{border:{type:'solid',pt:0.5,color:'E3DFEE'},autoPage:false,...o})};

    // 1 Title
    let s=pptx.addSlide();n++;s.background={color:DK};
    s.addShape(pptx.ShapeType.rect,{x:0,y:0,w:0.25,h:7.5,fill:{color:P}});
    if(logoW)s.addImage({data:logoW,x:0.8,y:0.7,w:2.6,h:1.05,sizing:{type:'contain',w:2.6,h:1.05}});
    s.addText(L('Presales progress update','تحديث تقدم ما قبل البيع'),T({x:0.8,y:2.6,w:11.5,h:1,fontSize:40,bold:true,color:W}));
    s.addText(`${fmtDate(D.today)} · ${periodLabel()}`,T({x:0.8,y:3.6,w:11.5,h:0.5,fontSize:18,color:'C9C2E6'}));
    s.addText(`${L('Prepared by','إعداد')}: ${ME.name||ME.email}`,T({x:0.8,y:6.4,w:11.5,h:0.4,fontSize:12,color:'C9C2E6'}));

    // 2 Executive summary
    s=slide(L('Executive summary','الملخص التنفيذي'),L(`Position as of ${fmtDate(D.today)}`,`الوضع حتى ${fmtDate(D.today)}`));
    const K=[[L('Open leads','الفرص المفتوحة'),String(D.open.length),`+${D.newP.length} ${L('new in period','جديدة خلال الفترة')}`,P],[L('Open pipeline','قيمة الفرص المفتوحة'),sar(D.pipe),`${L('Weighted','مرجّح')}: ${sar(D.wtd)}`,'7B61C4'],[L('Won to date','الفوز حتى الآن'),sar(D.wonV),`${D.won.length} ${L('deals','صفقة')}`,'25A27F'],[L('Win rate','نسبة الفوز'),D.winRate==null?'—':D.winRate+'%',`${D.won.length} ${L('won','فوز')} / ${D.lost.length} ${L('lost','خسارة')}`,'C9A24B']];
    (rtl?K.slice().reverse():K).forEach(([t,v,sb,c],i)=>{const x=0.6+i*3.07;s.addShape(pptx.ShapeType.rect,{x,y:1.5,w:2.87,h:1.75,fill:{color:LI},line:{color:LI}});s.addShape(pptx.ShapeType.rect,{x,y:1.5,w:2.87,h:0.08,fill:{color:c}});
      s.addText(t,T({x:x+0.15,y:1.65,w:2.6,h:0.35,fontSize:12,color:MU}));s.addText(v,T({x:x+0.15,y:2.0,w:2.6,h:0.65,fontSize:28,bold:true,color:c}));s.addText(sb,T({x:x+0.15,y:2.7,w:2.6,h:0.4,fontSize:11,color:MU}))});
    const hl=[...(N.msg?N.msg.split('\n').filter(x=>x.trim()):[]),
      `${D.newP.length} ${L('new leads','فرص جديدة')}, ${D.wonP.length} ${L('won','فوز')}, ${D.lostP.length} ${L('lost','خسارة')} ${L('in the','خلال')} ${periodLabel()}`,
      D.overdue.length?`${L('Overdue follow-ups','متابعات متأخرة')}: ${D.overdue.length}`:L('No overdue follow-ups','لا توجد متابعات متأخرة')];
    s.addText(L('Highlights','أبرز النقاط'),T({x:0.6,y:3.6,w:12,h:0.4,fontSize:16,bold:true,color:P}));
    s.addText(hl.map(t=>({text:t,options:{bullet:true,breakLine:true}})),T({x:0.6,y:4.05,w:12.1,h:2.7,fontSize:15,valign:'top',paraSpaceAfter:6}));

    // 3 Pipeline by stage
    s=slide(L('Pipeline by stage','الفرص حسب المرحلة'),L('Number of leads in each stage, with total value','عدد الفرص في كل مرحلة مع إجمالي القيمة'));
    if(D.total){const st=D.stages;s.addChart(pptx.ChartType.bar,[{name:L('Leads','الفرص'),labels:st.map(x=>x.name),values:st.map(x=>x.n)}],{x:0.6,y:1.45,w:7.4,h:5.4,barDir:'bar',chartColors:st.map(x=>x.c.replace('#','')),valAxisHidden:true,valGridLine:{style:'none'},catAxisLabelFontFace:F,catAxisLabelFontSize:11,catAxisOrientation:'maxMin',catAxisLabelColor:DK,showValue:true,dataLabelFontSize:11,dataLabelColor:DK,dataLabelFontFace:F,showLegend:false});
      tbl(s,[L('Stage','المرحلة'),L('Leads','الفرص'),L('Value','القيمة')],st.map(x=>[x.name,String(x.n),x.v?sar(x.v):'—']),{x:8.3,y:1.55,w:4.4,colW:[2.2,0.8,1.4]})}
    else empty(s,L('No leads yet.','لا توجد فرص بعد.'));

    // 4 Product demand
    s=slide(L('Demand by product','الطلب حسب المنتج'),L('Open leads that include each product','الفرص المفتوحة التي تتضمن كل منتج'));
    if(D.products.length){s.addChart(pptx.ChartType.bar,[{name:L('Open leads','الفرص المفتوحة'),labels:D.products.map(p=>p.name),values:D.products.map(p=>p.n)}],{x:0.6,y:1.45,w:7.4,h:5.4,barDir:'col',chartColors:D.products.map(p=>p.c.replace('#','')),valAxisHidden:true,valGridLine:{style:'none'},catAxisLabelFontFace:F,catAxisLabelFontSize:11,catAxisLabelColor:DK,showValue:true,dataLabelFontSize:12,dataLabelFontFace:F,showLegend:false});
      tbl(s,[L('Product','المنتج'),L('Open','مفتوحة'),L('Value','القيمة'),L('Won','فوز')],D.products.map(p=>[p.name,String(p.n),p.v?sar(p.v):'—',String(p.won)]),{x:8.3,y:1.55,w:4.4,colW:[1.9,0.7,1.2,0.6]})}
    else empty(s,L('No products linked to leads yet.','لا توجد منتجات مرتبطة بالفرص بعد.'));

    // 5 Top opportunities
    s=slide(L('Top opportunities','أهم الفرص'),L('Open leads ranked by value × win probability','الفرص المفتوحة مرتبة حسب القيمة × احتمالية الفوز'));
    if(D.top.length)tbl(s,[L('Client','العميل'),L('Stage','المرحلة'),L('Products','المنتجات'),L('Value','القيمة'),L('Win %','احتمال الفوز'),L('Next step','الخطوة التالية'),L('Owner','المسؤول')],
      D.top.map(l=>[l.org||'',stageName(l.stage),(l.products||[]).map(pName).join(', ')||'—',leadVal(l)?sar(leadVal(l)):'—',leadProb(l)+'%',(l.nextStep||'—')+(l.nextDate?` (${l.nextDate})`:''),l.owner||'—']),{colW:[2.2,1.4,2.1,1.2,0.9,3.0,1.3]});
    else empty(s,L('No open leads.','لا توجد فرص مفتوحة.'));

    // 6 What moved
    s=slide(L('What moved','ما الذي تحرك'),periodLabel());
    const mv=[[L('New leads','فرص جديدة'),D.newP,P],[L('Won','فوز'),D.wonP,'25A27F'],[L('Lost','خسارة'),D.lostP,'B23A3A']];
    (rtl?mv.slice().reverse():mv).forEach(([t,a,c],i)=>{const x=0.6+i*4.1;s.addShape(pptx.ShapeType.rect,{x,y:1.45,w:3.9,h:1.3,fill:{color:LI},line:{color:LI}});
      s.addText(`${a.length}`,T({x:x+0.2,y:1.5,w:1.2,h:0.8,fontSize:34,bold:true,color:c}));s.addText(t,T({x:x+1.3,y:1.6,w:2.5,h:0.5,fontSize:15,bold:true}));
      s.addText(a.slice(0,3).map(l=>l.org||'').join(', ')||'—',T({x:x+1.3,y:2.1,w:2.5,h:0.55,fontSize:10,color:MU}))});
    if(D.updates.length)tbl(s,[L('Date','التاريخ'),L('Client','العميل'),L('Update','التحديث')],D.updates.slice(0,9).map(u=>[u.d,u.org||'',(u.text||'').slice(0,120)]),{y:3.0,colW:[1.4,2.6,8.1]});
    else empty(s,L('No updates logged in this period.','لا توجد تحديثات مسجلة خلال هذه الفترة.'),3.1);

    // 7 Attention and decisions
    s=slide(L('Needs attention & decisions','ما يحتاج إلى اهتمام وقرارات'),L('Where leadership support can unblock progress','حيث يمكن لدعم القيادة تسريع التقدم'));
    const att=[...D.overdue.map(l=>`${L('Overdue','متأخرة')}: ${l.org} — ${l.nextStep||''} (${l.nextDate}, ${l.owner||L('unassigned','غير مسند')})`),...D.stale.filter(l=>!D.overdue.includes(l)).map(l=>`${L('No update for 14+ days','دون تحديث لأكثر من 14 يوماً')}: ${l.org}`),...D.noNext.map(l=>`${L('No next step','لا توجد خطوة تالية')}: ${l.org}`)].slice(0,8);
    const asks=(N.ask||'').split('\n').map(x=>x.trim()).filter(Boolean);
    const box=(x,title,items,c,emptyT)=>{s.addShape(pptx.ShapeType.rect,{x,y:1.45,w:5.95,h:5.35,fill:{color:LI},line:{color:LI}});s.addShape(pptx.ShapeType.rect,{x,y:1.45,w:5.95,h:0.08,fill:{color:c}});
      s.addText(title,T({x:x+0.2,y:1.6,w:5.5,h:0.45,fontSize:16,bold:true,color:c}));
      s.addText(items.length?items.map(t=>({text:t,options:{bullet:true,breakLine:true}})):[{text:emptyT,options:{italic:true,color:MU}}],T({x:x+0.2,y:2.1,w:5.55,h:4.5,fontSize:13,valign:'top',paraSpaceAfter:5}))};
    const bx=[[L('Needs attention','يحتاج إلى اهتمام'),att,'B23A3A',L('Nothing overdue or stalled.','لا يوجد ما هو متأخر أو متوقف.')],[L('Decisions / support needed','القرارات / الدعم المطلوب'),asks,P,L('No decisions requested this period.','لا توجد قرارات مطلوبة في هذه الفترة.')]];
    (rtl?bx.slice().reverse():bx).forEach((b,i)=>box(0.6+i*6.15,...b));

    // 8 Coming up
    s=slide(L('Coming up','القادم'),L('Next steps due in the next 14 days, and deals expected to close in 60 days','الخطوات المستحقة خلال 14 يوماً، والصفقات المتوقع إغلاقها خلال 60 يوماً'));
    if(D.upcoming.length||D.closing.length){
      if(D.upcoming.length)tbl(s,[L('Date','التاريخ'),L('Client','العميل'),L('Next step','الخطوة التالية'),L('Owner','المسؤول')],D.upcoming.slice(0,7).map(l=>[l.nextDate,l.org||'',l.nextStep||'',l.owner||'—']),{colW:[1.4,3.0,5.9,1.8]});
      if(D.closing.length)tbl(s,[L('Expected close','الإغلاق المتوقع'),L('Client','العميل'),L('Stage','المرحلة'),L('Value','القيمة')],D.closing.slice(0,5).map(l=>[l.closeDate,l.org||'',stageName(l.stage),leadVal(l)?sar(leadVal(l)):'—']),{y:D.upcoming.length?4.6:1.45,colW:[1.8,4.3,3.4,2.6]})}
    else empty(s,L('Nothing scheduled.','لا يوجد شيء مجدول.'));

    await pptx.writeFile({fileName:`IIH_Presales_Progress_${todayStr()}_${lang.toUpperCase()}.pptx`});
    toast(L('Deck downloaded','تم تنزيل العرض'));
  }catch(e){console.error(e);toast(L('Could not build the deck.','تعذّر إعداد العرض.')+' '+(e.message||''))}
}
