/**
 * Server-side public entry of the accounts feature for other features (checkout uses it):
 *   otpService.requestOtp(phone, purpose, ip) / verifyOtp(phone, purpose, code)
 *   addressRepo.list / get / create (scoped by userId)
 *   clientIp() for rate limits
 */
export { addressRepo, clientIp, otpService } from "./services";
