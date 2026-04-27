import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();
const endMock = vi.fn();
const onMock = vi.fn<(event: string, handler: (err: Error) => void) => void>();

vi.mock("pg", () => ({
  Pool: class {
    query = queryMock;
    end = endMock;
    on = onMock;
  },
}));

import { createPostgresAdapter } from "../src/adapters/postgresAdapter.js";

function captureTool(adapter = createPostgresAdapter("postgres", {
  type: "postgres",
  enabled: true,
  path: "postgres",
  host: "localhost",
  port: 5432,
  database: "app",
  userEnv: "POSTGRES_USER",
  passwordEnv: "POSTGRES_PASSWORD",
})) {
  const handlers = new Map<string, (args: { sql: string }) => Promise<unknown>>();
  adapter.registerTools(
    {
      tool(name: string, _description: string, _schema: unknown, handler: (args: { sql: string }) => Promise<unknown>) {
        handlers.set(name, handler);
      },
    } as never,
    {
      adapterName: "postgres",
      logger: { info: vi.fn(), error: vi.fn() } as never,
      queryLogLevel: "redacted",
      recordToolCall: vi.fn(),
    },
  );
  return { adapter, handler: handlers.get("query")! };
}

describe("createPostgresAdapter", () => {
  beforeEach(() => {
    process.env.POSTGRES_USER = "user";
    process.env.POSTGRES_PASSWORD = "pass";
    queryMock.mockReset();
    endMock.mockReset();
    onMock.mockReset();
  });

  it("blocks write queries", async () => {
    const { handler } = captureTool();
    const result = await handler({ sql: "DELETE FROM users" });
    expect(result).toMatchObject({ isError: true });
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("executes read-only queries", async () => {
    queryMock.mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 });
    const { handler } = captureTool();
    const result = await handler({ sql: "SELECT 1" });
    expect(result).toMatchObject({
      content: [{ type: "text", text: JSON.stringify([{ id: 1 }], null, 2) }],
    });
  });

  it("returns errors when query execution fails", async () => {
    queryMock.mockRejectedValue(new Error("db down"));
    const { handler } = captureTool();
    const result = await handler({ sql: "SELECT 1" });
    expect(result).toMatchObject({ isError: true });
  });

  it("reports health and closes pool", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ database: "app", user_name: "user" }],
    });
    const adapter = createPostgresAdapter("postgres", {
      type: "postgres",
      enabled: true,
      path: "postgres",
      host: "localhost",
      port: 5432,
      database: "app",
      userEnv: "POSTGRES_USER",
      passwordEnv: "POSTGRES_PASSWORD",
    });
    await expect(adapter.healthCheck()).resolves.toMatchObject({ ok: true });
    await adapter.close();
    expect(endMock).toHaveBeenCalledTimes(1);
  });

  it("reports unhealthy status on health failure", async () => {
    queryMock.mockRejectedValue(new Error("unavailable"));
    const adapter = createPostgresAdapter("postgres", {
      type: "postgres",
      enabled: true,
      path: "postgres",
      host: "localhost",
      port: 5432,
      database: "app",
      userEnv: "POSTGRES_USER",
      passwordEnv: "POSTGRES_PASSWORD",
    });
    await expect(adapter.healthCheck()).resolves.toMatchObject({ ok: false });
  });

  it("registers a pool error listener that suppresses uncaught throws", () => {
    captureTool();
    expect(onMock).toHaveBeenCalledWith("error", expect.any(Function));
    const errorCall = onMock.mock.calls.find((call) => call[0] === "error");
    expect(errorCall).toBeDefined();
    const handler = errorCall![1];
    const writeSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    expect(() => handler(new Error("idle drop"))).not.toThrow();
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining("[postgres:postgres] idle drop"));
    writeSpy.mockRestore();
  });
});
