import { RoleGate } from "../../../../components/auth/role-gate";
import { ActorOnboardingShell } from "../../../../components/onboarding/actor-onboarding-shell";

export default function ActorVideosOnboardingPage() {
  return (
    <RoleGate>
      <ActorOnboardingShell step="videos" />
    </RoleGate>
  );
}
