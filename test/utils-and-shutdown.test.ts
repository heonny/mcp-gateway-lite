import { describe, expect, it, vi } from "vitest";

import { registerGracefulShutdown } from "../src/server/gracefulShutdown.js";
import { safeResult } from "../src/utils/async.js";
import { digestText } from "../src/utils/hash.js";

describe("safeResult", () => {
  it("returns the result for successful async functions", async () => {
    await expect(safeResult(() => Promise.resolve(42))).resolves.toEqual([42, null]);
  });

  it("normalizes thrown values to Error", async () => {
    const [value, error] = await safeResult(() => Promise.reject(new Error("boom")));
    expect(value).toBeNull();
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toBe("boom");
  });

});

describe("digestText", () => {
  it("returns a stable 16-char digest", () => {
    expect(digestText("select 1")).toHaveLength(16);
    expect(digestText("select 1")).toBe(digestText("select 1"));
  });
});

describe("registerGracefulShutdown", () => {
  it("registers signal handlers", () => {
    const onceSpy = vi.spyOn(process, "once").mockImplementation(() => process);
    registerGracefulShutdown({
      log: { info: vi.fn(), error: vi.fn() },
      close: vi.fn().mockResolvedValue(undefined),
    } as never);
    expect(onceSpy).toHaveBeenCalledWith("SIGINT", expect.any(Function));
    expect(onceSpy).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
    onceSpy.mockRestore();
  });

  it("closes the app and exits successfully on signal", async () => {
    const handlers = new Map<string, () => void>();
    const onceSpy = vi.spyOn(process, "once").mockImplementation((signal, handler) => {
      handlers.set(String(signal), handler as () => void);
      return process;
    });
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const close = vi.fn().mockResolvedValue(undefined);

    registerGracefulShutdown({
      log: { info: vi.fn(), error: vi.fn() },
      close,
    } as never);

    expect(() => handlers.get("SIGTERM")?.()).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
    expect(close).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);

    onceSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("exits with failure when shutdown fails", async () => {
    const handlers = new Map<string, () => void>();
    const onceSpy = vi.spyOn(process, "once").mockImplementation((signal, handler) => {
      handlers.set(String(signal), handler as () => void);
      return process;
    });
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const close = vi.fn().mockRejectedValue(new Error("close failed"));
    const log = { info: vi.fn(), error: vi.fn() };

    registerGracefulShutdown({
      log,
      close,
    } as never);

    expect(() => handlers.get("SIGINT")?.()).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
    expect(log.error).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);

    onceSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
