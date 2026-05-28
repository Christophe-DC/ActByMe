import { RoleGate } from "../../../../components/auth/role-gate";
import { ActorOnboardingShell } from "../../../../components/onboarding/actor-onboarding-shell";

export default function ActorConsentOnboardingPage() {
  return (
    <RoleGate>
      <ActorOnboardingShell step="consent" />
    </RoleGate>
  );
}
