/* AqylJol — кабинет водителя, администрирование и ночное расписание.
   ВАЖНО: сайта-сервера нет, всё хранится в localStorage этого браузера (как и аккаунты в auth.js).
   Роли и блокировки работают в пределах одного браузера. Для настоящей защиты нужен бэкенд. */
(()=>{
'use strict';
const OWNERS=['aasetuly25@apec.edu.kz'];
const K={roles:'aq-fleet-roles',people:'aq-fleet-people',status:'aq-fleet-status',sched:'aq-fleet-sched',log:'aq-fleet-log',clock:'aq-fleet-clock',session:'aq-auth-session',users:'aq-auth-users',tickets:'aq-db-tickets'};
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
const isOwner=u=>!!u&&roleOf(u.id).role==='owner'&&!isBlocked(u.id);
const isAdmin=u=>!!u&&['admin','owner'].includes(roleOf(u.id).role)&&!isBlocked(u.id);
const canManage=u=>isOwner(u)||(isAdmin(u)&&roleOf(u.id).city===curCity()); // городской админ работает только в своём городе
function everyone(){
 const out={},au=rd(K.users,{});
 for(const[id,u]of Object.entries(au))out[id]={id,name:u.name||(u.email?u.email.split('@')[0]:'Пользователь'),contact:u.email||(u.phone?'+'+u.phone:''),city:u.city};
 for(const[id,u]of Object.entries(rd(K.people,{})))out[id]={...out[id],...u};
 for(const[id,r]of Object.entries(roles()))if(!out[id])out[id]={id,name:r.name||id,contact:r.contact||'',city:r.city};
 return Object.values(out).sort((a,b)=>a.name.localeCompare(b.name,'ru'));
}
function register(){
 const u=me();if(!u||isBlocked(u.id))return;
 const c=roleOf(u.id).city||curCity(),p=rd(K.people,{}),o=p[u.id];
 if(!o||o.name!==u.name||o.contact!==u.contact||o.city!==c){p[u.id]={id:u.id,name:u.name,contact:u.contact,city:c,seen:Date.now()};wr(K.people,p)}
 ensureOwner(u);
}
/* Главный админ назначается автоматически (кнопки «Стать администратором» больше нет) */
function ensureOwner(u){
 const all=roles(),ent=Object.entries(all);
 if(ent.some(([,r])=>r.role==='owner'))return;
 const idn=u.id.toLowerCase();
 const listed=OWNERS.some(x=>{x=String(x).toLowerCase().trim();return x&&x.includes('@')&&String(u.contact||'').toLowerCase()===x});
 const legacy=ent.find(([,r])=>r.role==='admin');
 let make=null;
 if(OWNERS.length)make=listed?u.id:null;
 else if(legacy)make=legacy[0];
 else if(Object.keys(rd(K.users,{})).length<=1)make=u.id;
 if(!make)return;
 all[make]={...(all[make]||{}),role:'owner',bus:null,blocked:false,...(make===u.id?{name:u.name,contact:u.contact}:{})};
 for(const[id,r]of Object.entries(all))if(r.role==='admin'&&!r.city)all[id]={...r,city:curCity()};
 wr(K.roles,all);log((all[make].name||make)+' — главный администратор');
}
function enforce(){const u=me();if(!u||!isBlocked(u.id))return;if(window.AqylAuth?.logout)AqylAuth.logout();else try{localStorage.removeItem(K.session)}catch{}setTimeout(()=>say('Ваш аккаунт заблокирован администратором'),30)}
function log(text){const l=rd(K.log,[]);l.unshift({t:Date.now(),text,city:curCity()});wr(K.log,l.slice(0,100))}

/* ---------- статус автобуса ---------- */
const skey=(c,id)=>c+':'+id;
const rawStatus=(c,id)=>rd(K.status,{})[skey(c,id)]||null;
function info(b,c){
 const id=typeof b==='object'?b.id:String(b);c=c||curCity();
 const sc=sched(id,c),m=nowMin(),rec=rawStatus(c,id),live=rec&&rec.day===today()?rec:null;
 const inWin=sc.mode==='on'?true:sc.mode==='off'?false:inWindow(m,sc);
 const base={id,start:sc.start,end:sc.end,mode:sc.mode,rec:live,driver:live?.name||''};
 if(!inWin)return{...base,off:true,night:sc.mode==='auto',why:sc.mode==='off'?'Маршрут остановлен администратором':'Рейсы закончились в '+sc.end+' · возобновятся в '+sc.start};
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
 if(u&&isAdmin(u)){const n=openTickets();items.push(['admin','admin.html',SHIELD,'Админ'+(n?` <b class="fl-nb">${n}</b>`:'')])}
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
  const html=i.off?`<span class="fl-pill fl-pill-off">${i.night?'🌙':'⛔'} ${esc(i.why)}</span>`:i.stopped?`<span class="fl-pill fl-pill-stop">⏸ Стоит: ${esc(i.reason)}</span>`:i.rec&&i.rec.state==='moving'?`<span class="fl-pill fl-pill-go">▶ В движении (отметка водителя)</span>`:'';
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
 if(r.role==='admin'||r.role==='owner')return card(`<h2>Вы администратор</h2><p class="muted">Управление автобусами и водителями — на странице администрирования.</p><a class="primary fl-wide" href="${linkTo('admin.html')}">Открыть администрирование</a>`);
 if(r.role!=='driver')return card(`<h2>Доступ не выдан</h2><p class="muted">Аккаунт «${esc(u.name)}» не назначен водителем. Попросите администратора выдать вам роль водителя и автобус.</p>`);
 const b=typeof BUSES!=='undefined'&&BUSES.find(x=>x.id===r.bus);
 if(!b)return card(`<h2>Автобус не назначен</h2><p class="muted">Администратор ещё не закрепил за вами маршрут.</p>`);
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
 <section class="card fl-card"><h2>Мои последние отметки</h2>${logs.length?`<ul class="fl-log">${logs.map(l=>`<li><time>${when(l.t)}</time>${esc(l.text.replace(u.name+' · ',''))}</li>`).join('')}</ul>`:'<p class="muted">Пока нет отметок.</p>'}</section>`;
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
  else if(sc.mode==='off')t='Маршрут остановлен администратором';
  else if(!i.off&&endM!==null){let left=(endM-m)*60;if(left<0)left+=86400;t+=` · до конца рейсов ${dur(left)}`}
  w.textContent=t;
 }
}

/* ---------- администрирование ---------- */
let tab='people',filter='all',query='';
function adminView(){
 const u=me();
 if(!u)return loginCard('Войдите, чтобы управлять водителями и автобусами.');
 if(!isAdmin(u))return card(`<h2>Нет доступа</h2><p class="muted">Эта страница только для администраторов. Права выдаёт администратор вашего города.</p>`);
 const r=roleOf(u.id),n=openTickets();
 const tabs=[['people','Люди'],['buses','Автобусы'],['support','Поддержка'+(n?' · '+n:'')],['log','Журнал']];
 const who=isOwner(u)?'Главный админ · все города':'Админ города '+cname(r.city)+' · другие города вам недоступны';
 return `<p class="fl-note">${esc(who)}</p><div class="fl-tabs" role="tablist">${tabs.map(([id,l])=>`<button class="chip ${tab===id?'active':''}" role="tab" aria-selected="${tab===id}" data-fl-tab="${id}">${l}</button>`).join('')}</div>`+(tab==='people'?peopleView(u):tab==='buses'?busesView(u):tab==='support'?supportAdminView(u):logView(u));
}
function scoped(u){
 const my=roleOf(u.id).city;
 return everyone().filter(p=>isOwner(u)?(cityFilter==='all'||(p.city||curCity())===curCity()):p.city===my);
}
function peopleView(u){
 const all=scoped(u),rs=roles(),owner=isOwner(u);
 const cnt={all:all.length,driver:all.filter(p=>rs[p.id]?.role==='driver').length,admin:all.filter(p=>['admin','owner'].includes(rs[p.id]?.role)).length,blocked:all.filter(p=>rs[p.id]?.blocked).length};
 return `<section class="card fl-card"><div class="fl-stats"><div><b>${cnt.all}</b><span>Всего</span></div><div><b>${cnt.driver}</b><span>Водителей</span></div><div><b>${cnt.admin}</b><span>Админов</span></div><div><b>${cnt.blocked}</b><span>Заблок.</span></div></div>
 <input class="search" id="fl-search" placeholder="Имя или почта" aria-label="Поиск людей" value="${esc(query)}">
 <div class="filters">${[['all','Все'],['driver','Водители'],['admin','Админы'],['blocked','Заблокированные']].map(([id,l])=>`<button class="chip ${filter===id?'active':''}" data-fl-filter="${id}" aria-pressed="${filter===id}">${l} · ${cnt[id]}</button>`).join('')}${owner?`<button class="chip ${cityFilter==='all'?'active':''}" data-fl-cityf="${cityFilter==='all'?'cur':'all'}">${cityFilter==='all'?'Только '+esc(cityName()):'Все города'}</button>`:''}</div>
 <ul class="fl-people" id="fl-people">${peopleRows(u)}</ul>
 <p class="fl-note">${owner?'Показан город '+esc(cityName())+(cityFilter==='all'?' и остальные города':'')+'. ':'Вы видите только людей из города '+esc(cityName())+'. '}Люди появляются в списке после регистрации или входа.</p></section>`;
}
function peopleRows(u){
 const rs=roles(),q=query.trim().toLowerCase(),owner=isOwner(u);
 const list=scoped(u).filter(p=>{const r=rs[p.id]||{};const rl=r.role==='owner'?'admin':r.role;return(!q||(p.name+' '+p.contact).toLowerCase().includes(q))&&(filter==='all'||(filter==='blocked'?r.blocked:rl===filter))});
 if(!list.length)return '<li class="empty">Никого не найдено.</li>';
 return list.map(p=>{
  const r=rs[p.id]||{role:'user',bus:null,blocked:false},self=p.id===u.id;
  const tOwner=r.role==='owner',tAdmin=r.role==='admin',sameCity=(p.city||curCity())===curCity();
  const label=r.blocked?'Заблокирован':tOwner?'Главный админ':tAdmin?'Админ · '+cname(r.city):r.role==='driver'?'Водитель · №'+r.bus:'Пассажир';
  const cls=r.blocked?'blocked':(tOwner||tAdmin)?'admin':r.role;
  const opts=BUSES.map(b=>`<option value="${b.id}" ${r.bus===b.id?'selected':''}>№${b.id} · ${esc(b.name)}</option>`).join('');
  let act='';
  if(!self&&!tOwner){
   if(!r.blocked&&!tAdmin&&sameCity)act+=`<select data-fl-bus aria-label="Автобус для ${esc(p.name)}">${opts}</select><button class="fl-btn fl-primary" data-fl-act="driver">${r.role==='driver'?'Сменить автобус':'Назначить водителем'}</button>`;
   if(!r.blocked&&!tAdmin)act+=(owner&&typeof CITIES!=='undefined'?`<select data-fl-acity aria-label="Город админа">${Object.entries(CITIES).map(([id,c])=>`<option value="${id}" ${id===(p.city||curCity())?'selected':''}>${esc(c.name)}</option>`).join('')}</select>`:'')+`<button class="fl-btn" data-fl-act="admin">Сделать админом${owner?' города':''}</button>`;
   if(tAdmin&&owner&&!r.blocked)act+=`<button class="fl-btn" data-fl-act="admin">Снять админа</button>`;
   if(r.role==='driver'&&!r.blocked)act+=`<button class="fl-btn" data-fl-act="unrole">Снять роль</button>`;
   if(tAdmin&&!owner)act+=`<span class="fl-note">Снять или заблокировать админа может только главный админ</span>`;
   else act+=`<button class="fl-btn ${r.blocked?'':'fl-danger'}" data-fl-act="block">${r.blocked?'Разблокировать':'Заблокировать'}</button>`;
  }
  return `<li class="fl-person ${r.blocked?'is-blocked':''}" data-uid="${esc(p.id)}">
   <span class="fl-ava">${esc(initials(p.name))}</span>
   <div class="fl-pinfo"><strong>${esc(p.name)}${self?' <em>(вы)</em>':''}</strong><span>${esc(p.contact||p.id)}${p.city?' · '+esc(cname(p.city)):''}</span><span class="fl-role fl-role-${cls}">${esc(label)}</span></div>
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
 const list=ticketsFor(u).sort((a,b)=>(a.status==='new'?0:a.status==='answered'?1:2)-(b.status==='new'?0:b.status==='answered'?1:2)||b.ts-a.ts).slice(0,50);
 return card(`<h2>Обращения в поддержку</h2>${list.length?`<ul class="fl-tickets">${list.map(t=>`<li class="fl-ticket fl-tk-${t.status}" data-tid="${esc(t.id)}">
  <div class="fl-tkhead"><strong>${esc(t.name)}</strong><span class="fl-note">${esc(t.contact||'')} · ${esc(cname(t.city))} · ${when(t.ts)}</span><span class="fl-role fl-role-${t.status==='new'?'blocked':t.status==='done'?'user':'driver'}">${TK[t.status]}</span></div>
  <p class="fl-tktext">${esc(t.text)}</p>
  ${t.reply?`<p class="fl-tkreply"><b>Ответ:</b> ${esc(t.reply)}</p>`:''}
  ${t.status==='done'?'':`<div class="fl-row"><input class="fl-tkin" data-fl-reply placeholder="Ответ пользователю" maxlength="400"><button class="fl-btn fl-primary" data-fl-tk="reply">Ответить</button><button class="fl-btn" data-fl-tk="done">Решено</button></div>`}
 </li>`).join('')}</ul>`:'<p class="muted">Обращений пока нет.</p>'}<p class="fl-note">${isOwner(u)?'Вы видите обращения всех городов.':'Вы видите обращения только города '+esc(cname(roleOf(u.id).city))+'.'}</p>`);
}
function tkAct(act,li){
 const u=me();if(!isAdmin(u))return say('Нужны права администратора');
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
 const mine=u?tickets().filter(t=>t.uid===u.id).sort((a,b)=>b.ts-a.ts).slice(0,4):[];
 const sig=(u?u.id:'-')+'|'+curCity()+'|'+JSON.stringify(mine.map(t=>[t.id,t.status,t.reply]));
 if(el.dataset.sig===sig)return;el.dataset.sig=sig;
 const adm=Object.values(roles()).some(r=>r.role==='admin'&&!r.blocked&&r.city===curCity());
 el.innerHTML=`<h2>Техподдержка</h2>`+(u?`<p class="muted">Опишите проблему — сообщение получит ${adm?'администратор города '+esc(cityName()):'главный администратор (в городе '+esc(cityName())+' пока нет своего админа)'}.</p>
  <textarea id="fl-sup-text" class="fl-textarea" rows="3" maxlength="600" placeholder="Что случилось?"></textarea>
  <button class="primary fl-wide" data-fl-sup="send">Отправить в поддержку</button>
  ${mine.length?`<ul class="fl-tickets">${mine.map(t=>`<li class="fl-ticket"><div class="fl-tkhead"><span class="fl-note">${when(t.ts)}</span><span class="fl-role fl-role-${t.status==='new'?'blocked':t.status==='done'?'user':'driver'}">${TK[t.status]}</span></div><p class="fl-tktext">${esc(t.text)}</p>${t.reply?`<p class="fl-tkreply"><b>Ответ:</b> ${esc(t.reply)}</p>`:''}</li>`).join('')}</ul>`:''}`
  :`<p class="muted">Чтобы написать в поддержку, войдите в аккаунт.</p><button class="primary fl-wide" data-au-open>Войти</button>`);
}
function sendTicket(){
 const u=me();if(!u)return;
 const text=($('#fl-sup-text')?.value||'').trim();
 if(text.length<5)return say('Опишите проблему подробнее (от 5 символов)');
 if(tickets().some(t=>t.uid===u.id&&Date.now()-t.ts<20000))return say('Подождите немного перед следующим сообщением');
 const id='t'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
 tkT().set(id,{id,uid:u.id,name:u.name,contact:u.contact,city:curCity(),text:text.slice(0,600),ts:Date.now(),status:'new',reply:'',replyAt:0});
 const el=$('#fl-sup-text');if(el)el.value='';
 say('Сообщение отправлено администратору');supportCard();
}

/* ---------- действия администратора ---------- */
function adminAct(act,li){
 const u=me();
 if(!isAdmin(u))return say('Нужны права администратора');
 if(!canManage(u))return say('Это не ваш город');
 const owner=isOwner(u),all=roles();
 if(act==='clock-on'||act==='clock-off'){
  if(!owner)return say('Только главный администратор');
  if(act==='clock-on'){const m=toMin($('#fl-test')?.value);if(m===null)return say('Введите время ЧЧ:ММ');wr(K.clock,{on:true,base:m,since:Date.now()});log(u.name+' включил тестовое время '+fmtMin(m))}
  else{wr(K.clock,{on:false});log(u.name+' вернул реальное время')}
  return full();
 }
 if(act==='export'){
  if(!owner)return say('Только главный администратор');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(AqylDB.exportAll(),null,1)],{type:'application/json'}));a.download='aqyljol-db.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);return;
 }
 if(act==='all21'){const s=rd(K.sched,{});BUSES.forEach(b=>{s[curCity()+':'+b.id]={...sched(b.id),end:'21:00'}});wr(K.sched,s);log(u.name+': рейсы всех маршрутов заканчиваются в 21:00');say('Готово: все маршруты до 21:00');return full()}
 const uid=li?.dataset.uid;if(!uid)return;
 const p=everyone().find(x=>x.id===uid);if(!p)return;
 const cur=all[uid]||{role:'user',bus:null,blocked:false};
 const pc=p.city||curCity();
 if(!owner&&pc!==roleOf(u.id).city)return say('Этот человек из другого города');
 if(cur.role==='owner')return say('Главного администратора менять нельзя');
 const save=(patch,text)=>{all[uid]={...cur,...patch,name:p.name,contact:p.contact||'',city:patch.city||cur.city||pc};wr(K.roles,all);log(u.name+': '+text);full()};
 if(act==='driver'){
  if(cur.role==='admin')return say('Сначала админа должен снять главный администратор');
  if(pc!==curCity())return say('Водителя можно назначить только в городе '+cityName());
  const bus=$('[data-fl-bus]',li)?.value;if(!bus)return;
  save({role:'driver',bus,city:curCity()},p.name+' назначен водителем №'+bus);say(p.name+' — водитель №'+bus);
 }
 else if(act==='unrole'){if(cur.role!=='driver')return;save({role:'user',bus:null},'у '+p.name+' снята роль водителя')}
 else if(act==='admin'){
  if(cur.role==='admin'){
   if(!owner)return say('Снять админа может только главный администратор');
   save({role:'user',bus:null},p.name+' больше не администратор');
  }else{
   if(cur.blocked)return say('Сначала разблокируйте человека');
   const ac=owner?($('[data-fl-acity]',li)?.value||pc):roleOf(u.id).city;
   save({role:'admin',bus:null,city:ac},p.name+' назначен администратором города '+cname(ac));say(p.name+' — админ города '+cname(ac));
  }
 }
 else if(act==='block'){
  if(uid===u.id)return say('Нельзя заблокировать себя');
  if(cur.role==='admin'&&!owner)return say('Блокировать админов может только главный администратор');
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
  const t=e.target.closest('button,[data-fl-act]');if(!t)return;
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
  if(t.dataset.flForce){const u=me();if(!isAdmin(u)||!canManage(u))return say('Нужны права администратора города');const id=t.closest('[data-bus]').dataset.bus;setState(id,t.dataset.flForce,t.dataset.flForce==='stopped'?'Решение администратора':'');return full()}
  if(t.dataset.flAct)adminAct(t.dataset.flAct,t.closest('[data-uid]'));
 });
 root.addEventListener('change',e=>{
  const s=e.target.closest('[data-fl-sch]');if(!s)return;
  const u=me();if(!isAdmin(u)||!canManage(u))return say('Нужны права администратора города');
  const art=s.closest('[data-bus]'),id=art.dataset.bus;
  const start=$('[data-fl-sch=start]',art).value,end=$('[data-fl-sch=end]',art).value,mode=$('[data-fl-sch=mode]',art).value;
  if(toMin(start)===null||toMin(end)===null)return say('Введите время ЧЧ:ММ');
  const all=rd(K.sched,{});all[curCity()+':'+id]={start,end,mode};wr(K.sched,all);
  log(u.name+': №'+id+' — '+start+'–'+end+', режим «'+MODES[mode]+'»');say('Расписание №'+id+' сохранено');full();
 });
 root.addEventListener('input',e=>{if(e.target.id==='fl-search'){query=e.target.value;const ul=$('#fl-people');if(ul)ul.innerHTML=peopleRows(me())}});
}

/* ---------- запуск ---------- */
hook();
document.addEventListener('DOMContentLoaded',()=>{
 hook();register();enforce();
 { // город админа/водителя закреплён: в чужой город они не заходят в кабинет
  const u0=me(),r0=u0&&roleOf(u0.id);
  if(r0&&(r0.role==='admin'||r0.role==='driver')&&(page==='admin'||page==='driver')&&r0.city&&r0.city!==curCity()&&typeof CITIES!=='undefined'&&CITIES[r0.city]){location.replace(page+'.html?city='+r0.city);return}
  if(r0&&r0.role==='admin'&&page==='admin'){const sel=$('#city');if(sel){sel.disabled=true;sel.title='Вы администратор города '+cname(r0.city)}}
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
window.AqylFleet={info,isBlocked,roleOf,sched,nowMin};
})();
