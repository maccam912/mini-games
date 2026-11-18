const TURN = Math.PI * 2;
const FLIGHT_SPEED = 178;

// All distances are in playfield pixels. A planet captures the ship as
// soon as it enters the dashed orbit, before it reaches the surface.
export class OrbitRun {
  constructor(random = Math.random) {
    this.random = random;
    this.reset();
  }

  reset() {
    this.score = 0;
    this.phase = 'ready';
    this.planet = { x: 85, y: 119, radius: 35, seed: 9, color: 0 };
    this.target = { x: 268, y: 91, radius: 26, seed: 23, color: 1 };
    this.angle = -1.13;
    this.spin = 1;
    this.flight = null;
  }

  start() {
    this.reset();
    this.phase = 'aim';
  }

  get ship() {
    if (this.flight) return this.flight;
    const radius = this.planet.radius + 10;
    return {
      x: this.planet.x + radius * Math.cos(this.angle),
      y: this.planet.y + radius * Math.sin(this.angle),
      angle: this.angle
    };
  }

  get alignment() {
    const ship = this.ship;
    const dx = this.target.x - ship.x;
    const dy = this.target.y - ship.y;
    const forward = dx * Math.cos(ship.angle) + dy * Math.sin(ship.angle);
    const offset = Math.abs(dx * Math.sin(ship.angle) - dy * Math.cos(ship.angle));
    return { forward, offset, locked: forward > 0 && offset <= this.target.radius + 10 };
  }

  launch() {
    if (this.phase !== 'aim') return;
    this.flight = { ...this.ship, missTime: 0 };
    this.phase = 'flight';
  }

  step(dt) {
    if (this.phase === 'aim') {
      const speed = Math.min(2.12, 1.02 + 0.075 * this.score);
      this.angle = (this.angle + this.spin * speed * dt) % TURN;
    }
    if (this.phase !== 'flight') return;

    const ship = this.flight;
    const { forward, offset } = this.alignment;
    const captureRadius = this.target.radius + 10;
    const travel = dt * FLIGHT_SPEED;
    // Test the swept segment so a frame boundary cannot skip a grazing hit.
    if (offset <= captureRadius) {
      const halfChord = Math.sqrt(captureRadius ** 2 - offset ** 2);
      if (forward + halfChord >= 0 && forward - halfChord <= travel) {
        const entry = Math.max(0, forward - halfChord);
        ship.x += entry * Math.cos(ship.angle);
        ship.y += entry * Math.sin(ship.angle);
        this.angle = Math.atan2(ship.y - this.target.y, ship.x - this.target.x);
        this.planet = this.target;
        this.score += 1;
        this.spin = this.score % 2 ? -1 : 1;
        this.target = {
          x: this.planet.x + 141 + this.random() * 38,
          y: 72 + this.random() * 62,
          radius: 18 + Math.floor(this.random() * 12),
          seed: Math.floor(this.random() * 65536),
          color: (this.planet.color + 1 + Math.floor(this.random() * 3)) % 5
        };
        this.flight = null;
        this.phase = 'aim';
        return 'land';
      }
    }
    ship.x += travel * Math.cos(ship.angle);
    ship.y += travel * Math.sin(ship.angle);
    if (forward <= 0) ship.missTime += dt;
    if (ship.missTime > 0.35 || ship.y < -22 || ship.y > 226 ||
        ship.x < this.planet.x - 95 || ship.x > this.target.x + 55) {
      this.phase = 'over';
      return 'miss';
    }
  }
}
