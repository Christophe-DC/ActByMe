"use client";
import { useState } from "react";
import {
  Check,
  Download,
  FileJson,
  Film,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
  WandSparkles,
  Upload,
  X,
} from "lucide-react";
import {
  directorActiveStatuses,
  directorBrowserExportError,
  directorPrompt,
  directorProductionPlan,
  directorProviderErrors,
  type DirectorDocument,
  type DirectorState,
  type DirectorShot,
  type DirectorProviderId,
} from "@actbyme/shared";
import { directorApi } from "@/lib/api/client";
import type { useDirectorBrowserExport } from "./use-director-browser-export";
import { useDirectorDialog } from "./use-director-dialog";
export function downloadDirectorJson(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function DirectorGenerate({
  id,
  state,
  document,
  shot,
  onError,
  onSave,
  onRefresh,
  onUseClip,
  onImport,
  browserExport,
}: {
  browserExport: ReturnType<typeof useDirectorBrowserExport>;
  id?: string;
  state: DirectorState | null;
  document: DirectorDocument;
  shot: DirectorShot;
  onError: (message: string) => void;
  onSave: () => Promise<DirectorState | null>;
  onRefresh: () => Promise<void>;
  onUseClip: (shotId: string, assetId: string) => void;
  onImport: () => void;
}) {
  const [providerId, setProviderId] = useState<DirectorProviderId>("veo"),
    [confirm, setConfirm] = useState(false),
    [rights, setRights] = useState(false),
    [billable, setBillable] = useState(false),
    [busy, setBusy] = useState(false),
    [viewUrl, setViewUrl] = useState<string | null>(null);
  const provider = state?.capabilities.providers.find((provider) => provider.id === providerId),
    assets = state?.assets ?? [];
  useDirectorDialog(confirm || Boolean(viewUrl), () => {
    if (!busy) {
      setConfirm(false);
      setViewUrl(null);
    }
  });
  const errors = directorProviderErrors(document, shot, providerId, assets);
  const estimate = provider ? Math.ceil(shot.duration * provider.centsPerSecond) : 0;
  const missing = document.shots.filter((shot) => !shot.clipAssetId);
  const exportError = directorBrowserExportError(document, assets);
  const enqueue = async (kind: "GENERATE" | "EXPORT") => {
    if (!id) return;
    setBusy(true);
    try {
      const saved = await onSave();
      if (!saved) return;
      await directorApi.mutate(id, "jobs", {
        version: saved.version,
        requestKey: crypto.randomUUID(),
        kind,
        ...(kind === "GENERATE" ? { shotId: shot.id, provider: providerId } : {}),
        maxCostCents: kind === "GENERATE" ? estimate : 0,
        confirmBillable: kind === "GENERATE" && billable,
        confirmRights: true,
      });
      setConfirm(false);
      setRights(false);
      setBillable(false);
      await onRefresh();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to create the job.");
    } finally {
      setBusy(false);
    }
  };
  const exportPlan = async () => {
    setBusy(true);
    try {
      if (id) {
        const saved = await onSave();
        if (!saved) return;
        downloadDirectorJson(
          await directorApi.read(id, "production-plan"),
          `${document.title}-production.json`,
        );
      } else
        downloadDirectorJson(
          directorProductionPlan(document, assets, 1),
          `${document.title}-demo-production.json`,
        );
    } catch (error) {
      onError(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  };
  const media = async (assetId: string, download: boolean) => {
    if (!id) return;
    try {
      const { url } = await directorApi.media(id, assetId, download);
      if (download) {
        const anchor = window.document.createElement("a");
        anchor.href = url;
        anchor.rel = "noopener noreferrer";
        anchor.download = "";
        anchor.click();
      } else setViewUrl(url);
    } catch (error) {
      onError(error instanceof Error ? error.message : "File unavailable.");
    }
  };
  return (
    <aside className="director-inspector director-generate">
      <div className="director-panel-heading">
        <strong>Production</strong>
        <Film size={16} />
      </div>
      <p className="director-hint">Import your clips, assign them to shots and export your ad.</p>
      <section className="director-export-section" aria-label="Free MP4 export">
        <div className="director-panel-heading">
          <strong>Export MP4</strong>
          <span className="director-badge">Free · 720p</span>
        </div>
        <p className="director-hint">
          {!id
            ? "Create a project to import clips and export your MP4."
            : missing.length
              ? `${document.shots.length - missing.length}/${document.shots.length} shots ready. Assign a clip to every shot.`
              : "All your shots are ready to export."}
        </p>
        {missing.length ? (
          <button disabled={!id} onClick={onImport}>
            <Upload size={14} />
            Import clips
          </button>
        ) : null}
        <label className="director-checkbox">
          <input
            type="checkbox"
            aria-label="Confirm export rights"
            checked={rights}
            onChange={(event) => setRights(event.target.checked)}
          />
          I have reviewed the clips and their usage rights for this export.
        </label>
        <button
          className="director-primary"
          disabled={
            !id ||
            missing.length > 0 ||
            busy ||
            Boolean(browserExport.status) ||
            !state?.capabilities.browserExportReady ||
            !rights ||
            Boolean(exportError)
          }
          onClick={() => void browserExport.start()}
        >
          <Film size={14} />
          Assemble MP4
        </button>
        {exportError ? <p className="director-error-text">{exportError}</p> : null}
        {browserExport.status ? (
          <div className="director-export-progress">
            <p role="status" aria-live="polite">
              {browserExport.status.stage}
            </p>
            <progress
              aria-label="Browser export progress"
              max="100"
              value={browserExport.status.progress}
            />
            <div className="director-panel-heading">
              <span>{Math.floor(browserExport.status.progress)} %</span>
              <span>{browserExport.elapsedSeconds}s elapsed</span>
            </div>
            <button onClick={browserExport.cancel}>
              <X size={12} />
              Cancel browser export
            </button>
          </div>
        ) : null}
        {browserExport.localFile ? (
          <a
            href={browserExport.localFile.url}
            download={browserExport.localFile.name}
            className="director-button"
          >
            <Download size={14} />
            Download the MP4 from this tab
          </a>
        ) : null}
        <p className="director-hint">Keep this tab open while exporting.</p>
        <details>
          <summary>Free export limits</summary>
          <p className="director-hint">
            Up to 2 minutes, 30 shots and 128 MiB of clips and audio. The first export downloads the
            video engine (~31 MB).
          </p>
          <a
            href="/director-media/NOTICES.md"
            target="_blank"
            rel="noopener noreferrer"
            className="director-hint"
          >
            Open-source software and licenses
          </a>
        </details>
        <button disabled={busy} onClick={() => void exportPlan()}>
          <FileJson size={14} />
          Export production plan
        </button>
      </section>
      <div className="director-inspector-section">
        <strong>Clip used in the edit</strong>
        <select
          aria-label="Selected shot clip"
          value={shot.clipAssetId ?? ""}
          onChange={(event) => onUseClip(shot.id, event.target.value)}
        >
          <option value="">Assign an imported or generated clip…</option>
          {assets
            .filter((asset) => asset.status === "READY" && asset.kind === "clip")
            .map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name} · {asset.duration?.toFixed(1)}s
              </option>
            ))}
        </select>
        <p className="director-hint">Choose another clip to replace only this shot.</p>
      </div>
      <details className="director-ai-options">
        <summary>AI generation · optional</summary>
        <label>
          AI provider
          <select
            aria-label="Video generation provider"
            value={providerId}
            onChange={(event) => setProviderId(event.target.value as DirectorProviderId)}
          >
            <option value="veo">Google Veo 3.1</option>
            <option value="higgsfield">Seedance 2.0 · Higgsfield</option>
          </select>
        </label>
        <div className="director-provider-status">
          <span className={`director-live-dot ${provider?.ready ? "" : "is-offline"}`} />
          <span>
            {provider?.ready
              ? "Configured · live access will be checked on the first request"
              : (provider?.reason ?? "No provider configured in the demo")}
          </span>
        </div>
        <p className="director-hint">
          {provider?.centsPerSecond
            ? `${(provider.centsPerSecond / 100).toFixed(3)} USD/s · configured server rate`
            : "Cost unknown: no rate configured. Purchasing is unavailable."}
        </p>
        <div className="director-production-shot">
          <strong>{shot.name}</strong>
          <span>{shot.duration.toFixed(1)}s</span>
        </div>
        {errors.length ? (
          <ul className="director-validation-list">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ) : (
          <p className="director-success">
            <Check size={14} />
            Format supported by this provider.
          </p>
        )}
        {document.cast.some((person) => person.kind === "placeholder") ? (
          <p className="director-hint">
            Remove preview stand-ins or replace them with authorized characters before generating.
          </p>
        ) : null}
        <button
          className="director-primary"
          disabled={
            !id ||
            !provider?.ready ||
            errors.length > 0 ||
            busy ||
            document.cast.some((person) => person.kind === "placeholder")
          }
          onClick={() => {
            setConfirm(true);
            setRights(false);
            setBillable(false);
          }}
        >
          <WandSparkles size={15} />
          {shot.clipAssetId ? "Regenerate this shot" : "Generate this shot"}
          {estimate ? <small>{(estimate / 100).toFixed(2)} USD max.</small> : null}
        </button>
        <details>
          <summary>Structured shot instructions</summary>
          <textarea
            readOnly
            aria-label="Shot prompt"
            rows={9}
            value={directorPrompt(document, shot)}
          />
          <p className="director-hint">
            The model interprets the camera and references. Geometry, identity and lip sync are not
            guaranteed.
          </p>
        </details>
      </details>
      <div className="director-inspector-section">
        <div className="director-panel-heading">
          <strong>Jobs & versions</strong>
          <button aria-label="Refresh jobs" onClick={() => void onRefresh()}>
            <RefreshCw size={13} />
          </button>
        </div>
        {state?.jobs
          .filter((job) => job.kind !== "INSPECT")
          .map((job) => (
            <div key={job.id} className="director-job">
              <div className="director-panel-heading">
                <strong>
                  {job.kind === "EXPORT"
                    ? "Export MP4"
                    : (document.shots.find((shot) => shot.id === job.shotId)?.name ?? "Shot")}
                </strong>
                <small>v{job.version}</small>
              </div>
              <p>{job.stage}</p>
              <progress value={job.progress} max="100" aria-label="Job progress" />
              {job.error ? <p className="director-error-text">{job.error}</p> : null}
              {job.estimatedCostCents ? (
                <small>Reserved: {(job.estimatedCostCents / 100).toFixed(2)} USD</small>
              ) : null}
              <div className="director-inline">
                {directorActiveStatuses.includes(job.status) ? (
                  <button
                    onClick={() => {
                      if (browserExport.status && job.kind === "EXPORT") browserExport.cancel();
                      if (id)
                        void directorApi
                          .mutate(id, `jobs/${job.id}/cancel`)
                          .then(onRefresh)
                          .catch((error: Error) => onError(error.message));
                    }}
                  >
                    <X size={12} />
                    Cancel
                  </button>
                ) : null}
                {job.resultAssetId ? (
                  <>
                    <button onClick={() => void media(job.resultAssetId!, false)}>
                      <Play size={12} />
                      Review
                    </button>
                    {job.kind === "GENERATE" &&
                    job.shotId &&
                    document.shots.some((shot) => shot.id === job.shotId) ? (
                      <button onClick={() => onUseClip(job.shotId!, job.resultAssetId!)}>
                        <Check size={12} />
                        Use
                      </button>
                    ) : null}
                    <button
                      aria-label="Download video result"
                      onClick={() => void media(job.resultAssetId!, true)}
                    >
                      <Download size={12} />
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        {!state?.jobs.some((job) => job.kind !== "INSPECT") ? (
          <p className="director-hint">Your exports and generations will appear here.</p>
        ) : null}
      </div>
      {confirm ? (
        <div className="director-modal-backdrop" role="presentation">
          <div
            className="director-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="director-confirm-title"
          >
            <div className="director-panel-heading">
              <h2 id="director-confirm-title">Confirm paid generation</h2>
              <button aria-label="Close confirmation" onClick={() => setConfirm(false)}>
                <X size={18} />
              </button>
            </div>
            <p>
              <strong>{shot.name}</strong> · {shot.duration}s · {provider?.name}
            </p>
            <div className="director-cost">
              {(estimate / 100).toFixed(2)} <small>USD · spending limit for this request</small>
            </div>
            <p>
              Reserved this month: {((state?.capabilities.reservedCents ?? 0) / 100).toFixed(2)} /{" "}
              {((state?.capabilities.budgetCents ?? 0) / 100).toFixed(2)} USD.
            </p>
            <p>
              References will be sent to the provider. Cancellation may still be billable. Failed
              requests keep their cost reservation until billing is reconciled.
            </p>
            <label className="director-checkbox">
              <input
                type="checkbox"
                checked={rights}
                onChange={(event) => setRights(event.target.checked)}
              />
              I confirm the rights to use, transform with AI and transfer these references.
            </label>
            <label className="director-checkbox">
              <input
                type="checkbox"
                checked={billable}
                onChange={(event) => setBillable(event.target.checked)}
              />
              I explicitly authorize this generation for up to {(estimate / 100).toFixed(2)} USD at
              the configured rate.
            </label>
            <button
              className="director-primary"
              disabled={!rights || !billable || busy}
              onClick={() => void enqueue("GENERATE")}
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              Confirm and start
            </button>
          </div>
        </div>
      ) : null}
      {viewUrl ? (
        <div className="director-modal-backdrop">
          <div
            className="director-modal director-video-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Review result"
          >
            <div className="director-panel-heading">
              <strong>Private result · human review</strong>
              <button aria-label="Close video" onClick={() => setViewUrl(null)}>
                <X size={18} />
              </button>
            </div>
            <video controls src={viewUrl} playsInline />
            <p>Check identities, movements and content before using this clip in the edit.</p>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
