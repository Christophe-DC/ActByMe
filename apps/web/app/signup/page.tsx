"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Clapperboard, UserPlus } from "lucide-react";
import { Button, Card } from "@actbyme/ui";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { accountRoles, destinationForRole, type AccountRole } from "@/lib/auth/roles";

export default function SignupPage() {
  const router = useRouter();
  const [role, setRole] = useState<AccountRole>("ACTOR");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const requestedRole = new URLSearchParams(window.location.search).get("role");

    if (requestedRole === "CLIENT" || requestedRole === "AGENCY" || requestedRole === "ACTOR") {
      setRole(requestedRole);
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setIsSubmitting(true);

    if (!isSupabaseConfigured) {
      setError("Supabase frontend environment variables are missing.");
      setIsSubmitting(false);
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

    router.push(destinationForRole(role));
  }

  async function handleGoogleSignup() {
    setError("");

    if (!isSupabaseConfigured) {
      setError("Supabase frontend environment variables are missing.");
      return;
    }

    window.localStorage.setItem("actbyme.pendingRole", role);

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}${destinationForRole(role)}`,
      },
    });

    if (authError) {
      setError(authError.message);
    }
  }

  return (
    <main className="min-h-screen bg-[#09090B] px-5 py-8 text-[#F9FAFB] md:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl gap-8 lg:grid-cols-[1fr_440px] lg:items-center">
        <section>
          <Link className="flex items-center gap-3" href="/">
            <span className="flex size-10 items-center justify-center rounded-md bg-[#6366F1]">
              <Clapperboard className="size-5" />
            </span>
            <span className="text-lg font-semibold">ActByMe</span>
          </Link>
          <h1 className="mt-12 max-w-3xl text-5xl font-semibold leading-none tracking-normal md:text-7xl">
            Create your ActByMe account.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[#9CA3AF]">
            Choose your role, then access the right MVP flow: actor onboarding or agency access
            request.
          </p>
          <div className="mt-8 flex items-center gap-3 text-sm text-[#C7D2FE]">
            <ArrowRight className="size-4" />
            Images and public reels upload to the actor-public bucket.
          </div>
        </section>

        <Card className="p-6 md:p-8">
          <h2 className="text-3xl font-semibold">Create account</h2>
          <p className="mt-2 text-sm leading-6 text-[#9CA3AF]">
            This creates a Supabase auth user with your selected role in user metadata.
          </p>
          <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
            <RolePicker role={role} onChange={setRole} />
            <Button
              className="w-full"
              onClick={handleGoogleSignup}
              size="lg"
              type="button"
              variant="outline"
            >
              <span className="flex size-5 items-center justify-center rounded-full bg-white text-xs font-bold text-[#111827]">
                G
              </span>
              Continue with Google
            </Button>
            <div className="flex items-center gap-3 text-xs uppercase text-[#6B7280]">
              <span className="h-px flex-1 bg-[#1F2937]" />
              or
              <span className="h-px flex-1 bg-[#1F2937]" />
            </div>
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
              placeholder="Minimum 6 characters"
              type="password"
              value={password}
            />
            {error ? <AuthMessage tone="error" message={error} /> : null}
            {notice ? <AuthMessage tone="info" message={notice} /> : null}
            <Button className="w-full" disabled={isSubmitting} size="lg" type="submit">
              {isSubmitting ? "Creating account..." : "Create account"}
              <UserPlus className="size-4" />
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-[#9CA3AF]">
            Already registered?{" "}
            <Link className="font-medium text-[#C7D2FE]" href="/login">
              Sign in
            </Link>
          </p>
        </Card>
      </div>
    </main>
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
      <div className="grid gap-2">
        {accountRoles.map((option) => (
          <label
            className={`cursor-pointer rounded-md border p-3 transition ${
              role === option.value
                ? "border-[#6366F1] bg-[#6366F1]/15"
                : "border-[#1F2937] bg-[#09090B] hover:border-[#374151]"
            }`}
            key={option.value}
          >
            <input
              checked={role === option.value}
              className="sr-only"
              name="role"
              onChange={() => onChange(option.value)}
              type="radio"
              value={option.value}
            />
            <span className="block text-sm font-semibold text-[#F9FAFB]">{option.value}</span>
            <span className="mt-1 block text-xs leading-5 text-[#9CA3AF]">
              {option.description}
            </span>
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
        className="h-12 w-full rounded-md border border-[#1F2937] bg-[#09090B] px-4 text-sm text-[#F9FAFB] outline-none transition placeholder:text-[#6B7280] focus:border-[#6366F1]"
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

  return <div className={`rounded-md border px-4 py-3 text-sm ${className}`}>{message}</div>;
}
