"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Clapperboard,
  Clock3,
  FileJson,
  Film,
  Loader2,
  Move3D,
  Play,
  Plus,
  ShieldCheck,
} from "lucide-react";

import { directorApi, type DirectorActorRequest } from "@/lib/api/client";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { AuthModal } from "@/components/auth/auth-modal";

import { downloadDirectorJson } from "./director-generate";
import { DirectorLoading } from "./director-loading";
import "./director.css";
export function DirectorHome() {
  const router = useRouter();
  const [projects, setProjects] = useState<
      { id: string; title: string; version: number; updatedAt: string }[]
    >([]),
    [requests, setRequests] = useState<DirectorActorRequest[]>([]),
    [userId, setUserId] = useState<string | null>(),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [authOpen, setAuthOpen] = useState(false),
    [error, setError] = useState<string | null>(null),
    [title, setTitle] = useState(""),
    [consent, setConsent] = useState<string | null>(null);
  const authenticated = Boolean(userId);
  const loadController = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    loadController.current?.abort();
    if (userId === undefined) return;
    if (!userId) {
      setProjects([]);
      setRequests([]);
      setLoading(false);
      setLoadError(null);
      return;
    }
    const controller = new AbortController();
    loadController.current = controller;
    setLoading(true);
    setLoadError(null);
    try {
      const [projects, requests] = await Promise.all([
        directorApi.list(controller.signal),
        directorApi.actorRequests(controller.signal),
      ]);
      if (!controller.signal.aborted) {
        setProjects(projects);
        setRequests(requests);
      }
    } catch (error) {
      if (!controller.signal.aborted)
        setLoadError(error instanceof Error ? error.message : "Unable to load projects.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [userId]);
  useEffect(() => {
    void load();
    return () => loadController.current?.abort();
  }, [load]);
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setUserId(null);
      return;
    }
    let active = true;
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setUserId(data.session?.user.id ?? null);
      })
      .catch(() => {
        if (active) {
          setUserId(null);
          setError("Unable to check your session. Please try signing in again.");
        }
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setUserId(session?.user.id ?? null);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  const create = async (demo: boolean) => {
    if (!authenticated) {
      setAuthOpen(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const project = await directorApi.create(
        demo ? "Performance 01" : title.trim() || "Performance 01",
        demo,
        "performance",
      );
      router.push(`/director/${project.id}`);
    } catch (error) {
      setError((error as Error).message);
      setBusy(false);
    }
  };
  return (
    <main className="director-home director-page">
      <header className="director-home-header">
        <Link href="/" className="director-brand">
          <Clapperboard size={22} />
          <strong>ACTBYME</strong>
          <span>/ DIRECTOR</span>
        </Link>
        <nav>
          <Link href="/projects">My ACTBYME projects</Link>
          <Link href="/studio">Director Studio</Link>
          {authenticated ? (
            <Link href="/profile">My account</Link>
          ) : (
            <button onClick={() => setAuthOpen(true)}>Sign in</button>
          )}
        </nav>
      </header>
      <section className="director-home-hero">
        <div>
          <span className="director-eyebrow">
            <span className="director-live-dot" />
            ONE PERFORMANCE. MANY CAMERA ANGLES.
          </span>
          <h1>
            Direct the camera.
            <br />
            <em>Keep the performance.</em>
          </h1>
          <p>
            Import one actor performance, choose your camera angles and compare the plan with the
            original. Export a free reference video for your usual AI tool.
          </p>
          <div className="director-hero-actions">
            <button
              className="director-primary"
              disabled={busy || (authenticated && loading)}
              onClick={() => void create(true)}
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}Create my
              first project
            </button>
            <Link className="director-button" href="/director/demo">
              <Play size={14} />
              Try the camera demo
            </Link>
          </div>
          <div className="director-hero-features">
            <span>
              <Move3D size={14} />
              Free 3D preview
            </span>
            <span>
              <ShieldCheck size={14} />
              Private assets
            </span>
            <span>
              <Film size={14} />
              Export MP4
            </span>
          </div>
        </div>
        <Link
          href="/director/demo"
          className="director-home-preview"
          aria-label="Open performance camera demo"
        >
          <div className="director-mini-topbar">
            <Clapperboard size={12} />
            <span>PERFORMANCE 01</span>
            <span className="director-badge">DEMO PROJECT</span>
          </div>
          <div className="director-mini-art">
            <svg
              viewBox="0 0 600 330"
              role="img"
              aria-label="Neutral stand-in with planned camera angles"
            >
              <g fill="none" stroke="#edbd72" opacity=".4">
                <ellipse cx="300" cy="245" rx="155" ry="45" />
                <path d="M130 180L300 100L480 180 M300 65V275" strokeDasharray="5 8" />
              </g>
              <g fill="#a8adb4">
                <ellipse cx="300" cy="83" rx="27" ry="35" />
                <rect x="288" y="108" width="24" height="24" rx="9" />
                <path d="M259 130Q300 113 341 130L329 216H271Z" />
                <path d="M258 134L238 194L252 200L275 147 M342 134L362 194L348 200L325 147" />
                <rect x="273" y="209" width="21" height="78" rx="10" />
                <rect x="306" y="209" width="21" height="78" rx="10" />
              </g>
              <g fill="#edbd72">
                <circle cx="145" cy="205" r="7" />
                <circle cx="455" cy="205" r="7" />
                <circle cx="300" cy="288" r="7" />
              </g>
            </svg>
            <span className="director-mini-play">
              <Play size={24} />
            </span>
            <div className="director-mini-caption">
              <span>Front · Close-up · Profile · Hands · Orbit</span>
              <strong>
                One performance.
                <br />
                Your camera plan.
              </strong>
            </div>
          </div>
          <div className="director-mini-timeline">
            <span />
            <span />
            <span />
          </div>
          <div className="director-mini-track">
            <span />
            <span />
          </div>
          <p>
            <span>5 angles · 15 seconds</span>
            <span>
              Open preview <ArrowUpRight size={13} />
            </span>
          </p>
        </Link>
      </section>
      {error ? (
        <p role="alert" className="director-error-banner">
          {error}
        </p>
      ) : null}
      <section className="director-home-projects">
        <div className="director-section-heading">
          <div>
            <span className="director-eyebrow">FROM IDEA TO FILM</span>
            <h2>Your projects</h2>
          </div>
          <span className="director-hint">Automatic saving · private versions</span>
        </div>
        <div className="director-project-grid">
          <form
            className="director-new-project"
            onSubmit={(event) => {
              event.preventDefault();
              void create(false);
            }}
          >
            <Plus size={24} />
            <h3>A new idea?</h3>
            <label>
              Project name
              <input
                aria-label="New Director project name"
                maxLength={140}
                value={title}
                placeholder="My next performance"
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <button className="director-primary" disabled={busy || loading}>
              {busy ? <Loader2 size={14} /> : <Plus size={14} />}Create project
            </button>
          </form>
          {loading ? (
            <DirectorLoading message="Loading your projects…" onRetry={() => void load()} />
          ) : loadError ? (
            <div className="director-loading">
              <p role="alert">{loadError}</p>
              <button onClick={() => void load()}>Try loading again</button>
            </div>
          ) : (
            projects.map((project) => (
              <Link
                className="director-project-card"
                href={`/director/${project.id}`}
                key={project.id}
              >
                <div className="director-project-card-art">
                  <Clapperboard size={28} />
                  <span className="director-badge">VERSION {project.version}</span>
                </div>
                <h3>{project.title}</h3>
                <p>
                  <Clock3 size={12} />
                  {new Date(project.updatedAt).toLocaleDateString("en-US")}
                  <ArrowUpRight size={14} />
                </p>
              </Link>
            ))
          )}
        </div>
        {!authenticated ? (
          <p className="director-hint">
            Sign in to create saved projects. The demo is freely accessible.
          </p>
        ) : null}
      </section>
      {requests.length ? (
        <section className="director-home-requests">
          <div className="director-section-heading">
            <div>
              <span className="director-eyebrow">ACTOR SPACE</span>
              <h2>Director permissions</h2>
            </div>
            <ShieldCheck size={22} />
          </div>
          <p className="director-hint">
            Acceptance allows commercial use, AI transformation and transfer to providers under the
            terms and creative direction shown. Review the production plan before deciding.
          </p>
          {requests.map((request) => (
            <article key={request.id} className="director-request-card">
              <div>
                <h3>{request.title}</h3>
                <p>{request.terms}</p>
                <small>
                  {request.revokedAt
                    ? "Permission revoked"
                    : !request.current
                      ? "Creative direction changed · request out of date"
                      : request.acceptedAt
                        ? "Permission accepted"
                        : "Waiting for your decision"}
                </small>
              </div>
              <div>
                <button
                  onClick={() =>
                    downloadDirectorJson(request.plan, `${request.title}-permission.json`)
                  }
                >
                  <FileJson size={14} />
                  Read production plan
                </button>
                {request.current && !request.acceptedAt && !request.revokedAt ? (
                  <>
                    <label className="director-checkbox">
                      <input
                        type="checkbox"
                        checked={consent === request.id}
                        onChange={(event) => setConsent(event.target.checked ? request.id : null)}
                      />
                      I have read the production plan and terms. I accept commercial use, AI
                      transformation and transfer of my identity and references for this project.
                    </label>
                    <button
                      className="director-primary"
                      disabled={busy || consent !== request.id}
                      onClick={() => {
                        setBusy(true);
                        void directorApi
                          .acceptGrant(request.id, true)
                          .then(setRequests)
                          .catch((error: Error) => setError(error.message))
                          .finally(() => setBusy(false));
                      }}
                    >
                      <Check size={14} />
                      Accept this permission
                    </button>
                  </>
                ) : request.acceptedAt && !request.revokedAt ? (
                  <button
                    disabled={busy}
                    onClick={() => {
                      setBusy(true);
                      void directorApi
                        .acceptGrant(request.id, false)
                        .then(setRequests)
                        .catch((error: Error) => setError(error.message))
                        .finally(() => setBusy(false));
                    }}
                  >
                    Revoke for future generations
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      ) : null}
      <div className="director-home-bottom">
        <Link href="/">
          <ArrowLeft size={14} />
          Back to ACTBYME
        </Link>
        <p>
          Import → Choose angles → Preview → Export. No paid AI generation or render worker
          required.
        </p>
      </div>
      <AuthModal
        initialMode="login"
        onClose={() => setAuthOpen(false)}
        open={authOpen}
        returnTo="/director"
      />
    </main>
  );
}
