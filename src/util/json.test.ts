import { describe, it, expect } from "vitest";
import { stableStringify } from "./json.js";

describe("stableStringify", () => {
  it("produces deterministic key order for nested objects", () => {
    const obj = { z: 1, a: { y: 2, b: 3 }, m: 4 };
    const out = stableStringify(obj);
    expect(out).toBe('{"a":{"b":3,"y":2},"m":4,"z":1}');
  });

  it("pretty option indents with 2 spaces", () => {
    const obj = { a: 1 };
    const out = stableStringify(obj, true);
    expect(out).toContain("\n");
    expect(out).toContain("  ");
  });

  it("handles sparse arrays correctly (holes become null)", () => {
    const sparseArray = [1, , 3];
    const result = stableStringify(sparseArray);
    expect(result).toBe("[1,null,3]");
    expect(() => JSON.parse(result)).not.toThrow();
  });
});
