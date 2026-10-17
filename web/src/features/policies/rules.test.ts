import { describe, expect, it } from "vitest";
import { PolicyError } from "./errors";
import { policyVersion } from "./fake-repo";
import {
  assertCanCreateDraft,
  assertDraft,
  assertPublishable,
  currentVersion,
  draftOf,
  nextVersionNumber,
  resolveEffectiveAt,
  scheduledVersion,
  versionState,
} from "./rules";

const d = (iso: string) => new Date(iso);
const now = d("2026-10-16T12:00:00Z");

const v1 = policyVersion({ id: "v1", slug: "terms", version: 1, effectiveAt: d("2026-01-01T00:00:00Z") });
const v2 = policyVersion({ id: "v2", slug: "terms", version: 2, effectiveAt: d("2026-06-01T00:00:00Z") });
const v3Scheduled = policyVersion({ id: "v3", slug: "terms", version: 3, effectiveAt: d("2026-12-01T00:00:00Z") });
const v4Draft = policyVersion({ id: "v4", slug: "terms", version: 4, status: "draft", effectiveAt: null, publishedAt: null });
const all = [v1, v2, v3Scheduled, v4Draft];

describe("current version", () => {
  it("is the highest published version already in effect", () => {
    expect(currentVersion(all, now)?.id).toBe("v2");
  });

  it("switches to a scheduled version once its effective date passes (supersedes)", () => {
    expect(currentVersion(all, d("2026-12-01T00:00:00Z"))?.id).toBe("v3");
  });

  it("never counts a draft, and is null when nothing is published", () => {
    expect(currentVersion([v4Draft], now)).toBeNull();
    expect(currentVersion([], now)).toBeNull();
  });
});

describe("version states", () => {
  it("labels draft, scheduled, current and superseded versions", () => {
    expect(all.map((v) => versionState(v, all, now))).toEqual(["superseded", "current", "scheduled", "draft"]);
    expect(scheduledVersion(all, now)?.id).toBe("v3");
    expect(draftOf(all)?.id).toBe("v4");
  });

  it("numbers the next version after the highest one", () => {
    expect(nextVersionNumber(all)).toBe(5);
    expect(nextVersionNumber([])).toBe(1);
  });
});

describe("immutability", () => {
  it("rejects editing a published version with 409", () => {
    const err = (() => {
      try {
        assertDraft(v2);
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(PolicyError);
    expect(err).toMatchObject({ status: 409, code: "POLICY_PUBLISHED" });
    expect(() => assertDraft(v4Draft)).not.toThrow();
  });

  it("allows only one draft per policy", () => {
    expect(() => assertCanCreateDraft(all)).toThrow(expect.objectContaining({ code: "DRAFT_EXISTS" }));
    expect(() => assertCanCreateDraft([v1, v2])).not.toThrow();
  });

  it("needs a title and text before publishing", () => {
    expect(() => assertPublishable({ ...v4Draft, body: "  " })).toThrow(expect.objectContaining({ status: 422 }));
    expect(() => assertPublishable(v2)).toThrow(expect.objectContaining({ status: 409 }));
  });
});

describe("effective date on publish", () => {
  const published = [v1, v2];

  it("defaults to now", () => {
    expect(resolveEffectiveAt(null, now, published)).toEqual(now);
  });

  it("accepts a future date", () => {
    expect(resolveEffectiveAt(d("2026-11-01T00:00:00Z"), now, published)).toEqual(d("2026-11-01T00:00:00Z"));
  });

  it("rejects a date in the past, but clamps a few seconds of clock skew to now", () => {
    expect(() => resolveEffectiveAt(d("2026-10-15T00:00:00Z"), now, published)).toThrow(
      expect.objectContaining({ status: 422, fields: { effectiveAt: expect.stringMatching(/past/) } }),
    );
    expect(resolveEffectiveAt(d("2026-10-16T11:59:30Z"), now, published)).toEqual(now);
  });

  it("can't go before an already published (scheduled) version", () => {
    expect(() => resolveEffectiveAt(d("2026-11-01T00:00:00Z"), now, [...published, v3Scheduled])).toThrow(
      expect.objectContaining({ fields: { effectiveAt: expect.stringMatching(/version 3/) } }),
    );
    expect(resolveEffectiveAt(d("2026-12-02T00:00:00Z"), now, [...published, v3Scheduled])).toEqual(d("2026-12-02T00:00:00Z"));
  });
});
