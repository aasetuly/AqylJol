/* AqylJol — кабинет водителя, диспетчерская и ночное расписание.
   ВАЖНО: сайта-сервера нет, всё хранится в localStorage этого браузера (как и аккаунты в auth.js).
   Роли и блокировки работают в пределах одного браузера. Для настоящей защиты нужен бэкенд. */
(()=>{
'use strict';
/* Почты из OWNERS автоматически получают роль РАЗРАБОТЧИК (все функции). Должна совпадать с OWNER_EMAIL в firestore.rules.
   Остальных разработчиков, диспетчеров и водителей назначает разработчик: Диспетчер → Люди → «Роль». */
const OWNERS=['aasetuly25@apec.edu.kz'];
const K={roles:'aq-fleet-roles',people:'aq-fleet-people',status:'aq-fleet-status',sched:'aq-fleet-sched',log:'aq-fleet-log',clock:'aq-fleet-clock',session:'aq-auth-session',users:'aq-auth-users',tickets:'aq-db-tickets',bus:'aq-fleet-bus'};
const DEF_END={'14':'21:00','30':'21:00','12':'21:00','5':'21:00','21':'21:00','8':'21:00','45':'23:00','17':'23:00'}; // большинство завершает в 21:00
const DEF_START='06:00';
const STOP_REASONS=['Остановка','Посадка пассажиров','Перерыв','Поломка','ДТП'];
let reason=STOP_REASONS[0],lastKey='',lastN=-1,cityFilter='cur';
const mem={};
const rd=(k,f)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):f}catch{const v=mem[k];return v?JSON.parse(v):f}};
const wr=(k,v)=>{mem[k]=JSON.stringify(v);try{localStorage.setItem(k,mem[k])}catch{}};
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const page=document.body.dataset.page||'home';
const say=t=>{const e=$('#toast');if(!e)return;e.textContent=t;clearTimeout(say.t);say.t=setTimeout(()=>e.textContent='',3500)};
const curCity=()=>typeof city!=='undefined'?city:'atyrau';
const cname=id=>typeof CITIES!=='undefined'&&CITIES[id]?CITIES[id].name:(id||'');
const cityName=()=>cname(curCity());
const linkTo=f=>typeof url==='function'?url(f):f;
const me=()=>rd(K.session,null);
const initials=n=>(n||'?').trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase()||'?';

/* ---------- время ---------- */
const toMin=s=>{const m=/^(\d{1,2}):(\d{2})$/.exec(s||'');return m&&+m[1]<24&&+m[2]<60?+m[1]*60+ +m[2]:null};
const fmtMin=m=>pad(Math.floor(m/60))+':'+pad(m%60);
const today=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
function testClock(){const c=rd(K.clock,null);if(!c||!c.on)return null;return ((c.base+Math.floor((Date.now()-c.since)/60000))%1440+1440)%1440}
function nowMin(){const t=testClock();if(t!==null)return t;const d=new Date();return d.getHours()*60+d.getMinutes()}
function nowSec(){const t=testClock();if(t!==null){const c=rd(K.clock,null);return t*60+Math.floor(((Date.now()-c.since)%60000)/1000)}const d=new Date();return nowMin()*60+d.getSeconds()}
const dur=s=>{s=Math.max(0,Math.round(s));const h=Math.floor(s/3600),m=Math.floor(s%3600/60);return h?h+' ч '+pad(m)+' мин':m?m+' мин '+pad(s%60)+' с':s+' с'};
const when=ts=>new Date(ts).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});

/* ---------- расписание ---------- */
function sched(id,c){const all=rd(K.sched,{}),s=all[(c||curCity())+':'+id]||all[id]||{};return{start:s.start||DEF_START,end:s.end||DEF_END[id]||'21:00',mode:s.mode||'auto'}}
function inWindow(m,sc){const a=toMin(sc.start),b=toMin(sc.end);if(a===null||b===null||a===b)return true;return a<b?m>=a&&m<b:m>=a||m<b}
const MODES={auto:'По расписанию',on:'Всегда работает',off:'Остановлен'};

/* ---------- роли и люди ---------- */
const roles=()=>rd(K.roles,{});
const roleOf=uid=>roles()[uid]||{role:'user',bus:null,blocked:false};
const isBlocked=uid=>!!roleOf(uid).blocked;
const isDev=u=>!!u&&roleOf(u.id).role==='dev'&&!isBlocked(u.id);
const isOwner=u=>!!u&&['owner','dev'].includes(roleOf(u.id).role)&&!isBlocked(u.id); // главный диспетчер и разработчик видят все города
const isAdmin=u=>!!u&&['admin','owner','dev'].includes(roleOf(u.id).role)&&!isBlocked(u.id);
const ROLE_NAMES={user:'Пассажир',driver:'Водитель',admin:'Диспетчер города',owner:'Главный диспетчер',dev:'Разработчик'};
const canManage=u=>isOwner(u)||(isAdmin(u)&&roleOf(u.id).city===curCity()); // городской диспетчер работает только в своём городе
function everyone(){
 const out={},au=rd(K.users,{});
 for(const[id,u]of Object.entries(au))out[id]={id,name:u.name||(u.email?u.email.split('@')[0]:'Пользователь'),contact:u.email||(u.phone?'+'+u.phone:''),city:u.city,userId:u.userId||''};
 for(const[id,u]of Object.entries(rd(K.people,{})))out[id]={...out[id],...u,userId:(out[id]&&out[id].userId)||u.userId||''};
 for(const[id,r]of Object.entries(roles()))if(!out[id])out[id]={id,name:r.name||id,contact:r.contact||'',city:r.city};
 return Object.values(out).sort((a,b)=>a.name.localeCompare(b.name,'ru'));
}
function register(){
 const u=me();if(!u||isBlocked(u.id))return;
 const c=roleOf(u.id).city||curCity(),p=rd(K.people,{}),o=p[u.id];
 if(!o||o.name!==u.name||o.contact!==u.contact||o.city!==c){p[u.id]={id:u.id,name:u.name,contact:u.contact,city:c,seen:Date.now()};wr(K.people,p)}
 ensureOwner(u);
}
/* Разработчик назначается автоматически по почте из OWNERS. Главные диспетчеры (owner) и остальные роли выдаёт разработчик.
   Если OWNERS пуст — работает прежняя схема: первый аккаунт становится главным диспетчером. */
function ensureOwner(u){
 const all=roles(),ent=Object.entries(all);
 const listed=OWNERS.some(x=>{x=String(x).toLowerCase().trim();return x&&x.includes('@')&&String(u.contact||'').toLowerCase()===x});
 if(listed){
  if((all[u.id]||{}).role==='dev'&&!(all[u.id]||{}).blocked)return;
  all[u.id]={...(all[u.id]||{}),role:'dev',bus:null,blocked:false,name:u.name,contact:u.contact,city:(all[u.id]||{}).city||curCity()};
  wr(K.roles,all);log((u.name||u.id)+' — разработчик');return;
 }
 if(ent.some(([,r])=>r.role==='owner'||r.role==='dev'))return;
 const legacy=ent.find(([,r])=>r.role==='admin');
 let make=null;
 if(OWNERS.length)make=null;
 else if(legacy)make=legacy[0];
 else if(Object.keys(rd(K.users,{})).length<=1)make=u.id;
 if(!make)return;
 all[make]={...(all[make]||{}),role:'owner',bus:null,blocked:false,...(make===u.id?{name:u.name,contact:u.contact}:{})};
 for(const[id,r]of Object.entries(all))if(r.role==='admin'&&!r.city)all[id]={...r,city:curCity()};
 wr(K.roles,all);log((all[make].name||make)+' — главный диспетчер');
}
function enforce(){const u=me();if(!u||!isBlocked(u.id))return;if(window.AqylAuth?.logout)AqylAuth.logout();else try{localStorage.removeItem(K.session)}catch{}setTimeout(()=>say('Ваш аккаунт заблокирован диспетчером'),30)}
function log(text){const l=rd(K.log,[]);l.unshift({t:Date.now(),text,city:curCity()});wr(K.log,l.slice(0,500))}

/* ---------- данные водителя по автобусу: кондиционер и объявления остановок ---------- */
const hhmm=ts=>{const d=new Date(ts);return pad(d.getHours())+':'+pad(d.getMinutes())};
const busRec=(c,id)=>rd(K.bus,{})[c+':'+id]||{};
function busPut(id,patch,c){c=c||curCity();const all=rd(K.bus,{}),k=c+':'+id;all[k]={...(all[k]||{}),...patch};wr(K.bus,all)}
const ANN_KINDS=[['next','Следующая остановка'],['here','Стою на остановке'],['skip','Проезжаю без остановки'],['demand','Остановка по требованию'],['late','Задерживаюсь на остановке'],['final','Конечная, выходим']];
const ANN_TTL=30*60*1000; // объявление показывается пассажирам 30 минут
const annKindName=k=>(ANN_KINDS.find(x=>x[0]===k)||['',''])[1];
const annText=a=>annKindName(a.kind)+(a.stop!=null&&cname&&typeof CITIES!=='undefined'&&CITIES[a.city||curCity()]?': «'+CITIES[a.city||curCity()].stops[a.stop]+'»':'')+(a.note?' — '+a.note:'');
const activeAnn=rec=>rec&&rec.ann&&Date.now()-rec.ann.at<ANN_TTL?rec.ann:null;
function setAC(busId,on){
 const u=me();if(!u)return false;
 busPut(busId,{ac:on===null?null:!!on,acAt:Date.now(),acBy:u.name});
 log(u.name+' · №'+busId+' · '+cityName()+': кондиционер '+(on===null?'сброшен':on?'включён':'выключен'));return true;
}
function sendAnn(busId,stop,kind,note){
 const u=me();if(!u)return false;
 const c=curCity(),rec=busRec(c,busId),a={stop:Number(stop),kind,note:String(note||'').trim().slice(0,100),at:Date.now(),by:u.name,city:c};
 const anns=[a,...(Array.isArray(rec.anns)?rec.anns:[])].slice(0,8);
 busPut(busId,{ann:a,anns});
 log(u.name+' · №'+busId+' · '+cityName()+': объявление — '+annText(a));return true;
}
function clearAnn(busId){const u=me();busPut(busId,{ann:null});if(u)log(u.name+' · №'+busId+' · '+cityName()+': объявление снято')}

