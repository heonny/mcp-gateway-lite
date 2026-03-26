import type { AdapterInstance, AppConfig } from "../types.js";
import { createClickHouseAdapter } from "./clickhouseAdapter.js";
import { createPostgresAdapter } from "./postgresAdapter.js";
import { createRedisAdapter } from "./redisAdapter.js";

export function createAdapters(config: AppConfig): AdapterInstance[] {
  return Object.entries(config.adapters)
    .filter(([, adapter]) => adapter.enabled)
    .map(([name, adapter]) => {
      switch (adapter.type) {
        case "postgres":
          return createPostgresAdapter(name, adapter);
        case "redis":
          return createRedisAdapter(name, adapter);
        case "clickhouse":
          return createClickHouseAdapter(name, adapter);
      }
    });
}
