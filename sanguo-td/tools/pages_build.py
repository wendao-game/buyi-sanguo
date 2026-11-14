#!/usr/bin/env python3
"""把游戏运行需要的文件拷到一个目录里（发网页版用）：index.html、css/、js/、assets/（不带 _sheets 原图）。
不带 tools/、文档和拼图原图，大约 7MB。已有的同名文件会被覆盖，不会删除任何东西。

网页版怎么更新（网站是从 gh-pages 分支发布的，不是 main；布衣三国的网页版也在这个分支的根目录）：
  1. git worktree add <临时目录> origin/gh-pages         # 把 gh-pages 检出到一个临时目录
  2. python3 sanguo-td/tools/pages_build.py <临时目录>/sanguo-td
  3. 在临时目录里 git add sanguo-td，提交，再 git push origin HEAD:gh-pages
一两分钟后 https://wendao-game.github.io/buyi-sanguo/sanguo-td/ 就是新版本。只动 sanguo-td/ 这个文件夹，别碰根目录的文件。
"""
import os, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if len(sys.argv) < 2:
    sys.exit('用法：python3 sanguo-td/tools/pages_build.py <输出目录>')
out = os.path.abspath(sys.argv[1])
os.makedirs(out, exist_ok=True)
shutil.copy(os.path.join(ROOT, 'index.html'), out)
for d in ('css', 'js'):
    shutil.copytree(os.path.join(ROOT, d), os.path.join(out, d), dirs_exist_ok=True)
shutil.copytree(os.path.join(ROOT, 'assets'), os.path.join(out, 'assets'), ignore=shutil.ignore_patterns('_sheets'), dirs_exist_ok=True)
n = sum(len(fs) for _, _, fs in os.walk(out))
size = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(out) for f in fs)
print('%d 个文件，%.1f MB → %s' % (n, size / 1e6, out))
