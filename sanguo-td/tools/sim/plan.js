// 战力预算表从哪来：按《数值规划.md》定的各章「累计抽卡数」「阵容平均等级」（harness.js 的 PLAN），
// 用真实抽卡概率模拟很多份存档，看这时候最强的 5 人阵容战力大概多少（取中位数）→ data.js 的 STAGE_POWER。
// 用法：node tools/sim/plan.js [模拟多少份存档=120]
const { account, PLAN } = require('./harness.js');
const N = Number(process.argv[2] || 120), out = [];
for (const [stage, draws, lv] of PLAN.slice(1)) {
  const P = [], Q = [], S = [], AW = [];
  for (let n = 0; n < N; n++) {
    const G = account(draws, lv), D = G.Save.data, ids = D.team.filter(Boolean), avg = f => ids.reduce((s, id) => s + f(id), 0) / ids.length;
    P.push(G.teamPower()); Q.push(avg(id => G.HERO_MAP[id].q)); S.push(avg(id => D.heroes[id].star)); AW.push(avg(id => D.heroes[id].star >= G.CFG.AWAKEN_STAR ? 1 : 0));
  }
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length, sorted = P.slice().sort((a, b) => a - b), med = sorted[Math.floor(N / 2)];
  out.push(med);
  console.log(`第 ${stage} 关  抽卡 ${String(draws).padStart(4)}  等级 ${String(lv).padStart(2)}  战力中位数 ${String(med).padStart(6)}（两成玩家低于 ${sorted[Math.floor(N * 0.2)]}，两成高于 ${sorted[Math.floor(N * 0.8)]}）  品质 ${mean(Q).toFixed(1)}  星 ${mean(S).toFixed(1)}  觉醒 ${(mean(AW) * 5).toFixed(1)} 人`);
}
console.log('const STAGE_POWER = [250, ' + out.map(v => Math.round(v / 100) * 100).join(', ') + '];');
