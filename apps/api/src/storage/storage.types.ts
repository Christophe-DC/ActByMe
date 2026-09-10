export type PresignedUploadRequest = {
  contentType: string;
  fileName: string;
  namespace:
    | "actor-profile-image"
    | "actor-video"
    | "actor-private-video"
    | "platform-asset"
    | "actor-delivery";
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
  deleteObject(key: string): Promise<void>;
  getPublicUrl(key: string): string;
}

export const STORAGE_CLIENT = Symbol("STORAGE_CLIENT");
