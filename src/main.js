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

const START_YAW = Math.PI; // facing the sun and the moons

const { renderer, scene, camera, controls } = createStage({ fogColor: HORIZON_COLOR });

const sky = createSky();
const dust = createDust();
const lights = createLights();
const tracks = createTracks(heightAt);
scene.add(sky.object, createTerrain(), createRocks(), lights.object, dust.object, tracks.object);

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
  .then(({ object, cameraParts }) => {
    scene.add(object);
    const driver = createDriver(object, heightAt, { yaw: START_YAW });
    const follow = createFollowCamera(camera, controls, object, heightAt);
    rover = { object, driver, follow };
    console.log('[rover] camera parts:', cameraParts.join(', '));
    window.__roverCameras = cameraParts;
    window.__roverState = driver.state;
    window.__roverReady = true;
  })
  .catch((error) => console.error('[rover] failed to load model:', error));

const timer = new THREE.Timer();
timer.connect(document);
let frames = 0;

renderer.setAnimationLoop((time) => {
  timer.update(time);
  const dt = Math.min(timer.getDelta(), 0.1);
  if (rover) {
    rover.driver.update(dt);
    rover.follow.update(dt, rover.driver.state);
    tracks.update(rover.object.position, rover.driver.state.yaw);
    lights.update(rover.object.position);
  }
  controls.update();
  sky.update(camera);
  dust.update(dt, camera);
  renderer.render(scene, camera);
  // Lets the automated check know the scene has actually rendered.
  if (++frames === 10) window.__marsReady = true;
});
