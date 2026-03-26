import type { AppConfig } from "../../src/types.js";

export function makeConfig(): AppConfig {
  return {
    server: {
      host: "127.0.0.1",
      port: 8610,
      endpoint: "mcp",
      requestBodyLimit: "1mb",
      requestTimeoutMs: 10000,
    },
    auth: {
      enabled: true,
      header: "X-API-Key",
      keysEnv: "MCP_API_KEYS_JSON",
      protectMetrics: true,
      protectHealth: false,
    },
    security: {
      queryLogLevel: "redacted",
      rateLimit: {
        enabled: false,
        windowMs: 60000,
        maxRequests: 120,
      },
    },
    observability: {
      metricsEnabled: true,
      healthPath: "/health",
      metricsPath: "/metrics",
    },
    adapters: {
      fake: {
        type: "postgres",
        enabled: true,
        path: "fake",
        host: "localhost",
        port: 5432,
        database: "db",
        userEnv: "POSTGRES_USER",
        passwordEnv: "POSTGRES_PASSWORD",
      },
    },
  };
}
