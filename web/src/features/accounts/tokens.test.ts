import { describe, expect, it } from "vitest";
import { createTokenService, TOKEN_TTL_MS, type TokenRecord, type TokenStore } from "./tokens";

function setup() {
  let t = new Date("2026-10-16T10:00:00Z");
  const rows: (TokenRecord & { tokenHash: string })[] = [];
  const store: TokenStore = {
    async create(data) {
      rows.push({ ...data, id: String(rows.length + 1), usedAt: null });
    },
    async findByHash(hash) {
      return rows.find((r) => r.tokenHash === hash) ?? null;
    },
    async markUsed(id, at) {
      const row = rows.find((r) => r.id === id)!;
      if (row.usedAt) return false;
      row.usedAt = at;
      return true;
    },
  };
  const tokens = createTokenService(store, () => t);
  return { tokens, rows, advance: (ms: number) => (t = new Date(t.getTime() + ms)) };
}

describe("password reset tokens", () => {
  it("stores only a hash and works once", async () => {
    const { tokens, rows } = setup();
    const raw = await tokens.issue("u1", "password_reset", "c@ecom.test");
    expect(raw.length).toBeGreaterThanOrEqual(40);
    expect(rows[0].tokenHash).not.toBe(raw);
    await expect(tokens.consume(raw, "password_reset")).resolves.toMatchObject({ ok: true, token: { userId: "u1" } });
    await expect(tokens.consume(raw, "password_reset")).resolves.toEqual({ ok: false, code: "INVALID" });
  });

  it("expires after 1 hour", async () => {
    const { tokens, advance } = setup();
    const raw = await tokens.issue("u1", "password_reset", "c@ecom.test");
    advance(TOKEN_TTL_MS.password_reset);
    await expect(tokens.consume(raw, "password_reset")).resolves.toEqual({ ok: false, code: "EXPIRED" });
  });

  it("is valid just before expiry", async () => {
    const { tokens, advance } = setup();
    const raw = await tokens.issue("u1", "password_reset", "c@ecom.test");
    advance(TOKEN_TTL_MS.password_reset - 1000);
    await expect(tokens.consume(raw, "password_reset")).resolves.toMatchObject({ ok: true });
  });

  it("rejects unknown tokens and tokens of another type", async () => {
    const { tokens } = setup();
    const raw = await tokens.issue("u1", "email_verify", "c@ecom.test");
    await expect(tokens.consume(raw, "password_reset")).resolves.toEqual({ ok: false, code: "INVALID" });
    await expect(tokens.consume("made-up", "password_reset")).resolves.toEqual({ ok: false, code: "INVALID" });
    await expect(tokens.consume("", "password_reset")).resolves.toEqual({ ok: false, code: "INVALID" });
  });
});
