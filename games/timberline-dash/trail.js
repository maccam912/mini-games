import { World, Body, Box, Vec3, SAPBroadphase } from './vendor/cannon.js';

export const STEP = 1 / 60;
export const DECK_WIDTH = 4.6;
const STANDING = 1.24;
const SLIDING = 0.52;
const HOLD_TIME = 0.16;

export function randomSequence(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function makeSection(index, previous, seed) {
  const rand = randomSequence((seed ^ Math.imul(index + 1, 2654435761)) >>> 0);
  const heading = previous?.nextHeading ?? 0;
  const nextHeading = index % 2 ? 0 : ((rand() < 0.5 ? -1 : 1) * Math.PI) / 2;
  const length = index ? 48 + Math.floor(rand() * 20) : 57;
  const first = index === 0 || rand() > 0.5 ? 'jump' : 'slide';
  const hazards = [
    { at: index ? 14 + rand() * 5 : 19, kind: first },
    { at: length - 18 - rand() * 2, kind: first === 'jump' ? 'slide' : 'jump' }
  ];
  return {
    index,
    heading,
    nextHeading,
    length,
    hazards,
    seed: Math.floor(rand() * 0xffffffff),
    x: previous ? previous.x + previous.dx * previous.length : 0,
    z: previous ? previous.z + previous.dz * previous.length : 0,
    dx: Math.round(Math.sin(heading)),
    dz: Math.round(Math.cos(heading)),
    side: nextHeading > heading ? 'right' : 'left'
  };
}

export class TrailRun {
  constructor(seed = Date.now(), onEvent = () => {}) {
    this.seed = seed;
    this.onEvent = onEvent;
    this.world = new World({ gravity: new Vec3(0, -24, 0) });
    this.world.broadphase = new SAPBroadphase(this.world);
    this.world.defaultContactMaterial.friction = 0;
    this.world.defaultContactMaterial.restitution = 0;
    this.sections = [];
    this.index = 0;
    this.along = 0;
    this.completed = 0;
    this.held = null;
    this.sliding = false;
    this.armed = false;
    this.missed = false;
    this.failure = '';
    this.standingBox = new Box(new Vec3(0.32, STANDING / 2, 0.32));
    this.slidingBox = new Box(new Vec3(0.32, SLIDING / 2, 0.32));
    this.player = new Body({
      mass: 1,
      position: new Vec3(0, STANDING / 2, 0),
      shape: this.standingBox,
      fixedRotation: true,
      linearDamping: 0,
      collisionFilterGroup: 1,
      collisionFilterMask: 2
    });
    this.player.addEventListener('collide', ({ body }) => {
      if (body.hazard) this.fail(body.hazard);
    });
    this.world.addBody(this.player);
    this.extend();
  }

  get current() {
    return this.sections.find((section) => section.index === this.index);
  }
  get distance() {
    return this.completed + Math.min(this.along, this.current.length);
  }
  get speed() {
    return 7.8 + Math.min(4, this.distance / 190);
  }
  get footY() {
    return this.player.position.y - (this.sliding ? SLIDING : STANDING) / 2;
  }
  get grounded() {
    return this.footY < 0.055 && Math.abs(this.player.velocity.y) < 0.7;
  }

  extend() {
    while (!this.sections.length || this.sections.at(-1).index < this.index + 3) {
      const previous = this.sections.at(-1);
      const section = makeSection(previous ? previous.index + 1 : 0, previous, this.seed);
      section.bodies = [];
      const box = (along, y, width, height, depth, hazard) => {
        const halfSize = section.dx
          ? new Vec3(depth / 2, height / 2, width / 2)
          : new Vec3(width / 2, height / 2, depth / 2);
        const body = new Body({
          mass: 0,
          position: new Vec3(section.x + section.dx * along, y, section.z + section.dz * along),
          shape: new Box(halfSize),
          collisionFilterGroup: 2,
          collisionFilterMask: 1,
          collisionResponse: !hazard
        });
        body.hazard = hazard;
        section.bodies.push(body);
        this.world.addBody(body);
      };
      const lead = section.index === 0 ? 9 : DECK_WIDTH / 2;
      const end = section.length + DECK_WIDTH / 2;
      box((end - lead) / 2, -0.3, DECK_WIDTH, 0.6, end + lead);
      for (const h of section.hazards) {
        if (h.kind === 'jump') box(h.at, 0.3, DECK_WIDTH, 0.6, 0.55, 'jump');
        else box(h.at, 1.5, DECK_WIDTH, 1.44, 0.62, 'slide');
      }
      this.sections.push(section);
    }
    while (this.sections[0].index < this.index - 1) {
      for (const body of this.sections.shift().bodies) this.world.removeBody(body);
    }
  }

  fail(kind) {
    if (this.failure) return;
    this.failure = kind;
    this.onEvent('crash');
  }

  press() {
    if (!this.failure && !this.missed && this.held === null) this.held = 0;
  }

  release() {
    if (this.held === null) return;
    const tap = this.held < HOLD_TIME;
    this.cancelInput();
    if (!tap || this.failure || this.missed) return;
    if (this.current.length - this.along <= this.speed * 0.95) {
      if (!this.armed) this.onEvent('turn');
      this.armed = true;
    } else if (this.grounded) {
      this.player.velocity.y = 8.8;
      this.onEvent('jump');
    }
  }

  cancelInput() {
    this.held = null;
    this.setSlide(false);
  }

  setSlide(value) {
    if (this.sliding === value) return;
    this.sliding = value;
    this.player.removeShape(this.player.shapes[0]);
    this.player.addShape(value ? this.slidingBox : this.standingBox);
    this.player.position.y += ((value ? -1 : 1) * (STANDING - SLIDING)) / 2;
    this.player.aabbNeedsUpdate = true;
    if (value) this.onEvent('slide');
  }

  upcoming() {
    const section = this.current;
    for (const h of section.hazards) {
      if (this.along <= h.at + 0.7) return { kind: h.kind, remaining: h.at - this.along };
    }
    return { kind: 'turn', side: section.side, remaining: section.length - this.along };
  }

  tick() {
    if (this.failure) return;
    if (this.held !== null) {
      this.held += STEP;
      if (this.held >= HOLD_TIME && this.grounded) this.setSlide(true);
    }
    const s = this.current;
    const speed = this.speed;
    this.player.velocity.x = s.dx * speed;
    this.player.velocity.z = s.dz * speed;
    this.world.step(STEP);
    this.along = (this.player.position.x - s.x) * s.dx + (this.player.position.z - s.z) * s.dz;
    if (this.along < s.length || this.failure) return;
    if (!this.armed) {
      this.missed = true;
      if (this.footY < -1.7) this.fail('turn');
      return;
    }
    this.along -= s.length;
    this.completed += s.length;
    this.index++;
    this.armed = false;
    const next = this.current;
    this.player.position.x = next.x + next.dx * this.along;
    this.player.position.z = next.z + next.dz * this.along;
    this.player.aabbNeedsUpdate = true;
    this.extend();
    this.onEvent('corner');
  }
}
