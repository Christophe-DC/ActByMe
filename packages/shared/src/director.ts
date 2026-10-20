import { z } from "zod";

const identifier = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9_-]+$/);
export const directorVectorSchema = z
  .object({
    x: z.number().finite().min(-100).max(100),
    y: z.number().finite().min(0.1).max(50),
    z: z.number().finite().min(-100).max(100),
  })
  .strict();
export const directorWaypointSchema = z
  .object({
    id: identifier,
    at: z.number().finite().min(0).max(1),
    position: directorVectorSchema,
    target: directorVectorSchema,
    lens: z.number().finite().min(12).max(120),
  })
  .strict();
export const directorTemplateIds = [
  "outside-inside",
  "follow-reveal",
  "orbit-pull",
  "doorway",
  "product-world",
  "actor-handoff",
  "product-detail",
  "establishing",
  "dolly-in",
  "dolly-out",
  "pan",
  "tilt",
  "tracking",
] as const;
export const directorShotSchema = z
  .object({
    id: identifier,
    name: z.string().trim().min(1).max(120),
    templateId: z.enum(directorTemplateIds),
    duration: z.number().finite().min(0.5).max(120),
    prompt: z.string().max(5000),
    waypoints: z.array(directorWaypointSchema).min(2).max(24),
    easing: z.enum(["linear", "smooth"]),
    transition: z.enum(["cut", "fade"]),
    transitionDuration: z.number().finite().min(0).max(2),
    referenceIds: z.array(z.uuid()).max(12),
    clipAssetId: z.uuid().nullable(),
    clipOffset: z.number().finite().min(0).max(600),
    originalAudio: z.boolean(),
    followCastId: identifier.nullable(),
  })
  .strict();
export const directorTrackSchema = z.enum(["performance", "voice", "music", "sfx"]);
export const directorTimelineItemSchema = z
  .object({
    id: identifier,
    track: directorTrackSchema,
    label: z.string().trim().min(1).max(120),
    start: z.number().finite().min(0).max(600),
    duration: z.number().finite().min(0.1).max(600),
    offset: z.number().finite().min(0).max(600),
    volume: z.number().finite().min(0).max(1),
    fadeIn: z.number().finite().min(0).max(10),
    fadeOut: z.number().finite().min(0).max(10),
    assetId: z.uuid().nullable(),
    castId: identifier.nullable(),
    instructions: z.string().max(3000),
  })
  .strict();
export const directorCastSchema = z
  .object({
    id: identifier,
    name: z.string().trim().min(1).max(120),
    kind: z.enum(["placeholder", "actor", "virtual"]),
    actorProfileId: z.uuid().nullable(),
    performanceProjectId: z.uuid().nullable(),
    referenceAssetId: z.uuid().nullable(),
    rightsConfirmed: z.boolean(),
    rightsBasis: z.string().max(2000),
    position: directorVectorSchema,
    endPosition: directorVectorSchema,
  })
  .strict();
