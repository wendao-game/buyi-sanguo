'use strict';
/* ============================================================
 * 烽火守城 · 数据表
 * 调数值只改这个文件：经济、概率、武将、敌人、波次
 * ============================================================ */

const CFG = {
  W: 540, H: 960,          // 逻辑分辨率（竖屏 9:16）
  WALL_Y: 685,             // 城墙线（背景图垛口的位置），敌人走到这里开始攻城
  SLOTS: [[96, 770], [183, 800], [270, 758], [357, 800], [444, 770]],   // 5 个武将站位（身体中心；脚底在其下方 29）
  WAVES: 10,               // 每关波数
  BUFF_EVERY: 3,           // 每几波出一次三选一军令
  ENEMY_HP_SCALE: 1,       // 敌人血量总倍率（整体难度旋钮：1 = 按数值规划；调大整体变难）

  // —— 经济 ——
  TICKET_PRICE: 200,       // 多少金币换 1 张招募令
  AD_DAILY_LIMIT: 5,       // 每日可看广告次数
  AD_REWARD: 1,            // 每次广告给几张招募令
  AD_SECONDS: 5,           // 网页版模拟广告时长（秒）
  AD_UNIT_ID: '',          // 平台激励视频广告位 ID（TapTap / 抖音后台申请后填这里；留空 = 平台里不显示广告入口）
  AD_WAIT: 20,             // 点了广告多少秒还没播出来，就当这次没有广告
  REPLAY_COIN: 0.5,        // 重复通关时通关金币的比例（首通拿全额；想多拿用每日扫荡）
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
  AWAKEN_STAR: 3,          // 几星觉醒：专属大招效果 ×1.5
  AWAKEN_POWER: 1.2,       // 觉醒后战力数字 × 此值（模拟器量出来觉醒大约值这么多）
  LEVEL_COST: 6,           // 升级花费 = 此值 × 等级^LEVEL_COST_POW ×（1 + 0.25 × 品质）
  LEVEL_COST_POW: 1.1,
  LEVEL_REFUND: 1,         // 重置等级返还已花金币的比例（1 = 全额：换阵容不亏）

  // —— 局内操作 ——
  ROCK_MAX: 3,             // 滚木礌石最多存几块
  ROCK_CD: 6,              // 每块恢复秒数
  ROCK_R: 60,              // 落点半径
  ROCK_DMG: 1.0,           // 每块伤害 = 当前关卡黄巾兵血量 × 此倍率（并眩晕 1 秒）
  AIM_SLOW: 0.25,          // 手动瞄准大招时的慢动作倍率
  SWAP_DELAY: 1.5,         // 局中换上场的武将过多少秒才第一次出手（怒气从 0 开始）

  // —— 控制抗性（见 battle.js 的 ccTime / pushBack）——
  CC_DECAY: 0.8,           // 敌人每被硬控一次，之后的控制时长 × 此值
  CC_MIN: 0.3,             // 控制时长最低打到几折
  PUSH_DECAY: 0.93,        // 每被击退一次，之后的击退距离 × 此值
  PUSH_MIN: 0.15,

  // —— 扫荡（已通关的关卡直接领奖励）——
  SWEEP_DAILY: 5,
  SWEEP_MUL: 1.3,          // 扫荡奖励 = 通关金币 × 此倍率（约等于通关金币 + 平均掉落）

  // —— 云存档 / 本机备份（只在 TapTap 里生效）——
  CLOUD_NAME: 'sanguo_td_save',
  CLOUD_EVERY: 65,         // 最快多少秒上传一次

  // —— 礼包码（主城「设置 · 存档」里兑换，每个码每份存档只能用一次）——
  // 现在这个是试玩用的；正式上线前删掉或换成活动用的码
  GIFT_CODES: {
    FENGHUO100: { tickets: 100, coins: 5000, note: '试玩礼包' },
  },
};

/* 只有本机调试时才认网址里的调试参数（?coins=…），正式发布的网页和小游戏里一律忽略 */
const DEV = (function () {
  try {
    if (typeof tap !== 'undefined' || typeof tt !== 'undefined') return false;
    return location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  } catch (e) { return false; }
})();

