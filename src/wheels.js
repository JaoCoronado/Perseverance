import * as THREE from 'three';

const WHEELS_NODE = 'Wheels_objs';
const MAX_STEER = 0.8; // rad, corner wheels can angle ~45° to turn in place
const STEER_RATE = 6;
const SUSPENSION_TRAVEL = 0.15; // meters up/down per wheel
const SUSPENSION_RATE = 12;

// Split one 1D set of values into 3 clusters (front, middle, rear wheels).
function kMeans3(values) {
  const sorted = [...values].sort((a, b) => a - b);
  let centers = [sorted[0], sorted[Math.floor(sorted.length / 2)], sorted[sorted.length - 1]];
  for (let iteration = 0; iteration < 12; iteration++) {
    const sums = [0, 0, 0];
    const counts = [0, 0, 0];
    for (const v of values) {
      const k = nearest(centers, v);
      sums[k] += v;
      counts[k]++;
    }
    centers = centers.map((c, k) => (counts[k] ? sums[k] / counts[k] : c));
  }
  return centers;
}

function nearest(centers, v) {
  let best = 0;
  for (let k = 1; k < centers.length; k++) {
    if (Math.abs(v - centers[k]) < Math.abs(v - centers[best])) best = k;
  }
  return best;
}

// Collect every triangle of the merged wheels mesh in rover space.
function collectTriangles(source, rover) {
  rover.updateMatrixWorld(true);
  const toRover = rover.matrixWorld.clone().invert();
  const triangles = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();

  source.traverse((part) => {
    if (!part.isMesh) return;
    const matrix = toRover.clone().multiply(part.matrixWorld);
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
    const geometry = part.geometry;
    const index = geometry.index;
    const count = index ? index.count : geometry.attributes.position.count;
    const pos = geometry.attributes.position;

    for (let i = 0; i < count; i += 3) {
      const ids = index ? [index.getX(i), index.getX(i + 1), index.getX(i + 2)] : [i, i + 1, i + 2];
      a.fromBufferAttribute(pos, ids[0]).applyMatrix4(matrix);
      b.fromBufferAttribute(pos, ids[1]).applyMatrix4(matrix);
      c.fromBufferAttribute(pos, ids[2]).applyMatrix4(matrix);
      triangles.push({
        part,
        ids,
        matrix,
        normalMatrix,
        x: (a.x + b.x + c.x) / 3,
        z: (a.z + b.z + c.z) / 3,
      });
    }
  });
  return triangles;
}

