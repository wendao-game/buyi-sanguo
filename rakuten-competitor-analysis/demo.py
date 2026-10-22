"""演示模式：用模拟数据跑完整流程，不需要 API Key，用来先看看报告长什么样。"""
from __future__ import annotations

import random
from datetime import date, timedelta

import numpy as np
import pandas as pd

VOCAB = {
    "桌子": (["パソコンデスク", "ローテーブル", "折りたたみテーブル", "デスク", "センターテーブル", "学習机"],
            ["木製", "おしゃれ", "北欧", "幅120cm", "幅90cm", "収納付き", "昇降式", "ホワイト", "ブラウン",
             "在宅勤務", "テレワーク", "一人暮らし", "コンパクト", "組立簡単", "L字"], 3000, 12000),
    "宠物笼子": (["ペットケージ", "犬 ケージ", "猫 ケージ", "うさぎ ケージ", "サークル"],
             ["屋根付き", "折りたたみ", "キャスター付き", "大型犬", "小型犬", "多頭飼い", "2段", "3段",
              "スチール", "トレー付き", "脱走防止", "室内", "おしゃれ"], 5000, 25000),
    "宠物厕所": (["犬 トイレ", "猫 トイレ", "システムトイレ", "トイレトレー"],
             ["メッシュ", "飛び散り防止", "フード付き", "大型", "しつけ", "消臭", "スコップ付き",
              "壁付き", "引き出し式", "おしゃれ"], 1500, 6000),
    "航空箱": (["ペットキャリー ハード", "クレート", "猫 キャリー", "航空 キャリー"],
            ["IATA基準", "飛行機", "通院", "防災", "小型犬", "中型犬", "猫", "持ち運び", "上開き",
             "ハードキャリー", "コンテナ", "車載"], 2500, 9000),
}
SHOPS = [("sanc66666", "SANC SHOP"), ("happy8888", "HAPPY LIFE")] + \
        [(f"shop{i:02d}", n) for i, n in enumerate(
            ["家具のホンポ", "ペットランド", "Lifeplus", "インテリアMIRAI", "わんにゃん本舗", "ルームファクトリー",
             "PET-STAR", "暮らしの雑貨屋", "ぺっとくらぶ", "Kagu-ya", "MOFF", "アイデア生活館", "Petio Direct",
             "モダンデコ", "わんだふる", "よろずや家具", "ニャンズ", "Comfort Home", "ペット用品のさくら",
             "ホームテイスト"])]


class DemoClient:
    ranking_endpoint = ""

    def __init__(self, cfg: dict, seed: int = 7):
        self.rng = random.Random(seed)
        self.kw2cat = {kw: c["name"] for c in cfg["categories"] for kw in c["keywords"]}
        self.pool = {c["name"]: self._make_pool(c["name"], c["keywords"]) for c in cfg["categories"]}

    def _make_pool(self, cat, keywords):
        heads, mods, lo, hi = VOCAB.get(cat, VOCAB["桌子"])
        rng, items = self.rng, []
        for n in range(160):
            code, sname = SHOPS[0] if n % 23 == 0 else SHOPS[1] if n % 29 == 1 else rng.choice(SHOPS[2:])
            price = int(np.clip(rng.lognormvariate(np.log((lo + hi) / 2), 0.55), lo * 0.4, hi * 3) // 10 * 10 - 20)
            reviews = int(rng.paretovariate(1.1) * 8) if rng.random() > .15 else rng.randint(0, 5)
            title = "【" + rng.choice(["楽天1位", "送料無料", "P5倍", "クーポン"]) + "】 " + \
                    " ".join([rng.choice(heads)] + rng.sample(mods, 5))
            items.append({
                "item_code": f"{code}:{cat}-{n}", "item_name": title, "catchcopy": "", "price": price,
                "item_url": f"https://item.rakuten.co.jp/{code}/{n}/", "image_url": "",
                "shop_code": code, "shop_name": sname, "shop_url": f"https://www.rakuten.co.jp/{code}/",
                "review_count": min(reviews, 4000), "review_avg": round(rng.uniform(3.4, 4.9), 2) if reviews else 0,
                "point_rate": rng.choice([1, 1, 1, 2, 5, 10]), "free_shipping": rng.random() < .75,
                "genre_id": "0", "rank": None,
                "_kw": set(rng.sample(keywords, rng.randint(1, len(keywords)))),
                "_score": np.log1p(reviews) + rng.uniform(0, 3),
            })
        return items

    def search(self, keyword=None, shop_code=None, page=1, hits=30, sort="standard", **_):
        cat = self.kw2cat.get(keyword)
        items = [x for x in self.pool.get(cat, []) if keyword in x["_kw"]
                 and (not shop_code or x["shop_code"] == shop_code)]
        key = {"-reviewCount": lambda x: -x["review_count"], "+itemPrice": lambda x: x["price"]}.get(
            sort, lambda x: -x["_score"])
        items.sort(key=key)
        chunk = items[(page - 1) * hits: page * hits]
        clean = [{k: v for k, v in x.items() if not k.startswith("_")} for x in chunk]
        return {"count": len(items) * 37, "page_count": -(-len(items) // hits), "items": clean}

    def ranking(self, *_a, **_k):
        return []


def make_previous(df: pd.DataFrame, days: int = 7, seed: int = 3) -> pd.DataFrame:
    """伪造一份 N 天前的快照，演示「趋势变化」功能。"""
    rng = np.random.default_rng(seed)
    prev = df.copy()
    prev["run_date"] = (date.today() - timedelta(days=days)).isoformat()
    codes = prev["item_code"].unique()
    grow = dict(zip(codes, rng.integers(0, 6, len(codes)) * (rng.random(len(codes)) < .4)))
    hot = rng.choice(codes, size=min(12, len(codes)), replace=False)
    for c in hot:
        grow[c] = int(rng.integers(15, 60))
    prev["review_count"] = (prev["review_count"] - prev["item_code"].map(grow)).clip(lower=0)
    change = dict(zip(codes, np.where(rng.random(len(codes)) < .08, rng.choice([-500, -300, 200, 500], len(codes)), 0)))
    prev["price"] = prev["price"] - prev["item_code"].map(change)
    prev["search_rank"] = (prev["search_rank"] + rng.integers(-8, 9, len(prev))).clip(lower=1)
    return prev
