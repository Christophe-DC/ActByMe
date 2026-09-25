import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { UserRole } from "@actbyme/shared";
import { RolesGuard } from "./roles.guard.js";

function createGuard(input: {
  requiredRoles: UserRole[];
  persistedRole?: UserRole | null;
  appMetadataRole?: UserRole | null;
  userMetadataRole?: UserRole | null;
}) {
  const reflector = {
    getAllAndOverride: () => input.requiredRoles,
  };
  const supabase = {
    admin: {
      auth: {
        getUser: async () => ({
          data: {
            user: {
              app_metadata: input.appMetadataRole ? { role: input.appMetadataRole } : {},
              email: "person@example.com",
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              user_metadata: input.userMetadataRole ? { role: input.userMetadataRole } : {},
            },
          },
          error: null,
        }),
      },
    },
  };
  const prisma = {
    client: {
      user: {
        findUnique: async () =>
          input.persistedRole ? { role: input.persistedRole } : null,
      },
    },
  };
  return new RolesGuard(reflector as never, supabase as never, prisma as never);
}

function context(request: Record<string, unknown> = {}) {
  return {
    getClass: () => class TestController {},
    getHandler: () => function handler() {},
    switchToHttp: () => ({
      getRequest: () => ({
        headers: {
          authorization: "Bearer valid-token",
        },
        ...request,
      }),
    }),
  } as never;
}

test("user_metadata cannot escalate a normal account to admin", async () => {
  const guard = createGuard({
    requiredRoles: [UserRole.Admin],
    userMetadataRole: UserRole.Admin,
  });

  await assert.rejects(() => guard.canActivate(context()), ForbiddenException);
});

test("persisted application role wins over Supabase app metadata", async () => {
  const guard = createGuard({
    requiredRoles: [UserRole.Admin],
    persistedRole: UserRole.Client,
    appMetadataRole: UserRole.Admin,
  });

  await assert.rejects(() => guard.canActivate(context()), ForbiddenException);
});

test("trusted app_metadata can bootstrap an admin before a local user row exists", async () => {
  const guard = createGuard({
    requiredRoles: [UserRole.Admin],
    appMetadataRole: UserRole.Admin,
  });

  assert.equal(await guard.canActivate(context()), true);
});

test("non-admin roles are enforced when a route declares them", async () => {
  const guard = createGuard({
    requiredRoles: [UserRole.Actor],
    persistedRole: UserRole.Client,
  });

  await assert.rejects(() => guard.canActivate(context()), ForbiddenException);
});
