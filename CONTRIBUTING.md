# Contributing

Thank you for contributing to `mcp-gateway-lite`.

## Prerequisites

- Node.js `22+`
- `pnpm`
- Access to the backing services you want to test against

## Development Setup

1. Install dependencies.

```bash
pnpm install
```

2. Create a local config file from the example.

```bash
cp config.example.yml config.yml
```

3. Export the required environment variables.

```bash
export MCP_BEARER_TOKEN='change-this-bearer-token'
export POSTGRES_USER='your-postgres-user'
export POSTGRES_PASSWORD='change-this-postgres-password'
export REDIS_PASSWORD='change-this-redis-password'
export CLICKHOUSE_USER='your-clickhouse-user'
export CLICKHOUSE_PASSWORD='change-this-clickhouse-password'
```

4. Start the development server.

```bash
pnpm dev
```

## Validation Checklist

Run these commands before opening a pull request.

```bash
pnpm lint
pnpm test
pnpm build
```

## Pull Request Guidelines

- Keep changes focused and scoped to a single concern.
- Add or update tests when behavior changes.
- Update `README.md` when the public interface or configuration changes.
- Do not commit secrets, production hostnames, or local-only config files such as `config.yml`.

## Commit Style

This repository uses concise prefixes:

- `feat:`
- `fix:`
- `chore:`
- `refactor:`
- `doc:`
