// 技能检查：每个武将单独上阵，等敌人走到战场中段，放一次大招（普攻停掉），量这一下的效果：
//   命中 = 大招放出后 8 秒内被他打掉过血的敌人数 / 当时场上的敌人数
//   伤害 = 这 8 秒里他造成的总伤害，折成「攻击力的多少倍」
//   控制 = 放出 0.6 秒后场上被眩晕 / 恐惧 / 混乱 / 减速的敌人数
// 命中 0 且没有控制、回复、加速的会标「!! 打不到人」；伤害明显低于同品质的会标「偏低」。
// 用法：node tools/sim/skills.js [只查哪些武将，逗号分隔] [关卡=20] [每人测几次=5]
const { load } = require('./harness.js');
const only = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2].split(',') : null, stage = Number(process.argv[3] || 20), REP = Number(process.argv[4] || 5);
function once(id) {
  const G = load(), D = G.Save.data, B = G.Battle;
  D.heroes = { [id]: { lv: 30, star: 2, shards: 0 } }; D.team = [null, null, id, null, null]; D.auto = false;
  B.start(stage);
  const S = B.state, h = S.heroes[0];
  for (let f = 0; f < 1200; f++) {                              // 等到场上有十几个敌人、最前面的快到城下
    S.wall = S.wallMax; h.t = 99; h.rage = 0; B.tick(0.05);
    if (S.live.length >= 14 && S.live.some(e => e.y > G.CFG.WALL_Y - 160)) break;
  }
  const alive = S.live.filter(e => !e.dead), hp0 = new Map(alive.map(e => [e, e.hp])), dmg0 = h.dmg, wall0 = S.wall = Math.round(S.wallMax * 0.6), cd0 = h.cd;
  h.rage = 100; B.ult(2); if (S.aim !== null) B.ult(2);         // 可瞄准的大招：再点一次头像 = 自动选目标
  let cc = 0, haste = false, healed = S.wall > wall0 + 1;         // 回复当场就看（之后城墙还会挨打）
  for (let f = 0; f < 160; f++) {
    h.t = 99; h.rage = 0; B.tick(0.05);
    if (f === 12) cc = S.live.filter(e => e.frozen > 0 || e.fear > 0 || e.conf > 0 || e.slow > 0).length;
    if (h.hasteT > 0 || S.haste.t > 0) haste = true;
    if (S.guard && S.guard.t > 0) healed = true;                // 城墙减伤（高顺）和回复一样算守城的效果
    if (f < 30 && S.wall > wall0 + 1) healed = true;
    if (S.over) break;
  }
  const hit = alive.filter(e => e.dead || e.hp < hp0.get(e) - 0.5).length;
  return { n: alive.length, hit, mult: (h.dmg - dmg0) / h.atk, cc, heal: healed, haste, rageOthers: false };
}
const rows = [];
for (const d of load().HEROES) {
  if (d.locked || (only && !only.includes(d.id))) continue;
  const r = []; for (let i = 0; i < REP; i++) r.push(once(d.id));
  const avg = k => r.reduce((s, x) => s + x[k], 0) / r.length;
  rows.push({ d, n: avg('n'), hit: avg('hit'), mult: avg('mult'), cc: avg('cc'), heal: r.some(x => x.heal), haste: r.some(x => x.haste) });
}
const byQ = {}; rows.forEach(r => { (byQ[r.d.q] = byQ[r.d.q] || []).push(r.mult); });
const med = q => { const a = byQ[q].slice().sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
let bad = 0;
for (const r of rows) {
  const util = r.cc >= 2 || r.heal || r.haste, flag = r.hit < 0.5 && !util ? '!! 打不到人' : r.hit < 2 && r.mult < med(r.d.q) * 0.35 && !util ? '!! 命中太少' : r.mult < med(r.d.q) * 0.3 && !util ? '偏低' : '';
  if (flag.startsWith('!!')) bad++;
  console.log(`${r.d.name.padEnd(4, '　')} 品质${r.d.q} ${r.d.el.padEnd(8)} 命中 ${r.hit.toFixed(1).padStart(5)}/${r.n.toFixed(0).padStart(2)}  伤害 ×${r.mult.toFixed(1).padStart(6)}  控制 ${r.cc.toFixed(0).padStart(2)}  ${r.heal ? '回复 ' : ''}${r.haste ? '加速 ' : ''}${flag}`);
}
console.log(bad ? `有 ${bad} 个大招有问题（标 !! 的）` : '没有打不到人的大招');
process.exitCode = bad ? 1 : 0;
