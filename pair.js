/* pair.js — общий движок игр «послушай и выбери из двух».

   Две игры устроены одинаково: на экране две карточки, голос называет
   одну из них по-немецки, ребёнок выбирает. Разница только в том, что
   за пары:

     eins-viele.html  — один и много: die Katze против die Katzen
     gegenteil.html   — противоположности: groß против klein

   Разметка должна содержать те же id, что в eins-viele.html: stars,
   score, btnAgain, listen, left, right, say, veil, stats, btnStart,
   party. Запуск — одной строкой:

       YEVA_PAIR.start({ game: 'gegen' });
*/
(function () {
  'use strict';

  function start(cfg) {
    cfg = cfg || {};
    const GAME = cfg.game === 'gegen' ? 'gegen' : 'plural';

    const $ = id => document.getElementById(id);
    const YW = window.YEVA_WORDS;
    if (!YW || !YW.plural || !YW.gegen) {
      document.body.innerHTML = '<div style="padding:40px;text-align:center;font-family:sans-serif">' +
        'Нужен words.js версии 14</div>';
      return;
    }

    const CFG = { goal: 8, voice: 'voice/de/', many: 3 };
    const K_STATS = 'yeva.' + (GAME === 'gegen' ? 'gegenteil' : 'einsviele') + '.stats';

    const irand = n => Math.floor(Math.random() * n);
    const pick = a => a[irand(a.length)];

    const store = {
      get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
      set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    };

    let left = null, right = null, ask = null;
    let done = 0, locked = true, wrongs = 0, hintT = 0, lastKey = '';

    /* ── статистика ── */
    const today = () => {
      const d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
             '-' + String(d.getDate()).padStart(2, '0');
    };
    let stats = (() => {
      try { return JSON.parse(store.get(K_STATS, '')) || null; } catch (e) { return null; }
    })() || { ok: 0, bad: 0, days: {}, tasks: {} };
    const ses = { ok: 0, bad: 0 };

    function bump(kind) {
      stats[kind] = (stats[kind] || 0) + 1;
      ses[kind]++;
      const d = stats.days[today()] || (stats.days[today()] = { ok: 0, bad: 0 });
      d[kind]++;
      const t = stats.tasks[ask.word.de] || (stats.tasks[ask.word.de] = { ok: 0, bad: 0 });
      t[kind]++;
      const keep = Object.keys(stats.days).sort().slice(-30);
      const days = {};
      keep.forEach(k => { days[k] = stats.days[k]; });
      stats.days = days;
      try { store.set(K_STATS, JSON.stringify(stats)); } catch (e) {}
      paintScore();
    }

    function paintScore() {
      $('score').innerHTML = '<span class="ok">✓ ' + ses.ok + '</span>' +
                             '<span class="bad">✕ ' + ses.bad + '</span>';
    }

    function paintStats() {
      const d = stats.days[today()] || { ok: 0, bad: 0 };
      const hard = Object.keys(stats.tasks)
        .filter(k => stats.tasks[k].bad > 0)
        .sort((x, y) => stats.tasks[y].bad - stats.tasks[x].bad)
        .slice(0, 3);
      let h = '';
      if (!stats.ok && !stats.bad) {
        h = 'Пока ни одного ответа — счёт появится после первой игры';
      } else {
        h = 'Сегодня: <b>' + d.ok + '</b> верных · <b>' + d.bad + '</b> мимо<br>' +
            'Всего: <b>' + stats.ok + '</b> верных · <b>' + stats.bad + '</b> мимо';
        if (hard.length) {
          h += '<div class="hard">труднее всего: ' + hard.join(', ') +
               '<br>такие слова выпадают чаще</div>';
        }
        h += '<button id="btnClear">очистить статистику</button>';
      }
      $('stats').innerHTML = h;
    }

    $('stats').addEventListener('click', e => {
      if (!e.target.closest('#btnClear')) return;
      stats = { ok: 0, bad: 0, days: {}, tasks: {} };
      ses.ok = 0; ses.bad = 0;
      try { store.set(K_STATS, JSON.stringify(stats)); } catch (e2) {}
      paintStats(); paintScore();
    });

    /* ── что показываем ── */
    const PAIRS = GAME === 'gegen' ? YW.gegen : YW.plural;

    function weightOf(key) {
      const t = stats.tasks[key] || { ok: 0, bad: 0 };
      const v = (1 + 1.8 * (t.bad || 0)) / (1 + 0.7 * (t.ok || 0));
      return Math.max(0.15, Math.min(3, v));
    }

    // пара целиком весит столько, сколько её трудная половина
    function nextPair() {
      let list = PAIRS.filter(p => keyOf(p) !== lastKey);
      if (!list.length) list = PAIRS;
      let total = 0;
      const ws = list.map(p => {
        const v = GAME === 'gegen'
          ? Math.max(weightOf(p[0].de), weightOf(p[1].de))
          : Math.max(weightOf(p.one), weightOf(p.de));
        total += v; return v;
      });
      let r = Math.random() * total;
      for (let i = 0; i < list.length; i++) { r -= ws[i]; if (r <= 0) return list[i]; }
      return list[list.length - 1];
    }

    const keyOf = p => (GAME === 'gegen' ? p[0].de : p.de);

    // две карточки пары: что нарисовать и какое слово за этим стоит
    function sides(p) {
      if (GAME === 'gegen') {
        return [
          { word: p[0], html: '<span class="one">' + p[0].e + '</span>' },
          { word: p[1], html: '<span class="one">' + p[1].e + '</span>' }
        ];
      }
      // единственное — одна картинка, множественное — несколько
      let many = '';
      for (let i = 0; i < CFG.many; i++) many += '<span>' + p.e + '</span>';
      return [
        { word: { de: p.one, ru: p.ru, e: p.e }, html: '<span class="one">' + p.e + '</span>' },
        { word: p, html: '<span class="many">' + many + '</span>' }
      ];
    }

    /* ── звук ── */
    let actx = null, master = null;
    const vBuf = {}, vBad = {}, vHot = {};

    function initAudio() {
      if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      actx = new AC();
      master = actx.createGain();
      master.gain.value = 0.32;
      master.connect(actx.destination);
    }

    const vUrl = w => CFG.voice + YW.slug(w) + '.mp3';

    function load(w) {
      if (!actx || !w) return;
      const u = vUrl(w);
      if (vBuf[u] || vBad[u] || vHot[u]) return;
      vHot[u] = 1;
      fetch(u)
        .then(r => r.ok ? r : fetch(u + '?v=' + Date.now(), { cache: 'no-store' }))
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
        .then(ab => actx.decodeAudioData(ab))
        .then(buf => { vBuf[u] = buf; })
        .catch(e => { vBad[u] = true; console.warn('[voice] нет ' + u + ' — ' + e.message); });
    }

    function say(w) {
      if (!w) return;
      load(w);
      const u = vUrl(w);
      let tries = 0;
      (function wait() {
        if (vBuf[u]) {
          const src = actx.createBufferSource(), g = actx.createGain();
          g.gain.value = 1.25;
          src.buffer = vBuf[u];
          src.connect(g); g.connect(master);
          src.start();
          return;
        }
        if (vBad[u]) { speak(w); return; }
        if (tries++ < 10) { setTimeout(wait, 120); return; }
        speak(w);
      })();
    }

    // Пока записи нет, читает системный голос. Для этих двух игр это
    // важнее обычного: слова новые, и до первой озвучки игра иначе
    // была бы немой.
    function speak(w) {
      try {
        if (typeof speechSynthesis === 'undefined') return;
        speechSynthesis.cancel();
        const ut = new SpeechSynthesisUtterance(w.de);
        ut.lang = 'de-DE'; ut.rate = 0.9; ut.pitch = 1.1;
        speechSynthesis.speak(ut);
      } catch (e) {}
    }

    function tone(type, freq, at, dur, vol, to) {
      if (!actx) return;
      const t = actx.currentTime + at;
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur * 0.9);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + dur + 0.03);
    }
    const yay = () => [0, 4, 7, 12].forEach((n, i) => tone('triangle', 523.25 * Math.pow(2, n / 12), i * 0.07, 0.4, 0.3));
    const nope = () => { tone('sine', 300, 0, 0.16, 0.2, 240); tone('sine', 240, 0.15, 0.24, 0.18, 190); };
    const fanfare = () => [0, 4, 7, 12, 7, 12, 16].forEach((n, i) => tone('triangle', 392 * Math.pow(2, n / 12), i * 0.12, 0.42, 0.33));
    const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };

    /* ── раунд ── */
    function round() {
      clearTimeout(hintT);
      wrongs = 0;
      const p = nextPair();
      lastKey = keyOf(p);
      const two = sides(p);
      // стороны меняются местами, иначе ответ угадывался бы по месту
      if (Math.random() < 0.5) two.reverse();
      left = two[0]; right = two[1];
      ask = Math.random() < 0.5 ? left : right;

      $('left').innerHTML = left.html + '<b>' + left.word.de + '</b>';
      $('right').innerHTML = right.html + '<b>' + right.word.de + '</b>';
      document.querySelectorAll('.pick').forEach(c => {
        c.classList.remove('wrong', 'right', 'hint', 'show');
      });
      $('say').textContent = '';

      locked = false;
      say(ask.word);
      [left.word, right.word].forEach(load);
      hintT = setTimeout(showHint, 9000);
    }

    function showHint() {
      const el = ask === left ? $('left') : $('right');
      if (el) el.classList.add('hint');
    }

    function tap(el) {
      if (locked) return;
      const side = el.id === 'left' ? left : right;

      if (side !== ask) {
        wrongs++;
        el.classList.remove('wrong');
        void el.offsetWidth;
        el.classList.add('wrong');
        setTimeout(() => el.classList.remove('wrong'), 420);
        nope(); buzz(40);
        bump('bad');
        $('say').textContent = 'послушай ещё раз';
        setTimeout(() => say(ask.word), 320);
        if (wrongs >= 2) showHint();
        return;
      }

      locked = true;
      clearTimeout(hintT);
      el.classList.add('right', 'show');
      el.classList.remove('hint');
      $('say').textContent = ask.word.de + (ask.word.ru ? ' · ' + ask.word.ru : '');
      yay(); buzz(30);
      bump('ok');
      setTimeout(() => say(ask.word), 360);

      done++;
      paintStars();
      const next = () => { if (done >= CFG.goal) party(); else round(); };
      setTimeout(next, 1700);
    }

    $('left').addEventListener('click', () => tap($('left')));
    $('right').addEventListener('click', () => tap($('right')));
    $('listen').addEventListener('click', () => { initAudio(); if (ask) say(ask.word); });
    $('btnAgain').addEventListener('click', () => { initAudio(); if (ask) say(ask.word); });

    /* ── звёзды и салют ── */
    function paintStars() {
      let h = '';
      for (let i = 0; i < CFG.goal; i++) h += '<i class="' + (i < done ? 'on' : '') + '"></i>';
      $('stars').innerHTML = h;
    }

    function party() {
      fanfare(); buzz([20, 60, 20, 60, 40]);
      const box = $('party');
      const colors = ['#FFD86E', '#E8782F', '#8FD3FF', '#7FC8A9', '#C98BE0'];
      for (let i = 0; i < 70; i++) {
        const c = document.createElement('i');
        c.style.left = (Math.random() * 100) + 'vw';
        c.style.background = colors[i % colors.length];
        c.style.animationDuration = (1.8 + Math.random() * 1.6) + 's';
        c.style.animationDelay = (Math.random() * 0.7) + 's';
        box.appendChild(c);
      }
      setTimeout(() => { box.innerHTML = ''; }, 4200);
      done = 0;
      paintStars();
      setTimeout(round, 3200);
    }

    /* ── старт ── */
    function goFullscreen() {
      // Установленная игра и так во весь экран. Запрос полноэкранного режима
      // добавляет только системную подсказку «проведите сверху вниз и нажмите
      // Назад» — ребёнок её не уберёт.
      try {
        if ((window.matchMedia && (matchMedia('(display-mode: fullscreen)').matches ||
             matchMedia('(display-mode: standalone)').matches)) || navigator.standalone) return;
      } catch (e) {}
      const el = document.documentElement;
      const fn = el.requestFullscreen || el.webkitRequestFullscreen;
      if (!fn || document.fullscreenElement) return;
      try {
        const p = fn.call(el, { navigationUI: 'hide' });
        if (p && p.catch) p.catch(() => {});
      } catch (e) {}
    }

    $('btnStart').addEventListener('click', () => {
      goFullscreen();
      initAudio();
      $('veil').classList.add('hidden');
      done = 0;
      paintStars();
      round();
    });

    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('gesturestart', e => e.preventDefault());
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && actx && actx.state === 'suspended') actx.resume();
    });

    paintStars();
    paintScore();
    paintStats();
  }

  window.YEVA_PAIR = { start: start };
})();
