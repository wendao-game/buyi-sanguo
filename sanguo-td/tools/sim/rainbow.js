// 彩色缘分值多少：八组各一支代表阵容，开着 / 关掉这一组缘分（属性加成连合击大招一起）各量几遍。
// 注意 team.js 量的 k 是「同战力下的强度」：缘分加的攻击、怒气本身已经算进战力数字（敌人跟着变强），所以只看 k 会以为加属性的缘分没用。
// 实际强了多少 = k 之比 × 战力数字之比，这里两个都打出来。
// 设计目标（v2.14）：每组的实际提升在 +30% 上下（最好的普通缘分大约 +20%）、八组差不多；代表阵容的 k 不超过正常值的 1.9 倍。
// 用法：node tools/sim/rainbow.js [每档打几局=14] [量几遍取平均=2]      （四个进程并着跑，一遍约 9 分钟）
const { spawn } = require('child_process'), path = require('path'), os = require('os');
const { load } = require('./harness.js');
const REP = Number(process.argv[2] || 14), ROUNDS = Number(process.argv[3] || 2), DIR = __dirname;
const SHOW = {                                              // 每组彩色缘分的代表阵容（只凑齐这一组彩色）
  桃园结义: 'liubei,guanyu,zhangfei,zhugeliang,fazheng', 五虎上将: 'guanyu,zhangfei,zhaoyun,huangzhong,machao', 卧龙凤雏: 'zhugeliang,pangtong,xushu,jiangwei,huangyueying',
  赤壁之盟: 'zhugeliang,zhouyu,huanggai,xiaoqiao,ganning', 虎牢关: 'lvbu,guanyu,zhangfei,zhangliao,gaoshun', 连环计: 'dongzhuo,diaochan,lvbu,jiaxu,liru',
  魏之谋主: 'caocao,simayi,guojia,jiaxu,xunyu', 江东之主: 'sunquan,zhouyu,luxun,lvmeng,ganning' };
const run = (ids, off) => new Promise(res => { let out = ''; const p = spawn(process.execPath, [path.join(DIR, 'team.js'), ids, 60, 40, 2, REP].map(String), { env: Object.assign({}, process.env, off ? { NO_RAINBOW: '1' } : {}) }); p.stdout.on('data', d => { out += d; }); p.on('close', () => { const m = out.match(/战力 (\d+)\s+k=([\d.]+)/); res(m ? { k: Number(m[2]), pw: Number(m[1]) } : { k: NaN, pw: NaN }); }); });
(async () => {
  const jobs = [], names = Object.keys(SHOW);
  names.forEach(n => { for (let r = 0; r < ROUNDS; r++) { jobs.push({ n, off: false }); jobs.push({ n, off: true }); } });
  let i = 0; const res = {};
  await Promise.all(Array.from({ length: Math.max(2, Math.min(4, os.cpus().length)) }, async () => { while (i < jobs.length) { const j = jobs[i++]; const k = await run(SHOW[j.n], j.off); (res[j.n + (j.off ? '|off' : '|on')] = res[j.n + (j.off ? '|off' : '|on')] || []).push(k); } }));
  const avg = a => a.reduce((x, y) => x + y.k, 0) / a.length, base = load().hpPerPower(60) * 1.2;
  console.log(`正常值 ${(base * 1e4).toFixed(0)}，上限 ${(base * 1.9e4).toFixed(0)}`);
  names.forEach(n => { const on = avg(res[n + '|on']), off = avg(res[n + '|off']), p1 = res[n + '|on'][0].pw, p0 = res[n + '|off'][0].pw;
    console.log(`${n.padEnd(5, '　')} 同战力强度 ${(off * 1e4).toFixed(0).padStart(3)} → ${(on * 1e4).toFixed(0).padStart(3)}  战力 ${p0} → ${p1}（+${((p1 / p0 - 1) * 100).toFixed(0)}%）  实际强度 +${((on * p1 / (off * p0) - 1) * 100).toFixed(0)}%  ${on > base * 1.9 ? '← 同战力强度超上限' : ''}`); });
})();
