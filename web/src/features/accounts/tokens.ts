import { createHash, randomBytes } from "node:crypto";

export type TokenType = "password_reset" | "email_verify";

export const TOKEN_TTL_MS: Record<TokenType, number> = {
  password_reset: 60 * 60_000, // 1 hour
  email_verify: 24 * 60 * 60_000, // 24 hours
};

export interface TokenRecord {
  id: string;
  userId: string;
  type: TokenType;
  email: string;
  expiresAt: Date;
  usedAt: Date | null;
}

export interface TokenStore {
  create(data: { userId: string; type: TokenType; email: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  findByHash(tokenHash: string): Promise<TokenRecord | null>;
  /** Marks the token used; returns false if it was already used (single use, race-safe). */
  markUsed(id: string, at: Date): Promise<boolean>;
}

export type ConsumeResult = { ok: true; token: TokenRecord } | { ok: false; code: "INVALID" | "EXPIRED" };

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

/** Single-use email link tokens. Only the SHA-256 hash is stored; the raw token goes in the link. */
export function createTokenService(store: TokenStore, now: () => Date = () => new Date()) {
  async function issue(userId: string, type: TokenType, email: string): Promise<string> {
    const raw = randomBytes(32).toString("base64url");
    await store.create({ userId, type, email, tokenHash: sha256(raw), expiresAt: new Date(now().getTime() + TOKEN_TTL_MS[type]) });
    return raw;
  }

  async function consume(raw: string, type: TokenType): Promise<ConsumeResult> {
    const token = raw ? await store.findByHash(sha256(raw)) : null;
    if (!token || token.type !== type || token.usedAt) return { ok: false, code: "INVALID" };
    if (token.expiresAt.getTime() <= now().getTime()) return { ok: false, code: "EXPIRED" };
    if (!(await store.markUsed(token.id, now()))) return { ok: false, code: "INVALID" };
    return { ok: true, token };
  }

  return { issue, consume };
}
