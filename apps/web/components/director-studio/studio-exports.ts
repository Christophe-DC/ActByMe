import { studioRecordingPlan, type StudioScene } from "@actbyme/shared";
import { cameraPreview } from "./studio-storyboard";
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );
export function downloadStudioFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export function studioSceneFile(scene: StudioScene, roleId: string | null) {
  return JSON.stringify({ format: "ActByMe 3D preview", version: 1, roleId, scene }, null, 2);
}
export function studioStoryboardHtml(
  scene: StudioScene,
  roleId: string | null,
  capturePlan: Record<string, unknown> = {},
) {
  const cards = scene.shots
    .map((shot, index) => {
      const shapes = cameraPreview(scene, shot)
        .map(
          (person) =>
            '<g fill="' +
            escapeHtml(person.color) +
            '"><circle cx="' +
            person.x +
            '" cy="' +
            (person.y + person.height / 8) +
            '" r="' +
            person.height / 8 +
            '"/><rect x="' +
            (person.x - person.height / 8) +
            '" y="' +
            (person.y + person.height / 3) +
            '" width="' +
            person.height / 4 +
            '" height="' +
            person.height * 0.6 +
            '" rx="3"/></g>',
        )
        .join("");
      return (
        '<article><svg viewBox="0 0 176 90" role="img" aria-label="Camera view ' +
        (index + 1) +
        '"><rect width="176" height="90" fill="#15161a"/>' +
        shapes +
        "</svg><h3>" +
        (index + 1) +
        ". " +
        escapeHtml(shot.name) +
        "</h3><p>" +
        shot.start.toFixed(1) +
        "–" +
        shot.end.toFixed(1) +
        " seconds</p></article>"
      );
    })
    .join("");
  const plan = roleId ? studioRecordingPlan(scene, roleId, capturePlan) : null;
  const guide = plan
    ? "<h2>Recording guide</h2><p>" +
      escapeHtml(plan.actorGuide.overview) +
      "</p>" +
      plan.actorGuide.steps
        .map(
          (step) =>
            "<h3>" +
            step.order +
            ". " +
            escapeHtml(step.title) +
            '</h3><p class="lines">' +
            escapeHtml(step.instruction) +
            "</p>",
        )
        .join("")
    : "<p>Select an actor role in the studio to include a recording guide.</p>";
  const dialogue = scene.cues
    .map(
      (cue) =>
        "<p><strong>" +
        escapeHtml(scene.characters.find((item) => item.id === cue.characterId)?.name ?? "") +
        " · " +
        cue.start.toFixed(1) +
        "–" +
        cue.end.toFixed(1) +
        "s</strong><br>" +
        escapeHtml(cue.dialogue) +
        "<br>" +
        escapeHtml(cue.direction) +
        "</p>",
    )
    .join("");
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
    escapeHtml(scene.title) +
    '</title><style>body{font:16px/1.6 system-ui,sans-serif;color:#202025;margin:32px auto;max-width:960px;padding:0 20px}h1,h2,h3{line-height:1.3}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px}article{border:1px solid #ddd;border-radius:12px;padding:16px;break-inside:avoid}svg{width:100%;border-radius:8px}.lines{white-space:pre-line}button{padding:12px 20px;font:inherit;border-radius:8px;border:1px solid #aaa}@media print{button{display:none}body{margin:0;max-width:none}.cards{grid-template-columns:repeat(3,1fr)}h2{break-before:auto}h3{break-after:avoid}}</style></head><body><button onclick="window.print()">Print / Save as PDF</button><p>ActByMe · 3D preview for planning</p><h1>' +
    escapeHtml(scene.title) +
    "</h1><p>" +
    scene.duration +
    " seconds · " +
    scene.characters.length +
    ' characters. Camera cuts are preview directions; the actor records one continuous take.</p><h2>Storyboard</h2><div class="cards">' +
    cards +
    "</div><h2>Dialogue and cues</h2>" +
    dialogue +
    guide +
    "</body></html>"
  );
}
export function printStudioStoryboard(
  scene: StudioScene,
  roleId: string | null,
  capturePlan: Record<string, unknown> = {},
) {
  const tab = window.open("", "_blank");
  if (!tab) throw new Error("Allow a new tab to print the storyboard, or download it instead.");
  tab.opener = null;
  tab.document.write(studioStoryboardHtml(scene, roleId, capturePlan));
  tab.document.close();
  tab.focus();
  setTimeout(() => tab.print(), 300);
}
