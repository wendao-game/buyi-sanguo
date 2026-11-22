'use strict';
/* 启动：读档 → 适配屏幕 → 加载图片素材 → 主循环 */
(function () {
  Save.load();

  // 调试参数：?coins=5000&tickets=50&stage=12&all=1（只在本机调试时生效，见 data.js 的 DEV）
  const qs = new URLSearchParams(DEV ? location.search : '');
  if (qs.has('coins')) Save.data.coins = Number(qs.get('coins')) || 0;
  if (qs.has('tickets')) Save.data.tickets = Number(qs.get('tickets')) || 0;
  if (qs.has('iron')) Save.data.iron = Number(qs.get('iron')) || 0;
  if (qs.has('stage')) { Save.data.stage = Math.max(1, Number(qs.get('stage')) || 1); Save.data.pick = Save.data.stage; }
  if (qs.has('all')) HEROES.forEach(h => { if (!h.locked && !Save.data.heroes[h.id]) Save.data.heroes[h.id] = { lv: 1, star: 0, shards: 0 }; });

  /* 屏幕适配：
   * - 比 9:16 更长的屏（现在大多数手机 19.5:9～20:9）：宽度铺满，界面往下延伸到整屏高度；
   *   战斗画面（540×960）贴底，上面多出的一截（--ext）用战场背景的镜像补上，不再留黑边
   * - 比 9:16 更宽的屏（平板）：保持 540×960 居中，两边用模糊的战场背景代替黑边
   * - 刘海、底部横条：读 env(safe-area-inset-*)，换算成界面里的像素放进 --safeT / --safeB */
  const app = document.getElementById('app');
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)';
  document.body.appendChild(probe);
  let extH = -1;
  function fit() {
    const iw = innerWidth, ih = innerHeight, cs = getComputedStyle(probe);
    let s, h = CFG.H;
    if (ih / iw > CFG.H / CFG.W + 0.01) { s = iw / CFG.W; h = Math.min(Math.round(ih / s), Math.round(CFG.W * 2.4)); }   // 最长按 9:21.6 铺，再长的上下留边
    else s = Math.min(iw / CFG.W, ih / CFG.H);
    app.style.height = h + 'px';
    app.style.setProperty('--ext', (h - CFG.H) + 'px');
    app.style.setProperty('--safeT', Math.round((parseFloat(cs.paddingTop) || 0) / s) + 'px');
    app.style.setProperty('--safeB', Math.round((parseFloat(cs.paddingBottom) || 0) / s) + 'px');
    app.style.transform = 'translate(' + (iw - CFG.W * s) / 2 + 'px,' + (ih - h * s) / 2 + 'px) scale(' + s + ')';
    document.body.classList.toggle('wide', iw / ih > CFG.W / CFG.H + 0.01);
    // 右上角小游戏的胶囊按钮（「··· ◎」）底边在界面里的位置：平台给得出就用平台的，给不出按「安全区下面再 46 像素」估；不在小游戏里就是 0
    const safeT = (parseFloat(cs.paddingTop) || 0) / s, ext = h - CFG.H;
    let cap = 0;
    try { const t = typeof tap !== 'undefined' ? tap : null, r = t && t.getMenuButtonBoundingClientRect ? t.getMenuButtonBoundingClientRect() : null; cap = r && r.bottom > 0 ? r.bottom / s : t ? safeT + 96 : 0; } catch (e) { cap = 0; }   // 实测 iPhone 17 Pro Max：安全区 72，胶囊底边有时在 129、有时在 168，按低的那个留
    if (qs.has('cap')) cap = Number(qs.get('cap')) || 0;      // 本机调试：?cap=128 模拟胶囊按钮
    // 战斗顶部信息往上挪多少：关卡名（居中，够不着右边的胶囊）落在刘海下面，波次条和金币那一行落在胶囊下面；空白不到 40 像素就不挪
    const up = Math.max(0, Math.min(104, Math.round(Math.min(ext + 8 - safeT, cap > 0 ? ext + 47 - cap : 999))));
    CFG.HUD_UP = up >= 40 ? up : 0;
    app.style.setProperty('--hudUp', CFG.HUD_UP + 'px');
    // 主城标题往下让：左上角「设置 · 存档 / 排行榜」和云存档状态占两行，胶囊按钮也在这一带
    app.style.setProperty('--logoTop', (ext >= 60 ? Math.max(64, Math.round(cap - 60 - safeT - 9)) : 18) + 'px');
    if (h - CFG.H !== extH) { extH = h - CFG.H; drawExt(); }
  }
  /* 战斗画面上方延伸出来的那一截：战场背景顶部那一条上下翻过来接上去，再往上逐渐压暗 */
  function drawExt() {
    const cv = document.getElementById('ext'); if (!cv) return;
    cv.style.display = extH > 0 ? 'block' : 'none';
    if (extH <= 0) return;
    cv.width = CFG.W * 2; cv.height = extH * 2;
    const c = cv.getContext('2d');
    try {
      const bg = Art.background();
      if (bg && bg.width) { c.save(); c.translate(0, cv.height); c.scale(1, -1); c.drawImage(bg, 0, 0, bg.width, Math.min(bg.height, bg.height * extH / CFG.H), 0, 0, cv.width, cv.height); c.restore(); }
    } catch (e) { /* 背景还没准备好：只画底色，加载完会再画一次 */ }
    // 战斗画面最上面一行盖着「远处烟尘」(36,24,18,.6) 和四角压暗（约 .3）：底边照这个调，接缝两边亮度一致，再往上越来越暗
    c.fillStyle = 'rgba(36,24,18,0.6)'; c.fillRect(0, 0, cv.width, cv.height);
    const g = c.createLinearGradient(0, 0, 0, cv.height);
    g.addColorStop(0, 'rgba(10,6,4,0.97)'); g.addColorStop(0.7, 'rgba(10,6,4,0.9)'); g.addColorStop(1, 'rgba(10,6,4,0.84)');   // 实测战斗画面顶行约 RGB(17,10,8)，底边压到同样亮度
    c.fillStyle = g; c.fillRect(0, 0, cv.width, cv.height);
  }
  addEventListener('resize', fit); fit();

  // 先加载 assets/ 里已有的图片（没有就用程序绘制），再进主城
  // 本地字体（css 里的 SGRound / SGBrush）先加载好，画布和 WebGL 里的文字才用得上；最多等 2.5 秒
  const fontsReady = (document.fonts && document.fonts.load)
    ? Promise.race([Promise.all([document.fonts.load('20px SGRound', '孤城万仞0'), document.fonts.load('20px SGBrush', '孤城万仞'), document.fonts.load('20px SGNum', '0123')]), new Promise(r => setTimeout(r, 2500))]).catch(() => {})
    : Promise.resolve();
  const bar = document.getElementById('loadBar'), txt = document.getElementById('loadTxt');
  const onProgress = p => { if (bar) bar.style.width = Math.round(p * 100) + '%'; if (txt) txt.textContent = '正在加载 ' + Math.round(p * 100) + '%'; };
  Promise.all([Assets.load(onProgress), fontsReady]).then(() => {
    FXGen.build(Assets);                       // 没有图片的特效贴图用代码生成
    drawExt();                                 // 背景图到了：重画上方延伸的那一截
    GLView.init(document.getElementById('gl'));   // WebGL 战斗画面；起不来就自动用 2D 画面
    Battle.init(document.getElementById('cv'));
    UI.init();
    Assets.onLate(() => { Art.refresh(); if (!Battle.state) UI.render(); });   // 进游戏后才下完的图：头像、图标重做，当前页面重画（战斗画面每帧都取最新的图，不用管）
    Cloud.init();
    const ld = document.getElementById('loading'); if (ld) { ld.classList.add('out'); setTimeout(() => ld.remove(), 450); }
    let last = performance.now(), errN = 0;
    function loop(now) {
      requestAnimationFrame(loop);                 // 先排下一帧：这一帧出错也不会让画面停住
      const dt = (now - last) / 1000; last = now;
      try { Battle.frame(dt); }
      catch (e) { if (errN++ < 5) console.error('[frame]', e && e.stack || e); }   // 同样的错每帧都会报，只记前几次
    }
    requestAnimationFrame(loop);
  });
})();
