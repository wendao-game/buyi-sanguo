'use strict';
/* ============================================================
 * 音效：全部用 Web Audio 现场合成，不需要音频文件（不占包体，也不用加载）
 * Sfx.play(名字)；同一个音效有最短间隔，同时发声的数量有上限，不会糊成一片
 * 浏览器规定要玩家点过一次屏幕才能出声，所以第一次点击时才创建音频环境
 * 开关：Save.data.sound（主城「设置 · 存档」里切换）
 * 以后想换成录好的音效：在 play() 里按名字播放音频文件即可，调用的地方不用改
 * ============================================================ */

const Sfx = (function () {
  let ac = null, master = null, noiseBuf = null, voices = 0;
  const last = {};
  const MAX_VOICES = 18;

  function ensure() {
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ac = new AC();
      master = ac.createGain(); master.gain.value = 0.42;
      const comp = ac.createDynamicsCompressor();          // 很多声音叠在一起时压一下，不爆音
      master.connect(comp); comp.connect(ac.destination);
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
  const drum = (f, vol, delay) => { tone('sine', f * 1.9, f * 0.75, 0.32, vol, delay); noise('lowpass', 900, 200, 0.12, vol * 0.5, delay); };

  /* 名字 → [最短间隔秒, 做法] */
  const BANK = {
    click:    [0.05, () => { tone('triangle', 620, 420, 0.07, 0.25); }],
    // —— 普攻（很频繁，声音都压得很轻）——
    atk_arrow:   [0.09, () => { noise('highpass', 2600, 5200, 0.07, 0.10); tone('triangle', 900, 500, 0.05, 0.05); }],
    atk_blade:   [0.12, () => { noise('bandpass', 900, 3400, 0.16, 0.14, 0, 1.4); }],
    atk_fire:    [0.14, () => { noise('lowpass', 500, 1500, 0.22, 0.13); }],
    atk_ice:     [0.12, () => { tone('sine', 1700, 2300, 0.11, 0.07); noise('highpass', 5000, 7000, 0.06, 0.05); }],
    atk_thunder: [0.14, () => { tone('sawtooth', 1300, 150, 0.12, 0.07); noise('highpass', 3500, 1500, 0.09, 0.07); }],
    atk_poison:  [0.16, () => { tone('sine', 420, 160, 0.16, 0.10); }],
    atk_wind:    [0.18, () => { noise('bandpass', 400, 1500, 0.34, 0.11, 0, 0.8, 0.08); }],
    crit:     [0.08, () => { tone('square', 1300, 1900, 0.06, 0.05); }],
    // —— 大招、爆炸 ——
    ult:      [0.15, () => { tone('sine', 196, 185, 1.1, 0.5, 0, 0.004); tone('sine', 392, 380, 0.7, 0.2); tone('triangle', 588, 570, 0.5, 0.1); noise('bandpass', 500, 2600, 0.45, 0.16, 0, 0.9, 0.12); }],   // 一声锣 + 一阵风
    boom:     [0.10, () => { noise('lowpass', 1600, 110, 0.55, 0.5); tone('sine', 130, 42, 0.45, 0.5); }],
    thunder:  [0.12, () => { noise('highpass', 2400, 500, 0.3, 0.28); tone('sawtooth', 190, 45, 0.4, 0.22); }],
    rock:     [0.10, () => { noise('lowpass', 800, 90, 0.4, 0.5); tone('sine', 100, 46, 0.3, 0.5); }],
    freeze:   [0.20, () => { tone('sine', 2100, 1500, 0.35, 0.1); tone('sine', 3150, 2500, 0.3, 0.06, 0.04); noise('highpass', 6000, 4000, 0.25, 0.07); }],
    // —— 战场事件 ——
    coin:     [0.07, () => { tone('square', 1320, 1320, 0.05, 0.06); tone('square', 1760, 1760, 0.09, 0.06, 0.05); }],
    wall:     [0.22, () => { tone('sine', 115, 55, 0.2, 0.4); noise('lowpass', 500, 120, 0.14, 0.28); }],
    wave:     [0.50, () => { drum(92, 0.5, 0); drum(92, 0.5, 0.22); drum(69, 0.6, 0.44); }],                        // 三声战鼓
    horn:     [1.50, () => { tone('sawtooth', 110, 110, 1.5, 0.16, 0, 0.25); tone('sawtooth', 165, 165, 1.5, 0.10, 0, 0.25); noise('lowpass', 300, 300, 1.4, 0.08, 0, 1, 0.3); }],   // 敌将登场：号角
    bossdie:  [0.50, () => { noise('lowpass', 2000, 80, 1.0, 0.6); tone('sine', 150, 34, 0.9, 0.6); tone('sine', 392, 392, 0.9, 0.16, 0.15); }],
    win:      [1.00, () => { [523, 659, 784, 1047, 1319].forEach((f, i) => { tone('triangle', f, f, 0.36, 0.22, i * 0.12); tone('sine', f / 2, f / 2, 0.36, 0.12, i * 0.12); }); drum(92, 0.45, 0.6); }],
    lose:     [1.00, () => { [392, 349, 294, 220].forEach((f, i) => tone('triangle', f, f * 0.97, 0.5, 0.2, i * 0.2)); drum(62, 0.5, 0.8); }],
    // —— 界面 ——
    pull:     [0.05, () => { tone('triangle', 880, 1320, 0.14, 0.14); }],
    rare:     [0.30, () => { [784, 988, 1175, 1568].forEach((f, i) => tone('sine', f, f, 0.5, 0.13, i * 0.07)); noise('highpass', 6000, 9000, 0.6, 0.05, 0, 1, 0.1); }],
    up:       [0.08, () => { tone('triangle', 523, 784, 0.12, 0.18); tone('triangle', 784, 1047, 0.14, 0.14, 0.08); }],
    buff:     [0.20, () => { drum(110, 0.4, 0); tone('triangle', 659, 880, 0.22, 0.14, 0.05); }],
    deny:     [0.15, () => { tone('square', 200, 150, 0.12, 0.10); }],
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
  return { play, unlock, get ready() { return !!ac && ac.state === 'running'; }, names: () => Object.keys(BANK) };
})();
