/**
 * Public entry of the accounts feature for other features (pure code, client-safe):
 * Bangladesh mobile / email / address validation and the OTP messages. Database-wired services
 * (OTP, address book) are in `./server`; the address inputs for forms in `./ui/address-fields`.
 */
export { addressSchema, bdMobile, email, type AddressInput } from "./schemas";
export { OTP_MESSAGES, type OtpPurpose, type RequestOtpResult, type VerifyOtpResult } from "./otp-service";
