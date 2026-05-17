from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException

from app.core.config import settings
from app.schemas.admin import (
    AdminSessionEnvironmentResponse,
    AdminSessionHistoryResponse,
    AdminSessionLoginRequest,
    AdminSessionResponse,
    AdminSessionStateResponse,
    AdminSessionSwitchEnvironmentRequest,
)
from app.services.local_runtime_store import LocalRuntimeStore


class AdminSessionService:
    _ACCOUNTS = {
        "codex-admin": {
            "password": "codex-local",
            "display_name": "Codex Admin",
            "role": "super_admin",
        },
        "ops-admin": {
            "password": "ops-local",
            "display_name": "Operations Admin",
            "role": "operations_admin",
        },
        "review-admin": {
            "password": "review-local",
            "display_name": "Review Admin",
            "role": "review_admin",
        },
    }

    _ENVIRONMENTS = [
        {
            "environment_id": "local-live",
            "label": "本地真实链路",
            "description": "连接当前本地 AI 后端与真实数据库依赖，适合联调写操作。",
            "app_env": "local",
            "llm_mode": "真实 LLM 优先",
            "embedding_mode": "真实 Embedding 优先",
            "risk_level": "high",
            "config_profile": {
                "java_gateway_base_url": settings.java_gateway_base_url,
                "llm_provider": settings.llm_provider,
                "embedding_provider": settings.embedding_provider,
            },
        },
        {
            "environment_id": "local-safe",
            "label": "本地安全模式",
            "description": "保留本地环境，但强调回退链路与只读排查，更适合演示与验收。",
            "app_env": "local",
            "llm_mode": "允许回退到本地默认策略",
            "embedding_mode": "允许回退到哈希向量",
            "risk_level": "medium",
            "config_profile": {
                "java_gateway_base_url": settings.java_gateway_base_url,
                "llm_provider": f"{settings.llm_provider} (fallback allowed)",
                "embedding_provider": "hash fallback enabled",
            },
        },
        {
            "environment_id": "staging-like",
            "label": "预发映射视图",
            "description": "用于模拟预发排障上下文，保留当前本地控制台但标记为高审计环境。",
            "app_env": settings.app_env,
            "llm_mode": settings.llm_provider,
            "embedding_mode": settings.embedding_provider,
            "risk_level": "high",
            "config_profile": {
                "app_env": settings.app_env,
                "gateway_target": settings.java_gateway_base_url,
                "audit_mode": "strict",
            },
        },
    ]

    def get_state(self) -> AdminSessionStateResponse:
        store = LocalRuntimeStore.load_admin_session_store()
        active_session = store.get("active_session")
        active_environment_id = active_session.get("active_environment_id") if isinstance(active_session, dict) else None
        environments = [
            AdminSessionEnvironmentResponse(
                **item,
                is_active=item["environment_id"] == active_environment_id,
            )
            for item in self._ENVIRONMENTS
        ]
        history = [AdminSessionHistoryResponse(**item) for item in reversed(store.get("history", [])[-8:])]
        session = self._build_session_response(active_session)
        return AdminSessionStateResponse(session=session, environments=environments, history=history)

    def login(self, request: AdminSessionLoginRequest) -> AdminSessionStateResponse:
        account = self._ACCOUNTS.get(request.username)
        if account is None or account["password"] != request.password:
            raise HTTPException(status_code=401, detail="invalid admin credentials")

        environment = self._get_environment(request.environment_id)
        store = LocalRuntimeStore.load_admin_session_store()
        now = self._now()
        store["active_session"] = {
            "username": request.username,
            "display_name": account["display_name"],
            "role": account["role"],
            "active_environment_id": environment["environment_id"],
            "login_state": "active",
            "logged_in_at": now,
            "last_seen_at": now,
        }
        self._append_history(
            store,
            action="login",
            actor=request.username,
            environment_id=environment["environment_id"],
            detail=f"登录并进入 {environment['label']}",
        )
        LocalRuntimeStore.save_admin_session_store(store)
        return self.get_state()

    def logout(self) -> AdminSessionStateResponse:
        store = LocalRuntimeStore.load_admin_session_store()
        active_session = store.get("active_session")
        if isinstance(active_session, dict):
            self._append_history(
                store,
                action="logout",
                actor=active_session.get("username", "unknown"),
                environment_id=active_session.get("active_environment_id"),
                detail="退出管理员会话",
            )
        store["active_session"] = None
        LocalRuntimeStore.save_admin_session_store(store)
        return self.get_state()

    def switch_environment(self, request: AdminSessionSwitchEnvironmentRequest) -> AdminSessionStateResponse:
        store = LocalRuntimeStore.load_admin_session_store()
        active_session = store.get("active_session")
        if not isinstance(active_session, dict):
            raise HTTPException(status_code=401, detail="admin session required")

        environment = self._get_environment(request.environment_id)
        active_session["active_environment_id"] = environment["environment_id"]
        active_session["last_seen_at"] = self._now()
        self._append_history(
            store,
            action="switch_environment",
            actor=active_session.get("username", "unknown"),
            environment_id=environment["environment_id"],
            detail=f"切换到 {environment['label']}",
        )
        LocalRuntimeStore.save_admin_session_store(store)
        return self.get_state()

    def get_current_admin_name(self) -> str:
        store = LocalRuntimeStore.load_admin_session_store()
        active_session = store.get("active_session")
        if isinstance(active_session, dict) and active_session.get("username"):
            return str(active_session["username"])
        return "codex-admin"

    def _build_session_response(self, payload: dict | None) -> AdminSessionResponse | None:
        if not isinstance(payload, dict):
            return None
        environment = self._get_environment(payload.get("active_environment_id", "local-live"))
        return AdminSessionResponse(
            username=str(payload.get("username") or "codex-admin"),
            display_name=str(payload.get("display_name") or "Codex Admin"),
            role=str(payload.get("role") or "super_admin"),
            active_environment_id=environment["environment_id"],
            active_environment_label=environment["label"],
            login_state=str(payload.get("login_state") or "active"),
            logged_in_at=payload.get("logged_in_at"),
            last_seen_at=payload.get("last_seen_at"),
        )

    def _get_environment(self, environment_id: str) -> dict[str, str | dict[str, str]]:
        for item in self._ENVIRONMENTS:
            if item["environment_id"] == environment_id:
                return item
        raise HTTPException(status_code=404, detail="environment profile not found")

    def _append_history(
        self,
        store: dict,
        *,
        action: str,
        actor: str,
        environment_id: str | None,
        detail: str,
    ) -> None:
        history = store.setdefault("history", [])
        history.append(
            {
                "action": action,
                "actor": actor,
                "environment_id": environment_id,
                "created_at": self._now(),
                "detail": detail,
            }
        )
        if len(history) > 30:
            del history[:-30]

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).isoformat()
