/* Additive AqylJol experience. All transport positions and journey times are demo data. */
'use strict';
const fleetMotion = {
 cruise: 8.3, accel: 0.9, decel: 1.1, plans: new Map(), // м/с (≈30 км/ч), м/с² — городской автобус
 roads: new Map(),    // "город:автобус" -> [участок, ...] в прямом порядке остановок
 snapped: new Map(),  // "город:остановка" -> [lat,lng] — точка остановки, притянутая к дороге
 itinerary(bus) {
  const forward=bus.order.slice();
  return forward[0]===forward.at(-1) ? forward : forward.concat(forward.slice(1,-1).reverse(),forward[0]);
 },
 stopPoint(i) { return this.snapped.get(city+':'+i)||CITIES[city].points[i]; },
 makeLeg(pts) {
  const cum=[0];
  for(let i=1;i<pts.length;i++){
   const k=Math.cos(pts[i][0]*Math.PI/180)||1;
   cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],(pts[i][1]-pts[i-1][1])*k));
  }
  return {pts,cum,len:cum[cum.length-1]};
 },
 setRoad(cityId,bus,data) {
  const legs=data.legs.map((pts,k)=>{
   const a=data.snapped[k],b=data.snapped[k+1];
   const line=pts.length>=2?pts.slice():[a,b];
   line[0]=a;line[line.length-1]=b; // автобус всегда стоит ровно на остановке
   return this.makeLeg(line);
  });
  this.roads.set(cityId+':'+bus.id,legs);
  bus.order.forEach((stop,k)=>this.snapped.set(cityId+':'+stop,data.snapped[k]));
 },
 // Какой участок дороги и в какую сторону соответствует сегменту рейса
 legFor(bus,segment) {
  const legs=this.roads.get(city+':'+bus.id);
  if(!legs)return null;
  const n=bus.order.length, loop=bus.order[0]===bus.order.at(-1);
  if(loop||segment<n-1)return legs[segment]?{leg:legs[segment],rev:false}:null;
  const k=2*n-3-segment;
  return legs[k]?{leg:legs[k],rev:true}:null;
 },
 along(leg,rev,fraction) {
  if(!leg.len)return leg.pts[0];
  const target=(rev?1-fraction:fraction)*leg.len, cum=leg.cum;
  let lo=0,hi=cum.length-1;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(cum[mid]<=target)lo=mid;else hi=mid}
  const span=cum[hi]-cum[lo]||1, t=Math.min(1,Math.max(0,(target-cum[lo])/span));
  const a=leg.pts[lo],b=leg.pts[hi];
  return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
 },
 // Линия маршрута для рисования: по дорогам, если они загружены, иначе условная прямая
 path(bus) {
  const legs=this.roads.get(city+':'+bus.id);
  if(!legs)return bus.order.map(i=>CITIES[city].points[i]);
  const out=[];
  legs.forEach(l=>l.pts.forEach(p=>out.push(p)));
  return out;
 },
 hash(str) { let h=2166136261; for(const ch of str){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)} return (h>>>0)/4294967296; },
 // Трапеция скорости: разгон → крейсерская скорость → торможение (или треугольник на коротком участке)
 profile(D,v) {
  const a=this.accel,d=this.decel;
  if(D>=v*v/(2*a)+v*v/(2*d))return {t:D/v+v/(2*a)+v/(2*d),v};
  const vp=Math.sqrt(2*D*a*d/(a+d));
  return {t:vp/a+vp/d,v:vp};
 },
 distAt(D,pf,tt) {
  const a=this.accel,d=this.decel,v=pf.v,ta=v/a,td=v/d,tc=pf.t-ta-td;
  if(tt<=0)return 0; if(tt>=pf.t)return D;
  if(tt<ta)return .5*a*tt*tt;
  if(tt<ta+tc)return .5*a*ta*ta+v*(tt-ta);
  const r=pf.t-tt; return D-.5*d*r*r;
 },
 speedAt(pf,tt) {
  const a=this.accel,d=this.decel,v=pf.v,ta=v/a,td=v/d;
  if(tt<=0||tt>=pf.t)return 0;
  if(tt<ta)return a*tt;
  if(tt<pf.t-td)return v;
  return d*(pf.t-tt);
 },
 // План рейса: у каждого перегона своё время — по длине участка, с посадкой и светофорами
 plan(bus) {
  const key=city+":"+bus.id, ck=key+":"+(this.roads.has(key)?1:0);
  let pl=this.plans.get(ck); if(pl)return pl;
  const order=this.itinerary(bus), segs=[]; let total=0;
  for(let s=0;s<order.length-1;s++){
   const road=this.legFor(bus,s); let D;
   { // длина перегона не зависит от загрузки дорог: расписание одинаково на всех страницах (прямая × 1.3 на изгибы улиц)
    const a=CITIES[city].points[order[s]],b=CITIES[city].points[order[s+1]];
    D=Math.hypot(b[0]-a[0],(b[1]-a[1])*(Math.cos(a[0]*Math.PI/180)||1))*111320*1.3;
   }
   D=Math.max(D,60);
   const dwell=18+Math.round(this.hash(key+":d"+s)*22);          // посадка 18–40 с
   const v=this.cruise*(.85+.3*this.hash(key+":v"+s));            // 25–34 км/ч
   const parts=[{type:"wait",t:dwell,stop:true}];
   if(D>700&&this.hash(key+":l"+s)<.55){                          // светофор на длинном перегоне
    const at=.3+.4*this.hash(key+":p"+s), D1=D*at, D2=D-D1, p1=this.profile(D1,v), p2=this.profile(D2,v);
    parts.push({type:"move",D:D1,pf:p1,t:p1.t},{type:"wait",t:12+Math.round(14*this.hash(key+":w"+s))},{type:"move",D:D2,pf:p2,t:p2.t});
   }else{const pf=this.profile(D,v);parts.push({type:"move",D,pf,t:pf.t})}
   const t=parts.reduce((x,q)=>x+q.t,0);
   segs.push({D,parts,t,start:total,dwell}); total+=t;
  }
  pl={segs,cycle:total}; this.plans.set(ck,pl); return pl;
 },
 sample(bus,seconds) {
  const order=this.itinerary(bus), pl=this.plan(bus);
  const phase=((seconds%pl.cycle)+pl.cycle)%pl.cycle;
  let si=pl.segs.findIndex(s=>phase<s.start+s.t); if(si<0)si=pl.segs.length-1;
  const sg=pl.segs[si], e=phase-sg.start;
  let acc=0,covered=0,part=sg.parts.at(-1),pe=part.t;
  for(const q of sg.parts){
   if(e<acc+q.t){part=q;pe=e-acc;break}
   acc+=q.t; if(q.type==="move")covered+=q.D;
  }
  let dist=covered,kmh=0,waiting=false,light=false;
  if(part.type==="move"){dist=covered+this.distAt(part.D,part.pf,pe);kmh=Math.round(this.speedAt(part.pf,pe)*3.6)}
  else if(part.stop)waiting=true; else light=true;
  const fraction=Math.min(1,Math.max(0,dist/sg.D));
  const road=this.legFor(bus,si); let latlng;
  if(road)latlng=this.along(road.leg,road.rev,fraction);
  else{
   const a=CITIES[city].points[order[si]],b=CITIES[city].points[order[si+1]];
   latlng=[a[0]+(b[0]-a[0])*fraction,a[1]+(b[1]-a[1])*fraction];
  }
  return {latlng,waiting,light,kmh,
   stop:order[si],next:order[si+1],seconds:Math.ceil(sg.t-e),dwellLeft:Math.ceil(Math.max(0,sg.dwell-e)),fraction,
   percent:phase/pl.cycle*100};
 }
};

