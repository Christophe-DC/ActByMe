"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { type StudioSelection } from "@actbyme/shared";
import { APIError, studioWorkspaceApi } from "@/lib/api/client";
import { StudioPlayer } from "./studio-player";
export function SharedStudio({ token }: { token: string }) {
  const [shared, setShared] = useState<Awaited<
    ReturnType<typeof studioWorkspaceApi.shared>
  > | null>(null);
  const [error, setError] = useState("");
  const [time, setTime] = useState(0);
  const [selection, setSelection] = useState<StudioSelection>({ kind: "scene", id: "scene" });
  const [authorName, setAuthorName] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void studioWorkspaceApi
      .shared(token)
      .then((value) => {
        if (!cancelled) setShared(value);
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "This viewing link has expired or was turned off. Ask the creator for a new link.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [token]);
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem("actbyme:feedback:" + token);
      if (cached && cached.length < 3000) {
        const text = JSON.parse(cached);
        if (typeof text.body === "string") setBody(text.body);
        if (typeof text.authorName === "string") setAuthorName(text.authorName);
      }
    } catch {
      /* Browser storage may be disabled; keep the server workflow available. */
    }
  }, [token]);
  async function comment() {
    setBusy(true);
    setFeedbackError("");
    try {
      await studioWorkspaceApi.comment(token, { authorName, body, time, target: selection });
      setShared(await studioWorkspaceApi.shared(token));
      setBody("");
      try {
        sessionStorage.removeItem("actbyme:feedback:" + token);
      } catch {
        /* Browser storage may be disabled; keep the server workflow available. */
      }
    } catch (error) {
      if (error instanceof APIError && error.status === 401) {
        setNeedsLogin(true);
        setFeedbackError("Sign in to send your feedback. Your text stays in this tab.");
        try {
          sessionStorage.setItem("actbyme:feedback:" + token, JSON.stringify({ authorName, body }));
        } catch {
          /* Browser storage may be disabled; keep the server workflow available. */
        }
      } else
        setFeedbackError(
          error instanceof Error ? error.message : "Could not send feedback. Please retry.",
        );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="min-h-screen bg-[#0b0b0d] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs uppercase tracking-[.22em] text-amber-200">
          Shared scene · View only
        </p>
        {error ? (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-white/10 bg-[#111214] p-6 text-zinc-200"
          >
            {error}
          </p>
        ) : shared ? (
          <>
            <h1 className="mb-6 mt-3 text-3xl font-semibold">{shared.title}</h1>
            <StudioPlayer
              scene={shared.scene}
              roleId={shared.roleId}
              selection={selection}
              timelineTime={time}
              onSelect={shared.allowComments ? setSelection : undefined}
              onTimelineTimeChange={setTime}
            />
            {shared.allowComments ? (
              <section className="mt-8 rounded-xl border border-white/10 bg-[#111214] p-5">
                <h2 className="text-xl font-semibold">Feedback</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  Select an element and a moment, then leave a note. Feedback doesn't change the
                  scene or the actor's recording guide.
                </p>
                <p className="mt-3 text-sm text-amber-200">
                  At {time.toFixed(1)}s ·{" "}
                  {selection.kind === "character"
                    ? shared.scene.characters.find((item) => item.id === selection.id)?.name
                    : selection.kind === "prop"
                      ? "Selected object"
                      : "Whole scene"}
                </p>
                <form
                  className="mt-4 space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void comment();
                  }}
                >
                  <label className="block text-sm">
                    Your display name
                    <input
                      aria-label="Feedback display name"
                      required
                      maxLength={60}
                      className="mt-2 w-full rounded-lg border border-white/15 bg-black/20 p-3 text-base"
                      value={authorName}
                      onChange={(event) => setAuthorName(event.target.value)}
                    />
                  </label>
                  <label className="block text-sm">
                    Your feedback
                    <textarea
                      aria-label="Your feedback"
                      required
                      maxLength={1600}
                      rows={3}
                      className="mt-2 w-full rounded-lg border border-white/15 bg-black/20 p-3 text-base"
                      value={body}
                      onChange={(event) => setBody(event.target.value)}
                    />
                  </label>
                  <button
                    disabled={busy || !body.trim() || !authorName.trim()}
                    className="rounded-xl bg-amber-300 px-4 py-3 text-sm font-semibold text-black disabled:opacity-40"
                  >
                    {busy ? "Sending…" : "Send feedback"}
                  </button>
                </form>
                {feedbackError ? (
                  <p role="alert" className="mt-3 text-sm text-amber-100">
                    {feedbackError}
                  </p>
                ) : null}
                {needsLogin ? (
                  <Link
                    className="mt-3 inline-block text-amber-200 underline"
                    href={"/login?next=" + encodeURIComponent("/studio/shared/" + token)}
                  >
                    Sign in to leave feedback
                  </Link>
                ) : null}
                <div className="mt-6 space-y-3">
                  {shared.comments.map((item) => (
                    <article key={item.id} className="rounded-lg bg-white/5 p-4">
                      <button
                        className="text-xs text-amber-200"
                        onClick={() => {
                          setTime(item.time);
                          setSelection(item.target);
                        }}
                      >
                        {item.authorName} · {item.time.toFixed(1)}s
                        {item.resolved ? " · Resolved" : ""}
                      </button>
                      <p className="mt-2 whitespace-pre-line text-sm text-zinc-200">{item.body}</p>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : (
          <p className="mt-5 text-zinc-300">Opening the scene…</p>
        )}
      </div>
    </main>
  );
}
