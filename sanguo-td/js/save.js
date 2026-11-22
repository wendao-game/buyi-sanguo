'use strict';
/* ============================================================
 * 存档 / 经济 / 抽卡 / 广告
 * ============================================================ */

const Save = {
  KEY: 'sanguo_td_save_v1',
  data: null,

  fresh() {
    const heroes = {};
    STARTER_HEROES.forEach(id => { heroes[id] = { lv: 1, star: 0, shards: 0 }; });
    return {
      coins: CFG.START_COINS,
      tickets: CFG.START_TICKETS,
      heroes,
      team: [STARTER_HEROES[0], STARTER_HEROES[1], STARTER_HEROES[2], null, null],
      stage: 1,            // 已解锁的最高关
      pick: 1,             // 当前选中的关
      ad: { date: '', count: 0 },
      pity: 0,
      draws: 0,
      speed: 1,
      auto: true,
      sweep: { date: '', count: 0 },
      tech: { atk: 0, wall: 0, ult: 0 },   // 城池科技各条线的等级（没有上限）
      daily: { date: '' },                 // 每日军饷：哪天领过
      gfx: 'gl',           // 战斗画面：'gl' 高清（WebGL），'2d' 兼容
      sound: true,         // 音效开关
      music: true,         // 背景音乐开关
      iron: 0,             // 精铁（强化兵器用）
      soul: 0,             // 将魂（碎片炼化得来，升星时顶碎片用）
      weapons: {},         // 已有的兵器：id → { lv, hero: 装在谁身上 / null }
      tips: {},            // 已经看过的新手提示
      unlocked: {},        // 解锁进卡池的东西：奇遇里的神兽兵器（兵器 id → 1）、无尽关里打赢的神魔（神魔 id → 1，他的专属兵器也跟着进卡池，见 weaponOpen）
      enc: { n: 0, kills: {}, seen: {} },   // 奇遇：连着多少局没碰上、各击败过几次、见过哪些（奇遇录）
      earned: 0,           // 累计获得的金币（招募令按兑换价折算），只增不减：云存档合并时取更大的那份
      idle: { t: 0 },      // 挂机军饷：从什么时候开始攒（领完重新攒；只往后走，改回更早的时间不会多给）
      trial: { date: '' }, // 每日试炼：哪天拿过首胜奖励（和每日军饷一样按天序号判断）
      rush: { best: 0, date: '' },   // 过关斩将：最多斩过几将、哪天领过每日首局奖励
      bestPower: 0,        // 历史最高阵容战力（排行榜用）
      lb: { stage: 0, power: 0, rush: 0 },   // 排行榜上已经报过的成绩：有长进才再报
      at: 0,               // 最后保存时间
      ver: 2,
    };
  },
  load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (e) { d = null; }
    this.data = Object.assign(this.fresh(), d || {});
    // 阵营试炼打到一半关掉了游戏：把临时换上的阵容换回原来的
    if (Array.isArray(this.data.trialBak)) { this.data.team = this.data.trialBak; delete this.data.trialBak; }
    // 清理存档里已不存在的武将
    Object.keys(this.data.heroes).forEach(id => { if (!HERO_MAP[id]) delete this.data.heroes[id]; });
    this.data.team = (Array.isArray(this.data.team) ? this.data.team : []).slice(0, 5).map(id => (id && this.data.heroes[id] ? id : null));
    while (this.data.team.length < 5) this.data.team.push(null);
    if (!this.data.team.some(Boolean)) { const first = Object.keys(this.data.heroes)[0]; if (first) this.data.team[2] = first; }
    // 兵器：清掉已不存在的；装在不存在的武将身上、或者两件装在同一个人身上的，卸下来
    const W = this.data.weapons = (this.data.weapons && typeof this.data.weapons === 'object') ? this.data.weapons : {}, used = {};
    Object.keys(W).forEach(id => { const w = W[id]; if (!WEAPON_MAP[id] || !w) return delete W[id]; w.lv = Math.max(1, Math.min(CFG.WEAPON_MAX_LV, w.lv | 0)); if (w.hero && (!this.data.heroes[w.hero] || used[w.hero])) w.hero = null; if (w.hero) used[w.hero] = 1; });
    this.data.iron = Math.max(0, this.data.iron | 0); this.data.soul = Math.max(0, this.data.soul | 0);
    // 金币、招募令、累计获得：不是正的有限数（NaN、Infinity、负数、字符串）一律清成 0。宁可清零也不能留下「无限」
    const num = v => (typeof v === 'number' && isFinite(v) && v > 0 ? v : 0);
    const R = this.data.rush = this.data.rush && typeof this.data.rush === 'object' ? this.data.rush : { best: 0, date: '' };
    R.best = Math.max(0, Math.min(300, Math.floor(Number(R.best)) || 0));
    this.data.coins = Math.floor(num(this.data.coins)); this.data.tickets = Math.floor(num(this.data.tickets)); this.data.earned = num(this.data.earned);
  },
  save() {
    this.data.at = Date.now();
    if (typeof Clock !== 'undefined' && Clock.anchor) Clock.floor(Clock.now());   // 记下确认过的服务器时间：下次没网时最多只能比它晚 36 小时
    try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) { /* 无痕模式等：忽略 */ }
    if (typeof Cloud !== 'undefined') Cloud.dirty();
  },
  /* 用另一份存档整体替换（云存档、存档码），会做和读档一样的清理 */
  replace(d) {
    try { localStorage.setItem(this.KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
    this.load();
    if (typeof Cloud !== 'undefined') Cloud.dirty();
  },
  /* 累计获得：存档里记的数和「打到这一关至少拿过的首通金币」取大的。
   * 老存档没有 earned（或迁移时被填成 0），不兜底的话会输给新设备上的空档 */
  earnedOf(s) {
    let floor = 0; const st = Math.max(1, (s && s.stage) | 0);
    for (let i = 1; i < st; i++) floor += stageWinCoins(i);
    return Math.max(typeof s.earned === 'number' && isFinite(s.earned) ? s.earned : 0, floor);   // Infinity / NaN 不算：不能让一份坏档永远「更新」
  },
  /* 哪份更新：累计获得更多的那份；一样多再比关卡、武将数，最后才比保存时间
   * （启动时会先存一次档，空档的保存时间总是最新，不能先比时间） */
  newer(a, b) {
    if (!b) return true; if (!a) return false;
    const ea = this.earnedOf(a), eb = this.earnedOf(b);
    if (ea !== eb) return ea > eb;
    if ((a.stage || 1) !== (b.stage || 1)) return (a.stage || 1) > (b.stage || 1);
    const ha = Object.keys(a.heroes || {}).length, hb = Object.keys(b.heroes || {}).length;
    if (ha !== hb) return ha > hb;
    return (a.at || 0) > (b.at || 0);
  },
  reset() {
    const gifts = this.data && this.data.gifts;   // 礼包码用过几次跟着带过去：重置存档不能让礼包码重新可用
    try { localStorage.removeItem(this.KEY); } catch (e) {}
    this.data = this.fresh();
    if (Array.isArray(gifts) && gifts.length) this.data.gifts = gifts;
    this.save();
  },
};

/* 获得金币 / 招募令：同时记进累计获得 */
function gain(coins, tickets) {
  const S = Save.data, pos = v => { v = Number(v); return isFinite(v) && v > 0 ? Math.round(v) : 0; };   // 只收正的有限数：NaN、字符串、负数都当 0，免得把金币弄坏或拼成字符串
  coins = pos(coins); tickets = pos(tickets);
  S.coins += coins; S.tickets += tickets;
  S.earned = (S.earned || 0) + coins + tickets * CFG.TICKET_PRICE;
}

/* ---------------- 城池科技（v2.15）：三条没有上限的成长线 ---------------- */
const TECH_MAP = {}; CFG.TECH.forEach(t => { TECH_MAP[t.id] = t; });
function techOpen() { return Save.data.stage > CFG.TECH_OPEN; }
function techLv(id) { const t = Save.data && Save.data.tech; return (t && t[id]) || 0; }
function techMul(id) { return 1 + TECH_MAP[id].per * techLv(id); }
function techCost(id, lv) { const t = TECH_MAP[id]; return Math.round(t.base * Math.pow(t.grow, lv == null ? techLv(id) : lv)); }
function techUp(id) {
  const t = TECH_MAP[id], S = Save.data;
  if (!t) return '没有这项科技';
  if (!techOpen()) return '通关第 ' + CFG.TECH_OPEN + ' 关后开放';
  const c = techCost(id);
  if ((S[t.cur] || 0) < c) return t.curName + '不足（需要 ' + c + '）';
  S[t.cur] -= c; S.tech = S.tech || {}; S.tech[id] = techLv(id) + 1; Save.save();
  return null;
}
/* ---------------- 每日军饷 ---------------- */
function dailyReady() { const d = Save.data.daily || (Save.data.daily = { date: '' }); return isNewDay(d); }
function dailyReward() { const st = Math.max(1, Save.data.stage - 1); return { coins: Math.round(stageWinCoins(st) * CFG.DAILY.coinK), iron: Math.round(stageIron(st) * CFG.DAILY.ironK), tickets: CFG.DAILY.tickets }; }
function dailyClaim() {
  if (!dailyReady()) return null;
  const r = dailyReward(); markDay(Save.data.daily);
  gain(r.coins, r.tickets); Save.data.iron += r.iron; Save.save();
  return r;
}
/* 现在几点：TapTap 里是校准过的服务器时间（platform.js 的 Clock），普通网页、不带画面的模拟是手机时间 */
function nowMs() { return typeof Clock !== 'undefined' ? Clock.now() : Date.now(); }
const BJ = 8 * 36e5;                                           // 每天按北京时间 0 点刷新（改手机时区也提前不了）
function todayStr() {
  const d = new Date(nowMs() + BJ);
  return d.getUTCFullYear() + '-' + (d.getUTCMonth() + 1) + '-' + d.getUTCDate();
}
/* 每日次数按「天序号」（北京时间的日期折算成第几天）判断，只认往后走：
 * 只有今天比记录的那天更晚才算新的一天。把手机日期往前调回去不会让次数重置；
 * TapTap 里用的是服务器时间，往后调也没用（以前比的是日期字符串，来回调就能无限领） */
function dayNo() { return Math.floor((nowMs() + BJ) / 864e5); }
function strDayNo(s) {          // 旧存档里的 'YYYY-M-D' → 天序号（和 dayNo 同一个基准）
  const m = /^(\d+)-(\d+)-(\d+)$/.exec(s || '');
  return m ? Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5) : -1;
}
function recDay(rec) { if (typeof rec.day !== 'number') rec.day = strDayNo(rec.date); return rec.day; }
function isNewDay(rec) { return dayNo() > recDay(rec); }
function markDay(rec) { rec.day = dayNo(); rec.date = todayStr(); }

