// 布衣三国 · 美术素材加载
// 把画好的 PNG 按下面的规则放进素材文件夹，游戏会自动使用；没有的图继续用代码画的版本。
//   portraits/<武将id>.png   武将立绘，例如 portraits/guanyu.png
//   origins/<出身id>.png     出身立绘，例如 origins/farmer.png
//   icons/<物品id>.png       武器 / 技能 / 物品图标，例如 icons/qinglong.png
//   sprites/<角色id>.png     战场小人，例如 sprites/guanyu.png、sprites/foot.png、sprites/ally_spear.png
//   elites/<精英id>.png      精英立绘，例如 elites/captain.png
//   buildings/<据点id>.png   据点建筑，例如 buildings/camp.png
//   props/caltrop.png        铁蒺藜（单个，俯视）
//   cutins/<武将id>.png      大招特写横幅（眼部特写，宽 3:1）；sprites/lubu_mounted.png 吕布骑赤兔
// id 就是 data.js 里的英文名。

// 素材文件夹：和 index.html 放在一起的 assets/。整个游戏文件夹搬到哪里都能用。
const ASSET_BASE = 'assets/';

window.Assets = (() => {
  const imgs = {};
  const listeners = [];
  let pending = 0;

  function load(key, src) {
    pending++;
    const img = new Image();
    img.onload = () => { imgs[key] = img; pending--; listeners.forEach(f => f(key)); };
    img.onerror = () => { pending--; };
    img.src = src;
  }

  function init(D) {
    for (const id in D.generals) load('portrait:' + id, `${ASSET_BASE}portraits/${id}.png`);
    for (const o of D.origins) load('origin:' + o.id, `${ASSET_BASE}origins/${o.id}.png`);
    for (const group of [D.weapons, D.skills, D.passives]) {
      for (const id in group) load('icon:' + id, `${ASSET_BASE}icons/${id}.png`);
    }
    // 战场小人（Q 版全身、朝右、透明背景，脚底贴着图片下沿）
    for (const id of [...D.origins.map(o => o.id), ...Object.keys(D.generals), ...Object.keys(D.enemies), ...Object.keys(D.allies)]) {
      load('sprite:' + id, `${ASSET_BASE}sprites/${id}.png`);
    }
    // 精英立绘、据点建筑、道具
    for (const id in D.enemies) if (D.enemies[id].kind === 'elite') load('elite:' + id, `${ASSET_BASE}elites/${id}.png`);
    for (const id in D.buildings) load('building:' + id, `${ASSET_BASE}buildings/${id}.png`);
    load('prop:caltrop', `${ASSET_BASE}props/caltrop.png`);
    // 大招特写横幅、吕布骑赤兔
    for (const id in D.generals) load('cutin:' + id, `${ASSET_BASE}cutins/${id}.png`);
    load('sprite:lubu_mounted', `${ASSET_BASE}sprites/lubu_mounted.png`);
  }

  const esc = s => String(s).replace(/"/g, '&quot;');

  return {
    init,
    get: key => imgs[key] || null,
    onLoad: fn => listeners.push(fn),
    get loading() { return pending > 0; },
    // 图标：有图片就用图片，否则显示一个字
    icon(id, fallbackChar, name) {
      const img = imgs['icon:' + id];
      return img ? `<img class="ico" src="${esc(img.src)}" alt="${esc(name || fallbackChar)}">` : fallbackChar;
    },
  };
})();
