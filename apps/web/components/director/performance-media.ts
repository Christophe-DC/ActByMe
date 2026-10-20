import { directorApi } from "@/lib/api/client";
export async function uploadPerformanceAsset(
  id: string,
  file: File,
  signal: AbortSignal,
  progress: (message: string) => void,
) {
  progress("Uploading the private performance…");
  const reserved = await directorApi.reserve(id, {
    name: file.name,
    kind: "performance",
    contentType: file.type,
    sizeBytes: file.size,
    rightsBasis:
      "Creator confirmed permission to use this performance for camera planning and reference exports, including its original audio.",
    rightsConfirmed: true,
    aiTransferAllowed: false,
  });
  await directorApi.upload(
    reserved.upload,
    file,
    file.type,
    (value) => progress(`Uploading the private performance… ${Math.round(value)}%`),
    signal,
  );
  let checked = await directorApi.mutate(id, `assets/${reserved.assetId}/complete`);
  const deadline = Date.now() + 90000;
  while (checked.assets.find((asset) => asset.id === reserved.assetId)?.status === "INSPECTING") {
    signal.throwIfAborted();
    if (Date.now() > deadline)
      throw new Error(
        "Verification is taking too long. Reopen the project to check your imported performance.",
      );
    progress("Verifying the original performance…");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    checked = await directorApi.get(id);
  }
  signal.throwIfAborted();
  const asset = checked.assets.find((asset) => asset.id === reserved.assetId);
  if (asset?.status !== "READY" || !asset.duration || asset.duration > 120 || asset.duration < 0.5)
    throw new Error(
      asset?.error ?? "Use a verified performance between 0.5 seconds and 2 minutes.",
    );
  return asset;
}
