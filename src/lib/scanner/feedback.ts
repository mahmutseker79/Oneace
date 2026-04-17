/**
 * Scanner audio + haptic feedback — P9.1b.
 *
 * Provides two feedback signals:
 *   - success: short high-pitched beep + brief vibration
 *   - error:   lower longer tone + double-pulse vibration
 *
 * Uses the Web Audio API (universally available on modern browsers)
 * and the Vibration API (Android Chrome, some desktop browsers; a
 * no-op on iOS Safari which silently ignores the call).
 *
 * The module is purely client-side. It is safe to import on the
 * server because all functions guard on `typeof window`.
 */

// ---------------------------------------------------------------------------
// Audio context — lazy-initialised on first use so we don't create a
// context on page load (browsers throttle unused contexts).
// ---------------------------------------------------------------------------

let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      audioCtx = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      )();
    } catch {
      return null;
    }
  }
  // Some browsers suspend the context until a user gesture. Resume
  // optimistically — the first scan is always triggered by the user
  // tapping "Start camera", which counts as a gesture.
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playTone(frequency: number, durationMs: number, volume = 0.3) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = frequency;
  gain.gain.value = volume;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + durationMs / 1000);
}

// ---------------------------------------------------------------------------
// Vibration helper
// ---------------------------------------------------------------------------

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Silently ignore — vibration is best-effort.
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Play a success beep and brief vibration. */
export function feedbackSuccess() {
  playTone(880, 100, 0.25);
  vibrate(50);
}

/** Play an error/unknown tone and double-pulse vibration. */
export function feedbackError() {
  playTone(400, 200, 0.2);
  vibrate([80, 50, 80]);
}

// ---------------------------------------------------------------------------
// Mute preference — persisted in localStorage
// ---------------------------------------------------------------------------

const MUTE_KEY = "oneace-scanner-mute";

export function isMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (muted) {
      localStorage.setItem(MUTE_KEY, "1");
    } else {
      localStorage.removeItem(MUTE_KEY);
    }
  } catch {
    // Quota or private-mode — swallow.
  }
}

/**
 * Conditionally play success feedback, respecting mute state.
 * This is the function scanner code should call.
 */
export function scanSuccess() {
  if (!isMuted()) feedbackSuccess();
}

/**
 * Conditionally play error feedback, respecting mute state.
 */
export function scanError() {
  if (!isMuted()) feedbackError();
}
