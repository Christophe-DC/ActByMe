"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, Film, Volume2, ZoomIn, ZoomOut } from "lucide-react";
import { directorDuration, resizePerformanceShot, type DirectorDocument } from "@actbyme/shared";
export function PerformanceTimeline({
  document,
  time,
  selected,
  onSelect,
  onSeek,
  onEdit,
  sourceName,
}: {
  document: DirectorDocument;
  time: number;
  selected: string;
  onSelect: (id: string) => void;
  onSeek: (time: number) => void;
  onEdit: (change: (draft: DirectorDocument) => void) => void;
  sourceName?: string;
}) {
  const [zoom, setZoom] = useState(1);
  const [availableWidth, setAvailableWidth] = useState(840);
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      if (scroll.current) setAvailableWidth(scroll.current.clientWidth);
    });
    observer.observe(scroll.current!);
    return () => observer.disconnect();
  }, []);
  const [resizing, setResizing] = useState<{
    id: string;
    x: number;
    duration: number;
    preview: number;
  } | null>(null);
  const ruler = useRef<HTMLDivElement>(null);
  const duration = directorDuration(document),
    pixels = Math.max(1, availableWidth / duration) * zoom;
  const width = duration * pixels;
  let cursor = 0;
  const visible = resizing ? structuredClone(document) : document;
  if (resizing) resizePerformanceShot(visible, resizing.id, resizing.preview);
  const shots = visible.shots.map((shot) => {
    const start = cursor;
    cursor += shot.duration;
    return { shot, start };
  });
  const seekAt = (clientX: number) => {
    const bounds = ruler.current?.getBoundingClientRect();
    if (bounds) onSeek(Math.max(0, Math.min(duration, (clientX - bounds.left) / pixels)));
  };
  return (
    <section
      className="performance-timeline"
      aria-label="Performance camera timeline"
      onPointerMove={(event) => {
        if (resizing)
          setResizing({
            ...resizing,
            preview: resizing.duration + (event.clientX - resizing.x) / pixels,
          });
      }}
      onPointerUp={() => {
        if (resizing)
          onEdit((draft) => resizePerformanceShot(draft, resizing.id, resizing.preview));
        setResizing(null);
      }}
      onPointerCancel={() => setResizing(null)}
    >
      <header>
        <strong>Camera plan</strong>
        <span>{duration.toFixed(2)} seconds · original performance stays continuous</span>
        <div>
          <button
            aria-label="Zoom out timeline"
            disabled={zoom <= 1}
            onClick={() => setZoom(Math.max(1, zoom - 0.25))}
          >
            <ZoomOut size={15} />
          </button>
          <button onClick={() => setZoom(1)}>Fit</button>
          <button aria-label="Zoom in timeline" onClick={() => setZoom(Math.min(5, zoom + 0.25))}>
            <ZoomIn size={15} />
          </button>
        </div>
      </header>
      <div className="performance-timeline-grid">
        <div className="performance-track-labels">
          <span />
          <span>
            <Camera size={15} />
            Angles
          </span>
          <span>
            <Film size={15} />
            Performance
          </span>
          <span>
            <Volume2 size={15} />
            Original audio
          </span>
        </div>
        <div className="performance-timeline-scroll" ref={scroll}>
          <div className="performance-timeline-content" style={{ width }}>
            <div
              ref={ruler}
              className="performance-ruler"
              role="slider"
              aria-label="Timeline playhead"
              aria-valuemin={0}
              aria-valuemax={duration}
              aria-valuenow={time}
              tabIndex={0}
              onKeyDown={(event) => {
                if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
                  event.preventDefault();
                  onSeek(
                    Math.max(
                      0,
                      Math.min(duration, time + (event.key === "ArrowLeft" ? -1 : 1) / 24),
                    ),
                  );
                }
              }}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                seekAt(event.clientX);
              }}
              onPointerMove={(event) => {
                if (event.buttons === 1 && !resizing) seekAt(event.clientX);
              }}
            >
              {Array.from({ length: Math.ceil(duration / (duration > 30 ? 5 : 1)) }, (_, index) => {
                const at = index * (duration > 30 ? 5 : 1);
                return (
                  <span key={index} style={{ left: at * pixels }}>
                    {at.toFixed(0)}s
                  </span>
                );
              })}
            </div>
            <div className="performance-angle-lane">
              {shots.map(({ shot, start }, index) => (
                <div
                  key={shot.id}
                  className={`performance-angle ${selected === shot.id ? "is-selected" : ""}`}
                  style={{ left: start * pixels, width: shot.duration * pixels }}
                  draggable
                  onDragStart={(event) =>
                    event.dataTransfer.setData("text/performance-angle", shot.id)
                  }
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const moving = event.dataTransfer.getData("text/performance-angle");
                    onEdit((draft) => {
                      const before = draft.shots.findIndex((item) => item.id === moving),
                        after = draft.shots.findIndex((item) => item.id === shot.id);
                      if (before >= 0 && after >= 0)
                        draft.shots.splice(after, 0, draft.shots.splice(before, 1)[0]!);
                    });
                  }}
                >
                  <button
                    aria-label={`Angle ${index + 1}: ${shot.name}`}
                    aria-pressed={selected === shot.id}
                    onClick={() => {
                      onSelect(shot.id);
                      onSeek(start);
                    }}
                  >
                    <strong>{shot.name}</strong>
                    <small>
                      {start.toFixed(2)} – {(start + shot.duration).toFixed(2)}s
                    </small>
                  </button>
                  <span
                    role="slider"
                    tabIndex={0}
                    aria-label={`Duration of angle ${index + 1}`}
                    aria-valuenow={shot.duration}
                    aria-valuemin={0.5}
                    aria-valuemax={duration}
                    onKeyDown={(event) => {
                      if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
                        event.preventDefault();
                        onEdit((draft) =>
                          resizePerformanceShot(
                            draft,
                            shot.id,
                            shot.duration + (event.key === "ArrowLeft" ? -0.1 : 0.1),
                          ),
                        );
                      }
                    }}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      event.currentTarget.setPointerCapture(event.pointerId);
                      setResizing({
                        id: shot.id,
                        x: event.clientX,
                        duration: shot.duration,
                        preview: shot.duration,
                      });
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="performance-source-lane">
              {sourceName ?? "Import your original performance to compare"}
            </div>
            <div className="performance-audio-lane">
              {document.performance?.originalAudio ? "Original sound · synchronized" : "Muted"}
            </div>
            <div
              className="performance-playhead"
              style={{ left: Math.min(width, time * pixels) }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
