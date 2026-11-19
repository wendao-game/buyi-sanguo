'use strict';
/* ============================================================
 * 平台接口：激励视频广告、TapTap 云存档、本机文件备份
 * 只有在 TapTap（全局 tap）/ 抖音（全局 tt）小游戏里才走真实接口；普通网页里广告是模拟的、云存档不启用
 * ============================================================ */

const Platform = {
  api() {
    if (typeof tap !== 'undefined' && tap) return tap;
    if (typeof tt !== 'undefined' && tt) return tt;
    return null;
  },
  isTap() { return typeof tap !== 'undefined' && !!tap; },
};

/* ---------------- 激励视频 ----------------
 * showRewarded() 返回 Promise：true = 完整看完可以发奖；false = 中途关闭；null = 这次没有广告
 * - 广告位 ID 在 data.js 的 CFG.AD_UNIT_ID；平台里没填就当没有广告（界面不显示广告入口）
 * - 平台拉不到广告时，show / load 可能既不成功也不报错，所以 CFG.AD_WAIT 秒还没播出来就当没有广告
 * - 普通网页：倒计时的模拟广告，方便本地调试 */
const AdService = {
  _ad: null, _done: null, _timer: 0, _shown: false, _late: null,
  /* 模拟广告只在本机调试和 GitHub 上的网页试玩版出现；其他地方（比如小游戏里 tap 还没注入）一律当没有广告，免得白拿奖励 */
  fakeOK() { return DEV || /\.github\.io$/.test(location.hostname); },
  available() {
    const p = Platform.api();
    if (!p) return this.fakeOK();
    return !!(p.createRewardedVideoAd && CFG.AD_UNIT_ID);
  },
  /* late：等了 CFG.AD_WAIT 秒没播出来、已经按「没有广告」处理之后，广告又播出来并且看完了，就调它补发奖励（复活这种过了时机的不传） */
  showRewarded(late) {
    const p = Platform.api(), quiet = typeof Sfx !== 'undefined' && Sfx.hush;
    if (quiet) Sfx.hush(true);                             // 放广告时游戏不出声
    return this._show(p, late).then(r => { if (quiet) Sfx.hush(false); return r; });
  },
  _show(p, late) {
    if (!p) return this.fakeOK() ? UI.fakeAd(CFG.AD_SECONDS) : Promise.resolve(null);
    if (!this.available()) return Promise.resolve(null);
    if (this._done) return Promise.resolve(null);          // 上一条还没结束
    if (!this._ad) {                                      // 平台规定全局只有一个实例，回调只注册一次
      this._ad = p.createRewardedVideoAd({ adUnitId: CFG.AD_UNIT_ID });
      this._ad.onClose(res => {
        const ended = !!(res && res.isEnded);
        if (this._done) return this._finish(ended);
        const f = this._late; this._late = null; if (ended && f) f();   // 超时以后才播出来的那条：看完照样发
      });
      // 播出来之前出错 = 没有广告；播到一半出错（有的机型不再来 onClose）= 没看完。都要把 _done 清掉，不然以后一直「暂时没有广告」、游戏一直静音
      this._ad.onError(() => { if (this._done) this._finish(this._shown ? false : null); else this._late = null; });
    }
    return new Promise(resolve => {
      this._done = resolve; this._shown = false; this._late = null;
      clearTimeout(this._timer);
      this._timer = setTimeout(() => { if (!this._shown) { this._late = late || null; this._finish(null); } }, CFG.AD_WAIT * 1000);
      const ad = this._ad, shown = () => { this._shown = true; clearTimeout(this._timer); };
      ad.show().then(shown).catch(() => ad.load().then(() => ad.show()).then(shown).catch(() => this._finish(null)));
    });
  },
  _finish(result) { clearTimeout(this._timer); const d = this._done; this._done = null; if (d) d(result); },
};

/* ---------------- 云存档 + 本机文件备份（TapTap） ----------------
 * 进游戏：先读本机文件备份，再下载云端那份，和本机比较，取「累计获得更多」的那份（一样多取后保存的）。
 * 之后存档有变化就标记，不在战斗中时每 CFG.CLOUD_EVERY 秒最多上传一次，备份文件 5 秒查一次。
 * 网页存储被清掉（清理工具、个别机型关掉游戏就清）也能从文件备份或云端找回。 */
