# MediaPipe motion analysis assets

Runtime: Google MediaPipe Tasks Vision **1.1.1**, Apache License 2.0. Copyright Google LLC / MediaPipe contributors. Source: https://github.com/google-ai-edge/mediapipe . License: https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE . The unmodified pinned package Wasm loaders/runtimes are copied during build. The license is included alongside this notice.

Official float16 version-1 task bundles, downloaded unchanged and SHA-256 verified by `apps/web/scripts/prepare-director-motion.mjs`:

| Model                                  | Source                                                                                                                     | SHA-256                                                          |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Pose Landmarker Heavy / BlazePose GHUM | https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task | 64437af838a65d18e5ba7a0d39b465540069bc8aae8308de3e318aad31fcbc7b |
| Hand Landmarker                        | https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task             | fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1 |
| Face Landmarker                        | https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task             | 64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff |

Google distributes the MediaPipe models under Apache 2.0. Pose model card: https://storage.googleapis.com/mediapipe-assets/Model%20Card%20BlazePose%20GHUM%203D.pdf . Documentation: https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker . The generated `v1/` assets are ignored by Git and published by the app build. No model is trained or modified by ACTBYME. No external inference endpoint is used.
