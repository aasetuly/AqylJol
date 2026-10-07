/* AqylJol: геолокация + кошелёк (демо). Работает поверх остальных скриптов, их не меняет. */
(function(){
'use strict';
const DEFAULT_FARE=120,MAX_TOPUP=50000,MAX_BAL=200000;
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('ru-RU').format(Math.round(n))+' ₸';
const when=t=>new Date(t).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
/* Авторизация: кошелёк и геолокация доступны только после входа (auth.js). Кошелёк хранится отдельно для каждого аккаунта. */
const authUser=()=>{try{return window.AqylAuth&&AqylAuth.user()||null}catch{return null}};
const uid=u=>u?String(u.id||u.contact||u.email||u.phone||u.name):'';
const WK=()=>{const u=authUser();return u?'aq-wallet:'+uid(u):null};
let mem={};
function load(){const k=WK();if(!k)return{balance:0,history:[]};try{const v=JSON.parse(localStorage.getItem(k));if(v&&typeof v.balance==='number')return v}catch{}return mem[k]||{balance:0,history:[]}}
function save(w){const k=WK();if(!k)return;mem[k]=w;try{localStorage.setItem(k,JSON.stringify(w))}catch{}updateChip()}
function note(t){const el=$('#toast');if(el){el.textContent=t;setTimeout(()=>{if(el.textContent===t)el.textContent=''},3000)}}
const ico=d=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

/* ---------- Окно ---------- */
let back=null,stopCam=()=>{};
function open(html,onMount){
 close();
 back=document.createElement('div');back.className='aqw-back';
 back.innerHTML=`<div class="aqw-sheet" role="dialog" aria-modal="true">${html}</div>`;
 back.addEventListener('click',e=>{if(e.target===back)close()});
 document.body.appendChild(back);
 back.addEventListener('click',e=>{if(e.target.closest('[data-x]'))close()});
 onMount&&onMount($('.aqw-sheet',back));
}
function close(){stopCam();stopCam=()=>{};if(back){back.remove();back=null}}
document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
const head=t=>`<div class="aqw-head"><h2>${t}</h2><button class="aqw-x" data-x aria-label="Закрыть">×</button></div>`;

/* ---------- Кошелёк ---------- */
function walletHome(){
 const w=load();
 open(`${head('Кошелёк')}
 <div class="aqw-bal"><small>Баланс</small><b>${money(w.balance)}</b></div>
 <div class="aqw-row"><button class="aqw-btn main" data-a="nfc">📲 Оплатить NFC</button><button class="aqw-btn main" data-a="scan">Сканировать QR</button></div>
 <div class="aqw-row"><button class="aqw-btn" data-a="top">Пополнить</button><button class="aqw-btn" data-a="hist">Поездки и оплаты</button></div>
 <h2 style="font-size:16px;margin-top:14px">Последние операции</h2>
 ${w.history.length?`<ul class="aqw-list">${w.history.slice(0,5).map(histRow).join('')}</ul>`:'<p>Операций пока нет.</p>'}
 <p class="aqw-note">Демо-режим: реальные деньги не списываются и не зачисляются. Баланс хранится только в этом браузере.</p>`,
 s=>{s.querySelector('[data-a=top]').onclick=()=>topUp();s.querySelector('[data-a=scan]').onclick=scan;s.querySelector('[data-a=nfc]').onclick=nfcPay;s.querySelector('[data-a=hist]').onclick=()=>historyView('all')});
}
function add(amount,title,meta){if(!authUser())return load();const w=load();w.balance+=amount;w.history.unshift({t:Date.now(),amount,title,...(meta||{})});w.history=w.history.slice(0,200);save(w);return w}
const kindOf=h=>h.kind||(h.amount>0?'topup':'qr');
const KIND={topup:'Пополнение',nfc:'NFC',qr:'QR'};

function topUp(prefill){
 const w=load();
 open(`${head('Пополнение')}<p>Выберите сумму (демо).</p>
 <div class="aqw-row">${[500,1000,2000,5000].map(a=>`<button class="aqw-btn" data-amt="${a}">${money(a)}</button>`).join('')}</div>
 <input class="aqw-in" id="aqw-amt" type="number" inputmode="numeric" min="100" max="${MAX_TOPUP}" placeholder="Другая сумма, ₸" value="${prefill>0?prefill:''}">
 <p class="aqw-err" id="aqw-e"></p>
 <div class="aqw-row"><button class="aqw-btn" data-a="back">Назад</button><button class="aqw-btn main" data-a="ok">Пополнить</button></div>`,
 s=>{
  const inp=s.querySelector('#aqw-amt'),err=s.querySelector('#aqw-e');
  s.querySelectorAll('[data-amt]').forEach(b=>b.onclick=()=>{inp.value=b.dataset.amt});
  s.querySelector('[data-a=back]').onclick=walletHome;
  s.querySelector('[data-a=ok]').onclick=()=>{
   const a=Math.floor(+inp.value);
   if(!(a>=100))return err.textContent='Минимальная сумма — 100 ₸.';
   if(a>MAX_TOPUP)return err.textContent=`Максимум за раз — ${money(MAX_TOPUP)}.`;
   if(load().balance+a>MAX_BAL)return err.textContent=`Баланс не может превышать ${money(MAX_BAL)}.`;
   add(a,'Пополнение',{kind:'topup'});note('Баланс пополнен на '+money(a));walletHome();
  };
 });
}


/* ---------- История поездок и оплат ---------- */
const ICON={topup:'＋',nfc:'📲',qr:'▦'};
function histRow(h){
 const k=kindOf(h),sub=[when(h.t),KIND[k]||'',h.city&&typeof CITIES!=='undefined'&&CITIES[h.city]?CITIES[h.city].name:''].filter(Boolean).join(' · ');
 return `<li><span>${ICON[k]||''} ${esc(h.title)}<small>${esc(sub)}</small></span><span class="${h.amount>0?'aqw-plus':'aqw-minus'}">${h.amount>0?'+':'−'}${money(Math.abs(h.amount))}</span></li>`;
}
function historyView(filter){
 const w=load(),all=w.history;
 const rides=all.filter(h=>h.amount<0),mon=new Date();mon.setDate(1);mon.setHours(0,0,0,0);
 const spent=rides.reduce((a,h)=>a-h.amount,0),spentM=rides.filter(h=>h.t>=mon.getTime()).reduce((a,h)=>a-h.amount,0);
 const list=all.filter(h=>filter==='all'||(filter==='rides'?h.amount<0:h.amount>0));
 const tab=(f,t)=>`<button class="aqw-btn${filter===f?' main':''}" data-f="${f}">${t}</button>`;
 open(`${head('Поездки и оплаты')}
 <div class="aqw-row"><div class="aqw-bal" style="flex:1;margin:4px 0"><small>Поездок</small><b style="font-size:26px">${rides.length}</b></div><div class="aqw-bal" style="flex:1;margin:4px 0"><small>В этом месяце</small><b style="font-size:26px">${money(spentM)}</b></div></div>
 <p class="aqw-note" style="margin-top:0">Всего потрачено: ${money(spent)}</p>
 <div class="aqw-row">${tab('all','Все')}${tab('rides','Поездки')}${tab('top','Пополнения')}</div>
 ${list.length?`<ul class="aqw-list">${list.map(histRow).join('')}</ul>`:'<p>Здесь пока пусто.</p>'}
 <div class="aqw-row"><button class="aqw-btn" data-a="back">Назад</button></div>
 <p class="aqw-note">Демо: история хранится в вашем аккаунте и видна на всех ваших устройствах после входа.</p>`,
 s=>{s.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>historyView(b.dataset.f));s.querySelector('[data-a=back]').onclick=walletHome});
}

/* ---------- NFC-оплата (демо) ---------- */
function beep(){try{const C=window.AudioContext||window.webkitAudioContext,c=new C(),o=c.createOscillator(),g=c.createGain();o.frequency.value=1040;g.gain.value=.08;o.connect(g);g.connect(c.destination);o.start();setTimeout(()=>{o.stop();c.close()},180)}catch{}try{navigator.vibrate&&navigator.vibrate([60,40,60])}catch{}}
function nfcPay(bus0,amount0){
 const list=typeof BUSES!=='undefined'?BUSES:[];
 const w=load(),cityName=typeof CITIES!=='undefined'&&CITIES[curCity()]?CITIES[curCity()].name:'';
 const want=String(bus0&&bus0.length<6?bus0:'');
 open(`${head('Оплата NFC')}
 <p>Демо-валидатор: выберите автобус и «приложите» телефон. Реальные деньги не списываются.</p>
 <label class="aqw-note">Автобус</label>
 <select class="aqw-in" id="aqw-bus">${list.length?list.map(b=>`<option value="${esc(b.id)}"${String(b.id)===want?' selected':''}>Автобус ${esc(b.id)}${b.name?' — '+esc(b.name):''}</option>`).join(''):'<option value="">Автобус</option>'}</select>
 <label class="aqw-note">Стоимость проезда, ₸</label>
 <input class="aqw-in" id="aqw-fare" type="number" inputmode="numeric" min="1" value="${amount0>0?amount0:DEFAULT_FARE}">
 <div class="aqw-nfc" id="aqw-ring" aria-live="polite"><div class="aqw-wave"></div><div class="aqw-wave w2"></div><span id="aqw-ni">📲</span></div>
 <p id="aqw-ns" style="text-align:center">Баланс: <b>${money(w.balance)}</b>. Нажмите кнопку, чтобы приложить телефон.</p>
 <p class="aqw-err" id="aqw-e"></p>
 <div class="aqw-row"><button class="aqw-btn" data-a="back">Назад</button><button class="aqw-btn main" data-a="tap">Приложить к валидатору</button></div>
 ${'NDEFReader' in window?'<div class="aqw-row"><button class="aqw-btn" data-a="real">Считать реальную NFC-метку</button></div>':''}`,
 s=>{
  const ring=s.querySelector('#aqw-ring'),st=s.querySelector('#aqw-ns'),err=s.querySelector('#aqw-e'),btn=s.querySelector('[data-a=tap]');
  s.querySelector('[data-a=back]').onclick=walletHome;
  const pay=(bus,fare)=>{
   err.textContent='';
   if(!(fare>0))return err.textContent='Введите стоимость.';
   const cur=load();
   if(cur.balance<fare){err.innerHTML=`Не хватает ${money(fare-cur.balance)}. <a href="#" id="aqw-tp">Пополнить</a>`;s.querySelector('#aqw-tp').onclick=e=>{e.preventDefault();topUp(fare-cur.balance)};return}
   btn.disabled=true;ring.classList.add('on');st.innerHTML='Считываю карту…';
   setTimeout(()=>{
    const label='Автобус '+(bus||'');
    const w2=add(-fare,'Поездка: '+label,{kind:'nfc',bus:String(bus||''),city:curCity()});
    beep();
    open(`${head('Оплачено ✓')}<div class="aqw-ok">✓</div><div class="aqw-bal"><small>Списано</small><b>${money(fare)}</b></div>
    <p>${esc(label)}${cityName?' · '+esc(cityName):''} · ${when(Date.now())}</p><p>Остаток: <b>${money(w2.balance)}</b></p>
    <div class="aqw-row"><button class="aqw-btn" data-a="h">Поездки и оплаты</button><button class="aqw-btn main" data-x>Готово</button></div>`,
    s2=>{s2.querySelector('[data-a=h]').onclick=()=>historyView('rides')});
   },1300);
  };
  btn.onclick=()=>pay(s.querySelector('#aqw-bus').value,Math.floor(+s.querySelector('#aqw-fare').value));
  const real=s.querySelector('[data-a=real]');
  if(real)real.onclick=async()=>{
   try{
    const r=new NDEFReader();await r.scan();st.textContent='Поднесите метку к задней стенке телефона…';ring.classList.add('on');
    r.onreading=e=>{
     let txt='';for(const rec of e.message.records){try{txt+=new TextDecoder(rec.encoding||'utf-8').decode(rec.data)+' '}catch{}}
     const q=parseQR(txt.trim());const m=/(\d+)/.exec(q.label||'');
     if(m)s.querySelector('#aqw-bus').value=m[1];
     ring.classList.remove('on');pay(m?m[1]:s.querySelector('#aqw-bus').value,q.amount>0?q.amount:Math.floor(+s.querySelector('#aqw-fare').value));
    };
   }catch{err.textContent='NFC недоступен или запрещён. Используйте демо-кнопку.';ring.classList.remove('on')}
  };
 });
}

/* ---------- QR ---------- */
function parseQR(raw){
 const text=String(raw||'').trim();let o={raw:text,type:'pay',amount:0,label:''};
 try{const j=JSON.parse(text);if(j&&typeof j==='object'){o.type=j.type==='topup'?'topup':'pay';o.amount=+j.amount||0;o.label=String(j.label||j.bus&&('Автобус '+j.bus)||'');return o}}catch{}
 try{const u=new URL(text);
  if(/^aqyljol:$/i.test(u.protocol)||/aqyljol/i.test(u.hostname)){
   const kind=(u.hostname&&u.hostname!=='')?u.hostname:u.pathname.replace(/\//g,'');
   o.type=/topup/i.test(kind+u.pathname)?'topup':'pay';
   o.amount=+u.searchParams.get('amount')||0;
   const bus=u.searchParams.get('bus');o.label=u.searchParams.get('label')||(bus?'Автобус '+bus:'');return o}
 }catch{}
 o.label=text.slice(0,40);return o;
}
function handleQR(raw){
 const q=parseQR(raw);
 if(/^aqyljol:\/\/nfc/i.test(String(raw).trim()))return nfcPay((q.label.match(/\d+/)||[''])[0],q.amount);
 if(q.type==='topup'){return q.amount>0?topUp(q.amount):topUp()}
 const w=load(),known=q.amount>0;
 open(`${head('Оплата проезда')}
 <p>Получатель: <b>${esc(q.label||'Не указан')}</b></p>
 ${known?`<div class="aqw-bal"><small>К оплате</small><b>${money(q.amount)}</b></div>`:`<input class="aqw-in" id="aqw-amt" type="number" inputmode="numeric" min="1" value="${DEFAULT_FARE}" aria-label="Сумма"><p class="aqw-note">В QR нет суммы — укажите её вручную.</p>`}
 <p>Ваш баланс: <b>${money(w.balance)}</b></p><p class="aqw-err" id="aqw-e"></p>
 <div class="aqw-row"><button class="aqw-btn" data-a="back">Отмена</button><button class="aqw-btn main" data-a="ok">Оплатить</button></div>`,
 s=>{
  const err=s.querySelector('#aqw-e');
  s.querySelector('[data-a=back]').onclick=walletHome;
  s.querySelector('[data-a=ok]').onclick=()=>{
   const a=known?q.amount:Math.floor(+s.querySelector('#aqw-amt').value);
   if(!(a>0))return err.textContent='Введите сумму.';
   const cur=load();
   if(cur.balance<a){err.innerHTML=`Не хватает ${money(a-cur.balance)}. <a href="#" id="aqw-tp">Пополнить</a>`;s.querySelector('#aqw-tp').onclick=e=>{e.preventDefault();topUp(a-cur.balance)};return}
   const w2=add(-a,'Оплата: '+(q.label||'QR'),{kind:'qr',bus:(q.label.match(/\d+/)||[''])[0],city:curCity()});
   open(`${head('Оплачено ✓')}<div class="aqw-bal"><small>Списано</small><b>${money(a)}</b></div><p>${esc(q.label||'QR')} · ${when(Date.now())}</p><p>Остаток: <b>${money(w2.balance)}</b></p><div class="aqw-row"><button class="aqw-btn main" data-x>Готово</button></div>`);
  };
 });
}
let jsqrP=null;
function loadJsQR(){return window.jsQR?Promise.resolve():jsqrP||(jsqrP=new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js';s.onload=res;s.onerror=()=>{jsqrP=null;rej()};document.head.appendChild(s)}))}
async function decodeSource(src,w,h){ // src: video | img | canvas
 if('BarcodeDetector' in window){try{const r=await new BarcodeDetector({formats:['qr_code']}).detect(src);if(r[0])return r[0].rawValue}catch{}}
 try{await loadJsQR()}catch{return null}
 const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(src,0,0,w,h);
 const d=window.jsQR&&jsQR(x.getImageData(0,0,w,h).data,w,h);return d?d.data:null;
}
function scan(){
 open(`${head('Сканер QR')}
 <video class="aqw-video" id="aqw-v" playsinline muted></video>
 <p id="aqw-st">Запускаю камеру…</p>
 <div class="aqw-row"><label class="aqw-btn" style="text-align:center">Фото с QR<input type="file" accept="image/*" id="aqw-f" hidden></label></div>
 <input class="aqw-in" id="aqw-m" placeholder="Или вставьте код, напр. aqyljol://pay?bus=12&amount=120">
 <div class="aqw-row"><button class="aqw-btn" data-a="back">Назад</button><button class="aqw-btn main" data-a="m">Продолжить</button></div>`,
 async s=>{
  const v=s.querySelector('#aqw-v'),st=s.querySelector('#aqw-st');let alive=true,stream=null;
  stopCam=()=>{alive=false;stream&&stream.getTracks().forEach(t=>t.stop())};
  s.querySelector('[data-a=back]').onclick=walletHome;
  s.querySelector('[data-a=m]').onclick=()=>{const t=s.querySelector('#aqw-m').value.trim();t?handleQR(t):st.textContent='Введите код.'};
  s.querySelector('#aqw-f').onchange=async e=>{
   const f=e.target.files[0];if(!f)return;st.textContent='Читаю изображение…';
   const img=new Image();img.onload=async()=>{const sc=Math.min(1,1000/Math.max(img.width,img.height));const r=await decodeSource(img,Math.round(img.width*sc),Math.round(img.height*sc));r?handleQR(r):st.textContent='QR на фото не найден.'};
   img.onerror=()=>st.textContent='Не удалось открыть файл.';img.src=URL.createObjectURL(f);
  };
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||!window.isSecureContext){st.textContent='Камера доступна только по https или localhost. Загрузите фото или вставьте код.';v.hidden=true;return}
  try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});if(!alive){stopCam();return}v.srcObject=stream;await v.play();st.textContent='Наведите камеру на QR-код';
   const tick=async()=>{if(!alive)return;if(v.videoWidth){const r=await decodeSource(v,v.videoWidth,v.videoHeight);if(r&&alive){stopCam();return handleQR(r)}}setTimeout(tick,300)};tick();
  }catch{st.textContent='Нет доступа к камере. Разрешите её в браузере или используйте фото/код.';v.hidden=true}
 });
}

