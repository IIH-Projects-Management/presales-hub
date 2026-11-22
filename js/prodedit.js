/* ============ PRODUCT CONTENT EDITOR (Leadership only) ============
   Edits products/{id}.json in place. The previous version is kept in products/{id}.prev for a one-step undo. */
const PE_F=(k,en,ar,t,o)=>({k,en,ar,t:t||'text',...(o||{})});
const PE_SCHEMA=[
 {id:'basics',en:'Basics',ar:'الأساسيات',f:[PE_F('name','Product name','اسم المنتج'),PE_F('short','Short name','الاسم المختصر'),PE_F('cat','Category','الفئة'),PE_F('status','Status (e.g. GA, Beta)','الحالة (مثل GA أو Beta)'),PE_F('owner','Product owner','مالك المنتج'),PE_F('color','Brand colour','لون العلامة','color'),
   PE_F('tagline','Tagline','الشعار','area'),PE_F('pitch','30-second pitch','العرض المختصر (30 ثانية)','area'),PE_F('elevator','Four things to remember','أربع نقاط للتذكر','strs'),
   PE_F('keyMsg','Key message','الرسالة الرئيسية','area',{opt:1}),PE_F('notYet','Not available yet (say so honestly)','غير متاح بعد','area',{opt:1}),PE_F('journey','Customer journey','رحلة العميل','area',{opt:1})]},
 {id:'arabic',en:'Arabic text',ar:'النص العربي',ar_:1,f:[PE_F('cat','Category (Arabic)','الفئة (عربي)'),PE_F('tagline','Tagline (Arabic)','الشعار (عربي)','area'),PE_F('pitch','30-second pitch (Arabic)','العرض المختصر (عربي)','area'),PE_F('elevator','Four things to remember (Arabic)','أربع نقاط للتذكر (عربي)','strs'),
   PE_F('keyMsg','Key message (Arabic)','الرسالة الرئيسية (عربي)','area',{opt:1}),PE_F('notYet','Not available yet (Arabic)','غير متاح بعد (عربي)','area',{opt:1}),PE_F('journey','Customer journey (Arabic)','رحلة العميل (عربي)','area',{opt:1})]},
 {id:'buyers',en:'Who buys',ar:'من يشتري',f:[PE_F('icp','Ideal customer','العميل المثالي','obj',{sub:[['size','Company size','حجم الشركة'],['sector','Sectors','القطاعات'],['trigger','Buying triggers','محفزات الشراء'],['budget','Budget usually from','الميزانية عادةً من']]}),
   PE_F('personas','Buyer personas','الشخصيات المشترية','objs',{sub:[['r','Persona','الشخصية','text'],['c','What they care about','ما يهمهم'],['s','Show them','ماذا نعرض لهم']]})]},
 {id:'pains',en:'Pains & discovery',ar:'المشكلات والاستكشاف',f:[PE_F('pains','Pains and discovery questions','المشكلات وأسئلة الاستكشاف','objs',{sub:[['p','Pain','المشكلة'],['q','Discovery question','سؤال الاستكشاف']]})]},
 {id:'features',en:'Features',ar:'الميزات',f:[PE_F('features','Features','الميزات','objs',{sub:[['f','Feature','الميزة','text'],['b','Business benefit','الفائدة'],['p','Proof','الدليل']]})]},
 {id:'demo',en:'Demo kit',ar:'عدة العرض',f:[PE_F('demoScript','Demo script steps','خطوات العرض التوضيحي','strs'),
   PE_F('videos','Videos','الفيديوهات','objs',{sub:[['t','Title','العنوان','text'],['d','Length / note','المدة / ملاحظة','text'],['src','Video file path (in the site)','مسار ملف الفيديو','text'],['poster','Poster image path','مسار صورة الغلاف','text']]}),
   PE_F('shots','Screenshots','لقطات الشاشة','objs',{sub:[['t','Caption','التعليق','text'],['img','Image path (in the site)','مسار الصورة','text']]})]},
 {id:'cases',en:'Success stories',ar:'قصص النجاح',f:[PE_F('cases','Success stories','قصص النجاح','objs',{sub:[['ref','Reference type (e.g. Public reference)','نوع المرجع','text'],['c','Client / use case','العميل / حالة الاستخدام','text'],['o','Outcome','النتيجة'],['r','Details','التفاصيل']]})]},
 {id:'compete',en:'Competition',ar:'المنافسة',f:[PE_F('comp','Battle cards','بطاقات المنافسة','objs',{sub:[['x','Competitor','المنافس','text'],['w','Where we win','أين نتفوق'],['l','Where we lose','أين نخسر'],['m','Landmine question','سؤال كاشف']]})]},
 {id:'objections',en:'Objections',ar:'الاعتراضات',f:[PE_F('obj','Objections','الاعتراضات','objs',{sub:[['o','Objection','الاعتراض'],['r','Response','الرد'],['p','Proof to send','الدليل المرسل']]})]},
 {id:'pricing',en:'Pricing',ar:'التسعير',f:[PE_F('tiers','Pricing tiers','فئات التسعير','objs',{sub:[['n','Tier name','اسم الفئة','text'],['p','Price / what is included','السعر / ما يشمله'],['best','Mark as most popular','الأكثر طلباً','bool']]}),PE_F('disc','Pricing note (shown instead of tiers when set)','ملاحظة التسعير','area')]},
 {id:'tech',en:'Technical',ar:'الجانب الفني',f:[PE_F('tech','Technical answers','الإجابات الفنية','pairs',{sub:[['0','Area','المجال','text'],['1','Answer','الإجابة']]})]},
 {id:'rfp',en:'RFP answers',ar:'إجابات طلبات العروض',f:[PE_F('rfp','Ready-made RFP answers','إجابات جاهزة لطلبات العروض','objs',{sub:[['q','Question','السؤال'],['a','Answer','الإجابة']]})]}];
