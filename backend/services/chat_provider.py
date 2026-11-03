"""Contrato estrutural para provedores de conversa do chatbot.

Recebe a pergunta, o histórico e ferramentas; retorna o texto da resposta.
"""
from typing import Protocol

from google.genai import types

from services.gemini_service import ChatTool


class ChatProvider(Protocol):
    def answer(
        self,
        question: str,
        history: list[types.Content],
        tools: dict[str, ChatTool],
    ) -> str:
        ...
