import { describe, expect, it, vi } from "vitest";

import { writeQueryAudit } from "../src/logging/queryAudit.js";

function makeLogger() {
  return {
    info: vi.fn<(payload: unknown, message: string) => void>(),
  };
}

describe("writeQueryAudit", () => {
  it("skips logs when disabled", () => {
    const logger = makeLogger();
    writeQueryAudit(logger as never, "postgres", "disable", {
      tool: "query",
      text: "select 1",
      status: "ok",
      durationMs: 10,
    });
    expect(logger.info).not.toHaveBeenCalled();
  });

  it("writes redacted payloads by default", () => {
    const logger = makeLogger();
    writeQueryAudit(logger as never, "postgres", "redacted", {
      tool: "query",
      text: "select 1",
      status: "ok",
      durationMs: 10,
    });
    const payload = logger.info.mock.calls[0]?.[0] as Record<string, unknown>;
    const message = logger.info.mock.calls[0]?.[1];
    expect(payload.adapter).toBe("postgres");
    expect(typeof payload.textHash).toBe("string");
    expect(payload.textLength).toBe(8);
    expect(message).toBe("adapter tool audit");
  });

  it("writes full text when enabled", () => {
    const logger = makeLogger();
    writeQueryAudit(logger as never, "postgres", "full", {
      tool: "query",
      text: "select 1",
      status: "ok",
      durationMs: 10,
    });
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "select 1",
      }),
      "adapter tool audit",
    );
  });

  it("writes minimal payloads without query metadata", () => {
    const logger = makeLogger();
    writeQueryAudit(logger as never, "postgres", "minimal", {
      tool: "query",
      text: "select 1",
      status: "ok",
      durationMs: 10,
    });
    const payload = logger.info.mock.calls[0]?.[0] as Record<string, unknown>;
    const message = logger.info.mock.calls[0]?.[1];
    expect("text" in payload).toBe(false);
    expect("textHash" in payload).toBe(false);
    expect(message).toBe("adapter tool audit");
  });
});
