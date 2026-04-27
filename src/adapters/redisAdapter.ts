import { createClient } from "redis";
import { z } from "zod";

import type { AdapterInstance, RedisAdapterConfig, ToolExecutionContext } from "../types.js";
import { validateRedisCommand } from "./redisGuards.js";

function normalizeRedisResult(result: unknown): string {
  return JSON.stringify(result, null, 2);
}

function recordAudit(
  context: ToolExecutionContext,
  command: string,
  status: "ok" | "error" | "blocked",
  durationMs: number,
  resultCount?: number,
  errorMessage?: string,
): void {
  const audit = {
    tool: "command",
    text: command,
    status,
    durationMs,
  } as const;
  context.recordToolCall({
    ...audit,
    ...(typeof resultCount === "number" ? { resultCount } : {}),
    ...(errorMessage ? { errorMessage } : {}),
  });
}

export function createRedisAdapter(name: string, config: RedisAdapterConfig): AdapterInstance {
  const clientOptions: {
    url: string;
    password?: string;
    socket: {
      connectTimeout: number;
      reconnectStrategy: (retries: number) => number | false;
    };
  } = {
    url: `redis://${config.host}:${config.port}/${config.db}`,
    socket: {
      connectTimeout: 5000,
      reconnectStrategy: (retries) => Math.min(retries * 200, 5000),
    },
  };
  if (config.passwordEnv) {
    const password = process.env[config.passwordEnv];
    if (password) {
      clientOptions.password = password;
    }
  }
  const client = createClient(clientOptions);
  client.on("error", (err: Error) => {
    process.stderr.write(`[redis:${name}] ${err.message}\n`);
  });
  const connectPromise = client.connect().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[redis:${name}] initial connect failed: ${message}\n`);
    return undefined;
  });

  return {
    name,
    type: config.type,
    path: config.path,
    registerTools(server, context) {
      server.tool(
        "command",
        "Execute an allowlisted read-only Redis command.",
        { command: z.string().min(1) },
        async ({ command }) => {
          const startedAt = Date.now();
          let tokens: string[];

          try {
            tokens = validateRedisCommand(command);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            recordAudit(context, command, "blocked", Date.now() - startedAt, undefined, message);
            return {
              content: [{ type: "text", text: message }],
              isError: true,
            };
          }

          try {
            await connectPromise;
            const result = await client.sendCommand(tokens);
            const resultCount = Array.isArray(result) ? result.length : result == null ? 0 : 1;
            recordAudit(context, command, "ok", Date.now() - startedAt, resultCount);
            return {
              content: [{ type: "text", text: normalizeRedisResult(result) }],
            };
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            recordAudit(context, command, "error", Date.now() - startedAt, undefined, message);
            return {
              content: [{ type: "text", text: `Command failed: ${message}` }],
              isError: true,
            };
          }
        },
      );
    },
    async healthCheck() {
      const startedAt = Date.now();
      try {
        await connectPromise;
        const [pong, dbSize] = await Promise.all([client.ping(), client.dbSize()]);
        return {
          ok: true,
          latencyMs: Date.now() - startedAt,
          details: {
            ping: pong,
            dbSize,
            db: config.db,
          },
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
      if (client.isOpen) {
        await client.quit();
      }
    },
  };
}
