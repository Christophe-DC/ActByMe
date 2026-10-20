"use client";
import { useEffect, useState } from "react";
import { Camera } from "lucide-react";
import {
  createPerformanceDocument,
  createPerformanceShot,
  performancePresets,
} from "@actbyme/shared";
export function PerformancePresetArt({ preset }: { preset: string }) {
  const [images, setImages] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    void getPresetImages()
      .then((images) => {
        if (active) setImages(images);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  return images[preset] ? (
    <img src={images[preset]} alt="" width={224} height={126} />
  ) : (
    <Camera size={19} />
  );
}
let pending: Promise<Record<string, string>> | undefined;
function getPresetImages() {
  pending ??= (async () => {
    const { createPerformanceScene } = await import("./performance-scene");
    const canvas = window.document.createElement("canvas"),
      scene = createPerformanceScene(canvas, 224, 126);
    try {
      const document = createPerformanceDocument(),
        images: Record<string, string> = {};
      for (const preset of performancePresets) {
        document.shots = [createPerformanceShot(preset.id, "thumbnail", 3)];
        scene.render(document, 0);
        images[preset.id] = canvas.toDataURL("image/jpeg", 0.8);
      }
      return images;
    } finally {
      scene.dispose(true);
    }
  })();
  return pending;
}
