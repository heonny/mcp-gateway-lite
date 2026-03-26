import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { AdapterHealthStatus, AdapterInstance, ToolExecutionContext } from "../../src/types.js";

export function createFakeAdapter(options?: {
  name?: string;
  path?: string;
  health?: AdapterHealthStatus;
  onClose?: () => Promise<void> | void;
}): AdapterInstance {
  const name = options?.name ?? "fake";
  const path = options?.path ?? "fake";
  const health = options?.health ?? { ok: true, latencyMs: 1, details: { status: "up" } };

  return {
    name,
    type: "postgres",
    path,
    registerTools(server: McpServer, context: ToolExecutionContext) {
      server.tool("query", "fake", {}, async () => {
        await Promise.resolve();
        context.recordToolCall({
          tool: "query",
          text: "select 1",
          status: "ok",
          durationMs: 5,
          resultCount: 1,
        });
        return {
          content: [{ type: "text", text: JSON.stringify([{ ok: true }]) }],
        };
      });
    },
    async healthCheck() {
      await Promise.resolve();
      return health;
    },
    async close() {
      await options?.onClose?.();
    },
  };
}
