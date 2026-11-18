import { STEP, TrailRun } from './trail.js';

const $ = (id) => document.getElementById(id);
const field = document.querySelector('.field');
const canvas = $('trail');
const action = $('action');
const start = $('start');
const sound = $('sound');
const bestKey = 'pocket-cabinet:timberline-dash:best';
let mode = 'ready';
let view, run, audio;
let best = 0;
let muted = true;
let lastTime = 0;
let accumulator = 0;
let frame = 0;
let pointer = null;
let keyboardDown = false;
let resumeSlide = 0;
let lastHint = '';
let lastDistance = -1;
try {
  best = Math.max(0, Number(localStorage.getItem(bestKey)) || 0);
  muted = localStorage.getItem('timberline:sound') !== 'on';
} catch {}
$('best').textContent = best;

function updateSound() {
  sound.setAttribute('aria-pressed', String(!muted));
  sound.title = muted ? 'Turn sound on' : 'Mute sound';
  sound.setAttribute('aria-label', sound.title);
}
function enableAudio() {
  if (muted) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume().catch(() => {});
  } catch {}
}
function chime(event) {
  if (!audio || muted) return;
  const notes = {
    jump: [380, 690, 0.14],
    slide: [270, 130, 0.14],
    turn: [410, 570, 0.1],
    corner: [560, 840, 0.12],
    crash: [190, 74, 0.22],
    start: [350, 550, 0.15]
  };
  const [from, to, length] = notes[event];
  const oscillator = audio.createOscillator(),
    gain = audio.createGain(),
    now = audio.currentTime;
  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(from, now);
  oscillator.frequency.exponentialRampToValueAtTime(to, now + length);
  gain.gain.setValueAtTime(0.07, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + length);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(now);
  oscillator.stop(now + length);
}
updateSound();
sound.onclick = () => {
  muted = !muted;
  try {
    localStorage.setItem('timberline:sound', muted ? 'off' : 'on');
  } catch {}
  updateSound();
  enableAudio();
  chime('start');
};

function changeMode(next) {
  mode = next;
  document.body.dataset.mode = next;
  $('intro').hidden = next !== 'ready';
  $('message').hidden = next !== 'lost' && next !== 'paused' && next !== 'error';
  $('pause').hidden = next !== 'playing';
  $('distance-panel').hidden = next === 'ready' || next === 'error';
  action.hidden = next !== 'playing';
}
function showMessage(title, detail, label, next) {
  $('message-title').textContent = title;
  $('message-detail').textContent = detail;
  $('again').firstChild.textContent = label + ' ';
  $('announce').textContent = title + '. ' + detail;
  changeMode(next);
  $('again').focus({ preventScroll: true });
}
function updateHud() {
  const distance = Math.floor(run.distance);
  if (lastDistance !== distance) {
    $('distance').textContent = distance;
    lastDistance = distance;
  }
  const h = run.upcoming();
  const now =
    h.kind === 'jump'
      ? h.remaining < run.speed * 0.56 && h.remaining > run.speed * 0.2
      : h.remaining < run.speed * (h.kind === 'turn' ? 0.95 : 0.85);
  let text;
  if (run.missed) text = 'Missed the bend';
  else if (run.armed) text = 'Turn ready';
  else if (h.kind === 'turn')
    text = now ? 'Tap to turn ' + h.side : h.side === 'left' ? 'Left bend ahead' : 'Right bend ahead';
  else if (h.kind === 'slide') text = run.sliding ? 'Keep holding' : now ? 'Hold to slide' : 'Low gate ahead';
  else text = !run.grounded ? 'Jumping' : now ? 'Tap to jump' : 'Log ahead';
  if (lastHint !== text) {
    $('action-label').textContent = text;
    $('action-icon').setAttribute('href', '#' + h.kind);
    action.classList.toggle('left', h.kind === 'turn' && h.side === 'left');
    lastHint = text;
  }
  action.classList.toggle('now', now && !run.armed && !run.missed);
}

function finish() {
  const distance = Math.floor(run.distance);
  const record = distance > best;
  if (record) {
    best = distance;
    $('best').textContent = best;
    try {
      localStorage.setItem(bestKey, String(best));
    } catch {}
  }
  const reason = {
    jump: 'Tap just before the fallen log.',
    slide: 'Hold until you clear the gate.',
    turn: 'Tap near the arrow to take the bend.'
  };
  showMessage(
    record ? 'New best!' : 'Run complete',
    distance + ' m · ' + reason[run.failure],
    'Run again',
    'lost'
  );
}

