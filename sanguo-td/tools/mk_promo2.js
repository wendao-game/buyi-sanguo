// 改名「三国·孤城万仞」后的商店图（2026-11-22）：以新图标那张赵云（store/0_图标_赵云.png，1024×1024）当主视觉，人物铺满画面。
// 上一版（mk_promo.js）是一排小人挤在右边、左边四成空着，首页推荐点击率只有 3.8%（布衣三国同期 15%），所以重排。
// 出四张：宣传图 1920×1080、宣传图 1:1 1440×1440、竖版封面 900×1350、横版封面 920×430。图上只放完整的游戏标题（TapTap 预审不让加别的字）。
// 用法：node tools/mk_promo2.js <输出目录> [预览地址=http://localhost:8790/]（要先开着本地预览，用它的字体和图片）
const fs = require('fs'), path = require('path'), os = require('os'), { spawn } = require('child_process');
const OUT = process.argv[2], URL0 = process.argv[3] || 'http://localhost:8790/';
if (!OUT) { console.log('用法：node tools/mk_promo2.js <输出目录> [预览地址]'); process.exit(1); }
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));

const PAGE = async function () {
  await document.fonts.ready;
  await Promise.all([document.fonts.load('bold 100px SGBrush', '三国孤城万仞'), document.fonts.load('bold 40px SGRound', '·')]);
  const img = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('加载失败 ' + src)); im.src = src; });
  /* 从九宫格里抠一个人（和 mk_promo.js 一样）：白底的从格子边缘往里抠，再裁到人物外框 */
  const sheetCache = {};
  async function sheet(src) {
    if (sheetCache[src]) return sheetCache[src];
    const im = await img(src), w = im.width, h = im.height, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d', { willReadFrequently: true }); c.drawImage(im, 0, 0);
    const d = c.getImageData(0, 0, w, h), p = d.data;
    let opaque = true; for (let i = 3; i < p.length; i += 4 * 97) if (p[i] < 250) { opaque = false; break; }
    if (opaque) {
      const TOL = 34, seen = new Uint8Array(w * h), st = [];
      const push = (x, y) => { if (x < 0 || y < 0 || x >= w || y >= h) return; const k = y * w + x; if (seen[k]) return; const o = k * 4; if (255 - p[o] > TOL || 255 - p[o + 1] > TOL || 255 - p[o + 2] > TOL) return; seen[k] = 1; st.push(k); };
      for (let g = 0; g < 4; g++) for (let t = 0; t < Math.max(w, h); t += 3) { push(Math.min(w - 1, Math.floor(g * w / 3)), t); push(t, Math.min(h - 1, Math.floor(g * h / 3))); }
      const bgl = [];
      while (st.length) { const k = st.pop(), x = k % w, y = (k / w) | 0; p[k * 4 + 3] = 0; bgl.push(k); push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1); }
      // 没描边的淡雾、虚影：白底上画的半透明气，把「白」还原成透明度（和 slice_chrome.js 一样）
      const seen2 = new Uint8Array(w * h), st2 = [];
      const push2 = (x, y) => { if (x < 0 || y < 0 || x >= w || y >= h) return; const k = y * w + x; if (seen[k] || seen2[k]) return; const o = k * 4; if (Math.min(p[o], p[o + 1], p[o + 2]) < 150) return; seen2[k] = 1; st2.push(k); };
      for (const k of bgl) { const x = k % w, y = (k / w) | 0; push2(x + 1, y); push2(x - 1, y); push2(x, y + 1); push2(x, y - 1); }
      while (st2.length) { const k = st2.pop(), x = k % w, y = (k / w) | 0, o = k * 4, a = 1 - Math.min(p[o], p[o + 1], p[o + 2]) / 255; if (a < 0.03) p[o + 3] = 0; else { for (let j = 0; j < 3; j++) p[o + j] = Math.max(0, Math.min(255, Math.round((p[o + j] - 255 * (1 - a)) / a))); p[o + 3] = Math.round(255 * Math.min(1, a * 1.15)); } push2(x + 1, y); push2(x - 1, y); push2(x, y + 1); push2(x, y - 1); }
      c.putImageData(d, 0, 0);
    }
    return (sheetCache[src] = cv);
  }
  async function cell(src, i) {
    const cv = await sheet(src), w = cv.width, h = cv.height, cw = Math.floor(w / 3), ch = Math.floor(h / 3), x0 = (i % 3) * cw, y0 = Math.floor(i / 3) * ch;
    const d = cv.getContext('2d').getImageData(x0, y0, cw, ch).data; let bx0 = cw, by0 = ch, bx1 = -1, by1 = -1;
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (d[(y * cw + x) * 4 + 3] > 140) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
    const m = 30; bx0 = Math.max(0, bx0 - m); by0 = Math.max(0, by0 - m); bx1 = Math.min(cw - 1, bx1 + m); by1 = Math.min(ch - 1, by1 + m);
    const o = document.createElement('canvas'); o.width = bx1 - bx0 + 1; o.height = by1 - by0 + 1; o.getContext('2d').drawImage(cv, x0 + bx0, y0 + by0, o.width, o.height, 0, 0, o.width, o.height);
    return o;
  }
  const S = '/assets/_sheets/';
  const P = {
    god_lvbu: await cell(S + 'enemy_8.png', 0), god_guanyu: await cell(S + 'enemy_8.png', 2), god_zhuge: await cell(S + 'enemy_8.png', 3),
    god_zhenji: await cell(S + 'enemy_22.webp', 0), snake: await cell(S + 'enemy_22.webp', 2),
  };
  const hero = await img('/store/' + encodeURIComponent('0_图标_赵云.png'));   // 主视觉：新图标那张赵云
  let seed = 11; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const NAME = ['三国', '孤城万仞'];

  function person(g, k, cx, footY, h, glow, flip) {
    const im = P[k], w = h * im.width / im.height;
    g.save(); g.fillStyle = 'rgba(0,0,0,.5)'; g.beginPath(); g.ellipse(cx, footY - 30 * h / im.height - h * 0.015, w * 0.32, h * 0.05, 0, 0, 7); g.fill();
    if (flip) { g.translate(cx, 0); g.scale(-1, 1); g.translate(-cx, 0); }
    g.shadowColor = glow || 'rgba(255,170,70,.85)'; g.shadowBlur = h * 0.1; g.drawImage(im, cx - w / 2, footY - h, w, h);
    g.shadowBlur = 0; g.drawImage(im, cx - w / 2, footY - h, w, h); g.restore();
  }
  /* 标题一行：「三国·孤城万仞」。「·」毛笔体里没有，自己画一个墨点。返回这一行的宽度 */
  function titleLine(g, x, y, size, align, measureOnly) {
    g.save(); g.font = 'bold ' + size + 'px SGBrush, SGRound, "Microsoft YaHei", sans-serif'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
    const w1 = g.measureText(NAME[0]).width, w2 = g.measureText(NAME[1]).width, gap = size * 0.42, W = w1 + gap + w2;
    if (measureOnly) { g.restore(); return W; }
    const x0 = align === 'center' ? x - W / 2 : x;
    const parts = [[NAME[0], x0], [NAME[1], x0 + w1 + gap]], dot = { x: x0 + w1 + gap / 2, y: y - size * 0.34, r: size * 0.075 };
    const fillG = () => { const gr = g.createLinearGradient(0, y - size * 0.85, 0, y + size * 0.1); gr.addColorStop(0, '#fff6c8'); gr.addColorStop(0.45, '#ffd24a'); gr.addColorStop(1, '#ff8a1e'); return gr; };
    g.textAlign = 'left';
    g.shadowColor = 'rgba(255,110,30,.9)'; g.shadowBlur = size * 0.28; g.lineWidth = size * 0.16; g.strokeStyle = '#2a0a04';
    for (const [t, px] of parts) g.strokeText(t, px, y); g.beginPath(); g.arc(dot.x, dot.y, dot.r + size * 0.06, 0, 7); g.fillStyle = '#2a0a04'; g.fill();
    g.shadowBlur = 0; g.lineWidth = size * 0.11; g.strokeStyle = '#5a1206';
    for (const [t, px] of parts) g.strokeText(t, px, y); g.beginPath(); g.arc(dot.x, dot.y, dot.r + size * 0.035, 0, 7); g.fillStyle = '#5a1206'; g.fill();
    g.fillStyle = fillG(); for (const [t, px] of parts) g.fillText(t, px, y); g.beginPath(); g.arc(dot.x, dot.y, dot.r, 0, 7); g.fill();
    g.restore(); return W;
  }
  /* 标题：给定最大宽度，自动定字号 */
  function title(g, x, y, maxW, align, maxSize) { let size = maxSize || 220; const w = titleLine(g, 0, 0, size, 'left', true); if (w > maxW) size = Math.floor(size * maxW / w); titleLine(g, x, y, size, align); return size; }
  function embers(g, W, H, n) {
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) { const x = rnd() * W, y = H * (0.25 + 0.75 * Math.sqrt(rnd())), r = 1.2 + rnd() * 3, gr = g.createRadialGradient(x, y, 0, x, y, r * 4); gr.addColorStop(0, 'rgba(255,200,110,' + (0.35 + rnd() * 0.5) + ')'); gr.addColorStop(1, 'rgba(255,120,30,0)'); g.fillStyle = gr; g.fillRect(x - r * 4, y - r * 4, r * 8, r * 8); }
    g.restore();
  }
  /* 主视觉铺底：先把它放大、模糊、压暗铺满整张图当底色，再把清楚的那张放在指定位置，四边往底色里化开 */
  function heroOn(g, W, H, x, y, size, fade) {
    g.save(); g.filter = 'blur(' + Math.round(W / 22) + 'px) brightness(.42) saturate(1.2)'; const k = Math.max(W, H) * 1.25; g.drawImage(hero, (W - k) / 2, (H - k) / 2, k, k); g.restore();
    const cv = document.createElement('canvas'); cv.width = cv.height = size; const c = cv.getContext('2d'); c.imageSmoothingQuality = 'high'; c.drawImage(hero, 0, 0, size, size);
    c.globalCompositeOperation = 'destination-out';
    const edge = (x0, y0, x1, y1, rx, ry, rw, rh) => { const gr = c.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(rx, ry, rw, rh); };
    if (fade.l) edge(0, 0, size * fade.l, 0, 0, 0, size * fade.l, size);
    if (fade.r) edge(size, 0, size * (1 - fade.r), 0, size * (1 - fade.r), 0, size * fade.r, size);
    if (fade.t) edge(0, 0, 0, size * fade.t, 0, 0, size, size * fade.t);
    if (fade.b) edge(0, size, 0, size * (1 - fade.b), 0, size * (1 - fade.b), size, size * fade.b);
    g.drawImage(cv, x, y);
  }
  const shade = (g, W, H, stops, x0, y0, x1, y1) => { const gr = g.createLinearGradient(x0, y0, x1, y1); for (const [o, col] of stops) gr.addColorStop(o, col); g.fillStyle = gr; g.fillRect(0, 0, W, H); };

  /* —— 宣传图 1920×1080：右边大赵云，左边标题，标题下面三位神魔将 —— */
  function wide() {
    const W = 1920, H = 1080, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high';
    heroOn(g, W, H, 800, -70, 1220, { l: 0.3, t: 0.06, b: 0.08 });
    shade(g, W, H, [[0, 'rgba(8,12,34,.6)'], [0.42, 'rgba(8,12,34,.3)'], [0.6, 'rgba(8,12,34,0)']], 0, 0, W, 0);
    shade(g, W, H, [[0, 'rgba(4,5,14,0)'], [0.7, 'rgba(4,5,14,0)'], [1, 'rgba(4,5,14,.78)']], 0, 0, 0, H);
    g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(470, 900, 40, 470, 900, 620); gr.addColorStop(0, 'rgba(255,130,50,.30)'); gr.addColorStop(1, 'rgba(255,90,20,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore();
    person(g, 'god_guanyu', 190, 1040, 470, 'rgba(255,215,90,.95)'); person(g, 'god_zhenji', 760, 1050, 440, 'rgba(170,110,255,.95)', true); person(g, 'god_lvbu', 475, 1070, 540, 'rgba(210,90,255,.95)');
    embers(g, W, H, 70);
    title(g, 56, 345, 940, 'left', 200);
    return cv;
  }
  /* —— 方图 1440×1440：赵云铺满，标题压在下面 —— */
  function square() {
    const W = 1440, H = 1440, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high';
    g.drawImage(hero, 0, -70, W, W);
    shade(g, W, H, [[0, 'rgba(4,5,14,0)'], [0.6, 'rgba(4,5,14,0)'], [0.8, 'rgba(4,5,14,.7)'], [1, 'rgba(4,5,14,.95)']], 0, 0, 0, H);
    embers(g, W, H, 80);
    title(g, W / 2, 1330, 1300, 'center', 240);
    return cv;
  }
  /* —— 竖版封面 900×1350：赵云居中裁开，标题在下面 —— */
  function tall() {
    const W = 900, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high';
    g.save(); g.filter = 'blur(40px) brightness(.6)'; g.drawImage(hero, -330, -100, 1560, 1560); g.restore();
    heroOn2(g, -130, 20, 1160);
    shade(g, W, H, [[0, 'rgba(4,5,14,.35)'], [0.12, 'rgba(4,5,14,0)'], [0.66, 'rgba(4,5,14,0)'], [0.84, 'rgba(4,5,14,.78)'], [1, 'rgba(4,5,14,.96)']], 0, 0, 0, H);
    embers(g, W, H, 70);
    title(g, W / 2, 1250, 820, 'center', 200);
    return cv;
  }
  function heroOn2(g, x, y, size) { const cv = document.createElement('canvas'); cv.width = cv.height = size; const c = cv.getContext('2d'); c.imageSmoothingQuality = 'high'; c.drawImage(hero, 0, 0, size, size); c.globalCompositeOperation = 'destination-out'; let gr = c.createLinearGradient(0, 0, 0, size * 0.08); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(0, 0, size, size * 0.08); gr = c.createLinearGradient(0, size, 0, size * 0.86); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(0, size * 0.86, size, size * 0.14); g.drawImage(cv, x, y); }
  /* —— 横版封面 920×430：很扁，单独排——右边赵云的脸和枪，左边标题 —— */
  function banner() {
    const W = 920, H = 430, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high';
    heroOn(g, W, H, 330, -150, 680, { l: 0.3 });
    shade(g, W, H, [[0, 'rgba(6,8,20,.6)'], [0.45, 'rgba(6,8,20,.15)'], [0.62, 'rgba(6,8,20,0)']], 0, 0, W, 0);
    shade(g, W, H, [[0, 'rgba(4,5,14,0)'], [0.7, 'rgba(4,5,14,0)'], [1, 'rgba(4,5,14,.6)']], 0, 0, 0, H);
    embers(g, W, H, 40);
    title(g, 28, 250, 470, 'left', 120);
    return cv;
  }
  const jpg = cv => cv.toDataURL('image/jpeg', 0.93);
  return { '宣传图_16比9_1920x1080.jpg': jpg(wide()), '宣传图_1比1_1440x1440.jpg': jpg(square()), '竖版封面_900x1350.jpg': jpg(tall()), '横版封面_920x430.jpg': jpg(banner()) };
};

