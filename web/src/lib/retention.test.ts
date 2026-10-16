import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { isRetained, RETENTION_RULES, RETENTION_YEARS, retainedModelAccessors, retainUntil } from "./retention";

const WEB = join(__dirname, "..", "..");

function files(dir: string, ext: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === "generated" || name === "node_modules") return [];
    if (statSync(path).isDirectory()) return files(path, ext);
    return ext.test(name) ? [path] : [];
  });
}

describe("retention config (US-081)", () => {
  it("keeps orders, shops, complaints and audit logs for 6 years", () => {
    expect(RETENTION_YEARS).toBe(6);
    for (const model of ["Order", "Shop", "ComplaintTicket", "AuditLog", "PolicyAcceptance"]) {
      expect(RETENTION_RULES.find((r) => r.model === model)?.years).toBe(6);
    }
  });

  it("counts calendar years from the start date", () => {
    expect(retainUntil(new Date("2026-10-16T10:00:00Z")).toISOString()).toBe("2032-10-16T10:00:00.000Z");
  });

  it("treats a record as retained until the end of the period", () => {
    const from = new Date("2026-01-01T00:00:00Z");
    expect(isRetained(from, new Date("2031-12-31T23:59:59Z"))).toBe(true);
    expect(isRetained(from, new Date("2032-01-01T00:00:00Z"))).toBe(false);
  });

  it("marks built models consistently with the Prisma schema", () => {
    const schema = files(join(WEB, "prisma", "schema"), /\.prisma$/)
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");
    for (const rule of RETENTION_RULES) {
      expect(new RegExp(`^model ${rule.model} \\{`, "m").test(schema), `${rule.model} built=${rule.built}`).toBe(rule.built);
    }
  });
});

describe("retained records are never hard-deleted", () => {
  const accessors = retainedModelAccessors();
  const call = new RegExp(`\\.(${accessors.join("|")})\\s*\\.\\s*(delete|deleteMany)\\s*\\(`);
  const tables = ["order", "shop_order", "order_item", "shop", "shop_licence", "complaint_ticket", "audit_log", "policy_document", "policy_acceptance"];
  const rawSql = new RegExp(`DELETE\\s+FROM\\s+"?(${tables.join("|")})"?\\b`, "i");

  it("has no Prisma delete or raw DELETE on a retained model in src/ or the seed", () => {
    const sources = [...files(join(WEB, "src"), /\.(ts|tsx)$/), join(WEB, "prisma", "seed.ts")].filter(
      (f) => !f.endsWith(".test.ts"),
    );
    const offenders = sources.filter((f) => {
      const text = readFileSync(f, "utf8");
      return call.test(text) || rawSql.test(text);
    });
    expect(offenders.map((f) => relative(WEB, f))).toEqual([]);
  });

  it("never cascades a delete into a retained model from a model that is not retained", () => {
    const retained = new Set(RETENTION_RULES.map((r) => r.model));
    const schema = files(join(WEB, "prisma", "schema"), /\.prisma$/)
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");
    const offenders: string[] = [];
    for (const [, model, body] of schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
      if (!retained.has(model)) continue;
      for (const line of body.split("\n")) {
        const m = line.match(/^\s*(\w+)\s+(\w+)\??\s+@relation\(.*onDelete:\s*Cascade/);
        if (m && !retained.has(m[2])) offenders.push(`${model}.${m[1]} -> ${m[2]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
