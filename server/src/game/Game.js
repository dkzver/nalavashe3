import * as THREE from 'three';
import { Player, LANE_X } from './Player.js';
import { World } from './World.js';
import { Obstacles } from './Obstacles.js';
import { Collectibles, ITEMS } from './Collectibles.js';
import { Controls } from './Controls.js';
import { UI } from './UI.js';
import { AudioManager } from './Audio.js';
import { Effects } from './Effects.js';
import { hitsObstacle, inCollectRange } from './Collision.js';

const BEST_KEY = 'lava-dash-best';
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const damp = (current, target, lambda, dt) => current + (target - current) * (1 - Math.exp(-lambda * dt));

const ITEM_COLORS = {
  shawarma: 'gold',
  burger: 'orange',
  fries: 'gold',
  drink: 'blue',
  bonus: 'orange',
};

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.state = 'loading';
    this.ready = false;
    this.elapsed = 0;
    this.best = this._loadBest();

    this.audio = new AudioManager();
    this.ui = new UI({
      initialMuted: this.audio.muted,
      onPlay: () => this.startRun(),
      onRestart: () => this.startRun(),
      onResume: () => this.resume(),
      onPause: () => this.togglePause(),
      onMenu: () => this.returnToMenu(),
      onToggleSound: () => {
        const muted = this.audio.toggleMute();
        this.ui.setMuted(muted);
        return muted;
      },
      onUiClick: () => this.audio.click(),
    });

    this.isTouch = this.ui.isTouch;
    this.autoPause = !new URLSearchParams(window.location.search).has('nopause');
    this.renderer = null;

    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch (error) {
      this.ui.setLoading(1, 'WebGL недоступен в этом браузере');
      return;
    }

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.isTouch ? 1.6 : 2));
    this.renderer.setSize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setClearColor(0x1a0d09, 1);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x2a1020);
    this.scene.fog = new THREE.Fog(0xff9a5f, 68, 195);

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 700);
    this.cameraPos = new THREE.Vector3(3.4, 2.7, 8.6);
    this.lookTarget = new THREE.Vector3(-1.9, 1.15, 0);
    this.camera.position.copy(this.cameraPos);
    this.camera.lookAt(this.lookTarget);

    this._setupLights();
    this.clock = new THREE.Clock();
    this.hudTimer = 0;

    this.world = null;
    this.player = null;
    this.obstacles = null;
    this.collectibles = null;
    this.effects = null;
    this.controls = null;

    this.speed = 0;
    this.baseSpeed = 13;
    this.maxSpeed = 27;
    this.distance = 0;
    this.points = 0;
    this.items = 0;
    this.score = 0;
    this.runTime = 0;
    this.spawnTravel = 0;
    this.crashTimer = 0;
    this.crashHandled = false;
    this.shake = 0;

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', this._onResize);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing' && this.autoPause) this.pause();
    });

    this.resize();
    this.renderer.setAnimationLoop(() => this._tick());
  }

  _setupLights() {
    const hemisphere = new THREE.HemisphereLight(0xffd7b0, 0x3a1f24, 1.6);
    this.scene.add(hemisphere);

    const sun = new THREE.DirectionalLight(0xffd2a0, 2.5);
    sun.position.set(16, 24, 10);
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0xff8a55, 0.7);
    fill.position.set(-14, 10, -16);
    this.scene.add(fill);

    this.scene.add(new THREE.AmbientLight(0xffb080, 0.34));
  }

  /* ------------------------------------------------------------------ */
  /* Загрузка                                                            */
  /* ------------------------------------------------------------------ */
  async boot() {
    if (!this.renderer) return;

    this.ui.setLoading(0.08, 'Разогреваем лаваш…');
    await this._wait(0.14);

    this.world = new World(this.scene);
    await this._wait(0.34, 'Строим улицу…');

    this.player = new Player(this.scene);
    await this._wait(0.55, 'Собираем шаурму…');

    this.obstacles = new Obstacles(this.scene);
    this.collectibles = new Collectibles(this.scene);
    this.effects = new Effects(this.scene);
    await this._wait(0.76, 'Расставляем препятствия…');

    this._setupControls();
    this._resetRun();
    this.obstacles.reset();
    this.collectibles.reset();
    await this._wait(0.94, 'Готовим полосы…');

    this.state = 'menu';
    this._snapMenuCamera();
    this.ready = true;
    this.ui.setLoading(1, 'Поехали!');
    await this._wait(1);
    this.ui.hideLoading();
    this.ui.showMenu(this.best);
  }

  _wait(progress, text = '') {
    this.ui.setLoading(progress, text);
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      // rAF нужен для отрисовки прогресса, таймер — страховка для фоновой вкладки.
      requestAnimationFrame(() => requestAnimationFrame(finish));
      window.setTimeout(finish, 180);
    });
  }

  _setupControls() {
    this.controls = new Controls({
      canvas: this.canvas,
      onLane: (direction) => {
        if (this.state !== 'playing') return;
        this.player.changeLane(direction);
      },
      onJump: () => {
        if (this.state !== 'playing') return;
        if (this.player.jump()) {
          this.audio.jump();
          this.effects.burst(this.player.x, 0.1, 0.1, 'cream', 6, 0.6);
        }
      },
      onSlide: () => {
        if (this.state !== 'playing') return;
        if (this.player.slide()) {
          this.audio.slide();
          this.effects.burst(this.player.x, 0.15, 0.2, 'brown', 8, 0.8);
        }
      },
      onPause: () => this.togglePause(),
      onMute: () => {
        const muted = this.audio.toggleMute();
        this.ui.setMuted(muted);
      },
    });
  }

  /* ------------------------------------------------------------------ */
  /* Состояния                                                           */
  /* ------------------------------------------------------------------ */
  startRun() {
    if (!this.ready) return;
    const fromCrash = this.state === 'crash' || this.state === 'gameover';
    this.audio.init();
    this.audio.startMusic();
    this._resetRun();
    this.state = 'playing';
    if (fromCrash) this._snapPlayCamera();
    this.ui.startGame();
    this.ui.setBest(this.best);
    this.hudTimer = 99;
    this.resize();
  }

  togglePause() {
    if (this.state === 'playing') this.pause();
    else if (this.state === 'paused') this.resume();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.audio.stopMusic();
    this.ui.showPause({ score: this.score, distance: this.distance });
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.audio.startMusic();
    this.ui.hidePause();
    this.clock.getDelta();
  }

  returnToMenu() {
    this.state = 'menu';
    this.audio.stopMusic();
    if (this.player) this.player.reset();
    this.obstacles?.reset();
    this.collectibles?.reset();
    this.effects?.reset();
    this.world?.reset();
    this.distance = 0;
    this.points = 0;
    this.items = 0;
    this.score = 0;
    this.speed = 0;
    this.shake = 0;
    this.ui.showMenu(this.best);
    this.ui.setBest(this.best);
  }

  _finishGame() {
    this.crashHandled = true;
    this.state = 'gameover';
    this.audio.stopMusic();

    const isRecord = this.score > this.best;
    if (isRecord) {
      this.best = this.score;
      this._saveBest(this.best);
    }

    this.ui.showGameOver({
      score: this.score,
      distance: this.distance,
      items: this.items,
      best: this.best,
      isRecord,
    });
  }

  _resetRun() {
    this.distance = 0;
    this.points = 0;
    this.items = 0;
    this.score = 0;
    this.speed = this.baseSpeed;
    this.runTime = 0;
    this.spawnTravel = 0;
    this.crashTimer = 0;
    this.crashHandled = false;
    this.shake = 0;
    this.hudTimer = 0;

    this.player?.reset();
    this.player?.setVisible(true);
    this.obstacles?.reset();
    this.collectibles?.reset();
    this.effects?.reset();
    this.world?.reset();

    this._spawnRow(-72);
    this._spawnRow(-104);
    this._spawnRow(-136);

    this.ui.updateHud({ score: 0, distance: 0, items: 0 }, true);
  }

  /* ------------------------------------------------------------------ */
  /* Игровой цикл                                                        */
  /* ------------------------------------------------------------------ */
  _tick() {
    const dt = Math.min(this.clock.getDelta(), 1 / 30);
    this.elapsed += dt;

    if (!this.ready) {
      if (this.renderer) this.renderer.render(this.scene, this.camera);
      return;
    }

    if (this.state === 'menu') {
      this._updateMenu(dt);
    } else if (this.state === 'playing') {
      this._updatePlaying(dt);
    } else if (this.state === 'crash') {
      this._updateCrash(dt);
    } else if (this.state === 'paused') {
      this._updateCamera(dt);
    } else if (this.state === 'gameover') {
      this.shake = damp(this.shake, 0, 4, dt);
      this._updateCamera(dt);
    }

    this.effects?.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  _updateMenu(dt) {
    this.world.update(dt, 3.4 * dt);
    this.player.update(dt, 3.4, 'attract');
    this._updateCamera(dt);
    this.shake = damp(this.shake, 0, 4, dt);
  }

  _updatePlaying(dt) {
    this.runTime += dt;
    const difficulty = clamp(this.distance / 2400, 0, 1);

    const targetSpeed = Math.min(this.maxSpeed, this.baseSpeed + this.distance * 0.0042);
    this.speed = damp(this.speed, targetSpeed, 1.4, dt);

    const dz = this.speed * dt;
    this.distance += dz;

    this.player.update(dt, this.speed, 'play');
    this.world.update(dt, dz);
    this.obstacles.update(dt, dz);
    this.collectibles.update(dt, dz);

    this._handlePickups(dz);
    this._handleObstacles(dz);

    if (this.state !== 'playing') return;

    this._handleSpawning(dz, difficulty);
    this._updateCamera(dt);
    this.shake = damp(this.shake, 0, 5, dt);

    this.score = Math.floor(this.distance * 1.5) + this.points;
    this.hudTimer += dt;
    if (this.hudTimer > 0.07) {
      this.hudTimer = 0;
      this.ui.updateHud({
        score: this.score,
        distance: this.distance,
        items: this.items,
      });
    }
  }

  _updateCrash(dt) {
    this.crashTimer += dt;
    this.speed = damp(this.speed, 0, 3.4, dt);
    const dz = this.speed * dt;

    this.world.update(dt, dz);
    this.player.update(dt, 0, 'crash');
    this.shake = damp(this.shake, 0, 3.2, dt);
    this._updateCamera(dt);

    if (this.crashTimer > 1.15 && !this.crashHandled) {
      this._finishGame();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Столкновения и сбор                                                 */
  /* ------------------------------------------------------------------ */
  _handleObstacles(dz) {
    const collider = this.player.getCollider();
    const swept = Math.min(dz * 0.7, 0.75);

    for (const obstacle of this.obstacles.active) {
      if (hitsObstacle(collider, obstacle, swept)) {
        this._crashInto(obstacle);
        return;
      }
    }
  }

  _handlePickups(dz) {
    const collider = this.player.getCollider();
    const swept = Math.min(dz * 0.7, 0.75);

    for (let i = this.collectibles.active.length - 1; i >= 0; i--) {
      const item = this.collectibles.active[i];
      if (inCollectRange(collider, item, swept)) {
        this._collect(item);
      }
    }
  }

  _collect(item) {
    this.collectibles.collect(item);
    this.items += 1;
    this.points += item.points;

    const color = ITEM_COLORS[item.type] || 'gold';
    this.audio.collect(item.type === 'bonus' ? 'bonus' : 'normal');
    this.effects.burst(item.x, item.baseY, 0.2, color, item.type === 'bonus' ? 18 : 9, item.type === 'bonus' ? 1.5 : 1);
    this.effects.ring(item.x, item.baseY, 0.1, item.type === 'bonus' ? 'orange' : 'gold');
    this.ui.toast(ITEMS[item.type]?.label || `+${item.points}`, item.type === 'bonus');

    if (item.type === 'bonus') this.shake = Math.max(this.shake, 0.12);
  }

  _crashInto(obstacle) {
    if (this.state !== 'playing') return;

    this.state = 'crash';
    this.crashTimer = 0;
    this.crashHandled = false;
    this.shake = 1.1;
    this.audio.crash();
    this.audio.stopMusic();
    this.player.crash();
    this.ui.hideTouch();

    // Отбрасываем препятствие в сторону, чтобы герой не лежал внутри него.
    if (obstacle && obstacle.mesh) {
      obstacle.mesh.position.x += obstacle.x >= 0 ? 1.7 : -1.7;
      obstacle.mesh.position.z += 1.5;
      obstacle.mesh.rotation.y += 0.4;
      obstacle.mesh.rotation.z = 0.18;
    }

    const hitY = clamp((obstacle.minY + obstacle.maxY) * 0.5, 0.4, 1.5);
    this.effects.burst(this.player.x, hitY, 0.4, 'orange', 20, 1.5);
    this.effects.ring(this.player.x, hitY, 0.2, 'orange');
    this.effects.burst(this.player.x, 0.2, 0.3, 'brown', 10, 1.1);
  }

  /* ------------------------------------------------------------------ */
  /* Генерация                                                           */
  /* ------------------------------------------------------------------ */
  _handleSpawning(dz, difficulty) {
    this.spawnTravel += dz;
    const gap = Math.max(18, 29 - difficulty * 9);

    if (this.spawnTravel >= gap) {
      this.spawnTravel -= gap;
      this._spawnRow(-150);
    }
  }

  _spawnRow(z) {
    const difficulty = clamp(this.distance / 2200, 0, 1);
    const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);

    const maxBlocked = difficulty < 0.08 ? 1 : Math.random() < 0.26 + difficulty * 0.42 ? 2 : 1;
    const blocked = lanes.slice(0, maxBlocked);
    const free = lanes.slice(maxBlocked);

    for (const lane of blocked) {
      const type = this._pickObstacleType(difficulty);
      this.obstacles.spawn(type, lane, z + (Math.random() - 0.5) * 1.4);
    }

    if (Math.random() < 0.9 && free.length) {
      const type = this._pickItemType();
      const lane = free[0];
      const count = Math.random() < 0.32 ? 3 : 1;
      this.collectibles.spawnLine(type, lane, z, count, 3.3);
    }

    if (free.length > 1 && Math.random() < 0.34) {
      this.collectibles.spawn(this._pickItemType(), free[1], z - 1.4);
    }

    if (Math.random() < 0.055 && free.length) {
      const lane = free[Math.floor(Math.random() * free.length)];
      this.collectibles.spawn('bonus', lane, z - 5.5);
    }
  }

  _pickObstacleType(difficulty) {
    const r = Math.random();
    if (difficulty < 0.08) return r < 0.6 ? 'cone' : 'barrier';
    if (r < 0.24) return 'cone';
    if (r < 0.46) return 'barrier';
    if (r < 0.66) return 'car';
    if (r < 0.81) return 'trash';
    if (r < 0.93) return 'overhead';
    return 'car';
  }

  _pickItemType() {
    const r = Math.random();
    if (r < 0.42) return 'shawarma';
    if (r < 0.64) return 'burger';
    if (r < 0.82) return 'fries';
    return 'drink';
  }

  /* ------------------------------------------------------------------ */
  /* Камера                                                              */
  /* ------------------------------------------------------------------ */
  _updateCamera(dt) {
    const menuMode = this.state === 'menu' || this.state === 'loading';
    const aspect = this.camera.aspect || 1;

    let px;
    let py;
    let pz;
    let lx;
    let ly;
    let lz;

    if (menuMode) {
      const narrow = aspect < 0.82;
      px = (narrow ? 3.75 : 3.4) + Math.sin(this.elapsed * 0.24) * 0.28;
      py = narrow ? 2.55 : 2.7;
      pz = narrow ? 9.4 : 8.6;
      lx = (narrow ? -1.05 : -1.9) + Math.sin(this.elapsed * 0.18) * 0.12;
      ly = 1.15 + Math.sin(this.elapsed * 0.5) * 0.045;
      lz = 0;
    } else if (this.state === 'crash' || this.state === 'gameover') {
      // Кинематографичный разворот: видно упавшего героя, а не спину препятствия.
      const side = this.player.x >= 0 ? -1 : 1;
      px = this.player.x + side * 3.4;
      py = 2.9;
      pz = -4.6;
      lx = this.player.x;
      ly = 0.75;
      lz = 0.45;
    } else {
      const speedNorm = clamp(this.speed / this.maxSpeed, 0, 1);
      px = this.player.x * 0.38;
      py = 4.1 + this.player.y * 0.12 + speedNorm * 0.06;
      pz = 7.7 - speedNorm * 0.12;
      lx = this.player.x * 0.52;
      ly = 1.3 + this.player.y * 0.12;
      lz = -9.5;
    }

    this.cameraPos.x = damp(this.cameraPos.x, px, 4.4, dt);
    this.cameraPos.y = damp(this.cameraPos.y, py, 4.4, dt);
    this.cameraPos.z = damp(this.cameraPos.z, pz, 4.4, dt);
    this.lookTarget.x = damp(this.lookTarget.x, lx, 5.2, dt);
    this.lookTarget.y = damp(this.lookTarget.y, ly, 5.2, dt);
    this.lookTarget.z = damp(this.lookTarget.z, lz, 5.2, dt);

    this.camera.position.copy(this.cameraPos);

    if (this.shake > 0.002) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.45;
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.45;
      this.camera.position.z += (Math.random() - 0.5) * this.shake * 0.2;
    }

    this.camera.lookAt(this.lookTarget);

    const targetFov = menuMode ? 52 : this.state === 'crash' || this.state === 'gameover' ? 54 : 60 + clamp(this.speed / this.maxSpeed, 0, 1) * 4;
    this.camera.fov = damp(this.camera.fov, targetFov, 3, dt);
    this.camera.updateProjectionMatrix();
  }

  _snapMenuCamera() {
    const aspect = this.camera.aspect || 1;
    const narrow = aspect < 0.82;
    this.cameraPos.set(narrow ? 3.75 : 3.4, narrow ? 2.55 : 2.7, narrow ? 9.4 : 8.6);
    this.lookTarget.set(narrow ? -1.05 : -1.9, 1.15, 0);
    this.camera.fov = 52;
    this.camera.position.copy(this.cameraPos);
    this.camera.lookAt(this.lookTarget);
    this.camera.updateProjectionMatrix();
  }

  _snapPlayCamera() {
    this.cameraPos.set(0, 4.1, 7.7);
    this.lookTarget.set(0, 1.3, -9.5);
    this.camera.fov = 60;
    this.camera.position.copy(this.cameraPos);
    this.camera.lookAt(this.lookTarget);
    this.camera.updateProjectionMatrix();
  }

  /* ------------------------------------------------------------------ */
  /* Служебное                                                           */
  /* ------------------------------------------------------------------ */
  resize() {
    if (!this.renderer) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  _loadBest() {
    try {
      const value = Number(window.localStorage.getItem(BEST_KEY));
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (error) {
      return 0;
    }
  }

  _saveBest(value) {
    try {
      window.localStorage.setItem(BEST_KEY, String(value));
    } catch (error) {
      /* ignore */
    }
  }

  getDebugState() {
    return {
      state: this.state,
      x: this.player ? Number(this.player.x.toFixed(4)) : null,
      vx: this.player ? Number(this.player.vx.toFixed(4)) : null,
      lane: this.player?.lane ?? null,
      targetX: this.player?.targetX ?? null,
      y: this.player ? Number(this.player.y.toFixed(3)) : null,
      sliding: this.player?.sliding ?? null,
      speed: Number(this.speed.toFixed(2)),
      distance: Number(this.distance.toFixed(2)),
      score: this.score,
      items: this.items,
      best: this.best,
      obstacles: this.obstacles?.active.length ?? 0,
      collectibles: this.collectibles?.active.length ?? 0,
    };
  }

  dispose() {
    if (this.renderer) this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('orientationchange', this._onResize);
    this.controls?.destroy();
    this.player?.dispose();
    this.world?.dispose();
    this.audio.dispose();
    this.renderer?.dispose();
  }
}
