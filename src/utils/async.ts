export async function safeResult<T>(fn: () => Promise<T>): Promise<[T, null] | [null, Error]> {
  try {
    return [await fn(), null];
  } catch (error) {
    const normalized = error instanceof Error ? error : new Error(String(error));
    return [null, normalized];
  }
}
