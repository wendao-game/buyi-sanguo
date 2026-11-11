'use strict';
/* ============================================================
 * 战斗引擎：波次、武将普攻与大招、敌人、特效、结算
 * ============================================================ */

const Battle = (function () {
  const W = CFG.W, H = CFG.H, WY = CFG.WALL_Y, TAU = Math.PI * 2;
  const SLOTS = CFG.SLOTS;
  const RANGE_Y = 175;            // 敌人走出远处烟尘（越过这条线）后武将才会攻击
  const FONT = '"Microsoft YaHei","PingFang SC",sans-serif';
  const rand = Math.random;
  let cv, c, S = null, idleT = 0;

  function init(canvas) { cv = canvas; c = cv.getContext('2d'); }

  /* ---------------- 开局 ---------------- */
  function start(stage) {
    S = {
      stage, ch: chapterOf(stage), wave: 0, waveT: 0, waveDur: 0, spawned: 0, waveSize: 1,
      queue: [], enemies: [], live: [], heroes: [], shots: [], zones: [], parts: [], texts: [], bolts: [], drops: [], rings: [], timers: [],
      t: 0, coins: 0, kills: 0, buffs: { atk: 1, spd: 1, crit: 0, rage: 1, ult: 1, coin: 1 },
      over: false, win: false, paused: false, choosing: false, wall: 0, wallMax: 0, shake: 0, wallFlash: 0, banner: null, flash: null,
    };
    let pw = 0;
    Save.data.team.forEach((id, i) => {
      if (!id) return;
      const st = heroStats(id); pw += st.power;
      S.heroes.push({ slot: i, def: HERO_MAP[id], atk: st.atk, cd: st.cd, x: SLOTS[i][0], y: SLOTS[i][1], t: 0.4 + rand() * 0.6, rage: 0, anim: 0 });
    });
    S.wallMax = S.wall = Math.round(400 + pw);
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
      acd: 0.3 + rand() * 0.7, flash: 0, frozen: 0, slow: 0, burn: 0, burnT: 0, burnDps: 0,
      walk: rand() * 6, ph: rand() * 6, dead: false,
    });
  }
  function afterWave() {
    if (S.wave % CFG.BUFF_EVERY === 0 && S.wave < CFG.WAVES) {
      S.choosing = true;
      const pool = BUFFS.slice(), opts = [];
      while (opts.length < 3) opts.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
      UI.showBuffs(opts, i => { opts[i].apply(S.buffs, S); S.choosing = false; nextWave(); });
    } else nextWave();
  }
  function finish(win) {
    if (S.over) return;
    S.over = true; S.win = win;
    S.banner = { text: win ? '大获全胜' : '城池失守', t: 99, max: 99 };
    const res = settleBattle(S.stage, win, win ? CFG.WAVES : S.wave - 1, Math.round(S.coins));
    res.win = win; res.kills = S.kills; res.stage = S.stage; res.wave = S.wave;
    const ref = S;
    setTimeout(() => { if (S === ref) UI.showResult(res); }, 1100);
  }

  /* ---------------- 特效小工具 ---------------- */
  function part(x, y, vx, vy, life, color, size, g) {
    if (S.parts.length > 700) return;
    S.parts.push({ x, y, vx, vy, life, max: life, color, size, g: g || 0 });
  }
  function burst(x, y, n, color, spd, size, life) {
    for (let i = 0; i < n; i++) { const a = rand() * TAU, v = spd * (0.3 + rand() * 0.7); part(x, y, Math.cos(a) * v, Math.sin(a) * v, life * (0.6 + rand() * 0.4), color, size * (0.6 + rand() * 0.6)); }
  }
  function ring(x, y, r0, r1, life, color, w, fill) { S.rings.push({ x, y, r0, r1, life, max: life, color, w: w || 3, fill: !!fill }); }
  function text(x, y, str, color, size, life, force) {
    if (S.texts.length > 110 && !force) return;
    S.texts.push({ x, y, str: String(str), color, size, life: life || 0.8, max: life || 0.8 });
  }
  function later(t, fn) { S.timers.push({ t, fn }); }
  function bolt(x1, y1, x2, y2, wide) {
    const pts = [[x1, y1]], n = 6;
    for (let i = 1; i < n; i++) { const p = i / n; pts.push([x1 + (x2 - x1) * p + (rand() - 0.5) * 26, y1 + (y2 - y1) * p + (rand() - 0.5) * 16]); }
    pts.push([x2, y2]);
    S.bolts.push({ pts, life: 0.2, max: 0.2, wide: wide || 1 });
  }

  /* ---------------- 伤害 ---------------- */
  function hit(e, dmg, el, critBonus) {
    if (e.dead) return;
    const crit = rand() < 0.08 + S.buffs.crit + (critBonus || 0);
    dmg = Math.max(1, Math.round(dmg * (0.9 + rand() * 0.2) * (crit ? 2 : 1)));
    e.hp -= dmg; e.flash = 0.1;
    text(e.x + (rand() - 0.5) * 18, e.y - e.def.r - 8 - rand() * 8, dmg, crit ? '#ffdf4a' : ELEMENTS[el].color, crit ? 23 : 15, 0.75, crit);
    if (e.hp <= 0) kill(e);
  }
  function kill(e) {
    e.dead = true; S.kills++;
    burst(e.x, e.y, e.def.id === 'boss' ? 40 : 7, e.def.body, 120, 4, 0.5);
    if (e.def.id === 'boss') { ring(e.x, e.y, 10, 140, 0.5, '#ffd24a', 5); S.shake = 0.4; }
    const big = e.def.id === 'boss' || e.def.id === 'elite';
    if (big || rand() < CFG.COIN_DROP_RATE) S.drops.push({ k: 'coin', x: e.x, y: e.y, sx: e.x, sy: e.y, t: 0, dur: 0.7, wait: 0.35, val: e.def.coin * S.buffs.coin });
    if (rand() < CFG.BUN_DROP_RATE) S.drops.push({ k: 'bun', x: e.x, y: e.y, sx: e.x, sy: e.y, t: 0, dur: 0.8, wait: 0.5, val: 0.04 });
  }
  function inRadius(x, y, r, fn) {
    for (const e of S.enemies) {
      if (e.dead) continue;
      const dx = e.x - x, dy = e.y - y, rr = r + e.def.r * 0.6;
      if (dx * dx + dy * dy < rr * rr) fn(e);
    }
  }
  function frontmost() { let b = null; for (const e of S.live) if (!e.dead && (!b || e.y > b.y)) b = e; return b; }
  function densest(rad) {
    const list = S.live.filter(e => !e.dead);
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
  function randLive() { const l = S.live.filter(e => !e.dead); return l.length ? l[Math.floor(rand() * l.length)] : null; }

  /* 落点爆炸 */
  function explode(el, x, y, r, dmg, big) {
    if (el === 'fire') {
      inRadius(x, y, r, e => { hit(e, dmg, 'fire'); e.burn = 3; e.burnDps = dmg * 0.12; });
      ring(x, y, r * 0.2, r, 0.35, '#ff8a3a', 4, true); ring(x, y, r * 0.3, r * 1.05, 0.3, '#ffd35a', 3);
      burst(x, y, big ? 22 : 10, '#ff9a3a', 160, 5, 0.45); burst(x, y, big ? 10 : 4, '#3a2a22', 90, 6, 0.6);
      if (big) S.shake = Math.max(S.shake, 0.2);
    } else if (el === 'ice') {
      inRadius(x, y, r, e => { hit(e, dmg, 'ice'); e.slow = 2.2; });
      ring(x, y, 6, r, 0.3, '#bfeaff', 3); burst(x, y, 9, '#d9f4ff', 130, 3.5, 0.4);
    } else if (el === 'poison') {
      pool(x, y, r, 4, dmg);
      burst(x, y, 8, '#8be84f', 100, 4, 0.4);
    } else if (el === 'arrow') {
      inRadius(x, y, r, e => hit(e, dmg, 'arrow', 0.15));
      burst(x, y, 3, '#ffe9a8', 70, 2.5, 0.25);
    }
  }
  function pool(x, y, r, life, dmg) {
    const blobs = [];
    for (let i = 0; i < 7; i++) { const a = rand() * TAU, d = rand() * 0.55; blobs.push([Math.cos(a) * d, Math.sin(a) * d, 0.45 + rand() * 0.3]); }
    S.zones.push({ k: 'pool', x, y, r, life, max: life, tick: 0.1, dmg, blobs });
  }
  function chain(x, y, first, dmg, n, stun) {
    const used = new Set(); let cur = first, px = x, py = y;
    for (let i = 0; i < n && cur; i++) {
      bolt(px, py, cur.x, cur.y - 6);
      used.add(cur); px = cur.x; py = cur.y - 6;
      if (stun) cur.frozen = Math.max(cur.frozen, stun);
      hit(cur, dmg, 'thunder'); burst(px, py, 3, '#d9ccff', 90, 2.5, 0.25);
      dmg *= 0.8;
      let nx = null, nd = 140 * 140;
      for (const e of S.live) { if (e.dead || used.has(e)) continue; const dx = e.x - px, dy = e.y - py, d2 = dx * dx + dy * dy; if (d2 < nd) { nd = d2; nx = e; } }
      cur = nx;
    }
  }

  /* ---------------- 武将普攻 ---------------- */
  function attack(h) {
    const el = h.def.el, dmg = h.atk * S.buffs.atk, hx = h.x, hy = h.y - 22;
    const tg = (el === 'arrow' || el === 'blade' || el === 'thunder') ? frontmost() : densest(60);
    if (!tg) return false;
    switch (el) {
      case 'arrow':
        S.shots.push({ k: 'arrow', x: hx, y: hy, px: hx, py: hy, tg, spd: 780, dmg }); break;
      case 'blade': {
        const a = Math.atan2(tg.y - hy, tg.x - hx);
        S.shots.push({ k: 'blade', x: hx, y: hy, vx: Math.cos(a) * 430, vy: Math.sin(a) * 430, w: 50, dmg, hit: new Set(), life: 2.2 }); break;
      }
      case 'fire':
        S.shots.push({ k: 'lob', el, x: hx, y: hy, px: hx, py: hy, x0: hx, y0: hy, tx: tg.x, ty: tg.y, t: 0, dur: 0.5, arc: 70, r: 58, dmg }); break;
      case 'ice':
        S.shots.push({ k: 'lob', el, x: hx, y: hy, px: hx, py: hy, x0: hx, y0: hy, tx: tg.x, ty: tg.y, t: 0, dur: 0.28, arc: 0, r: 46, dmg }); break;
      case 'poison':
        S.shots.push({ k: 'lob', el, x: hx, y: hy, px: hx, py: hy, x0: hx, y0: hy, tx: tg.x, ty: tg.y, t: 0, dur: 0.6, arc: 90, r: 54, dmg }); break;
      case 'thunder':
        chain(hx, hy - 10, tg, dmg, 4); break;
      case 'wind':
        S.zones.push({ k: 'tornado', x: Math.max(50, Math.min(W - 50, tg.x)), y: Math.min(WY - 24, tg.y + 70), vy: -85, r: 38, life: 3.2, max: 3.2, tick: 0, dmg, push: 12 }); break;
    }
    return true;
  }

  /* ---------------- 大招 ---------------- */
  function castUlt(h) {
    if (!S || S.over || S.choosing || h.rage < 100) return false;
    if (!S.live.some(e => !e.dead)) return false;
    h.rage = 0; h.anim = 1.6;
    const a = h.atk * S.buffs.atk * S.buffs.ult, q = QUALITIES[h.def.q];
    text(h.x, h.y - 58, '【' + h.def.ult + '】', q.color, 21, 1.5, true);
    ring(h.x, h.y, 10, 90, 0.5, q.color, 4);
    switch (h.def.el) {
      case 'arrow':
        for (let i = 0; i < 40; i++) later(i * 0.035, () => {
          const t = randLive(); if (!t) return;
          const tx = t.x + (rand() - 0.5) * 24, ty = t.y;
          S.shots.push({ k: 'lob', el: 'arrow', x: tx - 50, y: ty - 320, px: tx - 50, py: ty - 320, x0: tx - 50, y0: ty - 320, tx, ty, t: 0, dur: 0.26, arc: 0, r: 26, dmg: a * 1.3 });
        });
        break;
      case 'blade': {
        const t = densest(90), base = Math.atan2(t.y - h.y, t.x - h.x);
        [-0.22, 0, 0.22].forEach((o, i) => later(i * 0.16, () => {
          S.shots.push({ k: 'blade', x: h.x, y: h.y - 22, vx: Math.cos(base + o) * 520, vy: Math.sin(base + o) * 520, w: 150, dmg: a * 4, hit: new Set(), life: 2.4, big: true });
        }));
        S.shake = 0.25; break;
      }
      case 'fire':
        for (let i = 0; i < 6; i++) later(i * 0.18, () => {
          const t = densest(90); if (!t) return;
          const tx = t.x + (rand() - 0.5) * 40, ty = t.y + (rand() - 0.5) * 30, sx = tx + 120 + rand() * 60;
          S.shots.push({ k: 'lob', el: 'fire', big: true, x: sx, y: -40, px: sx, py: -40, x0: sx, y0: -40, tx, ty, t: 0, dur: 0.42, arc: 0, r: 96, dmg: a * 3.5 });
        });
        break;
      case 'ice':
        S.flash = { color: '160,225,255', a: 0.45, t: 0.6, max: 0.6 };
        ring(W / 2, WY - 40, 40, 620, 0.6, '#cfefff', 8);
        for (const e of S.live) { if (e.dead) continue; e.frozen = Math.max(e.frozen, e.def.id === 'boss' ? 1.5 : 3); hit(e, a * 2.5, 'ice'); burst(e.x, e.y, 3, '#d9f4ff', 80, 3, 0.4); }
        break;
      case 'thunder': {
        const l = S.live.filter(e => !e.dead).sort(() => rand() - 0.5).slice(0, 14);
        l.forEach((e, i) => later(i * 0.06, () => {
          if (e.dead) return;
          bolt(e.x + (rand() - 0.5) * 80, -10, e.x, e.y - 6, 2);
          e.frozen = Math.max(e.frozen, 1);
          hit(e, a * 4.5, 'thunder'); ring(e.x, e.y, 6, 44, 0.25, '#c4b0ff', 3); burst(e.x, e.y, 6, '#efe8ff', 150, 3, 0.3);
        }));
        S.flash = { color: '200,180,255', a: 0.3, t: 0.3, max: 0.3 }; S.shake = 0.3; break;
      }
      case 'poison': {
        const t = densest(130);
        pool(t.x, t.y, 135, 6, a * 1.1); burst(t.x, t.y, 26, '#8be84f', 220, 5, 0.6); break;
      }
      case 'wind': {
        const t = densest(110);
        S.zones.push({ k: 'tornado', x: Math.max(90, Math.min(W - 90, t.x)), y: WY - 30, vy: -48, r: 92, life: 5.5, max: 5.5, tick: 0, dmg: a * 1.2, push: 20, big: true }); break;
      }
    }
    return true;
  }
  /* 手动放大招：返回 'ok' / 'rage'（怒气未满）/ 'none'（射程内没有敌人） */
  function ult(slot) {
    const h = S && S.heroes.find(x => x.slot === slot);
    if (!h || S.over || S.choosing) return 'none';
    if (h.rage < 100) return 'rage';
    return castUlt(h) ? 'ok' : 'none';
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
    for (let i = S.timers.length - 1; i >= 0; i--) { const tm = S.timers[i]; if ((tm.t -= dt) <= 0) { S.timers.splice(i, 1); tm.fn(); } }

    // 武将
    for (const h of S.heroes) {
      h.anim = Math.max(0, h.anim - dt * 4);
      h.rage = Math.min(100, h.rage + dt * 2.5 * S.buffs.rage);            // 怒气：随时间 + 每次出手（按出手间隔折算，快慢武将充能速度一致）
      h.t -= dt * S.buffs.spd;
      if (h.t <= 0) {
        if (attack(h)) { h.t = h.cd; h.anim = Math.max(h.anim, 1); h.rage = Math.min(100, h.rage + 2.5 * h.cd * S.buffs.rage); }
        else h.t = 0.12;
      }
      if (h.rage >= 100 && Save.data.auto && (S.live.length >= 3 || S.live.some(e => e.def.coin >= 8))) castUlt(h);
    }

    // 敌人
    for (const e of S.enemies) {
      if (e.dead) continue;
      if (e.flash > 0) e.flash -= dt;
      if (e.burn > 0) { e.burn -= dt; if ((e.burnT -= dt) <= 0) { e.burnT = 0.5; hit(e, e.burnDps, 'fire'); if (e.dead) continue; } }
      if (e.frozen > 0) { e.frozen -= dt; continue; }
      const sp = e.spd * (e.slow > 0 ? 0.5 : 1);
      if (e.slow > 0) e.slow -= dt;
      if (e.y < e.stopY) {
        e.y += sp * dt; e.walk += dt * sp * 0.22;
        e.x = Math.max(48, Math.min(W - 48, e.x + Math.sin(S.t * 1.3 + e.ph) * 7 * dt));
      } else if ((e.acd -= dt) <= 0) {
        e.acd = e.def.id === 'boss' ? 1.4 : 1;
        S.wall -= e.atk; S.wallFlash = 0.15; S.shake = Math.max(S.shake, e.def.id === 'boss' ? 0.25 : 0.06);
        if (e.def.range) S.shots.push({ k: 'earrow', x: e.x, y: e.y - 6, x0: e.x, y0: e.y - 6, tx: e.x + (rand() - 0.5) * 30, ty: WY - 4, t: 0, dur: 0.22 });
        else burst(e.x, WY - 12, 3, '#b9bcc6', 70, 3, 0.3);
      }
    }

    // 飞行物
    for (let i = S.shots.length - 1; i >= 0; i--) {
      const s = S.shots[i]; let done = false;
      if (s.k === 'arrow') {
        if (s.tg.dead) { s.tg = frontmost(); if (!s.tg) { S.shots.splice(i, 1); continue; } }
        const dx = s.tg.x - s.x, dy = s.tg.y - 4 - s.y, d = Math.hypot(dx, dy), mv = s.spd * dt;
        s.px = s.x; s.py = s.y;
        if (d <= mv + 8) { hit(s.tg, s.dmg, 'arrow', 0.15); burst(s.tg.x, s.tg.y - 4, 2, '#ffe9a8', 60, 2, 0.2); done = true; }
        else { s.x += dx / d * mv; s.y += dy / d * mv; }
      } else if (s.k === 'blade') {
        s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
        for (const e of S.enemies) {
          if (e.dead || s.hit.has(e)) continue;
          const dx = e.x - s.x, dy = e.y - s.y, rr = s.w / 2 + e.def.r;
          if (dx * dx + dy * dy < rr * rr) { s.hit.add(e); hit(e, s.dmg, 'blade'); burst(e.x, e.y, 2, '#e6dcff', 80, 3, 0.25); }
        }
        if (rand() < 0.6) part(s.x + (rand() - 0.5) * s.w * 0.8, s.y, 0, 20, 0.3, s.big ? '#cdb6ff' : '#e6dcff', s.big ? 4 : 2.5);
        done = s.life <= 0 || s.y < -80 || s.x < -90 || s.x > W + 90;
      } else if (s.k === 'lob') {
        s.t += dt; const p = Math.min(1, s.t / s.dur);
        s.px = s.x; s.py = s.y;
        s.x = s.x0 + (s.tx - s.x0) * p; s.y = s.y0 + (s.ty - s.y0) * p - Math.sin(p * Math.PI) * s.arc;
        if (s.el === 'fire') part(s.x, s.y, (rand() - 0.5) * 30, (rand() - 0.5) * 30, 0.3, rand() < 0.5 ? '#ff8a3a' : '#ffd35a', s.big ? 7 : 4);
        if (s.el === 'ice' && rand() < 0.5) part(s.x, s.y, 0, 0, 0.25, '#cfefff', 3);
        if (p >= 1) { explode(s.el, s.tx, s.ty, s.r, s.dmg, s.big); done = true; }
      } else if (s.k === 'earrow') {
        s.t += dt; const p = Math.min(1, s.t / s.dur);
        s.x = s.x0 + (s.tx - s.x0) * p; s.y = s.y0 + (s.ty - s.y0) * p;
        done = p >= 1;
      }
      if (done) S.shots.splice(i, 1);
    }

    // 区域
    for (let i = S.zones.length - 1; i >= 0; i--) {
      const z = S.zones[i];
      z.life -= dt; z.tick -= dt;
      if (z.k === 'pool') {
        if (z.tick <= 0) { z.tick = 0.5; inRadius(z.x, z.y, z.r, e => hit(e, z.dmg, 'poison')); }
        if (rand() < 0.25) part(z.x + (rand() - 0.5) * z.r * 1.4, z.y + (rand() - 0.5) * z.r * 0.8, 0, -24, 0.5, '#b6ff6a', 2.5);
      } else {
        z.y += z.vy * dt;
        if (z.tick <= 0) {
          z.tick = 0.25;
          inRadius(z.x, z.y, z.r, e => { hit(e, z.dmg, 'wind'); if (!e.dead && e.y > RANGE_Y + 12) e.y = Math.max(RANGE_Y + 10, e.y - (e.def.id === 'boss' ? z.push * 0.25 : z.push)); });
        }
        if (rand() < 0.7) { const a = rand() * TAU; part(z.x + Math.cos(a) * z.r * 0.8, z.y + Math.sin(a) * z.r * 0.3, -Math.sin(a) * 90, -50, 0.4, '#d6fff1', 2.5); }
        if (z.y < -z.r * 2) z.life = 0;
      }
      if (z.life <= 0) S.zones.splice(i, 1);
    }

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
  function updateFx(dt) {
    for (let i = S.parts.length - 1; i >= 0; i--) { const p = S.parts[i]; p.life -= dt; if (p.life <= 0) { S.parts.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.vx *= 0.96; p.vy *= 0.96; }
    for (let i = S.texts.length - 1; i >= 0; i--) { const t = S.texts[i]; t.life -= dt; t.y -= 34 * dt; if (t.life <= 0) S.texts.splice(i, 1); }
    for (let i = S.bolts.length - 1; i >= 0; i--) if ((S.bolts[i].life -= dt) <= 0) S.bolts.splice(i, 1);
    for (let i = S.rings.length - 1; i >= 0; i--) if ((S.rings[i].life -= dt) <= 0) S.rings.splice(i, 1);
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
  function drawShot(s) {
    if (s.k === 'arrow' || (s.k === 'lob' && s.el === 'arrow') || s.k === 'earrow') {
      let ax, ay;
      if (s.k === 'arrow') { ax = s.x - s.px; ay = s.y - s.py; } else { ax = s.tx - s.x0; ay = s.ty - s.y0; }
      const d = Math.hypot(ax, ay) || 1, L = s.k === 'earrow' ? 10 : 16; ax /= d; ay /= d;
      c.strokeStyle = s.k === 'earrow' ? '#2a1d14' : '#fff1c2'; c.lineWidth = s.k === 'earrow' ? 1.6 : 2.2; c.lineCap = 'round';
      c.beginPath(); c.moveTo(s.x - ax * L, s.y - ay * L); c.lineTo(s.x, s.y); c.stroke();
      if (s.k !== 'earrow') { c.fillStyle = '#ffffff'; Art.circ(c, s.x, s.y, 2.2); }
    } else if (s.k === 'blade') {
      const R = s.w / 2;
      c.save(); c.translate(s.x, s.y); c.rotate(Math.atan2(s.vy, s.vx) + Math.PI / 2);
      const g = c.createLinearGradient(0, -R, 0, R * 2.4);
      g.addColorStop(0, s.big ? 'rgba(185,130,255,.55)' : 'rgba(200,180,255,.4)'); g.addColorStop(1, 'rgba(160,110,255,0)');
      c.fillStyle = g; c.fillRect(-R * 0.8, -R * 0.2, R * 1.6, R * 2.6);
      const bg = c.createLinearGradient(0, -R, 0, -R * 0.3);
      bg.addColorStop(0, 'rgba(255,255,255,.98)'); bg.addColorStop(1, s.big ? 'rgba(205,170,255,.75)' : 'rgba(225,212,255,.8)');
      c.fillStyle = bg;
      c.beginPath(); c.arc(0, 0, R, Math.PI * 1.08, Math.PI * 1.92); c.arc(0, R * 0.3, R * 0.98, Math.PI * 1.86, Math.PI * 1.14, true); c.closePath(); c.fill();
      c.strokeStyle = s.big ? 'rgba(190,130,255,.9)' : 'rgba(200,180,255,.8)'; c.lineWidth = s.big ? 4 : 2;
      c.beginPath(); c.arc(0, 0, R + 2, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
      c.restore();
    } else if (s.k === 'lob') {
      if (s.el === 'fire') {
        const r = s.big ? 15 : 8;
        c.globalCompositeOperation = 'lighter';
        const g = c.createRadialGradient(s.x, s.y, 1, s.x, s.y, r * 2); g.addColorStop(0, 'rgba(255,220,120,.95)'); g.addColorStop(0.4, 'rgba(255,120,40,.7)'); g.addColorStop(1, 'rgba(255,80,20,0)');
        c.fillStyle = g; Art.circ(c, s.x, s.y, r * 2); c.globalCompositeOperation = 'source-over';
        c.fillStyle = '#fff3c4'; Art.circ(c, s.x, s.y, r * 0.5);
      } else if (s.el === 'ice') {
        const a = Math.atan2(s.ty - s.y0, s.tx - s.x0);
        c.save(); c.translate(s.x, s.y); c.rotate(a);
        c.fillStyle = '#8fdcff'; c.beginPath(); c.moveTo(13, 0); c.lineTo(-9, -5); c.lineTo(-5, 0); c.lineTo(-9, 5); c.closePath(); c.fill();
        c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(13, 0); c.lineTo(-4, -1.8); c.lineTo(-4, 1.8); c.closePath(); c.fill();
        c.restore();
      } else if (s.el === 'poison') {
        c.fillStyle = '#4c8a1e'; Art.circ(c, s.x, s.y, 7); c.fillStyle = '#b6ff6a'; Art.circ(c, s.x - 2, s.y - 2, 3);
      }
    }
  }
  function drawZone(z, layer) {
    if (z.k === 'pool' && layer === 0) {
      const f = Math.min(1, z.life / 0.6) * Math.min(1, (z.max - z.life) / 0.25 + 0.15);
      c.globalAlpha = 0.42 * f; c.fillStyle = '#2f9a1a';
      for (const b of z.blobs) Art.ell(c, z.x + b[0] * z.r, z.y + b[1] * z.r * 0.62, b[2] * z.r, b[2] * z.r * 0.62);
      c.globalAlpha = 0.5 * f; c.fillStyle = '#8dea4a';
      for (const b of z.blobs) Art.ell(c, z.x + b[0] * z.r, z.y + b[1] * z.r * 0.62, b[2] * z.r * 0.55, b[2] * z.r * 0.34);
      c.globalAlpha = 0.7 * f; c.fillStyle = '#d8ff9a';
      for (let i = 0; i < 5; i++) { const b = z.blobs[i], pr = (S.t * 0.9 + i * 0.37) % 1; Art.circ(c, z.x + b[0] * z.r * 1.3, z.y + b[1] * z.r * 0.8 - pr * 10, (1 - pr) * 4 * (z.r / 54) + 0.5); }
      c.globalAlpha = 1;
    } else if (z.k === 'tornado' && layer === 1) {
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
    });
  }

  function render() {
    c.setTransform(2, 0, 0, 2, 0, 0);
    c.save();
    if (S.shake > 0) c.translate((rand() - 0.5) * 9 * Math.min(1, S.shake * 4), (rand() - 0.5) * 9 * Math.min(1, S.shake * 4));
    c.drawImage(Art.background(), 0, 0, W, H);
    if (S.wallFlash > 0) { c.fillStyle = 'rgba(255,60,40,' + (S.wallFlash * 2) + ')'; c.fillRect(0, WY - 14, W, 32); }
    for (const z of S.zones) drawZone(z, 0);
    for (const d of S.drops) {
      if (d.k === 'coin') drawCoin(d.x, d.y, 6);
      else { c.fillStyle = 'rgba(0,0,0,.3)'; Art.ell(c, d.x, d.y + 6, 8, 3); c.fillStyle = '#fbf3e2'; c.beginPath(); c.arc(d.x, d.y + 3, 8.5, Math.PI, 0); c.closePath(); c.fill(); c.fillStyle = '#e8c9a0'; Art.circ(c, d.x, d.y - 3, 1.6); }
    }
    const es = S.enemies.slice().sort((a, b) => a.y - b.y);
    for (const e of es) Art.enemy(c, e, S.t);
    drawHeroes(S.heroes, S.t);
    for (const s of S.shots) drawShot(s);
    for (const z of S.zones) drawZone(z, 1);

    // 光环、粒子、闪电
    for (const r of S.rings) {
      const p = 1 - r.life / r.max, rad = r.r0 + (r.r1 - r.r0) * p;
      c.globalAlpha = (1 - p) * 0.9;
      if (r.fill) { c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(r.x, r.y, 1, r.x, r.y, rad); g.addColorStop(0, '#fff2b0'); g.addColorStop(0.5, r.color); g.addColorStop(1, 'rgba(255,90,20,0)'); c.fillStyle = g; Art.circ(c, r.x, r.y, rad); c.globalCompositeOperation = 'source-over'; }
      else { c.strokeStyle = r.color; c.lineWidth = r.w * (1 - p * 0.6); c.beginPath(); c.ellipse(r.x, r.y, rad, rad * 0.7, 0, 0, TAU); c.stroke(); }
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
    if (S.flash) { c.fillStyle = 'rgba(' + S.flash.color + ',' + (S.flash.a * S.flash.t / S.flash.max) + ')'; c.fillRect(0, 0, W, H); }

    // —— 顶部信息 ——
    const tg = c.createLinearGradient(0, 0, 0, 120); tg.addColorStop(0, 'rgba(10,6,4,.75)'); tg.addColorStop(1, 'rgba(10,6,4,0)');
    c.fillStyle = tg; c.fillRect(0, 0, W, 120);
    outlined('第' + S.ch.index + '章 ' + S.ch.name + ' · 第' + S.ch.sub + '关', W / 2, 40, 21, '#ffd76a');
    const bx = 130, bw = 280;
    c.fillStyle = 'rgba(0,0,0,.6)'; Art.rr(c, bx - 2, 51, bw + 4, 20, 10); c.fill();
    const wp = S.over && S.win ? 1 : Math.min(1, (S.wave - 1 + (S.waveSize ? S.spawned / S.waveSize : 1)) / CFG.WAVES);
    if (wp > 0.02) { const g2 = c.createLinearGradient(bx, 0, bx + bw, 0); g2.addColorStop(0, '#e8c53a'); g2.addColorStop(1, '#7ed957'); c.fillStyle = g2; Art.rr(c, bx, 53, bw * wp, 16, 8); c.fill(); }
    outlined(S.wave + '/' + CFG.WAVES + ' 波', W / 2, 66, 13, '#ffffff', 'center', 2.6);
    c.fillStyle = 'rgba(0,0,0,.6)'; Art.rr(c, bx - 2, 75, bw + 4, 15, 7); c.fill();
    const hp = Math.max(0, S.wall / S.wallMax);
    if (hp > 0.02) { c.fillStyle = hp > 0.5 ? '#e0483a' : hp > 0.25 ? '#e8802a' : '#ff2a2a'; Art.rr(c, bx, 77, bw * hp, 11, 5.5); c.fill(); }
    outlined('城防 ' + Math.ceil(Math.max(0, S.wall)) + '/' + S.wallMax, W / 2, 87, 11, '#ffffff', 'center', 2.4);
    drawCoin(W - 92, 34, 9); outlined(String(Math.round(S.coins)), W - 78, 40, 17, '#ffe9a8', 'left');

    if (S.banner) {
      const p = S.banner.t / S.banner.max, a = S.banner.max > 50 ? 1 : Math.min(1, p * 3, (1 - p) * 6);
      c.globalAlpha = a;
      c.fillStyle = 'rgba(10,6,4,.6)'; c.fillRect(0, 300, W, 64);
      c.fillStyle = '#d8b04a'; c.fillRect(0, 300, W, 2); c.fillRect(0, 362, W, 2);
      outlined(S.banner.text, W / 2, 343, 30, S.over && !S.win ? '#ff6a5a' : '#ffe08a', 'center', 5);
      c.globalAlpha = 1;
    }
  }

  /* 主城待机画面：城墙上站着当前阵容 */
  function renderIdle() {
    c.setTransform(2, 0, 0, 2, 0, 0);
    c.drawImage(Art.background(), 0, 0, W, H);
    const list = [];
    Save.data.team.forEach((id, i) => { if (id) list.push({ def: HERO_MAP[id], x: SLOTS[i][0], y: SLOTS[i][1], anim: 0, rage: 0 }); });
    drawHeroes(list, idleT);
  }

  function frame(dt) {
    dt = Math.min(dt, 0.05); idleT += dt;
    if (!S) return renderIdle();
    if (!S.paused && !S.choosing) {
      for (let i = 0, n = Save.data.speed || 1; i < n && S && !S.choosing; i++) { if (!S.over) update(dt); updateFx(dt); }
    }
    render(); UI.hud(S);
  }

  return { init, start, stop, frame, ult, get state() { return S; }, SLOTS };
})();
