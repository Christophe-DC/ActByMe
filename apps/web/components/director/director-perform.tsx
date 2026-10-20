"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ExternalLink, Plus, ShieldCheck, Trash2, UserRound } from "lucide-react";
import {
  directorDuration,
  type DirectorDocument,
  type DirectorCast,
  type DirectorAsset,
} from "@actbyme/shared";
import { directorApi, type DirectorCasting, type DirectorGrant } from "@/lib/api/client";
import { NumberControl } from "./director-inspector";
export function DirectorPerform({
  id,
  document,
  assets,
  onEdit,
  onError,
  onSave,
  onRefresh,
}: {
  id?: string;
  document: DirectorDocument;
  assets: DirectorAsset[];
  onEdit: (change: (draft: DirectorDocument) => void) => void;
  onError: (message: string) => void;
  onSave: () => Promise<unknown>;
  onRefresh: () => Promise<void>;
}) {
  const [casting, setCasting] = useState<DirectorCasting>({ actors: [], performances: [] }),
    [grants, setGrants] = useState<DirectorGrant[]>([]),
    [actorId, setActorId] = useState(""),
    [name, setName] = useState(""),
    [rights, setRights] = useState(false),
    [basis, setBasis] = useState(""),
    [terms, setTerms] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!id) return;
    let active = true;
    void Promise.all([directorApi.casting(), directorApi.read<DirectorGrant[]>(id, "grants")])
      .then(([casting, grants]) => {
        if (active) {
          setCasting(casting);
          setGrants(grants);
        }
      })
      .catch((error: Error) => onError(error.message));
    return () => {
      active = false;
    };
  }, [id, onError]);
  const addCast = (kind: DirectorCast["kind"]) => {
    const actor = casting.actors.find((actor) => actor.id === actorId);
    if (kind === "actor" && !actor) return;
    const castId = `cast_${crypto.randomUUID()}`;
    onEdit((draft) => {
      draft.cast.push({
        id: castId,
        name: kind === "actor" ? actor!.stageName : name.trim() || "Preview stand-in",
        kind,
        actorProfileId: kind === "actor" ? actorId : null,
        performanceProjectId: null,
        referenceAssetId: null,
        rightsConfirmed: kind === "virtual" && rights,
        rightsBasis: kind === "virtual" ? basis : "",
        position: { x: 1.8, y: 0.1, z: 0 },
        endPosition: { x: 1.8, y: 0.1, z: 0 },
      });
    });
    setName("");
  };
  const editCast = (castId: string, change: (person: DirectorCast) => void) =>
    onEdit((draft) => change(draft.cast.find((person) => person.id === castId)!));
  const addCue = (person: DirectorCast) =>
    onEdit((draft) => {
      draft.tracks.push({
        id: `performance_${crypto.randomUUID()}`,
        track: "performance",
        label: person.name,
        start: 0,
        duration: Math.min(8, directorDuration(draft)),
        offset: 0,
        volume: 1,
        fadeIn: 0,
        fadeOut: 0,
        assetId: null,
        castId: person.id,
        instructions: "",
      });
    });
  const requestGrant = async (person: DirectorCast) => {
    if (!id || terms.trim().length < 30) {
      onError(
        "Describe usage, duration, territories and AI transformation rights in the permission terms (at least 30 characters).",
      );
      return;
    }
    setBusy(true);
    try {
      if (!(await onSave())) return;
      setGrants(
        await directorApi.mutate<DirectorGrant[]>(id, "grants", {
          actorProfileId: person.actorProfileId,
          terms,
        }),
      );
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to send the request.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="director-perform">
      <div className="director-panel-heading">
        <strong>Casting & performances</strong>
        <UserRound size={16} />
      </div>
      <p className="director-hint">
        Casting prepares the scene. Separate permission is required before transforming a real
        person's identity.
      </p>
      <label>
        ACTBYME actors
        <select
          aria-label="Choose an ACTBYME actor"
          value={actorId}
          onChange={(event) => setActorId(event.target.value)}
        >
          <option value="">Select an actor…</option>
          {casting.actors.map((actor) => (
            <option key={actor.id} value={actor.id}>
              {actor.stageName}
              {actor.city ? ` · ${actor.city}` : ""}
            </option>
          ))}
        </select>
      </label>
      <button
        disabled={!actorId || document.cast.some((person) => person.actorProfileId === actorId)}
        onClick={() => addCast("actor")}
      >
        <Plus size={14} />
        Add to cast
      </button>
      <Link className="director-text-link" href="/actors" target="_blank">
        Browse actors <ExternalLink size={12} />
      </Link>
      <details>
        <summary>Authorized virtual character</summary>
        <label>
          Character name
          <input
            aria-label="Virtual character name"
            value={name}
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          Rights basis
          <textarea
            aria-label="Virtual character rights"
            value={basis}
            maxLength={2000}
            rows={2}
            onChange={(event) => setBasis(event.target.value)}
            placeholder="Original work and reference rights…"
          />
        </label>
        <label className="director-checkbox">
          <input
            type="checkbox"
            checked={rights}
            onChange={(event) => setRights(event.target.checked)}
          />
          I am authorized to use and transform this character.
        </label>
        <button
          disabled={!rights || basis.trim().length < 10 || !name.trim()}
          onClick={() => addCast("virtual")}
        >
          <Plus size={14} />
          Add character
        </button>
      </details>
      <button onClick={() => addCast("placeholder")}>
        <Plus size={14} />
        Add a free stand-in
      </button>
      {document.cast.map((person) => {
        const grant = grants.find(
          (grant) =>
            grant.actorProfileId === person.actorProfileId && grant.acceptedAt && !grant.revokedAt,
        );
        return (
          <div key={person.id} className="director-cast-card">
            <div className="director-panel-heading">
              <strong>{person.name}</strong>
              <button
                aria-label={`Remove ${person.name}`}
                onClick={() =>
                  onEdit((draft) => {
                    draft.cast = draft.cast.filter((candidate) => candidate.id !== person.id);
                    draft.shots.forEach((shot) => {
                      if (shot.followCastId === person.id) shot.followCastId = null;
                    });
                    draft.tracks.forEach((item) => {
                      if (item.castId === person.id) item.castId = null;
                    });
                  })
                }
              >
                <Trash2 size={14} />
              </button>
            </div>
            <small>
              {person.kind === "actor"
                ? "ACTBYME actor · real identity"
                : person.kind === "placeholder"
                  ? "Stand-in · preview only"
                  : "Virtual character · declared rights"}
            </small>
            <div className="director-inline">
              <NumberControl
                label={`${person.name} · start X`}
                value={person.position.x}
                min={-100}
                max={100}
                onChange={(value) =>
                  editCast(person.id, (person) => {
                    person.position.x = value;
                  })
                }
              />
              <NumberControl
                label={`${person.name} · start Z`}
                value={person.position.z}
                min={-100}
                max={100}
                onChange={(value) =>
                  editCast(person.id, (person) => {
                    person.position.z = value;
                  })
                }
              />
            </div>
            <div className="director-inline">
              <NumberControl
                label={`${person.name} · end X`}
                value={person.endPosition.x}
                min={-100}
                max={100}
                onChange={(value) =>
                  editCast(person.id, (person) => {
                    person.endPosition.x = value;
                  })
                }
              />
              <NumberControl
                label={`${person.name} · end Z`}
                value={person.endPosition.z}
                min={-100}
                max={100}
                onChange={(value) =>
                  editCast(person.id, (person) => {
                    person.endPosition.z = value;
                  })
                }
              />
            </div>
            <label>
              Visual reference
              <select
                aria-label={`Visual reference for ${person.name}`}
                value={person.referenceAssetId ?? ""}
                onChange={(event) =>
                  editCast(person.id, (person) => {
                    person.referenceAssetId = event.target.value || null;
                  })
                }
              >
                <option value="">None</option>
                {assets
                  .filter((asset) => asset.status === "READY" && asset.kind === "character")
                  .map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name}
                    </option>
                  ))}
              </select>
            </label>
            <button onClick={() => addCue(person)}>
              <Plus size={13} />
              Add performance
            </button>
            {person.kind === "actor" ? (
              <>
                <label>
                  Existing performance request
                  <select
                    aria-label={`Performance request for ${person.name}`}
                    value={person.performanceProjectId ?? ""}
                    onChange={(event) =>
                      editCast(person.id, (person) => {
                        person.performanceProjectId = event.target.value || null;
                      })
                    }
                  >
                    <option value="">Link an ACTBYME performance request…</option>
                    {casting.performances
                      .filter(
                        (project) => project.assignment?.actorProfileId === person.actorProfileId,
                      )
                      .map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.title} · {project.assignment?.status}
                        </option>
                      ))}
                  </select>
                </label>
                <Link
                  className="director-text-link"
                  href={
                    person.performanceProjectId
                      ? `/create-performance?project=${person.performanceProjectId}`
                      : "/create-performance?new=1"
                  }
                  target="_blank"
                >
                  {person.performanceProjectId
                    ? "Open performance request"
                    : "Prepare a performance request"}
                  <ExternalLink size={12} />
                </Link>
                <p className="director-hint">
                  <ShieldCheck size={14} />
                  {grant
                    ? "Permission accepted for this creative direction."
                    : "AI permission has not been accepted for the current version."}
                </p>
                <button
                  disabled={!id || busy || Boolean(grant)}
                  onClick={() => void requestGrant(person)}
                >
                  {grant ? <Check size={14} /> : <ShieldCheck size={14} />}
                  {grant ? "Authorized" : "Request AI permission"}
                </button>
              </>
            ) : null}
          </div>
        );
      })}
      {document.cast.some((person) => person.kind === "actor") ? (
        <label>
          Proposed actor terms
          <textarea
            aria-label="Actor permission terms"
            rows={4}
            maxLength={4000}
            value={terms}
            onChange={(event) => setTerms(event.target.value)}
            placeholder="Commercial use, territories, duration, AI transformation, providers and any compensation. The actor reviews these before accepting."
          />
          <small>
            The request appears in the actor's Director permissions. Changes to the text, duration
            or cast require new permission.
          </small>
        </label>
      ) : null}
      {id && casting.performances.some((project) => project.takes.length) ? (
        <details>
          <summary>Import an approved ACTBYME take</summary>
          <p className="director-hint">
            Takes are copied into this private project. Record the rights above before importing.
          </p>
          <label className="director-checkbox">
            <input
              type="checkbox"
              checked={rights}
              onChange={(event) => setRights(event.target.checked)}
            />
            I have the rights to reuse this take.
          </label>
          <textarea
            aria-label="Take reuse rights"
            value={basis}
            onChange={(event) => setBasis(event.target.value)}
            placeholder="Performer license and permission…"
          />
          {casting.performances.flatMap((project) =>
            project.takes.map((take) => (
              <button
                key={take.id}
                disabled={busy || !rights || basis.trim().length < 10}
                onClick={() => {
                  setBusy(true);
                  void directorApi
                    .mutate(id, "import-take", {
                      takeId: take.id,
                      rightsBasis: basis,
                      rightsConfirmed: true,
                      aiTransferAllowed: false,
                    })
                    .then(onRefresh)
                    .catch((error: Error) => onError(error.message))
                    .finally(() => setBusy(false));
                }}
              >
                <Plus size={14} />
                {project.title} · {take.originalFileName}
              </button>
            )),
          )}
        </details>
      ) : null}
    </div>
  );
}
