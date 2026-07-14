/**
 * @fileoverview Defines the sismik client application service module and makes its contracts, integration responsibilities, side effects, and fallback behavior explicit to maintainers.
 */
import { MILLISECONDS_PER_DAY } from "./time";
import type { RawCatalogEarthquake } from "./catalog-domain";

interface ApiResponse {
  status?: string;
  earthquakes?: unknown[];
  message?: string;
}

export interface SismikHaritaClientOptions {
  fetcher?: typeof fetch;
  now?: () => Date;
  sleep?: (milliseconds: number) => Promise<void>;
  apiKey?: string;
}

const apiUrl = "https://sismikharita.com/api.php";
const apiLimit = 1_000_000;
const apiWindowDays = 28;

/**
 * Performs the response body operation for the sismik client application service module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function responseBody(value: unknown): ApiResponse | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  return {
    status: typeof body.status === "string" ? body.status : undefined,
    earthquakes: Array.isArray(body.earthquakes) ? body.earthquakes : undefined,
    message: typeof body.message === "string" ? body.message : undefined,
  };
}

/**
 * Creates sismik harita client for the sismik client application service module, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function createSismikHaritaClient(options: SismikHaritaClientOptions = {}) {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? (() => new Date());
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));

  /**
   * Fetches window for the sismik client application service module, including the validation and edge cases encoded by its typed contract.
   *
   * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
   */
  async function fetchWindow(dateFrom: string, dateTo: string, attempt = 0): Promise<RawCatalogEarthquake[]> {
    const parameters = new URLSearchParams({ date_from: dateFrom, date_to: dateTo, limit: String(apiLimit) });
    const headers: Record<string, string> = { Accept: "application/json", "User-Agent": "TurkiyeEarthquakeForecast/2.0" };
    if (options.apiKey) headers.Authorization = `Bearer ${options.apiKey}`;
    try {
      const response = await fetcher(`${apiUrl}?${parameters}`, { headers, cache: "no-store", signal: AbortSignal.timeout(20_000) });
      if (!response.ok) throw new Error(`Sismik Harita returned HTTP ${response.status}`);
      const body = responseBody(await response.json());
      if (body?.status !== "success" || !body.earthquakes) throw new Error(body?.message ?? "Sismik Harita response did not include earthquakes.");
      return body.earthquakes as RawCatalogEarthquake[];
    } catch (error) {
      if (attempt >= 2 || (error instanceof Error && error.message.includes("HTTP 429"))) throw error;
      await sleep(500 * 2 ** attempt);
      return fetchWindow(dateFrom, dateTo, attempt + 1);
    }
  }

  /**
   * Fetches latest events for the sismik client application service module, including the validation and edge cases encoded by its typed contract.
   *
   * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
   */
  async function fetchLatestEvents(startTimestamp: number): Promise<RawCatalogEarthquake[]> {
    let cursor = Date.parse(`${new Date(startTimestamp * 1_000).toISOString().slice(0, 10)}T00:00:00Z`);
    const today = Date.parse(`${now().toISOString().slice(0, 10)}T00:00:00Z`);
    const events: RawCatalogEarthquake[] = [];
    while (cursor <= today) {
      const windowEnd = Math.min(today, cursor + (apiWindowDays - 1) * MILLISECONDS_PER_DAY);
      events.push(...await fetchWindow(new Date(cursor).toISOString().slice(0, 10), new Date(windowEnd).toISOString().slice(0, 10)));
      cursor = windowEnd + MILLISECONDS_PER_DAY;
    }
    return events;
  }

  return { fetchLatestEvents };
}
