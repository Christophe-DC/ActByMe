import type { Metadata } from "next";
import { PublicFooter } from "@actbyme/ui";
import { SiteHeader } from "../components/site-header";
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
          <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
            <SiteHeader />
            {children}
            <PublicFooter />
          </div>
        </QueryClientProvider>
      </body>
    </html>
  );
}
