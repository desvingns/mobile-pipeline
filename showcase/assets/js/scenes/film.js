/* scenes/film.js — «Посмотрите фильм» (#film) and the finale (#final, registered here as scene 'final'). Package D.
 *
 * film:  custom lemon play button [data-action=film-play] plays the video and hides itself (.film-frame.is-playing).
 *        The video keeps preload="none" (nothing is fetched before you press play); an error on the <video> or its
 *        <source>, or a rejected play() (e.g. media/mobile-pipeline.mp4 missing on the host), shows .film-fallback and
 *        hides the play button. If media/poster.jpg is missing, an illustrated poster (.fm-poster) stands in until the
 *        first play. window.MP_VIDEO → h2 «Посмотрите фильм — N минуты» (ru plural, rounded to 0,5; set eagerly at
 *        DOMContentLoaded so the lazy build never changes the section's height); window.MP_TRANSCRIPT →
 *        #film-transcript: one paragraph per chapter with an m:ss button that seeks and plays the video; the chapter
 *        being played is highlighted.
 * final: a class photo of the whole cast on bleachers (26 characters + the blooming фиалка and the phone). Animated:
 *        everyone pops up from behind the steps (stagger by x) and a stadium wave of raised arms runs across
 *        (api.loop) + blinking; when everyone is up a camera flash goes off («Сы-ыр!»). Calm: the static line-up.
 */
