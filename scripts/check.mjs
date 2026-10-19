// Opens the app in headless Chrome (the locally installed one, nothing is downloaded),
// drives the rover a bit, saves a screenshot and reports console errors.
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';

const SCREENSHOT = 'screenshots/check.png';
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
  await page.keyboard.down('KeyW');
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(800);
  await page.keyboard.up('KeyA');
  await page.waitForFunction((d) => window.__roverState.distance > d, DRIVE_DISTANCE, { timeout: 90_000 });
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(2500);

  await mkdir('screenshots', { recursive: true });
  await page.screenshot({ path: SCREENSHOT });
  console.log(`Screenshot: ${SCREENSHOT}`);
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
