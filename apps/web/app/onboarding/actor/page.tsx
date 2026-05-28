import { RoleGate } from "../../../components/auth/role-gate";
import { ActorOnboardingShell } from "../../../components/onboarding/actor-onboarding-shell";

export default function ActorOnboardingPage() {
  return (
    <RoleGate>
      <ActorOnboardingShell step="basic" />
    </RoleGate>
  );
}
