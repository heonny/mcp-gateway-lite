# mcp-gateway-lite

[![CI](https://github.com/heonny/mcp-gateway-lite/actions/workflows/ci.yml/badge.svg)](https://github.com/heonny/mcp-gateway-lite/actions/workflows/ci.yml)
[![Codecov](https://codecov.io/gh/heonny/mcp-gateway-lite/graph/badge.svg)](https://codecov.io/gh/heonny/mcp-gateway-lite)
[![npm version](https://img.shields.io/npm/v/mcp-gateway-lite)](https://www.npmjs.com/package/mcp-gateway-lite)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-yellow.svg)](https://github.com/heonny/mcp-gateway-lite/blob/main/LICENSE)

Postgres, Redis, ClickHouse를 하나의 Streamable HTTP MCP 게이트웨이로 묶는 경량 오픈소스 서버.

[English README](./README.en.md)

`mcp-gateway-lite`는 여러 데이터 백엔드를 각각 별도 MCP 서버로 운영하지 않고, 하나의 HTTP 엔드포인트 체계 아래에서 공통 인증, rate limit, 감사 로그, health check, metrics를 일관되게 제공하도록 설계되었습니다. GitHub와 npm에서 바로 받아 쓸 수 있는 배포 가능한 MCP gateway를 목표로 합니다.

```text
POST /mcp/postgres
POST /mcp/redis
POST /mcp/clickhouse
```

```bash
npx mcp-gateway-lite --config ./config.yml
```

## Overview

MCP를 실제 운영 환경에 붙이기 시작하면 백엔드 수만큼 포트, 인증, 로깅, 모니터링이 늘어납니다.

`mcp-gateway-lite`는 그 복잡도를 단일 게이트웨이로 정리합니다.

- 하나의 base path 아래에서 여러 backend 노출
- 공통 bearer token 인증
- 공통 health check와 Prometheus metrics
- backend별 read-only 가드
- 설정 기반 라우팅과 운영 표면 단순화

## Highlights

- Fastify 기반 단일 MCP gateway
- Streamable HTTP MCP routing
- Postgres, Redis, ClickHouse 지원
- Postgres, ClickHouse용 read-only SQL guard
- Redis allowlist 기반 read-only command 제한
- `redacted`, `minimal`, `full`, `disable` 감사 로그 레벨
- TypeScript strict mode, Vitest, coverage
- Dockerfile과 `docker-compose.yml` 예시 포함

## Request Flow

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
- 접근 가능한 Postgres, Redis, ClickHouse 인스턴스

### Install

```bash
npm install -g mcp-gateway-lite
cp config.example.yml config.yml
```

`config.yml`은 저장소에 포함하지 않습니다. 항상 [`config.example.yml`](./config.example.yml)을 복사해 로컬에서 생성하세요.

또는 설치 없이 바로 실행:

```bash
npx mcp-gateway-lite --config ./config.yml
```

### Set Secrets

```bash
export MCP_BEARER_TOKEN='change-this-bearer-token'
export POSTGRES_USER='your-postgres-user'
export POSTGRES_PASSWORD='change-this-postgres-password'
export REDIS_PASSWORD='change-this-redis-password'
export CLICKHOUSE_USER='your-clickhouse-user'
export CLICKHOUSE_PASSWORD='change-this-clickhouse-password'
```

### Run

```bash
mcp-gateway-lite --config ./config.yml
```

기본 엔드포인트:

- `GET /health`
- `GET /metrics`
- `POST /mcp/postgres`
- `POST /mcp/redis`
- `POST /mcp/clickhouse`

## Configuration

기본적으로 앱은 `./config.yml`을 읽고, 필요하면 `--config`로 경로를 바꿀 수 있습니다.

```bash
node dist/main.js --config /app/config.yml
```

예시:

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

규칙:

- `server.endpoint`가 공통 MCP base path를 결정합니다.
- 각 adapter는 상대 `path`를 사용합니다.
- 최종 라우트는 `/{server.endpoint}/{adapter.path}` 형태로 조합됩니다.
- 시크릿은 YAML에 직접 쓰지 말고 `*Env`로 참조합니다.
- 활성화된 adapter끼리는 같은 `path`를 사용할 수 없습니다.

전체 예시는 [`config.example.yml`](./config.example.yml)을 참고하세요.

## Authentication

기본 인증 방식은 bearer token입니다.

```http
Authorization: Bearer <token>
```

기본 보호 정책:

- `/mcp/*`: protected
- `/metrics`: protected
- `/health`: public

관련 설정:

- `auth.enabled`
- `auth.tokenEnv`
- `auth.protectMetrics`
- `auth.protectHealth`

## Endpoints

### `POST /{endpoint}/{adapter}`

Streamable HTTP MCP endpoint입니다.

예시:

- `POST /mcp/postgres`
- `POST /mcp/redis`
- `POST /mcp/clickhouse`

### `GET /health`

서비스와 adapter 상태를 JSON으로 반환합니다.

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

Prometheus text format metrics를 반환합니다.

대표 metric:

- `mcp_gateway_http_requests_total`
- `mcp_gateway_adapter_tool_calls_total`
- `mcp_gateway_adapter_health`
- `mcp_gateway_adapter_request_duration_ms`

## Observability

구조화 로그는 `pino`를 사용합니다.

`security.queryLogLevel`:

- `redacted`: 기본값, 원문 대신 hash와 메타데이터 기록
- `minimal`: 최소 메타데이터만 기록
- `full`: 쿼리 또는 명령 원문 기록
- `disable`: 감사 로그 비활성화

권장값:

- development: `redacted`
- production: `redacted` 또는 `minimal`
- restricted debugging only: `full`

## Security

- bearer token이나 backend password를 커밋하지 마세요.
- backend별 read-only 전용 계정을 사용하세요.
- 운영에서는 `queryLogLevel`을 `redacted` 또는 `minimal`로 유지하세요.
- reverse proxy 또는 신뢰된 네트워크 경계 뒤에 두세요.
- Redis allowlist는 실제 워크로드에 맞게 검토하세요.

자세한 내용은 [`SECURITY.md`](./SECURITY.md)를 참고하세요.

## Docker

### Build Image

```bash
docker build -t mcp-gateway-lite .
```

### Run Container

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

[`docker-compose.yml`](./docker-compose.yml)을 시작점으로 사용할 수 있습니다.

```bash
docker compose up --build
```

## npm Package

npm에 배포되어 있습니다. 현재 latest 버전은 `0.1.0`입니다.

```bash
npx mcp-gateway-lite --config ./config.yml
```

또는 전역 설치 후:

```bash
npm install -g mcp-gateway-lite
mcp-gateway-lite --config ./config.yml
```

패키지 페이지: [npmjs.com/package/mcp-gateway-lite](https://www.npmjs.com/package/mcp-gateway-lite)

## Reverse Proxy

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

```bash
pnpm dev
pnpm build
pnpm lint
pnpm test
pnpm pack:check
pnpm publish:check
pnpm format
pnpm format:write
```

현재 테스트는 아래를 검증합니다.

- config schema validation
- bearer token authentication
- health and metrics routes
- adapter routing
- Postgres and ClickHouse read-only SQL guards
- Redis allowlist command guards
- query audit logging
- graceful shutdown

## Project Layout

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

## Extending

새 backend를 추가하려면:

1. [`AdapterInstance`](./src/types.ts) 계약을 구현합니다.
2. [`src/adapters`](./src/adapters)에 adapter를 추가합니다.
3. [`src/adapters/index.ts`](./src/adapters/index.ts)에 등록합니다.
4. 로컬 `config.yml`의 `adapters:` 아래에 설정을 추가합니다.

현재는 외부 플러그인 로딩이 아니라 저장소 내부 adapter 추가 방식을 기준으로 합니다.

## Contributing

기여는 언제든 환영합니다.

- PR 전 [`CONTRIBUTING.md`](./CONTRIBUTING.md)를 읽어주세요.
- 변경 범위는 작고 명확하게 유지해 주세요.
- 동작이나 설정이 바뀌면 문서도 함께 갱신해 주세요.

## License

MIT. 자세한 내용은 [`LICENSE`](./LICENSE)를 참고하세요.
