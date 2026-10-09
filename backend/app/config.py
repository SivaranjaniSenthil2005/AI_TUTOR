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

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
