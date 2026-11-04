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
      perks: ['生命上限 150，护甲 +2，每秒回复 0.8，伤害 +12%', '蛮力：每 10 点生命上限，锄头和近战兵器伤害 +1%', '炼体：更容易刷到生命、护甲、回复'],
      // manli：蛮力，每 10 点生命上限近战伤害 +manli（11-01 重做：玩家说农夫「纯沙包，第一个 boss 都打不动」，堆的血全变成攻）
      stats: { maxHp: 150, regen: 0.8, armor: 2, dmg: 0.12, manli: 0.01 },
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
    { // 才女：第一个带兵的出身，开局就不是一个人（allies：开局自带的随从，占随从名额）
      id: 'cainv', name: '才女', icon: '琴', weapon: 'yaoqin', focus: 'art', focusName: '才艺',
      desc: '自幼习琴读诗，出门总有乐师随行。',
      perks: ['开局带一名乐师；最多带 12 名随从，阵亡后会归队', '闪现冷却 -15%；随从血量 +40%，索敌更远、出手带属性', '才艺：召募乐师、白马义从、虎卫、连弩兵（各最多 3 名）；据点不给外兵，改为强化全体随从'],
      // allySight：随从找敌人的范围倍率（近战 220、离你 380、弓手射程都乘它）；allyRespawn：阵亡几秒后归队；allyEl：随从出手带你的属性
      // （还支持 allyMul：随从伤害单独再乘。随从上限 8 时模拟要 1.65 才比不投随从强两成；改成 12 名、每种 3 名以后不加也强两成上下，据点还另外加，就不加了）
      stats: { blinkCd: 0.15, allyHp: 0.4, allySight: 1.35, allyRespawn: 20, allyEl: true }, allies: { type: 'ally_musician', n: 1 },
      recruits: ['ally_musician', 'ally_baima', 'ally_huwei', 'ally_liannu'], // 升级时能刷到的召募卡（见 allies）；每张召 1 名，每种最多 recruitMax 名
      recruitMax: 3, allyCap: 12, // 随从上限 12（别的出身 8，见 D.allyCap）；营寨、箭楼、马厩不给才女兵，每名改成全体随从伤害 +15%
      look: { skin: '#f4e4d2', skinShade: '#dcc2a8', robe: '#e6ebe8', trim: '#8fb8a8', armor: false, beard: 'none', eyes: 'calm', brows: 'thin', head: 'bun', hairColor: '#16181e', pin: '#b08a5a', weapon: 'flute', aura: '#7aa89a', female: true, artFace: [0.5, 0.24, 0.34] },
    },
  ],

  // 武器：type 决定攻击方式，levels 是每一级的数值
  weapons: {
    hoe: {
      name: '锄头', icon: '锄', type: 'arc', common: true, tags: ['body'],
      desc: '朝最近的敌人挥砍，扇形范围内全部命中。每第 4 下是重击：范围更大、击退翻倍、震晕小兵。',
      heavy: { every: 4, area: 1.5, kb: 2, stun: 0.5 }, // 重击：每 every 下一次，范围 ×area、击退 ×kb、小兵和精英晕 stun 秒（名将不吃晕，和开山斧一样）
      levels: [
        { dmg: 22, cd: 0.7, range: 95, angle: 140, kb: 140 },
        { dmg: 27, cd: 0.67, range: 100, angle: 145, kb: 150, note: '伤害 +5，范围扩大' },
        { dmg: 32, cd: 0.63, range: 106, angle: 155, kb: 160, note: '伤害 +5，挥得更快' },
        { dmg: 38, cd: 0.6, range: 112, angle: 160, kb: 170, back: true, note: '同时向身后挥砍' },
        { dmg: 50, cd: 0.56, range: 125, angle: 180, kb: 190, back: true, note: '伤害 +12，范围大幅扩大' },
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
      name: '寒玉笛', icon: '笛', type: 'sonic', general: '甄姬', tags: ['spell', 'art'], ice: true,
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
      name: '周郎琴', icon: '琴', type: 'sonic', general: '周瑜', tags: ['spell', 'art'],
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
    hujia: {
      name: '胡笳', icon: '笳', type: 'jiaWave', general: '蔡文姬', tags: ['spell', 'art'],
      desc: '蔡文姬的胡笳。朝敌人吹出一道弯弯的声浪，一路穿过敌群，被扫到的敌人走不快。',
      levels: [ // w：声浪宽度；range：传多远；slow：被扫到后的移动速度倍率（1.2 秒）
        { dmg: 22, cd: 1.3, count: 1, speed: 520, w: 70, range: 520, slow: 0.6 },
        { dmg: 28, cd: 1.2, count: 1, speed: 540, w: 80, range: 560, slow: 0.55, note: '伤害 +6，声浪更宽' },
        { dmg: 30, cd: 1.15, count: 2, speed: 560, w: 80, range: 580, slow: 0.55, note: '一次两道' },
        { dmg: 37, cd: 1.05, count: 2, speed: 580, w: 90, range: 620, slow: 0.5, note: '伤害 +7，走得更慢' },
        { dmg: 46, cd: 0.95, count: 3, speed: 600, w: 100, range: 660, slow: 0.45, note: '一次三道，胡笳悲鸣' },
      ],
    },
    yaoqin: {
      name: '瑶琴', icon: '琴', type: 'jiaWave', common: true, tags: ['art'], rgb: '150,235,205',
      desc: '才女怀抱的瑶琴。朝最近的敌人弹出一道琴音，一路穿过敌群，被扫到的敌人走不快。',
      levels: [ // 和胡笳同一种声浪：w 宽度、range 传多远、slow 被扫到后的移动速度倍率
        { dmg: 14, cd: 1.1, count: 1, speed: 500, w: 60, range: 460, slow: 0.65 },
        { dmg: 18, cd: 1.05, count: 1, speed: 520, w: 70, range: 500, slow: 0.6, note: '伤害 +4，琴音更宽' },
        { dmg: 22, cd: 1.0, count: 1, speed: 540, w: 80, range: 540, slow: 0.6, note: '伤害 +4，传得更远' },
        { dmg: 24, cd: 0.95, count: 2, speed: 560, w: 85, range: 580, slow: 0.55, note: '一次两道' },
        { dmg: 32, cd: 0.9, count: 2, speed: 580, w: 95, range: 640, slow: 0.5, note: '伤害 +8，余音绕梁' },
      ],
    },
    yitian: {
      name: '倚天剑', icon: '剑', type: 'arc', general: '曹操',
      desc: '曹操的佩剑。横斩出一道剑气，被斩中的敌人头顶落下雷霆。',
      levels: [ // bolt：每一剑最多劈几个被斩中的敌人；boltDmg：雷的伤害是剑的几倍
        { dmg: 42, cd: 1.3, range: 150, angle: 150, kb: 220, wave: 0.5, bolt: 2, boltDmg: 0.8, boltR: 60 },
        { dmg: 52, cd: 1.24, range: 156, angle: 160, kb: 230, wave: 0.5, bolt: 2, boltDmg: 0.8, boltR: 60, note: '伤害 +10' },
        { dmg: 62, cd: 1.18, range: 162, angle: 170, kb: 240, wave: 0.6, bolt: 3, boltDmg: 0.9, boltR: 66, note: '多劈一个，剑气更重' },
        { dmg: 74, cd: 1.12, range: 168, angle: 180, kb: 250, wave: 0.7, bolt: 3, boltDmg: 1.0, boltR: 70, note: '雷与剑同伤' },
        { dmg: 92, cd: 1.0, range: 180, angle: 190, kb: 280, wave: 0.9, bolt: 4, boltDmg: 1.1, boltR: 76, note: '挟天子以令诸侯：一剑四雷' },
      ],
    },
    shuanggu: {
      name: '雌雄双股剑', icon: '剑', type: 'twinArc', general: '刘备',
      desc: '刘备的一对宝剑。雄剑金光、雌剑银光，左右交替斩出短弧；三级起双剑齐出。',
      levels: [ // side：每一剑偏到目标方向左边或右边多少（弧度）；both：两剑一起斩
        { dmg: 20, cd: 0.55, range: 110, angle: 120, kb: 120, side: 0.45 },
        { dmg: 25, cd: 0.52, range: 116, angle: 125, kb: 130, side: 0.45, note: '伤害 +5，范围扩大' },
        { dmg: 28, cd: 0.5, range: 120, angle: 130, kb: 140, side: 0.5, both: true, note: '双剑齐出' },
        { dmg: 34, cd: 0.46, range: 128, angle: 135, kb: 150, side: 0.5, both: true, note: '伤害 +6，挥得更快' },
        { dmg: 44, cd: 0.42, range: 140, angle: 145, kb: 170, side: 0.55, both: true, note: '伤害 +10，桃园三结义' },
      ],
    },
    zhugenu: {
      name: '诸葛连弩', icon: '弩', type: 'repeater', general: '神诸葛', tags: ['bow'],
      desc: '神诸葛的元戎连弩。朝最近的敌人一轮连射，弩箭能穿透敌人。',
      levels: [ // burst：一轮几支；gap：每支隔几秒
        { dmg: 18, cd: 0.9, burst: 3, gap: 0.07, speed: 760, pierce: 1 },
        { dmg: 21, cd: 0.86, burst: 3, gap: 0.07, speed: 780, pierce: 1, note: '伤害 +3' },
        { dmg: 24, cd: 0.82, burst: 4, gap: 0.065, speed: 800, pierce: 2, note: '一轮 4 支，穿透 2 个' },
        { dmg: 28, cd: 0.78, burst: 5, gap: 0.06, speed: 820, pierce: 2, note: '一轮 5 支' },
        { dmg: 36, cd: 0.72, burst: 6, gap: 0.055, speed: 860, pierce: 3, note: '一轮 6 支，穿透 3 个：元戎十矢俱发' },
      ],
    },
    guding: {
      name: '古锭刀', icon: '锭', type: 'arc', general: '孙权',
      desc: '孙权的古锭刀。朝最近的敌人宽幅劈砍，刀光带着江上的寒气，被砍中的敌人走不快。',
      levels: [ // chill：被砍中的敌人 1.5 秒内减速多少
        { dmg: 34, cd: 1.0, range: 135, angle: 200, kb: 150, chill: 0.3 },
        { dmg: 42, cd: 0.95, range: 140, angle: 205, kb: 160, chill: 0.3, note: '伤害 +8，范围扩大' },
        { dmg: 50, cd: 0.9, range: 146, angle: 215, kb: 170, chill: 0.35, note: '伤害 +8，寒气更重' },
        { dmg: 58, cd: 0.85, range: 152, angle: 225, kb: 180, chill: 0.35, note: '伤害 +8，挥得更快' },
        { dmg: 72, cd: 0.8, range: 165, angle: 240, kb: 200, chill: 0.4, note: '伤害 +14：坐断东南，刀光绕身大半圈' },
      ],
    },
    // 凤翎：朝最近的敌人扇形射出 count 根火羽（每根打中 dmg），钉进敌人身上；fuse 秒后每根就地炸开一团火（半径 radius、伤害 dmg × pop），
    //   同一个敌人身上钉着几根，这一下就再狠几成（每多一根 +stack）。炸开的伤害按 dmg 算，突破、加成都跟着涨
    fengling: {
      name: '凤翎', icon: '翎', type: 'featherDart', general: '庞统',
      desc: '庞统的凤翎。朝最近的敌人扇形射出几根火羽，钉进敌人身上，片刻后每根就地炸开一团火；同一个敌人身上钉得越多，炸得越狠。',
      levels: [
        { dmg: 10, cd: 1.2, count: 3, fan: 0.2, speed: 760, fuse: 0.8, pop: 1.8, radius: 60, stack: 0.25 },
        { dmg: 13, cd: 1.15, count: 3, fan: 0.2, speed: 780, fuse: 0.8, pop: 1.8, radius: 62, stack: 0.25, note: '伤害 +3' },
        { dmg: 15, cd: 1.1, count: 4, fan: 0.19, speed: 800, fuse: 0.75, pop: 1.9, radius: 66, stack: 0.3, note: '一次 4 根，钉得越多炸得越狠' },
        { dmg: 18, cd: 1.05, count: 4, fan: 0.19, speed: 820, fuse: 0.7, pop: 2, radius: 70, stack: 0.3, note: '伤害 +3，火团更大' },
        { dmg: 22, cd: 1.0, count: 5, fan: 0.18, speed: 850, fuse: 0.65, pop: 2.1, radius: 78, stack: 0.35, note: '一次 5 根：凤翎燎原' },
      ],
    },
  },

  // 技能：只能从武将处获得，之后升级时可以强化
  skills: {
    biyue: {
      name: '闭月', icon: '月', type: 'shockwave', general: '貂蝉', tags: ['art'], petal: true,
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
      desc: '定时骑上白龙驹杀入敌阵：数秒内无敌并加速，身后白龙相随，撞到的敌人全部受伤。冷却最短为持续时间的两倍。',
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
      name: '黄巾号令', icon: '令', type: 'levy', general: '程远志', tags: ['art'],
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
      name: '死士', icon: '死', type: 'deadRise', general: '司马懿', tags: ['art'],
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
    shibapai: {
      name: '十八拍', icon: '拍', type: 'beats', general: '蔡文姬', tags: ['art'],
      desc: '蔡文姬的《胡笳十八拍》：定时奏一曲，单数拍震身边的内圈、双数拍震外圈，最后一拍内外齐震（伤害 ×1.5）。',
      levels: [ // r1：内圈半径；r2：外圈半径；beat：每拍隔几秒
        { cd: 9, beats: 6, beat: 0.28, dmg: 26, r1: 120, r2: 240 },
        { cd: 8.5, beats: 6, beat: 0.27, dmg: 32, r1: 130, r2: 260, note: '伤害 +6，圈更大' },
        { cd: 8, beats: 12, beat: 0.26, dmg: 30, r1: 130, r2: 270, note: '一曲十二拍' },
        { cd: 7.5, beats: 12, beat: 0.25, dmg: 38, r1: 140, r2: 290, note: '伤害 +8，圈更大' },
        { cd: 7, beats: 18, beat: 0.22, dmg: 40, r1: 150, r2: 310, note: '十八拍全曲' },
      ],
    },
    duangexing: {
      name: '短歌行', icon: '歌', type: 'songRings', general: '曹操', tags: ['art'],
      desc: '曹操的《短歌行》：定时高歌一段，几圈歌声向外扩散，扫到的敌人走不快、醉得东倒西歪；随从闻歌加速。',
      levels: [ // rings：唱几圈；ringR：最远多大；slow：被扫到后的移动速度倍率；drunk：醉几秒；haste：随从加速（4 秒）
        { cd: 9, rings: 3, ringR: 260, dmg: 30, slow: 0.6, drunk: 1.5, haste: 0.25 },
        { cd: 8.5, rings: 3, ringR: 280, dmg: 38, slow: 0.55, drunk: 1.8, haste: 0.3, note: '伤害 +8，歌声更远' },
        { cd: 8, rings: 4, ringR: 300, dmg: 42, slow: 0.55, drunk: 2, haste: 0.3, note: '多唱一圈' },
        { cd: 7.5, rings: 4, ringR: 320, dmg: 52, slow: 0.5, drunk: 2.2, haste: 0.35, note: '伤害 +10，醉得更久' },
        { cd: 7, rings: 5, ringR: 350, dmg: 60, slow: 0.45, drunk: 2.5, haste: 0.4, note: '对酒当歌，人生几何' },
      ],
    },
    rende: {
      name: '仁德', icon: '仁', type: 'healPulse', general: '刘备',
      desc: '刘备的仁德：定时放出一圈仁德之光，给你和随从回血，圈里的敌人受伤。',
      levels: [ // heal：你回生命上限的多少；allyHeal：随从回自己血量的多少；r：光圈半径
        { cd: 10, heal: 0.06, allyHeal: 0.15, dmg: 40, r: 200 },
        { cd: 9.5, heal: 0.07, allyHeal: 0.18, dmg: 52, r: 215, note: '回得更多' },
        { cd: 9, heal: 0.08, allyHeal: 0.22, dmg: 64, r: 230, note: '伤害 +12，光圈更大' },
        { cd: 8, heal: 0.09, allyHeal: 0.26, dmg: 78, r: 245, note: '冷却缩短' },
        { cd: 7, heal: 0.1, allyHeal: 0.3, dmg: 96, r: 260, note: '惟贤惟德，能服于人' },
      ],
    },
    qimen: {
      name: '奇门遁甲', icon: '门', type: 'gateRing', general: '神诸葛',
      desc: '神诸葛的八门阵：定时在身边展开一座八门大阵。阵里的敌人每隔一会儿挨一下，按所在方位吃八门的效果：伤门、死门伤害加倍，惊门定身，景门灼烧，杜门走不动；你站在阵里慢慢回血（生门）。',
      levels: [ // dur：阵持续几秒；tick：每隔几秒打一下；heal：你在阵里每秒回生命上限的多少
        { cd: 8, dur: 4, r: 220, tick: 0.5, dmg: 24, heal: 0.008 },
        { cd: 7.6, dur: 4, r: 235, tick: 0.5, dmg: 30, heal: 0.009, note: '伤害 +6，阵更大' },
        { cd: 7.2, dur: 4.5, r: 250, tick: 0.45, dmg: 36, heal: 0.01, note: '阵更久' },
        { cd: 6.6, dur: 4.5, r: 270, tick: 0.45, dmg: 44, heal: 0.011, note: '伤害 +8，阵更大' },
        { cd: 6, dur: 5, r: 300, tick: 0.4, dmg: 54, heal: 0.012, note: '八门俱开，生生不息' },
      ],
    },
    shehu: {
      name: '射虎', icon: '虎', type: 'tigerAlly', general: '孙权',
      desc: '孙权亲射猛虎的胆气：定时唤来猛虎替你作战，扑咬身边的敌人，到时散去（不占随从名额）。',
      levels: [ // n：一次几头；life：留几秒；dmg：每一扑的伤害
        { cd: 18, n: 1, life: 12, dmg: 40 },
        { cd: 17, n: 1, life: 12, dmg: 50, note: '伤害 +10' },
        { cd: 16, n: 1, life: 13, dmg: 60, note: '猛虎留得更久' },
        { cd: 15, n: 1, life: 13, dmg: 72, note: '伤害 +12，唤得更勤' },
        { cd: 14, n: 2, life: 14, dmg: 88, note: '一次唤来两头猛虎' },
      ],
    },
    // 三策：每 cd 秒随机献一策（伤害都按 dmg 算）——
    //   上策：朝敌人最密处烧出一道火线（长 len、宽 w），沿线的敌人受 dmg，火线留 burn 秒、每 0.4 秒再烧一下 dmg × 0.2；
    //   中策：在敌人最密处插一面令旗，lure 秒内把 pullR 以内的敌人往旗下引，然后炸开（半径 radius，伤害 dmg × 1.6）；
    //   下策：震退身边 kbR 以内的敌人（伤害 dmg × 0.6），dur 秒内你受到的伤害 -guard。all：三策齐献，一次全放
    sance: {
      name: '三策', icon: '策', type: 'threeCe', general: '庞统',
      desc: '庞统献上中下三策，每次随机一策：上策一道火线奇袭敌群；中策插旗诱敌，把附近的敌人引到旗下再炸开；下策震退身边的敌人，片刻内受到的伤害减少。',
      levels: [
        { cd: 7, dmg: 60, len: 520, w: 70, burn: 2.5, pullR: 300, lure: 1.2, radius: 150, kbR: 210, kb: 520, guard: 0.3, dur: 3 },
        { cd: 6.6, dmg: 72, len: 540, w: 72, burn: 2.5, pullR: 310, lure: 1.2, radius: 160, kbR: 220, kb: 540, guard: 0.3, dur: 3, note: '伤害 +12' },
        { cd: 6.2, dmg: 84, len: 570, w: 76, burn: 3, pullR: 330, lure: 1.2, radius: 170, kbR: 230, kb: 560, guard: 0.35, dur: 3.5, note: '火线更长，下策减伤更多' },
        { cd: 5.8, dmg: 100, len: 600, w: 80, burn: 3, pullR: 350, lure: 1.1, radius: 185, kbR: 240, kb: 580, guard: 0.35, dur: 3.5, note: '伤害 +16，范围更大' },
        { cd: 5.5, dmg: 120, len: 640, w: 84, burn: 3.5, pullR: 380, lure: 1.1, radius: 200, kbR: 260, kb: 600, guard: 0.4, dur: 4, all: true, note: '三策齐献：上中下一次全放' },
      ],
    },
    jiuchi: {
      name: '酒池', icon: '池', type: 'winePool', general: '魔董卓',
      desc: '魔董卓的酒池：定时在敌人最密处泼下一片毒酒，池里的敌人走不动、不停掉血；你站进池里慢慢回血。',
      levels: [ // n：一次几片；dur：池子留几秒；slow：池里的敌人减速多少；heal：你在池里每秒回生命上限的多少
        { cd: 9, n: 1, dur: 5, r: 150, tick: 0.5, dmg: 22, slow: 0.4, heal: 0.01 },
        { cd: 8.5, n: 1, dur: 5, r: 160, tick: 0.5, dmg: 28, slow: 0.45, heal: 0.011, note: '伤害 +6，池子更大' },
        { cd: 8, n: 1, dur: 5.5, r: 172, tick: 0.45, dmg: 34, slow: 0.45, heal: 0.012, note: '池子留得更久' },
        { cd: 7.5, n: 1, dur: 5.5, r: 185, tick: 0.45, dmg: 42, slow: 0.5, heal: 0.013, note: '伤害 +8，池子更大' },
        { cd: 7, n: 2, dur: 6, r: 200, tick: 0.4, dmg: 52, slow: 0.55, heal: 0.015, note: '酒池肉林：一次泼下两片' },
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
    // 铁布衫：挨打后下一次挥砍（锄头和近战兵器）伤害 +rage.base，每多一级再 +rage.perLv
    tiebu: { origin: 'farmer', tags: ['body'], name: '铁布衫', icon: '衫', max: 5, desc: '护甲 +1；挨打后下一次挥砍伤害 +30%（每级再 +10%）', effects: { armor: 1 }, rage: { base: 0.3, perLv: 0.1 } },
    // 丰收：杀小兵有 drop × 等级 的几率多掉一个肉包；肉包回复 +meatMul × 等级（满 3 级：6%、+50%）
    fengshou: { origin: 'farmer', tags: ['body'], name: '丰收', icon: '丰', max: 3, desc: '杀敌有 2% 几率多掉一个肉包，肉包回复 +17%（满 3 级：6%、+50%）', effects: { meatMul: 0.17 }, drop: 0.02 },
    // 老牛：你每升 5 级，生命上限 +hp × 等级；蛮力每 10 点生命多 +manli × 等级（满 5 级：每 5 级 +40 生命，蛮力 1.2%）
    laoniu: { origin: 'farmer', tags: ['body'], name: '老牛', icon: '牛', max: 5, desc: '你每升 5 级生命上限 +8；蛮力每 10 点生命多 +0.04%（满 5 级：每 5 级 +40，蛮力 1.2%）', effects: {}, hp: 8, manli: 0.0004 },
    // 猎户 · 弓箭（对猎弓、连弩生效）
    lianzhu: { origin: 'hunter', tags: ['bow'], name: '连珠箭', icon: '珠', max: 3, desc: '弓弩每次多射 1 支箭（一次最多 4 支，射满后改为伤害 +12%）', effects: { arrowCount: 1 } },
    chuanyang: { origin: 'hunter', tags: ['bow'], name: '百步穿杨', icon: '杨', max: 5, desc: '弓弩伤害 +15%，穿透 +1', effects: { arrowDmg: 0.15, arrowPierce: 1 } },
    // 书生 · 计策（对竹简、羽扇、符咒、法杖、古琴、火把和所有技能生效）
    zhiyin: { origin: 'cainv', tags: ['art'], name: '知音', icon: '音', max: 3, desc: '随从每次出手都带出一小段琴音，震伤身边的敌人（每级范围、伤害提高）', effects: {}, wave: { r: 55, dmg: 0.5, perLv: 0.25 } },
    shicai: { origin: 'cainv', tags: ['art'], name: '诗才', icon: '诗', max: 3, desc: '你每升 5 级，全体随从多算 1 级（每级再多算 1 级）', effects: {} },
    // 才女的随从宝物：allyDmg 随从伤害；allyAtk 随从出手速度；allyRange 随从索敌范围（乘在出身的 allySight 上）；allySpeed 随从移速；allyRevive 阵亡归队时间缩短
    lianbing: { origin: 'cainv', tags: ['art'], name: '练兵', icon: '练', max: 5, desc: '全体随从伤害 +15%', effects: { allyDmg: 0.15 } },
    gujiao: { origin: 'cainv', tags: ['art'], name: '鼓角', icon: '鼓', max: 5, desc: '全体随从出手速度 +10%', effects: { allyAtk: 0.1 } },
    zhentu: { origin: 'cainv', tags: ['art'], name: '阵图', icon: '阵', max: 5, desc: '随从索敌范围 +15%，移动速度 +10%', effects: { allyRange: 0.15, allySpeed: 0.1 } },
    laojun: { origin: 'cainv', tags: ['art'], name: '犒军', icon: '犒', max: 5, desc: '随从血量 +20%，阵亡后归队快 15%', effects: { allyHp: 0.2, allyRevive: 0.15 } },
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
    yongdai: { name: '百姓拥戴', icon: '民', max: 1, unique: true, general: '刘备', desc: '“民心所向”：全体随从伤害 +20%', effects: { allyDmg: 0.2 } },
    miaoji: { name: '锦囊妙计', icon: '囊', max: 1, unique: true, general: '神诸葛', desc: '每 25 秒拆开一个锦囊，随机一样：回 15% 生命 / 全图经验飞来 / 2 秒无敌 / 随从回满血 / 接下来 5 秒伤害 +40%', effects: {},
      bag: { every: 25, heal: 0.15, iframes: 2, dmg: 0.4, dur: 5 } },
    jianxiong: { name: '奸雄', icon: '雄', max: 1, unique: true, general: '曹操', desc: '“宁教我负天下人”：本局每斩一员名将，伤害 +5%（最多 +50%）', effects: {}, perKill: 0.05, cap: 0.5 },
    bowen: { name: '博闻强识', icon: '博', max: 5, unique: true, general: '蔡文姬', desc: '凭记忆默写出父亲四百余篇藏书：经验获取 +5%/级（每次击败蔡文姬都能再升一级，最多 5 级）', effects: {}, xp: 0.05 },
    jiangdong: { name: '江东基业', icon: '吴', max: 1, unique: true, general: '孙权', desc: '“坐断东南战未休”：金币 +15%，对据点伤害 +30%', effects: { goldMul: 0.15, bldDmg: 0.3 } },
    // 鸿图：技能冷却 -6%；每 pulse.every 秒，所有技能的冷却立刻再缩短 pulse.cut 秒（庞统守耒阳，百日之事半日断毕）
    hongtu: { name: '鸿图', icon: '图', max: 1, unique: true, general: '庞统', desc: '“百日之事，半日断毕”：技能冷却 -6%；每 20 秒，所有技能的冷却立刻再缩短 3 秒', effects: { skillCd: 0.06 }, pulse: { every: 20, cut: 3 } },
    // 暴政魔印：身边 R 以内每有一个敌人，伤害 +per（最多 cap）；半秒数一次
    baozhengyin: { name: '暴政魔印', icon: '暴', max: 1, unique: true, general: '魔董卓', desc: '“顺我者昌”：身边每有一个敌人，伤害 +1%（最多 +30%）', effects: {}, tyranny: { R: 320, per: 0.01, cap: 0.3 } },
    meiwuyin: { name: '郿坞金印', icon: '坞', max: 1, unique: true, general: '魔董卓', desc: '郿坞积谷三十年：金币 +25%，生命上限 +60，每秒回复 +1', effects: { goldMul: 0.25, maxHp: 60, regen: 1 } },
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

    // —— 名军（升级兵种）：无尽后期由上面四种普通兵升级而来，一个顶几个（见 stage.upgrade）。背上插一面写着 icon 的小旗（flag 是旗色）
    // 血量、经验按普通兵写，刷出来时再乘倍率；base：还没有自己的小人图时，用这个普通兵的图放大
    xianzhen: { name: '陷阵营', icon: '陷', up: true, base: 'foot', hp: 11, speed: 72, dmg: 8, xp: 1, r: 17, color: '#3a2420', kbResist: 1, h: 50, flag: '#8a2a22',
      look: { skin: '#d0a070', robe: '#3a2420', trim: '#a8322a', armor: true, armorColor: '#2e2a2a', beard: 'short', eyes: 'normal', brows: 'sharp', head: 'helmet', headColor: '#2a2424', plume: '#a8322a', weapon: 'dao' } },
    daji: { name: '大戟士', icon: '戟', up: true, base: 'shield', hp: 48, speed: 46, dmg: 12, xp: 3, r: 22, color: '#3e4a5e', kbResist: 0.95, h: 76, flag: '#34507a', flagY: 0.3, // 图里大戟高过头顶：画得高一些身子才和别的名军一样大；背旗从图顶往下 30%（头盔旁边）插，不挂在戟尖上
      look: { skin: '#d0a070', robe: '#3e4a5e', armor: true, armorColor: '#5a6a80', beard: 'short', eyes: 'normal', brows: 'sharp', head: 'helmet', headColor: '#4a5668', trim: '#c9a046', weapon: 'shield' } },
    yuanrong: { name: '元戎弩手', icon: '弩', up: true, base: 'archer', hp: 15, speed: 56, dmg: 6, xp: 2, r: 16, color: '#3e5a2a', kbResist: 0.3, h: 50, flag: '#3e6a2a',
      ranged: { range: 300, cd: 2.8, speed: 260, dmg: 9, count: 3, spread: 0.22 }, // 一次三支，扇形散开
      look: { skin: '#d9a878', robe: '#3e5a2a', trim: '#c9a046', armor: true, armorColor: '#4e5a3a', beard: 'none', eyes: 'normal', brows: 'sharp', head: 'helmet', headColor: '#3e4a2e', weapon: 'crossbow' } },
    hubao: { name: '虎豹骑', icon: '豹', up: true, base: 'cavalry', hp: 24, speed: 130, dmg: 12, xp: 3, r: 19, color: '#7a4a1a', kbResist: 0.6, h: 64, mount: '#2a2420', flag: '#b06a1a',
      dash: { range: 320, every: 4.5, tele: 0.55, mul: 3.2, dur: 0.45 }, // 隔 every 秒（距离 range 内）朝你冲一段：先停 tele 秒、地上一道红线，再按 mul 倍速度冲 dur 秒
      look: { skin: '#d0a070', robe: '#7a4a1a', trim: '#e0b040', armor: true, armorColor: '#5a3a1a', beard: 'none', eyes: 'normal', brows: 'sharp', head: 'helmet', headColor: '#4a3418', plume: '#e0b040', weapon: 'spear' } },

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
    // 才女召募的兵种：升级时刷到「召募」卡（出身 recruits 里列的），一次来 recruit 名，每种最多出身的 recruitMax 名；满员时替换随从枪兵。desc 写在卡上
    // shot: 'wave' 弹出琴音（宽 w、穿透、减速到 slow）；burst/spread 一次几箭、扇形散开；pierce 箭能穿几个；随从有敌人就去打，但不出你身边一圈（见 game.js updateAllies）；
    // dr 受到的伤害减少；taunt 这个距离内的小兵都改打他（比 allyHp.aggroR 远，而且比你近不近都打他）
    ally_musician: { name: '乐师', icon: '乐', recruit: 1, kind: 'ranged', shot: 'wave', hp: 110, speed: 140, dmg: 10, range: 300, cd: 1.3, w: 56, slow: 0.7, h: 40, r: 12,
      desc: '远远弹出一道琴音，穿过一排敌人，被扫到的走不快。',
      look: { skin: '#f2dcc4', robe: '#cfe0f0', trim: '#3a6a9a', armor: false, beard: 'none', eyes: 'calm', brows: 'thin', head: 'bun', hairColor: '#1a1a20', weapon: 'flute', female: true } }, // 随从统一蓝色系，和敌人分开
    ally_baima: { name: '白马义从', icon: '骑', recruit: 1, kind: 'ranged', hp: 230, speed: 235, dmg: 12, range: 380, cd: 0.8, pierce: 2, h: 52, r: 15, mount: '#f2f0ea',
      desc: '骑白马的弓骑，射得远、跑得快，一箭能穿两个。',
      look: { skin: '#d8a878', robe: '#eef0f2', trim: '#2f6fa8', armor: true, armorColor: '#c9d0d6', beard: 'none', eyes: 'normal', brows: 'sharp', head: 'helmet', headColor: '#d8dde2', plume: '#2f6fa8', weapon: 'bow' } },
    ally_huwei: { name: '虎卫', icon: '卫', recruit: 1, kind: 'melee', hp: 600, speed: 140, dmg: 16, range: 46, cd: 0.9, dr: 0.4, taunt: 280, h: 46, r: 15,
      desc: '重甲护卫：挨打少四成，身边的小兵都冲他去，替你挡刀。',
      look: { skin: '#c99a68', robe: '#24344a', trim: '#c9a046', armor: true, armorColor: '#3a4a5e', beard: 'stubble', beardColor: '#2a2018', eyes: 'normal', brows: 'sharp', head: 'helmet', headColor: '#3a4a5e', plume: '#2f6fa8', weapon: 'dao' } },
    ally_liannu: { name: '连弩兵', icon: '弩', recruit: 1, kind: 'ranged', hp: 120, speed: 140, dmg: 7, range: 330, cd: 1.4, burst: 3, spread: 0.14, h: 40, r: 12,
      desc: '诸葛连弩：一次三箭扇形射出，专打成群的敌人。',
      look: { skin: '#d9a878', robe: '#3a5a7a', trim: '#1e3248', armor: false, beard: 'none', eyes: 'normal', brows: 'sharp', head: 'cap', headColor: '#2f6fa8', weapon: 'crossbow' } },
    // 黄巾号令召来的临时降卒（不占随从名额，沿用黄巾兵的小人图）
    ally_yt: { name: '黄巾降卒', kind: 'melee', hp: 90, speed: 165, dmg: 14, range: 40, cd: 0.7, h: 40, r: 12, art: 'yt_foot', temp: true,
      look: { skin: '#c99a68', robe: '#8a7a52', trim: '#5e5040', armor: false, beard: 'stubble', beardColor: '#2a2018', eyes: 'normal', brows: 'sharp', head: 'band', bandColor: '#e0b020', weapon: 'spear' } },
    // 死士：司马懿的「死士」技能、「幽冥」属性召出的临时随从（沿用冢中死士的小人图，半透明、带紫光）
    ally_shade: { name: '死士', kind: 'melee', hp: 100, speed: 175, dmg: 14, range: 40, cd: 0.7, h: 42, r: 12, art: 'shade', temp: true, shade: true,
      look: { skin: '#b8b0c4', robe: '#2a2234', trim: '#7a5aa8', armor: true, armorColor: '#34303e', beard: 'none', eyes: 'normal', brows: 'sharp', head: 'helmet', headColor: '#26222e', plume: '#6a3a9a', weapon: 'dao' } },
    // 猛虎：孙权的「射虎」技能唤来的临时随从（有 sprites/tiger.png 用图，没有时代码画一头虎）
    ally_tiger: { name: '猛虎', kind: 'melee', hp: 320, speed: 250, dmg: 30, range: 52, cd: 0.6, h: 56, r: 16, art: 'tiger', temp: true, look: { beast: 'tiger' } },
    // 倒戈的小兵：神魔技「魅惑」迷住的敌兵，替你打一会儿就散去（还是原来那个兵的样子，身上一层粉光，见 drawAlly）
    ally_charm: { name: '倒戈', kind: 'melee', hp: 140, speed: 160, dmg: 14, range: 42, cd: 0.7, h: 40, r: 12, temp: true, charm: true,
      look: { skin: '#d9a878', robe: '#c86a9a', trim: '#7a2a5a', armor: false, beard: 'none', eyes: 'normal', brows: 'sharp', head: 'cap', headColor: '#c86a9a', weapon: 'spear' } },
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
    // 左贤王帐：群雄逐鹿里出现在你的右下方（和西凉营地一左上一右下），规则一样。帐里飘出胡笳声、胡骑冲出来；攻破后蔡文姬出帐
    zuoxian: { name: '左贤王帐', icon: '胡', seal: '帐门紧闭', hp: 2000, r: 54, xp: 40, special: true, aggroR: 480, wake: ['左贤王帐警觉', '帐中胡笳声起，胡骑冲了出来'], reward: { type: 'general', gid: 'caiwenji', msg: '胡笳声歇……蔡文姬出帐' },
      shoot: { range: 480, cd: 1.4, dmg: 11, speed: 300, count: 2, spread: 0.35 }, spawn: { type: 'cavalry', every: 5.5, max: 4 },
      desc: '左贤王帐 · 帐中隐约传来胡笳声' },
    // 疑冢：司马懿大招「冢虎疑冢」时立起的一圈坟（只有一座是真的），不会自己刷出来
    yizhong: { name: '疑冢', icon: '冢', hp: 320, r: 30, xp: 0, special: true, tomb: true, desc: '真假难辨 · 打破真冢逼出司马懿' },
    // 药庐：打完黄巾之战（第二章开场）出现在你的西南方，规则和西凉营地一样（走近才动手、别的名将在场时闭门），但血厚一倍、不放箭不派兵：
    // calm 秒没挨打就每秒回 regen 比例的血（没法路过磨一点）；走近后药香飘出，aura 范围里的敌兵每秒回 auraHeal 比例的血。攻破后华佗现身
    yaolu: { name: '药庐', icon: '庐', seal: '药庐闭门', hp: 4000, r: 50, xp: 40, special: true, aggroR: 460, wake: ['药庐飘出药香', '附近敌兵的伤口在慢慢愈合'], reward: { type: 'general', gid: 'huatuo', msg: '药庐门开……神医华佗现身' },
      regen: 0.03, calm: 4, aura: 300, auraHeal: 0.05,
      desc: '药庐 · 药香里似有人影' },
    // 药鼎：华佗大招「百草药鼎」时立在他身边的药鼎（活着就给他回血，打碎时药雾给你回血），不会自己刷出来
    yaoding: { name: '药鼎', icon: '鼎', hp: 200, r: 26, xp: 0, special: true, pot: true, desc: '打碎药鼎 · 断他药力' },
    // 炼狱虎牢关：玩家升到 unlockLv 级，就在正北方升起（战役、无尽征途都算；和别的神魔关隘离得太近会换个方向）。不因普通名将闭门，但有神魔将在场时三座神魔关隘都关门（一次只打一位）；走进 aggroR 就被心魔缠身：武器、技能、神兵的冷却 ×demon。
    // 攻破后魔吕布、魔貂蝉一起现身（twins）；两人都倒下 again 秒后关隘再次升起，每多一轮血量 +roundHp、伤害 +roundDmg
    lianyu: { name: '炼狱虎牢关', icon: '关', seal: '关门紧闭', hp: 10000, r: 66, xp: 80, special: true, noSeal: true, aggroR: 600, demon: 1.4, unlockLv: 80, again: 480, roundHp: 0.5, roundDmg: 0.25,
      wake: ['心魔缠身', '关上魔气缭绕，出手变慢了……'], reward: { type: 'twins', gids: ['molubu', 'modiaochan'], msg: '关门崩裂……魔吕布与魔貂蝉现身！' },
      shoot: { range: 620, cd: 1.2, dmg: 30, speed: 320, count: 3, spread: 0.5, soul: true }, spawn: { type: 'cavalry', every: 4, max: 6 },
      desc: '炼狱虎牢关 · 关上心魔缭绕……' },
    // 玩家 100 级时正南升起；走近了冢边的残枪一根根拔地而起，沿直线刺向你（spears：每 every 秒 count 根，先亮预警线）
    // 攻破后神赵云现身（shen），被击败 again 秒后再起，每多一轮血量 +roundHp、伤害 +roundDmg
    qianghun: { name: '枪魂冢', icon: '枪', seal: '冢门封死', hp: 12000, r: 64, xp: 90, special: true, noSeal: true, aggroR: 620, unlockLv: 100, again: 480, roundHp: 0.5, roundDmg: 0.25,
      wake: ['枪鸣四起', '冢边的残枪一根根拔地而起……'], reward: { type: 'shen', gid: 'shenzhaoyun', msg: '枪冢崩裂……一条银龙破土而出！' },
      spears: { every: 1.7, count: 3, spread: 0.5, len: 760, w: 54, tele: 0.8, dmg: 40 }, spawn: { type: 'cavalry', every: 4, max: 6 },
      desc: '枪魂冢 · 冢中枪鸣不绝……' },
    // 玩家 150 级时正西升起；走近了乱石从天而降（rocks：每 every 秒 count 块，落在你身边 spread 以内，先亮落点）
    // 攻破后神诸葛现身（shen），被击败 again 秒后再起，每多一轮血量 +roundHp、伤害 +roundDmg
    yufupu: { name: '鱼腹浦八阵', icon: '阵', seal: '石阵封闭', hp: 14000, r: 66, xp: 100, special: true, noSeal: true, aggroR: 620, unlockLv: 150, again: 480, roundHp: 0.5, roundDmg: 0.25,
      wake: ['乱石穿空', '石堆里杀气冲天，乱石从天而降……'], reward: { type: 'shen', gid: 'shenzhuge', msg: '石阵洞开……卧龙羽扇轻摇，缓步而出' },
      rocks: { every: 1.6, count: 4, r: 72, delay: 1.0, spread: 170, dmg: 40 }, spawn: { type: 'archer', every: 4, max: 6 },
      desc: '鱼腹浦八阵 · 乱石堆中杀气冲天……' },
    // 七星灯：神诸葛被打空血时立起的续命灯（一次七盏，见 wolong.lamps），不会自己刷出来
    qixingdeng: { name: '七星灯', icon: '灯', hp: 300, r: 22, xp: 0, special: true, lamp: true, desc: '七星续命灯 · 打灭它' },
    // 制衡虚影：孙权血过半「制衡」时立在他两侧的张昭、周瑜（见孙权的 zhiheng 大招），不会自己刷出来；两个都在时孙权打不动
    zhiheng: { name: '制衡虚影', icon: '衡', hp: 300, r: 24, xp: 0, special: true, ghost: true, desc: '制衡 · 先打掉虚影' },
    // 玩家 120 级时西南升起（离别的神魔关隘太近会换方向）；走近了城头火箭如雨（rocks 同鱼腹浦八阵，rgb 换成火色）
    // 攻破后魔董卓现身（mowang），被击败 again 秒后再起，每多一轮血量 +roundHp、伤害 +roundDmg
    meiwu: { name: '郿坞', icon: '坞', seal: '坞门紧闭', hp: 13000, r: 66, xp: 95, special: true, noSeal: true, aggroR: 620, unlockLv: 120, again: 480, roundHp: 0.5, roundDmg: 0.25,
      wake: ['郿坞火起', '坞堡城头火箭如雨……'], reward: { type: 'mowang', gid: 'modongzhuo', msg: '坞门洞开……酒气血气之中，魔王董卓现身！' },
      rocks: { every: 1.5, count: 4, r: 72, delay: 0.9, spread: 170, dmg: 40, rgb: '255,110,50' }, spawn: { type: 'cavalry', every: 4, max: 6 },
      desc: '郿坞 · 坞中积谷三十年，酒池肉林……' },
    // 玉泉山：后期（玩家 180 级）出现在地图东北方的关帝庙，打掉后神关羽显圣（见 game.js 的「玉泉山：神关羽」）
    yuquan: { name: '玉泉山', icon: '圣', seal: '庙门紧闭', hp: 16000, r: 66, xp: 110, special: true, noSeal: true, aggroR: 620, unlockLv: 180, again: 480, roundHp: 0.5, roundDmg: 0.25,
      wake: ['玉泉显圣', '关帝庙前青光冲天，刀气四溢……'], reward: { type: 'shen', gid: 'shenguanyu', msg: '庙门洞开……青龙长吟，武圣显圣！' },
      rocks: { every: 1.5, count: 4, r: 72, delay: 0.9, spread: 170, dmg: 40, rgb: '90,240,170' }, spawn: { type: 'shield', every: 4, max: 6 },
      desc: '玉泉山 · 关帝庙前青光冲天……' },
    // 酒池：魔董卓「酒池肉林」泼下的毒酒池（见 modongzhuo 的 jiuchi 大招）。池心一口酒瓮（打碎它池子就干了），不会自己刷出来
    jiuchi: { name: '酒瓮', icon: '瓮', hp: 300, r: 26, xp: 0, special: true, pool: true, desc: '酒池 · 打碎酒瓮' },
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
        // 翩若惊鸿：tele 秒的虚线预警后，沿 S 形路线（越过你再滑 reach、左右摆 amp）以 speed 滑过，撞到受伤；身后水痕 freeze 秒后冻成冰墙（宽 wallW）挡路，
        // 一共滑 glides 次，冰墙立 life 秒后闪 crack 秒再碎，离墙 burstR 以内被冰屑扎到
        { id: 'jinghong', name: '翩若惊鸿', type: 'iceWalls', glides: 2, tele: 0.6, speed: 760, reach: 420, amp: 140, waves: 1.5, freeze: 0.7, wallW: 28, life: 4, crack: 0.7, burstR: 60, dmg: 1.1, burstDmg: 1.2 },
        { id: 'frost', name: '洛水寒川', type: 'frostNova', radius: 140, tele: 1.15, dmg: 1.3, freeze: 0.9 },
        // 冰封千里：R 以内铺成冰面（spread 秒铺开，冰面上打滑：速度每秒只跟上摇杆 grip 倍）；冰面持续 dur 秒，期间每 crackEvery 秒裂一道冰缝（共 cracks 道，单数道从你脚下经过），
        // 预警 crackTele 秒后刺出冰棱；最后提前 warn 秒在她脚下亮圈，冰面从她脚下以 sealSpeed 往外冻实，追上你就冻住 sealFreeze 秒并受重伤
        { id: 'icering', name: '冰封千里', type: 'iceField', hpBelow: 0.5, R: 520, spread: 1.2, dur: 9, grip: 1.8, cracks: 4, crackEvery: 1.9, crackTele: 1.0, crackLen: 1000, crackW: 46, crackDmg: 1.0, crackFreeze: 0.5, warn: 1.0, sealSpeed: 150, sealDmg: 1.6, sealFreeze: 1.2 },
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
      name: '魔吕布', title: '炼狱魔将 · 吕奉先', icon: '魔', hp: 16000, speed: 110, dmg: 30, r: 38, color: '#3a0a10', twin: true, bleed: true, noCutin: true, camp: 'mo',
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
      name: '魔貂蝉', title: '血月魔姬 · 貂蝉', icon: '魅', hp: 16000, speed: 106, dmg: 26, r: 30, color: '#5a0f2a', twin: true, bleed: true, noCutin: true, camp: 'mo',
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
      name: '神赵云', title: '龙魂 · 常山赵子龙', icon: '龙', hp: 33000, speed: 135, dmg: 34, r: 36, color: '#c8d4e4', shen: true, camp: 'shen',
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
    // 蔡文姬：没入匈奴十二年的才女，左贤王帐里的名将（群雄逐鹿，可选）。悲笳的音符打中会走不快；
    // 胡笳十八拍要踩着节拍在内外圈之间换位置，每第六拍全场大震、只有金色音符圈安全；悲愤诗的墨字旋转着往外飞；血过半后胡骑成排冲阵
    caiwenji: {
      name: '蔡文姬', el: 'wind', title: '胡笳十八拍 · 文姬归汉', icon: '姬', hp: 5600, speed: 100, dmg: 20, r: 28, color: '#3a4a7a',
      attacks: ['volley', 'meteor', 'volley'], interval: 2.4, kite: 340,
      volley: { count: 5, spread: 0.8, speed: 240, dmg: 12, note: true, chill: 1.2 }, // 悲笳：一扇慢悠悠的音符，打中走不快
      meteor: { count: 4, radius: 70, delay: 1.1, dmg: 18, rgb: '170,185,255' }, // 笳声震落的落点
      rewards: ['hujia', 'shibapai', 'bowen'],
      ultRgb: '150,170,255', ultEvery: 10,
      ults: [ // 十八拍：beat 秒一拍，单数拍震内圈（0–r1）、双数拍震外圈（r1–r2），提前一拍亮起；每第 6 拍 r2 以内全场大震，只有 safe 个音符圈安全（提前 lead 拍亮起，有一个就在你附近）
        { id: 'shiba', name: '胡笳十八拍', type: 'eighteenBeats', beat: 0.6, beats: 18, r1: 160, r2: 600, safe: 3, safeR: 60, lead: 3, dmg: 0.8, big: 1.4 },
        { id: 'beifen', name: '悲愤诗', type: 'poemSpiral', arms: 4, every: 0.16, dur: 3.2, turn: 1.5, speed: 190, dmg: 0.6 },
        { id: 'guihan', name: '文姬归汉', type: 'cavalryLanes', hpBelow: 0.5, lanes: 5, laneW: 120, span: 1300, tele: 1.0, gap: 0.4, riders: 3, speed: 950, dmg: 1.1, rounds: 3, onFoot: true, say: '“胡笳声里……我要归汉！”' },
      ],
      banner: '左贤王帐 · 蔡文姬 胡笳悲鸣', line: '“笳一会兮琴一拍，心愤怨兮无人知。”', rage: '“十二年了……这一曲，为汉家而奏！”',
      look: { skin: '#f4e2d0', skinShade: '#d8bca4', robe: '#3a4a7a', trim: '#f0ece0', armor: false, beard: 'none', eyes: 'calm', brows: 'thin', head: 'bun', hairColor: '#141820', pin: '#e0c070', weapon: 'flute', aura: '#6a7ad0', female: true, artFace: [0.53, 0.25, 0.34] },
    },
    // —— 曹操：乱世奸雄，第五章章末。玄黑配暗金、深红点缀，雷属性。平时挥倚天剑扇形剑气，隔一阵召一队虎豹骑 ——
    caocao: {
      name: '曹操', el: 'thunder', title: '乱世奸雄 · 魏武', icon: '曹', hp: 12000, speed: 104, dmg: 28, r: 34, color: '#2a2420',
      attacks: ['cleave', 'summon', 'cleave', 'charge'], interval: 2.4, cleaveR: 220, chargeSpeed: 720, summon: 3, summonType: 'hubao',
      rewards: ['yitian', 'duangexing', 'jianxiong'],
      ultRgb: '190,150,255', ultEvery: 10,
      ults: [
        // 对酒当歌：一圈圈歌声扩散（每圈一道缺口），打中你就醉 drunk 秒（走路带惯性、东倒西歪）；全场小兵 morale.dur 秒内移速、伤害 +morale.k
        { id: 'duange', name: '对酒当歌', type: 'soundRing', count: 4, speed: 300, R: 900, gap: 0.55, dmg: 1.0, drunk: 2, morale: { dur: 6, k: 0.3 } },
        // 横槊赋诗：持槊冲锋，冲过的路上依次落下 n 道雷，每道一句诗
        { id: 'hengshuo', name: '横槊赋诗', type: 'lanceDash', count: 1, len: 820, speed: 1100, w: 74, tele: 0.8, dmg: 1.3, poem: { n: 4, r: 95, gap: 0.32, dmg: 1.0, lines: ['对酒当歌', '人生几何', '譬如朝露', '去日苦多'] } },
        // 吾好梦中杀人（血过半）：睡 dur 秒，R 以内有你、或者被打中，就闪到你身后一刀（cd 秒内不再暴起；无尽里至少扣生命上限的 endlessPct）；睡完没被惊扰就回 heal 的血
        { id: 'mengzhong', name: '吾好梦中杀人', type: 'dreamKill', hpBelow: 0.5, dur: 4, R: 230, cd: 1.0, dmg: 1.6, endlessPct: 0.2, heal: 0.08 },
      ],
      banner: '洛阳 · 魏武 曹孟德', line: '“宁教我负天下人，休教天下人负我！”', rage: '“竖子！安敢欺我！”',
      look: { skin: '#ecccaa', skinShade: '#c8a07c', robe: '#1e1a18', trim: '#c9a046', armor: true, armorColor: '#6a5428', beard: 'goatee', beardColor: '#1a1410', eyes: 'phoenix', brows: 'sharp', head: 'scholar', headColor: '#141210', weapon: 'sword', aura: '#8a6ad0', artFace: [0.5, 0.26, 0.32] },
    },
    // —— 刘备：仁德之主，第五章曹操之前登场。明黄配墨绿、金色点缀。自己不猛、靠人：关张虚影替他出手、骑的卢飞渡、把身边小兵化作护盾 ——
    liubei: {
      name: '刘备', title: '仁德之主 · 昭烈帝', icon: '刘', hp: 10000, speed: 100, dmg: 24, r: 32, color: '#2e4a32',
      attacks: ['cleave', 'summon', 'cleave', 'volley'], interval: 2.5, cleaveR: 200, summon: 5, summonType: 'foot',
      volley: { count: 5, spread: 0.6, speed: 380, dmg: 14, arrow: true, wrgb: '180,230,150' },
      rewards: ['shuanggu', 'rende', 'yongdai'],
      ultRgb: '150,225,140', ultEvery: 10, mount: '#f2f0ea',
      ults: [
        // 桃园结义：左右升起关羽、张飞的虚影（染成翠金色）：张飞沿预警线冲你，gap 秒后关羽劈出一道青龙刀气；血过半后两人各出手两次
        { id: 'taoyuan', name: '桃园结义', type: 'oathPhantoms', tele: 0.8, gap: 0.5, dashLen: 760, dashW: 80, dashSpeed: 1500, waveR: 60, waveSpeed: 760, dmg: 1.3 },
        // 的卢飞渡：骑的卢跃向你（最远 len），先亮出飞跃路线和落点；落地砸一圈，再向外扩一道冲击波（波扫过你才受伤，有一道缺口）；暴怒多跳一下
        { id: 'dilu', name: '的卢飞渡', type: 'diluLeap', count: 2, len: 620, radius: 150, tele: 0.8, air: 0.6, ringR: 420, ringSpeed: 520, gap: 0.5, dmg: 1.5, ringDmg: 0.8 },
        // 仁德（血过半）：引导 chan 秒，range 以内的小兵化作光飞到他身上，每个给最大血量 per 的护盾，最多 cap
        { id: 'rende', name: '仁德', type: 'absorbShield', hpBelow: 0.5, chan: 1.6, range: 520, per: 0.012, cap: 0.3 },
      ],
      banner: '汉中 · 昭烈 刘玄德', line: '“惟贤惟德，能服于人。”', rage: '“二弟、三弟，随我来！”',
      look: { skin: '#efd2ae', skinShade: '#cfae88', robe: '#d8b84a', trim: '#2e4a32', armor: true, armorColor: '#c9a046', beard: 'goatee', beardColor: '#1a1410', eyes: 'calm', brows: 'thin', head: 'scholar', headColor: '#c9a046', weapon: 'sword', aura: '#7ab070', artFace: [0.48, 0.205, 0.32] },
    },
    // —— 孙权：江东之主，第五章刘备之后、曹操之前登场。碧眼紫髯，江东赤色战袍配青铠，冰属性。古锭刀宽幅劈砍（带冰），隔一阵召一排江东弓手 ——
    sunquan: {
      name: '孙权', el: 'ice', title: '碧眼儿 · 江东之主', icon: '孙', hp: 11000, speed: 102, dmg: 26, r: 33, color: '#2a4a5a',
      // cleaveHalf：劈砍的半角（普通名将 π/3，古锭刀更宽）；summonRow：召来的兵在他身后排成一排
      attacks: ['cleave', 'summon', 'cleave', 'volley'], interval: 2.4, cleaveR: 230, cleaveHalf: 1.25, summon: 5, summonType: 'archer', summonRow: true,
      volley: { count: 5, spread: 0.5, speed: 560, dmg: 14, arrow: true, wrgb: '170,215,255' },
      rewards: ['guding', 'shehu', 'jiangdong'],
      ultRgb: '140,200,255', ultEvery: 10,
      ults: [
        // 合肥射虎：放出一头猛虎沿预警线扑向你，跑出画面边缘时折返一次（停 back 秒重新瞄准你）；扑中受伤、冰寒减速。暴怒时两头一起
        { id: 'shehu', name: '合肥射虎', type: 'tigerPounce', tele: 0.8, speed: 1050, w: 70, back: 0.45, dmg: 1.4 },
        // 江东水师：画面一侧泊着战船，rows 排连弩依次横扫全屏（每排隔 gap 秒），每排把屏幕高度分成 lanes 道、留 holes 道空隙；暴怒多一排
        { id: 'shuishi', name: '江东水师', type: 'navyVolley', rows: 3, lanes: 9, holes: 2, tele: 1.0, gap: 1.0, speed: 950, dmg: 1.1 },
        // 制衡（血过半）：张昭、周瑜两道虚影立在他两侧（每个的血是他最大血量的 hp），两个都打掉之前他打不动。
        //   张昭每 every 秒给他加最大血量 shield 的护盾（最多 cap）；周瑜每 fireEvery 秒往你脚下放一团火（半径 fireR）
        { id: 'zhiheng', name: '制衡', type: 'checkBalance', hpBelow: 0.5, hp: 0.06, every: 1, shield: 0.02, cap: 0.25, fireEvery: 2.6, fireR: 90, fireDmg: 0.9 },
      ],
      banner: '建业 · 吴大帝 孙仲谋', line: '“坐断东南，孤便是江东之主！”', rage: '“江东基业，岂容尔等染指！”',
      look: { skin: '#efd2ae', skinShade: '#cfae88', robe: '#a83228', trim: '#c9a046', armor: true, armorColor: '#3a5a6e', beard: 'long', beardColor: '#6a2a6a', eyes: 'phoenix', brows: 'sharp', head: 'helmet', headColor: '#c9a046', plume: '#a83228', weapon: 'dao', aura: '#7ab0d8', artFace: [0.5, 0.25, 0.33] },
    },
    // —— 庞统：凤雏，第五章刘备之后、孙权之前登场（随刘备入蜀的军师，214 年殁于落凤坡）。浓眉黑面、短髯，相貌不扬；
    //   赭色鹤氅配赤金，火属性。平时离你远远地扇出一排火羽、落几团火，隔一阵召一队弓手。大招见 game.js 的「庞统」 ——
    pangtong: {
      name: '庞统', el: 'fire', title: '凤雏 · 庞士元', icon: '庞', hp: 10500, speed: 100, dmg: 24, r: 31, color: '#5a2e1a',
      attacks: ['volley', 'meteor', 'volley', 'summon'], interval: 2.4, kite: 320, summon: 4, summonType: 'archer',
      volley: { count: 7, spread: 0.9, speed: 340, dmg: 13, arrow: true, wrgb: '255,150,70' }, // 火羽：一扇火红的羽箭
      meteor: { count: 3, radius: 80, delay: 1.0, dmg: 18, rgb: '255,140,60' },
      rewards: ['fengling', 'sance', 'hongtu'],
      ultRgb: '255,130,50', ultEvery: 10,
      ults: [
        // 献连环：铁索把你和身边最近的 n 个小兵连住（range 以内不够 n 个就召几个弓手补上），tele 秒后锁死：拖着它们走得慢（每条 slow，最多 slowCap）；
        //   hold 秒后火从每个兵那头顺着铁索烧向你（每秒 fireSpeed），烧到就受伤、着火 burn 秒。那个兵死了那条就断；闪现一下全断（同董卓的铁链）
        { id: 'lianhuan', name: '献连环', type: 'chainTie', n: 4, range: 460, tele: 0.6, hold: 1.4, fireSpeed: 240, slow: 0.14, slowCap: 0.6, burn: 2, dmg: 1.3 },
        // 凤火燎原：一只火凤沿预警线横穿画面（宽 w），身后每隔 trailGap 留下一团火（半径 trailR，烧 trailT 秒）；一共 passes 趟，后一趟换个方向，暴怒多一趟
        { id: 'fenghuo', name: '凤火燎原', type: 'phoenixFlight', passes: 2, tele: 0.9, gap: 0.5, w: 120, speed: 1250, trailR: 48, trailT: 3, trailGap: 70, dmg: 1.3 },
        // 落凤坡（血过半）：顺着他到你的方向拉开一条山道（宽 laneW、长 len，你在离起点 back 处），两侧峭壁走不出去（闪现能翻过去）；
        //   tele 秒后箭雨从起点往前推（每秒 speed，比你慢一点），被箭雨盖住就挨打（每 tick 秒一下）；前面的山道里每秒还落 spots 团乱箭（半径 spotR）
        { id: 'luofeng', name: '落凤坡', type: 'arrowValley', hpBelow: 0.5, laneW: 320, len: 1200, back: 300, tele: 1.2, speed: 150, tick: 0.35, spots: 2.5, spotR: 70, dmg: 0.6, spotDmg: 0.9 },
      ],
      banner: '落凤坡 · 凤雏 庞士元', line: '“世人笑我貌丑——可识得凤雏之才？”', rage: '“上中下三策……今日便用上策！”',
      look: { skin: '#c99872', skinShade: '#a57a58', robe: '#7a3a22', trim: '#d8a040', armor: false, beard: 'short', beardColor: '#1a1410', eyes: 'round', brows: 'bushy', head: 'lunjin', headColor: '#2a2018', weapon: 'fan', aura: '#e07a30', artFace: [0.53, 0.235, 0.3] },
    },
    // —— 魔董卓：120 级后西南方的郿坞放出（魔将，封神线第二个目标）。玄黑配血红、暗金点缀，火属性。规则见 game.js 的「郿坞：魔董卓」 ——
    //   平时甩链钩人、砸地、召西凉铁骑；黑血护盾就是神魔将通用的护盾（最多最大血量的 camp.shield），回血也走通用入口
    modongzhuo: {
      name: '魔董卓', el: 'fire', title: '炼狱魔王 · 董仲颖', icon: '魔', hp: 40000, speed: 82, dmg: 32, r: 44, color: '#2a0a10', camp: 'mo', mowang: true,
      attacks: ['hook', 'slam', 'summon', 'hook', 'cleave'], interval: 2.4, slamR: 190, cleaveR: 210, summon: 6, summonType: 'cavalry',
      hook: { len: 560, speed: 1300, w: 32, pull: 1100, tele: 0.7, crush: 1.4 },
      rewards: ['jiuchi', 'baozhengyin', 'meiwuyin'],
      ultRgb: '235,60,40', ultEvery: 11, dark: true,
      ults: [
        // 焚烧洛阳：以你为中心，四面火墙往里推（push 秒推完），只留一条宽 corridor 的安全走廊（离中心最多 shift，方向随机）；
        //   被火墙扫过、站在烧过的地方每 tick 秒掉一下；一共 waves 轮，每轮走廊换个地方（暴怒多一轮）
        { id: 'fenshao', name: '焚烧洛阳', type: 'burnCity', waves: 2, R: 760, corridor: 180, shift: 240, tele: 1.1, push: 2.0, hold: 0.6, gap: 0.4, tick: 0.35, dmg: 0.5, pct: 0.06 },
        // 天子锁链：count 条锁链从画面外的天上依次射向你（先亮预警线，每条隔 gap 秒）；锁中就把你拖向他；锁链落点烧起 fireR 的火，烧 burn 秒
        { id: 'suolian', name: '天子锁链', type: 'skyChains', count: 3, w: 34, speed: 1700, tele: 0.9, gap: 0.3, pull: 1100, fireR: 90, burn: 3.5, dmg: 1.0, pct: 0.12 },
        // 酒池肉林：在你身边泼下 count 个毒酒池（半径 R，留 dur 秒）：你踩进去走不快、每 tick 秒掉血；他会走进池里泡着回血，回血上限是神魔将通用上限的 heal 倍。
        //   池心的酒瓮打碎（瓮的血是他最大血量的 jarHp），池子就干了。酒瓮刚泼下 guard 秒打不动（酒池初成），之后一秒最多掉自己血量的 cap
        //   （玩家反馈一下就打掉了、看不到效果：后期一刀几千，光加血量没用，和七星灯一样限速）
        { id: 'jiuchi', name: '酒池肉林', type: 'winePools', count: 3, R: 130, spread: 340, dur: 18, slow: 0.45, tick: 0.5, dmg: 0.35, pct: 0.03, jarHp: 0.02, guard: 1.5, cap: 0.2, heal: 2 },
        // 魔王降临（血过半）：体型变大 grow 倍、从此狂暴；之后每掉最大血量的 every，就召一队 squad 骑的西凉铁骑从画面外冲阵
        { id: 'mowang', name: '魔王降临', type: 'demonLord', hpBelow: 0.5, grow: 1.3, squad: 6, every: 0.1 },
      ],
      banner: '郿坞 · 炼狱魔王 董卓', line: '“天下之事，岂不在我！炼狱亦然！”', rage: '“竖子敢尔！”',
      look: { skin: '#c99478', skinShade: '#98684e', robe: '#140a0e', trim: '#d04030', armor: true, armorColor: '#2a0a12', beard: 'tiger', beardColor: '#1a0a0a', eyes: 'round', brows: 'bushy', head: 'helmet', headColor: '#120a0e', plume: '#d02030', weapon: 'dao', aura: '#a01020', artFace: [0.54, 0.34, 0.36] },
    },
    // —— 神诸葛：150 级后正西方的鱼腹浦八阵放出。深靛配月白、金色点缀。八门金锁（找生门）、七星灯续命一次，规则见 wolong ——
    shenzhuge: {
      name: '神诸葛', title: '星罗八阵 · 卧龙孔明', icon: '卧', hp: 46000, speed: 95, dmg: 34, r: 34, color: '#2a3460', wolong: true, camp: 'shen',
      attacks: ['volley', 'meteor', 'volley', 'meteor'], interval: 2.3, kite: 340,
      volley: { count: 10, spread: 1.0, speed: 520, dmg: 20, arrow: true, wrgb: '170,200,255' }, // 诸葛连弩：一扇弩箭
      meteor: { count: 6, radius: 78, delay: 0.95, dmg: 30, rgb: '255,215,130' },             // 星落
      rewards: ['zhugenu', 'qimen', 'miaoji'],
      ultRgb: '255,214,120', ultEvery: 11,
      ults: [
        // 八阵 · 八门金锁：把你困进八门阵（规则见 wolong.gates）。opener：登场后的第一个大招一定是它
        { id: 'bamen', name: '八阵 · 八门金锁', type: 'eightGates', opener: true },
        // 观星 · 北斗：你脚下连着亮出 waves 次北斗七星（span 是勺口到勺柄的长度），七颗星按天枢到摇光的顺序一颗颗砸下（step 秒一颗）；
        //   星图摆在你 lead 秒后要走到的地方（绕圈躲不掉）。困在八门阵里时他也会放这一招
        { id: 'guanxing', name: '观星 · 北斗', type: 'dipperFall', waves: 4, span: 560, r: 52, tele: 0.8, step: 0.12, gap: 0.9, lead: 0.6, dmg: 1.2, pct: 0.2 },
        // 空城计（血过半）：原地抚琴 dur 秒，身边小兵退走；琴声从 innerR 一圈圈往外推你（有缺口）；
        //   你走进他身边 innerR 以内累计站够 need 秒就「识破空城」：他掉最大血量的 lose、僵直 daze 秒、vuln 秒内受伤 +30%；没识破就伏兵 ambush 个弓手围上来
        { id: 'kongcheng', name: '空城计', type: 'emptyCity', hpBelow: 0.5, dur: 6, innerR: 140, ringR: 700, every: 0.6, ringSpeed: 300, gap: 0.6, push: 460, need: 2, lose: 0.04, daze: 2, vuln: 4, ambush: 12, dmg: 0.5, pct: 0.1 },
        // 八阵 · 天覆地载（七星灯续命之后）：以他为中心把地面分成八格，生门那一格亮绿（安全），其余七格按顺时针一格接一格炸开（step 秒一格），共 rounds 轮
        { id: 'tianfu', name: '八阵 · 天覆地载', type: 'gateSweep', afterRevive: true, R: 760, tele: 0.9, step: 0.28, rounds: 2, gap: 0.6, dmg: 1.6, pct: 0.3 },
      ],
      banner: '鱼腹浦 · 神诸葛', line: '“八阵图成，汝可寻得生门？”', rage: '“鞠躬尽瘁，死而后已！”',
      look: { skin: '#efd6b4', skinShade: '#cfb08a', robe: '#2a3460', trim: '#e8e4d8', armor: false, beard: 'goatee', eyes: 'calm', brows: 'thin', head: 'lunjin', headColor: '#d8dce8', weapon: 'fan', aura: '#d8b860', artFace: [0.515, 0.2, 0.32] },
    },
    // —— 神关羽：180 级东北方的玉泉山放出（神将，入魔线第三个目标）。赤面长髯，青绿战袍配金甲，青龙偃月刀；复生后骑赤兔（mount）。
    //   平时青龙刀大幅劈砍、冲锋、扇出一排青龙刀气。千里走单骑见 wusheng；奖励沿用关羽的三件（青龙偃月刀、武圣、春秋）。规则见 game.js 的「玉泉山：神关羽」 ——
    shenguanyu: {
      name: '神关羽', title: '武圣 · 玉泉显圣', icon: '圣', hp: 52000, speed: 100, dmg: 36, r: 36, color: '#1f4a38', wusheng: true, camp: 'shen', mount: '#a3261b',
      attacks: ['cleave', 'charge', 'cleave', 'volley'], interval: 2.4, cleaveR: 260, cleaveHalf: 1.15, chargeSpeed: 760,
      volley: { count: 5, spread: 0.7, speed: 420, dmg: 22, arrow: true, wrgb: '90,240,170' }, // 一排青龙刀气
      rewards: ['qinglong', 'wusheng', 'chunqiu'],
      ultRgb: '90,240,170', ultEvery: 11,
      // 神将的大招（2026-11-03 重做：原来的青龙出海、过五关、威震华夏「平平无奇」）：画面跟着变、有巨大的东西、各有一个只有他才有的玩法
      ults: [
        // 青龙偃月 · 天刀：画面压暗，天上悬一把巨大的青龙偃月刀；地上月牙形的刀影（半径 R、宽 band、半张角 half，你在月牙正中）跟着你走 track 秒后定住，
        //   tele[i] 秒后劈下，连劈 count 刀（每刀转个方向，一刀比一刀快）；往月牙里面（凹的那边）或外面躲。
        //   最后再一刀「横扫千军」：他抡刀转一整圈，safe 到 ringR 之间全挨打——贴到他脚下或跑出 ringR 才躲得开（预警 ringTele 秒，保底 ringPct）。
        //   每刀落地留一道青色地裂 crackT 秒，踩着每 crackTick 秒挨一下（保底 crackPct）
        { id: 'tiandao', name: '青龙偃月 · 天刀', type: 'skyBlade', count: 3, track: 0.7, tele: [0.8, 0.65, 0.55], gap: 0.3, R: 300, band: 130, half: 1.15,
          ringTele: 1.5, ringR: 620, safe: 170, ringPct: 0.25, crackT: 3, crackTick: 0.5, crackPct: 0.04, dmg: 1.5, pct: 0.2 },
        // 温酒斩：时间静止（画面变灰，小兵、精英、飞来的箭都定住，你能走、能打）；画面上方一盏冒热气的酒爵，热气 dur 秒冒完。
        //   他隐去身形，每隔 step 秒亮一道细红线（count 道，长 len，都穿过你身边 near 以内，最后一道正好穿过你），热气一散全部同时斩下（宽 w），
        //   线上的普通小兵直接斩死；然后他出现在最后一道线上、你身后不远处。两次温酒斩至少隔 cd 秒
        { id: 'wenjiu', name: '温酒斩', type: 'wineCut', count: 6, step: 0.3, dur: 2.4, len: 1600, w: 46, near: 230, cd: 30, dmg: 2, pct: 0.3 },
        // 水淹七军：大水从画面一侧往对面漫（每秒 speed），水里走不快（只剩 1 - slow）、每 tick 秒挨一下；你身边有 islands 块高地（半径 isleR）是干的；漫满后留 hold 秒再退
        { id: 'shuiyan', name: '水淹七军', type: 'flood', tele: 1.2, speed: 420, hold: 3, islands: 3, isleR: 85, slow: 0.45, tick: 0.5, dmg: 0.5, pct: 0.06 },
        // 玉泉显圣（血过半，只一次）：画面一黑、一声雷，画面后方升起巨大的翡翠关圣法相，一直留到他倒下（单骑冲阵时停手）：
        //   每 every 秒法相举刀，朝你劈一道巨型扇形（半径 R、半角 half，预警 tele 秒）；
        //   每 waveEvery 秒（第一次在 waveFirst 秒后）从他身上推出一圈「威压」（每秒 waveSpeed、宽 waveW），圈上有一道 gap 弧度的缺口（先亮 waveTele 秒），
        //   站进缺口或闪现穿过去；被扫到挨打（保底 wavePct）并被推开 push
        { id: 'xiansheng', name: '玉泉显圣', type: 'manifest', hpBelow: 0.5, every: 6, first: 2.5, tele: 1.2, R: 900, half: 0.55,
          waveEvery: 10, waveFirst: 5, waveTele: 0.9, waveSpeed: 480, waveW: 70, gap: 0.9, push: 420, wavePct: 0.15, dmg: 1.6, pct: 0.2 },
      ],
      banner: '玉泉山 · 武圣 神关羽', line: '“关某在此，谁敢放肆！”', rage: '“青龙偃月，斩尽不臣！”',
      look: { skin: '#b8433a', skinShade: '#8e2e26', robe: '#1f5a40', trim: '#e0b850', armor: true, armorColor: '#c9a046', beard: 'long', eyes: 'phoenix', brows: 'silkworm', head: 'hood', headColor: '#1f5a40', weapon: 'guandao', aura: '#5af0aa', artFace: [0.53, 0.29, 0.3] },
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
  // 神关羽的规则 · 千里走单骑：第一次被打空血不会死，ride 秒里骑上赤兔绕着你冲出重围（打不到，冲撞到你会受伤），然后以 revive 的血复生；
  //   之后一直骑着赤兔：移速 ×speed，大招间隔 ×ultK（只有一次）
  wusheng: { qianli: { ride: 3, revive: 0.45, speed: 1.35, ultK: 0.8, rideR: 380, rideDmg: 1.0 } },
  // 神诸葛的规则
  //   八门金锁（大招 eightGates）：在你脚下立起半径 R 的八角石阵，八个方位各一道门（门洞宽 gateW），顺时针永远是 order 的顺序（北为休门），整圈随机转几格；
  //     开场亮一道门的字，之后每 reveal 秒再亮一道（生门不亮）；阵里每 rockEvery 秒落一块乱石（rock.pct：掉你生命上限的比例）；dur 秒没出去就八门俱闭（timeout）。
  //     从哪道门出去吃哪道门的效果（door）：pct 掉你生命上限的比例，heal 回血，stun 定身几秒，burn 灼烧几秒，block 门是死的、把你弹回阵里；
  //     生门（boss）：他掉最大血量的 boss、僵直 daze 秒、vuln 秒内受伤 +30%。七星灯续命后八道门每 spin 秒整圈顺时针转一格（八阵 · 变）
  //   七星灯（禳星）：第一次被打空血不死，原地禳星 chan 秒（打不动），四周按北斗七星立起 n 盏灯（每盏的血是他最大血量的 lampHp，摆开 span 宽，一个范围招最多罩住一两盏）；
//     灯焰护体：你走到灯 near 以内才打得动它，每盏灯一秒里最多掉自己血量的 cap（玩家反馈后期随便就打掉了：远程招站着不动打不灭，要沿着北斗一盏一盏跑过去）；
  //     到时每盏还亮着的灯给他回 perLamp 的血（入魔「禁疗」打折）；七盏全灭就当场倒下。之后就不再续命
//   八卦护体、石兵：见下面的 guard、stones（玩家说比别的神魔将弱：以前站哪都全额吃伤害、除了大招几乎不伤人）
  wolong: {
    gates: { R: 340, gateW: 110, dur: 16, reveal: 2.5, rockEvery: 0.9, rock: { r: 60, delay: 0.9, pct: 0.08 }, spin: 3, timeout: 0.35, order: '休生伤杜景死惊开',
      door: {
        休: { heal: 0.05, text: '休门 · 平安出阵', good: true },
        生: { boss: 0.04, daze: 2, vuln: 4, heal: 0.15, text: '生门 · 破阵！', good: true },
        伤: { pct: 0.25, text: '伤门 · 受创' },
        杜: { pct: 0.1, block: true, text: '杜门 · 此路不通' },
        景: { pct: 0.15, burn: 3, text: '景门 · 火起' },
        死: { pct: 0.4, text: '死门 · 九死一生' },
        惊: { pct: 0.15, stun: 1.5, text: '惊门 · 心惊胆裂' },
        开: { text: '开门 · 平安出阵', good: true },
      } },
    // 八卦护体：他脚下一圈八门（每 spin 秒整圈顺时针转一格），你站在他哪个方位，打他的伤害就乘那道门的 mul；他发愣（破阵、识破空城）时失效
    guard: { spin: 4, R: 130, mul: { 生: 1, 开: 0.8, 休: 0.8, 景: 0.55, 伤: 0.4, 惊: 0.4, 杜: 0.3, 死: 0.3 } },
    // 石兵：他不放大招、你也没困在八门阵里时，每 every 秒往你身边落 count 块乱石（先亮落点，每块扣你生命上限的 pct）
    stones: { every: 3.5, count: 3, r: 70, delay: 1.0, spread: 160, pct: 0.06 },
    lamps: { n: 7, chan: 10, lampHp: 0.035, perLamp: 0.1, span: 760, cap: 0.5, near: 220 },
  },
  // 神魔将（generals 里带 camp 的：魔将 mo、神将 shen）的通用规则，以后新出的神魔将带上 camp 就自动适用
  //   late：无尽里吃多少后期加速（普通名将全额）；shield：护盾最多是最大血量的这么多（黑血守护、护甲都算）；heal：回血每秒最多回最大血量的这么多（青龙回春这类）
  camp: { late: 0.8, shield: 0.25, heal: 0.003 },
  // 魔吕布、魔貂蝉两人一组的规则
  //   黑血守护：代替护甲，等于最大生命的 shield，打破后僵直、易伤，不会自己回（搭档魂缚时回满）；两人相距 linkR 以内时「黑血相连」，都减伤 linkDr——拉开打更快
  //   魂缚：一人血量打空不会死，变成残魂（打不动），另一人狂怒（出招间隔 ×rage、黑血至少回到 rageShield），但孤身一人受到的伤害 +lonely；down 秒内把另一人也打空，两人一起倒下，否则残魂以 revive 的血量复活
  //   黑血侵蚀：被他们打中后 bleed 秒内，你的回血效果只剩 bleedHeal
  //   组合大招：两人都在、都没被魂缚时，每 every 秒轮流放一招；合计血量低于一半时必放一次「无双·倾城」。只有组合大招有特写（assets/cutins/combo_<id>.png）
  twin: {
    shield: 0.4, linkDr: 0.4, linkR: 360, down: 25, lonely: 0.5, revive: 0.4, rage: 0.7, rageShield: 0.5, bleed: 4, bleedHeal: 0.4, every: 22,
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
    liubei: { death: '云长……翼德……大哥来了……', ult: { taoyuan: '桃园结义，生死与共！', dilu: '的卢，今日厄矣，可努力！', rende: '百姓归心，此乃吾之盾！' } },
    sunquan: { death: '父兄……仲谋……愧对江东……', ult: { shehu: '虎来了，看你往哪跑！', shuishi: '江东水师，万弩齐发！', zhiheng: '子布、公瑾，助我！' } },
    pangtong: { death: '落凤坡……原来，是我的坡……', ult: { lianhuan: '这一条连环，可是我亲手献的！', fenghuo: '凤鸣九天，火燎八荒！', luofeng: '落凤坡下……今日落的，是你！' } },
    // 天刀、温酒斩、玉泉显圣先借原来三句的录音（字幕跟录音一致）；新台词在提示词页第 32 批，录好后换成新的
    shenguanyu: { death: '玉泉山下……关某，终得解脱……', ult: { tiandao: '青龙出海，翻江倒海！', wenjiu: '一关一将，挡我者斩！', shuiyan: '水淹七军，尔等休走！', xiansheng: '威震华夏，谁与争锋！', qianli: '千里走单骑——赤兔，随我来！' } },
    modongzhuo: { death: '奉先……奉先何在……', ult: { fenshao: '烧！给我烧个干净！', suolian: '天子的锁链，谁也挣不脱！', jiuchi: '酒池肉林，与孤同醉！', mowang: '魔王临世，天下皆奴！' } },
    shenzhuge: { death: '悠悠苍天，曷此其极……', ult: { bamen: '八门已闭，生门只有一扇。', bamen2: '八阵随天转，生门亦无常。', tianfu: '八阵随天转，生门亦无常。', guanxing: '夜观天象，星落如雨。', kongcheng: '城门大开，请君入城。', rangxing: '七星灯明，吾命未绝！', pozhen: '好！竟能识破生门……' } },
    caocao: { death: '大业未竟……孤……不甘……', ult: { duange: '对酒当歌，人生几何！', hengshuo: '横槊赋诗，固一世之雄也！', mengzhong: '吾好梦中杀人……', mengzhong_wake: '谁！' } },
    caiwenji: { death: '十二年……终于……能归汉了……', ult: { shiba: '胡笳一曲，十八拍断肠。', beifen: '悲愤成诗，字字是血！', guihan: '胡笳声里，我要归汉！' } },
    huangzhong: { death: '老夫……终究是……老了……', ult: { baibu: '百步之外，取你首级！', dingjun: '定军山下，斩将夺旗！', laodang: '黄忠在此，谁敢言老！' } },
    chengyuanzhi: { death: '大贤良师……救我……', ult: { axe: '开山！给我破！', mob: '黄巾儿郎，随我杀！' } },
    zhangbao: { death: '地公……也会死么……', ult: { beans: '撒豆成兵，起！', bolt: '妖雷，落！' } },
    zhangjiao: { death: '黄天……终究未立……', ult: { thunder: '天公雷罚，降！', host: '黄天当立，众生听令！', pool: '雷池之中，寸步难行！' } },
    huaxiong: { death: '关外……竟有此等人物……', ult: { leap: '斩将刀下，不留全尸！', whirl: '西凉狂刃，看你往哪逃！' } },
    lubu: { death: '我……天下无双……', ult: { chitu: '赤兔，随我踏平此阵！', yuanmen: '辕门射戟，一箭定乾坤！', wushuang: '画戟所向，片甲不留！' } },
    diaochan: { death: '妾身……终是一场空……', ult: { dance: '闭月一舞，与君同醉。', charm: '将军，看着妾身。', lianhuan: '一环扣一环，君已入局。' } },
    zhenji: { death: '洛水……好冷……', ult: { jinghong: '惊鸿照影，冰墙四起！', frost: '洛水寒川，冻彻君骨。', icering: '冰封千里，无处可逃。' } },
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

  // 图鉴里的招式介绍：同一位名将斩够 codexMoves.need 次才显示（群友瓜瓜的建议）。
  // 「平时」那一行按 generals 里的 attacks 和属性自动写（atk、el）；每个大招一句介绍招式本身、不写躲法（ults，id 和 generals 里的 ults 一致）；note 是这位名将的特殊规则
  codexMoves: {
    need: 5,
    atk: { cleave: '扇形劈砍', charge: '冲锋', charge3: '连冲', slam: '砸地', summon: '召兵', volley: '扇形飞射', meteor: '落点轰击', roar: '怒吼震退', hook: '甩铁链钩人' },
    el: { fire: '火属性，打中会灼烧', ice: '冰属性，打中走不快', thunder: '雷属性，打中会麻痹', wind: '风属性，打中会被吹开', dark: '幽冥属性，打中会被噬魂、暂时不能回血' },
    gens: {
      chengyuanzhi: { ults: { axe: '跃起抡斧砸下，落点先亮红圈。', mob: '抡着斧头原地转圈，一边转一边追着你。' } },
      zhangbao: { ults: { beans: '撒出金豆，化作一圈黄巾兵把你围住。', bolt: '妖雷一道接一道落下，落点追着你。' } },
      zhangjiao: { ults: { thunder: '天雷一道接一道落下，落点追着你。', host: '召来一圈黄巾兵把你围住。', pool: '在你身边布下一圈石阵落雷，外圈先落、内圈后落。' } },
      huaxiong: { ults: { leap: '跃起挥刀劈落，落点先亮红圈。', whirl: '舞刀旋转，一边转一边追着你，周身刀风。' } },
      lubu: { ults: { chitu: '骑赤兔沿预警线连冲三次。', yuanmen: '射出一排带光的大箭，正中一支更粗更快。', wushuang: '巨型戟刃一记劈砍，再接两次追斩。' } },
      diaochan: { ults: { dance: '原地起舞，几条樱花旋臂一圈圈转着向外扩散。', charm: '粉色的圈往里收拢，圈里的人被迷住，身不由己走向她。', lianhuan: '漫天樱花落下，落点追着你一朵朵绽开。' } },
      zhenji: { ults: { jinghong: '沿 S 形路线从你身边滑过，身后的水痕片刻后冻成冰墙。', frost: '脚下寒气聚成一圈，圈里的人被冻住。', icering: '冰面从她脚下铺开、走在上面会打滑，冰缝里刺出冰棱，最后整片冰面从她脚下往外冻实。' } },
      sunshangxiang: { ults: { feishan: '飞扇向四面八方掷出，再旋转着飞回来。', bingshu: '书页在你四周围成一圈、留一道缺口，然后一齐朝圈心飞来。', xiaoji: '狂暴：出手更快、受伤减半。' } },
      yanliang: { ults: { baima: '骑白马沿预警线冲锋。', sweep: '连着劈出几刀大扇形。', flag: '巨刀一记劈砍，再接追斩。' } },
      wenchou: { ults: { rain: '射出一排大箭。', pierce: '在你两侧来回连冲突刺。', blood: '狂暴：出手更快、受伤减半。' } },
      zhangfei: { ults: { roar: '超大范围的怒吼，震退加减速。', lance: '长距离的直线突刺。', rage: '狂暴：出手更快、受伤减半。', duanqiao: '连跺三脚，每一脚都让地面沿五个方向裂开。' } },
      zhaoyun: { ults: { seven: '在你两侧来回穿插冲锋。', flurry: '朝身前扇形快速连刺。', longpan: '白龙绕着你盘成一圈、越收越紧，龙身留一道缺口，最后龙头扎穿圈心。' } },
      dianwei: { ults: { storm: '双戟向八方掷出，再飞回身边。', quake: '跃起砸地，落点先亮红圈。', elai: '狂暴：出手更快、受伤减半。', gunshi: '抱起巨石砸出去，石头满地乱滚，撞到画面边上还会弹回来。' } },
      guanyu: { ults: { dragon: '一道巨大的青龙刀气直线推进。', five: '连斩几刀大扇形。', spiral: '青龙之气螺旋落下。' } },
      zhugeliang: { ults: { fire: '三排火线依次炸开。', maze: '在你周围布下一圈石阵，阵中落石。', wind: '大风推着你，火箭从上风处射来。' } },
      zhouyu: { ults: { chibi: '几排火线依次炸开。', qu: '音波一圈圈扩散，每圈留一道缺口。', chain: '在你周围布下一圈落火，外圈先落、内圈后落。' } },
      dongzhuo: { ults: { suohun: '铁链向四面八方甩出，钩中就拖到他身前。', tianluo: '以他为中心画下一个插满铁桩的黑圈，时间一到，圈里的人被铁链捆住拖过去。', baozheng: '抡起两颗流星锤绕身横扫，天上不停垂下铁链。' } },
      daqiao: { ults: { liandeng: '放出一排莲灯，慢慢追着你飘，靠近了点燃引信炸开。', chunchao: '远处升起一道水墙横扫过来，莲灯标着一处缺口。', xuanwo: '你脚下卷起大漩涡，把你往中心拖，中心不停伤人。' } },
      xiaoqiao: { ults: { zhiyuan: '几只纸鸢升上天，地上的影子追着你跑，停下片刻后俯冲炸开。', dieying: '在你四周来回瞬移，每到一处留下一道蝶影，蝶影随后沿直线斩向你。', tongque: '一大圈蝴蝶围住你、边转边往里收，留两处缺口，收到最小时整圈炸开。' } },
      machao: { ults: { tieqi: '你身边铺开几条平行的冲锋道，一队队铁骑英灵依次冲过，有一条是空的。', huanqi: '骑马绕你跑一圈、留下一圈雷火，再从圈外三次冲过圈心。', shenwei: '跃上半空，三杆雷枪接连砸向你的位置，落地向八方炸出雷光。' } },
      guojia: { ults: { shisheng: '你脚下铺开一张棋盘，黑格白格轮流炸开鬼火。', liaodi: '一个接一个的鬼火落点，砸向你接下来要走到的地方。', guimou: '四下一片漆黑，只看得见身边一小圈，鬼火从黑暗里飘出来找你。' } },
      xiahoudun: { ults: { ganglie: '横刀格挡，受伤减半、每挨一下记一层怒，架势一收，按层数向四面劈出血色刀光。', danqi: '立起一圈枪阵把你们俩关在里面，他贴身连出几刀。', danjing: '冷箭射中左眼，拔矢啖睛后进入血怒（更快、受伤减半、打中你会回血），再把箭朝你掷回来。' } },
      simayi: { ults: { sishi: '你脚下和身边接连裂开孤坟，喷出鬼火，几座坟里爬出死士。', langgu: '头顶睁开一双狼眼，身前身后两道目光绕着他转。', yizhong: '倒地化作黑烟，你身边立起一圈疑冢，他藏在其中一座；打破真冢会逼他出来，打破假冢会放出死士，时间一到他从真冢里破土而出。' } },
      huatuo: { note: '不出手，只给自己回血；藏在药庐里，打掉药庐他才现身。', ults: { qingnang: '翻开青囊书引导回血，引导中挨够伤害会被打断。', yaoding: '身边立起一圈药鼎给他回血，药鼎被打碎时药雾会给你回血。', guagu: '大回一口血、清掉身上的负面状态，之后元气大伤一阵：多受伤害、回血减半。' } },
      molubu: { note: '和魔貂蝉一起出现：两人靠得近都减伤；一人打空会变残魂，限时内另一人没倒下，残魂就会复活。', ults: { hengjiang: '巨型戟刃一记劈砍，再接追斩。', tayan: '骑魔赤兔沿预警线冲锋。' } },
      modiaochan: { note: '和魔吕布一起出现：两人靠得近都减伤；一人打空会变残魂，限时内另一人没倒下，残魂就会复活。', ults: { meiying: '血色的圈往里收拢，圈里的人被迷住，身不由己走向她。', bianhua: '彼岸花漫天落下，落点追着你绽开。' } },
      shenzhaoyun: { note: '四色龙魂轮换：青龙回血、赤龙出手更快、白龙会闪开攻击、玄龙挡下伤害；第一次打空血会绝境复生。', ults: { yinlong: '在你两侧来回冲锋，冲过的路线留下一道枪痕，随后炸开。', changban: '先绕你骑一圈画出银环，再沿五角星的五条边连冲，枪痕和星心最后一起炸开。', qiangyu: '预判你要走到哪，一排排银枪在你前方从天而降。', sixiang: '红、橙、青、紫四条龙从四个方向依次横扫你所在的位置。' } },
      huangzhong: { ults: { baibu: '红线锁定你、跟着你走，定住片刻后一箭射穿整条线，一箭比一箭快。', dingjun: '一圈钉地箭把你围住、留一个口子，再拔刀从远处冲来一斩。', laodang: '狂暴：出手更快，火箭雨落在你周围。' } },
      caiwenji: { ults: { shiba: '站定吹奏胡笳：单数拍震内圈、双数拍震外圈；每第 6 拍全场大震，只有几个金色音符圈不受伤。', beifen: '一句句墨字从她身边分几路旋转着往外飞。', guihan: '几条冲锋道依次冲过胡骑，有一条是空的。' } },
      caocao: { ults: { duange: '歌声一圈圈扩散，每圈一道缺口，被唱中会醉得东倒西歪，全场小兵士气大振。', hengshuo: '持槊直线冲锋，冲过的路上依次落下几道雷。', mengzhong: '席地而卧，有人靠近或打中他，就闪到你身后一刀；睡完没被惊扰会回血。' } },
      liubei: { ults: { taoyuan: '升起关羽、张飞的虚影：张飞沿预警线冲向你，关羽随后劈出一道青龙刀气。', dilu: '骑的卢跃向你，落地砸一圈，再向外扩一道有缺口的冲击波。', rende: '身边的小兵化作光飞到他身上，变成护盾。' } },
      sunquan: { ults: { shehu: '放出一头猛虎沿预警线扑向你，跑出画面后折返一次；被扑中会冻得走不快。', shuishi: '画面一侧泊着战船，几排连弩依次横扫全屏，每排留几道空隙。', zhiheng: '张昭、周瑜的虚影立在他两侧：张昭给他加护盾，周瑜往你脚下放火；两道虚影都在时孙权打不动。' } },
      shenguanyu: { note: '千里走单骑：第一次打空血不会死，骑上赤兔绕着你冲出重围，几秒后复生；之后一直骑着赤兔，走得更快、大招更勤。', ults: { tiandao: '画面一暗，天上悬着一把巨大的青龙偃月刀，地上月牙形的刀影跟着你走，定住后劈下，连劈三刀；往月牙里面或外面躲。最后他抡刀转一整圈，贴到他脚下或跑远才躲得开。刀落处留下地裂，别踩。', wenjiu: '时间静止，画面变灰，小兵和飞箭都定住。上方的酒爵冒完热气之前，画面上会一道道亮出六条细红线，最后一条穿过你脚下；热气一散六刀齐落，找个不在线上的地方站好。', shuiyan: '大水从画面一侧漫过来，水里走不快、不断挨打，只有你身边几块高地是干的。', xiansheng: '血过半后画面后方升起巨大的关圣法相，一直到他倒下：隔几秒就举刀劈下半个画面大的扇形；隔一会儿还从他身上推出一圈威压，圈上有个缺口，站进缺口或闪现穿过去。' } },
      pangtong: { ults: { lianhuan:'铁索把你和身边几个小兵连在一起，拖着它们走不快；片刻后火从小兵那头顺着铁索烧过来。', fenghuo: '一只火凤沿预警线横穿画面，身后留下一道火路；连飞两趟，第二趟换个方向。', luofeng: '血过半后把你困进一条山道，两侧是峭壁；箭雨从身后一路往前压，前面还不断落下乱箭。' } },
      modongzhuo: { note: '120 级时在西南方的郿坞里；黑血护盾，回血有上限。', ults: { fenshao: '四面火墙往里推，只留一条安全走廊，每一轮走廊换个地方。', suolian: '锁链从画面外的天上依次射向你，锁中就被拖到他跟前，落点烧起一片火。', jiuchi: '在你身边泼下几个毒酒池，踩进去走不快、掉血；他会泡在池里回血，池心的酒瓮打碎池子就干了。', mowang: '体型变大、从此狂暴，每掉一成血就召一队西凉铁骑冲阵。' } },
      shenzhuge: { note: '八卦护体：你站在他哪个方位，打他的伤害就按那道门打折，生门不打折；第一次打空血会点起七星灯续命。', ults: { bamen: '把你困进八门阵：从生门出去就破阵，他会发愣、受伤更多；走别的门各有惩罚。', guanxing: '北斗七星一颗颗砸向你要走到的地方。', kongcheng: '原地抚琴，琴声把你往外推；走进他身边站够两秒就识破空城，没识破伏兵四起。', tianfu: '以他为中心把地面分成八格，除了生门，其余七格顺时针接连炸开。' } },
    },
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
      // 武将多了（2026-11-03）：pool 的名将每局抽 n 位，按下面的先后放进 slots 的时间（彼此隔 40 秒，上一位倒下后仍至少隔 bossGap）；没抽到的进无尽先出
      draw: { n: 3, slots: [45, 85, 125] },
      events: [
        { t: 20, type: 'special', bid: 'xiliangying', dx: -820, dy: -560 }, // 西凉营地出现在左上方，什么时候去打都行
        { t: 30, type: 'special', bid: 'zuoxian', dx: 820, dy: 560 }, // 左贤王帐出现在右下方（207 年文姬归汉），什么时候去打都行
        { t: 45, type: 'boss', id: 'dianwei', pool: true },
        { t: 75, type: 'boss', id: 'xiahoudun', pool: true }, // 下邳征吕布时被流矢射中左眼（198 年）
        { t: 105, type: 'boss', id: 'yanliang', pool: true },
        { t: 140, type: 'ambush', enemy: 'cavalry', count: 24, text: '河北铁骑' },
        { t: 170, type: 'boss', id: 'wenchou', pool: true },
        { t: 210, type: 'boss', id: 'zhenji', pool: true },
        { t: 245, type: 'boss', id: 'guojia', pool: true },
        { t: 165, type: 'boss', id: 'guanyu', final: true },
      ],
    },
    {
      id: 'chibi', name: '第四章 · 赤壁之战', sub: '公元 208 年 · 博望坡 → 长坂坡 → 甘露寺 → 赤壁',
      clear: '火烧赤壁',
      elites: { captain: 0, brute: 0, crossbow: 0, sorcerer: 0 },
      ground: { bg: '#1e231f', grass: 'rgba(96,136,104,0.42)', blot: 'rgba(40,74,96,0.24)', flag: 'rgba(170,50,40,0.5)', reeds: true },
      waves: [
        { t: 0, rates: { foot: 3.8, shield: 0.6, archer: 0.6, cavalry: 0.8 } },
        { t: 80, rates: { foot: 4.4, shield: 0.7, archer: 0.8, cavalry: 1.0 } },
        { t: 140, rates: { foot: 4.8, shield: 0.8, archer: 0.9, cavalry: 1.2 } },
      ],
      draw: { n: 3, slots: [45, 85, 125] }, // 同第三章：pool 里抽 3 位
      events: [
        { t: 20, type: 'qiaofu' }, // 乔府出现在右下方，什么时候去打都行
        { t: 45, type: 'boss', id: 'zhugeliang', pool: true },
        { t: 80, type: 'special', bid: 'zhong', dx: -820, dy: -560 }, // 孤冢出现在西北方，什么时候去打都行
        { t: 105, type: 'boss', id: 'zhangfei', pool: true },
        { t: 150, type: 'ambush', enemy: 'foot', count: 48, text: '曹军南下' },
        { t: 165, type: 'boss', id: 'zhaoyun', pool: true },
        { t: 210, type: 'boss', id: 'sunshangxiang', pool: true },
        { t: 240, type: 'boss', id: 'huangzhong', pool: true }, // 赤壁之后刘备取长沙，老将黄忠归附
        { t: 265, type: 'boss', id: 'pangtong', pool: true }, // 凤雏献连环，紧接着火烧赤壁（放在最后，老存档的 evIdx 不错位）
        { t: 165, type: 'boss', id: 'zhouyu', final: true },
      ],
    },
    {
      id: 'sanfen', name: '第五章 · 三分天下', sub: '公元 219–220 年 · 汉中称王，魏武挥鞭', music: 'endless', // 还没有本章的配乐：先用天下三分那首
      clear: '三分天下',
      elites: { captain: 0, brute: 0, crossbow: 0, sorcerer: 0 },
      ground: { bg: '#221e1c', grass: 'rgba(120,112,90,0.4)', blot: 'rgba(30,20,40,0.22)', flag: 'rgba(110,80,160,0.5)' },
      waves: [
        { t: 0, rates: { foot: 4.8, shield: 0.8, archer: 0.9, cavalry: 1.2 } },
        { t: 60, rates: { foot: 5.2, shield: 0.9, archer: 1.0, cavalry: 1.4 } },
      ],
      events: [
        { t: 20, type: 'ambush', enemy: 'hubao', count: 12, text: '虎豹骑 · 天下骁锐' },
        { t: 35, type: 'boss', id: 'liubei' }, // 219 年汉中称王
        { t: 75, type: 'boss', id: 'sunquan' }, // 219 年袭取荆州
        { t: 90, type: 'ambush', enemy: 'foot', count: 50, text: '青州兵' },
        { t: 115, type: 'boss', id: 'caocao', final: true },
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
        { id: 'g_fudai', name: '福袋', icon: '袋', slot: '饰品', effects: { regen: 0.22, meatMul: 0.05 }, desc: '每秒回复 +0.22、肉包回复 +5%/级',
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
      cainv: [
        { id: 'g_yaoqin', name: '琴', icon: '琴', slot: '武器', effects: { startDmg: 0.1 }, startLvEvery: 3, desc: '瑶琴伤害 +10%/级；每 3 级开局瑶琴 +1 级',
          look: '才女怀抱的古琴（七弦琴）', tiers: ['桐木琴', '杉木素琴', '漆面七弦琴', '蕉叶琴', '绿绮', '焦尾琴', '号钟', '绕梁', '九霄环佩'] },
        { id: 'g_yiqun', name: '衣裙', icon: '裙', slot: '护甲', effects: { allyHp: 0.04, maxHp: 6 }, desc: '随从血量 +4%、生命上限 +6/级',
          look: '才女的衣裙，从素布襦裙到霞帔羽衣', tiers: ['素布襦裙', '青衣长裙', '月白襦裙', '绣花罗裙', '云锦长裙', '霞帔', '凤纹霞帔', '流光羽裙', '九天云裳'] },
        { id: 'g_yuzan', name: '玉簪', icon: '簪', slot: '饰品', effects: { speedMul: 0.015, allyDmg: 0.03 }, desc: '移动速度 +1.5%、随从伤害 +3%/级',
          look: '才女的发饰和随身香囊', tiers: ['布香囊', '木簪', '银簪', '玉簪', '珠花步摇', '翡翠簪', '凤钗', '金凤步摇', '九凤朝阳钗'] },
      ],
    },
  },

  // 封神 / 入魔：局外成长，专门对付神魔将（generals 里带 camp 的）。封神用魔血、只对魔将生效；入魔用神魂、只对神将生效，两条线词条一样，普通名将不受影响。
  // 魔血、神魂：打赢一轮掉 win 份；一局结束时他们还没倒下，按打掉的血量比例给 0 ~ lose 份；也能用 gold 金币换 1 份（只能金币换货币）。
  // levels：第 n 级解锁的词条，后面写的同名词条覆盖前面的：dmg 对它的伤害加成；shield 打它护盾的伤害倍率；pct 每秒结算一次、额外扣它最大血量的比例（一秒里打一下和打两百下都只算一次）；
  //   hurt 受它的伤害减少；heal 它回血、复生回复的倍率；time 它倒地、复生的时间缩短。9 级以后还能升：每级伤害再 +late.dmg，价格每级 ×late.cost
  campUp: {
    lines: [
      { id: 'feng', camp: 'mo', name: '封神', cur: 'moxue', curName: '魔血', vs: '魔将', who: '魔吕布、魔貂蝉、魔董卓', rgb: '255,90,100' },
      { id: 'ru', camp: 'shen', name: '入魔', cur: 'shenhun', curName: '神魂', vs: '神将', who: '神赵云、神诸葛、神关羽', rgb: '170,215,255' },
    ],
    win: 3, lose: 2, gold: 500,
    cost: [3, 5, 8, 12, 17, 23, 30, 38, 48],
    levels: [
      { dmg: 0.15, text: '伤害 +15%' },
      { shield: 1.3, text: '破护：对其护盾伤害 ×1.3' },
      { pct: 0.003, text: '每秒额外扣其最大血量 0.3%' },
      { hurt: 0.1, text: '受其伤害 -10%' },
      { dmg: 0.3, text: '伤害 +30%' },
      { heal: 0.5, time: 0.2, text: '禁疗：其回血、复生回复减半，倒地、复生时间 -20%' },
      { pct: 0.006, text: '每秒额外扣其最大血量 0.6%' },
      { shield: 1.6, hurt: 0.2, text: '破护：对其护盾伤害 ×1.6，受其伤害 -20%' },
      { dmg: 0.5, pct: 0.01, heal: 0.3, text: '伤害 +50%，每秒额外扣其最大血量 1%，禁疗：其回复只剩三成' },
    ],
    late: { dmg: 0.05, cost: 1.12 },
  },

  // 神魔技：击败神魔将解锁的主动技能（玩家说后期只能看、打神魔不知道有什么用）。一个槽位在闪现旁边，电脑按 E；
  //   开局前在「封神 · 入魔」里选装一个，一局只能带一个，战役里也能用。不用瞄准：以自己为中心，或自动冲向最近的名将。
  //   gid：击败这位神魔将一次就解锁；cur：升级用的货币（魔将的用魔血、神将的用神魂）；
  //   need：升到第 2–5 级各要累计击败这位神魔将几次；cost：升到第 2–5 级各花多少货币；levels：每级数值，主要降冷却、加范围，伤害不怎么涨（免得一键清屏）
  smj: {
    need: [2, 4, 7, 12], cost: [3, 6, 10, 15],
    skills: {
      // 魅惑：r 以内的小兵倒戈替你打 dur 秒（最多 max 个，到时散去）；名将、精英定住 root 秒
      meihuo: { name: '魅惑', icon: '魅', gid: 'modiaochan', cur: 'moxue', rgb: '255,120,190', desc: '身边的小兵倒戈替你作战，名将和精英被定住片刻。',
        levels: [{ cd: 40, r: 260, dur: 6, max: 20, root: 1.5 }, { cd: 37, r: 280, dur: 6, max: 22, root: 1.5 }, { cd: 34, r: 300, dur: 6.5, max: 24, root: 1.8 }, { cd: 31, r: 330, dur: 7, max: 27, root: 1.8 }, { cd: 28, r: 360, dur: 7.5, max: 30, root: 2 }] },
      // 天崩：以自己为中心一记横扫（半径 r），把敌人远远震飞、晕 stun 秒；名将、精英定住 root 秒
      tianbeng: { name: '天崩', icon: '崩', gid: 'molubu', cur: 'moxue', rgb: '255,70,60', desc: '以自己为中心一记横扫，敌人被远远震飞、晕住；名将和精英被震住片刻。',
        levels: [{ cd: 40, r: 240, dmg: 160, stun: 2, root: 1 }, { cd: 37, r: 260, dmg: 175, stun: 2, root: 1 }, { cd: 34, r: 280, dmg: 190, stun: 2.2, root: 1.2 }, { cd: 31, r: 305, dmg: 205, stun: 2.4, root: 1.2 }, { cd: 28, r: 330, dmg: 220, stun: 2.5, root: 1.5 }] },
      // 七探：朝最近的名将（没有就朝敌人最多处）冲刺最多 len，宽 w 一路上的敌人都挨一下；冲刺中受到的伤害减少 dr（不是无敌）
      qitan: { name: '七探', icon: '探', gid: 'shenzhaoyun', cur: 'shenhun', rgb: '200,225,255', desc: '朝最近的名将冲刺，穿过的敌人全部受伤；冲刺中受到的伤害 -80%。',
        levels: [{ cd: 40, len: 420, w: 110, dmg: 140, dr: 0.8 }, { cd: 37, len: 450, w: 115, dmg: 150, dr: 0.8 }, { cd: 34, len: 480, w: 120, dmg: 160, dr: 0.8 }, { cd: 31, len: 520, w: 125, dmg: 175, dr: 0.8 }, { cd: 28, len: 560, w: 130, dmg: 190, dr: 0.8 }] },
      // 八阵图：脚下落一座阵（半径 r，留 dur 秒），阵里的敌人减速 slow、受到的伤害增加（和破甲后易伤一样 +30%）
      bazhen: { name: '八阵图', icon: '阵', gid: 'shenzhuge', cur: 'shenhun', rgb: '255,214,120', desc: '脚下落一座八阵，阵里的敌人走不快、受到的伤害增加。',
        levels: [{ cd: 40, r: 220, dur: 8, slow: 0.5 }, { cd: 37, r: 235, dur: 8, slow: 0.5 }, { cd: 34, r: 250, dur: 8.5, slow: 0.55 }, { cd: 31, r: 270, dur: 9, slow: 0.55 }, { cd: 28, r: 300, dur: 10, slow: 0.6 }] },
      // 天子锁链：r 以内的敌人被锁链拽到你身前，挨 dmg 一下、锁住 stun 秒；名将只拽动 boss 的距离
      suolian: { name: '天子锁链', icon: '锁', gid: 'modongzhuo', cur: 'moxue', rgb: '255,90,50', desc: '把身边一大片敌人用锁链拽到你身前锁住；名将只拽得动一点。',
        levels: [{ cd: 40, r: 560, dmg: 60, stun: 0.8, boss: 0.25 }, { cd: 37, r: 600, dmg: 66, stun: 0.9, boss: 0.25 }, { cd: 34, r: 640, dmg: 72, stun: 1, boss: 0.3 }, { cd: 31, r: 690, dmg: 80, stun: 1.1, boss: 0.3 }, { cd: 28, r: 740, dmg: 88, stun: 1.2, boss: 0.35 }] },
      // 武圣显灵：武圣法相在你身后显灵，朝敌人最密处劈出一道巨型扇形刀光（半径 R、半角 half）；劈中的名将、精英破甲 dur 秒（受伤 +champion.breakVuln）
      xianling: { name: '武圣显灵', icon: '圣', gid: 'shenguanyu', cur: 'shenhun', rgb: '90,240,170', desc: '武圣法相在你身后显灵，朝敌人最密处劈出一道巨大的扇形刀光；劈中的名将和精英破甲，片刻内受到的伤害增加。',
        levels: [{ cd: 40, R: 460, half: 0.8, dmg: 200, dur: 5 }, { cd: 37, R: 490, half: 0.82, dmg: 220, dur: 5 }, { cd: 34, R: 520, half: 0.85, dmg: 240, dur: 5.5 }, { cd: 31, R: 560, half: 0.88, dmg: 260, dur: 6 }, { cd: 28, R: 600, half: 0.9, dmg: 290, dur: 6.5 }] },
    },
  },

  // 神兵：击败名将时小概率掉落的专属兵器（奖励里出现一张金色卡）。
  // 拿到后悬浮在身边，定时自动放出这位名将的招牌招式。再次掉落同一件 → 升级（伤害 +30%、冷却 -6%）。
  // 伤害还会随你的等级成长：每级 +3.5%。iconFrom 是还没有神兵美术图时借用的兵器图标。
  shenbingDrop: { base: 0.12, pity: 0.05, max: 0.45 }, // 基础掉率 12%，每次没掉 +5%，最高 45%，掉了就重置
  // 神兵融合：同一组名将的神兵凑齐（members 每一项各有一件；神将、魔将的神兵算本人），就合成一件融合神兵 sb：
  //   原来几件消失、等级相加，只放这一招合击（伤害约是几件加起来的 1.3 倍）。融合后再掉组里任何一位的神兵，融合神兵 +1 级。
  //   身上已经有这一组的神兵、还没凑齐时，组里还没到手的那几位掉神兵的几率 ×boost（上限也 ×boost）
  fusion: {
    boost: 2,
    groups: [
      { id: 'wuhu', name: '五虎上将', sb: 'fuse_wuhu', members: [['guanyu', 'shenguanyu'], ['zhangfei'], ['zhaoyun', 'shenzhaoyun'], ['machao'], ['huangzhong']] },
      { id: 'yuexia', name: '吕布 · 貂蝉', sb: 'fuse_yuexia', members: [['lubu', 'molubu'], ['diaochan']] },
      { id: 'wolong', name: '卧龙凤雏', sb: 'fuse_wolong', members: [['zhugeliang', 'shenzhuge'], ['pangtong']] },
      { id: 'huangtian', name: '黄天当立', sb: 'fuse_huangtian', members: [['zhangjiao'], ['zhangbao'], ['chengyuanzhi']] }, // 黄巾：张角、张宝、程远志（和成就「黄天当立」同一组）
    ],
  },
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
    caiwenji: { name: '胡笳十八拍', icon: '谱', iconFrom: 'shibapai', rgb: '160,175,255', cd: 6, type: 'beatStorm', dmg: 70, beats: 6, beat: 0.2, r1: 180, r2: 360,
      desc: '展开《胡笳十八拍》曲谱：六拍连奏，内外圈轮流震荡，最后一拍全圈齐震、把敌人震开。' },
    caocao: { name: '倚天剑', icon: '剑', iconFrom: 'yitian', rgb: '200,170,255', cd: 5.5, type: 'yitianSword', dmg: 80, len: 560, w: 80, bolts: 3, boltR: 70, allyBolt: 0.3,
      desc: '倚天剑悬在身边：定时斩出一道紫金剑气，沿途劈下三道雷；随从每次出手有 30% 几率引来一道雷。' },
    liubei: { name: '雌雄双股剑', icon: '剑', iconFrom: 'shuanggu', rgb: '170,235,150', cd: 5.5, type: 'twinSwords', dmg: 85, len: 480, w: 70, allySword: 0.25, swordLen: 260, swordDmg: 0.4,
      desc: '雌雄双剑悬在身边：定时飞到敌群最密处交叉斩出一个“X”。随从每次出手有 25% 几率带出一道剑气。' },
    // 紫髯古锭刀：绕身横扫一圈寒光（R），砍中的小兵冻住 freeze 秒；每第 tiger 刀再放出一头冰虎，扑穿一整条线（len、w，伤害 ×tigerDmg）
    sunquan: { name: '紫髯古锭刀', icon: '刀', iconFrom: 'guding', rgb: '160,205,255', cd: 5, type: 'iceSweep', dmg: 90, R: 250, freeze: 1, tiger: 3, len: 720, w: 90, tigerDmg: 1.3,
      desc: '古锭刀悬在身边：定时绕身横扫一圈寒光，砍中的小兵冻住 1 秒；每第 3 刀还放出一头冰虎，扑穿一整条线上的敌人。' },
    // 涅槃凤翎：凤翎化作一只火凤，从你身边穿过敌人最密处飞出 len 远（宽 w），沿途的敌人受伤；身后每隔 trailGap 留下一团火（半径 trailR，每 0.4 秒烧 trail 倍伤害，留 trailT 秒）
    pangtong: { name: '涅槃凤翎', icon: '凤', iconFrom: 'fengling', rgb: '255,140,60', cd: 6, type: 'phoenixSweep', dmg: 95, len: 1000, w: 110, speed: 1400, trailR: 60, trail: 0.2, trailT: 2.5, trailGap: 80,
      desc: '凤翎化作一只火凤，从身边穿过敌人最密处飞出，沿途的敌人全部受伤，身后留下一道烧着的火路。' },
    // 冷艳锯：打倒神关羽直接到手（再打一次就升级）。绕身横扫一整圈青龙刀光（半径 R）；每第 every 刀再朝四面斩出 count 道青龙刀气（长 len、宽 w，伤害 ×wave）
    shenguanyu: { name: '冷艳锯', icon: '锯', iconFrom: 'qinglong', rgb: '90,240,170', cd: 5.5, type: 'coldBlade', dmg: 95, R: 290, every: 3, count: 4, len: 760, w: 80, wave: 1.2,
      desc: '冷艳锯悬在身边：定时绕身横扫一整圈青龙刀光；每第 3 刀再朝四面斩出四道青龙刀气，贯穿一路上的敌人。' },
    // —— 融合神兵（见上面的 fusion；fusion 是哪一组）。伤害照样按 sbDmg 算，等级是并进来的几件相加 ——
    // 五虎齐出：五位上将的英魂从五个方向冲过敌人最密处（五条线交在那里，每条长 len、宽 w），沿途的敌人每条挨一下；各人各色，前后差 gap 秒
    fuse_wuhu: { name: '五虎神兵', icon: '虎', iconFrom: 'qinglong', rgb: '255,215,110', cd: 7, type: 'fiveTigers', dmg: 105, len: 900, w: 100, speed: 1500, gap: 0.1, fusion: 'wuhu',
      desc: '五虎上将的神兵合而为一：五位上将的英魂从五个方向同时冲过敌人最密处，交汇处的敌人连挨五下。' },
    // 月下连环：花扇先在敌人最密处迷住一圈小兵（半径 R，定住 stun 秒，花瓣伤害 dmg × petal），gap 秒后画戟朝那里劈出一道血色巨月（半径 moonR、半角 half），被迷住的受双倍伤害
    fuse_yuexia: { name: '凤仪双绝', icon: '仪', iconFrom: 'halberd', rgb: '255,110,160', cd: 6, type: 'moonCharm', dmg: 100, R: 230, stun: 1.6, petal: 0.3, gap: 0.6, moonR: 400, half: 1.0, fusion: 'yuexia',
      desc: '吕布与貂蝉的神兵合而为一（月下连环）：花扇先迷住敌人最密处的一圈小兵，随后画戟劈出一道血色巨月，被迷住的敌人受到双倍伤害。' },
    // 卧龙凤雏：一条火龙、一只火凤从你身边盘旋着往外飞（dur 秒转 turns 圈、飞到 R 远，宽 w），每只对同一个敌人只打一次；身后每隔 trailGap 留下一团火（每 0.4 秒烧 trail 倍伤害，留 trailT 秒）
    fuse_wolong: { name: '龙凤双翎', icon: '龙', iconFrom: 'yushan', rgb: '255,150,60', cd: 7, type: 'dragonPhoenix', dmg: 150, R: 480, dur: 2.2, turns: 1.25, w: 110, trail: 0.25, trailT: 2.2, trailGap: 160, fusion: 'wolong',
      desc: '卧龙凤雏的神兵合而为一：一条火龙、一只火凤从身边盘旋着往外飞，扫过大半个画面，身后留下烧着的火路。' },
    // 黄天三宝：开山神斧先劈进敌人最密处（半径 radius，震晕小兵 stun 秒），一圈 rocks 块巨石接着砸下（每块半径 rockR，伤害 dmg × rock），
    //   再召下 bolts 道天雷，劈向附近最强的敌人（每道半径 boltR，伤害 dmg × bolt）
    fuse_huangtian: { name: '黄天三宝', icon: '黄', iconFrom: 'jiujie', rgb: '255,220,100', cd: 6, type: 'yellowSky', dmg: 60, radius: 170, stun: 1.2, rocks: 8, rockR: 72, rock: 0.55, bolts: 9, boltR: 64, bolt: 0.65, fusion: 'huangtian',
      desc: '张角、张宝、程远志的神兵合而为一：开山神斧先劈进敌群震晕一片，一圈巨石随后砸下，再召下九道天雷劈向附近最强的敌人。' },
    // 焚天赤锁：打倒魔董卓直接到手（再打一次就升级）。锁住 range 以内最强的 count 个敌人拖到你跟前（pullTo），被锁中的灼烧 dur 秒（每秒 burn 倍伤害）
    modongzhuo: { name: '焚天赤锁', icon: '锁', iconFrom: 'molian', rgb: '255,90,50', cd: 5.5, type: 'fireChains', dmg: 90, count: 6, range: 480, pullTo: 110, burn: 0.2, dur: 3,
      desc: '赤红的天子锁链悬在身边：定时锁住附近最强的六个敌人，拖到你跟前狠狠一勒；锁链烧红，被锁中的敌人灼烧 3 秒。' },
    // 七星灯：打倒神诸葛直接到手（再打一次就升级）。七道星光按北斗的形状砸进敌群；续命：受到致死伤害时回到 guard.heal 的生命（每 guard.cd 秒一次）
    shenzhuge: { name: '七星灯', icon: '灯', iconFrom: 'qimen', rgb: '255,214,120', cd: 6, type: 'sevenStars', dmg: 80, radius: 80, span: 280, guard: { heal: 0.2, cd: 180 },
      desc: '七星灯绕身：定时按北斗七星的形状在敌群里落下七道星光。续命：受到致死伤害时，七星灯替你续命，回到 20% 生命（每 180 秒一次）。' },
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
    bossGap: 10,            // 一名武将倒下后，至少隔几秒下一名才来（章节和无尽都算，留时间打建筑）
    chapterGap: 5,          // 章末武将倒下后几秒进入下一章
    hpGrowth: 1 / 75,       // 每过 75 秒，血量公式里的底数 +1（小兵按上面的指数再放大）
    lateStart: 420,         // 7 分钟后，敌人强度开始按平方额外增长
    lateDiv: 650,
    endlessDiv: 300,        // 进入无尽征途后，再按平方加速增长
    endlessBossHp: 6000,    // 无尽征途里武将的最低基础血量
    // 无尽里敌人打得动你（战役不变，挂机会死）：名将大招一下至少扣生命上限的 ult（神魔将 campUlt，组合技按自己的 pct）；精英每一下至少 elite（比小兵碰一下重）；
    // 小兵每撞一下至少 contact（站在人堆里不动十秒左右会死）；回血、杀敌回血这些每秒合计最多回 healCap；护甲递减：实际减免 = 护甲 × armorK / (护甲 + armorK)，最多减掉这一下的一半
    lethal: { ult: 0.1, campUlt: 0.2, elite: 0.1, contact: 0.085, healCap: 0.15, armorK: 30 },
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
    // lv 级以后（或进了无尽、开了精简特效）同屏纯视觉的东西少一些（后期满屏混战会卡）：粒子、打敌人的伤害数字、你这边的特效上限，
    // 暴击金光每帧最多 glints 个。文字提示、你掉血的数字、名将精英出招的特效不受限；屏幕外的伤害数字、粒子、你这边的特效任何时候都不生成
    lateFx: { lv: 100, particles: 350, dmgNums: 40, effects: 60, glints: 12 },
    // 自动光效上限：你这边的叠加发光（按透明度加权）一帧最多盖 budget 个屏幕，超了一起调暗，最暗到 floor（论坛：后期满屏白光看不清）。
    //   实测（2026-11-03）：前期 0～0.07，中期 80 级 P90 0.74，400 级 36 件 P90 1.4，全部突破到 40 级、奇门遁甲 39 级 2.6（白成一片）
    glow: { budget: 1.2, floor: 0.15 },
    // 挥砍刀光（锄头、大刀、青龙刀等）：两刀间隔短于 fast 秒就不铺地面范围、刀光按间隔变淡（最低 minA）；刀光最大画到 maxR（再大的范围只在边上画一圈淡线）
    swingFx: { fast: 0.3, minA: 0.4, maxR: 300 },
    // 升级兵种（只在无尽）：进无尽 from 秒后，刷出来的普通兵按比例换成名军（map），到 full 秒时占刷兵量的 share。
    // 一个名军顶 weight 个普通兵：占同屏上限（420）的格数、经验、元宝和肉包的掉率、斩敌数（成就、血战）都按 weight 算；
    // 血量 ×hpMul（比 weight 少一点：人少了，范围伤害一招打到的也少）、碰撞伤害 ×dmgMul
    upgrade: { from: 300, full: 1200, share: 0.75, weight: 4, hpMul: 3, dmgMul: 1.5, map: { foot: 'xianzhen', shield: 'daji', archer: 'yuanrong', cavalry: 'hubao' } },
  },
};