/* ---------------- 挂机军饷（v2.18） ----------------
 * 每小时 = 最高通关那一关的通关金币 × CFG.IDLE.k，最多攒 CFG.IDLE.maxH 小时。
 * 起点只往后走：把时间往前调不会多给；往后调了再调回来，要等真实时间追上才会再攒 */
function idleInfo() {
  const S = Save.data, I = S.idle && typeof S.idle === 'object' ? S.idle : (S.idle = { t: 0 }), now = nowMs();   // TapTap 里是服务器时间
  if (!(I.t > 0)) I.t = now;                                 // 新档 / 老档第一次：从现在开始攒
  const h = Math.min(CFG.IDLE.maxH, Math.max(0, (now - I.t) / 36e5));
  const perH = Math.round(stageWinCoins(Math.max(1, S.stage - 1)) * CFG.IDLE.k);
  return { h, perH, coins: Math.floor(perH * h), full: h >= CFG.IDLE.maxH };
}
function idleClaim(mul) {
  const r = idleInfo();
  if (r.coins < 1) return 0;
  const c = r.coins * (mul || 1);
  gain(c, 0); Save.data.idle.t = Math.max(Save.data.idle.t, nowMs()); Save.save();
  return c;
}

/* ---------------- 每日试炼（v2.18） ---------------- */
function trialOpen() { return Save.data.stage > CFG.TRIAL.open; }
function trialToday() { const n = TRIALS.length; return TRIALS[((dayNo() % n) + n) % n]; }
function trialStage() { return Math.max(1, Save.data.stage - CFG.TRIAL.back); }
function trialRec() { const S = Save.data; return S.trial && typeof S.trial === 'object' ? S.trial : (S.trial = { date: '' }); }
function trialDone() { return !isNewDay(trialRec()); }        // 今天的首胜奖励领过了
function trialReward(st) { return { iron: Math.max(1, Math.round(stageIron(st) * CFG.TRIAL.iron)), soul: CFG.TRIAL.soul + Math.floor(st / 10), tickets: CFG.TRIAL.tickets }; }
/* ---------------- 名将列传（v2.18）：拥有这名武将才能挑战，首通奖励只领一次 ---------------- */
function legendNeed(L) { return L.need || [L.hero]; }
function legendOpen(L) { return legendNeed(L).every(id => !!heroOwn(id)); }
function legendDone(L) { const S = Save.data; return !!(S.legends && S.legends[L.id]); }
/* 出战阵容：solo 只有他一人（站主帅位）；need 只用这几人；fac 他领衔 + 同阵营最强的补满 */
function legendTeam(L) {
  if (L.team === 'solo') return [null, null, L.hero, null, null];
  if (L.team === 'need') return arrangeTeam(legendNeed(L).filter(id => heroOwn(id)));
  const t = bestTeam(id => HERO_MAP[id].fac === L.fac) || [], ids = t.filter(Boolean);
  if (!ids.includes(L.hero)) { if (ids.length >= 5) { ids.sort((a, b) => heroStats(a).power - heroStats(b).power); ids.shift(); } ids.push(L.hero); }
  return arrangeTeam(ids);
}
/* 人数不满 5 个按人数补强：攻击、城防上限、敌人打武将的伤害基准都按 5 ÷ 人数 放大 */
function legendRule(L, team) {
  const pk = 5 / Math.max(1, team.filter(Boolean).length), sq = Math.sqrt(pk);
  // 攻击和出手速度各放大 √pk（只放大攻击，伤害全砸在一个目标上）；武将血量 × pk（弓手、投石车、敌将专打武将的伤害本来分给五个人，单骑时全落在他一个人身上，模拟里几乎都是武将先倒）
  return { legend: L.id, name: L.name, desc: L.desc, fixed: true, pk, hAtk: sq * (L.hAtk || 1), hSpd: sq, hHp: pk, wall: pk * (L.wallMax || 1), wallStart: L.wallStart || 1,
    rage: L.rage || 1, eHp: L.eHp, eSpd: L.eSpd, eAtk: L.eAtk, bossHp: L.bossHp, bossCd: L.bossCd };
}
function legendPower(L, team) { team = team || legendTeam(L); return Math.round(teamPower(team) * 5 / Math.max(1, team.filter(Boolean).length)); }
function legendReward() { return { shards: CFG.LEGEND.shards, soul: CFG.LEGEND.soul, tickets: CFG.LEGEND.tickets }; }
/* 列传结算：不推进关卡；金币只按掉落给一半；拥有这名武将、第一次赢才给首通奖励 */
function settleLegend(id, win, dropped) {
  const L = LEGEND_MAP[id], S = Save.data, coins = Math.round(Math.max(0, Number(dropped) || 0) * CFG.LEGEND.coinK);
  let r = null;
  if (L && win && legendOpen(L) && !legendDone(L)) {
    r = legendReward(); (S.legends = S.legends && typeof S.legends === 'object' ? S.legends : {})[L.id] = 1;
    const own = heroOwn(L.hero), q = Math.min(HERO_MAP[L.hero].q, CFG.SOUL_VALUE.length - 1);
    if (own.star >= CFG.MAX_STAR) { r.soul += r.shards * CFG.SOUL_VALUE[q]; r.shards = 0; }   // 满星了：碎片按品质折成将魂
    else own.shards += r.shards;
    S.soul = (S.soul || 0) + r.soul;
  }
  gain(coins, r ? r.tickets : 0);
  Save.save();
  return { coins, dropped: coins, tickets: r ? r.tickets : 0, soul: r ? r.soul : 0, shards: r ? r.shards : 0, iron: 0, enc: null, legend: true, legendId: id, first: !!r, again: win && !r };
}
/* ---------------- 过关斩将（v2.19）：打进无尽后开放 ---------------- */
function rushOpen() { return Save.data.stage > CHAPTERS.length * 10; }
function rushRec() { const S = Save.data; return S.rush && typeof S.rush === 'object' ? S.rush : (S.rush = { best: 0, date: '' }); }
function rushDayDone() { return !isNewDay(rushRec()); }       // 今天的首局奖励领过了
/* 纪录从 from 将刷到 to 将：每多斩一将给一份 */
function rushRecordReward(from, to) {
  const R = CFG.RUSH, r = { soul: 0, iron: 0, tickets: 0 };
  for (let k = Math.max(0, from | 0) + 1; k <= Math.min(300, to | 0); k++) { r.soul += R.soul + R.soulK * k; r.iron += Math.max(1, Math.round(stageIron(rushStage(k)) / 2)); r.tickets += R.tickets; }
  return r;
}
/* 结算：kills = 斩了几将。破纪录给纪录奖励；今天第一局按斩将数给将魂；金币按掉落给一半 */
function settleRush(kills, dropped) {
  const S = Save.data, Rd = rushRec(), dv = Number(dropped), coins = isFinite(dv) && dv > 0 ? Math.round(dv * CFG.RUSH.coinK) : 0;
  kills = Math.max(0, Math.min(300, Number(kills) | 0));        // 300 将：实际打不到，只是给乱填的数封个顶
  let rec = null, day = 0;
  if (!rushOpen()) return { coins: 0, dropped: 0, tickets: 0, iron: 0, soul: 0, daySoul: 0, enc: null, rush: true, slain: kills, best: Rd.best, record: false, first: false };   // 没开放（正常进不来）：什么也不给
  if (kills > Rd.best) { rec = rushRecordReward(Rd.best, kills); Rd.best = kills; S.soul = (S.soul || 0) + rec.soul; S.iron = (S.iron || 0) + rec.iron; }
  if (!rushDayDone()) { day = CFG.RUSH.daySoul * Math.min(kills, CFG.RUSH.dayCap); markDay(Rd); S.soul = (S.soul || 0) + day; }
  gain(coins, rec ? rec.tickets : 0);
  Save.save();
  return { coins, dropped: coins, tickets: rec ? rec.tickets : 0, iron: rec ? rec.iron : 0, soul: (rec ? rec.soul : 0) + day, daySoul: day, enc: null, rush: true, slain: kills, best: Rd.best, record: !!rec, first: !!rec };
}
/* 阵营试炼的出战阵容：该阵营里总战力最高的一套（一个都没有返回 null） */
function trialTeam(t) { if (!t.fac) return null; const team = bestTeam(id => HERO_MAP[id].fac === t.fac); return team && team.some(Boolean) ? team : null; }
/* 试炼结算：不推进关卡；金币只给掉落的一半；今天第一次赢给精铁、将魂、招募令 */
function settleTrial(stage, win, dropped) {
  const S = Save.data, coins = Math.round(dropped * CFG.TRIAL.coinK);
  let r = null;
  if (win && !trialDone()) { r = trialReward(stage); markDay(trialRec()); S.iron = (S.iron || 0) + r.iron; S.soul = (S.soul || 0) + r.soul; }
  gain(coins, r ? r.tickets : 0);
  Save.save();
  return { coins, dropped: coins, tickets: r ? r.tickets : 0, iron: r ? r.iron : 0, soul: r ? r.soul : 0, first: !!r, enc: null, trial: true, again: win && !r };
}