/* ---------- статус автобуса ---------- */
const skey=(c,id)=>c+':'+id;
const rawStatus=(c,id)=>rd(K.status,{})[skey(c,id)]||null;
function info(b,c){
 const id=typeof b==='object'?b.id:String(b);c=c||curCity();
 const sc=sched(id,c),m=nowMin(),rec=rawStatus(c,id),live=rec&&rec.day===today()?rec:null;
 const inWin=sc.mode==='on'?true:sc.mode==='off'?false:inWindow(m,sc);
 const base={id,start:sc.start,end:sc.end,mode:sc.mode,rec:live,driver:live?.name||''};
 if(!inWin)return{...base,off:true,night:sc.mode==='auto',why:sc.mode==='off'?'Маршрут остановлен диспетчером':'Рейсы закончились в '+sc.end+' · возобновятся в '+sc.start};
 if(live&&live.state==='offline')return{...base,off:true,why:'Водитель завершил смену'+(live.name?' ('+live.name+')':'')};
 if(live&&live.state==='stopped')return{...base,stopped:true,reason:live.reason||'Остановка'};
 return{...base,moving:true,state:live?live.state:'auto'};
}
function setState(busId,state,reason){
 const u=me();if(!u)return false;
 const c=curCity(),all=rd(K.status,{}),k=skey(c,busId),old=all[k]||{},sim=typeof AqylSim!=='undefined'?AqylSim.now():0;
 let lost=old.lost||0;
 if(old.state==='stopped'&&typeof old.simStop==='number')lost+=Math.max(0,sim-old.simStop);
 const rec={state,reason:reason||'',uid:u.id,name:u.name,day:today(),at:Date.now(),lost};
 if(state==='stopped')rec.simStop=sim;
 all[k]=rec;wr(K.status,all);
 const t={moving:'начал движение',stopped:'стоит ('+(reason||'остановка')+')',offline:'завершил смену',auto:'сброс статуса (авто)'}[state];
 log(u.name+' · №'+busId+' · '+cityName()+': '+t);
 return true;
}

/* Заморозка симуляции, пока водитель отметил «Стою» (общая для карты, ETA и уведомлений) */
function hook(){
 if(typeof fleetMotion==='undefined'||typeof AqylSim==='undefined'||fleetMotion.__fleet)return;
 const orig=fleetMotion.sample.bind(fleetMotion);
 fleetMotion.sample=function(bus,seconds){
  const rec=rawStatus(curCity(),bus.id);let eff=seconds,frozen=false;
  if(rec){eff-=rec.lost||0;if(rec.state==='stopped'&&rec.day===today()&&typeof rec.simStop==='number'){eff-=Math.max(0,AqylSim.now()-rec.simStop);frozen=true}}
  const r=orig(bus,eff);
  if(frozen){r.kmh=0;r.waiting=true;r.light=false;r.driverStop=true;r.reason=rec.reason}
  return r;
 };
 fleetMotion.__fleet=true;
}

/* ---------- иконки и навигация ---------- */
const svg=p=>`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${p}"/></svg>`;
const WHEEL='M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm-9 2h7m4 0h7m-9 2v7';
const SHIELD='M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Zm-3 9 2 2 4-4';
function navLinks(){
 const nav=$('#nav');if(!nav)return;
 nav.querySelectorAll('[data-fl]').forEach(e=>e.remove());
 const u=me(),r=u?roleOf(u.id):null,items=[];
 if(r&&r.role==='driver')items.push(['driver','driver.html',WHEEL,'Водитель']);
 if(u&&isAdmin(u)){const n=openTickets()+openCards();items.push(['admin','admin.html',SHIELD,(isDev(u)?'Разработчик':'Диспетчер')+(n?` <b class="fl-nb">${n}</b>`:'')])}
 const anchors=[...nav.querySelectorAll(':scope > a')];const last=anchors[anchors.length-1];
 let ref=last;
 for(const[id,file,p,label]of items){
  const a=document.createElement('a');a.dataset.fl='1';a.href=linkTo(file);if(id===page){a.className='active';a.setAttribute('aria-current','page')}
  a.innerHTML=svg(p)+'<span>'+label+'</span>';
  if(ref)ref.after(a);else nav.append(a);ref=a;
 }
}

/* ---------- пассажирская часть: плашки, маркеры, ночной баннер ---------- */
function decorate(){
 if(typeof BUSES==='undefined')return;
 document.querySelectorAll('.buscard').forEach(card=>{
  const id=card.querySelector('.route-number')?.textContent.trim();const b=id&&BUSES.find(x=>x.id===id);if(!b)return;
  const i=info(b);let el=card.querySelector('.fl-badge');
  let html=i.off?`<span class="fl-pill fl-pill-off">${i.night?'🌙':'⛔'} ${esc(i.why)}</span>`:i.stopped?`<span class="fl-pill fl-pill-stop">⏸ Стоит: ${esc(i.reason)}</span>`:i.rec&&i.rec.state==='moving'?`<span class="fl-pill fl-pill-go">▶ В движении (отметка водителя)</span>`:'';
  if(!i.off){
   const br=busRec(curCity(),b.id),an=activeAnn(br);
   if(br.ac===true)html+=`<span class="fl-pill fl-pill-ac">❄ Кондиционер включён</span>`;
   else if(br.ac===false)html+=`<span class="fl-pill fl-pill-noac">Кондиционер выключен</span>`;
   if(an)html+=`<span class="fl-pill fl-pill-ann">📢 ${esc(annText(an))} · ${hhmm(an.at)}</span>`;
  }
  card.classList.toggle('fl-off',!!i.off);
  if(!html){if(el)el.remove();return}
  if(!el){el=document.createElement('div');el.className='fl-badge';const h=card.querySelector('.bushead');if(h)h.after(el);else card.prepend(el)}
  if(el.dataset.k!==html){el.dataset.k=html;el.innerHTML=html}
 });
 supportCard();
 document.querySelectorAll('.bus-pin').forEach(p=>{
  const id=p.querySelector('.mapmarker b')?.textContent.trim();const b=id&&BUSES.find(x=>x.id===id);if(!b)return;
  const i=info(b);p.style.display=i.off?'none':'';p.classList.toggle('fl-stopped',!!i.stopped);
 });
 nightBanner();
}
function nightBanner(){
 if(!['home','routes','map'].includes(page)||typeof BUSES==='undefined')return;
 const off=BUSES.filter(b=>{const i=info(b);return i.off&&i.night});
 let el=$('#fl-night');
 if(!off.length){if(el)el.remove();return}
 const text=`🌙 Ночной режим: работают ${BUSES.length-off.length} из ${BUSES.length} маршрутов. ${off.length} завершили рейсы (№${off.map(b=>b.id).join(', ')}) и вернутся утром.`;
 if(!el){el=document.createElement('div');el.id='fl-night';el.className='fl-night';el.setAttribute('role','status');const h=$('.pageheading');if(h)h.after(el);else $('#app')?.prepend(el)}
 if(el.textContent!==text)el.textContent=text;
}

/* ---------- страницы: общие куски ---------- */
let root;
const card=h=>`<section class="card fl-card">${h}</section>`;
const loginCard=t=>card(`<h2>Войдите в аккаунт</h2><p class="muted">${t}</p><button class="primary fl-wide" data-au-open>Войти</button>`);

