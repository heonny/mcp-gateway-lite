import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();
const endMock = vi.fn();
const onMock = vi.fn<(event: string, handler: (err: Error) => void) => void>();
const poolOptions = vi.hoisted(() => [] as Array<{ connectionString: string; ssl: unknown }>);

vi.mock("pg", () => ({
  Pool: class {
    query = queryMock;
    end = endMock;
    on = onMock;
    constructor(options: { connectionString: string; ssl: unknown }) {
      poolOptions.push(options);
    }
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

  it("stringifies non-Error rejections", async () => {
    queryMock.mockRejectedValue("connection reset");
    const { adapter, handler } = captureTool();
    await expect(handler({ sql: "SELECT 1" })).resolves.toMatchObject({
      content: [{ type: "text", text: "Query failed: connection reset" }],
    });
    await expect(adapter.healthCheck()).resolves.toMatchObject({ error: "connection reset" });
  });

  it("falls back to the row count when pg reports no rowCount", async () => {
    queryMock.mockResolvedValue({ rows: [{ id: 1 }, { id: 2 }], rowCount: null });
    const recordToolCall = vi.fn();
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
    let handler: ((args: { sql: string }) => Promise<unknown>) | undefined;
    adapter.registerTools(
      {
        tool(_name: string, _description: string, _schema: unknown, fn: typeof handler) {
          handler = fn;
        },
      } as never,
      { adapterName: "postgres", logger: {} as never, queryLogLevel: "redacted", recordToolCall },
    );
    await handler!({ sql: "SELECT id FROM t" });
    expect(recordToolCall).toHaveBeenCalledWith(expect.objectContaining({ resultCount: 2 }));
  });

  it("enables ssl and tolerates missing credential env vars", () => {
    delete process.env.POSTGRES_USER;
    delete process.env.POSTGRES_PASSWORD;
    createPostgresAdapter("postgres", {
      type: "postgres",
      enabled: true,
      path: "postgres",
      host: "db.internal",
      port: 5432,
      database: "app",
      userEnv: "POSTGRES_USER",
      passwordEnv: "POSTGRES_PASSWORD",
      ssl: true,
    });
    expect(poolOptions.at(-1)).toMatchObject({
      connectionString: "postgresql://db.internal:5432/app",
      ssl: { rejectUnauthorized: false },
    });
  });
});
