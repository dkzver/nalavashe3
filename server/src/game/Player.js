import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { getLavashTexture, getBrandBandTexture, getBackBadgeTexture } from './textures.js';

export const LANE_X = [-2.6, 0, 2.6];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const damp = (current, target, lambda, dt) => current + (target - current) * (1 - Math.exp(-lambda * dt));

/**
 * Живая шаурма: геометрия Three.js, мультяшное лицо, бег, прыжок и подкат.
 * Боковое перемещение — критически задемпфированная пружина, без мгновенных
 * телепортов между полосами: скорость набирается и гасится плавно.
 */
export class Player {
  constructor(scene) {
    this.scene = scene;

    this.lane = 1;
    this.targetX = 0;
    this.x = 0;
    this.vx = 0;
    this.y = 0;
    this.vy = 0;

    this.onGround = true;
    this.sliding = false;
    this.slideTimer = 0;
    this.slideQueued = 0;
    this.jumpBuffer = 0;
    this.coyote = 0;

    this.phase = 0;
    this.idleTime = 0;
    this.airBlend = 0;
    this.slideBlend = 0;
    this.squash = 0;
    this.edgeNudge = 0;
    this.crashed = false;
    this.crashTime = 0;
    this.visible = true;

    this.blinkTimer = 2.5 + Math.random() * 2.5;
    this.blinkTime = 0;

    this.root = new THREE.Group();
    this.root.name = 'player';
    this.pose = new THREE.Group();
    this.root.add(this.pose);
    this.flip = new THREE.Group();
    this.pose.add(this.flip);
    this.model = new THREE.Group();
    this.flip.add(this.model);
    this.body = new THREE.Group();
    this.model.add(this.body);
    scene.add(this.root);

    this._buildShadow();
    this._buildBody();

    this.root.position.set(0, 0, 0);
  }

  /* ------------------------------------------------------------------ */
  /* Сборка персонажа                                                    */
  /* ------------------------------------------------------------------ */
  _buildShadow() {
    const geometry = new THREE.CircleGeometry(0.72, 28);
    const material = new THREE.MeshBasicMaterial({
      color: 0x120804,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });
    this.shadow = new THREE.Mesh(geometry, material);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.015;
    this.shadow.renderOrder = 1;
    this.scene.add(this.shadow);
  }

