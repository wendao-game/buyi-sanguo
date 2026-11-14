'use strict';
/* ============================================================
 * 武将专属技能：每名武将一个专属被动 + 一个专属大招
 *
 * 大招 ult：{ desc, aim, cast(B, h, a, k) }
 *   B 战斗接口（见 battle.js 的 makeApi）；h 武将；a 大招基础伤害；k 觉醒倍率（3 星起 1.5，否则 1）
 *   aim: true 的大招在「手动」模式下可以点选战场落点
 * 被动 passive：{ name, desc, ...钩子 }
 *   mod      数值修正 { atk, spd, crit, critDmg, rage, w 刀气宽, r 爆炸半径, chain 弹跳, life 毒潭时长,
 *            push 击退, tspd 旋风速度, burn 灼烧倍率, dotCrit 持续伤害可暴击 }
 *   aura(ctx)              开局：ctx = { S, self, heroes, has(id) }，可改全军或其他武将
 *   onAttack(B, h, tg, d)  每次普攻出手后
 *   onHit(B, h, e)         普攻命中
 *   dmg(B, h, e)           该武将造成伤害的倍率
 *   onKill(B, h, e, el)    该武将击杀
 *   onAnyKill(B, h, e)     任何人击杀
 *   onUlt(B, h)            自己放完大招
 * 没写在这里的武将（未开放的神将）用攻击类型的通用大招
 * ============================================================ */

