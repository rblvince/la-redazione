export const OTP_LENGTH = 8;
export const OTP_REGEX = new RegExp(`^[0-9]{${OTP_LENGTH}}$`);
export const SEND_LIMIT_MESSAGE = 'Aspetta un minuto prima di chiedere un altro codice.';

export function isSendLimit(error: unknown): boolean {
  return typeof error === 'object' && error !== null
    && (('code' in error && error.code === 'over_email_send_rate_limit')
      || ('status' in error && error.status === 429));
}
