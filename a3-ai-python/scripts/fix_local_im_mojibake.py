from __future__ import annotations

import sqlite3
from pathlib import Path


DB_PATH = Path(__file__).resolve().parents[1] / "local_data" / "a3_ai_local.db"

SESSION_TITLE_FIXES: dict[int, tuple[str, str | None]] = {
    61026: ("A3 \u9879\u76ee\u51b2\u523a\u7fa4", None),
    61027: ("\u7b54\u8fa9\u6392\u7ec3\u5c0f\u7ec4", None),
    61028: ("\u7f57\u4ea6\u51e1", "\u7f57\u4ea6\u51e1"),
    61029: ("\u7a0b\u542f\u822a", "\u7a0b\u542f\u822a"),
    61030: ("\u9875\u9762\u91cd\u6784\u534f\u4f5c\u7fa4", None),
    61031: ("\u9648\u661f\u5b87", "\u9648\u661f\u5b87"),
    61033: ("\u4ea4\u4e92\u7a3f\u8ba8\u8bba\u7fa4", None),
    61034: ("\u6797\u6f88", "\u6797\u6f88"),
    61035: ("\u8bfe\u7a0b\u8fd0\u8425\u52a9\u6559", "\u8bfe\u7a0b\u8fd0\u8425\u52a9\u6559"),
    61036: ("\u62a5\u544a\u56fe\u8868\u4f18\u5316\u7fa4", None),
    61037: ("\u987e\u8a00\u8f9e", "\u987e\u8a00\u8f9e"),
    61038: ("\u4ea7\u54c1\u8868\u8fbe\u5171\u521b\u7fa4", None),
    61039: ("\u9648\u661f\u5b87", "\u9648\u661f\u5b87"),
    61040: ("\u5de5\u5177\u8c03\u7528\u8054\u8c03\u7fa4", None),
    61041: ("\u9648\u661f\u5b87", "\u9648\u661f\u5b87"),
    61042: ("\u7a0b\u542f\u822a", "\u7a0b\u542f\u822a"),
    61043: ("\u540e\u7aef\u8054\u8c03\u7b54\u7591\u7fa4", None),
    61044: ("\u7a0b\u542f\u822a", "\u7a0b\u542f\u822a"),
    61045: ("\u8fde\u7eed\u5b66\u4e60\u8fd0\u8425\u7fa4", None),
    61047: ("Emily UI", "Emily UI"),
    61048: ("\u9519\u56e0\u590d\u76d8\u8ba8\u8bba\u7fa4", None),
    61049: ("\u5b8b\u77e5\u590f", "\u5b8b\u77e5\u590f"),
    61050: ("\u6c88\u77e5\u5e8f", "\u6c88\u77e5\u5e8f"),
    61051: ("\u67b6\u6784\u6cbb\u7406\u8ba8\u8bba\u7fa4", None),
    61052: ("\u7f57\u4ea6\u51e1", "\u7f57\u4ea6\u51e1"),
    61053: ("\u5468\u6c90\u8a00", "\u5468\u6c90\u8a00"),
}


def main() -> None:
    connection = sqlite3.connect(DB_PATH)
    cursor = connection.cursor()
    updated = 0
    for session_id, (title, peer_name) in SESSION_TITLE_FIXES.items():
        cursor.execute(
            "update chat_session set title=?, peer_name=coalesce(?, peer_name), updated_at=datetime('now') where id=?",
            (title, peer_name, session_id),
        )
        updated += cursor.rowcount
    connection.commit()

    remaining = cursor.execute(
        "select count(*) from chat_session where title like '%?%' or coalesce(peer_name, '') like '%?%'"
    ).fetchone()[0]
    print(f"updated={updated}")
    print(f"remaining_question_mark_rows={remaining}")


if __name__ == "__main__":
    main()
