import * as React from "react";

export function SkillBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border border-[#1F2937] bg-[#111827] px-3 py-1 text-sm text-[#9CA3AF] ${className ?? ""}`}
    >
      {label}
    </span>
  );
}
