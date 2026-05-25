from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Centralized configuration from environment variables."""

    # Database
    database_url: str = "postgresql+asyncpg://victorious:victorious@localhost:5432/victorious"

    # Embedding service (HuggingFace TEI)
    embedding_url: str = "http://localhost:8090"
    embedding_dimensions: int = 384

    # LLM Provider (default — user configures more via UI)
    llm_base_url: str = "http://localhost:7777/v1"
    llm_model: str = "gpt-5-mini"
    llm_api_key: str = ""

    # Encryption key for Fernet-encrypting stored provider API keys
    provider_key_encryption_key: str = ""

    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8080
    debug: bool = False

    # Extraction
    extraction_token_threshold: int = 500
    extraction_max_retries: int = 3
    extraction_poll_interval: float = 2.0

    # Auto-approve
    auto_approve_enabled: bool = True
    auto_approve_threshold: float = 0.85

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
