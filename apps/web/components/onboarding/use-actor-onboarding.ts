"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { defaultOnboardingDraft, type ActorOnboardingDraft } from "./onboarding-data";

const storageKey = "actbyme.actorOnboardingDraft";

export function useActorOnboarding() {
  const [draft, setDraft] = useState<ActorOnboardingDraft>(defaultOnboardingDraft);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let nextDraft = defaultOnboardingDraft;
    const stored = window.localStorage.getItem(storageKey);

    if (stored) {
      try {
        nextDraft = { ...defaultOnboardingDraft, ...JSON.parse(stored) };
      } catch {
        nextDraft = defaultOnboardingDraft;
      }
    }

    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      const stageName =
        typeof user?.user_metadata?.stageName === "string" ? user.user_metadata.stageName : "";

      setDraft({
        ...nextDraft,
        email: user?.email ?? nextDraft.email,
        stageName: nextDraft.stageName || stageName,
      });
      setIsLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(draft));
  }, [draft, isLoaded]);

  function updateDraft(patch: Partial<ActorOnboardingDraft>) {
    setDraft((current) => ({
      ...current,
      ...patch,
    }));
  }

  function toggleArrayValue(
    key: "languages" | "accents" | "actingStyles" | "skills",
    value: string,
  ) {
    setDraft((current) => {
      const currentValues = current[key];
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value];

      return {
        ...current,
        [key]: nextValues,
      };
    });
  }

  function updateVideo(id: string, value: string, url = "") {
    setDraft((current) => ({
      ...current,
      videos: {
        ...current.videos,
        [id]: value,
      },
      videoUrls: {
        ...current.videoUrls,
        [id]: url || current.videoUrls[id] || "",
      },
    }));
  }

  function updateConsent(id: string, value: boolean) {
    setDraft((current) => ({
      ...current,
      consent: {
        ...current.consent,
        [id]: value,
      },
    }));
  }

  return {
    draft,
    isLoaded,
    toggleArrayValue,
    updateConsent,
    updateDraft,
    updateVideo,
  };
}
