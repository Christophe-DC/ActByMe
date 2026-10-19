"use client";
import { useRef, useState } from "react";
import {
  Camera,
  Check,
  ChevronRight,
  Film,
  ImagePlus,
  Loader2,
  Music2,
  Plus,
  Search,
  Upload,
  X,
} from "lucide-react";
import {
  directorAssetKinds,
  directorAssetTypes,
  directorTemplates,
  directorUploadSchema,
  type DirectorAsset,
  type DirectorAssetKind,
  type DirectorTemplate,
} from "@actbyme/shared";
import { directorApi } from "@/lib/api/client";

export function TemplateArt({
  template,
  selected = false,
}: {
  template: DirectorTemplate;
  selected?: boolean;
}) {
  const project = ([x, y, z]: number[]) => ({
    x: 82 + (x! - z!) * 4.4,
    y: 65 - y! * 3 + (x! + z!) * 1.5,
  });
  const points = template.points.map(project);
  return (
    <svg viewBox="0 0 164 92" aria-hidden="true">
      <defs>
        <linearGradient id={`bg-${template.id}`} x2="1" y2="1">
          <stop stopColor={selected ? "#56584b" : "#44483d"} />
          <stop offset="1" stopColor="#202b2c" />
        </linearGradient>
      </defs>
      <rect width="164" height="92" fill={`url(#bg-${template.id})`} />
      <path d="M16 64 L88 37 L151 57 L83 87Z" fill="#777562" />
      <path d="M34 56 V24 L95 12 L95 42Z" fill="#a7a08d" />
      <path d="M95 12 L142 29 V60 L95 42Z" fill="#8a8674" />
      <path d="M34 24 L80 44 V76 L34 56Z" fill="#c0b69f" />
      <path d="M95 21 L132 33 V52 L95 40Z" fill="#455b5d" />
      <path d="M47 37 L61 42 V65 L47 60Z" fill="#414a47" />
      <path d="M63 44 L77 49 V72 L63 67Z" fill="#718b88" />
      <path
        d="M20 69 Q38 41 63 61 T140 58"
        fill="none"
        stroke="#edbd72"
        strokeWidth="1.5"
        opacity="0.25"
      />
      <polyline
        points={points.map((point) => `${point.x},${point.y}`).join(" ")}
        fill="none"
        stroke="#f0c27c"
        strokeWidth="2"
      />
      {points.map((point, index) => (
        <circle key={index} cx={point.x} cy={point.y} r="3" fill="#fcdfaa" />
      ))}
      {template.category === "people" ? (
        <g fill="#d7c6dd">
          <circle cx="109" cy="48" r="3" />
          <path d="M107 52h4l2 12h-8z M107 64v9 M111 64v9" stroke="#d7c6dd" />
        </g>
      ) : null}
    </svg>
  );
}
export function TemplateLibrary({
  selected,
  onAdd,
}: {
  selected: string;
  onAdd: (template: DirectorTemplate) => void;
}) {
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("all");
  const templates = directorTemplates.filter(
    (template) =>
      (category === "all" || template.category === category) &&
      `${template.name} ${template.description}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="director-library">
      <div className="director-panel-heading">
        <strong>Shot templates</strong>
        <span className="director-badge">{directorTemplates.length}</span>
      </div>
      <label className="director-search">
        <Search size={14} />
        <input
          aria-label="Rechercher un modèle de plan"
          placeholder="Rechercher un plan…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <div className="director-library-filters">
        {[
          ["all", "Tous"],
          ["spaces", "Lieux"],
          ["product", "Produit"],
          ["people", "Acteurs"],
        ].map(([value, label]) => (
          <button key={value} aria-pressed={category === value} onClick={() => setCategory(value!)}>
            {label}
          </button>
        ))}
      </div>
      <div className="director-template-grid">
        {templates.map((template) => (
          <button
            key={template.id}
            className={`director-template-card ${template.id === selected ? "is-active" : ""}`}
            onClick={() => onAdd(template)}
            title={`${template.description} Ajouter à la timeline.`}
          >
            <TemplateArt template={template} selected={template.id === selected} />
            <span>
              {template.name}
              <Plus size={12} />
            </span>
          </button>
        ))}
      </div>
      {!templates.length ? (
        <p className="director-hint">Aucun modèle ne correspond à votre recherche.</p>
      ) : null}
      <p className="director-hint">
        <Camera size={14} />
        Choisissez un modèle pour ajouter un plan. Les waypoints restent dans un seul plan continu.
      </p>
    </div>
  );
}
const kindLabels: Record<DirectorAssetKind, string> = {
  property: "Photo de propriété",
  product: "Image de produit",
  character: "Référence personnage",
  brand: "Logo / marque",
  "reference-video": "Vidéo de référence",
  performance: "Performance enregistrée",
  music: "Musique",
  voice: "Voix / dialogue",
  sfx: "Effet sonore",
  clip: "Clip final d’un plan",
};
export { kindLabels };
export function AssetLibrary({
  id,
  assets,
  storageReady,
  onChanged,
  onError,
  onAttach,
  onAddTrack,
}: {
  id?: string;
  assets: DirectorAsset[];
  storageReady: boolean;
  onChanged: () => Promise<void>;
  onError: (error: string) => void;
  onAttach: (asset: DirectorAsset) => void;
  onAddTrack: (asset: DirectorAsset) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null),
    [kind, setKind] = useState<DirectorAssetKind>("property"),
    [rights, setRights] = useState(false),
    [aiTransfer, setAiTransfer] = useState(false),
    [basis, setBasis] = useState(""),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0);
  const [filter, setFilter] = useState("all");
  const upload = async () => {
    if (!id || !file) return;
    const mime = file.type || (file.name.toLowerCase().endsWith(".mov") ? "video/quicktime" : "");
    const input = {
      name: file.name,
      kind,
      contentType: mime,
      sizeBytes: file.size,
      rightsBasis: basis,
      rightsConfirmed: rights,
      aiTransferAllowed: aiTransfer,
    };
    const parsed = directorUploadSchema.safeParse(input);
    if (!parsed.success) {
      onError(parsed.error.issues[0]?.message ?? "Fichier incompatible.");
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      const reservation = await directorApi.reserve(id, parsed.data);
      await directorApi.upload(reservation.upload, file, parsed.data.contentType, setProgress);
      await directorApi.mutate(id, `assets/${reservation.assetId}/complete`);
      await onChanged();
      setFile(null);
      setRights(false);
      setAiTransfer(false);
      setBasis("");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Échec de l’import.");
      await onChanged().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };
  const ready = assets.filter((asset) => filter === "all" || asset.kind === filter);
  return (
    <div className="director-assets">
      <div className="director-panel-heading">
        <strong>Ressources privées</strong>
        <span className="director-badge">{assets.length}/200</span>
      </div>
      <p className="director-hint">
        Photos, clips et sons restent liés à ce projet. 50 MiB maximum par fichier (15 MiB par
        image).
      </p>
      <input
        ref={fileInput}
        type="file"
        className="director-hidden-input"
        accept={Object.values(directorAssetTypes)
          .flat()
          .filter((type, index, types) => types.indexOf(type) === index)
          .join(",")}
        aria-label="Importer une ressource"
        onChange={(event) => {
          const selected = event.target.files?.[0];
          if (selected) {
            setFile(selected);
            setKind(
              selected.type.startsWith("audio/")
                ? "music"
                : selected.type.startsWith("video/")
                  ? "clip"
                  : "property",
            );
          }
          event.target.value = "";
        }}
      />
      <button
        className="director-upload-button"
        disabled={!id || !storageReady || busy}
        onClick={() => fileInput.current?.click()}
      >
        <Upload size={17} />
        <span>
          Importer un fichier<small>JPEG, PNG, WebP · MP4, MOV · audio</small>
        </span>
        <Plus size={16} />
      </button>
      {!id ? (
        <p className="director-hint">Créez un projet enregistré pour importer vos fichiers.</p>
      ) : !storageReady ? (
        <p className="director-hint">
          Stockage privé non configuré. Consultez le guide d’activation.
        </p>
      ) : null}
      {file ? (
        <form
          className="director-import-form"
          onSubmit={(event) => {
            event.preventDefault();
            void upload();
          }}
        >
          <div className="director-inline">
            <strong>{file.name}</strong>
            <button
              type="button"
              aria-label="Fermer l’import"
              disabled={busy}
              onClick={() => setFile(null)}
            >
              <X size={14} />
            </button>
          </div>
          <label>
            Catégorie
            <select
              aria-label="Catégorie"
              value={kind}
              onChange={(event) => setKind(event.target.value as DirectorAssetKind)}
            >
              {directorAssetKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {kindLabels[kind]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Base des droits d’utilisation
            <textarea
              aria-label="Base des droits de la ressource"
              value={basis}
              minLength={10}
              maxLength={2000}
              required
              rows={2}
              placeholder="Création originale, licence ou autorisation…"
              onChange={(event) => setBasis(event.target.value)}
            />
          </label>
          <label className="director-checkbox">
            <input
              required
              type="checkbox"
              checked={rights}
              onChange={(event) => setRights(event.target.checked)}
            />
            Je possède ou détiens les droits de cette ressource et des personnes représentées.
          </label>
          <label className="director-checkbox">
            <input
              type="checkbox"
              checked={aiTransfer}
              onChange={(event) => setAiTransfer(event.target.checked)}
            />
            J’autorise aussi sa transmission aux fournisseurs IA pour ce projet.
          </label>
          <button
            type="submit"
            className="director-primary"
            disabled={busy || !rights || basis.trim().length < 10}
          >
            {busy ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Import {progress}%
              </>
            ) : (
              <>
                <Upload size={14} />
                Importer et vérifier
              </>
            )}
          </button>
        </form>
      ) : null}
      <select
        aria-label="Filtrer les ressources"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
      >
        <option value="all">Toutes les ressources</option>
        {directorAssetKinds.map((kind) => (
          <option key={kind} value={kind}>
            {kindLabels[kind]}
          </option>
        ))}
      </select>
      <div className="director-asset-list">
        {ready.map((asset) => (
          <div
            key={asset.id}
            className="director-asset-card"
            draggable={asset.status === "READY"}
            onDragStart={(event) => event.dataTransfer.setData("text/director-asset", asset.id)}
          >
            <div className="director-asset-icon">
              {asset.contentType.startsWith("image/") ? (
                <ImagePlus size={18} />
              ) : asset.contentType.startsWith("video/") ? (
                <Film size={18} />
              ) : (
                <Music2 size={18} />
              )}
            </div>
            <div>
              <strong title={asset.name}>{asset.name}</strong>
              <small>
                {kindLabels[asset.kind]} ·{" "}
                {asset.duration
                  ? `${asset.duration.toFixed(1)}s`
                  : `${(asset.sizeBytes / 1024 / 1024).toFixed(1)} Mio`}
              </small>
              <small className={asset.status === "FAILED" ? "director-error-text" : ""}>
                {asset.status === "READY"
                  ? "Vérifié"
                  : asset.status === "FAILED"
                    ? asset.error
                    : asset.status === "UPLOADING"
                      ? "Upload incomplet"
                      : "Vérification…"}
              </small>
            </div>
            <div className="director-asset-actions">
              {asset.status === "READY" ? (
                <>
                  <button
                    aria-label={`Associer ${asset.name} au plan`}
                    title="Associer au plan sélectionné"
                    onClick={() => onAttach(asset)}
                  >
                    <ChevronRight size={14} />
                  </button>
                  {asset.hasAudio || asset.kind === "performance" ? (
                    <button
                      aria-label={`Ajouter ${asset.name} à la timeline`}
                      title="Ajouter une piste"
                      onClick={() => onAddTrack(asset)}
                    >
                      <Plus size={14} />
                    </button>
                  ) : null}
                  <button
                    aria-label={`Voir ${asset.name}`}
                    title="Ouvrir un lien privé de 5 minutes"
                    onClick={() => {
                      if (!id) return;
                      void directorApi
                        .media(id, asset.id)
                        .then(({ url }) => window.open(url, "_blank", "noopener,noreferrer"))
                        .catch((error: Error) => onError(error.message));
                    }}
                  >
                    <Check size={14} />
                  </button>
                </>
              ) : null}
              <button
                aria-label={`Supprimer ${asset.name}`}
                title="Retirer une ressource inutilisée ; les versions enregistrées conservent leurs références"
                onClick={() => {
                  if (id)
                    void directorApi
                      .mutate(id, `assets/${asset.id}`, undefined, "DELETE")
                      .then(onChanged)
                      .catch((error: Error) => onError(error.message));
                }}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
      {!ready.length ? (
        <div className="director-empty-state">
          <ImagePlus size={24} />
          <p>Votre bibliothèque commence ici.</p>
          <small>Importez une référence puis associez-la à un plan.</small>
        </div>
      ) : null}
    </div>
  );
}
