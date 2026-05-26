import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service.js";

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token.");
    }

    const token = authorization.replace("Bearer ", "");

    const { data, error } = await this.supabase.admin.auth.getUser(token);

    if (error || !data.user) {
      throw new UnauthorizedException("Invalid Supabase token.");
    }

    request.user = {
      supabaseUserId: data.user.id,
      email: data.user.email,
      metadata: data.user.user_metadata,
    };

    return true;
  }
}
