"""Schemas package for AI Tutor."""
from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Health check response schema."""
    status: str
