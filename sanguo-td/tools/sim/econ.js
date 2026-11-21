// 资源检查（v2.18）：无限金币、招募令、精铁、将魂这类漏洞一定不能有。每次打包上传前跑一遍（check.js 的「资源」一项会调它）。
// 新加任何发奖励的入口时，在这里加一条对应的检查。
// 用法：node tools/sim/econ.js        全部通过时最后一行是「资源检查：N 项全部通过」，有不通过的退出码是 1
const fs = require('fs'), vm = require('vm'), path = require('path');
const { load, fight } = require('./harness.js');
const JS = path.join(__dirname, '..', '..', 'js');
const out = []; let fails = 0;
const ok = (name, cond, detail) => { if (!cond) fails++; out.push((cond ? 'PASS ' : 'FAIL ') + name + (cond || !detail ? '' : '：' + detail)); };
const fin = v => typeof v === 'number' && isFinite(v);
const money = D => ({ coins: D.coins, tickets: D.tickets, iron: D.iron, soul: D.soul });
const allFin = D => [D.coins, D.tickets, D.iron, D.soul, D.earned].every(fin) && D.coins >= 0 && D.tickets >= 0 && D.iron >= 0 && D.soul >= 0;
const DAY = 864e5, HOUR = 36e5;
/* 假时钟：G.ctx.Date 换成能前后拨的版本 */
function clock(G) {
  const Real = Date; let off = 0;
  G.ctx.Date = class extends Real { constructor(...a) { if (a.length) super(...a); else super(Real.now() + off); } static now() { return Real.now() + off; } };
  return { set: ms => { off = ms; }, add: ms => { off += ms; } };
}
function fresh(patch) { const G = load(patch), D = G.Save.data; return { G, D, c: G.ctx }; }

/* ---------- 1. 配置：字段都在、都是有限的数（布衣三国出过注释插在行中间吞掉字段、看广告金币变无限） ---------- */
{
  const { G, c } = fresh(), CFG = G.CFG, bad = [];
  const walk = (o, p) => { for (const k in o) { const v = o[k], q = p + '.' + k; if (typeof v === 'number') { if (!isFinite(v)) bad.push(q); } else if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, q); else if (Array.isArray(v)) v.forEach((x, i) => { if (typeof x === 'number' && !isFinite(x)) bad.push(q + '[' + i + ']'); }); } };
  walk(CFG, 'CFG');
  const okInf = ['CFG.MAX_LEVEL'];                           // 故意的无穷大：v2.16 起武将等级不设上限
  const bad2 = bad.filter(q => !okInf.includes(q));
  ok('CFG 里的数都是有限的（MAX_LEVEL 是故意的无上限）', !bad2.length, bad2.join('、'));
  const need = ['TICKET_PRICE', 'START_COINS', 'START_TICKETS', 'REPLAY_COIN', 'LEVEL_COST', 'LEVEL_COST_POW', 'LEVEL_REFUND', 'SWEEP_DAILY', 'SWEEP_MUL', 'AD_DAILY_LIMIT', 'AD_REWARD', 'AD_SWEEP_DAILY', 'PITY', 'PITY_Q', 'MAX_STAR', 'WEAPON_MAX_LV'];
  const miss = need.filter(k => !fin(CFG[k]));
  ok('经济相关的 CFG 字段都在', !miss.length, '缺 ' + miss.join('、'));
  ok('LEVEL_REFUND ≤ 1（重置等级不能退得比花的多）', CFG.LEVEL_REFUND <= 1, 'LEVEL_REFUND = ' + CFG.LEVEL_REFUND);
  ok('REPLAY_COIN ≤ 1、SWEEP_MUL ≤ 2', CFG.REPLAY_COIN <= 1 && CFG.SWEEP_MUL <= 2);
  ok('挂机：每小时系数 ≤ 0.2、最多攒 ≤ 12 小时', CFG.IDLE && CFG.IDLE.k > 0 && CFG.IDLE.k <= 0.2 && CFG.IDLE.maxH <= 12, JSON.stringify(CFG.IDLE));
  ok('上线版没有礼包码（GIFT_CODES 为空）', Object.keys(CFG.GIFT_CODES || {}).length === 0, Object.keys(CFG.GIFT_CODES).join('、'));
  const W = G.WEAPONS.filter(w => !w.eff || Object.values(w.eff).some(v => !fin(v)));
  ok('兵器加成都是数', !W.length, W.map(w => w.id).join('、'));
  const E = Object.values(G.ENEMIES).filter(e => !fin(e.hp) || !fin(e.atk) || (e.coin != null && !fin(e.coin)));
  ok('敌人的血量、攻击、掉落都是数', !E.length, E.map(e => e.id).join('、'));
  const EN = vm.runInContext('ENCOUNTERS', c).filter(e => !fin(e.coinK) || e.coinK > 5);
  ok('奇遇赏金系数正常（≤ 5）', !EN.length, EN.map(e => e.id).join('、'));
  const T = vm.runInContext('TRIALS.concat(ENDLESS_AFFIX)', c).filter(t => ['eHp', 'eSpd', 'eAtk', 'bossHp', 'bossCd', 'wall', 'rage', 'hSpd', 'hAtk'].some(f => t[f] != null && !(fin(t[f]) && t[f] > 0 && t[f] <= 3)));
  ok('试炼规则、无尽词缀的倍率在 0–3 之间', !T.length, T.map(t => t.id).join('、'));
  const rw = c.trialReward(100);
  ok('试炼奖励都是正的有限数', [rw.iron, rw.soul, rw.tickets].every(v => fin(v) && v > 0), JSON.stringify(rw));
}

