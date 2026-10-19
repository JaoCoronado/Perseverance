import * as THREE from 'three';
import { SUN_DIRECTION } from './lights.js';

export const HORIZON_COLOR = 0xd4945e;
const ZENITH_COLOR = 0x7a4128;
const SKY_RADIUS = 450;

const vertexShader = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Caramel horizon fading to dusty brown, with a hazy glow and a soft sun disk.
const fragmentShader = /* glsl */ `
  uniform vec3 uHorizon;
  uniform vec3 uZenith;
  uniform vec3 uSunColor;
  uniform vec3 uSunDirection;
  varying vec3 vDirection;
  void main() {
    vec3 dir = normalize(vDirection);
    float elevation = max(dir.y, 0.0);
    vec3 color = mix(uHorizon, uZenith, pow(elevation, 0.55));

    float sunDot = max(dot(dir, uSunDirection), 0.0);
    color += uSunColor * pow(sunDot, 6.0) * 0.35;
    color += vec3(1.0, 0.92, 0.8) * pow(sunDot, 60.0) * 0.6;
    color += vec3(1.0, 0.95, 0.85) * smoothstep(0.9993, 0.9997, sunDot) * 4.0;

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function createMoon(radius, stretch, direction) {
  const geometry = new THREE.IcosahedronGeometry(radius, 3);
  geometry.scale(stretch, 1, 0.9);
  const material = new THREE.MeshStandardMaterial({
    color: 0x8a7a6c,
    roughness: 1,
    emissive: 0x2a1c14,
    fog: false,
  });
  const moon = new THREE.Mesh(geometry, material);
  moon.position.copy(direction).normalize().multiplyScalar(SKY_RADIUS * 0.85);
  moon.rotation.set(0.4, 1.2, 0.2);
  return moon;
}

export function createSky() {
  const group = new THREE.Group();

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(SKY_RADIUS, 48, 24),
    new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uHorizon: { value: new THREE.Color(HORIZON_COLOR) },
        uZenith: { value: new THREE.Color(ZENITH_COLOR) },
        uSunColor: { value: new THREE.Color(0xffc080) },
        uSunDirection: { value: SUN_DIRECTION },
      },
    })
  );
  dome.renderOrder = -1;
  group.add(dome);

  // Phobos (larger, lumpy) and Deimos (small), exaggerated for a cinematic shot.
  const phobos = createMoon(7, 1.35, new THREE.Vector3(0.38, 0.3, -0.87));
  const deimos = createMoon(3, 1.1, new THREE.Vector3(0.12, 0.42, -0.9));
  group.add(phobos, deimos);

  return {
    object: group,
    update(camera) {
      // Keep the sky centered on the camera so it never gets closer.
      group.position.copy(camera.position);
    },
  };
}
