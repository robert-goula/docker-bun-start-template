# Environment Management Rules

ALWAYS: Use `just <recipe>` to run commands that require environment variables.
NEVER: Suggest `.env` files, `dotenv` packages, or inline `export VAR=val` as a solution.
NEVER: Read or write `.env.local` — it contains sources of real secrets.
CONTEXT: Variables are declared in `.env.schema` and provided at runtime by direnv + varlock.
