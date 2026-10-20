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
import { directorTemplates } from "@actbyme/shared";
import { directorApi, type DirectorActorRequest } from "@/lib/api/client";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { AuthModal } from "@/components/auth/auth-modal";
import { TemplateArt } from "./director-library";
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
        demo ? "The Coastal House" : title.trim() || "New ad",
        demo,
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
            THE STUDIO FOR YOUR NEXT AD
          </span>
          <h1>
            Edit the video.
            <br />
            <em>Before producing it.</em>
          </h1>
          <p>
            Plan your shots. Direct the camera. Bring performances and sound together. See your ad
            take shape before your first AI generation.
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
              Explore The Coastal House
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
          aria-label="Open The Coastal House demo"
        >
          <div className="director-mini-topbar">
            <Clapperboard size={12} />
            <span>THE COASTAL HOUSE</span>
            <span className="director-badge">DEMO PROJECT</span>
          </div>
          <div className="director-mini-art">
            <TemplateArt template={directorTemplates[0]!} />
            <span className="director-mini-play">
              <Play size={24} />
            </span>
            <div className="director-mini-caption">
              <span>Outside to Inside</span>
              <strong>
                A place. A story.
                <br />
                Your direction.
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
            <span>3 shots · 30 seconds</span>
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
                placeholder="My next ad"
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
        <p>Planning is free. AI generation is optional and requires explicit confirmation.</p>
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
