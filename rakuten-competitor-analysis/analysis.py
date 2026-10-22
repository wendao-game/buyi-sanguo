"""竞品分析：价格带、竞争店铺、爆款、关键词排名、我的商品诊断、标题关键词、趋势。"""
from __future__ import annotations

import re
import unicodedata
from collections import Counter

import numpy as np
import pandas as pd

MARKET_SOURCES = ("search", "bestseller", "ranking")
TOP_N_TITLE = 60

# 标题里不算「关键词」的常见噱头词
STOP_WORDS = {"送料無料", "送料込", "楽天1位", "楽天ランキング1位", "ランキング1位", "1位", "あす楽",
              "ポイント", "倍", "クーポン", "クーポンで", "最大", "off", "OFF", "限定", "セール", "sale",
              "SALE", "新品", "即納", "翌日配送", "スーパーSALE", "お買い物マラソン", "P5倍", "P10倍",
              "円", "対象", "当店", "人気", "公式", "正規品", "1年保証", "送料無料!", "宅配便"}
_SPLIT = re.compile(r"[\s　【】\[\]（）()「」『』<>＜＞/／|｜・,，、。!！?？★☆◆◇■□●○▼▲♪※+＋&＆:：;；~〜…\"'#＃*＊=]+")
_NOISE = re.compile(r"^[\d.,×xX*~\-%cmｃｍmkgKGLlＬ円号型個枚本台点段]+$")


def tokenize(title: str) -> set[str]:
    t = unicodedata.normalize("NFKC", title or "")
    out = set()
    for w in _SPLIT.split(t):
        w = w.strip("-_.")
        if 2 <= len(w) <= 20 and w not in STOP_WORDS and not _NOISE.match(w) \
                and not re.search(r"(倍|%OFF|円OFF|クーポン|ポイント)", w, re.I):
            out.add(w)
    return out


def _yen(v) -> str:
    return "-" if v is None or pd.isna(v) else f"¥{int(round(v)):,}"


def dedup_items(df: pd.DataFrame) -> pd.DataFrame:
    """同一商品可能出现在多个关键词里：保留最好排名、命中关键词数。"""
    if df.empty:
        return df.assign(best_rank=pd.Series(dtype=float), best_keyword="", kw_hits=0)
    search = df[df["source"] == "search"]
    best = search.sort_values("search_rank").groupby(["category", "item_code"]).agg(
        best_rank=("search_rank", "first"), best_keyword=("keyword", "first"),
        kw_hits=("keyword", "nunique"))
    base = df.sort_values("review_count", ascending=False).drop_duplicates(["category", "item_code"])
    base = base.drop(columns=["keyword", "source", "search_rank"]).set_index(["category", "item_code"])
    out = base.join(best, how="left").reset_index()
    out["kw_hits"] = out["kw_hits"].fillna(0).astype(int)
    return out


# ---------- 各分析模块 ----------
def overview(cat, market, mine, kw_stats):
    top30 = market[market["best_rank"] <= 30]
    return {
        "品类": cat,
        "关键词数": int((kw_stats["category"] == cat).sum()) if not kw_stats.empty else 0,
        "搜索结果总数(最大关键词)": int(kw_stats.loc[kw_stats["category"] == cat, "total_items"].max())
        if not kw_stats.empty and (kw_stats["category"] == cat).any() else 0,
        "样本商品数": len(market),
        "价格中位数": market["price"].median(),
        "价格P25": market["price"].quantile(.25),
        "价格P75": market["price"].quantile(.75),
        "前30名均价": top30["price"].mean(),
        "前30名平均评价数": top30["review_count"].mean(),
        "前30名平均评分": top30.loc[top30["review_count"] > 0, "review_avg"].mean(),
        "包邮率": market["free_shipping"].mean(),
        "前30名平均积分倍率": top30["point_rate"].mean(),
        "我的商品数": len(mine),
        "我的最好排名": mine["best_rank"].min() if len(mine) else np.nan,
        "我的价格中位数": mine["price"].median() if len(mine) else np.nan,
        "我的评价总数": int(mine["review_count"].sum()) if len(mine) else 0,
    }


