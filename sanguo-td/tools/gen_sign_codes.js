// 生成 TapTap 签到活动用的礼包码：每档一个 csv（一行一个码），放到指定目录。
// 用法：node tools/gen_sign_codes.js <输出目录> [每档几个=3000]
// 码的规则见 js/data.js 的 CFG.GIFT_SIGN：FH + 档位字母 + 6 位随机 + 3 位校验，共 12 位。每次跑出来的码都不一样（随机段是随机的），
// 但都能在游戏里兑换；每份存档每一档只能领一次。后台说码不够了要「补码」时再跑一次、把新文件传上去就行。
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const out = process.argv[2], N = Number(process.argv[3] || 3000);
if (!out) { console.log('用法：node tools/gen_sign_codes.js <输出目录> [每档几个=3000]'); process.exit(1); }
const ctx = { console, Math, location: { hostname: 'x', search: '', protocol: 'http:' }, document: { getElementById: () => null } }; ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8') + ';globalThis.X = { G: CFG.GIFT_SIGN, check: signCheck, ABC: SIGN_ABC };', ctx);
const { G, check, ABC } = ctx.X;
fs.mkdirSync(out, { recursive: true });
for (const tier of Object.keys(G.tiers)) {
  const t = G.tiers[tier], set = new Set();
  while (set.size < N) { let body = ''; const r = crypto.randomBytes(6); for (let i = 0; i < 6; i++) body += ABC[r[i] % ABC.length]; set.add('FH' + tier + body + check(G.id, G.salt, tier, body)); }
  const what = [t.tickets ? '招募令' + t.tickets : '', t.coins ? '金币' + t.coins : '', t.iron ? '精铁' + t.iron : '', t.soul ? '将魂' + t.soul : ''].filter(Boolean).join('+');
  const file = path.join(out, G.id + '-累签第' + t.day + '天-' + what + '-' + N + '个.csv');
  fs.writeFileSync(file, [...set].join('\r\n') + '\r\n');
  console.log(file);
}
