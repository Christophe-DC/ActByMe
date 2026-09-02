export type PresignedUploadRequest = {
  contentType: string;
  fileName: string;
  pathPrefix?: string;
  namespace:
    | "actor-profile-image"
    | "actor-video"
    | "actor-private-video"
    | "performance-take"
    | "platform-asset"
    | "actor-delivery";
};

export type StoredObjectInfo = {
  contentType?: string;
  sizeBytes?: number;
};

export type PresignedUpload = {
  assetUrl: string;
  bucket: string;
  fields?: Record<string, string>;
  key: string;
  method: "PUT" | "POST";
  path: string;
  token?: string;
  uploadUrl: string;
};

export interface StorageClient {
  createPresignedUpload(request: PresignedUploadRequest): Promise<PresignedUpload>;
  createSignedReadUrl(key: string, expiresInSeconds: number): Promise<string>;
  deleteObject(key: string): Promise<void>;
  getObjectInfo(key: string): Promise<StoredObjectInfo>;
  getPublicUrl(key: string): string;
}

export const STORAGE_CLIENT = Symbol("STORAGE_CLIENT");