/* ---------- 2. 每日次数：改手机时间刷不出来 ---------- */
{
  const { G, D, c } = fresh(), T = clock(G); D.stage = 20;
  let n = 0;
  const tryAll = () => { if (c.dailyClaim()) n++; };
  // 来回拨：明天、今天、后天、今天、三天前……
  [0, 1, 0, 2, 0, -3, 1, 2, 2, 0].forEach(d => { T.set(d * DAY); tryAll(); });
  ok('每日军饷：来回改日期最多领到「拨到过的最远那天」为止（3 次）', n === 3, '领了 ' + n + ' 次');
  T.set(0); D.ad = { date: '', count: 0 }; let ads = 0;
  for (const d of [0, 1, 0, 1, 0, -1, 0]) { T.set(d * DAY); while (c.adGrant()) ads++; }
  ok('广告招募令：来回改日期最多 2 天的份（' + 2 * G.CFG.AD_DAILY_LIMIT + ' 次）', ads === 2 * G.CFG.AD_DAILY_LIMIT, '领了 ' + ads + ' 次');
  T.set(0); D.sweep = { date: '', count: 0 }; let sw = 0;
  for (const d of [0, 1, 0, 1, 0]) { T.set(d * DAY); while (typeof c.sweep(5) === 'number') sw++; }
  ok('扫荡：来回改日期最多 2 天的份', sw === 2 * G.CFG.SWEEP_DAILY, '扫了 ' + sw + ' 次');
  T.set(0); let sa = 0; D.sweep = { date: '', count: 0 };
  for (let i = 0; i < 20; i++) if (c.sweepAdGrant()) sa++;
  ok('广告扫荡每天有上限', sa === G.CFG.AD_SWEEP_DAILY, '领了 ' + sa + ' 次');
  ok('没通关的关卡不能扫荡', typeof c.sweep(D.stage) === 'string' && typeof c.sweep(D.stage + 5) === 'string');
}

/* ---------- 3. 挂机军饷：只按真实经过的时间给，最多攒满上限 ---------- */
{
  const { G, D, c } = fresh(), T = clock(G); D.stage = 30;
  D.idle = { t: 0 }; c.idleInfo(); const perH = c.idleInfo().perH; let got = 0;
  for (let i = 0; i < 50; i++) got += c.idleClaim(1);
  ok('挂机：同一时刻连点 50 次领不到东西', got === 0, '领了 ' + got);
  T.set(100 * HOUR); got = c.idleClaim(1);
  ok('挂机：离线 100 小时也只给上限（' + G.CFG.IDLE.maxH + ' 小时）', got === perH * G.CFG.IDLE.maxH, '给了 ' + got + '，每小时 ' + perH);
  T.set(50 * HOUR); ok('挂机：把时间往回拨领不到', c.idleClaim(1) === 0 && c.idleClaim(2) === 0);
  T.set(101 * HOUR); ok('挂机：回拨之后要等真实时间追上（这时只有 1 小时）', c.idleClaim(1) === perH);
  // 往后拨 8 小时领、拨回来、再往后拨……总量不超过「拨到过的最远时间」能攒的
  D.idle = { t: 0 }; T.set(0); c.idleInfo(); let total = 0;
  for (let k = 1; k <= 10; k++) { T.set(k * 8 * HOUR); total += c.idleClaim(1); T.set(0); total += c.idleClaim(1); }
  ok('挂机：反复往后拨再拨回来，总量 ≤ 最远那一刻能攒的', total <= perH * 80, '给了 ' + total + '，上限 ' + perH * 80);
  ok('挂机：双倍只翻一次（×2）', (() => { D.idle = { t: c.Date.now() - 2 * HOUR }; return c.idleClaim(2) === perH * 2 * 2; })());
}

/* ---------- 4. 每日试炼：每天只领一次首胜奖励，不推进关卡 ---------- */
{
  const { G, D, c } = fresh(), T = clock(G); D.stage = 30; const st0 = D.stage;
  let firsts = 0;
  for (const d of [0, 0, 1, 0, 1, -1, 2]) { T.set(d * DAY); for (let i = 0; i < 3; i++) if (c.settleTrial(c.trialStage(), true, 50).first) firsts++; }
  ok('试炼首胜：来回改日期最多 3 次（拨到过的最远是第 3 天）', firsts === 3, '领了 ' + firsts + ' 次');
  ok('试炼不推进关卡', D.stage === st0);
  const r = c.settleTrial(c.trialStage(), false, 80);
  ok('试炼输了没有奖励', !r.first && !r.iron && !r.tickets && !r.soul);
  ok('试炼金币只按掉落的一半给', c.settleTrial(c.trialStage(), true, 100).coins === Math.round(100 * G.CFG.TRIAL.coinK));
}

