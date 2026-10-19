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
  X,
} from "lucide-react";
import {
  directorActiveStatuses,
  directorPrompt,
  directorProductionPlan,
  directorProviderErrors,
  type DirectorDocument,
  type DirectorState,
  type DirectorShot,
  type DirectorProviderId,
} from "@actbyme/shared";
import { directorApi } from "@/lib/api/client";
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
}: {
  id?: string;
  state: DirectorState | null;
  document: DirectorDocument;
  shot: DirectorShot;
  onError: (message: string) => void;
  onSave: () => Promise<DirectorState | null>;
  onRefresh: () => Promise<void>;
  onUseClip: (shotId: string, assetId: string) => void;
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
      onError(error instanceof Error ? error.message : "Impossible de créer le traitement.");
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
      onError(error instanceof Error ? error.message : "Export impossible.");
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
      onError(error instanceof Error ? error.message : "Fichier indisponible.");
    }
  };
  return (
    <aside className="director-inspector director-generate">
      <div className="director-panel-heading">
        <strong>Production</strong>
        <span className="director-badge">À la demande</span>
      </div>
      <p className="director-hint">
        Validez votre prévisualisation avant de générer. Chaque plan se remplace indépendamment.
      </p>
      <label>
        Moteur IA
        <select
          aria-label="Moteur de génération vidéo"
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
            ? "Configuré · accès réel à valider au premier appel"
            : (provider?.reason ?? "Aucun fournisseur configuré dans la démo")}
        </span>
      </div>
      <p className="director-hint">
        {provider?.centsPerSecond
          ? `${(provider.centsPerSecond / 100).toFixed(3)} USD/s · tarif serveur configuré`
          : "Coût inconnu : tarif non configuré. Aucun achat possible."}
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
          Format compatible avec ce connecteur.
        </p>
      )}
      {document.cast.some((person) => person.kind === "placeholder") ? (
        <p className="director-hint">
          Retirez les mannequins ou remplacez-les par des personnages autorisés avant la génération.
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
        {shot.clipAssetId ? "Régénérer ce plan" : "Générer ce plan"}
        {estimate ? <small>{(estimate / 100).toFixed(2)} USD max.</small> : null}
      </button>
      <details>
        <summary>Instructions structurées du plan</summary>
        <textarea
          readOnly
          aria-label="Prompt du plan"
          rows={9}
          value={directorPrompt(document, shot)}
        />
        <p className="director-hint">
          Le modèle interprète la caméra et les références. Ni la géométrie, ni l’identité, ni la
          synchronisation labiale ne sont garanties.
        </p>
      </details>
      <div className="director-inspector-section">
        <strong>Clip utilisé dans le montage</strong>
        <select
          aria-label="Clip du plan sélectionné"
          value={shot.clipAssetId ?? ""}
          onChange={(event) => onUseClip(shot.id, event.target.value)}
        >
          <option value="">Associer un clip importé ou généré…</option>
          {assets
            .filter((asset) => asset.status === "READY" && asset.kind === "clip")
            .map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name} · {asset.duration?.toFixed(1)}s
              </option>
            ))}
        </select>
        <p className="director-hint">
          Importez vos clips manuellement dans Ressources si aucun fournisseur n’est configuré.
        </p>
      </div>
      <div className="director-inspector-section">
        <div className="director-panel-heading">
          <strong>Export final</strong>
          <Film size={16} />
        </div>
        <p className="director-hint">
          {missing.length
            ? `${missing.length} plan(s) attendent un clip.`
            : "Tous les plans ont un clip associé."}
        </p>
        <button
          disabled={
            !id || missing.length > 0 || busy || !state?.capabilities.workerReady || !rights
          }
          onClick={() => void enqueue("EXPORT")}
        >
          <Film size={14} />
          Assembler le MP4
        </button>
        <label className="director-checkbox">
          <input
            type="checkbox"
            aria-label="Confirmer les droits pour l’export"
            checked={rights}
            onChange={(event) => setRights(event.target.checked)}
          />
          J’ai vérifié les clips et leurs droits pour cet export.
        </label>
        <button disabled={busy} onClick={() => void exportPlan()}>
          <FileJson size={14} />
          Exporter le dossier de production
        </button>
        <p className="director-hint">
          Le dossier JSON inclut plans, trajectoires, prompts, références et timings, sans URL
          privée.
        </p>
      </div>
      <div className="director-inspector-section">
        <div className="director-panel-heading">
          <strong>Traitements & versions</strong>
          <button aria-label="Actualiser les traitements" onClick={() => void onRefresh()}>
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
                    : (document.shots.find((shot) => shot.id === job.shotId)?.name ?? "Plan")}
                </strong>
                <small>v{job.version}</small>
              </div>
              <p>{job.stage}</p>
              <progress value={job.progress} max="100" aria-label="Avancement du traitement" />
              {job.error ? <p className="director-error-text">{job.error}</p> : null}
              {job.estimatedCostCents ? (
                <small>Réservation : {(job.estimatedCostCents / 100).toFixed(2)} USD</small>
              ) : null}
              <div className="director-inline">
                {directorActiveStatuses.includes(job.status) ? (
                  <button
                    onClick={() => {
                      if (id)
                        void directorApi
                          .mutate(id, `jobs/${job.id}/cancel`)
                          .then(onRefresh)
                          .catch((error: Error) => onError(error.message));
                    }}
                  >
                    <X size={12} />
                    Annuler
                  </button>
                ) : null}
                {job.resultAssetId ? (
                  <>
                    <button onClick={() => void media(job.resultAssetId!, false)}>
                      <Play size={12} />
                      Vérifier
                    </button>
                    {job.kind === "GENERATE" &&
                    job.shotId &&
                    document.shots.some((shot) => shot.id === job.shotId) ? (
                      <button onClick={() => onUseClip(job.shotId!, job.resultAssetId!)}>
                        <Check size={12} />
                        Utiliser
                      </button>
                    ) : null}
                    <button
                      aria-label="Télécharger le résultat vidéo"
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
          <p className="director-hint">Aucune génération n’a été lancée.</p>
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
              <h2 id="director-confirm-title">Confirmer la génération payante</h2>
              <button aria-label="Fermer la confirmation" onClick={() => setConfirm(false)}>
                <X size={18} />
              </button>
            </div>
            <p>
              <strong>{shot.name}</strong> · {shot.duration}s · {provider?.name}
            </p>
            <div className="director-cost">
              {(estimate / 100).toFixed(2)} <small>USD · plafond de cette demande</small>
            </div>
            <p>
              Réservé ce mois : {((state?.capabilities.reservedCents ?? 0) / 100).toFixed(2)} /{" "}
              {((state?.capabilities.budgetCents ?? 0) / 100).toFixed(2)} USD.
            </p>
            <p>
              Les références seront transmises au fournisseur. Une annulation peut rester
              facturable. Les échecs gardent leur réservation jusqu’à rapprochement de la facture.
            </p>
            <label className="director-checkbox">
              <input
                type="checkbox"
                checked={rights}
                onChange={(event) => setRights(event.target.checked)}
              />
              Je confirme les droits d’utilisation, de transformation IA et de transfert des
              références.
            </label>
            <label className="director-checkbox">
              <input
                type="checkbox"
                checked={billable}
                onChange={(event) => setBillable(event.target.checked)}
              />
              J’autorise explicitement cette génération pour un maximum de{" "}
              {(estimate / 100).toFixed(2)} USD selon le tarif configuré.
            </label>
            <button
              className="director-primary"
              disabled={!rights || !billable || busy}
              onClick={() => void enqueue("GENERATE")}
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              Confirmer et lancer
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
            aria-label="Vérifier le résultat"
          >
            <div className="director-panel-heading">
              <strong>Résultat privé · vérification humaine</strong>
              <button aria-label="Fermer la vidéo" onClick={() => setViewUrl(null)}>
                <X size={18} />
              </button>
            </div>
            <video controls src={viewUrl} playsInline />
            <p>
              Vérifiez les identités, les mouvements et le contenu avant d’utiliser ce clip dans le
              montage.
            </p>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
