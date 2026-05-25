export type PresignedUploadRequest = {
  contentType: string;
  fileName: string;
  namespace: "actor-video" | "actor-image";
};

export type PresignedUpload = {
  assetUrl: string;
  fields?: Record<string, string>;
  key: string;
  method: "PUT" | "POST";
  uploadUrl: string;
};

export interface StorageClient {
  createPresignedUpload(request: PresignedUploadRequest): Promise<PresignedUpload>;
  deleteObject(key: string): Promise<void>;
  getPublicUrl(key: string): string;
}

export const STORAGE_CLIENT = Symbol("STORAGE_CLIENT");
