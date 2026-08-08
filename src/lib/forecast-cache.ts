/**
 * @fileoverview Defines the forecast cache application service module and makes its contracts, integration responsibilities, side effects, and fallback behavior explicit to maintainers.
 */
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ensureCachedFile, listCacheKeys, writeCachedFile } from "./b2-cache";
import { FORECAST_CACHE_PREFIX, FORECAST_FILE_PREFIX, validForecastBundle, type ForecastBundle } from "./forecast-bundle";

export interface StoredBundle {
  bundle: ForecastBundle;
  cache: "tmp" | "bundle";
}

export interface ForecastBundleStore {
  read: (dayTrt: string) => Promise<StoredBundle | null>;
  findLatest: (beforeDayTrt: string) => Promise<StoredBundle | null>;
  runExclusive: (dayTrt: string, task: () => Promise<ForecastBundle>) => Promise<ForecastBundle>;
  write: (bundle: ForecastBundle) => Promise<ForecastBundle>;
}

export interface ForecastBundleStoreOptions {
  temporaryDirectory?: string;
  bundledDirectory?: string;
  staleLockMilliseconds?: number;
  waitMilliseconds?: number;
  pollMilliseconds?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  ensureFile?: typeof ensureCachedFile;
  listKeys?: typeof listCacheKeys;
  writeFile?: typeof writeCachedFile;
}

