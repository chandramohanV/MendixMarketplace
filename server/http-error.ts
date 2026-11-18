// The error type every server module throws for an expected failure; app.ts turns it into a JSON response.
import type { FieldError } from '../shared/studio';

/** A rule violation that maps directly to an HTTP error response. */
export class HttpError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 422 | 500,
    public code: string,
    message: string,
    public details?: FieldError[],
  ) {
    super(message);
  }
}
