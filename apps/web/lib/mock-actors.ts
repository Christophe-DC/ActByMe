export type SortOption = "featured" | "score" | "newest";

export type VideoAsset = {
  title: string;
  category: string;
  duration: string;
  thumbnail: string;
};

export type MotionGroup = {
  category: "Dance" | "Martial arts" | "Stunts" | "Body tricks" | "Sports" | "Action scenes";
  items: string[];
  description: string;
};

export type AiTransformation = {
  originalLabel: string;
  resultLabel: string;
  originalImage: string;
  resultImage: string;
};

export type MockActor = {
  id: string;
  slug: string;
  name: string;
  location: string;
  country: string;
  languages: string[];
  accents: string[];
  actingStyles: string[];
  headline: string;
  bio: string;
  topSkills: string[];
  motionSkills: MotionGroup[];
  voiceSkills: string[];
  dance: string[];
  martialArts: string[];
  singing: string[];
  stunts: string[];
  availability: string;
  score: number;
  isFeatured: boolean;
  isDemo: boolean;
  joinedAt: string;
  profileImage: string;
  heroImage: string;
  heroVideoUrl?: string;
  videoThumbnail: string;
  videos: VideoAsset[];
  aiTransformation: AiTransformation;
};

export const MOCK_ACTORS: MockActor[] = [
  {
    id: "actor-1",
    slug: "maya-laurent",
    name: "Maya Laurent",
    location: "Paris, France",
    country: "France",
    languages: ["French", "English", "Spanish"],
    accents: ["Parisian French", "Neutral English", "Castilian Spanish"],
    actingStyles: ["Cinematic drama", "Luxury commercial", "Motion capture"],
    headline: "Cinematic performer with dance-driven action range.",
    bio: "Demo profile showing how an actor can present dramatic performance, precise movement, and multilingual delivery for AI-powered video production.",
    topSkills: ["Dramatic acting", "Contemporary dance", "Motion capture", "Luxury voiceover"],
    motionSkills: [
      {
        category: "Dance",
        items: ["Contemporary", "Floorwork", "Partner lifts"],
        description: "Fluid, camera-aware movement with strong emotional shape.",
      },
      {
        category: "Martial arts",
        items: ["Screen combat", "Rapier basics"],
        description: "Clean fight beats built for close-up coverage.",
      },
      {
        category: "Stunts",
        items: ["Controlled falls", "Wire rehearsal"],
        description: "Action-friendly timing with rehearsal discipline.",
      },
      {
        category: "Body tricks",
        items: ["Backbend", "Isolations", "Creature posture"],
        description: "Expressive physical transformations for character work.",
      },
      {
        category: "Sports",
        items: ["Climbing", "Trail running"],
        description: "Athletic endurance and outdoor movement vocabulary.",
      },
      {
        category: "Action scenes",
        items: ["Chase beats", "Hand-to-hand reactions"],
        description: "Readable action choices for AI character transfer.",
      },
    ],
    voiceSkills: ["French narration", "Soft luxury read", "Emotional whisper", "Spanish dialogue"],
    dance: ["Contemporary", "Ballet basics", "Improvisation"],
    martialArts: ["Screen combat", "Rapier basics"],
    singing: ["Alto", "Chanson"],
    stunts: ["Controlled falls", "Wire rehearsal"],
    availability: "Available now",
    score: 94,
    isFeatured: true,
    isDemo: true,
    joinedAt: "2026-05-10",
    profileImage:
      "https://images.unsplash.com/photo-1512316609839-ce289d3eba0a?q=80&w=900&auto=format&fit=crop",
    heroImage:
      "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=1800&auto=format&fit=crop",
    videoThumbnail:
      "https://images.unsplash.com/photo-1508700929628-666bc8bd84ea?q=80&w=1200&auto=format&fit=crop",
    videos: [
      {
        title: "Night-market monologue",
        category: "Acting",
        duration: "02:16",
        thumbnail:
          "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?q=80&w=900&auto=format&fit=crop",
      },
      {
        title: "Contemporary motion reel",
        category: "Dance",
        duration: "01:34",
        thumbnail:
          "https://images.unsplash.com/photo-1504609813442-a8924e83f76e?q=80&w=900&auto=format&fit=crop",
      },
      {
        title: "Accent and whisper reads",
        category: "Voice",
        duration: "00:58",
        thumbnail:
          "https://images.unsplash.com/photo-1516280440614-37939bbacd81?q=80&w=900&auto=format&fit=crop",
      },
    ],
    aiTransformation: {
      originalLabel: "Original actor motion",
      resultLabel: "AI character result",
      originalImage:
        "https://images.unsplash.com/photo-1518611012118-696072aa579a?q=80&w=900&auto=format&fit=crop",
      resultImage:
        "https://images.unsplash.com/photo-1535223289827-42f1e9919769?q=80&w=900&auto=format&fit=crop",
    },
  },
  {
    id: "actor-2",
    slug: "jordan-kaito",
    name: "Jordan Kaito",
    location: "Los Angeles, USA",
    country: "United States",
    languages: ["English", "Japanese"],
    accents: ["General American", "Tokyo Japanese"],
    actingStyles: ["Action hero", "Sci-fi", "Commercial"],
    headline: "Action performer built for fast camera, stunt beats, and heroic reads.",
    bio: "Demo profile for an action-led actor profile with martial arts, stunts, weapon handling, and sharp vocal contrast.",
    topSkills: ["Martial arts", "Fight choreography", "Stunts", "Hero voice"],
    motionSkills: [
      {
        category: "Dance",
        items: ["Rhythm movement", "K-pop basics"],
        description: "Clean tempo and repeatable choreography marks.",
      },
      {
        category: "Martial arts",
        items: ["Taekwondo", "Boxing", "Katana forms"],
        description: "High-impact screen movement with clear silhouettes.",
      },
      {
        category: "Stunts",
        items: ["Falls", "Rolls", "Reaction hits"],
        description: "Camera-safe reactions for dynamic action shots.",
      },
      {
        category: "Body tricks",
        items: ["Kip-up", "Wall step", "Precision kicks"],
        description: "Athletic moments that read instantly in short-form video.",
      },
      {
        category: "Sports",
        items: ["Basketball", "Skate basics"],
        description: "Sport-specific movement for lifestyle and campaign work.",
      },
      {
        category: "Action scenes",
        items: ["Sword duel", "Rooftop chase", "Combat dialogue"],
        description: "Action storytelling with emotional continuity.",
      },
    ],
    voiceSkills: ["Hero trailer read", "Japanese dialogue", "Effort sounds", "Dubbing"],
    dance: ["Rhythm movement", "K-pop basics"],
    martialArts: ["Taekwondo", "Boxing", "Katana forms"],
    singing: ["Pop backing"],
    stunts: ["Falls", "Rolls", "Reaction hits"],
    availability: "Select dates",
    score: 91,
    isFeatured: true,
    isDemo: true,
    joinedAt: "2026-05-14",
    profileImage:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=900&auto=format&fit=crop",
    heroImage:
      "https://images.unsplash.com/photo-1526512340740-9217d0159da9?q=80&w=1800&auto=format&fit=crop",
    videoThumbnail:
      "https://images.unsplash.com/photo-1547347298-4074fc3086f0?q=80&w=1200&auto=format&fit=crop",
    videos: [
      {
        title: "Combat dialogue test",
        category: "Action",
        duration: "01:42",
        thumbnail:
          "https://images.unsplash.com/photo-1517438322307-e67111335449?q=80&w=900&auto=format&fit=crop",
      },
      {
        title: "Sword form capture",
        category: "Martial arts",
        duration: "00:52",
        thumbnail:
          "https://images.unsplash.com/photo-1591117207239-788bf8de6c3b?q=80&w=900&auto=format&fit=crop",
      },
      {
        title: "Trailer voice contrast",
        category: "Voice",
        duration: "00:44",
        thumbnail:
          "https://images.unsplash.com/photo-1516280440614-37939bbacd81?q=80&w=900&auto=format&fit=crop",
      },
    ],
    aiTransformation: {
      originalLabel: "Original stunt beat",
      resultLabel: "AI warrior result",
      originalImage:
        "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?q=80&w=900&auto=format&fit=crop",
      resultImage:
        "https://images.unsplash.com/photo-1518709268805-4e9042af2176?q=80&w=900&auto=format&fit=crop",
    },
  },
  {
    id: "actor-3",
    slug: "amina-okafor",
    name: "Amina Okafor",
    location: "London, UK",
    country: "United Kingdom",
    languages: ["English", "Yoruba", "French"],
    accents: ["London", "West African", "French"],
    actingStyles: ["Prestige drama", "Comedy", "Documentary narration"],
    headline: "Warm, precise performer with voice, comedy, and grounded drama.",
    bio: "Demo profile highlighting emotionally intelligent acting, multilingual voice reads, and social-first comedic timing.",
    topSkills: ["Drama", "Comedy timing", "Narration", "Accent range"],
    motionSkills: [
      {
        category: "Dance",
        items: ["Afrobeats", "Jazz basics"],
        description: "Joyful, high-energy movement with expressive rhythm.",
      },
      {
        category: "Martial arts",
        items: ["Stage combat basics"],
        description: "Simple, clean action beats for dramatic scenes.",
      },
      {
        category: "Stunts",
        items: ["Slaps", "Trips", "Safe reactions"],
        description: "Comedy and drama reactions with controlled timing.",
      },
      {
        category: "Body tricks",
        items: ["Physical comedy", "Character walk"],
        description: "Character-led body choices for memorable short scenes.",
      },
      {
        category: "Sports",
        items: ["Tennis", "Netball"],
        description: "Natural athletic realism for lifestyle spots.",
      },
      {
        category: "Action scenes",
        items: ["Interrogation", "Escape scene"],
        description: "High-stakes emotional choices under pressure.",
      },
    ],
    voiceSkills: ["Documentary narration", "Yoruba dialogue", "Comedy characters", "French read"],
    dance: ["Afrobeats", "Jazz basics"],
    martialArts: ["Stage combat basics"],
    singing: ["Mezzo-soprano", "Gospel"],
    stunts: ["Trips", "Safe reactions"],
    availability: "Available now",
    score: 89,
    isFeatured: false,
    isDemo: true,
    joinedAt: "2026-05-16",
    profileImage:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=900&auto=format&fit=crop",
    heroImage:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1800&auto=format&fit=crop",
    videoThumbnail:
      "https://images.unsplash.com/photo-1516280440614-37939bbacd81?q=80&w=1200&auto=format&fit=crop",
    videos: [
      {
        title: "Prestige drama close-up",
        category: "Acting",
        duration: "02:04",
        thumbnail:
          "https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=900&auto=format&fit=crop",
      },
      {
        title: "Voice and dialect sampler",
        category: "Voice",
        duration: "01:08",
        thumbnail:
          "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?q=80&w=900&auto=format&fit=crop",
      },
      {
        title: "Afrobeats movement",
        category: "Dance",
        duration: "00:49",
        thumbnail:
          "https://images.unsplash.com/photo-1504609813442-a8924e83f76e?q=80&w=900&auto=format&fit=crop",
      },
    ],
    aiTransformation: {
      originalLabel: "Original dramatic close-up",
      resultLabel: "AI cinematic character",
      originalImage:
        "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=900&auto=format&fit=crop",
      resultImage:
        "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=900&auto=format&fit=crop",
    },
  },
  {
    id: "actor-4",
    slug: "diego-morales",
    name: "Diego Morales",
    location: "Mexico City, Mexico",
    country: "Mexico",
    languages: ["Spanish", "English", "Portuguese"],
    accents: ["Mexican Spanish", "Neutral LatAm", "Brazilian Portuguese"],
    actingStyles: ["Telenovela", "Action comedy", "Sports commercial"],
    headline: "Playful screen presence with soccer, comedy, and stunt energy.",
    bio: "Demo profile for an actor with strong physical comedy, sports movement, and high-energy commercial performance.",
    topSkills: ["Physical comedy", "Soccer", "Spanish voice", "Action comedy"],
    motionSkills: [
      {
        category: "Dance",
        items: ["Salsa", "Cumbia"],
        description: "Social dance confidence with big camera energy.",
      },
      {
        category: "Martial arts",
        items: ["Boxing basics"],
        description: "Fast, readable punch combinations for comedy action.",
      },
      {
        category: "Stunts",
        items: ["Pratfalls", "Slides", "Table reactions"],
        description: "Physical comedy built around safe repetition.",
      },
      {
        category: "Body tricks",
        items: ["Ball juggling", "Mime beats"],
        description: "Precise body control for playful character work.",
      },
      {
        category: "Sports",
        items: ["Soccer", "Cycling", "Running"],
        description: "Authentic sports movement for campaign storytelling.",
      },
      {
        category: "Action scenes",
        items: ["Chase comedy", "Crowd escape"],
        description: "Action scenes with humor, speed, and personality.",
      },
    ],
    voiceSkills: ["Spanish VO", "Portuguese read", "Comedic announcer", "Improvised dialogue"],
    dance: ["Salsa", "Cumbia"],
    martialArts: ["Boxing basics"],
    singing: ["Regional pop"],
    stunts: ["Pratfalls", "Slides", "Table reactions"],
    availability: "Booked this month",
    score: 86,
    isFeatured: false,
    isDemo: true,
    joinedAt: "2026-05-18",
    profileImage:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=900&auto=format&fit=crop",
    heroImage:
      "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?q=80&w=1800&auto=format&fit=crop",
    videoThumbnail:
      "https://images.unsplash.com/photo-1521412644187-c49fa049e84d?q=80&w=1200&auto=format&fit=crop",
    videos: [
      {
        title: "Physical comedy sprint",
        category: "Acting",
        duration: "01:13",
        thumbnail:
          "https://images.unsplash.com/photo-1543584756-31b1be4e5b1d?q=80&w=900&auto=format&fit=crop",
      },
      {
        title: "Soccer motion test",
        category: "Sports",
        duration: "00:45",
        thumbnail:
          "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?q=80&w=900&auto=format&fit=crop",
      },
      {
        title: "LatAm voice pack",
        category: "Voice",
        duration: "00:51",
        thumbnail:
          "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?q=80&w=900&auto=format&fit=crop",
      },
    ],
    aiTransformation: {
      originalLabel: "Original soccer move",
      resultLabel: "AI game hero result",
      originalImage:
        "https://images.unsplash.com/photo-1521412644187-c49fa049e84d?q=80&w=900&auto=format&fit=crop",
      resultImage:
        "https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=900&auto=format&fit=crop",
    },
  },
  {
    id: "actor-5",
    slug: "nora-vale",
    name: "Nora Vale",
    location: "Toronto, Canada",
    country: "Canada",
    languages: ["English", "French"],
    accents: ["Canadian", "Quebec French", "Standard American"],
    actingStyles: ["Horror", "Sci-fi", "Creature performance"],
    headline: "Creature performer with horror stillness and athletic body control.",
    bio: "Demo profile showing a genre actor built for creature work, suspense scenes, body tricks, and controlled vocal textures.",
    topSkills: ["Creature movement", "Horror acting", "Body tricks", "Vocal texture"],
    motionSkills: [
      {
        category: "Dance",
        items: ["Butoh-inspired", "Modern"],
        description: "Strange, precise movement that holds tension on camera.",
      },
      {
        category: "Martial arts",
        items: ["Aikido basics"],
        description: "Circular movement and controlled contact reactions.",
      },
      {
        category: "Stunts",
        items: ["Crawls", "Wall hits", "Harness basics"],
        description: "Genre-safe physicality for horror and sci-fi moments.",
      },
      {
        category: "Body tricks",
        items: ["Contortion basics", "Creature walk", "Eye isolation"],
        description: "Unusual body signatures for AI creature transfer.",
      },
      {
        category: "Sports",
        items: ["Yoga", "Swimming"],
        description: "Breath control and mobility for long-form capture.",
      },
      {
        category: "Action scenes",
        items: ["Monster reveal", "Possession scene"],
        description: "Genre action with slow-burn dread and impact.",
      },
    ],
    voiceSkills: ["Creature breaths", "Horror whisper", "French dialogue", "ADR"],
    dance: ["Butoh-inspired", "Modern"],
    martialArts: ["Aikido basics"],
    singing: ["Atmospheric vocals"],
    stunts: ["Crawls", "Wall hits", "Harness basics"],
    availability: "Available now",
    score: 93,
    isFeatured: true,
    isDemo: true,
    joinedAt: "2026-05-20",
    profileImage:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=900&auto=format&fit=crop",
    heroImage:
      "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?q=80&w=1800&auto=format&fit=crop",
    videoThumbnail:
      "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?q=80&w=1200&auto=format&fit=crop",
    videos: [
      {
        title: "Creature silhouette test",
        category: "Motion",
        duration: "01:28",
        thumbnail:
          "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?q=80&w=900&auto=format&fit=crop",
      },
      {
        title: "Horror close-up",
        category: "Acting",
        duration: "01:37",
        thumbnail:
          "https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=900&auto=format&fit=crop",
      },
      {
        title: "Creature voice layer",
        category: "Voice",
        duration: "00:39",
        thumbnail:
          "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?q=80&w=900&auto=format&fit=crop",
      },
    ],
    aiTransformation: {
      originalLabel: "Original creature motion",
      resultLabel: "AI creature result",
      originalImage:
        "https://images.unsplash.com/photo-1534367610401-9f5ed68180aa?q=80&w=900&auto=format&fit=crop",
      resultImage:
        "https://images.unsplash.com/photo-1518709268805-4e9042af2176?q=80&w=900&auto=format&fit=crop",
    },
  },
  {
    id: "actor-6",
    slug: "leila-haddad",
    name: "Leila Haddad",
    location: "Berlin, Germany",
    country: "Germany",
    languages: ["Arabic", "German", "English"],
    accents: ["Levantine Arabic", "Berlin German", "Neutral English"],
    actingStyles: ["Art film", "Political thriller", "Voice-led drama"],
    headline: "Magnetic multilingual actor with precise voice and thriller intensity.",
    bio: "Demo profile for multilingual casting, restrained dramatic work, and elegant voice performance across Arabic, German, and English.",
    topSkills: ["Multilingual drama", "Thriller tension", "Arabic VO", "Subtle movement"],
    motionSkills: [
      {
        category: "Dance",
        items: ["Dabke", "Minimalist movement"],
        description: "Cultural rhythm and restrained camera movement.",
      },
      {
        category: "Martial arts",
        items: ["Krav Maga basics"],
        description: "Compact defensive movement for thriller scenes.",
      },
      {
        category: "Stunts",
        items: ["Door hits", "Ground reactions"],
        description: "Small-scale realism for tense physical scenes.",
      },
      {
        category: "Body tricks",
        items: ["Microexpression control", "Stillness"],
        description: "Quiet intensity for close-up performance capture.",
      },
      {
        category: "Sports",
        items: ["Running", "Pilates"],
        description: "Endurance and posture control.",
      },
      {
        category: "Action scenes",
        items: ["Surveillance walk", "Close escape"],
        description: "Low-noise action language for thrillers.",
      },
    ],
    voiceSkills: ["Arabic narration", "German dialogue", "English thriller read", "Whisper VO"],
    dance: ["Dabke", "Minimalist movement"],
    martialArts: ["Krav Maga basics"],
    singing: ["Arabic folk"],
    stunts: ["Door hits", "Ground reactions"],
    availability: "Select dates",
    score: 90,
    isFeatured: false,
    isDemo: true,
    joinedAt: "2026-05-22",
    profileImage:
      "https://images.unsplash.com/photo-1524250502761-1ac6f2e30d43?q=80&w=900&auto=format&fit=crop",
    heroImage:
      "https://images.unsplash.com/photo-1519608487953-e999c86e7455?q=80&w=1800&auto=format&fit=crop",
    videoThumbnail:
      "https://images.unsplash.com/photo-1533106418989-88406c7cc8ca?q=80&w=1200&auto=format&fit=crop",
    videos: [
      {
        title: "Thriller dialogue",
        category: "Acting",
        duration: "02:11",
        thumbnail:
          "https://images.unsplash.com/photo-1519608487953-e999c86e7455?q=80&w=900&auto=format&fit=crop",
      },
      {
        title: "Arabic and German reads",
        category: "Voice",
        duration: "01:02",
        thumbnail:
          "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?q=80&w=900&auto=format&fit=crop",
      },
      {
        title: "Surveillance walk test",
        category: "Motion",
        duration: "00:56",
        thumbnail:
          "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=900&auto=format&fit=crop",
      },
    ],
    aiTransformation: {
      originalLabel: "Original surveillance walk",
      resultLabel: "AI agent result",
      originalImage:
        "https://images.unsplash.com/photo-1519608487953-e999c86e7455?q=80&w=900&auto=format&fit=crop",
      resultImage:
        "https://images.unsplash.com/photo-1535223289827-42f1e9919769?q=80&w=900&auto=format&fit=crop",
    },
  },
];

