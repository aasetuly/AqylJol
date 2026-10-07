/* AqylJol — авторизация (Google / почта / телефон).
   ВАЖНО: сайт статический, сервера нет. Аккаунты хранятся только в этом браузере.
   Для настоящей защиты нужен бэкенд (проверка паролей, SMS, проверка токена Google). */
(()=>{
'use strict';
const K={users:'aq-auth-users',session:'aq-auth-session',seen:'aq-auth-seen',email:'aq-auth-email'};
const mem={};
const get=(k,f)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):f}catch{const v=mem[k];return v?JSON.parse(v):f}};
const set=(k,v)=>{mem[k]=JSON.stringify(v);try{localStorage.setItem(k,mem[k])}catch{}};
const del=k=>{delete mem[k];try{localStorage.removeItem(k)}catch{}};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=(s,r=document)=>r.querySelector(s);
const toast=t=>{const e=$('#toast');if(!e)return;e.textContent=t;clearTimeout(toast.t);toast.t=setTimeout(()=>e.textContent='',3500)};
const user=()=>get(K.session,null);
const users=()=>AqylDB.table('users');
const curCity=()=>typeof city!=='undefined'?city:'atyrau';
const initials=n=>(n||'?').trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase()||'?';
const GLOGO='<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>';

/* Настройки личного кабинета. Номер и адрес пункта выдачи замените на настоящие. */
const SUPPORT_PHONE='+7 (700) 000-00-00';
const PICKUP_ADDRESS='';   // например: 'г. Атырау, ул. Абая 1' — пока пусто, в кабинете покажется «Адрес будет добавлен позже»
const CATS={
 regular:{t:'Обычный пассажир',docs:['Удостоверение личности']},
 student:{t:'Студент',docs:['Удостоверение личности','Студенческий билет или справка с места учёбы','Фото 3×4']},
 school:{t:'Школьник',docs:['Свидетельство о рождении или удостоверение личности','Справка из школы или ученический билет','Фото 3×4']},
 pensioner:{t:'Пенсионер',docs:['Удостоверение личности','Пенсионное удостоверение','Фото 3×4']},
 benefit:{t:'Льготная категория',docs:['Удостоверение личности','Документ, подтверждающий право на льготу','Фото 3×4']}
};
const catOf=u=>{const r=u&&users().get(u.id);return r&&CATS[r.category]?r.category:'regular'};

let back,state={mode:'login',view:'main',cab:'main',email:'',pending:false,until:0,timer:null,tick:0};

const fbReady=()=>window.AqylFB?Promise.resolve(window.AqylFB):new Promise(ok=>addEventListener('aqyl-fb-ready',()=>ok(window.AqylFB),{once:true}));
const errBox=()=>back&&($('[data-err]',back)||$('[data-gerr]',back));
const setErr=m=>{const e=errBox();if(e)e.textContent=m||''};

const ERR={
 'auth/email-already-in-use':'Этот адрес уже зарегистрирован. Нажмите «Войти».',
 'auth/invalid-email':'Введите корректный адрес почты.',
 'auth/weak-password':'Пароль слишком простой: нужно не меньше 6 символов.',
 'auth/invalid-credential':'Неверная почта или пароль.',
 'auth/wrong-password':'Неверная почта или пароль.',
 'auth/user-not-found':'Неверная почта или пароль.',
 'auth/too-many-requests':'Слишком много попыток. Подождите несколько минут и повторите.',
 'auth/network-request-failed':'Нет соединения с интернетом.',
 'auth/operation-not-allowed':'Этот способ входа не включён в Firebase: Authentication → Sign-in method.',
 'auth/unauthorized-domain':'Домен «'+location.hostname+'» не добавлен в Firebase: Authentication → Settings → Authorized domains.',
 'auth/missing-password':'Введите пароль.',
 'auth/user-disabled':'Этот аккаунт отключён в Firebase.',
 'auth/password-does-not-meet-requirements':'Пароль слишком простой: добавьте цифры и буквы.',
 'auth/network-request-failed':'Нет соединения с интернетом.',
 'auth/account-exists-with-different-credential':'Эта почта уже используется с другим способом входа.'
};
const errText=e=>ERR[e&&e.code]||('Не удалось выполнить действие'+(e&&e.code?' ('+e.code+')':'')+'.');

