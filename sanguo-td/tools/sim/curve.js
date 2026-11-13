// 验证「推荐战力」准不准：对每个关卡造一批真实抽卡出来的存档（抽卡数按《数值规划.md》的规划），
// 把等级调到战力 = 推荐战力 × 0.6 / 0.8 / 1 / 1.2 / 1.5，按游戏里真实的敌人数值各打几局，看挂机胜率。
// 用法：node tools/sim/curve.js [关卡，逗号分隔=10,20,30,40,50,60,70,80] [每档多少份存档=14] [rock=会投石]
const { fight, account, levelTo, planAt } = require('./harness.js');
const STAGES = (process.argv[2] || '10,20,30,40,50,60,70,80').split(',').map(Number), N = Number(process.argv[3] || 14), rocks = process.argv[4] === 'rock';
const RATIOS = [0.6, 0.8, 1, 1.2, 1.5];
for (const s of STAGES) {
  const accs = []; for (let i = 0; i < N; i++) accs.push(account(planAt(s).draws, 1, null, planAt(s).iron, s));
  const P = accs[0].stagePower(s), cells = [];
  for (const r of RATIOS) {
    let w = 0, n = 0, lvs = 0;
    for (const G of accs) {
      const D = G.Save.data; lvs += levelTo(G, P * r);
      for (let k = 0; k < 2; k++) { const st = D.stage; if (fight(G, s, rocks).win) w++; n++; D.stage = st; }
    }
    cells.push(`×${r} 胜率 ${String(Math.round(w / n * 100)).padStart(3)}%（${String(Math.round(lvs / accs.length)).padStart(3)} 级）`);
  }
  console.log(`第 ${String(s).padStart(2)} 关 推荐 ${String(Math.round(P)).padStart(6)}  ` + cells.join('  '));
}
