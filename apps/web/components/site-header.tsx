"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Clapperboard } from "lucide-react";
import { Button } from "@actbyme/ui";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { normalizeAccountRole, type AccountRole } from "@/lib/auth/roles";

type HeaderState =
  | { isAuthenticated: false; role: null }
  | { isAuthenticated: true; role: AccountRole };

export function SiteHeader() {
  const [state, setState] = useState<HeaderState>({ isAuthenticated: false, role: null });

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    let active = true;

    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) {
        return;
      }

      if (!session?.user) {
        setState({ isAuthenticated: false, role: null });
        return;
      }

      setState({
        isAuthenticated: true,
        role: normalizeAccountRole(session.user.user_metadata?.role),
      });
    }

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setState({ isAuthenticated: false, role: null });
        return;
      }

      setState({
        isAuthenticated: true,
        role: normalizeAccountRole(session.user.user_metadata?.role),
      });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <header className="flex items-center justify-between border-b border-[#1F2937] px-6 py-4">
      <Link className="flex items-center gap-3" href="/">
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#6366F1]">
          <Clapperboard className="size-5 text-white" />
        </span>
        <span className="text-lg font-semibold text-[#F9FAFB]">ActByMe</span>
      </Link>

      <nav className="flex items-center gap-2 sm:gap-3">
        <Button asChild variant="ghost">
          <Link href="/actors">Actors</Link>
        </Button>
        {state.isAuthenticated ? <AuthenticatedLinks role={state.role} /> : <AnonymousLinks />}
      </nav>
    </header>
  );
}

function AnonymousLinks() {
  return (
    <>
      <Button asChild variant="ghost">
        <Link href="/join">I&apos;am an actor</Link>
      </Button>
      <Button asChild variant="outline">
        <Link href="/login">Login</Link>
      </Button>
    </>
  );
}

function AuthenticatedLinks({ role }: { role: AccountRole }) {
  if (role === "ACTOR") {
    return (
      <Button asChild variant="outline">
        <Link href="/profile">Profile</Link>
      </Button>
    );
  }

  if (role === "CLIENT" || role === "AGENCY") {
    return (
      <Button asChild variant="outline">
        <Link href="/agency-access">Request access</Link>
      </Button>
    );
  }

  return (
    <>
      <Button asChild variant="ghost">
        <Link href="/profile">Profile</Link>
      </Button>
      <Button asChild variant="outline">
        <Link href="/agency-access">Request access</Link>
      </Button>
    </>
  );
}
