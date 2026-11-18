import { OrbitRun } from './orbit.js';
import { Scene } from './scene.js';

const bestKey = 'pocket-cabinet:orbit-hop:best';
const soundKey = 'pocket-cabinet:orbit-hop:sound';
const get = id => document.getElementById(id);
const canvas = document.querySelector('canvas');
const run = new OrbitRun();
const scene = new Scene(canvas, matchMedia('(prefers-reduced-motion: reduce)').matches);
let paused = false;
let previousTime = null;
let pendingFrame = 0;
let audio;

function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, value); } catch { /* Play continues in memory. */ }
}
let best = Math.max(0, Number.parseInt(read(bestKey), 10) || 0);
let soundOn = read(soundKey) === 'on';
let personalBest = false;

function enableAudio() {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context || !soundOn) return;
  try {
    audio ??= new Context();
    if (audio.state === 'suspended') audio.resume().catch(() => {});
  } catch { /* Audio is optional. */ }
}

function tone(from, to, length, delay = 0) {
  if (!soundOn || audio?.state !== 'running') return;
  const oscillator = audio.createOscillator(), gain = audio.createGain();
  const start = audio.currentTime + delay, end = start + length;
  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(from, start);
  oscillator.frequency.exponentialRampToValueAtTime(to, end);
  gain.gain.setValueAtTime(0.001, start);
  gain.gain.exponentialRampToValueAtTime(0.095, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, end);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(start);
  oscillator.stop(end);
}

function setSignal() {
  const signal = get('signal');
  const locked = !paused && run.phase === 'aim' && run.alignment.locked;
  const label = paused ? 'Paused' : ({
    ready: 'Ready', aim: locked ? 'On target' : 'In orbit', flight: 'In flight', over: 'Run ended'
  })[run.phase];
  if (signal.textContent !== label) {
    signal.textContent = label;
    if (locked) tone(650, 760, 0.06);
  }
  signal.classList.toggle('locked', locked);
}

function updateDisplay() {
  const phase = paused ? 'paused' : run.phase;
  const content = {
    ready: ['Start game', 'Launch when the dotted line points at the next planet.'],
    aim: ['Launch', 'Aim the dotted line through the next planet’s orbit.'],
    flight: ['Flying', 'Catch the next orbit to score a hop.'],
    paused: ['Resume', 'Resume when you’re ready to launch.'],
    over: ['Play again', 'Start a fresh run from the first planet.']
  }[phase];
  get('action').firstChild.textContent = content[0] + ' ';
  get('action').disabled = phase === 'flight';
  get('hint').textContent = content[1];
  get('score').textContent = String(run.score).padStart(2, '0');
  get('best').textContent = String(best).padStart(2, '0');
  get('sound').textContent = soundOn ? 'Sound on' : 'Sound off';
  get('sound').setAttribute('aria-pressed', String(soundOn));
  get('sound').title = soundOn ? 'Mute sound' : 'Turn sound on';
  get('pause').disabled = phase === 'ready' || phase === 'over';
  get('pause').textContent = paused ? 'Resume' : 'Pause';
  get('pause').title = paused ? 'Resume (P)' : 'Pause (P)';
  get('overlay').hidden = phase !== 'paused' && phase !== 'over';
  if (phase === 'paused') {
    get('overlay-title').textContent = 'Paused';
    get('overlay-detail').textContent = 'Tap to resume.';
  } else if (phase === 'over') {
    get('overlay-title').textContent = 'Lost in space';
    const plural = run.score === 1 ? 'hop' : 'hops';
    get('overlay-detail').textContent = personalBest ? 'New personal best · ' + run.score + ' ' + plural :
      run.score + ' ' + plural + ' this run';
  }
  setSignal();
}

function setPaused(value) {
  if (run.phase !== 'aim' && run.phase !== 'flight') return;
  paused = value;
  previousTime = null;
  updateDisplay();
  requestFrame();
}

function activate() {
  enableAudio();
  if (paused) { setPaused(false); return; }
  if (run.phase === 'ready' || run.phase === 'over') {
    run.start();
    scene.reset();
    personalBest = false;
    get('announce').textContent = 'In orbit. Launch when the dotted line points at the next planet.';
    tone(310, 510, 0.09);
  } else if (run.phase === 'aim') {
    const ship = run.ship;
    scene.burst(ship.x, ship.y, '#ff935e', 8);
    run.launch();
    tone(165, 460, 0.13);
  }
  updateDisplay();
  requestFrame();
}

get('action').addEventListener('click', activate);
document.querySelector('.field').addEventListener('click', activate);
get('pause').addEventListener('click', () => setPaused(!paused));
get('sound').addEventListener('click', () => {
  soundOn = !soundOn;
  write(soundKey, soundOn ? 'on' : 'off');
  enableAudio();
  tone(480, 640, 0.13);
  updateDisplay();
});
document.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey || document.querySelector('dialog[open]')) return;
  const interactive = event.target.closest?.('button, a, input, select, textarea, [contenteditable=true]');
  if (interactive && interactive !== get('action')) return;
  if (event.code === 'Space' || event.key === 'Enter') {
    event.preventDefault();
    if (!event.repeat) activate();
  }
  if (event.key.toLowerCase() === 'p' && !event.repeat) setPaused(!paused);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) setPaused(true);
  else requestFrame();
});
window.addEventListener('storage', event => {
  if (event.key === bestKey) {
    best = Math.max(best, Number.parseInt(event.newValue, 10) || 0);
    updateDisplay();
  }
});
new ResizeObserver(() => {
  scene.resize();
  scene.draw(run, 0);
}).observe(canvas);

function requestFrame() {
  if (pendingFrame || paused || document.hidden || run.phase === 'ready' ||
      (run.phase === 'over' && !scene.particles.length)) return;
  pendingFrame = requestAnimationFrame(tick);
}

function tick(time) {
  pendingFrame = 0;
  const dt = previousTime === null ? 0 : Math.min(0.05, (time - previousTime) / 1000);
  previousTime = time;
  if (!paused && !document.hidden) {
    const event = run.step(dt);
    if (event === 'land') {
      scene.burst(run.ship.x, run.ship.y, '#a5e6c6', 20);
      tone(490, 555, 0.1);
      tone(720, 840, 0.12, 0.075);
      if (run.score > best) {
        best = run.score;
        personalBest = true;
        write(bestKey, String(best));
      }
      get('announce').textContent = 'Orbit captured. Hops: ' + run.score + '.';
      updateDisplay();
    } else if (event === 'miss') {
      scene.burst(run.ship.x, run.ship.y, '#cca7dc', 18);
      tone(233, 85, 0.25);
      get('announce').textContent = 'Run ended with ' + run.score + ' hops. Play again to restart.';
      updateDisplay();
    } else if (run.phase === 'aim') {
      setSignal();
    }
    scene.draw(run, dt);
  }
  requestFrame();
}

updateDisplay();
scene.draw(run, 0);