def price_bands(market, mine, bins):
    if market.empty:
        return pd.DataFrame()
    if not bins:
        bins = sorted(set(np.quantile(market["price"], [0, .2, .4, .6, .8, 1]).round(-2)))
        bins[0], bins[-1] = 0, max(bins[-1] + 1, 999999)
    labels = [f"¥{a:,}~{b - 1:,}" if b < 999999 else f"¥{a:,}以上" for a, b in zip(bins[:-1], bins[1:])]
    m = market.assign(band=pd.cut(market["price"], bins=bins, labels=labels, right=False))
    g = m.groupby("band", observed=False).agg(
        商品数=("item_code", "count"), 评价总数=("review_count", "sum"),
        前30名商品数=("best_rank", lambda s: int((s <= 30).sum())),
        平均评分=("review_avg", lambda s: s[s > 0].mean()))
    g["商品占比"] = g["商品数"] / max(g["商品数"].sum(), 1)
    g["评价占比"] = g["评价总数"] / max(g["评价总数"].sum(), 1)
    g["平均每品评价"] = g["评价总数"] / g["商品数"].replace(0, np.nan)
    # 机会指数 >1：这个价格带的需求（评价）比供给（商品数）多
    g["机会指数"] = (g["评价占比"] / g["商品占比"].replace(0, np.nan)).round(2)
    mine_band = pd.cut(mine["price"], bins=bins, labels=labels, right=False).value_counts() \
        if len(mine) else pd.Series(dtype=int)
    g["我的商品数"] = g.index.map(lambda b: int(mine_band.get(b, 0)))
    g["判断"] = [
        "★ 机会：需求大、竞争少" if (oi >= 1.3 and n >= 3) else
        ("红海：商品多、评价少" if (oi < 0.6 and n >= 5) else "")
        for oi, n in zip(g["机会指数"].fillna(0), g["商品数"])]
    return g.reset_index().rename(columns={"band": "价格带"})


def shop_ranking(market, own_codes):
    if market.empty:
        return pd.DataFrame()
    g = market.rename(columns={"shop_name": "店铺"}).groupby(["shop_code", "店铺"]).agg(
        上榜商品数=("item_code", "count"),
        前30名商品数=("best_rank", lambda s: int((s <= 30).sum())),
        最好排名=("best_rank", "min"),
        评价总数=("review_count", "sum"),
        平均价格=("price", "mean"),
        平均评分=("review_avg", lambda s: s[s > 0].mean()),
        包邮率=("free_shipping", "mean"),
        平均积分倍率=("point_rate", "mean"),
        店铺网址=("shop_url", "first"),
    ).reset_index()
    g["是我的店"] = g["shop_code"].isin(own_codes)
    g = g.sort_values(["前30名商品数", "评价总数"], ascending=False).reset_index(drop=True)
    g.insert(0, "名次", g.index + 1)
    return g.head(40)


def bestsellers(market, n=20):
    cols = ["item_name", "shop_name", "price", "review_count", "review_avg", "point_rate",
            "free_shipping", "best_rank", "is_own", "item_url", "image_url"]
    names = ["商品名", "店铺", "价格", "评价数", "评分", "积分倍率", "包邮", "最好排名", "是我的店", "item_url", "image_url"]
    return market.sort_values("review_count", ascending=False).head(n)[cols].set_axis(names, axis=1) \
        .reset_index(drop=True)


def keyword_table(df_cat, kw_stats_cat, own_codes):
    rows = []
    search = df_cat[df_cat["source"] == "search"]
    for _, k in kw_stats_cat.iterrows():
        s = search[search["keyword"] == k["keyword"]].sort_values("search_rank")
        mine = s[s["shop_code"].isin(own_codes)]
        top10 = s.head(10)
        first = s.iloc[0] if len(s) else None
        rows.append({
            "关键词": k["keyword"], "搜索结果数": k["total_items"],
            "我的最好排名": int(mine["search_rank"].min()) if len(mine) else None,
            f"我在前{len(s)}名的商品数": len(mine),
            "第1名店铺": first["shop_name"] if first is not None else "",
            "第1名价格": first["price"] if first is not None else None,
            "第1名评价数": first["review_count"] if first is not None else None,
            "前10名均价": top10["price"].mean(), "前10名平均评价": top10["review_count"].mean(),
            "前10名包邮率": top10["free_shipping"].mean(),
        })
    return pd.DataFrame(rows)


def title_keywords(market, mine):
    top = market[market["best_rank"] <= TOP_N_TITLE]
    if top.empty:
        top = market.head(TOP_N_TITLE)
    top10 = market[market["best_rank"] <= 10]
    c_top = Counter(w for t in top["item_name"] for w in tokenize(t))
    c_10 = Counter(w for t in top10["item_name"] for w in tokenize(t))
    c_me = Counter(w for t in mine["item_name"] for w in tokenize(t))
    rows = []
    for w, n in c_top.most_common(60):
        if n < 3:
            break
        r_top, r_10 = n / len(top), c_10[w] / max(len(top10), 1)
        r_me = c_me[w] / len(mine) if len(mine) else 0
        rows.append({"关键词": w, f"前{TOP_N_TITLE}名使用率": r_top, "前10名使用率": r_10, "我的商品使用率": r_me,
                     "建议": "竞品常用，我的标题缺少 → 考虑加入" if r_top >= .15 and r_me < .2 else ""})
    return pd.DataFrame(rows)


