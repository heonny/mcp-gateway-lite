const allowedCommands = new Set([
  "get",
  "mget",
  "hget",
  "hgetall",
  "hmget",
  "lrange",
  "llen",
  "scard",
  "smembers",
  "sismember",
  "zrange",
  "zrevrange",
  "zcard",
  "type",
  "exists",
  "ttl",
  "pttl",
  "keys",
  "scan",
  "xrange",
  "xrevrange",
]);

export function validateRedisCommand(command: string): string[] {
  const tokens = command
    .trim()
    .split(/\s+/u)
    .filter(Boolean);

  if (tokens.length === 0) {
    throw new Error("Redis command must not be empty.");
  }

  if (!allowedCommands.has(tokens[0]!.toLowerCase())) {
    throw new Error("Only read-only Redis commands from the allowlist are permitted.");
  }

  return tokens;
}
