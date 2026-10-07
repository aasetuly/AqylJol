/* The user's supplied logo and a new visual shell; transport functionality stays intact. */
document.addEventListener('DOMContentLoaded',()=>{
 const brand=document.querySelector('.brand');
 brand.setAttribute('aria-label','AqylJol — главная');
 brand.innerHTML='<img src="aqyljol-icon.svg" alt="" class="brand-logo"><span>Aqyl<b>Jol</b><small>ТВОЙ ГОРОД. ТВОЙ ПУТЬ.</small></span>';
 const note=document.querySelector('.header-note');
 note.innerHTML=`<span class="top-eyebrow">ГОРОДСКОЙ ТРАНСПОРТ</span><span class="top-location">${CITIES[city].name}<i></i><span>Казахстан</span></span>`;
 const nav=document.querySelector('#nav');
 const navTitle=document.createElement('span');navTitle.className='nav-title';navTitle.textContent='ТВОЁ ПРОСТРАНСТВО';nav.prepend(navTitle);
 const rail=document.createElement('div');rail.className='rail-note';rail.innerHTML=`<span class="rail-symbol">${icon('spark')}</span><strong>Легче с Aqyl.</strong><p>Подскажет, какой автобус<br>подойдёт именно тебе.</p><a href="${url('assistant.html')}">Спросить помощника ${icon('arrow')}</a><div class="rail-bottom"><span class="live-dot"></span> Демо-версия · 16 городов</div>`;nav.append(rail);
 document.querySelector('#app').insertAdjacentHTML('beforeend','<footer class="brand-footer"><span>AqylJol<span class="footer-dot">®</span> <small>Город ближе, чем кажется.</small></span><span>Сделано для твоего пути <b>↗</b></span></footer>');
 const caption=document.querySelector('.map-caption');if(caption)caption.innerHTML='<img src="aqyljol-icon.svg" alt="" width="25" height="25"> AqylJol <span>ТВОЙ ГОРОД В ДВИЖЕНИИ</span>';
 const headings={home:['01 / НАЧНИ СВОЙ ПУТЬ','Куда отправимся сегодня?'],routes:['03 / НАЙДИ СВОЮ ЛИНИЮ','Маршруты твоего города'],map:['02 / ГОРОД НА ЛАДОНИ','Каждый маршрут — перед тобой'],assistant:['04 / РЯДОМ С ТОБОЙ',null],trips:['05 / ВСЁ ПОД РУКОЙ','Твои поездки'],about:['06 / НАША КОМАНДА','О нас'],faq:['10 / ОТВЕТЫ','Вопросы'],settings:['07 / ТВОИ ПРАВИЛА','Настрой под себя'],driver:['08 / ЗА РУЛЁМ','Кабинет водителя'],admin:['09 / УПРАВЛЕНИЕ','Администрирование']};
 const h=document.querySelector('.pageheading');
 if(h){h.insertAdjacentHTML('afterbegin',`<span class="page-index">${headings[page][0]}</span>`);if(headings[page][1])h.querySelector('h1').textContent=headings[page][1]}
 if(page==='routes'){
  const search=document.querySelector('#search');const searchBox=document.createElement('div');searchBox.className='route-search-box';search.before(searchBox);searchBox.append(search);searchBox.insertAdjacentHTML('afterbegin',`<span class="search-icon">${icon('target')}</span>`);
  searchBox.insertAdjacentHTML('beforeend',`<span class="search-count">${BUSES.length} маршрутов</span>`);
 }
 if(page==='home'){
  const hero=document.querySelector('.hero');hero.querySelector('h1').innerHTML='Твой город.<br>Твой путь.<br><em>Твой AqylJol.</em>';
  hero.querySelector('p').textContent='Меньше ожидания, больше жизни. Выбирай удобный автобус и двигайся в своём ритме.';
  hero.querySelector('.hero-tag').innerHTML='<span></span> УМНЫЙ СПОСОБ БЫТЬ В ПУТИ';
  hero.querySelector('.city-art').classList.add('previous-art');
  hero.insertAdjacentHTML('beforeend',`<div class="brand-art" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="orbit orbit-three"></div><div class="brand-logo-tile"><img src="aqyljol-icon.svg" alt=""></div><div class="floating-route">${icon('bus')}<span><strong>Твоя линия</strong><small>Ближе с каждой минутой</small></span><b>↗</b></div><span class="art-coordinate">AQYLJOL / KAZAKHSTAN</span></div>`);
  document.querySelector('.today-label').innerHTML='<span class="live-dot"></span> В твоём ритме';
  const quick=document.querySelector('.quickgrid');quick.querySelectorAll('.quick').forEach((a,i)=>{a.insertAdjacentHTML('beforeend',`<small>${['Найти свою линию','Всё подскажет','Всегда под рукой'][i]}</small><span class="quick-arrow">↗</span>`)});
  document.querySelector('.planner-heading h2').textContent='Начнём с маршрута.';
 }
 // React to theme changes made by the existing settings screen.
 const themeMeta=document.querySelector('meta[name="theme-color"]');
 const setThemeMeta=()=>themeMeta?.setAttribute('content',document.documentElement.dataset.theme==='dark'?'#09172a':'#f4f7fb');
 setThemeMeta();new MutationObserver(setThemeMeta).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
});
