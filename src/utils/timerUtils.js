export const AUCTION_DURATION_MS = 10_000;
export const STOP_DURATION_MS = 30_000;

export const getRemainingMilliseconds = (endsAt, now = Date.now()) =>
  Math.max(0, (endsAt || 0) - now);

export const getRemainingSeconds = (endsAt, now = Date.now()) =>
  Math.ceil(getRemainingMilliseconds(endsAt, now) / 1000);
