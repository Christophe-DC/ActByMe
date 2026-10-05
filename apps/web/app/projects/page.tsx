import { RoleGate } from "../../components/auth/role-gate";
import { ProjectsList } from "../../components/projects/projects-list";

export default function ProjectsPage() {
  return (
    <RoleGate>
      <ProjectsList />
    </RoleGate>
  );
}
