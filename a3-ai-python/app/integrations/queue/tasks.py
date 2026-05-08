from app.integrations.queue.celery_app import celery_app


@celery_app.task(name="a3_ai.generate_resources")
def generate_resources_task(task_id: int) -> dict:
    return {"task_id": task_id, "status": "queued"}
