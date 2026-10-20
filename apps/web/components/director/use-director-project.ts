"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createDirectorDocument,
  createPerformanceDocument,
  directorDocumentSchema,
  type DirectorDocument,
  type DirectorState,
} from "@actbyme/shared";
import { APIError, directorApi } from "@/lib/api/client";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

const emptyCapabilities: DirectorState["capabilities"] = {
  storageReady: false,
  workerReady: false,
  browserExportReady: false,
  providers: [],
  budgetCents: 0,
  reservedCents: 0,
};
export function useDirectorProject(id?: string, legacyDemo = false) {
  const initialDocument = () =>
    legacyDemo
      ? createDirectorDocument("The Coastal House", true)
      : createPerformanceDocument("Performance 01", true);
  const [state, setState] = useState<DirectorState | null>(
    id
      ? null
      : {
          id: "demo",
          version: 1,
          document: initialDocument(),
          assets: [],
          jobs: [],
          capabilities: emptyCapabilities,
          updatedAt: new Date().toISOString(),
        },
  );
  const [document, setDocument] = useState<DirectorDocument>(initialDocument());
  const stateRef = useRef(state);
  stateRef.current = state;
  const current = useRef(document),
    saved = useRef(""),
    version = useRef(1),
    inFlight = useRef<Promise<DirectorState | null> | null>(null);
  const [loading, setLoading] = useState(Boolean(id)),
    [error, setError] = useState<string | null>(null),
    [saveStatus, setSaveStatus] = useState("Loading…"),
    [conflict, setConflict] = useState(false);
  const blocked = useRef(false),
    [recovered, setRecovered] = useState(false);
  const sessionClosed = useRef(false);
  const loadController = useRef<AbortController | null>(null);
  const undoStack = useRef<DirectorDocument[]>([]),
    redoStack = useRef<DirectorDocument[]>([]);
  const [historyTick, setHistoryTick] = useState(0);
  const storageKey = `actbyme-director-draft:${id ?? "demo"}`;
  const put = useCallback((next: DirectorDocument) => {
    current.current = next;
    setDocument(next);
  }, []);
  useEffect(() => {
    if (!id || !isSupabaseConfigured) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_OUT") return;
      sessionClosed.current = true;
      loadController.current?.abort();
      setLoading(false);
      blocked.current = true;
      stateRef.current = null;
      setState(null);
      put(createDirectorDocument());
      setError("Your session has ended. Sign in again to open this private project.");
    });
    return () => subscription.unsubscribe();
  }, [id, put]);
  const load = useCallback(async () => {
    if (!id) return;
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    sessionClosed.current = false;
    if (stateRef.current?.id !== id) {
      stateRef.current = null;
      setState(null);
    }
    setLoading(true);
    setError(null);
    try {
      const result = await directorApi.get(id, controller.signal);
      if (sessionClosed.current || controller.signal.aborted) return;
      stateRef.current = result;
      setState(result);
      version.current = result.version;
      saved.current = JSON.stringify(result.document);
      blocked.current = false;
      setConflict(false);
      let recoveredDocument: DirectorDocument | undefined;
      try {
        const draft = JSON.parse(localStorage.getItem(storageKey) ?? "null");
        if (draft?.document && JSON.stringify(draft.document) !== saved.current) {
          const parsed = directorDocumentSchema.safeParse(draft.document);
          if (parsed.success) {
            recoveredDocument = parsed.data;
            setRecovered(true);
            if (draft.version !== result.version) {
              blocked.current = true;
              setConflict(true);
            }
          }
        }
      } catch {
        /* Storage is optional. Server persistence remains authoritative. */
      }
      put(recoveredDocument ?? result.document);
      setSaveStatus(recoveredDocument ? "Draft recovered" : "Saved");
      setError(null);
    } catch (error) {
      if (!controller.signal.aborted)
        setError(error instanceof Error ? error.message : "Unable to load this project.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [id, put, storageKey]);
  useEffect(() => {
    if (id) void load();
    else {
      saved.current = JSON.stringify(current.current);
      setSaveStatus("Local demo · not saved");
    }
    return () => loadController.current?.abort();
  }, [id, load]);
  const edit = useCallback(
    (change: DirectorDocument | ((draft: DirectorDocument) => void)) => {
      const next =
        typeof change === "function" ? structuredClone(current.current) : structuredClone(change);
      if (typeof change === "function") change(next);
      const parsed = directorDocumentSchema.safeParse(next);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Invalid change.");
        return false;
      }
      if (JSON.stringify(next) === JSON.stringify(current.current)) return true;
      undoStack.current = [...undoStack.current.slice(-59), structuredClone(current.current)];
      redoStack.current = [];
      put(next);
      setHistoryTick((tick) => tick + 1);
      setSaveStatus(id ? "Unsaved changes" : "Local demo · not saved");
      try {
        if (id)
          localStorage.setItem(
            storageKey,
            JSON.stringify({ version: version.current, document: next }),
          );
      } catch {
        /* no sensitive URLs are stored */
      }
      return true;
    },
    [id, put, storageKey],
  );
  const save = useCallback(async (): Promise<DirectorState | null> => {
    if (!id || blocked.current || !state) return null;
    if (inFlight.current) {
      await inFlight.current;
      if (blocked.current) return null;
    }
    if (JSON.stringify(current.current) === saved.current) return stateRef.current;
    const snapshot = structuredClone(current.current);
    setSaveStatus("Saving…");
    const pending = directorApi
      .save(id, version.current, snapshot)
      .then((result) => {
        if (sessionClosed.current) return null;
        version.current = result.version;
        saved.current = JSON.stringify(snapshot);
        stateRef.current = result;
        setState(result);
        setRecovered(false);
        const dirty = JSON.stringify(current.current) !== saved.current;
        setSaveStatus(dirty ? "Unsaved changes" : "Saved");
        try {
          if (!dirty) localStorage.removeItem(storageKey);
          else
            localStorage.setItem(
              storageKey,
              JSON.stringify({ version: version.current, document: current.current }),
            );
        } catch {
          /* optional recovery */
        }
        return result;
      })
      .catch((error: unknown) => {
        if (error instanceof APIError && error.status === 409) {
          blocked.current = true;
          setConflict(true);
        }
        setSaveStatus("Save failed · draft kept");
        setError(error instanceof Error ? error.message : "Save failed.");
        return null;
      })
      .finally(() => {
        inFlight.current = null;
      });
    inFlight.current = pending;
    return pending;
  }, [id, state, storageKey]);
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    if (!id || loading || conflict || JSON.stringify(document) === saved.current) return;
    const timer = setTimeout(() => void saveRef.current(), 800);
    return () => clearTimeout(timer);
  }, [document, id, loading, conflict]);
  useEffect(() => {
    if (!id || loading || !stateRef.current || sessionClosed.current) return;
    let polling = false;
    const controller = new AbortController();
    const timer = setInterval(() => {
      if (inFlight.current || polling || window.document.hidden || sessionClosed.current) return;
      polling = true;
      void directorApi
        .get(id, controller.signal)
        .then((result) => {
          if (sessionClosed.current || controller.signal.aborted) return;
          if (result.version !== version.current) {
            if (JSON.stringify(current.current) !== saved.current) {
              blocked.current = true;
              setConflict(true);
              setSaveStatus("Conflict · draft kept");
              return;
            }
            version.current = result.version;
            saved.current = JSON.stringify(result.document);
            put(result.document);
          }
          setState(result);
        })
        .catch(() => undefined)
        .finally(() => {
          polling = false;
        });
    }, 4000);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [id, loading, put]);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (id && JSON.stringify(current.current) !== saved.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [id]);
  const history = useCallback(
    (redo: boolean) => {
      const source = redo ? redoStack : undoStack,
        destination = redo ? undoStack : redoStack;
      const next = source.current.pop();
      if (!next) return;
      destination.current.push(structuredClone(current.current));
      put(next);
      setHistoryTick((tick) => tick + 1);
      setSaveStatus("Unsaved changes");
      try {
        if (id)
          localStorage.setItem(
            storageKey,
            JSON.stringify({ version: version.current, document: next }),
          );
      } catch {
        /* optional recovery */
      }
    },
    [id, put, storageKey],
  );
  const discardLocal = async () => {
    localStorage.removeItem(storageKey);
    undoStack.current = [];
    redoStack.current = [];
    setRecovered(false);
    await load();
  };
  const refresh = useCallback(async () => {
    if (!id) return;
    const result = await directorApi.get(id);
    if (sessionClosed.current) return;
    setState(result);
  }, [id]);
  return {
    state,
    document,
    edit,
    save,
    refresh,
    loading,
    reload: load,
    error,
    setError,
    saveStatus,
    conflict,
    recovered,
    discardLocal,
    undo: () => history(false),
    redo: () => history(true),
    canUndo: historyTick >= 0 && undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
    version: version.current,
  };
}
