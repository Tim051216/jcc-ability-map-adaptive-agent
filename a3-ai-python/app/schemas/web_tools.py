from pydantic import BaseModel, Field


class WebSearchRequest(BaseModel):
    query: str
    top_k: int = Field(default=5, ge=1, le=10)
    domain_whitelist: list[str] = Field(default_factory=list)


class WebSearchResultItem(BaseModel):
    title: str
    url: str
    snippet: str = ""
    source: str = ""


class WebSearchResponse(BaseModel):
    query: str
    items: list[WebSearchResultItem] = Field(default_factory=list)


class WebFetchRequest(BaseModel):
    url: str
    max_chars: int = Field(default=6000, ge=500, le=20000)


class WebFetchResponse(BaseModel):
    url: str
    final_url: str
    title: str = ""
    content: str = ""
    source: str = ""
