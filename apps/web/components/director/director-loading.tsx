"use client";
import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

export function DirectorLoading({ message, onRetry }: { message: string; onRetry: () => void }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className="director-loading" role="status" aria-live="polite">
      <Loader2 size={24} className="animate-spin" aria-hidden="true" />
      <p>{message}</p>
      {slow ? (
        <>
          <p className="director-hint">
            La connexion au studio prend un peu de temps. Le premier chargement peut prendre une
            minute. Vous pouvez patienter ou relancer le chargement.
          </p>
          <button onClick={onRetry}>
            <RefreshCw size={14} />
            Relancer le chargement
          </button>
        </>
      ) : null}
    </div>
  );
}
