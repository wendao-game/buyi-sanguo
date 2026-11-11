"""把 GPT 画的九宫格拼图切开，处理成游戏用的规格（新的 2.5D 画风，提示词见 tools/art-prompts-25d.html）。

拼图放在 sanguo-td/assets/_sheets/：
  hero_1.png … hero_4.png    武将（每张 3×3，顺序见下面的 SHEETS）
  enemy_1.png、enemy_2.png   敌人和各章敌将
  fx_1.png … fx_3.png        技能特效（黑底）
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
    'enemy_1': ('enemies', ['grunt', 'archer', 'shield', 'rider', 'elite', 'grunt_2', 'archer_2', 'boss_1', 'boss_2']),
    'enemy_2': ('enemies', ['boss_3', 'boss_4', 'boss_5', 'boss_6', 'boss_7', 'boss_8', 'boss_9', None, None]),
}
# 特效拼图（黑底）：名字 -> 最长边
FX_SHEETS = {
    'fx_1': ['slash', 'burst', 'ring', 'flame', 'bolt', 'pillar', 'thrust', 'el_arrow_ice', 'el_arrow_fire'],
    'fx_2': ['el_hit_fire', 'el_hit_ice', 'el_hit_thunder', 'el_hit_wind', 'el_hit_dark', 'el_orb_fire', 'el_orb_wind', 'whirl', 'circle'],
    'fx_3': ['dragon_azure', 'dragon_white', 'phoenix', None, None, None, None, None, None],
}
FX_SIZE = {'slash': 384, 'bolt': 384, 'pillar': 384, 'thrust': 384, 'circle': 320, 'whirl': 256, 'flame': 256,
           'el_orb_fire': 128, 'el_orb_wind': 160, 'dragon_azure': 512, 'dragon_white': 512, 'phoenix': 512}


def clear_bg(im, tol=28):
    """GPT 偶尔给不透明的纯色底：按四角的颜色抠掉"""
    im = im.convert('RGBA')
    if im.getchannel('A').getextrema()[0] < 250:
        return im
    px = im.load(); w, h = im.size
    corners = [px[2, 2], px[w - 3, 2], px[2, h - 3], px[w - 3, h - 3]]
    ref = max(set(corners), key=corners.count)
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if abs(r - ref[0]) + abs(g - ref[1]) + abs(b - ref[2]) < tol * 3:
                px[x, y] = (r, g, b, 0)
    return im


def standardize(im, dst, size=320, foot=275, height=256):
    box = im.getchannel('A').point(lambda a: 255 if a > 24 else 0).getbbox()
    if not box:
        return False
    im = im.crop(box)
    k = min(height / im.height, size / im.width)
    im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.alpha_composite(im, ((size - im.width) // 2, foot - im.height))
    out.save(dst, optimize=True)
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
            if standardize(cell, os.path.join(DST, folder, cid + '.png')):
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
            n = FX_SIZE.get(fid, 192)
            cell.thumbnail((n, n), Image.LANCZOS)
            cell.save(os.path.join(DST, 'fx', fid + '.jpg'), quality=86)
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
                 ' * 由 serve.ps1、tools/import_buyi_art.py 或 tools/slice_sheets.py 自动生成，也可以手动编辑。 */\n')
        fp.write('window.ASSET_LIST = [\n' + ''.join("  '%s',\n" % f for f in files) + '];\n')
    print('%d images written, manifest has %d files' % (done, len(files)))


if __name__ == '__main__':
    main()
