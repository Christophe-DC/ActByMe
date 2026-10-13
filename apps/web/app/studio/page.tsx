import type { Metadata } from "next";
import { RoleGate } from "@/components/auth/role-gate";
import { StudioHome } from "@/components/director-studio/studio-home";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Director Studio | ActByMe",
    description: "Create, edit and share animated scenes without 3D experience.",
  };
}
export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const params = await searchParams;
  return (
    <RoleGate>
      <StudioHome projectId={params.project} />
    </RoleGate>
  );
}
