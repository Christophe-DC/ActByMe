import type { Metadata } from "next";
import { RoleGate } from "@/components/auth/role-gate";
import { VirtualDirectorStudio } from "@/components/virtual-director/virtual-director-studio";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "AI Virtual Director | ActByMe",
    description: "Direct, preview and generate camera angles from a private actor performance.",
    robots: { index: false, follow: false },
  };
}
export default async function VirtualDirectorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RoleGate>
      <VirtualDirectorStudio projectId={id} />
    </RoleGate>
  );
}
