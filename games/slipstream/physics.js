// SI units. s increases down the track, x increases towards the right edge.
// Positive windS is a tailwind. The wake is an entrainment approximation, not CFD.
export const lanes = [-3.6, 0, 3.6];
export const drivers = [
  { name: 'You', number: 7, car: 'player', cd: 0.29, area: 1.55, power: 38000 },
  { name: 'Vega', number: 12, car: 'vega', cd: 0.26, area: 1.5, power: 32600 },
  { name: 'Moss', number: 23, car: 'moss', cd: 0.4, area: 1.72, power: 36300 },
  { name: 'Sol', number: 41, car: 'sol', cd: 0.32, area: 1.52, power: 34500 }
];

export const heats = [
  {
    name: 'Salt sprint',
    length: 1050,
    base: [-4, 0],
    gust: [-9, 2],
    zones: [[0.35, 0.64]],
    cones: [[505, 1]],
    tip: 'Drag to steer or tap the arrows. Catch a blue wake, then boost past.'
  },
  {
    name: 'Crosswind pass',
    length: 1250,
    base: [-2, -2],
    gust: [-5, 10],
    zones: [
      [0.18, 0.47],
      [0.6, 0.85]
    ],
    cones: [
      [480, 2],
      [770, 1],
      [1000, 0]
    ],
    tip: 'Crosswinds blow the wake sideways. Follow the blue ribbons to stay sheltered.'
  },
  {
    name: 'Headwind run',
    length: 1450,
    base: [2, 2],
    gust: [-15, -6],
    zones: [
      [0.19, 0.47],
      [0.57, 0.9]
    ],
    cones: [
      [420, 1],
      [680, 0],
      [970, 2],
      [1160, 1]
    ],
    tip: 'Save boost for the pass. A headwind makes shelter especially valuable.'
  }
];

const mass = 720;
const rho = 1.2;
export const capacity = 175000; // joules delivered to the motor
const boostPower = 35000;
const rolling = 0.01 * mass * 9.81;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

export function windAt(heat, s) {
  const p = s / heat.length;
  let blend = 0;
  for (const [start, end] of heat.zones) {
    blend = Math.max(blend, clamp(Math.min((p - start) / 0.055, (end - p) / 0.055), 0, 1));
  }
  return {
    s: heat.base[0] + (heat.gust[0] - heat.base[0]) * blend,
    x: heat.base[1] + (heat.gust[1] - heat.base[1]) * blend
  };
}

// Behind a moving car, air is carried along with it. The plume widens and
// loses strength downstream; lateral wind advects its center during that time.
export function wakeAt(leader, s, x, wind) {
  const gap = leader.s - s;
  if (gap < 2 || gap > 85) return { strength: 0, center: leader.x, width: 0 };
  const along = Math.max(8, leader.v - wind.s);
  const age = gap / along;
  const center = leader.x + wind.x * age;
  const width = 1.05 + gap * 0.044;
  const offset = (x - center) / width;
  const strength = 0.56 * Math.exp(-gap / 30 - 0.5 * offset * offset);
  return { strength, center, width };
}

export function airLoad(car, cars, heat) {
  const wind = windAt(heat, car.s);
  // Blend overlapping wakes without entraining the air beyond the leaders' speed.
  let free = 1,
    sum = 0,
    leaderV = 0,
    leaderX = 0;
  for (const leader of cars) {
    if (leader === car || leader.finished) continue;
    const { strength } = wakeAt(leader, car.s, car.x, wind);
    free *= 1 - strength;
    sum += strength;
    leaderV += leader.v * strength;
    leaderX += leader.vx * strength;
  }
  const shelter = 1 - free;
  const airS = wind.s + (sum ? leaderV / sum - wind.s : 0) * shelter;
  const airX = wind.x + (sum ? leaderX / sum - wind.x : 0) * shelter;
  function force(airS, airX) {
    const relS = car.v - airS,
      relX = car.vx - airX;
    const speed = Math.hypot(relS, relX);
    const side = speed ? Math.abs(relX) / speed : 0;
    // Exposing the flank increases effective drag area at yaw.
    const dragArea = car.spec.cd * car.spec.area + 1.9 * side * side;
    const scale = -0.5 * rho * dragArea * speed;
    return { s: scale * relS, x: scale * relX, magnitude: -scale * speed, speed };
  }
  const load = force(airS, airX);
  const open = force(wind.s, wind.x).magnitude;
  return { ...load, wind, shelter, saved: open > 0 ? 1 - load.magnitude / open : 0 };
}

export function createRace(heatIndex) {
  const grid = [
    [0, 1],
    [14, 1],
    [26, 0],
    [39, 2]
  ];
  const cars = drivers.map((spec, id) => {
    const [s, lane] = grid[id];
    return {
      id,
      spec,
      lane,
      x: lanes[lane],
      targetX: lanes[lane],
      s,
      v: 30,
      vx: 0,
      charge: capacity,
      boosting: false,
      finished: false,
      finishTime: Infinity,
      contact: 0,
      think: 1 + id * 0.25,
      load: null
    };
  });
  const race = { heat: heats[heatIndex], heatIndex, cars, time: 0, event: '', eventUntil: 0 };
  for (const car of cars) car.load = airLoad(car, cars, race.heat);
  return race;
}

