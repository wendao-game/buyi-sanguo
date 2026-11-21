// 生成 TapTap 签到活动用的礼包码：每档一个 csv（一行一个码、没有表头），放到指定目录。
// 用法：node tools/gen_sign_codes.js <输出目录> [每档几个=3000] [批次名=batch1]
// 码的规则见 js/data.js 的 CFG.GIFT_SIGN：FH + 档位字母 + 6 位随机 + 3 位校验，共 12 位。每份存档每一档只能领一次。
// 同一个批次名每次生成的码完全一样（随机段由批次名算出来），所以后台页面里可以用同一段代码现算现传，本机留底的文件和传上去的一致；
// 后台说码不够了要「补码」时换一个批次名（batch2 …）再生成一批。最后一列打印的校验值用来核对两边是不是同一批。
const fs = require('fs'), path = require('path'), vm = require('vm');
const out = process.argv[2], N = Number(process.argv[3] || 3000), BATCH = process.argv[4] || 'batch1';
if (!out) { console.log('用法：node tools/gen_sign_codes.js <输出目录> [每档几个=3000] [批次名=batch1]'); process.exit(1); }
const ctx = { console, Math, location: { hostname: 'x', search: '', protocol: 'http:' }, document: { getElementById: () => null } }; ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8') + ';globalThis.X = { G: CFG.GIFT_SIGN, check: signCheck, ABC: SIGN_ABC };', ctx);
const { G, check, ABC } = ctx.X;
/* 这一段和后台页面里用的是同一份（改了要两边一起改） */
function signCodes(id, tier, n, batch, ABC, check) {
  let s = 0x811c9dc5; const key = batch + '|' + id + '|' + tier; for (let i = 0; i < key.length; i++) { s ^= key.charCodeAt(i); s = Math.imul(s, 0x01000193) >>> 0; }
  const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return (t ^ (t >>> 14)) >>> 0; };
  const set = new Set(); while (set.size < n) { let body = ''; for (let i = 0; i < 6; i++) body += ABC[rnd() % ABC.length]; set.add('FH' + tier + body + check(body)); }
  return [...set];
}
const sum = txt => { let h = 0x811c9dc5; for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
fs.mkdirSync(out, { recursive: true });
for (const tier of Object.keys(G.tiers)) {
  const t = G.tiers[tier], list = signCodes(G.id, tier, N, BATCH, ABC, body => check(G.id, G.salt, tier, body)), txt = list.join('\r\n') + '\r\n';
  const what = [t.tickets ? '招募令' + t.tickets : '', t.coins ? '金币' + t.coins : '', t.iron ? '精铁' + t.iron : '', t.soul ? '将魂' + t.soul : ''].filter(Boolean).join('+');
  const file = path.join(out, G.id + '-' + BATCH + '-累签第' + t.day + '天-' + what + '-' + N + '个.csv');
  fs.writeFileSync(file, txt);
  console.log(path.basename(file), list[0], list[N - 1], sum(txt));
}
