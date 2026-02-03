/**
 * Stable JSON stringify: deterministic key order for top-level and nested objects.
 */
export function stableStringify(obj: unknown, pretty = false): string {
  const indentUnit = pretty ? "  " : "";
  const stack: unknown[] = [];

  const stringifyValue = (value: unknown, depth: number, key: string, inArray: boolean): string | undefined => {
    if (value && typeof value === "object") {
      const toJSON = (value as { toJSON?: (k: string) => unknown }).toJSON;
      if (typeof toJSON === "function") {
        value = toJSON.call(value, key);
      }
    }

    if (value === null) return "null";
    switch (typeof value) {
      case "string":
        return JSON.stringify(value);
      case "number":
        return Number.isFinite(value) ? String(value) : "null";
      case "boolean":
        return value ? "true" : "false";
      case "bigint":
        throw new TypeError("Do not know how to serialize a BigInt");
      case "undefined":
      case "function":
      case "symbol":
        return inArray ? "null" : undefined;
      default:
        break;
    }

    if (Array.isArray(value)) {
      if (stack.includes(value)) throw new TypeError("Converting circular structure to JSON");
      stack.push(value);
      const nextIndent = indentUnit ? indentUnit.repeat(depth + 1) : "";
      const currentIndent = indentUnit ? indentUnit.repeat(depth) : "";
      const items = value.map((item, index) => {
        const rendered = stringifyValue(item, depth + 1, String(index), true);
        return rendered === undefined ? "null" : rendered;
      });
      stack.pop();
      if (items.length === 0) return "[]";
      if (!indentUnit) return `[${items.join(",")}]`;
      return "[\n" + nextIndent + items.join(",\n" + nextIndent) + "\n" + currentIndent + "]";
    }

    if (typeof value === "object") {
      if (stack.includes(value)) throw new TypeError("Converting circular structure to JSON");
      stack.push(value);
      const keys = Object.keys(value as Record<string, unknown>).sort();
      const nextIndent = indentUnit ? indentUnit.repeat(depth + 1) : "";
      const currentIndent = indentUnit ? indentUnit.repeat(depth) : "";
      const props: string[] = [];
      for (const k of keys) {
        const rendered = stringifyValue((value as Record<string, unknown>)[k], depth + 1, k, false);
        if (rendered !== undefined) {
          const keyText = JSON.stringify(k);
          props.push(indentUnit ? `${keyText}: ${rendered}` : `${keyText}:${rendered}`);
        }
      }
      stack.pop();
      if (props.length === 0) return "{}";
      if (!indentUnit) return `{${props.join(",")}}`;
      return "{\n" + nextIndent + props.join(",\n" + nextIndent) + "\n" + currentIndent + "}";
    }

    return undefined;
  };

  return stringifyValue(obj, 0, "", false) as string;
}
