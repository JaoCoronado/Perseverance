import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { createRandom, valueNoise } from './random.js';
import { heightAt } from './terrain.js';

const ROCK_COUNT = 260;
const VARIANTS = 4;
const SCATTER_RADIUS = 160;
const CLEAR_RADIUS = 6;

function createRockGeometry(seed) {
  let geometry = new THREE.IcosahedronGeometry(1, 2);
  geometry.deleteAttribute('normal');
  geometry.deleteAttribute('uv');
  geometry = mergeVertices(geometry);

  const position = geometry.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i);
    const bump = 0.7 + valueNoise(v.x * 2 + seed * 7, v.z * 2 + v.y * 3) * 0.6;
    v.multiplyScalar(bump);
    v.y *= 0.6;
    position.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

export function createRocks() {
  const random = createRandom(42);
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: 0x5c2e1d, roughness: 0.9, flatShading: true });
  const dummy = new THREE.Object3D();
  const perVariant = Math.ceil(ROCK_COUNT / VARIANTS);

  for (let variant = 0; variant < VARIANTS; variant++) {
    const mesh = new THREE.InstancedMesh(createRockGeometry(variant), material, perVariant);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    for (let i = 0; i < perVariant; i++) {
      const angle = random() * Math.PI * 2;
      // Keep the rover's starting spot clear.
      const radius = CLEAR_RADIUS + Math.sqrt(random()) * (SCATTER_RADIUS - CLEAR_RADIUS);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      // Mostly pebbles, a few large boulders.
      const scale = 0.3 + Math.pow(random(), 4) * 4;

      dummy.position.set(x, heightAt(x, z) - scale * 0.25, z);
      dummy.rotation.set(random() * 0.4, random() * Math.PI * 2, random() * 0.4);
      dummy.scale.set(scale * (0.8 + random() * 0.6), scale, scale * (0.8 + random() * 0.6));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    group.add(mesh);
  }
  return group;
}
