import { randomUUID } from "node:crypto";

import rateLimit from "@fastify/rate-limit";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";

import { createApiKeyAuthenticator } from "../auth/apiKey.js";
import { loadBearerToken } from "../config/loadConfig.js";
import { writeQueryAudit } from "../logging/queryAudit.js";
import type { MetricsRegistry } from "../metrics/registry.js";
import type { AdapterInstance, AdapterHealthStatus, AppConfig, RequestAudit, ToolExecutionContext } from "../types.js";
import { buildRoutePath, normalizeRouteSegment } from "../utils/paths.js";

export interface BuildServerOptions {
  config: AppConfig;
  adapters: AdapterInstance[];
  metrics: MetricsRegistry;
}

interface HealthResponse {
  ok: boolean;
  service: {
    name: string;
    endpoint: string;
  };
  adapters: Record<string, AdapterHealthStatus>;
}

function shouldAuthenticate(path: string, config: AppConfig): boolean {
  const normalizedPath = path.split("?")[0] ?? path;
  const mcpBase = `/${normalizeRouteSegment(config.server.endpoint)}/`;
  if (normalizedPath.startsWith(mcpBase)) {
    return true;
  }

  if (config.auth.protectMetrics && normalizedPath === config.observability.metricsPath) {
    return true;
  }

  if (config.auth.protectHealth && normalizedPath === config.observability.healthPath) {
    return true;
  }

  return false;
}

async function collectHealth(
  endpoint: string,
  adapters: AdapterInstance[],
  metrics: MetricsRegistry,
): Promise<HealthResponse> {
  const statuses = await Promise.all(
    adapters.map(async (adapter) => {
      const status = await adapter.healthCheck();
      metrics.adapterHealthGauge.set({ adapter: adapter.name }, status.ok ? 1 : 0);
      return [adapter.name, status] as const;
    }),
  );

  const adapterMap = Object.fromEntries(statuses);
  const ok = statuses.every(([, status]) => status.ok);

  return {
    ok,
    service: {
      name: "mcp-gateway-lite",
      endpoint: `/${normalizeRouteSegment(endpoint)}`,
    },
    adapters: adapterMap,
  };
}

export async function buildServer({ config, adapters, metrics }: BuildServerOptions): Promise<FastifyInstance> {
  const app: FastifyInstance = Fastify({
    logger: {
      level: "info",
    },
    bodyLimit: parseBodyLimit(config.server.requestBodyLimit),
    requestTimeout: config.server.requestTimeoutMs,
    disableRequestLogging: true,
    genReqId: () => randomUUID(),
  });

  if (config.security.rateLimit.enabled) {
    await app.register(rateLimit, {
      global: true,
      max: config.security.rateLimit.maxRequests,
      timeWindow: config.security.rateLimit.windowMs,
    });
  }

  const authenticator = createApiKeyAuthenticator({
    enabled: config.auth.enabled,
    protectMetrics: config.auth.protectMetrics,
    protectHealth: config.auth.protectHealth,
    token: loadBearerToken(config),
  });

  app.addHook("onRequest", async (request, reply) => {
    if (shouldAuthenticate(request.url, config)) {
      await authenticator.authenticate(request as never, reply as never);
    }
  });

  app.addHook("onResponse", async (request, reply) => {
    metrics.httpRequestsTotal.inc({
      method: request.method,
      route: request.routeOptions.url ?? request.url.split("?")[0] ?? "unknown",
      status_code: String(reply.statusCode),
    });
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error({ err: error }, "request failed");
    void reply.code(error.statusCode && error.statusCode >= 400 ? error.statusCode : 500).send({
      error: "Internal Server Error",
      message: error.message,
    });
  });

  app.get(config.observability.healthPath, async (_request, reply) => {
    const health = await collectHealth(config.server.endpoint, adapters, metrics);
    await reply.code(health.ok ? 200 : 503).send(health);
  });

  app.get(config.observability.metricsPath, async (_request, reply) => {
    if (!config.observability.metricsEnabled) {
      await reply.code(404).send({ error: "Metrics disabled" });
      return;
    }

    reply.header("Content-Type", metrics.registry.contentType);
    await reply.send(await metrics.registry.metrics());
  });

  for (const adapter of adapters) {
    const routePath = buildRoutePath(config.server.endpoint, adapter.path);
    app.post(routePath, async (request, reply) => {
      const server = new McpServer({
        name: `mcp-gateway-lite-${adapter.name}`,
        version: "0.1.0",
      });

      const context: ToolExecutionContext = {
        logger: request.log,
        adapterName: adapter.name,
        queryLogLevel: config.security.queryLogLevel,
        recordToolCall: (audit: RequestAudit) => {
          metrics.adapterToolCallsTotal.inc({
            adapter: adapter.name,
            tool: audit.tool,
            status: audit.status,
          });
          metrics.adapterRequestDurationMs.observe(
            {
              adapter: adapter.name,
              tool: audit.tool,
              status: audit.status,
            },
            audit.durationMs,
          );
          writeQueryAudit(request.log, adapter.name, config.security.queryLogLevel, audit);
        },
      };

      adapter.registerTools(server, context);

      const transport = new StreamableHTTPServerTransport({
      });

      await server.connect(transport as never);
      await transport.handleRequest(request.raw as never, reply.raw as never, request.body);
      return reply;
    });
  }

  app.setNotFoundHandler(async (_request, reply) => {
    await reply.code(404).send({ error: "Not Found" });
  });

  app.addHook("onClose", async () => {
    await Promise.all(adapters.map(async (adapter) => adapter.close()));
  });

  return app;
}

function parseBodyLimit(value: string): number {
  const match = value.match(/^(\d+)(b|kb|mb)$/iu);
  if (!match) {
    throw new Error(`Unsupported requestBodyLimit '${value}'. Use values like 1mb or 512kb.`);
  }

  const amount = Number(match[1]);
  const unit = match[2];
  if (!unit) {
    throw new Error(`Unsupported requestBodyLimit '${value}'.`);
  }
  switch (unit) {
    case "b":
      return amount;
    case "kb":
      return amount * 1024;
    case "mb":
      return amount * 1024 * 1024;
    default:
      throw new Error(`Unsupported requestBodyLimit unit '${unit}'.`);
  }
}
