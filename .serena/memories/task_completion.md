# Task Completion Checklist

Run these after every code change:

## Backend (`apps/api/`)
```bash
# Run tests (from project root)
pytest apps/api/tests -v
```

No linter or type checker is configured for the Python backend. Tests are the only verification step.

## Frontend (`apps/web/`)
```bash
# Run ESLint
npm run lint --prefix apps/web
```

There is no `tsc --noEmit` typecheck script defined in package.json scripts.

## Docker
If Docker-related files changed:
```bash
docker compose build api
```
