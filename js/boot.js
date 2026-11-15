/* Sign-in and start-up: Firebase Auth (e-mail + password, verified e-mail) → users/{uid} role → product content → app */
let AUTH=null, DB=null, ME={id:null,email:'',name:''};
const FBTS=()=>firebase.firestore.FieldValue.serverTimestamp();
const tsStr=t=>{const d=t&&t.toDate?t.toDate():null;return d?new Date(d.getTime()-d.getTimezoneOffset()*6e4).toISOString():(t||'')};
const isDenied=e=>e&&(e.code==='permission-denied'||/permission/i.test(e.message||''));

function bootScreen(html){document.getElementById('tabs').innerHTML='';document.getElementById('accBadge').style.display='none';document.getElementById('main').innerHTML=`<div class="auth-wrap"><div class="card auth"><img src="assets/iih.png" alt="Ideal Innovation House" style="height:46px;margin-bottom:12px"><h2>${L('Presales Hub','مركز ما قبل البيع')}</h2>${html}</div></div>`}
const outBtn=()=>`<button class="btn" onclick="signOut()">${L('Sign out','تسجيل الخروج')}</button>`;
const clientNote=()=>`<p class="small muted" style="margin-bottom:0">${L('Clients: please use the Product Showcase link you received.','العملاء: يرجى استخدام رابط عرض المنتجات الذي وصلكم.')}</p>`;
function authErr(e){const c=(e&&e.code)||'';return ({
  'auth/invalid-credential':L('E-mail or password is not correct.','البريد أو كلمة المرور غير صحيحة.'),
  'auth/wrong-password':L('E-mail or password is not correct.','البريد أو كلمة المرور غير صحيحة.'),
  'auth/user-not-found':L('E-mail or password is not correct.','البريد أو كلمة المرور غير صحيحة.'),
  'auth/email-already-in-use':L('This e-mail already has an account. Sign in, or reset the password.','لهذا البريد حساب مسبقاً. سجّل الدخول أو أعد تعيين كلمة المرور.'),
  'auth/weak-password':L('Use at least 8 characters.','استخدم 8 أحرف على الأقل.'),
  'auth/invalid-email':L('Enter a valid e-mail address.','أدخل بريداً صحيحاً.'),
  'auth/too-many-requests':L('Too many attempts. Wait a few minutes and try again.','محاولات كثيرة. انتظر بضع دقائق ثم حاول مجدداً.'),
  'auth/network-request-failed':L('No connection. Check your network.','لا يوجد اتصال. تحقق من الشبكة.')
 })[c]||esc((e&&e.message)||String(e))}
const linkBack=()=>({url:location.origin+location.pathname});

function loginScreen(msg,mode='in'){
  const up=mode==='up';
  bootScreen(`<div class="seg">${[['in',L('Sign in','تسجيل الدخول')],['up',L('Create account','إنشاء حساب')]].map(([m,t])=>`<button type="button" class="${(m==='up')===up?'on':''}" onclick="loginScreen('','${m}')">${t}</button>`).join('')}</div>
  ${msg?`<div class="note-warn">${msg}</div>`:''}
  <form onsubmit="event.preventDefault();${up?'doSignUp()':'doSignIn()'}">
   ${up?`<input class="txt" id="nm" required placeholder="${L('Full name','الاسم الكامل')}" autocomplete="name" style="margin-bottom:8px">`:''}
   <input class="txt" id="em" type="email" dir="ltr" required placeholder="name@company.com" autocomplete="email" style="margin-bottom:8px">
   <input class="txt" id="pw" type="password" dir="ltr" required minlength="8" placeholder="${L('Password (8+ characters)','كلمة المرور (8 أحرف أو أكثر)')}" autocomplete="${up?'new-password':'current-password'}">
   <button class="btn primary" style="width:100%;justify-content:center;margin-top:10px;padding:10px">${up?L('Create account','إنشاء حساب'):L('Sign in','تسجيل الدخول')}</button></form>
  ${up?`<p class="small muted">${L('Use your work e-mail. We will send a verification link; Leadership then gives you an access level.','استخدم بريد العمل. سنرسل رابط تحقق، ثم تمنحك القيادة مستوى الوصول.')}</p>`:`<p class="small"><a href="javascript:resetPw()">${L('Forgot password?','نسيت كلمة المرور؟')}</a></p>`}
  ${clientNote()}`)}
async function doSignIn(){const em=$('#em').value.trim(),pw=$('#pw').value;
  try{await AUTH.signInWithEmailAndPassword(em,pw)}catch(e){loginScreen(authErr(e),'in');$('#em').value=em}}
