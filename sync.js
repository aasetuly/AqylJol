/* AqylJol — общая база данных (Firebase Firestore).
   Остальной код (db.js, auth.js, fleet.js) по-прежнему читает и пишет localStorage — этот модуль незаметно
   зеркалит изменения общих таблиц в Firestore и подтягивает чужие изменения обратно в localStorage.
   Таблицы -> коллекции:  users->db_users, people->db_people, roles->db_roles, tickets->db_tickets,
                          status->db_status, sched->db_sched, log->db_log; кошелёк (баланс + история) -> db_wallets/{uid}.
   Кто что видит (дополнительно защищено правилами firestore.rules):
     пассажир/водитель — свою запись (user, people, role, обращения), расписание и статусы автобусов;
     админ города      — людей, роли, обращения и журнал своего города;
     главный админ     — всё.
   Тестовое время (aq-fleet-clock) намеренно НЕ общее. */
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, query, where, orderBy, limit }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const MAPS = {                       // ключ localStorage -> коллекция
  'aq-auth-users':'db_users', 'aq-fleet-people':'db_people', 'aq-fleet-roles':'db_roles',
  'aq-db-tickets':'db_tickets', 'aq-fleet-status':'db_status', 'aq-fleet-sched':'db_sched'
};
const LOG_KEY = 'aq-fleet-log', LOG_COL = 'db_log';
const BY_KEY = {...MAPS, [LOG_KEY]: LOG_COL};
const COL_KEY = Object.fromEntries(Object.entries(BY_KEY).map(([k,c]) => [c,k]));