/* ---------- кабинет водителя ---------- */
function driverView(){
 const u=me();
 if(!u)return loginCard('Кабинет водителя доступен после входа.');
 const r=roleOf(u.id);
 if(r.role==='admin'||r.role==='owner')return card(`<h2>Вы диспетчер</h2><p class="muted">Управление автобусами и водителями — на странице диспетчерской.</p><a class="primary fl-wide" href="${linkTo('admin.html')}">Открыть диспетчерскую</a>`);
 if(r.role!=='driver')return card(`<h2>Доступ не выдан</h2><p class="muted">Аккаунт «${esc(u.name)}» не назначен водителем. Попросите диспетчера выдать вам роль водителя и автобус.</p>`);
 const b=typeof BUSES!=='undefined'&&BUSES.find(x=>x.id===r.bus);
 if(!b)return card(`<h2>Автобус не назначен</h2><p class="muted">Диспетчер ещё не закрепил за вами маршрут.</p>`)+dmCard(u,null);
 const i=info(b),sc=sched(b.id);
 const pill=i.off?['off','Не в рейсе']:i.stopped?['stop','Стою · '+i.reason]:i.rec&&i.rec.state==='moving'?['go','В движении']:['idle','Смена не начата'];
 const closed=i.off&&(i.night||sc.mode==='off');
 const logs=rd(K.log,[]).filter(l=>l.text.startsWith(u.name+' ·')).slice(0,6);
 return `<section class="card fl-card fl-driver" style="--accent:${b.color}">
  <div class="fl-bushead"><span class="route-number">${esc(b.id)}</span><div><strong>${esc(b.name)}</strong><span class="muted">${esc(cityName())} · ${esc(u.name)}</span></div></div>
  <div class="fl-status fl-status-${pill[0]}" id="fl-status"><b>${esc(pill[1])}</b><small id="fl-since"></small></div>
  <p class="fl-window" id="fl-window"></p>
  ${closed?`<div class="fl-warn">${i.night?'🌙':'⛔'} ${esc(i.why)}. Отметки отключены.</div>`:''}
  <div class="fl-group"><span class="fl-label">Причина остановки</span><div class="fl-chips" role="group" aria-label="Причина остановки">${STOP_REASONS.map(x=>`<button class="chip ${x===reason?'active':''}" data-fl-reason="${esc(x)}" aria-pressed="${x===reason}">${esc(x)}</button>`).join('')}</div></div>
  <div class="fl-bigbtns">
   <button class="fl-big fl-go" data-fl-drv="moving" ${closed?'disabled':''}><span>▶</span>Начал движение</button>
   <button class="fl-big fl-stop" data-fl-drv="stopped" ${closed?'disabled':''}><span>⏸</span>Стою</button>
  </div>
  <button class="fl-btn fl-end" data-fl-drv="offline" ${closed||(i.rec&&i.rec.state==='offline')?'disabled':''}>Завершить смену</button>
  <p class="fl-note">Пассажиры сразу видят вашу отметку на карте и в карточке маршрута (в этом браузере).</p>
 </section>
 ${busTools(b,closed)}
 <section class="card fl-card"><h2>Мои последние отметки</h2>${logs.length?`<ul class="fl-log">${logs.map(l=>`<li><time>${when(l.t)}</time>${esc(l.text.replace(u.name+' · ',''))}</li>`).join('')}</ul>`:'<p class="muted">Пока нет отметок.</p>'}</section>`+dmCard(u,b);
}
let annKind='next',annStop=null,annNote='';
function busTools(b,closed){
 const c=curCity(),rec=busRec(c,b.id),ac=rec.ac,stops=[...new Set(b.order)],an=activeAnn(rec);
 if(annStop===null||!stops.includes(annStop))annStop=stops[0];
 const dis=closed?'disabled':'';
 const hist=(Array.isArray(rec.anns)?rec.anns:[]).slice(0,5);
 return `<section class="card fl-card"><h2>Кондиционер</h2>
 <div class="fl-status fl-status-${ac===true?'go':'idle'}"><b>${ac===true?'❄ Включён':ac===false?'Выключен':'Не отмечено'}</b><small>${rec.acAt&&ac!==null&&ac!==undefined?'с '+hhmm(rec.acAt):''}</small></div>
 <div class="fl-bigbtns"><button class="fl-big fl-go" data-fl-ac="on" ${dis}><span>❄</span>Включил</button><button class="fl-big fl-stop" data-fl-ac="off" ${dis}><span>○</span>Выключил</button></div>
 <p class="fl-note">Пассажиры видят отметку в карточке маршрута и на карте.</p></section>
 <section class="card fl-card"><h2>Объявить остановку</h2>
 <p class="muted">Скажите пассажирам, где автобус и как он остановится. Объявление видно 30 минут.</p>
 ${an?`<div class="fl-status fl-status-go"><b>📢 ${esc(annText(an))}</b><small>${hhmm(an.at)}</small></div>`:''}
 <div class="fl-group"><span class="fl-label">Где</span><select id="fl-ann-stop" class="fl-select" aria-label="Остановка">${stops.map(i=>`<option value="${i}" ${i===annStop?'selected':''}>${esc(CITIES[c].stops[i])}</option>`).join('')}</select></div>
 <div class="fl-group"><span class="fl-label">Как</span><div class="fl-chips" role="group" aria-label="Как">${ANN_KINDS.map(([k,l])=>`<button class="chip ${k===annKind?'active':''}" data-fl-annk="${k}" aria-pressed="${k===annKind}">${esc(l)}</button>`).join('')}</div></div>
 <input id="fl-ann-note" class="fl-tkin" maxlength="100" placeholder="Пояснение, например: «объезд по ул. Абая» (необязательно)" value="${esc(annNote)}">
 <div class="fl-row"><button class="primary fl-wide" data-fl-ann="send" ${dis}>📢 Объявить пассажирам</button>${an?'<button class="fl-btn" data-fl-ann="clear">Снять объявление</button>':''}</div>
 ${hist.length?`<ul class="fl-log">${hist.map(a=>`<li><time>${when(a.at)}</time>${esc(annText(a))}</li>`).join('')}</ul>`:''}
 </section>`;
}
function driverTick(){
 const u=me();if(!u)return;const r=roleOf(u.id);if(r.role!=='driver')return;
 const b=BUSES.find(x=>x.id===r.bus);if(!b)return;
 const i=info(b),sc=sched(b.id);
 const el=$('#fl-since');
 if(el){el.textContent=i.rec&&i.rec.at?'с '+when(i.rec.at).slice(-5)+' · '+dur((Date.now()-i.rec.at)/1000):''}
 const w=$('#fl-window');
 if(w){
  const endM=toMin(sc.end),m=nowSec()/60;
  let t=`Рабочее время маршрута: ${sc.start}–${sc.end}`;
  if(sc.mode==='on')t='Маршрут работает без ограничения по времени';
  else if(sc.mode==='off')t='Маршрут остановлен диспетчером';
  else if(!i.off&&endM!==null){let left=(endM-m)*60;if(left<0)left+=86400;t+=` · до конца рейсов ${dur(left)}`}
  w.textContent=t;
 }
}

