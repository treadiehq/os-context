/**
 * Return elapsed milliseconds since the given start (from performance.now()).
 */
export function elapsedMs(start: number): number {
  return Math.round(performance.now() - start);
}

/**
 * Create a timer; call .elapsed() to get ms.
 */
export function timer(): { elapsed: () => number } {
  const start = performance.now();
  return {
    elapsed: () => elapsedMs(start),
  };
}