(async () => {
  const port = 9300 + Math.floor(Math.random() * 500), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'promo-'));
  const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + port, '--user-data-dir=' + dir, URL0], { stdio: 'ignore' });
  let ws = null;
  for (let i = 0; i < 50 && !ws; i++) { await new Promise(r => setTimeout(r, 200)); try { const l = await (await fetch('http://127.0.0.1:' + port + '/json')).json(); const pg = l.find(t => t.type === 'page'); if (pg) ws = pg.webSocketDebuggerUrl; } catch (e) { } }
  if (!ws) throw new Error('Chrome 没起来');
  const sock = new WebSocket(ws); await new Promise(r => sock.addEventListener('open', r));
  let id = 0; const wait = {};
  sock.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && wait[m.id]) { wait[m.id](m); delete wait[m.id]; } });
  const send = (method, params) => new Promise(r => { const i = ++id; wait[i] = r; sock.send(JSON.stringify({ id: i, method, params })); });
  await new Promise(r => setTimeout(r, 3500));
  const r = await send('Runtime.evaluate', { expression: '(' + PAGE.toString() + ')()', awaitPromise: true, returnByValue: true });
  if (r.result.exceptionDetails) { console.error(JSON.stringify(r.result.exceptionDetails).slice(0, 600)); sock.close(); ch.kill(); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });
  const v = r.result.result.value;
  for (const f in v) { const p = path.join(OUT, f); fs.writeFileSync(p, Buffer.from(v[f].split(',')[1], 'base64')); console.log(p, (fs.statSync(p).size / 1024).toFixed(0) + ' KB'); }
  sock.close(); ch.kill();
})().catch(e => { console.error(e); process.exit(1); });
