'use strict';
/* ============================================================
 * 图片素材：把图片按约定的文件名放进 assets/ 就会自动替换程序绘制
 *   assets/bg/battle.png（或 .jpg）   战场背景
 *   assets/heroes/<武将id>.png        武将战场立绘（320×320，脚底中心在 50% / 86%）
 *   assets/heroes/<武将id>_head.png   武将头像（可选，没有就用立绘上半身）
 *   assets/enemies/<敌人id>.png       敌人；<id>_2.png 第 2 章起换的造型；boss_<章>.png 各章敌将
 *   assets/cutins/<武将id>.jpg        放大招时的横幅特写（可选）
 *   assets/fx/<名字>.jpg              技能特效贴图（黑底，叠加混合）；没放的由 fxgen.js 生成
 * 没放图的继续用程序画的，可以一张一张替换。规格见《美术素材规格.md》
 * 图片要登记在 assets/manifest.js 里才会加载（serve.ps1 或 tools/import_buyi_art.py 自动生成）
 * ============================================================ */

/* 立绘在战场上的大小与锚点（锚点 = 脚底中心在图片里的比例位置） */
const SPRITE = {
  hero:  { units: 80, ax: 0.5, ay: 0.86 },   // 80 单位 × 战场缩放 1.45 ≈ 116 逻辑像素的画布（人物本身约占八成）
  enemy: { units: 60, ax: 0.5, ay: 0.86 },   // 小兵画布约 60 逻辑像素，其他敌人按体型等比放大
};

