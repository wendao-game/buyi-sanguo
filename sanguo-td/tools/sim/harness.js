// 不带画面的模拟器：在 Node 里直接跑游戏的数值、存档、战斗逻辑（界面、画面、音效用空壳代替）
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..', '..', 'js') + path.sep;
function load(patch) {
  const store = {};
  const ctx = {
    console, Math, Date, JSON, Object, Array, Set, Map, Promise, String, Number, Error, parseInt, parseFloat, isNaN, performance, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0,
    btoa: s => Buffer.from(s, 'binary').toString('base64'), atob: s => Buffer.from(s, 'base64').toString('binary'), escape, unescape, encodeURIComponent, decodeURIComponent,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem(k, v) { store[k] = String(v); }, removeItem(k) { delete store[k]; } },
    location: { protocol: 'http:', hostname: 'sim', search: '' }, document: { getElementById: () => null },
    Art: { depth: () => 1 }, Assets: { get: () => null, tinted: () => null }, Sfx: { play() {} },
    UI: { showBuffs(opts, cb) { cb(ctx.__pickBuff ? ctx.__pickBuff(opts) : 0); }, showResult() {}, hud() {}, render() {}, toast() {}, cloudNote() {} },
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  let src = ['data', 'skills', 'save', 'battle'].map(f => fs.readFileSync(ROOT + f + '.js', 'utf8')).join('\n');
  src += '\n;globalThis.G = { STAGE_POWER, stagePower, hpPerPower, CFG, QUALITIES, HEROES, HERO_MAP, ELEMENTS, ENEMIES, BUFFS, Save, Battle, heroStats, teamPower, basePower, teamBonus, levelCost, levelUp, levelReset, levelSpent, starUp, buyTickets, gachaDraw, stageRecommend, stageWinCoins, stageHpMul, stageAtkMul, genWave, settleBattle, sweep, sweepLeft, heroOwn };';
  vm.runInContext(src, ctx);
  ctx.G.ctx = ctx;
  if (patch) patch(ctx.G, ctx);
  ctx.G.Save.load();
  ctx.G.Battle.init({ getContext: () => ({}), addEventListener() {} });
  ctx.G.Save.data.speed = 1; ctx.G.Save.data.auto = true;
  // 军令：优先选加伤害的
  ctx.__pickBuff = opts => { const pri = ['atk', 'e_', 'spd', 'ult', 'crit', 'boss', 'rage', 'rock', 'heal', 'coin']; let best = 0, bs = 99; opts.forEach((o, i) => { const s = pri.findIndex(p => o.id.startsWith(p)); if (s >= 0 && s < bs) { bs = s; best = i; } }); return best; };
  return ctx.G;
}
/* 打一局（自动）。rocks: 是否会投石（在敌人最密的地方投） */
function fight(G, stage, rocks) {
  const B = G.Battle; B.start(stage);
  let f = 0;
  while (B.state && !B.state.over && f < 40000) {
    const S = B.state;
    if (rocks && f % 10 === 0 && S.rock.n > 0 && S.live.length >= 4) { let best = null, bs = -1; for (const e of S.live) { let n = e.y / 300; for (const o of S.live) if (Math.hypot(o.x - e.x, o.y - e.y) < 60) n++; if (n > bs) { bs = n; best = e; } } if (best) B.tapAt(best.x, best.y); }
    B.tick(0.05); f++;
  }
  const S = B.state, r = { win: S.win, wave: S.wave, t: S.t, kills: S.kills, wall: S.wall / S.wallMax, buffs: (S.picks || []).map(b => b.id) };
  B.stop(); return r;
}
/* 从拥有的武将里挑战力最高的 5 人并排好站位（贪心 + 随机换位），写进 Save.data.team */
function bestTeam(G) {
  const D = G.Save.data, arr = t => { const a = t.slice(0, 5); while (a.length < 5) a.push(null); return a; };
  const own = Object.keys(D.heroes).sort((a, b) => G.heroStats(b).power - G.heroStats(a).power);
  let pick = own.slice(0, 5);
  for (const id of own.slice(5, 14)) for (let i = 0; i < pick.length; i++) { if (pick.includes(id)) break; const t = pick.slice(); t[i] = id; if (G.teamPower(arr(t)) > G.teamPower(arr(pick))) pick = t; }
  let best = arr(pick), bp = G.teamPower(best);
  for (let r = 0; r < 60; r++) { const t = best.slice(), i = Math.floor(Math.random() * 5), j = Math.floor(Math.random() * 5); [t[i], t[j]] = [t[j], t[i]]; const pw = G.teamPower(t); if (pw > bp) { bp = pw; best = t; } }
  D.team = best; return bp;
}
/* 《数值规划.md》的进度规划：章末关卡 → 累计抽卡数、阵容平均等级（中间的关卡线性插值） */
const PLAN = [[1, 10, 1], [10, 30, 5], [20, 70, 14], [30, 120, 25], [40, 200, 37], [50, 320, 48], [60, 480, 60], [70, 700, 72], [80, 1000, 85]];
function planAt(stage) {
  for (let i = 1; i < PLAN.length; i++) if (stage <= PLAN[i][0]) { const a = PLAN[i - 1], b = PLAN[i], f = (stage - a[0]) / (b[0] - a[0]); return { draws: Math.round(a[1] + (b[1] - a[1]) * f), lv: Math.round(a[2] + (b[2] - a[2]) * f) }; }
  const z = PLAN[PLAN.length - 1]; return { draws: z[1], lv: z[2] };
}
/* 造一份「抽了 draws 次卡」的存档：能升的星都升了，全员 lv 级，上阵最强的 5 人。patch 同 load */
function account(draws, lv, patch) {
  const G = load(patch), D = G.Save.data;
  D.tickets = draws; while (D.tickets >= 10) G.gachaDraw(10); while (D.tickets >= 1) G.gachaDraw(1);
  Object.keys(D.heroes).forEach(id => { while (!G.starUp(id)); D.heroes[id].lv = lv; });
  bestTeam(G); return G;
}
/* 把上阵武将的等级统一调到战力最接近 target，返回等级 */
function levelTo(G, target) {
  const D = G.Save.data, ids = D.team.filter(Boolean); let bl = 1, bd = Infinity;
  for (let lv = 1; lv <= 100; lv++) { ids.forEach(id => { D.heroes[id].lv = lv; }); const d = Math.abs(Math.log(G.teamPower() / target)); if (d < bd) { bd = d; bl = lv; } }
  ids.forEach(id => { D.heroes[id].lv = bl; }); return bl;
}
module.exports = { load, fight, bestTeam, account, levelTo, PLAN, planAt };