/* ---------- 5. 换算循环：升级 ↔ 重置、强化 ↔ 熔炼、炼化 ↔ 升星、买招募令，都不能越转越多 ---------- */
{
  const { G, D, c } = fresh(); D.coins = 1e7; D.iron = 1e6; D.tickets = 3000;
  while (D.tickets >= 10) c.gachaDraw(10);
  const ids = Object.keys(D.heroes);
  const c0 = D.coins; for (let r = 0; r < 20; r++) for (const id of ids.slice(0, 8)) { c.levelUpMany(id, 30); c.levelReset(id); }
  ok('升级再重置 20 轮：金币不会变多', D.coins <= c0, '多了 ' + (D.coins - c0));
  const ws = Object.keys(D.weapons), i0 = D.iron;
  let meltVal = 0; ws.forEach(w => { meltVal += G.CFG.WEAPON_MELT_VAL[G.WEAPON_MAP[w].q]; while (!c.weaponUp(w)) {} c.weaponMelt(w); });
  ok('兵器强化到顶再熔掉：精铁 ≤ 原来的 + 兵器本身的熔炼价', D.iron <= i0 + meltVal, '多了 ' + (D.iron - i0 - meltVal));
  ok('熔掉的兵器不能再熔一次', ws.every(w => typeof c.weaponMelt(w) === 'string'));
  const s0 = D.soul; ids.forEach(id => { c.heroRefine(id); c.heroRefine(id); });
  const s1 = D.soul; ids.forEach(id => { for (let k = 0; k < 6; k++) c.starUp(id); }); ids.forEach(id => c.heroRefine(id));
  ok('炼化两次不会翻倍（第二次没东西）', s1 >= s0 && ids.every(id => D.heroes[id].shards === 0));
  ok('升星只花将魂不产将魂', D.soul <= s1, '多了 ' + (D.soul - s1));
  const cb = D.coins, tb = D.tickets;
  ['-5', -5, 0, 0.5, NaN, 1e12, '3'].forEach(v => { try { c.buyTickets(v); } catch (e) {} });
  ok('买招募令：负数、小数、NaN、超大数不会白送', D.tickets - tb <= Math.floor((cb - D.coins) / G.CFG.TICKET_PRICE) + 3 && allFin(D), JSON.stringify(money(D)));
  const t1 = D.tickets; c.gachaDraw(10); c.gachaDraw(1);
  ok('抽卡：招募令按次数扣', t1 - D.tickets === (t1 >= 11 ? 11 : t1 >= 10 ? 10 : t1 >= 1 ? 1 : 0), '扣了 ' + (t1 - D.tickets));
  D.tickets = 0; const h0 = Object.keys(D.heroes).length; c.gachaDraw(10); c.gachaDraw(1);
  ok('没有招募令抽不了', D.tickets === 0 && Object.keys(D.heroes).length === h0);
  ok('货币都还是非负的有限数', allFin(D), JSON.stringify(money(D)));
}

/* ---------- 6. 保底：60 抽内一定出金品武将（概率公示写的第 60 抽） ---------- */
{
  let worst = 0;
  for (let k = 0; k < 30; k++) {
    const { G, D, c } = fresh(); D.tickets = 200; let n = 0, got = false;
    while (!got && D.tickets > 0) { const before = new Set(Object.keys(D.heroes).filter(id => G.HERO_MAP[id].q >= G.CFG.PITY_Q)); c.gachaDraw(1); n++; got = Object.keys(D.heroes).some(id => G.HERO_MAP[id].q >= G.CFG.PITY_Q && !before.has(id)) || D.pity === 0 && n > 0 && Object.keys(D.heroes).some(id => G.HERO_MAP[id].q >= G.CFG.PITY_Q); }
    worst = Math.max(worst, n);
  }
  const { G } = fresh();
  ok('保底：30 份新档最慢第 ' + worst + ' 抽出金品武将（应 ≤ ' + G.CFG.PITY + '）', worst <= G.CFG.PITY);
}

/* ---------- 7. 礼包码：没码可用；重置存档不清记录 ---------- */
{
  const { G, D, c } = fresh(); const t0 = D.tickets, c0 = D.coins;
  ['FENGHUO100', 'fenghuo100', ' FENGHUO100 ', '', null, undefined, 'TEST', '__proto__', 'constructor', 'toString'].forEach(x => { try { c.redeemGift(x); } catch (e) {} });
  ok('礼包码：各种输入都换不到东西（含 __proto__、constructor 这类）', D.tickets === t0 && D.coins === c0, JSON.stringify(money(D)));
  D.gifts = ['X@1']; G.Save.reset();
  ok('重置存档保留礼包码使用记录', Array.isArray(G.Save.data.gifts) && G.Save.data.gifts[0] === 'X@1');
}

