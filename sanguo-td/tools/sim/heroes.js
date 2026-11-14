// 单个武将的「真实强度」：4 名固定的白品陪练 + 被测武将（等级调到一个人顶陪练四个人的战力，占全队一半），
// 二分查找这支队伍能守住的敌人血量系数 k（和 calibrate.js 同一个量）。
// k 越大 = 同样战力数字下越能打。理想情况所有武将的 k 差不多；偏高的技能太强，偏低的太弱，照着去调 skills.js。
// 用法：node tools/sim/heroes.js [关卡=20] [被测武将星级=2] [每档打几局=10] [只测哪些武将，逗号分隔]
const { load, fight } = require('./harness.js');
const stage = Number(process.argv[2] || 20), star = Number(process.argv[3] || 2), REP = Number(process.argv[4] || 10), only = process.argv[5] ? process.argv[5].split(',') : null;
const BASE = ['liaohua', 'zhoucang', 'panfeng', 'guanhai'], SPARE = 'guanping', BASE_LV = 25;
let K = 0.005, PW = 1000;
// 敌人血量 = k × 这支队伍的战力；敌人攻击也按这支队伍的战力算（和正式关卡同一个公式），
// 这样城墙能挨的下数和正式关卡里战力达标时一样，不会因为被测队伍战力低于关卡而「一碰就破」
const G = load((G, ctx) => { ctx.stageHpMul = (s, wave) => K * PW * (1 + 0.07 * (wave - 1)); ctx.stageAtkMul = () => (400 + 0.62 * PW) / (400 + 0.62 * G.stagePower(1)); });
const D = G.Save.data;
function setup(id) {
  const base = BASE.map(b => b === id ? SPARE : b), heroes = {};
  base.forEach(b => { heroes[b] = { lv: BASE_LV, star: 0, shards: 0 }; });
  const target = BASE.length * G.heroStats('liaohua', { lv: BASE_LV, star: 0 }).power;
  if (base.includes(SPARE)) { let l = 1; while (l < 100 && G.heroStats(SPARE, { lv: l, star: 0 }).power < target / BASE.length) l++; heroes[SPARE].lv = l; }
  let lv = 1; while (lv < 100 && G.heroStats(id, { lv, star }).power < target) lv++;
  heroes[id] = { lv, star, shards: 0 };
  return { heroes, team: [base[0], base[1], id, base[2], base[3]], lv };
}
function rate(t, k) {
  let w = 0;
  for (let r = 0; r < REP; r++) { D.heroes = JSON.parse(JSON.stringify(t.heroes)); D.team = t.team.slice(); K = k; PW = G.teamPower(); if (fight(G, stage, false).win) w++; }
  return w / REP;
}
for (const h of G.HEROES) {
  if (h.locked || (only && !only.includes(h.id))) continue;
  const t = setup(h.id); let lo = 0.0005, hi = 0.08;
  for (let it = 0; it < 9; it++) { const mid = Math.sqrt(lo * hi); if (rate(t, mid) >= 0.5) lo = mid; else hi = mid; }
  const k = Math.sqrt(lo * hi);
  console.log(`${h.id.padEnd(11)} ${h.name.padEnd(4, '　')} 品质${h.q} ${h.el.padEnd(8)} lv${String(t.lv).padStart(3)}  k=${k.toFixed(5)}  ${'#'.repeat(Math.min(70, Math.round(k * 2500)))}`);
}
