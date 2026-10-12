import type { Metadata } from "next";
import Link from "next/link";
import { studioDemoScene } from "@actbyme/shared";
import { StudioPlayer } from "@/components/director-studio/studio-player";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Director Studio 3D demo | ActByMe",
    description: "Explore a three-character animated scene with four camera angles.",
  };
}
export default function StudioDemoPage() {
  return (
    <main className="min-h-screen bg-[#0b0b0d] p-4 text-white sm:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/create-performance" className="text-sm text-amber-200">
          Open your performance project
        </Link>
        <h1 className="text-3xl font-semibold">Director Studio 3D</h1>
        <p className="text-amber-200">
          Demo scene · fictional characters · three roles and four camera angles
        </p>
        <StudioPlayer scene={studioDemoScene} />
      </div>
    </main>
  );
}
