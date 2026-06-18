import NProgress from "nprogress";

let activeProgressCount = 0;
let trickleTimer: number | null = null;

function clearTrickleTimer() {
  if (trickleTimer !== null && typeof window !== "undefined") {
    window.clearInterval(trickleTimer);
    trickleTimer = null;
  }
}

function ensureConfigured() {
  NProgress.configure({
    showSpinner: false,
    minimum: 0.14,
    easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    speed: 480,
    trickle: false,
  });
}

export function beginUiProgress(initial = 0.18) {
  if (typeof window === "undefined") return;
  ensureConfigured();
  activeProgressCount += 1;
  if (activeProgressCount === 1) {
    NProgress.set(initial);
    clearTrickleTimer();
    trickleTimer = window.setInterval(() => {
      NProgress.inc(0.06);
    }, 900);
  }
}

export function setUiProgress(value: number) {
  if (typeof window === "undefined") return;
  ensureConfigured();
  NProgress.set(Math.max(0.08, Math.min(0.94, value)));
}

export function finishUiProgress() {
  if (typeof window === "undefined") return;
  activeProgressCount = Math.max(0, activeProgressCount - 1);
  if (activeProgressCount === 0) {
    clearTrickleTimer();
    NProgress.done(true);
  }
}

export async function withUiProgress<T>(task: () => Promise<T>, initial = 0.18) {
  beginUiProgress(initial);
  try {
    return await task();
  } finally {
    finishUiProgress();
  }
}