/* ---------------- 武将数值 ---------------- */
function heroOwn(id) { return Save.data.heroes[id] || null; }
function heroStats(id, own) {
  const d = HERO_MAP[id], el = ELEMENTS[d.el], q = QUALITIES[d.q];
  own = own || heroOwn(id) || { lv: 1, star: 0 };
  const mul = q.mult * (1 + 0.08 * (own.lv - 1)) * (1 + 0.2 * own.star);
  const awake = own.star >= CFG.AWAKEN_STAR;
  return { atk: Math.round(el.atk * mul), cd: el.cd, hp: Math.round(CFG.HERO_HP * mul * (awake ? CFG.HERO_HP_AWAKE : 1)), power: Math.round(100 * mul * q.pw * (awake ? CFG.AWAKEN_POWER : 1)) };   // hp：生命，升级、升星都涨
}
function heroSkill(id) { return SKILLS[id] || null; }
function heroAwake(id, own) { own = own || heroOwn(id); return !!own && own.star >= CFG.AWAKEN_STAR; }

/* 阵容加成：阵营羁绊 + 缘分 + 站位。team 是 5 个位置的武将 id（空位 null） */
function teamBonus(team) {
  team = team || Save.data.team;
  const out = { atk: 0, spd: 0, crit: 0, rage: 0, ult: 0, wall: 0, el: {}, per: team.map(() => ({ atk: 0, spd: 0, rage: 0, watk: 0, wspd: 0, wcrit: 0, wrage: 0, wult: 0 })), active: [], fac: {}, elc: {} };
  const ids = team.filter(Boolean), add = (eff, k) => { if (eff[k]) out[k] += eff[k]; };
  ids.forEach(id => { const f = HERO_MAP[id].fac; out.fac[f] = (out.fac[f] || 0) + 1; });
  Object.keys(FACTION_BONDS).forEach(f => {
    const n = out.fac[f] || 0, b = FACTION_BONDS[f];
    if (n < 2) return;
    const v = b.vals[Math.min(2, n - 2)];
    out[b.stat] += v;
    out.active.push({ type: 'fac', q: Math.min(5, n), fac: f, name: FACTIONS[f].name + ' · ' + b.name + '（' + n + '）', desc: b.fmt(v), who: ids.filter(id => HERO_MAP[id].fac === f) });   // who：是哪几名武将凑出来的
  });
  ids.forEach(id => { const e = HERO_MAP[id].el; out.elc[e] = (out.elc[e] || 0) + 1; });
  Object.keys(out.elc).forEach(e => {                        // 属性共鸣：同系 3 人以上
    const n = out.elc[e], v = ELEMENT_BOND[Math.min(n, ELEMENT_BOND.length - 1)];
    if (!v) return;
    out.el[e] = (out.el[e] || 0) + v;
    out.active.push({ type: 'elem', q: Math.min(5, n), name: ELEMENTS[e].name + '系共鸣（' + n + '）', desc: ELEMENTS[e].name + '系伤害 +' + Math.round(v * 100) + '%', who: ids.filter(id => HERO_MAP[id].el === e) });
  });
  let rbPick = '';                                           // 彩色缘分一支队伍只生效一组：不然三组叠在一起，别的阵容都不用玩了
  COMBOS.forEach(c => {
    const n = c.ids.filter(id => ids.includes(id)).length;
    if (n < c.need || (c.must && !ids.includes(c.must))) return;
    const who = c.ids.filter(id => ids.includes(id));
    if (c.skill) {                                           // 凑齐了几组彩色：用玩家在羁绊一览里挑的那组（Save.data.rb），没挑就用表里排在前面的
      if (!rbPick) { const ok = COMBOS.filter(x => x.skill && x.ids.filter(id => ids.includes(id)).length >= x.need && (!x.must || ids.includes(x.must))); rbPick = (ok.find(x => x.name === (Save.data && Save.data.rb)) || ok[0]).name; }
      if (c.name !== rbPick) { out.active.push({ type: 'combo', q: 0, off: true, name: c.name, desc: '没有生效：一支队伍只生效一组彩色缘分（现在是「' + rbPick + '」）', who }); return; }
    }
    ['atk', 'spd', 'crit', 'rage', 'ult', 'wall'].forEach(k => add(c.eff, k));
    if (c.eff.el) for (const e in c.eff.el) out.el[e] = (out.el[e] || 0) + c.eff.el[e];
    out.active.push({ type: 'combo', q: c.q, skill: c.skill || '', name: c.name, desc: c.desc, who });
  });
  team.forEach((id, i) => {
    if (!id) return;
    const r = SLOT_ROLES[i], d = HERO_MAP[id], ws = weaponStats(heroWeapon(id), id);
    if (ws) { const p = out.per[i]; p.watk = ws.atk || 0; p.wspd = ws.spd || 0; p.wcrit = ws.crit || 0; p.wrage = ws.rage || 0; p.wult = ws.ult || 0; }
    if (r.leader) {
      const own = heroOwn(id), v = Math.min(5, own ? own.star : 0) * 0.03; out.atk += v; out.per[i].rage += 0.2;   // 主帅看星级（养得好），不看品质
      out.active.push({ type: 'slot', q: Math.max(1, Math.min(5, own ? own.star : 0)), name: '主帅 · ' + d.name, desc: (v ? '全军攻击 +' + Math.round(v * 100) + '%' : '升星后全军攻击每星 +3%') + '，本人怒气获取 +20%' });   // 零星时别写「+0%」，新手会以为主帅位没用
    } else if (r.els.includes(d.el)) {
      if (r.atk) out.per[i].atk += r.atk;
      if (r.spd) out.per[i].spd += r.spd;
    }
  });
  return out;
}
/* 上阵后的战力：基础战力 × 被动 × 羁绊 / 缘分 / 站位 */
function teamPower(team) {
  team = team || Save.data.team;
  const b = teamBonus(team);
  let sum = 0;
  team.forEach((id, i) => {
    if (!id) return;
    const d = HERO_MAP[id], sk = heroSkill(id), m = (sk && sk.passive.mod) || {}, p = b.per[i];
    sum += heroStats(id).power * (1 + (m.atk || 0)) * (1 + (m.spd || 0)) * (1 + b.atk + p.atk) * (1 + b.spd + p.spd) * (1 + b.crit + (m.crit || 0)) * (1 + (b.el[d.el] || 0) * 0.6) * (1 + b.ult * 0.3 + b.rage * 0.35 + p.rage * 0.35)   // 怒气获取 +10% ≈ 战力 +3.5%（模拟器量出来的：原来按 2% 算，怒气叠得多的阵容实际比战力数字强一截）
      * (1 + p.watk) * (1 + p.wspd) * (1 + p.wcrit) * (1 + p.wult * 0.3 + p.wrage * 0.35);   // 兵器
  });
  if (b.active.some(a => a.skill)) sum *= 1 + CFG.BOND_SKILL_POWER;
  sum *= techMul('atk') * (1 + (techMul('ult') - 1) * 0.3 + (techMul('wall') - 1) * 0.2);   // 城池科技：攻击按全额算，大招伤害三折（和缘分里的算法一样），城防两折   // 彩色缘分的合击大招也算战力（不算的话，带彩色缘分的队伍实际比战力数字能打一截，推荐战力就不准了）
  return Math.round(sum);
}
function basePower(team) { return (team || Save.data.team).reduce((s, id) => s + (id ? heroStats(id).power : 0), 0); }
/* 升级花费：从 lv 升到 lv+1（不传 lv = 当前等级）。公式和各章预期等级见《数值规划.md》 */
function levelCost(id, lv) {
  const d = HERO_MAP[id];
  if (lv == null) lv = heroOwn(id).lv;
  return Math.floor(CFG.LEVEL_COST * Math.pow(lv, CFG.LEVEL_COST_POW) * (1 + d.q * 0.25));
}
/* 这名武将升到现在一共花了多少金币 */
function levelSpent(id) {
  const own = heroOwn(id); let s = 0;
  for (let l = 1; l < own.lv; l++) s += levelCost(id, l);
  return s;
}
/* 重置等级：回到 1 级，返还升级花掉的金币（星级不动）。换阵容时把旧武将的金币挪给新武将用 */
function levelReset(id) {
  const own = heroOwn(id);
  if (!own) return '未拥有该武将';
  if (own.lv <= 1) return '已经是 1 级';
  const back = Math.floor(levelSpent(id) * CFG.LEVEL_REFUND);
  own.lv = 1; Save.data.coins += back; Save.save();      // 是退款不是收入：不计入累计获得（云存档比新旧用）
  return back;
}
function levelUp(id) {
  const own = heroOwn(id);
  if (!own) return '未拥有该武将';
  if (own.lv >= CFG.MAX_LEVEL) return '已满级';
  const c = levelCost(id);
  if (Save.data.coins < c) return '金币不足';
  Save.data.coins -= c; own.lv++; Save.save();
  return null;
}
/* 连升 n 级：金币够几级升几级，返回升了几级（0 = 一级都升不起）。等级没有上限以后，一级一级点太累 */
function levelUpMany(id, n) {
  let k = 0;
  while (k < n && !levelUp(id)) k++;
  return k;
}
function levelCostMany(id, n) { const lv = heroOwn(id).lv; let s = 0; for (let i = 0; i < n; i++) s += levelCost(id, lv + i); return s; }
function starNeed(id) {
  const own = heroOwn(id);
  return own.star >= CFG.MAX_STAR ? 0 : CFG.STAR_NEED[own.star];
}
/* 升星还差的碎片，用将魂顶要多少（不差返回 0） */
function starSoulCost(id) {
  const own = heroOwn(id), need = starNeed(id);
  return Math.max(0, need - own.shards) * CFG.SOUL_COST[Math.min(HERO_MAP[id].q, CFG.SOUL_COST.length - 1)];
}
/* 升星：先用自己的碎片，不够的用将魂顶 */
function starUp(id) {
  const own = heroOwn(id);
  if (!own) return '未拥有该武将';
  if (own.star >= CFG.MAX_STAR) return '已满星';
  const need = starNeed(id), soul = starSoulCost(id);
  if (soul > (Save.data.soul || 0)) return '碎片不足，将魂也不够补（把用不上的武将碎片炼化成将魂）';
  Save.data.soul -= soul; own.shards = Math.max(0, own.shards - need); own.star++; Save.save();
  return null;
}
/* 炼化：把这名武将的碎片全部变成将魂（低品武将的重复卡 → 高品武将的升星材料）。返回得到的将魂 */
function heroRefineGain(id) { const own = heroOwn(id); return own ? own.shards * CFG.SOUL_VALUE[Math.min(HERO_MAP[id].q, CFG.SOUL_VALUE.length - 1)] : 0; }
function heroRefine(id) {
  const own = heroOwn(id);
  if (!own || own.shards <= 0) return '没有可炼化的碎片';
  const g = heroRefineGain(id);
  own.shards = 0; Save.data.soul = (Save.data.soul || 0) + g; Save.save();
  return g;
}
/* 一键炼化：没上阵、品质不高于 maxQ 的武将，碎片全部炼化。dry = 只算不做。返回 { soul, n 片 } */
function refineBatch(maxQ, dry) {
  let soul = 0, n = 0;
  Object.keys(Save.data.heroes).forEach(id => {
    const own = Save.data.heroes[id];
    if (HERO_MAP[id].q > maxQ || own.shards <= 0 || Save.data.team.includes(id)) return;
    soul += heroRefineGain(id); n += own.shards;
    if (!dry) own.shards = 0;
  });
  if (!dry && soul) { Save.data.soul = (Save.data.soul || 0) + soul; Save.save(); }
  return { soul, n };
}

