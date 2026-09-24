/* belt.js — conveyor belts for the «Просто» tab and the video. Pure string generators (no DOM), same
 * sticker grammar as chars.js (4px ink outlines, flat fills). Safe in a Node vm with window = {MP:{}}.
 *
 * MP.belt(opts) -> '<g class="belt">…</g>'
 *   Straight segment (default), drawn with its top-left at (x, y):
 *     {x=0, y=0, w=480 (length), h=36 (thickness), pitch=28 (chevron spacing), color=steel (top surface),
 *      dir=1 (1 → chevrons ">" move right, -1 → "<" move left), rollers=true, legs=0 (support length below the belt),
 *      stations: [{x, lamp:'mint'|'sky'|'raspberry'|'lemon'|'off', label:'Собрать', labelSize=16, post=58}],
 *      id, cls}
 *     Moving surface: `.belt-chev` (carries data-pitch / data-dir) sits in a clipping inner <svg>. Loop it with
 *       gsap.to(chev, {x: dir * pitch, duration: pitch / speed, ease: 'none', repeat: -1})  — seamless.
 *     Rollers + end drums: `.belt-roller` (spin with rotation; origin = centre via chars.css). Stations: `.belt-station`
 *       > `.c-lamp.c-lamp--<colour>` + `.belt-label` (plate + text; text is drawn ≥ labelSize user units).
 *   Serpentine belt along a polyline: pass {points: [[x,y], …], r=48 (corner radius), w=30 (belt width),
 *     pitch=24, color}. Markup: outline + surface + `.belt-flow` (dashed slats). Move it with
 *       gsap.to(flow, {strokeDashoffset: -pitch, duration: 0.5, ease: 'none', repeat: -1}).
 * MP.beltPath(points, r=48) -> 'M… L… A…' — smooth path through the points with circular fillets
 *   (serpentine U-turns when r ≥ half the row gap). Use it for MotionPath travel along the same belt.
 */
