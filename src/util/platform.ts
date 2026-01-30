/**
 * Platform detection for darwin (macOS) vs linux. Used to pick implementations.
 */
export type Platform = "darwin" | "linux" | "unsupported";

export function getPlatform(): Platform {
  const p = process.platform;
  if (p === "darwin") return "darwin";
  if (p === "linux") return "linux";
  return "unsupported";
}

export function isDarwin(): boolean {
  return process.platform === "darwin";
}

export function isLinux(): boolean {
  return process.platform === "linux";
}

export function isSupported(): boolean {
  return isDarwin() || isLinux();
}
