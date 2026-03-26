import { describe, expect, it, vi } from "vitest";

import { createApiKeyAuthenticator } from "../src/auth/apiKey.js";

describe("createApiKeyAuthenticator", () => {
  it("allows requests when auth is disabled", async () => {
    const auth = createApiKeyAuthenticator({
      enabled: false,
      protectMetrics: true,
      protectHealth: false,
      token: "secret",
    });

    await expect(
      auth.authenticate({ headers: {} } as never, { code: vi.fn(), send: vi.fn() } as never),
    ).resolves.toBeUndefined();
  });

  it("accepts bearer tokens and rejects invalid tokens", async () => {
    const reply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };
    const auth = createApiKeyAuthenticator({
      enabled: true,
      protectMetrics: true,
      protectHealth: false,
      token: "secret",
    });

    await auth.authenticate({ headers: { authorization: "Bearer secret" } } as never, reply as never);
    expect(reply.code).not.toHaveBeenCalled();

    await auth.authenticate({ headers: { authorization: "Bearer bad" } } as never, reply as never);
    expect(reply.code).toHaveBeenCalledWith(401);
  });
});
