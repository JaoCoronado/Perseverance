import { LANDING_UTC, utcToSol } from './marsTime.js';

const AU_KM = 149_597_870.7;
const LIGHT_KM_S = 299_792.458;
const LIVE_INTERVAL_MS = 1000;
const DEG = Math.PI / 180;

// Keplerian elements and their rates per century (J2000), from JPL's
// "Approximate Positions of the Planets" (valid 1800–2050): a, e, I, L, long. perihelion, long. node.
const ORBITS = {
  earth: [
    [1.00000261, 0.00000562],
    [0.01671123, -0.00004392],
    [-0.00001531, -0.01294668],
    [100.46457166, 35999.37244981],
    [102.93768193, 0.32327364],
    [0, 0],
  ],
  mars: [
    [1.52371034, 0.00001847],
    [0.0933941, 0.00007882],
    [1.84969142, -0.00813131],
    [-4.55343205, 19140.30268499],
    [-23.94362959, 0.44441088],
    [49.55953891, -0.29257343],
  ],
};

function heliocentric(planet, utc) {
  const T = (utc / 86_400_000 + 2440587.5 - 2451545.0) / 36525;
  const [a, e, I, L, peri, node] = ORBITS[planet].map(([value, rate]) => value + rate * T);
  const omega = (peri - node) * DEG;
  const Omega = node * DEG;
  const inc = I * DEG;
  const M = ((((L - peri) % 360) + 540) % 360 - 180) * DEG;

  // Solve Kepler's equation E - e·sin(E) = M.
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 6; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));

  const x = a * (Math.cos(E) - e);
  const y = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(omega), sw = Math.sin(omega);
  const cO = Math.cos(Omega), sO = Math.sin(Omega);
  const ci = Math.cos(inc), si = Math.sin(inc);
  return [
    (cw * cO - sw * sO * ci) * x + (-sw * cO - cw * sO * ci) * y,
    (cw * sO + sw * cO * ci) * x + (-sw * sO + cw * cO * ci) * y,
    sw * si * x + cw * si * y,
  ];
}

// One-way light time between Earth and Mars, in minutes.
export function lightTimeMinutes(utc) {
  const earth = heliocentric('earth', utc);
  const mars = heliocentric('mars', utc);
  const distanceAu = Math.hypot(mars[0] - earth[0], mars[1] - earth[1], mars[2] - earth[2]);
  return (distanceAu * AU_KM) / LIGHT_KM_S / 60;
}

function datum(utc) {
  return { utc, sol: utcToSol(utc), value: lightTimeMinutes(utc) };
}

export const lightTimeProvider = {
  name: 'Orbit math · live',
  supportsRequest: (object) => object.key === 'percy.lightTime',
  supportsSubscribe: (object) => object.key === 'percy.lightTime',
  // The whole mission, from landing until now.
  async request(_object, { points = 240 } = {}) {
    const end = Date.now();
    const step = (end - LANDING_UTC) / (points - 1);
    return Array.from({ length: points }, (_, i) => datum(LANDING_UTC + i * step));
  },
  subscribe(_object, callback) {
    const id = setInterval(() => callback(datum(Date.now())), LIVE_INTERVAL_MS);
    return () => clearInterval(id);
  },
};
