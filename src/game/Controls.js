export class Controls {
  constructor({ canvas, onLane, onJump, onSlide, onPause, onMute }) {
    this.canvas = canvas;
    this.onLane = onLane;
    this.onJump = onJump;
    this.onSlide = onSlide;
    this.onPause = onPause;
    this.onMute = onMute;

    this.pointer = null;
    this.buttons = [];
    this._bound = [];

    this._bindKeyboard();
    this._bindTouchButtons();
    this._bindSwipe();
  }

  _bind(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this._bound.push(() => target.removeEventListener(type, handler, options));
  }

  _bindKeyboard() {
    this._bind(window, 'keydown', (event) => {
      if (event.repeat) return;

      switch (event.code) {
        case 'ArrowLeft':
        case 'KeyA':
          event.preventDefault();
          this.onLane(-1);
          break;
        case 'ArrowRight':
        case 'KeyD':
          event.preventDefault();
          this.onLane(1);
          break;
        case 'ArrowUp':
        case 'KeyW':
        case 'Space':
          event.preventDefault();
          this.onJump();
          break;
        case 'ArrowDown':
        case 'KeyS':
          event.preventDefault();
          this.onSlide();
          break;
        case 'KeyP':
        case 'Escape':
          event.preventDefault();
          this.onPause();
          break;
        case 'KeyM':
          event.preventDefault();
          this.onMute();
          break;
        default:
          break;
      }
    });
  }

  _bindTouchButtons() {
    const buttons = document.querySelectorAll('[data-control]');
    buttons.forEach((button) => {
      const action = button.dataset.control;
      this.buttons.push(button);

      const press = (event) => {
        event.preventDefault();
        event.stopPropagation();
        button.classList.add('is-pressed');
        if (navigator.vibrate) navigator.vibrate(8);

        if (action === 'left') this.onLane(-1);
        else if (action === 'right') this.onLane(1);
        else if (action === 'jump') this.onJump();
        else if (action === 'slide') this.onSlide();
      };

      const release = (event) => {
        event.preventDefault();
        button.classList.remove('is-pressed');
      };

      button.addEventListener('pointerdown', press);
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('pointerleave', release);
      button.addEventListener('contextmenu', (event) => event.preventDefault());
    });
  }

  _bindSwipe() {
    const canvas = this.canvas;

    const down = (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      this.pointer = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        startX: event.clientX,
        startY: event.clientY,
        time: performance.now(),
        triggered: false,
        type: event.pointerType,
      };
      if (canvas.setPointerCapture) {
        try {
          canvas.setPointerCapture(event.pointerId);
        } catch (error) {
          /* ignore */
        }
      }
    };

    const move = (event) => {
      const pointer = this.pointer;
      if (!pointer || pointer.id !== event.pointerId || pointer.triggered) return;

      const dx = event.clientX - pointer.startX;
      const dy = event.clientY - pointer.startY;
      const threshold = 26;

      if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;

      pointer.triggered = true;

      if (Math.abs(dx) > Math.abs(dy)) {
        this.onLane(dx > 0 ? 1 : -1);
      } else if (dy < 0) {
        this.onJump();
      } else {
        this.onSlide();
      }
    };

    const up = (event) => {
      const pointer = this.pointer;
      if (!pointer || pointer.id !== event.pointerId) return;

      const dx = event.clientX - pointer.startX;
      const dy = event.clientY - pointer.startY;
      const distance = Math.hypot(dx, dy);
      const elapsed = performance.now() - pointer.time;

      if (!pointer.triggered && pointer.type === 'touch' && distance < 14 && elapsed < 300) {
        this.onJump();
      }

      this.pointer = null;
    };

    this._bind(canvas, 'pointerdown', down);
    this._bind(canvas, 'pointermove', move);
    this._bind(canvas, 'pointerup', up);
    this._bind(canvas, 'pointercancel', () => {
      this.pointer = null;
    });
    this._bind(canvas, 'contextmenu', (event) => event.preventDefault());
  }

  destroy() {
    this._bound.forEach((unbind) => unbind());
    this._bound.length = 0;
    this.buttons.forEach((button) => button.classList.remove('is-pressed'));
  }
}
