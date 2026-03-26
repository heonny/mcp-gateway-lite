import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { loadBearerToken, loadConfig } from "../src/config/loadConfig.js";

describe("loadConfig", () => {
  beforeEach(() => {
    process.env.MCP_BEARER_TOKEN = "token-1";
    process.env.POSTGRES_USER = "user";
    process.env.POSTGRES_PASSWORD = "pass";
    process.env.CLICKHOUSE_USER = "user";
    process.env.CLICKHOUSE_PASSWORD = "pass";
  });

  it("loads valid config and validates env secrets", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "mcp-gateway-lite-"));
    const filePath = path.join(tempDir, "config.yml");
    await writeFile(
      filePath,
      `
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
    host: localhost
    port: 5432
    database: app
    userEnv: POSTGRES_USER
    passwordEnv: POSTGRES_PASSWORD
`,
    );

    const config = await loadConfig(filePath);
    expect(config.server.endpoint).toBe("mcp");
    expect(config.adapters.postgres?.type).toBe("postgres");
  });

  it("rejects duplicate adapter paths", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "mcp-gateway-lite-"));
    const filePath = path.join(tempDir, "config.yml");
    await writeFile(
      filePath,
      `
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
  first:
    type: postgres
    enabled: true
    path: shared
    host: localhost
    port: 5432
    database: app
    userEnv: POSTGRES_USER
    passwordEnv: POSTGRES_PASSWORD
  second:
    type: clickhouse
    enabled: true
    path: shared
    host: localhost
    port: 8123
    database: default
    userEnv: CLICKHOUSE_USER
    passwordEnv: CLICKHOUSE_PASSWORD
`,
    );

    await expect(loadConfig(filePath)).rejects.toThrow("adapter path 'shared'");
  });

  it("rejects missing auth env when auth is enabled", async () => {
    delete process.env.MCP_BEARER_TOKEN;
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "mcp-gateway-lite-"));
    const filePath = path.join(tempDir, "config.yml");
    await writeFile(
      filePath,
      `
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
adapters: {}
`,
    );

    await expect(loadConfig(filePath)).rejects.toThrow("MCP_BEARER_TOKEN");
  });

  it("allows auth-disabled configs without bearer token and loads null token", async () => {
    delete process.env.MCP_BEARER_TOKEN;
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "mcp-gateway-lite-"));
    const filePath = path.join(tempDir, "config.yml");
    await writeFile(
      filePath,
      `
server:
  host: 0.0.0.0
  port: 8610
  endpoint: mcp
  requestBodyLimit: 1mb
  requestTimeoutMs: 10000
auth:
  enabled: false
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
adapters: {}
`,
    );

    const config = await loadConfig(filePath);
    expect(loadBearerToken(config)).toBeNull();
  });

  it("rejects empty bearer token", async () => {
    process.env.MCP_BEARER_TOKEN = "   ";
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "mcp-gateway-lite-"));
    const filePath = path.join(tempDir, "config.yml");
    await writeFile(
      filePath,
      `
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
adapters: {}
`,
    );

    await expect(loadConfig(filePath)).rejects.toThrow("non-empty bearer token");
  });

  it("interpolates adapter host, port, and database values from environment", async () => {
    process.env.MCP_BEARER_TOKEN = "token-1";
    process.env.POSTGRES_HOST = "192.168.10.100";
    process.env.POSTGRES_PORT = "5432";
    process.env.POSTGRES_DATABASE = "analytics";
    process.env.REDIS_HOST = "192.168.10.101";
    process.env.REDIS_PORT = "6380";
    process.env.REDIS_DB = "2";
    process.env.REDIS_PASSWORD = "pass";
    process.env.CLICKHOUSE_HOST = "192.168.10.102";
    process.env.CLICKHOUSE_PORT = "8124";
    process.env.CLICKHOUSE_DATABASE = "warehouse";

    const tempDir = await mkdtemp(path.join(os.tmpdir(), "mcp-gateway-lite-"));
    const filePath = path.join(tempDir, "config.yml");
    await writeFile(
      filePath,
      `
server:
  host: 0.0.0.0
  port: 8610
  endpoint: mcp
  requestBodyLimit: 1mb
  requestTimeoutMs: 10000
auth:
  enabled: true
  tokenEnv: \${MCP_BEARER_TOKEN_ENV:-MCP_BEARER_TOKEN}
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
    host: \${POSTGRES_HOST}
    port: \${POSTGRES_PORT}
    database: \${POSTGRES_DATABASE}
    userEnv: POSTGRES_USER
    passwordEnv: POSTGRES_PASSWORD
  redis:
    type: redis
    enabled: true
    path: redis
    host: \${REDIS_HOST}
    port: \${REDIS_PORT}
    passwordEnv: REDIS_PASSWORD
    db: \${REDIS_DB}
  clickhouse:
    type: clickhouse
    enabled: true
    path: clickhouse
    host: \${CLICKHOUSE_HOST}
    port: \${CLICKHOUSE_PORT}
    database: \${CLICKHOUSE_DATABASE}
    userEnv: CLICKHOUSE_USER
    passwordEnv: CLICKHOUSE_PASSWORD
    protocol: http
`,
    );

    const config = await loadConfig(filePath);
    expect(config.adapters.postgres).toMatchObject({
      host: "192.168.10.100",
      port: 5432,
      database: "analytics",
    });
    expect(config.adapters.redis).toMatchObject({
      host: "192.168.10.101",
      port: 6380,
      db: 2,
    });
    expect(config.adapters.clickhouse).toMatchObject({
      host: "192.168.10.102",
      port: 8124,
      database: "warehouse",
    });
  });
});
