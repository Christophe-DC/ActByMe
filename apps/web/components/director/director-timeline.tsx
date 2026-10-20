"use client";
import { useRef, useState } from "react";
import {
  AudioLines,
  Camera,
  Clapperboard,
  Copy,
  ClipboardPaste,
  Layers2,
  Minus,
  Plus,
  Scissors,
  Trash2,
  UserRound,
  Volume2,
  Mic2,
  GripVertical,
} from "lucide-react";
import { directorDuration, type DirectorDocument, type DirectorTrack } from "@actbyme/shared";
export type DirectorSelection = { kind: "shot" | "track"; id: string };
const tracks: { id: DirectorTrack; label: string; icon: typeof Volume2 }[] = [
  { id: "performance", label: "Performances", icon: UserRound },
  { id: "voice", label: "Voice & dialogue", icon: Mic2 },
  { id: "music", label: "Music", icon: AudioLines },
  { id: "sfx", label: "Sound effects", icon: Volume2 },
];
export function resizeDirectorShot(document: DirectorDocument, id: string, duration: number) {
  const shot = document.shots.find((shot) => shot.id === id);
  if (!shot) return;
  const before = document.shots
      .slice(0, document.shots.indexOf(shot))
      .reduce((total, item) => total + item.duration, 0),
    oldEnd = before + shot.duration;
  const delta = duration - shot.duration;
  shot.duration = duration;
  shot.transitionDuration = Math.min(shot.transitionDuration, duration / 2);
  const total = directorDuration(document);
  for (const item of document.tracks) {
    if (item.start >= oldEnd) item.start = Math.max(0, item.start + delta);
    item.start = Math.min(item.start, total - 0.1);
    item.duration = Math.min(item.duration, total - item.start);
    item.fadeIn = Math.min(item.fadeIn, item.duration / 2);
    item.fadeOut = Math.min(item.fadeOut, item.duration / 2);
  }
}
export function DirectorTimeline({
  document,
  time,
  selection,
  onSelect,
  onSeek,
  onEdit,
  onDuplicate,
  onCopy,
  onPaste,
  canPaste,
  onDelete,
  onSplit,
  onAssetDrop,
}: {
  document: DirectorDocument;
  time: number;
  selection: DirectorSelection;
  onSelect: (selection: DirectorSelection) => void;
  onSeek: (time: number) => void;
  onEdit: (change: (draft: DirectorDocument) => void) => void;
  onDuplicate: () => void;
  onCopy: () => void;
  onPaste: () => void;
  canPaste: boolean;
  onDelete: () => void;
  onSplit: () => void;
  onAssetDrop: (assetId: string, track: DirectorTrack, start: number) => void;
}) {
  const [zoom, setZoom] = useState(1),
    [pointer, setPointer] = useState<{
      kind: "shot" | "track";
      id: string;
      resize: boolean;
      startX: number;
      original: number;
      preview: number;
    } | null>(null);
  const scroll = useRef<HTMLDivElement>(null),
    ruler = useRef<HTMLDivElement>(null);
  const duration = directorDuration(document),
    pixelsPerSecond = Math.max(14, 960 / Math.max(30, duration)) * zoom,
    width = Math.max(960, duration * pixelsPerSecond);
  const timeFromX = (clientX: number) => {
    const bounds = ruler.current?.getBoundingClientRect();
    return bounds ? Math.min(duration, Math.max(0, (clientX - bounds.left) / pixelsPerSecond)) : 0;
  };
  const movePointer = (clientX: number) => {
    if (!pointer) return;
    const delta = Math.round(((clientX - pointer.startX) / pixelsPerSecond) * 10) / 10;
    setPointer({
      ...pointer,
      preview: Math.max(pointer.resize ? 0.5 : 0, pointer.original + delta),
    });
  };
  const commitPointer = () => {
    if (!pointer) return;
    onEdit((draft) => {
      if (pointer.kind === "shot")
        resizeDirectorShot(draft, pointer.id, Math.min(120, pointer.preview));
      else {
        const item = draft.tracks.find((item) => item.id === pointer.id);
        if (!item) return;
        if (pointer.resize) {
          item.duration = Math.min(pointer.preview, duration - item.start);
          item.fadeIn = Math.min(item.fadeIn, item.duration / 2);
          item.fadeOut = Math.min(item.fadeOut, item.duration / 2);
        } else item.start = Math.min(pointer.preview, duration - item.duration);
      }
    });
    setPointer(null);
  };
  let offset = 0;
  const shots = document.shots.map((shot) => {
    const start = offset;
    offset += shot.duration;
    return { shot, start };
  });
  return (
    <section
      className="director-timeline"
      aria-label="Multitrack timeline"
      onPointerMove={(event) => movePointer(event.clientX)}
      onPointerUp={commitPointer}
      onPointerCancel={() => setPointer(null)}
    >
      <div className="director-timeline-tools">
        <div className="director-inline">
          <strong>Timeline</strong>
          <span>{duration.toFixed(1)} seconds</span>
          <span className="director-badge">24 fps</span>
        </div>
        <div className="director-inline">
          <button
            aria-label="Split at playhead"
            title="Split at playhead (S)"
            onClick={onSplit}
            disabled={selection.kind !== "shot"}
          >
            <Scissors size={14} />
          </button>
          <button aria-label="Copy selection" title="Copy (⌘C)" onClick={onCopy}>
            <Copy size={14} />
          </button>
          <button
            aria-label="Paste selection"
            title="Paste (⌘V)"
            disabled={!canPaste}
            onClick={onPaste}
          >
            <ClipboardPaste size={14} />
          </button>
          <button aria-label="Duplicate selection" title="Duplicate (⌘D)" onClick={onDuplicate}>
            <Layers2 size={14} />
          </button>
          <button aria-label="Delete selection" title="Delete" onClick={onDelete}>
            <Trash2 size={14} />
          </button>
          <span className="director-tool-divider" />
          <button
            aria-label="Zoom out timeline"
            onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
          >
            <Minus size={14} />
          </button>
          <input
            aria-label="Timeline zoom"
            type="range"
            min="0.5"
            max="5"
            step="0.25"
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
          <button aria-label="Zoom in timeline" onClick={() => setZoom(Math.min(5, zoom + 0.25))}>
            <Plus size={14} />
          </button>
        </div>
      </div>
      <div className="director-timeline-body">
        <div className="director-track-labels">
          <div className="director-ruler-spacer" />
          <div>
            <Clapperboard size={14} /> Shots
          </div>
          <div>
            <Camera size={14} /> Cameras
          </div>
          {tracks.map(({ id, label, icon: Icon }) => (
            <div key={id}>
              <Icon size={14} />
              {label}
            </div>
          ))}
        </div>
        <div className="director-track-scroll" ref={scroll}>
          <div className="director-track-content" style={{ width }}>
            <div
              ref={ruler}
              className="director-ruler"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                onSeek(timeFromX(event.clientX));
              }}
              onPointerMove={(event) => {
                if (event.buttons === 1) onSeek(timeFromX(event.clientX));
              }}
              aria-label="Time ruler"
              role="slider"
              tabIndex={0}
              aria-valuemin={0}
              aria-valuemax={duration}
              aria-valuenow={Number(time.toFixed(2))}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  event.preventDefault();
                  onSeek(
                    Math.max(
                      0,
                      Math.min(duration, time + (event.key === "ArrowLeft" ? -1 : 1) / 24),
                    ),
                  );
                }
              }}
            >
              {Array.from({ length: Math.ceil(duration / (zoom >= 2 ? 1 : 5)) + 1 }, (_, index) => {
                const at = index * (zoom >= 2 ? 1 : 5);
                return (
                  <span key={index} style={{ left: at * pixelsPerSecond }}>
                    {Math.floor(at / 60)
                      .toString()
                      .padStart(2, "0")}
                    :{(at % 60).toString().padStart(2, "0")}
                  </span>
                );
              })}
            </div>
            <div className="director-track-row director-video-track">
              {shots.map(({ shot, start }, index) => (
                <div
                  key={shot.id}
                  className={`director-timeline-clip director-video-clip ${selection.kind === "shot" && selection.id === shot.id ? "is-selected" : ""}`}
                  style={{
                    left: start * pixelsPerSecond,
                    width:
                      (pointer?.id === shot.id ? pointer.preview : shot.duration) *
                        pixelsPerSecond -
                      3,
                  }}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/director-shot", shot.id);
                    onSelect({ kind: "shot", id: shot.id });
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const id = event.dataTransfer.getData("text/director-shot");
                    if (!id || id === shot.id) return;
                    onEdit((draft) => {
                      const from = draft.shots.findIndex((item) => item.id === id),
                        to = draft.shots.findIndex((item) => item.id === shot.id);
                      if (from >= 0) draft.shots.splice(to, 0, draft.shots.splice(from, 1)[0]!);
                    });
                  }}
                >
                  <button
                    className="director-clip-select"
                    aria-label={`Shot ${index + 1} : ${shot.name}`}
                    onClick={() => {
                      onSelect({ kind: "shot", id: shot.id });
                      onSeek(start);
                    }}
                  >
                    <GripVertical size={12} />
                    <span className="director-clip-index">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span>{shot.name}</span>
                    <small>
                      {shot.duration.toFixed(1)}s {shot.transition === "fade" ? "· fade" : ""}
                    </small>
                  </button>
                  <button
                    aria-label={`Resize ${shot.name}`}
                    className="director-resize-handle"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      event.currentTarget.setPointerCapture(event.pointerId);
                      setPointer({
                        kind: "shot",
                        id: shot.id,
                        resize: true,
                        startX: event.clientX,
                        original: shot.duration,
                        preview: shot.duration,
                      });
                    }}
                    onDragStart={(event) => event.preventDefault()}
                  />
                </div>
              ))}
            </div>
            <div className="director-track-row director-camera-track">
              {shots.map(({ shot, start }) => (
                <button
                  key={shot.id}
                  className="director-camera-path"
                  style={{
                    left: start * pixelsPerSecond,
                    width: shot.duration * pixelsPerSecond - 3,
                  }}
                  onClick={() => onSelect({ kind: "shot", id: shot.id })}
                  title="One continuous camera move remains one shot"
                >
                  <svg width="100%" height="30" preserveAspectRatio="none" viewBox="0 0 100 30">
                    <path
                      d="M2 20 Q25 28 50 14 T98 12"
                      stroke="#e8b86b"
                      fill="none"
                      strokeWidth="1"
                    />
                    {shot.waypoints.map((point) => (
                      <rect
                        key={point.id}
                        x={2 + point.at * 92}
                        y="11"
                        width="4"
                        height="4"
                        transform={`rotate(45 ${4 + point.at * 92} 13)`}
                        fill="#edbd72"
                      />
                    ))}
                  </svg>
                  <span>{shot.waypoints.length} waypoints</span>
                </button>
              ))}
            </div>
            {tracks.map(({ id, label }) => (
              <div
                key={id}
                className={`director-track-row director-${id}-track`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const assetId = event.dataTransfer.getData("text/director-asset");
                  if (assetId)
                    onAssetDrop(assetId, id, Math.round(timeFromX(event.clientX) * 10) / 10);
                }}
              >
                {!document.tracks.some((item) => item.track === id) ? (
                  <span className="director-empty-track">
                    Drag a file from Assets · {label.toLowerCase()}
                  </span>
                ) : null}
                {document.tracks
                  .filter((item) => item.track === id)
                  .map((item) => {
                    const dragging = pointer?.id === item.id;
                    const start = dragging && !pointer.resize ? pointer.preview : item.start,
                      length = dragging && pointer.resize ? pointer.preview : item.duration;
                    return (
                      <div
                        key={item.id}
                        className={`director-timeline-clip director-audio-clip ${selection.kind === "track" && selection.id === item.id ? "is-selected" : ""}`}
                        style={{
                          left: start * pixelsPerSecond,
                          width: length * pixelsPerSecond - 3,
                        }}
                      >
                        <button
                          className="director-clip-select"
                          aria-label={`${label} : ${item.label}`}
                          onClick={() => onSelect({ kind: "track", id: item.id })}
                          onPointerDown={(event) => {
                            onSelect({ kind: "track", id: item.id });
                            event.currentTarget.setPointerCapture(event.pointerId);
                            setPointer({
                              kind: "track",
                              id: item.id,
                              resize: false,
                              startX: event.clientX,
                              original: item.start,
                              preview: item.start,
                            });
                          }}
                        >
                          <span>{item.label}</span>
                          <small>{item.duration.toFixed(1)}s</small>
                        </button>
                        <button
                          className="director-resize-handle"
                          aria-label={`Resize ${item.label}`}
                          onPointerDown={(event) => {
                            event.currentTarget.setPointerCapture(event.pointerId);
                            setPointer({
                              kind: "track",
                              id: item.id,
                              resize: true,
                              startX: event.clientX,
                              original: item.duration,
                              preview: item.duration,
                            });
                          }}
                        />
                      </div>
                    );
                  })}
              </div>
            ))}
            <div className="director-playhead" style={{ left: time * pixelsPerSecond }}>
              <span />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
