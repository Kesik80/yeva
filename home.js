/* home.js — кнопка «все игры» на стартовом окне.

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
