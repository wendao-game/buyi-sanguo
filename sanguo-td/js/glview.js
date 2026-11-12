'use strict';
/* ============================================================
 * WebGL 战斗画面（PixiJS）：读 Battle 的状态，用显卡把整场战斗画出来
 * - 只负责画，不改游戏逻辑；逻辑和「兼容画面」（battle.js 里的 Canvas 2D 绘制）共用一份状态
 * - 比 2D 画面多的东西：动态光照（场景压暗，灯笼、火焰、技能把周围照亮）、发光特效的泛光、
 *   冲击波扭曲、更多飘动的火星；贴图自动合批，敌人和粒子多了也不卡
 * - WebGL 起不来、画的过程出错、显卡上下文丢失：自动退回 2D 画面
 * - 帧率持续偏低：依次关掉泛光、光照
 * 画法：每帧从对象池里按顺序取 Sprite 摆好（先取的在下面），没用到的隐藏
 * ============================================================ */

const GLView = (function () {
  const W = CFG.W, H = CFG.H, WY = CFG.WALL_Y, TAU = Math.PI * 2, RANGE_Y = 120;
  const FONTS = ['Microsoft YaHei', 'PingFang SC', 'sans-serif'];
  const LANTERNS = [[127, 652, 46], [406, 652, 46], [37, 826, 54], [503, 826, 54]];   // 背景图里四盏灯笼的位置
  const ADD = 1, MUL = 2;                                   // PIXI.BLEND_MODES
  let R = null, ok = false, err = '', cvEl = null, frameNo = 0;
  let stage, world, Lg, La, Lf, Lt, Lo, Lh, boltG, hudG, numW, numH;
  let lightC, lightAmb, lightPool, lightRT, lightSpr, bloomA, bloomB, blurSpr, bloomSpr, shock, cutC, cutSpr, cutMask;
  const fxOn = { light: true, bloom: true };
  const perf = { last: 0, slow: 0, fps: 60 };

  /* ---------------- 贴图 ---------------- */
  const texMap = new Map();
  function T(src) { let t = texMap.get(src); if (!t) { t = PIXI.Texture.from(src); texMap.set(src, t); } return t; }
  function fxT(name, rgb) { const im = rgb ? Assets.tinted(name, rgb) : Assets.get('fx:' + name); return im ? T(im) : null; }
  function canvasTex(w, h, draw) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); return PIXI.Texture.from(cv); }
  let TX = null;
  function makeTextures() {
    TX = {
      disc: canvasTex(64, 64, g => { g.fillStyle = '#fff'; g.beginPath(); g.arc(32, 32, 30, 0, TAU); g.fill(); }),
      ring: canvasTex(128, 128, g => { g.strokeStyle = '#fff'; g.lineWidth = 7; g.beginPath(); g.arc(64, 64, 58, 0, TAU); g.stroke(); }),
      glow: canvasTex(64, 64, g => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.55)'); gr.addColorStop(0.7, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }),
      soft: canvasTex(64, 64, g => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.6, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }),
      gradV: canvasTex(4, 64, g => { const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 4, 64); }),
      haze: canvasTex(4, 128, g => { const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(36,24,18,.6)'); gr.addColorStop(0.4, 'rgba(48,32,22,.2)'); gr.addColorStop(1, 'rgba(48,32,22,0)'); g.fillStyle = gr; g.fillRect(0, 0, 4, 128); }),
      grade: canvasTex(270, 480, g => { const gr = g.createRadialGradient(135, 230, 60, 135, 240, 330); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.7, 'rgba(10,5,2,.12)'); gr.addColorStop(1, 'rgba(10,5,2,.5)'); g.fillStyle = gr; g.fillRect(0, 0, 270, 480); }),
      scorch: canvasTex(128, 128, g => { for (let i = 0; i < 26; i++) { const a = (i * 2.4) % TAU, d = (i * 13 % 34), r = 14 + (i * 7 % 22), x = 64 + Math.cos(a) * d, y = 64 + Math.sin(a) * d; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(18,10,6,.5)'); gr.addColorStop(1, 'rgba(18,10,6,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); } }),
      spike: canvasTex(36, 60, g => { g.fillStyle = '#8fdcff'; g.beginPath(); g.moveTo(0, 60); g.lineTo(18, 0); g.lineTo(36, 60); g.closePath(); g.fill(); g.fillStyle = '#e8f8ff'; g.beginPath(); g.moveTo(12, 56); g.lineTo(18, 0); g.lineTo(22, 56); g.closePath(); g.fill(); }),
      rock: canvasTex(48, 48, g => { g.fillStyle = '#2a1d14'; g.beginPath(); g.arc(24, 24, 23, 0, TAU); g.fill(); g.fillStyle = '#6a5440'; g.beginPath(); g.arc(24, 24, 20, 0, TAU); g.fill(); g.fillStyle = '#8f7658'; g.beginPath(); g.arc(18, 18, 11, 0, TAU); g.fill(); }),
      coin: canvasTex(40, 40, g => { g.fillStyle = '#7a5410'; g.beginPath(); g.arc(20, 21, 18, 0, TAU); g.fill(); g.fillStyle = '#ffd24a'; g.beginPath(); g.arc(20, 19, 17, 0, TAU); g.fill(); g.fillStyle = '#fff1a8'; g.beginPath(); g.arc(15, 14, 7, 0, TAU); g.fill(); g.fillStyle = '#b8862a'; g.fillRect(14, 13, 12, 12); }),
      bun: canvasTex(40, 32, g => { g.fillStyle = '#2a1d14'; g.beginPath(); g.arc(20, 28, 19, Math.PI, 0); g.closePath(); g.fill(); g.fillStyle = '#fbf3e2'; g.beginPath(); g.arc(20, 28, 16.5, Math.PI, 0); g.closePath(); g.fill(); g.fillStyle = '#e8c9a0'; g.beginPath(); g.arc(20, 14, 3, 0, TAU); g.fill(); }),
    };
  }
  const colCache = new Map();
  function col(s) {
    if (typeof s === 'number') return s;
    let v = colCache.get(s);
    if (v === undefined) {
      if (s[0] === '#') { const n = parseInt(s.slice(1), 16); v = s.length === 4 ? (((n >> 8) & 15) * 17 << 16) | (((n >> 4) & 15) * 17 << 8) | ((n & 15) * 17) : n; }
      else { const m = s.match(/[\d.]+/g) || [255, 255, 255]; v = (Math.round(+m[0]) << 16) | (Math.round(+m[1]) << 8) | Math.round(+m[2]); }
      colCache.set(s, v);
    }
    return v;
  }

  /* ---------------- 对象池 ---------------- */
  function layer(parent, blend) { const c = new PIXI.Container(); parent.addChild(c); return { c, pool: [], n: 0, blend: blend || 0 }; }
  /* o: ax ay 锚点, rot, a 透明度, tint, blend, flip */
  function sp(Lr, tex, x, y, w, h, o) {
    let s = Lr.pool[Lr.n++];
    if (!s) { s = new PIXI.Sprite(tex); Lr.c.addChild(s); Lr.pool.push(s); }
    s.visible = true; s.texture = tex;
    s.anchor.set(o && o.ax != null ? o.ax : 0.5, o && o.ay != null ? o.ay : 0.5);
    s.position.set(x, y);
    s.scale.set(w / tex.orig.width * (o && o.flip ? -1 : 1), h / tex.orig.height);
    s.rotation = (o && o.rot) || 0;
    s.alpha = o && o.a != null ? Math.max(0, Math.min(1, o.a)) : 1;
    s.tint = o && o.tint != null ? o.tint : 0xffffff;
    s.blendMode = o && o.blend != null ? o.blend : Lr.blend;
    if (s._sk) { s.skew.set(0, 0); s._sk = false; }
    return s;
  }
  const rect = (Lr, x, y, w, h, c, a, blend) => sp(Lr, PIXI.Texture.WHITE, x, y, w, h, { ax: 0, ay: 0, tint: col(c), a, blend });
  const ell = (Lr, x, y, rx, ry, c, a, blend) => sp(Lr, TX.disc, x, y, rx * 2.13, ry * 2.13, { tint: col(c), a, blend });
  const ringE = (Lr, x, y, rx, ry, c, a, blend) => sp(Lr, TX.ring, x, y, rx * 2.2, ry * 2.2, { tint: col(c), a, blend });
  const glow = (Lr, x, y, r, c, a) => sp(Lr, TX.glow, x, y, r * 2, r * 2, { tint: col(c), a, blend: ADD });
  /* 一条线：细长方块转个角度 */
  function line(Lr, x1, y1, x2, y2, w, c, a, blend) { const d = Math.hypot(x2 - x1, y2 - y1); return sp(Lr, PIXI.Texture.WHITE, (x1 + x2) / 2, (y1 + y2) / 2, d, w, { rot: Math.atan2(y2 - y1, x2 - x1), tint: col(c), a, blend }); }
  function img(Lr, name, x, y, w, h, rot, a, rgb, blend) { const t = fxT(name, rgb); if (!t) return null; return sp(Lr, t, x, y, w, h || w * t.orig.height / t.orig.width, { rot, a: a == null ? 1 : a, blend: blend == null ? ADD : blend }); }
  function endLayer(Lr) { for (let i = Lr.n; i < Lr.pool.length; i++) Lr.pool[i].visible = false; Lr.n = 0; }

  /* ---------------- 文字 ---------------- */
  /* 数字（伤害、金币、城防）用位图字，随便换内容不用重新生成贴图；其他文字生成贴图后按内容缓存 */
  const NUM_RE = /^[0-9\/+\-!%. 城防波]+$/;
  const tcache = new Map();
  function textTex(str, size, color, sw) {
    const key = str + '|' + size + '|' + color + '|' + sw;
    let e = tcache.get(key);
    if (!e) {
      if (tcache.size > 90) { let ok2 = null, ot = Infinity; for (const [k, v] of tcache) if (v.used < ot) { ot = v.used; ok2 = k; } if (ok2 !== null) { tcache.get(ok2).t.destroy(true); tcache.delete(ok2); } }
      const t = new PIXI.Text(str, { fontFamily: FONTS, fontWeight: 'bold', fontSize: size, fill: color, stroke: '#140a06', strokeThickness: sw, lineJoin: 'round', padding: 4 });
      t.resolution = 2; t.updateText(true);
      e = { t, used: 0 }; tcache.set(key, e);
    }
    e.used = frameNo;
    return e.t.texture;
  }
  function txt(Lr, P, str, x, y, size, color, align, sw, a, k) {
    str = String(str); k = k || 1; sw = sw || 3.2;
    const ax = align === 'left' ? 0 : align === 'right' ? 1 : 0.5;
    if (NUM_RE.test(str)) {
      let b = P.pool[P.n++];
      if (!b) { b = new PIXI.BitmapText('', { fontName: 'sgnum', fontSize: 16 }); P.c.addChild(b); P.pool.push(b); }
      b.visible = true; if (b.text !== str) b.text = str;
      const fs = Math.round(size); if (b.fontSize !== fs) b.fontSize = fs;
      b.tint = col(color); b.anchor.set(ax, 0.72); b.position.set(x, y); b.scale.set(k); b.alpha = a == null ? 1 : Math.max(0, Math.min(1, a));
      return;
    }
    const t = textTex(str, Math.round(size), color, sw);
    sp(Lr, t, x, y, t.orig.width * k, t.orig.height * k, { ax, ay: 0.74, a });
  }

  /* ---------------- 初始化 ---------------- */
  const SHOCK_FRAG = `
    varying vec2 vTextureCoord; uniform sampler2D uSampler; uniform highp vec4 inputSize; uniform highp vec4 outputFrame;   // 这两个在顶点着色器里也有，精度要一致
    uniform vec2 uCenter; uniform float uRadius; uniform float uWidth; uniform float uAmp;
    void main(void) {
      vec2 px = vTextureCoord * inputSize.xy + outputFrame.xy;
      vec2 d = px - uCenter; d.y *= 1.5;
      float diff = length(d) - uRadius;
      vec2 off = vec2(0.0);
      if (abs(diff) < uWidth) { float k = 1.0 - abs(diff) / uWidth; off = normalize(d + vec2(0.0001)) * uAmp * k * k; }
      gl_FragColor = texture2D(uSampler, vTextureCoord - off * inputSize.zw);
    }`;
  function init(canvas) {
    cvEl = canvas;
    try {
      if (typeof PIXI === 'undefined') throw new Error('没有加载到 PixiJS');
      PIXI.BaseTexture.defaultOptions.mipmap = PIXI.MIPMAP_MODES.ON;       // 立绘缩小很多倍，开多级贴图免得闪
      R = new PIXI.Renderer({ view: canvas, width: W * 2, height: H * 2, backgroundColor: 0x1a120e, antialias: false, powerPreference: 'high-performance' });
      makeTextures();
      PIXI.BitmapFont.from('sgnum', { fontFamily: FONTS, fontWeight: 'bold', fontSize: 40, fill: '#ffffff', stroke: '#140a06', strokeThickness: 8, lineJoin: 'round' }, { chars: [['0', '9'], '/+-!%. 城防波'], resolution: 2, padding: 6 });
      stage = new PIXI.Container(); stage.scale.set(2);
      world = new PIXI.Container(); stage.addChild(world);
      Lg = layer(world); La = layer(world);
      lightRT = PIXI.RenderTexture.create({ width: W / 4, height: H / 4 });
      lightSpr = new PIXI.Sprite(lightRT); lightSpr.scale.set(4); lightSpr.blendMode = MUL; world.addChild(lightSpr);
      Lf = layer(world, ADD);
      boltG = new PIXI.Graphics(); boltG.blendMode = ADD; world.addChild(boltG);
      bloomA = PIXI.RenderTexture.create({ width: W / 2, height: H / 2 }); bloomB = PIXI.RenderTexture.create({ width: W / 2, height: H / 2 });
      blurSpr = new PIXI.Sprite(bloomA); blurSpr.filters = [new PIXI.BlurFilter(7, 3)];
      bloomSpr = new PIXI.Sprite(bloomB); bloomSpr.scale.set(2); bloomSpr.blendMode = ADD; bloomSpr.alpha = 0.34; world.addChild(bloomSpr);
      Lt = layer(world); numW = layer(world);
      Lo = layer(stage);
      hudG = new PIXI.Graphics(); stage.addChild(hudG);
      Lh = layer(stage); numH = layer(stage);
      cutC = new PIXI.Container(); stage.addChild(cutC); cutSpr = new PIXI.Sprite(PIXI.Texture.WHITE); cutMask = new PIXI.Graphics(); cutC.addChild(cutSpr, cutMask); cutSpr.mask = cutMask; cutC.visible = false;
      lightC = new PIXI.Container(); lightC.scale.set(0.25);
      lightAmb = new PIXI.Sprite(PIXI.Texture.WHITE); lightAmb.width = W; lightAmb.height = H; lightC.addChild(lightAmb);
      lightPool = layer(lightC, ADD);
      shock = new PIXI.Filter(undefined, SHOCK_FRAG, { uCenter: [0, 0], uRadius: 0, uWidth: 60, uAmp: 0 });
      world.filterArea = new PIXI.Rectangle(0, 0, W * 2, H * 2);
      canvas.addEventListener('webglcontextlost', ev => { ev.preventDefault(); disable('显卡上下文丢失'); });
      ok = true;
    } catch (e) { const m = e && e.message || String(e); disable(/WebGL/i.test(m) ? '浏览器不支持 WebGL' : m); }
    apply();
    return ok;
  }
  function disable(why) { ok = false; err = why || err; apply(); }
  /* 两块画布只显示一块：WebGL 的 #gl，或者 2D 的 #cv */
  function apply() {
    const on = active(), cv = document.getElementById('cv');
    if (cvEl) cvEl.style.display = on ? 'block' : 'none';
    if (cv) cv.style.display = on ? 'none' : 'block';
  }
  function active() { return ok && Save.data && Save.data.gfx !== '2d'; }

  /* ---------------- 光照 ---------------- */
  function light(x, y, r, c, a) { if (lightPool.n < 90) sp(lightPool, TX.glow, x, y, r * 2, r * 2, { tint: c, a }); }

  /* ---------------- 角色 ---------------- */
  function drawEnemy(e, t) {
    const d = e.def, ds = Art.depth(e.y), s = d.r / 13 * ds, q = Art.enemySprite(e), tex = T(q.im);
    e.ds = ds;
    const moving = e.frozen <= 0 && e.y < e.stopY;
    const bob = moving ? -Math.abs(Math.sin(e.walk)) * 2.4 : (e.frozen > 0 ? 0 : Math.sin(t * 9 + e.ph) * 1.2);
    ell(La, e.x, e.y + d.r * 0.95 * ds, d.r * 1.05 * ds, d.r * 0.4 * ds, 0x000000, 0.35);
    const k = s * q.k, fx = e.x, fy = e.y + bob + 12.4 * s, w = q.w * k, h = q.h * k, ax = -q.x / q.w, ay = (12.4 - q.y) / q.h;
    const sh = sp(La, tex, fx, fy, w, h * 0.9014, { ax, ay, tint: 0x000000, a: 0.24, flip: e.flip });   // 斜投影：压扁、倒向右下
    sh.scale.y = -sh.scale.y; sh.skew.x = 1.2315; sh._sk = true;
    const rot = moving ? Math.sin(e.walk) * 0.05 : 0;
    sp(La, tex, fx, fy, w, h, { ax, ay, rot, flip: e.flip, tint: e.frozen > 0 ? 0x8fd0ff : e.psn > 0 ? 0xb4f08c : e.slow > 0 ? 0xcfe4ff : 0xffffff });
    if (e.flash > 0) sp(La, tex, fx, fy, w, h, { ax, ay, rot, flip: e.flip, a: Math.min(1, e.flash * 6) * 0.6, blend: ADD });
    if (e.burn > 0) img(La, 'flame', e.x, e.y - d.r * 0.8, d.r * 1.1, d.r * 1.9, 0, 0.35 + Math.sin(t * 18 + e.ph) * 0.1);
    // 状态
    const top = e.y - d.r * 2.5 * ds - (d.id === 'boss' ? 30 : 12);
    if (e.fear > 0) txt(Lt, numW, '!', e.x, top, 15, '#ffe08a', 'center', 3);
    else if (e.conf > 0) for (let i = 0; i < 3; i++) { const a = t * 6 + i * TAU / 3; ell(La, e.x + Math.cos(a) * 9, top + Math.sin(a) * 3, 2.2, 2.2, 0xe8b0ff, 1); }
    if (e.mark > 0 || e.vuln > 0.2) ringE(La, e.x, e.y + d.r * 0.9, d.r * 1.1, d.r * 0.42, e.mark > 0 ? 0xc878ff : 0xffc878, 0.85);
    // 血条
    if (e.hp < e.max || d.id === 'boss') {
      const bw = d.id === 'boss' ? 70 : d.r * 2, hy = e.y - d.r * q.top * ds - (d.id === 'boss' ? 14 : 4), bh = d.id === 'boss' ? 5 : 3;
      rect(La, e.x - bw / 2 - 1, hy - 1, bw + 2, bh + 2, 0x000000, 0.6);
      rect(La, e.x - bw / 2, hy, bw * Math.max(0, e.hp / e.max), bh, d.id === 'boss' ? 0xff5a3a : 0xe8463a, 1);
      if (d.id === 'boss') txt(Lt, numW, e.name, e.x, hy - 4, 12, '#ffe9a8', 'center', 2.4);
    }
  }
  function drawGhost(g) {
    const p = 1 - g.life / g.max, d = g.def, ds = Art.depth(g.y), s = d.r / 13 * ds, q = Art.enemySprite(g), tex = T(q.im), k = s * q.k;
    const o = { ax: -q.x / q.w, ay: (12.4 - q.y) / q.h, flip: g.flip, a: (1 - p) * 0.85 };
    sp(La, tex, g.x, g.y - p * 12 * ds + 12.4 * s, q.w * k * (1 + p * 0.12), q.h * k * (1 - p * 0.2), o);
    o.a = (1 - p) * 0.7; o.blend = ADD;
    sp(La, tex, g.x, g.y - p * 12 * ds + 12.4 * s, q.w * k * (1 + p * 0.12), q.h * k * (1 - p * 0.2), o);
  }
  function drawHeroes(list, t) {
    list.slice().sort((a, b) => a.y - b.y).forEach(h => {
      const d = h.def, qc = col(QUALITIES[d.q].color), S = 1.45, by = h.y + 20 * S, a = Math.min(1, h.anim || 0), q = Art.heroSprite(d), tex = T(q.im);
      ell(La, h.x, by, 25 * S, 9.5 * S, 0x0c0806, 0.66);                                  // 底座
      if (d.q >= 3) glow(La, h.x, h.y + 14 * S, 34 * S, qc, 0.3);
      ringE(La, h.x, by, 26 * S, 10 * S, 0x000000, 0.45);
      ringE(La, h.x, by, 25 * S, 9.4 * S, qc, 0.95);
      if (h.rage >= 100) { ringE(La, h.x, by, 31, 12, 0xffdc6e, 0.55 + Math.sin(t * 8) * 0.3, ADD); glow(La, h.x, by - 6, 42, 0xffd060, 0.22 + Math.sin(t * 8) * 0.08); }
      if (h.hasteT > 0 || h.bigT > 0) ringE(La, h.x, by, 26 + Math.sin(t * 12) * 2, 9, 0xfff0b4, 0.7);
      const breathe = 1 + Math.sin(t * 2.4 + d.seed) * 0.012;
      if (!q.proc) {                                          // 手绘立绘：出手时向前一顿、压扁回弹
        const k = (1 + a * 0.05) * S;
        sp(La, tex, h.x, by - a * 7 * S, q.w * k * (1 + a * 0.03), q.h * k * (1 - a * 0.02) * breathe, { ax: q.ax, ay: q.ay });
      } else sp(La, tex, h.x, by + (Math.sin(t * 2.4 + d.seed) * 1.1 - a * 6) * S, q.w * S * q.k, q.h * S * q.k, { ax: q.ax, ay: q.ay, rot: -a * 0.07 });
      light(h.x, h.y - 10, 78, 0xfff0d8, 0.5);
      if (h.rage >= 100) light(h.x, by, 95, 0xffd870, 0.55);
    });
  }

  /* ---------------- 飞行物 ---------------- */
  function drawShot(s, t) {
    if (s.k === 'arrow' || (s.k === 'lob' && s.el === 'arrow') || s.k === 'earrow') {
      let ax, ay;
      if (s.k === 'arrow') { ax = s.x - s.px; ay = s.y - s.py; } else { ax = s.tx - s.x0; ay = s.ty - s.y0; }
      const d = Math.hypot(ax, ay) || 1; ax /= d; ay /= d;
      if (s.k === 'earrow') { line(La, s.x - ax * 10, s.y - ay * 10, s.x, s.y, 1.6, 0x2a1d14, 1); return; }
      if (s.big) img(Lf, s.burn ? 'el_arrow_fire' : 'thrust', s.x - ax * 20, s.y - ay * 20, s.burn ? 70 : 90, 0, Math.atan2(ay, ax), 1);
      else glow(Lf, s.x, s.y, 8, s.burn ? 0xff9646 : 0xffe6a0, 0.6);
      const L = s.big ? 24 : 16;
      line(La, s.x - ax * L, s.y - ay * L, s.x, s.y, s.big ? 3.4 : 2.2, s.burn ? 0xffb070 : 0xfff1c2, 1);
      ell(La, s.x, s.y, s.big ? 3.2 : 2.2, s.big ? 3.2 : 2.2, 0xffffff, 1);
    } else if (s.k === 'blade') {
      const ang = Math.atan2(s.vy, s.vx);
      if (s.tex && img(Lf, s.tex, s.x, s.y, s.texW || s.w * 2, 0, ang, 1)) { light(s.x, s.y, (s.texW || s.w * 2) * 0.5, 0xe8fff0, 0.7); return; }
      if (s.look === 'arrow') img(Lf, 'thrust', s.x - Math.cos(ang) * s.w * 0.8, s.y - Math.sin(ang) * s.w * 0.8, Math.max(70, s.w * 3.2), 0, ang, 1);
      else if (s.look === 'ice') img(Lf, 'el_arrow_ice', s.x - Math.cos(ang) * s.w * 0.6, s.y - Math.sin(ang) * s.w * 0.6, Math.max(70, s.w * 2.6), 0, ang, 1);
      else {
        const rgb = s.color === 'green' ? '110,255,170' : s.color === 'red' ? '255,120,90' : s.big ? '205,175,255' : '225,210,255';
        img(Lf, 'slash', s.x, s.y, s.w * 1.7, s.w * 0.85, ang + Math.PI / 2, s.big ? 1 : 0.9, rgb);
        if (s.big) { glow(Lf, s.x, s.y, s.w * 0.7, rgb, 0.35); light(s.x, s.y, s.w, col(rgb), 0.6); }
      }
    } else if (s.k === 'lob') {
      if (s.el === 'fire') { const r = (s.big ? 15 : 8) * s.size; img(Lf, 'el_orb_fire', s.x, s.y, r * 4, 0, t * 8, 1); light(s.x, s.y, r * 5, 0xffa050, 0.8); }
      else if (s.el === 'poison') img(Lf, 'el_orb_wind', s.x, s.y, 26, 0, t * 9, 1, '120,235,60');
      else if (s.el === 'ice') { const a = Math.atan2(s.ty - s.y0, s.tx - s.x0); img(Lf, 'el_arrow_ice', s.x - Math.cos(a) * 18, s.y - Math.sin(a) * 18, 64, 0, a, 1); }
      else if (s.el === 'rock') { const p = s.t / s.dur; ell(La, s.tx, s.ty + 4, 16 * p, 6 * p, 0x000000, 0.3); sp(La, TX.rock, s.x, s.y, 24, 24, { rot: t * 6 }); }
    } else if (s.k === 'sweep') {
      sp(Lf, TX.gradV, 0, s.y - 6, W, 56, { ax: 0, ay: 0, tint: 0xc8b4ff, a: 0.7 });
      rect(Lf, 0, s.y - 7, W, 3, 0xffffff, 1);
      for (let x = 30; x < W; x += 80) img(Lf, 'slash', x, s.y + 4, 110, 40, 0, 0.8, '225,210,255');
      light(W / 2, s.y, 300, 0xe0d0ff, 0.5);
    } else if (s.k === 'ship') {
      img(Lf, 'flame', s.x, s.y - 70, 70, 170, Math.PI + Math.sin(t * 20) * 0.04, 0.9);
      glow(Lf, s.x, s.y, 46, 0xff8c32, 0.5); img(Lf, 'el_orb_fire', s.x, s.y, 74, 74, t * 7, 1);
      light(s.x, s.y, 150, 0xffa050, 0.9);
    }
  }

  /* ---------------- 区域 ---------------- */
  function drawZone(z, layerNo, t) {
    if (layerNo === 0) {
      if (z.k === 'pool') {
        const fire = z.el === 'fire', f = Math.min(1, z.life / 0.6) * Math.min(1, (z.max - z.life) / 0.25 + 0.15) * (fire ? 0.28 : 1);
        for (const b of z.blobs) ell(Lg, z.x + b[0] * z.r, z.y + b[1] * z.r * 0.62, b[2] * z.r, b[2] * z.r * 0.62, fire ? 0xb8401a : 0x2f9a1a, 0.42 * f);
        for (const b of z.blobs) ell(Lg, z.x + b[0] * z.r, z.y + b[1] * z.r * 0.62, b[2] * z.r * 0.55, b[2] * z.r * 0.34, fire ? 0xff8a3a : 0x8dea4a, 0.5 * f);
        for (let i = 0; i < 5; i++) { const b = z.blobs[i], pr = (t * 0.9 + i * 0.37) % 1, r = (1 - pr) * 4 * (z.r / 54) + 0.5; ell(Lg, z.x + b[0] * z.r * 1.3, z.y + b[1] * z.r * 0.8 - pr * 10, r, r, fire ? 0xffe08a : 0xd8ff9a, 0.7 * f); }
      } else if (z.k === 'mine') {
        const p = 0.6 + Math.sin(t * 8 + z.x) * 0.3;
        ringE(Lg, z.x, z.y, 14, 6, 0xc4b0ff, p); ell(Lg, z.x, z.y, 6, 2.6, 0xc4b0ff, p * 0.5);
      } else if (z.k === 'icewall') {
        const f = Math.min(1, z.life / 0.5, (z.max - z.life) / 0.25 + 0.1);
        for (let x = 30; x < W; x += 26) { const hgt = 18 + ((x * 7) % 11); sp(Lg, TX.spike, x, z.y + 8, 18, hgt, { ay: 1, a: f }); }
      } else if (z.k === 'frost') {
        const f = Math.min(1, z.life / 0.4, (z.max - z.life) / 0.2 + 0.1);
        ell(Lg, z.x, z.y, z.r, z.r * 0.62, 0xcfefff, 0.35 * f); ringE(Lg, z.x, z.y, z.r, z.r * 0.62, 0xffffff, 0.8 * f);
      }
      return;
    }
    if (layerNo === 1) {
      if (z.k === 'storm') {                                 // 雷云
        const f = Math.min(1, z.life / 0.5, (z.max - z.life) / 0.4 + 0.1), cy = z.y - z.r * 0.9 - 60;
        for (let i = 0; i < 6; i++) sp(La, TX.soft, z.x + Math.cos(i * 1.1 + t) * z.r * 0.55, cy + Math.sin(i * 1.7) * 10, z.r * 0.95, 48, { tint: 0x2a2240, a: 0.6 * f });
      } else if (z.k === 'barrier') {
        const f = Math.min(1, z.life / 0.5, (z.max - z.life) / 0.3 + 0.1);
        rect(La, 0, z.y - 36, W, 72, 0x9ff3d6, 0.18 * f);
        for (let i = 0; i < 6; i++) { const yy = z.y - 30 + i * 12, off = (t * 300 + i * 90) % W; line(La, off - 120, yy, off, yy - 4, 2, 0xe8fff6, 0.8 * f); }
      }
      return;
    }
    // 第 2 层：发光贴图
    if (z.k === 'pool') {
      const f = Math.min(1, z.life / 0.6) * Math.min(1, (z.max - z.life) / 0.25 + 0.15);
      if (z.el === 'fire') {
        glow(Lf, z.x, z.y, z.r * 1.1, 0xff6e1e, 0.09 * f);
        const nf = z.r > 60 ? 2 : 1;
        for (let i = 0; i < nf; i++) { const b = z.blobs[i], fl = 0.85 + Math.sin(t * 14 + i * 2 + z.x) * 0.15; img(Lf, 'flame', z.x + b[0] * z.r * 0.6, z.y + b[1] * z.r * 0.4 - z.r * 0.25 * fl, z.r * 0.42, z.r * 0.7 * fl, 0, 0.3 * f); }
        light(z.x, z.y - 6, z.r * 2, 0xff9040, 0.4 * f);
      } else { img(Lf, 'whirl', z.x, z.y, z.r * 2, z.r * 1.2, t * 0.8, 0.3 * f, '110,230,50'); light(z.x, z.y, z.r * 1.6, 0x90ff60, 0.3 * f); }
    } else if (z.k === 'tornado') {
      const f = Math.min(1, z.life / 0.4) * Math.min(1, (z.max - z.life) / 0.3 + 0.1);
      for (let i = 0; i < 4; i++) { const p = i / 3, rx = z.r * (0.45 + 0.85 * p); img(Lf, 'el_orb_wind', z.x + Math.sin(t * 5 + i) * z.r * 0.12, z.y - p * z.r * 2.1, rx * 2, rx * 0.75, t * (9 - i * 1.5), 0.8 * f); }
    } else if (z.k === 'storm') { img(Lf, 'circle', z.x, z.y, z.r * 1.6, z.r * 0.95, t * 0.6, 0.1 * Math.min(1, z.life / 0.5), '190,160,255'); }
    else if (z.k === 'mine') { img(Lf, 'circle', z.x, z.y, 44, 26, t * 2, 0.7 + Math.sin(t * 8 + z.x) * 0.25, '190,160,255'); light(z.x, z.y, 40, 0xc0a0ff, 0.4); }
    else if (z.k === 'wind') { const f = Math.min(1, z.life / 0.6, (z.max - z.life) / 0.4 + 0.1); img(Lf, 'circle', W / 2, WY - 120, 300, 170, t * 0.5, 0.07 * f, '200,255,235'); }
    else if (z.k === 'frost') { img(Lf, 'circle', z.x, z.y, z.r * 2.1, z.r * 1.3, -t * 0.4, 0.25 * Math.min(1, z.life / 0.4), '170,225,255'); light(z.x, z.y, z.r * 1.5, 0xc0e8ff, 0.5); }
    else if (z.k === 'barrier') { const f = Math.min(1, z.life / 0.5, (z.max - z.life) / 0.3 + 0.1); for (let x = 40; x < W; x += 92) img(Lf, 'el_orb_wind', x, z.y, 110, 60, t * 6 + x, 0.55 * f); }
  }

  /* ---------------- 整帧 ---------------- */
  function render(S, t) {
    if (!ok) return;
    frameNo++;
    const hasBg = !!Assets.get('bg');
    // 帧率持续偏低：先关泛光，再关光照
    const now = performance.now(), ft = perf.last ? now - perf.last : 16; perf.last = now;
    if (ft < 250) { perf.fps += (1000 / Math.max(1, ft) - perf.fps) * 0.05; perf.slow = perf.fps < 38 ? perf.slow + ft : Math.max(0, perf.slow - ft); }
    if (perf.slow > 4000) { perf.slow = 0; if (fxOn.bloom) fxOn.bloom = false; else if (fxOn.light) fxOn.light = false; }

    const sh = S && S.shake > 0 ? 9 * Math.min(1, S.shake * 4) : 0;
    world.position.set((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);

    // —— 地面 ——
    sp(Lg, T(Art.background()), 0, 0, W, H, { ax: 0, ay: 0 });
    if (hasBg) LANTERNS.forEach((l, i) => {
      const f = 0.75 + Math.sin(t * 7 + i * 2.3) * 0.08 + Math.sin(t * 13.7 + i) * 0.05;
      glow(Lg, l[0], l[1], l[2] * (0.95 + f * 0.1), 0xffaa46, 0.42 * f);
      sp(Lg, TX.glow, l[0], l[1] + 26, l[2] * 3, l[2] * 1.2, { tint: 0xff963c, a: 0.2 * f, blend: ADD });
      light(l[0], l[1] + 10, l[2] * 3.4, 0xffb464, 0.95 * f);
    });
    // 整体光：战场中间和城楼平台稍亮，四周暗
    light(W / 2, 400, 560, 0xfff0e0, 0.5); light(W / 2, 800, 330, 0xffe8d0, 0.42);
    if (S) {
      if (S.wallFlash > 0) { sp(Lg, TX.glow, W / 2, WY + 4, 420, 84, { tint: 0xff4628, a: Math.min(1, S.wallFlash * 5), blend: ADD }); light(W / 2, WY, 260, 0xff6040, Math.min(1, S.wallFlash * 5)); }
      for (const d of S.decals) sp(Lg, TX.scorch, d.x, d.y, d.r * 2, d.r * 1.2, { rot: d.rot, a: Math.min(1, d.life / 2) * 0.42 });
      for (const z of S.zones) drawZone(z, 0, t);
      for (const d of S.drops) { if (d.k === 'coin') sp(La, TX.coin, d.x, d.y, 13, 13); else { ell(La, d.x, d.y + 6, 8, 3, 0x000000, 0.3); sp(La, TX.bun, d.x, d.y, 19, 15); } }
      const es = S.enemies.slice().sort((a, b) => a.y - b.y);
      for (const e of es) drawEnemy(e, S.t);
      for (const g of S.ghosts) drawGhost(g);
    }
    sp(La, TX.haze, 0, 0, W, hasBg ? 200 : 300, { ax: 0, ay: 0 });                      // 远处罩一层烟尘：纵深
    if (S) drawHeroes(S.heroes, S.t);
    else { const list = []; Save.data.team.forEach((id, i) => { if (id) list.push({ def: HERO_MAP[id], x: CFG.SLOTS[i][0], y: CFG.SLOTS[i][1], anim: 0, rage: 0 }); }); drawHeroes(list, t); }

    boltG.clear();
    if (S) {
      for (const s of S.shots) drawShot(s, S.t);
      for (const z of S.zones) drawZone(z, 1, S.t);
      for (const z of S.zones) drawZone(z, 2, S.t);
      let nl = 0;
      for (const f of S.fx) {
        const p = 1 - f.life / f.max, k = 1 + (f.grow - 1) * p, a = f.a * Math.min(1, f.life / f.max * 2.5) * (f.fadeIn ? Math.min(1, p / f.fadeIn) : 1);
        sp(Lf, T(f.im), f.x, f.y, f.w * k, f.h * k, { ax: f.ax, ay: f.ay, rot: f.rot, a });
        if (nl++ < 36) light(f.x, f.y - (f.ay === 1 ? f.h * 0.35 : 0), Math.min(220, Math.max(f.w, f.h) * 0.75 * k), 0xfff0d0, Math.min(1, a) * 0.75);
      }
      for (const r of S.rings) {
        const p = 1 - r.life / r.max, rad = r.r0 + (r.r1 - r.r0) * p;
        if (r.fill) glow(Lf, r.x, r.y, rad, r.color, (1 - p) * 0.9);
        else ringE(Lf, r.x, r.y, rad, rad * 0.7, r.color, (1 - p) * 0.9);
      }
      for (const s of S.slashes) { const p = s.life / s.max; line(Lf, s.x - Math.cos(s.a) * 30, s.y - Math.sin(s.a) * 30, s.x + Math.cos(s.a) * 30, s.y + Math.sin(s.a) * 30, 4 * p, 0xffffff, p); }
      for (const b of S.bolts) {
        const a = b.life / b.max, last = b.pts[b.pts.length - 1];
        boltG.lineStyle({ width: 7 * b.wide, color: 0x966eff, alpha: 0.7 * a, cap: 'round', join: 'round' }); b.pts.forEach((p, i) => i ? boltG.lineTo(p[0], p[1]) : boltG.moveTo(p[0], p[1]));
        boltG.lineStyle({ width: 2.2 * b.wide, color: 0xffffff, alpha: a, cap: 'round', join: 'round' }); b.pts.forEach((p, i) => i ? boltG.lineTo(p[0], p[1]) : boltG.moveTo(p[0], p[1]));
        light(last[0], last[1], 90, 0xc8b0ff, 0.8 * a);
      }
      for (const p of S.parts) { const r = p.size * (0.4 + 0.6 * p.life / p.max); sp(Lt, TX.soft, p.x, p.y, r * 2.6, r * 2.6, { tint: col(p.color), a: Math.min(1, p.life / p.max * 1.6) }); }
      for (const x of S.texts) { const p = x.life / x.max; txt(Lt, numW, x.str, x.x, x.y, x.size, x.color, 'center', 3, Math.min(1, p * 2.2), p > 0.85 ? 1 + (p - 0.85) * 3 : 1); }
    }
    // 火星和远处的尘雾
    for (let i = 0; i < 46; i++) {
      const spd = 9 + (i * 7 % 11), ph = i * 37.7, y = H * 0.9 - ((t * spd + ph * 9) % (H * 0.95)), x = (i * 53.3 % W) + Math.sin(t * 0.7 + ph) * 16;
      const tw = 0.5 + Math.sin(t * 3 + ph) * 0.5, r = 1.2 + (i % 3) * 0.6;
      glow(Lf, x, y, r * 4, i % 4 ? 0xffaa50 : 0xffe1a0, 0.26 * tw * Math.min(1, y / 120));
    }
    for (let i = 0; i < 2; i++) { const x = ((t * (6 + i * 4) + i * 300) % (W + 400)) - 200; sp(Lf, TX.glow, x, 150 + i * 90, 380, 114, { tint: 0xffe1be, a: 0.045 }); }

    // —— 画面之上：暗角、闪白、界面 ——
    sp(Lo, TX.grade, 0, 0, W, H, { ax: 0, ay: 0 });
    if (S && S.flash) rect(Lo, 0, 0, W, H, S.flash.color, S.flash.a * S.flash.t / S.flash.max);
    hudG.clear();
    if (S) drawHud(S, t);
    drawCut(S && S.cut);

    endLayer(Lg); endLayer(La); endLayer(Lf); endLayer(Lt); endLayer(numW); endLayer(Lo); endLayer(Lh); endLayer(numH);

    // —— 光照：先把所有光画到一张小图上，再整张乘到画面上 ——
    const useLight = fxOn.light;
    lightSpr.visible = useLight;
    if (useLight) {
      const fl = S && S.flash ? S.flash.a * S.flash.t / S.flash.max : 0, b = v => Math.min(255, Math.round(v + fl * 120));
      lightAmb.tint = (b(150) << 16) | (b(143) << 8) | b(172);
      endLayer(lightPool);
      R.render(lightC, { renderTexture: lightRT, clear: true });
    } else lightPool.n = 0;
    // —— 泛光：发光层缩小、模糊后再叠回去 ——
    const useBloom = fxOn.bloom;
    bloomSpr.visible = useBloom;
    if (useBloom) {
      const m = new PIXI.Matrix().scale(0.5, 0.5);
      R.render(Lf.c, { renderTexture: bloomA, clear: true, transform: m });
      R.render(boltG, { renderTexture: bloomA, clear: false, transform: m });
      R.render(blurSpr, { renderTexture: bloomB, clear: true });
    }
    // —— 冲击波 ——
    const sk = S && S.shock;
    if (sk && sk.t > 0) {
      const p = 1 - sk.t / sk.max;
      shock.uniforms.uCenter = [sk.x * 2, sk.y * 2]; shock.uniforms.uRadius = (20 + sk.r * p) * 2; shock.uniforms.uWidth = 70; shock.uniforms.uAmp = 26 * (1 - p) * (sk.k || 1);
      if (!world.filters) world.filters = [shock];
    } else if (world.filters) world.filters = null;

    R.render(stage);
  }

  function drawHud(S, t) {
    sp(Lo, TX.gradV, 0, 0, W, 120, { ax: 0, ay: 0, tint: 0x0a0604, a: 0.75 });
    txt(Lh, numH, '第' + S.ch.index + '章 ' + S.ch.name + ' · 第' + S.ch.sub + '关', W / 2, 40, 21, '#ffd76a');
    const bx = 130, bw = 280;
    hudG.beginFill(0x000000, 0.6).drawRoundedRect(bx - 2, 51, bw + 4, 20, 10).drawRoundedRect(bx - 2, 75, bw + 4, 15, 7.5).endFill();
    const wp = S.over && S.win ? 1 : Math.min(1, (S.wave - 1 + (S.waveSize ? S.spawned / S.waveSize : 1)) / CFG.WAVES);
    if (wp > 0.03) hudG.beginFill(0xd8cf48).drawRoundedRect(bx, 53, bw * wp, 16, 8).endFill().beginFill(0xffffff, 0.22).drawRoundedRect(bx + 2, 54, Math.max(0, bw * wp - 4), 5, 2.5).endFill();
    const hp = Math.max(0, S.wall / S.wallMax);
    if (hp > 0.03) hudG.beginFill(hp > 0.5 ? 0xe0483a : hp > 0.25 ? 0xe8802a : 0xff2a2a).drawRoundedRect(bx, 77, bw * hp, 11, 5.5).endFill();
    hudG.lineStyle(1.2, 0xe8c15a, 0.6).drawRoundedRect(128, 51, 284, 20, 10).drawRoundedRect(128, 75, 284, 15, 7.5).lineStyle(0);
    txt(Lh, numH, S.wave + '/' + CFG.WAVES + ' 波', W / 2, 66, 13, '#ffffff', 'center', 2.6);
    txt(Lh, numH, '城防 ' + Math.ceil(Math.max(0, S.wall)) + '/' + S.wallMax, W / 2, 87, 11, '#ffffff', 'center', 2.4);
    sp(Lh, TX.coin, W - 92, 34, 19, 19);
    txt(Lh, numH, String(Math.round(S.coins)), W - 78, 40, 17, '#ffe9a8', 'left');
    if (S.aim !== null) {
      const h = S.heroes.find(q => q.slot === S.aim), a = 0.5 + Math.sin(t * 8) * 0.3;
      rect(Lo, 0, 120, W, WY - 120, 0x0a0604, 0.35);
      rect(Lh, 8, RANGE_Y, W - 16, 3, 0xffe08a, a); rect(Lh, 8, WY - 13, W - 16, 3, 0xffe08a, a); rect(Lh, 8, RANGE_Y, 3, WY - RANGE_Y - 10, 0xffe08a, a); rect(Lh, W - 11, RANGE_Y, 3, WY - RANGE_Y - 10, 0xffe08a, a);
      if (h) txt(Lh, numH, '点选战场 · 释放【' + h.def.ult + '】', W / 2, 150, 20, '#ffe08a', 'center', 4);
      txt(Lh, numH, '再点一次头像 = 自动选目标', W / 2, 174, 13, '#e8d8b8', 'center', 3);
    }
    if (S.banner) {
      const p = S.banner.t / S.banner.max, a = S.banner.max > 50 ? 1 : Math.min(1, p * 3, (1 - p) * 6);
      rect(Lh, 0, 300, W, 64, 0x0a0604, 0.6 * a); rect(Lh, 0, 300, W, 2, 0xd8b04a, a); rect(Lh, 0, 362, W, 2, 0xd8b04a, a);
      txt(Lh, numH, S.banner.text, W / 2, 343, 30, S.over && !S.win ? '#ff6a5a' : '#ffe08a', 'center', 5, a);
    }
  }
  /* 大招特写横幅（有特写图的武将才有） */
  function drawCut(k) {
    cutC.visible = !!k;
    if (!k) return;
    const p = k.t / k.dur, ein = Math.min(1, p / 0.16), eout = Math.max(0, (p - 0.8) / 0.2), a = Math.min(1, ein * 2) * (1 - eout);
    const off = (1 - ein) * (1 - ein) * W - eout * eout * W, y = 400, hh = 150, tex = T(k.im), iw = W + 60, ih = iw * tex.orig.height / tex.orig.width;
    rect(Lh, 0, y - hh / 2 - 6, W, hh + 12, 0x000000, 0.45 * a);
    cutSpr.texture = tex; cutSpr.position.set(off - 20, y - ih / 2 + (p * 14 - 7)); cutSpr.width = iw; cutSpr.height = ih; cutC.alpha = a;
    cutMask.clear().beginFill(0xffffff).drawPolygon([off + 20, y - hh / 2, off + W + 40, y - hh / 2, off + W + 10, y + hh / 2, off - 10, y + hh / 2]).endFill();
    rect(Lh, off, y - hh / 2 - 4, W, 4, k.color, a); rect(Lh, off - 20, y + hh / 2, W, 4, k.color, a);
    txt(Lh, numH, k.name, W - 30 - off * 0.6, y + hh / 2 - 16, 40, '#fff3d6', 'right', 6, a);
    txt(Lh, numH, k.who, W - 34 - off * 0.6, y - hh / 2 + 30, 18, k.color, 'right', 4, a);
  }

  return {
    init, render, active, apply, disable,
    get ok() { return ok; }, get error() { return err; }, get fx() { return fxOn; }, get fps() { return Math.round(perf.fps); },
  };
})();
