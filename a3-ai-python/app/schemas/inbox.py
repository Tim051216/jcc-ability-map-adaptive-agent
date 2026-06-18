from pydantic import BaseModel, Field


class InboxItem(BaseModel):
    id: int
    type: int
    title: str
    content: str
    isRead: bool
    publisher: int
    pushTime: str | None = None


class InboxListResponse(BaseModel):
    list: list[InboxItem]
    total: int


class InboxReadResponse(BaseModel):
    id: int
    isRead: bool = Field(default=True)
