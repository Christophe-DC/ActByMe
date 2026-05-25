import { Injectable, type NestMiddleware } from "@nestjs/common";
import { UserRole } from "@actbyme/shared";
import type { NextFunction, Request, Response } from "express";
import type { RequestWithUser } from "./auth.types.js";

@Injectable()
export class MockAuthMiddleware implements NestMiddleware {
  use(request: Request, _response: Response, next: NextFunction) {
    const userId = readHeader(request, "x-user-id");
    const userRole = readHeader(request, "x-user-role");

    if (userId && isUuid(userId) && isUserRole(userRole)) {
      (request as RequestWithUser).user = {
        id: userId,
        role: userRole,
      };
    }

    next();
  }
}

function readHeader(request: Request, key: string) {
  const value = request.headers[key];
  return Array.isArray(value) ? value[0] : value;
}

function isUserRole(value: string | undefined): value is UserRole {
  return Object.values(UserRole).includes(value as UserRole);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
