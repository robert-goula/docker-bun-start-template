# Docker Bun TanStack Start Template

This is a dockerized full-stack web application boilerplate, built with:

- Bun (runtime)
- Docker Compose (dev environment)
- Drizzle ORM (database layer) with PostgreSQL
- Effect-TS
- Tanstack Start (server framework)
- Vitest, Testing Library, and Cypress

## Tooling Setup
- `docker` Docker & Docker Compose
- [`direnv`](https://github.com/direnv/direnv) Environment variable management
- [`oxc`](https://oxc.rs/) Linting and formatting
- [`mprocs`](https://github.com/pvolok/mprocs) Process management
- [`just`](https://github.com/casey/just) Command runner for common tasks
- [`pass`](https://www.passwordstore.org/) CLI for secrets management (optional varlock plugin)
- [`varlock`](https://github.com/dmno-dev/varlock) CLI for secrets management
- `jq` (optional, for JSON parsing in shell scripts)

Docker Hardened Images are used for security, and the development environment
is designed to be as close to production as possible, with secrets management
via `direnv` + `varlock` and a `just` command interface for all operations.

Everything happens in the container to avoid potential host environment issues,
added security and hygiene benefits, and to ensure consistency across different
developer machines.

## Project Setup

To run this application:
Copy and edit the `.env.local` with any secret environment variables you need
and add them to `pass` or another [varlock compatible plugin](https://github.com/dmno-dev/varlock#plugins).
Then copy and edit the the `.envrc` with any non-secret environment variables
you need and then allow the changes with `direnv allow`.  Once that is done,
you can start the development server with `just dev` which will start all the
containers and run the server with the correct environment variables injected.
Press 'q' to stop the server and all containers, or run `just stop`.

```sh
cp .envrc.example .envrc
cp .env.local.example .env.local
# edit any port mappings or other config in .envrc/.env.local as needed
direnv allow
# Start the development server with mprocs, press 'q' to stop
just env
# or run from another shell
just stop
```

## Links
- [web](https://docker.localhost/)
- [rustfs (s3)](http://docker.localhost:9001/)
- [rustfs (s3 admin)](http://docker.localhost:9001/rustfs/console/browser/)
- [mailhog](http://docker.localhost:8025/)
- [rabbitmq](http://docker.localhost:15672/) admin:admin

All development is done within the `web` container, so **never** run `bun add`
or similar on the host machine.  Use `just` commands to run things inside the
container.  Secrets are managed with `direnv` + `varlock` and injected at
runtime, so **do not** read or write `.env.local` directly.

All required environment variables are declared in `.env.schema` and provided by the dev environment.

# Building For Production

> [!NOTE]
> The builder stage has to use `bun:1-dev` to execute any shell commands,
> so the builder image is based on `bun:1-dev` instead of `bun:1`.  This is
> because the builder needs to run `bun run tsc` and `bun run lint` for
> type-checking and linting, which are not available in the `bun:1` image.
> The final production image is still optimized and does not include any
> unnecessary development dependencies.

To build this application for production:

```bash
# Set a new version
npm pkg set version=0.1.0 --prefix ./apps/web
just build
```

## Testing

This project uses [`vitest`](https://vitest.dev/) for testing. You can run the tests with:

```bash
 just test
```

## Docker Hardened Images
```shell
docker login
docker pull dhi.io/bun:1
docker pull dhi.io/postgres:18-alpine3.23-dev
docker pull dhi.io/redis:8.8-compat
docker pull dhi.io/rabbitmq:4.3-debian
docker scout quickview dhi.io/bun:1
docker scout quickview dhi.io/postgres:18-alpine3.23-dev
docker scout quickview dhi.io/redis:8.8-compat
docker scout quickview dhi.io/rabbitmq:4.3-debian
```

## Installing Certificates

```shell
openssl req -x509 -nodes -days 365 -newkey rsa:4096 \
  -keyout certs/nginx.key -out certs/nginx.crt \
  -subj "/C=US/ST=<State>/L=/O=Local/CN=docker.localhost"
cd certs
mkcert -install
mkcert docker.localhost
```
