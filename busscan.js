/* AqylJol — схема салона автобуса и «данные ИИ».
   ВАЖНО: это демонстрация. Настоящего ИИ-сканирования салона нет: «скан» собирается из условных данных сайта
   (число свободных мест автобуса + типичный состав пассажиров по дню недели и времени суток).
   Для реальной работы нужны камеры/счётчики пассажиров в автобусах и сервер, который присылает такие данные.
   Что внутри:
   — AqylScan.panel(bus)   схема салона сверху: места, люди точками, индекс комфорта, кондиционер; схему можно вращать;
   — «скан ИИ» раз в SCAN_MS (сейчас 5 минут — тестовый режим), одинаковый на всех страницах этого браузера;
   — кнопка «Схема салона» под кнопками в карточках автобусов (Маршруты, Поездки, Карта);
   — на главной: «Как оформить карту», «Льготные тарифы», «Данные ИИ о маршрутах» с историей каждого маршрута;
   — AqylScan.history(bus) / summary(bus) — для помощника. */
(()=>{
'use strict';
if(typeof BUSES==='undefined'||typeof CITIES==='undefined')return;

const SCAN_MS=5*60*1000;          // ТЕСТ: интервал «скана» ИИ. Для боевого режима поставьте нужное значение.
/* Тарифы. regular — как FARE в wallet.js. Для остальных категорий впишите сумму числом, например school:40;
   пока null — на сайте написано «по льготной карточке, размер уточняйте у перевозчика». */
const TARIFFS={regular:80,school:null,student:null,pensioner:null,benefit:null};

const page=document.body.dataset.page||'home';
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const hhmm=t=>{const d=new Date(t);return pad(d.getHours())+':'+pad(d.getMinutes())};
const mmss=ms=>{const s=Math.max(0,Math.ceil(ms/1000));return Math.floor(s/60)+':'+pad(s%60)};
const mem={};
const rd=k=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):null}catch{const v=mem[k];return v?JSON.parse(v):null}};
const wr=(k,v)=>{mem[k]=JSON.stringify(v);try{localStorage.setItem(k,mem[k])}catch{}};
const stopName=i=>CITIES[city].stops[i];
const bus=id=>BUSES.find(b=>b.id===String(id));

