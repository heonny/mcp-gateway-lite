#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { createAdapters } from "./adapters/index.js";
import { loadConfig } from "./config/loadConfig.js";
import { createMetricsRegistry } from "./metrics/registry.js";
import { buildServer } from "./server/buildServer.js";
import { registerGracefulShutdown } from "./server/gracefulShutdown.js";

export function parseConfigPath(argv: string[]): string {
  const configFlagIndex = argv.findIndex((entry) => entry === "--config");
  if (configFlagIndex >= 0) {
    return argv[configFlagIndex + 1] ?? "";
  }

  const currentFilePath = fileURLToPath(import.meta.url);
  const projectRoot = path.resolve(path.dirname(currentFilePath), "..");
  return path.join(projectRoot, "config.yml");
}

export async function main(): Promise<void> {
  const configPath = parseConfigPath(process.argv.slice(2));
  if (!configPath) {
    throw new Error("Missing value for --config");
  }

  const config = await loadConfig(configPath);
  const metrics = createMetricsRegistry();
  const adapters = createAdapters(config);
  const app = await buildServer({ config, adapters, metrics });

  registerGracefulShutdown(app);

  await app.listen({
    host: config.server.host,
    port: config.server.port,
  });

  app.log.info(
    {
      host: config.server.host,
      port: config.server.port,
      endpoint: `/${config.server.endpoint}`,
      adapters: adapters.map((adapter) => ({
        name: adapter.name,
        path: adapter.path,
        type: adapter.type,
      })),
    },
    "mcp gateway started",
  );
}

const isEntrypoint =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  await main();
}
