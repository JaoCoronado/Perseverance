// Opens the app in headless Chrome (the locally installed one, nothing is downloaded),
// drives the rover a bit, saves a screenshot and reports console errors.
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';

const SCREENSHOT = 'screenshots/check.png';
const TURN_SCREENSHOT = 'screenshots/turn.png';
const DRIVE_DISTANCE = 14; // meters, enough to leave visible tracks

const server = await createServer({ logLevel: 'error', server: { port: 5199, open: false } });
await server.listen();
const url = server.resolvedUrls.local[0];

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

const errors = [];
const logs = [];
let exitCode = 0;

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (msg) => {
    const line = `[${msg.type()}] ${msg.text()}`;
    if (msg.type() === 'error') errors.push(line);
    else logs.push(line);
  });
  page.on('pageerror', (error) => errors.push(`[pageerror] ${error.message}`));
  page.on('requestfailed', (request) => errors.push(`[request] ${request.url()} ${request.failure()?.errorText}`));

  await page.goto(url);
  await page.waitForFunction(() => window.__marsReady && window.__roverReady, null, { timeout: 90_000 });

  // Drive forward with a gentle left turn, then let the camera settle.
  // Real key presses go through the game's input; __advance steps the simulation
  // in fixed time so the result does not depend on headless frame rate.
  const advance = (seconds) => page.evaluate((s) => window.__advance(s), seconds);
  await page.keyboard.down('KeyW');
  await page.keyboard.down('KeyA');
  await advance(0.8);
  await page.keyboard.up('KeyA');
  await advance(5);
  await page.keyboard.up('KeyW');
  await advance(1.5);
  const distance = await page.evaluate(() => window.__roverState.distance);
  if (distance < DRIVE_DISTANCE) errors.push(`[check] rover only drove ${distance.toFixed(1)} m`);
  await page.waitForTimeout(1000);

  await mkdir('screenshots', { recursive: true });
  await page.screenshot({ path: SCREENSHOT });
  console.log(`Screenshot: ${SCREENSHOT}`);

  // Turn in place so the corner wheels angle and both sides spin in opposite directions.
  await page.keyboard.down('KeyA');
  await advance(1.2);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: TURN_SCREENSHOT });
  await page.keyboard.up('KeyA');
  console.log(`Screenshot: ${TURN_SCREENSHOT}`);
} catch (error) {
  errors.push(`[check] ${error.message}`);
} finally {
  await browser.close();
  await server.close();
}

console.log('\nConsole output:');
console.log(logs.length ? logs.join('\n') : '  (none)');
console.log(`\nErrors (${errors.length}):`);
console.log(errors.length ? errors.join('\n') : '  (none)');
if (errors.length) exitCode = 1;
process.exit(exitCode);
