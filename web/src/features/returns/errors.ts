import { AppError } from "@/lib/errors";

/** A return rule was broken. Standard `{ error: { code, message, fields? } }` shape. */
export class ReturnError extends AppError {
  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(status, code, message, fields);
    this.name = "ReturnError";
  }
}
