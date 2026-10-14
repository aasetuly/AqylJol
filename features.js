/* AqylJol — новые возможности (v12):
   кнопка QR на каждой вкладке · оплата по гос. номеру · «вы рядом с автобусом» и автооплата ·
   настройки (язык, уведомления, автооплата, геопозиция, карты, банковская карта — ТЕСТ) ·
   заявка на виртуальную карту · блок «Найди нас в соцсетях» · новости на странице «О нас».
   Стоимость проезда фиксирована — 80 ₸ (wallet.js). Подключается во всех HTML после fleet.js. */
(()=>{
'use strict';
const FARE=80;          // ₸, не меняется
const NOTIFY_M=100;     // «рядом с автобусом» — уведомление при расстоянии не больше, м
const PAY_M=20;         // оплата подтверждается только при расстоянии не больше, м (15–20 м)
const PAY_ACC=30;       // и только если GPS точнее, м
const NOTIFY_ACC=80;
const AUTO_SEC=5;       // отсчёт до автооплаты, с

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const T=(k,p)=>window.AqylI18n?AqylI18n.t(k,p):String(k).replace(/\{(\w+)\}/g,(m,x)=>p&&x in p?p[x]:m);
const rd=(k,f)=>{try{const v=localStorage.getItem(k);return v==null?f:JSON.parse(v)}catch{return f}};
const wr=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
const money=n=>new Intl.NumberFormat('ru-RU').format(Math.round(n))+' ₸';
const page=document.body.dataset.page||'home';
const user=()=>{try{return window.AqylAuth&&AqylAuth.user()||null}catch{return null}};
const uid=()=>{const u=user();return u?String(u.id):''};
const toast=t=>{const e=$('#toast');if(!e)return;e.textContent=t;clearTimeout(toast.t);toast.t=setTimeout(()=>{if(e.textContent===t)e.textContent=''},3500)};
const W=()=>window.AqylWallet;
const curCity=()=>typeof city!=='undefined'?city:'atyrau';
const hasBuses=()=>typeof BUSES!=='undefined'&&typeof CITIES!=='undefined';

/* ================= настройки-переключатели ================= */
const notifyOn=()=>{try{return localStorage.getItem('aq-notify')!=='0'}catch{return true}}; // по умолчанию ДА
const autopayOn=()=>{try{return localStorage.getItem('aq-autopay')==='1'}catch{return false}};
const geoFlag=()=>{try{return localStorage.getItem('aq-geo-on')==='1'}catch{return false}};

/* ================= окна ================= */
let sheetEl=null,onSheetClose=null;
function closeSheet(){if(sheetEl){sheetEl.remove();sheetEl=null}if(onSheetClose){const f=onSheetClose;onSheetClose=null;f()}}
function sheet(html,mount,onClose){
 closeSheet();onSheetClose=onClose||null;
 const b=document.createElement('div');b.className='aqw-back aq-sheetback';
 b.innerHTML=`<div class="aqw-sheet" role="dialog" aria-modal="true">${html}</div>`;
 b.addEventListener('mousedown',e=>{if(e.target===b)closeSheet()});
 b.addEventListener('click',e=>{if(e.target.closest('[data-x]'))closeSheet()});
 document.body.append(b);sheetEl=b;
 if(mount)mount($('.aqw-sheet',b));
 return b;
}
const head=t=>`<div class="aqw-head"><h2>${t}</h2><button class="aqw-x" data-x aria-label="Закрыть">×</button></div>`;
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSheet()});