/* ---------------- 兵器 ---------------- */
function weaponOwn(wid) { return (Save.data.weapons && Save.data.weapons[wid]) || null; }
/* 这名武将身上装的兵器 id（没有返回 null） */
function heroWeapon(hid) { const W = Save.data.weapons || {}; for (const id in W) if (W[id].hero === hid) return id; return null; }
/* 兵器当前的加成 { atk, spd, … }。lv 不传 = 现在的等级；hid = 装在谁身上（专属武将有额外加成） */
function weaponStats(wid, hid, lv) {
  const w = WEAPON_MAP[wid]; if (!w) return null;
  const own = weaponOwn(wid), k = (1 + CFG.WEAPON_LV_STEP * ((lv || (own ? own.lv : 1)) - 1)) * (w.owner && w.owner === hid ? CFG.WEAPON_OWNER_MUL : 1), out = {};
  for (const s in w.eff) out[s] = w.eff[s] * k;
  return out;
}
function weaponUpCost(wid, lv) { const own = weaponOwn(wid); return Math.ceil(CFG.WEAPON_UP[WEAPON_MAP[wid].q] * (lv || own.lv)); }
function weaponSpent(wid) { const own = weaponOwn(wid); let s = 0; for (let l = 1; l < own.lv; l++) s += weaponUpCost(wid, l); return s; }
/* 抽到一件兵器：没有就收下；已经有了自动熔成精铁。返回 { wid, isNew } 或 { wid, iron } */
const WEAPON_POOL = {};
WEAPONS.forEach(w => { (WEAPON_POOL[w.q] = WEAPON_POOL[w.q] || []).push(w.id); });
function grantWeapon(wid) {
  const S = Save.data, q = WEAPON_MAP[wid].q;
  if (S.weapons[wid]) { const iron = CFG.WEAPON_MELT_VAL[q]; S.iron = (S.iron || 0) + iron; return { wid, iron }; }
  S.weapons[wid] = { lv: 1, hero: null };
  return { wid, isNew: true };
}
function weaponUp(wid) {
  const own = weaponOwn(wid);
  if (!own) return '还没有这件兵器';
  if (own.lv >= CFG.WEAPON_MAX_LV) return '已强化到顶';
  const c = weaponUpCost(wid);
  if (Save.data.iron < c) return '精铁不足';
  Save.data.iron -= c; own.lv++; Save.save();
  return null;
}
/* 装到武将身上（hid 传 null = 卸下）。他原来的兵器卸下；这件兵器原来在别人身上就换过来 */
function weaponEquip(wid, hid) {
  const own = weaponOwn(wid);
  if (!own) return '还没有这件兵器';
  if (hid && !heroOwn(hid)) return '未拥有该武将';
  if (hid) { const old = heroWeapon(hid); if (old && old !== wid) Save.data.weapons[old].hero = null; }
  own.hero = hid || null; Save.save();
  return null;
}
/* 熔掉：返还强化花的全部精铁 + 这件兵器本身值的精铁 */
function weaponMeltBack(wid) { return weaponSpent(wid) + CFG.WEAPON_MELT_VAL[WEAPON_MAP[wid].q]; }
function weaponMelt(wid) {
  if (!weaponOwn(wid)) return '还没有这件兵器';
  const back = weaponMeltBack(wid);
  delete Save.data.weapons[wid]; Save.data.iron += back; Save.save();
  return back;
}

