import { RoleGate } from "../../../../components/auth/role-gate";
import { ActorOnboardingShell } from "../../../../components/onboarding/actor-onboarding-shell";

export default function ActorCompleteOnboardingPage() {
  return (
    <RoleGate>
      <ActorOnboardingShell step="complete" />
    </RoleGate>
  );
}
