/**
 * Wraps a promise so a stuck wallet interaction fails loudly with a clear
 * message instead of leaving the UI on a spinner indefinitely.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}
