import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { LANE_X } from './Player.js';

const CONFIG = {
  cone: { halfW: 0.42, halfD: 0.42, minY: 0, maxY: 0.92 },
  barrier: { halfW: 1.05, halfD: 0.24, minY: 0, maxY: 1.02 },
  car: { halfW: 1.0, halfD: 2.05, minY: 0, maxY: 1.95 },
  trash: { halfW: 0.82, halfD: 0.68, minY: 0, maxY: 1.78 },
  overhead: { halfW: 1.18, halfD: 0.26, minY: 1.34, maxY: 2.9 },
};

const CAR_COLORS = [0xd8452c, 0x2f7f86, 0xe0a52c, 0x6a4f8c, 0x4d7a3a];

const shadowGeo = new THREE.CircleGeometry(1, 18);
const shadowMat = new THREE.MeshBasicMaterial({
  color: 0x100704,
  transparent: true,
  opacity: 0.3,
  depthWrite: false,
});

let shared = null;
function getShared() {
  if (shared) return shared;

  const std = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.03, ...extra });

  shared = {
    orange: std(0xf2601c),
    orangeDark: std(0xb93c0a),
    white: std(0xfff3df),
    dark: std(0x241611),
    metal: std(0x5a5f63, { roughness: 0.5, metalness: 0.45 }),
    red: std(0xd3352a),
    green: std(0x3f6b3c),
    greenDark: std(0x2b4a2a),
    yellow: std(0xf5c542),
    glass: new THREE.MeshStandardMaterial({
      color: 0x1c2a33,
      roughness: 0.25,
      metalness: 0.4,
      emissive: 0x0a1218,
    }),
    light: new THREE.MeshStandardMaterial({
      color: 0xfff2c4,
      emissive: 0xffc247,
      emissiveIntensity: 1.4,
      roughness: 0.4,
    }),
    tail: new THREE.MeshStandardMaterial({
      color: 0xff3b1e,
      emissive: 0xff2a0e,
      emissiveIntensity: 1.6,
      roughness: 0.4,
    }),
    carMats: CAR_COLORS.map((color) => std(color)),
  };

  return shared;
}

function addShadow(group, x, z, sx, sz) {
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(x, 0.02, z);
  shadow.scale.set(sx, sz, 1);
  shadow.renderOrder = 1;
  group.add(shadow);
  return shadow;
}

function makeCone() {
  const m = getShared();
  const group = new THREE.Group();

  const base = new THREE.Mesh(new RoundedBoxGeometry(0.68, 0.09, 0.68, 2, 0.04), m.orangeDark);
  base.position.y = 0.045;
  group.add(base);

  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.33, 0.86, 14), m.orange);
  cone.position.y = 0.52;
  group.add(cone);

  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.16, 14, 1, true), m.white);
  stripe.position.y = 0.5;
  group.add(stripe);

  addShadow(group, 0, 0, 0.5, 0.5);
  return group;
}

function makeBarrier() {
  const m = getShared();
  const group = new THREE.Group();

  const plank = new THREE.Group();
  const segments = 6;
  for (let i = 0; i < segments; i++) {
    const part = new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.36, 0.13, 2, 0.03), i % 2 === 0 ? m.white : m.red);
    part.position.x = -0.9 + i * 0.36;
    plank.add(part);
  }
  plank.position.y = 0.76;
  group.add(plank);

  const topBar = new THREE.Mesh(new THREE.BoxGeometry(2.16, 0.09, 0.16), m.dark);
  topBar.position.y = 1.0;
  group.add(topBar);

  [-0.86, 0.86].forEach((x) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), m.metal);
    leg.position.set(x, 0.45, 0);
    group.add(leg);

    const foot = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.09, 0.5, 2, 0.04), m.dark);
    foot.position.set(x, 0.045, 0);
    group.add(foot);
  });

  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), m.light);
  lamp.position.set(-0.9, 1.13, 0);
  group.add(lamp);
  const lamp2 = lamp.clone();
  lamp2.position.x = 0.9;
  group.add(lamp2);

  addShadow(group, 0, 0, 1.2, 0.45);
  return group;
}

function makeCar() {
  const m = getShared();
  const group = new THREE.Group();

  const bodyMat = m.carMats[Math.floor(Math.random() * m.carMats.length)];
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.9, 0.72, 3.9, 4, 0.18), bodyMat);
  body.position.y = 0.78;
  group.add(body);

  const cabin = new THREE.Mesh(new RoundedBoxGeometry(1.62, 0.66, 1.95, 3, 0.14), m.glass);
  cabin.position.set(0, 1.38, -0.15);
  group.add(cabin);

  const roof = new THREE.Mesh(new RoundedBoxGeometry(1.64, 0.12, 2.0, 2, 0.05), bodyMat);
  roof.position.set(0, 1.69, -0.15);
  group.add(roof);

  const windscreenFrame = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.1, 0.08), m.dark);
  windscreenFrame.position.set(0, 1.36, 0.82);
  group.add(windscreenFrame);

  const bumper = new THREE.Mesh(new RoundedBoxGeometry(1.94, 0.22, 0.22, 2, 0.06), m.metal);
  bumper.position.set(0, 0.56, 1.92);
  group.add(bumper);

  const bumperBack = bumper.clone();
  bumperBack.position.z = -1.92;
  group.add(bumperBack);

  [1, -1].forEach((side) => {
    [1.24, -1.24].forEach((z) => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.26, 14), m.dark);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(side * 0.95, 0.36, z);
      group.add(wheel);

      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.28, 10), m.metal);
      hub.rotation.z = Math.PI / 2;
      hub.position.set(side * 0.97, 0.36, z);
      group.add(hub);
    });
  });

  [-0.55, 0.55].forEach((x) => {
    const light = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.16, 0.08, 2, 0.03), m.light);
    light.position.set(x, 0.78, 1.96);
    group.add(light);

    const tail = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.14, 0.08, 2, 0.03), m.tail);
    tail.position.set(x, 0.8, -1.96);
    group.add(tail);
  });

  // Такси-шашечки.
  if (Math.random() < 0.35) {
    const sign = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.2, 0.22, 2, 0.04), m.yellow);
    sign.position.set(0, 1.88, -0.1);
    group.add(sign);
  }

  addShadow(group, 0, 0, 1.15, 2.1);
  group.userData.bodyMaterial = bodyMat;
  return group;
}

