from sqlalchemy import delete, select

from app.db.models.knowledge_document import KnowledgeChunk, KnowledgeDocument
from app.db.session import ai_data_session_factory, ensure_sqlite_schema
from app.rag.ingest.loaders import CourseKnowledgeLoader
from app.rag.ingest.splitters import split_course_payload
from app.rag.retrieve.vector_store import MilvusVectorStore
from app.services.embedding_service import EmbeddingService


class KnowledgeIngestPipeline:
    def __init__(self) -> None:
        self.loader = CourseKnowledgeLoader()
        self.embedding_service = EmbeddingService()
        self.vector_store = MilvusVectorStore()

    async def run(self, course_code: str) -> dict:
        course = await self.loader.load_course(course_code=course_code)
        if course is None:
            return {
                "course_code": course_code,
                "status": "not_found",
                "message": "未从 Java 服务或本地知识库加载到课程内容。",
            }

        chunks = split_course_payload(course)
        if not chunks:
            return {
                "course_code": course_code,
                "status": "empty",
                "message": "课程详情为空，暂时无法生成知识切片。",
            }

        await ensure_sqlite_schema()

        async with ai_data_session_factory() as session:
            existing_document_ids = list(
                (
                    await session.execute(
                        select(KnowledgeDocument.id).where(KnowledgeDocument.course_code == course_code)
                    )
                )
                .scalars()
                .all()
            )
            if existing_document_ids:
                await session.execute(
                    delete(KnowledgeChunk).where(KnowledgeChunk.document_id.in_(existing_document_ids))
                )
                await session.execute(
                    delete(KnowledgeDocument).where(KnowledgeDocument.id.in_(existing_document_ids))
                )
            await session.commit()

        async with ai_data_session_factory() as session:
            document = KnowledgeDocument(
                course_code=course_code,
                title=course.title or f"课程-{course_code}",
                source_type=course.source_type,
                source_uri=course.source_uri,
                metadata_json={"sectionCount": len(course.sections)},
            )
            session.add(document)
            await session.flush()

            milvus_rows: list[dict] = []
            chunk_entities: list[KnowledgeChunk] = []
            for item in chunks:
                chunk_entity = KnowledgeChunk(
                    document_id=document.id,
                    chunk_index=item["chunk_index"],
                    content=item["content"],
                    keywords=item["title"],
                    metadata_json={
                        "title": item["title"],
                        "priority": item.get("priority", 0),
                        "chunk_kind": item.get("chunk_kind"),
                        "source_name": item.get("source_name"),
                        "source_path": item.get("source_path"),
                        "tags": item.get("tags", []),
                    },
                )
                session.add(chunk_entity)
                chunk_entities.append(chunk_entity)

            await session.flush()

            for chunk_entity in chunk_entities:
                metadata = chunk_entity.metadata_json or {}
                title = metadata.get("title", "")
                milvus_rows.append(
                    {
                        "id": chunk_entity.id,
                        "vector": await self.embedding_service.embed_text(f"{title}\n{chunk_entity.content}"),
                        "document_id": document.id,
                        "chunk_id": chunk_entity.id,
                        "content": chunk_entity.content[:8192],
                        "title": title[:255],
                        "priority": int(metadata.get("priority", 0) or 0),
                        "chunk_kind": str(metadata.get("chunk_kind") or "")[:64],
                        "source_name": str(metadata.get("source_name") or "")[:255],
                        "source_path": str(metadata.get("source_path") or "")[:500],
                        "tags": list(metadata.get("tags", []) or [])[:12],
                    }
                )

            await session.commit()

        inserted = self.vector_store.upsert_chunks(course_code=course_code, rows=milvus_rows)
        return {
            "course_code": course_code,
            "status": "success",
            "document_title": course.title,
            "chunk_count": len(chunks),
            "milvus_rows": inserted,
            "source_type": course.source_type,
        }
