import { solToUtc } from './marsTime.js';

// Every localized stop of Perseverance, published by NASA's MMGIS map (proxied by Vite).
const DRIVE_LOG_URL = '/nasa/mmgis-maps/M20/Layers/json/M20_waypoints.json';
const MISSING = -9999;

const FIELDS = {
  // Site-increment stops report 0; an odometer never goes down, so keep the running max.
  'percy.odometer': { field: 'dist_total_m', scale: 0.001, monotonic: true },
  'percy.elevation': { field: 'elev_geoid', scale: 1 },
  'percy.tilt': { field: 'tilt', scale: 1 },
};

let stops = null;

function loadStops() {
  stops ??= fetch(DRIVE_LOG_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`NASA drive log answered HTTP ${response.status}`);
      return response.json();
    })
    .then((json) =>
      json.features
        .map((feature) => feature.properties)
        .filter((stop) => Number.isFinite(stop.sol))
        .sort((a, b) => a.sol - b.sol || a.dist_total_m - b.dist_total_m)
    )
    .catch((error) => {
      stops = null; // allow a retry on the next request
      throw error;
    });
  return stops;
}

export const nasaDriveLogProvider = {
  name: 'NASA drive log',
  supportsRequest: (object) => object.key in FIELDS,
  async request(object) {
    const { field, scale, monotonic } = FIELDS[object.key];
    const all = await loadStops();
    let runningMax = -Infinity;
    return all
      .filter((stop) => Number.isFinite(stop[field]) && stop[field] !== MISSING)
      .map((stop) => {
        let value = stop[field] * scale;
        if (monotonic) value = runningMax = Math.max(runningMax, value);
        return { sol: stop.sol, utc: solToUtc(stop.sol), value };
      });
  },
};
