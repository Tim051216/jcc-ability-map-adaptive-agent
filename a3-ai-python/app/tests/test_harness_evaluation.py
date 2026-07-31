from app.harness.evaluation import evaluate_run


def test_evaluation_checks_answer_tools_cost_and_latency() -> None:
    case = {
        "must_contain": ["进程"],
        "must_not_contain": ["无法回答"],
        "min_confidence": 60,
        "expected_tools": ["course_knowledge_search"],
        "max_llm_calls": 2,
        "max_latency_ms": 1000,
    }
    output = {"answer_text": "进程是资源分配单位", "confidence_score": 80}
    events = [
        {"event": "tool_result", "tool_name": "course_knowledge_search", "elapsed_ms": 20},
        {"event": "llm_result", "elapsed_ms": 30},
    ]

    result = evaluate_run(case, output, events)

    assert result.passed is True
    assert result.score == 1.0


def test_forbidden_signal_is_hard_failure() -> None:
    result = evaluate_run(
        {"must_not_contain": ["系统错误"], "min_score": 0.5},
        {"answer_text": "系统错误，请稍后再试"},
        [],
    )
    assert result.passed is False


def test_any_of_semantic_signals_avoids_brittle_exact_word_gate() -> None:
    result = evaluate_run(
        {"must_contain_any": [["泛化", "新数据", "测试数据"]]},
        {"answer_text": "模型在训练集很好，但在新数据上的表现较差。"},
        [],
    )
    assert result.passed is True
