import * as THREE from 'three';

const cache = new Map();

function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function toTexture(canvas, { repeatX = 1, repeatY = 1 } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 4;
  return texture;
}

function cached(key, factory) {
  if (!cache.has(key)) cache.set(key, factory());
  return cache.get(key);
}

/* ------------------------------------------------------------------ */
/* Лаваш                                                              */
/* ------------------------------------------------------------------ */
export function getLavashTexture() {
  return cached('lavash', () => {
    const canvas = createCanvas(512, 512);
    const ctx = canvas.getContext('2d');

    const base = ctx.createLinearGradient(0, 0, 512, 512);
    base.addColorStop(0, '#f0c078');
    base.addColorStop(0.45, '#e2ab5f');
    base.addColorStop(1, '#d99a4b');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 512, 512);

    // Диагональные полосы закрутки лаваша.
    ctx.lineWidth = 22;
    for (let i = -8; i < 20; i++) {
      const offset = i * 46;
      ctx.beginPath();
      ctx.moveTo(offset, 512);
      ctx.bezierCurveTo(offset + 90, 340, offset + 130, 190, offset + 240, 0);
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(176, 115, 48, 0.35)' : 'rgba(250, 214, 153, 0.3)';
      ctx.stroke();
    }

    // Поджаристые пятна.
    for (let i = 0; i < 46; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = 3 + Math.random() * 15;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(120, 68, 22, 0.35)');
      grad.addColorStop(1, 'rgba(120, 68, 22, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Крошки и зерно.
    for (let i = 0; i < 220; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255, 235, 190, 0.4)' : 'rgba(150, 95, 35, 0.22)';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }

    return toTexture(canvas, { repeatX: 1, repeatY: 1 });
  });
}

/* ------------------------------------------------------------------ */
/* Фирменная лента на упаковке                                        */
/* ------------------------------------------------------------------ */
export function getBrandBandTexture() {
  return cached('brand-band', () => {
    const canvas = createCanvas(1024, 128);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#fff1d2';
    ctx.fillRect(0, 0, 1024, 128);

    ctx.fillStyle = '#e8451a';
    ctx.fillRect(0, 0, 1024, 12);
    ctx.fillRect(0, 116, 1024, 12);

    ctx.fillStyle = '#241009';
    ctx.font = '900 52px "Arial Black", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("НА LAVA'ШЕ", 512, 64);

    ctx.fillStyle = '#e8451a';
    ctx.font = '900 30px Arial, sans-serif';
    ctx.fillText('★', 120, 64);
    ctx.fillText('★', 904, 64);

    return toTexture(canvas, { repeatX: 2, repeatY: 1 });
  });
}

/* ------------------------------------------------------------------ */
/* Фасады зданий                                                      */
/* ------------------------------------------------------------------ */
const FACADES = [
  { key: 'terracotta', base: '#8b4f38', trim: '#c9835c' },
  { key: 'teal', base: '#425b5c', trim: '#7fa09c' },
  { key: 'mustard', base: '#8c6437', trim: '#c99a5d' },
  { key: 'plum', base: '#5c3f4d', trim: '#96718a' },
];

export function getFacadeTextures() {
  return cached('facades', () =>
    FACADES.map(({ key, base, trim }) => {
      const canvas = createCanvas(512, 512);
      const ctx = canvas.getContext('2d');

      const grad = ctx.createLinearGradient(0, 0, 0, 512);
      grad.addColorStop(0, base);
      grad.addColorStop(1, '#2a1a16');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 512);

      // Швы кладки.
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.lineWidth = 2;
      for (let y = 0; y < 512; y += 42) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(512, y);
        ctx.stroke();
      }
      for (let y = 0; y < 512; y += 42) {
        for (let x = (y / 42) % 2 === 0 ? 0 : 46; x < 512; x += 92) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + 42);
          ctx.stroke();
        }
      }

      // Окна.
      const cols = 4;
      const rows = 6;
      const marginX = 34;
      const marginTop = 38;
      const cellW = (512 - marginX * 2) / cols;
      const cellH = (512 - marginTop - 44) / rows;
      const winW = cellW * 0.56;
      const winH = cellH * 0.62;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = marginX + col * cellW + (cellW - winW) / 2;
          const y = marginTop + row * cellH + (cellH - winH) / 2;

          ctx.fillStyle = 'rgba(22, 14, 12, 0.85)';
          ctx.fillRect(x - 5, y - 5, winW + 10, winH + 10);

          const lit = Math.random() > 0.45;
          if (lit) {
            const wg = ctx.createLinearGradient(x, y, x, y + winH);
            wg.addColorStop(0, 'rgba(255, 226, 150, 0.98)');
            wg.addColorStop(1, 'rgba(255, 168, 74, 0.85)');
            ctx.fillStyle = wg;
          } else {
            const wg = ctx.createLinearGradient(x, y, x, y + winH);
            wg.addColorStop(0, '#2a2a33');
            wg.addColorStop(1, '#12141a');
            ctx.fillStyle = wg;
          }
          ctx.fillRect(x, y, winW, winH);

          if (lit) {
            ctx.fillStyle = 'rgba(60, 30, 12, 0.28)';
            ctx.fillRect(x, y + winH * 0.55, winW, 2);
            ctx.fillRect(x + winW * 0.48, y, 2, winH);
          }

          // Цветочный ящик.
          if (row % 2 === 0 && Math.random() > 0.5) {
            ctx.fillStyle = '#3a2118';
            ctx.fillRect(x - 6, y + winH + 5, winW + 12, 8);
            ctx.fillStyle = '#7fae4e';
            for (let f = 0; f < 4; f++) {
              ctx.beginPath();
              ctx.arc(x + 8 + f * (winW / 4), y + winH + 3, 4, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }

      // Потёки и грязь.
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = `rgba(20, 10, 6, ${0.04 + Math.random() * 0.08})`;
        ctx.fillRect(Math.random() * 512, Math.random() * 380, 3 + Math.random() * 16, 60 + Math.random() * 120);
      }

      // Карниз.
      ctx.fillStyle = trim;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(0, 0, 512, 14);
      ctx.globalAlpha = 1;

      const texture = toTexture(canvas);
      texture.userData = { key };
      return texture;
    }),
  );
}

