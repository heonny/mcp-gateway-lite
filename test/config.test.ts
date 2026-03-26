import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { loadApiKeys, loadConfig } from "../src/config/loadConfig.js";

describe("loadConfig", () => {
  beforeEach(() => {
    process.env.MCP_API_KEYS_JSON = '["key-1"]';
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
    delete process.env.MCP_API_KEYS_JSON;
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
adapters: {}
`,
    );

    await expect(loadConfig(filePath)).rejects.toThrow("MCP_API_KEYS_JSON");
  });

  it("allows auth-disabled configs without api keys and loads key sets", async () => {
    delete process.env.MCP_API_KEYS_JSON;
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
adapters: {}
`,
    );

    const config = await loadConfig(filePath);
    expect(loadApiKeys(config).size).toBe(0);
  });

  it("rejects invalid api key json", async () => {
    process.env.MCP_API_KEYS_JSON = '{"bad":true}';
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
adapters: {}
`,
    );

    await expect(loadConfig(filePath)).rejects.toThrow("JSON array");
  });
});
