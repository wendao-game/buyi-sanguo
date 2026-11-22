'use strict';
/* ============================================================
 * 界面：主城 / 武将 / 招募 / 战斗 HUD / 各类弹窗
 * 所有可点击元素用 data-act 标记，统一在 ACT 里处理
 * ============================================================ */

const UI = (function () {
  const $ = s => document.querySelector(s);
  let screen = 'home', heroTab = 'mine', closable = true, toastTimer = 0, pickSlot = -1;
  let lastPickHero = null;
  let hudS = null, hudRage = [], hudRock = '', hudSec = -1, hudVer = -1, lpDraft = null, lpSel = null, buffCb = null, reviveCb = null, lastRes = null, adTimer = 0, adResolve = null;

  const fmt = n => (n >= 100000 ? (n / 10000).toFixed(1) + '万' : String(Math.floor(n)));
  const P = (id, px) => Art.portrait(id, px || 64);
  const WI = (id, px) => Art.weaponIcon(id, px || 64);
  const pct = v => '+' + (Math.round(v * 1000) / 10) + '%';
  const wtext = st => Object.keys(st).map(k => WSTATS[k] + ' ' + pct(st[k])).join('、');
  const stars = n => '<span class="stars">' + '★'.repeat(n) + '</span>' + '☆'.repeat(CFG.MAX_STAR - n);
  const qc = id => QUALITIES[HERO_MAP[id].q].color;

  /* 新手提示条：每个 key 只出现一次（记在存档里），几秒后自己消失，点一下也会关 */
  let tipTimer = 0;
  function tip(key, html, ms) {
    const T = Save.data.tips || (Save.data.tips = {});
    if (T[key]) return false;
    T[key] = 1; Save.save();
    const el = $('#tipbar'); el.innerHTML = html; el.classList.add('on');
    clearTimeout(tipTimer); tipTimer = setTimeout(hideTip, ms || 7000);
    return true;
  }
  function hideTip() { clearTimeout(tipTimer); $('#tipbar').classList.remove('on'); }
  const tipShown = () => $('#tipbar').classList.contains('on');

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 1600);
  }
  /* 重画之后滚动位置留在原处（不然在详情里滑到下面点一下升级，整个弹窗弹回最上面；图鉴翻到一半点一个武将，回来又是从头）。
   * scrollSnap 记下 root 里所有滚动过的元素（按 标签.类名 认），scrollPut 重画之后放回去 */
  function scrollSnap(root) {
    const out = [];
    root.querySelectorAll('*').forEach(el => { if (el.scrollTop > 0) out.push([el.tagName + '.' + el.className, el.scrollTop]); });
    return out;
  }
  function scrollPut(root, snap) {
    if (!snap || !snap.length) return;
    const all = root.querySelectorAll('*');
    snap.forEach(x => { for (let i = 0; i < all.length; i++) if (all[i].tagName + '.' + all[i].className === x[0]) { all[i].scrollTop = x[1]; break; } });
  }
  /* 弹窗：按标题认是不是「同一个弹窗」。同一个重画（升级、升星、换兵器之后），或者中间弹了个确认框又回来，都回到原来滑到的位置；关掉弹窗就忘掉 */
  const modalTitle = m => { const t = m.querySelector('h2, h3'); return t ? t.textContent : ''; };
  let modalScroll = {};
  function modal(html, canClose) {
    closable = canClose !== false;
    const m = $('#modal');
    if (m.classList.contains('on')) { const t = modalTitle(m); if (t) modalScroll[t] = scrollSnap(m); }
    m.innerHTML = html; m.classList.add('on');
    scrollPut(m, modalScroll[modalTitle(m)]);
  }
  function closeModal() { const m = $('#modal'); m.classList.remove('on'); m.innerHTML = ''; modalScroll = {}; }

  /* ---------------- 页面切换 ---------------- */
  function show(tab) {
    screen = tab; $('#app').dataset.screen = tab; lpDraft = null;
    hideTip();                                              // 上一个页面的提示不带过来
    Sfx.music(tab === 'battle' ? 'battle' : 'home');
    document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    render();
  }
  let viewKey = '', viewScroll = null;
  function render() {
    $('#tCoins').textContent = fmt(Save.data.coins);
    $('#tTickets').textContent = fmt(Save.data.tickets);
    const root = $('#' + screen), key = screen + '|' + heroTab;   // 同一页重画（没换页、没换「我的武将 / 图鉴」）：列表留在原来翻到的地方
    const snap = root && key === viewKey ? scrollSnap(root) : null;
    if (screen === 'home') renderHome();
    else if (screen === 'heroes') renderHeroes();
    else if (screen === 'gacha') renderGacha();
    else if (screen === 'arms') renderArms();
    if (root) scrollPut(root, snap);
    viewKey = key;
  }

  /* ---------------- 主城 ---------------- */
  function renderHome() {
    const D0 = Save.data, fresh = D0.draws === 0 && D0.tickets >= 10;
    const nb = document.querySelector('#nav button[data-tab=gacha]'); if (nb) nb.classList.toggle('hint', fresh);
    // 前期（前 20 关）阵容里有金币够、等级还低的武将：「武将」按钮闪一闪。等级追上关卡数就不闪了
    const lvOK = !fresh && D0.stage <= 20 && teamCanLevel();
    const nh = document.querySelector('#nav button[data-tab=heroes]'); if (nh) nh.classList.toggle('hint', lvOK);
    if (fresh) tip('home1', '你有 <b>10 张招募令</b>：先去<b>「招募」</b>十连，凑满 5 名武将再出征', 10000);
    else if (lvOK && D0.stage >= 3) tip('lvup1', '金币够<b>升级武将</b>了：去<b>「武将」</b>页点武将，前几级只要几个金币，是涨战力最快的办法（头像上有「升」的就能升）', 10000);
    else if (Object.keys(D0.weapons).length && !Object.keys(D0.weapons).some(id => D0.weapons[id].hero)) tip('arms1', '你抽到了<b>兵器</b>：去<b>「兵器」</b>页装给武将，能加攻击和出手速度；通关给的<b>精铁</b>可以强化它', 9000);
    else if (D0.stage > 1) tip('home2', '打过的关卡可以<b>扫荡</b>直接领金币；金币能升级武将，也能换招募令', 9000);
    const S = Save.data, st = S.pick, ch = chapterOf(st), cleared = st < S.stage, pw = teamPower(), rec = stageRecommend(st);
    $('#home').innerHTML = `
      <div class="logo"><span>三国</span><b>孤城万仞</b></div>
      <div class="stagecard">
        <div class="chap">${ch.endless ? ch.name + (S.stage > 81 ? ' · 最高第 ' + (S.stage - 81) + ' 层' : '') : '第 ' + ch.index + ' 章 · ' + ch.name}</div>
        <div class="stagesel">
          ${S.stage > 20 ? `<button class="jump" data-act="stage" data-d="-10" ${st <= 1 ? 'disabled' : ''}>«</button>` : ''}
          <button data-act="stage" data-d="-1" ${st <= 1 ? 'disabled' : ''}>◀</button>
          <div class="sname">第 ${ch.endless || ch.sub} ${ch.endless ? '层' : '关'}<small class="${cleared ? '' : 'new'}">${cleared ? '已通关 · 可重复挑战' : (ch.endless ? '未通关' : ch.sub === 10 ? '章节决战' : '未通关')}</small></div>
          <button data-act="stage" data-d="1" ${st >= S.stage ? 'disabled' : ''}>▶</button>
          ${S.stage > 20 ? `<button class="jump" data-act="stage" data-d="10" ${st >= S.stage ? 'disabled' : ''}>»</button>` : ''}
        </div>
        <div class="powers"><span>推荐战力 ${rec}</span><span class="${pw >= rec ? 'ok' : 'bad'}">我方战力 ${pw}</span></div>
        <div class="reward">通关奖励：金币 ×${Math.round(stageWinCoins(st) * (cleared ? CFG.REPLAY_COIN : 1))}、精铁 ×${Math.max(1, Math.round(stageIron(st) * (cleared ? CFG.REPLAY_COIN : 1)))} + 战场掉落${cleared ? '（已通关，奖励减半）' : '<br>首通再得：招募令 ×' + (st % 10 === 0 ? 5 : 1)}</div>
        <div class="intel">${intel(st)}</div>
        <div class="fightrow">
          ${!cleared ? '' : !sweepLeft() && sweepAdLeft() && AdService.available()
            ? `<button class="btn sweep" data-act="sweepAd">▶ 广告扫荡<small>金币 ×${sweepReward(st)} · 还可看 ${sweepAdLeft()} 次</small></button>`
            : `<button class="btn sweep ${sweepLeft() ? '' : 'gray'}" data-act="sweep">扫荡<small>金币 ×${sweepReward(st)} · 今日 ${sweepLeft()}/${CFG.SWEEP_DAILY}</small></button>`}
          <button class="btn-big ${cleared ? 'small' : ''}" data-act="fight">出征</button>
        </div>
        ${pw < rec ? '<div class="tip">战力不足？去「武将」页升级武将、凑羁绊、调站位；战斗中点战场可以投石</div>' : ''}
      </div>
      ${homeRow()}
      <div class="homefoot"><button class="link" data-act="settings">设置 · 存档</button>${S.enc && S.enc.seen && Object.keys(S.enc.seen).length ? '<button class="link" data-act="encLog">奇遇录</button>' : ''}${Rank.ok() ? '<button class="link" data-act="rank">排行榜</button>' : ''}<div id="cloudNote" class="cloudnote">${Cloud.note()}</div></div>
      <p class="ainote">AI 合成内容 · 游戏中的美术含 AI 生成内容</p>`;   // TapTap「AI接入声明」要的游戏内标识：主城最下面一行小字
    Rank.sync(false);
  }
  /* 主城下面一排四个入口：每日军饷、挂机军饷、每日试炼、城池科技 */
  function homeRow() {
    const S = Save.data, idle = idleInfo(), tr = trialToday(), tOpen = trialOpen(), tDone = tOpen && trialDone();
    const hm = h => { const m = Math.floor(h * 60); return m < 60 ? m + ' 分钟' : Math.floor(m / 60) + ' 时 ' + (m % 60) + ' 分'; };
    return `<div class="longrow quad">
        <button class="lbtn ${dailyReady() ? 'hot' : 'done'}" data-act="daily"><b>每日军饷</b><small>${dailyReady() ? '可领取' : Clock.waiting() ? '校准时间中' : '明天再来'}</small></button>
        <button class="lbtn ${idle.h >= 1 ? 'hot' : ''}" data-act="idle"><b>挂机军饷</b><small>${idle.full ? '已攒满' : '已攒 ' + hm(idle.h)}</small></button>
        <button class="lbtn ${!tOpen ? 'lock' : tDone ? 'done' : 'hot'}" data-act="trial"><b>每日试炼</b><small>${!tOpen ? '第 ' + CFG.TRIAL.open + ' 关后开放' : tDone ? (Clock.waiting() ? '校准时间中' : '今天已领') : tr.name}</small></button>
        <button class="lbtn ${techOpen() ? (CFG.TECH.some(t => (S[t.cur] || 0) >= techCost(t.id)) ? 'hot' : '') : 'lock'}" data-act="tech"><b>城池科技</b><small>${techOpen() ? 'Lv ' + CFG.TECH.reduce((a, t) => a + techLv(t.id), 0) : '8 章后开放'}</small></button>
      </div>${S.stage >= CFG.RUSH.show ? `<div class="longrow rushrow"><button class="lbtn rush ${!rushOpen() ? 'lock' : rushDayDone() ? '' : 'hot'}" data-act="rush"><b>过关斩将</b><small>${!rushOpen() ? '打进无尽后开放 · 只打敌将的车轮战' : '最佳 ' + rushRec().best + ' 将' + (rushDayDone() ? ' · 敌将一个接一个' : ' · 今日首局有将魂')}</small></button></div>` : ''}`;
  }
  /* 挂机军饷 */
  function idlePanel() {
    const r = idleInfo(), adOK = AdService.available();
    modal(`<div class="mbox"><button class="x" data-act="close">×</button><h2>挂机军饷</h2>
      <p class="mtext">不在线时城里也在攒军饷：每小时 <b>金币 ×${fmt(r.perH)}</b>（按最高通关的关卡算），最多攒 ${CFG.IDLE.maxH} 小时。</p>
      <div class="idlebox"><b>金币 ×${fmt(r.coins)}</b><small>${r.full ? '已经攒满，快领吧' : '已攒 ' + (Math.floor(r.h * 10) / 10) + ' / ' + CFG.IDLE.maxH + ' 小时'}</small></div>
      <div class="mrow"><button class="btn ${r.coins ? 'gold' : 'gray'}" data-act="idleGet">领取</button>${adOK ? `<button class="btn red" data-act="idleAd">▶ 看广告双倍<small>金币 ×${fmt(r.coins * 2)}</small></button>` : ''}</div></div>`);
  }
  /* 每日试炼 */
  function trialPanel() {
    if (!trialOpen()) return modal(`<div class="mbox"><button class="x" data-act="close">×</button><h2>每日试炼</h2><p class="mtext">通关第 ${CFG.TRIAL.open} 关后开放。每天一条特殊规则，赢了领精铁、将魂和招募令。</p></div>`);
    const t = trialToday(), st = trialStage(), rw = trialReward(st), done = trialDone(), team = trialTeam(t);
    const facNote = t.fac ? (team ? '<br>会自动派出你最强的' + facName(t.fac) + '阵容（' + team.filter(Boolean).length + ' 人），打完换回原阵容' : '<br><b class="bad">你还没有' + facName(t.fac) + '武将</b>') : '';
    modal(`<div class="mbox"><button class="x" data-act="close">×</button><h2>每日试炼</h2>
      <p class="mtext">今日：<b>「${t.name}」</b>${t.desc}${facNote}</p>
      <p class="mtext" style="font-size:13.5px">关卡：第 ${st} 关的敌军（${chapterOf(st).endless ? '无尽' : '第 ' + chapterOf(st).index + ' 章'}）· 每天换一条规则，明天是「${TRIALS[(TRIALS.indexOf(t) + 1) % TRIALS.length].name}」</p>
      <div class="idlebox"><b>${done ? '今天的奖励已领' : '首胜奖励'}</b><small>精铁 ×${rw.iron} · 将魂 ×${rw.soul} · 招募令 ×${rw.tickets}${done ? '（明天再来；今天还能再打，只得掉落金币）' : ''}</small></div>
      <div class="mrow"><button class="btn red" data-act="trialGo" ${t.fac && !team ? 'disabled' : ''}>出战</button></div></div>`);
  }
  /* ---------------- 名将列传（v2.18） ---------------- */
  const missingNames = L => legendNeed(L).filter(x => !heroOwn(x)).map(x => HERO_MAP[x].name).join('、');
  /* 武将详情里的一行：这名武将有列传就显示 */
  function legendLine(id) {
    const L = LEGENDS.find(l => l.hero === id); if (!L) return '';
    const open = legendOpen(L), done = legendDone(L);
    return `<div class="lgline"><b>名将列传 · ${L.name}</b><span>${done ? '已完成' : open ? '可挑战' : '需要拥有：' + missingNames(L)}</span>${open ? `<button class="link" data-act="legendGo" data-id="${L.id}">${done ? '再战' : '挑战'} ›</button>` : ''}</div>`;
  }
  function legendPanel() {
    const n = LEGENDS.filter(legendDone).length, rw = legendReward();
    const rows = LEGENDS.map(L => {
      const open = legendOpen(L), done = legendDone(L), team = open ? legendTeam(L) : null, pw = open ? legendPower(L, team) : 0, rec = stageRecommend(L.stage);
      return `<div class="lgrow ${open ? '' : 'off'} ${done ? 'done' : ''}" style="--qc:${qc(L.hero)}"><img src="${P(L.hero)}">
        <div class="lgtxt"><b>${HERO_MAP[L.hero].name} · ${L.name}</b>${done ? '<i class="lgok">已完成</i>' : ''}<p>${L.story}</p><small>${L.desc}</small>
          <small class="${open ? (pw >= rec ? 'ok' : 'bad') : ''}">${open ? '推荐战力 ' + fmt(rec) + ' · 你的 ' + fmt(pw) : '需要拥有：' + missingNames(L)}</small></div>
        <button class="btn ${open ? 'red' : 'gray'}" data-act="legendGo" data-id="${L.id}" ${open ? '' : 'disabled'}>${done ? '再战' : '挑战'}</button></div>`;
    }).join('');
    modal(`<div class="mbox"><button class="x" data-act="close">×</button><h2>名将列传</h2>
      <p class="mtext" style="font-size:13px">拥有这名武将才能挑战。首通奖励：这名武将的碎片 ×${rw.shards}、将魂 ×${rw.soul}、招募令 ×${rw.tickets}（满星的碎片折成将魂）· 已完成 ${n}/${LEGENDS.length}</p>
      <div class="lglist">${rows}</div></div>`);
  }
  function startLegend(id) {
    const L = LEGEND_MAP[id];
    if (!L) return;
    if (!legendOpen(L)) return toast('需要拥有：' + missingNames(L));
    const team = legendTeam(L), rule = legendRule(L, team);
    Save.data.trialBak = Save.data.team.slice(); Save.data.team = team; Save.save();   // 打完、退出、重开游戏都会换回原阵容（同每日试炼）
    closeModal(); show('battle');
    $('#bSpeed').textContent = '×' + Save.data.speed;
    $('#bAuto').classList.toggle('off', !Save.data.auto);
    Battle.start(L.stage, rule);
  }
  function facName(f) { return f === 'qun' ? '群雄' : FACTIONS[f].name + '国'; }   // 「魏国」「蜀国」「吴国」，群不叫「群国」
  function startTrial() {
    const t = trialToday();
    if (!trialOpen()) return toast('通关第 ' + CFG.TRIAL.open + ' 关后开放');
    if (t.fac) {
      const team = trialTeam(t);
      if (!team) return toast('你还没有' + facName(t.fac) + '武将');
      Save.data.trialBak = Save.data.team.slice(); Save.data.team = team; Save.save();
    }
    if (!Save.data.team.some(Boolean)) return toast('至少上阵一名武将');
    closeModal(); show('battle');
    $('#bSpeed').textContent = '×' + Save.data.speed;
    $('#bAuto').classList.toggle('off', !Save.data.auto);
    Battle.start(trialStage(), t);
  }
  /* ---------------- 过关斩将（v2.19） ---------------- */
  function rushPanel() {
    const R = CFG.RUSH, rec = rushRec(), day = dayNo(), nx = rushRecordReward(rec.best, rec.best + 1);
    if (!rushOpen()) return modal(`<div class="mbox"><button class="x" data-act="close">×</button><h2>过关斩将</h2><p class="mtext">打完主线 80 关、进入无尽后开放。<br>一局里只有敌将：心魔、神魔将、四神兽一个接一个杀来，打到守不住为止。</p></div>`);
    const rows = [1, 2, 3, 4, 5].map(k => { const b = rushBoss(day, k), w = rushWeather(day, k); return `<div class="rsrow"><i>${k}</i><b class="${b.myth ? (HERO_MAP[b.myth].q === 6 ? 'mo' : 'shen') : b.hero ? 'demon' : ''}">${b.name}</b><span>${w.name}</span><small>${b.skills.filter(x => x.cd > 0).map(x => x.name).join('、')}</small></div>`; }).join('');
    const ch = chapterOf(rushStage(1));
    modal(`<div class="mbox"><button class="x" data-act="close">×</button><h2>过关斩将</h2>
      <p class="mtext" style="font-size:13.5px">只有敌将，一个接一个杀来，打到城破或全军覆没为止。<b>中途不回血</b>（带上会回血、护盾、修城的武将），每斩 ${R.buffEvery} 将选一道军令。<br>难度固定：第 1 将相当于无尽第 ${ch.endless} 层，之后每将强一截；第 4 将起带词缀，每将天气不同，每第 5 将是神魔将。</p>
      <div class="rslist"><div class="rshead">今日出场（每天一套，谁打都一样）</div>${rows}<div class="rsmore">……之后的到阵前才知道</div></div>
      <div class="idlebox"><b>最佳纪录 ${rec.best} 将</b><small>破纪录每多斩一将：将魂 ×${nx.soul} 起、精铁 ×${nx.iron} 起、招募令 ×${nx.tickets}<br>${rushDayDone() ? '今天的首局奖励已领（还能再打，破纪录照样有奖）' : '今天第一局：每斩一将再给将魂 ×' + R.daySoul + '（最多算 ' + R.dayCap + ' 将）'}</small></div>
      <div class="mrow">${Rank.ok() && CFG.LB_RUSH ? '<button class="btn gold" data-act="rankRush">排行榜</button>' : ''}<button class="btn red" data-act="rushGo">出战</button></div></div>`);
  }
  function startRush() {
    if (!rushOpen()) return toast('打进无尽后开放');
    if (!Save.data.team.some(Boolean)) return toast('至少上阵一名武将');
    closeModal(); show('battle');
    $('#bSpeed').textContent = '×' + Save.data.speed;
    $('#bAuto').classList.toggle('off', !Save.data.auto);
    Battle.start(rushStage(1), { rush: true, name: '过关斩将', desc: '只有敌将，打到守不住为止' });
  }
  /* 排行榜 */
  function rankPanel() {
    const S = Save.data, st = Rank.stageScore(), ch = chapterOf(Math.max(1, st));
    const where = st <= 0 ? '还没通关' : st <= 80 ? '第 ' + ch.index + ' 章第 ' + ch.sub + ' 关' : '主线全通 + 无尽第 ' + (st - 80) + ' 层';
    modal(`<div class="mbox"><button class="x" data-act="close">×</button><h2>排行榜</h2>
      <div class="mrow"><button class="btn gold" data-act="rankStage">最高关卡<small>已通关 ${st}（${where}）</small></button></div>
      <div class="mrow"><button class="btn gold" data-act="rankPower">最高战力<small>历史最高 ${fmt(Rank.track())}</small></button></div>
      ${CFG.LB_RUSH && rushOpen() ? `<div class="mrow"><button class="btn gold" data-act="rankRush">过关斩将<small>最多斩将 ${rushRec().best}</small></button></div>` : ''}
      <p class="mtext" style="font-size:12.5px">最高关卡：主线 80 关之后，无尽每过一层再 +1。成绩有长进时自动上传。</p></div>`);
  }

  /* 奇遇录：碰到过的山贼首领和神兽（没见过的只写「？？？」，让玩家自己去碰） */
  function encLog() {
    const E = Save.data.enc || {}, seen = E.seen || {}, kills = E.kills || {}, un = Save.data.unlocked || {};
    const rows = ENCOUNTERS.map(e => {
      if (!seen[e.id]) return `<div class="encrow dim"><b>？？？</b><span>还没有遇见</span></div>`;
      const w = e.weapon ? WEAPON_MAP[e.weapon] : null;
      return `<div class="encrow" style="--ec:rgb(${e.aura || '232,192,74'})"><b>${e.name}</b><span>${kills[e.id] ? '击败 ' + kills[e.id] + ' 次' : '还没击败过'}</span>
        <p>${e.skills.map(k => '「' + k.name + '」' + k.desc).join('；')}</p>
        ${kills[e.id] ? `<p class="rw">${w && un[e.weapon] ? '已得「' + w.name + '」入卡池' : '赏金'}</p>` : ''}</div>`;
    }).join('');
    modal(`<div class="mbox"><button class="x" data-act="close">×</button><h2>奇遇录</h2><div class="enclist">${rows}</div></div>`);
  }
  /* 敌情：这一关的敌将会什么招、有哪些特别的敌人（这一关新登场的标出来） */
  function intel(st) {
    const ch = chapterOf(st), sk = bossSkill(st);
    const sp = Object.keys(ENEMIES).map(k => ENEMIES[k]).filter(d => d.from && d.from <= st);
    const sb = stageBoss(st);
    const af = stageAffixes(st);                               // 无尽关这一层固定的难度词缀
    return `<b>敌将 ${sb.myth ? '<span class="' + (HERO_MAP[sb.myth].q === 6 ? 'moname' : 'shenname') + '">' + ch.boss + '</span>' : ch.boss}</b>` + (sb.res ? `<i class="res">${resText(sb.res)}</i>` : '') + sb.skills.map(k => `「${k.name}」${k.desc}`).join('；')
      + (stageWeather(st) && stageWeather(st).id !== 'clear' ? '<br><b>天气</b> <i class="wx">' + stageWeather(st).name + '：' + stageWeather(st).desc + '</i>' : '')
      + (af.length ? '<br><b>本层词缀</b> ' + af.map(a => `<i class="affix">${a.name}：${a.desc}</i>`).join('') : '')
      + (sp.length ? '<br><b>特殊敌人</b> ' + sp.map(d => d.from === st ? `<i class="new" title="${d.tip}">${d.name} · 新</i>` : `<i>${d.name}</i>`).join('') : '');
  }

  /* 城池科技：三条没有上限的线，各花一种货币 */
  function techPanel() {
    const S = Save.data;
    if (!techOpen()) return modal(`<div class="mbox"><button class="x" data-act="close">×</button><h2>城池科技</h2><p class="mtext">通关第 8 章（第 ${CFG.TECH_OPEN} 关）后开放。<br>开放之后可以一直升下去，没有上限。</p></div>`);
    const rows = CFG.TECH.map(t => {
      const lv = techLv(t.id), c = techCost(t.id), have = S[t.cur] || 0, pct = v => (Math.round(v * 1000) / 10) + '%';
      return `<div class="techrow"><div class="tname"><b>${t.name}</b><span>Lv.${lv}</span></div>
        <div class="tdesc">${t.what} <b>+${pct(t.per * lv)}</b> → <i>+${pct(t.per * (lv + 1))}</i></div>
        <button class="btn ${have >= c ? 'gold' : 'gray'}" data-act="techUp" data-id="${t.id}">升级<small>${t.curName} ${fmt(c)}（有 ${fmt(have)}）</small></button></div>`;
    }).join('');
    modal(`<div class="mbox"><button class="x" data-act="close">×</button><h2>城池科技</h2>
      <p class="mtext" style="font-size:13.5px">没有等级上限，每升一级贵 ${Math.round((CFG.TECH[0].grow - 1) * 100)}%。武将、兵器养满之后，靠它继续往无尽关的高层打。</p>${rows}</div>`);
  }

  /* ---------------- 武将 ---------------- */
  function renderHeroes() {
    if (Object.keys(Save.data.heroes).some(id => Save.data.heroes[id].lv >= 5 && teamIndex(id) < 0)) tip('reset1', '不上阵的武将可以在详情里<b>重置等级</b>，升级花的金币<b>全额返还</b>，拿去练新武将', 9000);
    if (Object.keys(Save.data.heroes).length > 3) tip('heroes1', '点两个位置可以<b>交换站位</b>。位置名变<b>绿</b> = 这名武将适合这个位置；中间是<b>主帅</b>，星级越高全军加成越多', 10000);
    const S = Save.data;
    const team = S.team.map((id, i) => {
      const role = SLOT_ROLES[i], fit = id && (role.leader || role.els.includes(HERO_MAP[id].el));
      return id
        ? `<div class="tslot has ${pickSlot === i ? 'pick' : ''}" style="--qc:${qc(id)}" data-act="slot" data-i="${i}"><em class="${fit ? 'fit' : ''}">${role.name}</em><img src="${P(id)}"><span>${HERO_MAP[id].name}</span></div>`
        : `<div class="tslot ${pickSlot === i ? 'pick' : ''}" data-act="slot" data-i="${i}"><em>${role.name}</em>空位</div>`;
    }).join('');
    const bonus = teamBonus();
    const bonds = bonus.active.length ? bonus.active.slice().sort((x, y) => (y.q || 0) - (x.q || 0)).map(a => `<span class="bond ${a.type}${a.off ? ' off' : ''}" data-bq="${a.q || 0}"><b>${a.name}</b>${a.desc}${a.skill ? ' · 合击「' + BOND_SKILLS[a.skill].name + '」' : ''}</span>`).join('') : '<span class="bond none">还没有激活的羁绊</span>';
    let ids;
    if (heroTab === 'mine') ids = Object.keys(S.heroes).sort((a, b) => HERO_MAP[b].q - HERO_MAP[a].q || S.heroes[b].lv - S.heroes[a].lv);
    else ids = HEROES.filter(mythShown).sort((a, b) => b.q - a.q).map(h => h.id);   // 神魔：击败之前不显示
    const cards = ids.map(id => {
      const d = HERO_MAP[id], own = S.heroes[id], q = QUALITIES[d.q];
      const canStar = own && own.star < CFG.MAX_STAR && own.shards >= CFG.STAR_NEED[own.star];
      const canUp = own && teamIndex(id) >= 0 && S.coins >= levelCost(id);   // 上阵的武将金币够升级：头像上标「升」
      return `<div class="card ${own ? '' : 'off'}" data-q="${d.q}" style="--qc:${q.color}" data-act="hero" data-id="${id}">
        <i class="qtag">${q.name}</i>${teamIndex(id) >= 0 ? '<i class="badge">阵</i>' : ''}
        <img src="${P(id)}"><div class="cname">${d.name}</div>
        <div class="cmeta">${own ? 'Lv.' + own.lv + ' ' + stars(own.star) : '未获得'}</div>
        ${canUp ? '<i class="upmark">升</i>' : ''}${canStar ? '<span class="dot"></span>' : ''}</div>`;
    }).join('');
    const total = HEROES.filter(mythShown).length;
    $('#heroes').innerHTML = `
      <div class="team">${team}</div>
      <div class="tinfo"><span>${pickSlot >= 0 ? '再点一个位置交换站位 · 点同一位置看详情' : '点位置选中后可交换站位'}</span><span>战力 <b>${teamPower()}</b> <button class="link" data-act="autoTeam">一键上阵</button> <button class="link" data-act="bondHelp">羁绊一览</button></span></div>
      <div class="bonds">${bonds}</div>
      <div class="tabs">
        <button data-act="htab" data-v="mine" class="${heroTab === 'mine' ? 'on' : ''}">我的武将 ${Object.keys(S.heroes).length}/${total}</button>
        <button data-act="htab" data-v="all" class="${heroTab === 'all' ? 'on' : ''}">图鉴</button>
        <button data-act="legends" class="lgbtn">列传 ${LEGENDS.filter(legendDone).length}/${LEGENDS.length}${LEGENDS.some(L => legendOpen(L) && !legendDone(L)) ? '<i class="dot"></i>' : ''}</button>
        <button data-act="refineAll" class="soulbtn">将魂 ${fmt(S.soul)} · 炼化</button>
      </div>
      <div class="grid">${cards}</div>`;
    Rank.sync(false);                                         // 阵容变强了：最高战力榜（最多 30 秒报一次）
  }
  function detail(id, picking) {
    const d = HERO_MAP[id], q = QUALITIES[d.q], el = ELEMENTS[d.el], own = heroOwn(id), st = heroStats(id), ti = teamIndex(id);
    let h = `<div class="mbox" style="--qc:${q.color}"><button class="x" data-act="close">×</button>
      <div class="dhead" data-q="${d.q}"><img src="${P(id, 128)}"><div>
        <h3>${d.name}</h3><p>${d.title}</p>
        <span class="tag">${q.name}品</span><span class="tag dark">${FACTIONS[d.fac].name}</span><span class="tag dark">${el.name}系</span>
        ${own ? `<p style="margin-top:6px">Lv.${own.lv}　${stars(own.star)}</p>` : ''}
      </div></div>
      <div class="dstat four"><div><b>${st.atk}</b>攻击</div><div><b>${st.hp}</b>生命</div><div><b>${(1 / st.cd).toFixed(2)}</b>每秒出手</div><div><b>${st.power}</b>战力</div></div>
      ${skillHtml(id, own)}${legendLine(id)}`;
    if (own && !picking) {
      const wid = heroWeapon(id), w = wid && WEAPON_MAP[wid];
      h += w ? `<div class="wrow" style="--wq:${QUALITIES[w.q].color}" data-act="heroWeapon" data-id="${id}"><img src="${WI(wid)}"><div class="wi"><b>${w.name}</b>+${weaponOwn(wid).lv}${w.owner === id ? ' <em>专属</em>' : ''}<br>${wtext(weaponStats(wid, id))}</div><span class="go">更换 ›</span></div>`
        : `<div class="wrow" data-act="heroWeapon" data-id="${id}"><div class="wi"><b>兵器</b>还没有装备</div><span class="go">选择 ›</span></div>`;
    }
    if (!own) h += `<p class="mtext" style="margin-top:14px">尚未获得 · 可通过招募获得</p>`;   // 这里要另起一个 if：接成 else 的话，上面画了兵器那一行，下面升级、升星、上阵就都不画了
    else if (picking) {
      h += `<p class="mtext" style="margin-top:12px">阵容已满，选择要替换的武将</p><div class="pick">` +
        Save.data.team.map((tid, i) => `<button style="--qc:${qc(tid)}" data-act="replace" data-id="${id}" data-i="${i}"><img src="${P(tid)}">${HERO_MAP[tid].name}</button>`).join('') + `</div>`;
    } else {
      const maxLv = own.lv >= CFG.MAX_LEVEL, maxStar = own.star >= CFG.MAX_STAR;
      const nl = maxLv ? null : heroStats(id, { lv: own.lv + 1, star: own.star }), ns = maxStar ? null : heroStats(id, { lv: own.lv, star: own.star + 1 });
      h += `<p class="lvgain">${nl ? '升一级：攻击 <b>+' + (nl.atk - st.atk) + '</b>　生命 <b>+' + (nl.hp - st.hp) + '</b>' : ''}${nl && ns ? '<br>' : ''}${ns ? '升一星：攻击 <b>+' + (ns.atk - st.atk) + '</b>　生命 <b>+' + (ns.hp - st.hp) + '</b>' : ''}</p>
        <div class="mrow">
          <button class="btn gold" data-act="lvup" data-id="${id}">${maxLv ? '已满级' : '升级<small>金币 ' + fmt(levelCost(id)) + '</small>'}</button>
          <button class="btn" data-act="starup" data-id="${id}">${maxStar ? '已满星' : '升星<small>碎片 ' + own.shards + '/' + starNeed(id) + (starSoulCost(id) ? ' · 将魂补 ' + starSoulCost(id) : '') + '</small>'}</button>
        </div>
        ${maxLv ? '' : `<p class="soulrow"><button class="link" data-act="lvup10" data-id="${id}">连升 10 级 · 金币 ${fmt(levelCostMany(id, 10))}</button></p>`}
        <p class="soulrow">将魂 <b>${fmt(Save.data.soul)}</b>${own.shards > 0 ? `<button class="link" data-act="refine" data-id="${id}">把 ${own.shards} 片碎片炼化成将魂 +${heroRefineGain(id)}</button>` : '<span>碎片不够升星时可以用将魂补</span>'}</p>
        <div class="mrow"><button class="btn ${ti >= 0 ? 'gray' : 'red'}" data-act="${ti >= 0 ? 'undeploy' : 'deploy'}" data-id="${id}">${ti >= 0 ? '下阵' : '上阵'}</button>
          ${own.lv > 1 ? `<button class="btn gray" data-act="lvreset" data-id="${id}">重置等级<small>返还 ${fmt(Math.floor(levelSpent(id) * CFG.LEVEL_REFUND))}</small></button>` : ''}</div>`;
    }
    modal(h + '</div>');
  }

  function skillHtml(id, own, noCombo) {
    const d = HERO_MAP[id], el = ELEMENTS[d.el], sk = heroSkill(id), awake = heroAwake(id, own);
    const combos = COMBOS.filter(c => c.ids.includes(id)).sort((x, y) => y.q - x.q).map(c => `<b class="bqn" data-bq="${c.q}">${c.name}</b>` + '（' + c.ids.map(x => HERO_MAP[x].name).join('、') + (c.need < c.ids.length ? ' 中 ' + c.need + ' 人' : '') + (c.must ? '，须有' + HERO_MAP[c.must].name : '') + '）：' + c.desc + (c.skill ? '；合击大招「' + BOND_SKILLS[c.skill].name + '」' : '')).join('<br>');
    return `<div class="dskill"><b>普攻 · ${el.name}</b>：${el.desc}
      ${sk ? `<br><b>被动 · ${sk.passive.name}</b>：${sk.passive.desc}
      <br><b>大招 · ${d.ult}</b>：${sk.ult.desc.replace(d.ult + '：', '')}${sk.ult.aim ? '<i class="aimtag">可瞄准</i>' : ''}
      <br><span class="${awake ? 'awake' : 'dim'}">${CFG.AWAKEN_STAR} 星觉醒：大招效果 ×1.5${awake ? '（已觉醒）' : ''}</span>` : `<br><b>大招 · ${d.ult}</b>：${el.ult}`}
      ${combos && !noCombo ? `<br><b>缘分</b>：<span class="dim">${combos}</span>` : ''}</div>`;
  }
  function bondHelp() {
    const fac = Object.keys(FACTION_BONDS).map(f => { const b = FACTION_BONDS[f]; return `<tr><td>${FACTIONS[f].name} · ${b.name}</td><td>${b.fmt(0).replace(/\s*\+0%$/, '')}：2 人 +${Math.round(b.vals[0] * 100)}% / 3 人 +${Math.round(b.vals[1] * 100)}% / 4 人以上 +${Math.round(b.vals[2] * 100)}%</td></tr>`; }).join('');
    const own = Save.data.heroes;
    const team = lpDraft || Save.data.team, b = teamBonus(team), on = {};          // 局中换将时按面板里调整后的阵容算
    b.active.forEach(a => { if (!a.off) on[a.name] = 1; });
    const act = b.active.slice().sort((x, y) => (y.q || 0) - (x.q || 0)).map(a => `<tr class="${a.off ? 'offrow' : 'on'}"><td data-bq="${a.q || 0}">${a.name}</td><td>${a.desc}${a.off && !lpDraft ? ` <button class="mini" data-act="rbPick" data-n="${a.name}">换成这组</button>` : ''}${a.skill ? `<br><span class="bskill">合击大招「${BOND_SKILLS[a.skill].name}」：${BOND_SKILLS[a.skill].desc}</span>` : ''}${a.who && a.who.length ? `<br><span class="who">（${a.who.map(x => HERO_MAP[x].name).join('、')}）</span>` : ''}</td></tr>`).join('');
    const combo = COMBOS.slice().sort((x, y) => y.q - x.q).map(c => `<tr class="${on[c.name] ? 'on' : ''}"><td data-bq="${c.q}">${c.name}${on[c.name] ? ' ✓' : ''}</td><td>${c.ids.map(x => `<span class="${own[x] ? '' : 'dim'}">${HERO_MAP[x].name}</span>`).join('、')}${c.need < c.ids.length ? ' 中任意 ' + c.need + ' 人' : ''}${c.must ? '（须有' + HERO_MAP[c.must].name + '）' : ''}：${c.desc}${c.skill ? `<br><span class="bskill">合击大招「${BOND_SKILLS[c.skill].name}」（顶替礌石）：${BOND_SKILLS[c.skill].desc}</span>` : ''}</td></tr>`).join('');
    const roles = SLOT_ROLES.filter((r, i) => i <= 2).map(r => `<tr><td>${r.name}</td><td>${r.desc}</td></tr>`).join('');
    modal(`<div class="mbox"><button class="x" data-act="close">×</button><h2>羁绊一览</h2>
      <h4 class="sub">当前阵容已激活（${b.active.length}）</h4>${act ? `<table class="rates wrap lpc">${act}</table>` : '<p class="mtext">还没有激活的羁绊</p>'}
      <h4 class="sub">站位</h4><table class="rates wrap">${roles}</table>
      <h4 class="sub">阵营羁绊</h4><table class="rates wrap">${fac}</table>
      <h4 class="sub">属性共鸣</h4><table class="rates wrap"><tr><td>同系上阵</td><td>同一种攻击类型（弓 刃 火 冰 雷 毒 风）上阵 3 / 4 / 5 人：该系伤害 +${Math.round(ELEMENT_BOND[3] * 100)}% / +${Math.round(ELEMENT_BOND[4] * 100)}% / +${Math.round(ELEMENT_BOND[5] * 100)}%</td></tr></table>
      <h4 class="sub">缘分（名字的颜色 = 品质：彩 橙 金 紫 蓝 绿，越靠前越强；灰色的人 = 还没获得，打勾 = 已激活）</h4><table class="rates wrap lpc">${combo}</table></div>`);
  }
  /* ---------------- 兵器 ---------------- */
  function renderArms() {
    const S = Save.data, W = S.weapons;
    const shown = WEAPONS.filter(w => !w.lock || (S.unlocked || {})[w.id] || W[w.id]);   // 神兽兵器：解锁之前不显示，让玩家自己碰
    const cards = shown.slice().sort((a, b) => (W[b.id] ? 1 : 0) - (W[a.id] ? 1 : 0) || b.q - a.q).map(w => {
      const own = W[w.id], q = QUALITIES[w.q];
      const dot = own && own.lv < CFG.WEAPON_MAX_LV && S.iron >= weaponUpCost(w.id) && own.hero;
      return `<div class="card wcard ${own ? '' : 'lock'}" style="--qc:${q.color}" data-act="weapon" data-id="${w.id}">
        <i class="qtag">${q.name}</i>${own && own.hero ? `<img class="whead" src="${P(own.hero)}">` : ''}
        <img src="${WI(w.id)}"><div class="cname">${w.name}</div>
        <div class="cmeta">${own ? '强化 <b>+' + own.lv + '</b>' : '未获得'}</div>${dot ? '<span class="dot"></span>' : ''}</div>`;
    }).join('');
    $('#arms').innerHTML = `
      <div class="ahead"><div class="cur"><i class="ico iron"></i><b>${fmt(S.iron)}</b></div>
        <p>兵器在<b>「招募」</b>里和武将一起抽（已有 ${Object.keys(W).length}/${shown.length} 件）。<b>精铁</b>用来强化：通关会给，抽到已有的兵器也会熔成精铁。</p></div>
      <div class="grid agrid">${cards}</div>`;
  }
  /* 兵器详情：强化 / 装给上阵的武将 / 熔掉 */
  function weaponDetail(wid) {
    const w = WEAPON_MAP[wid], q = QUALITIES[w.q], own = weaponOwn(wid), S = Save.data;
    const cur = weaponStats(wid, own && own.hero), maxed = own && own.lv >= CFG.WEAPON_MAX_LV, nxt = own && !maxed ? weaponStats(wid, own.hero, own.lv + 1) : null;
    let h = `<div class="mbox" style="--qc:${q.color}"><button class="x" data-act="close">×</button>
      <div class="dhead"><img src="${WI(wid, 128)}"><div>
        <h3>${w.name}</h3><p>${w.desc}</p>
        <span class="tag">${q.name}品</span><span class="tag dark">${WEAPON_TYPES[w.type]}</span>${w.owner ? `<span class="tag dark">专属 · ${HERO_MAP[w.owner].name}</span>` : ''}
        ${own ? `<p style="margin-top:6px">强化 +${own.lv} / ${CFG.WEAPON_MAX_LV}${own.hero ? '　装备于 ' + HERO_MAP[own.hero].name : '　未装备'}</p>` : ''}
      </div></div>
      <div class="wstat">${Object.keys(cur).map(k => `<div><b>${pct(cur[k])}</b>${WSTATS[k]}${nxt ? `<br><small>下一级 ${pct(nxt[k])}</small>` : ''}</div>`).join('')}</div>
      ${w.owner ? `<p class="mtext" style="font-size:13px;margin-top:10px">装在<b style="color:var(--gold2)">${HERO_MAP[w.owner].name}</b>身上时，全部加成 ×${CFG.WEAPON_OWNER_MUL}${own && own.hero === w.owner ? '（已生效）' : ''}</p>` : ''}`;
    if (!own) {
      h += `<p class="mtext" style="margin-top:14px">还没有这件兵器 · 招募有机会获得</p><div class="mrow"><button class="btn red" data-act="nav" data-tab="gacha">去招募</button></div>`;
    } else {
      h += `<div class="mrow"><button class="btn gold" data-act="wup" data-id="${wid}">${maxed ? '已强化到顶' : '强化<small>精铁 ' + weaponUpCost(wid) + '（现有 ' + fmt(S.iron) + '）</small>'}</button>
          <button class="btn gray" data-act="wmelt" data-id="${wid}">熔掉<small>返还精铁 ${weaponMeltBack(wid)}</small></button></div>
        <p class="mtext" style="font-size:13px;margin-top:12px">装给上阵的武将（其他武将在武将详情里装）</p>
        <div class="pick">${S.team.filter(Boolean).map(tid => `<button style="--qc:${own.hero === tid ? '#ffe08a' : qc(tid)}" data-act="wequip" data-id="${wid}" data-h="${tid}"><img src="${P(tid)}">${own.hero === tid ? '已装备' : HERO_MAP[tid].name}</button>`).join('')}</div>
        ${own.hero ? `<div class="mrow"><button class="btn" data-act="wequip" data-id="${wid}" data-h="">卸下</button></div>` : ''}`;
    }
    modal(h + '</div>');
  }
  /* 给某个武将挑兵器：列出已有的全部兵器 */
  function weaponPick(hid) {
    const S = Save.data, ids = Object.keys(S.weapons).sort((a, b) => WEAPON_MAP[b].q - WEAPON_MAP[a].q || S.weapons[b].lv - S.weapons[a].lv), curW = heroWeapon(hid);
    const rows = ids.map(wid => { const w = WEAPON_MAP[wid], own = S.weapons[wid];
      return `<div class="wrow ${wid === curW ? 'on' : ''}" style="--wq:${QUALITIES[w.q].color}" data-act="wpick" data-id="${wid}" data-h="${hid}"><img src="${WI(wid)}"><div class="wi"><b>${w.name}</b>+${own.lv}${w.owner === hid ? ' <em>专属</em>' : ''}<br>${wtext(weaponStats(wid, hid))}</div>${own.hero && own.hero !== hid ? `<img class="who" src="${P(own.hero)}">` : `<span class="go">${wid === curW ? '已装备' : '装上'}</span>`}</div>`; }).join('');
    modal(`<div class="mbox"><button class="x" data-act="hero" data-id="${hid}">×</button><h2>${HERO_MAP[hid].name} · 兵器</h2>
      ${ids.length ? `<div class="wlist">${rows}</div><p class="mtext" style="font-size:12.5px;margin-top:8px">带头像的兵器正装在别人身上，点了会换过来</p>` : '<p class="mtext">还没有兵器。兵器在「招募」里和武将一起抽。</p>'}
      <div class="mrow">${curW ? `<button class="btn gray" data-act="wpick" data-id="${curW}" data-h="">卸下</button>` : ''}<button class="btn" data-act="nav" data-tab="arms">去兵器页强化</button></div></div>`);
  }
  function settings() {
    modal(`<div class="mbox"><button class="x" data-act="close">×</button><h2>设置 · 存档</h2>
      ${Platform.isTap()
        // TapTap 里不给存档码：已经有云存档和本机文件备份；存档码的校验写在客户端，能被伪造成满资源存档（2026-11-18 资源审计）
        ? '<p class="mtext" style="font-size:13px">在 TapTap 里进度会自动保存到云存档和本机备份，换设备登录同一个账号就能接着玩。</p>'
        : `<p class="mtext" style="font-size:13px">网页版进度只存在这个浏览器里。换设备或清理数据前，可以复制存档码留底，之后在这里读入（读入存档码的进度不计排行榜）。</p>
      <div class="mrow"><button class="btn gold" data-act="codeOut">复制存档码</button><button class="btn" data-act="codeIn">读入存档码</button></div>`}
      <div class="mrow"><button class="btn" data-act="gfx">战斗画面：${GLView.active() ? '高清（WebGL）' : '兼容（2D）'}<small>${GLView.ok ? '点击切换 · 手机发热或卡顿时可以换成兼容' : '这台设备开不了高清画面' + (GLView.error ? '：' + GLView.error : '')}</small></button></div>
      <div class="mrow"><button class="btn" data-act="sound">音效：${Save.data.sound === false ? '关' : '开'}</button><button class="btn" data-act="musicsw">音乐：${Save.data.music === false ? '关' : '开'}</button></div>
      ${Object.keys(CFG.GIFT_CODES).length || CFG.GIFT_SIGN ? '<div class="mrow"><input class="gift" id="giftCode" placeholder="礼包码 / 签到兑换码" autocomplete="off" autocapitalize="characters"><button class="btn red" data-act="gift">兑换</button></div>' : ''}
      <div class="mrow"><button class="btn gray" data-act="resetAsk">重置存档</button></div></div>`);
  }
  function codeOut() {
    const code = saveCode();
    modal(`<div class="mbox"><button class="x" data-act="close">×</button><h2>存档码</h2>
      <textarea class="code" readonly>${code}</textarea>
      <p class="mtext" style="font-size:13px">长按全选复制，保存到备忘录或发给自己。</p>
      <div class="mrow"><button class="btn gold" data-act="codeCopy">复制</button><button class="btn" data-act="settings">返回</button></div></div>`);
    const ta = document.querySelector('#modal textarea'); if (ta) { ta.focus(); ta.select(); }
  }
  function codeIn() {
    modal(`<div class="mbox"><button class="x" data-act="close">×</button><h2>读入存档码</h2>
      <textarea class="code" placeholder="把以 SGTD1- 开头的存档码粘贴到这里"></textarea>
      <p class="mtext" style="font-size:13px">读入后会替换当前的全部进度。</p>
      <div class="mrow"><button class="btn" data-act="settings">返回</button><button class="btn red" data-act="codeLoad">读入</button></div></div>`);
  }

  /* ---------------- 招募 ---------------- */
  function renderGacha() {
    const S = Save.data, left = adLeft(), can = Math.floor(S.coins / CFG.TICKET_PRICE);
    const showIds = GACHA_POOL[5].slice(0, 4);
    $('#gacha').innerHTML = `
      <div class="gbanner">
        <h2>群英招募</h2><p>白 · 绿 · 蓝 · 紫 · 金 · 橙　武将与兵器同池</p>
        <div class="gshow">${showIds.map(id => `<img src="${P(id)}">`).join('')}</div>
      </div>
      <div class="gstat">招募令 <b>${fmt(S.tickets)}</b>　·　再 <b>${Math.max(1, CFG.PITY - S.pity)}</b> 抽必得${QUALITIES[CFG.PITY_Q].name}品武将</div>
      <div class="grow">
        <button class="btn" data-act="draw" data-n="1">招募 1 次<small>招募令 ×1</small></button>
        <button class="btn red" data-act="draw" data-n="10">招募 10 次<small>招募令 ×10 · 必出紫品以上</small></button>
      </div>
      <div class="gbox">
        <h3>金币兑换<span>${CFG.TICKET_PRICE} 金币 = 1 招募令 · 现有金币可换 ${can} 张</span></h3>
        <div class="row">
          <button class="btn gold" data-act="buy" data-n="1">兑换 1 张</button>
          <button class="btn gold" data-act="buy" data-n="10">兑换 10 张</button>
          <button class="btn gold" data-act="buy" data-n="all">全部兑换</button>
        </div>
      </div>
      ${AdService.available() ? `<div class="gbox">
        <h3>每日广告<span>今日剩余 ${left}/${CFG.AD_DAILY_LIMIT} 次 · 每日 0 点重置</span></h3>
        <div class="row"><button class="btn ${left ? '' : 'gray'}" data-act="ad">▶ 观看广告　免费得招募令 ×${CFG.AD_REWARD}</button></div>
      </div>` : ''}
      <div class="gfoot"><button class="link" data-act="rates">概率公示</button></div>`;
  }
  function showPulls(res) {
    const n = res.length;
    const cards = res.map((r, i) => {
      if (r.wid) {                                            // 这一抽是兵器
        const w = WEAPON_MAP[r.wid], wq = QUALITIES[w.q];
        return `<div class="pull wp ${w.q >= 3 ? 'hi' : ''}" style="--qc:${wq.color};animation-delay:${i * 0.11}s">${r.isNew ? '<i>新</i>' : ''}<em>兵器</em>
          <img src="${WI(r.wid, n === 1 ? 128 : 64)}"><b>${w.name}</b><small>${r.isNew ? wq.name + '品 · 新兵器' : '已有 · 精铁+' + r.iron}</small></div>`;
      }
      const d = HERO_MAP[r.id], q = QUALITIES[d.q];
      const note = r.isNew ? '新武将' : (r.soul ? '满星 · 将魂+' + r.soul : '碎片 +1');
      return `<div class="pull ${d.q >= 3 ? 'hi' : ''}" data-q="${d.q}" style="--qc:${q.color};animation-delay:${i * 0.11}s">${r.isNew ? '<i>新</i>' : ''}
        <img src="${P(r.id, n === 1 ? 128 : 64)}"><b>${d.name}</b><small>${q.name}品 · ${note}</small></div>`;
    }).join('');
    modal(`<div class="mbox"><h2>招募结果</h2><div class="pulls ${n === 1 ? 'one' : ''}">${cards}</div>
      <div class="mrow"><button class="btn" data-act="close">确定</button><button class="btn red" data-act="draw" data-n="${n}">再招 ${n} 次</button></div></div>`);
  }
  /* 神魔（黑、彩）：在无尽关击败之前不出现在武将页和概率公示里；已经有了的照常显示 */
  const mythShown = h => !h.locked && (!h.myth || (Save.data.unlocked || {})[h.id] || Save.data.heroes[h.id]);
  function showRates() {
    const total = QUALITIES.reduce((s, q) => s + q.rate, 0), ws = Math.round(CFG.WEAPON_SHARE * 100);
    const un = Save.data.unlocked || {};
    const rows = QUALITIES.filter(q => q.rate || HEROES.some(h => h.q === q.id && h.myth && un[h.id])).map(q => {   // 黑、彩两行：有解锁的神魔才显示
      const names = HEROES.filter(h => h.q === q.id && !h.locked && (!h.myth || un[h.id])).map(h => h.name).join('、'), wn = WEAPONS.filter(w => w.q === q.id && (!w.lock || (Save.data.unlocked || {})[w.id])).map(w => w.name).join('、');   // 只列现在抽得到的
      return `<tr style="--qc:${q.god ? '#c8b08a' : q.color}"><td>${q.name}品</td><td>${q.rate ? (q.rate / total * 100).toFixed(1) + '%' : '和橙品武将同池'}</td><td>${names}${wn ? '<br><span class="dim">兵器：' + wn + '</span>' : ''}</td></tr>`;
    }).join('');
    modal(`<div class="mbox"><button class="x" data-act="close">×</button><h2>概率公示</h2><table class="rates">${rows}</table>
      <p class="mtext" style="font-size:13px;margin-top:10px">每一抽先定品质，再有 ${ws}% 的概率是这个品质的兵器、${100 - ws}% 是武将；同品质里每个概率相同<br>十连必出紫品以上 · 连续 ${CFG.PITY - 1} 抽没出${QUALITIES[CFG.PITY_Q].name}品以上的武将时，第 ${CFG.PITY} 抽必得${QUALITIES[CFG.PITY_Q].name}品武将<br>以上为单抽基础概率，计入保底后紫、金的实际概率更高<br>重复武将转为碎片用于升星；重复兵器熔成精铁用于强化</p></div>`);
  }
  /* 网页版模拟广告：看完 resolve(true)，中途放弃 resolve(false) */
  function fakeAd(sec) {
    return new Promise(resolve => {
      let left = sec; adResolve = resolve;
      modal(`<div class="adbox"><div class="tv">广 告 位（模拟）</div><b id="adLeft">${left}</b>
        <p>这里是模拟的激励视频广告。<br>接入抖音 / 微信小游戏后，会替换为平台真实广告。</p>
        <button class="btn gray" id="adBtn" data-act="adEnd" data-ok="0">放弃观看（没有奖励）</button></div>`, false);
      adTimer = setInterval(() => {
        left--;
        const b = $('#adLeft'), btn = $('#adBtn');
        if (!b) return clearInterval(adTimer);
        if (left > 0) b.textContent = left;
        else { clearInterval(adTimer); b.textContent = '✓'; btn.className = 'btn gold'; btn.dataset.ok = '1'; btn.textContent = '关闭广告并领取奖励'; }
      }, 1000);
    });
  }

  /* ---------------- 战斗 ---------------- */
  function startBattle(stage) {
    if (!Save.data.team.some(Boolean)) return toast('至少上阵一名武将');
    closeModal(); show('battle');
    $('#bSpeed').textContent = '×' + Save.data.speed;
    $('#bAuto').classList.toggle('off', !Save.data.auto);
    Battle.start(stage);
  }
  function hud(S) {
    if (hudS !== S || hudVer !== S.teamVer) {
      hudS = S; hudVer = S.teamVer; hudRage = [];
      $('#ultbar').innerHTML = S.heroes.map(h =>
        `<button class="ult" data-act="ult" data-i="${h.slot}" data-q="${h.def.q}" style="--qc:${QUALITIES[h.def.q].color}"><img src="${P(h.def.id)}"><span>${h.def.ult}</span></button>`).join('');
      hudRock = ''; hudSec = -1;
    }
    const sec = Math.floor(S.t);
    if (sec !== hudSec) { hudSec = sec; $('#bTime').textContent = String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0'); }
    const bd = S.bond;                                        // 彩色缘分：礌石的按钮换成合击大招（转一圈 = 冷却好了）
    const rk = bd ? 'b' + bd.id + '/' + Math.floor(bd.t / bd.cd * 40) : S.rock.n + '/' + S.rock.max + '/' + (S.rock.n < S.rock.max ? Math.floor(S.rock.t / CFG.ROCK_CD * 20) : 20);
    if (rk !== hudRock) {
      hudRock = rk;
      const b = $('#bRock'), p = bd ? bd.t / bd.cd * 100 : S.rock.n < S.rock.max ? S.rock.t / CFG.ROCK_CD * 100 : 100;
      b.innerHTML = bd ? bd.def.short : '石<small>' + S.rock.n + '</small>'; b.style.setProperty('--p', p + '%');
      b.classList.toggle('empty', bd ? bd.t < bd.cd : S.rock.n <= 0); b.classList.toggle('bondbtn', !!bd); b.classList.toggle('ready', !!bd && bd.t >= bd.cd);
    }
    if (!bd && S.t > 4 && S.live.length >= 4 && !tipShown()) tip('rock1', '<b>点战场</b>任意位置可以投下礌石，砸晕扎堆的敌人（左边「石」是剩余块数）', 8000);
    if (S.t > 16 && !tipShown() && S.heroes.some(h => h.rage >= 60)) tip('ult1', '怒气满了会<b>自动放大招</b>。关掉左边的「自动」，可以自己点右边头像选时机，带「可瞄准」的还能选落点', 9000);
    if (S.wave >= 3 && S.t > 40 && !tipShown() && Object.keys(Save.data.heroes).length > 5) tip('swap1', '打不动的时候点左边<b>「阵」</b>：战斗中可以随时<b>换武将、换站位</b>，留在场上的人怒气不变', 8000);
    const btns = $('#ultbar').children;
    S.heroes.forEach((h, i) => {
      const p = Math.floor(h.rage);
      if (hudRage[i] === p) return;
      hudRage[i] = p; btns[i].style.setProperty('--p', p + '%'); btns[i].classList.toggle('ready', p >= 100);
    });
    S.heroes.forEach((h, i) => { btns[i].classList.toggle('aiming', S.aim === h.slot); btns[i].classList.toggle('dead', !!h.dead); btns[i].classList.toggle('stun', !h.dead && h.stunT > 0); });
  }
  /* 局中换将面板：先改草稿（lpDraft），点「确定」才真的换 */
  function renderLineup() {
    const own = Save.data.heroes, fallen = (Battle.state && Battle.state.fallen) || {};
    const slots = lpDraft.map((id, i) => {
      const role = SLOT_ROLES[i], fit = id && (role.leader || role.els.includes(HERO_MAP[id].el)), sel = lpSel && lpSel.t === 's' && lpSel.i === i;
      return id ? `<div class="tslot has ${sel ? 'pick' : ''} ${fallen[id] ? 'fallen' : ''}" style="--qc:${qc(id)}" data-act="lpSlot" data-i="${i}"><em class="${fit ? 'fit' : ''}">${role.name}</em><img src="${P(id)}"><span>${fallen[id] ? '阵亡' : HERO_MAP[id].name}</span><b class="lpi" data-act="lpInfo" data-id="${id}">详</b></div>`
        : `<div class="tslot ${sel ? 'pick' : ''}" data-act="lpSlot" data-i="${i}"><em>${role.name}</em>空位</div>`;
    }).join('');
    const bench = Object.keys(own).filter(id => !lpDraft.includes(id)).sort((a, b) => (fallen[a] ? 1 : 0) - (fallen[b] ? 1 : 0) || heroStats(b).power - heroStats(a).power);   // 阵亡的排最后
    const cards = bench.map(id => { const d = HERO_MAP[id], q = QUALITIES[d.q], sel = lpSel && lpSel.t === 'h' && lpSel.id === id;
      return `<div class="card ${sel ? 'pick' : ''} ${fallen[id] ? 'fallen' : ''}" style="--qc:${q.color}" data-act="lpHero" data-id="${id}"><i class="qtag">${ELEMENTS[d.el].name}</i><img src="${P(id)}"><div class="cname">${d.name}</div><div class="cmeta">${fallen[id] ? '阵亡' : 'Lv.' + own[id].lv + ' · ' + heroStats(id).power}</div><b class="lpi" data-act="lpInfo" data-id="${id}">详</b></div>`; }).join('');
    const b = teamBonus(lpDraft), bonds = b.active.filter(a => a.type !== 'slot').map(a => a.name).join('、');
    const hint = lpSel ? (lpSel.t === 's' ? '再点下面的武将换上来，或点另一个位置交换站位' : '再点上面的一个位置，把他换上去') : '点一个位置，再点下面的武将换上；点两个位置交换站位。点头像角上的「详」看技能和缘分';
    modal(`<div class="mbox lp"><h2>更换武将</h2>
      <div class="team">${slots}</div>
      <div class="lpinfo"><span>战力 <b>${teamPower(lpDraft)}</b></span><span class="lpb" data-act="lpBonds">${bonds ? '羁绊：' + bonds : '没有激活的羁绊'}<i>详情 ›</i></span></div>
      <p class="mtext lphint">${hint}</p>
      <div class="lpgrid">${cards || '<p class="mtext" style="grid-column:1/-1;padding:18px 0">没有其他武将了，去招募吧</p>'}</div>
      <p class="mtext" style="font-size:12.5px;margin-top:8px">留在场上的武将保留怒气和血量；新上场的满血、怒气从 0 开始，${CFG.SWAP_DELAY} 秒后出手。<b>阵亡</b>的武将这一关不能再出手，换下去也不能再上</p>
      <div class="mrow"><button class="btn gray" data-act="lpOff">下阵</button><button class="btn" data-act="lpCancel">取消</button><button class="btn red" data-act="lpOk">确定</button></div></div>`, false);
  }
  /* 换将面板里看某个武将：技能、兵器、他能凑的缘分（按草稿阵容标出已经凑齐的）。只看不改，关掉回到换将面板 */
  function lpInfo(id) {
    const d = HERO_MAP[id], q = QUALITIES[d.q], el = ELEMENTS[d.el], own = heroOwn(id), st = heroStats(id), has = Save.data.heroes;
    const wid = heroWeapon(id), w = wid && WEAPON_MAP[wid], on = lpDraft.includes(id);
    const combos = COMBOS.filter(c => c.ids.includes(id)).map(c => {
      const n = c.ids.filter(x => lpDraft.includes(x)).length, ok = n >= c.need && (!c.must || lpDraft.includes(c.must));
      return `<tr class="${ok ? 'on' : ''}"><td data-bq="${c.q}">${c.name}${ok ? ' ✓' : ''}</td><td>${c.ids.map(x => `<span class="${lpDraft.includes(x) ? 'in' : has[x] ? '' : 'dim'}">${HERO_MAP[x].name}</span>`).join('、')}${c.need < c.ids.length ? ' 中任意 ' + c.need + ' 人' : ''}${c.must ? '（须有' + HERO_MAP[c.must].name + '）' : ''}：${c.desc}</td></tr>`;
    }).join('');
    const slot = lpDraft.indexOf(id), role = slot >= 0 ? SLOT_ROLES[slot] : null, fit = role && (role.leader || role.els.includes(d.el));
    modal(`<div class="mbox" style="--qc:${q.color}"><button class="x" data-act="lpBack">×</button>
      <div class="dhead" data-q="${d.q}"><img src="${P(id, 128)}"><div>
        <h3>${d.name}</h3><p>${d.title}</p>
        <span class="tag">${q.name}品</span><span class="tag dark">${FACTIONS[d.fac].name}</span><span class="tag dark">${el.name}系</span>
        <p style="margin-top:6px">Lv.${own.lv}　${stars(own.star)}</p>
      </div></div>
      <div class="dstat four"><div><b>${st.atk}</b>攻击</div><div><b>${st.hp}</b>生命</div><div><b>${(1 / st.cd).toFixed(2)}</b>每秒出手</div><div><b>${st.power}</b>战力</div></div>
      ${skillHtml(id, own, true)}
      ${w ? `<div class="wrow ro" style="--wq:${QUALITIES[w.q].color}"><img src="${WI(wid)}"><div class="wi"><b>${w.name}</b>+${weaponOwn(wid).lv}${w.owner === id ? ' <em>专属</em>' : ''}<br>${wtext(weaponStats(wid, id))}</div></div>` : ''}
      <p class="mtext lpwhere">${on ? '现在站在「' + role.name + '」' + (fit ? '，位置合适' : '，这个位置对他没有加成（' + role.desc + '）') : '没有上阵 · 适合的位置：' + SLOT_ROLES.filter((r, i) => i <= 2 && (r.leader || r.els.includes(d.el))).map(r => r.name).join('、')}</p>
      <h4 class="sub">他的缘分（<span class="in">亮色</span> = 已在阵，灰色 = 还没获得）</h4>
      ${combos ? `<table class="rates wrap lpc">${combos}</table>` : '<p class="mtext">没有专属的缘分，靠阵营羁绊和属性共鸣</p>'}
      <div class="mrow"><button class="btn" data-act="lpBack">返回换将</button></div></div>`, false);
  }
  /* 换将面板里看羁绊：草稿阵容已经激活的、差一个人就能激活的 */
  function lpBonds() {
    const b = teamBonus(lpDraft), has = Save.data.heroes;
    const act = b.active.slice().sort((x, y) => (y.q || 0) - (x.q || 0)).map(a => `<tr class="${a.off ? 'offrow' : 'on'}"><td data-bq="${a.q || 0}">${a.name}</td><td>${a.desc}${a.off && !lpDraft ? ` <button class="mini" data-act="rbPick" data-n="${a.name}">换成这组</button>` : ''}${a.skill ? `<br><span class="bskill">合击大招「${BOND_SKILLS[a.skill].name}」：${BOND_SKILLS[a.skill].desc}</span>` : ''}${a.who && a.who.length ? `<br><span class="who">（${a.who.map(x => HERO_MAP[x].name).join('、')}）</span>` : ''}</td></tr>`).join('');
    const near = COMBOS.map(c => {
      const inn = c.ids.filter(x => lpDraft.includes(x)), ok = inn.length >= c.need && (!c.must || lpDraft.includes(c.must));
      if (ok || !inn.length) return '';
      let miss = [];
      if (c.must && !lpDraft.includes(c.must)) { if (inn.length < c.need - 1 || !has[c.must]) return ''; miss = [c.must]; }
      else { if (inn.length !== c.need - 1) return ''; miss = c.ids.filter(x => !lpDraft.includes(x) && has[x]); }
      if (!miss.length) return '';
      return `<tr><td>${c.name}</td><td>已有 ${inn.map(x => HERO_MAP[x].name).join('、')}，再上 <span class="in">${miss.map(x => HERO_MAP[x].name).join(' / ')}</span>：${c.desc}</td></tr>`;
    }).join('');
    const facs = Object.keys(FACTION_BONDS).map(f => { const n = b.fac[f] || 0; return n ? FACTIONS[f].name + ' ' + n : ''; }).filter(Boolean).join('　');
    const els = Object.keys(b.elc).map(e => ELEMENTS[e].name + ' ' + b.elc[e]).join('　');
    modal(`<div class="mbox"><button class="x" data-act="lpBack">×</button><h2>阵容羁绊</h2>
      <p class="mtext lpwhere">阵营：${facs || '无'}<br>攻击类型：${els || '无'}</p>
      <h4 class="sub">已经激活</h4>${act ? `<table class="rates wrap lpc">${act}</table>` : '<p class="mtext">还没有激活的羁绊</p>'}
      <h4 class="sub">再上一个人就能激活</h4>${near ? `<table class="rates wrap lpc">${near}</table>` : '<p class="mtext">手上的武将凑不出更多缘分了</p>'}
      <div class="mrow"><button class="btn gray" data-act="bondHelp">全部羁绊</button><button class="btn" data-act="lpBack">返回换将</button></div></div>`, false);
  }
  function showBuffs(opts, cb) {
    buffCb = cb;
    modal(`<div class="mbox"><h2>军令三选一</h2><div class="buffs">${opts.map((o, i) => `<button data-act="buff" data-i="${i}"><b>${o.name}</b><span>${o.desc}</span></button>`).join('')}</div></div>`, false);
  }
  /* 城池失守：看广告修复城池接着打（每局一次），或者放弃 */
  function showRevive(cb) {
    hideTip(); reviveCb = cb;
    modal(`<div class="mbox res lose"><h2>城池失守</h2>
      <p class="mtext" style="margin:14px 0 6px">看一段广告，把城池修复到 <b>${Math.round(CFG.AD_REVIVE_WALL * 100)}%</b> 城防接着打</p>
      <p class="mtext" style="font-size:13px;opacity:.75">每局一次 · 倒下的武将不会回来</p>
      <div class="mrow"><button class="btn" data-act="reviveNo">放弃</button>
      <button class="btn gold" data-act="reviveAd">▶ 看广告修复</button></div></div>`, false);
  }
  function showResult(r) {
    hideTip();
    lastRes = r;
    Rank.sync(true);                                          // 通关数、战力有长进就报排行榜
    const canNext = r.win && !r.trial && !r.legend && !r.rush;           // 试炼、列传没有「下一关」，只有再战一次
    modal(`<div class="mbox res ${r.win ? '' : 'lose'}"><h2>${r.rush ? '斩将 ' + r.slain : r.win ? '大获全胜' : r.wiped ? '全军覆没' : '城池失守'}</h2><ul>
        ${r.rush ? `<li class="enc">过关斩将<b>止步第 ${r.slain + 1} 将</b></li><li${r.record ? ' class="enc"' : ''}>${r.record ? '新纪录' : '最佳纪录'}<b>${r.best} 将</b></li>${r.daySoul ? `<li>今日首局 · 将魂<b>+${r.daySoul}</b></li>` : ''}` : ''}
        ${r.trialDef && !r.rush ? `<li class="enc">${r.legend ? '名将列传' : '每日试炼'}<b>${r.trialDef.name}</b></li>` : ''}
        ${r.legend && r.first ? `<li class="enc">首通 · 获得称号<b>「${LEGEND_MAP[r.legendId].name}」</b></li>` : ''}
        ${r.shards ? `<li>${HERO_MAP[LEGEND_MAP[r.legendId].hero].name}的碎片<b>+${r.shards}</b></li>` : ''}
        ${r.win || r.rush ? '' : `<li>坚守至<b>第 ${r.wave} / ${CFG.WAVES} 波</b></li>`}
        <li>击败敌军<b>${r.kills}</b></li>
        ${r.combo >= 10 ? `<li>最高连斩<b>${r.combo}</b></li>` : ''}
        ${r.fallen && r.fallen.length ? `<li>阵亡武将<b>${r.fallen.map(x => HERO_MAP[x].name).join('、')}</b></li>` : ''}
        <li>获得金币（${r.trial || r.legend || r.rush ? '按掉落的一半' : '含掉落 ' + r.dropped}）<b>+${r.coins}</b></li>
        ${r.iron ? `<li>精铁（强化兵器用）<b>+${r.iron}</b></li>` : ''}
        ${r.soul ? `<li>将魂（升星时顶碎片）${r.rush && r.daySoul ? '合计' : ''}<b>+${r.soul}</b></li>` : ''}
        ${r.tickets ? `<li>${r.rush ? '破纪录' : r.trial ? '试炼首胜' : r.legend ? '列传首通' : '首通奖励'} · 招募令<b>+${r.tickets}</b></li>` : ''}
        ${r.again ? (r.legend ? '<li>这一关的首通奖励已经领过了<b>可以随时再战</b></li>' : '<li>今天的试炼奖励已经领过了<b>明天再来</b></li>') : ''}
        ${r.enc ? `<li class="enc">奇遇 · 击败${r.enc.name}<b>金币 +${r.enc.coins}${r.enc.iron ? '　精铁 +' + r.enc.iron : ''}</b></li>` : ''}
      </ul>
      ${r.myth ? `<div class="encw" style="--qc:${QUALITIES[HERO_MAP[r.myth].q].color}"><img src="${P(r.myth)}"><p>击败<b>${HERO_MAP[r.myth].name}</b><br>已加入卡池，招募有机会抽到</p></div>` : ''}
      ${r.enc && r.enc.unlock ? `<div class="encw" style="--qc:${QUALITIES[WEAPON_MAP[r.enc.unlock].q].color}"><img src="${WI(r.enc.unlock)}"><p>解锁神兽兵器<b>「${WEAPON_MAP[r.enc.unlock].name}」</b><br>已加入卡池，招募有机会抽到</p></div>` : ''}
      <div class="dmgs">${(() => { const top = Math.max(1, ...r.dmg.map(x => x.dmg)), sum = Math.max(1, r.dmg.reduce((s, x) => s + x.dmg, 0));
        return r.dmg.map(x => `<div class="dmg" style="--qc:${qc(x.id)}"><img src="${P(x.id)}"><span>${HERO_MAP[x.id].name}</span><i style="width:${x.dmg / top * 100}%"></i><b>${fmt(x.dmg)} · ${Math.round(x.dmg / sum * 100)}%</b></div>`).join(''); })()}</div>
      ${r.rush ? '<p class="mtext" style="font-size:13px;margin-top:8px">过关斩将中途不回血：带上<b>会回血、加护盾、修城</b>的武将，按今天的敌将挑克制他们的攻击类型，再看看天气（雨天火弱、雷强）</p>' : r.win ? '' : '<p class="mtext" style="font-size:13px;margin-top:8px">试试：去「武将」页<b>升级武将</b>（前期每级只要几个金币）、凑阵营羁绊和缘分、把武将放到合适的站位、手动瞄准大招、点战场投石</p>'}
      <div class="mrow"><button class="btn" data-act="resHome">返回主城</button>
      <button class="btn red" data-act="${canNext ? 'resNext' : 'resRetry'}">${canNext ? '下一关' : '再战一次'}</button></div></div>`, false);
  }

  /* ---------------- 点击处理 ---------------- */
  const ACT = {
    nav: d => { pickSlot = -1; show(d.tab); },
    close: () => { if (lpDraft) return renderLineup(); closeModal(); if (screen !== 'battle') render(); },   // 换将面板里打开的子窗口：关掉回到换将面板
    stage: d => { const S = Save.data; S.pick = Math.max(1, Math.min(S.stage, S.pick + Number(d.d))); Save.save(); render(); },
    fight: () => startBattle(Save.data.pick),
    settings: () => settings(),
    encLog: () => encLog(),
    codeOut: () => codeOut(),
    codeIn: () => codeIn(),
    codeCopy: () => {
      const ta = document.querySelector('#modal textarea'); if (!ta) return;
      ta.select();
      const done = () => toast('已复制存档码');
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(done, () => { try { document.execCommand('copy'); done(); } catch (e) { toast('请长按手动复制'); } });
      else { try { document.execCommand('copy'); done(); } catch (e) { toast('请长按手动复制'); } }
    },
    gfx: () => {
      if (!GLView.ok) return toast('这台设备开不了高清画面');
      Save.data.gfx = Save.data.gfx === '2d' ? 'gl' : '2d'; Save.save(); GLView.apply(); settings();
    },
    gift: () => {
      const el = document.querySelector('#giftCode'), r = redeemGift(el && el.value);
      if (typeof r === 'string') return toast(r);
      closeModal(); render();
      toast('兑换成功：' + [r.tickets ? '招募令 +' + r.tickets : '', r.coins ? '金币 +' + fmt(r.coins) : '', r.iron ? '精铁 +' + r.iron : '', r.soul ? '将魂 +' + r.soul : ''].filter(Boolean).join('，') + (r.left > 0 ? '（还能用 ' + r.left + ' 次）' : ''));
    },
    codeLoad: () => {
      if (Platform.isTap()) return toast('TapTap 里用云存档，不支持读入存档码');
      const ta = document.querySelector('#modal textarea'), d = parseSaveCode(ta && ta.value);
      if (typeof d === 'string') return toast(d);
      d.noRank = true;                                        // 存档码能被伪造：读进来的进度永远不上排行榜（这个标记跟着存档走，伪造的码也去不掉）
      Save.replace(d); closeModal(); show('home'); toast('存档已读入（不计排行榜）');
    },
    sweep: () => {
      const r = sweep(Save.data.pick);
      if (typeof r === 'string') return toast(r);
      Sfx.play('sweep'); render(); toast('扫荡完成：金币 +' + r + '、精铁 +' + stageIron(Save.data.pick));
    },
    sweepAd: () => {
      const st = Save.data.pick;
      if (st >= Save.data.stage) return toast('通关后才能扫荡');
      if (sweepAdLeft() <= 0) return toast('今日扫荡次数已用完');
      const grant = () => { if (!sweepAdGrant()) return false; const r = sweep(st); if (typeof r === 'string') toast(r); else { Sfx.play('sweep'); toast('扫荡完成：金币 +' + r + '、精铁 +' + stageIron(st)); } return true; };
      AdService.showRewarded(() => { grant(); render(); }).then(ok => {
        if (ok === null) toast('暂时没有广告，请稍后再试');
        else if (!(ok && grant())) toast('未看完广告，没有扫荡');
        render();
      });
    },
    reviveAd: () => {
      AdService.showRewarded().then(ok => {
        if (!reviveCb) return;
        if (ok) { const cb = reviveCb; reviveCb = null; closeModal(); return cb(true); }
        toast(ok === null ? '暂时没有广告，请稍后再试' : '未看完广告，城池没有修复');
        showRevive(reviveCb);                               // 回到选择：可以再看一次，也可以放弃
      });
    },
    reviveNo: () => { const cb = reviveCb; reviveCb = null; closeModal(); if (cb) cb(false); },
    bondHelp: () => bondHelp(),
    daily: () => { const r = dailyClaim(); if (!r) { Sfx.play('deny'); return toast(Clock.waiting() ? '正在和云存档校准时间，稍等几秒再领' : '今天的军饷已经领过了，明天再来'); } Sfx.play('sweep'); render(); toast('军饷到了：金币 +' + fmt(r.coins) + '、精铁 +' + r.iron + '、招募令 +' + r.tickets); },
    tech: () => techPanel(),
    techUp: d => { const e = techUp(d.id); if (e) { Sfx.play('deny'); return toast(e); } Sfx.play('forge'); render(); techPanel(); },
    rbPick: d => { Save.data.rb = d.n; Save.save(); render(); bondHelp(); toast('彩色缘分换成「' + d.n + '」'); },
    weapon: d => weaponDetail(d.id),
    heroWeapon: d => { lastPickHero = d.id; weaponPick(d.id); },
    wup: d => { const e = weaponUp(d.id); if (e) { Sfx.play('deny'); return toast(e); } Sfx.play('forge'); render(); weaponDetail(d.id); },
    wequip: d => { const e = weaponEquip(d.id, d.h || null); if (e) { Sfx.play('deny'); return toast(e); } Sfx.play('equip'); render(); weaponDetail(d.id); },
    wpick: d => { const e = weaponEquip(d.id, d.h || null); if (e) { Sfx.play('deny'); return toast(e); } Sfx.play('equip'); render(); const hid = d.h || lastPickHero; if (hid) detail(hid); else closeModal(); },
    wmelt: d => {
      const w = WEAPON_MAP[d.id];
      modal(`<div class="mbox"><h3>熔掉兵器</h3><p class="mtext">${w.name} 会消失，返还 <b>${weaponMeltBack(d.id)}</b> 精铁<br>（强化花的全额返还，兵器本身折 ${CFG.WEAPON_MELT_VAL[w.q]}）<br>以后想要得重新抽</p>
        <div class="mrow"><button class="btn gray" data-act="weapon" data-id="${d.id}">再想想</button><button class="btn gold" data-act="wmeltok" data-id="${d.id}">确定熔掉</button></div></div>`);
    },
    wmeltok: d => { const r = weaponMelt(d.id); if (typeof r === 'string') { Sfx.play('deny'); return toast(r); } Sfx.play('melt'); closeModal(); render(); toast('返还精铁 ' + r); },
    resetAsk: () => modal(`<div class="mbox"><h2>重置存档</h2><p class="mtext">将清空所有武将、金币与关卡进度，确定吗？</p>
      <div class="mrow"><button class="btn" data-act="close">取消</button><button class="btn red" data-act="reset">确定重置</button></div></div>`),
    reset: () => { Save.reset(); closeModal(); show('home'); toast('存档已重置'); },

    htab: d => { heroTab = d.v; render(); },
    hero: d => detail(d.id),
    slot: d => {
      const i = Number(d.i), t = Save.data.team;
      if (pickSlot < 0) { pickSlot = i; if (!t[i]) toast('再点另一个位置交换；或点下方武将 → 上阵'); return render(); }
      if (pickSlot === i) { pickSlot = -1; render(); if (t[i]) detail(t[i]); return; }
      teamSwap(pickSlot, i); pickSlot = -1; Sfx.play('swap'); render(); toast('已交换站位');
    },
    idle: () => idlePanel(),
    idleGet: () => { const c = idleClaim(1); if (!c) { Sfx.play('deny'); return toast('还没攒下金币，过一会儿再来'); } Sfx.play('coin'); closeModal(); render(); toast('挂机军饷：金币 +' + fmt(c)); },
    idleAd: () => {
      if (idleInfo().coins < 1) { Sfx.play('deny'); return toast('还没攒下金币，过一会儿再来'); }
      const late = () => { const c = idleClaim(2); if (c) { render(); toast('挂机军饷：金币 +' + fmt(c)); } };
      AdService.showRewarded(late).then(ok => {
        if (ok === null) return toast('暂时没有广告，请稍后再试');
        if (!ok) return toast('未看完广告，可以直接领取');
        const c = idleClaim(2); closeModal(); render(); if (c) { Sfx.play('coin'); toast('挂机军饷（双倍）：金币 +' + fmt(c)); }
      });
    },
    trial: () => trialPanel(),
    legends: () => legendPanel(),
    legendGo: d => startLegend(d.id),
    trialGo: () => startTrial(),
    rank: () => rankPanel(),
    rush: () => rushPanel(),
    rushGo: () => startRush(),
    rankRush: () => { Rank.sync(true); Rank.open(CFG.LB_RUSH); },
    rankStage: () => { Rank.sync(true); Rank.open(CFG.LB_STAGE); },
    rankPower: () => { Rank.sync(true); Rank.open(CFG.LB_POWER); },
    autoTeam: () => {
      const before = teamPower(), t = bestTeam();
      if (!t || teamPower(t) <= before) { Sfx.play('deny'); return toast('现在的阵容已经是最强的了'); }
      Save.data.team = t; pickSlot = -1; Save.save(); Sfx.play('swap'); render();
      toast('已上阵最强阵容：战力 ' + before + ' → ' + teamPower());
    },
    lvup10: d => { const n = levelUpMany(d.id, 10); if (!n) { Sfx.play('deny'); return toast('金币不足'); } Sfx.play('up'); render(); detail(d.id); if (n < 10) toast('金币只够升 ' + n + ' 级'); },
    lvup: d => { const e = levelUp(d.id); if (e) { Sfx.play('deny'); return toast(e); } Sfx.play('up'); render(); detail(d.id); },
    lvreset: d => {
      const n = HERO_MAP[d.id].name, back = Math.floor(levelSpent(d.id) * CFG.LEVEL_REFUND);
      modal(`<div class="mbox"><h3>重置等级</h3><p class="mtext">${n} 回到 1 级，返还 <b>${fmt(back)}</b> 金币（星级不变）。<br>换阵容时用：把金币挪给新武将。</p>
        <div class="mrow"><button class="btn gray" data-act="hero" data-id="${d.id}">再想想</button><button class="btn gold" data-act="lvresetok" data-id="${d.id}">确定重置</button></div></div>`);
    },
    lvresetok: d => { const r = levelReset(d.id); if (typeof r === 'string') { Sfx.play('deny'); return toast(r); } Sfx.play('coin'); render(); detail(d.id); toast('返还金币 ' + fmt(r)); },
    refine: d => {
      const n = HERO_MAP[d.id].name, own = heroOwn(d.id);
      modal(`<div class="mbox"><h3>炼化碎片</h3><p class="mtext">${n} 的 <b>${own.shards}</b> 片碎片会变成 <b>${heroRefineGain(d.id)}</b> 将魂。<br>将魂可以在任何武将升星时顶替碎片；${n} 自己以后升星就得另找碎片或将魂了。</p>
        <div class="mrow"><button class="btn gray" data-act="hero" data-id="${d.id}">再想想</button><button class="btn gold" data-act="refineok" data-id="${d.id}">确定炼化</button></div></div>`);
    },
    refineok: d => { const r = heroRefine(d.id); if (typeof r === 'string') { Sfx.play('deny'); return toast(r); } Sfx.play('coin'); render(); detail(d.id); toast('将魂 +' + r); },
    refineAll: () => {
      const opts = [[0, '白'], [1, '白、绿'], [2, '白、绿、蓝'], [3, '白、绿、蓝、紫']].map(o => { const r = refineBatch(o[0], true); return `<button class="btn ${r.soul ? '' : 'gray'}" data-act="refineBatch" data-q="${o[0]}">${o[1]}<small>${r.n} 片 → 将魂 +${r.soul}</small></button>`; }).join('');
      modal(`<div class="mbox"><button class="x" data-act="close">×</button><h2>炼化</h2>
        <p class="mtext" style="font-size:13.5px">把用不上的武将<b>碎片</b>炼成<b>将魂</b>，升星时碎片不够可以用将魂补。<br>现有将魂 <b style="color:var(--gold2)">${fmt(Save.data.soul)}</b>。下面只炼<b>没上阵</b>的武将；单个武将可以在详情里炼。</p>
        <div class="mcol">${opts}</div>
        <table class="rates wrap" style="margin-top:12px"><tr><td>一片碎片值</td><td>${QUALITIES.slice(0, 6).map((q, i) => q.name + ' ' + CFG.SOUL_VALUE[i]).join('、')}</td></tr><tr><td>顶一片要</td><td>${QUALITIES.slice(0, 6).map((q, i) => q.name + ' ' + CFG.SOUL_COST[i]).join('、')}</td></tr></table></div>`);
    },
    refineBatch: d => { const r = refineBatch(Number(d.q)); if (!r.soul) { Sfx.play('deny'); return toast('没有可炼化的碎片'); } Sfx.play('coin'); closeModal(); render(); toast('炼化 ' + r.n + ' 片碎片：将魂 +' + r.soul); },
    starup: d => { const e = starUp(d.id); if (e) { Sfx.play('deny'); return toast(e); } Sfx.play(heroAwake(d.id) ? 'awake' : 'star'); render(); detail(d.id); toast('升星成功'); },
    deploy: d => { const i = Save.data.team.indexOf(null); if (i < 0) return detail(d.id, true); teamSet(i, d.id); Sfx.play('swap'); render(); detail(d.id); },
    undeploy: d => { const e = teamRemove(d.id); if (e) return toast(e); render(); detail(d.id); },
    replace: d => { teamSet(Number(d.i), d.id); Sfx.play('swap'); render(); detail(d.id); },

    draw: d => {
      const n = Number(d.n), res = gachaDraw(n);
      if (!res) { closeModal(); render(); return toast('招募令不足，可用金币兑换或观看广告'); }
      render(); showPulls(res);
      const topQ = Math.max.apply(null, res.map(r => (r.wid ? WEAPON_MAP[r.wid] : HERO_MAP[r.id]).q));   // 这一抽里最好的品质决定响哪一声
      if (n >= 10) Sfx.play('draw10');
      Sfx.play(topQ >= 7 ? 'myth_holy' : topQ === 6 ? 'myth_dark' : topQ === 5 ? 'pull5' : topQ === 4 ? 'rare' : topQ === 3 ? 'pull3' : 'pull');
      if (res.some(r => r.wid)) tip('arms2', '抽到了<b>兵器</b>：去<b>「兵器」</b>页装给武将。重复的兵器会自动熔成精铁，拿去强化好兵器', 9000);
      tip('gacha1', '抽到的武将在<b>「武将」</b>页上阵。同阵营、有缘分的武将一起上阵有加成，点<b>羁绊一览</b>可以看全部组合', 9000);
    },
    buy: d => {
      const n = d.n === 'all' ? Math.floor(Save.data.coins / CFG.TICKET_PRICE) : Number(d.n);
      const e = buyTickets(n); if (e) return toast(e);
      Sfx.play('coin'); render(); toast('兑换成功：招募令 +' + n);
    },
    ad: () => {
      if (adLeft() <= 0) return toast('今日广告次数已用完，明天再来');
      AdService.showRewarded(() => { if (adGrant()) { toast('获得招募令 ×' + CFG.AD_REWARD); render(); } }).then(ok => {
        if (ok === null) toast('暂时没有广告，请稍后再试');
        else if (ok && adGrant()) toast('获得招募令 ×' + CFG.AD_REWARD);
        else toast('未看完广告，没有奖励');
        render();
      });
    },
    adEnd: d => { clearInterval(adTimer); closeModal(); const r = adResolve; adResolve = null; if (r) r(d.ok === '1'); },
    rates: () => showRates(),

    pause: () => {
      const S = Battle.state; if (!S || S.over || S.choosing) return;
      S.paused = true; Battle.cancelAim();
      modal(`<div class="mbox"><h2>暂停</h2>
        <div class="mcol">
          <button class="btn red" data-act="resume">继续战斗</button>
          <button class="btn gold" data-act="lineup">更换武将</button>
          <button class="btn" data-act="retry">重新开始</button>
          <button class="btn gray" data-act="quit">返回主城</button>
        </div>
        <p class="mtext" style="font-size:13px;margin-top:12px">重新开始或返回主城，这一局不会获得奖励</p></div>`, false);
    },
    retry: () => { const S = Battle.state; if (!S) return; const st = S.stage; Battle.stop(); closeModal(); startBattle(st); },
    lineup: () => {
      const S = Battle.state; if (!S || S.over || S.choosing) return;
      S.paused = true; Battle.cancelAim(); hideTip();
      lpDraft = Save.data.team.slice(); lpSel = null; renderLineup();
    },
    lpSlot: d => {
      const i = Number(d.i);
      if (lpSel && lpSel.t === 'h') { lpDraft[i] = lpSel.id; lpSel = null; }
      else if (lpSel && lpSel.t === 's') { if (lpSel.i !== i) { const x = lpDraft[i]; lpDraft[i] = lpDraft[lpSel.i]; lpDraft[lpSel.i] = x; } lpSel = null; }
      else lpSel = { t: 's', i };
      renderLineup();
    },
    lpHero: d => {
      if (Battle.state && Battle.state.fallen[d.id]) return toast(HERO_MAP[d.id].name + ' 已经阵亡，这一关不能再上');
      if (lpSel && lpSel.t === 's') { lpDraft[lpSel.i] = d.id; lpSel = null; }
      else lpSel = lpSel && lpSel.t === 'h' && lpSel.id === d.id ? null : { t: 'h', id: d.id };
      renderLineup();
    },
    lpInfo: d => { if (lpDraft && heroOwn(d.id)) lpInfo(d.id); },
    lpBonds: () => { if (lpDraft) lpBonds(); },
    lpBack: () => { if (lpDraft) renderLineup(); else closeModal(); },
    lpOff: () => {
      if (!lpSel || lpSel.t !== 's' || !lpDraft[lpSel.i]) return toast('先点一个有武将的位置');
      if (lpDraft.filter(Boolean).length <= 1) return toast('至少要留一名武将守城');
      lpDraft[lpSel.i] = null; lpSel = null; renderLineup();
    },
    lpOk: () => {
      const S = Battle.state, changed = lpDraft.some((id, i) => id !== Save.data.team[i]);
      if (changed) {
        if (Battle.lineup(lpDraft)) toast('阵容已更换');
        else if (S && S.trial && S.trial.fixed) return toast('名将列传的阵容是固定的，不能换人');
        else if (S && S.trial && S.trial.fac && lpDraft.some(id => id && HERO_MAP[id].fac !== S.trial.fac)) return toast('这场试炼只能派' + facName(S.trial.fac) + '武将');
        else return toast('台上至少要留一名还能打的武将');
      }
      lpDraft = null; if (S) S.paused = false; closeModal();
    },
    lpCancel: () => { const S = Battle.state; lpDraft = null; if (S) S.paused = false; closeModal(); },
    resume: () => { const S = Battle.state; if (S) S.paused = false; closeModal(); },
    quit: () => { Battle.stop(); closeModal(); show('home'); },
    speed: () => { const S = Save.data; S.speed = S.speed % 3 + 1; Save.save(); $('#bSpeed').textContent = '×' + S.speed; },
    auto: () => { const S = Save.data; S.auto = !S.auto; Save.save(); $('#bAuto').classList.toggle('off', !S.auto); toast(S.auto ? '自动释放大招：开' : '自动释放大招：关（点下方头像手动释放）'); },
    ult: d => { const r = Battle.ult(Number(d.i)); if (r === 'rage') toast('怒气未满'); else if (r === 'none') toast('射程内没有敌人'); },
    stats: () => {
      const S = Battle.state; if (!S || S.over || S.choosing) return;
      S.paused = true; Battle.cancelAim();
      const list = Battle.damageList();
      const top = Math.max(1, ...list.map(x => x.dmg)), sum = Math.max(1, list.reduce((s, x) => s + x.dmg, 0));
      modal(`<div class="mbox"><h2>战斗统计</h2><p class="mtext" style="font-size:13px">第 ${S.wave} / ${CFG.WAVES} 波 · 击败 ${S.kills} · 铜钱 ${Math.round(S.coins)}</p>
        <div class="dmgs statlist">${list.map(x => `<div class="dmg" style="--qc:${qc(x.id)}"><img src="${P(x.id)}"><span>${HERO_MAP[x.id].name}</span><i style="width:${x.dmg / top * 100}%"></i><b>${fmt(x.dmg)} · ${Math.round(x.dmg / sum * 100)}%</b></div>`).join('')}</div>
        <div class="mrow"><button class="btn red" data-act="resume">继续战斗</button></div></div>`, false);
    },
    rock: () => { const S = Battle.state; if (S && S.bond) { if (!Battle.bond()) toast('「' + S.bond.def.name + '」还没准备好'); } else toast('点击战场任意位置投下礌石：伤害并眩晕敌人'); },
    tipClose: () => hideTip(),
    musicsw: () => { Save.data.music = Save.data.music === false; Save.save(); settings(); },
    sound: () => { Save.data.sound = Save.data.sound === false; Save.save(); settings(); if (Save.data.sound) Sfx.play('up'); },
    buff: d => { Sfx.play('buff'); const cb = buffCb; buffCb = null; closeModal(); if (cb) cb(Number(d.i)); },
    resHome: () => { Battle.stop(); closeModal(); show('home'); },
    resNext: () => { Battle.stop(); const S = Save.data; S.pick = Math.min(S.stage, lastRes.stage + 1); Save.save(); startBattle(S.pick); },
    resRetry: () => { Battle.stop(); if (lastRes && lastRes.legend) startLegend(lastRes.legendId); else if (lastRes && lastRes.rush) startRush(); else if (lastRes && lastRes.trial) startTrial(); else startBattle(lastRes.stage); },
  };

  function init() {
    $('#app').addEventListener('click', e => {
      const t = e.target.closest('[data-act]');
      if (t) { if (!t.disabled && ACT[t.dataset.act]) { if (t.dataset.act !== 'ult' && t.dataset.act !== 'tipClose') Sfx.play(t.dataset.act === 'nav' || t.dataset.act === 'htab' ? 'tab' : 'click'); ACT[t.dataset.act](t.dataset, t); } return; }
      if (e.target.id === 'modal' && closable) ACT.close();
    });
    show('home');
  }

  function cloudNote() { const el = $('#cloudNote'); if (el) el.textContent = Cloud.note(); }

  return { init, show, render, toast, hud, showBuffs, showRevive, showResult, fakeAd, cloudNote };
})();
