/* home.js — переходы внутри YEVA и кнопка «все игры» на стартовом окне.

   ── Про переходы ───────────────────────────────────────────────────
   Установленное приложение само себя закрывает только пока в истории
   окна ровно одна запись — так решает Chrome, и смотрит он на общее
   число записей, а не на то, где ты сейчас стоишь. Поэтому «назад» с
   клавиши не помогает: запись о игре остаётся впереди, и кнопка
   «закрыть» получает отказ. Укоротить историю нечем — проверено.

   Значит, история не должна расти вовсе: каждый переход внутри YEVA
   идёт заменой страницы (location.replace), а не добавлением записи.
   Скрипт перехватывает щелчки по обычным ссылкам, так что в играх
   ничего править не нужно.

   Кнопка-домик при этом работает как «назад»: если возвращаться есть
   куда — возвращается, если нет (а так и будет) — заменой уходит в
   меню. Снаружи разницы не видно, зато «закрыть» работает всегда.

   ── Про кнопку на стартовом окне ───────────────────────────────────
   В играх кнопка «домой» стоит в верхней полосе, но стартовое окно
   (.veil) накрывает её собой: оно во весь экран и лежит выше. Выходило,
   что ровно там, где ребёнок оказывается при входе в игру и после
   каждого проигрыша, выхода нет вовсе — только кнопка «играть».

   Скрипт вешает кнопку внутрь самого окна, поэтому она видна тогда же,
   когда и окно, и прячется вместе с ним.

   Подключать последней строкой перед console.js:
       <script src="home.js"></script>
*/
(function () {
  'use strict';

  /* ══ переходы без роста истории ══ */

  // «назад»: если в истории есть куда возвращаться — назад, иначе
  // заменой в меню. Поведение одно и то же, видимой разницы нет.
  var MENU = /(^|\/)index\.html$|\/$/;

  /* «Назад» = в меню, но без истории.

     Настоящий history.back() сюда не годится: он уводит на ТУ запись,
     что лежит позади, а это не обязательно меню. Записи могли остаться
     от прежней сборки или от того, как приложение запустили, — и тогда
     кнопка выносит ребёнка за пределы YEVA, на пустую страницу или в
     браузер. Проверено: в тесте ровно так и вышло.

     Замена страницы делает то же самое, что ожидается от «назад» —
     возвращает в меню, — и при этом история не растёт и не теряется. */
  function back() { location.replace('index.html'); }
  window.YEVA_BACK = back;
  window.YEVA_GO = function (url) { location.replace(url); };

  function ours(a) {
    if (!a || !a.getAttribute) return false;
    var raw = a.getAttribute('href');
    if (!raw || raw.charAt(0) === '#') return false;
    if (/^(javascript|mailto|tel|sms):/i.test(raw)) return false;
    if (a.target && a.target !== '_self') return false;
    if (a.hasAttribute('download')) return false;
    return a.href.indexOf(location.origin + '/') === 0;
  }

  // Висим на всплытии, а не на перехвате: если страница обработала щелчок
  // сама (как карточки в меню — они ещё просят полный экран), не мешаем.
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!ours(a)) return;
    e.preventDefault();
    // ссылка в меню = «назад», остальные — обычной заменой
    if (MENU.test(a.pathname)) back();
    else location.replace(a.href);
  });

  var CSS =
    '.yv-home{position:fixed;z-index:9;' +
    'left:calc(env(safe-area-inset-left,0px) + 14px);' +
    'top:calc(env(safe-area-inset-top,0px) + 14px);' +
    'width:58px;height:58px;border-radius:50%;' +
    'display:grid;place-items:center;text-decoration:none;' +
    'background:rgba(255,255,255,.95);color:#2A3A44;' +
    'box-shadow:0 8px 22px rgba(20,40,55,.32);' +
    '-webkit-tap-highlight-color:transparent;transition:transform .12s}' +
    '.yv-home:active{transform:scale(.9)}' +
    '.yv-home svg{width:31px;height:31px;fill:none;stroke:currentColor;' +
    'stroke-width:2.1;stroke-linecap:round;stroke-linejoin:round}' +
    /* в альбомной ориентации панель занимает почти весь экран — ужимаем */
    '@media (max-height:560px){.yv-home{width:46px;height:46px;' +
    'left:calc(env(safe-area-inset-left,0px) + 9px);' +
    'top:calc(env(safe-area-inset-top,0px) + 9px)}' +
    '.yv-home svg{width:25px;height:25px}}';

  var ICON = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M4 11l8-7 8 7"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/></svg>';

  function put() {
    var veils = document.querySelectorAll('.veil');
    if (!veils.length) return;
    if (!document.getElementById('yv-home-css')) {
      var st = document.createElement('style');
      st.id = 'yv-home-css';
      st.textContent = CSS;
      (document.head || document.documentElement).appendChild(st);
    }
    Array.prototype.forEach.call(veils, function (v) {
      if (v.querySelector('.yv-home')) return;
      var a = document.createElement('a');
      a.className = 'yv-home';
      a.href = 'index.html';
      a.setAttribute('aria-label', 'Все игры');
      a.innerHTML = ICON;
      v.appendChild(a);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', put);
  else put();
})();
