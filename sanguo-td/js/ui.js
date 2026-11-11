'use strict';
/* ============================================================
 * 界面：主城 / 武将 / 招募 / 战斗 HUD / 各类弹窗
 * 所有可点击元素用 data-act 标记，统一在 ACT 里处理
 * ============================================================ */

const UI = (function () {
  const $ = s => document.querySelector(s);
  let screen = 'home', heroTab = 'mine', closable = true, toastTimer = 0, pickSlot = -1;
  let hudS = null, hudRage = [], hudRock = '', buffCb = null, lastRes = null, adTimer = 0, adResolve = null;

  const fmt = n => (n >= 100000 ? (n / 10000).toFixed(1) + '万' : String(Math.floor(n)));
  const P = (id, px) => Art.portrait(id, px || 64);
  const stars = n => '<span class="stars">' + '★'.repeat(n) + '</span>' + '☆'.repeat(CFG.MAX_STAR - n);
  const qc = id => QUALITIES[HERO_MAP[id].q].color;

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 1600);
  }
  function modal(html, canClose) { closable = canClose !== false; const m = $('#modal'); m.innerHTML = html; m.classList.add('on'); }
  function closeModal() { const m = $('#modal'); m.classList.remove('on'); m.innerHTML = ''; }

  /* ---------------- 页面切换 ---------------- */
  function show(tab) {
    screen = tab; $('#app').dataset.screen = tab;
    document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    render();
  }
  function render() {
    $('#tCoins').textContent = fmt(Save.data.coins);
    $('#tTickets').textContent = fmt(Save.data.tickets);
    if (screen === 'home') renderHome();
    else if (screen === 'heroes') renderHeroes();
    else if (screen === 'gacha') renderGacha();
  }

  /* ---------------- 主城 ---------------- */
  function renderHome() {
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
        <div class="reward">通关奖励：金币 ×${stageWinCoins(st)} + 战场掉落${cleared ? '' : '<br>首通再得：招募令 ×' + (st % 10 === 0 ? 5 : 1)}</div>
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
    if (d.locked) h += `<p class="mtext" style="margin-top:14px">黑、彩品质神将尚未开放，敬请期待</p>`;
    else if (!own) h += `<p class="mtext" style="margin-top:14px">尚未获得 · 可通过招募获得</p>`;
    else if (picking) {
      h += `<p class="mtext" style="margin-top:12px">阵容已满，选择要替换的武将</p><div class="pick">` +
        Save.data.team.map((tid, i) => `<button style="--qc:${qc(tid)}" data-act="replace" data-id="${id}" data-i="${i}"><img src="${P(tid)}">${HERO_MAP[tid].name}</button>`).join('') + `</div>`;
    } else {
      const maxLv = own.lv >= CFG.MAX_LEVEL, maxStar = own.star >= CFG.MAX_STAR;
      h += `<div class="mrow">
          <button class="btn gold" data-act="lvup" data-id="${id}">${maxLv ? '已满级' : '升级<small>金币 ' + fmt(levelCost(id)) + '</small>'}</button>
          <button class="btn" data-act="starup" data-id="${id}">${maxStar ? '已满星' : '升星<small>碎片 ' + own.shards + '/' + starNeed(id) + '</small>'}</button>
        </div>
        <div class="mrow"><button class="btn ${ti >= 0 ? 'gray' : 'red'}" data-act="${ti >= 0 ? 'undeploy' : 'deploy'}" data-id="${id}">${ti >= 0 ? '下阵' : '上阵'}</button></div>`;
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
      <h4 class="sub">缘分（灰色 = 还没获得）</h4><table class="rates wrap">${combo}</table></div>`);
  }
  function settings() {
    modal(`<div class="mbox"><button class="x" data-act="close">×</button><h2>设置 · 存档</h2>
      <p class="mtext" style="font-size:13px">${Platform.isTap() ? '在 TapTap 里进度会自动保存到云存档和本机备份。' : '网页版进度只存在这个浏览器里。'}换设备或清理数据前，可以复制存档码留底，之后在这里读入。</p>
      <div class="mrow"><button class="btn gold" data-act="codeOut">复制存档码</button><button class="btn" data-act="codeIn">读入存档码</button></div>
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
        <h2>群英招募</h2><p>白 · 绿 · 蓝 · 紫 · 金 · 橙　六品武将</p>
        <div class="gshow">${showIds.map(id => `<img src="${P(id)}">`).join('')}</div>
      </div>
      <div class="gstat">招募令 <b>${fmt(S.tickets)}</b>　·　再 <b>${CFG.PITY - S.pity}</b> 抽必得橙将</div>
      <div class="grow">
        <button class="btn" data-act="draw" data-n="1">招募 1 次<small>招募令 ×1</small></button>
        <button class="btn red" data-act="draw" data-n="10">招募 10 次<small>招募令 ×10 · 必出紫将以上</small></button>
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
      const d = HERO_MAP[r.id], q = QUALITIES[d.q];
      const note = r.isNew ? '新武将' : (r.coins ? '满星 · 金币+' + r.coins : '碎片 +1');
      return `<div class="pull ${d.q >= 3 ? 'hi' : ''}" style="--qc:${q.color};animation-delay:${i * 0.11}s">${r.isNew ? '<i>新</i>' : ''}
        <img src="${P(r.id, n === 1 ? 128 : 64)}"><b>${d.name}</b><small>${q.name}品 · ${note}</small></div>`;
    }).join('');
    modal(`<div class="mbox"><h2>招募结果</h2><div class="pulls ${n === 1 ? 'one' : ''}">${cards}</div>
      <div class="mrow"><button class="btn" data-act="close">确定</button><button class="btn red" data-act="draw" data-n="${n}">再招 ${n} 次</button></div></div>`);
  }
  function showRates() {
    const total = QUALITIES.reduce((s, q) => s + q.rate, 0);
    const rows = QUALITIES.map(q => {
      const names = HEROES.filter(h => h.q === q.id).map(h => h.name).join('、');
      return `<tr style="--qc:${q.god ? '#c8b08a' : q.color}"><td>${q.name}品</td><td>${q.rate ? (q.rate / total * 100).toFixed(1) + '%' : '未开放'}</td><td>${names}</td></tr>`;
    }).join('');
    modal(`<div class="mbox"><button class="x" data-act="close">×</button><h2>概率公示</h2><table class="rates">${rows}</table>
      <p class="mtext" style="font-size:13px;margin-top:10px">十连必出紫品以上 · 累计 ${CFG.PITY} 抽未出橙品时必得橙品<br>以上为单抽基础概率，计入保底后紫、橙的实际概率更高<br>重复武将转为碎片用于升星</p></div>`);
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
    if (hudS !== S) {
      hudS = S; hudRage = [];
      $('#ultbar').innerHTML = S.heroes.map(h =>
        `<button class="ult" data-act="ult" data-i="${h.slot}" style="--qc:${QUALITIES[h.def.q].color}"><img src="${P(h.def.id)}"><span>${h.def.ult}</span></button>`).join('');
      hudRock = '';
    }
    const rk = S.rock.n + '/' + S.rock.max + '/' + (S.rock.n < S.rock.max ? Math.floor(S.rock.t / CFG.ROCK_CD * 20) : 20);
    if (rk !== hudRock) {
      hudRock = rk;
      const b = $('#bRock'), p = S.rock.n < S.rock.max ? S.rock.t / CFG.ROCK_CD * 100 : 100;
      b.innerHTML = '石<small>' + S.rock.n + '</small>'; b.style.setProperty('--p', p + '%'); b.classList.toggle('empty', S.rock.n <= 0);
    }
    const btns = $('#ultbar').children;
    S.heroes.forEach((h, i) => {
      const p = Math.floor(h.rage);
      if (hudRage[i] === p) return;
      hudRage[i] = p; btns[i].style.setProperty('--p', p + '%'); btns[i].classList.toggle('ready', p >= 100);
    });
    S.heroes.forEach((h, i) => btns[i].classList.toggle('aiming', S.aim === h.slot));
  }
  function showBuffs(opts, cb) {
    buffCb = cb;
    modal(`<div class="mbox"><h2>军令三选一</h2><div class="buffs">${opts.map((o, i) => `<button data-act="buff" data-i="${i}"><b>${o.name}</b><span>${o.desc}</span></button>`).join('')}</div></div>`, false);
  }
  function showResult(r) {
    lastRes = r;
    const canNext = r.win;
    modal(`<div class="mbox res ${r.win ? '' : 'lose'}"><h2>${r.win ? '大获全胜' : '城池失守'}</h2><ul>
        ${r.win ? '' : `<li>坚守至<b>第 ${r.wave} / ${CFG.WAVES} 波</b></li>`}
        <li>击败敌军<b>${r.kills}</b></li>
        <li>获得金币（含掉落 ${r.dropped}）<b>+${r.coins}</b></li>
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
    gift: () => {
      const el = document.querySelector('#giftCode'), r = redeemGift(el && el.value);
      if (typeof r === 'string') return toast(r);
      closeModal(); render();
      toast('兑换成功：' + [r.tickets ? '招募令 +' + r.tickets : '', r.coins ? '金币 +' + r.coins : ''].filter(Boolean).join('，'));
    },
    codeLoad: () => {
      const ta = document.querySelector('#modal textarea'), d = parseSaveCode(ta && ta.value);
      if (typeof d === 'string') return toast(d);
      Save.replace(d); closeModal(); show('home'); toast('存档已读入');
    },
    sweep: () => {
      const r = sweep(Save.data.pick);
      if (typeof r === 'string') return toast(r);
      render(); toast('扫荡完成：金币 +' + r);
    },
    bondHelp: () => bondHelp(),
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
    lvup: d => { const e = levelUp(d.id); if (e) return toast(e); render(); detail(d.id); },
    starup: d => { const e = starUp(d.id); if (e) return toast(e); render(); detail(d.id); toast('升星成功'); },
    deploy: d => { const i = Save.data.team.indexOf(null); if (i < 0) return detail(d.id, true); teamSet(i, d.id); render(); detail(d.id); },
    undeploy: d => { const e = teamRemove(d.id); if (e) return toast(e); render(); detail(d.id); },
    replace: d => { teamSet(Number(d.i), d.id); render(); detail(d.id); },

    draw: d => {
      const n = Number(d.n), res = gachaDraw(n);
      if (!res) { closeModal(); render(); return toast('招募令不足，可用金币兑换或观看广告'); }
      render(); showPulls(res);
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
      modal(`<div class="mbox"><h2>暂停</h2><p class="mtext">中途退出不会获得任何奖励</p>
        <div class="mrow"><button class="btn gray" data-act="quit">退出战斗</button><button class="btn red" data-act="resume">继续</button></div></div>`, false);
    },
    resume: () => { const S = Battle.state; if (S) S.paused = false; closeModal(); },
    quit: () => { Battle.stop(); closeModal(); show('home'); },
    speed: () => { const S = Save.data; S.speed = S.speed % 3 + 1; Save.save(); $('#bSpeed').textContent = '×' + S.speed; },
    auto: () => { const S = Save.data; S.auto = !S.auto; Save.save(); $('#bAuto').classList.toggle('off', !S.auto); toast(S.auto ? '自动释放大招：开' : '自动释放大招：关（点下方头像手动释放）'); },
    ult: d => { const r = Battle.ult(Number(d.i)); if (r === 'rage') toast('怒气未满'); else if (r === 'none') toast('射程内没有敌人'); },
    rock: () => toast('点击战场任意位置投下礌石：伤害并眩晕敌人'),
    buff: d => { const cb = buffCb; buffCb = null; closeModal(); if (cb) cb(Number(d.i)); },
    resHome: () => { Battle.stop(); closeModal(); show('home'); },
    resNext: () => { Battle.stop(); const S = Save.data; S.pick = Math.min(S.stage, lastRes.stage + 1); Save.save(); startBattle(S.pick); },
    resRetry: () => { Battle.stop(); startBattle(lastRes.stage); },
  };

  function init() {
    $('#app').addEventListener('click', e => {
      const t = e.target.closest('[data-act]');
      if (t) { if (!t.disabled && ACT[t.dataset.act]) ACT[t.dataset.act](t.dataset, t); return; }
      if (e.target.id === 'modal' && closable) ACT.close();
    });
    show('home');
  }

  function cloudNote() { const el = $('#cloudNote'); if (el) el.textContent = Cloud.note(); }

  return { init, show, render, toast, hud, showBuffs, showResult, fakeAd, cloudNote };
})();
