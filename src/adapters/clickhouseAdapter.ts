import { createClient } from "@clickhouse/client";
import { z } from "zod";

import type { AdapterInstance, ClickHouseAdapterConfig, ToolExecutionContext } from "../types.js";
import { validateReadOnlySql } from "./sqlGuards.js";

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

export function createClickHouseAdapter(name: string, config: ClickHouseAdapterConfig): AdapterInstance {
  const clientOptions: {
    url: string;
    database: string;
    request_timeout: number;
    username?: string;
    password?: string;
  } = {
    url: `${config.protocol ?? "http"}://${config.host}:${config.port}`,
    database: config.database,
    request_timeout: 5000,
  };
  const username = process.env[config.userEnv];
  const password = process.env[config.passwordEnv];
  if (username) {
    clientOptions.username = username;
  }
  if (password) {
    clientOptions.password = password;
  }
  const client = createClient(clientOptions);

  return {
    name,
    type: config.type,
    path: config.path,
    registerTools(server, context) {
      server.tool(
        "query",
        "Execute a read-only SQL query against ClickHouse.",
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
            const resultSet = await client.query({ query: sql, format: "JSONEachRow" });
            const rows = await resultSet.json<Record<string, unknown>>();
            recordAudit(context, sql, "ok", Date.now() - startedAt, rows.length);
            return {
              content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
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
        const resultSet = await client.query({
          query: "SELECT currentDatabase() AS database, currentUser() AS user",
          format: "JSONEachRow",
        });
        const rows = await resultSet.json<Record<string, unknown>>();
        return {
          ok: true,
          latencyMs: Date.now() - startedAt,
          details: rows[0] ?? { database: config.database },
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
      await client.close();
    },
  };
}
