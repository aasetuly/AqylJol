/* AqylJol: уведомления о приближении автобуса (демо). Подключается на всех страницах после script.js.
   Настраиваются в помощнике; срабатывают на любой странице, пока сайт открыт в браузере.
   Время берётся из общих часов симуляции AqylSim (enhanced.js) — те же, что двигают автобусы на карте. */
(function(){
'use strict';
if(typeof AqylSim==='undefined'||typeof BUSES==='undefined'||typeof fleetMotion==='undefined')return;
const KEY='aq-alerts',SOUND='aq-alert-sound';
let memAlerts=[],memSound=true;

function list(){try{const v=JSON.parse(localStorage.getItem(KEY));return Array.isArray(v)?v:[]}catch{return memAlerts}}
function write(arr){memAlerts=arr;try{localStorage.setItem(KEY,JSON.stringify(arr))}catch{}}
const kz=()=>{try{return JSON.parse(localStorage.getItem('aq-lang'))==='kz'}catch{return false}};
const T=(ru,k)=>kz()?k:ru;
const stopName=(i)=>CITIES[city].stops[i];

/* Секунд до прибытия автобуса на остановку по расписанию симуляции (0 — автобус уже стоит на остановке). */
function etaSec(bus,stopIdx){
 const pl=fleetMotion.plan(bus),order=fleetMotion.itinerary(bus),cyc=pl.cycle;
 const ph=((AqylSim.clock(bus)%cyc)+cyc)%cyc;let best=Infinity;
 pl.segs.forEach((sg,s)=>{
  if(order[s+1]!==stopIdx)return;
  const arrive=sg.start+sg.t,dwell=(pl.segs[s+1]||pl.segs[0]).dwell;
  const since=(((ph-arrive)%cyc)+cyc)%cyc;
  if(since<dwell){best=0;return}
  best=Math.min(best,(((arrive-ph)%cyc)+cyc)%cyc);
 });
 return best;
}
const served=bus=>{const o=fleetMotion.itinerary(bus),seen=[];o.forEach(i=>{if(!seen.includes(i))seen.push(i)});return seen};

function add({bus,stop,lead,repeat}){
 const b=typeof bus==='object'?bus:route(bus);if(!b||!served(b).includes(stop))return null;
 lead=Math.max(1,Math.min(15,Math.round(+lead||3)));
 const all=list().filter(a=>!(a.bus===b.id&&a.stop===stop&&a.city===city)); // одно уведомление на пару «автобус + остановка»
 const e=etaSec(b,stop);
 const a={id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),bus:b.id,stop,lead,repeat:!!repeat,city,armed:e>lead*60,created:Date.now()};
 all.push(a);write(all);return a;
}
function remove(id){write(list().filter(a=>a.id!==id))}
function clear(){write([])}
function update(id,patch){write(list().map(a=>a.id===id?{...a,...patch}:a))}

/* ---------- Звук, баннер, системное уведомление ---------- */
const soundOn=()=>{try{const v=localStorage.getItem(SOUND);return v===null?memSound:v==='1'}catch{return memSound}};
function setSound(on){memSound=!!on;try{localStorage.setItem(SOUND,on?'1':'0')}catch{}}
function beep(){
 if(!soundOn())return;
 try{
  const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;
  const ac=new Ctx(),t0=ac.currentTime;
  [[880,0],[660,.2],[880,.4]].forEach(([f,d])=>{const o=ac.createOscillator(),g=ac.createGain();o.frequency.value=f;o.connect(g);g.connect(ac.destination);
   g.gain.setValueAtTime(.0001,t0+d);g.gain.exponentialRampToValueAtTime(.18,t0+d+.02);g.gain.exponentialRampToValueAtTime(.0001,t0+d+.16);o.start(t0+d);o.stop(t0+d+.18)});
  setTimeout(()=>ac.close&&ac.close(),900);
 }catch{}
}
let stack=null;
function banner(bus,title,body){
 if(!stack){stack=document.createElement('div');stack.className='aqn-stack';stack.setAttribute('aria-live','assertive');document.body.appendChild(stack)}
 const el=document.createElement('div');el.className='aqn';el.setAttribute('role','alert');el.style.setProperty('--bus',bus.color);
 el.innerHTML=`<span class="aqn-num">${esc(bus.id)}</span><div class="aqn-body"><strong>${esc(title)}</strong><p>${esc(body)}</p><div class="aqn-act"><a class="linkbutton" href="${url('map.html',{bus:bus.id})}">${T('На карте','Картада')} →</a><button type="button" class="aqn-x">${T('Закрыть','Жабу')}</button></div></div>`;
 const close=()=>{el.classList.add('out');setTimeout(()=>el.remove(),250)};
 el.querySelector('.aqn-x').addEventListener('click',close);
 stack.prepend(el);setTimeout(close,25000);
 while(stack.children.length>3)stack.lastElementChild.remove();
}
function system(title,body,tag){
 try{if('Notification' in window&&Notification.permission==='granted'&&document.hidden){
  const n=new Notification(title,{body,tag,icon:'aqyljol-icon.svg'});n.onclick=()=>{window.focus();n.close()};
 }}catch{}
}
function message(bus,stopIdx,e){
 const title=T(`Автобус №${bus.id} подъезжает`,`№${bus.id} автобусы жақындап келеді`);
 const body=e<20
  ?T(`«${bus.name}» уже у остановки «${stopName(stopIdx)}». Выходи!`,`«${bus.name}» «${stopName(stopIdx)}» аялдамасында тұр. Шық!`)
  :T(`«${bus.name}» приедет на «${stopName(stopIdx)}» примерно через ${Math.max(1,Math.round(e/60))} мин.`,`«${bus.name}» «${stopName(stopIdx)}» аялдамасына шамамен ${Math.max(1,Math.round(e/60))} мин ішінде келеді.`);
 return {title,body};
}
function notify(bus,stopIdx,e,tag){
 const {title,body}=message(bus,stopIdx,e);
 banner(bus,title,body);system(title,body,tag);beep();
 try{navigator.vibrate&&navigator.vibrate([200,100,200])}catch{}
}
function test(){ // пример уведомления для проверки
 const a=list().find(x=>x.city===city),bus=route(a&&a.bus)||BUSES[0],stop=a?a.stop:served(bus)[0];
 notify(bus,stop,(a?a.lead:3)*60,'aq-test');
}
function permission(){return 'Notification' in window?Notification.permission:'unsupported'}
function requestPermission(){
 if(!('Notification' in window))return Promise.resolve('unsupported');
 try{return Promise.resolve(Notification.requestPermission())}catch{return Promise.resolve(Notification.permission)}
}

/* ---------- Проверка раз в секунду ---------- */
function tick(){
 const all=list();let changed=false;const keep=[];
 all.forEach(a=>{
  const bus=route(a.bus);
  if(a.city!==city||!bus){keep.push(a);return} // уведомления другого города ждут своего города
  const e=etaSec(bus,a.stop),lead=a.lead*60;
  if(!isFinite(e)){keep.push(a);return}
  if(!a.armed){ if(e>lead+20){a.armed=true;changed=true} keep.push(a);return }
  if(e<=lead){
   a.armed=false;changed=true;
   let fresh=true;const lk='aq-fire-'+a.id;
   try{const t=+localStorage.getItem(lk)||0;if(Date.now()-t<15000)fresh=false;else localStorage.setItem(lk,String(Date.now()))}catch{}
   if(fresh)notify(bus,a.stop,e,'aq-'+a.id);
   if(a.repeat)keep.push(a);
  }else keep.push(a);
 });
 if(changed)write(keep);
}
setInterval(tick,1000);

window.AqylAlerts={list,add,remove,clear,update,etaSec,served,soundOn,setSound,test,permission,requestPermission,count:()=>list().filter(a=>a.city===city).length};
})();
