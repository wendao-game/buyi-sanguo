// 布衣三国 · 立绘
// 优先使用 assets 文件夹里的美术图（见 assets.js）；没有时用 SVG 程序绘制的水墨风半身像。
// 外形参数写在 data.js 的 generals[id].look 和 origins[i].look 里。
window.Portrait = (() => {
  const INK = '#1a140e';
  let uid = 0;

  // 颜色加深 / 提亮：f < 0 变暗，f > 0 变亮
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const ch = s => { const c = (n >> s) & 255; return Math.round(f < 0 ? c * (1 + f) : c + (255 - c) * f); };
    return '#' + [16, 8, 0].map(s => ch(s).toString(16).padStart(2, '0')).join('');
  }
  const mirror = d => `<g transform="translate(240 0) scale(-1 1)">${d}</g>`;
  const stroke = (d, color, w, extra = '') => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
  const fill = (d, color, sw = 2.2, extra = '') => `<path d="${d}" fill="${color}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round" ${extra}/>`;
  const has = (L, x) => (L.extras || []).includes(x);

  // ---------- 兵器（画在身后） ----------
  function weaponHead(kind, L) {
    const steel = '#dfe3e6';
    switch (kind) {
      case 'spear':
        return fill('M0 -8 L40 0 L0 8 Q-4 0 0 -8 Z', steel) + stroke('M2 0 L34 0', '#9aa4ab', 1.2) +
          fill('M-4 -10 Q-22 -16 -30 -4 Q-20 -6 -14 0 Q-20 6 -30 4 Q-22 16 -4 10 Z', L.plume || '#b5372a', 1.5);
      case 'snake':
        return fill('M0 -6 Q10 -14 18 -5 Q26 4 46 0 Q26 9 18 5 Q10 -2 0 6 Z', steel) +
          fill('M-4 -9 Q-20 -14 -26 -3 Q-16 0 -26 3 Q-20 14 -4 9 Z', '#2b2622', 1.5);
      case 'guandao':
        return fill('M-14 -7 L26 -12 Q58 -6 52 26 Q42 6 -14 7 Z', steel) + stroke('M0 -4 Q30 -6 44 14', '#5f9e86', 1.6) +
          `<circle cx="-18" cy="0" r="8" fill="#c9a046" stroke="${INK}" stroke-width="2"/>` +
          fill('M-26 -6 Q-40 -12 -46 0 Q-40 12 -26 6 Z', '#2f6b4a', 1.5);
      case 'ji':
        return fill('M0 -5 L42 0 L0 5 Z', steel) +
          fill('M6 -5 Q14 -30 -8 -34 Q2 -20 -6 -5 Z', steel) +
          fill('M6 5 Q14 30 -8 34 Q2 20 -6 5 Z', steel) +
          fill('M-12 -6 Q-28 -12 -32 0 Q-28 12 -12 6 Z', '#b5372a', 1.5);
      case 'dao':
        return fill('M-8 -6 L36 -12 Q54 -2 44 12 L-8 6 Z', steel) + stroke('M0 -2 L38 -6', '#9aa4ab', 1.2) +
          `<rect x="-14" y="-9" width="7" height="18" fill="#7a5a2a" stroke="${INK}" stroke-width="1.5"/>`;
      case 'axe': // 开山斧：宽大的弧形斧刃
        return fill('M-6 -6 L14 -10 Q40 -26 46 6 Q40 36 14 22 L-6 8 Z', steel) + stroke('M16 -6 Q36 -14 40 6', '#9aa4ab', 1.4);
      case 'staff': // 九节杖：杖头金环
        return `<circle cx="10" cy="0" r="13" fill="none" stroke="${INK}" stroke-width="7"/><circle cx="10" cy="0" r="13" fill="none" stroke="#e0c040" stroke-width="4"/>` +
          `<circle cx="10" cy="0" r="5" fill="#fff0a0" stroke="${INK}" stroke-width="1.5"/>`;
      case 'sword':
        return fill('M-4 -4 L58 -3 L66 0 L58 3 L-4 4 Z', '#e8eef2', 1.8) + `<rect x="-12" y="-10" width="6" height="20" fill="#c9a046" stroke="${INK}" stroke-width="1.5"/>`;
      case 'hoe': // 锄头：刃与木柄垂直
        return `<rect x="-6" y="-7" width="12" height="14" rx="3" fill="#5a5048" stroke="${INK}" stroke-width="1.8"/>` +
          fill('M-5 6 L5 6 L12 40 Q0 46 -10 40 Z', '#7f8488', 2) + stroke('M-6 34 Q0 38 9 34', '#6b4a2e', 2, 'opacity=".6"');
      default: return '';
    }
  }
  function weapon(L) {
    switch (L.weapon) {
      case 'fan': case 'scrolls': return '';
      case 'twinji': {
        const one = (x1, y1, x2, y2, rot) =>
          stroke(`M${x1} ${y1} L${x2} ${y2}`, INK, 10) + stroke(`M${x1} ${y1} L${x2} ${y2}`, '#4a3423', 6) +
          `<g transform="translate(${x2} ${y2}) rotate(${rot}) scale(.85)">${weaponHead('ji', L)}</g>`;
        return one(60, 290, 176, 60, -63) + one(180, 290, 64, 60, -117);
      }
      case 'bow': { // 长弓斜背在左后方，箭囊在右肩
        let s = stroke('M58 52 Q-6 168 62 292', INK, 10) + stroke('M58 52 Q-6 168 62 292', '#7a4e2a', 6);
        s += stroke('M58 52 L62 292', '#e8dcc0', 1.4);
        s += stroke('M38 160 L46 176', '#c9a046', 4);
        s += `<g transform="translate(176 200) rotate(24)">` +
          fill('M-14 -96 L14 -96 L12 30 L-12 30 Z', '#6b4a2e', 2) + stroke('M-13 -60 L13 -60 M-12 -10 L12 -10', '#3a2a1a', 2) +
          [-8, 0, 8].map((x, i) => stroke(`M${x} -96 L${x} -122`, '#5b3a22', 2.5) +
            fill(`M${x - 5} -122 L${x} -134 L${x + 5} -122 L${x} -116 Z`, i === 1 ? '#b5372a' : '#ebe0c5', 1.2)).join('') +
          '</g>';
        return s;
      }
      default:
        return stroke('M40 300 L196 34', INK, 11) + stroke('M40 300 L196 34', L.weapon === 'hoe' ? '#8a6038' : '#5b3a22', 7) +
          `<g transform="translate(196 34) rotate(-60)">${weaponHead(L.weapon, L)}</g>`;
    }
  }

  // ---------- 身体 ----------
  function body(L, k) {
    const robePath = 'M24 300 C32 236 70 196 120 190 C170 196 208 236 216 300 Z';
    let s = `<path d="${robePath}" fill="url(#robe${k})" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`;
    // 衣褶
    s += stroke('M66 236 Q76 268 70 300', shade(L.robe, -0.45), 2, 'opacity=".45"') + stroke('M174 236 Q164 268 170 300', shade(L.robe, -0.45), 2, 'opacity=".45"');
    s += stroke('M92 258 Q98 280 94 300', shade(L.robe, -0.45), 1.5, 'opacity=".35"') + stroke('M148 258 Q142 280 146 300', shade(L.robe, -0.45), 1.5, 'opacity=".35"');
    if (L.armor) {
      const scales = cx => [0, 9, 18].map(o => stroke(`M${cx - 34} ${214 + o} Q${cx} ${232 + o} ${cx + 34} ${214 + o}`, INK, 1.2, 'opacity=".45"')).join('');
      s += fill('M84 204 L156 204 L164 300 L76 300 Z', L.armorColor, 2.2);
      for (let y = 222; y < 300; y += 12) {
        const x0 = 80 + (y - 204) * 0.05, x1 = 160 - (y - 204) * 0.05;
        s += stroke(`M${x0} ${y} L${x1} ${y}`, INK, 1, 'opacity=".35"');
        for (let x = x0 + 8; x < x1 - 4; x += 12) s += stroke(`M${x} ${y} Q${x + 6} ${y + 7} ${x + 12} ${y}`, INK, 0.8, 'opacity=".25"');
      }
      s += `<circle cx="120" cy="248" r="16" fill="${L.trim}" stroke="${INK}" stroke-width="2"/><circle cx="120" cy="248" r="10" fill="none" stroke="${INK}" stroke-width="1" opacity=".4"/><circle cx="115" cy="243" r="5" fill="#fff" opacity=".35"/>`;
      s += fill('M28 228 Q30 196 66 196 Q100 198 104 222 Q70 240 28 228 Z', L.armorColor, 2.2) + scales(66);
      s += mirror(fill('M28 228 Q30 196 66 196 Q100 198 104 222 Q70 240 28 228 Z', L.armorColor, 2.2) + scales(66));
    } else {
      s += stroke('M96 190 L124 252', INK, 12) + stroke('M96 190 L124 252', L.trim, 8);
      s += stroke('M144 190 L112 246', INK, 12) + stroke('M144 190 L112 246', L.trim, 8);
    }
    if (has(L, 'patches')) { // 补丁
      for (const [x, y, w, h, r] of [[50, 250, 26, 22, -8], [150, 268, 24, 20, 6]]) {
        s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" transform="rotate(${r} ${x + w / 2} ${y + h / 2})" fill="${shade(L.robe, 0.22)}" stroke="${INK}" stroke-width="1.4"/>`;
        s += `<rect x="${x + 3}" y="${y + 3}" width="${w - 6}" height="${h - 6}" transform="rotate(${r} ${x + w / 2} ${y + h / 2})" fill="none" stroke="${INK}" stroke-width="0.9" stroke-dasharray="2 2.5" opacity=".6"/>`;
      }
    }
    if (has(L, 'sash')) s += fill('M78 262 Q120 272 162 262 L164 276 Q120 286 76 276 Z', L.trim, 1.8) + fill('M112 274 L106 300 L116 300 L120 278 Z', L.trim, 1.4);
    if (has(L, 'fur')) { // 兽皮领
      let d = 'M60 214 ';
      for (let i = 0; i <= 14; i++) { const x = 60 + i * 8.6, y = 204 - Math.sin(i / 14 * Math.PI) * 14; d += `Q${x - 2} ${y + (i % 2 ? 12 : 4)} ${x + 4} ${y} `; }
      s += fill(d + 'L180 222 Q120 236 60 222 Z', '#8a6a48', 1.8);
      s += stroke('M76 214 L80 222 M96 208 L99 218 M140 208 L141 218 M162 214 L160 222', '#5a4430', 1.2, 'opacity=".7"');
    }
    s += fill('M106 148 L106 188 Q120 198 134 188 L134 148 Z', L.skinShade, 2);
    s += `<path d="M106 156 Q120 166 134 156 L134 168 Q120 176 106 168 Z" fill="${shade(L.skinShade, -0.25)}" opacity=".5"/>`;
    if (has(L, 'towel')) s += fill('M98 184 Q120 200 142 184 L148 196 Q120 214 92 196 Z', '#e8e0cc', 1.8) + fill('M138 194 L146 228 L136 226 L132 198 Z', '#e8e0cc', 1.4);
    return s;
  }

  // ---------- 头部 ----------
  function eyes(L) {
    switch (L.eyes) {
      case 'phoenix': {
        const e = fill('M96 118 Q106 111 117 113 Q107 119 96 118 Z', '#f3ead6', 1.4) + `<circle cx="108" cy="115.5" r="2.2" fill="${INK}"/>` + stroke('M95 117 Q106 109 118 112', INK, 2.2);
        return e + mirror(e);
      }
      case 'round': {
        const e = `<circle cx="106" cy="116" r="7" fill="#f3ead6" stroke="${INK}" stroke-width="2.2"/><circle cx="107" cy="116" r="3.8" fill="${INK}"/><circle cx="108.5" cy="114.5" r="1.2" fill="#fff"/>`;
        return e + mirror(e);
      }
      case 'calm': {
        const e = stroke('M98 116 Q106 111 114 116', INK, 2) + `<circle cx="106" cy="116" r="2" fill="${INK}"/>` + stroke('M100 119 Q106 121 112 119', INK, 0.8, 'opacity=".5"');
        return e + mirror(e);
      }
      default: {
        const e = fill('M97 116 Q106 110 115 116 Q106 120 97 116 Z', '#f3ead6', 1.4) + `<circle cx="106" cy="115.6" r="2.6" fill="${INK}"/><circle cx="107" cy="114.8" r=".8" fill="#fff"/>` + stroke('M96 116 Q106 109 116 115', INK, 2);
        return e + mirror(e);
      }
    }
  }
  function brows(L) {
    const map = {
      silkworm: stroke('M93 108 Q104 97 118 105', INK, 5.5),
      bushy: stroke('M93 103 L98 107 L102 101 L107 107 L112 102 L118 107', INK, 4.2),
      thin: stroke('M98 106 Q106 103 115 106', INK, 2.2),
      sharp: stroke('M95 103 L117 107', INK, 4),
    };
    const b = map[L.brows] || map.sharp;
    return b + mirror(b);
  }
  function beard(L) {
    const c = L.beardColor || '#15110c';
    switch (L.beard) {
      case 'long': {
        let s = stroke('M90 118 Q92 140 101 147', c, 6) + stroke('M150 118 Q148 140 139 147', c, 6);
        s += fill('M97 142 Q99 172 107 202 Q114 238 120 256 Q126 238 133 202 Q141 172 143 142 Q131 152 120 150 Q109 152 97 142 Z', c, 1.8);
        for (const x of [108, 114, 120, 126, 132]) s += stroke(`M${x} 156 Q${x + (120 - x) * 0.3} 200 ${120 + (x - 120) * 0.2} 240`, '#4a4038', 1, 'opacity=".6"');
        s += fill('M100 136 Q111 131 120 136 Q129 131 140 136 Q131 142 120 139 Q109 142 100 136 Z', c, 1.4);
        return s;
      }
      case 'tiger': {
        let pts = '';
        for (let i = 0; i <= 16; i++) {
          const a = Math.PI * (0.08 + i * 0.84 / 16);
          const r = i % 2 ? 50 : 30;
          pts += `${i ? 'L' : 'M'}${(120 + Math.cos(a) * r * 0.95).toFixed(1)} ${(124 + Math.sin(a) * r).toFixed(1)} `;
        }
        return fill(pts + 'Z', c, 1.6) +
          fill('M98 134 Q110 128 120 134 Q130 128 142 134 Q132 140 120 137 Q108 140 98 134 Z', c, 1.4) +
          `<ellipse cx="120" cy="143" rx="8" ry="5" fill="#4a1410" stroke="${INK}" stroke-width="1.6"/>`;
      }
      case 'short':
        return fill('M93 126 Q95 157 120 161 Q145 157 147 126 Q140 147 120 149 Q100 147 93 126 Z', c, 1.4, 'opacity=".9"') +
          fill('M104 136 Q112 132 120 135 Q128 132 136 136 Q128 139 120 138 Q112 139 104 136 Z', c, 1.2);
      case 'stubble': // 胡茬
        return `<path d="M94 128 Q96 156 120 160 Q144 156 146 128 Q140 146 120 148 Q100 146 94 128 Z" fill="${c}" opacity=".35"/>` +
          stroke('M106 137 Q113 134 120 136 Q127 134 134 137', c, 2, 'opacity=".6"');
      case 'goatee':
        return stroke('M107 138 Q113 134 119 137', c, 2.2) + stroke('M133 138 Q127 134 121 137', c, 2.2) +
          fill('M115 151 Q119 172 117 186 Q124 172 125 151 Z', c, 1.2);
      default: return '';
    }
  }
  function headgearBack(L) {
    if (L.head === 'pheasant') {
      const f = fill('M104 74 C86 30 56 4 8 14 C30 4 58 4 78 18 C96 32 108 52 114 72 Z', '#c9a046', 2) +
        stroke('M108 70 C92 34 64 12 14 12', '#5a3014', 3.5, 'stroke-dasharray="6 7"');
      return f + mirror(f);
    }
    if (L.head === 'hood') return fill('M148 78 Q178 92 172 138 Q162 112 148 98 Z', L.headColor, 2);
    if (L.head === 'lunjin') return stroke('M142 70 Q172 104 162 156', INK, 9) + stroke('M142 70 Q172 104 162 156', L.headColor, 6);
    if (L.head === 'band') return stroke('M150 98 Q170 106 174 130', INK, 8) + stroke('M150 98 Q170 106 174 130', L.bandColor || '#a8322a', 5);
    if (L.head === 'scholar') { // 方巾的两条巾带垂在脑后
      const r = d => stroke(d, INK, 8) + stroke(d, L.headColor, 5);
      return r('M136 78 Q166 110 158 168') + r('M104 78 Q74 110 82 168');
    }
    if (L.head === 'hunter') return stroke('M148 100 Q168 110 166 140', INK, 7) + stroke('M148 100 Q168 110 166 140', L.headColor, 4.5);
    return '';
  }
  const HAIR = 'M89 114 C85 80 104 70 120 70 C136 70 155 80 151 114 C146 96 134 90 120 92 C106 90 94 96 89 114 Z';
  const hairStrands = stroke('M92 104 Q94 116 93 124', '#15110c', 2) + stroke('M148 104 Q146 116 147 124', '#15110c', 2);
  function headgear(L) {
    switch (L.head) {
      case 'hood':
        return fill('M83 110 C78 72 103 56 120 56 C141 56 164 72 157 110 C150 94 136 88 120 90 C104 88 90 94 83 110 Z', L.headColor, 2.2) +
          stroke('M96 64 Q104 80 100 96', shade(L.headColor, -0.4), 1.5, 'opacity=".5"') + stroke('M140 62 Q138 80 142 96', shade(L.headColor, -0.4), 1.5, 'opacity=".5"') +
          stroke('M86 101 Q120 86 154 101', L.trim, 5);
      case 'helmet':
        return fill('M83 108 C81 64 159 64 157 108 Q120 95 83 108 Z', L.headColor, 2.2) +
          `<path d="M96 76 Q104 70 112 70" fill="none" stroke="#fff" stroke-width="3" opacity=".3" stroke-linecap="round"/>` +
          fill('M81 106 Q120 92 159 106 L159 113 Q120 100 81 113 Z', L.trim, 1.8) +
          fill('M83 110 L86 142 L95 140 L94 112 Z', L.headColor, 1.8) + mirror(fill('M83 110 L86 142 L95 140 L94 112 Z', L.headColor, 1.8)) +
          fill('M115 70 L120 44 L125 70 Z', L.trim, 1.6) +
          (L.plume ? fill('M120 48 Q104 30 90 42 Q104 38 110 50 Q96 40 88 58 Q106 46 120 54 Z', L.plume, 1.4) : '');
      case 'pheasant':
        return fill(HAIR, '#15110c', 0) + hairStrands +
          fill('M102 84 L106 62 L113 76 L120 54 L127 76 L134 62 L138 84 Q120 91 102 84 Z', '#c9a046', 2) +
          `<circle cx="120" cy="77" r="3.5" fill="#b5372a" stroke="${INK}" stroke-width="1.2"/>`;
      case 'lunjin':
        return fill(HAIR, '#15110c', 0) +
          fill('M92 98 L95 58 Q120 48 145 58 L148 98 Q120 89 92 98 Z', L.headColor, 2.2) +
          stroke('M108 56 L106 94', INK, 1, 'opacity=".5"') + stroke('M132 56 L134 94', INK, 1, 'opacity=".5"') +
          stroke('M94 92 Q120 84 146 92', L.trim, 3);
      case 'band': {
        let pts = 'M88 112 ';
        for (let i = 0; i <= 12; i++) {
          const a = Math.PI * (1.05 + i * 0.9 / 12), r = i % 2 ? 50 : 38;
          pts += `L${(120 + Math.cos(a) * r).toFixed(1)} ${(108 + Math.sin(a) * r).toFixed(1)} `;
        }
        return fill(pts + 'L152 112 Z', '#15110c', 1.6) + stroke('M88 100 Q120 88 152 100', INK, 9) + stroke('M88 100 Q120 88 152 100', L.bandColor || '#a8322a', 6);
      }
      case 'straw': { // 竹编斗笠
        let s = fill(HAIR, '#15110c', 0) + hairStrands;
        s += stroke('M94 104 Q100 140 112 162', '#6b5a3a', 1.4) + stroke('M146 104 Q140 140 128 162', '#6b5a3a', 1.4);
        s += fill('M26 106 L120 34 L214 106 Q120 92 26 106 Z', '#c9a862', 2.4);
        for (let i = 0; i <= 10; i++) { const x = 26 + i * 18.8; s += stroke(`M120 36 L${x} ${106 - Math.sin(i / 10 * Math.PI) * 13}`, '#8a6d34', 1, 'opacity=".55"'); }
        for (const t of [0.35, 0.65]) s += stroke(`M${120 - 94 * t} ${34 + 72 * t} Q120 ${34 + 60 * t} ${120 + 94 * t} ${34 + 72 * t}`, '#8a6d34', 1.2, 'opacity=".6"');
        s += `<path d="M26 106 Q120 118 214 106 Q120 98 26 106 Z" fill="#7a6232" stroke="${INK}" stroke-width="1.6"/>`;
        s += `<circle cx="120" cy="36" r="4" fill="#8a6d34" stroke="${INK}" stroke-width="1.4"/>`;
        return s;
      }
      case 'scholar': // 软方巾
        return fill(HAIR, '#15110c', 0) + hairStrands +
          fill('M90 100 C88 70 100 56 120 56 C140 56 152 70 150 100 Q120 90 90 100 Z', L.headColor, 2.2) +
          stroke('M120 58 L120 92', shade(L.headColor, 0.25), 1.5, 'opacity=".6"') +
          stroke('M98 70 Q108 64 118 62', shade(L.headColor, 0.3), 1.5, 'opacity=".4"');
      case 'hunter': // 发髻 + 额带 + 鹰羽
        return fill(HAIR, '#15110c', 0) + hairStrands +
          fill('M108 74 Q120 50 132 74 Z', '#15110c', 1.5) +
          fill('M126 66 Q140 30 156 14 Q148 36 134 70 Z', '#cdb88e', 1.6) + stroke('M130 64 Q142 38 154 18', '#6b5636', 1, 'stroke-dasharray="4 4"') +
          stroke('M89 101 Q120 90 151 101', INK, 8) + stroke('M89 101 Q120 90 151 101', L.headColor, 5);
      default:
        return fill(HAIR, '#15110c', 0) + hairStrands + fill('M110 72 Q120 52 130 72 Z', '#15110c', 1.5);
    }
  }
  function head(L, k) {
    let s = headgearBack(L);
    s += `<ellipse cx="90" cy="122" rx="6" ry="10" fill="${L.skinShade}" stroke="${INK}" stroke-width="2"/><ellipse cx="150" cy="122" rx="6" ry="10" fill="${L.skinShade}" stroke="${INK}" stroke-width="2"/>`;
    s += `<path d="M90 112 C90 84 150 84 150 112 C150 140 137 159 120 159 C103 159 90 140 90 112 Z" fill="url(#skin${k})" stroke="${INK}" stroke-width="2.5"/>`;
    // 面部阴影：颧骨、眼窝、下颌
    s += `<ellipse cx="99" cy="133" rx="7" ry="5" fill="${L.skinShade}" opacity=".45"/><ellipse cx="141" cy="133" rx="7" ry="5" fill="${L.skinShade}" opacity=".45"/>`;
    s += `<path d="M98 150 Q120 164 142 150 Q132 160 120 160 Q108 160 98 150 Z" fill="${shade(L.skinShade, -0.2)}" opacity=".4"/>`;
    if (L.scar) s += stroke('M134 124 L142 136', '#7a2a20', 1.6);
    s += brows(L) + eyes(L);
    s += stroke('M120 114 Q117 126 115 129 Q120 132 125 129', INK, 1.6) + `<ellipse cx="121" cy="125" rx="2.5" ry="6" fill="${L.skinShade}" opacity=".35"/>`;
    if (L.beard !== 'tiger') s += stroke('M112 142 Q120 145 128 142', '#5a2a20', 1.8);
    s += beard(L) + headgear(L);
    return s;
  }
  function front(L) {
    if (L.weapon === 'fan') {
      let s = stroke('M152 300 L170 238', INK, 9) + stroke('M152 300 L170 238', '#7a5a2a', 5);
      s += '<g transform="translate(172 230)">';
      for (let i = -3; i <= 3; i++) s += `<ellipse cx="0" cy="-34" rx="10" ry="34" transform="rotate(${i * 17})" fill="#f4f1e8" stroke="${INK}" stroke-width="1.3"/>` + stroke('M0 -4 L0 -62', '#c9c2b0', 0.8, `transform="rotate(${i * 17})"`);
      return s + `<circle cx="0" cy="0" r="7" fill="#2c3440" stroke="${INK}" stroke-width="1.5"/></g>`;
    }
    if (L.weapon === 'scrolls') { // 怀抱一捆竹简
      let s = '<g transform="translate(150 246) rotate(-22)">';
      for (let i = 0; i < 7; i++) s += `<rect x="${-26 + i * 7.4}" y="-40" width="7" height="80" rx="1.5" fill="${i % 2 ? '#d6bd84' : '#ccb072'}" stroke="${INK}" stroke-width="1.2"/>`;
      for (const y of [-20, 20]) s += stroke(`M-28 ${y} L28 ${y}`, '#6b4a2e', 2.6);
      for (let i = 0; i < 5; i++) s += stroke(`M${-18 + i * 7.4} -32 L${-18 + i * 7.4} -24 M${-18 + i * 7.4} -8 L${-18 + i * 7.4} 4`, INK, 1, 'opacity=".45"');
      s += '</g>';
      s += fill('M118 262 Q134 252 152 262 Q150 278 130 280 Q118 276 118 262 Z', '#efd6b4', 1.8); // 手
      return s;
    }
    return '';
  }

  // look: 外形参数；opt.crop 只画头部（用于头像）
  function render(look, name, opt = {}) {
    const L = look, k = 'p' + (uid++), crop = !!opt.crop;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${crop ? '66 50 108 108' : '0 0 240 300'}" role="img" aria-label="${name}立绘">`;
    s += `<defs><radialGradient id="skin${k}" cx="45%" cy="40%" r="65%"><stop offset="0" stop-color="${L.skin}"/><stop offset="1" stop-color="${L.skinShade}"/></radialGradient>` +
      `<linearGradient id="robe${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(L.robe, 0.12)}"/><stop offset="1" stop-color="${shade(L.robe, -0.3)}"/></linearGradient></defs>`;
    if (crop) s += `<rect x="0" y="0" width="240" height="300" fill="${L.aura}"/>`;
    else {
      // 水墨晕染背景
      s += `<circle cx="120" cy="124" r="104" fill="${L.aura}" opacity=".22"/>`;
      s += `<circle cx="84" cy="96" r="62" fill="${L.aura}" opacity=".14"/><circle cx="168" cy="160" r="54" fill="${shade(L.aura, -0.3)}" opacity=".16"/>`;
      s += `<circle cx="120" cy="124" r="108" fill="none" stroke="${L.aura}" stroke-width="5" stroke-dasharray="190 26 70 18" opacity=".6"/>`;
      for (const [x, y, r] of [[30, 70, 3], [214, 92, 2.5], [208, 210, 4], [26, 196, 2]]) s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${L.aura}" opacity=".5"/>`;
      s += weapon(L);
    }
    s += body(L, k) + head(L, k);
    if (!crop) s += front(L);
    return s + '</svg>';
  }

  const D = () => window.GAME_DATA;
  const originOf = id => D().origins.find(o => o.id === id);
  const defOfKind = (kind, id) => kind === 'origin' ? originOf(id) : kind === 'elite' ? D().enemies[id] : D().generals[id];
  const lookOf = (kind, id) => defOfKind(kind, id).look;
  // 美术立绘的头像区域：look.artFace = [脸中心 x（占宽度比例）, 脸中心 y（占高度比例）, 裁切边长（占宽度比例）]
  const artFace = (kind, id) => lookOf(kind, id).artFace || [0.5, 0.24, 0.4];
  const art = (kind, id) => window.Assets && window.Assets.get((kind === 'origin' ? 'origin:' : kind === 'elite' ? 'elite:' : 'portrait:') + id);
  const codeSvg = (kind, id, opt) => {
    const d = defOfKind(kind, id);
    return render(d.look, d.name, opt);
  };

  // 头像图片缓存（给画布用）
  const faceCache = {};
  function face(kind, id) {
    const a = art(kind, id);
    if (a) { // 美术立绘：按 artFace 裁出脸部
      const [cx, cy, s] = artFace(kind, id), sw = a.naturalWidth * s;
      return { img: a, sx: cx * a.naturalWidth - sw / 2, sy: cy * a.naturalHeight - sw / 2, sw, sh: sw, key: 'a' };
    }
    const ck = kind + ':' + id;
    let img = faceCache[ck];
    if (!img) {
      img = faceCache[ck] = new Image();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(codeSvg(kind, id, { crop: true }));
    }
    if (!img.complete || !img.naturalWidth) return null;
    return { img, sx: 0, sy: 0, sw: img.naturalWidth, sh: img.naturalHeight, key: 'c' };
  }

  return {
    // 页面里显示用：有美术图返回 <img>，没有返回 SVG
    html(kind, id, opt = {}) {
      const a = art(kind, id);
      if (a && opt.crop) { // 在正方形容器里只露出脸部
        const [cx, cy, s] = artFace(kind, id), ratio = a.naturalHeight / a.naturalWidth;
        const left = -(cx - s / 2) / s * 100, top = -(cy * ratio - s / 2) / s * 100;
        return `<img class="art-face" src="${a.src}" alt="" style="width:${(100 / s).toFixed(2)}%;left:${left.toFixed(2)}%;top:${top.toFixed(2)}%">`;
      }
      if (a) return `<img class="art-full" src="${a.src}" alt="">`;
      return codeSvg(kind, id, opt);
    },
    svg: (id, opt) => codeSvg('general', id, opt),
    // 立绘图片地址（有美术图用图片，否则把 SVG 转成图片地址），以及脸部位置
    src(kind, id) {
      const a = art(kind, id);
      return a ? a.src : 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(codeSvg(kind, id, {}));
    },
    faceOf: (kind, id) => artFace(kind, id),
    face,
  };
})();
