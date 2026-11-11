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
  enemy: { units: 54, ax: 0.5, ay: 0.86 },   // 小兵画布约 54 逻辑像素，其他敌人按体型等比放大
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
  function loadOne(file) {
    return new Promise(resolve => {
      const im = new Image();
      im.onload = () => { img[file.replace(/\.(png|jpe?g|webp)$/i, '')] = im; resolve(true); };
      im.onerror = () => resolve(false);
      im.src = 'assets/' + file + (window.ASSET_VER ? '?v=' + window.ASSET_VER : '');   // 换了图版本号就变，不会用到手机里缓存的旧图
    });
  }
  /* 只加载 assets/manifest.js 里列出的图（window.ASSET_LIST），不再逐个去试，没放图时不会有一堆 404 */
  function load() {
    const list = Array.isArray(window.ASSET_LIST) ? window.ASSET_LIST : [];
    const timeout = new Promise(resolve => setTimeout(resolve, 8000));   // 网络卡住也不挡住进游戏
    return Promise.race([Promise.all(list.map(loadOne)), timeout]).then(() => Object.keys(img));
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

  return { load, get: k => img[alias(k)] || null, keys: () => Object.keys(img), tinted, put };
})();
