"""乐天竞品分析 —— 运行入口

用法：
  python main.py            # 用真实乐天 API 抓取并分析（需要先在 config.yaml 填 API Key）
  python main.py --demo     # 演示模式：模拟数据，不需要 API Key
  python main.py -c 其他配置.yaml
"""
from __future__ import annotations

import argparse
import sys
import webbrowser
from datetime import date
from pathlib import Path

import yaml

from analysis import analyze
from collector import collect, load_previous, save_snapshot
from rakuten_api import RakutenAPIError, RakutenClient
from report import write_excel, write_html

HERE = Path(__file__).resolve().parent


def main():
    ap = argparse.ArgumentParser(description="乐天竞品分析")
    ap.add_argument("-c", "--config", default=str(HERE / "config.yaml"))
    ap.add_argument("--demo", action="store_true", help="用模拟数据演示")
    ap.add_argument("--out", default=str(HERE / "output"), help="报告输出目录")
    ap.add_argument("--no-open", action="store_true", help="完成后不自动打开报告")
    args = ap.parse_args()

    cfg = yaml.safe_load(Path(args.config).read_text(encoding="utf-8"))
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    today = date.today().isoformat()

    if args.demo:
        from demo import DemoClient, make_previous
        client = DemoClient(cfg)
        db = out / "history_demo.db"
    else:
        api = cfg.get("api", {})
        try:
            client = RakutenClient(api.get("application_id", ""), api.get("access_key", ""),
                                   api.get("site_url", ""), api["search_endpoint"],
                                   api.get("ranking_endpoint", ""), float(api.get("interval_seconds", 1.1)),
                                   cache_dir=HERE / "cache")
        except RakutenAPIError as e:
            sys.exit(f"❌ {e}\n（想先看效果可以运行：python main.py --demo）")
        db = out / "history.db"

    print("开始抓取数据…")
    try:
        df, kw_stats = collect(client, cfg)
    except RakutenAPIError as e:
        sys.exit(f"❌ 乐天 API 出错：{e}")
    if df.empty:
        sys.exit("没有抓到任何商品，请检查关键词和 API 设置。")
    print(f"共抓取 {len(df):,} 条记录，{df['item_code'].nunique():,} 个商品")

    if args.demo and load_previous(db, today).empty:
        save_snapshot(make_previous(df), db)
    prev = load_previous(db, today)
    save_snapshot(df, db)

    result = analyze(df, kw_stats, prev, cfg)
    suffix = "_demo" if args.demo else ""
    xlsx, page = out / f"竞品分析_{today}{suffix}.xlsx", out / f"竞品分析_{today}{suffix}.html"
    write_excel(result, df, xlsx)
    write_html(result, page, cfg)

    print("\n========== 要点 ==========")
    for c in result["categories"]:
        print(f"\n【{c['name']}】")
        for line in c["insights"]:
            print("  •", line)
    print(f"\n✅ Excel：{xlsx}\n✅ 网页报告：{page}")
    if not args.no_open:
        webbrowser.open(page.resolve().as_uri())


if __name__ == "__main__":
    main()
