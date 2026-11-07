from typing import Any

from pydantic import PostgresDsn, ValidationInfo, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_ignore_empty=True, extra="ignore"
    )

    PROJECT_NAME: str = "Docuflow SaaS"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str
    ALGORITHIM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # DATABASE settings
    DB_USER: str
    DB_PASSWORD: str
    DB_HOST: str
    DB_PORT: int
    DB_NAME: str

    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET_NAME: str = "docuflow-documents"
    MINIO_SECURE: bool = False

    # Embeddings: when this directory exists the model is loaded from disk and
    # HuggingFace is never contacted. Otherwise the hub id is used instead.
    EMBEDDING_MODEL_PATH: str = "models/all-MiniLM-L6-v2"
    EMBEDDING_MODEL_ID: str = "all-MiniLM-L6-v2"

    # Gemini is the primary answer provider when a key is configured. The
    # stable Flash-Lite model offers a 1M-token input window and 65K output
    # ceiling; Docuflow uses a smaller configurable budget for normal answers.
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.5-flash-lite"
    GEMINI_BASE_URL: str = "https://generativelanguage.googleapis.com/v1beta"
    GEMINI_TIMEOUT_SECONDS: float = 90.0
    GEMINI_MAX_OUTPUT_TOKENS: int = 1800
    GEMINI_TEMPERATURE: float = 0.1
    GEMINI_MAX_RETRIES: int = 2

    # OpenRouter (RAG answer generation)
    # Get a key at https://openrouter.ai/keys. Leave blank to run without
    # AI generation; the /query endpoints then return relevant excerpts.
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODELS: str = (
        "nvidia/nemotron-3.5-lightning:free,"
        "google/gemma-4-31b-it:free,"
        "xingchen-agi/xing4.0-29b-a4b:free,"
        "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"
    )
    OPENROUTER_MODEL: str = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"
    # Optional second model for server-side failover. Leave blank to use
    # only OPENROUTER_MODEL.
    OPENROUTER_FALLBACK_MODEL: str = ""
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    OPENROUTER_TIMEOUT_SECONDS: float = 90.0
    OPENROUTER_MAX_TOKENS: int = 1800
    OPENROUTER_TEMPERATURE: float = 0.1
    OPENROUTER_MAX_RETRIES: int = 4
    OPENROUTER_REASONING_ENABLED: bool = False
    OPENROUTER_SITE_URL: str = "http://localhost:5180"
    OPENROUTER_APP_NAME: str = "DocuFlow"
    LLM_PROVIDER_COOLDOWN_SECONDS: int = 60

    # Retrieval quality gate. Chunks below this cosine similarity are ignored,
    # so unrelated questions fall through to a clearly-labelled general answer
    # instead of being answered from the wrong document.
    RAG_MIN_SIMILARITY: float = 0.34
    RAG_MAX_CONTEXT_CHUNKS: int = 5
    RAG_HISTORY_TURNS: int = 8

    # Public URL of the frontend, used to build invitation links.
    FRONTEND_URL: str = "http://localhost:5180"
    INVITATION_EXPIRE_DAYS: int = 7

    # 🟢 Yahan defaults update karein taake field required na rahe validation ke waqt
    DATABASE_URI: str = ""

    @field_validator("DATABASE_URI", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: Any, info: ValidationInfo) -> Any:
        # Agar .env mein pehle se poori link string maujood hai to usey chalne dein
        if isinstance(v, str) and v.startswith("postgresql"):
            return v

        # Agar .env mein DATABASE_URI khali hai ya abhi tak generate nahi hui, to variables se khud banayein
        db_user = info.data.get("DB_USER")
        db_password = info.data.get("DB_PASSWORD")
        db_host = info.data.get("DB_HOST")
        db_port = info.data.get("DB_PORT")
        db_name = info.data.get("DB_NAME")

        # Fallback security check agar variables bhi missing hon test runs mein
        if not all([db_user, db_host, db_name]):
            return "postgresql+asyncpg://postgres:postgres@localhost:5432/docuflow_db"

        # Async connection string for SQLAlchemy (asyncpg)
        return str(
            PostgresDsn.build(
                scheme="postgresql+asyncpg",
                username=db_user,
                password=db_password,
                host=db_host,
                port=db_port,
                path=db_name,
            )
        )


settings = Settings()  # type: ignore