const ls = localStorage;
const rawSet = Storage.prototype.setItem.bind(ls);
const rd = (k, f) => { try { const v = ls.getItem(k); return v ? JSON.parse(v) : f } catch { return f } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const clean = o => JSON.parse(JSON.stringify(o, (k, v) => v === undefined ? null : v));
const sid = id => String(id).replace(/\//g, '|');
const logId = e => e.t + '_' + (String(e.text || '').length) + '_' + (e.city || '');

let fs = null, uid = null, active = false, unsubs = [], myRole = null, myCity = null;
const prev = {};      // последняя известная версия каждой таблицы (для вычисления изменений)
const pending = {};   // изменения, сделанные до подключения: key -> Set(id)
let applying = false; // true, пока мы сами пишем пришедшие данные в localStorage

function fire(key) {
  try { window.dispatchEvent(new StorageEvent('storage', { key })) } catch {}
  window.dispatchEvent(new CustomEvent('aq-db-sync', { detail: { key } }));
}

/* ---------- локальная запись -> Firestore ---------- */
function pushDiff(key, val) {
  const col = BY_KEY[key];
  if (key === LOG_KEY) {
    const old = new Set((prev[key] || []).map(logId));
    for (const e of val || []) if (!old.has(logId(e))) setDoc(doc(fs, col, sid(logId(e))), clean({ ...e, uid })).catch(warn);
    prev[key] = val; return;
  }
  const o = prev[key] || {}, n = val || {};
  for (const id of Object.keys(n)) if (!same(o[id], n[id])) setDoc(doc(fs, col, sid(id)), clean(n[id])).catch(warn);
  for (const id of Object.keys(o)) if (!(id in n)) deleteDoc(doc(fs, col, sid(id))).catch(warn);
  prev[key] = n;
}
const warn = e => console.warn('[AqylSync]', e && e.code || e);

Storage.prototype.setItem = function (k, v) {
  rawSet.call(this, k, v);
  if (this === ls && !applying && active && uid && k === 'aq-wallet:' + uid) { // кошелёк: история поездок и оплат
    try { const w = JSON.parse(v); setDoc(doc(fs, 'db_wallets', uid), clean({ balance: w.balance, history: w.history, updated: Date.now() })).catch(warn) } catch {}
    return;
  }
  if (this !== ls || applying || !(k in BY_KEY)) return;
  let val; try { val = JSON.parse(v) } catch { return }
  if (active) { pushDiff(k, val); return }
  // нет подключения: запоминаем, что изменилось, отправим после входа
  const o = prev[k] ?? rd(k, k === LOG_KEY ? [] : {});
  const p = pending[k] || (pending[k] = {});
  if (k === LOG_KEY) { for (const e of val || []) p[logId(e)] = e }
  else for (const id of Object.keys(val || {})) if (!same(o[id], val[id])) p[id] = val[id];
  prev[k] = val;
};

function flushPending() {
  for (const [k, p] of Object.entries(pending)) {
    const col = BY_KEY[k];
    for (const [id, v] of Object.entries(p)) setDoc(doc(fs, col, sid(id)), clean(k === LOG_KEY ? { ...v, uid } : v)).catch(warn);
    delete pending[k];
  }
}

/* ---------- Firestore -> localStorage ---------- */
function applyMap(key, docs, mode) {
  // mode 'merge' — слушаем лишь часть коллекции: чужие записи не трогаем
  const cur = rd(key, {});
  let next;
  if (mode === 'merge') { next = { ...cur }; for (const [id, v] of docs) { if (v === null) delete next[id]; else next[id] = v } }
  else { next = {}; for (const [id, v] of docs) if (v !== null) next[id] = v; const p = pending[key]; if (p) for (const id of Object.keys(p)) if (!(id in next)) next[id] = p[id] }
  if (same(cur, next)) { prev[key] = next; return }
  applying = true; try { rawSet.call(ls, key, JSON.stringify(next)) } finally { applying = false }
  prev[key] = next; fire(key);
}
function applyLog(entries) {
  entries.sort((a, b) => b.t - a.t);
  const next = entries.slice(0, 100).map(({ uid: _u, ...e }) => e);
  if (same(rd(LOG_KEY, []), next)) { prev[LOG_KEY] = next; return }
  applying = true; try { rawSet.call(ls, LOG_KEY, JSON.stringify(next)) } finally { applying = false }
  prev[LOG_KEY] = next; fire(LOG_KEY);
}

const stopAll = () => { unsubs.forEach(u => { try { u() } catch {} }); unsubs = [] };
const listen = (q, onData) => unsubs.push(onSnapshot(q, onData, e => warn(e)));

// слушаем целую коллекцию (или запрос) и заменяем таблицу целиком
function mirrorCollection(col, q) {
  const key = COL_KEY[col];
  listen(q || collection(fs, col), snap => {
    if (key === LOG_KEY) applyLog(snap.docs.map(d => d.data()));
    else applyMap(key, snap.docs.map(d => [d.id.replace(/\|/g, '/'), d.data()]));
  });
}
// слушаем один документ и обновляем только его запись
function mirrorDoc(col, id) {
  const key = COL_KEY[col];
  listen(doc(fs, col, sid(id)), s => applyMap(key, [[id, s.exists() ? s.data() : null]], 'merge'));
}

function attach(role, city) {
  stopAll();
  myRole = role; myCity = city;
  const c = n => collection(fs, n);
  // для всех: расписание и статусы автобусов
  mirrorCollection('db_sched'); mirrorCollection('db_status');
  if (role === 'owner') {
    ['db_users', 'db_people', 'db_roles', 'db_tickets'].forEach(n => mirrorCollection(n));
    mirrorCollection(LOG_COL, query(c(LOG_COL), orderBy('t', 'desc'), limit(100)));
  } else if (role === 'admin') {
    mirrorCollection('db_roles');   // нужны роли для назначения водителей; правила не пускают чужие города на запись
    ['db_users', 'db_people', 'db_tickets', LOG_COL].forEach(n => mirrorCollection(n, query(c(n), where('city', '==', city || '_'))));
  } else {
    mirrorDoc('db_users', uid); mirrorDoc('db_people', uid); mirrorDoc('db_roles', uid);
    mirrorCollection('db_tickets', query(c('db_tickets'), where('uid', '==', uid)));
  }
}

async function start(user) {
  // токен должен содержать email_verified=true, иначе правила базы откажут (после подтверждения письма он мог устареть)
  try { const t = await user.getIdTokenResult(); if (!t.claims.email_verified) await user.getIdToken(true) } catch {}
  if (!fs || (window.AqylFB.auth.currentUser || {}).uid !== user.uid) return;
  uid = user.uid; active = true;
  prev['aq-fleet-roles'] = prev['aq-fleet-roles'] ?? rd('aq-fleet-roles', {});
  flushPending();
  // сначала узнаём свою роль, потом открываем нужные подписки
  let first = true;
  const roleUnsub = onSnapshot(doc(fs, 'db_roles', sid(uid)), s => {
    const r = s.exists() ? s.data() : null;
    if (r) applyMap('aq-fleet-roles', [[uid, r]], 'merge');
    const role = r ? r.role : 'user', city = r ? r.city : null;
    if (first || role !== myRole || city !== myCity) { first = false; attach(role, city); }
  }, e => { warn(e); if (first) { first = false; attach('user', null) } });
  unsubs.push(roleUnsub);
  // кошелёк и история — личные, по документу на человека
  unsubs.push(onSnapshot(doc(fs, 'db_wallets', sid(uid)), s => {
    const wk = 'aq-wallet:' + uid;
    if (s.exists()) {
      const d = s.data(), next = { balance: d.balance, history: d.history || [] };
      if (same(rd(wk, null), next)) return;
      applying = true; try { rawSet.call(ls, wk, JSON.stringify(next)) } finally { applying = false }
      fire(wk);
    } else { const l = rd(wk, null); if (l) setDoc(doc(fs, 'db_wallets', uid), clean({ ...l, updated: Date.now() })).catch(warn) }
  }, warn));
}
function stop() {
  active = false; uid = null; myRole = null; myCity = null; stopAll();
}

function init() {
  const fb = window.AqylFB;
  fs = getFirestore(fb.app);
  window.AqylSync = { get active() { return active }, stop };
  addEventListener('aq-auth-verified', () => { const u = fb.auth.currentUser; if (u && u.emailVerified && !active) start(u) });
  fb.onAuthStateChanged(fb.auth, u => {
    if (u && u.emailVerified) { if (!active || uid !== u.uid) { stop(); start(u) } }
    else stop();
  });
}
if (window.AqylFB) init(); else addEventListener('aqyl-fb-ready', init, { once: true });
