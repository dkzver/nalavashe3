import * as THREE from 'three';
import { getGlowTexture } from './textures.js';

const COLORS = {
  gold: 0xffc247,
  orange: 0xff5a1f,
  cream: 0xfff1d2,
  green: 0x8ed05a,
  red: 0xe4472e,
  blue: 0x7fd6e8,
  brown: 0x8a5a34,
};

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'effects';
    scene.add(this.group);

    this.particles = [];
    this.rings = [];
    this.particleGeo = new THREE.OctahedronGeometry(0.09, 0);
    this.materials = {};
    Object.entries(COLORS).forEach(([key, color]) => {
      this.materials[key] = new THREE.MeshBasicMaterial({ color, toneMapped: false });
    });

    this.ringTexture = getGlowTexture();
  }

  burst(x, y, z, color = 'gold', count = 10, power = 1) {
    const material = this.materials[color] || this.materials.gold;
    for (let i = 0; i < count; i++) {
      let particle = this.particles.find((p) => !p.active);
      if (!particle) {
        if (this.particles.length >= 64) break;
        const mesh = new THREE.Mesh(this.particleGeo, material);
        particle = { mesh, active: false, velocity: new THREE.Vector3(), life: 0, maxLife: 1 };
        this.particles.push(particle);
        this.group.add(mesh);
      }

      particle.active = true;
      particle.mesh.visible = true;
      particle.mesh.material = material;
      particle.mesh.position.set(x + (Math.random() - 0.5) * 0.3, y + (Math.random() - 0.5) * 0.3, z + (Math.random() - 0.5) * 0.3);
      particle.mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      particle.mesh.scale.setScalar(0.8 + Math.random() * 0.9);
      particle.velocity.set(
        (Math.random() - 0.5) * 7 * power,
        (Math.random() * 6 + 2.2) * power,
        (Math.random() - 0.5) * 7 * power,
      );
      particle.life = 0;
      particle.maxLife = 0.5 + Math.random() * 0.4;
    }
  }

  ring(x, y, z, color = 'gold') {
    let ring = this.rings.find((item) => !item.active);
    if (!ring) {
      if (this.rings.length >= 8) return;
      const material = new THREE.SpriteMaterial({
        map: this.ringTexture,
        color: 0xffffff,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const sprite = new THREE.Sprite(material);
      ring = { sprite, active: false, life: 0, maxLife: 0.45 };
      this.rings.push(ring);
      this.group.add(sprite);
    }

    ring.active = true;
    ring.life = 0;
    ring.maxLife = 0.45;
    ring.sprite.visible = true;
    ring.sprite.position.set(x, y, z);
    ring.sprite.scale.set(0.5, 0.5, 1);
    ring.sprite.material.color.setHex(COLORS[color] || COLORS.gold);
    ring.sprite.material.opacity = 0.9;
  }

  update(dt) {
    for (const particle of this.particles) {
      if (!particle.active) continue;
      particle.life += dt;
      const t = particle.life / particle.maxLife;
      if (t >= 1) {
        particle.active = false;
        particle.mesh.visible = false;
        continue;
      }
      particle.velocity.y -= 19 * dt;
      particle.mesh.position.addScaledVector(particle.velocity, dt);
      particle.mesh.rotation.x += dt * 6;
      particle.mesh.rotation.y += dt * 8;
      particle.mesh.scale.setScalar((1 - t) * 1.2 + 0.1);
    }

    for (const ring of this.rings) {
      if (!ring.active) continue;
      ring.life += dt;
      const t = ring.life / ring.maxLife;
      if (t >= 1) {
        ring.active = false;
        ring.sprite.visible = false;
        continue;
      }
      const scale = 0.5 + t * 2.6;
      ring.sprite.scale.set(scale, scale, 1);
      ring.sprite.material.opacity = 0.85 * (1 - t);
    }
  }

  reset() {
    this.particles.forEach((particle) => {
      particle.active = false;
      particle.mesh.visible = false;
    });
    this.rings.forEach((ring) => {
      ring.active = false;
      ring.sprite.visible = false;
    });
  }
}