export const directorDocumentSchema = z
  .object({
    schemaVersion: z.literal(1),
    title: z.string().trim().min(1).max(140),
    category: z.enum(["real-estate", "product", "brand", "social", "other"]),
    brief: z.string().max(8000),
    script: z.string().max(16000),
    aspectRatio: z.enum(["16:9", "9:16", "1:1"]),
    environment: z.enum(["coastal", "studio"]),
    shots: z.array(directorShotSchema).min(1).max(60),
    tracks: z.array(directorTimelineItemSchema).max(120),
    cast: z.array(directorCastSchema).max(20),
  })
  .strict()
  .superRefine((document, context) => {
    const fail = (message: string) => context.addIssue({ code: "custom", message });
    const duration = directorDuration(document);
    if (duration > 600) fail("A Director project can last at most 10 minutes.");
    const ids = [...document.shots, ...document.tracks, ...document.cast].map((item) => item.id);
    if (new Set(ids).size !== ids.length) fail("Timeline and cast identifiers must be unique.");
    const castIds = new Set(document.cast.map((person) => person.id));
    for (const shot of document.shots) {
      if (shot.followCastId && !castIds.has(shot.followCastId))
        fail("Unknown camera point of interest.");
      if (shot.waypoints[0]!.at !== 0 || shot.waypoints.at(-1)!.at !== 1)
        fail("A path must begin at 0 and end at 1.");
      if (new Set(shot.waypoints.map((point) => point.id)).size !== shot.waypoints.length)
        fail("Waypoint identifiers must be unique.");
      shot.waypoints.forEach((point, index) => {
        if (index && point.at <= shot.waypoints[index - 1]!.at)
          fail("Waypoints must have increasing arrival times.");
        if (
          Math.hypot(
            point.position.x - point.target.x,
            point.position.y - point.target.y,
            point.position.z - point.target.z,
          ) < 0.1
        )
          fail("Camera and target must be distinct.");
      });
      if (shot.transitionDuration > shot.duration / 2) fail("A fade cannot exceed half a shot.");
    }
    for (const item of document.tracks) {
      if (item.start + item.duration > duration + 0.001)
        fail("A timeline item extends beyond the picture.");
      if (item.castId && !castIds.has(item.castId)) fail("Unknown timeline cast member.");
      if (item.fadeIn + item.fadeOut > item.duration) fail("Audio fades exceed the item duration.");
    }
    for (const person of document.cast) {
      if (person.kind === "actor" && !person.actorProfileId) fail("Select an ACTBYME actor.");
      if (person.kind !== "actor" && person.actorProfileId)
        fail("Only actor entries may reference real profiles.");
      if (
        person.kind === "virtual" &&
        (!person.rightsConfirmed || person.rightsBasis.trim().length < 10)
      )
        fail("Virtual characters require an explicit rights basis.");
    }
  });

export type DirectorDocument = z.infer<typeof directorDocumentSchema>;
export type DirectorShot = z.infer<typeof directorShotSchema>;
export type DirectorWaypoint = z.infer<typeof directorWaypointSchema>;
export type DirectorVector = z.infer<typeof directorVectorSchema>;
export type DirectorCast = z.infer<typeof directorCastSchema>;
export type DirectorTimelineItem = z.infer<typeof directorTimelineItemSchema>;
export type DirectorTrack = z.infer<typeof directorTrackSchema>;
export const directorAssetKinds = [
  "property",
  "product",
  "character",
  "brand",
  "reference-video",
  "performance",
  "music",
  "voice",
  "sfx",
  "clip",
] as const;
export type DirectorAssetKind = (typeof directorAssetKinds)[number];
export const directorAssetTypes: Record<DirectorAssetKind, readonly string[]> = {
  property: ["image/jpeg", "image/png", "image/webp"],
  product: ["image/jpeg", "image/png", "image/webp"],
  character: ["image/jpeg", "image/png", "image/webp"],
  brand: ["image/jpeg", "image/png", "image/webp"],
  "reference-video": ["video/mp4", "video/quicktime"],
  performance: ["video/mp4", "video/quicktime"],
  clip: ["video/mp4", "video/quicktime"],
  music: ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/ogg"],
  voice: ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/ogg"],
  sfx: ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/ogg"],
};
export const directorUploadSchema = z
  .object({
    name: z.string().trim().min(1).max(180),
    kind: z.enum(directorAssetKinds),
    contentType: z.string().max(100),
    sizeBytes: z
      .number()
      .int()
      .min(1)
      .max(50 * 1024 * 1024, "Files are limited to 50 MiB without a dedicated worker."),
    rightsBasis: z.string().trim().min(10).max(2000),
    rightsConfirmed: z.literal(true),
    aiTransferAllowed: z.boolean(),
  })
  .strict()
  .superRefine((asset, context) => {
    if (!directorAssetTypes[asset.kind].includes(asset.contentType))
      context.addIssue({
        code: "custom",
        message: "File format is incompatible with this asset category.",
      });
    if (asset.contentType.startsWith("image/") && asset.sizeBytes > 15 * 1024 * 1024)
      context.addIssue({ code: "custom", message: "Images must be at most 15 MiB." });
  });