/* ---------------- 布阵 ---------------- */
function teamIndex(id) { return Save.data.team.indexOf(id); }
/* 一键上阵：从面板战力最高的 10 名武将里挑 5 个、排好站位，取总战力（含羁绊、缘分、站位、兵器）最高的那套 */
function bestTeam(only) {
  const pool = Object.keys(Save.data.heroes).filter(id => HERO_MAP[id] && (!only || only(id)))
    .sort((a, b) => heroStats(b).power - heroStats(a).power).slice(0, 10);
  if (pool.length <= 5) return arrangeTeam(pool);
  let best = null, bp = -1;
  const pick = [];
  (function rec(i) {
    if (pick.length === 5) { const t = arrangeTeam(pick), p = teamPower(t); if (p > bp) { bp = p; best = t; } return; }
    if (pool.length - i < 5 - pick.length) return;
    pick.push(pool[i]); rec(i + 1); pick.pop(); rec(i + 1);
  })(0);
  return best;
}
/* 排站位：星级最高的当主帅（主帅加成看星级），其余按系别放到有加成的位置，放不下的补空位 */
function arrangeTeam(ids) {
  const t = [null, null, null, null, null];
  const rest = ids.slice().sort((a, b) => (heroOwn(b).star - heroOwn(a).star) || (heroStats(b).power - heroStats(a).power));
  if (rest.length) t[2] = rest.shift();
  const left = [];
  rest.sort((a, b) => heroStats(b).power - heroStats(a).power).forEach(id => {
    const i = [0, 1, 3, 4].find(k => !t[k] && SLOT_ROLES[k].els.includes(HERO_MAP[id].el));
    if (i != null) t[i] = id; else left.push(id);
  });
  left.forEach(id => { const i = [0, 1, 3, 4].find(k => !t[k]); if (i != null) t[i] = id; });
  return t;
}
/* 阵容里有没有「金币够、等级还低」的武将：前期提示去升级（等级追上关卡数就不再提示） */
function teamCanLevel() {
  const S = Save.data;
  return S.team.some(id => id && S.heroes[id] && S.heroes[id].lv < S.stage && S.coins >= levelCost(id));
}
function teamSet(slot, id) {
  const t = Save.data.team, old = t.indexOf(id);
  if (old >= 0) t[old] = null;
  t[slot] = id; Save.save();
}
/* 交换两个位置（空位也行） */
function teamSwap(a, b) {
  const t = Save.data.team, x = t[a]; t[a] = t[b]; t[b] = x; Save.save();
}
function teamRemove(id) {
  const t = Save.data.team, i = t.indexOf(id);
  if (i < 0) return;
  if (t.filter(Boolean).length <= 1) return '至少要留一名武将守城';
  t[i] = null; Save.save();
  return null;
}

