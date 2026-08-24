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

    # Access control (empty = open, fine for localhost-only deployments).
    # memory_api_key: required X-API-Key header for clients not coming from a trusted IP.
    # memory_trusted_ips: comma-separated IPs allowed without a key (e.g. your home IP as seen by Cloudflare).
    memory_api_key: str = ""
    memory_trusted_ips: str = ""

    # Extraction
    extraction_token_threshold: int = 10000  # min tokens accumulated to trigger batch LLM extraction (default 10k)
    extraction_max_retries: int = 3
    extraction_poll_interval: float = 2.0  # seconds between queue polls
    extraction_chunk_tokens: int = 6000  # max estimated conversation tokens per LLM call (keeps prompts under provider TPM limits)

    # LLM calls
    llm_timeout_seconds: int = 120  # per-completion timeout — large extraction prompts need well over 30s

    # Auto-approve
    auto_approve_enabled: bool = True
    auto_approve_threshold: float = 0.85

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