function makeTrash() {
  const m = getShared();
  const group = new THREE.Group();

  const body = new THREE.Mesh(new RoundedBoxGeometry(1.45, 1.3, 1.05, 3, 0.07), m.green);
  body.position.y = 0.72;
  group.add(body);

  const lid = new THREE.Mesh(new RoundedBoxGeometry(1.55, 0.18, 1.16, 3, 0.06), m.greenDark);
  lid.position.set(0, 1.44, 0);
  lid.rotation.x = -0.06;
  group.add(lid);

  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.1), m.dark);
  handle.position.set(0, 1.55, 0.5);
  group.add(handle);

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 0.03), m.yellow);
  stripe.position.set(0, 0.9, 0.535);
  group.add(stripe);

  [0.9, -0.9].forEach((x) => {
    [0.32, -0.32].forEach((z) => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 8), m.dark);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.11, z);
      group.add(wheel);
    });
  });

  const bag = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), m.dark);
  bag.position.set(0.2, 1.66, -0.1);
  bag.scale.set(1.2, 0.6, 1);
  group.add(bag);

  addShadow(group, 0, 0, 1.0, 0.85);
  return group;
}

function makeOverhead() {
  const m = getShared();
  const group = new THREE.Group();

  [-1.16, 1.16].forEach((x) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.6, 0.16), m.metal);
    post.position.set(x, 1.3, 0);
    group.add(post);

    for (let i = 0; i < 4; i++) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.18, 0.19), i % 2 === 0 ? m.orange : m.white);
      band.position.set(x, 0.35 + i * 0.15, 0);
      group.add(band);
    }

    const foot = new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.12, 0.56, 2, 0.04), m.dark);
    foot.position.set(x, 0.06, 0);
    group.add(foot);
  });

  const beam = new THREE.Mesh(new RoundedBoxGeometry(2.6, 0.2, 0.24, 2, 0.05), m.metal);
  beam.position.y = 2.64;
  group.add(beam);

  const banner = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.86), makeBannerMaterial());
  banner.position.set(0, 2.03, 0.02);
  group.add(banner);

  const back = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.86), m.dark);
  back.position.set(0, 2.03, -0.02);
  back.rotation.y = Math.PI;
  group.add(back);

  addShadow(group, 0, 0, 1.25, 0.4);
  return group;
}

let bannerMaterial = null;
function makeBannerMaterial() {
  if (bannerMaterial) return bannerMaterial;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 200;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#f5c542';
  ctx.fillRect(0, 0, 512, 200);
  ctx.strokeStyle = '#241611';
  ctx.lineWidth = 16;
  ctx.strokeRect(8, 8, 496, 184);

  ctx.fillStyle = '#241611';
  ctx.font = '900 86px "Arial Black", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('НИЗКО!', 256, 88);
  ctx.font = '900 52px Arial, sans-serif';
  ctx.fillText('▼ ПОДКАТ ▼', 256, 154);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  bannerMaterial = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8 });
  return bannerMaterial;
}

const BUILDERS = {
  cone: makeCone,
  barrier: makeBarrier,
  car: makeCar,
  trash: makeTrash,
  overhead: makeOverhead,
};

export class Obstacles {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'obstacles';
    scene.add(this.group);

    this.active = [];
    this.pools = new Map();
  }

  spawn(type, lane, z) {
    if (!BUILDERS[type]) return null;
    const pool = this.pools.get(type) || [];
    let mesh = pool.pop();
    if (!mesh) {
      mesh = BUILDERS[type]();
      mesh.userData.type = type;
    }

    const x = LANE_X[lane];
    mesh.position.set(x, 0, z);
    mesh.rotation.set(0, 0, 0);
    mesh.visible = true;

    if (type === 'car') {
      const m = getShared();
      const bodyMat = m.carMats[Math.floor(Math.random() * m.carMats.length)];
      mesh.traverse((child) => {
        if (child.isMesh && child.material && CAR_COLORS.includes(child.material.color.getHex())) {
          if (child.geometry.type === 'RoundedBoxGeometry' && child.position.y > 0.4) {
            child.material = bodyMat;
          }
        }
      });
    }

    const conf = CONFIG[type];
    const item = {
      type,
      mesh,
      x,
      z,
      halfW: conf.halfW,
      halfD: conf.halfD,
      minY: conf.minY,
      maxY: conf.maxY,
    };

    this.group.add(mesh);
    this.active.push(item);
    return item;
  }

  update(dt, dz) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const item = this.active[i];
      item.z += dz;
      item.mesh.position.z = item.z;
      if (item.z > 22) {
        this._release(item);
        this.active.splice(i, 1);
      }
    }
  }

  _release(item) {
    item.mesh.visible = false;
    this.group.remove(item.mesh);
    item.mesh.position.set(0, 0, 0);
    const pool = this.pools.get(item.type) || [];
    pool.push(item.mesh);
    this.pools.set(item.type, pool);
  }

  reset() {
    for (const item of this.active) this._release(item);
    this.active.length = 0;
  }
}