const Assets = (function () {
  const img = {};                                       // 键 = 去掉扩展名的路径，如 'heroes/guanyu'、'fx/slash'
  const alias = k => {
    if (k === 'bg') return img['bg/battle'] ? 'bg/battle' : k;
    const i = k.indexOf(':'); if (i < 0) return k;
    const t = k.slice(0, i), n = k.slice(i + 1);
    return t === 'hero' ? 'heroes/' + n : t === 'head' ? 'heroes/' + n + '_head' : t === 'enemy' ? 'enemies/' + n
      : t === 'fx' ? 'fx/' + n : t === 'cut' ? 'cutins/' + n : k;
  };
  /* 一个文件的版本号：manifest.js 里每个文件一个（ASSET_H，文件内容的哈希），换了哪张图就只重下哪张；
   * 老的清单没有这张表，就用整体的 ASSET_VER（换任何一张图，全部重下） */
  const ver = file => (window.ASSET_H && window.ASSET_H[file]) || window.ASSET_VER || '';
  /* 加载一张图：失败了隔一会儿再试，一共试 3 次（国内访问慢，偶尔会断） */
  let started = false, lateCb = null, lateT = 0, total = 0, loaded = 0;
  const known = {}, gone = {};                              // known：清单里有的图；gone：试了 3 次都没下下来的。need() 只等「清单里有、还没放弃」的图——没画的图（比如刚加的兵器）等也等不来
  function loadOne(file) {
    const key = file.replace(/\.(png|jpe?g|webp)$/i, '');
    return new Promise(resolve => {
      let n = 0;
      const go = () => {
        const im = new Image();
        im.onload = () => {
          img[key] = im; loaded++;
          if (started) {                                   // 进游戏之后才到的图：换色缓存作废，攒半秒一起通知界面重画
            const fx = key.indexOf('fx/') === 0 ? key.slice(3) + '|' : null;
            if (fx) Object.keys(tintCache).forEach(k => { if (k.indexOf(fx) === 0) delete tintCache[k]; });
            clearTimeout(lateT); lateT = setTimeout(() => { if (lateCb) lateCb(); }, 500);
          }
          resolve(true);
        };
        im.onerror = () => { if (++n < 3) setTimeout(go, 800 * n * n); else { gone[key] = 1; resolve(false); } };
        const v = ver(file); im.src = 'assets/' + file + (v ? '?v=' + v : '') + (n ? (v ? '&' : '?') + 'r=' + n : '');   // 换了图版本号就变，不会用到手机里缓存的旧图
      };
      go();
    });
  }
  /* 只加载 assets/manifest.js 里列出的图（window.ASSET_LIST），不再逐个去试，没放图时不会有一堆 404。
   * v2.23 起分两批（原来是 500 张、13 MB 全下完才进主城，4G 上要等满 15 秒）：
   *   第一批（进主城前必须有，约 3 MB）：背景、界面、特效、普通敌人、当前上阵武将的立绘和头像——进度条只算这一批，一次下 8 张，最多等 15 秒
   *   第二批（进了主城在后台一直接着下，直到全部下完；一次 3 张，不和游戏抢）：自己有的武将的头像 → 其余头像 → 兵器图标
   *     （这三样招募结果、武将页、兵器页马上会用到，约 3 MB）→ 武将形象的敌人（心魔、神魔将）→ 自己有的武将的立绘 → 其余立绘
   * 第二批没到的图先用代码画的顶着，到了以后界面自动换上（onLate）；战斗画面每帧都取最新的图。
   * 为了不让玩家看到代码画的图：用到谁先下谁——want() 把要用的插到队伍最前面，need() 再等它们到了才往下走（招募结果用） */
  /* ============ 按包加载（v2.25，发布包走这条路；开发时没有 ASSET_PACKS，走下面一张张加载的老路）============
   * 为什么：TapTap 的 H5 每次都从 CDN 现取文件，没人取过的冷文件每个 0.5～1.8 秒（偶尔 10 秒）；原来进主城前一百五十多个请求，回回撞 15 秒上限。
   * 现在图片打成十来个包（tools/mk_release.js）：进主城前只取 home 包（背景、界面、开局武将；老玩家再加上阵武将的立绘包）；
   *   其余进了主城在后台按顺序取（特效、普通敌人最先——开战要用），用到哪包先取哪包。音效也是一个包（raw，原样交给 sfx.js）。
   *   home 包的请求在 index.html 里就发出去了（window.__PRE），这里接手，不用等 app.js 下完再发。
   * 规矩（用户定的）：有图的地方只显示真图。没到就等（界面上显示进度），下载失败就一直重试，绝不拿代码画的图顶。
   *   所以这条路没有「15 秒到了先进去」的上限；need() 也没有超时。 */
  const packs = [], packOf = {};                            // packOf：图的键 → 它在哪个包
  let bgOn = false, onStat = null;
  const mime = f => (/\.png$/i.test(f) ? 'image/png' : /\.webp$/i.test(f) ? 'image/webp' : 'image/jpeg');
  function unpack(p, buf) {
    if (p.raw) { p.buf = buf; return Promise.resolve(); }      // 不是图片（音效）：原样留着
    return Promise.all(p.items.map(it => new Promise(resolve => {
      const key = it[0].replace(/\.(png|jpe?g|webp)$/i, ''), im = new Image();
      let n = 0;
      const go = () => {                                      // 数据已经在手里了，解不出来多半是内存紧：隔一会儿再解，最多 3 次
        const url = URL.createObjectURL(new Blob([new Uint8Array(buf, it[1], it[2])], { type: mime(it[0]) }));
        im.onload = () => { img[key] = im; loaded++; resolve(); };
        im.onerror = () => { URL.revokeObjectURL(url); if (++n < 3) setTimeout(go, 300 * n); else { gone[key] = 1; resolve(); } };
        im.src = url;
      };
      go();
    })));
  }
  /* 下过的包存在手机里（IndexedDB）：下次打开，包的内容没变（哈希一样）就直接从手机里读，不走网络。
   * TapTap 每传一个新包地址就变、浏览器自己的缓存全部作废；这里按「包名 + 内容哈希」认，换了版本、没改过的图包照样不用重下。
   * 存不了、读不出（隐私模式、空间不够、个别壳子不支持）就当没有这回事，照常走网络。读最多等 1.5 秒。 */
  const store = (function () {
    let dbp = null;
    const open = () => dbp || (dbp = new Promise(resolve => {
      try {
        const rq = indexedDB.open('sg_packs', 1);
        rq.onupgradeneeded = () => { try { rq.result.createObjectStore('p'); } catch (e) { } };
        rq.onsuccess = () => resolve(rq.result); rq.onerror = () => resolve(null); rq.onblocked = () => resolve(null);
      } catch (e) { resolve(null); }
    }));
    const flag = (p, on) => { try { if (on) localStorage.setItem('sg_pk_' + p.n, p.h); else localStorage.removeItem('sg_pk_' + p.n); } catch (e) { } };   // index.html 里那段先发请求的脚本看这个：home 包已经存在手机里就不发了
    return {
      get(p) {
        const read = open().then(db => db ? new Promise(resolve => {
          try { const rq = db.transaction('p', 'readonly').objectStore('p').get(p.n); rq.onsuccess = () => { const v = rq.result; resolve(v && v.h === p.h && v.buf && v.buf.byteLength === p.size ? v.buf : null); }; rq.onerror = () => resolve(null); }
          catch (e) { resolve(null); }
        }) : null);
        return Promise.race([read, new Promise(resolve => setTimeout(() => resolve(null), 1500))]).then(buf => { if (!buf) flag(p, false); return buf; });
      },
      put(p, buf) {
        open().then(db => { if (!db) return; try { const tx = db.transaction('p', 'readwrite'); tx.objectStore('p').put({ h: p.h, buf }, p.n); tx.oncomplete = () => flag(p, true); } catch (e) { } });
      },
    };
  })();
  function fetchPack(p) {                                     // 取一个包：先看手机里有没有存着；没有就下，成功为止（断了、卡住 20 秒没动静、大小对不上，都重来）
    if (p.pr) return p.pr;
    p.st = 1; p.got = 0;
    p.pr = new Promise(resolve => {
      let n = 0;
      const finish = () => {
        p.st = 2; stat();
        if (started) {                                        // 进游戏之后才到的包：换色缓存作废，通知界面重画
          if (p.items.some(it => it[0].indexOf('fx/') === 0)) Object.keys(tintCache).forEach(k => { delete tintCache[k]; });
          clearTimeout(lateT); lateT = setTimeout(() => { if (lateCb) lateCb(); }, 60);
        }
        resolve(); pumpBg();
      };
      store.get(p).then(buf => {
        if (!buf) return go();
        const url = 'assets/' + p.f + '?v=' + p.h, pre = window.__PRE && window.__PRE[url];
        if (pre) { delete window.__PRE[url]; try { pre.x.abort(); } catch (e) { } }   // 手机里有：先发出去的那个请求不要了
        p.got = p.size; p.cached = true; stat(); unpack(p, buf).then(finish);
      });
      const go = () => {
        const url = 'assets/' + p.f + '?v=' + p.h, pre = !n && window.__PRE && window.__PRE[url];   // pre：index.html 里已经先发出去的那个请求
        if (pre) delete window.__PRE[url];
        const x = pre ? pre.x : new XMLHttpRequest(); let stall = 0, dead = false;
        const fail = () => { if (dead) return; dead = true; clearTimeout(stall); try { x.abort(); } catch (e) { } n++; p.got = 0; p.retry = n; stat(); setTimeout(go, Math.min(5000, 700 * n)); };
        const watch = () => { clearTimeout(stall); stall = setTimeout(fail, 20000); };
        if (!pre) { x.open('GET', url + (n ? '&r=' + n : '')); x.responseType = 'arraybuffer'; }
        x.onprogress = e => { p.got = e.loaded; watch(); stat(); };
        x.onload = () => {
          if (dead) return;
          if (x.status >= 200 && x.status < 300 && x.response && x.response.byteLength === p.size) {
            dead = true; clearTimeout(stall); p.got = p.size; p.retry = 0; stat();
            const buf = x.response;
            unpack(p, buf).then(() => { store.put(p, buf); finish(); });
          } else fail();
        };
        x.onerror = fail; x.onabort = () => { if (!dead) fail(); };
        watch();
        if (!pre) x.send();
        else if (x.readyState === 4) { if (x.status) x.onload(); else fail(); }   // 已经下完（或者已经失败）了
        else { p.got = pre.got || 0; stat(); }
      };
    });
    return p.pr;
  }
  function stat() { if (onStat) onStat(); }
  /* 后台接着下：按包的顺序，一次 3 个；want() / need() 点名的包不排队、立刻开始 */
  function pumpBg() {
    if (!bgOn) return;
    let busy = packs.filter(p => p.st === 1).length;
    for (const p of packs) { if (busy >= 3) break; if (!p.st) { fetchPack(p); busy++; } }
  }
  const packsFor = keys => { const out = []; (keys || []).forEach(k => { const p = k && packOf[alias(k)]; if (p && out.indexOf(p) < 0) out.push(p); }); return out; };
  function loadPacks(onProgress) {
    const D = typeof Save !== 'undefined' && Save.data ? Save.data : { team: [] };
    window.ASSET_PACKS.forEach(p => { p.st = 0; p.got = 0; packs.push(p); if (p.raw) return; p.items.forEach(it => { const k = it[0].replace(/\.(png|jpe?g|webp)$/i, ''); packOf[k] = p; known[k] = 1; total++; }); });
    // 进主城前必须到的：home 包；老玩家再加上阵武将的立绘所在的包（主城的城楼上站着他们）
    const first = packs.filter(p => p.core).concat(packsFor((D.team || []).filter(Boolean).map(id => 'heroes/' + id)).filter(p => !p.core));
    const size = first.reduce((s, p) => s + p.size, 0);
    onStat = () => { if (onProgress && !started) onProgress(Math.min(1, first.reduce((s, p) => s + (p.st === 2 ? p.size : p.got * 0.97), 0) / Math.max(1, size)), first.some(p => p.retry > 0 && p.st !== 2)); };
    return Promise.all(first.map(fetchPack)).then(() => { started = true; onStat = null; bgOn = true; pumpBg(); return Object.keys(img); });
  }
  /* 这些图是不是都到了（清单里没有的、解不出来的不算——等也等不来） */
  function ready(keys) { return !(keys || []).some(k => { const a = k && alias(k); return a && known[a] && !img[a] && !gone[a]; }); }
  /* 有图、但还没下到——画的时候用这个判断：是就先空着，不要拿代码画的顶 */
  function waiting(k) { const a = alias(k); return !!(known[a] && !img[a] && !gone[a]); }
  /* 这些图所在的包下了多少（0～1），给「正在加载」的进度条用 */
  function progress(keys) { const ps = packsFor(keys).filter(p => p.st !== 2); if (!ps.length) return 1; return ps.reduce((s, p) => s + p.got, 0) / Math.max(1, ps.reduce((s, p) => s + p.size, 0)); }
  const allKeys = () => Object.keys(known);
  /* 音效包：下到了就给 { 'sfx/boom.mp3': ArrayBuffer, … }；没有这个包（开发时）给 null */
  function rawPack(name) {
    const p = packs.filter(q => q.raw && q.n === name)[0]; if (!p) return null;
    return fetchPack(p).then(() => { const out = {}; p.items.forEach(it => { out[it[0]] = p.buf.slice(it[1], it[1] + it[2]); }); return out; });
  }

  function load(onProgress) {
    if (Array.isArray(window.ASSET_PACKS) && window.ASSET_PACKS.length) return loadPacks(onProgress);
    const D = typeof Save !== 'undefined' && Save.data ? Save.data : { heroes: {}, team: [] };
    const heroIds = {}; (typeof HEROES !== 'undefined' ? HEROES : []).forEach(h => { heroIds[h.id] = 1; });
    const team = {}; (D.team || []).forEach(id => { if (id) team[id] = 1; });
    const own = D.heroes || {};
    const idOf = f => f.replace(/^.*\//, '').replace(/\.\w+$/, '').replace(/_head$/, '');
    const dir = f => f.slice(0, f.indexOf('/'));
    const must = f => { const d = dir(f); return d === 'bg' || d === 'ui' || d === 'fx' || (d === 'enemies' && !heroIds[idOf(f)]) || (d === 'heroes' && !!team[idOf(f)]); };
    const rank = f => {
      const d = dir(f), id = idOf(f), head = /_head\./.test(f);
      if (must(f)) return d === 'bg' ? 0 : d === 'ui' ? 1 : d === 'heroes' ? 2 : d === 'fx' ? 3 : 4;
      return d === 'heroes' && head && own[id] ? 10 : d === 'heroes' && head ? 11 : d === 'weapons' ? 12 : d === 'enemies' ? 13 : d === 'heroes' && own[id] ? 14 : 15;
    };
    const list = (Array.isArray(window.ASSET_LIST) ? window.ASSET_LIST : []).filter(f => f.indexOf('sfx/') !== 0 && f.indexOf('voice/') !== 0).sort((a, b) => rank(a) - rank(b));   // sfx/、voice/ 里是音频，归 sfx.js 管
    list.forEach(f => { known[f.replace(/\.(png|jpe?g|webp)$/i, '')] = 1; });
    const first = list.filter(must).length;
    total = list.length;
    let next = 0, done = 0, busy = 0;
    const ready = new Promise(resolve => {
      if (!first) resolve();
      const pump = () => {
        while (next < list.length && busy < (started ? 3 : 8)) {
          if (!started && next >= first) break;             // 第一批还没下完：第二批先不动，别抢带宽
          busy++;
          loadOne(list[next++]).then(() => { busy--; done++; if (onProgress && !started) onProgress(Math.min(1, done / Math.max(1, first))); if (done >= first) resolve(); pump(); });
        }
      };
      load.pump = pump; pump();
    });
    // 插队：keys 是图的键（'heroes/guanyu_head'、'weapons/qinglong'…）的数组，或者一个挑文件的函数。还没开始下的那些挪到队伍最前面
    load.want = keys => {
      const hit = typeof keys === 'function' ? keys : (set => f => !!set[f.replace(/\.(png|jpe?g|webp)$/i, '')])((keys || []).reduce((m, k) => { if (k) m[alias(k)] = 1; return m; }, {}));
      const rest = list.slice(next), a = rest.filter(hit); if (!a.length) return 0;
      list.splice(next, rest.length, ...a, ...rest.filter(f => !hit(f)));
      if (started && load.pump) load.pump();
      return a.length;
    };
    const timeout = new Promise(resolve => setTimeout(resolve, 15000));  // 网络卡住也不挡住进游戏（没加载到的图先用代码画的，到了再换）
    return Promise.race([ready, timeout]).then(() => { started = true; load.pump(); return Object.keys(img); });
  }

  /* 用到谁先下谁。want：插队，不等；need：插队并等它们到齐（最多等 ms 毫秒），到齐或超时后 resolve(有没有等过) */
  function want(keys) {
    if (packs.length) { const ps = (typeof keys === 'function' ? packs.filter(p => p.items.some(it => keys(it[0]))) : packsFor(keys)).filter(p => !p.st); ps.forEach(fetchPack); return ps.length; }
    return load.want ? load.want(keys) : 0;
  }
  function need(keys, ms) {
    if (packs.length) {                                     // 按包：等到齐为止，没有超时（fetchPack 自己会一直重试）
      if (ready(keys)) return Promise.resolve(false);
      return Promise.all(packsFor((keys || []).filter(k => k && waiting(k))).map(fetchPack)).then(() => true);
    }
    const ks = (keys || []).filter(Boolean).map(alias), miss = () => ks.filter(k => !img[k] && known[k] && !gone[k]);
    if (!miss().length || !load.want) return Promise.resolve(false);
    load.want(ks);
    return new Promise(resolve => { const t0 = Date.now(), iv = setInterval(() => { if (!miss().length || Date.now() - t0 > (ms || 2000)) { clearInterval(iv); resolve(true); } }, 60); });
  }

  /* 特效贴图换色：黑底贴图乘上颜色（黑的还是黑，亮的部分变成该颜色），带缓存 */
  const tintCache = {};
  function tinted(name, rgb) {
    const key = name + '|' + rgb;
    if (tintCache[key] !== undefined) return tintCache[key];
    const src = img['fx/' + name];
    if (!src) return (tintCache[key] = null);
    const cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height;
    const c = cv.getContext('2d');
    c.drawImage(src, 0, 0);
    c.globalCompositeOperation = 'saturation'; c.fillStyle = '#808080'; c.fillRect(0, 0, cv.width, cv.height);   // 先去色
    c.globalCompositeOperation = 'multiply'; c.fillStyle = 'rgb(' + rgb + ')'; c.fillRect(0, 0, cv.width, cv.height);
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.25; c.drawImage(src, 0, 0);                      // 留一点原来的高光
    return (tintCache[key] = cv);
  }

  /* 代码生成的贴图（fxgen.js）也登记进来，和图片一样取用 */
  const put = (key, cv) => { img[key] = cv; };

  return { load, get: k => img[alias(k)] || null, keys: () => Object.keys(img), tinted, put,
    ver, want, need, ready, waiting, progress, allKeys, rawPack, packed: () => packs.length > 0, onLate(fn) { lateCb = fn; }, pending: () => Math.max(0, total - loaded) };
})();
