import argparse
import asyncio

from app.rag.ingest.pipelines import KnowledgeIngestPipeline


async def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest local knowledge base course into RAG storage.")
    parser.add_argument(
        "--course-code",
        default="software_engineering_4th",
        help="Local knowledge base course code to ingest.",
    )
    args = parser.parse_args()

    result = await KnowledgeIngestPipeline().run(args.course_code)
    print(result)


if __name__ == "__main__":
    asyncio.run(main())
