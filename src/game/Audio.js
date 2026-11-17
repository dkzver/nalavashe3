const MUTE_KEY = 'lava-dash-muted';

const midiToFreq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

/**
 * Синтезированный звук без внешних файлов: музыка, прыжок, сбор, удар, клики.
 * AudioContext создаётся лениво — только после жеста пользователя.
 */
export class AudioManager {
  constructor() {
    this.muted = false;
    try {
      this.muted = window.localStorage.getItem(MUTE_KEY) === '1';
    } catch (error) {
      this.muted = false;
    }

    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.noiseBuffer = null;

    this.musicWanted = false;
    this.musicTimer = null;
    this.nextNoteTime = 0;
    this.step = 0;
    this.stepDuration = 60 / 124 / 4;
    this.progression = [
      { bass: 48, chord: [60, 64, 67, 72] }, // C
      { bass: 43, chord: [59, 62, 67, 71] }, // G
      { bass: 45, chord: [57, 60, 64, 69] }, // Am
      { bass: 41, chord: [57, 60, 65, 69] }, // F
    ];
  }

  get isMuted() {
    return this.muted;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }

    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;

    try {
      this.ctx = new Ctx();
    } catch (error) {
      this.ctx = null;
      return;
    }

    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.22;
    this.musicGain.connect(this.master);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.65;
    this.sfxGain.connect(this.master);

    this.noiseBuffer = this._createNoiseBuffer();
  }

  _createNoiseBuffer() {
    const length = Math.floor(this.ctx.sampleRate * 1.2);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  setMuted(muted) {
    this.muted = muted;
    try {
      window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch (error) {
      /* ignore */
    }

    if (this.master && this.ctx) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(muted ? 0 : 0.8, now, 0.05);
    }

    if (muted) {
      this._stopMusicLoop();
    } else if (this.musicWanted) {
      this._startMusicLoop();
    }
  }

  toggleMute() {
    this.init();
    this.setMuted(!this.muted);
    return this.muted;
  }

  /* ------------------------------------------------------------------ */
  /* Музыка                                                              */
  /* ------------------------------------------------------------------ */
  startMusic() {
    this.musicWanted = true;
    this.init();
    if (!this.ctx || this.muted) return;
    this._startMusicLoop();
  }

  stopMusic() {
    this.musicWanted = false;
    this._stopMusicLoop();
  }

  _startMusicLoop() {
    if (!this.ctx || this.musicTimer || this.muted) return;
    this.nextNoteTime = this.ctx.currentTime + 0.08;
    this.musicTimer = window.setInterval(() => this._scheduleMusic(), 70);
  }

  _stopMusicLoop() {
    if (this.musicTimer) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  _scheduleMusic() {
    if (!this.ctx || this.muted) return;
    while (this.nextNoteTime < this.ctx.currentTime + 0.22) {
      this._scheduleStep(this.step, this.nextNoteTime);
      this.nextNoteTime += this.stepDuration;
      this.step = (this.step + 1) % 64;
    }
  }

  _scheduleStep(step, time) {
    const bar = Math.floor(step / 16) % 4;
    const chord = this.progression[bar];
    const beat = step % 16;

    // Бас.
    if (beat % 4 === 0) {
      this._tone(midiToFreq(chord.bass + (beat === 8 ? 0 : 0)), time, 0.3, 'triangle', 0.16, this.musicGain);
    } else if (beat % 4 === 2) {
      this._tone(midiToFreq(chord.bass + 12), time, 0.14, 'sine', 0.06, this.musicGain);
    }

    // Арпеджио.
    if (beat % 2 === 0) {
      const index = (beat / 2) % chord.chord.length;
      const note = chord.chord[index] + (beat >= 8 ? 12 : 0);
      this._tone(midiToFreq(note), time, 0.12, 'square', 0.035, this.musicGain);
    }

    // Мелодия.
    if (beat === 0 || beat === 6 || beat === 10) {
      const melody = chord.chord[(beat + bar) % chord.chord.length] + 12;
      this._tone(midiToFreq(melody), time, 0.22, 'triangle', 0.07, this.musicGain);
    }

    // Ритм.
    if (beat === 0 || beat === 8) {
      this._kick(time, 0.5);
    }
    if (beat === 4 || beat === 12) {
      this._noise(time, 0.12, 1600, 0.12);
    }
    if (beat % 2 === 1) {
      this._noise(time, 0.035, 5200, 0.03);
    }
  }

  _tone(freq, time, duration, type = 'sine', volume = 0.1, destination = this.sfxGain) {
    if (!this.ctx || !destination) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(gain);
    gain.connect(destination);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  _kick(time, volume = 0.5) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.16);
    gain.gain.setValueAtTime(volume * 0.22, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + 0.2);
  }

  _noise(time, duration, cutoff = 2000, volume = 0.1) {
    if (!this.ctx || !this.noiseBuffer) return;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = cutoff;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    source.start(time);
    source.stop(time + duration + 0.02);
  }

  /* ------------------------------------------------------------------ */
  /* Эффекты                                                             */
  /* ------------------------------------------------------------------ */
  _sfxTone(freq, duration, type, volume, slideTo = null) {
    if (!this.ctx || this.muted) return;
    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, time + duration);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(time);
    osc.stop(time + duration + 0.03);
  }

  jump() {
    this.init();
    if (!this.ctx || this.muted) return;
    this._sfxTone(340, 0.18, 'sine', 0.18, 760);
    this._sfxTone(510, 0.12, 'triangle', 0.06, 900);
  }

  slide() {
    if (!this.ctx || this.muted) return;
    const time = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, time);
    filter.frequency.exponentialRampToValueAtTime(300, time + 0.3);
    filter.Q.value = 0.8;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.32);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    source.start(time);
    source.stop(time + 0.34);
  }

  collect(kind = 'normal') {
    if (!this.ctx || this.muted) return;
    if (kind === 'bonus') {
      [660, 880, 1100, 1320].forEach((freq, index) => {
        window.setTimeout(() => this._sfxTone(freq, 0.22, 'triangle', 0.12), index * 55);
      });
      return;
    }
    this._sfxTone(880, 0.09, 'sine', 0.1);
    window.setTimeout(() => this._sfxTone(1320, 0.12, 'sine', 0.08), 55);
  }

  crash() {
    this.init();
    if (!this.ctx || this.muted) return;
    const time = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2400, time);
    filter.frequency.exponentialRampToValueAtTime(180, time + 0.5);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.55);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    source.start(time);
    source.stop(time + 0.6);

    this._sfxTone(160, 0.5, 'sawtooth', 0.24, 45);
  }

  click() {
    this.init();
    if (!this.ctx || this.muted) return;
    this._sfxTone(620, 0.06, 'square', 0.045, 520);
  }

  dispose() {
    this._stopMusicLoop();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
