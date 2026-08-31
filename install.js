/* install.js — предложение установки PWA + регистрация service worker.
   Подключается на любой странице:  <script src="install.js"></script>

   Баннер показывается только там, где у <body> стоит data-install="banner".
   Service worker регистрируется везде (он же нужен Chrome, чтобы вообще
   прислать beforeinstallprompt).

   Отладка через console.js:
     localStorage.removeItem('fahrzeit.installDismissed')  — вернуть баннер
     localStorage.setItem('fahrzeit.installDebug','1')     — показывать всегда
*/
(function () {
  'use strict';

  var log = function () {
    try { console.log.apply(console, ['[pwa]'].concat([].slice.call(arguments))); } catch (e) {}
  };

  // ── service worker ────────────────────────────────────────
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(function () { log('service worker готов'); })
        .catch(function (e) { log('service worker не встал:', e.message); });
    });
  }

  if (document.body.dataset.install !== 'banner') {
    log('баннер на этой странице выключен');
    return;
  }

  var DEBUG = false;
  try { DEBUG = localStorage.getItem('fahrzeit.installDebug') === '1'; } catch (e) {}

  // Уже установлено — ничего не показываем
  var standalone = window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: fullscreen)').matches
    || window.navigator.standalone === true;
  if (standalone && !DEBUG) { log('уже запущено как приложение'); return; }

  // Закрыл крестиком — не надоедаем неделю
  var DISMISS_KEY = 'fahrzeit.installDismissed';
  var WEEK = 7 * 24 * 60 * 60 * 1000;
  if (!DEBUG) {
    try {
      var d = localStorage.getItem(DISMISS_KEY);
      if (d && Date.now() - parseInt(d, 10) < WEEK) {
        var left = Math.ceil((WEEK - (Date.now() - parseInt(d, 10))) / 86400000);
        log('баннер скрыт, ты закрыл его: осталось дней ' + left +
            '. Сброс: localStorage.removeItem("' + DISMISS_KEY + '")');
        return;
      }
    } catch (e) {}
  }

  // ── стили ─────────────────────────────────────────────────
  var css = document.createElement('style');
  css.textContent = [
    '.fz-install{',
    '  position:fixed;left:12px;right:12px;z-index:500;',
    '  bottom:calc(env(safe-area-inset-bottom,0px) + 14px);',
    '  display:none;align-items:center;gap:12px;box-sizing:border-box;',
    '  max-width:500px;margin:0 auto;',
    '  background:rgba(255,255,255,.92);color:#1a1a1a;',
    '  -webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);',
    '  border:1px solid rgba(0,0,0,.08);border-radius:18px;padding:12px 14px;',
    '  box-shadow:0 10px 34px rgba(0,0,0,.28);',
    '  font-family:sans-serif;',
    '  transform:translateY(160%);transition:transform .42s cubic-bezier(.32,1,.23,1);',
    '}',
    'body.dark .fz-install{background:rgba(30,30,30,.94);color:#e1e1e1;border-color:rgba(255,255,255,.12);}',
    '.fz-install.show{display:flex;transform:translateY(0);}',
    '.fz-ic{flex:none;width:34px;height:34px;display:grid;place-items:center;}',
    '.fz-tx{flex:1;min-width:0;}',
    '.fz-t{font-size:14.5px;font-weight:600;line-height:1.25;}',
    '.fz-s{font-size:11.5px;opacity:.6;margin-top:2px;line-height:1.3;}',
    '.fz-btn{flex:none;width:auto;height:auto;margin:0;padding:9px 15px;border:0;border-radius:12px;',
    '  background:var(--primary-color,#007bff);color:#fff;font-family:inherit;font-size:13px;',
    '  font-weight:600;cursor:pointer;display:block;}',
    '.fz-x{flex:none;width:26px;height:26px;margin:0;padding:0;border:0;background:none;',
    '  color:inherit;opacity:.45;font-size:15px;cursor:pointer;display:grid;place-items:center;}',
    '.fz-ov{position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,.62);',
    '  display:flex;align-items:flex-end;justify-content:center;padding:14px;',
    '  box-sizing:border-box;font-family:sans-serif;}',
    '.fz-sheet{background:#fff;color:#1a1a1a;border-radius:22px;padding:22px;',
    '  width:100%;max-width:480px;box-sizing:border-box;}',
    'body.dark .fz-sheet{background:#1e1e1e;color:#e1e1e1;}',
    '.fz-sheet h3{font-size:17px;font-weight:600;text-align:center;margin:0 0 18px;}',
    '.fz-step{display:flex;align-items:center;gap:12px;margin-bottom:13px;font-size:14px;line-height:1.35;opacity:.85;}',
    '.fz-n{width:32px;height:32px;flex:none;border-radius:10px;background:var(--primary-color,#007bff);',
    '  color:#fff;display:grid;place-items:center;font-weight:700;font-size:14px;}',
    '.fz-ok{width:100%;margin-top:8px;padding:13px;border:0;border-radius:14px;',
    '  background:var(--primary-color,#007bff);color:#fff;font-family:inherit;font-size:15px;',
    '  font-weight:600;cursor:pointer;display:block;}'
  ].join('\n');
  document.head.appendChild(css);

  // ── баннер ────────────────────────────────────────────────
  var bar = document.createElement('div');
  bar.className = 'fz-install';
  bar.innerHTML =
    '<div class="fz-ic">' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="currentColor">' +
      '<path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>' +
    '</div>' +
    '<div class="fz-tx">' +
      '<div class="fz-t">Fahrzeit installieren</div>' +
      '<div class="fz-s" id="fz-sub">Zum Startbildschirm hinzufügen</div>' +
    '</div>' +
    '<button class="fz-btn" id="fz-go" type="button">Installieren</button>' +
    '<button class="fz-x" id="fz-x" type="button" aria-label="Schließen">✕</button>';
  document.body.appendChild(bar);

  var $ = function (id) { return document.getElementById(id); };
  var show = function () { requestAnimationFrame(function () { bar.classList.add('show'); }); };
  var hide = function () { bar.classList.remove('show'); };

  $('fz-x').onclick = function () {
    hide();
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) {}
    log('баннер закрыт на неделю');
  };

  // ── платформа ─────────────────────────────────────────────
  var ua = navigator.userAgent;
  var isIOS = /iphone|ipad|ipod/i.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  if (isIOS) {
    // На iPhone установка возможна только из Safari
    var isSafari = /safari/i.test(ua) && !/crios|fxios|edgios|opios|chrome/i.test(ua);
    if (!isSafari && !DEBUG) {
      log('iOS, но не Safari — установить нельзя, баннер не показываем');
      return;
    }
    $('fz-sub').textContent = 'Über den Teilen-Button in Safari';
    $('fz-go').textContent = 'Wie?';
    $('fz-go').onclick = function () { guide('ios'); };
    setTimeout(show, 2000);
    log('iOS Safari — показываем инструкцию');
    return;
  }

  // ── Android / desktop Chrome ──────────────────────────────
  var deferred = null;
  var fired = false;

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    fired = true;
    deferred = e;
    log('предложение установки получено');
    $('fz-sub').textContent = 'Vollbild, ohne Adressleiste';
    $('fz-go').textContent = 'Installieren';
    $('fz-go').onclick = function () {
      deferred.prompt();
      deferred.userChoice.then(function (r) {
        log('выбор пользователя:', r && r.outcome);
        deferred = null;
        hide();
      });
    };
    setTimeout(show, 1500);
  });

  // Firefox, Samsung Internet и прочие не присылают beforeinstallprompt —
  // им показываем ручную инструкцию, а не молчим.
  setTimeout(function () {
    if (fired) return;
    log('браузер не прислал beforeinstallprompt — показываем ручную инструкцию');
    $('fz-sub').textContent = 'Über das Browser-Menü';
    $('fz-go').textContent = 'Wie?';
    $('fz-go').onclick = function () { guide('android'); };
    show();
  }, 5000);

  window.addEventListener('appinstalled', function () {
    hide();
    try { localStorage.removeItem(DISMISS_KEY); } catch (e) {}
    log('установлено');
  });

  // ── инструкция ────────────────────────────────────────────
  function guide(platform) {
    var steps = platform === 'ios'
      ? [
          'Tippe unten in Safari auf <b>Teilen</b> <span style="font-size:1.15em">&#x2934;</span>',
          'Wähle <b>Zum Home-Bildschirm</b>',
          'Tippe oben rechts auf <b>Hinzufügen</b>'
        ]
      : [
          'Öffne das Browser-Menü <b>⋮</b> oben rechts',
          'Wähle <b>App installieren</b> oder <b>Zum Startbildschirm zufügen</b>',
          'Bestätige mit <b>Installieren</b>'
        ];
    var title = platform === 'ios' ? 'Installation auf dem iPhone' : 'Installation auf Android';

    var ov = document.createElement('div');
    ov.className = 'fz-ov';
    ov.innerHTML =
      '<div class="fz-sheet">' +
        '<h3>' + title + '</h3>' +
        steps.map(function (t, i) {
          return '<div class="fz-step"><div class="fz-n">' + (i + 1) + '</div><div>' + t + '</div></div>';
        }).join('') +
        '<button class="fz-ok" type="button">Verstanden</button>' +
      '</div>';
    document.body.appendChild(ov);
    ov.querySelector('.fz-ok').onclick = function () { ov.remove(); };
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
  }
})();
