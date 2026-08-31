import { useEffect, useState } from "react";

export type PresencePhase = "entering" | "entered" | "exiting";

export const PRESENCE_EXIT_DURATION_MS = 160;

function reducedMotionEnabled(): boolean {
  if (typeof document !== "undefined" && document.documentElement.classList.contains("motion-disabled")) return true;
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

function defer(callback: () => void): number | undefined {
  if (typeof window === "undefined") return undefined;
  if (typeof window.requestAnimationFrame === "function") return window.requestAnimationFrame(callback);
  return window.setTimeout(callback, 0);
}

function cancelDeferred(handle: number | undefined): void {
  if (handle === undefined || typeof window === "undefined") return;
  if (typeof window.cancelAnimationFrame === "function") window.cancelAnimationFrame(handle);
  else window.clearTimeout(handle);
}

/** Keep a surface mounted for its exit transition while its logical state is immediate. */
export function usePresence(open: boolean, exitDuration = PRESENCE_EXIT_DURATION_MS): {
  mounted: boolean;
  phase: PresencePhase;
} {
  const [mounted, setMounted] = useState(open);
  const [phase, setPhase] = useState<PresencePhase>(open ? "entering" : "exiting");

  useEffect(() => {
    if (open) {
      setMounted(true);
      setPhase("entering");
      const frame = defer(() => setPhase("entered"));
      return () => cancelDeferred(frame);
    }

    if (!mounted) return undefined;
    setPhase("exiting");
    const duration = reducedMotionEnabled() ? 0 : exitDuration;
    const timer = window.setTimeout(() => setMounted(false), duration);
    return () => window.clearTimeout(timer);
  }, [exitDuration, mounted, open]);

  return { mounted, phase };
}
