#!/usr/bin/env just --justfile
set export

#init:
#      sh -c 'git config --local --get core.hooksPath | grep -q ".githooks" || git config --local core.hooksPath ./.githooks'

dev:
  eval "$(varlock load --format shell)" && \
    mprocs \
      "docker compose -f docker-compose.yaml up"

env:
  eval "$(varlock load --format shell)" && \
    printenv | grep "POSTGRES\|DATABASE_URL"

test:
  eval "$(varlock load --format shell)" && \
    mprocs \
      "docker compose exec web bun run test"

sql:
  eval "$(varlock load --format shell)" && \
    docker compose exec db psql -h ${POSTGRES_HOST} -U ${POSTGRES_USER} -d ${POSTGRES_DB}

sh:
  eval "$(varlock load --format shell)" && \
    docker compose exec web bash

rebuild:
  eval "$(varlock load --format shell)" && \
    docker compose -f docker-compose.yaml up --build --force-recreate

stop:
  eval "$(varlock load --format shell)" && \
    docker compose down --remove-orphans

db-generate:
  eval "$(varlock load --format shell)" && \
    docker compose exec web bun run db:generate

db-migrate:
  eval "$(varlock load --format shell)" && \
    docker compose exec web bun run db:migrate

build:
    #!/usr/bin/env bash
    set -euo pipefail
    export DIGEST=$(docker inspect --format='{{ "{{index .RepoDigests 0}}" }}' dhi.io/bun:1)
    export VERSION=$(jq -er .version ./apps/web/package.json)
    echo "Building version: ${VERSION} with digest: ${DIGEST}"
    docker build \
      -f ./docker/web/Dockerfile \
      --tag ${PROJECT_NAME}:${VERSION} \
      --tag ${PROJECT_NAME}:latest \
      --platform linux/amd64 \
      --build-arg BUILD_DIGEST=${DIGEST} \
      --build-arg BUILD_VERSION=${VERSION} \
      --build-arg BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ") \
      --build-arg VCS_REF=$(git rev-parse --short HEAD) \
      .
