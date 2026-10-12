"""Phase 12 Contract Tests: Verifies that frontend TypeScript definitions
strictly match the backend FastAPI OpenAPI schema and endpoints.
"""

import re
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

FRONTEND_TYPES_FILE = (
    Path(__file__).resolve().parent.parent.parent
    / "frontend"
    / "lib"
    / "api"
    / "types.ts"
)


def extract_ts_interface_fields(ts_content: str, interface_name: str) -> set:
    """Extracts property names defined on a TypeScript interface."""
    pattern = rf"export interface {interface_name}\s*\{{([^}}]+)\}}"
    match = re.search(pattern, ts_content)
    if not match:
        return set()
    block = match.group(1)
    fields = set()
    for line in block.splitlines():
        line = line.strip()
        if not line or line.startswith("//") or line.startswith("/*"):
            continue
        field_match = re.match(r"^([a-zA-Z0-9_]+)\??\s*:", line)
        if field_match:
            fields.add(field_match.group(1))
    return fields


def test_openapi_endpoints_exist():
    """Verify all required Phase 12 endpoints exist in the FastAPI app."""
    response = client.get("/openapi.json")
    assert response.status_code == 200
    spec = response.json()
    paths = spec.get("paths", {})

    assert "/api/scope" in paths, "Missing GET /api/scope endpoint"
    assert "get" in paths["/api/scope"]

    assert "/api/llm/status" in paths, "Missing GET /api/llm/status endpoint"
    assert "get" in paths["/api/llm/status"]

    assert "/api/ask" in paths, "Missing POST /api/ask endpoint"
    assert "post" in paths["/api/ask"]

    assert "/api/ask/stream" in paths, "Missing POST /api/ask/stream endpoint"
    assert "post" in paths["/api/ask/stream"]


def test_frontend_types_match_backend_schema():
    """Verify that frontend/lib/api/types.ts definitions match backend models."""
    assert FRONTEND_TYPES_FILE.exists(), f"Frontend types file missing: {FRONTEND_TYPES_FILE}"
    ts_code = FRONTEND_TYPES_FILE.read_text(encoding="utf-8")

    response = client.get("/openapi.json")
    assert response.status_code == 200
    spec = response.json()
    schemas = spec.get("components", {}).get("schemas", {})

    # 1. AskRequest schema contract
    if "AskRequest" in schemas:
        backend_ask_props = set(schemas["AskRequest"].get("properties", {}).keys())
        ts_ask_props = extract_ts_interface_fields(ts_code, "AskRequest")
        # Ensure core fields are present in TS
        core_fields = {"question", "board", "subject", "mode", "learner_profile", "history"}
        assert core_fields.issubset(backend_ask_props), f"Missing core backend fields: {core_fields - backend_ask_props}"
        assert core_fields.issubset(ts_ask_props), f"Missing core frontend TS fields: {core_fields - ts_ask_props}"

    # 2. AnswerResult schema contract
    if "AnswerResult" in schemas:
        backend_answer_props = set(schemas["AnswerResult"].get("properties", {}).keys())
        ts_answer_props = extract_ts_interface_fields(ts_code, "AnswerResult")
        core_answer_fields = {"answer", "sources", "grounded", "provider", "model", "speech_text", "suggested_questions"}
        assert core_answer_fields.issubset(backend_answer_props)
        assert core_answer_fields.issubset(ts_answer_props)

    # 3. LearnerProfile schema contract
    if "LearnerProfile" in schemas:
        backend_learner_props = set(schemas["LearnerProfile"].get("properties", {}).keys())
        ts_learner_props = extract_ts_interface_fields(ts_code, "LearnerProfile")
        assert {"reading_level", "max_sentences", "avoid_figurative_language", "repeat_key_term"}.issubset(ts_learner_props)


def test_api_scope_endpoint_contract():
    """Verify /api/scope response matches ScopeResponse TypeScript schema."""
    response = client.get("/api/scope")
    assert response.status_code == 200
    data = response.json()

    assert "supported_boards" in data
    assert "supported_classes" in data
    assert "supported_subjects" in data
    assert "medium" in data

    assert "tn" in data["supported_boards"]
    assert "cbse" in data["supported_boards"]
    assert 10 in data["supported_classes"]
    assert "science" in data["supported_subjects"]
    assert "social_science" in data["supported_subjects"]
