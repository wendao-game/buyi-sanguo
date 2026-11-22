// build_fonts.py 的 Node 版（这台电脑没有 Python 时用）：按游戏里实际用到的字，把三款开源字体裁成小文件放进 assets/fonts/。
// 需要 npm 包 subset-font（不放进仓库）：找个目录 npm install subset-font，再把那个目录的 node_modules 传进来：
//   node tools/build_fonts.js <装了 subset-font 的 node_modules 目录>
// 取字的规则和 build_fonts.py 完全一样（毛笔体的固定标题 BRUSH_TEXT 直接从 build_fonts.py 里读，只维护一份）。
// 改了游戏里的文字（新武将名、新技能名、新界面文字、游戏名）之后重新跑一次；没跑也不会出错，只是新出现的字退回系统字体。
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), SRC = path.join(__dirname, 'fonts-src'), OUT = path.join(ROOT, 'assets', 'fonts');
const mods = process.argv[2];
if (!mods || !fs.existsSync(path.join(mods, 'subset-font'))) { console.error('用法：node tools/build_fonts.js <装了 subset-font 的 node_modules 目录>'); process.exit(1); }
const subsetFont = require(path.join(mods, 'subset-font'));
const isCjk = c => c >= '一' && c <= '鿿';
const gameText = fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).map(f => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8')).join('') + fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const cjk = new Set([...gameText].filter(isCjk));
const ascii = []; for (let i = 32; i < 127; i++) ascii.push(String.fromCharCode(i));
const punct = [...'，。：；！？、（）【】《》“”‘’…—·％＋－×÷'];
// 毛笔体只用在大字上：固定标题 + data.js 里的武将名、大招名、章节名、敌将名、军令名、缘分名
const py = fs.readFileSync(path.join(__dirname, 'build_fonts.py'), 'utf8'), bm = py.match(/BRUSH_TEXT = '([^']*)'/);
if (!bm) throw new Error('build_fonts.py 里没找到 BRUSH_TEXT');
const data = fs.readFileSync(path.join(ROOT, 'js', 'data.js'), 'utf8');
let brushText = bm[1];
for (const line of data.split('\n')) if (line.trimStart().startsWith("H('")) brushText += (line.match(/'([^']*)'/g) || []).join('');
brushText += [...data.matchAll(/(?:name|boss): '([^']*)'/g)].map(m => m[1]).join('');
const brush = new Set([...brushText].filter(isCjk));
(async () => {
  const build = async (src, dst, chars) => {
    const buf = await subsetFont(fs.readFileSync(path.join(SRC, src)), [...chars].join(''), { targetFormat: 'woff2' });
    fs.writeFileSync(path.join(OUT, dst), buf); return buf.length;
  };
  const n1 = await build('zcool-kuaile.woff2', 'round.woff2', new Set([...cjk, ...ascii, ...punct]));
  const n2 = await build('ma-shan-zheng.woff2', 'brush.woff2', new Set([...brush, ...'·【】：！']));
  const n3 = await build('fredoka-600.woff2', 'num.woff2', new Set([...ascii, '×']));
  for (const f of ['zcool-kuaile.OFL.txt', 'ma-shan-zheng.OFL.txt', 'fredoka.OFL.txt']) fs.copyFileSync(path.join(SRC, f), path.join(OUT, f));
  console.log(`${cjk.size} 个汉字（毛笔体 ${brush.size} 个）；round.woff2 ${n1 >> 10} KB，brush.woff2 ${n2 >> 10} KB，num.woff2 ${n3 >> 10} KB`);
})().catch(e => { console.error(e); process.exit(1); });
