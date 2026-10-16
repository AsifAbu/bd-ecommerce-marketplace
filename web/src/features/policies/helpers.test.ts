import { describe, expect, it } from "vitest";
import { CHECKOUT_POLICY_SLUGS, GUEST_CHECKOUT_POLICY_SLUGS, POLICY_SLUGS, SIGNUP_POLICY_SLUGS } from "./catalog";
import { COOKIE_NOTICE_MAX_AGE, cookieNoticeOptions, cookieNoticeValue, shouldShowCookieNotice } from "./cookie-notice";
import { parseDhakaLocal } from "./dates";
import { readPolicyConsent, shownVersionField } from "./form-fields";
import { fillPlaceholders, parseBlocks, splitBold } from "./markdown";
import { SEED_POLICY_TEXT } from "./seed-text";

describe("policy catalog", () => {
  it("covers the plan's policy pages plus the cookie policy", () => {
    expect(POLICY_SLUGS).toEqual(["terms", "privacy", "returns", "delivery", "seller", "cookies"]);
    expect(SIGNUP_POLICY_SLUGS).toEqual(["terms", "privacy"]);
    expect(CHECKOUT_POLICY_SLUGS).toEqual(["returns", "delivery"]);
    expect(GUEST_CHECKOUT_POLICY_SLUGS).toContain("privacy");
  });

  it("has [TEST] seed text for every policy, and the Terms show the DBID", () => {
    for (const slug of POLICY_SLUGS) expect(SEED_POLICY_TEXT[slug].body).toContain("[TEST]");
    expect(SEED_POLICY_TEXT.terms.body).toContain("{{DBID}}");
  });
});

describe("cookie notice", () => {
  it("shows until dismissed", () => {
    expect(shouldShowCookieNotice(undefined, 1)).toBe(true);
    expect(shouldShowCookieNotice(cookieNoticeValue(1), 1)).toBe(false);
  });

  it("shows again when a newer Cookie Policy version takes effect", () => {
    expect(shouldShowCookieNotice("1", 2)).toBe(true);
    expect(shouldShowCookieNotice("2", 1)).toBe(false);
  });

  it("works when no Cookie Policy is published", () => {
    expect(cookieNoticeValue(null)).toBe("0");
    expect(shouldShowCookieNotice(undefined, null)).toBe(true);
    expect(shouldShowCookieNotice("0", null)).toBe(false);
  });

  it("treats a malformed cookie as not dismissed", () => {
    expect(shouldShowCookieNotice("yes", 1)).toBe(true);
    expect(shouldShowCookieNotice("", 1)).toBe(true);
  });

  it("remembers the dismissal for a year, site-wide, httpOnly and secure in production", () => {
    expect(cookieNoticeOptions(true)).toEqual({ path: "/", maxAge: COOKIE_NOTICE_MAX_AGE, sameSite: "lax", httpOnly: true, secure: true });
    expect(COOKIE_NOTICE_MAX_AGE).toBe(31_536_000);
    expect(cookieNoticeOptions(false).secure).toBe(false);
  });
});

describe("policy markdown subset", () => {
  it("parses headings, paragraphs, bullet and numbered lists", () => {
    expect(parseBlocks("## Title\nLine one\nline two\n\n- a\n- b\n  continued\n\n1. first\n2. second\n### Sub")).toEqual([
      { type: "h2", text: "Title" },
      { type: "p", text: "Line one line two" },
      { type: "ul", items: ["a", "b continued"] },
      { type: "ol", items: ["first", "second"] },
      { type: "h3", text: "Sub" },
    ]);
  });

  it("keeps HTML as plain text (rendered by React, never as markup)", () => {
    expect(parseBlocks("<script>alert(1)</script>")).toEqual([{ type: "p", text: "<script>alert(1)</script>" }]);
  });

  it("splits bold runs and fills known placeholders only", () => {
    expect(splitBold("a **b** c")).toEqual([
      { text: "a ", bold: false },
      { text: "b", bold: true },
      { text: " c", bold: false },
    ]);
    expect(fillPlaceholders("DBID: {{DBID}} {{OTHER}}", { DBID: "123" })).toBe("DBID: 123 {{OTHER}}");
  });
});

describe("consent form fields", () => {
  it("reads the checkbox and the versions shown", () => {
    const fd = new FormData();
    fd.set("acceptPolicies", "on");
    fd.set(shownVersionField("returns"), "2");
    fd.set(shownVersionField("delivery"), "x");
    expect(readPolicyConsent(fd, ["returns", "delivery"])).toEqual({ accepted: true, shownVersions: { returns: 2 } });
    expect(readPolicyConsent(new FormData(), ["returns"]).accepted).toBe(false);
  });
});

describe("Dhaka dates", () => {
  it("parses datetime-local input as Bangladesh time (UTC+6)", () => {
    expect(parseDhakaLocal("2026-10-20T09:00")?.toISOString()).toBe("2026-10-20T03:00:00.000Z");
    expect(parseDhakaLocal("")).toBeNull();
    expect(parseDhakaLocal("20/10/2026")).toBeUndefined();
  });
});
