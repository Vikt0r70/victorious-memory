# Victorious Memory

An AI memory system that automatically captures, structures, and retrieves knowledge from coding conversations. Integrates with OpenCode as a plugin for zero-friction memory.

## Quick Start

```bash
cp .env.example .env
# Edit .env with your LLM provider details
docker compose up -d
```

## Deployment

### Local development

```bash
docker compose up -d
cd apps/web && npm run dev    # Dashboard on :3000
```

### VPS deployment

```bash
# On the VPS:
git clone https://github.com/Vikt0r70/victorious-memory.git
cd victorious-memory
cp .env.example .env
# Edit .env: set LLM_API_KEY, MEMORY_API_KEY, MEMORY_TRUSTED_IPS, NEXT_PUBLIC_API_URL=/api
docker compose up -d --build
```

### Push-to-deploy

```bash
# From local machine after pushing to main:
./deploy.sh
# SSHes to VPS → git pull → docker compose up --build → health check
```

## Components

| Component    | Port  | Description                          |
|--------------|-------|--------------------------------------|
| API          | 8080  | FastAPI backend + extraction worker  |
| Web          | 3002  | Next.js dashboard                    |
| DB           | 5432  | PostgreSQL 16 + pgvector             |
| MCP Server   | stdio | stdin/stdout JSON-RPC, 5 tools       |
| Plugin       | —     | OpenCode plugin, auto-capture+inject |

## Architecture

See [IMPLEMENTATION.md](./IMPLEMENTATION.md) for the full system design.

## License

MIT
