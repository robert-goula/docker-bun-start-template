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

bump TYPE="patch|minor|major|preminor|premajor|beta|rc":
  #!/usr/bin/env bash
  set -euo pipefail
  BUMP="{{TYPE}}"
  VALID=(patch minor major beta rc preminor premajor)
  if [[ ! " ${VALID[*]} " =~ " ${BUMP} " ]]; then
    echo "Error: '$BUMP' is not valid. Choose one of: ${VALID[*]}."
    exit 1
  fi
  echo "Bumping version with type: ${BUMP}"
  if [[ "$BUMP" == "beta" || "$BUMP" == "rc" ]]; then
    varlock run -- docker compose exec web bun pm version prerelease --preid=${BUMP} --no-git-tag-version
  else
    varlock run -- docker compose exec web bun pm version ${BUMP} --no-git-tag-version
  fi
  export VERSION=$(bun pm pkg get version --cwd apps/web | tr -d '"')
  git tag -a -f v$VERSION -m "Release version ${VERSION}"
  git tag -a -f latest -m "Release version ${VERSION}"

build:
  #!/usr/bin/env bash
  set -euo pipefail
  export DIGEST=$(docker inspect --format='{{ "{{index .RepoDigests 0}}" }}' dhi.io/bun:1)
  export VERSION=$(bun pm pkg get version --cwd apps/web | tr -d '"')
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
