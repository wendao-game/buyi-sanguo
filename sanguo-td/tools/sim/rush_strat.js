// 过关斩将各种「军令打法」能斩多少将、掉多少铜钱。军令按「运气最好」算：想要的那条每次都能选到（但守 max 上限）。
// 用法：node tools/sim/rush_strat.js <战力档=关卡号，默认 150> [打法名里的字，逗号分隔；all 全跑] [最多斩到第几将=300] [每种打几局=1]
// 改军令、礌石、过关斩将的数值之后跑一遍：哪种打法斩将数突然变得很大、或者铜钱很多，就是有漏洞（v2.29 之前礌石流能斩 240+ 将、铜钱流一局 3 亿）
const { account, levelTo, planAt } = require('./harness.js');
const vm = require('vm');
const ST = Number(process.argv[2] || 150), ONLY = process.argv[3] && process.argv[3] !== 'all' ? process.argv[3].split(',') : null, MAXK = Number(process.argv[4] || 300);
// 打法：pref 军令优先顺序（轮流拿，拿满的跳过）；rocks 投不投石；bond 放不放合击（阵容里塞进桃园三兄弟）
const STRATS = {
  '礌石流（论坛攻略）': { pref: ['rock', 'boss', 'crit'], rocks: true },
  '铜钱流':             { pref: ['coin', 'rock', 'boss', 'crit'], rocks: true },
  '只叠铜钱':           { pref: ['coin'], rocks: true },
  '合击流':             { pref: ['boss', 'crit', 'ult'], rocks: false, bond: true },
  '合击加礌石':         { pref: ['boss', 'rock', 'crit', 'ult'], rocks: true, bond: true },
  '堆伤害':             { pref: ['atk', 'boss', 'crit', 'ult', 'spd'], rocks: true },
  '只叠擒王':           { pref: ['boss'], rocks: true },
  '修城流':             { pref: ['heal', 'boss'], rocks: true },
  '真实三选一·擒王优先': { pref: ['boss', 'e_', 'ult', 'atk', 'crit', 'spd', 'rage', 'rock', 'heal', 'coin'], rocks: true, real: true },
  '真实三选一·礌石优先': { pref: ['rock', 'boss', 'crit', 'e_', 'atk', 'ult', 'spd', 'rage', 'heal', 'coin'], rocks: true, real: true },
  '真实三选一·铜钱优先': { pref: ['coin', 'boss', 'e_', 'atk', 'ult', 'crit', 'spd', 'rage', 'rock', 'heal'], rocks: true, real: true },
  '随便选（模拟器默认）': { pref: null, rocks: true },
};
function run(name, st) {
  const p = planAt(80), G = account(p.draws, p.lv, null, p.iron, 80), ctx = G.ctx, B = G.Battle, D = G.Save.data;
  const R = k => vm.runInContext(k, ctx);
  D.stage = 200;
  if (st.bond) { const src = D.heroes[D.team.find(Boolean)]; ['liubei', 'guanyu', 'zhangfei'].forEach((id, i) => { if (!D.heroes[id]) D.heroes[id] = JSON.parse(JSON.stringify(src)); const slots = D.team.map((x, j) => j).filter(j => !['liubei', 'guanyu', 'zhangfei'].includes(D.team[j])); if (!D.team.includes(id)) D.team[slots[0]] = id; }); }
  levelTo(G, G.stagePower(ST));
  const taken = {}; let rot = 0;
  const def = ctx.__pickBuff;
  ctx.__pickBuff = opts => {
    if (!st.pref) { const i = def ? def(opts) : 0; taken[opts[i].id] = (taken[opts[i].id] || 0) + 1; return i; }
    if (st.real) { let bi = 0, bs = 99; opts.forEach((o, i) => { let j = st.pref.findIndex(p => o.id === p || (p === 'e_' && o.id.indexOf('e_') === 0)); if (j < 0) j = 50; if (j < bs) { bs = j; bi = i; } }); taken[opts[bi].id] = (taken[opts[bi].id] || 0) + 1; return bi; }   // 真实的随机三选一：在给出的三条里按优先顺序挑
    const S = B.state, BU = R('BUFFS');
    for (let n = 0; n < st.pref.length; n++) { const id = st.pref[rot++ % st.pref.length], bf = BU.find(x => x.id === id); if ((S.taken[id] || 0) < (bf.max || Infinity)) { opts[0] = bf; taken[id] = (taken[id] || 0) + 1; return 0; } }
    taken[opts[0].id] = (taken[opts[0].id] || 0) + 1; return 0;                           // 想要的都拿满了：随便拿第一条
  };
  R('RUSH_SEQ = null; dayNo = () => 20400');
  B.start(R('rushStage(1)'), { rush: true, name: '过关斩将' });
  let f = 0, rocks = 0, bonds = 0, maxShare = 0, lastK = 0, lastT = 0, note = '';
  while (B.state && !B.state.over) {
    const S = B.state;
    if (S.wave !== lastK) { lastK = S.wave; lastT = S.t; if (lastK > MAXK) { note = '（到 ' + MAXK + ' 将还没输，停）'; break; } }
    const b = S.enemies.find(e => e.def.id === 'boss' && !e.dead);
    if (st.rocks && f % 4 === 0 && S.rock.n > 0 && b) { const h0 = b.hp; B.tapAt(b.x, b.y); rocks++; b.__h = h0; }
    if (st.bond && S.bond && S.bond.t >= S.bond.cd && b) { B.bond(); bonds++; }
    B.tick(0.05); f++;
    if (S.t - lastT > 1800) { note = '（第 ' + S.wave + ' 将打了 30 分钟没结果，停）'; break; }
  }
  const S = B.state, kills = S.wave - 1, cap = R('rushCoinCap(' + kills + ')');
  return name + '：斩 ' + kills + ' 将' + note + '，局内 ' + (S.t / 60).toFixed(0) + ' 分，投石 ' + rocks + (st.bond ? '，合击 ' + bonds + ' 次' + (S.bond ? '' : '【没凑出合击】') : '') + '，本局铜钱 ' + (S.coins >= 1e6 ? S.coins.toExponential(2) : Math.round(S.coins)) + ' → 结算给 ' + Math.round(Math.min(S.coins, cap) * 0.5) + '，军令 ' + JSON.stringify(taken);
}
console.log('战力档：第 ' + ST + ' 关的推荐战力');
const REP = Number(process.argv[5] || 1);
for (const name in STRATS) if (!ONLY || ONLY.some(o => name.indexOf(o) >= 0)) for (let i = 0; i < REP; i++) console.log('  ' + run(name, STRATS[name]));