function drawFrame(time) {
  frame = 0;
  if (mode !== 'playing') return;
  const dt = Math.min((time - lastTime) / 1000, 0.1);
  lastTime = time;
  accumulator += dt;
  while (accumulator >= STEP && !run.failure) {
    if (resumeSlide > 0) {
      resumeSlide -= STEP;
      if (resumeSlide <= 0) run.cancelInput();
    }
    run.tick();
    accumulator -= STEP;
  }
  view.draw(run, dt);
  updateHud();
  if (run.failure) finish();
  else frame = requestAnimationFrame(drawFrame);
}
function animate() {
  accumulator = 0;
  lastTime = performance.now();
  if (frame) cancelAnimationFrame(frame);
  frame = requestAnimationFrame(drawFrame);
}

async function begin() {
  if (mode === 'loading' || mode === 'playing') return;
  enableAudio();
  mode = 'loading';
  start.disabled = true;
  $('again').disabled = true;
  start.firstChild.textContent = 'Opening trail ';
  try {
    if (!view) {
      const { AlpineScene } = await import('./scene.js');
      view = new AlpineScene(canvas);
    }
    run = new TrailRun(Date.now(), chime);
    pointer = null;
    keyboardDown = false;
    resumeSlide = 0;
    lastDistance = -1;
    lastHint = '';
    changeMode('playing');
    view.engine.resize();
    view.reset(run);
    await view.scene.whenReadyAsync();
    if (mode !== 'playing') return;
    updateHud();
    action.focus({ preventScroll: true });
    chime('start');
    animate();
    if (document.hidden) pause();
  } catch (error) {
    console.error(error);
    showMessage(
      'Trail unavailable',
      'This game needs WebGL. Enable hardware acceleration or try a WebGL-capable browser.',
      'Try again',
      'error'
    );
  } finally {
    start.disabled = false;
    $('again').disabled = false;
    start.firstChild.textContent = 'Start run ';
  }
}
function pause() {
  if (mode !== 'playing') return;
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  pointer = null;
  keyboardDown = false;
  // A player pausing beneath a gate gets time to clear it after resuming.
  if (run.sliding) resumeSlide = Math.max(0.28, Math.min(1.2, (run.upcoming().remaining + 1) / run.speed));
  else run.cancelInput();
  showMessage('Paused', Math.floor(run.distance) + ' m on the trail', 'Resume run', 'paused');
}
function resume() {
  if (mode !== 'paused') return;
  changeMode('playing');
  action.focus({ preventScroll: true });
  animate();
}

start.onclick = begin;
$('again').onclick = () => (mode === 'paused' ? resume() : begin());
$('pause').onclick = pause;
function press() {
  resumeSlide = 0;
  run.press();
}
field.addEventListener('pointerdown', (event) => {
  if (
    mode !== 'playing' ||
    (event.target !== canvas && !action.contains(event.target)) ||
    pointer !== null ||
    keyboardDown ||
    event.button !== 0
  )
    return;
  event.preventDefault();
  pointer = event.pointerId;
  field.setPointerCapture(pointer);
  press();
});
field.addEventListener('pointerup', (event) => {
  if (event.pointerId !== pointer) return;
  pointer = null;
  if (mode === 'playing') run.release();
});
field.addEventListener('lostpointercapture', (event) => {
  if (event.pointerId === pointer) {
    pointer = null;
    if (mode === 'playing') run.cancelInput();
  }
});
action.addEventListener('click', (event) => {
  // Native keyboard activation with Enter or assistive switch control.
  if (mode === 'playing' && event.detail === 0 && !keyboardDown) {
    run.press();
    run.release();
  }
});
field.addEventListener('contextmenu', (event) => event.preventDefault());
window.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey || document.querySelector('dialog[open]')) return;
  if (event.code === 'KeyP' || event.code === 'Escape') {
    if (event.repeat) return;
    if (mode === 'playing') pause();
    else if (mode === 'paused') resume();
    return;
  }
  if (event.code !== 'Space' || event.target.closest('nav, #pause')) return;
  event.preventDefault();
  if (event.repeat) return;
  if (mode === 'ready' || mode === 'lost') {
    begin();
    return;
  }
  if (mode === 'paused') {
    resume();
    return;
  }
  if (mode === 'playing' && pointer === null) {
    keyboardDown = true;
    press();
  }
});
window.addEventListener('keyup', (event) => {
  if (event.code === 'Space' && keyboardDown) {
    event.preventDefault();
    keyboardDown = false;
    if (mode === 'playing') run.release();
  }
});
window.addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});
canvas.addEventListener('webglcontextlost', pause);
