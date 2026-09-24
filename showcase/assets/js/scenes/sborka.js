/* scenes/sborka.js — «Сборка: одна карточка за раз» (package B, sticky 4 steps).
 * One long factory hall (world 2880 wide = 4 stations × 720) behind a 720×540 window: the camera pans one station per
 * step while the task card rides the belt (the belt surface moves with it). Stations: Весы → Стрелочник → Художник →
 * Мастер; the card is weighed, routed, recoloured and finally hammered into a puzzle-piece «деталь».
 * Uses MP.pb (defined in chertyozh.js) for bubbles, the step driver and the stamp/hop helpers.
 */
(function () {
  'use strict';
  var MP = window.MP = window.MP || {};

  var INK = '#16123A', CREAM = '#FFF6E6', VIOLET = '#5B34F5', MINT = '#2BD99F', RASP = '#FF4F8B', SKY = '#3EC5FF',
    TANG = '#FF8A1F', STEEL = '#C9D3E6', STEEL_D = '#8E9BB8';
  var BELT_Y = 430, STOP = [400, 980, 1860, 2520];   // card stop x per station (world units)
  var SIGNS = ['Весы', 'Стрелочник', 'Художник', 'Мастер'];
  var FORK = 1100, RAMP_A = 35;                         // the lane fork at station 1 (world x) and the ramp angle

  var CARD_D = 'M-74 -96H74Q86 -96 86 -84V-12Q86 0 74 0H-74Q-86 0 -86 -12V-84Q-86 -96 -74 -96Z';
  var PIECE_D = 'M-70 0V-32A16 16 0 1 0 -70 -64V-96H-15A18 18 0 1 1 15 -96H70V-63A18 18 0 1 1 70 -33V0Z';

  function markup() {
    var PB = MP.pb, R = PB.R, C = PB.C, P = PB.P, L = PB.L, G = PB.G, place = PB.place, NS = PB.NS, T = PB.text;
    var s = '', i;

    /* static floor */
    s += R(-10, 474, 740, 80, 0, INK, NS + ' fill-opacity=".07"') + L('M0 474H720', INK, 3, ' stroke-opacity=".18"');

    /* far layer (parallax ×0.5): windows + a pipe */
    var far = L('M-40 26H1840', STEEL_D, 12, ' stroke-linecap="butt"') + L('M-40 26H1840', STEEL, 6, ' stroke-linecap="butt"');
    for (i = 0; i < 6; i++) {
      var wx = 150 + i * 330;
      far += R(wx - 4, 16, 16, 20, 3, STEEL_D, ' stroke-width="3"') +
        R(wx - 70, 150, 140, 150, 70, SKY, ' fill-opacity=".28" stroke-opacity=".35" stroke-width="4"') +
        L('M' + wx + ' 152V298M' + (wx - 68) + ' 226H' + (wx + 68), INK, 3, ' stroke-opacity=".18"');
    }
    s += '<g class="sb-far">' + far + '</g>';

    var w = '';
    /* hanging signs */
    SIGNS.forEach(function (name, k) {
      var cx = 360 + k * 720;
      w += '<g class="sb-sign">' + L('M' + (cx - 100) + ' 0V56M' + (cx + 100) + ' 0V56', INK, 3) +
        R(cx - 136, 54, 272, 58, 16, CREAM, ' stroke-width="4"') + T(cx - 14, 92, name, 24, { d: true }) +
        C(cx + 108, 83, 11, MINT, ' class="sb-slamp" stroke-width="3.5"') + '</g>';
    });

    /* station 0: Бригадир + «Готово» drawer + Весы + ghost card */
    var fc = '';
    for (i = 0; i < 3; i++) fc += '<g class="sb-fcard">' + R(198 + i * 10, 270 - i * 4, 62, 44, 6, CREAM, ' stroke-width="3"') +
      L('M' + (208 + i * 10) + ' ' + (286 - i * 4) + 'h30', SKY, 4) + '</g>';
    w += '<g class="sb-drawer">' + fc + R(186, 296, 112, 148, 12, MINT, ' stroke-width="4"') + R(198, 314, 88, 38, 9, CREAM, ' stroke-width="3"') +
      T(242, 340, 'Готово', 19, { w: 800 }) + C(242, 390, 6.5, CREAM, ' stroke-width="3"') + '</g>';
    w += '<g class="sb-brig">' + place(MP.char('brigadir'), 16, 269, 1.35) + '</g>';
    w += '<g class="sb-vesy">' + place(MP.machine('vesy'), 298, 218, 1.7) + '</g>';
    w += '<g class="sb-ghost">' + R(516, 132, 188, 168, 22, CREAM, ' stroke-width="3.5" stroke-dasharray="10 9"') +
      '<g class="sb-gh sb-gh-l">' + R(542, 156, 68, 116, 10, CREAM, ' stroke-width="3.5"') + T(576, 226, '1', 30, { d: true }) + '</g>' +
      '<g class="sb-gh sb-gh-r">' + R(610, 156, 68, 116, 10, CREAM, ' stroke-width="3.5"') + T(644, 226, '2', 30, { d: true }) + '</g>' +
      '<g class="sb-gh-whole" opacity="0">' + R(542, 156, 136, 116, 12, CREAM, ' stroke-width="3.5"') + T(610, 222, 'Большая', 22, { w: 800 }) + '</g>' +
      L('M610 144V284', RASP, 4, ' class="sb-gh-cut" stroke-dasharray="8 8" opacity="0"') +
      R(532, 114, 156, 36, 18, CREAM, ' stroke-width="3.5" stroke-dasharray="7 6"') + T(610, 139, 'если большая', 19, { w: 800 }) + '</g>';

    /* station 1: Стрелочник, a railway-like fork: the ramp climbs to Главный мастер's balcony, the main belt runs on
     * to the ordinary Мастер. A two-arm signpost at the fork names both lanes; the chosen arm lights mint. */
    w += '<g class="sb-strel">' + place(MP.machine('strelochnik'), 722, 262, 1.4) + '</g>';
    w += L('M1226 352V432', STEEL_D, 10, ' stroke-linecap="butt"') + L('M1226 352V432', INK, 3, ' stroke-opacity=".35"');
    w += '<g transform="translate(' + FORK + ' 430) rotate(' + (-RAMP_A) + ')">' + MP.belt({ w: 232, h: 26, pitch: 24, rollers: false, cls: 'sb-ramp' }) + '</g>';
    w += '<g class="sb-balcony">' + P('M1282 362V398L1320 362ZM1394 362V398L1356 362Z', STEEL_D, ' stroke-width="3.5"') +
      R(1262, 300, 174, 62, 12, STEEL, ' stroke-width="4"') + R(1273, 307, 152, 48, 10, CREAM, ' stroke-width="3"') +
      T(1349, 331, 'Главный\nмастер', 19, { mid: true, w: 800, lh: 1.02 }) + '</g>';
    w += '<g class="sb-chief">' + place(MP.char('master', { variant: 'chief' }), 1290, 169, 1) + '</g>';
    /* signpost: pole + two arrow boards (upper → the balcony, lower → straight on to the Мастер) */
    function laneBoard(cls, txt, fill) {
      return '<g class="sb-lane ' + cls + '">' + P('M0 -18H106L124 0L106 18H0Z', fill, ' class="sb-lane-shape" stroke-width="3.5"') +
        T(55, 7, txt, 19, { w: 800 }) + '</g>';
    }
    w += '<g class="sb-post">' + R(FORK - 2, 246, 12, 186, 4, STEEL, ' stroke-width="3.5"') + C(FORK + 4, 244, 9, STEEL_D, ' stroke-width="3.5"') +
      '<g transform="translate(' + (FORK + 6) + ' 278) rotate(-27)">' + laneBoard('sb-lane-hi', 'Главному', CREAM) + '</g>' +
      '<g transform="translate(' + (FORK + 6) + ' 324)">' + laneBoard('sb-lane-lo', 'Мастеру', MINT) + '</g></g>';

    /* station 2: Художник + paint */
    w += '<g class="sb-splats">' +
      '<g class="sb-splat">' + P('M1822 194c20-18 50-6 48 18 16 4 16 26-2 30-4 22-34 26-44 8-22 4-32-22-14-34-10-14 2-30 12-22z', VIOLET, ' stroke-width="3.5"') + C(1810, 262, 7, VIOLET, ' stroke-width="3"') + '</g>' +
      '<g class="sb-splat">' + P('M1972 170c18-10 40 4 36 22 14 8 8 30-8 28-6 18-30 18-36 2-18-2-20-24-4-30-4-14 4-24 12-22z', MINT, ' stroke-width="3.5"') + C(2024, 166, 6, MINT, ' stroke-width="3"') + '</g>' +
      '<g class="sb-splat">' + P('M1998 300c14-8 32 2 30 16 12 6 6 24-6 22-4 14-24 14-28 2-14-2-16-18-4-24-2-10 2-18 8-16z', SKY, ' stroke-width="3.5"') + '</g>' +
      '</g>';
    w += '<g class="sb-khud">' + place(MP.char('khudozhnik'), 1470, 237, 1.6) + '</g>';

    /* station 3: Мастер */
    w += '<g class="sb-master">' + place(MP.char('master'), 2250, 237, 1.6) + '</g>';

    /* the main belt (in front of everybody) + the switch plate */
    w += MP.belt({ x: -120, y: BELT_Y, w: 3120, h: 40, pitch: 28, legs: 34 });
    /* the switch blade (pivot at the fork): points up the ramp at the start, lies straight once the Стрелочник decides */
    w += '<g class="sb-switch">' + R(FORK - 6, 416, 104, 14, 7, TANG, ' stroke-width="3.5"') + L('M' + (FORK + 10) + ' 423H' + (FORK + 88), INK, 3, ' stroke-opacity=".3" stroke-dasharray="6 8"') +
      C(FORK, 423, 9, STEEL_D, ' stroke-width="3.2"') + C(FORK, 423, 3, INK, NS) + '</g>';

    /* swatches (fly from the palette) and sparks */
    w += '<g class="sb-sw">' + R(-23, -16, 46, 32, 9, VIOLET, ' stroke-width="3.5"') + '</g>' +
      '<g class="sb-sw">' + R(-23, -16, 46, 32, 9, MINT, ' stroke-width="3.5"') + '</g>' +
      '<g class="sb-sw">' + R(-26, -18, 52, 36, 9, CREAM, ' stroke-width="3.5"') + T(0, 8, 'Аа', 20, { d: true }) + '</g>';
    w += PB.splash(2452, 346, 26, 50, [-150, -110, -70, 170, 200], INK, 'sb-spark');

    /* the task card: plain → styled → puzzle piece (built as the piece at the Мастер) */
    var plain = P(CARD_D, CREAM, ' stroke-width="3.5"') + C(0, -96, 6.5, RASP, ' stroke-width="3"') +
      T(0, -46, 'Напоминание\nо поливе', 21, { mid: true, w: 800, lh: 1.08 });
    var styled = P(CARD_D, CREAM, ' stroke-width="3.5"') +
      P('M-74 -96H74Q86 -96 86 -84V-66H-86V-84Q-86 -96 -74 -96Z', VIOLET, ' stroke-width="3.5"') +
      P('M-64 -90c-5 7-8 11-8 15a8 8 0 0 0 16 0c0-4-3-8-8-15z', SKY, ' stroke-width="2.6"') +
      T(62, -73, '9:00', 19, { anchor: 'end', fill: CREAM, w: 800 }) +
      T(0, -34, 'Напоминание\nо поливе', 21, { mid: true, w: 800, lh: 1.08 }) + C(70, -12, 6, MINT, ' stroke-width="2.6"');
    var bell = '<g class="sb-bell">' + P('M0 -88C-12 -88-19-79-19-68V-58L-25-50H25L19-58V-68C19-79 12-88 0-88Z', CREAM, ' stroke-width="3.5"') +
      C(0, -45, 5.5, CREAM, ' stroke-width="3"') + C(0, -91, 3.5, INK, NS) + L('M-30 -76q-5 8 0 16M30 -76q5 8 0 16', INK, 3) + '</g>';
    w += '<g class="sb-card" transform="translate(' + STOP[3] + ' ' + BELT_Y + ')">' +
      '<g class="sb-plain" opacity="0">' + plain + '</g>' + '<g class="sb-styled" opacity="0">' + styled + '</g>' +
      P(PIECE_D, VIOLET, ' class="sb-morph" stroke-width="4"') + bell + T(0, -12, 'деталь', 20, { w: 800, cls: 'sb-dlabel', fill: CREAM }) + '</g>';

    /* speech bubbles last (always on top) */
    w += PB.bubble({ x: 110, y: 272, text: 'Такого ещё не было', cls: 'sb-b0', off: true });
    w += PB.bubble({ x: 356, y: 240, text: 'Бип. Вес в норме', tail: 'dr', cls: 'sb-b1', off: true });
    w += PB.bubble({ x: 818, y: 250, text: 'Бип. Трудное — Главному', size: 20, cls: 'sb-b2', off: true });
    w += PB.bubble({ x: 818, y: 250, text: 'Бип. Простое — Мастеру', size: 20, cls: 'sb-b3', off: true });
    w += PB.bubble({ x: 1600, y: 256, text: 'Будет красиво!', cls: 'sb-b4', off: true });
    w += PB.bubble({ x: 2330, y: 256, text: 'Готово, проверяйте!', cls: 'sb-b5' });

    s += '<g class="sb-world" transform="translate(-2160 0)">' + w + '</g>';
    return '<g' + PB.ROOT + '>' + s + '</g>';
  }

  function build(section, api) {
    MP.pb.mount(api, markup(), 'sb-svg');
    /* the far layer's final (station 3) offset */
    var far = api.stage.querySelector('.sb-far');
    if (far) far.setAttribute('transform', 'translate(-1080 0)');
  }

  function master(section, api) {
    var PB = MP.pb, gsap = window.gsap, svg = api.stage.querySelector('svg');
    var $ = PB.q(svg), $$ = PB.qa(svg);
    PB.frame(svg, api, '0 50 720 450');
    var tl = gsap.timeline({ paused: true });
    var world = $('.sb-world'), far = $('.sb-far'), card = $('.sb-card');
    var plain = $('.sb-plain'), styled = $('.sb-styled'), morph = $('.sb-morph'), bell = $('.sb-bell'), dlabel = $('.sb-dlabel');
    var chev = $('.sb-world > .belt .belt-chev'), pitch = 28;
    var rollers = $$('.sb-world > .belt .belt-roller');
    var slamps = $$('.sb-slamp');
    var bub = function (k) { return $('.sb-b' + k); };
    var wrapX = gsap.utils.unitize(gsap.utils.wrap(0, pitch));

    /* ----- start state: camera at station 0, card off-stage left, plain ----- */
    gsap.set(world, { x: 0 });
    gsap.set(far, { x: 0 });
    gsap.set(card, { x: -140, y: BELT_Y, rotation: 0, transformOrigin: '50% 100%' });
    gsap.set(plain, { autoAlpha: 1 });
    gsap.set(styled, { autoAlpha: 0, scale: 1, transformOrigin: '50% 100%' });
    gsap.set(morph, { autoAlpha: 0, attr: { d: CARD_D }, fill: VIOLET });
    gsap.set([bell, dlabel], { autoAlpha: 0, scale: 0, transformOrigin: '50% 50%' });
    gsap.set(slamps, { fill: STEEL_D });
    $$('.pb-bub').forEach(function (b) {
      gsap.set(b, { autoAlpha: 0, scale: 0, svgOrigin: b.getAttribute('data-tx') + ' ' + b.getAttribute('data-ty') });
    });
    gsap.set($$('.pb-splash'), { autoAlpha: 0 });

    var fcards = $$('.sb-fcard'), brig = $('.sb-brig .c-char');
    var vNeedle = $('.sb-vesy .c-needle'), vLamp = $('.sb-vesy .c-lamp--main circle');
    var ghost = $('.sb-ghost'), ghWhole = $('.sb-gh-whole'), ghCut = $('.sb-gh-cut'), ghL = $('.sb-gh-l'), ghR = $('.sb-gh-r');
    gsap.set(fcards, { transformOrigin: '50% 100%' });
    gsap.set(vLamp, { fill: STEEL_D });
    gsap.set(ghost, { autoAlpha: 0, scale: 0.6, transformOrigin: '50% 50%' });
    gsap.set(ghWhole, { autoAlpha: 1 });
    gsap.set([ghL, ghR], { autoAlpha: 0 });
    gsap.set(ghCut, { autoAlpha: 0, drawSVG: '0%' });

    var lever = $('.sb-strel .c-lever'), sLamp = $('.sb-strel .c-lamp--main circle'), sw = $('.sb-switch');
    var laneHi = $('.sb-lane-hi'), laneLo = $('.sb-lane-lo'), loShape = $('.sb-lane-lo .sb-lane-shape'), chiefArm = $('.sb-chief .c-arm-r');
    gsap.set(sw, { svgOrigin: FORK + ' 423', rotation: -RAMP_A });
    gsap.set(sLamp, { fill: STEEL_D });
    gsap.set(loShape, { fill: CREAM });
    gsap.set([laneHi, laneLo], { transformOrigin: '0% 50%' });

    var splats = $$('.sb-splat'), sws = $$('.sb-sw'), khud = $('.sb-khud .c-char');
    gsap.set(splats, { autoAlpha: 0, scale: 0, transformOrigin: '50% 50%' });
    gsap.set(sws, { autoAlpha: 0, x: 1507, y: 396, scale: 0.6 });

    var mArm = $('.sb-master .c-arm-r'), spark = $('.sb-spark');

    /* a ride = card along the belt + the belt surface + rollers, with the camera following */
    function ride(pos, toX, cam, dur) {
      var dx = toX - (ride.x || -140);
      ride.x = toX;
      tl.to(card, { x: toX, duration: dur, ease: 'power2.inOut' }, pos)
        .to(card, { keyframes: { rotation: [0, -3, 2, -1, 0] }, duration: dur, ease: 'none' }, pos)
        .to(chev, { x: '+=' + dx, duration: dur, ease: 'power2.inOut', modifiers: { x: wrapX } }, pos)
        .to(rollers, { rotation: '+=' + Math.round(dx * 1.2), duration: dur, ease: 'power2.inOut' }, pos);
      if (cam != null) {
        tl.to(world, { x: -cam * 720, duration: dur, ease: 'power2.inOut' }, pos)
          .to(far, { x: -cam * 360, duration: dur, ease: 'power2.inOut' }, pos);
      }
    }
    function say(k, pos, out) {
      tl.to(bub(k), { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' }, pos);
      if (out != null) tl.to(bub(k), { autoAlpha: 0, scale: 0, duration: 0.2, ease: 'power2.in' }, out);
    }
    function lampOn(el, pos) {
      PB.lamp(tl, el, MINT, pos);
    }

    /* ----- scales ----- */
    fcards.forEach(function (c, k) {
      tl.to(c, { y: -26, rotation: k % 2 ? 9 : -9, duration: 0.16, ease: 'power2.out', yoyo: true, repeat: 1 }, 0.15 + k * 0.2);
    });
    tl.to(brig, { scaleY: 0.9, duration: 0.14, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 0.85);
    say(0, 0.9, 2.3);
    ride(0.5, STOP[0], null, 1.3);
    tl.to(card, { motionPath: { path: [{ x: STOP[0] - 10, y: BELT_Y - 110 }, { x: STOP[0], y: BELT_Y - 76 }], curviness: 1.2 }, duration: 0.5, ease: 'power1.inOut' }, 1.9)
      .to(card, { scaleY: 0.3, scaleX: 1.05, duration: 0.18, ease: 'power2.in' }, 2.33)
      .to(vNeedle, { keyframes: { rotation: [0, 55, -28, 30, -14, 12, 8] }, duration: 1.2, ease: 'power1.out' }, 2.45);
    lampOn(vLamp, 3.5);
    say(1, 3.55);
    tl.to(card, { scaleY: 1, scaleX: 1, duration: 0.3, ease: 'back.out(2)' }, 4.1)
      .to(card, { motionPath: { path: [{ x: STOP[0] + 100, y: BELT_Y - 130 }, { x: STOP[0] + 200, y: BELT_Y }], curviness: 1.2 }, duration: 0.5, ease: 'power1.inOut' }, 4.1)
      .to(ghost, { autoAlpha: 1, scale: 1, duration: 0.45, ease: 'back.out(1.8)' }, 4.5)
      .to(ghCut, { autoAlpha: 1, drawSVG: '100%', duration: 0.35, ease: 'power2.out' }, 5.0)
      .set(ghWhole, { autoAlpha: 0 }, 5.4)
      .set([ghL, ghR], { autoAlpha: 1 }, 5.4)
      .to(ghCut, { autoAlpha: 0, duration: 0.2 }, 5.4)
      .to(ghL, { x: -10, rotation: -7, duration: 0.4, ease: 'back.out(2.4)', transformOrigin: '50% 100%' }, 5.4)
      .to(ghR, { x: 10, rotation: 7, duration: 0.4, ease: 'back.out(2.4)', transformOrigin: '50% 100%' }, 5.4);
    lampOn(slamps[0], 5.6);
    ride.x = STOP[0] + 200;
    tl.addLabel('scales', 6.0);
    tl.to(bub(1), { autoAlpha: 0, scale: 0, duration: 0.2 }, 'scales');

    /* ----- switch ----- */
    /* the card waits before the fork; the rule is said, Главный мастер perks up, the lever flips the blade straight */
    ride('scales', STOP[1], 1, 1.5);
    say(2, 'scales+=1.45', 'scales+=2.6');
    tl.to(laneHi, { scale: 1.12, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' }, 'scales+=1.55')
      .to(chiefArm, { rotation: -100, duration: 0.3, ease: 'back.out(2)' }, 'scales+=1.6')
      .to(chiefArm, { rotation: -78, duration: 0.16, yoyo: true, repeat: 3, ease: 'sine.inOut' }, '>')
      .to(lever, { rotation: 62, duration: 0.35, ease: 'back.out(2.5)' }, 'scales+=2.5')
      .to(sw, { rotation: 0, duration: 0.4, ease: 'back.out(2)' }, 'scales+=2.6')
      .to(chiefArm, { rotation: 0, duration: 0.35, ease: 'power2.inOut' }, 'scales+=2.7');
    lampOn(sLamp, 'scales+=2.75');
    say(3, 'scales+=2.8');
    tl.set(loShape, { fill: MINT }, 'scales+=2.95')
      .to(laneLo, { scale: 1.15, duration: 0.14, ease: 'power2.out' }, 'scales+=2.95')
      .to(laneLo, { scale: 1, duration: 0.45, ease: 'elastic.out(1,.5)' }, '>')
      .to(card, { y: BELT_Y - 22, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' }, 'scales+=3.15');
    lampOn(slamps[1], 'scales+=3.35');
    tl.addLabel('switch', 'scales+=3.8');
    tl.to(bub(3), { autoAlpha: 0, scale: 0, duration: 0.2 }, 'switch');

    /* ----- artist ----- */
    ride('switch', STOP[2], 2, 1.5);
    say(4, 'switch+=1.3');
    tl.to(khud, { rotation: -6, duration: 0.18, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 'switch+=1.5')
      .to(splats, { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(3)', stagger: 0.1 }, 'switch+=1.6');
    sws.forEach(function (el, k) {
      var tgt = [{ x: STOP[2] - 40, y: BELT_Y - 60 }, { x: STOP[2] + 30, y: BELT_Y - 64 }, { x: STOP[2] - 2, y: BELT_Y - 40 }][k];
      tl.set(el, { autoAlpha: 1 }, 'switch+=' + (1.9 + k * 0.22))
        .to(el, { scale: 1, duration: 0.2 }, '<')
        .add(PB.hop(el, tgt.x, tgt.y, 110, 0.55, { rotation: k === 1 ? 200 : -160 }), '<')
        .to(el, { scale: 0, autoAlpha: 0, duration: 0.18, ease: 'power2.in' }, '>-0.02');
    });
    tl.to(styled, { autoAlpha: 1, duration: 0.15 }, 'switch+=2.75')
      .fromTo(styled, { scale: 1.18 }, { scale: 1, duration: 0.45, ease: 'back.out(2.4)', immediateRender: false }, 'switch+=2.75')
      .to(plain, { autoAlpha: 0, duration: 0.15 }, 'switch+=2.8');
    lampOn(slamps[2], 'switch+=3.3');
    tl.addLabel('artist', 'switch+=3.8');
    tl.to(bub(4), { autoAlpha: 0, scale: 0, duration: 0.2 }, 'artist');

    /* ----- master ----- */
    ride('artist', STOP[3], 3, 1.5);
    tl.to(mArm, { rotation: -55, duration: 0.3, ease: 'power2.out' }, 'artist+=1.4');
    for (var h = 0; h < 3; h++) {
      var th = 1.75 + h * 0.5;
      tl.to(mArm, { rotation: 32, duration: 0.14, ease: 'power3.in' }, 'artist+=' + th)
        .to(card, { scaleY: 0.84, scaleX: 1.08, duration: 0.08, ease: 'power2.out' }, 'artist+=' + (th + 0.13))
        .to(card, { scaleY: 1, scaleX: 1, duration: 0.3, ease: 'elastic.out(1,.45)' }, '>');
      PB.burst(tl, spark, 'artist+=' + (th + 0.12));
      if (h < 2) tl.to(mArm, { rotation: -55, duration: 0.24, ease: 'power2.out' }, 'artist+=' + (th + 0.2));
    }
    tl.to(mArm, { rotation: 0, duration: 0.35, ease: 'back.out(2)' }, 'artist+=3.05')
      .set(morph, { autoAlpha: 1 }, 'artist+=3.1')
      .to(styled, { autoAlpha: 0, duration: 0.2 }, 'artist+=3.1')
      .to(morph, { morphSVG: PIECE_D, duration: 0.55, ease: 'back.out(1.6)' }, 'artist+=3.15')
      .to(bell, { autoAlpha: 1, scale: 1, duration: 0.45, ease: 'back.out(2.4)' }, 'artist+=3.55')
      .to(bell, { rotation: 14, duration: 0.09, yoyo: true, repeat: 5, ease: 'sine.inOut' }, '>')
      .to(dlabel, { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' }, 'artist+=3.7');
    say(5, 'artist+=3.9');
    lampOn(slamps[3], 'artist+=4.0');
    tl.addLabel('master', 'artist+=4.4');
    return tl;
  }

  MP.scene('sborka', {
    build: build,
    init: function (section, api) {
      var tl = master(section, api);
      section.__pb = MP.pb.drive(api, tl);
      MP.blink(api.stage, api);
    },
    final: function (section, api) {
      var tl = master(section, api);
      section.__pb = MP.pb.drive(api, tl, { first: 'scales' });
    }
  });
})();
