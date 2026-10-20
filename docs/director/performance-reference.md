# Director — performance camera and motion references

Director’s primary workflow is **Import → Camera angles → Preview → Export**. A single actor performance drives the timing and estimated motion of a neutral, rigged figure. This is a single-camera motion estimate, not a reconstruction of identity, clothing, scenery or exact acting. The original video remains the reference for acting and dialogue.

## Creator workflow

- `/director/demo` works locally without an account. Confirm rights and import an MP4/MOV. No original video or landmark data is uploaded in local mode. Save project signs in and stores the original privately using the existing Director API.
- **Transfer movement from video** is on by default. A dedicated browser worker analyzes every source frame at 24 fps using MediaPipe Pose Landmarker Heavy, Hand Landmarker and Face Landmarker. Progress and cancellation remain available. Preview can be used while analysis runs; export waits for movement to be ready. A failed analysis never silently exports a fixed figure. Explicitly turn off transfer for camera-only work.
- Visible shoulders, torso, arms, wrists, fingers, head orientation and approximate jaw opening drive the skeleton. Legs are animated only when reliably visible. Short bounded tracking gaps are interpolated and symmetric, velocity-adaptive smoothing reduces jitter without shifting the performance in time. Longer gaps and unseen parts retain a neutral pose. A tracking overlay is available under Movement options.
- Compare original and 3D side by side, play or scrub them together. The original playback clock drives the 3D sample. Ten camera presets, focus, framing and movements remain available. Timing edits always cover the original continuously; they do not cut/reorder the actor’s performance. Undo, redo and drag/resize remain supported.
- Export a real H.264/AAC MP4 and a JSON camera plan with source metadata, intervals, camera paths and motion coverage/limitations. Camera focus follows the animated face/hands; camera path coordinates in the plan describe the neutral reference frame. Use the MP4 and original together in an external video tool. No generation API is invoked.

## Accuracy limits

Use a well-lit, fixed-camera video with one person. Keep the full body and both hands visible for the best tracking. Occlusion, crossing hands, motion blur, strong camera movement and very tight crops reduce accuracy. Monocular depth is ambiguous: side and rear views show estimates. The skeleton preserves the neutral model’s proportions. Fingers and jaw are approximate; lips, eyes, facial expressions and exact lip sync are not reproduced. Hidden legs stay neutral, with an explicit warning. This is not calibrated multi-camera motion capture.

## Private data and cache

Original videos in saved projects use existing ownership checks, consent and signed private playback. Analysis uses only local video frames; no MediaPipe cloud endpoint or AI API is contacted. Wasm and pinned model weights are served from the app’s own origin. The first analysis downloads approximately 60 MiB of runtime/models (the browser caches them).

A bounded IndexedDB cache holds at most five derived motion tracks for seven days, keyed by source SHA-256 and engine version. Movement options lets the user reanalyze or clear that source’s local data. Landmark arrays never enter project JSON, autosaves or backend revisions. Reopening a saved source on another device recalculates motion locally. Clearing browser data removes this cache. Local-mode originals are not retained across reloads; saved originals persist privately.

## Rendering and infrastructure

`performance-scene.ts` and the same skinned GLB serve live preview, thumbnails and every offline MP4 frame. Animation samples global source time deterministically, independent of seek order, playback speed or recording frame drops. The camera focuses on the animated subject. Animated shadows update with the pose. The permanent output caption identifies estimated movement (or explicitly disabled transfer).

The 2.3 MiB figure is derived from Blender Studio’s CC0 Human Base Meshes. Its checked-in skeleton includes torso, limbs, hands, finger chains, neck, head and jaw. No Blender process runs in production. See `apps/web/public/director-models/NOTICE.md` for authoring and attribution.

FFmpeg.wasm encodes bounded batches of 48 JPEGs, removes each batch, concatenates the clips and muxes original audio. A silent source/muted plan produces silent AAC. Output is 720p at 24 fps, in landscape, portrait or square. Sources and outputs are limited to 50 MiB, duration to 120 seconds and the plan to 30 angles. Keep the tab open; CPU inference and encoding can take several minutes. Recent desktop browsers with WebGL, WebAssembly, OffscreenCanvas and transferable ImageBitmap are required. Errors offer retry or explicit camera-only mode. Cancellation terminates the local worker.

Saved projects retain the existing zero-cost browser export job, immutable project snapshot, private upload, server-side media inspection and export history. No new server, paid worker, cloud model key, database table or migration is needed. Model and runtime download bandwidth remains subject to the existing hosting plan.

## Build and deployment

`pnpm media:prepare` in `apps/web` runs automatically in dev/build. It copies the pinned `@mediapipe/tasks-vision@1.1.1` Wasm files and fetches three version-1 float16 models from Google’s official storage. SHA-256 mismatches fail the build. Assets live under the versioned same-origin `/director-motion/v1/` path with immutable caching. The source URLs, checksums and Apache 2.0 notices are tracked in that directory’s parent. Build runners need HTTPS access to storage.googleapis.com; browsers need no third-party model origin.

No new environment variables are needed. Cloud persistence uses existing Supabase/API/PostgreSQL/private actor-private storage configuration. Existing advertising projects and `/director/demo?legacy=1` retain their original workflow. Performance plans reject paid generation/native assembly.

## Verification

Shared unit tests cover bounded motion validation, exact-time interpolation, deterministic seeks, smoothing, short versus long gaps, and explicit output modes. Browser tests retain camera-only fixtures for camera rendering/audio/private persistence, and cover analysis failure/cancellation. Set `DIRECTOR_MOTION_TEST_VIDEO` to a consented real-person MP4 to run the real MediaPipe → animated preview → decoded MP4 integration test; it never substitutes mocked tracking. The real-person fixture is supplied externally to avoid redistributing stock footage as a test asset.
