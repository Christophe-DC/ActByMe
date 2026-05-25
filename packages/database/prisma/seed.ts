import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  ActorProfileStatus,
  AgencyRequestStatus,
  PrismaClient,
  SkillCategory,
  UserRole,
  VideoType,
  Visibility,
} from "../src/generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

type DemoActorSeed = {
  accents: string[];
  actAiScore: number;
  bio: string;
  city: string;
  country: string;
  email: string;
  heroVideoUrl: string;
  languages: string[];
  profileImageUrl: string;
  skills: Array<{
    category: SkillCategory;
    label: string;
    yearsExperience?: number;
  }>;
  slug: string;
  stageName: string;
  videos: Array<{
    description: string;
    durationSeconds: number;
    skillCategory?: SkillCategory;
    thumbnailUrl: string;
    title: string;
    type: VideoType;
    videoUrl: string;
  }>;
};

const demoActors: DemoActorSeed[] = [
  {
    accents: ["Parisian French", "Neutral English", "Castilian Spanish"],
    actAiScore: 94,
    bio: "Demo profile for a cinematic performer with dance-led action range, multilingual voice delivery, and luxury commercial presence.",
    city: "Paris",
    country: "France",
    email: "maya.laurent.demo@actbyme.test",
    heroVideoUrl: "s3://actbyme-demo/maya-laurent/hero.mp4",
    languages: ["French", "English", "Spanish"],
    profileImageUrl: "https://images.unsplash.com/photo-1512316609839-ce289d3eba0a",
    skills: [
      { category: SkillCategory.ACTING, label: "Cinematic drama", yearsExperience: 7 },
      { category: SkillCategory.DANCE, label: "Contemporary dance", yearsExperience: 9 },
      { category: SkillCategory.BODY_MOVEMENT, label: "Motion capture", yearsExperience: 4 },
      { category: SkillCategory.VOICE, label: "Luxury narration", yearsExperience: 5 },
    ],
    slug: "maya-laurent",
    stageName: "Maya Laurent",
    videos: [
      {
        description: "Intro and screen presence sample.",
        durationSeconds: 58,
        thumbnailUrl: "https://images.unsplash.com/photo-1508700929628-666bc8bd84ea",
        title: "Intro video",
        type: VideoType.INTRO,
        videoUrl: "s3://actbyme-demo/maya-laurent/intro.mp4",
      },
      {
        description: "Contemporary movement for AI character transfer.",
        durationSeconds: 94,
        skillCategory: SkillCategory.DANCE,
        thumbnailUrl: "https://images.unsplash.com/photo-1504609813442-a8924e83f76e",
        title: "Contemporary motion reel",
        type: VideoType.MOTION_TEST,
        videoUrl: "s3://actbyme-demo/maya-laurent/motion.mp4",
      },
    ],
  },
  {
    accents: ["General American", "Tokyo Japanese"],
    actAiScore: 91,
    bio: "Demo action profile for martial arts, heroic reads, and clean stunt beats for fast camera work.",
    city: "Los Angeles",
    country: "United States",
    email: "jordan.kaito.demo@actbyme.test",
    heroVideoUrl: "s3://actbyme-demo/jordan-kaito/hero.mp4",
    languages: ["English", "Japanese"],
    profileImageUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d",
    skills: [
      { category: SkillCategory.MARTIAL_ARTS, label: "Taekwondo", yearsExperience: 12 },
      { category: SkillCategory.STUNTS, label: "Reaction hits", yearsExperience: 8 },
      { category: SkillCategory.ACTING, label: "Action hero", yearsExperience: 6 },
      { category: SkillCategory.VOICE, label: "Hero trailer read", yearsExperience: 4 },
    ],
    slug: "jordan-kaito",
    stageName: "Jordan Kaito",
    videos: [
      {
        description: "Combat dialogue and action timing.",
        durationSeconds: 102,
        skillCategory: SkillCategory.ACTING,
        thumbnailUrl: "https://images.unsplash.com/photo-1517438322307-e67111335449",
        title: "Combat dialogue test",
        type: VideoType.ACTING_TEST,
        videoUrl: "s3://actbyme-demo/jordan-kaito/acting.mp4",
      },
      {
        description: "Sword forms and clean screen silhouettes.",
        durationSeconds: 52,
        skillCategory: SkillCategory.MARTIAL_ARTS,
        thumbnailUrl: "https://images.unsplash.com/photo-1591117207239-788bf8de6c3b",
        title: "Sword form capture",
        type: VideoType.MOTION_TEST,
        videoUrl: "s3://actbyme-demo/jordan-kaito/sword.mp4",
      },
    ],
  },
  {
    accents: ["London", "West African", "French"],
    actAiScore: 89,
    bio: "Demo profile for emotionally intelligent acting, comedy timing, multilingual narration, and joyful movement.",
    city: "London",
    country: "United Kingdom",
    email: "amina.okafor.demo@actbyme.test",
    heroVideoUrl: "s3://actbyme-demo/amina-okafor/hero.mp4",
    languages: ["English", "Yoruba", "French"],
    profileImageUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330",
    skills: [
      { category: SkillCategory.DRAMA, label: "Prestige drama", yearsExperience: 10 },
      { category: SkillCategory.COMEDY, label: "Character comedy", yearsExperience: 8 },
      { category: SkillCategory.VOICE, label: "Documentary narration", yearsExperience: 6 },
      { category: SkillCategory.DANCE, label: "Afrobeats", yearsExperience: 5 },
    ],
    slug: "amina-okafor",
    stageName: "Amina Okafor",
    videos: [
      {
        description: "Grounded dramatic close-up.",
        durationSeconds: 124,
        skillCategory: SkillCategory.DRAMA,
        thumbnailUrl: "https://images.unsplash.com/photo-1485846234645-a62644f84728",
        title: "Prestige drama close-up",
        type: VideoType.ACTING_TEST,
        videoUrl: "s3://actbyme-demo/amina-okafor/drama.mp4",
      },
      {
        description: "Language and accent sampler.",
        durationSeconds: 68,
        skillCategory: SkillCategory.VOICE,
        thumbnailUrl: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc",
        title: "Voice and dialect sampler",
        type: VideoType.VOICE_SAMPLE,
        videoUrl: "s3://actbyme-demo/amina-okafor/voice.mp4",
      },
    ],
  },
  {
    accents: ["Mexican Spanish", "Neutral LatAm", "Brazilian Portuguese"],
    actAiScore: 86,
    bio: "Demo profile for physical comedy, sports movement, and high-energy commercial performance.",
    city: "Mexico City",
    country: "Mexico",
    email: "diego.morales.demo@actbyme.test",
    heroVideoUrl: "s3://actbyme-demo/diego-morales/hero.mp4",
    languages: ["Spanish", "English", "Portuguese"],
    profileImageUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e",
    skills: [
      { category: SkillCategory.COMEDY, label: "Physical comedy", yearsExperience: 9 },
      { category: SkillCategory.SPORTS, label: "Soccer", yearsExperience: 12 },
      { category: SkillCategory.UGC_ADS, label: "Social ads", yearsExperience: 4 },
      { category: SkillCategory.VOICE, label: "LatAm Spanish VO", yearsExperience: 5 },
    ],
    slug: "diego-morales",
    stageName: "Diego Morales",
    videos: [
      {
        description: "Physical comedy and timing.",
        durationSeconds: 73,
        skillCategory: SkillCategory.COMEDY,
        thumbnailUrl: "https://images.unsplash.com/photo-1543584756-31b1be4e5b1d",
        title: "Physical comedy sprint",
        type: VideoType.PORTFOLIO,
        videoUrl: "s3://actbyme-demo/diego-morales/comedy.mp4",
      },
      {
        description: "Soccer motion reference.",
        durationSeconds: 45,
        skillCategory: SkillCategory.SPORTS,
        thumbnailUrl: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d",
        title: "Soccer motion test",
        type: VideoType.MOTION_TEST,
        videoUrl: "s3://actbyme-demo/diego-morales/soccer.mp4",
      },
    ],
  },
  {
    accents: ["Canadian", "Quebec French", "Standard American"],
    actAiScore: 93,
    bio: "Demo profile for creature work, horror stillness, body tricks, and controlled vocal textures.",
    city: "Toronto",
    country: "Canada",
    email: "nora.vale.demo@actbyme.test",
    heroVideoUrl: "s3://actbyme-demo/nora-vale/hero.mp4",
    languages: ["English", "French"],
    profileImageUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb",
    skills: [
      { category: SkillCategory.BODY_MOVEMENT, label: "Creature movement", yearsExperience: 8 },
      { category: SkillCategory.DRAMA, label: "Horror acting", yearsExperience: 7 },
      { category: SkillCategory.STUNTS, label: "Harness basics", yearsExperience: 3 },
      { category: SkillCategory.VOICE, label: "Creature breaths", yearsExperience: 5 },
    ],
    slug: "nora-vale",
    stageName: "Nora Vale",
    videos: [
      {
        description: "Creature silhouette and body control.",
        durationSeconds: 88,
        skillCategory: SkillCategory.BODY_MOVEMENT,
        thumbnailUrl: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429",
        title: "Creature silhouette test",
        type: VideoType.MOTION_TEST,
        videoUrl: "s3://actbyme-demo/nora-vale/creature.mp4",
      },
      {
        description: "Before and after AI creature transfer placeholder.",
        durationSeconds: 64,
        skillCategory: SkillCategory.BODY_MOVEMENT,
        thumbnailUrl: "https://images.unsplash.com/photo-1534367610401-9f5ed68180aa",
        title: "AI creature transformation",
        type: VideoType.BEFORE_AFTER_AI,
        videoUrl: "s3://actbyme-demo/nora-vale/before-after.mp4",
      },
    ],
  },
  {
    accents: ["Levantine Arabic", "Berlin German", "Neutral English"],
    actAiScore: 90,
    bio: "Demo profile for multilingual thriller performance, restrained drama, and precise voice-led work.",
    city: "Berlin",
    country: "Germany",
    email: "leila.haddad.demo@actbyme.test",
    heroVideoUrl: "s3://actbyme-demo/leila-haddad/hero.mp4",
    languages: ["Arabic", "German", "English"],
    profileImageUrl: "https://images.unsplash.com/photo-1524250502761-1ac6f2e30d43",
    skills: [
      { category: SkillCategory.ACTING, label: "Political thriller", yearsExperience: 8 },
      { category: SkillCategory.VOICE, label: "Arabic narration", yearsExperience: 6 },
      { category: SkillCategory.BODY_MOVEMENT, label: "Stillness", yearsExperience: 5 },
      { category: SkillCategory.MARTIAL_ARTS, label: "Krav Maga basics", yearsExperience: 2 },
    ],
    slug: "leila-haddad",
    stageName: "Leila Haddad",
    videos: [
      {
        description: "Thriller scene dialogue.",
        durationSeconds: 131,
        skillCategory: SkillCategory.ACTING,
        thumbnailUrl: "https://images.unsplash.com/photo-1519608487953-e999c86e7455",
        title: "Thriller dialogue",
        type: VideoType.ACTING_TEST,
        videoUrl: "s3://actbyme-demo/leila-haddad/thriller.mp4",
      },
      {
        description: "Arabic, German, and English reads.",
        durationSeconds: 62,
        skillCategory: SkillCategory.VOICE,
        thumbnailUrl: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc",
        title: "Arabic and German reads",
        type: VideoType.VOICE_SAMPLE,
        videoUrl: "s3://actbyme-demo/leila-haddad/voice.mp4",
      },
    ],
  },
  {
    accents: ["Indian English", "Mumbai Hindi", "Neutral English"],
    actAiScore: 88,
    bio: "Demo profile for musical performance, expressive dance, singing, and high-polish brand work.",
    city: "Mumbai",
    country: "India",
    email: "priya-rao.demo@actbyme.test",
    heroVideoUrl: "s3://actbyme-demo/priya-rao/hero.mp4",
    languages: ["Hindi", "English", "Gujarati"],
    profileImageUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9",
    skills: [
      { category: SkillCategory.SINGING, label: "Alto vocals", yearsExperience: 10 },
      { category: SkillCategory.DANCE, label: "Bollywood", yearsExperience: 12 },
      { category: SkillCategory.CORPORATE, label: "Brand presenter", yearsExperience: 4 },
      {
        category: SkillCategory.EMOTIONAL_PERFORMANCE,
        label: "Romantic drama",
        yearsExperience: 7,
      },
    ],
    slug: "priya-rao",
    stageName: "Priya Rao",
    videos: [
      {
        description: "Dance and expression reel.",
        durationSeconds: 112,
        skillCategory: SkillCategory.DANCE,
        thumbnailUrl: "https://images.unsplash.com/photo-1504609813442-a8924e83f76e",
        title: "Bollywood motion reel",
        type: VideoType.MOTION_TEST,
        videoUrl: "s3://actbyme-demo/priya-rao/dance.mp4",
      },
      {
        description: "Singing and voice range.",
        durationSeconds: 76,
        skillCategory: SkillCategory.SINGING,
        thumbnailUrl: "https://images.unsplash.com/photo-1516280440614-37939bbacd81",
        title: "Singing showcase",
        type: VideoType.VOICE_SAMPLE,
        videoUrl: "s3://actbyme-demo/priya-rao/singing.mp4",
      },
    ],
  },
  {
    accents: ["Nairobi English", "Swahili", "General American"],
    actAiScore: 87,
    bio: "Demo profile for athletic movement, commercial confidence, UGC delivery, and outdoor action.",
    city: "Nairobi",
    country: "Kenya",
    email: "eli-mwangi.demo@actbyme.test",
    heroVideoUrl: "s3://actbyme-demo/eli-mwangi/hero.mp4",
    languages: ["English", "Swahili"],
    profileImageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d",
    skills: [
      { category: SkillCategory.SPORTS, label: "Trail running", yearsExperience: 9 },
      { category: SkillCategory.UGC_ADS, label: "Fitness UGC", yearsExperience: 4 },
      { category: SkillCategory.STUNTS, label: "Outdoor action", yearsExperience: 3 },
      { category: SkillCategory.CORPORATE, label: "Wellness presenter", yearsExperience: 5 },
    ],
    slug: "eli-mwangi",
    stageName: "Eli Mwangi",
    videos: [
      {
        description: "Outdoor sports movement test.",
        durationSeconds: 83,
        skillCategory: SkillCategory.SPORTS,
        thumbnailUrl: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8",
        title: "Trail running motion",
        type: VideoType.MOTION_TEST,
        videoUrl: "s3://actbyme-demo/eli-mwangi/running.mp4",
      },
      {
        description: "Fitness UGC performance sample.",
        durationSeconds: 69,
        skillCategory: SkillCategory.UGC_ADS,
        thumbnailUrl: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438",
        title: "Fitness UGC spot",
        type: VideoType.PORTFOLIO,
        videoUrl: "s3://actbyme-demo/eli-mwangi/ugc.mp4",
      },
    ],
  },
];

