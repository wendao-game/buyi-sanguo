// 布衣三国 · 战斗特效（只负责绘制）
// 发光效果用预先画好的径向渐变贴图叠加（'lighter' 混合），比 shadowBlur 快得多，同屏大量特效也不卡。
// 颜色统一用 'r,g,b' 字符串。
window.FX = (() => {
  const TAU = Math.PI * 2;
  const glowCache = new Map();

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
    ctx.globalAlpha = Math.min(1, a);
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

  // 冲击环：亮环 + 内部淡光
  function shock(ctx, f) {
    const t = f.life / f.max, prog = 1 - t;
    const r = f.r * (0.25 + 0.75 * Math.pow(prog, 0.55));
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = t * 0.22;
    const g = ctx.createRadialGradient(f.x, f.y, r * 0.4, f.x, f.y, r);
    g.addColorStop(0, `rgba(${f.rgb},0)`); g.addColorStop(1, `rgba(${f.rgb},0.9)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); ctx.fill();
    ctx.globalAlpha = t;
    ctx.strokeStyle = `rgb(${f.rgb})`;
    ctx.lineWidth = 3 + 12 * t;
    ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,240,0.8)';
    ctx.lineWidth = 1.5 + 3 * t;
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
          ctx.globalAlpha = t;
          ctx.strokeStyle = `rgb(${q.rgb})`;
          ctx.lineWidth = q.size * (0.4 + 0.6 * t);
          ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(q.x - q.vx * 0.035, q.y - q.vy * 0.035); ctx.lineTo(q.x, q.y); ctx.stroke();
          break;
        }
        case 'ember': glow(ctx, q.x, q.y, q.size * (0.5 + 0.5 * t), q.rgb, t); break;
        case 'glint': star(ctx, q.x, q.y, q.size * (0.6 + 0.8 * (1 - t)), q.rgb, t, q.rot || 0); break;
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

  return { glow, star, slash, shock, particles, crack, makeCrack, glowTex };
})();
