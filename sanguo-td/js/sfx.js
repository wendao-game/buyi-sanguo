'use strict';
/* ============================================================
 * 音效：全部用 Web Audio 现场合成，不需要音频文件（不占包体，也不用加载）
 * 音色偏柔和：拨弦、小铃、气声、软鼓，不用低沉的轰隆声和刺耳的方波；带一点混响
 * Sfx.play(名字)；同一个音效有最短间隔，同时发声的数量有上限，不会糊成一片
 * 浏览器规定要玩家点过一次屏幕才能出声，所以第一次点击时才创建音频环境
 * 开关：Save.data.sound 音效、Save.data.music 背景音乐（主城「设置 · 存档」里切换）
 * 想换成录好 / 生成的音效：把音频文件放进 assets/sfx/，文件名就是音效的名字（比如 ult_thunder.mp3），重新生成素材清单后
 *   游戏会自动用文件顶替合成的那一个，调用的地方不用改；没放文件的照旧用合成的（v2.12）
 * ============================================================ */

const Sfx = (function () {
  let ac = null, master = null, mbus = null, noiseBuf = null, voices = 0, out = null;   // out：这会儿发出来的声音接到哪（默认 master；gritty() 里临时改成带失真的那一路）
  const MUSIC_VOL = 0.6;                                    // 背景音乐相对音效的音量
  const last = {};
  const MAX_VOICES = 30;
  const FILES = {};                                          // 名字 → 解码好的音频文件（assets/sfx/ 里放了才有）
  const FILE_VOL = 0.9;
  let filesAsked = false;

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
    try {                                                    // 失真的一路：爆炸、重击走这里，软削波之后多出一截泛音，听着更「实」，手机小喇叭也放得出来
      const pre = ctx.createGain(), ws = ctx.createWaveShaper(), post = ctx.createGain(), n = 1024, cv = new Float32Array(n);
      for (let i = 0; i < n; i++) { const x = i * 2 / (n - 1) - 1; cv[i] = Math.tanh(x * 3); }
      ws.curve = cv; pre.gain.value = 1; post.gain.value = 0.55; pre.connect(ws); ws.connect(post); post.connect(m); m._grit = pre;
    } catch (e) { /* 不支持就不失真 */ }
    return m;
  }
  function ensure() {
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ac = new AC();
      master = wire(ac);
      mbus = ac.createGain(); mbus.gain.value = MUSIC_VOL; mbus.connect(master);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ac = null; return false; }
    loadFiles();
    return true;
  }
  /* assets/sfx/ 里的音频文件（素材清单里列出来的）：下载、解码，之后同名的音效就播文件 */
  function loadFiles() {
    if (filesAsked || !ac || !Array.isArray(window.ASSET_LIST) || typeof fetch !== 'function') return;
    filesAsked = true;
    window.ASSET_LIST.forEach(f => {
      const m = /^sfx\/([\w-]+)\.(mp3|ogg|wav|m4a)$/i.exec(f); if (!m) return;
      fetch('assets/' + f + (window.ASSET_VER ? '?v=' + window.ASSET_VER : '')).then(r => r.arrayBuffer())
        .then(b => new Promise((ok, no) => ac.decodeAudioData(b, ok, no))).then(buf => { FILES[m[1]] = buf; }).catch(() => { /* 下不到或解不了就用合成的 */ });
    });
  }
  function unlock() { if (ensure() && ac.state === 'suspended') ac.resume().catch(() => {}); }
  ['pointerdown', 'touchend', 'keydown'].forEach(ev => addEventListener(ev, unlock, { passive: true }));
  // 切到后台就静音，回来再恢复
  document.addEventListener('visibilitychange', () => { if (!ac) return; if (document.hidden) ac.suspend().catch(() => {}); else ac.resume().catch(() => {}); });

  function env(g, t, vol, atk, dur) {
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + atk); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function voice(node, g, t, dur) {
    voices++; node.connect(g); g.connect(out || master); node.start(t); node.stop(t + dur + 0.03);
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
    voices++; s.connect(f); f.connect(g); g.connect(out || master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
    s.onended = () => { voices--; try { g.disconnect(); } catch (e) { /* 已断开 */ } };
  }
  /* 低频噪声，音量一边随机起伏一边衰减：雷声的余音、火的翻滚 */
  function rumble(dur, vol, delay, f) {
    const t = ac.currentTime + (delay || 0), s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(), n = Math.max(8, Math.floor(dur * 14)), cv = new Float32Array(n);
    for (let i = 0; i < n; i++) cv[i] = Math.max(0.0001, vol * Math.pow(1 - i / n, 1.5) * (0.4 + Math.random() * 0.6));
    cv[0] = vol * 0.7; cv[n - 1] = 0.0001;
    s.buffer = noiseBuf; s.loop = true; fl.type = 'lowpass'; fl.frequency.value = f || 340; fl.Q.value = 0.6;
    g.gain.setValueAtTime(0.0001, t); g.gain.setValueCurveAtTime(cv, t + 0.002, dur);
    voices++; s.connect(fl); fl.connect(g); g.connect(out || master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
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
  /* —— 有打击感的音色（v2.12，只给大招和命中用；上面那几种柔和的留给界面和普攻）——
   * gritty  里面发出来的声音走失真那一路
   * thump   低音冲击：音高很快掉下去的一声，带一层高八度
   * blast   爆裂：低通噪声瞬间起、很快衰减（爆炸的主体）
   * crack   脆响：高通噪声极短的一下（雷劈、冰碎、刀砍的头）
   * rumble  滚动的余音（上面的函数）
   * metal   金属：几个不成倍数的高频一起响（出鞘、刀剑相碰）
   * shatter 碎裂：一把高低不一的小铃在一小段时间里乱响 */
  const gritty = fn => { const k = out; out = (master && master._grit) || master; try { fn(); } finally { out = k; } };
  const thump = (f0, f1, dur, vol, delay) => { tone('sine', f0, f1, dur, vol, delay, 0.003); tone('triangle', f0 * 2, f1 * 2, dur * 0.5, vol * 0.3, delay, 0.003); };
  const blast = (f0, f1, dur, vol, delay) => noise('lowpass', f0, f1, dur, vol, delay, 0.7, 0.004);
  const crack = (dur, vol, delay, f) => noise('highpass', f || 2600, (f || 2600) * 1.6, dur, vol, delay, 0.7, 0.002);
  const metal = (dur, vol, delay, base) => [1, 1.51, 2.1, 2.78].forEach((k, i) => tone('sine', (base || 2100) * k, (base || 2100) * k, dur * (1 - i * 0.15), vol * (1 - i * 0.2), delay, 0.002));
  const shatter = (n, vol, delay, span) => { for (let i = 0; i < n; i++) bell(2400 + Math.random() * 4200, 0.12 + Math.random() * 0.2, vol * (0.5 + Math.random() * 0.5), (delay || 0) + Math.random() * (span || 0.16)); };

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
    boom:     [0.10, () => { gritty(() => { blast(1900, 160, 0.42, 0.2); thump(150, 48, 0.3, 0.2); }); crack(0.035, 0.1); for (let i = 0; i < 4; i++) crack(0.02, 0.03, 0.12 + Math.random() * 0.35, 3500); air(900, 300, 0.5, 0.05, 0.08, 0.05); }],   // 爆炸：一声闷响 + 炸开的噪声 + 几下噼啪
    thunder:  [0.12, () => { crack(0.06, 0.2); gritty(() => { noise('bandpass', 3200, 500, 0.2, 0.12, 0, 0.8, 0.003); thump(120, 50, 0.22, 0.14); }); rumble(0.7, 0.16, 0.04); }],   // 落雷：劈的一下 + 滚过去的余音
    rock:     [0.10, () => { gritty(() => { thump(140, 50, 0.26, 0.22); blast(1200, 200, 0.25, 0.14); }); crack(0.03, 0.08, 0, 1800); }],
    freeze:   [0.20, () => { crack(0.05, 0.14, 0, 4000); shatter(9, 0.06); air(6000, 8000, 0.3, 0.03, 0.05); }],   // 冰碎
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

    /* ================= v2.11 补的音效 ================= */
    // —— 大招：先响上面那串拨弦（ult），再按攻击类型叠一层各自的声音 ——
    ult_fire:    [0.2, () => { air(300, 2600, 0.34, 0.2, 0, 0.3); gritty(() => { blast(2200, 140, 0.7, 0.26, 0.3); thump(160, 42, 0.45, 0.26, 0.3); }); crack(0.05, 0.14, 0.3); rumble(0.9, 0.12, 0.36, 420); for (let i = 0; i < 7; i++) crack(0.02, 0.035, 0.4 + Math.random() * 0.7, 3500); }],   // 火：一股火窜上去，然后轰的一声炸开，余火噼啪
    ult_ice:     [0.2, () => { air(5000, 9000, 0.28, 0.06, 0, 0.2); [1568, 2093, 2637].forEach((f, i) => bell(f, 0.2, 0.05, i * 0.07)); crack(0.06, 0.2, 0.26, 3800); shatter(14, 0.07, 0.26, 0.3); thump(220, 110, 0.12, 0.1, 0.26); shatter(6, 0.03, 0.6, 0.35); }],   // 冰：凝结的几声，然后哗啦一下碎开
    ult_thunder: [0.2, () => { for (let i = 0; i < 3; i++) crack(0.015, 0.05, i * 0.05, 5000); crack(0.08, 0.2, 0.14); gritty(() => { noise('bandpass', 3500, 400, 0.3, 0.12, 0.14, 0.8, 0.003); thump(130, 45, 0.3, 0.14, 0.14); }); rumble(1.5, 0.17, 0.18, 300); crack(0.05, 0.12, 0.42); }],   // 雷：几下电火花，一声炸雷，滚雷拖一秒多
    ult_wind:    [0.2, () => { air(300, 1900, 0.9, 0.42, 0, 0.35); noise('bandpass', 900, 1700, 0.8, 0.08, 0, 9, 0.3); gritty(() => blast(900, 200, 0.3, 0.16, 0.4)); air(1500, 4500, 0.25, 0.22, 0.4, 0.05); }],   // 风：越刮越紧带着哨音，然后呼的一下拍过去
    ult_poison:  [0.2, () => { noise('highpass', 3500, 6000, 0.7, 0.05, 0, 0.7, 0.15); for (let i = 0; i < 7; i++) { const f = 180 + Math.random() * 240; tone('sine', f, f * 1.5, 0.05, 0.1, Math.random() * 0.6, 0.004); } gritty(() => { blast(800, 160, 0.22, 0.14, 0.32); thump(120, 60, 0.18, 0.1, 0.32); }); }],   // 毒：嘶嘶的气声、咕嘟冒泡，然后噗的一下泼开
    ult_blade:   [0.2, () => { metal(0.5, 0.045, 0, 2300); crack(0.03, 0.06, 0, 5000); air(1200, 6500, 0.11, 0.24, 0.24, 0.015); crack(0.04, 0.14, 0.24); gritty(() => thump(140, 55, 0.2, 0.2, 0.26)); metal(0.25, 0.04, 0.26, 3100); }],   // 刃：出鞘的金属声，然后一刀砍下去
    ult_arrow:   [0.2, () => { tone('triangle', 196, 147, 0.14, 0.14); pluck(294, 0.25, 0.08); for (let i = 0; i < 6; i++) air(3000 + i * 300, 5600 + i * 300, 0.07, 0.08, 0.06 + i * 0.045, 0.01); for (let i = 0; i < 6; i++) { const d = 0.34 + i * 0.05 + Math.random() * 0.02; crack(0.015, 0.05, d, 2000); thump(230, 150, 0.05, 0.08, d); } }],   // 弓：弓弦一响，一排箭破空，接着一串扎进去的闷响
    // —— 大招打中敌人（不算普攻和持续伤害）：每种攻击类型各有一下命中的声音，间隔很短，连着打中一片时是一串 ——
    hit_fire:    [0.1,  () => { gritty(() => blast(1500, 260, 0.16, 0.1)); crack(0.02, 0.05); }],
    hit_thunder: [0.1,  () => { crack(0.04, 0.11, 0, 3200); noise('bandpass', 2600, 900, 0.09, 0.08, 0, 3, 0.003); tone('sine', 1700, 300, 0.07, 0.04); }],
    hit_ice:     [0.1,  () => { crack(0.03, 0.12, 0, 4200); shatter(3, 0.06, 0, 0.06); }],
    hit_wind:    [0.12, () => { air(1500, 4800, 0.12, 0.2, 0, 0.02); thump(170, 110, 0.07, 0.07); }],
    hit_poison:  [0.12, () => { blast(900, 220, 0.1, 0.13); tone('sine', 240, 420, 0.06, 0.07); }],
    hit_blade:   [0.09, () => { air(2200, 6500, 0.07, 0.13, 0, 0.01); crack(0.025, 0.08); metal(0.1, 0.025, 0, 2900); }],
    hit_arrow:   [0.09, () => { crack(0.018, 0.07, 0, 2200); thump(230, 150, 0.05, 0.09); }],
    myth_dark:   [0.6, () => { tone('sine', 82, 55, 1.4, 0.2, 0, 0.3); tone('triangle', 123, 82, 1.2, 0.07, 0.1, 0.3); air(180, 900, 1.2, 0.1, 0, 0.7); [311, 233, 185].forEach((f, i) => bell(f, 0.9, 0.07, 0.3 + i * 0.16)); }],   // 魔：很低的一声闷响往下沉，几声发暗的钟
    myth_holy:   [0.6, () => { [1047, 1319, 1568, 2093, 2637, 3136].forEach((f, i) => bell(f, 0.9, 0.085, i * 0.07)); [523, 659, 784].forEach(f => tone('sine', f, f, 1.5, 0.045, 0.1, 0.5)); air(5000, 9000, 1.0, 0.03, 0.1, 0.3); }],   // 神：一串往上的钟声，底下垫一个大三和弦
    // —— 武将 ——
    heal:        [0.25, () => { [784, 988, 1175].forEach((f, i) => bell(f, 0.5, 0.075, i * 0.08)); tone('sine', 523, 523, 0.7, 0.05, 0, 0.25); }],
    shield:      [0.25, () => { bell(1047, 0.45, 0.085); bell(1568, 0.5, 0.07, 0.06); air(4000, 6500, 0.3, 0.035, 0, 0.08); }],
    revive:      [0.5, () => { [523, 659, 784, 1047, 1319].forEach((f, i) => pluck(f, 0.5, 0.12, i * 0.08)); bell(2093, 0.9, 0.08, 0.42); bell(2637, 0.9, 0.06, 0.5); }],
    buff_team:   [0.25, () => { pluck(523, 0.3, 0.11); pluck(784, 0.36, 0.11, 0.07); pluck(1047, 0.42, 0.09, 0.14); }],
    hero_hurt:   [0.14, () => { tone('sine', 233, 147, 0.1, 0.11, 0, 0.006); air(900, 450, 0.08, 0.05, 0, 0.008); }],
    hero_down:   [0.5, () => { [392, 330, 262, 196].forEach((f, i) => pluck(f, 0.45, 0.14, i * 0.11)); tom(98, 0.24, 0.42, 0.45); }],
    rage_full:   [0.35, () => { bell(1319, 0.14, 0.05); bell(1760, 0.22, 0.05, 0.06); }],
    swap:        [0.12, () => { pluck(523, 0.12, 0.12); pluck(784, 0.18, 0.11, 0.07); }],
    qin:         [0.2, () => { const f = [294, 330, 392, 440, 523, 587, 659][Math.floor(Math.random() * 7)]; pluck(f, 0.9, 0.15); tone('triangle', f / 2, f / 2, 0.5, 0.05, 0, 0.008); tone('sine', f * 3, f * 3, 0.15, 0.02); }],   // 蔡文姬的琴：五声音阶里随便拨一个音
    build:       [0.3, () => { [0, 0.09, 0.18].forEach((d, i) => { tom(165 - i * 16, 0.2, d, 0.12); tone('triangle', 523, 392, 0.04, 0.05, d); }); }],              // 垒墙：三下敲木头
    silence:     [0.3, () => { tone('sine', 988, 247, 0.28, 0.11, 0, 0.01); tone('sine', 740, 185, 0.3, 0.07, 0.05, 0.01); air(3000, 600, 0.25, 0.06, 0, 0.02); }],  // 打断：一声往下掉的滑音
    block:       [0.3, () => { bell(1976, 0.3, 0.09); bell(1480, 0.35, 0.07, 0.05); air(5000, 2500, 0.18, 0.05, 0, 0.01); }],                                       // 识破：叮的一声
    // —— 敌将 ——
    boss_wind:   [0.5, () => { air(250, 1700, 0.62, 0.18, 0, 0.5); tone('sine', 98, 196, 0.62, 0.1, 0, 0.45); }],                                                   // 蓄力：越来越高的一股气
    boss_cast:   [0.3, () => { tom(110, 0.3, 0, 0.3); air(1800, 500, 0.3, 0.12, 0, 0.012); }],
    boss_slash:  [0.25, () => { air(1100, 5200, 0.15, 0.14, 0, 0.02); tom(131, 0.18, 0.1, 0.16); }],
    boss_smash:  [0.25, () => { gritty(() => { thump(110, 42, 0.4, 0.26); blast(1000, 160, 0.4, 0.18); }); crack(0.04, 0.1, 0, 1500); }],
    boss_roar:   [0.8, () => { tone('triangle', 131, 98, 0.8, 0.15, 0, 0.09); tone('sine', 196, 147, 0.8, 0.09, 0, 0.1); tone('sine', 138, 104, 0.7, 0.06, 0.03, 0.1); air(450, 950, 0.7, 0.09, 0, 0.2); }],   // 一声低吼（两个音稍微错开一点，听着发颤）
    gallop:      [0.5, () => { [0, 0.09, 0.2, 0.29, 0.4, 0.49].forEach((d, i) => tom(i % 2 ? 147 : 123, 0.17, d, 0.09)); air(600, 1500, 0.6, 0.05, 0, 0.3); }],     // 冲锋：马蹄
    summon:      [0.4, () => { pluck(262, 0.4, 0.12); pluck(330, 0.4, 0.1, 0.08); air(500, 1500, 0.4, 0.06, 0, 0.2); }],
    e_heal:      [0.4, () => { bell(659, 0.4, 0.07); bell(784, 0.45, 0.06, 0.09); }],
    e_shield:    [0.4, () => { bell(784, 0.35, 0.08); tone('triangle', 392, 392, 0.3, 0.05, 0, 0.02); air(2500, 4000, 0.2, 0.03, 0, 0.05); }],
    chain:       [0.4, () => { [0, 0.05, 0.1, 0.15].forEach((d, i) => bell(1480 + (i % 2) * 220, 0.08, 0.05, d)); tom(147, 0.14, 0.18, 0.12); }],                   // 铁索：一串金属碰撞
    enc:         [1.0, () => { [1175, 1568, 1760, 2349].forEach((f, i) => bell(f, 1.1, 0.08, i * 0.14)); tone('sine', 294, 294, 1.6, 0.05, 0, 0.5); tone('sine', 440, 440, 1.6, 0.035, 0.1, 0.5); }],   // 奇遇：几声空灵的钟
    // —— 战场 ——
    kill:        [0.16, () => { tone('sine', 660, 440, 0.05, 0.05, 0, 0.004); }],                                                                                    // 放倒一个敌人：很轻的一下
    combo:       [0.4, () => { [587, 784, 988, 1175].forEach((f, i) => pluck(f, 0.4, 0.13, i * 0.05)); bell(2349, 0.5, 0.07, 0.2); tom(147, 0.2, 0, 0.2); }],
    alarm:       [1.5, () => { [0, 0.3].forEach(d => { bell(988, 0.25, 0.11, d); bell(740, 0.3, 0.11, d + 0.12); }); tom(110, 0.2, 0, 0.3); }],                     // 城防告急：两遍急促的钟
    rock_throw:  [0.1, () => { air(700, 2200, 0.24, 0.2, 0, 0.1); }],
    // —— 界面 ——
    tab:         [0.05, () => { pluck(659, 0.09, 0.11); pluck(988, 0.07, 0.04, 0.02); }],
    equip:       [0.08, () => { bell(1319, 0.12, 0.07); tom(196, 0.12, 0.03, 0.08); }],
    forge:       [0.1, () => { tom(165, 0.22, 0, 0.12); bell(2093, 0.3, 0.09, 0.02); bell(2794, 0.2, 0.04, 0.02); }],                                               // 强化：铁砧上敲一下
    melt:        [0.2, () => { air(500, 2000, 0.45, 0.2, 0, 0.15); bell(1568, 0.14, 0.05, 0.3); bell(2093, 0.2, 0.05, 0.36); }],
    star:        [0.3, () => { [784, 988, 1175, 1568].forEach((f, i) => bell(f, 0.5, 0.1, i * 0.07)); pluck(392, 0.5, 0.09); }],
    awake:       [0.5, () => { [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => bell(f, 0.8, 0.09, i * 0.06)); tom(131, 0.26, 0, 0.4); [523, 784, 1047].forEach(f => tone('sine', f, f, 1.2, 0.04, 0.4, 0.3)); air(5000, 9000, 0.9, 0.03, 0.3, 0.2); }],
    draw10:      [0.3, () => { for (let i = 0; i < 10; i++) pluck([523, 587, 659, 784, 880][i % 5] * (i >= 5 ? 2 : 1), 0.12, 0.06, i * 0.035); }],                  // 十连：一串很快的拨弦
    pull3:       [0.3, () => { [784, 988, 1319].forEach((f, i) => bell(f, 0.45, 0.1, i * 0.07)); }],                                                                // 出紫
    pull5:       [0.5, () => { tom(98, 0.3, 0, 0.5); [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => pluck(f, 0.7, 0.14, i * 0.07)); [1047, 1319, 1568, 2093].forEach(f => bell(f, 1.3, 0.07, 0.5)); air(5000, 9000, 1.1, 0.035, 0.4, 0.2); }],   // 出橙：一串上行 + 一个亮的和弦
    sweep:       [0.3, () => { [1568, 1760, 2093, 2349, 2637].forEach((f, i) => bell(f, 0.14, 0.055, i * 0.05)); }],
  };

  /* ============================================================
   * 背景音乐：也是现场合成。一个小的音序器，每 0.12 秒把接下来 0.4 秒要响的音排进去。
   * 三段：home 主城（慢，C 宫五声，拨弦旋律 + 长音垫底）
   *       battle 战斗（快一些，A 羽五声，鼓点 + 低音 + 拨弦旋律，每四句歇两小节只留鼓）
   *       boss 敌将登场（同一段，更快，鼓更密，旋律加高八度）
   * Sfx.music(名字 / null) 切换；开关是 Save.data.music
   * ============================================================ */
  const mf = m => 440 * Math.pow(2, (m - 69) / 12);         // MIDI 音高 → 频率
  function mnote(type, f0, t, dur, vol, atk, f1) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, vol, atk || 0.006, dur); o.connect(g); g.connect(mbus); o.start(t); o.stop(t + dur + 0.05);
    o.onended = () => { try { g.disconnect(); } catch (e) { /* 已断开 */ } };
  }
  const M = {
    pluck(m, t, dur, vol) { const f = mf(m); mnote('sine', f, t, dur, vol); mnote('triangle', f * 2, t, dur * 0.4, vol * 0.2); mnote('sine', f * 3, t, dur * 0.2, vol * 0.06); },
    pad(m, t, dur, vol) { mnote('sine', mf(m), t, dur, vol, dur * 0.35); },
    bass(m, t, dur, vol) { const f = mf(m); mnote('sine', f, t, dur, vol, 0.01); mnote('triangle', f * 2, t, dur * 0.5, vol * 0.15, 0.01); },
    tom(f, t, vol, dur) { mnote('sine', f * 1.5, t, dur, vol, 0.008, f); },
    tick(t, vol) { mnote('triangle', 1319, t, 0.04, vol, 0.003); },                         // 木鱼似的一下轻敲
  };
  // 主城旋律：四句，每句两小节、十六个八分音符（0 = 空拍）
  const HOME_MEL = [
    [76, 0, 79, 81, 79, 0, 76, 0, 74, 0, 76, 79, 76, 0, 0, 0],
    [81, 0, 79, 76, 74, 0, 72, 0, 74, 76, 79, 0, 72, 0, 0, 0],
    [84, 0, 81, 79, 81, 0, 79, 76, 79, 0, 76, 74, 76, 0, 0, 0],
    [74, 76, 79, 81, 84, 0, 81, 0, 79, 76, 74, 0, 72, 0, 0, 0]];
  const HOME_ROOT = [48, 45, 48, 43];                        // 每句的根音：C A C G
  // 战斗旋律：四句，每句两小节、三十二个十六分音符
  const BAT_MEL = [
    [69, 0, 0, 72, 0, 0, 74, 0, 76, 0, 0, 0, 74, 0, 72, 0, 69, 0, 0, 67, 0, 0, 69, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [76, 0, 0, 79, 0, 0, 76, 0, 74, 0, 0, 72, 0, 0, 74, 0, 76, 0, 0, 0, 0, 0, 0, 0, 69, 0, 72, 0, 74, 0, 76, 0],
    [81, 0, 0, 79, 0, 0, 76, 0, 74, 0, 0, 76, 0, 0, 79, 0, 81, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [79, 0, 76, 0, 74, 0, 72, 0, 74, 0, 0, 76, 0, 0, 72, 0, 69, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]];
  const BAT_ROOT = [45, 45, 48, 43, 45, 45, 43, 40];         // 每小节的根音：A A C G A A G E
  function playHome(i, t, sd) {
    const ph = Math.floor(i / 16) % 8, k = i % 16, root = HOME_ROOT[ph % 4], low = ph >= 4, mel = HOME_MEL[ph % 4][k];   // 后四句低八度再来一遍，随机省掉几个音
    if (mel && !(low && k % 2 === 1 && Math.random() < 0.5)) M.pluck(mel - (low ? 12 : 0), t, sd * 3.2, low ? 0.11 : 0.13);
    if (k === 0) { [0, 7, 12].forEach(d => M.pad(root + 12 + d, t, sd * 16, 0.03)); M.bass(root, t, sd * 6, 0.1); }
    if (k === 8) M.bass(root + 7, t, sd * 5, 0.07);
    if (k % 4 === 2) M.pluck(root + 24 + (k === 2 || k === 10 ? 7 : 12), t, sd * 2, 0.035);     // 轻轻的分解和弦
  }
  function playBattle(i, t, sd, boss) {
    const bar = Math.floor(i / 16), k = i % 16, root = BAT_ROOT[bar % 8], sect = Math.floor(bar / 2) % 5;
    if (k % 8 === 0) M.tom(k ? 123 : 98, t, 0.16, 0.22);
    if (k === 4 || k === 12 || (boss && k % 4 === 2)) M.tom(165, t, 0.09, 0.14);
    if (k === 14) M.tom(147, t, 0.07, 0.12);
    if (k % 4 === 2) M.tick(t, 0.03);
    if (k === 0 || k === 3 || k === 6 || k === 8 || k === 11 || k === 14) M.bass(root + (k === 6 || k === 14 ? 7 : 0), t, sd * 2.6, 0.1);
    if (sect < 4) { const m = BAT_MEL[sect][(bar % 2) * 16 + k]; if (m) { M.pluck(m, t, sd * 4, 0.12); if (boss) M.pluck(m + 12, t, sd * 3, 0.05); } }
    if (k === 0) { M.pad(root + 12, t, sd * 16, 0.035); M.pad(root + 19, t, sd * 16, 0.025); }
  }
  const SONGS = {
    home:   { bpm: 76,  div: 2, play: playHome },
    battle: { bpm: 108, div: 4, play: (i, t, sd) => playBattle(i, t, sd, false) },
    boss:   { bpm: 118, div: 4, play: (i, t, sd) => playBattle(i, t, sd, true) },
  };
  let theme = null, mStep = 0, mNext = 0;
  const musicOn = () => !(typeof Save !== 'undefined' && Save.data && Save.data.music === false);
  function mTick() {
    if (!theme || !ac || ac.state !== 'running' || !musicOn()) return;
    const now = ac.currentTime, s = SONGS[theme], sd = 60 / s.bpm / s.div;
    if (mNext < now) mNext = now + 0.06;                    // 刚开始，或者切到后台回来：从现在接着排
    while (mNext < now + 0.4) { try { s.play(mStep, mNext, sd); } catch (e) { /* 忽略 */ } mStep++; mNext += sd; }
  }
  setInterval(mTick, 120);
  function music(name) {
    name = SONGS[name] ? name : null;
    if (name === theme) return;
    theme = name; mStep = 0;
    if (!ac || !mbus) return;
    const now = ac.currentTime;                             // 换曲：先收一下音量，半秒后新的一段从头起
    try { mbus.gain.cancelScheduledValues(now); mbus.gain.setValueAtTime(mbus.gain.value, now); mbus.gain.linearRampToValueAtTime(0.0001, now + 0.3); mbus.gain.setValueAtTime(MUSIC_VOL, now + 0.5); } catch (e) { /* 忽略 */ }
    mNext = now + 0.5;
  }

  function play(name) {
    if (typeof Save !== 'undefined' && Save.data && Save.data.sound === false) return;
    const b = BANK[name], fb = FILES[name];
    if ((!b && !fb) || !ac || ac.state !== 'running' || voices >= MAX_VOICES) return;
    const now = performance.now() / 1000;
    if (now - (last[name] || -9) < (b ? b[0] : 0.1)) return;
    last[name] = now;
    try {
      if (fb) {                                              // 放了音频文件：播文件
        const s = ac.createBufferSource(), g = ac.createGain(); s.buffer = fb; g.gain.value = FILE_VOL;
        voices++; s.connect(g); g.connect(master); s.start(); s.onended = () => { voices--; try { g.disconnect(); } catch (e) { /* 已断开 */ } };
      } else b[1]();
    } catch (e) { /* 个别浏览器不支持某种节点时忽略 */ }
  }
  /* 检查用：离线渲染一个音效，返回峰值、平均响度、时长；量的是进压缩器之前的音量，实际播放时小声的大约是它的 1.5 倍。游戏里不调用，见 README「音效」 */
  async function render(name, sec) {
    const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext, keep = [ac, master, voices, mbus];
    const oc = new OC(1, Math.floor(44100 * (sec || 2)), 44100);
    if (!noiseBuf) { noiseBuf = oc.createBuffer(1, 44100, 44100); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    ac = oc; master = wire(oc, true); mbus = oc.createGain(); mbus.gain.value = MUSIC_VOL; mbus.connect(master);
    try {
      if (BANK[name]) BANK[name][1]();
      else { const s = SONGS[name], sd = 60 / s.bpm / s.div; for (let i = 0, t = 0.05; t < (sec || 2) - 1; i++, t += sd) s.play(i, t, sd); }   // 传曲名就渲染一段音乐
    } finally { ac = keep[0]; master = keep[1]; mbus = keep[3]; }
    const d = (await oc.startRendering()).getChannelData(0); voices = keep[2];
    return d;                                                // 44100 Hz 单声道的采样（tools 里导出试听用的 wav 也用它）
  }
  async function probe(name, sec) {
    const d = await render(name, sec);
    let peak = 0, sq = 0, n = 0;
    for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; if (v > 0.002) { sq += v * v; n++; } }
    return { peak: +peak.toFixed(3), rms: +Math.sqrt(sq / Math.max(1, n)).toFixed(3), len: +(n / 44100).toFixed(2) };
  }
  return { play, music, unlock, probe, render, files: () => Object.keys(FILES), songs: () => Object.keys(SONGS), get ready() { return !!ac && ac.state === 'running'; }, names: () => Object.keys(BANK) };
})();
