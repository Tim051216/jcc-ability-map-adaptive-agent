from fastapi import APIRouter

from app.api.v1 import admin, chat, evaluation, plan, profile, rag, resource

api_router = APIRouter()
api_router.include_router(chat.router, prefix="/v1/chat", tags=["chat"])
api_router.include_router(profile.router, prefix="/v1/profile", tags=["profile"])
api_router.include_router(plan.router, prefix="/v1/plan", tags=["plan"])
api_router.include_router(resource.router, prefix="/v1/resource", tags=["resource"])
api_router.include_router(evaluation.router, prefix="/v1/evaluation", tags=["evaluation"])
api_router.include_router(rag.router, prefix="/v1/rag", tags=["rag"])
api_router.include_router(admin.router, prefix="/v1/admin", tags=["admin"])