/* ---------- Геолокация ---------- */
const km=(a,b)=>{const R=6371,r=Math.PI/180,dl=(b[0]-a[0])*r,dn=(b[1]-a[1])*r,h=Math.sin(dl/2)**2+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(h))};
const dist=k=>k<1?Math.round(k*1000)+' м':k.toFixed(1)+' км';
function curCity(){try{const c=JSON.parse(localStorage.getItem('aq-city'));if(c)return c}catch{}return 'atyrau'}
/* ---------- Моя позиция на карте маршрутов ---------- */
let meLayer=null;
function showOnMap(me,acc,pan){
 const m=window.AqylLeafletMap;if(!m||!window.L)return false;
 if(meLayer){try{m.removeLayer(meLayer)}catch{}}
 const dot=L.marker(me,{icon:L.divIcon({className:'',html:'<div class="aq-me"><i></i></div>',iconSize:[22,22],iconAnchor:[11,11]}),title:'Вы здесь',zIndexOffset:2000}).bindPopup('Вы здесь'+(acc?' (±'+acc+' м)':''));
 const parts=[dot];if(acc)parts.unshift(L.circle(me,{radius:acc,color:'#1a73e8',weight:1,fillColor:'#1a73e8',fillOpacity:.12,interactive:false}));
 meLayer=L.layerGroup(parts).addTo(m);
 if(pan){m.setView(me,Math.max(m.getZoom(),15),{animate:true});dot.openPopup()}
 return true;
}
function restoreMe(){
 try{const s=JSON.parse(sessionStorage.getItem('aq-me'));if(!s||Date.now()-s.t>600000)return;
  let n=0;const t=setInterval(()=>{if(showOnMap([s.lat,s.lng],s.acc,false)||++n>40)clearInterval(t)},250)}catch{}
}
function locate(){
 open(`${head('Где я')}<p id="aqw-g">Определяю местоположение…</p>`,s=>{
  const out=s.querySelector('#aqw-g');
  if(!navigator.geolocation){out.className='aqw-err';out.textContent='Браузер не поддерживает геолокацию.';return}
  navigator.geolocation.getCurrentPosition(p=>{
   const me=[p.coords.latitude,p.coords.longitude],acc=Math.round(p.coords.accuracy);
   try{sessionStorage.setItem('aq-me',JSON.stringify({lat:me[0],lng:me[1],acc,t:Date.now()}))}catch{}
   const onMap=showOnMap(me,acc,true);
   const C=typeof CITIES!=='undefined'?CITIES:null;if(!C){out.textContent=`Вы здесь: ${me[0].toFixed(5)}, ${me[1].toFixed(5)}`;return}
   const ids=Object.keys(C);let id=curCity();if(!C[id])id=ids[0];
   const nearCity=ids.map(i=>[i,km(me,C[i].center)]).sort((a,b)=>a[1]-b[1])[0];
   const far=km(me,C[id].center)>25,use=far?nearCity[0]:id;
   const stops=C[use].stops.map((n,i)=>({n,d:km(me,C[use].points[i])})).sort((a,b)=>a.d-b.d).slice(0,3);
   const osm=`https://www.openstreetmap.org/?mlat=${me[0]}&mlon=${me[1]}#map=16/${me[0]}/${me[1]}`;
   out.outerHTML=`<div class="aqw-bal"><small>Вы здесь (±${acc} м)</small><b style="font-size:20px">${me[0].toFixed(5)}, ${me[1].toFixed(5)}</b></div>
   ${far&&use!==id?`<p>Вы далеко от выбранного города. Ближайший — <b>${esc(C[use].name)}</b>. <a href="#" id="aqw-sw">Переключить город</a></p>`:''}
   <p>Ближайшая остановка (${esc(C[use].name)}):</p>
   <ul class="aqw-list">${stops.map((x,i)=>`<li><span>${i?'':'📍 '}${esc(x.n)}<small>~${Math.max(1,Math.round(x.d*1000/80))} мин пешком</small></span><b>${dist(x.d)}</b></li>`).join('')}</ul>
   <div class="aqw-row">${onMap?'':`<a class="aqw-btn" style="text-align:center;text-decoration:none" href="map.html">Показать на карте маршрутов</a>`}<button class="aqw-btn main" data-x>Закрыть</button></div>
   <p class="aqw-note">Координаты остановок в демо приблизительные — это не реальные данные перевозчика.</p>`;
   const sw=$('#aqw-sw',back);if(sw)sw.onclick=e=>{e.preventDefault();try{localStorage.setItem('aq-city',JSON.stringify(use))}catch{}location.reload()};
  },e=>{out.className='aqw-err';out.textContent=e.code===1?'Доступ к геолокации запрещён. Разрешите его в настройках сайта.':e.code===3?'Не удалось определить место за 12 секунд. Попробуйте ещё раз.':'Место определить не удалось.'+(window.isSecureContext?'':' Откройте сайт по https или localhost.')},{enableHighAccuracy:true,timeout:12000,maximumAge:30000});
 });
}

