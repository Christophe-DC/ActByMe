"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRight, Clapperboard, UserPlus } from "lucide-react";
import { Button, Card } from "@actbyme/ui";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [stageName, setStageName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
          role: "ACTOR",
          stageName,
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

    router.push("/onboarding/actor");
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
            Create your actor account.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[#9CA3AF]">
            Register for free, upload your public profile media, and build an AI-ready actor page
            you can share with agencies and studios.
          </p>
          <div className="mt-8 flex items-center gap-3 text-sm text-[#C7D2FE]">
            <ArrowRight className="size-4" />
            Images and public reels upload to the actor-public bucket.
          </div>
        </section>

        <Card className="p-6 md:p-8">
          <h2 className="text-3xl font-semibold">Actor registration</h2>
          <p className="mt-2 text-sm leading-6 text-[#9CA3AF]">
            This creates a Supabase auth user with the ACTOR role in user metadata.
          </p>
          <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
            <AuthField
              label="Stage name"
              onChange={setStageName}
              placeholder="Maya Laurent"
              type="text"
              value={stageName}
            />
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
              {isSubmitting ? "Creating account..." : "Create actor account"}
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
