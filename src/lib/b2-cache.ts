/**
 * @fileoverview Defines the b2 cache application service module and makes its contracts, integration responsibilities, side effects, and fallback behavior explicit to maintainers.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export interface RemoteObjectStore {
  get: (key: string) => Promise<Uint8Array | null>;
  list: (prefix: string) => Promise<string[]>;
  put: (key: string, body: string) => Promise<void>;
  delete: (key: string) => Promise<void>;
}

interface B2Configuration {
  bucket: string;
  prefix: string;
  client: S3Client;
}

let configuration: B2Configuration | null | undefined;
let remoteStore: RemoteObjectStore | null | undefined;

/**
 * Performs the get configuration operation for the b2 cache application service module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function getConfiguration(): B2Configuration | null {
  if (configuration !== undefined) return configuration;
  const bucket = process.env.B2_BUCKET_NAME;
  const endpointValue = process.env.B2_ENDPOINT;
  const region = process.env.B2_REGION;
  const accessKeyId = process.env.B2_KEY_ID;
  const secretAccessKey = process.env.B2_APPLICATION_KEY;
  if (!bucket || !endpointValue || !region || !accessKeyId || !secretAccessKey) return configuration = null;
  return configuration = {
    bucket,
    prefix: (process.env.B2_CACHE_PREFIX ?? "turkiye-earthquake-cache/v1").replace(/^\/+|\/+$/g, ""),
    client: new S3Client({
      endpoint: endpointValue.startsWith("http") ? endpointValue : `https://${endpointValue}`,
      region,
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
}

/**
 * Creates remote store for the b2 cache application service module, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function createRemoteStore(config: B2Configuration): RemoteObjectStore {
  /**
   * Performs the object key operation for the b2 cache application service module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
   *
   * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
   */
  const objectKey = (key: string) => `${config.prefix}/${key.replace(/^\/+/, "")}`;
  return {
    /**
     * Downloads one namespaced remote cache object and treats a missing key as an expected cache miss.
     *
     * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
     */
    async get(key) {
      const response = await config.client.send(new GetObjectCommand({ Bucket: config.bucket, Key: objectKey(key) }));
      return response.Body ? response.Body.transformToByteArray() : null;
    },
    /**
     * Collects every remote object under a logical prefix by following all provider continuation tokens.
     *
     * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
     */
    async list(prefix) {
      const remotePrefix = `${objectKey(prefix).replace(/\/+$/, "")}/`;
      const keys: string[] = [];
      let continuationToken: string | undefined;
      do {
        const response = await config.client.send(new ListObjectsV2Command({ Bucket: config.bucket, Prefix: remotePrefix, ContinuationToken: continuationToken }));
        for (const object of response.Contents ?? []) if (object.Key) keys.push(object.Key.slice(config.prefix.length + 1));
        continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
      } while (continuationToken);
      return keys;
    },
    /**
     * Uploads binary cache content to one namespaced object key with an explicit content type.
     *
     * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
     */
    async put(key, body) {
      await config.client.send(new PutObjectCommand({ Bucket: config.bucket, Key: objectKey(key), Body: body, ContentType: "application/json" }));
    },
    /**
     * Removes one namespaced remote cache object during bounded version pruning.
     *
     * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
     */
    async delete(key) {
      await config.client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: objectKey(key) }));
    },
  };
}

/**
 * Performs the get remote store operation for the b2 cache application service module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function getRemoteStore(): RemoteObjectStore | null {
  if (remoteStore !== undefined) return remoteStore;
  const config = getConfiguration();
  return remoteStore = config ? createRemoteStore(config) : null;
}

/**
 * Writes local for the b2 cache application service module, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
async function writeLocal(filePath: string, body: Uint8Array | string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporaryPath, body);
  await fs.rename(temporaryPath, filePath);
}

/**
 * Creates cached file store for the b2 cache application service module, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function createCachedFileStore(remoteProvider: () => RemoteObjectStore | null = getRemoteStore) {
  /**
   * Performs the ensure cached file operation for the b2 cache application service module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
   *
   * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
   */
  async function ensureCachedFile(filePath: string, key: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      const remote = remoteProvider();
      if (!remote) return false;
      try {
        const body = await remote.get(key);
        if (!body) return false;
        await writeLocal(filePath, body);
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Performs the list cache keys operation for the b2 cache application service module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
   *
   * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
   */
  async function listCacheKeys(prefix: string): Promise<string[]> {
    return remoteProvider()?.list(prefix) ?? [];
  }

  /**
   * Prunes cache prefix to latest for the b2 cache application service module, including the validation and edge cases encoded by its typed contract.
   *
   * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
   */
  async function pruneCachePrefixToLatest(prefix: string): Promise<void> {
    const remote = remoteProvider();
    if (!remote) return;
    const keys = (await remote.list(prefix)).filter((key) => key.endsWith(".json")).sort();
    await Promise.all(keys.slice(0, -1).map((key) => remote.delete(key)));
  }

  /**
   * Hydrates cache directory for the b2 cache application service module, including the validation and edge cases encoded by its typed contract.
   *
   * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
   */
  async function hydrateCacheDirectory(directory: string, prefix: string): Promise<void> {
    await fs.mkdir(directory, { recursive: true });
    const keys = await listCacheKeys(prefix);
    await Promise.all(keys.map((key) => ensureCachedFile(path.join(directory, path.basename(key)), key)));
  }

  /**
   * Writes cached file for the b2 cache application service module, including the validation and edge cases encoded by its typed contract.
   *
   * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
   */
  async function writeCachedFile(filePath: string, key: string, body: string): Promise<boolean> {
    await writeLocal(filePath, body);
    const remote = remoteProvider();
    if (!remote) return false;
    try {
      await remote.put(key, body);
      return true;
    } catch {
      return false;
    }
  }

  return { ensureCachedFile, listCacheKeys, pruneCachePrefixToLatest, hydrateCacheDirectory, writeCachedFile };
}

const defaultStore = createCachedFileStore();

export const ensureCachedFile = defaultStore.ensureCachedFile;
export const listCacheKeys = defaultStore.listCacheKeys;
export const pruneCachePrefixToLatest = defaultStore.pruneCachePrefixToLatest;
export const hydrateCacheDirectory = defaultStore.hydrateCacheDirectory;
export const writeCachedFile = defaultStore.writeCachedFile;
