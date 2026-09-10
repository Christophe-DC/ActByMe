import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { PresignedUpload, PresignedUploadRequest, StorageClient } from "./storage.types.js";

@Injectable()
export class S3CompatibleStorageService implements StorageClient {
  constructor(private readonly config: ConfigService) {}

  async createPresignedUpload(request: PresignedUploadRequest): Promise<PresignedUpload> {
    const key = `${request.namespace}/${Date.now()}-${sanitizeFileName(request.fileName)}`;
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

  async deleteObject(_key: string): Promise<void> {
    throw new Error("S3-compatible object deletion is not implemented yet.");
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
