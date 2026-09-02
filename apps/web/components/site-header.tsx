"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Clapperboard, RotateCcw, Sparkles } from "lucide-react";
import { AuthModal } from "./auth/auth-modal";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

export function SiteHeader() {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authOpen, setAuthOpen] = useState(false);
  const isWorkflow = pathname === "/create-performance";

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let active = true;

    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (active) setIsAuthenticated(Boolean(session?.user));
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

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#070A12]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-4 md:px-6 lg:px-10">
          <Link
            className="flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-80"
            href="/"
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#6C4DFF] to-[#5b3fd6] shadow-lg shadow-[#6C4DFF]/20">
              <Clapperboard className="size-5 text-white" strokeWidth={2.2} />
            </span>
            <span className="text-lg font-bold tracking-tight text-white">ActByMe</span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            <Link
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-[#a3a3b8] transition hover:bg-white/[0.04] hover:text-white"
              href="/actors"
            >
              Discover Actors
            </Link>
            <Link
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-[#a3a3b8] transition hover:bg-white/[0.04] hover:text-white"
              href="/create-performance"
            >
              Create Performance
            </Link>
            <Link
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-[#a3a3b8] transition hover:bg-white/[0.04] hover:text-white"
              href="/create-performance"
            >
              Projects
            </Link>
            <Link
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-[#a3a3b8] transition hover:bg-white/[0.04] hover:text-white"
              href="/#how-it-works"
            >
              How It Works
            </Link>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            {!isWorkflow ? (
              <Link
                className="hidden items-center gap-1.5 rounded-lg bg-[#6C4DFF] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[#6C4DFF]/25 transition hover:bg-[#7a5eff] md:flex"
                href="/create-performance"
              >
                <Sparkles className="size-3.5" /> Create Performance
              </Link>
            ) : (
              <button
                aria-label="Create a new performance project"
                className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-[#a3a3b8] transition hover:border-white/20 hover:text-white"
                onClick={() => window.dispatchEvent(new Event("actbyme:new-performance-project"))}
                title="Create a new performance project"
                type="button"
              >
                <RotateCcw className="size-3.5" />
                <span className="hidden sm:inline">New Project</span>
              </button>
            )}

            {isAuthenticated ? (
              <Link
                className="inline-flex h-10 items-center rounded-lg border border-white/10 px-3.5 text-sm font-semibold text-white transition hover:border-white/20"
                href="/profile"
              >
                Profile
              </Link>
            ) : (
              <>
                <button
                  className="inline-flex h-10 items-center rounded-lg border border-white/10 px-3.5 text-sm font-medium text-[#a3a3b8] transition hover:border-white/20 hover:text-white"
                  onClick={() => {
                    setAuthMode("login");
                    setAuthOpen(true);
                  }}
                  type="button"
                >
                  Login
                </button>
                <button
                  className="hidden h-10 items-center rounded-lg bg-white px-3.5 text-sm font-semibold text-[#070A12] transition hover:bg-[#e8e8f0] sm:inline-flex"
                  onClick={() => {
                    setAuthMode("signup");
                    setAuthOpen(true);
                  }}
                  type="button"
                >
                  Sign up
                </button>
              </>
            )}
          </div>
        </div>
      </header>
      <AuthModal initialMode={authMode} onClose={() => setAuthOpen(false)} open={authOpen} />
    </>
  );
}
