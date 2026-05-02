#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/emeltec-platform}"
BRANCH="${BRANCH:-main}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
HEALTHCHECK_URLS="${HEALTHCHECK_URLS:-http://127.0.0.1:5173}"
export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-emeltec-platform}"

cd "$APP_DIR"

if [ ! -d .git ]; then
  echo "ERROR: $APP_DIR is not a git repository."
  echo "Clone the repo on the VM first, then run this deploy script again."
  exit 1
fi

if [ ! -f main-api/.env ]; then
  echo "ERROR: main-api/.env does not exist on the VM."
  echo "Create it from main-api/.env.example and fill the production values."
  exit 1
fi

echo "Fetching latest code from origin/$BRANCH..."
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "Validating Docker Compose configuration..."
docker compose -f "$COMPOSE_FILE" config >/dev/null

echo "Building and restarting services..."
docker compose -f "$COMPOSE_FILE" up -d --build --remove-orphans

echo "Current containers:"
docker compose -f "$COMPOSE_FILE" ps

if command -v curl >/dev/null 2>&1 && [ -n "$HEALTHCHECK_URLS" ]; then
  IFS=',' read -ra URLS <<< "$HEALTHCHECK_URLS"
  for url in "${URLS[@]}"; do
    echo "Checking $url..."
    curl -fsS --max-time 15 "$url" >/dev/null
  done
fi

echo "Cleaning dangling Docker images..."
docker image prune -f >/dev/null

echo "Deploy completed successfully."
