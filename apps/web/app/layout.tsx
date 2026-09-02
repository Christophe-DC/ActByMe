import type { Metadata } from "next";
import { PublicFooter } from "@actbyme/ui";
import { SiteHeader } from "../components/site-header";
import { QueryClientProvider } from "../lib/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "ActByMe",
  description: "Real human performance for AI-generated video.",
  openGraph: {
    title: "ActByMe",
    description: "Real human performance for AI-generated video.",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html data-scroll-behavior="smooth" lang="en">
      <body>
        <QueryClientProvider>
          <div className="min-h-screen bg-[#070A12] text-[var(--foreground)]">
            <SiteHeader />
            {children}
            <PublicFooter />
          </div>
        </QueryClientProvider>
      </body>
    </html>
  );
}
