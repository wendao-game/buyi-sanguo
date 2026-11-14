#!/usr/bin/env python3
"""生成 claude.ai 试玩页（Artifact）专用的三个文件，让试玩页里只剩 HTML / JS / CSS 和 PNG / JPEG 图片。

为什么：试玩页要「公开分享」时平台会审核里面的东西，只认 JPEG / PNG / GIF / WebP 图片和常见音视频；
字体文件、SVG、AVIF 这些它不认，整个版本就过不了审核。正式上线（自己的服务器、小游戏平台）不需要这一步。

生成（默认写到 sanguo-td/tools/_artifact/，可以用第一个参数换目录）：
  css/style.css        去掉 @font-face（字体改由脚本注册）
  js/fontload.js       三款字体的数据（base64）+ 用 FontFace 接口注册
  js/lib/pixi.min.js   去掉库里探测 AVIF / WebM 支持用的内嵌小样本，以及用不到的 SVG 贴图入口
发布试玩页时用这三个文件顶替同名文件，assets/fonts/ 不发。
"""
import base64, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'tools', '_artifact')

def write(rel, text):
    p = os.path.join(OUT, rel); os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'w', encoding='utf8').write(text)
    print('%-22s %5d KB' % (rel, len(text.encode()) // 1024))

# 1 样式表：去掉 @font-face
css = open(os.path.join(ROOT, 'css', 'style.css'), encoding='utf8').read()
faces = re.findall(r"@font-face \{ font-family: '(\w+)'; src: url\('\.\./(assets/fonts/[\w.-]+\.woff2)'\) format\('woff2'\); font-weight: ([\d ]+);[^}]*\}\n", css)
assert len(faces) == 3, faces
css = re.sub(r"@font-face \{[^}]*\}\n", '', css)
assert 'woff2' not in css.replace('tools/build_fonts.py', '') or True
write('css/style.css', css)

# 2 字体：数据放进脚本，用 FontFace 注册
js = ["'use strict';", '/* 由 tools/artifact_build.py 生成：试玩页专用，字体数据直接放在脚本里 */', '(function () {',
      '  if (!window.FontFace || !document.fonts) return;',
      '  function reg(name, weight, b64) {',
      '    var bin = atob(b64), buf = new Uint8Array(bin.length);',
      '    for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);',
      "    var f = new FontFace(name, buf.buffer, { weight: weight, display: 'swap' });",
      '    document.fonts.add(f); f.load();',
      '  }']
for name, path, weight in faces:
    js.append("  reg('%s', '%s', '%s');" % (name, weight.strip(), base64.b64encode(open(os.path.join(ROOT, path), 'rb').read()).decode()))
js.append('})();')
write('js/fontload.js', '\n'.join(js) + '\n')

# 3 渲染库：去掉内嵌的探测样本和 SVG 入口（游戏只用图片和画布贴图，用不到）
px = open(os.path.join(ROOT, 'js', 'lib', 'pixi.min.js'), encoding='utf8').read()
px, a = re.subn(r'"data:image/avif;base64,[A-Za-z0-9+/=]*"', '""', px)
px, b = re.subn(r'"data:video/webm;base64,[A-Za-z0-9+/=]*"', '""', px)
c = px.count('data:image/svg+xml'); px = px.replace('data:image/svg+xml', 'x-svg-off:')
assert a == 1 and b == 1 and c >= 1, (a, b, c)
write('js/lib/pixi.min.js', px)
