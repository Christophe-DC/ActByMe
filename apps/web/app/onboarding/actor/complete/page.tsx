import { RoleGate } from "../../../../components/auth/role-gate";
import { ActorOnboardingShell } from "../../../../components/onboarding/actor-onboarding-shell";

export default function ActorCompleteOnboardingPage() {
  return (
    <RoleGate allowedRoles={["ACTOR"]}>
      <ActorOnboardingShell step="complete" />
    </RoleGate>
  );
}
