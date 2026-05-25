import * as React from "react";

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={
        "rounded-lg border border-[#1F2937] bg-[#111827] p-4 shadow-sm " + (className ?? "")
      }
      {...props}
    >
      {children}
    </div>
  );
}
