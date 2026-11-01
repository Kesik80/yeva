/* math.js — общий движок счётных игр YEVA.

   Сложение и вычитание устроены одинаково: пример из кубиков, три ответа,
   немецкая фраза целиком, пересчёт вслух как подсказка, ряд звёзд и
   коллекция друзей. Разница только в знаке, в том, как считается ответ,
   и в том, что происходит с фигурками после верного ответа:
   в сложении они съезжаются в одну, в вычитании лишние кубики улетают.

   Поэтому логика живёт здесь, а plus.html и minus.html — это разметка,
   свои цвета и одна строка запуска:

       YEVA_MATH.start({ op: 'minus' });

   Разметка должна содержать те же id, что и plus.html: stars, score,
   btnAgain, g1, opSign, g2, opEq, ans, digits, say, choices, veil, stats,
   zoo, zooText, sizes, btnStart, poof, party, prize.
*/
(function () {
  'use strict';

  function start(cfg) {
    cfg = cfg || {};
    const OP = cfg.op === 'minus' ? 'minus' : 'plus';
    const SUB = OP === 'minus';
    const SIGN = SUB ? '−' : '+';        // настоящий минус, не дефис

    const $ = id => document.getElementById(id);
    const YW = window.YEVA_WORDS;
    if (!YW || !YW.numbers || !YW.math) {
      document.body.innerHTML = '<div style="padding:40px;text-align:center;font-family:sans-serif">' +
        'Нужен words.js версии 13</div>';
      return;
    }

    const CFG = { goal: 8, gap: 0.07, voice: 'voice/de/' };
    const SIZES = [5, 10, 20];
    const K = 'yeva.' + OP + '.';
    const K_MAX = K + 'max';

    const rand = (a0, b0) => a0 + Math.random() * (b0 - a0);
    const irand = (a0, b0) => Math.floor(rand(a0, b0 + 1));
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];

    // числа 0–50 одним списком + связки
    const NUM = {};
    (YW.numbers || []).concat(YW.numbersBig || []).forEach(w => { NUM[w.num] = w; });
    const WOP = YW.math.find(w => w.de === OP);
    const WEQ = YW.math.find(w => w.de === 'ist gleich');

    // целые фразы «eins plus eins ist gleich» — по записи на каждый пример
    const PHRASE = {};
    ((SUB ? YW.minus : YW.plus) || []).forEach(p => { PHRASE[p.a + '_' + p.b] = p; });

    // ответ примера: это единственное место, где складывают или вычитают
    const result = (x, y) => (SUB ? x - y : x + y);

    let max = 10, a = 1, b = 1, sum = 2, done = 0, locked = true, wrongs = 0, hintT = 0, cube = 40;

    const store = {
      get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
      set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    };

    /* ── статистика: сколько верно и сколько мимо ── */
    const K_STATS = K + 'stats';
    const today = () => {
      const d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
             '-' + String(d.getDate()).padStart(2, '0');
    };
    let stats = (() => {
      try { return JSON.parse(store.get(K_STATS, '')) || null; } catch (e) { return null; }
    })() || { ok: 0, bad: 0, days: {}, tasks: {} };
    const ses = { ok: 0, bad: 0 };

    const taskKey = (x, y) => x + SIGN + y;

    function bump(kind) {
      stats[kind] = (stats[kind] || 0) + 1;
      ses[kind]++;
      const d = stats.days[today()] || (stats.days[today()] = { ok: 0, bad: 0 });
      d[kind]++;
      const key = taskKey(a, b);
      const t = stats.tasks[key] || (stats.tasks[key] = { ok: 0, bad: 0 });
      t[kind]++;
      // дольше месяца дни не храним, незачем
      const keep = Object.keys(stats.days).sort().slice(-30);
      const days = {};
      keep.forEach(k2 => { days[k2] = stats.days[k2]; });
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
        .filter(k2 => stats.tasks[k2].bad > 0)
        .sort((x, y) => stats.tasks[y].bad - stats.tasks[x].bad)
        .slice(0, 3);
      let h = '';
      if (!stats.ok && !stats.bad) {
        h = 'Пока ни одного ответа — счёт появится после первой игры';
      } else {
        h = 'Сегодня: <b>' + d.ok + '</b> верных · <b>' + d.bad + '</b> мимо<br>' +
            'Всего: <b>' + stats.ok + '</b> верных · <b>' + stats.bad + '</b> мимо';
        if (hard.length) {
          h += '<div class="hard">труднее всего: ' +
               hard.map(k2 => k2 + ' (' + stats.tasks[k2].bad + ')').join(', ') +
               '<br>такие примеры выпадают чаще</div>';
        }
        h += '<button id="btnClear">очистить статистику</button>';
      }
      $('stats').innerHTML = h;
    }

    /* ── коллекция: за каждый собранный ряд звёзд приходит новый друг ──
       Счёт ответов — для взрослого. Ребёнку нужно что-то своё, что копится
       и остаётся: двадцать фигурок, по одной за ряд. */
    const K_ZOO = K + 'zoo';
    const ZOO_MAX = 20;
    let zoo = Math.max(0, Math.min(ZOO_MAX, parseInt(store.get(K_ZOO, '0'), 10) || 0));

    function earn() {
      if (zoo >= ZOO_MAX) return 0;
      zoo++;
      store.set(K_ZOO, String(zoo));
      return zoo;
    }

    // поставить фигурку в коробку заданной высоты: высокие получают кубик помельче
    function fitBlock(el, boxPx) {
      if (!el || !window.YEVA_BLOCKS) return;
      const rows = +el.getAttribute('data-rows') || 1;
      YEVA_BLOCKS.size(el, Math.max(4, Math.round(boxPx / rows)));
    }

    function paintZoo() {
      const box = $('zoo');
      if (!box) return;
      if (!window.YEVA_BLOCKS) { box.innerHTML = ''; $('zooText').textContent = ''; return; }
      // следующая показана бледной тенью без лица — её ещё предстоит получить
      const show = Math.min(ZOO_MAX, zoo + 1);
      let h = '';
      for (let n = 1; n <= show; n++) {
        h += '<i class="' + (n > zoo ? 'next' : '') + '">' +
             YEVA_BLOCKS.svg(n, { face: n <= zoo }) + '</i>';
      }
      box.innerHTML = h;
      Array.prototype.forEach.call(box.children, w => fitBlock(w.firstChild, 42));
      $('zooText').textContent = zoo >= ZOO_MAX
        ? 'вся компания в сборе — ' + ZOO_MAX + ' из ' + ZOO_MAX
        : 'новый друг за каждый ряд звёзд · ' + zoo + ' из ' + ZOO_MAX;
    }

    // новый друг появляется посреди салюта и называет себя по-немецки
    function prize(n) {
      const box = $('prize');
      if (!box || !window.YEVA_BLOCKS) return;
      // поле на это время убираем: иначе новый друг ложится поверх только что
      // собранного ответа, и на экране две одинаковые фигурки
      const stage = document.querySelector('.stage');
      if (stage) { stage.style.transition = 'opacity .3s'; stage.style.opacity = '.08'; }
      setTimeout(() => { if (stage) stage.style.opacity = ''; }, 2600);

      box.innerHTML = '<div class="glow"></div><div class="box"></div>';
      const d = box.lastChild;
      d.innerHTML = YEVA_BLOCKS.svg(n);
      const el = d.firstChild;
      fitBlock(el, Math.min(window.innerWidth * 0.5, window.innerHeight * 0.42));
      requestAnimationFrame(() => box.classList.add('on'));
      setTimeout(() => YEVA_BLOCKS.react(el, 'dance'), 420);
      setTimeout(() => { if (NUM[n]) say([NUM[n]]); }, 1100);   // фанфары уже отзвучали
      setTimeout(() => box.classList.remove('on'), 2600);
      setTimeout(() => { box.innerHTML = ''; }, 3100);
    }

    $('stats').addEventListener('click', e => {
      if (!e.target.closest('#btnClear')) return;
      stats = { ok: 0, bad: 0, days: {}, tasks: {} };
      ses.ok = 0; ses.bad = 0;
      try { store.set(K_STATS, JSON.stringify(stats)); } catch (e2) {}
      paintStats(); paintScore();
    });

    /* ── подбор примера: что не получается — спрашиваем чаще ── */
    let lastKey = '';

    // все пары, которые укладываются в выбранный диапазон.
    // В вычитании остаток не меньше единицы: фигурки из нуля кубиков нет.
    function pool() {
      const out = [];
      if (SUB) {
        for (let x = 2; x <= max; x++) {
          for (let y = 1; y < x; y++) out.push([x, y]);
        }
      } else {
        for (let x = 1; x < max; x++) {
          for (let y = 1; x + y <= max; y++) out.push([x, y]);
        }
      }
      return out;
    }

    // Вес примера: ошибки поднимают, уверенные ответы опускают.
    // Потолок намеренно низкий — трудный пример должен возвращаться,
    // но не вытеснять все остальные, иначе это уже не игра, а долбёжка.
    function weightOf(x, y) {
      const t = stats.tasks[taskKey(x, y)] || { ok: 0, bad: 0 };
      const w = (1 + 1.8 * (t.bad || 0)) / (1 + 0.7 * (t.ok || 0));
      return Math.max(0.15, Math.min(3, w));
    }

    function roll(list) {
      let total = 0;
      const w = list.map(p => { const v = weightOf(p[0], p[1]); total += v; return v; });
      if (!(total > 0)) return pick(list);
      let r = Math.random() * total;
      for (let i = 0; i < list.length; i++) { r -= w[i]; if (r <= 0) return list[i]; }
      return list[list.length - 1];
    }

    function nextTask() {
      let all = pool();
      if (!all.length) return SUB ? [2, 1] : [1, 1];
      // два раза подряд один и тот же пример — скучно
      if (all.length > 1 && lastKey) {
        const f = all.filter(p => taskKey(p[0], p[1]) !== lastKey);
        if (f.length) all = f;
      }
      return roll(all);
    }

    /* ── звук ── */
    let actx = null, master = null;
    const vBuf = {}, vBad = {}, vHot = {};
    let srcs = [];           // что играет прямо сейчас — чтобы можно было оборвать

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

    // где в файле реально звучит слово: тишину по краям при склейке не ждём
    function edges(buf) {
      if (buf._cut) return buf._cut;
      const d = buf.getChannelData(0), n = d.length, th = 0.012;
      let s = 0, e = n - 1;
      for (let i = 0; i < n; i += 64) { if (Math.abs(d[i]) > th) { s = Math.max(0, i - 700); break; } }
      for (let i = n - 1; i >= 0; i -= 64) { if (Math.abs(d[i]) > th) { e = Math.min(n - 1, i + 1800); break; } }
      if (e <= s) { s = 0; e = n - 1; }
      buf._cut = [s / buf.sampleRate, (e - s) / buf.sampleRate];
      return buf._cut;
    }

    // фраза из отдельных слов: «drei plus zwei» / «ist gleich fünf»
    function say(words2, after) {
      // что бы ни случилось со звуком, игра не должна залипнуть:
      // продолжение вызываем ровно один раз
      let fired = false;
      const go = () => { if (!fired) { fired = true; if (after) after(); } };
      if (!actx) { setTimeout(go, 300); return; }

      const list = words2.filter(Boolean);
      list.forEach(load);

      const play = () => {
        let t = actx.currentTime + 0.05;
        list.forEach(w => {
          const buf = vBuf[vUrl(w)];
          const cut = edges(buf);
          const src = actx.createBufferSource(), g = actx.createGain();
          g.gain.value = 1.25;
          src.buffer = buf;
          src.connect(g); g.connect(master);
          src.start(t, cut[0], cut[1]);
          srcs.push(src);
          src.onended = () => { const i = srcs.indexOf(src); if (i >= 0) srcs.splice(i, 1); };
          t += cut[1] + CFG.gap;
        });
        setTimeout(go, (t - actx.currentTime) * 1000 + 60);
      };

      // пока файлов нет — читает системный голос, чтобы игра не молчала
      const fallback = () => {
        try {
          if (typeof speechSynthesis !== 'undefined') {
            speechSynthesis.cancel();
            const ut = new SpeechSynthesisUtterance(list.map(w => w.de).join(' '));
            ut.lang = 'de-DE'; ut.rate = 0.9; ut.pitch = 1.1;
            ut.onend = go;
            speechSynthesis.speak(ut);
            setTimeout(go, 2600);     // если движок молчит и onend не придёт
            return;
          }
        } catch (e) {}
        setTimeout(go, 400);
      };

      // первый заход на холодном кэше: даём файлам секунду догрузиться
      let tries = 0;
      (function wait() {
        if (list.every(w => vBuf[vUrl(w)])) { play(); return; }
        const hopeless = list.some(w => vBad[vUrl(w)]);
        if (!hopeless && tries++ < 10) { setTimeout(wait, 120); return; }
        fallback();
      })();
    }

    // оборвать то, что звучит: пересчёт не должен наложиться на ответ
    function hush() {
      srcs.forEach(s => {
        try { s.stop(); } catch (e) {}
        try { s.disconnect(); } catch (e) {}
      });
      srcs = [];
      try { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); } catch (e) {}
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
    // то же, что произносит голос
    function words(withAnswer) {
      const n = v => (NUM[v] ? NUM[v].de : v);
      return n(a) + ' ' + OP + ' ' + n(b) + ' ist gleich' + (withAnswer ? ' ' + n(sum) : ' …');
    }

    const stitch = () => [NUM[a], WOP, NUM[b], WEQ];   // запасная склейка из слов
    const ansPhrase = () => [NUM[sum]];                // ответ — только число

    // вопрос: цельная запись, если она есть; иначе склейка
    function speakAsk(after) {
      const p = PHRASE[a + '_' + b];
      if (!p) { say(stitch(), after); return; }
      load(p);
      let tries = 0;
      (function wait() {
        const u = vUrl(p);
        if (vBuf[u]) { say([p], after); return; }
        if (vBad[u]) { say(stitch(), after); return; }     // записи нет — склеим
        if (tries++ < 10) { setTimeout(wait, 120); return; }
        say(stitch(), after);
      })();
    }

    // сторона кубика в пикселях
    function sizeFor(total) {
      const w = Math.min(window.innerWidth, window.innerHeight * 0.62);
      const k2 = Math.max(0.8, Math.min(1.6, w / 390));
      if (total <= 4) return Math.round(50 * k2);
      if (total <= 6) return Math.round(44 * k2);
      if (total <= 10) return Math.round(38 * k2);
      if (total <= 14) return Math.round(32 * k2);
      if (total <= 20) return Math.round(27 * k2);
      return Math.round(23 * k2);
    }

    // строка должна помещаться целиком: ужимаем предметы, пока не влезет
    function fit() {
      const board = document.querySelector('.board');
      const stage = document.querySelector('.stage');
      let size = cube;
      let guard = 0;
      while (guard++ < 26 && size > 11 &&
             (board.scrollWidth > board.clientWidth + 1 || stage.scrollHeight > stage.clientHeight + 1)) {
        size = Math.max(11, size * 0.9);
        resize(size);
      }
      cube = size;
    }

    function fill(box, n, size, delay) {
      if (window.YEVA_BLOCKS) {
        box.innerHTML = YEVA_BLOCKS.svg(n);
        const el = box.firstChild;
        YEVA_BLOCKS.size(el, size);
        el.style.animationDelay = delay + 's';
        return;
      }
      // запасной вариант, если blocks.js не подключён
      const cols = Math.ceil(Math.sqrt(n));
      box.style.gridTemplateColumns = 'repeat(' + cols + ', auto)';
      box.style.fontSize = size + 'px';
      let h = '';
      for (let i = 0; i < n; i++) h += '<span>⬛</span>';
      box.innerHTML = h;
    }

    // короткая реакция фигурок на ответ
    function react(kind) {
      if (!window.YEVA_BLOCKS || !YEVA_BLOCKS.react) return;
      YEVA_BLOCKS.react($('g1').firstChild, kind);
      YEVA_BLOCKS.react($('g2').firstChild, kind);
    }

    /* ── взгляд: зрачки смотрят туда, куда смотрит ребёнок ── */
    let gazeT = 0, gazeHold = 0;

    function look(x, y) {
      if (!window.YEVA_BLOCKS || !YEVA_BLOCKS.look) return;
      YEVA_BLOCKS.look($('g1').firstChild, x, y);
      YEVA_BLOCKS.look($('g2').firstChild, x, y);
    }

    // здороваются: посмотрели друг на друга, потом на ребёнка
    function greet() {
      if (!window.YEVA_BLOCKS || !YEVA_BLOCKS.look) return;
      const s1 = $('g1').firstChild, s2 = $('g2').firstChild;
      if (!s1 || !s2) return;
      const r1 = s1.getBoundingClientRect(), r2 = s2.getBoundingClientRect();
      YEVA_BLOCKS.look(s1, r2.left + r2.width / 2, r2.top + r2.height / 2);
      YEVA_BLOCKS.look(s2, r1.left + r1.width / 2, r1.top + r1.height / 2);
      gazeHold = Date.now() + 850;
    }

    // пока никто не трогает экран, глаза сами разглядывают ответы
    function gaze() {
      clearTimeout(gazeT);
      if (Date.now() < gazeHold) { gazeT = setTimeout(gaze, 600); return; }
      const cards = $('choices').querySelectorAll('.choice');
      if (cards.length) {
        const c = pick(Array.prototype.slice.call(cards)).getBoundingClientRect();
        look(c.left + c.width / 2, c.top + c.height / 2);
      }
      gazeT = setTimeout(gaze, 1400 + Math.random() * 1200);
    }

    // палец важнее: смотрим на него и держим взгляд полторы секунды
    function watch(e) {
      const t = (e.touches && e.touches[0]) || e;
      if (t && t.clientX != null) {
        look(t.clientX, t.clientY);
        gazeHold = Date.now() + 1500;
      }
    }
    document.addEventListener('pointerdown', watch, { passive: true });
    document.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'touch') watch(e); }, { passive: true });

    /* ── пересчёт: кубики называются вслух по одному ──
       Это главная подсказка. Не «вот правильная кнопка», а само действие.
       В сложении считаем все кубики подряд, в вычитании сначала помечаем
       уходящие, а потом считаем то, что остаётся. */
    let cntId = 0, counting = false;

    function stopCount() {
      cntId++;
      if (counting) { counting = false; hush(); }
    }

    function dim(list, on) {
      list.forEach(c => { if (c && c.classList) c.classList[on ? 'add' : 'remove']('nb-dim'); });
    }

    function countAlong() {
      const B = window.YEVA_BLOCKS;
      if (!B || !B.cubes || locked || !$('veil').classList.contains('hidden')) return;
      const own = B.cubes($('g1').firstChild);
      const cubes = SUB ? own.slice(0, sum) : own.concat(B.cubes($('g2').firstChild));
      if (!cubes.length) return;

      stopCount();
      const id = ++cntId;
      counting = true;

      // в вычитании верхние кубики уходят: гасим их до счёта
      const leaving = SUB ? own.slice(sum) : [];
      dim(leaving, true);

      const step = i => {
        if (id !== cntId || locked) { if (id === cntId) { counting = false; dim(leaving, false); } return; }
        if (i >= cubes.length) { counting = false; dim(leaving, false); showHint(); return; }
        B.lit(cubes[i]);
        const r = cubes[i].getBoundingClientRect();
        look(r.left + r.width / 2, r.top + r.height / 2);
        gazeHold = Date.now() + 1400;
        // переход ко второму слагаемому — с паузой, чтобы было слышно «и ещё»
        const pause = (!SUB && i + 1 === a && cubes.length > a) ? 320 : 90;
        say([NUM[i + 1]], () => setTimeout(() => step(i + 1), pause));
      };
      step(SUB ? 0 : 0);
    }

    /* ── облачко пыли в месте события ── */
    function poof(x, y) {
      const box = $('poof');
      box.innerHTML = '';
      box.style.left = Math.round(x) + 'px';
      box.style.top = Math.round(y) + 'px';
      const col = window.YEVA_BLOCKS ? YEVA_BLOCKS.color(sum) : '#fff';

      const ring = document.createElement('b');
      const d = Math.round(cube * 3);
      ring.style.width = ring.style.height = d + 'px';
      box.appendChild(ring);

      for (let i = 0; i < 12; i++) {
        const dot = document.createElement('i');
        const ang = Math.random() * Math.PI * 2;
        const dist = cube * (0.9 + Math.random() * 1.4);
        const sz = Math.max(5, Math.round(cube * (0.14 + Math.random() * 0.22)));
        dot.style.width = dot.style.height = sz + 'px';
        dot.style.background = i % 3 === 0 ? col : 'rgba(255,255,255,.95)';
        dot.style.setProperty('--dx', (Math.cos(ang) * dist).toFixed(1) + 'px');
        dot.style.setProperty('--dy', (Math.sin(ang) * dist).toFixed(1) + 'px');
        dot.style.animationDelay = (Math.random() * 0.07).toFixed(2) + 's';
        box.appendChild(dot);
      }
      setTimeout(() => { box.innerHTML = ''; }, 900);
    }

    /* ── сложение: слагаемые едут навстречу и становятся ответом ── */
    function merge() {
      const a1 = $('g1'), a2 = $('g2'), op = $('opSign');
      const r1 = a1.getBoundingClientRect(), r2 = a2.getBoundingClientRect();
      const c1 = r1.left + r1.width / 2, c2 = r2.left + r2.width / 2;
      const mid = (c1 + c2) / 2;                       // место встречи
      const my = (r1.top + r1.height / 2 + r2.top + r2.height / 2) / 2;

      // едут навстречу друг другу и у места встречи гаснут
      const move = 'transform .42s cubic-bezier(.45,0,.25,1), opacity .18s ease-in .28s';
      a1.style.transition = move;
      a2.style.transition = move;
      a1.style.transform = 'translateX(' + (mid - c1).toFixed(1) + 'px) scale(.9)';
      a2.style.transform = 'translateX(' + (mid - c2).toFixed(1) + 'px) scale(.9)';
      a1.style.opacity = '0';
      a2.style.opacity = '0';
      op.style.transition = 'opacity .22s';
      op.style.opacity = '0';

      setTimeout(() => {
        if (locked !== true) return;                   // раунд уже сменился
        poof(mid, my);                                 // хлопок в месте встречи
        a2.style.display = 'none';
        op.style.display = 'none';

        // ответ собирается там, где столкнулись, и уезжает на своё место,
        // поэтому вёрстка не прыгает
        a1.style.transition = 'none';
        a1.style.transform = '';
        a1.style.opacity = '1';
        fill(a1, sum, cube, 0);
        fit();
        const r3 = a1.getBoundingClientRect();
        const dx = mid - (r3.left + r3.width / 2);
        a1.style.transform = 'translateX(' + dx.toFixed(1) + 'px) scale(.5)';
        a1.getBoundingClientRect();                    // зафиксировать старт
        a1.style.transition = 'transform .52s cubic-bezier(.3,1.5,.5,1)';
        a1.style.transform = '';
        react('yay');
        gaze();
      }, 430);
    }

    /* ── вычитание: отнимаемые кубики уходят к вычитаемому ──
       В сложении две фигурки съезжаются в одну. Обратное действие должно
       читаться так же честно: вторая фигурка не просто гаснет, а забирает
       своё. Поэтому верхние кубики отрываются от большой фигурки, летят
       к маленькой — и уже вместе с ней исчезают в облачке. */
    function takeAway() {
      const a1 = $('g1'), a2 = $('g2'), op = $('opSign');
      const B = window.YEVA_BLOCKS;
      const own = (B && B.cubes) ? B.cubes(a1.firstChild) : [];
      const gone = own.slice(sum);                     // верхние уходят

      // куда лететь: середина вычитаемого
      const r2b = a2.getBoundingClientRect();
      const gx = r2b.left + r2b.width / 2;
      const gy = r2b.top + r2b.height / 2;

      // внутри svg расстояния свои: переводим экранные пиксели в единицы
      const svg = a1.firstChild;
      const box = svg ? svg.getBoundingClientRect() : null;
      const vb = svg && svg.viewBox ? svg.viewBox.baseVal : null;
      const k = (box && box.width && vb && vb.width) ? vb.width / box.width : 1;

      // Летят строем: один общий сдвиг на всех. Если целить каждым кубиком
      // в середину вычитаемого, они сбиваются в кучу и форма теряется.
      let cx0 = 0, cy0 = 0;
      gone.forEach(c => {
        const r = c.getBoundingClientRect();
        cx0 += r.left + r.width / 2; cy0 += r.top + r.height / 2;
      });
      if (gone.length) { cx0 /= gone.length; cy0 /= gone.length; }
      const dx = (gx - cx0) * k;
      const dy = (gy - cy0) * k;

      // лицо нарисовано поверх верхнего ряда — вместе с ним и уходит,
      // иначе улыбка повисла бы над оставшимися кубиками
      const faceEl = svg ? svg.querySelector('.nb-face') : null;
      if (faceEl) { faceEl.style.transition = 'opacity .16s'; faceEl.style.opacity = '0'; }

      gone.forEach((c, i) => {
        const d = Math.min(0.09, i * 0.035);           // уходят не все разом
        c.classList.add('nb-gone');
        // гаснут только у цели, иначе не видно, куда они делись
        c.style.transition = 'transform .44s cubic-bezier(.35,0,.2,1) ' + d.toFixed(2) + 's,' +
                             ' opacity .15s ease-in ' + (d + 0.33).toFixed(2) + 's';
        c.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) scale(.78)';
        c.style.opacity = '0';
      });

      // облачко там, где они встретились с вычитаемым
      setTimeout(() => {
        if (locked !== true) return;
        poof(gx, gy);
        // и только теперь вычитаемое со знаком уходят — вместе с тем,
        // что к ним прилетело
        [a2, op].forEach(x => { x.style.transition = 'opacity .24s'; x.style.opacity = '0'; });
      }, 470);

      setTimeout(() => {
        if (locked !== true) return;                   // раунд уже сменился
        a2.style.display = 'none';
        op.style.display = 'none';

        // тот же приём, что и в сложении: собрать ответ, померить, вернуть
        // на прежнее место и отпустить — тогда вёрстка не прыгает
        const r1 = a1.getBoundingClientRect();
        const c1 = r1.left + r1.width / 2;
        a1.style.transition = 'none';
        a1.style.transform = '';
        fill(a1, sum, cube, 0);
        fit();
        const r2 = a1.getBoundingClientRect();
        const dx = c1 - (r2.left + r2.width / 2);
        a1.style.transform = 'translateX(' + dx.toFixed(1) + 'px)';
        a1.getBoundingClientRect();
        a1.style.transition = 'transform .5s cubic-bezier(.3,1.4,.5,1)';
        a1.style.transform = '';
        react('yay');
        gaze();
      }, 660);                                         // дать кубикам долететь
    }

    const showAnswer = () => (SUB ? takeAway() : merge());

    function resize(size) {
      if (!window.YEVA_BLOCKS) { $('g1').style.fontSize = size + 'px'; $('g2').style.fontSize = size + 'px'; return; }
      YEVA_BLOCKS.size($('g1').firstChild, size);
      YEVA_BLOCKS.size($('g2').firstChild, size);
    }

    function round() {
      clearTimeout(hintT);
      stopCount();
      wrongs = 0;
      const t = nextTask();
      a = t[0];
      b = t[1];
      sum = result(a, b);
      lastKey = taskKey(a, b);

      // вернуть всё, что сдвинула анимация ответа или спрятало награду
      const stage0 = document.querySelector('.stage');
      if (stage0) { stage0.style.opacity = ''; stage0.style.transition = ''; }
      $('g1').style.cssText = '';
      $('g2').style.cssText = '';
      $('opSign').style.cssText = '';
      $('poof').innerHTML = '';

      cube = sizeFor(Math.max(a, sum));
      fill($('g1'), a, cube, 0);
      fill($('g2'), b, cube, 0.12);

      $('ans').textContent = '?';
      $('ans').classList.remove('done');
      $('ans').style.background = '';
      $('ans').style.color = '';
      $('digits').textContent = a + ' ' + SIGN + ' ' + b + ' = ?';
      $('say').textContent = words(false);
      fit();

      // три ответа: верный и два соседних
      const opts = [sum];
      let guard = 0;
      while (opts.length < 3 && guard++ < 50) {
        const d = pick([-3, -2, -1, 1, 2, 3]);
        const v = sum + d;
        if (v >= 1 && v <= max && opts.indexOf(v) < 0) opts.push(v);
      }
      while (opts.length < 3) { const v = irand(1, max); if (opts.indexOf(v) < 0) opts.push(v); }
      opts.sort(() => Math.random() - 0.5);

      $('choices').innerHTML = opts.map(v =>
        '<button class="choice" data-v="' + v + '">' + v + '</button>').join('');

      // слова этого раунда и соседних чисел — заранее
      [NUM[a], NUM[b], NUM[sum], WOP, WEQ, PHRASE[a + '_' + b]].forEach(load);
      opts.forEach(v => load(NUM[v]));

      // отвечать можно сразу: ребёнок не должен ждать, пока договорит голос
      locked = false;
      speakAsk();
      setTimeout(greet, 260);     // кубики успели выложиться — и переглянулись
      gaze();
      hintT = setTimeout(showHint, 9000);
    }

    function showHint() {
      const c = $('choices').querySelector('[data-v="' + sum + '"]');
      if (c) c.classList.add('hint');
    }

    function tap(btn) {
      if (locked) return;
      const v = +btn.dataset.v;
      stopCount();

      if (v !== sum) {
        wrongs++;
        btn.classList.remove('wrong');
        void btn.offsetWidth;
        btn.classList.add('wrong');
        setTimeout(() => btn.classList.remove('wrong'), 420);
        nope(); buzz(40);
        react('hmm');
        const r = btn.getBoundingClientRect();
        look(r.left + r.width / 2, r.top + r.height / 2);
        gazeHold = Date.now() + 1200;
        bump('bad');
        // вторая ошибка — не подсвечиваем ответ, а пересчитываем кубики вслух
        if (wrongs >= 2) setTimeout(countAlong, 520);
        return;
      }

      locked = true;
      clearTimeout(hintT);
      $('choices').querySelectorAll('.choice').forEach(c => {
        c.classList.remove('hint');
        if (+c.dataset.v !== sum) c.style.opacity = '.35';
      });
      btn.classList.add('right');
      $('ans').textContent = sum;
      $('ans').classList.add('done');
      if (window.YEVA_BLOCKS) {
        $('ans').style.background = YEVA_BLOCKS.color(sum);
        $('ans').style.color = '#fff';
      }
      $('digits').textContent = a + ' ' + SIGN + ' ' + b + ' = ' + sum;
      $('say').textContent = words(true);
      yay(); buzz(30);
      react('yay');
      bump('ok');

      done++;
      paintStars();

      // фигурки меняются — ровно пока звучит «ist gleich пять»
      setTimeout(showAnswer, 420);

      // «ist gleich пять» — и только когда голос договорит, следующий пример
      const next = () => { if (done >= CFG.goal) party(); else round(); };
      setTimeout(() => say(ansPhrase(), () => setTimeout(next, 900)), 260);
    }

    $('choices').addEventListener('click', e => {
      const c = e.target.closest('.choice');
      if (c) tap(c);
    });
    $('btnAgain').addEventListener('click', () => {
      initAudio();
      stopCount();
      if ($('ans').classList.contains('done')) speakAsk(() => say(ansPhrase()));
      else speakAsk();
    });

    // пересчёт по просьбе: нажать на «?» или на строку с цифрами
    $('ans').addEventListener('click', countAlong);
    $('digits').addEventListener('click', countAlong);

    /* ── звёзды и салют ── */
    function paintStars() {
      let h = '';
      for (let i = 0; i < CFG.goal; i++) h += '<i class="' + (i < done ? 'on' : '') + '"></i>';
      $('stars').innerHTML = h;
    }

    function party() {
      fanfare(); buzz([20, 60, 20, 60, 40]);
      if (window.YEVA_BLOCKS && YEVA_BLOCKS.react) {
        YEVA_BLOCKS.react($('g1').firstChild, 'dance');
        YEVA_BLOCKS.react($('g2').firstChild, 'dance');
      }
      const box = $('party');
      const colors = ['#FFD86E', '#8C7AE0', '#8FD3FF', '#7FC8A9', '#F0A24B'];
      for (let i = 0; i < 70; i++) {
        const c = document.createElement('i');
        c.style.left = rand(0, 100) + 'vw';
        c.style.background = pick(colors);
        c.style.animationDuration = rand(1.8, 3.4) + 's';
        c.style.animationDelay = rand(0, 0.7) + 's';
        box.appendChild(c);
      }
      setTimeout(() => { box.innerHTML = ''; }, 4200);

      const got = earn();          // ряд звёзд собран — приходит новый друг
      if (got) { prize(got); paintZoo(); }

      done = 0;
      paintStars();
      setTimeout(round, got ? 4000 : 3200);
    }

    /* ── выбор диапазона ── */
    function paintSizes() {
      $('sizes').innerHTML = SIZES.map(s =>
        '<button class="size' + (s === max ? ' on' : '') + '" data-s="' + s + '">до ' + s + '</button>').join('');
    }
    $('sizes').addEventListener('click', e => {
      const b2 = e.target.closest('.size');
      if (!b2) return;
      max = +b2.dataset.s;
      store.set(K_MAX, String(max));
      paintSizes();
      initAudio();
      tone('sine', 700, 0, 0.08, 0.16, 1000);
    });

    /* ── старт ── */
    function goFullscreen() {
      // Установленная игра и так во весь экран. Запрос полноэкранного режима
      // добавляет только системную подсказку «проведите сверху вниз и нажмите
      // Назад» — ребёнок её не уберёт, а она закрывает нижний ряд.
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
      [WOP, WEQ].forEach(load);
      for (let n = 1; n <= max; n++) load(NUM[n]);
      $('veil').classList.add('hidden');
      done = 0;
      paintStars();
      round();
    });

    const relayout = () => { cube = sizeFor(Math.max(a, sum)); resize(cube); fit(); };
    window.addEventListener('resize', () => setTimeout(relayout, 80));
    window.addEventListener('orientationchange', () => setTimeout(relayout, 260));
    document.addEventListener('fullscreenchange', () => setTimeout(relayout, 160));

    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('gesturestart', e => e.preventDefault());
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && actx && actx.state === 'suspended') actx.resume();
    });

    max = SIZES.indexOf(+store.get(K_MAX, 10)) >= 0 ? +store.get(K_MAX, 10) : 10;
    paintSizes();
    paintStars();
    paintScore();
    paintStats();
    paintZoo();
  }

  window.YEVA_MATH = { start: start };
})();
