// Phase 6C — pure-function tests for the PO-receive idempotency
// key derivation helper. The helper is the whole load-bearing
// contract between the form (which mints the nonce) and the server
// action (which pre-checks and stamps rows with the derived keys),
// so the regression floor we want here is "byte-for-byte
// determinism + namespace isolation".

import { describe, expect, it } from "vitest";

import { PO_RECEIVE_KEY_PREFIX, deriveReceiveIdempotencyKey } from "./idempotency";

describe("deriveReceiveIdempotencyKey", () => {
  it("is deterministic for the same (nonce, lineId) pair", () => {
    const nonce = "11111111-1111-4111-8111-111111111111";
    const lineId = "line-abc";
    expect(deriveReceiveIdempotencyKey(nonce, lineId)).toBe(
      deriveReceiveIdempotencyKey(nonce, lineId),
    );
  });

  it("produces distinct keys for different lineIds under the same nonce", () => {
    const nonce = "22222222-2222-4222-8222-222222222222";
    const a = deriveReceiveIdempotencyKey(nonce, "line-a");
    const b = deriveReceiveIdempotencyKey(nonce, "line-b");
    expect(a).not.toEqual(b);
  });

  it("produces distinct keys for the same lineId under different nonces", () => {
    const lineId = "line-shared";
    const a = deriveReceiveIdempotencyKey("33333333-3333-4333-8333-333333333333", lineId);
    const b = deriveReceiveIdempotencyKey("44444444-4444-4444-8444-444444444444", lineId);
    expect(a).not.toEqual(b);
  });

  it("carries the `po-receive:` namespace prefix so single-row movement keys cannot collide", () => {
    const key = deriveReceiveIdempotencyKey("nonce", "line");
    expect(key.startsWith(PO_RECEIVE_KEY_PREFIX)).toBe(true);
  });
});