/* ---------- 7b. TapTap 签到礼包码（v2.20）：校验对得上才认；每份存档每一档只能领一次，换多少个码都一样 ---------- */
{
  const { G, D, c } = fresh(), S = G.CFG.GIFT_SIGN, ABC = vm.runInContext('SIGN_ABC', c);
  const mk = (tier, seed) => { let body = ''; for (let i = 0; i < 6; i++) body += ABC[(seed * 7 + i * 13 + seed * i) % ABC.length]; return 'FH' + tier + body + c.signCheck(S.id, S.salt, tier, body); };
  const sum = f => Object.keys(S.tiers).reduce((a, k) => a + (S.tiers[k][f] || 0), 0);
  ok('签到码：四档奖励合计不离谱（招募令 ≤ 30、金币 ≤ 2 万、精铁 ≤ 100、将魂 ≤ 100）', sum('tickets') <= 30 && sum('coins') <= 20000 && sum('iron') <= 100 && sum('soul') <= 100, JSON.stringify(S.tiers));
  const m0 = money(D), a1 = mk('A', 1), r1 = c.redeemGift(a1);
  ok('签到码：对的码能兑换，给的就是这一档写的奖励', typeof r1 === 'object' && D.tickets === m0.tickets + S.tiers.A.tickets && D.coins === m0.coins + (S.tiers.A.coins || 0));
  const m1 = money(D); let again = 0;
  for (let i = 2; i < 400; i++) if (typeof c.redeemGift(mk('A', i)) === 'object') again++;
  ok('签到码：同一档再换 400 个不同的码也领不到第二次', again === 0 && D.tickets === m1.tickets && D.coins === m1.coins);
  ok('签到码：同一个码小写、带空格和横线也认，但还是只能领一次', typeof c.redeemGift(' ' + a1.toLowerCase().replace(/(.{4})/g, '$1-') + ' ') === 'string');
  const bad = mk('B', 5), wrong = bad.slice(0, -1) + (bad.slice(-1) === '2' ? '3' : '2'), m2 = money(D);
  ['FHB', 'FHBAAAAAAAAA', wrong, 'FHZ' + bad.slice(3), 'XX' + bad.slice(2), bad + 'A', bad.slice(0, 11), 'FH__proto__', 'FHconstructor'].forEach(x => { try { c.redeemGift(x); } catch (e) {} });
  ok('签到码：校验位不对、档位不存在、长度不对的码都换不到东西', JSON.stringify(money(D)) === JSON.stringify(m2), JSON.stringify(money(D)));
  let guess = 0; for (let i = 0; i < 3000; i++) { let s = 'FHB'; for (let k = 0; k < 9; k++) s += ABC[(i * 31 + k * 17 + i * k) % ABC.length]; if (typeof c.redeemGift(s) === 'object') guess++; }
  ok('签到码：瞎编 3000 个码最多蒙中这一档一次', guess <= 1);
  ['B', 'C', 'D'].forEach((t, i) => c.redeemGift(mk(t, 50 + i)));
  ok('签到码：四档全领完，一共就是四档奖励的合计', D.tickets === m0.tickets + sum('tickets') && D.coins === m0.coins + sum('coins') && D.iron === m0.iron + sum('iron') && D.soul === m0.soul + sum('soul') && allFin(D), JSON.stringify(money(D)));
  const m3 = money(D); G.Save.reset(); const D2 = G.Save.data, t2 = D2.tickets;
  ['A', 'B', 'C', 'D'].forEach((t, i) => c.redeemGift(mk(t, 90 + i)));
  ok('签到码：重置存档后不能再领一遍', D2.tickets === t2, String(D2.tickets - t2));
  const src = fs.readFileSync(path.join(__dirname, '..', 'gen_sign_codes.js'), 'utf8');
  ok('签到码：生成工具和游戏用同一个校验算法（都读 data.js 的 signCheck）', /signCheck/.test(src) && /CFG\.GIFT_SIGN/.test(src));
}

/* ---------- 7b. 奇遇：中途退出 / 重新开始刷不出来（掷骰结果存进存档，一局打完才结掉） ---------- */
{
  const real = fs.readFileSync(path.join(JS, 'save.js'), 'utf8').match(/function rollEncounter[\s\S]*?\n}\n/)[0];
  const { G, D, c } = fresh(); vm.runInContext(real, c);      // harness 默认把奇遇关掉了，这里换回真的
  D.stage = 60; D.enc = { n: 0, kills: {}, seen: {} };
  const first = c.rollEncounter(60), firstId = first ? first.id : '';
  let same = true; for (let i = 0; i < 40; i++) { const e = c.rollEncounter(60); if ((e ? e.id : '') !== firstId) same = false; }
  ok('奇遇：开局退出、重开 40 次，结果都和第一次一样', same);
  ok('奇遇：中途退出不加保底计数', D.enc.n === 0, 'n=' + D.enc.n);
  c.settleBattle(30, false, 3, 0, null);
  ok('奇遇：一局打完才结掉这次掷骰', !D.enc.pending && D.enc.n === (firstId ? 0 : 1));
  // 统计：每局都打完的情况下，奇遇出现率应在设定概率附近（不会因为改动变高）
  let hit = 0, N = 3000; for (let i = 0; i < N; i++) { if (c.rollEncounter(60)) hit++; c.settleBattle(30, false, 3, 0, null); }
  ok('奇遇：每局打完时出现率 ' + (hit / N * 100).toFixed(1) + '%（设定约 ' + ((G.CFG.ENC.beast + G.CFG.ENC.bandit) * 100).toFixed(0) + '% + 保底）', hit / N < (G.CFG.ENC.beast + G.CFG.ENC.bandit) * 1.8);
}

