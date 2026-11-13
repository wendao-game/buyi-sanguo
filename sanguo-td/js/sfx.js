'use strict';
/* ============================================================
 * 音效：全部用 Web Audio 现场合成，不需要音频文件（不占包体，也不用加载）
 * 音色偏柔和：拨弦、小铃、气声、软鼓，不用低沉的轰隆声和刺耳的方波；带一点混响
 * Sfx.play(名字)；同一个音效有最短间隔，同时发声的数量有上限，不会糊成一片
 * 浏览器规定要玩家点过一次屏幕才能出声，所以第一次点击时才创建音频环境
 * 开关：Save.data.sound（主城「设置 · 存档」里切换）
 * 以后想换成录好的音效：在 play() 里按名字播放音频文件即可，调用的地方不用改
 * ============================================================ */

const Sfx = (function () {
  let ac = null, master = null, noiseBuf = null, voices = 0;
  const last = {};
  const MAX_VOICES = 18;

  /* 接线：所有声音 → master → 压缩器 → 输出；另外分一路进混响，听起来有点空间感、不发干 */
  function wire(ctx, dry) {
    const m = ctx.createGain(); m.gain.value = 0.5;
    const comp = dry ? ctx.createGain() : ctx.createDynamicsCompressor();   // 很多声音叠在一起时压一下，不爆音（probe 量音量时不过压缩器：它刚启动的头半秒会把声音压小，量不准）
    m.connect(comp); comp.connect(ctx.destination);
    try {
      const len = Math.floor(ctx.sampleRate * 0.9), ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / len, 3); }
      const cv = ctx.createConvolver(), wet = ctx.createGain(), hp = ctx.createBiquadFilter();
      cv.buffer = ir; wet.gain.value = 0.2; hp.type = 'highpass'; hp.frequency.value = 400;   // 混响只留中高频，低频不拖尾
      m.connect(hp); hp.connect(cv); cv.connect(wet); wet.connect(comp);
    } catch (e) { /* 不支持混响就干声 */ }
    return m;
  }
  function ensure() {
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ac = new AC();
      master = wire(ac);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ac = null; return false; }
    return true;
  }
  function unlock() { if (ensure() && ac.state === 'suspended') ac.resume().catch(() => {}); }
  ['pointerdown', 'touchend', 'keydown'].forEach(ev => addEventListener(ev, unlock, { passive: true }));
  // 切到后台就静音，回来再恢复
  document.addEventListener('visibilitychange', () => { if (!ac) return; if (document.hidden) ac.suspend().catch(() => {}); else ac.resume().catch(() => {}); });

  function env(g, t, vol, atk, dur) {
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + atk); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function voice(node, g, t, dur) {
    voices++; node.connect(g); g.connect(master); node.start(t); node.stop(t + dur + 0.03);
    node.onended = () => { voices--; try { g.disconnect(); } catch (e) { /* 已断开 */ } };
  }
  /* 一个音：type 波形，f0→f1 滑音 */
  function tone(type, f0, f1, dur, vol, delay, atk) {
    const t = ac.currentTime + (delay || 0), o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    env(g, t, vol, atk || 0.005, dur); voice(o, g, t, dur);
  }
  /* 一段噪声过滤波器：ftype 滤波类型，f0→f1 扫频 */
  function noise(ftype, f0, f1, dur, vol, delay, q, atk) {
    const t = ac.currentTime + (delay || 0), s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; s.loop = true; f.type = ftype; f.Q.value = q || 1;
    f.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    env(g, t, vol, atk || 0.005, dur);
    voices++; s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
    s.onended = () => { voices--; try { g.disconnect(); } catch (e) { /* 已断开 */ } };
  }
  /* —— 几种柔和的音色 ——
   * pluck 拨弦 / 木琴：正弦基音 + 一点泛音，起音软、衰减快
   * bell  小铃：基音 + 不成整数倍的泛音，清亮但不刺
   * air   气声：带通噪声慢起慢收（挥刀、风、火都用它，不用低沉的轰隆声）
   * tom   软鼓：只到一百多赫兹，手机喇叭放得出来，不发闷 */
  const pluck = (f, dur, vol, delay) => { tone('sine', f, f, dur, vol, delay, 0.006); tone('triangle', f * 2, f * 2, dur * 0.45, vol * 0.22, delay, 0.006); };
  const bell = (f, dur, vol, delay) => { tone('sine', f, f, dur, vol, delay, 0.004); tone('sine', f * 2.76, f * 2.76, dur * 0.5, vol * 0.28, delay, 0.004); };
  const air = (f0, f1, dur, vol, delay, atk) => noise('bandpass', f0, f1, dur, vol, delay, 0.8, atk || dur * 0.3);
  const tom = (f, vol, delay, dur) => { tone('sine', f * 1.5, f, dur || 0.26, vol, delay, 0.008); air(f * 5, f * 3, 0.08, vol * 0.25, delay, 0.01); };

  /* 名字 → [最短间隔秒, 做法]。音高都落在五声音阶上（C D E G A），叠在一起也不难听 */
  const BANK = {
    click:    [0.05, () => { pluck(880, 0.1, 0.16); }],
    // —— 普攻（很频繁，声音都压得很轻）——
    atk_arrow:   [0.09, () => { air(3200, 5200, 0.07, 0.065, 0, 0.012); tone('sine', 1320, 990, 0.05, 0.04); }],
    atk_blade:   [0.12, () => { air(1800, 4200, 0.13, 0.09, 0, 0.03); }],
    atk_fire:    [0.14, () => { air(700, 1700, 0.2, 0.09, 0, 0.05); }],
    atk_ice:     [0.12, () => { bell(1568, 0.16, 0.06); }],
    atk_thunder: [0.14, () => { tone('sine', 988, 494, 0.1, 0.065); air(3000, 1800, 0.08, 0.045, 0, 0.01); }],
    atk_poison:  [0.16, () => { tone('sine', 523, 330, 0.15, 0.08, 0, 0.01); }],
    atk_wind:    [0.18, () => { air(600, 1500, 0.32, 0.08, 0, 0.12); }],
    crit:     [0.08, () => { bell(1976, 0.12, 0.065); }],
    // —— 大招、爆炸 ——
    ult:      [0.15, () => { [392, 440, 523, 587, 784].forEach((f, i) => pluck(f, 0.55, 0.13, i * 0.035)); air(600, 2600, 0.45, 0.07, 0, 0.15); }],   // 一串上行的拨弦 + 一阵风
    boom:     [0.10, () => { tom(165, 0.3, 0, 0.3); air(1100, 450, 0.3, 0.13, 0, 0.012); }],
    thunder:  [0.12, () => { air(2400, 900, 0.3, 0.13, 0, 0.01); tone('sine', 330, 165, 0.26, 0.14, 0, 0.008); }],
    rock:     [0.10, () => { tom(147, 0.28, 0, 0.22); air(800, 380, 0.2, 0.12, 0, 0.01); }],
    freeze:   [0.20, () => { [2093, 2637, 3136].forEach((f, i) => bell(f, 0.3, 0.055, i * 0.045)); air(5000, 7000, 0.22, 0.025); }],
    // —— 战场事件 ——
    coin:     [0.07, () => { bell(1568, 0.1, 0.06); bell(2093, 0.16, 0.06, 0.05); }],
    wall:     [0.22, () => { tom(131, 0.2, 0, 0.15); tone('triangle', 392, 262, 0.05, 0.06); }],                     // 一声木头似的轻敲
    wave:     [0.50, () => { tom(131, 0.3, 0); tom(131, 0.3, 0.22); tom(98, 0.36, 0.44, 0.4); }],                     // 三声战鼓
    horn:     [1.50, () => { tone('triangle', 147, 147, 1.4, 0.15, 0, 0.3); tone('sine', 220, 220, 1.4, 0.09, 0, 0.35); tone('sine', 294, 294, 1.3, 0.05, 0.05, 0.4); }],   // 敌将登场 / 城防告急：远处的号角
    bossdie:  [0.50, () => { tom(110, 0.32, 0, 0.6); air(1400, 350, 0.8, 0.16, 0, 0.02); pluck(587, 0.9, 0.12, 0.18); pluck(784, 1.0, 0.1, 0.3); }],
    win:      [1.00, () => { [523, 587, 659, 784, 1047].forEach((f, i) => pluck(f, 0.5, 0.18, i * 0.12)); [523, 784, 1047].forEach(f => pluck(f, 1.1, 0.1, 0.66)); tom(131, 0.26, 0.66, 0.4); }],
    lose:     [1.00, () => { [440, 392, 330, 262].forEach((f, i) => pluck(f, 0.6, 0.16, i * 0.22)); tom(98, 0.24, 0.9, 0.5); }],
    // —— 界面 ——
    pull:     [0.05, () => { bell(1175, 0.2, 0.09); }],
    rare:     [0.30, () => { [784, 988, 1175, 1568].forEach((f, i) => bell(f, 0.55, 0.11, i * 0.07)); air(6000, 9000, 0.6, 0.03, 0, 0.1); }],
    up:       [0.08, () => { pluck(659, 0.16, 0.15); pluck(988, 0.22, 0.13, 0.08); }],
    buff:     [0.20, () => { tom(131, 0.2, 0); pluck(523, 0.35, 0.12, 0.04); pluck(784, 0.4, 0.11, 0.1); }],
    deny:     [0.15, () => { tone('sine', 294, 262, 0.09, 0.12, 0, 0.008); tone('sine', 247, 220, 0.12, 0.1, 0.09, 0.008); }],
  };

  function play(name) {
    if (typeof Save !== 'undefined' && Save.data && Save.data.sound === false) return;
    const b = BANK[name];
    if (!b || !ac || ac.state !== 'running' || voices >= MAX_VOICES) return;
    const now = performance.now() / 1000;
    if (now - (last[name] || -9) < b[0]) return;
    last[name] = now;
    try { b[1](); } catch (e) { /* 个别浏览器不支持某种节点时忽略 */ }
  }
  /* 检查用：离线渲染一个音效，返回峰值、平均响度、时长；量的是进压缩器之前的音量，实际播放时小声的大约是它的 1.5 倍。游戏里不调用，见 README「音效」 */
  async function probe(name, sec) {
    const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext, keep = [ac, master, voices];
    const oc = new OC(1, Math.floor(44100 * (sec || 2)), 44100);
    if (!noiseBuf) { noiseBuf = oc.createBuffer(1, 44100, 44100); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    ac = oc; master = wire(oc, true);
    try { BANK[name][1](); } finally { ac = keep[0]; master = keep[1]; }
    const d = (await oc.startRendering()).getChannelData(0); voices = keep[2];
    let peak = 0, sq = 0, n = 0;
    for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; if (v > 0.002) { sq += v * v; n++; } }
    return { peak: +peak.toFixed(3), rms: +Math.sqrt(sq / Math.max(1, n)).toFixed(3), len: +(n / 44100).toFixed(2) };
  }
  return { play, unlock, probe, get ready() { return !!ac && ac.state === 'running'; }, names: () => Object.keys(BANK) };
})();
