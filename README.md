# mcp-gateway-lite

[![CI](https://github.com/heonny/mcp-gateway-lite/actions/workflows/ci.yml/badge.svg)](https://github.com/heonny/mcp-gateway-lite/actions/workflows/ci.yml)
[![Codecov](https://codecov.io/gh/heonny/mcp-gateway-lite/graph/badge.svg)](https://codecov.io/gh/heonny/mcp-gateway-lite)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-yellow.svg)](https://github.com/heonny/mcp-gateway-lite/blob/main/LICENSE)

Lightweight multi-adapter MCP gateway for Postgres, Redis, and ClickHouse.

`mcp-gateway-lite` exposes multiple backends behind a single Streamable HTTP MCP server, with shared authentication, rate limiting, structured logs, health checks, and Prometheus metrics.

```text
POST /mcp/postgres
POST /mcp/redis
POST /mcp/clickhouse
```

## Why

When you operate multiple MCP backends separately, you usually end up managing:

- multiple ports
- duplicated auth logic
- duplicated health and metrics endpoints
- inconsistent logging and safety rules

`mcp-gateway-lite` centralizes that into one HTTP gateway and one config surface.

## Features

- Single Fastify-based gateway for multiple MCP adapters
- Streamable HTTP MCP routing
- Built-in bearer token authentication
- Prometheus metrics and health checks
- Read-only SQL guardrails for Postgres and ClickHouse
- Allowlist-based read-only Redis commands
- Query audit logging with `redacted`, `minimal`, `full`, and `disable` modes
- Config-driven adapter registration
- TypeScript strict mode with Vitest coverage
- Dockerfile and `docker-compose.yml` examples

## Architecture

```text
client
  -> /mcp/postgres
  -> /mcp/redis
  -> /mcp/clickhouse

Fastify gateway
  -> auth
  -> rate limit
  -> metrics
  -> audit logging
  -> adapter dispatch

adapter
  -> postgres | redis | clickhouse
```

## Supported Adapters

| Adapter    | Tool      | Policy                              |
| ---------- | --------- | ----------------------------------- |
| Postgres   | `query`   | read-only SQL only                  |
| ClickHouse | `query`   | read-only SQL only                  |
| Redis      | `command` | allowlisted read-only commands only |

## Quick Start

### Requirements

- Node.js `22+`
- `pnpm`
- reachable Postgres, Redis, or ClickHouse instances

### Install

```bash
pnpm install
cp config.example.yml config.yml
```

`config.yml` is intentionally not committed. Create it locally from [`config.example.yml`](./config.example.yml).

### Set secrets

```bash
export MCP_BEARER_TOKEN='change-this-bearer-token'
export POSTGRES_USER='your-postgres-user'
export POSTGRES_PASSWORD='change-this-postgres-password'
export REDIS_PASSWORD='change-this-redis-password'
export CLICKHOUSE_USER='your-clickhouse-user'
export CLICKHOUSE_PASSWORD='change-this-clickhouse-password'
```

### Run in development

```bash
pnpm dev
```

Default endpoints:

- `GET /health`
- `GET /metrics`
- `POST /mcp/postgres`
- `POST /mcp/redis`
- `POST /mcp/clickhouse`

## Configuration

By default the app reads `./config.yml`. You can override it with `--config`.

```bash
node dist/main.js --config /app/config.yml
```

Minimal example:

```yaml
server:
  host: 0.0.0.0
  port: 8610
  endpoint: mcp
  requestBodyLimit: 1mb
  requestTimeoutMs: 10000

auth:
  enabled: true
  tokenEnv: MCP_BEARER_TOKEN
  protectMetrics: true
  protectHealth: false

security:
  queryLogLevel: redacted
  rateLimit:
    enabled: true
    windowMs: 60000
    maxRequests: 120

observability:
  metricsEnabled: true
  healthPath: /health
  metricsPath: /metrics

adapters:
  postgres:
    type: postgres
    enabled: true
    path: postgres
    host: postgres.example.internal
    port: 5432
    database: app
    userEnv: POSTGRES_USER
    passwordEnv: POSTGRES_PASSWORD
```

Configuration rules:

- `server.endpoint` defines the shared MCP base path.
- Each adapter uses a relative `path`, not an absolute route.
- Final routes are assembled as `/{server.endpoint}/{adapter.path}`.
- Secrets should be referenced with `*Env`, not written into YAML.
- Enabled adapters must not share the same `path`.

See [`config.example.yml`](./config.example.yml) for the full example, including Redis and ClickHouse.

## Authentication

Bearer token auth is enabled by default.

Supported header:

```http
Authorization: Bearer <token>
```

Default protection policy:

- `/mcp/*`: protected
- `/metrics`: protected
- `/health`: public

Relevant settings:

- `auth.enabled`
- `auth.tokenEnv`
- `auth.protectMetrics`
- `auth.protectHealth`

## Endpoints

### `POST /{endpoint}/{adapter}`

Streamable HTTP MCP endpoint.

Examples:

- `POST /mcp/postgres`
- `POST /mcp/redis`
- `POST /mcp/clickhouse`

### `GET /health`

Returns service and adapter health in JSON.

```json
{
  "ok": true,
  "service": {
    "name": "mcp-gateway-lite",
    "endpoint": "/mcp"
  },
  "adapters": {
    "postgres": {
      "ok": true,
      "latencyMs": 8,
      "details": {
        "database": "app"
      }
    }
  }
}
```

### `GET /metrics`

Returns Prometheus text-format metrics.

Main metrics:

- `mcp_gateway_http_requests_total`
- `mcp_gateway_adapter_tool_calls_total`
- `mcp_gateway_adapter_health`
- `mcp_gateway_adapter_request_duration_ms`

## Logging and Observability

Structured logs use `pino`.

`security.queryLogLevel` controls audit detail:

- `redacted`: default, stores hash and metadata without raw query text
- `minimal`: stores only minimal metadata
- `full`: stores full query or command text
- `disable`: disables query audit logging

Recommended defaults:

- development: `redacted`
- production: `redacted` or `minimal`
- restricted debugging only: `full`

## Security Notes

This project is designed to reduce operational risk, not eliminate it.

- Do not commit bearer tokens or backend passwords.
- Use dedicated read-only credentials for each backend.
- Keep `queryLogLevel` at `redacted` or `minimal` in production.
- Put the gateway behind a reverse proxy or trusted network boundary.
- Review Redis allowlisted commands for your workload before production use.

More details are in [`SECURITY.md`](./SECURITY.md).

## Docker

### Build image

```bash
docker build -t mcp-gateway-lite .
```

### Run container

```bash
docker run --rm \
  -p 8610:8610 \
  -e MCP_BEARER_TOKEN='change-this-bearer-token' \
  -e POSTGRES_USER=your-postgres-user \
  -e POSTGRES_PASSWORD=change-this-postgres-password \
  -e REDIS_PASSWORD=change-this-redis-password \
  -e CLICKHOUSE_USER=your-clickhouse-user \
  -e CLICKHOUSE_PASSWORD=change-this-clickhouse-password \
  -v $(pwd)/config.yml:/app/config.yml:ro \
  mcp-gateway-lite
```

### Docker Compose

[`docker-compose.yml`](./docker-compose.yml) is included as a starting point.

```bash
docker compose up --build
```

## Reverse Proxy Example

```nginx
server {
  listen 443 ssl http2;
  server_name streamable.mcp;

  location / {
    proxy_pass http://127.0.0.1:8610;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## Development

Commands:

```bash
pnpm dev
pnpm build
pnpm lint
pnpm test
pnpm format
pnpm format:write
```

Validated by tests:

- config schema validation
- bearer token authentication
- health and metrics routes
- adapter routing
- Postgres and ClickHouse read-only SQL guards
- Redis allowlist command guards
- query audit logging
- graceful shutdown

## Project Structure

```text
mcp-gateway-lite/
  .github/workflows/
  src/
    adapters/
    auth/
    config/
    logging/
    metrics/
    server/
    utils/
  test/
  config.example.yml
  Dockerfile
  docker-compose.yml
```

## Extending with a New Adapter

To add another backend:

1. Implement the [`AdapterInstance`](./src/types.ts) contract.
2. Add the adapter under [`src/adapters`](./src/adapters).
3. Register it in [`src/adapters/index.ts`](./src/adapters/index.ts).
4. Add configuration under `adapters:` in your local `config.yml`.

This project currently supports in-repo adapters rather than external plugin loading.

## Contributing

Contributions are welcome.

- Read [`CONTRIBUTING.md`](./CONTRIBUTING.md) before opening a PR.
- Keep changes scoped and tested.
- Update docs when behavior or configuration changes.

## License

MIT. See [`LICENSE`](./LICENSE).
