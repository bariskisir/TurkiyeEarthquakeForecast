/**
 * @fileoverview Defines the b2 cache.test Vitest specification, documenting expected success, failure, edge-case, and regression behavior without modifying immutable catalogue data.
 */
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { createCachedFileStore, type RemoteObjectStore } from "@/lib/b2-cache";

const directories: string[] = [];

/**
 * Performs the temporary directory operation for the b2 cache.test Vitest specification, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
async function temporaryDirectory(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "earthquake-cache-test-"));
  directories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe("cached file store", () => {
  test("hydrates, writes, lists and prunes remote objects", async () => {
    const objects = new Map<string, string>([["catalog/updates/old.json", "old"], ["catalog/updates/latest.json", "latest"]]);
    const remote: RemoteObjectStore = {
      /**
       * Downloads one namespaced remote cache object and treats a missing key as an expected cache miss.
       *
       * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
       */
      get: async (key) => objects.has(key) ? new TextEncoder().encode(objects.get(key)) : null,
      /**
       * Collects every remote object under a logical prefix by following all provider continuation tokens.
       *
       * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
       */
      list: async (prefix) => [...objects.keys()].filter((key) => key.startsWith(prefix)),
      /**
       * Uploads binary cache content to one namespaced object key with an explicit content type.
       *
       * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
       */
      put: async (key, body) => { objects.set(key, body); },
      /**
       * Removes one namespaced remote cache object during bounded version pruning.
       *
       * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
       */
      delete: async (key) => { objects.delete(key); },
    };
    const store = createCachedFileStore(() => remote);
    const directory = await temporaryDirectory();
    const hydrated = path.join(directory, "hydrated.json");
    expect(await store.ensureCachedFile(hydrated, "catalog/updates/latest.json")).toBe(true);
    expect(await fs.readFile(hydrated, "utf8")).toBe("latest");
    const written = path.join(directory, "written.json");
    expect(await store.writeCachedFile(written, "catalog/updates/written.json", "written")).toBe(true);
    expect(objects.get("catalog/updates/written.json")).toBe("written");
    await store.pruneCachePrefixToLatest("catalog/updates");
    expect([...objects.keys()].filter((key) => key.endsWith(".json"))).toEqual(["catalog/updates/written.json"]);
  });

  test("keeps local writes operational without remote configuration", async () => {
    const store = createCachedFileStore(() => null);
    const directory = await temporaryDirectory();
    const file = path.join(directory, "local.json");
    expect(await store.writeCachedFile(file, "unused", "local")).toBe(false);
    expect(await fs.readFile(file, "utf8")).toBe("local");
    expect(await store.ensureCachedFile(path.join(directory, "missing.json"), "missing")).toBe(false);
  });

  test("uses tmp without surfacing B2 initialization or request failures", async () => {
    const directory = await temporaryDirectory();
    const invalidConfiguration = createCachedFileStore(() => { throw new Error("invalid B2 configuration"); });
    const localPath = path.join(directory, "configuration-fallback.json");
    expect(await invalidConfiguration.writeCachedFile(localPath, "cache/configuration-fallback.json", "local")).toBe(false);
    expect(await fs.readFile(localPath, "utf8")).toBe("local");
    expect(await invalidConfiguration.listCacheKeys("cache")).toEqual([]);

    const unavailableB2 = createCachedFileStore(() => ({
      get: async () => { throw new Error("B2 unavailable"); },
      list: async () => { throw new Error("B2 unavailable"); },
      put: async () => { throw new Error("B2 unavailable"); },
      delete: async () => { throw new Error("B2 unavailable"); },
    }));
    const fallbackPath = path.join(directory, "request-fallback.json");
    expect(await unavailableB2.ensureCachedFile(fallbackPath, "cache/missing.json")).toBe(false);
    expect(await unavailableB2.writeCachedFile(fallbackPath, "cache/request-fallback.json", "fallback")).toBe(false);
    expect(await fs.readFile(fallbackPath, "utf8")).toBe("fallback");
    expect(await unavailableB2.listCacheKeys("cache")).toEqual([]);
    await expect(unavailableB2.hydrateCacheDirectory(path.join(directory, "hydrated"), "cache")).resolves.toBeUndefined();
    await expect(unavailableB2.pruneCachePrefixToLatest("cache")).resolves.toBeUndefined();
  });

});