const agencyRequests = [
  {
    companyName: "Northstar Studio",
    country: "United States",
    email: "producer@northstar.example",
    expectedMonthlyVolume: "6-20 videos / month",
    interestedSkills: ["UGC actors", "voice/accent", "AI video reference performance"],
    message: "Interested in performer-led references for multilingual product videos.",
    name: "Demo Producer",
    needs: "Verified actor profiles for AI-powered commercial video workflows.",
    role: "Creative producer",
    status: AgencyRequestStatus.NEW,
    website: "https://northstar.example",
  },
  {
    companyName: "Kinetic Frames",
    country: "United Kingdom",
    email: "casting@kinetic.example",
    expectedMonthlyVolume: "21-50 videos / month",
    interestedSkills: ["motion actors", "martial arts", "dancing"],
    message: "Looking for action performers and dance-led motion references.",
    name: "Riley Chen",
    needs: "Action, sports, and dance reference performances for AI video production.",
    role: "Casting director",
    status: AgencyRequestStatus.CONTACTED,
    website: "https://kinetic.example",
  },
  {
    companyName: "Signal AI Video",
    country: "Germany",
    email: "ops@signalvideo.example",
    expectedMonthlyVolume: "50+ videos / month",
    interestedSkills: ["multilingual actors", "voice/accent", "UGC actors"],
    message: "Evaluating actor-first workflows for localized campaigns.",
    name: "Amara Weiss",
    needs: "Multilingual actor profiles and accent samples for localized AI campaigns.",
    role: "Studio operations",
    status: AgencyRequestStatus.APPROVED,
    website: "https://signalvideo.example",
  },
];

