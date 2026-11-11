'use strict';
/* ============================================================
 * 烽火守城 · 数据表
 * 调数值只改这个文件：经济、概率、武将、敌人、波次
 * ============================================================ */

const CFG = {
  W: 540, H: 960,          // 逻辑分辨率（竖屏 9:16）
  WALL_Y: 750,             // 城墙线，敌人走到这里开始攻城
  SLOTS: [[118, 812], [196, 840], [270, 802], [344, 840], [422, 812]],   // 5 个武将站位（身体中心；脚底在其下方 29）
  WAVES: 10,               // 每关波数
  BUFF_EVERY: 3,           // 每几波出一次三选一军令
  ENEMY_HP_SCALE: 1.8,     // 敌人血量总倍率（整体难度旋钮）

  // —— 经济 ——
  TICKET_PRICE: 100,       // 多少金币换 1 张招募令
  AD_DAILY_LIMIT: 5,       // 每日可看广告次数
  AD_REWARD: 1,            // 每次广告给几张招募令
  AD_SECONDS: 5,           // 网页版模拟广告时长（秒）
  START_COINS: 200,
  START_TICKETS: 10,
  COIN_DROP_RATE: 0.35,    // 普通敌人掉铜钱概率
  BUN_DROP_RATE: 0.03,     // 掉馒头（回复城防）概率

  // —— 抽卡 ——
  TEN_GUARANTEE_Q: 3,      // 十连保底品质（3 = 紫）
  PITY: 60,                // 多少抽必出橙

  // —— 养成 ——
  MAX_LEVEL: 100,
  MAX_STAR: 5,
  STAR_NEED: [1, 2, 3, 4, 5], // 升到下一星需要的碎片
  SHARD_TO_COIN: 30,       // 满星后多余碎片折算金币（× 品质倍率）
};

/* 品质：白 绿 蓝 紫 金 橙 黑 彩（黑、彩为神将，暂未开放） */
const QUALITIES = [
  { id: 0, name: '白', color: '#d9dde0', dark: '#6b7278', mult: 1.00, rate: 38 },
  { id: 1, name: '绿', color: '#62d267', dark: '#1f6b2a', mult: 1.25, rate: 28 },
  { id: 2, name: '蓝', color: '#4ea8ff', dark: '#1b4a8c', mult: 1.60, rate: 19 },
  { id: 3, name: '紫', color: '#b968ff', dark: '#52208c', mult: 2.10, rate: 10 },
  { id: 4, name: '金', color: '#ffd84a', dark: '#8c6410', mult: 2.80, rate: 4 },
  { id: 5, name: '橙', color: '#ff8a2a', dark: '#8c3a08', mult: 3.80, rate: 1 },
  { id: 6, name: '黑', color: '#3a3340', dark: '#0d0a12', mult: 5.20, rate: 0, god: true },
  { id: 7, name: '彩', color: '#ff7ad9', dark: '#3a2a7a', mult: 7.00, rate: 0, god: true },
];

const FACTIONS = {
  wei: { name: '魏', color: '#3f74d8', dark: '#234a94' },
  shu: { name: '蜀', color: '#2f9e5b', dark: '#1c6338' },
  wu:  { name: '吴', color: '#d2473d', dark: '#8a2a24' },
  qun: { name: '群', color: '#8a78b0', dark: '#54486f' },
};

/* 攻击类型：决定普攻与大招的形态 */
const ELEMENTS = {
  arrow:   { name: '弓', color: '#ffe9a8', atk: 22, cd: 0.55,
             desc: '快速射击最靠近城墙的敌人，暴击率更高',
             ult: '万箭自天而降，覆盖全场随机敌人' },
  blade:   { name: '刃', color: '#e6dcff', atk: 30, cd: 1.30,
             desc: '挥出贯穿刀气，伤害沿途所有敌人',
             ult: '连斩三道巨型刀气，横扫整条战线' },
  fire:    { name: '火', color: '#ff8a4a', atk: 26, cd: 1.60,
             desc: '投出火球，范围爆炸并灼烧',
             ult: '天火流星连续轰击敌群' },
  ice:     { name: '冰', color: '#8fdcff', atk: 20, cd: 1.20,
             desc: '冰枪范围伤害并减速',
             ult: '冰封全场敌人并造成伤害' },
  thunder: { name: '雷', color: '#c4b0ff', atk: 24, cd: 1.40,
             desc: '闪电在多个敌人之间弹跳',
             ult: '落雷劈中大量敌人并使其麻痹' },
  poison:  { name: '毒', color: '#8be84f', atk: 12, cd: 2.20,
             desc: '在敌群脚下留下毒潭，持续伤害',
             ult: '铺开巨型毒潭，长时间腐蚀' },
  wind:    { name: '风', color: '#9ff3d6', atk: 16, cd: 2.60,
             desc: '召唤旋风向前推进，持续伤害并击退',
             ult: '召唤巨型龙卷，把敌军卷回阵后' },
};