let PE=null,PE_ORIG=null,PE_SEC='basics',PE_DIRTY=false,PE_PREV=null;
const peGet=(o,path)=>path.reduce((a,k)=>a==null?a:a[k],o);
function peSetPath(o,path,v){let a=o;for(let i=0;i<path.length-1;i++){if(a[path[i]]==null)a[path[i]]=typeof path[i+1]==='number'?[]:{};a=a[path[i]]}a[path.at(-1)]=v}
function peIn(el){const path=JSON.parse(el.dataset.p);peSetPath(PE,path,el.type==='checkbox'?el.checked:el.value);PE_DIRTY=true;const b=document.getElementById('peSave');if(b)b.disabled=false}
function peList(path,op,i){const arr=peGet(PE,path)||[];if(!peGet(PE,path))peSetPath(PE,path,arr);
  if(op==='add'){const f=peField(path);arr.push(f.t==='strs'?'':f.t==='pairs'?['','']:Object.fromEntries(f.sub.map(([k,,,t])=>[k,t==='bool'?false:''])))}
  if(op==='del')arr.splice(i,1);if(op==='up'&&i>0)[arr[i-1],arr[i]]=[arr[i],arr[i-1]];if(op==='down'&&i<arr.length-1)[arr[i+1],arr[i]]=[arr[i],arr[i+1]];
  PE_DIRTY=true;render()}
function peField(path){const ar=path[0]==='ar',k=ar?path[1]:path[0];for(const s of PE_SCHEMA)if(!!s.ar_===ar)for(const f of s.f)if(f.k===k)return f}
const peAttr=path=>`data-p="${esc(JSON.stringify(path))}" oninput="peIn(this)" onchange="peIn(this)"`;
function peInput(path,label,t,dir){const v=peGet(PE,path);const d=dir?` dir="${dir}"`:'';
  if(t==='bool')return `<label class="small"><input type="checkbox" ${v?'checked':''} ${peAttr(path)}> ${label}</label>`;
  if(t==='color')return `<div class="field"><label>${label}</label><input type="color" value="${esc(v||'#6B009D')}" ${peAttr(path)}></div>`;
  return `<div class="field"><label>${label}</label>${t==='area'?`<textarea class="txt" rows="3"${d} ${peAttr(path)}>${esc(v||'')}</textarea>`:`<input class="txt"${d} value="${esc(v??'')}" ${peAttr(path)}>`}</div>`}
