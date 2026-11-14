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
    /* —— v1.0 新武将的专属贴图 —— */
    /* 开山斧（邢道荣）：斧头在上、斧柄在下 */
    axe: () => mk(128, 160, (c, w, h) => {
      stroke(c, [[w / 2, h * 0.1], [w / 2, h * 0.96]], 7, 6, 'rgba(210,160,100,.9)');
      c.beginPath(); c.moveTo(w / 2 + 3, h * 0.1); c.quadraticCurveTo(w * 0.98, h * 0.04, w * 0.95, h * 0.32); c.quadraticCurveTo(w * 0.9, h * 0.52, w / 2 + 3, h * 0.46); c.closePath();
      const g = c.createLinearGradient(w / 2, 0, w, 0); g.addColorStop(0, 'rgba(150,165,190,.9)'); g.addColorStop(1, 'rgba(255,255,255,1)'); c.fillStyle = g; c.fill();
      c.beginPath(); c.moveTo(w / 2 - 3, h * 0.16); c.lineTo(w * 0.22, h * 0.2); c.lineTo(w * 0.22, h * 0.36); c.lineTo(w / 2 - 3, h * 0.4); c.closePath(); c.fillStyle = 'rgba(190,200,215,.85)'; c.fill();
      radial(c, w * 0.8, h * 0.28, w * 0.5, [[0, 'rgba(255,220,150,.35)'], [1, 'rgba(255,180,80,0)']]);
    }),
    /* 双刃铁戟（典韦掷出去的）：长柄两头各有一对朝外的月牙刃，转起来像个轮子 */
    halberd: () => mk(160, 160, (c, w) => {
      const x = w / 2;
      radial(c, x, x, w * 0.5, [[0, 'rgba(255,200,170,.22)'], [1, 'rgba(255,90,60,0)']]);
      [0.27, 0.73].forEach(py => {
        [-1, 1].forEach(sd => { c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(238,242,250,1)'; c.beginPath(); c.arc(x + sd * w * 0.2, w * py, w * 0.2, 0, TAU); c.fill(); });
        c.globalCompositeOperation = 'source-over'; c.fillStyle = '#000';                       // 两个圆盘各挖掉靠里的一块，剩下朝外鼓的月牙
        c.beginPath(); c.ellipse(x, w * py, w * 0.26, w * 0.17, 0, 0, TAU); c.fill();
      });
      c.globalCompositeOperation = 'lighter';
      stroke(c, [[x, w * 0.04], [x, w * 0.96]], 7, 7, 'rgba(215,190,170,1)');
      [[0.04, -1], [0.96, 1]].forEach(e => { c.fillStyle = 'rgba(245,248,255,1)'; c.beginPath(); c.moveTo(x, w * e[0] + e[1] * -2); c.lineTo(x - 7, w * e[0] - e[1] * 16); c.lineTo(x + 7, w * e[0] - e[1] * 16); c.closePath(); c.fill(); });
    }),
    /* 虎爪（许褚）：三道并排的爪痕 */
    claw: () => mk(192, 192, (c, w) => {
      for (let i = -1; i <= 1; i++) {
        const pts = []; for (let k = 0; k <= 20; k++) { const t = k / 20; pts.push([w * (0.2 + t * 0.6) + i * w * 0.14, w * (0.14 + t * 0.72) - i * w * 0.1 + Math.sin(t * Math.PI) * w * 0.08]); }
        [[3, 0.25, '255,140,60'], [1, 1, '255,240,220']].forEach(ps => { for (let k = 1; k < pts.length; k++) { c.strokeStyle = 'rgba(' + ps[2] + ',' + ps[1] + ')'; c.lineWidth = 11 * ps[0] * Math.sin(k / 20 * Math.PI) + 0.5; c.lineCap = 'round'; c.beginPath(); c.moveTo(pts[k - 1][0], pts[k - 1][1]); c.lineTo(pts[k][0], pts[k][1]); c.stroke(); } });
      }
    }),
    /* 冰莲（大乔）：两层尖瓣的莲花，淡蓝发白 */
    lotus: () => mk(160, 160, (c, w) => {
      const x = w / 2;
      [[8, 0.44, 0.13, '170,220,255', 0.75], [6, 0.3, 0.11, '225,245,255', 0.9]].forEach((L, li) => {
        for (let i = 0; i < L[0]; i++) {
          c.save(); c.translate(x, x); c.rotate(i / L[0] * TAU + li * 0.4);
          c.beginPath(); c.moveTo(0, -w * 0.04); c.quadraticCurveTo(w * L[2], -w * L[1] * 0.55, 0, -w * L[1]); c.quadraticCurveTo(-w * L[2], -w * L[1] * 0.55, 0, -w * 0.04); c.closePath();
          c.fillStyle = 'rgba(' + L[3] + ',' + L[4] + ')'; c.fill(); c.restore();
        }
      });
      radial(c, x, x, w * 0.1, [[0, 'rgba(255,250,210,1)'], [1, 'rgba(255,230,150,0)']]);
      radial(c, x, x, w * 0.5, [[0, 'rgba(180,225,255,.2)'], [1, 'rgba(150,210,255,0)']]);
    }),
    /* 毒泡（法正的毒壕）：几个大小不一的泡泡 */
    bubble: () => mk(96, 96, (c, w) => {
      [[0.38, 0.6, 0.26], [0.7, 0.36, 0.16], [0.68, 0.76, 0.1]].forEach(b => {
        c.strokeStyle = 'rgba(170,255,110,.9)'; c.lineWidth = 3; c.beginPath(); c.arc(w * b[0], w * b[1], w * b[2], 0, TAU); c.stroke();
        radial(c, w * b[0], w * b[1], w * b[2], [[0, 'rgba(120,230,70,.1)'], [1, 'rgba(120,230,70,.35)']]);
        radial(c, w * (b[0] - b[2] * 0.35), w * (b[1] - b[2] * 0.4), w * b[2] * 0.3, [[0, 'rgba(255,255,255,.9)'], [1, 'rgba(255,255,255,0)']]);
      });
    }),
    /* 铁索（庞统）：一串烧红的铁环，横着摆 */
    chain: () => mk(256, 48, (c, w, h) => {
      for (let i = 0; i < 9; i++) {
        const x = 16 + i * 28, flat = i % 2;
        [[7, 'rgba(255,120,40,.25)'], [3.2, 'rgba(255,225,190,.95)']].forEach(ps => { c.strokeStyle = ps[1]; c.lineWidth = ps[0]; c.beginPath(); c.ellipse(x, h / 2, 17, flat ? 4 : 10, 0, 0, TAU); c.stroke(); });
      }
    }),
    /* 符咒（左慈）：一张黄纸，上面朱砂画的符 */
    talisman: () => mk(64, 128, (c, w, h) => {
      c.fillStyle = 'rgba(255,220,110,.95)'; c.fillRect(w * 0.18, h * 0.06, w * 0.64, h * 0.88);
      c.strokeStyle = 'rgba(200,40,30,1)'; c.lineWidth = 4; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(w * 0.34, h * 0.16); c.lineTo(w * 0.66, h * 0.16); c.moveTo(w * 0.5, h * 0.16); c.lineTo(w * 0.5, h * 0.36); c.moveTo(w * 0.32, h * 0.36); c.lineTo(w * 0.68, h * 0.36);
      for (let k = 0; k < 5; k++) c.lineTo(w * (k % 2 ? 0.34 : 0.66), h * (0.46 + k * 0.09));
      c.stroke();
      c.beginPath(); c.arc(w * 0.5, h * 0.86, w * 0.09, 0, TAU); c.stroke();
      radial(c, w / 2, h / 2, h * 0.5, [[0, 'rgba(255,230,120,.25)'], [1, 'rgba(255,200,60,0)']]);
    }),
    /* 心（貂蝉）：粉色的心形 */
    heart: () => mk(96, 96, (c, w) => {
      c.beginPath(); c.moveTo(w * 0.5, w * 0.84); c.bezierCurveTo(w * 0.02, w * 0.5, w * 0.16, w * 0.1, w * 0.5, w * 0.32); c.bezierCurveTo(w * 0.84, w * 0.1, w * 0.98, w * 0.5, w * 0.5, w * 0.84); c.closePath();
      const g = c.createRadialGradient(w * 0.4, w * 0.36, 2, w * 0.5, w * 0.5, w * 0.45); g.addColorStop(0, 'rgba(255,235,245,1)'); g.addColorStop(0.5, 'rgba(255,120,175,.95)'); g.addColorStop(1, 'rgba(230,60,130,.85)');
      c.fillStyle = g; c.fill();
      radial(c, w / 2, w / 2, w * 0.5, [[0, 'rgba(255,150,200,.25)'], [1, 'rgba(255,120,180,0)']]);
    }),
    /* 弯月（貂蝉）：一弯淡黄的月牙，周围一圈月晕 */
    moon: () => mk(192, 192, (c, w) => {
      radial(c, w * 0.5, w * 0.5, w * 0.5, [[0, 'rgba(255,215,235,.3)'], [1, 'rgba(255,170,215,0)']]);
      c.fillStyle = 'rgba(255,245,215,1)'; c.beginPath(); c.arc(w * 0.5, w * 0.5, w * 0.3, 0, TAU); c.fill();
      c.globalCompositeOperation = 'source-over'; c.fillStyle = '#000'; c.beginPath(); c.arc(w * 0.62, w * 0.42, w * 0.27, 0, TAU); c.fill();
      c.globalCompositeOperation = 'lighter'; radial(c, w * 0.62, w * 0.42, w * 0.27, [[0, 'rgba(255,170,215,.12)'], [1, 'rgba(255,170,215,.05)']]);
    }),
    /* 雪花（郭嘉）：六条带分叉的枝 */
    snowflake: () => mk(128, 128, (c, w) => {
      const x = w / 2;
      for (let i = 0; i < 6; i++) {
        c.save(); c.translate(x, x); c.rotate(i / 6 * TAU);
        [[5, 'rgba(150,210,255,.3)'], [2, 'rgba(240,250,255,1)']].forEach(ps => {
          c.strokeStyle = ps[1]; c.lineWidth = ps[0]; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -w * 0.44);
          [0.18, 0.3].forEach(d => { c.moveTo(0, -w * d); c.lineTo(w * 0.09, -w * (d + 0.09)); c.moveTo(0, -w * d); c.lineTo(-w * 0.09, -w * (d + 0.09)); });
          c.stroke();
        });
        c.restore();
      }
      radial(c, x, x, w * 0.12, [[0, 'rgba(255,255,255,.9)'], [1, 'rgba(190,230,255,0)']]);
    }),
    /* 一朵花（小乔的花雨）：五片粉色的花瓣，花心发白 */
    petal: () => mk(96, 96, (c, w) => {
      const x = w / 2;
      for (let i = 0; i < 5; i++) {
        c.save(); c.translate(x, x); c.rotate(i / 5 * TAU);
        const g = c.createRadialGradient(0, -w * 0.2, 0, 0, -w * 0.22, w * 0.24); g.addColorStop(0, 'rgba(255,225,238,.95)'); g.addColorStop(0.6, 'rgba(255,140,185,.8)'); g.addColorStop(1, 'rgba(255,90,150,0)');
        c.fillStyle = g; c.beginPath(); c.ellipse(0, -w * 0.22, w * 0.13, w * 0.22, 0, 0, TAU); c.fill(); c.restore();
      }
      radial(c, x, x, w * 0.12, [[0, 'rgba(255,255,235,1)'], [1, 'rgba(255,220,150,0)']]);
    }),
    /* 冰锥（李典）：一根从地里戳出来的尖冰，底宽顶尖 */
    icespike: () => mk(96, 192, (c, w, h) => {
      [[0.5, 0.04, 0.3, '150,215,255', 0.55], [0.36, 0.34, 0.2, '200,235,255', 0.7], [0.66, 0.42, 0.18, '200,235,255', 0.7], [0.5, 0.1, 0.12, '245,252,255', 0.95]].forEach(S => {
        c.beginPath(); c.moveTo(w * S[0], h * S[1]); c.lineTo(w * (S[0] + S[2]), h * 0.97); c.lineTo(w * (S[0] - S[2]), h * 0.97); c.closePath();
        c.fillStyle = 'rgba(' + S[3] + ',' + S[4] + ')'; c.fill();
      });
      radial(c, w / 2, h * 0.95, w * 0.5, [[0, 'rgba(180,230,255,.5)'], [1, 'rgba(150,210,255,0)']]);
    }),
    /* 弩台（王平）：一张架在木架上的大弩，弩臂朝上 */
    crossbow: () => mk(160, 160, (c, w) => {
      const x = w / 2;
      c.lineCap = 'round';
      [[9, 'rgba(255,190,90,.25)'], [4, 'rgba(255,235,190,1)']].forEach(ps => {
        c.strokeStyle = ps[1]; c.lineWidth = ps[0];
        c.beginPath(); c.moveTo(x, w * 0.12); c.lineTo(x, w * 0.8); c.stroke();                                       // 弩身
        c.beginPath(); c.moveTo(w * 0.1, w * 0.46); c.quadraticCurveTo(x, w * 0.12, w * 0.9, w * 0.46); c.stroke();    // 弩臂
        c.beginPath(); c.moveTo(x - w * 0.2, w * 0.92); c.lineTo(x, w * 0.7); c.lineTo(x + w * 0.2, w * 0.92); c.stroke();   // 木架
      });
      c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(w * 0.1, w * 0.46); c.lineTo(x, w * 0.56); c.lineTo(w * 0.9, w * 0.46); c.stroke();   // 弦
      c.fillStyle = 'rgba(255,255,255,1)'; c.beginPath(); c.moveTo(x, w * 0.04); c.lineTo(x + 7, w * 0.16); c.lineTo(x - 7, w * 0.16); c.closePath(); c.fill();
    }),
    /* 困阵（陈宫）：一张八角的网，一圈圈往里收 */
    net: () => mk(320, 320, (c, w) => {
      const x = w / 2;
      [[6, 0.2], [2, 0.9]].forEach(ps => {
        c.strokeStyle = 'rgba(175,255,120,' + ps[1] + ')'; c.lineWidth = ps[0]; c.lineJoin = 'round';
        [0.47, 0.34, 0.21, 0.09].forEach(rr => { c.beginPath(); for (let i = 0; i <= 8; i++) { const a = i / 8 * TAU + Math.PI / 8, px = x + Math.cos(a) * w * rr, py = x + Math.sin(a) * w * rr; i ? c.lineTo(px, py) : c.moveTo(px, py); } c.stroke(); });
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + Math.PI / 8; c.beginPath(); c.moveTo(x + Math.cos(a) * w * 0.09, x + Math.sin(a) * w * 0.09); c.lineTo(x + Math.cos(a) * w * 0.47, x + Math.sin(a) * w * 0.47); c.stroke(); }
      });
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + Math.PI / 8; radial(c, x + Math.cos(a) * w * 0.47, x + Math.sin(a) * w * 0.47, 12, [[0, 'rgba(240,255,200,1)'], [1, 'rgba(160,255,90,0)']]); }
    }),
    /* 匕首（马岱）：刀尖朝下的短刀，带一道下劈的寒光 */
    dagger: () => mk(64, 192, (c, w, h) => {
      const x = w / 2;
      const g = c.createLinearGradient(0, 0, 0, h * 0.6); g.addColorStop(0, 'rgba(255,240,170,0)'); g.addColorStop(1, 'rgba(255,240,170,.55)');
      c.fillStyle = g; c.beginPath(); c.moveTo(x - 3, 0); c.lineTo(x + 3, 0); c.lineTo(x + 9, h * 0.6); c.lineTo(x - 9, h * 0.6); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,252,235,1)'; c.beginPath(); c.moveTo(x - 9, h * 0.52); c.lineTo(x + 9, h * 0.52); c.lineTo(x, h * 0.97); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,200,90,1)'; c.fillRect(x - 15, h * 0.48, 30, 6); c.fillRect(x - 4, h * 0.34, 8, h * 0.15);
      radial(c, x, h * 0.9, w * 0.45, [[0, 'rgba(255,245,190,.7)'], [1, 'rgba(255,220,120,0)']]);
    }),
    /* 战旗（乐进）：一面插在地上的三角旗 */
    banner: () => mk(128, 192, (c, w, h) => {
      c.strokeStyle = 'rgba(255,235,200,1)'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(w * 0.22, h * 0.04); c.lineTo(w * 0.22, h * 0.97); c.stroke();
      const g = c.createLinearGradient(w * 0.22, 0, w, 0); g.addColorStop(0, 'rgba(255,90,60,.95)'); g.addColorStop(1, 'rgba(255,170,70,.75)');
      c.fillStyle = g; c.beginPath(); c.moveTo(w * 0.22, h * 0.06); c.quadraticCurveTo(w * 0.6, h * 0.1, w * 0.95, h * 0.2); c.quadraticCurveTo(w * 0.62, h * 0.3, w * 0.22, h * 0.44); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,245,215,1)'; c.beginPath(); c.arc(w * 0.22, h * 0.04, 6, 0, TAU); c.fill();
      radial(c, w * 0.22, h * 0.95, w * 0.4, [[0, 'rgba(255,200,120,.5)'], [1, 'rgba(255,160,80,0)']]);
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

  /* ---------------- 实体小图（透明底、粗描边、平涂，不发光）：大招里冲出去的兵、马、象 ----------------
   * 都是俯视、头朝右画的，游戏里按飞行方向转过去；用普通混合画（shots 的 solid: true） */
  function mkSolid(w, h, draw) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d'); c.lineJoin = 'round'; c.lineCap = 'round';
    draw(c, w, h);
    return cv;
  }
  const OUT = '#1a100a';
  const blob = (c, fill, lw, path) => { c.beginPath(); path(); c.fillStyle = fill; c.fill(); c.strokeStyle = OUT; c.lineWidth = lw; c.stroke(); };
  const dust = (c, x, y, n, len) => { for (let i = 0; i < n; i++) { c.strokeStyle = 'rgba(240,225,195,' + (0.55 - i * 0.1) + ')'; c.lineWidth = 5 - i; c.beginPath(); c.moveTo(x, y - (n - 1) * 7 + i * 14); c.lineTo(x - len * (0.6 + (i % 2) * 0.4), y - (n - 1) * 7 + i * 14); c.stroke(); } };
  const SOLID = {
    /* 黄巾兵（程远志）：背影，黄头巾、褐布衣，斜举着长矛往前冲 */
    soldier: () => mkSolid(128, 168, (c, w, h) => {
      const x = w / 2;
      c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(x, h * 0.93, w * 0.3, h * 0.045, 0, 0, TAU); c.fill();
      c.strokeStyle = OUT; c.lineWidth = 8; c.beginPath(); c.moveTo(x + w * 0.2, h * 0.86); c.lineTo(x + w * 0.34, h * 0.1); c.stroke();                 // 矛杆
      c.strokeStyle = '#8a5a2c'; c.lineWidth = 4; c.beginPath(); c.moveTo(x + w * 0.2, h * 0.86); c.lineTo(x + w * 0.34, h * 0.1); c.stroke();
      blob(c, '#e8edf2', 3, () => { c.moveTo(x + w * 0.36, h * 0.01); c.lineTo(x + w * 0.42, h * 0.13); c.lineTo(x + w * 0.27, h * 0.12); c.closePath(); });
      [-1, 1].forEach(sg => blob(c, '#4a3526', 3.5, () => c.ellipse(x + sg * w * 0.11, h * 0.84, w * 0.085, h * 0.075, 0, 0, TAU)));                       // 两条腿
      blob(c, '#8a5a34', 4, () => { c.moveTo(x - w * 0.24, h * 0.5); c.quadraticCurveTo(x, h * 0.38, x + w * 0.24, h * 0.5); c.lineTo(x + w * 0.2, h * 0.8); c.lineTo(x - w * 0.2, h * 0.8); c.closePath(); });   // 布衣
      c.fillStyle = '#f2c230'; c.fillRect(x - w * 0.21, h * 0.66, w * 0.42, h * 0.035); c.strokeStyle = OUT; c.lineWidth = 2; c.strokeRect(x - w * 0.21, h * 0.66, w * 0.42, h * 0.035);   // 腰带
      [-1, 1].forEach(sg => blob(c, '#e8c49c', 3, () => c.ellipse(x + sg * w * 0.27, h * 0.56, w * 0.065, h * 0.06, 0, 0, TAU)));                         // 手
      blob(c, '#f2c230', 4, () => c.arc(x, h * 0.32, w * 0.21, 0, TAU));                                                                                // 后脑勺：整个包在黄巾里
      blob(c, '#d8a820', 3, () => { c.moveTo(x - w * 0.04, h * 0.4); c.lineTo(x - w * 0.2, h * 0.56); c.lineTo(x - w * 0.02, h * 0.5); c.closePath(); }); // 头巾的两条尾巴
      blob(c, '#d8a820', 3, () => { c.moveTo(x + w * 0.04, h * 0.4); c.lineTo(x + w * 0.16, h * 0.58); c.lineTo(x + w * 0.01, h * 0.5); c.closePath(); });
    }),
    /* 冲锋的铁骑，背影（颜良）：黑甲战马的后身、红披风的骑手、长刀高举 */
    horse: () => mkSolid(160, 208, (c, w, h) => {
      const x = w / 2;
      c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(x, h * 0.94, w * 0.36, h * 0.045, 0, 0, TAU); c.fill();
      [-1, 1].forEach(sg => blob(c, '#3a2a22', 3.5, () => c.ellipse(x + sg * w * 0.19, h * 0.86, w * 0.075, h * 0.09, 0, 0, TAU)));                       // 后腿
      blob(c, '#5a4034', 4.5, () => c.ellipse(x, h * 0.68, w * 0.31, h * 0.2, 0, 0, TAU));                                                              // 马臀
      blob(c, '#2a1d16', 3.5, () => { c.moveTo(x - w * 0.05, h * 0.62); c.quadraticCurveTo(x - w * 0.12, h * 0.85, x, h * 0.93); c.quadraticCurveTo(x + w * 0.12, h * 0.85, x + w * 0.05, h * 0.62); c.closePath(); });   // 马尾
      c.strokeStyle = OUT; c.lineWidth = 8; c.beginPath(); c.moveTo(x + w * 0.27, h * 0.52); c.lineTo(x + w * 0.36, h * 0.08); c.stroke();               // 刀杆
      c.strokeStyle = '#7a4a24'; c.lineWidth = 4; c.beginPath(); c.moveTo(x + w * 0.27, h * 0.52); c.lineTo(x + w * 0.36, h * 0.08); c.stroke();
      blob(c, '#eef2f6', 3, () => { c.moveTo(x + w * 0.33, h * 0.14); c.quadraticCurveTo(x + w * 0.52, h * 0.06, x + w * 0.4, -h * 0.0 + 4); c.quadraticCurveTo(x + w * 0.38, h * 0.08, x + w * 0.33, h * 0.14); });   // 刀头
      blob(c, '#c8362c', 4, () => { c.moveTo(x - w * 0.2, h * 0.36); c.quadraticCurveTo(x, h * 0.28, x + w * 0.2, h * 0.36); c.lineTo(x + w * 0.27, h * 0.66); c.quadraticCurveTo(x, h * 0.74, x - w * 0.27, h * 0.66); c.closePath(); });   // 披风
      c.strokeStyle = '#f2c230'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x - w * 0.24, h * 0.64); c.quadraticCurveTo(x, h * 0.71, x + w * 0.24, h * 0.64); c.stroke();
      [-1, 1].forEach(sg => blob(c, '#3d4654', 3, () => c.ellipse(x + sg * w * 0.21, h * 0.38, w * 0.085, h * 0.05, 0, 0, TAU)));                         // 肩甲
      blob(c, '#4a5568', 4, () => c.arc(x, h * 0.25, w * 0.15, 0, TAU));                                                                                // 头盔
      blob(c, '#d8423a', 3, () => { c.moveTo(x, h * 0.13); c.quadraticCurveTo(x - w * 0.16, h * 0.02, x - w * 0.2, h * 0.16); c.quadraticCurveTo(x - w * 0.08, h * 0.12, x, h * 0.13); });   // 盔缨
    }),
    /* 冲锋的铁骑，侧面朝右（曹纯的虎豹骑）：往左冲的时候镜像 */
    horse_side: () => mkSolid(256, 176, (c, w, h) => {
      const y = h * 0.56;
      c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(w * 0.5, h * 0.93, w * 0.34, h * 0.05, 0, 0, TAU); c.fill();
      dust(c, w * 0.2, y, 4, w * 0.18);
      [[0.3, -0.5], [0.4, 0.3], [0.62, -0.3], [0.7, 0.55]].forEach(L => { c.strokeStyle = OUT; c.lineWidth = 13; c.beginPath(); c.moveTo(w * L[0], y + h * 0.1); c.lineTo(w * (L[0] + L[1] * 0.1), h * 0.88); c.stroke(); c.strokeStyle = '#3a2a22'; c.lineWidth = 7.5; c.beginPath(); c.moveTo(w * L[0], y + h * 0.1); c.lineTo(w * (L[0] + L[1] * 0.1), h * 0.88); c.stroke(); });   // 腿（奔跑）
      blob(c, '#2a1d16', 3.5, () => { c.moveTo(w * 0.27, y - h * 0.06); c.quadraticCurveTo(w * 0.1, y - h * 0.14, w * 0.08, y + h * 0.12); c.quadraticCurveTo(w * 0.2, y + h * 0.04, w * 0.28, y + h * 0.04); c.closePath(); });   // 马尾
      blob(c, '#5a4034', 4.5, () => c.ellipse(w * 0.48, y, w * 0.23, h * 0.17, 0, 0, TAU));                                                             // 马身
      blob(c, '#5a4034', 4, () => { c.moveTo(w * 0.62, y - h * 0.1); c.lineTo(w * 0.76, y - h * 0.34); c.lineTo(w * 0.9, y - h * 0.26); c.lineTo(w * 0.86, y - h * 0.12); c.lineTo(w * 0.7, y + h * 0.04); c.closePath(); });   // 脖子和头
      blob(c, '#9aa4b2', 3, () => { c.moveTo(w * 0.78, y - h * 0.33); c.lineTo(w * 0.91, y - h * 0.25); c.lineTo(w * 0.87, y - h * 0.15); c.closePath(); });   // 马面甲
      blob(c, '#f2b030', 3.5, () => c.ellipse(w * 0.46, y - h * 0.02, w * 0.13, h * 0.13, 0, 0, TAU));                                                  // 虎皮鞍垫
      c.strokeStyle = '#3a2a1a'; c.lineWidth = 3; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(w * (0.46 + i * 0.04), y - h * 0.11); c.lineTo(w * (0.45 + i * 0.04), y + h * 0.07); c.stroke(); }
      c.strokeStyle = OUT; c.lineWidth = 8; c.beginPath(); c.moveTo(w * 0.36, y - h * 0.16); c.lineTo(w * 0.97, y - h * 0.3); c.stroke();               // 长槊
      c.strokeStyle = '#7a4a24'; c.lineWidth = 4; c.beginPath(); c.moveTo(w * 0.36, y - h * 0.16); c.lineTo(w * 0.97, y - h * 0.3); c.stroke();
      blob(c, '#eef2f6', 3, () => { c.moveTo(w * 1.0 - 2, y - h * 0.31); c.lineTo(w * 0.92, y - h * 0.36); c.lineTo(w * 0.93, y - h * 0.22); c.closePath(); });
      blob(c, '#2e3644', 4, () => c.ellipse(w * 0.47, y - h * 0.24, w * 0.085, h * 0.15, 0.15, 0, TAU));                                                // 骑手
      blob(c, '#4a5568', 4, () => c.arc(w * 0.5, y - h * 0.41, h * 0.1, 0, TAU));                                                                       // 头盔
      blob(c, '#f2b030', 3, () => { c.moveTo(w * 0.47, y - h * 0.48); c.quadraticCurveTo(w * 0.36, y - h * 0.56, w * 0.3, y - h * 0.42); c.quadraticCurveTo(w * 0.4, y - h * 0.44, w * 0.47, y - h * 0.48); });   // 豹尾盔缨
    }),
    /* 战象，背影（孟获）：圆滚滚的象臀、两只大耳朵往两边张着、背上一顶红色的象轿 */
    elephant: () => mkSolid(208, 224, (c, w, h) => {
      const x = w / 2;
      c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(x, h * 0.94, w * 0.4, h * 0.05, 0, 0, TAU); c.fill();
      [-1, 1].forEach(sg => blob(c, '#b0a8a0', 4, () => c.ellipse(x + sg * w * 0.37, h * 0.36, w * 0.13, h * 0.16, sg * 0.25, 0, TAU)));                  // 耳朵
      [-1, 1].forEach(sg => { c.strokeStyle = OUT; c.lineWidth = 9; c.beginPath(); c.moveTo(x + sg * w * 0.2, h * 0.22); c.quadraticCurveTo(x + sg * w * 0.34, h * 0.1, x + sg * w * 0.3, h * 0.02); c.stroke(); c.strokeStyle = '#fff8e6'; c.lineWidth = 5; c.beginPath(); c.moveTo(x + sg * w * 0.2, h * 0.22); c.quadraticCurveTo(x + sg * w * 0.34, h * 0.1, x + sg * w * 0.3, h * 0.02); c.stroke(); });   // 从两边露出来的牙尖
      [-1, 1].forEach(sg => blob(c, '#6a6460', 4, () => c.ellipse(x + sg * w * 0.19, h * 0.84, w * 0.11, h * 0.1, 0, 0, TAU)));                           // 后腿
      blob(c, '#8f8882', 5, () => c.ellipse(x, h * 0.58, w * 0.34, h * 0.3, 0, 0, TAU));                                                                // 象臀
      c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 3; c.beginPath(); c.arc(x, h * 0.52, w * 0.26, 0.3, Math.PI - 0.3); c.stroke();
      c.strokeStyle = OUT; c.lineWidth = 7; c.beginPath(); c.moveTo(x, h * 0.62); c.quadraticCurveTo(x + w * 0.05, h * 0.76, x - w * 0.02, h * 0.86); c.stroke();   // 尾巴
      c.strokeStyle = '#6a6460'; c.lineWidth = 3.5; c.beginPath(); c.moveTo(x, h * 0.62); c.quadraticCurveTo(x + w * 0.05, h * 0.76, x - w * 0.02, h * 0.86); c.stroke();
      blob(c, '#c8362c', 4, () => { c.moveTo(x - w * 0.24, h * 0.3); c.lineTo(x + w * 0.24, h * 0.3); c.lineTo(x + w * 0.28, h * 0.52); c.lineTo(x - w * 0.28, h * 0.52); c.closePath(); });   // 象轿的红毯
      c.strokeStyle = '#f2c230'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - w * 0.25, h * 0.48); c.lineTo(x + w * 0.25, h * 0.48); c.stroke();
      blob(c, '#8a5a2c', 4, () => { c.moveTo(x - w * 0.17, h * 0.14); c.lineTo(x + w * 0.17, h * 0.14); c.lineTo(x + w * 0.2, h * 0.32); c.lineTo(x - w * 0.2, h * 0.32); c.closePath(); });      // 象轿
      blob(c, '#3a8a4a', 3, () => { c.moveTo(x, h * 0.02); c.lineTo(x + w * 0.14, h * 0.09); c.lineTo(x, h * 0.14); c.closePath(); }); c.strokeStyle = OUT; c.lineWidth = 3; c.beginPath(); c.moveTo(x, h * 0.02); c.lineTo(x, h * 0.16); c.stroke();   // 轿顶的小旗
    }),
  };

  /* 没有对应图片的特效名，用生成的贴图补上 */
  function build(assets) {
    const made = [];
    for (const k in G) if (!assets.get('fx:' + k)) { assets.put('fx/' + k, G[k]()); made.push(k); }
    for (const k in SOLID) if (!assets.get('fx:' + k)) { assets.put('fx/' + k, SOLID[k]()); made.push(k); }
    return made;
  }
  return { build, names: () => Object.keys(G) };
})();
