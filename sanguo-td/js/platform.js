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
  _ad: null, _done: null, _timer: 0, _shown: false,
  available() {
    const p = Platform.api();
    if (!p) return true;                                  // 网页：模拟广告
    return !!(p.createRewardedVideoAd && CFG.AD_UNIT_ID);
  },
  showRewarded() {
    const p = Platform.api();
    if (!p) return UI.fakeAd(CFG.AD_SECONDS);
    if (!this.available()) return Promise.resolve(null);
    if (this._done) return Promise.resolve(null);          // 上一条还没结束
    if (!this._ad) {                                      // 平台规定全局只有一个实例，回调只注册一次
      this._ad = p.createRewardedVideoAd({ adUnitId: CFG.AD_UNIT_ID });
      this._ad.onClose(res => this._finish(!!(res && res.isEnded)));
      this._ad.onError(() => { if (!this._shown) this._finish(null); });
    }
    return new Promise(resolve => {
      this._done = resolve; this._shown = false;
      clearTimeout(this._timer);
      this._timer = setTimeout(() => { if (!this._shown) this._finish(null); }, CFG.AD_WAIT * 1000);
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
    return '云存档：已同步' + (this.upAt ? ' · ' + new Date(this.upAt).toTimeString().slice(0, 5) + ' 已上传' : '');
  },
  setState(s, e) { this.state = s; this.err = e || ''; if (typeof UI !== 'undefined') UI.cloudNote(); },
  errStr(e) { return String((e && (e.errMsg || e.message)) || '').replace(/^\w+:\s*fail\s*/i, '').slice(0, 40); },

  /* 别的存档比本机新就换上 */
  adopt(other, why) {
    if (!other || !other.heroes || !Save.newer(other, Save.data)) return false;
    Save.replace(other);
    if (typeof UI !== 'undefined') { UI.render(); UI.toast(why); }
    return true;
  },
  init() {
    if (!this.fsOK()) return;                             // 普通网页：不启用
    this.readBackup(() => {                               // 先读备份再开始写，免得被本机旧档盖掉
      setInterval(() => { this.writeBackup(); this.upload(); }, 5000);
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
      if (!cl || !cl.save || Save.newer(Save.data, cl.save)) this._dirty = true;
    };
    try {
      cm.getArchiveList({ fail: retry, success: res => {
        const a = ((res && res.saves) || []).find(s => s.name === CFG.CLOUD_NAME);
        if (!a) return start(null);                       // 云端还没有：保留本机进度并上传
        this.uuid = a.uuid;
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
          success: r => { this.busy = false; this.upAt = Date.now(); if (r && r.uuid) this.uuid = r.uuid; if (typeof UI !== 'undefined') UI.cloudNote(); } };
        if (this.uuid) cm.updateArchive(Object.assign({ archiveUUID: this.uuid }, done)); else cm.createArchive(done);
      } });
    } catch (e) { fail(); }
  },
};
