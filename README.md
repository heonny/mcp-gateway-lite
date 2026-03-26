# mcp-gateway-lite

[![Coverage](https://img.shields.io/badge/coverage-92.33%25-brightgreen)](https://github.com/heonny/mcp-gateway-lite)
[![Tests](https://img.shields.io/badge/tests-43%20passed-brightgreen)](https://github.com/heonny/mcp-gateway-lite)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-yellow.svg)](https://github.com/heonny/mcp-gateway-lite/blob/main/LICENSE)

`mcp-gateway-lite`는 여러 데이터 저장소를 MCP 서버 형태로 한 군데에서 노출해주는 경량 gateway입니다. 쉽게 말하면, Postgres, Redis, ClickHouse 같은 서로 다른 백엔드를 각각 따로 MCP 서버로 띄우지 않고, 하나의 HTTP 서버 아래에서 정리해서 제공하는 도구입니다.

예시:

- `POST /mcp/postgres`
- `POST /mcp/redis`
- `POST /mcp/clickhouse`

## 이게 무엇인가

이 프로젝트는 "데이터베이스나 캐시를 AI 도구나 MCP 클라이언트가 안전하게 읽을 수 있게 연결하는 중간 게이트웨이" 입니다.

예를 들어:

- 운영 중인 Postgres를 AI가 조회하게 하고 싶을 때
- Redis 상태를 MCP client로 읽고 싶을 때
- ClickHouse 분석 데이터를 MCP로 열어두고 싶을 때

보통은 backend마다 서버를 따로 만들거나, 실행 포트를 여러 개 관리하거나, 인증과 로깅을 각각 붙여야 합니다. `mcp-gateway-lite`는 그 일을 한 번에 정리해줍니다.

## 어디서 사용하는가

이 프로젝트는 주로 아래 같은 환경에서 사용합니다.

- 사내 MCP gateway
- 로컬 개발용 MCP backend 집합
- AI agent가 여러 데이터 소스를 조회해야 하는 운영 환경
- reverse proxy 뒤에 두고 `/mcp/postgres`, `/mcp/redis` 식으로 정리하고 싶은 경우

즉, "MCP는 쓰고 싶은데 backend가 여러 개라 운영이 복잡해지는 상황" 에 잘 맞습니다.

## 언제 사용하는가

아래 상황이면 이 프로젝트를 쓰는 편이 좋습니다.

- Postgres, Redis, ClickHouse를 각각 별도 MCP 서버로 관리하기 번거로울 때
- 포트를 여러 개 열지 않고 하나의 엔드포인트 아래에서 운영하고 싶을 때
- 인증, 로깅, health check, metrics를 공통으로 붙이고 싶을 때
- 최소한의 read-only 안전장치를 기본으로 두고 싶을 때
- Docker로 쉽게 배포하고 싶을 때

반대로, backend 하나만 아주 단순하게 열면 되는 경우라면 전용 단일 MCP 서버가 더 단순할 수도 있습니다.

## 무엇을 위한 것인가

이 프로젝트의 목적은 다음입니다.

- 여러 backend를 MCP 관점에서 일관된 방식으로 노출하기
- 운영 복잡도를 줄이기
- 보안 기본값을 놓치지 않게 만들기
- 장애 확인과 메트릭 수집을 쉽게 만들기
- 오픈소스처럼 재사용 가능한 구조로 정리하기

즉, "AI가 데이터를 읽을 수 있게 해주되, 운영자가 관리 가능한 형태로 만들기 위한 gateway" 입니다.

## 어떤 문제를 해결하는가

예를 들어 보겠습니다.

기존 방식:

- Postgres MCP 서버 하나
- Redis MCP 서버 하나
- ClickHouse MCP 서버 하나
- 포트 3개 관리
- 인증 3벌
- 로깅 3벌
- health / metrics 3벌

이 프로젝트 사용 후:

- gateway 1개
- config.yml 1벌
- 공통 인증 1벌
- 공통 health / metrics 1벌
- backend별 경로만 분리

운영하는 입장에서 훨씬 단순해집니다.

## 왜 이 프로젝트인가

- 포트 하나만 열고 여러 MCP backend를 운영할 수 있습니다.
- adapter별 read-only 정책을 강제할 수 있습니다.
- API key 인증, 구조화 로그, health, metrics를 기본 제공해 운영성이 좋습니다.
- `config.yml` 1벌로 endpoint, 보안, 관측, backend 연결 구성을 관리할 수 있습니다.

## 주요 기능

- Fastify 기반 단일 gateway
- Streamable HTTP MCP routing
- Built-in API key 인증
- `/health` JSON 상태 확인
- `/metrics` Prometheus metrics
- 쿼리/명령 감사 로그 레벨 제어
- Postgres / ClickHouse read-only SQL 제한
- Redis allowlist 기반 read-only command 제한
- TypeScript strict mode
- ESLint / Prettier / Vitest / Coverage
- Dockerfile / docker-compose 예시 포함

## 아키텍처 개요

요청 흐름은 아래와 같습니다.

1. Fastify 서버가 공통 middleware를 적용합니다.
2. API key 보호 대상 경로인지 확인합니다.
3. `/${server.endpoint}/${adapter.path}` 규칙으로 adapter를 선택합니다.
4. adapter가 MCP tool을 등록하고 backend에 연결합니다.
5. 결과를 반환하면서 로그와 metrics를 기록합니다.

구성 예:

```text
client
  -> /mcp/postgres
  -> /mcp/redis
  -> /mcp/clickhouse

Fastify gateway
  -> auth
  -> rate limit
  -> logging
  -> metrics
  -> adapter dispatch

adapter
  -> postgres | redis | clickhouse
```

## 빠른 시작

### 1. 요구 사항

- Node.js `22+`
- `pnpm`
- 접근 가능한 Postgres / Redis / ClickHouse

### 2. 설치

```bash
pnpm install
```

### 3. 설정 파일 준비

기본 설정 파일은 [config.example.yml](/Users/chang/Documents/workspace/mcp/mcp-gateway-lite/config.example.yml) 입니다.

```bash
cp config.example.yml config.yml
```

### 4. 시크릿 환경변수 설정

```bash
export MCP_API_KEYS_JSON='["change-this-api-key"]'
export POSTGRES_USER='your-postgres-user'
export POSTGRES_PASSWORD='change-this-postgres-password'
export REDIS_PASSWORD='change-this-redis-password'
export CLICKHOUSE_USER='your-clickhouse-user'
export CLICKHOUSE_PASSWORD='change-this-clickhouse-password'
```

`MCP_API_KEYS_JSON` 은 문자열 배열 JSON 이어야 합니다.

예:

```bash
export MCP_API_KEYS_JSON='["team-key-a","team-key-b"]'
```

### 5. 개발 서버 실행

```bash
pnpm dev
```

기본 주소:

- `http://0.0.0.0:8610/health`
- `http://0.0.0.0:8610/metrics`
- `http://0.0.0.0:8610/mcp/postgres`
- `http://0.0.0.0:8610/mcp/redis`
- `http://0.0.0.0:8610/mcp/clickhouse`

## 설정

기본적으로 [config.yml](/Users/chang/Documents/workspace/mcp/mcp-gateway-lite/config.yml) 을 읽고, 필요하면 `--config` 로 다른 경로를 지정할 수 있습니다.

```bash
node dist/main.js --config /app/config.yml
```

### 설정 예시

```yaml
server:
  host: 0.0.0.0
  port: 8610
  endpoint: mcp
  requestBodyLimit: 1mb
  requestTimeoutMs: 10000

auth:
  enabled: true
  header: X-API-Key
  keysEnv: MCP_API_KEYS_JSON
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

  redis:
    type: redis
    enabled: true
    path: redis
    host: redis.example.internal
    port: 6379
    passwordEnv: REDIS_PASSWORD
    db: 0

  clickhouse:
    type: clickhouse
    enabled: true
    path: clickhouse
    host: clickhouse.example.internal
    port: 8123
    database: default
    userEnv: CLICKHOUSE_USER
    passwordEnv: CLICKHOUSE_PASSWORD
    protocol: http
```

### 핵심 규칙

- 최상위 endpoint는 `server.endpoint` 로 지정합니다.
- 각 adapter는 절대 경로가 아니라 상대 `path` 만 가집니다.
- 실제 endpoint는 `/${server.endpoint}/${adapter.path}` 형태로 조합됩니다.
- 비밀번호나 API key는 YAML에 직접 넣지 않고 `*Env` 로 참조합니다.
- enabled adapter 간 `path` 중복은 허용되지 않습니다.

## 인증

기본 인증 방식은 API key 입니다.

지원 헤더:

- `X-API-Key: <key>`
- `Authorization: Bearer <key>`

관련 설정:

- `auth.enabled`
- `auth.header`
- `auth.keysEnv`
- `auth.protectMetrics`
- `auth.protectHealth`

기본 정책:

- `/mcp/*` 는 보호
- `/metrics` 는 보호
- `/health` 는 비보호

## 엔드포인트

### `POST /{endpoint}/{adapter}`

MCP Streamable HTTP endpoint 입니다.

예:

- `POST /mcp/postgres`
- `POST /mcp/redis`
- `POST /mcp/clickhouse`

### `GET /health`

서비스 전체 상태와 adapter별 backend 연결 상태를 JSON으로 반환합니다.

예시 응답:

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

## Adapter 동작

### Postgres

- tool: `query`
- 허용: read-only SQL
- 차단: write/admin 성격 SQL, multi-statement

### ClickHouse

- tool: `query`
- 허용: read-only SQL
- 차단: write/admin 성격 SQL, multi-statement

### Redis

- tool: `command`
- 허용: allowlist 기반 read-only command
- 차단: `SET`, `DEL`, `FLUSH*`, `CONFIG`, `SCRIPT` 등 write/admin 계열

## 로깅과 가시성

구조화 로그는 `pino` 기반입니다.

`security.queryLogLevel`:

- `redacted`: 기본값. 원문 대신 hash, 길이, 상태, duration 중심 기록
- `minimal`: 최소 메타데이터만 기록
- `full`: 원문 포함
- `disable`: 쿼리 감사 로그 비활성화

권장값:

- 개발: `redacted`
- 운영: `redacted` 또는 `minimal`
- 제한된 디버깅 환경: `full`

## 보안 기본값

- YAML에 시크릿 직접 저장 금지
- API key 인증 기본 제공
- read-only backend 접근만 허용
- rate limit 지원
- request body limit 설정 가능
- graceful shutdown 처리

주의:

- `full` query log는 민감정보 노출 위험이 있으므로 기본 운영값으로 권장하지 않습니다.
- Redis `KEYS` 같은 명령도 데이터 규모에 따라 운영 부담이 클 수 있으므로 필요 시 allowlist를 줄이는 것이 좋습니다.

## Docker

### 이미지 빌드

```bash
docker build -t mcp-gateway-lite .
```

### 컨테이너 실행

```bash
docker run --rm \
  -p 8610:8610 \
  -e MCP_API_KEYS_JSON='["change-this-api-key"]' \
  -e POSTGRES_USER=your-postgres-user \
  -e POSTGRES_PASSWORD=change-this-postgres-password \
  -e REDIS_PASSWORD=change-this-redis-password \
  -e CLICKHOUSE_USER=your-clickhouse-user \
  -e CLICKHOUSE_PASSWORD=change-this-clickhouse-password \
  -v $(pwd)/config.yml:/app/config.yml:ro \
  mcp-gateway-lite
```

### docker-compose

[docker-compose.yml](/Users/chang/Documents/workspace/mcp/mcp-gateway-lite/docker-compose.yml) 예시를 사용할 수 있습니다.

```bash
docker compose up --build
```

## Reverse Proxy 예시

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

## 개발 명령

```bash
pnpm dev
pnpm build
pnpm lint
pnpm test
pnpm format
pnpm format:write
```

## 테스트

현재 프로젝트는 다음을 검증합니다.

- 설정 파일 schema validation
- API key 인증
- health / metrics 동작
- adapter routing
- Postgres / ClickHouse read-only SQL 제한
- Redis allowlist 제한
- query audit logging
- graceful shutdown

Coverage 기준:

- lines `80%+`
- branches `80%+`
- functions `80%+`

## 프로젝트 구조

```text
mcp-gateway-lite/
  src/
    adapters/
    auth/
    config/
    logging/
    metrics/
    server/
    utils/
  test/
  config.yml
  config.example.yml
  Dockerfile
  docker-compose.yml
```

## Adapter 추가 방법

새 backend를 추가하려면:

1. [src/types.ts](/Users/chang/Documents/workspace/mcp/mcp-gateway-lite/src/types.ts) 의 `AdapterInstance` 계약을 따릅니다.
2. [src/adapters](/Users/chang/Documents/workspace/mcp/mcp-gateway-lite/src/adapters) 아래에 새 adapter 구현을 추가합니다.
3. [src/adapters/index.ts](/Users/chang/Documents/workspace/mcp/mcp-gateway-lite/src/adapters/index.ts) 에 등록합니다.
4. `config.yml` 의 `adapters:` 아래에 인스턴스 설정을 추가합니다.

v1에서는 외부 플러그인 로딩이 아니라 in-repo adapter 추가 방식을 기준으로 합니다.