/* ================= гос. номера автобусов (демо) ================= */
const REGION={atyrau:'06',astana:'01',almaty:'02',shymkent:'17',karaganda:'09',aktobe:'04',taraz:'08',pavlodar:'14',oskemen:'16',semey:'18',kostanay:'10',petropavlovsk:'15',uralsk:'07',kyzylorda:'11',aktau:'12',turkistan:'13'};
const LETTERS='ABCDEHKMOPTXY'.split(''); // буквы, которые есть и в латинице, и в кириллице номеров
const hash=s=>{let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
let plateMap=null;
function buildPlates(){
 if(plateMap||!hasBuses())return plateMap||{};
 const byPlate={},byBus={};
 for(const c of Object.keys(CITIES))for(const b of BUSES){
  let n=0,p;
  do{const h=hash(c+':'+b.id+':'+n);p=String(100+h%900)+[0,1,2].map(i=>LETTERS[(h>>>(8+i*5))%LETTERS.length]).join('')+(REGION[c]||'00');n++}while(byPlate[p]);
  byPlate[p]={city:c,bus:b.id};byBus[c+':'+b.id]=p;
 }
 return plateMap={byPlate,byBus};
}
const fmtPlate=p=>p?p.replace(/^(\d{3})([A-Z]{3})(\d{2})$/,'$1 $2 $3'):'';
const plateOf=(c,id)=>{const m=buildPlates();return m.byBus?fmtPlate(m.byBus[c+':'+id]):''};
const CYR2LAT={'А':'A','В':'B','Е':'E','К':'K','М':'M','Н':'H','О':'O','Р':'P','С':'C','Т':'T','Х':'X','У':'Y'};
const normPlate=s=>String(s||'').toUpperCase().replace(/[^0-9A-ZА-Я]/g,'').replace(/[А-Я]/g,c=>CYR2LAT[c]||c);
const findPlate=raw=>{const m=buildPlates(),r=m.byPlate&&m.byPlate[normPlate(raw)];return r||null};

function plateDialog(){
 const w=W();if(!w)return;
 w.gate(()=>{
  w.close();
  const here=hasBuses()?BUSES.map(b=>[b,plateOf(curCity(),b.id)]):[];
  sheet(`${head('Оплата по гос. номеру')}
   <p>Введите государственный номер автобуса — он указан на кузове. Проезд стоит ровно <b>${money(FARE)}</b>.</p>
   <input class="aqw-in aq-plate-in" id="aq-pl" maxlength="12" autocomplete="off" autocapitalize="characters" placeholder="Например: 123 ABC 06" aria-label="Гос. номер автобуса">
   <div id="aq-pl-res"></div>
   <p class="aqw-note">Подсказка (демо-номера в городе ${esc(typeof CITIES!=='undefined'&&CITIES[curCity()]?CITIES[curCity()].name:'')}):</p>
   <div class="aq-chips">${here.map(([b,p])=>`<button class="aq-chip" data-p="${esc(p)}">№${esc(b.id)} · ${esc(p)}</button>`).join('')}</div>
   <p class="aqw-note">Демо: номера вымышленные, реальные деньги не списываются.</p>`,
  s=>{
   const inp=$('#aq-pl',s),res=$('#aq-pl-res',s);
   const show=()=>{
    const f=findPlate(inp.value);
    if(!normPlate(inp.value)){res.innerHTML='';return}
    if(!f){res.innerHTML=`<p class="aqw-err">${esc(T('Автобус с таким номером не найден. Проверьте номер.'))}</p>`;return}
    const b=BUSES.find(x=>x.id===f.bus),cn=CITIES[f.city].name,bal=w.load().balance;
    res.innerHTML=`<div class="aq-found" style="--accent:${esc(b.color)}"><span class="route-number">${esc(b.id)}</span><div><strong>${esc(b.name)}</strong><small>${esc(cn)} · ${esc(plateOf(f.city,f.bus))}</small></div></div>
     <p>Стоимость: <b>${money(FARE)}</b> · Ваш баланс: <b>${money(bal)}</b></p><p class="aqw-err" id="aq-pl-e"></p>
     <div class="aqw-row"><button class="aqw-btn" data-x>Отмена</button><button class="aqw-btn main" id="aq-pl-pay">Оплатить ${money(FARE)}</button></div>`;
    $('#aq-pl-pay',res).onclick=()=>{
     const r=w.payFare({bus:f.bus,kind:'plate',city:f.city});
     if(r.ok){closeSheet();w.showPaid(f.bus,r.balance)}
     else if(r.reason==='funds'){const e=$('#aq-pl-e',res);e.innerHTML=`${esc(T('Не хватает {n}.',{n:money(r.need)}))} <a href="#" id="aq-pl-tp">${esc(T('Пополнить'))}</a>`;$('#aq-pl-tp',res).onclick=ev=>{ev.preventDefault();closeSheet();w.topUp(r.need)}}
    };
   };
   inp.addEventListener('input',show);
   $$('[data-p]',s).forEach(b=>b.onclick=()=>{inp.value=b.dataset.p;show()});
   inp.focus();
  });
 },'оплатить проезд по гос. номеру');
}

/* ================= кнопка QR на каждой странице ================= */
const QR_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><rect x="8" y="8" width="3" height="3"/><rect x="13" y="8" width="3" height="3"/><rect x="8" y="13" width="3" height="3"/><path d="M13 13h3v3"/></svg>';
/* кнопки QR и «где я» должны стоять над нижней навигацией на телефоне, а на компьютере — просто в углу */
function placeFabs(){
 const n=$('#nav'),r=document.documentElement.style;
 if(n){const b=n.getBoundingClientRect(),cs=getComputedStyle(n);
  if(cs.position==='fixed'&&b.top>innerHeight*.5&&b.height>0){const q=Math.round(innerHeight-b.top+12);r.setProperty('--aq-qr-b',q+'px');r.setProperty('--aq-geo-b',(q+64)+'px');return}}
 r.removeProperty('--aq-qr-b');r.removeProperty('--aq-geo-b');
}
function mountQR(){
 if($('.aq-qr'))return;
 const b=document.createElement('button');b.type='button';b.className='aq-qr';
 b.setAttribute('aria-label','Сканировать QR-код для оплаты проезда');b.title='Сканировать QR для оплаты';
 b.innerHTML=QR_SVG+'<span>QR</span>';
 b.onclick=()=>{const w=W();if(w)w.gate(w.scan,'оплатить проезд по QR-коду');else toast('Кошелёк ещё загружается')};
 document.body.append(b);
}

/* ================= «вы рядом с автобусом» и автооплата ================= */
const st={fix:null,watch:null,geo:'off',notified:{},auto:null,autoCancel:{},confirm:null};
const rad=x=>x*Math.PI/180;
const meters=(a,b)=>{const R=6371000,dl=rad(b[0]-a[0]),dn=rad(b[1]-a[1]),h=Math.sin(dl/2)**2+Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(h))};
function busPos(b){try{const s=fleetMotion.sample(b,AqylSim.clock(b));return s&&s.latlng}catch{return null}}
function testPos(){ // демо: «я стою в ~10 м от выбранного автобуса»
 const id=localStorage.getItem('aq-geo-test');if(!id||!hasBuses())return null;
 const b=BUSES.find(x=>x.id===id),p=b&&busPos(b);
 return p?{lat:p[0]+0.00009,lng:p[1],acc:5,t:Date.now(),test:true}:null;
}
function curPos(){const t=testPos();if(t)return t;const f=st.fix;return f&&Date.now()-f.t<20000?f:null}
function startGeo(){
 if(st.watch!=null||!navigator.geolocation)return;
 st.watch=navigator.geolocation.watchPosition(p=>{
  st.fix={lat:p.coords.latitude,lng:p.coords.longitude,acc:Math.round(p.coords.accuracy),t:Date.now()};st.geo='ok';geoUI();
 },e=>{
  st.geo=e.code===1?'denied':e.code===3?'timeout':'error';
  if(e.code===1){wr('aq-geo-on',0);stopGeo()}
  geoUI();
 },{enableHighAccuracy:true,maximumAge:3000,timeout:20000});
}
function stopGeo(){if(st.watch!=null){try{navigator.geolocation.clearWatch(st.watch)}catch{}st.watch=null}}
function ensureGeo(){
 const want=!!user()&&geoFlag()&&!localStorage.getItem('aq-geo-test');
 if(want)startGeo();else{stopGeo()}
}
function nearest(pos){
 let best=null;
 for(const b of BUSES){
  try{if(window.AqylFleet&&AqylFleet.info(b).off)continue}catch{}
  const p=busPos(b);if(!p)continue;
  const d=meters([pos.lat,pos.lng],p);
  if(!best||d<best.d)best={b,d};
 }
 return best;
}
const eligible=id=>!(W()&&W().recentPaid(id,30*60000));

let stack=null;
function banner(html,ms,cls){
 if(!stack){stack=document.createElement('div');stack.id='aq-prox-stack';stack.setAttribute('aria-live','assertive');document.body.append(stack)}
 const el=document.createElement('div');el.className='aq-prox '+(cls||'');el.setAttribute('role','alert');el.innerHTML=html;
 const close=()=>{el.classList.add('out');setTimeout(()=>el.remove(),250)};
 el.close=close;
 const x=$('[data-px]',el);if(x)x.onclick=close;
 stack.prepend(el);if(ms)setTimeout(close,ms);
 while(stack.children.length>3)stack.lastElementChild.remove();
 return el;
}
function ping(title,body,tag){
 try{if('Notification' in window&&Notification.permission==='granted'&&document.hidden){const n=new Notification(title,{body,tag,icon:'aqyljol-icon.svg'});n.onclick=()=>{window.focus();n.close()}}}catch{}
 try{W()&&W().beep()}catch{}
}

