// 校准敌人血量：对每个关卡，按进度规划造一批真实抽卡出来的存档（最强 5 人上阵，等级调到战力 = 这关的战力预算），
// 二分查找血量系数 k（敌人血量 = k × 战力预算），使挂机（不投石、自动放大招）胜率约为 TARGET。
// 用法：node tools/sim/calibrate.js   → 输出 data.js 里的 HP_PER_POWER 一行
//       CAL_STAGES=40,50 node tools/sim/calibrate.js   只校准这几关（可以开几个进程分着跑）
const { load, fight, account, levelTo, planAt } = require('./harness.js');
const TARGET = 0.75, ACCOUNTS = 16, REPEAT = 2, STAGES = process.env.CAL_STAGES ? process.env.CAL_STAGES.split(',').map(Number) : [1, 3, 5, 10, 15, 20, 30, 40, 50, 60, 70, 80];
let K = 0.005, PW = 1000;
const patch = (G, ctx) => { ctx.stageHpMul = (stage, wave) => K * PW * (1 + 0.07 * (wave - 1)); };
function winRate(s, accs, k) {
  let w = 0, n = 0;
  for (const G of accs) for (let r = 0; r < REPEAT; r++) { const D = G.Save.data, st = D.stage; K = k; PW = G.stagePower(s); if (fight(G, s, false).win) w++; n++; D.stage = st; }
  return w / n;
}
const out = [];
for (const s of STAGES) {
  const accs = [], lvs = [];
  for (let i = 0; i < ACCOUNTS; i++) {
    const G = s <= 2 ? load(patch) : account(planAt(s).draws, 1, patch, planAt(s).iron, s);      // 第 1、2 关：还没抽卡，只有开局送的三个人
    lvs.push(s <= 2 ? 1 : levelTo(G, G.stagePower(s))); accs.push(G);
  }
  const P = accs[0].stagePower(s), avgP = accs.reduce((a, G) => a + G.teamPower(), 0) / accs.length, avgL = lvs.reduce((a, v) => a + v, 0) / lvs.length;
  let lo = 0.0005, hi = 0.05;
  for (let it = 0; it < 9; it++) { const mid = Math.sqrt(lo * hi); if (winRate(s, accs, mid) >= TARGET) lo = mid; else hi = mid; }
  const k = Math.sqrt(lo * hi);
  out.push([s, Number(k.toPrecision(3))]);
  console.error(`stage ${s}: 预算 ${Math.round(P)}  阵容平均战力 ${Math.round(avgP)} 等级 ${avgL.toFixed(0)}  k=${k.toPrecision(3)}  胜率 ${winRate(s, accs, k).toFixed(2)}  血量×0.8 ${winRate(s, accs, k * 0.8).toFixed(2)}  ×1.25 ${winRate(s, accs, k * 1.25).toFixed(2)}`);
}
console.log('const HP_PER_POWER = ' + JSON.stringify(out).replace(/,/g, ', ').replace(/\], \[/g, '], [') + ';');
