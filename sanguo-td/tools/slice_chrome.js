// 用本机 Chrome（无界面）切九宫格拼图：这台电脑没有 Python 时代替 slice_sheets.py 里「敌人」拼图那一段。
// 做法和 slice_sheets.py 一样：从格子边线往里抠白底（只抠和边缘连通的，人物身上的白色不动）→ 每格只留最大的一块 →
// 裁到人物外框 → 缩到 320×320 里高 256、脚底在 y=275 → 存成带透明的 webp（体积和 256 色 png 差不多）。
// 用法：node tools/slice_chrome.js enemy_11 enemy_12 …（不写就切 slice_sheets.py 里所有有拼图的「心魔」那几张）
// 拼图放 assets/_sheets/<名字>.png / .webp；对应的武将 id 从 slice_sheets.py 的 SHEETS_ORDER 读。最后把新文件补进 assets/manifest.js。
const fs = require('fs'), path = require('path'), os = require('os'), { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..'), SHEETS = path.join(ROOT, 'assets', '_sheets');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const py = fs.readFileSync(path.join(__dirname, 'slice_sheets.py'), 'utf8'), ORDER = {};
for (const m of py.matchAll(/'(enemy_\d+)': \('(\w+)', \[([^\]]*)\]\)/g)) ORDER[m[1]] = { folder: m[2], ids: m[3].split(',').map(s => s.trim().replace(/'/g, '')).map(s => (s === 'None' ? null : s)) };
let names = process.argv.slice(2);
if (!names.length) names = Object.keys(ORDER).filter(n => Number(n.slice(6)) >= 11);
const jobs = names.map(n => { const f = ['.png', '.webp'].map(e => path.join(SHEETS, n + e)).find(p => fs.existsSync(p)); return f && ORDER[n] ? { n, f, ...ORDER[n] } : null; }).filter(Boolean);
if (!jobs.length) { console.log('没有要切的拼图'); process.exit(0); }

// 在页面里跑的切图代码
const PAGE = function (src, ids) {
  return new Promise(res => {
    const im = new Image();
    im.onload = () => {
      const w = im.width, h = im.height, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const c = cv.getContext('2d'); c.drawImage(im, 0, 0);
      const d = c.getImageData(0, 0, w, h), p = d.data;
      let opaque = true; for (let i = 3; i < p.length; i += 4 * 97) if (p[i] < 250) { opaque = false; break; }
      if (opaque) {                                            // 白底：从格子边线、外框往里抠
        const TOL = 34, seen = new Uint8Array(w * h), st = [];
        const push = (x, y) => { if (x < 0 || y < 0 || x >= w || y >= h) return; const k = y * w + x; if (seen[k]) return; const o = k * 4; if (255 - p[o] > TOL || 255 - p[o + 1] > TOL || 255 - p[o + 2] > TOL) return; seen[k] = 1; st.push(k); };
        for (let g = 0; g < 4; g++) for (let t = 0; t < Math.max(w, h); t += 3) { push(Math.min(w - 1, Math.floor(g * w / 3)), t); push(t, Math.min(h - 1, Math.floor(g * h / 3))); }
        while (st.length) { const k = st.pop(), x = k % w, y = (k / w) | 0; p[k * 4 + 3] = 0; push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1); }
        // 抠完的边上留着一圈发白的半调子像素：亮的按亮度调低不透明度（黑描边外侧不留白边）
        for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const k = y * w + x, o = k * 4; if (!p[o + 3]) continue; if (seen[k - 1] || seen[k + 1] || seen[k - w] || seen[k + w]) { const lum = (p[o] + p[o + 1] + p[o + 2]) / 3; if (lum > 150) p[o + 3] = Math.round(p[o + 3] * Math.max(0, (255 - lum) / 105)); } }
      } else for (let i = 3; i < p.length; i += 4) if (p[i] < 16) p[i] = 0;
      c.putImageData(d, 0, 0);
      const out = {};
      ids.forEach((id, i) => {
        if (!id) return;
        const col = i % 3, row = (i / 3) | 0, x0 = Math.floor(col * w / 3), y0 = Math.floor(row * h / 3), cw = Math.floor(w / 3), ch = Math.floor(h / 3);
        const cd = c.getImageData(x0, y0, cw, ch), q = cd.data, A = (x, y) => q[(y * cw + x) * 4 + 3] > 24;
        // 只留最大的一段（按行、按列各一次）：伸进来的邻格兵器尖、噪点清掉
        for (const axis of [0, 1]) {
          const n = axis ? cw : ch, m = axis ? ch : cw, cnt = [];
          for (let a = 0; a < n; a++) { let s = 0; for (let b = 0; b < m; b++) if (axis ? A(a, b) : A(b, a)) s++; cnt.push(s); }
          const runs = []; let s0 = -1;
          for (let a = 0; a <= n; a++) { const v = a < n ? cnt[a] : 0; if (v && s0 < 0) s0 = a; else if (!v && s0 >= 0) { runs.push([cnt.slice(s0, a).reduce((u, v2) => u + v2, 0), s0, a]); s0 = -1; } }
          if (runs.length > 1) { runs.sort((r1, r2) => r2[0] - r1[0]); const [, a0, a1] = runs[0]; for (let a = 0; a < n; a++) if (a < a0 || a >= a1) for (let b = 0; b < m; b++) q[((axis ? b : a) * cw + (axis ? a : b)) * 4 + 3] = 0; }
        }
        let bx0 = cw, by0 = ch, bx1 = -1, by1 = -1;
        for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (A(x, y)) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
        if (bx1 < 0) return;
        const tmp = document.createElement('canvas'); tmp.width = cw; tmp.height = ch; tmp.getContext('2d').putImageData(cd, 0, 0);
        const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1, k = Math.min(256 / bh, 320 / bw), tw = Math.max(1, Math.round(bw * k)), th = Math.max(1, Math.round(bh * k));
        const o = document.createElement('canvas'); o.width = o.height = 320; const oc = o.getContext('2d'); oc.imageSmoothingQuality = 'high';
        oc.drawImage(tmp, bx0, by0, bw, bh, Math.floor((320 - tw) / 2), 275 - th, tw, th);
        out[id] = o.toDataURL('image/webp', 0.9);
      });
      res(out);
    };
    im.src = src;
  });
};

(async () => {
  const port = 9300 + Math.floor(Math.random() * 500), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slice-'));
  const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--remote-debugging-port=' + port, '--user-data-dir=' + dir, 'about:blank'], { stdio: 'ignore' });
  let ws = null;
  for (let i = 0; i < 50 && !ws; i++) { await new Promise(r => setTimeout(r, 200)); try { const l = await (await fetch('http://127.0.0.1:' + port + '/json')).json(); const pg = l.find(t => t.type === 'page'); if (pg) ws = pg.webSocketDebuggerUrl; } catch (e) { } }
  if (!ws) throw new Error('Chrome 没起来');
  const sock = new WebSocket(ws); await new Promise(r => sock.addEventListener('open', r));
  let id = 0; const wait = {};
  sock.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && wait[m.id]) { wait[m.id](m); delete wait[m.id]; } });
  const send = (method, params) => new Promise(r => { const i = ++id; wait[i] = r; sock.send(JSON.stringify({ id: i, method, params })); });
  const man = path.join(ROOT, 'assets', 'manifest.js'); let mtxt = fs.readFileSync(man, 'utf8'); const added = [];
  for (const j of jobs) {
    const b64 = fs.readFileSync(j.f).toString('base64'), mime = j.f.endsWith('.webp') ? 'image/webp' : 'image/png';
    const r = await send('Runtime.evaluate', { expression: '(' + PAGE.toString() + ')(' + JSON.stringify('data:' + mime + ';base64,' + b64) + ',' + JSON.stringify(j.ids) + ')', awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) { console.log(j.n, '出错', JSON.stringify(r.result.exceptionDetails).slice(0, 300)); continue; }
    const out = r.result.result.value; let n = 0;
    for (const cid in out) {
      const file = path.join(ROOT, 'assets', j.folder, cid + '.webp'); fs.writeFileSync(file, Buffer.from(out[cid].split(',')[1], 'base64')); n++;
      const png = path.join(ROOT, 'assets', j.folder, cid + '.png'); if (fs.existsSync(png)) console.log('  注意：同名的 png 也在：' + png);
      const key = "'" + j.folder + '/' + cid + ".webp'"; if (!mtxt.includes(key)) added.push(key);
    }
    console.log(j.n, '切出', n, '张');
  }
  if (added.length) {                                         // 补进素材清单（按字母排好）
    const m = mtxt.match(/window\.ASSET_LIST = \[([\s\S]*?)\];/), list = m[1].split('\n').map(s => s.trim().replace(/,$/, '')).filter(Boolean).concat(added).sort();
    mtxt = mtxt.replace(m[0], 'window.ASSET_LIST = [\n' + [...new Set(list)].map(s => '  ' + s + ',').join('\n') + '\n];');
    fs.writeFileSync(man, mtxt); console.log('素材清单补了', added.length, '个');
  }
  sock.close(); ch.kill();
})().catch(e => { console.error(e); process.exit(1); });
