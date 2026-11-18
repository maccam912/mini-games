import {
  createRace,
  heats,
  moveLane,
  order,
  points,
  standings,
  step,
  steerTo,
  lanes,
  capacity
} from './physics.js';
import { raceAudio } from './audio.js';
import { makeScene } from './scene.js';

const get = (id) => document.getElementById(id);
const game = get('game'),
  boostButton = get('boost'),
  help = get('briefing');
const change = (el, value) => {
  const str = String(value);
  if (el.textContent !== str) el.textContent = str;
};
const ordinals = ['1st', '2nd', '3rd', '4th'];
let mode = 'menu';
let race = createRace(0);
let results = [];
let draftTime = 0,
  bestTow = 0;
let frame = 0,
  last = 0,
  remainder = 0,
  countdown = 0;
let pausedFrom = 'race',
  keyboardBoost = false,
  switchBoost = false,
  boostPointer = null;
const sound = raceAudio();
let priorRank = 4,
  passUntil = 0,
  passText = '';
const draw = makeScene(get('world'), paint);

function paint() {
  draw(mode, race);
}
function clearBoost() {
  keyboardBoost = switchBoost = false;
  if (boostPointer !== null && boostButton.hasPointerCapture(boostPointer))
    boostButton.releasePointerCapture(boostPointer);
  boostPointer = null;
}

function setMode(next) {
  mode = next;
  game.dataset.mode = next;
  const racing = next === 'race',
    staging = next === 'grid',
    panel = next === 'paused' || next === 'result';
  get('menu').hidden = next !== 'menu';
  get('instruments').hidden = next === 'menu';
  get('driving').hidden = !racing;
  get('pause').hidden = !racing && !staging;
  get('panel').hidden = !panel;
  get('restart').hidden = next !== 'paused';
  get('countdown').hidden = !staging;
  if (!racing && !staging) get('radio').hidden = true;
  get('help').hidden = panel;
  if (!racing) {
    clearBoost();
    sound.mix(null);
  }
}

function hud() {
  const p = race.cars[0],
    load = p.load,
    rank = order(race).indexOf(p) + 1;
  if (mode === 'race' && rank < priorRank) {
    passUntil = race.time + 1.2;
    passText = rank === 1 ? 'Into the lead!' : 'Up to ' + ordinals[rank - 1] + '!';
    sound.cue(580, 0.09);
  }
  priorRank = rank;
  change(get('place'), ordinals[rank - 1]);
  change(get('remaining'), Math.max(0, Math.ceil(race.heat.length - p.s)) + ' m');
  get('progress').style.transform = 'scaleX(' + Math.min(1, p.s / race.heat.length) + ')';
  change(get('speed'), Math.round(p.v * 3.6));
  get('steer-left').disabled = p.lane === 0;
  get('steer-right').disabled = p.lane === lanes.length - 1;
  change(get('force'), Math.round(load.magnitude) + ' N');
  const saving = Math.round(load.saved * 100);
  change(get('shelter'), saving >= 5 ? 'Tow −' + saving + '%' : 'Open air');
  const energy = Math.ceil((100 * p.charge) / capacity);
  change(get('energy'), energy + '%');
  get('charge').style.transform = 'scaleX(' + p.charge / capacity + ')';
  boostButton.disabled = p.charge <= 0;
  boostButton.setAttribute('aria-pressed', String(mode === 'race' && p.boosting));
  const wind = load.wind,
    side = Math.abs(wind.x) >= 2;
  const longitudinal = wind.s < 0 ? 'Headwind' : 'Tailwind';
  change(
    get('wind'),
    side && Math.abs(wind.x) >= Math.abs(wind.s) * 0.75
      ? 'Crosswind ' + (wind.x > 0 ? '→' : '←') + ' ' + Math.round(Math.abs(wind.x)) + ' m/s'
      : longitudinal +
          ' ' +
          Math.abs(Math.round(wind.s)) +
          ' m/s' +
          (side ? ' ' + (wind.x > 0 ? '↗' : '↖') : '')
  );
  let msg = '';
  if (mode === 'grid') msg = race.heat.tip;
  if (mode === 'race') {
    if (race.eventUntil > race.time) msg = race.event;
    else if (race.time < 2.5) msg = 'Ride the blue wake. Hold boost to pass.';
    else if (passUntil > race.time) msg = passText;
    else if (!energy && p.boosting) msg = 'Boost spent';
  }
  const radio = get('radio');
  radio.hidden = !msg;
  if (msg) change(radio, msg);
}