// Общие часы симуляции: одни и те же на карте, в помощнике и в уведомлениях (хранятся в браузере).
const AqylSim = {
 K:'aq-sim', st:null,
 load(){
  if(this.st)return this.st;
  let v=null; try{v=JSON.parse(localStorage.getItem(this.K))}catch{}
  if(!v||typeof v.s!=='number'||typeof v.r!=='number'){v={r:Date.now(),s:0,k:1};this.save(v)}
  return this.st=v;
 },
 save(v){this.st=v;try{localStorage.setItem(this.K,JSON.stringify(v))}catch{}},
 now(){const v=this.load();return v.s+(Date.now()-v.r)/1000*v.k},   // секунды симуляции
 speed(){return this.load().k},
 setSpeed(k){const t=this.now();this.save({r:Date.now(),s:t,k:Math.max(1,Math.min(60,Number(k)||1))})},
 offset(bus){const i=Math.max(0,BUSES.indexOf(bus));return (i/BUSES.length)*fleetMotion.plan(bus).cycle+15},
 clock(bus){return this.now()+this.offset(bus)}
};
window.addEventListener('storage',e=>{if(e.key===AqylSim.K)AqylSim.st=null});

// Загрузка маршрута по дорогам OpenStreetMap через публичный сервер OSRM.
// Результат кэшируется в браузере, чтобы при следующем заходе всё работало сразу.
async function loadRoads(bus) {
 const id=city, key=id+':'+bus.id;
 if(fleetMotion.roads.has(key))return 'cache';
 const cacheKey='roads-v1-'+key;
 const cached=read(cacheKey,null);
 const valid=d=>d&&Array.isArray(d.legs)&&Array.isArray(d.snapped)&&d.legs.length===bus.order.length-1&&d.snapped.length===bus.order.length;
 if(valid(cached)){fleetMotion.setRoad(id,bus,cached);return 'cache'}
 const coords=bus.order.map(i=>CITIES[id].points[i]).map(p=>p[1]+','+p[0]).join(';');
 const url='https://router.project-osrm.org/route/v1/driving/'+coords+'?overview=false&steps=true&geometries=geojson';
 const ctl=new AbortController(), timer=setTimeout(()=>ctl.abort(),15000);
 try{
  const r=await fetch(url,{signal:ctl.signal});
  if(!r.ok)throw new Error('HTTP '+r.status);
  const j=await r.json();
  if(j.code!=='Ok'||!j.routes||!j.routes[0])throw new Error(j.code||'no route');
  const legs=j.routes[0].legs.map(leg=>{
   const pts=[];
   leg.steps.forEach(st=>st.geometry.coordinates.forEach(([lng,lat])=>{
    const p=[+lat.toFixed(5),+lng.toFixed(5)],last=pts[pts.length-1];
    if(!last||last[0]!==p[0]||last[1]!==p[1])pts.push(p);
   }));
   return pts;
  });
  const snapped=j.waypoints.map(w=>[+w.location[1].toFixed(5),+w.location[0].toFixed(5)]);
  const data={legs,snapped};
  if(!valid(data))throw new Error('bad shape');
  save(cacheKey,data);
  fleetMotion.setRoad(id,bus,data);
  return 'net';
 }catch(err){
  return false;
 }finally{clearTimeout(timer)}
}