def diagnose_mine(mine, market, kw_df, title_df, cfg_fetch):
    if mine.empty:
        return pd.DataFrame()
    p25, p50, p75 = market["price"].quantile([.25, .5, .75])
    top10 = market[market["best_rank"] <= 10]
    top30 = market[market["best_rank"] <= 30]
    free_rate = market["free_shipping"].mean()
    top_point = top30["point_rate"].mean() if len(top30) else 1
    top10_reviews = top10["review_count"].median() if len(top10) else 0
    depth = int(cfg_fetch.get("search_pages", 3)) * 30
    hot_words = [] if title_df.empty else title_df.loc[title_df.iloc[:, 1] >= .2, "关键词"].tolist()
    prices = np.sort(market["price"].values)

    rows = []
    for _, it in mine.iterrows():
        tips = []
        rank = it["best_rank"]
        if pd.isna(rank):
            tips.append(f"所有关键词前{depth}名都搜不到 → 优化标题、投 RPP 广告")
        elif rank > 30:
            tips.append(f"最好排名第{int(rank)}名（未进前30）→ 标题加热词 / 提高转化")
        if it["price"] > p75 and it["review_count"] < top10_reviews:
            tips.append(f"价格 {_yen(it['price'])} 高于75%竞品（中位 {_yen(p50)}），评价又少 → 降价或发优惠券")
        elif it["price"] < p25 and it["review_count"] >= top10_reviews:
            tips.append(f"价格低于75%竞品且评价充足 → 有提价空间")
        if not it["free_shipping"] and free_rate >= .6:
            tips.append(f"{free_rate:.0%} 竞品包邮，你是送料別 → 建议改送料無料")
        if it["point_rate"] < top_point - 0.5:
            tips.append(f"积分 {it['point_rate']} 倍，前30名平均 {top_point:.1f} 倍 → 活动期可加倍")
        if it["review_count"] < 10:
            tips.append("评价少于10条 → 做レビュー特典（评价送礼）")
        elif it["review_avg"] and it["review_avg"] < 4.0:
            tips.append(f"评分 {it['review_avg']:.2f} 偏低 → 查看差评改进")
        words = tokenize(it["item_name"])
        missing = [w for w in hot_words if w not in words][:4]
        if missing:
            tips.append("标题可加：" + "、".join(missing))
        rows.append({
            "店铺": it["shop_name"], "商品名": it["item_name"], "价格": it["price"],
            "价格分位": np.searchsorted(prices, it["price"]) / max(len(prices), 1),
            "比中位价": it["price"] / p50 - 1 if p50 else np.nan,
            "评价数": it["review_count"], "评分": it["review_avg"], "积分倍率": it["point_rate"],
            "包邮": it["free_shipping"], "最好排名": rank, "最好排名关键词": it.get("best_keyword"),
            "诊断建议": "\n".join(tips) if tips else "表现良好", "item_url": it["item_url"],
        })
    return pd.DataFrame(rows).sort_values("最好排名", na_position="last").reset_index(drop=True)


def trend(cur_items, prev_df, review_rate, own_codes):
    """和上一次快照比：评价增长（≈销量）、价格变化、排名变化。"""
    if prev_df is None or prev_df.empty:
        return pd.DataFrame(), None
    prev = dedup_items(prev_df)
    days = max((pd.Timestamp(cur_items["run_date"].iloc[0]) - pd.Timestamp(prev["run_date"].iloc[0])).days, 1)
    m = cur_items.merge(prev[["category", "item_code", "price", "review_count", "best_rank"]],
                        on=["category", "item_code"], how="inner", suffixes=("", "_prev"))
    m["评价增长"] = m["review_count"] - m["review_count_prev"]
    m["估算月销量"] = (m["评价增长"].clip(lower=0) / days * 30 / review_rate).round()
    m["价格变化"] = m["price"] - m["price_prev"]
    m["排名变化"] = m["best_rank_prev"] - m["best_rank"]  # 正数 = 上升
    m["是我的店"] = m["shop_code"].isin(own_codes)
    cols = ["category", "shop_name", "item_name", "price", "price_prev", "价格变化", "review_count",
            "评价增长", "估算月销量", "best_rank", "best_rank_prev", "排名变化", "是我的店", "item_url"]
    m = m[cols].rename(columns={"category": "品类", "shop_name": "店铺", "item_name": "商品名",
                                "price": "现价", "price_prev": "上次价格", "review_count": "评价数",
                                "best_rank": "现排名", "best_rank_prev": "上次排名"})
    return m.sort_values("评价增长", ascending=False).reset_index(drop=True), days


