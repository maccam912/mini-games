import test from 'node:test';
import assert from 'node:assert/strict';
import {
  airLoad,
  capacity,
  createRace,
  heats,
  lanes,
  moveLane,
  order,
  standings,
  steerTo,
  step,
  wakeAt
} from '../games/slipstream/physics.js';

const calm = { length: 1000, base: [0, 0], gust: [0, 0], zones: [], cones: [] };
function force(car, wind) {
  return airLoad(car, [car], { ...calm, base: wind });
}

test('drag follows relative velocity, including reversal, yaw and the square law', () => {
  const car = createRace(0).cars[0];
  const baseline = force(car, [0, 0]);
  assert.ok(baseline.s < 0);
  assert.equal(Math.abs(baseline.x), 0);
  car.v *= 2;
  assert.equal(force(car, [0, 0]).magnitude, 4 * baseline.magnitude);
  assert.equal(force(car, [30, 0]).magnitude, baseline.magnitude);
  assert.equal(force(car, [60, 0]).magnitude, 0);
  assert.ok(force(car, [70, 0]).s > 0);
  const side = force(car, [0, 8]);
  assert.ok(side.x > 0 && side.s < 0);
  assert.ok(side.magnitude > force(car, [0, 0]).magnitude);
});

test('a wake narrows the airspeed gap, weakens downstream and moves downwind', () => {
  const [player, leader] = createRace(0).cars;
  leader.s = 30;
  const straight = airLoad(player, [player, leader], calm);
  assert.ok(straight.speed < player.v && straight.saved > 0);
  const cross = { s: 0, x: 6 };
  const plume = wakeAt(leader, 0, leader.x, cross);
  assert.ok(plume.center > leader.x);
  const centered = wakeAt(leader, 0, plume.center, cross).strength;
  assert.ok(centered > plume.strength);
  assert.ok(wakeAt(leader, -20, leader.x + 10, cross).strength < centered);
  assert.equal(wakeAt(leader, leader.s + 1, leader.x, cross).strength, 0);
  player.x = plume.center;
  assert.ok(airLoad(player, [player, leader], { ...calm, base: [0, 6] }).saved > 0);
});

test('using boost consumes a finite energy budget and lane changes take time', () => {
  const race = createRace(0),
    car = race.cars[0];
  moveLane(car, -1);
  moveLane(car, -1);
  assert.equal(car.lane, 0);
  assert.equal(car.x, 0);
  step(race, 1 / 60, true);
  assert.ok(car.x < 0 && car.x > lanes[0]);
  for (let i = 1; i < 302; i++) step(race, 1 / 60, true);
  assert.equal(car.charge, 0);
  assert.equal(car.boosting, false);
  assert.equal(createRace(1).cars[0].charge, capacity);
});

test('direct steering can hold a crosswind-shifted line between marked lanes', () => {
  const race = createRace(1),
    car = race.cars[0];
  steerTo(car, 1.55);
  for (let i = 0; i < 120; i++) step(race, 1 / 60);
  assert.ok(Math.abs(car.x - 1.55) < 0.1);
  moveLane(car, -1);
  assert.equal(car.targetX, lanes[0]);
  steerTo(car, -100);
  assert.ok(car.targetX >= -5);
});

test('clipping a blocked lane costs speed and a follower cannot pass through a bumper', () => {
  const race = createRace(0),
    [car, leader] = race.cars;
  race.heat = { ...calm, cones: [[10, 1]] };
  race.cars = race.cars.slice(0, 2);
  car.s = 9.9;
  leader.s = 90;
  step(race, 1 / 60);
  assert.ok(car.v < 26);
  assert.match(race.event, /cones/);
  car.s = 25;
  car.v = 45;
  car.x = leader.x = 0;
  leader.s = 29.7;
  leader.v = 28;
  step(race, 1 / 60);
  assert.ok(leader.s - car.s >= 4.55 - 1e-9);
  assert.ok(car.v < leader.v);
});

test('the player can win the cup with touch-equivalent steering and boost decisions', () => {
  const strategies = [
    [
      [1.7, -1],
      [2.0, 1],
      [2.57, 1],
      [6.53, -1],
      [11.92, -1]
    ],
    [
      [1.7, -1],
      [2.0, 1],
      [4.55, 1],
      [6.53, -1],
      [18.15, -1],
      [23.25, 1]
    ],
    [
      [3.98, 1],
      [6.82, -1],
      [9.65, -1],
      [15.88, 1],
      [27.22, -1]
    ]
  ];
  const results = [];
  for (let heat = 0; heat < heats.length; heat++) {
    const race = createRace(heat),
      car = race.cars[0],
      moves = strategies[heat];
    let next = 0;
    while (!race.cars.every((c) => c.finished) && race.time < 60) {
      if (next < moves.length && race.time >= moves[next][0]) moveLane(car, moves[next++][1]);
      const boost = (race.time >= 0.32 && race.time < 3.32) || car.s > race.heat.length - 340;
      step(race, 1 / 60, boost);
    }
    assert.ok(race.cars.every((c) => c.finished && Number.isFinite(c.finishTime)));
    results.push(order(race).map((c) => c.id));
    assert.equal(results.at(-1)[0], 0);
  }
  assert.equal(standings(results)[0].total, 15);
});

test('equal cup points are broken by placement in the latest heat', () => {
  const rows = standings([
    [0, 1, 2, 3],
    [1, 0, 3, 2]
  ]);
  assert.deepEqual(
    rows.map((row) => [row.id, row.total]),
    [
      [1, 8],
      [0, 8],
      [3, 3],
      [2, 3]
    ]
  );
});
