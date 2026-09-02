import * as React from "react";

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={
        "rounded-xl border border-white/[0.06] bg-[#0F1422] p-4 shadow-sm " + (className ?? "")
      }
      {...props}
    >
      {children}
    </div>
  );
}