async function seedAdmin() {
  return prisma.user.upsert({
    create: {
      email: "admin@actbyme.test",
      name: "ActByMe Admin",
      role: UserRole.ADMIN,
    },
    update: {
      name: "ActByMe Admin",
      role: UserRole.ADMIN,
    },
    where: {
      email: "admin@actbyme.test",
    },
  });
}

async function seedDemoActor(actor: DemoActorSeed) {
  const user = await prisma.user.upsert({
    create: {
      email: actor.email,
      name: actor.stageName,
      role: UserRole.ACTOR,
    },
    update: {
      name: actor.stageName,
      role: UserRole.ACTOR,
    },
    where: {
      email: actor.email,
    },
  });

  const profile = await prisma.actorProfile.upsert({
    create: {
      actAiScore: actor.actAiScore,
      bio: actor.bio,
      city: actor.city,
      country: actor.country,
      heroVideoUrl: actor.heroVideoUrl,
      isDemo: true,
      profileImageUrl: actor.profileImageUrl,
      slug: actor.slug,
      stageName: actor.stageName,
      status: ActorProfileStatus.APPROVED,
      userId: user.id,
    },
    update: {
      actAiScore: actor.actAiScore,
      bio: actor.bio,
      city: actor.city,
      country: actor.country,
      heroVideoUrl: actor.heroVideoUrl,
      isDemo: true,
      profileImageUrl: actor.profileImageUrl,
      stageName: actor.stageName,
      status: ActorProfileStatus.APPROVED,
      userId: user.id,
    },
    where: {
      slug: actor.slug,
    },
  });

  await prisma.actorSkill.deleteMany({ where: { actorProfileId: profile.id } });
  await prisma.actorLanguage.deleteMany({ where: { actorProfileId: profile.id } });
  await prisma.actorAccent.deleteMany({ where: { actorProfileId: profile.id } });
  await prisma.actorVideo.deleteMany({ where: { actorProfileId: profile.id } });

  await prisma.actorSkill.createMany({
    data: actor.skills.map((skill) => ({
      actorProfileId: profile.id,
      category: skill.category,
      label: skill.label,
      yearsExperience: skill.yearsExperience,
    })),
  });

  await prisma.actorLanguage.createMany({
    data: actor.languages.map((language) => ({
      actorProfileId: profile.id,
      language,
      proficiency: "Demo",
    })),
  });

  await prisma.actorAccent.createMany({
    data: actor.accents.map((accent) => ({
      accent,
      actorProfileId: profile.id,
    })),
  });

  await prisma.actorVideo.createMany({
    data: actor.videos.map((video, index) => ({
      actorProfileId: profile.id,
      description: video.description,
      durationSeconds: video.durationSeconds,
      skillCategory: video.skillCategory,
      sortOrder: index,
      thumbnailUrl: video.thumbnailUrl,
      title: video.title,
      type: video.type,
      videoUrl: video.videoUrl,
      visibility: Visibility.PUBLIC,
    })),
  });

  await prisma.actorConsent.upsert({
    create: {
      acceptedAt: new Date(),
      actorProfileId: profile.id,
      futurePaidWorkRequiresSeparateApproval: true,
      marketingUsageConsent: true,
      ownsUploadedContentConfirmation: true,
      publicProfileConsent: true,
    },
    update: {
      acceptedAt: new Date(),
      futurePaidWorkRequiresSeparateApproval: true,
      marketingUsageConsent: true,
      ownsUploadedContentConfirmation: true,
      publicProfileConsent: true,
    },
    where: {
      actorProfileId: profile.id,
    },
  });

  await prisma.demoProfile.upsert({
    create: {
      actorProfileId: profile.id,
      description:
        "Seeded demonstration profile for product development. This is not a real registered actor.",
      label: "Demo profile",
      source: "seed",
    },
    update: {
      description:
        "Seeded demonstration profile for product development. This is not a real registered actor.",
      label: "Demo profile",
      source: "seed",
    },
    where: {
      actorProfileId: profile.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "DEMO_PROFILE_SEEDED",
      actorProfileId: profile.id,
      entityId: profile.id,
      entityType: "ActorProfile",
      metadata: {
        isDemo: true,
        slug: actor.slug,
      },
      userId: user.id,
    },
  });
}

async function seedAgencyRequests() {
  await prisma.agencyAccessRequest.deleteMany({
    where: {
      email: {
        in: agencyRequests.map((request) => request.email),
      },
    },
  });

  await prisma.agencyAccessRequest.createMany({
    data: agencyRequests,
  });
}

async function main() {
  await seedAdmin();

  for (const actor of demoActors) {
    await seedDemoActor(actor);
  }

  await seedAgencyRequests();
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
