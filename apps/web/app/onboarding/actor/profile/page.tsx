import { RoleGate } from "../../../../components/auth/role-gate";
import { ActorOnboardingShell } from "../../../../components/onboarding/actor-onboarding-shell";

export default function ActorProfileOnboardingPage() {
  return (
    <RoleGate>
      <ActorOnboardingShell step="profile" />
    </RoleGate>
  );
}
