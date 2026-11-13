'use strict';
/* ============================================================
 * 特效贴图生成：启动时用代码画出一套技能特效贴图（黑底，叠加混合用）
 * 烽火守城自己的画法：偏写实的光、带笔触的刀光和碎屑，不用别的游戏的图。
 * assets/fx/ 里放了同名图片（见 tools/art-prompts-25d.html 的特效部分）就用图片，没放的用这里生成的。
 * ============================================================ */

const FXGen = (function () {
  const TAU = Math.PI * 2;
  let seed = 7;
  const R = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  function mk(w, h, draw) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d');
    c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'lighter';
    draw(c, w, h);
    return cv;
  }
  function radial(c, x, y, r, stops) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    stops.forEach(s => g.addColorStop(s[0], s[1]));
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  }
  /* 粗细渐变的一笔（刀光、火舌、碎屑都用它） */
  function stroke(c, pts, w0, w1, color) {
    for (let i = 1; i < pts.length; i++) {
      const t = i / (pts.length - 1);
      c.strokeStyle = color; c.lineWidth = w0 + (w1 - w0) * t; c.lineCap = 'round';
      c.beginPath(); c.moveTo(pts[i - 1][0], pts[i - 1][1]); c.lineTo(pts[i][0], pts[i][1]); c.stroke();
    }
  }
  function sparks(c, x, y, n, r0, r1, color, len) {
    for (let i = 0; i < n; i++) {
      const a = R() * TAU, d = r0 + R() * (r1 - r0), l = len * (0.4 + R());
      c.strokeStyle = color; c.lineWidth = 0.8 + R() * 1.6; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d); c.lineTo(x + Math.cos(a) * (d + l), y + Math.sin(a) * (d + l)); c.stroke();
    }
  }

  const G = {
    /* 刀光：凸面朝上的月牙，由几十道带毛边的细笔触叠成 */
    slash: () => mk(384, 192, (c, w, h) => {
      const cx = w / 2, cy = h * 0.95, R0 = h * 0.82;
      for (let i = 0; i < 46; i++) {
        const t = i / 45, rr = R0 - t * h * 0.28 + (R() - 0.5) * 6;
        const a0 = Math.PI * (1.1 + R() * 0.06 + t * 0.08), a1 = Math.PI * (1.9 - R() * 0.06 - t * 0.08), n = 24, pts = [];
        for (let k = 0; k <= n; k++) { const a = a0 + (a1 - a0) * k / n; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.92]); }
        const al = (1 - t) * 0.32 + 0.05, col = t < 0.18 ? 'rgba(255,255,255,' + Math.min(1, al + 0.45) + ')' : 'rgba(255,232,190,' + al + ')';
        for (let k = 1; k < pts.length; k++) {
          const m = Math.sin(k / n * Math.PI);                      // 中间粗两头细
          c.strokeStyle = col; c.lineWidth = (t < 0.18 ? 9 : 3.4) * m + 0.4; c.lineCap = 'round';
          c.beginPath(); c.moveTo(pts[k - 1][0], pts[k - 1][1]); c.lineTo(pts[k][0], pts[k][1]); c.stroke();
        }
      }
      sparks(c, cx, cy, 30, R0 * 0.95, R0 * 1.05, 'rgba(255,230,180,.6)', 10);
    }),
    /* 命中闪光：放射状光刺 */
    burst: () => mk(256, 256, (c, w) => {
      const x = w / 2;
      for (let i = 0; i < 44; i++) {
        const a = R() * TAU, l = w * (0.18 + R() * 0.3);
        stroke(c, [[x, x], [x + Math.cos(a) * l, x + Math.sin(a) * l]], 3 + R() * 3, 0.3, 'rgba(255,240,210,' + (0.25 + R() * 0.4) + ')');
      }
      radial(c, x, x, w * 0.3, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,230,170,.7)'], [1, 'rgba(255,170,80,0)']]);
    }),
    /* 冲击环 */
    ring: () => mk(256, 256, (c, w) => {
      const x = w / 2;
      [[0.44, 10, 0.12], [0.44, 4, 0.35], [0.45, 1.6, 0.9]].forEach(r => { c.strokeStyle = 'rgba(255,240,215,' + r[2] + ')'; c.lineWidth = r[1]; c.beginPath(); c.arc(x, x, w * r[0], 0, TAU); c.stroke(); });
      sparks(c, x, x, 50, w * 0.38, w * 0.46, 'rgba(255,230,190,.5)', 8);
    }),
    /* 火焰：很多柔光粒子从下往上飘，越往上越小、越红，叠出写实的火苗 */
    flame: () => mk(128, 256, (c, w, h) => {
      for (let i = 0; i < 140; i++) {
        const t = Math.pow(R(), 0.8), y = h * 0.92 - t * h * 0.82, sway = Math.sin(t * 5 + R() * 2) * w * 0.12 * t;
        const x = w / 2 + sway + (R() - 0.5) * w * 0.35 * (1 - t * 0.7), r = w * (0.22 - t * 0.17) * (0.6 + R() * 0.6);
        const col = t < 0.25 ? '255,235,170' : t < 0.55 ? '255,160,60' : '220,70,20';
        radial(c, x, y, r, [[0, 'rgba(' + col + ',' + (0.16 - t * 0.08) + ')'], [1, 'rgba(' + col + ',0)']]);
      }
      radial(c, w / 2, h * 0.86, w * 0.32, [[0, 'rgba(255,250,220,.55)'], [1, 'rgba(255,170,70,0)']]);
      for (let i = 0; i < 14; i++) { const x = w / 2 + (R() - 0.5) * w * 0.6, y = h * (0.15 + R() * 0.5); c.fillStyle = 'rgba(255,190,90,' + (0.4 + R() * 0.5) + ')'; c.fillRect(x, y, 1.6, 1.6); }
    }),
    /* 落雷：竖直的锯齿闪电带分叉 */
    bolt: () => mk(128, 384, (c, w, h) => {
      const main = [[w / 2, 0]];
      for (let y = 24; y < h; y += 24) main.push([w / 2 + (R() - 0.5) * w * 0.45, y]);
      main.push([w / 2, h]);
      const draw = (pts, s) => { stroke(c, pts, 14 * s, 10 * s, 'rgba(150,120,255,.18)'); stroke(c, pts, 5 * s, 3 * s, 'rgba(200,180,255,.5)'); stroke(c, pts, 2 * s, 1.4 * s, 'rgba(255,255,255,.95)'); };
      draw(main, 1);
      for (let b = 0; b < 4; b++) {
        const i = 2 + Math.floor(R() * (main.length - 4)), br = [main[i]];
        for (let k = 1; k < 4; k++) br.push([br[k - 1][0] + (R() - 0.5) * 40, br[k - 1][1] + 18 + R() * 12]);
        draw(br, 0.5);
      }
      radial(c, w / 2, h - 10, w * 0.5, [[0, 'rgba(255,255,255,.9)'], [0.3, 'rgba(190,170,255,.5)'], [1, 'rgba(120,90,255,0)']]);
    }),
    /* 光柱：下亮上淡 */
    pillar: () => mk(128, 384, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, 'rgba(255,240,200,0)'); g.addColorStop(0.35, 'rgba(255,240,200,.25)'); g.addColorStop(0.5, 'rgba(255,255,255,.9)'); g.addColorStop(0.65, 'rgba(255,240,200,.25)'); g.addColorStop(1, 'rgba(255,240,200,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.globalCompositeOperation = 'destination-in';
      const v = c.createLinearGradient(0, 0, 0, h); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.5, 'rgba(0,0,0,.6)'); v.addColorStop(1, 'rgba(0,0,0,1)');
      c.fillStyle = v; c.fillRect(0, 0, w, h);
      c.globalCompositeOperation = 'destination-over'; c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 40; i++) { const y = R() * h, x = w / 2 + (R() - 0.5) * w * 0.5; c.fillStyle = 'rgba(255,240,200,' + (y / h * 0.6) + ')'; c.fillRect(x, y, 1.5, 6 + R() * 10); }
    }),
    /* 火爆：火团 + 火舌 + 火星 */
    el_hit_fire: () => mk(192, 192, (c, w) => {
      const x = w / 2;
      for (let i = 0; i < 26; i++) {
        const a = R() * TAU, d = w * (0.08 + R() * 0.2), r = w * (0.08 + R() * 0.12);
        radial(c, x + Math.cos(a) * d, x + Math.sin(a) * d, r, [[0, 'rgba(255,170,60,.5)'], [0.6, 'rgba(220,70,20,.25)'], [1, 'rgba(160,30,10,0)']]);
      }
      radial(c, x, x, w * 0.28, [[0, 'rgba(255,255,230,1)'], [0.35, 'rgba(255,210,110,.8)'], [1, 'rgba(255,110,30,0)']]);
      sparks(c, x, x, 40, w * 0.15, w * 0.4, 'rgba(255,200,110,.7)', 9);
    }),
    /* 冰爆：放射的冰棱 */
    el_hit_ice: () => mk(192, 192, (c, w) => {
      const x = w / 2;
      for (let i = 0; i < 22; i++) {
        const a = R() * TAU, l = w * (0.18 + R() * 0.28), s = 3 + R() * 6, ca = Math.cos(a), sa = Math.sin(a);
        c.fillStyle = 'rgba(170,225,255,' + (0.25 + R() * 0.35) + ')';
        c.beginPath(); c.moveTo(x - sa * s, x + ca * s); c.lineTo(x + ca * l, x + sa * l); c.lineTo(x + sa * s, x - ca * s); c.closePath(); c.fill();
        stroke(c, [[x, x], [x + ca * l * 0.9, x + sa * l * 0.9]], 1.2, 0.3, 'rgba(255,255,255,.7)');
      }
      radial(c, x, x, w * 0.25, [[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(190,235,255,.6)'], [1, 'rgba(120,200,255,0)']]);
    }),
    /* 雷爆 */
    el_hit_thunder: () => mk(192, 192, (c, w) => {
      const x = w / 2;
      for (let i = 0; i < 9; i++) {
        let a = R() * TAU, px = x, py = x; const pts = [[px, py]];
        for (let k = 0; k < 5; k++) { a += (R() - 0.5) * 1.2; px += Math.cos(a) * w * 0.07; py += Math.sin(a) * w * 0.07; pts.push([px, py]); }
        stroke(c, pts, 6, 3, 'rgba(160,130,255,.25)'); stroke(c, pts, 2, 0.8, 'rgba(240,235,255,.9)');
      }
      radial(c, x, x, w * 0.26, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(200,180,255,.6)'], [1, 'rgba(130,90,255,0)']]);
    }),
    /* 风爆：旋转的气流 */
    el_hit_wind: () => mk(192, 192, (c, w) => {
      const x = w / 2;
      for (let i = 0; i < 7; i++) {
        const a0 = i / 7 * TAU, pts = [];
        for (let k = 0; k <= 20; k++) { const t = k / 20, a = a0 + t * 2.6, r = w * (0.06 + t * 0.36); pts.push([x + Math.cos(a) * r, x + Math.sin(a) * r]); }
        stroke(c, pts, 5, 0.5, 'rgba(200,255,235,.45)');
      }
      radial(c, x, x, w * 0.2, [[0, 'rgba(240,255,250,.8)'], [1, 'rgba(120,230,200,0)']]);
    }),
    /* 暗爆：紫黑烟团 */
    el_hit_dark: () => mk(192, 192, (c, w) => {
      const x = w / 2;
      for (let i = 0; i < 18; i++) { const a = R() * TAU, d = w * R() * 0.25; radial(c, x + Math.cos(a) * d, x + Math.sin(a) * d, w * (0.1 + R() * 0.12), [[0, 'rgba(170,90,255,.35)'], [1, 'rgba(60,10,120,0)']]); }
      radial(c, x, x, w * 0.18, [[0, 'rgba(240,210,255,.9)'], [1, 'rgba(150,80,255,0)']]);
      sparks(c, x, x, 24, w * 0.12, w * 0.4, 'rgba(210,160,255,.6)', 8);
    }),
    /* 火球（飞行中） */
    el_orb_fire: () => mk(128, 128, (c, w) => {
      const x = w / 2;
      for (let i = 0; i < 5; i++) {
        const a0 = i / 5 * TAU, pts = [];
        for (let k = 0; k <= 14; k++) { const t = k / 14, a = a0 + t * 2.2, r = w * (0.1 + t * 0.32); pts.push([x + Math.cos(a) * r, x + Math.sin(a) * r]); }
        stroke(c, pts, 8, 1, 'rgba(255,140,40,.45)');
      }
      radial(c, x, x, w * 0.3, [[0, 'rgba(255,255,230,1)'], [0.4, 'rgba(255,190,80,.85)'], [1, 'rgba(255,90,20,0)']]);
    }),
    /* 风团（旋风、风墙；染绿当毒雾用） */
    el_orb_wind: () => mk(160, 160, (c, w) => {
      const x = w / 2;
      for (let i = 0; i < 6; i++) {
        const a0 = i / 6 * TAU, pts = [];
        for (let k = 0; k <= 20; k++) { const t = k / 20, a = a0 + t * 3, r = w * (0.05 + t * 0.4); pts.push([x + Math.cos(a) * r, x + Math.sin(a) * r]); }
        stroke(c, pts, 7, 0.6, 'rgba(170,255,225,.4)'); stroke(c, pts, 2, 0.3, 'rgba(240,255,250,.6)');
      }
      radial(c, x, x, w * 0.16, [[0, 'rgba(230,255,248,.7)'], [1, 'rgba(120,230,200,0)']]);
    }),
    /* 冰枪：尖头朝右 */
    el_arrow_ice: () => mk(192, 48, (c, w, h) => {
      const y = h / 2, g = c.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, 'rgba(120,200,255,0)'); g.addColorStop(0.6, 'rgba(150,215,255,.35)'); g.addColorStop(1, 'rgba(200,240,255,.6)');
      c.fillStyle = g; c.fillRect(0, y - 6, w * 0.75, 12);
      c.fillStyle = 'rgba(175,230,255,.85)'; c.beginPath(); c.moveTo(w, y); c.lineTo(w * 0.62, y - 11); c.lineTo(w * 0.7, y); c.lineTo(w * 0.62, y + 11); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,.95)'; c.beginPath(); c.moveTo(w, y); c.lineTo(w * 0.7, y - 3); c.lineTo(w * 0.7, y + 3); c.closePath(); c.fill();
    }),
    /* 火箭：尖头朝右，拖火尾 */
    el_arrow_fire: () => mk(192, 48, (c, w, h) => {
      const y = h / 2;
      for (let i = 0; i < 14; i++) radial(c, w * (0.15 + i * 0.05), y + (R() - 0.5) * 8, 8 + i * 0.9, [[0, 'rgba(255,170,60,.35)'], [1, 'rgba(255,80,20,0)']]);
      stroke(c, [[w * 0.3, y], [w * 0.96, y]], 2, 3, 'rgba(255,240,200,.9)');
      radial(c, w * 0.94, y, 10, [[0, 'rgba(255,255,230,1)'], [1, 'rgba(255,150,50,0)']]);
    }),
    /* 贯穿的金色枪芒：尖头朝右 */
    thrust: () => mk(384, 96, (c, w, h) => {
      const y = h / 2;
      for (let i = 0; i < 18; i++) { const yy = y + (R() - 0.5) * h * 0.5, x0 = R() * w * 0.4; stroke(c, [[x0, yy], [w * (0.75 + R() * 0.2), y + (yy - y) * 0.2]], 0.3, 1.6, 'rgba(255,225,160,' + (0.15 + R() * 0.3) + ')'); }
      stroke(c, [[w * 0.05, y], [w * 0.97, y]], 1, 7, 'rgba(255,240,200,.75)');
      stroke(c, [[w * 0.3, y], [w * 0.98, y]], 0.5, 2.5, 'rgba(255,255,255,1)');
      radial(c, w * 0.95, y, h * 0.35, [[0, 'rgba(255,255,240,.9)'], [1, 'rgba(255,200,100,0)']]);
    }),
    /* 漩涡（染绿当毒潭地面） */
    whirl: () => mk(256, 256, (c, w) => {
      const x = w / 2;
      for (let i = 0; i < 5; i++) {
        const a0 = i / 5 * TAU, pts = [];
        for (let k = 0; k <= 30; k++) { const t = k / 30, a = a0 + t * 3.6, r = w * (0.04 + t * 0.42); pts.push([x + Math.cos(a) * r, x + Math.sin(a) * r]); }
        stroke(c, pts, 10, 1, 'rgba(255,255,255,.3)');
      }
    }),
    /* 阵图：同心圆、刻度和六芒星（雷云、雷阵、东风、冰封的地面标记） */
    circle: () => mk(320, 320, (c, w) => {
      const x = w / 2, col = a => 'rgba(255,240,210,' + a + ')';
      [[0.47, 3, 0.8], [0.42, 1.2, 0.6], [0.3, 2, 0.7], [0.12, 1.5, 0.6]].forEach(r => { c.strokeStyle = col(r[2]); c.lineWidth = r[1]; c.beginPath(); c.arc(x, x, w * r[0], 0, TAU); c.stroke(); });
      for (let i = 0; i < 48; i++) { const a = i / 48 * TAU, l = i % 4 ? 0.03 : 0.05; c.strokeStyle = col(0.7); c.lineWidth = i % 4 ? 1 : 2; c.beginPath(); c.moveTo(x + Math.cos(a) * w * 0.42, x + Math.sin(a) * w * 0.42); c.lineTo(x + Math.cos(a) * w * (0.42 + l), x + Math.sin(a) * w * (0.42 + l)); c.stroke(); }
      for (let t = 0; t < 2; t++) {
        c.strokeStyle = col(0.75); c.lineWidth = 1.6; c.beginPath();
        for (let i = 0; i <= 3; i++) { const a = t * Math.PI / 3 + i / 3 * TAU - Math.PI / 2; const px = x + Math.cos(a) * w * 0.3, py = x + Math.sin(a) * w * 0.3; i ? c.lineTo(px, py) : c.moveTo(px, py); }
        c.stroke();
      }
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU - Math.PI / 2; c.strokeStyle = col(0.8); c.lineWidth = 1.5; c.beginPath(); c.arc(x + Math.cos(a) * w * 0.36, x + Math.sin(a) * w * 0.36, w * 0.03, 0, TAU); c.stroke(); }
      radial(c, x, x, w * 0.5, [[0, 'rgba(255,230,180,.12)'], [1, 'rgba(255,230,180,0)']]);
    }),
    /* —— 风系（白色，用的时候染成青白）——
     * 龙卷风的身子：下窄上宽、略带 S 弯的漏斗，由一圈圈风痕叠成：正面（下半圈）的弧粗而亮，背面的细而淡 */
    wind_funnel: () => mk(256, 352, (c, w, h) => {
      const cx = p => w / 2 + Math.sin(p * 3.1 + 0.4) * w * 0.07 * (1 - p * 0.3), rad = p => w * (0.05 + 0.4 * Math.pow(p, 0.8)), yy = p => h * (0.96 - p * 0.9);
      for (let i = 0; i <= 44; i++) {                          // 半透明的风柱
        const p = i / 44, r = rad(p), a = 0.045 * (1 - p * 0.5);
        c.save(); c.translate(cx(p), yy(p)); c.scale(1, 0.42);
        const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, 'rgba(255,255,255,' + a + ')'); g.addColorStop(0.78, 'rgba(255,255,255,' + a * 1.5 + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); c.restore();
      }
      for (let i = 0; i < 46; i++) {                           // 风痕
        const p = (i + R()) / 46, r = rad(p) * (0.88 + R() * 0.16), front = i % 3 !== 0;
        const a0 = front ? 0.15 + R() * 1.5 : Math.PI + 0.3 + R() * 1.3, len = 0.9 + R() * 1.2, n = 16;
        const al = (front ? 0.55 : 0.16) * (1 - p * 0.4), wd = front ? 2.4 + p * 5.5 : 1.2 + p * 2;
        let px = 0, py = 0;
        for (let k = 0; k <= n; k++) {
          const a = a0 + len * k / n, x = cx(p) + Math.cos(a) * r, y = yy(p) + Math.sin(a) * r * 0.3;
          if (k) { c.strokeStyle = 'rgba(255,255,255,' + al + ')'; c.lineWidth = wd * Math.sin(k / n * Math.PI) + 0.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(px, py); c.lineTo(x, y); c.stroke(); }
          px = x; py = y;
        }
      }
      c.globalCompositeOperation = 'source-over';              // 顶上散开：往上渐渐压暗
      const g = c.createLinearGradient(0, 0, 0, h * 0.34); g.addColorStop(0, 'rgba(0,0,0,.92)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h * 0.34);
    }),
    /* 一道风：一条略弯的长线，线尾往上卷一个小圈，下面跟一道短的（卡通画里画风的那种线） */
    wind_gust: () => mk(320, 128, (c, w, h) => {
      const one = (x0, y0, len, curl, wd, al) => {
        const pts = [];
        for (let k = 0; k <= 26; k++) { const t = k / 26; pts.push([x0 + t * len, y0 - Math.sin(t * 1.9) * 10]); }
        const ex = x0 + len, ey = y0 - Math.sin(1.9) * 10;
        if (curl) for (let k = 1; k <= 30; k++) { const t = k / 30, a = Math.PI / 2 - t * TAU * 1.2, r = curl * (1 - t * 0.7); pts.push([ex + Math.cos(a) * r, ey - curl + Math.sin(a) * r]); }
        [[2.8, 0.2], [1, 1]].forEach(ps => {                   // 先一层宽的柔光，再一层实线
          for (let k = 1; k < pts.length; k++) {
            const m = Math.sin(Math.pow(k / pts.length, 0.8) * Math.PI);
            c.strokeStyle = 'rgba(255,255,255,' + al * ps[1] + ')'; c.lineWidth = wd * ps[0] * m + 0.5; c.lineCap = 'round';
            c.beginPath(); c.moveTo(pts[k - 1][0], pts[k - 1][1]); c.lineTo(pts[k][0], pts[k][1]); c.stroke();
          }
        });
      };
      one(14, 74, 200, 25, 7, 0.95); one(70, 106, 130, 0, 4.5, 0.7); one(40, 30, 90, 0, 3, 0.45);
    }),
    /* 一道直的风线：略弯、两头尖，旁边跟两道细的 */
    wind_line: () => mk(320, 64, (c, w, h) => {
      [[10, 30, 300, 6, 0.95], [70, 46, 190, 3, 0.55], [40, 15, 140, 2.4, 0.4]].forEach(l => {
        [[2.8, 0.2], [1, 1]].forEach(ps => {
          for (let k = 1; k <= 30; k++) {
            const t0 = (k - 1) / 30, t1 = k / 30, y = t => l[1] - Math.sin(t * Math.PI) * 5;
            c.strokeStyle = 'rgba(255,255,255,' + l[4] * ps[1] + ')'; c.lineWidth = l[3] * ps[0] * Math.sin(Math.pow(t1, 0.7) * Math.PI) + 0.4; c.lineCap = 'round';
            c.beginPath(); c.moveTo(l[0] + t0 * l[2], y(t0)); c.lineTo(l[0] + t1 * l[2], y(t1)); c.stroke();
          }
        });
      });
    }),
    /* 月牙形的风痕：几笔粗细不同的弧叠在一起 */
    wind_arc: () => mk(256, 112, (c, w, h) => {
      const cx = w / 2, cy = h * 1.55, R0 = h * 1.35, n = 24;
      for (let i = 0; i < 5; i++) {
        const rr = R0 - i * 7 - R() * 3, a0 = Math.PI * (1.2 + i * 0.014 + R() * 0.02), a1 = Math.PI * (1.8 - i * 0.03 - R() * 0.03);
        [[2.6, 0.2], [1, 1]].forEach(ps => {
          let px = 0, py = 0;
          for (let k = 0; k <= n; k++) {
            const a = a0 + (a1 - a0) * k / n, x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
            if (k) { c.strokeStyle = 'rgba(255,255,255,' + (i ? 0.5 - i * 0.07 : 0.95) * ps[1] + ')'; c.lineWidth = (i ? 3.6 - i * 0.4 : 8) * ps[0] * Math.sin(k / n * Math.PI) + 0.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(px, py); c.lineTo(x, y); c.stroke(); }
            px = x; py = y;
          }
        });
      }
    }),
  };

  /* 没有对应图片的特效名，用生成的贴图补上 */
  function build(assets) {
    const made = [];
    for (const k in G) if (!assets.get('fx:' + k)) { assets.put('fx/' + k, G[k]()); made.push(k); }
    return made;
  }
  return { build, names: () => Object.keys(G) };
})();
