import * as THREE from 'three';
import { createStage } from './scene.js';
import { createTerrain, heightAt } from './terrain.js';
import { createRocks } from './rocks.js';
import { createLights } from './lights.js';
import { createSky, HORIZON_COLOR } from './sky.js';
import { createDust } from './dust.js';

const { renderer, scene, camera, controls } = createStage({ fogColor: HORIZON_COLOR });

const sky = createSky();
const dust = createDust();
scene.add(sky.object, createTerrain(), createRocks(), createLights(), dust.object);

camera.position.set(0, heightAt(0, 35) + 6, 35);
controls.target.set(0, heightAt(0, -20) + 4, -20);

const clock = new THREE.Clock();
let frames = 0;

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  controls.update();
  sky.update(camera);
  dust.update(dt, camera);
  renderer.render(scene, camera);
  // Lets the automated check know the scene has actually rendered.
  if (++frames === 10) window.__marsReady = true;
});