/* Пользователь Firebase -> локальная копия сессии. Только для подтверждённой почты; false — если нельзя войти. */
function applyUser(fb){
 if(!fb.emailVerified)return false;
 const id=fb.uid,email=(fb.email||'').toLowerCase();
 const name=(fb.displayName||'').trim()||email.split('@')[0]||'Пользователь';
 const method=fb.providerData.some(p=>p.providerId==='google.com')?'google':'email';
 if(window.AqylFleet&&AqylFleet.isBlocked(id)){
  del(K.session);
  try{AqylFB.signOut(AqylFB.auth)}catch{}
  const e=errBox();if(e)e.textContent='Аккаунт заблокирован администратором.';
  toast('Аккаунт заблокирован администратором');
  return false;
 }
 const t=users(),ex=t.get(id);
 t.set(id,{...(ex||{}),id,method,name,email,city:ex?.city||curCity(),created:ex?.created||Date.now(),last:Date.now()});
 set(K.session,{id,name,contact:email,method});
 set(K.seen,1);
 return true;
}

async function watch(){
 const fb=await fbReady();
 fb.onAuthStateChanged(fb.auth,fu=>{
  if(fu&&fu.emailVerified){
   if(applyUser(fu)){
    const explicit=state.pending;state.pending=false;
    stopTimer();state.view='main';
    if(back&&!back.hidden)close();
    refresh();
    if(explicit)toast('Вы вошли как '+user().name);
   }
  }else{
   /* не вошёл, либо почта ещё не подтверждена — на сайте сессии нет */
   if(!fu)state.pending=false;
   if(user())del(K.session);
   refresh();
  }
 });
}

/* ---------- подтверждение почты (письмо со ссылкой от Firebase) ---------- */
async function sendVerify(u){
 const fb=window.AqylFB;
 try{await fb.sendEmailVerification(u,{url:location.origin+location.pathname})}
 catch(e){
  if(e&&(e.code==='auth/unauthorized-continue-uri'||e.code==='auth/invalid-continue-uri'))await fb.sendEmailVerification(u);
  else throw e;
 }
 state.until=Date.now()+60000;
}
function showVerify(email){state.view='verify';state.email=email;render();startTimer()}
async function checkVerified(manual){
 const fb=window.AqylFB,cu=fb&&fb.auth.currentUser;
 if(!cu)return;
 try{await cu.reload()}catch(e){if(manual)setErr(errText(e));return}
 if(cu.emailVerified){
  try{await cu.getIdToken(true)}catch{} /* обновить токен: в нём claim email_verified нужен правилам базы */
  stopTimer();state.pending=true;
  if(applyUser(cu)){window.dispatchEvent(new Event('aq-auth-verified'));state.pending=false;state.view='main';close();refresh();toast('Почта подтверждена. Вы вошли как '+user().name)}
 }else if(manual)setErr('Почта пока не подтверждена. Откройте письмо и нажмите на ссылку, затем повторите.');
}
function startTimer(){
 stopTimer();state.tick=0;
 state.timer=setInterval(()=>{
  if(!back||back.hidden||state.view!=='verify'){stopTimer();return}
  const b=$('[data-resend]',back);
  if(b){const s=Math.ceil((state.until-Date.now())/1000);b.disabled=s>0;b.textContent=s>0?'Отправить письмо ещё раз ('+s+' с)':'Отправить письмо ещё раз'}
  if(++state.tick%3===0)checkVerified(false);
 },1000);
}
function stopTimer(){if(state.timer){clearInterval(state.timer);state.timer=null}}

