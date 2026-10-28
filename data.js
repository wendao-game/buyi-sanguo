// 布衣三国 · 游戏数据
// 所有数值、武器、技能、敌人、武将、关卡节奏都在这里配置。
// 以后迁移到 Godot 时，这份数据可以直接转成 JSON / Resource 使用。

window.GAME_DATA = {
  player: {
    base: { maxHp: 100, speed: 170, pickup: 90, crit: 0.05, critMul: 1.8 },
    weaponSlots: 6,
    passiveSlots: 6,
  },
  // 箭矢、法球的射程：多远的敌人会被瞄准、飞多久消失（原来 620 / 1.2 秒、600 / 3.5 秒，太远了）
  aim: { arrowRange: 420, arrowLife: 0.8, orbRange: 400, orbSeek: 380, orbLife: 2.2 },
  // 闪现：空格 / Shift（手机点右下角「闪」），朝移动方向瞬移 5 个身位，冷却 5 秒，瞬移时短暂无敌
  blink: { cd: 5, dist: 150, iframes: 0.3 },

  // TapTap 广告和排行榜：在 TapTap 里打开时才有（网页版自动隐藏）。ID 在 TapTap 开发者后台拿到后填进来，空着就不显示。
  // rewardedAdUnitId：激励视频广告位 ID；leaderboardId：排行榜 ID（按这一局达到的等级排名，降序、保留历史最高）
  // 看广告复活每局只有一次：满血、短暂无敌、震开身边的敌人；结算时看广告，本局金币再加 adGoldBonus
  taptap: { rewardedAdUnitId: '1054324', leaderboardId: 'gwy1u779jhgau3z3er', reviveIframes: 3, reviveKnockR: 320, adGoldBonus: 0.2,
    // 云存档：局外进度（金币、装备）、最佳纪录、图鉴存到玩家的 TapTap 账号里，换手机、清缓存都不丢（没打完的那一局只存在本机）。
    // TapTap 限制每分钟最多上传一次，所以有变化后至少隔 every 秒才传；name 是云端存档名（不能有空格和中文）
    cloudSave: { name: 'buyi_save', every: 65 },
    // TapTap 成就（ID 和后台一一对应，见 assets/achievements/成就清单.md；发布后 ID 不能改）。这里只列分步成就和它们的总步数，其余都是达成即解锁
    achSteps: { codex10: 10, codexAll: 28, boss100: 100, sbAll: 27, camp100: 100, kills100k: 100000 } },

  // 无限成长：武器 / 技能满 5 级后的“突破”规则
  breakthrough: {
    dmgPerLevel: 0.12,   // 每突破一级伤害 +12%
    areaPerLevel: 0.02,  // 范围 +2%
    cdPerLevel: 0.98,    // 冷却 ×0.98
    minCdMul: 0.7,       // 冷却最多缩到满级时的 70%
    countEvery: 3,       // 每 3 级数量 / 穿透 / 画戟 +1（到上限为止）
    countCap: 4,         // 箭矢、文气、火球、飞戟、画戟等一次最多 4 个（连珠箭也算在内）
    pierceCap: 4,        // 穿透最多 4 个
  },
  // 周郎琴、寒玉笛的音波：后期范围、冷却叠得太狠会一圈接一圈铺满屏幕、看不清地图（玩家反馈）。
  // 半径最多到本级的 area 倍，两轮之间至少隔 cd 秒；超出的范围每多 1 倍折算成 areaDmg 倍伤害，被压住的冷却按比例折算成伤害
  sonicCap: { area: 1.3, cd: 1.6, areaDmg: 0.5 }, // 玩家反馈后期音波圈太多太亮：半径最多 1.3 倍、两轮至少隔 1.6 秒
  // 冷却上限：武器、技能最快到满级冷却的 minCd 倍（原来兵书 × 孙子兵法 × 突破能压到 14%，一秒放好几轮，满屏光污染）；
  // 超出上限的那部分按比例折算成伤害，总伤害基本不变。神兵同样最快到自身冷却的 minCd 倍
  cdCap: { minCd: 0.4 },

  // 升级所需经验：前期很快，越往后越慢（指数增长，到 capLv 级后改为每级固定多加 latePerLv）
  // = base + (等级-1)×perLv + expA×(expG^(等级-1) - 1)
  xpCurve: { base: 2, perLv: 1, expA: 3.5, expG: 1.15, capLv: 45, latePerLv: 30 },

  // 军衔：随等级晋升，体现“从布衣到名将”
  ranks: [
    { lv: 1, name: '布衣' },
    { lv: 5, name: '什长' },
    { lv: 10, name: '百夫长' },
    { lv: 15, name: '军侯' },
    { lv: 20, name: '校尉' },
    { lv: 25, name: '中郎将' },
    { lv: 30, name: '将军' },
    { lv: 40, name: '大将军' },
    { lv: 50, name: '大司马' },
    { lv: 60, name: '万人敌' },
    { lv: 80, name: '天下无双' },
  ],

  // 出身：开局三选一
  origins: [
    {
      id: 'farmer', name: '农夫', icon: '农', weapon: 'hoe', focus: 'body', focusName: '炼体',
      desc: '种了半辈子地，身子骨硬朗。',
      perks: ['生命上限 150，护甲 +2', '每秒回复 0.8 生命，伤害 +12%', '炼体：更容易刷到生命、护甲、回复'],
      stats: { maxHp: 150, regen: 0.8, armor: 2, dmg: 0.12 }, // 原来 130 血、0.4 回复，明显弱于猎户书生（玩家反馈），补上护甲和伤害
      look: { skin: '#c48a58', skinShade: '#9c6a40', robe: '#8c7b5a', trim: '#5e5040', armor: false, beard: 'stubble', beardColor: '#2a2018', eyes: 'normal', brows: 'sharp', head: 'straw', weapon: 'hoe', aura: '#6b7a4a', artFace: [0.50, 0.31, 0.36], extras: ['patches', 'towel'] },
    },
    {
      id: 'hunter', name: '猎户', icon: '猎', weapon: 'bow', focus: 'bow', focusName: '弓箭',
      desc: '山中射猎为生，眼疾手快。',
      perks: ['移动速度 +10%', '暴击率 +8%', '弓箭：更容易刷到弓弩与箭术'],
      stats: { speedMul: 1.1, crit: 0.08 },
      look: { skin: '#d6a273', skinShade: '#ae7c50', robe: '#5c4a33', trim: '#8a6a3a', armor: false, beard: 'none', eyes: 'normal', brows: 'sharp', head: 'hunter', headColor: '#3e5a3a', weapon: 'bow', aura: '#3f5f50', artFace: [0.53, 0.24, 0.36], extras: ['fur'] },
    },
    {
      id: 'scholar', name: '书生', icon: '书', weapon: 'scroll', focus: 'spell', focusName: '计策',
      desc: '读过几卷兵书，懂得借力。',
      perks: ['冷却 -10%', '拾取范围 +30%', '计策：更容易刷到法术、技能与计谋'],
      stats: { cdMul: 0.9, pickupMul: 1.3 },
      look: { skin: '#efd6b4', skinShade: '#cfb08a', robe: '#d9d3c2', trim: '#34465a', armor: false, beard: 'none', eyes: 'calm', brows: 'thin', head: 'scholar', headColor: '#2a2f38', weapon: 'scrolls', aura: '#4f6577', artFace: [0.48, 0.22, 0.36], extras: ['sash'] },
    },
  ],

  // 武器：type 决定攻击方式，levels 是每一级的数值
  weapons: {
    hoe: {
      name: '锄头', icon: '锄', type: 'arc', common: true, tags: ['body'],
      desc: '朝最近的敌人挥砍，扇形范围内全部命中。',
      levels: [
        { dmg: 18, cd: 0.8, range: 95, angle: 140, kb: 140 },
        { dmg: 24, cd: 0.75, range: 100, angle: 145, kb: 150, note: '伤害 +6，范围扩大' },
        { dmg: 30, cd: 0.7, range: 106, angle: 155, kb: 160, note: '伤害 +6，挥得更快' },
        { dmg: 36, cd: 0.65, range: 112, angle: 160, kb: 170, back: true, note: '同时向身后挥砍' },
        { dmg: 48, cd: 0.58, range: 125, angle: 180, kb: 190, back: true, note: '伤害 +12，范围大幅扩大' },
      ],
    },
    bow: {
      name: '猎弓', icon: '弓', type: 'projectile', common: true, tags: ['bow'],
      desc: '向最近的敌人射箭。',
      levels: [
        { dmg: 14, cd: 0.6, count: 1, speed: 580, pierce: 1 },
        { dmg: 18, cd: 0.52, count: 1, speed: 600, pierce: 1, note: '伤害 +4，射速提升' },
        { dmg: 20, cd: 0.52, count: 2, speed: 620, pierce: 1, note: '一次射出 2 支箭' },
        { dmg: 25, cd: 0.46, count: 2, speed: 640, pierce: 2, note: '箭矢可穿透 2 个敌人' },
        { dmg: 32, cd: 0.4, count: 3, speed: 680, pierce: 3, note: '一次射出 3 支箭，穿透 3 个' },
      ],
    },
    scroll: {
      name: '竹简', icon: '简', type: 'homing', common: true, tags: ['spell'],
      desc: '放出追踪敌人的文气。',
      levels: [
        { dmg: 14, cd: 0.95, count: 1, speed: 300 },
        { dmg: 16, cd: 0.95, count: 2, speed: 310, note: '文气数量 +1' },
        { dmg: 21, cd: 0.8, count: 2, speed: 320, note: '伤害 +5，冷却缩短' },
        { dmg: 25, cd: 0.8, count: 3, speed: 330, note: '文气数量 +1' },
        { dmg: 32, cd: 0.7, count: 4, speed: 350, note: '文气数量 +1，伤害 +7' },
      ],
    },
    torch: {
      name: '火把', icon: '火', type: 'aura', common: true, tags: ['spell'],
      desc: '身边燃起火圈，持续灼烧靠近的敌人。',
      levels: [
        { dmg: 7, tick: 0.35, radius: 66 },
        { dmg: 9, tick: 0.35, radius: 76, note: '伤害 +2，火圈扩大' },
        { dmg: 11, tick: 0.3, radius: 86, note: '灼烧更快' },
        { dmg: 14, tick: 0.3, radius: 98, note: '伤害 +3，火圈扩大' },
        { dmg: 19, tick: 0.25, radius: 112, note: '伤害 +5，火圈扩大' },
      ],
    },
    // —— 武将兵器：只能从击败武将获得 ——
    dadao: {
      name: '华雄大刀', icon: '刀', type: 'arc', general: '华雄',
      desc: '西凉悍将的厚背大刀，劈砍范围大，击退极强。',
      levels: [
        { dmg: 48, cd: 1.6, range: 145, angle: 170, kb: 280 },
        { dmg: 60, cd: 1.5, range: 152, angle: 180, kb: 290, note: '伤害 +12' },
        { dmg: 72, cd: 1.4, range: 160, angle: 190, kb: 300, note: '伤害 +12，更快' },
        { dmg: 84, cd: 1.35, range: 165, angle: 200, kb: 310, back: true, note: '同时向身后劈砍' },
        { dmg: 105, cd: 1.2, range: 175, angle: 210, kb: 330, back: true, note: '伤害 +21' },
      ],
    },
    halberd: {
      name: '方天画戟', icon: '戟', type: 'orbit', general: '吕布',
      desc: '吕布的神兵。画戟环绕周身旋转，触者即伤。',
      levels: [
        { dmg: 32, blades: 2, radius: 105, len: 78, spin: 3.4, hitGap: 0.35 },
        { dmg: 40, blades: 2, radius: 112, len: 84, spin: 3.6, hitGap: 0.33, note: '伤害 +8，范围扩大' },
        { dmg: 46, blades: 3, radius: 118, len: 88, spin: 3.8, hitGap: 0.3, note: '画戟 +1' },
        { dmg: 54, blades: 3, radius: 126, len: 94, spin: 4.1, hitGap: 0.28, note: '伤害 +8，转得更快' },
        { dmg: 66, blades: 4, radius: 134, len: 100, spin: 4.4, hitGap: 0.25, note: '画戟 +1，伤害 +12' },
      ],
    },
    qinglong: {
      name: '青龙偃月刀', icon: '龙', type: 'arc', general: '关羽',
      desc: '关羽的神兵。每一刀都会斩出一道贯穿全场的刀气。',
      levels: [
        { dmg: 50, cd: 1.4, range: 150, angle: 160, kb: 260, wave: 0.6 },
        { dmg: 62, cd: 1.32, range: 156, angle: 170, kb: 270, wave: 0.6, note: '伤害 +12' },
        { dmg: 74, cd: 1.25, range: 162, angle: 180, kb: 280, wave: 0.8, note: '刀气伤害提高' },
        { dmg: 88, cd: 1.18, range: 168, angle: 190, kb: 290, wave: 0.8, back: true, note: '同时向身后挥砍' },
        { dmg: 110, cd: 1.05, range: 180, angle: 200, kb: 320, wave: 1.0, back: true, note: '刀气与刀同伤' },
      ],
    },
    shemao: {
      name: '丈八蛇矛', icon: '矛', type: 'thrust', general: '张飞',
      desc: '张飞的蛇矛。向前猛刺，一条线上的敌人全部贯穿。',
      levels: [
        { dmg: 30, cd: 0.9, len: 230, width: 34, count: 1, kb: 160 },
        { dmg: 38, cd: 0.85, len: 245, width: 36, count: 1, kb: 170, note: '伤害 +8，刺得更远' },
        { dmg: 42, cd: 0.8, len: 255, width: 38, count: 2, kb: 170, note: '一次刺出 2 矛' },
        { dmg: 52, cd: 0.75, len: 270, width: 40, count: 2, kb: 180, note: '伤害 +10，刺得更远' },
        { dmg: 64, cd: 0.65, len: 290, width: 44, count: 3, kb: 200, note: '一次刺出 3 矛' },
      ],
    },
    longdan: {
      name: '龙胆亮银枪', icon: '枪', type: 'thrust', general: '赵云',
      desc: '赵云的银枪。出枪极快，连刺不停。',
      levels: [
        { dmg: 18, cd: 0.42, len: 180, width: 26, count: 1, kb: 80 },
        { dmg: 22, cd: 0.4, len: 185, width: 26, count: 1, kb: 80, note: '伤害 +4' },
        { dmg: 24, cd: 0.38, len: 190, width: 28, count: 2, kb: 90, note: '一次刺出 2 枪' },
        { dmg: 30, cd: 0.35, len: 200, width: 28, count: 2, kb: 90, note: '伤害 +6，刺得更远' },
        { dmg: 36, cd: 0.3, len: 215, width: 30, count: 3, kb: 100, note: '一次刺出 3 枪' },
      ],
    },
    shuangji: {
      name: '双铁戟', icon: '铁', type: 'boomerang', general: '典韦',
      desc: '典韦的双戟。掷出后会飞回手中，来回都能伤敌。',
      levels: [
        { dmg: 34, cd: 1.6, count: 2, range: 260, speed: 440 },
        { dmg: 42, cd: 1.55, count: 2, range: 270, speed: 450, note: '伤害 +8' },
        { dmg: 46, cd: 1.45, count: 3, range: 280, speed: 460, note: '多掷一支' },
        { dmg: 56, cd: 1.35, count: 3, range: 300, speed: 470, note: '伤害 +10，飞得更远' },
        { dmg: 68, cd: 1.2, count: 4, range: 320, speed: 490, note: '多掷一支' },
      ],
    },
    yushan: {
      name: '羽扇', icon: '扇', type: 'burst', general: '诸葛亮', tags: ['spell'],
      desc: '诸葛亮的羽扇。扇出火球追踪敌人，命中后爆炸。',
      levels: [
        { dmg: 26, cd: 1.2, count: 1, speed: 300, radius: 60 },
        { dmg: 32, cd: 1.2, count: 2, speed: 310, radius: 62, note: '火球 +1' },
        { dmg: 38, cd: 1.05, count: 2, speed: 320, radius: 70, note: '爆炸范围扩大' },
        { dmg: 46, cd: 1.05, count: 3, speed: 330, radius: 75, note: '火球 +1' },
        { dmg: 56, cd: 0.9, count: 4, speed: 350, radius: 85, note: '火球 +1，爆炸更大' },
      ],
    },
    kaishan: {
      name: '开山斧', icon: '斧', type: 'arc', general: '程远志',
      desc: '黄巾大将的开山斧。抡圆了劈下，劈中的敌人会被震晕片刻。',
      levels: [
        { dmg: 40, cd: 1.3, range: 125, angle: 150, kb: 220, stun: 0.5 },
        { dmg: 50, cd: 1.25, range: 132, angle: 160, kb: 230, stun: 0.6, note: '伤害 +10' },
        { dmg: 60, cd: 1.15, range: 138, angle: 170, kb: 240, stun: 0.7, note: '伤害 +10，更快' },
        { dmg: 72, cd: 1.1, range: 145, angle: 180, kb: 250, stun: 0.8, back: true, note: '同时向身后劈砍' },
        { dmg: 90, cd: 1.0, range: 155, angle: 190, kb: 280, stun: 1.0, back: true, note: '伤害 +18，震晕更久' },
      ],
    },
    yaofu: {
      name: '地公符', icon: '符', type: 'meteor', general: '张宝', tags: ['spell'],
      desc: '张宝的符咒。符纸飞向敌群，片刻后引落一块巨石砸下。',
      levels: [
        { dmg: 44, cd: 1.5, count: 2, radius: 64, delay: 0.55 },
        { dmg: 54, cd: 1.45, count: 2, radius: 68, delay: 0.55, note: '伤害 +10，范围扩大' },
        { dmg: 60, cd: 1.35, count: 3, radius: 70, delay: 0.5, note: '符咒 +1' },
        { dmg: 72, cd: 1.3, count: 3, radius: 76, delay: 0.5, note: '伤害 +12，范围扩大' },
        { dmg: 86, cd: 1.15, count: 4, radius: 82, delay: 0.45, note: '符咒 +1' },
      ],
    },
    jiujie: {
      name: '九节杖', icon: '杖', type: 'chain', general: '张角', tags: ['spell'],
      desc: '天公将军的法杖。放出闪电，在敌人之间连续跳跃。',
      levels: [
        { dmg: 26, cd: 1.1, chains: 4, range: 380, jump: 170 },
        { dmg: 32, cd: 1.05, chains: 5, range: 390, jump: 175, note: '伤害 +6，多跳一次' },
        { dmg: 36, cd: 0.95, chains: 6, range: 400, jump: 180, note: '多跳一次，更快' },
        { dmg: 44, cd: 0.9, chains: 7, range: 420, jump: 190, note: '伤害 +8，多跳一次' },
        { dmg: 54, cd: 0.8, chains: 9, range: 440, jump: 200, note: '雷光连绵，多跳两次' },
      ],
    },
    hebeidao: {
      name: '河北大刀', icon: '旋', type: 'spin', general: '颜良',
      desc: '颜良的大刀。定时原地回旋横扫，一圈内的敌人连受数刀。',
      levels: [
        { dmg: 22, cd: 2.6, radius: 120, hits: 3, kb: 120 },
        { dmg: 28, cd: 2.5, radius: 126, hits: 3, kb: 130, note: '伤害 +6' },
        { dmg: 30, cd: 2.3, radius: 132, hits: 4, kb: 130, note: '多转一圈' },
        { dmg: 38, cd: 2.2, radius: 140, hits: 4, kb: 140, note: '伤害 +8，范围扩大' },
        { dmg: 46, cd: 2.0, radius: 150, hits: 5, kb: 160, note: '多转一圈' },
      ],
    },
    lianmao: {
      name: '文丑连弩', icon: '弩', type: 'projectile', general: '文丑', tags: ['bow'],
      desc: '文丑的连弩。一次扇形射出一排弩箭，近身时几乎箭箭命中。',
      levels: [
        { dmg: 18, cd: 0.9, count: 3, speed: 640, pierce: 1, fan: 0.22 },
        { dmg: 22, cd: 0.85, count: 3, speed: 660, pierce: 1, fan: 0.22, note: '伤害 +4' },
        { dmg: 25, cd: 0.8, count: 4, speed: 680, pierce: 2, fan: 0.22, note: '弩箭 +1，穿透 2 个' },
        { dmg: 31, cd: 0.75, count: 4, speed: 700, pierce: 2, fan: 0.21, note: '伤害 +6，射得更快' },
        { dmg: 42, cd: 0.65, count: 4, speed: 740, pierce: 3, fan: 0.2, note: '伤害 +11，穿透 3 个' },
      ],
    },
    luoying: {
      name: '落樱', icon: '樱', type: 'homing', general: '貂蝉', tags: ['spell'], pkind: 'petal',
      desc: '貂蝉的花扇。扇出一簇樱花瓣，追着敌人飞去。',
      levels: [
        { dmg: 16, cd: 0.9, count: 3, speed: 330 },
        { dmg: 20, cd: 0.9, count: 3, speed: 340, note: '伤害 +4' },
        { dmg: 23, cd: 0.8, count: 4, speed: 350, note: '花瓣 +1，更快' },
        { dmg: 28, cd: 0.75, count: 4, speed: 360, note: '伤害 +5，更快' },
        { dmg: 38, cd: 0.65, count: 4, speed: 380, note: '伤害 +10，落英缤纷' },
      ],
    },
    yudi: {
      name: '寒玉笛', icon: '笛', type: 'sonic', general: '甄姬', tags: ['spell'], ice: true,
      desc: '甄姬的玉笛。笛声化作一圈圈寒气向外扩散，碰到的敌人受伤并被冻得行动迟缓。',
      levels: [
        { dmg: 22, cd: 1.5, ringR: 250, count: 1 },
        { dmg: 28, cd: 1.45, ringR: 270, count: 1, note: '伤害 +6，传得更远' },
        { dmg: 30, cd: 1.4, ringR: 280, count: 2, note: '连吹两声' },
        { dmg: 38, cd: 1.3, ringR: 300, count: 2, note: '伤害 +8，传得更远' },
        { dmg: 46, cd: 1.2, ringR: 330, count: 3, note: '连吹三声' },
      ],
    },
    feishan: {
      name: '飞扇', icon: '扇', type: 'boomerang', general: '孙尚香', fan: true,
      desc: '孙尚香的铁骨折扇。掷出后旋转着飞回手中，来回都能伤敌。',
      levels: [
        { dmg: 26, cd: 1.3, count: 2, range: 240, speed: 480 },
        { dmg: 32, cd: 1.25, count: 2, range: 250, speed: 490, note: '伤害 +6' },
        { dmg: 36, cd: 1.15, count: 3, range: 260, speed: 500, note: '多掷一把' },
        { dmg: 44, cd: 1.1, count: 3, range: 280, speed: 510, note: '伤害 +8，飞得更远' },
        { dmg: 54, cd: 1.0, count: 4, range: 300, speed: 530, note: '多掷一把' },
      ],
    },
    zhouqin: {
      name: '周郎琴', icon: '琴', type: 'sonic', general: '周瑜', tags: ['spell'],
      desc: '周瑜的古琴。琴音化作一圈圈音波向外扩散，穿过的敌人都会受伤。',
      levels: [
        { dmg: 24, cd: 1.6, ringR: 260, count: 1 },
        { dmg: 30, cd: 1.5, ringR: 280, count: 1, note: '伤害 +6，传得更远' },
        { dmg: 32, cd: 1.5, ringR: 290, count: 2, note: '连奏两声' },
        { dmg: 40, cd: 1.4, ringR: 310, count: 2, note: '伤害 +8，传得更远' },
        { dmg: 48, cd: 1.3, ringR: 340, count: 3, note: '连奏三声' },
      ],
    },
    // —— 董卓、大乔、小乔 ——
    molian: {
      name: '缚魂链', icon: '链', type: 'chain', general: '董卓', dark: true,
      desc: '董卓的黑铁锁链。甩出去在敌人之间来回抽打，被抽中的敌人会被往你这边拽一下。',
      levels: [
        { dmg: 30, cd: 1.2, chains: 3, range: 360, jump: 190, tug: 70 },
        { dmg: 37, cd: 1.15, chains: 4, range: 370, jump: 195, tug: 80, note: '伤害 +7，多抽一个' },
        { dmg: 42, cd: 1.05, chains: 5, range: 380, jump: 200, tug: 90, note: '多抽一个，更快' },
        { dmg: 52, cd: 1.0, chains: 5, range: 400, jump: 210, tug: 100, note: '伤害 +10，拽得更狠' },
        { dmg: 64, cd: 0.9, chains: 7, range: 420, jump: 220, tug: 120, note: '铁链横飞，多抽两个' },
      ],
    },
    liandeng: {
      name: '莲灯', icon: '灯', type: 'homing', general: '大乔', tags: ['spell'], pkind: 'lantern',
      desc: '大乔的莲花灯。放出慢悠悠的莲灯飘向敌人，撞上后炸开一团水光，波及周围。',
      levels: [
        { dmg: 30, cd: 1.4, count: 2, speed: 210, blast: 70 },
        { dmg: 37, cd: 1.35, count: 2, speed: 220, blast: 74, note: '伤害 +7' },
        { dmg: 40, cd: 1.25, count: 3, speed: 225, blast: 78, note: '莲灯 +1' },
        { dmg: 50, cd: 1.2, count: 3, speed: 235, blast: 84, note: '伤害 +10，炸得更大' },
        { dmg: 62, cd: 1.1, count: 4, speed: 245, blast: 92, note: '江上千灯，莲灯 +1' },
      ],
    },
    // —— 马超、郭嘉 ——
    hutouqiang: {
      name: '虎头湛金枪', icon: '枪', type: 'thrust', general: '马超', rgb: '255,215,130', spark: true,
      desc: '马超的金枪。一枪刺得又长又远，枪尖带着银蓝色的雷光，打中的敌人被挑飞。',
      levels: [
        { dmg: 34, cd: 0.8, len: 260, width: 34, count: 1, kb: 220 },
        { dmg: 42, cd: 0.78, len: 275, width: 34, count: 1, kb: 230, note: '伤害 +8，更长' },
        { dmg: 46, cd: 0.72, len: 290, width: 36, count: 2, kb: 240, note: '一次刺两枪' },
        { dmg: 58, cd: 0.68, len: 310, width: 38, count: 2, kb: 250, note: '伤害 +12，更长' },
        { dmg: 72, cd: 0.6, len: 340, width: 40, count: 3, kb: 280, note: '一次刺三枪，神威凛凛' },
      ],
    },
    guihuo: {
      name: '鬼火', icon: '鬼', type: 'homing', general: '郭嘉', tags: ['spell'], pkind: 'wisp',
      desc: '郭嘉放出的青绿色鬼火，飘忽不定地追着敌人，撞上后炸开一小团冷焰。',
      levels: [
        { dmg: 20, cd: 1.0, count: 3, speed: 260, blast: 55 },
        { dmg: 25, cd: 1.0, count: 3, speed: 270, blast: 58, note: '伤害 +5' },
        { dmg: 28, cd: 0.9, count: 4, speed: 280, blast: 62, note: '鬼火 +1' },
        { dmg: 35, cd: 0.85, count: 4, speed: 290, blast: 66, note: '伤害 +7，炸得更大' },
        { dmg: 44, cd: 0.75, count: 5, speed: 300, blast: 72, note: '百鬼夜行，鬼火 +1' },
      ],
    },
    // 虎将刀：锁定附近最强的敌人（精英、名将优先），刀光一闪而至，在它身上连斩 hits 刀（radius 是每一刀波及的范围）；range 是找目标的距离
    hujiangdao: {
      name: '虎将刀', icon: '斩', type: 'duelSlash', general: '夏侯惇',
      desc: '夏侯惇的厚背大刀。每隔一会儿锁定附近最强的敌人（精英、名将优先），刀光一闪而至，在它身上连斩三刀，旁边的敌人一起遭殃。',
      levels: [
        { dmg: 40, cd: 3.2, hits: 3, range: 380, radius: 70 },
        { dmg: 50, cd: 3.0, hits: 3, range: 395, radius: 74, note: '伤害 +10' },
        { dmg: 56, cd: 2.8, hits: 4, range: 410, radius: 78, note: '多斩一刀' },
        { dmg: 70, cd: 2.6, hits: 4, range: 430, radius: 84, note: '伤害 +14，更快' },
        { dmg: 86, cd: 2.3, hits: 5, range: 460, radius: 92, note: '盲将之怒，多斩一刀' },
      ],
    },
    // 狼顾：身前身后同时张开两道目光，绕着你扫过一段（sweep 是扫过的圈数，dur 是扫一次用几秒）
    langgu: {
      name: '狼顾', icon: '顾', type: 'gaze', general: '司马懿', tags: ['spell'],
      desc: '司马懿的狼顾之相：身前身后同时张开两道幽紫的目光，绕着你扫过半圈，目光所及的敌人都受伤。',
      levels: [
        { dmg: 26, cd: 1.6, R: 210, half: 0.32, sweep: 0.5, dur: 0.45 },
        { dmg: 32, cd: 1.55, R: 225, half: 0.33, sweep: 0.5, dur: 0.45, note: '伤害 +6，看得更远' },
        { dmg: 36, cd: 1.45, R: 240, half: 0.36, sweep: 0.6, dur: 0.5, note: '扫得更开' },
        { dmg: 46, cd: 1.35, R: 255, half: 0.38, sweep: 0.6, dur: 0.5, note: '伤害 +10，看得更远' },
        { dmg: 58, cd: 1.2, R: 280, half: 0.42, sweep: 0.75, dur: 0.55, note: '鹰视狼顾，扫过大半圈' },
      ],
    },
    diewu: {
      name: '蝶舞', icon: '蝶', type: 'homing', general: '小乔', tags: ['spell'], pkind: 'butterfly',
      desc: '小乔袖中飞出的流光彩蝶，绕着弯追向敌人，能穿过两个敌人再散去。',
      levels: [
        { dmg: 14, cd: 0.75, count: 3, speed: 360, pierce: 2 },
        { dmg: 17, cd: 0.75, count: 3, speed: 370, pierce: 2, note: '伤害 +3' },
        { dmg: 19, cd: 0.7, count: 4, speed: 380, pierce: 2, note: '彩蝶 +1' },
        { dmg: 24, cd: 0.65, count: 4, speed: 390, pierce: 3, note: '伤害 +5，多穿一个' },
        { dmg: 30, cd: 0.6, count: 5, speed: 410, pierce: 3, note: '蝶影翩跹，彩蝶 +1' },
      ],
    },
    luori: {
      name: '落日弓', icon: '弓', type: 'projectile', general: '黄忠', tags: ['bow'],
      desc: '黄忠的落日弓。穿透力极强的长箭，离目标越远伤害越高（百步穿杨）。',
      levels: [ // far：飞出 600 以外时伤害最多再加这么多（按飞过的距离算）
        { dmg: 20, cd: 0.85, count: 1, speed: 900, pierce: 3, far: 0.6 },
        { dmg: 26, cd: 0.8, count: 1, speed: 930, pierce: 3, far: 0.7, note: '伤害 +6，越远越痛' },
        { dmg: 30, cd: 0.75, count: 2, speed: 960, pierce: 4, far: 0.8, note: '一次两箭，穿透 4 个', fan: 0.1 },
        { dmg: 37, cd: 0.7, count: 2, speed: 980, pierce: 5, far: 0.9, note: '伤害 +7，穿透 5 个', fan: 0.1 },
        { dmg: 48, cd: 0.6, count: 3, speed: 1020, pierce: 6, far: 1.0, note: '一次三箭，百步穿杨', fan: 0.1 },
      ],
    },
  },

  // 技能：只能从武将处获得，之后升级时可以强化
  skills: {
    biyue: {
      name: '闭月', icon: '月', type: 'shockwave', general: '貂蝉', petal: true,
      desc: '定时一舞，樱花如潮涌出：周围敌人受伤，并被迷住呆立片刻。',
      levels: [
        { dmg: 40, cd: 8, radius: 200, kb: 60, stun: 1.4 },
        { dmg: 50, cd: 7.5, radius: 215, kb: 60, stun: 1.6, note: '伤害 +10，迷得更久' },
        { dmg: 62, cd: 7, radius: 230, kb: 70, stun: 1.8, note: '范围扩大，冷却缩短' },
        { dmg: 78, cd: 6.5, radius: 245, kb: 70, stun: 2.0, note: '伤害 +16，迷得更久' },
        { dmg: 98, cd: 6, radius: 270, kb: 80, stun: 2.4, note: '闭月羞花，满场倾倒' },
      ],
    },
    hanbing: {
      name: '冰封', icon: '冰', type: 'formation', general: '甄姬', ice: true,
      desc: '定时在脚下铺开一片寒冰，冰上的敌人寸步难行，并持续被冻伤。',
      levels: [
        { dmg: 11, cd: 9, radius: 170, life: 4.5, slow: 0.3, tick: 0.4 },
        { dmg: 14, cd: 9, radius: 182, life: 4.5, slow: 0.3, tick: 0.4, note: '冻伤更重，冰面更大' },
        { dmg: 17, cd: 8, radius: 195, life: 5, slow: 0.28, tick: 0.4, note: '冷却缩短，持续更久' },
        { dmg: 22, cd: 8, radius: 210, life: 5, slow: 0.25, tick: 0.35, note: '冻得更狠' },
        { dmg: 28, cd: 7, radius: 230, life: 5.5, slow: 0.2, tick: 0.35, note: '洛水成冰，万军难渡' },
      ],
    },
    bingshu: {
      name: '兵书', icon: '书', type: 'beans', general: '孙尚香', page: true,
      desc: '定时翻开兵书，书页化作飞刃扑向敌人，撞上后炸开。',
      levels: [
        { count: 4, cd: 6, dmg: 38, radius: 62 },
        { count: 5, cd: 5.6, dmg: 46, radius: 64, note: '书页 +1' },
        { count: 6, cd: 5.2, dmg: 54, radius: 68, note: '书页 +1，伤害提高' },
        { count: 7, cd: 4.8, dmg: 64, radius: 72, note: '书页 +1，爆炸更大' },
        { count: 9, cd: 4.2, dmg: 78, radius: 78, note: '万卷齐飞，书页 +2' },
      ],
    },
    xiaoyong: {
      name: '骁勇', icon: '勇', type: 'shockwave', general: '华雄',
      desc: '定时怒喝一声，震伤并震退周围所有敌人。',
      levels: [
        { dmg: 50, cd: 8, radius: 170, kb: 320 },
        { dmg: 65, cd: 7.2, radius: 185, kb: 330, note: '伤害 +15，冷却缩短' },
        { dmg: 80, cd: 6.5, radius: 200, kb: 340, note: '伤害 +15，范围扩大' },
        { dmg: 100, cd: 5.8, radius: 215, kb: 350, note: '伤害 +20，冷却缩短' },
        { dmg: 125, cd: 5, radius: 240, kb: 380, note: '伤害 +25，范围扩大' },
      ],
    },
    wushuang: {
      name: '无双', icon: '双', type: 'wushuang', general: '吕布',
      desc: '生命越低伤害越高；并定时放出一圈血色戟气。',
      levels: [
        { bonus: 0.6, dmg: 80, cd: 9, ringR: 300 },
        { bonus: 0.75, dmg: 100, cd: 8.2, ringR: 320, note: '血色戟气伤害 +20' },
        { bonus: 0.9, dmg: 125, cd: 7.5, ringR: 340, note: '低血增伤提高' },
        { bonus: 1.05, dmg: 150, cd: 6.8, ringR: 360, note: '伤害 +25，冷却缩短' },
        { bonus: 1.2, dmg: 190, cd: 6, ringR: 400, note: '天下无双' },
      ],
    },
    chitu: {
      name: '赤兔', icon: '兔', type: 'trample', general: '吕布',
      desc: '骑上赤兔马，大幅提速，撞到的敌人受伤并被撞飞。',
      levels: [
        { speed: 0.25, dmg: 16, kb: 260 },
        { speed: 0.3, dmg: 22, kb: 280, note: '速度提升，冲撞伤害 +6' },
        { speed: 0.35, dmg: 28, kb: 300, note: '速度提升，冲撞伤害 +6' },
        { speed: 0.4, dmg: 34, kb: 320, note: '速度提升，冲撞伤害 +6' },
        { speed: 0.45, dmg: 44, kb: 360, note: '日行千里' },
      ],
    },
    wusheng: {
      name: '武圣', icon: '圣', type: 'crescents', general: '关羽',
      desc: '定时向四面八方斩出巨大的青龙刀气，贯穿一切。',
      levels: [
        { dmg: 70, cd: 7, count: 6 },
        { dmg: 85, cd: 6.5, count: 6, note: '伤害 +15' },
        { dmg: 100, cd: 6, count: 8, note: '刀气 +2' },
        { dmg: 120, cd: 5.5, count: 8, note: '伤害 +20，冷却缩短' },
        { dmg: 150, cd: 5, count: 10, note: '刀气 +2' },
      ],
    },
    paoxiao: {
      name: '咆哮', icon: '吼', type: 'shockwave', general: '张飞',
      desc: '定时一声怒吼，震伤周围敌人，并让它们呆立不动。',
      levels: [
        { dmg: 35, cd: 8, radius: 220, kb: 120, stun: 1.2 },
        { dmg: 45, cd: 7.5, radius: 235, kb: 120, stun: 1.4, note: '伤害 +10，定身更久' },
        { dmg: 55, cd: 7, radius: 250, kb: 130, stun: 1.6, note: '范围扩大' },
        { dmg: 70, cd: 6.5, radius: 265, kb: 130, stun: 1.8, note: '伤害 +15，定身更久' },
        { dmg: 90, cd: 6, radius: 290, kb: 150, stun: 2.2, note: '当阳桥头一声吼' },
      ],
    },
    qijin: {
      name: '七进七出', icon: '进', type: 'rampage', general: '赵云',
      desc: '定时骑上白龙驹杀入敌阵：数秒内无敌并加速，身后白龙相随，撞到的敌人全部受伤。',
      levels: [
        { dmg: 30, cd: 14, dur: 2.5, speed: 0.6 },
        { dmg: 38, cd: 13, dur: 2.8, speed: 0.6, note: '持续更久' },
        { dmg: 46, cd: 12, dur: 3.1, speed: 0.65, note: '冷却缩短' },
        { dmg: 56, cd: 11, dur: 3.4, speed: 0.65, note: '伤害 +10，持续更久' },
        { dmg: 70, cd: 10, dur: 4, speed: 0.7, note: '七进七出，如入无人之境' },
      ],
    },
    elai: {
      name: '古之恶来', icon: '恶', type: 'thorns', general: '典韦',
      desc: '护甲提高；每次受伤都会反震周围的敌人。',
      levels: [
        { armor: 2, dmg: 40, radius: 150 },
        { armor: 3, dmg: 55, radius: 160, note: '护甲 +1，反震伤害 +15' },
        { armor: 4, dmg: 70, radius: 170, note: '护甲 +1，反震伤害 +15' },
        { armor: 5, dmg: 90, radius: 185, note: '护甲 +1，反震伤害 +20' },
        { armor: 7, dmg: 120, radius: 200, note: '护甲 +2，反震伤害 +30' },
      ],
    },
    bazhen: {
      name: '八阵图', icon: '阵', type: 'formation', general: '诸葛亮',
      desc: '定时在脚下布下八阵图，阵中敌人大幅减速并持续受伤。',
      levels: [
        { dmg: 10, cd: 9, radius: 170, life: 5, slow: 0.4, tick: 0.4 },
        { dmg: 13, cd: 9, radius: 180, life: 5, slow: 0.4, tick: 0.4, note: '伤害提高，阵更大' },
        { dmg: 16, cd: 8, radius: 190, life: 5.5, slow: 0.4, tick: 0.4, note: '冷却缩短，持续更久' },
        { dmg: 20, cd: 8, radius: 205, life: 5.5, slow: 0.35, tick: 0.35, note: '减速更强' },
        { dmg: 26, cd: 7, radius: 225, life: 6, slow: 0.3, tick: 0.35, note: '石阵困敌，十万兵难出' },
      ],
    },
    haoling: {
      name: '黄巾号令', icon: '令', type: 'levy', general: '程远志',
      desc: '定时振臂一呼，召来一队黄巾降卒随你冲杀，一段时间后散去。',
      levels: [
        { count: 3, cd: 12, life: 10, dmg: 14 },
        { count: 3, cd: 11, life: 11, dmg: 18, note: '降卒伤害提高' },
        { count: 4, cd: 11, life: 12, dmg: 20, note: '多召一人' },
        { count: 4, cd: 10, life: 13, dmg: 26, note: '降卒伤害提高，冷却缩短' },
        { count: 6, cd: 9, life: 14, dmg: 32, note: '一呼百应，多召两人' },
      ],
    },
    sadou: {
      name: '撒豆成兵', icon: '豆', type: 'beans', general: '张宝',
      desc: '定时撒出一把金豆，化作豆兵扑向敌人，撞上后炸开。',
      levels: [
        { count: 4, cd: 6, dmg: 36, radius: 60 },
        { count: 5, cd: 5.6, dmg: 44, radius: 62, note: '豆兵 +1' },
        { count: 6, cd: 5.2, dmg: 52, radius: 66, note: '豆兵 +1，伤害提高' },
        { count: 7, cd: 4.8, dmg: 62, radius: 70, note: '豆兵 +1，爆炸更大' },
        { count: 9, cd: 4.2, dmg: 76, radius: 76, note: '豆兵 +2' },
      ],
    },
    tianlei: {
      name: '天雷', icon: '雷', type: 'thunder', general: '张角',
      desc: '定时召下天雷，劈向附近的数个敌人，落点周围一起受伤。',
      levels: [
        { count: 3, cd: 4, dmg: 60, radius: 55, range: 420 },
        { count: 4, cd: 3.8, dmg: 72, radius: 58, range: 430, note: '多劈一道' },
        { count: 5, cd: 3.5, dmg: 84, radius: 62, range: 440, note: '多劈一道，伤害提高' },
        { count: 6, cd: 3.2, dmg: 100, radius: 66, range: 460, note: '多劈一道，冷却缩短' },
        { count: 8, cd: 2.8, dmg: 124, radius: 72, range: 480, note: '苍天已死，黄天当立' },
      ],
    },
    chongzhen: {
      name: '冲阵', icon: '冲', type: 'dash', general: '颜良',
      desc: '定时朝敌人最密集处策马突进，沿途的敌人全部受伤并被撞开，冲刺中无敌。',
      levels: [
        { dmg: 50, cd: 6, len: 300, w: 60 },
        { dmg: 62, cd: 5.6, len: 320, w: 64, note: '伤害 +12，冲得更远' },
        { dmg: 74, cd: 5.2, len: 340, w: 68, note: '伤害 +12，冷却缩短' },
        { dmg: 90, cd: 4.8, len: 360, w: 72, note: '伤害 +16，冲得更远' },
        { dmg: 110, cd: 4.2, len: 400, w: 80, note: '河北名将，万军辟易' },
      ],
    },
    xuezhan: {
      name: '血战', icon: '血', type: 'bloodlust', general: '文丑',
      desc: '每击杀一个敌人回复生命，并叠加一层战意（伤害提高），一段时间不杀敌会慢慢消退。',
      levels: [
        { heal: 0.5, per: 0.01, max: 20 },
        { heal: 0.6, per: 0.012, max: 22, note: '回复更多，战意更强' },
        { heal: 0.7, per: 0.014, max: 25, note: '回复更多，战意上限提高' },
        { heal: 0.85, per: 0.016, max: 28, note: '回复更多，战意更强' },
        { heal: 1.0, per: 0.02, max: 30, note: '越战越勇' },
      ],
    },
    huogong: {
      name: '火烧赤壁', icon: '焰', type: 'firestorm', general: '周瑜',
      desc: '定时朝敌群射出火船，落点燃起大火，持续灼烧火中的敌人。',
      levels: [
        { count: 2, cd: 7, dmg: 14, radius: 90, life: 4, tick: 0.4 },
        { count: 2, cd: 6.5, dmg: 18, radius: 96, life: 4.5, tick: 0.4, note: '伤害提高，火更大' },
        { count: 3, cd: 6.2, dmg: 20, radius: 100, life: 4.5, tick: 0.35, note: '多一处火' },
        { count: 3, cd: 5.6, dmg: 26, radius: 108, life: 5, tick: 0.35, note: '伤害提高，烧得更久' },
        { count: 4, cd: 5, dmg: 32, radius: 118, life: 5.5, tick: 0.3, note: '樯橹灰飞烟灭' },
      ],
    },
    // —— 董卓、大乔、小乔 ——
    baozheng: {
      name: '暴政', icon: '暴', type: 'hookPull', general: '董卓', dark: true,
      desc: '定时甩出数条铁链，钩住附近的敌人拽到身前，再一脚踏下黑色冲击波。',
      levels: [
        { count: 4, cd: 7, range: 380, dmg: 50, radius: 150, stun: 0.8 },
        { count: 5, cd: 6.6, range: 390, dmg: 62, radius: 160, stun: 0.9, note: '多钩一个，伤害提高' },
        { count: 6, cd: 6.2, range: 400, dmg: 74, radius: 170, stun: 1.0, note: '多钩一个，冷却缩短' },
        { count: 7, cd: 5.8, range: 420, dmg: 90, radius: 180, stun: 1.1, note: '多钩一个，伤害提高' },
        { count: 9, cd: 5.2, range: 450, dmg: 110, radius: 200, stun: 1.3, note: '魔王降世，多钩两个' },
      ],
    },
    chunjiang: {
      name: '春江', icon: '江', type: 'formation', general: '大乔', water: true,
      desc: '定时在脚下铺开一片莲池：池里的敌人走不快、不断受伤；你站在池里时持续回血。',
      levels: [
        { dmg: 9, cd: 10, radius: 170, life: 5, slow: 0.55, tick: 0.45, heal: 1.2 },
        { dmg: 12, cd: 9.5, radius: 180, life: 5, slow: 0.55, tick: 0.45, heal: 1.6, note: '伤害和回血提高' },
        { dmg: 14, cd: 9, radius: 192, life: 5.5, slow: 0.5, tick: 0.4, heal: 2, note: '莲池更大，持续更久' },
        { dmg: 18, cd: 8.5, radius: 205, life: 5.5, slow: 0.5, tick: 0.4, heal: 2.6, note: '伤害和回血提高' },
        { dmg: 23, cd: 7.5, radius: 225, life: 6, slow: 0.45, tick: 0.35, heal: 3.4, note: '一江春水，满池莲开' },
      ],
    },
    tieqi: {
      name: '铁骑', icon: '骑', type: 'cavalryCharge', general: '马超',
      desc: '定时召来一队西凉铁骑的英灵，从你身后朝前方冲阵，一路撞翻敌人。',
      levels: [
        { count: 3, cd: 8, dmg: 45, len: 700, w: 70, speed: 1000 },
        { count: 3, cd: 7.5, dmg: 56, len: 750, w: 74, speed: 1050, note: '伤害提高，冲得更远' },
        { count: 4, cd: 7, dmg: 64, len: 780, w: 76, speed: 1100, note: '骑兵 +1' },
        { count: 4, cd: 6.5, dmg: 80, len: 820, w: 80, speed: 1150, note: '伤害提高，冷却缩短' },
        { count: 6, cd: 5.8, dmg: 98, len: 880, w: 86, speed: 1250, note: '西凉铁骑，骑兵 +2' },
      ],
    },
    yiji: {
      name: '遗计', icon: '计', type: 'delayedBlast', general: '郭嘉', tags: ['spell'],
      desc: '定时给附近最强的几个敌人贴上锦囊，片刻后锦囊炸开，周围的敌人一起遭殃。',
      levels: [
        { count: 3, cd: 7, delay: 1.6, dmg: 70, radius: 110 },
        { count: 3, cd: 6.6, delay: 1.6, dmg: 86, radius: 116, note: '伤害提高，范围更大' },
        { count: 4, cd: 6.2, delay: 1.5, dmg: 98, radius: 122, note: '多贴一个' },
        { count: 4, cd: 5.8, delay: 1.4, dmg: 120, radius: 130, note: '伤害提高，炸得更快' },
        { count: 6, cd: 5, delay: 1.3, dmg: 146, radius: 140, note: '遗计定辽东，多贴两个' },
      ],
    },
    dieying: {
      name: '蝶影', icon: '影', type: 'decoy', general: '小乔', butterfly: true,
      desc: '定时在原地留下一个蝴蝶化成的分身，引开附近小兵的注意，几秒后分身炸成漫天彩蝶。',
      levels: [
        { cd: 9, life: 3, lure: 320, dmg: 60, radius: 150 },
        { cd: 8.5, life: 3.2, lure: 340, dmg: 76, radius: 160, note: '伤害提高，引得更久' },
        { cd: 8, life: 3.5, lure: 360, dmg: 92, radius: 170, note: '冷却缩短，范围更大' },
        { cd: 7.5, life: 3.7, lure: 380, dmg: 115, radius: 180, note: '伤害提高，引得更远' },
        { cd: 6.5, life: 4, lure: 420, dmg: 140, radius: 200, note: '蝶影成双，难辨真假' },
      ],
    },
    // 刚烈：每次受伤，朝打你的敌人（没有就朝最强的敌人）劈回一道血色刀光；伤害 = dmg × (1 + 已损生命比例 × lowHp)，gap 秒内只反击一次
    ganglie: {
      name: '刚烈', icon: '烈', type: 'retaliate', general: '夏侯惇',
      desc: '每次受伤，都朝打你的敌人劈回一道血色刀光，一路贯穿；你掉的血越多，这一刀越重。',
      levels: [
        { dmg: 60, len: 420, w: 50, lowHp: 1.5, gap: 0.6 },
        { dmg: 76, len: 440, w: 54, lowHp: 1.6, gap: 0.55, note: '伤害提高' },
        { dmg: 90, len: 460, w: 58, lowHp: 1.8, gap: 0.5, note: '伤害提高，刀光更长' },
        { dmg: 110, len: 490, w: 62, lowHp: 2.0, gap: 0.45, note: '伤害提高，反击更快' },
        { dmg: 136, len: 540, w: 70, lowHp: 2.4, gap: 0.4, cross: true, note: '刚烈不屈：一次劈出十字两刀' },
      ],
    },
    // 死士：raise 是一次爬出几个死士（临时随从，不占名额），life 秒后散去，sdmg 是死士的伤害
    sishi: {
      name: '死士', icon: '死', type: 'deadRise', general: '司马懿',
      desc: '定时在敌群脚下裂开几座孤坟，幽冥鬼火喷涌伤敌；坟里爬出死士随你作战，片刻后散去。',
      levels: [
        { count: 3, cd: 8, dmg: 55, radius: 80, raise: 1, life: 8, sdmg: 14 },
        { count: 3, cd: 7.6, dmg: 68, radius: 84, raise: 2, life: 8, sdmg: 17, note: '多爬出一个死士，伤害提高' },
        { count: 4, cd: 7.2, dmg: 78, radius: 88, raise: 2, life: 9, sdmg: 20, note: '多裂一座坟' },
        { count: 4, cd: 6.6, dmg: 96, radius: 94, raise: 3, life: 10, sdmg: 25, note: '多爬出一个死士，伤害提高' },
        { count: 6, cd: 6, dmg: 118, radius: 100, raise: 4, life: 11, sdmg: 31, note: '阴养死士三千，一朝而集' },
      ],
    },
    // 百草：每隔一会儿在离你 near–far 的地方长出 count 株草药，life 秒后枯萎；走过去采一株回复 heal 比例的生命（被噬魂时不回血）。
    // 站着不动就采不到，必须走位；haste：采到后 2 秒内移速提高
    baicao: {
      name: '百草', icon: '草', type: 'herbs', general: '华佗',
      desc: '华佗遍尝百草。每隔一会儿，身边不远处长出几株草药，走过去采下就能回血；不去采，过一会儿就枯萎了。',
      levels: [
        { cd: 9, count: 2, heal: 0.03, life: 6, near: 140, far: 240 },
        { cd: 8.5, count: 2, heal: 0.035, life: 6, near: 140, far: 240, note: '回血更多' },
        { cd: 8, count: 3, heal: 0.035, life: 6.5, near: 140, far: 250, note: '多长一株' },
        { cd: 7.2, count: 3, heal: 0.04, life: 6.5, near: 140, far: 250, note: '回血更多，长得更快' },
        { cd: 6.5, count: 3, heal: 0.045, life: 7, near: 140, far: 260, haste: 0.2, note: '遍地生香：采到草药后 2 秒内移速 +20%' },
      ],
    },
    // 麻沸散：朝敌人最密的地方扔一包麻沸散，炸开一团药雾（radius），留 life 秒；雾里的敌人移速变成 slow 倍，每 tick 秒受 dmg 伤害
    mafeisan: {
      name: '麻沸散', icon: '麻', type: 'numbCloud', general: '华佗',
      desc: '朝敌人最密集的地方扔出一包麻沸散，炸开一团药雾：雾里的敌人浑身发麻、走不动路，并不断受伤。',
      levels: [
        { cd: 8, radius: 110, life: 4, slow: 0.4, tick: 0.5, dmg: 10 },
        { cd: 7.6, radius: 118, life: 4, slow: 0.4, tick: 0.5, dmg: 13, note: '伤害提高，药雾更大' },
        { cd: 7.2, radius: 128, life: 4.5, slow: 0.4, tick: 0.5, dmg: 16, note: '药雾更大，散得更慢' },
        { cd: 6.6, radius: 138, life: 4.5, slow: 0.35, tick: 0.5, dmg: 20, note: '伤害提高，麻得更狠' },
        { cd: 6, radius: 150, life: 5, slow: 0.3, tick: 0.5, dmg: 26, note: '一服麻沸，刮骨不觉' },
      ],
    },
    // 连环锁：每隔 cd 秒，用红线把附近 range 内最强的 count 个敌人连起来，持续 life 秒；打中其中一个，其余的也受到 share 比例的伤害
    lianhuansuo: {
      name: '连环锁', icon: '锁', type: 'linkChain', general: '魔貂蝉',
      desc: '魔貂蝉的连环计：定时用血红丝线把附近最强的几个敌人连在一起，打中其中一个，其余的也一起受伤。',
      levels: [
        { cd: 10, count: 3, range: 450, life: 5, share: 0.3 },
        { cd: 9.5, count: 4, range: 460, life: 5, share: 0.35, note: '多连一个，分担更多' },
        { cd: 9, count: 4, range: 480, life: 6, share: 0.4, note: '连得更久' },
        { cd: 8, count: 5, range: 500, life: 6, share: 0.45, note: '多连一个，分担更多' },
        { cd: 7, count: 6, range: 540, life: 7, share: 0.55, note: '一环扣一环，环环见血' },
      ],
    },
    longhun: {
      name: '龙魂', icon: '魂', type: 'dragonSoul', general: '神赵云',
      desc: '神赵云的四色龙魂：定时按 青龙回血、赤龙火龙枪、白龙闪身无敌、玄龙解除减益 的顺序轮流生效。',
      levels: [
        { cd: 6, heal: 0.06, dmg: 140, len: 620, w: 60, iframes: 1.0 },
        { cd: 5.5, heal: 0.07, dmg: 170, len: 660, w: 64, iframes: 1.1, note: '更快、更强' },
        { cd: 5, heal: 0.08, dmg: 210, len: 700, w: 70, iframes: 1.2, note: '回血更多，火龙枪更长' },
        { cd: 4.5, heal: 0.09, dmg: 250, len: 760, w: 74, iframes: 1.3, note: '伤害 +40' },
        { cd: 4, heal: 0.1, dmg: 300, len: 820, w: 80, iframes: 1.5, note: '四象轮转，生生不息' },
      ],
    },
    liegong: {
      name: '烈弓', icon: '烈', type: 'pierceShot', general: '黄忠',
      desc: '黄忠的烈弓：定时朝敌人最密的方向射出一支贯穿全场的重箭，箭不可挡。',
      levels: [
        { cd: 6, dmg: 120, len: 1400, w: 50, count: 1 },
        { cd: 5.5, dmg: 150, len: 1400, w: 54, count: 1, note: '伤害 +30' },
        { cd: 5, dmg: 180, len: 1500, w: 58, count: 2, note: '一次两箭' },
        { cd: 4.5, dmg: 215, len: 1500, w: 64, count: 2, note: '伤害 +35，箭更粗' },
        { cd: 3.5, dmg: 260, len: 1600, w: 70, count: 3, note: '一次三箭，弦不虚发' },
      ],
    },
  },

  // 物品（被动）：每级效果叠加；unique 物品只能从武将处获得；origin 物品只有这个出身能刷到
  passives: {
    sandals: { tags: [], name: '草鞋', icon: '履', max: 5, desc: '移动速度 +10%', effects: { speedMul: 0.1 } },
    leather: { tags: ['body'], name: '皮甲', icon: '甲', max: 5, desc: '护甲 +1（每次受伤减少 1 点）', effects: { armor: 1 } },
    manual: { tags: ['spell'], name: '兵书', icon: '典', max: 5, desc: '所有冷却 -8%', effects: { cdMul: -0.08 } },
    wine: { name: '烈酒', icon: '酒', max: 5, desc: '伤害 +10%', effects: { dmgMul: 0.1 } },
    banner: { name: '军旗', icon: '旗', max: 5, desc: '攻击范围 +10%', effects: { areaMul: 0.1 } },
    rations: { tags: ['body'], name: '干粮', icon: '粮', max: 5, desc: '每秒回复 +0.3 生命', effects: { regen: 0.3 } },
    purse: { name: '钱袋', icon: '袋', max: 5, desc: '拾取范围 +25%', effects: { pickupMul: 0.25 } },
    vigor: { tags: ['body'], name: '强身', icon: '身', max: 5, desc: '生命上限 +20', effects: { maxHp: 20 } },
    // 暴击：三种出身都能刷到
    eagle: { tags: [], name: '鹰眼', icon: '眼', max: 5, desc: '暴击率 +4%', effects: { crit: 0.04 } },
    vital: { tags: [], name: '要害', icon: '刺', max: 5, desc: '暴击伤害 +20%', effects: { critMul: 0.2 } },
    // 农夫 · 炼体
    lianti: { origin: 'farmer', tags: ['body'], name: '炼体', icon: '体', max: 5, desc: '生命上限 +10%，每秒回复 +0.2', effects: { maxHpMul: 0.1, regen: 0.2 } },
    tiebu: { origin: 'farmer', tags: ['body'], name: '铁布衫', icon: '衫', max: 5, desc: '护甲 +1，生命上限 +15', effects: { armor: 1, maxHp: 15 } },
    // 猎户 · 弓箭（对猎弓、连弩生效）
    lianzhu: { origin: 'hunter', tags: ['bow'], name: '连珠箭', icon: '珠', max: 3, desc: '弓弩每次多射 1 支箭（一次最多 4 支，射满后改为伤害 +12%）', effects: { arrowCount: 1 } },
    chuanyang: { origin: 'hunter', tags: ['bow'], name: '百步穿杨', icon: '杨', max: 5, desc: '弓弩伤害 +15%，穿透 +1', effects: { arrowDmg: 0.15, arrowPierce: 1 } },
    // 书生 · 计策（对竹简、羽扇、符咒、法杖、古琴、火把和所有技能生效）
    qimou: { origin: 'scholar', tags: ['spell'], name: '奇谋', icon: '谋', max: 5, desc: '计策与技能伤害 +15%', effects: { spellDmg: 0.15 } },
    bingfa: { origin: 'scholar', tags: ['spell'], name: '孙子兵法', icon: '孙', max: 5, desc: '计策与技能冷却 -8%，计策范围 +8%', effects: { skillCd: 0.08, spellArea: 0.08 } },
    xiliang: { name: '西凉铠', icon: '铠', max: 1, unique: true, general: '华雄', desc: '华雄的铁甲：护甲 +3，生命上限 +40', effects: { armor: 3, maxHp: 40 } },
    chunqiu: { name: '《春秋》', icon: '春', max: 1, unique: true, general: '关羽', desc: '关羽夜读之书：伤害 +25%，暴击率 +5%', effects: { dmgMul: 0.25, crit: 0.05 } },
    jiutan: { name: '张飞酒坛', icon: '坛', max: 1, unique: true, general: '张飞', desc: '一坛烈酒下肚：生命上限 +60，每秒回复 +1', effects: { maxHp: 60, regen: 1 } },
    qinggang: { name: '青釭剑', icon: '釭', max: 1, unique: true, general: '赵云', desc: '削铁如泥：暴击率 +12%，暴击伤害 +50%', effects: { crit: 0.12, critMul: 0.5 } },
    tiejia: { name: '恶来铁甲', icon: '胄', max: 1, unique: true, general: '典韦', desc: '典韦的重甲：护甲 +5，生命上限 +30', effects: { armor: 5, maxHp: 30 } },
    dongfeng: { name: '借东风', icon: '风', max: 1, unique: true, general: '诸葛亮', desc: '冷却 -15%，移动速度 +10%，攻击范围 +10%', effects: { cdMul: -0.15, speedMul: 0.1, areaMul: 0.1 } },
    huangjin: { name: '黄巾抹额', icon: '巾', max: 1, unique: true, general: '程远志', desc: '头裹黄巾：伤害 +10%，移动速度 +8%，拾取范围 +20%', effects: { dmgMul: 0.1, speedMul: 0.08, pickupMul: 0.2 } },
    digong: { name: '地公旗', icon: '幡', max: 1, unique: true, general: '张宝', desc: '地公将军的法旗：护甲 +2，生命上限 +40，攻击范围 +8%', effects: { armor: 2, maxHp: 40, areaMul: 0.08 } },
    taiping: { name: '《太平要术》', icon: '太', max: 1, unique: true, general: '张角', desc: '南华老仙所授天书：冷却 -12%，伤害 +12%，每秒回复 +0.5', effects: { cdMul: -0.12, dmgMul: 0.12, regen: 0.5 } },
    zhanpao: { name: '河北战袍', icon: '袍', max: 1, unique: true, general: '颜良', desc: '颜良的战袍：生命上限 +50，伤害 +12%', effects: { maxHp: 50, dmgMul: 0.12 } },
    liangma: { name: '河北良驹', icon: '驹', max: 1, unique: true, general: '文丑', desc: '文丑的坐骑：移动速度 +12%，暴击率 +6%', effects: { speedMul: 0.12, crit: 0.06 } },
    yuzan: { name: '闭月玉簪', icon: '簪', max: 1, unique: true, general: '貂蝉', desc: '貂蝉发间的玉簪：暴击率 +8%，暴击伤害 +30%，拾取范围 +20%', effects: { crit: 0.08, critMul: 0.3, pickupMul: 0.2 } },
    luoshenfu: { name: '《洛神赋》', icon: '洛', max: 1, unique: true, general: '甄姬', desc: '“翩若惊鸿”：冷却 -10%，攻击范围 +10%，每秒回复 +0.5', effects: { cdMul: -0.1, areaMul: 0.1, regen: 0.5 } },
    jindai: { name: '吴宫锦带', icon: '锦', max: 1, unique: true, general: '孙尚香', desc: '孙夫人的锦带：移动速度 +10%，伤害 +12%，暴击率 +4%', effects: { speedMul: 0.1, dmgMul: 0.12, crit: 0.04 } },
    guqu: { name: '曲有误', icon: '曲', max: 1, unique: true, general: '周瑜', desc: '“曲有误，周郎顾”：冷却 -10%，暴击率 +8%，攻击范围 +10%', effects: { cdMul: -0.1, crit: 0.08, areaMul: 0.1 } },
    xiangyin: { name: '相国印绶', icon: '印', max: 1, unique: true, general: '董卓', desc: '董太师的金印紫绶：生命上限 +90，伤害 +15%，护甲 +2，但移动速度 -5%', effects: { maxHp: 90, dmgMul: 0.15, armor: 2, speedMul: -0.05 } },
    guose: { name: '国色', icon: '国', max: 1, unique: true, general: '大乔', desc: '江东大乔的玉镜：生命上限 +50，每秒回复 +0.8，拾取范围 +25%，闪现冷却 -25%', effects: { maxHp: 50, regen: 0.8, pickupMul: 0.25, blinkCd: 0.25 } },
    shikui: { name: '狮盔兽带', icon: '狮', max: 1, unique: true, general: '马超', desc: '马超的狮子盔、兽面带：生命上限 +50，移动速度 +12%，伤害 +10%', effects: { maxHp: 50, speedMul: 0.12, dmgMul: 0.1 } },
    guicai: { name: '鬼才', icon: '才', max: 1, unique: true, general: '郭嘉', desc: '“郭奉孝在，不使孤至此”：冷却 -12%，暴击率 +6%，伤害 +8%', effects: { cdMul: -0.12, crit: 0.06, dmgMul: 0.08 } },
    tongque: { name: '铜雀春深', icon: '雀', max: 1, unique: true, general: '小乔', desc: '小乔的铜雀步摇：移动速度 +12%，暴击率 +6%，闪现距离 +30%', effects: { speedMul: 0.12, crit: 0.06, blinkDist: 0.3 } },
    // 啖睛：生命跌破 below 时回复 heal 比例的生命，并狂暴 dur 秒（伤害 +dmg、移速 +speed），每 cd 秒一次
    danjing: { name: '啖睛', icon: '睛', max: 1, unique: true, general: '夏侯惇', desc: '“父精母血，不可弃也！”生命上限 +40；生命跌到 30% 以下时，立刻回复 40% 生命并狂暴 6 秒（伤害 +40%、移速 +20%），每 75 秒一次', effects: { maxHp: 40 }, rage: { below: 0.3, heal: 0.4, dur: 6, dmg: 0.4, speed: 0.2, cd: 75 } },
    // 冢虎：生命跌破 below 时诈死脱身（无敌 iframes 秒，回复 heal 比例的生命），每 cd 秒一次
    zhonghu: { name: '冢虎', icon: '虎', max: 1, unique: true, general: '司马懿', desc: '冢虎隐忍：生命上限 +40，伤害 +10%；生命跌到 25% 以下时诈死脱身，2 秒无敌并回复 30% 生命（每 60 秒一次）', effects: { maxHp: 40, dmgMul: 0.1 }, feign: { below: 0.25, heal: 0.3, iframes: 2, cd: 60 } },
    // 五禽戏：闪现后 dur 秒内一共回复 heal 比例的生命，每 cd 秒最多一次（要主动闪现才回血）
    // 无双魔印：伤害、暴击伤害大涨，但受到的伤害 +hurt
    moyin: { name: '无双魔印', icon: '印', max: 1, unique: true, general: '魔吕布', desc: '魔吕布的血色印玺：伤害 +30%，暴击伤害 +50%；但受到的伤害 +10%', effects: { dmgMul: 0.3, critMul: 0.5 }, hurt: 0.1 },
    // 倾城血玉：每 cd 秒完全挡下一次伤害
    xueyu: { name: '倾城血玉', icon: '玉', max: 1, unique: true, general: '魔貂蝉', desc: '魔貂蝉的血玉坠：每 10 秒完全挡下一次伤害；生命上限 +60', effects: { maxHp: 60 }, block: { cd: 10 } },
    wuqinxi: { name: '五禽戏', icon: '禽', max: 1, unique: true, general: '华佗', desc: '华佗所创导引之术：生命上限 +30，移动速度 +8%；每次闪现后 3 秒内回复 6% 生命（每 10 秒最多一次）', effects: { maxHp: 30, speedMul: 0.08 }, blinkHeal: { heal: 0.06, dur: 3, cd: 10 } },
    juejing: { name: '绝境', icon: '境', max: 1, unique: true, general: '神赵云', desc: '血越少越强：生命每少一截，伤害和出手速度就提高一截，生命 30% 以下时最多 +50%；生命上限 +40', effects: { maxHp: 40 }, low: { max: 0.5, at: 0.3 } },
    yinan: { name: '白马银鞍', icon: '鞍', max: 1, unique: true, general: '神赵云', desc: '长坂坡的白马：移动速度 +15%；每次闪现后 1.5 秒内伤害 +30%', effects: { speedMul: 0.15 }, blinkDmg: { dmg: 0.3, dur: 1.5 } },
    laodang: { name: '老当益壮', icon: '壮', max: 1, unique: true, general: '黄忠', desc: '“老当益壮，宁移白首之心”：生命上限 +30；每 10 级伤害 +3%，不封顶', effects: { maxHp: 30 }, perTen: 0.03 },
  },

  // 属性：冰火雷风。升级时有几率刷到（Lv 3 起），每种最高 5 级，四种都能学。
  // 学会的属性全部保留：每一支箭、每一颗法球、每一刀都从已学的属性里随机抽一种（机会均等，等级只决定效果强弱），
  // 箭矢、文气、火球、飞戟、刀光都会变成这种属性的样子，命中时只触发这一种属性的效果。
  // 技能、神兵和随从不带属性。Lv 5 解锁一个额外效果（awaken）。
  elementFrom: 3,  // 第几级开始在升级选项里出现
  // 名将的属性攻击（generals 里的 el）：被打中时附带的效果
  //   火：灼烧 dur 秒，每秒掉这一击伤害的 burn；冰：减速 chill 秒；雷：麻痹（移动大减）stun 秒；风：被吹飞 push
  //   幽冥：噬魂 curse 秒，这段时间里受到的伤害 +amp、不回血
  bossElement: { fire: { burn: 0.12, dur: 3 }, ice: { chill: 1.6 }, thunder: { stun: 0.7 }, wind: { push: 520 }, dark: { curse: 3, amp: 0.2 } },
  elements: {
    fire: {
      name: '烈火', icon: '火', rgb: '255,130,50', core: '255,225,150', color: '#e8743a',
      desc: '攻击有几率化作火焰：命中点燃敌人，3 秒内持续灼烧。',
      awaken: '焚身：燃烧中的敌人倒下时爆炸，把火引到周围的敌人身上。',
      levels: [
        { burn: 0.15, dur: 3 },
        { burn: 0.2, dur: 3, note: '灼烧伤害提高' },
        { burn: 0.25, dur: 3, note: '灼烧伤害提高' },
        { burn: 0.3, dur: 3, note: '灼烧伤害提高' },
        { burn: 0.36, dur: 3, explode: 5, radius: 90, note: '焚身：燃烧的敌人倒下时爆炸' }, // 爆炸伤害 = 每秒灼烧 × 5，并把火引到周围敌人身上
      ],
    },
    ice: {
      name: '寒冰', icon: '冰', rgb: '150,210,255', core: '235,250,255', color: '#6ea8d8',
      desc: '攻击有几率化作寒冰：命中让敌人减速 2 秒，还可能把它冻住（名将和精英不会被冻住，只会变慢）。',
      awaken: '碎冰：减速中的敌人受到的伤害 +20%。',
      levels: [
        { slow: 0.3, freeze: 0.05 },
        { slow: 0.35, freeze: 0.07, note: '减速更强，更容易冻住' },
        { slow: 0.4, freeze: 0.09, note: '减速更强，更容易冻住' },
        { slow: 0.45, freeze: 0.11, note: '减速更强，更容易冻住' },
        { slow: 0.5, freeze: 0.14, shatter: 0.2, note: '碎冰：减速的敌人受伤 +20%' },
      ],
    },
    thunder: {
      name: '雷霆', icon: '雷', rgb: '170,170,255', core: '240,240,255', color: '#8a8ad8',
      desc: '攻击有几率化作雷霆：命中时可能引来一道雷电，在附近的敌人之间跳跃。',
      awaken: '雷殛：雷电会让敌人麻痹片刻。',
      levels: [
        { chance: 0.2, jumps: 2, pct: 0.55 },
        { chance: 0.25, jumps: 2, pct: 0.65, note: '更容易引雷，雷电更强' },
        { chance: 0.3, jumps: 3, pct: 0.7, note: '多跳一个敌人' },
        { chance: 0.35, jumps: 3, pct: 0.8, note: '更容易引雷，雷电更强' },
        { chance: 0.4, jumps: 4, pct: 0.9, stun: 0.4, note: '雷殛：多跳一个，并麻痹敌人' },
      ],
    },
    wind: {
      name: '疾风', icon: '风', rgb: '140,235,185', core: '230,255,240', color: '#5aa88a',
      desc: '攻击有几率化作疾风：伤害更高、击退更强，箭矢和飞弹飞得更快、多穿透 1 个。Lv 3 起每隔几秒卷起一阵旋风。',
      awaken: '风卷残云：旋风更大、更频繁。',
      levels: [
        { dmg: 0.1, kb: 0.5, pierce: 1 },
        { dmg: 0.15, kb: 0.6, pierce: 1, note: '风刃更利' },
        { dmg: 0.2, kb: 0.7, pierce: 1, gust: { every: 6, radius: 150, dmg: 40 }, note: '卷起旋风' },
        { dmg: 0.25, kb: 0.85, pierce: 1, gust: { every: 5, radius: 165, dmg: 55 }, note: '风刃更利，旋风更强' },
        { dmg: 0.3, kb: 1.0, pierce: 2, gust: { every: 3.5, radius: 200, dmg: 75 }, note: '风卷残云：旋风更大更频繁，多穿透 1 个' },
      ],
    },
    // 隐藏属性：升级时刷不到，只有击败司马懿、在他的遗物里选中才学得会；学会之后才会在升级里出现
    // vuln：噬魂印记让敌人多受的伤害；raise：带印记的小兵倒下时化作死士的几率；max：死士同时最多几个；life：死士留几秒
    dark: {
      name: '幽冥', icon: '冥', rgb: '170,90,230', core: '235,205,255', color: '#8a5ac8', hidden: true,
      desc: '隐藏属性。攻击有几率化作幽冥：命中留下噬魂印记，3 秒内受到的伤害提高；带印记的小兵倒下时，有几率化作死士为你作战。',
      awaken: '冢中枯骨：死士散去时炸开一团幽冥鬼火。',
      levels: [
        { vuln: 0.06, raise: 0.12, max: 2, life: 6 },
        { vuln: 0.08, raise: 0.15, max: 3, life: 7, note: '印记更深，更容易化作死士' },
        { vuln: 0.1, raise: 0.18, max: 3, life: 8, note: '印记更深，死士留得更久' },
        { vuln: 0.12, raise: 0.22, max: 4, life: 9, note: '印记更深，死士 +1' },
        { vuln: 0.15, raise: 0.28, max: 5, life: 10, blast: 85, note: '冢中枯骨：死士散去时炸开' },
      ],
    },
  },

  enemies: {
    foot: { name: '步卒', icon: '卒', hp: 11, speed: 62, dmg: 8, xp: 1, r: 13, color: '#7b5a3c', h: 40,
      look: { skin: '#d9a878', robe: '#7b5a3c', trim: '#4a3423', armor: false, beard: 'none', eyes: 'normal', brows: 'sharp', head: 'cap', headColor: '#a8322a', weapon: 'spear' } },
    shield: { name: '盾兵', icon: '盾', hp: 48, speed: 44, dmg: 12, xp: 3, r: 17, color: '#56606b', kbResist: 0.7, h: 44,
      look: { skin: '#d0a070', robe: '#4a525c', armor: true, armorColor: '#6b7480', beard: 'short', eyes: 'normal', brows: 'sharp', head: 'helmet', headColor: '#5a626c', trim: '#8a8f94', weapon: 'shield' } },
    archer: { name: '弓手', icon: '弓', hp: 15, speed: 56, dmg: 6, xp: 2, r: 13, color: '#66733a', ranged: { range: 290, cd: 2.4, speed: 230, dmg: 9 }, h: 40,
      look: { skin: '#d9a878', robe: '#66733a', trim: '#3e4a22', armor: false, beard: 'none', eyes: 'normal', brows: 'sharp', head: 'cap', headColor: '#4e5a2a', weapon: 'bow' } },
    cavalry: { name: '铁骑', icon: '骑', hp: 24, speed: 122, dmg: 12, xp: 3, r: 15, color: '#8a3a2c', kbResist: 0.3, h: 52, mount: '#5a3a24',
      look: { skin: '#d0a070', robe: '#8a3a2c', trim: '#c9a046', armor: true, armorColor: '#7a3a2c', beard: 'none', eyes: 'normal', brows: 'sharp', head: 'helmet', headColor: '#6b4a2e', plume: '#2b2622', weapon: 'spear' } },

    // —— 黄巾军（第一章）：衣衫褴褛的农民军，头裹黄巾 ——
    yt_foot: { name: '黄巾兵', icon: '巾', hp: 9, speed: 66, dmg: 7, xp: 1, r: 13, color: '#9a7a3a', h: 40,
      look: { skin: '#c99a68', robe: '#8a7a52', trim: '#5e5040', armor: false, beard: 'stubble', beardColor: '#2a2018', eyes: 'normal', brows: 'sharp', head: 'band', bandColor: '#e0b020', weapon: 'spear', extras: ['patches'] } },
    yt_brute: { name: '黄巾力士', icon: '力', hp: 40, speed: 48, dmg: 11, xp: 3, r: 17, color: '#7a5a2a', kbResist: 0.6, h: 46,
      look: { skin: '#b07a50', robe: '#6b5a3a', trim: '#e0b020', armor: false, beard: 'short', eyes: 'round', brows: 'bushy', head: 'band', bandColor: '#e0b020', weapon: 'hammer' } },
    yt_archer: { name: '黄巾弓手', icon: '射', hp: 13, speed: 58, dmg: 5, xp: 2, r: 13, color: '#8a8a3a', ranged: { range: 280, cd: 2.6, speed: 220, dmg: 8 }, h: 40,
      look: { skin: '#d0a070', robe: '#7a7044', trim: '#4a4228', armor: false, beard: 'none', eyes: 'normal', brows: 'sharp', head: 'band', bandColor: '#e0b020', weapon: 'bow' } },

    // —— 冢中死士：司马懿的孤冢里爬出来的黑甲死士（只由孤冢、司马懿召出，不在波次里刷） ——
    shade: { name: '冢中死士', icon: '死', hp: 22, speed: 84, dmg: 10, xp: 2, r: 13, color: '#3a2a4a', h: 42,
      look: { skin: '#b8b0c4', robe: '#2a2234', trim: '#7a5aa8', armor: true, armorColor: '#34303e', beard: 'none', eyes: 'normal', brows: 'sharp', head: 'helmet', headColor: '#26222e', plume: '#6a3a9a', weapon: 'dao' } },

    // —— 精英：有自己的招式（复用武将的招式系统），定时出现，掉落更多 ——
    captain: {
      name: '西凉校尉', title: '董卓军骑兵头领', icon: '校', kind: 'elite', hp: 320, speed: 92, dmg: 16, xp: 14, r: 19, color: '#7a2a1c', kbResist: 0.85, h: 62, mount: '#3a2418',
      attacks: ['charge'], interval: 3.4, chargeSpeed: 540,
      look: { skin: '#cf9a6a', skinShade: '#a87448', robe: '#7a2a1c', trim: '#c9a046', armor: true, armorColor: '#5a2a1c', beard: 'short', eyes: 'normal', brows: 'sharp', head: 'helmet', headColor: '#6b4a2e', plume: '#b5372a', weapon: 'spear', aura: '#7a2a1c', artFace: [0.5, 0.22, 0.34] },
    },
    brute: {
      name: '虎贲力士', title: '力能扛鼎的重锤手', icon: '力', kind: 'elite', hp: 520, speed: 52, dmg: 22, xp: 18, r: 23, color: '#5a3b28', kbResist: 0.95, h: 66,
      attacks: ['slam'], interval: 3.0, slamR: 105,
      look: { skin: '#b07a50', skinShade: '#8a5a38', robe: '#4a3a2a', trim: '#a8322a', armor: false, beard: 'short', eyes: 'round', brows: 'bushy', head: 'band', weapon: 'hammer', aura: '#5a3b28', scar: true, artFace: [0.49, 0.25, 0.34] },
    },
    crossbow: {
      name: '强弩手', title: '百步之外取人性命', icon: '弩', kind: 'elite', hp: 240, speed: 60, dmg: 10, xp: 12, r: 17, color: '#4e5a2a', kbResist: 0.5, h: 54,
      attacks: ['volley'], interval: 2.4, kite: 250, volley: { count: 3, spread: 0.35, speed: 380, dmg: 11 },
      look: { skin: '#d9a878', skinShade: '#b07f56', robe: '#4e5a2a', trim: '#2a3418', armor: true, armorColor: '#5a6440', beard: 'none', eyes: 'normal', brows: 'sharp', head: 'helmet', headColor: '#4a5040', weapon: 'crossbow', aura: '#4e5a2a', artFace: [0.47, 0.235, 0.34] },
    },
    sorcerer: {
      name: '黄巾术士', title: '苍天已死，黄天当立', icon: '术', kind: 'elite', hp: 260, speed: 58, dmg: 10, xp: 15, r: 17, color: '#a88a2a', kbResist: 0.4, h: 56,
      attacks: ['meteor', 'summon'], interval: 3.0, kite: 280, meteor: { count: 3, radius: 62, delay: 1.2, dmg: 16 }, summon: 4, summonType: 'foot',
      look: { skin: '#d6a77a', skinShade: '#b07f56', robe: '#c9a83a', trim: '#6b4a1a', armor: false, beard: 'goatee', eyes: 'calm', brows: 'thin', head: 'cap', headColor: '#e0c040', weapon: 'staff', aura: '#a88a2a', artFace: [0.5, 0.25, 0.34] },
    },
  },

  // 随从兵：摧毁据点后加入，跟在身边自动作战（伤害、血量随等级提升）。
  // 随从会被敌人打、会战死；附近的小兵会先去打离它更近的随从（吸引仇恨）
  allyHp: { perLv: 0.05, regenDelay: 4, regen: 0.04, aggroR: 230 }, // 血量每级 +5%；4 秒没挨打开始回血（每秒 4%）；小兵在这个距离内会改打随从
  allies: {
    ally_spear: { name: '随从枪兵', kind: 'melee', hp: 180, speed: 155, dmg: 12, range: 42, cd: 0.75, h: 40, r: 12,
      look: { skin: '#d9a878', robe: '#3a5a7a', trim: '#1e3248', armor: false, beard: 'none', eyes: 'normal', brows: 'sharp', head: 'cap', headColor: '#2f6fa8', weapon: 'spear' } },
    ally_archer: { name: '随从弓手', kind: 'ranged', hp: 120, speed: 145, dmg: 9, range: 320, cd: 1.0, h: 40, r: 12,
      look: { skin: '#d9a878', robe: '#3a6a5a', trim: '#1e3a30', armor: false, beard: 'none', eyes: 'normal', brows: 'sharp', head: 'cap', headColor: '#2f8a6a', weapon: 'bow' } },
    ally_cavalry: { name: '随从骑兵', kind: 'melee', hp: 280, speed: 215, dmg: 20, range: 48, cd: 0.85, h: 52, r: 15, mount: '#e8e0d0',
      look: { skin: '#d0a070', robe: '#2f4f7a', trim: '#c9a046', armor: true, armorColor: '#5a6f8a', beard: 'none', eyes: 'normal', brows: 'sharp', head: 'helmet', headColor: '#8a9aaa', plume: '#2f6fa8', weapon: 'spear' } },
    // 黄巾号令召来的临时降卒（不占随从名额，沿用黄巾兵的小人图）
    ally_yt: { name: '黄巾降卒', kind: 'melee', hp: 90, speed: 165, dmg: 14, range: 40, cd: 0.7, h: 40, r: 12, art: 'yt_foot', temp: true,
      look: { skin: '#c99a68', robe: '#8a7a52', trim: '#5e5040', armor: false, beard: 'stubble', beardColor: '#2a2018', eyes: 'normal', brows: 'sharp', head: 'band', bandColor: '#e0b020', weapon: 'spear' } },
    // 死士：司马懿的「死士」技能、「幽冥」属性召出的临时随从（沿用冢中死士的小人图，半透明、带紫光）
    ally_shade: { name: '死士', kind: 'melee', hp: 100, speed: 175, dmg: 14, range: 40, cd: 0.7, h: 42, r: 12, art: 'shade', temp: true, shade: true,
      look: { skin: '#b8b0c4', robe: '#2a2234', trim: '#7a5aa8', armor: true, armorColor: '#34303e', beard: 'none', eyes: 'normal', brows: 'sharp', head: 'helmet', headColor: '#26222e', plume: '#6a3a9a', weapon: 'dao' } },
  },
  allyCap: 8,

  // 地图据点：会派兵防守，摧毁后获得奖励
  buildings: {
    camp: { name: '敌军营寨', icon: '营', hp: 700, r: 44, xp: 20, reward: { type: 'recruit', ally: 'ally_spear', count: 2 }, spawn: { type: 'foot', every: 5, max: 6 }, desc: '摧毁后获得 2 名随从枪兵' },
    tower: { name: '箭楼', icon: '楼', hp: 500, r: 34, xp: 20, reward: { type: 'recruit', ally: 'ally_archer', count: 2 }, shoot: { range: 340, cd: 1.5, dmg: 9, speed: 270 }, desc: '摧毁后获得 2 名随从弓手' },
    granary: { name: '粮仓', icon: '粮', hp: 600, r: 42, xp: 20, reward: { type: 'feast', bonus: { maxHp: 25 } }, spawn: { type: 'shield', every: 8, max: 3 }, desc: '摧毁后回满生命，生命上限 +25' },
    stable: { name: '马厩', icon: '厩', hp: 650, r: 42, xp: 20, unlock: 60, reward: { type: 'recruit', ally: 'ally_cavalry', count: 1, bonus: { speedMul: 0.08 } }, spawn: { type: 'cavalry', every: 8, max: 3 }, desc: '摧毁后获得 1 名随从骑兵，移动速度 +8%' },
    forge: { name: '铁匠铺', icon: '铁', hp: 650, r: 40, xp: 20, unlock: 60, reward: { type: 'forge' }, spawn: { type: 'foot', every: 6, max: 4 }, desc: '摧毁后任选一件武器强化 +1 级' },
    shrine: { name: '神祠', icon: '祠', hp: 520, r: 36, xp: 20, unlock: 90, reward: { type: 'blessing' }, guard: 'sorcerer', desc: '摧毁后获得一项随机祝福' },
    // 乔府：赤壁之战开场出现在你的右下方，不会随机刷出、不会因为走远而消失。
    // 走到 aggroR 以内才会放箭、派兵；有别的名将在场时府门紧闭打不动。攻破后大乔现身，击败大乔后小乔现身。
    qiaofu: { name: '乔府', icon: '乔', hp: 1800, r: 52, xp: 40, special: true, aggroR: 460, wake: ['乔府警觉', '府中放出莲灯，弓手登上院墙'], reward: { type: 'qiao' },
      shoot: { range: 480, cd: 1.1, dmg: 11, speed: 250, count: 3, spread: 0.5, lantern: true }, spawn: { type: 'archer', every: 7, max: 4 },
      desc: '江东乔府 · 府中隐约传来琴声' },
    // 西凉营地：群雄逐鹿开场出现在你的左上方，规则和乔府一样（走近才动手、别的名将在场时营门紧闭）。攻破后马超骑白马杀出
    xiliangying: { name: '西凉营地', icon: '西', seal: '营门紧闭', hp: 2000, r: 54, xp: 40, special: true, aggroR: 480, wake: ['西凉营地警觉', '营中铁骑杀了出来'], reward: { type: 'general', gid: 'machao', msg: '营门大开……马超杀出！' },
      shoot: { range: 500, cd: 1.3, dmg: 12, speed: 300, count: 2, spread: 0.3 }, spawn: { type: 'cavalry', every: 5, max: 5 },
      desc: '西凉营地 · 营中似有猛将坐镇' },
    // 孤冢：赤壁之战里诸葛亮登场之后出现在你的西北方，规则和西凉营地一样。冢里鬼火乱飞、死士往外爬，攻破后司马懿破冢而出
    zhong: { name: '孤冢', icon: '冢', seal: '冢门封死', hp: 2100, r: 52, xp: 40, special: true, aggroR: 470, wake: ['孤冢异动', '鬼火四起，死士从冢里爬了出来'], reward: { type: 'general', gid: 'simayi', msg: '孤冢崩裂……冢虎出世！' },
      shoot: { range: 480, cd: 1.4, dmg: 12, speed: 230, count: 3, spread: 0.6, soul: true }, spawn: { type: 'shade', every: 5, max: 6 },
      desc: '孤冢 · 冢中似有异动' },
    // 疑冢：司马懿大招「冢虎疑冢」时立起的一圈坟（只有一座是真的），不会自己刷出来
    yizhong: { name: '疑冢', icon: '冢', hp: 320, r: 30, xp: 0, special: true, tomb: true, desc: '真假难辨 · 打破真冢逼出司马懿' },
    // 药庐：打完黄巾之战（第二章开场）出现在你的西南方，规则和西凉营地一样（走近才动手、别的名将在场时闭门），但血厚一倍、不放箭不派兵：
    // calm 秒没挨打就每秒回 regen 比例的血（没法路过磨一点）；走近后药香飘出，aura 范围里的敌兵每秒回 auraHeal 比例的血。攻破后华佗现身
    yaolu: { name: '药庐', icon: '庐', seal: '药庐闭门', hp: 4000, r: 50, xp: 40, special: true, aggroR: 460, wake: ['药庐飘出药香', '附近敌兵的伤口在慢慢愈合'], reward: { type: 'general', gid: 'huatuo', msg: '药庐门开……神医华佗现身' },
      regen: 0.03, calm: 4, aura: 300, auraHeal: 0.05,
      desc: '药庐 · 药香里似有人影' },
    // 药鼎：华佗大招「百草药鼎」时立在他身边的药鼎（活着就给他回血，打碎时药雾给你回血），不会自己刷出来
    yaoding: { name: '药鼎', icon: '鼎', hp: 200, r: 26, xp: 0, special: true, pot: true, desc: '打碎药鼎 · 断他药力' },
    // 炼狱虎牢关：玩家升到 unlockLv 级，就在正北方升起（战役、无尽征途都算）。不闭门；走进 aggroR 就被心魔缠身：武器、技能、神兵的冷却 ×demon。
    // 攻破后魔吕布、魔貂蝉一起现身（twins）；两人都倒下 again 秒后关隘再次升起，每多一轮血量 +roundHp、伤害 +roundDmg
    lianyu: { name: '炼狱虎牢关', icon: '关', hp: 10000, r: 66, xp: 80, special: true, noSeal: true, aggroR: 600, demon: 1.4, unlockLv: 80, again: 480, roundHp: 0.5, roundDmg: 0.25,
      wake: ['心魔缠身', '关上魔气缭绕，出手变慢了……'], reward: { type: 'twins', gids: ['molubu', 'modiaochan'], msg: '关门崩裂……魔吕布与魔貂蝉现身！' },
      shoot: { range: 620, cd: 1.2, dmg: 30, speed: 320, count: 3, spread: 0.5, soul: true }, spawn: { type: 'cavalry', every: 4, max: 6 },
      desc: '炼狱虎牢关 · 关上心魔缭绕……' },
    // 玩家 100 级时正南升起；走近了冢边的残枪一根根拔地而起，沿直线刺向你（spears：每 every 秒 count 根，先亮预警线）
    // 攻破后神赵云现身（shen），被击败 again 秒后再起，每多一轮血量 +roundHp、伤害 +roundDmg
    qianghun: { name: '枪魂冢', icon: '枪', hp: 12000, r: 64, xp: 90, special: true, noSeal: true, aggroR: 620, unlockLv: 100, again: 480, roundHp: 0.5, roundDmg: 0.25,
      wake: ['枪鸣四起', '冢边的残枪一根根拔地而起……'], reward: { type: 'shen', gid: 'shenzhaoyun', msg: '枪冢崩裂……一条银龙破土而出！' },
      spears: { every: 1.7, count: 3, spread: 0.5, len: 760, w: 54, tele: 0.8, dmg: 40 }, spawn: { type: 'cavalry', every: 4, max: 6 },
      desc: '枪魂冢 · 冢中枪鸣不绝……' },
  },

  // 神祠祝福：随机给一项，可以叠加
  blessings: [
    { name: '武运昌隆', desc: '伤害 +15%', effects: { dmgMul: 0.15 } },
    { name: '兵贵神速', desc: '移动速度 +12%', effects: { speedMul: 0.12 } },
    { name: '运筹帷幄', desc: '所有冷却 -8%', effects: { cdMul: -0.08 } },
    { name: '百步穿杨', desc: '暴击率 +6%', effects: { crit: 0.06 } },
    { name: '体魄强健', desc: '生命上限 +30', effects: { maxHp: 30 } },
    { name: '气吞山河', desc: '攻击范围 +12%', effects: { areaMul: 0.12 } },
  ],

  // 武将（Boss）：attacks 是招式循环；look 是立绘外形参数（见 portrait.js）
  // 招式：charge 冲锋 / charge3 连续冲锋 / slam 砸地 / cleave 扇形劈砍 / roar 怒吼震退 / volley 扇形飞射 / meteor 火攻 / summon 召唤
  // hp 是基础血量：登场时按当时的时间放大（越晚登场越厚）
  generals: {
    // —— 第一章 · 黄巾之乱 ——
    chengyuanzhi: {
      name: '程远志', title: '黄巾渠帅 · 涿郡先锋', icon: '程', hp: 2000, speed: 82, dmg: 11, r: 30, color: '#8a6a2a',
      attacks: ['charge', 'cleave', 'summon'], interval: 3.2, cleaveR: 170, chargeSpeed: 580, summon: 4, summonType: 'foot',
      rewards: ['kaishan', 'haoling', 'huangjin'],
      ultRgb: '240,200,60', ultEvery: 12,
      ults: [
        { id: 'axe', name: '开山一斧', type: 'leap', radius: 140, dmg: 1.7 },
        { id: 'mob', name: '黄巾乱舞', type: 'whirl', hpBelow: 0.5, dur: 2.6, radius: 90, dmg: 0.6 },
      ],
      banner: '涿郡 · 程远志 来犯', line: '“黄天当立！谁敢挡我！”', rage: '“儿郎们，给我上！”',
      look: { skin: '#c48a58', skinShade: '#9c6a40', robe: '#8a6a2a', trim: '#e0b020', armor: true, armorColor: '#6b5a3a', beard: 'short', eyes: 'round', brows: 'bushy', head: 'band', bandColor: '#e0b020', weapon: 'axe', aura: '#a88a2a', scar: true, artFace: [0.53, 0.26, 0.34] },
    },
    zhangbao: {
      name: '张宝', el: 'wind', title: '地公将军', icon: '宝', hp: 2200, speed: 80, dmg: 14, r: 31, color: '#a88a2a',
      attacks: ['meteor', 'summon', 'volley', 'meteor'], interval: 2.8, kite: 260, summon: 6, summonType: 'foot',
      meteor: { count: 4, radius: 66, delay: 1.2, dmg: 22 },
      volley: { count: 5, spread: 0.8, speed: 260, dmg: 12 },
      rewards: ['yaofu', 'sadou', 'digong'],
      ultRgb: '170,230,110', ultEvery: 11,
      ults: [
        { id: 'beans', name: '撒豆成兵', type: 'beanArmy', count: 12, R: 280 },
        { id: 'bolt', name: '妖雷', type: 'lightning', count: 5, gap: 0.3, r: 70, dmg: 1.4 },
      ],
      banner: '广宗 · 地公将军 张宝 作法', line: '“风来！雨来！雷来！”', rage: '“撒豆成兵，看你如何抵挡！”',
      look: { skin: '#d6a77a', skinShade: '#b07f56', robe: '#c9a83a', trim: '#6b4a1a', armor: false, beard: 'goatee', eyes: 'calm', brows: 'thin', head: 'lunjin', headColor: '#d8a820', weapon: 'staff', aura: '#a8a83a', artFace: [0.54, 0.23, 0.34] },
    },
    zhangjiao: {
      name: '张角', el: 'thunder', title: '天公将军 · 大贤良师', icon: '角', hp: 4500, speed: 78, dmg: 16, r: 33, color: '#c9a83a',
      attacks: ['meteor', 'summon', 'volley', 'meteor', 'summon'], interval: 2.6, kite: 300, summon: 7, summonType: 'foot',
      meteor: { count: 5, radius: 64, delay: 1.0, dmg: 24, rgb: '190,215,255', bolt: true },
      volley: { count: 7, spread: 1.1, speed: 270, dmg: 13 },
      rewards: ['jiujie', 'tianlei', 'taiping'],
      ultRgb: '255,225,110', ultEvery: 10,
      ults: [
        { id: 'thunder', name: '天公雷罚', type: 'lightning', count: 9, gap: 0.22, r: 76, dmg: 1.5 },
        { id: 'host', name: '黄天当立', type: 'beanArmy', count: 16, R: 300 },
        { id: 'pool', name: '雷池', type: 'stoneRing', hpBelow: 0.5, R: 220, n: 16, dmg: 1.5, rgb: '190,215,255', bolt: true },
      ],
      banner: '广宗 · 天公将军 张角', line: '“苍天已死，黄天当立！”', rage: '“天雷，来！”',
      look: { skin: '#e0b88a', skinShade: '#bc9466', robe: '#e0c050', trim: '#7a1e1a', armor: false, beard: 'long', beardColor: '#e6e0d4', eyes: 'calm', brows: 'thin', head: 'hood', headColor: '#d8a820', trim2: '#7a1e1a', weapon: 'staff', aura: '#e0c040', artFace: [0.56, 0.27, 0.34] },
    },

    // —— 第二章 · 讨董之战 ——
    huaxiong: {
      name: '华雄', el: 'fire', title: '董卓帐下骁将', icon: '华', hp: 3500, speed: 88, dmg: 18, r: 30, color: '#4f2a1c',
      attacks: ['charge', 'charge', 'slam'], interval: 3.4, slamR: 135, chargeSpeed: 620,
      rewards: ['dadao', 'xiaoyong', 'xiliang'],
      ultRgb: '255,170,80', ultEvery: 12,
      ults: [
        { id: 'leap', name: '斩将刀', type: 'leap', radius: 150, dmg: 1.8 },
        { id: 'whirl', name: '西凉狂刃', type: 'whirl', hpBelow: 0.6, dur: 3, radius: 95, dmg: 0.7 },
      ],
      banner: '汜水关 · 华雄 来袭', line: '“鼠辈也敢来犯？”', rage: '“有点本事！”',
      look: { skin: '#d6a77a', skinShade: '#b07f56', robe: '#4f2a1c', trim: '#c9a046', armor: true, armorColor: '#6b4a2e', beard: 'short', eyes: 'normal', brows: 'sharp', head: 'helmet', headColor: '#7a5a3a', plume: '#2b2622', weapon: 'dao', aura: '#7a3a22', artFace: [0.53, 0.24, 0.36], scar: true },
    },
    lubu: {
      name: '吕布', el: 'fire', title: '人中吕布 · 马中赤兔', icon: '吕', hp: 6500, speed: 108, dmg: 24, r: 36, color: '#6e1510',
      attacks: ['charge3', 'slam', 'summon', 'charge3', 'slam'], interval: 2.9, slamR: 185, chargeSpeed: 700, summon: 6,
      rewards: ['halberd', 'wushuang', 'chitu'],
      ultRgb: '255,60,40', ultEvery: 10,
      ults: [
        { id: 'chitu', name: '赤兔奔袭', type: 'mountDash', count: 3, speed: 1150, len: 620, tele: 0.55, dmg: 1.6, trail: true },
        { id: 'yuanmen', name: '辕门射戟', type: 'arrowRain', minDist: 330, count: 9, spread: 1.1, speed: 540, dmg: 0.9 },
        { id: 'wushuang', name: '天下无双', type: 'bigSlash', hpBelow: 0.5, R: 400, half: 1.0, dmg: 2.2, follow: 2 },
      ],
      banner: '虎牢关 · 吕布 出阵', line: '“三姓家奴？谁敢再说！”', rage: '“今日教你见识天下无双！”',
      look: { skin: '#f0cfa8', skinShade: '#cfa37a', robe: '#7a1712', trim: '#c9a046', armor: true, armorColor: '#9a2a1c', beard: 'none', eyes: 'phoenix', brows: 'sharp', head: 'pheasant', weapon: 'ji', aura: '#b5372a', artFace: [0.50, 0.22, 0.36] },
    },
    // —— 女将：貂蝉（樱花）、甄姬（冰）、孙尚香（书与扇） ——
    diaochan: {
      name: '貂蝉', title: '闭月 · 倾城舞姬', icon: '貂', hp: 5000, speed: 104, dmg: 20, r: 29, color: '#d86a9a',
      attacks: ['volley', 'meteor', 'charge', 'volley', 'meteor'], interval: 2.6, kite: 220, chargeSpeed: 660,
      volley: { count: 7, spread: 1.0, speed: 300, dmg: 13, petal: true },
      meteor: { count: 5, radius: 66, delay: 1.0, dmg: 22, rgb: '255,150,200', petal: true },
      rewards: ['luoying', 'biyue', 'yuzan'],
      ultRgb: '255,140,200', ultEvery: 10,
      ults: [
        { id: 'dance', name: '闭月舞', type: 'petalSpiral', arms: 7, waves: 20, gap: 0.09, speed: 290, dmg: 0.8 },
        { id: 'charm', name: '倾城一顾', type: 'charm', radius: 230, tele: 1.0, pull: 300, dur: 1.6, dmg: 0.8 },
        { id: 'lianhuan', name: '连环计', type: 'petalRain', hpBelow: 0.5, count: 30, dur: 3.2, r: 92, dmg: 1.2 },
      ],
      banner: '司徒府 · 貂蝉 起舞', line: '“将军，可愿看妾身一舞？”', rage: '“花落……人亦断肠。”',
      look: { skin: '#f6dcc4', skinShade: '#dcb498', robe: '#e07aa6', trim: '#f6e2ea', armor: false, beard: 'none', eyes: 'calm', brows: 'thin', head: 'bun', hairColor: '#1c1218', pin: '#ff9ac8', weapon: 'ribbon', ribbon: '#ff9ac8', aura: '#d86a9a', female: true, artFace: [0.53, 0.29, 0.34] },
    },
    zhenji: {
      name: '甄姬', el: 'ice', title: '洛神 · 凌波仙子', icon: '甄', hp: 6000, speed: 106, dmg: 22, r: 29, color: '#5a8ac0',
      attacks: ['volley', 'meteor', 'charge', 'meteor', 'volley'], interval: 2.5, kite: 240, chargeSpeed: 680,
      volley: { count: 8, spread: 1.1, speed: 330, dmg: 13, ice: true },
      meteor: { count: 5, radius: 66, delay: 1.0, dmg: 22, rgb: '170,220,255', ice: true },
      rewards: ['yudi', 'hanbing', 'luoshenfu'],
      ultRgb: '150,210,255', ultEvery: 10,
      ults: [
        { id: 'lingbo', name: '凌波微步', type: 'sevenDash', count: 4, speed: 1150, len: 340, w: 40, tele: 0.38, dmg: 1.1, iceTrail: true },
        { id: 'frost', name: '洛水寒川', type: 'frostNova', radius: 140, tele: 1.15, dmg: 1.3, freeze: 0.9 },
        { id: 'icering', name: '冰封千里', type: 'stoneRing', hpBelow: 0.5, R: 230, n: 16, dmg: 1.4, rgb: '170,220,255', ice: true },
      ],
      banner: '邺城 · 甄姬 凌波而来', line: '“翩若惊鸿，婉若游龙。”', rage: '“洛水寒，君可知？”',
      look: { skin: '#f4e0cc', skinShade: '#d6b8a0', robe: '#7aa8d8', trim: '#e6f2fa', armor: false, beard: 'none', eyes: 'calm', brows: 'thin', head: 'bun', hairColor: '#141820', pin: '#bfe6ff', weapon: 'flute', aura: '#5a8ac0', female: true, artFace: [0.56, 0.29, 0.34] },
    },
    sunshangxiang: {
      name: '孙尚香', el: 'fire', title: '枭姬 · 江东郡主', icon: '香', hp: 7000, speed: 114, dmg: 22, r: 29, color: '#c8463a',
      attacks: ['volley', 'charge3', 'meteor', 'volley'], interval: 2.4, chargeSpeed: 720,
      volley: { count: 6, spread: 0.9, speed: 380, dmg: 14, fan: true },
      meteor: { count: 5, radius: 66, delay: 1.0, dmg: 22, rgb: '255,205,130', page: true },
      rewards: ['feishan', 'bingshu', 'jindai'],
      ultRgb: '255,190,90', ultEvery: 10,
      ults: [
        { id: 'feishan', name: '飞扇回旋', type: 'twinStorm', count: 7, speed: 420, range: 330, dmg: 1.0, fan: true },
        { id: 'bingshu', name: '兵书万卷', type: 'pageCage', n: 16, cageR: 300, speed: 260, tele: 0.9, dmg: 0.9 },
        { id: 'xiaoji', name: '枭姬之怒', type: 'frenzy', hpBelow: 0.4, dur: 7 },
      ],
      banner: '甘露寺 · 孙尚香 拦路', line: '“想过此关，先问问我的扇子！”', rage: '“我孙家儿女，岂是好惹的！”',
      look: { skin: '#f2d6bc', skinShade: '#d4b092', robe: '#c8463a', trim: '#f0d080', armor: true, armorColor: '#b8862e', beard: 'none', eyes: 'round', brows: 'sharp', head: 'bun', hairColor: '#2a1810', pin: '#f0c040', weapon: 'fan', fanColor: '#e86a50', aura: '#c8463a', female: true, artFace: [0.52, 0.29, 0.34] },
    },

    // —— 第三章 · 群雄逐鹿：颜良、文丑（典韦、关羽在下面） ——
    yanliang: {
      name: '颜良', title: '河北名将 · 袁绍先锋', icon: '颜', hp: 5500, speed: 98, dmg: 26, r: 35, color: '#3a4a6a',
      attacks: ['charge', 'cleave', 'slam', 'charge3'], interval: 2.8, cleaveR: 200, slamR: 160, chargeSpeed: 680,
      rewards: ['hebeidao', 'chongzhen', 'zhanpao'],
      ultRgb: '120,170,255', ultEvery: 11, mount: '#eef0f2',
      ults: [
        { id: 'baima', name: '白马冲阵', type: 'mountDash', count: 2, speed: 1100, len: 680, tele: 0.6, dmg: 1.6 },
        { id: 'sweep', name: '河北刀阵', type: 'multiCleave', count: 3, R: 240, half: 1.0, tele: 0.45, dmg: 1.3 },
        { id: 'flag', name: '斩旗夺帅', type: 'bigSlash', hpBelow: 0.5, R: 340, half: 0.9, dmg: 2.0, follow: 1 },
      ],
      banner: '白马 · 颜良 叫阵', line: '“河北颜良在此，谁来送死！”', rage: '“匹夫，吃我一刀！”',
      look: { skin: '#c99868', skinShade: '#a07448', robe: '#3a4a6a', trim: '#c9a046', armor: true, armorColor: '#4a5a7a', beard: 'tiger', eyes: 'round', brows: 'bushy', head: 'helmet', headColor: '#5a6a8a', plume: '#b5372a', weapon: 'dao', aura: '#4a5a7a', artFace: [0.57, 0.30, 0.34] },
    },
    wenchou: {
      name: '文丑', title: '河北名将 · 颜良义弟', icon: '文', hp: 5500, speed: 112, dmg: 24, r: 34, color: '#2a3a5a',
      attacks: ['volley', 'charge3', 'volley', 'charge'], interval: 2.5, chargeSpeed: 720,
      volley: { count: 7, spread: 0.8, speed: 420, dmg: 14 },
      rewards: ['lianmao', 'xuezhan', 'liangma'],
      ultRgb: '190,150,255', ultEvery: 10,
      ults: [
        { id: 'rain', name: '延津箭雨', type: 'arrowRain', minDist: 280, count: 11, spread: 1.2, speed: 560, dmg: 0.9 },
        { id: 'pierce', name: '连环突刺', type: 'sevenDash', count: 4, speed: 1200, len: 360, w: 40, tele: 0.38, dmg: 1.2 },
        { id: 'blood', name: '为兄报仇', type: 'frenzy', hpBelow: 0.4, dur: 7 },
      ],
      banner: '延津 · 文丑 为兄报仇', line: '“还我兄长命来！”', rage: '“今日不死不休！”',
      look: { skin: '#b88a5a', skinShade: '#906640', robe: '#2a3a5a', trim: '#c9a046', armor: true, armorColor: '#3a4a6a', beard: 'short', eyes: 'normal', brows: 'sharp', head: 'helmet', headColor: '#3a4a5a', plume: '#e0d0b0', weapon: 'spear', aura: '#4a3a7a', scar: true, artFace: [0.53, 0.30, 0.34] },
    },

    // —— 长坂坡、宛城、过五关、博望坡、赤壁（各章的出场顺序见下面的 chapters） ——
    zhangfei: {
      name: '张飞', el: 'thunder', title: '万人敌 · 燕人张翼德', icon: '张', hp: 6500, speed: 100, dmg: 24, r: 34, color: '#2b2622',
      attacks: ['roar', 'charge3', 'roar', 'summon'], interval: 2.8, roarR: 240, chargeSpeed: 680, summon: 8, summonType: 'foot',
      rewards: ['shemao', 'paoxiao', 'jiutan'],
      ultRgb: '255,210,80', ultEvery: 11,
      ults: [
        { id: 'roar', name: '当阳怒吼', type: 'bigRoar', R: 440, dmg: 1.0, push: 900, slow: 2.2 },
        { id: 'lance', name: '丈八突刺', type: 'lanceDash', count: 3, speed: 1350, len: 900, w: 46, tele: 0.85, dmg: 1.8 },
        { id: 'rage', name: '燕人血怒', type: 'frenzy', hpBelow: 0.4, dur: 7 },
        { id: 'duanqiao', name: '喝断长坂', type: 'quakeLines', stomps: 3, gap: 0.75, lines: 5, len: 640, w: 54, speed: 950, tele: 0.55, dmg: 1.3 }, // 连跺三脚，地裂沿五个方向撕开
      ],
      banner: '长坂坡 · 张飞 断喝', line: '“燕人张翼德在此！谁敢决一死战！”', rage: '“哇呀呀呀！”',
      look: { skin: '#6b5242', skinShade: '#4a382c', robe: '#2b2622', trim: '#8a7a5a', armor: true, armorColor: '#3a3430', beard: 'tiger', eyes: 'round', brows: 'bushy', head: 'helmet', headColor: '#2b2622', plume: '#b5372a', weapon: 'snake', aura: '#4a4038', artFace: [0.55, 0.31, 0.36] },
    },
    zhaoyun: {
      name: '赵云', el: 'ice', title: '常山赵子龙', icon: '赵', hp: 6000, speed: 125, dmg: 22, r: 32, color: '#6f7d8a',
      attacks: ['charge3', 'volley', 'charge3', 'volley'], interval: 2.4, chargeSpeed: 760,
      homing: 2.2, rideCharge: true, mount: '#eef0f2', dragonTrail: true, // 赵云：骑白龙驹追着玩家冲，身后一条白龙
      volley: { count: 7, spread: 0.9, speed: 380, dmg: 14 },
      rewards: ['longdan', 'qijin', 'qinggang'],
      ultRgb: '150,210,255', ultEvery: 10,
      ults: [
        { id: 'seven', name: '七进七出', type: 'sevenDash', count: 7, speed: 1250, len: 460, w: 56, tele: 0.32, dmg: 1.2, home: 2.6 },
        { id: 'flurry', name: '百鸟朝凤', type: 'flurry', count: 16, R: 360, half: 0.62, dmg: 0.6 },
        { id: 'longpan', name: '白龙盘枪', type: 'dragonCoil', coilR0: 380, coilR1: 110, coilT: 1.7, body: 46, dive: 0.55, diveW: 70, dmg: 1.2 }, // 白龙绕你盘成一圈往里收，最后一头扎穿
      ],
      banner: '长坂坡 · 赵云 单骑救主', line: '“吾乃常山赵子龙也！”', rage: '“七进七出，何惧尔等！”',
      look: { skin: '#f2d4b0', skinShade: '#d0a982', robe: '#e4e6e8', trim: '#9aa6b2', armor: true, armorColor: '#c9d0d6', beard: 'none', eyes: 'normal', brows: 'sharp', head: 'helmet', headColor: '#d8dde2', plume: '#b5372a', weapon: 'spear', aura: '#7f93a8', artFace: [0.48, 0.27, 0.36] },
    },
    dianwei: {
      name: '典韦', title: '古之恶来', icon: '典', hp: 5000, speed: 80, dmg: 30, r: 38, color: '#5a3b28',
      attacks: ['slam', 'volley', 'slam', 'charge'], interval: 3.2, slamR: 170, chargeSpeed: 560,
      volley: { count: 5, spread: 0.7, speed: 300, dmg: 20, big: true },
      rewards: ['shuangji', 'elai', 'tiejia'],
      ultRgb: '255,130,60', ultEvery: 12,
      ults: [
        { id: 'storm', name: '双戟旋风', type: 'twinStorm', count: 8, speed: 380, range: 320, dmg: 1.0 },
        { id: 'quake', name: '撼地', type: 'leap', radius: 175, dmg: 1.8 },
        { id: 'elai', name: '恶来死战', type: 'frenzy', hpBelow: 0.5, dur: 7 },
        { id: 'gunshi', name: '力拔千钧', type: 'boulders', count: 3, rockR: 62, speed: 560, tele: 0.65, gap: 0.35, bounces: 2, dmg: 1.5 }, // 抱起巨石砸出去，满地乱滚
      ],
      banner: '宛城 · 典韦 死战', line: '“谁敢近主公一步！”', rage: '“来！再来！”',
      look: { skin: '#a8754e', skinShade: '#80583a', robe: '#5a3b28', trim: '#8a6a3a', armor: false, beard: 'short', eyes: 'round', brows: 'bushy', head: 'band', weapon: 'twinji', aura: '#6b4a2e', scar: true, artFace: [0.61, 0.27, 0.36] },
    },
    guanyu: {
      name: '关羽', el: 'wind', title: '武圣 · 关云长', icon: '关', hp: 8000, speed: 95, dmg: 30, r: 36, color: '#2f5d45',
      attacks: ['cleave', 'charge', 'cleave', 'slam'], interval: 2.8, cleaveR: 210, slamR: 160, chargeSpeed: 680,
      rewards: ['qinglong', 'wusheng', 'chunqiu'],
      ultRgb: '90,240,170', ultEvery: 11,
      ults: [
        { id: 'dragon', name: '青龙偃月', type: 'dragonWave', count: 3, spread: 0.42, speed: 330, r: 48, dmg: 2.0 },
        { id: 'five', name: '过五关斩六将', type: 'multiCleave', count: 5, R: 230, half: 0.9, tele: 0.4, dmg: 1.3 },
        { id: 'spiral', name: '武圣降临', type: 'spiral', hpBelow: 0.5, count: 18, dmg: 1.4 },
      ],
      banner: '过五关 · 关羽 出阵', line: '“插标卖首耳！”', rage: '“吃我一刀！”',
      look: { skin: '#b8433a', skinShade: '#8e2e26', robe: '#2f6b4a', trim: '#c9a046', armor: false, beard: 'long', eyes: 'phoenix', brows: 'silkworm', head: 'hood', headColor: '#2f6b4a', weapon: 'guandao', aura: '#2f6b4a', artFace: [0.55, 0.26, 0.36] },
    },
    zhugeliang: {
      name: '诸葛亮', el: 'fire', title: '卧龙 · 诸葛孔明', icon: '诸', hp: 6000, speed: 85, dmg: 18, r: 32, color: '#5b6a74',
      attacks: ['meteor', 'summon', 'meteor', 'volley'], interval: 2.6, kite: 300,
      meteor: { count: 5, radius: 75, delay: 1.1, dmg: 30 }, summon: 6, summonType: 'archer',
      volley: { count: 9, spread: 1.4, speed: 260, dmg: 12 },
      rewards: ['yushan', 'bazhen', 'dongfeng'],
      ultRgb: '255,150,60', ultEvery: 11,
      ults: [
        { id: 'fire', name: '火烧博望', type: 'fireLines', lines: 3, per: 7, dmg: 1.4 },
        { id: 'maze', name: '八阵图', type: 'stoneRing', R: 230, n: 18, dmg: 1.5 },
        { id: 'wind', name: '借东风', type: 'eastWind', hpBelow: 0.6, dur: 4, dmg: 0.8 },
      ],
      banner: '博望坡 · 诸葛亮 火攻', line: '“汝等已入我阵中。”', rage: '“东风已至，火起！”',
      look: { skin: '#efd6b4', skinShade: '#cfb08a', robe: '#e8e4d8', trim: '#2c3440', armor: false, beard: 'goatee', eyes: 'calm', brows: 'thin', head: 'lunjin', headColor: '#2c3440', weapon: 'fan', aura: '#3e5a6b', artFace: [0.52, 0.235, 0.36] },
    },
    zhouyu: {
      name: '周瑜', el: 'fire', title: '江东美周郎 · 大都督', icon: '周', hp: 7000, speed: 96, dmg: 22, r: 33, color: '#a8322a',
      attacks: ['meteor', 'volley', 'summon', 'meteor', 'cleave'], interval: 2.5, kite: 240, cleaveR: 190, summon: 7, summonType: 'archer',
      meteor: { count: 6, radius: 72, delay: 1.1, dmg: 30 },
      volley: { count: 9, spread: 1.2, speed: 300, dmg: 14 },
      rewards: ['zhouqin', 'huogong', 'guqu'],
      ultRgb: '255,110,70', ultEvery: 10,
      ults: [
        { id: 'chibi', name: '火烧赤壁', type: 'fireLines', lines: 4, per: 8, dmg: 1.5 },
        { id: 'qu', name: '曲有误', type: 'soundRing', count: 4, gap: 0.55, speed: 250, R: 700, dmg: 1.3 },
        { id: 'chain', name: '铁索连环', type: 'stoneRing', hpBelow: 0.5, R: 240, n: 18, dmg: 1.5, rgb: '255,120,50', burn: true },
      ],
      banner: '赤壁 · 大都督 周瑜', line: '“东风既起，此战必胜。”', rage: '“樯橹灰飞烟灭！”',
      look: { skin: '#f2d4b0', skinShade: '#d0a982', robe: '#a8322a', trim: '#e8e0d0', armor: true, armorColor: '#c9b28a', beard: 'none', eyes: 'phoenix', brows: 'sharp', head: 'helmet', headColor: '#c9b28a', plume: '#e8e0d0', weapon: 'sword', aura: '#c8402a', artFace: [0.49, 0.21, 0.34] },
    },

    // —— 董卓：讨董之战的章末魔王。招式以黑色铁链为主：钩人、拽人、捆人 ——
    // 普通招式 hook：一条铁链朝你甩来，钩中就被拽到他身前挨一记重踏（闪现能挣脱）
    dongzhuo: {
      name: '董卓', title: '魔王 · 太师董仲颖', icon: '董', hp: 9000, speed: 76, dmg: 26, r: 40, color: '#2a1a22',
      attacks: ['hook', 'slam', 'summon', 'hook', 'cleave', 'hook'], interval: 2.7, slamR: 170, cleaveR: 190, summon: 6, summonType: 'cavalry',
      hook: { len: 520, speed: 1250, w: 30, pull: 1050, tele: 0.7, crush: 1.4 },
      rewards: ['molian', 'baozheng', 'xiangyin'],
      ultRgb: '200,40,70', ultEvery: 10, dark: true,
      ults: [
        { id: 'suohun', name: '锁魂千链', type: 'chainFan', count: 8, len: 640, w: 30, speed: 1400, tele: 0.85, dmg: 1.0 },
        { id: 'tianluo', name: '天罗地网', type: 'chainPrison', prisonR: 380, tele: 1.5, root: 1.3, dmg: 1.4 },
        { id: 'baozheng', name: '魔王暴政', type: 'chainFlail', hpBelow: 0.5, dur: 5.5, flailR: 230, balls: 2, spin: 2.4, rain: 7, rainR: 80, dmg: 1.1 },
      ],
      banner: '洛阳 · 魔王 董卓', line: '“天下之事，岂不在我！”', rage: '“锁链伺候！”',
      look: { skin: '#d9a47a', skinShade: '#a8764e', robe: '#1e1418', trim: '#c9a046', armor: true, armorColor: '#2a2026', beard: 'tiger', beardColor: '#2a1a12', eyes: 'round', brows: 'bushy', head: 'helmet', headColor: '#1a1418', plume: '#8a1a28', weapon: 'dao', aura: '#5a1020', artFace: [0.54, 0.34, 0.36] },
    },

    // —— 大乔、小乔：赤壁之战里藏在右下方的乔府。攻破乔府大乔现身，击败大乔小乔现身 ——
    // 大乔：江南春水、莲灯；招式慢而铺得开，逼你走位
    daqiao: {
      name: '大乔', title: '国色 · 江东双璧之姊', icon: '大', hp: 7500, speed: 100, dmg: 22, r: 29, color: '#3a8a8a',
      attacks: ['volley', 'meteor', 'volley', 'charge'], interval: 2.6, kite: 240, chargeSpeed: 640,
      volley: { count: 6, spread: 1.0, speed: 230, dmg: 13, lantern: true },
      meteor: { count: 5, radius: 70, delay: 1.1, dmg: 22, rgb: '120,220,210', water: true },
      rewards: ['liandeng', 'chunjiang', 'guose'],
      ultRgb: '110,220,210', ultEvery: 10,
      ults: [
        { id: 'liandeng', name: '莲灯引', type: 'lanternDrift', count: 8, speed: 85, life: 6, blast: 95, dmg: 1.2 },
        { id: 'chunchao', name: '春江潮涌', type: 'tideWall', span: 1100, depth: 70, speed: 320, gapW: 170, tele: 1.0, push: 650, dmg: 1.2 },
        { id: 'xuanwo', name: '江心漩涡', type: 'whirlpool', hpBelow: 0.5, poolR: 320, coreR: 75, dur: 3.8, pull: 150, dmg: 0.5 },
      ],
      banner: '皖城 · 乔府 大乔', line: '“江东乔氏，恭候多时。”', rage: '“妹妹，要护好自己。”',
      look: { skin: '#f6dcc8', skinShade: '#dcb49c', robe: '#4aa0a0', trim: '#f2ece0', armor: false, beard: 'none', eyes: 'calm', brows: 'thin', head: 'bun', hairColor: '#16141a', pin: '#ffd0e0', weapon: 'ribbon', ribbon: '#8fe0d8', aura: '#3a8a8a', female: true, artFace: [0.44, 0.28, 0.3] },
    },
    // 小乔：蝴蝶、纸鸢；快、会瞬移，招式追着你跑
    xiaoqiao: {
      name: '小乔', title: '流光 · 江东双璧之妹', icon: '小', hp: 8000, speed: 118, dmg: 22, r: 28, color: '#9a6ad8',
      attacks: ['volley', 'charge3', 'meteor', 'volley'], interval: 2.4, chargeSpeed: 720,
      volley: { count: 7, spread: 1.1, speed: 300, dmg: 13, butterfly: true },
      meteor: { count: 5, radius: 66, delay: 1.0, dmg: 22, rgb: '200,160,255', kite: true },
      rewards: ['diewu', 'dieying', 'tongque'],
      ultRgb: '200,150,255', ultEvery: 10,
      ults: [
        { id: 'zhiyuan', name: '纸鸢索影', type: 'kiteHunt', count: 3, follow: 1.6, lock: 0.45, gap: 0.55, kiteR: 105, dmg: 1.3 },
        { id: 'dieying', name: '蝶影迷踪', type: 'blinkCross', count: 4, ring: 270, len: 640, w: 46, tele: 0.6, gap: 0.42, dmg: 1.1 },
        { id: 'tongque', name: '铜雀春深', type: 'butterflyRing', hpBelow: 0.5, R0: 340, R1: 60, dur: 3.4, n: 30, gaps: 2, spin: 0.9, dmg: 0.8 },
      ],
      banner: '皖城 · 乔府 小乔', line: '“姐姐的仇，小乔来报！”', rage: '“蝶儿们，别让他跑了！”',
      look: { skin: '#f8e0cc', skinShade: '#dcb8a0', robe: '#a07ad8', trim: '#f6e8ff', armor: false, beard: 'none', eyes: 'round', brows: 'thin', head: 'bun', hairColor: '#1a1420', pin: '#e0c0ff', weapon: 'fan', fanColor: '#b890f0', aura: '#9a6ad8', female: true, artFace: [0.37, 0.36, 0.3] },
    },

    // —— 马超：群雄逐鹿里藏在左上方的西凉营地，攻破营地后杀出。骑白马，招式全是冲阵，银蓝色的雷光 ——
    machao: {
      name: '马超', el: 'thunder', title: '锦马超 · 神威天将军', icon: '马', hp: 8500, speed: 116, dmg: 26, r: 34, color: '#c8ccd4',
      attacks: ['charge3', 'cleave', 'summon', 'charge3', 'charge'], interval: 2.5, cleaveR: 200, chargeSpeed: 780, summon: 6, summonType: 'cavalry',
      homing: 1.6, rideCharge: true, mount: '#eef0f2', // 骑白马追着你冲
      rewards: ['hutouqiang', 'tieqi', 'shikui'],
      ultRgb: '150,200,255', ultEvery: 10,
      ults: [
        { id: 'tieqi', name: '西凉铁骑', type: 'cavalryLanes', lanes: 5, laneW: 120, span: 1300, tele: 0.75, gap: 0.42, riders: 4, speed: 1150, dmg: 1.2 },
        { id: 'huanqi', name: '锦马环骑', type: 'ringRide', ringR: 330, rideT: 1.3, burn: 3.6, dashes: 3, dashSpeed: 1350, tele: 0.5, w: 58, dmg: 1.3 },
        { id: 'shenwei', name: '神威天降', type: 'skyLance', hpBelow: 0.5, count: 3, lanceR: 125, tele: 0.9, rays: 8, rayLen: 520, rayW: 44, dmg: 1.6 },
      ],
      banner: '潼关 · 锦马超 杀出营门', line: '“西凉马孟起在此！”', rage: '“今日便叫你血染潼关！”',
      look: { skin: '#f0d0ac', skinShade: '#cfa67e', robe: '#e8eaee', trim: '#3a6ab8', armor: true, armorColor: '#c8ccd4', beard: 'none', eyes: 'phoenix', brows: 'sharp', head: 'helmet', headColor: '#d8dce2', plume: '#e8eaee', weapon: 'spear', aura: '#6a8ad0', artFace: [0.65, 0.39, 0.28] },
    },
    // —— 郭嘉：鬼才。青绿色的鬼火、棋盘、料敌先机；不跟你硬拼，专门算计你的走位 ——
    guojia: {
      name: '郭嘉', title: '鬼才 · 郭奉孝', icon: '郭', hp: 7200, speed: 92, dmg: 22, r: 30, color: '#3a6a68',
      attacks: ['volley', 'meteor', 'summon', 'volley', 'meteor'], interval: 2.5, kite: 280, summon: 6, summonType: 'archer',
      volley: { count: 7, spread: 1.2, speed: 230, dmg: 13, wisp: true },
      meteor: { count: 5, radius: 70, delay: 1.1, dmg: 22, rgb: '110,240,200', wisp: true },
      rewards: ['guihuo', 'yiji', 'guicai'],
      ultRgb: '110,240,200', ultEvery: 10,
      ults: [
        { id: 'shisheng', name: '十胜十败', type: 'chessBoard', cell: 112, n: 7, rounds: 3, tele: 0.95, gap: 0.3, dmg: 1.0 },
        { id: 'liaodi', name: '料敌先机', type: 'predictStrike', count: 6, gap: 0.42, lead: 0.85, tele: 0.75, strikeR: 95, dmg: 1.2 },
        { id: 'guimou', name: '鬼谋迷雾', type: 'mistVeil', hpBelow: 0.5, dur: 5.5, sight: 170, wisps: 12, dmg: 0.8 },
      ],
      banner: '官渡 · 鬼才 郭嘉', line: '“十胜十败，此战已定。”', rage: '“咳……还早着呢。”',
      look: { skin: '#f0dcc4', skinShade: '#d0b498', robe: '#2f5a5a', trim: '#e6efe8', armor: false, beard: 'goatee', eyes: 'calm', brows: 'thin', head: 'lunjin', headColor: '#1e3434', weapon: 'fan', fanColor: '#7ad8c0', aura: '#3a8a80', artFace: [0.48, 0.32, 0.28] },
    },
    // —— 夏侯惇：盲将。群雄逐鹿里典韦之后登场。血红配黑铁，纯力量：
    // 刚烈（横刀格挡，挨得越多反击的刀光越多）、虎将单挑（立起枪阵把你和他关在一起）、拔矢啖睛（冷箭射中左眼，拔矢吞睛后血怒，再把箭掷回来）
    xiahoudun: {
      name: '夏侯惇', title: '盲将 · 夏侯元让', icon: '惇', hp: 6200, speed: 94, dmg: 28, r: 36, color: '#3a2a26',
      attacks: ['cleave', 'charge', 'slam', 'summon', 'cleave', 'charge'], interval: 2.7, cleaveR: 200, slamR: 165, chargeSpeed: 640, summon: 6, summonType: 'cavalry',
      rewards: ['hujiangdao', 'ganglie', 'danjing'],
      ultRgb: '230,50,40', ultEvery: 10,
      ults: [
        { id: 'ganglie', name: '刚烈', type: 'counterStance', dur: 2.0, ring: 260, len: 640, w: 46, minBlades: 4, maxBlades: 12, perHit: 0.5, dmg: 1.2 },
        { id: 'danqi', name: '虎将单挑', type: 'duelArena', arenaR: 280, combos: 3, tele: 0.7, gap: 0.35, cleaveR: 300, half: 1.05, wall: 0.5, dmg: 1.3 },
        { id: 'danjing', name: '拔矢啖睛', type: 'eyeArrow', hpBelow: 0.5, rage: 8, speed: 1.5, leech: 0.015, tele: 0.8, arrowLen: 1000, arrowW: 40, dmg: 1.5 },
      ],
      banner: '下邳 · 盲将 夏侯惇', line: '“夏侯元让在此，鼠辈受死！”', rage: '“一只眼，照样斩你！”',
      look: { skin: '#d6a47a', skinShade: '#b07f56', robe: '#3a2a26', trim: '#a8322a', armor: true, armorColor: '#2c2a2e', beard: 'short', beardColor: '#1e1814', eyes: 'normal', brows: 'bushy', head: 'helmet', headColor: '#2a2628', plume: '#a8322a', weapon: 'dao', aura: '#8a2a20', scar: true, artFace: [0.53, 0.26, 0.28] },
    },
    // —— 司马懿：冢虎。赤壁之战里诸葛亮之后，西北方升起一座孤冢，攻破后破冢而出。幽冥属性（隐藏属性），招式全是黑紫色：
    // 死士破土、狼顾之相（身前身后两道目光一起扫）、诈死藏进一圈疑冢里（只有一座是真的，打破真冢才逼得出他）
    simayi: {
      name: '司马懿', el: 'dark', title: '冢虎 · 司马仲达', icon: '懿', hp: 8800, speed: 88, dmg: 24, r: 32, color: '#2e2438',
      attacks: ['volley', 'meteor', 'summon', 'volley', 'meteor'], interval: 2.5, kite: 260, summon: 6, summonType: 'shade',
      volley: { count: 8, spread: 1.3, speed: 240, dmg: 13, wisp: true, wrgb: '170,90,230' },
      meteor: { count: 5, radius: 72, delay: 1.1, dmg: 24, rgb: '170,90,230', wisp: true },
      rewards: ['dark', 'langgu', 'sishi', 'zhonghu'],
      ultRgb: '170,90,230', ultEvery: 10,
      ults: [
        { id: 'sishi', name: '死士三千', type: 'deadRise', count: 9, ring: 230, tele: 1.0, eruptR: 66, raise: 6, dmg: 1.1 },
        { id: 'langgu', name: '鹰视狼顾', type: 'wolfGaze', R: 640, blind: 110, half: 0.3, turns: 0.75, tele: 1.0, dur: 3.4, dmg: 0.9 },
        { id: 'yizhong', name: '冢虎疑冢', type: 'feignDeath', hpBelow: 0.5, tombs: 5, ring: 300, dur: 8, novaR: 380, dmg: 1.8 },
      ],
      banner: '五丈原 · 冢虎 司马懿', line: '“隐忍半生，等的便是今日。”', rage: '“孔明已死，天下谁还能制我？”',
      look: { skin: '#e8d4bc', skinShade: '#c4ab90', robe: '#2a2234', trim: '#8a6ab8', armor: false, beard: 'long', beardColor: '#2a2226', eyes: 'phoenix', brows: 'sharp', head: 'lunjin', headColor: '#16121c', weapon: 'fan', fanColor: '#6a4a9a', aura: '#5a3a8a', artFace: [0.6, 0.25, 0.28] },
    },
    // —— 华佗：神医。打完黄巾之战，西南方出现一座药庐，攻破后现身。passive：不走动、不出手，也不挡后面的名将登场。
    // 血最厚（基础 10000），没有半血、濒死减伤，全靠回血：养生（calm 秒没挨打，每秒回 regen）、
    // 青囊回春（引导回血，期间挨够 breakAt 比例的伤害就被打断）、百草药鼎（身边立鼎回血，拆鼎断药）、刮骨疗毒（半血大回一口，之后元气大伤）
    huatuo: {
      name: '华佗', title: '神医 · 华元化', icon: '佗', hp: 10000, speed: 0, dmg: 0, r: 30, color: '#3a6a4a', passive: true,
      regen: 0.03, calm: 4, castR: 700, // castR：你走到这个距离以内，他才放大招
      rewards: ['baicao', 'mafeisan', 'wuqinxi'],
      ultRgb: '120,220,140', ultEvery: 16,
      ults: [
        { id: 'qingnang', name: '青囊回春', type: 'channelHeal', dur: 4, heal: 0.03, breakAt: 0.05, stun: 2.5 },
        { id: 'yaoding', name: '百草药鼎', type: 'herbPots', pots: 4, ring: 280, life: 10, heal: 0.005, playerHeal: 0.04 },
        { id: 'guagu', name: '刮骨疗毒', type: 'boneScrape', hpBelow: 0.5, heal: 0.15, weak: 6, weakDmg: 0.35, weakHeal: 0.5 },
      ],
      banner: '谯县 · 神医 华佗', line: '“老夫行医半生，只救人，不杀人。”', rage: '“刀伤易治，杀心难医啊。”',
      slain: ['神医华佗倒下', '青囊遗术，就此传你'],
      look: { skin: '#e6c8a4', skinShade: '#c4a47e', robe: '#4f7458', trim: '#e8e0c8', armor: false, beard: 'long', beardColor: '#ece8de', eyes: 'calm', brows: 'thin', head: 'scholar', headColor: '#2e3a2e', weapon: 'scrolls', aura: '#5aa070', artFace: [0.5, 0.19, 0.28] },
    },
    // —— 魔吕布、魔貂蝉：后期 boss。玩家 80 级时正北升起炼狱虎牢关，攻破后两人一起现身（twin：只从关隘出来，不进无尽征途的随机名单）。
    // 魔幻风：黑金魔铠、血月、彼岸花。普通大招没有特写（noCutin），只有两人的组合大招（D.twin.combos）才有宽幅特写。
    // bleed：被他们打中会「黑血侵蚀」，回血效果大减（见 D.twin）。大招里的 pct：至少掉你生命上限的这么多，血再厚也得躲
    molubu: {
      name: '魔吕布', title: '炼狱魔将 · 吕奉先', icon: '魔', hp: 16000, speed: 110, dmg: 30, r: 38, color: '#3a0a10', twin: true, bleed: true, noCutin: true,
      attacks: ['charge3', 'slam', 'charge3', 'slam'], interval: 2.6, slamR: 200, chargeSpeed: 760, rideCharge: true, mount: '#2a0808',
      rewards: ['moyin', 'xueyu', 'lianhuansuo'],
      ultRgb: '220,30,50', ultEvery: 13,
      ults: [
        { id: 'hengjiang', name: '魔戟横江', type: 'bigSlash', R: 430, half: 2.62, dmg: 2.4, pct: 0.25, follow: 0 }, // 横扫 300°，背后留 60° 的缺口
        { id: 'tayan', name: '赤焰踏阵', type: 'mountDash', count: 3, speed: 1250, len: 680, tele: 0.6, dmg: 1.8, pct: 0.2, trail: true },
      ],
      banner: '炼狱虎牢关 · 魔吕布', line: '“炼狱之中，我依旧天下无双！”', rage: '“心魔噬骨……痛快！”',
      look: { skin: '#d8c0b0', skinShade: '#a88878', robe: '#1a0c10', trim: '#b0182a', armor: true, armorColor: '#2a1418', beard: 'none', eyes: 'phoenix', brows: 'sharp', head: 'pheasant', weapon: 'ji', aura: '#8a0f1a', artFace: [0.56, 0.26, 0.28] },
    },
    modiaochan: {
      name: '魔貂蝉', title: '血月魔姬 · 貂蝉', icon: '魅', hp: 16000, speed: 106, dmg: 26, r: 30, color: '#5a0f2a', twin: true, bleed: true, noCutin: true,
      attacks: ['volley', 'meteor', 'volley', 'meteor'], interval: 2.4, kite: 260,
      volley: { count: 9, spread: 1.2, speed: 320, dmg: 18, petal: true },
      meteor: { count: 6, radius: 74, delay: 1.0, dmg: 30, rgb: '200,30,70', petal: true },
      rewards: ['moyin', 'xueyu', 'lianhuansuo'],
      ultRgb: '200,30,80', ultEvery: 13,
      ults: [
        { id: 'meiying', name: '血月魅影', type: 'charm', radius: 300, tele: 1.0, pull: 340, dur: 1.8, dmg: 1.0, pct: 0.15 },
        { id: 'bianhua', name: '彼岸花雨', type: 'petalRain', count: 36, dur: 3.6, r: 100, dmg: 1.4, pct: 0.2 },
      ],
      banner: '炼狱虎牢关 · 魔貂蝉', line: '“将军，这一次，妾身陪你堕入炼狱。”', rage: '“血月为证，谁也别想分开我们。”',
      look: { skin: '#f0d8d0', skinShade: '#c8a8a0', robe: '#3a0a1c', trim: '#d02040', armor: false, beard: 'none', eyes: 'calm', brows: 'thin', head: 'bun', hairColor: '#120a10', pin: '#ff3a5a', weapon: 'ribbon', ribbon: '#c0103a', aura: '#8a1030', female: true, artFace: [0.52, 0.25, 0.28] },
    },
    // —— 神赵云：100 级后正南方的枪魂冢放出。四色龙魂轮转（每 15 秒换一色）、绝境复生一次，比魔吕布魔貂蝉难一档；规则见 shen ——
    shenzhaoyun: {
      name: '神赵云', title: '龙魂 · 常山赵子龙', icon: '龙', hp: 33000, speed: 135, dmg: 34, r: 36, color: '#c8d4e4', shen: true,
      attacks: ['charge3', 'volley', 'charge3', 'meteor'], interval: 2.2, chargeSpeed: 900,
      homing: 2.6, rideCharge: true, mount: '#f4f6fa', dragonTrail: true, // 骑白马追着你冲，身后一条银龙
      volley: { count: 9, spread: 1.0, speed: 480, dmg: 20, arrow: true, wrgb: '200,225,255' }, // 掷出一排银枪
      meteor: { count: 6, radius: 80, delay: 0.9, dmg: 30, rgb: '190,220,255' },
      rewards: ['longhun', 'juejing', 'yinan'],
      ultRgb: '170,215,255', ultEvery: 14,
      ults: [
        { id: 'yinlong', name: '七进七出 · 银龙', type: 'sevenDash', count: 7, speed: 1500, len: 620, w: 64, tele: 0.36, dmg: 1.6, pct: 0.18, home: 2.2, scar: { delay: 0.6, w: 70, dmg: 0.9 } }, // 每道突进留下一道银龙枪痕，0.6 秒后炸开
        { id: 'changban', name: '长坂单骑', type: 'starRide', ringR: 400, rideT: 1.4, tele: 0.35, dashSpeed: 1800, w: 60, dmg: 1.2, pct: 0.15, burst: { delay: 0.9, w: 64, dmg: 1.6, core: 0.3 } }, // 骑一圈画出银环，再沿五角星的五条边连冲，最后五道枪痕和星心一起炸开（core：星心半径占圈的比例）
        { id: 'qiangyu', name: '龙胆 · 枪雨', type: 'spearRain', waves: 5, row: 7, gap: 72, lead: 0.7, tele: 0.75, every: 0.55, r: 44, dmg: 1.2, pct: 0.16 }, // 预判你的走位，一排排银枪从天而降
        { id: 'sixiang', name: '龙魂 · 四象', type: 'fourDragons', afterRevive: true, tele: 0.9, gap: 0.55, w: 150, speed: 1300, dmg: 2.0, pct: 0.3 }, // 绝境后：红橙青紫四条龙从四个方向依次横扫
      ],
      banner: '枪魂冢 · 神赵云', line: '“龙魂不灭，此枪不倒！”', rage: '“绝境之中，方见龙胆！”',
      look: { skin: '#f2dcc0', skinShade: '#d0b090', robe: '#eef2f8', trim: '#d8b860', armor: true, armorColor: '#e6ecf4', beard: 'none', eyes: 'phoenix', brows: 'sharp', head: 'helmet', headColor: '#eef2f8', plume: '#9fd0ff', weapon: 'spear', aura: '#9fc4ff', artFace: [0.55, 0.31, 0.34] },
    },
    // —— 黄忠：第四章赤壁之战，孙尚香之后登场。远程狙击手：一直拉开距离，红线锁定、定住的瞬间一箭射穿 ——
    huangzhong: {
      name: '黄忠', el: 'fire', title: '老当益壮 · 定军山', icon: '忠', hp: 6000, speed: 110, dmg: 24, r: 32, color: '#8a5a2a',
      attacks: ['volley', 'volley', 'meteor'], interval: 2.3, kite: 400,
      volley: { count: 5, spread: 0.45, speed: 620, dmg: 15, arrow: true, wrgb: '255,170,80' },
      meteor: { count: 5, radius: 72, delay: 1.0, dmg: 22, rgb: '255,140,60' }, // 火箭落点
      rewards: ['luori', 'liegong', 'laodang'],
      ultRgb: '255,170,70', ultEvery: 10,
      ults: [
        { id: 'baibu', name: '百步穿杨', type: 'snipe', count: 3, track: 1.2, lock: 0.3, speedUp: 0.75, len: 1300, w: 30, dmg: 1.5 }, // 烈弓：红线跟着你 1.2 秒，定住 0.3 秒后射穿整条线
        { id: 'dingjun', name: '定军山', type: 'dingjun', pins: 7, ringR: 190, pinR: 46, pinT: 3, tele: 0.8, dashSpeed: 1400, len: 900, w: 80, cleaveR: 170, dmg: 1.8 }, // 一圈钉地箭封住走位，再拔刀冲来斩一刀
        { id: 'laodang', name: '老当益壮', type: 'frenzy', hpBelow: 0.5, dur: 7, rain: { every: 0.9, count: 3, r: 80, delay: 0.9, dmg: 0.9 } }, // 血过半：出手更快，火箭雨落在你周围
      ],
      banner: '长沙 · 黄忠 老当益壮', line: '“老夫虽老，弓马不让少年！”', rage: '“老当益壮，宁移白首之心！”',
      look: { skin: '#ecc9a4', skinShade: '#c9a07a', robe: '#a83a22', trim: '#d8b060', armor: true, armorColor: '#8a6a3a', beard: 'long', beardColor: '#e8e4dc', eyes: 'normal', brows: 'bushy', head: 'helmet', headColor: '#8a6a3a', plume: '#d8b060', weapon: 'bow', aura: '#b0602a', artFace: [0.58, 0.37, 0.34] },
    },
  },
  // 神赵云的规则
  //   四色龙魂：每 suitEvery 秒换一色（青 → 赤 → 白 → 玄）；绝境复生后四色同时生效
  //     青龙回春：heal.dur 秒内每秒回 heal.rate 的血，这期间被打掉 heal.interrupt 的血就打断
  //     赤龙焚天：出手间隔 ×fireAtk，冲锋时脚下留火
  //     白龙游身：dodge 的概率闪掉你的攻击
  //     玄龙不动：免疫减速、定身、冰冻，前 blocks 次受击无效
  //   绝境：第一次被打空血不会死，juejing.dur 秒无敌后以 juejing.revive 的血复生（只有一次），之后才会放「龙魂 · 四象」
  shen: { suitEvery: 15, heal: { dur: 5, rate: 0.006, interrupt: 0.015 }, fireAtk: 0.7, dodge: 0.3, blocks: 5, juejing: { dur: 5, revive: 0.4 } },
  // 魔吕布、魔貂蝉两人一组的规则
  //   黑血守护：代替护甲，等于最大生命的 shield，打破后僵直、易伤，不会自己回（搭档魂缚时回满）；两人相距 linkR 以内时「黑血相连」，都减伤 linkDr——拉开打更快
  //   魂缚：一人血量打空不会死，变成残魂（打不动），另一人狂怒（出招间隔 ×rage、黑血至少回到 rageShield）；down 秒内把另一人也打空，两人一起倒下，否则残魂以 revive 的血量复活
  //   黑血侵蚀：被他们打中后 bleed 秒内，你的回血效果只剩 bleedHeal
  //   组合大招：两人都在、都没被魂缚时，每 every 秒轮流放一招；合计血量低于一半时必放一次「无双·倾城」。只有组合大招有特写（assets/cutins/combo_<id>.png）
  twin: {
    shield: 0.4, linkDr: 0.4, linkR: 360, down: 18, revive: 0.4, rage: 0.7, rageShield: 0.5, bleed: 4, bleedHeal: 0.4, every: 22,
    combos: [
      { id: 'xueyue', name: '辕门·血月', waves: 3, count: 8, r: 92, spread: 320, delay: 1.0, gap: 0.6, dmg: 1.5, pct: 0.35 },
      { id: 'suoxin', name: '连环·锁心', leash: 260, sweeps: 3, R: 480, half: 0.9, tele: 0.85, gap: 0.45, dmg: 1.8, pct: 0.4 },
      { id: 'qingcheng', name: '无双·倾城', below: 0.5, dur: 7, ringR: 380, petals: 28, gap: 1.1, spin: 0.9, every: 0.38, speed: 240, dmg: 1.0, pct: 0.22 },
    ],
  },

  // 名将语音：登场用 generals 里的 line，半血暴怒用 rage，这里补上阵亡和每个大招的台词（全部原创，不照搬别的游戏）。
  // 有配音文件就播放（assets/voice/<武将>_enter / _rage / _death / _ult_<大招id>.mp3），没有就只显示字幕。
  voice: {
    shenzhaoyun: { death: '七进七出……这一次……出不去了……', ult: { yinlong: '银龙出海，七进七出！', changban: '长坂坡前，单骑何惧！', qiangyu: '龙胆在手，枪落如雨！', sixiang: '四象归一，龙魂现世！', juejing: '绝境……亦是生路！' } },
    huangzhong: { death: '老夫……终究是……老了……', ult: { baibu: '百步之外，取你首级！', dingjun: '定军山下，斩将夺旗！', laodang: '黄忠在此，谁敢言老！' } },
    chengyuanzhi: { death: '大贤良师……救我……', ult: { axe: '开山！给我破！', mob: '黄巾儿郎，随我杀！' } },
    zhangbao: { death: '地公……也会死么……', ult: { beans: '撒豆成兵，起！', bolt: '妖雷，落！' } },
    zhangjiao: { death: '黄天……终究未立……', ult: { thunder: '天公雷罚，降！', host: '黄天当立，众生听令！', pool: '雷池之中，寸步难行！' } },
    huaxiong: { death: '关外……竟有此等人物……', ult: { leap: '斩将刀下，不留全尸！', whirl: '西凉狂刃，看你往哪逃！' } },
    lubu: { death: '我……天下无双……', ult: { chitu: '赤兔，随我踏平此阵！', yuanmen: '辕门射戟，一箭定乾坤！', wushuang: '画戟所向，片甲不留！' } },
    diaochan: { death: '妾身……终是一场空……', ult: { dance: '闭月一舞，与君同醉。', charm: '将军，看着妾身。', lianhuan: '一环扣一环，君已入局。' } },
    zhenji: { death: '洛水……好冷……', ult: { lingbo: '凌波微步，罗袜生尘。', frost: '洛水寒川，冻彻君骨。', icering: '冰封千里，无处可逃。' } },
    sunshangxiang: { death: '哥哥……尚香尽力了……', ult: { feishan: '扇去扇回，看你躲得几次！', bingshu: '兵书万卷，一页一刃！', xiaoji: '枭姬之怒，你接得住吗！' } },
    yanliang: { death: '我……还未出刀……', ult: { baima: '白马冲阵，挡我者死！', sweep: '河北刀阵，一个不留！', flag: '斩你帅旗，夺你首级！' } },
    wenchou: { death: '兄长……我来了……', ult: { rain: '延津箭雨，万箭穿心！', pierce: '连环突刺，看枪！', blood: '兄长之仇，以血来偿！' } },
    zhangfei: { death: '大哥……二哥……', ult: { roar: '当阳桥头，谁敢过来！', lance: '丈八蛇矛，捅你个对穿！', rage: '燕人在此，血战到底！', duanqiao: '喝断长坂桥，谁敢上前！' } },
    zhaoyun: { death: '主公……子龙……去了……', ult: { seven: '七进七出，如入无人之境！', flurry: '百鸟朝凤，枪出如龙！', longpan: '白龙盘枪，困你于此！' } },
    dianwei: { death: '主公……快走……', ult: { storm: '双戟旋风，近者皆死！', quake: '给我——倒下！', elai: '恶来在此，死战不退！', gunshi: '接我这块石头！' } },
    guanyu: { death: '大哥……关某……去也……', ult: { dragon: '青龙偃月，斩！', five: '过五关，斩六将，谁能阻我！', spiral: '青龙在天，忠义在心！' } },
    zhugeliang: { death: '出师未捷……亮，尽力矣……', ult: { fire: '火烧博望，一个不留。', maze: '八阵已成，汝等插翅难飞。', wind: '借来东风，助我火攻！' } },
    zhouyu: { death: '江东……就托付给你们了……', ult: { chibi: '火烧赤壁，樯橹成灰！', qu: '曲有误，周郎顾。', chain: '铁索连环，一火俱焚！' } },
    dongzhuo: { death: '我儿奉先……何在……', ult: { suohun: '千链锁魂，一个也别想走！', tianluo: '天罗地网，你插翅难飞！', baozheng: '顺我者昌，逆我者亡！' } },
    daqiao: { death: '妹妹……快走……', ult: { liandeng: '一盏莲灯，送君远行。', chunchao: '春江潮水，连海而平。', xuanwo: '江心水深，莫要回头。' } },
    xiaoqiao: { death: '公瑾……小乔先走一步了……', ult: { zhiyuan: '纸鸢飞得高，你躲得了吗？', dieying: '哪一个，才是真的我？', tongque: '铜雀春深，锁住你！' } },
    machao: { death: '父亲……孩儿……无能……', ult: { tieqi: '西凉铁骑，随我冲阵！', huanqi: '锦马环骑，你已无路可走！', shenwei: '神威天将军，在此！' } },
    guojia: { death: '天不假年……奉孝，先走一步……', ult: { shisheng: '十胜十败，一步错，步步错。', liaodi: '你的下一步，我早已算到。', guimou: '鬼谋入雾，生路何在？' } },
    xiahoudun: { death: '孟德……元让……先走一步了……', ult: { ganglie: '有本事，再打一刀试试！', danqi: '来！一对一，生死各安天命！', danjing: '父精母血，不可弃也！' } },
    simayi: { death: '算尽天下……终究……算不过天……', ult: { sishi: '死士三千，听我号令——起！', langgu: '我不必回头，也看得见你。', yizhong: '哪一座才是我的冢？你猜。' } },
    molubu: { death: '貂蝉……这一回……我没能护住你……', ult: { hengjiang: '魔戟横江，一个不留！', tayan: '赤兔，踏碎这人间！', combo_xueyue: '给我碎！', combo_suoxin: '逃？往哪逃！', combo_qingcheng: '天下无双，就在此刻！' } },
    modiaochan: { death: '将军……下一世……再见……', ult: { meiying: '看着我……忘了你自己。', bianhua: '彼岸花开，黄泉路远。', combo_xueyue: '血月当空——', combo_suoxin: '连环一线，锁你心魂。', combo_qingcheng: '为君一舞，倾城倾国——' } },
    huatuo: { death: '青囊之术……可惜……无人可传了……', ult: { qingnang: '青囊在手，百病可医。', yaoding: '百草入鼎，药香自来。', guagu: '刮骨去毒，忍一时之痛！' } },
  },

  // 背景音乐：有音乐文件（assets/bgm/<id>.mp3）就播放，没有就用代码合成一段古风占位曲。
  // 合成参数：bpm 速度，root 主音频率，mode 调式（gong 宫调明亮 / yu 羽调苍凉），drums 鼓的密度 0–3，gong 每 8 小节一声锣，decay 弹拨余音长短
  bgm: {
    title: { name: '标题', bpm: 70, root: 196, mode: 'gong', drums: 0, decay: 2.2 },
    huangjin: { name: '第一章 · 黄巾之乱', bpm: 96, root: 147, mode: 'yu', drums: 1, decay: 1.5 },
    taodong: { name: '第二章 · 讨董之战', bpm: 108, root: 165, mode: 'yu', drums: 2, decay: 1.3 },
    qunxiong: { name: '第三章 · 群雄逐鹿', bpm: 102, root: 175, mode: 'gong', drums: 2, decay: 1.4 },
    chibi: { name: '第四章 · 赤壁之战', bpm: 112, root: 147, mode: 'yu', drums: 2, decay: 1.6, gong: true },
    endless: { name: '天下三分 · 无尽征途', bpm: 118, root: 156, mode: 'yu', drums: 2, decay: 1.2, gong: true },
    boss: { name: '名将交锋', bpm: 136, root: 147, mode: 'yu', drums: 3, decay: 0.9, gong: true },
  },

  // 战役：按三国历史顺序分章。每章的 waves / events 时间从本章开始时算起；
  // 章末武将（final）倒下后敌军溃散，几秒后进入下一章；最后一章打完进入无尽征途。
  // swap：本章把通用兵种换成别的兵（黄巾章全是黄巾军）；elites：本章精英与解锁秒数；ground：地面配色
  chapters: [
    {
      id: 'huangjin', name: '第一章 · 黄巾之乱', sub: '公元 184 年 · 苍天已死，黄天当立',
      clear: '黄巾平定', swap: { foot: 'yt_foot', shield: 'yt_brute', archer: 'yt_archer', cavalry: 'yt_foot' },
      elites: { sorcerer: 35, brute: 110 },
      ground: { bg: '#2c2617', grass: 'rgba(176,150,72,0.5)', blot: 'rgba(16,12,4,0.16)', flag: 'rgba(214,170,40,0.55)' },
      waves: [
        { t: 0, rates: { foot: 1.0 } },
        { t: 20, rates: { foot: 1.8, shield: 0.1 } },
        { t: 45, rates: { foot: 2.4, shield: 0.25, archer: 0.25 } },
        { t: 100, rates: { foot: 3.0, shield: 0.35, archer: 0.35 } },
        { t: 160, rates: { foot: 3.4, shield: 0.45, archer: 0.45 } },
      ],
      events: [
        { t: 65, type: 'boss', id: 'chengyuanzhi' },
        { t: 110, type: 'ambush', enemy: 'foot', count: 36, text: '黄巾蜂起' },
        { t: 140, type: 'boss', id: 'zhangbao' },
        { t: 190, type: 'ambush', enemy: 'shield', count: 14, text: '黄巾力士' },
        { t: 215, type: 'boss', id: 'zhangjiao', final: true },
      ],
    },
    {
      id: 'taodong', name: '第二章 · 讨董之战', sub: '公元 190 年 · 汜水关 → 连环计 → 虎牢关 → 洛阳',
      clear: '董卓伏诛',
      elites: { captain: 10, brute: 30, crossbow: 60 },
      ground: { bg: '#27231a', grass: 'rgba(126,130,74,0.4)', blot: 'rgba(12,10,6,0.16)', flag: 'rgba(150,45,35,0.45)' },
      waves: [
        { t: 0, rates: { foot: 2.4, shield: 0.25, archer: 0.25 } },
        { t: 40, rates: { foot: 2.8, shield: 0.3, archer: 0.35, cavalry: 0.25 } },
        { t: 90, rates: { foot: 3.0, shield: 0.4, archer: 0.4, cavalry: 0.6 } },
        { t: 140, rates: { foot: 3.6, shield: 0.5, archer: 0.5, cavalry: 0.9 } },
      ],
      events: [
        { t: 8, type: 'special', bid: 'yaolu', dx: -820, dy: 560 }, // 打完黄巾之战，药庐出现在西南方（左下），之后一直留在地图上
        { t: 55, type: 'boss', id: 'huaxiong' },
        { t: 95, type: 'ambush', enemy: 'foot', count: 42, text: '伏兵四起' },
        { t: 120, type: 'boss', id: 'diaochan' },
        { t: 160, type: 'ambush', enemy: 'cavalry', count: 20, text: '西凉铁骑' },
        { t: 190, type: 'boss', id: 'lubu' },
        { t: 235, type: 'boss', id: 'dongzhuo', final: true },
      ],
    },
    {
      id: 'qunxiong', name: '第三章 · 群雄逐鹿', sub: '公元 197–211 年 · 宛城 → 白马 → 官渡 → 潼关 → 过五关',
      clear: '千里走单骑',
      elites: { captain: 0, brute: 0, crossbow: 0 },
      ground: { bg: '#22261a', grass: 'rgba(112,142,72,0.45)', blot: 'rgba(8,12,6,0.16)', flag: 'rgba(50,72,128,0.5)' },
      waves: [
        { t: 0, rates: { foot: 3.4, shield: 0.5, archer: 0.5, cavalry: 0.6 } },
        { t: 80, rates: { foot: 3.8, shield: 0.6, archer: 0.6, cavalry: 0.9 } },
        { t: 160, rates: { foot: 4.2, shield: 0.7, archer: 0.7, cavalry: 1.1 } },
      ],
      events: [
        { t: 20, type: 'special', bid: 'xiliangying', dx: -820, dy: -560 }, // 西凉营地出现在左上方，什么时候去打都行
        { t: 45, type: 'boss', id: 'dianwei' },
        { t: 75, type: 'boss', id: 'xiahoudun' }, // 下邳征吕布时被流矢射中左眼（198 年）
        { t: 105, type: 'boss', id: 'yanliang' },
        { t: 140, type: 'ambush', enemy: 'cavalry', count: 24, text: '河北铁骑' },
        { t: 170, type: 'boss', id: 'wenchou' },
        { t: 210, type: 'boss', id: 'zhenji' },
        { t: 245, type: 'boss', id: 'guojia' },
        { t: 290, type: 'boss', id: 'guanyu', final: true },
      ],
    },
    {
      id: 'chibi', name: '第四章 · 赤壁之战', sub: '公元 208 年 · 博望坡 → 长坂坡 → 甘露寺 → 赤壁',
      clear: '火烧赤壁',
      elites: { captain: 0, brute: 0, crossbow: 0, sorcerer: 0 },
      ground: { bg: '#1e231f', grass: 'rgba(96,136,104,0.42)', blot: 'rgba(40,74,96,0.24)', flag: 'rgba(170,50,40,0.5)', reeds: true },
      waves: [
        { t: 0, rates: { foot: 3.8, shield: 0.6, archer: 0.6, cavalry: 0.8 } },
        { t: 100, rates: { foot: 4.4, shield: 0.7, archer: 0.8, cavalry: 1.0 } },
        { t: 180, rates: { foot: 4.8, shield: 0.8, archer: 0.9, cavalry: 1.2 } },
      ],
      events: [
        { t: 20, type: 'qiaofu' }, // 乔府出现在右下方，什么时候去打都行
        { t: 45, type: 'boss', id: 'zhugeliang' },
        { t: 80, type: 'special', bid: 'zhong', dx: -820, dy: -560 }, // 诸葛亮之后，孤冢出现在西北方，什么时候去打都行
        { t: 105, type: 'boss', id: 'zhangfei' },
        { t: 150, type: 'ambush', enemy: 'foot', count: 48, text: '曹军南下' },
        { t: 165, type: 'boss', id: 'zhaoyun' },
        { t: 210, type: 'boss', id: 'sunshangxiang' },
        { t: 240, type: 'boss', id: 'huangzhong' }, // 赤壁之后刘备取长沙，老将黄忠归附
        { t: 290, type: 'boss', id: 'zhouyu', final: true },
      ],
    },
  ],
  // 战役打完之后：天下三分，无尽征途（所有武将轮番再战，敌人强度加速增长）
  endless: {
    name: '天下三分 · 无尽征途', sub: '群雄轮番再战，看你能走多远',
    elites: { captain: 0, brute: 0, crossbow: 0, sorcerer: 0 },
    ground: { bg: '#27231a', grass: 'rgba(126,130,74,0.4)', blot: 'rgba(12,10,6,0.16)', flag: 'rgba(150,45,35,0.45)' },
    waves: [{ t: 0, rates: { foot: 4.8, shield: 0.8, archer: 0.9, cavalry: 1.2 } }],
  },

  // 局外成长：金币跨局保存，在开局界面给三个出身各自购买、升级专属装备，开局就带着。
  // 每件装备前 9 级每一级都是一个新形态（9 级以后不封顶，外形不变，显示 +N）（tiers：名字 + 外观描述），1–3 级普通、4–6 级精良、7–9 级传说。
  // 武器和护甲的阶段（1–3 / 4–6 / 7–9 级）决定人物小人的造型（sprites/<出身>_w<武器阶段>a<护甲阶段>.png）；饰品显示为身边的护身光珠。
  // 价格：base × growth^当前等级（向上取整到 5）。effects 是每级的加成；startDmg 是起手武器伤害，startLvEvery 是每几级起手武器开局 +1 级。
  meta: {
    gold: { minion: 0.008, elite: [1, 4], building: 4, general: 8, generalPerChapter: 3, chapterClear: 14, eliteSoldier: 1 }, // 约为原来的 2/3
    // formLv：形态只有 9 个，9 级以后还能继续升，外形不变，名字后面显示 +1、+2……；9 级以后每级价格只再涨 lateGrowth 倍
    costBase: 30, costGrowth: 1.5, formLv: 9, lateGrowth: 1.12,
    rarity: [
      { name: '普通', color: '#b08a5a', rgb: '210,170,120' },  // 1–3 级
      { name: '精良', color: '#7aa6d8', rgb: '150,200,255' },  // 4–6 级
      { name: '传说', color: '#e8b440', rgb: '255,210,90' },   // 7–9 级
    ],
    gear: {
      farmer: [
        { id: 'g_hoe', name: '锄', icon: '锄', slot: '武器', effects: { startDmg: 0.1 }, startLvEvery: 3, desc: '锄头伤害 +10%/级；每 3 级开局锄头 +1 级',
          look: '农家锄头，长柄、宽刃', tiers: ['木柄锄', '精铁锄', '开垦宝锄', '百炼锄', '镔铁开山锄', '青铜兽首锄', '寒铁裂地锄', '鎏金神农锄', '神农开天锄'] },
        { id: 'g_baina', name: '甲', icon: '甲', slot: '护甲', effects: { maxHp: 16 }, armorEvery: 3, desc: '生命上限 +16/级；每 3 级护甲 +1',
          look: '庄稼汉穿的护身衣甲，从粗布到重铠', tiers: ['粗布短褐', '百衲布衣', '牛皮护胸', '镶铁皮甲', '百衲铁甲', '鱼鳞铁甲', '明光铠', '玄铁重铠', '不动山岳铠'] },
        { id: 'g_fudai', name: '福袋', icon: '袋', slot: '饰品', effects: { regen: 0.22 }, desc: '每秒回复 +0.22/级',
          look: '农家祈福的小饰物', tiers: ['五谷福袋', '铜钱平安符', '桃木护身符', '稻穗玉坠', '社稷红绳', '后土玉佩', '丰年金铃', '神农药囊', '五谷神珠'] },
      ],
      hunter: [
        { id: 'g_zhegong', name: '弓', icon: '弓', slot: '武器', effects: { startDmg: 0.1 }, startLvEvery: 3, desc: '猎弓伤害 +10%/级；每 3 级开局猎弓 +1 级',
          look: '猎人的长弓', tiers: ['竹弓', '桑木弓', '柘木长弓', '牛角弓', '犀角强弓', '铁胎弓', '鹊画雕弓', '落日弓', '射日神弓'] },
        { id: 'g_luxue', name: '猎装', icon: '装', slot: '护甲', effects: { speedMul: 0.035, maxHp: 7 }, desc: '移动速度 +3.5%、生命上限 +7/级',
          look: '猎人的轻便衣甲和靴子，从兽皮到轻铠', tiers: ['兽皮短衣', '麻编猎装', '鹿皮快装', '狼皮猎甲', '云纹轻甲', '踏雪轻铠', '追风劲装', '飞羽轻铠', '山君神行铠'] },
        { id: 'g_langya', name: '护符', icon: '牙', slot: '饰品', effects: { crit: 0.017, critMul: 0.055 }, desc: '暴击率 +1.7%、爆伤 +5.5%/级',
          look: '猎人挂在身上的兽牙护符', tiers: ['兽骨坠', '狼牙护符', '熊爪护符', '鹰羽护符', '虎齿项链', '豹纹玉坠', '白狼王牙', '金雕羽坠', '山君神符'] },
      ],
      scholar: [
        { id: 'g_zhujian', name: '书', icon: '简', slot: '武器', effects: { startDmg: 0.1 }, startLvEvery: 3, desc: '竹简伤害 +10%/级；每 3 级开局竹简 +1 级',
          look: '书生的书卷（竹简、帛书、天书）', tiers: ['旧竹简', '青竹简册', '漆书竹简', '帛书卷', '兵法竹简', '太公阴符', '黄石天书', '遁甲天书', '河图洛书'] },
        { id: 'g_fangjin', name: '衣冠', icon: '巾', slot: '护甲', effects: { cdMul: -0.022, maxHp: 7 }, desc: '所有冷却 -2.2%、生命上限 +7/级',
          look: '书生的衣冠，从布巾长衫到羽衣', tiers: ['布巾长衫', '儒生方巾', '青衿深衣', '进贤冠服', '纶巾鹤氅', '云纹道袍', '鹤羽道袍', '八卦道袍', '卧龙羽衣'] },
        { id: 'g_jinnang', name: '锦囊', icon: '囊', slot: '饰品', effects: { pickupMul: 0.09, xpMul: 0.045 }, desc: '拾取范围 +9%、经验 +4.5%/级',
          look: '书生随身的小物件', tiers: ['粗布书囊', '妙计锦囊', '青玉佩', '白玉如意', '铜星盘', '八卦铜镜', '紫檀罗盘', '七星宝灯', '天机锦囊'] },
      ],
    },
  },

  // 神兵：击败名将时小概率掉落的专属兵器（奖励里出现一张金色卡）。
  // 拿到后悬浮在身边，定时自动放出这位名将的招牌招式。再次掉落同一件 → 升级（伤害 +30%、冷却 -6%）。
  // 伤害还会随你的等级成长：每级 +3.5%。iconFrom 是还没有神兵美术图时借用的兵器图标。
  shenbingDrop: { base: 0.12, pity: 0.05, max: 0.45 }, // 基础掉率 12%，每次没掉 +5%，最高 45%，掉了就重置
  shenbing: {
    chengyuanzhi: { name: '开山神斧', icon: '斧', iconFrom: 'kaishan', rgb: '255,205,90', cd: 5, type: 'slam', dmg: 70, radius: 150, stun: 1,
      desc: '神斧飞向敌人最密集处，劈地开山：落点一圈敌人受重伤并震晕。' },
    zhangbao: { name: '地公幡', icon: '幡', iconFrom: 'yaofu', rgb: '190,230,120', cd: 6, type: 'rocks', dmg: 60, count: 6, radius: 72,
      desc: '法幡一摇，六块巨石从天而降，砸向周围的敌人。' },
    zhangjiao: { name: '太平九节杖', icon: '杖', iconFrom: 'jiujie', rgb: '255,225,110', cd: 4.5, type: 'thunder', dmg: 55, count: 6, radius: 64,
      desc: '天公法杖召下六道天雷，劈向周围的敌人。' },
    huaxiong: { name: '赤血斩将刀', icon: '刀', iconFrom: 'dadao', rgb: '255,150,70', cd: 6, type: 'whirl', dmg: 26, radius: 130, dur: 1.6,
      desc: '血刀绕身狂舞 1.6 秒，周身敌人连受数刀。' },
    lubu: { name: '无双方天戟', icon: '戟', iconFrom: 'halberd', rgb: '255,60,40', cd: 6.5, type: 'crescent', dmg: 120, R: 330, half: 0.95,
      desc: '朝敌人最多的方向劈出一道血色巨月，扇形内敌人全部重创。' },
    dianwei: { name: '恶来双铁戟', icon: '戟', iconFrom: 'shuangji', rgb: '255,130,60', cd: 5, type: 'jis', dmg: 44, count: 8, range: 300,
      desc: '八柄铁戟向四面八方飞出，再旋转着飞回身边。' },
    yanliang: { name: '河北斩旗刀', icon: '刀', iconFrom: 'hebeidao', rgb: '120,170,255', cd: 5.5, type: 'cleave3', dmg: 70, R: 230, half: 0.9,
      desc: '朝最近的敌人连斩三刀，每刀都是一大片扇形。' },
    wenchou: { name: '延津连弩', icon: '弩', iconFrom: 'lianmao', rgb: '190,150,255', cd: 4, type: 'bolts', dmg: 38, count: 11, spread: 1.0,
      desc: '神弩一次扇形射出十一支光箭，每支穿透三个敌人。' },
    guanyu: { name: '青龙偃月刀', icon: '龙', iconFrom: 'qinglong', rgb: '90,240,170', cd: 6, type: 'dragon', dmg: 110, r: 44,
      desc: '神刀斩出一条巨大的青龙，贯穿一路上所有敌人。' },
    zhugeliang: { name: '七星羽扇', icon: '扇', iconFrom: 'yushan', rgb: '255,150,60', cd: 7, type: 'firelines', dmg: 18, radius: 64,
      desc: '羽扇一挥，敌群中燃起三排大火，持续灼烧。' },
    zhangfei: { name: '丈八蛇矛', icon: '矛', iconFrom: 'shemao', rgb: '255,210,80', cd: 5, type: 'lance', dmg: 95, len: 560, w: 56, roar: 200, stun: 1.2,
      desc: '蛇矛贯出一道长枪芒，随后一声怒吼震晕身边的敌人。' },
    zhaoyun: { name: '龙胆亮银枪', icon: '枪', iconFrom: 'longdan', rgb: '200,225,255', cd: 4, type: 'flurry', dmg: 34, count: 7, len: 280,
      desc: '银枪化作七道枪芒，追着附近的敌人连刺。' },
    zhouyu: { name: '周郎焦尾琴', icon: '琴', iconFrom: 'zhouqin', rgb: '255,120,70', cd: 6, type: 'sonic', dmg: 50, rings: 3, ringR: 360, fire: 3,
      desc: '琴声荡开三圈音波，并在三个敌人脚下燃起火焰。' },
    diaochan: { name: '倾城花扇', icon: '扇', iconFrom: 'luoying', rgb: '255,150,200', cd: 5, type: 'blossom', dmg: 30, count: 20, radius: 200, stun: 1.2,
      desc: '花扇一展，二十片樱花旋转着飞出，所过之处敌人受伤；身边的敌人被迷住片刻。' },
    zhenji: { name: '洛神寒笛', icon: '笛', iconFrom: 'yudi', rgb: '160,215,255', cd: 5.5, type: 'icespikes', dmg: 62, count: 7, radius: 72, stun: 1.2,
      desc: '笛声一起，七处冰棱从敌人脚下破冰而出，被刺中的敌人冻住片刻。' },
    sunshangxiang: { name: '枭姬铁扇', icon: '扇', iconFrom: 'feishan', rgb: '255,190,90', cd: 4.5, type: 'fans', dmg: 40, count: 6, range: 300,
      desc: '六把铁扇向四面飞出再旋回手中，并撒下一阵书页，炸伤附近的敌人。' },
    dongzhuo: { name: '魔王缚魂锁', icon: '锁', iconFrom: 'molian', rgb: '200,40,70', cd: 6, type: 'gather', dmg: 85, count: 7, radius: 160, stun: 0.9,
      desc: '七条黑铁链钩住附近最强的七个敌人，把它们拖到一处撞在一起，再炸开一圈黑色冲击。' },
    daqiao: { name: '同心莲灯', icon: '灯', iconFrom: 'liandeng', rgb: '130,230,210', cd: 5.5, type: 'lanterns', dmg: 58, count: 5, radius: 95, heal: 0.015,
      desc: '五盏莲灯飘向敌人，炸开一团水光；每炸开一盏，你回复 1.5% 生命。' },
    machao: { name: '虎头湛金枪', icon: '枪', iconFrom: 'hutouqiang', rgb: '150,200,255', cd: 5.5, type: 'spiritCavalry', dmg: 70, count: 3, len: 900, w: 90,
      desc: '金枪一指，三队西凉铁骑的英灵从敌群中穿阵而过，带起一路银蓝雷光。' },
    guojia: { name: '鬼才棋局', icon: '棋', iconFrom: 'guihuo', rgb: '110,240,200', cd: 6, type: 'chessStrike', dmg: 60, n: 5, cell: 72,
      desc: '在敌群脚下摆开一张棋盘，黑白两色的格子轮流炸开鬼火，格子里的敌人连挨两下。' },
    xiaoqiao: { name: '流光蝶钗', icon: '钗', iconFrom: 'diewu', rgb: '210,170,255', cd: 4.5, type: 'butterflies', dmg: 34, count: 8, blinkCd: 0.5, blinkFly: 4,
      desc: '闪现冷却减半。每 4.5 秒放出八只流光蝶追咬敌人；每次闪现，起点还会留下四只蝴蝶扑向敌人。' },
    xiahoudun: { name: '血眼战刀', icon: '刀', iconFrom: 'hujiangdao', rgb: '230,50,40', cd: 5.5, type: 'eyeCleave', dmg: 95, len: 420, w: 70, stun: 0.8,
      desc: '敌群上空睁开一只血红的独眼，随后一柄巨刀落下，十字劈开，被劈中的敌人僵住片刻。' },
    simayi: { name: '冢虎墓碑', icon: '碑', iconFrom: 'langgu', rgb: '170,90,230', cd: 6, type: 'tombDrop', dmg: 75, count: 4, radius: 95, stun: 1, nova: 0.8,
      desc: '四块黑石墓碑从天而降砸进敌群，砸晕落点的敌人；片刻后墓碑里再炸出一圈幽冥鬼火。' },
    // 青囊书：药香绕身 dur 秒，每 tick 秒伤害 radius 内的敌人；每打中一个敌人回复 heal 比例的生命，每次最多回复 cap（再掉一次 +capLv）；
    // 药香绕身时受到的伤害 -guard。玩家反馈原来太弱（不如五禽戏），加强：范围、伤害、回血上限都提高，并加上减伤
    // 血月方天戟：击败魔吕布、魔貂蝉直接到手（再打一次就升级）。朝敌群掷出一轮血月，片刻后碎成 count 道月刃砸进敌群
    molubu: { name: '血月方天戟', icon: '戟', iconFrom: 'halberd', rgb: '220,30,50', cd: 6, type: 'bloodMoon', dmg: 90, count: 8, radius: 85, spread: 220,
      desc: '画戟掷出一轮血月悬在敌群上空，片刻后碎成八道月刃砸下，每道都炸开一圈血光。' },
    huatuo: { name: '青囊书', icon: '书', iconFrom: 'baicao', rgb: '120,220,140', cd: 5.5, type: 'herbRing', dmg: 55, radius: 210, dur: 3, tick: 0.4, heal: 0.008, cap: 0.1, capLv: 0.02, guard: 0.3,
      desc: '青囊书在身边翻开，药香绕身 3 秒：不断伤害圈里的敌人，每打中一个敌人回复 0.8% 生命（每次最多 10%），药香里受到的伤害 -30%。' },
    shenzhaoyun: { name: '龙魂涯角枪', icon: '龙', iconFrom: 'longhun', rgb: '190,220,255', cd: 5, type: 'dragonSpear', dmg: 110, len: 760, w: 80, guard: { dur: 5, cd: 90 },
      desc: '银龙绕枪而出，刺穿一整条线上的敌人。绝境：受到致死伤害时 5 秒内不会倒下（每 90 秒一次）。' },
    huangzhong: { name: '定军宝雕弓', icon: '弓', iconFrom: 'luori', rgb: '255,160,70', cd: 5.5, type: 'sunArrow', dmg: 100, len: 1100, w: 60, radius: 150,
      desc: '拉满宝雕弓，一支裹着烈焰的重箭射穿敌阵，在敌人最密处炸开一团火。' },
  },

  // 精英与武将：护甲护体（先打掉护甲才伤到血）、更快、更凶、招式范围更大
  champion: {
    shield: { boss: 0.35, elite: 0.3 },  // 护甲 = 最大生命的比例
    shieldRegenDelay: 9,                  // 多久没挨打，护甲开始恢复（秒）
    shieldRegenTime: 4,                   // 从空恢复到满要几秒
    breakStun: 1.4,                       // 破甲后僵直（秒）
    breakVuln: 0.3,                       // 破甲后易伤（受伤 +30%）
    breakVulnTime: 5,
    speed: 1.35, charge: 1.3,             // 移动、冲锋速度倍率
    interval: 0.5, ultEvery: 0.52,        // 出招间隔、大招冷却倍率（越小越频繁）
    area: 1.4, ultArea: 1.25,             // 普通招式、大招的范围倍率
    // 名将（武将）在上面的基础上再加强：招式范围翻倍、跑得比玩家还快，没法随便放风筝
    general: {
      kMin: 0,                            // 精英那一档：和精英一样随时间拉满
      rampFrom: 60, rampSec: 300,         // 名将额外那一档：60 秒后开始加，再过 300 秒加满（第一章几乎不加，第二章起基本全额）
      speed: 1.75, charge: 1.45,          // 移动、冲锋速度倍率
      area: 2.8, ultArea: 2.5,            // 普通招式、大招范围倍率（= 精英的两倍）
      width: 1.6, hazard: 1.6,            // 冲刺宽度、大招里固定大小的落点（火线、石阵、光柱）倍率
      tele: 1.15,                         // 范围变大后，普通招式的预警稍微拉长一点，还躲得开
      // 范围上限：太大的招式会铺满整个屏幕
      cap: { slamR: 470, cleaveR: 540, roarR: 580, radius: 330, R: 820, r: 130 },
    },
    // 名将血量越低越难打：半血、濒死时受到的伤害降低（第一章的名将只减一半）
    phases: [
      { below: 0.5, dr: 0.25, text: '半血' },
      { below: 0.2, dr: 0.45, text: '濒死' },
    ],
  },

  // 全局节奏
  stage: {
    bossRateMul: 0.35,     // 武将在场时小兵刷新倍率
    bossHpExp: 1.25,       // 武将血量 = 基础血量 × (1 + 秒数/240)^bossHpExp
    bossLateMul: 0.5,      // 7 分钟后的平方加成，战役里的武将只吃一半
    bossHpMul: 3,          // 武将血量整体倍率（真人试玩后翻倍）
    enemyHpMul: 1.35,      // 小兵、精英、据点血量整体倍率
    minionHpExp: 1.6,      // 小兵血量 = 基础 × (1 + 秒数×hpGrowth)^minionHpExp：越往后长得越快
    xpGain: 0.75,          // 所有经验获取倍率（真人试玩后调低）
    spawnMul: 1,           // 小兵刷新数量倍率（想让场面松一点就调小）
    bossGap: 10,            // 两名武将之间至少隔几秒
    chapterGap: 5,          // 章末武将倒下后几秒进入下一章
    hpGrowth: 1 / 75,       // 每过 75 秒，血量公式里的底数 +1（小兵按上面的指数再放大）
    lateStart: 420,         // 7 分钟后，敌人强度开始按平方额外增长
    lateDiv: 650,
    endlessDiv: 300,        // 进入无尽征途后，再按平方加速增长
    endlessBossHp: 6000,    // 无尽征途里武将的最低基础血量
    xpGrowthStart: 240,     // 4 分钟后小兵经验开始增长
    xpGrowthSec: 400,       // 之后每过 400 秒经验 +100%
    eliteChance: 0.04,      // 无尽阶段普通兵变精英的概率（血量 ×6，经验 ×5）
    eliteMax: 0.12,
    dmgGrowth: 1 / 300,
    // 精英：开场 35 秒后开始出现，间隔逐渐缩短
    eliteStart: 35, eliteEvery: 26, eliteEveryMin: 12,
    // 据点：开局 3 个，地图上最多同时 4 个，被摧毁后隔一段时间补上
    buildingStart: 3, buildingMax: 4, buildingEvery: 35,
    endlessBossEvery: 70,   // 无尽征途里每隔多少秒出一名武将
    // lv 级以后地上的掉落精简（后期满地掉落会卡）：经验、元宝攒够 every 份才掉一个大的，肉包少掉 every 倍、一个回 every 倍；
    // 地上超过 cap 个东西就把新经验并进离得最近的一颗（军令不限：后期主要靠军令把满地经验一次吸过来）
    lateDrop: { lv: 80, every: 5, cap: 120 },
  },
};
