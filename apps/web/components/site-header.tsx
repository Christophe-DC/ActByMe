"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, Clapperboard, Plus, Sparkles } from "lucide-react";
import { AuthModal } from "./auth/auth-modal";
import { notificationsApi, usersApi } from "@/lib/api/client";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

export function SiteHeader() {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasActorProfile, setHasActorProfile] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authOpen, setAuthOpen] = useState(false);
  const isWorkflow = pathname === "/create-performance";
  const isPreview = pathname === "/preview";
  const homeHref = isPreview ? "/preview" : "/";
  const howItWorksHref = isPreview ? "/preview#how-it-works" : "/#how-it-works";

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let active = true;

    async function loadActorWorkspaceState() {
      try {
        const [profile, unread] = await Promise.all([
          usersApi.me(),
          notificationsApi.unreadCount(),
        ]);
        if (active) {
          setHasActorProfile(Boolean(profile.actorProfile));
          setUnreadCount(unread.count);
        }
      } catch {
        if (active) {
          setHasActorProfile(false);
          setUnreadCount(0);
        }
      }
    }

    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!active) return;

      const authenticated = Boolean(session?.user);
      setIsAuthenticated(authenticated);
      if (!authenticated) {
        setHasActorProfile(false);
        setUnreadCount(0);
        return;
      }
      await loadActorWorkspaceState();
    }

    void loadSession();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const authenticated = Boolean(session?.user);
      setIsAuthenticated(authenticated);
      if (!authenticated) {
        setHasActorProfile(false);
        setUnreadCount(0);
        return;
      }
      window.setTimeout(() => void loadActorWorkspaceState(), 0);
    });
    const refreshNotifications = () => void loadActorWorkspaceState();
    window.addEventListener("actbyme:notifications-changed", refreshNotifications);

    return () => {
      active = false;
      subscription.unsubscribe();
      window.removeEventListener("actbyme:notifications-changed", refreshNotifications);
    };
  }, []);

  if (pathname === "/") return null;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#070A12]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-4 md:px-6 lg:px-10">
          <Link
            className="flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-80"
            href={homeHref}
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
              href="/projects"
            >
              Projects
            </Link>
            <Link
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-[#a3a3b8] transition hover:bg-white/[0.04] hover:text-white"
              href={howItWorksHref}
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
              <Link
                aria-label="Create a new performance project"
                className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-[#a3a3b8] transition hover:border-white/20 hover:text-white"
                href="/create-performance?new=1"
                title="Create a new performance project"
              >
                <Plus className="size-3.5" />
                <span className="hidden sm:inline">New Project</span>
              </Link>
            )}

            {isAuthenticated ? (
              <>
                {hasActorProfile ? (
                  <Link
                    aria-label={
                      unreadCount
                        ? `Actor workspace, ${unreadCount} unread request${unreadCount === 1 ? "" : "s"}`
                        : "Actor workspace"
                    }
                    className="relative inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm font-semibold text-[#e4e4ef] transition hover:border-amber-300/30 hover:text-white"
                    href="/performances"
                    title="Actor workspace"
                  >
                    <Bell className="size-4 text-amber-300" />
                    <span className="hidden xl:inline">Actor workspace</span>
                    {unreadCount ? (
                      <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-amber-300 px-1.5 py-0.5 text-[11px] font-bold leading-none text-black">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    ) : null}
                  </Link>
                ) : null}
                <Link
                  className="inline-flex h-10 items-center rounded-lg border border-white/10 px-3.5 text-sm font-semibold text-white transition hover:border-white/20"
                  href="/profile"
                >
                  Profile
                </Link>
              </>
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
