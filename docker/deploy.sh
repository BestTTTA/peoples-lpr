#!/bin/sh
# Build the current checkout on this host and swap the container over to it.
#
#   ./docker/deploy.sh [tag]        # tag defaults to the short commit SHA
#
# On a failed health check the previous image is brought back up.
set -eu

cd "$(CDPATH= cd "$(dirname "$0")/.." && pwd)"

TAG="${1:-$(git rev-parse --short HEAD)}"
IMAGE="peoples-lpr:${TAG}"
CONTAINER="peoples-lpr"

if [ ! -f .env ]; then
  echo "deploy: .env is missing next to docker-compose.yml" >&2
  exit 1
fi

APP_PORT=$(sed -n 's/^APP_PORT=//p' .env | tail -1)
APP_PORT="${APP_PORT:-3300}"

PREV_IMAGE=$(docker inspect -f '{{.Config.Image}}' "$CONTAINER" 2>/dev/null || true)
echo "deploy: current image = ${PREV_IMAGE:-<none>}"

echo "deploy: building $IMAGE"
docker build -t "$IMAGE" .
# The plate detector rebuilds from cache unless crop-service/ changed.
echo "deploy: building plate-crop"
docker compose build plate-crop

echo "deploy: starting $IMAGE"
ok=0
if DOCKER_IMAGE="$IMAGE" docker compose up -d; then
  # /api/reports touches Postgres, so a 200 means the app and its database are up.
  echo "deploy: waiting for /api/reports on port $APP_PORT"
  i=0
  while [ "$i" -lt 30 ]; do
    if curl -fsS "http://127.0.0.1:${APP_PORT}/api/reports" >/dev/null 2>&1; then
      ok=1
      break
    fi
    if [ -z "$(docker ps -q -f "name=^${CONTAINER}$")" ]; then
      echo "deploy: container exited" >&2
      break
    fi
    i=$((i + 1))
    sleep 2
  done
else
  echo "deploy: compose up failed" >&2
fi

if [ "$ok" = "1" ]; then
  echo "deploy: healthy on $IMAGE"
  docker image prune -f >/dev/null 2>&1 || true
  exit 0
fi

echo "deploy: FAILED - last 60 log lines follow" >&2
docker logs --tail 60 "$CONTAINER" >&2 2>&1 || true

if [ -n "$PREV_IMAGE" ] && docker image inspect "$PREV_IMAGE" >/dev/null 2>&1; then
  echo "deploy: rolling back to $PREV_IMAGE" >&2
  DOCKER_IMAGE="$PREV_IMAGE" docker compose up -d
  echo "deploy: rolled back" >&2
else
  echo "deploy: no previous image to roll back to" >&2
fi
exit 1
