// 过关斩将的难度：不同战力的阵容自动打（不投石），平均能斩几将。
// 用法：node tools/sim/rush.js [每档几局=6] [战力档，逗号分隔，写关卡号=那一关的推荐战力，默认 81,90,100,110,120]
// 目标（v2.19）：刚进无尽（第 81 关的战力）斩 2～4 将；推荐战力每涨一截多斩几将；没有人能无限打下去
const { account, levelTo, planAt } = require('./harness.js');
const vm = require('vm');
const N = Number(process.argv[2] || 6), LV = (process.argv[3] || '81,90,100,110,120').split(',').map(Number);
const pt = (G0, c) => { if (process.env.HPK) vm.runInContext('CFG.RUSH.hpK = ' + process.env.HPK, c); if (process.env.STEP) vm.runInContext('CFG.RUSH.step = ' + process.env.STEP, c); };
const p = planAt(80), G = account(p.draws, p.lv, pt, p.iron, 80), ctx = G.ctx, D = G.Save.data;
const R = k => vm.runInContext(k, ctx);
D.stage = 200;
for (const st of LV) {
  const target = G.stagePower(st); levelTo(G, target);
  const out = [], days = [];
  for (let i = 0; i < N; i++) {
    const day = 20400 + i; R('RUSH_SEQ = null; dayNo = () => ' + day);
    const B = G.Battle; B.start(R('rushStage(1)'), { rush: true, name: '过关斩将' });
    let f = 0; while (B.state && !B.state.over && f < 200000) { B.tick(0.05); f++; }
    const S = B.state; out.push((S.wave - 1) + (S.wiped ? 'w' : '')); days.push((S.t / 60).toFixed(1)); B.stop();
  }
  const avg = out.reduce((a, b) => a + parseInt(b), 0) / out.length;
  console.log(`第 ${st} 关战力 ${Math.round(target)}（全队 ${D.heroes[D.team.find(Boolean)].lv} 级）：斩将 ${out.join(' ')}  平均 ${avg.toFixed(1)}  用时(分) ${days.join(' ')}`);
}
