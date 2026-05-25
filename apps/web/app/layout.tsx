import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "../../../packages/ui/src/components/app-shell";

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
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
