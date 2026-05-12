"""
辅导场景图片文字识别：可选依赖 Pillow + pytesseract + 系统 Tesseract。
未安装时返回空文本与安装提示，便于本地开发与 CI 烟测。
"""
from __future__ import annotations

import base64
import re
from typing import Tuple

from app.core.logging import logger

_MAX_IMAGE_BYTES = 5 * 1024 * 1024


def _strip_data_url_prefix(raw: str) -> str:
    s = (raw or "").strip()
    if s.startswith("data:") and "," in s:
        s = s.split(",", 1)[1]
    return s


def _decode_image_bytes(image_base64: str) -> bytes:
    b64 = _strip_data_url_prefix(image_base64)
    if not b64:
        raise ValueError("图片数据为空")
    try:
        data = base64.b64decode(b64, validate=True)
    except Exception as e:
        raise ValueError("无效的 Base64 图片数据") from e
    if len(data) > _MAX_IMAGE_BYTES:
        raise ValueError(f"图片过大，请小于 {_MAX_IMAGE_BYTES // (1024 * 1024)}MB")
    if len(data) < 32:
        raise ValueError("图片数据过短")
    return data


def extract_text_from_base64_image(image_base64: str) -> Tuple[str, str, str]:
    """
    从 Base64 或 data URL 图片中提取文字。

    Returns:
        (text, engine, hint)
        engine: tesseract | none
    """
    data = _decode_image_bytes(image_base64)
    try:
        from io import BytesIO

        from PIL import Image  # type: ignore[import-untyped]

        img = Image.open(BytesIO(data))
        img.load()
    except ImportError:
        hint = "未安装 Pillow，请执行: poetry install --extras ocr"
        logger.info("tutoring.ocr.skip", reason="pillow_missing")
        return "", "none", hint
    except Exception as e:
        raise ValueError(f"无法解析图片: {e}") from e

    try:
        import pytesseract  # type: ignore[import-untyped]
    except ImportError:
        hint = "未安装 pytesseract，请执行: poetry install --extras ocr，并安装系统 Tesseract OCR"
        logger.info("tutoring.ocr.skip", reason="pytesseract_missing")
        return "", "none", hint

    try:
        # chi_sim + eng 需系统已安装对应 tessdata
        text = pytesseract.image_to_string(img, lang="chi_sim+eng")
    except Exception as e:
        logger.warning("tutoring.ocr.tesseract_failed", error=str(e))
        try:
            text = pytesseract.image_to_string(img)
        except Exception as e2:
            raise ValueError(f"OCR 执行失败: {e2}") from e2

    cleaned = re.sub(r"\n{3,}", "\n\n", text).strip()
    return cleaned, "tesseract", ""
