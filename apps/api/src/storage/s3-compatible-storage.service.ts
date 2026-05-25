import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { PresignedUpload, PresignedUploadRequest, StorageClient } from "./storage.types.js";

@Injectable()
export class S3CompatibleStorageService implements StorageClient {
  constructor(private readonly config: ConfigService) {}

  async createPresignedUpload(_request: PresignedUploadRequest): Promise<PresignedUpload> {
    throw new Error("S3-compatible upload signing is not implemented yet.");
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
