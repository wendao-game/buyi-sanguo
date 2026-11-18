// 无尽关的长线节奏（估算，不打仗）：一个武将、兵器都养满的玩家，每天打若干局、领军饷、扫荡，金币全投「练兵」，精铁全投「筑城」，
// 看多少天能打到无尽第几层。判断「打得过」用战力达标（战力 ≥ 这一层的推荐战力）。
// 用法：node tools/sim/endless.js [每天打几局=12] [养满时的战力=126000] [看多少天=365]
// 改了 CFG.TECH 的花费、每层 +3% 的系数、通关金币之后跑一遍，看曲线是不是「一直能涨、越来越慢」。
const { load } = require('./harness.js');
const G = load(), c = G.ctx, D = G.Save.data;
const PER_DAY = Number(process.argv[2] || 12), P0 = Number(process.argv[3] || 126000), DAYS = Number(process.argv[4] || 365);
const T = {}; G.CFG.TECH.forEach(t => { T[t.id] = t; });
let lv = { atk: 0, wall: 0, ult: 0 }, coins = 0, iron = 0, floor = 0, day = 0;
const power = () => P0 * (1 + T.atk.per * lv.atk) * (1 + T.ult.per * lv.ult * 0.3 + T.wall.per * lv.wall * 0.2);
const cost = id => Math.round(T[id].base * Math.pow(T[id].grow, lv[id]));
const climb = () => { while (power() >= G.stagePower(80 + floor + 1)) floor++; };
climb(); console.log(`养满（战力 ${P0}）不靠科技：无尽第 ${floor} 层`);
const marks = [7, 14, 30, 60, 90, 180, 365, 730].filter(d => d <= DAYS), seen = {};
const want = [50, 60, 70, 80, 100];
for (day = 1; day <= DAYS; day++) {
  const st = 80 + Math.max(1, floor), win = c.stageWinCoins(st) * G.CFG.REPLAY_COIN, wiron = c.stageIron(st) * G.CFG.REPLAY_COIN;
  coins += win * PER_DAY + c.sweepReward(st) * G.CFG.SWEEP_DAILY + c.stageWinCoins(st) * G.CFG.DAILY.coinK;
  iron += wiron * PER_DAY + c.stageIron(st) * (G.CFG.SWEEP_DAILY + G.CFG.DAILY.ironK);
  while (coins >= cost('atk')) { coins -= cost('atk'); lv.atk++; }
  while (iron >= cost('wall')) { iron -= cost('wall'); lv.wall++; }
  climb();
  want.forEach(f => { if (floor >= f && !seen[f]) { seen[f] = day; console.log(`第 ${String(day).padStart(3)} 天 打到第 ${f} 层   练兵 ${lv.atk} 级、筑城 ${lv.wall} 级，战力 ${Math.round(power())}`); } });
  if (marks.includes(day)) console.log(`第 ${String(day).padStart(3)} 天 第 ${floor} 层   练兵 ${lv.atk}、筑城 ${lv.wall}，下一级练兵要 ${cost('atk')} 金币（一天进账约 ${Math.round(win * PER_DAY + c.sweepReward(st) * G.CFG.SWEEP_DAILY + c.stageWinCoins(st) * G.CFG.DAILY.coinK)}）`);
}
