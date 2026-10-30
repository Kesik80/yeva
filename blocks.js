/* blocks.js — кубики-числа для игр YEVA.

   Идея простая и старая, как счётные палочки: число — это столько же
   кубиков, сложенных в фигурку с лицом. Рисунок полностью свой:
   своя палитра, свои мордочки, свои кубики. Никаких чужих персонажей.

   Использование:
       <script src="blocks.js"></script>
       box.innerHTML = YEVA_BLOCKS.svg(7);           // фигурка из 7 кубиков
       YEVA_BLOCKS.size(box.firstChild, 40);         // размер кубика в px

   svg(n, o) принимает:
       o.face   — рисовать мордочку (по умолчанию да)
       o.color  — свой цвет вместо палитры
       o.id     — префикс для id градиентов, если фигурок несколько
*/
(function () {
  'use strict';

  // своя палитра: по цвету на число, по кругу после десяти
  var PAL = [
    '#2FB4A8', // 1
    '#F2715B', // 2
    '#8C7AE0', // 3
    '#F2A63C', // 4
    '#E8529B', // 5
    '#6FC45A', // 6
    '#4FA8D8', // 7
    '#C98BE0', // 8
    '#3F7FD0', // 9
    '#E8C23C'  // 10
  ];

  var uid = 0;

  // сколько столбцов у фигурки: до трёх — башенка, дальше прямоугольник
  function cols(n) {
    if (n <= 3) return 1;
    if (n <= 10) return 2;
    if (n <= 15) return 3;
    return 4;
  }

  // клетки снизу вверх, неполный столбец — сверху и по центру
  function cells(n) {
    var c = cols(n), r = Math.ceil(n / c), out = [], i = 0;
    for (var row = r - 1; row >= 0; row--) {
      var left = n - i;
      var wide = Math.min(c, left);
      var off = (c - wide) / 2;        // неполный ряд — по центру
      for (var k = 0; k < wide; k++) out.push({ x: off + k, y: row });
      i += wide;
      if (i >= n) break;
    }
    return { list: out, cols: c, rows: r };
  }

  function cube(x, y, s, fill, idp, k) {
    var p = 0.055 * s;                 // зазор между кубиками
    var X = x * s + p, Y = y * s + p, S = s - 2 * p;
    var r = S * 0.22;
    return '' +
      '<rect x="' + X + '" y="' + Y + '" width="' + S + '" height="' + S + '" rx="' + r + '"' +
      ' fill="' + fill + '"/>' +
      // блик сверху и тень снизу — кубик выглядит объёмным
      '<rect x="' + (X + S * 0.1) + '" y="' + (Y + S * 0.1) + '" width="' + (S * 0.8) + '" height="' + (S * 0.26) + '"' +
      ' rx="' + (S * 0.13) + '" fill="#fff" opacity=".22"/>' +
      '<rect x="' + X + '" y="' + (Y + S * 0.76) + '" width="' + S + '" height="' + (S * 0.24) + '"' +
      ' rx="' + r + '" fill="#000" opacity=".1"/>' +
      // «пупырышек», как у счётных кубиков
      '<circle cx="' + (X + S / 2) + '" cy="' + (Y + S / 2) + '" r="' + (S * 0.17) + '" fill="#000" opacity=".12"/>' +
      '<circle cx="' + (X + S / 2) + '" cy="' + (Y + S * 0.47) + '" r="' + (S * 0.17) + '" fill="' + fill + '"/>';
  }

  // мордочка поверх верхнего ряда: два глаза и улыбка
  function face(top, s) {
    var w = top.w * s, x0 = top.x * s, y0 = top.y * s;
    var cx = x0 + w / 2, cy = y0 + s * 0.42;
    var e = s * 0.17, gap = Math.min(w * 0.22, s * 0.34);
    var g = '';
    [-1, 1].forEach(function (d) {
      var ex = cx + d * gap;
      g += '<circle cx="' + ex + '" cy="' + cy + '" r="' + e + '" fill="#fff"/>' +
           '<circle cx="' + (ex + d * e * 0.12) + '" cy="' + (cy + e * 0.12) + '" r="' + (e * 0.52) + '" fill="#2B2B3A"/>' +
           '<circle cx="' + (ex - d * e * 0.25) + '" cy="' + (cy - e * 0.3) + '" r="' + (e * 0.18) + '" fill="#fff"/>';
    });
    var my = cy + s * 0.42, mw = Math.min(w * 0.3, s * 0.46);
    g += '<path d="M' + (cx - mw) + ' ' + my + ' q ' + mw + ' ' + (s * 0.3) + ' ' + (2 * mw) + ' 0"' +
         ' fill="none" stroke="#2B2B3A" stroke-width="' + (s * 0.075) + '" stroke-linecap="round" opacity=".85"/>';
    return g;
  }

  function svg(n, o) {
    o = o || {};
    n = Math.max(1, Math.min(60, Math.round(n)));
    var g = cells(n);
    var s = 100;                                   // кубик в единицах viewBox
    var fill = o.color || PAL[(n - 1) % PAL.length];
    var body = '';
    g.list.forEach(function (c, i) { body += cube(c.x, c.y, s, fill, o.id || ('b' + (++uid)), i); });

    // верхний ряд — туда ставим мордочку
    var topY = 0;
    var row = g.list.filter(function (c) { return c.y === topY; });
    if (!row.length) row = g.list.slice(0, 1);
    var minX = Math.min.apply(null, row.map(function (c) { return c.x; }));
    var top = { x: minX, y: topY, w: row.length };

    if (o.face !== false) body += face(top, s);

    var W = g.cols * s, H = g.rows * s;
    return '<svg class="nblock" viewBox="0 0 ' + W + ' ' + H + '" data-cols="' + g.cols +
      '" data-rows="' + g.rows + '" xmlns="http://www.w3.org/2000/svg" aria-label="' + n + '">' +
      body + '</svg>';
  }

  // поставить размер кубика в пикселях
  function size(el, px) {
    if (!el || !el.getAttribute) return;
    var c = +el.getAttribute('data-cols') || 1, r = +el.getAttribute('data-rows') || 1;
    el.style.width = (c * px) + 'px';
    el.style.height = (r * px) + 'px';
  }

  window.YEVA_BLOCKS = {
    svg: svg,
    size: size,
    color: function (n) { return PAL[(Math.round(n) - 1) % PAL.length]; },
    palette: PAL
  };
})();
