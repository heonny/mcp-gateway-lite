import { z } from "zod";

const routeSegmentSchema = z
  .string()
  .min(1)
  .regex(/^[a-zA-Z0-9_-]+$/u, "must contain only letters, numbers, underscores, or hyphens");

const envVarSchema = z
  .string()
  .min(1)
  .regex(/^[A-Z][A-Z0-9_]*$/u, "must look like an environment variable name");

const integerFromConfigSchema = z.coerce.number().int().positive();
const nonNegativeIntegerFromConfigSchema = z.coerce.number().int().min(0);

const baseAdapterSchema = z.object({
  enabled: z.boolean().default(true),
  path: routeSegmentSchema,
});

const postgresAdapterSchema = baseAdapterSchema.extend({
  type: z.literal("postgres"),
  host: z.string().min(1),
  port: integerFromConfigSchema,
  database: z.string().min(1),
  userEnv: envVarSchema,
  passwordEnv: envVarSchema,
  ssl: z.boolean().optional(),
});

const redisAdapterSchema = baseAdapterSchema.extend({
  type: z.literal("redis"),
  host: z.string().min(1),
  port: integerFromConfigSchema,
  passwordEnv: envVarSchema.optional(),
  db: nonNegativeIntegerFromConfigSchema,
});

const clickHouseAdapterSchema = baseAdapterSchema.extend({
  type: z.literal("clickhouse"),
  host: z.string().min(1),
  port: integerFromConfigSchema,
  database: z.string().min(1),
  userEnv: envVarSchema,
  passwordEnv: envVarSchema,
  protocol: z.enum(["http", "https"]).default("http"),
});

export const appConfigSchema = z
  .object({
    server: z.object({
      host: z.string().min(1).default("0.0.0.0"),
      port: integerFromConfigSchema.default(8610),
      endpoint: routeSegmentSchema.default("mcp"),
      requestBodyLimit: z.string().default("1mb"),
      requestTimeoutMs: integerFromConfigSchema.default(10000),
    }),
    auth: z.object({
      enabled: z.boolean().default(true),
      tokenEnv: envVarSchema.default("MCP_BEARER_TOKEN"),
      protectMetrics: z.boolean().default(true),
      protectHealth: z.boolean().default(false),
    }),
    security: z.object({
      queryLogLevel: z.enum(["redacted", "minimal", "full", "disable"]).default("redacted"),
      rateLimit: z.object({
        enabled: z.boolean().default(true),
        windowMs: integerFromConfigSchema.default(60000),
        maxRequests: integerFromConfigSchema.default(120),
      }),
    }),
    observability: z.object({
      metricsEnabled: z.boolean().default(true),
      healthPath: z.string().min(1).default("/health"),
      metricsPath: z.string().min(1).default("/metrics"),
    }),
    adapters: z.record(z.string(), z.discriminatedUnion("type", [postgresAdapterSchema, redisAdapterSchema, clickHouseAdapterSchema])),
  })
  .superRefine((config, ctx) => {
    const enabledPaths = new Map<string, string>();

    for (const [name, adapter] of Object.entries(config.adapters)) {
      if (!adapter.enabled) {
        continue;
      }

      if (enabledPaths.has(adapter.path)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `adapter path '${adapter.path}' is already used by '${enabledPaths.get(adapter.path)}'`,
          path: ["adapters", name, "path"],
        });
      } else {
        enabledPaths.set(adapter.path, name);
      }
    }
  });

export type RawAppConfig = z.infer<typeof appConfigSchema>;
