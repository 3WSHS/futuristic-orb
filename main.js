// --- FULL WORKING main.js (with delete line feature + shape differences + delete orb + label saving + menu exit button + escape key) ---

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DragControls } from 'three/examples/jsm/controls/DragControls.js';

let isConnecting = false;
let selectedOrb = null;
let selectedLine = null;
let tempLine = null;
let spawnPosition = new THREE.Vector3();
let orbLabels = [];
let dynamicConnections = [];
let draggableObjects = [];
let dragControls;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const mousePos = { x: 0, y: 0 };

const contextMenu = document.getElementById('context-menu');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000014);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.5;
controls.zoomSpeed = 0.2;
controls.minDistance = 2;
controls.maxDistance = 100;

scene.add(new THREE.AmbientLight(0x404040, 2));
const pointLight = new THREE.PointLight(0x00ffff, 3, 100);
pointLight.position.set(5, 5, 5);
scene.add(pointLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(-5, 5, 5);
scene.add(directionalLight);

if (!loadFromStorage()) {
  const sphere = createOrb(0.5, 0x00ffff, 2, 'Main Orb', 'sphere');
  const smallSphere = createOrb(0.3, 0xff00ff, 2, 'Small Orb', 'sphere');
  smallSphere.position.set(1.5, 0.5, 0);
  const subSphere = createOrb(0.2, 0xffcc00, 1.5, 'Sub Orb', 'box');
  subSphere.position.set(2.0, 1.0, 0);
}
refreshDragControls();

const particles = new THREE.Points(
  new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(1500).map(() => (Math.random() - 0.5) * 200), 3)),
  new THREE.PointsMaterial({ color: 0x00ffff, size: 0.05, transparent: true, opacity: 0.7 })
);
scene.add(particles);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85));

window.addEventListener('pointermove', (e) => {
  mousePos.x = (e.clientX / window.innerWidth) * 2 - 1;
  mousePos.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const hitLine = raycaster.intersectObjects(dynamicConnections.map(c => c.line));
  if (hitLine.length > 0) {
    selectedLine = hitLine[0].object;
    showLineContextMenu(e.clientX, e.clientY);
    return;
  }

  const hitOrb = raycaster.intersectObjects(draggableObjects);
  if (hitOrb.length > 0) {
    selectedOrb = hitOrb[0].object;
    showOrbContextMenu(e.clientX, e.clientY, true);
    return;
  }

  spawnPosition = raycaster.ray.origin.clone().add(raycaster.ray.direction.clone().multiplyScalar(5));
  selectedLine = null;
  selectedOrb = null;
  showOrbContextMenu(e.clientX, e.clientY, false);
});

function showOrbContextMenu(x, y, isOrb) {
  contextMenu.style.display = 'block';
  contextMenu.innerHTML = `
    <div id="connect-orbs-option" class="menu-item">Connect Orbs</div>
    <div id="add-sub-sphere" class="menu-item">Add Sub Sphere</div>
    <div id="add-new-category" class="menu-item">Add New Category</div>
    <div id="add-topic" class="menu-item">Add Topic</div>
    ${isOrb ? '<div id="delete-orb" class="menu-item">Delete Object</div>' : ''}
    <div id="exit-menu" class="menu-item">Exit</div>
  `;
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;

  document.getElementById('connect-orbs-option').addEventListener('click', connectMode);
  document.getElementById('add-sub-sphere').addEventListener('click', addSubSphere);
  document.getElementById('add-new-category').addEventListener('click', addNewCategory);
  document.getElementById('add-topic').addEventListener('click', addTopic);
  if (isOrb) document.getElementById('delete-orb').addEventListener('click', deleteSelectedOrb);
  document.getElementById('exit-menu').addEventListener('click', closeContextMenu);
}

function showLineContextMenu(x, y) {
  contextMenu.style.display = 'block';
  contextMenu.innerHTML = `
    <div id="delete-line" class="menu-item">Delete Line</div>
    <div id="exit-menu" class="menu-item">Exit</div>
  `;
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;

  document.getElementById('delete-line').addEventListener('click', deleteSelectedLine);
  document.getElementById('exit-menu').addEventListener('click', closeContextMenu);
}

function closeContextMenu() {
  contextMenu.style.display = 'none';
  selectedOrb = null;
  selectedLine = null;
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeContextMenu();
  }
});

function connectMode() {
  isConnecting = true;
  selectedOrb = null;
  contextMenu.style.display = 'none';
}

function addSubSphere() {
  const sub = createOrb(0.2, 0xffcc00, 1.5, 'Sub Orb', 'box');
  sub.position.copy(spawnPosition);
  refreshDragControls();
  saveToStorage();
  contextMenu.style.display = 'none';
}

function addNewCategory() {
  const cat = createOrb(0.3, 0x00ff00, 2, 'New Category', 'octahedron');
  cat.position.copy(spawnPosition);
  refreshDragControls();
  saveToStorage();
  contextMenu.style.display = 'none';
}

function addTopic() {
  const topic = createOrb(0.25, 0xff6600, 1.2, 'Topic', 'tetrahedron');
  topic.position.copy(spawnPosition);
  refreshDragControls();
  saveToStorage();
  contextMenu.style.display = 'none';
}

function deleteSelectedOrb() {
  if (!selectedOrb) return;
  scene.remove(selectedOrb);
  draggableObjects = draggableObjects.filter(obj => obj !== selectedOrb);

  orbLabels = orbLabels.filter(({ orb, label }) => {
    if (orb === selectedOrb) {
      document.body.removeChild(label);
      return false;
    }
    return true;
  });

  dynamicConnections = dynamicConnections.filter(({ orb1, orb2, line }) => {
    if (orb1 === selectedOrb || orb2 === selectedOrb) {
      scene.remove(line);
      return false;
    }
    return true;
  });

  selectedOrb = null;
  refreshDragControls();
  saveToStorage();
  contextMenu.style.display = 'none';
}

