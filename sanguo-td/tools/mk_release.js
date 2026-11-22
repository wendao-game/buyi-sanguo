// 出发布包（v2.25）：把一百五十多个启动请求压到 7 个，进主城前要下的量从约 5.6 MB 压到 2 MB 左右。
// 为什么：TapTap 的 H5 小游戏每次都从 CDN 现取文件；没人取过的文件（冷文件）每个要 0.5～1.8 秒、偶尔卡 10 秒，
//         游戏人少时几乎个个都是冷的；而且每传一个新包地址就变，旧缓存全部作废。原来进主城前要取 15 个脚本 + 138 张图，回回撞 15 秒上限。
// 做法：
//   1. 15 个脚本合成一个 js/app.js。不是简单拼接（各文件的 'use strict' 不一样，拼起来会互相影响）：
//      把每个文件的源码存成字符串，运行时按原来的顺序各自塞进一个 <script> 执行，和分开加载完全等价。
//      给了 terser 就顺手去掉注释和空白（只去注释空白，不压缩、不改名），体积小四成左右。
//   2. 图片按用途打成包 assets/packs/<名字>.bin（原文件首尾相接），每个包里有哪些图、从第几个字节到第几个字节，
//      写在 app.js 里的 window.ASSET_PACKS。运行时 assets.js 下一个包、在手机里拆成一张张图。音效 13 个小文件也打成一个包。
//   3. 页面一打开就同时去取：样式、app.js、三个字体、home 包（index.html 里一小段脚本先把 home 包的请求发出去，不等 app.js）。
//      下过的图包会存在手机里（assets.js 的 store，IndexedDB），内容没变下次就不走网络；home 包存着的话这个请求也不发。
//   4. 单张图片不进发布包（不然体积翻倍）；配音照旧是单个文件（用到才取）。样式里直接引用的四个边角小图内嵌进样式。
// 用法：node tools/mk_release.js <输出目录> [装了 terser 的 node_modules 目录]      → 输出目录里的 fenghuo-td/ 直接打 zip
// 开发时不用跑这个：直接开源码目录（没有 ASSET_PACKS），assets.js 走原来一张张加载的路。
const fs = require('fs'), path = require('path'), crypto = require('crypto'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const OUT = process.argv[2], MODS = process.argv[3];
if (!OUT) { console.error('用法：node tools/mk_release.js <输出目录> [装了 terser 的 node_modules 目录]'); process.exit(1); }
const terser = MODS && fs.existsSync(path.join(MODS, 'terser')) ? require(path.join(MODS, 'terser')) : null;
const DST = path.join(OUT, 'fenghuo-td');
fs.rmSync(DST, { recursive: true, force: true });
const mk = d => fs.mkdirSync(d, { recursive: true });
const cpDir = (a, b) => { mk(b); for (const f of fs.readdirSync(a)) { const s = path.join(a, f), t = path.join(b, f); if (fs.statSync(s).isDirectory()) cpDir(s, t); else fs.copyFileSync(s, t); } };
const md5 = b => crypto.createHash('md5').update(b).digest('hex').slice(0, 8);

(async () => {
  /* ---------- 清单和武将表 ---------- */
  const win = {}; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'assets', 'manifest.js'), 'utf8'), { window: win });
  const LIST = win.ASSET_LIST;
  const dctx = {}; vm.createContext(dctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'data.js'), 'utf8') + '\n;globalThis.__H = HEROES; globalThis.__S = STARTER_HEROES;', dctx);
  const HQ = {}; dctx.__H.forEach(h => { HQ[h.id] = h.q; });
  const STARTER = {}; dctx.__S.forEach(id => { STARTER[id] = 1; });

  /* ---------- 分包 ----------
   * home     进主城前必须到：背景、界面、开局三员武将的立绘和头像（老玩家再加上阵武将立绘所在的那一包）
   * fx、enemies  开战要用：特效、普通敌人。进了主城在后台下，出征时没到齐就等
   * 后台下载的先后见 ORDER：头像 → 兵器图标 → 音效 → 特效、普通敌人 → 立绘 → 心魔（武将形象的敌人）。头像、立绘按品质分三档（白绿蓝 / 紫 / 金橙黑彩）。
   * 玩家点到哪里、那里要的包还没到，会立刻插队去下（assets.js 的 want / need），不受这个先后限制。 */
  const idOf = f => f.replace(/^.*\//, '').replace(/\.\w+$/, '').replace(/_head$/, '');
  const tier = id => (HQ[id] <= 2 ? 1 : HQ[id] === 3 ? 2 : 3);
  function packOf(f) {
    const d = f.slice(0, f.indexOf('/')), id = idOf(f);
    if (d === 'voice') return null;
    if (d === 'sfx') return 'sfx';
    if (d === 'bg' || d === 'ui') return 'home';
    if (d === 'fx') return 'fx';
    if (d === 'heroes') { if (STARTER[id]) return 'home'; if (!(id in HQ)) throw new Error('清单里有不认识的武将图：' + f); return (/_head\./.test(f) ? 'heads_' : 'sprites_') + tier(id); }
    if (d === 'enemies') return id in HQ ? 'demons_' + (id < 'm' ? 1 : 2) : 'enemies';
    if (d === 'weapons') return 'weapons';
    throw new Error('不知道该放进哪个包：' + f);
  }
  const ORDER = ['home', 'heads_1', 'heads_2', 'heads_3', 'weapons', 'sfx', 'fx', 'enemies', 'sprites_1', 'sprites_2', 'sprites_3', 'demons_1', 'demons_2'];   // 也是后台下载的先后：新手引导第一步是去招募（要头像、兵器图标），然后才出征（要特效、敌人、立绘）
  const groups = {}; ORDER.forEach(n => { groups[n] = []; });
  LIST.forEach(f => { const p = packOf(f); if (p) groups[p].push(f); });
  mk(path.join(DST, 'assets', 'packs'));
  const PACKS = [];
  for (const n of ORDER) {
    const files = groups[n].sort(); if (!files.length) continue;
    const bufs = [], items = []; let off = 0;
    for (const f of files) { const b = fs.readFileSync(path.join(ROOT, 'assets', f)); bufs.push(b); items.push([f, off, b.length]); off += b.length; }
    const all = Buffer.concat(bufs);
    fs.writeFileSync(path.join(DST, 'assets', 'packs', n + '.bin'), all);
    const p = { n, f: 'packs/' + n + '.bin', h: md5(all), size: all.length, items };
    if (n === 'home') p.core = true;                         // core：进主城前必须到
    if (n === 'sfx') p.raw = true;                           // raw：不是图片，原样交给 sfx.js
    PACKS.push(p);
    console.log('  ' + n.padEnd(10), String(files.length).padStart(4) + ' 个', (all.length / 1e6).toFixed(2) + ' MB');
  }

  /* ---------- 脚本合一 ---------- */
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const build = (html.match(/var BUILD = '([^']+)'/) || [])[1]; if (!build) throw new Error('index.html 里没找到 BUILD');
  const lm = html.match(/\[('js\/fontload\.js'[\s\S]*?)\]\.forEach/); if (!lm) throw new Error('index.html 里没找到脚本列表');
  const scripts = lm[1].split(',').map(s => s.trim().replace(/'/g, '')).filter(Boolean);
  const manifestSrc = 'window.ASSET_LIST = ' + JSON.stringify(LIST.filter(f => !/^sfx\//.test(f))) + ';\nwindow.ASSET_VER = ' + JSON.stringify(win.ASSET_VER || '') + ';\nwindow.ASSET_PACKS = ' + JSON.stringify(PACKS) + ';\n';
  const srcs = [];
  for (const s of scripts) {
    let code = s === 'assets/manifest.js' ? manifestSrc : fs.readFileSync(path.join(ROOT, s), 'utf8');
    if (terser && s !== 'assets/manifest.js' && !/\.min\.js$/.test(s)) {
      const r = await terser.minify(code, { compress: false, mangle: false, format: { comments: false } });   // 只去注释和空白：不压缩、不改名（各文件之间靠全局名字互相找）
      if (!r.code) throw new Error('terser 没处理成：' + s);
      code = r.code;
    }
    srcs.push([s, code]);
  }
  // </script 出现在字符串里会把 <script> 提前截断（这个文件本身是外链脚本，不受影响，保险起见还是转掉）
  const app = '/* 三国·孤城万仞 ' + build + '：' + scripts.length + ' 个脚本合成的一个文件（tools/mk_release.js 生成，别手改）。每段按原来的顺序各自当一个 <script> 执行。 */\n'
    + '(function () {\n  var L = ' + JSON.stringify(srcs).replace(/<\/script/gi, '<\\/script').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029') + ';\n'
    + '  for (var i = 0; i < L.length; i++) { var s = document.createElement("script"); s.text = L[i][1] + "\\n//# sourceURL=" + L[i][0]; document.body.appendChild(s); }\n})();\n';
  mk(path.join(DST, 'js')); fs.writeFileSync(path.join(DST, 'js', 'app.js'), app);

  /* ---------- 样式：四个边角小图内嵌进去（省 4 个请求）；别的 url() 引用的文件照原样带上 ---------- */
  let css = fs.readFileSync(path.join(ROOT, 'css', 'style.css'), 'utf8');
  const fontUrls = [];
  css = css.replace(/url\((["']?)\.\.\/assets\/([^"')]+)\1\)/g, (m, q, rel) => {
    const file = rel.split('?')[0], src = path.join(ROOT, 'assets', file);
    if (/^fonts\//.test(file)) { fontUrls.push('assets/' + rel); return m; }
    if (fs.statSync(src).size < 20000) return 'url("data:image/' + file.split('.').pop() + ';base64,' + fs.readFileSync(src).toString('base64') + '")';
    mk(path.dirname(path.join(DST, 'assets', file))); fs.copyFileSync(src, path.join(DST, 'assets', file)); return m;   // 大图（宽屏时两边的模糊背景）：单独带上，只有宽屏才会去取
  });
  mk(path.join(DST, 'css')); fs.writeFileSync(path.join(DST, 'css', 'style.css'), css);

  /* ---------- 页面：字体、home 包不等 app.js，页面一打开就去取 ---------- */
  const sm = html.match(/<script>\s*\(function \(\) \{\s*var BUILD[\s\S]*?<\/script>/); if (!sm) throw new Error('index.html 里没找到加载脚本的那一段');
  const home = PACKS.find(p => p.core), homeUrl = 'assets/' + home.f + '?v=' + home.h;
  const early = '\n  <link rel="icon" href="data:,">\n'
    + fontUrls.map(u => '  <link rel="preload" as="font" type="font/woff2" crossorigin href="' + u + '">\n').join('')
    + '  <script>/* home 包先发出去，assets.js 起来以后接手（window.__PRE） */(function () { try { if (localStorage.getItem("sg_pk_' + home.n + '") === "' + home.h + '") return; } catch (e) { } try { var P = window.__PRE = {}, u = "' + homeUrl + '", x = new XMLHttpRequest(); x.open("GET", u); x.responseType = "arraybuffer"; P[u] = { x: x, got: 0 }; x.onprogress = function (e) { P[u].got = e.loaded; }; x.send(); } catch (e) { } })();</script>\n';
  let out = html.replace(sm[0], '<script src="js/app.js?v=' + build + '"></script>');
  const hm = out.match(/<link rel="stylesheet"/); if (!hm) throw new Error('index.html 里没找到样式表的 link');
  out = out.replace(hm[0], early.trimStart().replace(/^/, '') + '  ' + hm[0]);
  fs.writeFileSync(path.join(DST, 'index.html'), out);

  /* ---------- 字体、配音 ---------- */
  mk(path.join(DST, 'assets', 'fonts'));
  for (const f of fs.readdirSync(path.join(ROOT, 'assets', 'fonts'))) if (/\.woff2$/.test(f)) fs.copyFileSync(path.join(ROOT, 'assets', 'fonts', f), path.join(DST, 'assets', 'fonts', f));
  if (fs.existsSync(path.join(ROOT, 'assets', 'voice'))) cpDir(path.join(ROOT, 'assets', 'voice'), path.join(DST, 'assets', 'voice'));

  /* ---------- 汇总 ---------- */
  let n = 0, bytes = 0; (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else { n++; bytes += fs.statSync(p).size; } } })(DST);
  const sz = f => fs.statSync(path.join(DST, f)).size, fonts = fontUrls.reduce((s, u) => s + sz(u.split('?')[0]), 0);
  console.log('BUILD ' + build + '：' + n + ' 个文件，' + (bytes / 1e6).toFixed(1) + ' MB' + (terser ? '' : '（没给 terser，脚本没去注释）'));
  console.log('新玩家进主城前：页面 1 + 样式 1 + 脚本 1（' + (sz('js/app.js') / 1e6).toFixed(2) + ' MB）+ 字体 ' + fontUrls.length + '（' + (fonts / 1e6).toFixed(2) + ' MB）+ home 包（' + (home.size / 1e6).toFixed(2) + ' MB）＝ '
    + (4 + fontUrls.length) + ' 个请求，' + ((sz('index.html') + sz('css/style.css') + sz('js/app.js') + fonts + home.size) / 1e6).toFixed(2) + ' MB');
  console.log('输出：' + DST);
})().catch(e => { console.error(e); process.exit(1); });
