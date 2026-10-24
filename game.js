// 布衣三国 · 游戏逻辑
// 结构按以后迁移 Godot 的场景划分：输入 / 玩家 / 武器 / 技能 / 敌人与武将 / 掉落 / 升级 / 绘制 / 界面
(() => {
'use strict';

const D = window.GAME_DATA;
for (const group of [D.weapons, D.skills, D.passives, D.enemies, D.generals, D.allies, D.buildings]) for (const id in group) group[id].id = id;
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const fmtTime = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const $ = id => document.getElementById(id);
const FONT = "'Noto Serif SC', 'Songti SC', 'SimSun', serif";
const DISPLAY = "'Ma Shan Zheng', 'STXingkai', 'KaiTi', serif";

// ============ 画布 ============
const cv = $('cv');
const ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1, ZOOM = 1;
const spriteCache = new Map();
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = cv.clientWidth || innerWidth;
  H = cv.clientHeight || innerHeight;
  cv.width = Math.round(W * DPR);
  cv.height = Math.round(H * DPR);
  ZOOM = clamp(Math.min(W, H) / 760, 0.62, 1.15);
  spriteCache.clear();
}
addEventListener('resize', resize);
resize();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => spriteCache.clear());

// ============ 音效（无素材，直接合成） ============
// 听感原则：只用正弦 / 三角这类圆润的波形，噪声一律走低通或带通（不要刺耳的高频嘶声），
// 每个声音都有几毫秒的起音（避免“咔哒”声）；所有声音先汇到总线：总音量 → 低通 → 压限器，
// 同时响很多声也不会爆音。音阶用五声音阶（宫商角徵羽），听起来更像古风。
let actx = null, noiseBuf = null, muted = false, bus = null, voices = 0;
const sfxLast = {};
const MAX_VOICES = 16; // 同时发声上限，大混战时不至于一片嘈杂
try { muted = localStorage.getItem('buyi-muted') === '1'; } catch (e) { /* 存储不可用时忽略 */ }
function audio() {
  if (!actx) {
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      const master = actx.createGain(), lp = actx.createBiquadFilter(), comp = actx.createDynamicsCompressor();
      master.gain.value = 0.55;
      lp.type = 'lowpass'; lp.frequency.value = 5200; lp.Q.value = 0.5;   // 削掉刺耳的高频
      comp.threshold.value = -20; comp.knee.value = 12; comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.2;
      master.connect(lp).connect(comp).connect(actx.destination);
      bus = master;
    } catch (e) { actx = null; }
  }
  if (actx && actx.state === 'suspended') actx.resume();
}
// 包络：起音 atk 秒升到 vol，再在 dur 内指数衰减
function env(g, t0, vol, dur, atk = 0.006) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
}
function voice(dur) { if (voices >= MAX_VOICES) return false; voices++; setTimeout(() => voices--, dur * 1000 + 30); return true; }
// 音调：freq 从 f0 滑到 f0*slide；cut 是这个音自己的低通（让三角波更闷更软）
function tone(f0, dur, vol, o = {}) {
  const a = actx; if (!a || muted || !voice(dur + (o.delay || 0))) return;
  const t0 = a.currentTime + (o.delay || 0);
  const osc = a.createOscillator(), g = a.createGain(), f = a.createBiquadFilter();
  osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(f0, t0);
  if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(25, f0 * o.slide), t0 + dur);
  f.type = 'lowpass'; f.frequency.value = o.cut || 3000;
  env(g, t0, vol, dur, o.atk);
  osc.connect(f).connect(g).connect(bus); osc.start(t0); osc.stop(t0 + dur + 0.03);
}
// 噪声：kind 'low' 低通（闷响、尘土）/ 'band' 带通（破风、刀风），freq 可以从 f0 扫到 f1
function noise(dur, vol, o = {}) {
  const a = actx; if (!a || muted || !voice(dur + (o.delay || 0))) return;
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t0 = a.currentTime + (o.delay || 0);
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = noiseBuf;
  f.type = o.kind === 'band' ? 'bandpass' : 'lowpass'; f.Q.value = o.q || (o.kind === 'band' ? 1.2 : 0.7);
  f.frequency.setValueAtTime(o.f0 || 600, t0);
  if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t0 + dur);
  env(g, t0, vol, dur, o.atk || 0.008);
  s.connect(f).connect(g).connect(bus); s.start(t0, Math.random() * 0.4); s.stop(t0 + dur + 0.03);
}
const PENTA = [262, 294, 330, 392, 440, 523, 587, 659, 784, 880]; // 五声音阶
function sfx(name) {
  if (!actx || muted) return;
  const now = performance.now();
  const gap = { pick: 45, swing: 90, hurt: 150, slam: 110, boss: 400, ult: 400 }[name] || 0;
  if (gap && now - (sfxLast[name] || 0) < gap) return;
  sfxLast[name] = now;
  switch (name) {
    case 'pick': // 拾钱：清脆但很轻的铜钱声，音高在五声音阶里随机
      tone(PENTA[5 + Math.floor(Math.random() * 5)] * 2, 0.12, 0.07, { cut: 4000, atk: 0.003 });
      break;
    case 'swing': // 挥砍：带通噪声从高往低扫，像刀风
      noise(0.14, 0.28, { kind: 'band', f0: 1500, f1: 450, q: 1.4 });
      break;
    case 'hurt': // 受伤：闷闷的一下，带点下沉
      tone(200, 0.22, 0.16, { type: 'triangle', slide: 0.5, cut: 700 });
      noise(0.12, 0.08, { f0: 500 });
      break;
    case 'level': // 升级：五声音阶的一串琴音
      [0, 2, 4, 5].forEach((k, i) => tone(PENTA[k + 3], 0.5, 0.045, { type: 'triangle', cut: 2400, delay: i * 0.075 }));
      break;
    case 'boss': // 武将登场：两声战鼓
      for (const d of [0, 0.32]) { tone(95, 0.55, 0.22, { slide: 0.55, delay: d, atk: 0.004 }); noise(0.18, 0.08, { f0: 280, delay: d }); }
      break;
    case 'slam': // 重击：低沉的轰隆 + 尘土声
      tone(70, 0.4, 0.3, { slide: 0.55, atk: 0.004 });
      noise(0.35, 0.14, { f0: 520, f1: 160 });
      break;
    case 'win': // 章节胜利：一段上行的五声琶音
      [0, 1, 2, 3, 4, 5, 7].forEach((k, i) => tone(PENTA[k], 0.7, 0.045, { type: 'triangle', cut: 2200, delay: i * 0.1 }));
      break;
    case 'ult': // 大招：沉重的鼓 + 由低到高卷起的风声 + 一声铜锣般的余响
      tone(58, 1.0, 0.24, { slide: 0.6, atk: 0.005 });
      noise(0.7, 0.07, { kind: 'band', f0: 250, f1: 1400, q: 0.9, delay: 0.05 });
      tone(196, 1.2, 0.035, { type: 'triangle', cut: 1200, delay: 0.12 });
      tone(294, 1.1, 0.02, { type: 'sine', delay: 0.14 });
      break;
  }
}
function noiseBuffer() {
  if (!noiseBuf) {
    noiseBuf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

// ============ 背景音乐与名将语音 ============
// 音乐、语音文件由 assets/audio.json 列出（装素材时生成），没有清单时一律用合成的占位音乐、只显示字幕，不会去请求不存在的文件。
let musicOn = true, voiceOn = true;
try { musicOn = localStorage.getItem('buyi-music') !== '0'; voiceOn = localStorage.getItem('buyi-voice') !== '0'; } catch (e) { /* 存储不可用时忽略 */ }
const AUDIO = { bgm: {}, voice: {}, loop: {}, loopFrom: {} };
fetch(ASSET_BASE + 'audio.json').then(r => r.ok ? r.json() : null).then(m => {
  if (!m) return;
  for (const id of m.bgm || []) AUDIO.bgm[id] = `${ASSET_BASE}bgm/${id}.mp3`;
  Object.assign(AUDIO.loop, m.loop || {}); // 每首的循环长度（采样帧，44.1 kHz），用来做无缝循环
  Object.assign(AUDIO.loopFrom, m.loopFrom || {}); // 重新压缩过的音乐开头会多出一小段编码器静音：循环从这里开始（采样帧）
  // 配音两种写法：["lubu_enter", …]（一句一个文件），或 { lubu: { file: "lubu.mp3", clips: { enter: [起, 止], … } } }（一位名将一个文件，按时间段取每一句）
  const v = m.voice || [];
  if (Array.isArray(v)) for (const id of v) AUDIO.voice[id] = { src: `${ASSET_BASE}voice/${id}.mp3` };
  else for (const gid in v) for (const k in v[gid].clips) { // gain：录得小声的名将单独放大；时间段第四项写文件名的，是后来补录的单句（比如 zhangfei2.mp3）
    const c = v[gid].clips[k], file = typeof c[3] === 'string' ? c[3] : v[gid].file;
    AUDIO.voice[`${gid}_${k}`] = { src: `${ASSET_BASE}voice/${file}`, t: c, gain: v[gid].gain || 1 };
  }
  Music.refresh();
}).catch(() => { /* 没有清单：用合成音乐 */ });

// 合成的古风占位曲：弹拨（像古筝）的五声旋律 + 低音 + 长音铺底 + 战鼓 + 锣。
// 每首曲子按名字生成固定的两段 4 小节旋律，交替循环，所以每次听到的是同一首。
const Music = (() => {
  const VOL_FILE = 0.45, VOL_SYNTH = 0.55;
  let cur = null, live = false, timer = null, gain = null, duckUntil = 0;
  const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const hashStr = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  function compose(id, P) {
    const r = mulberry(hashStr(id)), scale = P.mode === 'yu' ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9];
    const RHY = P.drums >= 2 ? [[0, 3, 6, 8, 12], [0, 2, 4, 8, 10, 12], [0, 4, 6, 8, 12, 14], [0, 3, 6, 10, 12], [0, 2, 3, 4, 8, 12]]
      : [[0, 4, 8, 12], [0, 6, 8, 12], [0, 8, 12], [0, 4, 8], [0, 6, 8, 14]];
    const phrases = [];
    for (let ph = 0; ph < 2; ph++) {
      const bars = []; let deg = 6 + Math.floor(r() * 3);
      for (let b = 0; b < 4; b++) {
        const notes = {};
        for (const st of RHY[Math.floor(r() * RHY.length)]) { deg = Math.max(3, Math.min(12, deg + Math.floor(r() * 5) - 2)); notes[st] = deg; }
        if (b === 3) { for (const st in notes) if (+st > 8) delete notes[st]; notes[12] = ph ? 5 : 7; } // 段落结尾落在主音 / 属音
        bars.push(notes);
      }
      phrases.push(bars);
    }
    const freq = d => P.root * Math.pow(2, (Math.floor(d / 5) * 12 + scale[((d % 5) + 5) % 5]) / 12);
    return { phrases, freq };
  }
  // 弹拨：三角波 + 高八度正弦泛音，滤波器随余音慢慢关上，像拨了一下琴弦
  function pluck(f, t, vol, dec) {
    const a = actx, o1 = a.createOscillator(), o2 = a.createOscillator(), h = a.createGain(), lp = a.createBiquadFilter(), e = a.createGain();
    o1.type = 'triangle'; o2.type = 'sine'; o1.frequency.value = f; o2.frequency.value = f * 2.004; h.gain.value = 0.3;
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(Math.min(5000, f * 7), t); lp.frequency.exponentialRampToValueAtTime(Math.max(220, f * 1.4), t + dec);
    e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(vol, t + 0.004); e.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    o1.connect(lp); o2.connect(h).connect(lp); lp.connect(e).connect(gain);
    o1.start(t); o2.start(t); o1.stop(t + dec + 0.05); o2.stop(t + dec + 0.05);
  }
  // 铺底长音：主音和五度，慢起慢收
  function pad(f, t, dur, vol) {
    for (const k of [1, 1.5]) {
      const o = actx.createOscillator(), e = actx.createGain();
      o.type = 'sine'; o.frequency.value = f * k;
      e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(vol / k, t + dur * 0.3); e.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(e).connect(gain); o.start(t); o.stop(t + dur + 0.05);
    }
  }
  function hit(t, f0, f1, dur, vol, nf, nv) { // 鼓：下滑的低音 + 一点闷噪声
    const o = actx.createOscillator(), e = actx.createGain();
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(vol, t + 0.004); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(e).connect(gain); o.start(t); o.stop(t + dur + 0.05);
    if (nv) {
      const s = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
      s.buffer = noiseBuffer(); f.type = nf > 1000 ? 'bandpass' : 'lowpass'; f.frequency.value = nf;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(nv, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + (nf > 1000 ? 0.08 : 0.2));
      s.connect(f).connect(g).connect(gain); s.start(t, Math.random() * 0.5); s.stop(t + 0.25);
    }
  }
  function drums(lvl, s, bar, t) {
    if (!lvl) return;
    const big = [[], [0, 8], [0, 6, 8], [0, 3, 6, 8, 11, 14]][lvl], small = [[], [], [4, 12], [4, 12, 15]][lvl];
    if (big.includes(s)) hit(t, 92, 42, 0.42, s === 0 ? 0.36 : 0.24, 300, 0.06);
    if (small.includes(s)) hit(t, 220, 160, 0.06, 0.03, 1900, 0.05);
    if (lvl >= 2 && bar % 4 === 3 && s >= 12) hit(t, 200, 150, 0.05, 0.02, 1700, 0.025 + (s - 12) * 0.01); // 段尾滚奏
  }
  function startSynth(id, P) {
    const C = compose(id, P), a = actx, sp = 60 / P.bpm / 4;
    gain = a.createGain(); gain.gain.setValueAtTime(0.0001, a.currentTime); gain.gain.linearRampToValueAtTime(VOL_SYNTH, a.currentTime + 2.5);
    gain.connect(bus);
    let step = 0, t = a.currentTime + 0.1;
    timer = setInterval(() => {
      while (t < a.currentTime + 0.4) {
        const bar = Math.floor(step / 16), s = step % 16, notes = C.phrases[Math.floor(bar / 4) % 2][bar % 4];
        if (notes[s] !== undefined) pluck(C.freq(notes[s]), t, 0.1, P.decay);
        if (s === 0 || s === 8) pluck(C.freq(s === 0 ? 0 : bar % 2 ? 3 : 2) / 2, t, 0.08, P.decay * 1.3); // 低音
        if (s === 0 && bar % 2 === 0) pad(C.freq(0) / 2, t, sp * 32, 0.03);
        drums(P.drums, s, bar, t);
        if (P.gong && s === 0 && bar % 8 === 0) { hit(t, 110, 104, 3, 0.05, 0, 0); hit(t, 166, 160, 2.6, 0.03, 0, 0); }
        step++; t += sp;
      }
    }, 90);
  }
  // 音乐文件：解码成整段音频，用 Web Audio 无缝循环（<audio loop> 循环时会有一小段空白）。
  // 解码后的音频很占内存，只留最近用过的 2 首。
  const decoded = new Map();
  function load(id) {
    if (decoded.has(id)) { const p = decoded.get(id); decoded.delete(id); decoded.set(id, p); return p; }
    const p = fetch(AUDIO.bgm[id]).then(r => r.arrayBuffer()).then(b => new Promise((ok, no) => actx.decodeAudioData(b, ok, no)));
    decoded.set(id, p);
    while (decoded.size > 2) decoded.delete(decoded.keys().next().value);
    p.catch(() => decoded.delete(id));
    return p;
  }
  let src = null, srcGain = null, token = 0;
  function startFile(id) {
    const my = ++token;
    load(id).then(buf => {
      if (my !== token || cur !== id || !live) return; // 解码期间已经换了曲子
      const a = actx, s = a.createBufferSource(), g = a.createGain();
      s.buffer = buf; s.loop = true;
      const frames = AUDIO.loop[id];
      const from = (AUDIO.loopFrom[id] || 0) / 44100;
      if (frames && from + frames / 44100 <= buf.duration + 0.01) { s.loopStart = from; s.loopEnd = Math.min(buf.duration, from + frames / 44100); }
      g.gain.setValueAtTime(0.0001, a.currentTime); g.gain.linearRampToValueAtTime(VOL_FILE * (performance.now() < duckUntil ? 0.35 : 1), a.currentTime + 1.5);
      s.connect(g).connect(a.destination); s.start(0, from);
      src = s; srcGain = g;
    }).catch(() => { if (my === token && cur === id && D.bgm[id]) startSynth(id, D.bgm[id]); }); // 文件坏了就退回合成音乐
  }
  function stop() {
    live = false; token++;
    if (timer) { clearInterval(timer); timer = null; }
    if (gain) { const g = gain; gain = null; g.gain.cancelScheduledValues(actx.currentTime); g.gain.setValueAtTime(g.gain.value, actx.currentTime); g.gain.linearRampToValueAtTime(0.0001, actx.currentTime + 1.2); setTimeout(() => g.disconnect(), 1500); }
    if (src) { const s = src, g = srcGain; src = srcGain = null; const t = actx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0.0001, t + 1.2); s.stop(t + 1.3); }
  }
  function start(id) {
    stop();
    if (!id || !actx || muted || !musicOn) return;
    live = true;
    if (AUDIO.bgm[id]) startFile(id);
    else if (D.bgm[id]) startSynth(id, D.bgm[id]);
  }
  return {
    want(id) { if (id === cur && (live || !actx || muted || !musicOn)) return; cur = id; start(id); },
    refresh() { start(cur); },
    // 名将说话时把音乐压低
    duck(sec) {
      duckUntil = performance.now() + sec * 1000;
      if (gain) { const t = actx.currentTime; gain.gain.cancelScheduledValues(t); gain.gain.setValueAtTime(gain.gain.value, t); gain.gain.linearRampToValueAtTime(VOL_SYNTH * 0.35, t + 0.15); gain.gain.setValueAtTime(VOL_SYNTH * 0.35, t + sec); gain.gain.linearRampToValueAtTime(VOL_SYNTH, t + sec + 0.6); }
      if (srcGain) { const g = srcGain, t = actx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(VOL_FILE * 0.35, t + 0.15); g.gain.setValueAtTime(VOL_FILE * 0.35, t + sec); g.gain.linearRampToValueAtTime(VOL_FILE, t + sec + 0.6); }
    },
    get current() { return cur; },
    get playing() { return src ? 'file' : timer ? 'synth' : null; },
  };
})();
// 现在应该放哪首：标题 / 各章 / 名将在场 / 无尽征途；战死后停
function musicTrack() {
  if (!S) return 'title';
  if (S.over) return null;
  if (S.bossList.length) return 'boss';
  if (S.endless) return 'endless';
  return (D.chapters[S.ch] || {}).id || 'endless';
}

// 名将语音：同时只说一句，重要的（阵亡 > 大招 > 登场 > 暴怒）可以打断不重要的；有字幕，有配音就播放
const VOICE_PRI = { death: 4, ult: 3, enter: 2, rage: 1 };
let vClip = null, vPri = 0, vUntil = 0;
const voiceBufs = new Map(); // 解码好的配音文件（每位名将一个，很小）
const voiceBuf = src => { if (!voiceBufs.has(src)) { const p = fetch(src).then(r => r.arrayBuffer()).then(b => new Promise((ok, no) => actx.decodeAudioData(b, ok, no))); p.catch(() => voiceBufs.delete(src)); voiceBufs.set(src, p); } return voiceBufs.get(src); };
function stopVoice() { if (vClip) { try { vClip.stop(); } catch (e) { /* 已经停了 */ } vClip = null; } }
function speak(gid, key, text, subtitle = true) {
  const g = D.generals[gid];
  if (!g || !text) return;
  const pri = VOICE_PRI[key.split('_')[0]] || 1, now = performance.now();
  if (now < vUntil && pri < vPri) return;
  vPri = pri; vUntil = now + 2600;
  if (subtitle) {
    $('vl-name').textContent = g.name; $('vl-text').textContent = text;
    const b = $('vline'); b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  }
  stopVoice();
  const clip = AUDIO.voice[`${gid}_${key}`];
  if (!clip || !voiceOn || muted || !actx) return;
  const ask = ++speak.n;
  voiceBuf(clip.src).then(buf => {
    if (ask !== speak.n || !voiceOn || muted) return; // 等解码的时候又说了别的
    const [t0, t1] = clip.t || [0, buf.duration], dur = Math.max(0.1, Math.min(buf.duration, t1) - t0);
    if (!speak.out) { // 语音总线：压限器，放大后的小声配音也不会爆音，各名将响度更一致
      const c = actx.createDynamicsCompressor();
      c.threshold.value = -10; c.knee.value = 6; c.ratio.value = 12; c.attack.value = 0.003; c.release.value = 0.15;
      c.connect(actx.destination); speak.out = c;
    }
    const s = actx.createBufferSource(), g = actx.createGain();
    s.buffer = buf; g.gain.value = 0.95 * (clip.gain || 1) * (clip.t && clip.t[2] || 1); // 时间段后面可以跟第三个数：这一句单独的音量倍数
    s.connect(g).connect(speak.out); s.start(0, t0, dur);
    vClip = s; vUntil = performance.now() + dur * 1000;
    Music.duck(dur + 0.2);
  }).catch(() => { /* 文件坏了：只留字幕 */ });
}
speak.n = 0;

// ============ 输入 ============
const keys = new Set();
const MOVE_KEYS = {
  KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
};
addEventListener('keydown', e => {
  if (MOVE_KEYS[e.code]) { keys.add(e.code); e.preventDefault(); }
  if ((e.code === 'Escape' || e.code === 'KeyP') && S && !S.over) togglePause();
  if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') { if (S && !S.over) { e.preventDefault(); S.blinkReq = true; } } // 闪现
  const m = /^(?:Digit|Numpad)([1-4])$/.exec(e.code);
  if (m && !$('levelup').hidden && $('lu-cards').style.pointerEvents !== 'none') { const el = $('lu-cards').children[+m[1] - 1]; if (el) el.click(); }
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

// 浮动摇杆：按住屏幕任意位置拖动
const joy = { on: false, id: -1, ox: 0, oy: 0, x: 0, y: 0 };
cv.addEventListener('pointerdown', e => {
  if (!S || S.over) return;
  audio();
  if (joy.on) return; // 摇杆只跟着第一根手指走，第二根手指（比如去点升级卡）不会抢走它
  joy.on = true; joy.id = e.pointerId;
  joy.ox = joy.x = e.clientX; joy.oy = joy.y = e.clientY;
  try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
});
cv.addEventListener('pointermove', e => {
  if (!joy.on || e.pointerId !== joy.id) return;
  joy.x = e.clientX; joy.y = e.clientY;
  const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy);
  if (d > 60) { joy.ox = joy.x - dx / d * 60; joy.oy = joy.y - dy / d * 60; }
});
const endJoy = e => { if (e.pointerId === joy.id) joy.on = false; };
cv.addEventListener('pointerup', endJoy);
cv.addEventListener('pointercancel', endJoy);

let botMove = null; // 调试：测试脚本接管走位
function moveInput() {
  if (botMove) return botMove(S);
  let x = 0, y = 0;
  for (const k of keys) { const v = MOVE_KEYS[k]; if (v) { x += v[0]; y += v[1]; } }
  if (joy.on) {
    const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy);
    if (d > 6) { const m = Math.min(1, d / 45); x += dx / d * m; y += dy / d * m; }
  }
  const l = Math.hypot(x, y);
  if (l > 1) { x /= l; y /= l; }
  return [x, y];
}

// ============ 空间网格（大量敌人时加速碰撞查询） ============
const CELL = 64;
const grid = new Map();
const cellKey = (cx, cy) => (cx + 32768) * 65536 + (cy + 32768);
function gridBuild() {
  grid.clear();
  for (const e of S.enemies) {
    if (e.dead) continue;
    const k = cellKey(Math.floor(e.x / CELL), Math.floor(e.y / CELL));
    let c = grid.get(k);
    if (!c) grid.set(k, (c = []));
    c.push(e);
  }
}
function near(x, y, r, fn) {
  const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
  const y0 = Math.floor((y - r) / CELL), y1 = Math.floor((y + r) / CELL);
  for (let cx = x0; cx <= x1; cx++) {
    for (let cy = y0; cy <= y1; cy++) {
      const c = grid.get(cellKey(cx, cy));
      if (c) for (let i = 0; i < c.length; i++) if (!c[i].dead) fn(c[i]);
    }
  }
}
function nearest(x, y, maxR) {
  let best = null, bd = maxR * maxR;
  for (const e of S.enemies) {
    if (e.dead) continue;
    const d = dist2(x, y, e.x, e.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
// 攻击目标：near 打最近的；random 在范围内随机挑一个；boss 名将 / 精英在范围内就先打它们，没有再打最近的
const AIM_MODES = [['near', '近', '最近'], ['random', '随', '随机'], ['boss', '将', '名将优先']];
let aimMode = 'near';
try { aimMode = localStorage.getItem('buyi-aim') || 'near'; } catch (e) { /* 存储不可用时忽略 */ }
if (!AIM_MODES.some(m => m[0] === aimMode)) aimMode = 'near';
function pickTarget(x, y, maxR) {
  if (aimMode === 'near') return nearest(x, y, maxR);
  const r2 = maxR * maxR;
  if (aimMode === 'boss') {
    let best = null, bk = Infinity;
    for (const e of S.enemies) {
      if (e.dead || !(e.boss || e.ai)) continue;
      const d = dist2(x, y, e.x, e.y);
      const k = d + (e.boss ? 0 : 1e9); // 名将比精英优先，同类里挑最近的
      if (d < r2 && k < bk) { bk = k; best = e; }
    }
    return best || nearest(x, y, maxR);
  }
  const pool = [];
  for (const e of S.enemies) if (!e.dead && dist2(x, y, e.x, e.y) < r2) pool.push(e);
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}

// ============ 游戏状态 ============
let S = null;
let nextId = 1;

// 升级所需经验（数值在 data.js 的 xpCurve）
function xpFor(lv) {
  const X = D.xpCurve, k = Math.min(lv, X.capLv) - 1;
  return Math.round(X.base + (lv - 1) * X.perLv + X.expA * (Math.pow(X.expG, k) - 1) + Math.max(0, lv - X.capLv) * X.latePerLv);
}
function rankOf(lv) { let r = D.ranks[0].name; for (const k of D.ranks) if (lv >= k.lv) r = k.name; return r; }

// 无限成长：武器 / 技能满 5 级后继续“突破”，每级伤害 +10%，每 3 级数量 +1，但数量最多 5 个
const BREAK = D.breakthrough;
const growTo = (v, step, cap) => v >= cap ? v : Math.min(cap, v + step); // 满级时已经超过上限的技能（如撒豆成兵）保持原样，不再增加
function statsOf(def, lv) {
  const N = def.levels.length;
  if (lv <= N) return def.levels[lv - 1];
  const x = lv - N, b = def.levels[N - 1], s = Object.assign({}, b);
  const step = Math.floor(x / BREAK.countEvery);
  const faster = Math.max(BREAK.minCdMul, Math.pow(BREAK.cdPerLevel, x));
  if (b.dmg) s.dmg = b.dmg * (1 + BREAK.dmgPerLevel * x);
  if (b.cd) s.cd = b.cd * faster;
  if (b.tick) s.tick = b.tick * faster;
  for (const k of ['range', 'radius', 'ringR', 'len']) if (b[k]) s[k] = b[k] * (1 + BREAK.areaPerLevel * x);
  if (b.count) s.count = growTo(b.count, step, BREAK.countCap);
  if (b.pierce) s.pierce = growTo(b.pierce, step, BREAK.pierceCap);
  if (b.blades) s.blades = growTo(b.blades, step, BREAK.countCap);
  if (b.bonus) s.bonus = b.bonus + 0.05 * x;
  if (def.type === 'trample') s.speed = b.speed + Math.min(0.3, 0.02 * x);
  return s;
}
function breakNote(def, nextLv) {
  const pct = Math.round(BREAK.dmgPerLevel * 100), a = statsOf(def, nextLv - 1), b = statsOf(def, nextLv);
  if (b.blades > a.blades) return `突破：画戟 +1，伤害 +${pct}%`;
  if (b.count > a.count) return `突破：数量 +1（上限 ${BREAK.countCap}），伤害 +${pct}%`;
  if (b.pierce > a.pierce) return `突破：穿透 +1，伤害 +${pct}%`;
  return `突破：伤害 +${pct}%，冷却与范围小幅提升`;
}
// 带出身专精加成的数值：弓弩吃“弓箭”物品，计策兵器和所有技能吃“计策”物品
function wStats(def, lv) {
  let L = statsOf(def, lv);
  const p = S.player, t = def.tags || [];
  if (L.count > BREAK.countCap) L = Object.assign({}, L, { count: BREAK.countCap }); // 武器一次放出的数量不超过上限
  if (S.startDmg && def.id === S.origin.weapon) L = Object.assign({}, L, { dmg: L.dmg * (1 + S.startDmg) }); // 局外装备：起手武器
  if (t.includes('bow') && (p.arrowCount || p.arrowDmg || p.arrowPierce)) { // 箭数到上限后，多出来的连珠箭改成伤害 +12%
    const n = (L.count || 1) + p.arrowCount, over = Math.max(0, n - BREAK.countCap);
    return Object.assign({}, L, { count: Math.min(BREAK.countCap, n), dmg: L.dmg * (1 + p.arrowDmg) * (1 + 0.12 * over), pierce: Math.min(BREAK.pierceCap, (L.pierce || 1) + p.arrowPierce) });
  }
  if (t.includes('spell') && (p.spellDmg || p.spellArea || p.skillCd)) {
    const o = Object.assign({}, L);
    if (o.dmg) o.dmg *= 1 + p.spellDmg;
    if (o.cd) o.cd *= 1 - p.skillCd;
    if (o.tick) o.tick *= 1 - p.skillCd * 0.5;
    for (const k of ['radius', 'ringR', 'jump']) if (o[k]) o[k] *= 1 + p.spellArea;
    return o;
  }
  return L;
}
function sStats(def, lv) {
  const L = statsOf(def, lv), p = S.player;
  if (!p.spellDmg && !p.skillCd) return L;
  const o = Object.assign({}, L);
  if (o.dmg) o.dmg *= 1 + p.spellDmg;
  if (o.cd) o.cd *= 1 - p.skillCd;
  return o;
}
// 物品满级后同样可以继续升，但效果减半
const passiveEff = (def, lv) => Math.min(lv, def.max) + Math.max(0, lv - def.max) * 0.5;

function newState(originId) {
  const origin = D.origins.find(o => o.id === originId) || D.origins[0];
  S = {
    origin, t: 0, kills: 0,
    paused: false, modal: false, over: false, won: false, endless: false, endlessStart: 0, endlessT: 0,
    player: { x: 0, y: 0, r: 14, hp: 0, maxHp: 0, facing: 0, level: 1, xp: 0, xpNext: xpFor(1), iframes: 0, moving: false, kvx: 0, kvy: 0 },
    weapons: [], skills: [], passives: {}, elements: {}, boltBudget: 6, gustT: 0,
    enemies: [], bossList: [], proj: [], eproj: [], zones: [], effects: [], rings: [], pickups: [], numbers: [], particles: [], hazards: [],
    rampageT: 0, thornsT: 0, seen: {},
    decals: [], ghosts: [], hurtFlash: 0, ghostT: 0,
    teles: [], ezones: [], ultFreeze: 0, pSlowT: 0, windT: 0, windX: 0, windY: 0, pBurnT: 0, pBurnDps: 0, blinkT: 0, blinkReq: false,
    pChillT: 0, frozenT: 0, charm: null, // 女将：冰冻减速、冻住不能动、被貂蝉迷住往她身边走
    revived: false, adGold: false, // TapTap 广告：本局已经看广告复活过 / 已经领过金币加成
    specialDone: {}, riders: [], boards: [], quakes: [], boulders: [], coils: [], marks: [], mist: null, // 西凉营地；马超的铁骑、郭嘉的棋盘和迷雾、张飞的地裂、典韦的巨石、赵云的白龙、遗计锦囊
    hook: null, rootT: 0, chains: [], flails: [], lanterns: [], tides: [], pools: [], kites: [], decoys: [], // 董卓的铁链、大乔的莲灯和潮水、小乔的纸鸢、蝶影分身
    gazes: [], graves: [], steles: [], pCurseT: 0, feignT: 0, // 司马懿的狼顾目光、破土孤坟、神兵墓碑；被幽冥噬魂、冢虎诈死的冷却
    arena: null, flyArrows: [], bloodEyes: [], glT: 0, danjingT: 0, rageT: 0, dimT: 0, // 夏侯惇的单挑枪阵、飞箭、血眼；刚烈反击、啖睛的冷却和狂暴
    allies: [], allyPower: 0, bonus: {}, blessings: [], eliteT: D.stage.eliteStart, buildingT: D.stage.buildingEvery, forgeReady: 0,
    spawnAcc: {}, evIdx: 0, defeated: [],
    ch: 0, chStart: 0, chapterT: 0, nextBossOk: 0,     // 当前章节、本章开始时间、换章倒计时、下一名武将最早登场时间
    strikes: [], erings: [], lust: 0, lustT: 0, dash: null,
    shenbing: [], sbPity: 0, later: [], sbWhirl: null,   // 神兵：悬浮在身边的名将专属兵器
    goldRun: 0, startDmg: 0, xpMul: 0, saveT: 15,         // 本局金币、局外装备加成、自动存档倒计时
    pendingLevels: 0, pendingReward: null, rewardReady: null, choice: null, cycle: 0,
    slowmo: 0, shake: 0, camX: 0, camY: 0, wsb: 0, buildDirty: true,
  };
  recomputeStats();
  S.weapons.push({ id: origin.weapon, lv: 1, t: 0.3 });
  applyGear();
  return S;
}

function recomputeStats() {
  const p = S.player, b = D.player.base, o = S.origin.stats;
  const add = { maxHp: 0, maxHpMul: 0, speedMul: 0, armor: 0, regen: 0, pickupMul: 0, dmgMul: 0, cdMul: 0, areaMul: 0, crit: 0, critMul: 0,
    arrowCount: 0, arrowDmg: 0, arrowPierce: 0, spellDmg: 0, skillCd: 0, spellArea: 0, blinkDist: 0, blinkCd: 0 };
  for (const [id, lv] of Object.entries(S.passives)) {
    const def = D.passives[id], ef = def.effects, n = passiveEff(def, lv);
    for (const k in ef) add[k] += ef[k] * n;
  }
  for (const k in S.bonus) add[k] += S.bonus[k]; // 据点奖励与神祠祝福
  const chitu = S.skills.find(s => s.id === 'chitu');
  if (chitu) add.speedMul += statsOf(D.skills.chitu, chitu.lv).speed;
  const elai = S.skills.find(s => s.id === 'elai');
  if (elai) add.armor += statsOf(D.skills.elai, elai.lv).armor;
  const oldMax = p.maxHp;
  p.maxHp = Math.round(((o.maxHp || b.maxHp) + add.maxHp) * (1 + add.maxHpMul));
  // 出身专精：弓箭（连珠箭、百步穿杨）与计策（奇谋、孙子兵法）
  p.arrowCount = Math.floor(add.arrowCount); p.arrowDmg = add.arrowDmg; p.arrowPierce = Math.floor(add.arrowPierce);
  p.spellDmg = add.spellDmg; p.skillCd = Math.min(0.5, add.skillCd); p.spellArea = add.spellArea;
  p.speed = b.speed * (o.speedMul || 1) * (1 + Math.min(1.5, add.speedMul));
  p.armor = add.armor;
  p.regen = (o.regen || 0) + add.regen;
  p.pickup = b.pickup * (o.pickupMul || 1) * (1 + add.pickupMul);
  p.dmgMul = 1 + add.dmgMul;
  p.cdMul = Math.max(0.4, (o.cdMul || 1) * (1 + add.cdMul));
  p.areaMul = 1 + add.areaMul;
  p.crit = Math.min(0.75, b.crit + (o.crit || 0) + add.crit);
  p.critMul = b.critMul + add.critMul;
  p.blinkDist = D.blink.dist * (1 + add.blinkDist);                        // 铜雀春深：闪现更远
  p.blinkCd = D.blink.cd * (S.shenbing.some(sb => D.shenbing[sb.gid].blinkCd) ? 0.5 : 1) * (1 - Math.min(0.6, add.blinkCd)); // 流光蝶钗：闪现冷却减半；国色：再减 25%
  if (!oldMax) p.hp = p.maxHp;
  else if (p.maxHp > oldMax) p.hp += p.maxHp - oldMax;
  p.hp = Math.min(p.hp, p.maxHp);
}

// ============ 伤害与击杀 ============
// 当前章节（无尽征途用 D.endless）与本章已经过的秒数
const chap = () => S.endless ? D.endless : D.chapters[S.ch];
const ctime = () => S.t - S.chStart;

function hitEnemy(e, base, opts) {
  if (e.dead) return;
  if (e.vanish) return; // 司马懿诈死藏进疑冢：打不到
  if (e.sealed) { // 乔府：别的名将在场时府门紧闭
    if (S.t - (e.sealMsgT || -9) > 1.2) { e.sealMsgT = S.t; addNumber(e.x, e.y - e.r * 2, `${e.def.seal || '府门紧闭'} · 先击败在场的名将`, '#ffd98a', 15); } // 西凉营地「营门紧闭」，孤冢「冢门封死」
    return;
  }
  const p = S.player;
  // 这一击带的属性：飞弹 / 落石 / 音波自己记着；刀光、直刺、火圈等当场命中的，用这次出手抽到的属性
  const el = opts && opts.el !== undefined ? opts.el : curEl, W = el === 'wind' && elStats('wind');
  let dmg = base * p.dmgMul * (1 + S.wsb) * (1 + S.lust * (S.lustPer || 0)) * (e.frenzyT > S.t ? 0.5 : 1); // 狂暴中的武将受伤减半
  if (W) dmg *= 1 + W.dmg; // 疾风：风刃加伤
  const crit = !(opts && opts.noCrit) && Math.random() < p.crit;
  if (crit) dmg *= p.critMul;
  if (e.vulnT > S.t) dmg *= 1 + D.champion.breakVuln; // 破甲后易伤
  if (S.elements.ice >= 5 && e.slowT > S.t) dmg *= 1 + D.elements.ice.levels[4].shatter; // 寒冰 Lv5 碎冰：减速中的敌人受伤更多
  if (e.curseT > S.t) dmg *= 1 + e.curseV;            // 幽冥噬魂印记：多受伤害
  if (S.t < S.rageT) dmg *= 1 + D.passives.danjing.rage.dmg; // 啖睛狂暴：伤害提高
  if (e.stance) { e.stance.hits++; dmg *= 0.5; }      // 夏侯惇「刚烈」：横刀格挡，伤害减半，每一下都记一层怒
  if (e.dr) dmg *= 1 - e.dr;                          // 名将半血 / 濒死减伤
  dmg = Math.max(1, Math.round(dmg * rand(0.92, 1.08)));
  // 护甲护体：先扣护甲，打空了才伤到血；护甲在时几乎推不动
  let armored = false;
  if (e.shieldMax) {
    e.shieldHitT = S.t;
    if (e.shield > 0) {
      armored = true;
      const ab = Math.min(e.shield, dmg);
      e.shield -= ab; e.hp -= dmg - ab;
      if (e.shield <= 0) breakShield(e);
    } else e.hp -= dmg;
  } else e.hp -= dmg;
  e.flash = 0.09;
  const ha = opts && opts.kbAngle !== undefined ? opts.kbAngle : angleTo(p.x, p.y, e.x, e.y);
  if (opts && opts.kb) {
    const k = opts.kb * (W ? 1 + W.kb : 1) * (1 - (e.def.kbResist || 0)) * (e.boss ? 0.04 : 1) * (armored ? 0.3 : 1);
    e.kvx += Math.cos(ha) * k; e.kvy += Math.sin(ha) * k;
  }
  // 命中火花：从敌人身上沿打击方向迸出，暴击更多、带金色闪光
  const hx = e.x - Math.cos(ha) * e.r * 0.4, hy = e.y - e.r * 0.5 - Math.sin(ha) * e.r * 0.4;
  if (crit) { sparks(hx, hy, ha, 7, '255,210,110', 520, 0.8, 2.6); glint(hx, hy, 18, '255,225,150'); }
  else if (!(opts && opts.quiet)) sparks(hx, hy, ha, 2, '255,238,210', 380, 0.6, 1.8);
  addNumber(e.x + rand(-6, 6), e.y - e.r, String(dmg), crit ? '#ffcf5a' : opts && opts.color || (armored ? '#a9c8ff' : '#f3ead6'), crit ? 20 : opts && opts.color ? 12 : 14);
  if (armored && Math.random() < 0.5) sparks(hx, hy, ha + Math.PI, 2, '170,200,255', 300, 0.9, 1.6); // 打在护甲上：蓝白火花
  if (el && !(opts && opts.noEl)) applyElement(e, base, el, hx, hy);
  if (e.hp <= 0 && !e.dead) killEnemy(e);
}

// ============ 属性：冰火雷风 ============
// 命中时只触发这一击带的那一种属性（灼烧、雷电、旋风造成的伤害带 noEl，不会再连锁触发）
const elStats = id => S.elements[id] ? D.elements[id].levels[S.elements[id] - 1] : null;
// 命中处迸出属性的光点：火星 / 冰晶 / 电火花 / 风痕
function elSpark(el, x, y) {
  const c = D.elements[el].rgb;
  if (el === 'fire') embers(x, y, 3, c, 70, 50, 5, 0.45);
  else if (el === 'ice') { fxp({ type: 'snow', x, y, vx: rand(-40, 40), vy: rand(-40, 10), drag: 3, life: 0.5, size: rand(3, 5), rot: rand(0, TAU), spin: 3 }); sparks(x, y, rand(0, TAU), 2, c, 220, Math.PI, 1.6); }
  else if (el === 'thunder') sparks(x, y, rand(0, TAU), 4, c, 420, Math.PI, 1.8);
  else if (el === 'dark') { fxp({ type: 'smoke', x, y, vx: rand(-20, 20), vy: rand(-50, -20), drag: 2, grow: 14, life: 0.5, rgb: '40,16,60', size: rand(5, 8) }); fxp({ type: 'ember', x, y, vx: rand(-30, 30), vy: rand(-90, -40), drag: 2, life: 0.45, rgb: c, size: rand(5, 8) }); }
  else for (let k = 0; k < 2; k++) { const a = rand(0, TAU); fxp({ type: 'spark', x, y, vx: -Math.sin(a) * 300, vy: Math.cos(a) * 220, drag: 4, life: 0.3, rgb: c, size: 1.6 }); }
}
// 幽冥的冲击：一圈紫光环 + 翻滚的黑紫烟 + 窜起的鬼火 + 地上一片焦黑（司马懿、死士、冢虎墓碑共用）
function soulBurst(x, y, R, a = 1) {
  const c = D.elements.dark.rgb;
  fxTex('ring', x, y, { w: R * 0.7, h: R * 0.7, rgb: c, under: true, flat: 0.6, life: 0.45, grow: 2.6, core: 0.2, a });
  fxTex('burst', x, y - R * 0.2, { w: R * 1.8, h: R * 1.8, rgb: c, life: 0.32, grow: 1.4, rot: rand(0, TAU), core: 0.3, a: 0.7 * a });
  for (let i = 0; i < 10; i++) { const k = i / 10 * TAU; fxp({ type: 'smoke', x: x + Math.cos(k) * R * 0.3, y: y + Math.sin(k) * R * 0.2, vx: Math.cos(k) * R * 1.4, vy: Math.sin(k) * R - 30, drag: 3.5, grow: 26, life: 0.7, rgb: '24,10,36', size: rand(9, 14) }, true); }
  for (let i = 0; i < 8; i++) fxp({ type: 'ember', x: x + rand(-R, R) * 0.4, y: y - 8, vx: rand(-60, 60), vy: rand(-220, -90), drag: 1.5, life: 0.7, rgb: Math.random() < 0.5 ? c : '235,205,255', size: rand(8, 13) });
  S.decals.push({ kind: 'soul', x, y, r: R * 0.85, life: 2.2, max: 2.2 });
  if (S.decals.length > 40) S.decals.shift();
}
// 带属性的爆炸 / 落石：一圈属性色的冲击，有 GPT 画的属性命中图就叠上
function elBurst(el, x, y, R) {
  const E = D.elements[el], art = window.Assets.get('elfx:hit_' + el);
  if (art) S.effects.push({ kind: 'elhit', img: art, x, y, r: R, life: 0.32, max: 0.32, rot: rand(0, TAU) });
  else fxTex('burst', x, y, { w: R, h: R, rgb: E.rgb, life: 0.3, grow: 1.4, rot: rand(0, TAU), core: 0.3, a: 0.7 });
  if (el === 'ice') shards(x, y, 6, R * 2.4, 6);
  else if (el === 'thunder') sparks(x, y, -Math.PI / 2, 8, E.rgb, R * 5, Math.PI, 2);
  else if (el === 'fire') embers(x, y, 8, E.rgb, R * 1.6, 40, 7, 0.55);
  else if (el === 'dark') for (let i = 0; i < 5; i++) fxp({ type: 'smoke', x: x + rand(-R, R) * 0.3, y, vx: rand(-60, 60), vy: rand(-80, -30), drag: 3, grow: 18, life: 0.5, rgb: '36,14,54', size: rand(6, 10) });
  else fxTex('whirl', x, y, { w: R, h: R, rgb: E.rgb, life: 0.3, spin: 9, flat: 0.6, a: 0.7 });
}
// 属性飞弹的拖尾：火星、雪花、电光、风痕
function elTrail(b) {
  const c = D.elements[b.el].rgb;
  if (b.el === 'fire') fxp({ type: 'ember', x: b.x + rand(-3, 3), y: b.y + rand(-3, 3), vx: rand(-20, 20), vy: rand(-40, -10), drag: 2, life: 0.4, rgb: Math.random() < 0.5 ? c : '255,210,100', size: rand(5, 8) });
  else if (b.el === 'ice') fxp({ type: 'snow', x: b.x, y: b.y, vx: -b.vx * 0.05, vy: -b.vy * 0.05 + 12, drag: 2, life: 0.5, size: rand(2.5, 4), rot: rand(0, TAU), spin: 3 });
  else if (b.el === 'thunder') fxp({ type: 'spark', x: b.x, y: b.y, vx: rand(-160, 160), vy: rand(-160, 160), drag: 6, life: 0.18, rgb: c, size: 1.6 });
  else if (b.el === 'dark') fxp({ type: Math.random() < 0.5 ? 'smoke' : 'ember', x: b.x, y: b.y, vx: -b.vx * 0.05, vy: -b.vy * 0.05 - 20, drag: 2, grow: 10, life: 0.4, rgb: Math.random() < 0.5 ? c : '40,16,60', size: rand(4, 7) });
  else fxp({ type: 'spark', x: b.x, y: b.y, vx: -b.vx * 0.25 + rand(-40, 40), vy: -b.vy * 0.25 + rand(-40, 40), drag: 3, life: 0.3, rgb: c, size: 1.5 });
}
function applyElement(e, base, el, hx, hy) {
  if (Math.random() < 0.35) elSpark(el, hx, hy);
  const hitArt = window.Assets.get('elfx:hit_' + el); // 有属性命中图：偶尔在敌人身上炸开一朵小的
  if (hitArt && Math.random() < 0.3 && S.effects.length < 260) S.effects.push({ kind: 'elhit', img: hitArt, x: hx, y: hy, r: e.r * 1.3, life: 0.22, max: 0.22, rot: rand(0, TAU) });
  if (el === 'fire') { // 烈火：点燃，持续灼烧（取这几秒里最重的一次命中来算）
    const L = elStats('fire'), dps = base * L.burn;
    if (!(e.burnT > S.t)) { e.burnBase = dps; e.burnTick = S.t + 0.5; }
    else e.burnBase = Math.max(e.burnBase, dps);
    e.burnT = S.t + L.dur;
  } else if (el === 'ice' && !e.building) { // 寒冰：减速，有几率冻住（名将、精英只减速）
    const L = elStats('ice'), f = 1 - L.slow * (e.boss || e.ai ? 0.6 : 1);
    e.slowF = e.slowT > S.t ? Math.min(e.slowF, f) : f;
    e.slowT = Math.max(e.slowT, S.t + 2);
    if (!e.boss && !e.ai && !(e.frozenT > S.t) && Math.random() < L.freeze) {
      e.frozenT = S.t + 0.9; e.stunT = Math.max(e.stunT || 0, e.frozenT);
      shards(e.x, e.y - e.r, 4, 140, 6);
    }
  } else if (el === 'thunder' && S.boltBudget >= 1) { // 雷霆：引雷，在附近敌人之间跳跃
    const L = elStats('thunder');
    if (Math.random() < L.chance) {
      S.boltBudget--;
      const pts = [[e.x + rand(-30, 30), e.y - 170], [e.x, e.y - e.r * 0.6]], hit = new Set([e.id]);
      let cur = e;
      for (let k = 0; k < L.jumps; k++) {
        let best = null, bd = 170 * 170;
        near(cur.x, cur.y, 218, o => { if (o.dead || hit.has(o.id)) return; const dd = dist2(cur.x, cur.y, o.x, o.y); if (dd < bd) { bd = dd; best = o; } });
        if (!best) break;
        hit.add(best.id); pts.push([best.x, best.y - best.r * 0.6]);
        hitEnemy(best, base * L.pct, { kb: 20, quiet: true, noEl: true, color: '#c8d8ff' });
        if (L.stun && !best.boss && !best.building) best.stunT = Math.max(best.stunT || 0, S.t + L.stun);
        cur = best;
      }
      S.effects.push({ kind: 'bolt', pts: zigzag(pts, 12), life: 0.18, max: 0.18, rgb: D.elements.thunder.rgb });
      sparks(e.x, e.y - e.r * 0.6, rand(0, TAU), 3, '210,225,255', 260, Math.PI, 1.6);
    }
  } else if (el === 'dark') { // 幽冥：留下噬魂印记（多受伤害；带印记的小兵倒下时可能化作死士，见 killEnemy）
    const L = elStats('dark');
    e.curseT = S.t + 3; e.curseV = L.vuln;
  }
}
// 幽冥：带噬魂印记的小兵倒下时，有几率化作死士为你作战
function raiseShade(e) {
  const L = elStats('dark');
  if (!L || e.boss || e.ai || e.building || !(e.curseT > S.t) || Math.random() >= L.raise) return;
  if (S.allies.filter(a => a.type === 'ally_shade' && a.fromDark).length >= L.max) return;
  const a = addAllies('ally_shade', 1, { life: L.life, dmg: 12 * (1 + S.player.level * 0.04), x: e.x, y: e.y, fromDark: true });
  if (a) soulBurst(e.x, e.y, 46, 0.6);
}
// 每帧：灼烧跳伤害、雷电额度恢复、疾风旋风
function updateElements(dt) {
  const p = S.player, E = S.elements;
  S.boltBudget = Math.min(6, (S.boltBudget || 0) + dt * 10); // 同屏雷电最多每秒约 10 道，免得满屏闪
  if (E.fire) {
    const L = elStats('fire');
    for (const e of S.enemies) {
      if (e.dead || !(e.burnT > S.t) || S.t < e.burnTick) continue;
      e.burnTick = S.t + 0.5;
      if (Math.random() < 0.6) embers(e.x, e.y - e.r, 2, '255,140,60', 30, 50, 4, 0.5);
      hitEnemy(e, e.burnBase * 0.5, { quiet: true, noEl: true, noCrit: true, color: '#ff9a4a' });
      if (e.dead && L.explode && !e.building) { // 焚身：燃烧的敌人倒下时爆炸，把火引到周围
        const x = e.x, y = e.y, R = L.radius * p.areaMul, bb = e.burnBase;
        later(0.05, () => {
          explosion(x, y - 10, R * 0.5, false);
          S.effects.push({ kind: 'wave', x, y, r: R, life: 0.3, max: 0.3, color: '#ff8a3a' });
          near(x, y, R + 48, o => {
            if (dist2(x, y, o.x, o.y) > (R + o.r) ** 2) return;
            if (!(o.burnT > S.t)) { o.burnBase = bb; o.burnTick = S.t + 0.5; } else o.burnBase = Math.max(o.burnBase, bb);
            o.burnT = S.t + L.dur;
            hitEnemy(o, bb * L.explode, { kb: 120, kbAngle: angleTo(x, y, o.x, o.y), quiet: true, noEl: true, color: '#ff9a4a' });
          });
        });
      }
    }
  }
  const W = elStats('wind');
  if (W && W.gust) { // 疾风：每隔几秒一阵旋风，吹开并割伤身边的敌人
    S.gustT = (S.gustT || 0) - dt;
    const R = W.gust.radius * p.areaMul;
    if (S.gustT <= 0 && nearest(p.x, p.y, R)) {
      S.gustT = W.gust.every * p.cdMul;
      near(p.x, p.y, R + 48, e => { if (dist2(p.x, p.y, e.x, e.y) < (R + e.r) ** 2) hitEnemy(e, W.gust.dmg, { kb: 300, quiet: true, noEl: true, color: '#b8f0d0' }); });
      fxTex('whirl', 0, 0, { follow: p, oy: -10, w: R * 2.4, h: R * 2.4, rgb: '170,240,200', life: 0.45, spin: 9, flat: 0.6, a: 0.8 });
      S.effects.push({ kind: 'wave', x: p.x, y: p.y, r: R, life: 0.35, max: 0.35, color: '#9ad8b8' });
      for (let k = 0; k < 10; k++) { const a = rand(0, TAU); fxp({ type: 'spark', x: p.x + Math.cos(a) * R * 0.4, y: p.y + Math.sin(a) * R * 0.3, vx: -Math.sin(a) * 320, vy: Math.cos(a) * 240, drag: 2, life: 0.4, rgb: '200,250,225', size: 1.6 }); }
    }
  }
}
// 护甲被打空：僵直 + 易伤，碎片四溅
function breakShield(e) {
  const C = D.champion;
  e.shield = 0;
  e.vulnT = S.t + C.breakVulnTime;
  if (!e.ult) { e.state = 'recover'; e.stateT = C.breakStun; e.charges = 0; }
  const top = e.y - e.r * 1.4;
  for (let i = 0; i < 16; i++) {
    const a = rand(0, TAU), v = rand(160, 420);
    fxp({ type: 'debris', x: e.x, y: top, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, g: 520, drag: 1.5, life: rand(0.5, 0.9), color: i % 2 ? '#c9dcff' : '#e8d8a0', size: rand(3, 6), rot: rand(0, TAU), spin: rand(-14, 14) }, true);
  }
  sparks(e.x, top, 0, 18, '190,215,255', 520, Math.PI, 2.4);
  S.effects.push({ kind: 'wave', x: e.x, y: e.y - e.r * 0.5, r: e.r * 3, life: 0.4, max: 0.4, rgb: '170,200,255' });
  addNumber(e.x, top - 18, '破甲！', '#a9c8ff', 22);
  S.shake = Math.max(S.shake, e.boss ? 9 : 5);
  sfx('slam');
}

// 名将的属性攻击：这一击是谁打的、带什么属性（武将出招时由 updateEnemies 设好；飞弹、落点、火地带自己记着）
let atkEl = null, atkSrc = null;
function hurtPlayer(amount, el = atkEl, src = atkSrc) {
  const p = S.player;
  if (p.iframes > 0 || S.over || S.god || S.t < S.rampageT) return;
  const dmg = Math.max(1, Math.round(amount * (S.t < S.pCurseT ? 1 + D.bossElement.dark.amp : 1) - p.armor)); // 被噬魂：多受伤害
  p.hp -= dmg;
  if (el && D.bossElement[el]) playerEl(el, dmg, src);
  p.iframes = 0.45;
  S.shake = Math.max(S.shake, 5);
  S.hurtFlash = 0.3;
  sparks(p.x, p.y - 12, rand(0, TAU), 6, '255,90,70', 300, Math.PI, 2.2);
  addNumber(p.x, p.y - 22, '-' + dmg, '#ff6a55', 16);
  sfx('hurt');
  // 古之恶来：受伤时反震周围敌人
  const elai = S.skills.find(s => s.id === 'elai');
  if (elai && S.t >= S.thornsT) {
    const L = statsOf(D.skills.elai, elai.lv), R = L.radius * p.areaMul;
    S.thornsT = S.t + 0.4;
    near(p.x, p.y, R + 48, e => { if (dist2(p.x, p.y, e.x, e.y) < (R + e.r) ** 2) hitEnemy(e, L.dmg, { kb: 220 }); });
    S.effects.push({ kind: 'wave', x: p.x, y: p.y, r: R, life: 0.35, max: 0.35, color: '#e0a060' });
    fxTex('ring', p.x, p.y, { w: R * 0.8, h: R * 0.8, rgb: '255,150,70', life: 0.35, grow: 2.6, core: 0.4 });
    sparks(p.x, p.y, 0, 14, '255,180,100', 420, Math.PI, 2.4);
  }
  // 夏侯惇血怒：打中你就给自己回血
  const lb = S.bossList.find(b => b.leechT > S.t);
  if (lb) { lb.hp = Math.min(lb.maxHp, lb.hp + lb.maxHp * lb.leech); addNumber(lb.x, lb.y - lb.r * 3, `+${Math.round(lb.maxHp * lb.leech)}`, '#ff6a5a', 14); }
  retaliate(src);
  if (bloodRage() || feignDeath()) return;
  if (p.hp <= 0) { p.hp = 0; gameOver(); }
}
// 刚烈（夏侯惇的技能）：每次受伤，朝打你的敌人劈回一道血色刀光；打你的不是敌人（落点、飞弹）就劈向附近最强的敌人
function retaliate(src) {
  const sk = S.skills.find(s => s.id === 'ganglie');
  if (!sk || S.t < S.glT) return;
  const p = S.player, L = statsOf(D.skills.ganglie, sk.lv);
  let tgt = src && src.def && src.hp !== undefined && !src.dead && !src.vanish ? src : null;
  if (!tgt) { let bk = -1; near(p.x, p.y, 520, e => { if (e.building || e.dead || e.vanish) return; const k = (e.boss ? 1e9 : e.ai ? 1e6 : 0) + e.maxHp; if (k > bk && dist2(p.x, p.y, e.x, e.y) < 520 * 520) { bk = k; tgt = e; } }); }
  if (!tgt) return;
  S.glT = S.t + L.gap;
  const a = angleTo(p.x, p.y, tgt.x, tgt.y), len = L.len * p.areaMul, dmg = L.dmg * (1 + (1 - p.hp / p.maxHp) * L.lowHp);
  const cut = (x, y, ang) => { hitLine(x, y, ang, len, L.w, dmg, 220); fxTex('thrust', x + Math.cos(ang) * len / 2, y - 14 + Math.sin(ang) * len / 2, { w: len * 1.1, h: L.w * 1.5, rot: ang, rgb: '255,60,45', life: 0.28, sx: 1.2, core: 0.8 }); };
  cut(p.x, p.y, a);
  if (L.cross) { const b = a + Math.PI / 2; cut(tgt.x - Math.cos(b) * len / 2, tgt.y - Math.sin(b) * len / 2, b); } // Lv5：再横着补一刀，十字
  sparks(p.x, p.y - 16, a, 8, '255,90,70', 420, 0.5, 2.2);
  sfx('swing');
}
// 啖睛（夏侯惇的物品）：生命跌破一定比例时回一大截血，并狂暴几秒（伤害、移速提高），有冷却
function bloodRage() {
  const p = S.player, R = S.passives.danjing && D.passives.danjing.rage;
  if (!R || S.t < S.danjingT || p.hp > p.maxHp * R.below) return false;
  S.danjingT = S.t + R.cd; S.rageT = S.t + R.dur;
  p.hp = Math.min(p.maxHp, Math.max(1, p.hp) + p.maxHp * R.heal); p.iframes = Math.max(p.iframes, 0.5);
  fxTex('pillar', 0, 0, { follow: p, oy: -90, w: 90, h: 280, rgb: '255,50,40', life: 0.8, sx: 0.5, core: 0.6 });
  embers(p.x, p.y - 16, 20, '255,70,50', 160, 80, 8, 0.8);
  addNumber(p.x, p.y - 50, '啖睛 · 血怒', '#ff7a6a', 20);
  screenFlash('255,40,30', 0.25); sfx('boss');
  return true;
}
// 冢虎：生命跌破一定比例时诈死脱身——倒地化作一缕黑烟，几秒无敌并回一截血（有冷却）
function feignDeath() {
  const p = S.player, F = S.passives.zhonghu && D.passives.zhonghu.feign;
  if (!F || S.t < S.feignT || p.hp > p.maxHp * F.below) return false;
  S.feignT = S.t + F.cd;
  p.hp = Math.max(1, p.hp) + p.maxHp * F.heal; p.iframes = F.iframes;
  soulBurst(p.x, p.y, 120);
  smoke(p.x, p.y - 16, 8, '30,14,44', 16, 20, 1);
  addNumber(p.x, p.y - 50, '冢虎 · 诈死脱身', '#d8b8ff', 20);
  screenFlash('120,60,180', 0.25);
  sfx('boss');
  return true;
}
// 被名将的属性攻击打中：火灼烧、冰减速、雷麻痹、风吹飞
function playerEl(el, dmg, src) {
  const p = S.player, B = D.bossElement[el], E = D.elements[el];
  elSpark(el, p.x, p.y - 16); elSpark(el, p.x, p.y - 16);
  if (el === 'fire') {
    if (!(S.t < S.pBurnT)) S.pBurnDps = 0;
    S.pBurnDps = Math.max(S.pBurnDps, dmg * B.burn); S.pBurnT = S.t + B.dur;
    addNumber(p.x, p.y - 40, '灼烧', `rgb(${E.rgb})`, 13);
  } else if (el === 'ice') {
    S.pChillT = Math.max(S.pChillT, S.t + B.chill);
    addNumber(p.x, p.y - 40, '冰寒', `rgb(${E.rgb})`, 13);
  } else if (el === 'thunder') {
    S.pSlowT = Math.max(S.pSlowT, S.t + B.stun);
    S.effects.push({ kind: 'bolt', pts: zigzag([[p.x + rand(-30, 30), p.y - 220], [p.x, p.y - 10]], 14), life: 0.2, max: 0.2, rgb: E.rgb, w: 4 });
    addNumber(p.x, p.y - 40, '麻痹', `rgb(${E.rgb})`, 13);
  } else if (el === 'wind' && src) {
    const sp = Math.hypot(src.vx || 0, src.vy || 0);
    const a = sp > 1 ? Math.atan2(src.vy, src.vx) : angleTo(src.x, src.y, p.x, p.y);
    p.kvx += Math.cos(a) * B.push; p.kvy += Math.sin(a) * B.push;
    fxTex('whirl', 0, 0, { follow: p, oy: -10, w: 120, h: 120, rgb: E.rgb, life: 0.35, spin: 10, flat: 0.6, a: 0.7 });
  } else if (el === 'dark') {
    if (!(S.t < S.pCurseT)) addNumber(p.x, p.y - 40, '噬魂 · 不能回血', `rgb(${E.rgb})`, 13);
    S.pCurseT = S.t + B.curse;
  }
}

function killEnemy(e) {
  e.dead = true;
  if (e.tomb) { tombBroken(e); return; } // 司马懿的疑冢：不算杀敌、不掉东西
  S.kills++;
  raiseShade(e); // 幽冥：带印记的小兵可能化作死士
  // 血战：杀敌回血、叠战意
  const xz = !e.building && S.skills.find(s => s.id === 'xuezhan');
  if (xz) {
    const L = statsOf(D.skills.xuezhan, xz.lv), p = S.player;
    p.hp = Math.min(p.maxHp, p.hp + L.heal * (e.boss ? 40 : e.ai ? 8 : 1));
    S.lust = Math.min(L.max, S.lust + 1); S.lustT = S.t; S.lustPer = L.per;
  }
  if (e.boss) { onBossDeath(e); return; }
  if (e.building) { onBuildingDestroyed(e); return; }
  if (e.ai) { // 精英：多掉经验、金币，大概率掉补给
    { const G = D.meta.gold.elite; dropGold(e.x, e.y, Math.round(rand(G[0], G[1]))); }
    for (let i = 0; i < 6; i++) dropXp(e.x + rand(-30, 30), e.y + rand(-30, 30), Math.max(2, Math.round(e.def.xp / 3 * (1 + S.t / 300))));
    if (Math.random() < 0.45) S.pickups.push({ kind: 'heal', x: e.x + 14, y: e.y, v: 30, mag: false, vel: 0 });
    if (Math.random() < 0.25) S.pickups.push({ kind: 'vacuum', x: e.x - 14, y: e.y, v: 0, mag: false, vel: 0 });
    sparks(e.x, e.y - 20, 0, 18, '255,210,120', 460, Math.PI, 2.4);
    smoke(e.x, e.y - 14, 5, '38,32,24', 12, 14, 0.7);
    glint(e.x, e.y - 24, 40, '255,220,150', 0.3);
    return;
  }
  // 经验随时间增长，保证后期也能持续升级
  dropXp(e.x, e.y, Math.max(1, Math.round(e.def.xp * (1 + Math.max(0, S.t - D.stage.xpGrowthStart) / D.stage.xpGrowthSec) * (e.elite ? 5 : 1))));
  if (Math.random() < (e.elite ? 0.5 : D.meta.gold.minion)) dropGold(e.x, e.y, e.elite ? D.meta.gold.eliteSoldier : 1);
  if (Math.random() < (e.elite ? 0.25 : 0.012)) S.pickups.push({ kind: 'heal', x: e.x, y: e.y, v: 25, mag: false, vel: 0 });
  else if (Math.random() < (e.elite ? 0.15 : 0.002)) S.pickups.push({ kind: 'vacuum', x: e.x, y: e.y, v: 0, mag: false, vel: 0 });
  // 倒下：一团墨烟 + 几块碎屑；精英多一道金光
  smoke(e.x, e.y - e.r * 0.6, e.elite ? 5 : 2, '38,32,24', e.r * 0.6, e.r * 0.5, 0.5);
  for (let i = 0; i < 3; i++) particle(e.x, e.y - e.r * 0.5, e.def.color, 160);
  if (e.elite) { glint(e.x, e.y - e.r, 34, '255,220,140', 0.3); embers(e.x, e.y - e.r, 10, '255,200,110', 140, 40, 6); }
}

function onBossDeath(e) {
  const g = e.def;
  S.bossList = S.bossList.filter(b => b !== e);
  S.defeated.push(g.name);
  markSlain(e.gid);
  if (D.voice[e.gid]) speak(e.gid, 'death', `“${D.voice[e.gid].death}”`);
  S.shake = 18; S.slowmo = 1.0;
  sfx('slam');
  for (let i = 0; i < 24; i++) particle(e.x, e.y - 20, i % 2 ? '#cfa34a' : g.color, 360);
  sparks(e.x, e.y - 30, 0, 36, '255,215,130', 700, Math.PI, 3);
  embers(e.x, e.y - 30, 30, '255,190,100', 220, 60, 9, 1.1);
  smoke(e.x, e.y - 20, 10, '30,25,18', 18, 30, 1);
  glint(e.x, e.y - 30, 90, '255,235,180', 0.45);
  groundImpact(e.x, e.y + e.r * 0.5, 220);
  for (let i = 0; i < 24; i++) dropXp(e.x + rand(-60, 60), e.y + rand(-60, 60), 5);
  { const G = D.meta.gold; for (let i = 0; i < 3; i++) dropGold(e.x + rand(-50, 50), e.y + rand(-50, 50), Math.round((G.general + G.generalPerChapter * (S.endless ? D.chapters.length : S.ch)) / 3)); }
  S.pickups.push({ kind: 'heal', x: e.x + 20, y: e.y, v: 40, mag: false, vel: 0 });
  S.pickups.push({ kind: 'vacuum', x: e.x - 20, y: e.y, v: 0, mag: false, vel: 0 });
  S.effects.push({ kind: 'wave', x: e.x, y: e.y, r: 260, life: 0.6, max: 0.6, color: '#cfa34a' });
  S.nextBossOk = S.t + D.stage.bossGap;
  if (e.gid === 'daqiao') later(1.6, () => { spawnBoss('xiaoqiao', false, e.x, e.y); banner('小乔现身', '姐姐的仇，由妹妹来报'); }); // 击败大乔，小乔从原地现身
  // 章末武将倒下：敌军溃散，几秒后进入下一章（最后一章之后进入无尽征途）
  if (e.final && !S.endless) {
    for (const m of S.enemies) if (!m.dead && !m.boss && !m.building) killEnemy(m);
    const next = D.chapters[S.ch + 1];
    banner(chap().clear, next ? `下一章 · ${next.name.split(' · ')[1]}` : '天下三分 · 征途无尽');
    addGold(D.meta.gold.chapterClear, S.player.x, S.player.y - 20); // 过章奖励
    S.chapterT = S.t + D.stage.chapterGap;
    if (!next) S.won = true;
    sfx('win');
  } else {
    banner(`斩 ${g.name}！`, '夺其兵器，承其武艺');
  }
  // 神兵：小概率掉落（没掉就累积保底），掉了奖励里多一张金色卡
  const SD = D.shenbingDrop, chance = Math.min(SD.max, SD.base + SD.pity * S.sbPity);
  const legend = !!D.shenbing[e.gid] && Math.random() < chance;
  if (legend) {
    S.sbPity = 0;
    fxTex('pillar', e.x, e.y - 160, { w: 120, h: 420, rgb: '255,215,90', life: 1.4, sx: 0.5, fadeIn: 0.05, core: 0.8 });
    fxTex('burst', e.x, e.y - 40, { w: 260, h: 260, rgb: '255,220,120', life: 0.6, grow: 1.6 });
    addNumber(e.x, e.y - 90, `神兵现世 · ${D.shenbing[e.gid].name}`, '#ffd75a', 24);
    screenFlash('255,220,120', 0.25);
  } else S.sbPity++;
  S.pendingReward = { gid: e.gid, t: legend ? 0.8 : 0.35, legend };
}
// 进入下一章；全部打完则进入无尽征途
function nextChapter() {
  S.chapterT = 0;
  S.chStart = S.t; S.evIdx = 0; S.spawnAcc = {};
  if (S.ch + 1 < D.chapters.length) {
    S.ch++;
    banner(chap().name, chap().sub);
  } else {
    S.endless = true; S.endlessStart = S.t; S.endlessT = 20;
    banner(D.endless.name, D.endless.sub);
  }
  S.eliteT = Math.min(S.eliteT, 20);
}

function onBuildingDestroyed(e) {
  const def = e.def, rw = def.reward, p = S.player;
  // 倒塌：木屑、烟尘、火星、地面裂纹
  for (let i = 0; i < 18; i++) particle(e.x + rand(-e.r, e.r), e.y - rand(0, e.r * 1.4), i % 2 ? '#6b4a2e' : '#8a6a48', 320);
  smoke(e.x, e.y - 20, 9, '40,34,26', 20, e.r * 0.7, 1.1);
  embers(e.x, e.y - 30, 18, '255,170,80', 160, 50, 8, 0.9);
  groundImpact(e.x, e.y + 10, e.r * 2.4);
  S.shake = Math.max(S.shake, 10);
  sfx('slam');
  for (let i = 0; i < 8; i++) dropXp(e.x + rand(-40, 40), e.y + rand(-30, 30), Math.max(2, Math.round(def.xp / 4 * (1 + S.t / 300))));
  dropGold(e.x, e.y, D.meta.gold.building);
  // 奖励
  let msg = def.desc.replace('摧毁后', '');
  if (rw.bonus) for (const k in rw.bonus) S.bonus[k] = (S.bonus[k] || 0) + rw.bonus[k];
  if (rw.type === 'recruit') addAllies(rw.ally, rw.count);
  else if (rw.type === 'feast') { recomputeStats(); p.hp = p.maxHp; embers(p.x, p.y, 20, '140,240,160', 60, 100, 7, 1); }
  else if (rw.type === 'forge') S.forgeReady++;
  else if (rw.type === 'general') { // 西凉营地：攻破后马超从营中杀出
    S.specialDone[e.bid] = true; S.nextBossOk = Math.max(S.nextBossOk || 0, S.t + 5);
    later(1.2, () => spawnBoss(rw.gid, false, e.x, e.y + 20));
    msg = rw.msg;
  }
  else if (rw.type === 'qiao') { // 乔府攻破：大乔从府中走出（击败大乔后小乔现身，见 onBossDeath）
    S.qiaoDone = true; S.nextBossOk = Math.max(S.nextBossOk || 0, S.t + 5);
    later(1.2, () => spawnBoss('daqiao', false, e.x, e.y + 20));
    msg = '府门洞开……大乔现身';
  }
  else if (rw.type === 'blessing') {
    const b = D.blessings[Math.floor(Math.random() * D.blessings.length)];
    for (const k in b.effects) S.bonus[k] = (S.bonus[k] || 0) + b.effects[k];
    S.blessings.push(b.name);
    msg = `神祠祝福 · ${b.name}：${b.desc}`;
    S.effects.push({ kind: 'levelup', x: p.x, y: p.y, life: 1.1, max: 1.1 });
  }
  recomputeStats();
  S.buildDirty = true;
  toast('building', e.bid, `攻破${def.name}`, msg);
}

// ============ TapTap：激励视频广告、排行榜 ============
// 只有在 TapTap 里打开时才有全局对象 tap；网页版、本地测试时没有，相关按钮全部不显示
const TT = D.taptap;
const tapApi = () => window.tap || null;
let rewardAd = null, adDone = null;
function adOK() { const t = tapApi(); return !!(t && t.createRewardedVideoAd && TT.rewardedAdUnitId); }
function getRewardAd() {
  if (rewardAd || !adOK()) return rewardAd;
  rewardAd = tapApi().createRewardedVideoAd({ adUnitId: TT.rewardedAdUnitId }); // 单例：整局游戏只创建一次
  rewardAd.onError(() => {});
  rewardAd.load().catch(() => {}); // 先预加载一条，玩家点按钮时能直接播
  rewardAd.onClose(res => { // 只有完整看完（isEnded）才给奖励
    if (actx && actx.state === 'suspended') actx.resume();
    const cb = adDone; adDone = null;
    if (cb) cb(!!(res && res.isEnded));
  });
  return rewardAd;
}
// 播一条激励视频，看完 cb(true)，没看完或没广告 cb(false)
function watchAd(cb) {
  const ad = getRewardAd();
  if (!ad) { cb(false); return; }
  adDone = cb;
  if (actx && actx.state === 'running') actx.suspend(); // 放广告时游戏静音
  const fail = () => { if (actx && actx.state === 'suspended') actx.resume(); const c = adDone; adDone = null; if (c) c(false); };
  ad.show().catch(() => ad.load().then(() => ad.show()).catch(fail));
}
function lbOK() { const t = tapApi(); return !!(t && t.getLeaderboardManager && TT.leaderboardId); }
const lbCall = (fn, args) => { try { tapApi().getLeaderboardManager()[fn](Object.assign({ leaderboardId: TT.leaderboardId, callback: { onSuccess() {}, onFailure() {} } }, args)); } catch (e) { /* 排行榜出错不影响游戏 */ } };
function submitScore() { if (lbOK() && S) lbCall('submitScores', { scores: [{ leaderboardId: TT.leaderboardId, score: S.player.level }] }); } // 按这一局达到的等级排名（等级没有上限）
function openLeaderboard() { if (lbOK()) lbCall('openLeaderboard', {}); }

// 云存档：只在 TapTap 里有（tap.getCloudSaveManager）。进游戏时先下载云端那份和本机合并，之后有变化就上传（每分钟最多一次）。
// 合并规则：局外进度取累计赚过金币更多的那份（一样多就取更新的，买装备不加累计金币）；最佳纪录取更好的；图鉴每位武将取次数更多的。
const CS = TT.cloudSave, CLOUD_KEYS = ['buyi-meta', 'buyi-best', 'buyi-slain'];
const cloud = { uuid: null, ready: false, busy: false, dirty: false, lastUp: -1e9, timer: 0 };
function cloudOK() { const t = tapApi(); return !!(t && t.getCloudSaveManager && t.getFileSystemManager && t.env && t.env.USER_DATA_PATH); }
const cloudFile = () => `${tapApi().env.USER_DATA_PATH}/${CS.name}.json`;
const readKey = k => { try { return JSON.parse(localStorage.getItem(k)) || null; } catch (e) { return null; } };
function cloudLocal() { saveMeta(true); const o = {}; for (const k of CLOUD_KEYS) { const v = readKey(k); if (v) o[k] = v; } return o; }
// 两份存档合并成一份；返回 { save, fromCloud: 本机有没有被云端更新, toCloud: 云端是不是比合并结果旧 }
function mergeSaves(loc, cl) {
  const out = {}, metaKey = m => m ? [m.total || 0, m.at || 0] : [-1, -1];
  const newer = (a, b) => { const ka = metaKey(a), kb = metaKey(b); return ka[0] !== kb[0] ? ka[0] > kb[0] : ka[1] > kb[1]; };
  const m1 = loc['buyi-meta'], m2 = cl['buyi-meta'];
  out['buyi-meta'] = m2 && newer(m2, m1) ? m2 : m1 || m2;
  const b1 = loc['buyi-best'], b2 = cl['buyi-best'];
  out['buyi-best'] = !b1 ? b2 : !b2 ? b1 : (b2.t > b1.t ? b2 : b1);
  const s1 = loc['buyi-slain'] || {}, s2 = cl['buyi-slain'] || {}, s = Object.assign({}, s1);
  for (const g in s2) s[g] = Math.max(s[g] || 0, s2[g]);
  out['buyi-slain'] = s;
  for (const k of CLOUD_KEYS) if (!out[k]) delete out[k];
  const same = (a, b) => JSON.stringify(a || null) === JSON.stringify(b || null);
  return { save: out, fromCloud: CLOUD_KEYS.some(k => !same(out[k], loc[k])), toCloud: CLOUD_KEYS.some(k => !same(out[k], cl[k])) };
}
// 有变化：标记一下，由定时器按频率限制上传
function cloudDirty() { if (cloud.ready) cloud.dirty = true; }
function cloudUpload() {
  if (!cloud.ready || cloud.busy || !cloud.dirty || performance.now() - cloud.lastUp < CS.every * 1000) return;
  const t = tapApi(), cm = t.getCloudSaveManager(), fs = t.getFileSystemManager(), save = cloudLocal(), m = save['buyi-meta'] || {}, b = save['buyi-best'];
  cloud.busy = true; cloud.dirty = false; cloud.lastUp = performance.now();
  const fail = () => { cloud.busy = false; cloud.dirty = true; }; // 失败了下一轮再传
  const meta = { name: CS.name, summary: `金币 ${m.gold || 0} · 最佳 Lv ${b ? b.lv : 0}`, playtime: Math.round(b ? b.t : 0) };
  try {
    fs.writeFile({ filePath: cloudFile(), data: JSON.stringify(Object.assign({ v: 1, at: Date.now() }, save)), encoding: 'utf8', fail,
      success: () => {
        const done = { archiveMetaData: meta, archiveFilePath: cloudFile(), fail, success: r => { cloud.busy = false; if (r && r.uuid) cloud.uuid = r.uuid; } };
        if (cloud.uuid) cm.updateArchive(Object.assign({ archiveUUID: cloud.uuid }, done)); else cm.createArchive(done);
      } });
  } catch (e) { fail(); }
}
// 进游戏：下载云端存档，和本机合并。下载失败（没网等）就过 30 秒再试——合并之前不上传，免得本机的旧档盖掉云端
function cloudInit() {
  if (!cloudOK() || cloud.timer) return;
  cloud.timer = setInterval(cloudUpload, 5000);
  cloudLoad();
}
function cloudLoad() {
  const t = tapApi(), cm = t.getCloudSaveManager(), fs = t.getFileSystemManager();
  const retry = () => setTimeout(cloudLoad, 30000);
  const start = cl => {
    const r = mergeSaves(cloudLocal(), cl || {});
    if (r.fromCloud) {
      for (const k of CLOUD_KEYS) { try { if (r.save[k]) localStorage.setItem(k, JSON.stringify(r.save[k])); } catch (e) { /* ignore */ } }
      META = null;
      if (!$('title').hidden) { refreshTitle(); renderOrigins(); }
      toast('', '', '云存档已同步', `金币 ${loadMeta().gold}`);
    }
    cloud.ready = true;
    if (r.toCloud) cloud.dirty = true;
  };
  try {
    cm.getArchiveList({ fail: retry,
      success: res => {
        const a = (res && res.saves || []).find(s => s.name === CS.name);
        if (!a) { start(null); return; } // 云端还没有：这是第一次，把本机的传上去
        cloud.uuid = a.uuid;
        cm.getArchiveData({ archiveUUID: a.uuid, archiveFileId: a.fileId, targetFilePath: `${t.env.USER_DATA_PATH}/${CS.name}_cloud.json`, fail: retry,
          success: d => fs.readFile({ filePath: d.filePath || `${t.env.USER_DATA_PATH}/${CS.name}_cloud.json`, encoding: 'utf8', fail: retry,
            success: f => { let o = null; try { o = JSON.parse(f.data); } catch (e) { /* 坏档当作没有 */ } start(o); } }) });
      } });
  } catch (e) { retry(); }
}

// 看广告复活：满血、短暂无敌，身边的敌人被震开，名将的锁链、冻结、迷惑全部解除
function revive() {
  const p = S.player;
  S.revived = true; S.over = false; S.modal = false;
  $('end').hidden = true;
  p.hp = p.maxHp; p.iframes = TT.reviveIframes;
  S.hook = null; S.rootT = 0; S.frozenT = 0; S.pChillT = 0; S.charm = null; S.pSlowT = 0; S.pBurnT = 0;
  const R = TT.reviveKnockR;
  for (const e of S.enemies) {
    if (e.dead || e.building) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < R) { const a = angleTo(p.x, p.y, e.x, e.y), k = (R - d) / R; e.kvx += Math.cos(a) * 900 * k; e.kvy += Math.sin(a) * 900 * k; if (!e.boss && !e.ai) e.stunT = S.t + 1; }
  }
  S.eproj = S.eproj.filter(b => Math.hypot(b.x - p.x, b.y - p.y) > R); // 身边的飞弹一并清掉
  S.hazards = S.hazards.filter(h => Math.hypot(h.x - p.x, h.y - p.y) > R);
  fxTex('pillar', p.x, p.y - 160, { w: 140, h: 420, rgb: '255,220,140', life: 1.2, sx: 0.5, fadeIn: 0.05, core: 0.8 });
  fxTex('ring', p.x, p.y, { w: R * 0.6, h: R * 0.6, rgb: '255,220,140', life: 0.6, grow: 3, core: 0.5 });
  embers(p.x, p.y - 20, 30, '255,220,140', 200, 80, 8, 1);
  screenFlash('255,230,170', 0.35); S.shake = Math.max(S.shake, 12);
  banner('重整旗鼓', '满血复活 · 每局仅此一次');
  sfx('level');
  saveRun();
}

function gameOver() {
  S.over = true;
  S.modal = true;
  S.choice = null;
  clearRun(); saveMeta(true); // 战死：这一局的存档作废，金币已经存好
  $('levelup').hidden = true;
  showEnd();
}

// ============ 特效 ============
function addNumber(x, y, text, color, size) {
  if (S.numbers.length > 140) S.numbers.shift();
  S.numbers.push({ x, y, text, color, size, life: 0.7, max: 0.7 });
}
// 粒子上限：超过后先丢掉不重要的（火花、光点），保证大混战时也流畅
const FX_CAP = 900;
function fxp(q, important) {
  if (S.particles.length > (important ? FX_CAP + 200 : FX_CAP)) return;
  q.max = q.life;
  S.particles.push(q);
}
function particle(x, y, color, spd) { // 碎屑
  const a = rand(0, TAU), v = rand(spd * 0.3, spd);
  fxp({ type: 'debris', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, g: 380, drag: 2, life: rand(0.35, 0.6), color, size: rand(2.5, 4.5), rot: rand(0, TAU), spin: rand(-12, 12) });
}
// 火花：沿 angle 方向迸出
function sparks(x, y, angle, n, rgb, speed, spread = 0.7, size = 2) {
  for (let i = 0; i < n; i++) {
    const a = angle + rand(-spread, spread), v = rand(speed * 0.45, speed);
    fxp({ type: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 7, life: rand(0.12, 0.26), rgb, size: rand(size * 0.7, size * 1.3) });
  }
}
function embers(x, y, n, rgb, speed = 60, rise = 40, size = 5, life = 0.6) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), v = rand(0, speed);
    fxp({ type: 'ember', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - rise, drag: 2.5, life: rand(life * 0.5, life), rgb, size: rand(size * 0.6, size) });
  }
}
function smoke(x, y, n, rgb, size = 8, spread = 10, life = 0.55) {
  for (let i = 0; i < n; i++) {
    fxp({ type: 'smoke', x: x + rand(-spread, spread), y: y + rand(-spread, spread), vx: rand(-25, 25), vy: rand(-40, -10), drag: 2, grow: size * 2.2, life: rand(life * 0.6, life), rgb, size: rand(size * 0.6, size) }, true);
  }
}
function glint(x, y, size, rgb, life = 0.16) {
  fxp({ type: 'glint', x, y, vx: 0, vy: 0, life, rgb, size, rot: rand(0, 0.8) }, true);
}
// 女将特效的碎片：樱花瓣飘散、冰晶迸裂、书页翻飞
function petals(x, y, n, speed = 160, rgb = '255,165,205', size = 6, life = 1.1) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), v = rand(speed * 0.3, speed);
    fxp({ type: 'petal', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, g: 40, drag: 2.2, life: rand(life * 0.6, life), rgb: Math.random() < 0.3 ? '255,225,238' : rgb, size: rand(size * 0.7, size * 1.2), rot: rand(0, TAU), spin: rand(-7, 7), seed: rand(0, 9) });
  }
}
function shards(x, y, n, speed = 260, size = 9) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), v = rand(speed * 0.4, speed);
    fxp({ type: 'shard', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, g: 420, drag: 2, life: rand(0.4, 0.75), size: rand(size * 0.6, size * 1.2), rot: a + Math.PI / 2, spin: rand(-8, 8) });
  }
  for (let i = 0; i < Math.ceil(n / 3); i++) fxp({ type: 'snow', x: x + rand(-20, 20), y: y + rand(-20, 10), vx: rand(-40, 40), vy: rand(-60, -20), drag: 1.5, life: rand(0.6, 1), size: rand(4, 7), rot: rand(0, TAU), spin: rand(-3, 3) });
}
function pages(x, y, n, speed = 200, size = 7) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), v = rand(speed * 0.3, speed);
    fxp({ type: 'page', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 50, g: 60, drag: 2, life: rand(0.6, 1.1), size: rand(size * 0.7, size * 1.2), rot: rand(-0.6, 0.6), spin: rand(-5, 5), seed: rand(0, 9) });
  }
}
// 重击落地：扬尘一圈 + 地面裂纹
function groundImpact(x, y, R, rgb = '120,100,72') {
  const n = Math.min(26, 10 + R / 10);
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU + rand(-0.1, 0.1), r = R * rand(0.55, 0.95);
    fxp({ type: 'dust', x: x + Math.cos(a) * r * 0.4, y: y + Math.sin(a) * r * 0.4, vx: Math.cos(a) * r * 1.6, vy: Math.sin(a) * r * 1.6, drag: 4.5, grow: 26, life: rand(0.45, 0.75), rgb, size: rand(7, 12) }, true);
  }
  S.decals.push({ kind: 'crack', x, y, lines: FX.makeCrack(R * 0.8), life: 1.6, max: 1.6 });
  if (S.decals.length > 12) S.decals.shift();
}
// 龙形拖尾：记录一路走过的位置（按距离取点），停下后从尾巴开始收起
function recordTrail(o, x, y, active, gap, max) {
  const tr = o.trail || (o.trail = []);
  if (active) {
    // tr[0] 是跟着走的龙头；它离上一个定下来的点（tr[1]）够远时，就再定一个点
    if (tr.length < 2 || Math.hypot(tr[1][0] - x, tr[1][1] - y) > gap) tr.unshift([x, y]); else tr[0] = [x, y];
    if (tr.length > max) tr.pop();
  } else if (tr.length) tr.splice(-2, 2);
}
function drawDragonTrail(tr, rgb, a, headKey, w) {
  if (!tr || tr.length < 4) return;
  // 先把折线磨圆（相邻点取平均两遍），再让身体左右游动，看起来才像龙而不是闪电
  let pts = tr;
  for (let k = 0; k < 2; k++) pts = pts.map((q, i) => i === 0 || i === pts.length - 1 ? q : [(pts[i - 1][0] + q[0] * 2 + pts[i + 1][0]) / 4, (pts[i - 1][1] + q[1] * 2 + pts[i + 1][1]) / 4]);
  const n = pts.length, out = pts.map((q, i) => {
    const pa = pts[Math.max(0, i - 1)], pb = pts[Math.min(n - 1, i + 1)], dx = pb[0] - pa[0], dy = pb[1] - pa[1], d = Math.hypot(dx, dy) || 1;
    const off = Math.sin(S.t * 10 - i * 0.7) * w * 0.45 * Math.min(1, i / 4);
    return [q[0] - dy / d * off, q[1] + dx / d * off];
  });
  FX.dragon(ctx, out, { rgb, a: a * Math.min(1, tr.length / 10), w, head: window.Assets.get(headKey), t: S.t, core: '255,255,255' });
}
// ---------- 特效贴图与打击感 ----------
// fxTex：在地图上放一张特效贴图（见 fx.js）。o 里可选：w/h 尺寸、rot 角度、rgb 染色、life 持续、
// grow 结束时放大倍数、spin 旋转、flat 压扁（贴地的环和法阵用 0.5 左右）、under 画在角色下面、fadeIn 淡入比例、core 白热核心亮度
function fxTex(key, x, y, o) {
  const life = o.life || 0.4;
  S.effects.push(Object.assign({ kind: 'tex', key, x, y, w: 100, h: 100, rot: 0, life, max: life, grow: 1, spin: 0, flat: 1, fadeIn: 0.12, core: 0.35 }, o, { life, max: life }));
}
// 重击：贴地冲击环 + 爆裂 + 地裂 + 镜头一顿一冲
function impact(x, y, R, rgb, power = 1) {
  fxTex('ring', x, y, { w: R * 2.4, h: R * 2.4, rgb, flat: 0.5, under: true, life: 0.45, grow: 1.5, core: 0.5 });
  fxTex('burst', x, y - R * 0.15, { w: R * 1.6, h: R * 1.6, rgb, life: 0.28, grow: 1.4, rot: rand(0, TAU), core: 0.7 });
  punch(0.5 * power); hitstop(0.05 * power);
}
// 董卓的黑色冲击：一圈暗红光环 + 翻滚的黑烟 + 地上一片焦黑
function darkBurst(x, y, R) {
  fxTex('ring', x, y, { w: R * 0.7, h: R * 0.7, rgb: '200,40,70', under: true, flat: 0.6, life: 0.45, grow: 2.8, core: 0.15 });
  for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; fxp({ type: 'smoke', x: x + Math.cos(a) * R * 0.3, y: y + Math.sin(a) * R * 0.2, vx: Math.cos(a) * R * 1.6, vy: Math.sin(a) * R * 1.1 - 20, drag: 3.5, grow: 30, life: 0.7, rgb: '10,6,10', size: rand(10, 16) }, true); }
  sparks(x, y - 10, -Math.PI / 2, 10, '220,60,90', 380, Math.PI, 2.2);
  S.decals.push({ kind: 'dark', x, y, r: R * 0.9, life: 2.4, max: 2.4 });
  if (S.decals.length > 40) S.decals.shift();
}
// 大乔的水光：一圈水纹 + 溅起的水花
function waterSplash(x, y, R) {
  fxTex('ring', x, y, { w: R * 0.8, h: R * 0.8, rgb: '120,225,215', under: true, flat: 0.6, life: 0.4, grow: 2.2, core: 0.3 });
  fxTex('burst', x, y - R * 0.2, { w: R * 1.8, h: R * 1.8, rgb: '130,230,220', life: 0.3, grow: 1.3, rot: rand(0, TAU), core: 0.25, a: 0.6 });
  sparks(x, y - 6, -Math.PI / 2, 10, '200,250,245', R * 5, Math.PI * 0.8, 2);
  S.decals.push({ kind: 'water', x, y, r: R, life: 1.2, max: 1.2 });
  if (S.decals.length > 40) S.decals.shift();
}
function punch(v) { S.punch = Math.max(S.punch || 0, v); }                       // 镜头往里一冲
function hitstop(sec) { S.hitstopT = Math.max(S.hitstopT || 0, sec); }            // 命中瞬间顿帧
function screenFlash(rgb, a, life = 0.25) { S.sflash = { rgb, a, life, max: life }; } // 全屏闪一下
// 'r,g,b' 形式的颜色（特效统一用这种写法）
const rgbCache = {};
function rgbOf(hex) {
  if (!hex || hex[0] !== '#') return hex || '255,255,255';
  return rgbCache[hex] || (rgbCache[hex] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(','));
}
function say(e, text) {
  S.numbers.push({ x: e.x, y: (e.topY || e.y - e.r) - 30, text, color: '#ffe2b0', size: 18, life: 1.6, max: 1.6, float: 10 });
}

// ============ 掉落 ============
function dropXp(x, y, v) {
  if (S.pickups.length > 320) {
    const g = S.pickups[Math.floor(Math.random() * S.pickups.length)];
    if (g.kind === 'xp') { g.v += v; return; }
  }
  S.pickups.push({ kind: 'xp', x: x + rand(-5, 5), y: y + rand(-5, 5), v, mag: false, vel: 0 });
}
function addXp(v) {
  const p = S.player;
  p.xp += v * (1 + (S.xpMul || 0)) * (D.stage.xpGain || 1);
  while (p.xp >= p.xpNext) {
    p.xp -= p.xpNext;
    const before = rankOf(p.level);
    p.level++;
    p.xpNext = xpFor(p.level);
    S.pendingLevels++;
    // 升级：脚下金色光柱
    S.effects.push({ kind: 'levelup', x: p.x, y: p.y, life: 1.1, max: 1.1 });
    embers(p.x, p.y, 16, '255,215,130', 70, 160, 6, 1);
    const after = rankOf(p.level);
    if (after !== before) S.rankUp = after;
  }
}
function updatePickups(dt) {
  const p = S.player, pr2 = p.pickup * p.pickup;
  for (const g of S.pickups) {
    const d2 = dist2(g.x, g.y, p.x, p.y);
    if (!g.mag && d2 < pr2) g.mag = true;
    if (!g.mag) continue;
    g.vel = Math.min(g.vel + 1500 * dt, 950);
    const d = Math.sqrt(d2) || 1;
    g.x += (p.x - g.x) / d * g.vel * dt;
    g.y += (p.y - g.y) / d * g.vel * dt;
    if (d < p.r + 8) {
      g.dead = true;
      if (g.kind === 'xp') { addXp(g.v); if (Math.random() < 0.35) glint(p.x + rand(-8, 8), p.y - 10, 9, '255,220,140', 0.14); }
      else if (g.kind === 'gold') addGold(g.v, p.x, p.y);
      else if (g.kind === 'vacuum') { // 军令：全图铜钱、金币飞向玩家
        for (const o of S.pickups) if (o.kind === 'xp' || o.kind === 'gold') o.mag = true;
        addNumber(p.x, p.y - 30, '军令 · 聚', '#ffcf5a', 20);
        sfx('level');
      }
      else { p.hp = Math.min(p.maxHp, p.hp + g.v); addNumber(p.x, p.y - 24, '+' + g.v, '#8fe0a8', 16); }
    }
  }
  S.pickups = S.pickups.filter(g => !g.dead);
}

// ============ 刷怪导演 ============
function spawnPos(extra) {
  const R = Math.hypot(W, H) / 2 / ZOOM + 50 + (extra || 0);
  const a = rand(0, TAU);
  return [S.player.x + Math.cos(a) * R, S.player.y + Math.sin(a) * R];
}
// 敌人强度随时间增长；进入后期（lateStart 秒后）额外按平方加速，和玩家的无限成长赛跑
function lateBoost() {
  const st = D.stage, x = Math.max(0, S.t - st.lateStart) / st.lateDiv;
  const y = S.endless ? (S.t - S.endlessStart) / st.endlessDiv : 0;
  return 1 + x * x + y * y;
}
function spawnEnemy(type, x, y) {
  const c = !S.endless && D.chapters[S.ch];
  if (c && c.swap && c.swap[type]) type = c.swap[type]; // 黄巾章：通用兵种换成黄巾军
  const def = D.enemies[type], st = D.stage;
  let hpMul = Math.pow(1 + S.t * st.hpGrowth, st.minionHpExp) * lateBoost() * st.enemyHpMul; // 小兵血量随时间加速成长
  let dmgMul = (1 + S.t * st.dmgGrowth) * Math.sqrt(lateBoost());
  const elite = S.endless && Math.random() < Math.min(st.eliteMax, st.eliteChance + (S.t - S.endlessStart) / 6000);
  if (elite) { hpMul *= 6; dmgMul *= 1.5; }
  const e = {
    id: nextId++, type, def, x, y, r: def.r + (elite ? 6 : 0), elite,
    hp: def.hp * hpMul, maxHp: def.hp * hpMul,
    speed: def.speed * rand(0.9, 1.1), dmg: def.dmg * dmgMul,
    kvx: 0, kvy: 0, flash: 0, slowT: 0, slowF: 1, shootT: rand(0.8, 2.2), boss: false,
  };
  S.enemies.push(e);
  return e;
}
// 精英与武将的强化版招式数据：更快、出招更勤、范围更大（不改动 data.js 里的原始数据）
const champCache = {};
// 强化幅度随时间拉满：开局的武将、精英只强化一部分（champK），5 分钟后全额
const champK = () => clamp(0.3 + S.t / 300, 0.3, 1);
// 名将额外的那一档强化也随时间拉满：第一章的名将几乎不加，第二章起全额（新手先学会躲招）
const genK = () => clamp((S.t - D.champion.general.rampFrom) / D.champion.general.rampSec, 0, 1);
function championDef(key, base) {
  const C = D.champion, G = key.startsWith('g:') ? C.general : null; // 名将再加强一档
  const kk = Math.round(Math.max(champK(), G ? G.kMin : 0) * 10) / 10, gk = G ? Math.round(genK() * 10) / 10 : 0, ck = key + '|' + kk + '|' + gk;
  if (champCache[ck]) return champCache[ck];
  const g = Object.assign({}, base);
  const m = v => 1 + (v - 1) * kk;                                   // 精英那一档
  const mx = v => G ? 1 + (v - 1) * gk : 1;                          // 名将额外那一档（只有名将有）
  const mg = (gv, ev) => m(ev) * (G ? mx(gv / ev) : 1);              // 名将：精英那一档 × 额外那一档
  const big = (k, v, gv, ev) => { const x = v * mg(gv, ev); return G && G.cap[k] ? Math.min(x, Math.max(G.cap[k], v)) : x; };
  const area = (o, gv, ev) => {
    const c = Object.assign({}, o);
    for (const k of ['radius', 'R', 'r']) if (c[k]) c[k] = (k === 'R' && /^(beanArmy|stoneRing)$/.test(c.type)) ? c[k] * m(ev) : big(k, c[k], gv, ev); // 围住玩家的圈不放大，否则反而更好躲
    if (c.len) c.len *= m(C.ultArea);
    if (G && c.w) c.w *= mx(G.width);
    if (G && c.range) c.range *= mx(G.hazard);
    if (G && c.delay) c.delay *= mx(G.tele);
    return c;
  };
  const GG = G || {};
  g.speed = base.speed * mg(GG.speed || C.speed, C.speed);
  if (base.chargeSpeed) g.chargeSpeed = base.chargeSpeed * mg(GG.charge || C.charge, C.charge);
  if (base.interval) g.interval = base.interval * m(C.interval);
  if (base.ultEvery) g.ultEvery = base.ultEvery * m(C.ultEvery);
  for (const k of ['slamR', 'cleaveR', 'roarR']) if (base[k]) g[k] = big(k, base[k], GG.area || C.area, C.area);
  if (base.meteor) g.meteor = area(base.meteor, GG.area || C.area, C.area);
  if (base.kite) g.kite = base.kite * m(0.8); // 远程武将也贴得更近
  if (base.ults) g.ults = base.ults.map(u => area(u, GG.ultArea || C.ultArea, C.ultArea));
  g.aoe = mx(GG.hazard || 1);   // 大招里写死大小的落点也跟着放大
  g.teleK = mx(GG.tele || 1);
  return (champCache[ck] = g);
}
// 名将的减伤：半血、濒死各一档（data.js 的 champion.phases）
function bossPhase(e) {
  const ph = D.champion.phases, f = e.hp / e.maxHp;
  let k = 0;
  for (let i = 0; i < ph.length; i++) if (f < ph[i].below) k = i + 1;
  if (k <= (e.phase || 0)) return;
  e.phase = k; e.dr = Math.round(ph[k - 1].dr * (0.5 + 0.5 * genK()) * 100) / 100; // 第一章的名将减伤只有一半，之后全额
  const rgb = k > 1 ? '255,120,80' : '255,210,110';
  addNumber(e.x, (e.topY || e.y - 80) - 30, `${ph[k - 1].text} · 减伤 ${Math.round(e.dr * 100)}%`, k > 1 ? '#ff9a7a' : '#ffd98a', 22);
  fxTex('circle', 0, 0, { follow: e, oy: e.r * 0.6, w: e.r * 6, h: e.r * 6, rgb, under: true, flat: 0.5, life: 1.2, spin: 2.5, grow: 1.3, fadeIn: 0.05 });
  fxTex('pillar', 0, 0, { follow: e, oy: -e.r * 3, w: e.r * 3, h: e.r * 8, rgb, life: 0.7, sx: 0.4, core: 0.6 });
  glint(e.x, e.y - e.r * 1.5, 60, rgb, 0.3);
  S.shake = Math.max(S.shake, 8);
  sfx('boss');
}
function addShield(e, frac) { e.shieldMax = e.shield = e.maxHp * frac * (0.35 + 0.65 * champK()); e.shieldHitT = 0; }

// 武将血量与伤害按登场时间放大：越晚登场越强
function spawnBoss(gid, final, atX, atY) {
  const g = championDef('g:' + gid, D.generals[gid]);
  const [x, y] = atX !== undefined ? [atX, atY] : spawnPos(-80); // 大乔、小乔从乔府里走出来
  // 玩家成长是加速的，武将血量也要加速；战役里后期的平方加成只算一半（无尽征途全额）
  const lb = lateBoost(), mul = Math.pow(1 + S.t / 240, D.stage.bossHpExp) * (S.endless ? lb : 1 + (lb - 1) * D.stage.bossLateMul);
  const hp = (S.endless ? Math.max(g.hp, D.stage.endlessBossHp) : g.hp) * mul * D.stage.bossHpMul;
  const e = {
    id: nextId++, gid, def: g, x, y, r: g.r, hp, maxHp: hp, final: !!final,
    speed: g.speed, dmg: g.dmg * (S.endless ? (1 + S.t / 700) * Math.sqrt(lateBoost()) : 1 + S.t / 1000),
    kvx: 0, kvy: 0, flash: 0, slowT: 0, slowF: 1, boss: true,
    state: 'chase', atkT: 1.4, atkIdx: 0, stateT: 0, stateMax: 1, ang: 0, charges: 0, enraged: false, ultT: 4.5,
  };
  addShield(e, D.champion.shield.boss);
  S.enemies.push(e);
  S.bossList.push(e);
  // 立绘切入：第一次登场念台词，再次登场显示强度
  if (S.seen[gid]) { S.seen[gid]++; showCutin(gid, `${g.name} 卷土重来`, `第 ${S.seen[gid]} 次交手 · 血量 ${Math.round(hp)}`); }
  else { S.seen[gid] = 1; showCutin(gid, g.banner, g.line); }
  speak(gid, 'enter', g.line, false); // 登场横幅里已经有这句台词，不再另出字幕
  sfx('boss');
  S.shake = 12;
}
// 精英：有自己的招式（与武将共用招式系统），不占武将血条，头顶有名字和血条
function spawnElite(type, x, y) {
  const def = championDef('e:' + type, D.enemies[type]), st = D.stage;
  if (x === undefined) [x, y] = spawnPos(-40);
  const hpMul = (1 + S.t * st.hpGrowth) * lateBoost() * st.enemyHpMul, dmgMul = (1 + S.t * st.dmgGrowth) * Math.sqrt(lateBoost());
  const e = {
    id: nextId++, type, def, x, y, r: def.r, hp: def.hp * hpMul, maxHp: def.hp * hpMul,
    speed: def.speed, dmg: def.dmg * dmgMul, kvx: 0, kvy: 0, flash: 0, slowT: 0, slowF: 1, boss: false, ai: true,
    state: 'chase', atkT: 0.9 + Math.random() * 0.6, atkIdx: 0, stateT: 0, stateMax: 1, ang: 0, charges: 0,
  };
  addShield(e, D.champion.shield.elite);
  S.enemies.push(e);
  toast('elite', type, `精英 · ${def.name}`, def.title);
  return e;
}

// 据点：固定在地图上，派兵防守；摧毁后获得奖励
function spawnBuilding(bid, x, y) {
  const def = D.buildings[bid], st = D.stage;
  const hpMul = (1 + S.t * st.hpGrowth) * lateBoost() * st.enemyHpMul;
  const e = {
    id: nextId++, type: 'bld_' + bid, bid, def, x, y, r: def.r, hp: def.hp * hpMul, maxHp: def.hp * hpMul,
    kvx: 0, kvy: 0, flash: 0, slowT: 0, slowF: 1, boss: false, building: true,
    spawnT: 2, shootT: 1.5, guarded: false,
  };
  S.enemies.push(e);
  return e;
}
function placeBuilding(minD, maxD) {
  const p = S.player, st = D.stage;
  const types = Object.keys(D.buildings).filter(id => !D.buildings[id].special && S.t >= (D.buildings[id].unlock || 0)); // 乔府只由剧情放出
  // 优先放场上还没有的类型
  const present = new Set(S.enemies.filter(e => e.building).map(e => e.bid));
  const fresh = types.filter(id => !present.has(id));
  const bid = (fresh.length ? fresh : types)[Math.floor(Math.random() * (fresh.length || types.length))];
  for (let tries = 0; tries < 20; tries++) {
    const a = rand(0, TAU), d = rand(minD, maxD), x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
    if (S.enemies.some(e => e.building && dist2(e.x, e.y, x, y) < 450 * 450)) continue;
    return spawnBuilding(bid, x, y);
  }
  return null;
}

// 乔府：放在你右下方（屏幕右下角再往外一点），什么时候去打都行
// 西凉营地这类剧情据点：放在你身边某个方向（dx, dy），什么时候去打都行；打掉后记在 S.specialDone 里
function placeSpecial(bid, dx, dy) {
  if (S.specialDone[bid] || S.enemies.some(e => e.bid === bid && !e.dead)) return;
  const p = S.player, e = spawnBuilding(bid, p.x + dx, p.y + dy), def = D.buildings[bid];
  for (const o of S.enemies) if (o.building && o !== e && !o.def.special && dist2(o.x, o.y, e.x, e.y) < 420 * 420) o.dead = true; // 让开位置
  const dir = (dx < 0 ? '西' : '东') + (dy < 0 ? '北' : '南'); // 西北、东南……
  toast('building', bid, def.name, `就在${dir}方向，走近了才会动手`);
}
function placeQiaofu() {
  if (S.qiaoDone || S.enemies.some(e => e.bid === 'qiaofu' && !e.dead)) return;
  const p = S.player, e = spawnBuilding('qiaofu', p.x + 820, p.y + 560);
  for (const o of S.enemies) if (o.building && o !== e && !o.def.special && dist2(o.x, o.y, e.x, e.y) < 420 * 420) o.dead = true; // 让开位置
  toast('building', 'qiaofu', '江东乔府', '就在东南方向，走近了府中才会动手');
}
function runEvent(ev) {
  if (ev.type === 'boss') { spawnBoss(ev.id, ev.final); return; }
  if (ev.type === 'qiaofu') { placeQiaofu(); return; }
  if (ev.type === 'special') { placeSpecial(ev.bid, ev.dx, ev.dy); return; }
  if (ev.type === 'ambush') {
    const R = Math.min(W, H) / 2 / ZOOM + 90;
    for (let i = 0; i < ev.count; i++) {
      const a = i / ev.count * TAU;
      spawnEnemy(ev.enemy, S.player.x + Math.cos(a) * R, S.player.y + Math.sin(a) * R);
    }
    banner(ev.text, '小心包围');
  }
}
// 藏在剧情建筑里的名将：西凉营地的马超、乔府的大乔小乔、孤冢的司马懿（从 data.js 的建筑奖励里找出来）
const HIDDEN_GENERALS = new Set(Object.values(D.buildings).flatMap(b => !b.reward ? [] : b.reward.type === 'general' ? [b.reward.gid] : b.reward.type === 'qiao' ? ['daqiao', 'xiaoqiao'] : []));
function director(dt) {
  const st = D.stage;
  if (S.chapterT && S.t >= S.chapterT) nextChapter();
  const c = chap(), ct = ctime();
  // 本章事件：武将要等上一名倒下、并且隔一小会儿才登场
  while (!S.endless && !S.chapterT && S.evIdx < c.events.length && ct >= c.events[S.evIdx].t) {
    const ev = c.events[S.evIdx];
    if (ev.type === 'boss' && (S.bossList.length || S.t < S.nextBossOk)) break;
    runEvent(ev); S.evIdx++;
  }
  if (S.endless) {
    S.endlessT -= dt;
    if (S.endlessT <= 0 && !S.bossList.length) {
      S.endlessT = st.endlessBossEvery;
      // 在全部武将里随机（不连续重复）；藏在建筑里的名将（马超、大小乔、司马懿）要这一局打掉过建筑、见过面才会出现
      const ids = Object.keys(D.generals).filter(id => id !== S.lastBoss && (!HIDDEN_GENERALS.has(id) || S.seen[id]));
      const gid = ids[Math.floor(Math.random() * ids.length)];
      S.lastBoss = gid;
      spawnBoss(gid);
    }
  }
  // 精英：定时出现，间隔随时间缩短；武将在场时不来凑热闹
  S.eliteT -= dt;
  if (S.eliteT <= 0) {
    const unlocked = Object.keys(c.elites).filter(id => ct >= c.elites[id]);
    if (unlocked.length && !S.bossList.length && !S.chapterT) spawnElite(unlocked[Math.floor(Math.random() * unlocked.length)]);
    S.eliteT = Math.max(st.eliteEveryMin, st.eliteEvery - S.t / 30);
  }
  // 据点：开局放几个，被摧毁或走远后补上
  const blds = S.enemies.filter(e => e.building && !e.dead);
  if (!S.buildingsPlaced) { S.buildingsPlaced = true; for (let i = 0; i < st.buildingStart; i++) placeBuilding(550, 1000); }
  S.buildingT -= dt;
  if (blds.length < st.buildingMax && S.buildingT <= 0) { placeBuilding(800, 1300); S.buildingT = st.buildingEvery; }
  let wave = c.waves[0];
  for (const w of c.waves) if (ct >= w.t) wave = w;
  let mul = (S.bossList.length ? st.bossRateMul : 1) * st.spawnMul; // 小兵更耐打，数量稍微少一点
  if (S.endless) mul *= 1 + (S.t - S.endlessStart) / 90;
  if (S.enemies.length > 420 || S.chapterT) mul = 0; // 换章间隙喘口气
  for (const type in wave.rates) {
    S.spawnAcc[type] = (S.spawnAcc[type] || 0) + wave.rates[type] * mul * dt;
    while (S.spawnAcc[type] >= 1) {
      S.spawnAcc[type] -= 1;
      const [x, y] = spawnPos();
      spawnEnemy(type, x, y);
    }
  }
}

// ============ 玩家 ============
function updatePlayer(dt) {
  const p = S.player;
  const [mx, my] = moveInput();
  const rampage = (S.t < S.rampageT ? 1 + S.rampageSpeed : 1) * (S.t < S.rageT ? 1 + D.passives.danjing.rage.speed : 1); // 七进七出 / 啖睛狂暴
  const slowed = (S.t < S.pSlowT ? 0.55 : 1) * (S.t < S.pChillT ? 0.6 : 1) * (S.t < S.frozenT ? 0 : 1); // 震慑 / 冰冻减速 / 冻住
  const wind = S.t < S.windT ? 1 : 0;                     // 借东风：被风推着走
  let cx = 0, cy = 0;                                     // 被貂蝉迷住：不由自主地往她身边走
  const ch = S.charm;
  if (ch && (S.t > ch.until || ch.boss.dead)) S.charm = null;
  else if (ch) {
    const a = angleTo(p.x, p.y, ch.boss.x, ch.boss.y), d = Math.sqrt(dist2(p.x, p.y, ch.boss.x, ch.boss.y));
    if (d > ch.boss.r + p.r + 20) { cx = Math.cos(a) * ch.pull; cy = Math.sin(a) * ch.pull; }
    if (Math.random() < 0.5) fxp({ type: 'petal', x: p.x + rand(-14, 14), y: p.y - rand(10, 40), vx: Math.cos(a) * 80, vy: Math.sin(a) * 80 - 20, drag: 1, life: 0.8, rgb: '255,160,205', size: rand(4, 6), rot: rand(0, TAU), spin: rand(-6, 6), seed: rand(0, 9) });
  }
  // 被董卓的铁链钩住：身不由己地被拖到他身前，挨一记重踏（闪现能挣脱）；被捆住时原地动不了
  const hk = S.hook;
  if (hk && (hk.boss.dead || S.over)) S.hook = null;
  else if (hk) {
    const b = hk.boss, a = angleTo(p.x, p.y, b.x, b.y), d = Math.sqrt(dist2(p.x, p.y, b.x, b.y)), reach = b.r + p.r + 16;
    if (d <= reach + 4) {
      S.hook = null;
      p.iframes = 0; hurtPlayer(hk.crush);
      p.kvx -= Math.cos(a) * 380; p.kvy -= Math.sin(a) * 380; // 被一脚踹开
      darkBurst(b.x, b.y, 150);
      S.shake = Math.max(S.shake, 14); punch(0.6); hitstop(0.06);
      sfx('slam');
    } else {
      const step = Math.min(d - reach, hk.pull * dt);
      cx = Math.cos(a) * step / dt; cy = Math.sin(a) * step / dt;
      if (Math.random() < 0.5) fxp({ type: 'smoke', x: p.x + rand(-10, 10), y: p.y + 6, vx: -Math.cos(a) * 60, vy: -Math.sin(a) * 60, drag: 3, grow: 18, life: 0.45, rgb: '14,10,14', size: rand(7, 11) });
    }
  }
  const bound = !!S.hook || S.t < S.rootT;
  const ctl = bound ? 0 : ch ? 0.45 : 1;
  p.x += mx * p.speed * rampage * slowed * ctl * dt + p.kvx * dt + S.windX * wind * dt + cx * dt;
  p.y += my * p.speed * rampage * slowed * ctl * dt + p.kvy * dt + S.windY * wind * dt + cy * dt;
  if (S.t < S.pChillT && Math.random() < 0.3) fxp({ type: 'snow', x: p.x + rand(-16, 16), y: p.y - rand(0, 40), vx: rand(-10, 10), vy: rand(10, 30), drag: 1, life: 0.7, size: rand(3, 5), rot: rand(0, TAU), spin: rand(-3, 3) });
  if (wind && Math.random() < 0.9) { // 风的线条
    const ox = rand(-1, 1) * W / ZOOM * 0.6, oy = rand(-1, 1) * H / ZOOM * 0.6;
    fxp({ type: 'spark', x: p.x + ox, y: p.y + oy, vx: S.windX * 7, vy: S.windY * 7, drag: 0.5, life: 0.35, rgb: '230,235,240', size: 1.4 });
  }
  const kd = Math.exp(-8 * dt);
  p.kvx *= kd; p.kvy *= kd;
  p.moving = !!(mx || my);
  if (p.moving) p.facing = Math.atan2(my, mx);
  if (S.blinkReq) { // 闪现：朝移动方向（站着不动就朝面向）瞬移一段距离，短暂无敌
    S.blinkReq = false;
    const B = D.blink;
    if (S.t >= S.blinkT && !(S.t < S.frozenT)) {
      const a = p.facing || 0, ux = Math.cos(a), uy = Math.sin(a), x0 = p.x, y0 = p.y, dist = p.blinkDist || B.dist;
      p.x += ux * dist; p.y += uy * dist;
      p.iframes = Math.max(p.iframes, B.iframes);
      S.blinkT = S.t + (p.blinkCd || B.cd);
      if (S.hook || S.t < S.rootT) { // 被董卓的铁链钩住 / 捆住：闪现挣断铁链
        S.hook = null; S.rootT = 0;
        for (let k = 0; k < 6; k++) fxp({ type: 'spark', x: x0 + rand(-10, 10), y: y0 - 14 + rand(-10, 10), vx: rand(-260, 260), vy: rand(-260, 60), drag: 3, life: 0.4, rgb: '200,60,90', size: 2 });
        addNumber(x0, y0 - 40, '挣脱', '#ffb0c0', 18);
      }
      const fly = S.shenbing.find(sb => D.shenbing[sb.gid].blinkFly); // 流光蝶钗：起点留下几只蝴蝶扑向敌人
      if (fly) { const def = D.shenbing[fly.gid]; for (let k = 0; k < def.blinkFly; k++) S.proj.push({ kind: 'butterfly', x: x0, y: y0 - 12, a: rand(0, TAU), speed: 340, vx: 0, vy: 0, r: 9, dmg: sbDmg(def, fly) * 0.6, pierce: 2, life: 2.4, hit: new Set(), homing: true, target: null, kb: 40, spin: rand(0, TAU), rgb: def.rgb }); }
      // 起点一团残烟，路径上一道光，落点一圈气浪
      smoke(x0, y0 - 12, 3, '60,55,70', 12, 10, 0.45);
      fxTex('thrust', (x0 + p.x) / 2, (y0 + p.y) / 2 - 14, { w: dist * 1.1, h: 30, rot: a, rgb: '200,225,255', life: 0.22, core: 0.6 });
      for (let k = 0; k < 8; k++) { const t = k / 7; fxp({ type: 'spark', x: x0 + ux * dist * t + rand(-6, 6), y: y0 + uy * dist * t - 14 + rand(-6, 6), vx: -ux * 120, vy: -uy * 120, drag: 4, life: 0.3, rgb: '210,230,255', size: 1.6 }); }
      fxTex('ring', p.x, p.y + 4, { w: 70, h: 70, rgb: '190,215,255', flat: 0.5, under: true, life: 0.3, grow: 1.6, core: 0.4 });
      glint(p.x, p.y - 14, 26, '225,240,255', 0.18);
      sfx('swing');
    }
  }
  if (S.dash) { // 冲阵：突进中无敌，沿途敌人受伤并被撞开
    const D2 = S.dash, ux = Math.cos(D2.a), uy = Math.sin(D2.a);
    p.x += ux * D2.len / D2.dur * dt; p.y += uy * D2.len / D2.dur * dt;
    p.iframes = Math.max(p.iframes, 0.15); p.moving = true; p.facing = D2.a;
    near(p.x, p.y, D2.w + 48, e => {
      if (D2.hit.has(e.id) || dist2(p.x, p.y, e.x, e.y) > (D2.w / 2 + e.r) ** 2) return;
      D2.hit.add(e.id);
      hitEnemy(e, D2.dmg, { kb: 320, kbAngle: D2.a + (angDiff(D2.a, angleTo(p.x, p.y, e.x, e.y)) > 0 ? 1 : -1) });
    });
    fxp({ type: 'dust', x: p.x + rand(-8, 8), y: p.y + 8, vx: -ux * 90, vy: -uy * 90, drag: 3, grow: 26, life: 0.45, rgb: '120,100,72', size: rand(8, 12) });
    D2.t -= dt;
    if (D2.t <= 0) S.dash = null;
  }
  if (!(S.t < S.pCurseT)) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt); // 被幽冥噬魂：不回血
  else if (Math.random() < 0.3) fxp({ type: 'smoke', x: p.x + rand(-10, 10), y: p.y - rand(4, 30), vx: 0, vy: -30, drag: 2, grow: 12, life: 0.5, rgb: '60,30,90', size: rand(4, 7) });
  if (S.t < S.pBurnT && !S.god) { // 被火属性名将点着：持续掉血
    p.hp -= S.pBurnDps * dt;
    if (Math.random() < 0.4) embers(p.x + rand(-8, 8), p.y - 14, 1, D.elements.fire.rgb, 30, 50, 5, 0.45);
    if (!bloodRage() && !feignDeath() && p.hp <= 0 && !S.over) { p.hp = 0; gameOver(); }
  }
  p.iframes = Math.max(0, p.iframes - dt);
  recordTrail(p, p.x, p.y - 22, S.t < S.rampageT, 14, 22); // 七进七出：身后一条白龙
  const ws = S.skills.find(s => s.id === 'wushuang');
  S.wsb = ws ? statsOf(D.skills.wushuang, ws.lv).bonus * (1 - p.hp / p.maxHp) : 0;
}

// ============ 武器 ============
function swing(a, range, L, def) {
  const p = S.player, half = L.angle / 2 * Math.PI / 180;
  near(p.x, p.y, range + 48, e => {
    const d = Math.sqrt(dist2(p.x, p.y, e.x, e.y));
    if (d > range + e.r) return;
    const ea = angleTo(p.x, p.y, e.x, e.y);
    if (d > e.r && Math.abs(angDiff(a, ea)) > half + Math.atan2(e.r, d)) return;
    if (L.stun && !e.boss && !e.building) e.stunT = S.t + L.stun; // 开山斧：震晕
    hitEnemy(e, L.dmg, { kb: L.kb, kbAngle: ea });
  });
  // 刀光颜色：锄头土白、大刀金、青龙刀青、开山斧黄
  // 带属性的刀光换成属性色（火红、冰蓝、雷紫、风青），并叠一层刀光贴图
  const rgb = curEl ? D.elements[curEl].rgb : { hoe: '240,228,196', dadao: '255,200,100', qinglong: '130,240,185', kaishan: '255,215,80' }[def.id] || (def.general ? '255,210,122' : '240,228,196');
  S.effects.push({ kind: 'arc', x: p.x, y: p.y - 10, a, range, half, life: 0.26, max: 0.26, rgb });
  if (curEl) for (let k = 0; k < 4; k++) { const t = a + rand(-half, half), rr = range * rand(0.6, 1); elSpark(curEl, p.x + Math.cos(t) * rr, p.y - 10 + Math.sin(t) * rr); }
  // 武将兵器：叠一层刀光贴图，更厚重
  if (def.general || curEl) fxTex('slash', p.x + Math.cos(a) * range * 0.55, p.y - 10 + Math.sin(a) * range * 0.55, { w: range * 2 * Math.min(1, Math.sin(Math.min(half, 1.5)) + 0.2), h: range * 0.75, rot: a + Math.PI / 2, rgb, life: 0.24, grow: 1.1, a: 0.75, core: 0.5 });
  if (L.wave) fireCrescent(a, L.dmg * L.wave, 18);
}
// 贯穿全场的刀气（青龙偃月刀、武圣）
function fireCrescent(a, dmg, r) {
  const p = S.player, sp = 460;
  S.proj.push({ kind: 'crescent', x: p.x, y: p.y, a, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: r * p.areaMul, dmg, pierce: 9999, life: 1.1, hit: new Set(), kb: 140, seed: rand(0, 9) });
}
// 直刺：命中从玩家出发、朝向 a 的一条长矩形内的所有敌人
function thrust(a, L, def) {
  const p = S.player, len = L.len * p.areaMul, hw = L.width / 2;
  const ux = Math.cos(a), uy = Math.sin(a);
  near(p.x + ux * len / 2, p.y + uy * len / 2, len / 2 + 48, e => {
    const dx = e.x - p.x, dy = e.y - p.y;
    const along = dx * ux + dy * uy, side = Math.abs(dx * -uy + dy * ux);
    if (along < -e.r || along > len + e.r || side > hw + e.r) return;
    hitEnemy(e, L.dmg, { kb: L.kb, kbAngle: a });
  });
  const rgb = curEl ? D.elements[curEl].rgb : def.rgb || (def.id === 'longdan' ? '220,235,255' : '235,215,170');
  S.effects.push({ kind: 'thrust', x: p.x, y: p.y - 10, a, len, w: L.width, life: 0.18, max: 0.18, rgb });
  if (def.spark) S.effects.push({ kind: 'bolt', pts: zigzag([[p.x, p.y - 10], [p.x + ux * len, p.y - 10 + uy * len]], 18), life: 0.15, max: 0.15, rgb: '170,210,255', w: 3 }); // 虎头湛金枪：枪尖带雷光
  if (curEl) fxTex('thrust', p.x + ux * len * 0.5, p.y - 10 + uy * len * 0.5, { w: len, h: L.width * 1.6, rot: a, rgb, life: 0.2, a: 0.8, core: 0.4 });
  glint(p.x + ux * len, p.y - 10 + uy * len, 14, rgb, 0.12);
}

// 属性：已学的属性全部保留，每次随机抽一种（几种属性机会均等，等级只决定效果强弱）。没学属性时为 null
let curEl = null;
function rollEl() {
  const ids = Object.keys(S.elements).filter(id => S.elements[id] > 0);
  return ids.length ? ids[Math.floor(Math.random() * ids.length)] : null;
}
// 这次出手放出的每一支箭、每一颗法球、每一块落石、每一圈音波各自重新抽属性；疾风的飞弹更快、多穿透
function tagEl(list, from) {
  if (!curEl) return;
  for (let i = from; i < list.length; i++) {
    const o = list[i];
    if (o.el !== undefined) continue;
    o.el = rollEl();
    const W = o.el === 'wind' && elStats('wind');
    if (W && o.vx !== undefined) {
      if (o.pierce < 999) o.pierce += W.pierce;
      if (!o.boom) { o.vx *= 1.25; o.vy *= 1.25; if (o.speed) o.speed *= 1.25; }
    }
  }
}
function updateWeapons(dt) {
  const p = S.player;
  for (const w of S.weapons) {
    const def = D.weapons[w.id], L = wStats(def, w.lv);
    curEl = rollEl();
    const n0 = S.proj.length, s0 = S.strikes.length, r0 = S.rings.length;
    weaponTick(w, def, L, dt, p);
    tagEl(S.proj, n0); tagEl(S.strikes, s0); tagEl(S.rings, r0);
  }
  curEl = null;
}
function weaponTick(w, def, L, dt, p) {
  {
    switch (def.type) {
      case 'arc': {
        w.t -= dt; if (w.t > 0) break;
        const range = L.range * p.areaMul;
        const tgt = pickTarget(p.x, p.y, range * 1.35);
        if (!tgt) { w.t = 0.08; break; }
        w.t = L.cd * p.cdMul;
        const a = angleTo(p.x, p.y, tgt.x, tgt.y);
        swing(a, range, L, def);
        if (L.back) swing(a + Math.PI, range, L, def);
        sfx('swing');
        break;
      }
      case 'projectile': {
        w.t -= dt; if (w.t > 0) break;
        const tgt = pickTarget(p.x, p.y, D.aim.arrowRange);
        if (!tgt) { w.t = 0.08; break; }
        w.t = L.cd * p.cdMul;
        const a0 = angleTo(p.x, p.y, tgt.x, tgt.y);
        for (let i = 0; i < L.count; i++) {
          const a = a0 + (i - (L.count - 1) / 2) * (L.fan || 0.13);
          S.proj.push({ kind: 'arrow', x: p.x, y: p.y, vx: Math.cos(a) * L.speed, vy: Math.sin(a) * L.speed, r: 5, dmg: L.dmg, pierce: L.pierce, life: D.aim.arrowLife, hit: new Set(), kb: 60 });
        }
        if (L.fan) sfx('swing');
        break;
      }
      case 'meteor': { // 地公符：符纸落在敌人身上，片刻后落石砸下
        w.t -= dt; if (w.t > 0) break;
        const pool = [];
        near(p.x, p.y, 460, e => { if (!e.building && dist2(p.x, p.y, e.x, e.y) < 460 * 460) pool.push(e); });
        if (!pool.length) { w.t = 0.1; break; }
        w.t = L.cd * p.cdMul;
        for (let i = 0; i < L.count; i++) {
          const e = pool[Math.floor(Math.random() * pool.length)];
          S.strikes.push({ kind: 'rock', x: e.x + rand(-20, 20), y: e.y + rand(-20, 20), r: L.radius * p.areaMul, t: L.delay + i * 0.08, max: L.delay + i * 0.08, dmg: L.dmg });
        }
        break;
      }
      case 'chain': { // 九节杖：闪电在敌人之间跳跃
        w.t -= dt; if (w.t > 0) break;
        let cur = pickTarget(p.x, p.y, L.range);
        if (!cur) { w.t = 0.08; break; }
        w.t = L.cd * p.cdMul;
        const pts = [[p.x, p.y - 22]], hit = new Set();
        for (let k = 0; k < L.chains && cur; k++) {
          hit.add(cur.id);
          pts.push([cur.x, cur.y - cur.r * 0.6]);
          const from = cur;
          hitEnemy(cur, L.dmg, { kb: 30, quiet: true });
          if (L.tug && !cur.boss && !cur.building) { const ta = angleTo(cur.x, cur.y, p.x, p.y); cur.kvx += Math.cos(ta) * L.tug * 4; cur.kvy += Math.sin(ta) * L.tug * 4; } // 缚魂链：被抽中的往你这边拽
          sparks(from.x, from.y - from.r * 0.6, rand(0, TAU), 3, def.dark ? '220,60,90' : '200,225,255', 300, Math.PI, 1.8);
          let best = null, bd = (L.jump * p.areaMul) ** 2;
          near(from.x, from.y, L.jump * p.areaMul + 48, o => { if (o.dead || hit.has(o.id)) return; const dd = dist2(from.x, from.y, o.x, o.y); if (dd < bd) { bd = dd; best = o; } });
          cur = best;
        }
        if (def.dark) S.effects.push({ kind: 'chainfx', pts, life: 0.28, max: 0.28 }); // 缚魂链：一条黑铁链在敌人之间抽过
        else S.effects.push({ kind: 'bolt', pts: zigzag(pts, 14), life: 0.2, max: 0.2, rgb: curEl ? D.elements[curEl].rgb : '170,200,255' });
        break;
      }
      case 'spin': { // 河北大刀：原地回旋，连斩数圈
        if (w.spin > 0) {
          w.spin -= dt; w.tick -= dt;
          if (w.tick <= 0) {
            w.tick = 0.16;
            const R = L.radius * p.areaMul;
            near(p.x, p.y, R + 48, e => { if (dist2(p.x, p.y, e.x, e.y) < (R + e.r) ** 2) hitEnemy(e, L.dmg, { kb: L.kb }); });
            w.a = (w.a || 0) + 2.1;
            S.effects.push({ kind: 'arc', x: p.x, y: p.y - 10, a: w.a, range: R, half: 2.4, life: 0.22, max: 0.22, rgb: '150,190,255' });
            fxTex('whirl', 0, 0, { follow: p, oy: -10, w: R * 2.4, h: R * 2.4, rgb: '140,180,255', life: 0.22, spin: 7, flat: 0.6, a: 0.8 });
            sfx('swing');
          }
          break;
        }
        w.t -= dt; if (w.t > 0) break;
        if (!nearest(p.x, p.y, L.radius * p.areaMul + 20)) { w.t = 0.1; break; }
        w.t = L.cd * p.cdMul; w.spin = L.hits * 0.16; w.tick = 0;
        break;
      }
      case 'sonic': { // 周郎琴：一圈圈音波向外扩散
        if (w.queue > 0) {
          w.qt -= dt;
          if (w.qt <= 0) {
            w.queue--; w.qt = 0.28;
            S.rings.push(def.ice // 寒玉笛：冰蓝的寒气环，碰到的敌人走不快
              ? { x: p.x, y: p.y, r: 20, maxR: L.ringR * p.areaMul, speed: 400, dmg: L.dmg, hit: new Set(), rgb: '160,215,255', core: '240,250,255', w: 10, kb: 40, ice: true }
              : { x: p.x, y: p.y, r: 20, maxR: L.ringR * p.areaMul, speed: 420, dmg: L.dmg, hit: new Set(), rgb: '255,200,170', core: '255,245,235', w: 10, kb: 80 });
            sfx('pick');
          }
        }
        w.t -= dt; if (w.t > 0) break;
        if (!nearest(p.x, p.y, L.ringR * p.areaMul)) { w.t = 0.1; break; }
        w.t = L.cd * p.cdMul; w.queue = L.count; w.qt = 0;
        break;
      }
      case 'duelSlash': { // 虎将刀：锁定附近最强的敌人，刀光一闪而至，在它身上连斩几刀
        if (w.ds) {
          const g = w.ds; g.t -= dt; if (g.t > 0) break;
          if (g.k >= g.n || g.tgt.dead) { w.ds = null; break; }
          const x = g.tgt.x, y = g.tgt.y, a = rand(0, TAU);
          hitCircle(x, y, g.R, L.dmg, 160);
          fxTex('slash', x, y - 16, { w: g.R * 2.8, h: g.R * 1.4, rot: a, rgb: '255,80,60', life: 0.22, grow: 1.2, core: 0.7 });
          sparks(x, y - 16, a, 6, '255,120,90', 380, 0.7, 2);
          sfx('swing'); g.k++; g.t = 0.12;
          break;
        }
        w.t -= dt; if (w.t > 0) break;
        const R = L.range * p.areaMul; let best = null, bk = -1;
        near(p.x, p.y, R + 48, e => { if (e.building || e.dead || e.vanish || dist2(p.x, p.y, e.x, e.y) > R * R) return; const k = (e.boss ? 1e9 : e.ai ? 1e6 : 0) + e.maxHp; if (k > bk) { bk = k; best = e; } }); // 名将 > 精英 > 血最厚的
        if (!best) { w.t = 0.15; break; }
        w.t = L.cd * p.cdMul;
        const a = angleTo(p.x, p.y, best.x, best.y), d = Math.sqrt(dist2(p.x, p.y, best.x, best.y));
        fxTex('thrust', (p.x + best.x) / 2, (p.y + best.y) / 2 - 14, { w: d * 1.1, h: 34, rot: a, rgb: '255,90,70', life: 0.2, sx: 1.2, core: 0.8 }); // 刀光一闪而至
        w.ds = { tgt: best, n: L.hits, k: 0, t: 0.08, R: L.radius * p.areaMul };
        break;
      }
      case 'gaze': { // 狼顾：身前身后同时张开两道目光，绕着你扫过一段，每个敌人每次只挨一下
        if (w.sw) {
          const g = w.sw; g.t += dt;
          const f = Math.min(1, g.t / g.dur);
          g.a = g.a0 + g.dir * f * g.sweep * TAU;
          for (const off of [0, Math.PI]) near(p.x, p.y, g.R + 48, e => {
            if (g.hit.has(e.id) || !inWedge(e.x, e.y, p.x, p.y, g.a + off, g.R, g.half, e.r)) return;
            g.hit.add(e.id); hitEnemy(e, L.dmg, { kb: 60, kbAngle: angleTo(p.x, p.y, e.x, e.y) });
          });
          if (f >= 1) w.sw = null;
          break;
        }
        w.t -= dt; if (w.t > 0) break;
        const tgt = pickTarget(p.x, p.y, L.R * p.areaMul);
        if (!tgt) { w.t = 0.1; break; }
        w.t = L.cd * p.cdMul;
        const dir = Math.random() < 0.5 ? 1 : -1, a0 = angleTo(p.x, p.y, tgt.x, tgt.y) - dir * L.half; // 从目标身前扫起
        w.sw = { a0, a: a0, dir, t: 0, dur: L.dur, sweep: L.sweep, R: L.R * p.areaMul, half: L.half, hit: new Set() };
        sfx('swing');
        break;
      }
      case 'homing': {
        w.t -= dt; if (w.t > 0) break;
        if (!nearest(p.x, p.y, D.aim.orbRange)) { w.t = 0.1; break; }
        w.t = L.cd * p.cdMul;
        for (let i = 0; i < L.count; i++) {
          const a = rand(0, TAU);
          S.proj.push({ kind: def.pkind || 'orb', x: p.x, y: p.y, a, speed: L.speed, vx: 0, vy: 0, r: def.pkind === 'lantern' ? 10 : 7, dmg: L.dmg, pierce: L.pierce || 1, blast: L.blast ? L.blast * p.areaMul : 0, life: D.aim.orbLife * (def.pkind === 'lantern' ? 1.4 : 1), hit: new Set(), homing: true, target: null, kb: 40, spin: rand(0, TAU) }); // 莲灯：慢、撞上炸开；彩蝶：能穿过几个敌人
        }
        if (def.pkind === 'petal') petals(p.x, p.y - 14, 4, 90);
        break;
      }
      case 'nova': {
        w.t -= dt; if (w.t > 0) break;
        if (!nearest(p.x, p.y, 500)) { w.t = 0.1; break; }
        w.t = L.cd * p.cdMul;
        const off = rand(0, TAU);
        for (let i = 0; i < L.count; i++) {
          const a = off + i / L.count * TAU;
          S.proj.push({ kind: 'stone', x: p.x, y: p.y, vx: Math.cos(a) * L.speed, vy: Math.sin(a) * L.speed, r: 5, dmg: L.dmg, pierce: 1, life: 0.75 * p.areaMul, hit: new Set(), kb: 90 });
        }
        break;
      }
      case 'aura': {
        const R = L.radius * p.areaMul;
        // 火圈上不断飘起火星
        for (let k = 0; k < 2; k++) {
          const a = rand(0, TAU), rr = R * rand(0.6, 1);
          if (Math.random() < 0.7) fxp({ type: 'ember', x: p.x + Math.cos(a) * rr, y: p.y + Math.sin(a) * rr * 0.9, vx: rand(-10, 10), vy: rand(-70, -35), drag: 1, life: rand(0.35, 0.7), rgb: Math.random() < 0.5 ? '255,150,60' : '255,200,90', size: rand(4, 7) });
        }
        w.t -= dt; if (w.t > 0) break;
        w.t = L.tick;
        near(p.x, p.y, R + 48, e => { if (dist2(p.x, p.y, e.x, e.y) < (R + e.r) ** 2) hitEnemy(e, L.dmg, { kb: 20, quiet: true }); });
        break;
      }
      case 'trap': {
        w.t -= dt; if (w.t > 0) break;
        w.t = L.cd * p.cdMul;
        for (let i = 0; i < L.count; i++) {
          const ox = i ? rand(-70, 70) : 0, oy = i ? rand(-70, 70) : 0;
          S.zones.push({ id: nextId++, x: p.x + ox, y: p.y + oy, r: L.radius * p.areaMul, dmg: L.dmg, tick: L.tick, tt: 0, life: L.life, max: L.life, slow: L.slow });
        }
        break;
      }
      case 'thrust': {
        w.t -= dt; if (w.t > 0) break;
        const tgt = pickTarget(p.x, p.y, L.len * p.areaMul + 30);
        if (!tgt) { w.t = 0.06; break; }
        w.t = L.cd * p.cdMul;
        const a0 = angleTo(p.x, p.y, tgt.x, tgt.y);
        for (let i = 0; i < L.count; i++) thrust(a0 + (i - (L.count - 1) / 2) * 0.32, L, def);
        sfx('swing');
        break;
      }
      case 'boomerang': {
        w.t -= dt; if (w.t > 0) break;
        const tgt = pickTarget(p.x, p.y, L.range * p.areaMul + 60);
        if (!tgt) { w.t = 0.1; break; }
        w.t = L.cd * p.cdMul;
        const a0 = angleTo(p.x, p.y, tgt.x, tgt.y);
        for (let i = 0; i < L.count; i++) {
          const a = a0 + (i - (L.count - 1) / 2) * 0.45;
          S.proj.push({ kind: 'boom', fan: def.fan, x: p.x, y: p.y, vx: Math.cos(a) * L.speed, vy: Math.sin(a) * L.speed, speed: L.speed, r: 14, dmg: L.dmg, pierce: 9999, life: 4, hit: new Set(), kb: 120, boom: true, out: true, travel: 0, range: L.range * p.areaMul, spin: 0 });
        }
        break;
      }
      case 'burst': {
        w.t -= dt; if (w.t > 0) break;
        if (!nearest(p.x, p.y, D.aim.orbRange)) { w.t = 0.1; break; }
        w.t = L.cd * p.cdMul;
        for (let i = 0; i < L.count; i++) {
          const a = rand(0, TAU);
          S.proj.push({ kind: 'fire', x: p.x, y: p.y, a, speed: L.speed, vx: 0, vy: 0, r: 8, dmg: L.dmg, pierce: 1, life: D.aim.orbLife, hit: new Set(), homing: true, target: null, kb: 60, blast: L.radius * p.areaMul });
        }
        break;
      }
      case 'orbit': {
        w.ang = (w.ang || 0) + L.spin * dt;
        const inner = (L.radius - L.len / 2) * p.areaMul, outer = (L.radius + L.len / 2) * p.areaMul;
        for (let b = 0; b < L.blades; b++) {
          const a = w.ang + b * TAU / L.blades;
          near(p.x, p.y, outer + 48, e => {
            if ((e.orbT || 0) > S.t) return;
            const d = Math.sqrt(dist2(p.x, p.y, e.x, e.y));
            if (d < inner - e.r || d > outer + e.r) return;
            const diff = angDiff(a, angleTo(p.x, p.y, e.x, e.y));
            if (Math.abs(diff) > Math.PI / 2 || Math.abs(Math.sin(diff)) * d > e.r + 12) return;
            e.orbT = S.t + L.hitGap;
            hitEnemy(e, L.dmg, { kb: 180, kbAngle: a + Math.PI / 2 });
          });
        }
        break;
      }
    }
  }
}

// ============ 技能 ============
function updateSkills(dt) {
  const p = S.player;
  for (const s of S.skills) {
    const def = D.skills[s.id], L = sStats(def, s.lv);
    switch (def.type) {
      case 'shockwave': {
        s.t -= dt; if (s.t > 0) break;
        const R = L.radius * p.areaMul;
        let any = false;
        near(p.x, p.y, R + 48, e => { if (dist2(p.x, p.y, e.x, e.y) < (R + e.r) ** 2) any = true; });
        if (!any) { s.t = 0.25; break; }
        s.t = L.cd * p.cdMul;
        near(p.x, p.y, R + 48, e => {
          if (dist2(p.x, p.y, e.x, e.y) >= (R + e.r) ** 2) return;
          if (L.stun && !e.boss) e.stunT = S.t + L.stun;
          hitEnemy(e, L.dmg, { kb: L.kb });
        });
        if (def.petal) { // 闭月：粉色花浪一圈圈推开，花瓣漫天
          for (const [d, life] of [[0, 0.5], [0.12, 0.6]]) fxTex('ring', p.x, p.y, { w: R * 0.5, h: R * 0.5, rgb: d ? '255,235,245' : '255,140,200', life: life + d, grow: 4, core: 0.4 });
          petals(p.x, p.y - 14, 34, R * 2.4);
          near(p.x, p.y, R + 48, e => { if (!e.boss && dist2(p.x, p.y, e.x, e.y) < (R + e.r) ** 2 && Math.random() < 0.25) petals(e.x, e.y - e.r, 2, 60); });
          punch(0.3); sfx('slam');
          break;
        }
        S.effects.push({ kind: 'wave', x: p.x, y: p.y, r: R, life: 0.5, max: 0.5, color: L.stun ? '#f0ead8' : '#f2c46b' });
        if (L.stun) S.effects.push({ kind: 'wave', x: p.x, y: p.y, r: R * 0.7, life: 0.35, max: 0.35, color: '#ffffff' }); // 咆哮的第二道声浪
        // 气浪贴图：骁勇是金色的刀气炸开，咆哮是两圈白色声浪
        fxTex('ring', p.x, p.y, { w: R * 0.6, h: R * 0.6, rgb: L.stun ? '245,240,225' : '255,200,100', life: 0.45, grow: 3.4, core: 0.5 });
        if (L.stun) fxTex('ring', p.x, p.y, { w: R * 0.4, h: R * 0.4, rgb: '255,255,255', life: 0.55, grow: 4.5, core: 0.3 });
        else fxTex('burst', p.x, p.y - 12, { w: R * 0.9, h: R * 0.9, rgb: '255,190,90', life: 0.3, grow: 1.4, rot: rand(0, TAU) });
        punch(0.4);
        groundImpact(p.x, p.y + 8, R * 0.8);
        S.shake = Math.max(S.shake, 7);
        sfx('slam');
        break;
      }
      case 'wushuang': {
        s.t -= dt; if (s.t > 0) break;
        s.t = L.cd * p.cdMul;
        S.rings.push({ x: p.x, y: p.y, r: 24, maxR: L.ringR * p.areaMul, speed: 560, dmg: L.dmg, hit: new Set() });
        glint(p.x, p.y - 14, 26, '255,90,70', 0.2);
        fxTex('burst', p.x, p.y - 14, { w: 180, h: 180, rgb: '255,60,40', life: 0.3, grow: 1.5, rot: rand(0, TAU) });
        punch(0.3);
        S.shake = Math.max(S.shake, 6);
        sfx('slam');
        break;
      }
      case 'trample': {
        near(p.x, p.y, p.r + 48, e => {
          if ((e.trT || 0) > S.t) return;
          if (dist2(p.x, p.y, e.x, e.y) > (p.r + e.r + 8) ** 2) return;
          e.trT = S.t + 0.4;
          hitEnemy(e, L.dmg, { kb: L.kb });
        });
        break;
      }
      case 'crescents': {
        s.t -= dt; if (s.t > 0) break;
        if (!nearest(p.x, p.y, 500)) { s.t = 0.25; break; }
        s.t = L.cd * p.cdMul;
        const off = rand(0, TAU);
        for (let i = 0; i < L.count; i++) fireCrescent(off + i / L.count * TAU, L.dmg, 30);
        glint(p.x, p.y - 14, 28, '150,255,200', 0.2);
        S.shake = Math.max(S.shake, 5);
        sfx('slam');
        break;
      }
      case 'rampage': {
        s.t -= dt;
        if (S.t < S.rampageT) {
          near(p.x, p.y, p.r + 60, e => {
            if ((e.rpT || 0) > S.t || dist2(p.x, p.y, e.x, e.y) > (p.r + e.r + 14) ** 2) return;
            e.rpT = S.t + 0.3;
            hitEnemy(e, L.dmg, { kb: 260 });
          });
          if (Math.random() < 0.6) fxp({ type: 'ember', x: p.x + rand(-12, 12), y: p.y - rand(0, 30), vx: rand(-20, 20), vy: rand(-30, -10), drag: 2, life: 0.4, rgb: '210,230,255', size: rand(4, 7) });
        }
        if (s.t > 0) break;
        if (!nearest(p.x, p.y, 400)) { s.t = 0.25; break; }
        s.t = L.cd * p.cdMul;
        S.rampageT = S.t + L.dur;
        S.rampageSpeed = L.speed;
        addNumber(p.x, p.y - 30, '七进七出！', '#e8eef2', 20);
        sfx('boss');
        break;
      }
      case 'formation': {
        s.t -= dt; if (s.t > 0) break;
        if (!nearest(p.x, p.y, 450)) { s.t = 0.25; break; }
        s.t = L.cd * p.cdMul;
        S.zones.push({ id: nextId++, formation: !def.ice && !def.water, ice: !!def.ice, water: !!def.water, heal: L.heal || 0, x: p.x, y: p.y, r: L.radius * p.areaMul, dmg: L.dmg, tick: L.tick, tt: 0, life: L.life, max: L.life, slow: L.slow });
        if (def.water) { waterSplash(p.x, p.y, L.radius * 0.8); sfx('slam'); } // 春江：脚下铺开一片莲池
        if (def.ice) { shards(p.x, p.y, 16, L.radius * 2); fxTex('ring', p.x, p.y, { w: L.radius, h: L.radius, rgb: '170,220,255', life: 0.45, grow: 2.4, core: 0.5 }); sfx('slam'); }
        break;
      }
      case 'hookPull': { // 暴政：甩出铁链钩住附近的敌人拽到身前，再踏出黑色冲击波
        s.t -= dt; if (s.t > 0) break;
        const R = L.range * p.areaMul, pool = [];
        near(p.x, p.y, R + 48, e => { if (!e.building && !e.dead && dist2(p.x, p.y, e.x, e.y) < R * R) pool.push(e); });
        if (!pool.length) { s.t = 0.25; break; }
        s.t = L.cd * p.cdMul;
        pool.sort((a, b) => dist2(p.x, p.y, a.x, a.y) - dist2(p.x, p.y, b.x, b.y));
        for (const e of pool.slice(0, L.count)) {
          S.effects.push({ kind: 'chainfx', x0: p.x, y0: p.y - 16, tgt: e, life: 0.4, max: 0.4 });
          if (!e.boss && !e.ai) { const a = angleTo(e.x, e.y, p.x, p.y), d = Math.sqrt(dist2(p.x, p.y, e.x, e.y)) - 50; e.kvx += Math.cos(a) * d * 8; e.kvy += Math.sin(a) * d * 8; }
        }
        later(0.32, () => {
          const r = L.radius * p.areaMul;
          hitCircle(p.x, p.y, r, L.dmg, 160, L.stun);
          darkBurst(p.x, p.y, r);
          punch(0.35); S.shake = Math.max(S.shake, 7);
          sfx('slam');
        });
        sfx('swing');
        break;
      }
      case 'decoy': { // 蝶影：原地留下一个蝴蝶分身，引开附近的小兵，到时炸开
        s.t -= dt; if (s.t > 0) break;
        if (!nearest(p.x, p.y, 420)) { s.t = 0.3; break; }
        s.t = L.cd * p.cdMul;
        S.decoys.push({ x: p.x, y: p.y, fx: p.fx || 1, until: S.t + L.life, lure: L.lure, dmg: L.dmg, radius: L.radius * p.areaMul });
        for (let i = 0; i < 10; i++) fxp({ type: 'fly', x: p.x, y: p.y - 20, vx: rand(-120, 120), vy: rand(-150, -30), drag: 2, life: 0.8, rgb: '215,180,255', size: rand(4, 7), rot: 0, seed: rand(0, 9) });
        break;
      }
      case 'cavalryCharge': { // 铁骑：一队西凉铁骑英灵从你身后朝敌人冲阵
        s.t -= dt; if (s.t > 0) break;
        const tgt = densest(500); if (!tgt) { s.t = 0.3; break; }
        s.t = L.cd * p.cdMul;
        spiritRiders(p.x, p.y, angleTo(p.x, p.y, tgt.x, tgt.y), L.count, L.len * p.areaMul, L.w, L.dmg, L.speed, -160);
        sfx('swing');
        break;
      }
      case 'delayedBlast': { // 遗计：给附近最强的几个敌人贴上锦囊，片刻后炸开
        s.t -= dt; if (s.t > 0) break;
        const pool = []; near(p.x, p.y, 440, e => { if (!e.building && !e.dead && !S.marks.some(m => m.e === e)) pool.push(e); });
        if (!pool.length) { s.t = 0.3; break; }
        s.t = L.cd * p.cdMul;
        pool.sort((a, b) => b.maxHp - a.maxHp);
        for (const e of pool.slice(0, L.count)) S.marks.push({ e, x: e.x, y: e.y, until: S.t + L.delay, delay: L.delay, dmg: L.dmg, radius: L.radius * p.areaMul });
        break;
      }
      case 'deadRise': { // 死士：敌群脚下裂开几座孤坟，鬼火喷涌，前几座坟里爬出死士
        s.t -= dt; if (s.t > 0) break;
        const pool = []; near(p.x, p.y, 460, e => { if (!e.building && !e.dead && dist2(p.x, p.y, e.x, e.y) < 460 * 460) pool.push(e); });
        if (!pool.length) { s.t = 0.3; break; }
        s.t = L.cd * p.cdMul;
        pool.sort((a, b) => b.maxHp - a.maxHp);
        for (let i = 0; i < L.count; i++) {
          const e = i < pool.length ? pool[i] : pool[Math.floor(Math.random() * pool.length)], t = 0.45 + i * 0.07;
          S.graves.push({ x: e.x + rand(-16, 16), y: e.y + rand(-12, 12), r: L.radius * p.areaMul, t, max: t, dmg: L.dmg, raise: i < L.raise ? 1 : 0, life: L.life, sdmg: L.sdmg });
        }
        break;
      }
      case 'levy': { // 黄巾号令：召来临时降卒
        s.t -= dt; if (s.t > 0) break;
        if (!nearest(p.x, p.y, 450)) { s.t = 0.25; break; }
        s.t = L.cd * p.cdMul;
        addAllies('ally_yt', L.count, { life: L.life, dmg: L.dmg });
        fxTex('circle', 0, 0, { follow: p, oy: 6, w: 200, h: 200, rgb: '255,200,70', under: true, flat: 0.55, life: 0.9, spin: 2, grow: 1.2 });
        fxTex('pillar', 0, 0, { follow: p, oy: -80, w: 70, h: 220, rgb: '255,210,90', life: 0.5, sx: 0.4 });
        addNumber(p.x, p.y - 30, '黄巾号令！', '#ffd75a', 20);
        sfx('boss');
        break;
      }
      case 'beans': { // 撒豆成兵：金豆化作豆兵扑向敌人
        s.t -= dt; if (s.t > 0) break;
        if (!nearest(p.x, p.y, 500)) { s.t = 0.25; break; }
        s.t = L.cd * p.cdMul;
        for (let i = 0; i < L.count; i++) {
          const a = i / L.count * TAU + rand(-0.2, 0.2);
          S.proj.push({ kind: def.page ? 'page' : 'bean', x: p.x + Math.cos(a) * 30, y: p.y + Math.sin(a) * 30, a, speed: def.page ? 300 : 250, vx: 0, vy: 0, r: 9, dmg: L.dmg, pierce: 1, life: 4, hit: new Set(), homing: true, target: null, kb: 90, blast: L.radius * p.areaMul, rgb: def.page ? '255,215,140' : '255,210,90', seed: rand(0, 9), spin: rand(0, TAU) });
        }
        if (def.page) pages(p.x, p.y - 16, 10, 160);
        else embers(p.x, p.y, 14, '255,210,90', 140, 20, 6, 0.6);
        break;
      }
      case 'thunder': { // 天雷：劈向附近的数个敌人
        s.t -= dt; if (s.t > 0) break;
        const pool = [];
        near(p.x, p.y, L.range, e => { if (!e.building && dist2(p.x, p.y, e.x, e.y) < L.range * L.range) pool.push(e); });
        if (!pool.length) { s.t = 0.25; break; }
        s.t = L.cd * p.cdMul;
        pool.sort((a, b) => b.maxHp - a.maxHp); // 先劈血厚的
        for (let i = 0; i < L.count; i++) {
          const e = i < pool.length ? pool[i] : pool[Math.floor(Math.random() * pool.length)];
          S.strikes.push({ kind: 'bolt', x: e.x, y: e.y, r: L.radius * p.areaMul, t: 0.06 + i * 0.07, max: 0.12, dmg: L.dmg });
        }
        break;
      }
      case 'dash': { // 冲阵：朝敌人最多的方向突进
        s.t -= dt; if (s.t > 0 || S.dash) break;
        const len = L.len * p.areaMul;
        let best = null, bc = 0;
        for (let k = 0; k < 12; k++) { // 12 个方向里挑沿途敌人最多的
          const a = k / 12 * TAU;
          let c = 0;
          near(p.x + Math.cos(a) * len / 2, p.y + Math.sin(a) * len / 2, len / 2 + 40, e => { if (segDist(e.x, e.y, p.x, p.y, a, len) < L.w / 2 + e.r) c += e.boss ? 6 : e.ai ? 3 : 1; });
          if (c > bc) { bc = c; best = a; }
        }
        if (best === null) { s.t = 0.25; break; }
        s.t = L.cd * p.cdMul;
        S.dash = { a: best, t: 0.22, dur: 0.22, len, w: L.w, dmg: L.dmg, hit: new Set() };
        fxTex('thrust', p.x + Math.cos(best) * len * 0.5, p.y - 18 + Math.sin(best) * len * 0.5, { w: len * 1.15, h: L.w * 1.4, rot: best, rgb: '140,180,255', life: 0.3, sx: 1.2, core: 0.7 });
        punch(0.35);
        sfx('swing');
        break;
      }
      case 'bloodlust': { // 血战：一会儿不杀敌，战意慢慢消退
        S.lustPer = L.per;
        if (S.t - S.lustT > 2.5) S.lust = Math.max(0, S.lust - dt * 5);
        break;
      }
      case 'firestorm': { // 火烧赤壁：火船落在敌群，燃起大火
        s.t -= dt; if (s.t > 0) break;
        const pool = [];
        near(p.x, p.y, 480, e => { if (!e.building) pool.push(e); });
        if (!pool.length) { s.t = 0.25; break; }
        s.t = L.cd * p.cdMul;
        for (let i = 0; i < L.count; i++) {
          const e = pool[Math.floor(Math.random() * pool.length)];
          S.strikes.push({ kind: 'fire', x: e.x, y: e.y, r: L.radius * p.areaMul, t: 0.5 + i * 0.12, max: 0.5 + i * 0.12, L });
        }
        break;
      }
    }
  }
  updateStrikes(dt);
  for (const r of S.rings) {
    r.r += r.speed * dt;
    // 血色戟气 / 琴音边缘洒出火花
    for (let k = 0; k < (r.rgb ? 2 : 4); k++) {
      const a = rand(0, TAU);
      if (r.ice) { if (Math.random() < 0.4) fxp({ type: 'snow', x: r.x + Math.cos(a) * r.r, y: r.y + Math.sin(a) * r.r, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, drag: 3, life: 0.5, size: rand(3, 5), rot: rand(0, TAU), spin: 3 }); continue; }
      fxp({ type: 'spark', x: r.x + Math.cos(a) * r.r, y: r.y + Math.sin(a) * r.r, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, drag: 6, life: 0.2, rgb: r.el ? D.elements[r.el].rgb : r.rgb || '255,80,60', size: 2.4 });
    }
    near(r.x, r.y, r.r + 48, e => {
      if (r.hit.has(e.id)) return;
      const d = Math.sqrt(dist2(r.x, r.y, e.x, e.y));
      if (Math.abs(d - r.r) < 22 + e.r) {
        r.hit.add(e.id); hitEnemy(e, r.dmg, { kb: r.kb || 240, kbAngle: angleTo(r.x, r.y, e.x, e.y), quiet: !!r.rgb, el: r.el || null });
        if (r.ice && !e.building) { e.slowT = S.t + 1.6; e.slowF = 0.45; if (Math.random() < 0.3) shards(e.x, e.y - e.r, 2, 120, 5); }
      }
    });
    if (r.r > r.maxR) r.dead = true;
  }
  S.rings = S.rings.filter(r => !r.dead);
}

// ============ 敌人与武将 AI ============
// ============ 武将大招 ============
// 每位武将 2~3 个大招（data.js 的 ults）。放之前先播演出（画面定格约 1 秒），然后带预警落下，可以躲。
function tryUlt(e) {
  const g = e.def, p = S.player, hpF = e.hp / e.maxHp, d = Math.sqrt(dist2(e.x, e.y, p.x, p.y));
  const ok = g.ults.filter(u => (!u.hpBelow || hpF < u.hpBelow) && (!u.minDist || d > u.minDist));
  if (!ok.length) return false;
  e.ultUsed = e.ultUsed || {};
  // 血量新解锁的大招优先，其次不和上一次重复
  let u = ok.find(x => x.hpBelow && !e.ultUsed[x.id]);
  if (!u) { const pool = ok.length > 1 ? ok.filter(x => x.id !== e.lastUlt) : ok; u = pool[Math.floor(Math.random() * pool.length)]; }
  e.ultUsed[u.id] = (e.ultUsed[u.id] || 0) + 1;
  e.lastUlt = u.id;
  e.ult = { u, t: 0, phase: 0, n: 0 };
  e.ultT = (g.ultEvery || 11) * (e.enraged ? 0.75 : 1);
  showUltCutin(e, u);
  return true;
}
function showUltCutin(e, u) {
  const g = e.def, box = $('ult'), artEl = $('ult-art');
  box.style.setProperty('--uc', g.ultRgb || '255,80,60');
  const cut = window.Assets.get('cutin:' + e.gid);
  if (cut) { // 专门画的特写横幅
    artEl.style.backgroundImage = `url("${cut.src}")`;
    artEl.style.backgroundSize = 'cover'; artEl.style.backgroundPosition = 'center 55%';
  } else { // 用立绘放大到眼部（按左侧横幅的实际大小对准脸）
    const band = artEl.parentElement, W = band.offsetWidth || innerWidth * 0.7, Hb = (band.offsetHeight || 160) * 1.2;
    const [cx, cy] = window.Portrait.faceOf('general', e.gid);
    const iw = W * 0.9, ih = iw * 1.5;
    artEl.style.backgroundImage = `url("${window.Portrait.src('general', e.gid)}")`;
    artEl.style.backgroundSize = `${iw}px ${ih}px`;
    artEl.style.backgroundPosition = `${W / 2 - cx * iw}px ${Hb / 2 - (cy + 0.04) * ih}px`;
  }
  $('ult-name').textContent = u.name;
  $('ult-gen').textContent = `${g.name} · 大招`;
  box.classList.remove('show'); void box.offsetWidth; box.classList.add('show'); // 演出叠在画面左侧，游戏照常进行（不再定格）
  const vl = D.voice[e.gid];
  if (vl && vl.ult[u.id]) speak(e.gid, 'ult_' + u.id, `“${vl.ult[u.id]}”`);
  // 蓄力：脚下展开专属色的法阵，身上冲起一道光柱
  const uc = g.ultRgb || '255,80,60';
  fxTex('circle', 0, 0, { follow: e, oy: e.r * 0.5, w: e.r * 7, h: e.r * 7, rgb: uc, under: true, flat: 0.55, life: 1.8, spin: 1.6, grow: 1.15, fadeIn: 0.1, core: 0.5 });
  fxTex('pillar', 0, 0, { follow: e, oy: -e.r * 3, w: e.r * 3.2, h: e.r * 9, rgb: uc, life: 1.0, sx: 0.4, fadeIn: 0.05, core: 0.6 });
  S.shake = Math.max(S.shake, 8);
  sfx('ult');
}
function tele(o) { o.max = o.life; S.teles.push(o); return o; }
function ultDone(e, rest = 0.7) {
  e.ult = null; e.state = 'recover'; e.stateT = rest; e.mounted = false; e.whirl = false; e.leapH = 0; e.skyHidden = false; e.stance = null;
  if (S.arena && S.arena.boss === e && S.arena.until === Infinity) S.arena.until = S.t + 0.35; // 夏侯惇的单挑枪阵跟着收掉
}
// 点到线段的距离（直线攻击判定）
function segDist(px, py, x, y, a, len) {
  const ux = Math.cos(a), uy = Math.sin(a), t = clamp((px - x) * ux + (py - y) * uy, 0, len);
  return Math.hypot(px - (x + ux * t), py - (y + uy * t));
}
function inWedge(px, py, x, y, a, R, half, pr) {
  const d = Math.hypot(px - x, py - y);
  return d < R + pr && Math.abs(angDiff(a, Math.atan2(py - y, px - x))) < half + Math.atan2(pr, Math.max(d, 1));
}
function addHazard(x, y, r, delay, dmg, rgb, extra) { const h = { x, y, r, t: delay, max: delay, dmg, rgb }; S.hazards.push(extra ? Object.assign(h, extra) : h); return h; }

function runUlt(e, dt) {
  const U = e.ult, u = U.u, g = e.def, p = S.player, rgb = g.ultRgb || '255,80,60';
  const toP = angleTo(e.x, e.y, p.x, p.y), DMG = m => e.dmg * m, A = g.aoe || 1;
  U.t -= dt;
  switch (u.type) {
    // 冲锋类：吕布骑赤兔三连冲、张飞长距离突刺、赵云七进七出
    case 'mountDash': case 'lanceDash': case 'sevenDash': {
      if (U.phase === 0) {
        e.mounted = u.type === 'mountDash' || !!g.rideCharge;
        // 七进七出：在玩家两侧交替穿插
        U.ang = u.type === 'sevenDash' && U.n > 0 ? toP + (U.n % 2 ? 0.55 : -0.55) : toP;
        U.len = u.len;
        tele({ kind: 'line', x: e.x, y: e.y, a: U.ang, len: U.len + e.r, w: u.w || e.r * 2.2, life: u.tele, rgb });
        U.t = u.tele; U.phase = 1;
      } else if (U.phase === 1) {
        if (U.t <= 0) {
          U.phase = 2; U.t = U.len / u.speed; U.hit = false; sfx('swing');
          // 起步：脚下爆开一圈气浪，前方拉出一道贯穿整条路线的枪芒
          const ux = Math.cos(U.ang), uy = Math.sin(U.ang);
          fxTex('thrust', e.x + ux * U.len * 0.5, e.y - e.r * 0.6 + uy * U.len * 0.5, { w: U.len * 1.15, h: (u.w || e.r * 2) * 1.6, rot: U.ang, rgb, life: 0.4, sx: 1.2, core: 0.7 });
          fxTex('ring', e.x, e.y + e.r * 0.4, { w: e.r * 4, h: e.r * 4, rgb, flat: 0.55, under: true, life: 0.35, grow: 1.8 });
          punch(0.35);
        }
      } else {
        if (u.home) U.ang += clamp(angDiff(U.ang, toP), -u.home * dt, u.home * dt); // 赵云：冲刺中咬住玩家转向
        e.x += Math.cos(U.ang) * u.speed * dt; e.y += Math.sin(U.ang) * u.speed * dt;
        fxp({ type: 'dust', x: e.x + rand(-8, 8), y: e.y + e.r * 0.5, vx: -Math.cos(U.ang) * 90, vy: -Math.sin(U.ang) * 90, drag: 3, grow: 26, life: 0.5, rgb: '120,100,72', size: rand(8, 13) });
        if (u.trail && Math.random() < 0.55) { // 赤兔踏过的地面燃起一串火焰
          S.ezones.push({ x: e.x, y: e.y + 6, r: 30, life: 1.8, max: 1.8, dmg: DMG(0.35), tick: 0.45, tt: 0, rgb: '255,110,40' });
          fxTex('flame', e.x + rand(-10, 10), e.y - 18, { w: 46, h: 92, life: 1.2, fadeIn: 0.1, grow: 1.2 });
        }
        if (u.iceTrail && Math.random() < 0.5) { // 凌波微步：踏过的地方结一层冰，踩上去被冻伤、走不快
          S.ezones.push({ x: e.x, y: e.y + 6, r: 34 * Math.sqrt(A), life: 2.4, max: 2.4, dmg: DMG(0.25), tick: 0.5, tt: 0, rgb: '150,210,255', ice: true });
          S.decals.push({ kind: 'frost', x: e.x, y: e.y + 6, r: 34 * Math.sqrt(A), life: 2.4, max: 2.4 });
          if (S.decals.length > 40) S.decals.shift();
          if (Math.random() < 0.5) shards(e.x, e.y, 2, 120, 6);
        }
        if (Math.random() < 0.8) sparks(e.x, e.y - e.r, U.ang + Math.PI, 2, rgb, 300, 0.4, 2.4);
        if (!U.hit && segDist(p.x, p.y, e.x - Math.cos(U.ang) * 40, e.y - Math.sin(U.ang) * 40, U.ang, 60) < e.r + p.r + (u.w || 0) * 0.3) {
          U.hit = true; hurtPlayer(DMG(u.dmg));
          impact(p.x, p.y, 70, rgb, 0.8);
        }
        if (U.t <= 0) { U.n++; if (U.n < u.count) U.phase = 0; else ultDone(e); }
      }
      break;
    }
    // 辕门射戟：一排带光的大箭，正中一支更粗更快
    case 'arrowRain': {
      if (U.phase === 0) {
        U.ang = toP;
        for (let i = 0; i < u.count; i++) tele({ kind: 'line', x: e.x, y: e.y, a: U.ang + (i / (u.count - 1) - 0.5) * u.spread, len: 700, w: 10, life: 0.7, rgb });
        U.t = 0.7; U.phase = 1;
      } else if (U.t <= 0) {
        for (let i = 0; i < u.count; i++) {
          const a = U.ang + (i / (u.count - 1) - 0.5) * u.spread, mid = i === (u.count - 1) / 2;
          const sp = u.speed * (mid ? 1.3 : 1);
          S.eproj.push({ kind: 'bigArrow', x: e.x, y: e.y - 20, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: mid ? 12 : 8, dmg: DMG(u.dmg * (mid ? 1.6 : 1)), life: 2.2, rgb });
        }
        // 弓弦一震：弓前爆开一团光，扇形方向扫出一道冲击
        fxTex('burst', e.x + Math.cos(U.ang) * 40, e.y - 20 + Math.sin(U.ang) * 40, { w: 170, h: 170, rgb, life: 0.3, grow: 1.5, rot: rand(0, TAU), core: 0.7 });
        fxTex('slash', e.x + Math.cos(U.ang) * 120, e.y - 20 + Math.sin(U.ang) * 120, { w: 320, h: 160, rot: U.ang + Math.PI / 2, rgb, life: 0.3, grow: 1.3, a: 0.6 });
        punch(0.4);
        sfx('slam');
        ultDone(e, 0.5);
      }
      break;
    }
    // 天下无双：巨型戟刃劈砍，接两次追斩
    case 'bigSlash': case 'multiCleave': {
      const big = u.type === 'bigSlash', total = big ? 1 + (u.follow || 0) : u.count;
      if (U.phase === 0) {
        U.ang = toP + (big && U.n ? (U.n % 2 ? 0.5 : -0.5) : 0);
        const tt = big ? (U.n ? 0.55 : 1.0) : u.tele;
        tele({ kind: 'wedge', x: e.x, y: e.y, a: U.ang, R: u.R, half: u.half, life: tt, rgb });
        U.t = tt; U.phase = 1;
      } else if (U.t <= 0) {
        if (inWedge(p.x, p.y, e.x, e.y, U.ang, u.R, u.half, p.r)) hurtPlayer(DMG(u.dmg));
        S.effects.push({ kind: 'arc', x: e.x, y: e.y - 20, a: U.ang, range: u.R, half: u.half, life: 0.45, max: 0.45, rgb });
        // 巨大的月牙刀光贴着扇形扫过
        const span = u.R * Math.min(2, 2 * Math.sin(Math.min(u.half, 1.5)) + 0.3);
        fxTex('slash', e.x + Math.cos(U.ang) * u.R * 0.62, e.y - 20 + Math.sin(U.ang) * u.R * 0.62, { w: span * 1.15, h: u.R * 0.75, rot: U.ang + Math.PI / 2, rgb, life: big ? 0.5 : 0.32, grow: 1.12, core: 0.6 });
        sparks(e.x + Math.cos(U.ang) * u.R * 0.7, e.y + Math.sin(U.ang) * u.R * 0.7, U.ang, 16, rgb, 620, 0.9, 3);
        if (big) {
          impact(e.x + Math.cos(U.ang) * u.R * 0.55, e.y + Math.sin(U.ang) * u.R * 0.55, u.R * 0.45, rgb, 1.4);
          screenFlash(rgb, 0.3);
          groundImpact(e.x + Math.cos(U.ang) * u.R * 0.5, e.y + Math.sin(U.ang) * u.R * 0.5, u.R * 0.6);
          S.decals.push({ kind: 'crack', x: e.x, y: e.y, lines: [{ pts: Array.from({ length: 12 }, (_, i) => [Math.cos(U.ang) * i * u.R / 11 + rand(-6, 6), Math.sin(U.ang) * i * u.R / 11 + rand(-6, 6)]), w: 4 }], life: 2, max: 2 });
        }
        S.shake = Math.max(S.shake, big ? 22 : 12);
        sfx('slam');
        U.n++;
        if (U.n < total) U.phase = 0; else ultDone(e);
      }
      break;
    }
    // 跃起砸落：落点先出红圈
    case 'leap': {
      if (U.phase === 0) {
        U.sx = e.x; U.sy = e.y; U.tx = p.x; U.ty = p.y;
        U.tt = Math.max(1, u.radius / 230); // 落点越大，预警越久，留出跑出圈的时间
        tele({ kind: 'circle', x: U.tx, y: U.ty, r: u.radius, life: U.tt, rgb });
        fxTex('circle', U.tx, U.ty, { w: u.radius * 2.3, h: u.radius * 2.3, rgb, under: true, life: U.tt + 0.05, spin: 2, fadeIn: 0.2, a: 0.7 }); // 落点法阵
        U.t = U.tt; U.phase = 1;
      } else {
        const k = 1 - Math.max(0, U.t) / U.tt;
        e.x = U.sx + (U.tx - U.sx) * k; e.y = U.sy + (U.ty - U.sy) * k;
        e.leapH = Math.sin(Math.PI * k) * 150;
        if (U.t <= 0) {
          e.leapH = 0;
          if (dist2(p.x, p.y, e.x, e.y) < (u.radius + p.r) ** 2) hurtPlayer(DMG(u.dmg));
          // 砸地：一道光柱落下、炸开一圈气浪
          fxTex('pillar', e.x, e.y - 160, { w: u.radius * 1.1, h: 380, rgb, life: 0.35, sx: 0.3, core: 0.7 });
          impact(e.x, e.y + e.r * 0.4, u.radius, rgb, 1.5);
          screenFlash('255,240,220', 0.22);
          S.effects.push({ kind: 'wave', x: e.x, y: e.y, r: u.radius * 1.2, life: 0.5, max: 0.5, rgb });
          groundImpact(e.x, e.y + e.r * 0.5, u.radius * 1.3);
          for (let i = 0; i < 14; i++) particle(e.x, e.y, '#6b5a44', 420);
          S.shake = Math.max(S.shake, 20);
          sfx('slam');
          ultDone(e);
        }
      }
      break;
    }
    // 西凉狂刃：边转边追，周身刀风
    case 'whirl': {
      if (U.phase === 0) { U.t = u.dur; U.phase = 1; U.tick = 0; e.whirl = true; }
      e.x += Math.cos(toP) * e.speed * 1.2 * dt; e.y += Math.sin(toP) * e.speed * 1.2 * dt;
      U.tick -= dt;
      if (U.tick <= 0) {
        U.tick = 0.3;
        if (dist2(p.x, p.y, e.x, e.y) < (u.radius + p.r) ** 2) hurtPlayer(DMG(u.dmg));
        fxTex('slash', e.x, e.y - 16, { w: u.radius * 2.2, h: u.radius * 1.1, rot: S.t * 12, rgb, life: 0.22, grow: 1.1, a: 0.7 });
      }
      if (U.t <= 0) ultDone(e);
      break;
    }
    // 当阳怒吼：超大范围，震退 + 减速
    case 'bigRoar': {
      if (U.phase === 0) { tele({ kind: 'ring', x: e.x, y: e.y, r: u.R, life: 1.1, rgb }); U.t = 1.1; U.phase = 1; }
      else if (U.t <= 0) {
        if (dist2(p.x, p.y, e.x, e.y) < (u.R + p.r) ** 2) {
          hurtPlayer(DMG(u.dmg));
          p.kvx += Math.cos(toP) * u.push; p.kvy += Math.sin(toP) * u.push;
          S.pSlowT = S.t + u.slow;
          addNumber(p.x, p.y - 34, '震慑', '#ffd98a', 18);
        }
        for (const [k, life] of [[1, 0.6], [0.7, 0.45], [0.4, 0.3]]) S.effects.push({ kind: 'wave', x: e.x, y: e.y, r: u.R * k, life, max: life, rgb: k === 1 ? rgb : '255,255,240' });
        // 声浪：三圈由小到大推开的气浪 + 口中爆开的白光
        for (const [d, life] of [[0, 0.55], [0.08, 0.6], [0.16, 0.65]]) fxTex('ring', e.x, e.y, { w: u.R * 0.6, h: u.R * 0.6, rgb: d ? '255,250,235' : rgb, life: life + d, grow: 3.4 - d * 4, core: 0.5 });
        fxTex('burst', e.x, e.y - e.r * 1.5, { w: e.r * 6, h: e.r * 6, rgb, life: 0.35, grow: 1.6, core: 0.8 });
        screenFlash('255,245,220', 0.25); punch(1); hitstop(0.07);
        groundImpact(e.x, e.y + e.r * 0.5, u.R * 0.6);
        S.shake = Math.max(S.shake, 24);
        sfx('boss');
        ultDone(e);
      }
      break;
    }
    // 狂暴：受伤减半、移动和出招更快
    case 'frenzy': {
      if (U.phase === 0) {
        e.frenzyT = S.t + u.dur; U.t = 0.4; U.phase = 1;
        // 血气冲天：一道红色光柱 + 脚下血色法阵
        fxTex('pillar', 0, 0, { follow: e, oy: -e.r * 3, w: e.r * 4, h: e.r * 9, rgb: '255,60,40', life: 0.9, sx: 0.5, core: 0.5 });
        fxTex('circle', 0, 0, { follow: e, oy: e.r * 0.5, w: e.r * 6, h: e.r * 6, rgb: '255,50,30', under: true, flat: 0.55, life: 1.4, spin: -2.5 });
        punch(0.6); screenFlash('255,40,20', 0.18);
        glint(e.x, e.y - 30, 70, '255,60,40', 0.35);
        embers(e.x, e.y - 20, 24, '255,70,40', 160, 80, 9, 0.9);
        say(e, '“杀！！”');
      } else if (U.t <= 0) ultDone(e, 0.2);
      break;
    }
    // 百鸟朝凤：前方扇形快速连刺
    case 'flurry': {
      if (U.phase === 0) { U.ang = toP; tele({ kind: 'wedge', x: e.x, y: e.y, a: U.ang, R: u.R, half: u.half, life: 0.6, rgb }); U.t = 0.6; U.phase = 1; U.k = 0; }
      else if (U.t <= 0) {
        U.t = 0.09;
        const a = U.ang + rand(-u.half, u.half);
        if (segDist(p.x, p.y, e.x, e.y, a, u.R) < 14 + p.r) hurtPlayer(DMG(u.dmg));
        S.effects.push({ kind: 'thrust', x: e.x, y: e.y - 16, a, len: u.R, w: 18, life: 0.16, max: 0.16, rgb });
        fxTex('thrust', e.x + Math.cos(a) * u.R * 0.55, e.y - 16 + Math.sin(a) * u.R * 0.55, { w: u.R * 1.1, h: 44, rot: a, rgb, life: 0.18, sx: 1.15, core: 0.8 });
        if (++U.k >= u.count) ultDone(e);
      }
      break;
    }
    // 双戟旋风：八方掷戟，飞出去再飞回来
    case 'twinStorm': {
      if (U.phase === 0) {
        for (let i = 0; i < u.count; i++) {
          const a = i / u.count * TAU + rand(-0.1, 0.1);
          S.eproj.push({ kind: u.fan ? 'fan' : 'ji', x: e.x, y: e.y - 16, vx: Math.cos(a) * u.speed, vy: Math.sin(a) * u.speed, r: 12 * Math.sqrt(A), dmg: DMG(u.dmg), life: 5, pierce: true, ret: { boss: e, travel: 0, range: u.range, back: false }, spin: 0 });
        }
        fxTex('whirl', 0, 0, { follow: e, oy: -16, w: e.r * 6, h: e.r * 6, rgb, life: 0.6, spin: 9, grow: 1.4, core: 0.5 });
        fxTex('ring', e.x, e.y, { w: e.r * 3, h: e.r * 3, rgb, flat: 0.55, under: true, life: 0.4, grow: 2.5 });
        punch(0.5);
        sfx('swing'); U.t = 0.5; U.phase = 1;
      } else if (U.t <= 0) ultDone(e, 0.4);
      break;
    }
    // 青龙偃月：一道巨大的刀气直线推进
    case 'dragonWave': {
      const nD = u.count || 1, angOf = i => U.ang + (nD > 1 ? (i / (nD - 1) - 0.5) * 2 * (u.spread || 0) : 0); // 几条青龙扇形排开
      if (U.phase === 0) { U.ang = toP; for (let i = 0; i < nD; i++) tele({ kind: 'line', x: e.x, y: e.y, a: angOf(i), len: 900, w: u.r * 2, life: 0.8, rgb }); U.t = 0.8; U.phase = 1; }
      else if (U.t <= 0) {
        for (let i = 0; i < nD; i++) { const a = angOf(i); S.eproj.push({ kind: 'dragon', x: e.x, y: e.y - 10, vx: Math.cos(a) * u.speed, vy: Math.sin(a) * u.speed, r: u.r, dmg: DMG(u.dmg), life: 3, pierce: true, rgb, seed: rand(0, 9) }); }
        // 青龙出刀：一记巨大的刀光劈出，青光炸开
        fxTex('slash', e.x + Math.cos(U.ang) * 90, e.y - 20 + Math.sin(U.ang) * 90, { w: 360, h: 180, rot: U.ang + Math.PI / 2, rgb, life: 0.4, grow: 1.25, core: 0.6 });
        fxTex('burst', e.x + Math.cos(U.ang) * 50, e.y - 20 + Math.sin(U.ang) * 50, { w: 200, h: 200, rgb, life: 0.3, grow: 1.5, rot: rand(0, TAU) });
        screenFlash(rgb, 0.2); punch(0.8); hitstop(0.05);
        sfx('slam'); S.shake = Math.max(S.shake, 10);
        ultDone(e, 0.5);
      }
      break;
    }
    // 武圣降临：青龙之气螺旋落下
    case 'spiral': {
      const base = rand(0, TAU);
      for (let i = 0; i < u.count; i++) {
        const a = base + i * 0.75, r = (70 + i * 22) * A;
        addHazard(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, 62 * A, 0.9 + i * 0.07, DMG(u.dmg), rgb, { pillar: true }); // 青龙之气化作光柱落下
      }
      fxTex('circle', e.x, e.y, { w: 700 * A, h: 700 * A, rgb, under: true, flat: 0.6, life: 2.2, spin: 1.2, fadeIn: 0.1, a: 0.55 });
      ultDone(e, 1.0);
      break;
    }
    // 火烧博望：三排火线依次炸开
    case 'fireLines': {
      const ax = Math.cos(toP), ay = Math.sin(toP), px2 = -ay, py2 = ax;
      for (let L = 0; L < u.lines; L++) {
        const off = (L - (u.lines - 1) / 2) * 120 * A;
        for (let k = 0; k < u.per; k++) {
          const s2 = (k - (u.per - 1) / 2) * 72 * A;
          addHazard(p.x + ax * off + px2 * s2, p.y + ay * off + py2 * s2, 58 * A, (1.0 + L * 0.35) * (1 + (A - 1) * 0.4), DMG(u.dmg), '255,120,40');
        }
      }
      ultDone(e, 0.8);
      break;
    }
    // 八阵图：在玩家周围布一圈石阵，随后阵中落石
    // 张角雷池、周瑜铁索连环也用这一招：外圈先落，内圈随后
    case 'stoneRing': {
      const ex = { bolt: u.bolt, burn: u.burn, ice: u.ice, pillar: !u.bolt && !u.burn && !u.ice };
      // 玩家脚下展开一座大阵，转着收紧
      fxTex('circle', p.x, p.y, { w: u.R * 2.5, h: u.R * 2.5, rgb: u.rgb || '170,200,230', under: true, life: 2.4, spin: 1.5, grow: 0.85, fadeIn: 0.1, a: 0.8 });
      for (let i = 0; i < u.n; i++) {
        const a = i / u.n * TAU;
        addHazard(p.x + Math.cos(a) * u.R, p.y + Math.sin(a) * u.R, 48 * A, 1.2, DMG(u.dmg), u.rgb || '170,190,200', ex);
      }
      for (let i = 0; i < 4; i++) addHazard(p.x + rand(-90, 90) * A, p.y + rand(-90, 90) * A, 64 * A, 2.0 + i * 0.2, DMG(u.dmg), u.rgb || '255,150,60', ex);
      ultDone(e, 0.8);
      break;
    }
    // 天雷：落点追着玩家，一道接一道
    case 'lightning': {
      if (U.phase === 0) { U.phase = 1; U.k = 0; U.t = 0; }
      if (U.t <= 0) {
        U.t = u.gap;
        const lead = U.k ? 0 : 1;
        addHazard(p.x + rand(-30, 30) * lead, p.y + rand(-30, 30) * lead, u.r, 0.8 * (1 + (A - 1) * 0.4), DMG(u.dmg), '190,215,255', { bolt: true });
        if (++U.k >= u.count) ultDone(e, 0.9);
      }
      break;
    }
    // 撒豆成兵 / 黄天当立：一圈黄巾兵围住玩家
    case 'beanArmy': {
      const type = S.endless || !D.chapters[S.ch].swap ? 'foot' : 'yt_foot';
      for (let i = 0; i < u.count; i++) {
        const a = i / u.count * TAU, x = p.x + Math.cos(a) * u.R, y = p.y + Math.sin(a) * u.R;
        spawnEnemy(type, x, y);
        smoke(x, y - 10, 2, '210,180,80', 12, 6, 0.6);
        embers(x, y - 10, 3, '255,210,90', 60, 40, 5, 0.6);
        fxTex('pillar', x, y - 70, { w: 46, h: 190, rgb: '255,210,90', life: 0.6, sx: 0.4 }); // 每个兵从金光里冒出来
      }
      fxTex('circle', p.x, p.y, { w: u.R * 2.3, h: u.R * 2.3, rgb: '255,205,80', under: true, life: 1.4, spin: 1.8, fadeIn: 0.1, a: 0.7 });
      screenFlash('255,220,120', 0.15);
      say(e, '“黄天当立！”');
      ultDone(e, 0.6);
      break;
    }
    // 曲有误：一圈圈音波扩散，每圈留一道缺口，站进缺口才能躲开
    case 'soundRing': {
      if (U.phase === 0) { U.phase = 1; U.k = 0; U.t = 0; }
      if (U.t <= 0) {
        U.t = 0.6;
        S.erings.push({ x: e.x, y: e.y, r: e.r, speed: u.speed, maxR: u.R, gapA: toP + rand(-1.4, 1.4), gap: u.gap, dmg: DMG(u.dmg), hit: false, rgb });
        sfx('pick');
        if (++U.k >= u.count) ultDone(e, 0.6);
      }
      break;
    }
    // 借东风：大风推着玩家，火箭从上风处射来
    case 'eastWind': {
      if (U.phase === 0) {
        const a = rand(0, TAU);
        S.windT = S.t + u.dur; S.windX = Math.cos(a) * 95; S.windY = Math.sin(a) * 95;
        U.t = u.dur; U.phase = 1; U.fire = 0;
      } else {
        U.fire -= dt;
        if (U.fire <= 0) {
          U.fire = 0.16;
          const wa = Math.atan2(S.windY, S.windX), from = wa + Math.PI, side = rand(-1, 1) * 380;
          const sx = p.x + Math.cos(from) * 520 - Math.sin(from) * side, sy = p.y + Math.sin(from) * 520 + Math.cos(from) * side;
          const tx = p.x + rand(-140, 140), ty = p.y + rand(-140, 140), a = Math.atan2(ty - sy, tx - sx);
          S.eproj.push({ kind: 'bigArrow', x: sx, y: sy, vx: Math.cos(a) * 480, vy: Math.sin(a) * 480, r: 7, dmg: DMG(u.dmg), life: 2.2, rgb: '255,140,50' });
          // 风痕：一道道顺风掠过的白色气流
          fxTex('thrust', p.x + rand(-1, 1) * W / ZOOM * 0.5, p.y + rand(-1, 1) * H / ZOOM * 0.5, { w: rand(220, 380), h: 26, rot: wa, rgb: '225,235,245', life: 0.45, sx: 1.4, a: 0.5, core: 0.2 });
        }
        if (U.t <= 0) ultDone(e, 0.5);
      }
      break;
    }
    // —— 貂蝉 ——
    // 闭月舞：原地起舞，几条樱花旋臂一圈圈转着向外扩散，从缝隙里钻出去
    case 'petalSpiral': {
      if (U.phase === 0) {
        U.phase = 1; U.k = 0; U.t = 0.3; U.base = toP; U.dir = Math.random() < 0.5 ? 1 : -1;
        fxTex('circle', 0, 0, { follow: e, oy: e.r * 0.6, w: e.r * 9, h: e.r * 9, rgb, under: true, flat: 0.5, life: u.waves * u.gap + 0.6, spin: 3 * U.dir, fadeIn: 0.1 });
        petals(e.x, e.y - 20, 24, 220);
      } else if (U.t <= 0) {
        U.t = u.gap;
        for (let i = 0; i < u.arms; i++) {
          const a = U.base + i * TAU / u.arms + U.k * 0.21 * U.dir;
          S.eproj.push({ kind: 'petal', x: e.x, y: e.y - 16, vx: Math.cos(a) * u.speed, vy: Math.sin(a) * u.speed, r: 9, dmg: DMG(u.dmg), life: 3, spin: rand(0, TAU), spinRate: 6 });
        }
        if (++U.k >= u.waves) ultDone(e, 0.5);
      }
      break;
    }
    // 倾城一顾：粉色的圈收拢过来，圈里的人被迷住，身不由己往她身边走
    case 'charm': {
      if (U.phase === 0) { tele({ kind: 'ring', x: e.x, y: e.y, r: u.radius, life: u.tele, rgb }); U.t = u.tele; U.phase = 1; }
      else if (U.t <= 0) {
        if (dist2(p.x, p.y, e.x, e.y) < (u.radius + p.r) ** 2) {
          hurtPlayer(DMG(u.dmg));
          S.charm = { boss: e, until: S.t + u.dur, pull: u.pull };
          addNumber(p.x, p.y - 34, '迷惑', '#ffb0d8', 20);
        }
        for (const [d, life] of [[0, 0.6], [0.1, 0.7]]) fxTex('ring', e.x, e.y, { w: u.radius * 0.5, h: u.radius * 0.5, rgb: d ? '255,235,245' : rgb, life: life + d, grow: 4.2, core: 0.4 });
        petals(e.x, e.y - 20, 40, u.radius * 2.2);
        screenFlash(rgb, 0.18); punch(0.5);
        say(e, '“将军……过来呀。”');
        ultDone(e, 0.6);
      }
      break;
    }
    // 连环计：漫天樱花，一朵朵落点追着玩家绽开
    case 'petalRain': {
      if (U.phase === 0) { U.phase = 1; U.k = 0; U.t = 0; screenFlash(rgb, 0.12); }
      if (U.t <= 0) {
        U.t = u.dur / u.count;
        const sp = 260 * A, lead = U.k % 3 === 0;
        addHazard(p.x + (lead ? 0 : rand(-sp, sp)), p.y + (lead ? 0 : rand(-sp, sp)), u.r, 0.95, DMG(u.dmg), rgb, { petal: true });
        if (++U.k >= u.count) ultDone(e, 0.6);
      }
      if (Math.random() < 0.8) fxp({ type: 'petal', x: p.x + rand(-1, 1) * W / ZOOM * 0.6, y: p.y - H / ZOOM * 0.55, vx: rand(20, 70), vy: rand(80, 140), drag: 0.3, life: 2.2, rgb: '255,170,210', size: rand(5, 8), rot: rand(0, TAU), spin: rand(-4, 4), seed: rand(0, 9) });
      break;
    }
    // —— 甄姬 ——
    // 洛水寒川：脚下寒气聚成一圈，圈里的人被冻住
    case 'frostNova': {
      if (U.phase === 0) {
        tele({ kind: 'circle', x: e.x, y: e.y, r: u.radius, life: u.tele, rgb });
        fxTex('circle', e.x, e.y, { w: u.radius * 2.3, h: u.radius * 2.3, rgb, under: true, life: u.tele + 0.1, spin: -2, fadeIn: 0.2, a: 0.7 });
        U.t = u.tele; U.phase = 1;
      } else {
        if (Math.random() < 0.6) { const a = rand(0, TAU), r = u.radius * rand(0.3, 1); fxp({ type: 'snow', x: e.x + Math.cos(a) * r, y: e.y + Math.sin(a) * r * 0.8, vx: 0, vy: rand(-30, -10), drag: 1, life: 0.6, size: rand(4, 7), rot: rand(0, TAU), spin: 2 }); }
        if (U.t <= 0) {
          if (dist2(p.x, p.y, e.x, e.y) < (u.radius + p.r) ** 2) {
            hurtPlayer(DMG(u.dmg));
            S.frozenT = S.t + u.freeze; S.pChillT = S.t + u.freeze + 1.5;
            addNumber(p.x, p.y - 34, '冻结', '#bfe6ff', 20);
          }
          for (let i = 0; i < 16; i++) { // 一圈冰棱从地里刺出
            const a = i / 16 * TAU, r = u.radius * rand(0.55, 0.95);
            fxTex('thrust', e.x + Math.cos(a) * r, e.y + Math.sin(a) * r - 26, { w: 90, h: 34, rot: -Math.PI / 2 + rand(-0.3, 0.3), rgb, life: 0.5, sx: 1.2, core: 0.7 });
          }
          shards(e.x, e.y - 20, 30, u.radius * 2.4, 11);
          S.decals.push({ kind: 'frost', x: e.x, y: e.y, r: u.radius, life: 3, max: 3 });
          fxTex('ring', e.x, e.y, { w: u.radius * 0.6, h: u.radius * 0.6, rgb: '230,245,255', life: 0.5, grow: 3.4, core: 0.6 });
          screenFlash('200,230,255', 0.25); punch(0.8); hitstop(0.05);
          S.shake = Math.max(S.shake, 14);
          sfx('slam');
          ultDone(e, 0.7);
        }
      }
      break;
    }
    // —— 孙尚香 ——
    // 兵书万卷：书页在玩家四周围成一圈，留一道缺口，然后一齐朝圈心飞来
    case 'pageCage': {
      if (U.phase === 0) {
        const cx = p.x, cy = p.y, R = u.cageR * A, n = Math.round(u.n * A), gapA = rand(0, TAU);
        tele({ kind: 'ring', x: cx, y: cy, r: R, life: u.tele, rgb });
        for (let i = 0; i < n; i++) { // 书页先悬在圈上（能看清缺口在哪），预警结束一齐飞向圈心
          const a = i / n * TAU;
          if (Math.abs(angDiff(a, gapA)) < 0.32) continue; // 缺口
          const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
          S.eproj.push({ kind: 'page', x, y, vx: 0, vy: 0, lvx: -Math.cos(a) * u.speed, lvy: -Math.sin(a) * u.speed, wait: u.tele, r: 11, dmg: DMG(u.dmg), life: u.tele + R / u.speed + 0.5, spin: a, spinRate: 3, homeIn: { x: cx, y: cy } });
          glint(x, y, 16, '255,220,150', 0.2);
        }
        pages(e.x, e.y - 30, 14, 200);
        U.t = u.tele; U.phase = 1;
      } else if (U.t <= 0) {
        sfx('swing');
        ultDone(e, 0.5);
      }
      break;
    }
    // —— 董卓 ——
    // 锁魂千链：黑色预警线向四面八方铺开，片刻后十条铁链一齐甩出，钩中谁就拖到身前；暴怒时错开角度再甩一轮
    case 'chainFan': {
      if (U.phase === 0 || (U.phase === 2 && U.t <= 0)) {
        const n = u.count, off = U.phase === 2 ? Math.PI / n : 0;
        U.angs = [];
        for (let i = 0; i < n; i++) { const a = toP + off + i / n * TAU; U.angs.push(a); tele({ kind: 'line', x: e.x, y: e.y, a, len: u.len, w: u.w * 1.5, life: u.tele, rgb, dark: true }); }
        smoke(e.x, e.y - 20, 8, '12,8,12', 18, 40, 0.9);
        U.t = u.tele; U.phase = U.phase === 2 ? 3 : 1;
      } else if ((U.phase === 1 || U.phase === 3) && U.t <= 0) {
        for (const a of U.angs) throwChain(e, a, { len: u.len, speed: u.speed, w: u.w, dmg: DMG(u.dmg), pull: 1100, crush: DMG(1.4) });
        darkBurst(e.x, e.y, 130);
        S.shake = Math.max(S.shake, 12); punch(0.4);
        sfx('slam');
        if (U.phase === 1 && e.enraged) { U.phase = 2; U.t = 0.35; } else ultDone(e, 1.0);
      }
      break;
    }
    // 天罗地网：以董卓为中心画下一个巨大的黑圈，圈边插满铁桩；时间一到，圈里的人被铁链捆住拖到他跟前
    case 'chainPrison': {
      const R = u.prisonR * Math.min(A, 1.12);
      if (U.phase === 0) {
        U.cx = e.x; U.cy = e.y; U.R = R;
        tele({ kind: 'ring', x: e.x, y: e.y, r: R, life: u.tele, rgb, dark: true });
        tele({ kind: 'circle', x: e.x, y: e.y, r: R, life: u.tele, rgb, dark: true });
        U.stakes = [];
        for (let i = 0; i < 14; i++) { const a = i / 14 * TAU, x = e.x + Math.cos(a) * R, y = e.y + Math.sin(a) * R; U.stakes.push([x, y]); S.decals.push({ kind: 'dark', x, y, r: 22, life: u.tele + 1.5, max: u.tele + 1.5 }); smoke(x, y - 10, 2, '12,8,12', 10, 8, 0.8); }
        U.t = u.tele; U.phase = 1;
      } else if (U.t <= 0) {
        const inside = dist2(p.x, p.y, U.cx, U.cy) < (U.R + p.r) ** 2;
        if (inside && canBind()) {
          hurtPlayer(DMG(u.dmg));
          S.rootT = S.t + u.root;
          S.hook = { boss: e, pull: 280, crush: DMG(1.2), chain: null };
          const near4 = U.stakes.slice().sort((a, b) => dist2(a[0], a[1], p.x, p.y) - dist2(b[0], b[1], p.x, p.y)).slice(0, 4);
          for (const [x, y] of near4) throwChain(e, 0, { ax: x, ay: y - 10, state: 'bind', speed: 1400, w: 8 });
          addNumber(p.x, p.y - 44, '天罗地网 · 闪现挣脱', '#ff9ab0', 18);
        }
        for (const [x, y] of U.stakes) fxTex('pillar', x, y - 80, { w: 34, h: 180, rgb, life: 0.4, sx: 0.4, core: 0.2 });
        darkBurst(U.cx, U.cy, 160);
        screenFlash('60,0,20', 0.3); punch(0.6); hitstop(0.05);
        S.shake = Math.max(S.shake, 16);
        sfx('slam');
        ultDone(e, 1.0);
      }
      break;
    }
    // 魔王暴政：董卓抡起两颗流星铁锤绕身横扫，一边逼近你；天上不停垂下铁链，砸中就被锁在原地
    case 'chainFlail': {
      if (U.phase === 0) {
        U.phase = 1; U.t = u.dur; U.rainT = 0.4; U.k = 0;
        for (let i = 0; i < u.balls; i++) S.flails.push({ boss: e, a: toP + i / u.balls * TAU, R: u.flailR * Math.min(A, 1.3), r: 22, spin: u.spin * (e.enraged ? 1.25 : 1), until: S.t + u.dur, dmg: DMG(u.dmg) });
        screenFlash('60,0,20', 0.25);
        say(e, '“谁敢不从！”');
      }
      const sp = e.speed * 0.55;
      e.x += Math.cos(toP) * sp * dt; e.y += Math.sin(toP) * sp * dt;
      U.rainT -= dt;
      if (U.rainT <= 0 && U.k < u.rain) {
        U.rainT = (u.dur - 0.6) / u.rain; U.k++;
        const lead = U.k % 2 === 1, sp2 = 120;
        addHazard(p.x + (lead ? 0 : rand(-sp2, sp2)), p.y + (lead ? 0 : rand(-sp2, sp2)), u.rainR * Math.min(A, 1.3), 0.95, DMG(0.9), rgb, { chainDrop: true, root: 0.7 });
      }
      if (U.t <= 0) ultDone(e, 0.8);
      break;
    }
    // —— 大乔 ——
    // 莲灯引：一排莲灯从她身边飘出，慢慢追着你飘，靠近了点燃引信、炸开水光
    case 'lanternDrift': {
      const n = u.count + (e.enraged ? 3 : 0);
      for (let i = 0; i < n; i++) {
        const a = toP + (i / (n - 1) - 0.5) * 2.6;
        S.lanterns.push({ x: e.x + Math.cos(a) * 40, y: e.y - 10 + Math.sin(a) * 40, vx: Math.cos(a) * 180, vy: Math.sin(a) * 180, speed: u.speed * rand(0.8, 1.25), life: u.life + rand(0, 1.2), blast: u.blast * Math.min(A, 1.3), dmg: DMG(u.dmg), fuse: 0, seed: rand(0, 9) });
      }
      glint(e.x, e.y - 30, 40, '255,220,160', 0.3);
      ultDone(e, 0.6);
      break;
    }
    // 春江潮涌：远处升起一道长长的水墙，片刻后横扫过来；只有莲灯标着的那处缺口能钻过去。暴怒时再从侧面来一道
    case 'tideWall': {
      const waves = e.enraged ? 2 : 1, dir0 = rand(0, TAU);
      for (let k = 0; k < waves; k++) {
        const dir = dir0 + k * Math.PI / 2, d0 = 400; // 起点在屏幕里，预警看得见
        S.tides.push({ x0: p.x - Math.cos(dir) * d0, y0: p.y - Math.sin(dir) * d0, dir, span: u.span, depth: u.depth, speed: u.speed, travel: 0, maxT: d0 * 2.2,
          gap: rand(-0.25, 0.25) * u.span, gapW: u.gapW, wait: u.tele + k * 1.4, dmg: DMG(u.dmg), push: u.push, hit: false });
      }
      sfx('ult');
      ultDone(e, 0.8);
      break;
    }
    // 江心漩涡：你脚下卷起一个大漩涡，把你往中心拖，中心那一圈不停伤人
    case 'whirlpool': {
      S.pools.push({ kind: 'whirl', x: p.x, y: p.y, R: u.poolR, coreR: u.coreR, born: S.t, until: S.t + u.dur, pull: u.pull, dmg: DMG(u.dmg), tick: 0.6, rot: 0 });
      waterSplash(p.x, p.y, 120);
      say(e, '“莫要挣扎了。”');
      ultDone(e, 0.6);
      break;
    }
    // —— 小乔 ——
    // 纸鸢索影：几只纸鸢升上天，地上的影子追着你跑，停下片刻后俯冲炸开
    case 'kiteHunt': {
      const n = u.count + (e.enraged ? 2 : 0);
      for (let i = 0; i < n; i++) S.kites.push({ x: e.x + rand(-40, 40), y: e.y + rand(-40, 40), state: 'follow', age: 0, follow: u.follow + i * u.gap, lock: u.lock, r: u.kiteR * Math.min(A, 1.3), dmg: DMG(u.dmg), speed: 230, seed: rand(0, 9) });
      for (let i = 0; i < 10; i++) fxp({ type: 'fly', x: e.x, y: e.y - 20, vx: rand(-160, 160), vy: rand(-220, -60), drag: 2, life: 0.9, rgb: '215,180,255', size: rand(5, 8), rot: 0, seed: rand(0, 9) });
      ultDone(e, 0.6);
      break;
    }
    // 蝶影迷踪：小乔在你四周来回瞬移，每到一处留下一道蝶影，蝶影随后沿直线斩过你所在的位置
    case 'blinkCross': {
      if (U.phase === 0) { U.phase = 1; U.k = 0; U.t = 0; U.base = rand(0, TAU); }
      const n = u.count + (e.enraged ? 2 : 0);
      if (U.phase === 1 && U.t <= 0) {
        const a = U.base + U.k * (Math.PI * 0.5 + rand(-0.3, 0.3)), nx = p.x + Math.cos(a) * u.ring, ny = p.y + Math.sin(a) * u.ring;
        for (let i = 0; i < 8; i++) fxp({ type: 'fly', x: e.x, y: e.y - 20, vx: rand(-150, 150), vy: rand(-180, 40), drag: 2.4, life: 0.7, rgb: '215,180,255', size: rand(5, 8), rot: 0, seed: rand(0, 9) });
        e.x = nx; e.y = ny;
        const la = angleTo(nx, ny, p.x, p.y), sx = nx - Math.cos(la) * 60, sy = ny - Math.sin(la) * 60, len = u.len, w = u.w, dmg = DMG(u.dmg);
        tele({ kind: 'line', x: sx, y: sy, a: la, len, w, life: u.tele, rgb });
        later(u.tele, () => {
          if (segDist(p.x, p.y, sx, sy, la, len) < w / 2 + p.r) hurtPlayer(dmg);
          fxTex('thrust', sx + Math.cos(la) * len / 2, sy + Math.sin(la) * len / 2 - 10, { w: len * 1.05, h: w * 1.6, rot: la, rgb, life: 0.28, sx: 1.1, core: 0.6 });
          for (let i = 0; i < 6; i++) { const t = i / 5; fxp({ type: 'fly', x: sx + Math.cos(la) * len * t, y: sy + Math.sin(la) * len * t - 12, vx: rand(-80, 80), vy: rand(-120, -30), drag: 2, life: 0.7, rgb: '215,180,255', size: rand(5, 7), rot: 0, seed: rand(0, 9) }); }
          sfx('swing');
        });
        glint(nx, ny - 20, 30, '230,200,255', 0.2);
        U.k++; U.t = u.gap;
        if (U.k >= n) U.phase = 2;
      } else if (U.phase === 2 && U.t <= -u.tele) ultDone(e, 0.5);
      break;
    }
    // 铜雀春深：一大圈蝴蝶围住你，一边转一边往里收，只有两处缺口能钻出去；收到最小时整圈炸开
    case 'butterflyRing': {
      S.pools.push({ kind: 'bring', x: p.x, y: p.y, R0: u.R0, R1: u.R1, R: u.R0, born: S.t, arm: 0.7, dur: u.dur, n: u.n, gaps: u.gaps, gapHalf: 0.34, rot: rand(0, TAU), spin: u.spin * (e.enraged ? 1.3 : 1), dmg: DMG(u.dmg) });
      tele({ kind: 'ring', x: p.x, y: p.y, r: u.R0, life: 0.7, rgb });
      say(e, '“这一回，看你往哪儿飞。”');
      ultDone(e, 0.6);
      break;
    }
    // —— 马超 ——
    // 西凉铁骑：你身边铺开几条平行的冲锋道，一条接一条冲过一队铁骑英灵，只有一条是空的
    case 'cavalryLanes': {
      if (U.phase === 0) {
        const a = rand(0, TAU), n = u.lanes, safe = Math.floor(Math.random() * n), cx = p.x, cy = p.y, ux = Math.cos(a), uy = Math.sin(a);
        let k = 0;
        for (let i = 0; i < n; i++) {
          if (i === safe) continue;
          const off = (i - (n - 1) / 2) * u.laneW, lx = cx - uy * off, ly = cy + ux * off, sx = lx - ux * u.span / 2, sy = ly - uy * u.span / 2, wait = u.tele + k * u.gap;
          tele({ kind: 'line', x: sx, y: sy, a, len: u.span, w: u.laneW * 0.9, life: wait, rgb });
          later(wait, () => { for (let r = 0; r < u.riders; r++) S.riders.push({ x: sx - ux * r * 95, y: sy - uy * r * 95 + rand(-12, 12), a, speed: u.speed, left: u.span + u.riders * 95 + 200, hostile: true, dmg: DMG(u.dmg), w: u.laneW * 0.7, hit: false, seed: rand(0, 9) }); sfx('swing'); });
          k++;
        }
        e.mounted = true; U.t = u.tele + k * u.gap + 0.9; U.phase = 1;
        say(e, '“铁骑——冲阵！”');
      } else if (U.t <= 0) ultDone(e, 0.6);
      break;
    }
    // 锦马环骑：马超骑着马绕你跑一圈，身后留下一圈银蓝雷火把你圈住，再从圈外三次冲过圈心
    case 'ringRide': {
      const R = u.ringR;
      if (U.phase === 0) { U.cx = p.x; U.cy = p.y; U.a0 = angleTo(p.x, p.y, e.x, e.y); U.phase = 1; U.t = u.rideT; e.mounted = true; tele({ kind: 'ring', x: U.cx, y: U.cy, r: R, life: u.rideT, rgb }); }
      if (U.phase === 1) {
        const f = clamp(1 - U.t / u.rideT, 0, 1), a = U.a0 + f * TAU;
        e.x = U.cx + Math.cos(a) * R; e.y = U.cy + Math.sin(a) * R;
        fxp({ type: 'spark', x: e.x + rand(-10, 10), y: e.y + rand(-6, 6), vx: rand(-60, 60), vy: rand(-90, -20), drag: 2, life: 0.5, rgb: '190,220,255', size: 2 });
        if (U.t <= 0) { S.pools.push({ kind: 'firering', x: U.cx, y: U.cy, R, band: 38, born: S.t, until: S.t + u.burn, dmg: DMG(0.55), tick: 0 }); U.phase = 2; U.k = 0; U.t = 0.15; sfx('slam'); }
      } else if (U.phase === 2 && U.t <= 0) {
        if (U.k >= u.dashes) { e.mounted = false; ultDone(e, 0.6); break; }
        U.da = angleTo(e.x, e.y, p.x, p.y); U.trav = 0; U.hit = false;
        tele({ kind: 'line', x: e.x, y: e.y, a: U.da, len: R * 2 + 40, w: u.w, life: u.tele, rgb });
        U.phase = 3; U.t = u.tele;
      } else if (U.phase === 3) {
        if (U.t <= 0) U.phase = 4;
      } else if (U.phase === 4) {
        const st = u.dashSpeed * dt; e.x += Math.cos(U.da) * st; e.y += Math.sin(U.da) * st; U.trav += st;
        if (!U.hit && dist2(e.x, e.y, p.x, p.y) < (e.r + p.r + u.w * 0.3) ** 2) { U.hit = true; hurtPlayer(DMG(u.dmg)); p.kvx += Math.cos(U.da) * 600; p.kvy += Math.sin(U.da) * 600; }
        if (Math.random() < 0.8) fxp({ type: 'spark', x: e.x, y: e.y - 10, vx: -Math.cos(U.da) * 200, vy: -Math.sin(U.da) * 200, drag: 3, life: 0.35, rgb: '200,225,255', size: 2.4 });
        if (U.trav >= R * 2 + 40) { U.k++; U.phase = 2; U.t = 0.12; }
      }
      break;
    }
    // 神威天降：马超跃上半空，三杆雷枪接连砸向你的位置，每一杆落地都向八方炸出雷光
    case 'skyLance': {
      e.skyHidden = U.t > -0.6 || U.k < u.count; // 跃上半空（落地前一刻才现身）
      if (U.phase === 0) { U.phase = 1; U.k = 0; U.t = 0.25; }
      if (U.phase === 1 && U.t <= 0 && U.k < u.count) {
        const x = p.x, y = p.y, r = u.lanceR * Math.min(A, 1.3), off = rand(0, TAU);
        tele({ kind: 'circle', x, y, r, life: u.tele, rgb });
        later(u.tele, () => {
          if (dist2(x, y, p.x, p.y) < (r + p.r) ** 2) hurtPlayer(DMG(u.dmg));
          fxTex('pillar', x, y - 220, { w: r * 1.2, h: 480, rgb, life: 0.35, sx: 0.35, core: 0.9 });
          S.effects.push({ kind: 'bolt', pts: zigzag([[x + rand(-40, 40), y - 420], [x, y]], 20), life: 0.3, max: 0.3, rgb: '200,225,255', w: 7 });
          impact(x, y, r, rgb, 1); groundImpact(x, y, r * 1.2);
          S.shake = Math.max(S.shake, 14); punch(0.5); sfx('slam');
          for (let i = 0; i < u.rays; i++) { // 八方雷光：先亮预警线，0.45 秒后劈下
            const a = off + i / u.rays * TAU;
            tele({ kind: 'line', x, y, a, len: u.rayLen, w: u.rayW, life: 0.45, rgb });
            later(0.45, () => {
              if (segDist(p.x, p.y, x, y, a, u.rayLen) < u.rayW / 2 + p.r) hurtPlayer(DMG(u.dmg * 0.6));
              S.effects.push({ kind: 'bolt', pts: zigzag([[x, y - 8], [x + Math.cos(a) * u.rayLen, y - 8 + Math.sin(a) * u.rayLen]], 22), life: 0.22, max: 0.22, rgb: '190,215,255', w: 4 });
            });
          }
        });
        U.lx = x; U.ly = y; U.k++; U.t = u.tele + 0.3;
      }
      if (U.k >= u.count && U.t <= -0.9) { e.x = U.lx; e.y = U.ly + 60; e.skyHidden = false; groundImpact(e.x, e.y, 160); ultDone(e, 0.8); }
      break;
    }
    // —— 郭嘉 ——
    // 十胜十败：你脚下铺开一张棋盘，黑格白格轮流炸开鬼火——每一轮都得挪到另一种颜色的格子上
    case 'chessBoard': {
      S.boards.push({ x: p.x, y: p.y, n: u.n, cell: u.cell, rounds: u.rounds + (e.enraged ? 1 : 0), round: 0, tele: u.tele, gap: u.gap, t: u.tele, state: 'warn', parity: Math.random() < 0.5 ? 0 : 1, dmg: DMG(u.dmg), hostile: true, born: S.t });
      say(e, '“落子无悔。”');
      ultDone(e, 0.6);
      break;
    }
    // 料敌先机：一个接一个的鬼火落点，砸向你「接下来要走到」的地方——别一直往一个方向跑
    case 'predictStrike': {
      if (U.phase === 0) { U.phase = 1; U.k = 0; U.t = 0; }
      if (U.t <= 0 && U.k < u.count + (e.enraged ? 2 : 0)) {
        let dx = (S.pvx || 0) * u.lead, dy = (S.pvy || 0) * u.lead; const L = Math.hypot(dx, dy); if (L > 320) { dx *= 320 / L; dy *= 320 / L; }
        addHazard(p.x + dx, p.y + dy, u.strikeR * Math.min(A, 1.3), u.tele, DMG(u.dmg), rgb, { wisp: true, eye: true });
        U.k++; U.t = u.gap;
      }
      if (U.k >= u.count + (e.enraged ? 2 : 0) && U.t <= 0) ultDone(e, 0.5);
      break;
    }
    // 鬼谋迷雾：四下一片漆黑，只看得见身边一小圈；鬼火从黑暗里飘出来找你
    case 'mistVeil': {
      S.mist = { boss: e, born: S.t, until: S.t + u.dur, sight: u.sight, left: u.wisps, spawnT: 0.4, gap: (u.dur - 1) / u.wisps, dmg: DMG(u.dmg) };
      ultDone(e, 0.5);
      break;
    }
    // —— 张飞 ——
    // 喝断长坂：连跺三脚，每一脚都让地面沿五个方向裂开，地裂从脚下一路撕到远处
    case 'quakeLines': {
      if (U.phase === 0) { U.phase = 1; U.k = 0; U.t = 0.1; }
      if (U.t <= 0 && U.k < u.stomps) {
        const base = angleTo(e.x, e.y, p.x, p.y) + (U.k % 2 ? Math.PI / u.lines : 0), x = e.x, y = e.y;
        for (let i = 0; i < u.lines; i++) {
          const a = base + i / u.lines * TAU;
          tele({ kind: 'line', x, y, a, len: u.len, w: u.w, life: u.tele, rgb });
          later(u.tele, () => S.quakes.push({ x, y, a, len: u.len, w: u.w, d: 0, speed: u.speed, dmg: DMG(u.dmg), hit: false, linger: 0.6, rocks: [] }));
        }
        groundImpact(x, y + e.r * 0.5, 160); S.shake = Math.max(S.shake, 10); punch(0.3); sfx('slam');
        U.k++; U.t = u.gap;
      }
      if (U.k >= u.stomps && U.t <= -0.3) ultDone(e, 0.6);
      break;
    }
    // —— 典韦 ——
    // 力拔千钧：典韦抱起几块巨石砸出去，石头满地乱滚，撞到屏幕边上还会弹回来
    case 'boulders': {
      if (U.phase === 0) { U.phase = 1; U.k = 0; U.t = 0.15; }
      if (U.t <= 0 && U.k < u.count) {
        const a = angleTo(e.x, e.y, p.x, p.y) + (U.k - (u.count - 1) / 2) * 0.38, x = e.x, y = e.y, r = u.rockR * Math.min(A, 1.25);
        tele({ kind: 'line', x, y, a, len: 900, w: r * 2, life: u.tele, rgb });
        later(u.tele, () => { S.boulders.push({ x, y, vx: Math.cos(a) * u.speed, vy: Math.sin(a) * u.speed, r, bounces: u.bounces, life: 5, dmg: DMG(u.dmg), hitT: 0, rot: 0 }); groundImpact(x, y, 90); sfx('slam'); });
        U.k++; U.t = u.gap;
      }
      if (U.k >= u.count && U.t <= -u.tele) ultDone(e, 0.6);
      break;
    }
    // —— 赵云 ——
    // 白龙盘枪：一条白龙绕着你盘成一圈、越收越紧（龙身上留着一道缺口），最后龙头掉转，一头扎穿圈心
    case 'dragonCoil': {
      S.coils.push({ x: p.x, y: p.y, R0: u.coilR0, R1: u.coilR1, t: 0, T: u.coilT, body: u.body, a0: rand(0, TAU), dive: u.dive, diveW: u.diveW, dmg: DMG(u.dmg), state: 'coil', hitT: 0 });
      ultDone(e, 0.6);
      break;
    }
    // —— 夏侯惇 ——
    // 刚烈：横刀格挡两秒（受伤减半，每挨一下记一层怒）；架势一收，按怒的层数朝四面八方劈出血色刀光——挨得越多刀光越多
    case 'counterStance': {
      if (U.phase === 0) {
        e.stance = { hits: 0, born: S.t }; U.phase = 1; U.t = u.dur;
        fxTex('circle', 0, 0, { follow: e, oy: e.r * 0.5, w: u.ring * 2, h: u.ring * 2, rgb, under: true, flat: 0.55, life: u.dur, spin: 1.2, fadeIn: 0.1, a: 0.6 });
        say(e, '“来啊！”');
      } else if (U.phase === 1) {
        if (U.t <= 0) {
          const n = clamp(Math.round(u.minBlades + e.stance.hits * u.perHit), u.minBlades, u.maxBlades + (e.enraged ? 2 : 0)), a0 = toP, x = e.x, y = e.y; // 第一刀正对着你，得挪一步
          e.stance = null;
          for (let i = 0; i < n; i++) {
            const a = a0 + i / n * TAU;
            tele({ kind: 'line', x, y, a, len: u.len, w: u.w, life: 0.45, rgb });
            later(0.45, () => {
              if (segDist(p.x, p.y, x, y, a, u.len) < u.w / 2 + p.r) hurtPlayer(DMG(u.dmg), null, e);
              fxTex('thrust', x + Math.cos(a) * u.len / 2, y - 14 + Math.sin(a) * u.len / 2, { w: u.len * 1.1, h: u.w * 1.5, rot: a, rgb: '255,60,45', life: 0.3, sx: 1.2, core: 0.8 });
            });
          }
          later(0.45, () => { impact(x, y, 120, rgb, 1); S.shake = Math.max(S.shake, 12); sfx('slam'); });
          addNumber(e.x, e.y - e.r * 3.2, `刚烈 · ${n} 刀`, '#ff8a7a', 22);
          U.phase = 2; U.t = 0.8;
        }
      } else if (U.t <= 0) ultDone(e, 0.4);
      break;
    }
    // 虎将单挑：以你为中心立起一圈枪阵，把你们俩关在里面（你出不去、小兵进不来），他贴身连出几段大刀，每段前有扇形预警
    case 'duelArena': {
      if (U.phase === 0) {
        S.arena = { x: p.x, y: p.y, R: u.arenaR, born: S.t, until: Infinity, boss: e, wall: DMG(u.wall), hitT: 0 };
        const a = angleTo(p.x, p.y, e.x, e.y), d = Math.min(u.arenaR - 70, Math.sqrt(dist2(p.x, p.y, e.x, e.y)));
        e.x = p.x + Math.cos(a) * d; e.y = p.y + Math.sin(a) * d; // 他也进了阵
        groundImpact(e.x, e.y + e.r * 0.5, 120); S.shake = Math.max(S.shake, 10); sfx('slam');
        banner('虎将单挑', '枪阵之内，只有你和夏侯惇');
        U.phase = 1; U.k = 0; U.t = 0.8;
      } else if (U.phase === 1 && U.t <= 0) {
        if (U.k >= u.combos + (e.enraged ? 1 : 0)) { if (S.arena) S.arena.until = S.t + 0.35; ultDone(e, 0.6); break; }
        const A2 = S.arena || { x: p.x, y: p.y, R: u.arenaR }, a = angleTo(p.x, p.y, e.x, e.y);
        let nx = p.x + Math.cos(a) * 110, ny = p.y + Math.sin(a) * 110; // 冲到你身边
        const dd = Math.hypot(nx - A2.x, ny - A2.y); if (dd > A2.R - 40) { nx = A2.x + (nx - A2.x) * (A2.R - 40) / dd; ny = A2.y + (ny - A2.y) * (A2.R - 40) / dd; }
        for (let k = 0; k < 6; k++) fxp({ type: 'dust', x: e.x + (nx - e.x) * k / 6, y: e.y + (ny - e.y) * k / 6 + 10, vx: 0, vy: -20, drag: 3, grow: 22, life: 0.4, rgb: '120,100,80', size: rand(8, 12) });
        e.x = nx; e.y = ny;
        U.ang = angleTo(e.x, e.y, p.x, p.y);
        tele({ kind: 'wedge', x: e.x, y: e.y, a: U.ang, R: u.cleaveR, half: u.half, life: u.tele, rgb });
        U.phase = 2; U.t = u.tele;
      } else if (U.phase === 2) {
        e.ang = U.ang;
        if (U.t <= 0) {
          if (inWedge(p.x, p.y, e.x, e.y, U.ang, u.cleaveR, u.half, p.r)) hurtPlayer(DMG(u.dmg), null, e);
          fxTex('slash', e.x + Math.cos(U.ang) * u.cleaveR * 0.45, e.y - 20 + Math.sin(U.ang) * u.cleaveR * 0.45, { w: u.cleaveR * 1.3, h: u.cleaveR * 0.8, rot: U.ang + Math.PI / 2, rgb, life: 0.3, grow: 1.2, core: 0.7 });
          punch(0.5); S.shake = Math.max(S.shake, 9); sfx('slam');
          U.k++; U.phase = 1; U.t = u.gap;
        }
      }
      break;
    }
    // 拔矢啖睛：画面一暗，一支冷箭从远处射中他的左眼；他踉跄、拔矢吞睛，进入血怒（更快、受伤减半、打中你就回血），再把那支箭朝你掷回来
    case 'eyeArrow': {
      if (U.phase === 0) {
        const a = rand(-Math.PI * 0.9, -Math.PI * 0.1), hx = e.x, hy = e.y - e.r * 2.2;
        S.flyArrows.push({ x0: hx + Math.cos(a) * 760, y0: hy + Math.sin(a) * 520, x1: hx, y1: hy, t: 0, T: 0.35 });
        S.dimT = S.t + 1.4; U.phase = 1; U.t = 0.35;
      } else if (U.phase === 1 && U.t <= 0) { // 中箭
        const hy = e.y - e.r * 2.2;
        sparks(e.x, hy, -Math.PI / 2, 18, '230,40,30', 420, Math.PI, 2.6);
        for (let i = 0; i < 10; i++) fxp({ type: 'ember', x: e.x, y: hy, vx: rand(-120, 120), vy: rand(-160, 40), g: 400, drag: 1, life: 0.7, rgb: '200,20,20', size: rand(5, 8) });
        addNumber(e.x, hy - 30, '中箭！', '#ff6a5a', 24);
        e.flash = 0.3; hitstop(0.12); S.shake = Math.max(S.shake, 14); sfx('hurt');
        U.phase = 2; U.t = 1.0;
      } else if (U.phase === 2 && U.t <= 0) { // 拔矢啖睛，血怒
        e.frenzyT = S.t + u.rage; e.leechT = S.t + u.rage; e.leech = u.leech;
        fxTex('pillar', 0, 0, { follow: e, oy: -e.r * 3, w: e.r * 4, h: e.r * 9, rgb: '255,40,30', life: 1.0, sx: 0.5, core: 0.6 });
        fxTex('circle', 0, 0, { follow: e, oy: e.r * 0.5, w: e.r * 7, h: e.r * 7, rgb: '230,30,20', under: true, flat: 0.55, life: 1.6, spin: -2.5 });
        screenFlash('200,20,10', 0.3); punch(0.8); embers(e.x, e.y - 30, 30, '255,60,40', 200, 80, 9, 1);
        U.ang = toP; tele({ kind: 'line', x: e.x, y: e.y, a: U.ang, len: u.arrowLen, w: u.arrowW, life: u.tele, rgb });
        U.phase = 3; U.t = u.tele;
      } else if (U.phase === 3 && U.t <= 0) { // 把箭掷回来
        if (segDist(p.x, p.y, e.x, e.y, U.ang, u.arrowLen) < u.arrowW / 2 + p.r) hurtPlayer(DMG(u.dmg), null, e);
        S.flyArrows.push({ x0: e.x, y0: e.y - 20, x1: e.x + Math.cos(U.ang) * u.arrowLen, y1: e.y - 20 + Math.sin(U.ang) * u.arrowLen, t: 0, T: 0.22, big: true });
        sfx('swing'); ultDone(e, 0.3);
      }
      break;
    }
    // —— 司马懿 ——
    // 死士三千：你脚下和身边一圈先裂开孤坟，紧接着外面再裂一圈；鬼火从坟里喷出来，几座坟里爬出死士
    case 'deadRise': {
      const r = u.eruptR * Math.min(A, 1.3), a0 = rand(0, TAU), inner = 6, outer = 8 + (e.enraged ? 2 : 0);
      S.graves.push({ x: p.x, y: p.y, r, t: u.tele, max: u.tele, dmg: DMG(u.dmg), raise: 0, hostile: true });
      for (let i = 0; i < inner; i++) { const a = a0 + i / inner * TAU; S.graves.push({ x: p.x + Math.cos(a) * 150, y: p.y + Math.sin(a) * 130, r, t: u.tele, max: u.tele, dmg: DMG(u.dmg), raise: i % 2, hostile: true }); }
      for (let i = 0; i < outer; i++) { const a = a0 + (i + 0.5) / outer * TAU, t = u.tele + 0.6; S.graves.push({ x: p.x + Math.cos(a) * u.ring * 1.25, y: p.y + Math.sin(a) * u.ring * 1.1, r, t, max: t, dmg: DMG(u.dmg), raise: i % 3 === 0 ? 1 : 0, hostile: true }); }
      say(e, '“起来吧，我的死士。”');
      ultDone(e, 0.8);
      break;
    }
    // 鹰视狼顾：头顶睁开一双狼眼，身前身后两道目光一起绕着他转——贴到他脚下（灯下黑）或者跟着目光的缝一起跑
    case 'wolfGaze': {
      if (U.phase === 0) {
        U.phase = 1; U.t = 0;
        S.gazes.push({ boss: e, a0: toP, a: toP, dir: Math.random() < 0.5 ? 1 : -1, R: u.R, blind: u.blind, half: u.half, t: 0, tele: u.tele, dur: u.dur, turns: u.turns * (e.enraged ? 1.2 : 1), dmg: DMG(u.dmg), hitT: 0 });
      } else if (U.t <= -(u.tele + u.dur)) ultDone(e, 0.6);
      break;
    }
    // 冢虎疑冢：司马懿倒地化作一缕黑烟，你身边立起一圈疑冢，他藏在其中一座里。打破真冢就把他逼出来（破甲、僵直）；
    // 打破假冢会放出死士；拖到时间到，他从真冢里破土而出，炸开一大圈幽冥鬼火
    case 'feignDeath': {
      if (U.phase === 0) {
        const n = u.tombs, real = Math.floor(Math.random() * n), a0 = rand(0, TAU);
        soulBurst(e.x, e.y, 150); smoke(e.x, e.y - 20, 10, '24,10,36', 18, 26, 1.2);
        U.tombs = [];
        for (let i = 0; i < n; i++) {
          const a = a0 + i / n * TAU, x = p.x + Math.cos(a) * u.ring, y = p.y + Math.sin(a) * u.ring * 0.8;
          const t = spawnBuilding('yizhong', x, y); t.tomb = { boss: e, real: i === real }; t.risen = S.t;
          U.tombs.push(t);
          later(0.1 + i * 0.08, () => { groundImpact(x, y + 10, 70); soulBurst(x, y, 70, 0.7); sfx('slam'); });
        }
        e.vanish = true; e.x = p.x; e.y = p.y - 9000; // 藏进疑冢：挪到谁也瞄不到的地方
        U.phase = 1; U.t = u.dur;
        banner('冢虎 · 诈死', '五座疑冢，只有一座是真的');
        S.shake = Math.max(S.shake, 10);
      } else {
        const real = U.tombs.find(t => t.tomb.real);
        if (real.dead) { // 识破：从真冢里被逼出来，护甲碎裂、僵直
          for (const t of U.tombs) if (!t.dead) { t.dead = true; smoke(t.x, t.y - 20, 4, '30,14,44', 12, 14, 0.7); }
          e.vanish = false; e.x = real.x; e.y = real.y + 16;
          ultDone(e, 0);
          if (e.shield > 0) breakShield(e); else { e.vulnT = S.t + D.champion.breakVulnTime; addNumber(e.x, e.y - 90, '破绽！', '#d8b8ff', 22); }
          e.state = 'recover'; e.stateT = 2.4;
          addNumber(e.x, e.y - 120, '识破真冢！', '#e8d0ff', 26);
          soulBurst(e.x, e.y, 120); screenFlash('170,90,230', 0.25); punch(0.5);
        } else if (U.t <= 0) { // 冢虎出柙：从真冢里破土而出，一大圈鬼火炸开，假冢里的死士一起爬出来
          const R = u.novaR * Math.min(A, 1.2), x = real.x, y = real.y;
          real.dead = true;
          for (const t of U.tombs) if (!t.dead) { t.dead = true; tombBroken(t, true); }
          e.vanish = false; e.x = x; e.y = y + 16;
          tele({ kind: 'circle', x, y, r: R, life: 0.9, rgb });
          later(0.9, () => {
            if (dist2(x, y, p.x, p.y) < (R + p.r) ** 2) hurtPlayer(DMG(u.dmg), 'dark', e);
            soulBurst(x, y, R); impact(x, y, R * 0.6, rgb, 1.2); groundImpact(x, y, R);
            screenFlash('120,50,180', 0.35); S.shake = Math.max(S.shake, 16); sfx('slam');
          });
          say(e, '“冢虎出柙！”');
          ultDone(e, 1.2);
        }
      }
      break;
    }
    default: ultDone(e);
  }
}

// ============ 董卓、大乔、小乔的招式物件 ============
// 铁链：从董卓（或地上的锚点 ax, ay）沿 a 方向甩出；链头碰到你就钩住（S.hook），把你拖到他身前
function throwChain(e, a, o) {
  const c = Object.assign({ boss: e, a, d: 0, state: 'out', delay: 0 }, o);
  S.chains.push(c);
  return c;
}
const chainFrom = c => c.ax !== undefined ? [c.ax, c.ay] : [c.boss.x, c.boss.y - c.boss.r * 0.7];
const canBind = () => S.player.iframes <= 0 && S.t >= S.rampageT && !S.over;
function updateBossFx(dt) {
  const p = S.player;
  for (const c of S.chains) {
    if (c.delay > 0) { c.delay -= dt; continue; }
    if (c.boss.dead && c.state !== 'back') c.state = 'back';
    const [ox, oy] = chainFrom(c);
    if (c.state === 'out') {
      c.d += c.speed * dt;
      const hx = ox + Math.cos(c.a) * c.d, hy = oy + Math.sin(c.a) * c.d;
      if (Math.random() < 0.4) fxp({ type: 'smoke', x: hx, y: hy, vx: 0, vy: -20, drag: 3, grow: 14, life: 0.35, rgb: '12,8,12', size: rand(5, 8) });
      if (!S.hook && canBind() && dist2(hx, hy, p.x, p.y - 12) < (c.w / 2 + p.r + 6) ** 2) {
        hurtPlayer(c.dmg);
        S.hook = { boss: c.boss, pull: c.pull, crush: c.crush, chain: c };
        c.state = 'latched';
        addNumber(p.x, p.y - 44, '被铁链钩住 · 闪现挣脱', '#ff9ab0', 17);
        sparks(hx, hy, c.a + Math.PI, 10, '220,60,90', 340, 0.8, 2.2);
        S.shake = Math.max(S.shake, 8);
      } else if (c.d >= c.len) c.state = 'back';
    } else if (c.state === 'latched' || c.state === 'bind') { // 钩住 / 捆住：链头跟着你走，直到挣脱或被拖到跟前
      if (!S.hook || S.hook.boss !== c.boss || (c.state === 'latched' && S.hook.chain !== c)) c.state = 'back';
      else { const tx = p.x, ty = p.y - 14; c.d = Math.hypot(tx - ox, ty - oy); c.a = Math.atan2(ty - oy, tx - ox); }
    } else { c.d -= (c.speed || 1400) * 1.3 * dt; if (c.d <= 0) c.dead = true; }
  }
  S.chains = S.chains.filter(c => !c.dead);
  // 魔王暴政：绕着董卓转的铁锤
  for (const f of S.flails) {
    if (f.boss.dead || S.t > f.until) { f.dead = true; continue; }
    f.a += f.spin * dt;
    const bx = f.boss.x + Math.cos(f.a) * f.R, by = f.boss.y + Math.sin(f.a) * f.R * 0.8;
    f.x = bx; f.y = by;
    if (Math.random() < 0.6) fxp({ type: 'smoke', x: bx + rand(-8, 8), y: by - 10 + rand(-8, 8), vx: 0, vy: -15, drag: 3, grow: 16, life: 0.5, rgb: '10,6,10', size: rand(8, 12) });
    if (dist2(bx, by, p.x, p.y) < (f.r + p.r) ** 2) { hurtPlayer(f.dmg); p.kvx += Math.cos(f.a + Math.PI / 2) * 420; p.kvy += Math.sin(f.a + Math.PI / 2) * 420; }
  }
  S.flails = S.flails.filter(f => !f.dead);
  // 莲灯：慢慢飘向你，靠近了点燃引信，片刻后炸开一团水光
  for (const L of S.lanterns) {
    L.life -= dt;
    if (L.fuse > 0) {
      L.fuse -= dt;
      if (L.fuse <= 0) {
        if (dist2(L.x, L.y, p.x, p.y) < (L.blast + p.r) ** 2) hurtPlayer(L.dmg);
        waterSplash(L.x, L.y, L.blast);
        L.dead = true;
      }
      continue;
    }
    const a = angleTo(L.x, L.y, p.x, p.y), k = Math.min(1, 1.1 * dt);
    L.vx += (Math.cos(a) * L.speed - L.vx) * k; L.vy += (Math.sin(a) * L.speed - L.vy) * k;
    L.x += L.vx * dt; L.y += L.vy * dt;
    if (L.life <= 0 || dist2(L.x, L.y, p.x, p.y) < (L.blast * 0.55) ** 2) { L.fuse = L.fuseMax = 0.6; L.vx = L.vy = 0; }
  }
  S.lanterns = S.lanterns.filter(L => !L.dead);
  // 春江潮涌：一道水墙横扫过来，只有一处缺口能钻过去；被冲到就受伤并被推着走
  for (const w of S.tides) {
    if (w.wait > 0) { w.wait -= dt; continue; }
    w.travel += w.speed * dt;
    const ux = Math.cos(w.dir), uy = Math.sin(w.dir), cx = w.x0 + ux * w.travel, cy = w.y0 + uy * w.travel;
    const rx = p.x - cx, ry = p.y - cy, along = rx * ux + ry * uy, lat = -rx * uy + ry * ux;
    if (!w.hit && Math.abs(along) < w.depth / 2 + p.r && Math.abs(lat) < w.span / 2 && Math.abs(lat - w.gap) > w.gapW / 2) {
      w.hit = true; hurtPlayer(w.dmg);
      p.kvx += ux * w.push; p.kvy += uy * w.push;
    }
    if (Math.random() < 0.9) { const l = rand(-0.5, 0.5) * w.span; if (Math.abs(l - w.gap) > w.gapW / 2) fxp({ type: 'spark', x: cx - uy * l, y: cy + ux * l - 10, vx: ux * w.speed * 0.8 + rand(-40, 40), vy: uy * w.speed * 0.8 - rand(40, 120), drag: 2, g: 300, life: 0.5, rgb: '210,250,245', size: 2 }); }
    if (w.travel >= w.maxT) w.dead = true;
  }
  S.tides = S.tides.filter(w => !w.dead);
  // 江心漩涡（把你往中心卷，中心伤人）、铜雀春深（一圈蝴蝶往里收，只有缺口能钻出去）
  for (const o of S.pools) {
    const d = Math.sqrt(dist2(p.x, p.y, o.x, o.y)), age = S.t - o.born;
    if (o.kind === 'whirl') {
      o.rot += dt * 2.6;
      if (S.t > o.until) { o.dead = true; waterSplash(o.x, o.y, o.coreR * 1.6); continue; }
      const R = o.R * Math.min(1, age / 0.5);
      if (d < R && d > 4 && !S.hook) { const a = angleTo(p.x, p.y, o.x, o.y), sp = o.pull * (0.55 + 0.45 * (1 - d / R)); p.x += Math.cos(a) * sp * dt; p.y += Math.sin(a) * sp * dt; }
      o.tick -= dt;
      if (o.tick <= 0 && d < o.coreR + p.r) { o.tick = 0.45; hurtPlayer(o.dmg); }
      if (Math.random() < 0.7) { const a = rand(0, TAU), r = R * rand(0.3, 1); fxp({ type: 'spark', x: o.x + Math.cos(a) * r, y: o.y + Math.sin(a) * r * 0.7, vx: -Math.sin(a) * 160, vy: Math.cos(a) * 110, drag: 2, life: 0.5, rgb: '170,240,235', size: 1.6 }); }
    } else if (o.kind === 'bring') { // 蝶环
      const t = Math.max(0, age - o.arm), f = Math.min(1, t / o.dur), R = o.R0 + (o.R1 - o.R0) * f * f * (3 - 2 * f);
      o.R = R; o.rot += o.spin * dt;
      if (age > o.arm && Math.abs(d - R) < 16 + p.r) {
        const pa = Math.atan2(p.y - o.y, p.x - o.x);
        let inGap = false;
        for (let k = 0; k < o.gaps; k++) if (Math.abs(angDiff(o.rot + k * TAU / o.gaps, pa)) < o.gapHalf) inGap = true;
        if (!inGap) hurtPlayer(o.dmg);
      }
      if (f >= 1) { // 收拢到最小：一圈蝴蝶炸开
        if (d < o.R1 + 30 + p.r) hurtPlayer(o.dmg * 1.5);
        fxTex('burst', o.x, o.y - 10, { w: o.R1 * 3, h: o.R1 * 3, rgb: '210,160,255', life: 0.4, grow: 1.5, rot: rand(0, TAU) });
        for (let i = 0; i < 16; i++) fxp({ type: 'fly', x: o.x, y: o.y - 10, vx: rand(-260, 260), vy: rand(-260, 120), drag: 2, life: 1, rgb: '210,170,255', size: rand(6, 9), rot: rand(-0.5, 0.5), seed: rand(0, 9) });
        o.dead = true;
      }
    }
  }
  S.pools = S.pools.filter(o => !o.dead);
  // 纸鸢索影：纸鸢的影子追着你，停住片刻后俯冲炸下
  for (const k of S.kites) {
    k.age += dt;
    if (k.state === 'follow') {
      const a = angleTo(k.x, k.y, p.x, p.y), d = Math.sqrt(dist2(k.x, k.y, p.x, p.y));
      const sp = Math.min(d / dt, k.speed); k.x += Math.cos(a) * sp * dt; k.y += Math.sin(a) * sp * dt;
      if (k.age >= k.follow) { k.state = 'lock'; k.lockT = k.lock; }
    } else if (k.state === 'lock') {
      k.lockT -= dt;
      if (k.lockT <= 0) {
        if (dist2(k.x, k.y, p.x, p.y) < (k.r + p.r) ** 2) hurtPlayer(k.dmg);
        fxTex('ring', k.x, k.y, { w: k.r * 1.6, h: k.r * 1.6, rgb: '200,150,255', under: true, flat: 0.6, life: 0.4, grow: 1.8, core: 0.3 });
        fxTex('burst', k.x, k.y - k.r * 0.3, { w: k.r * 2.4, h: k.r * 2.4, rgb: '210,160,255', life: 0.32, grow: 1.4, rot: rand(0, TAU) });
        for (let i = 0; i < 8; i++) fxp({ type: 'fly', x: k.x, y: k.y - 12, vx: rand(-200, 200), vy: rand(-220, 40), drag: 2.4, life: 0.8, rgb: '215,180,255', size: rand(5, 8), rot: rand(-0.5, 0.5), seed: rand(0, 9) });
        S.shake = Math.max(S.shake, 8); sfx('slam');
        k.dead = true;
      }
    }
  }
  S.kites = S.kites.filter(k => !k.dead);
  // 蝶影分身（小乔的技能）：引开小兵，到时炸成漫天彩蝶
  for (const o of S.decoys) {
    if (Math.random() < 0.25) fxp({ type: 'fly', x: o.x + rand(-16, 16), y: o.y - rand(10, 40), vx: rand(-30, 30), vy: rand(-50, -20), drag: 1, life: 0.8, rgb: '215,180,255', size: rand(4, 6), rot: 0, seed: rand(0, 9) });
    if (S.t < o.until) continue;
    hitCircle(o.x, o.y, o.radius, o.dmg, 120, 0.6);
    fxTex('burst', o.x, o.y - 14, { w: o.radius * 2, h: o.radius * 2, rgb: '210,170,255', life: 0.35, grow: 1.4, rot: rand(0, TAU) });
    for (let i = 0; i < 18; i++) fxp({ type: 'fly', x: o.x, y: o.y - 14, vx: rand(-300, 300), vy: rand(-300, 150), drag: 2, life: 1, rgb: '215,180,255', size: rand(5, 9), rot: rand(-0.5, 0.5), seed: rand(0, 9) });
    sfx('slam');
    o.dead = true;
  }
  S.decoys = S.decoys.filter(o => !o.dead);
  updateBossFx2(dt);
  updateSimayi(dt);
  updateXiahou(dt);
}
// 夏侯惇：单挑枪阵（你出不去，碰到枪会被扎回来；小兵进不来）、飞箭、血眼
function updateXiahou(dt) {
  const p = S.player, A = S.arena;
  if (A) {
    if (S.t > A.until || A.boss.dead) { // 枪阵收起：长枪倒下，扬起尘土
      for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; fxp({ type: 'dust', x: A.x + Math.cos(a) * A.R, y: A.y + Math.sin(a) * A.R, vx: Math.cos(a) * 60, vy: Math.sin(a) * 40, drag: 3, grow: 20, life: 0.5, rgb: '120,100,80', size: rand(8, 12) }); }
      S.arena = null;
    } else {
      const d = Math.hypot(p.x - A.x, p.y - A.y), lim = A.R - p.r;
      if (d > lim) { // 撞到枪阵：拉回圈里，扎一下
        const a = Math.atan2(p.y - A.y, p.x - A.x);
        p.x = A.x + Math.cos(a) * lim; p.y = A.y + Math.sin(a) * lim;
        p.kvx = -Math.cos(a) * 320; p.kvy = -Math.sin(a) * 320;
        if (S.t > A.hitT) { A.hitT = S.t + 0.6; hurtPlayer(A.wall, null, A.boss); sparks(p.x, p.y - 10, a + Math.PI, 8, '255,200,160', 320, 0.8, 2); }
      }
      for (const e of S.enemies) { // 小兵进不来
        if (e.dead || e.boss || e.building) continue;
        const de = Math.hypot(e.x - A.x, e.y - A.y);
        if (de < A.R + e.r) { const a = Math.atan2(e.y - A.y, e.x - A.x); e.x = A.x + Math.cos(a) * (A.R + e.r); e.y = A.y + Math.sin(a) * (A.R + e.r); }
      }
    }
  }
  for (const f of S.flyArrows) { f.t += dt; if (f.t > f.T + 0.25) f.dead = true; }
  S.flyArrows = S.flyArrows.filter(f => !f.dead);
  for (const o of S.bloodEyes) { o.t += dt; if (o.t > o.T) o.dead = true; }
  S.bloodEyes = S.bloodEyes.filter(o => !o.dead);
}
function drawXiahouUnder() {
  const A = S.arena; if (!A) return;
  const k = Math.min(1, (S.t - A.born) / 0.3), out = A.until !== Infinity ? Math.max(0, (A.until - S.t) / 0.35) : 1, a = k * out;
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(120,20,15,0.12)'; ctx.beginPath(); ctx.ellipse(A.x, A.y, A.R, A.R, 0, 0, TAU); ctx.fill(); // 阵里的地面泛红
  ctx.strokeStyle = 'rgba(230,60,40,0.7)'; ctx.lineWidth = 3; ctx.setLineDash([14, 10]); ctx.beginPath(); ctx.arc(A.x, A.y, A.R, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
}
// 一只血红的独眼（神兵「血眼战刀」）
function drawBloodEye(x, y, s, alpha) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  FX.glow(ctx, x, y, s * 3, '230,40,30', 0.5 * alpha);
  ctx.fillStyle = `rgba(255,70,50,${0.9 * alpha})`; ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.38, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = `rgba(255,235,220,${alpha})`; ctx.beginPath(); ctx.ellipse(x, y, s * 0.14, s * 0.34, 0, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawXiahouOver() {
  const A = S.arena;
  if (A) { // 枪阵：一圈插在地上的长枪，枪尖朝外，枪缨飘红
    const k = Math.min(1, (S.t - A.born) / 0.3), out = A.until !== Infinity ? Math.max(0, (A.until - S.t) / 0.35) : 1, n = Math.round(A.R / 14);
    ctx.save(); ctx.globalAlpha = k * out; ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU, x = A.x + Math.cos(a) * A.R, y = A.y + Math.sin(a) * A.R, h = 46 * k, lean = Math.cos(a) * 8;
      ctx.strokeStyle = '#5a4030'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + lean, y - h); ctx.stroke();
      ctx.fillStyle = '#d8dce2'; ctx.beginPath(); ctx.moveTo(x + lean - 4, y - h); ctx.lineTo(x + lean, y - h - 14); ctx.lineTo(x + lean + 4, y - h); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c0302a'; ctx.beginPath(); ctx.arc(x + lean, y - h + 3, 3.2, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  for (const e of S.bossList) { // 刚烈：横刀格挡时罩一层血红的护体，头顶记着挨了几下
    if (!e.stance) continue;
    const pulse = 0.5 + 0.5 * Math.sin(S.t * 12);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; FX.glow(ctx, e.x, e.y - e.r * 1.2, e.r * 3, '255,50,40', 0.35 + 0.15 * pulse); ctx.restore();
    ctx.strokeStyle = `rgba(255,120,100,${0.6 + 0.3 * pulse})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(e.x, e.y - e.r * 1.1, e.r * 1.5, e.r * 1.9, 0, 0, TAU); ctx.stroke();
    ctx.font = `900 18px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#1a0c0a';
    const txt = `怒 ${e.stance.hits}`; ctx.strokeText(txt, e.x, e.y - e.r * 3.4); ctx.fillStyle = '#ff9a8a'; ctx.fillText(txt, e.x, e.y - e.r * 3.4);
  }
  for (const f of S.flyArrows) { // 飞箭：一支长箭，后面拖一道残影
    const k = Math.min(1, f.t / f.T), x = f.x0 + (f.x1 - f.x0) * k, y = f.y0 + (f.y1 - f.y0) * k, a = Math.atan2(f.y1 - f.y0, f.x1 - f.x0), L = f.big ? 70 : 46;
    ctx.save(); ctx.globalAlpha = f.t > f.T ? Math.max(0, 1 - (f.t - f.T) / 0.25) : 1;
    ctx.strokeStyle = 'rgba(255,90,70,0.45)'; ctx.lineWidth = f.big ? 10 : 5; ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * L * 2.2, y - Math.sin(a) * L * 2.2); ctx.lineTo(x, y); ctx.stroke();
    ctx.translate(x, y); ctx.rotate(a);
    ctx.strokeStyle = '#3a2a1e'; ctx.lineWidth = f.big ? 4 : 2.5; ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(0, 0); ctx.stroke();
    ctx.fillStyle = '#d8dce2'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-4, -5); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c0302a'; ctx.fillRect(-L, -4, 10, 8);
    ctx.restore();
  }
  for (const o of S.bloodEyes) { const a = Math.min(1, o.t / 0.15, (o.T - o.t) / 0.2); drawBloodEye(o.x, o.y, o.s * (0.6 + 0.4 * Math.min(1, o.t / 0.3)), a); }
}
// 马超的铁骑、郭嘉的棋盘和迷雾、张飞的地裂、典韦的巨石、赵云的白龙、遗计锦囊（敌我都用得上的几样带 hostile 标记）
function updateBossFx2(dt) {
  const p = S.player;
  // 玩家的移动速度（郭嘉「料敌先机」用来预判）
  if (S.plx !== undefined && dt > 0) { const vx = (p.x - S.plx) / dt, vy = (p.y - S.ply) / dt; S.pvx = (S.pvx || 0) * 0.85 + vx * 0.15; S.pvy = (S.pvy || 0) * 0.85 + vy * 0.15; }
  S.plx = p.x; S.ply = p.y;
  // 铁骑英灵：沿直线冲过去；敌方的撞你，我方的撞敌人
  for (const r of S.riders) {
    const st = r.speed * dt, ux = Math.cos(r.a), uy = Math.sin(r.a);
    r.x += ux * st; r.y += uy * st; r.left -= st;
    if (r.hostile) {
      if (!r.hit && dist2(r.x, r.y, p.x, p.y) < (r.w / 2 + p.r) ** 2) { r.hit = true; hurtPlayer(r.dmg); p.kvx += ux * 700; p.kvy += uy * 700; }
    } else {
      near(r.x, r.y, r.w + 48, e => { if (r.hitSet.has(e.id) || dist2(r.x, r.y, e.x, e.y) > (r.w / 2 + e.r) ** 2) return; r.hitSet.add(e.id); hitEnemy(e, r.dmg, { kb: 320, kbAngle: r.a, quiet: true }); });
    }
    if (Math.random() < 0.7) fxp({ type: 'dust', x: r.x + rand(-10, 10), y: r.y + 10, vx: -ux * 120, vy: -uy * 120, drag: 3, grow: 24, life: 0.45, rgb: '120,110,96', size: rand(8, 12) });
    if (Math.random() < 0.5) fxp({ type: 'spark', x: r.x + rand(-14, 14), y: r.y - rand(10, 40), vx: -ux * 260, vy: -uy * 260, drag: 3, life: 0.3, rgb: '190,215,255', size: 2 });
    if (r.left <= 0) r.dead = true;
  }
  S.riders = S.riders.filter(r => !r.dead);
  // 雷火圈（锦马环骑）：圈住你，碰到圈就挨烧
  for (const o of S.pools) {
    if (o.kind !== 'firering') continue;
    if (S.t > o.until) { o.dead = true; continue; }
    const d = Math.sqrt(dist2(p.x, p.y, o.x, o.y));
    o.tick -= dt;
    if (o.tick <= 0 && Math.abs(d - o.R) < o.band / 2 + p.r) { o.tick = 0.4; hurtPlayer(o.dmg); }
    if (Math.random() < 0.9) { const a = rand(0, TAU); fxp({ type: 'ember', x: o.x + Math.cos(a) * o.R, y: o.y + Math.sin(a) * o.R, vx: 0, vy: rand(-80, -30), drag: 1, life: 0.5, rgb: Math.random() < 0.5 ? '160,200,255' : '230,240,255', size: rand(6, 11) }); }
  }
  S.pools = S.pools.filter(o => !o.dead);
  // 棋盘：一种颜色的格子先亮预警，再炸开鬼火；下一轮换另一种颜色
  for (const b of S.boards) {
    b.t -= dt;
    if (b.t > 0) continue;
    if (b.state === 'warn') {
      const half = b.n * b.cell / 2, x0 = b.x - half, y0 = b.y - half;
      const cellOf = (x, y) => { const i = Math.floor((x - x0) / b.cell), j = Math.floor((y - y0) / b.cell); return i >= 0 && j >= 0 && i < b.n && j < b.n && (i + j) % 2 === b.parity; };
      if (b.hostile) { if (cellOf(p.x, p.y)) hurtPlayer(b.dmg); }
      else near(b.x, b.y, half * 1.5, e => { if (!e.building && cellOf(e.x, e.y)) hitEnemy(e, b.dmg, { kb: 60, quiet: true }); });
      for (let i = 0; i < b.n; i++) for (let j = 0; j < b.n; j++) if ((i + j) % 2 === b.parity) {
        const cx = x0 + (i + 0.5) * b.cell, cy = y0 + (j + 0.5) * b.cell;
        fxTex('burst', cx, cy - b.cell * 0.2, { w: b.cell * 1.3, h: b.cell * 1.3, rgb: '110,240,200', life: 0.3, grow: 1.3, rot: rand(0, TAU), core: 0.2, a: 0.6 });
        if (Math.random() < 0.5) fxp({ type: 'ember', x: cx, y: cy - 10, vx: 0, vy: rand(-120, -60), drag: 1, life: 0.6, rgb: '110,240,200', size: rand(8, 12) });
      }
      S.shake = Math.max(S.shake, b.hostile ? 7 : 3); sfx('slam');
      b.round++; b.parity ^= 1; b.state = 'gap'; b.t = b.gap;
      if (b.round >= b.rounds) b.dead = true;
    } else { b.state = 'warn'; b.t = b.tele; }
  }
  S.boards = S.boards.filter(b => !b.dead);
  // 地裂（喝断长坂）：从脚下往外撕开，沿路冒出碎石
  for (const q of S.quakes) {
    if (q.d < q.len) {
      q.d = Math.min(q.len, q.d + q.speed * dt);
      const hx = q.x + Math.cos(q.a) * q.d, hy = q.y + Math.sin(q.a) * q.d;
      if (!q.hit && segDist(p.x, p.y, q.x, q.y, q.a, q.d) < q.w / 2 + p.r) { q.hit = true; hurtPlayer(q.dmg); p.kvx += Math.cos(q.a + Math.PI / 2) * 300; p.kvy += Math.sin(q.a + Math.PI / 2) * 300; }
      if (q.rocks.length < 40) q.rocks.push({ x: hx + rand(-q.w, q.w) * 0.3, y: hy + rand(-q.w, q.w) * 0.3, s: rand(8, 16), t: S.t });
      for (let k = 0; k < 2; k++) particle(hx, hy, '#7a6a52', 260);
    } else { q.linger -= dt; if (q.linger <= 0) q.dead = true; }
  }
  S.quakes = S.quakes.filter(q => !q.dead);
  // 巨石：一路滚，碰到屏幕边就弹回来
  const vw = W / ZOOM / 2, vh = H / ZOOM / 2;
  for (const b of S.boulders) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.rot += Math.hypot(b.vx, b.vy) / b.r * dt; b.life -= dt;
    if (b.bounces > 0) {
      if ((b.x - S.camX > vw - b.r && b.vx > 0) || (b.x - S.camX < -vw + b.r && b.vx < 0)) { b.vx = -b.vx; b.bounces--; groundImpact(b.x, b.y + b.r * 0.6, 80); S.shake = Math.max(S.shake, 6); }
      if ((b.y - S.camY > vh - b.r && b.vy > 0) || (b.y - S.camY < -vh + b.r && b.vy < 0)) { b.vy = -b.vy; b.bounces--; groundImpact(b.x, b.y + b.r * 0.6, 80); S.shake = Math.max(S.shake, 6); }
    }
    if (S.t > b.hitT && dist2(b.x, b.y, p.x, p.y) < (b.r + p.r) ** 2) { b.hitT = S.t + 0.6; hurtPlayer(b.dmg); const a = angleTo(b.x, b.y, p.x, p.y); p.kvx += Math.cos(a) * 700; p.kvy += Math.sin(a) * 700; }
    if (Math.random() < 0.6) fxp({ type: 'dust', x: b.x + rand(-b.r, b.r) * 0.5, y: b.y + b.r * 0.7, vx: -b.vx * 0.2, vy: -b.vy * 0.2, drag: 3, grow: 28, life: 0.5, rgb: '120,100,72', size: rand(10, 16) });
    if (b.life <= 0) b.dead = true;
  }
  S.boulders = S.boulders.filter(b => !b.dead);
  // 白龙盘枪：龙身是一圈（留一道缺口），慢慢收紧；最后龙头掉转扎穿圈心
  for (const c of S.coils) {
    c.t += dt;
    if (c.state === 'coil') {
      const f = Math.min(1, c.t / c.T);
      c.R = c.R0 + (c.R1 - c.R0) * f * f * (3 - 2 * f); c.head = c.a0 + f * TAU * 1.5;
      c.pts = coilPts(c);
      if (S.t > c.hitT && c.pts.some(q => dist2(q[0], q[1], p.x, p.y) < (c.body * 0.8 + p.r) ** 2)) { c.hitT = S.t + 0.5; hurtPlayer(c.dmg); }
      if (f >= 1) { // 掉头：从龙头的位置穿过你现在站的地方
        const [hx, hy] = c.pts[0]; c.da = angleTo(hx, hy, p.x, p.y); c.dx = hx; c.dy = hy; c.state = 'aim'; c.t = 0;
        tele({ kind: 'line', x: hx, y: hy, a: c.da, len: c.R * 2 + 500, w: c.diveW, life: c.dive, rgb: '220,235,255' });
      }
    } else if (c.state === 'aim') {
      if (c.t >= c.dive) { c.state = 'dive'; c.t = 0; c.hit = false; c.trail = c.pts.slice(); }
    } else {
      const d = c.t * 1800, hx = c.dx + Math.cos(c.da) * d, hy = c.dy + Math.sin(c.da) * d;
      c.trail.unshift([hx, hy]); if (c.trail.length > 26) c.trail.pop();
      if (!c.hit && dist2(hx, hy, p.x, p.y) < (c.diveW / 2 + p.r) ** 2) { c.hit = true; hurtPlayer(c.dmg * 1.4); }
      if (d > c.R * 2 + 500) c.dead = true;
    }
  }
  S.coils = S.coils.filter(c => !c.dead);
  // 遗计锦囊：贴在敌人身上，到时炸开
  for (const m of S.marks) {
    if (!m.e.dead) { m.x = m.e.x; m.y = m.e.y; }
    if (S.t < m.until) continue;
    hitCircle(m.x, m.y, m.radius, m.dmg, 140);
    fxTex('burst', m.x, m.y - 20, { w: m.radius * 2.2, h: m.radius * 2.2, rgb: '110,240,200', life: 0.35, grow: 1.4, rot: rand(0, TAU) });
    fxTex('ring', m.x, m.y, { w: m.radius * 0.8, h: m.radius * 0.8, rgb: '160,255,220', under: true, flat: 0.6, life: 0.4, grow: 2.4, core: 0.3 });
    for (let i = 0; i < 6; i++) fxp({ type: 'ember', x: m.x, y: m.y - 20, vx: rand(-160, 160), vy: rand(-220, -40), drag: 2, life: 0.6, rgb: '110,240,200', size: rand(8, 12) });
    sfx('slam'); m.dead = true;
  }
  S.marks = S.marks.filter(m => !m.dead);
  // 鬼谋迷雾：鬼火从黑暗里飘出来找你
  const M = S.mist;
  if (M) {
    if (S.t > M.until || M.boss.dead) S.mist = null;
    else if (M.left > 0 && (M.spawnT -= dt) <= 0) {
      M.spawnT = M.gap; M.left--;
      const a = rand(0, TAU), d = 420;
      S.eproj.push({ kind: 'wisp', x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, vx: -Math.cos(a) * 140, vy: -Math.sin(a) * 140, r: 12, dmg: M.dmg, life: 5, seek: 1.4, spin: rand(0, TAU) });
    }
  }
}
// ============ 司马懿：孤坟、狼顾目光、疑冢、墓碑（孤坟和墓碑敌我都用得上，带 hostile 标记） ============
// 疑冢被打破：假冢里爬出死士；真冢只报个信（逼出司马懿在 runUlt 里处理）
function tombBroken(t, quiet) {
  smoke(t.x, t.y - 20, 6, '30,14,44', 14, 18, 0.9);
  for (let i = 0; i < 10; i++) particle(t.x + rand(-t.r, t.r), t.y - rand(0, t.r), i % 2 ? '#3a3440' : '#5a5060', 260);
  sfx('slam');
  if (t.tomb && t.tomb.real) { addNumber(t.x, t.y - 70, '真冢！', '#e8d0ff', 22); return; }
  soulBurst(t.x, t.y, 70, 0.8);
  for (let i = 0; i < 2; i++) spawnEnemy('shade', t.x + rand(-24, 24), t.y + rand(-10, 24));
  if (!quiet) addNumber(t.x, t.y - 70, '疑冢 · 死士破土', '#c8a8f0', 18);
}
function updateSimayi(dt) {
  const p = S.player;
  // 孤坟：地面裂开、到时喷出鬼火；hostile 的伤你、爬出敌方死士，我方的伤敌、爬出死士随从
  for (const g of S.graves) {
    g.t -= dt;
    if (g.open) { if (g.t < -1.4) g.dead = true; continue; }
    if (g.t > 0) { if (Math.random() < 0.3) fxp({ type: 'smoke', x: g.x + rand(-g.r, g.r) * 0.6, y: g.y + rand(-6, 6), vx: 0, vy: -30, drag: 2, grow: 10, life: 0.4, rgb: '30,12,46', size: rand(4, 7) }); continue; }
    g.open = true;
    if (g.hostile) {
      if (dist2(g.x, g.y, p.x, p.y) < (g.r + p.r) ** 2) hurtPlayer(g.dmg, 'dark', g);
      for (let i = 0; i < g.raise; i++) spawnEnemy('shade', g.x + rand(-14, 14), g.y + rand(-8, 12));
    } else {
      hitCircle(g.x, g.y, g.r, g.dmg, 140, 0.5);
      if (g.raise) addAllies('ally_shade', g.raise, { life: g.life, dmg: g.sdmg, x: g.x, y: g.y });
    }
    soulBurst(g.x, g.y, g.r);
    groundImpact(g.x, g.y + 6, g.r * 1.1);
    S.shake = Math.max(S.shake, g.hostile ? 6 : 3);
  }
  S.graves = S.graves.filter(g => !g.dead);
  // 狼顾目光：先盯住你（预警），再绕着司马懿转；脚下一小圈是看不到的（灯下黑）
  for (const g of S.gazes) {
    g.t += dt;
    if (g.boss.dead || g.t > g.tele + g.dur) { g.dead = true; continue; }
    const e = g.boss, f = clamp((g.t - g.tele) / g.dur, 0, 1);
    g.a = g.a0 + g.dir * f * g.turns * TAU;
    if (g.t < g.tele || S.t < g.hitT) continue;
    const d = Math.sqrt(dist2(e.x, e.y, p.x, p.y));
    if (d < g.blind) continue;
    if (inWedge(p.x, p.y, e.x, e.y, g.a, g.R, g.half, p.r) || inWedge(p.x, p.y, e.x, e.y, g.a + Math.PI, g.R, g.half, p.r)) { g.hitT = S.t + 0.5; hurtPlayer(g.dmg, 'dark', e); }
  }
  S.gazes = S.gazes.filter(g => !g.dead);
  // 冢虎墓碑（神兵）：从天上砸下来，砸晕落点的敌人；立一会儿再炸出一圈鬼火
  for (const s of S.steles) {
    s.t += dt;
    if (s.state === 'fall' && s.t >= s.drop) {
      s.state = 'stand';
      hitCircle(s.x, s.y, s.r, s.dmg, 220, s.stun);
      groundImpact(s.x, s.y + 8, s.r * 1.2); impact(s.x, s.y, s.r * 0.6, D.elements.dark.rgb, 0.6);
      S.shake = Math.max(S.shake, 6); sfx('slam');
    } else if (s.state === 'stand' && s.t >= s.drop + s.nova) {
      s.state = 'fade'; s.fadeT = s.t;
      hitCircle(s.x, s.y, s.r * 1.3, s.dmg * 0.8, 140);
      soulBurst(s.x, s.y, s.r * 1.3);
    } else if (s.state === 'fade' && s.t - s.fadeT > 0.4) s.dead = true;
  }
  S.steles = S.steles.filter(s => !s.dead);
}
// 两道相背的目光（扇形）：从 r0 开始往外，越远越淡；hostile 是司马懿的（更亮、带红光）
function drawGaze(x, y, a, R, half, alpha, hostile, r0 = 0) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const off of [0, Math.PI]) {
    const aa = a + off, gr = ctx.createRadialGradient(x, y, r0, x, y, R);
    gr.addColorStop(0, `rgba(${hostile ? '220,120,255' : '200,140,255'},${0.42 * alpha})`);
    gr.addColorStop(0.7, `rgba(${hostile ? '150,50,210' : '140,70,210'},${0.2 * alpha})`);
    gr.addColorStop(1, 'rgba(90,30,150,0)');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(x, y, R, aa - half, aa + half); ctx.arc(x, y, r0, aa + half, aa - half, true); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = `rgba(235,200,255,${0.55 * alpha})`; ctx.lineWidth = hostile ? 2.5 : 1.5; // 目光的两道边
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + Math.cos(aa + s * half) * r0, y + Math.sin(aa + s * half) * r0); ctx.lineTo(x + Math.cos(aa + s * half) * R, y + Math.sin(aa + s * half) * R); ctx.stroke(); }
  }
  ctx.restore();
}
// 一双狼眼：细长、发紫红光的眼睛（司马懿头顶的大眼睛，玩家狼顾时的小眼睛）
function drawWolfEyes(x, y, s, alpha) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  FX.glow(ctx, x, y, s * 3.2, '170,60,220', 0.45 * alpha);
  for (const k of [-1, 1]) {
    const ex = x + k * s * 1.05;
    ctx.fillStyle = `rgba(255,120,200,${0.9 * alpha})`;
    ctx.beginPath(); ctx.ellipse(ex, y, s * 0.72, s * 0.24, k * -0.22, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(255,240,250,${alpha})`;
    ctx.beginPath(); ctx.ellipse(ex, y, s * 0.1, s * 0.22, 0, 0, TAU); ctx.fill(); // 竖着的瞳孔
  }
  ctx.restore();
}
function drawSimayiUnder() {
  for (const g of S.graves) { // 孤坟：地面先裂开一圈，冒黑烟；炸开后留下一个塌开的坟坑
    if (g.open) {
      const a = clamp(1 + g.t / 1.4, 0, 1);
      ctx.fillStyle = `rgba(14,6,22,${0.7 * a})`; ctx.beginPath(); ctx.ellipse(g.x, g.y, g.r * 0.55, g.r * 0.3, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(150,90,200,${0.5 * a})`; ctx.lineWidth = 2; ctx.stroke();
      continue;
    }
    const prog = 1 - g.t / g.max, rgb = g.hostile ? '190,80,240' : '160,110,220', blink = 0.6 + 0.4 * Math.sin(S.t * (14 + prog * 24));
    ctx.fillStyle = `rgba(30,8,44,${(g.hostile ? 0.3 : 0.18) + 0.25 * prog})`;
    ctx.beginPath(); ctx.ellipse(g.x, g.y, g.r, g.r * 0.62, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(${rgb},${0.22 * prog})`;
    ctx.beginPath(); ctx.ellipse(g.x, g.y, g.r * prog, g.r * 0.62 * prog, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(${rgb},${(g.hostile ? 0.85 : 0.5) * blink})`; ctx.lineWidth = g.hostile ? 2.5 : 1.5;
    ctx.beginPath(); ctx.ellipse(g.x, g.y, g.r, g.r * 0.62, 0, 0, TAU); ctx.stroke();
    // 裂缝 + 慢慢顶出来的墓碑
    const h = 26 * prog;
    ctx.fillStyle = '#3a3444'; ctx.strokeStyle = '#120c18'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(g.x - 9, g.y); ctx.lineTo(g.x - 9, g.y - h); ctx.quadraticCurveTo(g.x, g.y - h - 8, g.x + 9, g.y - h); ctx.lineTo(g.x + 9, g.y); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  for (const g of S.gazes) { // 狼顾：预警时淡淡的两道，扫起来以后亮起来
    const e = g.boss, warm = g.t < g.tele, k = warm ? 0.25 + 0.25 * Math.sin(S.t * 20) : 1;
    drawGaze(e.x, e.y - 20, g.a, g.R, g.half, k, true, g.blind);
    if (!warm) { ctx.strokeStyle = 'rgba(200,150,255,0.35)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.ellipse(e.x, e.y, g.blind, g.blind * 0.8, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]); } // 灯下黑的那一圈
  }
}
function drawSimayiOver() {
  for (const g of S.gazes) { // 司马懿头顶睁开一双狼眼
    const e = g.boss, a = Math.min(1, g.t / 0.3, (g.tele + g.dur - g.t) / 0.3);
    drawWolfEyes(e.x, e.y - e.r * 4.2 - 10, 26, a);
  }
  for (const s of S.steles) { // 墓碑：黑石碑从天上砸下来，碑面刻着发光的「冢」字
    const k = s.state === 'fall' ? clamp(s.t / s.drop, 0, 1) : 1, a = s.state === 'fade' ? Math.max(0, 1 - (s.t - s.fadeT) / 0.4) : 1;
    const w = 34, h = 58, y = s.y - (1 - k * k) * 420;
    ctx.fillStyle = `rgba(0,0,0,${0.35 * k * a})`; ctx.beginPath(); ctx.ellipse(s.x, s.y + 4, w * (0.4 + 0.6 * k), 9 * (0.4 + 0.6 * k), 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = a;
    ctx.fillStyle = '#2c2834'; ctx.strokeStyle = '#0e0a12'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(s.x - w / 2, y); ctx.lineTo(s.x - w / 2, y - h); ctx.quadraticCurveTo(s.x, y - h - 14, s.x + w / 2, y - h); ctx.lineTo(s.x + w / 2, y); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter'; FX.glow(ctx, s.x, y - h * 0.5, 30, '170,90,230', 0.5 * a); ctx.globalCompositeOperation = 'source-over';
    ctx.font = `900 20px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#e8d0ff'; ctx.fillText('冢', s.x, y - h * 0.5); ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = 1;
  }
}
// 我方的铁骑英灵：从 (x, y) 往 a 方向排成一排冲过去；back 是起点往后退多少（从身后冲出来）
function spiritRiders(x, y, a, n, len, w, dmg, speed, back) {
  const ux = Math.cos(a), uy = Math.sin(a);
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * w * 0.8, sx = x - uy * off + ux * back, sy = y + ux * off + uy * back;
    S.riders.push({ x: sx - ux * i * 30, y: sy - uy * i * 30, a, speed, left: len, hostile: false, dmg, w, hitSet: new Set(), seed: rand(0, 9) });
  }
}
// 白龙盘成一圈的身体：从龙头往后绕大约 300 度，留出一道缺口
function coilPts(c) {
  const pts = [], n = 26;
  for (let j = 0; j < n; j++) { const a = c.head - j * 0.205, r = c.R * (1 + 0.04 * Math.sin(S.t * 8 + j * 0.6)); pts.push([c.x + Math.cos(a) * r, c.y + Math.sin(a) * r * 0.85]); }
  return pts;
}
function drawBossFx2Under() {
  for (const o of S.pools) { // 雷火圈
    if (o.kind !== 'firering') continue;
    const a = Math.min(1, (o.until - S.t) / 0.5, (S.t - o.born) / 0.2);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
    ctx.strokeStyle = 'rgba(120,170,255,0.45)'; ctx.lineWidth = o.band * 1.6; ctx.beginPath(); ctx.arc(o.x, o.y, o.R, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(230,240,255,${0.6 + 0.3 * Math.sin(S.t * 22)})`; ctx.lineWidth = o.band * 0.35; ctx.beginPath(); ctx.arc(o.x, o.y, o.R, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  for (const b of S.boards) { // 棋盘：格线 + 将要炸开的格子发青光
    const half = b.n * b.cell / 2, x0 = b.x - half, y0 = b.y - half, warn = b.state === 'warn', pr = warn ? 1 - b.t / b.tele : 0, blink = 0.6 + 0.4 * Math.sin(S.t * (14 + pr * 26));
    const fade = Math.min(1, (S.t - b.born) / 0.3);
    ctx.save(); ctx.globalAlpha = fade;
    for (let i = 0; i < b.n; i++) for (let j = 0; j < b.n; j++) {
      const x = x0 + i * b.cell, y = y0 + j * b.cell, bad = warn && (i + j) % 2 === b.parity;
      ctx.fillStyle = bad ? `rgba(20,90,80,${0.35 + 0.35 * pr})` : 'rgba(230,245,240,0.10)';
      ctx.fillRect(x + 2, y + 2, b.cell - 4, b.cell - 4);
      if (bad) { ctx.strokeStyle = `rgba(110,240,200,${0.7 * blink})`; ctx.lineWidth = 2.5; ctx.strokeRect(x + 4, y + 4, b.cell - 8, b.cell - 8); FX.wisp(ctx, x + b.cell / 2, y + b.cell * 0.62, b.cell * 0.12 * (0.6 + 0.6 * pr), S.t + i + j, 0.8); }
    }
    ctx.strokeStyle = 'rgba(200,240,230,0.35)'; ctx.lineWidth = 1.5; ctx.strokeRect(x0, y0, half * 2, half * 2);
    ctx.restore();
  }
  for (const q of S.quakes) { // 地裂：一道发着暗红火光的裂缝，沿路翘起碎石
    const a = q.d < q.len ? 1 : Math.max(0, q.linger / 0.6), ex = q.x + Math.cos(q.a) * q.d, ey = q.y + Math.sin(q.a) * q.d;
    ctx.save(); ctx.globalAlpha = a; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(20,12,8,0.85)'; ctx.lineWidth = q.w * 0.35; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,120,50,0.55)'; ctx.lineWidth = q.w * 0.12; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    for (const r of q.rocks) { const k = Math.min(1, (S.t - r.t) / 0.15); ctx.fillStyle = '#6e5e48'; ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(r.x - r.s * 0.6, r.y + 4); ctx.lineTo(r.x, r.y - r.s * 1.6 * k); ctx.lineTo(r.x + r.s * 0.6, r.y + 4); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.restore();
  }
}
function drawBossFx2() {
  for (const r of S.riders) { // 铁骑英灵：半透明的骑兵，外面一层银蓝光
    const spr = unitSprite('cavalry', D.enemies.cavalry.look, 62, false, D.enemies.cavalry.mount || '#5a3a24');
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; FX.glow(ctx, r.x, r.y - 26, 60, r.hostile ? '120,170,255' : '255,215,130', 0.55); ctx.restore();
    ctx.globalAlpha = 0.85; drawUnit(spr, r.x, r.y, 16, Math.cos(r.a) >= 0 ? 1 : -1, Math.sin(S.t * 30 + r.seed) * 2); ctx.globalAlpha = 1;
  }
  for (const b of S.boulders) FX.rock(ctx, b.x, b.y - b.r * 0.3, b.r, b.rot);
  for (const c of S.coils) { // 白龙
    const pts = c.state === 'dive' ? c.trail : c.pts; if (!pts || pts.length < 4) continue;
    FX.dragon(ctx, pts, { rgb: '235,245,255', a: 1, w: c.body, head: window.Assets.get('fx:dragon_white'), t: S.t, core: '255,255,255' });
  }
  for (const m of S.marks) { // 锦囊：敌人头顶一个青色的「计」字，外面一圈倒计时
    const k = Math.max(0, (m.until - S.t) / m.delay), y = m.y - 46;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; FX.glow(ctx, m.x, y, 26, '110,240,200', 0.6); ctx.restore();
    ctx.strokeStyle = 'rgba(160,255,220,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(m.x, y, 15, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke();
    ctx.font = `700 15px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#e8fff8'; ctx.fillText('计', m.x, y + 1); ctx.textBaseline = 'alphabetic';
  }
}
// 鬼谋迷雾：在屏幕上盖一层黑雾，只留你身边一圈；黑雾上面再把鬼火画亮，看得见它们飘过来
function drawMist() {
  const M = S.mist; if (!M) return;
  const p = S.player, a = Math.min(1, (S.t - M.born) / 0.5, (M.until - S.t) / 0.5);
  const sx = W / 2 + (p.x - S.camX) * ZOOM, sy = H / 2 + (p.y - 20 - S.camY) * ZOOM, r = M.sight * ZOOM;
  const g = ctx.createRadialGradient(sx, sy, r * 0.6, sx, sy, r * 1.25);
  g.addColorStop(0, 'rgba(4,10,10,0)'); g.addColorStop(1, `rgba(4,10,10,${0.93 * a})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (const b of S.eproj) if (b.kind === 'wisp') FX.wisp(ctx, W / 2 + (b.x - S.camX) * ZOOM, H / 2 + (b.y - S.camY) * ZOOM, b.r * ZOOM, S.t + b.spin, 1, b.wrgb);
}
// 地面一层：漩涡、蝶环、潮水、纸鸢的影子、蝶影分身
function drawBossFxUnder() {
  for (const o of S.pools) {
    if (o.kind === 'whirl') {
      const R = o.R * Math.min(1, (S.t - o.born) / 0.5), a = Math.min(1, (o.until - S.t) / 0.4);
      ctx.save(); ctx.translate(o.x, o.y); ctx.scale(1, 0.7);
      const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
      gr.addColorStop(0, `rgba(10,40,50,${0.7 * a})`); gr.addColorStop(0.3, `rgba(30,110,120,${0.4 * a})`); gr.addColorStop(1, 'rgba(60,170,170,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(180,245,240,${0.55 * a})`; ctx.lineWidth = 2.4;
      for (let k = 0; k < 4; k++) { ctx.beginPath(); for (let i = 0; i <= 40; i++) { const t = i / 40, ang = o.rot + k * TAU / 4 + t * 4.2, r = R * (1 - t * 0.85); i ? ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r) : ctx.moveTo(Math.cos(ang) * r, Math.sin(ang) * r); } ctx.stroke(); }
      ctx.strokeStyle = `rgba(255,120,120,${(0.5 + 0.3 * Math.sin(S.t * 12)) * a})`; ctx.lineWidth = 3; // 中心危险圈
      ctx.beginPath(); ctx.arc(0, 0, o.coreR, 0, TAU); ctx.stroke();
      ctx.restore();
    }
  }
  for (const w of S.tides) {
    const ux = Math.cos(w.dir), uy = Math.sin(w.dir), cx = w.x0 + ux * w.travel, cy = w.y0 + uy * w.travel;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(w.dir);
    const half = w.span / 2, g0 = w.gap - w.gapW / 2, g1 = w.gap + w.gapW / 2;
    if (w.wait > 0) { // 预警：水墙的位置和缺口，箭头指着它要冲过来的方向
      const blink = 0.5 + 0.4 * Math.sin(S.t * 16);
      ctx.fillStyle = `rgba(110,220,210,${0.18 + 0.1 * blink})`;
      ctx.fillRect(-w.depth / 2, -half, w.depth, g0 + half); ctx.fillRect(-w.depth / 2, g1, w.depth, half - g1);
      ctx.strokeStyle = `rgba(180,250,245,${0.6 * blink})`; ctx.lineWidth = 2;
      ctx.strokeRect(-w.depth / 2, -half, w.depth, g0 + half); ctx.strokeRect(-w.depth / 2, g1, w.depth, half - g1);
      ctx.fillStyle = `rgba(255,255,255,${0.6 * blink})`;
      for (let l = -half + 60; l < half; l += 140) { if (l > g0 - 20 && l < g1 + 20) continue; ctx.beginPath(); ctx.moveTo(w.depth / 2 + 26, l); ctx.lineTo(w.depth / 2 + 8, l - 9); ctx.lineTo(w.depth / 2 + 8, l + 9); ctx.fill(); }
      FX.lantern(ctx, 0, w.gap, 12, blink + 0.3); // 缺口处一盏莲灯
    } else {
      for (const [a0, a1] of [[-half, g0], [g1, half]]) {
        const gr = ctx.createLinearGradient(-w.depth / 2, 0, w.depth / 2, 0);
        gr.addColorStop(0, 'rgba(40,140,150,0.15)'); gr.addColorStop(0.6, 'rgba(70,190,190,0.75)'); gr.addColorStop(1, 'rgba(230,255,252,0.95)');
        ctx.fillStyle = gr; ctx.fillRect(-w.depth / 2, a0, w.depth, a1 - a0);
        ctx.strokeStyle = 'rgba(245,255,255,0.9)'; ctx.lineWidth = 3; // 浪尖白沫
        ctx.beginPath(); for (let l = a0; l <= a1; l += 12) { const x = w.depth / 2 + Math.sin(l * 0.08 + S.t * 9) * 5; l === a0 ? ctx.moveTo(x, l) : ctx.lineTo(x, l); } ctx.stroke();
      }
      FX.lantern(ctx, 0, w.gap, 12, 1);
    }
    ctx.restore();
  }
  for (const k of S.kites) { // 影子：追着你的紫色圈，锁定后变红、收紧
    const lock = k.state === 'lock', pr = lock ? 1 - k.lockT / k.lock : 0, blink = 0.6 + 0.4 * Math.sin(S.t * (lock ? 30 : 10));
    const rgb = lock ? '255,110,150' : '200,150,255';
    ctx.fillStyle = `rgba(${rgb},${0.12 + 0.2 * pr})`; ctx.beginPath(); ctx.ellipse(k.x, k.y, k.r, k.r * 0.7, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(${rgb},${0.7 * blink})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(k.x, k.y, k.r, k.r * 0.7, 0, 0, TAU); ctx.stroke();
    if (lock) { ctx.fillStyle = `rgba(${rgb},0.35)`; ctx.beginPath(); ctx.ellipse(k.x, k.y, k.r * pr, k.r * 0.7 * pr, 0, 0, TAU); ctx.fill(); }
  }
  for (const f of S.flails) { // 铁锤扫过的那一圈，地上淡淡一道暗红
    ctx.strokeStyle = 'rgba(160,20,50,0.28)'; ctx.lineWidth = 10; ctx.setLineDash([18, 12]);
    ctx.beginPath(); ctx.ellipse(f.boss.x, f.boss.y, f.R, f.R * 0.8, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  }
}
// 上面一层：铁链、铁锤、莲灯、纸鸢、蝶环、蝶影分身
function drawBossFx() {
  for (const c of S.chains) {
    if (c.delay > 0 || c.d <= 0) continue;
    const [ox, oy] = chainFrom(c);
    FX.chain(ctx, ox, oy, ox + Math.cos(c.a) * c.d, oy + Math.sin(c.a) * c.d, { w: 8, hook: true, sag: c.state === 'out' ? 0 : 6 });
  }
  for (const f of S.flails) {
    const b = f.boss;
    FX.chain(ctx, b.x, b.y - b.r * 0.8, f.x, f.y - 14, { w: 7, sag: 14 });
    ctx.save(); ctx.translate(f.x, f.y - 14);
    ctx.globalCompositeOperation = 'lighter'; FX.glow(ctx, 0, 0, f.r * 2.2, '200,30,60', 0.6); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.rotate(S.t * 6);
    ctx.fillStyle = '#141016'; ctx.strokeStyle = 'rgba(200,60,90,0.9)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, r = i % 2 ? f.r * 0.8 : f.r * 1.15; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  for (const L of S.lanterns) {
    const bob = Math.sin(S.t * 3 + L.seed) * 4;
    if (L.fuse > 0) { // 引信：一圈收紧的危险圈
      const pr = 1 - L.fuse / L.fuseMax, blink = 0.6 + 0.4 * Math.sin(S.t * 30);
      ctx.fillStyle = `rgba(120,220,210,${0.12 + 0.25 * pr})`; ctx.beginPath(); ctx.arc(L.x, L.y, L.blast, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(200,255,250,${0.8 * blink})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(L.x, L.y, L.blast, 0, TAU); ctx.stroke();
    }
    FX.lantern(ctx, L.x, L.y - 14 + bob, 13, 1, L.fuse > 0 ? '255,140,120' : '255,200,120');
  }
  for (const k of S.kites) { // 纸鸢在影子上方，俯冲时落下来
    const h = k.state === 'lock' ? 220 * Math.max(0, k.lockT / k.lock) : 220;
    FX.kite(ctx, k.x + Math.sin(S.t * 3 + k.seed) * 6, k.y - 30 - h, 20, Math.sin(S.t * 2 + k.seed) * 0.2, '200,150,255', 1);
  }
  for (const o of S.pools) {
    if (o.kind !== 'bring') continue;
    const armA = Math.min(1, (S.t - o.born) / o.arm);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; // 发光的蝶环，缺口处断开
    ctx.strokeStyle = `rgba(170,110,255,${0.45 * armA})`; ctx.lineWidth = 16;
    for (let k = 0; k < o.gaps; k++) {
      const a0 = o.rot + k * TAU / o.gaps + o.gapHalf, a1 = o.rot + (k + 1) * TAU / o.gaps - o.gapHalf;
      ctx.beginPath(); ctx.arc(o.x, o.y - 10, o.R, a0, a1); ctx.stroke();
    }
    ctx.restore();
    for (let i = 0; i < o.n; i++) {
      const a = o.rot + i / o.n * TAU;
      let gap = false;
      for (let k = 0; k < o.gaps; k++) if (Math.abs(angDiff(o.rot + k * TAU / o.gaps, a)) < o.gapHalf) gap = true;
      if (gap) continue;
      FX.butterfly(ctx, o.x + Math.cos(a) * o.R, o.y + Math.sin(a) * o.R - 10, 12, a + Math.PI / 2, S.t * 5 + i, '215,175,255', armA);
    }
  }
  for (const o of S.decoys) { // 蝶影分身：半透明的你，周围绕着蝴蝶
    const a = 0.45 + 0.15 * Math.sin(S.t * 6);
    { const L = S.gearLook || { w: 1, a: 1 }, lk = `${S.origin.id}_w${L.w}a${L.a}`, sid = window.Assets.get('sprite:' + lk) ? lk : S.origin.id; ctx.globalAlpha = a; drawUnit(unitSprite(sid, S.origin.look, 44, false, ''), o.x, o.y, S.player.r, o.fx, 0); ctx.globalAlpha = 1; }
    for (let i = 0; i < 3; i++) { const t = S.t * 2 + i * TAU / 3; FX.butterfly(ctx, o.x + Math.cos(t) * 26, o.y - 30 + Math.sin(t) * 12, 6, 0, S.t * 6 + i, '215,180,255', 0.9); }
  }
}

function updateBoss(e, dt) {
  const p = S.player, g = e.def;
  if (e.boss && !e.enraged && e.hp < e.maxHp * 0.5) {
    e.enraged = true;
    say(e, g.rage || '“有点本事！”');
    if (e.boss) speak(e.gid, 'rage', g.rage);
    S.shake = 10;
  }
  if (e.boss) bossPhase(e);
  if (e.ult) { runUlt(e, dt); return; } // 正在放大招
  const frenzy = e.frenzyT > S.t;
  if (frenzy && Math.random() < 0.5) fxp({ type: 'ember', x: e.x + rand(-e.r, e.r), y: e.y - rand(0, e.r * 2.4), vx: 0, vy: rand(-90, -40), drag: 1, life: 0.5, rgb: '255,70,40', size: rand(6, 10) });
  const fast = (e.enraged ? 0.75 : 1) * (frenzy ? 0.6 : 1);
  const toP = angleTo(e.x, e.y, p.x, p.y);
  switch (e.state) {
    case 'chase': {
      const sp = e.speed * (e.enraged ? 1.25 : 1) * (frenzy ? 1.5 : 1) * (e.slowT > S.t ? 0.8 : 1);
      let dir = 1;
      if (g.kite) { // 诸葛亮：与玩家保持距离
        const d = Math.sqrt(dist2(e.x, e.y, p.x, p.y));
        dir = d < g.kite ? -0.8 : d < g.kite + 80 ? 0 : 1;
      }
      e.x += Math.cos(toP) * sp * dir * dt; e.y += Math.sin(toP) * sp * dir * dt;
      // 大招：有冷却，满足条件就放
      if (e.boss && g.ults) { e.ultT -= dt; if (e.ultT <= 0 && tryUlt(e)) break; }
      e.atkT -= dt;
      if (e.atkT <= 0) startBossAttack(e);
      break;
    }
    case 'tele_cleave': // 关羽：扇形劈砍，前段跟踪方向
      e.stateT -= dt;
      if (e.stateT > e.stateMax * 0.4) e.ang = toP;
      if (e.stateT <= 0) {
        const d = Math.sqrt(dist2(e.x, e.y, p.x, p.y));
        if (d < g.cleaveR + p.r && Math.abs(angDiff(e.ang, toP)) < Math.PI / 3) hurtPlayer(e.dmg * 1.6);
        S.effects.push({ kind: 'arc', x: e.x, y: e.y - 20, a: e.ang, range: g.cleaveR, half: Math.PI / 3, life: 0.34, max: 0.34, rgb: '255,95,60' });
        fxTex('slash', e.x + Math.cos(e.ang) * g.cleaveR * 0.6, e.y - 20 + Math.sin(e.ang) * g.cleaveR * 0.6, { w: g.cleaveR * 1.9, h: g.cleaveR * 0.8, rot: e.ang + Math.PI / 2, rgb: g.ultRgb || '255,120,70', life: 0.28, grow: 1.12, core: 0.55 });
        punch(0.3);
        sparks(e.x + Math.cos(e.ang) * g.cleaveR * 0.8, e.y + Math.sin(e.ang) * g.cleaveR * 0.8, e.ang, 12, '255,150,90', 500, 0.9, 2.6);
        S.shake = Math.max(S.shake, 10);
        sfx('slam');
        e.state = 'recover'; e.stateT = 0.5;
      }
      break;
    case 'tele_roar': // 张飞：怒吼，范围内受伤并被震退
      e.stateT -= dt;
      if (e.stateT <= 0) {
        if (dist2(e.x, e.y, p.x, p.y) < (g.roarR + p.r) ** 2) {
          hurtPlayer(e.dmg * 1.2);
          p.kvx += Math.cos(toP) * 700; p.kvy += Math.sin(toP) * 700;
        }
        S.effects.push({ kind: 'wave', x: e.x, y: e.y, r: g.roarR, life: 0.55, max: 0.55, color: '#f0ead8' });
        S.effects.push({ kind: 'wave', x: e.x, y: e.y, r: g.roarR * 0.65, life: 0.4, max: 0.4, color: '#ffffff' });
        fxTex('ring', e.x, e.y, { w: g.roarR * 0.7, h: g.roarR * 0.7, rgb: g.ultRgb || '255,240,200', life: 0.5, grow: 3, core: 0.5 });
        punch(0.5);
        groundImpact(e.x, e.y + e.r * 0.5, g.roarR * 0.7);
        S.shake = Math.max(S.shake, 14);
        sfx('boss');
        e.state = 'recover'; e.stateT = 0.6;
      }
      break;
    case 'windup': // 扇形飞射前摇
      e.stateT -= dt;
      if (e.stateT <= 0) {
        const v = g.volley, n = v.count + (e.enraged ? 2 : 0), spread = v.spread * (n / v.count);
        for (let i = 0; i < n; i++) {
          const a = toP + (n > 1 ? (i / (n - 1) - 0.5) * spread : 0);
          const kind = v.petal ? 'petal' : v.ice ? 'icicle' : v.fan ? 'fan' : v.lantern ? 'lantern' : v.butterfly ? 'butterfly' : v.wisp ? 'wisp' : undefined; // 女将：花瓣 / 冰棱 / 飞扇 / 莲灯 / 蝴蝶
          S.eproj.push({ kind, wrgb: v.wrgb, x: e.x, y: e.y - 14, vx: Math.cos(a) * v.speed, vy: Math.sin(a) * v.speed, r: v.big ? 10 : kind ? 9 : 6, big: v.big, dmg: v.dmg * e.dmg / g.dmg, life: 2.6, spin: rand(0, TAU), spinRate: kind === 'fan' ? 16 : kind === 'petal' ? 5 : 0, chill: v.ice ? 1.2 : 0 });
        }
        if (v.petal) petals(e.x, e.y - 20, 10, 140);
        else if (v.ice) shards(e.x, e.y - 20, 6, 160, 7);
        e.state = 'recover'; e.stateT = 0.4;
      }
      break;
    case 'tele_charge':
      e.stateT -= dt;
      if (e.stateT > e.stateMax * 0.35) e.ang = toP; // 前段跟踪，后段锁定方向
      if (e.stateT <= 0) {
        e.state = 'charge'; e.stateT = 0.45;
        const L = g.chargeSpeed * 0.45; // 冲锋起步：沿冲锋路线拉出一道光
        fxTex('thrust', e.x + Math.cos(e.ang) * L * 0.5, e.y - e.r * 0.5 + Math.sin(e.ang) * L * 0.5, { w: L * 1.1, h: e.r * 2.4, rot: e.ang, rgb: g.ultRgb || '255,140,90', life: 0.3, sx: 1.2, a: e.boss ? 0.8 : 0.5 });
      }
      break;
    case 'charge': {
      const sp = g.chargeSpeed * (e.enraged ? 1.12 : 1);
      if (g.homing) e.ang += clamp(angDiff(e.ang, toP), -g.homing * dt, g.homing * dt); // 追着玩家冲
      e.x += Math.cos(e.ang) * sp * dt; e.y += Math.sin(e.ang) * sp * dt;
      if (Math.random() < 0.7) fxp({ type: 'dust', x: e.x + rand(-10, 10), y: e.y + e.r * 0.5, vx: -Math.cos(e.ang) * 60 + rand(-20, 20), vy: -Math.sin(e.ang) * 60 + rand(-20, 0), drag: 3, grow: 22, life: 0.5, rgb: '120,100,72', size: rand(6, 10) });
      e.stateT -= dt;
      if (e.stateT <= 0) {
        e.charges--;
        if (e.charges > 0) { e.state = 'tele_charge'; e.stateT = e.stateMax = 0.45 * fast; e.ang = angleTo(e.x, e.y, p.x, p.y); }
        else { e.state = 'recover'; e.stateT = 0.6; }
      }
      break;
    }
    case 'tele_hook': {
      e.stateT -= dt;
      if (e.stateT > e.stateMax * 0.45) e.ang = toP;
      const T = e.hookTele; if (T) { T.x = e.x; T.y = e.y; T.a = e.ang; }
      if (e.stateT <= 0) {
        const h = g.hook, o = { len: h.len, speed: h.speed, w: h.w, dmg: e.dmg * 0.8, pull: h.pull, crush: e.dmg * h.crush };
        throwChain(e, e.ang, o);
        if (e.enraged) for (const s of [-0.4, 0.4]) throwChain(e, e.ang + s, Object.assign({}, o)); // 暴怒：三条一起甩
        smoke(e.x, e.y - 20, 4, '12,8,12', 14, 16, 0.6);
        sfx('swing');
        e.state = 'recover'; e.stateT = 0.55;
      }
      break;
    }
    case 'tele_slam':
      e.stateT -= dt;
      if (e.stateT <= 0) {
        if (dist2(e.x, e.y, p.x, p.y) < (g.slamR + p.r) ** 2) hurtPlayer(e.dmg * 1.5);
        S.effects.push({ kind: 'wave', x: e.x, y: e.y, r: g.slamR, life: 0.45, max: 0.45, color: '#ff6a46' });
        impact(e.x, e.y + e.r * 0.4, g.slamR * 0.8, g.ultRgb || '255,120,70', e.boss ? 1 : 0.6);
        groundImpact(e.x, e.y + e.r * 0.5, g.slamR);
        S.shake = Math.max(S.shake, 12);
        sfx('slam');
        e.state = 'recover'; e.stateT = 0.55;
      }
      break;
    case 'recover':
      e.stateT -= dt;
      if (e.stateT <= 0) { e.state = 'chase'; e.atkT = g.interval * fast; }
      break;
  }
}
function startBossAttack(e) {
  const g = e.def, p = S.player;
  const atk = g.attacks[e.atkIdx++ % g.attacks.length];
  const fast = e.enraged ? 0.75 : 1, tk = fast * (g.teleK || 1); // 范围招式的预警按范围拉长一点
  if (atk === 'charge' || atk === 'charge3') {
    e.charges = atk === 'charge3' ? (e.enraged ? 4 : 3) : 1;
    e.state = 'tele_charge'; e.stateT = e.stateMax = 0.8 * fast;
    e.ang = angleTo(e.x, e.y, p.x, p.y);
  } else if (atk === 'hook') { // 董卓：甩出铁链钩人（前段跟着你转，后段锁定方向）
    const h = g.hook;
    e.state = 'tele_hook'; e.stateT = e.stateMax = h.tele * fast;
    e.ang = angleTo(e.x, e.y, p.x, p.y);
    e.hookTele = tele({ kind: 'line', x: e.x, y: e.y, a: e.ang, len: h.len, w: h.w * 1.5, life: e.stateT, rgb: g.ultRgb, dark: true });
  } else if (atk === 'slam') {
    e.state = 'tele_slam'; e.stateT = e.stateMax = 0.95 * tk;
  } else if (atk === 'summon') {
    const n = (g.summon || 4) + (e.enraged ? 3 : 0), type = g.summonType || 'cavalry';
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU;
      spawnEnemy(type, e.x + Math.cos(a) * 80, e.y + Math.sin(a) * 80);
    }
    say(e, `“${D.enemies[type].name}，随我杀敌！”`);
    e.state = 'recover'; e.stateT = 0.5;
  } else if (atk === 'cleave') {
    e.state = 'tele_cleave'; e.stateT = e.stateMax = 0.85 * tk;
    e.ang = angleTo(e.x, e.y, p.x, p.y);
  } else if (atk === 'roar') {
    e.state = 'tele_roar'; e.stateT = e.stateMax = 1.0 * tk;
  } else if (atk === 'volley') {
    e.state = 'windup'; e.stateT = e.stateMax = 0.5 * fast;
  } else if (atk === 'meteor') { // 诸葛亮火攻：玩家脚下与周围落下火球
    const m = g.meteor, n = m.count + (e.enraged ? 3 : 0), spread = 160 * (g.aoe || 1);
    for (let i = 0; i < n; i++) {
      const ox = i ? rand(-spread, spread) : 0, oy = i ? rand(-spread, spread) : 0;
      S.hazards.push({ x: p.x + ox, y: p.y + oy, r: m.radius, t: m.delay + i * 0.08, max: m.delay + i * 0.08, dmg: m.dmg * e.dmg / g.dmg, rgb: m.rgb, bolt: m.bolt, petal: m.petal, ice: m.ice, page: m.page, water: m.water, kite: m.kite, wisp: m.wisp });
    }
    e.state = 'recover'; e.stateT = 0.6;
  }
}

function updateEnemies(dt) {
  const p = S.player;
  const farR = Math.hypot(W, H) / 2 / ZOOM + 420;
  const decay = Math.exp(-9 * dt);
  for (const e of S.enemies) {
    if (e.dead) continue;
    e.flash = Math.max(0, e.flash - dt);
    if (e.building) { updateBuilding(e, dt); continue; } // 据点不移动、不撞人
    if (e.boss || e.ai) {
      // 护甲：一段时间没挨打就慢慢恢复
      if (e.shieldMax && e.shield < e.shieldMax && S.t - e.shieldHitT > D.champion.shieldRegenDelay)
        e.shield = Math.min(e.shieldMax, e.shield + e.shieldMax / D.champion.shieldRegenTime * dt);
      // 武将、精英被甩得太远时重新出现在屏幕边缘
      if (!e.ult && dist2(e.x, e.y, p.x, p.y) > farR * farR) { const [x, y] = spawnPos(-80); e.x = x; e.y = y; e.state = 'chase'; }
      // 属性名将：出招时打中带属性；放出的飞弹、落点、火地带、音波也记下属性
      atkEl = e.boss && e.def.el || null; atkSrc = e;
      const q = [[S.eproj, S.eproj.length], [S.hazards, S.hazards.length], [S.ezones, S.ezones.length], [S.erings, S.erings.length]];
      updateBoss(e, dt);
      if (atkEl) for (const [list, n0] of q) for (let i = n0; i < list.length; i++) {
        const o = list[i];
        if (o.el !== undefined) continue;
        o.el = atkEl;
        if (list === S.hazards && !o.ice && !o.petal && !o.page && !o.water && !o.kite && !o.wisp) o.rgb = D.elements[atkEl].rgb; // 落点换成属性色
      }
      if (e.def.dragonTrail) recordTrail(e, e.x, e.y - e.r * 1.1, e.state === 'charge' || !!(e.ult && /Dash$/.test(e.ult.u.type) && e.ult.phase === 2), 22, 22);
    }
    else {
      const d0 = Math.hypot(p.x - e.x, p.y - e.y) || 1;
      if (d0 > farR) { const [x, y] = spawnPos(); e.x = x; e.y = y; continue; }
      // 吸引仇恨：附近有比玩家更近的随从，就先去打随从
      let tx = p.x, ty = p.y, d = d0;
      if (S.allies.length) for (const a of S.allies) {
        if (a.gone) continue;
        const ad = Math.hypot(a.x - e.x, a.y - e.y);
        if (ad < D.allyHp.aggroR && ad < d) { d = ad || 1; tx = a.x; ty = a.y; }
      }
      for (const o of S.decoys) { // 蝶影分身：附近的小兵改去追分身
        const od = Math.hypot(o.x - e.x, o.y - e.y);
        if (od < o.lure && od < d + 200) { d = od || 1; tx = o.x; ty = o.y; }
      }
      const dx = tx - e.x, dy = ty - e.y;
      const sp = (e.stunT > S.t ? 0 : e.speed) * (e.slowT > S.t ? e.slowF : 1);
      let mx = dx / d, my = dy / d;
      const rg = e.def.ranged;
      if (rg) {
        if (d < rg.range * 0.7) { mx = -mx * 0.6; my = -my * 0.6; }
        else if (d < rg.range) { mx = 0; my = 0; }
        if (!(e.stunT > S.t)) e.shootT -= dt;
        if (e.shootT <= 0 && d < rg.range + 40) {
          e.shootT = rg.cd * rand(0.85, 1.15);
          const a = Math.atan2(dy, dx);
          S.eproj.push({ x: e.x, y: e.y, vx: Math.cos(a) * rg.speed, vy: Math.sin(a) * rg.speed, r: 5, dmg: rg.dmg * (1 + S.t * D.stage.dmgGrowth), life: 2.5 });
        }
      }
      e.x += mx * sp * dt; e.y += my * sp * dt;
    }
    e.x += e.kvx * dt; e.y += e.kvy * dt;
    e.kvx *= decay; e.kvy *= decay;
    const rr = e.r + p.r;
    if (!(e.stunT > S.t) && dist2(e.x, e.y, p.x, p.y) < rr * rr) hurtPlayer((e.boss || e.ai) && e.state === 'charge' ? e.dmg * 1.4 : e.dmg, e.boss && e.def.el || null, e);
    if (S.allies.length && !(e.stunT > S.t)) for (const a of S.allies) { // 撞到随从：随从也会受伤
      if (!a.gone && dist2(e.x, e.y, a.x, a.y) < (e.r + a.def.r) ** 2) hurtAlly(a, (e.boss || e.ai) && e.state === 'charge' ? e.dmg * 1.4 : e.dmg);
    }
    atkEl = null; atkSrc = null;
  }
  // 互相挤开，避免叠成一团
  for (const e of S.enemies) {
    if (e.dead) continue;
    near(e.x, e.y, e.r + 40, n => {
      if (n.id <= e.id) return;
      const dx = n.x - e.x, dy = n.y - e.y, rr = e.r + n.r, d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr || d2 === 0) return;
      const d = Math.sqrt(d2), ov = (rr - d) * 0.5, ux = dx / d, uy = dy / d;
      const w = x => x.building ? 0 : x.boss ? 0.05 : x.ai ? 0.3 : 1; // 据点推不动，武将和精英很难推
      const we = w(e), wn = w(n), tw = we + wn;
      if (!tw) return;
      e.x -= ux * ov * (we / tw) * 2; e.y -= uy * ov * (we / tw) * 2;
      n.x += ux * ov * (wn / tw) * 2; n.y += uy * ov * (wn / tw) * 2;
    });
  }
}

// 据点：玩家靠近时派兵、箭楼放箭；离得太远就撤掉，之后在附近重新出现
function updateBuilding(e, dt) {
  const p = S.player, d = Math.sqrt(dist2(e.x, e.y, p.x, p.y)), def = e.def;
  e.kvx = e.kvy = 0;
  if (def.tomb) { // 疑冢：真冢偶尔冒一口黑气（看仔细了能认出来）
    if (e.tomb && e.tomb.real && Math.random() < dt * 0.9) smoke(e.x + rand(-8, 8), e.y - e.r * 1.6, 2, '30,12,46', 10, 14, 0.8);
    return;
  }
  if (def.special) { // 乔府：不会因为走远而消失；有名将在场时府门紧闭；走近了才动手
    e.sealed = S.bossList.length > 0;
    if (e.sealed || d > def.aggroR) return;
    if (!e.woke) { e.woke = true; toast('building', e.bid, def.wake ? def.wake[0] : `${def.name}警觉`, def.wake ? def.wake[1] : '守军出动'); }
  }
  if (d > 2600 && !def.special) { e.dead = true; return; }
  if (d > 750) return;
  if (def.guard && !e.guarded) { e.guarded = true; spawnElite(def.guard, e.x + 60, e.y + 40); }
  if (def.spawn) {
    e.spawnT -= dt;
    if (e.spawnT <= 0) {
      e.spawnT = def.spawn.every;
      const alive = S.enemies.filter(x => x.home === e.id && !x.dead).length;
      if (alive < def.spawn.max) {
        const a = rand(0, TAU);
        const m = spawnEnemy(def.spawn.type, e.x + Math.cos(a) * (e.r + 20), e.y + Math.sin(a) * (e.r + 20));
        m.home = e.id;
      }
    }
  }
  if (def.shoot && d < def.shoot.range) {
    e.shootT -= dt;
    if (e.shootT <= 0) {
      e.shootT = def.shoot.cd;
      const a = angleTo(e.x, e.y - 30, p.x, p.y), n = def.shoot.count || 1, sh = def.shoot;
      for (let i = 0; i < n; i++) { // 乔府：一次放出一扇莲灯
        const b = a + (n > 1 ? (i / (n - 1) - 0.5) * sh.spread : 0);
        S.eproj.push({ kind: sh.lantern ? 'lantern' : sh.soul ? 'wisp' : undefined, wrgb: sh.soul ? D.elements.dark.rgb : undefined, x: e.x, y: e.y - 30, vx: Math.cos(b) * sh.speed, vy: Math.sin(b) * sh.speed, r: sh.lantern || sh.soul ? 9 : 5, dmg: sh.dmg * (1 + S.t * D.stage.dmgGrowth), life: 2.5 }); // 孤冢：放出紫色的鬼火
      }
    }
  }
}

// ============ 随从 ============
// temp：{ life, dmg } 临时随从（黄巾号令），不占名额，到时散去
function addAllies(type, n, temp) {
  const p = S.player;
  let added = 0;
  for (let i = 0; i < n; i++) {
    if (!temp && S.allies.filter(a => !a.until).length >= D.allyCap) break;
    const a = rand(0, TAU), ox = temp && temp.x !== undefined ? temp.x : p.x, oy = temp && temp.y !== undefined ? temp.y : p.y; // 死士从坟里 / 倒下的敌人身上爬出来
    const x = ox + Math.cos(a) * (ox === p.x ? 40 : 14), y = oy + Math.sin(a) * (ox === p.x ? 40 : 14);
    const mh = allyMaxHp(D.allies[type]);
    S.allies.push({ id: nextId++, type, def: D.allies[type], x, y, cdT: rand(0, 0.5), fx: 1, moving: false, until: temp ? S.t + temp.life : 0, dmg: temp ? temp.dmg : 0, hp: mh, maxHp: mh, hitT: -99, iT: 0, flash: 0, fromDark: !!(temp && temp.fromDark), born: S.t });
    if (temp) smoke(x, y - 10, 3, D.allies[type].shade ? '40,16,60' : '200,170,80', 10, 8, 0.5);
    added++;
  }
  if (temp) return added;
  if (added < n) { // 随从满员：改为强化全体随从
    S.allyPower += 0.15 * (n - added);
    toast('', '', '随从已满员', `全体随从伤害 +${Math.round(15 * (n - added))}%`);
  }
  S.buildDirty = true;
  return added;
}
// 随从血量：随等级和随从强化成长
const allyMaxHp = def => Math.round(def.hp * (1 + (S.player.level - 1) * D.allyHp.perLv) * (1 + S.allyPower));
// 随从挨打：短暂无敌，打空就战死
function hurtAlly(a, amount) {
  if (a.gone || S.t < a.iT) return;
  a.hp -= amount; a.iT = S.t + 0.5; a.hitT = S.t; a.flash = 0.12;
  addNumber(a.x, a.y - a.def.h * 0.6, '-' + Math.round(amount), '#9cc4ff', 11);
  if (a.hp <= 0) {
    a.gone = true;
    smoke(a.x, a.y - 10, 4, '40,40,60', 10, 10, 0.6);
    for (let i = 0; i < 4; i++) particle(a.x, a.y - 12, a.def.look.robe, 180);
    addNumber(a.x, a.y - a.def.h - 6, '阵亡', '#9cc4ff', 13);
  }
}
function updateAllies(dt) {
  for (const a of S.allies) if (a.until && S.t > a.until) {
    a.gone = true; smoke(a.x, a.y - 10, 3, a.def.shade ? '40,16,60' : '200,170,80', 10, 8, 0.5);
    const DL = a.def.shade && elStats('dark');
    if (DL && DL.blast) { hitCircle(a.x, a.y, DL.blast * S.player.areaMul, a.dmg * 3, 140); soulBurst(a.x, a.y, DL.blast); } // 幽冥觉醒「冢中枯骨」：死士散去时炸开
  }
  if (S.allies.some(a => a.gone)) { S.allies = S.allies.filter(a => !a.gone); S.buildDirty = true; }
  const p = S.player, n = S.allies.length, AH = D.allyHp;
  for (const a of S.allies) { // 升级后血量上限跟着涨；一段时间没挨打慢慢回血
    const mh = allyMaxHp(a.def);
    if (mh !== a.maxHp) { a.hp *= mh / a.maxHp; a.maxHp = mh; }
    if (S.t - a.hitT > AH.regenDelay) a.hp = Math.min(a.maxHp, a.hp + a.maxHp * AH.regen * dt);
    a.flash = Math.max(0, a.flash - dt);
  }
  const power = (1 + (p.level - 1) * 0.06) * (1 + S.allyPower);
  S.allies.forEach((a, i) => {
    const d = a.def;
    // 太远就传送回身边
    if (dist2(a.x, a.y, p.x, p.y) > 600 * 600) { a.x = p.x + rand(-40, 40); a.y = p.y + rand(-40, 40); }
    // 找附近的敌人（在自己 220 内、且离玩家不太远）
    let tgt = null, best = Infinity;
    near(a.x, a.y, d.kind === 'ranged' ? d.range : 220, e => {
      if (e.building && d.kind !== 'ranged') { /* 近战随从也打据点 */ }
      const dd = dist2(a.x, a.y, e.x, e.y);
      if (dd < best && dist2(e.x, e.y, p.x, p.y) < 380 * 380) { best = dd; tgt = e; }
    });
    let gx, gy;
    if (tgt) {
      const dist = Math.sqrt(best), reach = d.kind === 'ranged' ? d.range * 0.85 : d.range + tgt.r;
      if (dist > reach) { gx = tgt.x; gy = tgt.y; }
      a.cdT -= dt;
      if (dist <= reach + 4 && a.cdT <= 0) {
        a.cdT = d.cd;
        const ang = angleTo(a.x, a.y, tgt.x, tgt.y);
        if (d.kind === 'ranged') {
          S.proj.push({ kind: 'arrow', x: a.x, y: a.y - 10, vx: Math.cos(ang) * 560, vy: Math.sin(ang) * 560, r: 5, dmg: d.dmg * power, pierce: 1, life: 0.9, hit: new Set(), kb: 50, ally: true });
        } else {
          hitEnemy(tgt, a.dmg || d.dmg * power, { kb: 90, kbAngle: ang, noEl: true });
          S.effects.push({ kind: 'thrust', x: a.x, y: a.y - 10, a: ang, len: d.range + 14, w: 16, life: 0.14, max: 0.14, rgb: '170,210,255' });
        }
        a.fx = Math.cos(ang) >= 0 ? 1 : -1;
      }
    } else { // 没敌人：回到玩家身边的站位
      const slot = i / Math.max(1, n) * TAU + 0.6, rr = 58 + (i % 2) * 22;
      gx = p.x + Math.cos(slot) * rr; gy = p.y + Math.sin(slot) * rr;
    }
    a.moving = false;
    if (gx !== undefined) {
      const dx = gx - a.x, dy = gy - a.y, dd = Math.hypot(dx, dy);
      if (dd > 6) {
        const sp = d.speed * (dd > 200 ? 1.5 : 1);
        a.x += dx / dd * Math.min(dd, sp * dt); a.y += dy / dd * Math.min(dd, sp * dt);
        a.moving = true;
        if (Math.abs(dx) > 3) a.fx = dx > 0 ? 1 : -1;
      }
    }
  });
}

// ============ 弹道 / 区域 ============
function updateProjectiles(dt) {
  const p = S.player;
  for (const b of S.proj) {
    b.life -= dt;
    if (b.life <= 0) { b.dead = true; continue; }
    if (b.homing) {
      if (!b.target || b.target.dead) b.target = pickTarget(b.x, b.y, D.aim.orbSeek);
      if (b.target) b.a += clamp(angDiff(b.a, angleTo(b.x, b.y, b.target.x, b.target.y)), -6 * dt, 6 * dt);
      b.vx = Math.cos(b.a) * b.speed; b.vy = Math.sin(b.a) * b.speed;
    }
    if (b.boom) { // 双铁戟：飞到最远处后折返，回程重新计算命中
      b.spin += dt * 18;
      if (b.out) {
        b.travel += b.speed * dt;
        if (b.travel >= b.range) { b.out = false; b.hit.clear(); }
      } else {
        const a = angleTo(b.x, b.y, p.x, p.y);
        b.vx = Math.cos(a) * b.speed * 1.15; b.vy = Math.sin(a) * b.speed * 1.15;
        if (dist2(b.x, b.y, p.x, p.y) < 24 * 24) { b.dead = true; continue; }
      }
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    // 拖尾
    if (b.spin !== undefined && !b.boom) b.spin += dt * (b.kind === 'page' ? 4 : 6);
    if (b.curl) { b.a += b.curl * dt; b.vx = Math.cos(b.a) * b.speed; b.vy = Math.sin(b.a) * b.speed; } // 花扇的花瓣：打着旋飞出去
    if (b.kind === 'petal' && Math.random() < 0.3) fxp({ type: 'petal', x: b.x, y: b.y, vx: -b.vx * 0.1, vy: -b.vy * 0.1 + 10, drag: 2, life: 0.55, rgb: '255,180,215', size: rand(3, 4.5), rot: rand(0, TAU), spin: rand(-6, 6), seed: rand(0, 9) });
    else if (b.el) { if (Math.random() < 0.5) elTrail(b); }
    else if (b.kind === 'orb' && Math.random() < 0.6) fxp({ type: 'ember', x: b.x, y: b.y, vx: rand(-15, 15), vy: rand(-15, 15), drag: 3, life: 0.35, rgb: '140,240,200', size: rand(5, 8) });
    else if (b.kind === 'butterfly' && Math.random() < 0.3) fxp({ type: 'ember', x: b.x, y: b.y, vx: rand(-15, 15), vy: rand(-15, 15), drag: 3, life: 0.4, rgb: b.rgb || '210,170,255', size: rand(4, 7) });
    else if (b.kind === 'wisp' && Math.random() < 0.4) fxp({ type: 'ember', x: b.x, y: b.y, vx: rand(-10, 10), vy: rand(-40, -15), drag: 2, life: 0.4, rgb: '110,240,200', size: rand(5, 8) });
    else if (b.kind === 'lantern' && Math.random() < 0.3) fxp({ type: 'ember', x: b.x, y: b.y - 6, vx: 0, vy: rand(-30, -10), drag: 2, life: 0.5, rgb: '255,200,130', size: rand(4, 7) });
    else if (b.kind === 'bean' && Math.random() < 0.4) fxp({ type: 'ember', x: b.x, y: b.y, vx: rand(-10, 10), vy: rand(-20, 0), drag: 3, life: 0.3, rgb: '255,210,90', size: rand(4, 6) });
    else if (b.kind === 'fire') {
      fxp({ type: 'ember', x: b.x + rand(-3, 3), y: b.y + rand(-3, 3), vx: rand(-20, 20), vy: rand(-40, -10), drag: 2, life: 0.4, rgb: Math.random() < 0.5 ? '255,140,50' : '255,210,100', size: rand(6, 10) });
      if (Math.random() < 0.15) smoke(b.x, b.y, 1, '50,40,30', 5, 2, 0.5);
    } else if (b.kind === 'crescent' && Math.random() < 0.35) fxp({ type: 'ember', x: b.x + rand(-b.r, b.r) * 0.5, y: b.y + rand(-b.r, b.r) * 0.5, vx: -b.vx * 0.1, vy: -b.vy * 0.1, drag: 3, life: 0.35, rgb: '130,240,185', size: rand(6, 10) });
    near(b.x, b.y, b.r + 48, e => {
      if (b.dead || b.hit.has(e.id)) return;
      if (dist2(b.x, b.y, e.x, e.y) < (e.r + b.r) ** 2) {
        b.hit.add(e.id);
        if (b.blast) { // 羽扇火球：命中后爆炸
          const R = b.blast;
          near(b.x, b.y, R + 48, o => { if (dist2(b.x, b.y, o.x, o.y) < (R + o.r) ** 2) hitEnemy(o, b.dmg, { kb: 120, kbAngle: angleTo(b.x, b.y, o.x, o.y), quiet: true, el: b.el || null }); });
          S.effects.push({ kind: 'blast', x: b.x, y: b.y, r: R, life: 0.34, max: 0.34, rgb: b.el ? D.elements[b.el].rgb : b.rgb });
          if (b.el) elBurst(b.el, b.x, b.y, R * 1.6);
          if (b.kind === 'bean') { sparks(b.x, b.y, 0, 10, '255,220,120', R * 6, Math.PI, 2.2); embers(b.x, b.y, 8, '255,200,90', R * 2, 30, 7, 0.5); }
          else if (b.kind === 'page') { pages(b.x, b.y, 6, R * 3, 6); sparks(b.x, b.y, 0, 8, '255,225,160', R * 5, Math.PI, 2); }
          else if (b.kind === 'wisp') { fxTex('burst', b.x, b.y, { w: R * 2, h: R * 2, rgb: '110,240,200', life: 0.3, grow: 1.3, rot: rand(0, TAU), core: 0.2 }); }
          else if (b.kind === 'lantern') { // 莲灯：炸开一团水光；同心莲灯每炸一盏回一点血
            waterSplash(b.x, b.y, R);
            if (b.heal) { p.hp = Math.min(p.maxHp, p.hp + p.maxHp * b.heal); embers(p.x, p.y - 10, 4, '140,240,200', 50, 60, 6, 0.6); }
          }
          else explosion(b.x, b.y, R, false);
          b.dead = true;
          return;
        }
        hitEnemy(e, b.dmg, { kb: b.kb, kbAngle: Math.atan2(b.vy, b.vx), el: b.el || null });
        if (--b.pierce <= 0) b.dead = true;
      }
    });
  }
  S.proj = S.proj.filter(b => !b.dead);

  for (const h of S.hazards) { // 诸葛亮火攻落点
    h.t -= dt;
    if (h.t <= 0) {
      if (h.chainDrop && canBind() && dist2(h.x, h.y, p.x, p.y) < (h.r + p.r) ** 2) { S.rootT = Math.max(S.rootT, S.t + h.root); addNumber(p.x, p.y - 44, '被铁链锁住 · 闪现挣脱', '#ff9ab0', 16); } // 魔王暴政：从天而降的铁链
      if (dist2(h.x, h.y, p.x, p.y) < (h.r + p.r) ** 2) {
        const was = p.iframes;
        hurtPlayer(h.dmg, h.el || null, h);
        if (h.ice && !was) S.pChillT = Math.max(S.pChillT, S.t + 1.6);
      }
      for (const a of S.allies) if (!a.gone && dist2(h.x, h.y, a.x, a.y) < (h.r + a.def.r) ** 2) hurtAlly(a, h.dmg); // 落点也会砸到随从
      if (h.el) elBurst(h.el, h.x, h.y - 6, h.r * 1.3); // 属性名将的落点：炸开属性爆光
      S.effects.push({ kind: 'blast', x: h.x, y: h.y, r: h.r, life: 0.4, max: 0.4, enemy: true, rgb: h.rgb });
      fxTex('ring', h.x, h.y, { w: h.r * 2, h: h.r * 2, rgb: h.rgb || '255,140,60', under: true, life: 0.35, grow: 1.6, core: 0.4 });
      if (h.chainDrop) { darkBurst(h.x, h.y, h.r); S.shake = Math.max(S.shake, 6); h.dead = true; continue; }
      if (h.petal || h.ice || h.page || h.water || h.kite || h.wisp) { // 女将的落点：樱花绽开 / 冰棱破地 / 书页炸散 / 水花 / 纸鸢
        fxTex('burst', h.x, h.y - h.r * 0.2, { w: h.r * 2.2, h: h.r * 2.2, rgb: h.rgb, life: 0.35, grow: 1.4, rot: rand(0, TAU), core: 0.25, a: 0.55 });
        if (h.petal) petals(h.x, h.y - 10, 14, h.r * 3);
        else if (h.ice) {
          shards(h.x, h.y - 10, 12, h.r * 4);
          S.decals.push({ kind: 'frost', x: h.x, y: h.y, r: h.r, life: 2, max: 2 });
          if (S.decals.length > 16) S.decals.shift();
        } else if (h.water) waterSplash(h.x, h.y, h.r);
        else if (h.wisp) for (let i = 0; i < 8; i++) fxp({ type: 'ember', x: h.x + rand(-h.r, h.r) * 0.4, y: h.y - 10, vx: rand(-60, 60), vy: rand(-200, -80), drag: 1.5, life: 0.7, rgb: h.rgb || '110,240,200', size: rand(8, 14) }); // 鬼火窜起
        else if (h.kite) for (let i = 0; i < 6; i++) fxp({ type: 'fly', x: h.x, y: h.y - 12, vx: rand(-180, 180), vy: rand(-200, 40), drag: 2.4, life: 0.8, rgb: '215,180,255', size: rand(5, 8), rot: rand(-0.5, 0.5), seed: rand(0, 9) });
        else { pages(h.x, h.y - 10, 10, h.r * 3); glint(h.x, h.y - 10, h.r * 0.8, '255,215,140', 0.25); }
        h.dead = true;
        continue;
      }
      if (h.pillar) fxTex('pillar', h.x, h.y - 150, { w: h.r * 1.5, h: 340, rgb: h.rgb, life: 0.4, sx: 0.35, core: 0.7 }); // 天上落下的光柱
      if (h.bolt) { // 雷击：天上劈下一道闪电
        S.effects.push({ kind: 'bolt', pts: zigzag([[h.x + rand(-50, 50), h.y - 380], [h.x, h.y]], 18), life: 0.28, max: 0.28, rgb: '200,220,255', w: 6 });
        fxTex('bolt', h.x, h.y - 200, { w: 110, h: 420, rgb: '190,215,255', life: 0.26, core: 0.8, fadeIn: 0.02 });
        fxTex('burst', h.x, h.y, { w: h.r * 2.2, h: h.r * 2.2, rgb: '170,200,255', life: 0.25, grow: 1.3, rot: rand(0, TAU) });
        sparks(h.x, h.y, -Math.PI / 2, 12, '220,235,255', 460, Math.PI, 2.4);
        S.decals.push({ kind: 'crack', x: h.x, y: h.y, lines: FX.makeCrack(h.r * 0.7), life: 1.2, max: 1.2 });
        if (S.decals.length > 12) S.decals.shift();
        S.shake = Math.max(S.shake, 6);
      }
      else if (h.rgb && h.rgb.startsWith('170')) { groundImpact(h.x, h.y, h.r, '130,140,150'); for (let i = 0; i < 6; i++) particle(h.x, h.y, '#8a9098', 300); } // 石阵：碎石
      else {
        explosion(h.x, h.y, h.r, true);
        const fire = !h.rgb || /^255,1[0-6]\d/.test(h.rgb); // 火攻：落点窜起一簇火焰
        fxTex('burst', h.x, h.y - h.r * 0.2, { w: h.r * 2.4, h: h.r * 2.4, rgb: h.rgb || '255,140,60', life: 0.3, grow: 1.4, rot: rand(0, TAU) });
        if (fire) fxTex('flame', h.x, h.y - h.r * 0.9, { w: h.r * 1.5, h: h.r * 3, life: 0.6, grow: 1.15 });
      }
      if (h.burn) S.ezones.push({ x: h.x, y: h.y, r: h.r * 0.75, life: 3.5, max: 3.5, dmg: h.dmg * 0.2, tick: 0.45, tt: 0, rgb: '255,110,40' }); // 铁索连环：落点留下大火
      h.dead = true;
    }
  }
  if (S.hazards.some(h => h.dead)) { sfx('slam'); S.hazards = S.hazards.filter(h => !h.dead); }

  for (const b of S.eproj) {
    b.life -= dt;
    if (b.ret) { // 典韦的双戟：飞到最远处后折回本人手中
      b.spin += dt * 16;
      const sp = Math.hypot(b.vx, b.vy);
      if (!b.ret.back) { b.ret.travel += sp * dt; if (b.ret.travel >= b.ret.range) b.ret.back = true; }
      else {
        const o = b.ret.boss;
        if (o.dead) { b.dead = true; continue; }
        const a = angleTo(b.x, b.y, o.x, o.y);
        b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
        if (dist2(b.x, b.y, o.x, o.y) < 30 * 30) { b.dead = true; continue; }
      }
    }
    if (b.wait > 0) { b.wait -= dt; if (b.wait <= 0) { b.vx = b.lvx; b.vy = b.lvy; } }
    if (b.seek) { const sp = Math.hypot(b.vx, b.vy), a0 = Math.atan2(b.vy, b.vx), a = a0 + clamp(angDiff(a0, angleTo(b.x, b.y, p.x, p.y)), -b.seek * dt, b.seek * dt); b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp; } // 鬼火：慢慢拐弯追你
    if (b.kind === 'butterfly') { const sp = Math.hypot(b.vx, b.vy), a = Math.atan2(b.vy, b.vx) + Math.sin(S.t * 9 + b.spin) * 2.6 * dt; b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp; } // 蝴蝶：飞得一扭一扭
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.spinRate) b.spin += b.spinRate * dt;
    if (b.homeIn) { // 兵书万卷：书页朝圈心收拢，过了圈心再飞一小段就散
      if (dist2(b.x, b.y, b.homeIn.x, b.homeIn.y) < 30 * 30 && !b.passed) { b.passed = true; b.life = Math.min(b.life, 0.35); }
    }
    if (b.kind === 'petal' && Math.random() < 0.25) fxp({ type: 'petal', x: b.x, y: b.y, vx: -b.vx * 0.1, vy: -b.vy * 0.1 + 10, drag: 2, life: 0.6, rgb: '255,175,210', size: rand(3, 5), rot: rand(0, TAU), spin: rand(-6, 6), seed: rand(0, 9) });
    else if (b.kind === 'icicle' && Math.random() < 0.25) fxp({ type: 'snow', x: b.x, y: b.y, vx: 0, vy: 10, drag: 2, life: 0.5, size: rand(2.5, 4), rot: rand(0, TAU), spin: 2 });
    if (b.kind === 'dragon' && Math.random() < 0.9) fxp({ type: 'ember', x: b.x + rand(-b.r, b.r) * 0.6, y: b.y + rand(-b.r, b.r) * 0.6, vx: -b.vx * 0.15, vy: -b.vy * 0.15, drag: 2, life: 0.5, rgb: '110,240,170', size: rand(8, 14) });
    if (b.el && Math.random() < 0.45) elTrail(b);
    if (S.allies.length) { // 敌方飞弹也会打中随从
      const a = S.allies.find(a => !a.gone && dist2(b.x, b.y, a.x, a.y) < (b.r + a.def.r) ** 2);
      if (a) { hurtAlly(a, b.dmg); if (!b.pierce) { b.dead = true; continue; } }
    }
    if (b.kind === 'bigArrow' && Math.random() < 0.4) fxp({ type: 'ember', x: b.x, y: b.y, vx: 0, vy: 0, drag: 2, life: 0.25, rgb: b.rgb, size: 6 });
    if (dist2(b.x, b.y, p.x, p.y) < (b.r + p.r) ** 2) {
      const was = p.iframes;
      hurtPlayer(b.dmg, b.el || null, b);
      if (b.chill && !was) S.pChillT = Math.max(S.pChillT, S.t + b.chill); // 冰棱：打中就被冻得走不快
      if (!b.pierce) {
        b.dead = true;
        if (b.kind === 'petal') petals(b.x, b.y, 5, 100); else if (b.kind === 'icicle') shards(b.x, b.y, 4, 160, 6); else if (b.kind === 'page') pages(b.x, b.y, 3, 120, 5);
      }
    }
    if (b.life <= 0) b.dead = true;
  }
  S.eproj = S.eproj.filter(b => !b.dead);

  for (const z of S.ezones) { // 敌方火焰地带（赤兔踏过的火）
    z.life -= dt; z.tt -= dt;
    if (z.ice) { if (Math.random() < 0.08) fxp({ type: 'snow', x: z.x + rand(-z.r, z.r) * 0.6, y: z.y + rand(-z.r, z.r) * 0.4, vx: 0, vy: rand(-25, -10), drag: 1, life: 0.6, size: rand(3, 5), rot: rand(0, TAU), spin: 2 }); }
    else if (Math.random() < 0.35) fxp({ type: 'ember', x: z.x + rand(-z.r, z.r) * 0.6, y: z.y + rand(-z.r, z.r) * 0.4, vx: rand(-10, 10), vy: rand(-60, -30), drag: 1, life: 0.45, rgb: Math.random() < 0.5 ? '255,120,40' : '255,190,80', size: rand(5, 9) });
    if (z.tt <= 0 && dist2(z.x, z.y, p.x, p.y) < (z.r + p.r) ** 2) { z.tt = z.tick; hurtPlayer(z.dmg, z.el || null, z); if (z.ice) S.pChillT = Math.max(S.pChillT, S.t + 1); }
  }
  S.ezones = S.ezones.filter(z => z.life > 0);

  for (const r of S.erings) { // 周瑜的琴音：碰到环（缺口除外）受伤一次
    r.r += r.speed * dt;
    if (!r.hit) {
      const d = Math.sqrt(dist2(r.x, r.y, p.x, p.y));
      if (Math.abs(d - r.r) < 12 + p.r && Math.abs(angDiff(r.gapA, angleTo(r.x, r.y, p.x, p.y))) > r.gap) { r.hit = true; hurtPlayer(r.dmg, r.el || null, r); }
    }
    if (r.r > r.maxR) r.dead = true;
  }
  S.erings = S.erings.filter(r => !r.dead);

  for (const z of S.zones) {
    z.life -= dt; z.tt -= dt;
    if (z.water) { // 春江：站在莲池里持续回血
      const p = S.player;
      if (z.heal && dist2(z.x, z.y, p.x, p.y) < z.r * z.r) { p.hp = Math.min(p.maxHp, p.hp + z.heal * dt); if (Math.random() < 0.15) embers(p.x, p.y - 10, 1, '140,240,200', 30, 40, 5, 0.6); }
      if (Math.random() < 0.08) S.decals.push({ kind: 'water', x: z.x + rand(-0.6, 0.6) * z.r, y: z.y + rand(-0.4, 0.4) * z.r, r: rand(20, 36), life: 1, max: 1 });
    }
    if (z.fire && Math.random() < 0.8) { // 火烧赤壁：火中不断窜起火苗
      const a = rand(0, TAU), rr = z.r * Math.sqrt(Math.random());
      fxp({ type: 'ember', x: z.x + Math.cos(a) * rr, y: z.y + Math.sin(a) * rr * 0.8, vx: rand(-10, 10), vy: rand(-80, -40), drag: 1, life: rand(0.35, 0.7), rgb: Math.random() < 0.5 ? '255,130,50' : '255,200,90', size: rand(6, 11) });
    }
    if (z.formation && Math.random() < 0.5) { // 八阵图：阵中缓缓升起的金色光点
      const a = rand(0, TAU), rr = z.r * Math.sqrt(Math.random());
      fxp({ type: 'ember', x: z.x + Math.cos(a) * rr, y: z.y + Math.sin(a) * rr, vx: 0, vy: rand(-45, -20), drag: 0.5, life: rand(0.6, 1), rgb: '255,215,120', size: rand(4, 7) });
    }
    if (z.tt <= 0) {
      z.tt = z.tick;
      near(z.x, z.y, z.r + 48, e => {
        if (dist2(z.x, z.y, e.x, e.y) < (z.r + e.r) ** 2) {
          if (z.slow < 1) { e.slowT = S.t + 0.5; e.slowF = z.slow; }
          hitEnemy(e, z.dmg, { quiet: true });
          if (z.ice && Math.random() < 0.15) shards(e.x, e.y, 2, 90, 5);
          else if (!z.formation && !z.fire && !z.ice && !z.water && Math.random() < 0.5) sparks(e.x, e.y + e.r * 0.4, -Math.PI / 2, 2, '220,225,235', 220, 0.9, 1.6); // 扎脚的火星
        }
      });
    }
  }
  S.zones = S.zones.filter(z => z.life > 0);
}

// 闪电折线：在每两点之间插入抖动的小折点
function zigzag(pts, jag) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 26));
    for (let k = 1; k < n; k++) out.push([x0 + (x1 - x0) * k / n + rand(-jag, jag), y0 + (y1 - y0) * k / n + rand(-jag, jag)]);
    out.push([x1, y1]);
  }
  return out;
}
// 玩家的延迟打击：地公符落石、天雷、火烧赤壁的火船
function updateStrikes(dt) {
  for (const s of S.strikes) {
    s.t -= dt;
    if (s.t > 0) continue;
    s.dead = true;
    if (s.kind === 'fire') { // 火船落地，燃起一片大火
      const L = s.L;
      S.zones.push({ id: nextId++, fire: true, x: s.x, y: s.y, r: s.r, dmg: L.dmg, tick: L.tick, tt: 0, life: L.life, max: L.life, slow: 1 });
      S.effects.push({ kind: 'blast', x: s.x, y: s.y, r: s.r, life: 0.4, max: 0.4, rgb: '255,130,50' });
      explosion(s.x, s.y, s.r * 0.6, false);
      continue;
    }
    near(s.x, s.y, s.r + 48, e => { if (dist2(s.x, s.y, e.x, e.y) < (s.r + e.r) ** 2) hitEnemy(e, s.dmg, { kb: s.kind === 'rock' ? 160 : 60, kbAngle: angleTo(s.x, s.y, e.x, e.y), quiet: true, el: s.el || null }); });
    if (s.el) elBurst(s.el, s.x, s.y - 8, s.r * 1.4);
    if (s.kind === 'rock') {
      groundImpact(s.x, s.y, s.r, '140,120,90');
      for (let i = 0; i < 7; i++) particle(s.x, s.y - 6, i % 2 ? '#7a6a58' : '#5a4e42', 320);
      S.effects.push({ kind: 'blast', x: s.x, y: s.y, r: s.r, life: 0.3, max: 0.3, rgb: '220,190,130' });
      S.shake = Math.max(S.shake, 3);
    } else { // 天雷
      S.effects.push({ kind: 'bolt', pts: zigzag([[s.x + rand(-40, 40), s.y - 340], [s.x, s.y]], 16), life: 0.24, max: 0.24, rgb: '180,210,255', w: 5 });
      fxTex('bolt', s.x, s.y - 180, { w: 90, h: 380, rgb: '255,235,150', life: 0.22, core: 0.8, fadeIn: 0.02 });
      fxTex('ring', s.x, s.y, { w: s.r * 1.4, h: s.r * 1.4, rgb: '170,200,255', under: true, life: 0.3, grow: 1.6 });
      S.effects.push({ kind: 'blast', x: s.x, y: s.y, r: s.r * 0.7, life: 0.18, max: 0.18, rgb: '120,160,255' });
      sparks(s.x, s.y, -Math.PI / 2, 10, '210,230,255', 420, Math.PI, 2.2);
      S.shake = Math.max(S.shake, 2.5);
    }
  }
  if (S.strikes.some(s => s.dead)) { if (S.strikes.some(s => s.dead && s.kind === 'rock')) sfx('slam'); S.strikes = S.strikes.filter(s => !s.dead); }
}

// 爆炸：火光闪一下 + 火星四溅 + 黑烟
function explosion(x, y, R, enemy) {
  sparks(x, y, 0, 10, '255,170,80', R * 6, Math.PI, 2.4);
  embers(x, y, 10, enemy ? '255,110,50' : '255,170,70', R * 2.2, 30, 9, 0.6);
  smoke(x, y - 4, 4, '40,32,24', R * 0.3, R * 0.3, 0.8);
}

function updateFx(dt) {
  for (const f of S.effects) f.life -= dt;
  S.effects = S.effects.filter(f => f.life > 0);
  for (const f of S.teles) f.life -= dt;
  S.teles = S.teles.filter(f => f.life > 0);
  for (const f of S.decals) f.life -= dt;
  S.decals = S.decals.filter(f => f.life > 0);
  for (const gh of S.ghosts) gh.life -= dt;
  S.ghosts = S.ghosts.filter(gh => gh.life > 0);
  S.hurtFlash = Math.max(0, S.hurtFlash - dt);
  if (S.sflash) { S.sflash.life -= dt; if (S.sflash.life <= 0) S.sflash = null; }
  for (const n of S.numbers) { n.life -= dt; n.y -= (n.float || 40) * dt; }
  S.numbers = S.numbers.filter(n => n.life > 0);
  for (const q of S.particles) {
    q.life -= dt;
    const k = Math.exp(-(q.drag !== undefined ? q.drag : 4) * dt);
    q.vx *= k; q.vy *= k;
    if (q.g) q.vy += q.g * dt;
    q.x += q.vx * dt; q.y += q.vy * dt;
    if (q.grow) q.size += q.grow * dt;
    if (q.spin) q.rot += q.spin * dt;
  }
  S.particles = S.particles.filter(q => q.life > 0);
}

// ============ 神兵 ============
// 悬浮在玩家身边，定时自动放出名将的招牌招式（缩小版）
const later = (sec, fn) => S.later.push({ t: S.t + sec, fn });
const sbDmg = (def, sb) => def.dmg * (1 + 0.3 * (sb.lv - 1)) * (1 + S.player.level * 0.035);
// 敌人最密集的地方：随机抽一些附近的敌人，看谁身边的敌人最多
function densest(R) {
  const p = S.player, pool = [];
  near(p.x, p.y, R, e => { if (!e.building && dist2(p.x, p.y, e.x, e.y) < R * R) pool.push(e); });
  if (!pool.length) return null;
  let best = pool[0], bc = -1;
  for (let k = 0; k < Math.min(24, pool.length); k++) {
    const c = pool[Math.floor(Math.random() * pool.length)];
    let n = 0; near(c.x, c.y, 130, o => { if (dist2(c.x, c.y, o.x, o.y) < 130 * 130) n += o.boss ? 5 : o.ai ? 2 : 1; });
    if (n > bc) { bc = n; best = c; }
  }
  return best;
}
// 范围伤害的几种形状
function hitCircle(x, y, R, dmg, kb, stun) {
  near(x, y, R + 48, e => {
    if (dist2(x, y, e.x, e.y) >= (R + e.r) ** 2) return;
    if (stun && !e.boss && !e.building) e.stunT = S.t + stun;
    hitEnemy(e, dmg, { kb, kbAngle: angleTo(x, y, e.x, e.y), quiet: true });
  });
}
function hitWedge(x, y, a, R, half, dmg, kb) {
  near(x, y, R + 48, e => { if (inWedge(e.x, e.y, x, y, a, R, half, e.r)) hitEnemy(e, dmg, { kb, kbAngle: angleTo(x, y, e.x, e.y), quiet: true }); });
}
function hitLine(x, y, a, len, w, dmg, kb) {
  near(x + Math.cos(a) * len / 2, y + Math.sin(a) * len / 2, len / 2 + 48, e => { if (segDist(e.x, e.y, x, y, a, len) < w / 2 + e.r) hitEnemy(e, dmg, { kb, kbAngle: a, quiet: true }); });
}
function castShenbing(sb) {
  const def = D.shenbing[sb.gid], p = S.player, rgb = def.rgb, dmg = sbDmg(def, sb);
  const tgt = densest(460);
  if (!tgt) return false;
  const a = angleTo(p.x, p.y, tgt.x, tgt.y);
  sb.flash = 0.45; sb.aim = { x: tgt.x, y: tgt.y };
  switch (def.type) {
    case 'slam': { // 开山神斧：飞到敌群上空劈下
      const x = tgt.x, y = tgt.y;
      fxTex('circle', x, y, { w: def.radius * 2.2, h: def.radius * 2.2, rgb, under: true, life: 0.5, spin: 3, a: 0.7 });
      later(0.35, () => {
        hitCircle(x, y, def.radius, dmg, 260, def.stun);
        fxTex('pillar', x, y - 150, { w: def.radius, h: 340, rgb, life: 0.35, sx: 0.3, core: 0.7 });
        impact(x, y, def.radius * 0.9, rgb, 0.9); groundImpact(x, y, def.radius); sfx('slam');
      });
      break;
    }
    case 'rocks': // 地公幡：巨石落下
      for (let i = 0; i < def.count; i++) { const e = densest(460) || tgt; S.strikes.push({ kind: 'rock', x: e.x + rand(-30, 30), y: e.y + rand(-30, 30), r: def.radius, t: 0.5 + i * 0.1, max: 0.5 + i * 0.1, dmg }); }
      break;
    case 'thunder': { // 太平九节杖：天雷
      const pool = []; near(p.x, p.y, 460, e => { if (!e.building) pool.push(e); });
      pool.sort((x, y) => y.maxHp - x.maxHp);
      for (let i = 0; i < def.count; i++) { const e = pool[i % pool.length]; S.strikes.push({ kind: 'bolt', x: e.x, y: e.y, r: def.radius, t: 0.05 + i * 0.08, max: 0.12, dmg }); }
      break;
    }
    case 'whirl': // 赤血斩将刀：绕身狂舞
      S.sbWhirl = { until: S.t + def.dur, R: def.radius, dmg, tick: 0, rgb };
      sfx('swing');
      break;
    case 'crescent': // 无双方天戟：血色巨月
      hitWedge(p.x, p.y, a, def.R, def.half, dmg, 300);
      fxTex('slash', p.x + Math.cos(a) * def.R * 0.6, p.y - 16 + Math.sin(a) * def.R * 0.6, { w: def.R * 1.5, h: def.R * 0.7, rot: a + Math.PI / 2, rgb, life: 0.45, grow: 1.12, core: 0.6 });
      impact(p.x + Math.cos(a) * def.R * 0.5, p.y + Math.sin(a) * def.R * 0.5, def.R * 0.35, rgb, 1);
      screenFlash(rgb, 0.15); sfx('slam');
      break;
    case 'jis': // 恶来双铁戟：八方飞戟再飞回
      for (let i = 0; i < def.count; i++) {
        const b = i / def.count * TAU;
        S.proj.push({ kind: 'boom', x: p.x, y: p.y, vx: Math.cos(b) * 460, vy: Math.sin(b) * 460, speed: 460, r: 16, dmg, pierce: 9999, life: 4, hit: new Set(), kb: 140, boom: true, out: true, travel: 0, range: def.range, spin: 0 });
      }
      fxTex('whirl', 0, 0, { follow: p, oy: -14, w: 200, h: 200, rgb, life: 0.4, spin: 9, grow: 1.4 });
      sfx('swing');
      break;
    case 'cleave3': // 河北斩旗刀：连斩三刀
      for (let k = 0; k < 3; k++) later(k * 0.18, () => {
        const t2 = nearest(p.x, p.y, def.R + 80) || tgt, b = angleTo(p.x, p.y, t2.x, t2.y) + (k - 1) * 0.35;
        hitWedge(p.x, p.y, b, def.R, def.half, dmg, 200);
        fxTex('slash', p.x + Math.cos(b) * def.R * 0.6, p.y - 16 + Math.sin(b) * def.R * 0.6, { w: def.R * 1.5, h: def.R * 0.7, rot: b + Math.PI / 2, rgb, life: 0.3, grow: 1.1, core: 0.55 });
        punch(0.3); sfx('swing');
      });
      break;
    case 'bolts': // 延津连弩：扇形光箭
      for (let i = 0; i < def.count; i++) {
        const b = a + (i / (def.count - 1) - 0.5) * def.spread;
        S.proj.push({ kind: 'arrow', glow: rgb, x: p.x, y: p.y - 10, vx: Math.cos(b) * 720, vy: Math.sin(b) * 720, r: 7, dmg, pierce: 3, life: 0.9, hit: new Set(), kb: 80 });
      }
      fxTex('burst', p.x + Math.cos(a) * 30, p.y - 10 + Math.sin(a) * 30, { w: 120, h: 120, rgb, life: 0.25, grow: 1.5 });
      sfx('swing');
      break;
    case 'dragon': // 青龙偃月刀：巨大的青龙
      S.proj.push({ kind: 'crescent', x: p.x, y: p.y, a, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, r: def.r, dmg, pierce: 9999, life: 1.4, hit: new Set(), kb: 200, seed: rand(0, 9) });
      fxTex('slash', p.x + Math.cos(a) * 70, p.y - 16 + Math.sin(a) * 70, { w: 260, h: 130, rot: a + Math.PI / 2, rgb, life: 0.35, grow: 1.2 });
      punch(0.4); sfx('slam');
      break;
    case 'firelines': { // 七星羽扇：敌群里三排大火
      const ux = Math.cos(a), uy = Math.sin(a), L = { dmg, tick: 0.4, life: 4 };
      for (let row = -1; row <= 1; row++) for (let k = -2; k <= 2; k++) {
        const x = tgt.x + ux * row * 110 - uy * k * 80, y = tgt.y + uy * row * 110 + ux * k * 80;
        S.strikes.push({ kind: 'fire', x, y, r: def.radius, t: 0.35 + (row + 1) * 0.2, max: 0.35 + (row + 1) * 0.2, L });
      }
      break;
    }
    case 'lance': // 丈八蛇矛：长枪芒 + 怒吼
      hitLine(p.x, p.y, a, def.len, def.w, dmg, 260);
      fxTex('thrust', p.x + Math.cos(a) * def.len * 0.5, p.y - 16 + Math.sin(a) * def.len * 0.5, { w: def.len * 1.1, h: def.w * 1.6, rot: a, rgb, life: 0.35, sx: 1.2, core: 0.7 });
      punch(0.4); sfx('swing');
      later(0.3, () => {
        hitCircle(p.x, p.y, def.roar, dmg * 0.4, 200, def.stun);
        fxTex('ring', p.x, p.y, { w: def.roar * 0.6, h: def.roar * 0.6, rgb: '255,245,220', life: 0.45, grow: 3.4, core: 0.4 });
        sfx('slam');
      });
      break;
    case 'flurry': // 龙胆亮银枪：七道枪芒追着敌人刺
      for (let k = 0; k < def.count; k++) later(k * 0.07, () => {
        const e = nearest(p.x, p.y, def.len + 40);
        if (!e) return;
        const b = angleTo(p.x, p.y, e.x, e.y) + rand(-0.15, 0.15);
        hitLine(p.x, p.y, b, def.len, 34, dmg, 80);
        fxTex('thrust', p.x + Math.cos(b) * def.len * 0.5, p.y - 16 + Math.sin(b) * def.len * 0.5, { w: def.len * 1.1, h: 40, rot: b, rgb, life: 0.16, sx: 1.15, core: 0.8 });
      });
      sfx('swing');
      break;
    case 'blossom': { // 倾城花扇：樱花旋转着飞出；身边的敌人被迷住
      const off = rand(0, TAU);
      for (let i = 0; i < def.count; i++) {
        const b = off + i / def.count * TAU;
        later(i * 0.02, () => S.proj.push({ kind: 'petal', x: p.x, y: p.y - 12, a: b, speed: 380, vx: Math.cos(b) * 380, vy: Math.sin(b) * 380, r: 10, dmg, pierce: 3, life: 1.1, hit: new Set(), kb: 60, spin: rand(0, TAU), curl: 2.4 }));
      }
      hitCircle(p.x, p.y, def.radius, dmg * 0.5, 40, def.stun);
      fxTex('ring', p.x, p.y, { w: def.radius * 0.5, h: def.radius * 0.5, rgb, life: 0.5, grow: 4, core: 0.4 });
      petals(p.x, p.y - 14, 30, def.radius * 2);
      sfx('swing');
      break;
    }
    case 'icespikes': { // 洛神寒笛：敌人脚下破冰而出的冰棱
      const pool = []; near(p.x, p.y, 460, e => { if (!e.building) pool.push(e); });
      pool.sort((x, y) => y.maxHp - x.maxHp);
      for (let i = 0; i < def.count && pool.length; i++) {
        const e = i < pool.length ? pool[i] : pool[Math.floor(Math.random() * pool.length)], x = e.x, y = e.y;
        S.decals.push({ kind: 'frost', x, y, r: def.radius, life: 1.6, max: 1.6 });
        later(0.25 + i * 0.07, () => {
          hitCircle(x, y, def.radius, dmg, 60, def.stun);
          for (let k = 0; k < 5; k++) fxTex('thrust', x + rand(-def.radius, def.radius) * 0.5, y - 26 + rand(-10, 10), { w: rand(70, 110), h: 30, rot: -Math.PI / 2 + rand(-0.35, 0.35), rgb, life: 0.45, sx: 1.25, core: 0.7 });
          shards(x, y - 10, 10, def.radius * 3);
          sfx('slam');
        });
      }
      fxTex('ring', p.x, p.y, { w: 120, h: 120, rgb, life: 0.4, grow: 2.2 });
      break;
    }
    case 'fans': { // 枭姬铁扇：六把铁扇四面飞出再飞回，再撒一阵书页
      for (let i = 0; i < def.count; i++) {
        const b = i / def.count * TAU;
        S.proj.push({ kind: 'boom', fan: true, x: p.x, y: p.y, vx: Math.cos(b) * 480, vy: Math.sin(b) * 480, speed: 480, r: 16, dmg, pierce: 9999, life: 4, hit: new Set(), kb: 140, boom: true, out: true, travel: 0, range: def.range, spin: 0 });
      }
      for (let i = 0; i < 4; i++) {
        const b = rand(0, TAU);
        S.proj.push({ kind: 'page', x: p.x, y: p.y - 10, a: b, speed: 320, vx: 0, vy: 0, r: 9, dmg: dmg * 0.8, pierce: 1, life: 3, hit: new Set(), homing: true, target: null, kb: 80, blast: 60, rgb, seed: rand(0, 9), spin: rand(0, TAU) });
      }
      pages(p.x, p.y - 16, 10, 160);
      sfx('swing');
      break;
    }
    case 'sonic': { // 周郎焦尾琴：三圈音波 + 三处火焰
      for (let k = 0; k < def.rings; k++) later(k * 0.25, () => S.rings.push({ x: p.x, y: p.y, r: 20, maxR: def.ringR, speed: 440, dmg, hit: new Set(), rgb: '255,190,150', core: '255,245,235', w: 12, kb: 100 }));
      const pool = []; near(p.x, p.y, 420, e => { if (!e.building) pool.push(e); });
      for (let i = 0; i < def.fire && pool.length; i++) { const e = pool[Math.floor(Math.random() * pool.length)]; S.strikes.push({ kind: 'fire', x: e.x, y: e.y, r: 80, t: 0.4 + i * 0.12, max: 0.4 + i * 0.12, L: { dmg: dmg * 0.25, tick: 0.4, life: 3.5 } }); }
      break;
    }
    case 'gather': { // 魔王缚魂锁：铁链钩住最强的几个敌人，拖到一处撞在一起，再炸开黑色冲击
      const pool = []; near(p.x, p.y, 460, e => { if (!e.building && !e.dead) pool.push(e); });
      pool.sort((x, y) => y.maxHp - x.maxHp);
      const cx = tgt.x, cy = tgt.y;
      for (const e of pool.slice(0, def.count)) {
        S.effects.push({ kind: 'chainfx', x0: p.x, y0: p.y - 16, tgt: e, life: 0.45, max: 0.45 });
        if (!e.boss) { e.kvx += (cx - e.x) * 8; e.kvy += (cy - e.y) * 8; if (!e.ai) e.stunT = Math.max(e.stunT || 0, S.t + 0.4); }
      }
      later(0.35, () => {
        hitCircle(cx, cy, def.radius, dmg, 80, def.stun);
        darkBurst(cx, cy, def.radius);
        S.shake = Math.max(S.shake, 7); punch(0.3);
        sfx('slam');
      });
      sfx('swing');
      break;
    }
    case 'lanterns': { // 同心莲灯：几盏莲灯飘向敌人，炸开水光，每炸一盏给你回一点血
      for (let i = 0; i < def.count; i++) {
        const b = rand(0, TAU);
        S.proj.push({ kind: 'lantern', x: p.x + Math.cos(b) * 20, y: p.y - 14, a: b, speed: 240, vx: 0, vy: 0, r: 11, dmg, pierce: 1, blast: def.radius, heal: def.heal, life: 4, hit: new Set(), homing: true, target: null, kb: 60, spin: rand(0, TAU) });
      }
      glint(p.x, p.y - 20, 30, '255,220,160', 0.25);
      break;
    }
    case 'spiritCavalry': { // 虎头湛金枪：三队铁骑英灵从敌群中间穿阵而过
      const a = angleTo(p.x, p.y, tgt.x, tgt.y), ux = Math.cos(a), uy = Math.sin(a);
      for (let k = 0; k < def.count; k++) { const off = (k - (def.count - 1) / 2) * def.w; spiritRiders(tgt.x - uy * off - ux * def.len / 2, tgt.y + ux * off - uy * def.len / 2, a, 2, def.len, def.w, dmg, 1300, 0); }
      S.effects.push({ kind: 'bolt', pts: zigzag([[p.x, p.y - 30], [tgt.x, tgt.y - 10]], 18), life: 0.25, max: 0.25, rgb: '190,215,255', w: 4 });
      sfx('swing');
      break;
    }
    case 'eyeCleave': { // 血眼战刀：敌群上空睁开一只血眼，随后巨刀十字劈下
      const x = tgt.x, y = tgt.y;
      S.bloodEyes.push({ x, y: y - 130, t: 0, T: 0.75, s: 30 });
      later(0.55, () => {
        for (const a of [Math.PI / 4, -Math.PI / 4]) {
          const sx = x - Math.cos(a) * def.len / 2, sy = y - Math.sin(a) * def.len / 2;
          near(x, y, def.len / 2 + 48, e => { if (!e.building && !e.boss && segDist(e.x, e.y, sx, sy, a, def.len) < def.w / 2 + e.r) e.stunT = Math.max(e.stunT || 0, S.t + def.stun); });
          hitLine(sx, sy, a, def.len, def.w, dmg, 200);
          fxTex('thrust', x, y - 10, { w: def.len * 1.1, h: def.w * 1.6, rot: a, rgb, life: 0.32, sx: 1.2, core: 0.8 });
        }
        impact(x, y, 90, rgb, 0.8); groundImpact(x, y, 120); S.shake = Math.max(S.shake, 7); sfx('slam');
      });
      break;
    }
    case 'tombDrop': { // 冢虎墓碑：几块黑石墓碑砸进敌群，立一会儿再炸出鬼火
      const pool = []; near(p.x, p.y, 460, e => { if (!e.building && !e.dead) pool.push(e); });
      for (let i = 0; i < def.count; i++) {
        const o = i && pool.length ? pool[Math.floor(Math.random() * pool.length)] : tgt;
        S.steles.push({ x: o.x + rand(-18, 18), y: o.y + rand(-12, 12), t: 0, drop: 0.35 + i * 0.1, nova: def.nova, r: def.radius * p.areaMul, dmg, stun: def.stun, state: 'fall' });
      }
      break;
    }
    case 'chessStrike': { // 鬼才棋局：敌群脚下摆开棋盘，两种颜色的格子轮流炸开鬼火
      S.boards.push({ x: tgt.x, y: tgt.y, n: def.n, cell: def.cell * p.areaMul, rounds: 2, round: 0, tele: 0.45, gap: 0.12, t: 0.45, state: 'warn', parity: 0, dmg, hostile: false, born: S.t });
      break;
    }
    case 'butterflies': { // 流光蝶钗：一群流光蝶追咬敌人
      for (let i = 0; i < def.count; i++) {
        const b = i / def.count * TAU;
        later(i * 0.03, () => S.proj.push({ kind: 'butterfly', x: p.x, y: p.y - 12, a: b, speed: 380, vx: 0, vy: 0, r: 9, dmg, pierce: 2, life: 2.6, hit: new Set(), homing: true, target: null, kb: 40, spin: rand(0, TAU), rgb }));
      }
      for (let i = 0; i < 8; i++) fxp({ type: 'fly', x: p.x, y: p.y - 16, vx: rand(-140, 140), vy: rand(-180, -40), drag: 2, life: 0.8, rgb: '215,180,255', size: rand(4, 7), rot: 0, seed: rand(0, 9) });
      break;
    }
  }
  return true;
}
function updateShenbing(dt) {
  const p = S.player;
  for (const sb of S.shenbing) {
    sb.flash = Math.max(0, sb.flash - dt);
    sb.t -= dt;
    if (sb.t > 0) continue;
    const def = D.shenbing[sb.gid];
    sb.t = castShenbing(sb) ? def.cd * Math.pow(0.94, sb.lv - 1) * p.cdMul : 0.3;
  }
  if (S.sbWhirl) { // 赤血斩将刀：绕身狂舞
    const W2 = S.sbWhirl;
    W2.tick -= dt;
    if (W2.tick <= 0) {
      W2.tick = 0.15;
      hitCircle(p.x, p.y, W2.R, W2.dmg, 120);
      fxTex('whirl', 0, 0, { follow: p, oy: -12, w: W2.R * 2.4, h: W2.R * 2.4, rgb: W2.rgb, life: 0.2, spin: 8, flat: 0.6, a: 0.85 });
    }
    if (S.t > W2.until) S.sbWhirl = null;
  }
  // 延迟执行的招式片段（连斩、怒吼、落斧……）
  if (S.later.length) {
    const due = S.later.filter(l => S.t >= l.t);
    if (due.length) { S.later = S.later.filter(l => S.t < l.t); for (const l of due) l.fn(); }
  }
}
// 神兵悬浮在玩家身后两侧，上下浮动；出招时放大、发光
function drawShenbing() {
  const p = S.player, n = S.shenbing.length;
  S.shenbing.forEach((sb, i) => {
    const def = D.shenbing[sb.gid], side = n === 1 ? -1 : (i % 2 ? 1 : -1), row = Math.floor(i / 2);
    const x = p.x + side * (38 + row * 22), y = p.y - 46 - row * 18 + Math.sin(S.t * 2.4 + i * 1.7) * 5;
    const f = sb.flash / 0.45, s = 34 * (1 + 0.35 * f);
    ctx.globalCompositeOperation = 'lighter';
    FX.glow(ctx, x, y, s * (1.1 + 0.15 * Math.sin(S.t * 5 + i)), def.rgb, 0.35 + 0.5 * f);
    FX.glow(ctx, x, y, s * 0.5, '255,240,200', 0.25 + 0.5 * f);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    const img = window.Assets.get('shenbing:' + sb.gid);
    ctx.save(); ctx.translate(x, y); ctx.rotate(side * 0.25 + Math.sin(S.t * 1.8 + i) * 0.08);
    if (img) { const w = s * 1.5, h = w * img.naturalHeight / img.naturalWidth; ctx.drawImage(img, -w / 2, -h / 2, w, h); }
    else { // 还没有神兵美术图：金圈里放这位名将兵器的图标
      const ic = window.Assets.get('icon:' + def.iconFrom), r = s * 0.42;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.closePath();
      ctx.fillStyle = '#1c140a'; ctx.fill();
      if (ic) { ctx.save(); ctx.clip(); ctx.drawImage(ic, -r, -r, r * 2, r * 2); ctx.restore(); }
      else { ctx.fillStyle = '#ffd75a'; ctx.font = `900 ${Math.round(r * 1.2)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(def.icon, 0, 1); }
      ctx.strokeStyle = '#ffd75a'; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.restore();
  });
}

// ============ 主更新 ============
function update(dt) {
  S.t += dt;
  director(dt);
  updatePlayer(dt);
  gridBuild();
  updateWeapons(dt);
  updateSkills(dt);
  updateShenbing(dt);
  updateEnemies(dt);
  updateElements(dt);
  gridBuild();
  updateAllies(dt);
  updateProjectiles(dt);
  updateBossFx(dt); // 董卓的铁链、大乔的莲灯和潮水、小乔的纸鸢和蝶环、蝶影分身
  S.enemies = S.enemies.filter(e => !e.dead);
  updatePickups(dt);
  updateFx(dt);
  const p = S.player, k = Math.min(1, dt * 10);
  S.camX += (p.x - S.camX) * k;
  S.camY += (p.y - S.camY) * k;
  if (S.pendingReward) {
    S.pendingReward.t -= dt;
    if (S.pendingReward.t <= 0) { S.rewardReady = S.pendingReward.gid; S.rewardLegend = S.pendingReward.legend; S.pendingReward = null; }
  }
  if (S.rankUp) { banner(`晋升 · ${S.rankUp}`, `Lv ${p.level}`); S.rankUp = null; }
  S.saveT -= dt; if (S.saveT <= 0) { S.saveT = 15; saveRun(); } // 每 15 秒自动存档
  // 选择栏不暂停游戏：有待选的升级 / 斩将奖励 / 铁匠铺时，在屏幕上方弹出
  if (!S.over && !S.choice && (S.rewardReady || S.forgeReady || S.pendingLevels > 0)) nextModal();
}

// ============ 升级 / 武将奖励 ============
function defOf(kind, id) {
  return kind === 'weapon' ? D.weapons[id] : kind === 'skill' ? D.skills[id] : kind === 'passive' ? D.passives[id] : kind === 'shenbing' ? D.shenbing[id] : kind === 'element' ? D.elements[id] : null;
}
function maxLv(kind, def) { return kind === 'passive' ? def.max : kind === 'shenbing' ? 99 : def.levels.length; }
function ownedLv(kind, id) {
  if (kind === 'weapon') { const w = S.weapons.find(x => x.id === id); return w ? w.lv : 0; }
  if (kind === 'skill') { const s = S.skills.find(x => x.id === id); return s ? s.lv : 0; }
  if (kind === 'element') return S.elements[id] || 0;
  return S.passives[id] || 0;
}
function kindOf(id) { return D.weapons[id] ? 'weapon' : D.skills[id] ? 'skill' : D.elements[id] ? 'element' : 'passive'; }
const healOpt = () => ({ kind: 'heal', name: '庆功酒', icon: '酒', amount: 50 });

function pickWeighted(pool, n) {
  const out = [];
  pool = pool.slice();
  while (out.length < n && pool.length) {
    let r = Math.random() * pool.reduce((s, o) => s + o.w, 0), i = 0;
    for (; i < pool.length - 1; i++) { r -= pool[i].w; if (r <= 0) break; }
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}
// 出身专精：和出身对口的武器、物品出现得更频繁（书生的技能升级也更常见）
const FOCUS_MUL = 2.6;
function focusMul(def, kind) {
  const f = S.origin.focus;
  if ((def.tags || []).includes(f)) return FOCUS_MUL;
  if (kind === 'skill' && f === 'spell') return 1.6;
  return 1;
}
function levelOptions() {
  const pool = [];
  // 没有等级上限：满级后继续出现“突破”选项，权重略低
  for (const w of S.weapons) { const d = D.weapons[w.id]; pool.push({ kind: 'weapon', id: w.id, cur: w.lv, w: (w.lv < d.levels.length ? 3.6 : 1.8) * focusMul(d, 'weapon') }); }
  for (const s of S.skills) { const d = D.skills[s.id]; pool.push({ kind: 'skill', id: s.id, cur: s.lv, w: (s.lv < d.levels.length ? 3.5 : 2) * focusMul(d, 'skill') }); }
  // 别的出身的起手武器（锄头、猎弓、竹简）和专精物品刷不到
  const otherStart = new Set(D.origins.filter(o => o.id !== S.origin.id).map(o => o.weapon));
  if (S.weapons.length < D.player.weaponSlots) {
    for (const id in D.weapons) { const d = D.weapons[id]; if (d.common && !otherStart.has(id) && !S.weapons.some(w => w.id === id)) pool.push({ kind: 'weapon', id, cur: 0, w: 2 * focusMul(d, 'weapon') }); }
  }
  const ownedPassives = Object.keys(S.passives).filter(id => !D.passives[id].unique).length;
  for (const id in D.passives) {
    const def = D.passives[id];
    if (def.unique || (def.origin && def.origin !== S.origin.id)) continue;
    const lv = S.passives[id] || 0;
    if (!lv && ownedPassives >= D.player.passiveSlots) continue;
    pool.push({ kind: 'passive', id, cur: lv, w: (!lv ? 1.0 : lv < def.max ? 2.0 : 0.8) * focusMul(def, 'passive') });
  }
  // 属性：冰火雷风，Lv 3 起出现，每种最高 5 级；已经修了的更容易接着出现
  if (S.player.level >= D.elementFrom) {
    for (const id in D.elements) {
      const lv = S.elements[id] || 0;
      if (D.elements[id].hidden && !lv) continue; // 隐藏属性（幽冥）：要先从司马懿那里学会
      if (lv < D.elements[id].levels.length) pool.push({ kind: 'element', id, cur: lv, w: lv ? 2.2 : 1.3 });
    }
  }
  const res = pickWeighted(pool, 3);
  // 保证至少有一张武器或技能：物品种类多，不保底的话兵器容易一直升不上去
  const arms = pool.filter(o => (o.kind === 'weapon' || o.kind === 'skill') && !res.includes(o));
  if (res.length === 3 && arms.length && !res.some(o => o.kind === 'weapon' || o.kind === 'skill')) res[2] = pickWeighted(arms, 1)[0];
  if (!res.length) res.push(healOpt());
  return res;
}
function rewardOptions(gid, legend) {
  const opts = D.generals[gid].rewards.map(id => {
    const kind = kindOf(id), def = defOf(kind, id), lv = ownedLv(kind, id);
    if (def.unique && lv >= def.max) return healOpt();
    if (kind === 'element' && lv >= def.levels.length) return healOpt(); // 幽冥已经修满
    return { kind, id, cur: lv, gen: true };
  });
  if (legend) { const sb = S.shenbing.find(x => x.gid === gid); opts.unshift({ kind: 'shenbing', id: gid, cur: sb ? sb.lv : 0, legend: true }); } // 金色神兵卡放在最前面
  return opts;
}

function nextModal() {
  if (S.over) return;
  if (S.rewardReady) { const gid = S.rewardReady; S.rewardReady = null; openChoices('reward', gid, S.rewardLegend); S.rewardLegend = false; return; }
  if (S.forgeReady > 0) { S.forgeReady--; openChoices('forge'); return; }
  if (S.pendingLevels > 0) { S.pendingLevels--; openChoices('level'); return; }
}

function openChoices(mode, gid, legend) {
  const p = S.player;
  const opts = mode === 'reward' ? rewardOptions(gid, legend)
    : mode === 'forge' ? pickWeighted(S.weapons.map(w => ({ kind: 'weapon', id: w.id, cur: w.lv, w: 1 })), 3)
    : levelOptions();
  S.choice = { mode, gid, opts };
  $('lu-portrait').hidden = mode !== 'reward';
  if (mode === 'reward') {
    const g = D.generals[gid];
    $('lu-portrait').innerHTML = window.Portrait.html('general', gid, { crop: true });
    $('lu-title').textContent = `斩获 · ${g.name}`;
    $('lu-sub').textContent = '武将遗物，夺取其一（不暂停，边打边选）';
  } else if (mode === 'forge') {
    $('lu-title').textContent = '铁匠铺 · 重铸兵器';
    $('lu-sub').textContent = '任选一件武器，强化 +1 级';
  } else {
    $('lu-title').textContent = `升级 · Lv ${p.level}`;
    $('lu-sub').textContent = `${rankOf(p.level)} · 按 1/2/3 或点选（不暂停）${S.pendingLevels ? ` · 还有 ${S.pendingLevels} 次` : ''}`;
    sfx('level');
  }
  const box = $('lu-cards');
  box.innerHTML = '';
  opts.forEach((o, i) => box.appendChild(makeCard(o, i)));
  box.style.setProperty('--n', opts.length);
  $('levelup').classList.toggle('legend', !!legend);
  box.style.pointerEvents = 'none';
  setTimeout(() => { box.style.pointerEvents = ''; }, 320);
  $('lu-crit').innerHTML = critLine();
  $('levelup').hidden = false;
}
// 属性卡上的具体数值
function elementLine(id, lv) {
  const L = D.elements[id].levels[lv - 1], pc = v => Math.round(v * 100) + '%';
  if (id === 'fire') return `每秒灼烧 = 命中伤害的 ${pc(L.burn)}，持续 ${L.dur} 秒`;
  if (id === 'ice') return `减速 ${pc(L.slow)} · 冻住几率 ${pc(L.freeze)}`;
  if (id === 'thunder') return `引雷几率 ${pc(L.chance)} · 跳 ${L.jumps} 个 · 每跳 ${pc(L.pct)} 伤害`;
  if (id === 'dark') return `印记增伤 ${pc(L.vuln)} · 化作死士 ${pc(L.raise)} · 最多 ${L.max} 个`;
  return `风刃伤害 +${pc(L.dmg)} · 击退 +${pc(L.kb)} · 穿透 +${L.pierce}${L.gust ? ` · 旋风每 ${L.gust.every} 秒` : ''}`;
}
// 当前暴击率与暴击伤害（选择栏右上角）
const critLine = () => `暴击 <b>${Math.round(S.player.crit * 100)}%</b> · 爆伤 <b>${Math.round(S.player.critMul * 100)}%</b>`;

const KIND_LABEL = { weapon: '武器', skill: '技能', passive: '物品' };
function makeCard(o, i) {
  const btn = document.createElement('button');
  btn.className = 'card' + (o.gen ? ' gen' : '');
  let icon, name, kind, lvl, desc, sealCls = '';
  if (o.kind === 'heal') {
    icon = o.icon; name = o.name; kind = '补给'; lvl = `回复 ${o.amount} 生命`; desc = '此物已臻化境，换一壶庆功酒。';
  } else if (o.kind === 'element') { // 属性：冰火雷风，卡片带属性色
    const def = D.elements[o.id], L = def.levels;
    btn.className = `card el el-${o.id}`; sealCls = ` el el-${o.id}`;
    icon = window.Assets.icon('el_' + o.id, def.icon, def.name); name = def.name;
    kind = (def.hidden ? '隐藏属性' : '属性') + (o.cur + 1 >= L.length ? ' · 觉醒' : '');
    lvl = o.cur ? `Lv ${o.cur} → ${o.cur + 1}` : '新属性';
    desc = (o.cur ? L[o.cur].note : def.desc) + `<br><b class="eln">${elementLine(o.id, o.cur + 1)}</b>`;
    const others = Object.keys(S.elements).filter(id => id !== o.id && S.elements[id] > 0).map(id => D.elements[id].name);
    if (!o.cur && others.length) desc += `<br>与${others.join('、')}并存，每次出手随机其一`;
  } else if (o.kind === 'shenbing') { // 神兵：金色卡
    const def = D.shenbing[o.id];
    btn.className = 'card legend';
    icon = sbIconHtml(o.id); name = def.name; kind = `神兵 · ${D.generals[o.id].name}专属`;
    lvl = o.cur ? `Lv ${o.cur} → ${o.cur + 1} · 伤害 +30%` : '神兵现世 · 悬浮身边';
    desc = `${def.desc}（每 ${def.cd} 秒一次）`;
  } else {
    const def = defOf(o.kind, o.id);
    icon = window.Assets.icon(o.id, def.icon, def.name); name = def.name;
    kind = KIND_LABEL[o.kind] + (def.general ? ` · ${def.general}遗物` : '');
    if (o.kind === 'passive') sealCls = ' passive';
    if (o.cur === 0) { lvl = '新获得'; desc = def.desc; }
    else {
      const brk = o.cur >= maxLv(o.kind, def);
      lvl = `Lv ${o.cur} → ${o.cur + 1}${brk ? ' · 突破' : ''}`;
      if (o.kind === 'passive') desc = brk ? `${def.desc}（突破后效果减半）` : def.desc;
      else desc = brk ? breakNote(def, o.cur + 1) : def.levels[o.cur].note;
    }
    if ((def.tags || []).includes(S.origin.focus)) kind += ` · ${S.origin.focusName}`;
    // 暴击类物品：直接写出选了之后的暴击率 / 爆伤
    const ef = o.kind === 'passive' && def.effects, p = S.player, k = o.cur >= def.max ? 0.5 : 1;
    if (ef && ef.crit) desc += `<br><b class="crit">暴击 ${Math.round(p.crit * 100)}% → ${Math.round(Math.min(0.75, p.crit + ef.crit * k) * 100)}%</b>`;
    if (ef && ef.critMul) desc += `<br><b class="crit">爆伤 ${Math.round(p.critMul * 100)}% → ${Math.round((p.critMul + ef.critMul * k) * 100)}%</b>`;
  }
  btn.innerHTML = `<span class="key">${i + 1}</span>
    <div class="top"><div class="seal${sealCls}">${icon}</div><div><div class="nm">${name}</div><div class="kind">${kind}</div></div></div>
    <div class="lvl">${lvl}</div><div class="ds">${desc}</div>`;
  // 手机上一根手指按着移动、另一根手指点卡时，浏览器往往不发 click，
  // 所以触屏直接在“手指抬起”时选中；鼠标和键盘照常用 click。每张卡只生效一次。
  const pick = () => { if (btn.dataset.done) return; btn.dataset.done = '1'; applyChoice(o); };
  btn.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') btn.dataset.pid = e.pointerId; });
  btn.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse' && btn.dataset.pid === String(e.pointerId)) pick(); });
  btn.addEventListener('pointercancel', () => { delete btn.dataset.pid; });
  btn.addEventListener('click', pick);
  return btn;
}

function applyChoice(o) {
  const p = S.player;
  if (o.kind === 'heal') {
    p.hp = Math.min(p.maxHp, p.hp + o.amount);
  } else if (o.kind === 'shenbing') { // 神兵入手：金光冲天
    const sb = S.shenbing.find(x => x.gid === o.id);
    if (sb) sb.lv++; else S.shenbing.push({ gid: o.id, lv: 1, t: 1.2, flash: 0 });
    fxTex('pillar', 0, 0, { follow: p, oy: -120, w: 110, h: 360, rgb: '255,215,90', life: 1.0, sx: 0.5, core: 0.8 });
    fxTex('circle', 0, 0, { follow: p, oy: 8, w: 240, h: 240, rgb: '255,205,80', under: true, flat: 0.55, life: 1.4, spin: 2 });
    banner(`神兵 · ${D.shenbing[o.id].name}`, sb ? `升至 Lv ${sb.lv}` : '悬于身侧，随你征战');
    sfx('win');
  } else if (o.kind === 'weapon') {
    const w = S.weapons.find(x => x.id === o.id);
    if (w) w.lv++; else S.weapons.push({ id: o.id, lv: 1, t: 0.2 });
  } else if (o.kind === 'skill') {
    const s = S.skills.find(x => x.id === o.id);
    if (s) s.lv++; else S.skills.push({ id: o.id, lv: 1, t: 1.5 });
  } else if (o.kind === 'element') {
    const def = D.elements[o.id];
    S.elements[o.id] = Math.min(def.levels.length, (S.elements[o.id] || 0) + 1);
    if (S.elements[o.id] === def.levels.length) banner(`${def.name} · 觉醒`, def.awaken);
    else if (def.hidden && S.elements[o.id] === 1) { banner(`隐藏属性 · ${def.name}`, '从此升级时也能修炼幽冥'); screenFlash(def.rgb, 0.3); }
    fxTex('pillar', 0, 0, { follow: p, oy: -90, w: 80, h: 260, rgb: def.rgb, life: 0.8, sx: 0.5, core: 0.7 });
  } else {
    S.passives[o.id] = (S.passives[o.id] || 0) + 1;
  }
  recomputeStats();
  S.buildDirty = true;
  $('levelup').hidden = true;
  S.choice = null;
  nextModal();
}

// ============ 界面 ============
// 武将登场立绘切入
// 顶部小提示：精英出现、攻破据点等（kind: 'elite' 显示精英头像，'building' 显示建筑字样）
function toast(kind, id, title, sub) {
  const t = $('toast');
  let face = '';
  if (kind === 'elite') face = window.Portrait.html('elite', id, { crop: true });
  else if (kind === 'building') face = `<span class="tico">${D.buildings[id].icon}</span>`;
  $('toast-face').innerHTML = face;
  $('toast-face').hidden = !face;
  $('toast-title').textContent = title;
  $('toast-sub').textContent = sub || '';
  t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
}

function showCutin(gid, title, line) {
  const g = D.generals[gid], c = $('cutin');
  $('cut-art').innerHTML = window.Portrait.html('general', gid);
  $('cut-name').textContent = g.name;
  $('cut-title').textContent = title;
  $('cut-line').textContent = line;
  c.classList.remove('show');
  void c.offsetWidth;
  c.classList.add('show');
}

function banner(main, sub) {
  const b = $('banner');
  b.querySelector('b').textContent = main;
  b.querySelector('span').textContent = sub || '';
  b.classList.remove('show');
  void b.offsetWidth;
  b.classList.add('show');
}

// 神兵图标：有神兵美术图就用图，没有就借用这位名将兵器的图标
function sbIconHtml(gid) {
  const img = window.Assets.get('shenbing:' + gid);
  if (img) return `<img class="ico sb" src="${img.src}" alt="${D.shenbing[gid].name}">`;
  return window.Assets.icon(D.shenbing[gid].iconFrom, D.shenbing[gid].icon, D.shenbing[gid].name);
}
function slotHtml(kind, id, lv) {
  const def = defOf(kind, id);
  if (kind === 'shenbing') return `<div class="slot sb" title="神兵 · ${def.name} Lv${lv}">${sbIconHtml(id)}<i>${lv}</i></div>`;
  if (kind === 'element') return `<div class="slot el el-${id}" title="属性 · ${def.name} Lv${lv}">${window.Assets.icon('el_' + id, def.icon, def.name)}<i>${lv}</i></div>`;
  const cls = kind === 'skill' ? ' skill' : kind === 'passive' ? ' passive' : '';
  const max = maxLv(kind, def);
  const badge = max > 1 ? `<i${lv > max ? ' class="brk"' : ''}>${lv}</i>` : '';
  return `<div class="slot${cls}${def.general ? ' gen' : ''}" title="${def.name} Lv${lv}">${window.Assets.icon(id, def.icon, def.name)}${badge}</div>`;
}
function buildList() {
  const out = [];
  for (const sb of S.shenbing) out.push(['shenbing', sb.gid, sb.lv]);
  for (const w of S.weapons) out.push(['weapon', w.id, w.lv]);
  for (const s of S.skills) out.push(['skill', s.id, s.lv]);
  for (const id in S.passives) out.push(['passive', id, S.passives[id]]);
  for (const id in S.elements) out.push(['element', id, S.elements[id]]);
  return out;
}
function buildChips() {
  return buildList().map(([k, id, lv]) => `<div class="chip">${slotHtml(k, id, lv)}${defOf(k, id).name} Lv${lv}</div>`).join('');
}

function updateHud() {
  const p = S.player;
  $('xpfill').style.width = (p.xp / p.xpNext * 100).toFixed(1) + '%';
  $('lv').textContent = `Lv ${p.level}`;
  $('rank').textContent = rankOf(p.level);
  $('hpfill').style.width = (p.hp / p.maxHp * 100).toFixed(1) + '%';
  $('hptext').textContent = `${Math.ceil(p.hp)} / ${Math.round(p.maxHp)}`;
  $('time').textContent = fmtTime(S.t);
  $('kills').textContent = `斩敌 ${S.kills}`;
  { const left = Math.max(0, S.blinkT - S.t), bb = $('btn-blink'); // 闪现冷却：暗色扇面 + 剩余秒数
    bb.style.setProperty('--cd', (left / (S.player.blinkCd || D.blink.cd)).toFixed(3));
    bb.classList.toggle('ready', left <= 0);
    $('blink-cd').textContent = left > 0 ? left.toFixed(1) : matchMedia('(pointer: coarse)').matches ? '' : '空格'; }
  $('goldhud').textContent = `金 ${loadMeta().gold}（本局 +${S.goldRun}）`;
  const perm = S.allies.filter(a => !a.until).length, lust = Math.floor(S.lust);
  const info = [perm ? `随从 ${perm}/${D.allyCap}` : '', S.blessings.length ? `祝福 ${S.blessings.length}` : '', lust ? `战意 ${lust}` : ''].filter(Boolean);
  $('allies').hidden = !info.length;
  $('allies').textContent = info.join(' · ');
  $('chap').textContent = S.endless ? '天下三分' : chap().name.split(' · ')[1];
  $('tip').hidden = S.t > 10;
  const boss = S.bossList[S.bossList.length - 1];
  $('bossbar').hidden = !boss;
  if (boss) {
    if (S.faceGid !== boss.gid) { S.faceGid = boss.gid; $('bossface').innerHTML = window.Portrait.html('general', boss.gid, { crop: true }); }
    $('bosstitle').textContent = boss.def.title;
    $('bossfill').style.width = Math.max(0, boss.hp / boss.maxHp * 100).toFixed(1) + '%';
    $('bossshield').style.width = (boss.shieldMax ? Math.max(0, boss.shield / boss.shieldMax * 100) : 0).toFixed(1) + '%';
    $('bossname').textContent = boss.def.name + (boss.def.el ? ` · ${D.elements[boss.def.el].icon}` : '') + (boss.vanish ? ' · 藏身疑冢' : boss.vulnT > S.t ? ' · 破甲' : boss.enraged ? ' · 暴怒' : '') + (boss.dr ? ` · 减伤 ${Math.round(boss.dr * 100)}%` : '');
  }
  if (S.buildDirty) {
    S.buildDirty = false;
    $('slots').innerHTML = buildList().map(([k, id, lv]) => slotHtml(k, id, lv)).join('');
  }
}

// ---------- 局外成长：金币与装备（存在本机浏览器里） ----------
let META = null;
function loadMeta() {
  if (META) return META;
  try { META = JSON.parse(localStorage.getItem('buyi-meta')) || null; } catch (e) { META = null; }
  META = Object.assign({ gold: 0, total: 0, gear: {} }, META || {});
  return META;
}
let metaSaveT = 0;
function saveMeta(now) {
  const t = performance.now();
  if (!now && t - metaSaveT < 1500) { clearTimeout(saveMeta.pending); saveMeta.pending = setTimeout(() => saveMeta(true), 1600); return; }
  if (!META || !META._dirty) return; // 只有金币或装备变了才写，避免两个网页互相覆盖
  metaSaveT = t; delete META._dirty; META.at = Date.now(); // at：云存档合并时比新旧用
  try { localStorage.setItem('buyi-meta', JSON.stringify(META)); } catch (e) { /* 存储不可用时忽略 */ }
  cloudDirty();
}
const gearLv = id => loadMeta().gear[id] || 0;
// 装备形态：每一级一个名字；1–3 级普通、4–6 级精良、7–9 级传说（阶段 0 表示还没买）；9 级以后外形不变，名字后面加 +N
const FORM_LV = D.meta.formLv;
const gearForm = lv => Math.min(FORM_LV, lv);
const gearStage = lv => lv ? Math.ceil(gearForm(lv) / 3) : 0;
const gearTierName = (g, lv) => lv ? g.tiers[gearForm(lv) - 1] + (lv > FORM_LV ? ` +${lv - FORM_LV}` : '') : '尚未购买';
function gearIconHtml(g, lv) {
  const img = window.Assets.get(`icon:${g.id}_${Math.max(1, gearForm(lv))}`) || window.Assets.get('icon:' + g.id);
  const name = gearTierName(g, lv);
  return img ? `<img class="ico" src="${img.src}" alt="${name}">` : g.icon;
}
// 本局人物造型：武器阶段 × 护甲阶段（没买过的算第 1 阶段）
function gearLook(originId) {
  const gear = D.meta.gear[originId] || [];
  const w = gear.find(g => g.slot === '武器'), a = gear.find(g => g.slot === '护甲'), c = gear.find(g => g.slot === '饰品');
  return { w: Math.max(1, gearStage(w ? gearLv(w.id) : 0)), a: Math.max(1, gearStage(a ? gearLv(a.id) : 0)), c: c ? gearForm(gearLv(c.id)) : 0 };
}
const gearCost = lv => Math.ceil(D.meta.costBase * Math.pow(D.meta.costGrowth, Math.min(lv, FORM_LV)) * Math.pow(D.meta.lateGrowth, Math.max(0, lv - FORM_LV)) / 5) * 5;
function addGold(v, x, y) {
  const m = loadMeta();
  m.gold += v; m.total += v; S.goldRun += v; m._dirty = true;
  if (x !== undefined) addNumber(x, y - 26, `+金 ${v}`, '#ffd75a', 15);
  saveMeta();
}
function dropGold(x, y, v) { S.pickups.push({ kind: 'gold', x: x + rand(-8, 8), y: y + rand(-8, 8), v, mag: false, vel: 0 }); }
// 开局：把这个出身买过的装备加到本局（起手武器伤害 / 等级、属性加成）
function applyGear() {
  const gear = D.meta.gear[S.origin.id] || [];
  S.startDmg = 0; S.xpMul = 0;
  S.gearLook = gearLook(S.origin.id); // 本局人物造型
  for (const g of gear) {
    const lv = gearLv(g.id); if (!lv) continue;
    for (const k in g.effects) {
      const v = g.effects[k] * lv;
      if (k === 'startDmg') S.startDmg += v;
      else if (k === 'xpMul') S.xpMul += v;
      else S.bonus[k] = (S.bonus[k] || 0) + v;
    }
    if (g.armorEvery) S.bonus.armor = (S.bonus.armor || 0) + Math.floor(lv / g.armorEvery);
    if (g.startLvEvery) { const w = S.weapons.find(x => x.id === S.origin.weapon); if (w) w.lv += Math.floor(lv / g.startLvEvery); }
  }
  recomputeStats();
  const p = S.player; p.hp = p.maxHp;
}

// ---------- 军需商店 ----------
function openShop() {
  renderShop();
  $('title').hidden = true; $('shop').hidden = false;
  $('btn-shop-close').focus();
}
function closeShop() { $('shop').hidden = true; $('title').hidden = false; refreshTitle(); renderOrigins(); }
function gearEffectText(g, lv) {
  if (!lv) return '尚未购买';
  const parts = [];
  for (const k in g.effects) {
    const v = g.effects[k] * lv, pct = x => `${Math.round(x * 1000) / 10}%`;
    parts.push({ startDmg: `起手武器伤害 +${pct(v)}`, maxHp: `生命 +${Math.round(v)}`, regen: `回复 +${v.toFixed(1)}/秒`, speedMul: `移速 +${pct(v)}`,
      crit: `暴击 +${pct(v)}`, critMul: `爆伤 +${pct(v)}`, cdMul: `冷却 ${pct(v)}`, pickupMul: `拾取 +${pct(v)}`, xpMul: `经验 +${pct(v)}` }[k] || '');
  }
  if (g.armorEvery && lv >= g.armorEvery) parts.push(`护甲 +${Math.floor(lv / g.armorEvery)}`);
  if (g.startLvEvery && lv >= g.startLvEvery) parts.push(`开局武器 +${Math.floor(lv / g.startLvEvery)} 级`);
  return parts.join('，');
}
function renderShop() {
  const m = loadMeta();
  $('shop-gold').textContent = `金币 ${m.gold} · 每个出身各有三件专属装备，开局就带着`;
  $('shop-list').innerHTML = D.origins.map(o => `<div class="shop-col"><h3>${o.name}<small>${o.focusName || ''}</small></h3>` +
    D.meta.gear[o.id].map(g => {
      const lv = gearLv(g.id), cost = gearCost(lv), st = gearStage(lv), R = st ? D.meta.rarity[st - 1] : null;
      const nx = `<br>下一级：<b>${gearTierName(g, lv + 1)}</b> · ${gearEffectText(g, lv + 1)}`;
      return `<div class="gear${st ? ' r' + st : ''}"><div class="seal" ${R ? `style="box-shadow: 0 0 0 2px ${R.color}, 0 0 8px ${R.color}"` : ''}>${gearIconHtml(g, lv)}</div>
        <div class="gn">${gearTierName(g, lv)}<small>${g.slot}${R ? ` · <span style="color:${R.color}">${R.name}</span>` : ''} · Lv ${lv}</small></div>
        <button class="buy" data-g="${g.id}" ${m.gold < cost ? 'disabled' : ''}>${lv ? '升级' : '购买'} · 金 ${cost}</button>
        <div class="gd">${g.desc}<br>当前：<b>${gearEffectText(g, lv)}</b>${nx}</div></div>`;
    }).join('') + '</div>').join('');  $('shop-list').querySelectorAll('.buy').forEach(b => b.addEventListener('click', () => buyGear(b.dataset.g)));
}
function buyGear(id) {
  const m = loadMeta(), lv = gearLv(id), cost = gearCost(lv);
  if (m.gold < cost) return;
  m.gold -= cost; m.gear[id] = lv + 1; m._dirty = true; saveMeta(true);
  sfx('level');
  renderShop();
  const b = $('shop-list').querySelector(`[data-g="${id}"]`); if (b) b.focus();
}

// ---------- 存档：自动保存这一局，下次“继续征战” ----------
const RUN_KEY = 'buyi-run';
function snapshot() {
  if (!S || S.over) return null;
  const p = S.player, ch = S.choice;
  return {
    v: 1, saved: Date.now(), origin: S.origin.id, t: S.t, kills: S.kills,
    ch: S.ch, chStart: S.chStart, chapterT: S.chapterT, nextBossOk: S.nextBossOk, evIdx: S.evIdx,
    endless: S.endless, endlessStart: S.endlessStart, endlessT: S.endlessT, lastBoss: S.lastBoss, qiaoDone: !!S.qiaoDone, specialDone: S.specialDone, revived: !!S.revived, adGold: !!S.adGold,
    player: { level: p.level, xp: p.xp, hp: p.hp },
    weapons: S.weapons.map(w => ({ id: w.id, lv: w.lv })), skills: S.skills.map(s => ({ id: s.id, lv: s.lv })),
    passives: S.passives, elements: S.elements, shenbing: S.shenbing.map(s => ({ gid: s.gid, lv: s.lv })),
    bonus: S.bonus, blessings: S.blessings, allies: S.allies.filter(a => !a.until).map(a => a.type), allyPower: S.allyPower,
    defeated: S.defeated, seen: S.seen, sbPity: S.sbPity, goldRun: S.goldRun, startDmg: S.startDmg, xpMul: S.xpMul,
    forgeReady: S.forgeReady + (ch && ch.mode === 'forge' ? 1 : 0),
    pendingLevels: S.pendingLevels + (ch && ch.mode === 'level' ? 1 : 0),
    reward: S.rewardReady || (S.pendingReward && S.pendingReward.gid) || (ch && ch.mode === 'reward' ? ch.gid : null),
    rewardLegend: !!(S.rewardLegend || (S.pendingReward && S.pendingReward.legend) || (ch && ch.mode === 'reward' && $('levelup').classList.contains('legend'))),
    bosses: S.bossList.map(e => ({ gid: e.gid, hp: e.hp / e.maxHp, final: e.final })),
    eliteT: S.eliteT, buildingT: S.buildingT,
  };
}
function saveRun() {
  const snap = snapshot();
  if (!snap) return;
  try { localStorage.setItem(RUN_KEY, JSON.stringify(snap)); } catch (e) { /* 存储不可用时忽略 */ }
}
function loadRun() { try { return JSON.parse(localStorage.getItem(RUN_KEY)) || null; } catch (e) { return null; } }
function clearRun() { try { localStorage.removeItem(RUN_KEY); } catch (e) { /* ignore */ } }
function continueRun() {
  const r = loadRun();
  if (!r) return;
  audio(); joy.on = false;
  newState(r.origin);
  const p = S.player;
  for (const k of ['t', 'kills', 'ch', 'chStart', 'chapterT', 'nextBossOk', 'evIdx', 'endless', 'endlessStart', 'endlessT', 'lastBoss',
    'passives', 'elements', 'bonus', 'blessings', 'allyPower', 'defeated', 'sbPity', 'goldRun', 'startDmg', 'xpMul', 'forgeReady', 'pendingLevels', 'eliteT', 'buildingT', 'qiaoDone', 'specialDone', 'revived', 'adGold']) if (r[k] !== undefined) S[k] = r[k];
  S.weapons = r.weapons.map(w => ({ id: w.id, lv: w.lv, t: 0.3 }));
  S.skills = r.skills.map(s => ({ id: s.id, lv: s.lv, t: 1 }));
  S.shenbing = (r.shenbing || []).map(s => ({ gid: s.gid, lv: s.lv, t: 1.5, flash: 0 }));
  p.level = r.player.level; p.xp = r.player.xp; p.xpNext = xpFor(p.level);
  recomputeStats(); p.hp = Math.min(p.maxHp, Math.max(1, r.player.hp));
  (r.allies || []).forEach(t => addAllies(t, 1));
  for (const b of r.bosses || []) { spawnBoss(b.gid, b.final); const e = S.bossList[S.bossList.length - 1]; e.hp = e.maxHp * b.hp; }
  if (!S.endless && !S.qiaoDone && D.chapters[S.ch].events.some((ev, i) => ev.type === 'qiaofu' && i < S.evIdx)) placeQiaofu(); // 乔府还没打：重新放回右下方
  if (!S.endless) for (const [i, ev] of D.chapters[S.ch].events.entries()) if (ev.type === 'special' && i < S.evIdx) placeSpecial(ev.bid, ev.dx, ev.dy); // 西凉营地还没打：放回原来的方向
  S.seen = r.seen || S.seen;
  if (r.reward) { S.rewardReady = r.reward; S.rewardLegend = r.rewardLegend; }
  S.buildDirty = true; S.saveT = 15;
  for (const id of ['title', 'end', 'levelup', 'pause', 'shop', 'savecode']) $(id).hidden = true;
  $('hud').hidden = false; blinkRestore();
  updateHud();
  banner('继续征战', `${S.endless ? D.endless.name : chap().name} · Lv ${p.level}`);
}
// 存档码：金币、装备、图鉴、最佳纪录和未打完的一局
const SAVE_KEYS = ['buyi-meta', 'buyi-run', 'buyi-best', 'buyi-slain'];
function exportCode() {
  if (S && !S.over) saveRun();
  saveMeta(true);
  const o = {}; for (const k of SAVE_KEYS) { try { const v = localStorage.getItem(k); if (v) o[k] = JSON.parse(v); } catch (e) { /* ignore */ } }
  return 'BUYI1:' + btoa(unescape(encodeURIComponent(JSON.stringify(o))));
}
function importCode(text) {
  const m = /BUYI1:([A-Za-z0-9+/=]+)/.exec(text.replace(/\s+/g, ''));
  if (!m) return '这不是布衣三国的存档码，请完整复制后再粘贴';
  let o; try { o = JSON.parse(decodeURIComponent(escape(atob(m[1])))); } catch (e) { return '存档码不完整，请完整复制后再粘贴'; }
  for (const k of SAVE_KEYS) { try { if (o[k]) localStorage.setItem(k, JSON.stringify(o[k])); else if (k === 'buyi-run') localStorage.removeItem(k); } catch (e) { return '这台设备不能保存数据（可能是无痕模式）'; } }
  META = null;
  const meta = loadMeta(); meta._dirty = true; saveMeta(true); // 读了存档码：当作最新的进度，传到云端
  return `已读取：金币 ${meta.gold}${o['buyi-run'] ? '，含一局未打完的征战' : ''}`;
}
function openSaveCode() {
  $('save-text').value = exportCode(); $('save-msg').textContent = '';
  $('title').hidden = true; $('savecode').hidden = false;
  $('btn-save-copy').focus();
}
function refreshTitle() {
  $('btn-rank').hidden = !lbOK(); // TapTap 排行榜：只在 TapTap 里显示
  getRewardAd(); // 在标题页就创建激励视频并预加载（没有 tap 时什么也不做）
  cloudInit();   // 云存档：第一次到标题页时下载、合并（只做一次；没有 tap 时什么也不做）
  showBestOnTitle();
  $('title-gold').textContent = `金 ${loadMeta().gold}`;
  const r = loadRun();
  $('continue-box').hidden = !r;
  if (r) {
    const c = r.endless ? '天下三分' : D.chapters[r.ch].name.split(' · ')[1], o = D.origins.find(x => x.id === r.origin);
    $('continue-note').textContent = `${o ? o.name : ''} · ${c} · Lv ${r.player.level} · ${fmtTime(r.t)}（选新出身会开新局，覆盖这一局）`;
  }
}

// 最佳纪录只存在本机浏览器里，不影响下一局的强度
function loadBest() {
  try { return JSON.parse(localStorage.getItem('buyi-best')) || null; } catch (e) { return null; }
}
function saveBest(rec) {
  try { localStorage.setItem('buyi-best', JSON.stringify(rec)); } catch (e) { /* ignore */ }
  cloudDirty();
}
// 图鉴只记录斩过哪些武将，仅用于展示
function loadSlain() {
  try { return JSON.parse(localStorage.getItem('buyi-slain')) || {}; } catch (e) { return {}; }
}
function markSlain(gid) {
  const s = loadSlain();
  s[gid] = (s[gid] || 0) + 1;
  try { localStorage.setItem('buyi-slain', JSON.stringify(s)); } catch (e) { /* ignore */ }
  cloudDirty();
}
function nameOf(id) { const d = defOf(kindOf(id), id); return d ? d.name : id; }
// 武将按战役里的登场顺序排列
function generalOrder() {
  const ids = [];
  for (const c of D.chapters) for (const ev of c.events) if (ev.type === 'boss' && !ids.includes(ev.id)) ids.push(ev.id);
  for (const id in D.generals) if (!ids.includes(id)) ids.push(id);
  return ids;
}
function openCodex() {
  const slain = loadSlain();
  const ids = generalOrder();
  $('codex-sub').textContent = `已斩 ${ids.filter(id => slain[id]).length} / ${ids.length} · 击败后可夺取其兵器、技能或宝物`;
  $('codex-list').innerHTML = ids.map(id => {
    const g = D.generals[id], n = slain[id] || 0;
    return `<div class="gcard${n ? '' : ' unseen'}">
      <div class="art">${window.Portrait.html('general', id)}</div>
      ${n ? '<div class="slain" title="已斩">斩</div>' : ''}
      <div class="nm">${g.name}</div>
      <div class="tt">${g.title}${n ? ` · 已斩 ${n} 次` : ' · 尚未交手'}</div>
      <div class="drops">${g.rewards.map(r => `<span>${nameOf(r)}</span>`).join('')}</div>
    </div>`;
  }).join('');
  $('title').hidden = true;
  $('codex').hidden = false;
  $('btn-codex-close').focus();
}
function closeCodex() { $('codex').hidden = true; $('title').hidden = false; }

function showBestOnTitle() {
  const b = loadBest();
  $('best').hidden = !b;
  if (b) $('best').textContent = `最佳纪录：坚持 ${fmtTime(b.t)} · Lv ${b.lv} · ${rankOf(b.lv)} · ${b.origin}`;
}

function showEnd() {
  const p = S.player;
  const prev = loadBest();
  const isBest = !prev || S.t > prev.t;
  if (isBest) saveBest({ t: S.t, lv: p.level, kills: S.kills, origin: S.origin.name });
  const best = isBest ? null : prev;
  const names = [...new Set(S.defeated)];
  $('end-title').textContent = isBest ? '虽死犹荣' : '战死沙场';
  $('end-sub').textContent = (isBest ? '新纪录！' : '') + `止步于 ${rankOf(p.level)} · ${names.length ? '曾斩 ' + names.join('、') : '尚未斩将'}`;
  const fill = () => { $('end-stats').innerHTML = [
    ['征战至', S.endless ? '天下三分' : chap().name.split(' · ')[1]],
    ['坚持时间', fmtTime(S.t)], ['等级', `Lv ${p.level}`],
    ['军衔', rankOf(p.level)], ['斩敌', S.kills],
    ['斩将次数', S.defeated.length], ['本局金币', `+${S.goldRun}`], ['金币总数', loadMeta().gold],
    ...(best ? [['最佳坚持', fmtTime(best.t)], ['最佳等级', `Lv ${best.lv}`]] : []),
  ].map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join(''); };
  fill();
  $('end-build').innerHTML = buildChips();
  submitScore(); // TapTap 排行榜：提交这一局的等级
  const btns = $('end-btns');
  btns.innerHTML = '';
  const mk = (text, primary, fn) => { const b = document.createElement('button'); b.className = 'btn' + (primary ? ' primary' : ''); b.textContent = text; b.addEventListener('click', fn); btns.appendChild(b); return b; };
  // TapTap 激励视频：看完广告原地复活（每局一次）
  const rv = adOK() && !S.revived && mk('看广告复活', true, () => {
    rv.disabled = true; rv.textContent = '广告加载中…';
    watchAd(ok => { if (ok) revive(); else { rv.disabled = false; rv.textContent = '没看完广告，再试一次'; } });
  });
  const again = mk('再来一局', !rv, () => startGame(S.origin.id));
  mk('回到标题', false, toTitle); // 标题界面可以换出身、逛军需、看图鉴
  // TapTap 激励视频：看完广告，本局金币再加 20%（每局一次）
  const bonus = Math.max(1, Math.round(S.goldRun * TT.adGoldBonus));
  const gb = adOK() && S.goldRun > 0 && !S.adGold && mk(`看广告 金币 +${Math.round(TT.adGoldBonus * 100)}%（+${bonus}）`, false, () => {
    gb.disabled = true; gb.textContent = '广告加载中…';
    watchAd(ok => {
      if (ok) { S.adGold = true; addGold(bonus); saveMeta(true); fill(); gb.textContent = `已领取 +${bonus} 金币`; }
      else { gb.disabled = false; gb.textContent = `没看完广告 · 再试一次（+${bonus}）`; }
    });
  });
  (rv || again).focus();
  $('end').hidden = false;
}

function togglePause() {
  if (!S || S.over) return;
  if (S.paused) { S.paused = false; $('pause').hidden = true; return; }
  if (S.modal) return;
  S.paused = true;
  saveRun();
  $('pause-build').innerHTML = buildChips();
  $('pause').hidden = false;
  $('btn-resume').focus();
}

function startGame(originId) {
  clearRun();
  audio();
  joy.on = false;
  newState(originId);
  for (const id of ['title', 'end', 'levelup', 'pause']) $(id).hidden = true;
  $('hud').hidden = false; blinkRestore();
  updateHud();
  banner(D.chapters[0].name, D.chapters[0].sub);
}
function toTitle() {
  saveRun();
  S = null;
  for (const id of ['end', 'levelup', 'pause', 'hud']) $(id).hidden = true;
  $('title').hidden = false;
  refreshTitle();
}

function renderOrigins() {
  const box = $('origins');
  box.innerHTML = '';
  D.origins.forEach((o, i) => {
    const b = document.createElement('button');
    b.className = 'card origin';
    b.innerHTML = `<span class="key">${i + 1}</span>
      <div class="oart">${window.Portrait.html('origin', o.id)}</div>
      <div class="top"><div><div class="nm">${o.name}</div><div class="kind">初始武器 · ${D.weapons[o.weapon].name}</div></div></div>
      <div class="ds">${o.desc}</div><ul>${o.perks.map(x => `<li>${x}</li>`).join('')}</ul>
      <div class="kit">${D.meta.gear[o.id].map(g => { const lv = gearLv(g.id), st = gearStage(lv); return lv ? `<span style="color:${D.meta.rarity[st - 1].color}">${gearTierName(g, lv)}</span>` : ''; }).filter(Boolean).join(' · ') || '尚无军需装备'}</div>`;
    b.addEventListener('click', () => startGame(o.id));
    box.appendChild(b);
  });
}

function buildTitle() {
  renderOrigins();
  addEventListener('keydown', e => {
    const m = /^(?:Digit|Numpad)([1-3])$/.exec(e.code);
    if (m && !$('title').hidden) startGame(D.origins[+m[1] - 1].id);
  });
  refreshTitle();
}

// 美术图加载完成后刷新用到它的地方
window.Assets.init(D);
FX.setArt(k => window.Assets.get('fxs:' + k));
let assetRefresh = 0;
window.Assets.onLoad(() => {
  clearTimeout(assetRefresh);
  assetRefresh = setTimeout(() => {
    spriteCache.clear();
    FX.setArt(k => window.Assets.get('fxs:' + k)); // 换上 GPT 画的特效贴图
    renderOrigins();
    if (S) { S.buildDirty = true; S.faceGid = null; }
    if (!$('codex').hidden) openCodex();
  }, 50);
});

$('btn-codex').addEventListener('click', openCodex);
$('btn-rank').addEventListener('click', openLeaderboard); // TapTap 排行榜（只在 TapTap 里显示）
$('btn-shop').addEventListener('click', openShop);
$('btn-shop-close').addEventListener('click', closeShop);
$('btn-continue').addEventListener('click', continueRun);
$('btn-save').addEventListener('click', openSaveCode);
$('btn-save-close').addEventListener('click', () => { $('savecode').hidden = true; $('title').hidden = false; refreshTitle(); });
$('btn-save-copy').addEventListener('click', () => {
  const t = $('save-text'); t.select();
  const ok = () => { $('save-msg').textContent = '已复制。到另一台设备打开“存档码”，粘贴后点“读取粘贴的存档码”'; };
  const manual = () => { try { document.execCommand('copy'); ok(); } catch (e) { $('save-msg').textContent = '请长按文字手动复制'; } };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t.value).then(ok, manual); else manual();
});
$('btn-save-load').addEventListener('click', () => { $('save-msg').textContent = importCode($('save-text').value); renderOrigins(); });
$('btn-codex-close').addEventListener('click', closeCodex);
$('btn-pause').addEventListener('click', togglePause);
$('btn-resume').addEventListener('click', togglePause);
// 攻击目标：最近 → 随机 → 名将优先，记在这个浏览器里
const aimLabel = () => { const m = AIM_MODES.find(x => x[0] === aimMode); $('btn-aim').textContent = m[1]; $('btn-aim').title = `攻击目标：${m[2]}（点一下切换）`; };
$('btn-aim').addEventListener('click', () => {
  const i = AIM_MODES.findIndex(x => x[0] === aimMode);
  aimMode = AIM_MODES[(i + 1) % AIM_MODES.length][0];
  try { localStorage.setItem('buyi-aim', aimMode); } catch (e) { /* ignore */ }
  aimLabel();
  if (S) toast('', '', `攻击目标：${AIM_MODES.find(x => x[0] === aimMode)[2]}`, aimMode === 'boss' ? '名将、精英在射程内时先打它们' : aimMode === 'random' ? '在射程内随机挑一个敌人' : '打离你最近的敌人');
});
aimLabel();
// 闪现按钮（手机）：按下就闪，不触发摇杆
// 闪现按钮：轻点 = 闪现；长按约半秒 = 拿起来拖到想要的位置，松手放下（位置记在这个浏览器里）
var blinkRestore = () => {}; // 开局时再放一次位置（页面刚打开时窗口大小可能还没就绪）
{
  const bb = $('btn-blink'), POS_KEY = 'buyi-blink-pos', HOLD = 0.45;
  let press = null; // { id, t0, x, y, timer, drag, dx, dy }
  const place = (cx, cy) => { // 按钮中心放到 (cx, cy)，不出屏幕
    const r = bb.offsetWidth / 2 || 30, m = 6;
    cx = Math.min(innerWidth - r - m, Math.max(r + m, cx)); cy = Math.min(innerHeight - r - m, Math.max(r + m, cy));
    Object.assign(bb.style, { left: (cx - r) + 'px', top: (cy - r) + 'px', right: 'auto', bottom: 'auto' });
    return [cx, cy];
  };
  const restore = () => { // 存的是占屏幕宽高的比例，转屏、换窗口大小也大致在同一个地方
    if (innerWidth < 100 || innerHeight < 100) return; // 页面还没排好版（比如后台标签页）时先不放
    let s = null;
    try { s = JSON.parse(localStorage.getItem(POS_KEY)); } catch (e) { /* ignore */ }
    if (s && isFinite(s.fx) && isFinite(s.fy)) place(s.fx * innerWidth, s.fy * innerHeight);
  };
  bb.addEventListener('pointerdown', e => {
    e.stopPropagation(); e.preventDefault();
    try { bb.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    const rc = bb.getBoundingClientRect();
    press = { id: e.pointerId, drag: false, dx: e.clientX - (rc.left + rc.width / 2), dy: e.clientY - (rc.top + rc.height / 2) };
    press.timer = setTimeout(() => { if (press) { press.drag = true; bb.classList.add('dragging'); } }, HOLD * 1000);
  });
  bb.addEventListener('pointermove', e => {
    if (!press || e.pointerId !== press.id || !press.drag) return;
    e.preventDefault();
    place(e.clientX - press.dx, e.clientY - press.dy);
  });
  const end = (e, cancel) => {
    if (!press || e.pointerId !== press.id) return;
    clearTimeout(press.timer);
    if (press.drag) { // 放下：记住位置
      const rc = bb.getBoundingClientRect();
      try { localStorage.setItem(POS_KEY, JSON.stringify({ fx: (rc.left + rc.width / 2) / innerWidth, fy: (rc.top + rc.height / 2) / innerHeight })); } catch (err) { /* ignore */ }
      bb.classList.remove('dragging');
    } else if (!cancel && S && !S.over) S.blinkReq = true; // 轻点：闪现
    press = null;
  };
  bb.addEventListener('pointerup', e => end(e, false));
  bb.addEventListener('pointercancel', e => end(e, true));
  bb.addEventListener('contextmenu', e => e.preventDefault()); // 手机长按不弹菜单
  addEventListener('resize', restore);
  blinkRestore = restore;
  restore();
}
$('btn-quit').addEventListener('click', toTitle);
$('btn-sound').addEventListener('click', () => {
  muted = !muted;
  $('btn-sound').textContent = muted ? '静' : '声';
  try { localStorage.setItem('buyi-muted', muted ? '1' : '0'); } catch (e) { /* ignore */ }
  audio();
  Music.refresh();
  if (muted) stopVoice();
});
$('btn-sound').textContent = muted ? '静' : '声';
// 暂停菜单里分别开关音乐和语音
const audioLabels = () => { $('btn-music').textContent = `音乐：${musicOn ? '开' : '关'}`; $('btn-voice').textContent = `语音：${voiceOn ? '开' : '关'}`; };
$('btn-music').addEventListener('click', () => { musicOn = !musicOn; try { localStorage.setItem('buyi-music', musicOn ? '1' : '0'); } catch (e) { /* ignore */ } audioLabels(); Music.refresh(); });
$('btn-voice').addEventListener('click', () => { voiceOn = !voiceOn; try { localStorage.setItem('buyi-voice', voiceOn ? '1' : '0'); } catch (e) { /* ignore */ } audioLabels(); if (!voiceOn) stopVoice(); });
audioLabels();
// 浏览器要求先有一次点击 / 按键才能出声：标题界面第一次操作时就把音乐放起来
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => audio(), { once: true, capture: true });
document.addEventListener('visibilitychange', () => { if (document.hidden && S && !S.paused && !S.modal && !S.over) togglePause(); if (document.hidden) { saveRun(); saveMeta(true); cloudUpload(); Music.want(null); } });
addEventListener('pagehide', () => { saveRun(); saveMeta(true); cloudUpload(); });

// ============ 绘制 ============
function hash(x, y) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

// 地面：每章配色不同（黄土麦田、关隘、平原、江边芦苇）
const groundOf = () => S ? chap().ground : D.endless.ground;
function drawGround(camX, camY) {
  const T = 140, G = groundOf();
  const hw = W / 2 / ZOOM + T, hh = H / 2 / ZOOM + T;
  const x0 = Math.floor((camX - hw) / T), x1 = Math.floor((camX + hw) / T);
  const y0 = Math.floor((camY - hh) / T), y1 = Math.floor((camY + hh) / T);
  ctx.lineCap = 'round';
  for (let cx = x0; cx <= x1; cx++) {
    for (let cy = y0; cy <= y1; cy++) {
      const h = hash(cx, cy);
      const bx = cx * T, by = cy * T;
      const r1 = (h & 255) / 255, r2 = ((h >>> 8) & 255) / 255, r3 = ((h >>> 16) & 255) / 255;
      if (h % 5 === 0) {
        ctx.fillStyle = G.blot;
        ctx.beginPath(); ctx.ellipse(bx + r1 * T, by + r2 * T, 40 + r3 * 40, 24 + r1 * 20, r2 * 3, 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = G.grass;
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 3; i++) {
        const gx = bx + ((r1 * 97 + i * 41) % T), gy = by + ((r2 * 89 + i * 53) % T);
        ctx.beginPath();
        ctx.moveTo(gx, gy); ctx.lineTo(gx - 3, gy - 7);
        ctx.moveTo(gx + 2, gy); ctx.lineTo(gx + 3, gy - 8);
        ctx.moveTo(gx + 4, gy); ctx.lineTo(gx + 8, gy - 6);
        ctx.stroke();
      }
      if (G.reeds && h % 7 === 0) { // 江边芦苇
        const rx = bx + r3 * T, ry = by + r2 * T;
        ctx.strokeStyle = 'rgba(150,160,110,0.55)'; ctx.lineWidth = 1.4;
        for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(rx + k * 4, ry); ctx.quadraticCurveTo(rx + k * 4 + 2, ry - 14, rx + k * 4 + 5 - k, ry - 24 - k * 3); ctx.stroke(); }
        ctx.fillStyle = 'rgba(190,180,140,0.5)';
        for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(rx + k * 4 + 5 - k, ry - 26 - k * 3, 1.6, 4, 0.2, 0, TAU); ctx.fill(); }
      }
      if (h % 11 === 0) {
        ctx.fillStyle = 'rgba(120,112,96,0.5)';
        ctx.beginPath(); ctx.ellipse(bx + r3 * T, by + r1 * T, 6 + r2 * 5, 4 + r2 * 3, 0, 0, TAU); ctx.fill();
      }
      if (h % 23 === 0) { // 战场遗留的断箭
        const ax = bx + r2 * T, ay = by + r3 * T, a = -1.2 + r1 * 0.6;
        ctx.strokeStyle = 'rgba(160,140,100,0.55)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + Math.cos(a) * 22, ay + Math.sin(a) * 22); ctx.stroke();
        ctx.strokeStyle = 'rgba(181,55,42,0.5)';
        ctx.beginPath(); ctx.moveTo(ax + Math.cos(a) * 18, ay + Math.sin(a) * 18); ctx.lineTo(ax + Math.cos(a) * 24 - 3, ay + Math.sin(a) * 24 + 2); ctx.stroke();
      }
      if (h % 61 === 0) { // 倒下的军旗
        const fx = bx + r1 * T, fy = by + r2 * T;
        ctx.strokeStyle = 'rgba(90,70,50,0.7)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + 34, fy - 6); ctx.stroke();
        ctx.fillStyle = G.flag;
        ctx.beginPath(); ctx.moveTo(fx + 30, fy - 5); ctx.lineTo(fx + 18, fy + 14); ctx.lineTo(fx + 8, fy + 6); ctx.lineTo(fx + 14, fy - 2); ctx.fill();
      }
    }
  }
}

// 头像：face = Portrait.face(...) 返回的立绘头部区域，裁成圆形画在战场上
function sprite(key, r, color, icon, flash, boss, face, ring) {
  const ck = key + (flash ? '!' : '') + (face ? face.key : '');
  let s = spriteCache.get(ck);
  if (s) return s;
  if (face) {
    const sc = DPR * ZOOM, w = r * 2 + 12, h = r * 2 + 16;
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * sc); c.height = Math.ceil(h * sc);
    const g = c.getContext('2d');
    g.scale(sc, sc);
    const cx = w / 2, cy = r + 6;
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath(); g.ellipse(cx, cy + r * 0.85, r * 0.95, r * 0.38, 0, 0, TAU); g.fill();
    g.save(); g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.clip();
    g.fillStyle = color; g.fillRect(cx - r, cy - r, r * 2, r * 2);
    g.drawImage(face.img, face.sx, face.sy, face.sw, face.sh, cx - r, cy - r, r * 2, r * 2);
    if (flash) { g.fillStyle = 'rgba(255,244,220,0.6)'; g.fillRect(cx - r, cy - r, r * 2, r * 2); }
    g.restore();
    g.strokeStyle = ring || '#cfa34a'; g.lineWidth = boss ? 3 : 2.2;
    g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke();
    s = { c, w, h, cx, cy };
    spriteCache.set(ck, s);
    return s;
  }
  const sc = DPR * ZOOM;
  const w = r * 2 + 12, h = r * 2 + 16;
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * sc); c.height = Math.ceil(h * sc);
  const g = c.getContext('2d');
  g.scale(sc, sc);
  const cx = w / 2, cy = r + 6;
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath(); g.ellipse(cx, cy + r * 0.85, r * 0.95, r * 0.38, 0, 0, TAU); g.fill();
  g.fillStyle = flash ? '#fff4dc' : color;
  g.strokeStyle = boss ? '#cfa34a' : '#15120d';
  g.lineWidth = boss ? 3 : 2;
  g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill(); g.stroke();
  if (boss) { g.strokeStyle = 'rgba(207,163,74,0.5)'; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, r - 5, 0, TAU); g.stroke(); }
  g.fillStyle = flash ? color : '#efe5cc';
  g.font = `900 ${Math.round(r * 1.05)}px ${FONT}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(icon, cx, cy + r * 0.06);
  s = { c, w, h, cx, cy };
  spriteCache.set(ck, s);
  return s;
}
function drawSprite(s, x, y) { ctx.drawImage(s.c, x - s.cx, y - s.cy, s.w, s.h); }

// ---------- 战场小人 ----------
// 有美术小人图（assets/sprites/<id>.png，脚底贴着图片下沿）就用图，否则用 sprites.js 画的 Q 版小人。
// 白龙驹（赵云、玩家七进七出、颜良的白马）：有美术图就用图
const WHITE_HORSE = '#eef0f2', CHITU = '#a3261b';
const HORSE_ART = { [WHITE_HORSE]: 'mount:white', [CHITU]: 'mount:chitu' }; // 美术画的坐骑（不带骑手，马鞍在马背正中）
const SEAT = { x: 0.45, y: 0.38, cut: 0.74, sink: 0.05 }; // 马鞍在马图里的位置；骑手只画上半身（cut），往马鞍里坐进去一点（sink）
function unitSprite(id, look, hWorld, flash, mount) {
  const art = window.Assets.get('sprite:' + id);
  const riderArt = !art && id.endsWith('_mounted') && window.Assets.get('sprite:' + id.replace('_mounted', ''));
  const horseArt = riderArt && HORSE_ART[mount] && window.Assets.get(HORSE_ART[mount]);
  const ck = `unit|${id}|${hWorld}|${flash ? 1 : 0}|${art ? 'a' : 'c'}|${mount || ''}|${horseArt ? 'h' : ''}`;
  let s = spriteCache.get(ck);
  if (s) return s;
  const sc = DPR * ZOOM;
  const w = art ? hWorld * art.naturalWidth / art.naturalHeight : horseArt ? hWorld * 1.15 : hWorld * Sprites.BOX_W / Sprites.BOX_H;
  const horseH = horseArt ? w * horseArt.naturalHeight / horseArt.naturalWidth : 0;
  const riderH = hWorld * 0.8; // 骑手和平时站着差不多大
  const h = horseArt ? Math.max(hWorld, horseH * (1 - SEAT.y) + riderH * (SEAT.cut - SEAT.sink) + 2) : hWorld; // 画布加高，骑手的上半身露出马背
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * sc); c.height = Math.ceil(h * sc);
  const g = c.getContext('2d');
  if (art) g.drawImage(art, 0, 0, c.width, c.height);
  else if (horseArt) { // 美术画的坐骑 + 角色小人的上半身坐在马鞍上（腰下渐隐，像坐进马鞍里）
    const hw = c.width, hh = horseH * sc;
    g.drawImage(horseArt, 0, c.height - hh, hw, hh);
    const rh = riderH * sc, rw = rh * riderArt.naturalWidth / riderArt.naturalHeight, ch = rh * SEAT.cut;
    const t = document.createElement('canvas'); t.width = Math.ceil(rw); t.height = Math.ceil(ch);
    const tg = t.getContext('2d');
    tg.drawImage(riderArt, 0, 0, riderArt.naturalWidth, riderArt.naturalHeight * SEAT.cut, 0, 0, t.width, t.height);
    const fade = tg.createLinearGradient(0, 0, 0, t.height); fade.addColorStop(0.8, '#000'); fade.addColorStop(1, 'rgba(0,0,0,0)');
    tg.globalCompositeOperation = 'destination-in'; tg.fillStyle = fade; tg.fillRect(0, 0, t.width, t.height);
    const seatY = c.height - hh + hh * SEAT.y;
    g.drawImage(t, hw * SEAT.x - rw / 2, seatY - ch + rh * SEAT.sink);
  }
  else if (riderArt) { // 还没有骑马美术图：代码画的马 + 角色原本的美术小人骑在上面
    g.save(); g.scale(c.width / Sprites.BOX_W, c.height / Sprites.BOX_H); Sprites.horse(g, mount || '#b5372a'); g.restore();
    const rh = c.height * 0.78, rw = rh * riderArt.naturalWidth / riderArt.naturalHeight;
    g.drawImage(riderArt, c.width * 0.47 - rw / 2, c.height * 0.72 - rh, rw, rh);
  }
  else { g.scale(c.width / Sprites.BOX_W, c.height / Sprites.BOX_H); Sprites.draw(g, look, { mount }); g.setTransform(1, 0, 0, 1, 0, 0); }
  if (flash) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,244,220,0.55)'; g.fillRect(0, 0, c.width, c.height); }
  s = { c, w, h };
  spriteCache.set(ck, s);
  return s;
}
// 脚底在 (x, y + r*0.6)；faceX = 1 朝右、-1 朝左；bob 是走路颠动的高度。返回头顶的 y。
function drawUnit(s, x, y, r, faceX, bob) {
  const footY = y + r * 0.6, squash = bob * 0.014;
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath(); ctx.ellipse(x, footY, Math.max(r * 0.9, s.w * 0.3), r * 0.34, 0, 0, TAU); ctx.fill();
  ctx.save();
  ctx.translate(x, footY - bob);
  ctx.scale(faceX * (1 + squash), 1 - squash);
  ctx.drawImage(s.c, -s.w / 2, -s.h, s.w, s.h);
  ctx.restore();
  return footY - bob - s.h;
}
const walkBob = (seed, moving) => moving ? Math.abs(Math.sin(S.t * 11 + seed)) * 2.6 : Math.sin(S.t * 2.5 + seed) * 0.6 + 0.6;
function faceToward(e, tx) { // 只在明显偏左/偏右时转身，避免抖动
  if (tx > e.x + 4) e.fx = 1; else if (tx < e.x - 4) e.fx = -1;
  return e.fx || 1;
}

function drawPlayer() {
  const p = S.player;
  const blink = p.iframes > 0 && Math.floor(p.iframes * 20) % 2 === 0;
  ctx.globalAlpha = blink ? 0.45 : 1;
  if (S.t < S.rampageT) { // 七进七出：脚下银白龙气
    ctx.globalCompositeOperation = 'lighter';
    FX.glow(ctx, p.x, p.y - 10, 58 + 6 * Math.sin(S.t * 12), '200,225,255', 0.4);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  if (p.moving && Math.abs(Math.cos(p.facing)) > 0.2) p.fx = Math.cos(p.facing) > 0 ? 1 : -1;
  const chitu = S.skills.some(s => s.id === 'chitu'); // 骑上赤兔马
  const seven = S.t < S.rampageT;                      // 七进七出：骑上白龙驹
  const ride = chitu || seven || S.dash;               // 冲阵时也骑马
  const mount = seven || (S.dash && !chitu) ? WHITE_HORSE : chitu ? CHITU : '';
  // 人物造型跟着局外装备变：有对应的美术小人（武器阶段 × 护甲阶段）就用它，否则用出身原本的小人
  const L = S.gearLook || { w: 1, a: 1, c: 0 }, lookId = `${S.origin.id}_w${L.w}a${L.a}`;
  const sid = window.Assets.get('sprite:' + lookId) ? lookId : S.origin.id;
  const hasLookArt = sid === lookId;
  if (!hasLookArt && (L.a > 1 || L.w > 1)) { // 还没有造型美术图：用光效区分装备阶段
    const R = D.meta.rarity;
    ctx.globalCompositeOperation = 'lighter';
    if (L.a > 1) { // 护甲：脚下一圈稀有度颜色的光环
      ctx.globalAlpha = 0.55; ctx.strokeStyle = `rgb(${R[L.a - 1].rgb})`; ctx.lineWidth = L.a === 3 ? 3 : 2;
      ctx.beginPath(); ctx.ellipse(p.x, p.y + p.r * 0.6, p.r * 1.35, p.r * 0.5, 0, 0, TAU); ctx.stroke();
    }
    if (L.w > 1) FX.glow(ctx, p.x + (p.fx || 1) * 12, p.y - 18, L.w === 3 ? 26 : 18, R[L.w - 1].rgb, 0.35 + 0.1 * Math.sin(S.t * 6)); // 武器：持械的手边发光
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = blink ? 0.45 : 1;
  }
  const spr = ride ? unitSprite(sid + '_mounted', S.origin.look, 58, false, mount) : unitSprite(sid, S.origin.look, 44, false, '');
  if (seven && S.player.trail) drawDragonTrail(S.player.trail, '235,245,255', 1, 'fx:dragon_white', 26);
  // 七进七出、冲阵、骑赤兔奔跑时留下残影
  const rampage = seven || !!S.dash;
  if ((rampage || (chitu && p.moving)) && S.t - S.ghostT > 0.045) {
    addGhost(spr, p.x, p.y + p.r * 0.6, p.fx || 1, rampage ? 0.45 : 0.25);
    S.ghostT = S.t;
  }
  const top = drawUnit(spr, p.x, p.y, p.r, p.fx || 1, walkBob(0, p.moving));
  if (S.t < S.frozenT) { // 被冻住：一块半透明的冰把人包住
    ctx.fillStyle = 'rgba(170,220,255,0.35)'; ctx.strokeStyle = 'rgba(235,248,255,0.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(p.x - 20, p.y + p.r * 0.6); ctx.lineTo(p.x - 24, top + 4); ctx.lineTo(p.x - 6, top - 10); ctx.lineTo(p.x + 18, top - 2); ctx.lineTo(p.x + 24, p.y + p.r * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke();
    FX.shard(ctx, p.x - 16, top + 2, 12, -0.4, 0.9); FX.shard(ctx, p.x + 16, top + 6, 10, 0.5, 0.9);
    ctx.globalAlpha = 1;
  } else if (S.t < S.pChillT) { // 冻得走不快：脚下一圈冰蓝
    ctx.strokeStyle = `rgba(170,220,255,${0.5 + 0.3 * Math.sin(S.t * 10)})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(p.x, p.y + p.r * 0.6, p.r * 1.4, p.r * 0.5, 0, 0, TAU); ctx.stroke();
  }
  if (S.charm) { // 被迷住：一条粉色的光丝把人牵向貂蝉
    const b = S.charm.boss;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,140,200,${0.45 + 0.25 * Math.sin(S.t * 18)})`; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(p.x, p.y - 20); ctx.quadraticCurveTo((p.x + b.x) / 2, Math.min(p.y, b.y) - 60, b.x, b.y - b.r); ctx.stroke();
    FX.glow(ctx, p.x, p.y - 20, 30, '255,120,190', 0.5);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  if (S.t < S.pSlowT) { // 被震慑：脚下黄色震荡圈
    ctx.strokeStyle = `rgba(255,220,120,${0.5 + 0.3 * Math.sin(S.t * 20)})`; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.ellipse(p.x, p.y + p.r * 0.6, p.r * 1.5, p.r * 0.55, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.globalAlpha = 1;
  if (L.c) { // 饰品：一颗绕身旋转的护身光珠，等级越高越大越亮，颜色随稀有度
    const R = D.meta.rarity[gearStage(L.c) - 1], a = S.t * 2.2, ox = Math.cos(a) * 20, oy = Math.sin(a) * 8;
    const behind = Math.sin(a) < 0, sz = 4 + L.c * 0.7;
    ctx.globalCompositeOperation = 'lighter';
    FX.glow(ctx, p.x + ox, p.y - 14 + oy, sz * 3, R.rgb, behind ? 0.3 : 0.6);
    FX.glow(ctx, p.x + ox, p.y - 14 + oy, sz, '255,250,235', behind ? 0.4 : 0.9);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  const bw = 36, by = p.y + p.r * 0.6 + 6;
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(p.x - bw / 2, by, bw, 4);
  ctx.fillStyle = '#c9493d'; ctx.fillRect(p.x - bw / 2, by, bw * p.hp / p.maxHp, 4);
  p.topY = top;
}

function drawWeaponsUnder() {
  const p = S.player;
  for (const w of S.weapons) {
    const def = D.weapons[w.id], L = wStats(def, w.lv);
    if (w.sw) { const g = w.sw; drawGaze(p.x, p.y, g.a, g.R, g.half, Math.min(1, (g.dur - g.t) / 0.15 + 0.2), false); continue; } // 狼顾：两道目光
    if (def.type === 'aura') {
      const R = L.radius * p.areaMul;
      const gr = ctx.createRadialGradient(p.x, p.y, R * 0.2, p.x, p.y, R);
      gr.addColorStop(0, 'rgba(240,140,50,0.04)'); gr.addColorStop(0.8, 'rgba(240,120,40,0.16)'); gr.addColorStop(1, 'rgba(240,120,40,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter'; // 火圈边缘跳动的火光
      for (let i = 0; i < 12; i++) {
        const a = S.t * 1.5 + i * TAU / 12, rr = R * (0.85 + 0.1 * Math.sin(S.t * 7 + i));
        FX.glow(ctx, p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr, 9 + 3 * Math.sin(S.t * 13 + i * 2), '255,140,50', 0.5);
      }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
  }
}
function drawOrbit() {
  const p = S.player;
  for (const w of S.weapons) {
    const def = D.weapons[w.id];
    if (def.type !== 'orbit') continue;
    const L = statsOf(def, w.lv);
    const inner = (L.radius - L.len / 2) * p.areaMul, outer = (L.radius + L.len / 2) * p.areaMul;
    for (let b = 0; b < L.blades; b++) {
      const a = (w.ang || 0) + b * TAU / L.blades;
      ctx.globalCompositeOperation = 'lighter'; // 画戟划过的金色残光
      for (let k = 0; k < 4; k++) {
        ctx.globalAlpha = 0.16 - k * 0.035;
        ctx.strokeStyle = 'rgb(255,200,110)'; ctx.lineWidth = 16 - k * 3;
        ctx.beginPath(); ctx.arc(p.x, p.y, outer - 10, a - 0.25 * (k + 1), a - 0.25 * k); ctx.stroke();
      }
      FX.glow(ctx, p.x + Math.cos(a) * (outer - 6), p.y + Math.sin(a) * (outer - 6), 22, '255,210,130', 0.5);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      // 画戟本体：乌木戟杆 + 带金属渐变的戟刃（不描黑边），刃口一道高光
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a);
      const shaft = ctx.createLinearGradient(0, -2.5, 0, 2.5); shaft.addColorStop(0, '#8a4a28'); shaft.addColorStop(1, '#3a1c10');
      ctx.strokeStyle = shaft; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(inner, 0); ctx.lineTo(outer, 0); ctx.stroke();
      const steel = ctx.createLinearGradient(outer - 20, -22, outer - 20, 22);
      steel.addColorStop(0, '#fbfcfd'); steel.addColorStop(0.45, '#9aa3ad'); steel.addColorStop(0.55, '#c9d0d7'); steel.addColorStop(1, '#f1f4f7');
      ctx.fillStyle = steel;
      ctx.beginPath(); ctx.moveTo(outer + 18, 0); ctx.lineTo(outer - 4, -5); ctx.lineTo(outer - 4, 5); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(outer - 6, -3); ctx.quadraticCurveTo(outer - 2, -20, outer - 18, -22); ctx.quadraticCurveTo(outer - 10, -10, outer - 14, -3); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(outer - 6, 3); ctx.quadraticCurveTo(outer - 2, 20, outer - 18, 22); ctx.quadraticCurveTo(outer - 10, 10, outer - 14, 3); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(outer + 16, 0); ctx.lineTo(outer - 2, -3.5); ctx.stroke();
      ctx.fillStyle = '#c0392b';
      ctx.beginPath(); ctx.arc(outer - 16, 0, 3.4, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }
}

function drawTelegraphs() {
  for (const e of S.enemies) {
    if (!e.ai && !e.boss) continue;
    const g = e.def;
    const prog = 1 - e.stateT / e.stateMax;
    if (e.state === 'tele_charge') {
      const len = g.chargeSpeed * (e.enraged ? 1.12 : 1) * 0.45 + e.r;
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.ang);
      ctx.fillStyle = `rgba(200,50,35,${0.12 + 0.22 * prog})`;
      ctx.fillRect(0, -e.r, len, e.r * 2);
      ctx.fillStyle = 'rgba(230,70,50,0.35)';
      ctx.fillRect(0, -e.r, len * prog, e.r * 2);
      ctx.restore();
    } else if (e.state === 'tele_slam') {
      ctx.fillStyle = 'rgba(200,50,35,0.14)';
      ctx.beginPath(); ctx.arc(e.x, e.y, g.slamR, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(230,70,50,0.3)';
      ctx.beginPath(); ctx.arc(e.x, e.y, g.slamR * prog, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(230,70,50,0.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, g.slamR, 0, TAU); ctx.stroke();
    } else if (e.state === 'tele_cleave') {
      const half = Math.PI / 3;
      ctx.fillStyle = 'rgba(200,50,35,0.16)';
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.arc(e.x, e.y, g.cleaveR, e.ang - half, e.ang + half); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(230,70,50,0.32)';
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.arc(e.x, e.y, g.cleaveR * prog, e.ang - half, e.ang + half); ctx.closePath(); ctx.fill();
    } else if (e.state === 'tele_roar') {
      ctx.strokeStyle = `rgba(232,224,200,${0.3 + 0.5 * prog})`; ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.arc(e.x, e.y, g.roarR, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = `rgba(232,224,200,${0.06 + 0.12 * prog})`;
      ctx.beginPath(); ctx.arc(e.x, e.y, g.roarR * prog, 0, TAU); ctx.fill();
    } else if (e.state === 'windup') {
      const v = g.volley, toP = angleTo(e.x, e.y, S.player.x, S.player.y);
      ctx.strokeStyle = `rgba(230,70,50,${0.25 + 0.4 * prog})`; ctx.lineWidth = 2;
      for (const s of [-0.5, 0, 0.5]) {
        const a = toP + s * v.spread;
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(a) * 220, e.y + Math.sin(a) * 220); ctx.stroke();
      }
    }
  }
  for (const h of S.hazards) { // 火攻 / 石阵 / 青龙落点
    const prog = 1 - h.t / h.max, rgb = h.rgb || '232,116,42';
    const fill = h.chainDrop ? '10,4,12' : rgb, fa = h.chainDrop ? 2.4 : 1; // 董卓的落点是黑的
    ctx.fillStyle = `rgba(${fill},${0.14 * fa})`;
    ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(${fill},${0.32 * fa})`;
    ctx.beginPath(); ctx.arc(h.x, h.y, h.r * prog, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(${rgb},0.85)`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, TAU); ctx.stroke();
    if (h.petal) for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + S.t * 2, r = h.r * (1 - prog * 0.85); FX.petal(ctx, h.x + Math.cos(a) * r, h.y + Math.sin(a) * r * 0.8, 6, a + S.t * 3, '255,160,205', 0.9); } // 花瓣旋着收拢
    else if (h.ice) FX.snowflake(ctx, h.x, h.y, h.r * 0.35 * (0.4 + 0.6 * prog), S.t, 0.8); // 雪花慢慢长大
    else if (h.page) FX.page(ctx, h.x, h.y - (1 - prog) * 220, 10, Math.sin(S.t * 6 + h.x) * 0.4, Math.min(1, prog * 2), Math.cos(S.t * 9 + h.y)); // 书页从天上飘下
    else if (h.water) { ctx.strokeStyle = `rgba(200,255,250,${0.5 + 0.4 * prog})`; ctx.lineWidth = 1.5; for (let k = 0; k < 3; k++) { const r = h.r * ((prog * 1.5 + k / 3) % 1); ctx.beginPath(); ctx.ellipse(h.x, h.y, r, r * 0.6, 0, 0, TAU); ctx.stroke(); } } // 水纹一圈圈荡开
    else if (h.kite) FX.kite(ctx, h.x, h.y - 30 - (1 - prog) * 260, 16, Math.sin(S.t * 3 + h.x) * 0.3, '200,150,255', Math.min(1, prog * 2)); // 纸鸢从天上俯冲下来
    else if (h.wisp) { FX.wisp(ctx, h.x, h.y + 6, h.r * 0.22 * (0.4 + 0.6 * prog), S.t + h.x, 0.9, h.rgb); if (h.eye) { ctx.strokeStyle = `rgba(160,255,220,${0.5 + 0.4 * prog})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(h.x, h.y - h.r * 0.55, h.r * 0.42, h.r * 0.18, 0, 0, TAU); ctx.stroke(); ctx.fillStyle = 'rgba(160,255,220,.8)'; ctx.beginPath(); ctx.arc(h.x, h.y - h.r * 0.55, h.r * 0.1, 0, TAU); ctx.fill(); } } // 鬼火慢慢长大；料敌先机的落点上睁开一只眼
    else if (h.chainDrop) FX.chain(ctx, h.x, h.y - 700, h.x, h.y - 20 - (1 - prog) * 480, { w: 8, hook: true, a: Math.min(1, prog * 2) }); // 铁链从天上垂下来
    ctx.globalAlpha = 1;
  }
  // 大招预警：颜色用武将的专属色，随时间填满；边缘发光、闪烁，越接近越急
  for (const f of S.teles) {
    const prog = 1 - f.life / f.max, blink = 0.6 + 0.4 * Math.sin(S.t * (14 + prog * 26));
    const fill = f.dark ? '10,4,12' : f.rgb, fa = f.dark ? 2.6 : 1; // 董卓：黑色的预警，边缘暗红
    ctx.save();
    if (f.kind === 'line') {
      ctx.translate(f.x, f.y); ctx.rotate(f.a);
      ctx.fillStyle = `rgba(${fill},${0.13 * fa})`; ctx.fillRect(0, -f.w / 2, f.len, f.w);
      ctx.fillStyle = `rgba(${fill},${0.3 * fa})`; ctx.fillRect(0, -f.w / 2, f.len * prog, f.w);
      ctx.strokeStyle = `rgba(${f.rgb},${0.6 * blink})`; ctx.lineWidth = 2;
      ctx.strokeRect(0, -f.w / 2, f.len, f.w);
      ctx.fillStyle = `rgba(255,255,255,${0.5 * blink})`; // 箭头
      for (let x = 40; x < f.len; x += 70) { ctx.beginPath(); ctx.moveTo(x + 10, 0); ctx.lineTo(x - 2, -6); ctx.lineTo(x - 2, 6); ctx.fill(); }
    } else if (f.kind === 'wedge') {
      ctx.fillStyle = `rgba(${f.rgb},0.14)`;
      ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.arc(f.x, f.y, f.R, f.a - f.half, f.a + f.half); ctx.closePath(); ctx.fill();
      ctx.fillStyle = `rgba(${f.rgb},0.3)`;
      ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.arc(f.x, f.y, f.R * prog, f.a - f.half, f.a + f.half); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = `rgba(${f.rgb},${0.7 * blink})`; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.arc(f.x, f.y, f.R, f.a - f.half, f.a + f.half); ctx.closePath(); ctx.stroke();
    } else if (f.kind === 'circle') {
      ctx.fillStyle = `rgba(${fill},${0.15 * fa})`; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(${fill},${0.3 * fa})`; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * prog, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(${f.rgb},${0.8 * blink})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(${f.rgb},0.6)`; ctx.lineWidth = 1.5; // 准星
      ctx.beginPath(); ctx.moveTo(f.x - f.r * 0.3, f.y); ctx.lineTo(f.x + f.r * 0.3, f.y); ctx.moveTo(f.x, f.y - f.r * 0.3); ctx.lineTo(f.x, f.y + f.r * 0.3); ctx.stroke();
    } else if (f.kind === 'ring') {
      ctx.strokeStyle = `rgba(${f.rgb},${0.35 + 0.5 * blink})`; ctx.lineWidth = 4; ctx.setLineDash([16, 10]);
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = `rgba(${fill},${(0.05 + 0.12 * prog) * fa})`; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * prog, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  for (const z of S.ezones) { // 地上的火
    const a = Math.min(1, z.life / 0.5);
    ctx.globalCompositeOperation = 'lighter';
    FX.glow(ctx, z.x, z.y, z.r * (1.3 + 0.15 * Math.sin(S.t * 18 + z.x)), z.rgb, 0.45 * a);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  for (const r of S.erings) { // 周瑜的琴音：亮环 + 一道缺口（缺口两端有标记）
    const a = Math.min(1, (r.maxR - r.r) / 120);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35 * a; ctx.strokeStyle = `rgb(${r.rgb})`; ctx.lineWidth = 22;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, r.gapA + r.gap, r.gapA - r.gap + TAU); ctx.stroke();
    ctx.globalAlpha = 0.9 * a; ctx.strokeStyle = 'rgb(255,240,225)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, r.gapA + r.gap, r.gapA - r.gap + TAU); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.8 * a; ctx.fillStyle = '#fff4e0';
    for (const s of [-1, 1]) { const ga = r.gapA + s * r.gap; ctx.beginPath(); ctx.arc(r.x + Math.cos(ga) * r.r, r.y + Math.sin(ga) * r.r, 5, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  for (const s of S.strikes) { // 玩家的落石 / 火船：落点淡圈 + 从天而降的影子
    const k = 1 - Math.max(0, s.t) / s.max;
    if (s.kind === 'bolt') continue;
    const rgb = s.kind === 'fire' ? '255,140,60' : '230,200,120';
    ctx.strokeStyle = `rgba(${rgb},${0.25 + 0.35 * k})`; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    const fy = s.y - (1 - k) * 260;
    if (s.kind === 'fire') {
      ctx.globalCompositeOperation = 'lighter';
      FX.glow(ctx, s.x - (1 - k) * 120, fy, 18 + 10 * k, '255,140,50', 0.9);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = `rgba(0,0,0,${0.2 + 0.25 * k})`;
      ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r * 0.35 * (0.4 + 0.6 * k), s.r * 0.16 * (0.4 + 0.6 * k), 0, 0, TAU); ctx.fill();
      // 下坠的巨石：顶部受光、底部暗，带一圈符力金光
      const rs = 9 + 6 * k;
      const rock = ctx.createLinearGradient(s.x - rs, fy - rs, s.x + rs * 0.6, fy + rs);
      rock.addColorStop(0, '#a89880'); rock.addColorStop(0.55, '#6a5c4c'); rock.addColorStop(1, '#2e261e');
      ctx.globalCompositeOperation = 'lighter';
      FX.glow(ctx, s.x, fy, rs * 2.2, '255,210,110', 0.35 + 0.3 * k);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.fillStyle = rock;
      ctx.beginPath(); ctx.moveTo(s.x - rs, fy); ctx.lineTo(s.x - rs * 0.4, fy - rs); ctx.lineTo(s.x + rs * 0.7, fy - rs * 0.8); ctx.lineTo(s.x + rs, fy + rs * 0.2); ctx.lineTo(s.x + rs * 0.2, fy + rs * 0.8); ctx.closePath(); ctx.fill();
      // 符纸：落点上方悬着一张发光的黄符
      ctx.globalCompositeOperation = 'lighter';
      FX.glow(ctx, s.x, s.y - 27, 14, '255,215,90', 0.6);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#f0d060'; ctx.fillRect(s.x - 4, s.y - 34, 8, 14);
      ctx.fillStyle = '#b8352a'; ctx.fillRect(s.x - 1, s.y - 32, 2, 10);
      ctx.globalAlpha = 1;
    }
  }
}

function drawPickups() {
  for (const g of S.pickups) {
    if (g.kind === 'heal') {
      ctx.fillStyle = '#f3ead6'; ctx.strokeStyle = '#6b5a3a'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(g.x, g.y, 8, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(g.x - 4, g.y - 2); ctx.quadraticCurveTo(g.x, g.y - 7, g.x + 4, g.y - 2); ctx.stroke();
      continue;
    }
    if (g.kind === 'gold') { // 金元宝：船形金锭，带一点闪光
      const s = 1 + Math.min(1, g.v / 10) * 0.5, bob = Math.sin(S.t * 4 + g.x) * 1.5;
      ctx.globalCompositeOperation = 'lighter'; FX.glow(ctx, g.x, g.y - 2 + bob, 16 * s, '255,200,80', 0.45); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      const gr = ctx.createLinearGradient(0, g.y - 9 * s + bob, 0, g.y + 5 * s + bob);
      gr.addColorStop(0, '#fff2b0'); gr.addColorStop(0.5, '#e8b440'); gr.addColorStop(1, '#a86e14');
      ctx.fillStyle = gr; ctx.strokeStyle = 'rgba(90,50,8,0.9)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(g.x - 9 * s, g.y - 4 * s + bob); ctx.quadraticCurveTo(g.x, g.y + 7 * s + bob, g.x + 9 * s, g.y - 4 * s + bob);
      ctx.quadraticCurveTo(g.x, g.y - 1 * s + bob, g.x - 9 * s, g.y - 4 * s + bob); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(g.x, g.y - 4 * s + bob, 4 * s, 3.5 * s, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
      continue;
    }
    if (g.kind === 'vacuum') { // 军令牌
      const pulse = 1 + 0.12 * Math.sin(S.t * 6);
      ctx.fillStyle = 'rgba(207,163,74,0.25)';
      ctx.beginPath(); ctx.arc(g.x, g.y, 16 * pulse, 0, TAU); ctx.fill();
      ctx.fillStyle = '#b5372a'; ctx.strokeStyle = '#cfa34a'; ctx.lineWidth = 2;
      ctx.fillRect(g.x - 8, g.y - 10, 16, 20); ctx.strokeRect(g.x - 8, g.y - 10, 16, 20);
      ctx.fillStyle = '#ebe0c5'; ctx.font = `900 12px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('令', g.x, g.y + 1);
      continue;
    }
    // 铜钱：外圆内方
    const big = g.v >= 10, mid = g.v >= 3;
    const r = big ? 7 : mid ? 6 : 4.5;
    // 身上一层淡淡的光，在地上能看出来就行（亮度慢慢起伏）
    ctx.globalCompositeOperation = 'lighter';
    FX.glow(ctx, g.x, g.y, Math.max(16, r * 3), big ? '255,205,90' : mid ? '200,215,235' : '240,170,95', (big || mid ? 0.2 : 0.28) + 0.06 * Math.sin(S.t * 3 + g.x * 0.05));
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = big ? '#e3b341' : mid ? '#c9ccd1' : '#b8743a';
    ctx.strokeStyle = 'rgba(20,16,10,0.8)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(g.x, g.y, r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#27231a';
    const q = r * 0.36;
    ctx.fillRect(g.x - q, g.y - q, q * 2, q * 2);
  }
}

// 头顶小血条 + 名字
function headBar(x, y, w, frac, color, name) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - w / 2, y, w, 4);
  ctx.fillStyle = color; ctx.fillRect(x - w / 2, y, w * Math.max(0, frac), 4);
  if (name) {
    ctx.font = `700 13px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = 3; ctx.strokeStyle = '#15120d'; ctx.strokeText(name, x, y - 3);
    ctx.fillStyle = '#ebe0c5'; ctx.fillText(name, x, y - 3);
  }
}
function drawEliteUnit(e) {
  const p = S.player, d = e.def;
  // 脚下红金色光圈，提示这是精英
  const pr = 0.5 + 0.5 * Math.sin(S.t * 5 + e.id);
  ctx.strokeStyle = `rgba(230,120,60,${0.55 + 0.3 * pr})`; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.6, e.r * 1.25, e.r * 0.45, 0, 0, TAU); ctx.stroke();
  const spr = unitSprite(e.type, d.look, d.h, e.flash > 0, d.mount || '');
  const fx = faceToward(e, e.state === 'charge' ? e.x + Math.cos(e.ang) * 10 : p.x);
  if (e.state === 'charge' && S.t - (e.ghostT || 0) > 0.05) { addGhost(spr, e.x, e.y + e.r * 0.6, fx, 0.35); e.ghostT = S.t; }
  const top = drawUnit(spr, e.x, e.y, e.r, fx, walkBob(e.id, e.state === 'chase' || e.state === 'charge') * 1.3);
  e.topY = top;
  drawShieldAura(e, (e.y + e.r * 0.6 - top));
  headBar(e.x, top - 8, 40, e.hp / e.maxHp, '#e0703a', d.name);
  if (e.shieldMax) { // 护甲条：贴在血条上方
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(e.x - 20, top - 12, 40, 3);
    ctx.fillStyle = '#a9c8ff'; ctx.fillRect(e.x - 20, top - 12, 40 * e.shield / e.shieldMax, 3);
  }
}
// 护甲护体：周身一层流动的淡金蓝光罩，被打时闪一下；破甲后易伤期间身上冒红光
function drawShieldAura(e, h) {
  const cy = e.y + e.r * 0.6 - h * 0.45, rx = Math.max(e.r * 1.3, h * 0.42), ry = h * 0.58;
  ctx.globalCompositeOperation = 'lighter';
  if (e.shield > 0) {
    const f = e.shield / e.shieldMax, hit = Math.max(0, 1 - (S.t - e.shieldHitT) * 6);
    const g = ctx.createRadialGradient(e.x, cy, Math.min(rx, ry) * 0.55, e.x, cy, Math.max(rx, ry));
    g.addColorStop(0, 'rgba(150,190,255,0)'); g.addColorStop(0.82, `rgba(150,190,255,${0.08 + 0.1 * f + 0.25 * hit})`); g.addColorStop(1, 'rgba(150,190,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(e.x, cy, rx, ry, 0, 0, TAU); ctx.fill();
    ctx.lineWidth = 1.4;
    for (let k = 0; k < 2; k++) { // 两道沿光罩缓缓流动的亮弧
      const a = S.t * (1.6 + k * 0.7) + k * 2.4 + e.id;
      ctx.strokeStyle = `rgba(225,235,255,${0.25 + 0.35 * f + 0.4 * hit})`;
      ctx.beginPath(); ctx.ellipse(e.x, cy, rx, ry, 0, a, a + 0.9 + f); ctx.stroke();
    }
  } else if (e.vulnT > S.t) {
    FX.glow(ctx, e.x, cy, Math.max(rx, ry), '255,70,50', 0.18 + 0.08 * Math.sin(S.t * 14));
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
}
function drawAlly(a) {
  const d = a.def;
  ctx.strokeStyle = 'rgba(110,170,255,0.8)'; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.ellipse(a.x, a.y + d.r * 0.6, d.r * 1.05, d.r * 0.4, 0, 0, TAU); ctx.stroke();
  const spr = unitSprite(d.art || a.type, d.look, d.h, a.flash > 0, d.mount || '');
  if (d.shade) { ctx.globalCompositeOperation = 'lighter'; FX.glow(ctx, a.x, a.y - d.h * 0.4, d.h * 0.9, '150,80,220', 0.35); ctx.globalCompositeOperation = 'source-over'; } // 死士：一团紫色的冥光
  const rise = d.shade && a.born !== undefined ? Math.min(1, (S.t - a.born) / 0.35) : 1; // 从土里爬出来
  ctx.globalAlpha = (d.shade ? 0.82 : 1) * rise;
  if (a.until && a.until - S.t < 1) ctx.globalAlpha *= Math.max(0.2, a.until - S.t); // 快散去时渐隐
  const top = drawUnit(spr, a.x, a.y + (1 - rise) * d.h * 0.6, d.r, a.fx, walkBob(a.id, a.moving));
  ctx.globalAlpha = 1;
  if (a.hp < a.maxHp) headBar(a.x, top - 6, 26, a.hp / a.maxHp, '#6fa8ff'); // 受伤了才显示血条
}
// 据点建筑：有美术图用图，否则用代码画的；靠近时显示奖励说明
// 单个铁蒺藜贴图（有美术图就用图）
function caltropTex() {
  const art = window.Assets.get('prop:caltrop');
  const ck = 'caltrop|' + (art ? 'a' : 'c');
  let c = spriteCache.get(ck);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = Math.ceil(30 * DPR * ZOOM);
  const g = c.getContext('2d');
  if (art) g.drawImage(art, 0, 0, c.width, c.height);
  else { g.scale(c.width / 30, c.height / 30); Sprites.caltrop(g, 15, 15, 13.5, 0); }
  spriteCache.set(ck, c);
  return c;
}
function buildingSprite(bid, flash) {
  const art = window.Assets.get('building:' + bid);
  const ck = `bld|${bid}|${flash ? 1 : 0}|${art ? 'a' : 'c'}`;
  let s = spriteCache.get(ck);
  if (s) return s;
  const r = D.buildings[bid].r, sc = DPR * ZOOM;
  const w = r * 3, h = art ? w * art.naturalHeight / art.naturalWidth : w * Sprites.BLD_H / Sprites.BLD_W;
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * sc); c.height = Math.ceil(h * sc);
  const g = c.getContext('2d');
  if (art) g.drawImage(art, 0, 0, c.width, c.height);
  else { g.scale(c.width / Sprites.BLD_W, c.height / Sprites.BLD_H); Sprites.building(g, bid); g.setTransform(1, 0, 0, 1, 0, 0); }
  if (flash) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,240,220,0.45)'; g.fillRect(0, 0, c.width, c.height); }
  s = { c, w, h };
  spriteCache.set(ck, s);
  return s;
}
function drawBuilding(e) {
  const p = S.player, def = e.def, spr = buildingSprite(e.bid, e.flash > 0);
  const footY = e.y + e.r * 0.55;
  ctx.drawImage(spr.c, e.x - spr.w / 2, footY - spr.h, spr.w, spr.h);
  const top = footY - spr.h;
  headBar(e.x, top - 6, def.special ? 96 : 64, e.hp / e.maxHp, '#c9a046', def.name);
  if (def.special && !def.tomb) { // 乔府：门前挂两盏灯笼；府门紧闭时罩一层淡金色的结界
    if (e.bid === 'qiaofu' && !window.Assets.get('building:' + e.bid)) for (const s of [-1, 1]) FX.lantern(ctx, e.x + s * e.r * 0.62, footY - spr.h * 0.42 + Math.sin(S.t * 2 + s) * 2, 9, 0.9); // 美术图里已经画了灯笼
    if (e.sealed) {
      ctx.strokeStyle = `rgba(255,215,130,${0.35 + 0.2 * Math.sin(S.t * 3)})`; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.ellipse(e.x, footY - spr.h * 0.45, spr.w * 0.62, spr.h * 0.62, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  if (!def.tomb && dist2(e.x, e.y, p.x, p.y) < 380 * 380) { // 走近时提示奖励（疑冢一圈五座，不逐个写，横幅里说过了）
    ctx.font = `600 12px ${FONT}`; ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = '#15120d'; ctx.strokeText(def.desc, e.x, footY + 18);
    ctx.fillStyle = '#ffd98a'; ctx.fillText(def.desc, e.x, footY + 18);
  }
}

function drawEnemies() {
  const p = S.player;
  // 先画靠上的，再画靠下的，前后遮挡才自然
  const list = [...S.enemies.filter(e => !e.boss), ...S.allies].sort((a, b) => a.y - b.y);
  for (const e of list) {
    if (e.building) { drawBuilding(e); continue; }
    if (e.def.kind === 'melee' || e.def.kind === 'ranged') { drawAlly(e); continue; }
    if (e.ai) { drawEliteUnit(e); continue; }
    const d = e.def, stunned = e.stunT > S.t;
    if (e.elite) { // 精英：脚下金色光圈，体型更大
      ctx.strokeStyle = 'rgba(207,163,74,0.85)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.6, e.r * 1.2, e.r * 0.45, 0, 0, TAU); ctx.stroke();
    }
    if (e.slowT > S.t) { ctx.strokeStyle = 'rgba(160,190,210,0.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.6, e.r + 3, e.r * 0.45, 0, 0, TAU); ctx.stroke(); }
    const h = (d.h || 36) * (e.elite ? 1.3 : 1);
    const spr = unitSprite(e.type, d.look, h, e.flash > 0, d.mount || '');
    const moving = !stunned && !(d.ranged && Math.hypot(p.x - e.x, p.y - e.y) < d.ranged.range);
    const top = drawUnit(spr, e.x, e.y, e.r, faceToward(e, p.x), walkBob(e.id, moving));
    if (e.frozenT > S.t) { // 寒冰冻住：罩一层冰
      ctx.fillStyle = 'rgba(170,220,255,0.38)'; ctx.strokeStyle = 'rgba(225,245,255,0.8)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(e.x, (top + e.y) / 2 + e.r * 0.3, e.r * 1.05, (e.y - top) / 2 + e.r * 0.4, 0, 0, TAU); ctx.fill(); ctx.stroke();
    } else if (stunned) { // 被咆哮定身：头顶转圈
      ctx.strokeStyle = 'rgba(255,220,120,0.85)'; ctx.lineWidth = 1.8;
      const a = S.t * 6;
      ctx.beginPath(); ctx.ellipse(e.x, top - 3, 9, 3.5, 0, a, a + 4.5); ctx.stroke();
    }
  }
  for (const e of S.bossList) {
    const g = e.def, h = e.r * 2.6;
    if (e.skyHidden || e.vanish) continue; // 马超「神威天降」：跃上半空；司马懿藏进疑冢：看不见
    if (e.enraged) {
      const pr = 0.5 + 0.5 * Math.sin(S.t * 8);
      ctx.fillStyle = `rgba(200,40,30,${0.16 + 0.14 * pr})`;
      ctx.beginPath(); ctx.ellipse(e.x, e.y - h * 0.25, e.r + 14 + pr * 6, h * 0.62, 0, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(207,163,74,0.9)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.6, e.r * 1.1, e.r * 0.4, 0, 0, TAU); ctx.stroke();
    if (g.el) { // 属性名将：周身一层属性光，不时迸出属性光点
      const ergb = D.elements[g.el].rgb;
      ctx.globalCompositeOperation = 'lighter';
      FX.glow(ctx, e.x, e.y - h * 0.3, h * 0.75, ergb, 0.22 + 0.08 * Math.sin(S.t * 5));
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.strokeStyle = `rgba(${ergb},0.8)`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.6, e.r * 1.3, e.r * 0.48, 0, 0, TAU); ctx.stroke();
      if (Math.random() < 0.25) elSpark(g.el, e.x + rand(-e.r, e.r), e.y - rand(0, h));
    }
    const U = e.ult, dashing = U && U.phase === 2 && /Dash$/.test(U.u.type);
    const moving = e.state === 'chase' || e.state === 'charge' || dashing || (U && U.u.type === 'whirl');
    const urgb = g.ultRgb || '255,80,60';
    if (U) { // 放大招时周身发出专属色的光
      ctx.globalCompositeOperation = 'lighter';
      FX.glow(ctx, e.x, e.y - h * 0.4 - (e.leapH || 0), h * 0.9, urgb, 0.35 + 0.15 * Math.sin(S.t * 20));
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    if (e.dr) { // 减伤：脚下一圈慢慢转的护体法阵，濒死时变成红色、更亮
      FX.sprite(ctx, 'circle', e.phase > 1 ? '255,120,80' : '255,210,110', e.x, e.y + e.r * 0.6, e.r * 4.4, e.r * 4.4, S.t * 1.4, e.phase > 1 ? 0.7 : 0.45, 0.3, 0.45);
      ctx.globalAlpha = 1;
    }
    if (e.frenzyT > S.t) { // 狂暴：红色火焰气场
      ctx.globalCompositeOperation = 'lighter';
      FX.glow(ctx, e.x, e.y - h * 0.35, h * 0.85, '255,50,30', 0.4 + 0.15 * Math.sin(S.t * 16));
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    // 骑上赤兔：换成骑马的小人（有美术图用 lubu_mounted，否则用代码画的骑马版本）
    const riding = e.mounted || (g.rideCharge && (e.state === 'charge' || e.state === 'tele_charge'));
    const spr = riding ? unitSprite(e.gid + '_mounted', g.look, h * 1.2, e.flash > 0, g.mount || '#b5372a') : unitSprite(e.gid, g.look, h, e.flash > 0, '');
    if (g.dragonTrail) drawDragonTrail(e.trail, '235,245,255', 1, 'fx:dragon_white', 34); // 赵云：白龙随行
    let fx = faceToward(e, dashing ? e.x + Math.cos(U.ang) * 10 : e.state === 'charge' ? e.x + Math.cos(e.ang) * 10 : p.x);
    if (e.whirl) fx = Math.sin(S.t * 28) > 0 ? 1 : -1; // 狂刃：原地急转
    if ((e.state === 'charge' || dashing) && S.t - (e.ghostT || 0) > 0.035) { addGhost(spr, e.x, e.y + e.r * 0.6, fx, dashing ? 0.5 : 0.4); e.ghostT = S.t; } // 冲锋残影
    if (e.whirl) { // 周身旋转的刀风：两层旋风贴图反向转，贴地压扁
      const R = (U && U.u.radius) || 95;
      FX.sprite(ctx, 'whirl', urgb, e.x, e.y - 10, R * 2.6, R * 2.6, S.t * 14, 0.85, 0.45, 0.5);
      FX.sprite(ctx, 'whirl', '255,255,255', e.x, e.y - 30, R * 1.8, R * 1.8, -S.t * 10, 0.35, 0, 0.45);
      ctx.globalAlpha = 1;
    }
    const top = drawUnit(spr, e.x, e.y, e.r, fx, walkBob(e.id, moving) * 1.6 + (e.leapH || 0));
    e.topY = top;
    drawShieldAura(e, e.y + e.r * 0.6 - top);
    ctx.font = `20px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = 4; ctx.strokeStyle = '#15120d'; ctx.fillStyle = '#ebe0c5';
    ctx.strokeText(g.name, e.x, top - 6); ctx.fillText(g.name, e.x, top - 6);
  }
}

// 带属性的飞弹：箭矢、文气整个换成属性的样子（有 GPT 画的属性箭 / 属性弹就用图）；其他飞弹外面裹一层属性光
function drawElProj(b) {
  const E = D.elements[b.el], sp = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / sp, uy = b.vy / sp, ang = Math.atan2(uy, ux);
  if (b.kind === 'arrow') {
    const img = window.Assets.get('elfx:arrow_' + b.el);
    if (img) { // 图里箭尖在最右边、箭杆在正中：箭尖对准飞弹位置稍前一点
      const w = 104, h = w * img.height / img.width;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(b.x + ux * 8, b.y + uy * 8); ctx.rotate(ang);
      ctx.drawImage(img, -w, -h / 2, w, h); ctx.restore(); ctx.globalAlpha = 1;
      return true;
    }
    FX.sprite(ctx, 'thrust', E.rgb, b.x - ux * 38, b.y - uy * 38, 100, 20, ang, 0.95, 0.55);
    ctx.strokeStyle = `rgb(${E.core})`; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(b.x - ux * 18, b.y - uy * 18); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.fillStyle = `rgb(${E.core})`;
    ctx.beginPath(); ctx.moveTo(b.x + ux * 8, b.y + uy * 8); ctx.lineTo(b.x - uy * 3.5, b.y + ux * 3.5); ctx.lineTo(b.x + uy * 3.5, b.y - ux * 3.5); ctx.fill();
    ctx.globalCompositeOperation = 'lighter'; FX.glow(ctx, b.x, b.y, 12, E.rgb, 0.8); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    return true;
  }
  if (b.kind === 'orb') {
    const img = window.Assets.get('elfx:orb_' + b.el), s = b.r * 5.5;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    if (img) { ctx.translate(b.x, b.y); ctx.rotate(S.t * 4 + b.x * 0.01); ctx.drawImage(img, -s / 2, -s / 2, s, s); }
    else {
      FX.glow(ctx, b.x, b.y, b.r * 3.4, E.rgb, 0.85);
      FX.glow(ctx, b.x, b.y, b.r * 1.3, E.core, 1);
      if (b.el === 'thunder') { // 雷：外面绕几道小电弧
        ctx.strokeStyle = `rgba(${E.core},0.9)`; ctx.lineWidth = 1.4; ctx.beginPath();
        for (let k = 0; k < 3; k++) { const a = rand(0, TAU); ctx.moveTo(b.x + Math.cos(a) * 4, b.y + Math.sin(a) * 4); ctx.lineTo(b.x + Math.cos(a + 0.4) * 10, b.y + Math.sin(a + 0.4) * 10); ctx.lineTo(b.x + Math.cos(a - 0.2) * 15, b.y + Math.sin(a - 0.2) * 15); }
        ctx.stroke();
      } else if (b.el === 'wind') { // 风：一圈旋转的气流
        ctx.strokeStyle = `rgba(${E.rgb},0.7)`; ctx.lineWidth = 2;
        for (let k = 0; k < 2; k++) { const a = S.t * 10 + k * Math.PI; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 2, a, a + 1.8); ctx.stroke(); }
      } else if (b.el === 'ice') FX.snowflake && FX.snowflake(ctx, b.x, b.y, b.r * 1.4, S.t * 2, 0.9);
    }
    ctx.restore(); ctx.globalAlpha = 1;
    return true;
  }
  ctx.globalCompositeOperation = 'lighter'; // 其他飞弹：外裹属性光
  FX.glow(ctx, b.x, b.y, Math.max(16, b.r * 3), E.rgb, 0.55);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  return false;
}
function drawProjectiles() {
  ctx.lineCap = 'round';
  for (const b of S.proj) {
    if (b.el && drawElProj(b)) continue;
    if (b.kind === 'arrow') {
      const sp = Math.hypot(b.vx, b.vy), ux = b.vx / sp, uy = b.vy / sp;
      if (b.glow) FX.sprite(ctx, 'thrust', b.glow, b.x - ux * 40, b.y - uy * 40, 110, 22, Math.atan2(uy, ux), 0.9, 0.6); // 神弩光箭
      ctx.strokeStyle = 'rgba(255,245,220,0.18)'; ctx.lineWidth = 4; // 破空的尾迹
      ctx.beginPath(); ctx.moveTo(b.x - ux * 46, b.y - uy * 46); ctx.lineTo(b.x - ux * 10, b.y - uy * 10); ctx.stroke();
      ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(b.x - ux * 18, b.y - uy * 18); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.fillStyle = '#ebe0c5'; // 箭羽
      ctx.beginPath(); ctx.moveTo(b.x - ux * 18, b.y - uy * 18); ctx.lineTo(b.x - ux * 13 - uy * 3, b.y - uy * 13 + ux * 3); ctx.lineTo(b.x - ux * 13 + uy * 3, b.y - uy * 13 - ux * 3); ctx.fill();
      ctx.fillStyle = '#dfe3e6';
      ctx.beginPath(); ctx.moveTo(b.x + ux * 7, b.y + uy * 7); ctx.lineTo(b.x - uy * 3, b.y + ux * 3); ctx.lineTo(b.x + uy * 3, b.y - ux * 3); ctx.fill();
    } else if (b.kind === 'orb') { // 竹简文气：发光的青色气团
      ctx.globalCompositeOperation = 'lighter';
      FX.glow(ctx, b.x, b.y, b.r * 3.2, '110,230,190', 0.8);
      FX.glow(ctx, b.x, b.y, b.r * 1.3, '230,255,245', 1);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    } else if (b.kind === 'crescent') { // 青龙刀气：一条游动的小青龙
      const a = Math.atan2(b.vy, b.vx), fade = Math.min(1, b.life * 2.5);
      FX.dragon(ctx, FX.swimPts(b.x, b.y, a, b.r * 7, 14, b.r * 0.45, S.t * 12 + b.seed),
        { rgb: '90,235,170', core: '225,255,240', w: b.r * 0.95, a: fade, head: window.Assets.get('fx:dragon_azure'), t: S.t + b.seed });
    } else if (b.kind === 'lantern') { // 莲灯：一盏飘着的莲花灯
      FX.lantern(ctx, b.x, b.y - 6 + Math.sin(S.t * 4 + b.spin) * 3, 10, 1);
    } else if (b.kind === 'wisp') { // 鬼火：一团青绿的冷焰
      FX.wisp(ctx, b.x, b.y + 4, 8, S.t + b.spin, 1);
    } else if (b.kind === 'butterfly') { // 彩蝶：紫光里一只扇着翅膀的蝴蝶
      ctx.globalCompositeOperation = 'lighter';
      FX.glow(ctx, b.x, b.y, 18, b.rgb || '190,140,255', 0.5);
      ctx.globalCompositeOperation = 'source-over';
      FX.butterfly(ctx, b.x, b.y, 8, Math.atan2(b.vy, b.vx) + Math.PI / 2, S.t * 7 + b.spin, '215,175,255', 1);
      ctx.globalAlpha = 1;
    } else if (b.kind === 'petal') { // 落樱：粉光里一片打着转的樱花瓣
      ctx.globalCompositeOperation = 'lighter';
      FX.glow(ctx, b.x, b.y, 18, '255,130,190', 0.55);
      ctx.globalCompositeOperation = 'source-over';
      FX.petal(ctx, b.x, b.y, 8, b.spin, '255,170,210', 1);
      ctx.globalAlpha = 1;
    } else if (b.kind === 'page') { // 兵书：一张翻飞的书页，带金色光尾
      const sp = Math.hypot(b.vx, b.vy) || 1;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,210,130,0.35)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(b.x - b.vx / sp * 24, b.y - b.vy / sp * 24); ctx.lineTo(b.x, b.y); ctx.stroke();
      FX.glow(ctx, b.x, b.y, 18, '255,200,110', 0.55);
      ctx.globalCompositeOperation = 'source-over';
      FX.page(ctx, b.x, b.y, 8, Math.sin(b.spin) * 0.5, 1, Math.cos(b.spin * 1.7));
      ctx.globalAlpha = 1;
    } else if (b.kind === 'boom' && b.fan) { // 飞扇：旋转的铁骨折扇 + 一圈红光
      ctx.globalCompositeOperation = 'lighter';
      FX.glow(ctx, b.x, b.y, 26, '255,140,90', 0.45);
      ctx.strokeStyle = 'rgba(255,190,140,0.4)'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(b.x, b.y, 16, b.spin - 2.2, b.spin); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      FX.fan(ctx, b.x, b.y + 6, 17, b.spin, '232,106,80', 1);
      ctx.globalAlpha = 1;
    } else if (b.kind === 'boom') { // 双铁戟：高速旋转的钢刃，只留下一圈金属反光
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (let k = 0; k < 2; k++) {
        const a0 = b.spin + k * Math.PI;
        const g = ctx.createConicGradient ? ctx.createConicGradient(a0 - 2.4, b.x, b.y) : null;
        if (g) { g.addColorStop(0, 'rgba(200,210,225,0)'); g.addColorStop(0.38, 'rgba(225,232,240,0.55)'); g.addColorStop(0.4, 'rgba(0,0,0,0)'); ctx.strokeStyle = g; }
        else ctx.strokeStyle = 'rgba(220,228,236,0.35)';
        ctx.lineWidth = 7;
        ctx.beginPath(); ctx.arc(b.x, b.y, 15, a0 - 2.4, a0); ctx.stroke();
        FX.glow(ctx, b.x + Math.cos(a0) * 15, b.y + Math.sin(a0) * 15, 9, '235,240,250', 0.9);
      }
      FX.glow(ctx, b.x, b.y, 22, '255,150,90', 0.25);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.spin);
      ctx.strokeStyle = 'rgba(58,42,30,0.9)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(13, 0); ctx.stroke();
      const steel = ctx.createLinearGradient(0, -15, 0, 15); steel.addColorStop(0, '#f4f7fa'); steel.addColorStop(0.5, '#8d96a0'); steel.addColorStop(1, '#dfe5ea');
      ctx.fillStyle = steel;
      for (const s of [1, -1]) { ctx.beginPath(); ctx.moveTo(13 * s, -3 * s); ctx.quadraticCurveTo(21 * s, -14 * s, 8 * s, -15 * s); ctx.quadraticCurveTo(12 * s, -8 * s, 10 * s, -3 * s); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    } else if (b.kind === 'bean') { // 豆兵：一团金光里隐约的人形，拖着金色光尾
      const hop = Math.abs(Math.sin(S.t * 14 + b.seed)) * 4, sp = Math.hypot(b.vx, b.vy) || 1;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,200,90,0.35)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(b.x - b.vx / sp * 26, b.y - b.vy / sp * 26); ctx.lineTo(b.x, b.y - hop); ctx.stroke();
      FX.glow(ctx, b.x, b.y - 6 - hop, 20, '255,190,70', 0.7);
      ctx.globalAlpha = 0.9; ctx.fillStyle = 'rgb(255,236,170)';
      ctx.beginPath(); ctx.ellipse(b.x, b.y - 3 - hop, 3.6, 5.6, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(b.x, b.y - 11 - hop, 3, 0, TAU); ctx.fill();
      FX.glow(ctx, b.x, b.y - 8 - hop, 7, '255,255,230', 0.9);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    } else if (b.kind === 'fire') { // 羽扇火球
      ctx.globalCompositeOperation = 'lighter';
      const fl = 1 + 0.12 * Math.sin(S.t * 30 + b.x);
      FX.glow(ctx, b.x, b.y, b.r * 3.4 * fl, '255,120,40', 0.85);
      FX.glow(ctx, b.x, b.y, b.r * 1.6, '255,220,140', 1);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    } else { // 飞蝗石：带一道残影
      const sp = Math.hypot(b.vx, b.vy) || 1;
      ctx.strokeStyle = 'rgba(200,195,185,0.3)'; ctx.lineWidth = b.r * 1.6;
      ctx.beginPath(); ctx.moveTo(b.x - b.vx / sp * 22, b.y - b.vy / sp * 22); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.fillStyle = '#9b958a'; ctx.strokeStyle = '#2a2520'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.35, 0, TAU); ctx.fill();
    }
  }
  for (const b of S.eproj) {
    const sp = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / sp, uy = b.vy / sp;
    if (b.el) { // 属性名将的飞弹：外裹一层属性光
      ctx.globalCompositeOperation = 'lighter';
      FX.glow(ctx, b.x, b.y, Math.max(20, b.r * 3.4), D.elements[b.el].rgb, 0.65);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    if (b.kind === 'bigArrow') { // 吕布、诸葛亮的大箭：拖着一道枪芒般的长光
      const a = Math.atan2(uy, ux), L = b.r * 16;
      FX.sprite(ctx, 'thrust', b.rgb, b.x - ux * L * 0.45, b.y - uy * L * 0.45, L, b.r * 4.5, a, 0.9, 0.6);
      ctx.globalCompositeOperation = 'lighter';
      FX.glow(ctx, b.x, b.y, b.r * 2.6, b.rgb, 0.9);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.strokeStyle = '#fff4e0'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(b.x - ux * b.r * 3.5, b.y - uy * b.r * 3.5); ctx.lineTo(b.x + ux * b.r, b.y + uy * b.r); ctx.stroke();
      continue;
    }
    if (b.kind === 'petal') { // 貂蝉：粉色光晕里的樱花瓣
      ctx.globalCompositeOperation = 'lighter';
      FX.glow(ctx, b.x, b.y, b.r * 2.6, '255,90,170', 0.6);
      ctx.globalCompositeOperation = 'source-over';
      FX.petal(ctx, b.x, b.y, b.r * 1.1, b.spin, '255,150,200', 1);
      ctx.globalAlpha = 1;
      continue;
    }
    if (b.kind === 'lantern') { // 大乔、乔府：飘来的莲灯，外面一圈青光提示危险
      ctx.globalCompositeOperation = 'lighter'; FX.glow(ctx, b.x, b.y, b.r * 3, '80,220,210', 0.55); ctx.globalCompositeOperation = 'source-over';
      FX.lantern(ctx, b.x, b.y + 4, b.r * 1.1, 1, '255,160,120');
      ctx.globalAlpha = 1;
      continue;
    }
    if (b.kind === 'wisp') { FX.wisp(ctx, b.x, b.y + 4, b.r * 0.9, S.t + b.spin, 1, b.wrgb); continue; } // 郭嘉：飘过来的鬼火（司马懿的是紫色）
    if (b.kind === 'butterfly') { // 小乔：一只只扑闪着飞来的蝴蝶
      ctx.globalCompositeOperation = 'lighter'; FX.glow(ctx, b.x, b.y, b.r * 3, '170,110,255', 0.55); ctx.globalCompositeOperation = 'source-over';
      FX.butterfly(ctx, b.x, b.y, b.r * 1.1, Math.atan2(uy, ux) + Math.PI / 2, S.t * 8 + b.spin, '200,150,255', 1);
      ctx.globalAlpha = 1;
      continue;
    }
    if (b.kind === 'icicle') { // 甄姬：顺着飞行方向的冰棱
      ctx.globalCompositeOperation = 'lighter';
      FX.glow(ctx, b.x, b.y, b.r * 2.6, '120,190,255', 0.6);
      ctx.globalCompositeOperation = 'source-over';
      FX.shard(ctx, b.x, b.y, b.r * 1.6, Math.atan2(uy, ux) + Math.PI / 2, 1);
      ctx.globalAlpha = 1;
      continue;
    }
    if (b.kind === 'fan') { // 孙尚香：旋转的折扇，带一圈红光
      ctx.globalCompositeOperation = 'lighter';
      FX.glow(ctx, b.x, b.y, b.r * 3, '255,90,60', 0.55);
      ctx.globalCompositeOperation = 'source-over';
      FX.fan(ctx, b.x, b.y + b.r * 0.4, b.r * 1.5, b.spin, '220,70,50', 1);
      ctx.globalAlpha = 1;
      continue;
    }
    if (b.kind === 'page') { // 兵书万卷：悬着 / 飞来的书页，外面一圈红光提示危险
      ctx.globalCompositeOperation = 'lighter';
      FX.glow(ctx, b.x, b.y, b.r * 2.6, b.wait > 0 ? '255,180,90' : '255,90,60', b.wait > 0 ? 0.4 + 0.2 * Math.sin(S.t * 14) : 0.6);
      ctx.globalCompositeOperation = 'source-over';
      FX.page(ctx, b.x, b.y, b.r, Math.sin(b.spin) * 0.4, 1, Math.cos(b.spin * 1.3));
      ctx.globalAlpha = 1;
      continue;
    }
    if (b.kind === 'ji') { // 典韦的旋转短戟：钢刃反光 + 橙红杀气
      ctx.globalCompositeOperation = 'lighter';
      FX.glow(ctx, b.x, b.y, 30, '255,110,50', 0.45);
      ctx.strokeStyle = 'rgba(255,170,120,0.45)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      for (const k of [0, Math.PI]) { ctx.beginPath(); ctx.arc(b.x, b.y, 17, b.spin + k - 2, b.spin + k); ctx.stroke(); }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.spin);
      ctx.strokeStyle = 'rgba(50,36,26,0.9)'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(16, 0); ctx.stroke();
      const steel = ctx.createLinearGradient(0, -17, 0, 17); steel.addColorStop(0, '#f6f8fa'); steel.addColorStop(0.5, '#7f8892'); steel.addColorStop(1, '#e2e7ec');
      ctx.fillStyle = steel;
      for (const s of [1, -1]) { ctx.beginPath(); ctx.moveTo(16 * s, -3 * s); ctx.quadraticCurveTo(24 * s, -16 * s, 9 * s, -17 * s); ctx.quadraticCurveTo(13 * s, -9 * s, 11 * s, -3 * s); ctx.closePath(); ctx.fill(); }
      ctx.restore();
      continue;
    }
    if (b.kind === 'dragon') { // 关羽的青龙偃月：一条巨大的青龙破空而来
      const a = Math.atan2(b.vy, b.vx);
      FX.dragon(ctx, FX.swimPts(b.x, b.y, a, b.r * 8, 20, b.r * 0.5, S.t * 9 + b.seed),
        { rgb: b.rgb, core: '230,255,242', w: b.r * 0.9, a: Math.min(1, b.life * 2), head: window.Assets.get('fx:dragon_azure'), t: S.t + b.seed });
      continue;
    }
    ctx.globalCompositeOperation = 'lighter';
    FX.glow(ctx, b.x, b.y, b.big ? 22 : 12, '255,90,60', 0.7);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    if (b.big) { // 典韦掷出的短戟
      ctx.fillStyle = 'rgba(255,122,92,0.3)';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 4, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ff7a5c'; ctx.lineWidth = 4;
    } else { ctx.strokeStyle = '#ff7a5c'; ctx.lineWidth = 2.5; }
    ctx.beginPath(); ctx.moveTo(b.x - ux * (b.big ? 24 : 16), b.y - uy * (b.big ? 24 : 16)); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
}

function drawZones() {
  for (const z of S.zones) {
    const a = Math.min(1, z.life / 0.6);
    if (z.water) { // 春江：一片青绿的莲池，水面上漂着几朵莲花
      ctx.fillStyle = `rgba(60,170,170,${0.28 * a})`;
      ctx.beginPath(); ctx.ellipse(z.x, z.y, z.r, z.r * 0.75, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(190,250,245,${0.55 * a})`; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(z.x, z.y, z.r, z.r * 0.75, 0, 0, TAU); ctx.stroke();
      for (let i = 0; i < 5; i++) { const t = z.id * 1.3 + i * 1.25, rr = z.r * (0.25 + 0.5 * ((i * 0.37) % 1)); FX.lantern(ctx, z.x + Math.cos(t) * rr, z.y + Math.sin(t) * rr * 0.7 + Math.sin(S.t * 2 + i) * 2, 8, 0.85 * a); }
      ctx.globalAlpha = 1;
      continue;
    }
    if (z.fire) { // 火烧赤壁：焦黑地面 + 跳动的火光
      ctx.fillStyle = `rgba(30,12,4,${0.3 * a})`;
      ctx.beginPath(); ctx.ellipse(z.x, z.y, z.r, z.r * 0.8, 0, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      FX.glow(ctx, z.x, z.y, z.r * (1.15 + 0.08 * Math.sin(S.t * 14 + z.id)), '255,110,40', 0.5 * a);
      for (let i = 0; i < 5; i++) {
        const t = z.id * 1.7 + i * 1.3, rr = z.r * 0.55 * ((i * 0.37) % 1);
        FX.glow(ctx, z.x + Math.cos(t) * rr, z.y + Math.sin(t) * rr * 0.8, z.r * 0.4 * (0.8 + 0.25 * Math.sin(S.t * 17 + i * 2)), '255,170,70', 0.45 * a);
      }
      for (let i = 0; i < 4; i++) { // 窜动的火舌
        const t = z.id * 2.3 + i * 1.57, rr = z.r * 0.45, fl = 0.85 + 0.25 * Math.sin(S.t * 13 + i * 2.1);
        FX.sprite(ctx, 'flame', null, z.x + Math.cos(t) * rr, z.y + Math.sin(t) * rr * 0.7 - z.r * 0.35 * fl, z.r * 0.55, z.r * 1.1 * fl, Math.sin(S.t * 5 + i) * 0.12, 0.75 * a);
      }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      continue;
    }
    if (z.ice) { // 冰封：一片泛着冷光的冰面，冰纹 + 几簇冰棱
      ctx.fillStyle = `rgba(150,205,245,${0.22 * a})`;
      ctx.beginPath(); ctx.ellipse(z.x, z.y, z.r, z.r * 0.8, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(235,248,255,${0.55 * a})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(z.x, z.y, z.r, z.r * 0.8, 0, 0, TAU); ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i < 9; i++) { const t = z.id * 0.7 + i * 0.7; ctx.moveTo(z.x + Math.cos(t) * z.r * 0.15, z.y + Math.sin(t) * z.r * 0.12); ctx.lineTo(z.x + Math.cos(t + 0.2) * z.r * 0.9, z.y + Math.sin(t + 0.2) * z.r * 0.72); }
      ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      FX.sprite(ctx, 'ring', '150,210,255', z.x, z.y, z.r * 2.2, z.r * 2.2, S.t * 0.4, 0.3 * a, 0.2, 0.8);
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 6; i++) { const t = z.id * 1.3 + i * 1.05, rr = z.r * (0.35 + 0.5 * ((i * 0.41) % 1)); FX.shard(ctx, z.x + Math.cos(t) * rr, z.y + Math.sin(t) * rr * 0.8 - 8, 12, 0, 0.85 * a); }
      ctx.globalAlpha = 1;
      continue;
    }
    if (z.formation) { // 八阵图：法阵贴图缓缓旋转，外圈一层反向转的光环
      ctx.fillStyle = `rgba(30,50,60,${0.16 * a})`;
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.fill();
      FX.sprite(ctx, 'circle', '255,205,110', z.x, z.y, z.r * 2.1, z.r * 2.1, S.t * 0.35, 0.85 * a, 0.35);
      FX.sprite(ctx, 'ring', '120,200,230', z.x, z.y, z.r * 2.2, z.r * 2.2, -S.t * 0.5, 0.35 * a, 0.2);
      ctx.globalAlpha = 1;
      continue;
    }
    if (z.formationOld) { // 旧的线描八阵图（保留备用）
      const rot = S.t * 0.3;
      ctx.fillStyle = `rgba(62,90,107,${0.18 * a})`;
      ctx.strokeStyle = `rgba(207,163,74,${0.7 * a})`; ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) { const t = rot + i * TAU / 8; ctx[i ? 'lineTo' : 'moveTo'](z.x + Math.cos(t) * z.r, z.y + Math.sin(t) * z.r); }
      ctx.fill(); ctx.stroke();
      ctx.lineWidth = 3;
      for (let i = 0; i < 8; i++) { // 八卦爻线
        const t = rot + (i + 0.5) * TAU / 8, rr = z.r * 0.78, px = Math.cos(t + Math.PI / 2) * 9, py = Math.sin(t + Math.PI / 2) * 9;
        const cx = z.x + Math.cos(t) * rr, cy = z.y + Math.sin(t) * rr;
        for (let k = -1; k <= 1; k++) {
          const ox = Math.cos(t) * k * 6, oy = Math.sin(t) * k * 6, broken = (i + k) % 2;
          ctx.beginPath();
          if (broken) { ctx.moveTo(cx + ox - px, cy + oy - py); ctx.lineTo(cx + ox - px * 0.25, cy + oy - py * 0.25); ctx.moveTo(cx + ox + px * 0.25, cy + oy + py * 0.25); ctx.lineTo(cx + ox + px, cy + oy + py); }
          else { ctx.moveTo(cx + ox - px, cy + oy - py); ctx.lineTo(cx + ox + px, cy + oy + py); }
          ctx.stroke();
        }
      }
      continue;
    }
    // 铁蒺藜阵：暗色地面 + 虚线范围圈 + 一片带金属高光的尖刺
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(10,8,5,0.12)';
    ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(200,205,210,0.3)'; ctx.lineWidth = 1.2; ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    const tex = caltropTex();
    const n = Math.round(4 + z.r / 9);
    for (let i = 0; i < n; i++) {
      const h = hash(z.id, i);
      const ang = (h & 1023) / 1023 * TAU, rr = Math.sqrt(((h >>> 10) & 1023) / 1023) * z.r * 0.85;
      const x = z.x + Math.cos(ang) * rr, y = z.y + Math.sin(ang) * rr, s = 20 + ((h >>> 20) & 7);
      ctx.save(); ctx.translate(x, y); ctx.rotate(((h >>> 24) & 255) / 255 * TAU);
      ctx.drawImage(tex, -s / 2, -s / 2, s, s);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}

// 特效贴图：放大、旋转、淡入淡出（贴地的 under 版本在角色下面画）
function drawTexFx(f) {
  const t = Math.max(0, f.life / f.max), prog = 1 - t, ease = 1 - Math.pow(1 - prog, 3);
  const s = 1 + (f.grow - 1) * ease, a = (f.fadeIn ? Math.min(1, prog / f.fadeIn) : 1) * Math.pow(t, 0.7) * (f.a === undefined ? 1 : f.a);
  const x = f.follow ? f.follow.x + (f.ox || 0) : f.x, y = f.follow ? f.follow.y + (f.oy || 0) : f.y;
  FX.sprite(ctx, f.key, f.rgb, x, y, f.w * (f.sx ? 1 + (f.sx - 1) * ease : s), f.h * s, f.rot + f.spin * prog, a, f.core, f.flat);
}
function drawEffectsUnder() { for (const f of S.effects) if (f.kind === 'tex' && f.under) drawTexFx(f); }
function drawEffects() {
  for (const f of S.effects) {
    const t = f.life / f.max;
    if (f.kind === 'tex') { if (!f.under) drawTexFx(f); }
    else if (f.kind === 'chainfx') { // 黑铁链：沿着几个点抽过去（链头跟着被钩的敌人走）
      const pts = f.tgt ? [[f.x0, f.y0], [f.tgt.x, f.tgt.y - f.tgt.r * 0.6]] : f.pts;
      for (let i = 1; i < pts.length; i++) FX.chain(ctx, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], { a: Math.min(1, t * 2), w: 6, hook: i === pts.length - 1, sag: 10 });
    }
    else if (f.kind === 'elhit') { // GPT 画的属性命中图（黑底发光，叠加着画）
      const s = f.r * 2 * (1 + (1 - t) * 0.4);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, t * 1.6) * 0.85;
      ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.drawImage(f.img, -s / 2, -s / 2, s, s); ctx.restore();
    }
    else if (f.kind === 'arc') FX.slash(ctx, f.rgb ? f : Object.assign(f, { rgb: rgbOf(f.color) }));
    else if (f.kind === 'wave') FX.shock(ctx, f.rgb ? f : Object.assign(f, { rgb: rgbOf(f.color) }));
    else if (f.kind === 'thrust') { // 枪矛直刺：一道由暗到亮的枪芒
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a);
      ctx.globalCompositeOperation = 'lighter';
      const reach = f.len * Math.min(1, (1 - t) / 0.3 + 0.3);
      const gr = ctx.createLinearGradient(0, 0, reach, 0);
      gr.addColorStop(0, `rgba(${f.rgb},0)`); gr.addColorStop(0.7, `rgba(${f.rgb},${0.55 * t})`); gr.addColorStop(1, `rgba(255,255,255,${t})`);
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.moveTo(8, -f.w * 0.22); ctx.lineTo(reach, 0); ctx.lineTo(8, f.w * 0.22); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = `rgba(${f.rgb},${0.35 * t})`; ctx.lineWidth = 1.2;
      for (const k of [-0.5, 0.5]) { ctx.beginPath(); ctx.moveTo(20, f.w * k); ctx.lineTo(reach * 0.85, f.w * k * 0.25); ctx.stroke(); }
      FX.glow(ctx, reach, 0, f.w * 0.9, f.rgb, t * 0.8);
      ctx.restore();
    } else if (f.kind === 'blast') { // 爆炸：先一下白热闪光，再是向外翻滚的火光，边缘是淡淡的热浪
      ctx.globalCompositeOperation = 'lighter';
      const rgb = f.rgb || (f.enemy ? '255,100,50' : '255,170,80'), prog = 1 - t;
      if (prog < 0.25) FX.glow(ctx, f.x, f.y, f.r * (0.6 + prog * 2), '255,250,235', (1 - prog / 0.25) * 0.9);
      FX.glow(ctx, f.x, f.y, f.r * (0.9 + 0.7 * Math.pow(prog, 0.5)), rgb, t * 0.85);
      const rr = f.r * (0.7 + 0.6 * Math.pow(prog, 0.6));
      const g = ctx.createRadialGradient(f.x, f.y, rr * 0.7, f.x, f.y, rr);
      g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(0.85, `rgba(${rgb},${0.35 * t})`); g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.globalAlpha = 1; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(f.x, f.y, rr, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    } else if (f.kind === 'levelup') { // 升级：金色光柱
      const p = S.player, a = Math.min(1, t * 1.8);
      ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createLinearGradient(0, p.y - 140, 0, p.y + 10);
      gr.addColorStop(0, 'rgba(255,215,130,0)'); gr.addColorStop(0.7, `rgba(255,215,130,${0.35 * a})`); gr.addColorStop(1, `rgba(255,240,200,${0.6 * a})`);
      const w = 22 + 10 * (1 - t);
      ctx.fillStyle = gr; ctx.fillRect(p.x - w, p.y - 140, w * 2, 150);
      ctx.globalAlpha = a; ctx.strokeStyle = 'rgba(255,215,130,0.9)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(p.x, p.y + 8, 20 + 40 * (1 - t), 7 + 14 * (1 - t), 0, 0, TAU); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
  }
  for (const r of S.rings) { // 无双：血色戟气；周郎琴：淡色音波
    const t = 1 - r.r / r.maxR;
    if (!r.rgb) FX.sprite(ctx, 'ring', '255,50,35', r.x, r.y, r.r * 2.15, r.r * 2.15, r.r * 0.004, 0.35 + 0.65 * t, 0.4); // 戟气贴图
    else FX.sprite(ctx, 'ring', r.rgb, r.x, r.y, r.r * 2.1, r.r * 2.1, 0, 0.5 * t + 0.15, 0.3);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (r.rgb ? 0.15 : 0.25) + 0.5 * t; ctx.strokeStyle = `rgb(${r.rgb || '220,40,30'})`; ctx.lineWidth = (r.w || 22) * t + 6;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.6 + 0.4 * t; ctx.strokeStyle = `rgb(${r.core || '255,170,140'})`; ctx.lineWidth = r.rgb ? 2 : 3;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke();
    if (r.rgb) { ctx.globalAlpha = 0.35 * t; ctx.beginPath(); ctx.arc(r.x, r.y, r.r * 0.86, 0, TAU); ctx.stroke(); } // 余音
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  for (const f of S.effects) { // 闪电：外层光晕 + 白色芯
    if (f.kind !== 'bolt') continue;
    const t = f.life / f.max, flick = Math.random() < 0.25 ? 0.4 : 1;
    ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const [w, a, col] of [[(f.w || 3) * 3.5, 0.25, f.rgb], [(f.w || 3), 0.9, '240,248,255']]) {
      ctx.globalAlpha = a * t * flick; ctx.strokeStyle = `rgb(${col})`; ctx.lineWidth = w;
      ctx.beginPath(); f.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
    }
    const [lx, ly] = f.pts[f.pts.length - 1];
    FX.glow(ctx, lx, ly, 30, f.rgb, 0.7 * t);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
}

function drawGhosts() { // 残影
  for (const gh of S.ghosts) {
    ctx.globalAlpha = gh.life / gh.max * gh.alpha;
    ctx.save(); ctx.translate(gh.x, gh.y); ctx.scale(gh.fx, 1);
    ctx.drawImage(gh.spr.c, -gh.spr.w / 2, -gh.spr.h, gh.spr.w, gh.spr.h);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
function addGhost(spr, x, footY, fx, alpha, life = 0.28) {
  S.ghosts.push({ spr, x, y: footY, fx, alpha, life, max: life });
  if (S.ghosts.length > 40) S.ghosts.shift();
}

function drawNumbers() {
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
  for (const n of S.numbers) {
    const age = n.max - n.life;
    const pop = age < 0.1 ? 1.45 - age / 0.1 * 0.45 : 1; // 弹出后回落
    ctx.globalAlpha = Math.min(1, n.life / n.max * 2);
    ctx.font = `900 ${Math.round(n.size * pop)}px ${FONT}`;
    const crit = n.color === '#ffcf5a';
    ctx.lineWidth = crit ? 4.5 : 3; ctx.strokeStyle = crit ? '#5a140c' : '#15120d';
    ctx.strokeText(n.text, n.x, n.y); ctx.fillStyle = n.color; ctx.fillText(n.text, n.x, n.y);
  }
  ctx.globalAlpha = 1;
}

function drawScreen() {
  const p = S.player;
  drawMist(); // 郭嘉的鬼谋迷雾
  if (S.t < S.dimT) { const k = Math.min(1, (S.dimT - S.t) / 0.4, (S.t - S.dimT + 1.4) / 0.2); ctx.fillStyle = `rgba(0,0,0,${0.45 * k})`; ctx.fillRect(0, 0, W, H); } // 拔矢啖睛：冷箭射来时画面一暗
  if (S.bossList.some(b => b.leechT > S.t) || S.t < S.rageT) { // 夏侯惇血怒 / 你的啖睛狂暴：屏幕边缘泛红
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.72);
    g.addColorStop(0, 'rgba(160,10,10,0)'); g.addColorStop(1, `rgba(160,10,10,${0.28 + 0.08 * Math.sin(S.t * 6)})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  // 屏幕外指示：武将（红）、据点（金，带距离）
  const marks = [...S.bossList.filter(e => !e.vanish).map(e => [e, '#b5372a', '#ebe0c5', e.def.icon, false]),
    ...S.enemies.filter(e => e.building).map(e => [e, '#cfa34a', '#2a2116', e.def.icon, true])];
  for (const [e, bg, fg, icon, dist] of marks) {
    const sx = W / 2 + (e.x - S.camX) * ZOOM, sy = H / 2 + (e.y - S.camY) * ZOOM;
    const m = 44;
    if (sx > m && sx < W - m && sy > m && sy < H - m) continue;
    const a = Math.atan2(sy - H / 2, sx - W / 2);
    const ex = clamp(sx, m, W - m), ey = clamp(sy, m + 60, H - m - 70); // 底部留给武将血条
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(4, -11); ctx.lineTo(4, 11); ctx.fill();
    ctx.restore();
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(ex, ey, 15, 0, TAU); ctx.fill();
    ctx.fillStyle = fg; ctx.font = `900 16px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(icon, ex, ey + 1);
    if (dist) {
      const m2 = Math.round(Math.hypot(e.x - p.x, e.y - p.y) / 10);
      ctx.font = `700 11px ${FONT}`; ctx.lineWidth = 3; ctx.strokeStyle = '#15120d';
      ctx.strokeText(`${m2} 步`, ex, ey + 25); ctx.fillStyle = '#ffd98a'; ctx.fillText(`${m2} 步`, ex, ey + 25);
    }
  }
  // 大招命中：全屏闪一下招式的颜色
  if (S.sflash) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(${S.sflash.rgb},${S.sflash.a * S.sflash.life / S.sflash.max})`; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
  // 受伤：屏幕边缘闪一下红
  if (S.hurtFlash > 0) {
    const gr = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
    gr.addColorStop(0, 'rgba(200,20,10,0)'); gr.addColorStop(1, `rgba(200,20,10,${S.hurtFlash / 0.3 * 0.45})`);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  }
  // 低血量暗红边框
  const hpf = p.hp / p.maxHp;
  if (hpf < 0.35) {
    const a = (0.35 - hpf) / 0.35 * (0.55 + 0.15 * Math.sin(S.t * 6));
    const gr = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    gr.addColorStop(0, 'rgba(120,10,5,0)'); gr.addColorStop(1, `rgba(120,10,5,${a})`);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  }
  if (joy.on) {
    ctx.strokeStyle = 'rgba(235,224,197,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 45, 0, TAU); ctx.stroke();
    const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy), k = d > 45 ? 45 / d : 1;
    ctx.fillStyle = 'rgba(235,224,197,0.45)';
    ctx.beginPath(); ctx.arc(joy.ox + dx * k, joy.oy + dy * k, 18, 0, TAU); ctx.fill();
  }
}

let idleT = 0;
function render(raw) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = groundOf().bg;
  ctx.fillRect(0, 0, W, H);
  if (!S) {
    idleT += raw;
    const cx = idleT * 24, cy = idleT * 9;
    ctx.setTransform(DPR * ZOOM, 0, 0, DPR * ZOOM, DPR * W / 2 - DPR * ZOOM * cx, DPR * H / 2 - DPR * ZOOM * cy);
    drawGround(cx, cy);
    return;
  }
  const sx = S.shake > 0 ? rand(-1, 1) * S.shake : 0, sy = S.shake > 0 ? rand(-1, 1) * S.shake : 0;
  const Z = ZOOM * (1 + 0.06 * (S.punch || 0)); // 重击时镜头往里一冲
  ctx.setTransform(DPR * Z, 0, 0, DPR * Z, DPR * (W / 2 + sx) - DPR * Z * S.camX, DPR * (H / 2 + sy) - DPR * Z * S.camY);
  drawGround(S.camX, S.camY);
  for (const f of S.decals) { // 地面裂纹；甄姬的冰面：一片淡蓝的霜，边上几道白色冰纹
    const a = Math.min(1, f.life / (f.max * 0.5));
    if (f.kind === 'dark' || f.kind === 'soul') { // 董卓：一片焦黑，边上一圈暗红；司马懿：边上一圈幽紫
      const gr = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
      gr.addColorStop(0, `rgba(6,4,8,${0.75 * a})`); gr.addColorStop(0.75, `rgba(12,6,10,${0.55 * a})`); gr.addColorStop(1, f.kind === 'soul' ? 'rgba(80,30,120,0)' : 'rgba(120,20,40,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * 0.7, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = f.kind === 'soul' ? `rgba(150,80,210,${0.45 * a})` : `rgba(170,30,60,${0.45 * a})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * 0.92, f.r * 0.64, 0, 0, TAU); ctx.stroke();
      continue;
    }
    if (f.kind === 'water') { // 大乔：一圈圈水纹
      ctx.strokeStyle = `rgba(150,235,225,${0.5 * a})`; ctx.lineWidth = 1.6;
      for (let k = 0; k < 3; k++) { const rr = f.r * (0.35 + 0.3 * k + 0.25 * (1 - f.life / f.max)); ctx.beginPath(); ctx.ellipse(f.x, f.y, rr, rr * 0.6, 0, 0, TAU); ctx.stroke(); }
      continue;
    }
    if (f.kind !== 'frost') { FX.crack(ctx, f); continue; }
    ctx.globalAlpha = 0.35 * a; ctx.fillStyle = 'rgb(170,215,245)';
    ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * 0.7, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.6 * a; ctx.strokeStyle = 'rgb(235,248,255)'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const t = i * 1.05 + f.x * 0.01; ctx.moveTo(f.x + Math.cos(t) * f.r * 0.2, f.y + Math.sin(t) * f.r * 0.14); ctx.lineTo(f.x + Math.cos(t) * f.r * 0.85, f.y + Math.sin(t) * f.r * 0.6); }
    ctx.stroke(); ctx.globalAlpha = 1;
  }
  drawZones();
  drawEffectsUnder();
  drawWeaponsUnder();
  drawTelegraphs();
  drawBossFxUnder();
  drawBossFx2Under();
  drawSimayiUnder();
  drawXiahouUnder();
  drawPickups();
  drawGhosts();
  drawEnemies();
  drawPlayer();
  drawShenbing();
  drawOrbit();
  drawProjectiles();
  drawBossFx();
  drawBossFx2();
  drawSimayiOver();
  drawXiahouOver();
  FX.particles(ctx, S.particles, false); // 烟尘、碎屑
  drawEffects();
  FX.particles(ctx, S.particles, true);  // 火花、光点（叠加发光）
  drawNumbers();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  drawScreen();
}

// ============ 主循环 ============
let last = performance.now(), hudT = 0;
function frame(now) {
  const raw = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (S && !S.paused && !S.modal && !S.over) {
    let dt = S.slowmo > 0 ? raw * 0.3 : raw;
    if (S.ultFreeze > 0) { S.ultFreeze -= raw; dt = raw * 0.04; } // 大招演出：画面近乎定格
    else if (S.hitstopT > 0) { S.hitstopT -= raw; dt = raw * 0.06; } // 重击顿帧
    S.punch = Math.max(0, (S.punch || 0) - raw * 3.5);
    S.slowmo -= raw;
    update(dt);
  }
  if (S) S.shake = Math.max(0, S.shake - raw * 30);
  Music.want(musicTrack());
  render(raw);
  hudT -= raw;
  if (S && hudT <= 0) { hudT = 0.1; updateHud(); }
  requestAnimationFrame(frame);
}

buildTitle();
requestAnimationFrame(frame);

// 调试入口（浏览器控制台里可用），方便测试数值
window.BUYI = {
  get state() { return S; },
  data: D,
  skipTo(t) { if (S) S.t = t; },
  boss(id, final) { if (S) spawnBoss(id, final); },
  chapter(i) { if (S) { S.ch = i - 1; S.endless = false; nextChapter(); } }, // 跳到第 i 章（0 起）
  shenbing(gid) { if (S) { applyChoice({ kind: 'shenbing', id: gid }); } }, // 直接拿到一件神兵（测试用）
  xp(v) { if (S) addXp(v); },
  god(on = true) { if (S) S.god = on; },
  bot(fn) { botMove = fn || null; },
  get audio() { return { track: Music.current, playing: Music.playing, voice: vClip && vClip.buffer ? +vClip.buffer.duration.toFixed(2) : null, ctx: actx && actx.state, musicOn, voiceOn, muted, files: AUDIO }; }, // 调试：现在放的是哪首
  start(originId) { startGame(originId); },
  // 快进模拟：autoPick 为 true 时自动选择第一张卡；也可以传一个函数 (opts) => 第几张
  step(sec, autoPick) {
    const n = Math.round(sec * 60);
    for (let i = 0; i < n && S && !S.over; i++) {
      if (S.modal) break;
      if (S.choice && autoPick) {
        const k = typeof autoPick === 'function' ? autoPick(S.choice.opts, S) : 0;
        const c = $('lu-cards').children[k] || $('lu-cards').querySelector('.card');
        if (c) { $('lu-cards').style.pointerEvents = ''; c.click(); }
      }
      update(1 / 60);
    }
    render(0); updateHud();
  },
};
})();
