const REFRESH_INTERVAL = 0.1; // seconds

export function createHud() {
  const panel = document.createElement('div');
  panel.className = 'hud';
  panel.innerHTML = `
    <div class="hud-title">PERSEVERANCE · JEZERO</div>
    <div class="hud-row"><span>Speed</span><b data-speed>0.0 m/s</b></div>
    <div class="hud-row"><span>Heading</span><b data-heading>0°</b></div>
    <div class="hud-row"><span>Odometer</span><b data-odometer>0.0 m</b></div>
    <div class="hud-hint">W/S drive · A/D steer · drag to orbit</div>
  `;
  document.body.appendChild(panel);

  const speed = panel.querySelector('[data-speed]');
  const heading = panel.querySelector('[data-heading]');
  const odometer = panel.querySelector('[data-odometer]');
  let elapsed = REFRESH_INTERVAL;

  return {
    update(dt, state) {
      elapsed += dt;
      if (elapsed < REFRESH_INTERVAL) return;
      elapsed = 0;
      const degrees = ((((-state.yaw * 180) / Math.PI + 180) % 360) + 360) % 360;
      speed.textContent = `${Math.abs(state.speed).toFixed(1)} m/s`;
      heading.textContent = `${degrees.toFixed(0)}°`;
      odometer.textContent = `${state.distance.toFixed(1)} m`;
    },
  };
}
