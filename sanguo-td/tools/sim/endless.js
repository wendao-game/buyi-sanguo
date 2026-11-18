// 无尽关的长线节奏（估算，不打仗）：一个五名橙将都 100 级 5 星、兵器 +20 的玩家，每天打若干局、领军饷、扫荡，
// 金币在「练兵」和「全队再升一级」里挑划算的投（武将等级没有上限），精铁全投「筑城」，
// 看多少天能打到无尽第几层。判断「打得过」用战力达标（战力 ≥ 这一层的推荐战力）。
// 用法：node tools/sim/endless.js [每天打几局=12] [100 级时的战力=126000] [看多少天=365] [nolv = 不升等级，只看科技]
// 改了 CFG.TECH 的花费、每层 +3% 的系数、通关金币之后跑一遍，看曲线是不是「一直能涨、越来越慢」。
const { load } = require('./harness.js');
const G = load(), c = G.ctx, D = G.Save.data;
const PER_DAY = Number(process.argv[2] || 12), P0 = Number(process.argv[3] || 126000), DAYS = Number(process.argv[4] || 365);
const T = {}; G.CFG.TECH.forEach(t => { T[t.id] = t; });
const NOLV = process.argv[5] === 'nolv', QK = 1 + 5 * 0.25;   // 五个橙将
let lv = { atk: 0, wall: 0, ult: 0 }, L = 100, coins = 0, iron = 0, floor = 0, day = 0;
const lvMul = l => 1 + 0.08 * (l - 1), lvCost = l => 5 * Math.floor(G.CFG.LEVEL_COST * Math.pow(l, G.CFG.LEVEL_COST_POW) * QK);   // 全队五人各升一级
const power = () => P0 * lvMul(L) / lvMul(100) * (1 + T.atk.per * lv.atk) * (1 + T.ult.per * lv.ult * 0.3 + T.wall.per * lv.wall * 0.2);
const cost = id => Math.round(T[id].base * Math.pow(T[id].grow, lv[id]));
const climb = () => { while (power() >= G.stagePower(80 + floor + 1)) floor++; };
climb(); console.log(`100 级 5 星、兵器 +20（战力 ${P0}），不点科技：无尽第 ${floor} 层`);
const marks = [7, 14, 30, 60, 90, 180, 365, 730].filter(d => d <= DAYS), seen = {};
const want = [50, 60, 70, 80, 90, 100, 120];
for (day = 1; day <= DAYS; day++) {
  const st = 80 + Math.max(1, floor), win = c.stageWinCoins(st) * G.CFG.REPLAY_COIN, wiron = c.stageIron(st) * G.CFG.REPLAY_COIN;
  coins += win * PER_DAY + c.sweepReward(st) * G.CFG.SWEEP_DAILY + c.stageWinCoins(st) * G.CFG.DAILY.coinK;
  iron += wiron * PER_DAY + c.stageIron(st) * (G.CFG.SWEEP_DAILY + G.CFG.DAILY.ironK);
  for (;;) {   // 哪个每金币涨的战力多就买哪个
    const ea = T.atk.per / (1 + T.atk.per * lv.atk) / cost('atk'), el = NOLV ? 0 : 0.08 / lvMul(L) / lvCost(L);
    if (ea >= el) { if (coins < cost('atk')) break; coins -= cost('atk'); lv.atk++; } else { if (coins < lvCost(L)) break; coins -= lvCost(L); L++; }
  }
  while (iron >= cost('wall')) { iron -= cost('wall'); lv.wall++; }
  climb();
  want.forEach(f => { if (floor >= f && !seen[f]) { seen[f] = day; console.log(`第 ${String(day).padStart(3)} 天 打到第 ${f} 层   武将 ${L} 级、练兵 ${lv.atk} 级、筑城 ${lv.wall} 级，战力 ${Math.round(power())}`); } });
  if (marks.includes(day)) console.log(`第 ${String(day).padStart(3)} 天 第 ${floor} 层   武将 ${L} 级、练兵 ${lv.atk}、筑城 ${lv.wall}，全队升一级要 ${lvCost(L)}、下一级练兵要 ${cost('atk')} 金币（一天进账约 ${Math.round(win * PER_DAY + c.sweepReward(st) * G.CFG.SWEEP_DAILY + c.stageWinCoins(st) * G.CFG.DAILY.coinK)}）`);
}
