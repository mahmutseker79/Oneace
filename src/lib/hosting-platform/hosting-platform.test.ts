// v1.3 §5.45/§5.48 F-01/F-04 — hosting-platform module pin.
//
// The platform dispatch is what keeps `platform-quota-health` and
// `platform-webhook-health` working on both Vercel and Netlify from
// the same code path. If detection regresses, the crons on the "wrong"
// platform either misroute their API calls (Netlify function trying
// to read Vercel's deploy list) or skip silently — both are bad.
//
// These tests lock:
//   1. detectPlatform() precedence — HOSTING_PLATFORM wins, then
//      VERCEL=1, then NETLIFY=true, then "unknown".
//   2. getQuotaProvider() dispatch — matches the detected platform
//      and returns null for "unknown".
//   3. The provider's `platform` field matches what dispatch chose —
//      so log consumers can trust the tag.
//
// Static-analysis-first: we use `vi.stubEnv` to simulate build env
// and hit the real factory path. No network, no MSW, no mocks of
// the module under test.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { detectPlatform, getQuotaProvider } from "./index";

const PLATFORM_ENV_KEYS = ["HOSTING_PLATFORM", "VERCEL", "NETLIFY"] as const;

/** Clear all platform hint env vars so each case starts from a known base. */
function clearPlatformEnv(): void {
  for (const k of PLATFORM_ENV_KEYS) {
    // vi.stubEnv with undefined removes the override; delete covers real env.
    vi.stubEnv(k, "");
    delete process.env[k];
  }
}

describe("§5.45/§5.48 — detectPlatform()", () => {
  beforeEach(() => {
    clearPlatformEnv();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    clearPlatformEnv();
  });

  it("returns 'unknown' when no hints are set", () => {
    expect(detectPlatform()).toBe("unknown");
  });

  it("returns 'vercel' when VERCEL=1", () => {
    vi.stubEnv("VERCEL", "1");
    expect(detectPlatform()).toBe("vercel");
  });

  it("returns 'netlify' when NETLIFY=true", () => {
    vi.stubEnv("NETLIFY", "true");
    expect(detectPlatform()).toBe("netlify");
  });

  it("HOSTING_PLATFORM=vercel wins over NETLIFY=true", () => {
    // Explicit override is the escape hatch for dev machines with
    // both flags set.
    vi.stubEnv("NETLIFY", "true");
    vi.stubEnv("HOSTING_PLATFORM", "vercel");
    expect(detectPlatform()).toBe("vercel");
  });

  it("HOSTING_PLATFORM=netlify wins over VERCEL=1", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("HOSTING_PLATFORM", "netlify");
    expect(detectPlatform()).toBe("netlify");
  });

  it("HOSTING_PLATFORM accepts mixed case (normalized lowercase)", () => {
    vi.stubEnv("HOSTING_PLATFORM", "Vercel");
    expect(detectPlatform()).toBe("vercel");

    vi.stubEnv("HOSTING_PLATFORM", "NETLIFY");
    expect(detectPlatform()).toBe("netlify");
  });

  it("ignores HOSTING_PLATFORM when the value is an unknown platform", () => {
    // An unknown override must not falsely claim a platform we have
    // no adapter for. It should fall through to env detection.
    vi.stubEnv("HOSTING_PLATFORM", "cloudflare");
    vi.stubEnv("VERCEL", "1");
    expect(detectPlatform()).toBe("vercel");
  });

  it("VERCEL=1 is preferred over NETLIFY=true when no override is set", () => {
    // Rationale: Vercel has been the original host; any legacy local
    // shell is more likely to carry VERCEL=1 leftovers. Document the
    // precedence so surprises are visible.
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("NETLIFY", "true");
    expect(detectPlatform()).toBe("vercel");
  });

  it("ignores VERCEL=0 (only '1' counts)", () => {
    // Vercel injects VERCEL="1" on their builds; any other value
    // (including "0" or "false") means "not on Vercel".
    vi.stubEnv("VERCEL", "0");
    expect(detectPlatform()).toBe("unknown");
  });

  it("ignores NETLIFY=false (only 'true' counts)", () => {
    vi.stubEnv("NETLIFY", "false");
    expect(detectPlatform()).toBe("unknown");
  });
});

describe("§5.45/§5.48 — getQuotaProvider() dispatch", () => {
  beforeEach(() => {
    clearPlatformEnv();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    clearPlatformEnv();
  });

  it("returns null on 'unknown' — local dev should skip the watchdog", async () => {
    const provider = await getQuotaProvider("unknown");
    expect(provider).toBeNull();
  });

  it("returns a Vercel adapter when platform='vercel'", async () => {
    const provider = await getQuotaProvider("vercel");
    expect(provider).not.toBeNull();
    expect(provider?.platform).toBe("vercel");
    expect(typeof provider?.fetchSnapshot).toBe("function");
  });

  it("returns a Netlify adapter when platform='netlify'", async () => {
    const provider = await getQuotaProvider("netlify");
    expect(provider).not.toBeNull();
    expect(provider?.platform).toBe("netlify");
    expect(typeof provider?.fetchSnapshot).toBe("function");
  });

  it("defaults to detectPlatform() when no argument is passed", async () => {
    vi.stubEnv("HOSTING_PLATFORM", "netlify");
    const provider = await getQuotaProvider();
    expect(provider?.platform).toBe("netlify");
  });

  it("adapter.platform field matches the requested platform", async () => {
    // Tight cross-check — if someone swaps the vercel.ts export to
    // return `platform: "netlify"` by mistake (copy-paste), this test
    // catches it.
    const vercel = await getQuotaProvider("vercel");
    const netlify = await getQuotaProvider("netlify");
    expect(vercel?.platform).toBe("vercel");
    expect(netlify?.platform).toBe("netlify");
    expect(vercel?.platform).not.toBe(netlify?.platform);
  });
});

describe("§5.48 — Vercel adapter fetchSnapshot() contract (shape only, no network)", () => {
  beforeEach(() => {
    clearPlatformEnv();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    clearPlatformEnv();
  });

  it("returns {ok:false, reason:'config'} when VERCEL_TOKEN is missing", async () => {
    // `= undefined` sets the env var to the STRING "undefined",
    // not a missing value. The adapter checks `!VERCEL_TOKEN` which
    // would then be truthy and fall through to the fetch path
    // (reason='transport' on fail). `delete` is the correct unset.
    delete process.env.VERCEL_TOKEN;
    delete process.env.VERCEL_PROJECT_ID;
    const provider = await getQuotaProvider("vercel");
    const result = await provider?.fetchSnapshot();
    expect(result?.ok).toBe(false);
    if (result?.ok === false) {
      expect(result.reason).toBe("config");
    }
  });
});

describe("§5.48 — Netlify adapter fetchSnapshot() contract (shape only, no network)", () => {
  beforeEach(() => {
    clearPlatformEnv();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    clearPlatformEnv();
  });

  it("returns {ok:false, reason:'config'} when NETLIFY_TOKEN is missing", async () => {
    delete process.env.NETLIFY_TOKEN;
    delete process.env.NETLIFY_SITE_ID;
    const provider = await getQuotaProvider("netlify");
    const result = await provider?.fetchSnapshot();
    expect(result?.ok).toBe(false);
    if (result?.ok === false) {
      expect(result.reason).toBe("config");
    }
  });
});