function proximityNotice(bus,d){
 st.notified[bus.id]=Date.now();
 const title=T('Вы рядом с автобусом №{n}',{n:bus.id}),body=T('Оплатить проезд — {sum}?',{sum:money(FARE)});
 const el=banner(`<span class="aq-prox-num" style="--bus:${esc(bus.color)}">${esc(bus.id)}</span><div class="aq-prox-body"><strong>${esc(title)}</strong><p>${esc(body)}</p></div><button class="aq-prox-pay" data-pay>${esc(T('Оплатить'))}</button><button class="aq-prox-x" data-px aria-label="Закрыть">×</button>`,30000);
 $('[data-pay]',el).onclick=()=>{el.close();confirmDialog(bus)};
 ping(title,body,'aq-near-'+bus.id);
}

function confirmDialog(bus){
 const w=W();if(!w)return;
 w.gate(()=>{
  w.close();
  const bal=w.load().balance;
  sheet(`${head('Подтвердите оплату')}
   <div class="aq-found" style="--accent:${esc(bus.color)}"><span class="route-number">${esc(bus.id)}</span><div><strong>${esc(bus.name)}</strong><small>${esc(plateOf(curCity(),bus.id))}</small></div></div>
   <div class="aqw-bal"><small>К оплате (фиксированная стоимость)</small><b>${money(FARE)}</b></div>
   <p>Ваш баланс: <b>${money(bal)}</b></p>
   <div class="aq-dist" id="aq-dist" role="status"></div>
   <p class="aqw-err" id="aq-ce"></p>
   <div class="aqw-row"><button class="aqw-btn" data-x>Отмена</button><button class="aqw-btn main" id="aq-cok" disabled>Подтвердить оплату</button></div>
   <p class="aqw-note">Кнопка станет активной, когда вы окажетесь не дальше ${PAY_M} м от автобуса. Демо: автобусы виртуальные, деньги не списываются по-настоящему.</p>`,
  s=>{
   st.confirm={bus,el:s};
   $('#aq-cok',s).onclick=()=>{
    const pos=curPos(),p=busPos(bus),e=$('#aq-ce',s);
    if(!pos||!p||pos.acc>PAY_ACC||meters([pos.lat,pos.lng],p)>PAY_M){e.textContent=T('Вы слишком далеко от автобуса.');updateConfirm();return}
    const r=w.payFare({bus:bus.id,kind:'near',city:curCity()});
    if(r.ok){closeSheet();w.showPaid(bus.id,r.balance)}
    else if(r.reason==='funds'){e.innerHTML=`${esc(T('Не хватает {n}.',{n:money(r.need)}))} <a href="#" id="aq-ctp">${esc(T('Пополнить'))}</a>`;$('#aq-ctp',s).onclick=ev=>{ev.preventDefault();closeSheet();w.topUp(r.need)}}
   };
   updateConfirm();
  },()=>{st.confirm=null});
 },'оплатить проезд');
}
function updateConfirm(){
 const c=st.confirm;if(!c||!c.el.isConnected)return;
 const info=$('#aq-dist',c.el),btn=$('#aq-cok',c.el);if(!info||!btn)return;
 const pos=curPos(),p=busPos(c.bus);
 let ok=false,html='',cls='';
 if(!pos){html=T('Определяю местоположение… Включите геопозицию в Настройках или оплатите по QR / гос. номеру.');cls='wait'}
 else if(!p){html=T('Автобус сейчас недоступен.');cls='bad'}
 else{
  const d=Math.round(meters([pos.lat,pos.lng],p));
  if(pos.acc>PAY_ACC){html=T('Низкая точность GPS (±{n} м). Выйдите на открытое место.',{n:pos.acc});cls='bad'}
  else if(d>PAY_M){html=T('До автобуса: {d} м. Оплата активируется на расстоянии не более {m} м.',{d,m:PAY_M});cls='bad'}
  else{html=T('Вы рядом с автобусом ({d} м). Можно оплачивать.',{d});cls='good';ok=true}
 }
 info.className='aq-dist '+cls;if(info.textContent!==html)info.textContent=html;
 btn.disabled=!ok;
}

function startAuto(bus){
 if(st.auto)return;
 const c=st.autoCancel[bus.id];if(c&&Date.now()-c<600000)return;
 let left=AUTO_SEC;st.auto={bus};
 const el=banner(`<span class="aq-prox-num" style="--bus:${esc(bus.color)}">${esc(bus.id)}</span><div class="aq-prox-body"><strong>${esc(T('Автооплата: автобус №{n}',{n:bus.id}))}</strong><p data-left></p></div><button class="aq-prox-pay aq-cancel" data-cancel>${esc(T('Отменить'))}</button>`,0,'auto');
 const label=()=>{$('[data-left]',el).textContent=T('{sum} спишется через {s} с',{sum:money(FARE),s:left})};
 label();
 const end=()=>{clearInterval(tm);st.auto=null;el.close()};
 $('[data-cancel]',el).onclick=()=>{st.autoCancel[bus.id]=Date.now();end()};
 const tm=setInterval(()=>{
  const pos=curPos(),p=busPos(bus);
  if(!pos||!p||meters([pos.lat,pos.lng],p)>PAY_M+10){end();return} // отошли — отменяем
  left--;
  if(left>0){label();return}
  end();
  const w=W(),r=w&&w.payFare({bus:bus.id,kind:'auto',city:curCity()});
  if(r&&r.ok){banner(`<span class="aq-prox-num" style="--bus:${esc(bus.color)}">✓</span><div class="aq-prox-body"><strong>${esc(T('Оплачено {sum}',{sum:money(FARE)}))}</strong><p>${esc(T('Автобус №{n} · остаток {b}',{n:bus.id,b:money(r.balance)}))}</p></div><button class="aq-prox-x" data-px aria-label="Закрыть">×</button>`,8000);ping(T('Оплачено {sum}',{sum:money(FARE)}),T('Автобус №{n}',{n:bus.id}),'aq-auto-'+bus.id)}
  else{st.autoCancel[bus.id]=Date.now();banner(`<span class="aq-prox-num" style="--bus:${esc(bus.color)}">!</span><div class="aq-prox-body"><strong>${esc(T('Автооплата не выполнена'))}</strong><p>${esc(T('Недостаточно средств. Пополните кошелёк.'))}</p></div><button class="aq-prox-x" data-px aria-label="Закрыть">×</button>`,10000)}
 },1000);
}

