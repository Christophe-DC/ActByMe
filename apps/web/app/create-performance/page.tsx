import { SimplifiedPerformanceApp } from "../../components/workflow/simplified-performance-app";
import { RoleGate } from "../../components/auth/role-gate";

export default async function CreatePerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; project?: string }>;
}) {
  const params = await searchParams;

  return (
    <RoleGate>
      <SimplifiedPerformanceApp
        initialProjectId={params.project}
        startNew={params.new === "1"}
      />
    </RoleGate>
  );
}
