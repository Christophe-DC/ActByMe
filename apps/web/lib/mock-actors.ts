export interface MockActor {
  id: string;
  slug: string;
  name: string;
  location: string;
  languages: string[];
  accents: string[];
  headline: string;
  bio: string;
  skills: string[];
  motionSkills: { category: string; items: string[] }[];
  voiceSkills: string[];
  score: number;
  isDemo: boolean;
  profileImage?: string;
  videoThumbnail?: string;
  videos: { title: string; duration: string; category: string }[];
}

export const MOCK_ACTORS: MockActor[] = [
  {
    id: "actor-1",
    slug: "alex-rivera",
    name: "Alex Rivera",
    location: "Los Angeles, CA",
    languages: ["English", "Spanish"],
    accents: ["American", "Mexican"],
    headline: "Dramatic actor & motion specialist",
    bio: "Classically trained actor with 8 years of experience in independent films, theater, and commercial work. Specialized in intense emotional scenes and parkour-style movement.",
    skills: ["Acting", "Emotional Performance", "Body Movement"],
    motionSkills: [
      { category: "Dance", items: ["Contemporary", "Hip-hop"] },
      { category: "Martial Arts", items: ["Basic fighting", "Parkour"] },
      { category: "Stunts", items: ["Free falls (up to 10 ft)", "Basic vehicle work"] },
    ],
    voiceSkills: ["Character voices", "Accents"],
    score: 92,
    isDemo: false,
    videos: [
      { title: "Acting Reel", duration: "2:15", category: "acting" },
      { title: "Movement Showcase", duration: "1:30", category: "motion" },
      { title: "Voice Reel", duration: "0:45", category: "voice" },
    ],
  },
  {
    id: "actor-2",
    slug: "jordan-lee",
    name: "Jordan Lee",
    location: "New York, NY",
    languages: ["English", "Mandarin"],
    accents: ["American", "Beijing"],
    headline: "Action hero & martial arts expert",
    bio: "Stunt performer turned actor. 10+ years in martial arts film production. Black belt in Taekwondo and Kung Fu. Available for action-heavy roles and stunts.",
    skills: ["Martial Arts", "Stunts & Action", "Emotional Performance"],
    motionSkills: [
      { category: "Martial Arts", items: ["Taekwondo", "Kung Fu", "Sword fighting"] },
      { category: "Stunts", items: ["High falls", "Vehicle work", "Fire burns"] },
      { category: "Body Movement", items: ["Flexible movement", "Animal mimicry"] },
    ],
    voiceSkills: ["Dubbing"],
    score: 88,
    isDemo: false,
    videos: [
      { title: "Action Reel", duration: "3:00", category: "stunts" },
      { title: "Martial Arts Demo", duration: "1:45", category: "motion" },
    ],
  },
  {
    id: "actor-3",
    slug: "demo-profile-sam",
    name: "Sam Morgan",
    location: "Austin, TX",
    languages: ["English"],
    accents: ["American Southern"],
    headline: "Versatile character actor",
    bio: "This is a demo profile showcasing the ActByMe platform. Real actors will have complete profiles with verified credentials.",
    skills: ["Acting", "Emotional Performance"],
    motionSkills: [{ category: "Dance", items: ["Ballroom"] }],
    voiceSkills: ["Standard narration"],
    score: 76,
    isDemo: true,
    videos: [{ title: "Sample Reel", duration: "1:20", category: "acting" }],
  },
  {
    id: "actor-4",
    slug: "priya-patel",
    name: "Priya Patel",
    location: "London, UK",
    languages: ["English", "Hindi", "Gujarati"],
    accents: ["British", "Indian"],
    headline: "Singer & dancer",
    bio: "Professional dancer and vocalist with musical theater background. Bilingual in English and Hindi. Trained in Bollywood choreography and contemporary dance.",
    skills: ["Singing", "Dance & Movement", "Emotional Performance"],
    motionSkills: [
      { category: "Dance", items: ["Bollywood", "Contemporary", "Ballet basics"] },
      { category: "Sports", items: ["Gymnastics"] },
    ],
    voiceSkills: ["Singing (alto)", "Accents"],
    score: 85,
    isDemo: false,
    videos: [
      { title: "Dance Reel", duration: "2:30", category: "motion" },
      { title: "Singing Showcase", duration: "1:15", category: "voice" },
    ],
  },
  {
    id: "actor-5",
    slug: "marcus-williams",
    name: "Marcus Williams",
    location: "Atlanta, GA",
    languages: ["English", "French"],
    accents: ["American Southern", "French"],
    headline: "Comedic & dramatic actor",
    bio: "Award-winning stage actor with strong comedic timing. 12 years in regional theater and indie films. Strong emotional range and character work.",
    skills: ["Acting", "Emotional Performance", "Voice Performance"],
    motionSkills: [
      { category: "Dance", items: ["Tap dancing"] },
      { category: "Body Movement", items: ["Physical comedy", "Expressive gestures"] },
    ],
    voiceSkills: ["Character voices", "Singing (baritone)"],
    score: 90,
    isDemo: false,
    videos: [
      { title: "Acting Reel", duration: "2:45", category: "acting" },
      { title: "Comedy Scenes", duration: "1:50", category: "acting" },
    ],
  },
];

export function getActorBySlug(slug: string): MockActor | undefined {
  return MOCK_ACTORS.find((actor) => actor.slug === slug);
}

export function searchActors(query: string): MockActor[] {
  const q = query.toLowerCase();
  return MOCK_ACTORS.filter(
    (actor) =>
      actor.name.toLowerCase().includes(q) ||
      actor.headline.toLowerCase().includes(q) ||
      actor.skills.some((skill) => skill.toLowerCase().includes(q)),
  );
}

export function filterActors(
  actors: MockActor[],
  filters: {
    language?: string;
    accent?: string;
    skill?: string;
    motionSkill?: string;
  },
): MockActor[] {
  return actors.filter((actor) => {
    if (filters.language && !actor.languages.includes(filters.language)) return false;
    if (filters.accent && !actor.accents.includes(filters.accent)) return false;
    if (filters.skill && !actor.skills.includes(filters.skill)) return false;
    if (
      filters.motionSkill &&
      !actor.motionSkills.some((m) => m.items.includes(filters.motionSkill!))
    ) {
      return false;
    }
    return true;
  });
}

export function sortActors(
  actors: MockActor[],
  sortBy: "featured" | "score" | "newest",
): MockActor[] {
  const sorted = [...actors];
  switch (sortBy) {
    case "score":
      return sorted.sort((a, b) => b.score - a.score);
    case "newest":
      return sorted.reverse();
    case "featured":
    default:
      return sorted.filter((a) => !a.isDemo);
  }
}

export const ALL_LANGUAGES = Array.from(new Set(MOCK_ACTORS.flatMap((a) => a.languages)));
export const ALL_ACCENTS = Array.from(new Set(MOCK_ACTORS.flatMap((a) => a.accents)));
export const ALL_SKILLS = Array.from(new Set(MOCK_ACTORS.flatMap((a) => a.skills)));
export const ALL_MOTION_CATEGORIES = Array.from(
  new Set(MOCK_ACTORS.flatMap((a) => a.motionSkills.map((m) => m.category))),
);
