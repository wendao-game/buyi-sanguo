// 数值自检：改了武将、技能、缘分、兵器、经济之后跑一遍，几分钟出一张「通过 / 不通过」的表。
//   1 技能   每个大招都要能打到人（skills.js）
//   2 武将   同战力下每个武将的强度不能离中位数太远（heroes.js）
//   3 阵容   几支缘分叠得多的阵容不能强得离谱，也不能弱得没法用（team.js）
//   4 推荐战力  战力 = 推荐值时胜率要在合理范围，差四成基本打不过，超两成基本稳过（curve.js）
//   5 进度   模拟玩家能在合理的局数内打完八章（bot.js）
// 用法：node tools/sim/check.js          完整版，约 8 分钟
//       node tools/sim/check.js quick    快速版（样本少一半，约 4 分钟；波动大一些）
const { spawn } = require('child_process'), path = require('path'), os = require('os');
const quick = process.argv[2] === 'quick', DIR = __dirname;
const { load } = require('./harness.js');
const HEROES = load().HEROES.filter(h => !h.locked);
const run = (file, args) => new Promise(res => { let out = ''; const p = spawn(process.execPath, [path.join(DIR, file), ...args.map(String)]); p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { out += d; }); p.on('close', () => res(out)); });
async function pool(jobs, n) { const out = new Array(jobs.length); let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < jobs.length) { const k = i++; out[k] = await jobs[k](); } })); return out; }
const chunk = (a, n) => { const o = Array.from({ length: n }, () => []); a.forEach((x, i) => o[i % n].push(x)); return o.filter(x => x.length); };
const TEAMS = [                                             // 缘分叠得多、单一属性、回复叠得多的代表阵容
  'sunce,luxun,zhouyu,xiaoqiao,zhugeliang', 'sunce,zhugeliang,caocao,zhouyu,simayi', 'lvbu,liubei,guanyu,zhangfei,zhaoyun', 'caocao,dianwei,xuchu,guojia,jiaxu',
  'diaochan,zhenji,daqiao,xiaoqiao,caocao', 'guanyu,zhangliao,huangzhong,taishici,dianwei', 'zhangjiao,zhangbao,guanhai,peiyuan,panfeng', 'daqiao,zhenji,zhaoyun,guojia,yujin',
  'liaohua,zhoucang,guanping,guanyu,caohong', 'lvbu,zhangliao,huaxiong,liru,jiaxu', 'liubei,daqiao,xiaoqiao,zhenji,caiwenji', 'liubei,daqiao,xiaoqiao,guanyu,zhangfei'];   // 最后两支是回复城防叠得多的
