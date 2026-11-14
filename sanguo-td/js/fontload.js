'use strict';
/* 字体加载的占位文件。
 * 正常情况下字体由 css/style.css 里的 @font-face 从 assets/fonts/*.woff2 加载，这个文件什么都不做。
 * 只有发 claude.ai 试玩页时，tools/artifact_build.py 会生成一份同名文件顶替它：把三款字体的数据直接放在脚本里、
 * 用 FontFace 接口注册（试玩页公开分享的审核不认字体文件）。 */