export function getActorBySlug(slug: string): MockActor | undefined {
  return MOCK_ACTORS.find((actor) => actor.slug === slug);
}

export function getFilterOptions() {
  return {
    languages: unique(MOCK_ACTORS.flatMap((actor) => actor.languages)),
    accents: unique(MOCK_ACTORS.flatMap((actor) => actor.accents)),
    countries: unique(MOCK_ACTORS.map((actor) => actor.country)),
    actingStyles: unique(MOCK_ACTORS.flatMap((actor) => actor.actingStyles)),
    motionSkills: unique(
      MOCK_ACTORS.flatMap((actor) => actor.motionSkills.flatMap((group) => group.items)),
    ),
    voiceSkills: unique(MOCK_ACTORS.flatMap((actor) => actor.voiceSkills)),
    dance: unique(MOCK_ACTORS.flatMap((actor) => actor.dance)),
    martialArts: unique(MOCK_ACTORS.flatMap((actor) => actor.martialArts)),
    singing: unique(MOCK_ACTORS.flatMap((actor) => actor.singing)),
    stunts: unique(MOCK_ACTORS.flatMap((actor) => actor.stunts)),
    availability: unique(MOCK_ACTORS.map((actor) => actor.availability)),
  };
}

export type ActorFilters = {
  language?: string;
  accent?: string;
  country?: string;
  actingStyle?: string;
  motionSkill?: string;
  voiceSkill?: string;
  dance?: string;
  martialArt?: string;
  singing?: string;
  stunt?: string;
  availability?: string;
};

