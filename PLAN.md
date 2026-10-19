# Mars Landscape (Vite + Three.js)

## Context
The folder is empty (only CLAUDE.md, .atl/). The user wants a cinematic Mars landscape running live in their browser fast (<2 min after approval), then iterative polish verified by an automated `npm run check` (headless Chrome via Playwright using the installed Chrome, no browser download), screenshot + console errors, max 3 rounds.

## Step 1 — Fast scaffold (target <2 min)
- Write `package.json` by hand (no interactive `create vite`): deps `three`, devDeps `vite`, `playwright-core` (does NOT download browsers).
- Scripts: `dev: vite --host --open`, `check: node scripts/check.mjs`.
- `index.html` + `src/main.js` with a minimal visible scene: displaced plane terrain, caramel background + fog, warm directional light. Start `npm run dev` in background immediately.

## Step 2 — Cinematic scene (modules, one concern each)
- `src/scene.js` — renderer (ACESFilmic tone mapping, sRGB, PCFSoft shadows), camera, OrbitControls, resize.
- `src/terrain.js` — large plane, vertex displacement with simple value noise: dunes (directional sine ridges + noise), vertex colors in rust/ochre tones, receives shadows.
- `src/rocks.js` — ~150 instanced `DodecahedronGeometry` with jittered vertices, scattered and sunk into terrain height, cast shadows.
- `src/sky.js` — gradient sky dome shader (caramel horizon → dusty brown zenith, glow around sun direction), low sun disk, Phobos and Deimos as small lit spheres high in the sky, exponential fog matching horizon color.
- `src/dust.js` — drifting `Points` particles for airborne dust.
- `src/lights.js` — warm low-angle directional sun (soft shadows, tight shadow camera), hemisphere fill light.

## Step 3 — `npm run check`
`scripts/check.mjs`:
- Starts Vite programmatically on a free port (`createServer` from vite).
- `chromium.launch({ channel: 'chrome', headless: true })` from `playwright-core` — uses the installed Chrome. Pass `--use-angle=swiftshader`/`--enable-unsafe-swiftshader` so WebGL works headless.
- Collect `console` errors + `pageerror`, wait ~3 s, save `screenshots/check.png`, print errors, exit 1 if any.

## Step 4 — Review loop (max 3 rounds)
After each big improvement: `npm run check` → read `screenshots/check.png` → fix what's missing (dunes, rocks, caramel dusty sky, warm sun, soft shadows, two moons) and errors.

## Verification / Done
- `npm run check` exits 0 with zero console errors.
- Screenshot visibly shows all requested elements.
- Dev server stays running for the user's live view. Commit with conventional commits (no AI attribution, per user rule).
