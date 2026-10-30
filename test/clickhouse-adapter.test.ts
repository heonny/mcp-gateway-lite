import { beforeEach, describe, expect, it, vi } from "vitest";

const jsonMock = vi.fn();
const queryMock = vi.fn();
const closeMock = vi.fn();

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@clickhouse/client", () => ({
  createClient: createClientMock.mockImplementation(() => ({
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

  it("stringifies non-Error rejections", async () => {
    queryMock.mockRejectedValue("timeout");
    const { adapter, handler } = captureTool();
    await expect(handler({ sql: "SELECT 1" })).resolves.toMatchObject({
      content: [{ type: "text", text: "Query failed: timeout" }],
    });
    await expect(adapter.healthCheck()).resolves.toMatchObject({ error: "timeout" });
  });

  it("falls back to the configured database when the health query returns no rows", async () => {
    queryMock.mockResolvedValue({ json: jsonMock });
    jsonMock.mockResolvedValue([]);
    const { adapter } = captureTool();
    await expect(adapter.healthCheck()).resolves.toMatchObject({
      ok: true,
      details: { database: "default" },
    });
  });

  it("defaults to http and omits credentials whose env vars are unset", () => {
    delete process.env.CLICKHOUSE_USER;
    delete process.env.CLICKHOUSE_PASSWORD;
    createClickHouseAdapter("clickhouse", {
      type: "clickhouse",
      enabled: true,
      path: "clickhouse",
      host: "localhost",
      port: 8123,
      database: "default",
      userEnv: "CLICKHOUSE_USER",
      passwordEnv: "CLICKHOUSE_PASSWORD",
    });
    expect(createClientMock.mock.lastCall?.[0]).toEqual({
      url: "http://localhost:8123",
      database: "default",
      request_timeout: 5000,
    });
  });
});