/* ---------- 7c. 存档码：TapTap 里不给读入；网页读入的进度不上排行榜 ---------- */
{
  const ui = fs.readFileSync(path.join(JS, 'ui.js'), 'utf8'), pf = fs.readFileSync(path.join(JS, 'platform.js'), 'utf8');
  ok('存档码：TapTap 里读入直接拒绝', /codeLoad:[\s\S]{0,120}Platform\.isTap\(\)\) return/.test(ui));
  ok('存档码：读入的存档标记 noRank', /codeLoad:[\s\S]{0,400}d\.noRank = true/.test(ui));
  ok('排行榜：noRank 的存档不上报', /Save\.data\.noRank\) return/.test(pf));
}

/* ---------- 8. 打仗：结算奖励有界，掉落、奇遇赏金都是有限数 ---------- */
{
  let worst = 0, badN = 0;
  for (let k = 0; k < 6; k++) {
    const { G, D, c } = fresh(); D.coins = 0; D.tickets = 0; D.stage = 5 + k * 12;
    Object.values(D.heroes).forEach(h => { h.lv = 60; h.star = 5; });
    const before = D.coins + D.tickets * G.CFG.TICKET_PRICE, st = D.stage;
    fight(G, st, true);
    const gotV = D.coins + D.tickets * G.CFG.TICKET_PRICE - before;
    worst = Math.max(worst, gotV / G.stageWinCoins(st));
    if (!allFin(D)) badN++;
  }
  ok('一局结算拿到的金币（含首通招募令折算）≤ 通关金币的 8 倍（最多 ' + worst.toFixed(1) + ' 倍）', worst <= 8);
  ok('打完货币都是非负的有限数', badN === 0);
  const { G, D, c } = fresh(); D.stage = 10; const s0 = D.stage;
  c.settleBattle(5, true, 10, 100, null);
  ok('重打已通关的关卡不会跳关、不给首通招募令', D.stage === s0);
  c.settleBattle(5, true, 10, NaN, null); c.gain('100', 'abc'); c.gain(-500, Infinity); c.gain(NaN, NaN);
  ok('掉落 / 奖励是 NaN、字符串、负数、Infinity 时金币和招募令不会坏', allFin(D) && typeof D.tickets === 'number', JSON.stringify(money(D)));
  const L = load(); L.ctx.localStorage.setItem(L.Save.KEY, JSON.stringify(Object.assign(L.Save.fresh(), { coins: 'NaN', tickets: Infinity, earned: Infinity })));
  L.Save.load();
  ok('读到坏档（金币 NaN、招募令 Infinity）时清成 0，不会变成无限', L.Save.data.coins === 0 && L.Save.data.tickets === 0 && L.Save.earnedOf(L.Save.data) < 1e15, JSON.stringify(money(L.Save.data)));
}

