const allowedSqlPrefixes = ["select", "with", "explain", "show", "describe", "desc"];

export function ensureSingleStatement(sql: string): void {
  const trimmed = sql.trim();
  const normalized = trimmed.endsWith(";") ? trimmed.slice(0, -1) : trimmed;
  if (normalized.includes(";")) {
    throw new Error("Multiple SQL statements are not allowed.");
  }
}

export function ensureReadOnlySql(sql: string): void {
  const normalized = sql.trim().toLowerCase();
  if (!allowedSqlPrefixes.some((prefix) => normalized.startsWith(prefix))) {
    throw new Error("Only read-only SQL statements are allowed.");
  }
}

export function validateReadOnlySql(sql: string): void {
  ensureSingleStatement(sql);
  ensureReadOnlySql(sql);
}
