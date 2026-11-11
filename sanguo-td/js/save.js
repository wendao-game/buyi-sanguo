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
  return { atk: Math.round(el.atk * mul), cd: el.cd, power: Math.round(100 * mul) };
}
function heroSkill(id) { return SKILLS[id] || null; }
function heroAwake(id, own) { own = own || heroOwn(id); return !!own && own.star >= CFG.AWAKEN_STAR; }

/* 阵容加成：阵营羁绊 + 缘分 + 站位。team 是 5 个位置的武将 id（空位 null） */
function teamBonus(team) {
  team = team || Save.data.team;
  const out = { atk: 0, spd: 0, crit: 0, rage: 0, ult: 0, wall: 0, el: {}, per: team.map(() => ({ atk: 0, spd: 0, rage: 0 })), active: [], fac: {} };
  const ids = team.filter(Boolean), add = (eff, k) => { if (eff[k]) out[k] += eff[k]; };
  ids.forEach(id => { const f = HERO_MAP[id].fac; out.fac[f] = (out.fac[f] || 0) + 1; });
  Object.keys(FACTION_BONDS).forEach(f => {
    const n = out.fac[f] || 0, b = FACTION_BONDS[f];
    if (n < 2) return;
    const v = b.vals[Math.min(2, n - 2)];
    out[b.stat] += v;
    out.active.push({ type: 'fac', fac: f, name: FACTIONS[f].name + ' · ' + b.name + '（' + n + '）', desc: b.fmt(v) });
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
    const r = SLOT_ROLES[i], d = HERO_MAP[id];
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
    sum += heroStats(id).power * (1 + (m.atk || 0)) * (1 + (m.spd || 0)) * (1 + b.atk + p.atk) * (1 + b.spd + p.spd) * (1 + b.crit + (m.crit || 0)) * (1 + (b.el[d.el] || 0) * 0.6) * (1 + b.ult * 0.3 + b.rage * 0.2 + p.rage * 0.2);
  });
  return Math.round(sum);
}
function basePower(team) { return (team || Save.data.team).reduce((s, id) => s + (id ? heroStats(id).power : 0), 0); }
function levelCost(id) {
  const own = heroOwn(id), d = HERO_MAP[id];
  return Math.floor(30 * Math.pow(own.lv, 1.3) * (1 + d.q * 0.25));
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
function starUp(id) {
  const own = heroOwn(id);
  if (!own) return '未拥有该武将';
  if (own.star >= CFG.MAX_STAR) return '已满星';
  const need = starNeed(id);
  if (own.shards < need) return '碎片不足（重复抽到可获得碎片）';
  own.shards -= need; own.star++; Save.save();
  return null;
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
  gain(c, 0); Save.save();
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
  if (own.star >= CFG.MAX_STAR) {
    const coins = Math.round(CFG.SHARD_TO_COIN * QUALITIES[d.q].mult);
    gain(coins, 0);
    return { id, isNew: false, coins };
  }
  own.shards++;
  return { id, isNew: false, shard: 1 };
}
/* 抽 n 次（1 或 10）。返回结果数组；招募令不足返回 null */
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
    const pool = GACHA_POOL[q];
    return grantHero(pool[Math.floor(Math.random() * pool.length)]);
  });
  Save.save();
  return res;
}

/* ---------------- 关卡结算 ---------------- */
function settleBattle(stage, win, wavesCleared, dropped) {
  const S = Save.data;
  const base = stageWinCoins(stage);
  const coins = dropped + (win ? base : Math.floor(base * 0.3 * wavesCleared / CFG.WAVES));
  let tickets = 0, first = false;
  if (win && stage >= S.stage) {
    first = true;
    tickets = (stage % 10 === 0) ? 5 : 1;       // 首通奖励，章节末关给 5 张
    S.stage = stage + 1;
    S.pick = S.stage;
  }
  gain(coins, tickets);
  Save.save();
  return { coins, tickets, first, dropped };
}

/* ---------------- 礼包码 ---------------- */
/* 成功返回礼包内容 { tickets, coins, note }，失败返回错误文字 */
function redeemGift(code) {
  const key = String(code || '').replace(/\s+/g, '').toUpperCase(), g = CFG.GIFT_CODES[key];
  if (!g) return '礼包码不对';
  const S = Save.data;
  S.gifts = Array.isArray(S.gifts) ? S.gifts : [];
  if (S.gifts.includes(key)) return '这个礼包码已经用过了';
  S.gifts.push(key);
  gain(g.coins || 0, g.tickets || 0);
  Save.save();
  return g;
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