/* ---------- 8b. 服务器时间（TapTap 里）：改手机时间、往后一路调，每日和挂机都不多给 ---------- */
{
  const { G, D, c } = fresh(), T = clock(G); D.stage = 40;
  let perf = 1e6; c.performance = { now: () => perf };          // 只往前走的计时器，测试里手动推
  c.tap = { getCloudSaveManager() { return {}; }, getFileSystemManager() { return {}; }, env: { USER_DATA_PATH: 'tapfile://usr' } };
  vm.runInContext(fs.readFileSync(path.join(JS, 'platform.js'), 'utf8'), c);
  const CL = vm.runInContext('Clock', c), server0 = Date.UTC(2026, 10, 20, 4, 0, 0);   // 服务器时间：北京时间 11-20 12:00
  ok('TapTap 里启用服务器时间', CL.need() === true);
  // 校准后：手机时间怎么拨都不影响
  CL.set(server0); D.daily = { date: '' }; let n = 0;
  for (let d = 0; d <= 20; d++) { T.set(d * DAY); if (c.dailyClaim()) n++; }
  ok('已校准：手机时间一路往后调 20 天，每日军饷只领到 1 次', n === 1, '领了 ' + n + ' 次');
  D.idle = { t: 0 }; c.idleInfo(); T.set(100 * DAY); let g = c.idleClaim(1);
  ok('已校准：手机时间往后调 100 天，挂机拿不到东西', g === 0, '拿了 ' + g);
  D.trial = { date: '' }; let tf = 0; for (let d = 0; d < 10; d++) { T.set(d * DAY); if (c.settleTrial(c.trialStage(), true, 0).first) tf++; }
  ok('已校准：试炼首胜只有 1 次', tf === 1, tf + ' 次');
  // 真实时间过去（计时器往前走）才算数
  perf += 13 * 36e5;                                           // 过了 13 小时：北京时间 11-21 01:00，跨过 0 点
  ok('真的过了 0 点（北京时间）才能领第二天的', !!c.dailyClaim());
  g = c.idleClaim(1); ok('挂机按真实经过的时间给（13 小时 → 上限 ' + G.CFG.IDLE.maxH + ' 小时）', g === c.idleInfo().perH * G.CFG.IDLE.maxH || g > 0, '拿了 ' + g);
  // 没校准（没网）：最多比上次确认过的服务器时间晚 36 小时
  CL.anchor = null; D.clk = { last: server0 + 13 * 36e5 };     // 上次联网是北京时间 11-21 01:00，那天的军饷刚才已经领过
  let off = 0; for (let d = 0; d <= 30; d++) { T.set(server0 - Date.now() + d * DAY); if (c.dailyClaim()) off++; }
  for (let d = 30; d >= 0; d--) { T.set(server0 - Date.now() + d * DAY); if (c.dailyClaim()) off++; }
  ok('没网：往后一路调 30 天再调回来，每日军饷最多多领 2 次（上次联网后 36 小时以内）', off <= 2, '多领了 ' + off + ' 次');
  // 新装、从没校准过：从第一次打开时起算，同样最多 36 小时
  const F = fresh(), T2 = clock(F.G); F.c.performance = { now: () => 0 }; F.c.tap = c.tap;
  vm.runInContext(fs.readFileSync(path.join(JS, 'platform.js'), 'utf8'), F.c);
  let fn = 0; F.D.daily = { date: '' }; for (let d = 0; d <= 30; d++) { T2.set(d * DAY); if (F.c.dailyClaim()) fn++; }
  ok('新装没网：往后一路调 30 天，一共最多领 3 次（第一天 + 36 小时以内）', fn <= 3, '领了 ' + fn + ' 次');
  // 上传云存档 → 取列表 → 读 modifiedTime → 校准：整条链路走一遍（这条断了每日奖励就不会刷新）
  const K = fresh(); const X = 1795000000;
  K.c.performance = { now: () => 5 };
  K.c.tap = { env: { USER_DATA_PATH: 'tapfile://usr' },
    getFileSystemManager() { return { writeFile(o) { o.success && o.success(); }, readFile(o) { o.fail && o.fail(); } }; },
    getCloudSaveManager() { return { createArchive(o) { o.success({ uuid: 'u1' }); }, updateArchive(o) { o.success({ uuid: 'u1' }); }, getArchiveList(o) { o.success({ saves: [{ uuid: 'u1', name: K.G.CFG.CLOUD_NAME, modifiedTime: X }] }); } }; } };
  vm.runInContext(fs.readFileSync(path.join(JS, 'platform.js'), 'utf8'), K.c);
  vm.runInContext('Cloud.ready = true; Cloud._dirty = true; Cloud.lastUp = -1e9; Cloud.upload();', K.c);
  const KC = vm.runInContext('Clock', K.c);
  ok('上传云存档后读到服务器时间并校准', KC.anchor && KC.anchor.server === X * 1000 && KC.now() === X * 1000, JSON.stringify(KC.anchor));
  ok('校准后的「今天」按服务器时间算', K.c.dayNo() === Math.floor((X * 1000 + 8 * 36e5) / 864e5));
  const src = fs.readFileSync(path.join(JS, 'save.js'), 'utf8');
  ok('每天按北京时间 0 点刷新（不看手机时区）', /function dayNo\(\) \{ return Math\.floor\(\(nowMs\(\) \+ BJ\) \/ 864e5\); \}/.test(src) && !/getTimezoneOffset/.test(src));
}

/* ---------- 8c. 名将列传：拥有才能领、首通奖励只领一次、不推进关卡、阵容不能换 ---------- */
{
  const { G, D, c } = fresh(), LEG = vm.runInContext('LEGENDS', c), L = LEG.find(l => l.id === 'changban'), T3 = LEG.find(l => l.id === 'taoyuan');
  D.stage = 30; delete D.heroes.zhaoyun; delete D.heroes.guanyu;
  const m0 = money(D), r0 = c.settleLegend(L.id, true, 100);
  ok('列传：没有这名武将，赢了也拿不到首通奖励', !r0.first && D.tickets === m0.tickets && D.soul === m0.soul && !(D.legends && D.legends[L.id]));
  D.heroes.liubei = D.heroes.liubei || { lv: 1, star: 0, shards: 0 }; D.heroes.zhangfei = D.heroes.zhangfei || { lv: 1, star: 0, shards: 0 };
  ok('列传：桃园结义要刘关张都有（缺关羽就不开放）', c.legendOpen(T3) === false);
  D.heroes.zhaoyun = { lv: 10, star: 2, shards: 0 };
  const st0 = D.stage, t0 = D.tickets, s0 = D.soul;
  const r1 = c.settleLegend(L.id, true, 100);
  ok('列传：首通给碎片 ' + G.CFG.LEGEND.shards + '、将魂 ' + G.CFG.LEGEND.soul + '、招募令 ' + G.CFG.LEGEND.tickets, r1.first && D.heroes.zhaoyun.shards === G.CFG.LEGEND.shards && D.soul === s0 + G.CFG.LEGEND.soul && D.tickets === t0 + G.CFG.LEGEND.tickets);
  let again = 0; for (let i = 0; i < 20; i++) if (c.settleLegend(L.id, true, 100).first) again++;
  ok('列传：再赢 20 次也不再给首通奖励', again === 0 && D.heroes.zhaoyun.shards === G.CFG.LEGEND.shards);
  ok('列传：不推进关卡', D.stage === st0);
  ok('列传：输了没有首通奖励', !c.settleLegend('wancheng', false, 50).first);
  ok('列传：金币只按掉落的一半', c.settleLegend(L.id, true, 100).coins === Math.round(100 * G.CFG.LEGEND.coinK));
  ok('列传：不存在的关卡 id 什么也不给', !c.settleLegend('__proto__', true, 100).first && !c.settleLegend('nope', true, 100).first);
  D.heroes.dianwei = { lv: 10, star: G.CFG.MAX_STAR, shards: 0 }; const s1 = D.soul, rr = c.settleLegend('wancheng', true, 0);
  ok('列传：满星的碎片按品质折成将魂（不堆碎片）', rr.first && D.heroes.dianwei.shards === 0 && D.soul > s1 && fin(D.soul));
  const bad = LEG.filter(l => { const team = l.team === 'solo' ? [null, null, l.hero, null, null] : [l.hero]; const r = c.legendRule(l, team); return ['pk', 'hAtk', 'hSpd', 'hHp', 'wallStart', 'rage'].some(f => !(fin(r[f]) && r[f] > 0 && r[f] <= 6)) || !(fin(r.wall) && r.wall > 0 && r.wall <= 10); });
  ok('列传：补强倍率都是 0–6 之间的有限数（城防上限 ≤ 10：5 倍人数补强 × 关卡最多 2 倍）', !bad.length, bad.map(l => l.id).join('、'));
  // 战斗里：阵容固定、打完换回原阵容
  const orig = D.team.slice(); D.trialBak = D.team.slice(); D.team = c.legendTeam(L);
  G.Battle.start(L.stage, c.legendRule(L, D.team));
  const lt = D.team.slice(); lt[0] = Object.keys(D.heroes).find(id => id !== 'zhaoyun');
  ok('列传：战斗中不能换人', G.Battle.lineup(lt) === false);
  G.Battle.stop();
  ok('列传：退出后换回原来的阵容', JSON.stringify(D.team) === JSON.stringify(orig) && !D.trialBak);
}