// Build a geometry (in rover space) from the triangles of one wheel and one source mesh.
function buildGeometry(triangles) {
  const { part, matrix, normalMatrix } = triangles[0];
  const source = part.geometry;
  const pos = source.attributes.position;
  const normal = source.attributes.normal;
  const uv = source.attributes.uv;

  const positions = new Float32Array(triangles.length * 9);
  const normals = normal ? new Float32Array(triangles.length * 9) : null;
  const uvs = uv ? new Float32Array(triangles.length * 6) : null;
  const v = new THREE.Vector3();
  let p = 0;
  let t = 0;

  for (const triangle of triangles) {
    for (const id of triangle.ids) {
      v.fromBufferAttribute(pos, id).applyMatrix4(matrix);
      positions.set([v.x, v.y, v.z], p);
      if (normals) {
        v.fromBufferAttribute(normal, id).applyMatrix3(normalMatrix).normalize();
        normals.set([v.x, v.y, v.z], p);
      }
      if (uvs) uvs.set([uv.getX(id), uv.getY(id)], t);
      p += 3;
      t += 2;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  if (normals) geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  if (uvs) geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return geometry;
}

function createWheelRig(rover, triangles, steerable) {
  const byPart = new Map();
  for (const triangle of triangles) {
    if (!byPart.has(triangle.part)) byPart.set(triangle.part, []);
    byPart.get(triangle.part).push(triangle);
  }

  const spin = new THREE.Group();
  const box = new THREE.Box3();
  for (const [part, partTriangles] of byPart) {
    const mesh = new THREE.Mesh(buildGeometry(partTriangles), part.material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.geometry.computeBoundingBox();
    box.union(mesh.geometry.boundingBox);
    spin.add(mesh);
  }

  // Re-center the geometry on the wheel hub so it spins around its own axle.
  const center = box.getCenter(new THREE.Vector3());
  for (const mesh of spin.children) mesh.geometry.translate(-center.x, -center.y, -center.z);

  const mount = new THREE.Group();
  mount.position.copy(center);
  mount.add(spin);
  rover.add(mount);

  return {
    mount,
    spin,
    base: center,
    radius: (box.max.y - box.min.y) / 2,
    steerable,
    steer: 0,
    targetSteer: 0,
    suspension: 0,
    rollSpeed: 0,
  };
}

export function createWheels(rover, model) {
  const source = model.getObjectByName(WHEELS_NODE);
  if (!source) return null;

  const triangles = collectTriangles(source, rover);
  const wheels = [];

  // Split by side (left/right of the center line), then front/middle/rear along the length.
  for (const isLeft of [true, false]) {
    const side = triangles.filter((t) => t.x > 0 === isLeft);
    const centers = kMeans3(side.map((t) => t.z));
    const groups = [[], [], []];
    for (const triangle of side) groups[nearest(centers, triangle.z)].push(triangle);
    groups.forEach((group, k) => {
      if (!group.length) return;
      const isMiddle = k === 1;
      wheels.push(createWheelRig(rover, group, !isMiddle));
    });
  }
  source.visible = false;

  const bottom = new THREE.Vector3();

  return {
    wheels,
    update(dt, { speed, yawRate }, heightAt) {
      const steerBlend = 1 - Math.exp(-dt * STEER_RATE);
      const suspensionBlend = 1 - Math.exp(-dt * SUSPENSION_RATE);

      for (const wheel of wheels) {
        // Rigid-body velocity of this wheel's contact point, in rover space.
        const vx = yawRate * wheel.base.z;
        const vz = speed - yawRate * wheel.base.x;

        if (wheel.steerable && Math.hypot(vx, vz) > 0.05) {
          let angle = Math.atan2(vx, vz);
          if (angle > Math.PI / 2) angle -= Math.PI;
          else if (angle < -Math.PI / 2) angle += Math.PI;
          wheel.targetSteer = THREE.MathUtils.clamp(angle, -MAX_STEER, MAX_STEER);
        }
        wheel.steer += (wheel.targetSteer - wheel.steer) * steerBlend;
        wheel.mount.rotation.y = wheel.steer;

        // Roll at the speed of the ground along the wheel's heading.
        wheel.rollSpeed = vx * Math.sin(wheel.steer) + vz * Math.cos(wheel.steer);
        wheel.spin.rotation.x += (wheel.rollSpeed * dt) / wheel.radius;

        // Each wheel reaches for the ground under it, within the suspension travel.
        bottom.set(wheel.base.x, wheel.base.y - wheel.radius, wheel.base.z);
        rover.localToWorld(bottom);
        const gap = heightAt(bottom.x, bottom.z) - bottom.y;
        const target = THREE.MathUtils.clamp(gap, -SUSPENSION_TRAVEL, SUSPENSION_TRAVEL);
        wheel.suspension += (target - wheel.suspension) * suspensionBlend;
        wheel.mount.position.y = wheel.base.y + wheel.suspension;
      }
    },
    // World positions of each wheel's contact point, for dust effects.
    contactPoints(target = []) {
      wheels.forEach((wheel, i) => {
        target[i] = target[i] ?? new THREE.Vector3();
        target[i].set(wheel.base.x, wheel.mount.position.y - wheel.radius, wheel.base.z);
        rover.localToWorld(target[i]);
      });
      return target;
    },
  };
}