/* ---------------- 经济：金币换招募令 ---------------- */
function buyTickets(n) {
  n = Math.floor(Number(n));                                   // 只认正整数：传进来字符串 '10' 时 tickets += '10' 会拼成字符串（19 → '1910'）
  if (!(n >= 1)) return '金币不足';
  const cost = n * CFG.TICKET_PRICE;
  if (Save.data.coins < cost) return '金币不足';
  Save.data.coins -= cost; Save.data.tickets += n; Save.save();
  return null;
}

/* ---------------- 广告（播放见 platform.js 的 AdService） ---------------- */
function adLeft() {
  const ad = Save.data.ad;
  if (isNewDay(ad)) { markDay(ad); ad.count = 0; }
  return Math.max(0, CFG.AD_DAILY_LIMIT - ad.count);
}
function adGrant() {
  if (adLeft() <= 0) return false;
  Save.data.ad.count++;
  gain(0, CFG.AD_REWARD);
  Save.save();
  return true;
}

/* ---------------- 扫荡：已通关的关卡直接领奖励，每日有次数 ---------------- */
function sweepDay() {
  const sw = Save.data.sweep;
  if (isNewDay(sw)) { markDay(sw); sw.count = 0; sw.ad = 0; }
  return sw;
}
function sweepLeft() { const sw = sweepDay(); return Math.max(0, CFG.SWEEP_DAILY + (sw.ad || 0) - sw.count); }
/* 看广告多扫荡：今天还能看几次；看完一次记一次（记完马上调 sweep() 用掉） */
function sweepAdLeft() { const sw = sweepDay(); return Math.max(0, CFG.AD_SWEEP_DAILY - (sw.ad || 0)); }
function sweepAdGrant() {
  if (sweepAdLeft() <= 0) return false;
  const sw = Save.data.sweep; sw.ad = (sw.ad || 0) + 1; Save.save();
  return true;
}
function sweepReward(stage) { return Math.round(stageWinCoins(stage) * CFG.SWEEP_MUL); }
function sweep(stage) {
  if (stage >= Save.data.stage) return '通关后才能扫荡';
  if (sweepLeft() <= 0) return '今日扫荡次数已用完';
  Save.data.sweep.count++;
  const c = sweepReward(stage);
  gain(c, 0); Save.data.iron += stageIron(stage); Save.save();
  return c;
}

