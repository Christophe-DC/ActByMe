import { RoleGate } from "@/components/auth/role-gate";
import { PerformanceRequestsList } from "@/components/performances/performance-requests-list";

export default function PerformancesPage() {
  return (
    <RoleGate>
      <PerformanceRequestsList />
    </RoleGate>
  );
}
