import { AppError } from "@/lib/errors";

/** A catalog rule was broken (e.g. non-leaf category). Maps to the standard error JSON. */
export class CatalogError extends AppError {
  constructor(status: 404 | 409 | 422, code: string, message: string, fields?: Record<string, string>) {
    super(status, code, message, fields);
    this.name = "CatalogError";
  }
}
