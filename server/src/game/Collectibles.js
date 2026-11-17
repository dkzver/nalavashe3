import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { LANE_X } from './Player.js';
import { getLavashTexture, getGlowTexture } from './textures.js';

export const ITEMS = {
  shawarma: { points: 100, label: '+100', radius: 0.42, color: 0xffc247 },
  burger: { points: 150, label: '+150', radius: 0.44, color: 0xffa04a },
  fries: { points: 75, label: '+75', radius: 0.4, color: 0xffe27a },
  drink: { points: 50, label: '+50', radius: 0.38, color: 0x7fd6e8 },
  bonus: { points: 500, label: '+500', radius: 0.46, color: 0xff5a1f },
};

let shared = null;
function getShared() {
  if (shared) return shared;

  const std = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.02, ...extra });

  shared = {
    lavash: new THREE.MeshStandardMaterial({ map: getLavashTexture(), roughness: 0.85 }),
    cream: std(0xfff1d4),
    bun: std(0xd99a56, { roughness: 0.85 }),
    bunLight: std(0xe9b26c, { roughness: 0.85 }),
    patty: std(0x6a3a1f, { roughness: 0.9 }),
    cheese: std(0xffc93c, { roughness: 0.55 }),
    lettuce: std(0x7ec24a, { roughness: 0.85, flatShading: true }),
    tomato: std(0xdf4230),
    red: std(0xd8371f),
    redDark: std(0xa92713),
    fry: std(0xffd45c, { roughness: 0.65 }),
    cup: std(0xe8451a),
    cupLight: std(0xffe8c4),
    straw: std(0xfff4e0),
    green: std(0x7cbf4d, { flatShading: true }),
    meat: std(0x8a4a26, { flatShading: true }),
    gold: new THREE.MeshStandardMaterial({
      color: 0xffb020,
      emissive: 0xff5a1f,
      emissiveIntensity: 1.2,
      roughness: 0.35,
      metalness: 0.25,
    }),
    glow: new THREE.SpriteMaterial({
      map: getGlowTexture(),
      color: 0xffa64a,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  };
  return shared;
}

const shadowGeo = new THREE.CircleGeometry(1, 16);
const shadowMat = new THREE.MeshBasicMaterial({
  color: 0x140804,
  transparent: true,
  opacity: 0.24,
  depthWrite: false,
});

function addShadow(group, sx, sz) {
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  shadow.scale.set(sx, sz, 1);
  group.add(shadow);
}

function makeShawarma() {
  const m = getShared();
  const group = new THREE.Group();

  const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.22, 0.56, 14, 1, false), m.lavash);
  wrap.rotation.z = Math.PI / 2;
  group.add(wrap);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.025, 6, 18), m.cream);
  rim.rotation.y = Math.PI / 2;
  rim.position.x = 0.28;
  group.add(rim);

  [1, -1].forEach((side) => {
    const greens = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 0), m.green);
    greens.position.set(side * 0.3, 0.02, 0);
    greens.scale.set(0.6, 1, 1);
    group.add(greens);

    const meat = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), m.meat);
    meat.position.set(side * 0.28, -0.07, 0.05);
    group.add(meat);

    const tomato = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), m.tomato);
    tomato.position.set(side * 0.31, 0.06, -0.06);
    group.add(tomato);
  });

  const paper = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.16, 14, 1, true), m.cupLight);
  paper.rotation.z = Math.PI / 2;
  paper.position.x = -0.08;
  group.add(paper);

  addShadow(group, 0.5, 0.3);
  return group;
}

function makeBurger() {
  const m = getShared();
  const group = new THREE.Group();

  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.26, 0.14, 16), m.bun);
  bottom.position.y = -0.22;
  group.add(bottom);

  const patty = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.11, 16), m.patty);
  patty.position.y = -0.09;
  group.add(patty);

  const cheese = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.035, 0.5, 2, 0.015), m.cheese);
  cheese.position.y = -0.015;
  cheese.rotation.y = 0.5;
  group.add(cheese);

  const lettuce = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), m.lettuce);
  lettuce.position.y = 0.05;
  lettuce.scale.set(1, 0.25, 1);
  group.add(lettuce);

  const tomato = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.05, 12), m.tomato);
  tomato.position.y = 0.1;
  group.add(tomato);

  const top = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), m.bunLight);
  top.position.y = 0.13;
  top.scale.set(1, 0.95, 1);
  group.add(top);

  for (let i = 0; i < 9; i++) {
    const sesame = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), m.cream);
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 0.22;
    sesame.position.set(Math.cos(angle) * radius, 0.32 + Math.random() * 0.06, Math.sin(angle) * radius);
    group.add(sesame);
  }

  addShadow(group, 0.45, 0.45);
  return group;
}

