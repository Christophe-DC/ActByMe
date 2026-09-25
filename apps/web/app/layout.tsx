import type { Metadata } from "next";
import { PublicFooter } from "@actbyme/ui";
import { SiteHeader } from "../components/site-header";
import { QueryClientProvider } from "../lib/providers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://actbyme.com"),

  title: "ActByMe",
  description: "Actor-first profiles for AI-powered video production.",

  openGraph: {
    title: "ActByMe",
    description: "Actor-first profiles for AI-powered video production.",
    type: "website",
    siteName: "ActByMe",

    images: [
      {
        url: "/actbyme-og.png",
        width: 1200,
        height: 630,
        alt: "ActByMe",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "ActByMe",
    description: "Real human performance for AI-generated video.",
    images: ["/actbyme-og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html data-scroll-behavior="smooth" lang="en">
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
