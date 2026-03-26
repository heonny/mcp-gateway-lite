import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from "prom-client";

export interface MetricsRegistry {
  registry: Registry;
  httpRequestsTotal: Counter<"method" | "route" | "status_code">;
  adapterToolCallsTotal: Counter<"adapter" | "tool" | "status">;
  adapterHealthGauge: Gauge<"adapter">;
  adapterRequestDurationMs: Histogram<"adapter" | "tool" | "status">;
}

export function createMetricsRegistry(): MetricsRegistry {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry });

  return {
    registry,
    httpRequestsTotal: new Counter({
      name: "mcp_gateway_http_requests_total",
      help: "Count of HTTP requests",
      labelNames: ["method", "route", "status_code"],
      registers: [registry],
    }),
    adapterToolCallsTotal: new Counter({
      name: "mcp_gateway_adapter_tool_calls_total",
      help: "Count of adapter tool calls",
      labelNames: ["adapter", "tool", "status"],
      registers: [registry],
    }),
    adapterHealthGauge: new Gauge({
      name: "mcp_gateway_adapter_health",
      help: "Adapter health status, 1 for healthy and 0 for unhealthy",
      labelNames: ["adapter"],
      registers: [registry],
    }),
    adapterRequestDurationMs: new Histogram({
      name: "mcp_gateway_adapter_request_duration_ms",
      help: "Latency of adapter tool calls in milliseconds",
      labelNames: ["adapter", "tool", "status"],
      buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 3000, 5000],
      registers: [registry],
    }),
  };
}
