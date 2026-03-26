import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FastifyBaseLogger } from "fastify";

export type QueryLogLevel = "redacted" | "minimal" | "full" | "disable";
export type AdapterType = "postgres" | "redis" | "clickhouse";

export interface ServerConfig {
  host: string;
  port: number;
  endpoint: string;
  requestBodyLimit: string;
  requestTimeoutMs: number;
}

export interface AuthConfig {
  enabled: boolean;
  tokenEnv: string;
  protectMetrics: boolean;
  protectHealth: boolean;
}

export interface SecurityConfig {
  queryLogLevel: QueryLogLevel;
  rateLimit: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
  };
}

export interface ObservabilityConfig {
  metricsEnabled: boolean;
  healthPath: string;
  metricsPath: string;
}

interface BaseAdapterConfig {
  type: AdapterType;
  enabled: boolean;
  path: string;
}

export interface PostgresAdapterConfig extends BaseAdapterConfig {
  type: "postgres";
  host: string;
  port: number;
  database: string;
  userEnv: string;
  passwordEnv: string;
  ssl?: boolean;
}

export interface RedisAdapterConfig extends BaseAdapterConfig {
  type: "redis";
  host: string;
  port: number;
  passwordEnv?: string;
  db: number;
}

export interface ClickHouseAdapterConfig extends BaseAdapterConfig {
  type: "clickhouse";
  host: string;
  port: number;
  database: string;
  userEnv: string;
  passwordEnv: string;
  protocol?: "http" | "https";
}

export type AdapterConfig =
  | PostgresAdapterConfig
  | RedisAdapterConfig
  | ClickHouseAdapterConfig;

export interface AppConfig {
  server: ServerConfig;
  auth: AuthConfig;
  security: SecurityConfig;
  observability: ObservabilityConfig;
  adapters: Record<string, AdapterConfig>;
}

export interface AdapterHealthStatus {
  ok: boolean;
  latencyMs: number;
  details?: Record<string, unknown>;
  error?: string;
}

export interface RequestAudit {
  tool: string;
  text?: string;
  status: "ok" | "error" | "blocked";
  durationMs: number;
  resultCount?: number;
  errorMessage?: string;
}

export interface ToolExecutionContext {
  logger: FastifyBaseLogger;
  adapterName: string;
  queryLogLevel: QueryLogLevel;
  recordToolCall: (audit: RequestAudit) => void;
}

export interface AdapterInstance {
  name: string;
  type: AdapterType;
  path: string;
  registerTools: (server: McpServer, context: ToolExecutionContext) => void;
  healthCheck: () => Promise<AdapterHealthStatus>;
  close: () => Promise<void>;
}