const Cloud = {
  state: '', err: '', uuid: null, ready: false, busy: false, _dirty: false, lastUp: -1e9, lastBak: '', upAt: 0,
  ok() { const t = Platform.isTap() ? tap : null; return !!(t && t.getCloudSaveManager && t.getFileSystemManager && t.env && t.env.USER_DATA_PATH); },
  fsOK() { const t = Platform.isTap() ? tap : null; return !!(t && t.getFileSystemManager && t.env && t.env.USER_DATA_PATH); },
  path(name) { return tap.env.USER_DATA_PATH + '/' + name; },
  dirty() { if (this.ready) this._dirty = true; },
  note() {
    if (!this.state) return '';
    if (this.state === 'load') return '云存档：正在同步…';
    if (this.state === 'err') return '云存档：没连上' + (this.err ? '（' + this.err + '）' : '') + '，稍后重试；进度先存在本机';
    return '云存档：已同步' + (this.upAt ? ' · ' + new Date(this.upAt).toTimeString().slice(0, 5) + ' 已上传' : '') + (Clock.anchor ? ' · 时间已校准' : ' · 校准时间中');
  },
  setState(s, e) { this.state = s; this.err = e || ''; if (typeof UI !== 'undefined') UI.cloudNote(); },
  errStr(e) { return String((e && (e.errMsg || e.message)) || '').replace(/^\w+:\s*fail\s*/i, '').slice(0, 40); },

  /* 别的存档比本机新就换上。正在战斗（含结算页）时先记下，回到主城再换：
   * 打到一半换档，这局的结算会写进换上来的存档（可能直接跳关） */
  adopt(other, why) {
    if (!other || !other.heroes || !Save.newer(other, Save.data)) return false;
    if (typeof Battle !== 'undefined' && Battle.state) { this.pending = { other, why }; return false; }
    this.pending = null;
    Save.replace(other);
    if (typeof UI !== 'undefined') { UI.render(); UI.toast(why); }
    return true;
  },
  /* 战斗结束后把记下的存档换上（再比一次：这局打完本机可能已经更新了） */
  flushPending() {
    if (!this.pending || (typeof Battle !== 'undefined' && Battle.state)) return;
    const p = this.pending; this.pending = null;
    if (!this.adopt(p.other, p.why)) this._dirty = true;   // 本机更新：照常上传
  },
  init() {
    if (!this.fsOK()) return;                             // 普通网页：不启用
    this.readBackup(() => {                               // 先读备份再开始写，免得被本机旧档盖掉
      setInterval(() => { this.flushPending(); this.writeBackup(); this.upload(); }, 5000);
      if (this.ok()) this.load();
    });
  },
  readBackup(done) {
    try {
      tap.getFileSystemManager().readFile({ filePath: this.path('sanguo_td_backup.json'), encoding: 'utf8', fail: () => done(),
        success: f => { let o = null; try { o = JSON.parse(f.data); } catch (e) { /* 坏的当作没有 */ } if (o && o.save) this.adopt(o.save, '已从本机备份找回进度'); done(); } });
    } catch (e) { done(); }
  },
  writeBackup() {
    if (!this.fsOK() || (typeof Battle !== 'undefined' && Battle.state && !Battle.state.over)) return;
    const data = JSON.stringify({ v: 1, save: Save.data });
    if (data === this.lastBak) return;
    this.lastBak = data;
    try { tap.getFileSystemManager().writeFile({ filePath: this.path('sanguo_td_backup.json'), data, encoding: 'utf8', fail: () => { this.lastBak = ''; } }); } catch (e) { this.lastBak = ''; }
  },
  load() {
    const cm = tap.getCloudSaveManager(), fs = tap.getFileSystemManager();
    const retry = e => { this.setState('err', this.errStr(e)); setTimeout(() => this.load(), 30000); };
    if (this.state !== 'err') this.setState('load');
    const start = cl => {
      if (cl && cl.save) this.adopt(cl.save, '云存档已同步');
      this.ready = true; this.setState('ok');
      this._dirty = true; this.lastUp = -1e9;               // 每次进游戏都马上上传一次：上传完读服务器的修改时间，校准每日奖励用的时间（见 Clock）
    };
    try {
      cm.getArchiveList({ fail: retry, success: res => {
        const a = ((res && res.saves) || []).find(s => s.name === CFG.CLOUD_NAME);
        if (!a) return start(null);                       // 云端还没有：保留本机进度并上传
        this.uuid = a.uuid;
        if (a.modifiedTime > 0) Clock.floor(a.modifiedTime * 1000);   // 上次上传的服务器时间：至少已经到这个时候了
        const target = this.path(CFG.CLOUD_NAME + '_cloud.json');
        cm.getArchiveData({ archiveUUID: a.uuid, archiveFileId: a.fileId, targetFilePath: target, fail: retry,
          success: d => fs.readFile({ filePath: d.filePath || target, encoding: 'utf8', fail: retry,
            success: f => { let o = null; try { o = JSON.parse(f.data); } catch (e) { /* 坏档当作没有 */ } start(o); } }) });
      } });
    } catch (e) { retry(e); }
  },
  upload() {
    if (!this.ready || this.busy || !this._dirty || performance.now() - this.lastUp < CFG.CLOUD_EVERY * 1000) return;
    if (typeof Battle !== 'undefined' && Battle.state && !Battle.state.over) return;   // 打的时候不调接口
    const cm = tap.getCloudSaveManager(), fs = tap.getFileSystemManager(), file = this.path(CFG.CLOUD_NAME + '.json'), S = Save.data;
    this.busy = true; this._dirty = false; this.lastUp = performance.now();
    const fail = () => { this.busy = false; this._dirty = true; };
    const meta = { name: CFG.CLOUD_NAME, summary: '第 ' + S.stage + ' 关 · 武将 ' + Object.keys(S.heroes).length + ' 名', playtime: 0 };
    try {
      fs.writeFile({ filePath: file, data: JSON.stringify({ v: 1, save: S }), encoding: 'utf8', fail, success: () => {
        const done = { archiveMetaData: meta, archiveFilePath: file, fail,
          success: r => { this.busy = false; this.upAt = Date.now(); if (r && r.uuid) this.uuid = r.uuid; this.stamp(); if (typeof UI !== 'undefined') UI.cloudNote(); } };
        if (this.uuid) cm.updateArchive(Object.assign({ archiveUUID: this.uuid }, done)); else cm.createArchive(done);
      } });
    } catch (e) { fail(); }
  },
  /* 刚上传完：再取一次存档列表，存档的 modifiedTime 就是服务器的「现在」（秒）。拿它校准 Clock */
  stamp() {
    try {
      tap.getCloudSaveManager().getArchiveList({ fail: () => {}, success: res => {
        const a = ((res && res.saves) || []).find(s => (this.uuid && s.uuid === this.uuid) || s.name === CFG.CLOUD_NAME);
        if (!a || !(a.modifiedTime > 0)) return;
        const was = !!Clock.anchor;
        Clock.set(a.modifiedTime * 1000);
        if (typeof UI !== 'undefined') { UI.cloudNote(); if (!was && !(typeof Battle !== 'undefined' && Battle.state)) UI.render(); }   // 第一次校准好：每日军饷、挂机、试炼的按钮刷新
      } });
    } catch (e) { /* 拿不到就等下一次上传 */ }
  },
};

