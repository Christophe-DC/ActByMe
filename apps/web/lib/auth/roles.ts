export type AccountRole = "ACTOR" | "CLIENT" | "AGENCY";

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
  if (value === "CLIENT" || value === "AGENCY" || value === "ACTOR") {
    return value;
  }

  return "ACTOR";
}

export function destinationForRole(role: AccountRole) {
  return role === "ACTOR" ? "/onboarding/actor" : "/agency-access";
}
