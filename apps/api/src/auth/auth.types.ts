import type { UserRole } from "@actbyme/shared";
import type { Request } from "express";

export type AuthenticatedUser = {
  email?: string;
  id: string;
  role: UserRole;
};

export type RequestWithUser = Request & {
  user?: AuthenticatedUser;
};
