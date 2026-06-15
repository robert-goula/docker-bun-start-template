# Project Information

## Stack

- **Language**: TypeScript
- **Runtime**: Bun
- **Framework**:
  - Use Tanstack Start for all pages and API routes, but prefer server functions over API routes when possible, but create API routes as needed.
  - Use Tanstack Query for data fetching and mutations, but prefer preloading with server functions.
  - Use loaders and useSuspenseQuery for data fetching in server components when possible
- **Styling**:
  - Prefer shadcn/ui using Base UI components, but convert them to standard css instead of tailwind and use the existing style tokens in `:root {}` of `./apps/web/src/styles.css`.
  - Tailwind is allowed for utility classes, but avoid it for styling of components.
  - Basic ui component building blocks are located in `apps/web/src/components/ui/`.
- **Database**: Drizzle + PostgreSQL
- **Testing**: Vitest, React Testing Library, Cypress
- **Linting**: Oxlint
- **Formatting**: Oxfmt
- **Environment Management**: direnv + varlock
- **Containerization**: Docker
- **Package Management**: bun (inside container)
- **CI/CD**: GitHub Actions

## Environment Variable Management

This project uses **direnv** + **varlock** for environment management. There is NO `.env` file.

- `.env.schema` — defines all required variables and their types/constraints
- `.env.local` — satisfies the schema (loaded by direnv via `.envrc`); never commit this
- `Justfile` — all commands that need env vars run through `just`, which ensures direnv is active

### Rules
- Be concise in your responses.
- Never assume a library is available
- Never include a package version that has been released within the last five business days
- Never suggest creating or reading an `.env*` file
- Never suggest `dotenv`, or similar loaders
- To run anything requiring env vars, use `just <recipe>` — do not run commands directly
- To inspect available variables, check `.env.schema`
- To verify the environment is loaded, run `direnv status` or `echo $SOME_VAR`
- Secrets live in `.env.local` — never read, modify, or suggest committing it