function H(id, name, q, fac, el, ult, title, extra) {
  return Object.assign({ id, name, q, fac, el, ult, title }, extra || {});
}
const HEROES = [
  // —— 白 ——
  H('liaohua',   '廖化',   0, 'shu', 'arrow',   '乱箭',     '蜀中先锋'),
  H('zhoucang',  '周仓',   0, 'shu', 'blade',   '蛮力斩',   '扛刀校尉'),
  H('peiyuan',   '裴元绍', 0, 'qun', 'fire',    '纵火',     '山寨头目'),
  H('guanhai',   '管亥',   0, 'qun', 'poison',  '瘴气',     '黄巾余部'),
  H('panfeng',   '潘凤',   0, 'qun', 'thunder', '惊雷斧',   '无双上将'),
  H('mifang',    '糜芳',   0, 'shu', 'ice',     '寒刺',     '南郡守将'),
  // —— 绿 ——
  H('guanping',  '关平',   1, 'shu', 'blade',   '承父志',   '少年将军'),
  H('caohong',   '曹洪',   1, 'wei', 'arrow',   '疾射',     '宗族悍将'),
  H('chengpu',   '程普',   1, 'wu',  'fire',    '烈焰',     '江东宿将'),
  H('zhangbao',  '张宝',   1, 'qun', 'thunder', '地公雷',   '地公将军'),
  H('huaxiong',  '华雄',   1, 'qun', 'wind',    '骁骑风',   '西凉都督'),
  // —— 蓝 ——
  H('xuhuang',   '徐晃',   2, 'wei', 'blade',   '断粮斩',   '周亚夫之风'),
  H('ganning',   '甘宁',   2, 'wu',  'arrow',   '锦帆夜袭', '锦帆贼'),
  H('weiyan',    '魏延',   2, 'shu', 'fire',    '奇谋火',   '镇北将军'),
  H('caiwenji',  '蔡文姬', 2, 'qun', 'ice',     '悲歌凝霜', '胡笳才女'),
  H('liru',      '李儒',   2, 'qun', 'poison',  '鸩毒',     '魔王之智'),
  H('xushu',     '徐庶',   2, 'shu', 'wind',    '巽风阵',   '单福先生'),
  // —— 紫 ——
  H('huangzhong','黄忠',   3, 'shu', 'arrow',   '百步穿杨', '老当益壮'),
  H('zhangliao', '张辽',   3, 'wei', 'wind',    '威震逍遥', '止啼之将'),
  H('zhangjiao', '张角',   3, 'qun', 'thunder', '太平雷法', '天公将军'),
  H('jiaxu',     '贾诩',   3, 'qun', 'poison',  '乱武毒策', '毒士'),
  H('zhenji',    '甄姬',   3, 'wei', 'ice',     '洛神冰魄', '洛水之神'),
  H('taishici',  '太史慈', 3, 'wu',  'blade',   '天义斩',   '信义笃烈'),
  // —— 金 ——
  H('guanyu',    '关羽',   4, 'shu', 'blade',   '青龙偃月', '武圣'),
  H('zhangfei',  '张飞',   4, 'shu', 'thunder', '当阳怒吼', '万人敌'),
  H('zhouyu',    '周瑜',   4, 'wu',  'fire',    '火烧赤壁', '美周郎'),
  H('zhaoyun',   '赵云',   4, 'shu', 'ice',     '龙胆寒枪', '常山赵子龙'),
  H('simayi',    '司马懿', 4, 'wei', 'poison',  '鬼谋',     '冢虎'),
  // —— 橙 ——
  H('zhugeliang','诸葛亮', 5, 'shu', 'wind',    '借东风',   '卧龙'),
  H('lvbu',      '吕布',   5, 'qun', 'blade',   '无双乱舞', '飞将'),
  H('caocao',    '曹操',   5, 'wei', 'arrow',   '万箭齐发', '乱世奸雄'),
  H('luxun',     '陆逊',   5, 'wu',  'fire',    '火烧连营', '江东儒帅'),
  // —— 黑 / 彩（神将，暂未开放，rate 为 0 不会被抽到）——
  H('god_guanyu',  '神·关羽',   6, 'shu', 'blade',   '武神降世', '神将', { locked: true }),
  H('god_lvbu',    '神·吕布',   6, 'qun', 'thunder', '神鬼无前', '神将', { locked: true }),
  H('god_zhuge',   '神·诸葛亮', 7, 'shu', 'wind',    '七星坛',   '神将', { locked: true }),
  H('god_caocao',  '神·曹操',   7, 'wei', 'poison',  '归心',     '神将', { locked: true }),
];
const HERO_MAP = {};
HEROES.forEach((h, i) => { h.seed = i * 1.7; HERO_MAP[h.id] = h; });

const STARTER_HEROES = ['liaohua', 'zhoucang', 'peiyuan'];

