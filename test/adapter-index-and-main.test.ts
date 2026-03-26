import { describe, expect, it } from "vitest";

import { createAdapters } from "../src/adapters/index.js";
import { parseConfigPath } from "../src/main.js";
import type { AppConfig } from "../src/types.js";

describe("createAdapters", () => {
  it("creates enabled adapters only", () => {
    process.env.POSTGRES_USER = "user";
    process.env.POSTGRES_PASSWORD = "pass";
    process.env.CLICKHOUSE_USER = "user";
    process.env.CLICKHOUSE_PASSWORD = "pass";

    const config: AppConfig = {
      server: {
        host: "0.0.0.0",
        port: 8610,
        endpoint: "mcp",
        requestBodyLimit: "1mb",
        requestTimeoutMs: 10000,
      },
      auth: {
        enabled: false,
        header: "X-API-Key",
        keysEnv: "MCP_API_KEYS_JSON",
        protectMetrics: false,
        protectHealth: false,
      },
      security: {
        queryLogLevel: "redacted",
        rateLimit: {
          enabled: false,
          windowMs: 60000,
          maxRequests: 10,
        },
      },
      observability: {
        metricsEnabled: true,
        healthPath: "/health",
        metricsPath: "/metrics",
      },
      adapters: {
        postgres: {
          type: "postgres",
          enabled: true,
          path: "postgres",
          host: "localhost",
          port: 5432,
          database: "app",
          userEnv: "POSTGRES_USER",
          passwordEnv: "POSTGRES_PASSWORD",
        },
        clickhouse: {
          type: "clickhouse",
          enabled: true,
          path: "clickhouse",
          host: "localhost",
          port: 8123,
          database: "default",
          userEnv: "CLICKHOUSE_USER",
          passwordEnv: "CLICKHOUSE_PASSWORD",
          protocol: "http",
        },
        redis: {
          type: "redis",
          enabled: false,
          path: "redis",
          host: "localhost",
          port: 6379,
          db: 0,
        },
      },
    };

    const adapters = createAdapters(config);
    expect(adapters).toHaveLength(2);
    expect(adapters.map((adapter) => adapter.name)).toEqual(["postgres", "clickhouse"]);
  });
});

describe("parseConfigPath", () => {
  it("uses explicit --config when provided", () => {
    expect(parseConfigPath(["--config", "/tmp/config.yml"])).toBe("/tmp/config.yml");
  });

  it("falls back to project config.yml", () => {
    const result = parseConfigPath([]);
    expect(result.endsWith("/config.yml")).toBe(true);
  });
});
