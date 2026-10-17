import type { LoginIdentifier } from "./identifier";

/**
 * Login lockout. Testing values; final values are decided before release.
 * - 5 failed logins for one identifier within 15 minutes lock it for 15 minutes.
 * - One IP may fail 50 times per 15 minutes (generous: mobile carriers put many users behind one IP).
 * A successful login clears the identifier's failures. Locked attempts are not recorded, so a lock
 * ends 15 minutes after the failure that caused it, even if someone keeps trying.
 */
export const LOGIN_RULES = {
  maxFailures: 5,
  windowMs: 15 * 60_000,
  lockMs: 15 * 60_000,
  maxFailuresPerIp: 50,
} as const;

export type LoginRules = { [K in keyof typeof LOGIN_RULES]: number };

export interface LoginFailureStore {
  /** Times of this identifier's failures at or after `since`, any order. */
  failuresSince(identifier: string, since: Date): Promise<Date[]>;
  countIpFailuresSince(ip: string, since: Date): Promise<number>;
  record(identifier: string, ip: string | null, at: Date): Promise<void>;
  /** Deletes the identifier's failures; with `before`, only those older than it. */
  clear(identifier: string, before?: Date): Promise<void>;
}

export type LoginCheck =
  | { allowed: true }
  | { allowed: false; reason: "IDENTIFIER_LOCKED" | "IP_LIMITED"; retryAfterSec: number };

export interface LoginThrottle {
  check(identifier: string, ip: string | null): Promise<LoginCheck>;
  recordFailure(identifier: string, ip: string | null): Promise<void>;
  recordSuccess(identifier: string): Promise<void>;
}

/** The key failures are counted under: the normalised email or phone, so "A@x.com" and "a@x.com" count together. */
export const loginKey = (id: LoginIdentifier) => `${id.kind}:${id.value}`;

/** End of the latest lock in these failure times (ms), or 0: any `maxFailures` failures within `windowMs`. */
export function lockedUntil(times: Date[], rules: LoginRules = LOGIN_RULES): number {
  const t = times.map((d) => d.getTime()).sort((a, b) => a - b);
  let until = 0;
  for (let i = rules.maxFailures - 1; i < t.length; i++) {
    if (t[i] - t[i - rules.maxFailures + 1] <= rules.windowMs) until = Math.max(until, t[i] + rules.lockMs);
  }
  return until;
}

export function createLoginThrottle({
  store,
  now = () => new Date(),
  rules = LOGIN_RULES,
}: {
  store: LoginFailureStore;
  now?: () => Date;
  rules?: LoginRules;
}): LoginThrottle {
  /** Older failures can't start or extend a lock that is still running. */
  const horizon = (t: number) => new Date(t - rules.windowMs - rules.lockMs);

  async function check(identifier: string, ip: string | null): Promise<LoginCheck> {
    const t = now().getTime();
    const until = lockedUntil(await store.failuresSince(identifier, horizon(t)), rules);
    if (until > t) return { allowed: false, reason: "IDENTIFIER_LOCKED", retryAfterSec: Math.ceil((until - t) / 1000) };
    if (ip !== null && (await store.countIpFailuresSince(ip, new Date(t - rules.windowMs))) >= rules.maxFailuresPerIp) {
      return { allowed: false, reason: "IP_LIMITED", retryAfterSec: Math.ceil(rules.windowMs / 1000) };
    }
    return { allowed: true };
  }

  async function recordFailure(identifier: string, ip: string | null) {
    const at = now();
    await store.record(identifier, ip, at);
    await store.clear(identifier, horizon(at.getTime())); // keep the table small
  }

  async function recordSuccess(identifier: string) {
    await store.clear(identifier);
  }

  return { check, recordFailure, recordSuccess };
}
