"use client";

import * as React from "react";
import { Play } from "lucide-react";
import { motion } from "framer-motion";

export function VideoCard({
  title,
  duration,
  thumbnail,
  onPlay,
}: {
  title: string;
  duration?: string;
  thumbnail?: string;
  onPlay?: () => void;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="group relative overflow-hidden rounded-md"
    >
      <div className="aspect-video rounded-md bg-[#0f1724]">
        {thumbnail ? (
          <img src={thumbnail} alt={title} className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#F9FAFB]">{title}</h3>
          <p className="text-xs text-[#9CA3AF]">{duration ?? "—"}</p>
        </div>
        <button
          aria-label={`Play ${title}`}
          className="inline-flex items-center rounded-md bg-[#6366F1] p-2 text-white"
          onClick={onPlay}
          type="button"
        >
          <Play className="size-4" />
        </button>
      </div>
    </motion.article>
  );
}