/* ---------- диспетчерская ---------- */
let tab='people',filter='all',query='';
function adminView(){
 const u=me();
 if(!u)return loginCard('Войдите, чтобы управлять водителями и автобусами.');
 if(!isAdmin(u))return card(`<h2>Нет доступа</h2><p class="muted">Эта страница только для диспетчеров. Права выдаёт диспетчер вашего города.</p>`);
 const r=roleOf(u.id),n=openTickets(),nc=openCards();
 const tabs=[['people','Люди'],['buses','Автобусы'],['support','Поддержка'+(n?' · '+n:'')],['cards','Карты'+(nc?' · '+nc:'')],['log','Журнал']];
 if(isDev(u))tabs.push(['dev','Разработчик']);
 if(tab==='dev'&&!isDev(u))tab='people';
 const who=isDev(u)?'Разработчик · все функции и все города':isOwner(u)?'Главный диспетчер · все города':'Диспетчер города '+cname(r.city)+' · другие города вам недоступны';
 return `<p class="fl-note">${esc(who)}</p><div class="fl-tabs" role="tablist">${tabs.map(([id,l])=>`<button class="chip ${tab===id?'active':''}" role="tab" aria-selected="${tab===id}" data-fl-tab="${id}">${l}</button>`).join('')}</div>`+(tab==='people'?peopleView(u):tab==='buses'?busesView(u):tab==='support'?supportAdminView(u):tab==='cards'?cardsAdminView(u):tab==='dev'?devView(u):logView(u));
}
function scoped(u){
 const my=roleOf(u.id).city;
 return everyone().filter(p=>isOwner(u)?(cityFilter==='all'||(p.city||curCity())===curCity()):p.city===my);
}
function peopleView(u){
 const all=scoped(u),rs=roles(),owner=isOwner(u);
 const cnt={all:all.length,driver:all.filter(p=>rs[p.id]?.role==='driver').length,admin:all.filter(p=>['admin','owner','dev'].includes(rs[p.id]?.role)).length,dev:all.filter(p=>rs[p.id]?.role==='dev').length,blocked:all.filter(p=>rs[p.id]?.blocked).length};
 return `<section class="card fl-card"><div class="fl-stats"><div><b>${cnt.all}</b><span>Всего</span></div><div><b>${cnt.driver}</b><span>Водителей</span></div><div><b>${cnt.admin}</b><span>Диспетчеров</span></div><div><b>${cnt.blocked}</b><span>Заблок.</span></div></div>
 <input class="search" id="fl-search" placeholder="Имя, почта или User ID" aria-label="Поиск людей" value="${esc(query)}">
 <div class="filters">${[['all','Все'],['driver','Водители'],['admin','Диспетчеры'],...(isDev(u)?[['dev','Разработчики']]:[]),['blocked','Заблокированные']].map(([id,l])=>`<button class="chip ${filter===id?'active':''}" data-fl-filter="${id}" aria-pressed="${filter===id}">${l} · ${cnt[id]}</button>`).join('')}${owner?`<button class="chip ${cityFilter==='all'?'active':''}" data-fl-cityf="${cityFilter==='all'?'cur':'all'}">${cityFilter==='all'?'Только '+esc(cityName()):'Все города'}</button>`:''}</div>
 <ul class="fl-people" id="fl-people">${peopleRows(u)}</ul>
 <p class="fl-note">${owner?'Показан город '+esc(cityName())+(cityFilter==='all'?' и остальные города':'')+'. ':'Вы видите только людей из города '+esc(cityName())+'. '}Люди появляются в списке после регистрации или входа.</p></section>`;
}
function peopleRows(u){
 const rs=roles(),q=query.trim().toLowerCase(),owner=isOwner(u);
 const list=scoped(u).filter(p=>{const r=rs[p.id]||{};const rl=(r.role==='owner'||r.role==='dev')?'admin':r.role;return(!q||(p.name+' '+p.contact+' '+(p.userId||'')).toLowerCase().includes(q))&&(filter==='all'||(filter==='blocked'?r.blocked:filter==='dev'?r.role==='dev':rl===filter))});
 if(!list.length)return '<li class="empty">Никого не найдено.</li>';
 return list.map(p=>{
  const r=rs[p.id]||{role:'user',bus:null,blocked:false},self=p.id===u.id;
  const dev=isDev(u),tDev=r.role==='dev',tOwner=r.role==='owner'||(tDev&&!dev),tAdmin=r.role==='admin',sameCity=(p.city||curCity())===curCity();
  const label=r.blocked?'Заблокирован':tDev?'Разработчик':r.role==='owner'?'Главный диспетчер':tAdmin?'Диспетчер · '+cname(r.city):r.role==='driver'?'Водитель · №'+r.bus:'Пассажир';
  const cls=r.blocked?'blocked':tDev?'dev':(tOwner||tAdmin)?'admin':r.role;
  const opts=BUSES.map(b=>`<option value="${b.id}" ${r.bus===b.id?'selected':''}>№${b.id} · ${esc(b.name)}</option>`).join('');
  let act='';
  if(!self&&!tOwner){
   if(!r.blocked&&!tAdmin&&sameCity)act+=`<select data-fl-bus aria-label="Автобус для ${esc(p.name)}">${opts}</select><button class="fl-btn fl-primary" data-fl-act="driver">${r.role==='driver'?'Сменить автобус':'Назначить водителем'}</button>`;
   if(!r.blocked&&!tAdmin)act+=(owner&&typeof CITIES!=='undefined'?`<select data-fl-acity aria-label="Город диспетчера">${Object.entries(CITIES).map(([id,c])=>`<option value="${id}" ${id===(p.city||curCity())?'selected':''}>${esc(c.name)}</option>`).join('')}</select>`:'')+`<button class="fl-btn" data-fl-act="admin">Сделать диспетчером${owner?' города':''}</button>`;
   if(tAdmin&&owner&&!r.blocked)act+=`<button class="fl-btn" data-fl-act="admin">Снять диспетчера</button>`;
   if(r.role==='driver'&&!r.blocked)act+=`<button class="fl-btn" data-fl-act="unrole">Снять роль</button>`;
   if(tAdmin&&!owner)act+=`<span class="fl-note">Снять или заблокировать диспетчера может только главный диспетчер</span>`;
   else act+=`<button class="fl-btn ${r.blocked?'':'fl-danger'}" data-fl-act="block">${r.blocked?'Разблокировать':'Заблокировать'}</button>`;
  }
  if(dev&&!self&&r.role==='owner')act+=`<button class="fl-btn ${r.blocked?'':'fl-danger'}" data-fl-act="block">${r.blocked?'Разблокировать':'Заблокировать'}</button>`;
  if(dev&&!self&&tDev)act+=`<button class="fl-btn ${r.blocked?'':'fl-danger'}" data-fl-act="block">${r.blocked?'Разблокировать':'Заблокировать'}</button>`;
  if(dev){ // разработчик: любая роль любому человеку, смена User ID
   const curRole=r.role||'user',rc=r.city||p.city||curCity();
   act+=`<div class="fl-devrole"><select data-fl-rrole aria-label="Роль">${Object.entries(ROLE_NAMES).map(([k,v])=>`<option value="${k}" ${k===curRole?'selected':''}>${v}</option>`).join('')}</select>${typeof CITIES!=='undefined'?`<select data-fl-rcity aria-label="Город">${Object.entries(CITIES).map(([id,c])=>`<option value="${id}" ${id===rc?'selected':''}>${esc(c.name)}</option>`).join('')}</select>`:''}<select data-fl-rbus aria-label="Автобус">${opts}</select><button class="fl-btn fl-primary" data-fl-act="setrole">Применить роль</button><button class="fl-btn" data-fl-act="setid">Изменить ID</button></div>`;
  }
  return `<li class="fl-person ${r.blocked?'is-blocked':''}" data-uid="${esc(p.id)}">
   <span class="fl-ava">${esc(initials(p.name))}</span>
   <div class="fl-pinfo"><strong>${esc(p.name)}${self?' <em>(вы)</em>':''}</strong><span>${esc(p.contact||p.id)}${p.city?' · '+esc(cname(p.city)):''}</span><span class="fl-uid">ID: ${p.userId?'<code>'+esc(p.userId)+'</code>':'<em>ещё не выдан</em>'}</span><span class="fl-role fl-role-${cls}">${esc(label)}</span></div>
   <div class="fl-pact">${act}</div></li>`;
 }).join('');
}
function clockPanel(){
 const t=testClock(),c=rd(K.clock,null);
 return `<section class="card fl-card"><h2>Время работы</h2>
 <p class="muted">Сейчас в системе: <b id="fl-now">${fmtMin(nowMin())}</b> ${t!==null?'<span class="fl-pill fl-pill-stop">тестовое время</span>':'(время устройства)'}</p>
 <div class="fl-clockrow"><input type="time" id="fl-test" value="${t!==null?fmtMin(t):'20:55'}" aria-label="Тестовое время"><button class="fl-btn fl-primary" data-fl-act="clock-on">Включить тест</button>${c&&c.on?'<button class="fl-btn" data-fl-act="clock-off">Вернуть реальное время</button>':''}</div>
 <div class="fl-chips">${['20:55','21:00','23:30','06:00'].map(x=>`<button class="chip" data-fl-preset="${x}">${x}</button>`).join('')}</div>
 <button class="fl-btn" data-fl-act="all21">Завершать рейсы в 21:00 на всех маршрутах</button>
 <p class="fl-note">Тест нужен, чтобы проверить ночной режим без ожидания 21:00. Время идёт само.</p></section>`;
}
function busesView(u){
 return (isOwner(u)?clockPanel():'')+BUSES.map(b=>{
  const i=info(b),sc=sched(b.id);
  const drivers=Object.entries(roles()).filter(([,r])=>r.role==='driver'&&r.bus===b.id&&!r.blocked).map(([,r])=>r.name).filter(Boolean);
  const st=i.off?`<span class="fl-pill fl-pill-off">${i.night?'🌙 ':''}${esc(i.why)}</span>`:i.stopped?`<span class="fl-pill fl-pill-stop">⏸ Стоит: ${esc(i.reason)}</span>`:i.rec&&i.rec.state==='moving'?'<span class="fl-pill fl-pill-go">▶ В движении</span>':'<span class="fl-pill">Работает (по симуляции)</span>';
  return `<article class="card fl-card fl-bus" style="--accent:${b.color}" data-bus="${b.id}">
   <div class="fl-bushead"><span class="route-number">${esc(b.id)}</span><div><strong>${esc(b.name)}</strong>${st}</div></div>
   <div class="fl-sched"><label>Начало<input type="time" data-fl-sch="start" value="${sc.start}"></label><label>Конец<input type="time" data-fl-sch="end" value="${sc.end}"></label><label>Режим<select data-fl-sch="mode">${Object.entries(MODES).map(([v,l])=>`<option value="${v}" ${sc.mode===v?'selected':''}>${l}</option>`).join('')}</select></label></div>
   <p class="fl-drivers">Водители: ${drivers.length?esc(drivers.join(', ')):'<span class="muted">не назначены</span>'}</p>
   <div class="fl-row"><button class="fl-btn" data-fl-ac="on">❄ Кондиционер вкл</button><button class="fl-btn" data-fl-ac="off">Кондиционер выкл</button><button class="fl-btn" data-fl-ac="reset">Сбросить отметку</button><button class="fl-btn" data-fl-ann="clear">Снять объявление</button></div>
    <div class="fl-row"><button class="fl-btn" data-fl-force="stopped">Отметить «Стоит»</button><button class="fl-btn" data-fl-force="moving">Отметить «Движется»</button><button class="fl-btn" data-fl-force="auto">Сбросить</button></div>
  </article>`;
 }).join('');
}
function logView(u){
 const l=rd(K.log,[]).filter(x=>isOwner(u)||x.city===roleOf(u.id).city);
 return card(`<h2>Журнал действий</h2>${l.length?`<ul class="fl-log">${l.slice(0,60).map(x=>`<li><time>${when(x.t)}</time>${esc(x.text)}</li>`).join('')}</ul>`:'<p class="muted">Записей пока нет.</p>'}${isOwner(u)?'<button class="fl-btn" data-fl-act="export">Скачать базу данных (JSON)</button>':''}`);
}

