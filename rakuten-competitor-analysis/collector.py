"""按配置抓取数据，并把每次的快照存进 SQLite（用来看排名、价格、评价的变化趋势）。"""
from __future__ import annotations

import sqlite3
from datetime import date
from pathlib import Path

import pandas as pd

COLUMNS = ["run_date", "category", "keyword", "source", "search_rank", "item_code", "item_name",
           "catchcopy", "price", "item_url", "image_url", "shop_code", "shop_name", "shop_url",
           "review_count", "review_avg", "point_rate", "free_shipping", "genre_id"]


def _rows(items, *, category, keyword, source, start_rank=1, run_date):
    out = []
    for i, it in enumerate(items):
        row = {k: it.get(k) for k in COLUMNS if k in it}
        row.update(run_date=run_date, category=category, keyword=keyword, source=source,
                   search_rank=it.get("rank") or (start_rank + i))
        out.append(row)
    return out


def collect(client, cfg: dict, log=print) -> tuple[pd.DataFrame, pd.DataFrame]:
    """返回 (商品明细 DataFrame, 关键词竞争度 DataFrame)"""
    run_date = date.today().isoformat()
    fetch = cfg.get("fetch", {})
    search_pages = int(fetch.get("search_pages", 3))
    best_pages = int(fetch.get("bestseller_pages", 1))
    shop_pages = int(fetch.get("shop_pages", 5))
    shops = [("own", s["code"]) for s in cfg.get("my_shops", [])] + \
            [("watch", s["code"]) for s in (cfg.get("watch_shops") or [])]

    rows, kw_stats = [], []
    for cat in cfg["categories"]:
        name = cat["name"]
        genre = cat.get("genre_id") or None
        ng = " ".join(cat.get("exclude") or []) or None
        for kw in cat["keywords"]:
            log(f"[{name}] 搜索「{kw}」…")
            total = 0
            for page in range(1, search_pages + 1):
                res = client.search(keyword=kw, genre_id=genre, ng_keyword=ng, page=page, sort="standard")
                total = total or res["count"]
                rows += _rows(res["items"], category=name, keyword=kw, source="search",
                              start_rank=(page - 1) * 30 + 1, run_date=run_date)
                if page >= res["page_count"]:
                    break
            kw_stats.append({"category": name, "keyword": kw, "total_items": total})

            for page in range(1, best_pages + 1):
                res = client.search(keyword=kw, genre_id=genre, ng_keyword=ng, page=page, sort="-reviewCount")
                rows += _rows(res["items"], category=name, keyword=kw, source="bestseller",
                              start_rank=(page - 1) * 30 + 1, run_date=run_date)
                if page >= res["page_count"]:
                    break

            for source, shop in shops:
                for page in range(1, shop_pages + 1):
                    res = client.search(keyword=kw, shop_code=shop, genre_id=genre, ng_keyword=ng, page=page)
                    rows += _rows(res["items"], category=name, keyword=kw, source=source,
                                  start_rank=(page - 1) * 30 + 1, run_date=run_date)
                    if page >= res["page_count"]:
                        break

        if genre and client.ranking_endpoint:
            log(f"[{name}] 抓取类目 {genre} 排行榜…")
            try:
                rows += _rows(client.ranking(genre), category=name, keyword=f"ランキング:{genre}",
                              source="ranking", run_date=run_date)
            except Exception as e:  # 排行榜是可选功能，失败不影响主流程
                log(f"  排行榜获取失败（跳过）：{e}")

    df = pd.DataFrame(rows, columns=COLUMNS)
    return df, pd.DataFrame(kw_stats)


# ---------- 历史快照 ----------
def save_snapshot(df: pd.DataFrame, db_path: str | Path):
    if df.empty:
        return
    with sqlite3.connect(db_path) as con:
        run_date = df["run_date"].iloc[0]
        try:
            con.execute("DELETE FROM snapshots WHERE run_date = ?", (run_date,))
        except sqlite3.OperationalError:
            pass  # 第一次运行还没有表
        df.to_sql("snapshots", con, if_exists="append", index=False)


def load_previous(db_path: str | Path, before: str) -> pd.DataFrame:
    """取 before 之前最近一次的快照；没有就返回空表。"""
    if not Path(db_path).exists():
        return pd.DataFrame(columns=COLUMNS)
    with sqlite3.connect(db_path) as con:
        try:
            prev = con.execute("SELECT MAX(run_date) FROM snapshots WHERE run_date < ?", (before,)).fetchone()[0]
        except sqlite3.OperationalError:
            return pd.DataFrame(columns=COLUMNS)
        if not prev:
            return pd.DataFrame(columns=COLUMNS)
        return pd.read_sql("SELECT * FROM snapshots WHERE run_date = ?", con, params=(prev,))
