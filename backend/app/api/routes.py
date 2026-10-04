from fastapi import APIRouter
from app.schemas import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse, summary="Health Check")
async def health_check() -> HealthResponse:
    """Return health status of the AI Tutor backend."""
    return HealthResponse(status="ok")
