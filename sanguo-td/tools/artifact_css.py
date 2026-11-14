#!/usr/bin/env python3
"""给 claude.ai 试玩页（Artifact）用的样式表：把三个字体文件直接嵌进 CSS（base64），试玩页里就不用单独放 .woff2 了。

为什么：试玩页要「公开分享」时平台会审核里面的文件，只认 JPEG / PNG / GIF / WebP 图片和常见音视频，字体文件过不了。
正式上线（自己的服务器、小游戏平台）不需要这个，照常用 css/style.css + assets/fonts/。

用法：python3 sanguo-td/tools/artifact_css.py [输出路径]
      默认写到 sanguo-td/tools/_artifact/style.css；发布试玩页时把它当作 css/style.css 发上去，并且不要发 assets/fonts/。
"""
import base64, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'tools', '_artifact', 'style.css')
css = open(os.path.join(ROOT, 'css', 'style.css'), encoding='utf8').read()

def embed(m):
    path = os.path.normpath(os.path.join(ROOT, 'css', m.group(1)))
    data = base64.b64encode(open(path, 'rb').read()).decode()
    return "url('data:font/woff2;base64,%s')" % data

css2, n = re.subn(r"url\('(\.\./assets/fonts/[\w.-]+\.woff2)'\)", embed, css)
os.makedirs(os.path.dirname(out), exist_ok=True)
open(out, 'w', encoding='utf8').write(css2)
print('%d 个字体嵌进了样式表：%s（%d KB）' % (n, out, len(css2.encode()) // 1024))
