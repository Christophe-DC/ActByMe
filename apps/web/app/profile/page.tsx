"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BadgeCheck, Clapperboard, LogOut, UserRound } from "lucide-react";
import { Button, Card } from "@actbyme/ui";
import { RoleGate } from "../../components/auth/role-gate";
import { supabase } from "@/lib/supabase/client";
import { normalizeAccountRole, type AccountRole } from "@/lib/auth/roles";

type ProfileState = {
  email: string;
  name: string;
  role: AccountRole;
};

export default function ProfilePage() {
  return (
    <RoleGate allowedRoles={["ACTOR", "CLIENT", "AGENCY"]}>
      <ProfileContent />
    </RoleGate>
  );
}

function ProfileContent() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      setProfile({
        email: user.email ?? "",
        name: user.user_metadata?.stageName ?? user.user_metadata?.name ?? "Actor profile",
        role: normalizeAccountRole(user.user_metadata?.role),
      });
    }

    void loadProfile();
  }, []);

  async function signOut() {
    setIsSigningOut(true);
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#09090B] px-5 py-10 text-[#F9FAFB] md:px-8">
      <section className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm text-[#9CA3AF]">
              <Clapperboard className="size-4 text-[#6366F1]" />
              ActByMe account
            </p>
            <h1 className="mt-3 text-5xl font-semibold leading-none tracking-normal">Profile</h1>
          </div>
          <Button disabled={isSigningOut} onClick={signOut} size="sm" variant="outline">
            <LogOut className="size-4" />
            {isSigningOut ? "Signing out..." : "Sign out"}
          </Button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <span className="flex size-16 items-center justify-center rounded-md bg-[#6366F1]/15 text-[#C7D2FE]">
                <UserRound className="size-8" />
              </span>
              <div>
                <p className="text-sm text-[#9CA3AF]">Signed in as</p>
                <h2 className="text-2xl font-semibold">{profile?.name ?? "Loading..."}</h2>
              </div>
            </div>
            <div className="mt-6 space-y-3 text-sm text-[#D1D5DB]">
              <p>
                <span className="text-[#9CA3AF]">Email:</span> {profile?.email || "Loading..."}
              </p>
              <p>
                <span className="text-[#9CA3AF]">Role:</span> {profile?.role ?? "Loading..."}
              </p>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <BadgeCheck className="size-5 text-[#14B8A6]" />
              <h2 className="text-2xl font-semibold">{workspaceTitle(profile?.role)}</h2>
            </div>
            <p className="mt-4 text-sm leading-7 text-[#9CA3AF]">
              {workspaceDescription(profile?.role)}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              {profile?.role === "CLIENT" || profile?.role === "AGENCY" ? (
                <Button asChild>
                  <Link href="/agency-access">Request access</Link>
                </Button>
              ) : (
                <Button asChild>
                  <Link href="/onboarding/actor">Continue onboarding</Link>
                </Button>
              )}
              <Button asChild variant="outline">
                <Link href="/actors">Browse actors</Link>
              </Button>
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}

function workspaceTitle(role?: AccountRole) {
  if (role === "CLIENT" || role === "AGENCY") {
    return "Client workspace";
  }

  if (role === "ADMIN") {
    return "Admin access";
  }

  return "Actor workspace";
}

function workspaceDescription(role?: AccountRole) {
  if (role === "CLIENT" || role === "AGENCY") {
    return "Browse visual actor profiles and request early access to the client marketplace preview.";
  }

  if (role === "ADMIN") {
    return "Admin accounts can access actor and client flows while the MVP dashboard is being prepared.";
  }

  return "Continue your actor onboarding, update your public profile, and prepare media for your shareable actor page.";
}
