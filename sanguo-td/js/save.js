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
    };
  },
  load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (e) { d = null; }
    this.data = Object.assign(this.fresh(), d || {});
    // 清理存档里已不存在的武将
    Object.keys(this.data.heroes).forEach(id => { if (!HERO_MAP[id]) delete this.data.heroes[id]; });
    this.data.team = this.data.team.map(id => (id && this.data.heroes[id] ? id : null));
    while (this.data.team.length < 5) this.data.team.push(null);
  },
  save() {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) { /* 无痕模式等：忽略 */ }
  },
  reset() {
    try { localStorage.removeItem(this.KEY); } catch (e) {}
    this.data = this.fresh();
    this.save();
  },
};

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
function teamPower() {
  return Save.data.team.reduce((s, id) => s + (id ? heroStats(id).power : 0), 0);
}
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

/* ---------------- 广告 ---------------- */
function adLeft() {
  const ad = Save.data.ad;
  if (ad.date !== todayStr()) { ad.date = todayStr(); ad.count = 0; }
  return Math.max(0, CFG.AD_DAILY_LIMIT - ad.count);
}
function adGrant() {
  if (adLeft() <= 0) return false;
  Save.data.ad.count++;
  Save.data.tickets += CFG.AD_REWARD;
  Save.save();
  return true;
}

/* 广告服务：
 *  - TapTap 小游戏（tap.createRewardedVideoAd）/ 抖音小游戏（tt.…）走平台真实激励视频，
 *    两家接口一致，只需把 AD_UNIT_ID 换成后台申请的广告位 ID
 *  - 普通网页走模拟广告（倒计时遮罩），方便本地调试
 * showRewarded() 返回 Promise：true = 完整看完可发奖；false = 中途关闭；null = 暂时没有广告 */
const AdService = {
  AD_UNIT_ID: 'YOUR_AD_UNIT_ID',
  _ad: null, _done: null,
  platform() {
    if (typeof tap !== 'undefined' && tap.createRewardedVideoAd) return tap;
    if (typeof tt !== 'undefined' && tt.createRewardedVideoAd) return tt;
    return null;
  },
  showRewarded() {
    const p = this.platform();
    if (!p) return UI.fakeAd(CFG.AD_SECONDS);
    if (!this._ad) {                       // 平台规定全局只有一个实例，回调只注册一次
      this._ad = p.createRewardedVideoAd({ adUnitId: this.AD_UNIT_ID });
      this._ad.onClose(res => this._finish(!!(res && res.isEnded)));
      this._ad.onError(() => {});          // 拉取失败由下面的 show/load 重试处理
    }
    return new Promise(resolve => {
      this._done = resolve;
      const ad = this._ad;
      ad.show().catch(() => ad.load().then(() => ad.show()).catch(() => this._finish(null)));
    });
  },
  _finish(result) { const d = this._done; this._done = null; if (d) d(result); },
};

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
  if (own.star >= CFG.MAX_STAR && own.shards >= 0) {
    const coins = Math.round(CFG.SHARD_TO_COIN * QUALITIES[d.q].mult);
    Save.data.coins += coins;
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
  S.coins += coins; S.tickets += tickets;
  Save.save();
  return { coins, tickets, first, dropped };
}