const peBtns=(path,i,n)=>`<div class="pe-rb"><button class="btn sm" ${i?'':'disabled'} onclick='peList(${JSON.stringify(path)},"up",${i})'>↑</button><button class="btn sm" ${i<n-1?'':'disabled'} onclick='peList(${JSON.stringify(path)},"down",${i})'>↓</button><button class="btn sm" onclick='peList(${JSON.stringify(path)},"del",${i})'>✕</button></div>`;
function peRender(f,ar){const path=ar?['ar',f.k]:[f.k],dir=ar?'rtl':'',label=L(f.en,f.ar);
  if(['text','area','color'].includes(f.t))return peInput(path,label,f.t,dir);
  if(f.t==='obj')return `<div class="card pe-block"><b>${label}</b><div class="grid g2" style="gap:10px;margin-top:8px">${f.sub.map(([k,en,a])=>peInput([...path,k],L(en,a),'area',dir)).join('')}</div></div>`;
  const arr=peGet(PE,path)||[];
  return `<div class="card pe-block"><div style="display:flex;justify-content:space-between;align-items:center"><b>${label} <span class="n">${arr.length}</span></b><button class="btn sm" onclick='peList(${JSON.stringify(path)},"add")'>＋ ${L('Add','إضافة')}</button></div>
   ${arr.map((it,i)=>`<div class="pe-row">${f.t==='strs'?`<textarea class="txt" rows="2"${dir?' dir="rtl"':''} ${peAttr([...path,i])}>${esc(it||'')}</textarea>`
     :`<div class="grid g2" style="gap:8px">${f.sub.map(([k,en,a,t])=>peInput([...path,i,f.t==='pairs'?+k:k],L(en,a),t||'area',dir)).join('')}</div>`}${peBtns(path,i,arr.length)}</div>`).join('')||`<div class="small muted" style="margin-top:6px">${L('Nothing yet.','لا يوجد شيء بعد.')}</div>`}</div>`}
async function peLoadPrev(id){PE_PREV=null;try{const d=await DB.collection('products').doc(id).get();const x=d.exists?d.data():{};PE_PREV=x.prev?{at:x.updatedAt&&x.updatedAt.toDate?x.updatedAt.toDate().toISOString():String(x.updatedAt||''),by:x.updatedByName||''}:null}catch(e){}if(cur.view==='pedit')render()}
function vProdEdit(){
  if(realRole!=='leadership')return `<div class="card empty">🔒 ${L('Only Leadership can edit product content.','تعديل محتوى المنتجات متاح للقيادة فقط.')}</div>`;
  const p=PRODUCTS.find(x=>x.id===cur.prod);if(!p)return `<div class="empty">${L('Product not found.','لم يتم العثور على المنتج.')}</div>`;
  if(!PE||PE.id!==p.id){const c=JSON.parse(JSON.stringify(p));delete c.ready;delete c.draft;c.ar=c.ar||{};PE=c;PE_ORIG=JSON.stringify(c);PE_DIRTY=false;PE_SEC=(typeof PE_SEC_NEXT!=='undefined'&&PE_SEC_NEXT)||'basics';if(typeof PE_SEC_NEXT!=='undefined')PE_SEC_NEXT='';peLoadPrev(p.id)}
  const s=PE_SCHEMA.find(x=>x.id===PE_SEC);
  return `<button class="back" onclick="peLeave('${p.id}')">${L('← Back to the product','→ العودة إلى المنتج')}</button>
  <div class="page-hd"><div><h1>✎ ${L('Edit','تعديل')}: ${esc(p.name)}</h1><p class="muted">${L('Changes go live for all signed-in staff when you save. The public client Showcase is separate: after saving, download its updated data from Access levels.','تظهر التغييرات لجميع الموظفين فور الحفظ. صفحة العرض العامة للعملاء منفصلة: بعد الحفظ نزّل بياناتها المحدثة من مستويات الوصول.')}</p></div>
   <div style="display:flex;gap:8px;flex-wrap:wrap">${PE_PREV?`<button class="btn" onclick="peUndo('${p.id}')" title="${esc(PE_PREV.by)} ${esc(String(PE_PREV.at).slice(0,16).replace('T',' '))}">↶ ${L('Undo last save','التراجع عن آخر حفظ')}</button>`:''}<button class="btn" onclick="peDownload()">⬇ ${L('Download this product (JSON)','تنزيل هذا المنتج (JSON)')}</button><button class="btn primary" id="peSave" onclick="peSave()">💾 ${L('Save changes','حفظ التغييرات')}</button></div></div>
  <div class="pe-wrap"><div class="pe-nav">${PE_SCHEMA.map(x=>`<button class="${x.id===PE_SEC?'on':''}" onclick="PE_SEC='${x.id}';render()">${L(x.en,x.ar)}</button>`).join('')}</div>
   <div class="pe-body">${s.f.map(f=>peRender(f,!!s.ar_)).join('')}
    ${PE_SEC==='demo'?`<p class="small muted">${L('Videos and images are files in the website (videos/, orbit/, assets/). Upload a new file to GitHub first, then type its path here.','الفيديوهات والصور ملفات داخل الموقع (videos/ و orbit/ و assets/). ارفع الملف الجديد إلى GitHub أولاً ثم اكتب مساره هنا.')}</p>`:''}</div></div>`;
}
function peLeave(id){if(PE_DIRTY&&JSON.stringify(PE)!==PE_ORIG&&!confirmDel('pe-leave'+id)){toast(L('Unsaved changes — press Back again to discard them.','تغييرات غير محفوظة — اضغط رجوع مرة أخرى لتجاهلها.'));return}PE=null;go('product',id,'overview')}
function peClean(o){const orig=JSON.parse(PE_ORIG);['keyMsg','notYet','journey'].forEach(k=>{if(!o[k]&&!(k in orig))delete o[k];if(o.ar&&!o.ar[k]&&!(orig.ar&&k in orig.ar))delete o.ar[k]});
  ['elevator','demoScript'].forEach(k=>{if(Array.isArray(o[k]))o[k]=o[k].filter(x=>String(x).trim())});if(o.ar&&Array.isArray(o.ar.elevator))o.ar.elevator=o.ar.elevator.filter(x=>String(x).trim());
  ['personas','pains','features','videos','shots','cases','comp','obj','tiers','rfp'].forEach(k=>{if(Array.isArray(o[k]))o[k]=o[k].filter(it=>Object.entries(it).some(([kk,v])=>typeof v==='string'&&v.trim()))});
  if(Array.isArray(o.tech))o.tech=o.tech.filter(([a,b])=>String(a).trim()||String(b).trim());return o}
