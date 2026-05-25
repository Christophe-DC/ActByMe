import * as React from "react";
import { PublicHeader } from "./public-header";
import { PublicFooter } from "./public-footer";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <PublicHeader />
      <main className="mx-auto w-full max-w-7xl px-6 py-8">{children}</main>
      <PublicFooter />
    </div>
  );
}