def insights(cat, ov, bands, shops, kw_df, title_df):
    """品类级别的结论（中文要点）。"""
    out = []
    if not bands.empty:
        opp = bands[bands["判断"].str.startswith("★")]
        for _, b in opp.iterrows():
            tag = "（你还没有商品）" if b["我的商品数"] == 0 else f"（你有 {b['我的商品数']} 款）"
            out.append(f"价格带 {b['价格带']} 机会指数 {b['机会指数']}：评价占比 {b['评价占比']:.0%}、"
                       f"商品只占 {b['商品占比']:.0%}{tag}")
        hot = bands.sort_values("评价总数", ascending=False).iloc[0]
        out.append(f"卖得最多的价格带是 {hot['价格带']}（评价占比 {hot['评价占比']:.0%}）")
    if not shops.empty:
        lead = shops[~shops["是我的店"]].head(3)
        out.append("主要对手：" + "、".join(f"{r.店铺}（前30名 {r.前30名商品数} 款，评价 {int(r.评价总数):,}）"
                                       for r in lead.itertuples()))
        mine = shops[shops["是我的店"]]
        if len(mine):
            out.append("我的店铺排名：" + "、".join(f"{r.店铺} 第{r.名次}名" for r in mine.itertuples()))
        else:
            out.append("我的店铺没有进入该品类搜索结果的店铺排行 → 该品类曝光不足")
    if not kw_df.empty:
        miss = kw_df[kw_df["我的最好排名"].isna()]["关键词"].tolist()
        if miss:
            out.append("这些关键词下你没有商品上榜：" + "、".join(miss))
    if pd.notna(ov["前30名平均评价数"]):
        out.append(f"进前30名平均需要约 {ov['前30名平均评价数']:.0f} 条评价、均价 {_yen(ov['前30名均价'])}、"
                   f"包邮率 {ov['包邮率']:.0%}")
    if not title_df.empty:
        need = title_df[title_df["建议"] != ""]["关键词"].head(8).tolist()
        if need:
            out.append("标题热词（你用得少）：" + "、".join(need))
    return out


# ---------- 总入口 ----------
def analyze(df: pd.DataFrame, kw_stats: pd.DataFrame, prev_df: pd.DataFrame | None, cfg: dict) -> dict:
    own_codes = {s["code"] for s in cfg.get("my_shops", [])}
    df = df.copy()
    df["is_own"] = df["shop_code"].isin(own_codes)
    items = dedup_items(df)
    items["is_own"] = items["shop_code"].isin(own_codes)
    result = {"categories": [], "overview": [], "own_codes": own_codes}

    market_keys = df[df["source"].isin(MARKET_SOURCES)][["category", "item_code"]].drop_duplicates()
    for cat_cfg in cfg["categories"]:
        cat = cat_cfg["name"]
        ci = items[items["category"] == cat]
        market = ci.merge(market_keys[market_keys["category"] == cat], on=["category", "item_code"])
        mine = ci[ci["is_own"]]
        kw_cat = kw_stats[kw_stats["category"] == cat] if not kw_stats.empty else kw_stats
        ov = overview(cat, market, mine, kw_stats)
        bands = price_bands(market, mine, cat_cfg.get("price_bins"))
        shops = shop_ranking(market, own_codes)
        kw_df = keyword_table(df[df["category"] == cat], kw_cat, own_codes) if not kw_cat.empty else pd.DataFrame()
        title_df = title_keywords(market, mine)
        diag = diagnose_mine(mine, market, kw_df, title_df, cfg.get("fetch", {})) if len(market) else pd.DataFrame()
        watch_codes = {s["code"] for s in (cfg.get("watch_shops") or [])}
        watch = ci[ci["shop_code"].isin(watch_codes)]
        result["overview"].append(ov)
        result["categories"].append({
            "name": cat, "overview": ov, "bands": bands, "shops": shops,
            "bestsellers": bestsellers(market), "keywords": kw_df, "titles": title_df,
            "mine": diag, "watch": watch,
            "insights": insights(cat, ov, bands, shops, kw_df, title_df),
        })

    result["trend"], result["trend_days"] = trend(items, prev_df, float(cfg.get("review_rate", 0.03)), own_codes)
    result["items"] = items
    return result
