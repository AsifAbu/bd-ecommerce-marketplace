import type { z } from "zod";
import { ValidationError } from "@/lib/errors";
import { fieldErrors } from "./schemas";

export function parseForm<S extends z.ZodType>(schema: S, formData: FormData): z.infer<S> {
  const result = schema.safeParse(Object.fromEntries(formData));
  if (!result.success) throw new ValidationError(fieldErrors(result.error));
  return result.data;
}
