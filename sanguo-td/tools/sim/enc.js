// 量「奇遇」的难度：每局都强制出指定的山贼首领 / 神兽，看战力 = 推荐值 ×0.8 / ×1 / ×1.2 时的通关率和击败率。
// 用法：ENC=<奇遇 id> node tools/sim/enc.js [关卡，逗号分隔=30,50,70] [每档多少份存档=8]
//   不带 ENC 就是没有奇遇时的通关率（对照）。奇遇 id 见 js/data.js 的 ENCOUNTERS。
const { fight, account, levelTo, planAt } = require('./harness.js');
const STAGES = (process.argv[2] || '30,50,70').split(',').map(Number), N = Number(process.argv[3] || 8);
for (const s of STAGES) {
  const accs = []; for (let i = 0; i < N; i++) accs.push(account(planAt(s).draws, 1, null, planAt(s).iron, s));
  const P = accs[0].stagePower(s), cells = [];
  for (const r of [0.8, 1, 1.2]) {
    let w = 0, n = 0, k = 0;
    for (const G of accs) { const D = G.Save.data; levelTo(G, P * r); for (let j = 0; j < 2; j++) { const st = D.stage, x = fight(G, s); if (x.win) w++; if (x.enc === 2) k++; n++; D.stage = st; } }
    cells.push(`×${r} 通关 ${String(Math.round(w / n * 100)).padStart(3)}% 击败 ${String(Math.round(k / n * 100)).padStart(3)}%`);
  }
  console.log(`${(process.env.ENC || '无奇遇').padEnd(9)} 第 ${String(s).padStart(2)} 关  ` + cells.join('  '));
}