  _buildBody() {
    const lavash = new THREE.MeshStandardMaterial({
      map: getLavashTexture(),
      color: 0xffffff,
      roughness: 0.82,
      metalness: 0.02,
    });
    const lavashEdge = new THREE.MeshStandardMaterial({ color: 0xc98a45, roughness: 0.9 });
    const cream = new THREE.MeshStandardMaterial({ color: 0xffe9c4, roughness: 0.75 });
    const creamDark = new THREE.MeshStandardMaterial({ color: 0xe6c79a, roughness: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a140c, roughness: 0.7 });
    const white = new THREE.MeshStandardMaterial({ color: 0xfffdf4, roughness: 0.35 });
    const pupil = new THREE.MeshStandardMaterial({ color: 0x231009, roughness: 0.4 });
    this.materials = { lavash, lavashEdge, cream, creamDark, dark, white, pupil };

    // Основа — золотистый лаваш.
    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.585, 1.18, 26, 1, false), lavash);
    wrap.position.y = 1.0;
    wrap.castShadow = false;
    this.body.add(wrap);

    // Верхний борт упаковки.
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 8, 28), lavashEdge);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 1.59;
    this.body.add(rim);

    // Фирменная лента с логотипом.
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.596, 0.603, 0.24, 26, 1, true),
      new THREE.MeshStandardMaterial({ map: getBrandBandTexture(), roughness: 0.68 }),
    );
    band.position.y = 0.68;
    this.body.add(band);

    // Бейдж на спине — его видно во время забега.
    const badge = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.42),
      new THREE.MeshBasicMaterial({
        map: getBackBadgeTexture(),
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    badge.position.set(0, 1.16, -0.55);
    badge.rotation.y = Math.PI;
    this.body.add(badge);

    this._buildFilling();
    this._buildFace();

    // Руки.
    this.armL = this._makeArm(-1);
    this.armR = this._makeArm(1);
    this.body.add(this.armL, this.armR);

    // Ноги.
    this.legL = this._makeLeg(-1);
    this.legR = this._makeLeg(1);
    this.model.add(this.legL, this.legR);
  }

  _buildFilling() {
    const filling = new THREE.Group();
    const lettuceMats = [
      new THREE.MeshStandardMaterial({ color: 0x7cbf4d, roughness: 0.85, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: 0x96d45f, roughness: 0.85, flatShading: true }),
    ];
    const tomatoMat = new THREE.MeshStandardMaterial({ color: 0xe4472e, roughness: 0.6 });
    const meatMat = new THREE.MeshStandardMaterial({ color: 0x8a4a26, roughness: 0.9, flatShading: true });
    const cheeseMat = new THREE.MeshStandardMaterial({ color: 0xffcf5c, roughness: 0.6 });
    const sauceMat = new THREE.MeshStandardMaterial({ color: 0xfff2cf, roughness: 0.5 });

    const lettuceGeo = new THREE.IcosahedronGeometry(0.15, 0);
    const tomatoGeo = new THREE.SphereGeometry(0.1, 10, 8);
    const meatGeo = new THREE.CylinderGeometry(0.09, 0.1, 0.16, 7);
    const cheeseGeo = new THREE.BoxGeometry(0.2, 0.035, 0.12);
    const sauceGeo = new THREE.SphereGeometry(0.06, 8, 6);

    for (let i = 0; i < 9; i++) {
      const angle = (i / 9) * Math.PI * 2 + 0.3;
      const radius = 0.3 + (i % 3) * 0.05;
      const lettuce = new THREE.Mesh(lettuceGeo, lettuceMats[i % 2]);
      lettuce.position.set(Math.cos(angle) * radius, 1.62 + (i % 2) * 0.07, Math.sin(angle) * radius);
      lettuce.rotation.set(Math.random(), Math.random(), Math.random());
      lettuce.scale.set(1, 0.55, 1);
      filling.add(lettuce);
    }

    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + 1.1;
      const tomato = new THREE.Mesh(tomatoGeo, tomatoMat);
      tomato.position.set(Math.cos(angle) * 0.26, 1.68 + (i % 2) * 0.05, Math.sin(angle) * 0.26);
      tomato.scale.set(1, 0.8, 1);
      filling.add(tomato);
    }

    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + 0.1;
      const meat = new THREE.Mesh(meatGeo, meatMat);
      meat.position.set(Math.cos(angle) * 0.19, 1.71 + (i % 2) * 0.06, Math.sin(angle) * 0.19);
      meat.rotation.set(Math.PI / 2, angle, 0);
      filling.add(meat);
    }

    for (let i = 0; i < 4; i++) {
      const cheese = new THREE.Mesh(cheeseGeo, cheeseMat);
      const angle = (i / 4) * Math.PI * 2 + 0.9;
      cheese.position.set(Math.cos(angle) * 0.34, 1.66, Math.sin(angle) * 0.34);
      cheese.rotation.set(0.3, angle, 0.1);
      filling.add(cheese);
    }

    for (let i = 0; i < 5; i++) {
      const sauce = new THREE.Mesh(sauceGeo, sauceMat);
      const angle = (i / 5) * Math.PI * 2;
      sauce.position.set(Math.cos(angle) * 0.38, 1.63, Math.sin(angle) * 0.38);
      sauce.scale.set(1, 0.6, 1);
      filling.add(sauce);
    }

    this.body.add(filling);
    this.filling = filling;
  }

  _buildFace() {
    const face = new THREE.Group();
    face.position.z = 0.02;
    this.body.add(face);

    const makeEye = (side) => {
      const eye = new THREE.Group();
      eye.position.set(side * 0.21, 1.19, 0.49);

      const white = new THREE.Mesh(new THREE.SphereGeometry(0.165, 18, 14), this.materials.white);
      white.scale.set(1, 1.12, 0.72);
      eye.add(white);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), this.materials.pupil);
      pupil.position.set(side * 0.012, 0.005, 0.135);
      pupil.scale.set(1, 1.05, 0.7);
      eye.add(pupil);

      const shine = new THREE.Mesh(
        new THREE.SphereGeometry(0.026, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
      );
      shine.position.set(side * 0.03, 0.05, 0.185);
      eye.add(shine);

      face.add(eye);
      return { group: eye, pupil, side };
    };

    this.eyeL = makeEye(-1);
    this.eyeR = makeEye(1);

    // Брови.
    const browGeo = new THREE.BoxGeometry(0.16, 0.032, 0.035);
    const browL = new THREE.Mesh(browGeo, this.materials.dark);
    browL.position.set(-0.21, 1.38, 0.52);
    browL.rotation.z = -0.16;
    const browR = new THREE.Mesh(browGeo, this.materials.dark);
    browR.position.set(0.21, 1.38, 0.52);
    browR.rotation.z = 0.16;
    face.add(browL, browR);

    // Улыбка.
    const mouth = new THREE.Mesh(
      new THREE.TorusGeometry(0.17, 0.033, 8, 22, Math.PI),
      this.materials.dark,
    );
    mouth.position.set(0, 0.96, 0.6);
    mouth.rotation.set(0.12, 0, Math.PI);
    face.add(mouth);

    const tongue = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xe2606a, roughness: 0.55 }),
    );
    tongue.position.set(0, 0.925, 0.64);
    tongue.scale.set(1, 0.5, 0.55);
    face.add(tongue);

    // Румянец.
    const blushMat = new THREE.MeshBasicMaterial({
      color: 0xff9270,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    [-1, 1].forEach((side) => {
      const blush = new THREE.Mesh(new THREE.CircleGeometry(0.09, 16), blushMat);
      blush.position.set(side * 0.37, 1.02, 0.585);
      blush.scale.set(1, 0.7, 1);
      face.add(blush);
    });

    this.face = face;
  }

  _makeArm(side) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.55, 1.24, 0.02);
    pivot.rotation.z = side * 0.16;

    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.28, 4, 10), this.materials.cream);
    arm.position.y = -0.2;
    pivot.add(arm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), this.materials.creamDark);
    hand.position.y = -0.38;
    hand.scale.set(1, 0.9, 1.05);
    pivot.add(hand);

    return pivot;
  }

  _makeLeg(side) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.23, 0.5, 0);
    pivot.rotation.z = side * 0.05;

    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.098, 0.22, 4, 10), this.materials.cream);
    leg.position.y = -0.16;
    pivot.add(leg);

    const shoe = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.14, 0.36, 3, 0.055), this.materials.creamDark);
    shoe.position.set(0, -0.37, 0.07);
    pivot.add(shoe);

    const sole = new THREE.Mesh(new RoundedBoxGeometry(0.25, 0.05, 0.37, 2, 0.025), new THREE.MeshStandardMaterial({ color: 0x4a2416, roughness: 0.85 }));
    sole.position.set(0, -0.435, 0.07);
    pivot.add(sole);

    return pivot;
  }

  /* ------------------------------------------------------------------ */
  /* Управление                                                          */
  /* ------------------------------------------------------------------ */
  changeLane(direction) {
    if (this.crashed) return false;
    const next = clamp(this.lane + direction, 0, LANE_X.length - 1);
    if (next === this.lane) {
      this.edgeNudge = direction * 0.12;
      return false;
    }
    this.lane = next;
    this.targetX = LANE_X[next];
    return true;
  }

  jump() {
    if (this.crashed) return false;
    if (!this.onGround) {
      this.jumpBuffer = 0.14;
      return false;
    }
    this.sliding = false;
    this.slideTimer = 0;
    this.onGround = false;
    this.coyote = 0;
    this.vy = 9.1;
    this.squash = 0;
    return true;
  }

  slide() {
    if (this.crashed) return false;
    if (this.sliding) {
      this.slideTimer = 0.62;
      return true;
    }
    if (!this.onGround) {
      this.vy = Math.min(this.vy, -15);
      this.slideQueued = 0.35;
      return false;
    }
    this.sliding = true;
    this.slideTimer = 0.62;
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* Обновление                                                          */
  /* ------------------------------------------------------------------ */
  update(dt, speed = 0, mode = 'play') {
    if (mode === 'crash') {
      this._updateCrash(dt);
      this._updateVisuals(dt, 0, mode);
      return;
    }

    const playing = mode === 'play';
    const running = playing || mode === 'attract';

    if (playing) {
      // Критически задемпфированная пружина: плавный, но отзывчивый переход.
      const stiffness = 112;
      const damping = 21;
      const accel = (this.targetX - this.x) * stiffness - this.vx * damping;
      this.vx += accel * dt;
      this.vx = clamp(this.vx, -12, 12);
      this.x += this.vx * dt;

      if (Math.abs(this.targetX - this.x) < 0.0015 && Math.abs(this.vx) < 0.02) {
        this.x = this.targetX;
        this.vx = 0;
      }
      this.x = clamp(this.x, LANE_X[0] - 0.15, LANE_X[LANE_X.length - 1] + 0.15);
    } else {
      this.x = damp(this.x, 0, 4, dt);
      this.targetX = 0;
      this.vx = damp(this.vx, 0, 6, dt);
    }

    this.root.position.x = this.x;

    // Прыжок.
    if (!this.onGround) {
      this.vy -= 26 * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
        this.onGround = true;
        this.squash = 0.15;
        if (this.slideQueued > 0) {
          this.slideQueued = 0;
          this.sliding = true;
          this.slideTimer = 0.62;
        }
        if (this.jumpBuffer > 0) {
          this.jumpBuffer = 0;
          this.jump();
        }
      }
    } else {
      this.coyote = 0.1;
    }

    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.slideQueued = Math.max(0, this.slideQueued - dt);
    this.coyote = Math.max(0, this.coyote - dt);

    if (this.sliding) {
      this.slideTimer -= dt;
      if (this.slideTimer <= 0) this.sliding = false;
    }

    this.root.position.y = this.y;

    this._updateVisuals(dt, speed, mode);
  }

  _updateVisuals(dt, speed, mode) {
    if (this.crashed) {
      this._updateFace(dt);
      this._updateShadow();
      return;
    }

    const playing = mode === 'play';
    const running = playing || mode === 'attract';
    const speedNorm = clamp(speed / 24, 0, 1.3);

    this.airBlend = damp(this.airBlend, this.onGround ? 0 : 1, 11, dt);
    this.slideBlend = damp(this.slideBlend, this.sliding ? 1 : 0, 15, dt);
    this.squash = damp(this.squash, 0, 9, dt);
    this.edgeNudge = damp(this.edgeNudge, 0, 8, dt);

    // Бег.
    if (running) {
      this.phase += dt * (5.6 + speed * 0.46) * (1 - this.slideBlend * 0.65);
    } else {
      this.idleTime += dt;
      this.phase += dt * 2.2;
    }

    const swing = Math.sin(this.phase) * 0.92;
    const runAmount = mode === 'menu' ? 0.25 : 1;

    const airPose = -0.5;
    const legLRun = swing * runAmount;
    const legRRun = -swing * runAmount;
    this.legL.rotation.x = legLRun * (1 - this.airBlend) + (airPose - 0.18) * this.airBlend + this.slideBlend * -0.35;
    this.legR.rotation.x = legRRun * (1 - this.airBlend) + (airPose + 0.18) * this.airBlend + this.slideBlend * 0.25;

    const armSwing = -swing * 0.7 * runAmount;
    const airArms = -2.15;
    const armLTarget = armSwing * (1 - this.airBlend) + airArms * this.airBlend + this.slideBlend * 0.9;
    const armRTarget = -armSwing * (1 - this.airBlend) + airArms * this.airBlend + this.slideBlend * 0.9;
    this.armL.rotation.x = damp(this.armL.rotation.x, armLTarget, 16, dt);
    this.armR.rotation.x = damp(this.armR.rotation.x, armRTarget, 16, dt);

    // Лёгкое покачивание корпуса в такт шагам.
    const bob = Math.abs(Math.sin(this.phase)) * 0.04 * (1 - this.airBlend) * runAmount;
    this.body.position.y = bob;
    this.body.rotation.y = Math.sin(this.phase * 0.5) * 0.05 * runAmount;
    this.filling.rotation.y = Math.sin(this.phase * 0.35) * 0.08;

    // В меню герой бежит лицом к камере (на зрителя), в забеге
    // разворачивается вперёд, по ходу улицы.
    const faceCamera = mode !== 'play';
    this.flip.rotation.y = damp(this.flip.rotation.y, faceCamera ? 0 : Math.PI, 7, dt);

    // Наклон и крен: именно они сглаживают «перекладку» между полосами.
    // Знак наклона зависит от того, куда смотрит герой: в меню он бежит
    // на камеру, в забеге — от камеры.
    const facingSign = Math.cos(this.flip.rotation.y) >= 0 ? 1 : -1;
    const targetTilt = (0.045 + speedNorm * 0.05) * facingSign + this.airBlend * 0.06 + this.slideBlend * 1.18;
    this.pose.rotation.x = damp(this.pose.rotation.x, targetTilt, 9, dt);

    const targetBank = clamp(-this.vx * 0.028, -0.3, 0.3) - this.edgeNudge;
    this.pose.rotation.z = damp(this.pose.rotation.z, targetBank, 11, dt);

    const targetYaw = clamp(-this.vx * 0.032, -0.24, 0.24) + (playing ? 0 : Math.sin(this.idleTime * 0.6) * 0.08);
    this.pose.rotation.y = damp(this.pose.rotation.y, targetYaw, 8, dt);

    // Сквош при приземлении и вытягивание в прыжке.
    const scaleY = 1 - this.squash * 0.85 + this.airBlend * 0.035;
    const scaleXZ = 1 + this.squash * 0.45 - this.airBlend * 0.012;
    this.model.scale.set(scaleXZ, scaleY, scaleXZ);

    this._updateFace(dt);
    this._updateShadow();
  }

  _updateFace(dt) {
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0 && this.blinkTime <= 0) {
      this.blinkTime = 0.15;
      this.blinkTimer = 2.2 + Math.random() * 3.6;
    }

    let open = 1;
    if (this.blinkTime > 0) {
      this.blinkTime -= dt;
      const progress = 1 - Math.max(0, this.blinkTime) / 0.15;
      open = Math.max(0.08, Math.abs(Math.cos(progress * Math.PI)));
    }

    this.eyeL.group.scale.y = open;
    this.eyeR.group.scale.y = open;

    const lookX = clamp(this.vx * 0.008, -0.035, 0.035);
    this.eyeL.pupil.position.x = this.eyeL.side * 0.012 + lookX;
    this.eyeR.pupil.position.x = this.eyeR.side * 0.012 + lookX;
  }

  _updateShadow() {
    const height = this.y;
    const scale = clamp(1 - height * 0.22, 0.55, 1);
    this.shadow.position.set(this.x, 0.018, 0);
    this.shadow.scale.setScalar(scale);
    this.shadow.material.opacity = 0.32 * clamp(1 - height * 0.28, 0.35, 1);
  }

  _updateCrash(dt) {
    this.crashTime += dt;
    this.vy -= 24 * dt;
    this.y = Math.max(0, this.y + this.vy * dt);
    if (this.y <= 0) {
      this.vy = Math.abs(this.vy) * 0.3;
      if (this.vy < 0.6) this.vy = 0;
      this.squash = 0.18;
    }
    this.root.position.y = this.y;

    // Падение на спину: корпус остаётся на виду, а не уходит под дорогу.
    this.pose.rotation.x = damp(this.pose.rotation.x, 1.5, 9, dt);
    this.pose.rotation.z = damp(this.pose.rotation.z, 0.3, 7, dt);
    this.pose.rotation.y = damp(this.pose.rotation.y, 0, 7, dt);
    this.pose.position.y = damp(this.pose.position.y, 0.48, 8, dt);
    this.pose.position.z = damp(this.pose.position.z, 0.75, 8, dt);
    this.flip.rotation.y = damp(this.flip.rotation.y, Math.PI, 8, dt);

    this.squash = damp(this.squash, 0, 7, dt);
    this.model.scale.set(1 + this.squash * 0.4, 1 - this.squash * 0.8, 1 + this.squash * 0.4);
    this.shadow.position.set(this.x, 0.018, 0);
    this._updateShadow();
  }

  /* ------------------------------------------------------------------ */
  /* Служебное                                                           */
  /* ------------------------------------------------------------------ */
  get height() {
    return this.sliding ? 0.7 : 1.66;
  }

  getCollider() {
    return {
      x: this.x,
      minY: this.y + 0.02,
      maxY: this.y + this.height,
      halfW: 0.42,
      halfD: 0.38,
    };
  }

  crash() {
    if (this.crashed) return;
    this.crashed = true;
    this.crashTime = 0;
    this.sliding = false;
    this.vy = 6.4;
    this.onGround = false;
    this.vx = 0;
  }

  reset() {
    this.lane = 1;
    this.targetX = 0;
    this.x = 0;
    this.vx = 0;
    this.y = 0;
    this.vy = 0;
    this.onGround = true;
    this.sliding = false;
    this.slideTimer = 0;
    this.slideQueued = 0;
    this.jumpBuffer = 0;
    this.phase = 0;
    this.airBlend = 0;
    this.slideBlend = 0;
    this.squash = 0;
    this.edgeNudge = 0;
    this.crashed = false;
    this.crashTime = 0;
    this.pose.rotation.set(0, 0, 0);
    this.pose.position.set(0, 0, 0);
    this.flip.rotation.set(0, 0, 0);
    this.model.position.set(0, 0, 0);
    this.model.scale.set(1, 1, 1);
    this.body.position.y = 0;
    this.root.position.set(0, 0, 0);
    this.shadow.position.set(0, 0.018, 0);
    this.shadow.scale.setScalar(1);
    this.shadow.material.opacity = 0.32;
  }

  setVisible(visible) {
    this.visible = visible;
    this.root.visible = visible;
    this.shadow.visible = visible;
  }

  dispose() {
    this.scene.remove(this.root);
    this.scene.remove(this.shadow);
    this.root.traverse((child) => {
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
