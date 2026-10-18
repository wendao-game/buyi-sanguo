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

  return { glow, star, slash, shock, particles, crack, makeCrack, glowTex, dragon, swimPts };
})();
