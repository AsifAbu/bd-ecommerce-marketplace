import { AwsClient } from "aws4fetch";

/**
 * Minimal S3 adapter (MinIO locally, any S3-compatible store in production).
 * Private bucket only: objects are never public; read them through short-lived signed URLs.
 * Path-style URLs: {S3_ENDPOINT}/{bucket}/{key}.
 */
export interface StorageConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  privateBucket: string;
}

export function loadStorageConfig(env: Record<string, string | undefined> = process.env): StorageConfig {
  const required = ["S3_ENDPOINT", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_BUCKET_PRIVATE"] as const;
  const missing = required.filter((k) => !env[k]);
  if (missing.length) throw new Error(`Storage not configured: missing ${missing.join(", ")}`);
  return {
    endpoint: env.S3_ENDPOINT!.replace(/\/+$/, ""),
    region: env.S3_REGION || "us-east-1",
    accessKeyId: env.S3_ACCESS_KEY_ID!,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    privateBucket: env.S3_BUCKET_PRIVATE!,
  };
}

export const SIGNED_URL_TTL_SECONDS = 300;

export function createStorage(config: StorageConfig, fetchImpl: typeof fetch = fetch) {
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: config.region,
    retries: 0,
  });
  const bucketUrl = `${config.endpoint}/${encodeURIComponent(config.privateBucket)}`;
  const objectUrl = (key: string) => `${bucketUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;

  async function send(url: string, init: RequestInit) {
    const signed = await client.sign(url, init);
    return fetchImpl(signed);
  }

  let bucketReady: Promise<void> | undefined;

  /** Creates the private bucket if it does not exist (idempotent, memoised per process). */
  function ensureBucket(): Promise<void> {
    bucketReady ??= (async () => {
      const head = await send(bucketUrl, { method: "HEAD" });
      if (head.ok) return;
      if (head.status !== 404) throw new Error(`Storage: bucket check failed (${head.status})`);
      const created = await send(bucketUrl, { method: "PUT" });
      // 409: created concurrently by another process.
      if (!created.ok && created.status !== 409) throw new Error(`Storage: bucket create failed (${created.status})`);
    })().catch((err) => {
      bucketReady = undefined;
      throw err;
    });
    return bucketReady;
  }

  async function putObject(key: string, body: ArrayBuffer | Uint8Array, contentType: string): Promise<void> {
    await ensureBucket();
    const res = await send(objectUrl(key), {
      method: "PUT",
      body: body as BodyInit,
      headers: { "content-type": contentType || "application/octet-stream" },
    });
    if (!res.ok) throw new Error(`Storage: upload failed (${res.status})`);
  }

  /** Short-lived GET URL for a private object. */
  async function getSignedUrl(key: string, expiresInSeconds = SIGNED_URL_TTL_SECONDS): Promise<string> {
    const url = new URL(objectUrl(key));
    url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));
    const signed = await client.sign(url.toString(), { method: "GET", aws: { signQuery: true } });
    return signed.url;
  }

  /** Deletes an object (S3 answers 204 even when it does not exist). */
  async function deleteObject(key: string): Promise<void> {
    const res = await send(objectUrl(key), { method: "DELETE" });
    if (!res.ok && res.status !== 404) throw new Error(`Storage: delete failed (${res.status})`);
  }

  return { ensureBucket, putObject, getSignedUrl, deleteObject };
}

export type Storage = ReturnType<typeof createStorage>;

const globalForStorage = globalThis as unknown as { storage?: Storage };

/** Shared storage for app code (configured from env on first use). */
export function getStorage(): Storage {
  globalForStorage.storage ??= createStorage(loadStorageConfig());
  return globalForStorage.storage;
}