function makeFries() {
  const m = getShared();
  const group = new THREE.Group();

  const carton = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.16, 0.4, 4), m.red);
  carton.rotation.y = Math.PI / 4;
  carton.position.y = -0.16;
  group.add(carton);

  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.19, 0.1, 4), m.cupLight);
  band.rotation.y = Math.PI / 4;
  band.position.y = -0.16;
  group.add(band);

  for (let i = 0; i < 9; i++) {
    const fry = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.42, 0.055), m.fry);
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 0.13;
    fry.position.set(Math.cos(angle) * radius, 0.2, Math.sin(angle) * radius);
    fry.rotation.set((Math.random() - 0.5) * 0.3, Math.random(), (Math.random() - 0.5) * 0.3);
    group.add(fry);
  }

  addShadow(group, 0.4, 0.4);
  return group;
}

function makeDrink() {
  const m = getShared();
  const group = new THREE.Group();

  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.48, 16), m.cup);
  cup.position.y = -0.08;
  group.add(cup);

  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.195, 0.175, 0.13, 16, 1, true), m.cupLight);
  band.position.y = -0.06;
  group.add(band);

  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.205, 0.06, 16), m.cream);
  lid.position.y = 0.18;
  group.add(lid);

  const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.42, 8), m.straw);
  straw.position.set(0.06, 0.34, 0.02);
  straw.rotation.z = -0.28;
  group.add(straw);

  addShadow(group, 0.35, 0.35);
  return group;
}

function makeBonus() {
  const m = getShared();
  const group = new THREE.Group();

  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), m.gold);
  core.scale.set(0.8, 1.15, 0.8);
  group.add(core);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.035, 8, 24), m.gold);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  const glow = new THREE.Sprite(m.glow);
  glow.scale.set(1.7, 1.7, 1);
  group.add(glow);

  addShadow(group, 0.4, 0.4);
  return group;
}

const BUILDERS = {
  shawarma: makeShawarma,
  burger: makeBurger,
  fries: makeFries,
  drink: makeDrink,
  bonus: makeBonus,
};

export class Collectibles {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'collectibles';
    scene.add(this.group);

    this.active = [];
    this.pools = new Map();
    this.time = 0;
  }

  spawn(type, lane, z) {
    if (!BUILDERS[type]) return null;
    const pool = this.pools.get(type) || [];
    let mesh = pool.pop();
    if (!mesh) {
      mesh = BUILDERS[type]();
      mesh.userData.type = type;
    }

    const baseY = type === 'bonus' ? 1.15 : 0.95;
    mesh.position.set(LANE_X[lane], baseY, z);
    mesh.visible = true;
    mesh.rotation.set(0, Math.random() * Math.PI, 0);
    mesh.scale.set(1, 1, 1);

    const item = {
      type,
      mesh,
      x: LANE_X[lane],
      z,
      baseY,
      phase: Math.random() * Math.PI * 2,
      radius: ITEMS[type].radius,
      points: ITEMS[type].points,
      label: ITEMS[type].label,
      collected: false,
    };

    this.group.add(mesh);
    this.active.push(item);
    return item;
  }

  spawnLine(type, lane, z, count = 3, spacing = 3.2) {
    const items = [];
    for (let i = 0; i < count; i++) {
      items.push(this.spawn(type, lane, z - i * spacing));
    }
    return items;
  }

  update(dt, dz) {
    this.time += dt;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const item = this.active[i];
      item.z += dz;
      item.mesh.position.z = item.z;
      item.mesh.rotation.y += dt * (item.type === 'bonus' ? 2.8 : 1.8);
      item.mesh.position.y = item.baseY + Math.sin(this.time * 2.4 + item.phase) * 0.09;

      if (item.z > 12) {
        this._release(item);
        this.active.splice(i, 1);
      }
    }
  }

  collect(item) {
    if (item.collected) return false;
    item.collected = true;
    const index = this.active.indexOf(item);
    if (index !== -1) this.active.splice(index, 1);
    this._release(item);
    return true;
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
