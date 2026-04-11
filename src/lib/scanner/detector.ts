// Pluggable barcode-detector abstraction.
//
// Two engines sit behind the same tiny interface:
//
//   1. "native"  — the browser's built-in BarcodeDetector Web API. Fast,
//                   battery-friendly, supported on Chrome / Edge / Android
//                   Chrome and Chromium-based PWAs. NOT supported on
//                   Safari (iOS/macOS) or Firefox as of Sprint 35.
//
//   2. "zxing"   — the @zxing/browser library, lazy-loaded the first time
//                   it's needed. Pure-JS/WASM, ships on every modern browser
//                   including Safari and Firefox. Somewhat slower and uses
//                   more CPU than the native detector, which is why we keep
//                   it behind a feature-detect instead of making it the
//                   default.
//
// Both engines expose a `.detect(videoElement)` method that returns a
// promise of an array of `{ rawValue }` objects. The scanner component
// polls this on a throttled requestAnimationFrame loop so it does not care
// which engine it's talking to. The factory `createDetector` is also async
// so the ZXing bundle never ships to browsers that don't need it.
//
// If neither engine can run (no camera API, getUserMedia blocked at the
// platform level, or the dynamic import fails), `createDetector` returns
// null and the caller degrades to the manual-entry-only experience.

export type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
};

export type DetectorEngine = "native" | "zxing";

export type CreatedDetector = {
  engine: DetectorEngine;
  detector: BarcodeDetectorLike;
};

// Native BarcodeDetector supports a formats list. Our ZXing adapter ignores
// it because BrowserMultiFormatReader scans every supported format by
// default, which is the right behaviour for the warehouse case (we don't
// know ahead of time what symbology a supplier's labels use).
const NATIVE_FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "qr_code",
  "itf",
];

// --- Native engine ----------------------------------------------------------

type NativeBarcodeDetectorCtor = new (options?: { formats?: string[] }) => {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
};

function getNativeCtor(): NativeBarcodeDetectorCtor | null {
  if (typeof globalThis === "undefined") return null;
  const globalObj = globalThis as unknown as {
    BarcodeDetector?: NativeBarcodeDetectorCtor;
  };
  return globalObj.BarcodeDetector ?? null;
}

function buildNativeDetector(): BarcodeDetectorLike | null {
  const Ctor = getNativeCtor();
  if (!Ctor) return null;
  // Some browsers advertise BarcodeDetector but reject unknown formats, so
  // we fall back to the no-arg constructor on failure. If even that throws,
  // we pretend the engine isn't available and let the caller try ZXing.
  let instance: InstanceType<NativeBarcodeDetectorCtor>;
  try {
    instance = new Ctor({ formats: NATIVE_FORMATS });
  } catch {
    try {
      instance = new Ctor();
    } catch {
      return null;
    }
  }
  const pinned = instance;
  return {
    detect: (source) => pinned.detect(source),
  };
}

// --- ZXing engine -----------------------------------------------------------

// Cache the reader across calls so we only pay the dynamic import cost once
// per page load. The module cache would make the repeat import cheap, but
// keeping a handle on the reader instance means we also reuse its internal
// DecodeHints map and canvas allocation between scans.
let zxingPromise: Promise<BarcodeDetectorLike | null> | null = null;

async function buildZxingDetector(): Promise<BarcodeDetectorLike | null> {
  if (zxingPromise) return zxingPromise;
  zxingPromise = (async () => {
    try {
      const mod = await import("@zxing/browser");
      const Reader = mod.BrowserMultiFormatReader;
      if (!Reader) return null;
      const reader = new Reader();
      return {
        detect: async (source) => {
          // BrowserMultiFormatReader#decode is synchronous: it snapshots the
          // current video frame to an internal canvas, runs the decoder, and
          // either returns a Result or throws. NotFoundException is the
          // happy-path "no code in frame" signal — we map it to an empty
          // array so the scanner's RAF loop just retries on the next tick.
          try {
            // decode() is documented as protected/internal in the TypeScript
            // types but the runtime actually exports it as a public helper
            // on BrowserMultiFormatReader. Casting avoids the `.d.ts`
            // private flag without pulling in a deeper workaround.
            const result = (
              reader as unknown as {
                decode: (element: HTMLVideoElement) => { getText: () => string };
              }
            ).decode(source);
            const text = result.getText();
            return text ? [{ rawValue: text }] : [];
          } catch (err) {
            // ZXing throws a grab-bag of exception classes (NotFoundException,
            // ChecksumException, FormatException) for recoverable scan
            // failures. Treat anything that isn't fatal as "no code this
            // frame" — the RAF loop will try again on the next tick.
            const name = (err as { name?: string } | null)?.name ?? "";
            const message = (err as { message?: string } | null)?.message ?? "";
            if (
              name === "NotFoundException" ||
              name === "ChecksumException" ||
              name === "FormatException" ||
              message.includes("NotFoundException") ||
              message.includes("No MultiFormat Readers")
            ) {
              return [];
            }
            throw err;
          }
        },
      };
    } catch {
      // Dynamic import failed (offline, bundler misconfig, CSP). We fall
      // through to null so the caller can show the "unsupported" state.
      return null;
    }
  })();
  return zxingPromise;
}

// --- Public factory ---------------------------------------------------------

export async function createDetector(): Promise<CreatedDetector | null> {
  // Prefer the native engine when it's available — it's faster, uses less
  // battery, and has better format detection on most scan angles.
  const native = buildNativeDetector();
  if (native) return { engine: "native", detector: native };

  // Fall back to the lazy-loaded ZXing engine on browsers that don't ship
  // BarcodeDetector (Safari, Firefox, older Chromiums).
  const zxing = await buildZxingDetector();
  if (zxing) return { engine: "zxing", detector: zxing };

  return null;
}

// Exported for tests / storybook harnesses that want to force an engine.
export const __private = {
  buildNativeDetector,
  buildZxingDetector,
};
