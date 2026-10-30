// 布衣三国 · 战斗特效（只负责绘制）
// 发光效果用预先画好的径向渐变贴图叠加（'lighter' 混合），比 shadowBlur 快得多，同屏大量特效也不卡。
// 颜色统一用 'r,g,b' 字符串。
window.FX = (() => {
  const TAU = Math.PI * 2;
  const glowCache = new Map();
  // 叠加发光的整体亮度（0–1）：后期满屏特效时由游戏调低，免得叠成一片白光（见 game.js 的 fxK）
  let K = 1;
  const setK = v => { K = v; };

  function glowTex(rgb) {
    let c = glowCache.get(rgb);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${rgb},1)`);
    gr.addColorStop(0.25, `rgba(${rgb},0.7)`);
    gr.addColorStop(0.6, `rgba(${rgb},0.18)`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    glowCache.set(rgb, c);
    return c;
  }

  // 柔光圆（需在 'lighter' 混合下调用效果最好）
  function glow(ctx, x, y, r, rgb, a) {
    if (a <= 0 || r <= 0) return;
    ctx.globalAlpha = Math.min(1, a * K);
    ctx.drawImage(glowTex(rgb), x - r, y - r, r * 2, r * 2);
  }

  // 四角星闪光
  function star(ctx, x, y, r, rgb, a, rot = 0) {
    if (a <= 0) return;
    ctx.globalAlpha = Math.min(1, a);
    ctx.fillStyle = `rgb(${rgb})`;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a1 = i * Math.PI / 2, a2 = a1 + Math.PI / 4;
      ctx.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
      ctx.lineTo(Math.cos(a2) * r * 0.16, Math.sin(a2) * r * 0.16);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
    glow(ctx, x, y, r * 0.9, rgb, a * 0.6);
  }

  // 刀光：头粗尾细的月牙，前 35% 时间完成挥出，之后逐渐淡出
  function slash(ctx, f) {
    const t = f.life / f.max, prog = 1 - t;
    const sweep = Math.min(1, prog / 0.35);
    const a0 = f.a - f.half, span = 2 * f.half * sweep;
    const R = f.range, W = Math.max(8, R * 0.2), N = 22;
    const alpha = Math.min(1, t * 1.6);
    ctx.globalAlpha = alpha * 0.10; // 地面上淡淡的攻击范围
    ctx.fillStyle = `rgb(${f.rgb})`;
    ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.arc(f.x, f.y, R, a0, a0 + span); ctx.closePath(); ctx.fill();
    const outer = [], inner = [];
    for (let i = 0; i <= N; i++) {
      const k = i / N, th = a0 + span * k;
      const w = W * Math.pow(k, 0.65) * (0.35 + 0.65 * t);
      outer.push([f.x + Math.cos(th) * R, f.y + Math.sin(th) * R]);
      inner.push([f.x + Math.cos(th) * (R - w), f.y + Math.sin(th) * (R - w)]);
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha * 0.62;
    ctx.fillStyle = `rgb(${f.rgb})`;
    ctx.beginPath();
    outer.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    for (let i = N; i >= 0; i--) ctx.lineTo(inner[i][0], inner[i][1]);
    ctx.closePath(); ctx.fill();
    // 亮白刀芯
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = 'rgba(255,255,245,0.9)';
    ctx.lineWidth = Math.max(1.5, W * 0.18 * t);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = Math.floor(N * 0.3); i <= N; i++) {
      const [x, y] = outer[i];
      i === Math.floor(N * 0.3) ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    const [hx, hy] = outer[N];
    glow(ctx, hx, hy, W * 1.4, f.rgb, alpha * 0.7);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  // 冲击环：气浪由内向外推开——柔和的气浪前沿（渐变，不是实线）+ 一道细亮边 + 地面一圈暗影
  function shock(ctx, f) {
    const t = f.life / f.max, prog = 1 - t;
    const r = f.r * (0.2 + 0.8 * Math.pow(prog, 0.5)), band = Math.max(10, f.r * 0.22 * (0.4 + 0.6 * t));
    ctx.globalAlpha = t * 0.18; // 被气浪压低的地面
    ctx.fillStyle = 'rgb(10,8,5)';
    ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); ctx.arc(f.x, f.y, Math.max(0, r - band * 1.6), 0, TAU, true); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(f.x, f.y, Math.max(0, r - band * 2), f.x, f.y, r + band * 0.3);
    g.addColorStop(0, `rgba(${f.rgb},0)`); g.addColorStop(0.75, `rgba(${f.rgb},0.55)`); g.addColorStop(0.93, 'rgba(255,255,245,0.5)'); g.addColorStop(1, `rgba(${f.rgb},0)`);
    ctx.globalAlpha = t * 0.85;
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(f.x, f.y, r + band * 0.3, 0, TAU); ctx.fill();
    ctx.globalAlpha = t * 0.7;
    ctx.strokeStyle = 'rgba(255,255,245,0.9)';
    ctx.lineWidth = 1 + 1.6 * t;
    ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  // 粒子：spark 火花条 / ember 发光点 / glint 闪光 / smoke 墨烟 / dust 扬尘 / debris 碎屑
  const ADD = { spark: 1, ember: 1, glint: 1 };
  function particles(ctx, list, additive) {
    if (additive) ctx.globalCompositeOperation = 'lighter';
    for (const q of list) {
      if (!!ADD[q.type] !== additive) continue;
      const t = Math.max(0, q.life / q.max);
      switch (q.type) {
        case 'spark': {
          ctx.globalAlpha = t * K;
          ctx.strokeStyle = `rgb(${q.rgb})`;
          ctx.lineWidth = q.size * (0.4 + 0.6 * t);
          ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(q.x - q.vx * 0.035, q.y - q.vy * 0.035); ctx.lineTo(q.x, q.y); ctx.stroke();
          break;
        }
        case 'ember': glow(ctx, q.x, q.y, q.size * (0.5 + 0.5 * t), q.rgb, t); break;
        case 'glint': star(ctx, q.x, q.y, q.size * (0.6 + 0.8 * (1 - t)), q.rgb, t, q.rot || 0); break;
        case 'petal': petal(ctx, q.x + Math.sin(q.life * 6 + (q.seed || 0)) * 5, q.y, q.size * (0.75 + 0.25 * Math.cos(q.life * 9 + (q.seed || 0))), q.rot || 0, q.rgb, Math.min(1, t * 1.6)); break;
        case 'shard': shard(ctx, q.x, q.y, q.size, q.rot || 0, Math.min(1, t * 1.5)); break;
        case 'snow': snowflake(ctx, q.x, q.y, q.size, q.rot || 0, t); break;
        case 'page': page(ctx, q.x, q.y, q.size, q.rot || 0, Math.min(1, t * 1.5), Math.cos(q.life * 8 + (q.seed || 0))); break;
        case 'fly': butterfly(ctx, q.x + Math.sin(q.life * 5 + (q.seed || 0)) * 6, q.y, q.size, q.rot || 0, q.life * 4 + (q.seed || 0), q.rgb, Math.min(1, t * 1.6)); break;
        case 'smoke': case 'dust':
          ctx.globalAlpha = t * (q.type === 'dust' ? 0.35 : 0.45);
          ctx.fillStyle = `rgb(${q.rgb})`;
          ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, TAU); ctx.fill();
          break;
        default: // debris
          ctx.globalAlpha = t;
          ctx.fillStyle = q.color || `rgb(${q.rgb})`;
          ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot || 0);
          ctx.fillRect(-q.size / 2, -q.size / 2, q.size, q.size * 0.7);
          ctx.restore();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  // 地面裂纹（画在角色下面）
  function crack(ctx, f) {
    const t = Math.min(1, f.life / (f.max * 0.6));
    ctx.globalAlpha = t * 0.55;
    ctx.strokeStyle = '#0e0b07';
    ctx.lineCap = 'round';
    for (const line of f.lines) {
      ctx.lineWidth = line.w;
      ctx.beginPath();
      line.pts.forEach(([x, y], i) => i ? ctx.lineTo(f.x + x, f.y + y) : ctx.moveTo(f.x + x, f.y + y));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  function makeCrack(R) {
    const lines = [], n = 7 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      let a = (i / n) * TAU + Math.random() * 0.5, r = R * 0.12;
      const pts = [[Math.cos(a) * r, Math.sin(a) * r]];
      const len = R * (0.45 + Math.random() * 0.45);
      while (r < len) { r += 8 + Math.random() * 10; a += (Math.random() - 0.5) * 0.5; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
      lines.push({ pts, w: 1.2 + Math.random() * 1.6 });
    }
    return lines;
  }

  // 龙形气劲：pts 从龙头到龙尾。身体是由粗到细的发光带（外层光晕 + 主体 + 白色龙芯），
  // 沿脊背有一节节闪动的鳞光和背鳍；龙头有美术图就画图，没有就画发光的龙首轮廓与龙须。
  function dragon(ctx, pts, o) {
    const n = pts.length;
    if (n < 3) return;
    const a = o.a === undefined ? 1 : o.a, W = o.w, rgb = o.rgb, t = o.t || 0;
    const L = [], R = [];
    for (let i = 0; i < n; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(n - 1, i + 1)];
      const dx = p1[0] - p0[0], dy = p1[1] - p0[1], d = Math.hypot(dx, dy) || 1;
      const k = i / (n - 1), w = W * (k < 0.12 ? 0.7 + k * 2.5 : Math.pow(1 - k, 0.75)) * 0.5;
      L.push([pts[i][0] - dy / d * w, pts[i][1] + dx / d * w]);
      R.push([pts[i][0] + dy / d * w, pts[i][1] - dx / d * w]);
    }
    const band = s => { // 以龙脊为中线、按比例 s 缩放的身体轮廓
      ctx.beginPath();
      for (let i = 0; i < n; i++) ctx.lineTo(pts[i][0] + (L[i][0] - pts[i][0]) * s, pts[i][1] + (L[i][1] - pts[i][1]) * s);
      for (let i = n - 1; i >= 0; i--) ctx.lineTo(pts[i][0] + (R[i][0] - pts[i][0]) * s, pts[i][1] + (R[i][1] - pts[i][1]) * s);
      ctx.closePath(); ctx.fill();
    };
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // 有美术龙首时，身体收窄、更虚，像龙首后面拖出的一缕灵气
    const art = !!o.head, bw = art ? 0.6 : 1;
    ctx.fillStyle = `rgb(${rgb})`;
    ctx.globalAlpha = a * (art ? 0.1 : 0.16); band(2.2 * bw);
    ctx.globalAlpha = a * (art ? 0.22 : 0.38); band(bw);
    ctx.fillStyle = `rgb(${o.core || '255,255,255'})`;
    ctx.globalAlpha = a * (art ? 0.45 : 0.75); band(0.28 * bw);
    // 背鳍：沿脊背一侧的一排细刺，随身体摆动（有美术龙首时省略）
    ctx.strokeStyle = `rgb(${o.core || '255,255,255'})`; ctx.lineCap = 'round';
    for (let i = 2; i < n - 2 && !art; i += 2) {
      const k = i / (n - 1), [lx, ly] = L[i], [px, py] = pts[i], [bx, by] = pts[i + 1];
      const fl = 0.55 + 0.45 * Math.sin(t * 9 - i);
      ctx.globalAlpha = a * 0.45 * (1 - k);
      ctx.lineWidth = Math.max(1, W * 0.07 * (1 - k));
      ctx.beginPath(); ctx.moveTo(lx, ly);
      ctx.lineTo(lx + (lx - px) * 0.9 * fl + (bx - px) * 0.8, ly + (ly - py) * 0.9 * fl + (by - py) * 0.8); ctx.stroke();
    }
    // 鳞光：脊背上一闪一闪的亮点
    for (let i = 1; i < n; i += 2) {
      const k = i / (n - 1), fl = 0.5 + 0.5 * Math.sin(t * 14 + i * 1.7);
      glow(ctx, pts[i][0], pts[i][1], W * (0.55 - 0.4 * k), o.core || '255,255,255', a * 0.35 * fl * (1 - k));
    }
    // 龙头
    const [hx, hy] = pts[0], ang = Math.atan2(pts[0][1] - pts[2][1], pts[0][0] - pts[2][0]);
    glow(ctx, hx, hy, W * (art ? 1.3 : 2.2), rgb, a * (art ? 0.35 : 0.65));
    if (o.head) { // 美术龙首：图里龙头在右端、鬃毛向左拖，龙鼻对准龙头位置
      const s = W * (o.headScale || 6), ih = s * o.head.naturalHeight / o.head.naturalWidth;
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; // 叠加着画：图里暗色的光晕不会变成黑框，龙身自己发光
      ctx.translate(hx, hy); ctx.rotate(ang); if (Math.cos(ang) < 0) ctx.scale(1, -1);
      ctx.drawImage(o.head, -s * 0.95, -ih * 0.6, s, ih);
    } else {
      ctx.translate(hx, hy); ctx.rotate(ang);
      const hl = W * 1.5, hw = W * 0.62;
      ctx.globalAlpha = a * 0.55; ctx.fillStyle = `rgb(${rgb})`;
      ctx.beginPath(); ctx.moveTo(hl * 0.55, 0); ctx.quadraticCurveTo(hl * 0.2, -hw, -hl * 0.45, -hw * 0.75);
      ctx.lineTo(-hl * 0.3, 0); ctx.lineTo(-hl * 0.45, hw * 0.75); ctx.quadraticCurveTo(hl * 0.2, hw, hl * 0.55, 0); ctx.fill();
      ctx.globalAlpha = a * 0.9; ctx.fillStyle = `rgb(${o.core || '255,255,255'})`;
      ctx.beginPath(); ctx.moveTo(hl * 0.5, 0); ctx.quadraticCurveTo(hl * 0.1, -hw * 0.4, -hl * 0.3, -hw * 0.25); ctx.lineTo(-hl * 0.3, hw * 0.25); ctx.quadraticCurveTo(hl * 0.1, hw * 0.4, hl * 0.5, 0); ctx.fill();
      // 龙角与龙须：向后飘
      ctx.strokeStyle = `rgb(${o.core || '255,255,255'})`; ctx.lineWidth = Math.max(1.2, W * 0.08);
      for (const sgn of [-1, 1]) {
        const sw = Math.sin(t * 7 + sgn) * hw * 0.5;
        ctx.globalAlpha = a * 0.8;
        ctx.beginPath(); ctx.moveTo(-hl * 0.1, sgn * hw * 0.55); ctx.quadraticCurveTo(-hl * 0.6, sgn * hw * 1.3, -hl * 1.1, sgn * hw * 1.1); ctx.stroke();
        ctx.globalAlpha = a * 0.55;
        ctx.beginPath(); ctx.moveTo(hl * 0.35, sgn * hw * 0.3); ctx.bezierCurveTo(hl * 0.1, sgn * hw * 1.6 + sw, -hl * 0.9, sgn * hw * 0.8 - sw, -hl * 1.7, sgn * hw * 1.5 + sw); ctx.stroke();
      }
      glow(ctx, hl * 0.15, -hw * 0.28, W * 0.3, '255,255,255', a); // 龙目
    }
    ctx.restore();
  }
  // 直线游动的龙：龙头在 (x, y)，朝 ang 方向，身体向后摆
  function swimPts(x, y, ang, len, n, amp, phase) {
    const ux = Math.cos(ang), uy = Math.sin(ang), out = [];
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1), s = len * k, off = Math.sin(phase - k * 5.5) * amp * Math.sin(Math.PI * Math.min(1, k * 1.4));
      out.push([x - ux * s - uy * off, y - uy * s + ux * off]);
    }
    return out;
  }

  // ---------- 特效贴图 ----------
  // 9 种贴图：刀光、冲击环、爆裂、雷电、枪芒、旋风、火焰、法阵、光柱。
  // 有 GPT 画的图（assets/fx/<名字>.png，黑底发光图）就用图，没有就用下面代码生成的版本。
  // 一律用 'lighter' 叠加着画：黑色部分不显示，亮的部分发光；需要时再染成招式的颜色。
  const TEX = {
    slash: [512, 256], ring: [512, 512], burst: [512, 512], bolt: [256, 768], thrust: [768, 192],
    whirl: [512, 512], flame: [256, 512], circle: [512, 512], pillar: [256, 768],
  };
  const genCache = new Map();
  let tintCache = new WeakMap(); // 原图 → (颜色 → 染好的图)：按对象查，不用每次拼字符串当键（后期一帧上百次）
  let artOf = () => null; // 由 game.js 接上：返回 GPT 画的贴图
  let artMemo = new Map(); // 每种贴图查一次有没有 GPT 的图（换图时 setArt 清掉）
  const art = key => { let v = artMemo.get(key); if (v === undefined) { v = artOf(key) || null; artMemo.set(key, v); } return v; };
  const rnd = (a, b) => a + Math.random() * (b - a);
  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
  const GEN = {
    slash(g, w, h) { // 月牙刀光：外沿锋利、内沿虚化，两端收尖
      const cx = w * 0.32, cy = h * 1.0, R = h * 0.92;
      for (let pass = 0; pass < 3; pass++) {
        const th = [0.34, 0.16, 0.05][pass], al = [0.25, 0.55, 1][pass];
        g.beginPath();
        const N = 40;
        for (let i = 0; i <= N; i++) { const k = i / N, a = -Math.PI * 0.92 + k * Math.PI * 0.62; g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); }
        for (let i = N; i >= 0; i--) { const k = i / N, a = -Math.PI * 0.92 + k * Math.PI * 0.62, t = Math.pow(Math.sin(Math.PI * k), 0.7) * R * th; g.lineTo(cx + Math.cos(a) * (R - t), cy + Math.sin(a) * (R - t)); }
        g.closePath(); g.fillStyle = `rgba(255,255,255,${al})`; g.fill();
      }
      for (let i = 0; i < 40; i++) { // 刀风细丝
        const a = -Math.PI * 0.9 + rnd(0, Math.PI * 0.6), r = R * rnd(0.55, 0.98);
        g.strokeStyle = `rgba(255,255,255,${rnd(0.08, 0.3)})`; g.lineWidth = rnd(0.6, 2);
        g.beginPath(); g.arc(cx, cy, r, a, a + rnd(0.08, 0.3)); g.stroke();
      }
    },
    ring(g, w) { // 冲击环：亮边 + 向内散开的气流
      const c = w / 2, gr = g.createRadialGradient(c, c, c * 0.55, c, c, c);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.72, 'rgba(255,255,255,0.18)'); gr.addColorStop(0.9, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, w);
      for (let i = 0; i < 140; i++) {
        const a = rnd(0, TAU), r1 = c * rnd(0.6, 0.85), r2 = c * rnd(0.86, 0.97);
        g.strokeStyle = `rgba(255,255,255,${rnd(0.05, 0.25)})`; g.lineWidth = rnd(1, 3);
        g.beginPath(); g.moveTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1); g.lineTo(c + Math.cos(a) * r2, c + Math.sin(a) * r2); g.stroke();
      }
    },
    burst(g, w) { // 爆裂：白热核心 + 一圈长短不一的光刺
      const c = w / 2;
      for (let i = 0; i < 26; i++) {
        const a = rnd(0, TAU), L = c * rnd(0.45, 0.98), wd = rnd(0.03, 0.08);
        const gr = g.createLinearGradient(c, c, c + Math.cos(a) * L, c + Math.sin(a) * L);
        gr.addColorStop(0, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.beginPath(); g.moveTo(c + Math.cos(a - wd) * c * 0.1, c + Math.sin(a - wd) * c * 0.1); g.lineTo(c + Math.cos(a) * L, c + Math.sin(a) * L); g.lineTo(c + Math.cos(a + wd) * c * 0.1, c + Math.sin(a + wd) * c * 0.1); g.fill();
      }
      const gr = g.createRadialGradient(c, c, 0, c, c, c * 0.55);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, w);
    },
    bolt(g, w, h) { // 雷电：主干 + 分叉，外层光晕
      const main = [[w / 2, 0]]; let x = w / 2;
      for (let y = 0; y < h; y += rnd(18, 34)) { x = Math.max(w * 0.2, Math.min(w * 0.8, x + rnd(-26, 26))); main.push([x, y]); }
      main.push([w / 2, h]);
      const line = (pts, lw, al) => { g.lineWidth = lw; g.strokeStyle = `rgba(255,255,255,${al})`; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([px, py], i) => i ? g.lineTo(px, py) : g.moveTo(px, py)); g.stroke(); };
      line(main, 26, 0.08); line(main, 12, 0.25); line(main, 4, 1);
      for (let b = 0; b < 5; b++) {
        const s = main[Math.floor(rnd(2, main.length - 3))], pts = [s]; let bx = s[0], by = s[1];
        for (let k = 0; k < 6; k++) { bx += rnd(-30, 30); by += rnd(15, 30); pts.push([bx, by]); }
        line(pts, 8, 0.1); line(pts, 2, 0.7);
      }
    },
    thrust(g, w, h) { // 枪芒：一道向右越来越亮、越来越尖的光
      const cy = h / 2;
      for (const [th, al] of [[0.45, 0.15], [0.22, 0.4], [0.07, 1]]) {
        const gr = g.createLinearGradient(0, 0, w, 0);
        gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.75, `rgba(255,255,255,${al * 0.7})`); gr.addColorStop(1, `rgba(255,255,255,${al})`);
        g.fillStyle = gr; g.beginPath(); g.moveTo(0, cy); g.quadraticCurveTo(w * 0.6, cy - h * th, w, cy); g.quadraticCurveTo(w * 0.6, cy + h * th, 0, cy); g.fill();
      }
      for (let i = 0; i < 30; i++) { const y = cy + rnd(-h * 0.3, h * 0.3), x0 = rnd(0, w * 0.6); g.strokeStyle = `rgba(255,255,255,${rnd(0.05, 0.2)})`; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + rnd(60, 200), y); g.stroke(); }
    },
    whirl(g, w) { // 旋风：几道螺旋刀风
      const c = w / 2;
      for (let k = 0; k < 7; k++) {
        const a0 = k / 7 * TAU, al = rnd(0.25, 0.7);
        g.strokeStyle = `rgba(255,255,255,${al})`; g.lineWidth = rnd(3, 9); g.lineCap = 'round';
        g.beginPath();
        for (let i = 0; i <= 30; i++) { const t = i / 30, r = c * (0.2 + 0.75 * t), a = a0 + t * 2.6; g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r); }
        g.stroke();
      }
      const gr = g.createRadialGradient(c, c, 0, c, c, c * 0.4); gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, w);
    },
    flame(g, w, h) { // 火焰：一簇向上窜的火舌（橙黄色，不再染色）
      for (let i = 0; i < 9; i++) {
        const x = w * rnd(0.3, 0.7), top = h * rnd(0.05, 0.4), wd = w * rnd(0.12, 0.25);
        const gr = g.createLinearGradient(0, h, 0, top);
        gr.addColorStop(0, 'rgba(255,240,200,0.9)'); gr.addColorStop(0.35, 'rgba(255,170,60,0.6)'); gr.addColorStop(1, 'rgba(200,50,10,0)');
        g.fillStyle = gr; g.beginPath(); g.moveTo(x - wd, h * 0.95); g.quadraticCurveTo(x - wd * 0.8, h * 0.5, x + rnd(-wd, wd), top); g.quadraticCurveTo(x + wd * 0.8, h * 0.5, x + wd, h * 0.95); g.fill();
      }
      const gr = g.createRadialGradient(w / 2, h * 0.88, 0, w / 2, h * 0.88, w * 0.45); gr.addColorStop(0, 'rgba(255,250,230,0.9)'); gr.addColorStop(1, 'rgba(255,150,50,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    },
    circle(g, w) { // 法阵：双圈、八卦、八角、符点
      const c = w / 2; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.fillStyle = 'rgba(255,255,255,0.9)';
      const ring = (r, lw) => { g.lineWidth = lw; g.beginPath(); g.arc(c, c, r, 0, TAU); g.stroke(); };
      ring(c * 0.96, 3); ring(c * 0.88, 1.5); ring(c * 0.5, 2); ring(c * 0.44, 1);
      g.lineWidth = 2; g.beginPath(); for (let i = 0; i <= 8; i++) { const a = i / 8 * TAU; g.lineTo(c + Math.cos(a) * c * 0.84, c + Math.sin(a) * c * 0.84); } g.stroke();
      g.beginPath(); for (let i = 0; i <= 8; i++) { const a = i / 8 * TAU + Math.PI / 8; g.lineTo(c + Math.cos(a) * c * 0.84, c + Math.sin(a) * c * 0.84); } g.stroke();
      for (let i = 0; i < 8; i++) { // 卦爻
        const a = (i + 0.5) / 8 * TAU, rr = c * 0.66;
        for (let k = -1; k <= 1; k++) { const px = -Math.sin(a), py = Math.cos(a), ox = Math.cos(a) * k * 9, oy = Math.sin(a) * k * 9, broken = (i + k + 3) % 2;
          const x0 = c + Math.cos(a) * rr + ox, y0 = c + Math.sin(a) * rr + oy;
          g.lineWidth = 4; g.beginPath();
          if (broken) { g.moveTo(x0 - px * 18, y0 - py * 18); g.lineTo(x0 - px * 4, y0 - py * 4); g.moveTo(x0 + px * 4, y0 + py * 4); g.lineTo(x0 + px * 18, y0 + py * 18); }
          else { g.moveTo(x0 - px * 18, y0 - py * 18); g.lineTo(x0 + px * 18, y0 + py * 18); }
          g.stroke(); }
      }
      for (let i = 0; i < 48; i++) { const a = i / 48 * TAU; g.beginPath(); g.arc(c + Math.cos(a) * c * 0.92, c + Math.sin(a) * c * 0.92, i % 6 ? 1.5 : 3.5, 0, TAU); g.fill(); }
      const gr = g.createRadialGradient(c, c, 0, c, c, c); gr.addColorStop(0, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w);
    },
    pillar(g, w, h) { // 光柱：中间最亮，向上逐渐消散
      const gr = g.createLinearGradient(0, 0, w, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.35)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(0.65, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'destination-in';
      const v = g.createLinearGradient(0, 0, 0, h); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.5, 'rgba(0,0,0,0.6)'); v.addColorStop(1, 'rgba(0,0,0,1)');
      g.fillStyle = v; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'source-over';
    },
  };
  function tex(key) {
    const a = art(key);
    if (a) return a;
    let c = genCache.get(key);
    if (!c) { const [w, h] = TEX[key]; let g; [c, g] = mk(w, h); GEN[key](g, w, h); genCache.set(key, c); }
    return c;
  }
  // 染色：亮的地方染成 rgb（乘法），黑底保持黑（叠加时看不见）
  function tinted(key, rgb) {
    const src = tex(key);
    let m = tintCache.get(src);
    if (!m) tintCache.set(src, (m = new Map()));
    let c = m.get(rgb);
    if (c) return c;
    const w = src.naturalWidth || src.width, h = src.naturalHeight || src.height;
    let g; [c, g] = mk(w, h);
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'multiply'; g.fillStyle = `rgb(${rgb})`; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-in'; g.drawImage(src, 0, 0);
    m.set(rgb, c);
    return c;
  }
  // 画一张特效贴图：中心在 (x, y)，宽 w 高 h，转 rot；core 是额外叠一层不染色的白光（保留白热核心）
  function sprite(ctx, key, rgb, x, y, w, h, rot, a, core = 0.35, flat = 1) {
    a *= K;
    if (a <= 0) return;
    if (art(key)) a *= 0.8; // 画的贴图比代码生成的亮，压一点免得刺眼
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(x, y); if (flat !== 1) ctx.scale(1, flat); if (rot) ctx.rotate(rot);
    if (rgb) { ctx.globalAlpha = Math.min(1, a); ctx.drawImage(tinted(key, rgb), -w / 2, -h / 2, w, h); }
    if (!rgb || core > 0) { ctx.globalAlpha = Math.min(1, a * (rgb ? core : 1)); ctx.drawImage(tex(key), -w / 2, -h / 2, w, h); }
    ctx.restore();
  }
  function setArt(fn) { artOf = fn; artMemo = new Map(); tintCache = new WeakMap(); }

  // ---------- 女将的小物件：樱花瓣、冰晶、雪花、书页、折扇 ----------
  // 樱花瓣：一头尖、一头带小缺口的心形瓣，中间一道浅色
  function petal(ctx, x, y, s, rot, rgb, a) {
    if (a <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = Math.min(1, a);
    ctx.fillStyle = `rgb(${rgb || '255,170,205'})`;
    ctx.beginPath();
    ctx.moveTo(0, s);
    ctx.bezierCurveTo(-s * 0.95, s * 0.35, -s * 0.75, -s * 0.95, -s * 0.16, -s * 0.85);
    ctx.lineTo(0, -s * 0.55);
    ctx.lineTo(s * 0.16, -s * 0.85);
    ctx.bezierCurveTo(s * 0.75, -s * 0.95, s * 0.95, s * 0.35, 0, s);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.ellipse(0, -s * 0.05, s * 0.16, s * 0.55, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // 冰晶：细长的菱形冰棱，一半亮一半暗，白色描边
  function shard(ctx, x, y, s, rot, a) {
    if (a <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = Math.min(1, a);
    ctx.fillStyle = 'rgba(150,205,250,0.9)'; ctx.strokeStyle = 'rgba(240,250,255,0.95)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.3, 0); ctx.lineTo(0, s * 0.55); ctx.lineTo(-s * 0.3, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(235,248,255,0.75)';
    ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.3, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // 雪花：六瓣，每瓣带两根小枝
  function snowflake(ctx, x, y, s, rot, a) {
    if (a <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = Math.min(1, a);
    ctx.strokeStyle = 'rgb(225,245,255)'; ctx.lineWidth = Math.max(1, s * 0.12); ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const c = Math.cos(i * TAU / 6), d = Math.sin(i * TAU / 6);
      ctx.moveTo(0, 0); ctx.lineTo(c * s, d * s);
      for (const k of [0.5, 0.75]) {
        const bx = c * s * k, by = d * s * k, l = s * 0.25;
        ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(i * TAU / 6 + 0.8) * l, by + Math.sin(i * TAU / 6 + 0.8) * l);
        ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(i * TAU / 6 - 0.8) * l, by + Math.sin(i * TAU / 6 - 0.8) * l);
      }
    }
    ctx.stroke();
    ctx.restore();
  }
  // 书页：米黄纸面 + 竖排墨字（几道墨线），sk 是翻动时的横向压缩
  function page(ctx, x, y, s, rot, a, sk = 1) {
    if (a <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sk, 1); ctx.globalAlpha = Math.min(1, a);
    ctx.fillStyle = '#f2e7c8'; ctx.strokeStyle = '#5a4026'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.rect(-s * 0.7, -s, s * 1.4, s * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(40,28,18,0.75)'; ctx.lineWidth = Math.max(0.8, s * 0.12);
    ctx.beginPath();
    for (const k of [-0.38, 0, 0.38]) { ctx.moveTo(s * k, -s * 0.75); ctx.lineTo(s * k, s * (0.35 + 0.35 * Math.abs(k))); }
    ctx.stroke();
    ctx.fillStyle = 'rgba(190,40,30,0.85)'; ctx.fillRect(s * 0.3, s * 0.55, s * 0.28, s * 0.28); // 朱红小印
    ctx.restore();
  }
  // 折扇：扇面从扇骨处的米白渐变到扇色，扇骨一根根散开
  function fan(ctx, x, y, s, rot, rgb, a) {
    if (a <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = Math.min(1, a);
    const a0 = -Math.PI * 0.86, a1 = -Math.PI * 0.14;
    const g = ctx.createRadialGradient(0, 0, s * 0.3, 0, 0, s);
    g.addColorStop(0, '#f8f0dc'); g.addColorStop(1, `rgb(${rgb || '232,106,80'})`);
    ctx.fillStyle = g; ctx.strokeStyle = '#3a2414'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.arc(0, 0, s, a0, a1); ctx.arc(0, 0, s * 0.32, a1, a0, true); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(70,40,20,0.7)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) { const t = a0 + (a1 - a0) * i / 8; ctx.moveTo(Math.cos(t) * s * 0.1, Math.sin(t) * s * 0.1); ctx.lineTo(Math.cos(t) * s * 0.97, Math.sin(t) * s * 0.97); }
    ctx.stroke();
    ctx.fillStyle = '#c9a046'; ctx.beginPath(); ctx.arc(0, 0, s * 0.1, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // ---------- 董卓、大乔、小乔的小物件：铁链、莲灯、蝴蝶、纸鸢 ----------
  // 铁链：一节节交错的黑铁环，外面一圈暗红的煞气；sag 是中间下垂多少，len 只画前面一段（链子还在飞的时候）
  function chain(ctx, x0, y0, x1, y1, o = {}) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
    if (L < 2) return;
    const a = o.a === undefined ? 1 : o.a, w = o.w || 7, sag = o.sag || 0, rgb = o.rgb || '190,40,70';
    const nx = -dy / L, ny = dx / L, n = Math.max(2, Math.round(L / (w * 1.5)));
    const pt = t => { const s = Math.sin(t * Math.PI) * sag; return [x0 + dx * t + nx * s, y0 + dy * t + ny * s + Math.abs(s) * 0.3]; };
    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 * a;
    ctx.strokeStyle = `rgb(${rgb})`; ctx.lineWidth = w * 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); for (let i = 0; i <= n; i++) { const [x, y] = pt(i / n); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a;
    for (let i = 0; i < n; i++) {
      const [xa, ya] = pt(i / n), [xb, yb] = pt((i + 1) / n), ang = Math.atan2(yb - ya, xb - xa);
      ctx.save(); ctx.translate((xa + xb) / 2, (ya + yb) / 2); ctx.rotate(ang);
      if (i % 2) ctx.scale(1, 0.35); // 交错的环：一个正面、一个侧面
      ctx.strokeStyle = '#0c0a0d'; ctx.lineWidth = w * 0.55;
      ctx.beginPath(); ctx.ellipse(0, 0, w * 0.95, w * 0.6, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(150,120,140,0.55)'; ctx.lineWidth = w * 0.18;
      ctx.beginPath(); ctx.ellipse(0, -w * 0.08, w * 0.9, w * 0.52, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      ctx.restore();
    }
    if (o.hook) { // 链头的铁钩
      const ang = Math.atan2(dy, dx);
      ctx.save(); ctx.translate(x1, y1); ctx.rotate(ang);
      ctx.fillStyle = '#16121a'; ctx.strokeStyle = `rgba(${rgb},0.9)`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(w * 2.2, 0); ctx.lineTo(-w * 0.6, -w * 1.4); ctx.lineTo(-w * 0.1, 0); ctx.lineTo(-w * 0.6, w * 1.4); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
  // 莲灯：一朵粉白莲花托着一点烛光，外面一圈暖光
  const LANTERN_K = [0.5, 0.15, -0.2], LANTERN_C = ['#e98fb0', '#f6c4d6', '#fde6ee']; // 莲灯三层花瓣的位置和颜色（放在外面，不用每盏每帧新建数组）
  function lantern(ctx, x, y, s, a, rgb = '255,200,120') {
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = Math.min(1, a);
    ctx.globalCompositeOperation = 'lighter'; glow(ctx, x, y - s * 0.3, s * 2.6, rgb, 0.7 * a); ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = Math.min(1, a);
    for (let i = 0; i < 3; i++) { // 三层花瓣，越往里越浅
      const k = LANTERN_K[i];
      ctx.fillStyle = LANTERN_C[i];
      for (let side = -1; side <= 1; side++) {
        ctx.save(); ctx.translate(x + side * s * 0.45 * (1 - k * 0.6), y + k * s * 0.3); ctx.rotate(side * 0.55);
        ctx.beginPath(); ctx.moveTo(0, s * 0.35); ctx.quadraticCurveTo(-s * 0.42, -s * 0.2, 0, -s * 0.8); ctx.quadraticCurveTo(s * 0.42, -s * 0.2, 0, s * 0.35); ctx.fill();
        ctx.restore();
      }
    }
    ctx.fillStyle = '#fff6d8'; ctx.beginPath(); ctx.ellipse(x, y - s * 0.55, s * 0.12, s * 0.22, 0, 0, TAU); ctx.fill(); // 烛火
    ctx.fillStyle = '#4f8b74'; ctx.beginPath(); ctx.ellipse(x, y + s * 0.42, s * 0.8, s * 0.16, 0, 0, TAU); ctx.fill(); // 荷叶托
    ctx.restore();
  }
  // 蝴蝶：两对翅膀随 flap 扇动（0–1），翅膀带一点白边
  function butterfly(ctx, x, y, s, rot, flap, rgb, a) {
    if (a <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = Math.min(1, a);
    const k = 0.25 + 0.75 * Math.abs(Math.cos(flap * Math.PI));
    ctx.fillStyle = `rgb(${rgb || '200,160,255'})`; ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1;
    for (const sd of [-1, 1]) {
      ctx.save(); ctx.scale(sd * k, 1);
      ctx.beginPath(); ctx.moveTo(0, -s * 0.1); ctx.bezierCurveTo(s * 0.9, -s * 1.1, s * 1.25, -s * 0.2, s * 0.15, s * 0.05); ctx.fill(); ctx.stroke(); // 前翅
      ctx.beginPath(); ctx.moveTo(0, s * 0.05); ctx.bezierCurveTo(s * 0.9, s * 0.2, s * 0.7, s * 0.95, s * 0.08, s * 0.35); ctx.fill(); ctx.stroke();   // 后翅
      ctx.restore();
    }
    ctx.fillStyle = '#2a1a30'; ctx.beginPath(); ctx.ellipse(0, s * 0.05, s * 0.09, s * 0.42, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#2a1a30'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(0, -s * 0.35); ctx.lineTo(-s * 0.25, -s * 0.7); ctx.moveTo(0, -s * 0.35); ctx.lineTo(s * 0.25, -s * 0.7); ctx.stroke();
    ctx.restore();
  }
  // 纸鸢：菱形风筝，竹骨十字，后面拖一条飘带
  function kite(ctx, x, y, s, rot, rgb, a) {
    if (a <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = Math.min(1, a);
    ctx.strokeStyle = `rgba(${rgb || '200,160,255'},0.85)`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, s); for (let i = 1; i <= 6; i++) ctx.lineTo(Math.sin(i * 1.3 + x * 0.01) * s * 0.25, s + i * s * 0.28); ctx.stroke();
    ctx.fillStyle = '#f4ecf8'; ctx.strokeStyle = '#4a2a5a'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.7, -s * 0.15); ctx.lineTo(0, s); ctx.lineTo(-s * 0.7, -s * 0.15); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = `rgb(${rgb || '200,160,255'})`;
    ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.7, -s * 0.15); ctx.lineTo(0, -s * 0.15); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, s); ctx.lineTo(-s * 0.7, -s * 0.15); ctx.lineTo(0, -s * 0.15); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(90,60,30,0.8)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(0, s); ctx.moveTo(-s * 0.7, -s * 0.15); ctx.lineTo(s * 0.7, -s * 0.15); ctx.stroke();
    ctx.restore();
  }

  // 鬼火（郭嘉）：青绿色的一团冷焰，火舌向上飘，中心发白
  function wisp(ctx, x, y, s, t, a = 1, rgb = '110,240,200') {
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = Math.min(1, a);
    ctx.globalCompositeOperation = 'lighter'; glow(ctx, x, y, s * 2.6, rgb, 0.65 * a);
    ctx.globalAlpha = Math.min(1, a);
    const sway = Math.sin(t * 9 + x * 0.05) * s * 0.25;
    ctx.fillStyle = `rgba(${rgb},0.85)`;
    ctx.beginPath(); ctx.moveTo(x - s * 0.7, y + s * 0.2);
    ctx.quadraticCurveTo(x - s * 0.8, y - s * 0.9, x + sway, y - s * 1.9);
    ctx.quadraticCurveTo(x + s * 0.8, y - s * 0.9, x + s * 0.7, y + s * 0.2);
    ctx.arc(x, y + s * 0.2, s * 0.7, 0, Math.PI); ctx.fill();
    ctx.fillStyle = 'rgba(235,255,250,0.9)'; ctx.beginPath(); ctx.ellipse(x, y, s * 0.32, s * 0.45, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // 巨石（典韦）：粗糙的灰褐色圆石，带几道裂纹，rot 是滚动角度
  function rock(ctx, x, y, r, rot) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(r * 0.1, r * 0.85, r * 1.05, r * 0.32, 0, 0, TAU); ctx.fill();
    ctx.rotate(rot);
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#a89c88'); g.addColorStop(0.6, '#6e6456'); g.addColorStop(1, '#3e372e');
    ctx.fillStyle = g; ctx.strokeStyle = '#2a241c'; ctx.lineWidth = 2;
    ctx.beginPath(); for (let i = 0; i < 11; i++) { const a = i / 11 * TAU, rr = r * (0.88 + 0.12 * Math.sin(i * 2.7)); i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(30,24,18,.7)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.1); ctx.lineTo(-r * 0.1, r * 0.15); ctx.lineTo(r * 0.3, -r * 0.05); ctx.moveTo(-r * 0.1, r * 0.15); ctx.lineTo(-r * 0.05, r * 0.6); ctx.moveTo(r * 0.2, -r * 0.55); ctx.lineTo(r * 0.45, -r * 0.3); ctx.stroke();
    ctx.restore();
  }

  return { setK, glow, star, slash, shock, particles, crack, makeCrack, glowTex, dragon, swimPts, tex, sprite, setArt, TEX, petal, shard, snowflake, page, fan, chain, lantern, butterfly, kite, wisp, rock };
})();
