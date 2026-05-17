"""
Resource generation task event hub for realtime progress streaming.
"""

from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import Any, ClassVar


class ResourceGenerationEventService:
    _subscribers: ClassVar[dict[int, set[asyncio.Queue]]] = defaultdict(set)

    @classmethod
    def subscribe(cls, task_id: int) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue()
        cls._subscribers[task_id].add(queue)
        return queue

    @classmethod
    def unsubscribe(cls, task_id: int, queue: asyncio.Queue) -> None:
        queues = cls._subscribers.get(task_id)
        if not queues:
            return
        queues.discard(queue)
        if not queues:
            cls._subscribers.pop(task_id, None)

    @classmethod
    async def publish(cls, task_id: int, event: dict[str, Any]) -> None:
        queues = list(cls._subscribers.get(task_id, set()))
        stale: list[asyncio.Queue] = []
        for queue in queues:
            try:
                queue.put_nowait(event)
            except RuntimeError:
                stale.append(queue)
        for queue in stale:
            cls.unsubscribe(task_id, queue)