(function () {
  'use strict';
  var MP = window.MP;
  if (!MP || !MP.scene) return;

  var INK = '#16123A', CREAM = '#FFF6E6', VIOLET = '#5B34F5', MINT = '#2BD99F', RASP = '#FF4F8B', SKY = '#3EC5FF',
    TANG = '#FF8A1F', NIGHT = '#2C2472', WHITE = '#FFFFFF', LEAF_D = '#1BB283';
  var FONT_D = "Unbounded, 'Arial Black', system-ui, sans-serif";
  var SW = ' stroke="' + INK + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"';

  function f(v) { return String(Math.round(v * 100) / 100); }
  function R(x, y, w, h, rx, fill, ex) {
    return '<rect x="' + f(x) + '" y="' + f(y) + '" width="' + f(w) + '" height="' + f(h) + '"' + (rx ? ' rx="' + f(rx) + '"' : '') +
      ' fill="' + fill + '"' + (ex || '') + '/>';
  }
  function C(cx, cy, r, fill, ex) { return '<circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(r) + '" fill="' + fill + '"' + (ex || '') + '/>'; }
  function P(d, fill, ex) { return '<path d="' + d + '" fill="' + fill + '"' + (ex || '') + '/>'; }
  function G(cls, inner, ex) { return '<g' + (cls ? ' class="' + cls + '"' : '') + (ex || '') + '>' + inner + '</g>'; }
  function dropD(cx, top, h) {
    var r = h * 0.36, cy = top + h - r;
    return 'M' + f(cx) + ' ' + f(top) + 'C' + f(cx - r * 0.3) + ' ' + f(top + h * 0.28) + ' ' + f(cx - r) + ' ' + f(cy - r * 0.5) + ' ' +
      f(cx - r) + ' ' + f(cy) + 'A' + f(r) + ' ' + f(r) + ' 0 0 0 ' + f(cx + r) + ' ' + f(cy) + 'C' + f(cx + r) + ' ' +
      f(cy - r * 0.5) + ' ' + f(cx + r * 0.3) + ' ' + f(top + h * 0.28) + ' ' + f(cx) + ' ' + f(top) + 'Z';
  }
  function ch(type, cx, footY, sc, o) {
    o = o || {}; o.x = cx - 60 * sc; o.y = footY - 140 * sc; o.scale = sc;
    return MP.char(type, o);
  }

  /* ---------- small text helpers ---------- */
  /* «3 минуты», «2,5 минуты», «5 минут», «1 минута» */
  function minutesRu(sec) {
    var half = Math.max(0.5, Math.round(sec / 30) / 2);
    if (half % 1) return String(half).replace('.', ',') + ' минуты';
    var n = half, m10 = n % 10, m100 = n % 100;
    var w = (m10 === 1 && m100 !== 11) ? 'минута' : (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) ? 'минуты' : 'минут';
    return n + ' ' + w;
  }
  function mss(t) { t = Math.max(0, Math.floor(t)); var s = t % 60; return Math.floor(t / 60) + ':' + (s < 10 ? '0' : '') + s; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /* ================================================================ film ================================== */
  /* illustrated poster (only when media/poster.jpg is missing): film strip, title, part of the cast */
  function posterArt() {
    var s = R(0, 0, 1600, 900, 0, INK) + P('M600 0H1000L1360 900H240Z', '#221C55') + C(800, 1020, 560, NIGHT);
    for (var i = 0; i < 24; i++) {
      var x = 16 + i * 68;
      s += R(x, 14, 36, 22, 6, CREAM, ' fill-opacity=".22"') + R(x, 864, 36, 22, 6, CREAM, ' fill-opacity=".22"');
    }
    var rnd = MP.seeded ? MP.seeded(9) : Math.random;
    for (i = 0; i < 26; i++) s += C(60 + rnd() * 1480, 60 + rnd() * 380, 1.5 + rnd() * 2.5, CREAM, ' fill-opacity="' + f(0.2 + rnd() * 0.4) + '"');
    s += '<text x="800" y="166" text-anchor="middle" font-family="' + FONT_D + '" font-weight="900" font-size="112" fill="' + CREAM + '" letter-spacing="-2">Фабрика</text>' +
      '<text x="800" y="280" text-anchor="middle" font-family="' + FONT_D + '" font-weight="900" font-size="112" fill="' + MINT + '" letter-spacing="-2">приложений</text>';
    var cast = [['pisar', 190, 1.62], ['pridira', 390, 1.62], ['brigadir', 590, 1.7], ['plant', 800, 1.9], ['master', 1010, 1.7, 'chief'],
      ['ispytatel', 1210, 1.62], ['priyomshchik', 1410, 1.62]];
    cast.forEach(function (c) {
      if (c[0] === 'plant') s += MP.plant('bloom', { x: c[1] - 60 * c[2], y: 872 - 140 * c[2], scale: c[2] });
      else s += ch(c[0], c[1], 872, c[2], { variant: c[3] });
    });
    return '<svg class="fm-poster" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">' + s + '</svg>';
  }

  /* duration in the title. Done EAGERLY (DOMContentLoaded: media/chapters.js loads after this file), not in the lazy
   * build: the longer title can wrap onto another line, and a section that grows when it initialises breaks in-page
   * jumps. build() calls it again only as a fallback (idempotent). */
  var titled = false;
  function filmTitle() {
    var h2 = document.getElementById('film-h'), V = window.MP_VIDEO;
    if (titled || !h2 || !V || !(V.duration > 0)) return;
    titled = true;
    h2.textContent = 'Посмотрите фильм — ' + minutesRu(V.duration);
    if (MP.nbsp) MP.nbsp(h2);
  }
  document.addEventListener('DOMContentLoaded', filmTitle);

  function buildFilm(section) {
    var frame = section.querySelector('.film-frame'), video = section.querySelector('#film-video');
    var h2 = section.querySelector('#film-h'), box = section.querySelector('#film-transcript');
    var st = section.__film = { ok: null, frame: frame, video: video, h2: h2, orig: h2 ? h2.textContent : '' };

    filmTitle();
    var V = window.MP_VIDEO;

    /* transcript: one paragraph per chapter, each with a time button */
    var T = window.MP_TRANSCRIPT;
    if (box && T && T.length) {
      var chapters = (V && V.chapters && V.chapters.length) ? V.chapters.slice() : null, html = '';
      if (chapters) {
        chapters.sort(function (a, b) { return a.start - b.start; });
        chapters.forEach(function (c, i) {
          var end = i + 1 < chapters.length ? chapters[i + 1].start : Infinity;
          var lines = T.filter(function (e) { return e.start >= c.start - 0.05 && e.start < end - 0.05; }).map(function (e) { return e.text; });
          if (!lines.length) return;
          html += '<div class="tr-chap" data-start="' + c.start + '"><button type="button" class="tr-time" data-t="' + c.start +
            '" aria-label="Смотреть с ' + mss(c.start) + ': ' + esc(c.title) + '">' + mss(c.start) + '</button>' +
            '<div class="tr-body"><h3 class="tr-title">' + esc(c.title) + '</h3><p>' + esc(lines.join(' ')) + '</p></div></div>';
        });
      } else {
        T.forEach(function (e) {
          html += '<div class="tr-chap" data-start="' + e.start + '"><button type="button" class="tr-time" data-t="' + e.start +
            '" aria-label="Смотреть с ' + mss(e.start) + '">' + mss(e.start) + '</button><div class="tr-body"><p>' + esc(e.text) + '</p></div></div>';
        });
      }
      box.innerHTML = html;
      if (MP.nbsp) MP.nbsp(box);
    }

    /* illustrated stand-in poster, shown only if media/poster.jpg fails */
    if (frame && video && !frame.querySelector('.fm-poster')) {
      frame.insertAdjacentHTML('afterbegin', posterArt());
      var art = frame.querySelector('.fm-poster');
      art.hidden = true;
      var src = video.getAttribute('poster');
      if (src) {
        var img = new Image();
        img.onerror = function () { art.hidden = false; };
        img.src = src;
      } else art.hidden = false;
    }

    /* the film itself keeps preload="none" (≈40 MB; nothing is fetched until you press play). A missing or broken file
     * shows up as an error on the <video>/<source> or a rejected play() — then the fallback line replaces the button. */
    if (!video) return;
    var source = video.querySelector('source');
    var fail = function () {
      if (st.ok === false) return;
      st.ok = false;
      frame.classList.add('is-offline');
      frame.classList.remove('is-playing');
      var fb = frame.querySelector('.film-fallback'); if (fb) fb.hidden = false;
      var pb = frame.querySelector('.film-play'); if (pb) pb.hidden = true;
      video.removeAttribute('controls');
      var art = frame.querySelector('.fm-poster'); if (art) art.hidden = false;
      MP.$$('.tr-time', section).forEach(function (b) { b.disabled = true; });
      section.classList.add('film-offline');
    };
    st.fail = fail;
    video.addEventListener('error', fail);
    if (source) source.addEventListener('error', fail);
    video.addEventListener('loadedmetadata', function () { st.ok = true; });
  }

  function wireFilm(section, api) {
    var st = section.__film;
    if (!st || !st.video) return;
    var frame = st.frame, video = st.video, btn = frame.querySelector('[data-action="film-play"]');
    function start() {
      frame.classList.add('is-playing', 'is-started');
      var p;
      try { p = video.play(); } catch (e) { st.fail(); return; }
      if (p && p.catch) p.catch(function (err) { if (err && err.name !== 'AbortError' && err.name !== 'NotAllowedError') st.fail(); });
    }
    api.on(btn, 'click', function () { if (st.ok !== false) { start(); try { video.focus({ preventScroll: true }); } catch (e) {} } });
    api.on(video, 'play', function () { frame.classList.add('is-playing', 'is-started'); });
    api.on(video, 'ended', function () { frame.classList.remove('is-playing'); });
    var chaps = MP.$$('.tr-chap', section);
    api.on(section.querySelector('#film-transcript'), 'click', function (e) {
      var b = e.target.closest && e.target.closest('.tr-time');
      if (!b || b.disabled || st.ok === false) return;
      var t = parseFloat(b.getAttribute('data-t')) || 0;
      try { video.currentTime = t; } catch (err) {}
      start();
      frame.scrollIntoView({ behavior: api.calm ? 'auto' : 'smooth', block: 'center' });
    });
    var lastNow = null;
    api.on(video, 'timeupdate', function () {
      var t = video.currentTime, now = null;
      chaps.forEach(function (c) { if (parseFloat(c.getAttribute('data-start')) <= t + 0.2) now = c; });
      if (now !== lastNow) {
        if (lastNow) lastNow.classList.remove('is-now');
        if (now) now.classList.add('is-now');
        lastNow = now;
      }
    });
  }

  MP.scene('film', {
    build: function (section) { buildFilm(section); },
    init: function (section, api) {
      wireFilm(section, api);
      var gsap = api.gsap, frame = section.querySelector('.film-frame'), btn = section.querySelector('.film-play');
      if (!gsap || !frame) return;
      var tl = gsap.timeline({ paused: true });
      tl.from(frame, { y: 70, rotation: -2.2, scale: 0.95, duration: 0.8, ease: 'power3.out', clearProps: 'transform' });
      if (btn && !btn.hidden) tl.from(btn, { scale: 0.3, rotation: -40, duration: 0.6, ease: 'back.out(2.4)', clearProps: 'transform' }, 0.25);
      if (window.ScrollTrigger) window.ScrollTrigger.create({ trigger: frame, start: 'top 85%', once: true, onEnter: function () { tl.play(); } });
      else tl.play();
    },
    final: function (section, api) { wireFilm(section, api); }
  });

  /* ================================================================ final ================================= */
  function phoneArt(x, y, k) {
    /* the phone with the «Полей меня» notification, drawn without words (a phone this small cannot hold 16px text) */
    var scr = R(10, 12, 120, 236, 17, VIOLET, ' stroke="none"') +
      C(112, 58, 34, WHITE, ' fill-opacity=".09"') + R(44, 50, 52, 52, 15, MINT, SW) + P(dropD(66, 58, 34), SKY, ' stroke="' + INK + '" stroke-width="3.4"') +
      P('M73 70C75 61 83 57 88 58C88 66 82 72 74 71.5Z', LEAF_D, ' stroke="' + INK + '" stroke-width="3"') +
      G('fn-notif', R(18, 122, 104, 58, 13, CREAM, ' stroke="' + INK + '" stroke-width="3.4"') + R(27, 132, 18, 18, 5, MINT, ' stroke="' + INK + '" stroke-width="2.6"') +
        R(52, 136, 58, 8, 4, INK, ' stroke="none" fill-opacity=".85"') + R(27, 157, 84, 7, 3.5, INK, ' stroke="none" fill-opacity=".35"') +
        R(27, 168, 60, 7, 3.5, INK, ' stroke="none" fill-opacity=".35"'));
    return G('fn-phone', G('', MP.phone('blank', {}) + G('', scr), ' transform="translate(' + f(x) + ' ' + f(y) + ') scale(' + f(k) + ')"'));
  }

  /* class-photo layouts. rows: [feetY, scale, faceColour (the step face drawn in FRONT of that row, i.e. behind the next
   * one — picked so no character stands on a step of its own colour), items [type, x, variant]] */
  var FINAL = {
    wide: { W: 1600, H: 1000, px: 36, py: 44, pw: 1528, ph: 912, flags: 22, rows: [
      [405, 1.2, VIOLET, [['vesy', 170], ['strelochnik', 350], ['poryadok', 530], ['arkhitektor', 710], ['revizor', 890], ['stend', 1070], ['pochtalon', 1250], ['zhurnal', 1430]]],
      [664, 1.16, RASP, [['razvedchik', 150], ['syshchik', 310], ['obkhodchik', 470], ['pisar', 630], ['sovetnik', 800], ['pridira', 970], ['planirovshchik', 1130], ['khudozhnik', 1290], ['ratsionalizator', 1450]]],
      [930, 1.12, null, [['ispytatel', 150], ['priyomshchik', 285], ['master', 420], ['plant', 568], ['vy', 718], ['phone', 862], ['master', 1000, 'chief'], ['brigadir', 1140], ['letopisets', 1285], ['bibliotekar', 1430]]]
    ] },
    tall: { W: 1000, H: 1250, px: 26, py: 34, pw: 948, ph: 1180, flags: 13, rows: [
      [322, 1.0, MINT, [['vesy', 120], ['strelochnik', 272], ['poryadok', 424], ['stend', 576], ['pochtalon', 728], ['zhurnal', 880]]],
      [530, 1.05, VIOLET, [['arkhitektor', 140], ['revizor', 320], ['razvedchik', 500], ['syshchik', 680], ['obkhodchik', 860]]],
      [738, 1.0, RASP, [['pisar', 120], ['sovetnik', 272], ['pridira', 424], ['planirovshchik', 576], ['khudozhnik', 728], ['ratsionalizator', 880]]],
      [946, 1.0, SKY, [['ispytatel', 120], ['priyomshchik', 272], ['master', 424], ['master', 576, 'chief'], ['letopisets', 728], ['bibliotekar', 880]]],
      [1170, 1.25, null, [['brigadir', 150], ['plant', 380], ['vy', 610], ['phone', 830]]]
    ] }
  };
  function finalMode() { return window.matchMedia && window.matchMedia('(max-width: 759px)').matches ? 'tall' : 'wide'; }

  function renderFinal(stage, mode) {
    var Lo = FINAL[mode] || FINAL.wide, W = Lo.W, H = Lo.H, px = Lo.px, py = Lo.py, pw = Lo.pw, ph = Lo.ph, prx = 44;
    var s = '', i;
    /* photo card with a hard shadow and two strips of tape */
    s += R(px + 18, py + 18, pw, ph, prx, INK);
    s += R(px, py, pw, ph, prx, CREAM);
    var inner = '';
    var rnd = MP.seeded ? MP.seeded(31) : Math.random;
    for (i = 0; i < 60; i++) inner += C(px + 30 + rnd() * (pw - 60), py + 30 + rnd() * 300, 3 + rnd() * 3, VIOLET, ' fill-opacity=".08"');
    /* bunting */
    var bx0 = px + 10, bx1 = px + pw - 10, by = py + 58, sag = 60, flags = Lo.flags, cols = [VIOLET, MINT, RASP, SKY, TANG];
    inner += '<path d="M' + bx0 + ' ' + by + 'Q' + (W / 2) + ' ' + (by + sag * 2) + ' ' + bx1 + ' ' + by + '" fill="none" stroke="' + INK + '" stroke-width="4"/>';
    for (i = 0; i < flags; i++) {
      var u = (i + 0.5) / flags, fx = bx0 + (bx1 - bx0) * u, fy = by + sag * 4 * u * (1 - u);
      var ang = Math.atan2(sag * 4 * (1 - 2 * u), bx1 - bx0);
      inner += G('fn-flag', P('M-22 0L22 0L0 44Z', cols[i % 5], SW), ' transform="translate(' + f(fx) + ' ' + f(fy) + ') rotate(' + f(ang * 180 / Math.PI) + ')"');
    }
    function row(list, y, k, big) {
      var out = '';
      list.forEach(function (c, j) {
        var t = c[0], x = c[1], id = ' data-x="' + x + '"';
        if (t === 'plant') { var pk = big ? 1.5 : 1.35; out += G('fn-it fn-plant', MP.plant('bloom', { x: x - 60 * pk, y: y - 140 * pk, scale: pk }), id); }
        else if (t === 'phone') { var fk = big ? 0.9 : 0.78; out += G('fn-it fn-ph', phoneArt(x - 70 * fk, y - 260 * fk - 4, fk), id); }
        else out += G('fn-it', ch(t, x, y, t === 'vy' ? k * 1.16 : k, { variant: c[2], expr: j % 4 === 1 ? 'oh' : 'happy' }), id);
      });
      return out;
    }
    /* steps: each face is drawn over the row behind it, so everyone can pop up from behind it */
    Lo.rows.forEach(function (r, k) {
      var y = r[0], last = k === Lo.rows.length - 1;
      inner += G('fn-row', row(r[3], y, r[1], last && mode === 'tall'));
      if (!last) {
        inner += R(px - 10, y - 16, pw + 20, 24, 0, '#E8DCC6', SW) + R(px - 10, y + 6, pw + 20, 320, 0, r[2], SW) +
          '<path d="M' + (px + 20) + ' ' + (y + 40) + 'H' + (px + pw - 20) + '" stroke="' + CREAM + '" stroke-opacity=".3" stroke-width="6" stroke-dasharray="2 22" stroke-linecap="round"/>';
      } else inner += R(px - 10, y - 14, pw + 20, 240, 0, '#E8DCC6', SW);
    });
    s += '<clipPath id="fn-photo-clip"><rect x="' + px + '" y="' + py + '" width="' + pw + '" height="' + ph + '" rx="' + prx + '"/></clipPath>';
    /* the camera flash of the class photo (animated mode only; hidden in the built DOM) */
    inner += '<rect class="fn-flash" x="' + px + '" y="' + py + '" width="' + pw + '" height="' + ph + '" fill="' + WHITE + '" opacity="0" visibility="hidden"/>';
    s += G('', inner, ' clip-path="url(#fn-photo-clip)"');
    s += R(px, py, pw, ph, prx, 'none', ' stroke="' + INK + '" stroke-width="8"');
    s += G('fn-tape', R(-70, -20, 140, 40, 4, CREAM, ' fill-opacity=".85" stroke="' + INK + '" stroke-width="3"'), ' transform="translate(' + (px + 40) + ' ' + (py + 12) + ') rotate(-32)"');
    s += G('fn-tape', R(-70, -20, 140, 40, 4, CREAM, ' fill-opacity=".85" stroke="' + INK + '" stroke-width="3"'), ' transform="translate(' + (px + pw - 40) + ' ' + (py + 12) + ') rotate(30)"');
    stage.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" class="fn-svg" focusable="false" aria-hidden="true">' +
      G('fn-photo', s) + '</svg>';
    stage.setAttribute('data-mode', mode);
  }

  function animateFinal(stage, api) {
    var gsap = api.gsap, svg = stage.querySelector('svg'), made = [];
    if (!gsap || !svg) return { enter: null, anims: made };
    var items = MP.$$('.fn-it', svg).sort(function (a, b) { return (+a.getAttribute('data-x')) - (+b.getAttribute('data-x')); });
    var xs = items.map(function (it) { return +it.getAttribute('data-x'); }), x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var roots = items.map(function (it) { return it.querySelector('.c-char, .c-plant, .fn-phone') || it; });
    /* entrance: pop up from behind the steps, sweeping left → right */
    var enter = gsap.timeline({ paused: true });
    enter.from(svg.querySelector('.fn-photo'), { rotation: -4, scale: 0.9, y: 40, duration: 0.7, ease: 'back.out(1.6)', transformOrigin: '50% 60%' }, 0);
    enter.from(items, { y: 200, duration: 0.6, ease: 'back.out(1.5)', stagger: { each: 0.035, from: 'start' } }, 0.2);
    enter.from(MP.$('.fn-flag', svg), { scale: 0, rotation: -30, duration: 0.4, ease: 'back.out(3)', transformOrigin: '50% 0%', stagger: 0.025 }, 0.15);
    /* «Сы-ыр!» — everyone is up, the flash goes off, the photo gives a little jolt */
    var flashAt = 0.2 + items.length * 0.035 + 0.45;
    enter.fromTo(svg.querySelector('.fn-flash'), { autoAlpha: 0.92 }, { autoAlpha: 0, duration: 0.55, ease: 'power2.out', immediateRender: false }, flashAt);
    enter.to(svg.querySelector('.fn-photo'), { keyframes: { scale: [1, 1.018, 1] }, duration: 0.3, ease: 'power1.out', transformOrigin: '50% 60%' }, flashAt);
    /* stadium wave: arms up by x, automats hop, the фиалка shakes its flowers, the phone buzzes */
    var wave = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 1.4, delay: 1.6 });
    items.forEach(function (it, k) {
      var at = (xs[k] - x0) / Math.max(1, x1 - x0) * 1.4, root = roots[k];
      var armR = it.querySelector('.c-arm-r'), armL = it.querySelector('.c-arm-l');
      if (armR) wave.to(armR, { rotation: -100, duration: 0.24, ease: 'power2.out', yoyo: true, repeat: 1, repeatDelay: 0.12 }, at);
      if (armL) wave.to(armL, { rotation: 60, duration: 0.24, ease: 'power2.out', yoyo: true, repeat: 1, repeatDelay: 0.12 }, at + 0.04);
      wave.to(root, { y: -34, scale: 1.07, duration: 0.22, ease: 'power2.out', yoyo: true, repeat: 1 }, at);
      if (it.classList.contains('fn-plant')) wave.to(it.querySelectorAll('.c-flower'), { scale: 1.3, duration: 0.18, yoyo: true, repeat: 1, stagger: 0.05 }, at);
      if (it.classList.contains('fn-ph')) wave.to(root, { keyframes: { rotation: [0, -6, 6, -4, 0] }, duration: 0.45, ease: 'none', transformOrigin: '50% 90%' }, at);
    });
    made.push(enter, api.loop(wave));
    if (MP.blink) made.push(MP.blink(svg, api));
    return { enter: enter, anims: made };
  }

  MP.scene('final', {
    build: function (section, api) { renderFinal(api.stage, finalMode()); },
    init: function (section, api) {
      var stage = api.stage;
      if (stage.getAttribute('data-mode') !== finalMode()) renderFinal(stage, finalMode());
      var cur = animateFinal(stage, api);
      var go = function () { if (cur.enter) cur.enter.play(); };
      if (window.ScrollTrigger) window.ScrollTrigger.create({ trigger: stage, start: 'top 82%', once: true, onEnter: go });
      else go();
      /* phone ↔ tablet: re-render the photo for the other layout and restart its loops (no entrance replay) */
      if (window.matchMedia) {
        var mq = window.matchMedia('(max-width: 759px)');
        if (mq.addEventListener) api.on(mq, 'change', function () {
          cur.anims.forEach(function (a) { if (a) a.kill(); });
          renderFinal(stage, finalMode());
          cur = animateFinal(stage, api);
          if (cur.enter) cur.enter.progress(1);
        });
      }
    },
    final: function (section, api) {
      var stage = api.stage;
      if (stage.getAttribute('data-mode') !== finalMode()) renderFinal(stage, finalMode());
      if (window.matchMedia) {
        var mq = window.matchMedia('(max-width: 759px)');
        if (mq.addEventListener) api.on(mq, 'change', function () { renderFinal(stage, finalMode()); });
      }
    }
  });
})();
