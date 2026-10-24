import { afterEach, describe, expect, it, vi } from "vitest";
import { withDeadline } from "@/lib/client/with-deadline";

describe("mobile logout deadline guard", () => {
  afterEach(() => vi.useRealTimers());

  it("returns a completed result without waiting for the deadline", async () => {
    vi.useFakeTimers();
    const result = await withDeadline(Promise.resolve(["done"]), 1500);
    expect(result).toEqual(["done"]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects a hanging IndexedDB promise within its deadline", async () => {
    vi.useFakeTimers();
    const hanging = new Promise<void>(() => undefined);
    const guarded = withDeadline(hanging, 1500);
    const assertion = expect(guarded).rejects.toThrow("operation-timeout");
    await vi.advanceTimersByTimeAsync(1500);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("preserves the original failure and clears the deadline", async () => {
    vi.useFakeTimers();
    await expect(withDeadline(Promise.reject(new Error("storage-denied")), 1200))
      .rejects.toThrow("storage-denied");
    expect(vi.getTimerCount()).toBe(0);
  });
});
