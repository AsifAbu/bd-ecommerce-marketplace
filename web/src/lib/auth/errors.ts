/** Thrown by guards. Route handlers map these to 401 / 403 with the standard error shape. */
export class UnauthorizedError extends Error {
  readonly status = 401;
  readonly code = "UNAUTHORIZED";
  constructor(message = "Login required") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  readonly status = 403;
  readonly code = "FORBIDDEN";
  constructor(message = "Not allowed") {
    super(message);
    this.name = "ForbiddenError";
  }
}
