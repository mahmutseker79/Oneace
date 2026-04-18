/**
 * P1-8 (audit v1.0 §5.14) — tenant-scoped attachment URL checks.
 *
 * The `/api/upload/image` endpoint now stores uploads under
 * `/uploads/items/{orgId}/{file}`. These tests pin the matching
 * validator: it must accept URLs for the caller's org, reject URLs
 * naming another org, tolerate legacy flat URLs, and reject bogus
 * shapes entirely.
 */

import { describe, expect, it } from "vitest";

import { isAttachmentUrlForOrg } from "./attachment";

describe("isAttachmentUrlForOrg (§5.14)", () => {
  const myOrg = "clabcd1234efgh5678";
  const otherOrg = "clzyxw9876vutsr5432";

  it("accepts a URL scoped to the caller's own org", () => {
    expect(
      isAttachmentUrlForOrg(`/uploads/items/${myOrg}/abcd1234.jpg`, myOrg),
    ).toBe(true);
  });

  it("rejects a URL that names a different org", () => {
    expect(
      isAttachmentUrlForOrg(`/uploads/items/${otherOrg}/abcd1234.jpg`, myOrg),
    ).toBe(false);
  });

  it("tolerates legacy flat URLs that have no org segment", () => {
    // Pre-P1-8 attachments — we can't re-assert tenancy on them but we
    // also don't want to orphan them during the rollout window.
    expect(isAttachmentUrlForOrg("/uploads/items/abcd1234.jpg", myOrg)).toBe(true);
  });

  it("rejects URLs outside the /uploads/items/ prefix", () => {
    expect(isAttachmentUrlForOrg("/etc/passwd", myOrg)).toBe(false);
    expect(isAttachmentUrlForOrg("/random/path.jpg", myOrg)).toBe(false);
  });

  it("accepts absolute https URLs (external CDNs)", () => {
    // Integrations may return a signed URL from a 3rd-party CDN. Those
    // are trusted per-integration, not by this helper.
    expect(
      isAttachmentUrlForOrg("https://cdn.example.com/foo/bar.jpg", myOrg),
    ).toBe(true);
  });

  it("rejects empty or missing URLs", () => {
    expect(isAttachmentUrlForOrg("", myOrg)).toBe(false);
  });

  it("is not fooled by a traversal attempt", () => {
    // "../" inside the URL would put the file outside UPLOAD_ROOT on
    // disk, and it definitely shouldn't satisfy a tenancy check.
    expect(
      isAttachmentUrlForOrg(`/uploads/items/${otherOrg}/../${myOrg}/x.jpg`, myOrg),
    ).toBe(false);
  });
});
