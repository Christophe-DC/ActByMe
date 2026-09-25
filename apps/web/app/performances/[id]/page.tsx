import { RoleGate } from "@/components/auth/role-gate";
import { PerformanceRequestDetail } from "@/components/performances/performance-request-detail";

export default async function PerformancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RoleGate>
      <PerformanceRequestDetail id={id} />
    </RoleGate>
  );
}
