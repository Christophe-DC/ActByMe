"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Clapperboard } from "lucide-react";
import { AuthModal } from "./auth/auth-modal";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { isAccountRole, normalizeAccountRole, type AccountRole } from "@/lib/auth/roles";

type HeaderState =
  | { isAuthenticated: false; role: null }
  | { isAuthenticated: true; role: AccountRole };

export function SiteHeader() {
  const [state, setState] = useState<HeaderState>({ isAuthenticated: false, role: null });
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authOpen, setAuthOpen] = useState(false);

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

      const role = await resolveSessionRole(session.user.user_metadata?.role);

      setState({
        isAuthenticated: true,
        role,
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

      void resolveSessionRole(session.user.user_metadata?.role).then((role) => {
        setState({
          isAuthenticated: true,
          role,
        });
      });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#09090B]/76 px-4 py-3 backdrop-blur-xl md:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link className="flex items-center gap-3" href="/">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#09090B]">
              <Clapperboard className="size-5" />
            </span>
            <span className="text-lg font-semibold text-[#F9FAFB]">ActByMe</span>
          </Link>

          <nav className="flex items-center gap-2">
            <Link
              className="inline-flex h-10 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 text-sm font-medium text-white transition hover:border-white/25 hover:bg-white/10"
              href="/actors"
            >
              Actors
            </Link>
            {state.isAuthenticated ? (
              <AuthenticatedLinks />
            ) : (
              <AnonymousLinks
                onLogin={() => {
                  setAuthMode("login");
                  setAuthOpen(true);
                }}
                onSignup={() => {
                  setAuthMode("signup");
                  setAuthOpen(true);
                }}
              />
            )}
          </nav>
        </div>
      </header>
      <AuthModal initialMode={authMode} onClose={() => setAuthOpen(false)} open={authOpen} />
    </>
  );
}

async function resolveSessionRole(metadataRole: unknown) {
  if (isAccountRole(metadataRole)) {
    return metadataRole;
  }

  const pendingRole = window.localStorage.getItem("actbyme.pendingRole");

  if (isAccountRole(pendingRole)) {
    await supabase.auth.updateUser({ data: { role: pendingRole } });
    window.localStorage.removeItem("actbyme.pendingRole");
    return pendingRole;
  }

  return normalizeAccountRole(metadataRole);
}

function AnonymousLinks({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  return (
    <>
      <button
        className="inline-flex h-10 items-center justify-center rounded-full border border-white/10 bg-transparent px-4 text-sm font-medium text-white transition hover:border-white/25 hover:bg-white/10"
        onClick={onLogin}
        type="button"
      >
        Login
      </button>
      <button
        className="inline-flex h-10 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-[#09090B] transition hover:bg-[#E5E7EB]"
        onClick={onSignup}
        type="button"
      >
        Sign up
      </button>
    </>
  );
}

function AuthenticatedLinks() {
  return (
    <Link
      className="inline-flex h-10 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold !text-[#09090B] transition hover:bg-[#E5E7EB]"
      href="/profile"
    >
      Profile
    </Link>
  );
}
