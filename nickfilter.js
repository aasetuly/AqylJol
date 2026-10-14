/* AqylJol — фильтр имён и ников. Не пропускает мат, оскорбления и ругательства на русском, казахском и английском,
   включая обходы: замена букв похожими (с→c, о→0, а→@), повтор букв («сууука»), разделители («с.у.к.а»), транслит («suka»).
   API: AqylNick.check(текст) -> {ok, word}    AqylNick.validateName(имя, фамилия) -> {ok, name, error}
   Списки ниже можно дополнять: EXACT — слово целиком, PREFIX — слово начинается так, CONTAIN — встречается внутри. */
(()=>{
'use strict';

const EXACT=[
 // русский
 'сука','суки','суку','сучка','сучара','пидор','пидорас','пидр','пидар','пидарас','педик','педики','гей','геи','гейский','гомик','чмо','хер','жопа','лох','шлюха','шалава','мразь','гнида','выродок','нацист','гитлер','пизда','хуй','блядь','блять','бля','ебать','мудак','гандон','гондон','залупа','манда',
 // казахский
 'қаншық','каншык','қотақ','котак','көтбас','котбас','жезөкше','жезокше','амшық','амшык','сиктір','сиктир',
 // английский и транслит
 'gay','gays','niger','nigger','niggers','nigga','niggas','fag','faggot','fuck','shit','bitch','cunt','dick','cock','pussy','whore','slut','asshole','retard','nazi','hitler','rapist',
 'suka','suki','blyat','blyad','blat','pidor','pidar','pidr','pidoras','huy','hui','xuy','hyi','pizda','pizd','ebat','mudak','gandon','zalupa','chmo','gomik',
 // сокращения
 'сцуко','пздц','хуесос','хуйло'
];
const PREFIX=[
 'бля','блят','бляд','хуй','хуе','хуя','хуи','хули','пизд','пезд','ебан','ебат','ебал','ебну','ебуч','ебыр','еблан','заеб','уеб','наеб','поеб','выеб','объеб','долбоеб','мудак','мудил','мудо','гандон','гондон','залуп','дроч','шлюх','шалав','пидор','пидар','пидр','педик','сучар','сучк','говн','дерьм','срак','жоп','урод','гомосек','негр','чурка','хохол','москаль',
 'қанш','сиктір','сиктир','жезөкш','амшық','амшык',
 'nigg','fagg','fuck','shit','bitch','cunt','whore','slut','porn','retard','bastard','dickhead','asshole','pussy','blowjob','motherf',
 'blyat','blyad','pidor','pidar','pidr','huyn','huev','huyo','pizd','ebat','ebal','eban','yeban','mudak','gandon','zalup','dolboeb','dolboyeb'
];
const CONTAIN=[
 'хуй','пизд','пидор','пидар','блят','бляд','мудак','залуп','гандон','хуесос','долбоеб','залупа',
 'fuck','nigger','nigga','faggot','bitch','cunt','whore','motherfucker'
];

/* буквы-двойники: латиница↔кириллица, цифры и символы */
const L2C={a:'а',b:'в',c:'с',e:'е',h:'н',k:'к',m:'м',o:'о',p:'р',t:'т',x:'х',y:'у'};
const C2L={а:'a',в:'b',с:'c',е:'e',н:'h',к:'k',м:'m',о:'o',р:'p',т:'t',х:'x',у:'y',і:'i',ј:'j',ѕ:'s',ү:'y',ұ:'u',қ:'k',ә:'a',ө:'o',ғ:'g',ң:'n',һ:'h'};
const LEET={'@':'a','$':'s','0':'o','1':'i','3':'e','4':'a','5':'s','7':'t','8':'b','!':'i','|':'i'};

const collapse=s=>s.replace(/(.)\1+/gu,'$1');
function base(s){
 s=String(s||'').normalize('NFKD').replace(/[\u0300-\u036f\u200b-\u200f\u2060\ufeff]/g,'').toLowerCase().replace(/ё/g,'е');
 return s.replace(/[@$013457!|8]/g,c=>LEET[c]||c);
}
const toRu=s=>s.replace(/[a-z]/g,c=>L2C[c]||c);   // всё в кириллицу
const toEn=s=>s.replace(/[а-яіјѕүұқәөғңһ]/g,c=>C2L[c]||c); // всё в латиницу
const variants=s=>{const b=base(s);return[...new Set([b,toRu(b),toEn(b)])]};
const norm=s=>collapse(s);

const E=new Set(),P=[],C=[];
for(const w of EXACT){for(const v of variants(w))E.add(norm(v))}
for(const w of PREFIX){for(const v of variants(w)){const n=norm(v);if(n.length>=3&&!P.includes(n))P.push(n)}}
for(const w of CONTAIN){for(const v of variants(w)){const n=norm(v);if(n.length>=4&&!C.includes(n))C.push(n)}}

const tokens=s=>base(s).split(/[^a-zа-яіјѕүұқәөғңһ]+/u).filter(Boolean);

function check(text){
 const raw=String(text||'');
 if(!raw.trim())return{ok:true};
 const toks=tokens(raw);
 const test=t=>{
  for(const v of [t,toRu(t),toEn(t)]){
   const n=norm(v);
   if(E.has(n))return n;
   for(const p of P)if(n.startsWith(p))return p;
   for(const c of C)if(n.includes(c))return c;
  }
  return null;
 };
 for(const t of toks){const r=test(t);if(r)return{ok:false,word:r}}
 // обход разделителями: «с у к а», «g.a.y», «б-л-я-т-ь»
 const compact=toks.join('');
 if(compact&&compact!==toks[0]){
  for(const v of [compact,toRu(compact),toEn(compact)]){
   const n=norm(v);
   if(E.has(n))return{ok:false,word:n};
   for(const c of C)if(n.includes(c))return{ok:false,word:c};
  }
 }
 return{ok:true};
}

const PART=/^[\p{L}][\p{L}'’\- ]*$/u;
function validateName(first,last){
 first=String(first||'').trim().replace(/\s+/g,' ');last=String(last||'').trim().replace(/\s+/g,' ');
 if(!first)return{ok:false,error:'Введите имя.'};
 if(!last)return{ok:false,error:'Введите фамилию.'};
 for(const [label,v] of [['Имя',first],['Фамилия',last]]){
  if(v.length<2)return{ok:false,error:label+' слишком короткое (минимум 2 буквы).'};
  if(v.length>30)return{ok:false,error:label+' слишком длинное (максимум 30 символов).'};
  if(!PART.test(v))return{ok:false,error:label+': используйте только буквы, дефис и апостроф — без цифр и символов.'};
 }
 const full=first+' '+last;
 if(!check(first).ok||!check(last).ok||!check(full).ok)return{ok:false,error:'Это имя нельзя использовать: в нём есть запрещённое или оскорбительное слово. Введите настоящее имя и фамилию.'};
 const cap=w=>w.replace(/(^|[\s\-'’])(\p{L})/gu,(m,a,b)=>a+b.toUpperCase());
 return{ok:true,name:cap(first)+' '+cap(last)};
}

/* User ID: 3–16 символов, латиница, цифры и «_». Те же фильтры мата, что и у имён; служебные слова зарезервированы. */
const RESERVED=['admin','administrator','dev','developer','root','owner','support','system','moderator','dispatcher','driver','aqyl','aqyljol','null','undefined','user','test'];
function checkId(raw,opts){
 const v=String(raw||'').trim();
 if(v.length<3)return{ok:false,error:'ID слишком короткий: минимум 3 символа.'};
 if(v.length>16)return{ok:false,error:'ID слишком длинный: максимум 16 символов.'};
 if(!/^[A-Za-z0-9_]+$/.test(v))return{ok:false,error:'В ID можно только латинские буквы, цифры и «_» — без пробелов и других символов.'};
 if(/^\d+$/.test(v))return{ok:false,error:'ID не может состоять только из цифр: добавьте буквы.'};
 if(!(opts&&opts.allowReserved)&&RESERVED.includes(v.toLowerCase()))return{ok:false,error:'Это слово зарезервировано. Выберите другой ID.'};
 if(!check(v).ok||!check(v.replace(/_/g,' ')).ok||!check(v.replace(/[0-9_]/g,'')).ok)return{ok:false,error:'Этот ID нельзя использовать: в нём есть запрещённое или оскорбительное слово.'};
 return{ok:true,id:v};
}
window.AqylNick={check,validateName,checkId};
})();
