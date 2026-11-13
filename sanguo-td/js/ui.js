'use strict';
/* ============================================================
 * 界面：主城 / 武将 / 招募 / 战斗 HUD / 各类弹窗
 * 所有可点击元素用 data-act 标记，统一在 ACT 里处理
 * ============================================================ */

const UI = (function () {
  const $ = s => document.querySelector(s);
  let screen = 'home', heroTab = 'mine', closable = true, toastTimer = 0, pickSlot = -1;
  let lastPickHero = null;
  let hudS = null, hudRage = [], hudRock = '', hudSec = -1, hudVer = -1, lpDraft = null, lpSel = null, buffCb = null, lastRes = null, adTimer = 0, adResolve = null;

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
  function modal(html, canClose) { closable = canClose !== false; const m = $('#modal'); m.innerHTML = html; m.classList.add('on'); }
  function closeModal() { const m = $('#modal'); m.classList.remove('on'); m.innerHTML = ''; }

  /* ---------------- 页面切换 ---------------- */
  function show(tab) {
    screen = tab; $('#app').dataset.screen = tab;
    hideTip();                                              // 上一个页面的提示不带过来
    Sfx.music(tab === 'battle' ? 'battle' : 'home');
    document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    render();
  }
  function render() {
    $('#tCoins').textContent = fmt(Save.data.coins);
    $('#tTickets').textContent = fmt(Save.data.tickets);
    if (screen === 'home') renderHome();
    else if (screen === 'heroes') renderHeroes();
    else if (screen === 'gacha') renderGacha();
    else if (screen === 'arms') renderArms();
  }

  /* ---------------- 主城 ---------------- */
  function renderHome() {
    const D0 = Save.data, fresh = D0.draws === 0 && D0.tickets >= 10;
    const nb = document.querySelector('#nav button[data-tab=gacha]'); if (nb) nb.classList.toggle('hint', fresh);
    if (fresh) tip('home1', '你有 <b>10 张招募令</b>：先去<b>「招募」</b>十连，凑满 5 名武将再出征', 10000);
    else if (Object.keys(D0.weapons).length && !Object.keys(D0.weapons).some(id => D0.weapons[id].hero)) tip('arms1', '你抽到了<b>兵器</b>：去<b>「兵器」</b>页装给武将，能加攻击和出手速度；通关给的<b>精铁</b>可以强化它', 9000);
    else if (D0.stage > 1) tip('home2', '打过的关卡可以<b>扫荡</b>直接领金币；金币能升级武将，也能换招募令', 9000);
    const S = Save.data, st = S.pick, ch = chapterOf(st), cleared = st < S.stage, pw = teamPower(), rec = stageRecommend(st);
    $('#home').innerHTML = `
      <div class="logo"><b>烽火守城</b><span>三国塔防</span></div>
      <div class="stagecard">
        <div class="chap">第 ${ch.index} 章 · ${ch.name}</div>
        <div class="stagesel">
          <button data-act="stage" data-d="-1" ${st <= 1 ? 'disabled' : ''}>◀</button>
          <div class="sname">第 ${ch.sub} 关<small class="${cleared ? '' : 'new'}">${cleared ? '已通关 · 可重复挑战' : (ch.sub === 10 ? '章节决战' : '未通关')}</small></div>
          <button data-act="stage" data-d="1" ${st >= S.stage ? 'disabled' : ''}>▶</button>
        </div>
        <div class="powers"><span>推荐战力 ${rec}</span><span class="${pw >= rec ? 'ok' : 'bad'}">我方战力 ${pw}</span></div>
        <div class="reward">通关奖励：金币 ×${Math.round(stageWinCoins(st) * (cleared ? CFG.REPLAY_COIN : 1))}、精铁 ×${Math.max(1, Math.round(stageIron(st) * (cleared ? CFG.REPLAY_COIN : 1)))} + 战场掉落${cleared ? '（已通关，奖励减半）' : '<br>首通再得：招募令 ×' + (st % 10 === 0 ? 5 : 1)}</div>
        <div class="fightrow">
          ${cleared ? `<button class="btn sweep ${sweepLeft() ? '' : 'gray'}" data-act="sweep">扫荡<small>金币 ×${sweepReward(st)} · 今日 ${sweepLeft()}/${CFG.SWEEP_DAILY}</small></button>` : ''}
          <button class="btn-big ${cleared ? 'small' : ''}" data-act="fight">出征</button>
        </div>
        ${pw < rec ? '<div class="tip">战力不足？去「武将」页凑羁绊、调站位；战斗中点战场可以投石</div>' : ''}
      </div>
      <div class="homefoot"><button class="link" data-act="settings">设置 · 存档</button><div id="cloudNote" class="cloudnote">${Cloud.note()}</div></div>`;
  }

  /* ---------------- 武将 ---------------- */
  function renderHeroes() {
    if (Object.keys(Save.data.heroes).some(id => Save.data.heroes[id].lv >= 5 && teamIndex(id) < 0)) tip('reset1', '不上阵的武将可以在详情里<b>重置等级</b>，升级花的金币<b>全额返还</b>，拿去练新武将', 9000);
    if (Object.keys(Save.data.heroes).length > 3) tip('heroes1', '点两个位置可以<b>交换站位</b>。位置名变<b>绿</b> = 这名武将适合这个位置；中间是<b>主帅</b>，品质越高全军加成越多', 10000);
    const S = Save.data;
    const team = S.team.map((id, i) => {
      const role = SLOT_ROLES[i], fit = id && (role.leader || role.els.includes(HERO_MAP[id].el));
      return id
        ? `<div class="tslot has ${pickSlot === i ? 'pick' : ''}" style="--qc:${qc(id)}" data-act="slot" data-i="${i}"><em class="${fit ? 'fit' : ''}">${role.name}</em><img src="${P(id)}"><span>${HERO_MAP[id].name}</span></div>`
        : `<div class="tslot ${pickSlot === i ? 'pick' : ''}" data-act="slot" data-i="${i}"><em>${role.name}</em>空位</div>`;
    }).join('');
    const bonus = teamBonus();
    const bonds = bonus.active.length ? bonus.active.map(a => `<span class="bond ${a.type}"><b>${a.name}</b>${a.desc}</span>`).join('') : '<span class="bond none">还没有激活的羁绊</span>';
    let ids;
    if (heroTab === 'mine') ids = Object.keys(S.heroes).sort((a, b) => HERO_MAP[b].q - HERO_MAP[a].q || S.heroes[b].lv - S.heroes[a].lv);
    else ids = HEROES.slice().sort((a, b) => b.q - a.q).map(h => h.id);
    const cards = ids.map(id => {
      const d = HERO_MAP[id], own = S.heroes[id], q = QUALITIES[d.q];
      const canStar = own && own.star < CFG.MAX_STAR && own.shards >= CFG.STAR_NEED[own.star];
      return `<div class="card ${own ? '' : 'off'}" style="--qc:${q.color}" data-act="hero" data-id="${id}">
        <i class="qtag">${q.name}</i>${teamIndex(id) >= 0 ? '<i class="badge">阵</i>' : ''}
        <img src="${P(id)}"><div class="cname">${d.name}</div>
        <div class="cmeta">${own ? 'Lv.' + own.lv + ' ' + stars(own.star) : (d.locked ? '神将·未开放' : '未获得')}</div>
        ${canStar ? '<span class="dot"></span>' : ''}</div>`;
    }).join('');
    const total = HEROES.filter(h => !h.locked).length;
    $('#heroes').innerHTML = `
      <div class="team">${team}</div>
      <div class="tinfo"><span>${pickSlot >= 0 ? '再点一个位置交换站位 · 点同一位置看详情' : '点位置选中后可交换站位'}</span><span>战力 <b>${teamPower()}</b> <button class="link" data-act="bondHelp">羁绊一览</button></span></div>
      <div class="bonds">${bonds}</div>
      <div class="tabs">
        <button data-act="htab" data-v="mine" class="${heroTab === 'mine' ? 'on' : ''}">我的武将 ${Object.keys(S.heroes).length}/${total}</button>
        <button data-act="htab" data-v="all" class="${heroTab === 'all' ? 'on' : ''}">图鉴</button>
        <button data-act="refineAll" class="soulbtn">将魂 ${fmt(S.soul)} · 炼化</button>
      </div>
      <div class="grid">${cards}</div>`;
  }
  function detail(id, picking) {
    const d = HERO_MAP[id], q = QUALITIES[d.q], el = ELEMENTS[d.el], own = heroOwn(id), st = heroStats(id), ti = teamIndex(id);
    let h = `<div class="mbox" style="--qc:${q.color}"><button class="x" data-act="close">×</button>
      <div class="dhead"><img src="${P(id, 128)}"><div>
        <h3>${d.name}</h3><p>${d.title}</p>
        <span class="tag">${q.name}品</span><span class="tag dark">${FACTIONS[d.fac].name}</span><span class="tag dark">${el.name}系</span>
        ${own ? `<p style="margin-top:6px">Lv.${own.lv}　${stars(own.star)}</p>` : ''}
      </div></div>
      <div class="dstat"><div><b>${st.atk}</b>攻击</div><div><b>${(1 / st.cd).toFixed(2)}</b>每秒出手</div><div><b>${st.power}</b>战力</div></div>
      ${skillHtml(id, own)}`;
    if (own && !picking) {
      const wid = heroWeapon(id), w = wid && WEAPON_MAP[wid];
      h += w ? `<div class="wrow" style="--wq:${QUALITIES[w.q].color}" data-act="heroWeapon" data-id="${id}"><img src="${WI(wid)}"><div class="wi"><b>${w.name}</b>+${weaponOwn(wid).lv}${w.owner === id ? ' <em>专属</em>' : ''}<br>${wtext(weaponStats(wid, id))}</div><span class="go">更换 ›</span></div>`
        : `<div class="wrow" data-act="heroWeapon" data-id="${id}"><div class="wi"><b>兵器</b>还没有装备</div><span class="go">选择 ›</span></div>`;
    }
    if (d.locked) h += `<p class="mtext" style="margin-top:14px">黑、彩品质神将尚未开放，敬请期待</p>`;
    else if (!own) h += `<p class="mtext" style="margin-top:14px">尚未获得 · 可通过招募获得</p>`;
    else if (picking) {
      h += `<p class="mtext" style="margin-top:12px">阵容已满，选择要替换的武将</p><div class="pick">` +
        Save.data.team.map((tid, i) => `<button style="--qc:${qc(tid)}" data-act="replace" data-id="${id}" data-i="${i}"><img src="${P(tid)}">${HERO_MAP[tid].name}</button>`).join('') + `</div>`;
    } else {
      const maxLv = own.lv >= CFG.MAX_LEVEL, maxStar = own.star >= CFG.MAX_STAR;
      h += `<div class="mrow">
          <button class="btn gold" data-act="lvup" data-id="${id}">${maxLv ? '已满级' : '升级<small>金币 ' + fmt(levelCost(id)) + '</small>'}</button>
          <button class="btn" data-act="starup" data-id="${id}">${maxStar ? '已满星' : '升星<small>碎片 ' + own.shards + '/' + starNeed(id) + (starSoulCost(id) ? ' · 将魂补 ' + starSoulCost(id) : '') + '</small>'}</button>
        </div>
        <p class="soulrow">将魂 <b>${fmt(Save.data.soul)}</b>${own.shards > 0 ? `<button class="link" data-act="refine" data-id="${id}">把 ${own.shards} 片碎片炼化成将魂 +${heroRefineGain(id)}</button>` : '<span>碎片不够升星时可以用将魂补</span>'}</p>
        <div class="mrow"><button class="btn ${ti >= 0 ? 'gray' : 'red'}" data-act="${ti >= 0 ? 'undeploy' : 'deploy'}" data-id="${id}">${ti >= 0 ? '下阵' : '上阵'}</button>
          ${own.lv > 1 ? `<button class="btn gray" data-act="lvreset" data-id="${id}">重置等级<small>返还 ${fmt(Math.floor(levelSpent(id) * CFG.LEVEL_REFUND))}</small></button>` : ''}</div>`;
    }
    modal(h + '</div>');
  }

  function skillHtml(id, own) {
    const d = HERO_MAP[id], el = ELEMENTS[d.el], sk = heroSkill(id), awake = heroAwake(id, own);
    const combos = COMBOS.filter(c => c.ids.includes(id)).map(c => c.name + '（' + c.ids.map(x => HERO_MAP[x].name).join('、') + (c.need < c.ids.length ? ' 中 ' + c.need + ' 人' : '') + '）').join('<br>');
    return `<div class="dskill"><b>普攻 · ${el.name}</b>：${el.desc}
      ${sk ? `<br><b>被动 · ${sk.passive.name}</b>：${sk.passive.desc}
      <br><b>大招 · ${d.ult}</b>：${sk.ult.desc.replace(d.ult + '：', '')}${sk.ult.aim ? '<i class="aimtag">可瞄准</i>' : ''}
      <br><span class="${awake ? 'awake' : 'dim'}">${CFG.AWAKEN_STAR} 星觉醒：大招效果 ×1.5${awake ? '（已觉醒）' : ''}</span>` : `<br><b>大招 · ${d.ult}</b>：${el.ult}`}
      ${combos ? `<br><b>缘分</b>：<span class="dim">${combos}</span>` : ''}</div>`;
  }
  function bondHelp() {
    const fac = Object.keys(FACTION_BONDS).map(f => { const b = FACTION_BONDS[f]; return `<tr><td>${FACTIONS[f].name} · ${b.name}</td><td>${b.fmt(0).replace(/\s*\+0%$/, '')}：2 人 +${Math.round(b.vals[0] * 100)}% / 3 人 +${Math.round(b.vals[1] * 100)}% / 4 人以上 +${Math.round(b.vals[2] * 100)}%</td></tr>`; }).join('');
    const own = Save.data.heroes;
    const combo = COMBOS.map(c => `<tr><td>${c.name}</td><td>${c.ids.map(x => `<span class="${own[x] ? '' : 'dim'}">${HERO_MAP[x].name}</span>`).join('、')}${c.need < c.ids.length ? ' 中任意 ' + c.need + ' 人' : ''}：${c.desc}</td></tr>`).join('');
    const roles = SLOT_ROLES.filter((r, i) => i <= 2).map(r => `<tr><td>${r.name}</td><td>${r.desc}</td></tr>`).join('');
    modal(`<div class="mbox"><button class="x" data-act="close">×</button><h2>羁绊一览</h2>
      <h4 class="sub">站位</h4><table class="rates wrap">${roles}</table>
      <h4 class="sub">阵营羁绊</h4><table class="rates wrap">${fac}</table>
      <h4 class="sub">属性共鸣</h4><table class="rates wrap"><tr><td>同系上阵</td><td>同一种攻击类型（弓 刃 火 冰 雷 毒 风）上阵 3 / 4 / 5 人：该系伤害 +${Math.round(ELEMENT_BOND[3] * 100)}% / +${Math.round(ELEMENT_BOND[4] * 100)}% / +${Math.round(ELEMENT_BOND[5] * 100)}%</td></tr></table>
      <h4 class="sub">缘分（灰色 = 还没获得）</h4><table class="rates wrap">${combo}</table></div>`);
  }
  /* ---------------- 兵器 ---------------- */
  function renderArms() {
    const S = Save.data, W = S.weapons;
    const cards = WEAPONS.slice().sort((a, b) => (W[b.id] ? 1 : 0) - (W[a.id] ? 1 : 0) || b.q - a.q).map(w => {
      const own = W[w.id], q = QUALITIES[w.q];
      const dot = own && own.lv < CFG.WEAPON_MAX_LV && S.iron >= weaponUpCost(w.id) && own.hero;
      return `<div class="card wcard ${own ? '' : 'lock'}" style="--qc:${q.color}" data-act="weapon" data-id="${w.id}">
        <i class="qtag">${q.name}</i>${own && own.hero ? `<img class="whead" src="${P(own.hero)}">` : ''}
        <img src="${WI(w.id)}"><div class="cname">${w.name}</div>
        <div class="cmeta">${own ? '强化 <b>+' + own.lv + '</b>' : '未获得'}</div>${dot ? '<span class="dot"></span>' : ''}</div>`;
    }).join('');
    $('#arms').innerHTML = `
      <div class="ahead"><div class="cur"><i class="ico iron"></i><b>${fmt(S.iron)}</b></div>
        <p>兵器在<b>「招募」</b>里和武将一起抽（已有 ${Object.keys(W).length}/${WEAPONS.length} 件）。<b>精铁</b>用来强化：通关会给，抽到已有的兵器也会熔成精铁。</p></div>
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
      <p class="mtext" style="font-size:13px">${Platform.isTap() ? '在 TapTap 里进度会自动保存到云存档和本机备份。' : '网页版进度只存在这个浏览器里。'}换设备或清理数据前，可以复制存档码留底，之后在这里读入。</p>
      <div class="mrow"><button class="btn gold" data-act="codeOut">复制存档码</button><button class="btn" data-act="codeIn">读入存档码</button></div>
      <div class="mrow"><button class="btn" data-act="gfx">战斗画面：${GLView.active() ? '高清（WebGL）' : '兼容（2D）'}<small>${GLView.ok ? '点击切换 · 手机发热或卡顿时可以换成兼容' : '这台设备开不了高清画面' + (GLView.error ? '：' + GLView.error : '')}</small></button></div>
      <div class="mrow"><button class="btn" data-act="sound">音效：${Save.data.sound === false ? '关' : '开'}</button><button class="btn" data-act="musicsw">音乐：${Save.data.music === false ? '关' : '开'}</button></div>
      <div class="mrow"><input class="gift" id="giftCode" placeholder="礼包码" autocomplete="off" autocapitalize="characters"><button class="btn red" data-act="gift">兑换</button></div>
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
        <div class="gsoon">黑·彩神将 敬请期待</div>
        <h2>群英招募</h2><p>白 · 绿 · 蓝 · 紫 · 金 · 橙　武将与兵器同池</p>
        <div class="gshow">${showIds.map(id => `<img src="${P(id)}">`).join('')}</div>
      </div>
      <div class="gstat">招募令 <b>${fmt(S.tickets)}</b>　·　再 <b>${CFG.PITY - S.pity}</b> 抽必得橙品</div>
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
      return `<div class="pull ${d.q >= 3 ? 'hi' : ''}" style="--qc:${q.color};animation-delay:${i * 0.11}s">${r.isNew ? '<i>新</i>' : ''}
        <img src="${P(r.id, n === 1 ? 128 : 64)}"><b>${d.name}</b><small>${q.name}品 · ${note}</small></div>`;
    }).join('');
    modal(`<div class="mbox"><h2>招募结果</h2><div class="pulls ${n === 1 ? 'one' : ''}">${cards}</div>
      <div class="mrow"><button class="btn" data-act="close">确定</button><button class="btn red" data-act="draw" data-n="${n}">再招 ${n} 次</button></div></div>`);
  }
  function showRates() {
    const total = QUALITIES.reduce((s, q) => s + q.rate, 0), ws = Math.round(CFG.WEAPON_SHARE * 100);
    const rows = QUALITIES.map(q => {
      const names = HEROES.filter(h => h.q === q.id).map(h => h.name).join('、'), wn = WEAPONS.filter(w => w.q === q.id).map(w => w.name).join('、');
      return `<tr style="--qc:${q.god ? '#c8b08a' : q.color}"><td>${q.name}品</td><td>${q.rate ? (q.rate / total * 100).toFixed(1) + '%' : '未开放'}</td><td>${names}${wn ? '<br><span class="dim">兵器：' + wn + '</span>' : ''}</td></tr>`;
    }).join('');
    modal(`<div class="mbox"><button class="x" data-act="close">×</button><h2>概率公示</h2><table class="rates">${rows}</table>
      <p class="mtext" style="font-size:13px;margin-top:10px">每一抽先定品质，再有 ${ws}% 的概率是这个品质的兵器、${100 - ws}% 是武将；同品质里每个概率相同<br>十连必出紫品以上 · 累计 ${CFG.PITY} 抽未出橙品时必得橙品<br>以上为单抽基础概率，计入保底后紫、橙的实际概率更高<br>重复武将转为碎片用于升星；重复兵器熔成精铁用于强化</p></div>`);
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
        `<button class="ult" data-act="ult" data-i="${h.slot}" style="--qc:${QUALITIES[h.def.q].color}"><img src="${P(h.def.id)}"><span>${h.def.ult}</span></button>`).join('');
      hudRock = ''; hudSec = -1;
    }
    const sec = Math.floor(S.t);
    if (sec !== hudSec) { hudSec = sec; $('#bTime').textContent = String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0'); }
    const rk = S.rock.n + '/' + S.rock.max + '/' + (S.rock.n < S.rock.max ? Math.floor(S.rock.t / CFG.ROCK_CD * 20) : 20);
    if (rk !== hudRock) {
      hudRock = rk;
      const b = $('#bRock'), p = S.rock.n < S.rock.max ? S.rock.t / CFG.ROCK_CD * 100 : 100;
      b.innerHTML = '石<small>' + S.rock.n + '</small>'; b.style.setProperty('--p', p + '%'); b.classList.toggle('empty', S.rock.n <= 0);
    }
    if (S.t > 4 && S.live.length >= 4 && !tipShown()) tip('rock1', '<b>点战场</b>任意位置可以投下礌石，砸晕扎堆的敌人（左边「石」是剩余块数）', 8000);
    if (S.t > 16 && !tipShown() && S.heroes.some(h => h.rage >= 60)) tip('ult1', '怒气满了会<b>自动放大招</b>。关掉左边的「自动」，可以自己点右边头像选时机，带「可瞄准」的还能选落点', 9000);
    if (S.wave >= 3 && S.t > 40 && !tipShown() && Object.keys(Save.data.heroes).length > 5) tip('swap1', '打不动的时候点左边<b>「阵」</b>：战斗中可以随时<b>换武将、换站位</b>，留在场上的人怒气不变', 8000);
    const btns = $('#ultbar').children;
    S.heroes.forEach((h, i) => {
      const p = Math.floor(h.rage);
      if (hudRage[i] === p) return;
      hudRage[i] = p; btns[i].style.setProperty('--p', p + '%'); btns[i].classList.toggle('ready', p >= 100);
    });
    S.heroes.forEach((h, i) => btns[i].classList.toggle('aiming', S.aim === h.slot));
  }
  /* 局中换将面板：先改草稿（lpDraft），点「确定」才真的换 */
  function renderLineup() {
    const own = Save.data.heroes;
    const slots = lpDraft.map((id, i) => {
      const role = SLOT_ROLES[i], fit = id && (role.leader || role.els.includes(HERO_MAP[id].el)), sel = lpSel && lpSel.t === 's' && lpSel.i === i;
      return id ? `<div class="tslot has ${sel ? 'pick' : ''}" style="--qc:${qc(id)}" data-act="lpSlot" data-i="${i}"><em class="${fit ? 'fit' : ''}">${role.name}</em><img src="${P(id)}"><span>${HERO_MAP[id].name}</span></div>`
        : `<div class="tslot ${sel ? 'pick' : ''}" data-act="lpSlot" data-i="${i}"><em>${role.name}</em>空位</div>`;
    }).join('');
    const bench = Object.keys(own).filter(id => !lpDraft.includes(id)).sort((a, b) => heroStats(b).power - heroStats(a).power);
    const cards = bench.map(id => { const d = HERO_MAP[id], q = QUALITIES[d.q], sel = lpSel && lpSel.t === 'h' && lpSel.id === id;
      return `<div class="card ${sel ? 'pick' : ''}" style="--qc:${q.color}" data-act="lpHero" data-id="${id}"><i class="qtag">${ELEMENTS[d.el].name}</i><img src="${P(id)}"><div class="cname">${d.name}</div><div class="cmeta">Lv.${own[id].lv} · ${heroStats(id).power}</div></div>`; }).join('');
    const b = teamBonus(lpDraft), bonds = b.active.filter(a => a.type !== 'slot').map(a => a.name).join('、');
    const hint = lpSel ? (lpSel.t === 's' ? '再点下面的武将换上来，或点另一个位置交换站位' : '再点上面的一个位置，把他换上去') : '点一个位置，再点下面的武将换上；点两个位置交换站位';
    modal(`<div class="mbox lp"><h2>更换武将</h2>
      <div class="team">${slots}</div>
      <div class="lpinfo"><span>战力 <b>${teamPower(lpDraft)}</b></span><span>${bonds ? '羁绊：' + bonds : '没有激活的羁绊'}</span></div>
      <p class="mtext lphint">${hint}</p>
      <div class="lpgrid">${cards || '<p class="mtext" style="grid-column:1/-1;padding:18px 0">没有其他武将了，去招募吧</p>'}</div>
      <p class="mtext" style="font-size:12.5px;margin-top:8px">留在场上的武将保留怒气；新上场的怒气从 0 开始，${CFG.SWAP_DELAY} 秒后出手</p>
      <div class="mrow"><button class="btn gray" data-act="lpOff">下阵</button><button class="btn" data-act="lpCancel">取消</button><button class="btn red" data-act="lpOk">确定</button></div></div>`, false);
  }
  function showBuffs(opts, cb) {
    buffCb = cb;
    modal(`<div class="mbox"><h2>军令三选一</h2><div class="buffs">${opts.map((o, i) => `<button data-act="buff" data-i="${i}"><b>${o.name}</b><span>${o.desc}</span></button>`).join('')}</div></div>`, false);
  }
  function showResult(r) {
    hideTip();
    lastRes = r;
    const canNext = r.win;
    modal(`<div class="mbox res ${r.win ? '' : 'lose'}"><h2>${r.win ? '大获全胜' : '城池失守'}</h2><ul>
        ${r.win ? '' : `<li>坚守至<b>第 ${r.wave} / ${CFG.WAVES} 波</b></li>`}
        <li>击败敌军<b>${r.kills}</b></li>
        <li>获得金币（含掉落 ${r.dropped}）<b>+${r.coins}</b></li>
        ${r.iron ? `<li>精铁（强化兵器用）<b>+${r.iron}</b></li>` : ''}
        ${r.tickets ? `<li>首通奖励 · 招募令<b>+${r.tickets}</b></li>` : ''}
      </ul>
      <div class="dmgs">${(() => { const top = Math.max(1, ...r.dmg.map(x => x.dmg)), sum = Math.max(1, r.dmg.reduce((s, x) => s + x.dmg, 0));
        return r.dmg.map(x => `<div class="dmg" style="--qc:${qc(x.id)}"><img src="${P(x.id)}"><span>${HERO_MAP[x.id].name}</span><i style="width:${x.dmg / top * 100}%"></i><b>${fmt(x.dmg)} · ${Math.round(x.dmg / sum * 100)}%</b></div>`).join(''); })()}</div>
      ${r.win ? '' : '<p class="mtext" style="font-size:13px;margin-top:8px">试试：凑阵营羁绊和缘分、把武将放到合适的站位、手动瞄准大招、点战场投石</p>'}
      <div class="mrow"><button class="btn" data-act="resHome">返回主城</button>
      <button class="btn red" data-act="${canNext ? 'resNext' : 'resRetry'}">${canNext ? '下一关' : '再战一次'}</button></div></div>`, false);
  }

  /* ---------------- 点击处理 ---------------- */
  const ACT = {
    nav: d => { pickSlot = -1; show(d.tab); },
    close: () => { closeModal(); if (screen !== 'battle') render(); },
    stage: d => { const S = Save.data; S.pick = Math.max(1, Math.min(S.stage, S.pick + Number(d.d))); Save.save(); render(); },
    fight: () => startBattle(Save.data.pick),
    settings: () => settings(),
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
      toast('兑换成功：' + [r.tickets ? '招募令 +' + r.tickets : '', r.coins ? '金币 +' + r.coins : ''].filter(Boolean).join('，') + (r.left > 0 ? '（还能用 ' + r.left + ' 次）' : ''));
    },
    codeLoad: () => {
      const ta = document.querySelector('#modal textarea'), d = parseSaveCode(ta && ta.value);
      if (typeof d === 'string') return toast(d);
      Save.replace(d); closeModal(); show('home'); toast('存档已读入');
    },
    sweep: () => {
      const r = sweep(Save.data.pick);
      if (typeof r === 'string') return toast(r);
      render(); toast('扫荡完成：金币 +' + r + '、精铁 +' + stageIron(Save.data.pick));
    },
    bondHelp: () => bondHelp(),
    weapon: d => weaponDetail(d.id),
    heroWeapon: d => { lastPickHero = d.id; weaponPick(d.id); },
    wup: d => { const e = weaponUp(d.id); if (e) { Sfx.play('deny'); return toast(e); } Sfx.play('up'); render(); weaponDetail(d.id); },
    wequip: d => { const e = weaponEquip(d.id, d.h || null); if (e) { Sfx.play('deny'); return toast(e); } Sfx.play('click'); render(); weaponDetail(d.id); },
    wpick: d => { const e = weaponEquip(d.id, d.h || null); if (e) { Sfx.play('deny'); return toast(e); } Sfx.play('click'); render(); const hid = d.h || lastPickHero; if (hid) detail(hid); else closeModal(); },
    wmelt: d => {
      const w = WEAPON_MAP[d.id];
      modal(`<div class="mbox"><h3>熔掉兵器</h3><p class="mtext">${w.name} 会消失，返还 <b>${weaponMeltBack(d.id)}</b> 精铁<br>（强化花的全额返还，兵器本身折 ${CFG.WEAPON_MELT_VAL[w.q]}）<br>以后想要得重新抽</p>
        <div class="mrow"><button class="btn gray" data-act="weapon" data-id="${d.id}">再想想</button><button class="btn gold" data-act="wmeltok" data-id="${d.id}">确定熔掉</button></div></div>`);
    },
    wmeltok: d => { const r = weaponMelt(d.id); if (typeof r === 'string') { Sfx.play('deny'); return toast(r); } Sfx.play('coin'); closeModal(); render(); toast('返还精铁 ' + r); },
    resetAsk: () => modal(`<div class="mbox"><h2>重置存档</h2><p class="mtext">将清空所有武将、金币与关卡进度，确定吗？</p>
      <div class="mrow"><button class="btn" data-act="close">取消</button><button class="btn red" data-act="reset">确定重置</button></div></div>`),
    reset: () => { Save.reset(); closeModal(); show('home'); toast('存档已重置'); },

    htab: d => { heroTab = d.v; render(); },
    hero: d => detail(d.id),
    slot: d => {
      const i = Number(d.i), t = Save.data.team;
      if (pickSlot < 0) { pickSlot = i; if (!t[i]) toast('再点另一个位置交换；或点下方武将 → 上阵'); return render(); }
      if (pickSlot === i) { pickSlot = -1; render(); if (t[i]) detail(t[i]); return; }
      teamSwap(pickSlot, i); pickSlot = -1; render(); toast('已交换站位');
    },
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
    starup: d => { const e = starUp(d.id); if (e) { Sfx.play('deny'); return toast(e); } Sfx.play('rare'); render(); detail(d.id); toast('升星成功'); },
    deploy: d => { const i = Save.data.team.indexOf(null); if (i < 0) return detail(d.id, true); teamSet(i, d.id); render(); detail(d.id); },
    undeploy: d => { const e = teamRemove(d.id); if (e) return toast(e); render(); detail(d.id); },
    replace: d => { teamSet(Number(d.i), d.id); render(); detail(d.id); },

    draw: d => {
      const n = Number(d.n), res = gachaDraw(n);
      if (!res) { closeModal(); render(); return toast('招募令不足，可用金币兑换或观看广告'); }
      render(); showPulls(res);
      Sfx.play(res.some(r => (r.wid ? WEAPON_MAP[r.wid] : HERO_MAP[r.id]).q >= 4) ? 'rare' : 'pull');
      if (res.some(r => r.wid)) tip('arms2', '抽到了<b>兵器</b>：去<b>「兵器」</b>页装给武将。重复的兵器会自动熔成精铁，拿去强化好兵器', 9000);
      tip('gacha1', '抽到的武将在<b>「武将」</b>页上阵。同阵营、有缘分的武将一起上阵有加成，点<b>羁绊一览</b>可以看全部组合', 9000);
    },
    buy: d => {
      const n = d.n === 'all' ? Math.floor(Save.data.coins / CFG.TICKET_PRICE) : Number(d.n);
      const e = buyTickets(n); if (e) return toast(e);
      render(); toast('兑换成功：招募令 +' + n);
    },
    ad: () => {
      if (adLeft() <= 0) return toast('今日广告次数已用完，明天再来');
      AdService.showRewarded().then(ok => {
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
      if (lpSel && lpSel.t === 's') { lpDraft[lpSel.i] = d.id; lpSel = null; }
      else lpSel = lpSel && lpSel.t === 'h' && lpSel.id === d.id ? null : { t: 'h', id: d.id };
      renderLineup();
    },
    lpOff: () => {
      if (!lpSel || lpSel.t !== 's' || !lpDraft[lpSel.i]) return toast('先点一个有武将的位置');
      if (lpDraft.filter(Boolean).length <= 1) return toast('至少要留一名武将守城');
      lpDraft[lpSel.i] = null; lpSel = null; renderLineup();
    },
    lpOk: () => {
      const S = Battle.state, changed = lpDraft.some((id, i) => id !== Save.data.team[i]);
      if (changed && Battle.lineup(lpDraft)) toast('阵容已更换');
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
    rock: () => toast('点击战场任意位置投下礌石：伤害并眩晕敌人'),
    tipClose: () => hideTip(),
    musicsw: () => { Save.data.music = Save.data.music === false; Save.save(); settings(); },
    sound: () => { Save.data.sound = Save.data.sound === false; Save.save(); settings(); if (Save.data.sound) Sfx.play('up'); },
    buff: d => { Sfx.play('buff'); const cb = buffCb; buffCb = null; closeModal(); if (cb) cb(Number(d.i)); },
    resHome: () => { Battle.stop(); closeModal(); show('home'); },
    resNext: () => { Battle.stop(); const S = Save.data; S.pick = Math.min(S.stage, lastRes.stage + 1); Save.save(); startBattle(S.pick); },
    resRetry: () => { Battle.stop(); startBattle(lastRes.stage); },
  };

  function init() {
    $('#app').addEventListener('click', e => {
      const t = e.target.closest('[data-act]');
      if (t) { if (!t.disabled && ACT[t.dataset.act]) { if (t.dataset.act !== 'ult' && t.dataset.act !== 'tipClose') Sfx.play('click'); ACT[t.dataset.act](t.dataset, t); } return; }
      if (e.target.id === 'modal' && closable) ACT.close();
    });
    show('home');
  }

  function cloudNote() { const el = $('#cloudNote'); if (el) el.textContent = Cloud.note(); }

  return { init, show, render, toast, hud, showBuffs, showResult, fakeAd, cloudNote };
})();