/* ---------- техподдержка ---------- */
const tkT=()=>AqylDB.table('tickets');
const tickets=()=>tkT().list();
const ticketsFor=u=>tickets().filter(t=>isOwner(u)||t.city===roleOf(u.id).city);
function openTickets(){const u=me();if(!u||!isAdmin(u)||!window.AqylDB)return 0;return ticketsFor(u).filter(t=>t.status==='new').length}
const TK={new:'Новое',answered:'Есть ответ',done:'Решено'};
function supportAdminView(u){
 const list=ticketsFor(u).sort((a,b)=>(a.status==='new'?0:a.status==='answered'?1:2)-(b.status==='new'?0:b.status==='answered'?1:2)||(b.urgent?1:0)-(a.urgent?1:0)||b.ts-a.ts).slice(0,50);
 return card(`<h2>Обращения в поддержку</h2>${list.length?`<ul class="fl-tickets">${list.map(t=>`<li class="fl-ticket fl-tk-${t.status}" data-tid="${esc(t.id)}">
  <div class="fl-tkhead"><strong>${t.urgent?'🚨 ':''}${esc(t.name)}</strong>${t.kind==='driver'?`<span class="fl-role fl-role-driver">🚌 Водитель${t.bus?' №'+esc(t.bus):''}</span>`:''}<span class="fl-note">${esc(t.contact||'')} · ${esc(cname(t.city))} · ${when(t.ts)}</span><span class="fl-role fl-role-${t.status==='new'?'blocked':t.status==='done'?'user':'driver'}">${TK[t.status]}</span></div>
  <p class="fl-tktext">${esc(t.text)}</p>
  ${t.reply?`<p class="fl-tkreply"><b>Ответ:</b> ${esc(t.reply)}</p>`:''}
  ${t.status==='done'?'':`<div class="fl-row"><input class="fl-tkin" data-fl-reply placeholder="Ответ пользователю" maxlength="400"><button class="fl-btn fl-primary" data-fl-tk="reply">Ответить</button><button class="fl-btn" data-fl-tk="done">Решено</button></div>`}
 </li>`).join('')}</ul>`:'<p class="muted">Обращений пока нет.</p>'}<p class="fl-note">${isOwner(u)?'Вы видите обращения всех городов.':'Вы видите обращения только города '+esc(cname(roleOf(u.id).city))+'.'}</p>`);
}
function tkAct(act,li){
 const u=me();if(!isAdmin(u))return say('Нужны права диспетчера');
 const t=tkT().get(li.dataset.tid);if(!t)return;
 if(!isOwner(u)&&t.city!==roleOf(u.id).city)return say('Это обращение из другого города');
 if(act==='reply'){const v=$('[data-fl-reply]',li)?.value.trim();if(!v)return say('Напишите ответ');tkT().update(t.id,{reply:v,replyAt:Date.now(),status:'answered'});say('Ответ отправлен')}
 else if(act==='done'){tkT().update(t.id,{status:'done'});say('Обращение закрыто')}
 full();
}
function supportCard(){
 if(page!=='settings'||!window.AqylDB)return;
 const u=me();let el=$('#fl-support');
 if(!el){el=document.createElement('section');el.id='fl-support';el.className='card fl-card';const a=$('#au-card')||$('.pageheading');if(a)a.after(el);else{const app=$('#app');if(!app)return;app.prepend(el)}}
 const mine=u?tickets().filter(t=>t.uid===u.id&&t.kind!=='driver').sort((a,b)=>b.ts-a.ts).slice(0,4):[];
 const sig=(u?u.id:'-')+'|'+curCity()+'|'+JSON.stringify(mine.map(t=>[t.id,t.status,t.reply]));
 if(el.dataset.sig===sig)return;el.dataset.sig=sig;
 const adm=Object.values(roles()).some(r=>r.role==='admin'&&!r.blocked&&r.city===curCity());
 el.innerHTML=`<h2>Техподдержка</h2>`+(u?`<p class="muted">Опишите проблему — сообщение получит ${adm?'диспетчер города '+esc(cityName()):'главный диспетчер (в городе '+esc(cityName())+' пока нет своего диспетчера)'}.</p>
  <textarea id="fl-sup-text" class="fl-textarea" rows="3" maxlength="600" placeholder="Что случилось?"></textarea>
  <button class="primary fl-wide" data-fl-sup="send">Отправить в поддержку</button>
  <p class="fl-err" id="fl-sup-err" role="alert"></p><p class="fl-note">Чтобы поддержку не засыпали сообщениями, можно писать не чаще одного раза в 3 часа.</p>
  ${mine.length?`<ul class="fl-tickets">${mine.map(t=>`<li class="fl-ticket"><div class="fl-tkhead"><span class="fl-note">${when(t.ts)}</span><span class="fl-role fl-role-${t.status==='new'?'blocked':t.status==='done'?'user':'driver'}">${TK[t.status]}</span></div><p class="fl-tktext">${esc(t.text)}</p>${t.reply?`<p class="fl-tkreply"><b>Ответ:</b> ${esc(t.reply)}</p>`:''}</li>`).join('')}</ul>`:''}`
  :`<p class="muted">Чтобы написать в поддержку, войдите в аккаунт.</p><button class="primary fl-wide" data-au-open>Войти</button>`);
}
const SUP_GAP=3*3600*1000; // в поддержку — одно сообщение в 3 часа
function sendTicket(){
 const u=me();if(!u)return;
 const err=$('#fl-sup-err'),fail=m=>{if(err)err.textContent=m;say(m)};
 const last=tickets().filter(t=>t.uid===u.id&&t.kind!=='driver').sort((a,b)=>b.ts-a.ts)[0];
 if(last&&Date.now()-last.ts<SUP_GAP)return fail('Вы уже написали в поддержку. Попробуйте подождать ответа или написать ещё раз через 3 часа после предыдущего сообщения (осталось '+dur((SUP_GAP-(Date.now()-last.ts))/1000)+').');
 const text=($('#fl-sup-text')?.value||'').trim();
 if(text.length<5)return fail('Опишите проблему подробнее (от 5 символов)');
 const id='t'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
 tkT().set(id,{id,uid:u.id,name:u.name,contact:u.contact,city:curCity(),kind:'support',text:text.slice(0,600),ts:Date.now(),status:'new',reply:'',replyAt:0});
 const el=$('#fl-sup-text');if(el)el.value='';if(err)err.textContent='';
 say('Сообщение отправлено диспетчеру');supportCard();
}

/* ---------- связь водителя с диспетчером ---------- */
const DM_QUICK=[['🚨 Поломка',1],['🚨 ДТП',1],['🆘 Нужна помощь',1],['Опаздываю на рейс',0],['Нужен перерыв',0]];
let dmDraft='';
function dmCard(u,b){
 const mine=tickets().filter(t=>t.uid===u.id&&t.kind==='driver').sort((x,y)=>y.ts-x.ts).slice(0,5);
 const has=Object.values(roles()).some(r=>r.role==='admin'&&!r.blocked&&r.city===curCity());
 return card(`<h2>Связь с диспетчером</h2><p class="muted">Сообщение получит ${has?'диспетчер города '+esc(cityName()):'главный диспетчер (в городе '+esc(cityName())+' пока нет своего диспетчера)'}. Ответ появится здесь.</p>
 <div class="fl-chips" role="group" aria-label="Быстрые сообщения">${DM_QUICK.map(([l,urg])=>`<button class="chip ${urg?'fl-urgent':''}" data-fl-dmq="${esc(l)}" data-urgent="${urg}">${esc(l)}</button>`).join('')}</div>
 <textarea id="fl-dm-text" class="fl-textarea" rows="3" maxlength="600" placeholder="Сообщение диспетчеру">${esc(dmDraft)}</textarea>
 <button class="primary fl-wide" data-fl-dm="send">Отправить диспетчеру</button><p class="fl-err" id="fl-dm-err" role="alert"></p>
 ${mine.length?`<ul class="fl-tickets">${mine.map(t=>`<li class="fl-ticket"><div class="fl-tkhead"><span class="fl-note">${when(t.ts)}</span>${t.urgent?'<span class="fl-role fl-role-blocked">Срочно</span>':''}<span class="fl-role fl-role-${t.status==='new'?'blocked':t.status==='done'?'user':'driver'}">${TK[t.status]}</span></div><p class="fl-tktext">${esc(t.text)}</p>${t.reply?`<p class="fl-tkreply"><b>Ответ диспетчера:</b> ${esc(t.reply)}</p>`:''}</li>`).join('')}</ul>`:''}`);
}
function sendDriverMsg(text,urgent){
 const u=me(),r=u&&roleOf(u.id);if(!u||!r||r.role!=='driver'||r.blocked)return;
 const err=$('#fl-dm-err'),fail=m=>{if(err)err.textContent=m;say(m)};
 text=(text||'').trim();
 if(text.length<3)return fail('Напишите сообщение (от 3 символов).');
 if(tickets().some(t=>t.uid===u.id&&t.kind==='driver'&&Date.now()-t.ts<15000))return fail('Подождите несколько секунд перед следующим сообщением.');
 const id='t'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
 tkT().set(id,{id,uid:u.id,name:u.name,contact:u.contact,city:curCity(),kind:'driver',bus:r.bus,urgent:!!urgent,text:text.slice(0,600),ts:Date.now(),status:'new',reply:'',replyAt:0});
 dmDraft='';log(u.name+(r.bus?' · №'+r.bus:'')+' · '+cityName()+': сообщение диспетчеру'+(urgent?' (срочно)':''));
 say('Сообщение отправлено диспетчеру');full();
}

