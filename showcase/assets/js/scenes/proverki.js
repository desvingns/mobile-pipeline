/* scenes/proverki.js — «Проверки: брак едет назад» (package B, sticky 4 steps).
 * The inspection hall continues the assembly hall: the puzzle-piece «деталь» rides the main belt past Порядок, Ревизор
 * (a dashed «если риск» station), the test stand and the Приёмщик. Under the main belt runs a RASPBERRY return belt
 * «назад к мастеру»: when the stand fails, the camera follows the piece all the way back to the Мастер's nook and
 * forward again. [data-action=throw-defect] replays that loop (calm mode: instant state swap + live text).
 * Uses MP.pb (chertyozh.js).
 */
(function () {
  'use strict';
  var MP = window.MP = window.MP || {};

  var INK = '#16123A', CREAM = '#FFF6E6', VIOLET = '#5B34F5', MINT = '#2BD99F', RASP = '#FF4F8B', SKY = '#3EC5FF',
    TANG = '#FF8A1F', STEEL = '#C9D3E6', STEEL_D = '#8E9BB8';
  var BELT_Y = 372, RET_Y = 444, STOP = [400, 1080, 1800, 2480], FIX_X = -330;
  var SIGNS = ['Порядок', 'Ревизор', 'Испытания', 'Приёмщик'];
  var PIECE_D = 'M-70 0V-32A16 16 0 1 0 -70 -64V-96H-15A18 18 0 1 1 15 -96H70V-63A18 18 0 1 1 70 -33V0Z';
  var TAGS = [{ t: 'ночью', x: -104, y: -128, r: -8 }, { t: 'без сети', x: 0, y: -170, r: 3 }, { t: 'в 9:00', x: 104, y: -128, r: 8 }];

  function markup() {
    var PB = MP.pb, R = PB.R, C = PB.C, P = PB.P, L = PB.L, place = PB.place, NS = PB.NS, T = PB.text;
    var s = '', w = '', i;

    s += R(-10, 490, 740, 60, 0, INK, NS + ' fill-opacity=".07"') + L('M0 490H720', INK, 3, ' stroke-opacity=".18"');
    var far = L('M-520 30H2400', STEEL_D, 12, ' stroke-linecap="butt"') + L('M-520 30H2400', STEEL, 6, ' stroke-linecap="butt"');
    for (i = -2; i < 8; i++) {
      var wx = 60 + i * 300;
      far += R(wx - 4, 20, 16, 20, 3, STEEL_D, ' stroke-width="3"') +
        C(wx + 150, 250, 58, SKY, ' fill-opacity=".24" stroke-opacity=".3" stroke-width="4"') +
        L('M' + (wx + 150) + ' 194V306M' + (wx + 94) + ' 250H' + (wx + 206), INK, 3, ' stroke-opacity=".15"');
    }
    s += '<g class="pv-far">' + far + '</g>';

    /* hanging signs (the Мастер's nook gets one too) */
    ['Мастер'].concat(SIGNS).forEach(function (name, k) {
      var cx = -360 + k * 720;
      w += '<g class="pv-sign">' + L('M' + (cx - 100) + ' 0V56M' + (cx + 100) + ' 0V56', INK, 3) +
        R(cx - 136, 54, 272, 58, 16, CREAM, ' stroke-width="4"') + T(cx - 14, 92, name, 24, { d: true }) +
        C(cx + 108, 83, 11, MINT, ' class="pv-slamp' + (k ? '' : ' pv-slamp-m') + '" stroke-width="3.5"') + '</g>';
    });

    /* Мастер's nook */
    w += '<g class="pv-master">' + place(MP.char('master', { expr: 'focus' }), -650, 191, 1.5) + '</g>';
    w += '<g class="pv-once" opacity="0">' + R(-232, 150, 196, 42, 21, TANG, ' stroke-width="3.5"') + T(-134, 178, 'одна попытка', 20, { w: 800 }) + '</g>';

    /* station 0: Порядок + scanner arch + shelf tiles */
    w += '<g class="pv-pory">' + place(MP.machine('poryadok'), 30, 191, 1.5) + '</g>';
    var tiles = '';
    for (i = 0; i < 3; i++) {
      var tx = 520 + i * 64;
      tiles += '<g class="pv-tile">' + R(tx, 212, 54, 54, 12, CREAM, ' class="pv-tile-bg" stroke-width="3.5"') +
        L('M' + (tx + 10) + ' 232H' + (tx + 44) + 'M' + (tx + 10) + ' 252H' + (tx + 44), INK, 3) +
        R(tx + 14, 220, 8, 11, 1.5, [SKY, TANG, RASP][i], ' stroke-width="2"') + R(tx + 28, 240, 12, 11, 1.5, [MINT, SKY, VIOLET][i], ' stroke-width="2"') +
        '<g class="pv-tick">' + C(tx + 50, 214, 13, MINT, ' stroke-width="3"') + L('M' + (tx + 44) + ' 214l4.5 4.5 8-9', INK, 3.4, ' class="pv-tick-path"') + '</g></g>';
    }
    w += tiles;
    w += '<g class="pv-arch-back">' + L('M316 372V280A84 84 0 0 1 484 280V372', INK, 16) + L('M316 372V280A84 84 0 0 1 484 280V372', STEEL, 8) + '</g>';

    /* station 1: the optional «если риск» station */
    w += R(740, 138, 680, 250, 30, 'none', ' class="pv-risk" stroke-width="4" stroke-dasharray="14 12" stroke-opacity=".7"');
    w += '<g class="pv-risktag">' + R(758, 120, 150, 40, 20, CREAM, ' stroke-width="3.5" stroke-dasharray="7 6"') + T(833, 147, 'если риск', 20, { w: 800 }) + '</g>';
    w += '<g class="pv-rev">' + place(MP.char('revizor', { expr: 'focus' }), 766, 197, 1.45) + '</g>';
    w += '<g class="pv-loop">' + C(1206, 226, 50, CREAM, ' stroke-width="3.5"') +
      '<g class="pv-loop-arrow">' + L('M1206 186A40 40 0 1 1 1168 214', VIOLET, 7, ' stroke-linecap="round"') + P('M1158 202L1166 222L1180 208Z', VIOLET, ' stroke-width="2.5"') + '</g>' +
      T(1206, 234, 'круг 1', 19, { w: 800, cls: 'pv-k1' }) + T(1206, 234, 'круг 2', 19, { w: 800, cls: 'pv-k2' }) + '</g>';
    w += '<g class="pv-arkh">' + place(MP.char('arkhitektor'), 1276, 230, 1.2) + '</g>';
    w += '<g class="pv-caps">' + R(1262, 150, 150, 46, 23, VIOLET, ' stroke-width="4"') + T(1326, 181, 'решение', 20, { w: 800, fill: CREAM }) +
      '<g class="pv-wax">' + C(1398, 158, 16, RASP, ' stroke-width="3.5"') + P('M1398 148l3 6.5 7 .8-5.2 4.8 1.4 7-6.2-3.5-6.2 3.5 1.4-7-5.2-4.8 7-.8z', CREAM, ' stroke-width="1.6"') + '</g></g>';

    /* station 2: Испытатель + Стенд */
    w += '<g class="pv-isp">' + place(MP.char('ispytatel'), 1452, 204, 1.4) + '</g>';
    w += '<g class="pv-stend">' + place(MP.machine('stend'), 1960, 184, 1.55) + '</g>';
    w += '<g class="pv-rays" opacity="0">' + L('M2032 218l-14-14M2078 218l14-14M2055 206V186M2020 244h-18M2090 244h18', RASP, 6, ' stroke-linecap="round"') + '</g>';

    /* station 3: Приёмщик + phone with the 6-check list + memo */
    w += '<g class="pv-pri">' + place(MP.char('priyomshchik'), 2176, 197, 1.45) + '</g>';
    var list = '';
    for (i = 0; i < 6; i++) {
      var bx = 22 + (i % 2) * 52, by = 70 + Math.floor(i / 2) * 52;
      list += '<g class="pv-chk">' + R(bx, by, 44, 44, 11, '#261F5E', ' class="pv-chk-bg" stroke="' + CREAM + '" stroke-width="3"') +
        L('M' + (bx + 11) + ' ' + (by + 23) + 'l8 8 15-17', INK, 5, ' class="pv-chk-path"') + '</g>';
    }
    list = PB.text(70, 52, '6 проверок', 18, { fill: CREAM, w: 800 }) + list;
    w += '<g class="pv-phone" transform="translate(2720 153) scale(.95)">' + MP.phone('blank') + '<g class="pv-list">' + list + '</g>' +
      R(10, 12, 120, 236, 17, CREAM, ' class="pv-flashscr" opacity="0" stroke="none"') + '</g>';
    w += '<path class="pv-cable" d="M2566 330C2604 332 2598 296 2626 296H2700" fill="none" stroke="' + INK + '" stroke-width="7" stroke-linecap="round"/>' +
      '<g class="pv-plug">' + R(2694, 284, 26, 24, 6, STEEL, ' stroke-width="3.5"') + L('M2720 290h8M2720 302h8', INK, 3.5) + '</g>';

    /* the two belts: main (steel) and the return belt underneath (raspberry, moving left) */
    w += MP.belt({ x: -760, y: BELT_Y, w: 3680, h: 36, pitch: 28, legs: 36, cls: 'pv-main' });
    w += MP.belt({ x: -760, y: RET_Y, w: 3680, h: 40, pitch: 28, dir: -1, color: RASP, legs: 12, cls: 'pv-ret' });
    for (i = 0; i < 5; i++) {
      var lx = -560 + i * 720;
      w += '<g class="pv-retlabel">' + R(lx, 442, 226, 28, 14, CREAM, ' stroke-width="3"') + P('M' + (lx + 14) + ' 456l12-8v16z', RASP, ' stroke-width="2.4"') +
        T(lx + 124, 463, 'назад к мастеру', 19, { w: 800 }) + '</g>';
    }
    /* scanner arch front leg + light bar (over the piece) */
    w += '<g class="pv-scan" opacity="0">' + R(326, 206, 148, 16, 8, SKY, ' fill-opacity=".75" stroke-width="3"') + L('M336 214H464', '#FFFFFF', 4, ' stroke-opacity=".8"') + '</g>';

    /* the piece (final: plugged in at the Приёмщик) */
    var piece = P(PIECE_D, VIOLET, ' stroke-width="4"') +
      '<g>' + P('M0 -88C-12 -88-19-79-19-68V-58L-25-50H25L19-58V-68C19-79 12-88 0-88Z', CREAM, ' stroke-width="3.5"') + C(0, -45, 5.5, CREAM, ' stroke-width="3"') + C(0, -91, 3.5, INK, NS) + '</g>' +
      T(0, -12, 'деталь', 20, { w: 800, fill: CREAM });
    TAGS.forEach(function (t) {
      piece += '<g class="pv-tag" opacity="0">' + L('M' + (t.x * 0.45) + ' -94L' + t.x + ' ' + (t.y + 12), INK, 2.5, ' class="pv-string"') +
        '<g transform="translate(' + t.x + ' ' + t.y + ') rotate(' + t.r + ')">' + R(-52, -17, 104, 34, 9, CREAM, ' stroke-width="3"') +
        C(-40, 0, 4, INK, NS) + T(7, 7, t.t, 19, { w: 800 }) + '</g></g>';
    });
    piece += '<g class="pv-note pv-note1" opacity="0"><g transform="translate(-60 -100) rotate(-10)">' + R(-19, -19, 38, 38, 5, TANG, ' stroke-width="3"') + T(0, 9, '1', 24, { d: true }) + '</g></g>' +
      '<g class="pv-note pv-note2" opacity="0"><g transform="translate(60 -100) rotate(9)">' + R(-19, -19, 38, 38, 5, TANG, ' stroke-width="3"') + T(0, 9, '2', 24, { d: true }) + '</g></g>' +
      '<g class="pv-patch"><g transform="translate(-40 -34) rotate(-24)">' + R(-24, -10, 48, 20, 10, MINT, ' stroke-width="3"') + R(-8, -10, 16, 20, 2, CREAM, NS + ' fill-opacity=".7"') + '</g></g>';
    w += '<g class="pv-piece" transform="translate(' + STOP[3] + ' ' + BELT_Y + ')">' + piece + '</g>';
    w += PB.splash(FIX_X - 60, 300, 24, 46, [-160, -120, -80, 180, 200], INK, 'pv-spark');

    /* bubbles on top */
    w += PB.bubble({ x: FIX_X - 230, y: 196, text: 'Сейчас починю!', cls: 'pv-b0', off: true });
    w += PB.bubble({ x: 170, y: 200, text: 'Бип. Всё по полочкам', cls: 'pv-b1', off: true });
    w += PB.bubble({ x: 900, y: 214, text: 'Замечание номер один', cls: 'pv-b2', off: true });
    w += PB.bubble({ x: 1540, y: 214, text: 'А если ночью?', cls: 'pv-b3', off: true });
    w += PB.bubble({ x: 2040, y: 226, text: 'Бип! Ошибка!', tail: 'dr', fill: RASP, cls: 'pv-b4', off: true });
    w += PB.bubble({ x: 2040, y: 226, text: 'Бип. Испытания пройдены', tail: 'dr', fill: MINT, cls: 'pv-b5', off: true });
    w += PB.bubble({ x: 2290, y: 190, text: 'Подключено. Вот памятка', cls: 'pv-b6' });
    /* the memo flies out of the phone */
    w += '<g transform="translate(2652 220) rotate(-6)"><g class="pv-memo">' + R(-66, -56, 132, 112, 10, CREAM, ' stroke-width="3.5"') +
      T(0, -24, 'Памятка', 22, { w: 800 }) + L('M-46 2H46M-46 22H34M-46 42H40', INK, 4, ' stroke-opacity=".3" stroke-linecap="round"') + '</g></g>';

    s += '<g class="pv-world" transform="translate(-2160 0)">' + w + '</g>';
    s += R(0, 0, 720, 540, 0, RASP, ' class="pv-flash" opacity="0" stroke="none"');
    return '<g' + PB.ROOT + '>' + s + '</g>';
  }

  function build(section, api) {
    MP.pb.mount(api, markup(), 'pv-svg');
    var far = api.stage.querySelector('.pv-far');
    if (far) far.setAttribute('transform', 'translate(-1080 0)');
  }

  function master(section, api) {
    var PB = MP.pb, gsap = window.gsap, svg = api.stage.querySelector('svg');
    var $ = PB.q(svg), $$ = PB.qa(svg);
    PB.frame(svg, api, '0 50 720 450');
    var tl = gsap.timeline({ paused: true });
    var world = $('.pv-world'), far = $('.pv-far'), piece = $('.pv-piece'), flash = $('.pv-flash');
    var chevM = $('.pv-main .belt-chev'), chevR = $('.pv-ret .belt-chev'), pitch = 28;
    var rollM = $$('.pv-main .belt-roller'), rollR = $$('.pv-ret .belt-roller');
    var slamps = $$('.pv-slamp:not(.pv-slamp-m)');
    var wrapX = gsap.utils.unitize(gsap.utils.wrap(0, pitch)), wrapN = gsap.utils.unitize(gsap.utils.wrap(-pitch, 0));
    var bub = function (k) { return $('.pv-b' + k); };

    /* ----- start state ----- */
    gsap.set(world, { x: 0 });
    gsap.set(far, { x: 0 });
    gsap.set(piece, { x: -140, y: BELT_Y, transformOrigin: '50% 100%' });
    gsap.set(slamps, { fill: STEEL_D });
    $$('.pb-bub').forEach(function (b) {
      gsap.set(b, { autoAlpha: 0, scale: 0, svgOrigin: b.getAttribute('data-tx') + ' ' + b.getAttribute('data-ty') });
    });
    gsap.set($$('.pb-splash'), { autoAlpha: 0 });
    gsap.set(flash, { autoAlpha: 0 });

    var scan = $('.pv-scan'), tilesBg = $$('.pv-tile-bg'), ticks = $$('.pv-tick'), tickP = $$('.pv-tick-path');
    var poryLamps = $$('.pv-pory .c-lamp:not(.c-lamp--main) > circle:first-child');
    gsap.set(scan, { autoAlpha: 0, y: 0 });
    gsap.set(ticks, { autoAlpha: 0, scale: 0, transformOrigin: '50% 50%' });
    gsap.set(tickP, { drawSVG: '0%' });
    gsap.set(poryLamps, { fill: STEEL_D });

    var notes = $$('.pv-note'), loop = $('.pv-loop'), loopArrow = $('.pv-loop-arrow'), k1 = $('.pv-k1'), k2 = $('.pv-k2');
    var arkh = $('.pv-arkh .c-char'), caps = $('.pv-caps'), wax = $('.pv-wax');
    gsap.set(notes, { autoAlpha: 0, scale: 0, transformOrigin: '50% 50%' });
    gsap.set(loop, { autoAlpha: 0, scale: 0, transformOrigin: '50% 50%' });
    gsap.set(loopArrow, { svgOrigin: '1206 226' });
    gsap.set(k2, { autoAlpha: 0 });
    gsap.set(arkh, { x: 260, autoAlpha: 0 });
    gsap.set(caps, { autoAlpha: 0, scale: 0, transformOrigin: '50% 100%' });
    gsap.set(wax, { autoAlpha: 0, transformOrigin: '50% 50%' });

    var tags = $$('.pv-tag'), strings = $$('.pv-string'), isp = $('.pv-isp .c-char');
    var needles = $$('.pv-stend .c-needle'), siren = $('.pv-stend .c-siren'), sirenFill = $('.pv-stend .c-siren path');
    var stLamp = $('.pv-stend .c-lamp--main circle'), rays = $('.pv-rays');
    gsap.set(tags, { autoAlpha: 0 });
    tags.forEach(function (t) { gsap.set(t.lastElementChild, { scale: 0, transformOrigin: '50% 0%' }); });
    gsap.set(strings, { drawSVG: '0%' });
    gsap.set(sirenFill, { fill: STEEL_D });
    gsap.set(stLamp, { fill: STEEL_D });
    gsap.set(rays, { autoAlpha: 0 });

    var mArm = $('.pv-master .c-arm-r'), once = $('.pv-once'), patch = $('.pv-patch'), spark = $('.pv-spark'), mSign = $('.pv-slamp-m');
    gsap.set(once, { autoAlpha: 0, scale: 0.4, transformOrigin: '50% 50%' });
    gsap.set(patch, { autoAlpha: 0, scale: 0, transformOrigin: '50% 50%' });
    gsap.set(mSign, { fill: STEEL_D });

    var cable = $('.pv-cable'), plug = $('.pv-plug'), chks = $$('.pv-chk-bg'), chkP = $$('.pv-chk-path'), flashScr = $('.pv-flashscr');
    var memo = $('.pv-memo'), pri = $('.pv-pri .c-char');
    gsap.set(cable, { drawSVG: '0%' });
    gsap.set(plug, { autoAlpha: 0, x: -30 });
    gsap.set(chks, { fill: '#261F5E' });
    gsap.set(chkP, { drawSVG: '0%' });
    gsap.set(flashScr, { autoAlpha: 0 });
    gsap.set(memo, { autoAlpha: 0, scale: 0.2, x: 60, y: 40, rotation: 20, transformOrigin: '50% 50%' });

    /* ----- helpers ----- */
    var at = { x: -140 };
    function ride(pos, toX, cam, dur, back) {
      var dx = toX - at.x;
      at.x = toX;
      tl.to(piece, { x: toX, duration: dur, ease: 'power2.inOut' }, pos)
        .to(piece, { keyframes: { rotation: [0, dx > 0 ? -3 : 3, 2, -1, 0] }, duration: dur, ease: 'none' }, pos)
        .to(back ? chevR : chevM, { x: '+=' + dx, duration: dur, ease: 'power2.inOut', modifiers: { x: back ? wrapN : wrapX } }, pos)
        .to(back ? rollR : rollM, { rotation: '+=' + Math.round(dx * 1.2), duration: dur, ease: 'power2.inOut' }, pos);
      if (cam != null) {
        tl.to(world, { x: -cam * 720, duration: dur, ease: 'power2.inOut' }, pos)
          .to(far, { x: -cam * 360, duration: dur, ease: 'power2.inOut' }, pos);
      }
    }
    function say(k, pos, out) {
      tl.to(bub(k), { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' }, pos);
      if (out != null) tl.to(bub(k), { autoAlpha: 0, scale: 0, duration: 0.2, ease: 'power2.in' }, out);
    }
    function lampOn(el, pos, col) { PB.lamp(tl, el, col || MINT, pos); }

    /* ----- order ----- */
    ride(0.1, STOP[0], null, 1.3);
    tl.set(scan, { autoAlpha: 1, y: 0 }, 1.45)
      .to(scan, { y: 138, duration: 0.55, ease: 'sine.inOut', yoyo: true, repeat: 3 }, 1.45);
    poryLamps.forEach(function (l, k) { PB.lamp(tl, l, MINT, 1.6 + k * 0.25); });
    ticks.forEach(function (t, k) {
      tl.to(t, { autoAlpha: 1, scale: 1, duration: 0.35, ease: 'back.out(2.4)' }, 1.8 + k * 0.4)
        .to(tickP[k], { drawSVG: '100%', duration: 0.25, ease: 'power2.out' }, '<0.1')
        .set(tilesBg[k], { fill: MINT }, '<');
    });
    tl.to(scan, { autoAlpha: 0, duration: 0.2 }, 3.7);
    say(1, 3.2);
    lampOn(slamps[0], 3.6);
    tl.addLabel('order', 4.4);
    tl.to(bub(1), { autoAlpha: 0, scale: 0, duration: 0.2 }, 'order');

    /* ----- auditor ----- */
    ride('order', STOP[1], 1, 1.5);
    say(2, 'order+=1.4', 'order+=3.0');
    tl.to(notes[0], { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(2.6)' }, 'order+=1.7')
      .to(loop, { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' }, 'order+=2.0')
      .to(loopArrow, { rotation: 360, duration: 0.8, ease: 'power2.inOut' }, 'order+=2.3')
      .to(notes[1], { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(2.6)' }, 'order+=2.9')
      .to(k1, { autoAlpha: 0, duration: 0.12 }, 'order+=3.2')
      .to(k2, { autoAlpha: 1, duration: 0.12 }, '>')
      .to(loopArrow, { rotation: 720, duration: 0.8, ease: 'power2.inOut' }, 'order+=3.2')
      .set(arkh, { autoAlpha: 1 }, 'order+=3.9')
      .to(arkh, { x: 0, duration: 1.0, ease: 'power1.out' }, 'order+=3.9')
      .to(arkh, { keyframes: { y: [0, -10, 0, -10, 0, -8, 0] }, duration: 1.0, ease: 'none' }, 'order+=3.9')
      .to(caps, { autoAlpha: 1, scale: 1, duration: 0.45, ease: 'back.out(2)' }, 'order+=5.0');
    PB.slam(tl, wax, 'order+=5.5');
    tl.to(notes, { autoAlpha: 0, scale: 0, duration: 0.3, ease: 'power2.in', stagger: 0.08 }, 'order+=5.9')
      .to(loop, { scale: 0.9, duration: 0.3, ease: 'power2.inOut' }, 'order+=5.9');
    lampOn(slamps[1], 'order+=6.0');
    tl.addLabel('auditor', 'order+=6.4');

    /* ----- tests (+ the defect loop) ----- */
    ride('auditor', STOP[2], 2, 1.5);
    say(3, 'auditor+=1.4', 'auditor+=3.2');
    tags.forEach(function (t, k) {
      var p = 'auditor+=' + (1.7 + k * 0.3);
      tl.set(t, { autoAlpha: 1 }, p)
        .to(strings[k], { drawSVG: '100%', duration: 0.2 }, p)
        .to(t.lastElementChild, { scale: 1, duration: 0.4, ease: 'back.out(2.4)' }, 'auditor+=' + (1.8 + k * 0.3));
    });
    tl.to(isp, { rotation: -8, duration: 0.15, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 'auditor+=1.7');
    tl.addLabel('defect', 'auditor+=2.9');
    tl.to(needles, { rotation: '+=540', duration: 1.0, ease: 'power2.inOut' }, 'defect')
      .set(sirenFill, { fill: RASP }, 'defect+=0.9')
      .to(siren, { keyframes: { rotation: [0, -16, 14, -12, 10, -6, 0] }, duration: 0.9, ease: 'none' }, 'defect+=0.9')
      .to(rays, { keyframes: { opacity: [0, 1, 0, 1, 0, 1] }, duration: 0.9, ease: 'none' }, 'defect+=0.9')
      .set(rays, { visibility: 'inherit' }, 'defect+=0.9')
      .to(flash, { keyframes: { opacity: [0, 0.22, 0, 0.22, 0, 0.18, 0] }, duration: 1.1, ease: 'none' }, 'defect+=0.9')
      .set(flash, { visibility: 'inherit' }, 'defect+=0.9');
    lampOn(stLamp, 'defect+=0.9', RASP);
    say(4, 'defect+=1.0', 'defect+=2.4');
    tl.addLabel('alarm', 'defect+=1.9');
    /* drop to the return belt and ride back to the Мастер (camera follows) */
    tl.to(piece, { motionPath: { path: [{ x: STOP[2] - 20, y: BELT_Y - 40 }, { x: STOP[2] - 40, y: RET_Y }], curviness: 1.4 }, duration: 0.5, ease: 'power2.in' }, 'defect+=2.3');
    at.x = STOP[2] - 40;
    ride('defect+=2.85', FIX_X, -1, 1.8, true);
    tl.to(piece, { motionPath: { path: [{ x: FIX_X, y: BELT_Y - 60 }, { x: FIX_X, y: BELT_Y }], curviness: 1 }, duration: 0.45, ease: 'power2.out' }, 'defect+=4.7');
    say(0, 'defect+=4.8', 'defect+=6.4');
    tl.to(once, { autoAlpha: 1, scale: 1, duration: 0.35, ease: 'back.out(2.2)' }, 'defect+=5.0')
      .to(mArm, { rotation: -360, duration: 0.35, ease: 'none', repeat: 2 }, 'defect+=5.1');
    PB.burst(tl, spark, 'defect+=5.3');
    PB.burst(tl, spark, 'defect+=5.7');
    tl.to(patch, { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(2.6)' }, 'defect+=6.0');
    lampOn(mSign, 'defect+=6.1');
    tl.to(once, { autoAlpha: 0, scale: 0.4, duration: 0.25 }, 'defect+=6.4');
    ride('defect+=6.5', STOP[2], 2, 1.8);
    tl.to(needles, { rotation: '+=360', duration: 0.7, ease: 'power2.inOut' }, 'defect+=8.2')
      .set(sirenFill, { fill: STEEL_D }, 'defect+=8.2')
      .to(rays, { autoAlpha: 0, duration: 0.2 }, 'defect+=8.2');
    lampOn(stLamp, 'defect+=8.9');
    say(5, 'defect+=8.95');
    tl.to(tags, { autoAlpha: 0, duration: 0.3, stagger: 0.06 }, 'defect+=8.5');
    lampOn(slamps[2], 'defect+=9.3');
    tl.addLabel('tests', 'defect+=9.8');

    /* ----- verifier ----- */
    tl.to(bub(5), { autoAlpha: 0, scale: 0, duration: 0.2 }, 'tests');
    ride('tests', STOP[3], 3, 1.5);
    tl.to(pri, { scaleY: 0.92, duration: 0.14, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 'tests+=1.4')
      .to(cable, { drawSVG: '100%', duration: 0.45, ease: 'power2.inOut' }, 'tests+=1.5')
      .to(plug, { autoAlpha: 1, x: 0, duration: 0.3, ease: 'back.out(2)' }, 'tests+=1.85')
      .to(flashScr, { keyframes: { opacity: [0, 0.6, 0] }, duration: 0.35, ease: 'none' }, 'tests+=2.1')
      .set(flashScr, { visibility: 'inherit' }, 'tests+=2.1')
      .set(flashScr, { autoAlpha: 0 }, 'tests+=2.46');
    chks.forEach(function (c, k) {
      tl.set(c, { fill: MINT }, 'tests+=' + (2.3 + k * 0.22))
        .to(chkP[k], { drawSVG: '100%', duration: 0.2, ease: 'power2.out' }, '<');
    });
    say(6, 'tests+=3.4');
    tl.to(memo, { autoAlpha: 1, scale: 1, x: 0, y: 0, rotation: 0, duration: 0.6, ease: 'back.out(1.5)' }, 'tests+=3.7');
    lampOn(slamps[3], 'tests+=4.1');
    tl.addLabel('verifier', 'tests+=4.5');
    return tl;
  }

  function wire(section, api, drv) {
    var btn = section.querySelector('[data-action="throw-defect"]');
    if (!btn) return;
    var gsap = window.gsap;
    api.on(btn, 'click', function () {
      if (!MP.pb.alive(drv.tl)) return;
      if (api.calm) {
        drv.tl.pause(); drv.tl.seek('alarm', false);
        MP.live('Бип! Ошибка! Деталь едет по красной ленте назад к мастеру.');
        var tl = drv.tl;
        gsap.delayedCall(2.2, function () {
          if (!MP.pb.alive(tl)) return;
          var cur = drv.last();
          tl.seek(cur && cur !== 'tests' && tl.labels[cur] != null ? cur : 'tests', false);
          MP.live('Мастер починил. Бип. Испытания пройдены.');
        });
        return;
      }
      MP.live('Бип! Ошибка! Деталь едет по красной ленте назад к мастеру.');
      drv.range('defect', 'tests', { onComplete: function () {
        MP.live('Мастер починил. Бип. Испытания пройдены.');
        /* the reader may have scrolled on meanwhile: return to the step that is active now */
        var cur = drv.last();
        if (cur && cur !== 'tests') drv.go(cur);
      } });
    });
  }

  MP.scene('proverki', {
    build: build,
    init: function (section, api) {
      var tl = master(section, api);
      var drv = section.__pb = MP.pb.drive(api, tl);
      wire(section, api, drv);
      MP.blink(api.stage, api);
    },
    final: function (section, api) {
      var tl = master(section, api);
      var drv = section.__pb = MP.pb.drive(api, tl, { first: 'order' });
      wire(section, api, drv);
    }
  });
})();
