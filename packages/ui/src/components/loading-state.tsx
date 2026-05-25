import * as React from "react";

export function LoadingState({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-3 w-3 animate-pulse rounded-full bg-[#6366F1]" />
      <div className="text-sm text-[#9CA3AF]">{message}</div>
    </div>
  );
}
