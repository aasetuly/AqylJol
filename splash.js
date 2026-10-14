/* Заставка AqylJol + мгновенная тема (без вспышки). Подключается в <head> синхронно. */
(function(){
 var d=document.documentElement,pref='system';
 try{var v=localStorage.getItem('aq-theme');if(v)pref=JSON.parse(v)}catch(e){}
 var dark=pref==='dark'||(pref!=='light'&&window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches);
 d.setAttribute('data-theme',dark?'dark':'light');
 var seen=false;try{seen=sessionStorage.getItem('aq-splash')==='1'}catch(e){}
 if(seen)return;
 try{sessionStorage.setItem('aq-splash','1')}catch(e){}
 d.classList.add('splash-on');
 var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 function build(){
  var s=document.createElement('div');s.id='splash';s.setAttribute('role','status');s.setAttribute('aria-label','AqylJol — Знай, Планируй, Едь.');
  s.innerHTML='<div class="sp-box"><img class="sp-logo" src="aqyljol-icon.svg" alt="" width="132" height="136"><div class="sp-bar"><i></i></div><p class="sp-tag"><span>Знай,</span> <span>Планируй,</span> <span>Едь.</span></p></div>';
  document.body.appendChild(s);
  var done=false;function close(){if(done)return;done=true;s.classList.add('sp-out');setTimeout(function(){s.remove();d.classList.remove('splash-on');window.dispatchEvent(new Event('splash-done'))},reduce?0:600)}
  s.addEventListener('click',close);
  setTimeout(close,reduce?900:3900);
 }
 if(document.body)build();else document.addEventListener('DOMContentLoaded',build);
 setTimeout(function(){d.classList.remove('splash-on');window.dispatchEvent(new Event('splash-done'))},6000); // страховка
})();
