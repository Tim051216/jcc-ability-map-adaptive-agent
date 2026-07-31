from __future__ import annotations

import asyncio
import json
from pathlib import Path

from app.schemas.rag_evaluation import RagEvalCompareRequest, RagEvalDatasetItem, RagEvalRunRequest
from app.services.rag_evaluation_service import RagEvaluationService


async def main() -> None:
    service = RagEvaluationService()
    dataset = service.export_default_dataset()
    baseline_answers = {
        "se-01": "可行性分析就是在项目开始前判断项目能不能做，主要看整体条件是否允许。",
        "se-02": "概要设计主要是在需求后做整体方案，把系统的大致结构先规划出来。",
        "se-03": "详细设计是在概要设计之后继续细化每个模块，形成可实现的设计说明。",
        "se-04": "软件测试是为了检查软件运行是否正常，帮助开发人员发现问题。",
        "se-05": "适应性维护是在软件上线后根据使用情况进行调整的一类维护。",
    }
    improved_answers = {
        "se-01": "可行性分析需要从技术可行性、经济可行性、操作可行性和法律可行性四个方面评估项目是否值得实施。",
        "se-02": "概要设计阶段主要完成系统总体结构设计、模块划分以及模块之间的接口关系设计。",
        "se-03": "详细设计阶段的输出一般包括模块内部算法、数据结构以及处理流程说明。",
        "se-04": "软件测试的目标是通过执行程序发现缺陷并评估软件质量，而不是证明软件完全没有错误。",
        "se-05": "适应性维护是为适应新的操作系统、硬件环境或外部条件变化而进行的软件修改。",
    }
    baseline_dataset = [
        RagEvalDatasetItem.model_validate({**item, "candidate_answer": baseline_answers[item["item_id"]]})
        for item in dataset
    ]
    improved_dataset = [
        RagEvalDatasetItem.model_validate({**item, "candidate_answer": improved_answers[item["item_id"]]})
        for item in dataset
    ]
    baseline = await service.run(
        RagEvalRunRequest(
            course_code="software_engineering_4th",
            dataset_name="software_engineering_4th_sample",
            variant_name="baseline",
            strategy="baseline",
            top_k=5,
            dataset=baseline_dataset,
        )
    )

    improved = await service.run(
        RagEvalRunRequest(
            course_code="software_engineering_4th",
            dataset_name="software_engineering_4th_sample",
            variant_name="context_summary",
            strategy="context_summary",
            top_k=5,
            dataset=improved_dataset,
        )
    )

    compare = await service.compare(
        RagEvalCompareRequest(
            left_run_id=baseline.run_id,
            right_run_id=improved.run_id,
            left_label="baseline",
            right_label="context_summary",
        )
    )

    output_path = Path(__file__).resolve().parents[1] / "output" / "rag_eval_demo_report.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(
            {
                "baseline": baseline.model_dump(mode="json"),
                "improved": improved.model_dump(mode="json"),
                "compare": compare.model_dump(mode="json"),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(output_path)


if __name__ == "__main__":
    asyncio.run(main())
