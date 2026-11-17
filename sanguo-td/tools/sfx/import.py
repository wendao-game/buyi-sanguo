#!/usr/bin/env python3
"""把生成 / 录好的音效导入游戏：裁掉头尾的空白、限制时长、把峰值统一到 -2 dB、转成单声道 mp3，放进 assets/sfx/，再重写素材清单。
需要 ffmpeg。源文件可以是 mp3 / wav / ogg / m4a，也可以是带声音的 mp4（只取音轨）。

用法（在仓库根目录跑）：
  python3 sanguo-td/tools/sfx/import.py <源文件> <音效名> [最长几秒=2.5]
  例：python3 sanguo-td/tools/sfx/import.py ~/下载/雷.mp4 ult_thunder
音效名见 js/sfx.js 的 BANK（ult_fire、ult_thunder、boom、thunder …），游戏里同名的音效就改播这个文件。
删掉 assets/sfx/ 里的文件、再跑一次 tools/slice_sheets.py，就回到合成的版本。"""
import os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
if len(sys.argv) < 3:
    sys.exit(__doc__)
src, name, mx = sys.argv[1], sys.argv[2], float(sys.argv[3]) if len(sys.argv) > 3 else 2.5
out_dir = os.path.join(ROOT, 'assets', 'sfx')
os.makedirs(out_dir, exist_ok=True)
dst = os.path.join(out_dir, name + '.mp3')
# 头尾的空白裁掉（-55 dB 以下算空白）；限时长；结尾 0.1 秒淡出，免得硬切出一声「咔」
trim = ('silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.01,'
        'atrim=0:%.2f,areverse,silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.02,afade=t=in:d=0.1,areverse' % mx)
# 音量：量一遍峰值，统一拉到 -2 dB（这些音效只有一秒上下，按响度标准化不准，按峰值来；游戏里每个音效再乘各自的音量，见 js/sfx.js 的 FILE_VOL）
r = subprocess.run(['ffmpeg', '-hide_banner', '-i', src, '-vn', '-af', trim + ',volumedetect', '-f', 'null', '-'], capture_output=True, text=True).stderr
mxv = float(re.search(r'max_volume: (-?[\d.]+) dB', r).group(1))
gain = max(-20.0, min(24.0, -2.0 - mxv))
subprocess.check_call(['ffmpeg', '-loglevel', 'error', '-y', '-i', src, '-vn', '-ac', '1', '-ar', '44100', '-af', trim + ',volume=%.1fdB' % gain, '-b:a', '112k', dst])
dur = subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', dst]).decode().strip()
print('%s → assets/sfx/%s.mp3  %.2f 秒  %d KB  音量 %+.1f dB' % (os.path.basename(src), name, float(dur), os.path.getsize(dst) // 1024, gain))
if not os.environ.get('SFX_NO_MANIFEST'):                   # 一次导入很多个的时候，最后再统一重写清单
    subprocess.check_call([sys.executable, os.path.join(ROOT, 'tools', 'slice_sheets.py')], cwd=os.path.dirname(ROOT), stdout=subprocess.DEVNULL)
