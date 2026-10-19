import * as THREE from 'three';
import { fbm } from './random.js';

const SIZE = 600;
const SEGMENTS = 256;

const DARK_RUST = new THREE.Color(0x6e2f16);
const RUST = new THREE.Color(0xa94e25);
const OCHRE = new THREE.Color(0xd08a4e);

// Sharp-crested dunes on top of large rolling swells.
export function heightAt(x, z) {
  const warp = fbm(x * 0.01, z * 0.01) * 3;
  const crest = 1 - Math.abs(Math.sin(x * 0.04 + z * 0.015 + warp));
  const dunes = crest * crest * 5;
  const swell = (fbm(x * 0.006 + 10, z * 0.006) - 0.5) * 22;
  const detail = fbm(x * 0.1, z * 0.1) * 0.5;
  return dunes + swell + detail;
}

export function createTerrain() {
  const geometry = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
  geometry.rotateX(-Math.PI / 2);

  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    position.setY(i, heightAt(position.getX(i), position.getZ(i)));
  }
  geometry.computeVertexNormals();

  // Color by height and slope: ochre sand on crests, darker rust in hollows and steep faces.
  const normal = geometry.attributes.normal;
  const colors = new Float32Array(position.count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const height = THREE.MathUtils.clamp((position.getY(i) + 8) / 20, 0, 1);
    const flatness = normal.getY(i);
    const grain = fbm(x * 0.3, z * 0.3) - 0.5;
    color.copy(DARK_RUST).lerp(RUST, height);
    color.lerp(OCHRE, THREE.MathUtils.clamp(height * flatness * 0.8 + grain * 0.3, 0, 1));
    colors.set([color.r, color.g, color.b], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}