/* ---------------- 时间（v2.18）：每日奖励、挂机按服务器时间算，改手机时间没用 ----------------
 * 服务器时间从云存档来：每次上传完读存档的 modifiedTime（服务器记的秒数），之后用 performance.now()（只往前走、
 * 不受改手机时间影响）往后推。每天按北京时间 0 点刷新（save.js 的 dayNo），改时区也提前不了。
 * 还没拿到服务器时间（刚启动几秒、没网、云存档连不上）：用手机时间，但最多比上次确认过的服务器时间晚 36 小时——
 * 离线的正常玩家第二天照样能领；往后调时间一次最多提前一天多，联网后就锁住。
 * 普通网页（没有云存档接口）：照旧用手机时间。 */
const Clock = {
  anchor: null,                                           // { server: 服务器毫秒, perf: 当时的 performance.now() }
  MAX_AHEAD: 36 * 36e5,
  need() { return typeof Cloud !== 'undefined' && Cloud.ok(); },
  rec() { const S = Save.data; return S.clk && typeof S.clk === 'object' ? S.clk : (S.clk = {}); },
  set(ms) { if (!(ms > 0)) return; this.anchor = { server: ms, perf: performance.now() }; this.floor(ms); },
  floor(ms) { const C = this.rec(); if (ms > (C.last || 0)) C.last = ms; },
  now() {
    if (!this.need()) return Date.now();
    const C = this.rec();
    if (this.anchor) return Math.max(C.last || 0, this.anchor.server + (performance.now() - this.anchor.perf));
    if (!(C.first > 0)) C.first = Date.now();             // 从没校准过（新装、一直没网）：从第一次打开的时候起算
    return Math.min(Date.now(), Math.max(C.last || 0, C.first) + this.MAX_AHEAD);
  },
  /* 界面用：在 TapTap 里、还没拿到服务器时间 */
  waiting() { return this.need() && !this.anchor; },
};
// 切回游戏（锁屏、切后台回来）：下一次定时检查时上传一次，重新校准（后台时 performance.now 可能停走）
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('visibilitychange', () => { if (!document.hidden && typeof Cloud !== 'undefined' && Cloud.ready) { Cloud._dirty = true; } });

