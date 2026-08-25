#!/usr/bin/env bash
set -euo pipefail

VPS_HOST="${VPS_HOST:-viktor@152.53.184.198}"
REMOTE_DIR="${REMOTE_DIR:-~/victorious-memory}"
HEALTH_URL="${HEALTH_URL:-https://memory.damra.co/health}"

echo "Deploying Victorious Memory to VPS..."
echo "  Host: $VPS_HOST"
echo "  Dir:  $REMOTE_DIR"
echo ""

ssh "$VPS_HOST" "cd $REMOTE_DIR && git pull origin main && docker compose up -d --build api web"

echo ""
echo "Waiting for containers to start..."
sleep 10

echo "Health check: $HEALTH_URL"
if curl -sf -m 15 "$HEALTH_URL" > /dev/null 2>&1; then
  echo "✅ Deployed — API healthy"
else
  echo "⚠️  Health check failed — check logs:"
  echo "  ssh $VPS_HOST 'docker logs victorious-memory-api-1 --tail 30'"
  exit 1
fi
