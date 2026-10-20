"use client";
import { ChevronLeft, ChevronRight, Plus, RotateCcw, Trash2 } from "lucide-react";
import {
  sampleDirectorCamera,
  createDirectorShot,
  type DirectorDocument,
  type DirectorShot,
  type DirectorWaypoint,
  type DirectorTimelineItem,
  type DirectorAsset,
} from "@actbyme/shared";
import { resizeDirectorShot } from "./director-timeline";

export function NumberControl({
  label,
  value,
  min = 0,
  max = 600,
  step = 0.1,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="director-number-label">
      <span>{label}</span>
      <div>
        <input
          type="number"
          aria-label={label}
          value={Number(value.toFixed(3))}
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            if (!event.target.value) return;
            const value = Number(event.target.value);
            if (Number.isFinite(value) && value >= min && value <= max) onChange(value);
          }}
        />
        {suffix ? <small>{suffix}</small> : null}
      </div>
    </label>
  );
}
export function CameraInspector({
  document,
  shot,
  waypointId,
  onWaypoint,
  onEdit,
  onSeek,
  assets,
}: {
  document: DirectorDocument;
  shot: DirectorShot;
  waypointId: string;
  onWaypoint: (id: string) => void;
  onEdit: (change: (draft: DirectorDocument) => void) => void;
  onSeek: (time: number) => void;
  assets: DirectorAsset[];
}) {
  const point = shot.waypoints.find((point) => point.id === waypointId) ?? shot.waypoints[0]!,
    index = shot.waypoints.indexOf(point);
  let start = 0;
  for (const item of document.shots) {
    if (item.id === shot.id) break;
    start += item.duration;
  }
  const editShot = (change: (shot: DirectorShot) => void) =>
    onEdit((draft) => change(draft.shots.find((item) => item.id === shot.id)!));
  const editPoint = (change: (point: DirectorWaypoint) => void) =>
    editShot((shot) => change(shot.waypoints.find((item) => item.id === point.id)!));
  const selectPoint = (selected: DirectorWaypoint) => {
    onWaypoint(selected.id);
    onSeek(start + selected.at * shot.duration);
  };
  const addPoint = () => {
    if (shot.waypoints.length >= 24) return;
    const targetIndex = index === shot.waypoints.length - 1 ? index - 1 : index;
    const at = (shot.waypoints[targetIndex]!.at + shot.waypoints[targetIndex + 1]!.at) / 2;
    const id = `wp_${crypto.randomUUID()}`;
    const sample = sampleDirectorCamera(shot, at * shot.duration);
    editShot((shot) => {
      shot.waypoints.splice(targetIndex + 1, 0, { id, at, ...sample });
    });
    onWaypoint(id);
    onSeek(start + at * shot.duration);
  };
  return (
    <aside className="director-inspector" aria-label="Shot settings">
      <div className="director-panel-heading">
        <span className="director-eyebrow">Continuous shot</span>
        <strong>{shot.duration.toFixed(1)}s</strong>
      </div>
      <label className="director-shot-name">
        <input
          aria-label="Shot name"
          maxLength={120}
          value={shot.name}
          onChange={(event) => {
            if (event.target.value.trim())
              editShot((shot) => {
                shot.name = event.target.value;
              });
          }}
        />
      </label>
      <div className="director-inspector-tabs">
        <span>Camera</span>
        <span>{shot.waypoints.length} waypoints</span>
      </div>
      <div className="director-panel-heading">
        <strong>Waypoint {String(index + 1).padStart(2, "0")}</strong>
        <div className="director-inline">
          <button
            aria-label="Previous waypoint"
            disabled={index === 0}
            onClick={() => selectPoint(shot.waypoints[index - 1]!)}
          >
            <ChevronLeft size={14} />
          </button>
          <button
            aria-label="Next waypoint"
            disabled={index === shot.waypoints.length - 1}
            onClick={() => selectPoint(shot.waypoints[index + 1]!)}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
      <NumberControl
        label="Arrival within shot"
        value={point.at * shot.duration}
        min={index === 0 ? 0 : (shot.waypoints[index - 1]!.at + 0.001) * shot.duration}
        max={
          index === shot.waypoints.length - 1
            ? shot.duration
            : (shot.waypoints[index + 1]!.at - 0.001) * shot.duration
        }
        suffix="s"
        onChange={(value) => {
          if (index > 0 && index < shot.waypoints.length - 1)
            editPoint((point) => {
              point.at = value / shot.duration;
            });
        }}
      />
      <label>
        Point of interest
        <select
          aria-label="Followed point of interest"
          value={shot.followCastId ?? ""}
          onChange={(event) =>
            editShot((shot) => {
              shot.followCastId = event.target.value || null;
            })
          }
        >
          <option value="">Manual target</option>
          {document.cast.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
      </label>
      <div className="director-xyz">
        <NumberControl
          label="Camera X"
          value={point.position.x}
          min={-100}
          max={100}
          suffix="m"
          onChange={(value) =>
            editPoint((point) => {
              point.position.x = value;
            })
          }
        />
        <NumberControl
          label="Camera height"
          value={point.position.y}
          min={0.1}
          max={50}
          suffix="m"
          onChange={(value) =>
            editPoint((point) => {
              point.position.y = value;
            })
          }
        />
        <NumberControl
          label="Camera Z"
          value={point.position.z}
          min={-100}
          max={100}
          suffix="m"
          onChange={(value) =>
            editPoint((point) => {
              point.position.z = value;
            })
          }
        />
      </div>
      <label className="director-range-label">
        Lens <span>{point.lens.toFixed(0)} mm</span>
        <input
          aria-label="Camera lens"
          type="range"
          min="12"
          max="120"
          step="1"
          value={point.lens}
          onChange={(event) =>
            editPoint((point) => {
              point.lens = Number(event.target.value);
            })
          }
        />
      </label>
      <details>
        <summary>Target position</summary>
        <div className="director-xyz">
          {(["x", "y", "z"] as const).map((axis) => (
            <NumberControl
              key={axis}
              label={`Target ${axis.toUpperCase()}`}
              value={point.target[axis]}
              min={axis === "y" ? 0.1 : -100}
              max={axis === "y" ? 50 : 100}
              suffix="m"
              onChange={(value) =>
                editPoint((point) => {
                  point.target[axis] = value;
                })
              }
            />
          ))}
        </div>
      </details>
      <div className="director-inline director-waypoint-actions">
        <button onClick={addPoint} disabled={shot.waypoints.length >= 24}>
          <Plus size={14} />
          Waypoint
        </button>
        <button
          aria-label="Delete this waypoint"
          disabled={index === 0 || index === shot.waypoints.length - 1}
          onClick={() => {
            editShot((shot) => {
              shot.waypoints = shot.waypoints.filter((item) => item.id !== point.id);
            });
            onWaypoint(shot.waypoints[Math.max(0, index - 1)]!.id);
          }}
        >
          <Trash2 size={14} />
        </button>
        <button
          aria-label="Reset camera move"
          title="Restore the template camera move"
          onClick={() =>
            editShot((shot) => {
              shot.waypoints = createDirectorShot(shot.templateId, shot.id).waypoints;
            })
          }
        >
          <RotateCcw size={14} />
        </button>
      </div>
      <div className="director-inspector-section">
        <NumberControl
          label="Shot duration"
          value={shot.duration}
          min={0.5}
          max={120}
          suffix="s"
          onChange={(value) => onEdit((draft) => resizeDirectorShot(draft, shot.id, value))}
        />
        <label>
          Interpolation
          <select
            aria-label="Camera motion interpolation"
            value={shot.easing}
            onChange={(event) =>
              editShot((shot) => {
                shot.easing = event.target.value as DirectorShot["easing"];
              })
            }
          >
            <option value="smooth">Smooth · cubic spline</option>
            <option value="linear">Linear · constant speed per segment</option>
          </select>
        </label>
        <label>
          Incoming transition
          <select
            aria-label="Shot transition"
            value={shot.transition}
            onChange={(event) =>
              editShot((shot) => {
                shot.transition = event.target.value as DirectorShot["transition"];
              })
            }
          >
            <option value="cut">Hard cut</option>
            <option value="fade">Fade through black</option>
          </select>
        </label>
        {shot.transition === "fade" ? (
          <NumberControl
            label="Fade duration"
            value={shot.transitionDuration}
            min={0.05}
            max={Math.min(2, shot.duration / 2)}
            suffix="s"
            onChange={(value) =>
              editShot((shot) => {
                shot.transitionDuration = value;
              })
            }
          />
        ) : null}
      </div>
      <details className="director-inspector-section" open>
        <summary>Shot references</summary>
        <div className="director-reference-picker">
          {assets
            .filter((asset) => asset.status === "READY" && asset.kind !== "clip")
            .map((asset) => (
              <label className="director-checkbox" key={asset.id}>
                <input
                  type="checkbox"
                  checked={shot.referenceIds.includes(asset.id)}
                  onChange={(event) =>
                    editShot((shot) => {
                      shot.referenceIds = event.target.checked
                        ? [...shot.referenceIds, asset.id]
                        : shot.referenceIds.filter((id) => id !== asset.id);
                    })
                  }
                />
                {asset.name}
              </label>
            ))}
          {!assets.some((asset) => asset.status === "READY" && asset.kind !== "clip") ? (
            <p className="director-hint">Import your references from the asset library.</p>
          ) : null}
        </div>
      </details>
      {shot.clipAssetId ? (
        <div className="director-inspector-section">
          <NumberControl
            label="Clip offset"
            value={shot.clipOffset}
            max={Math.max(
              0,
              (assets.find((asset) => asset.id === shot.clipAssetId)?.duration ?? shot.duration) -
                shot.duration,
            )}
            suffix="s"
            onChange={(value) =>
              editShot((shot) => {
                shot.clipOffset = value;
              })
            }
          />
          <label className="director-checkbox">
            <input
              type="checkbox"
              checked={shot.originalAudio}
              onChange={(event) =>
                editShot((shot) => {
                  shot.originalAudio = event.target.checked;
                })
              }
            />
            Keep original clip audio
          </label>
        </div>
      ) : null}
      <label>
        Creative direction
        <textarea
          aria-label="Shot instructions"
          rows={3}
          maxLength={5000}
          value={shot.prompt}
          onChange={(event) =>
            editShot((shot) => {
              shot.prompt = event.target.value;
            })
          }
          placeholder="Late-afternoon light, gentle camera movement…"
        />
      </label>
    </aside>
  );
}
export function TrackInspector({
  item,
  document,
  onEdit,
}: {
  item: DirectorTimelineItem;
  document: DirectorDocument;
  onEdit: (change: (draft: DirectorDocument) => void) => void;
}) {
  const duration = document.shots.reduce((total, shot) => total + shot.duration, 0);
  const edit = (change: (item: DirectorTimelineItem) => void) =>
    onEdit((draft) => change(draft.tracks.find((track) => track.id === item.id)!));
  return (
    <aside className="director-inspector">
      <div className="director-panel-heading">
        <strong>Timeline item</strong>
        <span className="director-badge">{item.track}</span>
      </div>
      <label>
        Name
        <input
          aria-label="Track name"
          value={item.label}
          maxLength={120}
          onChange={(event) => {
            if (event.target.value.trim())
              edit((item) => {
                item.label = event.target.value;
              });
          }}
        />
      </label>
      <NumberControl
        label="Track start"
        value={item.start}
        max={duration - item.duration}
        suffix="s"
        onChange={(value) =>
          edit((item) => {
            item.start = value;
          })
        }
      />
      <NumberControl
        label="Track duration"
        value={item.duration}
        min={0.1}
        max={duration - item.start}
        suffix="s"
        onChange={(value) =>
          edit((item) => {
            item.duration = value;
            item.fadeIn = Math.min(item.fadeIn, value / 2);
            item.fadeOut = Math.min(item.fadeOut, value / 2);
          })
        }
      />
      <NumberControl
        label="Source offset"
        value={item.offset}
        suffix="s"
        onChange={(value) =>
          edit((item) => {
            item.offset = value;
          })
        }
      />
      <label className="director-range-label">
        Volume <span>{Math.round(item.volume * 100)}%</span>
        <input
          aria-label="Track volume"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={item.volume}
          onChange={(event) =>
            edit((item) => {
              item.volume = Number(event.target.value);
            })
          }
        />
      </label>
      <NumberControl
        label="Audio fade-in"
        value={item.fadeIn}
        max={Math.min(10, item.duration - item.fadeOut)}
        suffix="s"
        onChange={(value) =>
          edit((item) => {
            item.fadeIn = value;
          })
        }
      />
      <NumberControl
        label="Audio fade-out"
        value={item.fadeOut}
        max={Math.min(10, item.duration - item.fadeIn)}
        suffix="s"
        onChange={(value) =>
          edit((item) => {
            item.fadeOut = value;
          })
        }
      />
      {item.track === "performance" ? (
        <>
          <label>
            Performer
            <select
              aria-label="Performance actor"
              value={item.castId ?? ""}
              onChange={(event) =>
                edit((item) => {
                  item.castId = event.target.value || null;
                })
              }
            >
              <option value="">None</option>
              {document.cast.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Performance instructions
            <textarea
              aria-label="Performance instructions"
              value={item.instructions}
              maxLength={3000}
              rows={4}
              onChange={(event) =>
                edit((item) => {
                  item.instructions = event.target.value;
                })
              }
            />
          </label>
        </>
      ) : null}
      <p className="director-hint">
        Drag this item to change its start. Use its right edge to adjust the duration. Enter precise
        values here.
      </p>
    </aside>
  );
}
