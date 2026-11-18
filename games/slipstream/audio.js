// Engine pitch follows ground speed; the wind channel follows local airspeed,
// so the same-speed pass sounds different inside and outside a wake.
export function raceAudio() {
  let ctx,
    master,
    motor,
    motorGain,
    windFilter,
    windGain,
    muted = false;
  try {
    muted = localStorage.getItem('slipstream:muted') === 'true';
  } catch {}
  function unlock() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio || muted) return;
    if (!ctx) {
      ctx = new Audio();
      master = ctx.createGain();
      master.gain.value = 0.42;
      master.connect(ctx.destination);
      motor = ctx.createOscillator();
      motor.type = 'triangle';
      motorGain = ctx.createGain();
      motorGain.gain.value = 0;
      motor.connect(motorGain).connect(master);
      motor.start();
      const buffer = ctx.createBuffer(1, 2 * ctx.sampleRate, ctx.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'lowpass';
      windFilter.Q.value = 0.6;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      noise.connect(windFilter).connect(windGain).connect(master);
      noise.start();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }
  function mix(car) {
    if (!ctx) return;
    const now = ctx.currentTime;
    motorGain.gain.setTargetAtTime(car && !muted ? 0.025 : 0, now, 0.06);
    windGain.gain.setTargetAtTime(car && !muted ? Math.min(0.16, 0.0024 * car.load.speed) : 0, now, 0.06);
    if (car) {
      motor.frequency.setTargetAtTime(56 + car.v * 1.7 + (car.boosting ? 43 : 0), now, 0.09);
      windFilter.frequency.setTargetAtTime(260 + car.load.speed * 21, now, 0.12);
    }
  }
  function cue(hz, duration = 0.12) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator(),
      gain = ctx.createGain(),
      now = ctx.currentTime;
    osc.frequency.value = hz;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.11, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain).connect(master);
    osc.start();
    osc.stop(now + duration + 0.01);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }
  return {
    unlock,
    mix,
    cue,
    get muted() {
      return muted;
    },
    toggle() {
      muted = !muted;
      try {
        localStorage.setItem('slipstream:muted', String(muted));
      } catch {}
      if (muted) mix(null);
      else {
        unlock();
        cue(440);
      }
    }
  };
}
