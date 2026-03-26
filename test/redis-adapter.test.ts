import { beforeEach, describe, expect, it, vi } from "vitest";

const connectMock = vi.fn();
const sendCommandMock = vi.fn();
const pingMock = vi.fn();
const dbSizeMock = vi.fn();
const quitMock = vi.fn();

vi.mock("redis", () => ({
  createClient: vi.fn(() => ({
    connect: connectMock,
    sendCommand: sendCommandMock,
    ping: pingMock,
    dbSize: dbSizeMock,
    quit: quitMock,
    isOpen: true,
  })),
}));

import { createRedisAdapter } from "../src/adapters/redisAdapter.js";

function captureTool() {
  const adapter = createRedisAdapter("redis", {
    type: "redis",
    enabled: true,
    path: "redis",
    host: "localhost",
    port: 6379,
    db: 0,
    passwordEnv: "REDIS_PASSWORD",
  });
  const handlers = new Map<string, (args: { command: string }) => Promise<unknown>>();
  adapter.registerTools(
    {
      tool(
        name: string,
        _description: string,
        _schema: unknown,
        handler: (args: { command: string }) => Promise<unknown>,
      ) {
        handlers.set(name, handler);
      },
    } as never,
    {
      adapterName: "redis",
      logger: { info: vi.fn(), error: vi.fn() } as never,
      queryLogLevel: "redacted",
      recordToolCall: vi.fn(),
    },
  );
  return { adapter, handler: handlers.get("command")! };
}

describe("createRedisAdapter", () => {
  beforeEach(() => {
    process.env.REDIS_PASSWORD = "pass";
    connectMock.mockReset();
    sendCommandMock.mockReset();
    pingMock.mockReset();
    dbSizeMock.mockReset();
    quitMock.mockReset();
    connectMock.mockResolvedValue(undefined);
  });

  it("blocks write commands", async () => {
    const { handler } = captureTool();
    const result = await handler({ command: "SET mykey value" });
    expect(result).toMatchObject({ isError: true });
  });

  it("executes allowlisted commands", async () => {
    sendCommandMock.mockResolvedValue("value");
    const { handler } = captureTool();
    const result = await handler({ command: "GET mykey" });
    expect(result).toMatchObject({
      content: [{ type: "text", text: JSON.stringify("value", null, 2) }],
    });
  });

  it("reports health and closes client", async () => {
    pingMock.mockResolvedValue("PONG");
    dbSizeMock.mockResolvedValue(12);
    const { adapter } = captureTool();
    await expect(adapter.healthCheck()).resolves.toMatchObject({ ok: true });
    await adapter.close();
    expect(quitMock).toHaveBeenCalledTimes(1);
  });

  it("returns command errors and unhealthy health checks", async () => {
    sendCommandMock.mockRejectedValueOnce(new Error("boom"));
    pingMock.mockRejectedValueOnce(new Error("boom"));
    const { adapter, handler } = captureTool();
    await expect(handler({ command: "GET mykey" })).resolves.toMatchObject({ isError: true });
    await expect(adapter.healthCheck()).resolves.toMatchObject({ ok: false });
  });
});
