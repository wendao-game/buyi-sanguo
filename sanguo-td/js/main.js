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

  const app = document.getElementById('app');
  function fit() {
    const s = Math.min(innerWidth / CFG.W, innerHeight / CFG.H);
    app.style.transform = 'translate(' + (innerWidth - CFG.W * s) / 2 + 'px,' + (innerHeight - CFG.H * s) / 2 + 'px) scale(' + s + ')';
  }
  addEventListener('resize', fit); fit();

  // 先加载 assets/ 里已有的图片（没有就用程序绘制），再进主城
  // 本地字体（css 里的 SGRound / SGBrush）先加载好，画布和 WebGL 里的文字才用得上；最多等 2.5 秒
  const fontsReady = (document.fonts && document.fonts.load)
    ? Promise.race([Promise.all([document.fonts.load('20px SGRound', '烽火守城0'), document.fonts.load('20px SGBrush', '烽火守城'), document.fonts.load('20px SGNum', '0123')]), new Promise(r => setTimeout(r, 2500))]).catch(() => {})
    : Promise.resolve();
  const bar = document.getElementById('loadBar'), txt = document.getElementById('loadTxt');
  const onProgress = p => { if (bar) bar.style.width = Math.round(p * 100) + '%'; if (txt) txt.textContent = '正在加载 ' + Math.round(p * 100) + '%'; };
  Promise.all([Assets.load(onProgress), fontsReady]).then(() => {
    FXGen.build(Assets);                       // 没有图片的特效贴图用代码生成
    GLView.init(document.getElementById('gl'));   // WebGL 战斗画面；起不来就自动用 2D 画面
    Battle.init(document.getElementById('cv'));
    UI.init();
    Cloud.init();
    const ld = document.getElementById('loading'); if (ld) { ld.classList.add('out'); setTimeout(() => ld.remove(), 450); }
    let last = performance.now();
    function loop(now) {
      const dt = (now - last) / 1000; last = now;
      Battle.frame(dt);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  });
})();