/* ---------- заявки на виртуальную карту (для диспетчера) ---------- */
const CATL={regular:'Обычный пассажир',student:'Студент',school:'Школьник',pensioner:'Пенсионер',benefit:'Льготная категория'};
const cdT=()=>AqylDB.table('cards');
const cardReqs=u=>cdT().list().filter(c=>isOwner(u)||c.city===roleOf(u.id).city);
function openCards(){const u=me();if(!u||!isAdmin(u)||!window.AqylDB)return 0;return cardReqs(u).filter(c=>c.status==='new').length}
const fmtCard=n=>String(n||'').replace(/^(AQ)(\d{4})(\d{4})(\d{2})$/,'$1 $2 $3 $4');
function cardsAdminView(u){
 const list=cardReqs(u).sort((a,b)=>(a.status==='new'?0:1)-(b.status==='new'?0:1)||b.ts-a.ts).slice(0,50);
 const ST={new:['Новая заявка','blocked'],approved:['Карта создана','user'],rejected:['Отклонена','driver']};
 return card(`<h2>Заявки на виртуальную карту</h2>${list.length?`<ul class="fl-tickets">${list.map(c=>`<li class="fl-ticket" data-cid="${esc(c.id)}">
  <div class="fl-tkhead"><strong>${esc(c.fio||c.name)}</strong><span class="fl-note">${esc(c.contact||'')} · ${esc(cname(c.city))} · ${when(c.ts)}</span><span class="fl-role fl-role-${ST[c.status][1]}">${ST[c.status][0]}</span></div>
  <p class="fl-tktext">Категория: <b>${esc(CATL[c.category]||c.category)}</b> · дата рождения: ${esc(c.birth||'—')} · телефон: ${esc(c.phone||'—')}</p>
  ${c.status==='new'?`<div class="fl-docs">${(c.docs||[]).map(d=>`<figure><img class="fl-doc" alt="${esc(d.name)}" src="${esc(d.data)}" data-fl-zoom><figcaption>${esc(d.name)}</figcaption></figure>`).join('')||'<span class="fl-note">Документы не приложены</span>'}</div>
  <div class="fl-row"><button class="fl-btn fl-primary" data-fl-card="approve">Создать виртуальную карту</button></div>
  <div class="fl-row"><input class="fl-tkin" data-fl-why placeholder="Причина отказа" maxlength="300"><button class="fl-btn fl-danger" data-fl-card="reject">Отклонить</button></div>
  <p class="fl-note">После решения фото документов удаляются из заявки.</p>`:''}
  ${c.status==='approved'&&c.card?`<p class="fl-tkreply"><b>Номер карты:</b> ${esc(fmtCard(c.card.number))}</p>`:''}
  ${c.status==='rejected'?`<p class="fl-tkreply"><b>Причина отказа:</b> ${esc(c.reason||'')}</p>`:''}
 </li>`).join('')}</ul>`:'<p class="muted">Заявок пока нет.</p>'}<p class="fl-note">${isOwner(u)?'Вы видите заявки всех городов.':'Вы видите заявки только города '+esc(cname(roleOf(u.id).city))+'.'} Данные и документы видите только вы и главный диспетчер.</p>`);
}
function cardAct(act,li){
 const u=me();if(!isAdmin(u))return say('Нужны права диспетчера');
 const c=cdT().get(li.dataset.cid);if(!c)return;
 if(!isOwner(u)&&c.city!==roleOf(u.id).city)return say('Эта заявка из другого города');
 if(c.status!=='new')return say('Заявка уже рассмотрена');
 if(act==='approve'){
  let number;do{number='AQ'+String(Math.floor(Math.random()*1e10)).padStart(10,'0')}while(cdT().list().some(x=>x.card&&x.card.number===number));
  cdT().update(c.id,{status:'approved',card:{number,issued:Date.now(),by:u.name},docs:[],decidedAt:Date.now()});
  log(u.name+': выпущена виртуальная карта для '+(c.fio||c.name)+' ('+number+')');say('Карта создана: '+fmtCard(number));
 }else if(act==='reject'){
  const why=($('[data-fl-why]',li)?.value||'').trim();if(!why)return say('Укажите причину отказа');
  cdT().update(c.id,{status:'rejected',reason:why.slice(0,300),docs:[],decidedAt:Date.now()});
  log(u.name+': отклонена заявка на карту от '+(c.fio||c.name));say('Заявка отклонена');
 }
 full();
}

/* ---------- разработчик: база данных, все действия, User ID ---------- */
const DV_TABLES=[['users','Аккаунты'],['people','Люди'],['roles','Роли'],['tickets','Обращения'],['cards','Заявки на карты'],['sched','Расписание'],['status','Статусы'],['bus','Кондиционер и объявления']];
let dvSub='data',dvTable='users',dvQuery='',dvLogQ='',dvLogCity='all',dvIds=null,dvIdQ='';
const dvStrip=v=>dvTable==='cards'&&v&&Array.isArray(v.docs)?{...v,docs:'['+v.docs.length+' фото — не редактируются]'}:v;
const dvLabel=(id,v)=>String((v&&(v.name||v.fio||v.text||v.userId))||id).slice(0,48);
function devView(u){
 if(!isDev(u))return card('<h2>Нет доступа</h2><p class="muted">Эта вкладка только для разработчика.</p>');
 const subs=[['data','База данных'],['actions','Все действия'],['ids','User ID']];
 return `<div class="fl-tabs fl-subtabs">${subs.map(([id,l])=>`<button class="chip ${dvSub===id?'active':''}" data-fl-dvsub="${id}">${l}</button>`).join('')}</div>`+(dvSub==='data'?dvData():dvSub==='actions'?dvActions():dvIdsView());
}
function dvList(){
 const q=dvQuery.trim().toLowerCase();
 let ents=Object.entries(AqylDB.table(dvTable).all());
 if(q)ents=ents.filter(([id,v])=>(id+' '+JSON.stringify(dvStrip(v))).toLowerCase().includes(q));
 const total=ents.length;ents=ents.slice(0,30);
 if(!ents.length)return '<p class="muted">Записей нет.</p>';
 return ents.map(([id,v])=>`<details class="fl-dv" data-dvid="${esc(id)}"><summary><b>${esc(dvLabel(id,v))}</b> <span class="fl-note">${esc(id.length>28?id.slice(0,28)+'…':id)}</span></summary><textarea class="fl-textarea fl-json" rows="10" spellcheck="false" aria-label="JSON записи">${esc(JSON.stringify(dvStrip(v),null,1))}</textarea><div class="fl-row"><button class="fl-btn fl-primary" data-fl-dv="save">Сохранить</button><button class="fl-btn fl-danger" data-fl-dv="del">Удалить запись</button></div></details>`).join('')+(total>30?`<p class="fl-note">Показано 30 из ${total}. Уточните поиск.</p>`:'');
}
function dvData(){
 const cnt=n=>Object.keys(AqylDB.table(n).all()).length;
 return card(`<h2>База данных</h2><p class="muted">Любую запись можно изменить или удалить: изменения сразу уходят в общую базу. Будьте осторожны с ролями и своим аккаунтом.</p>
 <div class="filters">${DV_TABLES.map(([id,l])=>`<button class="chip ${dvTable===id?'active':''}" data-fl-dvt="${id}" aria-pressed="${dvTable===id}">${l} · ${cnt(id)}</button>`).join('')}</div>
 <input class="search" id="fl-dvq" placeholder="Поиск по записям таблицы" aria-label="Поиск по записям" value="${esc(dvQuery)}">
 <div id="fl-dvlist">${dvList()}</div>
 <details class="fl-dv"><summary><b>＋ Добавить запись</b></summary><input class="fl-tkin" id="fl-dvnewid" placeholder="Ключ записи (id)"><textarea class="fl-textarea fl-json" id="fl-dvnew" rows="6" spellcheck="false" placeholder='{"name":"..."}'></textarea><button class="fl-btn fl-primary" data-fl-dv="add">Добавить</button></details>
 <div class="fl-row"><button class="fl-btn" data-fl-dv="export">Скачать всю базу (JSON)</button></div>`);
}
function dvLogRows(){
 const q=dvLogQ.trim().toLowerCase();
 const l=rd(K.log,[]).filter(x=>(dvLogCity==='all'||x.city===dvLogCity)&&(!q||x.text.toLowerCase().includes(q)));
 if(!l.length)return '<p class="muted">Записей нет.</p>';
 return `<ul class="fl-log">${l.slice(0,300).map(x=>`<li><time>${when(x.t)}</time><span class="fl-tag">${esc(cname(x.city))}</span> ${esc(x.text)}</li>`).join('')}</ul>`+(l.length>300?`<p class="fl-note">Показано 300 из ${l.length}. Уточните поиск.</p>`:'');
}
function dvActions(){
 const all=rd(K.log,[]),cities=[...new Set(all.map(x=>x.city).filter(Boolean))];
 return card(`<h2>Все действия</h2><p class="muted">Действия водителей, диспетчеров и разработчиков по всем городам (последние ${all.length} из 500 записей).</p>
 <input class="search" id="fl-dvlq" placeholder="Поиск: имя, автобус, действие" aria-label="Поиск по действиям" value="${esc(dvLogQ)}">
 <div class="filters"><button class="chip ${dvLogCity==='all'?'active':''}" data-fl-dvlc="all">Все города</button>${cities.map(c=>`<button class="chip ${dvLogCity===c?'active':''}" data-fl-dvlc="${esc(c)}">${esc(cname(c))}</button>`).join('')}</div>
 <div id="fl-dvlog">${dvLogRows()}</div>
 <div class="fl-row"><button class="fl-btn" data-fl-dv="logexport">Скачать журнал (JSON)</button></div>`);
}
function dvIdsView(){
 const us=Object.values(rd(K.users,{})),have=us.filter(x=>x.userId).length;
 const q=dvIdQ.trim().toLowerCase();
 const rows=dvIds?dvIds.filter(x=>!q||(x.userId+' '+x.uid+' '+((rd(K.users,{})[x.uid]||{}).name||'')).toLowerCase().includes(q)).slice(0,100):null;
 return card(`<h2>User ID</h2><p class="muted">У каждого человека есть постоянный User ID. Свой ID можно выбрать один раз, после чего он закрепляется навсегда. Здесь можно выдать ID тем, у кого его ещё нет, и посмотреть реестр.</p>
 <div class="fl-stats"><div><b>${us.length}</b><span>Аккаунтов</span></div><div><b>${have}</b><span>С ID</span></div><div><b>${us.length-have}</b><span>Без ID</span></div></div>
 <div class="fl-row"><button class="fl-btn fl-primary" data-fl-dv="assign">Выдать ID всем без ID</button><button class="fl-btn" data-fl-dv="loadids">${dvIds?'Обновить реестр':'Загрузить реестр ID'}</button></div>
 <p class="fl-note">Изменить ID конкретного человека: вкладка «Люди» → кнопка «Изменить ID».</p>
 ${rows?`<input class="search" id="fl-dviq" placeholder="Поиск по ID или имени" value="${esc(dvIdQ)}"><div id="fl-dvidl">${dvIdRows(rows)}</div>`:''}`);
}
function dvIdRows(rows){
 const us=rd(K.users,{});
 return rows.length?`<ul class="fl-log">${rows.map(x=>`<li><code>${esc(x.userId)}</code> · ${esc((us[x.uid]||{}).name||x.uid)} · ${x.locked?'выбран вручную':'авто'}${x.city?' · '+esc(cname(x.city)):''}</li>`).join('')}</ul>`:'<p class="muted">Ничего не найдено.</p>';
}
function dvDownload(obj,name){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(obj,null,1)],{type:'application/json'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}
async function dvAct(kind,el){
 const u=me();if(!isDev(u))return say('Только разработчик');
 const T=AqylDB.table(dvTable);
 if(kind==='export')return dvDownload(AqylDB.exportAll(),'aqyljol-db.json');
 if(kind==='logexport')return dvDownload(rd(K.log,[]),'aqyljol-log.json');
 if(kind==='save'){
  const box=el.closest('[data-dvid]'),id=box.dataset.dvid;let obj;
  try{obj=JSON.parse($('textarea',box).value)}catch(e){return say('Неверный JSON: '+e.message)}
  if(!obj||typeof obj!=='object'||Array.isArray(obj))return say('Запись должна быть объектом { … }');
  if(dvTable==='cards'&&typeof obj.docs==='string')obj.docs=(T.get(id)||{}).docs||[];
  if(dvTable==='roles'&&id===u.id&&obj.role!=='dev'&&!confirm('Вы меняете собственную роль: можно потерять права разработчика. Продолжить?'))return;
  T.set(id,obj);log(u.name+' (разработчик): изменена запись '+dvTable+'/'+id);say('Сохранено');return full();
 }
 if(kind==='del'){
  const id=el.closest('[data-dvid]').dataset.dvid;
  if(!confirm('Удалить запись «'+id+'» из таблицы «'+dvTable+'»? Это нельзя отменить.'))return;
  if(dvTable==='roles'&&id===u.id&&!confirm('Это ваша собственная роль. Удалить её?'))return;
  T.remove(id);log(u.name+' (разработчик): удалена запись '+dvTable+'/'+id);say('Удалено');return full();
 }
 if(kind==='add'){
  const id=($('#fl-dvnewid')?.value||'').trim();let obj;
  if(!id||/[\/]/.test(id))return say('Укажите ключ записи (без «/»)');
  try{obj=JSON.parse($('#fl-dvnew')?.value||'')}catch(e){return say('Неверный JSON: '+e.message)}
  if(!obj||typeof obj!=='object'||Array.isArray(obj))return say('Запись должна быть объектом { … }');
  T.set(id,obj);log(u.name+' (разработчик): добавлена запись '+dvTable+'/'+id);say('Добавлено');return full();
 }
 if(kind==='assign'){
  if(!window.AqylSync||!AqylSync.devAssignAll)return say('Общая база ещё не подключена');
  say('Выдаю ID…');const r=await AqylSync.devAssignAll();
  if(!r.ok)return say(r.error);
  log(u.name+' (разработчик): выдано ID — '+r.made+(r.fixed?', исправлено записей — '+r.fixed:''));say('Готово: выдано '+r.made+(r.fixed?', исправлено '+r.fixed:''));
  dvIds=await AqylSync.devListIds();return full();
 }
 if(kind==='loadids'){
  if(!window.AqylSync||!AqylSync.devListIds)return say('Общая база ещё не подключена');
  dvIds=await AqylSync.devListIds();return full();
 }
}
async function devSetId(uid,p){
 const u=me();if(!isDev(u))return say('Только разработчик');
 if(!window.AqylSync||!AqylSync.devSetId)return say('Общая база ещё не подключена');
 const v=prompt('Новый User ID для «'+p.name+'»\n3–16 символов: латиница, цифры, _',p.userId||'');
 if(v===null)return;
 const chk=window.AqylNick?AqylNick.checkId(v,{allowReserved:true}):{ok:/^[A-Za-z0-9_]{3,16}$/.test(v.trim()),id:v.trim(),error:'Неверный формат ID'};
 if(!chk.ok)return say(chk.error);
 const r=await AqylSync.devSetId(uid,chk.id,p.city||curCity());
 if(!r.ok)return say(r.error);
 if(AqylDB.table('users').get(uid))AqylDB.table('users').update(uid,{userId:r.userId,idLocked:true});
 log(u.name+' (разработчик): ID у '+p.name+' → '+r.userId);say('ID изменён: '+r.userId);full();
}

