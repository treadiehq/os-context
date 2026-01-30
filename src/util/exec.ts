import { execa } from "execa";

export interface ExecOptions {
  timeoutMs: number;
}

/**
 * Run a shell command with timeout. Safe args only (no user-controlled shell).
 */
export async function run(
  cmd: string,
  args: string[],
  options: ExecOptions
): Promise<{ stdout: string; stderr: string; ok: boolean; timedOut?: boolean }> {
  try {
    const result = await execa(cmd, args, {
      timeout: options.timeoutMs,
      reject: false,
      all: false,
    });
    return {
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      ok: result.exitCode === 0,
      timedOut: result.timedOut,
    };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; timedOut?: boolean };
    return {
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
      ok: false,
      timedOut: e.timedOut ?? false,
    };
  }
}
