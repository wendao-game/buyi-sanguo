// 用本机 Chrome（无界面）切九宫格拼图：这台电脑没有 Python 时代替 slice_sheets.py。
// 做法和 slice_sheets.py 一样，四种拼图都能切（看名字开头）：
//   hero_N / enemy_N  立绘：从格子边线往里抠白底（只抠和边缘连通的，人物身上的白色不动）→ 每格只留最大的一块 →
//                     裁到人物外框 → 缩到 320×320 里高 256、脚底在 y=275 → assets/heroes|enemies/<id>.webp
//                     身后那种没有描边的淡雾、虚影（白底上画的半透明气）会还原成半透明，定大小时不算它
//   head_N            头像：抠底 → 裁外框 → 补成正方形（横向居中、头顶对齐）→ 256×256 → assets/heroes/<id>_head.webp
//   fx_N              特效（黑底）：贴着亮的部分裁、留一点边 → 最长边 512 → assets/fx/<id>.jpg
// 用法：node tools/slice_chrome.js hero_13 head_13 enemy_22 fx_8 …（不写就切「心魔」那几张 enemy_11 以后的）
// 拼图放 assets/_sheets/<名字>.png / .webp；每格是谁从 slice_sheets.py 的 SHEETS_ORDER / FX_SHEETS 读（head_N 和 hero_N 同一个顺序）。
// 最后把新文件补进 assets/manifest.js，并重算素材版本号。
const fs = require('fs'), path = require('path'), os = require('os'), { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..'), SHEETS = path.join(ROOT, 'assets', '_sheets');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const py = fs.readFileSync(path.join(__dirname, 'slice_sheets.py'), 'utf8'), ORDER = {};
const idsOf = t => t.split(',').map(s => s.trim().replace(/'/g, '')).filter(s => s !== '').map(s => (s === 'None' ? null : s));
for (const m of py.matchAll(/'((?:hero|enemy)_\d+)': \('(\w+)', \[([^\]]*)\]\)/g)) {
  ORDER[m[1]] = { folder: m[2], ids: idsOf(m[3]), mode: 'body' };
  if (m[1].startsWith('hero_')) ORDER['head_' + m[1].slice(5)] = { folder: 'heroes', ids: idsOf(m[3]), mode: 'head' };
}
for (const m of py.matchAll(/'(fx_\d+)': \[([^\]]*)\]/g)) ORDER[m[1]] = { folder: 'fx', ids: idsOf(m[2]), mode: 'fx' };
// 个别格子的特殊处理。fadeTop：顶上这一截渐渐淡掉（蛇头的脖子是齐口切断的，要和身后一节节的蛇身接上）
const OPT = { god_zhenji_snake: { fadeTop: 0.2 } };
let names = process.argv.slice(2);
if (!names.length) names = Object.keys(ORDER).filter(n => n.startsWith('enemy_') && Number(n.slice(6)) >= 11);
const jobs = names.map(n => { const f = ['.png', '.webp'].map(e => path.join(SHEETS, n + e)).find(p => fs.existsSync(p)); return f && ORDER[n] ? { n, f, ...ORDER[n] } : null; }).filter(Boolean);
if (!jobs.length) { console.log('没有要切的拼图'); process.exit(0); }

// 在页面里跑的切图代码
const PAGE = function (src, ids, mode, OPT) {
  return new Promise(res => {
    const im = new Image();
    im.onload = () => {
      const w = im.width, h = im.height, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const c = cv.getContext('2d'); c.drawImage(im, 0, 0);
      const out = {}, cellOf = i => { const col = i % 3, row = (i / 3) | 0; return [Math.floor(col * w / 3), Math.floor(row * h / 3), Math.floor(w / 3), Math.floor(h / 3)]; };
      if (mode === 'fx') {                                     // 黑底特效：不抠图，贴着亮的部分裁
        ids.forEach((id, i) => {
          if (!id) return;
          const [x0, y0, cw, ch] = cellOf(i), q = c.getImageData(x0, y0, cw, ch).data;
          let bx0 = cw, by0 = ch, bx1 = -1, by1 = -1;
          for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { const o = (y * cw + x) * 4; if (q[o] * 0.3 + q[o + 1] * 0.59 + q[o + 2] * 0.11 > 18) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; } }
          if (bx1 < 0) return;
          const m = Math.max(4, Math.floor((bx1 - bx0) / 25)); bx0 = Math.max(0, bx0 - m); by0 = Math.max(0, by0 - m); bx1 = Math.min(cw - 1, bx1 + m); by1 = Math.min(ch - 1, by1 + m);
          const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1, k = Math.min(1, 512 / Math.max(bw, bh)), o = document.createElement('canvas'); o.width = Math.round(bw * k); o.height = Math.round(bh * k);
          const oc = o.getContext('2d'); oc.fillStyle = '#000'; oc.fillRect(0, 0, o.width, o.height); oc.imageSmoothingQuality = 'high'; oc.drawImage(cv, x0 + bx0, y0 + by0, bw, bh, 0, 0, o.width, o.height);
          out[id] = o.toDataURL('image/jpeg', 0.93);
        });
        return res(out);
      }
      const d = c.getImageData(0, 0, w, h), p = d.data;
      let opaque = true; for (let i = 3; i < p.length; i += 4 * 97) if (p[i] < 250) { opaque = false; break; }
      const solid = new Uint8Array(w * h).fill(1);             // 1 = 实心的人物；0 = 底色或者还原出来的淡雾（定大小时不算）
      if (opaque) {                                            // 白底：从格子边线、外框往里抠
        const TOL = 34, seen = new Uint8Array(w * h), st = [];
        const push = (x, y) => { if (x < 0 || y < 0 || x >= w || y >= h) return; const k = y * w + x; if (seen[k]) return; const o = k * 4; if (255 - p[o] > TOL || 255 - p[o + 1] > TOL || 255 - p[o + 2] > TOL) return; seen[k] = 1; st.push(k); };
        for (let g = 0; g < 4; g++) for (let t = 0; t < Math.max(w, h); t += 3) { push(Math.min(w - 1, Math.floor(g * w / 3)), t); push(t, Math.min(h - 1, Math.floor(g * h / 3))); }
        const bg = [];
        while (st.length) { const k = st.pop(), x = k % w, y = (k / w) | 0; p[k * 4 + 3] = 0; solid[k] = 0; bg.push(k); push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1); }
        // 淡雾、虚影：挨着底色、颜色很浅、没有黑描边的那些——是白底上画的半透明气。接着往里走一遍，把「白」还原成透明度
        //（颜色越接近白越透明），遇到深色（描边）就停，所以有描边的白袍、白披风不会被碰到
        const HAZE = 150, seen2 = new Uint8Array(w * h), st2 = [];
        const push2 = (x, y) => { if (x < 0 || y < 0 || x >= w || y >= h) return; const k = y * w + x; if (seen[k] || seen2[k]) return; const o = k * 4; if (Math.min(p[o], p[o + 1], p[o + 2]) < HAZE) return; seen2[k] = 1; st2.push(k); };
        for (const k of bg) { const x = k % w, y = (k / w) | 0; push2(x + 1, y); push2(x - 1, y); push2(x, y + 1); push2(x, y - 1); }
        while (st2.length) {
          const k = st2.pop(), x = k % w, y = (k / w) | 0, o = k * 4, a = 1 - Math.min(p[o], p[o + 1], p[o + 2]) / 255;
          if (a < 0.03) p[o + 3] = 0; else { for (let j = 0; j < 3; j++) p[o + j] = Math.max(0, Math.min(255, Math.round((p[o + j] - 255 * (1 - a)) / a))); p[o + 3] = Math.round(255 * Math.min(1, a * 1.15)); }
          solid[k] = 0; push2(x + 1, y); push2(x - 1, y); push2(x, y + 1); push2(x, y - 1);
        }
      } else for (let i = 0; i < w * h; i++) { if (p[i * 4 + 3] < 16) p[i * 4 + 3] = 0; if (p[i * 4 + 3] < 140) solid[i] = 0; }
      c.putImageData(d, 0, 0);
      ids.forEach((id, i) => {
        if (!id) return;
        const [x0, y0, cw, ch] = cellOf(i), opt = OPT[id] || {};
        const cd = c.getImageData(x0, y0, cw, ch), q = cd.data, A = (x, y) => q[(y * cw + x) * 4 + 3] > 24 && solid[(y0 + y) * w + x0 + x];
        // 只留最大的一段（按行、按列各一次）：伸进来的邻格兵器尖、噪点清掉
        for (const axis of [0, 1]) {
          const n = axis ? cw : ch, m = axis ? ch : cw, cnt = [];
          for (let a = 0; a < n; a++) { let s = 0; for (let b = 0; b < m; b++) if (q[((axis ? b : a) * cw + (axis ? a : b)) * 4 + 3] > 24) s++; cnt.push(s); }
          const runs = []; let s0 = -1;
          for (let a = 0; a <= n; a++) { const v = a < n ? cnt[a] : 0; if (v && s0 < 0) s0 = a; else if (!v && s0 >= 0) { runs.push([cnt.slice(s0, a).reduce((u, v2) => u + v2, 0), s0, a]); s0 = -1; } }
          if (runs.length > 1) { runs.sort((r1, r2) => r2[0] - r1[0]); const [, a0, a1] = runs[0]; for (let a = 0; a < n; a++) if (a < a0 || a >= a1) for (let b = 0; b < m; b++) q[((axis ? b : a) * cw + (axis ? a : b)) * 4 + 3] = 0; }
        }
        let bx0 = cw, by0 = ch, bx1 = -1, by1 = -1;           // 外框只按实心的部分量
        for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (A(x, y)) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
        if (bx1 < 0) return;
        const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1;
        if (opt.fadeTop) { const n = Math.round(bh * opt.fadeTop); for (let y = 0; y < by0 + n; y++) { const f = y < by0 ? 0 : Math.pow((y - by0) / n, 1.4); for (let x = 0; x < cw; x++) q[(y * cw + x) * 4 + 3] = Math.round(q[(y * cw + x) * 4 + 3] * f); } }
        const tmp = document.createElement('canvas'); tmp.width = cw; tmp.height = ch; tmp.getContext('2d').putImageData(cd, 0, 0);
        const o = document.createElement('canvas'), oc = o.getContext('2d');
        if (mode === 'head') {                                 // 头像：补成正方形，横向居中、头顶对齐
          const sz = Math.max(bw, bh), k = 256 / sz; o.width = o.height = 256; oc.imageSmoothingQuality = 'high';
          oc.drawImage(tmp, bx0, by0, bw, bh, Math.round((sz - bw) / 2 * k), 0, Math.round(bw * k), Math.round(bh * k));
        } else {                                               // 立绘：高 256、脚底在 y=275；外框以外的淡雾照样画上（出了 320 的就裁掉）
          const k = Math.min(256 / bh, 320 / bw), dx = Math.floor((320 - bw * k) / 2) - bx0 * k, dy = 275 - bh * k - by0 * k; o.width = o.height = 320; oc.imageSmoothingQuality = 'high';
          oc.drawImage(tmp, 0, 0, cw, ch, dx, dy, cw * k, ch * k);
        }
        out[id + (mode === 'head' ? '_head' : '')] = o.toDataURL('image/webp', 0.9);
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
    const r = await send('Runtime.evaluate', { expression: '(' + PAGE.toString() + ')(' + JSON.stringify('data:' + mime + ';base64,' + b64) + ',' + JSON.stringify(j.ids) + ',' + JSON.stringify(j.mode) + ',' + JSON.stringify(OPT) + ')', awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) { console.log(j.n, '出错', JSON.stringify(r.result.exceptionDetails).slice(0, 300)); continue; }
    const out = r.result.result.value; let n = 0;
    for (const cid in out) {
      const ext = j.mode === 'fx' ? '.jpg' : '.webp';
      const file = path.join(ROOT, 'assets', j.folder, cid + ext); fs.writeFileSync(file, Buffer.from(out[cid].split(',')[1], 'base64')); n++;
      for (const e2 of ['.png', '.jpg', '.webp']) if (e2 !== ext && fs.existsSync(path.join(ROOT, 'assets', j.folder, cid + e2))) console.log('  注意：同名的 ' + e2 + ' 也在：' + cid + e2);
      const key = "'" + j.folder + '/' + cid + ext + "'"; if (!mtxt.includes(key)) added.push(key);
    }
    console.log(j.n, '切出', n, '张');
  }
  if (added.length) {                                         // 补进素材清单（按字母排好）
    const m = mtxt.match(/window\.ASSET_LIST = \[([\s\S]*?)\];/), list = m[1].split('\n').map(s => s.trim().replace(/,$/, '')).filter(Boolean).concat(added).sort();
    mtxt = mtxt.replace(m[0], 'window.ASSET_LIST = [\n' + [...new Set(list)].map(s => '  ' + s + ',').join('\n') + '\n];');
    console.log('素材清单补了', added.length, '个');
  }
  if (added.length) fs.writeFileSync(man, mtxt);
  { const r = require('./mk_manifest.js').build(); console.log('素材清单', r.n, '个文件，版本号', r.ver); }   // 清单整个重写一遍：整体版本号 + 每个文件各自的版本号
  sock.close(); ch.kill();
})().catch(e => { console.error(e); process.exit(1); });