/* ---------- Требование входа ---------- */
let pending=null;
function gate(fn,what){
 if(authUser()){fn();return}
 pending=fn;
 open(`${head('Нужен вход')}<p>Чтобы ${what}, войдите в аккаунт через Google или почту.</p>
 <div class="aqw-row"><button class="aqw-btn" data-x>Позже</button><button class="aqw-btn main" data-a="in">Войти</button></div>`,
 s=>{s.querySelector('[data-a=in]').onclick=()=>{close();if(window.AqylAuth)AqylAuth.open();else note('Окно входа недоступно: auth.js не загружен.')}});
}
let lastUid=uid(authUser());
setInterval(()=>{ // реакция на вход/выход
 const now=uid(authUser());
 if(now===lastUid)return;
 lastUid=now;updateChip();
 if(now&&pending){const f=pending;pending=null;f()}
 else if(!now){pending=null;close()}
},500);

/* ---------- Кнопки на странице ---------- */
let chip=null;
function updateChip(){if(chip)chip.innerHTML=`${ico('M3 7h18v12H3zM3 7l2-3h14l2 3M16 13h2')}<span class="aqw-t">${authUser()?money(load().balance):'Кошелёк'}</span>`;chip.classList.toggle('aqw-guest',!authUser())}
function mount(){
 if(!chip){chip=document.createElement('button');chip.className='aqw-chip';chip.setAttribute('aria-label','Кошелёк');chip.onclick=()=>gate(walletHome,'пользоваться кошельком');updateChip()}
 const h=$('#header');
 if(h){if(chip.parentNode!==h){chip.classList.remove('aqw-float');h.appendChild(chip)}}
 else if(!chip.parentNode){chip.classList.add('aqw-float');document.body.appendChild(chip)}
 if(!$('.aqw-geo')){const g=document.createElement('button');g.className='aqw-geo';g.setAttribute('aria-label','Где я и ближайшая остановка');g.title='Где я';g.innerHTML=ico('M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12ZM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z');g.onclick=()=>gate(locate,'узнать своё местоположение и ближайшую остановку');document.body.appendChild(g)}
}
function init(){mount();const h=$('#header');if(h)new MutationObserver(()=>{if(chip&&chip.parentNode!==h)mount()}).observe(h,{childList:true})}
addEventListener('aq-db-sync',e=>{if(e.detail&&String(e.detail.key).startsWith('aq-wallet:'))updateChip()});
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
restoreMe();
})();
