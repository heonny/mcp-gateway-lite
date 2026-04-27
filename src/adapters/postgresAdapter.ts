import { Pool } from "pg";
import { z } from "zod";

import type { AdapterInstance, PostgresAdapterConfig, ToolExecutionContext } from "../types.js";
import { validateReadOnlySql } from "./sqlGuards.js";

function buildConnectionString(config: PostgresAdapterConfig): string {
  const url = new URL("postgresql://placeholder");
  url.hostname = config.host;
  url.port = String(config.port);
  url.pathname = `/${config.database}`;
  url.username = process.env[config.userEnv] ?? "";
  url.password = process.env[config.passwordEnv] ?? "";
  return url.toString();
}

function recordAudit(
  context: ToolExecutionContext,
  sql: string,
  status: "ok" | "error" | "blocked",
  durationMs: number,
  resultCount?: number,
  errorMessage?: string,
): void {
  const audit = {
    tool: "query",
    text: sql,
    status,
    durationMs,
  } as const;
  context.recordToolCall({
    ...audit,
    ...(typeof resultCount === "number" ? { resultCount } : {}),
    ...(errorMessage ? { errorMessage } : {}),
  });
}

export function createPostgresAdapter(name: string, config: PostgresAdapterConfig): AdapterInstance {
  const pool = new Pool({
    connectionString: buildConnectionString(config),
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });
  pool.on("error", (err: Error) => {
    process.stderr.write(`[postgres:${name}] ${err.message}\n`);
  });

  return {
    name,
    type: config.type,
    path: config.path,
    registerTools(server, context) {
      server.tool(
        "query",
        "Execute a read-only SQL query against PostgreSQL.",
        { sql: z.string().min(1) },
        async ({ sql }) => {
          const startedAt = Date.now();
          try {
            validateReadOnlySql(sql);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            recordAudit(context, sql, "blocked", Date.now() - startedAt, undefined, message);
            return {
              content: [{ type: "text", text: message }],
              isError: true,
            };
          }

          try {
            const result = await pool.query(sql);
            recordAudit(context, sql, "ok", Date.now() - startedAt, result.rowCount ?? result.rows.length);
            return {
              content: [{ type: "text", text: JSON.stringify(result.rows, null, 2) }],
            };
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            recordAudit(context, sql, "error", Date.now() - startedAt, undefined, message);
            return {
              content: [{ type: "text", text: `Query failed: ${message}` }],
              isError: true,
            };
          }
        },
      );
    },
    async healthCheck() {
      const startedAt = Date.now();
      try {
        const result = await pool.query(
          "select current_database() as database, current_user as user_name, inet_server_addr() as host, inet_server_port() as port",
        );
        return {
          ok: true,
          latencyMs: Date.now() - startedAt,
          details: result.rows[0] as Record<string, unknown>,
        };
      } catch (error) {
        return {
          ok: false,
          latencyMs: Date.now() - startedAt,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
    async close() {
      await pool.end();
    },
  };
}
