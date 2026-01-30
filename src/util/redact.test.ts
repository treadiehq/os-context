import { describe, it, expect } from "vitest";
import { sha256, redactString } from "./redact.js";

describe("sha256", () => {
  it("returns hex digest of UTF-8 string", () => {
    const out = sha256("hello");
    expect(out).toMatch(/^[a-f0-9]{64}$/);
    expect(out).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    );
  });

  it("empty string has consistent hash", () => {
    const out = sha256("");
    expect(out).toMatch(/^[a-f0-9]{64}$/);
    expect(sha256("")).toBe(out);
  });
});

describe("redactString", () => {
  it("returns sha256 and length", () => {
    const r = redactString("foo");
    expect(r.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(r.length).toBe(3);
  });

  it("does not return raw string", () => {
    const r = redactString("secret");
    expect(r).not.toHaveProperty("text");
    expect(Object.keys(r)).toEqual(["sha256", "length"]);
  });
});
