from dataclasses import dataclass


@dataclass
class LLMMessage:
    role: str
    content: str


class BaseLLMProvider:
    async def generate(self, messages: list[LLMMessage]) -> str:
        raise NotImplementedError

    async def ping(self) -> str:
        raise NotImplementedError
