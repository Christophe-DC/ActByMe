import { RoleGate } from "../../../../components/auth/role-gate";
import { ActorOnboardingShell } from "../../../../components/onboarding/actor-onboarding-shell";

export default function ActorConsentOnboardingPage() {
  return (
    <RoleGate allowedRoles={["ACTOR"]}>
      <ActorOnboardingShell step="consent" />
    </RoleGate>
  );
}
