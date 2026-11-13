// 挂机玩家模拟：从新存档开始一路打。金币按比例换招募令、其余升级上阵武将（便宜的先升）；
// 打不过就回去刷打得过的关。输出每章打完时累计打了多少局、阵容什么水平。
// 用法：node tools/sim/bot.js [打到第几关=80] [最多多少局=900] [换招募令的比例=0.35] [rock=会投石]
const { load, fight, bestTeam, spendIron, spendSoul, starOwn } = require('./harness.js');
const maxStage = Number(process.argv[2] || 80), maxBattles = Number(process.argv[3] || 900), share = Number(process.argv[4] || 0.35), rocks = process.argv[5] === 'rock';
const G = load(); const D = G.Save.data;
function spend() {
  const tk = Math.floor(D.coins * share / G.CFG.TICKET_PRICE); if (tk > 0) G.buyTickets(tk);
  while (D.tickets >= 10) G.gachaDraw(10); while (D.tickets >= 1) G.gachaDraw(1);
  starOwn(G);
  Object.keys(D.heroes).forEach(id => { if (D.heroes[id].lv > 1) G.levelReset(id); });   // 全员重置等级（全额返还）再挑阵容：按品质、星级、羁绊挑，不被「谁已经练了」带偏
  Object.keys(D.weapons).forEach(id => { D.weapons[id].hero = null; });   // 兵器先都卸下，挑完阵容再分
  bestTeam(G); spendSoul(G); bestTeam(G);
  spendIron(G);
  for (let g = 0; g < 5000; g++) { const ids = D.team.filter(Boolean).sort((a, b) => G.levelCost(a) - G.levelCost(b)); if (!ids.length || G.levelUp(ids[0])) break; }
}
spend();
let stage = 1, total = 0, tries = 0, farm = 1, coins0 = 0; const rows = [];
const snap = () => { const t = D.team.filter(Boolean), avg = f => t.reduce((s, id) => s + f(id), 0) / t.length; return `战力 ${String(G.teamPower()).padStart(6)} / 推荐 ${String(G.stageRecommend(stage)).padStart(6)}  阵容 品质${avg(id => G.HERO_MAP[id].q).toFixed(1)} 等级${avg(id => D.heroes[id].lv).toFixed(0).padStart(3)} 星${avg(id => D.heroes[id].star).toFixed(1)}  武将${String(Object.keys(D.heroes).length).padStart(2)}  抽卡${String(D.draws).padStart(5)}  累计金币${String(Math.round(D.earned)).padStart(8)}  将魂余${String(D.soul).padStart(4)}  铸造${String(D.wdraws).padStart(4)}  兵器 ${Object.keys(D.weapons).filter(id => D.weapons[id].hero).map(id => '白绿蓝紫金橙'[G.WEAPON_MAP[id].q] + D.weapons[id].lv).join(' ')}  累计精铁${String(ironGot).padStart(5)}  ${t.map(id => G.HERO_MAP[id].name + D.heroes[id].star).join(' ')}`; };
let ironGot = 0;
const battle = st => { const i0 = D.iron, r = fight(G, st, rocks); ironGot += Math.max(0, D.iron - i0); return r; };
while (stage <= maxStage && total < maxBattles) {
  const r = battle(stage); total++; tries++;
  if (r.win) { if (stage % 10 === 0) rows.push(`第 ${String(stage).padStart(2)} 关  累计 ${String(total).padStart(4)} 局  ${snap()}`); farm = stage; stage++; tries = 0; }
  else { const f = battle(farm); total++; if (!f.win) farm = Math.max(1, farm - 2); }
  spend();
}
console.log(rows.join('\n')); console.log(`结束：打到第 ${stage} 关，共 ${total} 局  ${snap()}`);
