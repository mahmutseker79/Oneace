// Audit v1.1 §5.28 — send-time suppression decorator.
//
// Three things we want pinned:
//   1. Behavior: a recipient with BOUNCED/COMPLAINED/UNSUBSCRIBED
//      status is short-circuited with ok:false and NEVER reaches
//      the inner mailer. ACTIVE + unknown pass through.
//   2. Wiring: `getMailer()` in index.ts returns an instance
//      wrapped in `DeliverabilityGuardMailer`.
//   3. Fail-open: DB lookup throwing does NOT lose the email —
//      we log and let the inner send proceed.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { DeliverabilityGuardMailer } from "./deliverability-guard";
import type { MailMessage, MailResult, Mailer } from "./mailer";

const INDEX_SRC = readFileSync(resolve(__dirname, "index.ts"), "utf8");

// ─── Source wiring ────────────────────────────────────────────────────

describe("P2-6 §5.28 — getMailer wraps every mailer in the guard", () => {
  it("imports DeliverabilityGuardMailer", () => {
    expect(INDEX_SRC).toMatch(
      /import\s*\{\s*DeliverabilityGuardMailer\s*\}\s*from\s*["']\.\/deliverability-guard["']/,
    );
  });

  it("constructs the guard around the inner mailer", () => {
    // Critical: the guard must wrap BOTH ResendMailer and
    // ConsoleMailer, not just the prod one. Staging runs against
    // shared data where some rows are already suppressed.
    expect(INDEX_SRC).toMatch(/new\s+DeliverabilityGuardMailer\(/);
  });
});

// ─── Unit tests: guard behavior ───────────────────────────────────────

type LookupResult = { emailStatus: string } | null;

function fakeInner(result: MailResult = { ok: true, id: "id-inner" }): {
  mailer: Mailer;
  calls: MailMessage[];
} {
  const calls: MailMessage[] = [];
  const mailer: Mailer = {
    send: vi.fn(async (m: MailMessage) => {
      calls.push(m);
      return result;
    }),
  };
  return { mailer, calls };
}

function fakeDb(res: LookupResult | Error) {
  const findUnique = vi.fn(async () => {
    if (res instanceof Error) throw res;
    return res;
  });
  return {
    user: { findUnique },
  };
}

const fakeLogger = {
  info: vi.fn(),
  warn: vi.fn(),
};

const SAMPLE: MailMessage = {
  to: "Alice@Example.com",
  subject: "Welcome",
  text: "hi",
  html: "<p>hi</p>",
};

describe("DeliverabilityGuardMailer", () => {
  it("passes through when user is ACTIVE", async () => {
    const { mailer: inner, calls } = fakeInner();
    const db = fakeDb({ emailStatus: "ACTIVE" });
    const guarded = new DeliverabilityGuardMailer(inner, db, fakeLogger);

    const result = await guarded.send(SAMPLE);
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it("passes through when user is unknown (no row)", async () => {
    // Invitation flow: new recipients aren't yet in User. They
    // must receive the email or signup breaks.
    const { mailer: inner, calls } = fakeInner();
    const db = fakeDb(null);
    const guarded = new DeliverabilityGuardMailer(inner, db, fakeLogger);

    const result = await guarded.send(SAMPLE);
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it.each(["BOUNCED", "COMPLAINED", "UNSUBSCRIBED"])(
    "suppresses sends for recipients in %s state",
    async (status) => {
      const { mailer: inner, calls } = fakeInner();
      const db = fakeDb({ emailStatus: status });
      const guarded = new DeliverabilityGuardMailer(inner, db, fakeLogger);

      const result = await guarded.send(SAMPLE);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("suppressed");
        expect(result.error).toContain(status);
      }
      // The whole point: inner.send must NOT fire.
      expect(calls).toHaveLength(0);
    },
  );

  it("lowercases + trims the email before lookup", async () => {
    // Canonicalization is the bridge between the webhook (which
    // lowercases before writing) and the guard (which must look
    // up the same key).
    const { mailer: inner } = fakeInner();
    const db = fakeDb({ emailStatus: "ACTIVE" });
    const guarded = new DeliverabilityGuardMailer(inner, db, fakeLogger);

    await guarded.send({ ...SAMPLE, to: "  MIXED@case.io  " });
    const call = (
      db.user.findUnique as unknown as { mock: { calls: Array<[{ where: { email: string } }]> } }
    ).mock.calls[0][0];
    expect(call.where.email).toBe("mixed@case.io");
  });

  it("fails open: lookup throws → send still proceeds", async () => {
    // Rationale doc'd in the module: flaky DB must not swallow
    // password-reset emails.
    const { mailer: inner, calls } = fakeInner();
    const db = fakeDb(new Error("connection reset"));
    const guarded = new DeliverabilityGuardMailer(inner, db, fakeLogger);

    const result = await guarded.send(SAMPLE);
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
  });
});
