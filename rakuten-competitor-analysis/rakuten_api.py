"""乐天市场 Web Service API 客户端（商品搜索 / 排行榜）。

2026 年乐天把 API 迁移到了 openapi.rakuten.co.jp：
  - 需要 applicationId + accessKey（在 https://webservice.rakuten.co.jp/ 的应用管理里获取）
  - 需要带 Referer / Origin，内容要和应用里登记的「WebサイトURL」一致
接口地址都写在 config.yaml 里，乐天再改版时只改配置即可。
"""
from __future__ import annotations

import hashlib
import json
import time
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

import requests

HINTS = {
    "REFERRER_MISSING": "缺少 Referer：请在 config.yaml 的 api.site_url 填写乐天应用里登记的「WebサイトURL」。",
    "HTTP_REFERRER_MISSING": "缺少 Referer：请在 config.yaml 的 api.site_url 填写乐天应用里登记的「WebサイトURL」。",
    "wrong_parameter": "参数错误：请检查 application_id / access_key 是否正确，或关键词是否为空。",
    "not_found": "没有找到商品（关键词或店铺代码可能有误）。",
    "too_many_requests": "请求太频繁：请调大 api.interval_seconds。",
}


class RakutenAPIError(RuntimeError):
    pass


def _origin(url: str) -> str:
    p = urlparse(url)
    return f"{p.scheme}://{p.netloc}" if p.scheme and p.netloc else url


def normalize_item(raw: dict) -> dict:
    """把 API 返回的商品统一成扁平字典（兼容 formatVersion 1 / 2）。"""
    it = raw.get("Item", raw)
    imgs = it.get("mediumImageUrls") or []
    img = ""
    if imgs:
        img = imgs[0]["imageUrl"] if isinstance(imgs[0], dict) else imgs[0]
    return {
        "item_code": it.get("itemCode", ""),
        "item_name": it.get("itemName", ""),
        "catchcopy": it.get("catchcopy", ""),
        "price": int(it.get("itemPrice") or 0),
        "item_url": it.get("itemUrl", ""),
        "image_url": img,
        "shop_code": it.get("shopCode", ""),
        "shop_name": it.get("shopName", ""),
        "shop_url": it.get("shopUrl", ""),
        "review_count": int(it.get("reviewCount") or 0),
        "review_avg": float(it.get("reviewAverage") or 0),
        "point_rate": int(it.get("pointRate") or 1),
        # postageFlag: 0 = 送料込み（包邮）, 1 = 送料別
        "free_shipping": int(it.get("postageFlag", 1)) == 0,
        "genre_id": str(it.get("genreId", "")),
        "rank": it.get("rank"),  # 只有排行榜接口有
    }


class RakutenClient:
    def __init__(self, application_id: str, access_key: str, site_url: str,
                 search_endpoint: str, ranking_endpoint: str = "",
                 interval_seconds: float = 1.1, cache_dir: str | Path | None = "cache",
                 timeout: int = 20):
        if not application_id or not access_key:
            raise RakutenAPIError("请先在 config.yaml 填写 api.application_id 和 api.access_key")
        self.application_id = application_id
        self.access_key = access_key
        self.search_endpoint = search_endpoint
        self.ranking_endpoint = ranking_endpoint
        self.interval = interval_seconds
        self.timeout = timeout
        self.cache_dir = Path(cache_dir) / date.today().isoformat() if cache_dir else None
        self._last_call = 0.0
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "rakuten-competitor-analysis/1.0",
            "Referer": site_url,
            "Origin": _origin(site_url),
        })

    # ---------- 底层请求 ----------
    def _get(self, url: str, params: dict) -> dict:
        params = {k: v for k, v in params.items() if v not in (None, "", [])}
        params.update(applicationId=self.application_id, accessKey=self.access_key,
                      format="json", formatVersion=2)

        cache_file = None
        if self.cache_dir:
            key_src = url + json.dumps({k: v for k, v in sorted(params.items())
                                        if k not in ("applicationId", "accessKey")}, ensure_ascii=False)
            cache_file = self.cache_dir / (hashlib.md5(key_src.encode()).hexdigest() + ".json")
            if cache_file.exists():
                return json.loads(cache_file.read_text(encoding="utf-8"))

        for attempt in range(4):
            wait = self.interval - (time.time() - self._last_call)
            if wait > 0:
                time.sleep(wait)
            self._last_call = time.time()
            try:
                r = self.session.get(url, params=params, timeout=self.timeout)
            except requests.RequestException as e:
                if attempt == 3:
                    raise RakutenAPIError(f"网络错误：{e}") from e
                time.sleep(2 ** attempt)
                continue
            if r.status_code == 429 or r.status_code >= 500:
                time.sleep(2 ** (attempt + 1))
                continue
            try:
                data = r.json()
            except ValueError:
                raise RakutenAPIError(f"HTTP {r.status_code}，返回不是 JSON：{r.text[:200]}")
            if r.status_code == 404 or data.get("error") == "not_found":
                return {"count": 0, "pageCount": 0, "Items": []}
            if r.status_code != 200 or "error" in data or "errors" in data:
                err = data.get("error") or json.dumps(data.get("errors"), ensure_ascii=False)
                desc = data.get("error_description", "")
                hint = next((h for k, h in HINTS.items() if k.lower() in f"{err} {desc}".lower()), "")
                raise RakutenAPIError(f"HTTP {r.status_code} {err} {desc}\n提示：{hint}".strip())
            if cache_file:
                cache_file.parent.mkdir(parents=True, exist_ok=True)
                cache_file.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
            return data
        raise RakutenAPIError("重试多次仍失败（429/5xx），请稍后再试")

    # ---------- 商品搜索 ----------
    def search(self, keyword: str | None = None, shop_code: str | None = None,
               genre_id: str | int | None = None, page: int = 1, hits: int = 30,
               sort: str = "standard", ng_keyword: str | None = None,
               min_price: int | None = None, max_price: int | None = None) -> dict:
        """sort 可选：standard(综合=搜索排名) / -reviewCount(评价多) / +itemPrice / -itemPrice / -reviewAverage"""
        data = self._get(self.search_endpoint, {
            "keyword": keyword, "shopCode": shop_code,
            "genreId": genre_id if genre_id not in (0, "0") else None,
            "page": page, "hits": hits, "sort": sort, "NGKeyword": ng_keyword,
            "minPrice": min_price, "maxPrice": max_price, "availability": 1,
        })
        return {
            "count": int(data.get("count") or 0),
            "page_count": int(data.get("pageCount") or 0),
            "items": [normalize_item(x) for x in data.get("Items", [])],
        }

    # ---------- 排行榜 ----------
    def ranking(self, genre_id: str | int, page: int = 1, period: str | None = None) -> list[dict]:
        if not self.ranking_endpoint:
            return []
        data = self._get(self.ranking_endpoint, {"genreId": genre_id, "page": page, "period": period})
        return [normalize_item(x) for x in data.get("Items", [])]
