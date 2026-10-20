"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles, X } from "lucide-react";
import { Button } from "@actbyme/ui";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { consumeAuthReturnTo, rememberAuthReturnTo, safeAuthReturnTo } from "@/lib/auth/return-to";

type AuthMode = "login" | "signup";

export function AuthModal({
  initialMode,
  onClose,
  open,
  returnTo,
}: {
  initialMode: AuthMode;
  onClose: () => void;
  open: boolean;
  returnTo?: string;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const destination = safeAuthReturnTo(returnTo);
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setError("");
      setNotice("");
    }
  }, [initialMode, open]);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    dialog.querySelector<HTMLInputElement>("input")?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  if (!open) {
    return null;
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
    setNotice("");
  }

  async function handleEmailAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setIsSubmitting(true);

    if (!isSupabaseConfigured) {
      setError("Supabase frontend environment variables are missing.");
      setIsSubmitting(false);
      return;
    }

    if (mode === "login") {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      setIsSubmitting(false);

      if (authError) {
        setError(authError.message);
        return;
      }

      consumeAuthReturnTo();
      onClose();
      router.push(destination);
      router.refresh();
      return;
    }

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    setIsSubmitting(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    if (!data.session) {
      setNotice("Check your email to confirm your account, then sign in.");
      return;
    }

    consumeAuthReturnTo();
    onClose();
    router.push(destination);
    router.refresh();
  }

  async function handleGoogleAuth() {
    setError("");
    setNotice("");

    if (!isSupabaseConfigured) {
      setError("Supabase frontend environment variables are missing.");
      return;
    }

    const remembered = rememberAuthReturnTo(destination);
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}${remembered ? "/profile" : destination}`,
      },
    });

    if (authError) {
      consumeAuthReturnTo();
      setError(authError.message);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-0 m-0 flex h-dvh max-h-none w-full max-w-none items-center justify-center overflow-y-auto border-0 bg-transparent px-4 py-6 backdrop:bg-black/75 backdrop:backdrop-blur-md"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab" || event.ctrlKey || event.metaKey) return;
        const elements = [
          ...event.currentTarget.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex='0']",
          ),
        ].filter((element) => element.getClientRects().length > 0);
        const first = elements[0],
          last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="relative grid max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-xl border border-white/10 bg-[#09090B] shadow-2xl shadow-black/60 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden min-h-[620px] overflow-hidden bg-[#111827] lg:block">
          <img
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover opacity-58"
            src="https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=1400&auto=format&fit=crop"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,9,11,0.1),#09090B),linear-gradient(90deg,#09090B_0%,rgba(9,9,11,0.44))]" />
          <div className="relative flex h-full flex-col justify-end p-8">
            <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-medium text-white backdrop-blur">
              <Sparkles className="size-3 text-[#A7F3D0]" />
              Video-first actor marketplace
            </div>
            <h2 className="max-w-lg text-5xl font-semibold leading-none tracking-normal text-white">
              Human performance, ready for AI video.
            </h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-[#D1D5DB]">
              Create, discover, and manage cinematic performer profiles with consent-first access.
            </p>
          </div>
        </section>

        <section className="overflow-y-auto p-5 text-[#F9FAFB] sm:p-8">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-[#9CA3AF]">ActByMe</p>
              <h2 id={titleId} className="mt-1 text-3xl font-semibold">
                {mode === "login" ? "Log in" : "Sign up"}
              </h2>
            </div>
            <button
              aria-label="Fermer la connexion"
              className="rounded-md p-2 text-[#9CA3AF] transition hover:bg-[#111827] hover:text-white"
              onClick={onClose}
              type="button"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="mb-6 grid grid-cols-2 rounded-full border border-[#1F2937] bg-[#111827] p-1">
            <button
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                mode === "login" ? "bg-white text-[#09090B]" : "text-[#9CA3AF] hover:text-white"
              }`}
              onClick={() => switchMode("login")}
              type="button"
            >
              Login
            </button>
            <button
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                mode === "signup" ? "bg-white text-[#09090B]" : "text-[#9CA3AF] hover:text-white"
              }`}
              onClick={() => switchMode("signup")}
              type="button"
            >
              Sign up
            </button>
          </div>

          <form aria-busy={isSubmitting} className="space-y-4" onSubmit={handleEmailAuth}>
            <AuthField
              label="Email"
              onChange={setEmail}
              placeholder="you@example.com"
              type="email"
              autoComplete="email"
              value={email}
            />
            <AuthField
              label="Password"
              onChange={setPassword}
              placeholder={mode === "signup" ? "Minimum 6 characters" : "Your password"}
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
            />
            {error ? <AuthMessage message={error} tone="error" /> : null}
            {notice ? <AuthMessage message={notice} tone="info" /> : null}
            <Button className="w-full rounded-full" disabled={isSubmitting} size="lg" type="submit">
              {isSubmitting
                ? mode === "login"
                  ? "Logging in..."
                  : "Creating account..."
                : mode === "login"
                  ? "Login"
                  : "Create account"}
              <ArrowRight className="size-4" />
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs uppercase text-[#6B7280]">
            <span className="h-px flex-1 bg-[#1F2937]" />
            or
            <span className="h-px flex-1 bg-[#1F2937]" />
          </div>

          <Button
            className="w-full rounded-full"
            onClick={handleGoogleAuth}
            size="lg"
            type="button"
            variant="outline"
          >
            <span
              aria-hidden="true"
              className="flex size-5 items-center justify-center rounded-full bg-white text-xs font-bold text-[#111827]"
            >
              G
            </span>
            Continue with Google
          </Button>
        </section>
      </div>
    </dialog>
  );
}

function AuthField({
  label,
  onChange,
  placeholder,
  type,
  value,
  autoComplete,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  type: string;
  value: string;
  autoComplete: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#D1D5DB]">{label}</span>
      <input
        autoComplete={autoComplete}
        className="h-12 w-full rounded-lg border border-[#1F2937] bg-[#111827] px-4 text-sm text-[#F9FAFB] outline-none transition placeholder:text-[#6B7280] focus:border-white"
        minLength={type === "password" ? 6 : undefined}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required
        type={type}
        value={value}
      />
    </label>
  );
}

function AuthMessage({ message, tone }: { message: string; tone: "error" | "info" }) {
  const className =
    tone === "error"
      ? "border-red-500/40 bg-red-500/10 text-red-100"
      : "border-[#14B8A6]/40 bg-[#14B8A6]/10 text-[#CCFBF1]";

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-lg border px-4 py-3 text-sm ${className}`}
    >
      {message}
    </div>
  );
}
