import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "@actbyme/shared";
import { SupabaseService } from "../supabase/supabase.service.js";
import type { RequestWithUser } from "./auth.types.js";
import { ROLES_KEY } from "./roles.decorator.js";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabase: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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
      request.user = await this.getSupabaseUser(request);
    }

    if (!request.user) {
      throw new UnauthorizedException(
        "Authentication is required. Use a Supabase bearer token or dev auth headers.",
      );
    }

    if (request.user.role === UserRole.Admin) {
      return true;
    }

    const adminOnly = requiredRoles.every((role) => role === UserRole.Admin);

    if (adminOnly) {
      throw new ForbiddenException("Admin access is required for this resource.");
    }

    return true;
  }

  private async getSupabaseUser(request: RequestWithUser) {
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      return undefined;
    }

    const token = authorization.replace("Bearer ", "");
    const { data, error } = await this.supabase.admin.auth.getUser(token);

    if (error || !data.user) {
      throw new UnauthorizedException("Invalid Supabase token.");
    }

    const metadataRole = data.user.user_metadata?.role;
    const role = Object.values(UserRole).includes(metadataRole)
      ? (metadataRole as UserRole)
      : UserRole.Actor;

    return {
      email: data.user.email,
      id: data.user.id,
      role,
    };
  }
}
