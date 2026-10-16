import type { LoginFailureStore } from "./login-throttle";

/** Test helper: an in-memory failure store and a clock the test moves by hand. */
export function fakeThrottleDeps(start = Date.parse("2026-10-16T06:00:00Z")) {
  const rows: { identifier: string; ip: string | null; at: Date }[] = [];
  const clock = { t: start };
  const store: LoginFailureStore = {
    failuresSince: async (identifier, since) => rows.filter((r) => r.identifier === identifier && r.at >= since).map((r) => r.at),
    countIpFailuresSince: async (ip, since) => rows.filter((r) => r.ip === ip && r.at >= since).length,
    record: async (identifier, ip, at) => void rows.push({ identifier, ip, at }),
    clear: async (identifier, before) => {
      const keep = rows.filter((r) => r.identifier !== identifier || (before !== undefined && r.at >= before));
      rows.splice(0, rows.length, ...keep);
    },
  };
  const now = () => new Date(clock.t);
  const advance = (ms: number) => void (clock.t += ms);
  return { rows, store, now, advance };
}
