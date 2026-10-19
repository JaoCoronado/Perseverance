import * as THREE from 'three';
import { createStage } from './scene.js';
import { createTerrain, heightAt } from './terrain.js';
import { createRocks } from './rocks.js';
import { createLights } from './lights.js';
import { createSky, HORIZON_COLOR } from './sky.js';
import { createDust } from './dust.js';
import { loadRover } from './rover.js';
import { createDriver } from './drive.js';
import { createTracks } from './tracks.js';
import { createFollowCamera } from './followCamera.js';
import { createWheels } from './wheels.js';
import { createWheelDust } from './wheelDust.js';
import { createHud } from './hud.js';

const START_YAW = Math.PI; // facing the sun and the moons

const { renderer, scene, camera, controls } = createStage({ fogColor: HORIZON_COLOR });

const sky = createSky();
const dust = createDust();
const lights = createLights();
const tracks = createTracks(heightAt);
const wheelDust = createWheelDust();
const hud = createHud();
scene.add(sky.object, createTerrain(), createRocks(), lights.object, dust.object, tracks.object, wheelDust.object);

// Light metallic parts with the dusty sky instead of leaving them black.
const envScene = new THREE.Scene();
envScene.add(createSky().object);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(envScene, 0.04).texture;
scene.environmentIntensity = 0.6;

camera.position.set(0, heightAt(0, 9) + 2.4, 9);
controls.target.set(0, heightAt(0, 0) + 1.3, 0);
lights.update(controls.target);

let rover = null;
loadRover()
  .then(({ object, model, cameraParts }) => {
    scene.add(object);
    // Wheels are split while the rover still sits at the origin.
    const wheels = createWheels(object, model);
    const driver = createDriver(object, heightAt, { yaw: START_YAW });
    const follow = createFollowCamera(camera, controls, object, heightAt);
    rover = { object, driver, follow, wheels, contacts: [] };
    console.log('[rover] camera parts:', cameraParts.join(', '));
    if (wheels) console.log(`[rover] wheels animated: ${wheels.wheels.length}`);
    else console.warn('[rover] wheels node not found, wheels will not animate');
    window.__roverCameras = cameraParts;
    window.__roverState = driver.state;
    window.__roverReady = true;
  })
  .catch((error) => console.error('[rover] failed to load model:', error));

const timer = new THREE.Timer();
timer.connect(document);
let frames = 0;
const FIXED_STEP = 1 / 30;

// Everything that moves, independent of rendering.
function simulate(dt) {
  if (rover) {
    rover.driver.update(dt);
    rover.follow.update(dt, rover.driver.state);
    tracks.update(rover.object.position, rover.driver.state.yaw);
    lights.update(rover.object.position);
    hud.update(dt, rover.driver.state);

    if (rover.wheels) {
      rover.wheels.update(dt, rover.driver.state, heightAt);
      const churn = rover.wheels.wheels.reduce((sum, w) => sum + Math.abs(w.rollSpeed), 0) / rover.wheels.wheels.length;
      wheelDust.emit(dt, rover.wheels.contactPoints(rover.contacts), Math.min(churn / 3, 1));
    }
  }
  wheelDust.update(dt, renderer);
  controls.update();
  sky.update(camera);
  dust.update(dt, camera);
}

// Test hook: advance the simulation in fixed steps without waiting for frames,
// so the automated check works even when headless rendering is very slow.
window.__advance = (seconds) => {
  for (let t = 0; t < seconds; t += FIXED_STEP) simulate(FIXED_STEP);
};

renderer.setAnimationLoop((time) => {
  timer.update(time);
  simulate(Math.min(timer.getDelta(), 0.1));
  renderer.render(scene, camera);
  // Lets the automated check know the scene has actually rendered.
  if (++frames === 10) window.__marsReady = true;
});
