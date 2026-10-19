import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type {
  PresignedUpload,
  PresignedUploadRequest,
  SignedReadOptions,
  StorageClient,
} from "../storage/storage.types.js";

@Injectable()
export class SupabaseService implements StorageClient {
  readonly admin: SupabaseClient;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY;

    if (!url || !secretKey) {
      throw new Error("Missing Supabase backend environment variables.");
    }

    this.admin = createClient(url, secretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  async createPresignedUpload(request: PresignedUploadRequest): Promise<PresignedUpload> {
    const bucket = resolveBucket(request.namespace);

    if (
      ["performance-brief", "performance-take", "virtual-director", "director"].includes(
        request.namespace,
      )
    ) {
      const { data: bucketDetails, error: bucketError } =
        await this.admin.storage.getBucket(bucket);

      if (bucketError) {
        throw bucketError;
      }

      if (bucketDetails.public) {
        throw new Error('The "actor-private" Supabase bucket must not be public.');
      }
    }

    const pathPrefix = sanitizePathPrefix(request.pathPrefix ?? request.namespace);
    const path = `${pathPrefix}/${Date.now()}-${randomUUID()}-${sanitizeFileName(
      request.fileName,
    )}`;
    const { data, error } = await this.admin.storage.from(bucket).createSignedUploadUrl(path);

    if (error) {
      throw error;
    }

    return {
      assetUrl: this.getPublicUrl(`${bucket}/${path}`),
      bucket,
      key: `${bucket}/${path}`,
      method: "PUT",
      path,
      token: data.token,
      uploadUrl: data.signedUrl,
    };
  }

  async createSignedReadUrl(
    key: string,
    expiresInSeconds: number,
    options?: SignedReadOptions,
  ): Promise<string> {
    const { bucket, path } = splitStorageKey(key);
    const { data, error } = await this.admin.storage
      .from(bucket)
      .createSignedUrl(
        path,
        expiresInSeconds,
        options?.downloadFileName ? { download: options.downloadFileName } : undefined,
      );

    if (error) {
      throw error;
    }

    return data.signedUrl;
  }

  async uploadObject(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    const { bucket, path } = splitStorageKey(key);
    if (
      bucket !== "actor-private" ||
      !(path.startsWith("virtual-director/") || path.startsWith("director/"))
    ) {
      throw new Error("Worker uploads must use the private virtual-director namespace.");
    }
    const { data: details, error: bucketError } = await this.admin.storage.getBucket(bucket);
    if (bucketError || details?.public)
      throw new Error("Virtual Director requires a private bucket.");
    const { error } = await this.admin.storage
      .from(bucket)
      .upload(path, bytes, { contentType, upsert: true });
    if (error) throw error;
  }

  async deleteObject(key: string): Promise<void> {
    const { bucket, path } = splitStorageKey(key);
    const { error } = await this.admin.storage.from(bucket).remove([path]);

    if (error) {
      throw error;
    }
  }

  async downloadObject(key: string): Promise<Uint8Array> {
    const { bucket, path } = splitStorageKey(key);
    const { data, error } = await this.admin.storage.from(bucket).download(path);

    if (error) {
      throw error;
    }

    return new Uint8Array(await data.arrayBuffer());
  }

  async getObjectInfo(key: string) {
    const { bucket, path } = splitStorageKey(key);
    const { data, error } = await this.admin.storage.from(bucket).info(path);

    if (error) {
      throw error;
    }

    return {
      contentType: data.contentType,
      sizeBytes: data.size,
    };
  }

  getPublicUrl(key: string): string {
    const { bucket, path } = splitStorageKey(key);
    const { data } = this.admin.storage.from(bucket).getPublicUrl(path);

    return data.publicUrl;
  }
}

function resolveBucket(namespace: PresignedUploadRequest["namespace"]) {
  if (namespace === "actor-profile-image" || namespace === "actor-video") {
    return "actor-public";
  }

  if (namespace === "platform-asset") {
    return "platform-assets";
  }

  if (namespace === "actor-delivery") {
    return "actor-deliveries";
  }

  return "actor-private";
}

function splitStorageKey(key: string) {
  const [bucket, ...pathParts] = key.split("/");
  const path = pathParts.join("/");

  if (!bucket || !path) {
    throw new Error("Storage key must use the format bucket/path.");
  }

  return { bucket, path };
}

function sanitizeFileName(fileName: string) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 120);
}

function sanitizePathPrefix(pathPrefix: string) {
  return pathPrefix
    .split("/")
    .map((part) => part.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/(^-|-$)/g, ""))
    .filter(Boolean)
    .join("/");
}
