from pymilvus import DataType, MilvusClient

from app.core.config import settings


class MilvusVectorStore:
    def __init__(self) -> None:
        self.client = MilvusClient(uri=f"http://{settings.milvus_host}:{settings.milvus_port}")

    def collection_name(self, course_code: str) -> str:
        # 按课程拆分集合，便于控制知识边界与回溯来源。
        return f"{settings.milvus_collection_prefix}_{course_code}".replace("-", "_")

    def ensure_collection(self, course_code: str) -> str:
        collection_name = self.collection_name(course_code)
        if self.client.has_collection(collection_name=collection_name):
            return collection_name

        schema = self.client.create_schema(auto_id=False, enable_dynamic_field=True)
        schema.add_field(field_name="id", datatype=DataType.INT64, is_primary=True)
        schema.add_field(
            field_name="vector",
            datatype=DataType.FLOAT_VECTOR,
            dim=settings.milvus_dimension,
        )
        schema.add_field(field_name="document_id", datatype=DataType.INT64)
        schema.add_field(field_name="chunk_id", datatype=DataType.INT64)
        schema.add_field(field_name="content", datatype=DataType.VARCHAR, max_length=8192)
        schema.add_field(field_name="title", datatype=DataType.VARCHAR, max_length=255)

        index_params = self.client.prepare_index_params()
        index_params.add_index(
            field_name="vector",
            index_type="AUTOINDEX",
            metric_type="COSINE",
        )

        self.client.create_collection(
            collection_name=collection_name,
            schema=schema,
            index_params=index_params,
        )
        return collection_name

    def reset_collection(self, course_code: str) -> str:
        collection_name = self.collection_name(course_code)
        if self.client.has_collection(collection_name=collection_name):
            self.client.drop_collection(collection_name=collection_name)
        return self.ensure_collection(course_code)

    def upsert_chunks(self, course_code: str, rows: list[dict]) -> int:
        collection_name = self.reset_collection(course_code)
        if not rows:
            return 0
        self.client.upsert(collection_name=collection_name, data=rows)
        self.client.flush(collection_name=collection_name)
        self.client.load_collection(collection_name=collection_name)
        return len(rows)

    def search(self, course_code: str, vector: list[float], top_k: int = 5) -> list[dict]:
        collection_name = self.ensure_collection(course_code)
        self.client.load_collection(collection_name=collection_name)
        results = self.client.search(
            collection_name=collection_name,
            data=[vector],
            limit=top_k,
            output_fields=["document_id", "chunk_id", "content", "title", "priority", "chunk_kind", "tags"],
        )
        hits = results[0] if results else []
        normalized_hits: list[dict] = []
        for hit in hits:
            entity = hit.get("entity", hit)
            normalized_hits.append(
                {
                    "chunk_id": entity.get("chunk_id") or entity.get("id"),
                    "document_id": entity.get("document_id"),
                    "content": entity.get("content", ""),
                    "title": entity.get("title", ""),
                    "score": float(hit.get("distance", hit.get("score", 0.0))),
                    "priority": int(entity.get("priority", 0) or 0),
                    "chunk_kind": entity.get("chunk_kind", ""),
                    "tags": list(entity.get("tags", []) or []),
                }
            )
        return normalized_hits
