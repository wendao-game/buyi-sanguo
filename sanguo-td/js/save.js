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
      gfx: 'gl',           // 战斗画面：'gl' 高清（WebGL），'2d' 兼容
      sound: true,         // 音效开关
      music: true,         // 背景音乐开关
      iron: 0,             // 精铁（强化兵器用）
      soul: 0,             // 将魂（碎片炼化得来，升星时顶碎片用）
      weapons: {},         // 已有的兵器：id → { lv, hero: 装在谁身上 / null }
      tips: {},            // 已经看过的新手提示
      earned: 0,           // 累计获得的金币（招募令按兑换价折算），只增不减：云存档合并时取更大的那份
      at: 0,               // 最后保存时间
      ver: 2,
    };
  },
  load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (e) { d = null; }
    this.data = Object.assign(this.fresh(), d || {});
    // 清理存档里已不存在的武将
    Object.keys(this.data.heroes).forEach(id => { if (!HERO_MAP[id]) delete this.data.heroes[id]; });
    this.data.team = (Array.isArray(this.data.team) ? this.data.team : []).slice(0, 5).map(id => (id && this.data.heroes[id] ? id : null));
    while (this.data.team.length < 5) this.data.team.push(null);
    if (!this.data.team.some(Boolean)) { const first = Object.keys(this.data.heroes)[0]; if (first) this.data.team[2] = first; }
    // 兵器：清掉已不存在的；装在不存在的武将身上、或者两件装在同一个人身上的，卸下来
    const W = this.data.weapons = (this.data.weapons && typeof this.data.weapons === 'object') ? this.data.weapons : {}, used = {};
    Object.keys(W).forEach(id => { const w = W[id]; if (!WEAPON_MAP[id] || !w) return delete W[id]; w.lv = Math.max(1, Math.min(CFG.WEAPON_MAX_LV, w.lv | 0)); if (w.hero && (!this.data.heroes[w.hero] || used[w.hero])) w.hero = null; if (w.hero) used[w.hero] = 1; });
    this.data.iron = Math.max(0, this.data.iron | 0); this.data.soul = Math.max(0, this.data.soul | 0);
  },
  save() {
    this.data.at = Date.now();
    try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) { /* 无痕模式等：忽略 */ }
    if (typeof Cloud !== 'undefined') Cloud.dirty();
  },
  /* 用另一份存档整体替换（云存档、存档码），会做和读档一样的清理 */
  replace(d) {
    try { localStorage.setItem(this.KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
    this.load();
    if (typeof Cloud !== 'undefined') Cloud.dirty();
  },
  /* 哪份更新：累计获得更多的那份；一样多取后保存的 */
  newer(a, b) {
    if (!b) return true; if (!a) return false;
    if ((a.earned || 0) !== (b.earned || 0)) return (a.earned || 0) > (b.earned || 0);
    return (a.at || 0) > (b.at || 0);
  },
  reset() {
    try { localStorage.removeItem(this.KEY); } catch (e) {}
    this.data = this.fresh();
    this.save();
  },
};

/* 获得金币 / 招募令：同时记进累计获得 */
function gain(coins, tickets) {
  const S = Save.data;
  S.coins += coins || 0; S.tickets += tickets || 0;
  S.earned = (S.earned || 0) + (coins || 0) + (tickets || 0) * CFG.TICKET_PRICE;
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

/* ---------------- 武将数值 ---------------- */
function heroOwn(id) { return Save.data.heroes[id] || null; }
function heroStats(id, own) {
  const d = HERO_MAP[id], el = ELEMENTS[d.el], q = QUALITIES[d.q];
  own = own || heroOwn(id) || { lv: 1, star: 0 };
  const mul = q.mult * (1 + 0.08 * (own.lv - 1)) * (1 + 0.2 * own.star);
  return { atk: Math.round(el.atk * mul), cd: el.cd, power: Math.round(100 * mul * q.pw * (own.star >= CFG.AWAKEN_STAR ? CFG.AWAKEN_POWER : 1)) };
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
    out.active.push({ type: 'fac', fac: f, name: FACTIONS[f].name + ' · ' + b.name + '（' + n + '）', desc: b.fmt(v) });
  });
  ids.forEach(id => { const e = HERO_MAP[id].el; out.elc[e] = (out.elc[e] || 0) + 1; });
  Object.keys(out.elc).forEach(e => {                        // 属性共鸣：同系 3 人以上
    const n = out.elc[e], v = ELEMENT_BOND[Math.min(n, ELEMENT_BOND.length - 1)];
    if (!v) return;
    out.el[e] = (out.el[e] || 0) + v;
    out.active.push({ type: 'elem', name: ELEMENTS[e].name + '系共鸣（' + n + '）', desc: ELEMENTS[e].name + '系伤害 +' + Math.round(v * 100) + '%' });
  });
  COMBOS.forEach(c => {
    const n = c.ids.filter(id => ids.includes(id)).length;
    if (n < c.need) return;
    ['atk', 'spd', 'crit', 'rage', 'ult', 'wall'].forEach(k => add(c.eff, k));
    if (c.eff.el) for (const e in c.eff.el) out.el[e] = (out.el[e] || 0) + c.eff.el[e];
    out.active.push({ type: 'combo', name: c.name, desc: c.desc });
  });
  team.forEach((id, i) => {
    if (!id) return;
    const r = SLOT_ROLES[i], d = HERO_MAP[id], ws = weaponStats(heroWeapon(id), id);
    if (ws) { const p = out.per[i]; p.watk = ws.atk || 0; p.wspd = ws.spd || 0; p.wcrit = ws.crit || 0; p.wrage = ws.rage || 0; p.wult = ws.ult || 0; }
    if (r.leader) {
      const v = d.q * 0.03; out.atk += v; out.per[i].rage += 0.2;
      out.active.push({ type: 'slot', name: '主帅 · ' + d.name, desc: '全军攻击 +' + Math.round(v * 100) + '%，本人怒气获取 +20%' });
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
    sum += heroStats(id).power * (1 + (m.atk || 0)) * (1 + (m.spd || 0)) * (1 + b.atk + p.atk) * (1 + b.spd + p.spd) * (1 + b.crit + (m.crit || 0)) * (1 + (b.el[d.el] || 0) * 0.6) * (1 + b.ult * 0.3 + b.rage * 0.2 + p.rage * 0.2)
      * (1 + p.watk) * (1 + p.wspd) * (1 + p.wcrit) * (1 + p.wult * 0.3 + p.wrage * 0.2);   // 兵器
  });
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
  const cost = n * CFG.TICKET_PRICE;
  if (n <= 0 || Save.data.coins < cost) return '金币不足';
  Save.data.coins -= cost; Save.data.tickets += n; Save.save();
  return null;
}

/* ---------------- 广告（播放见 platform.js 的 AdService） ---------------- */
function adLeft() {
  const ad = Save.data.ad;
  if (ad.date !== todayStr()) { ad.date = todayStr(); ad.count = 0; }
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
function sweepLeft() {
  const sw = Save.data.sweep;
  if (sw.date !== todayStr()) { sw.date = todayStr(); sw.count = 0; }
  return Math.max(0, CFG.SWEEP_DAILY - sw.count);
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
HEROES.forEach(h => { if (!h.locked) (GACHA_POOL[h.q] = GACHA_POOL[h.q] || []).push(h.id); });

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
    S.pity++; S.draws++;
    let q = rollQuality();
    if (S.pity >= CFG.PITY) q = 5;
    if (q >= 5) S.pity = 0;
    qs.push(q);
  }
  if (n >= 10 && !qs.some(q => q >= CFG.TEN_GUARANTEE_Q)) qs[n - 1] = CFG.TEN_GUARANTEE_Q;
  const res = qs.map(q => {
    const wp = WEAPON_POOL[q];                              // 兵器和武将在同一个池子里：先定品质，再看这一抽是兵器还是武将
    if (wp && Math.random() < CFG.WEAPON_SHARE) return grantWeapon(wp[Math.floor(Math.random() * wp.length)]);
    const pool = GACHA_POOL[q];
    return grantHero(pool[Math.floor(Math.random() * pool.length)]);
  });
  Save.save();
  return res;
}

/* ---------------- 关卡结算 ---------------- */
function settleBattle(stage, win, wavesCleared, dropped) {
  const S = Save.data;
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
  Save.save();
  return { coins, tickets, first, dropped, iron };
}

/* ---------------- 礼包码 ---------------- */
/* 成功返回礼包内容 { tickets, coins, note }，失败返回错误文字 */
function redeemGift(code) {
  const key = String(code || '').replace(/\s+/g, '').toUpperCase(), g = CFG.GIFT_CODES[key];
  if (!g) return '礼包码不对';
  const S = Save.data;
  S.gifts = Array.isArray(S.gifts) ? S.gifts : [];
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
