"use client";

import { useEffect, useState } from "react";
import { defaultOnboardingDraft, type ActorOnboardingDraft } from "./onboarding-data";

const storageKey = "actbyme.actorOnboardingDraft";

export function useActorOnboarding() {
  const [draft, setDraft] = useState<ActorOnboardingDraft>(defaultOnboardingDraft);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);

    if (stored) {
      try {
        setDraft({ ...defaultOnboardingDraft, ...JSON.parse(stored) });
      } catch {
        setDraft(defaultOnboardingDraft);
      }
    }

    setIsLoaded(true);
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

  function updateVideo(id: string, value: string) {
    setDraft((current) => ({
      ...current,
      videos: {
        ...current.videos,
        [id]: value,
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
