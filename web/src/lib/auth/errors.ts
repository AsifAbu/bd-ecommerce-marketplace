import { AppError } from "@/lib/errors";

/** Thrown by guards. Route handlers map these to 401 / 403 with the standard error shape. */
export class UnauthorizedError extends AppError {
  constructor(message = "Login required") {
    super(401, "UNAUTHORIZED", message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Not allowed") {
    super(403, "FORBIDDEN", message);
    this.name = "ForbiddenError";
  }
}
