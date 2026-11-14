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
  SOUL_VALUE: [1, 2, 4, 8, 20, 50],             // 一片武将碎片炼化成多少将魂（按武将品质；满星后再抽到直接给将魂）
  SOUL_COST: [4, 8, 16, 32, 80, 200],           // 升星时用将魂顶一片碎片要多少（按武将品质）：同品质 4 换 1，低品喂高品更划算
  AWAKEN_STAR: 3,          // 几星觉醒：专属大招效果 ×1.5
  AWAKEN_POWER: 1.2,       // 觉醒后战力数字 × 此值（模拟器量出来觉醒大约值这么多）
  LEVEL_COST: 6,           // 升级花费 = 此值 × 等级^LEVEL_COST_POW ×（1 + 0.25 × 品质）
  LEVEL_COST_POW: 1.1,
  LEVEL_REFUND: 1,         // 重置等级返还已花金币的比例（1 = 全额：换阵容不亏）

  // —— 兵器（精铁）——
  WEAPON_MAX_LV: 20,
  WEAPON_LV_STEP: 0.05,    // 每强化一级，加成多 5%（20 级是 1 级的 1.95 倍）
  WEAPON_OWNER_MUL: 1.3,   // 专属武将装上：加成 ×1.3
  WEAPON_SHARE: 0.3,       // 招募时每一抽出兵器的概率（其余出武将；品质概率、保底和武将共用）
  WEAPON_MELT_VAL: [1, 2, 4, 10, 25, 60],       // 一件兵器熔成多少精铁（抽到已有的自动熔掉；手动熔掉另外全额返还强化花的）
  WEAPON_UP: [1, 1.5, 2, 3, 4.5, 6],            // 强化到下一级 = 此值 × 当前等级

  // —— 局内操作 ——
  ROCK_MAX: 3,             // 滚木礌石最多存几块
  ROCK_CD: 6,              // 每块恢复秒数
  ROCK_R: 60,              // 落点半径
  ROCK_DMG: 1.0,           // 每块伤害 = 当前关卡黄巾兵血量 × 此倍率（并眩晕 1 秒）
  AIM_SLOW: 0.25,          // 手动瞄准大招时的慢动作倍率
  SWAP_DELAY: 1.5,         // 局中换上场的武将过多少秒才第一次出手（怒气从 0 开始）
  /* —— 爽感（v1.8）—— */
  HORDE: 1.35,             // 割草：小兵（ENEMIES 里带 horde 的）人数 × 此值，单个的血量、攻击、掉钱概率 ÷ 此值——总量不变，杀得更快更密
  KILL_RAGE: 0.45,         // 每杀一个敌人，全体武将回这么多怒气（校尉、敌将、器械 ×8）：杀得多，大招就放得勤
  COMBO_GAP: 2.5,          // 连斩：这么多秒没杀人就断
  COMBO_STEPS: [[30, '势如破竹'], [60, '横扫千军'], [100, '万夫莫敌'], [150, '所向披靡'], [220, '天下无双']],   // 连斩到这些数：喊一声，全体武将怒气 +COMBO_RAGE
  COMBO_RAGE: 8,

  HEAL_DECAY: 0.7,         // 技能回复城防的递减：每回复一次，之后的回复量 × 此值
  HEAL_MIN: 0.2,           // 回复量最低打到几折

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

  // —— 礼包码（主城「设置 · 存档」里兑换）——
  // times = 每份存档能用几次（不写 = 1 次）；ver 改个数，这个码的已用次数就清零重新算
  // 现在这个是试玩用的；正式上线前删掉或换成活动用的码
  GIFT_CODES: {
    FENGHUO100: { tickets: 100, coins: 5000, note: '试玩礼包', times: 5, ver: 2 },
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
/* 品质：mult = 攻击倍率，pw = 技能值多少战力（模拟器量出来的：同样的攻击力，高品武将的技能更能打）。
 * v1.7 起 mult 压平了（橙的攻击只比白高 72%，原来是 3.8 倍）：高品强在技能和起点，不靠面板碾压。
 * 同等级同星下战力 白 1 : 绿 1.2 : 蓝 1.45 : 紫 1.8 : 金 2.4 : 橙 3.1（原来是 1 : 1.25 : 1.6 : 2.4 : 4.2 : 6.8）。
 * 每升一星 +20%、三星觉醒再 ×1.2（满星 = 2.4 倍），而低品的重复卡多得多、星升得快：
 * 满星白 = 零星金；满星蓝（3.5）> 零星橙（3.1）、接近一星橙（3.7）；满星紫（4.3）= 二星橙；满星金（5.8）= 三星橙 */
const QUALITIES = [
  { id: 0, name: '白', color: '#d9dde0', dark: '#6b7278', mult: 1.00, pw: 1.00, rate: 38 },
  { id: 1, name: '绿', color: '#62d267', dark: '#1f6b2a', mult: 1.20, pw: 1.00, rate: 28 },
  { id: 2, name: '蓝', color: '#4ea8ff', dark: '#1b4a8c', mult: 1.45, pw: 1.00, rate: 19 },
  { id: 3, name: '紫', color: '#b968ff', dark: '#52208c', mult: 1.57, pw: 1.15, rate: 10 },
  { id: 4, name: '金', color: '#ffd84a', dark: '#8c6410', mult: 1.60, pw: 1.50, rate: 4 },
  { id: 5, name: '橙', color: '#ff8a2a', dark: '#8c3a08', mult: 1.72, pw: 1.80, rate: 1 },
  { id: 6, name: '黑', color: '#3a3340', dark: '#0d0a12', mult: 1.85, pw: 2.00, rate: 0, god: true },
  { id: 7, name: '彩', color: '#ff7ad9', dark: '#3a2a7a', mult: 2.00, pw: 2.20, rate: 0, god: true },
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
  ice:     { name: '冰', color: '#8fdcff', atk: 21, cd: 1.20,
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
  // 品质按《三国演义》里的名气分：橙 = 家喻户晓的主角；金 = 一线名将、名士；紫 = 二线名将；蓝、绿 = 配角和不太出名的；白 = 开局的小人物
  // —— 白 ——
  H('liaohua',       '廖化',      0, 'shu', 'arrow',   '乱箭', '蜀中先锋'),
  H('zhoucang',      '周仓',      0, 'shu', 'blade',   '蛮力斩', '扛刀校尉'),
  H('peiyuan',       '裴元绍',     0, 'qun', 'fire',    '纵火', '山寨头目'),
  H('guanhai',       '管亥',      0, 'qun', 'poison',  '瘴气', '黄巾余部'),
  H('panfeng',       '潘凤',      0, 'qun', 'thunder', '惊雷斧', '无双上将'),
  H('xingdaorong',   '邢道荣',     0, 'qun', 'blade',   '零陵三斧', '零陵上将'),
  // —— 绿 ——
  H('zhangbao',      '张宝',      1, 'qun', 'thunder', '地公雷', '地公将军'),
  H('jiangqin',      '蒋钦',      1, 'wu',  'arrow',   '水寨连射', '江表虎臣'),
  H('mifang',        '糜芳',      1, 'shu', 'ice',     '寒刺', '南郡守将'),
  H('yuejin',        '乐进',      1, 'wei', 'blade',   '先登破阵', '五子良将'),
  H('lidian',        '李典',      1, 'wei', 'ice',     '冰锥牢笼', '儒雅之将'),
  H('handang',       '韩当',      1, 'wu',  'fire',    '火矢连珠', '江表虎臣'),
  H('wangping',      '王平',      1, 'shu', 'arrow',   '飞军弩阵', '无当飞军'),
  H('chengyuanzhi',  '程远志',     1, 'qun', 'blade',   '黄巾聚义', '黄巾渠帅'),
  // —— 蓝 ——
  H('fazheng',       '法正',      2, 'shu', 'poison',  '睚眦毒计', '蜀汉谋主'),
  H('caiwenji',      '蔡文姬',     2, 'qun', 'ice',     '悲歌凝霜', '胡笳才女'),
  H('liru',          '李儒',      2, 'qun', 'poison',  '鸩毒', '魔王之智'),
  H('guanping',      '关平',      2, 'shu', 'blade',   '承父志', '少年将军'),
  H('caohong',       '曹洪',      2, 'wei', 'arrow',   '疾射', '宗族悍将'),
  H('chengpu',       '程普',      2, 'wu',  'fire',    '烈焰', '江东宿将'),
  H('yujin',         '于禁',      2, 'wei', 'ice',     '毅重冰阵', '五子良将'),
  H('lingtong',      '凌统',      2, 'wu',  'wind',    '旋风突', '国士之风'),
  H('zhoutai',       '周泰',      2, 'wu',  'blade',   '不屈死战', '江表虎臣'),
  H('chengong',      '陈宫',      2, 'qun', 'poison',  '明策困兽', '吕布谋主'),
  H('madai',         '马岱',      2, 'shu', 'thunder', '背后一刀', '西凉骁将'),
  H('gongsunzan',    '公孙瓒',     2, 'qun', 'arrow',   '白马合围', '白马将军'),
  H('gaoshun',       '高顺',      2, 'qun', 'ice',     '陷阵营', '陷阵统领'),
  H('caochun',       '曹纯',      2, 'wei', 'wind',    '虎豹骑', '虎豹骑统领'),
  // —— 紫 ——
  H('ganning',       '甘宁',      3, 'wu',  'arrow',   '锦帆夜袭', '锦帆贼'),
  H('xuhuang',       '徐晃',      3, 'wei', 'blade',   '断粮斩', '周亚夫之风'),
  H('weiyan',        '魏延',      3, 'shu', 'fire',    '奇谋火', '镇北将军'),
  H('huanggai',      '黄盖',      3, 'wu',  'fire',    '苦肉火船', '江东老将'),
  H('jiaxu',         '贾诩',      3, 'qun', 'poison',  '乱武毒策', '毒士'),
  H('zhangjiao',     '张角',      3, 'qun', 'thunder', '太平雷法', '天公将军'),
  H('xiaoqiao',      '小乔',      3, 'wu',  'wind',    '天香舞风', '江东小乔'),
  H('daqiao',        '大乔',      3, 'wu',  'ice',     '国色凝霜', '江东大乔'),
  H('zhenji',        '甄姬',      3, 'wei', 'ice',     '洛神冰魄', '洛水之神'),
  H('zuoci',         '左慈',      3, 'qun', 'thunder', '遁甲天雷', '乌角先生'),
  H('xushu',         '徐庶',      3, 'shu', 'wind',    '巽风阵', '单福先生'),
  H('huaxiong',      '华雄',      3, 'qun', 'wind',    '骁骑风', '西凉都督'),
  H('zhanghe',       '张郃',      3, 'wei', 'wind',    '巧变移阵', '五子良将'),
  H('yanliang',      '颜良',      3, 'qun', 'blade',   '突阵', '河北上将'),
  H('wenchou',       '文丑',      3, 'qun', 'arrow',   '回马连珠', '河北上将'),
  H('menghuo',       '孟获',      3, 'qun', 'poison',  '驱象踏阵', '南蛮王'),
  // —— 金 ——
  H('machao',        '马超',      4, 'shu', 'thunder', '铁骑雷奔', '锦马超'),
  H('huangzhong',    '黄忠',      4, 'shu', 'arrow',   '百步穿杨', '老当益壮'),
  H('sunce',         '孙策',      4, 'wu',  'thunder', '霸王激昂', '小霸王'),
  H('luxun',         '陆逊',      4, 'wu',  'fire',    '火烧连营', '江东儒帅'),
  H('diaochan',      '貂蝉',      4, 'qun', 'poison',  '闭月离间', '闭月'),
  H('dianwei',       '典韦',      4, 'wei', 'blade',   '恶来双戟', '古之恶来'),
  H('xuchu',         '许褚',      4, 'wei', 'blade',   '裸衣狂斩', '虎痴'),
  H('zhangliao',     '张辽',      4, 'wei', 'wind',    '威震逍遥', '止啼之将'),
  H('pangtong',      '庞统',      4, 'shu', 'fire',    '铁索连环', '凤雏'),
  H('guojia',        '郭嘉',      4, 'wei', 'ice',     '遗计寒策', '鬼才'),
  H('taishici',      '太史慈',     4, 'wu',  'blade',   '天义斩', '信义笃烈'),
  H('sunshangxiang', '孙尚香',     4, 'wu',  'arrow',   '弓腰连珠', '弓腰姬'),
  H('dongzhuo',      '董卓',      4, 'qun', 'fire',    '火烧洛阳', '魔王'),
  H('xiahoudun',     '夏侯惇',     4, 'wei', 'blade',   '拔矢啖睛', '独眼将军'),
  // —— 橙 ——
  H('zhugeliang',    '诸葛亮',     5, 'shu', 'wind',    '借东风', '卧龙'),
  H('guanyu',        '关羽',      5, 'shu', 'blade',   '青龙偃月', '武圣'),
  H('zhangfei',      '张飞',      5, 'shu', 'thunder', '当阳怒吼', '万人敌'),
  H('zhaoyun',       '赵云',      5, 'shu', 'ice',     '龙胆寒枪', '常山赵子龙'),
  H('liubei',        '刘备',      5, 'shu', 'blade',   '仁德载世', '昭烈帝'),
  H('caocao',        '曹操',      5, 'wei', 'arrow',   '万箭齐发', '乱世奸雄'),
  H('lvbu',          '吕布',      5, 'qun', 'blade',   '无双乱舞', '飞将'),
  H('zhouyu',        '周瑜',      5, 'wu',  'fire',    '火烧赤壁', '美周郎'),
  H('simayi',        '司马懿',     5, 'wei', 'poison',  '鬼谋', '冢虎'),
  // —— 黑 / 彩（神将，暂未开放，rate 为 0 不会被抽到）——
  H('god_guanyu', '神·关羽', 6, 'shu', 'blade', '武神降世', '神将', { locked: true }),
  H('god_lvbu', '神·吕布', 6, 'qun', 'thunder', '神鬼无前', '神将', { locked: true }),
  H('god_zhuge', '神·诸葛亮', 7, 'shu', 'wind', '七星坛', '神将', { locked: true }),
  H('god_caocao', '神·曹操', 7, 'wei', 'poison', '归心', '神将', { locked: true }),
];
/* ============================================================
 * 兵器：每名武将可以装一件。和武将在同一个卡池里用招募令抽；用「精铁」强化（精铁通关给，抽到已有的兵器也会熔成精铁）。
 *   低品、重复的兵器熔成精铁，就是高品兵器的强化材料。
 *   q 品质（同武将品质）；type 样子（剑 刀 枪 弓 扇 戟 斧，只影响图标）
 *   eff 1 级时的加成：atk 攻击、spd 出手速度、crit 暴击率、rage 怒气获取、ult 大招伤害；每强化一级 +CFG.WEAPON_LV_STEP
 *   owner 专属武将：装在他身上时全部加成 × CFG.WEAPON_OWNER_MUL
 * 数值规划见《数值规划.md》第 6 节
 * ============================================================ */
const WEAPON_TYPES = { sword: '剑', blade: '刀', spear: '枪', bow: '弓', fan: '扇', halberd: '戟', axe: '斧', hammer: '锤', relic: '宝物' };
const WSTATS = { atk: '攻击', spd: '出手速度', crit: '暴击率', rage: '怒气获取', ult: '大招伤害' };
function Wp(id, name, q, type, eff, owner, desc) { return { id, name, q, type, eff, owner: owner || null, desc: desc || '' }; }
const WEAPONS = [
  Wp('tiejian',    '铁剑',       0, 'sword',   { atk: 0.04 }, null, '军中最常见的佩剑'),
  Wp('liegong',    '猎弓',       0, 'bow',     { spd: 0.04 }, null, '猎户用的短弓，胜在轻快'),
  Wp('podao',      '朴刀',       0, 'blade',   { atk: 0.03, crit: 0.02 }, null, '刀身厚重，砍得狠'),
  Wp('huanshou',   '环首刀',     1, 'blade',   { atk: 0.06 }, null, '汉军制式战刀'),
  Wp('zhemugong',  '柘木弓',     1, 'bow',     { spd: 0.06 }, null, '柘木做的良弓'),
  Wp('changmao',   '长矛',       1, 'spear',   { atk: 0.04, spd: 0.03 }, null, '一寸长一寸强'),
  Wp('bailian',    '百炼刀',     2, 'blade',   { atk: 0.09, crit: 0.03 }, null, '百炼钢打成，吹毛断发'),
  Wp('liannu',     '连弩',       2, 'bow',     { spd: 0.09, crit: 0.03 }, null, '一次上弦可以连发'),
  Wp('heyushan',   '鹤羽扇',     2, 'fan',     { atk: 0.07, rage: 0.12 }, null, '谋士手里的羽扇，运筹帷幄'),
  Wp('guding',     '古锭刀',     3, 'blade',   { atk: 0.13, crit: 0.05 }, 'sunce', '孙家世代相传的宝刀'),
  Wp('qilingong',  '麒麟弓',     3, 'bow',     { spd: 0.12, crit: 0.06 }, 'huangzhong', '百步穿杨的硬弓'),
  Wp('guanshifu',  '贯石斧',     3, 'axe',     { atk: 0.13, ult: 0.10 }, 'xuhuang', '大斧开山裂石'),
  Wp('qinglong',   '青龙偃月刀', 4, 'blade',   { atk: 0.18, ult: 0.15 }, 'guanyu', '重八十二斤，又名冷艳锯'),
  Wp('zhangba',    '丈八蛇矛',   4, 'spear',   { atk: 0.18, crit: 0.08 }, 'zhangfei', '矛头弯曲如蛇'),
  Wp('cixiong',    '雌雄双股剑', 4, 'sword',   { atk: 0.15, rage: 0.22 }, 'liubei', '一雌一雄，合为一鞘'),
  Wp('fangtian',   '方天画戟',   5, 'halberd', { atk: 0.24, spd: 0.10 }, 'lvbu', '人中吕布，戟中方天'),
  Wp('yitian',     '倚天剑',     5, 'sword',   { atk: 0.24, crit: 0.10 }, 'caocao', '倚天而立，削铁如泥'),
  Wp('baiyushan',  '白羽扇',     5, 'fan',     { atk: 0.20, ult: 0.25 }, 'zhugeliang', '羽扇纶巾，谈笑间樯橹灰飞烟灭'),
  // —— v1.5 新增 18 件：每个品质再加 3 件，多了「锤」和「宝物」（书、琴这类不是兵刃的东西）两类 ——
  Wp('chaifu',     '柴斧',       0, 'axe',     { atk: 0.04 }, null, '砍柴的斧头，抡起来也能要命'),
  Wp('zhuqiang',   '竹枪',       0, 'spear',   { atk: 0.02, spd: 0.03 }, null, '削尖的竹竿，黄巾军人手一根'),
  Wp('pushan',     '蒲扇',       0, 'fan',     { rage: 0.07 }, null, '摇着凉快，心也静些'),
  Wp('duanji',     '短戟',       1, 'halberd', { atk: 0.05, crit: 0.02 }, null, '单手使的小戟，也能掷出去'),
  Wp('tongchui',   '铜锤',       1, 'hammer',  { atk: 0.07 }, null, '实心铜锤，专砸盔甲'),
  Wp('bingshu',    '竹简兵书',   1, 'relic',   { atk: 0.03, rage: 0.10 }, null, '一卷翻旧了的兵法'),
  Wp('sanjian',    '三尖两刃刀', 2, 'blade',   { atk: 0.09, spd: 0.03 }, null, '刀头分三尖，两面开刃'),
  Wp('wugou',      '吴钩',       2, 'sword',   { spd: 0.07, crit: 0.05 }, null, '江东的弯刀，出手极快'),
  Wp('guduo',      '铁蒺藜骨朵', 2, 'hammer',  { atk: 0.10, crit: 0.02 }, null, '带刺的铁锤头，蛮王沙摩柯的兵器'),
  Wp('taiping',    '太平要术',   3, 'relic',   { atk: 0.11, ult: 0.14 }, 'zhangjiao', '南华老仙所授的三卷天书'),
  Wp('dunjia',     '遁甲天书',   3, 'relic',   { atk: 0.10, rage: 0.18 }, 'zuoci', '峨眉山石壁里得来的天书'),
  Wp('liuxing',    '流星锤',     3, 'hammer',  { atk: 0.12, crit: 0.07 }, null, '铁链拴着的锤头，百步之内指哪打哪'),
  Wp('hutou',      '虎头湛金枪', 4, 'spear',   { atk: 0.18, spd: 0.08 }, 'machao', '枪头如虎口吞刃，通体鎏金'),
  Wp('shuangji',   '双铁戟',     4, 'halberd', { atk: 0.18, ult: 0.15 }, 'dianwei', '一对重八十斤的大铁戟'),
  Wp('goulian',    '钩镰刀',     4, 'blade',   { atk: 0.16, spd: 0.10 }, 'zhangliao', '刀背带钩，专破骑兵'),
  Wp('liangyin',   '龙胆亮银枪', 5, 'spear',   { atk: 0.22, crit: 0.12 }, 'zhaoyun', '七进七出，枪下无一合之将'),
  Wp('jiaowei',    '焦尾琴',     5, 'relic',   { atk: 0.20, rage: 0.30 }, 'zhouyu', '曲有误，周郎顾'),
  Wp('qixing',     '七星宝刀',   5, 'blade',   { atk: 0.22, crit: 0.06, ult: 0.12 }, null, '镶着七颗宝石的短刀，曹操曾拿它去刺董卓'),
];
const WEAPON_MAP = {};
WEAPONS.forEach(w => { WEAPON_MAP[w.id] = w; });

const HERO_MAP = {};
HEROES.forEach((h, i) => { h.seed = i * 1.7; HERO_MAP[h.id] = h; });

const STARTER_HEROES = ['liaohua', 'zhoucang', 'peiyuan'];

/* 敌人：hp/atk 会按关卡与波次放大 */
const ENEMIES = {
  grunt:  { id: 'grunt', horde: true,  name: '黄巾兵', hp: 80,   spd: 38, atk: 6,  r: 13, coin: 1,  body: '#9a6b3a', hat: '#e2b53a' },
  shield: { id: 'shield', horde: true, name: '刀盾兵', hp: 170,  spd: 26, atk: 8,  r: 15, coin: 2,  body: '#6d7684', hat: '#4b525e' },
  rider:  { id: 'rider', horde: true,  name: '轻骑',   hp: 85,   spd: 72, atk: 10, r: 15, coin: 2,  body: '#a8543c', hat: '#5e2c20' },
  archer: { id: 'archer', horde: true, name: '弓手',   hp: 50,   spd: 34, atk: 7,  r: 12, coin: 2,  body: '#5d8a4c', hat: '#2f4a28', range: 150 },
  elite:  { id: 'elite',  name: '校尉',   hp: 460,  spd: 30, atk: 20, r: 19, coin: 8,  body: '#a83232', hat: '#d8b04a' },
  boss:   { id: 'boss',   name: '敌将',   hp: 2400, spd: 17, atk: 55, r: 34, coin: 50, body: '#3a3140', hat: '#b01f2a' },
  /* —— v1.3 新增：每章登场一种新敌人，各有各的打法 ——
   * from 第几关开始出现；tip 第一次出现时横幅上的一句提示
   * boom 冲到城下自爆（一次性伤害 = atk，自己也没了）；acd 攻击间隔（默认 1 秒）；push 击退系数；cc 被控时长系数；
   * res 各系伤害系数；aura 鼓舞周围敌人（移动、攻城都更快）；heal 给周围敌人回血；lob 远远地抛石头；support 不会攻城，只剩它们时自己溃逃 */
  sapper:   { id: 'sapper', horde: true,   name: '死士',   hp: 55,  spd: 82, atk: 34, r: 12, coin: 2,  body: '#7a2a22', hat: '#d83a2a', from: 11, boom: true, tip: '抱着火药桶冲城，到城下就炸——半路射死他' },
  ram:      { id: 'ram',      name: '冲车',   hp: 760, spd: 16, atk: 44, r: 22, coin: 10, body: '#6b4a2c', hat: '#3c2a1a', from: 21, acd: 2.2, push: 0.3, cc: 0.6, siege: true, tip: '又慢又硬，撞城墙很疼，很难推开——集火打掉' },
  drummer:  { id: 'drummer',  name: '鼓手',   hp: 130, spd: 32, atk: 0,  r: 13, coin: 4,  body: '#8a3a5a', hat: '#e0c060', from: 31, range: 215, aura: 150, support: true, tip: '躲在后面擂鼓，周围的敌人走得更快、砍得更勤' },
  heavy:    { id: 'heavy', horde: true,    name: '重甲兵', hp: 330, spd: 24, atk: 12, r: 16, coin: 4,  body: '#4a5262', hat: '#2c3240', from: 41, push: 0.45, cc: 0.5, res: { arrow: 0.7, blade: 0.8, thunder: 1.3 }, tip: '一身铁甲：推不太动、控不太住，弓和刀打他打折，怕雷' },
  catapult: { id: 'catapult', name: '投石车', hp: 420, spd: 15, atk: 60, r: 21, coin: 10, body: '#70522e', hat: '#3c2a1a', from: 51, range: 320, acd: 4.5, lob: true, push: 0.3, cc: 0.6, siege: true, tip: '停在老远的地方往城墙上砸石头，要靠能打到阵后的大招' },
  rattan:   { id: 'rattan', horde: true,   name: '藤甲兵', hp: 210, spd: 36, atk: 10, r: 14, coin: 3,  body: '#b08a3a', hat: '#7a5a22', from: 61, res: { blade: 0.6, arrow: 0.6, fire: 2 }, tip: '藤甲刀枪不入：刃、弓伤害打六折，但是一点就着——用火' },
  shaman:   { id: 'shaman',   name: '巫医',   hp: 120, spd: 30, atk: 5,  r: 13, coin: 5,  body: '#5a3a7a', hat: '#c8d0a0', from: 61, range: 200, acd: 1.6, heal: 140, tip: '躲在后面给周围的敌人治伤——先杀他' },
};
/* 各章敌将的招式（放一次要 cd 秒；写在 battle.js 的 BOSS_CAST 里） */
const BOSS_SKILLS = [
  { name: '黄巾聚义', cd: 9,  desc: '每 9 秒喊来 4 个黄巾兵' },
  { name: '暴虐',     cd: 11, desc: '每 11 秒一声怒喝，全场敌人 3.5 秒内走得更快、砍得更勤' },
  { name: '突阵',     cd: 9,  desc: '每 9 秒策马猛冲一段，冲锋时不吃减速和击退' },
  { name: '连珠箭',   cd: 7,  desc: '每 7 秒隔着老远朝城墙连射 3 箭' },
  { name: '拔矢啖睛', cd: 0,  desc: '血量掉到一半时暴怒：攻击、速度大涨，4 秒内不吃控制' },
  { name: '陷阵',     cd: 10, desc: '每 10 秒给身边的敌人架起盾阵，4 秒内受到的伤害减半' },
  { name: '藤甲军',   cd: 10, desc: '每 10 秒召来 3 个藤甲兵' },
  { name: '虎豹骑',   cd: 9,  desc: '每 9 秒召来 3 骑狂奔的虎豹骑' },
  { name: '不死',     cd: 0,  desc: '第一次倒下后以四成血量爬起来再战' },
];
function bossSkill(stage) { return BOSS_SKILLS[Math.min(BOSS_SKILLS.length, Math.floor((stage - 1) / 10) + 1) - 1]; }
/* 这一关第一次登场的新敌人（没有就是 null） */
function newEnemyAt(stage) { for (const k in ENEMIES) if (ENEMIES[k].from === stage) return ENEMIES[k]; return null; }

/* 各章敌将；立绘是 assets/enemies/boss_<章>.png（第 9 章起用 boss_9）。
 * hero：这名敌将也是卡池里能抽到的武将，所以站在对面的是他的「心魔」（一身黑紫气焰的影子），名字前面加「心魔·」 */
const CHAPTERS = [
  { name: '黄巾之乱', boss: '程远志', hero: 'chengyuanzhi' },
  { name: '讨伐董卓', boss: '董卓',   hero: 'dongzhuo' },
  { name: '群雄割据', boss: '颜良',   hero: 'yanliang' },
  { name: '官渡之战', boss: '文丑',   hero: 'wenchou' },
  { name: '火烧赤壁', boss: '夏侯惇', hero: 'xiahoudun' },
  { name: '三分天下', boss: '高顺',   hero: 'gaoshun' },
  { name: '七擒孟获', boss: '孟获',   hero: 'menghuo' },
  { name: '北伐中原', boss: '曹纯',   hero: 'caochun' },
];
function chapterOf(stage) {
  const idx = Math.floor((stage - 1) / 10);
  const c = CHAPTERS[idx] || { name: '乱世无尽', boss: '幽冥鬼将' };
  // 也是武将的敌将，站在对面的是他的「心魔」
  return { index: idx + 1, name: c.name, boss: c.hero ? '心魔·' + c.boss : c.boss, who: c.boss, hero: c.hero || null, sub: ((stage - 1) % 10) + 1 };
}

/* ============================================================
 * 数值规划（详见《数值规划.md》）
 * 做法：先定每章打完时玩家该有多强（战力预算），敌人强度、推荐战力都从这张表算出来；
 *       再用不带画面的模拟器（tools/sim/）校准，让「战力 = 推荐战力」时挂机胜率约六成。
 * ============================================================ */
/* 每章最后一关的战力预算（第 0 项 = 开局）。章内按等比插值；第 8 章之后每关 +3% */
const STAGE_POWER = [250, 1800, 4200, 7900, 12700, 19100, 27500, 36100, 50600];   // v1.7 品质压平后重算（模拟算出来前两章是 2000、4400，放宽一些：新手期不卡人）
function stagePower(stage) {
  const n = STAGE_POWER.length - 1, s = Math.max(1, stage);
  if (s >= n * 10) return STAGE_POWER[n] * Math.pow(1.03, s - n * 10);
  const c = Math.floor((s - 1) / 10), f = (s - c * 10) / 10;
  return STAGE_POWER[c] * Math.pow(STAGE_POWER[c + 1] / STAGE_POWER[c], f);
}
/* 敌人血量 ÷ 战力预算：模拟器校准出来的系数（第 1 … 80 关取 12 个点），中间按对数插值。
 * 重新校准：node tools/sim/calibrate.js，把输出的这一行贴回来 */
const HP_PER_POWER = [[1, 0.0060], [10, 0.0054], [20, 0.0049], [30, 0.0042], [40, 0.0038], [50, 0.0039], [60, 0.0043], [70, 0.0046], [80, 0.0048]];   // v1.8 割草 + 击杀回怒之后重新校准，目标：战力达标时挂机胜率七成半（原来六成）
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
function stageIron(stage)        { return 2 + Math.floor(stage / 5); }   // 通关给的精铁，强化兵器用（重复通关同样打折；战败按打过的波数给三成）

/* 生成一波敌人：返回按出场时间排序的 [{t, type, x}] */
function genWave(stage, wave) {
  const n = Math.round((10 + wave * 2.2 + Math.min(stage, 40) * 0.6) * CFG.HORDE);   // 每波人数：第 40 关以后不再加人（最多 76），后面靠血量变强
  const pool = [['grunt', 10]];
  if (stage >= 2 || wave >= 4) pool.push(['shield', 3]);
  if (stage >= 3 || wave >= 6) pool.push(['rider', 3]);
  if ((stage >= 2 && wave >= 2) || wave >= 7) pool.push(['archer', 3]);
  if (stage >= 4 && wave >= 4) pool.push(['elite', 1]);
  const ch = Math.floor((stage - 1) / 10) + 1;                          // 第几章
  if (stage >= ENEMIES.sapper.from && wave >= 2) pool.push(['sapper', 1.5]);
  if (stage >= ENEMIES.heavy.from) pool.push(['heavy', 2.5]);
  if (stage >= ENEMIES.rattan.from) pool.push(['rattan', ch === 7 ? 5 : 2]);   // 第 7 章（七擒孟获）藤甲兵是主力，之后只是掺着来
  const total = pool.reduce((s, p) => s + p[1], 0);
  const dur = 4 + n * 0.1 / CFG.HORDE;                                // 人多了，出场的时间不拉长
  const list = [];
  for (let i = 0; i < n; i++) {
    let r = Math.random() * total, type = 'grunt';
    for (const p of pool) { if ((r -= p[1]) <= 0) { type = p[0]; break; } }
    list.push({ t: Math.random() * dur, type, x: 56 + Math.random() * 428 });
  }
  // 器械和后排：数量是定好的，不靠随机——冲车、投石车隔几波来一辆，鼓手、巫医每波一两个
  const add = (type, k, t0) => { for (let i = 0; i < k; i++) list.push({ t: t0 + Math.random() * dur * 0.6, type, x: 90 + Math.random() * 360 }); };
  if (stage >= ENEMIES.ram.from && wave % 3 === 0) add('ram', stage >= 51 ? 2 : 1, 1);
  if (stage >= ENEMIES.drummer.from && wave >= 2) add('drummer', wave >= 7 ? 2 : 1, 0.5);
  if (stage >= ENEMIES.catapult.from && wave % 3 === 1 && wave >= 4) add('catapult', wave === CFG.WAVES ? 2 : 1, 2);
  if (stage >= ENEMIES.shaman.from && wave >= 3) add('shaman', wave >= 8 ? 2 : 1, 1);
  if (wave % 5 === 0 && wave < CFG.WAVES) list.push({ t: 1.5, type: 'elite', x: 270 });
  if (wave === CFG.WAVES) list.push({ t: 2.5, type: 'boss', x: 270 });
  list.sort((a, b) => a.t - b.t);
  return { list, dur };
}

/* ---------------- 站位：5 个位置各有职责 ---------------- */
const SLOT_ROLES = [
  { name: '左翼', desc: '弓、火、毒、雷系出手速度 +15%', els: ['arrow', 'fire', 'poison', 'thunder'], spd: 0.15 },
  { name: '前锋', desc: '刃、风、冰系攻击 +15%', els: ['blade', 'wind', 'ice'], atk: 0.15 },
  { name: '主帅', desc: '全军攻击 +星级×3%（零星 0% … 五星 15%），本人怒气获取 +20%', leader: true },
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

/* ---------------- 属性共鸣：同一种攻击类型上阵 3 / 4 / 5 人，该系伤害提高（下标 = 人数） ---------------- */
const ELEMENT_BOND = [0, 0, 0, 0.20, 0.30, 0.40];

/* ---------------- 缘分：指定武将同时上阵（need = 至少几人；must = 其中这一个必须在阵） ---------------- */
const COMBOS = [
  { name: '蜀汉旧将', ids: ['liaohua', 'zhoucang', 'guanping'], need: 2, desc: '全军攻击 +8%', eff: { atk: 0.08 } },
  { name: '黄巾起义', ids: ['zhangjiao', 'zhangbao', 'guanhai', 'peiyuan', 'chengyuanzhi'], need: 3, desc: '全军攻击 +18%', eff: { atk: 0.18 } },
  { name: '关氏父子', ids: ['guanyu', 'guanping', 'zhoucang'], need: 2, desc: '刃系伤害 +25%', eff: { el: { blade: 0.25 } } },
  { name: '五虎上将', ids: ['guanyu', 'zhangfei', 'zhaoyun', 'huangzhong', 'machao'], need: 3, desc: '全军攻击 +10%、暴击率 +10%', eff: { atk: 0.10, crit: 0.10 } },
  { name: '长沙旧部', ids: ['huangzhong', 'weiyan'], need: 2, desc: '弓、火系伤害 +25%', eff: { el: { arrow: 0.25, fire: 0.25 } } },
  { name: '荆襄名士', ids: ['zhugeliang', 'xushu'], need: 2, desc: '风系伤害 +35%', eff: { el: { wind: 0.35 } } },
  { name: '赤壁之盟', ids: ['zhugeliang', 'zhouyu'], need: 2, desc: '大招伤害 +15%、怒气获取 +8%', eff: { ult: 0.15, rage: 0.08 } },
  { name: '江东双璧', ids: ['zhouyu', 'luxun'], need: 2, desc: '火系伤害 +28%', eff: { el: { fire: 0.28 } } },
  { name: '江表虎臣', ids: ['ganning', 'taishici', 'chengpu', 'huanggai', 'lingtong', 'jiangqin', 'zhoutai', 'handang'], need: 2, desc: '全军攻击 +12%', eff: { atk: 0.12 } },
  { name: '魏之谋主', ids: ['caocao', 'simayi', 'jiaxu', 'guojia'], need: 2, desc: '大招伤害 +30%', eff: { ult: 0.30 } },
  { name: '曹氏宗亲', ids: ['caocao', 'caohong', 'xiahoudun', 'caochun'], need: 2, desc: '城防上限 +25%', eff: { wall: 0.25 } },
  { name: '五子良将', ids: ['zhangliao', 'xuhuang', 'yujin', 'yuejin', 'zhanghe'], need: 2, desc: '全军出手速度 +10%', eff: { spd: 0.10 } },
  { name: '并州旧部', ids: ['lvbu', 'zhangliao', 'gaoshun'], need: 2, desc: '全军出手速度 +12%', eff: { spd: 0.12 } },
  { name: '西凉董营', ids: ['huaxiong', 'liru', 'lvbu', 'jiaxu', 'dongzhuo'], need: 2, desc: '毒、风系伤害 +30%', eff: { el: { poison: 0.30, wind: 0.30 } } },
  { name: '乱世才女', ids: ['caiwenji', 'zhenji'], need: 2, desc: '冰系伤害 +25%、怒气获取 +10%', eff: { el: { ice: 0.25 }, rage: 0.10 } },
  { name: '天公地公', ids: ['zhangjiao', 'zhangbao', 'panfeng'], need: 2, desc: '雷系伤害 +30%', eff: { el: { thunder: 0.30 } } },
  // —— v1.0 新增 ——
  { name: '桃园结义', ids: ['liubei', 'guanyu', 'zhangfei'], need: 3, desc: '全军攻击 +15%、怒气获取 +15%', eff: { atk: 0.15, rage: 0.15 } },
  { name: '卧龙凤雏', ids: ['zhugeliang', 'pangtong'], need: 2, desc: '大招伤害 +20%', eff: { ult: 0.20 } },
  { name: '长坂救主', ids: ['liubei', 'zhaoyun'], need: 2, desc: '冰系伤害 +25%、城防上限 +10%', eff: { el: { ice: 0.25 }, wall: 0.10 } },
  { name: '定军山',   ids: ['fazheng', 'huangzhong'], need: 2, desc: '弓、毒系伤害 +25%', eff: { el: { arrow: 0.25, poison: 0.25 } } },
  { name: '孙刘联姻', ids: ['liubei', 'sunshangxiang'], need: 2, desc: '城防上限 +20%、全军攻击 +6%', eff: { wall: 0.20, atk: 0.06 } },
  { name: '江东二乔', ids: ['daqiao', 'xiaoqiao'], need: 2, desc: '冰、风系伤害 +25%', eff: { el: { ice: 0.25, wind: 0.25 } } },
  { name: '总角之交', ids: ['sunce', 'zhouyu'], need: 2, desc: '火、雷系伤害 +20%', eff: { el: { fire: 0.20, thunder: 0.20 } } },
  { name: '孙氏兄妹', ids: ['sunce', 'sunshangxiang'], need: 2, desc: '全军出手速度 +12%', eff: { spd: 0.12 } },
  { name: '苦肉计',   ids: ['huanggai', 'zhouyu'], need: 2, desc: '火系伤害 +20%', eff: { el: { fire: 0.20 } } },
  { name: '虎卫双雄', ids: ['dianwei', 'xuchu'], need: 2, desc: '刃系伤害 +25%、城防上限 +10%', eff: { el: { blade: 0.25 }, wall: 0.10 } },
  { name: '凤仪亭',   ids: ['diaochan', 'lvbu'], need: 2, desc: '全军暴击率 +12%', eff: { crit: 0.12 } },
  { name: '奇门遁甲', ids: ['zuoci', 'zhangjiao'], need: 2, desc: '雷系伤害 +25%、怒气获取 +10%', eff: { el: { thunder: 0.25 }, rage: 0.10 } },
  { name: '两员上将', ids: ['xingdaorong', 'panfeng'], need: 2, desc: '全军攻击 +12%', eff: { atk: 0.12 } },
  // —— v1.1 新增：让紫、金、橙武将之间多一些搭配（must = 这名武将必须在阵）——
  { name: '虎牢关',   ids: ['lvbu', 'liubei', 'guanyu', 'zhangfei'], need: 3, must: 'lvbu', desc: '全军暴击率 +10%、攻击 +6%', eff: { crit: 0.10, atk: 0.06 } },
  { name: '神亭酣战', ids: ['taishici', 'sunce'], need: 2, desc: '刃、雷系伤害 +20%', eff: { el: { blade: 0.20, thunder: 0.20 } } },
  { name: '宛城护主', ids: ['dianwei', 'caocao'], need: 2, desc: '刃系伤害 +15%、城防上限 +15%', eff: { el: { blade: 0.15 }, wall: 0.15 } },
  { name: '裸衣斗马超', ids: ['xuchu', 'machao'], need: 2, desc: '全军出手速度 +10%', eff: { spd: 0.10 } },
  { name: '鬼才毒士', ids: ['guojia', 'jiaxu'], need: 2, desc: '冰、毒系伤害 +25%', eff: { el: { ice: 0.25, poison: 0.25 } } },
  { name: '空城对弈', ids: ['zhugeliang', 'simayi'], need: 2, desc: '风、毒系伤害 +20%、大招伤害 +10%', eff: { el: { wind: 0.20, poison: 0.20 }, ult: 0.10 } },
  { name: '琴瑟和鸣', ids: ['zhouyu', 'xiaoqiao'], need: 2, desc: '火、风系伤害 +20%', eff: { el: { fire: 0.20, wind: 0.20 } } },
  { name: '江东伉俪', ids: ['sunce', 'daqiao'], need: 2, desc: '雷、冰系伤害 +20%', eff: { el: { thunder: 0.20, ice: 0.20 } } },
  { name: '铜雀台',   ids: ['caocao', 'daqiao', 'xiaoqiao', 'zhenji'], need: 2, must: 'caocao', desc: '怒气获取 +15%', eff: { rage: 0.15 } },
  { name: '白马解围', ids: ['guanyu', 'zhangliao'], need: 2, desc: '刃、风系伤害 +20%', eff: { el: { blade: 0.20, wind: 0.20 } } },
  { name: '战长沙',   ids: ['guanyu', 'huangzhong'], need: 2, desc: '刃、弓系伤害 +20%', eff: { el: { blade: 0.20, arrow: 0.20 } } },
  { name: '入主西川', ids: ['liubei', 'pangtong', 'fazheng'], need: 2, desc: '火、毒系伤害 +20%、怒气获取 +10%', eff: { el: { fire: 0.20, poison: 0.20 }, rage: 0.10 } },
  { name: '掷杯戏曹', ids: ['zuoci', 'caocao'], need: 2, desc: '雷、弓系伤害 +20%', eff: { el: { thunder: 0.20, arrow: 0.20 } } },
  { name: '逍遥津',   ids: ['zhangliao', 'ganning', 'lingtong'], need: 2, desc: '风、弓系伤害 +20%', eff: { el: { wind: 0.20, arrow: 0.20 } } },
  { name: '孙陆联姻', ids: ['luxun', 'sunce'], need: 2, desc: '全军暴击率 +8%、怒气获取 +8%', eff: { crit: 0.08, rage: 0.08 } },
  { name: '国舅',     ids: ['mifang', 'liubei'], need: 2, desc: '城防上限 +12%', eff: { wall: 0.12 } },
  { name: '倾国倾城', ids: ['diaochan', 'zhenji', 'daqiao', 'xiaoqiao', 'caiwenji', 'sunshangxiang'], need: 3, desc: '怒气获取 +10%、全军出手速度 +6%', eff: { rage: 0.10, spd: 0.06 } },
  // —— v1.2 新增：蓝绿卡池的新武将也有自己的缘分 ——
  { name: '合肥守将', ids: ['zhangliao', 'yuejin', 'lidian'], need: 2, desc: '城防上限 +12%、全军攻击 +6%', eff: { wall: 0.12, atk: 0.06 } },
  { name: '白马义从', ids: ['gongsunzan', 'zhaoyun'], need: 2, desc: '弓、冰系伤害 +25%', eff: { el: { arrow: 0.25, ice: 0.25 } } },
  { name: '卢植门生', ids: ['gongsunzan', 'liubei'], need: 2, desc: '全军攻击 +8%', eff: { atk: 0.08 } },
  { name: '白门楼',   ids: ['chengong', 'lvbu', 'gaoshun'], need: 2, desc: '毒、刃系伤害 +25%', eff: { el: { poison: 0.25, blade: 0.25 } } },
  { name: '捉放曹',   ids: ['chengong', 'caocao'], need: 2, desc: '毒、弓系伤害 +20%', eff: { el: { poison: 0.20, arrow: 0.20 } } },
  { name: '西凉马氏', ids: ['madai', 'machao'], need: 2, desc: '雷系伤害 +30%', eff: { el: { thunder: 0.30 } } },
  { name: '谁敢杀我', ids: ['madai', 'weiyan'], need: 2, desc: '雷、火系伤害 +20%', eff: { el: { thunder: 0.20, fire: 0.20 } } },
  { name: '北伐诸将', ids: ['wangping', 'liaohua', 'madai', 'weiyan'], need: 2, desc: '全军攻击 +10%', eff: { atk: 0.10 } },
  { name: '江贼归顺', ids: ['zhoutai', 'jiangqin'], need: 2, desc: '刃、弓系伤害 +20%', eff: { el: { blade: 0.20, arrow: 0.20 } } },
  { name: '三朝老臣', ids: ['handang', 'chengpu', 'huanggai'], need: 2, desc: '火系伤害 +25%', eff: { el: { fire: 0.25 } } },
  { name: '瓦口关',   ids: ['zhanghe', 'zhangfei'], need: 2, desc: '风、雷系伤害 +20%', eff: { el: { wind: 0.20, thunder: 0.20 } } },
  { name: '街亭',     ids: ['zhanghe', 'simayi', 'wangping'], need: 2, desc: '风、毒、弓系伤害 +20%', eff: { el: { wind: 0.20, poison: 0.20, arrow: 0.20 } } },
  // —— v1.4 新增：收服来的敌将 ——
  { name: '河北双雄', ids: ['yanliang', 'wenchou'], need: 2, desc: '刃、弓系伤害 +25%', eff: { el: { blade: 0.25, arrow: 0.25 } } },
  { name: '连环计',   ids: ['dongzhuo', 'diaochan', 'lvbu'], need: 2, must: 'dongzhuo', desc: '火、毒系伤害 +20%、全军暴击率 +6%', eff: { el: { fire: 0.20, poison: 0.20 }, crit: 0.06 } },
  { name: '七擒七纵', ids: ['menghuo', 'zhugeliang'], need: 2, desc: '毒、风系伤害 +25%', eff: { el: { poison: 0.25, wind: 0.25 } } },
  { name: '斩将夺旗', ids: ['guanyu', 'yanliang', 'wenchou'], need: 2, must: 'guanyu', desc: '刃系伤害 +20%、全军暴击率 +6%', eff: { el: { blade: 0.20 }, crit: 0.06 } },
  { name: '虎豹骑',   ids: ['caochun', 'xiahoudun', 'caocao'], need: 2, must: 'caochun', desc: '风、刃系伤害 +20%', eff: { el: { wind: 0.20, blade: 0.20 } } },
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
