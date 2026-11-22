export function createAudio() {
  let ctx = null;
  let enabled = true;
  let siren = null;
  let sirenGain = null;
  let engine = null;
  let engineGain = null;
  let radio = null;
  let city = null;

  function context() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, gainValue) {
    if (!enabled) return;
    const ac = context();
    if (!ac) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = gainValue;
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    osc.stop(ac.currentTime + dur);
  }

  return {
    resume() {
      context();
    },
    toggle() {
      enabled = !enabled;
      if (!enabled) {
        if (sirenGain) sirenGain.gain.value = 0;
        if (engineGain) engineGain.gain.value = 0;
      }
      return enabled;
    },
    get enabled() {
      return enabled;
    },
    coin() {
      tone(880, 0.08, 'square', 0.03);
      setTimeout(() => tone(1320, 0.1, 'square', 0.03), 70);
    },
    success() {
      tone(523, 0.12, 'triangle', 0.04);
      setTimeout(() => tone(659, 0.12, 'triangle', 0.04), 110);
      setTimeout(() => tone(784, 0.2, 'triangle', 0.04), 220);
    },
    fail() {
      tone(196, 0.25, 'sawtooth', 0.03);
    },
    horn() {
      tone(440, 0.18, 'square', 0.035);
    },
    shot(kind) {
      if (kind === 'rifle') tone(140, 0.05, 'square', 0.03);
      else if (kind === 'fist') tone(90, 0.06, 'triangle', 0.02);
      else tone(320, 0.06, 'square', 0.028);
    },
    buy() {
      tone(660, 0.08, 'triangle', 0.03);
    },
    setSiren(level) {
      if (!enabled || level <= 0) {
        if (sirenGain && ctx) sirenGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
        return;
      }
      const ac = context();
      if (!ac) return;
      if (!siren) {
        siren = ac.createOscillator();
        siren.type = 'sawtooth';
        siren.frequency.value = 620;
        sirenGain = ac.createGain();
        sirenGain.gain.value = 0;
        siren.connect(sirenGain);
        sirenGain.connect(ac.destination);
        siren.start();
      }
      const target = 0.008 + level * 0.004;
      sirenGain.gain.linearRampToValueAtTime(target, ac.currentTime + 0.1);
      siren.frequency.setValueAtTime(560 + Math.sin(ac.currentTime * 8) * 180, ac.currentTime);
    },
    setEngine(speed) {
      if (!enabled || speed < 0.4) {
        if (engineGain && ctx) engineGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
        return;
      }
      const ac = context();
      if (!ac) return;
      if (!engine) {
        engine = ac.createOscillator();
        engine.type = 'triangle';
        engineGain = ac.createGain();
        engineGain.gain.value = 0;
        engine.connect(engineGain);
        engineGain.connect(ac.destination);
        engine.start();
      }
      engine.frequency.setTargetAtTime(48 + Math.min(80, speed * 3.2), ac.currentTime, 0.1);
      engineGain.gain.setTargetAtTime(0.018, ac.currentTime, 0.1);
    },
    setBed(mode) {
      if (!enabled || mode === 'off') {
        if (radio && ctx) radio.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.1);
        if (city && ctx) city.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.1);
        return;
      }
      const ac = context();
      if (!ac) return;
      if (!radio) {
        const gain = ac.createGain();
        gain.gain.value = 0;
        const filter = ac.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 900;
        gain.connect(filter);
        filter.connect(ac.destination);
        const oscs = [196, 247, 294].map((freq) => {
          const osc = ac.createOscillator();
          osc.type = 'triangle';
          osc.frequency.value = freq;
          osc.connect(gain);
          osc.start();
          return osc;
        });
        radio = { gain, oscs };
      }
      if (!city) {
        const gain = ac.createGain();
        gain.gain.value = 0;
        const osc = ac.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 82;
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start();
        city = { gain, osc };
      }
      const inCar = mode === 'car';
      radio.gain.gain.setTargetAtTime(inCar ? 0.012 : 0.0001, ac.currentTime, 0.2);
      city.gain.gain.setTargetAtTime(mode === 'foot' ? 0.01 : 0.0001, ac.currentTime, 0.25);
    },
  };
}