export type DirectorAsset = {
  id: string;
  name: string;
  kind: DirectorAssetKind;
  contentType: string;
  sizeBytes: number;
  status: string;
  duration: number | null;
  width: number | null;
  height: number | null;
  hasAudio: boolean | null;
  error: string | null;
  aiTransferAllowed: boolean;
  createdAt: string;
};
export type DirectorJob = {
  id: string;
  kind: string;
  shotId: string | null;
  provider: string | null;
  status: string;
  stage: string;
  error: string | null;
  progress: number;
  estimatedCostCents: number;
  resultAssetId: string | null;
  createdAt: string;
  version: number;
};
export type DirectorProviderId = "veo" | "higgsfield";
export type DirectorCapabilities = {
  workerReady: boolean;
  storageReady: boolean;
  browserExportReady: boolean;
  providers: {
    id: DirectorProviderId;
    name: string;
    model: string;
    ready: boolean;
    reason: string | null;
    centsPerSecond: number;
    documentationUrl: string;
  }[];
  budgetCents: number;
  reservedCents: number;
};
export type DirectorState = {
  id: string;
  version: number;
  document: DirectorDocument;
  assets: DirectorAsset[];
  jobs: DirectorJob[];
  capabilities: DirectorCapabilities;
  updatedAt: string;
};
export const directorActiveStatuses = ["QUEUED", "PROCESSING", "SUBMITTING", "WAITING_PROVIDER"];
export function directorDuration(document: Pick<DirectorDocument, "shots">) {
  return document.shots.reduce((total, shot) => total + shot.duration, 0);
}
export function directorShotAt(document: Pick<DirectorDocument, "shots">, time: number) {
  let start = 0;
  for (const shot of document.shots) {
    if (time < start + shot.duration || shot === document.shots.at(-1))
      return { shot, start, localTime: Math.max(0, Math.min(shot.duration, time - start)) };
    start += shot.duration;
  }
  throw new Error("No shots in project.");
}
const mix = (first: number, second: number, fraction: number) =>
  first + (second - first) * fraction;
