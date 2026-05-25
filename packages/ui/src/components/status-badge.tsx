import * as React from "react";

export function StatusBadge({ status, className }: { status?: string; className?: string }) {
  const color =
    status === "published" ? "bg-[#10B981]" : status === "draft" ? "bg-[#F59E0B]" : "bg-[#6B7280]";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${color} text-black ${className ?? ""}`}
    >
      {status ?? "unknown"}
    </span>
  );
}