/* ---------- действия диспетчера ---------- */
function adminAct(act,li){
 const u=me();
 if(!isAdmin(u))return say('Нужны права диспетчера');
 if(!canManage(u))return say('Это не ваш город');
 const owner=isOwner(u),all=roles();
 if(act==='clock-on'||act==='clock-off'){
  if(!owner)return say('Только главный диспетчер');
  if(act==='clock-on'){const m=toMin($('#fl-test')?.value);if(m===null)return say('Введите время ЧЧ:ММ');wr(K.clock,{on:true,base:m,since:Date.now()});log(u.name+' включил тестовое время '+fmtMin(m))}
  else{wr(K.clock,{on:false});log(u.name+' вернул реальное время')}
  return full();
 }
 if(act==='export'){
  if(!owner)return say('Только главный диспетчер');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(AqylDB.exportAll(),null,1)],{type:'application/json'}));a.download='aqyljol-db.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);return;
 }
 if(act==='all21'){const s=rd(K.sched,{});BUSES.forEach(b=>{s[curCity()+':'+b.id]={...sched(b.id),end:'21:00'}});wr(K.sched,s);log(u.name+': рейсы всех маршрутов заканчиваются в 21:00');say('Готово: все маршруты до 21:00');return full()}
 const uid=li?.dataset.uid;if(!uid)return;
 const p=everyone().find(x=>x.id===uid);if(!p)return;
 const cur=all[uid]||{role:'user',bus:null,blocked:false};
 const pc=p.city||curCity();
 if(!owner&&pc!==roleOf(u.id).city)return say('Этот человек из другого города');
 if(cur.role==='dev'&&!isDev(u))return say('Разработчика может менять только разработчик');
 if(cur.role==='owner'&&!isDev(u))return say('Главного диспетчера менять нельзя');
 const save=(patch,text)=>{all[uid]={...cur,...patch,name:p.name,contact:p.contact||'',city:patch.city||cur.city||pc};wr(K.roles,all);log(u.name+': '+text);full()};
 if(act==='setrole'){
  if(!isDev(u))return say('Только разработчик');
  const role=$('[data-fl-rrole]',li)?.value||'user',rc=$('[data-fl-rcity]',li)?.value||pc,rb=$('[data-fl-rbus]',li)?.value||null;
  if(!ROLE_NAMES[role])return;
  if(uid===u.id&&role!=='dev'&&!confirm('Вы снимаете роль разработчика с себя. Вернуть её сможет только другой разработчик. Продолжить?'))return;
  if(role==='driver'&&!rb)return say('Выберите автобус');
  const patch=role==='user'?{role:'user',bus:null}:role==='driver'?{role:'driver',bus:rb,city:rc}:{role,bus:null,city:rc};
  save(patch,p.name+' — роль «'+ROLE_NAMES[role]+'»'+(role==='driver'?' №'+rb:'')+(role==='user'?'':' · '+cname(rc)));say(p.name+' — '+ROLE_NAMES[role]);return;
 }
 if(act==='setid'){return devSetId(uid,p)}
 if(act==='driver'){
  if(cur.role==='admin')return say('Сначала диспетчера должен снять главный диспетчер');
  if(pc!==curCity())return say('Водителя можно назначить только в городе '+cityName());
  const bus=$('[data-fl-bus]',li)?.value;if(!bus)return;
  save({role:'driver',bus,city:curCity()},p.name+' назначен водителем №'+bus);say(p.name+' — водитель №'+bus);
 }
 else if(act==='unrole'){if(cur.role!=='driver')return;save({role:'user',bus:null},'у '+p.name+' снята роль водителя')}
 else if(act==='admin'){
  if(cur.role==='admin'){
   if(!owner)return say('Снять диспетчера может только главный диспетчер');
   save({role:'user',bus:null},p.name+' больше не диспетчер');
  }else{
   if(cur.blocked)return say('Сначала разблокируйте человека');
   const ac=owner?($('[data-fl-acity]',li)?.value||pc):roleOf(u.id).city;
   save({role:'admin',bus:null,city:ac},p.name+' назначен диспетчером города '+cname(ac));say(p.name+' — диспетчер города '+cname(ac));
  }
 }
 else if(act==='block'){
  if(uid===u.id)return say('Нельзя заблокировать себя');
  if(cur.role==='admin'&&!owner)return say('Блокировать диспетчеров может только главный диспетчер');
  if(cur.blocked)return save({blocked:false},p.name+' разблокирован'),say('Разблокирован');
  if(!confirm('Заблокировать «'+p.name+'»? Человек не сможет войти, а роль будет приостановлена.'))return;
  save({blocked:true},p.name+' заблокирован');say('Заблокирован');
 }
}

