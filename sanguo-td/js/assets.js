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
        im.onerror = () => { if (++n < 3) setTimeout(go, 800 * n * n); else resolve(false); };
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
  function load(onProgress) {
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
  function want(keys) { return load.want ? load.want(keys) : 0; }
  function need(keys, ms) {
    const ks = (keys || []).filter(Boolean).map(alias), miss = () => ks.filter(k => !img[k]);
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
    ver, want, need, onLate(fn) { lateCb = fn; }, pending: () => Math.max(0, total - loaded) };
})();
