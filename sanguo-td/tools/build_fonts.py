"""按游戏里实际用到的字，把两款开源中文字体裁成小文件，放进 assets/fonts/（本地加载，不走外网）。

用法（在仓库根目录）：python3 sanguo-td/tools/build_fonts.py      需要：pip install fonttools brotli
改了游戏里的文字（新武将名、新技能名、新界面文字）之后重新运行一次；
没重新运行也不会出错，只是新出现的字会退回系统字体。

字体（都是 SIL Open Font License 1.1，可商用、可随游戏分发，许可全文在 tools/fonts-src/）：
  站酷快乐体 ZCOOL KuaiLe   → assets/fonts/round.woff2   按钮、标题、武将名、数字
  马善政毛笔体 Ma Shan Zheng → assets/fonts/brush.woff2   logo、大招名、胜负大字（只留用得到的汉字）
  Fredoka 600               → assets/fonts/num.woff2     数字和英文字母（快乐体的数字太花，不好认）
"""
import glob
import os
import shutil
from fontTools import subset

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(HERE, 'fonts-src')
OUT = os.path.join(ROOT, 'assets', 'fonts')


def game_chars():
    files = glob.glob(os.path.join(ROOT, 'js', '*.js')) + [os.path.join(ROOT, 'index.html')]
    text = ''.join(open(f, encoding='utf8').read() for f in files)
    return set(text)


# 毛笔体只用在大字上：下面这些固定的标题，加上 data.js 里的武将名、大招名、章节名、敌将名、军令名、缘分名
BRUSH_TEXT = '主城武将招募烽火守城三国塔防群英招募大获全胜城池失守最终波来袭第波章关出征觉醒军令三选一招募结果概率公示暂停设置存档码读入重置羁绊一览礼包'


def brush_chars():
    import re
    data = open(os.path.join(ROOT, 'js', 'data.js'), encoding='utf8').read()
    text = BRUSH_TEXT
    for line in data.split('\n'):
        if line.lstrip().startswith("H('"):
            text += ''.join(re.findall(r"'([^']*)'", line))
    text += ''.join(re.findall(r"(?:name|boss): '([^']*)'", data))
    return {c for c in text if '\u4e00' <= c <= '\u9fff'}


def build(src, dst, chars):
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    font = subset.load_font(os.path.join(SRC, src), opts)
    s = subset.Subsetter(opts)
    s.populate(unicodes=sorted(ord(c) for c in chars))
    s.subset(font)
    subset.save_font(font, os.path.join(OUT, dst), opts)
    return os.path.getsize(os.path.join(OUT, dst))


def main():
    os.makedirs(OUT, exist_ok=True)
    chars = game_chars()
    cjk = {c for c in chars if '一' <= c <= '鿿'}
    ascii_ = {chr(i) for i in range(32, 127)}
    punct = set('，。：；！？、（）【】《》“”‘’…—·％＋－×÷')
    n1 = build('zcool-kuaile.woff2', 'round.woff2', cjk | ascii_ | punct)
    n2 = build('ma-shan-zheng.woff2', 'brush.woff2', brush_chars() | set('·【】：！'))
    n3 = build('fredoka-600.woff2', 'num.woff2', ascii_ | set('×'))
    for f in ('zcool-kuaile.OFL.txt', 'ma-shan-zheng.OFL.txt', 'fredoka.OFL.txt'):
        shutil.copy(os.path.join(SRC, f), os.path.join(OUT, f))
    print('%d 个汉字（毛笔体 %d 个）；round.woff2 %d KB，brush.woff2 %d KB，num.woff2 %d KB' % (len(cjk), len(brush_chars()), n1 // 1024, n2 // 1024, n3 // 1024))


if __name__ == '__main__':
    main()