export function moveLane(car, direction) {
  const next = clamp(car.lane + direction, 0, lanes.length - 1);
  steerTo(car, lanes[next]);
}

export function steerTo(car, x) {
  car.targetX = clamp(x, -4.65, 4.65);
  car.lane = lanes.reduce(
    (nearest, laneX, i) =>
      Math.abs(laneX - car.targetX) < Math.abs(lanes[nearest] - car.targetX) ? i : nearest,
    0
  );
}

function rivalControl(car, race, dt) {
  car.think -= dt;
  if (car.think > 0) return;
  car.think = 0.55 + 0.16 * car.id;
  const ahead = race.cars.filter((c) => c !== car && !c.finished && c.s > car.s && c.s < car.s + 70);
  const wind = windAt(race.heat, car.s);
  function value(lane) {
    const x = lanes[lane];
    let score = lane === car.lane ? 0.28 : -0.12 * Math.abs(lane - car.lane);
    for (const other of ahead) {
      const gap = other.s - car.s;
      score += 3 * wakeAt(other, car.s, x, wind).strength;
      if (Math.abs(other.x - x) < 2.0 && gap < 11 && car.v >= other.v - 0.4) score -= 2;
    }
    for (const [s, blocked] of race.heat.cones) {
      if (lane === blocked && s - car.s > -3 && s - car.s < 42 + car.id * 3) score -= 4;
    }
    if (race.cars.some((c) => c !== car && !c.finished && Math.abs(c.s - car.s) < 6 && Math.abs(c.x - x) < 2))
      score -= 2;
    return score;
  }
  const adjacent = [car.lane, car.lane - 1, car.lane + 1].filter((l) => l >= 0 && l <= 2);
  car.lane = adjacent.reduce((best, lane) => (value(lane) > value(best) ? lane : best));
  car.targetX = lanes[car.lane];
  const finishGap = race.heat.length - car.s;
  car.boosting = finishGap < 145 + car.id * 18 || (car.id === 2 && finishGap < 380 && ahead.length > 0);
}

function tell(race, text) {
  race.event = text;
  race.eventUntil = race.time + 1.5;
}

export function step(race, dt, boost = false) {
  const { cars, heat } = race;
  const loads = cars.map((car) => airLoad(car, cars, heat));
  for (const car of cars) {
    if (car.finished) continue;
    if (car.id) rivalControl(car, race, dt);
    else car.boosting = boost;
    car.contact = Math.max(0, car.contact - dt);
    car.load = loads[car.id];
    const extraPower = car.boosting ? Math.min(boostPower, car.charge / dt) : 0;
    car.boosting = extraPower > 0;
    car.charge = Math.max(0, car.charge - extraPower * dt);
    const thrust = (car.spec.power + extraPower) / Math.max(8, car.v);
    const lateral = clamp((car.targetX - car.x) * 18 - 6.5 * car.vx, -14, 14);
    car.vx += (lateral + car.load.x / mass) * dt;
    car.x = clamp(car.x + car.vx * dt, -5.0, 5.0);
    car.v = Math.max(6, car.v + ((thrust + car.load.s - rolling) / mass) * dt);
    const previous = car.s;
    car.s += car.v * dt;
    for (const [s, lane] of heat.cones) {
      if (previous < s && car.s >= s && Math.abs(car.x - lanes[lane]) < 1.8) {
        car.v *= 0.83;
        car.contact = 0.7;
        if (!car.id) tell(race, 'Clipped the cones!');
      }
    }
    if (car.s >= heat.length) {
      car.finishTime = race.time + (dt * (heat.length - previous)) / (car.s - previous);
      car.finished = true;
      car.s = heat.length;
    }
  }
  // Resolve rear and side contact once per pair. A blocked follower cannot
  // tunnel through a leader, including when both are on a lane boundary.
  for (let i = 0; i < cars.length; i++)
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i],
        b = cars[j];
      if (a.finished || b.finished || Math.abs(a.x - b.x) >= 1.76) continue;
      const [front, rear] = a.s >= b.s ? [a, b] : [b, a];
      if (front.s - rear.s >= 4.55) continue;
      const firstContact = rear.contact <= 0 && front.contact <= 0;
      rear.s = front.s - 4.55;
      rear.v = Math.min(rear.v, front.v - (firstContact ? 1.4 : 0.15));
      if (firstContact) {
        rear.contact = front.contact = 0.7;
        if (!rear.id || !front.id) tell(race, 'Bumper contact!');
      }
    }
  race.time += dt;
}

export function order(race) {
  return [...race.cars].sort((a, b) =>
    a.finishTime === b.finishTime ? b.s - a.s : a.finishTime - b.finishTime
  );
}

export const points = [5, 3, 2, 1];
export function standings(results) {
  const rows = drivers.map((spec, id) => ({
    id,
    spec,
    total: results.reduce((sum, result) => sum + points[result.indexOf(id)], 0)
  }));
  // Ties go to the driver ahead in the most recent heat.
  return rows.sort(
    (a, b) => b.total - a.total || results.at(-1).indexOf(a.id) - results.at(-1).indexOf(b.id)
  );
}
