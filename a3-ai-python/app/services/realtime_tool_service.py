from __future__ import annotations

import re
import time
from datetime import datetime
from typing import Any
from urllib.parse import unquote, urlparse, parse_qs

import httpx


class RealtimeToolService:
    """Lightweight realtime tools for weather and web search queries."""

    LOCATION_CACHE_TTL_SECONDS = 12 * 60 * 60
    WEATHER_CACHE_TTL_SECONDS = 90
    WEB_CACHE_TTL_SECONDS = 180

    WEATHER_KEYWORDS = (
        "天气",
        "气温",
        "温度",
        "下雨",
        "降雨",
        "降水",
        "空气质量",
        "穿什么",
    )
    WEB_SEARCH_KEYWORDS = (
        "最新",
        "实时",
        "今天",
        "今日",
        "现在",
        "官网",
        "新闻",
        "消息",
        "汇率",
        "股价",
        "价格",
        "热搜",
    )
    TIME_WORDS = ("今天", "明天", "后天", "现在", "实时", "目前", "今日", "请问", "帮我", "查一下", "看看")
    CLOCK_KEYWORDS = (
        "几点",
        "几号",
        "几月几号",
        "星期几",
        "周几",
        "当前时间",
        "现在几点",
        "现在几号",
        "现在星期几",
        "日期",
        "时间",
    )

    def __init__(self) -> None:
        self._location_cache: dict[str, tuple[float, dict[str, Any]]] = {}
        self._weather_cache: dict[str, tuple[float, dict[str, Any]]] = {}
        self._web_cache: dict[str, tuple[float, dict[str, Any]]] = {}

    @staticmethod
    def _read_cache(
        cache: dict[str, tuple[float, dict[str, Any]]],
        key: str,
        ttl_seconds: float,
    ) -> dict[str, Any] | None:
        cached = cache.get(key)
        if not cached:
            return None
        saved_at, payload = cached
        if time.monotonic() - saved_at > ttl_seconds:
            cache.pop(key, None)
            return None
        return payload

    @staticmethod
    def _write_cache(
        cache: dict[str, tuple[float, dict[str, Any]]],
        key: str,
        payload: dict[str, Any],
    ) -> None:
        cache[key] = (time.monotonic(), payload)

    async def lookup(self, question_text: str) -> dict[str, Any] | None:
        text = str(question_text or "").strip()
        if not text:
            return None
        if self._is_time_query(text):
            time_payload = self._lookup_local_time(text)
            if time_payload is not None:
                return time_payload
        if self._is_weather_query(text):
            weather = await self._lookup_weather(text)
            if weather is not None:
                return weather
        if self._needs_web_search(text):
            web = await self._search_web(text)
            if web is not None:
                return web
        return None

    def _is_weather_query(self, text: str) -> bool:
        return any(keyword in text for keyword in self.WEATHER_KEYWORDS)

    def _is_time_query(self, text: str) -> bool:
        normalized = re.sub(r"\s+", "", text)
        return any(keyword in normalized for keyword in self.CLOCK_KEYWORDS)

    def _needs_web_search(self, text: str) -> bool:
        if self._is_weather_query(text) or self._is_time_query(text):
            return False
        return any(keyword in text for keyword in self.WEB_SEARCH_KEYWORDS)

    def _lookup_local_time(self, question_text: str) -> dict[str, Any] | None:
        now = datetime.now()
        weekday_labels = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"]
        normalized = re.sub(r"\s+", "", question_text)
        if "星期" in normalized or "周几" in normalized:
            answer = f"今天是{now:%Y年%m月%d日}，{weekday_labels[now.weekday()]}。"
        elif "几号" in normalized or "日期" in normalized or "几月几号" in normalized:
            answer = f"今天是{now:%Y年%m月%d日}。"
        else:
            answer = f"现在是{now:%Y年%m月%d日 %H:%M}。"
        return {
            "tool": "local_time",
            "answer_text": answer,
            "reference_sources": [
                {
                    "source_type": "system",
                    "title": "Local system clock",
                    "url": "",
                    "excerpt": answer,
                }
            ],
        }

    def _extract_location(self, text: str) -> str | None:
        match = re.search(r"([\u4e00-\u9fff]{2,12})(?:天气|气温|温度|下雨|降雨|降水|空气质量)", text)
        if not match:
            return None
        location = match.group(1)
        for token in self.TIME_WORDS:
            location = location.replace(token, "")
        location = location.strip()
        return location or None

    def _weather_day_offset(self, text: str) -> int:
        if "后天" in text:
            return 2
        if "明天" in text:
            return 1
        return 0

    @staticmethod
    def _weather_code_text(code: int | None) -> str:
        mapping = {
            0: "晴",
            1: "大体晴朗",
            2: "多云",
            3: "阴",
            45: "有雾",
            48: "有雾",
            51: "毛毛雨",
            53: "小雨",
            55: "中雨",
            61: "小雨",
            63: "中雨",
            65: "大雨",
            66: "冻雨",
            67: "冻雨",
            71: "小雪",
            73: "中雪",
            75: "大雪",
            80: "阵雨",
            81: "阵雨",
            82: "强阵雨",
            95: "雷雨",
            96: "雷暴伴冰雹",
            99: "雷暴伴冰雹",
        }
        return mapping.get(int(code or 0), "天气多变")

    async def _lookup_weather(self, question_text: str) -> dict[str, Any] | None:
        location = self._extract_location(question_text)
        if not location:
            return None
        cache_key = f"{location}:{self._weather_day_offset(question_text)}"
        cached_weather = self._read_cache(self._weather_cache, cache_key, self.WEATHER_CACHE_TTL_SECONDS)
        if cached_weather is not None:
            return cached_weather

        target = self._read_cache(self._location_cache, location, self.LOCATION_CACHE_TTL_SECONDS)
        async with httpx.AsyncClient(timeout=4.0, follow_redirects=True) as client:
            if target is None:
                geo_resp = await client.get(
                    "https://geocoding-api.open-meteo.com/v1/search",
                    params={"name": location, "count": 1, "language": "zh", "format": "json"},
                )
                geo_resp.raise_for_status()
                geo_data = geo_resp.json()
                results = geo_data.get("results") or []
                if not results:
                    return None
                target = results[0]
                self._write_cache(self._location_cache, location, target)

            weather_resp = await client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": target["latitude"],
                    "longitude": target["longitude"],
                    "current": "temperature_2m,weather_code",
                    "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
                    "timezone": "Asia/Shanghai",
                    "forecast_days": 3,
                },
            )
            weather_resp.raise_for_status()
            weather_data = weather_resp.json()

        day_offset = self._weather_day_offset(question_text)
        daily = weather_data.get("daily") or {}
        current = weather_data.get("current") or {}
        dates = daily.get("time") or []
        code_list = daily.get("weather_code") or []
        max_list = daily.get("temperature_2m_max") or []
        min_list = daily.get("temperature_2m_min") or []
        rain_list = daily.get("precipitation_probability_max") or []
        idx = min(day_offset, max(len(dates) - 1, 0))

        resolved_name = target.get("name") or location
        admin1 = target.get("admin1")
        country = target.get("country")
        place_label = " ".join(part for part in [country, admin1, resolved_name] if part)
        weather_text = self._weather_code_text(code_list[idx] if idx < len(code_list) else current.get("weather_code"))
        current_temp = current.get("temperature_2m")
        high = max_list[idx] if idx < len(max_list) else None
        low = min_list[idx] if idx < len(min_list) else None
        rain = rain_list[idx] if idx < len(rain_list) else None
        target_date = dates[idx] if idx < len(dates) else datetime.now().strftime("%Y-%m-%d")
        day_label = "后天" if day_offset == 2 else "明天" if day_offset == 1 else "今天"

        excerpt = (
            f"{place_label}{day_label}（{target_date}）{weather_text}，"
            f"当前 {current_temp}°C，最高 {high}°C，最低 {low}°C，降水概率 {rain}% 。"
        )
        result = {
            "tool": "weather",
            "location": resolved_name,
            "location_label": place_label,
            "day_label": day_label,
            "date": target_date,
            "weather_text": weather_text,
            "current_temp": current_temp,
            "high_temp": high,
            "low_temp": low,
            "precipitation_probability": rain,
            "reference_sources": [
                {
                    "source_type": "web",
                    "title": "Open-Meteo Weather Forecast",
                    "url": "https://open-meteo.com/",
                    "excerpt": excerpt,
                }
            ],
        }
        self._write_cache(self._weather_cache, cache_key, result)
        return result

    @staticmethod
    def _clean_duckduckgo_href(raw_href: str) -> str | None:
        if not raw_href:
            return None
        if raw_href.startswith("//"):
            return f"https:{raw_href}"
        if raw_href.startswith("/l/?"):
            parsed = urlparse(raw_href)
            real = parse_qs(parsed.query).get("uddg", [])
            if real:
                return unquote(real[0])
        return raw_href

    async def _search_web(self, question_text: str) -> dict[str, Any] | None:
        cached = self._read_cache(self._web_cache, question_text, self.WEB_CACHE_TTL_SECONDS)
        if cached is not None:
            return cached
        headers = {
            "User-Agent": "Mozilla/5.0",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        }
        async with httpx.AsyncClient(timeout=5.0, follow_redirects=True, headers=headers) as client:
            resp = await client.get(
                "https://html.duckduckgo.com/html/",
                params={"q": question_text},
            )
            resp.raise_for_status()
            html = resp.text

        anchor_matches = re.findall(
            r'<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>',
            html,
            flags=re.IGNORECASE | re.DOTALL,
        )
        snippet_matches = re.findall(
            r'<a[^>]*class="result__snippet"[^>]*>(.*?)</a>|<div[^>]*class="result__snippet"[^>]*>(.*?)</div>',
            html,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if not anchor_matches:
            return None

        results: list[dict[str, Any]] = []
        for idx, (href, title_html) in enumerate(anchor_matches[:3]):
            title = re.sub(r"<.*?>", "", title_html).strip()
            clean_url = self._clean_duckduckgo_href(href)
            snippet_raw = ""
            if idx < len(snippet_matches):
                snippet_raw = snippet_matches[idx][0] or snippet_matches[idx][1] or ""
            snippet = re.sub(r"<.*?>", "", snippet_raw).strip()
            results.append(
                {
                    "title": title,
                    "url": clean_url,
                    "snippet": snippet,
                }
            )

        if not results:
            return None

        reference_sources = [
            {
                "source_type": "web",
                "title": item["title"],
                "url": item["url"],
                "excerpt": item["snippet"],
            }
            for item in results
        ]
        prompt_context = "\n".join(
            f"{idx}. 标题：{item['title']}\n链接：{item['url']}\n摘要：{item['snippet']}"
            for idx, item in enumerate(results, start=1)
        )
        result = {
            "tool": "web_search",
            "query": question_text,
            "results": results,
            "prompt_context": prompt_context,
            "reference_sources": reference_sources,
        }
        self._write_cache(self._web_cache, question_text, result)
        return result
