"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  assertStudioDialogueOnly,
  studioSceneSchema,
  type StudioScene,
  type StudioState,
} from "@actbyme/shared";
import { APIError, directorStudioApi, studioWorkspaceApi } from "@/lib/api/client";
export type StudioDraft = {
  scene: StudioScene | null;
  instructions: string;
  roleId: string | null;
};
type Recovery = { baseVersion: number; draft: StudioDraft; savedAt: number };
const fingerprint = (draft: StudioDraft) => JSON.stringify(draft);
const fromServer = (state: StudioState): StudioDraft => ({
  scene: state.revision?.scene ?? null,
  instructions: state.instructions,
  roleId: state.revision?.roleId ?? null,
});
const keyFor = (state: StudioState) =>
  "actbyme:studio-text:" + state.ownerId + ":" + state.projectId;
function cached(state: StudioState): Recovery | null {
  try {
    const raw = sessionStorage.getItem(keyFor(state));
    if (!raw || raw.length > 1000000) return null;
    const record = JSON.parse(raw) as Recovery;
    if (
      !Number.isInteger(record.baseVersion) ||
      !Number.isFinite(record.savedAt) ||
      Date.now() - record.savedAt > 86400000 ||
      typeof record.draft?.instructions !== "string" ||
      record.draft.instructions.length > 12000
    )
      return null;
    if (record.draft.scene && !studioSceneSchema.safeParse(record.draft.scene).success) return null;
    if (
      record.draft.roleId !== null &&
      (typeof record.draft.roleId !== "string" || record.draft.roleId.length > 40)
    )
      return null;
    return record;
  } catch {
    return null;
  }
}
export function useStudioDocument(projectId: string) {
  const [state, setState] = useState<StudioState | null>(null);
  const [draft, setDraft] = useState<StudioDraft>({ scene: null, instructions: "", roleId: null });
  const [phase, setPhase] = useState("Loading…");
  const [error, setError] = useState("");
  const [recovery, setRecovery] = useState<Recovery | null>(null);
  const [history, setHistory] = useState<StudioDraft[]>([]);
  const [future, setFuture] = useState<StudioDraft[]>([]);
  const stateRef = useRef(state);
  const draftRef = useRef(draft);
  const saved = useRef("");
  const inFlight = useRef<Promise<StudioState> | null>(null);
  const mounted = useRef(true);
  const blocked = useRef(false);
  const groupRef = useRef({ key: "", time: 0 });
  const cachePending = useCallback(() => {
    const current = stateRef.current;
    if (!current || fingerprint(draftRef.current) === saved.current) return;
    try {
      sessionStorage.setItem(
        keyFor(current),
        JSON.stringify({
          baseVersion: current.version,
          draft: draftRef.current,
          savedAt: Date.now(),
        }),
      );
    } catch {
      /* Saving to the server still works when browser storage is disabled. */
    }
  }, []);
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
    cachePending();
    const next = await directorStudioApi.get(projectId);
    const record = cached(next);
    applyServer(next);
    if (record && fingerprint(record.draft) !== saved.current) {
      if (
        record.baseVersion === next.version &&
        !next.locked &&
        !["QUEUED", "RUNNING"].includes(next.job?.status ?? "")
      ) {
        try {
          if (next.revision && record.draft.scene)
            assertStudioDialogueOnly(next.revision.scene, record.draft.scene);
          draftRef.current = record.draft;
          setDraft(record.draft);
          setPhase("Recovered unsaved text. Saving…");
        } catch {
          setRecovery(record);
        }
      } else setRecovery(record);
    } else {
      try {
        sessionStorage.removeItem(keyFor(next));
      } catch {
        /* Browser storage may be disabled; keep the server workflow available. */
      }
      setRecovery(null);
    }
    return next;
  }, [projectId, applyServer, cachePending]);
  useEffect(() => {
    mounted.current = true;
    void reload().catch((error: unknown) => {
      if (mounted.current) {
        setError(message(error));
        setPhase("Could not load scene");
      }
    });
    return () => {
      cachePending();
      mounted.current = false;
    };
  }, [reload, cachePending]);
  const change = useCallback(
    (next: StudioDraft, group = "") => {
      const current = draftRef.current;
      if (fingerprint(current) === fingerprint(next)) return;
      if (!group || groupRef.current.key !== group || Date.now() - groupRef.current.time > 500)
        setHistory((items) => [...items.slice(-49), current]);
      groupRef.current = { key: group, time: Date.now() };
      setFuture([]);
      draftRef.current = next;
      setDraft(next);
      setPhase("Waiting to save…");
      cachePending();
    },
    [cachePending],
  );
  const flush = useCallback(async (): Promise<StudioState> => {
    if (inFlight.current) {
      await inFlight.current;
      return flush();
    }
    const current = stateRef.current;
    if (!current) throw new Error("Your scene is still loading.");
    const snapshot = structuredClone(draftRef.current);
    if (fingerprint(snapshot) === saved.current) return current;
    if (blocked.current)
      throw new Error(
        "Another editor changed the saved version. Your text is safe in this tab. Reload the scene to recover it.",
      );
    if (
      current.locked ||
      !current.enabled ||
      ["QUEUED", "RUNNING"].includes(current.job?.status ?? "")
    )
      throw new Error("The scene is busy or locked. Your text is safe in this tab.");
    if (snapshot.scene) studioSceneSchema.parse(snapshot.scene);
    setPhase("Saving…");
    cachePending();
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
      if (fingerprint(draftRef.current) === saved.current) {
        try {
          sessionStorage.removeItem(keyFor(next));
        } catch {
          /* Browser storage may be disabled; keep the server workflow available. */
        }
      } else cachePending();
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
        setPhase("Text saved in this tab · Server save needs retry");
      }
      throw error;
    } finally {
      inFlight.current = null;
    }
  }, [projectId, cachePending]);
  const draftFingerprint = useMemo(() => fingerprint(draft), [draft]);
  const pending = draftFingerprint !== saved.current;
  const generating = ["QUEUED", "RUNNING"].includes(state?.job?.status ?? "");
  useEffect(() => {
    if (!pending || generating || !state?.enabled || state.locked || blocked.current) return;
    const timer = window.setTimeout(() => {
      void flush().catch(() => undefined);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [pending, draft, generating, state?.enabled, state?.locked, flush]);
  useEffect(() => {
    const online = () => {
      void flush().catch(() => undefined);
    };
    const leaving = (event: BeforeUnloadEvent) => {
      cachePending();
      if (fingerprint(draftRef.current) !== saved.current) event.preventDefault();
    };
    window.addEventListener("online", online);
    window.addEventListener("beforeunload", leaving);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("beforeunload", leaving);
    };
  }, [flush, cachePending]);
  useEffect(() => {
    if (!generating) return;
    let cancelled = false,
      reading = false;
    const timer = window.setInterval(() => {
      if (reading) return;
      reading = true;
      const polledJobId = stateRef.current?.job?.id;
      void directorStudioApi
        .get(projectId)
        .then((next) => {
          if (
            cancelled ||
            stateRef.current?.job?.id !== polledJobId ||
            !["QUEUED", "RUNNING"].includes(stateRef.current?.job?.status ?? "") ||
            next.version < (stateRef.current?.version ?? 0)
          )
            return;
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
    }, 1500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [projectId, generating, applyServer]);
  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory(history.slice(0, -1));
    setFuture([...future, draftRef.current]);
    draftRef.current = previous;
    setDraft(previous);
    groupRef.current.key = "";
    cachePending();
  }
  function redo() {
    const next = future.at(-1);
    if (!next) return;
    setFuture(future.slice(0, -1));
    setHistory([...history, draftRef.current]);
    draftRef.current = next;
    setDraft(next);
    groupRef.current.key = "";
    cachePending();
  }
  function recover() {
    if (!recovery || !stateRef.current) return;
    const next = fromServer(stateRef.current);
    if (next.scene && recovery.draft.scene) {
      next.scene = structuredClone(next.scene);
      for (const cue of next.scene.cues) {
        const old = recovery.draft.scene.cues.find(
          (item) =>
            item.characterId === cue.characterId &&
            item.start === cue.start &&
            item.end === cue.end,
        );
        if (old) cue.dialogue = old.dialogue;
      }
    }
    next.instructions = recovery.draft.instructions;
    change(next);
    setRecovery(null);
  }
  function discardRecovery() {
    if (stateRef.current)
      try {
        sessionStorage.removeItem(keyFor(stateRef.current));
      } catch {
        /* Browser storage may be disabled; keep the server workflow available. */
      }
    setRecovery(null);
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
    recovery,
    recover,
    discardRecovery,
  };
}
export function message(error: unknown) {
  if (!(error instanceof Error)) return "Something went wrong. Please try again.";
  if (
    error instanceof APIError &&
    error.status === 409 &&
    /studio changed|reload before saving|another editor/i.test(error.message)
  )
    return "The saved scene changed. Your text is safe in this tab. Reload it before continuing.";
  if (/quota|rate limit|overloaded/i.test(error.message))
    return "The assistant is busy. Your saved scene is safe; try again in a moment.";
  if (/GEMINI_API_KEY|schema|keyframes|structured|JSON|not configured/i.test(error.message))
    return "The assistant couldn't apply this change. Your saved scene is safe. Try a simpler instruction.";
  if (/Unable to reach/i.test(error.message))
    return "You're offline or the server is unavailable. Your text is kept in this tab. Reconnect and retry saving.";
  return error.message;
}
