export type MatchableActor = {
  id: string;
  actAiScore: number | null;
  country: string | null;
  isDemo: boolean;
  status: string;
  languages: Array<{ language: string }>;
  accents: Array<{ accent: string }>;
  skills: Array<{ category: string; label: string | null }>;
};

export type ActorRecommendation = {
  actorId: string;
  score: number;
  matches: string[];
};

const normalize = (value: string) => value.trim().toLocaleLowerCase().replace(/[_-]+/g, " ");

function includesRequirement(values: string[], requirement: string) {
  const target = normalize(requirement);
  if (!target || ["any", "none", "not specified", "n/a"].includes(target)) return false;
  return values.some((value) => {
    const normalized = normalize(value);
    return normalized === target || normalized.includes(target) || target.includes(normalized);
  });
}

export function recommendActors(
  actors: MatchableActor[],
  requirements: { language?: string | null; accent?: string | null; skills?: string[] },
  limit = 5,
): ActorRecommendation[] {
  return actors
    .filter((actor) => actor.status === "APPROVED" && !actor.isDemo)
    .map((actor) => {
      const matches: string[] = [];
      let score = 0;
      const languages = actor.languages.map((item) => item.language);
      const accents = actor.accents.map((item) => item.accent);
      const skills = actor.skills.flatMap((item) => [item.category, item.label ?? ""]);

      if (requirements.language && includesRequirement(languages, requirements.language)) {
        score += 45;
        matches.push(requirements.language);
      }
      if (requirements.accent && includesRequirement(accents, requirements.accent)) {
        score += 20;
        matches.push(`${requirements.accent} accent`);
      }
      for (const requiredSkill of requirements.skills ?? []) {
        if (includesRequirement(skills, requiredSkill)) {
          score += 10;
          matches.push(requiredSkill);
        }
      }
      score += Math.round(Math.max(0, Math.min(100, actor.actAiScore ?? 0)) * 0.25);

      return { actorId: actor.id, matches, score: Math.min(100, score) };
    })
    .sort((left, right) => right.score - left.score || left.actorId.localeCompare(right.actorId))
    .slice(0, Math.max(0, limit));
}

export function canAccessAssignedProject(input: {
  userId: string;
  ownerId: string;
  assignedActorUserId?: string | null;
}) {
  return input.userId === input.ownerId || input.userId === input.assignedActorUserId;
}

export function assignmentStatusForQaResult(result: "PASS" | "FAIL") {
  return result === "PASS" ? "QA_PASSED" : "QA_FAILED";
}

export function assignmentStatusForReplacement(current: string) {
  return current === "QA_FAILED" ? "ACCEPTED" : current;
}
