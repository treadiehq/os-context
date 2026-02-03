import { describe, it, expect } from "vitest";
import { sha256, redactString } from "./redact.js";

describe("sha256", () => {
  it("returns hex digest of UTF-16LE string", () => {
    const out = sha256("hello");
    expect(out).toMatch(/^[a-f0-9]{64}$/);
    expect(out).toBe(
      "06e44dc1b95c469f43aaccb49e93c36827626266eed5575eced74af9a016c9cd"
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
