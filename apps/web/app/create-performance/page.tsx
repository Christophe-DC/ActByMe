import { SimplifiedPerformanceApp } from "../../components/workflow/simplified-performance-app";
import { RoleGate } from "../../components/auth/role-gate";

export default function CreatePerformancePage() {
  return (
    <RoleGate>
      <SimplifiedPerformanceApp />
    </RoleGate>
  );
}