async function doSignUp(){const nm=$('#nm').value.trim(),em=$('#em').value.trim(),pw=$('#pw').value;
  try{sessionStorage.setItem('hub-name',nm)}catch(e){}
  try{const c=await AUTH.createUserWithEmailAndPassword(em,pw);
    await c.user.updateProfile({displayName:nm}).catch(()=>{});
    await c.user.sendEmailVerification(linkBack()).catch(()=>c.user.sendEmailVerification());
  }catch(e){loginScreen(authErr(e),'up')}}
async function resetPw(){const em=($('#em')&&$('#em').value.trim())||'';
  if(!em)return loginScreen(L('Type your e-mail above, then press "Forgot password?" again.','اكتب بريدك أعلاه ثم اضغط "نسيت كلمة المرور؟" مرة أخرى.'),'in');
  try{await AUTH.sendPasswordResetEmail(em,linkBack()).catch(()=>AUTH.sendPasswordResetEmail(em))}catch(e){}
  loginScreen(L('If this e-mail has an account, a reset link is on its way.','إذا كان لهذا البريد حساب، فسيصلك رابط إعادة التعيين.'),'in')}
function verifyScreen(u,msg){bootScreen(`<p>📧 ${L('Verify your e-mail','تحقق من بريدك')}: <b dir="ltr">${esc(u.email)}</b></p>
  <p class="muted small">${L('Open the link we sent (check junk mail too), then press Continue.','افتح الرابط الذي أرسلناه (تحقق من البريد غير المرغوب أيضاً)، ثم اضغط متابعة.')}</p>${msg?`<div class="note-info">${msg}</div>`:''}
  <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" onclick="afterVerify()">${L('Continue','متابعة')}</button><button class="btn" onclick="resendVerify()">${L('Resend link','إعادة الإرسال')}</button>${outBtn()}</div>`)}
async function afterVerify(){const u=AUTH.currentUser;await u.reload();if(AUTH.currentUser.emailVerified){await u.getIdToken(true);location.reload()}else verifyScreen(u,L('Not verified yet.','لم يتم التحقق بعد.'))}
async function resendVerify(){const u=AUTH.currentUser;try{await u.sendEmailVerification(linkBack()).catch(()=>u.sendEmailVerification());verifyScreen(u,L('Sent again.','تم الإرسال مجدداً.'))}catch(e){verifyScreen(u,authErr(e))}}
async function signOut(){try{if(typeof leadsUnsub==='function')leadsUnsub()}catch(e){}await AUTH.signOut();location.hash='';location.reload()}

/* First person to sign up becomes Leadership (atomic: profile + config/bootstrap in one batch); everyone after starts as Pending. */
async function ensureProfile(u){
  const ref=DB.collection('users').doc(u.uid);const s=await ref.get();if(s.exists)return s.data();
  let name='';try{name=sessionStorage.getItem('hub-name')||''}catch(e){}name=name||u.displayName||'';
  const base={email:u.email,name,createdAt:FBTS()};
  const boot=await DB.collection('config').doc('bootstrap').get();
  if(!boot.exists){try{const b=DB.batch();b.set(ref,{...base,role:'leadership'});b.set(DB.collection('config').doc('bootstrap'),{owner:u.uid,at:FBTS()});await b.commit();return {...base,role:'leadership'}}catch(e){}}
  try{await ref.set({...base,role:'pending'});return {...base,role:'pending'}}
  catch(e){if(isDenied(e))return {role:'blocked'};throw e}}

function computeReadiness(){PRODUCTS.forEach(p=>{const filled=[1,p.personas.length,p.pains.length,p.features.length,p.videos.length+p.shots.length,p.cases.length,p.comp.length,p.obj.length,p.tiers.length,p.tech.length,1,p.rfp.length].filter(Boolean).length;p.ready=Math.round(filled/12*100);p.draft=true})}
async function loadProducts(){const q=await DB.collection('products').orderBy('sort').get();
  PRODUCTS=q.docs.map(d=>{const x=d.data();let data={};try{data=JSON.parse(x.json||'{}')}catch(e){}return {...data,id:d.id}});
  PROD_AR={};PRODUCTS.forEach(p=>{PROD_AR[p.id]=p.ar||{}});computeReadiness()}

