import './style.css';
import { Game } from './game/Game.js';

const canvas = document.getElementById('game-canvas');
const game = new Game(canvas);

// Удобная точка входа для отладки и автотестов.
window.__lava = game;

game.boot().catch((error) => {
  console.error('[LAVA DASH] Ошибка запуска:', error);
  const loadingText = document.getElementById('loading-text');
  const bar = document.getElementById('loader-bar');
  if (loadingText) loadingText.textContent = 'Не удалось запустить игру. Обновите страницу.';
  if (bar) bar.style.width = '100%';
});
