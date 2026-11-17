const fmt = new Intl.NumberFormat('ru-RU');

const $ = (id) => document.getElementById(id);

export class UI {
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.isTouch =
      window.matchMedia('(pointer: coarse)').matches ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0;

    this.el = {
      loading: $('loading-screen'),
      loaderBar: $('loader-bar'),
      loadingText: $('loading-text'),
      menu: $('menu-screen'),
      menuBest: $('menu-best'),
      hud: $('hud'),
      hudScore: $('hud-score'),
      hudDistance: $('hud-distance'),
      hudItems: $('hud-items'),
      hudToast: $('hud-toast'),
      touch: $('touch-controls'),
      pause: $('pause-screen'),
      pauseScore: $('pause-score'),
      pauseDistance: $('pause-distance'),
      gameover: $('gameover-screen'),
      gameoverTitle: $('gameover-title'),
      resultScore: $('result-score'),
      resultDistance: $('result-distance'),
      resultItems: $('result-items'),
      resultBest: $('result-best'),
      resultRecord: $('result-record'),
      howto: $('howto-screen'),
      canvas: $('game-canvas'),
    };

    this.lastScore = -1;
    this.toastTimer = null;

    this._bind();
    this.setMuted(this.handlers.initialMuted ?? false);
  }

  _bind() {
    const bind = (id, event, fn) => {
      const element = $(id);
      if (element) element.addEventListener(event, fn);
    };

    bind('btn-play', 'click', () => this.handlers.onPlay?.());
    bind('btn-play-again', 'click', () => this.handlers.onRestart?.());
    bind('btn-menu', 'click', () => this.handlers.onMenu?.());
    bind('btn-pause', 'click', () => this.handlers.onPause?.());
    bind('btn-resume', 'click', () => this.handlers.onResume?.());
    bind('btn-restart-pause', 'click', () => this.handlers.onRestart?.());

    bind('btn-howto', 'click', () => this.showHowTo());
    bind('btn-howto-close', 'click', () => this.hideHowTo());
    bind('btn-howto-play', 'click', () => {
      this.hideHowTo();
      this.handlers.onPlay?.();
    });

    const toggleSound = () => {
      const muted = this.handlers.onToggleSound?.();
      if (typeof muted === 'boolean') this.setMuted(muted);
    };
    bind('menu-sound', 'click', toggleSound);
    bind('pause-sound', 'click', toggleSound);

    // Звук клика по любому элементу управления.
    document.addEventListener('click', (event) => {
      const target = event.target.closest('button, a, [data-control]');
      if (target && !target.classList.contains('touch-btn')) {
        this.handlers.onUiClick?.();
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Загрузка и меню                                                     */
  /* ------------------------------------------------------------------ */
  setLoading(progress, text) {
    if (this.el.loaderBar) this.el.loaderBar.style.width = `${Math.round(progress * 100)}%`;
    if (text && this.el.loadingText) this.el.loadingText.textContent = text;
  }

  hideLoading() {
    this.el.loading?.classList.add('hidden');
  }

  showMenu(best = 0) {
    this.setBest(best);
    this.el.menu?.classList.remove('hidden');
    this.el.hud?.classList.add('hidden');
    this.el.gameover?.classList.add('hidden');
    this.el.pause?.classList.add('hidden');
    this.el.howto?.classList.add('hidden');
    this.hideTouch();
  }

  hideMenu() {
    this.el.menu?.classList.add('hidden');
  }

  setBest(best) {
    if (this.el.menuBest) this.el.menuBest.textContent = fmt.format(best);
  }

  /* ------------------------------------------------------------------ */
  /* Игра                                                                */
  /* ------------------------------------------------------------------ */
  startGame() {
    this.hideMenu();
    this.el.gameover?.classList.add('hidden');
    this.el.pause?.classList.add('hidden');
    this.el.howto?.classList.add('hidden');
    this.el.hud?.classList.remove('hidden');
    this.el.hudToast?.classList.remove('show');
    this.lastScore = -1;
    this.updateHud({ score: 0, distance: 0, items: 0 }, true);
    if (this.isTouch) this.showTouch();
  }

  updateHud({ score, distance, items }, force = false) {
    if (this.el.hudScore) {
      if (force || score !== this.lastScore) {
        this.el.hudScore.textContent = fmt.format(score);
        if (!force) {
          this.el.hudScore.classList.remove('is-bumped');
          void this.el.hudScore.offsetWidth;
          this.el.hudScore.classList.add('is-bumped');
        }
        this.lastScore = score;
      }
    }
    if (this.el.hudDistance) this.el.hudDistance.textContent = `${fmt.format(Math.floor(distance))} м`;
    if (this.el.hudItems) this.el.hudItems.textContent = fmt.format(items);
  }

  toast(text, isBonus = false) {
    const element = this.el.hudToast;
    if (!element) return;
    element.textContent = text;
    element.classList.remove('show', 'bonus');
    void element.offsetWidth;
    if (isBonus) element.classList.add('bonus');
    element.classList.add('show');

    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      element.classList.remove('show', 'bonus');
    }, 780);
  }

  /* ------------------------------------------------------------------ */
  /* Пауза и конец игры                                                  */
  /* ------------------------------------------------------------------ */
  showPause({ score, distance }) {
    if (this.el.pauseScore) this.el.pauseScore.textContent = fmt.format(score);
    if (this.el.pauseDistance) this.el.pauseDistance.textContent = `${fmt.format(Math.floor(distance))} м`;
    this.el.pause?.classList.remove('hidden');
    this.hideTouch();
  }

  hidePause() {
    this.el.pause?.classList.add('hidden');
    if (this.isTouch) this.showTouch();
  }

  showGameOver({ score, distance, items, best, isRecord }) {
    this.el.hud?.classList.add('hidden');
    this.hideTouch();
    this.el.gameover?.classList.remove('hidden');
    this.setBest(best);

    if (this.el.resultScore) this.el.resultScore.textContent = fmt.format(score);
    if (this.el.resultDistance) this.el.resultDistance.textContent = `${fmt.format(Math.floor(distance))} м`;
    if (this.el.resultItems) this.el.resultItems.textContent = fmt.format(items);
    if (this.el.resultBest) this.el.resultBest.textContent = fmt.format(best);
    if (this.el.resultRecord) this.el.resultRecord.classList.toggle('hidden', !isRecord);
    if (this.el.gameoverTitle) this.el.gameoverTitle.textContent = 'ЕЩЁ РАЗОК?';
  }

  /* ------------------------------------------------------------------ */
  /* Прочее                                                             */
  /* ------------------------------------------------------------------ */
  showHowTo() {
    this.el.howto?.classList.remove('hidden');
  }

  hideHowTo() {
    this.el.howto?.classList.add('hidden');
  }

  showTouch() {
    this.el.touch?.classList.remove('hidden');
  }

  hideTouch() {
    this.el.touch?.classList.add('hidden');
  }

  setMuted(muted) {
    document.body.classList.toggle('is-muted', muted);
    document.querySelectorAll('.sound-btn').forEach((button) => {
      button.setAttribute('aria-pressed', String(muted));
    });
  }

  setMenuVisible(visible) {
    this.el.menu?.classList.toggle('hidden', !visible);
  }
}
