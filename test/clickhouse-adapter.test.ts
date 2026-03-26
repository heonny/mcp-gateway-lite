import { beforeEach, describe, expect, it, vi } from "vitest";

const jsonMock = vi.fn();
const queryMock = vi.fn();
const closeMock = vi.fn();

vi.mock("@clickhouse/client", () => ({
  createClient: vi.fn(() => ({
    query: queryMock,
    close: closeMock,
  })),
}));

import { createClickHouseAdapter } from "../src/adapters/clickhouseAdapter.js";

function captureTool() {
  const adapter = createClickHouseAdapter("clickhouse", {
    type: "clickhouse",
    enabled: true,
    path: "clickhouse",
    host: "localhost",
    port: 8123,
    database: "default",
    userEnv: "CLICKHOUSE_USER",
    passwordEnv: "CLICKHOUSE_PASSWORD",
    protocol: "http",
  });
  const handlers = new Map<string, (args: { sql: string }) => Promise<unknown>>();
  adapter.registerTools(
    {
      tool(name: string, _description: string, _schema: unknown, handler: (args: { sql: string }) => Promise<unknown>) {
        handlers.set(name, handler);
      },
    } as never,
    {
      adapterName: "clickhouse",
      logger: { info: vi.fn(), error: vi.fn() } as never,
      queryLogLevel: "redacted",
      recordToolCall: vi.fn(),
    },
  );
  return { adapter, handler: handlers.get("query")! };
}

describe("createClickHouseAdapter", () => {
  beforeEach(() => {
    process.env.CLICKHOUSE_USER = "user";
    process.env.CLICKHOUSE_PASSWORD = "pass";
    jsonMock.mockReset();
    queryMock.mockReset();
    closeMock.mockReset();
  });

  it("blocks unsafe sql", async () => {
    const { handler } = captureTool();
    const result = await handler({ sql: "DROP TABLE foo" });
    expect(result).toMatchObject({ isError: true });
  });

  it("executes read-only queries", async () => {
    queryMock.mockResolvedValue({ json: jsonMock });
    jsonMock.mockResolvedValue([{ answer: 42 }]);
    const { handler } = captureTool();
    const result = await handler({ sql: "SELECT 42" });
    expect(result).toMatchObject({
      content: [{ type: "text", text: JSON.stringify([{ answer: 42 }], null, 2) }],
    });
  });

  it("reports health and closes client", async () => {
    queryMock.mockResolvedValue({ json: jsonMock });
    jsonMock.mockResolvedValue([{ database: "default" }]);
    const { adapter } = captureTool();
    await expect(adapter.healthCheck()).resolves.toMatchObject({ ok: true });
    await adapter.close();
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it("returns query errors and unhealthy health checks", async () => {
    queryMock.mockRejectedValueOnce(new Error("boom")).mockRejectedValueOnce(new Error("boom"));
    const { adapter, handler } = captureTool();
    await expect(handler({ sql: "SELECT 1" })).resolves.toMatchObject({ isError: true });
    await expect(adapter.healthCheck()).resolves.toMatchObject({ ok: false });
  });
});