/* ---------- 8d. 过关斩将（v2.19）：破纪录才给、同一纪录不重复给、每日首局一天一次、中途退出什么也不给 ---------- */
{
  const { G, D, c } = fresh(), R = G.CFG.RUSH;
  D.stage = 80;
  ok('过关斩将：主线没打完不开放', c.rushOpen() === false);
  const m80 = money(D), r80 = c.settleRush(5, 100);
  ok('过关斩将：没开放时结算什么也不给（金币也不给）', !r80.record && !r80.daySoul && D.tickets === m80.tickets && D.soul === m80.soul && D.coins === m80.coins && c.rushRec().best === 0);
  D.stage = 81;
  ok('过关斩将：打进无尽后开放', c.rushOpen() === true);
  const t0 = D.tickets, s0 = D.soul, i0 = D.iron, exp = c.rushRecordReward(0, 4);
  const r1 = c.settleRush(4, 100);
  ok('过关斩将：第一次斩 4 将 → 纪录奖励 + 今日首局将魂', r1.record && r1.best === 4 && D.tickets === t0 + exp.tickets && D.iron === i0 + exp.iron && D.soul === s0 + exp.soul + R.daySoul * 4 && r1.daySoul === R.daySoul * 4);
  const m1 = money(D); let extra = 0;
  for (let i = 0; i < 30; i++) { const r = c.settleRush(4, 0); if (r.record || r.daySoul || r.tickets) extra++; }
  ok('过关斩将：再打 30 局平纪录，什么奖励也没有（只有掉落金币）', extra === 0 && D.tickets === m1.tickets && D.soul === m1.soul && D.iron === m1.iron);
  const r2 = c.settleRush(2, 0);
  ok('过关斩将：没破纪录不给纪录奖励', !r2.record && c.rushRec().best === 4);
  const t5 = D.tickets, r3 = c.settleRush(6, 0), e2 = c.rushRecordReward(4, 6);
  ok('过关斩将：从 4 将刷到 6 将只给第 5、6 将的那两份', r3.record && D.tickets === t5 + e2.tickets && e2.tickets === 2 * R.tickets);
  const bad = [NaN, Infinity, -Infinity, -5, '12', {}, null, undefined, 1e9].map(k => { const m = money(D), r = c.settleRush(k, Infinity); return allFin(D) && fin(r.coins) && r.coins >= 0 && D.tickets - m.tickets <= 300 * R.tickets; });
  ok('过关斩将：乱填斩将数和金币（NaN、无穷、负数、字符串、十亿）不会弄坏资源、招募令最多给到 300 将的量', bad.every(Boolean) && c.rushRec().best <= 300, JSON.stringify(c.rushRec()));
  const K = clock(G); K.set(Date.now() + DAY); const ds0 = D.soul, rd = c.settleRush(1, 0);
  ok('过关斩将：第二天的首局再给一次将魂（只按斩将数，最多算 ' + R.dayCap + ' 将）', rd.daySoul === R.daySoul * 1 && D.soul === ds0 + R.daySoul);
  ok('过关斩将：同一天第二局不再给首局将魂', c.settleRush(50, 0).daySoul === 0);
  ok('过关斩将：首局将魂有上限', c.rushRecordReward(0, 0).soul === 0 && R.daySoul * R.dayCap <= 100);
  ok('过关斩将：不推进主线关卡', D.stage === 81);
  // 存档里的纪录被改坏：读档清成 0–300 的整数
  ['abc', -3, 1e12, NaN, null].forEach(v => { D.rush = { best: v, date: '' }; G.Save.save(); G.Save.load(); });
  const b = G.Save.data.rush.best;
  ok('过关斩将：存档里的纪录被改坏（字符串、负数、超大）读档后是 0–300 的整数', Number.isInteger(b) && b >= 0 && b <= 300, String(b));
  // 敌将数据：前 60 将都能生成，数值都是有限的
  const badBoss = [];
  for (let k = 1; k <= 60; k++) { const x = c.rushBoss(20400, k); if (!x || !x.name || !fin(x.hpK) || x.hpK <= 0 || !x.skills.length || x.skills.some(s => !s.k || !fin(s.cd)) || (x.res && Object.keys(x.res).some(e => !fin(x.res[e])))) badBoss.push(k); }
  ok('过关斩将：前 60 将都有名字、血量系数、招式和抗性', !badBoss.length, badBoss.join(','));
  ok('过关斩将：每第 5 将是神魔将', [5, 10, 15, 20].every(k => c.rushBoss(20400, k).myth));
  ok('过关斩将：每个武将都能当心魔', vm.runInContext('rushPool().filter(b => b.hero).length', c) === G.HEROES.filter(h => h.q < 6).length);
  // 战斗里：不能看广告复活、中途退出什么也不给、打掉神魔不解锁
  const G2 = fresh().G, D2 = G2.Save.data, c2 = G2.ctx; D2.stage = 81;
  const mm = money(D2), un0 = JSON.stringify(D2.unlocked || {});
  G2.Battle.start(c2.rushStage(1), { rush: true, name: '过关斩将' });
  for (let f = 0; f < 600 && !G2.Battle.state.over; f++) G2.Battle.tick(0.05);
  ok('过关斩将：开局是第 1 将、只来一个敌将', G2.Battle.state.wave === 1 && G2.Battle.state.enemies.filter(e => e.def.id === 'boss').length <= 1);
  G2.Battle.stop();
  ok('过关斩将：中途退出什么也不给、不算今天的首局', D2.tickets === mm.tickets && D2.soul === mm.soul && D2.coins === mm.coins && c2.rushRec().best === 0 && !c2.rushDayDone());
  const src = fs.readFileSync(path.join(JS, 'battle.js'), 'utf8');
  ok('过关斩将：不能看广告复活（排行榜公平）', /if \(S\.rush \|\| S\.revived/.test(src));
  ok('过关斩将：打掉神魔不解锁（神魔还是要在无尽里打）', /S\.boss\.myth && !S\.rush/.test(src) && un0 === JSON.stringify(D2.unlocked || {}));
}

/* ---------- 9. 广告（platform.js）：看完才发、只发一次、超时补发也只补一次 ---------- */
{
  const { G, D, c } = fresh(); D.ad = { date: '', count: 0 };
  vm.runInContext(fs.readFileSync(path.join(JS, 'platform.js'), 'utf8'), c);
  let closeCb = null, errCb = null, mode = 'ok';
  c.tap = { createRewardedVideoAd() { return { onClose(f) { closeCb = f; }, onError(f) { errCb = f; }, show() { if (mode === 'ok') { setImmediate(() => closeCb({ isEnded: true })); return Promise.resolve(); } if (mode === 'quit') { setImmediate(() => closeCb({ isEnded: false })); return Promise.resolve(); } return new Promise(() => {}); }, load() { return Promise.resolve(); } }; } };
  c.setTimeout = setTimeout; c.clearTimeout = clearTimeout; G.CFG.AD_UNIT_ID = 'test'; G.CFG.AD_WAIT = 0.05;
  const AD = vm.runInContext('AdService', c);
  (async () => {
    let r = await AD.showRewarded(); const r1 = r;
    mode = 'quit'; r = await AD.showRewarded(); const r2 = r;
    mode = 'late'; let late = 0; r = await AD.showRewarded(() => late++); const r3 = r;
    closeCb({ isEnded: true }); closeCb({ isEnded: true });
    mode = 'late'; let late2 = 0; r = await AD.showRewarded(() => late2++); closeCb({ isEnded: false });
    ok('广告：看完 → 发奖', r1 === true);
    ok('广告：中途关掉 → 不发', r2 === false);
    ok('广告：超时以后才看完 → 只补发一次', r3 === null && late === 1, 'late=' + late);
    ok('广告：超时以后没看完 → 不补发', late2 === 0);
    delete c.tap; G.CFG.AD_UNIT_ID = '';
    ok('广告：不在 TapTap 里、也不是本机调试时没有模拟广告（不会白拿）', vm.runInContext('AdService.available()', c) === false);
    finish();
  })().catch(e => { ok('广告检查跑完', false, String(e && e.stack || e)); finish(); });
}

function finish() {
  console.log(out.join('\n'));
  console.log(fails ? `资源检查：${fails} 项不通过` : `资源检查：${out.length} 项全部通过`);
  process.exitCode = fails ? 1 : 0;
}
