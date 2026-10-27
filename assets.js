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
//   fx/dragon_white.png、fx/dragon_azure.png  白龙 / 青龙龙首（朝右）；mounts/white.png 白龙驹（不带骑手，朝右）
//   icons/el_fire.png 等  属性图标；fx/el_arrow_fire.png、fx/el_orb_fire.png、fx/el_hit_fire.png 等  属性箭、属性弹、属性命中（黑底发光）
// id 就是 data.js 里的英文名。

// 素材文件夹：和 index.html 放在一起的 assets/。整个游戏文件夹搬到哪里都能用。
const ASSET_BASE = 'assets/';
// 图片格式：仓库里是 PNG；发给 TapTap 的发布包把图片转成 WebP（小很多），打包脚本会把这里改成 '.webp'
const IMG = '.png';

window.Assets = (() => {
  const imgs = {};
  const listeners = [];
  // 图分两批：第一批是标题页和开局要用的（小人、图标、特效、建筑、神兵、出身立绘，约 7.5 MB），加载画面只等这一批；
  // 第二批是一时用不上的（精英立绘、名将立绘和特写、军需图标，约 10 MB），第一批下完就接着在后台按用到的先后下，下到了自动换上。
  // 以前全部 19 MB 加上音乐一起等，国内网慢的要等一分钟（玩家反馈）
  let pending = 0, total = 0, late = [], lateStarted = false, latePending = 0;
  const retrying = new Set(); // 因为网络问题正在重试的图

  // 图片没下到：分清是本来就没画（404，游戏用代码画的版本，不再要）还是网络问题（超时、断线、服务器出错）。
  // 网络问题就隔一会儿重试（1、2、4、8 秒），这期间加载画面接着等；四次都不行才放行，之后在后台每 20 秒再试，下到了自动换上。
  // 玩家反馈过网不好时「加载半天进去了没有建模图片」：以前出错一次就当加载完了
  const RETRY = [1000, 2000, 4000, 8000], BG_EVERY = 20000, BG_TRIES = 15;
  const local = location.protocol === 'file:'; // 双击 index.html 打开的：查不了 404，出错就当没画
  function load(key, src, isLate) {
    if (isLate && !lateStarted) { late.push([key, src]); return; }
    const first = !lateStarted;
    if (first) { pending++; total++; } else latePending++;
    let tries = 0, counted = false;
    const settle = () => { if (counted) return; counted = true; if (!first) latePending--; else pending--; };
    const img = new Image();
    img.onload = () => { retrying.delete(key); imgs[key] = img; settle(); listeners.forEach(f => f(key)); };
    img.onerror = () => {
      const again = () => { tries++; img.src = src + (src.includes('?') ? '&' : '?') + 'retry=' + tries; };
      if (local) return settle();
      fetch(src, { method: 'HEAD', cache: 'no-store' }).then(r => r.status >= 400 && r.status < 500 && r.status !== 408 && r.status !== 429 ? 'missing' : 'net', () => 'net').then(why => {
        if (why === 'missing') { retrying.delete(key); return settle(); } // 本来就没有这张图
        retrying.add(key);
        if (tries < RETRY.length) { setTimeout(again, RETRY[tries]); return; }
        settle(); // 加载画面不再等它，后台接着试
        if (tries < RETRY.length + BG_TRIES) setTimeout(again, BG_EVERY); else retrying.delete(key);
      });
    };
    img.src = src;
  }
  function startLate() { // 第二批：由 game.js 在第一批图和开局音乐都下完后叫（不跟加载画面要等的东西抢网速）
    if (lateStarted) return; lateStarted = true; const l = late; late = []; for (const [k, s] of l) load(k, s); }

  function init(D) {
    for (const o of D.origins) load('origin:' + o.id, `${ASSET_BASE}origins/${o.id}${IMG}`);
    for (const group of [D.weapons, D.skills, D.passives]) {
      for (const id in group) load('icon:' + id, `${ASSET_BASE}icons/${id}${IMG}`);
    }
    // 属性：图标 icons/el_<属性>.png；属性箭 fx/el_arrow_<属性>.png（黑底、箭头朝右）、
    // 属性弹 fx/el_orb_<属性>.png（黑底）、属性命中 fx/el_hit_<属性>.png（黑底）。属性 = fire / ice / thunder / wind
    for (const id in D.elements || {}) {
      load('icon:el_' + id, `${ASSET_BASE}icons/el_${id}${IMG}`);
      for (const k of ['arrow', 'orb', 'hit']) load(`elfx:${k}_${id}`, `${ASSET_BASE}fx/el_${k}_${id}${IMG}`);
    }
    // 局外装备图标
    // 局外装备：每件 9 个形态的图标（icons/<装备>_<级>.png），以及每个出身 9 种造型的小人（sprites/<出身>_w<武器阶段>a<护甲阶段>.png）
    for (const o in (D.meta && D.meta.gear) || {}) {
      for (let w = 1; w <= 3; w++) for (let a = 1; a <= 3; a++) load(`sprite:${o}_w${w}a${a}`, `${ASSET_BASE}sprites/${o}_w${w}a${a}${IMG}`);
    }
    // 战场小人（Q 版全身、朝右、透明背景，脚底贴着图片下沿）
    for (const id of [...D.origins.map(o => o.id), ...Object.keys(D.generals), ...Object.keys(D.enemies), ...Object.keys(D.allies)]) {
      load('sprite:' + id, `${ASSET_BASE}sprites/${id}${IMG}`);
    }
    // 精英立绘、据点建筑、道具
    for (const id in D.buildings) load('building:' + id, `${ASSET_BASE}buildings/${id}${IMG}`);
    load('prop:caltrop', `${ASSET_BASE}props/caltrop${IMG}`);
    // 骑马的小人：吕布骑赤兔
    load('sprite:lubu_mounted', `${ASSET_BASE}sprites/lubu_mounted${IMG}`);
    load('sprite:machao_mounted', `${ASSET_BASE}sprites/machao_mounted${IMG}`); // 马超骑白马
    load('sprite:molubu_mounted', `${ASSET_BASE}sprites/molubu_mounted${IMG}`); // 魔吕布骑魔赤兔（没有图时用代码画的马驮着魔吕布的小人）
    load('sprite:shenzhaoyun_mounted', `${ASSET_BASE}sprites/shenzhaoyun_mounted${IMG}`); // 神赵云骑照夜玉狮子
    // 特效贴图：龙首（白龙 = 赵云七进七出，青龙 = 关羽刀气）、坐骑
    for (const id of ['dragon_white', 'dragon_azure', 'dragon_shen']) load('fx:' + id, `${ASSET_BASE}fx/${id}${IMG}`); // dragon_shen：神赵云龙魂·四象的龙首（没画好时借白龙）
    // 招式特效贴图（黑底发光图，叠加着画）：刀光、冲击环、爆裂、雷电、枪芒、旋风、火焰、法阵、光柱
    for (const id of ['slash', 'ring', 'burst', 'bolt', 'thrust', 'whirl', 'flame', 'circle', 'pillar']) load('fxs:' + id, `${ASSET_BASE}fx/${id}${IMG}`);
    load('mount:white', `${ASSET_BASE}mounts/white${IMG}`);
    load('mount:chitu', `${ASSET_BASE}mounts/chitu${IMG}`); // 赤兔马（玩家拿到「赤兔」后骑）
    // 神兵：悬浮在玩家身边的名将专属兵器（透明背景，兵器斜放）
    for (const id in D.shenbing || {}) load('shenbing:' + id, `${ASSET_BASE}shenbing/${id}${IMG}`);
    // ---- 第二批：按用到的先后排（精英开局 40 秒后出，第一个名将一分钟左右来，军需图标只在军需页用）----
    for (const id in D.enemies) if (D.enemies[id].kind === 'elite') load('elite:' + id, `${ASSET_BASE}elites/${id}${IMG}`, true); // 精英立绘
    for (const id in D.generals) { // 名将立绘和大招特写（按出场先后）
      load('portrait:' + id, `${ASSET_BASE}portraits/${id}${IMG}`, true);
      load('cutin:' + id, `${ASSET_BASE}cutins/${id}${IMG}`, true);
    }
    for (const c of (D.twin && D.twin.combos) || []) load('cutin:combo_' + c.id, `${ASSET_BASE}cutins/combo_${c.id}${IMG}`, true); // 魔吕布、魔貂蝉的组合大招特写
    for (const o in (D.meta && D.meta.gear) || {}) for (const g of D.meta.gear[o]) for (let lv = 1; lv <= 9; lv++) load(`icon:${g.id}_${lv}`, `${ASSET_BASE}icons/${g.id}_${lv}${IMG}`, true); // 军需图标
  }

  const esc = s => String(s).replace(/"/g, '&quot;');

  return {
    init, startLate,
    get: key => imgs[key] || null,
    onLoad: fn => listeners.push(fn),
    get loading() { return pending > 0; },
    // 加载进度 0~1（缺图也算加载完）；还没开始下是 0（图等页面 load 过了才开始下，见 game.js）
    get progress() { return total ? 1 - pending / total : 0; }, // 第一批的进度
    get lateLeft() { return lateStarted ? latePending : late.length || 1; }, // 第二批还剩几张没下完（还没开始时至少算 1）
    get retrying() { return retrying.size; }, // 网络不好、正在重试的图有几张
    // 图标：有图片就用图片，否则显示一个字
    icon(id, fallbackChar, name) {
      const img = imgs['icon:' + id];
      return img ? `<img class="ico" src="${esc(img.src)}" alt="${esc(name || fallbackChar)}">` : fallbackChar;
    },
  };
})();
