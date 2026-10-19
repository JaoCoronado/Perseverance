// Perseverance touched down on sol 0, 2021-02-18 around 20:55 UTC.
export const LANDING_UTC = Date.UTC(2021, 1, 18, 20, 55);
export const SOL_MS = 88_775_244; // one Martian day: 24 h 39 min 35 s

export function solToUtc(sol) {
  return LANDING_UTC + sol * SOL_MS;
}

export function utcToSol(utc) {
  return (utc - LANDING_UTC) / SOL_MS;
}