function mapPage(){
 const c=CITIES[city];
 $('#app').innerHTML=heading('Город в движении',`${c.name} · выбери автобус и следи за его поездкой`)+`
 <div class="live-banner"><span class="live-dot"></span><b>Демо-движение</b><span>8 автобусов · условные маршруты</span><span class="banner-end">Остановка → посадка → в путь</span></div>
 <div class="mapgrid"><section><div class="mapwrap"><div id="map" class="map" aria-label="Карта ${c.name}"></div><div class="map-caption">${icon('bus')} AQYLJOL <span>ТРАНСПОРТ ГОРОДА</span></div></div>
 <div class="maptools"><button id="center-map" class="secondary">${icon('target')} Весь маршрут</button><button id="pause" class="secondary" aria-pressed="false">Пауза</button><button id="follow-bus" class="secondary" aria-pressed="false">Следить</button><label class="speed-control">Скорость <select id="sim-speed" aria-label="Скорость симуляции"><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option><option value="10">10×</option><option value="30">30×</option></select></label></div>
 <p id="map-status" class="mapstatus" role="status">Загружаем карту…</p><p class="footnote">Это симуляция, не GPS-трансляция. Названия мест реальные; координаты остановок приблизительные. Автобусы едут по дорогам OpenStreetMap (маршрут строится онлайн через OSRM); если сервис недоступен, показываются условные прямые линии. Время на панели — секунды симуляции.</p></section>
 <aside><div class="tracking-card"><div class="eyebrow">НАБЛЮДАЕМ ЗА ПОЕЗДКОЙ</div><div class="tracking-title"><strong id="tracking-number"></strong><span id="motion-state"></span></div><p id="next-stop"></p><div class="motion-progress"><i id="motion-progress"></i></div><span id="arrival-count" class="muted"></span></div><div id="selected-bus"></div><div class="card"><h2>Остановки маршрута</h2><ol id="stops" class="stops"></ol></div><div class="filters fleet-picker">${BUSES.map(b=>`<button class="chip" data-select="${b.id}" aria-pressed="false">№ ${b.id}</button>`).join('')}</div></aside></div>`;
 let baseStatus='Загружаем карту…', roadInfo='';
 function paintStatus(){$('#map-status').textContent=baseStatus+(roadInfo?' · '+roadInfo:'')}
 let selected=route(params.get('bus'))||BUSES[0], map, line, stopsLayer, paused=matchMedia('(prefers-reduced-motion: reduce)').matches, following=false,speed=AqylSim.speed(),lag=0;
 const markers=new Map(), clocks=new Map(BUSES.map(b=>[b.id,AqylSim.clock(b)]));
 const markerIcon=(b,chosen)=>L.divIcon({className:'bus-pin',html:`<div class="mapmarker ${chosen?'chosen':''}" style="--bus-color:${b.color}">${icon('bus')}<b>${b.id}</b></div>`,iconSize:[64,40],iconAnchor:[32,20]});
 function updateTelemetry(){
  const state=fleetMotion.sample(selected,clocks.get(selected.id));
  $('#tracking-number').textContent='№ '+selected.id;
  const fi=window.AqylFleet&&AqylFleet.info(selected);$('#motion-state').textContent=fi&&fi.off?'Не работает':fi&&fi.stopped?'Стоит · '+fi.reason:paused?'На паузе':state.waiting?'На остановке':state.light?'На светофоре':'В пути · '+state.kmh+' км/ч';
  $('#next-stop').textContent=(state.waiting?'Посадка: ':'Следующая: ')+c.stops[state.waiting?state.stop:state.next];
  const fmt=s=>s>=60?Math.floor(s/60)+' мин '+String(s%60).padStart(2,'0')+' с':s+' с';
  $('#arrival-count').textContent=fi&&fi.off?fi.why:fi&&fi.stopped?'Водитель отметил остановку · движение продолжится после отметки':state.waiting?`Отправление через ${fmt(state.dwellLeft)}`:state.light?`Стоит на светофоре · до остановки ${fmt(state.seconds)}`:`До следующей остановки: ${fmt(state.seconds)}`;
  $('#motion-progress').style.width=state.percent+'%';
  document.querySelectorAll('#stops li').forEach(el=>el.classList.toggle('next-stop',Number(el.dataset.stop)===(state.waiting?state.stop:state.next)));
 }
 function select(id,fit=true){
  selected=route(id)||selected;
  $('#selected-bus').innerHTML=busCard(selected,true);
  $('#stops').innerHTML=selected.order.map((i,j)=>`<li data-stop="${i}"><small>${String(j+1).padStart(2,'0')}</small>${c.stops[i]}</li>`).join('');
  document.querySelectorAll('.chip[data-select]').forEach(el=>{el.classList.toggle('active',el.dataset.select===selected.id);el.setAttribute('aria-pressed',String(el.dataset.select===selected.id))});
  const next=new URL(location.href);next.searchParams.set('bus',selected.id);history.replaceState(null,'',next);
  drawRoute(fit);
  updateTelemetry();
 }
 function drawRoute(fit){
  if(!map)return;
  if(line)map.removeLayer(line);if(stopsLayer)map.removeLayer(stopsLayer);
  line=L.polyline(fleetMotion.path(selected),{color:selected.color,weight:5,opacity:.85,lineJoin:'round'}).addTo(map);
  stopsLayer=L.layerGroup([...new Set(selected.order)].map(i=>L.marker(fleetMotion.stopPoint(i),{icon:L.divIcon({className:'',html:'<div class="stopdot"></div>',iconSize:[14,14],iconAnchor:[7,7]}),title:c.stops[i]}).bindPopup(c.stops[i]))).addTo(map);
  markers.forEach((m,id)=>{m.setIcon(markerIcon(route(id),id===selected.id));m.setZIndexOffset(id===selected.id?1000:500)});
  if(fit)map.fitBounds(line.getBounds(),{padding:[48,48]});
 }
 select(selected.id);
 document.addEventListener('click',e=>{const b=e.target.closest('[data-select]');if(b)select(b.dataset.select)});
 const pauseButton=$('#pause');
 function syncPause(){pauseButton.textContent=paused?'Продолжить':'Пауза';pauseButton.setAttribute('aria-pressed',String(paused));updateTelemetry()}
 syncPause();pauseButton.addEventListener('click',()=>{paused=!paused;syncPause()});
 {const sel=$('#sim-speed');if([...sel.options].some(o=>Number(o.value)===speed))sel.value=String(speed);sel.addEventListener('change',e=>{speed=Number(e.target.value);AqylSim.setSpeed(speed)})}
 $('#follow-bus').addEventListener('click',()=>{following=!following;$('#follow-bus').setAttribute('aria-pressed',String(following));$('#follow-bus').textContent=following?'Слежение включено':'Следить';if(map&&following)map.panTo(markers.get(selected.id).getLatLng())});
 if(window.L){
  map=L.map('map',{scrollWheelZoom:true}).setView(c.center,13);window.AqylLeafletMap=map;
  const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
  let errors=false;tiles.on('tileerror',()=>{errors=true;baseStatus='Подложка недоступна. Движение продолжает работать';paintStatus()});
  tiles.on('load',()=>{if(!errors){baseStatus='OpenStreetMap';paintStatus()}});
  BUSES.forEach(b=>markers.set(b.id,L.marker(fleetMotion.sample(b,clocks.get(b.id)).latlng,{icon:markerIcon(b,b.id===selected.id),title:`Демо-автобус ${b.id}`,zIndexOffset:500}).addTo(map).on('click',()=>select(b.id,false))));
  select(selected.id);$('#center-map').addEventListener('click',()=>map.fitBounds(line.getBounds(),{padding:[48,48]}));
  map.on('dragstart',()=>{following=false;$('#follow-bus').setAttribute('aria-pressed','false');$('#follow-bus').textContent='Следить'});
  (async()=>{
   const queue=[selected,...BUSES.filter(b=>b!==selected)];
   let done=0,ok=0;
   roadInfo='строим маршруты по дорогам… 0/'+queue.length;paintStatus();
   for(const b of queue){
    if(!document.getElementById('map'))return;
    const got=await loadRoads(b);
    done++;if(got)ok++;
    roadInfo=done<queue.length?'строим маршруты по дорогам… '+done+'/'+queue.length:ok===queue.length?'движение по дорогам':ok?'дороги загружены для '+ok+' из '+queue.length+' автобусов':'дороги недоступны, показаны условные линии';
    paintStatus();
    if(got&&b.id===selected.id)drawRoute(true);
    if(got==='net')await new Promise(r=>setTimeout(r,300));
   }
  })();
 }else{
  $('#map').innerHTML='<div class="offline-map"><span class="botavatar">↗</span><h2>Карта ждёт подключения</h2><p>Для подложки нужен интернет.<br>Симуляция поездок работает на панели справа.</p><button class="primary" id="retry-map">Повторить загрузку</button></div>';
  $('#retry-map').onclick=()=>location.reload();$('#map-status').textContent='Библиотека карты не загрузилась';$('#center-map').disabled=true;$('#follow-bus').disabled=true;
 }
 let previous=performance.now(),lastUI=0;
 function frame(now){
  const dt=Math.min((now-previous)/1000,.1);previous=now;
  if(paused&&!document.hidden)lag+=dt*speed; // пауза только для карты, часы симуляции идут
  if(!paused&&!document.hidden){BUSES.forEach(b=>{clocks.set(b.id,AqylSim.clock(b)-lag);if(markers.has(b.id))markers.get(b.id).setLatLng(fleetMotion.sample(b,clocks.get(b.id)).latlng)});
   if(now-lastUI>250){updateTelemetry();if(map&&following)map.panTo(markers.get(selected.id).getLatLng(),{animate:false});lastUI=now}}
  requestAnimationFrame(frame);
 }
 requestAnimationFrame(frame);
 simulateDisruptions(()=>{$('#selected-bus').innerHTML=busCard(selected,true)});
}