async function resend(){
 const cu=window.AqylFB&&AqylFB.auth.currentUser;if(!cu)return;
 if(Date.now()<state.until)return;
 setErr('');
 try{await sendVerify(cu);setErr('');const n=$('[data-note]',back);if(n)n.textContent='Письмо отправлено ещё раз. Проверьте почту и папку «Спам».'}
 catch(e){setErr(errText(e))}
}
async function otherEmail(){
 stopTimer();
 try{if(window.AqylFB)await AqylFB.signOut(AqylFB.auth)}catch{}
 state.view='main';state.mode='register';render();
}

/* ---------- вход ---------- */
async function loginGoogle(){
 setErr('');
 if(location.protocol==='file:')return setErr('Откройте сайт через http:// или https:// (локальный сервер или GitHub Pages). С file:// вход не работает.');
 const fb=window.AqylFB;
 if(!fb)return setErr('Firebase ещё не загрузился. Проверьте интернет и попробуйте снова.');
 const btn=$('[data-google]',back);if(btn)btn.disabled=true;
 const provider=new fb.GoogleAuthProvider();
 provider.setCustomParameters({prompt:'select_account'});
 try{
  state.pending=true;
  await fb.signInWithPopup(fb.auth,provider);
 }catch(e){
  state.pending=false;
  const c=e&&e.code||'';
  if(c==='auth/popup-closed-by-user'||c==='auth/cancelled-popup-request'){/* человек закрыл окно */}
  else if(c==='auth/popup-blocked'||c==='auth/operation-not-supported-in-this-environment'){
   try{state.pending=true;await fb.signInWithRedirect(fb.auth,provider);return}catch{state.pending=false;setErr('Браузер заблокировал окно входа. Разрешите всплывающие окна для сайта и повторите.')}
  }
  else if(c==='auth/operation-not-allowed')setErr('Вход через Google не включён в Firebase: Authentication → Sign-in method → Google.');
  else setErr(errText(e));
 }finally{
  const b2=back&&$('[data-google]',back);if(b2)b2.disabled=false;
 }
}

async function submitEmail(form){
 const fb=window.AqylFB,fd=new FormData(form);
 const name=(fd.get('name')||'').trim(),email=String(fd.get('email')||'').trim().toLowerCase(),pass=String(fd.get('pass')||'');
 setErr('');
 if(location.protocol==='file:')return setErr('Откройте сайт через http:// или https:// (локальный сервер или GitHub Pages). С file:// вход не работает.');
 if(!fb)return setErr('Firebase ещё не загрузился. Проверьте интернет и попробуйте снова.');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))return setErr('Введите корректный адрес почты.');
 if(pass.length<6)return setErr('Пароль должен быть не короче 6 символов.');
 try{
  if(state.mode==='register'){
   let c;
   try{c=await fb.createUserWithEmailAndPassword(fb.auth,email,pass)}
   catch(e){
    if(e&&e.code==='auth/email-already-in-use'){
     /* адрес уже есть (часто — регистрация не была подтверждена): пробуем войти с тем же паролем */
     try{
      state.pending=true;
      const r=await fb.signInWithEmailAndPassword(fb.auth,email,pass);
      if(!r.user.emailVerified){state.pending=false;try{await sendVerify(r.user)}catch{}showVerify(email)}
      return;
     }catch(e2){state.pending=false;setErr('Этот адрес уже зарегистрирован. Войдите с прежним паролем или нажмите «Забыли пароль?».');state.mode='login';return}
    }
    throw e;
   }
   if(name){try{await fb.updateProfile(c.user,{displayName:name})}catch{}}
   try{await sendVerify(c.user)}catch(e){state.view='verify';state.email=email;render();setErr('Аккаунт создан, но письмо не отправилось: '+errText(e)+' Нажмите «Отправить письмо ещё раз».');startTimer();return}
   showVerify(email);
  }else{
   state.pending=true;
   const c=await fb.signInWithEmailAndPassword(fb.auth,email,pass);
   if(!c.user.emailVerified){state.pending=false;try{await sendVerify(c.user)}catch{}showVerify(email)} /* почта не подтверждена: сайт не пускает, пока не нажата ссылка */
  }
 }catch(e){state.pending=false;setErr(errText(e))}
}
async function submitReset(form){
 const fb=window.AqylFB,email=String(new FormData(form).get('email')||'').trim().toLowerCase();
 setErr('');
 if(!fb)return setErr('Firebase ещё не загрузился. Проверьте интернет и попробуйте снова.');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))return setErr('Введите корректный адрес почты.');
 try{await fb.sendPasswordResetEmail(fb.auth,email);const n=$('[data-note]',back);if(n)n.textContent='Если такая почта зарегистрирована, мы отправили на неё письмо со ссылкой для смены пароля. Проверьте и папку «Спам».'}
 catch(e){setErr(errText(e))}
}

