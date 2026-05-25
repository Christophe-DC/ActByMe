import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { UserRole } from "@actbyme/shared";
import type { RequestWithUser } from "./auth.types.js";
import { ROLES_KEY } from "./roles.decorator.js";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();

    if (!request.user) {
      throw new UnauthorizedException("Mock auth headers x-user-id and x-user-role are required.");
    }

    if (!requiredRoles.includes(request.user.role)) {
      throw new ForbiddenException("This user role cannot access this resource.");
    }

    return true;
  }
}
