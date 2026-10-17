import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth/errors";
import { AppError, toErrorBody } from "@/lib/errors";
import { formString, parseForm, resultFields, resultValues, runAction, ValidationError } from ".";

describe("runAction", () => {
  it("wraps the success message", async () => {
    expect(await runAction(async () => "Saved")).toEqual({ ok: true, message: "Saved" });
  });

  it("turns known errors into the standard error shape (no fields key when there are none)", async () => {
    expect(await runAction(async () => Promise.reject(new UnauthorizedError()))).toStrictEqual({
      error: { code: "UNAUTHORIZED", message: "Login required" },
    });
    expect(await runAction(async () => Promise.reject(new ForbiddenError("Platform Admin only")))).toStrictEqual({
      error: { code: "FORBIDDEN", message: "Platform Admin only" },
    });
    expect(await runAction(async () => Promise.reject(new ValidationError({ name: "Required" })))).toStrictEqual({
      error: { code: "VALIDATION", message: "Check the highlighted fields", fields: { name: "Required" } },
    });
  });

  it("returns the submitted values with an error, never with a success", async () => {
    const values = { identifier: "01700000002" };
    expect(await runAction(async () => Promise.reject(new AppError(400, "FORM", "Nope")), { values })).toEqual({
      error: { code: "FORM", message: "Nope" },
      values,
    });
    expect(await runAction(async () => "Done", { values })).toEqual({ ok: true, message: "Done" });
  });

  it("rethrows anything else (bugs, Next redirects)", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;/x" });
    await expect(runAction(async () => Promise.reject(redirect))).rejects.toBe(redirect);
  });
});

describe("form helpers", () => {
  const schema = z.object({ name: z.string().min(1, "Required"), age: z.coerce.number().min(18, "Too young") });

  it("parseForm reads FormData or a plain object, and reports the first error per field", () => {
    const fd = new FormData();
    fd.append("name", "Rahim");
    fd.append("age", "30");
    expect(parseForm(schema, fd)).toEqual({ name: "Rahim", age: 30 });
    expect(() => parseForm(schema, { name: "", age: "3" })).toThrow(ValidationError);
    try {
      parseForm(schema, { name: "", age: "3" });
    } catch (err) {
      expect((err as ValidationError).fields).toEqual({ name: "Required", age: "Too young" });
    }
  });

  it("formString ignores files and missing keys", () => {
    const fd = new FormData();
    fd.append("a", "x");
    fd.append("f", new File(["1"], "f.txt"));
    expect([formString(fd, "a"), formString(fd, "f"), formString(fd, "missing")]).toEqual(["x", "", ""]);
  });

  it("resultFields / resultValues read an error result and are empty otherwise", () => {
    const err = { error: { code: "VALIDATION", message: "m", fields: { a: "bad" } }, values: { a: "1" } };
    expect([resultFields(err), resultValues(err)]).toEqual([{ a: "bad" }, { a: "1" }]);
    expect([resultFields(undefined), resultValues({ ok: true, message: "" })]).toEqual([{}, {}]);
  });

  it("toErrorBody keeps the HTTP status for route handlers and rethrows unknown errors", () => {
    expect(toErrorBody(new ForbiddenError())).toEqual({ status: 403, body: { error: { code: "FORBIDDEN", message: "Not allowed" } } });
    const bug = new TypeError("x");
    expect(() => toErrorBody(bug)).toThrow(bug);
  });
});
