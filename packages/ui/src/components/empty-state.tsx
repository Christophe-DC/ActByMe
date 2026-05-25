import * as React from "react";

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-[#1F2937] bg-[#111827] p-6 text-center">
      <div className="text-lg font-semibold text-[#F9FAFB]">{title}</div>
      {description ? <div className="text-sm text-[#9CA3AF]">{description}</div> : null}
    </div>
  );
}
