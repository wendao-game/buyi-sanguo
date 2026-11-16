// 量武将血量的压力：战力是推荐值的 0.8 / 1 / 1.2 倍时，每局倒几个武将、全灭几局、最惨的那个剩多少血、胜率多少。
// 敌人打武将的数值（CFG.HERO_HIT、敌将招式里的 dmg）改了之后跑一遍。目标：达标时会掉血但很少死人，差两成时每局倒一两个，超两成基本不死。
// 用法：node tools/sim/herohp.js [关卡，逗号分隔=5,15,25,35,45,55,65,75,80] [每档多少份存档=8]
const { account, planAt, levelTo } = require('./harness.js');
const stages = (process.argv[2] || '5,15,25,35,45,55,65,75,80').split(',').map(Number), N = Number(process.argv[3] || 8);
for (const st of stages) {
  const cells = []; let name = '';
  for (const ratio of [0.8, 1, 1.2]) {
    let w = 0, dead = 0, wipe = 0, minHp = 0;
    for (let i = 0; i < N; i++) {
      const p = planAt(st), G = account(p.draws, 1, null, p.iron, st); levelTo(G, G.stagePower(st) * ratio);
      const B = G.Battle; B.start(st); name = B.state.boss.name; let f = 0, lo = 1;
      while (B.state && !B.state.over && f < 40000) { B.tick(0.05); f++; if (f % 20 === 0) for (const h of B.state.heroes) lo = Math.min(lo, h.hp / h.maxHp); }
      const S = B.state; if (S.win) w++; dead += Object.keys(S.fallen).length; if (S.wiped) wipe++; minHp += lo; B.stop();
    }
    cells.push(`×${ratio} 胜 ${String(Math.round(w / N * 100)).padStart(3)}% 阵亡 ${(dead / N).toFixed(1)} 全灭 ${String(Math.round(wipe / N * 100)).padStart(2)}% 最低血 ${String(Math.round(minHp / N * 100)).padStart(2)}%`);
  }
  console.log(`第 ${String(st).padStart(2)} 关 ${name.padEnd(7, '　')} ` + cells.join('  |  '));
}
