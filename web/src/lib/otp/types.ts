/**
 * Sends and checks one-time codes for a phone number (E.164, +8801XXXXXXXXX).
 * Code storage, expiry and rate limits belong to the caller (auth feature);
 * the provider only delivers and, for the dummy provider, accepts the fixed code.
 */
export interface OtpProvider {
  readonly name: string;
  /** `code` is the code the caller generated and stored (hashed); the test provider ignores it. */
  send(phone: string, code?: string): Promise<void>;
  verify(phone: string, code: string): Promise<boolean>;
}