const SKILLS = (function () {
  const R = (n, k) => Math.max(1, Math.round(n * k));
  const big = e => e.def.id === 'boss' || e.def.id === 'elite';

  return {
    /* ======================= 白 ======================= */
    liaohua: {
      passive: { name: '蜀中先锋', desc: '每第 4 次出手额外射出一支箭，射向另一个敌人',
        onAttack(B, h, tg, d) { if (h.n % 4 === 0) { const t2 = B.rnd(); if (t2) B.arrow(h, t2, d); } } },
      ult: { aim: true, desc: '向目标方向扇形连射 14 支贯穿箭（觉醒 21 支）',
        cast(B, h, a, k) {
          const p = B.at(90); if (!p) return;
          const base = Math.atan2(p.y - h.y, p.x - h.x), n = R(14, k);
          for (let i = 0; i < n; i++) B.later(i * 0.05, () => B.blade(h, h.x, h.y - 24, base + (i / (n - 1) - 0.5) * 0.9, { look: 'arrow', el: 'arrow', w: 22, spd: 720, dmg: a * 2.2, life: 1.6 }));
        } },
    },
    zhoucang: {
      passive: { name: '扛刀', desc: '刀气宽度 +40%，攻击 +5%', mod: { w: 0.4, atk: 0.05 } },
      ult: { aim: true, desc: '劈出一道巨型刀气，伤害 ×4.5 并把沿途敌人击退（觉醒 ×6.75）',
        cast(B, h, a, k) {
          const p = B.at(100); if (!p) return;
          B.blade(h, h.x, h.y - 22, Math.atan2(p.y - h.y, p.x - h.x), { w: 200, spd: 460, dmg: a * 4.5 * k, big: true, push: 60, life: 2.4 });
          B.shake(0.3);
        } },
    },
    peiyuan: {
      passive: { name: '山贼', desc: '亲手击杀的敌人额外 20% 概率掉铜钱',
        onKill(B, h, e) { if (Math.random() < 0.2) B.dropCoin(e); } },
      ult: { aim: true, desc: '在敌群中点燃 3 处火堆，持续灼烧 4 秒（觉醒 5 处）',
        cast(B, h, a, k) {
          const p = B.at(120); if (!p) return;
          const n = R(3, k);
          for (let i = 0; i < n; i++) {
            const t = i === 0 ? p : (B.dense(80) || p);
            B.pool(h, t.x + (Math.random() - 0.5) * 60, t.y + (Math.random() - 0.5) * 40, 72, 4, a * 0.6, 'fire');
          }
        } },
    },
    guanhai: {
      passive: { name: '瘴毒', desc: '毒潭持续时间 +50%', mod: { life: 0.5 } },
      ult: { desc: '全场瘴气：所有敌人中毒 6 秒（觉醒 9 秒）',
        cast(B, h, a, k) {
          B.flash('120,220,80', 0.25, 0.5);
          for (const e of B.lives()) { B.poison(e, 6 * k, a * 0.55, h); B.burst(e.x, e.y, 3, '#8be84f', 60, 3, 0.5); B.tex('el_hit_wind', e.x, e.y - 6, { w: 60, life: 0.5, grow: 1.3, rgb: '120,235,60' }); }
        } },
    },
    panfeng: {
      passive: { name: '无双上将', desc: '每次出手 20% 概率追加一道 3 倍伤害的落雷',
        onAttack(B, h, tg, d) { if (Math.random() < 0.2 && !tg.dead) { B.bolt(tg.x, -10, tg.x, tg.y - 6, 1.5); B.hit(tg, d * 3, 'thunder', h); } } },
      ult: { desc: '巨斧落雷劈进敌人最密的地方，正中的敌人受到 ×18 伤害并眩晕，周围一大片敌人受到 ×8 伤害、眩晕 1 秒（觉醒 ×27）',
        cast(B, h, a, k) {
          const t = B.dense(110) || B.front(); if (!t) return;
          B.bolt(t.x, -10, t.x, t.y - 6, 4); B.flash('220,200,255', 0.35, 0.3); B.shake(0.35);
          B.hit(t, a * 18 * k, 'thunder', h); B.stun(t, 2);
          B.area(t.x, t.y, 130, e => { if (e !== t) { B.hit(e, a * 8, 'thunder', h); B.stun(e, 1); } });
          B.ring(t.x, t.y, 10, 125, 0.4, '#c4b0ff', 5);
        } },
    },
    mifang: {
      passive: { name: '南郡守将', desc: '普攻命中的敌人 2 秒内受到的伤害 +12%',
        onHit(B, h, e) { B.vuln(e, 2, 0.12); } },
      ult: { desc: '在城墙前竖起一排冰刺 5 秒，踩上去的敌人被冻住 1.5 秒（觉醒 7.5 秒）',
        cast(B, h, a, k) { B.zone({ k: 'icewall', h, y: B.WY - 80, life: 5 * k, dmg: a * 8, stun: 1.5 }); } },
    },

    /* ======================= 绿 ======================= */
    guanping: {
      passive: { name: '承父志', desc: '关羽在阵时自身攻击 +25%，否则 +8%',
        aura(ctx) { ctx.self.atk *= ctx.has('guanyu') ? 1.25 : 1.08; } },
      ult: { aim: true, desc: '连斩两道大刀气；关羽在阵时为关羽恢复 30 怒气（觉醒刀气伤害 ×1.5）',
        cast(B, h, a, k) {
          const p = B.at(90); if (!p) return;
          const ang = Math.atan2(p.y - h.y, p.x - h.x);
          B.blade(h, h.x, h.y - 22, ang, { w: 120, spd: 500, dmg: a * 3.5 * k, big: true });
          B.later(0.25, () => { const t = B.front(); if (t) B.blade(h, h.x, h.y - 22, Math.atan2(t.y - h.y, t.x - h.x), { w: 120, spd: 500, dmg: a * 3.5 * k, big: true }); });
          const gy = B.heroes().find(x => x.def.id === 'guanyu'); if (gy) B.rage(gy, 30);
        } },
    },
    caohong: {
      passive: { name: '宗族悍将', desc: '城防上限 +10%，自身攻击 +25%', mod: { atk: 0.25 }, aura(ctx) { ctx.S.wallBonus += 0.10; } },
      ult: { desc: '疾射：10 秒内自身出手速度 ×3（觉醒 15 秒）',
        cast(B, h, a, k) { B.haste(h, 10 * k, 3); B.ring(h.x, h.y, 10, 60, 0.5, '#ffe9a8', 4); } },
    },
    chengpu: {
      passive: { name: '江东宿将', desc: '对灼烧中的敌人伤害 +25%', dmg(B, h, e) { return e.burn > 0 ? 1.25 : 1; } },
      ult: { aim: true, desc: '一颗巨型火球砸向敌群，范围大、伤害 ×5.5（觉醒 ×8.25）',
        cast(B, h, a, k) {
          const p = B.at(130); if (!p) return;
          B.lob(h, 'fire', p.x + 160, -60, p.x, p.y, { dur: 0.55, arc: 0, r: 150, dmg: a * 5.5 * k, big: true, size: 2 });
        } },
    },
    zhangbao: {
      passive: { name: '地公将军', desc: '闪电多弹跳 2 次', mod: { chain: 2 } },
      ult: { aim: true, desc: '在敌群中埋下 5 个雷阵，敌人踩中爆炸并眩晕（觉醒 8 个）',
        cast(B, h, a, k) {
          const p = B.at(140); if (!p) return;
          const n = R(5, k);
          for (let i = 0; i < n; i++) B.zone({ k: 'mine', h, x: Math.max(50, Math.min(B.W - 50, p.x + (Math.random() - 0.5) * 220)), y: Math.min(B.WY - 40, p.y + (Math.random() - 0.3) * 160), r: 55, life: 9, dmg: a * 4, stun: 1.2 });
        } },
    },
    huaxiong: {
      passive: { name: '西凉骁骑', desc: '旋风推进速度 +60%，攻击 +15%', mod: { tspd: 0.6, atk: 0.15 } },
      ult: { desc: '三道旋风并排横扫整条战线（觉醒持续更久）',
        cast(B, h, a, k) { [120, 270, 420].forEach(x => B.tornado(h, x, B.WY - 30, { r: 70, life: 4 * k, dmg: a * 1.3, push: 16, vy: -70, big: true })); } },
    },

    /* ======================= 蓝 ======================= */
    xuhuang: {
      passive: { name: '断粮', desc: '刀气命中的敌人减速 1.5 秒', onHit(B, h, e) { B.slow(e, 1.5); } },
      ult: { desc: '横扫整条战线的刀浪，由城下推到远方，伤害 ×2.5 并减速（觉醒 ×3.75）',
        cast(B, h, a, k) { B.sweep(h, a * 2.5 * k, { slow: 3 }); B.shake(0.2); } },
    },
    ganning: {
      passive: { name: '锦帆贼', desc: '暴击率 +10%；每次出手 40% 概率再射一箭',
        mod: { crit: 0.10 }, onAttack(B, h, tg, d) { if (Math.random() < 0.4) { const t2 = B.rnd(); if (t2) B.arrow(h, t2, d); } } },
      ult: { desc: '夜袭：向血量最高的 8 个敌人射出火箭，伤害 ×6 并灼烧（觉醒 12 个）',
        cast(B, h, a, k) {
          B.strongest(R(8, k)).forEach((e, i) => B.later(i * 0.07, () => B.arrow(h, e, a * 6, { burn: [3, a * 0.8], big: true })));
        } },
    },
    weiyan: {
      passive: { name: '反骨', desc: '城防低于一半时自身伤害 +40%', dmg(B) { return B.S.wall < B.S.wallMax * 0.5 ? 1.4 : 1; } },
      ult: { aim: true, desc: '子午谷奇谋：火焰从左到右连环炸穿一整排（觉醒伤害 ×1.5）',
        cast(B, h, a, k) {
          const p = B.at(100); if (!p) return;
          for (let i = 0; i < 8; i++) B.later(i * 0.09, () => B.explode('fire', 50 + i * 63, p.y + Math.sin(i * 1.3) * 18, 70, a * 3 * k, true, h));
        } },
    },
    caiwenji: {
      passive: { name: '胡笳', desc: '全军怒气获取 +8%', aura(ctx) { ctx.S.buffs.rage *= 1.08; } },
      ult: { desc: '悲歌：其他武将怒气 +25，全场敌人减速 4 秒（觉醒怒气 +38）',
        cast(B, h, a, k) {
          B.teamRage(R(25, k), h); B.flash('170,220,255', 0.3, 0.6);
          for (const e of B.lives()) { B.slow(e, 4); B.hit(e, a * 1.5, 'ice', h); }
          B.heroes().forEach(x => { if (x !== h) B.ring(x.x, x.y, 8, 50, 0.5, '#bfeaff', 3); });
        } },
    },
    liru: {
      passive: { name: '魔王之智', desc: '中毒的敌人受到全军伤害 +15%', aura(ctx) { ctx.S.psnVuln = Math.max(ctx.S.psnVuln, 0.15); } },
      ult: { desc: '鸩毒：给血量最高的 3 个敌人下剧毒，8 秒内共造成 ×13 伤害（觉醒 5 个）',
        cast(B, h, a, k) { B.strongest(R(3, k)).forEach(e => { B.poison(e, 8, a * 1.6, h); B.burst(e.x, e.y, 12, '#5a1a6a', 120, 4, 0.6); B.tex('el_hit_dark', e.x, e.y - 10, { w: 110, life: 0.6, grow: 1.3, rgb: '150,240,90' }); }); } },
    },
    xushu: {
      passive: { name: '单福先生', desc: '旋风击退距离 +50%', mod: { push: 0.5 } },
      ult: { desc: '巽风阵：城前布下风墙 6 秒，冲进来的敌人被持续吹回（觉醒 9 秒）',
        cast(B, h, a, k) { B.zone({ k: 'barrier', h, y: B.WY - 110, life: 6 * k, dmg: a * 1.0, push: 22 }); } },
    },

    /* ======================= 紫 ======================= */
    huangzhong: {
      passive: { name: '老当益壮', desc: '每第 4 次出手额外射出一支必定暴击的 4 倍重箭',
        onAttack(B, h, tg, d) { if (h.n % 4 === 0) { const t = B.strongest(1)[0] || tg; B.arrow(h, t, d * 4, { crit: 1, big: true }); } } },
      ult: { desc: '百步穿杨：蓄力后射出贯穿全场的巨箭，直取血量最高的敌人（觉醒伤害 ×1.5）',
        cast(B, h, a, k) {
          const t = B.strongest(1)[0]; if (!t) return;
          B.ring(h.x, h.y - 20, 50, 6, 0.5, '#ffe9a8', 3);
          B.later(0.5, () => {
            const tx = t.dead ? h.x : t.x, ty = t.dead ? 0 : t.y;
            if (!t.dead) B.hit(t, a * 18 * k, 'arrow', h, { crit: 0.5 });
            B.blade(h, h.x, h.y - 24, Math.atan2(ty - h.y, tx - h.x), { look: 'arrow', el: 'arrow', w: 46, spd: 1100, dmg: a * 10 * k, big: true, life: 1.4 });
            B.shake(0.2);
          });
        } },
    },
    zhangliao: {
      passive: { name: '止啼之将', desc: '敌人离城墙越近，受到其伤害越高（最多 +40%）',
        dmg(B, h, e) { return 1 + 0.4 * Math.max(0, Math.min(1, (e.y - B.TOP) / (B.WY - B.TOP))); } },
      ult: { desc: '威震逍遥：全场敌人受惊后退 2.5 秒并受到 ×2 伤害（敌将减半，觉醒 3.75 秒）',
        cast(B, h, a, k) {
          B.shake(0.3); B.ring(h.x, h.y, 20, 520, 0.6, '#9ff3d6', 6);
          for (let i = 0; i < 6; i++) B.later(i * 0.06, () => B.tex('wind_arc', 60 + i % 3 * 210 + (i > 2 ? 105 : 0), B.WY - 40 - (i > 2 ? 70 : 0), { w: 230, h: 84, life: 0.75, vy: -620, grow: 1.5, a: 0.8, rgb: '70,230,185' }));   // 一排排月牙风痕扫向敌阵
          for (const e of B.lives()) { B.fear(e, (e.def.id === 'boss' ? 1.25 : 2.5) * k); B.hit(e, a * 2, 'wind', h); }
        } },
    },
    zhangjiao: {
      passive: { name: '太平道', desc: '自己每放一次大招，其他武将怒气 +10', onUlt(B, h) { B.teamRage(10, h); } },
      ult: { aim: true, desc: '太平雷法：召来雷云 6 秒，不停落雷并麻痹敌人（觉醒 9 秒）',
        cast(B, h, a, k) { const p = B.at(150); if (!p) return; B.zone({ k: 'storm', h, x: p.x, y: p.y, r: 170, life: 6 * k, every: 0.25, dmg: a * 4 }); } },
    },
    jiaxu: {
      passive: { name: '毒士', desc: '毒潭范围 +25%，持续伤害可以暴击', mod: { r: 0.25, dotCrit: 1 } },
      ult: { desc: '乱武：全场敌人陷入混乱 4 秒，停止攻城、互相砍杀（敌将 1.5 秒，觉醒 6 秒）',
        cast(B, h, a, k) {
          B.flash('140,60,160', 0.3, 0.6);
          for (const e of B.lives()) { B.confuse(e, (e.def.id === 'boss' ? 1.5 : 4) * k, h); B.poison(e, 4, a * 0.5, h); B.tex('el_hit_dark', e.x, e.y - 10, { w: 60, life: 0.45, grow: 1.3, rgb: '200,120,255' }); }
        } },
    },
    zhenji: {
      passive: { name: '洛水之神', desc: '对冻结中的敌人伤害 ×2', dmg(B, h, e) { return e.frozen > 0 ? 2 : 1; } },
      ult: { aim: true, desc: '洛神冰魄：冰封一大片区域 3 秒，解冻时碎冰爆裂造成 ×6 伤害（觉醒 4.5 秒）',
        cast(B, h, a, k) {
          const p = B.at(150); if (!p) return;
          const t = 3 * k;
          B.ring(p.x, p.y, 20, 150, 0.5, '#cfefff', 7); B.flash('180,230,255', 0.3, 0.5); Sfx.play('freeze');
          B.area(p.x, p.y, 150, e => B.stun(e, t));
          B.zone({ k: 'frost', x: p.x, y: p.y, r: 150, life: t });
          B.later(t, () => { B.area(p.x, p.y, 160, e => B.hit(e, a * 6, 'ice', h)); B.burst(p.x, p.y, 30, '#e8f8ff', 260, 5, 0.6); B.ring(p.x, p.y, 20, 170, 0.4, '#ffffff', 5); });
        } },
    },
    taishici: {
      passive: { name: '信义笃烈', desc: '对校尉、敌将伤害 +40%', dmg(B, h, e) { return big(e) ? 1.4 : 1; } },
      ult: { desc: '天义斩：冲进敌阵，双戟交叉斩向最靠近城墙的 5 个敌人，每记 ×6 并波及周围一大片（觉醒 8 个）',
        cast(B, h, a, k) {
          const n = R(5, k);
          for (let i = 0; i < n; i++) B.later(i * 0.13, () => {
            const L = B.lives().slice().sort((x, y) => y.y - x.y); if (!L.length) return;
            const t = L[Math.min(i, L.length - 1)], x = t.x, y = t.y;                                        // 第 i 记斩第 i 靠前的人；人不够就都砍最前面的
            [-0.75, 0.75].forEach(r => B.tex('slash', x, y - 6, { w: 170, h: 78, rot: r, life: 0.24, grow: 1.25, rgb: '255,205,185', a: 0.95 }));   // 两道交叉的戟光
            B.tex('burst', x, y - 6, { w: 70, life: 0.14, grow: 1.4, rgb: '255,230,210' });
            B.hit(t, a * 6, 'blade', h); B.shake(0.12);
            B.area(x, y, 110, e => { if (e !== t) B.hit(e, a * 3, 'blade', h); });
          });
        } },
    },

    /* ======================= 金 ======================= */
    guanyu: {
      passive: { name: '武圣', desc: '攻击 +20%；亲手击杀敌人恢复 5 怒气', mod: { atk: 0.2 }, onKill(B, h) { B.rage(h, 5); } },
      ult: { aim: true, desc: '青龙偃月：月牙巨刃贯穿全场 ×5，之后 4 秒普攻刀气变大（觉醒 ×7.5、6 秒）',
        cast(B, h, a, k) {
          const p = B.at(110); if (!p) return;
          B.blade(h, h.x, h.y - 22, Math.atan2(p.y - h.y, p.x - h.x), { w: 260, spd: 480, dmg: a * 5 * k, big: true, life: 2.6, color: 'green', tex: 'dragon_azure', texW: 380 });
          h.bigT = 4 * k; B.shake(0.35);
        } },
    },
    zhangfei: {
      passive: { name: '万人敌', desc: '攻击 +20%；普攻命中 20% 概率眩晕敌人 0.8 秒；对眩晕中的敌人伤害 +50%',
        mod: { atk: 0.2 }, onHit(B, h, e) { if (Math.random() < 0.2) B.stun(e, 0.8); }, dmg(B, h, e) { return e.frozen > 0 ? 1.5 : 1; } },
      ult: { desc: '当阳怒吼：全场敌人受到 ×3 伤害并眩晕 2.5 秒（敌将 1 秒），5 秒内受到伤害 +30%（觉醒眩晕 3.75 秒）',
        cast(B, h, a, k) {
          B.shake(0.5); B.flash('255,220,160', 0.25, 0.4);
          for (let i = 0; i < 3; i++) B.later(i * 0.12, () => B.ring(h.x, h.y - 20, 20, 560, 0.7, '#ffd8a0', 8 - i * 2));
          for (const e of B.lives()) { B.stun(e, (e.def.id === 'boss' ? 1 : 2.5) * k); B.vuln(e, 5, 0.3); B.hit(e, a * 3, 'thunder', h); }
        } },
    },
    zhouyu: {
      passive: { name: '美周郎', desc: '火球范围 +30%，灼烧伤害 +60%', mod: { r: 0.3, burn: 0.6 } },
      ult: { desc: '火烧赤壁：4 艘火船从城下冲向敌阵，沿途烧出火路，冲到敌阵深处爆炸（觉醒 6 艘）',
        cast(B, h, a, k) {
          const n = R(4, k);
          for (let i = 0; i < n; i++) B.later(i * 0.15, () => B.ship(h, 70 + (B.W - 140) * (n === 1 ? 0.5 : i / (n - 1)), a));
        } },
    },
    zhaoyun: {
      passive: { name: '龙胆', desc: '每第 3 次出手改为贯穿冰枪，伤害 ×1.5',
        onAttack(B, h, tg, d) { if (h.n % 3 === 0 && !tg.dead) B.blade(h, h.x, h.y - 22, Math.atan2(tg.y - h.y, tg.x - h.x), { look: 'ice', el: 'ice', w: 34, spd: 760, dmg: d * 1.5, slow: 1.5, life: 1.5 }); } },
      ult: { desc: '七进七出：7 道冰枪从两侧杀进敌阵，每一枪都对准一个敌人贯穿过去，伤害 ×3.6 并减速（觉醒 10 道）',
        cast(B, h, a, k) {
          const n = R(7, k);
          for (let i = 0; i < n; i++) B.later(i * 0.14, () => {
            const L = B.lives(); if (!L.length) return;
            const t = L[(i * 3 + 1) % L.length], fromL = i % 2 === 0;                                  // 每一枪找一个敌人对准了穿，不再碰运气
            const x0 = fromL ? -20 : B.W + 20, y0 = Math.max(B.TOP + 20, Math.min(B.WY - 60, t.y + (Math.random() - 0.5) * 160));
            B.blade(h, x0, y0, Math.atan2(t.y - y0, t.x - x0), { look: 'ice', el: 'ice', w: 68, spd: 900, dmg: a * 3.6, slow: 2, life: 1.2, big: true, tex: 'dragon_white', texW: 190 });
          });
        } },
    },
    simayi: {
      passive: { name: '冢虎', desc: '被毒死的敌人原地留下一小片毒潭',
        onKill(B, h, e, el) { if (el === 'poison') B.pool(h, e.x, e.y, 40, 2, h.atk * 0.5, 'poison'); } },
      ult: { desc: '鬼谋：全场敌人 6 秒内受到的伤害 +45% 并持续剧毒（觉醒 9 秒）',
        cast(B, h, a, k) {
          B.flash('80,40,120', 0.3, 0.6);
          for (const e of B.lives()) { B.vuln(e, 6 * k, 0.45); B.poison(e, 6 * k, a * 1.0, h); B.mark(e, 6 * k); B.tex('el_hit_dark', e.x, e.y - 10, { w: 70, life: 0.5, grow: 1.3 }); }
        } },
    },

    /* ======================= 橙 ======================= */
    zhugeliang: {
      passive: { name: '卧龙', desc: '全军大招伤害 +15%', aura(ctx) { ctx.S.buffs.ult *= 1.15; } },
      ult: { desc: '借东风：6 秒东风把敌人持续吹回，全军出手速度 +25%、火系伤害 +30%，其他武将怒气 +10（觉醒 9 秒）',
        cast(B, h, a, k) {
          const t = 6 * k;
          B.zone({ k: 'wind', h, life: t, dmg: a * 0.9, push: 9 });
          B.teamHaste(t, 1.25); B.teamRage(10, h); B.S.windT = t;
          B.flash('200,255,235', 0.25, 0.6);
        } },
    },
    lvbu: {
      passive: { name: '飞将', desc: '出手速度 +25%；每第 4 次出手挥出 3 道扇形刀气',
        mod: { spd: 0.25 },
        onAttack(B, h, tg, d) { if (h.n % 4 === 0 && !tg.dead) { const b = Math.atan2(tg.y - h.y, tg.x - h.x); [-0.3, 0.3].forEach(o => B.blade(h, h.x, h.y - 22, b + o, { w: 50 * h.m.w, spd: 430, dmg: d, life: 2.2 })); } } },
      ult: { desc: '无双乱舞：6 秒内不停向四面八方挥出大型刀气（觉醒 9 秒）',
        cast(B, h, a, k) {
          const n = R(24, k);
          for (let i = 0; i < n; i++) B.later(i * 0.25, () => B.blade(h, h.x, h.y - 22, -Math.PI / 2 + (Math.random() - 0.5) * 2.2, { w: 120, spd: 520, dmg: a * 1.2, big: true, life: 2.2, color: 'red' }));
          B.shake(0.3);
        } },
    },
    caocao: {
      passive: { name: '乱世奸雄', desc: '全军攻击 +10%；任何人击杀校尉或敌将时，全军怒气 +15',
        aura(ctx) { ctx.S.buffs.atk *= 1.10; },
        onAnyKill(B, h, e) { if (big(e)) B.teamRage(15); } },
      ult: { desc: '万箭齐发：三轮箭雨覆盖全场，每轮 20 支并减速（觉醒四轮半）',
        cast(B, h, a, k) {
          const rounds = 3 * k;
          for (let i = 0; i < Math.round(20 * rounds); i++) B.later(i * 0.05 + Math.floor(i / 20) * 0.35, () => {
            const t = B.rnd(); if (!t) return;
            B.rain(h, t.x + (Math.random() - 0.5) * 24, t.y, a * 0.8, 0.8);
          });
        } },
    },
    luxun: {
      passive: { name: '江东儒帅', desc: '火球落点留下 1.5 秒的余火',
        onAttack(B, h, tg) { const x = tg.x, y = tg.y; B.later(0.5, () => B.pool(h, x, y, 36, 1.5, h.atk * 0.3, 'fire')); } },
      ult: { aim: true, desc: '火烧连营：三排连营火横跨战场，持续灼烧 5 秒（觉醒 7.5 秒）',
        cast(B, h, a, k) {
          const p = B.at(120); if (!p) return;
          [-80, 0, 80].forEach((dy, r) => {
            const y = Math.max(B.TOP + 30, Math.min(B.WY - 50, p.y + dy));
            for (let i = 0; i < 6; i++) B.later(r * 0.15 + i * 0.05, () => B.pool(h, 60 + i * 84, y, 52, 5 * k, a * 0.5, 'fire'));
          });
          B.flash('255,140,60', 0.25, 0.5);
          B.tex('phoenix', -140, p.y - 40, { w: 300, vx: 640, life: 1.1, fadeIn: 0.1 });
        } },
    },

    /* ======================= v1.0 新增的 18 名武将 ======================= */
    /* —— 白 —— */
    xingdaorong: {
      passive: { name: '零陵上将', desc: '暴击率 +8%', mod: { crit: 0.08 } },
      ult: { desc: '零陵开山：一把巨斧从天而降砸进敌人最密的地方，正中的敌人受到 ×10 伤害并眩晕 1.5 秒，震伤周围一大片敌人（×5，觉醒 ×15）',
        cast(B, h, a, k) {
          const t = B.dense(130) || B.front(); if (!t) return; const x = t.x, y = t.y;
          B.tex('axe', x + 26, y - 300, { w: 104, h: 130, life: 0.33, vy: 860, rot: Math.PI, a: 1 });             // 斧头朝下落
          B.later(0.31, () => {
            B.shake(0.35); B.shock(x, y, 170, 0.6); B.ring(x, y, 12, 150, 0.4, '#ffd9a0', 6); B.burst(x, y, 18, '#c8a878', 240, 4, 0.5, 400);
            B.tex('burst', x, y, { w: 150, life: 0.22, grow: 1.4, rgb: '255,220,170' }); B.tex('axe', x + 20, y - 34, { w: 84, h: 105, life: 0.5, rot: Math.PI + 0.25, a: 0.9 });
            if (!t.dead) { B.hit(t, a * 10 * k, 'blade', h); B.stun(t, 1.5); }
            B.area(x, y, 150, e => { if (e !== t) { B.hit(e, a * 5 * k, 'blade', h); B.stun(e, 0.8); } });
          });
        } },
    },
    jiangqin: {
      passive: { name: '江表虎臣', desc: '出手速度 +10%', mod: { spd: 0.10 } },
      ult: { desc: '水寨夹射：战场两侧的水寨各射出 5 支贯穿箭，横穿敌阵，每支 ×2.2（觉醒 ×3.3）',
        cast(B, h, a, k) {
          for (let i = 0; i < 10; i++) B.later(i * 0.07, () => {
            const left = i % 2 === 0, y = B.TOP + 70 + Math.random() * (B.WY - B.TOP - 170), x = left ? -6 : B.W + 6;
            B.ring(left ? 14 : B.W - 14, y, 6, 46, 0.3, '#8fd0ff', 3);                                    // 箭出水寨时溅起一圈水花
            B.blade(h, x, y, left ? 0.05 : Math.PI - 0.05, { look: 'arrow', el: 'arrow', w: 24, spd: 780, dmg: a * 2.2 * k, life: 0.9, rgb: '130,205,255' });
          });
        } },
    },
    /* —— 绿 —— */
    yujin: {
      passive: { name: '毅重', desc: '城防上限 +8%，冰枪范围 +20%', mod: { r: 0.2 }, aura(ctx) { ctx.S.wallBonus += 0.08; } },
      ult: { desc: '毅重军阵：城前竖起一排盾墙 6 秒，撞上来的敌人被挡住 1.2 秒并受到 ×3 伤害，全场敌人减速 3 秒（觉醒 9 秒）',
        cast(B, h, a, k) {
          B.zone({ k: 'icewall', look: 'shield', el: 'blade', h, y: B.WY - 170, life: 6 * k, dmg: a * 3, stun: 1.2 });
          for (const e of B.lives()) B.slow(e, 3);
          B.flash('150,190,255', 0.18, 0.4); B.shake(0.15);
        } },
    },
    lingtong: {
      passive: { name: '国士之风', desc: '旋风推进速度 +30%，击退距离 +30%', mod: { tspd: 0.3, push: 0.3 } },
      ult: { desc: '旋风突：身影化作六道风刃在敌阵里左右折冲，每道伤害 ×3 并把敌人推开（觉醒九道）',
        cast(B, h, a, k) {
          const n = R(6, k), step = (B.WY - B.TOP - 170) / n;
          for (let i = 0; i < n; i++) B.later(i * 0.13, () => {
            const x = B.W * (i % 2 ? 0.32 : 0.68), y = B.WY - 90 - i * step;
            B.tex('wind_arc', x, y, { w: 280, h: 104, rot: (i % 2 ? -0.55 : 0.55), life: 0.3, grow: 1.25, rgb: '70,230,185', a: 0.95 });
            B.tex('slash', x, y, { w: 200, h: 80, rot: (i % 2 ? -0.55 : 0.55) + Math.PI / 2, life: 0.18, grow: 1.2, rgb: '235,255,248', a: 0.8 });
            B.area(x, y, 135, e => { B.hit(e, a * 3, 'wind', h); B.push(e, 30); });
          });
        } },
    },
    /* —— 蓝 —— */
    daqiao: {
      passive: { name: '国色', desc: '全军怒气获取 +6%；小乔在阵时再 +6%', aura(ctx) { ctx.S.buffs.rage *= ctx.has('xiaoqiao') ? 1.12 : 1.06; } },
      ult: { desc: '国色凝霜：城墙前开出一排冰莲，城防回复 15%，靠近城墙的敌人被冻住 2.5 秒并受到 ×6 伤害（觉醒回复 22%）',
        cast(B, h, a, k) {
          B.heal(0.15 * k); B.flash('190,235,255', 0.22, 0.5);
          for (let i = 0; i < 6; i++) B.later(i * 0.06, () => B.tex('lotus', 62 + i * 83, B.WY - 78 + (i % 2) * 22, { w: 96, life: 1.7, grow: 1.25, fadeIn: 0.12, spin: 0.5, a: 0.9 }));
          for (const e of B.lives()) if (e.y > B.WY - 260) { B.stun(e, 2.5); B.hit(e, a * 6, 'ice', h); B.tex('lotus', e.x, e.y - 4, { w: 44, life: 0.7, grow: 1.5, a: 0.85 }); }
        } },
    },
    xuchu: {
      passive: { name: '虎痴', desc: '城防每损失 10%，自身伤害 +3%', dmg(B) { return 1 + 0.3 * (1 - Math.max(0, B.S.wall) / B.S.wallMax); } },
      ult: { desc: '裸衣狂斩：跳下城墙连扑三处敌群——先扑最密的，再扑离城最近的，最后扑阵后的；每扑 ×4 并震晕 1 秒。回来后 8 秒出手速度 ×1.4，刀气变大（觉醒 ×6、12 秒）',
        cast(B, h, a, k) {
          B.haste(h, 8 * k, 1.4); h.bigT = 8 * k; B.ring(h.x, h.y, 10, 70, 0.5, '#ffb090', 5);
          const done = [], far = e => done.every(p => Math.hypot(p.x - e.x, p.y - e.y) > 150);
          const pick = i => {
            const L = B.lives(); if (!L.length) return null;
            if (i === 0) return B.dense(130) || B.front();
            const rest = L.filter(far), pool = rest.length ? rest : L;
            return i === 1 ? pool.reduce((b, e) => e.y > b.y ? e : b) : pool.reduce((b, e) => e.y < b.y ? e : b);   // 第二扑找离城最近的，第三扑找阵后的
          };
          let px = h.x, py = h.y - 20;
          for (let i = 0; i < 3; i++) B.later(i * 0.28, () => {
            const t = pick(i); if (!t) return; const x = t.x, y = t.y; done.push({ x, y });
            B.tex('wind_line', (px + x) / 2, (py + y) / 2, { w: Math.hypot(x - px, y - py) + 40, h: 46, rot: Math.atan2(y - py, x - px), life: 0.22, rgb: '255,170,110', a: 0.9 });   // 扑过去的一道残影
            px = x; py = y;
            B.tex('claw', x, y - 8, { w: 230, life: 0.45, grow: 1.2, rot: -0.2 + i * 1.1 }); B.tex('claw', x, y - 8, { w: 160, life: 0.65, grow: 1.5, rot: -0.2 + i * 1.1, a: 0.4 });
            B.ring(x, y, 12, 140, 0.35, '#ffb070', 5); B.shock(x, y, 150, 0.5); B.shake(0.22);
            B.area(x, y, 140, e => { B.hit(e, a * 4 * k, 'blade', h); B.stun(e, 1); });
          });
        } },
    },
    huanggai: {
      passive: { name: '苦肉', desc: '每次出手 30% 概率让火球多爆一次（伤害 ×0.6）',
        onAttack(B, h, tg, d) { if (Math.random() < 0.3) { const x = tg.x, y = tg.y; B.later(0.75, () => B.explode('fire', x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 20, 46, d * 0.6, false, h)); } } },
      ult: { desc: '苦肉火墙：自损 5% 城防，一道火墙从城下一路烧到阵后，伤害 ×2 并点燃沿途的敌人 3 秒（觉醒 ×3）',
        cast(B, h, a, k) {
          B.S.wall = Math.max(1, B.S.wall - Math.round(B.S.wallMax * 0.05));
          B.tex('flame', h.x, h.y - 4, { w: 70, h: 130, life: 0.7, a: 0.9 });                               // 先把自己点着
          B.sweep(h, a * 2 * k, { look: 'fire', el: 'fire', burn: [3, a * 0.4], vy: -300 });
          B.flash('255,140,60', 0.22, 0.4); Sfx.play('boom');
        } },
    },
    fazheng: {
      passive: { name: '睚眦必报', desc: '对已经在攻城的敌人伤害 +60%', dmg(B, h, e) { return e.y >= e.stopY ? 1.6 : 1; } },
      ult: { desc: '睚眦毒计：城墙前挖开一道冒泡的毒壕，持续 6 秒（觉醒 9 秒）',
        cast(B, h, a, k) {
          const life = 6 * k;
          for (let i = 0; i < 6; i++) B.later(i * 0.05, () => B.pool(h, 58 + i * 85, B.WY - 62, 52, life, a * 1.5, 'poison'));
          for (let j = 0; j < Math.round(life / 0.45); j++) B.later(j * 0.45, () => { for (let n = 0; n < 3; n++) B.tex('bubble', 40 + Math.random() * (B.W - 80), B.WY - 70 + Math.random() * 20, { w: 26 + Math.random() * 22, life: 0.9, vy: -46, grow: 1.35, a: 0.85 }); });
          B.flash('120,200,90', 0.18, 0.4);
        } },
    },
    /* —— 紫 —— */
    dianwei: {
      passive: { name: '古之恶来', desc: '每次出手往左右各多掷一把小戟（伤害 ×0.45）',
        onAttack(B, h, tg, d) { if (tg.dead) return; const b = Math.atan2(tg.y - h.y, tg.x - h.x); [-0.26, 0.26].forEach(o => B.blade(h, h.x, h.y - 22, b + o, { w: 26, spd: 520, dmg: d * 0.45, life: 1.8 })); } },
      ult: { desc: '恶来掷戟：两把旋转的大铁戟，一把掷向敌人最密的地方，一把掷向离城最近的敌人，贯穿敌阵后再飞回手里，来回各 ×4（觉醒 ×6）',
        cast(B, h, a, k) {
          B.shake(0.2);
          const d = B.dense(120), f = B.front(); if (!f) return;
          let a1 = Math.atan2((d || f).y - (h.y - 22), (d || f).x - h.x), a2 = Math.atan2(f.y - (h.y - 22), f.x - h.x);
          if (Math.abs(a1 - a2) < 0.35) { a1 -= 0.2; a2 += 0.2; }                                        // 两处挨得太近就左右岔开，别叠在一条线上
          [a1, a2].forEach((ang, i) => {
            const o = { w: 110, spd: 560, dmg: a * 4 * k, big: true, life: 0.92, tex: 'halberd', texW: 150, spin: i ? -17 : 17 };
            B.blade(h, h.x, h.y - 22, ang, o);
            B.later(0.96, () => B.blade(h, h.x + Math.cos(ang) * 515, h.y - 22 + Math.sin(ang) * 515, ang + Math.PI, o));
          });
        } },
    },
    pangtong: {
      passive: { name: '凤雏', desc: '火球炸到的敌人被铁索拖住：减速 1.5 秒', onHit(B, h, e) { B.slow(e, 1.5); } },
      ult: { aim: true, desc: '铁索连环：烧红的铁索把一大片敌人锁在一起 2 秒并点燃，伤害 ×3、灼烧 5 秒（觉醒锁 3 秒）',
        cast(B, h, a, k) {
          const p = B.at(140); if (!p) return;
          const got = [];
          B.flash('255,150,70', 0.2, 0.4);
          B.area(p.x, p.y, 145, e => { got.push(e); B.stun(e, 2 * k); B.hit(e, a * 3, 'fire', h); B.burn(e, 5, a * 0.8, h); });
          got.sort((x, y) => x.x - y.x);
          for (let i = 1; i < got.length && i < 14; i++) {                                                  // 相邻的敌人之间拉一条铁索
            const p0 = got[i - 1], p1 = got[i], d = Math.hypot(p1.x - p0.x, p1.y - p0.y);
            if (d > 6) B.tex('chain', (p0.x + p1.x) / 2, (p0.y + p1.y) / 2 - 8, { w: d, h: Math.min(24, d * 0.2 + 8), rot: Math.atan2(p1.y - p0.y, p1.x - p0.x), life: 2 * k, a: 0.95 });
          }
          for (let i = 0; i < 4; i++) B.pool(h, p.x + Math.cos(i * 1.57) * 80, p.y + Math.sin(i * 1.57) * 50, 46, 3, a * 0.4, 'fire');
        } },
    },
    xiaoqiao: {
      passive: { name: '天香', desc: '周瑜在阵时全军火系伤害 +15%，否则自身攻击 +10%',
        aura(ctx) { if (ctx.has('zhouyu')) ctx.S.buffs.el.fire = (ctx.S.buffs.el.fire || 1) * 1.15; else ctx.self.atk *= 1.1; } },
      ult: { desc: '天香舞风：三阵花雨从城下扫向敌阵，每阵伤害 ×1.1、把敌人推后一段并减速 2 秒，城防回复 8%（觉醒五阵、回复 12%）',
        cast(B, h, a, k) {
          for (let i = 0, n = R(3, k); i < n; i++) B.later(i * 0.5, () => { B.sweep(h, a * 1.1, { look: 'petal', el: 'wind', push: 26, slow: 2, vy: -340 }); Sfx.play('atk_wind'); });
          B.heal(0.08 * k); B.flash('255,200,225', 0.22, 0.5);
          for (let i = 0; i < 6; i++) B.tex('petal', h.x + (Math.random() - 0.5) * 70, h.y - 20 - Math.random() * 40, { w: 30, life: 0.9, grow: 1.6, vy: -60, spin: 3, a: 0.9 });
        } },
    },
    zuoci: {
      passive: { name: '遁甲', desc: '闪电命中的敌人 15% 概率混乱 1.5 秒', onHit(B, h, e) { if (Math.random() < 0.15) B.confuse(e, 1.5, h); } },
      ult: { desc: '遁甲天雷：甩出 9 张符咒贴到随机敌人身上，符到雷到，每道 ×5 并眩晕 0.8 秒（觉醒 13 张）',
        cast(B, h, a, k) {
          for (let i = 0, n = R(9, k); i < n; i++) B.later(i * 0.11, () => {
            const t = B.rnd(); if (!t) return;
            const T = 0.22, dx = t.x - h.x, dy = t.y - (h.y - 30);
            B.tex('talisman', h.x, h.y - 30, { w: 20, h: 40, life: T, vx: dx / T, vy: dy / T, rot: Math.atan2(dy, dx) + Math.PI / 2, a: 1 });
            B.later(T, () => {
              if (t.dead) return;
              B.tex('talisman', t.x, t.y - 14, { w: 24, h: 48, life: 0.4, grow: 1.5, a: 0.9 });
              B.bolt(t.x + (Math.random() - 0.5) * 40, -10, t.x, t.y - 6, 2.4); B.hit(t, a * 5, 'thunder', h); B.stun(t, 0.8);
              B.area(t.x, t.y, 40, e => { if (e !== t) B.hit(e, a * 1.5, 'thunder', h); });
            });
          });
        } },
    },
    /* —— 金 —— */
    machao: {
      passive: { name: '锦马超', desc: '攻击 +15%；对血量高于 60% 的敌人伤害 +45%', mod: { atk: 0.15 }, dmg(B, h, e) { return e.hp > e.max * 0.6 ? 1.45 : 1; } },
      ult: { desc: '铁骑雷奔：5 杆带电的长枪排成一线从城下冲到阵后，每杆 ×3.8（觉醒 7 杆）',
        cast(B, h, a, k) {
          const n = R(5, k); B.shake(0.3);
          for (let i = 0; i < n; i++) B.later(i * 0.08, () => {
            const x = 60 + (B.W - 120) * (i + 0.5) / n;
            B.blade(h, x, B.WY - 16, -Math.PI / 2, { look: 'arrow', el: 'thunder', w: 58, spd: 780, dmg: a * 3.8, big: true, life: 1.15, rgb: '205,185,255' });
            B.bolt(x, B.WY - 10, x + (Math.random() - 0.5) * 30, B.WY - 130, 1.6); B.ring(x, B.WY - 20, 6, 40, 0.3, '#c4b0ff', 3);
          });
        } },
    },
    sunshangxiang: {
      passive: { name: '弓腰姬', desc: '暴击率 +12%，暴击伤害 +40%', mod: { crit: 0.12, critDmg: 0.4 } },
      ult: { desc: '弓腰连珠：一支红翎箭在敌人之间来回弹射 14 次，每次 ×4.5 且必定暴击（觉醒 21 次）',
        cast(B, h, a, k) {
          let px = h.x, py = h.y - 24, last = null;
          for (let i = 0, n = R(14, k); i < n; i++) B.later(i * 0.09, () => {
            const L = B.lives().filter(e => e !== last); if (!L.length) return;
            const t = L[Math.floor(Math.random() * L.length)], dx = t.x - px, dy = t.y - py, d = Math.hypot(dx, dy);
            B.tex('thrust', (px + t.x) / 2, (py + t.y) / 2, { w: Math.max(60, d), h: 26, rot: Math.atan2(dy, dx), life: 0.17, rgb: '255,140,165', a: 1 });
            B.tex('burst', t.x, t.y - 4, { w: 54, life: 0.15, grow: 1.3, rgb: '255,170,195' });
            B.hit(t, a * 4.5, 'arrow', h, { crit: 1 });
            px = t.x; py = t.y; last = t;
          });
        } },
    },
    diaochan: {
      passive: { name: '闭月', desc: '毒潭范围 +20%、持续时间 +30%；吕布在阵时吕布攻击 +20%', mod: { r: 0.2, life: 0.3 },
        aura(ctx) { const lb = ctx.heroes.find(x => x.def.id === 'lvbu'); if (lb) lb.atk *= 1.2; } },
      ult: { desc: '闭月离间：一弯新月升起，血量最高的 4 个敌人被迷住，混乱 5 秒并中剧毒，周围的敌人也混乱 2 秒（觉醒 6 个）',
        cast(B, h, a, k) {
          B.flash('255,150,210', 0.22, 0.5);
          B.tex('moon', B.W / 2, B.TOP + 170, { w: 230, life: 1.7, fadeIn: 0.2, grow: 1.08, a: 0.85 });
          B.strongest(R(4, k)).forEach((e, i) => B.later(0.15 + i * 0.08, () => {
            if (e.dead) return;
            B.confuse(e, e.def.id === 'boss' ? 2 : 5, h); B.poison(e, 6, a * 1.9, h);
            B.tex('heart', e.x, e.y - 30, { w: 38, life: 1.1, vy: -44, grow: 1.4, a: 0.95 });
            B.area(e.x, e.y, 80, o => { if (o !== e) { B.confuse(o, 2, h); B.tex('heart', o.x, o.y - 24, { w: 20, life: 0.8, vy: -36, a: 0.8 }); } });
          }));
        } },
    },
    guojia: {
      passive: { name: '鬼才', desc: '冰枪命中的敌人 3 秒内受到的伤害 +20%', onHit(B, h, e) { B.vuln(e, 3, 0.2); } },
      ult: { desc: '遗计寒策：大雪骤降，全场敌人冻住 2 秒（敌将 0.8 秒），之后 6 秒受到的伤害 +30%，其他武将怒气 +15（觉醒冻 3 秒）',
        cast(B, h, a, k) {
          B.flash('180,225,255', 0.3, 0.5); B.teamRage(15, h); Sfx.play('freeze');
          B.tex('snowflake', B.W / 2, (B.TOP + B.WY) / 2, { w: 320, life: 1.5, spin: 0.9, grow: 1.25, a: 0.5, fadeIn: 0.2 });
          for (let i = 0; i < 18; i++) B.later(i * 0.07, () => B.tex('snowflake', 30 + Math.random() * (B.W - 60), B.TOP + Math.random() * 220, { w: 20 + Math.random() * 18, life: 1.7, vy: 110 + Math.random() * 90, spin: 2.5, a: 0.9 }));
          for (const e of B.lives()) { B.stun(e, (e.def.id === 'boss' ? 0.8 : 2) * k); B.vuln(e, 6, 0.3); B.hit(e, a * 2.5, 'ice', h); B.tex('snowflake', e.x, e.y - 8, { w: 34, life: 0.5, grow: 1.4, a: 0.9 }); }
        } },
    },
    /* —— 橙 —— */
    liubei: {
      passive: { name: '仁德', desc: '全军攻击 +8%，城防上限 +15%', aura(ctx) { ctx.S.buffs.atk *= 1.08; ctx.S.wallBonus += 0.15; } },
      ult: { desc: '仁德载世：金光照在每名武将身上，城防回复 15%，其他武将怒气 +15，8 秒内全军出手速度 +25%；雌雄双剑在最前面的敌人身上交叉斩过，每剑 ×3.5（觉醒回复 22%、12 秒）',
        cast(B, h, a, k) {
          B.heal(0.15 * k); B.teamRage(15, h); B.teamHaste(8 * k, 1.25); B.flash('255,235,170', 0.25, 0.6);
          B.heroes().forEach((x, i) => B.later(i * 0.05, () => { B.tex('pillar', x.x, x.y + 34, { w: 76, h: 250, ay: 1, life: 1.0, fadeIn: 0.1, a: 0.8, rgb: '255,215,110' }); B.ring(x.x, x.y + 26, 8, 56, 0.5, '#ffe08a', 3); }));
          const t = B.front();
          if (t) [-1, 1].forEach(s => B.blade(h, t.x + s * 150, t.y + 150, Math.atan2(-150, -s * 150), { w: 110, spd: 640, dmg: a * 3.5, big: true, life: 0.9, rgb: s < 0 ? '255,225,140' : '170,255,190' }));
        } },
    },
    sunce: {
      passive: { name: '小霸王', desc: '攻击 +15%；每亲手击杀一个敌人，本局攻击 +1%（最多 +40%）', mod: { atk: 0.15 },
        onKill(B, h) { if ((h.kills = (h.kills || 0) + 1) <= 40) h.atk *= 1.01; } },
      ult: { desc: '霸王激昂：一声怒喝，三圈雷霆从脚下荡开，扫到谁谁就受到 ×3 伤害；之后 6 秒自身出手速度 ×1.5（觉醒 9 秒）',
        cast(B, h, a, k) {
          B.shake(0.45); B.flash('210,190,255', 0.25, 0.4); B.haste(h, 6 * k, 1.5); B.shock(h.x, h.y - 20, 320, 1);
          B.tex('flame', h.x, h.y - 6, { w: 76, h: 140, life: 1.1, rgb: '185,150,255', a: 0.85 });           // 身上腾起紫色的气焰
          for (let i = 0; i < 3; i++) B.later(i * 0.1, () => B.ring(h.x, h.y - 20, 20, 560, 0.62, '#c4b0ff', 8 - i * 2));
          for (const e of B.lives()) B.later(Math.hypot(e.x - h.x, e.y - h.y) / 900, () => {                   // 雷圈扫到的时候才挨打
            if (e.dead) return;
            B.hit(e, a * 3, 'thunder', h); B.bolt(e.x + (Math.random() - 0.5) * 30, e.y - 70, e.x, e.y - 6, 1.4);
          });
        } },
    },

    /* ======================= v1.2 新增的 9 名武将（蓝绿卡池的配角） ======================= */
    /* —— 绿 —— */
    yuejin: {
      passive: { name: '先登', desc: '对还没走到城下的敌人伤害 +20%', dmg(B, h, e) { return e.y < e.stopY ? 1.2 : 1; } },
      ult: { desc: '先登破阵：杀到敌阵最后面插下战旗，旗子周围一大片敌人受到 ×4 伤害、眩晕 1.5 秒（觉醒 ×6）',
        cast(B, h, a, k) {
          const L = B.lives(); if (!L.length) return;
          const back = L.reduce((b, e) => e.y < b.y ? e : b);                                           // 找站得最靠后的那个
          let x = 0, y = 0, n = 0; for (const e of L) if (Math.hypot(e.x - back.x, e.y - back.y) < 150) { x += e.x; y += e.y; n++; }
          x /= n; y /= n;
          B.tex('wind_line', (h.x + x) / 2, (h.y + y) / 2, { w: Math.hypot(x - h.x, y - h.y), h: 40, rot: Math.atan2(y - h.y, x - h.x), life: 0.25, rgb: '255,190,150', a: 0.8 });
          B.tex('banner', x + 10, y - 230, { w: 90, h: 135, life: 0.24, vy: 800, a: 1 });
          B.later(0.22, () => {
            B.tex('banner', x + 10, y - 50, { w: 90, h: 135, life: 1.6, a: 0.95 });
            B.ring(x, y, 12, 160, 0.4, '#ffb080', 6); B.shock(x, y, 170, 0.5); B.shake(0.25); B.burst(x, y, 14, '#ffc890', 220, 4, 0.45);
            B.area(x, y, 160, e => { B.hit(e, a * 4 * k, 'blade', h); B.stun(e, 1.5); });
          });
        } },
    },
    lidian: {
      passive: { name: '儒雅', desc: '城防上限 +5%，冰枪范围 +15%', mod: { r: 0.15 }, aura(ctx) { ctx.S.wallBonus += 0.05; } },
      ult: { aim: true, desc: '冰锥牢笼：一圈冰锥从地里戳出来，把敌人最密的一片围住，圈里的敌人受到 ×3.5 伤害并被冻住 2 秒（觉醒 3 秒）',
        cast(B, h, a, k) {
          const p = B.at(120); if (!p) return; const x = p.x, y = p.y, t = 2 * k;
          for (let i = 0; i < 9; i++) B.later(i * 0.03, () => { const g = i / 9 * 6.283; B.tex('icespike', x + Math.cos(g) * 122, y + Math.sin(g) * 80 + 14, { w: 46, h: 92, ay: 1, life: t + 0.3, fadeIn: 0.08, a: 0.95 }); });
          B.ring(x, y, 20, 130, 0.35, '#cfefff', 5); Sfx.play('freeze');
          B.later(0.12, () => B.area(x, y, 125, e => { B.hit(e, a * 3.5, 'ice', h); B.stun(e, t); }));
        } },
    },
    handang: {
      passive: { name: '弓马娴熟', desc: '出手速度 +8%，暴击率 +5%', mod: { spd: 0.08, crit: 0.05 } },
      ult: { desc: '火矢连珠：一口气射出 14 支火矢，每支找一个敌人落下炸开 ×1.6 并点燃（觉醒 21 支）',
        cast(B, h, a, k) {
          const n = R(14, k);
          for (let i = 0; i < n; i++) B.later(i * 0.085, () => {
            const L = B.lives(); if (!L.length) return; const t = L[(i * 5 + 2) % L.length];
            B.lob(h, 'fire', h.x, h.y - 26, t.x, t.y, { dur: 0.3, arc: 60, r: 44, dmg: a * 1.6, size: 0.55 });
            B.tex('el_arrow_fire', h.x, h.y - 30, { w: 70, rot: Math.atan2(t.y - h.y, t.x - h.x), life: 0.12, vx: (t.x - h.x) * 2, vy: (t.y - h.y) * 2, a: 0.9 });
          });
        } },
    },
    wangping: {
      passive: { name: '无当飞军', desc: '对弓手伤害 +50%，对轻骑伤害 +20%', dmg(B, h, e) { return e.def.id === 'archer' ? 1.5 : e.def.id === 'rider' ? 1.2 : 1; } },
      ult: { desc: '飞军弩阵：城墙两头架起两座弩台，7 秒内轮番朝离城最近的敌人射出贯穿弩箭，每支 ×1.2（觉醒 10 秒）',
        cast(B, h, a, k) {
          const life = 7 * k, xs = [84, B.W - 84], y = B.WY - 46;
          xs.forEach(x => { B.tex('crossbow', x, y, { w: 84, life: life + 0.2, fadeIn: 0.15, a: 0.95 }); B.ring(x, y, 8, 60, 0.35, '#ffd9a0', 4); });
          for (let i = 0; i < Math.round(life / 0.3); i++) B.later(0.2 + i * 0.3, () => {
            const t = B.front(); if (!t) return; const x = xs[i % 2];
            B.blade(h, x, y - 20, Math.atan2(t.y - (y - 20), t.x - x), { look: 'arrow', el: 'arrow', w: 26, spd: 820, dmg: a * 1.2, life: 1.1, rgb: '255,225,160' });
            B.tex('burst', x, y - 26, { w: 34, life: 0.1, rgb: '255,235,190' });
          });
        } },
    },
    /* —— 蓝 —— */
    zhoutai: {
      passive: { name: '不屈', desc: '城防低于一半时，自身伤害 +25%', dmg(B) { return B.S.wall < B.S.wallMax * 0.5 ? 1.25 : 1; } },
      ult: { desc: '不屈死战：提刀守在城门前 6 秒，每 0.5 秒横扫一次城下的敌人 ×0.8 并把他们逼退；城防回复 4%（觉醒 9 秒）',
        cast(B, h, a, k) {
          const life = 6 * k; B.heal(0.04);
          B.tex('circle', B.W / 2, B.WY - 60, { w: 520, h: 150, life: life, fadeIn: 0.2, rgb: '255,90,70', a: 0.5, spin: 0.6 });
          for (let i = 0; i < Math.round(life / 0.5); i++) B.later(i * 0.5, () => {
            const x = B.W * (i % 2 ? 0.3 : 0.7);
            B.tex('slash', x, B.WY - 95, { w: 330, h: 120, rot: i % 2 ? 0.12 : Math.PI - 0.12, life: 0.22, grow: 1.15, rgb: '255,110,90', a: 0.95 });
            for (const e of B.lives()) if (e.y > B.WY - 210) { B.hit(e, a * 0.8, 'blade', h); B.push(e, 12); }
          });
        } },
    },
    chengong: {
      passive: { name: '智迟', desc: '放完大招后 6 秒内出手速度 +50%', onUlt(B, h) { B.haste(h, 6, 1.5); } },
      ult: { aim: true, desc: '明策困兽：在敌人最密的地方布下困阵 5 秒，阵里的敌人寸步难行、持续中毒，收阵时炸开 ×3（觉醒 7.5 秒）',
        cast(B, h, a, k) {
          const p = B.at(140); if (!p) return; const x = p.x, y = p.y, life = 5 * k;
          B.tex('net', x, y, { w: 300, h: 210, life: life, fadeIn: 0.2, spin: 0.5, a: 0.9 });
          B.pool(h, x, y, 135, life, a * 0.5, 'poison');
          for (let i = 0; i < Math.round(life / 0.5); i++) B.later(i * 0.5, () => B.area(x, y, 140, e => B.slow(e, 0.8)));
          B.area(x, y, 140, e => B.stun(e, 1.2));
          B.later(life, () => { B.tex('net', x, y, { w: 300, h: 210, life: 0.3, grow: 0.3, a: 0.9 }); B.ring(x, y, 140, 10, 0.3, '#b8ff80', 5); B.burst(x, y, 20, '#a8f070', 240, 4, 0.5); B.area(x, y, 140, e => B.hit(e, a * 3, 'poison', h)); });
        } },
    },
    madai: {
      passive: { name: '斩将', desc: '对生命低于 35% 的敌人伤害 +60%', dmg(B, h, e) { return e.hp < e.max * 0.35 ? 1.6 : 1; } },
      ult: { desc: '背后一刀：绕到场上最壮的 5 个敌人背后各捅一刀 ×9 并眩晕 0.8 秒，砍死一个回 8 点怒气（觉醒 8 个）',
        cast(B, h, a, k) {
          const n = R(5, k);
          for (let i = 0; i < n; i++) B.later(i * 0.12, () => {
            const L = B.lives().filter(e => !e._md).sort((p, q) => q.hp - p.hp); const t = L[0] || B.lives()[0]; if (!t) return;
            t._md = 1; B.later(1, () => { t._md = 0; });
            B.tex('dagger', t.x + 8, t.y - 96, { w: 34, h: 102, life: 0.16, vy: 520, a: 1 });
            B.later(0.14, () => {
              if (t.dead) return;
              B.tex('slash', t.x, t.y - 8, { w: 120, h: 50, rot: 1.9, life: 0.2, grow: 1.2, rgb: '255,240,150', a: 0.95 }); B.bolt(t.x + 6, t.y - 70, t.x, t.y - 6, 1.2);
              B.hit(t, a * 9, 'thunder', h); B.stun(t, 0.8);
              if (t.dead) B.rage(h, 8);
            });
          });
        } },
    },
    gongsunzan: {
      passive: { name: '白马义从', desc: '每第 5 次出手改为三箭齐射，另外两支射向别的敌人',
        onAttack(B, h, tg, d) { if (h.n % 5 === 0) for (let i = 0; i < 2; i++) { const t2 = B.rnd(); if (t2) B.arrow(h, t2, d); } } },
      ult: { aim: true, desc: '白马合围：白马义从绕着敌人最密的地方跑成一圈，边跑边朝圈里放箭，共 14 支贯穿箭、每支 ×1.5（觉醒 21 支）',
        cast(B, h, a, k) {
          const p = B.at(140); if (!p) return; const n = R(14, k), x = p.x, y = p.y;
          B.tex('circle', x, y, { w: 420, h: 300, life: n * 0.07 + 0.5, fadeIn: 0.15, rgb: '235,245,255', a: 0.45, spin: 2.2 });
          for (let i = 0; i < n; i++) B.later(i * 0.07, () => {
            const g = i * 2.4, sx = x + Math.cos(g) * 205, sy = y + Math.sin(g) * 145;              // 2.4 弧度一跳，绕着圈换位置
            B.tex('wind_line', sx, sy, { w: 110, h: 26, rot: g + Math.PI / 2, life: 0.3, rgb: '255,255,255', a: 0.85 });   // 马跑过扬起的一道白尘
            B.blade(h, sx, sy, Math.atan2(y - sy, x - sx) + (Math.random() - 0.5) * 0.3, { look: 'arrow', el: 'arrow', w: 24, spd: 760, dmg: a * 1.5, life: 0.55, rgb: '240,248,255' });
          });
        } },
    },
    /* —— 紫 —— */
    zhanghe: {
      passive: { name: '巧变', desc: '对被减速、被定住的敌人伤害 +30%', dmg(B, h, e) { return e.slow > 0 || e.frozen > 0 ? 1.3 : 1; } },
      ult: { desc: '巧变移阵：把离城最近的 8 个敌人卷上天、扔回阵后，每个受到 ×4 伤害，落地再眩晕 1.2 秒并砸伤周围的敌人 ×2（觉醒 12 个）',
        cast(B, h, a, k) {
          const L = B.lives().slice().sort((p, q) => q.y - p.y).slice(0, R(8, k));
          B.flash('160,255,225', 0.18, 0.35);
          L.forEach((e, i) => B.later(i * 0.07, () => {
            if (e.dead) return;
            B.tex('wind_funnel', e.x, e.y + 10, { w: 70, h: 110, ay: 1, life: 0.45, grow: 1.2, a: 0.9 });
            B.hit(e, a * 4, 'wind', h); B.push(e, 300);
            B.later(0.3, () => { if (e.dead) return; B.stun(e, 1.2); B.ring(e.x, e.y, 8, 70, 0.3, '#9ff5d8', 4); B.area(e.x, e.y, 75, o => { if (o !== e) B.hit(o, a * 2, 'wind', h); }); });
          }));
        } },
    },

    /* ======================= v1.4 收服来的敌将：大招就是他们当敌将时用的那一招 ======================= */
    chengyuanzhi: {
      passive: { name: '黄巾渠帅', desc: '攻击 +8%；每有一名黄巾旧部（张角、张宝、管亥、裴元绍）在阵再 +4%',
        aura(ctx) { let n = 0; ['zhangjiao', 'zhangbao', 'guanhai', 'peiyuan'].forEach(id => { if (ctx.has(id)) n++; }); ctx.self.atk *= 1.08 + 0.04 * n; } },
      ult: { desc: '黄巾聚义：一排黄巾兵从城门杀出去，一路冲到阵后，撞上的敌人受到 ×1.8 伤害并被顶退（觉醒 ×2.7）',
        cast(B, h, a, k) {
          B.flash('255,210,90', 0.18, 0.35);
          for (let i = 0; i < 6; i++) B.later(i * 0.05, () => B.blade(h, 68 + i * 81 + (Math.random() - 0.5) * 14, B.WY - 24, -Math.PI / 2, { w: 78, spd: 380 + Math.random() * 60, dmg: a * 1.8 * k, push: 16, life: 1.9, big: true, tex: 'soldier', texW: 46, solid: true }));
        } },
    },
    gaoshun: {
      passive: { name: '攻无不克', desc: '对刀盾兵、重甲兵、冲车伤害 +50%', dmg(B, h, e) { return e.def.id === 'shield' || e.def.id === 'heavy' || e.def.id === 'ram' ? 1.5 : 1; } },
      ult: { desc: '陷阵营：城头架起盾阵 6 秒，城墙受到的伤害减半；靠近城墙的敌人被盾撞开，受到 ×3.5 伤害并眩晕 1 秒（觉醒 9 秒）',
        cast(B, h, a, k) {
          const life = 6 * k; B.guard(life, 0.5);
          B.tex('circle', B.W / 2, B.WY - 6, { w: 560, h: 110, life: life, fadeIn: 0.2, rgb: '130,200,255', a: 0.55, spin: 0.4 });
          for (let i = 0; i < 7; i++) B.later(i * 0.04, () => B.tex('pillar', 54 + i * 72, B.WY + 4, { w: 60, h: 150, ay: 1, life: 0.7, fadeIn: 0.08, rgb: '150,210,255', a: 0.8 }));
          B.ring(B.W / 2, B.WY - 10, 40, 300, 0.45, '#9fd6ff', 5); B.shake(0.15);
          for (const e of B.lives()) if (e.y > B.WY - 260) { B.hit(e, a * 3.5, 'ice', h); B.stun(e, 1); B.push(e, 30); }
        } },
    },
    caochun: {
      passive: { name: '虎豹骑', desc: '旋风推进速度 +40%，出手速度 +8%', mod: { tspd: 0.4, spd: 0.08 } },
      ult: { desc: '虎豹骑：5 骑从战场一侧横冲到另一侧，专挑有敌人的地方踏过去，每骑 ×1.9 并把敌人撞退（觉醒 8 骑）',
        cast(B, h, a, k) {
          const n = R(5, k);
          for (let i = 0; i < n; i++) B.later(i * 0.16, () => {
            const L = B.lives(); if (!L.length) return;
            const t = L[(i * 4 + 1) % L.length], left = i % 2 === 0;                                      // 每一骑对着一个敌人所在的那一排冲
            B.blade(h, left ? -30 : B.W + 30, t.y, left ? 0 : Math.PI, { w: 74, spd: 760, dmg: a * 1.9, push: 22, life: 0.85, big: true, el: 'wind', tex: 'horse_side', texW: 104, solid: true, rgb: '190,255,235' });
          });
        } },
    },
    yanliang: {
      passive: { name: '勇冠三军', desc: '对生命高于 70% 的敌人伤害 +35%', dmg(B, h, e) { return e.hp > e.max * 0.7 ? 1.35 : 1; } },
      ult: { desc: '突阵：策马从敌人最密的地方直冲到阵后，沿途 ×5 并把敌人撞开；冲到头拨马杀回来再砍一遍 ×2.5（觉醒 ×7.5）',
        cast(B, h, a, k) {
          const p = B.at(120) || B.front(); if (!p) return; const x = Math.max(70, Math.min(B.W - 70, p.x));
          const o = { w: 130, spd: 620, big: true, rgb: '255,205,160' };
          B.shake(0.25); B.ring(x, B.WY - 30, 10, 90, 0.35, '#ffcf9a', 5);
          B.blade(h, x, B.WY - 20, -Math.PI / 2, Object.assign({ dmg: a * 5 * k, push: 34, life: 0.95, tex: 'horse', texW: 92, solid: true }, o));   // 冲出去是背影
          B.later(1.0, () => B.blade(h, x + (x < B.W / 2 ? 90 : -90), B.TOP + 10, Math.PI / 2, Object.assign({ dmg: a * 2.5 * k, life: 0.9, color: 'red' }, o)));   // 杀回来的是一道红色的大刀气
        } },
    },
    wenchou: {
      passive: { name: '河北上将', desc: '每第 3 次出手多射一箭，射向离城最近的敌人',
        onAttack(B, h, tg, d) { if (h.n % 3 === 0) { const t = B.front(); if (t) B.arrow(h, t, d); } } },
      ult: { desc: '回马连珠：连发 10 支贯穿重箭，每支都瞄着当时离城最近的敌人，×2.8 并把他钉退（觉醒 15 支）',
        cast(B, h, a, k) {
          const n = R(10, k);
          for (let i = 0; i < n; i++) B.later(i * 0.11, () => {
            const t = B.front(); if (!t) return;
            const sx = h.x + (i % 2 ? 16 : -16), sy = h.y - 24;
            B.blade(h, sx, sy, Math.atan2(t.y - sy, t.x - sx), { look: 'arrow', el: 'arrow', w: 34, spd: 900, dmg: a * 2.8, push: 18, life: 1.0, big: true, rgb: '255,235,170' });
            B.tex('burst', sx, sy, { w: 36, life: 0.1, rgb: '255,240,200' });
          });
        } },
    },
    menghuo: {
      passive: { name: '南蛮王', desc: '毒潭范围 +20%，攻击 +10%', mod: { r: 0.2, atk: 0.1 } },
      ult: { desc: '驱象踏阵：三头战象从城下冲出去，一路踩到阵后，被踩到的敌人受到 ×4 伤害、眩晕 1.2 秒（觉醒 ×6）',
        cast(B, h, a, k) {
          B.shake(0.4);
          const d = B.dense(130), xs = d ? [d.x, d.x - 150, d.x + 150] : [270, 120, 420];
          xs.forEach((x, i) => B.later(i * 0.22, () => {
            const cx = Math.max(80, Math.min(B.W - 80, x < 60 ? x + 300 : x > B.W - 60 ? x - 300 : x));
            const sh = { k: 'blade' };
            B.blade(h, cx, B.WY - 10, -Math.PI / 2, { w: 120, spd: 330, dmg: a * 4 * k, life: 2.2, big: true, push: 10, tex: 'elephant', texW: 116, solid: true });
            for (let j = 0; j < 7; j++) B.later(j * 0.3, () => { const y = B.WY - 40 - j * 99; if (y > B.TOP) { B.shock(cx, y, 90, 0.35); B.area(cx, y, 70, e => B.stun(e, 1.2)); B.burst(cx, y + 20, 5, '#c8a878', 150, 3, 0.4); } });
          }));
        } },
    },
    dongzhuo: {
      passive: { name: '暴虐', desc: '对燃烧中的敌人伤害 +30%', dmg(B, h, e) { return e.burn > 0 ? 1.3 : 1; } },
      ult: { desc: '火烧洛阳：全场燃起大火，所有敌人受到 ×1.8 伤害、灼烧 6 秒，并吓得后退 1.5 秒（敌将不退，觉醒 9 秒）',
        cast(B, h, a, k) {
          B.flash('255,90,40', 0.32, 0.6); B.shake(0.3); Sfx.play('boom');
          for (let i = 0; i < 14; i++) B.later(i * 0.05, () => B.tex('flame', 40 + Math.random() * (B.W - 80), B.TOP + 60 + Math.random() * (B.WY - B.TOP - 120), { w: 90, h: 170, ay: 1, life: 1.3, fadeIn: 0.1, a: 0.8 }));
          for (const e of B.lives()) { B.hit(e, a * 1.8, 'fire', h); B.burn(e, 6 * k, a * 0.4, h); if (e.def.id !== 'boss') B.fear(e, 1.5); }
        } },
    },
    xiahoudun: {
      passive: { name: '独眼', desc: '暴击伤害 +50%；城防低于一半时自身伤害 +15%', mod: { critDmg: 0.5 }, dmg(B) { return B.S.wall < B.S.wallMax * 0.5 ? 1.15 : 1; } },
      ult: { desc: '拔矢啖睛：一声怒吼，朝敌人最密的三处各劈一刀，每刀 ×3.5 起、城防每损失 10% 再 +0.4，波及一大片并吓退 1.5 秒；之后 6 秒自身必定暴击（觉醒 9 秒）',
        cast(B, h, a, k) {
          const lost = 1 - Math.max(0, B.S.wall) / B.S.wallMax, m = 3.5 + lost * 4;
          B.flash('255,60,40', 0.25, 0.4); B.tex('burst', h.x + 6, h.y - 44, { w: 90, life: 0.5, grow: 1.6, rgb: '255,70,50' });     // 眼里冒出的红光
          h.critT = 6 * k;
          const done = [];
          for (let i = 0; i < 3; i++) B.later(0.15 + i * 0.2, () => {
            const L = B.lives().filter(e => done.every(p => Math.hypot(p.x - e.x, p.y - e.y) > 140)); const pool = L.length ? L : B.lives(); if (!pool.length) return;
            let t = pool[0], best = -1; for (const e of pool) { let n = 0; for (const o of pool) if (Math.hypot(o.x - e.x, o.y - e.y) < 110) n++; if (n > best) { best = n; t = e; } }
            const x = t.x, y = t.y; done.push({ x, y });
            B.tex('slash', x, y - 6, { w: 300, h: 120, rot: -0.5 + i * 0.5, life: 0.26, grow: 1.2, rgb: '255,90,70', a: 1 }); B.tex('slash', x, y - 6, { w: 220, h: 70, rot: -0.5 + i * 0.5, life: 0.2, grow: 1.2, rgb: '255,240,230', a: 0.9 });
            B.ring(x, y, 10, 130, 0.35, '#ff7a5a', 5); B.shake(0.2);
            B.area(x, y, 130, e => { B.hit(e, a * m, 'blade', h); if (e.def.id !== 'boss') B.fear(e, 1.5); });
          });
        } },
    },
  };
})();
