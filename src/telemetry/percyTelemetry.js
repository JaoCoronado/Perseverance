import { createTelemetryApi } from './telemetryApi.js';
import { nasaDriveLogProvider } from './nasaDriveLogProvider.js';
import { lightTimeProvider } from './lightTimeProvider.js';

const first = (points) => points[0].value;
const last = (points) => points.at(-1).value;
const extreme = (points, pick) => points.reduce((m, p) => pick(m, p.value), points[0].value);

// The four telemetry points of the mission control, each with name, unit and a plain meaning.
const PERCY_TELEMETRY = [
  {
    key: 'percy.odometer',
    name: 'Distance driven',
    unit: 'km',
    decimals: 2,
    meaning: (points) =>
      `Everything Percy has driven since landing in February 2021: ${last(points).toFixed(1)} km, one careful drive at a time.`,
  },
  {
    key: 'percy.elevation',
    name: 'Terrain elevation',
    unit: 'm',
    decimals: 0,
    meaning: (points) =>
      `Height of the ground under Percy, compared with Mars' average surface. It has climbed ${Math.round(
        last(points) - first(points)
      )} m since landing in Jezero Crater.`,
  },
  {
    key: 'percy.tilt',
    name: 'Tilt',
    unit: '°',
    decimals: 1,
    meaning: (points) =>
      `How much Percy leans on the slope where it stopped. The steepest stop on record is ${extreme(points, Math.max).toFixed(1)}°.`,
  },
  {
    key: 'percy.lightTime',
    name: 'Earth–Mars light time',
    unit: 'min',
    meaning: (points) =>
      `How long a command from Earth takes to reach Percy right now, so nobody can drive it live. Over the mission it has ranged from ${extreme(
        points,
        Math.min
      ).toFixed(1)} to ${extreme(points, Math.max).toFixed(1)} minutes.`,
  },
];

export function createPercyTelemetry() {
  const telemetry = createTelemetryApi();
  PERCY_TELEMETRY.forEach((object) => telemetry.addObject(object));
  telemetry.addProvider(nasaDriveLogProvider);
  telemetry.addProvider(lightTimeProvider);
  return telemetry;
}
