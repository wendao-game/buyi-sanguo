// 用游戏里的素材拼商店要的两张图（本机 Chrome 无界面跑，要先开着本地预览 http://localhost:8790/，用它的字体和图片）：
//   宣传图 1920×1080（商店必填，TapTap 签到活动的头图也用它）、竖版封面 900×1350（Windows 素材里的「竖版游戏封面图」，不低于 600×900）
// 用法：node tools/mk_promo.js <输出目录> [预览地址=http://localhost:8790/]
// 人物从九宫格拼图里按原始分辨率抠（assets/_sheets/enemy_8 是神魔的正面图，enemy_11 … 是心魔的正面全身图），不是用游戏里缩小过的图。
const fs = require('fs'), path = require('path'), os = require('os'), { spawn } = require('child_process');
const OUT = process.argv[2], URL0 = process.argv[3] || 'http://localhost:8790/';
if (!OUT) { console.log('用法：node tools/mk_promo.js <输出目录> [预览地址]'); process.exit(1); }
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));

const PAGE = async function () {
  await document.fonts.ready;
  await Promise.all([document.fonts.load('bold 100px SGBrush', '烽火守城'), document.fonts.load('bold 40px SGRound', '三国塔防排兵布阵凑缘分战心魔百余名将八章十关过斩'), document.fonts.load('bold 40px SGNum', '80')]);
  const img = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('加载失败 ' + src)); im.src = src; });
  /* 从九宫格里抠一个人：白底的从格子边缘往里抠，再裁到人物外框 */
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
      while (st.length) { const k = st.pop(), x = k % w, y = (k / w) | 0; p[k * 4 + 3] = 0; push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1); }
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const k = y * w + x, o = k * 4; if (!p[o + 3]) continue; if (seen[k - 1] || seen[k + 1] || seen[k - w] || seen[k + w]) { const lum = (p[o] + p[o + 1] + p[o + 2]) / 3; if (lum > 150) p[o + 3] = Math.round(p[o + 3] * Math.max(0, (255 - lum) / 105)); } }
      c.putImageData(d, 0, 0);
    }
    return (sheetCache[src] = cv);
  }
  async function cell(src, i) {
    const cv = await sheet(src), w = cv.width, h = cv.height, cw = Math.floor(w / 3), ch = Math.floor(h / 3), x0 = (i % 3) * cw, y0 = Math.floor(i / 3) * ch;
    const d = cv.getContext('2d').getImageData(x0, y0, cw, ch).data; let bx0 = cw, by0 = ch, bx1 = -1, by1 = -1;
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (d[(y * cw + x) * 4 + 3] > 24) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
    const o = document.createElement('canvas'); o.width = bx1 - bx0 + 1; o.height = by1 - by0 + 1; o.getContext('2d').drawImage(cv, x0 + bx0, y0 + by0, o.width, o.height, 0, 0, o.width, o.height);
    return o;
  }
  const S = '/assets/_sheets/';
  const WHO = {                                             // 哪张拼图的第几格（从 0 数）
    god_lvbu: [S + 'enemy_8.png', 0], god_guanyu: [S + 'enemy_8.png', 2], god_zhuge: [S + 'enemy_8.png', 3],
    zhugeliang: [S + 'enemy_11.webp', 0], caocao: [S + 'enemy_11.webp', 2], guanyu: [S + 'enemy_11.webp', 4], zhangfei: [S + 'enemy_11.webp', 5], zhaoyun: [S + 'enemy_11.webp', 7],
    liubei: [S + 'enemy_14.webp', 4], machao: [S + 'enemy_14.webp', 6], sunshangxiang: [S + 'enemy_14.webp', 7], diaochan: [S + 'enemy_14.webp', 8], xiaoqiao: [S + 'enemy_15.webp', 3],
  };
  const P = {}; for (const k in WHO) P[k] = await cell(WHO[k][0], WHO[k][1]);
  const bg = await img('/assets/bg/battle.jpg');
  let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  function person(g, k, cx, footY, h, glow) {
    const im = P[k], w = h * im.width / im.height;
    g.save(); g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(cx, footY - h * 0.02, w * 0.36, h * 0.07, 0, 0, 7); g.fill();
    g.shadowColor = glow || 'rgba(255,170,70,.85)'; g.shadowBlur = h * 0.09; g.drawImage(im, cx - w / 2, footY - h, w, h);
    g.shadowBlur = 0; g.drawImage(im, cx - w / 2, footY - h, w, h); g.restore();
  }
  function title(g, x, y, size, align) {
    g.save(); g.font = 'bold ' + size + 'px SGBrush, SGRound, "Microsoft YaHei", sans-serif'; g.textAlign = align || 'left'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
    const txt = '烽火守城', w = g.measureText(txt).width, x0 = align === 'center' ? x - w / 2 : x;
    g.shadowColor = 'rgba(255,110,30,.9)'; g.shadowBlur = size * 0.28; g.lineWidth = size * 0.16; g.strokeStyle = '#2a0a04'; g.strokeText(txt, x, y);
    g.shadowBlur = 0; g.lineWidth = size * 0.11; g.strokeStyle = '#5a1206'; g.strokeText(txt, x, y);
    const gr = g.createLinearGradient(0, y - size * 0.85, 0, y + size * 0.1); gr.addColorStop(0, '#fff6c8'); gr.addColorStop(0.45, '#ffd24a'); gr.addColorStop(1, '#ff8a1e'); g.fillStyle = gr; g.fillText(txt, x, y);
    g.restore(); return { x0, w };
  }
  function tag(g, cx, y, txt, size) {                       // 「三国塔防」红底小牌
    g.save(); g.font = 'bold ' + size + 'px SGRound, "Microsoft YaHei", sans-serif'; const w = g.measureText(txt).width + size * 1.5 + size * 0.5 * (txt.length - 1), h = size * 1.7, x = cx - w / 2;
    const rr = (x1, y1, w1, h1, r) => { g.beginPath(); g.moveTo(x1 + r, y1); g.arcTo(x1 + w1, y1, x1 + w1, y1 + h1, r); g.arcTo(x1 + w1, y1 + h1, x1, y1 + h1, r); g.arcTo(x1, y1 + h1, x1, y1, r); g.arcTo(x1, y1, x1 + w1, y1, r); g.closePath(); };
    g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 12; rr(x, y, w, h, h * 0.22); const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#d0322a'); gr.addColorStop(1, '#8e1712'); g.fillStyle = gr; g.fill();
    g.shadowBlur = 0; g.lineWidth = Math.max(2, size * 0.07); g.strokeStyle = '#ffd76a'; g.stroke();
    g.fillStyle = '#fff0c8'; g.textBaseline = 'middle'; g.textAlign = 'center';
    const step = (w - size * 1.5) / txt.length + 0; let px = x + size * 0.75 + step / 2; for (const ch of txt) { g.fillText(ch, px, y + h / 2 + size * 0.04); px += step; }
    g.restore();
  }
  function line(g, cx, y, txt, size, color) {
    g.save(); g.font = 'bold ' + size + 'px SGRound, "Microsoft YaHei", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = size * 0.22; g.strokeStyle = 'rgba(20,8,4,.92)'; g.strokeText(txt, cx, y); g.fillStyle = color || '#ffe9c0'; g.fillText(txt, cx, y); g.restore();
  }
  function embers(g, W, H, n) {
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) { const x = rnd() * W, y = rnd() * H, r = 1.5 + rnd() * 4.5, gr = g.createRadialGradient(x, y, 0, x, y, r * 4); gr.addColorStop(0, 'rgba(255,200,110,' + (0.35 + rnd() * 0.5) + ')'); gr.addColorStop(1, 'rgba(255,120,30,0)'); g.fillStyle = gr; g.fillRect(x - r * 4, y - r * 4, r * 8, r * 8); }
    g.restore();
  }

  /* —— 宣传图 1920×1080：左边标题，右边一群名将站在城外 —— */
  function wide(text) {
    const W = 1920, H = 1080, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high';
    const k = W / bg.width, sy = 1650 / k;                    // 背景是竖图：横着铺满宽度，取城外战场到城墙垛口这一截
    g.drawImage(bg, 0, sy, bg.width, H / k, 0, 0, W, H);
    let gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, 'rgba(14,6,3,.94)'); gr.addColorStop(0.36, 'rgba(14,6,3,.70)'); gr.addColorStop(0.62, 'rgba(14,6,3,.12)'); gr.addColorStop(1, 'rgba(14,6,3,.22)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(10,4,2,.6)'); gr.addColorStop(0.3, 'rgba(10,4,2,0)'); gr.addColorStop(0.78, 'rgba(10,4,2,0)'); gr.addColorStop(1, 'rgba(10,4,2,.72)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.save(); g.globalCompositeOperation = 'lighter'; gr = g.createRadialGradient(1320, 560, 60, 1320, 560, 760); gr.addColorStop(0, 'rgba(255,150,60,.34)'); gr.addColorStop(1, 'rgba(255,90,20,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore();
    // 后排、前排（先画远的）
    person(g, 'god_lvbu', 1070, 610, 380, 'rgba(190,90,255,.9)'); person(g, 'god_guanyu', 1440, 600, 420, 'rgba(255,215,90,.95)'); person(g, 'god_zhuge', 1790, 640, 360, 'rgba(120,220,255,.9)');
    person(g, 'zhangfei', 990, 890, 340); person(g, 'zhaoyun', 1230, 940, 380); person(g, 'caocao', 1470, 960, 400); person(g, 'sunshangxiang', 1715, 900, 330);   // 普通关羽不放：和神·关羽重复
    person(g, 'liubei', 1100, 1050, 300); person(g, 'xiaoqiao', 1775, 1052, 290, 'rgba(255,150,200,.9)');
    embers(g, W, H, 90);
    if (text === false) return cv;
    const t = title(g, 90, 430, 200, 'left'), cx = t.x0 + t.w / 2;
    tag(g, cx, 492, '三国塔防', 46);
    line(g, cx, 668, '排兵布阵 · 凑缘分 · 战心魔', 44, '#ffe9c0');
    line(g, cx, 744, '百余名将 · 八章八十关 · 过关斩将', 34, '#e8c890');
    return cv;
  }
  /* —— 竖版封面 900×1350：上面标题，下面名将 —— */
  function tall(text) {
    const W = 900, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high';
    const k = H / 1500;                                       // 背景取上面 1500 像素高的一截（城外战场 + 城墙），铺满
    g.drawImage(bg, (bg.width - W / k) / 2, 330, W / k, 1500, 0, 0, W, H);
    let gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(12,5,3,.92)'); gr.addColorStop(0.3, 'rgba(12,5,3,.5)'); gr.addColorStop(0.5, 'rgba(12,5,3,.08)'); gr.addColorStop(0.86, 'rgba(12,5,3,.15)'); gr.addColorStop(1, 'rgba(12,5,3,.8)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.save(); g.globalCompositeOperation = 'lighter'; gr = g.createRadialGradient(450, 880, 40, 450, 880, 560); gr.addColorStop(0, 'rgba(255,150,60,.36)'); gr.addColorStop(1, 'rgba(255,90,20,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore();
    person(g, 'god_lvbu', 200, 800, 330, 'rgba(190,90,255,.9)'); person(g, 'god_guanyu', 450, 770, 370, 'rgba(255,215,90,.95)'); person(g, 'god_zhuge', 705, 800, 320, 'rgba(120,220,255,.9)');
    person(g, 'zhangfei', 165, 1040, 300); person(g, 'sunshangxiang', 760, 1040, 290); person(g, 'zhaoyun', 320, 1100, 330); person(g, 'caocao', 590, 1110, 340);
    person(g, 'xiaoqiao', 450, 1250, 300, 'rgba(255,150,200,.9)'); person(g, 'liubei', 150, 1270, 270); person(g, 'diaochan', 760, 1270, 270, 'rgba(255,150,200,.9)');
    embers(g, W, H, 70);
    if (text === false) return cv;
    title(g, W / 2, 250, 190, 'center'); tag(g, W / 2, 300, '三国塔防', 44);
    line(g, W / 2, 432, '排兵布阵 · 凑缘分 · 战心魔', 36, '#ffe9c0');
    return cv;
  }
  /* —— 方图 1440×1440（商店「宣传图（1:1）」）—— */
  function square() {
    const W = 1440, H = 1440, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high';
    g.drawImage(bg, 0, 420, bg.width, bg.width, 0, 0, W, H);   // 背景取中间一块正方形：城外战场 + 城墙
    let gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(12,5,3,.94)'); gr.addColorStop(0.3, 'rgba(12,5,3,.55)'); gr.addColorStop(0.5, 'rgba(12,5,3,.1)'); gr.addColorStop(0.86, 'rgba(12,5,3,.15)'); gr.addColorStop(1, 'rgba(12,5,3,.8)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.save(); g.globalCompositeOperation = 'lighter'; gr = g.createRadialGradient(720, 960, 50, 720, 960, 760); gr.addColorStop(0, 'rgba(255,150,60,.36)'); gr.addColorStop(1, 'rgba(255,90,20,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore();
    person(g, 'god_lvbu', 300, 930, 370, 'rgba(190,90,255,.9)'); person(g, 'god_guanyu', 720, 905, 400, 'rgba(255,215,90,.95)'); person(g, 'god_zhuge', 1140, 930, 355, 'rgba(120,220,255,.9)');
    person(g, 'zhangfei', 190, 1180, 360); person(g, 'sunshangxiang', 1250, 1180, 345); person(g, 'zhaoyun', 500, 1215, 385); person(g, 'caocao', 950, 1225, 395);
    person(g, 'liubei', 250, 1405, 330); person(g, 'diaochan', 1195, 1405, 330, 'rgba(255,150,200,.9)'); person(g, 'xiaoqiao', 720, 1410, 350, 'rgba(255,150,200,.9)');
    embers(g, W, H, 90);
    title(g, W / 2, 280, 240, 'center'); tag(g, W / 2, 330, '三国塔防', 52);
    line(g, W / 2, 470, '排兵布阵 · 凑缘分 · 战心魔', 44, '#ffe9c0');
    return cv;
  }
  /* 从一张图里裁一块、缩到指定大小 */
  function crop(src, sx, sy, sw, sh, w, h) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, sx, sy, sw, sh, 0, 0, w, h); return cv; }
  /* 透明底的标题 Logo 1280×720（Windows 素材里的「游戏 Logo」，选填） */
  function logo() { const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 720; const g = cv.getContext('2d'); title(g, 640, 400, 250, 'center'); tag(g, 640, 460, '三国塔防', 56); return cv; }
  const jpg = cv => cv.toDataURL('image/jpeg', 0.93), w0 = wide(), t0 = tall();
  return {
    '烽火守城-宣传图-1920x1080.jpg': jpg(w0), '烽火守城-宣传图-方图-1440x1440.jpg': jpg(square()),
    'Windows-竖版封面-900x1350.jpg': jpg(t0), 'Windows-横版封面-920x430.jpg': jpg(crop(w0, 0, 150, 1920, 897, 920, 430)),
    'Windows-无Logo横版宣传图-1920x1080.jpg': jpg(wide(false)), 'Windows-无Logo竖版宣传图-900x1350.jpg': jpg(tall(false)), 'Windows-游戏Logo-透明-1280x720.png': logo().toDataURL('image/png'),
  };
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