export function filterActors(actors: MockActor[], filters: ActorFilters): MockActor[] {
  return actors.filter((actor) => {
    return (
      matches(filters.language, actor.languages) &&
      matches(filters.accent, actor.accents) &&
      matches(filters.country, [actor.country]) &&
      matches(filters.actingStyle, actor.actingStyles) &&
      matches(
        filters.motionSkill,
        actor.motionSkills.flatMap((group) => group.items),
      ) &&
      matches(filters.voiceSkill, actor.voiceSkills) &&
      matches(filters.dance, actor.dance) &&
      matches(filters.martialArt, actor.martialArts) &&
      matches(filters.singing, actor.singing) &&
      matches(filters.stunt, actor.stunts) &&
      matches(filters.availability, [actor.availability])
    );
  });
}

export function searchActors(actors: MockActor[], query: string): MockActor[] {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return actors;
  }

  return actors.filter((actor) => {
    const searchable = [
      actor.name,
      actor.location,
      actor.country,
      actor.headline,
      ...actor.languages,
      ...actor.accents,
      ...actor.actingStyles,
      ...actor.topSkills,
      ...actor.voiceSkills,
      ...actor.dance,
      ...actor.martialArts,
      ...actor.singing,
      ...actor.stunts,
      ...actor.motionSkills.flatMap((group) => [group.category, ...group.items]),
    ];

    return searchable.some((value) => value.toLowerCase().includes(normalized));
  });
}

export function sortActors(actors: MockActor[], sortBy: SortOption): MockActor[] {
  const sorted = [...actors];

  if (sortBy === "score") {
    return sorted.sort((a, b) => b.score - a.score);
  }

  if (sortBy === "newest") {
    return sorted.sort((a, b) => Date.parse(b.joinedAt) - Date.parse(a.joinedAt));
  }

  return sorted.sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || b.score - a.score);
}

function matches(filterValue: string | undefined, values: string[]) {
  return !filterValue || values.includes(filterValue);
}

function unique(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}
