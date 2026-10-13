import os
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

# Base workspace directory (ai_tutor root)
BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    """AI Tutor application configuration settings."""

    PROJECT_NAME: str = "AI Tutor"
    VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    HOST: str = "127.0.0.1"
    PORT: int = 8000

    # API Keys (for future LLM phases)
    GEMINI_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    MISTRAL_API_KEY: str = ""

    # Storage & Indexing Paths
    DATA_DIR: str = str(BASE_DIR / "data")
    PROCESSED_DATA_DIR: str = str(BASE_DIR / "data" / "processed")
    CHROMA_DIR: str = str(BASE_DIR / "data" / "index" / "chroma")
    BM25_DIR: str = str(BASE_DIR / "data" / "index" / "bm25")
    EVAL_DIR: str = str(BASE_DIR / "data" / "eval")

    # Retrieval Models
    EMBEDDING_MODEL: str = "BAAI/bge-small-en-v1.5"
    RERANKER_MODEL: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"

    # Retrieval Parameters
    TOP_K_VECTOR: int = 20
    TOP_K_BM25: int = 20
    TOP_K_FUSED: int = 20
    TOP_K_FINAL: int = 5
    RRF_K: int = 60

    # Block Policy Boosts
    SUMMARY_BOOST_MULTIPLIER: float = 1.15
    GLOSSARY_BOOST_MULTIPLIER: float = 1.15

    # Privacy & Logging
    DEBUG_RETRIEVAL: bool = False
    DEBUG_LLM: bool = False

    # LLM Settings (Phase 10)
    LLM_MODELS_CONFIG: str = str(Path(__file__).resolve().parent / "llm" / "models.yaml")
    LLM_DEFAULT_TIMEOUT: float = 25.0
    LLM_CIRCUIT_BREAKER_FAILURES: int = 3
    LLM_CIRCUIT_BREAKER_COOLDOWN: float = 60.0
    LLM_MAX_RETRIES: int = 2

    # Guardrails
    GUARDRAIL_MAX_QUESTION_LENGTH: int = 500
    GUARDRAIL_MIN_RERANK_SCORE: float = -8.0
    RATE_LIMIT_REQUESTS_PER_MINUTE: int = 60

    # Phase 11 Advanced RAG Settings
    REWRITE_MODE: str = "auto"  # "auto" | "always" | "off"
    FAST_MODE: bool = False     # If True, bypasses rewrite & expansion for low-latency
    MAX_LLM_CALLS_PER_REQUEST: int = 3
    REWRITE_TIMEOUT_SECONDS: float = 5.0
    EXPAND_TIMEOUT_SECONDS: float = 5.0
    MULTI_QUERY_VARIANTS: int = 2
    SOFT_CHAPTER_THRESHOLD: float = -4.0
    ENRICHMENT_DIR: str = str(BASE_DIR / "data" / "processed" / "enrichment")

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3002",
        "http://192.168.0.106:3000",
    ]

    model_config = SettingsConfigDict(
        env_file=[
            str(BASE_DIR / ".env"),
            str(Path(__file__).resolve().parent.parent / ".env"),
            ".env",
        ],
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