/* ---------- рендер и события ---------- */
function full(){
 if(!root)return;
 const keep=window.scrollY;
 root.innerHTML=page==='driver'?driverView():page==='admin'?adminView():'';
 window.scrollTo(0,keep);navLinks();driverTick();
}
function bind(){
 root.addEventListener('click',e=>{
  const z=e.target.closest('[data-fl-zoom]');
  if(z){const o=document.createElement('div');o.className='fl-zoom';o.innerHTML='<img alt="" src="'+z.src+'">';o.onclick=()=>o.remove();document.body.append(o);return}
  const t=e.target.closest('button,[data-fl-act]');if(!t)return;
  if(t.dataset.flCard)return cardAct(t.dataset.flCard,t.closest('[data-cid]'));
  if(t.dataset.flDm)return sendDriverMsg($('#fl-dm-text')?.value,false);
  if(t.dataset.flDmq!==undefined)return sendDriverMsg(t.dataset.flDmq+(roleOf(me()?.id).bus?' · автобус №'+roleOf(me().id).bus:''),t.dataset.urgent==='1');
  if(t.dataset.flTab){tab=t.dataset.flTab;return full()}
  if(t.dataset.flFilter){filter=t.dataset.flFilter;return full()}
  if(t.dataset.flCityf){cityFilter=t.dataset.flCityf;return full()}
  if(t.dataset.flTk)return tkAct(t.dataset.flTk,t.closest('[data-tid]'));
  if(t.dataset.flReason){reason=t.dataset.flReason;root.querySelectorAll('[data-fl-reason]').forEach(x=>{const on=x===t;x.classList.toggle('active',on);x.setAttribute('aria-pressed',String(on))});return}
  if(t.dataset.flPreset){const i=$('#fl-test');if(i)i.value=t.dataset.flPreset;return}
  if(t.dataset.flDrv){
   const u=me(),r=u&&roleOf(u.id);if(!r||r.role!=='driver'||r.blocked)return say('Нет доступа');
   const b=BUSES.find(x=>x.id===r.bus);if(!b)return;
   const i=info(b);if(i.off&&(i.night||sched(b.id).mode==='off'))return say('Маршрут сейчас не работает');
   const s=t.dataset.flDrv;
   if(setState(b.id,s,s==='stopped'?reason:''))say(s==='moving'?'Отмечено: начали движение':s==='stopped'?'Отмечено: стоите ('+reason+')':'Смена завершена');
   return full();
  }
  if(t.dataset.flForce){const u=me();if(!isAdmin(u)||!canManage(u))return say('Нужны права диспетчера города');const id=t.closest('[data-bus]').dataset.bus;setState(id,t.dataset.flForce,t.dataset.flForce==='stopped'?'Решение диспетчера':'');return full()}
   if(t.dataset.flDvsub){dvSub=t.dataset.flDvsub;return full()}
   if(t.dataset.flDvt){dvTable=t.dataset.flDvt;dvQuery='';return full()}
   if(t.dataset.flDvlc!==undefined){dvLogCity=t.dataset.flDvlc;return full()}
   if(t.dataset.flDv)return dvAct(t.dataset.flDv,t);
   if(t.dataset.flAc!==undefined){
    const u=me(),r=u&&roleOf(u.id);let id=null;
    if(r&&r.role==='driver'&&!r.blocked){id=r.bus;const b=BUSES.find(x=>x.id===id),i=b&&info(b);if(i&&i.off&&(i.night||sched(id).mode==='off'))return say('Маршрут сейчас не работает')}
    else if(isAdmin(u)&&canManage(u)){const a=t.closest('[data-bus]');id=a&&a.dataset.bus}
    if(!id)return say('Нет доступа');
    const v=t.dataset.flAc;setAC(id,v==='on'?true:v==='off'?false:null);
    say(v==='on'?'Отмечено: кондиционер включён':v==='off'?'Отмечено: кондиционер выключен':'Отметка кондиционера сброшена');return full();
   }
   if(t.dataset.flAnnk){annKind=t.dataset.flAnnk;root.querySelectorAll('[data-fl-annk]').forEach(x=>{const on=x===t;x.classList.toggle('active',on);x.setAttribute('aria-pressed',String(on))});return}
   if(t.dataset.flAnn){
    const u=me(),r=u&&roleOf(u.id);let id=null;
    if(r&&r.role==='driver'&&!r.blocked)id=r.bus;
    else if(isAdmin(u)&&canManage(u)){const a=t.closest('[data-bus]');id=a&&a.dataset.bus}
    if(!id)return say('Нет доступа');
    if(t.dataset.flAnn==='clear'){clearAnn(id);say('Объявление снято');return full()}
    const b=BUSES.find(x=>x.id===id),i=b&&info(b);if(i&&i.off&&(i.night||sched(id).mode==='off'))return say('Маршрут сейчас не работает');
    const last=busRec(curCity(),id).ann;if(last&&Date.now()-last.at<4000)return say('Подождите несколько секунд перед следующим объявлением');
    const note=($('#fl-ann-note')?.value||'').trim();annNote='';
    sendAnn(id,annStop,annKind,note);say('Объявление отправлено пассажирам');return full();
   }
   if(t.dataset.flAct)adminAct(t.dataset.flAct,t.closest('[data-uid]'));
 });
 root.addEventListener('change',e=>{
  if(e.target.id==='fl-ann-stop'){annStop=Number(e.target.value);return}
  const s=e.target.closest('[data-fl-sch]');if(!s)return;
  const u=me();if(!isAdmin(u)||!canManage(u))return say('Нужны права диспетчера города');
  const art=s.closest('[data-bus]'),id=art.dataset.bus;
  const start=$('[data-fl-sch=start]',art).value,end=$('[data-fl-sch=end]',art).value,mode=$('[data-fl-sch=mode]',art).value;
  if(toMin(start)===null||toMin(end)===null)return say('Введите время ЧЧ:ММ');
  const all=rd(K.sched,{});all[curCity()+':'+id]={start,end,mode};wr(K.sched,all);
  log(u.name+': №'+id+' — '+start+'–'+end+', режим «'+MODES[mode]+'»');say('Расписание №'+id+' сохранено');full();
 });
 root.addEventListener('input',e=>{if(e.target.id==='fl-ann-note')annNote=e.target.value;if(e.target.id==='fl-dvq'){dvQuery=e.target.value;const l=$('#fl-dvlist');if(l)l.innerHTML=dvList()}if(e.target.id==='fl-dvlq'){dvLogQ=e.target.value;const l=$('#fl-dvlog');if(l)l.innerHTML=dvLogRows()}if(e.target.id==='fl-dviq'){dvIdQ=e.target.value;const l=$('#fl-dvidl');if(l&&dvIds){const q=dvIdQ.trim().toLowerCase(),us=rd(K.users,{});l.innerHTML=dvIdRows(dvIds.filter(x=>!q||(x.userId+' '+x.uid+' '+((us[x.uid]||{}).name||'')).toLowerCase().includes(q)).slice(0,100))}}if(e.target.id==='fl-dm-text')dmDraft=e.target.value;if(e.target.id==='fl-search'){query=e.target.value;const ul=$('#fl-people');if(ul)ul.innerHTML=peopleRows(me())}});
}

/* ---------- запуск ---------- */
hook();
document.addEventListener('DOMContentLoaded',()=>{
 hook();register();enforce();
 { // город диспетчера/водителя закреплён: в чужой город они не заходят в кабинет
  const u0=me(),r0=u0&&roleOf(u0.id);
  if(r0&&(r0.role==='admin'||r0.role==='driver')&&(page==='admin'||page==='driver')&&r0.city&&r0.city!==curCity()&&typeof CITIES!=='undefined'&&CITIES[r0.city]){location.replace(page+'.html?city='+r0.city);return}
  if(r0&&r0.role==='admin'&&page==='admin'){const sel=$('#city');if(sel){sel.disabled=true;sel.title='Вы диспетчер города '+cname(r0.city)}}
 }
 navLinks();decorate();
 document.addEventListener('click',e=>{const b=e.target.closest('[data-fl-sup]');if(b)sendTicket()});
 { const n=openTickets();if(n&&page!=='admin')setTimeout(()=>say('Новых обращений в поддержку: '+n),1200) }
 if(page==='driver'||page==='admin'){
  root=document.createElement('div');root.id='fleet-root';root.className='fl';
  const h=$('.pageheading');if(h)h.after(root);else $('#app').append(root);
  bind();full();
 }
 let sig=JSON.stringify([me(),me()&&roleOf(me().id)]);
 const rerender=()=>{register();enforce();navLinks();decorate();if(root)full()};
 setInterval(()=>{
  const s=JSON.stringify([me(),me()&&roleOf(me().id)]);
  if(s!==sig){sig=s;rerender();return}
  decorate();
  { const n=openTickets();if(n!==lastN){const first=lastN===-1;lastN=n;navLinks();if(!first&&page==='admin'&&tab==='support'&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName))full()} }
  if(page==='driver'){driverTick();const u=me(),r=u&&roleOf(u.id),b=r&&BUSES.find(x=>x.id===r.bus);const i=b&&info(b);const k=i?(i.off?'off':i.stopped?'stop':'on')+(i.rec?i.rec.state:''):'';if(k!==lastKey){lastKey=k;full()}}
  if(page==='admin'&&tab==='buses'){const n=$('#fl-now');if(n)n.textContent=fmtMin(nowMin())}
 },1000);
 window.addEventListener('storage',e=>{if(e.key&&e.key.startsWith('aq-')){sig=JSON.stringify([me(),me()&&roleOf(me().id)]);if(page==='admin'&&document.activeElement?.tagName==='INPUT')return;rerender()}});
 const app=$('#app');
 if(app){let q=0;new MutationObserver(()=>{if(q)return;q=requestAnimationFrame(()=>{q=0;decorate()})}).observe(app,{childList:true,subtree:true})}
});
window.AqylFleet={info,isBlocked,roleOf,sched,nowMin,busRec,activeAnn,annText,isDev};
})();