/* ---------------- TapTap 排行榜（v2.18） ----------------
 * 两个榜（ID 在 data.js）：最高关卡 = 已通关数（主线 80 关之后无尽每层接着算）；最高战力 = 历史最高阵容战力。
 * 有长进才报：报成功的记在存档 lb 里；最多 30 秒报一次，打仗的时候不报（结算时强制报一次）。普通网页里不启用。
 * 参数照 TapTap 文档写，不多带字段（布衣三国踩过：多带字段 PC 端报 101） */
const Rank = {
  at: -1e9, busy: false,
  ok() { return Platform.isTap() && typeof tap.getLeaderboardManager === 'function' && !!CFG.LB_STAGE; },
  call(fn, args, cb) {
    try { tap.getLeaderboardManager()[fn](Object.assign({ callback: Object.assign({ onSuccess() {}, onFailure() {} }, cb) }, args)); }
    catch (e) { if (cb && cb.onFailure) cb.onFailure(e); }   // 排行榜出错不影响游戏
  },
  stageScore() { return Math.max(0, (Save.data.stage | 0) - 1); },
  /* 记下历史最高战力（不在 TapTap 里也记，主城排行榜按钮显示用） */
  track() { const S = Save.data, p = teamPower(); if (p > (S.bestPower || 0)) S.bestPower = p; return S.bestPower || 0; },
  sync(force) {
    const power = this.track();
    if (!this.ok() || this.busy || Save.data.noRank) return;   // noRank：读入过存档码的进度不上榜
    if (typeof Battle !== 'undefined' && Battle.state && !Battle.state.over) return;
    const S = Save.data, lb = S.lb && typeof S.lb === 'object' ? S.lb : (S.lb = { stage: 0, power: 0 }), stage = this.stageScore();
    const scores = [];
    if (stage > (lb.stage || 0)) scores.push({ leaderboardId: CFG.LB_STAGE, score: stage });
    if (power > (lb.power || 0)) scores.push({ leaderboardId: CFG.LB_POWER, score: power });
    const rush = typeof rushRec === 'function' ? rushRec().best : 0;   // 过关斩将：最多斩将数（榜单编号还没填就不报）
    if (CFG.LB_RUSH && rush > (lb.rush || 0)) scores.push({ leaderboardId: CFG.LB_RUSH, score: rush });
    if (!scores.length || (!force && performance.now() - this.at < 30000)) return;
    this.at = performance.now(); this.busy = true;
    this.call('submitScores', { scores }, {
      onSuccess: () => { this.busy = false; lb.stage = Math.max(lb.stage || 0, stage); lb.power = Math.max(lb.power || 0, power); if (CFG.LB_RUSH) lb.rush = Math.max(lb.rush || 0, rush); Save.save(); },
      onFailure: () => { this.busy = false; },             // 没网等：下次再报
    });
  },
  open(id) { if (this.ok()) this.call('openLeaderboard', { leaderboardId: id, collection: 'public' }); },
};
