import * as THREE from 'three';

const MAX_PARTICLES = 700;
const LIFETIME = 1.6;
const WIND = new THREE.Vector3(1.2, 0, 0.5);

const vertexShader = /* glsl */ `
  attribute float aAlpha;
  attribute float aSize;
  uniform float uScale;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = min(aSize * uScale / -mvPosition.z, 96.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.0, d) * vAlpha;
    gl_FragColor = vec4(uColor, alpha);
    #include <colorspace_fragment>
  }
`;

// Soft puffs of regolith kicked up behind the wheels.
export function createWheelDust() {
  const positions = new Float32Array(MAX_PARTICLES * 3);
  const alphas = new Float32Array(MAX_PARTICLES);
  const sizes = new Float32Array(MAX_PARTICLES);
  const velocities = new Float32Array(MAX_PARTICLES * 3);
  const ages = new Float32Array(MAX_PARTICLES).fill(LIFETIME);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uColor: { value: new THREE.Color(0xc88457) },
      uScale: { value: 400 },
    },
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;

  let next = 0;
  let budget = 0;

  function spawn(origin) {
    const i = next;
    next = (next + 1) % MAX_PARTICLES;
    positions.set([origin.x + (Math.random() - 0.5) * 0.3, origin.y + 0.05, origin.z + (Math.random() - 0.5) * 0.3], i * 3);
    velocities.set([(Math.random() - 0.5) * 0.6, 0.3 + Math.random() * 0.6, (Math.random() - 0.5) * 0.6], i * 3);
    ages[i] = 0;
  }

  return {
    object: points,
    // strength: 0..1, how hard the wheels are churning the ground.
    emit(dt, contacts, strength) {
      budget += dt * strength * 60;
      while (budget >= 1) {
        budget -= 1;
        spawn(contacts[Math.floor(Math.random() * contacts.length)]);
      }
    },
    update(dt, renderer) {
      material.uniforms.uScale.value = renderer.domElement.height * 0.5;
      for (let i = 0; i < MAX_PARTICLES; i++) {
        if (ages[i] >= LIFETIME) {
          // Dead particles must have no size, or they are still rasterized (expensive overdraw).
          alphas[i] = 0;
          sizes[i] = 0;
          continue;
        }
        ages[i] += dt;
        const t = ages[i] / LIFETIME;
        velocities[i * 3 + 1] -= 0.25 * dt; // weak Martian gravity pulls the dust back down slowly
        positions[i * 3] += (velocities[i * 3] + WIND.x * t) * dt;
        positions[i * 3 + 1] += velocities[i * 3 + 1] * dt;
        positions[i * 3 + 2] += (velocities[i * 3 + 2] + WIND.z * t) * dt;
        alphas[i] = 0.4 * Math.min(t * 6, 1) * (1 - t);
        sizes[i] = 0.4 + t * 1.6;
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.aAlpha.needsUpdate = true;
      geometry.attributes.aSize.needsUpdate = true;
    },
  };
}
