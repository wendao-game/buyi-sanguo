// 录一段实机画面（商店「游戏实机录屏」用）：本机 Chrome 无界面打开本地预览，逐帧推进游戏、把战斗画布逐帧编码成 H.264，手写成 MP4。
// 竖屏 1080×1920、30 帧、没有声音。不依赖 ffmpeg。画面只有战斗画布（不含网页上的按钮）。
// 用法：node tools/rec_video.js <输出.mp4> [预览地址=http://localhost:8790/]
// 要点：把页面自己的 requestAnimationFrame 停掉再手动一帧一帧推（不然游戏会被推进两次，画面一卡一卡、还偏快）。
const fs = require('fs'), path = require('path'), os = require('os'), { spawn } = require('child_process');
const OUT = process.argv[2], URL0 = process.argv[3] || 'http://localhost:8790/';
if (!OUT) { console.log('用法：node tools/rec_video.js <输出.mp4> [预览地址]'); process.exit(1); }
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));

/* 在页面里跑：准备存档、录两段、拼成 MP4 放在 window.__mp4（Uint8Array） */
const PAGE = async function () {
  const FPS = 30, log = [];
  // —— 存档：全武将、等级调到比第 60 关推荐战力高三成（打得热闹但不是碾压）——
  const D = Save.data; D.tickets = 3000; while (D.tickets >= 10) gachaDraw(10);
  D.unlocked = D.unlocked || {}; HEROES.forEach(h => { if (h.myth) D.unlocked[h.id] = 1; if (!D.heroes[h.id]) D.heroes[h.id] = { lv: 1, star: 0, shards: 0 }; });
  Object.keys(D.heroes).forEach(id => { D.heroes[id].star = CFG.MAX_STAR; D.heroes[id].shards = 0; });
  const setLv = target => { let lo = 1, hi = 400; while (lo < hi) { const m = (lo + hi) >> 1; Object.keys(D.heroes).forEach(id => D.heroes[id].lv = m); if (teamPower() >= target) hi = m; else lo = m + 1; } Object.keys(D.heroes).forEach(id => D.heroes[id].lv = lo); };
  Object.keys(D.heroes).forEach(id => D.heroes[id].lv = 60); D.team = bestTeam();
  D.stage = 121; D.auto = true; D.speed = 1; D.gfx = 'gl'; D.sound = false; D.music = false; D.tips = { home1: 1, lvup1: 1, arms1: 1, home2: 1 };
  window.requestAnimationFrame = () => 0;                    // 停掉页面自己的循环
  await new Promise(r => setTimeout(r, 300));
  UI.show('battle'); const tb = document.querySelector('#tipbar'); if (tb) tb.classList.remove('on');
  const cv = GLView.active() ? document.getElementById('gl') : document.getElementById('cv');
  log.push('画面：' + (GLView.active() ? '高清' : '2D') + ' ' + cv.width + '×' + cv.height);
  const W = cv.width - cv.width % 2, H = cv.height - cv.height % 2;
  // —— 编码器 ——
  const samples = []; let avcC = null, err = null;
  const enc = new VideoEncoder({ output: (chunk, meta) => { if (meta && meta.decoderConfig && meta.decoderConfig.description) avcC = new Uint8Array(meta.decoderConfig.description); const b = new Uint8Array(chunk.byteLength); chunk.copyTo(b); samples.push({ b, key: chunk.type === 'key' }); }, error: e => { err = String(e); } });
  enc.configure({ codec: 'avc1.640028', width: W, height: H, bitrate: 9e6, framerate: FPS, avc: { format: 'avc' } });
  let k = 0;
  const pickBuff = () => { const S = Battle.state; if (S && S.choosing) { const b = document.querySelector('#modal [data-act]'); if (b) b.click(); } };
  const shoot = async n => { for (let i = 0; i < n; i++) { pickBuff(); Battle.frame(1 / FPS); const vf = new VideoFrame(cv, { timestamp: Math.round(k * 1e6 / FPS), duration: Math.round(1e6 / FPS) }); enc.encode(vf, { keyFrame: k % 60 === 0 }); vf.close(); k++; if (enc.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 15)); if (err) throw new Error(err); } };
  const skip = (cond, max) => { for (let i = 0; i < max; i++) { pickBuff(); Battle.tick(0.05); const S = Battle.state; if (!S || S.over || cond(S)) break; } };

  // —— 第一段：主线第 58 关，第三波敌军压上来，大招连放 ——
  setLv(stageRecommend(58) * 1.3); D.team = bestTeam();
  Battle.start(58); skip(S => S.wave >= 3 && S.live.length >= 24 && S.heroes.some(h => h.rage >= 80), 6000);   // 开头第一秒就要热闹：场上人多、马上有人放大招
  log.push('第一段从第 ' + Battle.state.wave + ' 波开始，场上 ' + Battle.state.live.length + ' 个敌人');
  await shoot(7 * FPS);
  Battle.stop();
  // —— 第二段（11-22 加）：无尽第 50 层，魔·甄姬登场（电影黑边、名牌）→ 打到半血化成大蛇 ——
  setLv(stageRecommend(130) * 1.25); D.team = bestTeam();
  Battle.start(130);
  { const S = Battle.state; S.wallMax *= 300; S.wall = S.wallMax; S.heroHit = 1; S.wave = CFG.WAVES - 1; S.queue = []; S.enemies.length = 0; Battle.tick(0.05); }
  skip(S => { const e = S.enemies.find(x => x.def.id === 'boss'); return e && e.y > 132; }, 4000);
  await shoot(3 * FPS);
  skip(S => { const e = S.enemies.find(x => x.def.id === 'boss'); return e && e.y > 300; }, 400);
  { const e = Battle.state.enemies.find(x => x.def.id === 'boss'); if (e) { e.hp = e.max * 0.49; e.max *= 6; e.hp *= 6; log.push('化蛇前 y ' + Math.round(e.y)); } }
  await shoot(9 * FPS);
  { const e = Battle.state.enemies.find(x => x.def.id === 'boss'); log.push('化蛇 ' + (e ? (e.snake ? '成了' : '没变') + ' ' + e.name : '敌将没了')); }
  Battle.stop();
  // —— 第三段：过关斩将，神·关羽登场（名牌）→ 砸城墙（预警、大招横幅、余韵），雷暴天气 ——
  setLv(stageRecommend(rushStage(5)) * 1.25); D.team = bestTeam();
  const g = HERO_MAP.god_guanyu, m = MYTH_BOSS.god_guanyu;
  Battle.start(rushStage(5), { rush: true, name: '过关斩将' });
  { const S = Battle.state; S.boss = { id: 'god_guanyu', name: g.name, who: g.name, title: g.title, hero: null, myth: 'god_guanyu', sprite: 'heroes/god_guanyu', look: null, skills: m.skills, hpK: m.hpK * 2.2, aura: m.aura, final: true, res: m.res }; S.weather = WEATHER_MAP.storm; S.banner = null; }
  skip(S => { const e = S.enemies.find(x => x.def.id === 'boss'); return e && e.y > 128; }, 3000);
  await shoot(4 * FPS);
  { const S = Battle.state, e = S.enemies.find(x => x.def.id === 'boss'); if (e) { const w = e.sk.find(x => x.k.k === 'wallhit'); if (w) w.t = 0.62; S.lastBcut = -99; } }
  await shoot(6 * FPS);
  Battle.stop();
  await enc.flush(); enc.close();
  if (!avcC) throw new Error('编码器没给 avcC');
  log.push('帧数 ' + samples.length + '，关键帧 ' + samples.filter(s => s.key).length);

  // —— 手写 MP4（只有一条 H.264 视频轨；moov 在前，方便边下边播）——
  const u8 = (...a) => new Uint8Array(a), u32 = v => u8((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255), u16 = v => u8((v >> 8) & 255, v & 255), str = s => new Uint8Array([...s].map(c => c.charCodeAt(0)));
  const cat = (...parts) => { const n = parts.reduce((a, p) => a + p.length, 0), o = new Uint8Array(n); let i = 0; for (const p of parts) { o.set(p, i); i += p.length; } return o; };
  const box = (type, ...parts) => { const body = cat(...parts); return cat(u32(body.length + 8), str(type), body); };
  const full = (type, ver, flags, ...parts) => box(type, u8(ver, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255), ...parts);
  const N = samples.length, TS = FPS * 1000, DELTA = 1000, dur = N * DELTA, MAT = cat(u32(0x10000), u32(0), u32(0), u32(0), u32(0x10000), u32(0), u32(0), u32(0), u32(0x40000000));
  const stsd = full('stsd', 0, 0, u32(1), box('avc1', new Uint8Array(6), u16(1), new Uint8Array(16), u16(W), u16(H), u32(0x480000), u32(0x480000), u32(0), u16(1), new Uint8Array(32), u16(24), u16(0xffff), box('avcC', avcC)));
  const stts = full('stts', 0, 0, u32(1), u32(N), u32(DELTA));
  const keys = samples.map((s, i) => (s.key ? i + 1 : 0)).filter(Boolean), stss = full('stss', 0, 0, u32(keys.length), ...keys.map(u32));
  const stsc = full('stsc', 0, 0, u32(1), u32(1), u32(N), u32(1));
  const stsz = full('stsz', 0, 0, u32(0), u32(N), ...samples.map(s => u32(s.b.length)));
  const build = off => {
    const stbl = box('stbl', stsd, stts, stss, stsc, stsz, full('stco', 0, 0, u32(1), u32(off)));
    const minf = box('minf', full('vmhd', 0, 1, u16(0), u16(0), u16(0), u16(0)), box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1))), stbl);
    const mdia = box('mdia', full('mdhd', 0, 0, u32(0), u32(0), u32(TS), u32(dur), u16(0x55c4), u16(0)), full('hdlr', 0, 0, u32(0), str('vide'), new Uint8Array(12), str('VideoHandler'), u8(0)), minf);
    const trak = box('trak', full('tkhd', 0, 3, u32(0), u32(0), u32(1), u32(0), u32(Math.round(dur / TS * 1000)), new Uint8Array(8), u16(0), u16(0), u16(0), u16(0), MAT, u32(W << 16), u32(H << 16)), mdia);
    return box('moov', full('mvhd', 0, 0, u32(0), u32(0), u32(1000), u32(Math.round(dur / TS * 1000)), u32(0x10000), u16(0x100), u16(0), new Uint8Array(8), MAT, new Uint8Array(24), u32(2)), trak);
  };
  const ftyp = box('ftyp', str('isom'), u32(0x200), str('isom'), str('iso2'), str('avc1'), str('mp41'));
  const moov = build(ftyp.length + build(0).length + 8);
  window.__mp4 = cat(ftyp, moov, box('mdat', ...samples.map(s => s.b)));
  return { log, bytes: window.__mp4.length, seconds: N / FPS, W, H };
};

