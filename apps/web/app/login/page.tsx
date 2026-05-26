"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent, type ReactNode } from "react";
import { Clapperboard, LogIn } from "lucide-react";
import { Button, Card } from "@actbyme/ui";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { destinationForRole, normalizeAccountRole } from "@/lib/auth/roles";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    if (!isSupabaseConfigured) {
      setError("Supabase frontend environment variables are missing.");
      setIsSubmitting(false);
      return;
    }

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsSubmitting(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    const role = normalizeAccountRole(data.user?.user_metadata?.role);
    const requestedNext = searchParams.get("next");
    const fallbackDestination = destinationForRole(role);
    const destination =
      requestedNext && isAllowedNextForRole(requestedNext, role)
        ? requestedNext
        : fallbackDestination;

    router.push(destination);
  }

  return (
    <AuthShell
      asideTitle="Continue to your ActByMe workspace."
      footer={
        <p>
          No account yet?{" "}
          <Link className="font-medium text-[#C7D2FE]" href="/signup">
            Create one
          </Link>
        </p>
      }
      title="Sign in"
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
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
          placeholder="Your password"
          type="password"
          value={password}
        />
        {error ? <AuthError message={error} /> : null}
        <Button className="w-full" disabled={isSubmitting} size="lg" type="submit">
          {isSubmitting ? "Signing in..." : "Sign in"}
          <LogIn className="size-4" />
        </Button>
      </form>
    </AuthShell>
  );
}

function LoginFallback() {
  return (
    <AuthShell
      asideTitle="Continue to your ActByMe workspace."
      footer={
        <p>
          No account yet?{" "}
          <Link className="font-medium text-[#C7D2FE]" href="/signup">
            Create one
          </Link>
        </p>
      }
      title="Sign in"
    >
      <div className="rounded-md border border-[#1F2937] bg-[#09090B] px-4 py-3 text-sm text-[#9CA3AF]">
        Loading sign-in form...
      </div>
    </AuthShell>
  );
}

function isAllowedNextForRole(next: string | null, role: ReturnType<typeof normalizeAccountRole>) {
  if (!next) {
    return false;
  }

  if (role === "ACTOR") {
    return next.startsWith("/onboarding/actor");
  }

  return next.startsWith("/agency-access");
}

function AuthShell({
  asideTitle,
  children,
  footer,
  title,
}: {
  asideTitle: string;
  children: ReactNode;
  footer: ReactNode;
  title: string;
}) {
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
            {asideTitle}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[#9CA3AF]">
            Actors continue onboarding. Clients and agencies can request access to the ActByMe
            marketplace preview.
          </p>
        </section>

        <Card className="p-6 md:p-8">
          <h2 className="text-3xl font-semibold">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-[#9CA3AF]">
            Supabase authentication powers this MVP account flow.
          </p>
          <div className="mt-7">{children}</div>
          <div className="mt-6 text-center text-sm text-[#9CA3AF]">{footer}</div>
        </Card>
      </div>
    </main>
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
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required
        type={type}
        value={value}
      />
    </label>
  );
}

function AuthError({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
      {message}
    </div>
  );
}