/* ---------- псевдослучайные числа (чтобы схема не «прыгала» между перерисовками) ---------- */
function hash(s){let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
function shuffle(arr,r){const a=arr.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}

/* ---------- состав пассажиров по дню и времени ---------- */
const KINDS={school:{t:'Школьники',c:'#2f7bdc'},pens:{t:'Пенсионеры',c:'#e0a21a'},stud:{t:'Студенты',c:'#8a4fd1'},adult:{t:'Взрослые',c:'#1d9a78'}};
function shares(now){
 const d=new Date(now),wd=d.getDay(),weekday=wd>=1&&wd<=5,h=d.getHours()+d.getMinutes()/60;
 let school=.04,pens=.14,stud=.1;
 if(weekday){
  if(h>=7&&h<9)school=.42;else if(h>=12.5&&h<15.5)school=.38;else if(h>=15.5&&h<17.5)school=.2;
  if(h>=9&&h<13)pens=.34;else if(h>=13&&h<16)pens=.2;
  if(h>=8&&h<19)stud=.18;
 }
 const adult=Math.max(.1,1-school-pens-stud),sum=school+pens+stud+adult;
 return{school:school/sum,pens:pens/sum,stud:stud/sum,adult:adult/sum};
}
function counts(total,sh){
 const keys=Object.keys(KINDS),raw=keys.map(k=>sh[k]*total),base=raw.map(Math.floor);
 let left=total-base.reduce((a,b)=>a+b,0);
 raw.map((v,i)=>[v-Math.floor(v),i]).sort((a,b)=>b[0]-a[0]).forEach(([,i])=>{if(left>0){base[i]++;left--}});
 return Object.fromEntries(keys.map((k,i)=>[k,base[i]]));
}

/* ---------- «скан ИИ» ---------- */
const skey=b=>`aq-scan:${city}:${b.id}`;
function makeScan(b,now){
 const cap=b.capacity,free=Math.max(0,Math.min(cap,b.seats)),occ=cap-free;
 const r=rng(hash(city+'|'+b.id+'|'+Math.floor(now/SCAN_MS)));
 const load=occ/cap;
 const standing=load>=.85?Math.min(cap,Math.round((load-.85)/.15*cap*.5+r()*2)):0;
 const seats=shuffle([...Array(cap).keys()],r).slice(0,occ).sort((a,c)=>a-c);
 const total=occ+standing,cnt=counts(total,shares(now));
 const pool=[];Object.keys(KINDS).forEach(k=>{for(let i=0;i<cnt[k];i++)pool.push(k)});
 return{t:now,cap,free,occ,standing,total,seats,cnt,who:shuffle(pool,r),jit:Math.floor(r()*1e6),ac:null};
}
function scan(b,force){
 const now=Date.now();let rec=rd(skey(b));
 if(!force&&rec&&rec.t<=now&&now-rec.t<SCAN_MS&&rec.cap===b.capacity)return rec;
 rec=makeScan(b,now);wr(skey(b),rec);return rec;
}
const comfortOf=(b,rec)=>comfortScore({...b,seats:rec.free});
const acOf=b=>{try{return window.AqylFleet&&AqylFleet.busRec?AqylFleet.busRec(city,b.id).ac:undefined}catch{return undefined}};

/* ---------- геометрия салона (вид сверху, перед автобуса справа) ---------- */
function geom(cap){
 const cols=Math.ceil(cap/4),x0=46,cw=26,L=x0+cols*cw+62,H=146;
 const seatY=[20,44,102,126];
 const seats=[...Array(cap).keys()].map(i=>({i,x:x0+Math.floor(i/4)*cw,y:seatY[i%4]}));
 const slots=[];
 const doorX=L-52,midX=x0+Math.round(cols*.45)*cw+4;
 [[doorX,112],[doorX+14,126],[midX,112],[midX+14,126]].forEach(p=>slots.push(p));
 for(let c=cols-1;c>=0;c--)[73,63,83].forEach(y=>slots.push([x0+c*cw+10,y]));
 [[L-26,73],[L-26,60],[L-26,86],[x0-16,73],[x0-16,61],[x0-16,85]].forEach(p=>slots.push(p));
 return{cols,x0,cw,L,H,seats,slots,doorX,midX};
}
const SEAT=20;
function layers(b,rec){
 const g=geom(rec.cap),r=rng(rec.jit||1);
 const seatSet=new Set(rec.seats),who=rec.who.slice();
 let wi=0;const seatWho={};
 rec.seats.forEach(i=>{seatWho[i]=who[wi++]});
 const standWho=who.slice(wi);
 const svg=(inner)=>`<svg class="bs-svg" viewBox="0 0 ${g.L} ${g.H}" width="${g.L}" height="${g.H}" aria-hidden="true" focusable="false">${inner}</svg>`;
 /* слой 1: корпус */
 const wheel=(x,y)=>`<rect x="${x}" y="${y}" width="30" height="8" rx="3" class="bs-wheel"/>`;
 const body=`<rect x="6" y="8" width="${g.L-12}" height="${g.H-16}" rx="24" class="bs-body"/>
  <rect x="16" y="62" width="${g.L-62}" height="22" rx="8" class="bs-aisle"/>
  <path d="M${g.L-30} 20 Q${g.L-8} 30 ${g.L-8} 73 Q${g.L-8} 116 ${g.L-30} 126" class="bs-glass"/>
  <path d="M26 24 Q14 36 14 73 Q14 110 26 122" class="bs-glass bs-rear"/>
  ${wheel(g.L-96,2)}${wheel(g.L-96,g.H-10)}${wheel(36,2)}${wheel(36,g.H-10)}
  <rect x="${g.doorX-10}" y="${g.H-14}" width="34" height="6" rx="3" class="bs-door"/>
  <rect x="${g.midX-10}" y="${g.H-14}" width="34" height="6" rx="3" class="bs-door"/>
  <circle cx="${g.L-30}" cy="36" r="9" class="bs-wheelsteer"/><circle cx="${g.L-30}" cy="36" r="3" class="bs-wheelhub"/>
  <text x="${g.L-30}" y="58" text-anchor="middle" class="bs-label">водитель</text>`;
 /* слой 2: сиденья */
 const seatsSvg=g.seats.map(s=>{
  const on=seatSet.has(s.i);
  return `<g class="bs-seat ${on?'is-on':''}"><rect x="${s.x}" y="${s.y}" width="${SEAT}" height="${SEAT}" rx="5" class="bs-seatbase"/><rect x="${s.x}" y="${s.y+2}" width="5" height="${SEAT-4}" rx="2" class="bs-seatback"/></g>`;
 }).join('');
 /* слой 3: люди — точки */
 const dot=(x,y,k,stand)=>`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${stand?6.5:6}" fill="${KINDS[k].c}" class="bs-person ${stand?'is-stand':''}"/>`;
 const people=rec.seats.map(i=>{const s=g.seats[i];return dot(s.x+SEAT/2+2,s.y+SEAT/2,seatWho[i]||'adult',false)}).join('')
  +standWho.slice(0,g.slots.length).map((k,n)=>{const p=g.slots[n];return dot(p[0]+(r()-.5)*5,p[1]+(r()-.5)*5,k,true)}).join('');
 return{g,body:svg(body),seats:svg(seatsSvg),people:svg(people)};
}

/* ---------- панель схемы ---------- */
const ROT={};  // состояние вращения каждого автобуса: {rx,rz}
const rotOf=id=>ROT[id]||(ROT[id]={rx:0,rz:0});
const modelCss=id=>{const r=rotOf(id);return `transform:rotateX(${r.rx}deg) rotateZ(${r.rz}deg)`};
const tierWord=sc=>comfortLabel(sc);
function legend(rec){
 return `<ul class="bs-legend">${Object.entries(KINDS).map(([k,v])=>`<li><i style="background:${v.c}"></i>${v.t}<b>${rec.cnt[k]}</b></li>`).join('')}</ul>`;
}
function inner(b,rec,compact){
 const L=layers(b,rec),sc=comfortOf(b,rec),ac=acOf(b);
 const next=rec.t+SCAN_MS-Date.now();
 const scale=compact?.92:1;
 return `<div class="bs-head">
  <span class="bs-scan"><span class="live-dot"></span> Скан ИИ · <b>${hhmm(rec.t)}</b></span>
  <span class="bs-next">следующий через <b data-sc-count="${esc(b.id)}">${mmss(next)}</b></span>
 </div>
 <div class="bs-stage" tabindex="0" role="group" aria-label="Схема салона автобуса №${esc(b.id)} сверху. Потяните, чтобы повернуть; стрелки на клавиатуре тоже вращают." data-bs-stage="${esc(b.id)}" data-w="${L.g.L}" data-h="${L.g.H}" style="--bs-w:${L.g.L}px;--bs-h:${L.g.H}px;--bs-s:${scale}">
  <div class="bs-model" style="${modelCss(b.id)}">
   <div class="bs-layer bs-l0">${L.body}</div><div class="bs-layer bs-l1">${L.seats}</div><div class="bs-layer bs-l2">${L.people}</div>
  </div>
  <span class="bs-hint">Потяните, чтобы повернуть</span>
 </div>
 <div class="bs-tools" role="group" aria-label="Вращение схемы">
  <button type="button" class="chip" data-bs-rot="-45" aria-label="Повернуть влево">⟲</button>
  <button type="button" class="chip" data-bs-rot="45" aria-label="Повернуть вправо">⟳</button>
  <button type="button" class="chip" data-bs-view="top">Сверху</button>
  <button type="button" class="chip" data-bs-view="tilt">Под углом</button>
 </div>
 <div class="bs-stats">
  <div><b>${rec.occ}</b><span>занято мест из ${rec.cap}</span></div>
  <div><b>${rec.standing}</b><span>${rec.standing===1?'стоит':'стоят'}</span></div>
  <div><b>${rec.total}</b><span>человек в салоне</span></div>
  <div class="bs-cf bs-cf-${comfortTier(sc)}"><b>${sc.toFixed(1)}</b><span>индекс комфорта · ${esc(tierWord(sc))}</span></div>
 </div>
 <div class="bs-chips">
  <span class="bs-chip">${ac===true?'❄ Кондиционер включён':ac===false?'Кондиционер выключен':'Кондиционер: нет отметки водителя'}</span>
  <span class="bs-chip">${rec.free} свободных мест</span>
 </div>
 ${legend(rec)}
 <p class="bs-note">Тестовый режим: данные «ИИ» условные, скан обновляется каждые ${Math.round(SCAN_MS/60000)} мин.</p>`;
}
function panel(b,opts){
 const rec=scan(b);
 return `<div class="bs" data-bs="${esc(b.id)}" data-t="${rec.t}" data-ac="${esc(String(acOf(b)))}" ${opts&&opts.compact?'data-compact="1"':''}>${inner(b,rec,opts&&opts.compact)}</div>`;
}
function refreshPanel(el){
 const b=bus(el.dataset.bs);if(!b)return;
 const rec=scan(b);
 if(el.dataset.t===String(rec.t)&&el.dataset.ac===String(acOf(b)))return;
 el.dataset.t=rec.t;el.dataset.ac=String(acOf(b));
 el.innerHTML=inner(b,rec,!!el.dataset.compact);
 requestAnimationFrame(fitAll);
}

/* ---------- вращение: мышь, палец, клавиатура ---------- */
let drag=null;
const clamp=(v,a,c)=>Math.max(a,Math.min(c,v));
/* масштаб схемы под ширину блока и высота рамки под текущий поворот (повёрнутый автобус занимает больше места по вертикали) */
function sizeStage(st){
 const id=st.dataset.bsStage,r=rotOf(id),w=+st.dataset.w||300,h=+st.dataset.h||146;
 const avail=Math.max(120,st.clientWidth-24),s=Math.min(1,avail/w);
 if(Math.abs((parseFloat(st.style.getPropertyValue('--bs-s'))||1)-s)>.005)st.style.setProperty('--bs-s',s.toFixed(3));
 const a=r.rz*Math.PI/180,need=(Math.abs(Math.cos(a))*h+Math.abs(Math.sin(a))*w)*s;
 st.style.minHeight=Math.round(need+64)+'px';
}
const fitAll=()=>document.querySelectorAll('[data-bs-stage]').forEach(sizeStage);
addEventListener('resize',fitAll);
function applyRot(id){document.querySelectorAll(`[data-bs-stage="${CSS.escape(id)}"]`).forEach(st=>{const m=st.querySelector('.bs-model');if(m)m.style.transform=`rotateX(${rotOf(id).rx}deg) rotateZ(${rotOf(id).rz}deg)`;sizeStage(st)})}
document.addEventListener('pointerdown',e=>{
 const st=e.target.closest('[data-bs-stage]');if(!st||e.button>0)return;
 const id=st.dataset.bsStage;drag={id,x:e.clientX,y:e.clientY,st};
 try{st.setPointerCapture(e.pointerId)}catch{}
 st.classList.add('is-drag');
});
document.addEventListener('pointermove',e=>{
 if(!drag)return;
 const r=rotOf(drag.id);
 r.rz=(r.rz+(e.clientX-drag.x)*.6)%360;
 r.rx=clamp(r.rx-(e.clientY-drag.y)*.4,0,72);
 drag.x=e.clientX;drag.y=e.clientY;applyRot(drag.id);
});
const endDrag=()=>{if(drag){drag.st.classList.remove('is-drag');drag=null}};
document.addEventListener('pointerup',endDrag);document.addEventListener('pointercancel',endDrag);
document.addEventListener('keydown',e=>{
 const st=e.target.closest&&e.target.closest('[data-bs-stage]');if(!st)return;
 const r=rotOf(st.dataset.bsStage);let ok=true;
 if(e.key==='ArrowLeft')r.rz-=15;else if(e.key==='ArrowRight')r.rz+=15;else if(e.key==='ArrowUp')r.rx=clamp(r.rx+10,0,72);else if(e.key==='ArrowDown')r.rx=clamp(r.rx-10,0,72);else ok=false;
 if(ok){e.preventDefault();applyRot(st.dataset.bsStage)}
});

/* ---------- клики ---------- */
const OPEN=new Set();
document.addEventListener('click',e=>{
 const rot=e.target.closest('[data-bs-rot]'),view=e.target.closest('[data-bs-view]'),tg=e.target.closest('[data-bs-toggle]'),ch=e.target.closest('[data-ai-bus]');
 if(rot||view){
  const id=(rot||view).closest('[data-bs]').dataset.bs,r=rotOf(id);
  if(rot)r.rz=(r.rz+Number(rot.dataset.bsRot))%360;
  else if(view.dataset.bsView==='top'){r.rx=0;r.rz=0}else{r.rx=55;r.rz=-25}
  applyRot(id);return;
 }
 if(tg){
  const id=tg.dataset.bsToggle,body=tg.parentElement.querySelector('.bs-body'),b=bus(id);if(!b||!body)return;
  const open=tg.getAttribute('aria-expanded')!=='true';
  tg.setAttribute('aria-expanded',String(open));body.hidden=!open;
  if(open){OPEN.add(id);body.innerHTML=panel(b);requestAnimationFrame(fitAll)}else{OPEN.delete(id);body.innerHTML=''}
  return;
 }
 if(ch){aiSelect(ch.dataset.aiBus);return}
});

/* ---------- кнопка «Схема салона» в карточках автобусов ---------- */
function decorateCards(){
 if(!['routes','trips','map'].includes(page))return;
 document.querySelectorAll('.buscard:not([data-bs-ok])').forEach(card=>{
  const id=card.querySelector('.route-number')?.textContent.trim(),b=id&&bus(id);
  if(!b)return;card.dataset.bsOk='1';
  const wrap=document.createElement('div');wrap.className='bs-wrap';
  const open=OPEN.has(id);
  wrap.innerHTML=`<button type="button" class="bs-toggle" data-bs-toggle="${esc(id)}" aria-expanded="${open}"><span class="bs-ico" aria-hidden="true">▦</span> Схема салона <small>места · люди · комфорт</small></button><div class="bs-body" ${open?'':'hidden'}>${open?panel(b):''}</div>`;
  const actions=card.querySelector('.actions');
  if(actions)actions.after(wrap);else card.append(wrap);
  if(open)requestAnimationFrame(fitAll);
 });
}

/* ---------- история маршрута (данные ИИ) ---------- */
function history(b){
 const seen=[...new Set(b.order)],names=seen.map(stopName);
 const h=hash(city+'|hist|'+b.id),pick=(n,s)=>(h>>>(s*3))%n;
 const has=i=>seen.includes(i);
 const pct=(a,c,s)=>a+((h>>>(s*2))%(c-a+1));
 const first=names[0],third=names[Math.min(2,names.length-1)],last=names[names.length-1];
 const school=has(6)?`от остановки «${stopName(6)}» до «${third===stopName(6)?last:third}»`:`от остановки «${first}» до «${third===first?last:third}»`;
 const lines=[];
 lines.push({k:'school',t:`Школьники. Основном школьники едут ${school}: утром с ${pad(7)}:${pad(pick(3,1)*10)} до ${pad(8)}:${pad(20+pick(3,2)*10)} и после уроков с 13:00 до ${pad(15)}:${pad(pick(3,3)*15)}.`});
 lines.push({k:'pens',t:has(5)?`Пенсионеры. Чаще всего едут до остановки «${stopName(5)}» (поликлиника и больница), в основном с 09:00 до 12:00.`:has(7)?`Пенсионеры. Чаще всего едут до остановки «${stopName(7)}» (рынок), в основном с 09:00 до 12:00.`:`Пенсионеры. Чаще всего едут в центр города, в основном с 09:00 до 12:00.`});
 if(has(2))lines.push({k:'stud',t:`Студенты. Едут до остановки «${stopName(2)}» утром с 08:00 до 09:30 и обратно с 16:00 до 18:30.`});
 else lines.push({k:'stud',t:`Студенты. Ездят утром с 08:00 до 09:30 и вечером с 16:00 до 18:30, в основном в центр города.`});
 const peak=pct(86,98,1),calm=pct(32,48,2);
 lines.push({k:'peak',t:`Часы пик. В будни с 07:30 до 08:30 и с 13:00 до 14:30 автобус может быть переполнен школьниками, днём — пенсионерами: занято до ${peak}% мест, часть пассажиров стоит.`});
 lines.push({k:'free',t:`Свободнее всего. В будни с 10:00 до 12:00 и после 19:00, а в выходные занято в среднем ${calm}% мест.`});
 return{lines,peak,calm,stops:names};
}
function summary(b){
 const rec=scan(b),sc=comfortOf(b,rec),ac=acOf(b);
 const top=Object.entries(rec.cnt).sort((a,c)=>c[1]-a[1]).filter(x=>x[1]>0).slice(0,2).map(([k,n])=>`${KINDS[k].t.toLowerCase()} — ${n}`).join(', ');
 return `Скан ИИ ${hhmm(rec.t)}: занято мест ${rec.occ} из ${rec.cap}, стоят ${rec.standing}, всего в салоне ${rec.total}. Больше всего: ${top||'пассажиров почти нет'}. Индекс комфорта ${sc.toFixed(1)} (${comfortLabel(sc)}). ${ac===true?'Кондиционер включён.':ac===false?'Кондиционер выключен.':'Отметки о кондиционере нет.'}`;
}
function historyHTML(b){
 const hs=history(b);
 return `<div class="bs-hist"><h3>История маршрута №${esc(b.id)} «${esc(b.name)}»</h3><ul>${hs.lines.map(l=>`<li class="bs-h-${l.k}"><i style="background:${(KINDS[l.k]||{c:'#bb6b32'}).c}"></i><span>${esc(l.t)}</span></li>`).join('')}</ul><p class="bs-note">Статистика условная (демо). Настоящая появится, когда в автобусы поставят счётчики пассажиров.</p></div>`;
}

/* ---------- главная: карта, тарифы, данные ИИ ---------- */
let aiSel=null;
function aiSelect(id){
 const b=bus(id);if(!b)return;aiSel=b.id;
 document.querySelectorAll('[data-ai-bus]').forEach(x=>{const on=x.dataset.aiBus===b.id;x.classList.toggle('active',on);x.setAttribute('aria-pressed',String(on))});
 const box=$('#bs-ai-panel');if(!box)return;
 box.innerHTML=`<article class="card bs-ai-card" style="--accent:${b.color}"><div class="bs-ai-title"><span class="route-number">${esc(b.id)}</span><div><strong>${esc(b.name)}</strong><span class="muted">Данные ИИ · ${esc(CITIES[city].name)}</span></div></div>${panel(b)}${historyHTML(b)}</article>`;
 requestAnimationFrame(fitAll);
}
const CATN={regular:'Обычный пассажир',school:'Школьник',student:'Студент',pensioner:'Пенсионер',benefit:'Льготная категория'};
const CATD={regular:'Удостоверение личности',school:'Свидетельство о рождении или удостоверение, справка из школы, фото 3×4',student:'Удостоверение, студенческий билет или справка, фото 3×4',pensioner:'Удостоверение, пенсионное удостоверение, фото 3×4',benefit:'Удостоверение, документ о праве на льготу, фото 3×4'};
function tariffRow(k){
 const v=TARIFFS[k];
 return `<li><div><strong>${CATN[k]}</strong><small>${esc(CATD[k])}</small></div><b class="bs-price">${typeof v==='number'?v+' ₸':'по карточке'}</b></li>`;
}
function homeBlocks(){
 const routes=$('#home-routes');if(!routes)return;
 const anchor=routes.closest('.section')||routes;
 const info=document.createElement('section');info.className='section bs-info';info.id='bs-info';
 info.innerHTML=`<div class="bs-two">
  <article class="card bs-card" id="bs-how">
   <span class="tag">Карточка пассажира</span><h2>Как оформить карту</h2>
   <ol class="bs-steps">
    <li><b>Войдите в аккаунт</b> и выберите категорию в личном кабинете: обычный пассажир, школьник, студент, пенсионер или льготная категория.</li>
    <li><b>Подготовьте документы</b> для своей категории — список виден в кабинете в разделе «Получить карточку».</li>
    <li><b>Выберите способ:</b> физическая карточка — в пункте выдачи; виртуальная — заявка в Настройках с фото документов, её рассмотрит диспетчер.</li>
    <li><b>Пополните кошелёк</b> и платите за проезд: QR-код, NFC, по гос. номеру или кнопкой «рядом с автобусом».</li>
   </ol>
   <div class="actions"><a class="primary" href="${esc(url('settings.html')+'#cards')}">Оформить виртуальную карту</a><button type="button" class="secondary" data-au-open>Личный кабинет</button></div>
  </article>
  <article class="card bs-card" id="bs-tariffs">
   <span class="tag">Скидки</span><h2>Льготные тарифы</h2>
   <p class="muted">Льготный проезд оформляется по карточке: категорию подтверждают документами.</p>
   <ul class="bs-tariffs">${Object.keys(CATN).map(tariffRow).join('')}</ul>
   <p class="bs-note">Размер скидки для льготных категорий определяет перевозчик. Если сумма не указана — уточняйте её в пункте выдачи карточек.</p>
  </article>
 </div>`;
 const ai=document.createElement('section');ai.className='section bs-ai';ai.id='bs-ai';
 ai.innerHTML=`<div class="sectiontitle"><h2>Данные ИИ о маршрутах</h2></div>
  <p class="muted">Нажмите на маршрут: ИИ «просканировал» автобус и показывает схему салона — какие места заняты, сколько людей едет и какой индекс комфорта. Скан обновляется раз в ${Math.round(SCAN_MS/60000)} минут (тестовый режим).</p>
  <div class="filters bs-ai-chips" role="group" aria-label="Выбор маршрута">${BUSES.map(b=>`<button type="button" class="chip" data-ai-bus="${esc(b.id)}" aria-pressed="false" style="--accent:${b.color}"><b>№${esc(b.id)}</b> ${esc(b.name)}</button>`).join('')}</div>
  <div id="bs-ai-panel"><div class="card empty bs-empty"><span class="bs-ico" aria-hidden="true">▦</span><h3>Выберите автобус</h3><p>Покажем схему салона, число пассажиров и историю маршрута.</p></div></div>`;
 anchor.after(info);info.after(ai);
}

/* ---------- обновление каждую секунду ---------- */
setInterval(()=>{
 const now=Date.now();
 document.querySelectorAll('[data-sc-count]').forEach(el=>{
  const b=bus(el.dataset.scCount);if(!b)return;
  const rec=rd(skey(b));
  if(!rec||now-rec.t>=SCAN_MS){const p=el.closest('.bs');if(p&&!drag)refreshPanel(p);return}
  el.textContent=mmss(rec.t+SCAN_MS-now);
 });
 if(!drag)fitAll();
 document.querySelectorAll('.bs[data-bs]').forEach(p=>{if(!drag){const b=bus(p.dataset.bs);if(b&&p.dataset.ac!==String(acOf(b)))refreshPanel(p)}});
},1000);

document.addEventListener('DOMContentLoaded',()=>{
 if(page==='home')homeBlocks();
 decorateCards();
 const app=$('#app');
 if(app){let q=0;new MutationObserver(()=>{if(q)return;q=requestAnimationFrame(()=>{q=0;decorateCards()})}).observe(app,{childList:true,subtree:true})}
});

window.AqylScan={panel,scan,history,historyHTML,summary,SCAN_MS,kinds:KINDS};
})();
