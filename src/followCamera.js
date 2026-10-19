import * as THREE from 'three';

const LOOK_HEIGHT = 1.3;
const SWING_RATE = 1.5;
const MIN_CLEARANCE = 0.8;

// Carries the orbit camera along with the rover and swings it behind while driving.
export function createFollowCamera(camera, controls, target, heightAt) {
  const lastPosition = target.position.clone();
  const delta = new THREE.Vector3();
  const offset = new THREE.Vector3();

  return {
    update(dt, { yaw, speed }) {
      delta.subVectors(target.position, lastPosition);
      lastPosition.copy(target.position);
      camera.position.add(delta);
      controls.target.copy(target.position).y += LOOK_HEIGHT;

      if (Math.abs(speed) > 0.1) {
        offset.subVectors(camera.position, controls.target);
        const current = Math.atan2(offset.x, offset.z);
        const behind = yaw + Math.PI;
        const diff = Math.atan2(Math.sin(behind - current), Math.cos(behind - current));
        const angle = current + diff * (1 - Math.exp(-dt * SWING_RATE));
        const horizontal = Math.hypot(offset.x, offset.z);
        offset.x = Math.sin(angle) * horizontal;
        offset.z = Math.cos(angle) * horizontal;
        camera.position.copy(controls.target).add(offset);
      }

      const ground = heightAt(camera.position.x, camera.position.z) + MIN_CLEARANCE;
      camera.position.y = Math.max(camera.position.y, ground);
    },
  };
}
