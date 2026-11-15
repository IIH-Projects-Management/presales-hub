/* ===== Minimal ZIP writer (stored, no compression) + document generators ===== */
const CRC_T=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(b){let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=CRC_T[(c^b[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0}
function zipStore(files){ // files: [{name, data:Uint8Array}]
  const enc=new TextEncoder(), chunks=[], central=[]; let off=0;
  const u16=v=>[v&255,(v>>>8)&255], u32=v=>[v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];
  for(const f of files){const nm=enc.encode(f.name),d=f.data,c=crc32(d);
    const lh=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0x21),...u32(c),...u32(d.length),...u32(d.length),...u16(nm.length),...u16(0)]);
    chunks.push(lh,nm,d);
    central.push(new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0x21),...u32(c),...u32(d.length),...u32(d.length),...u16(nm.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(off)]),nm);
    off+=lh.length+nm.length+d.length;}
  const cs=central.reduce((s,a)=>s+a.length,0);
  const end=new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(cs),...u32(off),...u16(0)]);
  return new Blob([...chunks,...central,end]);
}
const xmlEsc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const b64bytes=b=>Uint8Array.from(atob(b),c=>c.charCodeAt(0));

/* ---- Scope & Vision .docx from the IIH template ---- */
const TPL_CACHE={};
async function loadTpl(lang){if(!TPL_CACHE[lang]){const r=await fetch('tpl/scope_'+lang+'.json');if(!r.ok)throw new Error('template');TPL_CACHE[lang]=await r.json()}return TPL_CACHE[lang]}
async function buildScopeDocx(sc,lang){
  const T=await loadTpl(lang), enc=new TextEncoder(), files=[];
  const fill=(x,obj)=>x.replace(/{{([\w.]+)}}/g,(m,k)=>xmlEsc(k==='.'?obj:(obj[k]??'')));
  const lists=['drivers','problems','value','inScope','outScope','assumptions','constraints'];
  for(const [name,part] of Object.entries(T.parts)){
    if(part.b){files.push({name,data:b64bytes(part.b)});continue}
    let x=part.t;
    if(/^word\/(document|footer|header)/.test(name)){
      for(const [bn,blk] of Object.entries(T.blocks)){
        if(!x.includes('@@'+bn+'@@'))continue;
        let items=(sc[bn]||[]).filter(it=>lists.includes(bn)?String(it).trim():Object.values(it).some(v=>String(v||'').trim()));
        if(bn==='ai')items=items.map((it,i)=>({...it,num:i+1}));
        if(!items.length)items=[lists.includes(bn)?'—':{}];
        x=x.replace('@@'+bn+'@@',items.map(it=>fill(blk.xml,it)).join(''));
      }
      x=fill(x,sc);
    }
    files.push({name,data:enc.encode(x)});
  }
  files.sort((a,b)=>a.name==='[Content_Types].xml'?-1:b.name==='[Content_Types].xml'?1:0);
  return zipStore(files);
}

