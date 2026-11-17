// 把合成的音效导出成 wav（不用开游戏就能试听；也可以拿去当参考音发给生成工具）。
// 用法：先在 sanguo-td 目录起一个本地服务（比如 python3 -m http.server 8732），然后
//       node tools/sfx/export.js <输出目录> [音效名，逗号分隔；不写就是大招和命中那一组]
// 需要 playwright（只是借浏览器的 Web Audio 离线渲染）。
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
const outDir = process.argv[2] || '.', DEF = ['ult_fire', 'ult_thunder', 'ult_ice', 'ult_wind', 'ult_poison', 'ult_blade', 'ult_arrow', 'boom', 'thunder', 'freeze', 'hit_fire', 'hit_thunder', 'hit_ice', 'hit_wind', 'hit_poison', 'hit_blade', 'hit_arrow', 'boss_smash', 'rock'];
const names = process.argv[3] ? process.argv[3].split(',') : DEF, URL = process.env.SFX_URL || 'http://localhost:8732/index.html';
function wav(samples) {
  const n = samples.length, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(44100, 24); b.writeUInt32LE(88200, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  return b;
}
(async () => {
  const br = await chromium.launch(), p = await br.newPage();
  await p.goto(URL, { waitUntil: 'domcontentloaded' }); await p.waitForFunction(() => typeof Sfx !== 'undefined');
  fs.mkdirSync(outDir, { recursive: true });
  const all = [];
  for (const nm of names) {
    const r = await p.evaluate(async nm => { const d = await Sfx.render(nm, 2.4); let end = d.length - 1; while (end > 0 && Math.abs(d[end]) < 0.0015) end--; let pk = 0; for (let i = 0; i <= end; i++) pk = Math.max(pk, Math.abs(d[i])); return { d: Array.from(d.slice(0, Math.min(d.length, end + 2205))), pk }; }, nm);
    const k = Math.min(6, 0.7 / Math.max(0.01, r.pk)), s = r.d.map(v => v * k);            // 试听文件统一放大到差不多响（游戏里还要过压缩器）
    fs.writeFileSync(path.join(outDir, nm + '.wav'), wav(s));
    console.log(nm.padEnd(12), '峰值', r.pk.toFixed(3), '时长', (s.length / 44100).toFixed(2) + 's');
    all.push(...s, ...new Array(Math.floor(44100 * 0.45)).fill(0));
  }
  fs.writeFileSync(path.join(outDir, '_全部连播.wav'), wav(all));
  await br.close();
})();
