// 布衣三国 · 战场小人
// 没有美术小人图时，用代码画 Q 版二头身小人（朝右）；外形参数沿用 data.js 里的 look。
// 画布坐标：宽 64、高 80，脚底在 y = 78；游戏里会缩放、翻转并加上走路动画。
window.Sprites = (() => {
  const INK = '#1a140e';
  const BOX_W = 64, BOX_H = 80;

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const ch = s => { const c = (n >> s) & 255; return Math.round(f < 0 ? c * (1 + f) : c + (255 - c) * f); };
    return '#' + [16, 8, 0].map(s => ch(s).toString(16).padStart(2, '0')).join('');
  }
  function shape(g, fillColor, build, lw = 1.8) {
    g.beginPath(); build(g);
    if (fillColor) { g.fillStyle = fillColor; g.fill(); }
    g.lineWidth = lw; g.strokeStyle = INK; g.stroke();
  }
  const rr = (g, x, y, w, h, r) => { g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  const line = (g, x1, y1, x2, y2, color, w) => {
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.strokeStyle = INK; g.lineWidth = w + 2.4; g.stroke();
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.strokeStyle = color; g.lineWidth = w; g.stroke();
  };

  // ---------- 兵器（拿在朝前的手里） ----------
  const STEEL = '#dfe3e6', WOOD = '#6b4423';
  function weapon(g, L) {
    const hx = 46, hy = 50; // 手的位置
    switch (L.weapon) {
      case 'spear': case 'snake': case 'ji': case 'guandao': {
        line(g, 38, 74, 56, 6, L.weapon === 'snake' ? '#2b2622' : WOOD, 3);
        g.save(); g.translate(56, 6); g.rotate(Math.atan2(-68, 18));
        if (L.weapon === 'guandao') {
          shape(g, STEEL, s => { s.moveTo(-4, -3); s.lineTo(10, -6); s.quadraticCurveTo(22, -2, 18, 12); s.quadraticCurveTo(12, 3, -4, 3); s.closePath(); });
          shape(g, '#2f6b4a', s => { s.moveTo(-6, -3); s.lineTo(-14, 0); s.lineTo(-6, 3); s.closePath(); }, 1.2);
        } else {
          shape(g, STEEL, s => { s.moveTo(0, -3.5); s.lineTo(L.weapon === 'snake' ? 16 : 13, 0); s.lineTo(0, 3.5); s.closePath(); });
          if (L.weapon === 'ji') {
            shape(g, STEEL, s => { s.moveTo(2, -3); s.quadraticCurveTo(6, -14, -4, -15); s.quadraticCurveTo(0, -8, -2, -3); s.closePath(); }, 1.4);
            shape(g, STEEL, s => { s.moveTo(2, 3); s.quadraticCurveTo(6, 14, -4, 15); s.quadraticCurveTo(0, 8, -2, 3); s.closePath(); }, 1.4);
          }
          shape(g, L.plume || '#b5372a', s => { s.moveTo(-2, -4); s.lineTo(-10, -5); s.lineTo(-7, 0); s.lineTo(-10, 5); s.lineTo(-2, 4); s.closePath(); }, 1.2);
        }
        g.restore();
        break;
      }
      case 'dao': case 'sword':
        line(g, hx, hy, 60, 22, L.weapon === 'dao' ? STEEL : '#e8eef2', L.weapon === 'dao' ? 6 : 3.5);
        line(g, hx - 2, hy + 3, hx + 1, hy - 1, '#7a5a2a', 3);
        break;
      case 'twinji':
        line(g, 12, 70, 34, 10, '#4a3423', 2.6);
        line(g, hx, hy + 8, 60, 14, '#4a3423', 2.6);
        shape(g, STEEL, s => { s.moveTo(60, 14); s.quadraticCurveTo(66, 6, 58, 4); s.quadraticCurveTo(60, 10, 56, 13); s.closePath(); }, 1.3);
        break;
      case 'bow':
        g.lineCap = 'round';
        g.beginPath(); g.moveTo(52, 18); g.quadraticCurveTo(66, 44, 52, 70); g.strokeStyle = INK; g.lineWidth = 4.4; g.stroke();
        g.strokeStyle = '#7a4e2a'; g.lineWidth = 2.6; g.stroke();
        g.beginPath(); g.moveTo(52, 18); g.lineTo(52, 70); g.strokeStyle = '#e8dcc0'; g.lineWidth = 0.9; g.stroke();
        break;
      case 'hoe':
        line(g, 30, 72, 52, 12, '#8a6038', 3);
        shape(g, '#7f8488', s => { s.moveTo(50, 10); s.lineTo(60, 14); s.lineTo(62, 26); s.lineTo(55, 22); s.closePath(); });
        break;
      case 'fan':
        g.save(); g.translate(hx + 2, hy - 6);
        for (let i = -2; i <= 2; i++) { g.save(); g.rotate(i * 0.32); shape(g, L.fanColor || '#f4f1e8', s => s.ellipse(0, -9, 3.6, 9, 0, 0, Math.PI * 2), 1); g.restore(); }
        g.restore();
        break;
      case 'ribbon': // 貂蝉的彩绸：从手里飘起的两条绸带
        for (const [dy, c] of [[0, L.ribbon || '#ff9ac8'], [6, '#f6e2ea']]) {
          g.lineCap = 'round';
          g.beginPath(); g.moveTo(hx, hy); g.bezierCurveTo(62, 40 + dy, 50, 22 + dy, 62, 10 + dy);
          g.strokeStyle = INK; g.lineWidth = 4.4; g.stroke(); g.strokeStyle = c; g.lineWidth = 2.6; g.stroke();
        }
        break;
      case 'flute': // 甄姬的玉笛：横在手边
        line(g, hx - 6, hy - 6, hx + 14, hy - 14, '#bfe6ff', 2.6);
        g.fillStyle = INK;
        for (const t of [0.35, 0.55, 0.75]) { g.beginPath(); g.arc(hx - 6 + 20 * t, hy - 6 - 8 * t, 0.7, 0, Math.PI * 2); g.fill(); }
        break;
      case 'scrolls':
        g.save(); g.translate(hx - 2, hy - 4); g.rotate(-0.35);
        for (let i = 0; i < 4; i++) shape(g, i % 2 ? '#d6bd84' : '#ccb072', s => rr(s, -8 + i * 4, -9, 4, 18, 1), 1);
        line(g, -9, -3, 9, -3, '#6b4a2e', 1.4); line(g, -9, 4, 9, 4, '#6b4a2e', 1.4);
        g.restore();
        break;
      case 'hammer': // 虎贲力士的大锤
        line(g, 30, 70, 50, 14, WOOD, 3.4);
        shape(g, '#5a5a5e', s => { g.save(); s.translate(51, 12); s.rotate(0.3); rr(s, -10, -7, 20, 14, 3); g.restore(); });
        g.beginPath(); g.moveTo(44, 8); g.lineTo(56, 12); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.4; g.stroke();
        break;
      case 'crossbow': // 强弩
        line(g, 34, 52, 60, 44, WOOD, 3.2);
        g.lineCap = 'round';
        g.beginPath(); g.moveTo(54, 32); g.quadraticCurveTo(64, 44, 56, 58); g.strokeStyle = INK; g.lineWidth = 4; g.stroke();
        g.strokeStyle = '#5a4030'; g.lineWidth = 2.4; g.stroke();
        g.beginPath(); g.moveTo(54, 32); g.lineTo(52, 46); g.lineTo(56, 58); g.strokeStyle = '#e8dcc0'; g.lineWidth = 0.9; g.stroke();
        break;
      case 'axe': // 程远志的开山斧
        line(g, 32, 72, 52, 10, WOOD, 3.2);
        shape(g, STEEL, s => { s.moveTo(50, 8); s.quadraticCurveTo(64, 4, 64, 20); s.quadraticCurveTo(58, 26, 52, 22); s.closePath(); });
        break;
      case 'staff': // 术士的九节杖
        line(g, 40, 74, 52, 8, '#7a5a2a', 2.6);
        shape(g, '#e0c040', s => s.arc(52, 8, 4.5, 0, Math.PI * 2), 1.2);
        for (const y of [16, 22]) shape(g, '#c9a046', s => s.arc(50.6, y, 1.8, 0, Math.PI * 2), 0.8);
        break;
      case 'shield':
        line(g, 34, 74, 50, 10, WOOD, 2.6);
        shape(g, '#6b4a2e', s => s.ellipse(48, 48, 11, 14, 0, 0, Math.PI * 2), 2);
        shape(g, '#c9a046', s => s.arc(48, 48, 3.6, 0, Math.PI * 2), 1.2);
        g.beginPath(); g.ellipse(48, 48, 7.5, 10, 0, 0, Math.PI * 2); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; g.stroke();
        break;
    }
    shape(g, L.skin, s => s.arc(hx, hy, 3.6, 0, Math.PI * 2), 1.4); // 手
  }

  // ---------- 头部装饰 ----------
  const HAIR = s => { s.moveTo(16, 24); s.quadraticCurveTo(15, 6, 32, 6); s.quadraticCurveTo(49, 6, 48, 20); s.quadraticCurveTo(40, 13, 30, 14); s.quadraticCurveTo(22, 16, 16, 24); s.closePath(); };
  function headBack(g, L) {
    if (L.head === 'pheasant') { // 雉鸡翎向后上方扬起
      for (const [x2, y2] of [[2, 2], [10, 0]]) {
        g.beginPath(); g.moveTo(30, 8); g.quadraticCurveTo(18, -2, x2, y2 + 10); g.strokeStyle = INK; g.lineWidth = 4; g.stroke();
        g.strokeStyle = '#c9a046'; g.lineWidth = 2.4; g.stroke();
      }
    }
    if (L.head === 'hood') shape(g, L.headColor, s => { s.moveTo(18, 12); s.quadraticCurveTo(6, 18, 8, 32); s.quadraticCurveTo(14, 24, 20, 20); s.closePath(); });
    if (L.head === 'scholar' || L.head === 'lunjin') line(g, 18, 14, 10, 34, L.headColor, 2.4);
    if (L.head === 'band' || L.head === 'hunter') line(g, 17, 18, 8, 26, L.head === 'band' ? L.bandColor || '#a8322a' : L.headColor, 2.2);
    if (L.head === 'bun') shape(g, L.hairColor || '#15110c', s => { s.moveTo(18, 14); s.quadraticCurveTo(6, 30, 12, 50); s.quadraticCurveTo(18, 44, 22, 46); s.quadraticCurveTo(18, 30, 26, 18); s.closePath(); }, 1.2); // 女将：披在背后的长发
  }
  function headgear(g, L) {
    switch (L.head) {
      case 'helmet':
        shape(g, L.headColor, s => { s.moveTo(14, 22); s.quadraticCurveTo(14, 3, 32, 3); s.quadraticCurveTo(50, 3, 50, 22); s.quadraticCurveTo(32, 15, 14, 22); s.closePath(); });
        shape(g, L.trim || '#c9a046', s => { s.moveTo(13, 21); s.quadraticCurveTo(32, 13, 51, 21); s.lineTo(51, 24); s.quadraticCurveTo(32, 16, 13, 24); s.closePath(); }, 1.3);
        g.beginPath(); g.moveTo(22, 8); g.quadraticCurveTo(26, 5, 30, 5); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.6; g.stroke();
        if (L.plume) shape(g, L.plume, s => { s.moveTo(32, 4); s.quadraticCurveTo(22, -4, 14, 4); s.quadraticCurveTo(22, 2, 26, 6); s.closePath(); }, 1.2);
        break;
      case 'cap':
        shape(g, '#15110c', HAIR, 0.01);
        shape(g, L.headColor, s => { s.moveTo(15, 18); s.quadraticCurveTo(32, 0, 49, 18); s.quadraticCurveTo(32, 12, 15, 18); s.closePath(); });
        break;
      case 'hood':
        shape(g, L.headColor, s => { s.moveTo(14, 22); s.quadraticCurveTo(13, 2, 32, 2); s.quadraticCurveTo(51, 2, 50, 20); s.quadraticCurveTo(32, 13, 14, 22); s.closePath(); });
        line(g, 15, 19, 49, 17, L.trim || '#c9a046', 1.6);
        break;
      case 'pheasant':
        shape(g, '#15110c', HAIR, 0.01);
        shape(g, '#c9a046', s => { s.moveTo(25, 10); s.lineTo(27, 2); s.lineTo(30, 7); s.lineTo(32, 0); s.lineTo(34, 7); s.lineTo(37, 2); s.lineTo(39, 10); s.closePath(); }, 1.3);
        break;
      case 'lunjin':
        shape(g, '#15110c', HAIR, 0.01);
        shape(g, L.headColor, s => { s.moveTo(20, 14); s.lineTo(22, -1); s.quadraticCurveTo(32, -4, 42, -1); s.lineTo(44, 12); s.quadraticCurveTo(32, 9, 20, 14); s.closePath(); });
        break;
      case 'band': {
        shape(g, '#15110c', s => { s.moveTo(15, 24); for (let i = 0; i <= 8; i++) { const a = Math.PI * (1.05 + i * 0.9 / 8), r = i % 2 ? 21 : 15; s.lineTo(32 + Math.cos(a) * r, 21 + Math.sin(a) * r); } s.lineTo(49, 22); s.closePath(); }, 1.3);
        line(g, 16, 15, 48, 14, L.bandColor || '#a8322a', 3);
        break;
      }
      case 'bun': { // 女将：高髻 + 发簪（簪头一朵花 / 一颗珠）
        const hc = L.hairColor || '#15110c';
        shape(g, hc, HAIR, 0.01);
        shape(g, hc, s => s.ellipse(30, 4, 8, 6.5, 0, 0, Math.PI * 2), 1.2);
        line(g, 20, 4, 42, -1, '#c9a046', 1.4);
        shape(g, L.pin || '#ff9ac8', s => s.arc(42, -1, 3, 0, Math.PI * 2), 1);
        shape(g, L.pin || '#ff9ac8', s => s.arc(20, 10, 2.4, 0, Math.PI * 2), 0.9);
        break;
      }
      case 'straw':
        shape(g, '#15110c', HAIR, 0.01);
        shape(g, '#c9a862', s => { s.moveTo(2, 17); s.lineTo(32, 0); s.lineTo(62, 17); s.quadraticCurveTo(32, 12, 2, 17); s.closePath(); });
        for (const x of [14, 24, 40, 50]) { g.beginPath(); g.moveTo(32, 1); g.lineTo(x, 15); g.strokeStyle = 'rgba(110,80,30,.5)'; g.lineWidth = 0.8; g.stroke(); }
        break;
      case 'hunter':
        shape(g, '#15110c', HAIR, 0.01);
        shape(g, '#15110c', s => { s.moveTo(27, 8); s.quadraticCurveTo(32, -2, 37, 8); s.closePath(); }, 1.2);
        shape(g, '#cdb88e', s => { s.moveTo(34, 4); s.quadraticCurveTo(40, -8, 46, -10); s.quadraticCurveTo(42, -2, 36, 6); s.closePath(); }, 1);
        line(g, 16, 15, 48, 14, L.headColor, 2.6);
        break;
      case 'scholar':
        shape(g, '#15110c', HAIR, 0.01);
        shape(g, L.headColor, s => { s.moveTo(17, 16); s.quadraticCurveTo(16, 1, 32, 1); s.quadraticCurveTo(48, 1, 47, 14); s.quadraticCurveTo(32, 9, 17, 16); s.closePath(); });
        break;
      default:
        shape(g, '#15110c', HAIR, 0.01);
        shape(g, '#15110c', s => { s.moveTo(27, 8); s.quadraticCurveTo(32, -2, 37, 8); s.closePath(); }, 1.2);
    }
  }
  function face(g, L) {
    const round = L.eyes === 'round';
    for (const x of [36, 43]) {
      if (round) { shape(g, '#f3ead6', s => s.arc(x, 23, 2.8, 0, Math.PI * 2), 1.1); g.fillStyle = INK; g.beginPath(); g.arc(x + 0.6, 23, 1.5, 0, Math.PI * 2); g.fill(); }
      else { g.fillStyle = INK; g.beginPath(); g.ellipse(x, 23, 1.5, 2, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 0.5, 22.3, 0.6, 0, Math.PI * 2); g.fill(); }
    }
    g.strokeStyle = INK; g.lineWidth = L.brows === 'silkworm' || L.brows === 'bushy' ? 2 : 1.3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(33.5, 18.5); g.lineTo(38, 19.5); g.moveTo(41, 19.5); g.lineTo(46, 18); g.stroke();
    g.fillStyle = 'rgba(200,80,60,.28)'; g.beginPath(); g.ellipse(46, 28, 2.6, 1.6, 0, 0, Math.PI * 2); g.fill();
    const c = L.beardColor || '#15110c';
    switch (L.beard) {
      case 'long': shape(g, c, s => { s.moveTo(30, 29); s.quadraticCurveTo(40, 33, 47, 29); s.quadraticCurveTo(46, 44, 40, 56); s.quadraticCurveTo(34, 44, 30, 29); s.closePath(); }, 1.2); break;
      case 'tiger':
        shape(g, c, s => { s.moveTo(26, 26); for (let i = 0; i <= 10; i++) { const a = Math.PI * (0.1 + i * 0.75 / 10), r = i % 2 ? 19 : 13; s.lineTo(34 + Math.cos(a) * r, 24 + Math.sin(a) * r); } s.closePath(); }, 1.2);
        shape(g, '#4a1410', s => s.ellipse(41, 31, 3, 2, 0, 0, Math.PI * 2), 1); break;
      case 'short': case 'stubble':
        g.fillStyle = L.beard === 'short' ? c : 'rgba(30,24,18,.35)';
        g.beginPath(); g.moveTo(27, 27); g.quadraticCurveTo(36, 40, 47, 28); g.quadraticCurveTo(38, 33, 27, 27); g.fill(); break;
      case 'goatee': shape(g, c, s => { s.moveTo(39, 33); s.lineTo(41, 42); s.lineTo(43, 33); s.closePath(); }, 0.8); break;
      default:
        g.strokeStyle = '#5a2a20'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(40, 31); g.quadraticCurveTo(43, 32.5, 45, 30.5); g.stroke();
    }
  }

  // ---------- 身体 ----------
  function body(g, L, opt) {
    if (!opt.noLegs) {
      shape(g, '#2a241c', s => rr(s, 22, 58, 8, 15, 3));
      shape(g, '#2a241c', s => rr(s, 34, 58, 8, 15, 3));
      shape(g, '#15110c', s => rr(s, 20, 70, 12, 7, 3));
      shape(g, '#15110c', s => rr(s, 33, 70, 13, 7, 3));
    }
    shape(g, L.robe, s => { s.moveTo(20, 37); s.quadraticCurveTo(32, 32, 44, 37); s.lineTo(49, 62); s.quadraticCurveTo(32, 67, 15, 62); s.closePath(); });
    g.beginPath(); g.moveTo(24, 46); g.quadraticCurveTo(26, 56, 22, 63); g.moveTo(40, 46); g.quadraticCurveTo(38, 56, 42, 63);
    g.strokeStyle = shade(L.robe, -0.4); g.lineWidth = 1; g.stroke();
    if (L.armor) {
      shape(g, L.armorColor, s => { s.moveTo(21, 39); s.quadraticCurveTo(32, 35, 43, 39); s.lineTo(45, 55); s.quadraticCurveTo(32, 58, 19, 55); s.closePath(); });
      for (const y of [44, 49]) { g.beginPath(); g.moveTo(21, y); g.quadraticCurveTo(32, y + 3, 44, y); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 0.9; g.stroke(); }
      shape(g, L.trim || '#c9a046', s => s.arc(32, 46, 3.2, 0, Math.PI * 2), 1.1);
      shape(g, L.armorColor, s => s.ellipse(20, 40, 6.5, 5, -0.3, 0, Math.PI * 2));
      shape(g, L.armorColor, s => s.ellipse(44, 40, 6.5, 5, 0.3, 0, Math.PI * 2));
    } else {
      line(g, 26, 36, 36, 50, L.trim || '#3a2e22', 2.2);
    }
    shape(g, L.trim || '#3a2e22', s => rr(s, 17, 53, 30, 4, 1.5), 1.3);
    if ((L.extras || []).includes('towel')) shape(g, '#e8e0cc', s => { s.moveTo(22, 35); s.quadraticCurveTo(32, 41, 42, 35); s.lineTo(43, 39); s.quadraticCurveTo(32, 45, 21, 39); s.closePath(); }, 1.2);
    if ((L.extras || []).includes('fur')) shape(g, '#8a6a48', s => { s.moveTo(18, 38); s.quadraticCurveTo(32, 30, 46, 38); s.quadraticCurveTo(32, 44, 18, 38); s.closePath(); }, 1.2);
    if (L.weapon === 'bow') { // 背上的箭囊
      shape(g, '#6b4a2e', s => rr(s, 10, 30, 7, 22, 2), 1.3);
      for (const x of [11.5, 14.5]) line(g, x, 30, x - 1, 24, '#ebe0c5', 1.2);
    }
  }

  function horse(g, color) {
    for (const x of [16, 24, 42, 50]) line(g, x, 64, x + (x < 32 ? -2 : 2), 78, shade(color, -0.25), 3);
    shape(g, color, s => s.ellipse(32, 60, 24, 10, 0, 0, Math.PI * 2));
    shape(g, color, s => { s.moveTo(48, 56); s.quadraticCurveTo(56, 44, 58, 38); s.lineTo(64, 42); s.quadraticCurveTo(60, 50, 54, 62); s.closePath(); });
    shape(g, color, s => s.ellipse(61, 41, 6, 4, 0.4, 0, Math.PI * 2));
    shape(g, '#15110c', s => { s.moveTo(9, 56); s.quadraticCurveTo(2, 62, 4, 72); s.quadraticCurveTo(8, 64, 12, 60); s.closePath(); }, 1.2);
    shape(g, '#7a1d14', s => rr(s, 22, 50, 20, 6, 2), 1.2); // 鞍
  }

  // 画一个朝右的 Q 版小人；opt.mount 画在马上
  function draw(g, L, opt = {}) {
    g.lineJoin = 'round';
    if (opt.mount) {
      horse(g, opt.mount);
      g.save(); g.translate(8, 8); g.scale(0.72, 0.72);
      drawRider(g, L, { noLegs: true });
      g.restore();
      return;
    }
    drawRider(g, L, opt);
  }
  function drawRider(g, L, opt) {
    headBack(g, L);
    body(g, L, opt);
    shape(g, L.skin, s => s.arc(32, 22, 16, 0, Math.PI * 2), 2);
    g.fillStyle = 'rgba(0,0,0,.08)'; g.beginPath(); g.arc(30, 25, 13, Math.PI * 0.6, Math.PI * 1.4); g.fill();
    face(g, L);
    headgear(g, L);
    weapon(g, L);
  }

  // ---------- 据点建筑（没有美术图时用） ----------
  // 画布宽 120、高 110，地面在 y = 104，建筑正面朝向画面下方
  const BLD_W = 120, BLD_H = 110;
  const roof = (g, x, y, w, h, color) => shape(g, color, s => { s.moveTo(x - 6, y + h); s.lineTo(x + w / 2, y); s.lineTo(x + w + 6, y + h); s.closePath(); });
  function wallBlock(g, x, y, w, h, color) {
    shape(g, color, s => rr(s, x, y, w, h, 2));
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1;
    for (let yy = y + 8; yy < y + h; yy += 8) { g.beginPath(); g.moveTo(x + 1, yy); g.lineTo(x + w - 1, yy); g.stroke(); }
  }
  function flag(g, x, y, color) {
    line(g, x, y, x, y - 30, '#4a3423', 2);
    shape(g, color, s => { s.moveTo(x, y - 30); s.lineTo(x + 18, y - 26); s.lineTo(x, y - 20); s.closePath(); }, 1.2);
  }
  function building(g, id) {
    g.lineJoin = 'round';
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(60, 102, 54, 10, 0, 0, Math.PI * 2); g.fill();
    switch (id) {
      case 'camp': // 营寨：木栅栏 + 两顶帐篷
        for (let x = 10; x <= 106; x += 8) shape(g, '#7a5a3a', s => { s.moveTo(x, 104); s.lineTo(x, 78); s.lineTo(x + 3, 72); s.lineTo(x + 6, 78); s.lineTo(x + 6, 104); s.closePath(); }, 1.2);
        shape(g, '#b8a27a', s => { s.moveTo(18, 80); s.lineTo(42, 40); s.lineTo(66, 80); s.closePath(); });
        shape(g, '#a8322a', s => { s.moveTo(54, 82); s.lineTo(80, 34); s.lineTo(106, 82); s.closePath(); });
        shape(g, '#2a1a10', s => { s.moveTo(74, 82); s.lineTo(80, 62); s.lineTo(86, 82); s.closePath(); }, 1.2);
        flag(g, 80, 34, '#2b2622');
        break;
      case 'tower': // 箭楼：高木塔 + 瞭望台
        line(g, 38, 104, 46, 40, '#5a3e26', 5); line(g, 82, 104, 74, 40, '#5a3e26', 5);
        line(g, 40, 88, 80, 68, '#6b4a2e', 2.6); line(g, 80, 88, 40, 68, '#6b4a2e', 2.6);
        wallBlock(g, 36, 30, 48, 18, '#7a5a3a');
        roof(g, 32, 10, 56, 20, '#3a2a1e');
        for (const x of [44, 58, 72]) shape(g, '#15110c', s => rr(s, x, 35, 5, 7, 1), 0.8);
        flag(g, 60, 10, '#b5372a');
        break;
      case 'granary': // 粮仓：圆仓 + 草顶
        wallBlock(g, 22, 54, 76, 50, '#b89a6a');
        shape(g, '#c9a862', s => { s.moveTo(14, 58); s.quadraticCurveTo(60, 8, 106, 58); s.closePath(); });
        for (const x of [30, 46, 60, 74, 90]) { g.beginPath(); g.moveTo(60, 16); g.lineTo(x, 56); g.strokeStyle = 'rgba(110,80,30,.45)'; g.lineWidth = 1; g.stroke(); }
        shape(g, '#5a3e26', s => rr(s, 50, 74, 20, 30, 2));
        shape(g, '#e8d8a8', s => { s.ellipse(96, 96, 9, 6, 0, 0, Math.PI * 2); }, 1.2); // 粮袋
        break;
      case 'stable': // 马厩：长屋 + 栏杆
        wallBlock(g, 12, 58, 96, 46, '#8a6a48');
        roof(g, 8, 30, 104, 30, '#5a3e26');
        for (const x of [24, 48, 72, 96]) shape(g, '#2a1a10', s => rr(s, x - 7, 70, 14, 34, 2), 1);
        line(g, 4, 92, 116, 92, '#6b4a2e', 2.4);
        shape(g, '#c9a862', s => s.ellipse(14, 100, 10, 5, 0, 0, Math.PI * 2), 1);
        break;
      case 'forge': // 铁匠铺：小屋 + 烟囱 + 铁砧
        wallBlock(g, 20, 52, 70, 52, '#7a6a5a');
        roof(g, 16, 26, 78, 28, '#4a3a30');
        shape(g, '#5a5048', s => rr(s, 76, 12, 12, 30, 2));
        shape(g, '#ff8a3a', s => rr(s, 40, 72, 22, 20, 3), 1.2);
        shape(g, '#3a3a3e', s => { s.moveTo(92, 92); s.lineTo(112, 92); s.lineTo(108, 98); s.lineTo(104, 98); s.lineTo(104, 104); s.lineTo(100, 104); s.lineTo(100, 98); s.lineTo(96, 98); s.closePath(); }, 1.2);
        break;
      case 'shrine': // 神祠：台基 + 双层檐
        shape(g, '#8a8070', s => rr(s, 16, 88, 88, 16, 2));
        wallBlock(g, 34, 52, 52, 36, '#a8322a');
        roof(g, 22, 34, 76, 20, '#2a3a3a');
        roof(g, 34, 12, 52, 20, '#2a3a3a');
        shape(g, '#c9a046', s => rr(s, 52, 60, 16, 22, 2), 1.2);
        shape(g, '#e0c040', s => s.arc(60, 8, 3.5, 0, Math.PI * 2), 1);
        break;
    }
  }

  // ---------- 铁蒺藜（俯视，带金属高光） ----------
  function caltrop(g, x, y, s, rot) {
    g.save(); g.translate(x, y); g.rotate(rot);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(1.5, 2, s * 0.9, s * 0.5, 0, 0, Math.PI * 2); g.fill();
    // 四根粗尖刺，一半亮面一半暗面，像立体的铁蒺藜
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + (i % 2 ? 0.2 : 0), b = 0.62;
      const tip = [Math.cos(a) * s, Math.sin(a) * s];
      const l = [Math.cos(a + b) * s * 0.34, Math.sin(a + b) * s * 0.34], r = [Math.cos(a - b) * s * 0.34, Math.sin(a - b) * s * 0.34];
      g.beginPath(); g.moveTo(0, 0); g.lineTo(l[0], l[1]); g.lineTo(tip[0], tip[1]); g.closePath();
      g.fillStyle = '#d4d8dc'; g.fill();
      g.beginPath(); g.moveTo(0, 0); g.lineTo(r[0], r[1]); g.lineTo(tip[0], tip[1]); g.closePath();
      g.fillStyle = '#6d7278'; g.fill();
      g.beginPath(); g.moveTo(l[0], l[1]); g.lineTo(tip[0], tip[1]); g.lineTo(r[0], r[1]);
      g.strokeStyle = INK; g.lineWidth = Math.max(1, s * 0.09); g.lineJoin = 'round'; g.stroke();
    }
    g.fillStyle = '#4a4e54'; g.beginPath(); g.arc(0, 0, s * 0.24, 0, Math.PI * 2); g.fill();
    g.strokeStyle = INK; g.lineWidth = Math.max(1, s * 0.08); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(-s * 0.07, -s * 0.07, s * 0.08, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  return { draw, horse, building, caltrop, BOX_W, BOX_H, BLD_W, BLD_H };
})();
