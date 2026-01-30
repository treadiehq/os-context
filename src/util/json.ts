/**
 * Stable JSON stringify: deterministic key order for top-level and nested objects.
 */
export function stableStringify(obj: unknown, pretty = false): string {
  return JSON.stringify(obj, stableReplacer, pretty ? 2 : 0);
}

function stableReplacer(_key: string, value: unknown): unknown {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce((acc, k) => {
        acc[k] = (value as Record<string, unknown>)[k];
        return acc;
      }, {} as Record<string, unknown>);
  }
  return value;
}
