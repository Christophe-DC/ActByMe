import { WorkflowApp } from "../../components/workflow/workflow-app";
import { RoleGate } from "../../components/auth/role-gate";

export default function CreatePerformancePage() {
  return (
    <RoleGate>
      <WorkflowApp />
    </RoleGate>
  );
}