function loop(){
 if(!user()||!hasBuses()||typeof fleetMotion==='undefined'||typeof AqylSim==='undefined')return;
 const pos=curPos();updateConfirm();geoUI();
 if(!pos)return;
 const n=nearest(pos);if(!n)return;
 const bus=n.b;
 if(!eligible(bus.id))return;
 if(autopayOn()&&n.d<=PAY_M&&pos.acc<=PAY_ACC){startAuto(bus);return}
 if(notifyOn()&&n.d<=NOTIFY_M&&pos.acc<=NOTIFY_ACC&&!(st.notified[bus.id]&&Date.now()-st.notified[bus.id]<600000))proximityNotice(bus,n.d);
}

/* ================= банковская карта (ТЕСТ) ================= */
const brandOf=n=>/^4/.test(n)?'Visa':/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(n)?'Mastercard':/^220[0-4]/.test(n)?'Мир':/^62/.test(n)?'UnionPay':/^3[47]/.test(n)?'Amex':/^(50|5[6-9]|6)/.test(n)?'Maestro':'Карта';
function luhn(n){let s=0,d=false;for(let i=n.length-1;i>=0;i--){let x=+n[i];if(d){x*=2;if(x>9)x-=9}s+=x;d=!d}return n.length>0&&s%10===0}
function expOk(v){
 const m=/^(0[1-9]|1[0-2])\/(\d{2})$/.exec(v);if(!m)return false;
 const end=new Date(2000+ +m[2],+m[1],1).getTime(); // начало следующего месяца
 return end>Date.now()&&end<Date.now()+16*365*864e5;
}
const bankKey=()=>'aq-bank:'+uid();
const bank=()=>rd(bankKey(),null);
function bankDialog(){
 const w=W();
 const open=()=>sheet(`${head('Привязать банковскую карту')}
  <div class="aq-testbanner">⚠ ТЕСТОВЫЙ РЕЖИМ. Это демонстрация: <b>не вводите данные настоящей карты</b>. Платежи не проводятся, номер целиком и код CVC не сохраняются.</div>
  <label class="aqw-note" for="aq-bn">Номер карты</label>
  <input class="aqw-in" id="aq-bn" inputmode="numeric" autocomplete="off" maxlength="23" placeholder="0000 0000 0000 0000">
  <label class="aqw-note" for="aq-bh">Имя на карте (латиницей)</label>
  <input class="aqw-in" id="aq-bh" autocomplete="off" autocapitalize="characters" maxlength="40" placeholder="IVAN IVANOV">
  <div class="aqw-row"><div style="flex:1"><label class="aqw-note" for="aq-be">Срок (ММ/ГГ)</label><input class="aqw-in" id="aq-be" inputmode="numeric" autocomplete="off" maxlength="5" placeholder="ММ/ГГ"></div><div style="flex:1"><label class="aqw-note" for="aq-bc">CVC</label><input class="aqw-in" id="aq-bc" inputmode="numeric" autocomplete="off" type="password" maxlength="4" placeholder="•••"></div></div>
  <p class="aqw-err" id="aq-bE" role="alert"></p>
  <div class="aqw-row"><button class="aqw-btn" id="aq-bt" type="button">Подставить тестовую карту</button><button class="aqw-btn main" id="aq-bok" type="button">Привязать</button></div>
  <p class="aqw-note">Для проверки используйте общеизвестный тестовый номер 4242 4242 4242 4242.</p>`,
 s=>{
  const n=$('#aq-bn',s),h=$('#aq-bh',s),e=$('#aq-be',s),c=$('#aq-bc',s),err=$('#aq-bE',s);
  n.addEventListener('input',()=>{const d=n.value.replace(/\D/g,'').slice(0,19);n.value=d.replace(/(.{4})/g,'$1 ').trim()});
  e.addEventListener('input',()=>{let d=e.value.replace(/\D/g,'').slice(0,4);if(d.length>=3)d=d.slice(0,2)+'/'+d.slice(2);e.value=d});
  c.addEventListener('input',()=>{c.value=c.value.replace(/\D/g,'')});
  $('#aq-bt',s).onclick=()=>{const y=String((new Date().getFullYear()+3)%100).padStart(2,'0');n.value='4242 4242 4242 4242';h.value='TEST CARDHOLDER';e.value='12/'+y;c.value='123';err.textContent=''};
  $('#aq-bok',s).onclick=()=>{
   const num=n.value.replace(/\D/g,''),holder=h.value.trim().toUpperCase(),exp=e.value,cvc=c.value;
   const fail=m=>{err.textContent=m};
   if(num.length<13||num.length>19)return fail('Номер карты должен содержать от 13 до 19 цифр.');
   if(!luhn(num))return fail('Номер карты неверный: не прошла проверка контрольной цифры. Проверьте цифры.');
   if(!/^[A-Z][A-Z '\-.]{1,39}$/.test(holder))return fail('Имя на карте — латинскими буквами, как на карте.');
   if(window.AqylNick&&!AqylNick.check(holder).ok)return fail('Это имя нельзя использовать.');
   if(!/^\d{2}\/\d{2}$/.test(exp))return fail('Срок действия — в формате ММ/ГГ, например 12/29.');
   if(!expOk(exp))return fail('Срок действия карты неверный или уже истёк.');
   if(!new RegExp('^\\d{'+(brandOf(num)==='Amex'?4:3)+'}$').test(cvc))return fail('Код CVC — '+(brandOf(num)==='Amex'?'4':'3')+' цифры.');
   wr(bankKey(),{brand:brandOf(num),last4:num.slice(-4),exp,holder,test:true,added:Date.now()});
   closeSheet();toast('Тестовая карта привязана');renderSettings();
  };
 });
 if(w)w.gate(open,'привязать банковскую карту');else open();
}

/* ================= физическая и виртуальная карты ================= */
const CAT={
 regular:['Обычный пассажир',['Удостоверение личности']],
 student:['Студент',['Удостоверение личности','Студенческий билет или справка с места учёбы','Фото 3×4']],
 school:['Школьник',['Свидетельство о рождении или удостоверение личности','Справка из школы или ученический билет','Фото 3×4']],
 pensioner:['Пенсионер',['Удостоверение личности','Пенсионное удостоверение','Фото 3×4']],
 benefit:['Льготная категория',['Удостоверение личности','Документ, подтверждающий право на льготу','Фото 3×4']]
};
const fmtCard=n=>String(n||'').replace(/^(AQ)(\d{4})(\d{4})(\d{2})$/,'$1 $2 $3 $4');
const pcKey=()=>'aq-pcards:'+uid();
const myCards=()=>window.AqylDB?AqylDB.table('cards').list().filter(c=>c.uid===uid()).sort((a,b)=>b.ts-a.ts):[];

function compress(file){
 return new Promise((ok,no)=>{
  if(!/^image\//.test(file.type))return no(new Error('type'));
  const img=new Image(),u=URL.createObjectURL(file);
  img.onload=()=>{
   const k=Math.min(1,1000/Math.max(img.width,img.height)),c=document.createElement('canvas');
   c.width=Math.max(1,Math.round(img.width*k));c.height=Math.max(1,Math.round(img.height*k));
   c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(u);
   let out=c.toDataURL('image/jpeg',.7);if(out.length>230000)out=c.toDataURL('image/jpeg',.5);
   ok(out);
  };
  img.onerror=()=>{URL.revokeObjectURL(u);no(new Error('read'))};img.src=u;
 });
}
function virtualDialog(){
 const w=W();
 const open=()=>{
  if(myCards().some(c=>c.status==='new'))return toast('У вас уже есть заявка на рассмотрении');
  const docs=[];
  sheet(`${head('Виртуальная карта')}
   <p>Заполните форму и приложите фото документов. Заявку и документы получит <b>диспетчер</b> вашего города: он проверит данные и создаст виртуальную карту.</p>
   <label class="aqw-note" for="aq-vf">ФИО</label>
   <input class="aqw-in" id="aq-vf" autocomplete="name" maxlength="80" placeholder="Фамилия Имя Отчество">
   <div class="aqw-row"><div style="flex:1"><label class="aqw-note" for="aq-vb">Дата рождения</label><input class="aqw-in" id="aq-vb" type="date"></div><div style="flex:1"><label class="aqw-note" for="aq-vp">Телефон</label><input class="aqw-in" id="aq-vp" type="tel" inputmode="tel" autocomplete="tel" maxlength="18" placeholder="+7 700 000 00 00"></div></div>
   <label class="aqw-note" for="aq-vc">Категория</label>
   <select class="aqw-in" id="aq-vc">${Object.entries(CAT).map(([k,v])=>`<option value="${k}">${esc(v[0])}</option>`).join('')}</select>
   <div id="aq-vd"></div>
   <label class="aq-check"><input type="checkbox" id="aq-vk"> <span>Согласен(на) на передачу моих данных и документов диспетчеру для выпуска карты. После решения фото документов удаляются из заявки.</span></label>
   <p class="aqw-err" id="aq-vE" role="alert"></p>
   <div class="aqw-row"><button class="aqw-btn" data-x>Отмена</button><button class="aqw-btn main" id="aq-vok">Отправить диспетчеру</button></div>
   <p class="aqw-note">Принимаются фото и сканы в формате JPG или PNG. Для безопасности не отправляйте документы никому, кроме диспетчера через эту форму.</p>`,
  s=>{
   const cat=$('#aq-vc',s),box=$('#aq-vd',s),err=$('#aq-vE',s);
   const drawDocs=()=>{
    docs.length=0;
    box.innerHTML=CAT[cat.value][1].map((n,i)=>`<label class="aq-file" data-i="${i}"><span>${esc(n)}</span><input type="file" accept="image/*" data-i="${i}"><em>Не выбрано</em></label>`).join('');
    $$('input[type=file]',box).forEach(inp=>inp.addEventListener('change',async()=>{
     const i=+inp.dataset.i,f=inp.files[0],em=inp.parentElement.querySelector('em');err.textContent='';
     if(!f){docs[i]=null;em.textContent='Не выбрано';return}
     em.textContent='Обработка…';
     try{docs[i]={name:CAT[cat.value][1][i],data:await compress(f)};em.textContent='✓ '+f.name.slice(0,28);inp.parentElement.classList.add('ok')}
     catch(x){docs[i]=null;inp.value='';em.textContent='Не выбрано';inp.parentElement.classList.remove('ok');err.textContent=x.message==='type'?'Загрузите изображение (JPG или PNG), а не другой тип файла.':'Не удалось прочитать файл. Попробуйте другое фото.'}
    }));
   };
   cat.onchange=drawDocs;drawDocs();
   $('#aq-vok',s).onclick=()=>{
    const fail=m=>{err.textContent=m};
    const fio=$('#aq-vf',s).value.trim().replace(/\s+/g,' ');
    if(fio.split(' ').length<2||!/^[\p{L}][\p{L}'’\- ]{3,78}$/u.test(fio))return fail('Введите ФИО полностью: фамилия и имя (только буквы).');
    if(window.AqylNick&&!AqylNick.check(fio).ok)return fail('В ФИО есть запрещённое слово.');
    const bd=$('#aq-vb',s).value,bdt=new Date(bd);
    if(!bd||isNaN(bdt)||bdt>new Date()||bdt<new Date('1900-01-01'))return fail('Укажите корректную дату рождения.');
    let ph=$('#aq-vp',s).value.replace(/[^\d+]/g,'');if(/^8\d{10}$/.test(ph))ph='+7'+ph.slice(1);else if(/^7\d{10}$/.test(ph))ph='+'+ph;
    if(!/^\+7\d{10}$/.test(ph))return fail('Телефон в формате +7 700 000 00 00.');
    const need=CAT[cat.value][1].length;
    if(docs.filter(Boolean).length<need)return fail('Приложите все документы из списка ('+need+').');
    if(!$('#aq-vk',s).checked)return fail('Нужно согласие на передачу данных диспетчеру.');
    const total=docs.reduce((a,d)=>a+(d?d.data.length:0),0);
    if(total>850000)return fail('Фото слишком большие. Сделайте снимки меньшего размера.');
    if(!window.AqylDB)return fail('База данных недоступна.');
    const u=user(),id='c'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
    AqylDB.table('cards').set(id,{id,uid:u.id,name:u.name,fio,contact:u.contact,city:curCity(),category:cat.value,birth:bd,phone:ph,docs:docs.filter(Boolean),status:'new',ts:Date.now()});
    closeSheet();toast('Заявка отправлена диспетчеру');renderSettings();
   };
  });
 };
 if(w)w.gate(open,'оформить виртуальную карту');else open();
}
function physicalDialog(){
 const w=W();
 const open=()=>sheet(`${head('Добавить физическую карту')}
  <p>Введите номер карты AqylJol, напечатанный на ней (например, AQ 1234 5678 90).</p>
  <input class="aqw-in" id="aq-pn" autocomplete="off" autocapitalize="characters" maxlength="16" placeholder="AQ 0000 0000 00" aria-label="Номер карты">
  <input class="aqw-in" id="aq-pl2" maxlength="24" placeholder="Название (необязательно), например «Школьная»">
  <p class="aqw-err" id="aq-pE" role="alert"></p>
  <div class="aqw-row"><button class="aqw-btn" data-x>Отмена</button><button class="aqw-btn main" id="aq-pok">Добавить</button></div>
  <p class="aqw-note">Карта привязывается к вашему аккаунту на этом устройстве. Если карты пока нет — оформите виртуальную.</p>`,
 s=>{
  const n=$('#aq-pn',s),err=$('#aq-pE',s);
  n.addEventListener('input',()=>{const d=n.value.toUpperCase().replace(/[^A-Z0-9]/g,'').replace(/^AQ?/,'');n.value=('AQ'+d.replace(/\D/g,'').slice(0,10)).replace(/^(AQ)(\d{4})(\d{4})?(\d{0,2})?$/,(m,a,b,c,d)=>a+' '+b+(c?' '+c:'')+(d?' '+d:''))});
  $('#aq-pok',s).onclick=()=>{
   const num=n.value.replace(/\s/g,'').toUpperCase();
   if(!/^AQ\d{10}$/.test(num))return err.textContent='Номер должен быть в формате AQ и 10 цифр.';
   const list=rd(pcKey(),[]);
   if(list.some(c=>c.number===num))return err.textContent='Эта карта уже добавлена.';
   if(list.length>=5)return err.textContent='Можно добавить не больше 5 карт.';
   const label=($('#aq-pl2',s).value||'').trim().slice(0,24);
   if(label&&window.AqylNick&&!AqylNick.check(label).ok)return err.textContent='Это название нельзя использовать.';
   list.push({number:num,label,added:Date.now()});wr(pcKey(),list);
   closeSheet();toast('Карта добавлена');renderSettings();
  };
 });
 if(w)w.gate(open,'добавить карту');else open();
}
let qrP=null;
const loadQR=()=>window.QRCode?Promise.resolve():qrP||(qrP=new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';s.onload=ok;s.onerror=()=>{qrP=null;no()};document.head.append(s)}));
function qrDialog(number){
 sheet(`${head('QR карты')}<div class="aq-qrbox" id="aq-qrbox"><p class="aqw-note">Загружаю…</p></div><p style="text-align:center"><b>${esc(fmtCard(number))}</b></p><p class="aqw-note">Покажите QR на валидаторе. Демо: проверка карты в автобусе пока не подключена.</p>`,
 s=>{loadQR().then(()=>{const b=$('#aq-qrbox',s);if(!b)return;b.innerHTML='';new QRCode(b,{text:'aqyljol://card?id='+number,width:200,height:200,correctLevel:QRCode.CorrectLevel.M})}).catch(()=>{const b=$('#aq-qrbox',s);if(b)b.innerHTML='<p class="aqw-err">QR сейчас недоступен (нет интернета). Назовите номер карты.</p>'})});
}

/* ================= страница «Настройки» ================= */
let box=null,lastUid='';
function geoUI(){
 const el=$('#aq-geostatus');if(!el)return;
 const t=testPos();
 let txt,cls='';
 if(t){txt=T('Демо-режим: вы «стоите» рядом с автобусом №{n}.',{n:localStorage.getItem('aq-geo-test')});cls='good'}
 else if(!navigator.geolocation){txt=T('Браузер не поддерживает геолокацию.');cls='bad'}
 else if(st.geo==='denied'){txt=T('Доступ к геопозиции запрещён. Разрешите его в настройках браузера для этого сайта.');cls='bad'}
 else if(!geoFlag()){txt=T('Определение выключено.')}
 else if(st.fix&&Date.now()-st.fix.t<20000){txt=T('Работает. Точность сейчас: ±{n} м.',{n:st.fix.acc})+(st.fix.acc>PAY_ACC?' '+T('Для оплаты нужна точность не хуже {m} м.',{m:PAY_ACC}):'');cls=st.fix.acc>PAY_ACC?'bad':'good'}
 else{txt=T('Определяю местоположение…')}
 el.className='aq-dist '+cls;if(el.textContent!==txt)el.textContent=txt;
}
function enableGeo(){
 if(!navigator.geolocation){st.geo='error';geoUI();return}
 navigator.geolocation.getCurrentPosition(p=>{
  wr('aq-geo-on',1);st.fix={lat:p.coords.latitude,lng:p.coords.longitude,acc:Math.round(p.coords.accuracy),t:Date.now()};st.geo='ok';ensureGeo();geoUI();renderSettings();
 },e=>{st.geo=e.code===1?'denied':'error';geoUI()},{enableHighAccuracy:true,timeout:15000,maximumAge:0});
}
const sw=(id,on)=>`<label class="aq-switch"><input type="checkbox" id="${id}" ${on?'checked':''}><span></span></label>`;
function cardsHTML(){
 if(!user())return `<p class="muted">Войдите в аккаунт, чтобы оформить или добавить карту.</p><div class="aqw-row"><button class="aqw-btn main" data-au-open>Войти</button></div>`;
 const v=myCards(),p=rd(pcKey(),[]);
 const ST={new:'На рассмотрении у диспетчера',rejected:'Отклонена'};
 const vh=v.map(c=>c.status==='approved'&&c.card
  ?`<article class="aq-vcard" aria-label="Виртуальная карта"><div class="aq-vtop"><img src="aqyljol-icon.svg" alt="" width="28" height="29"><span>ВИРТУАЛЬНАЯ КАРТА</span></div><div class="aq-vnum">${esc(fmtCard(c.card.number))}</div><div class="aq-vbot"><div><small>Владелец</small><b>${esc(c.fio||c.name)}</b></div><div><small>Категория</small><b>${esc((CAT[c.category]||[c.category])[0])}</b></div></div><button class="aq-vqr" data-qr="${esc(c.card.number)}">Показать QR</button></article>`
  :`<div class="aq-req ${c.status}"><b>${esc(ST[c.status]||c.status)}</b><span>${esc((CAT[c.category]||[c.category])[0])} · ${new Date(c.ts).toLocaleDateString('ru-RU')}</span>${c.status==='rejected'?`<p>Причина: ${esc(c.reason||'не указана')}</p>`:''}</div>`).join('');
 const ph=p.map((c,i)=>`<div class="aq-pcard"><span>🪪</span><div><b>${esc(fmtCard(c.number))}</b>${c.label?`<small>${esc(c.label)}</small>`:''}</div><button class="aq-del" data-pdel="${i}" aria-label="Удалить карту">Удалить</button></div>`).join('');
 return (vh||ph?`<div class="aq-cardlist">${vh}${ph}</div>`:'<p class="muted">Карт пока нет.</p>')+`<div class="aqw-row"><button class="aqw-btn main" data-act="vreq">Оформить виртуальную карту</button><button class="aqw-btn" data-act="padd">Добавить физическую карту</button></div>
 <p class="fl-note">Виртуальную карту создаёт диспетчер после проверки формы и документов. Физическая карта добавляется по номеру.</p>`;
}
function renderSettings(){
 if(page!=='settings')return;
 if(!box){
  box=document.createElement('div');box.id='aq-settings';
  const theme=$('[data-theme-choice]'),anchor=theme&&theme.closest('section');
  if(anchor)anchor.before(box);else{const a=$('#app');if(!a)return;a.append(box)}
  box.addEventListener('click',onSettingsClick);box.addEventListener('change',onSettingsChange);
 }
 const ui=window.AqylI18n?AqylI18n.get():'ru',u=user();
 const b=u&&W()?W().load().balance:0,bk=u?bank():null;
 const perm='Notification' in window?Notification.permission:'unsupported';
 const buses=hasBuses()?BUSES.map(x=>`<option value="${esc(x.id)}" ${localStorage.getItem('aq-geo-test')===x.id?'selected':''}>№${esc(x.id)} — ${esc(x.name)}</option>`).join(''):'';
 box.innerHTML=`
 <section class="card aq-card" id="aq-lang"><h2>Язык интерфейса</h2><p class="muted">Выберите язык приложения. Названия остановок и ответы помощника остаются на исходном языке.</p>
  <div class="filters" role="group" aria-label="Язык интерфейса" data-no-i18n>${[['ru','Русский'],['kk','Қазақша'],['en','English']].map(([k,l])=>`<button class="chip ${ui===k?'active':''}" data-ui-lang="${k}" aria-pressed="${ui===k}">${l}</button>`).join('')}</div></section>
 <section class="card aq-card"><div class="aq-switchrow"><div><h2>Уведомления</h2><p class="muted">Сообщим, что вы рядом с автобусом, и напомним о подъезде автобуса. По умолчанию включены.</p></div>${sw('aq-notify',notifyOn())}</div>
  <p class="fl-note" id="aq-nhint">${perm==='granted'?'Системные уведомления браузера разрешены.':perm==='denied'?'Системные уведомления запрещены в браузере: сообщения будут появляться только на сайте.':perm==='unsupported'?'Браузер не поддерживает системные уведомления: сообщения будут появляться на сайте.':'Чтобы получать уведомления при свёрнутой вкладке, разрешите их в браузере.'} ${perm==='default'?'<button class="fl-btn" data-act="perm">Разрешить</button>':''}</p></section>
 <section class="card aq-card aq-offer"><span class="aq-badge">Рекомендуем</span><div class="aq-switchrow"><div><h2>Автоматическая оплата</h2><p class="muted">Включите — и проезд <b>${money(FARE)}</b> спишется сам, когда вы окажетесь не дальше ${PAY_M} м от автобуса. За ${AUTO_SEC} секунд до списания можно отменить. Нужны вход в аккаунт, доступ к геопозиции и деньги на балансе.</p></div>${sw('aq-autopay',autopayOn())}</div>
  <p class="fl-note">${u?'Баланс: <b>'+money(b)+'</b> · <a href="#" data-act="topup">Пополнить</a>':'Войдите в аккаунт, чтобы пользоваться автоплатой.'}</p></section>
 <section class="card aq-card" id="aq-geo"><h2>Точное определение местоположения</h2><p class="muted">Нужно, чтобы понять, что вы рядом с автобусом. Используется GPS с высокой точностью: оплата подтверждается, только если точность не хуже ${PAY_ACC} м, а до автобуса не больше ${PAY_M} м.</p>
  <div class="aq-dist" id="aq-geostatus" role="status"></div>
  <div class="aqw-row">${geoFlag()?'<button class="aqw-btn" data-act="geooff">Выключить</button>':'<button class="aqw-btn main" data-act="geoon">Включить определение</button>'}</div>
  <details class="aq-demo"><summary>Проверка без выхода на улицу (демо)</summary><p class="muted">Автобусы в этой версии виртуальные. Чтобы проверить уведомление, подтверждение и автооплату, поставьте себя рядом с выбранным автобусом.</p><select class="aqw-in" id="aq-testbus" aria-label="Автобус для проверки"><option value="">Выключено</option>${buses}</select></details></section>
 <section class="card aq-card" id="cards"><h2>Мои карты</h2>${cardsHTML()}</section>
 <section class="card aq-card" id="bank"><h2>Банковская карта</h2><div class="aq-testbanner">⚠ ТЕСТОВЫЙ РЕЖИМ: не вводите данные настоящей карты.</div>
  ${!u?'<p class="muted">Войдите в аккаунт, чтобы привязать карту.</p><div class="aqw-row"><button class="aqw-btn main" data-au-open>Войти</button></div>':bk?`<div class="aq-bankrow"><span>💳</span><div><b>${esc(bk.brand)} •••• ${esc(bk.last4)}</b><small>Срок ${esc(bk.exp)} · ${esc(bk.holder)} · тест</small></div><button class="aq-del" data-act="bankdel">Отвязать</button></div>`:'<p class="muted">Карта не привязана. Её можно использовать для пополнения кошелька (демо).</p><div class="aqw-row"><button class="aqw-btn main" data-act="bankadd">Привязать карту (тест)</button></div>'}</section>`;
 geoUI();
}
function onSettingsClick(e){
 const l=e.target.closest('[data-ui-lang]');
 if(l){if(window.AqylI18n)AqylI18n.set(l.dataset.uiLang);renderSettings();return}
 const q=e.target.closest('[data-qr]');if(q)return qrDialog(q.dataset.qr);
 const d=e.target.closest('[data-pdel]');
 if(d){const list=rd(pcKey(),[]);list.splice(+d.dataset.pdel,1);wr(pcKey(),list);renderSettings();return}
 const a=e.target.closest('[data-act]');if(!a)return;
 e.preventDefault();
 const act=a.dataset.act;
 if(act==='perm'){try{Notification.requestPermission().then(()=>renderSettings())}catch{}}
 else if(act==='topup'){const w=W();if(w)w.gate(()=>w.topUp(),'пополнить кошелёк')}
 else if(act==='geoon'){const w=W();w?w.gate(enableGeo,'включить определение рядом с автобусом'):enableGeo()}
 else if(act==='geooff'){wr('aq-geo-on',0);stopGeo();st.fix=null;renderSettings()}
 else if(act==='vreq')virtualDialog();
 else if(act==='padd')physicalDialog();
 else if(act==='bankadd')bankDialog();
 else if(act==='bankdel'){try{localStorage.removeItem(bankKey())}catch{}renderSettings();toast('Карта отвязана')}
}
function onSettingsChange(e){
 const t=e.target;
 if(t.id==='aq-notify'){
  try{localStorage.setItem('aq-notify',t.checked?'1':'0')}catch{}
  if(t.checked&&'Notification' in window&&Notification.permission==='default'){try{Notification.requestPermission().then(()=>renderSettings())}catch{}}
  toast(t.checked?'Уведомления включены':'Уведомления выключены');
 }else if(t.id==='aq-autopay'){
  if(t.checked){
   const w=W();
   if(!user()){t.checked=false;if(w)w.gate(()=>{},'включить автоматическую оплату');return}
   try{localStorage.setItem('aq-autopay','1')}catch{}
   if(!geoFlag()&&!localStorage.getItem('aq-geo-test'))enableGeo();
   toast('Автоматическая оплата включена');
  }else{try{localStorage.setItem('aq-autopay','0')}catch{}toast('Автоматическая оплата выключена')}
 }else if(t.id==='aq-testbus'){
  try{t.value?localStorage.setItem('aq-geo-test',t.value):localStorage.removeItem('aq-geo-test')}catch{}
  st.notified={};st.autoCancel={};ensureGeo();geoUI();
  toast(t.value?'Демо: вы рядом с автобусом №'+t.value:'Демо-проверка выключена');
 }
}

/* ================= оформление страниц ================= */
const SOC={
 ig:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/></svg>',
 tg:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 4 3 11l6 2 2 6 3-4 5 3z"/><path d="m9 13 8-6"/></svg>',
 mail:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg>'
};
function ensureSocial(){
 const app=$('#app');if(!app||$('#aq-social'))return;
 const sec=document.createElement('section');sec.id='aq-social';sec.className='card aq-social';
 sec.innerHTML=`<div class="aq-soc-text"><span class="eyebrow">МЫ НА СВЯЗИ</span><h2>Найди нас в соцсетях</h2><p class="muted">Новости, обновления и поддержка — там, где тебе удобно.</p></div>
 <div class="aq-soc-links">
  <a class="aq-soc ig" href="https://www.instagram.com/QadamTeam/" target="_blank" rel="noopener noreferrer">${SOC.ig}<span><small>Instagram</small><b>@QadamTeam</b></span></a>
  <a class="aq-soc tg" href="https://t.me/AqylJolSupport" target="_blank" rel="noopener noreferrer">${SOC.tg}<span><small>Telegram</small><b>@AqylJolSupport</b></span></a>
  <a class="aq-soc ml" href="mailto:Aqyl@jol.qadam">${SOC.mail}<span><small>Email</small><b>Aqyl@jol.qadam</b></span></a>
 </div>`;
 const f=$('.brand-footer',app);if(f)f.before(sec);else app.append(sec);
}
const NEWS=[{
 date:'13 октября 2026',tag:'Обновление',title:'Масштабное обновление AqylJol',
 text:'Масштабное обновление с изменениями, которые затронули интерфейс для пользователей: приложение стало удобнее, понятнее и аккуратнее.',
 items:['Кнопка QR для оплаты — на каждой вкладке','Проезд стоит фиксированные 80 ₸','Автоматическая оплата и уведомление «вы рядом с автобусом»','Оплата по гос. номеру автобуса','Виртуальные карты: заявку с документами рассматривает диспетчер','Привязка банковской карты (тестовый режим)','Язык интерфейса: русский, қазақша, English','Водители могут написать диспетчеру прямо из кабинета','Обновлённый дизайн интерфейса']
}];
function ensureNews(){
 if(page!=='about'||$('#aq-news'))return;
 const anchor=$('.about-hero')||$('.pageheading');if(!anchor)return;
 const sec=document.createElement('section');sec.id='aq-news';sec.className='card aq-news';
 sec.innerHTML=`<div class="aq-news-head"><span class="eyebrow">НОВОСТИ И ОБНОВЛЕНИЯ</span><h2>Последние новости</h2></div>`+NEWS.map(n=>`<article class="aq-news-item"><div class="aq-news-meta"><span class="aq-badge">${esc(n.tag)}</span><time>${esc(n.date)}</time></div><h3>${esc(n.title)}</h3><p>${esc(n.text)}</p><ul>${n.items.map(i=>`<li>${esc(i)}</li>`).join('')}</ul></article>`).join('');
 anchor.after(sec);
}
function decorate(){
 if(!hasBuses())return;
 $$('.buscard').forEach(c=>{
  const id=($('.route-number',c)||{}).textContent;if(!id||$('.aq-plate',c))return;
  const stats=$('.route-stats',c),p=plateOf(curCity(),id.trim());if(!stats||!p)return;
  const s=document.createElement('span');s.className='aq-plate';s.title='Демо-номер автобуса';s.textContent=p;stats.append(s);
 });
 ensureSocial();ensureNews();
}

/* ================= запуск ================= */
function init(){
 mountQR();placeFabs();addEventListener('resize',placeFabs);decorate();renderSettings();ensureGeo();
 try{if(navigator.permissions&&navigator.permissions.query)navigator.permissions.query({name:'geolocation'}).then(r=>{if(r.state==='granted'&&localStorage.getItem('aq-geo-on')===null){wr('aq-geo-on',1);ensureGeo()}}).catch(()=>{})}catch{}
 setInterval(()=>{
  decorate();ensureGeo();placeFabs();
  const u=uid();if(u!==lastUid){lastUid=u;renderSettings()}
 },1500);
 lastUid=uid();
 setInterval(loop,2000);
 addEventListener('aq-db-sync',()=>{if(box&&!sheetEl)renderSettings()});
 addEventListener('aq-lang',()=>{if(box)renderSettings()});
 if(location.hash&&page==='settings')setTimeout(()=>{const t=$(location.hash);if(t)t.scrollIntoView({behavior:'smooth',block:'start'})},500);
}
window.AqylFeatures={plateDialog,confirmDialog,plateOf,findPlate,FARE,PAY_M,loop,nearest};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
