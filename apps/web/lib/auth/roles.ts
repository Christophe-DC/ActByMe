export type AccountRole = "ADMIN" | "ACTOR" | "CLIENT" | "AGENCY";

export const accountRoles: Array<{ label: string; value: AccountRole; description: string }> = [
  {
    description: "Create a public actor profile and access onboarding.",
    label: "Actor",
    value: "ACTOR",
  },
  {
    description: "Request access as a brand, director, or production client.",
    label: "Client",
    value: "CLIENT",
  },
  {
    description: "Request access as an agency or AI video studio.",
    label: "Agency",
    value: "AGENCY",
  },
];

export function normalizeAccountRole(value: unknown): AccountRole {
  if (isAccountRole(value)) {
    return value;
  }

  return "ACTOR";
}

export function isAccountRole(value: unknown): value is AccountRole {
  return value === "ADMIN" || value === "CLIENT" || value === "AGENCY" || value === "ACTOR";
}

export function destinationForRole(role: AccountRole) {
  if (role === "ADMIN") {
    return "/actors";
  }

  return role === "ACTOR" ? "/onboarding/actor" : "/agency-access";
}

export function canAccessRoleGate(role: AccountRole, allowedRoles: AccountRole[]) {
  return role === "ADMIN" || allowedRoles.includes(role);
}
