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
            Connecting to the studio is taking a little longer. The first load can take a minute.
            You can wait or restart loading.
          </p>
          <button onClick={onRetry}>
            <RefreshCw size={14} />
            Restart loading
          </button>
        </>
      ) : null}
    </div>
  );
}
