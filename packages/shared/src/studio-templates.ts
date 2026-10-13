import { studioDemoScene } from "./director-studio-demo.js";
import { studioSceneSchema, type StudioScene } from "./director-studio.js";
const conversation = structuredClone(studioDemoScene);
conversation.title = "A second chance";
conversation.cues = [
  {
    characterId: "lea",
    start: 6,
    end: 12,
    dialogue: "You're here. I wasn't sure you'd come.",
    direction: "Greet Marc with a small wave.",
  },
  {
    characterId: "marc",
    start: 12,
    end: 18,
    dialogue: "I wanted to talk to you.",
    direction: "Look towards Lea.",
  },
  {
    characterId: "sam",
    start: 18,
    end: 24,
    dialogue: "We're listening.",
    direction: "Turn towards Marc.",
  },
];
const introduction: StudioScene = {
  title: "A confident introduction",
  duration: 20,
  characters: [
    {
      id: "presenter",
      name: "Alex",
      color: "#e7ad52",
      keyframes: [
        {
          time: 0,
          position: { x: 0, y: 0, z: 0 },
          rotation: 0,
          gaze: { x: 0, y: 1.6, z: 4 },
          action: "idle",
        },
        {
          time: 4,
          position: { x: 0, y: 0, z: 0 },
          rotation: 0,
          gaze: { x: 0, y: 1.6, z: 4 },
          action: "wave",
        },
        {
          time: 10,
          position: { x: 0, y: 0, z: 0 },
          rotation: 0,
          gaze: { x: 0, y: 1.6, z: 4 },
          action: "idle",
        },
      ],
    },
  ],
  props: [],
  shots: [
    {
      id: "intro",
      name: "Conversation",
      start: 0,
      end: 20,
      position: { x: 0, y: 1.7, z: 4 },
      endPosition: { x: 0, y: 1.7, z: 3 },
      target: { x: 0, y: 1.4, z: 0 },
      endTarget: { x: 0, y: 1.4, z: 0 },
      fov: 45,
    },
  ],
  cues: [
    {
      characterId: "presenter",
      start: 4,
      end: 16,
      dialogue:
        "Hi, I'm Alex. Every great story starts with a small step. Let's take that step together.",
      direction: "Smile, greet the viewer, then speak with confidence.",
    },
  ],
};
const entrance = structuredClone(conversation);
entrance.title = "An unexpected arrival";
entrance.cues = [
  {
    characterId: "lea",
    start: 6,
    end: 12,
    dialogue: "Wait. There's something you need to know.",
    direction: "Approach, then pause before speaking.",
  },
  {
    characterId: "marc",
    start: 12,
    end: 20,
    dialogue: "I'm listening.",
    direction: "Hold eye contact.",
  },
];
export const studioTemplates = [
  {
    id: "introduction",
    name: "Introduce yourself",
    description: "One person, a warm greeting and a gentle camera move.",
    scene: studioSceneSchema.parse(introduction),
    script:
      "Alex stands facing the camera, waves and says: Hi, I'm Alex. Every great story starts with a small step. Let's take that step together.",
  },
  {
    id: "conversation",
    name: "A conversation",
    description: "Three people, a greeting and different points of view.",
    scene: studioSceneSchema.parse(conversation),
    script:
      "Lea approaches Marc and waves. Sam crosses behind them. Lea: You're here. I wasn't sure you'd come. Marc: I wanted to talk to you. Sam: We're listening.",
  },
  {
    id: "entrance",
    name: "An unexpected arrival",
    description: "An entrance, a reaction and a moving camera.",
    scene: studioSceneSchema.parse(entrance),
    script:
      "Lea approaches Marc. Sam walks behind them. Lea: Wait. There's something you need to know. Marc: I'm listening.",
  },
] as const;