function grid(heatIndex) {
  cancelAnimationFrame(frame);
  race = createRace(heatIndex);
  draftTime = bestTow = remainder = 0;
  countdown = 2.5;
  priorRank = 4;
  passUntil = 0;
  sound.unlock();
  sound.cue(325);
  change(get('heat-label'), 'Heat ' + String(heatIndex + 1).padStart(2, '0') + ' / 03');
  change(get('heat-name'), race.heat.name);
  get('leaderboard').hidden = true;
  setMode('grid');
  change(get('countdown'), '3');
  change(get('announce'), race.heat.name + '. ' + race.heat.tip);
  hud();
  paint();
  last = performance.now();
  frame = requestAnimationFrame(tick);
}

function endHeat() {
  // Let the rest of the field cross the same timing line before awarding points.
  const finish = structuredClone(race);
  while (finish.cars.some((c) => !c.finished)) step(finish, 1 / 60);
  const places = order(finish).map((c) => c.id);
  results.push(places);
  const rank = places.indexOf(0),
    final = results.length === heats.length;
  const rows = standings(results);
  const standing = rows.findIndex((row) => row.id === 0);
  setMode('result');
  change(
    get('panel-kicker'),
    final ? 'Salt Cup · Final standings' : 'Heat ' + results.length + ' · ' + race.heat.name
  );
  change(
    get('panel-title'),
    final
      ? standing === 0
        ? 'Salt Cup champion!'
        : ordinals[standing] + ' in the cup'
      : rank === 0
        ? 'Heat winner!'
        : ordinals[rank] + ' at the line'
  );
  change(
    get('panel-detail'),
    ordinals[rank] +
      ' this heat · ' +
      points[rank] +
      ' pts. You drafted for ' +
      draftTime.toFixed(1) +
      ' s and cut drag by up to ' +
      Math.round(100 * bestTow) +
      '%.'
  );
  get('leaderboard').replaceChildren(
    ...rows.map((row, i) => {
      const li = document.createElement('li');
      if (row.id === 0) li.className = 'player';
      const name = document.createElement('span'),
        score = document.createElement('span');
      name.textContent = i + 1 + '. ' + row.spec.name;
      score.textContent = row.total + ' pts';
      li.append(name, score);
      return li;
    })
  );
  get('leaderboard').hidden = false;
  change(get('continue'), final ? 'Race another cup' : 'Next heat · ' + heats[results.length].name);
  sound.cue(rank === 0 ? 800 : 520, 0.32);
  change(get('announce'), get('panel-title').textContent + '. ' + get('panel-detail').textContent);
  get('continue').focus({ preventScroll: true });
  paint();
}

function tick(now) {
  const delta = Math.min(0.18, Math.max(0, (now - last) / 1000));
  last = now;
  if (mode === 'grid') {
    const before = Math.ceil(countdown);
    countdown -= delta;
    if (Math.ceil(countdown) < before) sound.cue(countdown <= 0 ? 680 : 325, countdown <= 0 ? 0.27 : 0.12);
    change(get('countdown'), Math.max(1, Math.ceil(countdown)));
    if (countdown <= 0) setMode('race');
  } else if (mode === 'race') {
    remainder += delta;
    const dt = 1 / 60;
    const pressed = keyboardBoost || boostPointer !== null || switchBoost;
    while (remainder >= dt && !race.cars[0].finished) {
      step(race, dt, pressed);
      const saved = race.cars[0].load.saved;
      if (saved >= 0.05) draftTime += dt;
      bestTow = Math.max(bestTow, saved);
      remainder -= dt;
    }
  } else return;
  hud();
  paint();
  if (mode === 'race') sound.mix(race.cars[0]);
  if (race.cars[0].finished) {
    endHeat();
    return;
  }
  frame = requestAnimationFrame(tick);
}

