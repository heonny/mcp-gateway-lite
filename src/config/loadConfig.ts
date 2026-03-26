import { readFile } from "node:fs/promises";
import process from "node:process";

import YAML from "yaml";

import type { AdapterConfig, AppConfig } from "../types.js";
import { appConfigSchema } from "./schema.js";

function resolveEnvValue(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable '${name}' is not set.`);
  }
  return value;
}

function validateAdapterSecrets(adapter: AdapterConfig): void {
  if (!adapter.enabled) {
    return;
  }

  switch (adapter.type) {
    case "postgres":
    case "clickhouse":
      resolveEnvValue(adapter.userEnv);
      resolveEnvValue(adapter.passwordEnv);
      break;
    case "redis":
      if (adapter.passwordEnv) {
        resolveEnvValue(adapter.passwordEnv);
      }
      break;
  }
}

function validateAuthSecrets(config: AppConfig): void {
  if (!config.auth.enabled) {
    return;
  }

  const raw = resolveEnvValue(config.auth.keysEnv);
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Environment variable '${config.auth.keysEnv}' must be a JSON array of API keys: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== "string" || entry.length === 0)) {
    throw new Error(`Environment variable '${config.auth.keysEnv}' must be a JSON array of non-empty strings.`);
  }
}

export async function loadConfig(configPath: string): Promise<AppConfig> {
  const rawFile = await readFile(configPath, "utf8");
  const parsedYaml = YAML.parse(rawFile) as unknown;
  const config = appConfigSchema.parse(parsedYaml) as AppConfig;

  validateAuthSecrets(config);
  for (const [name, adapter] of Object.entries(config.adapters)) {
    void name;
    validateAdapterSecrets(adapter);
  }

  return config;
}

export function loadApiKeys(config: AppConfig): Set<string> {
  if (!config.auth.enabled) {
    return new Set();
  }

  const raw = process.env[config.auth.keysEnv];
  const parsed = JSON.parse(raw ?? "[]") as string[];
  return new Set(parsed);
}
