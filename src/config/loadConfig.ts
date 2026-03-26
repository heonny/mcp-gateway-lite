import { readFile } from "node:fs/promises";
import process from "node:process";

import YAML from "yaml";

import type { AdapterConfig, AppConfig } from "../types.js";
import { appConfigSchema } from "./schema.js";

const envPattern = /\$\{([A-Z][A-Z0-9_]*)(:-([^}]*))?\}/gu;

function resolveEnvValue(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable '${name}' is not set.`);
  }
  return value;
}

function interpolateEnvString(value: string): string {
  return value.replace(envPattern, (_match, envName: string, _defaultGroup: string | undefined, defaultValue?: string) => {
    const envValue = process.env[envName];
    if (typeof envValue === "string" && envValue.length > 0) {
      return envValue;
    }

    if (typeof defaultValue === "string") {
      return defaultValue;
    }

    throw new Error(`Required environment variable '${envName}' is not set for config interpolation.`);
  });
}

function interpolateEnvInValue(value: unknown): unknown {
  if (typeof value === "string") {
    return interpolateEnvString(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => interpolateEnvInValue(entry));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, interpolateEnvInValue(entry)]),
    );
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

  const raw = resolveEnvValue(config.auth.tokenEnv);
  if (raw.trim().length === 0) {
    throw new Error(`Environment variable '${config.auth.tokenEnv}' must be a non-empty bearer token.`);
  }
}

export async function loadConfig(configPath: string): Promise<AppConfig> {
  const rawFile = await readFile(configPath, "utf8");
  const parsedYaml = interpolateEnvInValue(YAML.parse(rawFile));
  const config = appConfigSchema.parse(parsedYaml) as unknown as AppConfig;

  validateAuthSecrets(config);
  for (const [name, adapter] of Object.entries(config.adapters)) {
    void name;
    validateAdapterSecrets(adapter);
  }

  return config;
}

export function loadBearerToken(config: AppConfig): string | null {
  if (!config.auth.enabled) {
    return null;
  }

  return process.env[config.auth.tokenEnv] ?? null;
}