async function logout(){
 del(K.session);stopTimer();
 try{if(window.AqylFB)await AqylFB.signOut(AqylFB.auth)}catch{}
 close();refresh();toast('Вы вышли из аккаунта');
}

/* ---------- окно ---------- */
function render(){
 const u=user();
 if(u){
  const cat=catOf(u),ph=SUPPORT_PHONE.replace(/[^\d+]/g,'');
  let body;
  if(state.cab==='card'){
   const c=CATS[cat];
   body=`<button class="au-link au-backlink" data-cab="main">← Личный кабинет</button>
   <h2 id="au-t">Получить карточку</h2>
   <p class="au-sub">Категория: <b>${esc(c.t)}</b></p>
   <div class="au-demo"><b>Обратитесь в ближайший пункт выдачи</b> и возьмите с собой документы:</div>
   <ul class="au-docs">${c.docs.map(d=>`<li>${esc(d)}</li>`).join('')}</ul>
   <div class="au-addr"><span>Адрес пункта выдачи</span><b>${PICKUP_ADDRESS?esc(PICKUP_ADDRESS):'Будет добавлен позже'}</b></div>
   <button class="au-submit" data-cab="main">Готово</button>`;
  }else{
   body=`<div class="au-profile"><span class="au-avatar">${esc(initials(u.name))}</span><div><strong id="au-t">${esc(u.name)}</strong><span>${esc(u.contact)}</span></div></div>
   <h3 class="au-h3">Категория пассажира</h3>
   <div class="au-cats" role="radiogroup" aria-label="Категория пассажира">${Object.entries(CATS).map(([k,v])=>`<button type="button" role="radio" aria-checked="${k===cat}" class="au-cat${k===cat?' on':''}" data-cat="${k}">${esc(v.t)}</button>`).join('')}</div>
   <p class="au-sub" style="font-size:12px;margin-top:8px">Право на льготу подтверждается документами при получении карточки.</p>
   <button class="au-submit" data-cab="card">Получить карточку</button>
   <h3 class="au-h3">Техподдержка</h3>
   <a class="au-phone" href="tel:${ph}"><span>Позвонить</span><b>${esc(SUPPORT_PHONE)}</b></a>
   <a class="au-link" href="settings.html">Написать в поддержку</a>
   <p class="au-sub" style="font-size:12px;margin:14px 0 0">Вход выполнен через ${u.method==='google'?'Google':'почту'}. Избранное и поездки сохраняются на этом устройстве.</p>
   <button class="au-out" data-logout>Выйти</button>`;
  }
  back.innerHTML=`<div class="au-modal" role="dialog" aria-modal="true" aria-labelledby="au-t"><button class="au-close" aria-label="Закрыть" data-close>×</button>${body}</div>`;
  return;
 }
 const head=`<button class="au-close" aria-label="Закрыть" data-close>×</button><div class="au-logo"><img src="aqyljol-icon.svg" alt=""><span>Aqyl<b>Jol</b></span></div>`;
 let body='';
 if(state.view==='verify'){
  const s=Math.max(0,Math.ceil((state.until-Date.now())/1000));
  body=`<h2 id="au-t">Подтвердите почту</h2>
  <p class="au-sub">Мы отправили письмо на <b>${esc(state.email)}</b>. Откройте его и нажмите на ссылку подтверждения, затем вернитесь сюда: вход завершится автоматически. Если письма нет, проверьте папку «Спам».</p>
  <div class="au-demo" data-note></div>
  <div class="au-err" role="alert" data-err></div>
  <button class="au-submit" data-check>Я подтвердил(а) почту</button>
  <button class="au-link" data-resend ${s>0?'disabled':''}>Отправить письмо ещё раз${s>0?' ('+s+' с)':''}</button>
  <button class="au-link" data-other>Использовать другую почту</button>`;
 }else if(state.view==='reset'){
  body=`<h2 id="au-t">Сброс пароля</h2>
  <p class="au-sub">Введите почту аккаунта, и мы пришлём ссылку для смены пароля.</p>
  <form data-form="reset" novalidate>
   <label class="au-field">Почта<input name="email" type="email" inputmode="email" autocomplete="email" placeholder="name@example.com" value="${esc(state.email||'')}"></label>
   <div class="au-demo" data-note></div>
   <div class="au-err" role="alert" data-err></div>
   <button class="au-submit" type="submit">Отправить ссылку</button></form>
  <button class="au-link" data-back>Назад ко входу</button>`;
 }else{
  const reg=state.mode==='register';
  body=`<h2 id="au-t">${reg?'Создайте аккаунт':'Добро пожаловать'}</h2>
  <p class="au-sub">Войдите, чтобы сохранять маршруты и поездки.</p>
  <button class="au-google" data-google>${GLOGO} Продолжить с Google</button>
  <div class="au-gerr au-err" role="alert" data-gerr></div>
  <div class="au-or">ИЛИ</div>
  <form data-form="email" novalidate>
   ${reg?'<label class="au-field">Имя (необязательно)<input name="name" autocomplete="name" maxlength="40" placeholder="Можно не указывать"></label>':''}
   <label class="au-field">Почта<input name="email" type="email" inputmode="email" autocomplete="email" placeholder="name@example.com"></label>
   <label class="au-field au-pass">Пароль<input name="pass" type="password" autocomplete="${reg?'new-password':'current-password'}" placeholder="Не короче 6 символов"><button type="button" class="au-eye" data-eye>Показать</button></label>
   <div class="au-err" role="alert" data-err></div>
   <button class="au-submit" type="submit">${reg?'Создать аккаунт':'Войти'}</button></form>
  ${reg?'<p class="au-sub" style="font-size:12px">После регистрации мы отправим письмо со ссылкой: аккаунт заработает, когда вы подтвердите почту.</p>':'<button class="au-link" data-forgot>Забыли пароль?</button>'}
  <p class="au-switch">${reg?'Уже есть аккаунт?':'Нет аккаунта?'} <button data-mode="${reg?'login':'register'}">${reg?'Войти':'Зарегистрироваться'}</button></p>`;
 }
 back.innerHTML=`<div class="au-modal" role="dialog" aria-modal="true" aria-labelledby="au-t">${head}${body}<button class="au-link" data-close>Продолжить без входа</button></div>`;
 const f=$('input',back);if(f&&!matchMedia('(pointer:coarse)').matches)f.focus();
}

