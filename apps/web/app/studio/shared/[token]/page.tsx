import type { Metadata } from "next";
import { SharedStudio } from "@/components/director-studio/shared-studio";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Shared scene | ActByMe",
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}
export default async function SharedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SharedStudio token={token} />;
}