function journeyOptions(from,to){
 if(from===to)return [];
 const results=[];
 function legs(bus,a,b){const order=fleetMotion.itinerary(bus);let best=Infinity;for(let i=0;i<order.length-1;i++)if(order[i]===a){for(let n=1;n<order.length;n++)if(order[(i+n)%(order.length-1)]===b){best=Math.min(best,n);break}}return best}
 for(const bus of BUSES){const count=legs(bus,from,to);if(Number.isFinite(count))results.push({buses:[bus],minutes:bus.eta+count*3,count})}
 if(!results.length)for(const a of BUSES)for(const b of BUSES){if(a===b)continue;for(const via of new Set(a.order)){if(via===from||via===to)continue;const first=legs(a,from,via),second=legs(b,via,to);if(Number.isFinite(first+second))results.push({buses:[a,b],minutes:a.eta+b.eta+(first+second)*3,count:first+second,via})}}
 return results.sort((a,b)=>a.minutes-b.minutes).slice(0,3);
}

document.addEventListener('DOMContentLoaded',()=>{
 // Accessible names remain available when navigation captions collapse on small screens.
 document.querySelectorAll('#nav a').forEach(a=>a.setAttribute('aria-label',a.textContent.trim()));
 const headerNote=document.createElement('span');headerNote.className='header-note';headerNote.innerHTML='<i></i> Твой ритм. Твой маршрут.';$('.brand').after(headerNote);
 if(page!=='home')return;
 $('.pageheading').insertAdjacentHTML('beforeend','<span class="today-label">КАЗАХСТАН / ГОРОДСКАЯ МОБИЛЬНОСТЬ</span>');
 const hero=$('.hero');hero.insertAdjacentHTML('beforeend',`<div class="city-art" aria-hidden="true"><svg viewBox="0 0 480 330"><defs><pattern id="city-grid" width="38" height="38" patternUnits="userSpaceOnUse"><path d="M38 0H0V38" fill="none" stroke="#ffffff" stroke-opacity=".06"/></pattern></defs><rect width="480" height="330" fill="url(#city-grid)"/><g fill="#264c45" stroke="#52766b" stroke-width="1"><path d="M280 30l50-20 40 22v80l-50 20-40-22z"/><path d="M370 162l48-20 40 22v60l-48 20-40-22z"/><path d="M100 70l42-18 32 20v53l-42 18-32-20z"/><path d="M165 222l50-20 35 21v70l-50 20-35-21z"/></g><path d="M-10 213L122 155Q149 144 174 157L244 193Q269 208 295 195L485 108" fill="none" stroke="#0b211c" stroke-width="44"/><path d="M-10 213L122 155Q149 144 174 157L244 193Q269 208 295 195L485 108" fill="none" stroke="#c9f24e" stroke-width="2" stroke-dasharray="6 9"/><g transform="translate(220 155) rotate(25)"><rect x="-49" y="-24" width="98" height="48" rx="13" fill="#c9f24e"/><rect x="-35" y="-18" width="51" height="36" rx="7" fill="#ecffb8"/><path d="M23-16h13v32H23" fill="#244c42"/><path d="M-26-28h18m-18 56h18m33-56h13m-13 56h13" stroke="#071d16" stroke-width="7"/><text x="-12" y="6" fill="#183d2b" text-anchor="middle" font-size="18" font-weight="bold">14</text></g><circle cx="125" cy="155" r="7" fill="#c9f24e"/><circle cx="378" cy="157" r="7" fill="#c9f24e"/></svg><div class="art-label"><i></i> Поехали с комфортом <span>↗</span></div></div>`);
 const planner=document.createElement('section');planner.className='card journey-planner';
 planner.innerHTML=`<div class="planner-heading"><div><span class="eyebrow">ТВОЯ СЛЕДУЮЩАЯ ПОЕЗДКА</span><h2>Из точки А — в твои планы.</h2></div><span class="badge">${icon('spark')} Подбор маршрута</span></div><form id="journey-form"><label class="field">Откуда<select id="journey-from" aria-label="Остановка отправления">${CITIES[city].stops.map((s,i)=>`<option value="${i}">${s}</option>`).join('')}</select></label><button class="swap-stops" type="button" id="swap-stops" aria-label="Поменять остановки местами">⇄</button><label class="field">Куда<select id="journey-to" aria-label="Остановка назначения">${CITIES[city].stops.map((s,i)=>`<option value="${i}" ${i===3?'selected':''}>${s}</option>`).join('')}</select></label><button class="primary" type="submit">Найти поездку ${icon('arrow')}</button></form><div id="journey-results" aria-live="polite"></div><p class="footnote">Демо-подбор по условным маршрутам. Время оценено из расчёта 3 минуты между остановками и ожидания автобуса.</p>`;
 $('.twocol').after(planner);
 $('#swap-stops').onclick=()=>{const a=$('#journey-from'),b=$('#journey-to');[a.value,b.value]=[b.value,a.value];$('#journey-results').replaceChildren()};
 for(const id of ['#journey-from','#journey-to'])$(id).onchange=()=>$('#journey-results').replaceChildren();
 $('#journey-form').onsubmit=e=>{e.preventDefault();const from=Number($('#journey-from').value),to=Number($('#journey-to').value);const options=journeyOptions(from,to);$('#journey-results').innerHTML=from===to?'<p class="planner-message">Ты уже в нужном месте — выбери другую остановку.</p>':options.length?options.map((o,i)=>`<a class="journey-result" href="${url('map.html',{bus:o.buses[0].id})}"><span class="journey-route">${o.buses.map(b=>`<b style="background:${b.color}">${b.id}</b>`).join('<span>→</span>')}</span><span><strong>${i===0?'Быстрее среди найденных':'Ещё один вариант'}</strong><small>${o.buses.length===1?'Без пересадок':'Пересадка: '+CITIES[city].stops[o.via]}</small></span><strong>≈ ${o.minutes} мин</strong>${icon('arrow')}</a>`).join(''):'<p class="planner-message">Связь между остановками не найдена. Попробуй соседнюю остановку.</p>'};
 $('.journey-planner').insertAdjacentHTML('afterend',`<div class="city-metrics"><div><strong>${Object.keys(CITIES).length}</strong><span>городов Казахстана</span></div><div><strong>${BUSES.length}</strong><span>демо-маршрутов</span></div><div><strong>А → Б</strong><span>с заботой о комфорте</span></div><a href="${url('map.html')}"><span class="live-dot"></span> Посмотреть движение ${icon('arrow')}</a></div>`);
});