function open(){
 if(!back)build();
 const cu=window.AqylFB&&AqylFB.auth.currentUser;
 if(cu&&!cu.emailVerified&&!user()){state.view='verify';state.email=cu.email||state.email;render();startTimer()}
 else{state.view='main';state.mode='login';state.cab='main';render()}
 back.hidden=false;document.body.style.overflow='hidden';back._prev=document.activeElement;
}
function close(){
 if(!back||back.hidden)return;back.hidden=true;document.body.style.overflow='';stopTimer();set(K.seen,1);back._prev?.focus?.();
}
function build(){
 back=document.createElement('div');back.className='au-back';back.hidden=true;document.body.append(back);
 back.addEventListener('mousedown',e=>{if(e.target===back)close()});
 back.addEventListener('click',e=>{
  const t=e.target.closest('[data-close],[data-logout],[data-google],[data-mode],[data-eye],[data-check],[data-resend],[data-other],[data-forgot],[data-back],[data-cab],[data-cat]');if(!t)return;
  const d=t.dataset;
  if('close'in d)close();
  else if('logout'in d)logout();
  else if('google'in d)loginGoogle();
  else if(d.mode){state.mode=d.mode;render()}
  else if('eye'in d){const i=t.parentElement.querySelector('input');const h=i.type==='password';i.type=h?'text':'password';t.textContent=h?'Скрыть':'Показать'}
  else if('check'in d)checkVerified(true);
  else if('resend'in d)resend();
  else if('other'in d)otherEmail();
  else if('forgot'in d){state.view='reset';render()}
  else if('back'in d){state.view='main';render()}
  else if(d.cab){state.cab=d.cab;render()}
  else if(d.cat&&CATS[d.cat]){const u=user();if(u){users().update(u.id,{category:d.cat});render();toast('Категория: '+CATS[d.cat].t)}}
 });
 back.addEventListener('submit',async e=>{
  e.preventDefault();const f=e.target,b=$('.au-submit',f);if(b)b.disabled=true;
  try{if(f.dataset.form==='email')await submitEmail(f);else if(f.dataset.form==='reset')await submitReset(f)}finally{const b2=$('.au-submit',back);if(b2)b2.disabled=false}
 });
 document.addEventListener('keydown',e=>{
  if(back.hidden)return;
  if(e.key==='Escape')close();
  if(e.key==='Tab'){const els=[...back.querySelectorAll('button:not([disabled]),input,a[href]')].filter(x=>x.offsetParent);if(!els.length)return;const a=els[0],z=els[els.length-1];
   if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}}
 });
}