/* ---------------- 抽卡 ---------------- */
const GACHA_POOL = {};
HEROES.forEach(h => { if (!h.locked && !h.myth) (GACHA_POOL[h.q] = GACHA_POOL[h.q] || []).push(h.id); });   // 神魔不在这里：解锁之后和橙将一起出（见 gachaDraw）

function rollQuality() {
  const qs = QUALITIES.filter(q => q.rate > 0);
  const total = qs.reduce((s, q) => s + q.rate, 0);
  let r = Math.random() * total;
  for (const q of qs) { if ((r -= q.rate) <= 0) return q.id; }
  return 0;
}
function grantHero(id) {
  const d = HERO_MAP[id];
  let own = Save.data.heroes[id];
  if (!own) {
    Save.data.heroes[id] = { lv: 1, star: 0, shards: 0 };
    const empty = Save.data.team.indexOf(null);
    if (empty >= 0) Save.data.team[empty] = id;   // 有空位自动上阵
    return { id, isNew: true };
  }
  if (own.star >= CFG.MAX_STAR) {                         // 满星了：直接变成将魂
    const soul = CFG.SOUL_VALUE[Math.min(d.q, CFG.SOUL_VALUE.length - 1)];
    Save.data.soul = (Save.data.soul || 0) + soul;
    return { id, isNew: false, soul };
  }
  own.shards++;
  return { id, isNew: false, shard: 1 };
}
/* 抽 n 次（1 或 10）。返回结果数组（武将 { id, … } 或兵器 { wid, … }）；招募令不足返回 null */
function gachaDraw(n) {
  const S = Save.data;
  if (S.tickets < n) return null;
  S.tickets -= n;
  const qs = [];
  for (let i = 0; i < n; i++) {
    S.draws++;
    qs.push(rollQuality());
  }
  if (n >= 10 && !qs.some(q => q >= CFG.TEN_GUARANTEE_Q)) qs[n - 1] = CFG.TEN_GUARANTEE_Q;
  const res = qs.map(q => {
    S.pity++;
    const must = S.pity >= CFG.PITY;                        // 保底：这么多抽没出金品以上的武将，这一抽必出金品武将（兵器不算，也不清零；这一抽本来是橙就还是橙）
    if (must && q < CFG.PITY_Q) q = CFG.PITY_Q;
    let wp = (WEAPON_POOL[q] || []).filter(id => weaponOpen(WEAPON_MAP[id], S.unlocked));   // 兵器和武将在同一个池子里：先定品质，再看这一抽是兵器还是武将（没解锁的神兽兵器、神魔兵器不在池子里）
    if (q === 5) wp = wp.concat(WEAPONS.filter(w => w.q > 5 && weaponOpen(w, S.unlocked)).map(w => w.id));   // 已解锁的神魔兵器（黑、彩）和橙品兵器共用橙品的概率，和神魔本人一个规矩
    if (!must && wp.length && Math.random() < CFG.WEAPON_SHARE) return grantWeapon(wp[Math.floor(Math.random() * wp.length)]);
    if (q >= CFG.PITY_Q) S.pity = 0;
    let pool = GACHA_POOL[q];
    if (q === 5) { const myths = HEROES.filter(h => h.myth && S.unlocked && S.unlocked[h.id]).map(h => h.id); if (myths.length) pool = pool.concat(myths); }   // 已解锁的神魔和橙将共用橙品的概率
    return grantHero(pool[Math.floor(Math.random() * pool.length)]);
  });
  Save.save();
  return res;
}

/* ---------------- 关卡结算 ---------------- */
function settleBattle(stage, win, wavesCleared, dropped, encId) {
  const S = Save.data;
  encSettle();                                                 // 这一局的奇遇掷骰到这里才算用掉
  const base = Math.round(stageWinCoins(stage) * (stage < S.stage ? CFG.REPLAY_COIN : 1));   // 重复打已通关的关：通关金币打折（掉落照常）
  const coins = dropped + (win ? base : Math.floor(base * 0.3 * wavesCleared / CFG.WAVES));
  let tickets = 0, first = false;
  if (win && stage >= S.stage) {
    first = true;
    tickets = (stage % 10 === 0) ? 5 : 1;       // 首通奖励，章节末关给 5 张
    S.stage = stage + 1;
    S.pick = S.stage;
  }
  const ironBase = stageIron(stage) * (stage < S.stage && !first ? CFG.REPLAY_COIN : 1);              // 精铁：重复通关同样减半；战败按打过的波数给三成
  const iron = win ? Math.max(1, Math.round(ironBase)) : Math.floor(ironBase * 0.3 * wavesCleared / CFG.WAVES);
  gain(coins, tickets); S.iron = (S.iron || 0) + iron;
  const enc = encId ? encounterReward(stage, encId) : null;   // 奇遇里击败了山贼首领 / 神兽（输了这一关也算）
  Save.save();
  return { coins, tickets, first, dropped, iron, enc };
}