/* ------------------------------------------------------------------ */
/* Вывески                                                            */
/* ------------------------------------------------------------------ */
export function getSignTexture(text, { accent = '#ff5a1f', width = 1024, height = 320 } = {}) {
  return cached(`sign:${text}:${accent}:${width}x${height}`, () => {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, '#2a130c');
    bg.addColorStop(1, '#140a07');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(6, 6, width - 12, height - 12, 28);
    ctx.fill();

    ctx.lineWidth = 8;
    ctx.strokeStyle = accent;
    ctx.beginPath();
    ctx.roundRect(16, 16, width - 32, height - 32, 22);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.round(height * 0.4)}px "Arial Black", Arial, sans-serif`;

    const textGrad = ctx.createLinearGradient(0, height * 0.22, 0, height * 0.78);
    textGrad.addColorStop(0, '#fff8e2');
    textGrad.addColorStop(0.55, '#ffd166');
    textGrad.addColorStop(1, accent);
    ctx.fillStyle = textGrad;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 34;
    ctx.fillText(text, width / 2, height * 0.52);
    ctx.shadowBlur = 0;

    ctx.strokeStyle = 'rgba(80, 20, 4, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeText(text, width / 2, height * 0.52);

    return toTexture(canvas);
  });
}

export function getBannerTexture() {
  return cached('banner', () => {
    const canvas = createCanvas(1024, 256);
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#ff7a2e');
    grad.addColorStop(1, '#d93b0d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 256);

    ctx.strokeStyle = 'rgba(255, 244, 226, 0.65)';
    ctx.lineWidth = 10;
    ctx.strokeRect(16, 16, 1024 - 32, 256 - 32);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff6e2';
    ctx.font = '900 104px "Arial Black", Arial, sans-serif';
    ctx.fillText('LAVA DASH', 512, 108);
    ctx.font = '800 34px Arial, sans-serif';
    ctx.fillStyle = '#4a1c09';
    ctx.fillText("НА LAVA'ШЕ · БЕГИ ЗА ШАУРМОЙ", 512, 196);

    return toTexture(canvas);
  });
}

/* ------------------------------------------------------------------ */
/* Дорога, тротуар                                                    */
/* ------------------------------------------------------------------ */
export function getRoadTexture() {
  return cached('road', () => {
    const canvas = createCanvas(256, 256);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#342c28';
    ctx.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 2400; i++) {
      const g = 32 + Math.random() * 42;
      ctx.fillStyle = `rgba(${g + 12}, ${g + 6}, ${g}, ${0.14 + Math.random() * 0.3})`;
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }

    // Пятна и трещины.
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = `rgba(12, 9, 8, ${0.1 + Math.random() * 0.15})`;
      ctx.beginPath();
      ctx.ellipse(Math.random() * 256, Math.random() * 256, 12 + Math.random() * 26, 6 + Math.random() * 16, Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(10, 8, 7, 0.4)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      let x = Math.random() * 256;
      let y = Math.random() * 256;
      ctx.moveTo(x, y);
      for (let s = 0; s < 5; s++) {
        x += (Math.random() - 0.5) * 40;
        y += Math.random() * 26;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    return toTexture(canvas, { repeatX: 2, repeatY: 10 });
  });
}

export function getSidewalkTexture() {
  return cached('sidewalk', () => {
    const canvas = createCanvas(256, 256);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#9d7d64';
    ctx.fillRect(0, 0, 256, 256);

    const tile = 64;
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const shade = 150 + Math.floor(Math.random() * 26);
        ctx.fillStyle = `rgb(${shade + 18}, ${shade - 18}, ${shade - 48})`;
        ctx.fillRect(x * tile + 3, y * tile + 3, tile - 6, tile - 6);
      }
    }
    ctx.strokeStyle = 'rgba(70, 46, 32, 0.5)';
    ctx.lineWidth = 4;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * tile);
      ctx.lineTo(256, i * tile);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(i * tile, 0);
      ctx.lineTo(i * tile, 256);
      ctx.stroke();
    }
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = `rgba(60, 40, 28, ${Math.random() * 0.12})`;
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    return toTexture(canvas, { repeatX: 2, repeatY: 8 });
  });
}

/* ------------------------------------------------------------------ */
/* Витрина и мягкое свечение                                          */
/* ------------------------------------------------------------------ */
export function getShopWindowTexture() {
  return cached('shop-window', () => {
    const canvas = createCanvas(512, 256);
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#ffdda0');
    grad.addColorStop(1, '#ff9b3d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);

    ctx.fillStyle = 'rgba(40, 18, 8, 0.55)';
    ctx.fillRect(0, 0, 512, 18);
    ctx.fillRect(0, 238, 512, 18);
    ctx.fillRect(248, 18, 16, 220);

    // Силуэты еды на витрине.
    ctx.fillStyle = 'rgba(110, 48, 20, 0.35)';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(60 + i * 96, 190, 34, 20, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    return toTexture(canvas);
  });
}

export function getGlowTexture() {
  return cached('glow', () => {
    const canvas = createCanvas(128, 128);
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255, 236, 180, 1)');
    grad.addColorStop(0.35, 'rgba(255, 170, 70, 0.55)');
    grad.addColorStop(1, 'rgba(255, 120, 30, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    return toTexture(canvas);
  });
}

/* ------------------------------------------------------------------ */
/* Логотип для 3D-вывески                                              */
/* ------------------------------------------------------------------ */
export function getRoadSignTexture() {
  return cached('road-sign', () => {
    const canvas = createCanvas(256, 256);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 256);

    ctx.fillStyle = '#f7f1e4';
    ctx.beginPath();
    ctx.arc(128, 128, 120, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#d3352a';
    ctx.lineWidth = 20;
    ctx.beginPath();
    ctx.arc(128, 128, 108, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#241611';
    ctx.font = '900 108px "Arial Black", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('30', 128, 136);

    return toTexture(canvas);
  });
}

export function getBackBadgeTexture() {
  return cached('back-badge', () => {
    const canvas = createCanvas(256, 256);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 256);

    const grad = ctx.createLinearGradient(0, 40, 0, 220);
    grad.addColorStop(0, '#ff8a3d');
    grad.addColorStop(1, '#e03a0c');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(128, 128, 108, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#fff1d2';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(128, 128, 98, 0, Math.PI * 2);
    ctx.stroke();

    // Огонёк.
    ctx.fillStyle = '#fff1d2';
    ctx.beginPath();
    ctx.moveTo(128, 52);
    ctx.bezierCurveTo(150, 82, 142, 96, 152, 112);
    ctx.bezierCurveTo(166, 132, 158, 158, 128, 168);
    ctx.bezierCurveTo(98, 158, 90, 132, 104, 112);
    ctx.bezierCurveTo(114, 96, 106, 82, 128, 52);
    ctx.fill();

    ctx.fillStyle = '#e03a0c';
    ctx.beginPath();
    ctx.ellipse(128, 140, 16, 22, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff1d2';
    ctx.font = '900 30px "Arial Black", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("LAVA'ШЕ", 128, 200);

    return toTexture(canvas);
  });
}

export function getLogoTexture() {
  return cached('logo', () => {
    const canvas = createCanvas(768, 256);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 768, 256);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 120px "Arial Black", Arial, sans-serif';

    const grad = ctx.createLinearGradient(0, 50, 0, 200);
    grad.addColorStop(0, '#fff6dd');
    grad.addColorStop(0.5, '#ffc247');
    grad.addColorStop(1, '#ff5a1f');
    ctx.fillStyle = grad;
    ctx.shadowColor = 'rgba(255, 90, 31, 0.9)';
    ctx.shadowBlur = 28;
    ctx.fillText('LAVA DASH', 384, 120);
    ctx.shadowBlur = 0;

    ctx.font = '800 36px Arial, sans-serif';
    ctx.fillStyle = '#ffe4b0';
    ctx.fillText("НА LAVA'ШЕ", 384, 210);

    return toTexture(canvas);
  });
}
