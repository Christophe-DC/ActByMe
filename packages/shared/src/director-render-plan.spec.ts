import assert from "node:assert/strict";
import test from "node:test";
import { createDirectorDocument, createDirectorShot } from "./director.js";
import { directorBrowserExportError } from "./director-render-plan.js";

test("browser export bounds apply to used media, deduplicate sources and preserve larger editable projects", () => {
  const document = createDirectorDocument("Free export");
  document.shots = [
    { ...createDirectorShot("dolly-in", "first", 60), clipAssetId: "shared" },
    { ...createDirectorShot("dolly-out", "second", 60), clipAssetId: "shared" },
  ];
  assert.equal(
    directorBrowserExportError(document, [
      { id: "shared", sizeBytes: 100 * 1024 * 1024 },
      { id: "unused", sizeBytes: 200 * 1024 * 1024 },
    ]),
    null,
  );
  document.shots[1]!.duration = 60.01;
  assert.match(directorBrowserExportError(document, [])!, /2 minutes/);
  document.shots = [createDirectorShot("dolly-in", "first", 4)];
  document.shots[0]!.clipAssetId = "large";
  assert.match(
    directorBrowserExportError(document, [{ id: "large", sizeBytes: 128 * 1024 * 1024 + 1 }])!,
    /128 MiB/,
  );
  document.shots = Array.from({ length: 31 }, (_, index) =>
    createDirectorShot("dolly-in", `shot-${index}`, 2),
  );
  assert.match(directorBrowserExportError(document, [])!, /30 plans/);
});
