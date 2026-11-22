// 重写素材清单 assets/manifest.js：列出 assets/ 里所有图片（不含 _sheets 原图）、sfx/ 里的音频，
// 整体版本号 ASSET_VER（所有文件内容的哈希），再加每个文件各自的版本号 ASSET_H（v2.23 起：换了哪张图，玩家只重下哪张）。
// voice/ 里的配音不进清单（用到才下），但也给版本号。
// 用法：node tools/mk_manifest.js        （slice_chrome.js 切完图会自动调；手动往 assets/ 里放了文件也跑一下）
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const DST = path.join(__dirname, '..', 'assets');
function build() {
  const files = [], extra = [];
  const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f), st = fs.statSync(p); if (st.isDirectory()) { if (f !== '_sheets') walk(p); continue; } const rel = path.relative(DST, p).split(path.sep).join('/'), dir = rel.split('/')[0]; if (/\.(png|jpe?g|webp)$/i.test(f) || (dir === 'sfx' && /\.(mp3|ogg|wav|m4a)$/i.test(f))) files.push(rel); else if (dir === 'voice' && /\.(mp3|ogg|wav|m4a)$/i.test(f)) extra.push(rel); } };
  walk(DST); files.sort(); extra.sort();
  const hs = crypto.createHash('sha1'), H = {};
  const sha = f => crypto.createHash('sha1').update(fs.readFileSync(path.join(DST, f))).digest();
  for (const f of files) { const h = sha(f); hs.update(Buffer.concat([Buffer.from(f), h])); H[f] = h.toString('hex').slice(0, 7); }
  for (const f of extra) H[f] = sha(f).toString('hex').slice(0, 7);
  const ver = hs.digest('hex').slice(0, 10);
  const txt = '/* 已放进 assets/ 的图片清单（游戏只加载这里列出的文件）。\n * 由 tools/mk_manifest.js（或 slice_chrome.js、slice_sheets.py）自动生成，不要手改。 */\n'
    + 'window.ASSET_LIST = [\n' + files.map(f => "  '" + f + "',\n").join('') + '];\n'
    + "window.ASSET_VER = '" + ver + "';\n"
    + '/* 每个文件自己的版本号（内容哈希）。加载时拼在地址后面，换了哪个文件就只重下哪个 */\n'
    + 'window.ASSET_H = ' + JSON.stringify(H) + ';\n';
  fs.writeFileSync(path.join(DST, 'manifest.js'), txt);
  return { n: files.length, ver, bytes: txt.length };
}
module.exports = { build };
if (require.main === module) { const r = build(); console.log(`清单 ${r.n} 个文件，版本号 ${r.ver}，manifest.js ${(r.bytes / 1024).toFixed(0)} KB`); }