/* ---- Delivery timeline .xlsx (Arabic + English sheets, IIH template colours) ---- */
const STAGE_COL=['3A1F80','7B61C4','9C1C69','25A27F','1F8FB3'];
function colName(n){let s='';n++;while(n>0){const m=(n-1)%26;s=String.fromCharCode(65+m)+s;n=Math.floor((n-1)/26)}return s}
function buildTimelineXlsx(lead){
  const tl=lead.timeline, start=new Date(tl.start+'T00:00:00'), enc=new TextEncoder();
  const fmt=d=>`${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
  const rowsEn=timelineRows(tl,'en'), weeks=Math.max(12,Math.ceil(Math.max(...rowsEn.map(r=>r.sw+r.dur),1))+1);
  const STG={en:['Requirements and analysis','Design','Development and configuration','Testing and UAT','Deployment and go-live'],ar:['التحليل وجمع المتطلبات','التصميم','التطوير والإعداد','الاختبار وقبول المستخدم (UAT)','الإطلاق والتشغيل']};
  const sheet=(lg)=>{
    const S=STG[lg], A=lg==='ar', rows=timelineRows(tl,lg);
    const cell=(r,c,v,s,num)=>`<c r="${colName(c)}${r}" s="${s||0}"${num?'':' t="inlineStr"'}>${num?`<v>${v}</v>`:`<is><t xml:space="preserve">${xmlEsc(v)}</t></is>`}</c>`;
    let out=[], r=1;
    out.push(`<row r="1" ht="24" customHeight="1">${cell(1,0,(A?'الجدول الزمني المقترح لتنفيذ حلول ':'Proposed Delivery Timeline, ')+((A?tl.titleAr:tl.titleEn)||lead.org||'')+(tl.version?(A?' (الإصدار '+tl.version+')':' (Version '+tl.version+')'):''),1)}</row>`);
    out.push(`<row r="2">${cell(2,0,A?'مسودة للنقاش. المدد تقديرات أولية بانتظار تأكيد الفريق التقني والعميل.':'Draft for discussion. Durations are first estimates pending confirmation by the technical team and the client.',2)}</row>`);
    const end=rows.length?new Date(Math.max(...rows.map(x=>x.end))):start;
    out.push(`<row r="3">${cell(3,0,A?'تاريخ بداية المشروع':'Project start date',3)}${cell(3,2,fmt(start),4)}${cell(3,3,A?'نهاية المشروع':'Project end',3)}${cell(3,4,fmt(end),4)}${cell(3,5,A?'أسبوع العمل من الأحد إلى الخميس':'Work week Sunday to Thursday',2)}</row>`);
    out.push(`<row r="4">${cell(4,0,A?'مراحل SDLC:':'SDLC stages:',3)}${S.map((s,i)=>cell(4,7+i*7,s,10+i)).join('')}</row>`);
    const hd=[A?'الفرصة':'Opp',A?'البند والمرحلة':'Item and stage',A?'أسبوع البداية':'Start week',A?'المدة (أسابيع)':'Duration (weeks)',A?'تاريخ البداية':'Start date',A?'تاريخ النهاية':'End date'];
    let h=hd.map((x,i)=>cell(6,i,x,5)).join('');
    for(let w=0;w<weeks;w++){const d=new Date(start);d.setDate(d.getDate()+7*w);h+=cell(6,6+w,`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`,5)}
    out.push(`<row r="6" ht="30" customHeight="1">${h}</row>`); r=7;
    for(const x of rows){
      const st=x.kind==='phase'?6:x.kind==='item'?7:8;
      const label=x.kind==='stage'?'    '+S[x.stage]:(x.kind==='phase'?x.name:x.name);
      let c=(x.kind==='phase'?cell(r,0,label,st):x.kind==='item'?cell(r,0,x.code,st)+cell(r,1,label,st):cell(r,1,label,st))+cell(r,2,x.sw,st,1)+cell(r,3,x.dur,st,1)+cell(r,4,fmt(new Date(x.startD)),st)+cell(r,5,fmt(new Date(x.end)),st);
      const gs=x.kind==='phase'?16:x.kind==='item'?15:10+x.stage;
      for(let w=0;w<weeks;w++){if(w>=x.sw&&w<x.sw+x.dur)c+=cell(r,6+w,'',gs)}
      out.push(`<row r="${r}">${c}</row>`);r++;
    }
    r++;out.push(`<row r="${r}">${cell(r,0,A?'نهاية المشروع المتوقعة':'Expected project end',3)}${cell(r,5,fmt(end),4)}</row>`);r++;
    const builds=rows.filter(x=>x.kind==='item'&&x.type==='build').map(x=>x.name);
    if(builds.length){r++;out.push(`<row r="${r}">${cell(r,0,(A?'بنود تتطلب تطويراً فعلياً: ':'Items that are new builds (actual development): ')+builds.join(A?'، ':', '),2)}</row>`)}
    rows.filter(x=>x.kind==='item'&&x.notes).forEach(x=>{r++;out.push(`<row r="${r}">${cell(r,0,`${x.code} — ${x.name}: ${x.notes}`,2)}</row>`)});
    r++;out.push(`<row r="${r}">${cell(r,0,A?'في المنتجات الجاهزة، مرحلة التطوير تعني الإعداد والتخصيص. وفي الحلول الجديدة تعني تطويراً فعلياً.':'For ready products, development means configuration and customization. For new builds, it means actual development.',2)}</row>`);
    const cols=`<cols><col min="1" max="1" width="${A?30:28}" customWidth="1"/><col min="2" max="2" width="34" customWidth="1"/><col min="3" max="6" width="13" customWidth="1"/><col min="7" max="${6+weeks}" width="5.5" customWidth="1"/></cols>`;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"${A?' rightToLeft="1"':''}><pane xSplit="6" ySplit="6" topLeftCell="G7" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>${cols}<sheetData>${out.join('')}</sheetData></worksheet>`;
  };
  const fill=c=>`<fill><patternFill patternType="solid"><fgColor rgb="FF${c}"/><bgColor indexed="64"/></patternFill></fill>`;
  const fills=`<fills count="12"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${fill('3A1F80')}${fill('231C3A')}${fill('C9C0E3')}${STAGE_COL.map(fill).join('')}${fill('9C1C69')}${fill('EEEAF7')}</fills>`;
  const fonts=`<fonts count="6"><font><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="15"/><color rgb="FF3A1F80"/><name val="Calibri"/></font><font><i/><sz val="9"/><color rgb="FF6B6580"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FF231C3A"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><sz val="10"/><color rgb="FF6B6580"/><name val="Calibri"/></font></fonts>`;
  const bd=`<borders count="2"><border/><border><left style="thin"><color rgb="FFE2E7EC"/></left><right style="thin"><color rgb="FFE2E7EC"/></right><top style="thin"><color rgb="FFE2E7EC"/></top><bottom style="thin"><color rgb="FFE2E7EC"/></bottom></border></borders>`;
  const xf=(f,fi,b,al)=>`<xf numFmtId="0" fontId="${f}" fillId="${fi}" borderId="${b}" applyFont="1" applyFill="1" applyBorder="1"${al?' applyAlignment="1"><alignment '+al+'/></xf>':'/>'}`;
  // 0 default,1 title,2 note,3 label,4 value,5 header,6 phase,7 item,8 stage,9 spare,10-14 stage legend/gantt,15 item bar,16 phase bar
  const xfs=[xf(0,0,0),xf(1,0,0),xf(2,0,0),xf(3,0,0),xf(3,11,1),xf(4,2,1,'horizontal="center" vertical="center" wrapText="1"'),xf(4,3,1),xf(3,4,1),xf(5,0,1),xf(0,0,0),...STAGE_COL.map((_,i)=>xf(4,5+i,1,'horizontal="center"')),xf(3,4,1),xf(4,10,1)];
  const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${fonts}${fills}${bd}<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs></styleSheet>`;
  const files=[
    ['[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`],
    ['_rels/.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="الجدول الزمني" sheetId="1" r:id="rId1"/><sheet name="Timeline" sheetId="2" r:id="rId2"/></sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml',styles],['xl/worksheets/sheet1.xml',sheet('ar')],['xl/worksheets/sheet2.xml',sheet('en')]];
  return zipStore(files.map(([name,t])=>({name,data:enc.encode(t)})));
}
/* Normalise older timeline data to the form-based model */
function normTl(tl){if(!tl)return tl;tl.version=tl.version||'1';tl.phases=tl.phases||[];let n=0;
  tl.phases.forEach((ph,pi)=>{ph.id=ph.id||'P'+pi+Math.random().toString(36).slice(2,6);if(ph.nameAr==null&&ph.nameEn==null){ph.nameAr=ph.name||'';ph.nameEn=ph.name||''}
    (ph.items=ph.items||[]).forEach(it=>{n++;it.id=it.id||'I'+Math.random().toString(36).slice(2,8);if(it.nameAr==null&&it.nameEn==null){it.nameAr=it.name||'';it.nameEn=it.name||''}
      it.opp=it.opp||('Opp'+n);it.products=it.products||(it.product?[it.product]:[]);it.type=it.type||'ready';it.startMode=it.startMode||'week';it.week=+it.week||0;it.durs=(it.durs||[1,1,2,1,1]).slice(0,5);it.notes=it.notes||''})});return tl}
