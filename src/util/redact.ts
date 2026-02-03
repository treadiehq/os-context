import { createHash } from "node:crypto";

/**
 * SHA-256 hex digest of UTF-16LE string. Empty string -> hash of "".
 */
export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf16le").digest("hex");
}

/**
 * Redact a string: return { sha256, length }. Never returns the raw string.
 */
export function redactString(value: string): { sha256: string; length: number } {
  return {
    sha256: sha256(value),
    length: value.length,
  };
}
