# Multi-route RAG benchmark

- Run time: 2026-07-26 19:20:34 +08:00
- Course: `software_engineering_4th`
- Evaluation set: 15 labeled queries
- Retrieval depth: `top_k=3` (unique intent-directed queries are dynamically pruned to one result)
- Global vector backend: Milvus `v2.4.13`, collection `a3_learning_software_engineering_4th`
- TTFT model: `qwen-turbo`
- Raw result: `multi_route_rag_20260726_192034.json`

| Metric | Legacy local retrieval | Multi-route retrieval | Change |
| --- | ---: | ---: | ---: |
| Top-1 hit rate | 26.67% | 100.00% | +73.33 percentage points |
| Over-retrieval rate | 77.78% | 0.00% | -77.78 percentage points |
| Context precision | 22.22% | 100.00% | +77.78 percentage points |
| Mean retrieval latency, unique queries | 15.19 ms | 1590.94 ms | +1575.75 ms |

Milvus was running as Standalone `v2.4.13` on `127.0.0.1:19530`. The course collection was rebuilt with 25 real `text-embedding-v4` vectors. Persisted local vectors remained available as the configured fallback, but this run used Milvus for the global route.

## TTFT

Three previously unseen queries measured 3267.47 ms, 3656.36 ms, and 3698.88 ms from retrieval start to the first model token. Mean uncached TTFT was **3540.90 ms**, below the 7-second target.

These figures describe the current 15-query labeled course benchmark. They should not be generalized to new courses without adding representative labeled queries for those courses.