/* Flatten a timeline into rows (phase / item / stage) with week offsets and dates.
   Same rules as the IIH template: start = project start + 7 × week; end = start + 7 × weeks − 3 (Sun–Thu).
   An item can start at a given week or right after another item ends. */
function timelineRows(tl,lg){
  normTl(tl); lg=lg||(typeof lang!=='undefined'?lang:'en');
  const start=new Date((tl.start||new Date().toISOString().slice(0,10))+'T00:00:00').getTime(), DAY=864e5, out=[];
  const pick=(o,k)=>lg==='ar'?(o[k+'Ar']||o[k+'En']||''):(o[k+'En']||o[k+'Ar']||'');
  const all=tl.phases.flatMap(ph=>ph.items), sw={};
  const tot=it=>it.durs.reduce((a,b)=>a+Math.max(0,+b||0),0);
  for(let pass=0;pass<all.length+1;pass++)all.forEach(it=>{
    if(it.startMode==='after'&&it.after&&it.after!==it.id){const r=all.find(x=>x.id===it.after);if(r&&sw[r.id]!=null)sw[it.id]=sw[r.id]+tot(r);else if(sw[it.id]==null&&pass===all.length)sw[it.id]=+it.week||0}
    else sw[it.id]=Math.max(0,+it.week||0)});
  tl.phases.forEach(ph=>{
    const phRow={kind:'phase',name:pick(ph,'name')}; out.push(phRow); const inner=[];
    ph.items.forEach(it=>{const s=sw[it.id]||0,durs=it.durs.map(v=>Math.max(0,+v||0)),t=tot(it);
      const item={kind:'item',id:it.id,code:it.opp,name:pick(it,'name'),type:it.type,products:it.products,notes:it.notes,sw:s,dur:t,startD:start+7*s*DAY,end:start+(7*(s+t)-3)*DAY};out.push(item);inner.push(item);
      let w=s;durs.forEach((d,i)=>{out.push({kind:'stage',stage:i,sw:w,dur:d,startD:start+7*w*DAY,end:start+(7*(w+d)-3)*DAY,parent:item});w+=d});});
    if(inner.length){phRow.sw=Math.min(...inner.map(x=>x.sw));const e=Math.max(...inner.map(x=>x.sw+x.dur));phRow.dur=e-phRow.sw;phRow.startD=start+7*phRow.sw*DAY;phRow.end=start+(7*e-3)*DAY}else{phRow.sw=0;phRow.dur=0;phRow.startD=start;phRow.end=start}
  });
  return out;
}
