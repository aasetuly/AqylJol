/* AqylJol: умный помощник (демо, без внешнего ИИ). Подключается только на assistant.html после script.js.
   Заменяет старый чат: понимает свободный текст (RU/KZ), ведёт диалог с вариантами выбора и помнит контекст. */
(function(){
'use strict';
if(document.body.dataset.page!=='assistant')return;
const old=document.querySelector('.assistantpage .card');
if(!old||typeof BUSES==='undefined'||typeof CITIES==='undefined')return;

let lang=(typeof read==='function'&&read('lang','ru'))==='kz'?'kz':'ru';
const T=(ru,kz)=>lang==='kz'?kz:ru;
const calm=matchMedia('(prefers-reduced-motion: reduce)').matches;
const ctx={bus:null,from:null,to:null,deadline:null,pending:null,nbus:null,nstop:null,nlead:null};
const AA=window.AqylAlerts||null; // уведомления о приближении автобуса (alerts.js)

/* ---------- Разбор текста ---------- */
const KZMAP={ә:'а',ғ:'г',қ:'к',ң:'н',ө:'о',ұ:'у',ү:'у',һ:'х',і:'и',ё:'е'};
const kz=s=>String(s).toLowerCase().replace(/[әғқңөұүһіё]/g,c=>KZMAP[c]);
const norm=s=>kz(s).replace(/[^a-zа-я0-9:.\/№\s-]/g,' ').replace(/\s+/g,' ').trim();
const R=src=>new RegExp(kz(src),'i'); // шаблоны пишутся обычными словами, казахские буквы приводятся к тем же

const RX={
 menu:R('меню|начать|помощь|помоги|что умеешь|что ты умеешь|help|көмек|не істей аласың|мүмкіндік'),
 hello:R('^(привет|здравствуй|здравствуйте|добрый|хай|hello|hi|салем|сәлем|ассалау|сәлеметсіз)'),
 thanks:R('спасибо|благодар|рахмет|thanks'),
 bye:R('пока|до свидания|удачи|сау бол|көріскенше'),
 wallet:R('баланс|кошел|пополн|оплат|заплат|qr|кьюар|төле|шот|әмиян'),
 geo:R('где я|рядом|ближайш[а-я]* останов|поблизости|около меня|мо[её] местоположение|геолокац|жақын|қайдамын|қай жердемін'),
 stops:R('останов|аялдама|список станци'),
 map:R('на карте|покажи|карта|картада|көрсет'),
 seats:R('свободн|мест[аоу]?(?![а-я])|сесть|сидеть|не толп|народ|заполнен|толп|битком|просторн|бос орын|бос'),
 fast:R('быстр|скоро|раньше|приед|ждать|ближайший автобус|ерте|жылдам|тез'),
 best:R('лучш|комфорт|рекоменд|посовету|оптимальн|удобн|ыңғайлы|жақсы|ұсын'),
 walk:R('пешком|поменьше ходить|ближе к дому|жаяу'),
 direct:R('без пересад|прямой|прямо|ауыспай|тура'),
 all:R('все автобус|весь список|список автобус|все маршрут|барлық автобус|барлық маршрут'),
 compare:R('сравни|сравнить|или|салыстыр'),
 trip:R('доехать|добраться|поехать|как проехать|маршрут от|построй|поездк|жету|барамын|бару'),
 time:R('успеть|успею|опаздыва|к скольки|во сколько|вовремя|үлгеру|кешікп|сағат неше'),
 who:R('кто ты|как тебя зовут|ты кто|сен кімсің|атың кім'),
 city:R('какой город|в каком городе|мой город|қай қала'),
 notify:R('уведоми|оповест|напомни|предупред|сообщи когда|сообщи мне когда|сообщи как только|дай знать|подъезжа|приближа|подъедет|хабарла|ескерт|жақындағанда'),
 myAlerts:R('мои уведомл|мои оповещ|мои напомин|список уведомл|какие уведомл|мои сигнал|отмени уведомл|удали уведомл|выключи уведомл|менің хабарлама|хабарламаларым')
};
const ALIAS=[
 {u:R('площад|(?:^|\\s)центр(?!альн)|орталық'),i:[0]},
 {u:R('(?:^|\\s)парк'),i:[1]},
 {u:R('универ|вуз|институт|колледж|студен'),i:[2]},
 {u:R('вокзал|ж\\/?д|станци|поезд|электричк|темір жол'),i:[4]},
 {u:R('больниц|поликлин|клиник|госпитал|аурухан'),i:[5]},
 {u:R('микрорайон|мкр|жилгородок|посел|район'),i:[6]},
 {u:R('рынок|рынк|базар'),n:/рынок|базар/},
 {u:R('набереж|мост|стрелк'),n:/набереж|мост|стрелк/}
];
const GENERIC=/^(город[а-я]*|центр[а-я]*|микро[а-я]*|област[а-я]*|парк|площ[а-я]*|имен[а-я]*|им|реки|через|рабоч[а-я]*)$/;
function stopStems(){ // отличительные слова остановок текущего города (встречаются в одном названии)
 const names=CITIES[city].stops.map(norm),df={};
 const toks=names.map(n=>[...new Set(n.split(' ').filter(w=>w.length>=4&&!GENERIC.test(w)).map(w=>w.slice(0,5)))]);
 toks.forEach(a=>a.forEach(t=>df[t]=(df[t]||0)+1));
 return toks.map(a=>a.filter(t=>df[t]===1));
}
function findStops(text){
 const stems=stopStems(),names=CITIES[city].stops.map(norm),hit=new Map();
 const put=(i,pos)=>{if(pos>=0&&(!hit.has(i)||hit.get(i)>pos))hit.set(i,pos)};
 stems.forEach((a,i)=>a.forEach(s=>put(i,text.indexOf(s))));
 ALIAS.forEach(al=>{const m=text.match(al.u);if(!m)return;const pos=m.index;
  if(al.i)al.i.forEach(i=>put(i,pos));else names.forEach((n,i)=>{if(al.n.test(n))put(i,pos)})});
 return [...hit].map(([i,pos])=>{
  const before=text.slice(0,pos).trim().split(' ').pop()||'';
  const word=(text.slice(pos).split(' ')[0]||''),next=(text.slice(pos).split(' ')[1]||'');
  let role=null;
  if(/^(от|из|с|со)$/.test(before)||/(ден|тен|нан|дан|тан)$/.test(word))role='from';
  if(/^(до|в|во|на|к|ко)$/.test(before)||/(ге|ке|га|ка)$/.test(word)||next==='дейин')role=role||'to';
  return {i,pos,role};
 }).sort((a,b)=>a.pos-b.pos);
}
function findBusNo(text){
 const m=text.match(/(?:автобус[а-я]*|маршрут[а-я]*|№|номер)\s*(\d{1,3})\b/)||text.match(/^(\d{1,3})$/)||text.match(/\b(\d{1,3})\s*(?:автобус|маршрут)/);
 return m?m[1]:null;
}
function parseTime(text){ // минуты до нужного времени
 let m=text.match(/(?:через|за|спустя)\s*(\d{1,3})\s*(мин[а-я]*|ч[а-я]*)/);
 if(m)return /^ч/.test(m[2])?+m[1]*60:+m[1];
 if(/через час(?![а-я])|через 1 час/.test(text))return 60;
 if(/полчаса|пол часа/.test(text))return 30;
 m=text.match(/(\d{1,3})\s*мин[а-я]*\s*(?:кейин|ишинде|спустя)/)||text.match(/(?:^|\s)через\s*(\d{1,3})/);
 if(m)return +m[1];
 m=text.match(/(?:^|\s)(?:к|до|в|на|сагат|сагат)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(утра|вечера|дня|ночи|час[а-я]*|ч(?![а-я])|кеш[а-я]*|тус[а-я]*)?/)||text.match(/(\d{1,2}):(\d{2})()/);
 if(!m)return null;
 const busWord=/автобус|маршрут|№/.test(text);
 const hasMin=!!m[2],suffix=m[3];
 const prep=text.slice(m.index).trim().split(' ')[0];
 if(!hasMin&&!suffix&&(busWord||!/^(к|до|сагат)$/.test(prep)))return null;
 let h=+m[1];if(h>24)return null;
 if(/вечера|дня|кеш|тус/.test(suffix||'')&&h<12)h+=12;
 const now=new Date(),t=new Date(now);t.setHours(h%24,m[2]?+m[2]:0,0,0);
 if(t<=now)t.setDate(t.getDate()+1);
 return Math.round((t-now)/60000);
}
function findCity(text){
 return Object.keys(CITIES).find(id=>id!==city&&text.includes(norm(CITIES[id].name).slice(0,5)));
}

/* ---------- Оформление ответа ---------- */
const $=s=>document.querySelector(s);
const sec=document.createElement('section');sec.className='card aqa';
const title=()=>T('Помощник Aqyl','Aqyl көмекшісі');
sec.innerHTML=`<div class="chatintro"><span class="botavatar">${icon('spark')}</span><div><h2 style="margin:0" id="aqa-title"></h2><span class="muted" id="aqa-sub"></span></div></div>
<div class="filters aqa-top"><button class="chip" data-l="ru">Русский</button><button class="chip" data-l="kz">Қазақша</button><button class="chip aqa-reset" id="aqa-reset"></button></div>
<div id="messages" class="messages" role="log" aria-live="polite"></div>
<div class="aqa-chips" id="aqa-chips" aria-label="Варианты ответа"></div>
<form id="chat-form" class="chat-form"><input class="search" id="question" maxlength="300" required autocomplete="off"><button class="primary" aria-label="Отправить">${icon('arrow')}</button></form>`;
old.replaceWith(sec);
const foot=document.querySelector('.assistantpage .footnote');

function paintStatic(){
 $('#aqa-title').textContent=title();
 $('#aqa-sub').textContent=T(`${CITIES[city].name} · сравнение автобусов, поездки, время`,`${CITIES[city].name} · автобустарды салыстыру, сапар, уақыт`);
 $('#question').placeholder=T('Напр.: «от парка до вокзала»','Мыс.: «парктен вокзалға»');
 $('#aqa-reset').textContent=T('Начать заново','Қайта бастау');
 sec.querySelectorAll('[data-l]').forEach(b=>{const on=b.dataset.l===lang;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on)});
 if(foot)foot.textContent=T('Демо: помощник работает на условных данных (время, места, остановки) и не использует внешний ИИ. Он понимает названия остановок, номера автобусов, время и вопросы про места, скорость и комфорт.','Демо: көмекші шартты деректермен жұмыс істейді және сыртқы ЖИ қолданбайды. Ол аялдама атауларын, автобус нөмірлерін, уақытты және бос орын, жылдамдық, ыңғайлылық туралы сұрақтарды түсінеді.');
}
const box=()=>$('#messages');
function scroll(){box().scrollTop=box().scrollHeight}
function addUser(text){const el=document.createElement('div');el.className='bubble user';el.textContent=text;box().append(el);scroll()}
const fmtMin=m=>m>=60?`${Math.floor(m/60)} ч ${m%60?String(m%60)+' мин':''}`.trim():`${m} мин`;
const clock=min=>new Date(Date.now()+min*60000).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
function busCard(b,note){
 const sc=comfortScore(b),el=document.createElement('div');el.className='aqa-bus';el.style.setProperty('--bus',b.color);
 const free=b.seats/b.capacity,tone=free<=.2?'low':free<=.45?'mid':'ok';
 el.innerHTML=`<div class="aqa-bus-h"><span class="aqa-num">${esc(b.id)}</span><div><strong>${esc(b.name)}</strong><small>${T('индекс комфорта','ыңғайлылық индексі')} ${sc.toFixed(1)} · ${cLabel(sc)}</small></div></div>
 <div class="aqa-facts"><span>${T('приедет','келеді')} <b>${b.eta} ${T('мин','мин')}</b></span><span>${T('пешком','жаяу')} <b>${b.walk} ${T('мин','мин')}</b></span><span class="aqa-seat ${tone}">${T('мест','орын')} <b>${b.seats}/${b.capacity}</b></span><span>${b.transfers?T('пересадок','ауысу')+' <b>'+b.transfers+'</b>':T('без пересадок','ауыссыз')}</span></div>
 ${note?`<p class="aqa-note">${esc(note)}</p>`:''}
 <a class="linkbutton" href="${url('map.html',{bus:b.id})}">${T('На карте','Картада')} →</a>`;
 return el;
}
function bot(parts,chips){
 const el=document.createElement('div');el.className='bubble aqa-bot';
 parts.forEach(p=>{
  if(typeof p==='string'){const n=document.createElement('p');n.textContent=p;el.append(n)}
  else if(p.cards){const w=document.createElement('div');w.className='aqa-cards';p.cards.forEach(c=>w.append(busCard(c.bus,c.note)));el.append(w)}
  else if(p.list){const o=document.createElement('ol');o.className='aqa-list';p.list.forEach(x=>{const li=document.createElement('li');li.textContent=x;o.append(li)});el.append(o)}
  else if(p.html){const d=document.createElement('div');d.innerHTML=p.html;el.append(d)}
 });
 return el;
}
function say(parts,chips,instant){
 const chipBox=$('#aqa-chips');chipBox.innerHTML='';
 const show=()=>{
  if(typing)typing.remove();
  box().append(bot(parts));scroll();setChips(chips);
 };
 let typing=null;
 if(instant||calm){show();return}
 typing=document.createElement('div');typing.className='bubble aqa-typing';typing.innerHTML='<i></i><i></i><i></i>';typing.setAttribute('aria-label',T('Печатает…','Жазып жатыр…'));
 box().append(typing);scroll();setTimeout(show,380);
}
function setChips(list){
 const chipBox=$('#aqa-chips');chipBox.innerHTML='';
 (list||[]).forEach(c=>{
  const b=document.createElement('button');b.type='button';b.className='chip';b.textContent=c.label;
  b.addEventListener('click',()=>{if(!c.silent)addUser(c.label);c.run()});
  chipBox.append(b);
 });
}

/* ---------- Сценарии и ответы ---------- */
const stopName=i=>CITIES[city].stops[i];
const topic=()=>{ctx.from=ctx.to=ctx.deadline=null;ctx.pending=null};
const LBL={'Отлично':'Өте жақсы','Хорошо':'Жақсы','Средне':'Орташа','Напряжённо':'Қиын'};
const cLabel=sc=>{const l=comfortLabel(sc);return lang==='kz'?LBL[l]||l:l};
const byComfort=(a,b)=>comfortScore(b)-comfortScore(a);
function menuChips(extra){
 const base=[
  {label:T('Построить поездку','Сапар құру'),run:()=>flowTripFrom()},
  {label:T('Успеть ко времени','Уақытқа үлгеру'),run:()=>flowTime()},
  {label:T('Где свободнее','Қайда бос'),run:()=>answerSeats()},
  {label:T('Что приедет раньше','Қайсысы ертерек'),run:()=>answerFast()},
  {label:T('Лучший по комфорту','Ең ыңғайлысы'),run:()=>answerBest()},
  {label:T('Без пересадок','Ауыссыз'),run:()=>answerDirect()},
  {label:T('Рядом со мной','Маған жақын'),run:()=>answerGeo()},
  {label:T('Кошелёк и оплата','Әмиян және төлем'),run:()=>answerWallet()}
 ];
 if(AA){base.splice(2,0,{label:T('Уведомить о автобусе','Автобус туралы хабарлау'),run:()=>notifyBus()});if(AA.count())base.splice(3,0,{label:T(`Мои уведомления (${AA.count()})`,`Хабарламаларым (${AA.count()})`),run:()=>showAlerts()})}
 return (extra||[]).concat(base);
}
function busChips(b){
 const list=[
  {label:T(`Остановки №${b.id}`,`№${b.id} аялдамалары`),run:()=>answerStops(b)},
  {label:T('Что ещё свободнее?','Тағы қайсысы бос?'),run:()=>answerSeats(b)}
 ];
 if(AA)list.push({label:T(`Уведомить о №${b.id}`,`№${b.id} туралы хабарлау`),run:()=>notifyStop(b)});
 list.push({label:T('Построить поездку','Сапар құру'),run:()=>flowTripFrom()},{label:T('Меню','Мәзір'),run:()=>showMenu()});
 return list;
}
function showMenu(first){
 say([first?T(`Привет! Я Aqyl. Мы в городе ${CITIES[city].name}. Выбери, с чего начнём, или просто напиши вопрос.`,`Сәлем! Мен Aqylмын. Біз ${CITIES[city].name} қаласындамыз. Не істейтінімізді таңда немесе сұрағыңды жаз.`):T('Что сделаем дальше? Выбери вариант или напиши своими словами.','Әрі қарай не істейміз? Нұсқаны таңда немесе өз сөзіңмен жаз.')],menuChips(),true);
}
function stopChips(exclude,pick){
 return CITIES[city].stops.map((n,i)=>({i,n})).filter(x=>x.i!==exclude).map(x=>({label:x.n,run:()=>pick(x.i)}));
}
function flowTripFrom(){
 ctx.pending='from';ctx.from=null;ctx.to=null;
 say([T('Откуда поедем? Выбери остановку или напиши её название.','Қайдан шығамыз? Аялдаманы таңда немесе атын жаз.')],stopChips(-1,i=>{ctx.from=i;flowTripTo()}).concat([{label:T('Определить, где я','Қайдамын'),run:()=>answerGeo()}]));
}
function flowTripTo(){
 ctx.pending='to';
 say([T(`Отправление: ${stopName(ctx.from)}. Куда едем?`,`Шығу: ${stopName(ctx.from)}. Қайда барамыз?`)],stopChips(ctx.from,i=>{ctx.to=i;showTrip()}));
}
function showTrip(){
 const {from,to}=ctx;ctx.pending=null;
 if(from===to){say([T('Это одна и та же остановка — выбери другую точку.','Бұл бір аялдама — басқа нүктені таңда.')],[{label:T('Выбрать заново','Қайта таңдау'),run:()=>flowTripFrom()}]);return}
 const opts=journeyOptions(from,to);
 const head=T(`${stopName(from)} → ${stopName(to)}`,`${stopName(from)} → ${stopName(to)}`);
 const back=[{label:T('Обратный путь','Кері бағыт'),run:()=>{ctx.from=to;ctx.to=from;showTrip()}},{label:T('Успеть ко времени','Уақытқа үлгеру'),run:()=>flowTime()},{label:T('Другая поездка','Басқа сапар'),run:()=>flowTripFrom()},{label:T('Меню','Мәзір'),run:()=>showMenu()}];
 if(!opts.length){say([head,T('В демо-расписании нет подходящего варианта даже с пересадкой. Попробуй другие остановки.','Демо-кестеде ауысумен де лайық нұсқа жоқ. Басқа аялдамаларды көр.')],back);return}
 if(AA)back.unshift({label:T(`Уведомить о №${opts[0].buses[0].id}`,`№${opts[0].buses[0].id} туралы хабарлау`),run:()=>notifyLead(opts[0].buses[0],from)});
 const cards=opts.map(o=>{
  const total=o.minutes+o.buses[0].walk,slack=ctx.deadline!=null?ctx.deadline-total:null;
  const via=o.buses.length>1?T(` Пересадка: ${stopName(o.via)}, автобус №${o.buses[1].id}.`,` Ауысу: ${stopName(o.via)}, №${o.buses[1].id} автобусы.`):'';
  const fit=slack==null?'':slack>=0?T(` Успеваешь с запасом ${slack} мин.`,` ${slack} мин қорымен үлгересің.`):T(` Не успеваешь: не хватает ${-slack} мин.`,` Үлгермейсің: ${-slack} мин жетпейді.`);
  return {bus:o.buses[0],note:T(`≈ ${fmtMin(total)} всего: пешком ${o.buses[0].walk} + ожидание ${o.buses[0].eta} + в пути ${o.count*3}.`,`Барлығы ≈ ${fmtMin(total)}: жаяу ${o.buses[0].walk} + күту ${o.buses[0].eta} + жолда ${o.count*3}.`)+via+fit};
 });
 ctx.bus=opts[0].buses[0];
 say([head,T(`Нашёл ${opts.length} ${opts.length===1?'вариант':'варианта'}, самый быстрый — первый:`,`${opts.length} нұсқа таптым, ең жылдамы — біріншісі:`),{cards}],back);
}
function flowTime(){
 ctx.pending='time';
 const pick=m=>()=>{ctx.deadline=m;answerDeadline(m)};
 const at=h=>{const n=new Date(),t=new Date(n);t.setHours(h,0,0,0);if(t<=n)t.setDate(t.getDate()+1);return Math.round((t-n)/60000)};
 say([T('Сколько у тебя времени? Выбери вариант или напиши, например: «к 8:30» или «через 25 минут».','Қанша уақытың бар? Нұсқаны таңда немесе жаз: «8:30-ға» не «25 минуттан кейін».')],[
  {label:T('Через 15 минут','15 минуттан кейін'),run:pick(15)},{label:T('Через 30 минут','30 минуттан кейін'),run:pick(30)},{label:T('Через час','1 сағаттан кейін'),run:pick(60)},
  {label:T('К 8:00','8:00-ге'),run:pick(at(8))},{label:T('К 9:00','9:00-ге'),run:pick(at(9))},{label:T('К 18:00','18:00-ге'),run:pick(at(18))},
  {label:T('Меню','Мәзір'),run:()=>showMenu()}]);
}
function answerDeadline(mins){
 ctx.deadline=mins;ctx.pending=null;
 if(ctx.from!=null&&ctx.to!=null&&ctx.from!==ctx.to){showTrip();return}
 const fits=BUSES.filter(x=>x.walk+x.eta<=mins).sort(byComfort);
 const when=T(`через ${fmtMin(mins)} (около ${clock(mins)})`,`${fmtMin(mins)} кейін (шамамен ${clock(mins)})`);
 const next=[{label:T('Указать, куда ехать','Қайда баратынымды көрсету'),run:()=>{ctx.pending=null;flowTripFrom()}},{label:T('Другое время','Басқа уақыт'),run:()=>flowTime()},{label:T('Меню','Мәзір'),run:()=>showMenu()}];
 if(fits.length){
  ctx.bus=fits[0];
  say([T(`Время: ${when}. К остановке успевают ${fits.length} из ${BUSES.length}. Лучшие по комфорту:`,`Уақыт: ${when}. Аялдамаға ${BUSES.length} автобустың ${fits.length}-і үлгереді. Ең ыңғайлылары:`),{cards:fits.slice(0,3).map(b=>({bus:b,note:T(`Запас до посадки: ${mins-b.walk-b.eta} мин.`,`Отырғанға дейін қор: ${mins-b.walk-b.eta} мин.`)}))},T('Это время до посадки. Чтобы учесть дорогу, скажи, куда едем.','Бұл — отырғанға дейінгі уақыт. Жолды ескеру үшін қайда баратыныңды айт.')],next);
 }else{
  const f=BUSES.reduce((a,c)=>a.walk+a.eta<c.walk+c.eta?a:c);ctx.bus=f;
  say([T(`Время: ${when}. Впритык ни один автобус не успевает. Самый быстрый вариант — через ${f.walk+f.eta} мин. Лучше выйти пораньше:`,`Уақыт: ${when}. Ешбір автобус үлгермейді. Ең жылдамы — ${f.walk+f.eta} мин. Ертерек шыққан жөн:`),{cards:[{bus:f}]}],next);
 }
}
function answerSeats(except){
 topic();
 const list=BUSES.filter(b=>!except||b.id!==except.id).sort((a,b)=>b.seats/b.capacity-a.seats/a.capacity).slice(0,3);ctx.bus=list[0];
 say([T('Больше всего свободных мест в этих автобусах:','Бос орын ең көп автобустар:'),{cards:list.map(b=>({bus:b}))}],busChips(list[0]));
}
function answerFast(){
 topic();
 const list=BUSES.slice().sort((a,b)=>a.eta-b.eta).slice(0,3);ctx.bus=list[0];
 say([T('Раньше всех приедут:','Ең алдымен келетіндер:'),{cards:list.map(b=>({bus:b}))}],busChips(list[0]));
}
function answerBest(){
 topic();
 const list=BUSES.slice().sort(byComfort).slice(0,3);ctx.bus=list[0];
 say([T('Индекс комфорта учитывает ожидание, свободные места, пересадки и путь пешком. Лучшие сейчас:','Ыңғайлылық индексі күтуді, бос орынды, ауысуды және жаяу жолды ескереді. Қазір ең жақсылары:'),{cards:list.map(b=>({bus:b}))}],busChips(list[0]));
}
function answerDirect(){
 topic();
 const list=BUSES.filter(b=>!b.transfers).sort(byComfort).slice(0,3);ctx.bus=list[0];
 say([T('Без пересадок, лучшие по комфорту:','Ауыссыз, ең ыңғайлылары:'),{cards:list.map(b=>({bus:b}))}],busChips(list[0]));
}
function answerWalk(){
 topic();
 const list=BUSES.slice().sort((a,b)=>a.walk-b.walk).slice(0,3);ctx.bus=list[0];
 say([T('Ближе всего идти пешком до посадки:','Отырғанға дейін жаяу ең жақыны:'),{cards:list.map(b=>({bus:b}))}],busChips(list[0]));
}
function answerAll(){
 topic();
 say([T(`Автобусы в городе ${CITIES[city].name}:`,`${CITIES[city].name} қаласындағы автобустар:`),{cards:BUSES.slice().sort(byComfort).map(b=>({bus:b}))}],menuChips());
}
function answerBus(b){
 topic();
 ctx.bus=b;
 say([T(`Автобус №${b.id} «${b.name}»:`,`№${b.id} «${b.name}» автобусы:`),{cards:[{bus:b,note:crowdForecast(b).soon?T('Скоро может заполниться — подумай о другом варианте.','Жақында толып қалуы мүмкін — басқа нұсқаны ойлан.'):''}]}],busChips(b));
}
function answerStops(b){
 b=b||ctx.bus;
 if(!b){say([T('Скажи номер автобуса, и я покажу его остановки.','Автобус нөмірін айтсаң, аялдамаларын көрсетемін.')],menuChips());return}
 ctx.bus=b;
 const order=fleetMotion.itinerary(b),seen=[];order.forEach(i=>{if(!seen.includes(i))seen.push(i)});
 say([T(`Автобус №${b.id} «${b.name}» ходит по остановкам:`,`№${b.id} «${b.name}» мына аялдамалармен жүреді:`),{list:seen.map(stopName)},{html:`<a class="linkbutton" href="${url('map.html',{bus:b.id})}">${T('На карте','Картада')} →</a>`}],busChips(b));
}
function answerCompare(a,b){
 say([T('Сравнение:','Салыстыру:'),{cards:[{bus:a},{bus:b}]},T(comfortScore(a)>=comfortScore(b)?`По индексу комфорта выигрывает №${a.id}.`:`По индексу комфорта выигрывает №${b.id}.`,comfortScore(a)>=comfortScore(b)?`Ыңғайлылық бойынша №${a.id} жеңеді.`:`Ыңғайлылық бойынша №${b.id} жеңеді.`)],busChips(comfortScore(a)>=comfortScore(b)?a:b));
}
function answerGeo(){
 const btn=document.querySelector('.aqw-geo');
 if(btn){say([T('Открываю определение местоположения — разреши доступ в браузере. Покажу, где ты и какая остановка ближайшая.','Орналасқан жерді анықтауды ашамын — браузерде рұқсат бер. Қайда екеніңді және ең жақын аялдаманы көрсетемін.')],menuChips(),true);setTimeout(()=>btn.click(),250)}
 else say([T('Кнопка геолокации недоступна на этой странице.','Бұл бетте геолокация батырмасы жоқ.')],menuChips());
}
function answerWallet(){
 const chip=document.querySelector('.aqw-chip');
 if(chip){say([T('Открываю кошелёк: там баланс, пополнение и сканер QR для оплаты проезда. Нужно войти в аккаунт.','Әмиянды ашамын: онда баланс, толықтыру және жол ақысын төлеуге QR сканері бар. Аккаунтқа кіру керек.')],menuChips(),true);setTimeout(()=>chip.click(),250)}
 else say([T('Кошелёк недоступен на этой странице.','Әмиян бұл бетте қолжетімсіз.')],menuChips());
}
function fallback(){
 say([T('Не уверен, что понял. Вот что я умею: подобрать поездку между остановками, учесть время, найти свободный или самый быстрый автобус, показать остановки и ближайшую остановку рядом с тобой, а ещё предупредить, когда нужный автобус подъезжает.','Түсінбей қалдым. Мен мынаны істей аламын: аялдамалар арасындағы сапарды таңдау, уақытты ескеру, бос не ең жылдам автобусты табу, аялдамаларды және жақын аялдаманы көрсету, сондай-ақ керек автобус жақындағанда хабарлау.'),T('Выбери вариант ниже или напиши, например: «от парка до вокзала».','Төменнен нұсқаны таңда немесе жаз, мысалы: «парктен вокзалға».')],menuChips());
}

/* ---------- Уведомления о приближении автобуса ---------- */
const etaText=e=>e<20?T('уже стоит на остановке','аялдамада тұр'):T(`будет там примерно через ${Math.max(1,Math.round(e/60))} мин`,`онда шамамен ${Math.max(1,Math.round(e/60))} мин ішінде болады`);
const etaShort=e=>e<20?T('на остановке','аялдамада'):`≈ ${Math.max(1,Math.round(e/60))} ${T('мин','мин')}`;
function numberBus(t){
 const t2=t.replace(/(?:за\s*)?\d{1,2}\s*мин[а-я]*/g,' ');
 const no=findBusNo(t2);if(no&&route(no))return route(no);
 return [...t2.matchAll(/(?:^|\D)(\d{1,3})(?!\d)/g)].map(m=>route(m[1])).filter(Boolean)[0]||null;
}
function stopChoiceChips(b){return AA.served(b).map(i=>({label:stopName(i),run:()=>notifyLead(b,i)}))}
function notifyBus(){
 ctx.pending='nbus';ctx.nbus=null;ctx.nstop=null;
 say([T('Какой автобус ты ждёшь? Выбери или напиши номер.','Қай автобусты күтіп тұрсың? Таңда немесе нөмірін жаз.')],BUSES.map(b=>({label:`№${b.id} ${b.name}`,run:()=>notifyStop(b)})));
}
function notifyStop(b){
 ctx.pending='nstop';ctx.nbus=b;ctx.bus=b;ctx.nstop=null;
 say([T(`Автобус №${b.id} «${b.name}». К какой остановке он должен подъехать? Выбери или напиши название.`,`№${b.id} «${b.name}» автобусы. Қай аялдамаға келгенде хабарлайын? Таңда немесе атын жаз.`)],stopChoiceChips(b).concat([{label:T('Другой автобус','Басқа автобус'),run:()=>notifyBus()}]));
}
function notifyLead(b,stop){
 ctx.nbus=b;ctx.nstop=stop;ctx.bus=b;
 if(ctx.nlead){notifyCreate(b,stop,ctx.nlead);return}
 ctx.pending='nlead';
 say([T(`Остановка «${stopName(stop)}»: автобус №${b.id} ${etaText(AA.etaSec(b,stop))}. За сколько минут до приезда предупредить?`,`«${stopName(stop)}» аялдамасы: №${b.id} автобусы ${etaText(AA.etaSec(b,stop))}. Келуіне неше минут қалғанда хабарлайын?`)],
  [1,3,5,10].map(n=>({label:T(`За ${n} мин`,`${n} мин бұрын`),run:()=>notifyCreate(b,stop,n)})).concat([{label:T('Назад','Артқа'),run:()=>notifyStop(b)}]));
}
function alertChips(a,b){
 const k=AqylSim.speed(),chips=[];
 chips.push({label:T('Проверить уведомление','Хабарламаны тексеру'),run:()=>{AA.test();say([T('Так оно выглядит. Звук и вибрация зависят от устройства.','Ол осылай көрінеді. Дыбыс пен діріл құрылғыға байланысты.')],alertChips(a,b),true)}});
 if(k<10)chips.push({label:T('Ускорить демо ×10','Демоны жылдамдату ×10'),run:()=>{AqylSim.setSpeed(10);say([T('Время демо идёт в 10 раз быстрее. Открой карту — автобусы поедут быстрее, а уведомление придёт скорее.','Демо уақыты 10 есе жылдам. Картаны аш — автобустар жылдам жүреді, хабарлама ертерек келеді.')],alertChips(a,b),true)}});
 if(k<30)chips.push({label:T('Ускорить демо ×30','Демоны жылдамдату ×30'),run:()=>{AqylSim.setSpeed(30);say([T('Время демо идёт в 30 раз быстрее.','Демо уақыты 30 есе жылдам.')],alertChips(a,b),true)}});
 if(k>1)chips.push({label:T('Обычное время','Қалыпты уақыт'),run:()=>{AqylSim.setSpeed(1);say([T('Время демо снова идёт как в жизни.','Демо уақыты қайтадан шынайы жүріп жатыр.')],alertChips(a,b),true)}});
 if(AA.permission()==='default')chips.push({label:T('Разрешить системные уведомления','Жүйелік хабарламаларға рұқсат'),run:()=>{AA.requestPermission().then(r=>say([r==='granted'?T('Готово: когда вкладка свёрнута, уведомление придёт от браузера.','Дайын: қойынды жиналғанда хабарлама браузерден келеді.'):T('Браузер не разрешил системные уведомления — буду показывать сообщение на странице.','Браузер жүйелік хабарламаға рұқсат бермеді — хабарлама бетте көрсетіледі.')],alertChips(a,b),true))}});
 if(!a.repeat)chips.push({label:T('Повторять каждый рейс','Әр рейсте қайталау'),run:()=>{AA.update(a.id,{repeat:true});a.repeat=true;say([T('Буду предупреждать каждый раз, когда автобус подъезжает.','Автобус жақындаған сайын хабарлаймын.')],alertChips(a,b),true)}});
 chips.push({label:T('Открыть карту','Картаны ашу'),silent:true,run:()=>{location.href=url('map.html',{bus:b.id})}});
 chips.push({label:T('Мои уведомления','Хабарламаларым'),run:()=>showAlerts()},{label:T('Меню','Мәзір'),run:()=>showMenu()});
 return chips;
}
function notifyCreate(b,stop,lead){
 ctx.pending=null;ctx.nlead=null;
 const a=AA.add({bus:b,stop,lead});
 if(!a){say([T('Этот автобус не ходит к выбранной остановке.','Бұл автобус таңдалған аялдамаға жүрмейді.')],stopChoiceChips(b));return}
 const e=AA.etaSec(b,stop),k=AqylSim.speed();
 const parts=[T(`Готово! Предупрежу, когда автобус №${b.id} будет в ${a.lead} мин от остановки «${stopName(stop)}».`,`Дайын! №${b.id} автобусы «${stopName(stop)}» аялдамасына ${a.lead} мин қалғанда хабарлаймын.`),
  e<=a.lead*60?T('Он уже подъезжает — уведомление придёт на следующем рейсе.','Ол қазір жақындап қалды — хабарлама келесі рейсте келеді.'):T(`Сейчас до остановки ${etaShort(e)} по расписанию демо.`,`Қазір аялдамаға дейін демо кестесі бойынша ${etaShort(e)}.`),
  T('Уведомление придёт на любой странице, пока сайт открыт в браузере.','Сайт браузерде ашық тұрғанда хабарлама кез келген бетте келеді.')];
 if(k>1)parts.push(T(`Время демо идёт в ${k} раз быстрее.`,`Демо уақыты ${k} есе жылдам.`));
 say(parts,alertChips(a,b));
}
function notifyFromText(t){
 const lead=(t.match(/(\d{1,2})\s*мин/)||[])[1];ctx.nlead=lead?Math.max(1,Math.min(15,+lead)):null;
 const stops=findStops(t).map(s=>s.i),bus=numberBus(t)||ctx.bus;
 if(bus){
  const st=stops.find(i=>AA.served(bus).includes(i));
  if(st!=null){notifyLead(bus,st);return}
  if(stops.length){say([T(`Автобус №${bus.id} туда не ходит. Выбери одну из его остановок:`,`№${bus.id} автобусы онда жүрмейді. Оның аялдамаларының бірін таңда:`)],stopChoiceChips(bus));return}
  notifyStop(bus);return;
 }
 if(stops.length){
  const st=stops[0],list=BUSES.filter(b=>AA.served(b).includes(st));
  say([T(`К остановке «${stopName(st)}» ходят автобусы: ${list.map(b=>'№'+b.id).join(', ')}. О каком предупредить?`,`«${stopName(st)}» аялдамасына мына автобустар жүреді: ${list.map(b=>'№'+b.id).join(', ')}. Қайсысы туралы хабарлайын?`)],list.map(b=>({label:`№${b.id} ${b.name}`,run:()=>notifyLead(b,st)})));
  return;
 }
 notifyBus();
}
function showAlerts(){
 const all=AA.list().filter(a=>a.city===city);
 if(!all.length){say([T('Активных уведомлений нет. Настроим?','Белсенді хабарлама жоқ. Баптаймыз ба?')],[{label:T('Настроить уведомление','Хабарлама баптау'),run:()=>notifyBus()},{label:T('Меню','Мәзір'),run:()=>showMenu()}]);return}
 const lines=all.map(a=>{const e=AA.etaSec(route(a.bus),a.stop);return `№${a.bus} · ${stopName(a.stop)} · ${T('за','')} ${a.lead} ${T('мин','мин')}${a.repeat?' · '+T('каждый рейс','әр рейс'):''} · ${T('сейчас','қазір')} ${etaShort(e)}`});
 const chips=all.slice(0,4).map(a=>({label:T(`Отменить №${a.bus} · ${stopName(a.stop)}`,`№${a.bus} · ${stopName(a.stop)} өшіру`),run:()=>{AA.remove(a.id);showAlerts()}}));
 if(all.length>1)chips.push({label:T('Отменить все','Барлығын өшіру'),run:()=>{AA.clear();showAlerts()}});
 chips.push({label:T('Новое уведомление','Жаңа хабарлама'),run:()=>notifyBus()},{label:T('Проверить уведомление','Хабарламаны тексеру'),run:()=>{AA.test();showAlerts()}},
  {label:AA.soundOn()?T('Выключить звук','Дыбысты өшіру'):T('Включить звук','Дыбысты қосу'),run:()=>{AA.setSound(!AA.soundOn());showAlerts()}},{label:T('Меню','Мәзір'),run:()=>showMenu()});
 say([T('Активные уведомления:','Белсенді хабарламалар:'),{list:lines}],chips);
}

/* ---------- Разбор вопроса ---------- */
function ask(raw){
 const q=raw.trim();if(!q)return;
 addUser(q);$('#question').value='';
 const t=norm(q);
 if(RX.thanks.test(t)){say([T('Пожалуйста! Если нужно ещё что-то подобрать — выбери вариант или напиши.','Оқасы жоқ! Тағы бірдеңе керек болса — нұсқаны таңда немесе жаз.')],menuChips(),true);return}
 if(RX.bye.test(t)&&t.length<25){say([T('Хорошей дороги!','Жол болсын!')],menuChips(),true);return}
 if(RX.who.test(t)){say([T('Я Aqyl — демо-помощник AqylJol. Сравниваю автобусы, подбираю поездки и время. Данные условные, это не реальный транспорт.','Мен Aqylмын — AqylJol демо-көмекшісімін. Автобустарды салыстырамын, сапар мен уақытты таңдаймын. Деректер шартты, нақты көлік емес.')],menuChips());return}
 if(RX.hello.test(t)&&t.split(' ').length<=3){showMenu(true);return}
 if(RX.menu.test(t)&&!findStops(t).length){showMenu();return}
 if(RX.city.test(t)){say([T(`Сейчас выбран город ${CITIES[city].name}. Сменить можно в списке сверху.`,`Қазір ${CITIES[city].name} қаласы таңдалған. Жоғарыдағы тізімнен ауыстыруға болады.`)],menuChips());return}
 const other=findCity(t);
 if(other&&!findStops(t).length){
  say([T(`Это другой город — ${CITIES[other].name}. Переключить?`,`Бұл басқа қала — ${CITIES[other].name}. Ауыстырайын ба?`)],[{label:T(`Переключить на ${CITIES[other].name}`,`${CITIES[other].name} қаласына ауыстыру`),silent:true,run:()=>{const s=document.querySelector('#city');if(s){s.value=other;s.dispatchEvent(new Event('change'))}}},{label:T('Остаться','Қалу'),run:()=>showMenu()}],true);return;
 }
 if(RX.wallet.test(t)){answerWallet();return}
 if(RX.geo.test(t)&&!findStops(t).length){answerGeo();return}
 if(AA){
  if(RX.myAlerts.test(t)){
   if(/отмен|удал|выключ|убер|ошир/.test(t)){const n=AA.count();AA.clear();say([n?T(`Отменил уведомления: ${n}.`,`Хабарламалар өшірілді: ${n}.`):T('Активных уведомлений нет.','Белсенді хабарлама жоқ.')],menuChips())}
   else showAlerts();
   return;
  }
  if(ctx.pending==='nbus'){const b=numberBus(t);if(b){notifyStop(b);return}}
  if(ctx.pending==='nstop'&&ctx.nbus){
   const found=findStops(t).map(s=>s.i),st=found.find(i=>AA.served(ctx.nbus).includes(i));
   if(st!=null){notifyLead(ctx.nbus,st);return}
   if(found.length){say([T(`Автобус №${ctx.nbus.id} туда не ходит. Выбери одну из его остановок:`,`№${ctx.nbus.id} автобусы онда жүрмейді. Оның аялдамаларының бірін таңда:`)],stopChoiceChips(ctx.nbus));return}
   const other=numberBus(t);
   if(other){notifyStop(other);return}
   if(!RX.menu.test(t)&&/[а-я]{4,}/.test(t.replace(/уведоми|напомни|предупред/g,''))&&t.split(' ').length<=3){say([T(`Не нашёл такую остановку у автобуса №${ctx.nbus.id}. Выбери из списка:`,`№${ctx.nbus.id} автобусында мұндай аялдама табылмады. Тізімнен таңда:`)],stopChoiceChips(ctx.nbus));return}
  }
  if(ctx.pending==='nlead'&&ctx.nbus&&ctx.nstop!=null){const m=t.match(/(\d{1,2})/);if(m){notifyCreate(ctx.nbus,ctx.nstop,+m[1]);return}}
  if(RX.notify.test(t)){notifyFromText(t);return}
 }
 // маршрут между остановками
 const stops=findStops(t),mins=parseTime(t);
 if(stops.length){
  if(mins!=null)ctx.deadline=mins;
  let from=null,to=null;
  const f=stops.find(s=>s.role==='from'),d=[...stops].reverse().find(s=>s.role==='to');
  if(stops.length>=2){
   from=(f||stops[0]).i;to=(d&&d.i!==from?d:stops.find(s=>s.i!==from)).i;
   if(!f&&d&&d.i===stops[0].i){to=stops[0].i;from=stops[1].i}
  }else{
   const s=stops[0];
   if(s.role==='from'||(ctx.pending==='from'&&s.role!=='to'))from=s.i;
   else if(s.role==='to'||RX.trip.test(t)||ctx.pending==='to')to=s.i;
   else if(ctx.pending==='from')from=s.i;
   else to=s.i;
  }
  if(stops.length===1&&to!=null&&from==null&&RX.trip.test(t)&&!ctx.pending)ctx.from=null;
  if(from!=null)ctx.from=from;if(to!=null)ctx.to=to;
  if(ctx.from!=null&&ctx.to!=null){showTrip();return}
  if(ctx.from!=null){flowTripTo();return}
  if(ctx.to!=null){
   ctx.pending='from';
   say([T(`Еду на остановку «${stopName(ctx.to)}». Откуда выезжаем?`,`«${stopName(ctx.to)}» аялдамасына барамыз. Қайдан шығамыз?`)],stopChips(ctx.to,i=>{ctx.from=i;showTrip()}).concat([{label:T('Определить, где я','Қайдамын'),run:()=>answerGeo()}]));return;
  }
 }
 if(RX.time.test(t)&&mins==null){flowTime();return}
 if(mins!=null){answerDeadline(mins);return}
 if(RX.trip.test(t)){ctx.pending='from';ctx.from=ctx.to=null;say([T('Не нашёл такую остановку в этом городе. Выбери, откуда поедем:','Бұл қалада мұндай аялдама табылмады. Қайдан шығатынымызды таңда:')],stopChips(-1,i=>{ctx.from=i;flowTripTo()}));return}
 // автобусы
 const nums=[...t.matchAll(/(?:^|\D)(\d{1,3})(?!\d)/g)].map(m=>route(m[1])).filter(Boolean);
 const uniq=[...new Set(nums)];
 if(uniq.length>=2){answerCompare(uniq[0],uniq[1]);return}
 const no=findBusNo(t),bus=(no&&route(no))||(uniq.length===1?uniq[0]:null);
 if(no&&!route(no)){say([T(`Автобуса №${no} в этом городе нет. Есть: ${BUSES.map(b=>b.id).join(', ')}.`,`Бұл қалада №${no} автобус жоқ. Бар: ${BUSES.map(b=>b.id).join(', ')}.`)],BUSES.map(b=>({label:`№${b.id} ${b.name}`,run:()=>answerBus(b)})).slice(0,6).concat([{label:T('Меню','Мәзір'),run:()=>showMenu()}]));return}
 if(RX.stops.test(t)){answerStops(bus||ctx.bus);return}
 if(RX.map.test(t)&&(bus||ctx.bus)&&!RX.seats.test(t)){const b=bus||ctx.bus;say([T(`Вот автобус №${b.id} на карте:`,`№${b.id} автобусы картада:`),{html:`<a class="linkbutton" href="${url('map.html',{bus:b.id})}">${T('Открыть карту','Картаны ашу')} →</a>`}],busChips(b));return}
 if(bus&&!(RX.seats.test(t)||RX.fast.test(t)||RX.best.test(t))){answerBus(bus);return}
 if(RX.direct.test(t)){answerDirect();return}
 if(RX.walk.test(t)){answerWalk();return}
 if(RX.seats.test(t)){answerSeats();return}
 if(RX.fast.test(t)){answerFast();return}
 if(RX.best.test(t)){answerBest();return}
 if(RX.all.test(t)){answerAll();return}
 if(RX.map.test(t)&&ctx.bus){answerBus(ctx.bus);return}
 fallback();
}

/* ---------- Запуск ---------- */
function start(){
 box().innerHTML='';ctx.bus=ctx.from=ctx.to=ctx.deadline=ctx.pending=ctx.nbus=ctx.nstop=ctx.nlead=null;paintStatic();showMenu(true);
}
$('#chat-form').addEventListener('submit',e=>{e.preventDefault();ask($('#question').value)});
$('#aqa-reset').addEventListener('click',start);
sec.querySelectorAll('[data-l]').forEach(b=>b.addEventListener('click',()=>{lang=b.dataset.l;if(typeof save==='function')save('lang',lang);start()}));
start();
})();
