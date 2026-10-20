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
        setLoadError(error instanceof Error ? error.message : "Impossible de charger les projets.");
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
          setError(
            "Impossible de vérifier votre session. Vous pouvez réessayer de vous connecter.",
          );
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
        demo ? "The Coastal House" : title.trim() || "Nouvelle publicité",
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
          <Link href="/projects">Mes projets ACTBYME</Link>
          <Link href="/studio">Director Studio</Link>
          {authenticated ? (
            <Link href="/profile">Mon compte</Link>
          ) : (
            <button onClick={() => setAuthOpen(true)}>Se connecter</button>
          )}
        </nav>
      </header>
      <section className="director-home-hero">
        <div>
          <span className="director-eyebrow">
            <span className="director-live-dot" />
            LE STUDIO DE VOTRE PROCHAINE PUBLICITÉ
          </span>
          <h1>
            Edit the video.
            <br />
            <em>Before producing it.</em>
          </h1>
          <p>
            Préparez les plans. Dirigez la caméra. Accordez les performances et le son. Voyez votre
            publicité prendre forme avant sa première génération IA.
          </p>
          <div className="director-hero-actions">
            <button
              className="director-primary"
              disabled={busy || (authenticated && loading)}
              onClick={() => void create(true)}
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}Créer mon
              premier projet
            </button>
            <Link className="director-button" href="/director/demo">
              <Play size={14} />
              Explorer The Coastal House
            </Link>
          </div>
          <div className="director-hero-features">
            <span>
              <Move3D size={14} />
              Prévisualisation 3D gratuite
            </span>
            <span>
              <ShieldCheck size={14} />
              Ressources privées
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
          aria-label="Ouvrir la démo The Coastal House"
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
                Un lieu. Une histoire.
                <br />
                Votre réalisation.
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
            <span>3 plans · 30 secondes</span>
            <span>
              Ouvrir la prévisualisation <ArrowUpRight size={13} />
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
            <span className="director-eyebrow">DE L’INTENTION AU FILM</span>
            <h2>Vos réalisations</h2>
          </div>
          <span className="director-hint">Enregistrement automatique · versions privées</span>
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
            <h3>Une nouvelle idée ?</h3>
            <label>
              Nom du projet
              <input
                aria-label="Nom du nouveau projet Director"
                maxLength={140}
                value={title}
                placeholder="Ma prochaine publicité"
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <button className="director-primary" disabled={busy || loading}>
              {busy ? <Loader2 size={14} /> : <Plus size={14} />}Créer un projet
            </button>
          </form>
          {loading ? (
            <DirectorLoading message="Chargement de vos projets…" onRetry={() => void load()} />
          ) : loadError ? (
            <div className="director-loading">
              <p role="alert">{loadError}</p>
              <button onClick={() => void load()}>Réessayer le chargement</button>
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
                  {new Date(project.updatedAt).toLocaleDateString("fr-FR")}
                  <ArrowUpRight size={14} />
                </p>
              </Link>
            ))
          )}
        </div>
        {!authenticated ? (
          <p className="director-hint">
            Connectez-vous pour créer des projets persistants. La démo reste accessible librement.
          </p>
        ) : null}
      </section>
      {requests.length ? (
        <section className="director-home-requests">
          <div className="director-section-heading">
            <div>
              <span className="director-eyebrow">ESPACE ACTEUR</span>
              <h2>Autorisations Director</h2>
            </div>
            <ShieldCheck size={22} />
          </div>
          <p className="director-hint">
            L’acceptation autorise l’usage commercial, la transformation IA et le transfert aux
            fournisseurs pour les conditions et la direction créative présentées. Consultez le
            dossier avant de décider.
          </p>
          {requests.map((request) => (
            <article key={request.id} className="director-request-card">
              <div>
                <h3>{request.title}</h3>
                <p>{request.terms}</p>
                <small>
                  {request.revokedAt
                    ? "Autorisation révoquée"
                    : !request.current
                      ? "Direction créative modifiée · demande obsolète"
                      : request.acceptedAt
                        ? "Autorisation acceptée"
                        : "En attente de votre décision"}
                </small>
              </div>
              <div>
                <button
                  onClick={() =>
                    downloadDirectorJson(request.plan, `${request.title}-autorisation.json`)
                  }
                >
                  <FileJson size={14} />
                  Lire le dossier de production
                </button>
                {request.current && !request.acceptedAt && !request.revokedAt ? (
                  <>
                    <label className="director-checkbox">
                      <input
                        type="checkbox"
                        checked={consent === request.id}
                        onChange={(event) => setConsent(event.target.checked ? request.id : null)}
                      />
                      J’ai lu le dossier et les conditions. J’accepte les usages commerciaux, la
                      transformation IA et la transmission de mon identité et de mes références pour
                      ce projet.
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
                      Accepter cette autorisation
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
                    Révoquer pour les prochaines générations
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
          Retour à ACTBYME
        </Link>
        <p>
          La préparation est gratuite. Les générations IA sont facultatives et demandent une
          confirmation explicite.
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