/* 品质：白 绿 蓝 紫 金 橙 黑 彩（黑、彩为神将，暂未开放） */
/* mult = 攻击倍率；pw = 战力数字再乘的「技能含金量」（高品质武将的技能本身更强，模拟器量出来的，见 tools/sim/heroes.js）*/
const QUALITIES = [
  { id: 0, name: '白', color: '#d9dde0', dark: '#6b7278', mult: 1.00, pw: 1.00, rate: 38 },
  { id: 1, name: '绿', color: '#62d267', dark: '#1f6b2a', mult: 1.25, pw: 1.00, rate: 28 },
  { id: 2, name: '蓝', color: '#4ea8ff', dark: '#1b4a8c', mult: 1.60, pw: 1.00, rate: 19 },
  { id: 3, name: '紫', color: '#b968ff', dark: '#52208c', mult: 2.10, pw: 1.15, rate: 10 },
  { id: 4, name: '金', color: '#ffd84a', dark: '#8c6410', mult: 2.80, pw: 1.50, rate: 4 },
  { id: 5, name: '橙', color: '#ff8a2a', dark: '#8c3a08', mult: 3.80, pw: 1.80, rate: 1 },
  { id: 6, name: '黑', color: '#3a3340', dark: '#0d0a12', mult: 5.20, pw: 2.00, rate: 0, god: true },
  { id: 7, name: '彩', color: '#ff7ad9', dark: '#3a2a7a', mult: 7.00, pw: 2.20, rate: 0, god: true },
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
             desc: '闪电在 5 个敌人之间弹跳',
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

/* 各章敌将；立绘是 assets/enemies/boss_<章>.png（第 9 章起用 boss_9） */
const CHAPTERS = [
  { name: '黄巾之乱', boss: '程远志' },
  { name: '讨伐董卓', boss: '董卓' },
  { name: '群雄割据', boss: '颜良' },
  { name: '官渡之战', boss: '文丑' },
  { name: '火烧赤壁', boss: '夏侯惇' },
  { name: '三分天下', boss: '陷阵统领' },
  { name: '七擒孟获', boss: '南蛮王' },
  { name: '北伐中原', boss: '虎豹骑统领' },
];
function chapterOf(stage) {
  const idx = Math.floor((stage - 1) / 10);
  const c = CHAPTERS[idx] || { name: '乱世无尽', boss: '幽冥鬼将' };
  return { index: idx + 1, name: c.name, boss: c.boss, sub: ((stage - 1) % 10) + 1 };
}

/* ============================================================
 * 数值规划（详见《数值规划.md》）
 * 做法：先定每章打完时玩家该有多强（战力预算），敌人强度、推荐战力都从这张表算出来；
 *       再用不带画面的模拟器（tools/sim/）校准，让「战力 = 推荐战力」时挂机胜率约六成。
 * ============================================================ */
/* 每章最后一关的战力预算（第 0 项 = 开局）。章内按等比插值；第 8 章之后每关 +3% */
const STAGE_POWER = [250, 3000, 7900, 13900, 21100, 28500, 37700, 49800, 65900];
function stagePower(stage) {
  const n = STAGE_POWER.length - 1, s = Math.max(1, stage);
  if (s >= n * 10) return STAGE_POWER[n] * Math.pow(1.03, s - n * 10);
  const c = Math.floor((s - 1) / 10), f = (s - c * 10) / 10;
  return STAGE_POWER[c] * Math.pow(STAGE_POWER[c + 1] / STAGE_POWER[c], f);
}
/* 敌人血量 ÷ 战力预算：模拟器校准出来的系数（第 1 … 80 关取 12 个点），中间按对数插值。
 * 重新校准：node tools/sim/calibrate.js，把输出的这一行贴回来 */
const HP_PER_POWER = [[1, 0.0060], [15, 0.0058], [25, 0.0052], [40, 0.0056], [80, 0.0059]];   // 各关校准值在 0.0049–0.0065 之间，取平滑后的
function hpPerPower(stage) {
  const T = HP_PER_POWER, s = Math.max(1, stage);
  if (s <= T[0][0]) return T[0][1];
  for (let i = 1; i < T.length; i++) if (s <= T[i][0]) { const f = (s - T[i - 1][0]) / (T[i][0] - T[i - 1][0]); return T[i - 1][1] * Math.pow(T[i][1] / T[i - 1][1], f); }
  return T[T.length - 1][1];
}
/* 关卡强度 */
function stageHpMul(stage, wave) { return CFG.ENEMY_HP_SCALE * hpPerPower(stage) * stagePower(stage) * (1 + 0.07 * (wave - 1)); }
function stageAtkMul(stage)      { return (400 + 0.62 * stagePower(stage)) / (400 + 0.62 * stagePower(1)); }   // 跟着城防（400 + 武将战力）涨：各关城墙能挨的下数差不多
function stageRecommend(stage)   { return Math.round(stagePower(stage) / 10) * 10; }
function stageWinCoins(stage)    { return 100 + 25 * stage; }

/* 生成一波敌人：返回按出场时间排序的 [{t, type, x}] */
function genWave(stage, wave) {
  const n = Math.round(10 + wave * 2.2 + Math.min(stage, 40) * 0.6);   // 每波人数：第 40 关以后不再加人（最多 56），后面靠血量变强
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

/* ---------------- 站位：5 个位置各有职责 ---------------- */
const SLOT_ROLES = [
  { name: '左翼', desc: '弓、火、毒、雷系出手速度 +15%', els: ['arrow', 'fire', 'poison', 'thunder'], spd: 0.15 },
  { name: '前锋', desc: '刃、风、冰系攻击 +15%', els: ['blade', 'wind', 'ice'], atk: 0.15 },
  { name: '主帅', desc: '全军攻击 +品质×3%（白 0% … 橙 15%），本人怒气获取 +20%', leader: true },
  { name: '前锋', desc: '刃、风、冰系攻击 +15%', els: ['blade', 'wind', 'ice'], atk: 0.15 },
  { name: '右翼', desc: '弓、火、毒、雷系出手速度 +15%', els: ['arrow', 'fire', 'poison', 'thunder'], spd: 0.15 },
];

/* ---------------- 阵营羁绊：同阵营上阵 2 / 3 / 4 人 ---------------- */
const FACTION_BONDS = {
  wei: { name: '虎豹骑', stat: 'spd',  vals: [0.08, 0.15, 0.25], fmt: v => '全军出手速度 +' + Math.round(v * 100) + '%' },
  shu: { name: '仁德',   stat: 'atk',  vals: [0.08, 0.15, 0.25], fmt: v => '全军攻击 +' + Math.round(v * 100) + '%' },
  wu:  { name: '江东',   stat: 'rage', vals: [0.12, 0.25, 0.40], fmt: v => '全军怒气获取 +' + Math.round(v * 100) + '%' },
  qun: { name: '乱世',   stat: 'crit', vals: [0.05, 0.10, 0.15], fmt: v => '全军暴击率 +' + Math.round(v * 100) + '%' },
};

/* ---------------- 缘分：指定武将同时上阵（need = 至少几人） ---------------- */
const COMBOS = [
  { name: '蜀汉旧将', ids: ['liaohua', 'zhoucang', 'guanping'], need: 2, desc: '全军攻击 +8%', eff: { atk: 0.08 } },
  { name: '黄巾起义', ids: ['zhangjiao', 'zhangbao', 'guanhai', 'peiyuan'], need: 3, desc: '全军攻击 +18%', eff: { atk: 0.18 } },
  { name: '关氏父子', ids: ['guanyu', 'guanping', 'zhoucang'], need: 2, desc: '刃系伤害 +25%', eff: { el: { blade: 0.25 } } },
  { name: '五虎上将', ids: ['guanyu', 'zhangfei', 'zhaoyun', 'huangzhong'], need: 3, desc: '全军攻击 +10%、暴击率 +10%', eff: { atk: 0.10, crit: 0.10 } },
  { name: '长沙旧部', ids: ['huangzhong', 'weiyan'], need: 2, desc: '弓、火系伤害 +25%', eff: { el: { arrow: 0.25, fire: 0.25 } } },
  { name: '荆襄名士', ids: ['zhugeliang', 'xushu'], need: 2, desc: '风系伤害 +35%', eff: { el: { wind: 0.35 } } },
  { name: '赤壁之盟', ids: ['zhugeliang', 'zhouyu'], need: 2, desc: '大招伤害 +20%、怒气获取 +10%', eff: { ult: 0.20, rage: 0.10 } },
  { name: '江东双璧', ids: ['zhouyu', 'luxun'], need: 2, desc: '火系伤害 +35%', eff: { el: { fire: 0.35 } } },
  { name: '江表虎臣', ids: ['ganning', 'taishici', 'chengpu'], need: 2, desc: '全军攻击 +12%', eff: { atk: 0.12 } },
  { name: '魏之谋主', ids: ['caocao', 'simayi', 'jiaxu'], need: 2, desc: '大招伤害 +30%', eff: { ult: 0.30 } },
  { name: '曹氏宗亲', ids: ['caocao', 'caohong'], need: 2, desc: '城防上限 +25%', eff: { wall: 0.25 } },
  { name: '五子良将', ids: ['zhangliao', 'xuhuang'], need: 2, desc: '全军出手速度 +10%', eff: { spd: 0.10 } },
  { name: '并州旧部', ids: ['lvbu', 'zhangliao'], need: 2, desc: '全军出手速度 +12%', eff: { spd: 0.12 } },
  { name: '西凉董营', ids: ['huaxiong', 'liru', 'lvbu', 'jiaxu'], need: 2, desc: '毒、风系伤害 +30%', eff: { el: { poison: 0.30, wind: 0.30 } } },
  { name: '乱世才女', ids: ['caiwenji', 'zhenji'], need: 2, desc: '冰系伤害 +30%、怒气获取 +15%', eff: { el: { ice: 0.30 }, rage: 0.15 } },
  { name: '天公地公', ids: ['zhangjiao', 'zhangbao', 'panfeng'], need: 2, desc: '雷系伤害 +30%', eff: { el: { thunder: 0.30 } } },
];

/* 局内三选一军令 */
const BUFFS = [
  { id: 'atk',  name: '擂鼓助威', desc: '全体攻击 +20%',       apply: b => { b.atk *= 1.2; } },
  { id: 'spd',  name: '急行军令', desc: '全体攻速 +15%',       apply: b => { b.spd *= 1.15; } },
  { id: 'crit', name: '破绽洞察', desc: '暴击率 +10%',         apply: b => { b.crit += 0.10; } },
  { id: 'rage', name: '士气高昂', desc: '怒气获取 +35%',       apply: b => { b.rage *= 1.35; } },
  { id: 'ult',  name: '奇谋妙计', desc: '大招伤害 +30%',       apply: b => { b.ult *= 1.3; } },
  { id: 'heal', once: true, name: '修缮城墙', desc: '立即回复 35% 城防',   apply: (b, S) => { S.wall = Math.min(S.wallMax, S.wall + S.wallMax * 0.35); } },
  { id: 'coin', name: '搜刮战利', desc: '本局铜钱掉落 +50%',   apply: b => { b.coin *= 1.5; } },
  { id: 'rock', once: true, name: '多备礌石', desc: '投石上限 +2，伤害 +50%', apply: (b, S) => { S.rock.max += 2; S.rock.n += 2; S.rock.dmg *= 1.5; } },
  { id: 'boss', name: '擒贼擒王', desc: '对校尉、敌将伤害 +35%', apply: b => { b.boss *= 1.35; } },
  // 带 el 的只在阵上有该系武将时出现
  { id: 'e_fire',   el: 'fire',    name: '火上浇油', desc: '火系伤害 +40%',   apply: b => { b.el.fire = (b.el.fire || 1) * 1.4; } },
  { id: 'e_arrow',  el: 'arrow',   name: '连弩齐备', desc: '弓系伤害 +40%',   apply: b => { b.el.arrow = (b.el.arrow || 1) * 1.4; } },
  { id: 'e_blade',  el: 'blade',   name: '磨刀霍霍', desc: '刃系伤害 +40%',   apply: b => { b.el.blade = (b.el.blade || 1) * 1.4; } },
  { id: 'e_ice',    el: 'ice',     name: '天寒地冻', desc: '冰系伤害 +40%',   apply: b => { b.el.ice = (b.el.ice || 1) * 1.4; } },
  { id: 'e_thunder', el: 'thunder', name: '雷霆万钧', desc: '雷系伤害 +40%',  apply: b => { b.el.thunder = (b.el.thunder || 1) * 1.4; } },
  { id: 'e_poison', el: 'poison',  name: '百毒淬刃', desc: '毒系伤害 +40%',   apply: b => { b.el.poison = (b.el.poison || 1) * 1.4; } },
  { id: 'e_wind',   el: 'wind',    name: '顺风而行', desc: '风系伤害 +40%',   apply: b => { b.el.wind = (b.el.wind || 1) * 1.4; } },
];
