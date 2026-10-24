/** Prevent browser storage or network promises from blocking an action indefinitely. */
export function withDeadline<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("operation-timeout")), timeoutMs);
  });
  return Promise.race([operation, deadline]).finally(() => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  });
}