function pause() {
  if (mode !== 'race' && mode !== 'grid') return;
  cancelAnimationFrame(frame);
  pausedFrom = mode;
  setMode('paused');
  change(get('panel-kicker'), 'Heat ' + (race.heatIndex + 1) + ' · ' + race.heat.name);
  change(get('panel-title'), 'Race paused');
  change(get('panel-detail'), race.heat.tip);
  change(get('continue'), 'Resume race');
  get('leaderboard').hidden = true;
  get('continue').focus({ preventScroll: true });
}
function resume() {
  sound.unlock();
  setMode(pausedFrom);
  last = performance.now();
  hud();
  paint();
  frame = requestAnimationFrame(tick);
}
function steer(dir) {
  if (mode === 'race') moveLane(race.cars[0], dir);
}
// Direct steering lets a thumb or mouse follow an angled wake between lanes.
const road = get('world');
let steeringPointer = null,
  steeringOrigin = 0,
  initialLine = 0;
road.addEventListener('pointerdown', (event) => {
  if (mode !== 'race' || event.button !== 0 || steeringPointer !== null) return;
  steeringPointer = event.pointerId;
  steeringOrigin = event.clientX;
  initialLine = race.cars[0].targetX;
  road.setPointerCapture(event.pointerId);
});
road.addEventListener('pointermove', (event) => {
  if (mode !== 'race' || event.pointerId !== steeringPointer) return;
  const pixelsPerMeter = Math.max(18, Math.min(52, road.clientWidth / 14));
  steerTo(race.cars[0], initialLine + (event.clientX - steeringOrigin) / pixelsPerMeter);
});
road.addEventListener('lostpointercapture', () => {
  steeringPointer = null;
});
get('start').addEventListener('click', () => {
  results = [];
  grid(0);
});
get('pause').addEventListener('click', pause);
get('continue').addEventListener('click', () => {
  if (mode === 'paused') resume();
  else if (mode === 'result') {
    if (results.length === heats.length) results = [];
    grid(results.length);
  }
});
get('restart').addEventListener('click', () => grid(race.heatIndex));
get('help').addEventListener('click', () => {
  pause();
  help.showModal();
});
help.addEventListener('close', () => {
  if (mode === 'paused') get('continue').focus({ preventScroll: true });
});
for (const [id, dir] of [
  ['steer-left', -1],
  ['steer-right', 1]
]) {
  const button = get(id);
  // A second finger can steer while the first holds boost.
  button.addEventListener('pointerdown', (event) => {
    if (event.button === 0) steer(dir);
  });
  button.addEventListener('click', (event) => {
    if (event.detail === 0) steer(dir);
  });
  button.addEventListener('contextmenu', (event) => event.preventDefault());
}
boostButton.addEventListener('pointerdown', (event) => {
  if (mode !== 'race' || event.button !== 0 || boostPointer !== null) return;
  boostPointer = event.pointerId;
  boostButton.setPointerCapture(event.pointerId);
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  boostButton.addEventListener(type, (event) => {
    if (event.pointerId === boostPointer) boostPointer = null;
  });
}
boostButton.addEventListener('click', (event) => {
  if (event.detail === 0 && mode === 'race') switchBoost = !switchBoost;
});
boostButton.addEventListener('contextmenu', (event) => event.preventDefault());
window.addEventListener('keydown', (event) => {
  if (document.querySelector('dialog[open]') || event.metaKey || event.ctrlKey || event.altKey) return;
  if (['KeyP', 'Escape'].includes(event.code) && !event.repeat) {
    if (mode === 'paused') resume();
    else pause();
    return;
  }
  if (mode !== 'race') return;
  if (event.code === 'Space') {
    event.preventDefault();
    keyboardBoost = true;
  } else if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(event.code)) {
    event.preventDefault();
    if (!event.repeat) steer(['ArrowLeft', 'KeyA'].includes(event.code) ? -1 : 1);
  }
});
window.addEventListener('keyup', (event) => {
  if (event.code === 'Space') keyboardBoost = false;
});
window.addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});
function soundLabels() {
  for (const control of document.querySelectorAll('[data-sound]')) {
    control.textContent = sound.muted ? 'Sound off' : 'Sound on';
    control.setAttribute('aria-pressed', String(!sound.muted));
  }
}
for (const control of document.querySelectorAll('[data-sound]')) {
  control.addEventListener('click', () => {
    sound.toggle();
    soundLabels();
  });
}
soundLabels();
setMode('menu');
paint();
