"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles, X } from "lucide-react";
import { Button } from "@actbyme/ui";
import { accountRoles, type AccountRole } from "@/lib/auth/roles";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

type AuthMode = "login" | "signup";

export function AuthModal({
  initialMode,
  onClose,
  open,
}: {
  initialMode: AuthMode;
  onClose: () => void;
  open: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [role, setRole] = useState<AccountRole>("ACTOR");
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

      onClose();
      router.push("/profile");
      router.refresh();
      return;
    }

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role,
        },
      },
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

    onClose();
    router.push("/profile");
    router.refresh();
  }

  async function handleGoogleAuth() {
    setError("");
    setNotice("");

    if (!isSupabaseConfigured) {
      setError("Supabase frontend environment variables are missing.");
      return;
    }

    if (mode === "signup") {
      window.localStorage.setItem("actbyme.pendingRole", role);
    }

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/profile`,
      },
    });

    if (authError) {
      setError(authError.message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button
        aria-label="Close authentication modal"
        className="absolute inset-0 bg-black/75 backdrop-blur-md"
        onClick={onClose}
        type="button"
      />
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
              <h2 className="mt-1 text-3xl font-semibold">
                {mode === "login" ? "Log in" : "Sign up"}
              </h2>
            </div>
            <button
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

          <form className="space-y-4" onSubmit={handleEmailAuth}>
            {mode === "signup" ? <RolePicker onChange={setRole} role={role} /> : null}
            <AuthField
              label="Email"
              onChange={setEmail}
              placeholder="you@example.com"
              type="email"
              value={email}
            />
            <AuthField
              label="Password"
              onChange={setPassword}
              placeholder={mode === "signup" ? "Minimum 6 characters" : "Your password"}
              type="password"
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
            <span className="flex size-5 items-center justify-center rounded-full bg-white text-xs font-bold text-[#111827]">
              G
            </span>
            Continue with Google
          </Button>
        </section>
      </div>
    </div>
  );
}

function RolePicker({
  onChange,
  role,
}: {
  onChange: (role: AccountRole) => void;
  role: AccountRole;
}) {
  return (
    <fieldset>
      <legend className="mb-2 block text-sm font-medium text-[#D1D5DB]">Account role</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {accountRoles.map((option) => (
          <label
            className={`cursor-pointer rounded-lg border p-3 transition ${
              role === option.value
                ? "border-white bg-white text-[#09090B]"
                : "border-[#1F2937] bg-[#111827] text-[#F9FAFB] hover:border-[#374151]"
            }`}
            key={option.value}
          >
            <input
              checked={role === option.value}
              className="sr-only"
              name="modal-role"
              onChange={() => onChange(option.value)}
              type="radio"
              value={option.value}
            />
            <span className="block text-xs font-semibold">{option.value}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function AuthField({
  label,
  onChange,
  placeholder,
  type,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  type: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#D1D5DB]">{label}</span>
      <input
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

  return <div className={`rounded-lg border px-4 py-3 text-sm ${className}`}>{message}</div>;
}