function deleteSelectedLine() {
  if (!selectedLine) return;
  scene.remove(selectedLine);
  dynamicConnections = dynamicConnections.filter(c => c.line !== selectedLine);
  saveToStorage();
  selectedLine = null;
  contextMenu.style.display = 'none';
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (!isConnecting) return;
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(draggableObjects);
  if (intersects.length > 0) {
    const clickedOrb = intersects[0].object;
    if (!selectedOrb) {
      selectedOrb = clickedOrb;
    } else {
      if (tempLine) scene.remove(tempLine);
      connectTwoOrbs(selectedOrb, clickedOrb);
      isConnecting = false;
      selectedOrb = null;
      saveToStorage();
    }
  }
});

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);

  const elapsed = clock.getElapsedTime();
  const pulse = Math.sin(elapsed * 2) * 0.5 + 1;

  for (const { orb } of orbLabels) {
    orb.material.emissiveIntensity = pulse;
  }

  particles.rotation.y += 0.001;

  if (isConnecting && selectedOrb) {
    mouse.x = mousePos.x;
    mouse.y = mousePos.y;
    raycaster.setFromCamera(mouse, camera);
    const pos = raycaster.ray.origin.clone().add(raycaster.ray.direction.clone().multiplyScalar(5));
    if (tempLine) scene.remove(tempLine);
    const points = [selectedOrb.position.clone(), pos];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x00ffff });
    tempLine = new THREE.Line(geometry, material);
    scene.add(tempLine);
  }

  for (const { orb1, orb2, line } of dynamicConnections) {
    const posArr = line.geometry.attributes.position.array;
    posArr[0] = orb1.position.x;
    posArr[1] = orb1.position.y;
    posArr[2] = orb1.position.z;
    posArr[3] = orb2.position.x;
    posArr[4] = orb2.position.y;
    posArr[5] = orb2.position.z;
    line.geometry.attributes.position.needsUpdate = true;
  }

  for (const { orb, label } of orbLabels) {
    updateLabelPosition(orb, label);
  }

  controls.update();
  composer.render();
}
animate();

// --- Helpers ---

function createOrb(size, color, emissiveIntensity, labelText, shape = 'sphere') {
  let geometry;
  if (shape === 'box') {
    geometry = new THREE.BoxGeometry(size, size, size);
  } else if (shape === 'octahedron') {
    geometry = new THREE.OctahedronGeometry(size);
  } else if (shape === 'tetrahedron') {
    geometry = new THREE.TetrahedronGeometry(size);
  } else {
    geometry = new THREE.SphereGeometry(size, 64, 64);
  }

  const material = new THREE.MeshPhysicalMaterial({
    color, emissive: color, emissiveIntensity,
    metalness: 0.8, roughness: 0.1, clearcoat: 1.0,
    clearcoatRoughness: 0.1, reflectivity: 1.0
  });

  const orb = new THREE.Mesh(geometry, material);
  scene.add(orb);
  draggableObjects.push(orb);

  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = labelText;
  label.contentEditable = 'true';
  label.addEventListener('blur', saveToStorage);
  document.body.appendChild(label);

  orbLabels.push({ orb, label });
  return orb;
}

function updateLabelPosition(object, label) {
  const vector = new THREE.Vector3();
  object.updateWorldMatrix(true, false);
  vector.setFromMatrixPosition(object.matrixWorld);
  vector.project(camera);
  const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;
  label.style.transform = `translate(-50%, -50%) translate(${x}px, ${y - 60}px)`;
}

function connectTwoOrbs(orb1, orb2) {
  const points = [orb1.position.clone(), orb2.position.clone()];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0x00ffff });
  const line = new THREE.Line(geometry, material);
  scene.add(line);
  dynamicConnections.push({ orb1, orb2, line });
}

function setupDragControls(objects) {
  const drag = new DragControls(objects, camera, renderer.domElement);
  drag.addEventListener('dragstart', () => controls.enabled = false);
  drag.addEventListener('dragend', () => { controls.enabled = true; saveToStorage(); });
  return drag;
}

function refreshDragControls() {
  if (dragControls) dragControls.dispose();
  dragControls = setupDragControls(draggableObjects);
}

function saveToStorage() {
  const saveData = {
    orbs: orbLabels.map(({ orb, label }) => ({
      position: orb.position.toArray(),
      color: orb.material.color.getHex(),
      emissiveIntensity: orb.material.emissiveIntensity,
      labelText: label.innerText
    })),
    connections: dynamicConnections.map(({ orb1, orb2 }) => ({
      index1: draggableObjects.indexOf(orb1),
      index2: draggableObjects.indexOf(orb2)
    }))
  };
  localStorage.setItem('orbData', JSON.stringify(saveData));
}

function loadFromStorage() {
  const data = localStorage.getItem('orbData');
  if (!data) return false;
  const { orbs, connections } = JSON.parse(data);

  for (const orb of orbs) {
    const newOrb = createOrb(0.3, orb.color, orb.emissiveIntensity, orb.labelText);
    newOrb.position.fromArray(orb.position);
  }

  for (const conn of connections) {
    const orb1 = draggableObjects[conn.index1];
    const orb2 = draggableObjects[conn.index2];
    connectTwoOrbs(orb1, orb2);
  }

  return true;
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});