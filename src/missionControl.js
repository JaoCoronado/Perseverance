import { utcToSol } from './telemetry/marsTime.js';

const TOGGLE_KEY = 'KeyT';

function formatValue(object, value) {
  if (object.unit === 'min') {
    const minutes = Math.floor(value);
    const seconds = Math.round((value - minutes) * 60);
    return `${minutes} min ${String(seconds).padStart(2, '0')} s`;
  }
  const separator = object.unit === '°' ? '' : ' ';
  return `${value.toFixed(object.decimals ?? 1)}${separator}${object.unit}`;
}

function cssVar(element, name) {
  return getComputedStyle(element).getPropertyValue(name).trim();
}

// Whole-mission line chart: x is the sol, y the value, with the latest point highlighted.
function drawChart(canvas, points, maxSol) {
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);
  ctx.clearRect(0, 0, width, height);
  if (points.length < 2) return;

  const line = cssVar(canvas, '--mc-line');
  const grid = cssVar(canvas, '--mc-grid');
  const pad = { top: 6, right: 6, bottom: 14, left: 6 };
  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    min = Math.min(min, p.value);
    max = Math.max(max, p.value);
  }
  const span = max - min || 1;
  const x = (sol) => pad.left + (sol / maxSol) * (width - pad.left - pad.right);
  const y = (value) => pad.top + (1 - (value - min) / span) * (height - pad.top - pad.bottom);

  ctx.strokeStyle = grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.left, height - pad.bottom + 0.5);
  ctx.lineTo(width - pad.right, height - pad.bottom + 0.5);
  ctx.stroke();

  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(x(p.sol), y(p.value)) : ctx.moveTo(x(p.sol), y(p.value))));
  ctx.lineTo(x(points.at(-1).sol), height - pad.bottom);
  ctx.lineTo(x(points[0].sol), height - pad.bottom);
  ctx.closePath();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = line;
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(x(p.sol), y(p.value)) : ctx.moveTo(x(p.sol), y(p.value))));
  ctx.strokeStyle = line;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const last = points.at(-1);
  ctx.fillStyle = line;
  ctx.beginPath();
  ctx.arc(x(last.sol), y(last.value), 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = grid;
  ctx.font = '10px ui-monospace, Consolas, monospace';
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'left';
  ctx.fillText('Sol 0', pad.left, height);
  ctx.textAlign = 'right';
  ctx.fillText(`Sol ${Math.floor(maxSol)}`, width - pad.right, height);
}

function createCard(object, providerName, live) {
  const card = document.createElement('article');
  card.className = 'mc-card';
  card.dataset.key = object.key;
  card.innerHTML = `
    <header class="mc-card-head">
      <span class="mc-name"></span>
      <span class="mc-provider${live ? ' is-live' : ''}"></span>
    </header>
    <div class="mc-value" aria-live="polite">Loading…</div>
    <canvas class="mc-chart" aria-hidden="true"></canvas>
    <p class="mc-meaning"></p>
  `;
  card.querySelector('.mc-name').textContent = object.name;
  card.querySelector('.mc-provider').textContent = providerName;
  return card;
}

export function createMissionControl(telemetry) {
  const panel = document.createElement('aside');
  panel.className = 'mission-control';
  panel.innerHTML = `
    <div class="mc-head">
      <div class="mc-title">MISSION CONTROL</div>
      <div class="mc-sub"><span data-sol>Sol —</span> · Jezero Crater · <kbd>T</kbd> hide</div>
    </div>
  `;
  document.body.appendChild(panel);

  const status = { ready: false, values: {}, errors: [] };
  window.__missionControl = status;

  const objects = telemetry.getObjects();
  const nowSol = utcToSol(Date.now());
  panel.querySelector('[data-sol]').textContent = `Sol ${Math.floor(nowSol)}`;

  const loads = objects.map(async (object) => {
    const history = telemetry.findProvider(object.key, 'supportsRequest');
    const live = telemetry.findProvider(object.key, 'supportsSubscribe');
    const card = createCard(object, (live ?? history)?.name ?? 'No provider', Boolean(live));
    panel.appendChild(card);
    const valueEl = card.querySelector('.mc-value');
    const canvas = card.querySelector('.mc-chart');

    try {
      const points = await telemetry.request(object.key);
      if (!points.length) throw new Error('no data');
      const latest = points.at(-1).value;
      valueEl.textContent = formatValue(object, latest);
      card.querySelector('.mc-meaning').textContent = object.meaning(points);
      drawChart(canvas, points, nowSol);
      status.values[object.key] = latest;

      telemetry.subscribe(object.key, (datum) => {
        valueEl.textContent = formatValue(object, datum.value);
        status.values[object.key] = datum.value;
      });
      window.addEventListener('resize', () => drawChart(canvas, points, nowSol));
    } catch (error) {
      valueEl.textContent = 'No signal';
      card.classList.add('is-error');
      status.errors.push(`${object.key}: ${error.message}`);
      console.error(`[mission control] ${object.name} failed to load:`, error);
    }
  });

  Promise.allSettled(loads).then(() => {
    status.ready = true;
    console.log('[mission control] loaded:', JSON.stringify(status.values));
  });

  window.addEventListener('keydown', (event) => {
    if (event.code !== TOGGLE_KEY || event.repeat) return;
    panel.hidden = !panel.hidden;
  });

  return { element: panel };
}
