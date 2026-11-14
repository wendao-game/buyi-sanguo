"""把 GPT 画的九宫格拼图切开，处理成游戏用的规格（新的 2.5D 画风，提示词见 tools/art-prompts-25d.html）。

拼图放在 sanguo-td/assets/_sheets/：
  hero_1.png … hero_8.png    武将（每张 3×3，顺序见下面的 SHEETS）
  enemy_1.png … enemy_3.png 敌人和各章敌将（enemy_3 是 v1.3 的新敌兵）
  head_1.png … head_8.png    武将正面头像（顺序同 hero_1 … hero_8）
  weapon_1.png、weapon_2.png 兵器图标（透明底）
  fx_1.png … fx_6.png        技能特效（黑底；fx_4 … fx_6 是金、橙武将的专属大招特效）
  battle.png                 战场背景（竖版，会裁成 9:16 缩到 1080×1920）
用法（在仓库根目录）：python3 sanguo-td/tools/slice_sheets.py
缺的拼图跳过；切出来的图覆盖同名旧图，最后重写 assets/manifest.js。
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DST = os.path.join(ROOT, 'sanguo-td', 'assets')
SHEETS = os.path.join(DST, '_sheets')

SHEETS_ORDER = {
    'hero_1': ('heroes', ['zhugeliang', 'lvbu', 'caocao', 'luxun', 'guanyu', 'zhangfei', 'zhouyu', 'zhaoyun', 'simayi']),
    'hero_2': ('heroes', ['huangzhong', 'zhangliao', 'zhangjiao', 'jiaxu', 'zhenji', 'taishici', 'xuhuang', 'ganning', 'weiyan']),
    'hero_3': ('heroes', ['caiwenji', 'liru', 'xushu', 'guanping', 'caohong', 'chengpu', 'zhangbao', 'huaxiong', 'liaohua']),
    'hero_4': ('heroes', ['zhoucang', 'peiyuan', 'guanhai', 'panfeng', 'mifang', 'god_guanyu', 'god_lvbu', 'god_zhuge', 'god_caocao']),
    'hero_5': ('heroes', ['liubei', 'sunce', 'machao', 'sunshangxiang', 'diaochan', 'guojia', 'dianwei', 'pangtong', 'xiaoqiao']),
    'hero_6': ('heroes', ['zuoci', 'daqiao', 'xuchu', 'huanggai', 'fazheng', 'yujin', 'lingtong', 'xingdaorong', 'jiangqin']),
    'hero_7': ('heroes', ['zhanghe', 'zhoutai', 'chengong', 'madai', 'gongsunzan', 'yuejin', 'lidian', 'handang', 'wangping']),
    'hero_8': ('heroes', ['dongzhuo', 'xiahoudun', 'yanliang', 'wenchou', 'menghuo', 'gaoshun', 'caochun', 'chengyuanzhi', None]),   # 收服来的敌将
    'enemy_1': ('enemies', ['grunt', 'archer', 'shield', 'rider', 'elite', 'grunt_2', 'archer_2', 'boss_1', 'boss_2']),
    'enemy_2': ('enemies', ['boss_3', 'boss_4', 'boss_5', 'boss_6', 'boss_7', 'boss_8', 'boss_9', None, None]),
    'enemy_3': ('enemies', ['sapper', 'ram', 'drummer', 'heavy', 'catapult', 'rattan', 'shaman', None, None]),
}
# 头像拼图：顺序和武将拼图一样，切出来存 heroes/<id>_head.png
HEAD_SHEETS = {'head_' + k[5:]: v[1] for k, v in SHEETS_ORDER.items() if k.startswith('hero_')}
# 兵器图标拼图（透明底）：切出来存 weapons/<id>.png（192×192）
WEAPON_SHEETS = {
    'weapon_1': ['fangtian', 'yitian', 'baiyushan', 'qinglong', 'zhangba', 'cixiong', 'guding', 'qilingong', 'guanshifu'],
    'weapon_2': ['bailian', 'liannu', 'heyushan', 'huanshou', 'zhemugong', 'changmao', 'tiejian', 'liegong', 'podao'],
    'weapon_3': ['liangyin', 'jiaowei', 'qixing', 'hutou', 'shuangji', 'goulian', 'taiping', 'dunjia', 'liuxing'],
    'weapon_4': ['sanjian', 'wugou', 'guduo', 'duanji', 'tongchui', 'bingshu', 'chaifu', 'zhuqiang', 'pushan'],
}
# 大招里冲出去的兵、马、象（透明底，和武将一样的画风）：切出来存 fx/<名字>.png，游戏里有图就用图，没有就用代码画的
UNIT_SHEETS = {
    'unit_1': ['soldier', 'horse', 'horse_side', 'elephant', None, None, None, None, None],
}
# 特效拼图（黑底）：名字 -> 最长边
FX_SHEETS = {
    'fx_1': ['slash', 'burst', 'ring', 'flame', 'bolt', 'pillar', 'thrust', 'el_arrow_ice', 'el_arrow_fire'],
    'fx_2': ['el_hit_fire', 'el_hit_ice', 'el_hit_thunder', 'el_hit_wind', 'el_hit_dark', 'el_orb_fire', 'el_orb_wind', 'whirl', 'circle'],
    'fx_3': ['dragon_azure', 'dragon_white', 'phoenix', None, None, None, None, None, None],
    # 金、橙武将的专属大招特效（fx_4 … fx_6）。和代码生成的同名贴图（moon、halberd、chain、snowflake）重名的会顶替掉它
    'fx_4': ['seven_stars', 'roar', 'twin_swords', 'arrow_rain', 'halberd_slash', 'fire_ship', 'ghost_mask', 'thunder_lance', 'gold_arrow'],
    'fx_5': ['thunder_ring', 'moon', 'halberd', 'tiger', 'wolf', 'chain', 'snowflake', 'cross_slash', 'red_arrow'],
    'fx_6': ['demon_flame', 'blood_eye', None, None, None, None, None, None, None],
}
FX_SIZE = {'slash': 384, 'bolt': 384, 'pillar': 384, 'thrust': 384, 'circle': 320, 'whirl': 256, 'flame': 256,
           'el_orb_fire': 128, 'el_orb_wind': 160, 'dragon_azure': 512, 'dragon_white': 512, 'phoenix': 512}


def clear_bg(im, tol=24):
    """透明底：清掉几乎看不见的半透明噪点。
    不透明的纯色底（GPT 偶尔给白底）：只从每个格子的边缘往里抠和底色相近的连通区域，
    人物身上的白色（白袍、白羽扇）不和边缘相连，不会被抠掉。"""
    from PIL import ImageDraw
    im = im.convert('RGBA')
    if im.getchannel('A').getextrema()[0] < 250:
        a = im.getchannel('A').point(lambda v: 0 if v < 16 else v)
        im.putalpha(a)
        return im
    w, h = im.size
    for gx in range(4):                                        # 格子边线和外框上每隔 12 像素取一个种子
        for t in range(0, max(w, h), 12):
            for (x, y) in ((min(w - 1, gx * w // 3), min(h - 1, t)), (min(w - 1, t), min(h - 1, gx * h // 3))):
                if x < w and y < h and im.getpixel((x, y))[3] > 0:
                    ImageDraw.floodfill(im, (x, y), (0, 0, 0, 0), thresh=tol)
    return im


def keep_main(im):
    """只留格子里最大的那块：相邻格子伸过来的兵器尖、零碎噪点清掉。
    按行、按列找被空白隔开的段，各留像素最多的一段。"""
    a = im.getchannel('A')
    w, h = im.size
    px = a.load()
    for axis in (0, 1):
        n = h if axis == 0 else w
        cnt = [sum(1 for k in range(w if axis == 0 else h) if (px[k, i] if axis == 0 else px[i, k]) > 24) for i in range(n)]
        runs, start = [], None
        for i, c in enumerate(cnt + [0]):
            if c and start is None:
                start = i
            elif not c and start is not None:
                runs.append((sum(cnt[start:i]), start, i)); start = None
        if len(runs) > 1:
            _, s0, s1 = max(runs)
            for i in list(range(0, s0)) + list(range(s1, n)):
                for k in range(w if axis == 0 else h):
                    if axis == 0:
                        px[k, i] = 0
                    else:
                        px[i, k] = 0
    im.putalpha(a)
    return im


# 收腰：这些角色的裙摆、飘带往两边撑得太开，背身俯视看着发胖。头部不动，从肩往下逐渐收窄，脚底收到这个比例。
SLIM = {'diaochan': 0.74, 'xiaoqiao': 0.74, 'daqiao': 0.80, 'zhenji': 0.80, 'caiwenji': 0.86, 'sunshangxiang': 0.88}


def slim(im, k, keep=0.36):
    """im 是已经裁到人物外框的图。上面 keep 这一段（头）保持原样，往下按行逐渐往头的中轴线收窄，最底下宽度 × k。"""
    w, h = im.size
    a = im.getchannel('A').crop((0, 0, w, max(1, int(h * keep))))
    box = a.point(lambda v: 255 if v > 24 else 0).getbbox()
    cx = (box[0] + box[2]) / 2 if box else w / 2                 # 头的中轴线
    n, mesh = 24, []
    f = lambda y: 1 if y <= h * keep else 1 - (1 - k) * ((y - h * keep) / (h * (1 - keep))) ** 0.8
    for i in range(n):
        y0, y1 = h * i / n, h * (i + 1) / n
        f0, f1 = f(y0), f(y1)
        # 目标这一条（整行）对应原图里更宽的一条：x_src = cx + (x_dst - cx) / f
        quad = (cx + (0 - cx) / f0, y0, cx + (0 - cx) / f1, y1, cx + (w - cx) / f1, y1, cx + (w - cx) / f0, y0)
        mesh.append(((0, int(round(y0)), w, int(round(y1))), quad))
    return im.transform((w, h), Image.MESH, mesh, Image.BICUBIC)


def save_png(im, dst):
    """存成 256 色调色板 PNG（带透明）：卡通画风颜色少，肉眼几乎看不出差别，体积只有原来的五分之一，手机上加载快很多"""
    im.quantize(256, method=2, dither=0).save(dst, optimize=True)


def standardize(im, dst, size=320, foot=275, height=256, slim_k=None):
    im = keep_main(im)
    box = im.getchannel('A').point(lambda a: 255 if a > 24 else 0).getbbox()
    if not box:
        return False
    im = im.crop(box)
    if slim_k:
        im = slim(im, slim_k)
        box = im.getchannel('A').point(lambda a: 255 if a > 24 else 0).getbbox()
        im = im.crop(box)
    k = min(height / im.height, size / im.width)
    im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.alpha_composite(im, ((size - im.width) // 2, foot - im.height))
    save_png(out, dst)
    return True


def main():
    done = 0
    for name, (folder, ids) in SHEETS_ORDER.items():
        path = os.path.join(SHEETS, name + '.png')
        if not os.path.exists(path):
            continue
        sheet = clear_bg(Image.open(path))
        w, h = sheet.size
        os.makedirs(os.path.join(DST, folder), exist_ok=True)
        for i, cid in enumerate(ids):
            if not cid:
                continue
            col, row = i % 3, i // 3
            cell = sheet.crop((col * w // 3, row * h // 3, (col + 1) * w // 3, (row + 1) * h // 3))
            if standardize(cell, os.path.join(DST, folder, cid + '.png'), height=244 if cid in SLIM else 256, slim_k=SLIM.get(cid)):   # 收腰的几位女角色个头也略小一点
                done += 1
    for name, ids in HEAD_SHEETS.items():
        path = os.path.join(SHEETS, name + '.png')
        if not os.path.exists(path):
            continue
        sheet = clear_bg(Image.open(path))
        w, h = sheet.size
        os.makedirs(os.path.join(DST, 'heroes'), exist_ok=True)
        for i, cid in enumerate(ids):
            if not cid:
                continue
            col, row = i % 3, i // 3
            cell = keep_main(sheet.crop((col * w // 3, row * h // 3, (col + 1) * w // 3, (row + 1) * h // 3)))
            box = cell.getchannel('A').point(lambda a: 255 if a > 24 else 0).getbbox()
            if not box:
                continue
            cell = cell.crop(box)
            s = max(cell.size)                                 # 补成正方形：横向居中、头顶对齐
            sq = Image.new('RGBA', (s, s), (0, 0, 0, 0)); sq.alpha_composite(cell, ((s - cell.width) // 2, 0))
            save_png(sq.resize((256, 256), Image.LANCZOS), os.path.join(DST, 'heroes', cid + '_head.png'))
            done += 1
    for name, ids in WEAPON_SHEETS.items():
        path = os.path.join(SHEETS, name + '.png')
        if not os.path.exists(path):
            continue
        sheet = clear_bg(Image.open(path))
        w, h = sheet.size
        os.makedirs(os.path.join(DST, 'weapons'), exist_ok=True)
        for i, wid in enumerate(ids):
            col, row = i % 3, i // 3
            cell = keep_main(sheet.crop((col * w // 3, row * h // 3, (col + 1) * w // 3, (row + 1) * h // 3)))
            box = cell.getchannel('A').point(lambda a: 255 if a > 24 else 0).getbbox()
            if not box:
                continue
            cell = cell.crop(box)
            k = 176 / max(cell.size)                           # 最长边 176，居中放进 192 的方图
            cell = cell.resize((max(1, round(cell.width * k)), max(1, round(cell.height * k))), Image.LANCZOS)
            out = Image.new('RGBA', (192, 192), (0, 0, 0, 0)); out.alpha_composite(cell, ((192 - cell.width) // 2, (192 - cell.height) // 2))
            save_png(out, os.path.join(DST, 'weapons', wid + '.png'))
            done += 1
    for name, ids in UNIT_SHEETS.items():
        path = os.path.join(SHEETS, name + '.png')
        if not os.path.exists(path):
            continue
        sheet = clear_bg(Image.open(path))
        w, h = sheet.size
        os.makedirs(os.path.join(DST, 'fx'), exist_ok=True)
        for i, uid in enumerate(ids):
            if not uid:
                continue
            col, row = i % 3, i // 3
            cell = keep_main(sheet.crop((col * w // 3, row * h // 3, (col + 1) * w // 3, (row + 1) * h // 3)))
            box = cell.getchannel('A').point(lambda a: 255 if a > 24 else 0).getbbox()
            if not box:
                continue
            cell = cell.crop(box)
            k = 256 / max(cell.size)                           # 贴着轮廓裁，最长边 256
            save_png(cell.resize((max(1, round(cell.width * k)), max(1, round(cell.height * k))), Image.LANCZOS), os.path.join(DST, 'fx', uid + '.png'))
            done += 1
    for name, ids in FX_SHEETS.items():
        path = os.path.join(SHEETS, name + '.png')
        if not os.path.exists(path):
            continue
        src = Image.open(path).convert('RGBA')
        sheet = Image.new('RGB', src.size, (0, 0, 0)); sheet.paste(src, mask=src.getchannel('A'))   # 透明底也当黑底
        w, h = sheet.size
        os.makedirs(os.path.join(DST, 'fx'), exist_ok=True)
        for i, fid in enumerate(ids):
            if not fid:
                continue
            col, row = i % 3, i // 3
            cell = sheet.crop((col * w // 3, row * h // 3, (col + 1) * w // 3, (row + 1) * h // 3))
            box = cell.convert('L').point(lambda v: 255 if v > 18 else 0).getbbox()
            if not box:
                continue
            m = max(4, (box[2] - box[0]) // 25)
            cell = cell.crop((max(0, box[0] - m), max(0, box[1] - m), min(cell.width, box[2] + m), min(cell.height, box[3] + m)))
            n = 420                                            # 保留原图的清晰度（每格约 418 像素）：游戏里特效会放大着画，缩小了就糊
            cell.thumbnail((n, n), Image.LANCZOS)
            cell.save(os.path.join(DST, 'fx', fid + '.jpg'), quality=93)
            done += 1
    bg = os.path.join(SHEETS, 'battle.png')
    if os.path.exists(bg):
        im = Image.open(bg).convert('RGB')
        w, h = im.size
        tw = min(w, round(h * 9 / 16)); th = round(tw * 16 / 9)
        im = im.crop(((w - tw) // 2, h - th, (w - tw) // 2 + tw, h)).resize((1080, 1920), Image.LANCZOS)   # 宽了裁两边，高了裁上面（城墙在下方，不能裁）
        os.makedirs(os.path.join(DST, 'bg'), exist_ok=True)
        im.save(os.path.join(DST, 'bg', 'battle.jpg'), quality=88)
        done += 1
    # 重写清单
    files = []
    for dp, _, fs in os.walk(DST):
        if os.path.basename(dp) == '_sheets':
            continue
        for f in fs:
            if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                files.append(os.path.relpath(os.path.join(dp, f), DST).replace(os.sep, '/'))
    files.sort()
    with open(os.path.join(DST, 'manifest.js'), 'w', encoding='utf8') as fp:
        fp.write('/* 已放进 assets/ 的图片清单（游戏只加载这里列出的文件）。\n'
                 ' * 由 serve.ps1 或 tools/slice_sheets.py 自动生成，也可以手动编辑。 */\n')
        fp.write('window.ASSET_LIST = [\n' + ''.join("  '%s',\n" % f for f in files) + '];\n')
        import hashlib                                         # 素材版本号：所有图片内容的哈希，换了任何一张图就会变
        hs = hashlib.sha1()
        for f in files:
            with open(os.path.join(DST, f), 'rb') as fh:
                hs.update(f.encode() + hashlib.sha1(fh.read()).digest())
        fp.write("window.ASSET_VER = '%s';\n" % hs.hexdigest()[:10])
    print('%d images written, manifest has %d files' % (done, len(files)))


if __name__ == '__main__':
    main()
