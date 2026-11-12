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
      ult: { desc: '巨斧落雷劈中最前方的敌人，伤害 ×18 并眩晕周围敌人（觉醒 ×27）',
        cast(B, h, a, k) {
          const t = B.front(); if (!t) return;
          B.bolt(t.x, -10, t.x, t.y - 6, 4); B.flash('220,200,255', 0.35, 0.3); B.shake(0.35);
          B.hit(t, a * 18 * k, 'thunder', h); B.stun(t, 2);
          B.area(t.x, t.y, 90, e => { if (e !== t) { B.hit(e, a * 5, 'thunder', h); B.stun(e, 1); } });
          B.ring(t.x, t.y, 10, 80, 0.4, '#c4b0ff', 5);
        } },
    },
    mifang: {
      passive: { name: '南郡守将', desc: '普攻命中的敌人 2 秒内受到的伤害 +12%',
        onHit(B, h, e) { B.vuln(e, 2, 0.12); } },
      ult: { desc: '在城墙前竖起一排冰刺 5 秒，踩上去的敌人被冻住 1.5 秒（觉醒 7.5 秒）',
        cast(B, h, a, k) { B.zone({ k: 'icewall', h, y: B.WY - 80, life: 5 * k, dmg: a * 4, stun: 1.5 }); } },
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
        cast(B, h, a, k) { [120, 270, 420].forEach(x => B.tornado(h, x, B.WY - 30, { r: 70, life: 4 * k, dmg: a * 0.9, push: 16, vy: -70, big: true })); } },
    },

    /* ======================= 蓝 ======================= */
    xuhuang: {
      passive: { name: '断粮', desc: '刀气命中的敌人减速 1.5 秒', onHit(B, h, e) { B.slow(e, 1.5); } },
      ult: { desc: '横扫整条战线的刀浪，由城下推到远方，伤害 ×3.5 并减速（觉醒 ×5.25）',
        cast(B, h, a, k) { B.sweep(h, a * 3.5 * k, { slow: 3 }); B.shake(0.2); } },
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
        cast(B, h, a, k) { B.zone({ k: 'barrier', h, y: B.WY - 110, life: 6 * k, dmg: a * 0.6, push: 22 }); } },
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
          B.ring(p.x, p.y, 20, 150, 0.5, '#cfefff', 7); B.flash('180,230,255', 0.3, 0.5);
          B.area(p.x, p.y, 150, e => B.stun(e, t));
          B.zone({ k: 'frost', x: p.x, y: p.y, r: 150, life: t });
          B.later(t, () => { B.area(p.x, p.y, 160, e => B.hit(e, a * 6, 'ice', h)); B.burst(p.x, p.y, 30, '#e8f8ff', 260, 5, 0.6); B.ring(p.x, p.y, 20, 170, 0.4, '#ffffff', 5); });
        } },
    },
    taishici: {
      passive: { name: '信义笃烈', desc: '对校尉、敌将伤害 +40%', dmg(B, h, e) { return big(e) ? 1.4 : 1; } },
      ult: { desc: '天义斩：对最前方的敌人连斩 5 刀，每刀 ×3 并波及周围（觉醒 8 刀）',
        cast(B, h, a, k) {
          const n = R(5, k);
          for (let i = 0; i < n; i++) B.later(i * 0.12, () => {
            const t = B.front(); if (!t) return;
            B.slash(t.x, t.y); B.hit(t, a * 3, 'blade', h);
            B.area(t.x, t.y, 55, e => { if (e !== t) B.hit(e, a * 1.2, 'blade', h); });
          });
        } },
    },

    /* ======================= 金 ======================= */
    guanyu: {
      passive: { name: '武圣', desc: '攻击 +20%；亲手击杀敌人恢复 5 怒气', mod: { atk: 0.2 }, onKill(B, h) { B.rage(h, 5); } },
      ult: { aim: true, desc: '青龙偃月：月牙巨刃贯穿全场 ×6，之后 4 秒普攻刀气变大（觉醒 ×9、6 秒）',
        cast(B, h, a, k) {
          const p = B.at(110); if (!p) return;
          B.blade(h, h.x, h.y - 22, Math.atan2(p.y - h.y, p.x - h.x), { w: 260, spd: 480, dmg: a * 6 * k, big: true, life: 2.6, color: 'green', tex: 'dragon_azure', texW: 380 });
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
      ult: { desc: '七进七出：7 道冰枪在敌阵中左右穿梭，伤害 ×3 并减速（觉醒 10 道）',
        cast(B, h, a, k) {
          const n = R(7, k);
          for (let i = 0; i < n; i++) B.later(i * 0.14, () => {
            const fromL = i % 2 === 0, y0 = B.TOP + 40 + Math.random() * (B.WY - B.TOP - 120), y1 = B.TOP + 40 + Math.random() * (B.WY - B.TOP - 120);
            const x0 = fromL ? -20 : B.W + 20, x1 = fromL ? B.W + 20 : -20;
            B.blade(h, x0, y0, Math.atan2(y1 - y0, x1 - x0), { look: 'ice', el: 'ice', w: 60, spd: 900, dmg: a * 3, slow: 2, life: 1.2, big: true, tex: 'dragon_white', texW: 190 });
          });
        } },
    },
    simayi: {
      passive: { name: '冢虎', desc: '被毒死的敌人原地留下一小片毒潭',
        onKill(B, h, e, el) { if (el === 'poison') B.pool(h, e.x, e.y, 40, 2, h.atk * 0.5, 'poison'); } },
      ult: { desc: '鬼谋：全场敌人 6 秒内受到的伤害 +35% 并持续中毒（觉醒 9 秒）',
        cast(B, h, a, k) {
          B.flash('80,40,120', 0.3, 0.6);
          for (const e of B.lives()) { B.vuln(e, 6 * k, 0.35); B.poison(e, 6 * k, a * 0.5, h); B.mark(e, 6 * k); B.tex('el_hit_dark', e.x, e.y - 10, { w: 70, life: 0.5, grow: 1.3 }); }
        } },
    },

    /* ======================= 橙 ======================= */
    zhugeliang: {
      passive: { name: '卧龙', desc: '全军大招伤害 +15%', aura(ctx) { ctx.S.buffs.ult *= 1.15; } },
      ult: { desc: '借东风：6 秒东风把敌人持续吹回，全军出手速度 +50%、火系伤害 +50%，其他武将怒气 +20（觉醒 9 秒）',
        cast(B, h, a, k) {
          const t = 6 * k;
          B.zone({ k: 'wind', h, life: t, dmg: a * 0.9, push: 12 });
          B.teamHaste(t, 1.5); B.teamRage(20, h); B.S.windT = t;
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
          for (let i = 0; i < n; i++) B.later(i * 0.25, () => B.blade(h, h.x, h.y - 22, -Math.PI / 2 + (Math.random() - 0.5) * 2.2, { w: 120, spd: 520, dmg: a * 1.8, big: true, life: 2.2, color: 'red' }));
          B.shake(0.3);
        } },
    },
    caocao: {
      passive: { name: '乱世奸雄', desc: '全军攻击 +10%；任何人击杀校尉或敌将时，全军怒气 +15',
        aura(ctx) { ctx.S.buffs.atk *= 1.10; },
        onAnyKill(B, h, e) { if (big(e)) B.teamRage(15); } },
      ult: { desc: '万箭齐发：三轮箭雨覆盖全场，每轮 35 支并减速（觉醒四轮半）',
        cast(B, h, a, k) {
          const rounds = 3 * k;
          for (let i = 0; i < Math.round(35 * rounds); i++) B.later(i * 0.03 + Math.floor(i / 35) * 0.35, () => {
            const t = B.rnd(); if (!t) return;
            B.rain(h, t.x + (Math.random() - 0.5) * 24, t.y, a * 1.2, 0.8);
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
  };
})();
