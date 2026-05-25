import type { Metadata } from "next";
import { AppShell } from "@actbyme/ui";
import { QueryClientProvider } from "../lib/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "ActByMe",
  description: "Actor-first profiles for AI-powered video production.",
  openGraph: {
    title: "ActByMe",
    description: "Actor-first profiles for AI-powered video production.",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <QueryClientProvider>
          <AppShell>{children}</AppShell>
        </QueryClientProvider>
      </body>
    </html>
  );
}
