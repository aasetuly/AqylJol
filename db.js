/* AqylJol — простая база данных (localStorage браузера).
   Таблицы: users (аккаунты), roles (роли/блокировки/город админа), people (кто где бывал),
   tickets (обращения в техподдержку), log (журнал действий).
   API: AqylDB.table('users').get(id) / .set(id,obj) / .update(id,patch) / .remove(id) / .all() / .list()
   Общая база между устройствами: sync.js зеркалит эти таблицы в Firebase Firestore (см. firestore.rules). */
(()=>{
'use strict';
const KEYS={users:'aq-auth-users',roles:'aq-fleet-roles',people:'aq-fleet-people',tickets:'aq-db-tickets',log:'aq-fleet-log'};
const mem={};
/* Одноразовая очистка: при первом открытии этой версии удаляются старые аккаунты (телефон/почта прошлой версии), роли, обращения и журнал.
   Вход: Google или почта + пароль с подтверждением почты (Firebase). */
const DB_VERSION='11';
try{
 if(localStorage.getItem('aq-db-version')!==DB_VERSION){
  ['aq-auth-users','aq-auth-session','aq-fleet-roles','aq-fleet-people','aq-fleet-status','aq-db-tickets','aq-fleet-log'].forEach(k=>localStorage.removeItem(k));
  localStorage.setItem('aq-db-version',DB_VERSION);
 }
}catch{}
const rd=(k,f)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):f}catch{const v=mem[k];return v?JSON.parse(v):f}};
const wr=(k,v)=>{mem[k]=JSON.stringify(v);try{localStorage.setItem(k,mem[k])}catch{}};
function table(name){
 const k=KEYS[name]||'aq-db-'+name;
 return{
  all:()=>rd(k,{}),
  list:()=>Object.values(rd(k,{})),
  get:id=>rd(k,{})[id]||null,
  set(id,obj){const a=rd(k,{});a[id]=obj;wr(k,a);return obj},
  update(id,patch){const a=rd(k,{});a[id]={...(a[id]||{}),...patch};wr(k,a);return a[id]},
  remove(id){const a=rd(k,{});delete a[id];wr(k,a)}
 };
}
function exportAll(){
 const out={};
 for(const[n,k]of Object.entries(KEYS)){
  const v=rd(k,n==='log'?[]:{});
  if(n==='users')for(const u of Object.values(v)){delete u.hash;delete u.salt} // пароли в выгрузку не попадают
  out[n]=v;
 }
 return out;
}
window.AqylDB={table,exportAll,KEYS};
})();
