# Suggested Commands

## Backend (`apps/api/`)
```bash
# Install dev dependencies
pip install ".[dev]"

# Run tests
pytest apps/api/tests -v

# Run a single test file
pytest apps/api/tests/test_provider_service.py -v

# Run API dev server
uvicorn app.main:app --reload --port 8080
```

## Frontend (`apps/web/`)
```bash
# Install dependencies
npm install

# Dev server
npm run dev

# Build
npm run build

# Lint
npm run lint

# Production
npm run start
```

## Docker
```bash
# Start all services
docker compose up -d

# Rebuild and restart API only
docker compose up -d --build api

# View logs
docker compose logs -f
```

## Windows-specific
- Use `> $null` not `> /dev/null`
- Path separator in CLI: `apps\api\tests`
- Python: use `python` (not `python3`)
- npm scripts work unchanged on Windows
