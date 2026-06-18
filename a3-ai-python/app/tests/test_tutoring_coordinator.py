from app.agents.tutoring_coordinator import TutoringCoordinator


def test_realtime_query_detects_actual_time_question() -> None:
    assert TutoringCoordinator._looks_like_realtime_query("现在几点了？", None) is True


def test_realtime_query_skips_learning_plan_language() -> None:
    assert TutoringCoordinator._looks_like_realtime_query("请给我一个本章复习顺序。", None) is False
    assert TutoringCoordinator._looks_like_realtime_query("现在我应该先复习哪一章？", None) is False
