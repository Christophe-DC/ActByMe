"use client";
import type { usePerformanceMotion } from "./use-performance-motion";
export function PerformanceMotionStatus({
  motion,
  disabled,
  showTracking,
  onTracking,
}: {
  motion: ReturnType<typeof usePerformanceMotion>;
  disabled: boolean;
  showTracking: boolean;
  onTracking: (enabled: boolean) => void;
}) {
  return (
    <div role="group" className="performance-motion-status" aria-label="Performance movement">
      <label>
        <input
          type="checkbox"
          aria-label="Transfer movement from video"
          disabled={disabled}
          checked={motion.enabled}
          onChange={(event) => motion.setEnabled(event.target.checked)}
        />{" "}
        Transfer movement from video <small>Free · on this device</small>
      </label>
      {motion.status ? (
        <div role="status">
          <span>{motion.status.stage}</span>
          <progress
            aria-label="Movement analysis progress"
            max={100}
            value={motion.status.progress}
          />
          <button disabled={disabled} onClick={motion.cancel}>
            Cancel analysis
          </button>
        </div>
      ) : motion.error ? (
        <div role="alert">
          <p>{motion.error}</p>
          <button disabled={disabled} onClick={motion.retry}>
            Retry movement analysis
          </button>
        </div>
      ) : motion.motion ? (
        <div>
          <strong>Movement ready</strong>
          <span>
            Body{motion.motion.coverage.hands > 0.15 ? " · hands" : ""}
            {motion.motion.coverage.face > 0.15 ? " · head" : ""} · estimated
          </span>
          {motion.motion.coverage.legs < 0.5 ? (
            <p>Legs are not reliably visible and stay in a neutral pose.</p>
          ) : null}
          {motion.motion.coverage.body < 0.8 ? (
            <p>
              Some movement is hidden or unclear. Check the preview against your original video.
            </p>
          ) : null}
          <details>
            <summary>Movement options</summary>
            <label>
              <input
                type="checkbox"
                aria-label="Show tracked joints"
                checked={showTracking}
                disabled={disabled}
                onChange={(event) => onTracking(event.target.checked)}
              />
              Show tracked joints
            </label>
            <button disabled={disabled} onClick={motion.retry}>
              Analyze again
            </button>
            <button disabled={disabled} onClick={motion.clear}>
              Clear local movement data
            </button>
          </details>
        </div>
      ) : (
        <p>
          {motion.hasSource
            ? motion.enabled
              ? "Preparing movement…"
              : "Camera only: the figure stays fixed."
            : "Import a performance to transfer visible movements."}
        </p>
      )}
    </div>
  );
}
