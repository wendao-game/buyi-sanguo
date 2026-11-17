// 难度曲线：每一关在「战力刚好达标」时的挂机胜率（check.js 只看整十关，这里把章内的关也量一遍）。
// 一章里应该是越往后越难或者差不多，不该出现「章中间比章末还难」；某一关明显偏低 / 偏高，多半是那一关的敌将招式太狠 / 太软。
// 用法：node tools/sim/stages.js [关卡，逗号分隔=3,5,7,9,10,…] [每关多少份存档=24]
//       CURVE_RATIO=0.8 node tools/sim/stages.js …   战力只有推荐值的八成时
const { account, planAt, levelTo, fight } = require('./harness.js');
const def = []; for (let c = 0; c < 8; c++) [3, 5, 7, 9, 10].forEach(s => def.push(c * 10 + s));
const stages = (process.argv[2] ? process.argv[2].split(',').map(Number) : def), N = Number(process.argv[3] || 24), ratio = Number(process.env.CURVE_RATIO || 1);
for (const st of stages) {
  let w = 0, dead = 0, wall = 0, name = '', sk = '';
  for (let i = 0; i < N; i++) {
    const p = planAt(st), G = account(p.draws, 1, null, p.iron, st); levelTo(G, G.stagePower(st) * ratio);
    const B = G.Battle; B.start(st); const b = B.state.boss; name = b.name; sk = b.skills.map(k => k.name).join('、'); let f = 0;
    while (B.state && !B.state.over && f < 40000) { B.tick(0.05); f++; }
    const S = B.state; if (S.win) { w++; wall += Math.max(0, S.wall) / S.wallMax; } dead += Object.keys(S.fallen).length; B.stop();
  }
  const r = w / N;
  console.log(`第 ${String(st).padStart(2)} 关 ${name.padEnd(7, '　')} 胜率 ${String(Math.round(r * 100)).padStart(3)}%  赢的时候城防剩 ${String(w ? Math.round(wall / w * 100) : 0).padStart(2)}%  阵亡 ${(dead / N).toFixed(1)}  ${'#'.repeat(Math.round(r * 30))}  ${sk}`);
}
