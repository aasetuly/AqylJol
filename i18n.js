/* AqylJol — язык интерфейса: русский / қазақша / English.
   Как работает: исходные тексты на сайте — русские. Этот модуль заменяет известные строки на выбранный язык
   и следит за изменениями страницы (MutationObserver). Если строки нет в словаре DICT — она остаётся по-русски.
   Чтобы перевести ещё что-то, добавьте строку: ['русский текст','қазақша','English'].
   Выбор хранится в localStorage (aq-ui-lang). API: AqylI18n.get() / .set('ru'|'kk'|'en') / .t('Текст {x}',{x:1}) */
(()=>{
'use strict';
const KEY='aq-ui-lang',LANGS=['ru','kk','en'];
const DICT=[
// навигация и шапка
['Главная','Басты бет','Home'],['Карта','Карта','Map'],['Маршруты','Маршруттар','Routes'],['Помощник','Көмекші','Assistant'],['Поездки','Сапарлар','Trips'],['О нас','Біз туралы','About us'],['Вопросы','Сұрақтар','FAQ'],['Настройки','Баптаулар','Settings'],['Водитель','Жүргізуші','Driver'],['Диспетчер','Диспетчер','Dispatcher'],
['ТВОЁ ПРОСТРАНСТВО','СЕНІҢ КЕҢІСТІГІҢ','YOUR SPACE'],['ГОРОДСКОЙ ТРАНСПОРТ','ҚАЛА КӨЛІГІ','CITY TRANSPORT'],['Казахстан','Қазақстан','Kazakhstan'],['ТВОЙ ГОРОД. ТВОЙ ПУТЬ.','СЕНІҢ ҚАЛАҢ. СЕНІҢ ЖОЛЫҢ.','YOUR CITY. YOUR WAY.'],
['Войти','Кіру','Sign in'],['Кошелёк','Әмиян','Wallet'],['Личный кабинет','Жеке кабинет','My account'],
['Легче с Aqyl.','Aqyl-мен жеңіл.','Easier with Aqyl.'],['Спросить помощника','Көмекшіден сұрау','Ask the assistant'],['Демо-версия · 16 городов','Демо-нұсқа · 16 қала','Demo version · 16 cities'],
['Город ближе, чем кажется.','Қала көрінгеннен де жақын.','The city is closer than it seems.'],['Сделано для твоего пути','Сенің жолың үшін жасалған','Made for your journey'],
['Выбрать город','Қаланы таңдау','Choose city'],
// заголовки страниц
['Настрой под себя','Өзіңе лайықта','Make it yours'],['Куда отправимся сегодня?','Бүгін қайда барамыз?','Where to today?'],['Маршруты твоего города','Қалаңдағы маршруттар','Routes in your city'],['Каждый маршрут — перед тобой','Әр маршрут — көз алдыңда','Every route at a glance'],['Твои поездки','Сенің сапарларың','Your trips'],['Диспетчерская','Диспетчерлік','Dispatch center'],['Кабинет водителя','Жүргізуші кабинеті','Driver cabinet'],
['01 / НАЧНИ СВОЙ ПУТЬ','01 / ЖОЛЫҢДЫ БАСТА','01 / START YOUR JOURNEY'],['02 / ГОРОД НА ЛАДОНИ','02 / ҚАЛА АЛАҚАНДА','02 / THE CITY AT HAND'],['03 / НАЙДИ СВОЮ ЛИНИЮ','03 / ӨЗ ЖЕЛІҢДІ ТАП','03 / FIND YOUR LINE'],['04 / РЯДОМ С ТОБОЙ','04 / САНЫМЕН БІРГЕ','04 / BY YOUR SIDE'],['05 / ВСЁ ПОД РУКОЙ','05 / БӘРІ ҚОЛЫҢДА','05 / ALL AT HAND'],['06 / НАША КОМАНДА','06 / БІЗДІҢ КОМАНДА','06 / OUR TEAM'],['07 / ТВОИ ПРАВИЛА','07 / СЕНІҢ ЕРЕЖЕҢ','07 / YOUR RULES'],['08 / ЗА РУЛЁМ','08 / ТІЗГІН ТЫҒЫНДА','08 / BEHIND THE WHEEL'],['09 / УПРАВЛЕНИЕ','09 / БАСҚАРУ','09 / MANAGEMENT'],['10 / ОТВЕТЫ','10 / ЖАУАПТАР','10 / ANSWERS'],
// главная
['Твой город.','Сенің қалаң.','Your city.'],['Твой путь.','Сенің жолың.','Your way.'],['Твой AqylJol.','Сенің AqylJol.','Your AqylJol.'],['Меньше ожидания, больше жизни. Выбирай удобный автобус и двигайся в своём ритме.','Күту аз, өмір көп. Ыңғайлы автобусты таңда да, өз ырғағыңмен жүр.','Less waiting, more living. Pick a convenient bus and move at your own pace.'],
['УМНЫЙ СПОСОБ БЫТЬ В ПУТИ','ЖОЛДА ЖҮРУДІҢ АҚЫЛДЫ ТӘСІЛІ','A SMARTER WAY TO TRAVEL'],['В твоём ритме','Сенің ырғағыңда','At your pace'],['Начнём с маршрута.','Маршруттан бастайық.','Let\'s start with a route.'],['Найти свою линию','Өз желіңді табу','Find your line'],['Всё подскажет','Бәрін айтып береді','Will tell you everything'],['Всегда под рукой','Әрдайым қолыңда','Always at hand'],
['Откуда','Қайдан','From'],['Куда','Қайда','To'],['Твоя линия','Сенің желің','Your line'],['Ближе с каждой минутой','Әр минут сайын жақын','Closer every minute'],
['Мои поездки','Менің сапарларым','My trips'],['Избранные маршруты','Таңдаулы маршруттар','Favorite routes'],['Мне нужен автобус','Маған автобус керек','I need a bus'],['Планы','Жоспарлар','Plans'],
['Свободных сидений','Бос орындар','Free seats'],['мин','мин','min'],['На карте','Картада','On map'],['В избранное','Таңдаулыға','Add to favorites'],['Убрать из избранного','Таңдаулыдан алып тастау','Remove from favorites'],['без пересадок','ауыспасыз','no transfers'],
// настройки
['Тема оформления','Безендіру тақырыбы','Theme'],['Светлая','Жарық','Light'],['Тёмная','Қараңғы','Dark'],['Авто','Авто','Auto'],['«Авто» следует теме устройства и меняется вместе с ней.','«Авто» құрылғы тақырыбына сәйкес өзгереді.','"Auto" follows your device theme.'],
['Язык помощника','Көмекші тілі','Assistant language'],['На каком языке Aqyl отвечает по умолчанию в разделе «Помощник».','«Көмекші» бөлімінде Aqyl әдепкі бойынша қай тілде жауап береді.','The language Aqyl uses by default in the Assistant section.'],['Русский','Русский','Русский'],['Қазақша','Қазақша','Қазақша'],
['Данные на этом устройстве','Осы құрылғыдағы деректер','Data on this device'],['Очистить избранное и заявки','Таңдаулы мен өтінімдерді тазалау','Clear favorites and requests'],['Настройки применяются сразу на всех страницах AqylJol и сохраняются локально на этом устройстве.','Баптаулар AqylJol барлық беттерінде бірден қолданылады және осы құрылғыда сақталады.','Settings apply instantly on all AqylJol pages and are stored on this device.'],
['Язык интерфейса','Интерфейс тілі','Interface language'],['Выберите язык приложения. Названия остановок и ответы помощника остаются на исходном языке.','Қолданба тілін таңдаңыз. Аялдама атаулары мен көмекші жауаптары бастапқы тілде қалады.','Choose the app language. Stop names and assistant replies stay in the original language.'],
['Уведомления','Хабарламалар','Notifications'],['Сообщим, что вы рядом с автобусом, и напомним о подъезде автобуса. По умолчанию включены.','Автобуспен жақын екеніңізді хабарлаймыз және автобус келе жатқанын еске саламыз. Әдепкі бойынша қосулы.','We\'ll tell you when you\'re near a bus and remind you when it\'s arriving. On by default.'],
['Разрешить','Рұқсат беру','Allow'],['Системные уведомления браузера разрешены.','Браузердің жүйелік хабарламаларына рұқсат берілген.','Browser system notifications are allowed.'],['Чтобы получать уведомления при свёрнутой вкладке, разрешите их в браузере.','Қойынды жиылғанда хабарлама алу үшін браузерде рұқсат беріңіз.','To get notifications when the tab is in the background, allow them in your browser.'],
['Рекомендуем','Ұсынамыз','Recommended'],['Автоматическая оплата','Автоматты төлем','Automatic payment'],['Пополнить','Толықтыру','Top up'],['Войдите в аккаунт, чтобы пользоваться автоплатой.','Автотөлемді пайдалану үшін аккаунтқа кіріңіз.','Sign in to use automatic payment.'],
['Точное определение местоположения','Орналасуды дәл анықтау','Precise location'],['Включить определение','Анықтауды қосу','Turn on detection'],['Выключить','Өшіру','Turn off'],['Проверка без выхода на улицу (демо)','Көшеге шықпай тексеру (демо)','Test without going outside (demo)'],['Выключено','Өшірулі','Off'],
['Определение выключено.','Анықтау өшірулі.','Detection is off.'],['Определяю местоположение…','Орналасуды анықтап жатырмын…','Locating you…'],['Браузер не поддерживает геолокацию.','Браузер геолокацияны қолдамайды.','Your browser does not support geolocation.'],['Доступ к геопозиции запрещён. Разрешите его в настройках браузера для этого сайта.','Геопозицияға тыйым салынған. Браузер баптауларында осы сайтқа рұқсат беріңіз.','Location access is blocked. Allow it in your browser settings for this site.'],
['Мои карты','Менің карталарым','My cards'],['Карт пока нет.','Әзірге карта жоқ.','No cards yet.'],['Оформить виртуальную карту','Виртуалды карта рәсімдеу','Get a virtual card'],['Добавить физическую карту','Физикалық карта қосу','Add a physical card'],['Показать QR','QR көрсету','Show QR'],['Удалить','Жою','Delete'],['Отвязать','Байланысты ажырату','Unlink'],
['Виртуальную карту создаёт диспетчер после проверки формы и документов. Физическая карта добавляется по номеру.','Виртуалды картаны диспетчер форма мен құжаттарды тексергеннен кейін жасайды. Физикалық карта нөмірі бойынша қосылады.','A dispatcher creates the virtual card after checking the form and documents. A physical card is added by number.'],
['Войдите в аккаунт, чтобы оформить или добавить карту.','Карта рәсімдеу немесе қосу үшін аккаунтқа кіріңіз.','Sign in to get or add a card.'],['ВИРТУАЛЬНАЯ КАРТА','ВИРТУАЛДЫ КАРТА','VIRTUAL CARD'],['Владелец','Иесі','Holder'],['Категория','Санат','Category'],
['На рассмотрении у диспетчера','Диспетчерде қарастырылуда','Under review by a dispatcher'],['Отклонена','Қабылданбады','Rejected'],
['Банковская карта','Банк картасы','Bank card'],['⚠ ТЕСТОВЫЙ РЕЖИМ: не вводите данные настоящей карты.','⚠ СЫНАҚ РЕЖИМІ: нақты картаның деректерін енгізбеңіз.','⚠ TEST MODE: do not enter real card details.'],['Привязать карту (тест)','Картаны байлау (сынақ)','Link a card (test)'],['Войдите в аккаунт, чтобы привязать карту.','Картаны байлау үшін аккаунтқа кіріңіз.','Sign in to link a card.'],['Карта не привязана. Её можно использовать для пополнения кошелька (демо).','Карта байланбаған. Әмиянды толықтыру үшін қолдануға болады (демо).','No card linked. It can be used to top up the wallet (demo).'],
['Привязать банковскую карту','Банк картасын байлау','Link a bank card'],['Номер карты','Карта нөмірі','Card number'],['Имя на карте (латиницей)','Картадағы аты (латынша)','Name on card (Latin letters)'],['Срок (ММ/ГГ)','Мерзімі (АА/ЖЖ)','Expiry (MM/YY)'],['Подставить тестовую карту','Сынақ картасын қою','Fill in test card'],['Привязать','Байлау','Link'],
['Виртуальная карта','Виртуалды карта','Virtual card'],['Дата рождения','Туған күні','Date of birth'],['Телефон','Телефон','Phone'],['Отправить диспетчеру','Диспетчерге жіберу','Send to dispatcher'],['Отмена','Бас тарту','Cancel'],['Готово','Дайын','Done'],['Назад','Артқа','Back'],['Закрыть','Жабу','Close'],['Добавить','Қосу','Add'],
['Добавить физическую карту','Физикалық карта қосу','Add a physical card'],['Не выбрано','Таңдалмаған','Not selected'],['Обработка…','Өңделуде…','Processing…'],
// кошелёк
['Баланс','Баланс','Balance'],['Оплатить NFC','NFC төлеу','Pay with NFC'],['Сканировать QR','QR сканерлеу','Scan QR'],['Поездки и оплаты','Сапарлар мен төлемдер','Trips and payments'],['Последние операции','Соңғы операциялар','Recent transactions'],['Операций пока нет.','Әзірге операция жоқ.','No transactions yet.'],['🚌 Оплатить по гос. номеру','🚌 Мемлекеттік нөмір бойынша төлеу','🚌 Pay by license plate'],['🚌 По гос. номеру','🚌 Мемлекеттік нөмір бойынша','🚌 By license plate'],
['Оплата по гос. номеру','Мемлекеттік нөмір бойынша төлем','Pay by license plate'],['Оплата проезда','Жол ақысын төлеу','Fare payment'],['К оплате','Төлеуге','To pay'],['Оплатить','Төлеу','Pay'],['Оплачено ✓','Төленді ✓','Paid ✓'],['Списано','Есептен шығарылды','Charged'],['Остаток','Қалдық','Balance left'],
['Подтвердите оплату','Төлемді растаңыз','Confirm payment'],['К оплате (фиксированная стоимость)','Төлеуге (тіркелген құн)','To pay (fixed fare)'],['Подтвердить оплату','Төлемді растау','Confirm payment'],['Стоимость проезда (фиксированная)','Жол ақысы (тіркелген)','Fare (fixed)'],['Стоимость проезда фиксирована и не зависит от кода.','Жол ақысы тіркелген және кодқа тәуелді емес.','The fare is fixed and does not depend on the code.'],
['Пополнение','Толықтыру','Top up'],['Выберите сумму (демо).','Соманы таңдаңыз (демо).','Choose an amount (demo).'],['Сканер QR','QR сканер','QR scanner'],['Нужен вход','Кіру қажет','Sign-in required'],['Позже','Кейінірек','Later'],['Где я','Мен қайдамын','Where am I'],['Сканировать QR для оплаты','Төлеу үшін QR сканерлеу','Scan QR to pay'],
['Автобус с таким номером не найден. Проверьте номер.','Мұндай нөмірлі автобус табылмады. Нөмірді тексеріңіз.','No bus with this number found. Check the number.'],['Не хватает {n}.','Жетіспейді: {n}.','Not enough: {n}.'],
// новые уведомления
['Вы рядом с автобусом №{n}','Сіз №{n} автобусының жанындасыз','You are near bus №{n}'],['Оплатить проезд — {sum}?','Жол ақысын төлеу — {sum}?','Pay the fare — {sum}?'],['Автооплата: автобус №{n}','Автотөлем: №{n} автобус','Auto-pay: bus №{n}'],['{sum} спишется через {s} с','{sum} {s} с ішінде есептен шығады','{sum} will be charged in {s} s'],['Отменить','Бас тарту','Cancel'],
['Оплачено {sum}','Төленді {sum}','Paid {sum}'],['Автобус №{n} · остаток {b}','№{n} автобус · қалдық {b}','Bus №{n} · balance {b}'],['Автобус №{n}','№{n} автобус','Bus №{n}'],['Автооплата не выполнена','Автотөлем орындалмады','Auto-pay failed'],['Недостаточно средств. Пополните кошелёк.','Қаражат жеткіліксіз. Әмиянды толықтырыңыз.','Not enough funds. Top up your wallet.'],
['Вы слишком далеко от автобуса.','Сіз автобустан тым алыстасыз.','You are too far from the bus.'],['Определяю местоположение… Включите геопозицию в Настройках или оплатите по QR / гос. номеру.','Орналасуды анықтап жатырмын… Баптауларда геопозицияны қосыңыз немесе QR / мемлекеттік нөмір арқылы төлеңіз.','Locating you… Enable location in Settings or pay by QR / license plate.'],['Автобус сейчас недоступен.','Автобус қазір қолжетімсіз.','The bus is unavailable right now.'],
['Низкая точность GPS (±{n} м). Выйдите на открытое место.','GPS дәлдігі төмен (±{n} м). Ашық жерге шығыңыз.','Low GPS accuracy (±{n} m). Move to an open area.'],['До автобуса: {d} м. Оплата активируется на расстоянии не более {m} м.','Автобусқа дейін: {d} м. Төлем {m} м-ден аспайтын қашықтықта іске қосылады.','Distance to bus: {d} m. Payment activates within {m} m.'],['Вы рядом с автобусом ({d} м). Можно оплачивать.','Сіз автобустың жанындасыз ({d} м). Төлеуге болады.','You are near the bus ({d} m). You can pay.'],
['Демо-режим: вы «стоите» рядом с автобусом №{n}.','Демо-режим: сіз №{n} автобусының жанында «тұрсыз».','Demo mode: you are "standing" near bus №{n}.'],['Работает. Точность сейчас: ±{n} м.','Жұмыс істеп тұр. Қазіргі дәлдік: ±{n} м.','Working. Current accuracy: ±{n} m.'],['Для оплаты нужна точность не хуже {m} м.','Төлем үшін дәлдік {m} м-ден нашар болмауы керек.','Payment needs accuracy of {m} m or better.'],
// поддержка / водитель
['Техподдержка','Техникалық қолдау','Support'],['Отправить в поддержку','Қолдауға жіберу','Send to support'],['Что случилось?','Не болды?','What happened?'],['Связь с диспетчером','Диспетчермен байланыс','Contact the dispatcher'],['Отправить диспетчеру','Диспетчерге жіберу','Send to dispatcher'],['Сообщение диспетчеру','Диспетчерге хабарлама','Message to dispatcher'],['Быстрые сообщения','Жылдам хабарламалар','Quick messages'],
['Начал движение','Қозғалысты бастадым','Started moving'],['Стою','Тұрмын','Stopped'],['Завершить смену','Ауысымды аяқтау','End shift'],['Причина остановки','Тоқтау себебі','Reason for stopping'],['Мои последние отметки','Менің соңғы белгілерім','My latest marks'],
// авторизация
['Добро пожаловать','Қош келдіңіз','Welcome'],['Создайте аккаунт','Аккаунт жасаңыз','Create an account'],['Войдите, чтобы сохранять маршруты и поездки.','Маршруттар мен сапарларды сақтау үшін кіріңіз.','Sign in to save routes and trips.'],['Продолжить с Google','Google арқылы жалғастыру','Continue with Google'],['ИЛИ','НЕМЕСЕ','OR'],['Имя','Аты','First name'],['Фамилия','Тегі','Last name'],['Почта','Пошта','Email'],['Пароль','Құпиясөз','Password'],['Показать','Көрсету','Show'],['Скрыть','Жасыру','Hide'],
['Создать аккаунт','Аккаунт жасау','Create account'],['Забыли пароль?','Құпиясөзді ұмыттыңыз ба?','Forgot password?'],['Нет аккаунта?','Аккаунт жоқ па?','No account?'],['Уже есть аккаунт?','Аккаунт бар ма?','Already have an account?'],['Зарегистрироваться','Тіркелу','Sign up'],['Продолжить без входа','Кірмей жалғастыру','Continue without signing in'],['Выйти','Шығу','Sign out'],['Подтвердите почту','Поштаны растаңыз','Confirm your email'],
['Категория пассажира','Жолаушы санаты','Passenger category'],['Получить карточку','Карточка алу','Get a card'],['Позвонить','Қоңырау шалу','Call'],['Написать в поддержку','Қолдауға жазу','Write to support'],['Оформить виртуальную карту','Виртуалды карта рәсімдеу','Get a virtual card'],
// футер и новости
['МЫ НА СВЯЗИ','БАЙЛАНЫСТАМЫЗ','STAY IN TOUCH'],['Найди нас в соцсетях','Бізді әлеуметтік желіде тап','Find us on social media'],['Новости, обновления и поддержка — там, где тебе удобно.','Жаңалықтар, жаңартулар және қолдау — өзіңе ыңғайлы жерде.','News, updates and support — wherever it suits you.'],
['НОВОСТИ И ОБНОВЛЕНИЯ','ЖАҢАЛЫҚТАР МЕН ЖАҢАРТУЛАР','NEWS AND UPDATES'],['Последние новости','Соңғы жаңалықтар','Latest news'],['Обновление','Жаңарту','Update'],['13 октября 2026','2026 жылғы 13 қазан','October 13, 2026'],['Масштабное обновление AqylJol','AqylJol-дың ауқымды жаңартуы','Major AqylJol update'],
['Масштабное обновление с изменениями, которые затронули интерфейс для пользователей: приложение стало удобнее, понятнее и аккуратнее.','Пайдаланушылар интерфейсін қамтыған ауқымды жаңарту: қолданба ыңғайлы, түсінікті және ұқыптырақ болды.','A major update that changed the interface for users: the app is now more convenient, clearer and neater.'],
['Кнопка QR для оплаты — на каждой вкладке','Төлемге арналған QR түймесі — әр қойындыда','QR payment button on every tab'],['Проезд стоит фиксированные 80 ₸','Жол ақысы тіркелген — 80 ₸','The fare is a fixed 80 ₸'],['Автоматическая оплата и уведомление «вы рядом с автобусом»','Автоматты төлем және «сіз автобустың жанындасыз» хабарламасы','Automatic payment and the "you are near the bus" alert'],['Оплата по гос. номеру автобуса','Автобустың мемлекеттік нөмірі бойынша төлем','Pay by the bus license plate'],
['Виртуальные карты: заявку с документами рассматривает диспетчер','Виртуалды карталар: құжаттармен өтінімді диспетчер қарайды','Virtual cards: a dispatcher reviews the application with documents'],['Привязка банковской карты (тестовый режим)','Банк картасын байлау (сынақ режимі)','Bank card linking (test mode)'],['Язык интерфейса: русский, қазақша, English','Интерфейс тілі: орысша, қазақша, English','Interface language: Russian, Kazakh, English'],['Водители могут написать диспетчеру прямо из кабинета','Жүргізушілер диспетчерге кабинеттен тікелей жаза алады','Drivers can message the dispatcher right from their cabinet'],['Обновлённый дизайн интерфейса','Жаңартылған интерфейс дизайны','Refreshed interface design'],
// FAQ и «О нас»
['Вопросы','Сұрақтар','FAQ'],['Ответы на частые вопросы','Жиі қойылатын сұрақтарға жауаптар','Answers to common questions'],['Будет ли скидка пенсионерам, студентам и школьникам?','Зейнеткерлерге, студенттерге және оқушыларға жеңілдік бола ма?','Will there be discounts for pensioners, students and schoolchildren?'],['Да, конечно. Скидка предоставляется пенсионерам, студентам и школьникам.','Иә, әрине. Зейнеткерлерге, студенттерге және оқушыларға жеңілдік беріледі.','Yes, of course. Discounts are provided for pensioners, students and schoolchildren.'],
['Будут ли карточки?','Карточкалар бола ма?','Will there be cards?'],['Да, карточки будут.','Иә, карточкалар болады.','Yes, there will be cards.'],['Где работает наше приложение?','Біздің қолданба қайда жұмыс істейді?','Where does our app work?'],['Будет ли оплата через QR-код?','QR-код арқылы төлем бола ма?','Will QR payment be available?'],['Да, оплату по QR-коду мы предусмотрели в кошельке AqylJol.','Иә, QR-код арқылы төлемді AqylJol әмиянында қарастырдық.','Yes, we have built QR payment into the AqylJol wallet.'],
['Будут ли уведомления о приближении автобуса?','Автобустың жақындағаны туралы хабарламалар бола ма?','Will there be bus arrival notifications?'],['Да, помощник может предупредить, когда нужный автобус подъезжает к вашей остановке.','Иә, көмекші керекті автобус аялдамаңызға жақындағанда ескерте алады.','Yes, the assistant can warn you when your bus approaches your stop.'],
['НЕ НАШЛИ ОТВЕТ?','ЖАУАП ТАБЫЛМАДЫ МА?','COULDN\'T FIND AN ANSWER?'],['Спросите помощника Aqyl.','Aqyl көмекшісінен сұраңыз.','Ask the Aqyl assistant.'],['Открыть помощника','Көмекшіні ашу','Open the assistant'],
['Команда AqylJol','AqylJol командасы','The AqylJol team'],['СТУДЕНТЫ КОЛЛЕДЖА APEC','APEC КОЛЛЕДЖІНІҢ СТУДЕНТТЕРІ','APEC COLLEGE STUDENTS'],['Наша команда','Біздің команда','Our team'],['Наша идея','Біздің идея','Our idea'],['Почему AqylJol?','Неге AqylJol?','Why AqylJol?'],['Индекс комфорта','Ыңғайлылық индексі','Comfort index'],['Свободные места','Бос орындар','Free seats'],['Умный помощник','Ақылды көмекші','Smart assistant'],['Поездка от А до Б','А-дан Б-ға дейінгі сапар','Trip from A to B'],['Вернуться на главную','Басты бетке оралу','Back to home'],
// диспетчерская
['Люди','Адамдар','People'],['Автобусы','Автобустар','Buses'],['Поддержка','Қолдау','Support'],['Карты','Карталар','Cards'],['Журнал','Журнал','Log'],['Заявки на виртуальную карту','Виртуалды картаға өтінімдер','Virtual card applications'],['Создать виртуальную карту','Виртуалды карта жасау','Create virtual card'],['Отклонить','Қабылдамау','Reject'],['Обращения в поддержку','Қолдауға жүгінулер','Support requests'],['Ответить','Жауап беру','Reply'],['Решено','Шешілді','Resolved'],
['Всего','Барлығы','Total'],['Водителей','Жүргізушілер','Drivers'],['Диспетчеров','Диспетчерлер','Dispatchers'],['Заблок.','Бұғатталған','Blocked'],['Заблокировать','Бұғаттау','Block'],['Разблокировать','Бұғаттан шығару','Unblock'],['Назначить водителем','Жүргізуші етіп тағайындау','Make driver'],['Пассажир','Жолаушы','Passenger'],['Главный диспетчер','Бас диспетчер','Chief dispatcher'],['Водители','Жүргізушілер','Drivers'],['Диспетчеры','Диспетчерлер','Dispatchers'],['Заблокированные','Бұғатталғандар','Blocked'],['Все','Барлығы','All']
];

const MAP=new Map();                // ru -> {kk,en}
for(const [ru,kk,en] of DICT)MAP.set(ru,{kk,en});
const PATTERNS=[                    // строки с числами
 [/^(\d+) остановок$/,(m)=>({kk:m[1]+' аялдама',en:m[1]+' stops'})],
 [/^(\d+) остановки$/,(m)=>({kk:m[1]+' аялдама',en:m[1]+' stops'})],
 [/^(\d+) остановка$/,(m)=>({kk:m[1]+' аялдама',en:m[1]+' stop'})],
 [/^(\d+) мин пешком$/,(m)=>({kk:m[1]+' мин жаяу',en:m[1]+' min walk'})],
 [/^(\d+) пересадка$/,(m)=>({kk:m[1]+' ауысу',en:m[1]+' transfer'})],
 [/^(\d+) маршрутов$/,(m)=>({kk:m[1]+' маршрут',en:m[1]+' routes'})]
];
let lang='ru';
try{const v=localStorage.getItem(KEY);if(LANGS.includes(v))lang=v}catch{}

function tr(ru,l){
 if(l==='ru')return ru;
 const e=MAP.get(ru);if(e&&e[l])return e[l];
 for(const [re,f] of PATTERNS){const m=re.exec(ru);if(m){const r=f(m);if(r[l])return r[l]}}
 return ru;
}
const fill=(s,p)=>String(s).replace(/\{(\w+)\}/g,(m,x)=>p&&x in p?p[x]:m);
function t(ru,p){return fill(tr(ru,lang),p)}

/* ---------- перевод страницы ---------- */
const texts=new WeakMap(),attrs=new WeakMap();
const ATTRS=['placeholder','aria-label','title','alt'];
const SKIP=new Set(['SCRIPT','STYLE','TEXTAREA','CODE','NOSCRIPT']);
function txt(node){
 const cur=node.nodeValue;if(!cur||!cur.trim())return;
 let rec=texts.get(node);
 if(!rec||(cur!==rec.out&&cur!==rec.ru))rec={ru:cur,out:cur};
 const lead=rec.ru.match(/^\s*/)[0],tail=rec.ru.match(/\s*$/)[0],core=rec.ru.trim();
 const out=lang==='ru'?rec.ru:lead+tr(core,lang)+tail;
 if(out!==cur)node.nodeValue=out;
 rec.out=out;texts.set(node,rec);
}
function attr(el){
 for(const a of ATTRS){
  const cur=el.getAttribute(a);if(cur==null||!cur.trim())continue;
  let m=attrs.get(el);if(!m)attrs.set(el,m={});
  let rec=m[a];if(!rec||(cur!==rec.out&&cur!==rec.ru))rec={ru:cur,out:cur};
  const out=lang==='ru'?rec.ru:tr(rec.ru.trim(),lang);
  if(out!==cur)el.setAttribute(a,out);
  rec.out=out;m[a]=rec;
 }
}
function walk(root){
 if(!root)return;
 if(root.nodeType===3){if(root.parentElement&&!skip(root.parentElement))txt(root);return}
 if(root.nodeType!==1||skip(root))return;
 attr(root);
 for(const n of root.childNodes)walk(n);
}
const skip=el=>SKIP.has(el.tagName)||(el.closest&&el.closest('[data-no-i18n]'));
function titleTr(){
 const m=/^(AqylJol — )(.+)$/.exec(document.title);
 if(!m){return}
 const pages={'Главная':['Басты бет','Home'],'Карта':['Карта','Map'],'Маршруты':['Маршруттар','Routes'],'Помощник':['Көмекші','Assistant'],'Поездки':['Сапарлар','Trips'],'О нас':['Біз туралы','About us'],'Вопросы':['Сұрақтар','FAQ'],'Настройки':['Баптаулар','Settings'],'Диспетчерская':['Диспетчерлік','Dispatch center'],'Кабинет водителя':['Жүргізуші кабинеті','Driver cabinet']};
 const ru=document.documentElement.dataset.titleRu||m[2];
 if(!document.documentElement.dataset.titleRu)document.documentElement.dataset.titleRu=m[2];
 const p=pages[ru];
 document.title='AqylJol — '+(lang==='ru'||!p?ru:p[lang==='kk'?0:1]);
}
let queued=false;
function schedule(nodes){
 for(const n of nodes)pend.add(n);
 if(queued)return;queued=true;
 requestAnimationFrame(()=>{queued=false;const list=[...pend];pend.clear();obs.disconnect();try{for(const n of list)walk(n)}finally{observe()}});
}
const pend=new Set();
const obs=new MutationObserver(ms=>{
 const nodes=[];
 for(const m of ms){
  if(m.type==='childList')m.addedNodes.forEach(n=>nodes.push(n));
  else if(m.type==='characterData')nodes.push(m.target);
  else if(m.type==='attributes')nodes.push(m.target);
 }
 if(nodes.length)schedule(nodes);
});
function observe(){obs.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:ATTRS})}
function apply(){document.documentElement.lang=lang==='kk'?'kk':lang;obs.disconnect();walk(document.body);titleTr();observe()}

function set(l){
 if(!LANGS.includes(l)||l===lang)return;
 lang=l;try{localStorage.setItem(KEY,l)}catch{}
 apply();window.dispatchEvent(new CustomEvent('aq-lang',{detail:{lang:l}}));
}
window.AqylI18n={get:()=>lang,set,t,tr:(s)=>tr(s,lang)};

function start(){apply()}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start):start();
})();