/* Leadership: load products_seed.json (kept out of GitHub) into Firestore. Existing products are replaced. */
function importBox(){return `<div class="card" style="margin-top:12px"><b>${L('Import product content','استيراد محتوى المنتجات')}</b><p class="small muted">${L('Choose products_seed.json from the firebase-setup folder. Products with the same id are replaced.','اختر الملف products_seed.json من مجلد firebase-setup. تُستبدل المنتجات التي لها نفس المعرّف.')}</p><input type="file" accept=".json,application/json" onchange="importProducts(this.files[0])"><div id="impMsg" class="small"></div></div>`}
async function importProducts(file){const m=document.getElementById('impMsg');if(!file)return;
  try{const j=JSON.parse(await file.text());const list=Array.isArray(j)?j:j.products;
    if(!Array.isArray(list)||!list.length||!list.every(p=>p&&p.id&&(p.data||p.name)))throw new Error(L('This is not a product content file.','هذا ليس ملف محتوى منتجات.'));
    const b=DB.batch();list.forEach((p,i)=>{const data=p.data||p;const clean={...data};delete clean.id;delete clean.ready;delete clean.draft;
      b.set(DB.collection('products').doc(String(p.id)),{sort:p.sort||i+1,json:JSON.stringify(clean),updatedAt:FBTS(),updatedBy:ME.id})});
    await b.commit();if(m)m.innerHTML=`✅ ${list.length} ${L('products imported. Reloading…','منتجات تم استيرادها. جارٍ إعادة التحميل…')}`;setTimeout(()=>location.reload(),900)}
  catch(e){if(m)m.innerHTML=`<span style="color:#B23A3A">${isDenied(e)?L('Only Leadership can import content.','الاستيراد متاح للقيادة فقط.'):esc(e.message)}</span>`}}

async function startFor(u){
  ME={id:u.uid,email:u.email,name:u.displayName||''};
  if(!u.emailVerified)return verifyScreen(u);
  let prof;try{prof=await ensureProfile(u)}catch(e){return bootScreen(`<div class="note-warn">${esc(e.message)}</div>${outBtn()}`)}
  if(prof.role==='blocked')return bootScreen(`<div class="note-warn">${L('This e-mail domain is not allowed to join. Use your company e-mail or ask Leadership.','نطاق هذا البريد غير مسموح له بالانضمام. استخدم بريد الشركة أو تواصل مع القيادة.')}</div><p class="small" dir="ltr">${esc(u.email)}</p>${outBtn()}`);
  const r=prof.role;ME.name=prof.name||ME.name;
  if(r==='pending')return bootScreen(`<p>⏳ ${L('Your account is waiting for approval.','حسابك بانتظار الاعتماد.')}</p><p class="muted small">${L('Leadership will assign your access level. Reload this page once they confirm.','ستمنحك القيادة مستوى الوصول. أعد تحميل الصفحة بعد تأكيدهم.')}</p><p class="small" dir="ltr">${esc(u.email)}</p><div style="display:flex;gap:8px"><button class="btn primary" onclick="location.reload()">${L('Reload','إعادة التحميل')}</button>${outBtn()}</div>`);
  try{await loadProducts()}catch(e){return bootScreen(`<div class="note-warn">${L('Could not load product content','تعذّر تحميل محتوى المنتجات')}: ${esc(e.message)}</div>${outBtn()}`)}
  if(!PRODUCTS.length)return bootScreen(r==='leadership'?`<p>👋 ${L('Welcome — you are the first Leadership account.','مرحباً — أنت أول حساب في القيادة.')}</p><p class="muted small">${L('The database has no product content yet. Import it once to start.','لا يوجد محتوى منتجات في قاعدة البيانات بعد. استورده مرة واحدة للبدء.')}</p>${importBox()}<div style="margin-top:12px">${outBtn()}</div>`:`<p>${L('Product content has not been loaded yet. Please check back later.','لم يُحمَّل محتوى المنتجات بعد. يرجى المحاولة لاحقاً.')}</p>${outBtn()}`);
  document.getElementById('accBadge').style.display='';const av=document.getElementById('av');if(av)av.textContent=(ME.name||ME.email).trim().slice(0,2).toUpperCase();
  startApp(r);initLeads();
}
function boot(){
  try{const l=localStorage.getItem('hub-lang');if(l)lang=l}catch(e){}
  applyLang();
  const C=window.HUB_FIREBASE||{};
  if(!window.firebase||!C.apiKey||/YOUR-/.test(C.apiKey+C.projectId))return bootScreen(`<div class="note-warn">${L('The hub is not connected to its database yet. Add the Firebase web app settings in js/firebase-config.js (see README).','المركز غير متصل بقاعدة البيانات بعد. أضف إعدادات تطبيق Firebase في js/firebase-config.js (راجع README).')}</div>`);
  firebase.initializeApp(C);AUTH=firebase.auth();DB=firebase.firestore();
  try{AUTH.languageCode=lang}catch(e){}
  let started=false;
  AUTH.onAuthStateChanged(u=>{if(!u){if(started)return location.reload();return loginScreen()}if(started)return;started=true;startFor(u)});
}
boot();