(function () {
  'use strict';
  var MP = window.MP = window.MP || {};

  var INK = '#16123A', CREAM = '#FFF6E6', STEEL = '#C9D3E6', STEEL_D = '#8E9BB8';
  var LAMP = { mint: '#2BD99F', sky: '#3EC5FF', raspberry: '#FF4F8B', lemon: '#FFDA4F', off: STEEL_D, tangerine: '#FF8A1F' };
  var FONT_T = "'Golos Text', 'Segoe UI', system-ui, sans-serif";

  function f(v) { return String(Math.round(v * 100) / 100); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function R(x, y, w, h, rx, fill, ex) {
    return '<rect x="' + f(x) + '" y="' + f(y) + '" width="' + f(w) + '" height="' + f(h) + '"' +
      (rx ? ' rx="' + f(rx) + '"' : '') + ' fill="' + fill + '"' + (ex || '') + '/>';
  }
  function C(cx, cy, r, fill, ex) { return '<circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(r) + '" fill="' + fill + '"' + (ex || '') + '/>'; }
  function head(cls, o, extra) {
    var t = (o.x || o.y) ? ' transform="translate(' + f(+o.x || 0) + ' ' + f(+o.y || 0) + ')"' : '';
    return '<g class="' + cls + (o.cls ? ' ' + esc(o.cls) : '') + '"' + (o.id ? ' id="' + esc(o.id) + '"' : '') + (extra || '') + t +
      ' stroke="' + INK + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">';
  }

  /* smooth polyline: straight runs joined by circular fillets */
  MP.beltPath = function (points, radius) {
    if (!points || points.length < 2) return '';
    var r = radius == null ? 48 : radius, n = points.length;
    var d = 'M' + f(points[0][0]) + ' ' + f(points[0][1]);
    for (var i = 1; i < n - 1; i++) {
      var p0 = points[i - 1], p1 = points[i], p2 = points[i + 1];
      var ux = p1[0] - p0[0], uy = p1[1] - p0[1], vx = p2[0] - p1[0], vy = p2[1] - p1[1];
      var lu = Math.sqrt(ux * ux + uy * uy), lv = Math.sqrt(vx * vx + vy * vy);
      if (!lu || !lv) continue;
      ux /= lu; uy /= lu; vx /= lv; vy /= lv;
      var phi = Math.acos(Math.max(-1, Math.min(1, ux * vx + uy * vy)));
      if (phi < 1e-3 || r <= 0) { d += 'L' + f(p1[0]) + ' ' + f(p1[1]); continue; }
      var tan = Math.tan(phi / 2);
      var t = Math.min(r * tan, i === 1 ? lu : lu / 2, i === n - 2 ? lv : lv / 2);
      var rr = t / tan;
      d += 'L' + f(p1[0] - ux * t) + ' ' + f(p1[1] - uy * t) +
        'A' + f(rr) + ' ' + f(rr) + ' 0 0 ' + (ux * vy - uy * vx > 0 ? 1 : 0) + ' ' + f(p1[0] + vx * t) + ' ' + f(p1[1] + vy * t);
    }
    return d + 'L' + f(points[n - 1][0]) + ' ' + f(points[n - 1][1]);
  };

  function station(s, h) {
    var col = LAMP[s.lamp] ? s.lamp : 'mint', post = s.post || 58, size = s.labelSize || 16, x = s.x || 0;
    var out = R(x - 4, -post, 8, post + 6, 2, STEEL_D, ' stroke-width="3.2"') +
      '<g class="c-lamp c-lamp--' + col + '">' + C(x, -post, 9, LAMP[col], ' stroke-width="3.4"') +
      (col === 'off' ? '' : C(x - 3, -post - 3.2, 2.5, '#FFFFFF', ' stroke="none"')) + '</g>';
    if (s.label) {
      var tw = String(s.label).length * size * 0.56 + size * 1.3, ly = -post - 16 - size * 1.7;
      out += '<g class="belt-label">' + R(x - tw / 2, ly, tw, size * 1.75, size * 0.55, CREAM, ' stroke-width="3"') +
        '<text x="' + f(x) + '" y="' + f(ly + size * 1.22) + '" font-family="' + FONT_T + '" font-size="' + size +
        '" font-weight="700" fill="' + INK + '" stroke="none" text-anchor="middle">' + esc(s.label) + '</text></g>';
    }
    return '<g class="belt-station">' + out + '</g>';
  }

  MP.belt = function (opts) {
    var o = opts || {};
    if (o.points) return pathBelt(o);
    var w = o.w || 480, h = o.h || 36, pitch = o.pitch || 28, dir = o.dir === -1 ? -1 : 1, color = o.color || STEEL;
    var ht = Math.round(h * 0.5), inset = 5, i, s = '';
    /* stations (behind) and legs */
    (o.stations || []).forEach(function (st) { s += station(st, h); });
    if (o.legs > 0) {
      var xs = [h * 0.9, w - h * 0.9];
      for (var lx = h * 0.9 + 220; lx < w - h * 0.9 - 110; lx += 220) xs.push(lx);
      xs.forEach(function (x) {
        s += R(x - 6, h - 4, 12, o.legs + 4, 2, STEEL_D, ' stroke-width="3.2"') + R(x - 13, h + o.legs - 2, 26, 8, 4, INK, ' stroke="none"');
      });
    }
    /* body + top surface */
    s += R(0, 0, w, h, h / 2, INK);
    s += R(inset, 4, w - inset * 2, ht, ht / 2, color, ' stroke="none"');
    /* moving chevrons, clipped by an inner <svg> (no ids needed) */
    var ww = w - h - 4, cw = ht * 0.32, chev = '';
    for (i = -1; i * pitch < ww + pitch; i++) {
      var a = i * pitch + (pitch - cw) / 2;
      chev += dir === 1 ? 'M' + f(a) + ' ' + f(ht * 0.2) + 'L' + f(a + cw) + ' ' + f(ht / 2) + 'L' + f(a) + ' ' + f(ht * 0.8)
        : 'M' + f(a + cw) + ' ' + f(ht * 0.2) + 'L' + f(a) + ' ' + f(ht / 2) + 'L' + f(a + cw) + ' ' + f(ht * 0.8);
    }
    s += '<svg x="' + f(h / 2 + 2) + '" y="4" width="' + f(ww) + '" height="' + f(ht) + '" overflow="hidden">' +
      '<g class="belt-chev" data-pitch="' + pitch + '" data-dir="' + dir + '"><path d="' + chev +
      '" fill="none" stroke="' + INK + '" stroke-opacity=".32" stroke-width="3.2"/></g></svg>';
    s += '<path d="M' + f(h / 2 + 4) + ' ' + f(4 + 2.5) + 'H' + f(w - h / 2 - 4) + '" fill="none" stroke="#FFFFFF" stroke-opacity=".55" stroke-width="2.4"/>';
    /* rollers in the lower band */
    if (o.rollers !== false) {
      var by = 4 + ht + (h - 8 - ht) / 2 + 0.5, rr = Math.max(2.6, (h - 8 - ht) / 2), n = Math.max(2, Math.round((w - 2 * h) / (h * 1.1)));
      for (i = 0; i <= n; i++) {
        var rx = h * 1.05 + (w - 2.1 * h) * i / n;
        s += '<g class="belt-roller">' + C(rx, by, rr, STEEL_D, ' stroke="none"') + C(rx, by, rr * 0.36, INK, ' stroke="none"') + '</g>';
      }
    }
    /* end drums */
    var dr = h / 2 - 2.5;
    [h / 2, w - h / 2].forEach(function (x) {
      s += '<g class="belt-roller belt-drum">' + C(x, h / 2, dr, STEEL_D, ' stroke-width="3.2"') +
        '<path d="M' + f(x - dr * 0.62) + ' ' + f(h / 2) + 'H' + f(x + dr * 0.62) + 'M' + f(x) + ' ' + f(h / 2 - dr * 0.62) + 'V' + f(h / 2 + dr * 0.62) +
        '" fill="none" stroke-width="2.4"/>' + C(x, h / 2, dr * 0.3, CREAM, ' stroke-width="2.2"') + '</g>';
    });
    return head('belt', o, ' data-pitch="' + pitch + '"') + s + '</g>';
  };

  function pathBelt(o) {
    var d = MP.beltPath(o.points, o.r == null ? 48 : o.r), w = o.w || 30, pitch = o.pitch || 24;
    return head('belt belt--path', o, ' data-pitch="' + pitch + '"') +
      '<path class="belt-edge" d="' + d + '" fill="none" stroke-width="' + f(w + 8) + '"/>' +
      '<path class="belt-surface" d="' + d + '" fill="none" stroke="' + (o.color || STEEL) + '" stroke-width="' + f(w) + '"/>' +
      '<path class="belt-flow" d="' + d + '" fill="none" stroke="' + INK + '" stroke-opacity=".28" stroke-linecap="butt" stroke-width="' +
      f(w * 0.56) + '" stroke-dasharray="4 ' + f(pitch - 4) + '"/></g>';
  }
})();
