import * as THREE from 'three';
import { createRandom } from './random.js';

const COUNT = 4000;
const BOX = new THREE.Vector3(200, 30, 200);
const WIND = new THREE.Vector3(2.2, 0.15, 0.8);

function createDotTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(canvas);
}

export function createDust() {
  const random = createRandom(7);
  const positions = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    positions[i * 3] = (random() - 0.5) * BOX.x;
    positions[i * 3 + 1] = random() * BOX.y;
    positions[i * 3 + 2] = (random() - 0.5) * BOX.z;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0xe0a878,
    size: 0.35,
    map: createDotTexture(),
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;

  return {
    object: points,
    update(dt, camera) {
      // Drift with the wind and wrap particles around the camera.
      const attr = geometry.attributes.position;
      for (let i = 0; i < COUNT; i++) {
        let x = attr.array[i * 3] + WIND.x * dt;
        let y = attr.array[i * 3 + 1] + WIND.y * dt * Math.sin(i);
        let z = attr.array[i * 3 + 2] + WIND.z * dt;
        x = camera.position.x + THREE.MathUtils.euclideanModulo(x - camera.position.x + BOX.x / 2, BOX.x) - BOX.x / 2;
        z = camera.position.z + THREE.MathUtils.euclideanModulo(z - camera.position.z + BOX.z / 2, BOX.z) - BOX.z / 2;
        y = THREE.MathUtils.euclideanModulo(y, BOX.y);
        attr.array[i * 3] = x;
        attr.array[i * 3 + 1] = y;
        attr.array[i * 3 + 2] = z;
      }
      attr.needsUpdate = true;
    },
  };
}
