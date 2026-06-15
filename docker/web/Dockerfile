FROM dhi.io/bun:1-dev AS builder

WORKDIR /app

COPY apps/web/package.json apps/web/bun.lock* apps/web/bunfig.toml ./

RUN bun install --frozen-lockfile

COPY ./apps/web ./

RUN bun run build

EXPOSE 3000
CMD ["bunx", "--bun", "vite", "dev"]

FROM dhi.io/bun:1 AS prod

ARG BUILD_VERSION=unknown
ARG BUILD_DATE=unknown
ARG MAINTAINER=unknown
ARG PROJECT_NAME=unknown
ARG VCS_REF=unknown

LABEL \
  maintainer=$MAINTAINER \
  org.label-schema.schema-version=$BUILD_VERSION \
  org.label-schema.name=$PROJECT_NAME \
  org.label-schema.description="Docker image for Bun TanStack Start" \
  org.label-schema.vendor=$MAINTAINER \
  org.label-schema.vcs-ref=$VCS_REF \
  org.label-schema.build-date=$BUILD_DATE \
  org.label-schema.version=$BUILD_VERSION

WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0

COPY --from=builder /app/.tanstack /app/node_modules /app/package.json /app/bun.lock /app/drizzle.config.ts /app/tsconfig.json /app/vite.config.ts /app/src ./

USER nonroot

EXPOSE 3000
ENTRYPOINT [ "bun", "run", "start" ]
