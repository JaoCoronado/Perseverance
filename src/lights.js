import * as THREE from 'three';

// Low afternoon sun, slightly to the left of the default view.
export const SUN_DIRECTION = new THREE.Vector3(-0.55, 0.22, -0.8).normalize();
const SUN_DISTANCE = 150;

export function createLights() {
  const group = new THREE.Group();

  const sun = new THREE.DirectionalLight(0xffb878, 3.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 4;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.05;
  const shadowCam = sun.shadow.camera;
  shadowCam.left = -50;
  shadowCam.right = 50;
  shadowCam.top = 50;
  shadowCam.bottom = -50;
  shadowCam.near = 1;
  shadowCam.far = 400;
  group.add(sun, sun.target);

  group.add(new THREE.HemisphereLight(0xe2a06c, 0x4a2010, 0.9));

  return {
    object: group,
    // Keep the shadow area centered on whatever we are looking at.
    update(focus) {
      sun.target.position.copy(focus);
      sun.position.copy(focus).addScaledVector(SUN_DIRECTION, SUN_DISTANCE);
    },
  };
}