const PERSON='M20 21a8 8 0 0 0-16 0M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z';
function refresh(){
 const u=user();
 const btn=$('#au-open');
 if(btn)btn.innerHTML=u?`<span class="au-avatar">${esc(initials(u.name))}</span><span class="au-label">${esc(u.name.split(' ')[0])}</span>`:`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${PERSON}"/></svg><span class="au-label">Войти</span>`;
 const card=$('#au-card');
 if(card)card.innerHTML=u?`<div class="au-profile"><span class="au-avatar">${esc(initials(u.name))}</span><div><strong>${esc(u.name)}</strong><span>${esc(u.contact)} · ${esc(CATS[catOf(u)].t)}</span></div></div><button class="au-btn" data-au-open>Личный кабинет</button>`
  :`<div><strong>Вы не вошли</strong><br><span style="font-size:12px;color:var(--muted)">Войдите через Google или почту</span></div><button class="au-btn" data-au-open>Войти</button>`;
}
document.addEventListener('DOMContentLoaded',()=>{
 const header=$('#header');
 if(header){const slot=document.createElement('div');slot.className='au-slot';slot.innerHTML='<button class="au-btn" id="au-open" aria-haspopup="dialog"></button>';header.append(slot)}
 if(document.body.dataset.page==='settings'){
  const h=$('.pageheading'),card=document.createElement('section');card.id='au-card';card.className='card au-card';(h||$('#app')).after(card);
 }
 document.addEventListener('click',e=>{if(e.target.closest('#au-open,[data-au-open]'))open()});
 refresh();
 watch();
 if(document.body.dataset.page==='home'&&!user()&&!get(K.seen,0)){const go=()=>setTimeout(open,700);document.documentElement.classList.contains('splash-on')?window.addEventListener('splash-done',go,{once:true}):go()}
});
window.AqylAuth={open,logout,user};
})();
