/**
 * @fileoverview Defines the sismik client.test Vitest specification, documenting expected success, failure, edge-case, and regression behavior without modifying immutable catalogue data.
 */
import { describe, expect, test, vi } from "vitest";
import { createSismikHaritaClient } from "@/lib/sismik-client";

/**
 * Builds a minimal fetch-compatible response object with caller-controlled status and JSON payload.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function response(status: number, body: unknown): Response {
  /**
   * Returns the captured payload through the asynchronous Response.json contract used by the provider client.
   *
   * The closure keeps each test response deterministic while avoiding reliance on browser Response implementation details.
   */
  async function readBody() { return body; }
  return { ok: status >= 200 && status < 300, status, json: readBody } as Response;
}

/**
 * Creates a deterministic clock function for provider-window and retry tests from one explicit ISO timestamp.
 *
 * Each invocation returns a new Date so tested code cannot mutate the value observed by a later call.
 */
function fixedNow(iso: string): () => Date {
  /** Returns a fresh copy of the fixed test instant for one injected clock read. */
  function readNow() { return new Date(iso); }
  return readNow;
}

describe("Sismik Harita client", () => {
  test("splits stale date ranges and sends authentication", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => response(200, { status: "success", earthquakes: [] }));
    const client = createSismikHaritaClient({ fetcher, now: fixedNow("2026-03-10T12:00:00Z"), apiKey: "token" });
    await client.fetchLatestEvents(Date.parse("2026-01-01T00:00:00Z") / 1_000);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[0][0]).toContain("date_from=2026-01-01");
    expect((fetcher.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe("Bearer token");
  });

  test("retries transient errors with exponential delays", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(500, {}))
      .mockResolvedValueOnce(response(500, {}))
      .mockResolvedValueOnce(response(200, { status: "success", earthquakes: [] }));
    const sleep = vi.fn(async () => undefined);
    const client = createSismikHaritaClient({ fetcher, sleep, now: fixedNow("2026-01-01T00:00:00Z") });
    await client.fetchLatestEvents(Date.parse("2026-01-01T00:00:00Z") / 1_000);
    expect(sleep.mock.calls).toEqual([[500], [1_000]]);
  });

  test("does not retry rate limiting", async () => {
    const fetcher = vi.fn(async () => response(429, {}));
    const client = createSismikHaritaClient({ fetcher, sleep: vi.fn(async () => undefined), now: fixedNow("2026-01-01T00:00:00Z") });
    await expect(client.fetchLatestEvents(Date.parse("2026-01-01T00:00:00Z") / 1_000)).rejects.toThrow("HTTP 429");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
