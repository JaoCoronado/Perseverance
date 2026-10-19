import * as THREE from 'three';

const MAX_SPEED = 4; // m/s, sped up for fun (the real rover does ~0.04 m/s)
const ACCELERATION = 3;
const TURN_RATE = 0.9; // rad/s
const HALF_LENGTH = 1.4;
const HALF_WIDTH = 1.2;

const THROTTLE_KEYS = { KeyW: 1, ArrowUp: 1, KeyS: -1, ArrowDown: -1 };
const STEER_KEYS = { KeyA: 1, ArrowLeft: 1, KeyD: -1, ArrowRight: -1 };

function axis(keys, map) {
  let value = 0;
  for (const code of keys) value += map[code] ?? 0;
  return THREE.MathUtils.clamp(value, -1, 1);
}

export function createDriver(rover, heightAt, { yaw = 0 } = {}) {
  const keys = new Set();
  window.addEventListener('keydown', (e) => keys.add(e.code));
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  const state = { yaw, yawRate: 0, speed: 0, distance: 0 };
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const tangentForward = new THREE.Vector3();
  const tangentSide = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const basisX = new THREE.Vector3();
  const basisY = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  const targetQuaternion = new THREE.Quaternion();

  function sample(x, z) {
    return heightAt(rover.position.x + x, rover.position.z + z);
  }

  // Rest the rover on the four corners of its footprint so it tilts with the dunes.
  function settleOnTerrain(smoothing) {
    forward.set(Math.sin(state.yaw), 0, Math.cos(state.yaw));
    right.set(-forward.z, 0, forward.x);

    const front = sample(forward.x * HALF_LENGTH, forward.z * HALF_LENGTH);
    const back = sample(-forward.x * HALF_LENGTH, -forward.z * HALF_LENGTH);
    const sideA = sample(right.x * HALF_WIDTH, right.z * HALF_WIDTH);
    const sideB = sample(-right.x * HALF_WIDTH, -right.z * HALF_WIDTH);
    rover.position.y = (front + back + sideA + sideB) / 4;

    tangentForward.copy(forward).multiplyScalar(HALF_LENGTH * 2).setY(front - back).normalize();
    tangentSide.copy(right).multiplyScalar(HALF_WIDTH * 2).setY(sideA - sideB);
    normal.crossVectors(tangentSide, tangentForward).normalize();
    if (normal.y < 0) normal.negate();

    basisX.crossVectors(normal, tangentForward).normalize();
    basisY.crossVectors(tangentForward, basisX);
    matrix.makeBasis(basisX, basisY, tangentForward);
    targetQuaternion.setFromRotationMatrix(matrix);
    rover.quaternion.slerp(targetQuaternion, smoothing);
  }

  settleOnTerrain(1);

  return {
    state,
    update(dt) {
      const throttle = axis(keys, THROTTLE_KEYS);
      const steer = axis(keys, STEER_KEYS);

      const targetSpeed = throttle * MAX_SPEED;
      const step = ACCELERATION * dt;
      state.speed += THREE.MathUtils.clamp(targetSpeed - state.speed, -step, step);
      state.yawRate = steer * TURN_RATE;
      state.yaw += state.yawRate * dt;

      const travel = state.speed * dt;
      rover.position.x += Math.sin(state.yaw) * travel;
      rover.position.z += Math.cos(state.yaw) * travel;
      state.distance += Math.abs(travel);

      settleOnTerrain(1 - Math.exp(-dt * 8));
    },
  };
}