(async () => {
  const t0 = Date.now(), cores = Math.max(2, Math.min(4, os.cpus().length)), rep = quick ? 6 : 10, N = quick ? 8 : 14;
  const ids = HEROES.map(h => h.id), jobs = [];
  chunk(ids, 4).forEach(g => jobs.push(() => run('skills.js', [g.join(','), 20, quick ? 2 : 4]).then(o => ['skills', o])));
  chunk(ids, 6).forEach(g => jobs.push(() => run('heroes.js', [20, 2, rep, g.join(',')]).then(o => ['heroes', o])));
  TEAMS.forEach(t => jobs.push(() => run('team.js', [t, 60, 40, 2, quick ? 8 : 12]).then(o => ['team', o])));
  ['10,50', '20,60', '30,70', '40,80'].forEach(s => jobs.push(() => run('curve.js', [s, N]).then(o => ['curve', o])));
  for (let i = 0; i < (quick ? 2 : 4); i++) jobs.push(() => run('bot.js', [80, 900, [0.3, 0.4, 0.35, 0.35][i]]).then(o => ['bot', o]));
  const res = await pool(jobs, cores), get = k => res.filter(r => r[0] === k).map(r => r[1]).join('\n');
  const rows = []; let fail = 0;
  const line = (ok, name, text) => { if (!ok) fail++; rows.push((ok ? '通过  ' : '不通过 ') + name.padEnd(6, '　') + text); };
  // 1 技能
  const bad = get('skills').split('\n').filter(l => l.includes('!!') && l.includes('品质'));
  line(!bad.length, '技能', bad.length ? '有问题的大招：' + bad.map(l => l.split(/\s+/)[0].replace(/　/g, '') + '（' + l.split('!!')[1].trim() + '）').join('、') : HEROES.length + ' 个大招都能打到人');
  // 2 武将强度
  const ks = get('heroes').split('\n').map(l => l.match(/^(\S+)\s+(\S+).*k=([\d.]+)/)).filter(Boolean).map(m => ({ name: m[2].replace(/　/g, ''), k: Number(m[3]) }));
  const med = ks.map(x => x.k).sort((a, b) => a - b)[Math.floor(ks.length / 2)], hi = ks.filter(x => x.k > med * 1.4), lo = ks.filter(x => x.k < med * 0.72);
  line(ks.length === HEROES.length && !hi.length && !lo.length, '武将', `强度中位数 ${(med * 1e4).toFixed(0)}，范围 ${(Math.min(...ks.map(x => x.k)) * 1e4).toFixed(0)}–${(Math.max(...ks.map(x => x.k)) * 1e4).toFixed(0)}` + (hi.length ? '；偏强：' + hi.map(x => x.name + ' ' + (x.k * 1e4).toFixed(0)).join('、') : '') + (lo.length ? '；偏弱：' + lo.map(x => x.name + ' ' + (x.k * 1e4).toFixed(0)).join('、') : '') + (ks.length !== HEROES.length ? `；只量到 ${ks.length}/${HEROES.length} 人` : ''));
  // 3 阵容
  const ts = get('team').split('\n').map(l => l.match(/^(.*?)\s+战力.*k=([\d.]+)/)).filter(Boolean).map(m => ({ name: m[1], k: Number(m[2]) }));
  // 上下限按第 60 关（team.js 测的那一关）的正常值算：敌人的组成一改，所有阵容的数值会一起挪，写死的数字就不准了
  const tBase = load().hpPerPower(60), tMax = tBase * 1.9, tMin = tBase * 0.6;
  const tHi = ts.filter(x => x.k > tMax), tLo = ts.filter(x => x.k < tMin);
  line(ts.length === TEAMS.length && !tHi.length && !tLo.length, '阵容', `${ts.length} 支阵容强度 ${(Math.min(...ts.map(x => x.k)) * 1e4).toFixed(0)}–${(Math.max(...ts.map(x => x.k)) * 1e4).toFixed(0)}（这一关的正常值 ${(tBase * 1e4).toFixed(0)}，上限 ${(tMax * 1e4).toFixed(0)}，下限 ${(tMin * 1e4).toFixed(0)}）` + (tHi.length ? '；太强：' + tHi.map(x => x.name + ' ' + (x.k * 1e4).toFixed(0)).join(' / ') : '') + (tLo.length ? '；太弱：' + tLo.map(x => x.name + ' ' + (x.k * 1e4).toFixed(0)).join(' / ') : ''));
  // 4 推荐战力
  const cs = get('curve').split('\n').map(l => { const m = l.match(/第\s*(\d+)\s*关/); if (!m) return null; const w = {}; l.replace(/×([\d.]+) 胜率\s+(\d+)%/g, (_, r, p) => { w[r] = Number(p); }); return { s: Number(m[1]), w }; }).filter(Boolean).sort((a, b) => a.s - b.s);
  // 单关只有二三十局、波动大：单关只抓离谱的（达标了还赢不到两成 / 六成战力还能赢一半 / 超两成还输一半），主要看第 20–80 关的平均
  const cBad = []; cs.forEach(c => { if (c.s >= 20 && c.w['1'] < 18) cBad.push(`第 ${c.s} 关战力达标时胜率只有 ${c.w['1']}%`); if (c.s >= 20 && c.w['0.6'] > 50) cBad.push(`第 ${c.s} 关战力只有六成也能赢 ${c.w['0.6']}%`); if (c.w['1.2'] < 50) cBad.push(`第 ${c.s} 关战力超两成只赢 ${c.w['1.2']}%`); });
  const late = cs.filter(c => c.s >= 20), mean = r => late.reduce((s, c) => s + c.w[r], 0) / Math.max(1, late.length), avg1 = mean('1'), avg06 = mean('0.6'), avg12 = mean('1.2');
  if (avg1 < 45 || avg1 > 78) cBad.push(`战力达标时平均胜率 ${avg1.toFixed(0)}%（应该在 45–78%）`);
  if (avg06 > 20) cBad.push(`战力只有六成时平均还能赢 ${avg06.toFixed(0)}%（应该不到 20%）`);
  if (avg12 < 75) cBad.push(`战力超两成时平均只赢 ${avg12.toFixed(0)}%（应该 75% 以上）`);
  line(cs.length === 8 && !cBad.length, '推荐战力', `第 20–80 关平均胜率：战力六成 ${avg06.toFixed(0)}% / 达标 ${avg1.toFixed(0)}% / 超两成 ${avg12.toFixed(0)}%；各关达标时：${cs.map(c => c.s + ' 关 ' + c.w['1'] + '%').join('、')}` + (cBad.length ? '；问题：' + cBad.join('；') : ''));
  // 5 进度
  const bs = get('bot').split('\n').map(l => l.match(/结束：打到第\s*(\d+)\s*关，共\s*(\d+)\s*局/)).filter(Boolean).map(m => ({ stage: Number(m[1]), n: Number(m[2]) }));
  const bBad = bs.filter(b => b.stage < 81 || b.n < 220 || b.n > 750);                     // 抽卡运气影响很大，同样的数值两次能差一倍
  line(bs.length > 0 && !bBad.length, '进度', bs.map(b => b.stage >= 81 ? `${b.n} 局打完八章` : `${b.n} 局只打到第 ${b.stage} 关`).join('、') + '（应该在 220–750 局；目标 540 左右）');
  console.log(rows.join('\n'));
  console.log((fail ? `自检有 ${fail} 项不通过` : '自检全部通过') + `，用时 ${Math.round((Date.now() - t0) / 1000)} 秒`);
  process.exitCode = fail ? 1 : 0;
})();
