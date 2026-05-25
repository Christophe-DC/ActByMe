import type { UserRole } from "@actbyme/shared";
import type { Request } from "express";

export type AuthenticatedUser = {
  id: string;
  role: UserRole;
};

export type RequestWithUser = Request & {
  user?: AuthenticatedUser;
};
