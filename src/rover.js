import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const MODEL_URL = '/models/perseverance.glb';
const DRACO_PATH = '/draco/'; // NASA's model is Draco-compressed
const ROVER_LENGTH = 3; // meters, real Perseverance is ~3 m long
const FRONT_PART = 'Mastcam_Z_cams';
const CAMERA_PART = /cam|camera|watson|lens/i;
const NOT_A_CAMERA = /cover|wiring|bracket/i;

function centerOf(object) {
  return new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
}

// Turn the model so its front (where the mast is) points to local +Z.
function alignFront(model) {
  const front = model.getObjectByName(FRONT_PART);
  if (!front) return;
  const offset = centerOf(front).sub(centerOf(model));
  const yaw = Math.atan2(offset.x, offset.z);
  const snapped = Math.round(yaw / (Math.PI / 2)) * (Math.PI / 2);
  model.rotation.y = -snapped;
  model.updateMatrixWorld(true);
}

function fitToSize(model) {
  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  model.scale.multiplyScalar(ROVER_LENGTH / Math.max(size.x, size.z));
  model.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(new THREE.Vector3(center.x, box.min.y, center.z));
}

export async function loadRover() {
  const dracoLoader = new DRACOLoader().setDecoderPath(DRACO_PATH);
  const gltf = await new GLTFLoader().setDRACOLoader(dracoLoader).loadAsync(MODEL_URL);
  dracoLoader.dispose();
  const model = gltf.scene;
  model.updateMatrixWorld(true);
  alignFront(model);
  fitToSize(model);

  const cameraParts = [];
  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
    if (CAMERA_PART.test(child.name) && !NOT_A_CAMERA.test(child.name)) {
      cameraParts.push(child.name);
    }
  });

  const rover = new THREE.Group();
  rover.name = 'Perseverance';
  rover.add(model);
  return { object: rover, cameraParts };
}