/**
 * Creates forecast bundle store for the forecast cache application service module, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function createForecastBundleStore(options: ForecastBundleStoreOptions = {}): ForecastBundleStore {
  const temporaryDirectory = options.temporaryDirectory ?? os.tmpdir();
  const bundledDirectory = options.bundledDirectory ?? path.join(process.cwd(), "data", "snapshots");
  const staleLockMilliseconds = options.staleLockMilliseconds ?? 5 * 60 * 1_000;
  const waitMilliseconds = options.waitMilliseconds ?? 4 * 60 * 1_000;
  const pollMilliseconds = options.pollMilliseconds ?? 500;
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const ensureFile = options.ensureFile ?? ensureCachedFile;
  const listKeys = options.listKeys ?? listCacheKeys;
  const writeFile = options.writeFile ?? writeCachedFile;
  /**
   * Performs the file path operation for the forecast cache application service module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
   *
   * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
   */
  const filePath = (dayTrt: string) => path.join(temporaryDirectory, `${FORECAST_FILE_PREFIX}-${dayTrt}.json`);
  /**
   * Performs the lock path operation for the forecast cache application service module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
   *
   * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
   */
  const lockPath = (dayTrt: string) => `${filePath(dayTrt)}.lock`;
  /**
   * Performs the remote key operation for the forecast cache application service module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
   *
   * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
   */
  const remoteKey = (name: string) => `${FORECAST_CACHE_PREFIX}/${name}`;

  /**
   * Orders same-day candidates by monotonic catalogue coverage before using timestamps as deterministic tie breakers.
   *
   * Immutable candidate objects prevent a slower serverless instance with fewer events from overwriting a more complete daily forecast produced concurrently.
   */
  function compareFreshness(left: ForecastBundle, right: ForecastBundle): number {
    return left.catalogMetadata.eventCount - right.catalogMetadata.eventCount
      || Date.parse(left.catalogMetadata.newestEventAtUtc) - Date.parse(right.catalogMetadata.newestEventAtUtc)
      || Date.parse(left.catalogMetadata.dataUpdatedAtUtc) - Date.parse(right.catalogMetadata.dataUpdatedAtUtc)
      || Date.parse(left.generatedAtUtc) - Date.parse(right.generatedAtUtc);
  }

  /**
   * Reads path for the forecast cache application service module, including the validation and edge cases encoded by its typed contract.
   *
   * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
   */
  async function readPath(localPath: string, expectedDayTrt?: string): Promise<ForecastBundle | null> {
    try {
      const parsed = JSON.parse(await fs.readFile(localPath, "utf8")) as unknown;
      return validForecastBundle(parsed, expectedDayTrt) ? parsed : null;
    } catch {
      return null;
    }
  }

  /**
   * Reads read for the forecast cache application service module, including the validation and edge cases encoded by its typed contract.
   *
   * Bundled immutable snapshots in data/snapshots are checked first and win whenever present, so deployed historical dates never recompute.
   * The remote scan is skipped when a bundled candidate already matched, because bundled snapshots are always the freshest possible copy
   * and a same-key daily is caught by the local scan before the freshness comparison.
   */
  async function read(dayTrt: string): Promise<StoredBundle | null> {
    const namePrefix = `${FORECAST_FILE_PREFIX}-${dayTrt}`;
    const matchesName = (name: string) => name.startsWith(namePrefix) && name.endsWith(".json");
    const candidates: StoredBundle[] = [];
    for (const name of (await fs.readdir(bundledDirectory).catch(() => [])).filter(matchesName)) {
      const bundle = await readPath(path.join(bundledDirectory, name), dayTrt);
      if (bundle) candidates.push({ bundle, cache: "bundle" });
    }
    const bundledMatched = candidates.length > 0;
    for (const name of (await fs.readdir(temporaryDirectory).catch(() => [])).filter(matchesName)) {
      const bundle = await readPath(path.join(temporaryDirectory, name), dayTrt);
      if (bundle) candidates.push({ bundle, cache: "tmp" });
    }
    if (!bundledMatched) {
      for (const name of (await listKeys(FORECAST_CACHE_PREFIX).catch(() => [])).map((key) => path.basename(key)).filter(matchesName)) {
        const localPath = path.join(temporaryDirectory, name);
        await ensureFile(localPath, remoteKey(name));
        const bundle = await readPath(localPath, dayTrt);
        if (bundle) candidates.push({ bundle, cache: "tmp" });
      }
    }
    return candidates.sort((left, right) => compareFreshness(right.bundle, left.bundle))[0] ?? null;
  }

  /**
   * Finds latest for the forecast cache application service module, including the validation and edge cases encoded by its typed contract.
   *
   * Only unfiltered daily bundles (no cutoff) are candidates: historical snapshots, bundled or not, must never be served as the stale
   * fallback for the current day.
   */
  async function findLatest(beforeDayTrt: string): Promise<StoredBundle | null> {
    try {
      const prefix = `${FORECAST_FILE_PREFIX}-`;
      const matchesName = (name: string) => name.startsWith(prefix) && name.endsWith(".json");
      const sources = [
        ...(await fs.readdir(bundledDirectory).catch(() => [])).filter(matchesName).map((name) => ({ name, localPath: path.join(bundledDirectory, name), cache: "bundle" as const, remote: false })),
        ...(await fs.readdir(temporaryDirectory).catch(() => [])).filter(matchesName).map((name) => ({ name, localPath: path.join(temporaryDirectory, name), cache: "tmp" as const, remote: false })),
        ...(await listKeys(FORECAST_CACHE_PREFIX).catch(() => [])).map((key) => path.basename(key)).filter(matchesName).map((name) => ({ name, localPath: path.join(temporaryDirectory, name), cache: "tmp" as const, remote: true })),
      ];
      const candidates: StoredBundle[] = [];
      for (const source of [...new Set(sources.map((entry) => entry.name))].sort().reverse()) {
        const entry = sources.find((candidate) => candidate.name === source);
        if (!entry) continue;
        if (entry.remote) await ensureFile(entry.localPath, remoteKey(entry.name));
        const bundle = await readPath(entry.localPath);
        if (bundle && bundle.dayTrt < beforeDayTrt && (bundle.cutoffSeconds ?? null) === null) candidates.push({ bundle, cache: entry.cache });
      }
      return candidates.sort((left, right) => right.bundle.dayTrt.localeCompare(left.bundle.dayTrt) || compareFreshness(right.bundle, left.bundle))[0] ?? null;
    } catch {
      return null;
    }
    return null;
  }

  /**
   * Performs the wait for operation for the forecast cache application service module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
   *
   * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
   */
  async function waitFor(dayTrt: string): Promise<ForecastBundle | null> {
    const started = Date.now();
    while (Date.now() - started < waitMilliseconds) {
      const stored = await read(dayTrt);
      if (stored) return stored.bundle;
      try {
        const lock = await fs.stat(lockPath(dayTrt));
        if (Date.now() - lock.mtimeMs > staleLockMilliseconds) {
          await fs.unlink(lockPath(dayTrt)).catch(() => undefined);
          return null;
        }
      } catch {
        return null;
      }
      await sleep(pollMilliseconds);
    }
    throw new Error("The daily forecast is still being generated. Please retry shortly.");
  }

  /**
   * Performs the run exclusive operation for the forecast cache application service module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
   *
   * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
   */
  async function runExclusive(dayTrt: string, task: () => Promise<ForecastBundle>): Promise<ForecastBundle> {
    let lockHandle: Awaited<ReturnType<typeof fs.open>> | null = null;
    try {
      try {
        lockHandle = await fs.open(lockPath(dayTrt), "wx");
        await lockHandle.writeFile(JSON.stringify({ pid: process.pid, createdAtUtc: new Date().toISOString() }));
      } catch (error) {
        const code = error instanceof Error && "code" in error ? (error as NodeJS.ErrnoException).code : undefined;
        if (code !== "EEXIST") throw error;
        const completed = await waitFor(dayTrt);
        if (completed) return completed;
        lockHandle = await fs.open(lockPath(dayTrt), "wx");
      }
      const existing = await read(dayTrt);
      return existing?.bundle ?? await task();
    } finally {
      await lockHandle?.close().catch(() => undefined);
      if (lockHandle) await fs.unlink(lockPath(dayTrt)).catch(() => undefined);
    }
  }

  /**
   * Writes write for the forecast cache application service module, including the validation and edge cases encoded by its typed contract.
   *
   * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
   */
  async function write(bundle: ForecastBundle): Promise<ForecastBundle> {
    const name = `${FORECAST_FILE_PREFIX}-${bundle.dayTrt}-${randomUUID()}.json`;
    const localPath = path.join(temporaryDirectory, name);
    const storedRemotely = await writeFile(localPath, remoteKey(name), JSON.stringify(bundle));
    if (process.env.VERCEL && !storedRemotely) {
      await fs.unlink(localPath).catch(() => undefined);
      throw new Error("The daily forecast candidate could not be persisted to B2.");
    }
    return (await read(bundle.dayTrt))?.bundle ?? bundle;
  }

  return { read, findLatest, runExclusive, write };
}
