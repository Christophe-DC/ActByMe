"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { studioSceneSchema, type StudioScene, type StudioState } from "@actbyme/shared";
import { APIError, directorStudioApi, studioWorkspaceApi } from "@/lib/api/client";
export type StudioDraft = {
  scene: StudioScene | null;
  instructions: string;
  roleId: string | null;
};
const fingerprint = (draft: StudioDraft) => JSON.stringify(draft);
const fromServer = (state: StudioState): StudioDraft => ({
  scene: state.revision?.scene ?? null,
  instructions: state.instructions,
  roleId: state.revision?.roleId ?? null,
});
export function useStudioDocument(projectId: string) {
  const [state, setState] = useState<StudioState | null>(null);
  const [draft, setDraft] = useState<StudioDraft>({ scene: null, instructions: "", roleId: null });
  const [phase, setPhase] = useState("Loading…");
  const [error, setError] = useState("");
  const [history, setHistory] = useState<StudioDraft[]>([]);
  const [future, setFuture] = useState<StudioDraft[]>([]);
  const stateRef = useRef(state);
  const draftRef = useRef(draft);
  const saved = useRef("");
  const inFlight = useRef<Promise<StudioState> | null>(null);
  const mounted = useRef(true);
  const flushOnExit = useRef<(() => Promise<StudioState>) | null>(null);
  const blocked = useRef(false);
  const groupRef = useRef({ key: "", time: 0 });
  const applyServer = useCallback((next: StudioState) => {
    stateRef.current = next;
    draftRef.current = fromServer(next);
    saved.current = fingerprint(draftRef.current);
    blocked.current = false;
    if (mounted.current) {
      setState(next);
      setDraft(draftRef.current);
      setHistory([]);
      setFuture([]);
      setError("");
      setPhase("All changes saved");
    }
  }, []);
  const reload = useCallback(async () => {
    const next = await directorStudioApi.get(projectId);
    applyServer(next);
    return next;
  }, [projectId, applyServer]);
  useEffect(() => {
    mounted.current = true;
    void reload().catch((error: unknown) => {
      if (mounted.current) {
        setError(message(error));
        setPhase("Could not load scene");
      }
    });
    return () => {
      mounted.current = false;
      if (fingerprint(draftRef.current) !== saved.current)
        void flushOnExit.current?.().catch(() => undefined);
    };
  }, [reload]);
  const change = useCallback((next: StudioDraft, group = "") => {
    const current = draftRef.current;
    if (fingerprint(current) === fingerprint(next)) return;
    if (!group || groupRef.current.key !== group || Date.now() - groupRef.current.time > 500)
      setHistory((items) => [...items.slice(-49), current]);
    groupRef.current = { key: group, time: Date.now() };
    setFuture([]);
    draftRef.current = next;
    setDraft(next);
    setPhase("Waiting to save…");
  }, []);
  const flush = useCallback(async (): Promise<StudioState> => {
    if (inFlight.current) {
      await inFlight.current;
      return flush();
    }
    const current = stateRef.current;
    if (!current) throw new Error("Your scene is still loading.");
    if (fingerprint(draftRef.current) === saved.current) return current;
    if (
      current.locked ||
      !current.enabled ||
      ["QUEUED", "RUNNING"].includes(current.job?.status ?? "")
    )
      throw new Error("Your scene is busy or locked. Reload its saved version before continuing.");
    if (blocked.current)
      throw new Error(
        "Another editor changed this scene. Reload their saved version before continuing.",
      );
    const snapshot = structuredClone(draftRef.current);
    if (fingerprint(snapshot) === saved.current) return current;
    if (snapshot.scene) {
      const validation = studioSceneSchema.safeParse(snapshot.scene);
      if (!validation.success)
        throw new Error("This change needs a valid timing or position. Undo it and try again.");
    }
    setPhase("Saving…");
    const promise = snapshot.scene
      ? directorStudioApi.save(
          projectId,
          current.version,
          snapshot.scene,
          snapshot.instructions,
          snapshot.roleId,
        )
      : studioWorkspaceApi.draft(projectId, current.version, snapshot.instructions);
    inFlight.current = promise;
    try {
      const next = await promise;
      stateRef.current = next;
      saved.current = fingerprint(snapshot);
      if (mounted.current) {
        setState(next);
        setError("");
        setPhase(
          fingerprint(draftRef.current) === saved.current
            ? "All changes saved"
            : "Waiting to save…",
        );
      }
      return next;
    } catch (error) {
      if (error instanceof APIError && error.status === 409) blocked.current = true;
      if (mounted.current) {
        setError(message(error));
        setPhase("Changes not saved");
      }
      throw error;
    } finally {
      inFlight.current = null;
    }
  }, [projectId]);
  flushOnExit.current = flush;
  const pending = fingerprint(draft) !== saved.current;
  const generating = ["QUEUED", "RUNNING"].includes(state?.job?.status ?? "");
  useEffect(() => {
    if (!pending || generating || !state?.enabled || state.locked || blocked.current) return;
    const timer = window.setTimeout(() => {
      void flush().catch(() => undefined);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [pending, draft, generating, state?.enabled, state?.locked, flush]);
  useEffect(() => {
    if (!generating) return;
    let cancelled = false;
    let reading = false;
    const timer = window.setInterval(() => {
      if (reading) return;
      reading = true;
      void directorStudioApi
        .get(projectId)
        .then((next) => {
          if (cancelled) return;
          if (["QUEUED", "RUNNING"].includes(next.job?.status ?? "")) {
            stateRef.current = next;
            setState(next);
          } else applyServer(next);
        })
        .catch((error: unknown) => {
          if (!cancelled) setError(message(error));
        })
        .finally(() => {
          reading = false;
        });
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [projectId, generating, applyServer]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (fingerprint(draftRef.current) !== saved.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory(history.slice(0, -1));
    setFuture([...future, draftRef.current]);
    draftRef.current = previous;
    setDraft(previous);
    setPhase("Waiting to save…");
    groupRef.current.key = "";
  }
  function redo() {
    const next = future.at(-1);
    if (!next) return;
    setFuture(future.slice(0, -1));
    setHistory([...history, draftRef.current]);
    draftRef.current = next;
    setDraft(next);
    setPhase("Waiting to save…");
    groupRef.current.key = "";
  }
  async function settled() {
    let next = await flush();
    while (fingerprint(draftRef.current) !== saved.current) next = await flush();
    return next;
  }
  return {
    state,
    draft,
    change,
    applyServer,
    reload,
    flush: settled,
    pending,
    generating,
    phase,
    error,
    setError,
    undo,
    redo,
    canUndo: history.length > 0,
    canRedo: future.length > 0,
  };
}
export function message(error: unknown) {
  if (!(error instanceof Error)) return "Something went wrong. Please try again.";
  if (/quota|rate limit|overloaded/i.test(error.message))
    return "The scene assistant is busy. Your changes are safe; please try again in a moment.";
  if (/GEMINI_API_KEY|schema|keyframes|structured|JSON|not configured/i.test(error.message))
    return "The scene assistant couldn't apply this change. Your saved scene is safe. Try a simpler instruction.";
  return error.message;
}
