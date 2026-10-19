// 布衣三国 · 游戏数据
// 所有数值、武器、技能、敌人、武将、关卡节奏都在这里配置。
// 以后迁移到 Godot 时，这份数据可以直接转成 JSON / Resource 使用。

window.GAME_DATA = {
  player: {
    base: { maxHp: 100, speed: 170, pickup: 90, crit: 0.05, critMul: 1.8 },
    weaponSlots: 6,
    passiveSlots: 6,
  },

  // 无限成长：武器 / 技能满 5 级后的“突破”规则
  breakthrough: {
    dmgPerLevel: 0.15,   // 每突破一级伤害 +15%
    areaPerLevel: 0.03,  // 范围 +3%
    cdPerLevel: 0.97,    // 冷却 ×0.97
    minCdMul: 0.55,      // 冷却最多缩到满级时的 55%
    countEvery: 3,       // 每 3 级数量 / 穿透 / 画戟 +1
  },

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
      perks: ['生命上限 130', '每秒回复 0.4 生命', '炼体：更容易刷到生命、护甲、回复'],
      stats: { maxHp: 130, regen: 0.4 },
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
        { dmg: 16, cd: 0.9, count: 4, speed: 640, pierce: 1, fan: 0.22 },
        { dmg: 20, cd: 0.85, count: 4, speed: 660, pierce: 1, fan: 0.22, note: '伤害 +4' },
        { dmg: 22, cd: 0.8, count: 5, speed: 680, pierce: 2, fan: 0.22, note: '弩箭 +1，穿透 2 个' },
        { dmg: 27, cd: 0.75, count: 6, speed: 700, pierce: 2, fan: 0.21, note: '弩箭 +1，伤害 +5' },
        { dmg: 33, cd: 0.65, count: 7, speed: 740, pierce: 3, fan: 0.2, note: '弩箭 +1，穿透 3 个' },
      ],
    },
    luoying: {
      name: '落樱', icon: '樱', type: 'homing', general: '貂蝉', tags: ['spell'], pkind: 'petal',
      desc: '貂蝉的花扇。扇出一簇樱花瓣，追着敌人飞去。',
      levels: [
        { dmg: 15, cd: 0.9, count: 3, speed: 330 },
        { dmg: 19, cd: 0.9, count: 3, speed: 340, note: '伤害 +4' },
        { dmg: 21, cd: 0.8, count: 4, speed: 350, note: '花瓣 +1，更快' },
        { dmg: 25, cd: 0.75, count: 5, speed: 360, note: '花瓣 +1，伤害 +4' },
        { dmg: 31, cd: 0.65, count: 6, speed: 380, note: '花瓣 +1，落英缤纷' },
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
  },

  // 物品（被动）：每级效果叠加；unique 物品只能从武将处获得
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
    lianti: { tags: ['body'], name: '炼体', icon: '体', max: 5, desc: '生命上限 +10%，每秒回复 +0.2', effects: { maxHpMul: 0.1, regen: 0.2 } },
    tiebu: { tags: ['body'], name: '铁布衫', icon: '衫', max: 5, desc: '护甲 +1，生命上限 +15', effects: { armor: 1, maxHp: 15 } },
    // 猎户 · 弓箭（对猎弓、连弩生效）
    lianzhu: { tags: ['bow'], name: '连珠箭', icon: '珠', max: 3, desc: '弓弩每次多射 1 支箭', effects: { arrowCount: 1 } },
    chuanyang: { tags: ['bow'], name: '百步穿杨', icon: '杨', max: 5, desc: '弓弩伤害 +15%，穿透 +1', effects: { arrowDmg: 0.15, arrowPierce: 1 } },
    // 书生 · 计策（对竹简、羽扇、符咒、法杖、古琴、火把和所有技能生效）
    qimou: { tags: ['spell'], name: '奇谋', icon: '谋', max: 5, desc: '计策与技能伤害 +15%', effects: { spellDmg: 0.15 } },
    bingfa: { tags: ['spell'], name: '孙子兵法', icon: '孙', max: 5, desc: '计策与技能冷却 -8%，计策范围 +8%', effects: { skillCd: 0.08, spellArea: 0.08 } },
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

  // 随从兵：摧毁据点后加入，跟在身边自动作战（伤害随等级提升）
  allies: {
    ally_spear: { name: '随从枪兵', kind: 'melee', speed: 155, dmg: 12, range: 42, cd: 0.75, h: 40, r: 12,
      look: { skin: '#d9a878', robe: '#3a5a7a', trim: '#1e3248', armor: false, beard: 'none', eyes: 'normal', brows: 'sharp', head: 'cap', headColor: '#2f6fa8', weapon: 'spear' } },
    ally_archer: { name: '随从弓手', kind: 'ranged', speed: 145, dmg: 9, range: 320, cd: 1.0, h: 40, r: 12,
      look: { skin: '#d9a878', robe: '#3a6a5a', trim: '#1e3a30', armor: false, beard: 'none', eyes: 'normal', brows: 'sharp', head: 'cap', headColor: '#2f8a6a', weapon: 'bow' } },
    ally_cavalry: { name: '随从骑兵', kind: 'melee', speed: 215, dmg: 20, range: 48, cd: 0.85, h: 52, r: 15, mount: '#e8e0d0',
      look: { skin: '#d0a070', robe: '#2f4f7a', trim: '#c9a046', armor: true, armorColor: '#5a6f8a', beard: 'none', eyes: 'normal', brows: 'sharp', head: 'helmet', headColor: '#8a9aaa', plume: '#2f6fa8', weapon: 'spear' } },
    // 黄巾号令召来的临时降卒（不占随从名额，沿用黄巾兵的小人图）
    ally_yt: { name: '黄巾降卒', kind: 'melee', speed: 165, dmg: 14, range: 40, cd: 0.7, h: 40, r: 12, art: 'yt_foot', temp: true,
      look: { skin: '#c99a68', robe: '#8a7a52', trim: '#5e5040', armor: false, beard: 'stubble', beardColor: '#2a2018', eyes: 'normal', brows: 'sharp', head: 'band', bandColor: '#e0b020', weapon: 'spear' } },
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
      name: '程远志', title: '黄巾渠帅 · 涿郡先锋', icon: '程', hp: 1000, speed: 82, dmg: 11, r: 30, color: '#8a6a2a',
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
      name: '张宝', title: '地公将军', icon: '宝', hp: 2200, speed: 80, dmg: 14, r: 31, color: '#a88a2a',
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
      name: '张角', title: '天公将军 · 大贤良师', icon: '角', hp: 4500, speed: 78, dmg: 16, r: 33, color: '#c9a83a',
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
      name: '华雄', title: '董卓帐下骁将', icon: '华', hp: 3500, speed: 88, dmg: 18, r: 30, color: '#4f2a1c',
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
      name: '吕布', title: '人中吕布 · 马中赤兔', icon: '吕', hp: 6500, speed: 108, dmg: 24, r: 36, color: '#6e1510',
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
        { id: 'dance', name: '闭月舞', type: 'petalSpiral', arms: 5, waves: 16, gap: 0.09, speed: 250, dmg: 0.8 },
        { id: 'charm', name: '倾城一顾', type: 'charm', radius: 150, tele: 1.0, pull: 300, dur: 1.6, dmg: 0.8 },
        { id: 'lianhuan', name: '连环计', type: 'petalRain', hpBelow: 0.5, count: 22, dur: 3.2, r: 66, dmg: 1.2 },
      ],
      banner: '司徒府 · 貂蝉 起舞', line: '“将军，可愿看妾身一舞？”', rage: '“花落……人亦断肠。”',
      look: { skin: '#f6dcc4', skinShade: '#dcb498', robe: '#e07aa6', trim: '#f6e2ea', armor: false, beard: 'none', eyes: 'calm', brows: 'thin', head: 'bun', hairColor: '#1c1218', pin: '#ff9ac8', weapon: 'ribbon', ribbon: '#ff9ac8', aura: '#d86a9a', female: true, artFace: [0.53, 0.29, 0.34] },
    },
    zhenji: {
      name: '甄姬', title: '洛神 · 凌波仙子', icon: '甄', hp: 6000, speed: 106, dmg: 22, r: 29, color: '#5a8ac0',
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
      name: '孙尚香', title: '枭姬 · 江东郡主', icon: '香', hp: 7000, speed: 114, dmg: 22, r: 29, color: '#c8463a',
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
      name: '张飞', title: '万人敌 · 燕人张翼德', icon: '张', hp: 6500, speed: 100, dmg: 24, r: 34, color: '#2b2622',
      attacks: ['roar', 'charge3', 'roar', 'summon'], interval: 2.8, roarR: 240, chargeSpeed: 680, summon: 8, summonType: 'foot',
      rewards: ['shemao', 'paoxiao', 'jiutan'],
      ultRgb: '255,210,80', ultEvery: 11,
      ults: [
        { id: 'roar', name: '当阳怒吼', type: 'bigRoar', R: 440, dmg: 1.0, push: 900, slow: 2.2 },
        { id: 'lance', name: '丈八突刺', type: 'lanceDash', count: 1, speed: 1350, len: 900, w: 46, tele: 0.85, dmg: 1.8 },
        { id: 'rage', name: '燕人血怒', type: 'frenzy', hpBelow: 0.4, dur: 7 },
      ],
      banner: '长坂坡 · 张飞 断喝', line: '“燕人张翼德在此！谁敢决一死战！”', rage: '“哇呀呀呀！”',
      look: { skin: '#6b5242', skinShade: '#4a382c', robe: '#2b2622', trim: '#8a7a5a', armor: true, armorColor: '#3a3430', beard: 'tiger', eyes: 'round', brows: 'bushy', head: 'helmet', headColor: '#2b2622', plume: '#b5372a', weapon: 'snake', aura: '#4a4038', artFace: [0.55, 0.31, 0.36] },
    },
    zhaoyun: {
      name: '赵云', title: '常山赵子龙', icon: '赵', hp: 6000, speed: 125, dmg: 22, r: 32, color: '#6f7d8a',
      attacks: ['charge3', 'volley', 'charge3', 'volley'], interval: 2.4, chargeSpeed: 760,
      homing: 2.2, rideCharge: true, mount: '#eef0f2', dragonTrail: true, // 赵云：骑白龙驹追着玩家冲，身后一条白龙
      volley: { count: 7, spread: 0.9, speed: 380, dmg: 14 },
      rewards: ['longdan', 'qijin', 'qinggang'],
      ultRgb: '150,210,255', ultEvery: 10,
      ults: [
        { id: 'seven', name: '七进七出', type: 'sevenDash', count: 7, speed: 1250, len: 320, w: 40, tele: 0.32, dmg: 1.2, home: 2.6 },
        { id: 'flurry', name: '百鸟朝凤', type: 'flurry', count: 12, R: 250, half: 0.45, dmg: 0.6 },
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
      ],
      banner: '宛城 · 典韦 死战', line: '“谁敢近主公一步！”', rage: '“来！再来！”',
      look: { skin: '#a8754e', skinShade: '#80583a', robe: '#5a3b28', trim: '#8a6a3a', armor: false, beard: 'short', eyes: 'round', brows: 'bushy', head: 'band', weapon: 'twinji', aura: '#6b4a2e', scar: true, artFace: [0.61, 0.27, 0.36] },
    },
    guanyu: {
      name: '关羽', title: '武圣 · 关云长', icon: '关', hp: 8000, speed: 95, dmg: 30, r: 36, color: '#2f5d45',
      attacks: ['cleave', 'charge', 'cleave', 'slam'], interval: 2.8, cleaveR: 210, slamR: 160, chargeSpeed: 680,
      rewards: ['qinglong', 'wusheng', 'chunqiu'],
      ultRgb: '90,240,170', ultEvery: 11,
      ults: [
        { id: 'dragon', name: '青龙偃月', type: 'dragonWave', speed: 330, r: 48, dmg: 2.0 },
        { id: 'five', name: '过五关斩六将', type: 'multiCleave', count: 5, R: 230, half: 0.9, tele: 0.4, dmg: 1.3 },
        { id: 'spiral', name: '武圣降临', type: 'spiral', hpBelow: 0.5, count: 18, dmg: 1.4 },
      ],
      banner: '过五关 · 关羽 出阵', line: '“插标卖首耳！”', rage: '“吃我一刀！”',
      look: { skin: '#b8433a', skinShade: '#8e2e26', robe: '#2f6b4a', trim: '#c9a046', armor: false, beard: 'long', eyes: 'phoenix', brows: 'silkworm', head: 'hood', headColor: '#2f6b4a', weapon: 'guandao', aura: '#2f6b4a', artFace: [0.55, 0.26, 0.36] },
    },
    zhugeliang: {
      name: '诸葛亮', title: '卧龙 · 诸葛孔明', icon: '诸', hp: 6000, speed: 85, dmg: 18, r: 32, color: '#5b6a74',
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
      name: '周瑜', title: '江东美周郎 · 大都督', icon: '周', hp: 9000, speed: 96, dmg: 22, r: 33, color: '#a8322a',
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
      id: 'taodong', name: '第二章 · 讨董之战', sub: '公元 190 年 · 汜水关 → 连环计 → 虎牢关',
      clear: '威震虎牢',
      elites: { captain: 10, brute: 30, crossbow: 60 },
      ground: { bg: '#27231a', grass: 'rgba(126,130,74,0.4)', blot: 'rgba(12,10,6,0.16)', flag: 'rgba(150,45,35,0.45)' },
      waves: [
        { t: 0, rates: { foot: 2.4, shield: 0.25, archer: 0.25 } },
        { t: 40, rates: { foot: 2.8, shield: 0.3, archer: 0.35, cavalry: 0.25 } },
        { t: 90, rates: { foot: 3.0, shield: 0.4, archer: 0.4, cavalry: 0.6 } },
        { t: 140, rates: { foot: 3.6, shield: 0.5, archer: 0.5, cavalry: 0.9 } },
      ],
      events: [
        { t: 55, type: 'boss', id: 'huaxiong' },
        { t: 95, type: 'ambush', enemy: 'foot', count: 42, text: '伏兵四起' },
        { t: 120, type: 'boss', id: 'diaochan' },
        { t: 160, type: 'ambush', enemy: 'cavalry', count: 20, text: '西凉铁骑' },
        { t: 190, type: 'boss', id: 'lubu', final: true },
      ],
    },
    {
      id: 'qunxiong', name: '第三章 · 群雄逐鹿', sub: '公元 197–204 年 · 宛城 → 白马 → 邺城 → 过五关',
      clear: '千里走单骑',
      elites: { captain: 0, brute: 0, crossbow: 0 },
      ground: { bg: '#22261a', grass: 'rgba(112,142,72,0.45)', blot: 'rgba(8,12,6,0.16)', flag: 'rgba(50,72,128,0.5)' },
      waves: [
        { t: 0, rates: { foot: 3.4, shield: 0.5, archer: 0.5, cavalry: 0.6 } },
        { t: 80, rates: { foot: 3.8, shield: 0.6, archer: 0.6, cavalry: 0.9 } },
        { t: 160, rates: { foot: 4.2, shield: 0.7, archer: 0.7, cavalry: 1.1 } },
      ],
      events: [
        { t: 45, type: 'boss', id: 'dianwei' },
        { t: 105, type: 'boss', id: 'yanliang' },
        { t: 140, type: 'ambush', enemy: 'cavalry', count: 24, text: '河北铁骑' },
        { t: 170, type: 'boss', id: 'wenchou' },
        { t: 210, type: 'boss', id: 'zhenji' },
        { t: 260, type: 'boss', id: 'guanyu', final: true },
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
        { t: 45, type: 'boss', id: 'zhugeliang' },
        { t: 105, type: 'boss', id: 'zhangfei' },
        { t: 150, type: 'ambush', enemy: 'foot', count: 48, text: '曹军南下' },
        { t: 165, type: 'boss', id: 'zhaoyun' },
        { t: 210, type: 'boss', id: 'sunshangxiang' },
        { t: 265, type: 'boss', id: 'zhouyu', final: true },
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
  // 每件装备 9 级，每一级都是一个新形态（tiers：名字 + 外观描述），1–3 级普通、4–6 级精良、7–9 级传说。
  // 武器和护甲的阶段（1–3 / 4–6 / 7–9 级）决定人物小人的造型（sprites/<出身>_w<武器阶段>a<护甲阶段>.png）；饰品显示为身边的护身光珠。
  // 价格：base × growth^当前等级（向上取整到 5）。effects 是每级的加成；startDmg 是起手武器伤害，startLvEvery 是每几级起手武器开局 +1 级。
  meta: {
    gold: { minion: 0.02, elite: [4, 8], building: 10, general: 18, generalPerChapter: 8, chapterClear: 30 },
    costBase: 30, costGrowth: 1.5, maxLv: 9,
    rarity: [
      { name: '普通', color: '#b08a5a', rgb: '210,170,120' },  // 1–3 级
      { name: '精良', color: '#7aa6d8', rgb: '150,200,255' },  // 4–6 级
      { name: '传说', color: '#e8b440', rgb: '255,210,90' },   // 7–9 级
    ],
    gear: {
      farmer: [
        { id: 'g_hoe', name: '锄', icon: '锄', slot: '武器', effects: { startDmg: 0.13 }, startLvEvery: 3, desc: '锄头伤害 +13%/级；每 3 级开局锄头 +1 级',
          look: '农家锄头，长柄、宽刃', tiers: ['木柄锄', '精铁锄', '开垦宝锄', '百炼锄', '镔铁开山锄', '青铜兽首锄', '寒铁裂地锄', '鎏金神农锄', '神农开天锄'] },
        { id: 'g_baina', name: '甲', icon: '甲', slot: '护甲', effects: { maxHp: 16 }, armorEvery: 3, desc: '生命上限 +16/级；每 3 级护甲 +1',
          look: '庄稼汉穿的护身衣甲，从粗布到重铠', tiers: ['粗布短褐', '百衲布衣', '牛皮护胸', '镶铁皮甲', '百衲铁甲', '鱼鳞铁甲', '明光铠', '玄铁重铠', '不动山岳铠'] },
        { id: 'g_fudai', name: '福袋', icon: '袋', slot: '饰品', effects: { regen: 0.22 }, desc: '每秒回复 +0.22/级',
          look: '农家祈福的小饰物', tiers: ['五谷福袋', '铜钱平安符', '桃木护身符', '稻穗玉坠', '社稷红绳', '后土玉佩', '丰年金铃', '神农药囊', '五谷神珠'] },
      ],
      hunter: [
        { id: 'g_zhegong', name: '弓', icon: '弓', slot: '武器', effects: { startDmg: 0.13 }, startLvEvery: 3, desc: '猎弓伤害 +13%/级；每 3 级开局猎弓 +1 级',
          look: '猎人的长弓', tiers: ['竹弓', '桑木弓', '柘木长弓', '牛角弓', '犀角强弓', '铁胎弓', '鹊画雕弓', '落日弓', '射日神弓'] },
        { id: 'g_luxue', name: '猎装', icon: '装', slot: '护甲', effects: { speedMul: 0.035, maxHp: 7 }, desc: '移动速度 +3.5%、生命上限 +7/级',
          look: '猎人的轻便衣甲和靴子，从兽皮到轻铠', tiers: ['兽皮短衣', '麻编猎装', '鹿皮快装', '狼皮猎甲', '云纹轻甲', '踏雪轻铠', '追风劲装', '飞羽轻铠', '山君神行铠'] },
        { id: 'g_langya', name: '护符', icon: '牙', slot: '饰品', effects: { crit: 0.017, critMul: 0.055 }, desc: '暴击率 +1.7%、爆伤 +5.5%/级',
          look: '猎人挂在身上的兽牙护符', tiers: ['兽骨坠', '狼牙护符', '熊爪护符', '鹰羽护符', '虎齿项链', '豹纹玉坠', '白狼王牙', '金雕羽坠', '山君神符'] },
      ],
      scholar: [
        { id: 'g_zhujian', name: '书', icon: '简', slot: '武器', effects: { startDmg: 0.13 }, startLvEvery: 3, desc: '竹简伤害 +13%/级；每 3 级开局竹简 +1 级',
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
    interval: 0.62, ultEvery: 0.65,       // 出招间隔、大招冷却倍率（越小越频繁）
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
    bossGap: 10,            // 两名武将之间至少隔几秒
    chapterGap: 5,          // 章末武将倒下后几秒进入下一章
    hpGrowth: 1 / 95,       // 每过 95 秒小兵血量 +100%
    lateStart: 420,         // 7 分钟后，敌人强度开始按平方额外增长
    lateDiv: 480,
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
  },
};
