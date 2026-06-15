# Package Management

NEVER: Run `bun install` or `bun add` directly. Always run the command inside the container instead.
ALWAYS: Use `docker compose exec <service> <command>` to run package management commands inside the container instead of locally on the machine.
CONTEXT: The project uses a containerized environment for development, so all package management commands must be executed within the container to ensure consistency, avoid conflicts with local machine configurations, and prevent unnecessary exposure to supply chain attacks.
