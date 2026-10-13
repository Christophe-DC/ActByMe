"use client";
import { useEffect, useState } from "react";
import { studioWorkspaceApi } from "@/lib/api/client";
import { StudioPlayer } from "./studio-player";
export function SharedStudio({ token }: { token: string }) {
  const [shared, setShared] = useState<Awaited<
    ReturnType<typeof studioWorkspaceApi.shared>
  > | null>(null);
  const [error, setError] = useState("");
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
            <StudioPlayer scene={shared.scene} roleId={shared.roleId} />
          </>
        ) : (
          <p className="mt-5 text-zinc-300">Opening the scene…</p>
        )}
      </div>
    </main>
  );
}
