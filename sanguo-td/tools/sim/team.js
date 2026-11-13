// 量一支指定阵容的真实强度（k = 能守住的敌人血量 ÷ 战力，和 calibrate.js / heroes.js 同一个量，正常在 0.005 左右）。
// 用来查「某个组合是不是强得离谱」。用法：node tools/sim/team.js 武将id,武将id,… [关卡=60] [等级=40] [星级=2] [每档几局=12]
const { load, fight } = require('./harness.js');
const ids = process.argv[2].split(','), stage = Number(process.argv[3] || 60), lv = Number(process.argv[4] || 40), star = Number(process.argv[5] || 2), REP = Number(process.argv[6] || 12);
let K = 0.005, PW = 1000;
// 敌人血量 = k × 这支队伍的战力；敌人攻击也按这支队伍的战力算（和正式关卡同一个公式），
// 这样城墙能挨的下数和正式关卡里战力达标时一样，不会因为被测队伍战力低于关卡而「一碰就破」
const G = load((G, ctx) => { ctx.stageHpMul = (s, wave) => K * PW * (1 + 0.07 * (wave - 1)); ctx.stageAtkMul = () => (400 + 0.62 * PW) / (400 + 0.62 * G.stagePower(1)); });
const D = G.Save.data, team = ids.slice(0, 5); while (team.length < 5) team.push(null);
function rate(k) {
  let w = 0;
  for (let r = 0; r < REP; r++) { D.heroes = {}; ids.forEach(id => { D.heroes[id] = { lv, star, shards: 0 }; }); D.team = team.slice(); K = k; PW = G.teamPower(); if (fight(G, stage, false).win) w++; }
  return w / REP;
}
let lo = 0.0005, hi = 0.08;
for (let it = 0; it < 9; it++) { const mid = Math.sqrt(lo * hi); if (rate(mid) >= 0.5) lo = mid; else hi = mid; }
console.log(`${ids.map(id => G.HERO_MAP[id].name).join(' ')}  战力 ${PW}  k=${Math.sqrt(lo * hi).toFixed(5)}`);