/* 敌人：hp/atk 会按关卡与波次放大 */
const ENEMIES = {
  grunt:  { id: 'grunt',  name: '黄巾兵', hp: 80,   spd: 38, atk: 6,  r: 13, coin: 1,  body: '#9a6b3a', hat: '#e2b53a' },
  shield: { id: 'shield', name: '刀盾兵', hp: 170,  spd: 26, atk: 8,  r: 15, coin: 2,  body: '#6d7684', hat: '#4b525e' },
  rider:  { id: 'rider',  name: '轻骑',   hp: 85,   spd: 72, atk: 10, r: 15, coin: 2,  body: '#a8543c', hat: '#5e2c20' },
  archer: { id: 'archer', name: '弓手',   hp: 50,   spd: 34, atk: 7,  r: 12, coin: 2,  body: '#5d8a4c', hat: '#2f4a28', range: 150 },
  elite:  { id: 'elite',  name: '校尉',   hp: 460,  spd: 30, atk: 20, r: 19, coin: 8,  body: '#a83232', hat: '#d8b04a' },
  boss:   { id: 'boss',   name: '敌将',   hp: 2400, spd: 17, atk: 55, r: 34, coin: 50, body: '#3a3140', hat: '#b01f2a' },
};

const CHAPTERS = [
  { name: '黄巾之乱', boss: '黄巾渠帅' },
  { name: '讨伐董卓', boss: '西凉猛将' },
  { name: '群雄割据', boss: '割据枭雄' },
  { name: '官渡之战', boss: '河北名将' },
  { name: '火烧赤壁', boss: '水军都督' },
  { name: '三分天下', boss: '镇关大将' },
  { name: '七擒孟获', boss: '南蛮王' },
  { name: '北伐中原', boss: '中原统帅' },
];
function chapterOf(stage) {
  const idx = Math.floor((stage - 1) / 10);
  const c = CHAPTERS[idx] || { name: '乱世无尽', boss: '无名霸主' };
  return { index: idx + 1, name: c.name, boss: c.boss, sub: ((stage - 1) % 10) + 1 };
}

/* 关卡强度 */
function stageHpMul(stage, wave) { return CFG.ENEMY_HP_SCALE * Math.pow(1.12, stage - 1) * (1 + 0.07 * (wave - 1)); }
function stageAtkMul(stage)      { return Math.pow(1.09, stage - 1); }
function stageRecommend(stage)   { return Math.round(330 * Math.pow(1.10, stage - 1)); }   // 按模拟对局粗略校准
function stageWinCoins(stage)    { return 100 + 25 * stage; }

/* 生成一波敌人：返回按出场时间排序的 [{t, type, x}] */
function genWave(stage, wave) {
  const n = Math.min(80, Math.round(10 + wave * 2.2 + stage * 0.6));
  const pool = [['grunt', 10]];
  if (stage >= 2 || wave >= 4) pool.push(['shield', 3]);
  if (stage >= 3 || wave >= 6) pool.push(['rider', 3]);
  if ((stage >= 2 && wave >= 2) || wave >= 7) pool.push(['archer', 3]);
  if (stage >= 4 && wave >= 4) pool.push(['elite', 1]);
  const total = pool.reduce((s, p) => s + p[1], 0);
  const dur = 4 + n * 0.1;
  const list = [];
  for (let i = 0; i < n; i++) {
    let r = Math.random() * total, type = 'grunt';
    for (const p of pool) { if ((r -= p[1]) <= 0) { type = p[0]; break; } }
    list.push({ t: Math.random() * dur, type, x: 56 + Math.random() * 428 });
  }
  if (wave % 5 === 0 && wave < CFG.WAVES) list.push({ t: 1.5, type: 'elite', x: 270 });
  if (wave === CFG.WAVES) list.push({ t: 2.5, type: 'boss', x: 270 });
  list.sort((a, b) => a.t - b.t);
  return { list, dur };
}

/* 局内三选一军令 */
const BUFFS = [
  { id: 'atk',  name: '擂鼓助威', desc: '全体攻击 +20%',       apply: b => { b.atk *= 1.2; } },
  { id: 'spd',  name: '急行军令', desc: '全体攻速 +15%',       apply: b => { b.spd *= 1.15; } },
  { id: 'crit', name: '破绽洞察', desc: '暴击率 +10%',         apply: b => { b.crit += 0.10; } },
  { id: 'rage', name: '士气高昂', desc: '怒气获取 +35%',       apply: b => { b.rage *= 1.35; } },
  { id: 'ult',  name: '奇谋妙计', desc: '大招伤害 +30%',       apply: b => { b.ult *= 1.3; } },
  { id: 'heal', name: '修缮城墙', desc: '立即回复 35% 城防',   apply: (b, S) => { S.wall = Math.min(S.wallMax, S.wall + S.wallMax * 0.35); } },
  { id: 'coin', name: '搜刮战利', desc: '本局铜钱掉落 +50%',   apply: b => { b.coin *= 1.5; } },
];
