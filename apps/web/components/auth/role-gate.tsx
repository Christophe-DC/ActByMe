"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Card } from "@actbyme/ui";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

export function RoleGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<"checking" | "allowed" | "misconfigured">("checking");

  useEffect(() => {
    let active = true;

    async function checkAccess() {
      if (!isSupabaseConfigured) {
        if (active) setState("misconfigured");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;

      if (!user) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      setState("allowed");
    }

    void checkAccess();

    return () => {
      active = false;
    };
  }, [pathname, router]);

  if (state === "allowed") {
    return <>{children}</>;
  }

  if (state === "misconfigured") {
    return (
      <main className="min-h-screen bg-[#09090B] px-5 py-12 text-[#F9FAFB]">
        <Card className="mx-auto max-w-xl p-6">
          <h1 className="text-2xl font-semibold">Authentication is not configured</h1>
          <p className="mt-3 text-sm leading-6 text-[#9CA3AF]">
            Supabase frontend environment variables are missing.
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#09090B] px-5 py-12 text-[#F9FAFB]">
      <Card className="mx-auto max-w-xl p-6">
        <h1 className="text-2xl font-semibold">Checking access</h1>
        <p className="mt-3 text-sm leading-6 text-[#9CA3AF]">
          We are checking your session before opening this page.
        </p>
      </Card>
    </main>
  );
}
