"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Clapperboard } from "lucide-react";
import { AuthModal } from "./auth/auth-modal";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

export function SiteHeader() {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
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

      setIsAuthenticated(Boolean(session?.user));
    }

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session?.user));
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  if (pathname === "/") {
    return null;
  }

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
            {isAuthenticated ? (
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
