'use strict';
/* ============================================================
 * 图片素材：把图片按约定的文件名放进 assets/ 就会自动替换程序绘制
 *   assets/bg/battle.png（或 .jpg）   战场背景
 *   assets/heroes/<武将id>.png        武将战场立绘
 *   assets/heroes/<武将id>_head.png   武将头像（可选，没有就用立绘上半身）
 *   assets/enemies/<敌人id>.png       敌人
 * 没放图的继续用程序画的，可以一张一张替换。规格见《美术素材规格.md》
 * ============================================================ */

/* 立绘在战场上的大小与锚点（锚点 = 脚底中心在图片里的比例位置） */
const SPRITE = {
  hero:  { units: 66, ax: 0.5, ay: 0.86 },   // 66 单位 ≈ 战场上 96 逻辑像素高
  enemy: { units: 44, ax: 0.5, ay: 0.86 },   // 小兵约 44 逻辑像素高，其他敌人按体型等比放大
};

const Assets = (function () {
  const img = {};
  function wanted() {
    const list = [{ key: 'bg', file: 'bg/battle.jpg' }, { key: 'bg', file: 'bg/battle.png' }];
    HEROES.forEach(h => {
      list.push({ key: 'hero:' + h.id, file: 'heroes/' + h.id + '.png' });
      list.push({ key: 'head:' + h.id, file: 'heroes/' + h.id + '_head.png' });
    });
    Object.keys(ENEMIES).forEach(k => list.push({ key: 'enemy:' + k, file: 'enemies/' + k + '.png' }));
    return list;
  }
  function loadOne(w) {
    return new Promise(resolve => {
      const im = new Image();
      im.onload = () => { img[w.key] = im; resolve(true); };
      im.onerror = () => resolve(false);
      im.src = 'assets/' + w.file;
    });
  }
  /* 本地服务器会提供 assets/list.json（现有文件清单），只加载存在的图；
   * 直接双击 index.html 打开时拿不到清单，就逐个尝试 */
  function load() {
    const all = wanted();
    const viaList = fetch('assets/list.json', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(list => { const have = new Set(list); return Promise.all(all.filter(w => have.has(w.file)).map(loadOne)); });
    const job = viaList.catch(() => Promise.all(all.map(loadOne)));
    const timeout = new Promise(resolve => setTimeout(resolve, 6000));   // 网络卡住也不挡住进游戏
    return Promise.race([job, timeout]).then(() => Object.keys(img));
  }
  return { load, get: k => img[k] || null, keys: () => Object.keys(img), wanted };
})();