(async () => {
  const port = 9300 + Math.floor(Math.random() * 500), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rec-'));
  const ch = spawn(CHROME, ['--headless=new', '--window-size=540,960', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--remote-debugging-port=' + port, '--user-data-dir=' + dir, URL0], { stdio: 'ignore' });
  let ws = null;
  for (let i = 0; i < 60 && !ws; i++) { await new Promise(r => setTimeout(r, 250)); try { const l = await (await fetch('http://127.0.0.1:' + port + '/json')).json(); const pg = l.find(t => t.type === 'page'); if (pg) ws = pg.webSocketDebuggerUrl; } catch (e) { } }
  if (!ws) throw new Error('Chrome 没起来');
  const sock = new WebSocket(ws); await new Promise(r => sock.addEventListener('open', r));
  let id = 0; const wait = {};
  sock.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && wait[m.id]) { wait[m.id](m); delete wait[m.id]; } });
  const send = (method, params) => new Promise(r => { const i = ++id; wait[i] = r; sock.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expression, awaitPromise) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: !!awaitPromise, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 700)); return r.result.result.value; };
  await new Promise(r => setTimeout(r, 6000));               // 等素材加载、进主城
  console.log('开始录……');
  const info = await ev('(' + PAGE.toString() + ')()', true);
  console.log(info.log.join('；'), '|', info.seconds.toFixed(1) + ' 秒', info.W + '×' + info.H, (info.bytes / 1048576).toFixed(1) + ' MB');
  const fd = fs.openSync(OUT, 'w'), STEP = 3 * 1024 * 1024;
  for (let off = 0; off < info.bytes; off += STEP) {
    const b64 = await ev(`(() => { const s = window.__mp4.subarray(${off}, ${Math.min(info.bytes, off + STEP)}); let o = ''; for (let i = 0; i < s.length; i += 0x8000) o += String.fromCharCode.apply(null, s.subarray(i, i + 0x8000)); return btoa(o); })()`);
    fs.writeSync(fd, Buffer.from(b64, 'base64'));
  }
  fs.closeSync(fd); console.log('已保存', OUT, (fs.statSync(OUT).size / 1048576).toFixed(1) + ' MB');
  sock.close(); ch.kill();
})().catch(e => { console.error(String(e).slice(0, 900)); process.exit(1); });
