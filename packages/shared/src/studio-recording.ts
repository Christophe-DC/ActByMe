import { describeStudioMoment, studioActionLabels } from "./studio-editing.js";
import { sampleCharacter, type StudioScene } from "./director-studio.js";
export type StudioRecordingPlan = ReturnType<typeof studioRecordingPlan>;

// The approved animation is the source for the plan, actor guide and QA dialogue.
// Preview camera cuts never require the actor to cut their recording.
export function studioRecordingPlan(
  scene: StudioScene,
  roleId: string,
  existingCapture: Record<string, unknown> = {},
) {
  const character = scene.characters.find((item) => item.id === roleId);
  if (!character) throw new Error("Choose the actor's role first.");
  const timedDirections = character.keyframes
    .map((frame, index) => {
      const end = character.keyframes[index + 1]?.time ?? scene.duration;
      const direction = describeStudioMoment(scene, roleId, index);
      return (
        frame.time.toFixed(1) +
        "–" +
        end.toFixed(1) +
        "s: " +
        studioActionLabels[sampleCharacter(character, frame.time, scene).action] +
        ". " +
        direction.movement +
        ". " +
        direction.gaze +
        "."
      );
    })
    .join("\n");
  const roleCues = scene.cues
    .filter((cue) => cue.characterId === roleId)
    .sort((first, second) => first.start - second.start);
  const dialogue = roleCues
    .map((cue) => cue.dialogue)
    .filter(Boolean)
    .join("\n");
  const timedDialogue = roleCues
    .map(
      (cue) =>
        cue.start.toFixed(1) +
        "–" +
        cue.end.toFixed(1) +
        "s: " +
        cue.dialogue +
        (cue.direction ? " (" + cue.direction + ")" : ""),
    )
    .join("\n");
  const start = character.keyframes[0]!.position;
  const startingPosition =
    "Start " +
    (start.x < -0.5 ? "on the left side" : start.x > 0.5 ? "on the right side" : "in the center") +
    " of the scene. The room view shows your position; adapt the distances to your available space.";
  const duration = scene.duration.toFixed(1).replace(/\.0$/, "") + " seconds";
  const seated = character.keyframes.find((frame) => frame.action === "sit");
  const seating = seated
    ? "Before recording, place a chair " +
      (seated.position.x - start.x > 0.5
        ? "to your right"
        : seated.position.x - start.x < -0.5
          ? "to your left"
          : "at the sitting position shown in the preview") +
      "."
    : "";
  const framing = "Keep your whole body and every gesture visible throughout the take.";
  const capturePlan = {
    location: "A quiet room with enough space to move safely",
    orientation: "Landscape",
    lighting: "Soft, even light on your face",
    background: "Simple and uncluttered",
    fileFormat: "MP4 or MOV",
    ...existingCapture,
    cameraPosition: "Far enough away to keep your entire performance visible",
    cameraHeight: "Around chest height",
    audio: dialogue.trim()
      ? "Clear voice without background noise"
      : "This role has no spoken lines. Keep the room quiet and preserve the scene timing.",
    camera: "Fixed camera. Preview angles are storytelling references, not recording instructions.",
    framing,
    continuity: "One uninterrupted take, without camera cuts",
    recordingRequirements:
      "Perform only " +
      character.name +
      " for " +
      duration +
      ". Leave pauses for other characters' replies. Follow the animation's timings, gestures and gaze directions.",
  };
  const overview =
    "Play " +
    character.name +
    " in one continuous take. Other people in the preview are your scene partners; you do not record their dialogue. Preview cameras show the intended film, while your recording camera stays fixed.";
  const actorGuide = {
    duration,
    overview,
    steps: [
      {
        order: 1,
        title: "Set up your recording",
        instruction: [
          capturePlan.camera,
          capturePlan.framing,
          capturePlan.lighting,
          capturePlan.audio,
          capturePlan.background,
          capturePlan.orientation,
          seating,
        ].join("\n"),
      },
      { order: 2, title: "Find your starting place", instruction: startingPosition },
      { order: 3, title: "Follow your movements and gaze", instruction: timedDirections },
      {
        order: 4,
        title: "Speak your lines and leave the pauses",
        instruction: timedDialogue || "This role has no dialogue. Keep the full scene timing.",
      },
      {
        order: 5,
        title: "Finish the whole take",
        instruction:
          "Keep recording for " +
          duration +
          ". Stay in character through pauses. Do not imitate the preview's camera cuts.",
      },
    ],
    dialogue,
    finalChecklist: [
      "One continuous take lasting " + duration,
      framing,
      "Only " + character.name + "'s dialogue",
      dialogue.trim()
        ? "Clear voice and the agreed gaze directions"
        : "Silent performance with the agreed timing and gaze directions",
    ],
  };
  const sceneFields = {
    title: scene.title + " · " + character.name,
    duration,
    dialogue,
    direction: timedDirections + (timedDialogue ? "\n\n" + timedDialogue : ""),
    startingPosition,
    bodyPosition: timedDirections,
    eyeline: timedDirections,
    gestures: timedDirections,
    framing,
    captureRequirements: capturePlan.recordingRequirements,
    emotionalProgression: roleCues
      .map((cue) => cue.direction)
      .filter(Boolean)
      .join("\n"),
  };
  return {
    actorGuide,
    capturePlan,
    sceneFields,
    globalDirection: overview,
    qaCriteria: actorGuide.finalChecklist,
    aiEnginePrompt:
      "Use the approved single-role performance as the source for this scene. Preserve identity, dialogue and timings. Other animated characters are references, not additional recorded performances. Preview camera cuts are post-production directions. Approved scene: " +
      JSON.stringify(scene),
  };
}
