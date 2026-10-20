# Director — performance camera references

Director’s primary workflow is **Import → Camera angles → Preview → Export**. It uses one original actor performance and a neutral procedural figure. It does not reconstruct the actor, their clothes or set, and does not track gestures or generate lip sync.

## What creators can do

- Open `/director/demo` to try the editor locally, without an account. Import an MP4/MOV after confirming permission. The local file stays in that tab; reloads do not preserve it. **Save project** signs in and transfers the original into private project storage.
- Create a saved project from `/director` to import directly into the existing private storage. Existing advertising projects keep their original editor and data. The earlier Coastal House demo remains available at `/director/demo?legacy=1`.
- Choose Front, Profile, Close-up, Mouth, Hands, Overhead, Behind, Low angle, Over shoulder or Orbit. Adjust focus, angle, elevation, distance, framing and movement. The camera cannot move below the studio floor.
- Add an angle by splitting the selected interval. Change duration by dragging its right edge, using the keyboard or entering a duration. A neighbouring interval absorbs the change. Reorder by dragging or the earlier/later controls. Deleting merges its duration with a neighbour. Undo and redo are available. Camera intervals always cover the source continuously, without repeating or rearranging the acting performance.
- Play or scrub the original and preview together. The original video’s playback time drives the 3D view. The stand-in stays in a fixed neutral pose; the original remains the reference for acting and gestures.
- Export an actual **H.264/AAC MP4**, plus a JSON plan containing original source metadata, exact intervals, camera parameters, sampled paths and guidance for using the files in an external AI video tool. There is no paid generation API in this workflow. Whether a particular external tool accepts the reference depends on that tool’s current upload limits and capabilities.

## Export and infrastructure

`performance-scene.ts` is shared by the preview, preset thumbnails and reference renderer. Export samples it offline at 24 frames per second. It renders every frame individually, including cuts and orbit/push/pull movements; it does not record the screen or depend on real-time playback speed. A permanent caption identifies the output as a neutral camera reference, without reproduced gestures or lip sync.

FFmpeg.wasm, served from the existing same-origin media assets, encodes batches of at most 48 JPEG frames. Each batch is removed from its virtual filesystem after encoding, then encoded chunks are concatenated and the original audio is muxed in. An audio-free source or muted plan produces a silent AAC track. The result is 720p (1280×720, 720×1280 or 720×720). Input and output are limited to 50 MiB, duration to 120 seconds, and the camera plan to 30 angles. Rendering can take several minutes and the tab must stay open. Cancellation terminates the browser worker. Very long/busy exports are bounded by a one-hour deadline.

The MP4 is downloadable locally. For saved projects, the existing zero-cost browser export job stores an immutable version, uploads the result privately, re-inspects it in the API and validates duration/dimensions before publishing it in project history. Optional native workers never claim browser exports. No new infrastructure, database tables, paid service, external model key, cross-origin isolation or dependency is required.

## Data and compatibility

The existing JSON project schema gains an optional `performance` configuration and optional shot camera parameters. Old documents remain unchanged: no automatic conversion and no migration are needed. New projects created by the primary UI use `workflow: "performance"`; the create API continues to accept legacy requests. Ownership checks, private signed media links, revisions, conflict handling and consent declarations reuse the existing Director services. The new export API uses `kind: "EXPORT"`, `execution: "browser"`, `exportType: "reference"` and a zero cost ceiling. Generation and native assembly are rejected for performance plans.

## Configuration and checks

Local preparation, preview and MP4 download need no credentials. Cloud persistence uses the application’s existing Supabase authentication, API/database and private `actor-private` storage configuration. Run `pnpm media:prepare` in `apps/web` (already part of dev/build) to prepare the existing FFmpeg engine. No worker deployment or AI API setup is necessary.

The automated suite covers camera presets, timing preservation and old documents; backend ownership, actual inspection and zero-cost reference publication; browser import, synchronization, editing, reload, JSON download, actual MP4 decoding, distinct exported camera images and audible original audio. Local-mode tests block every project write and still render a real MP4. Responsive and invalid-file cases are included. Provider requests are never used as test substitutes for reference rendering.
