import { afterEach, describe, expect, it, vi } from "vitest";

import { createMetricsRegistry } from "../src/metrics/registry.js";
import { buildServer } from "../src/server/buildServer.js";
import { makeConfig } from "./fixtures/config.js";
import { createFakeAdapter } from "./helpers/fakeAdapter.js";

describe("buildServer", () => {
  afterEach(() => {
    delete process.env.MCP_BEARER_TOKEN;
  });

  it("protects mcp routes with bearer tokens", async () => {
    process.env.MCP_BEARER_TOKEN = "secret-token";
    const config = makeConfig();
    const app = await buildServer({
      config,
      adapters: [createFakeAdapter()],
      metrics: createMetricsRegistry(),
    });

    const unauthorized = await app.inject({
      method: "POST",
      url: "/mcp/fake",
      payload: {},
    });
    expect(unauthorized.statusCode).toBe(401);

    const health = await app.inject({
      method: "GET",
      url: "/health",
    });
    expect(health.statusCode).toBe(200);

    await app.close();
  });

  it("serves metrics and health with adapter status", async () => {
    process.env.MCP_BEARER_TOKEN = "secret-token";
    const config = makeConfig();
    const metrics = createMetricsRegistry();
    const app = await buildServer({
      config,
      adapters: [createFakeAdapter({ name: "postgres", path: "postgres" })],
      metrics,
    });

    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({
      ok: true,
      adapters: {
        postgres: {
          ok: true,
        },
      },
    });

    const metricsUnauthorized = await app.inject({
      method: "GET",
      url: "/metrics",
    });
    expect(metricsUnauthorized.statusCode).toBe(401);

    const metricsAuthorized = await app.inject({
      method: "GET",
      url: "/metrics",
      headers: { authorization: "Bearer secret-token" },
    });
    expect(metricsAuthorized.statusCode).toBe(200);
    expect(metricsAuthorized.body).toContain("mcp_gateway_http_requests_total");

    await app.close();
  });

  it("returns degraded health and can disable metrics", async () => {
    process.env.MCP_BEARER_TOKEN = "secret-token";
    const config = makeConfig();
    config.observability.metricsEnabled = false;
    const app = await buildServer({
      config,
      adapters: [createFakeAdapter({ health: { ok: false, latencyMs: 9, error: "down" } })],
      metrics: createMetricsRegistry(),
    });

    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(503);
    expect(health.json()).toMatchObject({
      ok: false,
      adapters: {
        fake: {
          ok: false,
          error: "down",
        },
      },
    });

    const metrics = await app.inject({
      method: "GET",
      url: "/metrics",
      headers: { authorization: "Bearer secret-token" },
    });
    expect(metrics.statusCode).toBe(404);

    await app.close();
  });

  it("can protect health endpoint and rejects invalid body limit config", async () => {
    process.env.MCP_BEARER_TOKEN = "secret-token";
    const protectedConfig = makeConfig();
    protectedConfig.auth.protectHealth = true;

    const protectedApp = await buildServer({
      config: protectedConfig,
      adapters: [createFakeAdapter()],
      metrics: createMetricsRegistry(),
    });

    const unauthorizedHealth = await protectedApp.inject({
      method: "GET",
      url: "/health",
    });
    expect(unauthorizedHealth.statusCode).toBe(401);
    await protectedApp.close();

    const invalidConfig = makeConfig();
    invalidConfig.server.requestBodyLimit = "7gb";
    await expect(
      buildServer({
        config: invalidConfig,
        adapters: [createFakeAdapter()],
        metrics: createMetricsRegistry(),
      }),
    ).rejects.toThrow("Unsupported requestBodyLimit");
  });

  it("closes adapters on shutdown", async () => {
    process.env.MCP_BEARER_TOKEN = "secret-token";
    const onClose = vi.fn();
    const app = await buildServer({
      config: makeConfig(),
      adapters: [createFakeAdapter({ onClose })],
      metrics: createMetricsRegistry(),
    });

    await app.close();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
