export type ActorGuide = {
  duration: string;
  overview: string;
  steps: Array<{ order: number; title: string; instruction: string }>;
  dialogue: string;
  finalChecklist: string[];
};

type ApprovedPlan = {
  title: string;
  targetAiTool: string | null;
  globalDirection: string;
  capturePlan: Record<string, unknown>;
  qaCriteria: string[];
  scene: {
    duration: string | null;
    dialogue: string | null;
    direction: string | null;
    emotionalProgression: string | null;
    startingPosition: string | null;
    bodyPosition: string | null;
    eyeline: string | null;
    gestures: string | null;
    framing: string | null;
    captureRequirements: string | null;
  };
};

function text(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function buildPerformanceOutputs(plan: ApprovedPlan): {
  actorGuide: ActorGuide;
  aiEnginePrompt: string;
} {
  const capture = plan.capturePlan;
  const duration = text(plan.scene.duration, "15–30 seconds");
  const dialogue = text(plan.scene.dialogue, "No spoken dialogue.");
  const actorGuide: ActorGuide = {
    duration,
    overview: text(plan.globalDirection, "Record one continuous performance."),
    steps: [
      {
        order: 1,
        title: "Set up your camera",
        instruction: [
          text(
            capture.cameraPosition,
            text(capture.camera, "Place your phone on a stable support."),
          ),
          text(capture.cameraHeight, "Keep it at eye level."),
          text(capture.orientation, "Use the requested orientation."),
          text(
            plan.scene.framing,
            text(capture.framing, "Check that you fit comfortably in frame."),
          ),
        ].join(" "),
      },
      {
        order: 2,
        title: "Prepare the space",
        instruction: [
          text(capture.lighting, "Use clear, even light on your face."),
          text(capture.audio, "Choose a quiet room and check that your voice is clear."),
          text(capture.background, "Keep the background clean and distraction-free."),
          text(capture.continuity, "Keep your appearance and setup consistent."),
        ].join(" "),
      },
      {
        order: 3,
        title: "Take your starting position",
        instruction: [
          text(plan.scene.startingPosition, "Move into your starting position."),
          text(plan.scene.eyeline, "Look in the directed eyeline."),
        ].join(" "),
      },
      {
        order: 4,
        title: "Perform the script",
        instruction: [
          text(plan.scene.direction, "Follow the acting direction naturally."),
          text(plan.scene.emotionalProgression, "Let the emotion develop through the take."),
          text(plan.scene.bodyPosition, "Follow the planned movement."),
          text(plan.scene.gestures, "Use the planned gestures."),
        ].join(" "),
      },
      {
        order: 5,
        title: "Record one complete take",
        instruction: `${text(capture.recordingRequirements, "Record from beginning to end without cuts.")} Aim for ${duration}.`,
      },
    ],
    dialogue,
    finalChecklist: [
      `The recording is one continuous take lasting ${duration}.`,
      "The full dialogue is clear and audible.",
      text(capture.lighting, "Your face is clearly lit."),
      text(capture.background, "The background is ready."),
    ].filter((item, index, items) => item && items.indexOf(item) === index),
  };

  const engine = plan.targetAiTool?.trim() || "the selected AI video engine";
  const engineGuidance = (() => {
    switch (engine.toLowerCase()) {
      case "runway":
        return "Treat the approved performance as the source video and preserve motion, timing, and lip sync.";
      case "kling":
        return "Prioritize source-performance fidelity, temporal consistency, and stable facial identity.";
      case "luma":
        return "Preserve the source camera language and performance timing while maintaining visual continuity.";
      case "seedance":
        return "Use the source performance as the motion and dialogue reference; keep character and scene continuity stable.";
      default:
        return "Use the approved performance as the source reference and preserve its timing and continuity.";
    }
  })();
  const aiEnginePrompt = [
    `Target engine: ${engine}`,
    `Engine guidance: ${engineGuidance}`,
    `Project: ${plan.title}`,
    `Use the supplied approved actor performance as the source performance for one ${duration} continuous clip.`,
    `Performance intent: ${plan.globalDirection}`,
    `Dialogue: ${dialogue}`,
    `Acting direction: ${text(plan.scene.direction, "Natural, script-faithful delivery.")}`,
    `Emotional progression: ${text(plan.scene.emotionalProgression, "Preserve the approved performance arc.")}`,
    `Movement and gestures: ${text(plan.scene.bodyPosition, "Preserve the source movement.")} ${text(plan.scene.gestures, "Preserve natural gestures.")}`,
    `Eyeline: ${text(plan.scene.eyeline, "Preserve the approved eyeline.")}`,
    `Camera: ${text(capture.camera, "Match the source camera.")} ${text(capture.cameraPosition, "")} ${text(capture.cameraHeight, "")}`,
    `Framing and orientation: ${text(plan.scene.framing, text(capture.framing, "Preserve source framing."))} ${text(capture.orientation, "")}`,
    `Lighting: ${text(capture.lighting, "Preserve natural, consistent lighting.")}`,
    `Background: ${text(capture.background, "Preserve the approved background treatment.")}`,
    `Wardrobe and continuity: ${text(capture.continuity, "Maintain continuity throughout.")}`,
    `Audio: ${text(capture.audio, "Preserve clean dialogue audio.")}`,
    `Quality requirements: ${plan.qaCriteria.join("; ")}`,
    "Do not introduce new logos, product claims, people, dialogue, on-screen text, or brand facts that are not present in the approved plan or source performance.",
  ]
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n\n");

  return { actorGuide, aiEnginePrompt };
}