/* ---------------- 奇遇 ---------------- */
/* 出征时掷一次：这一局会不会碰上山贼首领 / 神兽（没有返回 null）。神兽优先出兵器还没解锁的那几只 */
function rollEncounter(stage) {
  const S = Save.data;
  S.enc = (S.enc && typeof S.enc === 'object') ? S.enc : { n: 0, kills: {} }; S.enc.kills = S.enc.kills || {}; S.enc.seen = S.enc.seen || {};
  S.unlocked = (S.unlocked && typeof S.unlocked === 'object') ? S.unlocked : {};
  // 上一局掷出来、还没打完（中途退出 / 重新开始）的结果接着用：不然连点「重新开始」就能把奇遇刷出来（2026-11-18 资源审计）
  const P = S.enc.pending;
  if (P && typeof P === 'object') { const e = P.id ? ENC_MAP[P.id] : null; return e && stage >= e.from ? e : null; }
  const of = k => ENCOUNTERS.filter(e => e.kind === k && stage >= e.from), beasts = of('beast'), bandits = of('bandit');
  const r = Math.random();
  let kind = beasts.length && r < CFG.ENC.beast ? 'beast' : bandits.length && r < CFG.ENC.beast + CFG.ENC.bandit ? 'bandit' : null;
  if (!kind && bandits.length && S.enc.n >= CFG.ENC.pity) kind = beasts.length && Math.random() < 0.3 ? 'beast' : 'bandit';
  let out = null;
  if (kind) { const L = kind === 'beast' ? beasts : bandits, fresh = L.filter(e => e.weapon && !S.unlocked[e.weapon]), list = fresh.length ? fresh : L; out = list[Math.floor(Math.random() * list.length)]; }
  S.enc.pending = { id: out ? out.id : '' }; Save.save();   // 记进存档：关掉游戏重开也还是这个结果
  return out;
}
/* 一局打完（赢输都算）才结掉这次掷骰：保底计数这时候才加 / 清零。中途退出不算，下一局还用同一个结果 */
function encSettle() {
  const S = Save.data, E = S.enc;
  if (!E || !E.pending) return;
  if (E.pending.id) E.n = 0; else E.n = (E.n || 0) + 1;
  delete E.pending;
}
/* 击败之后的奖励：山贼首领给赏金；神兽第一次击败解锁兵器，以后再击败给重赏和精铁 */
function encounterReward(stage, id) {
  const e = ENC_MAP[id], S = Save.data; if (!e) return null;
  S.enc = S.enc || { n: 0, kills: {} }; S.enc.kills = S.enc.kills || {}; S.unlocked = S.unlocked || {};
  S.enc.kills[id] = (S.enc.kills[id] || 0) + 1;
  const out = { id, name: e.name, kind: e.kind, coins: 0, iron: 0, unlock: null };
  if (e.weapon && !S.unlocked[e.weapon]) { S.unlocked[e.weapon] = 1; out.unlock = e.weapon; out.coins = Math.round(stageWinCoins(stage) * 1.5); }
  else { out.coins = Math.round(stageWinCoins(stage) * e.coinK); if (e.kind === 'beast') out.iron = stageIron(stage) * 3; }
  gain(out.coins, 0); S.iron = (S.iron || 0) + out.iron;
  return out;
}

/* ---------------- 礼包码 ---------------- */
/* 成功返回礼包内容 { tickets, coins, note }，失败返回错误文字 */
function redeemGift(code) {
  const key = String(code || '').replace(/[\s-]+/g, '').toUpperCase(), g = Object.prototype.hasOwnProperty.call(CFG.GIFT_CODES, key) ? CFG.GIFT_CODES[key] : null;
  const S = Save.data;
  S.gifts = Array.isArray(S.gifts) ? S.gifts : [];
  if (!g) {                                                    // 不是固定的礼包码：看是不是 TapTap 签到活动的码（校验位对得上才认）
    const G = CFG.GIFT_SIGN, m = G && /^FH([A-Z])([2-9A-HJKMNP-Z]{6})([2-9A-HJKMNP-Z]{3})$/.exec(key);
    const t = m && Object.prototype.hasOwnProperty.call(G.tiers, m[1]) ? G.tiers[m[1]] : null;
    if (!t || signCheck(G.id, G.salt, m[1], m[2]) !== m[3]) return '礼包码不对';
    const tag = 'SIGN:' + G.id + ':' + m[1];                    // 按「哪一期、哪一档」记，不按码记：同一档换多少个码都只能领一次
    if (S.gifts.includes(tag)) return '累计签到第 ' + t.day + ' 天的礼包已经领过了（每档只能领一次）';
    S.gifts.push(tag);
    gain(t.coins || 0, t.tickets || 0);
    const pos = v => { v = Number(v); return isFinite(v) && v > 0 ? Math.round(v) : 0; };
    S.iron = (S.iron || 0) + pos(t.iron); S.soul = (S.soul || 0) + pos(t.soul);
    Save.save();
    return { left: 0, tickets: t.tickets || 0, coins: t.coins || 0, iron: pos(t.iron), soul: pos(t.soul), day: t.day };
  }
  const tag = g.ver ? key + '@' + g.ver : key, times = g.times || 1, used = S.gifts.filter(k => k === tag).length;   // 带版本号记：改了 ver 以前用过的不算
  if (used >= times) return times > 1 ? '这个礼包码已经用满 ' + times + ' 次了' : '这个礼包码已经用过了';
  S.gifts.push(tag);
  gain(g.coins || 0, g.tickets || 0);
  Save.save();
  return Object.assign({ left: times - used - 1 }, g);
}

/* ---------------- 存档码：换设备 / 清数据时手动备份 ---------------- */
const SAVE_CODE_TAG = 'SGTD1';
function codeHash(str) {
  let h = 0x811c9dc5;
  const s = str + '|fenghuo-shoucheng';
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}
function saveCode() {
  const b = btoa(unescape(encodeURIComponent(JSON.stringify(Save.data))));
  return SAVE_CODE_TAG + '-' + b + '-' + codeHash(b);
}
/* 解析存档码：成功返回存档对象，失败返回错误文字 */
function parseSaveCode(str) {
  const m = String(str || '').replace(/\s+/g, '').match(/^SGTD1-([A-Za-z0-9+/=]+)-([0-9a-z]+)$/);
  if (!m) return '存档码格式不对';
  if (codeHash(m[1]) !== m[2]) return '存档码不完整或被改动过';
  try {
    const d = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
    if (!d || typeof d !== 'object' || !d.heroes) return '存档码内容有误';
    return d;
  } catch (e) { return '存档码内容有误'; }
}