async function peSave(){const p=PRODUCTS.find(x=>x.id===PE.id);if(!String(PE.name||'').trim())return toast(L('The product needs a name.','يجب أن يكون للمنتج اسم.'));
  const data=peClean(JSON.parse(JSON.stringify(PE)));const id=data.id;delete data.id;
  try{const ref=DB.collection('products').doc(id),old=await ref.get(),od=old.exists?old.data():{};
    await ref.set({sort:od.sort??(PRODUCTS.indexOf(p)+1),json:JSON.stringify(data),prev:od.json||'',updatedAt:FBTS(),updatedBy:ME.id,updatedByName:ME.name||ME.email});
    const i=PRODUCTS.findIndex(x=>x.id===id);PRODUCTS[i]={...data,id};PROD_AR[id]=data.ar||{};computeReadiness();
    PE_ORIG=JSON.stringify({...data,id});PE={...JSON.parse(PE_ORIG)};PE_DIRTY=false;toast(L('Saved — live for all staff','تم الحفظ — ظاهر لجميع الموظفين'));peLoadPrev(id)}
  catch(e){toast(isDenied(e)?L('Only Leadership can edit product content.','تعديل محتوى المنتجات متاح للقيادة فقط.'):L('Could not save: ','تعذّر الحفظ: ')+e.message)}}
async function peUndo(id){if(!confirmDel('pe-undo'+id))return;try{const ref=DB.collection('products').doc(id),d=(await ref.get()).data();if(!d.prev)return toast(L('Nothing to undo.','لا يوجد ما يُتراجع عنه.'));
  await ref.set({sort:d.sort,json:d.prev,prev:d.json,updatedAt:FBTS(),updatedBy:ME.id,updatedByName:ME.name||ME.email});
  const data=JSON.parse(d.prev),i=PRODUCTS.findIndex(x=>x.id===id);PRODUCTS[i]={...data,id};PROD_AR[id]=data.ar||{};computeReadiness();PE=null;toast(L('Previous version restored','تمت استعادة النسخة السابقة'));render()}
  catch(e){toast(L('Could not undo: ','تعذّر التراجع: ')+e.message)}}
function peDownload(){const d=JSON.parse(JSON.stringify(PE));saveBlob(`product_${d.id}_${todayStr()}.json`,new Blob([JSON.stringify({format:'iih-presales-hub-products',version:1,products:[{id:d.id,data:d}]},null,1)],{type:'application/json'}))}
