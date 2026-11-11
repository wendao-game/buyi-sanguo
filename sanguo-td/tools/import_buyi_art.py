"""把布衣三国（仓库根目录 assets/）里能用的美术图处理成烽火守城用的规格，输出到 sanguo-td/assets/。

用法（在仓库根目录）：python3 sanguo-td/tools/import_buyi_art.py
需要 Pillow。重复运行会覆盖输出；最后重写 assets/manifest.js。

- 武将 / 敌人小人：裁掉透明边，等比缩到 256 高，放进 320×320 透明画布，脚底中心对齐 (160, 275)（即 50% / 86%，见 js/assets.js 的 SPRITE）
- 武将头像：从半身立绘裁出头部，256×256
- 大招特写：缩到 768 宽，存 JPG
- 特效贴图：黑底、用叠加混合画，缩小后存 JPG（体积小很多）
- 场景：布衣三国的建筑图（箭楼、营寨），缩小后原样保存
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'assets')
DST = os.path.join(ROOT, 'sanguo-td', 'assets')

# 烽火守城武将 id -> 布衣三国的文件名
HEROES = {
    'guanyu': 'guanyu', 'zhangfei': 'zhangfei', 'zhaoyun': 'zhaoyun', 'huangzhong': 'huangzhong',
    'zhugeliang': 'zhugeliang', 'caocao': 'caocao', 'simayi': 'simayi', 'zhouyu': 'zhouyu',
    'lvbu': 'lubu', 'zhangjiao': 'zhangjiao', 'zhangbao': 'zhangbao', 'huaxiong': 'huaxiong',
    'caiwenji': 'caiwenji', 'zhenji': 'zhenji',
}
# 敌人：类型 -> 小人文件；第 1 章用黄巾兵造型，其后用官军造型（文件名后缀 _2）
ENEMIES = {
    'grunt': 'yt_foot', 'grunt_2': 'foot', 'archer': 'yt_archer', 'archer_2': 'archer',
    'shield': 'shield', 'rider': 'cavalry', 'elite': 'captain',
}
# 各章敌将（与 data.js 的 CHAPTERS 顺序一致），第 9 章起循环
BOSSES = ['chengyuanzhi', 'dongzhuo', 'yanliang', 'wenchou', 'xiahoudun', 'xianzhen', 'brute', 'hubao', 'shade']
# 场景：远处敌营、城墙两端箭楼（等距 2.5D 画法）
SCENERY = {'tower': 300, 'camp': 300, 'xiliangying': 300}
# 特效：文件名 -> 最长边
FX = {
    'slash': 384, 'burst': 256, 'flame': 256, 'pillar': 384, 'ring': 256, 'bolt': 384, 'circle': 320,
    'whirl': 256, 'skyblade': 640, 'thrust': 384, 'phoenix': 512, 'dragon_azure': 512, 'dragon_white': 512,
    'el_orb_fire': 128, 'el_orb_ice': 128, 'el_orb_thunder': 128, 'el_orb_wind': 160, 'el_orb_dark': 128,
    'el_hit_fire': 192, 'el_hit_ice': 192, 'el_hit_thunder': 192, 'el_hit_wind': 192, 'el_hit_dark': 192,
    'el_arrow_fire': 192, 'el_arrow_ice': 192, 'el_arrow_thunder': 192, 'el_arrow_wind': 192,
}


def sprite(src, dst, size=320, foot=275, height=256):
    im = Image.open(src).convert('RGBA')
    im = im.crop(im.getchannel('A').getbbox())
    k = height / im.height
    im = im.resize((max(1, round(im.width * k)), height), Image.LANCZOS)
    if im.width > size:                                    # 太宽（骑兵、长兵器）再缩
        k = size / im.width
        im = im.resize((size, max(1, round(im.height * k))), Image.LANCZOS)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.alpha_composite(im, ((size - im.width) // 2, foot - im.height))
    out.save(dst, optimize=True)


def head(src, dst):
    im = Image.open(src).convert('RGBA')
    w, h = im.size
    s = int(w * 0.56)
    x0, y0 = (w - s) // 2, int(h * 0.04)
    im.crop((x0, y0, x0 + s, y0 + s)).resize((256, 256), Image.LANCZOS).save(dst, optimize=True)


def flat(src, dst, longest, bg=(0, 0, 0)):
    im = Image.open(src).convert('RGBA')
    im.thumbnail((longest, longest), Image.LANCZOS)
    base = Image.new('RGB', im.size, bg)
    base.paste(im, mask=im.getchannel('A'))
    base.save(dst, quality=86)


def main():
    for d in ('heroes', 'enemies', 'cutins', 'fx', 'scenery'):
        os.makedirs(os.path.join(DST, d), exist_ok=True)
    for hid, f in HEROES.items():
        sprite(os.path.join(SRC, 'sprites', f + '.png'), os.path.join(DST, 'heroes', hid + '.png'))
        if os.path.exists(os.path.join(SRC, 'portraits', f + '.png')):
            head(os.path.join(SRC, 'portraits', f + '.png'), os.path.join(DST, 'heroes', hid + '_head.png'))
        if os.path.exists(os.path.join(SRC, 'cutins', f + '.png')):
            flat(os.path.join(SRC, 'cutins', f + '.png'), os.path.join(DST, 'cutins', hid + '.jpg'), 768, (20, 12, 8))
    for eid, f in ENEMIES.items():
        sprite(os.path.join(SRC, 'sprites', f + '.png'), os.path.join(DST, 'enemies', eid + '.png'))
    for i, f in enumerate(BOSSES):
        sprite(os.path.join(SRC, 'sprites', f + '.png'), os.path.join(DST, 'enemies', 'boss_%d.png' % (i + 1)))
    for f, n in SCENERY.items():
        im = Image.open(os.path.join(SRC, 'buildings', f + '.png')).convert('RGBA')
        im.thumbnail((n, n), Image.LANCZOS)
        im.save(os.path.join(DST, 'scenery', f + '.png'), optimize=True)
    for f, n in FX.items():
        flat(os.path.join(SRC, 'fx', f + '.png'), os.path.join(DST, 'fx', f + '.jpg'), n)
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
                 ' * 由 serve.ps1 或 tools/import_buyi_art.py 自动生成，也可以手动编辑。 */\n')
        fp.write('window.ASSET_LIST = [\n' + ''.join("  '%s',\n" % f for f in files) + '];\n')
    total = sum(os.path.getsize(os.path.join(DST, f)) for f in files)
    print('%d files, %.1f MB' % (len(files), total / 1048576))


if __name__ == '__main__':
    main()
