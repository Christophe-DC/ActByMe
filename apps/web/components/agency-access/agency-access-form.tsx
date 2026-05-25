"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Globe2,
  Mail,
  MessageSquare,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Button, Card } from "@actbyme/ui";

const interestedSkills = [
  "UGC actors",
  "Multilingual actors",
  "Motion actors",
  "Martial arts",
  "Dancing",
  "Voice/accent",
  "AI video reference performance",
];

const volumeOptions = [
  "1-5 videos / month",
  "6-20 videos / month",
  "21-50 videos / month",
  "50+ videos / month",
  "Not sure yet",
];

type AgencyAccessDraft = {
  companyName: string;
  country: string;
  email: string;
  fullName: string;
  interestedSkills: string[];
  message: string;
  monthlyVolume: string;
  role: string;
  website: string;
  whatLookingFor: string;
};

const initialDraft: AgencyAccessDraft = {
  companyName: "",
  country: "",
  email: "",
  fullName: "",
  interestedSkills: [],
  message: "",
  monthlyVolume: "",
  role: "",
  website: "",
  whatLookingFor: "",
};

export function AgencyAccessForm() {
  const router = useRouter();
  const [draft, setDraft] = useState<AgencyAccessDraft>(initialDraft);

  function updateDraft(patch: Partial<AgencyAccessDraft>) {
    setDraft((current) => ({
      ...current,
      ...patch,
    }));
  }

  function toggleSkill(skill: string) {
    setDraft((current) => ({
      ...current,
      interestedSkills: current.interestedSkills.includes(skill)
        ? current.interestedSkills.filter((item) => item !== skill)
        : [...current.interestedSkills, skill],
    }));
  }

  function submitMockRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    window.localStorage.setItem(
      "actbyme.agencyAccessRequest",
      JSON.stringify({
        ...draft,
        submittedAt: new Date().toISOString(),
      }),
    );
    router.push("/agency-access/thank-you");
  }

  return (
    <form
      action="/agency-access/thank-you"
      className="grid gap-6 lg:grid-cols-[1fr_360px]"
      onSubmit={submitMockRequest}
    >
      <Card className="space-y-6 p-5 md:p-7">
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            icon={<UserRound className="size-4" />}
            label="Full name"
            onChange={(value) => updateDraft({ fullName: value })}
            placeholder="Jordan Blake"
            required
            value={draft.fullName}
          />
          <TextField
            icon={<Building2 className="size-4" />}
            label="Company name"
            onChange={(value) => updateDraft({ companyName: value })}
            placeholder="Northstar Studio"
            required
            value={draft.companyName}
          />
          <TextField
            icon={<BadgeCheck className="size-4" />}
            label="Role"
            onChange={(value) => updateDraft({ role: value })}
            placeholder="Creative director"
            value={draft.role}
          />
          <TextField
            icon={<Mail className="size-4" />}
            label="Email"
            onChange={(value) => updateDraft({ email: value })}
            placeholder="you@studio.com"
            required
            type="email"
            value={draft.email}
          />
          <TextField
            icon={<Globe2 className="size-4" />}
            label="Website"
            onChange={(value) => updateDraft({ website: value })}
            placeholder="https://studio.com"
            type="url"
            value={draft.website}
          />
          <TextField
            icon={<Globe2 className="size-4" />}
            label="Country"
            onChange={(value) => updateDraft({ country: value })}
            placeholder="United States"
            value={draft.country}
          />
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[#D1D5DB]">
            What are you looking for?
          </span>
          <textarea
            className="min-h-28 w-full rounded-md border border-[#1F2937] bg-[#09090B] px-4 py-3 text-sm leading-6 text-[#F9FAFB] outline-none transition placeholder:text-[#6B7280] focus:border-[#6366F1]"
            onChange={(event) => updateDraft({ whatLookingFor: event.target.value })}
            placeholder="Tell us the type of actors, performances, productions, or AI video workflows you want to support."
            value={draft.whatLookingFor}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[#D1D5DB]">
            Expected monthly video volume
          </span>
          <select
            className="h-12 w-full rounded-md border border-[#1F2937] bg-[#09090B] px-4 text-sm text-[#F9FAFB] outline-none transition focus:border-[#6366F1]"
            onChange={(event) => updateDraft({ monthlyVolume: event.target.value })}
            value={draft.monthlyVolume}
          >
            <option value="">Select volume</option>
            {volumeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div>
          <p className="mb-3 text-sm font-medium text-[#D1D5DB]">Interested skills</p>
          <div className="flex flex-wrap gap-2">
            {interestedSkills.map((skill) => {
              const isSelected = draft.interestedSkills.includes(skill);

              return (
                <button
                  className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
                    isSelected
                      ? "border-[#6366F1] bg-[#6366F1]/18 text-[#F9FAFB]"
                      : "border-[#1F2937] bg-[#09090B] text-[#9CA3AF] hover:border-[#6366F1]/60 hover:text-[#F9FAFB]"
                  }`}
                  key={skill}
                  onClick={() => toggleSkill(skill)}
                  type="button"
                >
                  {isSelected ? <Sparkles className="size-4 text-[#14B8A6]" /> : null}
                  {skill}
                </button>
              );
            })}
          </div>
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[#D1D5DB]">Message</span>
          <textarea
            className="min-h-32 w-full rounded-md border border-[#1F2937] bg-[#09090B] px-4 py-3 text-sm leading-6 text-[#F9FAFB] outline-none transition placeholder:text-[#6B7280] focus:border-[#6366F1]"
            onChange={(event) => updateDraft({ message: event.target.value })}
            placeholder="Add timeline, preferred regions, budget context, or anything else useful."
            value={draft.message}
          />
        </label>

        <Button className="w-full sm:w-auto" size="lg" type="submit">
          Request agency access
          <ArrowRight className="size-4" />
        </Button>
      </Card>

      <aside className="space-y-5">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <MessageSquare className="size-5 text-[#14B8A6]" />
            <h2 className="font-semibold">No dashboard yet</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-[#9CA3AF]">
            This early-access flow only captures interest. Client dashboards, bookings, payments,
            and production workflows are not implemented.
          </p>
        </Card>
        <Card className="bg-[linear-gradient(135deg,rgba(99,102,241,0.22),rgba(17,24,39,0.96))] p-5">
          <p className="text-sm uppercase text-[#C7D2FE]">Best fit</p>
          <h2 className="mt-3 text-2xl font-semibold">AI video teams sourcing actor-led inputs.</h2>
          <p className="mt-3 text-sm leading-6 text-[#D1D5DB]">
            Use this for UGC campaigns, reference performances, multilingual scenes, motion reels,
            voice tests, and action-specific casting research.
          </p>
        </Card>
      </aside>
    </form>
  );
}

function TextField({
  icon,
  label,
  onChange,
  placeholder,
  required = false,
  type = "text",
  value,
}: {
  icon: React.ReactNode;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 text-sm font-medium text-[#D1D5DB]">
        <span className="text-[#14B8A6]">{icon}</span>
        {label}
      </span>
      <input
        className="h-12 w-full rounded-md border border-[#1F2937] bg-[#09090B] px-4 text-sm text-[#F9FAFB] outline-none transition placeholder:text-[#6B7280] focus:border-[#6366F1]"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}
