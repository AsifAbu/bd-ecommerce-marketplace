/** An expected failure shown to the user (broken rule, bad input, missing permission). Maps to the standard error shape. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(fields: Record<string, string>, message = "Check the highlighted fields") {
    super(422, "VALIDATION", message, fields);
    this.name = "ValidationError";
  }
}
