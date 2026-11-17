import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  getFacadeTextures,
  getSignTexture,
  getBannerTexture,
  getRoadTexture,
  getSidewalkTexture,
  getShopWindowTexture,
  getGlowTexture,
  getLogoTexture,
  getRoadSignTexture,
} from './textures.js';

const SEG_LEN = 34;
const SEG_COUNT = 7;
const TOTAL_LEN = SEG_LEN * SEG_COUNT;
const SIDEWALK_X = 6.95;
const ROAD_HALF = 5.2;
const SHOP_NAMES = ["НА LAVA'ШЕ", 'LAVA’ШАУРМА', 'ШАУРМА', 'БУРГЕРЫ', "ЛАВА'ДОГИ", 'LAVA DASH'];

const rand = (min, max) => min + Math.random() * (max - min);
const pick = (array) => array[Math.floor(Math.random() * array.length)];

let dashTexture = null;
function getDashTexture() {
  if (dashTexture) return dashTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 32, 256);
  ctx.fillStyle = '#f7e3bb';
  ctx.fillRect(10, 0, 12, 118);
  dashTexture = new THREE.CanvasTexture(canvas);
  dashTexture.colorSpace = THREE.SRGBColorSpace;
  dashTexture.wrapS = THREE.RepeatWrapping;
  dashTexture.wrapT = THREE.RepeatWrapping;
  dashTexture.repeat.set(1, 3);
  return dashTexture;
}

function makeAwningTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#ff5a1f' : '#fff1d2';
    ctx.fillRect(i * 32, 0, 32, 64);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'world';
    scene.add(this.group);

    this.segments = [];
    this.facades = getFacadeTextures();
    this.awningTexture = makeAwningTexture();
    this.glowTexture = getGlowTexture();
    this.signTextures = new Map();
    this.time = 0;

    this._createSky();
    this._createGround();
    this._createSegments();
  }

  /* ------------------------------------------------------------------ */
  /* Небо и земля                                                       */
  /* ------------------------------------------------------------------ */
  _createSky() {
    const geometry = new THREE.SphereGeometry(420, 32, 20);
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x2b1038) },
        midColor: { value: new THREE.Color(0xd9471f) },
        bottomColor: { value: new THREE.Color(0xffc07a) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 bottomColor;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition).y;
          float up = smoothstep(0.0, 0.55, h);
          float down = smoothstep(-0.08, 0.16, h);
          vec3 color = mix(bottomColor, midColor, down);
          color = mix(color, topColor, up);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });

    const sky = new THREE.Mesh(geometry, material);
    sky.frustumCulled = false;
    this.group.add(sky);

    // Солнце.
    const sunMaterial = new THREE.SpriteMaterial({
      map: this.glowTexture,
      color: 0xffd9a0,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending,
    });
    const sun = new THREE.Sprite(sunMaterial);
    sun.position.set(-80, 58, -300);
    sun.scale.set(150, 150, 1);
    this.group.add(sun);
  }

  _createGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(500, 700),
      new THREE.MeshStandardMaterial({ color: 0x4a332a, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.position.z = -220;
    this.group.add(ground);
  }

  /* ------------------------------------------------------------------ */
  /* Сегменты улицы                                                     */
  /* ------------------------------------------------------------------ */
  _createSegments() {
    for (let i = 0; i < SEG_COUNT; i++) {
      const segment = this._makeSegment(i);
      segment.position.z = SEG_LEN - i * SEG_LEN;
      this.segments.push(segment);
      this.group.add(segment);
    }
    this.totalLength = TOTAL_LEN;
  }

  _makeSegment(index) {
    const segment = new THREE.Group();

    // Асфальт.
    const roadMat = new THREE.MeshStandardMaterial({
      map: getRoadTexture(),
      color: 0xffffff,
      roughness: 0.96,
      metalness: 0.02,
    });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, SEG_LEN), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0;
    segment.add(road);

    // Разметка.
    const dashMat = new THREE.MeshBasicMaterial({
      map: getDashTexture(),
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
    [-1.32, 1.32].forEach((x) => {
      const lane = new THREE.Mesh(new THREE.PlaneGeometry(0.16, SEG_LEN), dashMat);
      lane.rotation.x = -Math.PI / 2;
      lane.position.set(x, 0.012, 0);
      segment.add(lane);
    });

    const edgeMat = new THREE.MeshBasicMaterial({ color: 0xe9cfa6, transparent: true, opacity: 0.55 });
    [-4.95, 4.95].forEach((x) => {
      const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.1, SEG_LEN), edgeMat);
      edge.rotation.x = -Math.PI / 2;
      edge.position.set(x, 0.012, 0);
      segment.add(edge);
    });

    // Тротуары.
    this._makeSidewalk(segment, 1);
    this._makeSidewalk(segment, -1);

    // Здания.
    this._makeBuilding(segment, 1, index);
    this._makeBuilding(segment, -1, index);

    // Фонари.
    this._makeLamp(segment, 1, -10);
    this._makeLamp(segment, -1, 6);

    // Дорожный знак.
    this._makeRoadSign(segment, index % 2 === 0 ? 1 : -1, -20);

    // Деревья.
    this._makeTree(segment, index % 2 === 0 ? 1 : -1, 12);

    // Уличная мелочь.
    this._makePlanter(segment, index % 2 === 0 ? -1 : 1, 13);
    this._makeHydrant(segment, index % 3 === 0 ? 1 : -1, -2);
    if (index % 2 === 0) this._makeBench(segment, -1, -3);

    // Арка с брендом.
    if (index % 3 === 0) this._makeArch(segment);

    // Пешеходный переход на некоторых сегментах.
    if (index % 4 === 2) this._makeCrosswalk(segment, 10);

    return segment;
  }

  _makeSidewalk(segment, side) {
    const sidewalkMat = new THREE.MeshStandardMaterial({
      map: getSidewalkTexture(),
      roughness: 0.95,
    });

    const walk = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.18, SEG_LEN), sidewalkMat);
    walk.position.set(side * SIDEWALK_X, 0.06, 0);
    segment.add(walk);

    const curb = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.26, SEG_LEN),
      new THREE.MeshStandardMaterial({ color: 0xb08a6a, roughness: 0.9 }),
    );
    curb.position.set(side * 5.36, 0.1, 0);
    segment.add(curb);
  }

  _makeBuilding(segment, side, index) {
    const width = rand(6.2, 9.4);
    const height = rand(9, 21);
    const depth = rand(27, 32);
    const frontX = side * 8.25;
    const centerX = frontX + side * (width / 2);

    const texture = pick(this.facades);
    const tint = pick([0xffffff, 0xf3e2d0, 0xe8d6c8, 0xffe9d6]);
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      color: tint,
      roughness: 0.9,
      metalness: 0.02,
    });

    const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    building.position.set(centerX, height / 2 + 0.16, 0);
    segment.add(building);

    // Цоколь.
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.25, 1.1, depth + 0.25),
      new THREE.MeshStandardMaterial({ color: 0x3a2620, roughness: 0.95 }),
    );
    base.position.set(centerX, 0.55, 0);
    segment.add(base);

    // Крыша: парапет и бак.
    const parapet = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.3, 0.5, depth + 0.3),
      new THREE.MeshStandardMaterial({ color: 0x5a3b2c, roughness: 0.95 }),
    );
    parapet.position.set(centerX, height + 0.3, 0);
    segment.add(parapet);

    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 0.9, 1.5, 10),
      new THREE.MeshStandardMaterial({ color: 0x6a4a38, roughness: 0.9 }),
    );
    tank.position.set(centerX + rand(-1.4, 1.4), height + 1.05, rand(-4, 4));
    segment.add(tank);

    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 2.2, 5),
      new THREE.MeshStandardMaterial({ color: 0x2a1c17 }),
    );
    antenna.position.set(centerX, height + 1.35, rand(-3, 3));
    segment.add(antenna);

    // Витрина и вывеска.
    if (index % 2 === 0 || Math.random() > 0.55) {
      this._makeShopFront(segment, side, frontX, height, index);
    }

    // Балконы.
    if (height > 13 && Math.random() > 0.4) {
      for (let i = 0; i < 2; i++) {
        const balcony = new THREE.Mesh(
          new THREE.BoxGeometry(0.7, 0.16, 2.4),
          new THREE.MeshStandardMaterial({ color: 0x4a3328, roughness: 0.9 }),
        );
        balcony.position.set(frontX - side * 0.35, 5.4 + i * 3.1, rand(-7, 7));
        segment.add(balcony);
      }
    }
  }

  _makeShopFront(segment, side, frontX, height, index) {
    const z = rand(-7, 7);
    const name = pick(SHOP_NAMES);
    const faceRotation = side > 0 ? -Math.PI / 2 : Math.PI / 2;

    // Светящаяся витрина.
    const windowMat = new THREE.MeshBasicMaterial({
      map: getShopWindowTexture(),
      toneMapped: false,
      transparent: true,
      opacity: 0.95,
    });
    const shopWindow = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 2.5), windowMat);
    shopWindow.position.set(frontX - side * 0.03, 2.0, z);
    shopWindow.rotation.y = faceRotation;
    segment.add(shopWindow);

    const frame = new THREE.Mesh(
      new THREE.PlaneGeometry(6.25, 2.75),
      new THREE.MeshBasicMaterial({ color: 0x2a1710 }),
    );
    frame.position.set(frontX - side * 0.015, 2.0, z);
    frame.rotation.y = faceRotation;
    segment.add(frame);

    // Навес.
    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.14, 6.2),
      new THREE.MeshStandardMaterial({ map: this.awningTexture, roughness: 0.85 }),
    );
    awning.position.set(frontX - side * 0.72, 3.45, z);
    awning.rotation.z = side * 0.12;
    segment.add(awning);

    // Вывеска над витриной.
    const texture = this._getSign(name);
    const signMaterial = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 2.0), signMaterial);
    sign.position.set(frontX - side * 0.05, 4.75, z);
    sign.rotation.y = faceRotation;
    segment.add(sign);

    if (height > 12 && Math.random() > 0.5) {
      const logoMaterial = new THREE.MeshBasicMaterial({
        map: getLogoTexture(),
        transparent: true,
        toneMapped: false,
        depthWrite: false,
      });
      const logo = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.55), logoMaterial);
      logo.position.set(frontX - side * 0.06, 7.1, z + rand(-1.5, 1.5));
      logo.rotation.y = faceRotation;
      segment.add(logo);
    }
  }

  _getSign(name) {
    if (!this.signTextures.has(name)) {
      this.signTextures.set(name, getSignTexture(name));
    }
    return this.signTextures.get(name);
  }

  _makeLamp(segment, side, z) {
    const group = new THREE.Group();
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c2420, roughness: 0.7, metalness: 0.35 });
    const x = side * 5.9;

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 4.8, 8), poleMat);
    pole.position.y = 2.4;
    group.add(pole);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.08), poleMat);
    arm.position.set(-side * 0.42, 4.72, 0);
    group.add(arm);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 10, 8),
      new THREE.MeshStandardMaterial({
        color: 0xffe2a8,
        emissive: 0xffc247,
        emissiveIntensity: 2,
        roughness: 0.4,
      }),
    );
    head.position.set(-side * 0.84, 4.66, 0);
    group.add(head);

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: 0xffb347,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    glow.position.copy(head.position);
    glow.scale.set(2.3, 2.3, 1);
    group.add(glow);

    group.position.set(x, 0.16, z);
    segment.add(group);
  }

  _makeRoadSign(segment, side, z) {
    const group = new THREE.Group();
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x8b8f92, roughness: 0.55, metalness: 0.35 });

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 2.5, 8), poleMat);
    pole.position.y = 1.25;
    group.add(pole);

    const rotation = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    const face = new THREE.Mesh(
      new THREE.CircleGeometry(0.4, 24),
      new THREE.MeshBasicMaterial({ map: getRoadSignTexture(), transparent: true, toneMapped: false }),
    );
    face.position.set(side * -0.012, 2.55, 0);
    face.rotation.y = rotation;
    group.add(face);

    const back = new THREE.Mesh(
      new THREE.CircleGeometry(0.4, 24),
      new THREE.MeshStandardMaterial({ color: 0x35322f, roughness: 0.7, metalness: 0.25 }),
    );
    back.position.set(side * 0.006, 2.55, 0);
    back.rotation.y = rotation + Math.PI;
    group.add(back);

    group.position.set(side * 5.85, 0.16, z);
    segment.add(group);
  }

  _makeTree(segment, side, z) {
    const group = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3a24, roughness: 0.95 });
    const leafMats = [
      new THREE.MeshStandardMaterial({ color: 0x4f7f3c, roughness: 0.9, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: 0x639944, roughness: 0.9, flatShading: true }),
    ];

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 1.5, 7), trunkMat);
    trunk.position.y = 0.75;
    group.add(trunk);

    for (let i = 0; i < 3; i++) {
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.7, 1.0), 0), leafMats[i % 2]);
      leaf.position.set(rand(-0.4, 0.4), 1.8 + i * 0.42, rand(-0.4, 0.4));
      leaf.scale.set(1, 0.85, 1);
      group.add(leaf);
    }

    const planter = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.62, 0.45, 10),
      new THREE.MeshStandardMaterial({ color: 0x6f4c37, roughness: 0.9 }),
    );
    planter.position.y = 0.22;
    group.add(planter);

    group.position.set(side * 7.1, 0.16, z);
    segment.add(group);
  }

  _makePlanter(segment, side, z) {
    const group = new THREE.Group();
    const box = new THREE.Mesh(
      new RoundedBoxGeometry(1.1, 0.55, 1.1, 2, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x7a4b32, roughness: 0.92 }),
    );
    box.position.y = 0.28;
    group.add(box);

    const bush = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.55, 0),
      new THREE.MeshStandardMaterial({ color: 0x5f9744, roughness: 0.9, flatShading: true }),
    );
    bush.position.y = 0.78;
    bush.scale.set(1.15, 0.8, 1.15);
    group.add(bush);

    group.position.set(side * 7.4, 0.16, z);
    segment.add(group);
  }

  _makeHydrant(segment, side, z) {
    const group = new THREE.Group();
    const red = new THREE.MeshStandardMaterial({ color: 0xc83224, roughness: 0.65 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.23, 0.62, 10), red);
    body.position.y = 0.31;
    group.add(body);

    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), red);
    cap.position.y = 0.62;
    group.add(cap);

    [-0.18, 0.18].forEach((x) => {
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.18, 8), red);
      nozzle.rotation.z = Math.PI / 2;
      nozzle.position.set(x, 0.42, 0.1);
      group.add(nozzle);
    });

    group.position.set(side * 6.2, 0.16, z);
    segment.add(group);
  }

  _makeBench(segment, side, z) {
    const group = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.9 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x2a2320, roughness: 0.7, metalness: 0.3 });

    const seat = new THREE.Mesh(new RoundedBoxGeometry(1.8, 0.12, 0.55, 2, 0.04), wood);
    seat.position.y = 0.45;
    group.add(seat);

    const back = new THREE.Mesh(new RoundedBoxGeometry(1.8, 0.5, 0.12, 2, 0.04), wood);
    back.position.set(0, 0.72, -0.24);
    back.rotation.x = -0.12;
    group.add(back);

    [-0.72, 0.72].forEach((x) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 0.5), metal);
      leg.position.set(x, 0.22, 0);
      group.add(leg);
    });

    group.position.set(side * 6.35, 0.16, z);
    group.rotation.y = side > 0 ? -0.2 : 0.2;
    segment.add(group);
  }

  _makeArch(segment) {
    const group = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0x3a2a23, roughness: 0.75, metalness: 0.3 });

    [-5.8, 5.8].forEach((x) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5.5, 8), metal);
      post.position.set(x, 2.75, 0);
      group.add(post);
    });

    const beam = new THREE.Mesh(new THREE.BoxGeometry(11.9, 0.18, 0.18), metal);
    beam.position.y = 5.5;
    group.add(beam);

    const bannerMat = new THREE.MeshBasicMaterial({
      map: getBannerTexture(),
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(9.8, 2.45), bannerMat);
    banner.position.set(0, 4.5, 0);
    group.add(banner);

    group.position.y = 0.16;
    segment.add(group);
  }

  _makeCrosswalk(segment, z) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xf3ddb8, transparent: true, opacity: 0.7 });
    for (let i = 0; i < 8; i++) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 2.8), mat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(-4.2 + i * 1.2, 0.015, z);
      segment.add(stripe);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Движение мира                                                      */
  /* ------------------------------------------------------------------ */
  update(dt, dz) {
    this.time += dt;
    for (const segment of this.segments) {
      segment.position.z += dz;
      if (segment.position.z > SEG_LEN + 26) {
        segment.position.z -= TOTAL_LEN;
      }
    }
  }

  reset() {
    this.segments.forEach((segment, index) => {
      segment.position.z = SEG_LEN - index * SEG_LEN;
    });
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => {
          if (material.map) material.map.dispose();
          material.dispose();
        });
      }
    });
  }
}
