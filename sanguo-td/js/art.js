'use strict';
/* ============================================================
 * 程序化绘制：战场背景、武将、敌人、头像
 * 全部用 Canvas 画出来，不依赖任何图片素材
 * ============================================================ */

const Art = (function () {
  const TAU = Math.PI * 2;
  function rng(seed) {            // 固定种子随机，保证背景每次一样
    let a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function circ(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
  function ell(c, x, y, rx, ry) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); }
  function rr(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
  }

  /* ---------------- 战场背景（只画一次，缓存成离屏画布） ---------------- */
  let bgCanvas = null;
  /* 代码画的小人：先画到离屏画布，描一圈粗黑边、加一点左上亮右下暗的明暗，按 key 缓存。
   * box = [x0, y0, 宽, 高]（本地单位）；返回 { im, x, y, w, h }，直接 drawImage(im, x, y, w, h) */
  const procCache = {};
  function procSprite(key, box, draw) {
    if (procCache[key]) return procCache[key];
    const K = 4, pad = 2, cw = (box[2] + pad * 2) * K, ch = (box[3] + pad * 2) * K;
    const raw = document.createElement('canvas'); raw.width = cw; raw.height = ch;
    const rc = raw.getContext('2d'); rc.scale(K, K); rc.translate(pad - box[0], pad - box[1]); draw(rc);
    const out = document.createElement('canvas'); out.width = cw; out.height = ch;
    const oc = out.getContext('2d'), dark = spriteTint(raw, '26,17,13'), th = 1.15 * K;
    for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; oc.drawImage(dark, Math.cos(a) * th, Math.sin(a) * th); }
    oc.drawImage(raw, 0, 0);
    oc.globalCompositeOperation = 'source-atop';
    const g = oc.createLinearGradient(0, 0, cw, ch);
    g.addColorStop(0, 'rgba(255,240,210,.18)'); g.addColorStop(0.5, 'rgba(255,240,210,0)'); g.addColorStop(1, 'rgba(20,10,30,.24)');
    oc.fillStyle = g; oc.fillRect(0, 0, cw, ch);
    return (procCache[key] = { im: out, x: box[0] - pad, y: box[1] - pad, w: box[2] + pad * 2, h: box[3] + pad * 2 });
  }

  /* 2.5D：越远（越靠画面上方）越小 */
  function depth(y) { return 0.58 + 0.42 * Math.max(0, Math.min(1, y / CFG.WALL_Y)); }
  /* 投影：光从左上方来，人影斜着落在右下方的地上 */
  function castShadow(c, im, x0, y0, w, h, footY, a) {
    c.save(); c.translate(0, footY); c.transform(1, 0, -0.85, -0.3, 0, 0);
    c.globalAlpha = a; c.drawImage(spriteTint(im, '12,8,6'), x0, y0 - footY, w, h);
    c.restore(); c.globalAlpha = 1;
  }

  function background() {
    const im = Assets.get('bg');
    if (im) return im;                       // 有 assets/bg/battle.png 就用图片
    if (bgCanvas) return bgCanvas;
    const W = CFG.W, Hh = CFG.H, WY = CFG.WALL_Y, S = 2;
    const cv = document.createElement('canvas');
    cv.width = W * S; cv.height = Hh * S;
    const c = cv.getContext('2d'); c.scale(S, S);
    const R = rng(20261111);

    // 土地
    const g = c.createLinearGradient(0, 0, 0, WY);
    g.addColorStop(0, '#4d3527'); g.addColorStop(0.25, '#7a543a'); g.addColorStop(1, '#8a6144');
    c.fillStyle = g; c.fillRect(0, 0, W, WY + 10);
    for (let i = 0; i < 130; i++) {            // 斑驳
      c.fillStyle = R() < 0.5 ? 'rgba(40,22,12,.10)' : 'rgba(255,214,160,.05)';
      ell(c, R() * W, R() * WY, 18 + R() * 60, 8 + R() * 26);
    }
    c.lineCap = 'round';
    for (let i = 0; i < 46; i++) {             // 裂纹
      let x = R() * W, y = 40 + R() * (WY - 80), a = R() * TAU;
      c.strokeStyle = 'rgba(38,20,10,' + (0.25 + R() * 0.3) + ')'; c.lineWidth = 0.8 + R() * 1.4;
      c.beginPath(); c.moveTo(x, y);
      for (let k = 0; k < 4 + R() * 4; k++) { a += (R() - 0.5) * 1.3; x += Math.cos(a) * (8 + R() * 14); y += Math.sin(a) * (8 + R() * 14); c.lineTo(x, y); }
      c.stroke();
    }
    for (let i = 0; i < 60; i++) {             // 碎石（远处小）
      const x = R() * W, y = 30 + R() * (WY - 50), s = (2 + R() * 5) * depth(y);
      c.fillStyle = 'rgba(30,18,10,.35)'; ell(c, x + 1, y + 2, s * 1.2, s * 0.6);
      c.fillStyle = R() < 0.5 ? '#8d8072' : '#6e6358'; ell(c, x, y, s * 1.1, s * 0.8);
      c.fillStyle = 'rgba(255,255,255,.15)'; ell(c, x - s * 0.3, y - s * 0.3, s * 0.4, s * 0.25);
    }
    for (let i = 0; i < 70; i++) {             // 枯草
      const x = R() * W, y = 30 + R() * (WY - 50), dk = depth(y);
      c.strokeStyle = R() < 0.5 ? 'rgba(160,130,74,.45)' : 'rgba(110,88,50,.5)'; c.lineWidth = 1;
      for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + (k * 2.2 + (R() - 0.5) * 2) * dk, y - (5 + R() * 6) * dk); c.stroke(); }
    }
    // 两侧拒马、残旗
    for (let side = 0; side < 2; side++) {
      for (let i = 0; i < 7; i++) {
        const x = side ? W - 8 - R() * 30 : 8 + R() * 30, y = 90 + i * 92 + R() * 30;
        c.strokeStyle = '#2e1d12'; c.lineWidth = 5;
        for (let k = 0; k < 3; k++) {
          const dx = (side ? -1 : 1) * (10 + k * 7), dy = -22 - R() * 12;
          c.beginPath(); c.moveTo(x + k * 5 * (side ? -1 : 1), y); c.lineTo(x + dx, y + dy); c.stroke();
        }
        c.strokeStyle = '#5a3d27'; c.lineWidth = 2.4;
        for (let k = 0; k < 3; k++) {
          const dx = (side ? -1 : 1) * (10 + k * 7);
          c.beginPath(); c.moveTo(x + k * 5 * (side ? -1 : 1), y); c.lineTo(x + dx, y - 24); c.stroke();
        }
      }
    }
    // 远处敌营（2.5D 远景，越远越小、被烟尘盖住）
    [['xiliangying', 70, 64, 120], ['xiliangying', 470, 58, 116], ['camp', 270, 92, 170]].forEach(b => {
      const im = Assets.get('scenery/' + b[0]); if (!im) return;
      const w = b[3], h = w * im.height / im.width;
      c.globalAlpha = 0.9; c.drawImage(im, b[1] - w / 2, b[2] - h * 0.8, w, h); c.globalAlpha = 1;
    });
    // 光照：左上方的暖光，四周压暗
    const lt = c.createRadialGradient(W * 0.25, WY * 0.3, 20, W * 0.25, WY * 0.3, W * 1.1);
    lt.addColorStop(0, 'rgba(255,214,150,.16)'); lt.addColorStop(0.5, 'rgba(255,214,150,.04)'); lt.addColorStop(1, 'rgba(10,6,4,.32)');
    c.fillStyle = lt; c.fillRect(0, 0, W, WY + 10);
    // 颗粒：去掉“平涂”的卡通感
    try {
      const px = c.getImageData(0, 0, W * S, (WY + 10) * S), dd = px.data;
      for (let i = 0; i < dd.length; i += 4) { const n = (R() - 0.5) * 22; dd[i] += n; dd[i + 1] += n * 0.9; dd[i + 2] += n * 0.8; }
      c.putImageData(px, 0, 0);
    } catch (e) { /* file:// 下个别浏览器不让读像素，跳过 */ }
    // 远处烟尘（敌军来的方向）
    const fog = c.createLinearGradient(0, 0, 0, 230);
    fog.addColorStop(0, 'rgba(26,16,12,.9)'); fog.addColorStop(0.55, 'rgba(40,26,18,.45)'); fog.addColorStop(1, 'rgba(40,26,18,0)');
    c.fillStyle = fog; c.fillRect(0, 0, W, 230);

    // —— 城墙 ——
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, WY - 16, W, 12);          // 墙前阴影
    const floor = c.createLinearGradient(0, WY, 0, Hh);
    floor.addColorStop(0, '#6a6f7c'); floor.addColorStop(0.7, '#4e525d'); floor.addColorStop(1, '#3a3d46');
    c.fillStyle = floor; c.fillRect(0, WY, W, Hh - WY);
    c.strokeStyle = 'rgba(20,22,28,.45)'; c.lineWidth = 1;                    // 地砖
    for (let y = WY + 20, row = 0; y < 905; y += 28, row++) {
      c.beginPath(); c.moveTo(40, y); c.lineTo(W - 40, y); c.stroke();
      for (let x = 40 + (row % 2) * 23; x < W - 40; x += 46) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 28); c.stroke(); }
    }
    for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(255,255,255,.04)'; c.fillRect(44 + R() * 440, WY + 22 + R() * 130, 20 + R() * 20, 10 + R() * 12); }
    // 垛口
    for (let x = 34; x < W - 40; x += 40) {
      c.fillStyle = '#2b2d35'; rr(c, x - 1, WY - 13, 30, 30, 3); c.fill();
      c.fillStyle = '#7d828f'; rr(c, x, WY - 12, 28, 27, 3); c.fill();
      c.fillStyle = '#9aa0ad'; rr(c, x + 2, WY - 11, 24, 6, 2); c.fill();
      c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(x + 2, WY + 6, 24, 7);
    }
    c.fillStyle = '#565a66'; c.fillRect(0, WY + 13, W, 5);
    // 下方墙面
    c.fillStyle = '#2f3139'; c.fillRect(0, 905, W, Hh - 905);
    c.strokeStyle = 'rgba(0,0,0,.4)';
    for (let y = 905, row = 0; y < Hh; y += 14, row++) {
      c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
      for (let x = (row % 2) * 16; x < W; x += 32) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 14); c.stroke(); }
    }
    c.fillStyle = '#6b5a2e'; c.fillRect(0, 902, W, 4);
    // 两侧箭楼（有布衣三国的箭楼图就用图）
    const tw = Assets.get('scenery/tower');
    for (let side = 0; side < 2 && tw; side++) {
      const w = 96, h = w * tw.height / tw.width;
      c.save(); if (side) { c.translate(W, 0); c.scale(-1, 1); }
      c.fillStyle = 'rgba(0,0,0,.35)'; ell(c, 22, WY + 24, 44, 11);
      c.drawImage(tw, -32, WY + 28 - h, w, h);
      c.restore();
    }
    for (let side = 0; side < 2 && !tw; side++) {
      c.save();
      if (side) { c.translate(W, 0); c.scale(-1, 1); }
      c.fillStyle = '#3b3e48'; c.fillRect(0, WY - 44, 42, Hh - WY + 44);
      c.fillStyle = '#4b4f5b'; c.fillRect(4, WY - 40, 34, Hh - WY + 40);
      c.strokeStyle = 'rgba(0,0,0,.35)';
      for (let y = WY - 36; y < Hh; y += 16) { c.beginPath(); c.moveTo(4, y); c.lineTo(38, y); c.stroke(); }
      c.fillStyle = '#1d1e24'; rr(c, 14, WY - 6, 12, 22, 5); c.fill();          // 箭窗
      c.fillStyle = '#23242c';                                                  // 屋顶
      c.beginPath(); c.moveTo(-4, WY - 44); c.quadraticCurveTo(20, WY - 56, 52, WY - 40); c.lineTo(40, WY - 66); c.lineTo(0, WY - 66); c.closePath(); c.fill();
      c.fillStyle = '#6b5a2e'; c.fillRect(0, WY - 69, 40, 4);
      c.strokeStyle = '#3a2a1c'; c.lineWidth = 3; c.beginPath(); c.moveTo(20, WY - 66); c.lineTo(20, WY - 128); c.stroke();
      c.fillStyle = '#a3262b';                                                  // 战旗
      c.beginPath(); c.moveTo(21, WY - 127); c.lineTo(52, WY - 120); c.lineTo(44, WY - 108); c.lineTo(52, WY - 94); c.lineTo(21, WY - 96); c.closePath(); c.fill();
      c.fillStyle = '#e8c15a'; c.fillRect(21, WY - 127, 3, 31);
      c.restore();
    }
    // 灯笼
    [[150, WY - 22], [390, WY - 22]].forEach(p => {
      const lg = c.createRadialGradient(p[0], p[1], 2, p[0], p[1], 38);
      lg.addColorStop(0, 'rgba(255,190,90,.55)'); lg.addColorStop(1, 'rgba(255,190,90,0)');
      c.fillStyle = lg; circ(c, p[0], p[1], 38);
      c.fillStyle = '#3a2a1c'; c.fillRect(p[0] - 1.5, p[1] + 6, 3, 10);
      c.fillStyle = '#e2572a'; rr(c, p[0] - 6, p[1] - 7, 12, 14, 4); c.fill();
      c.fillStyle = '#ffd98a'; rr(c, p[0] - 3, p[1] - 4, 6, 8, 2); c.fill();
    });
    bgCanvas = cv;
    return cv;
  }

  /* ---------------- 武将 ---------------- */
  const SKIN = '#f6d7b4', HAIR = '#2a2320';
  function weapon(c, el) {
    c.lineCap = 'round';
    switch (el) {
      case 'arrow':
        c.strokeStyle = '#7a4a22'; c.lineWidth = 2.6; c.beginPath(); c.arc(9, 3, 12, -1.15, 1.15); c.stroke();
        c.strokeStyle = '#efe6d0'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(13.9, -8); c.lineTo(13.9, 14); c.stroke();
        break;
      case 'blade':
        c.strokeStyle = '#5a3a22'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(15, 19); c.lineTo(15, -24); c.stroke();
        c.fillStyle = '#e8eef5'; c.beginPath(); c.moveTo(14, -22); c.quadraticCurveTo(28, -30, 22, -44); c.quadraticCurveTo(20, -32, 14, -30); c.closePath(); c.fill();
        c.fillStyle = '#c23b3b'; circ(c, 15, -22, 2.4);
        break;
      case 'fire':
        c.strokeStyle = '#5a3a22'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(14, 16); c.lineTo(14, -10); c.stroke();
        c.fillStyle = '#ff6a2a'; c.beginPath(); c.moveTo(14, -30); c.quadraticCurveTo(23, -18, 14, -8); c.quadraticCurveTo(5, -18, 14, -30); c.fill();
        c.fillStyle = '#ffd35a'; c.beginPath(); c.moveTo(14, -23); c.quadraticCurveTo(19, -16, 14, -10); c.quadraticCurveTo(9, -16, 14, -23); c.fill();
        break;
      case 'ice':
        c.strokeStyle = '#d7dee8'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(15, 19); c.lineTo(15, -22); c.stroke();
        c.fillStyle = '#8fdcff'; c.beginPath(); c.moveTo(15, -38); c.lineTo(20, -24); c.lineTo(15, -19); c.lineTo(10, -24); c.closePath(); c.fill();
        c.fillStyle = '#fff'; c.beginPath(); c.moveTo(15, -36); c.lineTo(17, -26); c.lineTo(15, -22); c.closePath(); c.fill();
        break;
      case 'thunder':
        c.strokeStyle = '#4a3a5e'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(15, 19); c.lineTo(15, -20); c.stroke();
        c.fillStyle = '#6a56a8'; rr(c, 7, -32, 16, 12, 3); c.fill();
        c.fillStyle = '#ffe66a'; c.beginPath(); c.moveTo(16, -31); c.lineTo(11, -25); c.lineTo(15, -25); c.lineTo(13, -20); c.lineTo(19, -27); c.lineTo(15, -27); c.closePath(); c.fill();
        break;
      case 'poison':
        c.fillStyle = '#6f9a2f'; circ(c, 14, 8, 6); circ(c, 14, 0, 4);
        c.fillStyle = '#3d2a1a'; c.fillRect(12.5, -6, 3, 3);
        c.fillStyle = 'rgba(200,255,120,.8)'; circ(c, 12, 6, 1.6);
        break;
      case 'wind':
        c.strokeStyle = '#5a3a22'; c.lineWidth = 2; c.beginPath(); c.moveTo(13, 12); c.lineTo(15, 2); c.stroke();
        for (let i = -2; i <= 2; i++) {
          c.save(); c.translate(15, 2); c.rotate(i * 0.3);
          c.fillStyle = i % 2 ? '#dfeee8' : '#ffffff';
          c.beginPath(); c.ellipse(0, -11, 3.4, 11, 0, 0, TAU); c.fill(); c.restore();
        }
        break;
    }
  }
  function headgear(c, el, fac) {
    switch (el) {
      case 'arrow':
        c.fillStyle = '#c9a45c'; c.beginPath(); c.moveTo(-14, -17); c.lineTo(0, -30); c.lineTo(14, -17); c.closePath(); c.fill();
        c.strokeStyle = '#8a6a32'; c.lineWidth = 1; c.beginPath(); c.moveTo(-7, -23.5); c.lineTo(7, -23.5); c.stroke();
        break;
      case 'blade':
        c.fillStyle = '#8b909c'; c.beginPath(); c.arc(0, -15, 10.8, Math.PI, 0); c.closePath(); c.fill();
        c.fillStyle = '#d8b04a'; c.fillRect(-11, -16.5, 22, 2.4);
        c.fillStyle = '#d43a3a'; c.beginPath(); c.moveTo(0, -25); c.quadraticCurveTo(10, -36, 3, -40); c.quadraticCurveTo(4, -32, -2, -26); c.closePath(); c.fill();
        break;
      case 'fire':
        c.fillStyle = HAIR; circ(c, 0, -25, 4);
        c.fillStyle = '#e2472a'; c.fillRect(-10.5, -19, 21, 3);
        break;
      case 'ice':
        c.fillStyle = HAIR; c.fillRect(-11, -15, 3.4, 13); c.fillRect(7.6, -15, 3.4, 13);
        c.fillStyle = '#cfe9ff'; c.fillRect(-10, -19.5, 20, 2.4);
        c.fillStyle = '#8fdcff'; c.beginPath(); c.moveTo(0, -27); c.lineTo(3, -21); c.lineTo(0, -18); c.lineTo(-3, -21); c.closePath(); c.fill();
        break;
      case 'thunder':
        c.fillStyle = '#e8c04a'; c.beginPath(); c.moveTo(-9, -19); c.lineTo(-9, -27); c.lineTo(-4.5, -22); c.lineTo(0, -29); c.lineTo(4.5, -22); c.lineTo(9, -27); c.lineTo(9, -19); c.closePath(); c.fill();
        c.fillStyle = '#b05cff'; circ(c, 0, -22, 1.6);
        break;
      case 'poison':
        c.fillStyle = '#3d2f52'; c.beginPath(); c.arc(0, -13, 12.4, Math.PI * 0.86, Math.PI * 0.14); c.lineTo(8, -15); c.arc(0, -13, 8.5, -0.25, Math.PI + 0.25, true); c.closePath(); c.fill();
        break;
      case 'wind':
        c.fillStyle = '#f2f2ea'; rr(c, -8, -29, 16, 11, 3); c.fill();
        c.fillStyle = fac.color; c.fillRect(-8, -21, 16, 2.6);
        break;
    }
  }
  /* 在 (x,y) 画一名武将，y 为脚底附近。anim: 0~1 攻击动作 */
  function hero(c, d, x, y, s, t, anim, noAura) {
    const fac = FACTIONS[d.fac], q = QUALITIES[d.q];
    c.save(); c.translate(x, y); c.scale(s, s);
    if (!noAura) {
      // 脚下一块深色圆形底座托住人物（高俯视角的画法），外圈是品质色
      const bg = c.createRadialGradient(0, 20, 2, 0, 20, 26);
      bg.addColorStop(0, 'rgba(8,5,4,.78)'); bg.addColorStop(0.75, 'rgba(14,9,6,.62)'); bg.addColorStop(1, 'rgba(14,9,6,.35)');
      c.fillStyle = bg; ell(c, 0, 20, 25, 9.5);
      if (d.q >= 3) {
        c.globalCompositeOperation = 'lighter';
        const gl = c.createRadialGradient(0, 14, 2, 0, 14, 30);
        gl.addColorStop(0, q.color + '66'); gl.addColorStop(1, q.color + '00');
        c.fillStyle = gl; ell(c, 0, 14, 30, 16);
        c.globalCompositeOperation = 'source-over';
      }
      c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 3.2; c.beginPath(); c.ellipse(0, 20, 26, 10, 0, 0, TAU); c.stroke();
      c.strokeStyle = q.color; c.lineWidth = 1.8; c.globalAlpha = 0.95;
      c.beginPath(); c.ellipse(0, 20, 26, 10, 0, 0, TAU); c.stroke(); c.globalAlpha = 1;
    }
    const a = Math.min(1, anim || 0);
    const im = Assets.get('hero:' + d.id);
    if (im) {                                // 有立绘图片：脚底锚点对齐站位，保留呼吸和出手动作（出手时向前一顿、略微压扁再弹回）
      const hU = SPRITE.hero.units, wU = hU * im.width / im.height, k = 1 + a * 0.05;
      c.translate(0, 20 - a * 7);
      c.scale(k * (1 + a * 0.03), k * (1 - a * 0.02) * (1 + Math.sin(t * 2.4 + d.seed) * 0.012));
      c.drawImage(im, -wU * SPRITE.hero.ax, -hU * SPRITE.hero.ay, wU, hU);
      c.restore();
      return;
    }
    // 没有立绘：代码画的小人，描上粗黑边，和手绘立绘是同一种卡通画法
    const ps = procSprite('hero:' + d.id, [-26, -48, 58, 74], cc => heroBody(cc, d));
    c.translate(0, Math.sin(t * 2.4 + d.seed) * 1.1 - a * 6);
    c.rotate(-a * 0.07);
    if (!noAura) { c.translate(0, 20); c.scale(1.2, 1.2); c.translate(0, -20); }
    c.drawImage(ps.im, ps.x, ps.y, ps.w, ps.h);
    c.restore();
  }
  /* 立绘打一层场景光：头肩偏暖偏亮、下摆偏冷偏暗，人物更有体积、和灯笼照着的城楼融在一起（按图片缓存） */
  const litMap = new Map();
  function lit(im) {
    let cv = litMap.get(im); if (cv) return cv;
    cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
    const c = cv.getContext('2d');
    c.drawImage(im, 0, 0); c.globalCompositeOperation = 'source-atop';
    const g = c.createLinearGradient(0, im.height * 0.08, im.width * 0.25, im.height * 0.9);
    g.addColorStop(0, 'rgba(255,238,200,.16)'); g.addColorStop(0.45, 'rgba(255,238,200,0)'); g.addColorStop(1, 'rgba(26,12,48,.26)');
    c.fillStyle = g; c.fillRect(0, 0, cv.width, cv.height);
    litMap.set(im, cv);
    return cv;
  }
  /* 给 WebGL 画面用：武将用哪张图、多大、脚底锚点在图里的比例位置（单位和 hero() 里一样，战场上再乘 1.45） */
  function heroSprite(d) {
    const im = Assets.get('hero:' + d.id);
    if (im) { const hU = SPRITE.hero.units; return { im: lit(im), w: hU * im.width / im.height, h: hU, ax: SPRITE.hero.ax, ay: SPRITE.hero.ay, k: 1, proc: false }; }
    const ps = procSprite('hero:' + d.id, [-26, -48, 58, 74], cc => heroBody(cc, d));
    return { im: ps.im, w: ps.w, h: ps.h, ax: -ps.x / ps.w, ay: (20 - ps.y) / ps.h, k: 1.2, proc: true };
  }
  function heroBody(c, d) {
    const fac = FACTIONS[d.fac], q = QUALITIES[d.q];
    weapon(c, d.el);
    // 披风（金以上）
    if (d.q >= 4) { c.fillStyle = fac.dark; c.beginPath(); c.moveTo(-9, -3); c.quadraticCurveTo(-22, 10, -17, 21); c.lineTo(-8, 18); c.closePath(); c.fill(); }
    // 袍
    c.fillStyle = fac.color; c.beginPath(); c.moveTo(-9, -4); c.lineTo(9, -4); c.quadraticCurveTo(15, 10, 14, 19); c.quadraticCurveTo(0, 23, -14, 19); c.quadraticCurveTo(-15, 10, -9, -4); c.fill();
    c.fillStyle = fac.dark; c.beginPath(); c.moveTo(-14, 15); c.quadraticCurveTo(0, 19, 14, 15); c.lineTo(14, 19); c.quadraticCurveTo(0, 23, -14, 19); c.closePath(); c.fill();
    c.fillStyle = '#f3ead8'; c.beginPath(); c.moveTo(-4, -4); c.lineTo(0, 3); c.lineTo(4, -4); c.closePath(); c.fill();   // 衣领
    c.fillStyle = '#2a2320'; c.fillRect(-11, 6, 22, 3);
    c.fillStyle = q.color; c.fillRect(-2.2, 5.4, 4.4, 4.2);                                                                // 腰扣=品质色
    c.fillStyle = SKIN; circ(c, -11.5, 5, 3); circ(c, 12.5, 4, 3);
    // 头
    c.fillStyle = SKIN; circ(c, 0, -13, 10);
    c.fillStyle = HAIR; c.beginPath(); c.arc(0, -14, 10.4, Math.PI * 1.02, Math.PI * 1.98); c.closePath(); c.fill();
    c.fillStyle = HAIR; circ(c, -3.7, -11.5, 1.35); circ(c, 3.7, -11.5, 1.35);
    c.fillStyle = 'rgba(230,120,110,.45)'; circ(c, -6.6, -8.4, 1.8); circ(c, 6.6, -8.4, 1.8);
    if (d.el === 'blade' || d.el === 'thunder') {                     // 武将留须
      c.fillStyle = HAIR; c.beginPath(); c.moveTo(-5, -6); c.quadraticCurveTo(0, d.el === 'blade' ? 6 : -1, 5, -6); c.quadraticCurveTo(0, -4, -5, -6); c.fill();
    } else {
      c.strokeStyle = '#7a4a3a'; c.lineWidth = 0.9; c.beginPath(); c.arc(0, -8.6, 2, 0.15, Math.PI - 0.15); c.stroke();
    }
    headgear(c, d.el, fac);
  }

  /* 头像：返回 dataURL（带缓存） */
  const pCache = {};
  function portrait(id, px) {
    const key = id + '@' + px;
    if (pCache[key]) return pCache[key];
    const d = HERO_MAP[id], q = QUALITIES[d.q];
    const cv = document.createElement('canvas'); cv.width = cv.height = px * 2;
    const c = cv.getContext('2d'); c.scale(px * 2 / 64, px * 2 / 64);
    let g;
    if (d.q === 7) {
      g = c.createLinearGradient(0, 0, 64, 64);
      ['#ff6a6a', '#ffd24a', '#6adf7a', '#4ea8ff', '#b968ff'].forEach((col, i) => g.addColorStop(i / 4, col));
    } else {
      g = c.createRadialGradient(32, 26, 4, 32, 32, 46);
      g.addColorStop(0, q.color); g.addColorStop(1, q.dark);
    }
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    c.fillStyle = 'rgba(255,255,255,.10)';
    for (let i = 0; i < 6; i++) { c.save(); c.translate(32, 40); c.rotate(i * Math.PI / 3 + 0.3); c.beginPath(); c.moveTo(0, 0); c.lineTo(-9, -70); c.lineTo(9, -70); c.closePath(); c.fill(); c.restore(); }
    const head = Assets.get('head:' + id), spr = Assets.get('hero:' + id);
    if (head) c.drawImage(head, 0, 0, 64, 64);
    else if (spr) { const hh = 92, ww = hh * spr.width / spr.height; c.drawImage(spr, 32 - ww / 2, 3, ww, hh); }   // 没有单独头像：取立绘上半身
    else hero(c, d, 30, 40, 1.45, 0, 0, true);
    if (d.locked) { c.fillStyle = 'rgba(8,6,14,.72)'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#fff'; c.font = 'bold 26px sans-serif'; c.textAlign = 'center'; c.fillText('?', 32, 42); }
    try { return (pCache[key] = cv.toDataURL()); }
    catch (e) { return (pCache[key] = (head || spr).src); }   // 双击打开(file://)时画布不能导出图片，退回直接用原图
  }

  /* ---------------- 敌人 ---------------- */
  /* 敌人用哪张图：有图片用图片；没有就用代码画的小人（描粗黑边、放大一些） */
  function enemySprite(e) {
    const d = e.def, im = (e.spr && Assets.get(e.spr)) || Assets.get('enemy:' + d.id);
    if (im) { const hU = SPRITE.enemy.units, wU = hU * im.width / im.height; return { im, x: -wU * SPRITE.enemy.ax, y: 12.4 - hU * SPRITE.enemy.ay, w: wU, h: hU, k: 1, top: 2.55 }; }
    const ps = procSprite('enemy:' + d.id, [-20, -30, 44, 54], cc => enemyBody(cc, d));
    return { im: ps.im, x: ps.x, y: ps.y, w: ps.w, h: ps.h, k: 1.3, top: 2.35 };
  }
  function enemy(c, e, t) {
    const d = e.def, ds = depth(e.y), s = d.r / 13 * ds, sp = enemySprite(e);
    e.ds = ds;
    c.save(); c.translate(e.x, e.y);
    c.fillStyle = 'rgba(0,0,0,.35)'; ell(c, 0, d.r * 0.95 * ds, d.r * 1.05 * ds, d.r * 0.4 * ds);
    const moving = e.frozen <= 0 && e.y < e.stopY;
    c.translate(0, moving ? -Math.abs(Math.sin(e.walk)) * 2.4 : (e.frozen > 0 ? 0 : Math.sin(t * 9 + e.ph) * 1.2));
    c.scale(s, s);
    if (sp.k !== 1) { c.translate(0, 12); c.scale(sp.k, sp.k); c.translate(0, -12); }
    if (moving) c.rotate(Math.sin(e.walk) * 0.05);            // 走路时左右晃
    castShadow(c, sp.im, sp.x, sp.y, sp.w, sp.h, 12.4, 0.26);
    if (e.flip) c.scale(-1, 1);
    c.drawImage(sp.im, sp.x, sp.y, sp.w, sp.h);
    if (e.demon) { c.globalAlpha = 0.5 + Math.sin(t * 3 + e.ph) * 0.08; c.drawImage(spriteTint(sp.im, '58,22,96'), sp.x, sp.y, sp.w, sp.h); c.globalAlpha = 1; }   // 心魔：整个人罩一层黑紫
    if (e.flash > 0) {                                        // 受击：同一张图叠加一层发白
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, e.flash * 6) * 0.6;
      c.drawImage(sp.im, sp.x, sp.y, sp.w, sp.h);
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    }
    if (e.frozen > 0) { c.globalAlpha = 0.7; c.drawImage(spriteTint(sp.im, '150,215,255'), sp.x, sp.y, sp.w, sp.h); }
    else if (e.psn > 0) { c.globalAlpha = 0.35; c.drawImage(spriteTint(sp.im, '120,230,70'), sp.x, sp.y, sp.w, sp.h); }
    else if (e.slow > 0) { c.globalAlpha = 0.3; c.drawImage(spriteTint(sp.im, '150,215,255'), sp.x, sp.y, sp.w, sp.h); }
    c.globalAlpha = 1;
    c.restore();
    drawBars(c, e, d, sp.top * ds);
  }
  /* 阵亡：原地发白、往上飘着淡出（p 0→1） */
  function enemyGhost(c, g, p) {
    const d = g.def, ds = depth(g.y), s = d.r / 13 * ds, sp = enemySprite(g);
    c.save(); c.translate(g.x, g.y - p * 12 * ds); c.scale(s * (1 + p * 0.12), s * (1 - p * 0.2));
    if (sp.k !== 1) { c.translate(0, 12); c.scale(sp.k, sp.k); c.translate(0, -12); }
    if (g.flip) c.scale(-1, 1);
    c.globalAlpha = (1 - p) * 0.85; c.drawImage(sp.im, sp.x, sp.y, sp.w, sp.h);
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = (1 - p) * 0.7; c.drawImage(sp.im, sp.x, sp.y, sp.w, sp.h);
    c.restore();
  }
  /* 攻城器械（冲车、投石车）：没有人，画一辆木头车 */
  function siegeBody(c, d) {
    c.lineCap = 'round';
    c.fillStyle = '#2a1d14'; circ(c, -11, 14, 5); circ(c, 11, 14, 5); c.fillStyle = '#8a6a44'; circ(c, -11, 14, 2.6); circ(c, 11, 14, 2.6);   // 轮子
    if (d.id === 'ram') {
      c.fillStyle = '#5a3d22'; rr(c, -15, -8, 30, 20, 3); c.fill();                                 // 车身
      c.fillStyle = '#7a5632'; c.beginPath(); c.moveTo(-17, -8); c.lineTo(0, -22); c.lineTo(17, -8); c.closePath(); c.fill();   // 尖顶棚
      c.strokeStyle = '#3c2a1a'; c.lineWidth = 1.2; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * 8, -9); c.lineTo(i * 4, -17); c.stroke(); }
      c.fillStyle = '#4a321c'; rr(c, -4, 2, 8, 18, 3); c.fill();                                    // 撞木，头朝城墙
      c.fillStyle = '#9aa2ac'; rr(c, -5, 15, 10, 7, 2); c.fill(); c.fillStyle = '#d8dde4'; c.fillRect(-3, 19, 6, 2);   // 包铁的撞头
    } else {
      c.fillStyle = '#5a3d22'; rr(c, -15, 2, 30, 10, 2); c.fill();                                  // 底架
      c.strokeStyle = '#4a321c'; c.lineWidth = 3; c.beginPath(); c.moveTo(-9, 4); c.lineTo(0, -12); c.lineTo(9, 4); c.stroke();   // 三角支架
      c.strokeStyle = '#7a5632'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(8, 2); c.lineTo(-10, -24); c.stroke();     // 抛杆
      c.fillStyle = '#3c2a1a'; circ(c, -10, -24, 4.2); c.fillStyle = '#84705a'; circ(c, -10.5, -25, 3);                // 兜里的石头
      c.fillStyle = '#2a1d14'; rr(c, 5, -1, 7, 7, 1.5); c.fill();                                   // 配重
    }
  }
  function enemyBody(c, d) {
    if (d.siege) return siegeBody(c, d);
    if (d.id === 'rider') {                                   // 战马
      c.fillStyle = '#5b3a24'; ell(c, 0, 5, 8, 12);
      c.fillStyle = '#6e4a30'; ell(c, 0, 15, 5, 6.5);
      c.fillStyle = '#1e1410'; circ(c, -2.4, 16, 1); circ(c, 2.4, 16, 1);
    }
    if (d.id === 'boss') {                                    // 披风
      c.fillStyle = '#7a1620'; c.beginPath(); c.moveTo(-8, -5); c.quadraticCurveTo(-17, 4, -13, 13); c.lineTo(13, 13); c.quadraticCurveTo(17, 4, 8, -5); c.closePath(); c.fill();
    }
    // 兵器
    c.lineCap = 'round';
    if (d.id === 'archer') {
      c.strokeStyle = '#3a2616'; c.lineWidth = 1.8; c.beginPath(); c.arc(6, 3, 8, -1.1, 1.1); c.stroke();
    } else if (d.id === 'sapper') {                           // 死士：背上一只火药桶，引线冒着火星
      c.fillStyle = '#5a3a20'; rr(c, 5, -6, 10, 14, 3); c.fill(); c.fillStyle = '#2a1d14'; c.fillRect(5, -2, 10, 1.6); c.fillRect(5, 3, 10, 1.6);
      c.strokeStyle = '#2a1d14'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(10, -6); c.quadraticCurveTo(13, -12, 10, -15); c.stroke();
      c.fillStyle = '#ffb030'; circ(c, 10, -16, 2.4); c.fillStyle = '#fff2b0'; circ(c, 10, -16, 1.1);
    } else if (d.id === 'drummer') {                          // 鼓手：背后一面旗
      c.strokeStyle = '#3a2616'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(9, 10); c.lineTo(9, -24); c.stroke();
      c.fillStyle = '#c8302a'; c.beginPath(); c.moveTo(9, -24); c.lineTo(20, -20); c.lineTo(9, -14); c.closePath(); c.fill();
    } else if (d.id === 'shaman') {                           // 巫医：骨头法杖
      c.strokeStyle = '#4a3420'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(10, 12); c.lineTo(10, -18); c.stroke();
      c.fillStyle = '#eee6d0'; circ(c, 10, -21, 3.6); c.fillStyle = '#2a1d14'; circ(c, 8.8, -21.4, 0.9); circ(c, 11.2, -21.4, 0.9);
      c.fillStyle = '#8dff8a'; circ(c, 10, -27, 1.6);
    } else if (d.id === 'boss') {
      c.strokeStyle = '#2a1d16'; c.lineWidth = 2; c.beginPath(); c.moveTo(11, 12); c.lineTo(11, -14); c.stroke();
      c.fillStyle = '#dfe5ee'; c.beginPath(); c.moveTo(10, -13); c.quadraticCurveTo(20, -18, 16, -27); c.quadraticCurveTo(14, -19, 10, -18); c.closePath(); c.fill();
    } else {
      c.strokeStyle = '#3a2616'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(10, 11); c.lineTo(10, -15); c.stroke();
      c.fillStyle = '#cfd6de'; c.beginPath(); c.moveTo(10, -21); c.lineTo(12.4, -15); c.lineTo(7.6, -15); c.closePath(); c.fill();
    }
    // 身体
    c.fillStyle = d.body; rr(c, -8, -4, 16, 16, 5); c.fill();
    c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(-8, 5, 16, 2.4);
    if (d.id === 'shield') {
      c.fillStyle = '#3d4450'; circ(c, -4, 6, 8.2); c.fillStyle = '#8f98a6'; circ(c, -4, 6, 6.6); c.fillStyle = '#d8b04a'; circ(c, -4, 6, 2.2);
    }
    if (d.id === 'heavy') {                                   // 重甲兵：一身甲片，一面大方盾
      c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 0.8; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-7, i * 4); c.lineTo(7, i * 4); c.stroke(); }
      c.fillStyle = '#2c3240'; rr(c, -12, -3, 11, 17, 2); c.fill(); c.fillStyle = '#7c8696'; rr(c, -10.6, -1.6, 8.2, 14.2, 1.5); c.fill(); c.fillStyle = '#d8b04a'; c.fillRect(-7.4, -1.6, 1.8, 14.2);
    }
    if (d.id === 'rattan') {                                  // 藤甲兵：编出来的格子纹，一面圆藤牌
      c.strokeStyle = 'rgba(70,48,14,.7)'; c.lineWidth = 0.9;
      for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 3.4 - 4, -4); c.lineTo(i * 3.4 + 4, 12); c.moveTo(i * 3.4 + 4, -4); c.lineTo(i * 3.4 - 4, 12); c.stroke(); }
      c.fillStyle = '#7a5a22'; circ(c, -5, 6, 7.4); c.fillStyle = '#c8a24a'; circ(c, -5, 6, 5.8); c.strokeStyle = '#7a5a22'; c.lineWidth = 1; c.beginPath(); c.arc(-5, 6, 3.2, 0, TAU); c.stroke();
    }
    if (d.id === 'drummer') {                                 // 鼓手：胸前一面鼓
      c.fillStyle = '#7a2a20'; ell(c, 0, 8, 8.4, 5.6); c.fillStyle = '#f0e2c0'; ell(c, 0, 7, 7, 4.2); c.fillStyle = '#d8b04a'; circ(c, 0, 7, 1.4);
      c.strokeStyle = '#4a3420'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-9, 0); c.lineTo(-3, 6); c.moveTo(9, 0); c.lineTo(3, 6); c.stroke();
    }
    if (d.id === 'shaman') {                                  // 巫医：脖子上一串骨珠
      c.fillStyle = '#eee6d0'; for (let i = -2; i <= 2; i++) circ(c, i * 2.6, -1.4 + Math.abs(i) * -0.5 + 1.4, 1.1);
    }
    // 头
    c.fillStyle = '#e8c49c'; circ(c, 0, -9, 7);
    c.fillStyle = d.hat; c.beginPath(); c.arc(0, -10, 7.4, Math.PI * 1.02, Math.PI * 1.98); c.closePath(); c.fill();
    if (d.id === 'grunt') { c.fillStyle = d.hat; c.fillRect(-7.4, -11.5, 14.8, 2.6); }
    if (d.id === 'sapper') { c.fillStyle = '#fff'; c.fillRect(-7.4, -11.5, 14.8, 2.2); c.fillStyle = d.hat; c.beginPath(); c.moveTo(-7, -11); c.lineTo(-13, -8); c.lineTo(-8, -9); c.closePath(); c.fill(); }   // 白布条勒头
    if (d.id === 'heavy') { c.fillStyle = d.hat; c.beginPath(); c.arc(0, -9, 7.6, Math.PI * 0.9, Math.PI * 2.1); c.closePath(); c.fill(); c.fillRect(-7.6, -10, 15.2, 4.4); c.fillStyle = '#e8c49c'; c.fillRect(-4.6, -9.4, 9.2, 2.6); }   // 铁盔只露一条缝
    if (d.id === 'rattan') { c.fillStyle = '#c8a24a'; c.beginPath(); c.moveTo(-9, -12); c.lineTo(0, -20); c.lineTo(9, -12); c.closePath(); c.fill(); }      // 藤编尖帽
    if (d.id === 'shaman') { ['#c8302a', '#e8c04a', '#3a8a4a'].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.moveTo((i - 1) * 4.4 - 1.6, -15); c.lineTo((i - 1) * 6, -25 + Math.abs(i - 1) * 2); c.lineTo((i - 1) * 4.4 + 1.6, -15); c.closePath(); c.fill(); }); }   // 三根羽毛
    if (d.id === 'elite' || d.id === 'boss') {
      c.fillStyle = d.id === 'boss' ? '#e8c04a' : '#c23b3b';
      c.beginPath(); c.moveTo(-6, -15); c.lineTo(-10, -23); c.lineTo(-3, -17); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(6, -15); c.lineTo(10, -23); c.lineTo(3, -17); c.closePath(); c.fill();
    }
    c.strokeStyle = '#1e1410'; c.lineWidth = 1.2;              // 怒眉
    c.beginPath(); c.moveTo(-5, -9.6); c.lineTo(-1.4, -8.2); c.moveTo(5, -9.6); c.lineTo(1.4, -8.2); c.stroke();
    c.fillStyle = '#1e1410'; circ(c, -3, -7.2, 0.95); circ(c, 3, -7.2, 0.95);
  }
  /* 立绘整体染色（冻结、中毒），按图片和颜色缓存 */
  const tintMap = new Map();
  function spriteTint(im, rgb) {
    let m = tintMap.get(im); if (!m) tintMap.set(im, (m = {}));
    if (m[rgb]) return m[rgb];
    const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
    const c = cv.getContext('2d');
    c.drawImage(im, 0, 0); c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgb(' + rgb + ')'; c.fillRect(0, 0, cv.width, cv.height);
    return (m[rgb] = cv);
  }
  function drawBars(c, e, d, k) {
    // 血条
    if (e.hp < e.max || d.id === 'boss') {
      const w = d.id === 'boss' ? 70 : d.r * 2, hy = e.y - d.r * (k || 2.1) - (d.id === 'boss' ? 14 : 4);
      c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(e.x - w / 2 - 1, hy - 1, w + 2, d.id === 'boss' ? 7 : 5);
      c.fillStyle = d.id === 'boss' ? '#ff5a3a' : '#e8463a'; c.fillRect(e.x - w / 2, hy, w * Math.max(0, e.hp / e.max), d.id === 'boss' ? 5 : 3);
      if (d.id === 'boss') { c.fillStyle = '#ffe9a8'; c.font = 'bold 12px "Microsoft YaHei",sans-serif'; c.textAlign = 'center'; c.fillText(e.name, e.x, hy - 4); }
    }
  }

  /* 城墙裂缝（城防低了画在垛口上）：几道带分叉的深色折线，旁边一道浅色的崩口 */
  let crackCv = null;
  function crack() {
    if (crackCv) return crackCv;
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 96;
    const g = cv.getContext('2d'); let sd = 11; const rnd = () => { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646; };
    const branch = (x, y, a, len, w) => {
      const pts = [[x, y]];
      for (let d = 0; d < len; d += 7) { a += (rnd() - 0.5) * 1.1; x += Math.cos(a) * 7; y += Math.sin(a) * 7; pts.push([x, y]); if (w > 1.6 && rnd() < 0.3) branch(x, y, a + (rnd() < 0.5 ? 0.9 : -0.9), len * 0.4, w * 0.55); }
      [['rgba(255,230,200,.35)', w + 1.4, 1.2], ['rgba(20,12,8,.92)', w, 0]].forEach(s => {
        g.strokeStyle = s[0]; g.lineJoin = 'round'; g.lineCap = 'round';
        for (let k = 1; k < pts.length; k++) { g.lineWidth = Math.max(0.6, s[1] * (1 - k / pts.length * 0.75)); g.beginPath(); g.moveTo(pts[k - 1][0] + s[2], pts[k - 1][1] + s[2]); g.lineTo(pts[k][0] + s[2], pts[k][1] + s[2]); g.stroke(); }
      });
    };
    for (let i = 0; i < 5; i++) branch(64 + (rnd() - 0.5) * 8, 20 + rnd() * 6, Math.PI * (0.2 + i * 0.15), 34 + rnd() * 22, 3.4);
    const gr = g.createRadialGradient(64, 26, 0, 64, 26, 26); gr.addColorStop(0, 'rgba(16,10,6,.75)'); gr.addColorStop(1, 'rgba(16,10,6,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(64, 26, 26, 14, 0, 0, TAU); g.fill();
    return (crackCv = cv);
  }
  /* 盾牌（于禁的盾墙）：蓝钢盾面、金边、中间一个铜钉 */
  let shieldCv = null;
  function shield() {
    if (shieldCv) return shieldCv;
    const cv = document.createElement('canvas'); cv.width = 76; cv.height = 96;
    const g = cv.getContext('2d');
    const path = () => { g.beginPath(); g.moveTo(8, 10); g.lineTo(68, 10); g.lineTo(68, 52); g.quadraticCurveTo(66, 78, 38, 92); g.quadraticCurveTo(10, 78, 8, 52); g.closePath(); };
    const gr = g.createLinearGradient(0, 0, 76, 96); gr.addColorStop(0, '#6f9be0'); gr.addColorStop(1, '#2b4a8c');
    path(); g.fillStyle = gr; g.fill(); g.lineWidth = 7; g.strokeStyle = '#1a120e'; g.stroke(); g.lineWidth = 3.5; g.strokeStyle = '#f0c66a'; g.stroke();
    g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.moveTo(14, 16); g.lineTo(36, 16); g.lineTo(18, 60); g.lineTo(14, 50); g.closePath(); g.fill();
    g.fillStyle = '#f0c66a'; g.strokeStyle = '#1a120e'; g.lineWidth = 2.5; g.beginPath(); g.arc(38, 44, 9, 0, TAU); g.fill(); g.stroke();
    return (shieldCv = cv);
  }
  /* 兵器图标：assets/weapons/<id>.png 有图就用图；没有就按样子（剑 刀 枪 弓 扇 戟 斧）画一个，斜着摆在品质色的底上 */
  const wCache = {};
  function weaponIcon(id, px) {
    px = px || 64; const key = id + '@' + px;
    if (wCache[key]) return wCache[key];
    const w = WEAPON_MAP[id], q = QUALITIES[w.q], im = Assets.get('weapons/' + id);
    const cv = document.createElement('canvas'); cv.width = cv.height = px * 2;
    const c = cv.getContext('2d'); c.scale(px * 2 / 64, px * 2 / 64);
    const g = c.createRadialGradient(32, 26, 4, 32, 32, 46); g.addColorStop(0, q.color); g.addColorStop(1, q.dark);
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    c.fillStyle = 'rgba(20,12,8,.45)'; c.beginPath(); c.arc(32, 32, 25, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 1.5; c.beginPath(); c.arc(32, 32, 25, 0, TAU); c.stroke();
    if (im) c.drawImage(im, 4, 4, 56, 56);
    else {
      c.save(); c.translate(32, 32); c.rotate(0.7); c.lineJoin = 'round'; c.lineCap = 'round';
      const OUT = '#1a120e', METAL = '#eef2f6', SHADE = '#aeb8c4', WOOD = '#8a5428', GOLD = '#ffd24a', RED = '#d8423a';
      const shape = (pts, fill, close) => { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); if (close !== false) c.closePath(); c.fillStyle = fill; c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.2; c.stroke(); };
      const shaft = (y0, y1, wd) => { c.strokeStyle = OUT; c.lineWidth = wd + 2.6; c.beginPath(); c.moveTo(0, y0); c.lineTo(0, y1); c.stroke(); c.strokeStyle = WOOD; c.lineWidth = wd; c.beginPath(); c.moveTo(0, y0); c.lineTo(0, y1); c.stroke(); };
      const t = w.type;
      if (t === 'sword') {
        shape([[0, -27], [4.5, -20], [3.6, 8], [-3.6, 8], [-4.5, -20]], METAL); c.strokeStyle = SHADE; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, -22); c.lineTo(0, 6); c.stroke();
        shape([[-10, 8], [10, 8], [8, 12], [-8, 12]], GOLD); shaft(13, 23, 3.4); c.fillStyle = GOLD; c.strokeStyle = OUT; c.lineWidth = 2; c.beginPath(); c.arc(0, 25, 3, 0, TAU); c.fill(); c.stroke();
      } else if (t === 'blade') {
        shaft(-2, 26, 3.4);
        c.beginPath(); c.moveTo(-3, 0); c.lineTo(-3.5, -16); c.quadraticCurveTo(-2, -27, 7, -28); c.quadraticCurveTo(10, -16, 4.5, 0); c.closePath(); c.fillStyle = METAL; c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.2; c.stroke();
        c.strokeStyle = SHADE; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-0.5, -3); c.quadraticCurveTo(-1, -20, 5, -25); c.stroke();
        shape([[-6, 0], [7, 0], [6, 3.5], [-5, 3.5]], GOLD); c.fillStyle = RED; c.beginPath(); c.arc(-4, 7, 2.6, 0, TAU); c.fill();
      } else if (t === 'spear') {
        shaft(-12, 27, 2.8); shape([[0, -29], [5, -19], [0, -11], [-5, -19]], METAL);
        c.fillStyle = RED; c.strokeStyle = OUT; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-1, -11); c.quadraticCurveTo(-9, -6, -5, 0); c.quadraticCurveTo(-2, -5, 1, -11); c.closePath(); c.fill(); c.stroke();
      } else if (t === 'bow') {
        c.strokeStyle = OUT; c.lineWidth = 6.4; c.beginPath(); c.moveTo(-6, -25); c.quadraticCurveTo(17, 0, -6, 25); c.stroke();
        c.strokeStyle = WOOD; c.lineWidth = 3.6; c.beginPath(); c.moveTo(-6, -25); c.quadraticCurveTo(17, 0, -6, 25); c.stroke();
        c.strokeStyle = GOLD; c.lineWidth = 3.8; c.beginPath(); c.moveTo(4.2, -5); c.quadraticCurveTo(6, 0, 4.2, 5); c.stroke();
        c.strokeStyle = '#f4ead0'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-6, -25); c.lineTo(-6, 25); c.stroke();
      } else if (t === 'fan') {
        for (let i = -3; i <= 3; i++) { c.save(); c.rotate(i * 0.3); c.beginPath(); c.ellipse(0, -15, 4.2, 13, 0, 0, TAU); c.fillStyle = i % 2 ? '#f6f2e6' : '#ffffff'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.8; c.stroke(); c.strokeStyle = SHADE; c.lineWidth = 0.9; c.beginPath(); c.moveTo(0, -3); c.lineTo(0, -26); c.stroke(); c.restore(); }
        shaft(2, 24, 3.2); c.fillStyle = GOLD; c.strokeStyle = OUT; c.lineWidth = 2; c.beginPath(); c.arc(0, 1, 4, 0, TAU); c.fill(); c.stroke();
      } else if (t === 'halberd') {
        shaft(-12, 27, 2.8); shape([[0, -30], [4.4, -20], [0, -13], [-4.4, -20]], METAL);
        [-1, 1].forEach(s => { c.beginPath(); c.moveTo(s * 2.5, -15); c.quadraticCurveTo(s * 14, -22, s * 11, -7); c.quadraticCurveTo(s * 7, -12, s * 2.5, -8); c.closePath(); c.fillStyle = METAL; c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(); });
        c.fillStyle = RED; c.beginPath(); c.arc(0, -6, 2.6, 0, TAU); c.fill();
      } else if (t === 'hammer') {
        shaft(-10, 27, 3.2);
        c.fillStyle = METAL; c.strokeStyle = OUT; c.lineWidth = 2.2; c.beginPath(); c.arc(0, -17, 10, 0, TAU); c.fill(); c.stroke();
        c.strokeStyle = SHADE; c.lineWidth = 1.4; c.beginPath(); c.arc(0, -17, 6, 0.6, 2.4); c.stroke();
        for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; shape([[Math.cos(a) * 9, -17 + Math.sin(a) * 9], [Math.cos(a + 0.25) * 13.5, -17 + Math.sin(a + 0.25) * 13.5], [Math.cos(a + 0.5) * 9, -17 + Math.sin(a + 0.5) * 9]], SHADE); }
        shape([[-4, -8], [4, -8], [3, -4], [-3, -4]], GOLD);
      } else if (t === 'relic') {                               // 宝物：一卷竹简
        c.rotate(-0.7);
        shape([[-17, -11], [17, -11], [17, 11], [-17, 11]], '#d8b878');
        c.strokeStyle = '#8a6a3a'; c.lineWidth = 1.2; for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(i * 4.6, -10); c.lineTo(i * 4.6, 10); c.stroke(); }
        c.strokeStyle = RED; c.lineWidth = 2; c.beginPath(); c.moveTo(-17, -5); c.lineTo(17, -5); c.moveTo(-17, 5); c.lineTo(17, 5); c.stroke();
        [-19, 19].forEach(x => { c.strokeStyle = OUT; c.lineWidth = 6; c.beginPath(); c.moveTo(x, -14); c.lineTo(x, 14); c.stroke(); c.strokeStyle = WOOD; c.lineWidth = 3.4; c.beginPath(); c.moveTo(x, -14); c.lineTo(x, 14); c.stroke(); });
        c.fillStyle = GOLD; c.strokeStyle = OUT; c.lineWidth = 1.6; c.beginPath(); c.arc(0, 0, 3.4, 0, TAU); c.fill(); c.stroke();
      } else {                                                  // 斧
        shaft(-22, 27, 3.2);
        c.beginPath(); c.moveTo(1.5, -22); c.quadraticCurveTo(15, -27, 15, -11); c.quadraticCurveTo(15, 3, 1.5, -2); c.closePath(); c.fillStyle = METAL; c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.2; c.stroke();
        c.strokeStyle = SHADE; c.lineWidth = 1.2; c.beginPath(); c.moveTo(11, -20); c.quadraticCurveTo(13.5, -11, 11, -3); c.stroke();
        shape([[-5, -17], [1.5, -19], [1.5, -5], [-5, -7]], SHADE);
      }
      c.restore();
    }
    try { return (wCache[key] = cv.toDataURL()); } catch (e) { return (wCache[key] = im ? im.src : ''); }
  }
  /* 进游戏之后才下完的图：把已经做好的头像、兵器图标作废，下次用的时候按新图重做 */
  function refresh() { Object.keys(pCache).forEach(k => delete pCache[k]); Object.keys(wCache).forEach(k => delete wCache[k]); }
  return { background, hero, enemy, enemyGhost, heroSprite, enemySprite, portrait, depth, circ, ell, rr, TAU, crack, weaponIcon, shield, refresh };
})();
