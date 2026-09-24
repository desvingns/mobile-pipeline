/* confetti.js — MP.confetti({x, y, count = 120, colors, spread, power, el})
 * A celebratory burst in the sticker style: rects, circles and drops in palette colours with thin ink outlines.
 * Lazily creates ONE fixed full-viewport <canvas> (pointer-events:none, aria-hidden), runs its own tiny physics
 * for ~2.5 s, then stops the rAF loop and removes the canvas. Calling it again during a burst adds particles to
 * the same canvas. No-op when MP.isCalm() (reduced motion / «Без анимации») or without a document.
 *   x, y    burst origin in viewport px (default: centre); or pass el to burst from an element's centre.
 *   colors  array of CSS colours (default: violet, mint, raspberry, sky, tangerine, cream — lemon stays reserved).
 *   spread  fan width in degrees around straight up (default 110); power 0.6…1.6 multiplies launch speed.
 */
(function () {
  'use strict';
  var MP = window.MP = window.MP || {};
  var DEFAULT = ['#5B34F5', '#2BD99F', '#FF4F8B', '#3EC5FF', '#FF8A1F', '#FFF6E6'];
  var INK = '#16123A';
  var LIFE = 2.5;
  var st = null;     // {cv, ctx, parts, raf, last, dpr}
  var bursts = 0;

  function rng(seed) {
    if (MP.seeded) return MP.seeded(seed);
    return Math.random;
  }

  function ensure() {
    if (st) return st;
    var cv = document.createElement('canvas');
    cv.className = 'mp-confetti';
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483000';
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(window.innerWidth * dpr);
    cv.height = Math.round(window.innerHeight * dpr);
    document.body.appendChild(cv);
    st = { cv: cv, ctx: cv.getContext('2d'), parts: [], raf: 0, last: 0, dpr: dpr };
    return st;
  }

  function stop() {
    if (!st) return;
    if (st.raf) cancelAnimationFrame(st.raf);
    if (st.cv.parentNode) st.cv.parentNode.removeChild(st.cv);
    st = null;
  }

  function drawPart(c, p, alpha) {
    c.save();
    c.globalAlpha = alpha;
    c.translate(p.x, p.y);
    c.rotate(p.rot);
    c.scale(1, Math.max(0.12, Math.abs(Math.cos(p.flip))));   // paper tumble
    c.fillStyle = p.color;
    c.strokeStyle = INK;
    c.lineWidth = 2;
    c.lineJoin = 'round';
    c.beginPath();
    var s = p.size;
    if (p.shape === 0) {
      c.rect(-s / 2, -s * 0.32, s, s * 0.64);
    } else if (p.shape === 1) {
      c.arc(0, 0, s * 0.42, 0, Math.PI * 2);
    } else {
      c.moveTo(0, -s * 0.6);
      c.bezierCurveTo(s * 0.12, -s * 0.3, s * 0.42, -s * 0.05, s * 0.42, s * 0.16);
      c.arc(0, s * 0.16, s * 0.42, 0, Math.PI, false);
      c.bezierCurveTo(-s * 0.42, -s * 0.05, -s * 0.12, -s * 0.3, 0, -s * 0.6);
    }
    c.fill();
    c.stroke();
    c.restore();
  }

  function frame(now) {
    if (!st) return;
    var dt = Math.min(0.05, Math.max(0, (now - st.last) / 1000));
    st.last = now;
    var c = st.ctx, W = st.cv.width, H = st.cv.height;
    c.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    var alive = 0;
    for (var i = 0; i < st.parts.length; i++) {
      var p = st.parts[i];
      p.age += dt;
      if (p.age >= p.life) continue;
      alive++;
      var drag = Math.pow(p.drag, dt);
      p.vx *= drag; p.vy = p.vy * drag + 1250 * dt;
      if (p.vy > p.term) p.vy = p.term;                          // flutter: paper falls slowly
      p.x += (p.vx + Math.sin(p.age * p.wob + p.phase) * 38) * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      p.flip += p.flipV * dt;
      var left = p.life - p.age;
      drawPart(c, p, left < 0.5 ? left / 0.5 : 1);
    }
    if (!alive) { stop(); return; }
    st.raf = requestAnimationFrame(frame);
  }

  MP.confetti = function (opts) {
    if (typeof document === 'undefined' || !document.body) return;
    if (MP.isCalm && MP.isCalm()) return;
    var o = opts || {};
    var x = o.x, y = o.y;
    if (o.el && o.el.getBoundingClientRect) {
      var b = o.el.getBoundingClientRect(); x = b.left + b.width / 2; y = b.top + b.height / 2;
    }
    if (x == null) x = window.innerWidth / 2;
    if (y == null) y = window.innerHeight / 2;
    var count = Math.max(1, Math.min(400, o.count || 120));
    var colors = o.colors && o.colors.length ? o.colors : DEFAULT;
    var spread = (o.spread || 110) * Math.PI / 180, power = o.power || 1;
    var scale = Math.max(0.7, Math.min(1.25, Math.min(window.innerWidth, window.innerHeight) / 800));
    var r = rng(7331 + (bursts++) * 977);
    var s = ensure();
    for (var i = 0; i < count; i++) {
      var ang = -Math.PI / 2 + (r() - 0.5) * spread;
      var sp = (520 + r() * 760) * power * scale;
      s.parts.push({
        x: x, y: y,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        drag: 0.18 + r() * 0.12, term: 180 + r() * 140,
        rot: r() * Math.PI * 2, spin: (r() - 0.5) * 14,
        flip: r() * Math.PI, flipV: 5 + r() * 9,
        wob: 3 + r() * 4, phase: r() * 6.28,
        size: (9 + r() * 8) * scale,
        shape: i % 3, color: colors[i % colors.length],
        age: 0, life: LIFE - r() * 0.5
      });
    }
    if (!s.raf) {
      s.last = performance.now();
      s.raf = requestAnimationFrame(frame);
    }
  };
})();