export function directorCastPosition(
  person: DirectorCast,
  time: number,
  duration: number,
): DirectorVector {
  const fraction = Math.max(0, Math.min(1, time / duration));
  return {
    x: mix(person.position.x, person.endPosition.x, fraction),
    y: mix(person.position.y, person.endPosition.y, fraction),
    z: mix(person.position.z, person.endPosition.z, fraction),
  };
}
export function directorCastTimelinePosition(
  document: DirectorDocument,
  person: DirectorCast,
  time: number,
) {
  const cues = document.tracks.filter(
    (item) => item.track === "performance" && item.castId === person.id,
  );
  if (!cues.length) return directorCastPosition(person, time, directorDuration(document));
  const total = cues.reduce((duration, cue) => duration + cue.duration, 0);
  const elapsed = cues.reduce(
    (duration, cue) => duration + Math.max(0, Math.min(cue.duration, time - cue.start)),
    0,
  );
  return directorCastPosition(person, elapsed, total);
}
// Non-uniform cubic Hermite interpolation preserves velocity across unequal waypoint intervals.
// The slope limiter prevents overshoots between each pair of control points.
function pathValue(
  points: DirectorWaypoint[],
  index: number,
  fraction: number,
  read: (point: DirectorWaypoint) => number,
) {
  const first = points[index]!,
    second = points[index + 1]!;
  const interval = second.at - first.at,
    delta = (read(second) - read(first)) / interval;
  const slope = (at: number) => {
    if (at === 0 || at === points.length - 1) return 0;
    const left = points[Math.max(0, at - 1)]!,
      right = points[Math.min(points.length - 1, at + 1)]!;
    if (at > 0 && at < points.length - 1) {
      const before = (read(points[at]!) - read(left)) / (points[at]!.at - left.at);
      const after = (read(right) - read(points[at]!)) / (right.at - points[at]!.at);
      if (before * after <= 0) return 0;
    }
    return (read(right) - read(left)) / (right.at - left.at);
  };
  let firstSlope = slope(index),
    secondSlope = slope(index + 1);
  if (delta === 0) firstSlope = secondSlope = 0;
  else {
    const magnitude = Math.hypot(firstSlope / delta, secondSlope / delta);
    if (magnitude > 3) {
      firstSlope *= 3 / magnitude;
      secondSlope *= 3 / magnitude;
    }
  }
  const squared = fraction * fraction,
    cubed = squared * fraction;
  return (
    (2 * cubed - 3 * squared + 1) * read(first) +
    (cubed - 2 * squared + fraction) * interval * firstSlope +
    (-2 * cubed + 3 * squared) * read(second) +
    (cubed - squared) * interval * secondSlope
  );
}
export function sampleDirectorCamera(
  shot: DirectorShot,
  localTime: number,
  cast: DirectorCast[] = [],
  globalTime = localTime,
  duration = shot.duration,
  document?: DirectorDocument,
) {
  const normalized = Math.max(0, Math.min(1, localTime / shot.duration));
  const time = normalized;
  let index = 0;
  while (index < shot.waypoints.length - 2 && shot.waypoints[index + 1]!.at < time) index++;
  const first = shot.waypoints[index]!,
    second = shot.waypoints[index + 1]!;
  const fraction = (time - first.at) / (second.at - first.at);
  const value = (read: (point: DirectorWaypoint) => number) =>
    shot.easing === "linear"
      ? mix(read(first), read(second), fraction)
      : pathValue(shot.waypoints, index, fraction, read);
  const vector = (field: "position" | "target") => ({
    x: value((point) => point[field].x),
    y: value((point) => point[field].y),
    z: value((point) => point[field].z),
  });
  const person = cast.find((item) => item.id === shot.followCastId);
  const target = person
    ? {
        ...(document
          ? directorCastTimelinePosition(document, person, globalTime)
          : directorCastPosition(person, globalTime, duration)),
        y: 1.5,
      }
    : vector("target");
  return { position: vector("position"), target, lens: value((point) => point.lens) };
}
export type DirectorTemplate = {
  id: (typeof directorTemplateIds)[number];
  name: string;
  category: "spaces" | "product" | "people";
  description: string;
  required: DirectorAssetKind[];
  prompt: string;
  points: [number, number, number][];
};
export const directorTemplates: DirectorTemplate[] = [
  {
    id: "outside-inside",
    name: "Outside to Inside",
    category: "spaces",
    description: "A smooth entrance from the garden into the heart of the house.",
    required: ["property"],
    prompt:
      "One continuous shot travels from the exterior garden through an open doorway into the living room. Preserve spatial continuity.",
    points: [
      [-7, 1.8, 9],
      [-3, 1.7, 5],
      [0, 1.6, 1],
      [2, 1.6, -3],
    ],
  },
  {
    id: "follow-reveal",
    name: "Follow & Reveal",
    category: "people",
    description: "Follow the subject, then reveal the surroundings.",
    required: ["character"],
    prompt:
      "Follow the subject from behind, then move sideways to reveal the environment. One continuous shot.",
    points: [
      [0, 1.6, 6],
      [1, 1.6, 3],
      [5, 2, 0],
    ],
  },
  {
    id: "orbit-pull",
    name: "Orbit & Pull Away",
    category: "spaces",
    description: "An orbit that opens into a wide establishing view.",
    required: ["property"],
    prompt: "Orbit around the subject, then smoothly pull away to reveal a wide view. No cuts.",
    points: [
      [5, 2, 0],
      [3.5, 2.4, -3.5],
      [0, 3, -5],
      [-5, 5, -8],
    ],
  },
  {
    id: "doorway",
    name: "Through the Doorway",
    category: "spaces",
    description: "Move through an opening to reveal a room.",
    required: ["property"],
    prompt: "A continuous eye-level dolly through an open doorway, revealing the room beyond.",
    points: [
      [0, 1.6, 6],
      [0, 1.6, 1],
      [0, 1.6, -3],
    ],
  },
  {
    id: "product-world",
    name: "Product to World",
    category: "product",
    description: "Move from a product detail into the brand's world.",
    required: ["product"],
    prompt:
      "Begin on an intimate product detail, then pull back to reveal its setting. One continuous shot.",
    points: [
      [0, 1.3, 1.2],
      [0, 1.8, 4],
      [3, 3, 8],
    ],
  },
  {
    id: "actor-handoff",
    name: "Actor Handoff",
    category: "people",
    description: "Move from one performer to another in a single shot.",
    required: ["character"],
    prompt:
      "Track smoothly from the first performer to a second performer, preserving a single continuous take.",
    points: [
      [-4, 1.6, 4],
      [0, 1.6, 4],
      [4, 1.6, 4],
    ],
  },
  {
    id: "product-detail",
    name: "Close-up / Product Detail",
    category: "product",
    description: "Highlight a material, shape or fine detail.",
    required: ["product"],
    prompt:
      "A slow cinematic macro shot of the product, crisp material detail, shallow depth of field.",
    points: [
      [-0.7, 1.4, 1.8],
      [0.7, 1.4, 1.8],
    ],
  },
  {
    id: "establishing",
    name: "Establishing Shot",
    category: "spaces",
    description: "Establish the location and atmosphere.",
    required: ["property"],
    prompt: "A wide establishing shot that introduces the location with a subtle cinematic drift.",
    points: [
      [-8, 6, 12],
      [-5, 5, 10],
    ],
  },
  {
    id: "dolly-in",
    name: "Dolly In",
    category: "product",
    description: "Gradually draw attention closer to the subject.",
    required: [],
    prompt:
      "A slow forward dolly towards the subject. Maintain a stable horizon and continuous motion.",
    points: [
      [0, 1.6, 7],
      [0, 1.6, 2.5],
    ],
  },
  {
    id: "dolly-out",
    name: "Dolly Out",
    category: "spaces",
    description: "Widen the frame to reveal the context.",
    required: [],
    prompt: "A slow backward dolly away from the subject, revealing the environment.",
    points: [
      [0, 1.6, 2.5],
      [0, 2, 8],
    ],
  },
  {
    id: "pan",
    name: "Pan",
    category: "spaces",
    description: "A horizontal sweep from a fixed camera.",
    required: [],
    prompt: "A smooth horizontal pan from a fixed camera position. No translation.",
    points: [
      [0, 1.6, 6],
      [0, 1.6, 6],
    ],
  },
  {
    id: "tilt",
    name: "Tilt",
    category: "spaces",
    description: "Reveal a subject from bottom to top.",
    required: [],
    prompt: "A smooth upward tilt from a fixed camera, revealing the subject vertically.",
    points: [
      [0, 1.6, 6],
      [0, 1.6, 6],
    ],
  },
  {
    id: "tracking",
    name: "Tracking Shot",
    category: "people",
    description: "Follow the subject's lateral movement.",
    required: [],
    prompt:
      "A smooth lateral tracking shot alongside the subject, maintaining consistent distance.",
    points: [
      [-5, 1.6, 4],
      [0, 1.6, 4],
      [5, 1.6, 4],
    ],
  },
];
export function createDirectorShot(
  templateId: (typeof directorTemplateIds)[number],
  id: string,
  duration = 8,
): DirectorShot {
  const template = directorTemplates.find((item) => item.id === templateId)!;
  return {
    id,
    name: template.name,
    templateId,
    duration,
    prompt: "",
    easing: "smooth",
    transition: "cut",
    transitionDuration: 0.3,
    referenceIds: [],
    clipAssetId: null,
    clipOffset: 0,
    originalAudio: false,
    followCastId: null,
    waypoints: template.points.map(([x, y, z], index) => ({
      id: `${id}_wp_${index}`,
      at: index / (template.points.length - 1),
      position: { x, y, z },
      target: {
        x: templateId === "pan" ? (index ? 3 : -3) : 0,
        y: templateId === "tilt" ? (index ? 4 : 0.5) : 1.2,
        z: 0,
      },
      lens: templateId === "product-detail" ? 65 : 24,
    })),
  };
}
export function createDirectorDocument(
  title = "The Coastal House",
  demo = false,
): DirectorDocument {
  const first = createDirectorShot("outside-inside", "shot_arrival", demo ? 15 : 8);
  return {
    schemaVersion: 1,
    title,
    category: "real-estate",
    brief: demo
      ? "Introduce a bright coastal house: arrive, discover the materials, then invite the viewer inside."
      : "",
    script: demo ? "A new horizon. Space to breathe. Your next story starts here." : "",
    aspectRatio: "16:9",
    environment: "coastal",
    shots: demo
      ? [
          first,
          {
            ...createDirectorShot("product-detail", "shot_detail", 8),
            name: "Material detail",
            transition: "fade",
          },
          { ...createDirectorShot("establishing", "shot_invitation", 7), name: "Invitation" },
        ]
      : [first],
    cast: demo
      ? [
          {
            id: "presenter",
            name: "Preview stand-in",
            kind: "placeholder",
            actorProfileId: null,
            performanceProjectId: null,
            referenceAssetId: null,
            rightsConfirmed: false,
            rightsBasis: "",
            position: { x: 1.8, y: 0.1, z: 1 },
            endPosition: { x: 1.8, y: 0.1, z: -2 },
          },
        ]
      : [],
    tracks: demo
      ? [
          {
            id: "demo_walk",
            track: "performance",
            label: "Walk & welcome · stand-in",
            start: 0,
            duration: 15,
            offset: 0,
            volume: 1,
            fadeIn: 0,
            fadeOut: 0,
            assetId: null,
            castId: "presenter",
            instructions: "Walk toward the living room, then turn to face the camera.",
          },
        ]
      : [],
  };
}
export function directorPrompt(document: DirectorDocument, shot: DirectorShot) {
  const template = directorTemplates.find((item) => item.id === shot.templateId)!;
  return [
    "Create ONE continuous cinematic advertising shot. Do not add cuts between camera waypoints.",
    `Project: ${document.title}. Category: ${document.category}. Aspect ratio: ${document.aspectRatio}. Duration: ${shot.duration}s.`,
    document.brief,
    document.script ? `Narrative context (do not add subtitles): ${document.script}` : "",
    template.prompt,
    shot.prompt,
    "Staging coordinates are approximate creative directions in metres, Y up; they are not a reconstruction of reference photographs.",
    ...shot.waypoints.map(
      (point) =>
        `At ${(point.at * shot.duration).toFixed(2)}s: camera (${point.position.x}, ${point.position.y}, ${point.position.z}), look at (${point.target.x}, ${point.target.y}, ${point.target.z}), lens ${point.lens}mm.`,
    ),
    ...document.cast
      .filter((person) => person.kind !== "placeholder")
      .map(
        (person) =>
          `Authorized ${person.kind === "actor" ? "performer" : "virtual character"}: ${person.name}. Use only the supplied visual references; do not invent a real person's performance or endorsement.`,
      ),
    ...document.tracks
      .filter((item) => item.track === "performance" && item.castId)
      .map(
        (item) =>
          `Performance cue at ${item.start}s for ${item.duration}s in the complete film: ${item.instructions}`,
      ),
    "No captions, watermarks, or fabricated endorsements. Use only the supplied, authorized identities.",
  ]
    .filter(Boolean)
    .join("\n");
}
export function directorShotReferenceIds(document: DirectorDocument, shot: DirectorShot) {
  const performanceIds = directorPerformanceSegments(document, shot).map((item) => item.assetId);
  return [
    ...new Set([
      ...shot.referenceIds,
      ...document.cast
        .map((person) => person.referenceAssetId)
        .filter((id): id is string => Boolean(id)),
      ...performanceIds,
    ]),
  ];
}
export function directorPerformanceSegments(document: DirectorDocument, shot: DirectorShot) {
  let start = 0;
  for (const candidate of document.shots) {
    if (candidate.id === shot.id) break;
    start += candidate.duration;
  }
  return document.tracks
    .filter(
      (item) =>
        item.track === "performance" &&
        item.assetId &&
        item.start < start + shot.duration &&
        item.start + item.duration > start,
    )
    .map((item) => {
      const beginning = Math.max(item.start, start),
        end = Math.min(item.start + item.duration, start + shot.duration);
      return {
        assetId: item.assetId!,
        sourceStart: item.offset + beginning - item.start,
        duration: end - beginning,
        arrival: beginning - start,
      };
    });
}
export function directorProviderErrors(
  document: DirectorDocument,
  shot: DirectorShot,
  provider: DirectorProviderId,
  assets: DirectorAsset[],
) {
  const errors: string[] = [];
  const references = directorShotReferenceIds(document, shot).map((id) =>
    assets.find((asset) => asset.id === id),
  );
  const performances = directorPerformanceSegments(document, shot);
  if (new Set(performances.map((item) => item.assetId)).size !== performances.length)
    errors.push(
      "Combine excerpts from the same performance into one file before generating this shot.",
    );
  if (references.some((asset) => !asset || asset.status !== "READY"))
    errors.push("Some references are missing or still being verified.");
  if (references.some((asset) => asset && !asset.aiTransferAllowed))
    errors.push("Explicitly authorize AI transfer for every reference.");
  const template = directorTemplates.find((item) => item.id === shot.templateId)!;
  for (const kind of template.required)
    if (!references.some((asset) => asset?.kind === kind))
      errors.push(`Required reference: ${kind}.`);
  if (provider === "veo") {
    if (document.aspectRatio === "1:1") errors.push("Veo supports 16:9 or 9:16.");
    if (![4, 6, 8].includes(shot.duration))
      errors.push("Veo requires a shot of 4, 6 or 8 seconds.");
    if (references.length && shot.duration !== 8)
      errors.push("Veo requires 8 seconds when using reference images.");
    if (
      references.length > 3 ||
      references.some((asset) => asset && !["image/jpeg", "image/png"].includes(asset.contentType))
    )
      errors.push("This Veo connector supports up to 3 JPEG/PNG references.");
  } else {
    if (shot.duration < 4 || shot.duration > 15 || !Number.isInteger(shot.duration))
      errors.push("Seedance requires a whole-number duration from 4 to 15 seconds.");
    if (references.length > 3) errors.push("This connector supports up to 3 references per shot.");
  }
  return errors;
}
export function directorProductionPlan(
  document: DirectorDocument,
  assets: DirectorAsset[],
  version: number,
) {
  let start = 0;
  return {
    format: "actbyme-director-production-plan",
    schemaVersion: 1,
    version,
    document,
    duration: directorDuration(document),
    disclaimer:
      "Schematic previs. Camera coordinates guide prompts; no deterministic reconstruction or generated identity is guaranteed.",
    shots: document.shots.map((shot) => {
      const entry = {
        ...shot,
        start,
        end: start + shot.duration,
        prompt: directorPrompt(document, shot),
      };
      start += shot.duration;
      return entry;
    }),
    assets: assets.map(({ id, name, kind, contentType, duration }) => ({
      id,
      name,
      kind,
      contentType,
      duration,
    })),
  };
}
export function splitDirectorShot(
  document: DirectorDocument,
  shotId: string,
  localTime: number,
  newId: string,
): DirectorDocument {
  const copy = structuredClone(document),
    index = copy.shots.findIndex((shot) => shot.id === shotId),
    shot = copy.shots[index];
  if (!shot || localTime < 0.5 || localTime > shot.duration - 0.5) return copy;
  // Sample both halves in physical time: a split preserves the original path, including easing.
  const makeHalf = (start: number, end: number, id: string): DirectorShot => ({
    ...shot,
    id,
    duration: end - start,
    easing: "linear",
    waypoints: Array.from({ length: 12 }, (_, pointIndex) => {
      const at = pointIndex / 11;
      const sampled = sampleDirectorCamera(shot, mix(start, end, at));
      return { id: `${id}_wp_${pointIndex}`, at, ...sampled };
    }),
  });
  copy.shots.splice(index, 1, makeHalf(0, localTime, shot.id), {
    ...makeHalf(localTime, shot.duration, newId),
    name: `${shot.name} · continuation`,
    clipOffset: shot.clipOffset + localTime,
  });
  return copy;
}
