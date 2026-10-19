import * as THREE from 'three';

const MAX_MARKS = 6000;
const SPACING = 0.22;
const WHEEL_OFFSET = 1.05; // lateral distance from rover center to each wheel line

export function createTracks(heightAt) {
  const geometry = new THREE.PlaneGeometry(0.36, 0.24);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshStandardMaterial({
    color: 0x3a170a,
    roughness: 1,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, MAX_MARKS);
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const lastStamp = new THREE.Vector3();
  const step = new THREE.Vector3();
  let next = 0;
  let started = false;

  function stamp(x, z, yaw) {
    dummy.position.set(x, heightAt(x, z) + 0.03, z);
    dummy.rotation.set(0, yaw, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(next, dummy.matrix);
    next = (next + 1) % MAX_MARKS;
    mesh.count = Math.min(mesh.count + 1, MAX_MARKS);
  }

  return {
    object: mesh,
    // Fill the path since the last stamp with left/right tread marks every SPACING meters,
    // so tracks stay continuous even at low frame rates.
    update(position, yaw) {
      if (!started) {
        lastStamp.copy(position);
        started = true;
        return;
      }
      step.subVectors(position, lastStamp).setY(0);
      const gap = step.length();
      if (gap < SPACING) return;

      const count = Math.floor(gap / SPACING);
      step.multiplyScalar(SPACING / gap);
      const rx = -Math.cos(yaw) * WHEEL_OFFSET;
      const rz = Math.sin(yaw) * WHEEL_OFFSET;
      for (let i = 0; i < count; i++) {
        lastStamp.add(step);
        stamp(lastStamp.x + rx, lastStamp.z + rz, yaw);
        stamp(lastStamp.x - rx, lastStamp.z - rz, yaw);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
