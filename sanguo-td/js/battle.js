'use strict';
/* ============================================================
 * 战斗引擎：波次、武将普攻与专属技能、敌人状态、投石、瞄准、特效、结算
 * 武将技能本身写在 skills.js，通过这里的 B（makeApi）调用引擎
 * ============================================================ */

const Battle = (function () {
  const W = CFG.W, H = CFG.H, WY = CFG.WALL_Y, TAU = Math.PI * 2;
  const SLOTS = CFG.SLOTS;
  const RANGE_Y = 120;            // 敌人越过这条线后武将才会攻击（到城墙线约 550，和换背景前一样）
  const FONT = 'SGNum,SGRound,"Microsoft YaHei","PingFang SC",sans-serif';   // 本地打包的字体（css 里声明）：SGNum 数字和字母，SGRound 站酷快乐体
  const rand = Math.random;
  const isBig = e => e.def.id === 'boss' || e.def.id === 'elite';
  const clampX = x => Math.max(40, Math.min(W - 40, x));
  let cv, c, S = null, idleT = 0, B = null;

  function init(canvas) {
    cv = canvas; c = cv.getContext('2d');
    cv.addEventListener('pointerdown', onTap);
    const gl = document.getElementById('gl'); if (gl) gl.addEventListener('pointerdown', onTap);
    B = makeApi();
  }

  /* ---------------- 开局 ---------------- */
  function start(stage) {
    const bonus = teamBonus(Save.data.team);
    S = {
      stage, ch: chapterOf(stage), wave: 0, waveT: 0, waveDur: 0, spawned: 0, waveSize: 1,
      queue: [], enemies: [], live: [], heroes: [], shots: [], zones: [], parts: [], texts: [], bolts: [], drops: [], rings: [], timers: [], slashes: [], fx: [], ghosts: [], decals: [],
      cut: null, lastCut: -99, shock: null, dim: null,
      t: 0, coins: 0, kills: 0,
      buffs: { atk: 1 + bonus.atk, spd: 1 + bonus.spd, crit: bonus.crit, rage: 1 + bonus.rage, ult: 1 + bonus.ult, coin: 1, boss: 1, el: {} },
      bonus, wallBonus: bonus.wall, psnVuln: 0, windT: 0, haste: { t: 0, mul: 1 },
      rock: { n: CFG.ROCK_MAX, max: CFG.ROCK_MAX, t: 0, dmg: 1 }, aim: null, aimT: 0,
      over: false, win: false, paused: false, choosing: false, wall: 0, wallMax: 0, shake: 0, wallFlash: 0, banner: null, flash: null,
    };
    for (const k in bonus.el) S.buffs.el[k] = 1 + bonus.el[k];
    Save.data.team.forEach((id, i) => {
      if (!id) return;
      const st = heroStats(id), d = HERO_MAP[id], sk = heroSkill(id), p = bonus.per[i];
      const m = Object.assign({ atk: 0, spd: 0, crit: 0, critDmg: 0, rage: 0, w: 0, r: 0, chain: 0, life: 0, push: 0, tspd: 0, burn: 0, dotCrit: 0 }, sk && sk.passive.mod);
      S.heroes.push({
        slot: i, def: d, sk, awake: heroAwake(id),
        atk: st.atk * (1 + m.atk) * (1 + p.atk), cd: st.cd / ((1 + m.spd) * (1 + p.spd)),
        crit: m.crit, critDmg: m.critDmg, rageMul: 1 + m.rage + p.rage,
        m: { w: 1 + m.w, r: 1 + m.r, chain: m.chain, life: 1 + m.life, push: 1 + m.push, tspd: 1 + m.tspd, burn: 1 + m.burn, dotCrit: !!m.dotCrit },
        x: SLOTS[i][0], y: SLOTS[i][1], t: 0.4 + rand() * 0.6, rage: 0, anim: 0, n: 0, dmg: 0, hasteT: 0, hasteMul: 1, bigT: 0,
      });
    });
    const has = id => S.heroes.some(h => h.def.id === id);
    S.heroes.forEach(h => { if (h.sk && h.sk.passive.aura) h.sk.passive.aura({ S, self: h, heroes: S.heroes, has }); });
    S.wallMax = S.wall = Math.round((400 + basePower()) * (1 + S.wallBonus));
    nextWave();
  }
  function stop() { S = null; }

  function nextWave() {
    S.wave++;
    const w = genWave(S.stage, S.wave);
    S.queue = w.list; S.waveDur = w.dur; S.waveT = 0; S.spawned = 0; S.waveSize = w.list.length;
    S.banner = { text: S.wave === CFG.WAVES ? '最终波 · ' + S.ch.boss + '来袭' : '第 ' + S.wave + ' 波', t: 1.8, max: 1.8 };
  }
  function spawn(q) {
    const d = ENEMIES[q.type], hp = Math.round(d.hp * stageHpMul(S.stage, S.wave));
    S.spawned++;
    S.enemies.push({
      def: d, name: d.id === 'boss' ? S.ch.boss : d.name, x: q.x, y: -d.r - rand() * 16,
      hp, max: hp, atk: d.atk * stageAtkMul(S.stage), spd: d.spd * (0.9 + rand() * 0.2),
      stopY: WY - 15 - d.r - rand() * 12 - (d.range ? d.range * (0.6 + rand() * 0.4) : 0),
      acd: 0.3 + rand() * 0.7, flash: 0, frozen: 0, slow: 0, burn: 0, burnT: 0, burnDps: 0, burnSrc: null,
      psn: 0, psnT: 0, psnDps: 0, psnSrc: null, psnMark: 0, vuln: 0, vulnT: 0, fear: 0, conf: 0, confT: 0, confSrc: null, mark: 0,
      walk: rand() * 6, ph: rand() * 6, dead: false,
      spr: enemySprite(d.id), flip: d.id !== 'boss' && rand() < 0.5,
    });
  }
  /* 敌人造型：第 1 章黄巾兵，之后换官军造型；敌将每章不同 */
  function enemySprite(id) {
    if (id === 'boss') return 'enemies/boss_' + Math.min(9, S.ch.index);
    if (S.ch.index > 1 && Assets.get('enemy:' + id + '_2')) return 'enemy:' + id + '_2';
    return null;
  }
  function afterWave() {
    if (S.wave % CFG.BUFF_EVERY === 0 && S.wave < CFG.WAVES) {
      S.choosing = true; S.aim = null;
      const pool = BUFFS.filter(b => !b.el || S.heroes.some(h => h.def.el === b.el)), opts = [];
      while (opts.length < 3 && pool.length) opts.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
      UI.showBuffs(opts, i => { opts[i].apply(S.buffs, S); S.choosing = false; nextWave(); });
    } else nextWave();
  }
  function finish(win) {
    if (S.over) return;
    S.over = true; S.win = win; S.aim = null;
    S.banner = { text: win ? '大获全胜' : '城池失守', t: 99, max: 99 };
    const res = settleBattle(S.stage, win, win ? CFG.WAVES : S.wave - 1, Math.round(S.coins));
    res.win = win; res.kills = S.kills; res.stage = S.stage; res.wave = S.wave;
    res.dmg = S.heroes.map(h => ({ id: h.def.id, dmg: Math.round(h.dmg) })).sort((a, b) => b.dmg - a.dmg);
    const ref = S;
    setTimeout(() => { if (S === ref) UI.showResult(res); }, 1100);
  }

  /* ---------------- 特效小工具 ---------------- */
  function part(x, y, vx, vy, life, color, size, g) {
    if (S.parts.length > 700) return;
    S.parts.push({ x, y, vx, vy, life, max: life, color, size, g: g || 0 });
  }
  function burst(x, y, n, color, spd, size, life, g) {
    for (let i = 0; i < n; i++) { const a = rand() * TAU, v = spd * (0.3 + rand() * 0.7); part(x, y, Math.cos(a) * v, Math.sin(a) * v, life * (0.6 + rand() * 0.4), color, size * (0.6 + rand() * 0.6), g); }
  }
  function ring(x, y, r0, r1, life, color, w, fill) {
    if (!fill && r1 > 40) { const s0 = Math.max(10, r0); if (tex('ring', x, y, { w: s0 * 2.3, h: s0 * 1.6, grow: r1 / s0, life, rgb: hexRgb(color), a: Math.min(1, 0.5 + (w || 3) / 10) })) return; }
    S.rings.push({ x, y, r0, r1, life, max: life, color, w: w || 3, fill: !!fill });
  }
  function text(x, y, str, color, size, life, force) {
    if (S.texts.length > 110 && !force) return;
    S.texts.push({ x, y, str: String(str), color, size, life: life || 0.8, max: life || 0.8 });
  }
  function later(t, fn) { const ref = S; S.timers.push({ t, fn: () => { if (S === ref && !S.over) fn(); } }); }
  /* ---------------- 贴图特效（黑底贴图 + 叠加混合） ---------------- */
  const hexRgb = h => { if (!h || h[0] !== '#') return '255,255,255'; const n = parseInt(h.slice(1), 16); return h.length === 4 ? [((n >> 8) & 15) * 17, ((n >> 4) & 15) * 17, (n & 15) * 17].join(',') : [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(','); };
  /* o: w 宽, h 高（默认按图片比例）, rot, spin 转速, life, grow 结束时放大倍数, a 透明度, fadeIn, ax/ay 锚点, vx/vy, rgb 染色 */
  function tex(name, x, y, o) {
    o = o || {};
    const im = o.rgb ? Assets.tinted(name, o.rgb) : Assets.get('fx:' + name);
    if (!im) return null;
    if (S.fx.length > 180 && !o.force) return true;
    const w = o.w || 64;
    S.fx.push({ im, x, y, w, h: o.h || w * im.height / im.width, rot: o.rot || 0, spin: o.spin || 0, life: o.life || 0.4, max: o.life || 0.4,
      grow: o.grow || 1, a: o.a == null ? 1 : o.a, fadeIn: o.fadeIn || 0, ax: o.ax == null ? 0.5 : o.ax, ay: o.ay == null ? 0.5 : o.ay, vx: o.vx || 0, vy: o.vy || 0 });
    return true;
  }
  const glowCache = {};
  function glow(x, y, r, rgb, a) {
    let g = glowCache[rgb];
    if (!g) {
      g = glowCache[rgb] = document.createElement('canvas'); g.width = g.height = 64;
      const gc = g.getContext('2d'), gr = gc.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(' + rgb + ',1)'); gr.addColorStop(0.3, 'rgba(' + rgb + ',.55)'); gr.addColorStop(0.7, 'rgba(' + rgb + ',.12)'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
      gc.fillStyle = gr; gc.fillRect(0, 0, 64, 64);
    }
    c.globalAlpha = Math.max(0, Math.min(1, a)); c.drawImage(g, x - r, y - r, r * 2, r * 2);
  }
  /* 绘制时用：直接画一张贴图（不进特效列表），需在 'lighter' 下调用 */
  function img(name, x, y, w, h, rot, a, rgb) {
    const im = rgb ? Assets.tinted(name, rgb) : Assets.get('fx:' + name);
    if (!im) return false;
    h = h || w * im.height / im.width;
    c.globalAlpha = Math.max(0, Math.min(1, a == null ? 1 : a));
    c.save(); c.translate(x, y); if (rot) c.rotate(rot); c.drawImage(im, -w / 2, -h / 2, w, h); c.restore();
    return true;
  }
  /* 大招特写横幅：有特写图的武将，放大招时从右边滑进来（同一时间只放一张，最快 5 秒一次） */
  function cutIn(h, manual) {
    const im = Assets.get('cut:' + h.def.id);
    if (!im || (!manual && S.t - S.lastCut < 5)) return;
    S.lastCut = S.t; S.cut = { im, name: h.def.ult, who: h.def.name, color: QUALITIES[h.def.q].color, t: 0, dur: 1.15 };
  }

  function bolt(x1, y1, x2, y2, wide) {
    if ((wide || 1) >= 1.5 && y2 - y1 > 80 && tex('bolt', x2, y2 + 8, { w: 46 * wide, h: y2 - y1 + 40, ay: 1, life: 0.28, rot: Math.atan2(x1 - x2, y2 - y1) })) {
      tex('el_hit_thunder', x2, y2, { w: 54 * wide, life: 0.3, grow: 1.3, rot: rand() * TAU });
      if (wide >= 2) decal(x2, y2, 26 * wide);
      return;
    }
    const pts = [[x1, y1]], n = 6;
    for (let i = 1; i < n; i++) { const p = i / n; pts.push([x1 + (x2 - x1) * p + (rand() - 0.5) * 26, y1 + (y2 - y1) * p + (rand() - 0.5) * 16]); }
    pts.push([x2, y2]);
    S.bolts.push({ pts, life: 0.2, max: 0.2, wide: wide || 1 });
  }

  /* ---------------- 伤害 ---------------- */
  const elColor = el => (ELEMENTS[el] ? ELEMENTS[el].color : '#e8d8b8');
  function hit(e, dmg, el, src, o) {
    if (!e || e.dead) return;
    o = o || {};
    let m = 1 + (e.vuln || 0) + ((e.psn > 0 || e.psnMark > 0) ? S.psnVuln : 0);
    m *= S.buffs.el[el] || 1;
    if (el === 'fire' && S.windT > 0) m *= 1.5;
    if (isBig(e)) m *= S.buffs.boss;
    if (src && src.sk && src.sk.passive.dmg) m *= src.sk.passive.dmg(B, src, e);
    const canCrit = !o.dot || (src && src.m.dotCrit);
    const crit = canCrit && rand() < 0.08 + S.buffs.crit + (src ? src.crit : 0) + (o.crit || 0);
    dmg = Math.max(1, Math.round(dmg * m * (0.9 + rand() * 0.2) * (crit ? 2 + (src ? src.critDmg : 0) : 1)));
    if (src) src.dmg += Math.min(dmg, Math.max(0, e.hp));
    e.hp -= dmg; e.flash = 0.1;
    if (crit && !o.dot && S.fx.length < 120) { tex('burst', e.x, e.y - e.def.r * 0.6, { w: 44 + e.def.r, life: 0.24, grow: 1.35, rgb: '255,225,140', rot: rand() * TAU }); burst(e.x, e.y - e.def.r * 0.6, 4, '#ffe9a8', 230, 2.2, 0.28, 300); }
    else if (!o.dot && S.fx.length < 70) tex('burst', e.x, e.y - e.def.r * 0.5, { w: 20 + e.def.r * 0.7, life: 0.13, grow: 1.25, a: 0.75, rgb: hexRgb(elColor(el)), rot: rand() * TAU });   // 命中小闪光
    text(e.x + (rand() - 0.5) * 18, e.y - e.def.r - 8 - rand() * 8, dmg, crit ? '#ffdf4a' : elColor(el), crit ? 28 : (o.dot ? 13 : 18), 0.75, crit);
    if (o.basic && src && src.sk && src.sk.passive.onHit && e.hp > 0) src.sk.passive.onHit(B, src, e);
    if (e.hp <= 0) kill(e, src, el);
  }
  function kill(e, src, el) {
    e.dead = true; S.kills++;
    burst(e.x, e.y, e.def.id === 'boss' ? 40 : 4, e.def.body, 120, 4, 0.5);
    if (S.parts.length < 400) burst(e.x, e.y - 4, 3, '#ffe2a0', 170, 2, 0.3, 320);
    if (S.ghosts.length < 40) S.ghosts.push({ def: e.def, spr: e.spr, flip: e.flip, x: e.x, y: e.y, life: 0.38, max: 0.38 });
    if (e.def.id === 'boss') { ring(e.x, e.y, 10, 140, 0.5, '#ffd24a', 5); S.shake = 0.4; tex('pillar', e.x, e.y + 20, { w: 150, h: 520, ay: 1, life: 1.2, fadeIn: 0.1, force: true }); tex('burst', e.x, e.y - 20, { w: 260, life: 0.6, grow: 1.4, force: true }); shockwave(e.x, e.y, 420, 1.6); }
    if (isBig(e) || rand() < CFG.COIN_DROP_RATE) dropCoin(e);
    if (rand() < CFG.BUN_DROP_RATE) S.drops.push({ k: 'bun', x: e.x, y: e.y, sx: e.x, sy: e.y, t: 0, dur: 0.8, wait: 0.5, val: 0.04 });
    if (src && src.sk && src.sk.passive.onKill) src.sk.passive.onKill(B, src, e, el);
    for (const h of S.heroes) if (h.sk && h.sk.passive.onAnyKill) h.sk.passive.onAnyKill(B, h, e);
  }
  function dropCoin(e) { S.drops.push({ k: 'coin', x: e.x, y: e.y, sx: e.x, sy: e.y, t: 0, dur: 0.7, wait: 0.35, val: e.def.coin * S.buffs.coin }); }
  function inRadius(x, y, r, fn) {
    for (const e of S.enemies) {
      if (e.dead || e.y < RANGE_Y - 30) continue;
      const dx = e.x - x, dy = e.y - y, rr = r + e.def.r * 0.6;
      if (dx * dx + dy * dy < rr * rr) fn(e);
    }
  }
  const lives = () => S.live.filter(e => !e.dead);
  function frontmost() { let b = null; for (const e of S.live) if (!e.dead && (!b || e.y > b.y)) b = e; return b; }
  function densest(rad) {
    const list = lives();
    if (!list.length) return null;
    let best = null, bs = -1;
    for (let i = 0, n = Math.min(10, list.length); i < n; i++) {
      const e = list[Math.floor(rand() * list.length)];
      let sc = e.y / 220;
      for (const o of list) { const dx = o.x - e.x, dy = o.y - e.y; if (dx * dx + dy * dy < rad * rad) sc++; }
      if (sc > bs) { bs = sc; best = e; }
    }
    return best;
  }
  function randLive() { const l = lives(); return l.length ? l[Math.floor(rand() * l.length)] : null; }
  function strongest(n) { return lives().sort((a, b) => b.hp - a.hp).slice(0, n); }

  /* 状态 */
  const stun = (e, t) => { if (!e.dead) e.frozen = Math.max(e.frozen, t); };
  const slow = (e, t) => { if (!e.dead) e.slow = Math.max(e.slow, t); };
  function burn(e, t, tick, h) { if (e.dead) return; e.burn = Math.max(e.burn, t); if (tick >= e.burnDps || !e.burnSrc) { e.burnDps = tick; e.burnSrc = h; } }
  function poison(e, t, dps, h) { if (e.dead) return; e.psn = Math.max(e.psn, t); if (dps >= e.psnDps || !e.psnSrc) { e.psnDps = dps; e.psnSrc = h; } }
  function vuln(e, t, v) { if (e.dead) return; e.vuln = Math.max(e.vuln, v); e.vulnT = Math.max(e.vulnT, t); }
  function fear(e, t) { if (!e.dead) e.fear = Math.max(e.fear, t); }
  function confuse(e, t, h) { if (e.dead) return; e.conf = Math.max(e.conf, t); e.confSrc = h; e.confT = 0.3; }

  /* 落点爆炸 */
  function explode(el, x, y, r, dmg, big, h, basic) {
    const o = basic ? { basic: true } : null;
    if (el === 'fire') {
      const tick = dmg * 0.12 * (h ? h.m.burn : 1);
      inRadius(x, y, r, e => { hit(e, dmg, 'fire', h, o); burn(e, 3, tick, h); });
      if (!tex('el_hit_fire', x, y - r * 0.1, { w: r * 2.1, h: r * 1.8, life: big ? 0.5 : 0.4, grow: 1.2, a: big ? 0.8 : 0.9, rot: rand() * TAU })) { ring(x, y, r * 0.2, r, 0.35, '#ff8a3a', 4, true); ring(x, y, r * 0.3, r * 1.05, 0.3, '#ffd35a', 3); }
      burst(x, y, big ? 18 : 7, '#ffb04a', big ? 300 : 210, 2.6, 0.5, 420);                                 // 飞溅的火星（会往下落）
      for (let i = 0, n = big ? 3 : 1; i < n; i++) part(x + (rand() - 0.5) * r * 0.9, y + (rand() - 0.5) * r * 0.4, (rand() - 0.5) * 30, -30 - rand() * 30, 0.7 + rand() * 0.4, '#3a2e27', 5 + rand() * 3);   // 往上飘的黑烟
      if (r > 50) ring(x, y, r * 0.3, r * 1.15, 0.28, '#ffc070', 3);
      if (big) S.shake = Math.max(S.shake, 0.2);
      if (r > 50) decal(x, y, r * 0.8);
      if (big && r >= 90) shockwave(x, y, r * 2.2, 1);
    } else if (el === 'ice') {
      inRadius(x, y, r, e => { hit(e, dmg, 'ice', h, o); slow(e, 2.2); });
      if (!tex('el_hit_ice', x, y, { w: r * 2.1, h: r * 1.8, life: 0.4, grow: 1.2, a: 0.9, rot: rand() * TAU })) ring(x, y, 6, r, 0.3, '#bfeaff', 3);
      burst(x, y, 8, '#d9f4ff', 220, 2.4, 0.42, 380);
    } else if (el === 'poison') {
      pool(h, x, y, r, 4 * (h ? h.m.life : 1), dmg, 'poison');
      tex('el_hit_wind', x, y, { w: r * 1.8, h: r * 1.3, life: 0.4, grow: 1.3, a: 0.7, rgb: '120,235,60', rot: rand() * TAU });
      burst(x, y, 6, '#8be84f', 100, 4, 0.4);
    } else if (el === 'arrow') {
      inRadius(x, y, r, e => hit(e, dmg, 'arrow', h, { crit: 0.15 }));
      tex('burst', x, y, { w: r * 1.8, life: 0.2, rgb: '255,225,160', rot: rand() * TAU });
      burst(x, y, 2, '#ffe9a8', 70, 2.5, 0.25);
    } else if (el === 'rock') {
      inRadius(x, y, r, e => { hit(e, dmg, 'rock', null); stun(e, 1); });
      ring(x, y, 8, r, 0.35, '#c8a878', 5); burst(x, y, 14, '#8a6a48', 180, 5, 0.5); burst(x, y, 6, '#d8c8a8', 120, 3, 0.4);
      tex('burst', x, y - 6, { w: r * 2.2, life: 0.35, grow: 1.3, rgb: '220,180,130', rot: rand() * TAU });
      S.shake = Math.max(S.shake, 0.15);
      decal(x, y, r * 0.75);
    }
  }
  /* 冲击波（只有 WebGL 画面会画成扭曲的波纹）：r 扩散半径，k 强度 */
  function shockwave(x, y, r, k) { if (!S.shock || S.shock.t < S.shock.max * 0.5 || (k || 1) >= (S.shock.k || 1)) S.shock = { x, y, r, k: k || 1, t: 0.55, max: 0.55 }; }
  /* 地面焦痕：爆炸、落石、落雷之后留几秒 */
  function decal(x, y, r) {
    if (S.decals.length >= 18) S.decals.shift();
    S.decals.push({ x, y, r, rot: rand() * TAU, life: 6, max: 6 });
  }
  function pool(h, x, y, r, life, dmg, el) {
    const blobs = [];
    for (let i = 0; i < 7; i++) { const a = rand() * TAU, d = rand() * 0.55; blobs.push([Math.cos(a) * d, Math.sin(a) * d, 0.45 + rand() * 0.3]); }
    S.zones.push({ k: 'pool', el: el || 'poison', h, x, y, r, life, max: life, tick: 0.1, dmg, blobs });
  }
  function chain(h, x, y, first, dmg, n, stunT, basic) {
    const used = new Set(); let cur = first, px = x, py = y;
    for (let i = 0; i < n && cur; i++) {
      bolt(px, py, cur.x, cur.y - 6);
      used.add(cur); px = cur.x; py = cur.y - 6;
      if (stunT) stun(cur, stunT);
      hit(cur, dmg, 'thunder', h, basic ? { basic: true } : null); burst(px, py, 3, '#d9ccff', 90, 2.5, 0.25);
      if (i < 3) tex('el_hit_thunder', px, py, { w: 40, life: 0.2, rot: rand() * TAU });
      dmg *= 0.88;
      let nx = null, nd = 140 * 140;
      for (const e of S.live) { if (e.dead || used.has(e)) continue; const dx = e.x - px, dy = e.y - py, d2 = dx * dx + dy * dy; if (d2 < nd) { nd = d2; nx = e; } }
      cur = nx;
    }
  }
  function shotArrow(h, tg, dmg, o) {
    o = o || {};
    const x = o.x != null ? o.x : h.x, y = o.y != null ? o.y : h.y - 22;
    S.shots.push({ k: 'arrow', h, x, y, px: x, py: y, tg, spd: o.big ? 900 : 780, dmg, crit: o.crit || 0, burn: o.burn, big: !!o.big, basic: !!o.basic });
  }
  function shotBlade(h, x, y, ang, o) {
    S.shots.push({ k: 'blade', h, x, y, vx: Math.cos(ang) * (o.spd || 430), vy: Math.sin(ang) * (o.spd || 430), w: o.w || 50, dmg: o.dmg, hit: new Set(), life: o.life || 2.2,
      big: !!o.big, push: o.push || 0, slow: o.slow || 0, look: o.look || 'blade', el: o.el || 'blade', color: o.color || '', basic: !!o.basic, tex: o.tex || '', texW: o.texW || 0 });
  }
  function shotLob(h, el, x0, y0, tx, ty, o) {
    S.shots.push({ k: 'lob', h, el, x: x0, y: y0, px: x0, py: y0, x0, y0, tx, ty, t: 0, dur: o.dur || 0.5, arc: o.arc || 0, r: o.r || 50, dmg: o.dmg, big: !!o.big, size: o.size || 1, slow: o.slow || 0, basic: !!o.basic });
  }
  function tornado(h, x, y, o) {
    S.zones.push({ k: 'tornado', h, x: Math.max(50, Math.min(W - 50, x)), y, vy: o.vy || -85, r: o.r || 38, life: o.life || 3.2, max: o.life || 3.2, tick: 0, dmg: o.dmg, push: o.push || 12, big: !!o.big, basic: !!o.basic });
  }

  /* ---------------- 给 skills.js 用的接口 ---------------- */
  function makeApi() {
    const api = {
      W, H, WY, TOP: RANGE_Y, pt: null,
      get S() { return S; },
      lives, front: frontmost, dense: rad => densest(rad), rnd: randLive, strongest,
      at(rad) { if (api.pt) return api.pt; const t = densest(rad); return t ? { x: t.x, y: t.y } : null; },
      heroes: () => S.heroes,
      hit: (e, dmg, el, h, o) => hit(e, dmg, el, h, o),
      area: inRadius, explode, pool, chain, tornado,
      arrow: shotArrow, blade: shotBlade, lob: shotLob,
      rain(h, tx, ty, dmg, slowT) { shotLob(h, 'arrow', tx - 50, ty - 320, tx, ty, { dur: 0.26, r: 26, dmg, slow: slowT }); },
      sweep(h, dmg, o) { S.shots.push({ k: 'sweep', h, y: WY - 20, vy: -420, dmg, hit: new Set(), slow: (o && o.slow) || 0 }); },
      ship(h, x, a) { S.shots.push({ k: 'ship', h, x, y: WY - 34, vy: -250, a, hit: new Set(), trail: 0.25 }); },   // 火船从城下出发，冲向敌阵深处
      zone(o) { o.max = o.life; o.tick = o.tick || 0; o.t = 0; if (o.k === 'icewall') o.hit = new Set(); S.zones.push(o); },
      slash(x, y) { S.slashes.push({ x, y, a: rand() * TAU, life: 0.22, max: 0.22 }); burst(x, y, 6, '#ffffff', 160, 3, 0.25); },
      stun, slow, burn, poison, vuln, fear, confuse,
      mark(e, t) { e.mark = Math.max(e.mark, t); },
      dropCoin,
      rage(h, n) { h.rage = Math.min(100, h.rage + n); },
      teamRage(n, except) { for (const h of S.heroes) if (h !== except) h.rage = Math.min(100, h.rage + n); },
      haste(h, t, mul) { h.hasteT = t; h.hasteMul = mul; },
      teamHaste(t, mul) { S.haste.t = t; S.haste.mul = mul; },
      heal(frac) { const v = Math.round(S.wallMax * frac); S.wall = Math.min(S.wallMax, S.wall + v); text(W / 2, WY - 10, '城防 +' + v, '#8dff8a', 18, 1.2, true); },
      ring, burst, bolt, later,
      tex: (name, x, y, o) => tex(name, x, y, Object.assign({ force: true }, o)),
      text: (x, y, s, col, size, life) => text(x, y, s, col, size, life, true),
      flash(rgb, a, t) { S.flash = { color: rgb, a, t, max: t }; },
      shake(t) { S.shake = Math.max(S.shake, t); },
    };
    return api;
  }

  /* ---------------- 武将普攻 ---------------- */
  function attack(h) {
    const el = h.def.el, dmg = h.atk * S.buffs.atk, hx = h.x, hy = h.y - 22;
    const tg = (el === 'arrow' || el === 'blade' || el === 'thunder') ? frontmost() : densest(60);
    if (!tg) return false;
    h.n++;
    switch (el) {
      case 'arrow': shotArrow(h, tg, dmg, { basic: true }); break;
      case 'blade': {
        const bigT = h.bigT > 0;
        shotBlade(h, hx, hy, Math.atan2(tg.y - hy, tg.x - hx), { w: 50 * h.m.w * (bigT ? 2 : 1), dmg: dmg * (bigT ? 1.5 : 1), big: bigT, basic: true, color: bigT && h.def.id === 'guanyu' ? 'green' : '' });
        break;
      }
      case 'fire': shotLob(h, 'fire', hx, hy, tg.x, tg.y, { dur: 0.5, arc: 70, r: 58 * h.m.r, dmg, basic: true }); break;
      case 'ice': shotLob(h, 'ice', hx, hy, tg.x, tg.y, { dur: 0.28, r: 46 * h.m.r, dmg, basic: true }); break;
      case 'poison': shotLob(h, 'poison', hx, hy, tg.x, tg.y, { dur: 0.6, arc: 90, r: 54 * h.m.r, dmg, basic: true }); break;
      case 'thunder': chain(h, hx, hy - 10, tg, dmg, 5 + h.m.chain, 0, true); break;
      case 'wind': tornado(h, tg.x, Math.min(WY - 24, tg.y + 70), { vy: -85 * h.m.tspd, dmg, push: 12 * h.m.push, basic: true }); break;
    }
    if (h.sk && h.sk.passive.onAttack) h.sk.passive.onAttack(B, h, tg, dmg);
    return true;
  }

  /* ---------------- 大招 ---------------- */
  function castUlt(h, pt) {
    if (!S || S.over || S.choosing || h.rage < 100) return false;
    if (!S.live.some(e => !e.dead)) return false;
    h.rage = 0; h.anim = 1.6;
    if (S.aim === h.slot) S.aim = null;
    const a = h.atk * S.buffs.atk * S.buffs.ult, q = QUALITIES[h.def.q], k = h.awake ? 1.5 : 1;
    text(h.x, h.y - 58, '【' + h.def.ult + '】' + (h.awake ? '·觉醒' : ''), q.color, 21, 1.5, true);
    ring(h.x, h.y + 26, 12, 70, 0.5, q.color, 4);
    tex('pillar', h.x, h.y + 34, { w: 60, h: 260, ay: 1, life: 0.7, fadeIn: 0.12, a: 0.5, rgb: hexRgb(q.color), force: true });
    cutIn(h, !!pt || !Save.data.auto);
    shockwave(h.x, h.y, 260, 0.8);
    tex('circle', h.x, h.y + 29, { w: 96, h: 38, spin: 2.6, life: 0.95, grow: 1.7, rgb: hexRgb(q.color), a: 0.95, fadeIn: 0.08, force: true });   // 脚下法阵
    for (let i = 0; i < 10; i++) part(h.x + (rand() - 0.5) * 56, h.y + 24 - rand() * 20, (rand() - 0.5) * 20, -150 - rand() * 170, 0.45 + rand() * 0.35, q.color, 2.4);   // 往上蹿的光点
    S.dim = { t: 0.5, max: 0.5 };                               // 放大招的一瞬间场景压暗，特效更突出
    B.pt = pt || null;
    if (h.sk) h.sk.ult.cast(B, h, a, k); else defaultUlt(h, a);
    B.pt = null;
    if (h.sk && h.sk.passive.onUlt) h.sk.passive.onUlt(B, h);
    return true;
  }
  /* 没有专属技能的武将（未开放的神将）：按攻击类型的通用大招 */
  function defaultUlt(h, a) {
    const t = densest(110); if (!t) return;
    switch (h.def.el) {
      case 'arrow': for (let i = 0; i < 40; i++) later(i * 0.035, () => { const e = randLive(); if (e) B.rain(h, e.x, e.y, a * 1.3); }); break;
      case 'blade': { const base = Math.atan2(t.y - h.y, t.x - h.x); [-0.22, 0, 0.22].forEach((o, i) => later(i * 0.16, () => shotBlade(h, h.x, h.y - 22, base + o, { w: 150, spd: 520, dmg: a * 4, big: true, life: 2.4 }))); break; }
      case 'fire': for (let i = 0; i < 6; i++) later(i * 0.18, () => { const e = densest(90); if (e) shotLob(h, 'fire', e.x + 150, -40, e.x, e.y, { dur: 0.42, r: 96, dmg: a * 3.5, big: true }); }); break;
      case 'ice': for (const e of lives()) { stun(e, e.def.id === 'boss' ? 1.5 : 3); hit(e, a * 2.5, 'ice', h); } S.flash = { color: '160,225,255', a: 0.45, t: 0.6, max: 0.6 }; break;
      case 'thunder': lives().slice(0, 14).forEach((e, i) => later(i * 0.06, () => { if (e.dead) return; bolt(e.x, -10, e.x, e.y - 6, 2); stun(e, 1); hit(e, a * 4.5, 'thunder', h); })); break;
      case 'poison': pool(h, t.x, t.y, 135, 6, a * 1.1, 'poison'); break;
      case 'wind': tornado(h, t.x, WY - 30, { vy: -48, r: 92, life: 5.5, dmg: a * 1.2, push: 20, big: true }); break;
    }
  }
  /* 点了大招头像：返回 'ok' / 'aim'（进入瞄准）/ 'rage'（怒气未满）/ 'none'（射程内没有敌人） */
  function ult(slot) {
    const h = S && S.heroes.find(x => x.slot === slot);
    if (!h || S.over || S.choosing) return 'none';
    if (h.rage < 100) return 'rage';
    if (!S.live.some(e => !e.dead)) return 'none';
    if (!Save.data.auto && h.sk && h.sk.ult.aim) {
      if (S.aim === slot) { S.aim = null; return castUlt(h) ? 'ok' : 'none'; }   // 再点一次头像：自动选目标
      S.aim = slot; S.aimT = 0;
      return 'aim';
    }
    return castUlt(h) ? 'ok' : 'none';
  }
  function cancelAim() { if (S) S.aim = null; }

  /* ---------------- 点击战场：瞄准中 = 放大招；否则投石 ---------------- */
  function onTap(ev) {
    const r = ev.currentTarget.getBoundingClientRect();
    tapAt((ev.clientX - r.left) / r.width * W, (ev.clientY - r.top) / r.height * H);
  }
  function tapAt(x, y) {
    if (!S || S.over || S.choosing || S.paused) return;
    if (y > WY + 20 || y < 40) return;
    if (S.aim !== null) {
      const h = S.heroes.find(q => q.slot === S.aim);
      if (h) castUlt(h, { x: clampX(x), y: Math.max(RANGE_Y + 10, Math.min(WY - 30, y)) });
      S.aim = null;
      return;
    }
    if (y < RANGE_Y - 10) return;
    if (S.rock.n <= 0) { text(x, y, '礌石未备好', '#d8c8a8', 14, 0.7, true); return; }
    S.rock.n--;
    // 伤害跟着关卡走（黄巾兵当前血量的 CFG.ROCK_DMG 倍）：操作的价值不随战力变化，专门对付扎堆的小兵，对敌将只是刮痧
    const dmg = ENEMIES.grunt.hp * stageHpMul(S.stage, S.wave) * CFG.ROCK_DMG * S.rock.dmg;
    shotLob(null, 'rock', x + 40, -30, clampX(x), Math.min(WY - 20, y), { dur: 0.35, r: CFG.ROCK_R, dmg });
  }

  /* ---------------- 每帧逻辑 ---------------- */
  function update(dt) {
    S.t += dt; S.waveT += dt;
    S.live = S.enemies.filter(e => !e.dead && e.y > RANGE_Y);
    while (S.queue.length && S.queue[0].t <= S.waveT) spawn(S.queue.shift());
    if (!S.queue.length) {
      if (S.wave >= CFG.WAVES) { if (!S.enemies.length) return finish(true); }
      else if (!S.enemies.length || S.waveT > S.waveDur + 9) return afterWave();
    }
    for (let i = S.timers.length - 1; i >= 0; i--) { const tm = S.timers[i]; if ((tm.t -= dt) <= 0) { S.timers.splice(i, 1); tm.fn(); if (!S || S.over) return; } }
    if (S.haste.t > 0) S.haste.t -= dt;
    if (S.windT > 0) S.windT -= dt;
    if (S.rock.n < S.rock.max && (S.rock.t += dt) >= CFG.ROCK_CD) { S.rock.n++; S.rock.t = 0; }

    // 武将
    for (const h of S.heroes) {
      h.anim = Math.max(0, h.anim - dt * 4);
      if (h.hasteT > 0) h.hasteT -= dt;
      if (h.bigT > 0) h.bigT -= dt;
      const rg = S.buffs.rage * h.rageMul;
      h.rage = Math.min(100, h.rage + dt * 2.5 * rg);            // 怒气：随时间 + 每次出手（按出手间隔折算，快慢武将充能速度一致）
      h.t -= dt * S.buffs.spd * (h.hasteT > 0 ? h.hasteMul : 1) * (S.haste.t > 0 ? S.haste.mul : 1);
      if (h.t <= 0) {
        if (attack(h)) { h.t = h.cd; h.anim = Math.max(h.anim, 1); h.rage = Math.min(100, h.rage + 2.5 * h.cd * rg); }
        else h.t = 0.12;
      }
      if (h.rage >= 100 && Save.data.auto && (S.live.length >= 3 || S.live.some(e => isBig(e)))) castUlt(h);
      if (S.over) return;
    }

    // 敌人
    for (const e of S.enemies) {
      if (e.dead) continue;
      if (e.flash > 0) e.flash -= dt;
      if (e.mark > 0) e.mark -= dt;
      if (e.psnMark > 0) e.psnMark -= dt;
      if (e.vulnT > 0 && (e.vulnT -= dt) <= 0) e.vuln = 0;
      if (e.burn > 0) { e.burn -= dt; if ((e.burnT -= dt) <= 0) { e.burnT = 0.5; hit(e, e.burnDps, 'fire', e.burnSrc, { dot: true }); if (e.dead) continue; } }
      if (e.psn > 0) { e.psn -= dt; if ((e.psnT -= dt) <= 0) { e.psnT = 0.5; hit(e, e.psnDps * 0.5, 'poison', e.psnSrc, { dot: true }); if (e.dead) continue; } }
      if (e.slow > 0) e.slow -= dt;
      if (e.frozen > 0) { e.frozen -= dt; continue; }
      if (e.fear > 0) { e.fear -= dt; e.y = Math.max(RANGE_Y + 8, e.y - e.spd * 0.9 * dt); e.walk += dt * e.spd * 0.22; continue; }
      if (e.conf > 0) {                                      // 混乱：不攻城，砍身边的同伴
        e.conf -= dt;
        if ((e.confT -= dt) <= 0) {
          e.confT = 0.8;
          let o = null, od = 90 * 90;
          for (const x of S.enemies) { if (x === e || x.dead) continue; const dx = x.x - e.x, dy = x.y - e.y, d2 = dx * dx + dy * dy; if (d2 < od) { od = d2; o = x; } }
          if (o) { hit(o, (e.confSrc ? e.confSrc.atk * S.buffs.atk : e.atk * 3) * (e.def.id === 'boss' ? 2 : 1) * 0.9, 'poison', e.confSrc); S.slashes.push({ x: o.x, y: o.y, a: rand() * TAU, life: 0.18, max: 0.18 }); }
        }
        continue;
      }
      const sp = e.spd * (e.slow > 0 ? 0.5 : 1);
      if (e.y < e.stopY) {
        e.y += sp * dt; e.walk += dt * sp * 0.22;
        e.x = Math.max(48, Math.min(W - 48, e.x + Math.sin(S.t * 1.3 + e.ph) * 7 * dt));
        if (e.y > WY - 230) { const tx = Math.max(118, Math.min(422, e.x)); e.x += (tx - e.x) * Math.min(1, dt * 1.6); }   // 快到城下时往城楼正面那段墙收拢
      } else if ((e.acd -= dt) <= 0) {
        e.acd = e.def.id === 'boss' ? 1.4 : 1;
        S.wall -= e.atk; S.wallFlash = 0.15; S.shake = Math.max(S.shake, e.def.id === 'boss' ? 0.25 : 0.06);
        if (e.def.range) S.shots.push({ k: 'earrow', x: e.x, y: e.y - 6, x0: e.x, y0: e.y - 6, tx: e.x + (rand() - 0.5) * 30, ty: WY - 4, t: 0, dur: 0.22 });
        else burst(e.x, WY - 12, 3, '#b9bcc6', 70, 3, 0.3);
      }
    }

    updateShots(dt);
    updateZones(dt);

    // 掉落
    for (let i = S.drops.length - 1; i >= 0; i--) {
      const d = S.drops[i];
      if (d.wait > 0) { d.wait -= dt; continue; }
      d.t += dt; const p = Math.min(1, d.t / d.dur), ep = p * p;
      const tx = d.k === 'coin' ? W - 92 : d.sx, ty = d.k === 'coin' ? 38 : WY + 8;
      d.x = d.sx + (tx - d.sx) * ep; d.y = d.sy + (ty - d.sy) * ep - Math.sin(p * Math.PI) * 40;
      if (p >= 1) {
        if (d.k === 'coin') S.coins += d.val;
        else { const v = Math.round(S.wallMax * d.val); S.wall = Math.min(S.wallMax, S.wall + v); text(d.x, WY - 6, '城防 +' + v, '#8dff8a', 15, 1, true); }
        S.drops.splice(i, 1);
      }
    }

    S.enemies = S.enemies.filter(e => !e.dead);
    if (S.wall <= 0) { S.wall = 0; finish(false); }
  }

  function updateShots(dt) {
    for (let i = S.shots.length - 1; i >= 0; i--) {
      const s = S.shots[i]; let done = false;
      if (s.k === 'arrow') {
        if (s.tg.dead) { s.tg = frontmost(); if (!s.tg) { S.shots.splice(i, 1); continue; } }
        const dx = s.tg.x - s.x, dy = s.tg.y - 4 - s.y, d = Math.hypot(dx, dy), mv = s.spd * dt;
        s.px = s.x; s.py = s.y;
        if (d <= mv + 8) {
          const tg = s.tg;
          hit(tg, s.dmg, 'arrow', s.h, { crit: 0.15 + s.crit, basic: s.basic });
          if (s.burn && !tg.dead) burn(tg, s.burn[0], s.burn[1], s.h);
          burst(tg.x, tg.y - 4, s.big ? 6 : 2, s.burn ? '#ff9a3a' : '#ffe9a8', 60, 2, 0.2); done = true;
        } else { s.x += dx / d * mv; s.y += dy / d * mv; }
      } else if (s.k === 'blade') {
        s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
        for (const e of S.enemies) {
          if (e.dead || s.hit.has(e) || e.y < RANGE_Y - 20) continue;
          const dx = e.x - s.x, dy = e.y - s.y, rr = s.w / 2 + e.def.r;
          if (dx * dx + dy * dy < rr * rr) {
            s.hit.add(e); hit(e, s.dmg, s.el, s.h, { basic: s.basic });
            if (!e.dead) {
              if (s.push) e.y = Math.max(RANGE_Y + 8, e.y - (e.def.id === 'boss' ? s.push * 0.25 : s.push));
              if (s.slow) slow(e, s.slow);
            }
            burst(e.x, e.y, 2, s.look === 'ice' ? '#d9f4ff' : '#e6dcff', 80, 3, 0.25);
          }
        }
        if (rand() < 0.6) part(s.x + (rand() - 0.5) * s.w * 0.8, s.y, 0, 20, 0.3, s.look === 'ice' ? '#cfefff' : s.color === 'green' ? '#9fffc0' : s.color === 'red' ? '#ff9a8a' : s.big ? '#cdb6ff' : '#e6dcff', s.big ? 4 : 2.5);
        done = s.life <= 0 || s.y < -80 || s.y > H + 40 || s.x < -90 || s.x > W + 90;
      } else if (s.k === 'lob') {
        s.t += dt; const p = Math.min(1, s.t / s.dur);
        s.px = s.x; s.py = s.y;
        s.x = s.x0 + (s.tx - s.x0) * p; s.y = s.y0 + (s.ty - s.y0) * p - Math.sin(p * Math.PI) * s.arc;
        if (s.el === 'fire') part(s.x, s.y, (rand() - 0.5) * 30, (rand() - 0.5) * 30, 0.3, rand() < 0.5 ? '#ff8a3a' : '#ffd35a', (s.big ? 7 : 4) * s.size);
        if (s.el === 'ice' && rand() < 0.5) part(s.x, s.y, 0, 0, 0.25, '#cfefff', 3);
        if (p >= 1) {
          explode(s.el, s.tx, s.ty, s.r, s.dmg, s.big, s.h, s.basic);
          if (s.slow) inRadius(s.tx, s.ty, s.r, e => slow(e, s.slow));
          done = true;
        }
      } else if (s.k === 'sweep') {
        s.y += s.vy * dt;
        for (const e of S.enemies) {
          if (e.dead || s.hit.has(e) || e.y < RANGE_Y - 20) continue;
          if (Math.abs(e.y - s.y) < 16 + e.def.r) { s.hit.add(e); hit(e, s.dmg, 'blade', s.h); if (s.slow && !e.dead) slow(e, s.slow); }
        }
        if (rand() < 0.9) part(rand() * W, s.y, 0, 30, 0.35, '#e6dcff', 3);
        done = s.y < RANGE_Y - 40;
      } else if (s.k === 'ship') {
        s.y += s.vy * dt;
        for (const e of S.enemies) {
          if (e.dead || s.hit.has(e) || e.y < RANGE_Y - 30) continue;
          const dx = e.x - s.x, dy = e.y - s.y, rr = 34 + e.def.r;
          if (dx * dx + dy * dy < rr * rr) { s.hit.add(e); hit(e, s.a * 3, 'fire', s.h); burn(e, 4, s.a * 0.3, s.h); }
        }
        if ((s.trail -= dt) <= 0) { s.trail = 0.45; pool(s.h, s.x, s.y + 20, 34, 3, s.a * 0.45, 'fire'); }
        part(s.x + (rand() - 0.5) * 20, s.y + 16, (rand() - 0.5) * 30, 50, 0.4, rand() < 0.5 ? '#ff8a3a' : '#ffd35a', 5);
        if (s.y <= RANGE_Y + 70) { explode('fire', s.x, s.y, 100, s.a * 4, true, s.h); done = true; }   // 冲到敌阵深处爆炸
      } else if (s.k === 'earrow') {
        s.t += dt; const p = Math.min(1, s.t / s.dur);
        s.x = s.x0 + (s.tx - s.x0) * p; s.y = s.y0 + (s.ty - s.y0) * p;
        done = p >= 1;
      }
      if (done) S.shots.splice(i, 1);
      if (S.over) return;
    }
  }

  function updateZones(dt) {
    for (let i = S.zones.length - 1; i >= 0; i--) {
      const z = S.zones[i];
      z.life -= dt; z.tick -= dt;
      if (z.k === 'pool') {
        if (z.tick <= 0) {
          z.tick = 0.5;
          inRadius(z.x, z.y, z.r, e => {
            if (z.el === 'fire') { hit(e, z.dmg, 'fire', z.h, { dot: true }); burn(e, 1, z.dmg * 0.3, z.h); }
            else { e.psnMark = Math.max(e.psnMark, 0.6); hit(e, z.dmg, 'poison', z.h, { dot: true }); }
          });
        }
        if (rand() < 0.25) part(z.x + (rand() - 0.5) * z.r * 1.4, z.y + (rand() - 0.5) * z.r * 0.8, 0, -24, 0.5, z.el === 'fire' ? '#ffb14a' : '#b6ff6a', 2.5);
      } else if (z.k === 'tornado') {
        z.y += z.vy * dt;
        if (z.tick <= 0) {
          z.tick = 0.25;
          inRadius(z.x, z.y, z.r, e => { hit(e, z.dmg, 'wind', z.h, { basic: z.basic }); if (!e.dead && e.y > RANGE_Y + 12) e.y = Math.max(RANGE_Y + 10, e.y - (e.def.id === 'boss' ? z.push * 0.25 : z.push)); });
        }
        if (rand() < 0.7) { const a = rand() * TAU; part(z.x + Math.cos(a) * z.r * 0.8, z.y + Math.sin(a) * z.r * 0.3, -Math.sin(a) * 90, -50, 0.4, '#d6fff1', 2.5); }
        if (z.y < -z.r * 2) z.life = 0;
      } else if (z.k === 'storm') {
        if (z.tick <= 0) {
          z.tick = z.every;
          const list = []; inRadius(z.x, z.y, z.r, e => list.push(e));
          const e = list[Math.floor(rand() * list.length)];
          if (e) { bolt(e.x + (rand() - 0.5) * 40, z.y - z.r * 0.9 - 60, e.x, e.y - 6, 1.6); hit(e, z.dmg, 'thunder', z.h); stun(e, 0.5); ring(e.x, e.y, 4, 34, 0.2, '#c4b0ff', 2); }
        }
      } else if (z.k === 'mine') {
        if ((z.t += dt) > 0.4) {
          let trig = false;
          inRadius(z.x, z.y, 14, () => { trig = true; });
          if (trig || z.life <= 0) {
            inRadius(z.x, z.y, z.r, e => { hit(e, z.dmg, 'thunder', z.h); stun(e, z.stun); });
            bolt(z.x, z.y - 70, z.x, z.y, 2); ring(z.x, z.y, 6, z.r, 0.3, '#c4b0ff', 4); burst(z.x, z.y, 12, '#efe8ff', 160, 3, 0.35);
            z.life = 0;
          }
        }
      } else if (z.k === 'barrier') {
        if (z.tick <= 0) {
          z.tick = 0.3;
          for (const e of S.enemies) {
            if (e.dead || Math.abs(e.y - z.y) > 42) continue;
            e.y = Math.max(RANGE_Y + 8, e.y - (e.def.id === 'boss' ? z.push * 0.25 : z.push));
            hit(e, z.dmg, 'wind', z.h, { dot: true });
          }
        }
        if (rand() < 0.8) part(rand() * W, z.y + (rand() - 0.5) * 50, (rand() < 0.5 ? -1 : 1) * 120, -30, 0.4, '#d6fff1', 2.5);
      } else if (z.k === 'icewall') {
        for (const e of S.enemies) {
          if (e.dead || z.hit.has(e) || Math.abs(e.y - z.y) > 18 + e.def.r * 0.5) continue;
          z.hit.add(e); stun(e, z.stun); hit(e, z.dmg, 'ice', z.h); burst(e.x, e.y, 5, '#d9f4ff', 90, 3, 0.35);
        }
      } else if (z.k === 'wind') {
        if (z.tick <= 0) {
          z.tick = 0.25; z.t += 0.25;
          const dmgNow = z.t >= 1; if (dmgNow) z.t = 0;
          for (const e of S.live) {
            if (e.dead) continue;
            e.y = Math.max(RANGE_Y + 8, e.y - (e.def.id === 'boss' ? z.push * 0.25 : z.push));
            if (dmgNow) hit(e, z.dmg, 'wind', z.h, { dot: true });
          }
        }
        if (rand() < 0.9) part(rand() * W, H * 0.25 + rand() * (WY - H * 0.25), 160, -90, 0.5, 'rgba(220,255,240,.8)', 2);
      }
      if (z.life <= 0) S.zones.splice(i, 1);
      if (S.over) return;
    }
  }

  function updateFx(dt) {
    for (let i = S.parts.length - 1; i >= 0; i--) { const p = S.parts[i]; p.life -= dt; if (p.life <= 0) { S.parts.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.vx *= 0.96; p.vy *= 0.96; }
    for (let i = S.texts.length - 1; i >= 0; i--) { const t = S.texts[i]; t.life -= dt; t.y -= 34 * dt; if (t.life <= 0) S.texts.splice(i, 1); }
    for (let i = S.bolts.length - 1; i >= 0; i--) if ((S.bolts[i].life -= dt) <= 0) S.bolts.splice(i, 1);
    for (let i = S.rings.length - 1; i >= 0; i--) if ((S.rings[i].life -= dt) <= 0) S.rings.splice(i, 1);
    for (let i = S.slashes.length - 1; i >= 0; i--) if ((S.slashes[i].life -= dt) <= 0) S.slashes.splice(i, 1);
    for (let i = S.fx.length - 1; i >= 0; i--) { const f = S.fx[i]; if ((f.life -= dt) <= 0) { S.fx.splice(i, 1); continue; } f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.spin * dt; }
    if (S.cut && (S.cut.t += dt) >= S.cut.dur) S.cut = null;
    if (S.shock && (S.shock.t -= dt) <= 0) S.shock = null;
    if (S.dim && (S.dim.t -= dt) <= 0) S.dim = null;
    for (let i = S.ghosts.length - 1; i >= 0; i--) if ((S.ghosts[i].life -= dt) <= 0) S.ghosts.splice(i, 1);
    for (let i = S.decals.length - 1; i >= 0; i--) if ((S.decals[i].life -= dt) <= 0) S.decals.splice(i, 1);
    if (S.shake > 0) S.shake -= dt;
    if (S.wallFlash > 0) S.wallFlash -= dt;
    if (S.flash && (S.flash.t -= dt) <= 0) S.flash = null;
    if (S.banner && (S.banner.t -= dt) <= 0) S.banner = null;
  }

  /* ---------------- 绘制 ---------------- */
  function outlined(str, x, y, size, color, align, sw) {
    c.font = 'bold ' + size + 'px ' + FONT; c.textAlign = align || 'center';
    c.lineJoin = 'round'; c.lineWidth = sw || 3.2; c.strokeStyle = 'rgba(20,10,6,.9)';
    c.strokeText(str, x, y); c.fillStyle = color; c.fillText(str, x, y);
  }
  function drawCoin(x, y, r) {
    c.fillStyle = '#b8862a'; Art.circ(c, x, y + 1, r); c.fillStyle = '#ffd24a'; Art.circ(c, x, y, r);
    c.fillStyle = '#b8862a'; c.fillRect(x - r * 0.3, y - r * 0.3, r * 0.6, r * 0.6);
  }
  function drawArrow(x, y, ax, ay, L, col, w, headR) {
    c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x - ax * L, y - ay * L); c.lineTo(x, y); c.stroke();
    if (headR) { c.fillStyle = '#ffffff'; Art.circ(c, x, y, headR); }
  }
  function drawShot(s) {
    if (s.k === 'arrow' || (s.k === 'lob' && s.el === 'arrow') || s.k === 'earrow') {
      let ax, ay;
      if (s.k === 'arrow') { ax = s.x - s.px; ay = s.y - s.py; } else { ax = s.tx - s.x0; ay = s.ty - s.y0; }
      const d = Math.hypot(ax, ay) || 1; ax /= d; ay /= d;
      if (s.k === 'earrow') drawArrow(s.x, s.y, ax, ay, 10, '#2a1d14', 1.6, 0);
      else {
        c.globalCompositeOperation = 'lighter';
        if (!(s.big && img(s.burn ? 'el_arrow_fire' : 'thrust', s.x - ax * 20, s.y - ay * 20, s.burn ? 70 : 90, 0, Math.atan2(ay, ax), 1))) glow(s.x, s.y, s.big ? 14 : 8, s.burn ? '255,150,70' : '255,230,160', 0.6);
        c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
        drawArrow(s.x, s.y, ax, ay, s.big ? 24 : 16, s.burn ? '#ffb070' : '#fff1c2', s.big ? 3.4 : 2.2, s.big ? 3.2 : 2.2);
      }
    } else if (s.k === 'blade') {
      const ang = Math.atan2(s.vy, s.vx);
      c.globalCompositeOperation = 'lighter';
      let done = false;
      if (s.tex) done = img(s.tex, s.x, s.y, s.texW || s.w * 2, 0, ang, 1);   // 青龙、白龙这类专属贴图；没有就按普通刀光 / 冰枪画
      if (done) { /* 已画 */ } else if (s.look === 'arrow') done = img('thrust', s.x - Math.cos(ang) * s.w * 0.8, s.y - Math.sin(ang) * s.w * 0.8, Math.max(70, s.w * 3.2), 0, ang, 1);
      else if (s.look === 'ice') done = img('el_arrow_ice', s.x - Math.cos(ang) * s.w * 0.6, s.y - Math.sin(ang) * s.w * 0.6, Math.max(70, s.w * 2.6), 0, ang, 1);
      else {
        const rgb = s.color === 'green' ? '110,255,170' : s.color === 'red' ? '255,120,90' : s.big ? '205,175,255' : '225,210,255';
        done = img('slash', s.x, s.y, s.w * 1.7, s.w * 0.85, ang + Math.PI / 2, s.big ? 1 : 0.9, rgb);
        if (done && s.big) glow(s.x, s.y, s.w * 0.7, rgb, 0.35);
      }
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
      if (done) return;
      if (s.look === 'arrow' || s.look === 'ice') {
        c.save(); c.translate(s.x, s.y); c.rotate(ang);
        const L = Math.max(22, s.w * 0.9), col = s.look === 'ice' ? '#8fdcff' : '#fff1c2';
        const g = c.createLinearGradient(-L * 2, 0, 0, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, s.look === 'ice' ? 'rgba(160,225,255,.6)' : 'rgba(255,230,160,.55)');
        c.fillStyle = g; c.fillRect(-L * 2, -s.w * 0.18, L * 2, s.w * 0.36);
        c.fillStyle = col; c.beginPath(); c.moveTo(L * 0.5, 0); c.lineTo(-L * 0.5, -s.w * 0.14 - 2); c.lineTo(-L * 0.3, 0); c.lineTo(-L * 0.5, s.w * 0.14 + 2); c.closePath(); c.fill();
        c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(L * 0.5, 0); c.lineTo(-L * 0.1, -2); c.lineTo(-L * 0.1, 2); c.closePath(); c.fill();
        c.restore();
        return;
      }
      const R = s.w / 2, col = s.color === 'green' ? [120, 255, 170] : s.color === 'red' ? [255, 110, 90] : s.big ? [185, 130, 255] : [200, 180, 255];
      c.save(); c.translate(s.x, s.y); c.rotate(ang + Math.PI / 2);
      const g = c.createLinearGradient(0, -R, 0, R * 2.4);
      g.addColorStop(0, 'rgba(' + col + ',' + (s.big ? 0.55 : 0.4) + ')'); g.addColorStop(1, 'rgba(' + col + ',0)');
      c.fillStyle = g; c.fillRect(-R * 0.8, -R * 0.2, R * 1.6, R * 2.6);
      const bg = c.createLinearGradient(0, -R, 0, -R * 0.3);
      bg.addColorStop(0, 'rgba(255,255,255,.98)'); bg.addColorStop(1, 'rgba(' + col + ',.8)');
      c.fillStyle = bg;
      c.beginPath(); c.arc(0, 0, R, Math.PI * 1.08, Math.PI * 1.92); c.arc(0, R * 0.3, R * 0.98, Math.PI * 1.86, Math.PI * 1.14, true); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(' + col + ',.9)'; c.lineWidth = s.big ? 4 : 2;
      c.beginPath(); c.arc(0, 0, R + 2, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
      c.restore();
    } else if (s.k === 'lob') {
      if (s.el === 'fire' || s.el === 'poison') {
        c.globalCompositeOperation = 'lighter';
        const r = (s.big ? 15 : 8) * s.size, ok = s.el === 'fire' ? img('el_orb_fire', s.x, s.y, r * 4, 0, S.t * 8, 1) : img('el_orb_wind', s.x, s.y, 26, 0, S.t * 9, 1, '120,235,60');
        c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
        if (ok) return;
      }
      if (s.el === 'fire') {
        const r = (s.big ? 15 : 8) * s.size;
        c.globalCompositeOperation = 'lighter';
        const g = c.createRadialGradient(s.x, s.y, 1, s.x, s.y, r * 2); g.addColorStop(0, 'rgba(255,220,120,.95)'); g.addColorStop(0.4, 'rgba(255,120,40,.7)'); g.addColorStop(1, 'rgba(255,80,20,0)');
        c.fillStyle = g; Art.circ(c, s.x, s.y, r * 2); c.globalCompositeOperation = 'source-over';
        c.fillStyle = '#fff3c4'; Art.circ(c, s.x, s.y, r * 0.5);
      } else if (s.el === 'ice') {
        const a = Math.atan2(s.ty - s.y0, s.tx - s.x0);
        c.globalCompositeOperation = 'lighter';
        const ok = img('el_arrow_ice', s.x - Math.cos(a) * 18, s.y - Math.sin(a) * 18, 64, 0, a, 1);
        c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
        if (ok) return;
        c.save(); c.translate(s.x, s.y); c.rotate(a);
        c.fillStyle = '#8fdcff'; c.beginPath(); c.moveTo(13, 0); c.lineTo(-9, -5); c.lineTo(-5, 0); c.lineTo(-9, 5); c.closePath(); c.fill();
        c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(13, 0); c.lineTo(-4, -1.8); c.lineTo(-4, 1.8); c.closePath(); c.fill();
        c.restore();
      } else if (s.el === 'poison') {
        c.fillStyle = '#4c8a1e'; Art.circ(c, s.x, s.y, 7); c.fillStyle = '#b6ff6a'; Art.circ(c, s.x - 2, s.y - 2, 3);
      } else if (s.el === 'rock') {
        c.fillStyle = 'rgba(0,0,0,.25)'; Art.ell(c, s.tx, s.ty + 4, 14 * (s.t / s.dur), 5 * (s.t / s.dur));
        c.fillStyle = '#6a5440'; Art.circ(c, s.x, s.y, 11); c.fillStyle = '#8f7658'; Art.circ(c, s.x - 3, s.y - 3, 6);
      }
    } else if (s.k === 'sweep') {
      const g = c.createLinearGradient(0, s.y - 10, 0, s.y + 50); g.addColorStop(0, 'rgba(230,220,255,.85)'); g.addColorStop(1, 'rgba(160,110,255,0)');
      c.fillStyle = g; c.fillRect(0, s.y - 6, W, 56);
      c.fillStyle = '#ffffff'; c.fillRect(0, s.y - 7, W, 3);
      c.globalCompositeOperation = 'lighter';
      for (let x = 30; x < W; x += 80) img('slash', x, s.y + 4, 110, 40, 0, 0.8, '225,210,255');
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    } else if (s.k === 'ship') {
      // 火船：贴图画成拖着火尾往敌阵冲的火流星（火尾在后面，也就是下方）；没有贴图时退回画一条小船
      c.globalCompositeOperation = 'lighter';
      const ok = img('flame', s.x, s.y + 62, 62, 150, Math.PI + Math.sin(S.t * 20) * 0.04, 0.9);
      if (ok) { glow(s.x, s.y, 46, '255,140,50', 0.5); img('el_orb_fire', s.x, s.y, 74, 74, S.t * 7, 1); }
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
      if (ok) return;
      c.save(); c.translate(s.x, s.y);
      c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(0, -10, 2, 0, -10, 46); g.addColorStop(0, 'rgba(255,200,90,.9)'); g.addColorStop(1, 'rgba(255,80,20,0)');
      c.fillStyle = g; Art.circ(c, 0, -10, 46); c.globalCompositeOperation = 'source-over';
      c.fillStyle = '#5a3a22'; c.beginPath(); c.moveTo(-16, -22); c.lineTo(16, -22); c.lineTo(12, 18); c.lineTo(0, 28); c.lineTo(-12, 18); c.closePath(); c.fill();
      c.fillStyle = '#c8a070'; c.fillRect(-1.5, -34, 3, 40);
      c.fillStyle = '#d8b48a'; c.beginPath(); c.moveTo(0, -34); c.lineTo(14, -24); c.lineTo(0, -14); c.closePath(); c.fill();
      c.restore();
    }
  }
  function drawZone(z, layer) {
    if (z.k === 'pool' && layer === 2) {                   // 叠加层：火焰 / 毒雾贴图
      const f = Math.min(1, z.life / 0.6) * Math.min(1, (z.max - z.life) / 0.25 + 0.15);
      if (z.el === 'fire') {
        glow(z.x, z.y, z.r * 1.1, '255,110,30', 0.18 * f);
        const nf = z.r > 60 ? 2 : 1;                         // 火堆多的时候（连营、火路）每处只画一两簇，免得连成一片盖住敌人
        for (let i = 0; i < nf; i++) { const b = z.blobs[i], fl = 0.85 + Math.sin(S.t * 14 + i * 2 + z.x) * 0.15; img('flame', z.x + b[0] * z.r * 0.6, z.y + b[1] * z.r * 0.4 - z.r * 0.25 * fl, z.r * 0.42, z.r * 0.7 * fl, 0, 0.38 * f); }
      } else img('whirl', z.x, z.y, z.r * 2, z.r * 1.2, S.t * 0.8, 0.3 * f, '110,230,50');
      return;
    }
    if (z.k === 'tornado' && layer === 2) {
      const f = Math.min(1, z.life / 0.4) * Math.min(1, (z.max - z.life) / 0.3 + 0.1);
      let ok = true;
      for (let i = 0; i < 4 && ok; i++) { const p = i / 3, rx = z.r * (0.45 + 0.85 * p); ok = img('el_orb_wind', z.x + Math.sin(S.t * 5 + i) * z.r * 0.12, z.y - p * z.r * 2.1, rx * 2, rx * 0.75, S.t * (9 - i * 1.5), 0.8 * f); }
      if (ok) z.texOK = true;
      return;
    }
    if (z.k === 'storm' && layer === 2) { img('circle', z.x, z.y, z.r * 1.6, z.r * 0.95, S.t * 0.6, 0.1 * Math.min(1, z.life / 0.5), '190,160,255'); return; }
    if (z.k === 'mine' && layer === 2) { img('circle', z.x, z.y, 44, 26, S.t * 2, 0.7 + Math.sin(S.t * 8 + z.x) * 0.25, '190,160,255'); return; }
    if (z.k === 'wind' && layer === 2) { const f = Math.min(1, z.life / 0.6, (z.max - z.life) / 0.4 + 0.1); img('circle', W / 2, WY - 120, 300, 170, S.t * 0.5, 0.07 * f, '200,255,235'); return; }
    if (z.k === 'frost' && layer === 2) { img('circle', z.x, z.y, z.r * 2.1, z.r * 1.3, -S.t * 0.4, 0.25 * Math.min(1, z.life / 0.4), '170,225,255'); return; }
    if (z.k === 'barrier' && layer === 2) { const f = Math.min(1, z.life / 0.5, (z.max - z.life) / 0.3 + 0.1); for (let x = 40; x < W; x += 92) img('el_orb_wind', x, z.y, 110, 60, S.t * 6 + x, 0.55 * f); return; }
    if (layer === 2) return;
    if (z.k === 'pool' && layer === 0) {
      const fire = z.el === 'fire', f = Math.min(1, z.life / 0.6) * Math.min(1, (z.max - z.life) / 0.25 + 0.15) * (fire ? 0.4 : 1);   // 火的地面色块淡一些，火焰贴图另画
      c.globalAlpha = 0.42 * f; c.fillStyle = fire ? '#b8401a' : '#2f9a1a';
      for (const b of z.blobs) Art.ell(c, z.x + b[0] * z.r, z.y + b[1] * z.r * 0.62, b[2] * z.r, b[2] * z.r * 0.62);
      c.globalAlpha = 0.5 * f; c.fillStyle = fire ? '#ff8a3a' : '#8dea4a';
      for (const b of z.blobs) Art.ell(c, z.x + b[0] * z.r, z.y + b[1] * z.r * 0.62, b[2] * z.r * 0.55, b[2] * z.r * 0.34);
      c.globalAlpha = 0.7 * f; c.fillStyle = fire ? '#ffe08a' : '#d8ff9a';
      for (let i = 0; i < 5; i++) { const b = z.blobs[i], pr = (S.t * 0.9 + i * 0.37) % 1; Art.circ(c, z.x + b[0] * z.r * 1.3, z.y + b[1] * z.r * 0.8 - pr * 10, (1 - pr) * 4 * (z.r / 54) + 0.5); }
      c.globalAlpha = 1;
    } else if (z.k === 'tornado' && layer === 1 && !z.texOK) {
      const f = Math.min(1, z.life / 0.4) * Math.min(1, (z.max - z.life) / 0.3 + 0.1), hgt = z.r * 2.3;
      c.lineCap = 'round';
      for (let i = 0; i < 10; i++) {
        const p = i / 9, rx = z.r * (0.22 + 0.78 * p), yy = z.y - p * hgt, xx = z.x + Math.sin(S.t * 5 + i * 0.7) * z.r * 0.14, a0 = S.t * 10 + i * 1.3;
        c.fillStyle = 'rgba(170,245,220,' + (0.09 * f) + ')'; Art.ell(c, xx, yy, rx, rx * 0.32);
        c.strokeStyle = 'rgba(225,255,245,' + (0.75 * f) + ')'; c.lineWidth = z.big ? 3.4 : 2.2;
        c.beginPath(); c.ellipse(xx, yy, rx, rx * 0.32, 0, a0, a0 + 2.6); c.stroke();
        c.strokeStyle = 'rgba(120,225,200,' + (0.6 * f) + ')'; c.lineWidth = z.big ? 2.2 : 1.4;
        c.beginPath(); c.ellipse(xx, yy, rx * 0.8, rx * 0.26, 0, a0 + 3.3, a0 + 5.2); c.stroke();
      }
    } else if (z.k === 'storm' && layer === 1) {
      const f = Math.min(1, z.life / 0.5, (z.max - z.life) / 0.4 + 0.1), cy = z.y - z.r * 0.9 - 60;
      c.globalAlpha = 0.55 * f; c.fillStyle = '#2a2240';
      for (let i = 0; i < 6; i++) Art.ell(c, z.x + Math.cos(i * 1.1 + S.t) * z.r * 0.55, cy + Math.sin(i * 1.7) * 10, z.r * 0.45, 22);
      c.globalAlpha = 1;
    } else if (z.k === 'mine' && layer === 0) {
      const p = 0.6 + Math.sin(S.t * 8 + z.x) * 0.3;
      c.strokeStyle = 'rgba(196,176,255,' + p + ')'; c.lineWidth = 2;
      c.beginPath(); c.ellipse(z.x, z.y, 14, 6, 0, 0, TAU); c.stroke();
      c.fillStyle = 'rgba(196,176,255,' + (p * 0.5) + ')'; Art.ell(c, z.x, z.y, 6, 2.6);
    } else if (z.k === 'barrier' && layer === 1) {
      const f = Math.min(1, z.life / 0.5, (z.max - z.life) / 0.3 + 0.1);
      c.globalAlpha = 0.22 * f; c.fillStyle = '#9ff3d6'; c.fillRect(0, z.y - 36, W, 72); c.globalAlpha = 0.8 * f;
      c.strokeStyle = '#e8fff6'; c.lineWidth = 2;
      for (let i = 0; i < 6; i++) { const yy = z.y - 30 + i * 12, off = (S.t * 300 + i * 90) % W; c.beginPath(); c.moveTo(off - 120, yy); c.lineTo(off, yy - 4); c.stroke(); }
      c.globalAlpha = 1;
    } else if (z.k === 'icewall' && layer === 0) {
      const f = Math.min(1, z.life / 0.5, (z.max - z.life) / 0.25 + 0.1);
      c.globalAlpha = f;
      for (let x = 30; x < W; x += 26) {
        const hgt = 18 + ((x * 7) % 11);
        c.fillStyle = '#8fdcff'; c.beginPath(); c.moveTo(x - 9, z.y + 8); c.lineTo(x, z.y + 8 - hgt); c.lineTo(x + 9, z.y + 8); c.closePath(); c.fill();
        c.fillStyle = '#e8f8ff'; c.beginPath(); c.moveTo(x - 3, z.y + 6); c.lineTo(x, z.y + 8 - hgt); c.lineTo(x + 2, z.y + 6); c.closePath(); c.fill();
      }
      c.globalAlpha = 1;
    } else if (z.k === 'frost' && layer === 0) {
      const f = Math.min(1, z.life / 0.4, (z.max - z.life) / 0.2 + 0.1);
      c.globalAlpha = 0.35 * f; c.fillStyle = '#cfefff'; Art.ell(c, z.x, z.y, z.r, z.r * 0.62);
      c.globalAlpha = 0.8 * f; c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.beginPath(); c.ellipse(z.x, z.y, z.r, z.r * 0.62, 0, 0, TAU); c.stroke();
      c.globalAlpha = 1;
    }
  }
  /* 敌人头上的状态：中毒、受惊、混乱、标记 */
  function drawStatus(e) {
    const ds = e.ds || 1, top = e.y - e.def.r * 2.5 * ds - (e.def.id === 'boss' ? 30 : 12);
    if (e.psn > 0 && !Assets.get(e.spr || 'enemy:' + e.def.id)) { c.fillStyle = 'rgba(120,230,70,.35)'; Art.circ(c, e.x, e.y, e.def.r * 0.9); }
    if (e.burn > 0 && Assets.get('fx:flame')) { c.globalCompositeOperation = 'lighter'; img('flame', e.x, e.y - e.def.r * 0.8, e.def.r * 1.1, e.def.r * 1.9, 0, 0.35 + Math.sin(S.t * 18 + e.ph) * 0.1); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; }
    if (e.fear > 0) outlined('!', e.x, top, 15, '#ffe08a', 'center', 3);
    else if (e.conf > 0) {
      for (let i = 0; i < 3; i++) { const a = S.t * 6 + i * TAU / 3; c.fillStyle = '#e8b0ff'; Art.circ(c, e.x + Math.cos(a) * 9, top + Math.sin(a) * 3, 2.2); }
    }
    if (e.mark > 0 || e.vuln > 0.2) {
      c.strokeStyle = e.mark > 0 ? 'rgba(200,120,255,.9)' : 'rgba(255,200,120,.8)'; c.lineWidth = 1.6;
      c.beginPath(); c.ellipse(e.x, e.y + e.def.r * 0.9, e.def.r * 1.1, e.def.r * 0.42, 0, 0, TAU); c.stroke();
    }
  }
  function drawHeroes(list, t) {
    list.slice().sort((a, b) => a.y - b.y).forEach(h => {
      Art.hero(c, h.def, h.x, h.y, 1.45, t, h.anim);
      if (h.rage >= 100) {
        c.globalCompositeOperation = 'lighter';
        c.strokeStyle = 'rgba(255,220,110,' + (0.55 + Math.sin(t * 8) * 0.3) + ')'; c.lineWidth = 3;
        c.beginPath(); c.ellipse(h.x, h.y + 29, 31, 12, 0, 0, TAU); c.stroke();
        c.globalCompositeOperation = 'source-over';
      }
      if (h.hasteT > 0 || h.bigT > 0) { c.strokeStyle = 'rgba(255,240,180,.7)'; c.lineWidth = 2; c.beginPath(); c.ellipse(h.x, h.y + 29, 26 + Math.sin(t * 12) * 2, 9, 0, 0, TAU); c.stroke(); }
    });
  }

  function render() {
    c.setTransform(2, 0, 0, 2, 0, 0);
    c.save();
    if (S.shake > 0) c.translate((rand() - 0.5) * 9 * Math.min(1, S.shake * 4), (rand() - 0.5) * 9 * Math.min(1, S.shake * 4));
    c.drawImage(Art.background(), 0, 0, W, H);
    ambientGround(S.t);
    if (S.wallFlash > 0) {                                  // 城墙挨打：垛口一带泛红
      c.globalCompositeOperation = 'lighter'; c.save(); c.translate(W / 2, WY + 4); c.scale(1, 0.2);
      glow(0, 0, 210, '255,70,40', Math.min(1, S.wallFlash * 5)); c.restore();
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    }
    for (const d of S.decals) {
      c.globalAlpha = Math.min(1, d.life / 2) * 0.42;
      c.save(); c.translate(d.x, d.y); c.scale(1, 0.6); c.rotate(d.rot); c.drawImage(scorch(), -d.r, -d.r, d.r * 2, d.r * 2); c.restore();
    }
    c.globalAlpha = 1;
    for (const z of S.zones) drawZone(z, 0);
    for (const d of S.drops) {
      if (d.k === 'coin') drawCoin(d.x, d.y, 6);
      else { c.fillStyle = 'rgba(0,0,0,.3)'; Art.ell(c, d.x, d.y + 6, 8, 3); c.fillStyle = '#fbf3e2'; c.beginPath(); c.arc(d.x, d.y + 3, 8.5, Math.PI, 0); c.closePath(); c.fill(); c.fillStyle = '#e8c9a0'; Art.circ(c, d.x, d.y - 3, 1.6); }
    }
    const es = S.enemies.slice().sort((a, b) => a.y - b.y);
    for (const e of es) { Art.enemy(c, e, S.t); drawStatus(e); }
    for (const g of S.ghosts) Art.enemyGhost(c, g, 1 - g.life / g.max);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    c.drawImage(haze(), 0, 0, W, Assets.get('bg') ? 200 : 300);                       // 远处的敌人罩一层烟尘：2.5D 纵深
    drawHeroes(S.heroes, S.t);
    for (const s of S.shots) drawShot(s);
    for (const z of S.zones) drawZone(z, 1);
    c.globalCompositeOperation = 'lighter';
    for (const z of S.zones) drawZone(z, 2);
    for (const f of S.fx) {
      const p = 1 - f.life / f.max, k = 1 + (f.grow - 1) * p;
      c.globalAlpha = Math.max(0, Math.min(1, f.a * Math.min(1, f.life / f.max * 2.5) * (f.fadeIn ? Math.min(1, p / f.fadeIn) : 1)));
      c.save(); c.translate(f.x, f.y); if (f.rot) c.rotate(f.rot); c.scale(k, k);
      c.drawImage(f.im, -f.w * f.ax, -f.h * f.ay, f.w, f.h); c.restore();
    }
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;

    // 光环、刀光、粒子、闪电
    for (const r of S.rings) {
      const p = 1 - r.life / r.max, rad = r.r0 + (r.r1 - r.r0) * p;
      c.globalAlpha = (1 - p) * 0.9;
      if (r.fill) { c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(r.x, r.y, 1, r.x, r.y, rad); g.addColorStop(0, '#fff2b0'); g.addColorStop(0.5, r.color); g.addColorStop(1, 'rgba(255,90,20,0)'); c.fillStyle = g; Art.circ(c, r.x, r.y, rad); c.globalCompositeOperation = 'source-over'; }
      else { c.strokeStyle = r.color; c.lineWidth = r.w * (1 - p * 0.6); c.beginPath(); c.ellipse(r.x, r.y, rad, rad * 0.7, 0, 0, TAU); c.stroke(); }
    }
    c.globalAlpha = 1;
    for (const s of S.slashes) {
      const p = s.life / s.max; c.globalAlpha = p; c.strokeStyle = '#ffffff'; c.lineWidth = 4 * p; c.lineCap = 'round';
      c.beginPath(); c.moveTo(s.x - Math.cos(s.a) * 30, s.y - Math.sin(s.a) * 30); c.lineTo(s.x + Math.cos(s.a) * 30, s.y + Math.sin(s.a) * 30); c.stroke();
    }
    c.globalAlpha = 1;
    for (const p of S.parts) { c.globalAlpha = Math.min(1, p.life / p.max * 1.6); c.fillStyle = p.color; Art.circ(c, p.x, p.y, p.size * (0.4 + 0.6 * p.life / p.max)); }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'lighter'; c.lineJoin = 'round'; c.lineCap = 'round';
    for (const b of S.bolts) {
      const a = b.life / b.max;
      c.beginPath(); b.pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]));
      c.strokeStyle = 'rgba(150,110,255,' + (0.7 * a) + ')'; c.lineWidth = 7 * b.wide; c.stroke();
      c.strokeStyle = 'rgba(255,255,255,' + a + ')'; c.lineWidth = 2.2 * b.wide; c.stroke();
    }
    c.globalCompositeOperation = 'source-over';
    for (const t of S.texts) {
      const p = t.life / t.max; c.globalAlpha = Math.min(1, p * 2.2);
      outlined(t.str, t.x, t.y, t.size * (p > 0.85 ? 1 + (p - 0.85) * 3 : 1), t.color, 'center', 3);
    }
    c.globalAlpha = 1;
    c.restore();
    ambientAir(S.t);
    c.drawImage(grade(), 0, 0, W, H);
    if (S.flash) { c.fillStyle = 'rgba(' + S.flash.color + ',' + (S.flash.a * S.flash.t / S.flash.max) + ')'; c.fillRect(0, 0, W, H); }

    if (S.cut) drawCut(S.cut);

    // —— 顶部信息 ——
    const tg = c.createLinearGradient(0, 0, 0, 120); tg.addColorStop(0, 'rgba(10,6,4,.75)'); tg.addColorStop(1, 'rgba(10,6,4,0)');
    c.fillStyle = tg; c.fillRect(0, 0, W, 120);
    c.font = 'bold 27px SGBrush,' + FONT; c.textAlign = 'center'; c.lineJoin = 'round'; c.lineWidth = 5; c.strokeStyle = 'rgba(20,10,6,.9)';
    const title = '第' + S.ch.index + '章 ' + S.ch.name + ' · 第' + S.ch.sub + '关';
    c.strokeText(title, W / 2, 40); c.fillStyle = '#ffd76a'; c.fillText(title, W / 2, 40);
    const bx = 110, bw = 320;                               // 波次条（绿）在上，城防条（红）在下
    c.fillStyle = 'rgba(0,0,0,.65)'; Art.rr(c, bx - 3, 51, bw + 6, 26, 13); c.fill(); Art.rr(c, bx + 17, 81, bw - 34, 16, 8); c.fill();
    const wp = S.over && S.win ? 1 : Math.min(1, (S.wave - 1 + (S.waveSize ? S.spawned / S.waveSize : 1)) / CFG.WAVES);
    if (wp > 0.03) { const g2 = c.createLinearGradient(0, 54, 0, 74); g2.addColorStop(0, '#8fe86a'); g2.addColorStop(1, '#3fae3e'); c.fillStyle = g2; Art.rr(c, bx, 54, bw * wp, 20, 10); c.fill(); }
    const hp = Math.max(0, S.wall / S.wallMax);
    if (hp > 0.03) { c.fillStyle = hp > 0.5 ? '#e0483a' : hp > 0.25 ? '#e8802a' : '#ff2a2a'; Art.rr(c, bx + 20, 83, (bw - 40) * hp, 12, 6); c.fill(); }
    c.strokeStyle = 'rgba(240,210,122,.85)'; c.lineWidth = 1.6; Art.rr(c, bx - 3, 51, bw + 6, 26, 13); c.stroke();
    c.strokeStyle = 'rgba(232,193,90,.6)'; c.lineWidth = 1.2; Art.rr(c, bx + 17, 81, bw - 34, 16, 8); c.stroke();
    outlined(S.wave + '/' + CFG.WAVES + ' 波', W / 2, 70, 16, '#ffffff', 'center', 3);
    outlined('城防 ' + Math.ceil(Math.max(0, S.wall)) + '/' + S.wallMax, W / 2, 93, 11, '#ffffff', 'center', 2.4);
    drawCoin(W - 82, 30, 9); outlined(String(Math.round(S.coins)), W - 68, 36, 17, '#ffe9a8', 'left');

    if (S.aim !== null) {
      const h = S.heroes.find(q => q.slot === S.aim);
      c.fillStyle = 'rgba(10,6,4,.35)'; c.fillRect(0, 120, W, WY - 120);
      c.strokeStyle = 'rgba(255,224,138,' + (0.5 + Math.sin(idleT * 8) * 0.3) + ')'; c.lineWidth = 3; c.setLineDash([10, 8]);
      c.strokeRect(8, RANGE_Y, W - 16, WY - RANGE_Y - 10); c.setLineDash([]);
      if (h) outlined('点选战场 · 释放【' + h.def.ult + '】', W / 2, 150, 20, '#ffe08a', 'center', 4);
      outlined('再点一次头像 = 自动选目标', W / 2, 174, 13, '#e8d8b8', 'center', 3);
    }

    if (S.banner) {
      const p = S.banner.t / S.banner.max, a = S.banner.max > 50 ? 1 : Math.min(1, p * 3, (1 - p) * 6);
      c.globalAlpha = a;
      c.fillStyle = 'rgba(10,6,4,.6)'; c.fillRect(0, 300, W, 64);
      c.fillStyle = '#d8b04a'; c.fillRect(0, 300, W, 2); c.fillRect(0, 362, W, 2);
      outlined(S.banner.text, W / 2, 343, 30, S.over && !S.win ? '#ff6a5a' : '#ffe08a', 'center', 5);
      c.globalAlpha = 1;
    }
  }

  /* —— 氛围 —— 灯笼的暖光（位置对着背景图里的四盏灯笼，没换背景图时不画）、飘动的火星和尘土 */
  const LANTERNS = [[127, 652, 46], [406, 652, 46], [37, 826, 54], [503, 826, 54]];
  function ambientGround(t) {
    if (!Assets.get('bg')) return;
    c.globalCompositeOperation = 'lighter';
    LANTERNS.forEach((l, i) => {
      const f = 0.75 + Math.sin(t * 7 + i * 2.3) * 0.08 + Math.sin(t * 13.7 + i) * 0.05;
      glow(l[0], l[1], l[2] * (0.95 + f * 0.1), '255,170,70', 0.42 * f);
      c.save(); c.translate(l[0], l[1] + 26); c.scale(1, 0.4); glow(0, 0, l[2] * 1.5, '255,150,60', 0.2 * f); c.restore();   // 灯光洒在地上
    });
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  }
  function ambientAir(t) {
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) {                           // 火星：位置只由时间算出来，不占状态
      const sp = 9 + (i * 7 % 11), ph = i * 37.7, span = H * 0.95;
      const y = H * 0.9 - ((t * sp + ph * 9) % span), x = (i * 53.3 % W) + Math.sin(t * 0.7 + ph) * 16 + t * 3 % 1;
      const tw = 0.5 + Math.sin(t * 3 + ph) * 0.5, r = 1.2 + (i % 3) * 0.6;
      glow(x, y, r * 4, i % 4 ? '255,170,80' : '255,225,160', 0.22 * tw * Math.min(1, y / 120));
    }
    c.globalAlpha = 0.05;                                    // 远处两团缓缓飘的尘雾
    for (let i = 0; i < 2; i++) { const x = ((t * (6 + i * 4) + i * 300) % (W + 400)) - 200; c.save(); c.translate(x, 150 + i * 90); c.scale(1, 0.3); glow(0, 0, 190, '255,225,190', 0.11); c.restore(); }
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  }
  let scorchCv = null;
  function scorch() {
    if (scorchCv) return scorchCv;
    scorchCv = document.createElement('canvas'); scorchCv.width = scorchCv.height = 128;
    const g = scorchCv.getContext('2d');
    for (let i = 0; i < 26; i++) {
      const a = (i * 2.4) % TAU, d = (i * 13 % 34), r = 14 + (i * 7 % 22), x = 64 + Math.cos(a) * d, y = 64 + Math.sin(a) * d;
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(18,10,6,.5)'); gr.addColorStop(1, 'rgba(18,10,6,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    return scorchCv;
  }

  let hazeCv = null, gradeCv = null;
  function haze() {
    if (hazeCv) return hazeCv;
    hazeCv = document.createElement('canvas'); hazeCv.width = 4; hazeCv.height = 300;
    const g = hazeCv.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 300);
    gr.addColorStop(0, 'rgba(36,24,18,.6)'); gr.addColorStop(0.4, 'rgba(48,32,22,.2)'); gr.addColorStop(1, 'rgba(48,32,22,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 300);
    return hazeCv;
  }
  /* 整体调色：压暗四角 + 一点暖色，弱化平涂的卡通感（预先画好，每帧贴一次） */
  function grade() {
    if (gradeCv) return gradeCv;
    gradeCv = document.createElement('canvas'); gradeCv.width = 270; gradeCv.height = 480;
    const g = gradeCv.getContext('2d'), gr = g.createRadialGradient(135, 230, 60, 135, 240, 330);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.7, 'rgba(10,5,2,.12)'); gr.addColorStop(1, 'rgba(10,5,2,.5)');
    g.fillStyle = gr; g.fillRect(0, 0, 270, 480);
    return gradeCv;
  }

  /* 大招特写横幅：滑入 → 停住 → 滑出 */
  function drawCut(k) {
    const p = k.t / k.dur, ein = Math.min(1, p / 0.16), eout = Math.max(0, (p - 0.8) / 0.2);
    const off = (1 - ein) * (1 - ein) * W - eout * eout * W, y = 400, hh = 150;
    c.save();
    c.globalAlpha = Math.min(1, ein * 2) * (1 - eout);
    c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(0, y - hh / 2 - 6, W, hh + 12);
    c.beginPath(); c.moveTo(off + 20, y - hh / 2); c.lineTo(off + W + 40, y - hh / 2); c.lineTo(off + W + 10, y + hh / 2); c.lineTo(off - 10, y + hh / 2); c.closePath(); c.clip();
    const iw = W + 60, ih = iw * k.im.height / k.im.width;
    c.drawImage(k.im, off - 20, y - ih / 2 + (p * 14 - 7), iw, ih);
    c.restore();
    c.globalAlpha = Math.min(1, ein * 2) * (1 - eout);
    c.fillStyle = k.color; c.fillRect(off, y - hh / 2 - 4, W, 4); c.fillRect(off - 20, y + hh / 2, W, 4);
    outlined(k.name, W - 30 - off * 0.6, y + hh / 2 - 16, 40, '#fff3d6', 'right', 6);
    outlined(k.who, W - 34 - off * 0.6, y - hh / 2 + 30, 18, k.color, 'right', 4);
    c.globalAlpha = 1;
  }

  /* 主城待机画面：城墙上站着当前阵容 */
  function renderIdle() {
    c.setTransform(2, 0, 0, 2, 0, 0);
    c.drawImage(Art.background(), 0, 0, W, H);
    ambientGround(idleT);
    const list = [];
    Save.data.team.forEach((id, i) => { if (id) list.push({ def: HERO_MAP[id], x: SLOTS[i][0], y: SLOTS[i][1], anim: 0, rage: 0 }); });
    drawHeroes(list, idleT);
    ambientAir(idleT);
    c.drawImage(grade(), 0, 0, W, H);
  }

  function step(dt) {
    if (S.aim !== null) { if ((S.aimT += dt) > 8) S.aim = null; dt *= CFG.AIM_SLOW; }
    for (let i = 0, n = Save.data.speed || 1; i < n && S && !S.choosing; i++) { if (!S.over) update(dt); if (S) updateFx(dt); }
  }
  /* 画一帧：WebGL 画面可用就用它（出错自动退回 2D），否则用这里的 2D 画法 */
  function draw() {
    if (typeof GLView !== 'undefined' && GLView.active()) {
      try { GLView.render(S, S ? S.t : idleT); return; }
      catch (e) { GLView.disable('绘制出错：' + (e && e.message)); if (typeof console !== 'undefined') console.error(e); }
    }
    if (S) render(); else renderIdle();
  }
  function frame(dt) {
    dt = Math.min(dt, 0.05); idleT += dt;
    if (S && !S.paused && !S.choosing) step(dt);
    draw();
    if (S) UI.hud(S);
  }

  /* 只跑逻辑不画（自动化测试 / 数值模拟用） */
  function tick(dt) { if (S && !S.paused && !S.choosing) step(Math.min(dt, 0.05)); }

  return { init, start, stop, frame, tick, tapAt, ult, cancelAim, get state() { return S; }, SLOTS };
})();
