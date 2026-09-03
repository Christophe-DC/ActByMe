import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  PresignedUpload,
  PresignedUploadRequest,
  StorageClient,
  StoredObjectInfo,
} from "./storage.types.js";

@Injectable()
export class S3CompatibleStorageService implements StorageClient {
  constructor(private readonly config: ConfigService) {}

  async createPresignedUpload(request: PresignedUploadRequest): Promise<PresignedUpload> {
    const key = `${request.pathPrefix ?? request.namespace}/${Date.now()}-${sanitizeFileName(request.fileName)}`;
    const endpoint = this.config.get<string>("S3_PUBLIC_ENDPOINT", "https://storage.actbyme.local");

    return {
      assetUrl: this.getPublicUrl(key),
      bucket: "s3-placeholder",
      key,
      method: "PUT",
      path: key,
      uploadUrl: `${endpoint.replace(/\/$/, "")}/placeholder-upload/${key}`,
    };
  }

  async createSignedReadUrl(_key: string, _expiresInSeconds: number): Promise<string> {
    throw new Error("Signed S3-compatible reads are not implemented yet.");
  }

  async deleteObject(_key: string): Promise<void> {
    throw new Error("S3-compatible object deletion is not implemented yet.");
  }

  async downloadObject(_key: string): Promise<Uint8Array> {
    throw new Error("S3-compatible object downloads are not implemented yet.");
  }

  async getObjectInfo(_key: string): Promise<StoredObjectInfo> {
    throw new Error("S3-compatible object metadata is not implemented yet.");
  }

  getPublicUrl(key: string): string {
    const endpoint = this.config.get<string>("S3_PUBLIC_ENDPOINT");
    const bucket = this.config.get<string>("S3_BUCKET");

    if (!endpoint || !bucket) {
      return key;
    }

    return `${endpoint.replace(/\/$/, "")}/${bucket}/${key}`;
  }
}

function sanitizeFileName(fileName: string) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 120);
}
