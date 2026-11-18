const WIDTH = 384;
const BASE_HEIGHT = 204;
const TAU = 2 * Math.PI;
const palettes = [
  ['#372439', '#643241', '#a14445', '#dc5944', '#fa784b', '#ffa85d', '#ffe19b'],
  ['#27223f', '#3f3466', '#60498b', '#8b69ad', '#b296d5', '#d6b9f3', '#f1dcff'],
  ['#162d40', '#214554', '#2f6b72', '#46928d', '#68b6a7', '#a1dbb8', '#d3efcb'],
  ['#322d42', '#524052', '#845553', '#b67654', '#dca257', '#f5ca73', '#f9e7ac'],
  ['#1d2a47', '#2d4169', '#425e8c', '#5a82ae', '#80aecb', '#add9e0', '#e0f2e6']
];

function seeded(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function makePlanet(planet) {
  const radius = planet.radius;
  const size = 2 * radius + 1;
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = size;
  const context = sprite.getContext('2d');
  const colors = palettes[planet.color];
  const random = seeded(planet.seed);
  const phase = random() * TAU;
  const craters = Array.from({ length: 8 }, () => ({
    x: random() * 1.65 - 0.86,
    y: random() * 1.55 - 0.78,
    r: 0.07 + random() ** 2 * 0.21
  }));
  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) {
      const nx = x / radius, ny = y / radius;
      const depth = 1 - nx * nx - ny * ny;
      if (depth < 0) continue;
      const nz = Math.sqrt(depth);
      const light = -0.48 * nx - 0.63 * ny + 0.54 * nz;
      const ridge = Math.sin(ny * 19 + Math.sin(nx * 6 + phase) * 1.4 + phase);
      let shade = 2.35 + 2.65 * light + 0.52 * ridge + (random() - 0.5) * 0.42;
      for (const crater of craters) {
        const cx = (nx - crater.x) * 1.05, cy = (ny - crater.y) * 1.24;
        const d = Math.sqrt(cx * cx + cy * cy) / crater.r;
        if (d >= 1) continue;
        shade += d > 0.73 ? (cy + cx > 0 ? 0.91 : -1.4) : -0.57;
      }
      if (depth < 0.11) shade += nx + ny < -0.3 ? 1.5 : -1.4;
      context.fillStyle = colors[Math.max(0, Math.min(6, Math.floor(shade)))];
      context.fillRect(x + radius, y + radius, 1, 1);
    }
  }
  return sprite;
}

function makeSky() {
  const tile = document.createElement('canvas');
  tile.width = 560;
  tile.height = 314;
  const ctx = tile.getContext('2d');
  ctx.fillStyle = '#121325';
  ctx.fillRect(0, 0, tile.width, tile.height);
  const random = seeded(188);
  // A softly dithered dust lane keeps the silhouettes legible at phone size.
  for (let i = 0; i < 8200; i++) {
    const x = Math.floor(random() * tile.width);
    const spread = (random() + random() + random() - 1.5) * 36;
    const y = Math.floor(125 - 37 * Math.sin(x / tile.width * TAU) + spread);
    ctx.fillStyle = ['#18172c', '#1d1a30', '#242037', '#2b213a'][Math.floor(random() * 4)];
    ctx.fillRect(x, y, 1 + Math.floor(random() * 3), 1);
  }
  for (let i = 0; i < 285; i++) {
    const x = Math.floor(random() * tile.width), y = Math.floor(random() * tile.height);
    ctx.fillStyle = ['#343048', '#56445f', '#897186', '#b6a4ba'][Math.floor(random() * 3.25)];
    ctx.fillRect(x, y, 1, 1);
    if (i % 37 === 0) {
      ctx.fillStyle = '#7a687d';
      ctx.fillRect(x - 2, y, 5, 1);
      ctx.fillRect(x, y - 2, 1, 5);
      ctx.fillStyle = '#ebd5bd';
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return tile;
}

const rocket = [
  '      rr    ',
  '    rrrww   ',
  '   wwwwbbww ',
  'fFwwwwwbbaaw',
  'ffwwwwwwwww ',
  '   rrrrww   ',
  '     rr     '
];
const shipColors = { r: '#fa6551', w: '#f8dfb7', b: '#77c9dd', a: '#d6f5eb', f: '#dd6349', F: '#ffd36c' };

export class Scene {
  constructor(canvas, reducedMotion) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.reducedMotion = reducedMotion;
    this.sky = makeSky();
    this.sprites = new WeakMap();
    this.camera = 0;
    this.particles = [];
    this.trailTime = 0;
    this.resize();
  }

  resize() {
    const bounds = this.canvas.getBoundingClientRect();
    this.canvas.width = WIDTH;
    this.canvas.height = Math.round(Math.max(157, Math.min(290, WIDTH * bounds.height / bounds.width || BASE_HEIGHT)));
  }

  reset() {
    this.camera = 0;
    this.particles = [];
  }

  burst(x, y, color, count) {
    if (this.reducedMotion) return;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * TAU;
      const speed = 9 + Math.random() * 36;
      this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 0.38 + Math.random() * 0.35, color: i % 3 ? color : '#ffe3a4' });
    }
  }

  draw(run, dt) {
    const desired = run.planet.x - 85;
    this.camera += (desired - this.camera) * (this.reducedMotion ? 1 : 1 - Math.exp(-dt * 5));
    const ctx = this.ctx;
    const h = this.canvas.height;
    const yOffset = Math.round((h - BASE_HEIGHT) / 2);
    const skyX = Math.floor(this.camera * 0.17) % this.sky.width;
    const skyY = Math.floor((h - this.sky.height) / 2);
    ctx.drawImage(this.sky, -skyX, skyY);
    ctx.drawImage(this.sky, this.sky.width - skyX, skyY);
    ctx.save();
    ctx.translate(-Math.round(this.camera), yOffset);
    this.drawPlanet(run.planet, false);
    this.drawPlanet(run.target, true);
    const ship = run.ship;
    const aiming = run.phase === 'aim' || run.phase === 'ready';
    if (aiming) {
      const locked = run.alignment.locked;
      const length = locked ? Math.min(198, run.alignment.forward) : 66;
      for (let i = 13; i < length; i += locked ? 5 : 7) {
        ctx.fillStyle = locked ? '#a5f5d6' : i < 45 ? '#ead1ad' : '#b79c9f';
        ctx.fillRect(Math.round(ship.x + Math.cos(ship.angle) * i),
          Math.round(ship.y + Math.sin(ship.angle) * i), 2, locked ? 2 : 1);
      }
    }
    this.trailTime += dt;
    if (run.phase === 'flight' && this.trailTime >= 0.035) {
      this.trailTime = 0;
      this.burst(ship.x - 4 * Math.cos(ship.angle), ship.y - 4 * Math.sin(ship.angle), '#f08353', 1);
    }
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.min(1, Math.max(0, p.life * 2.5));
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 1);
    }
    this.particles = this.particles.filter(p => p.life > 0);
    ctx.globalAlpha = 1;
    if (run.phase !== 'over') {
      ctx.save();
      ctx.translate(Math.round(ship.x), Math.round(ship.y));
      ctx.rotate(ship.angle);
      ctx.scale(1.45, 1.45);
      for (const [y, row] of rocket.entries()) {
        for (let x = 0; x < row.length; x++) {
          if (row[x] === ' ') continue;
          ctx.fillStyle = shipColors[row[x]];
          ctx.fillRect(x - 5.5, y - 3, 1.1, 1.1);
        }
      }
      ctx.restore();
    }
    ctx.restore();
  }

  drawPlanet(planet, target) {
    const ctx = this.ctx;
    let sprite = this.sprites.get(planet);
    if (!sprite) {
      sprite = makePlanet(planet);
      this.sprites.set(planet, sprite);
    }
    const r = planet.radius;
    const x = Math.round(planet.x), y = Math.round(planet.y);
    ctx.drawImage(sprite, x - r, y - r);
    ctx.strokeStyle = target ? '#716087' : '#8b615f';
    ctx.lineWidth = 0.7;
    ctx.setLineDash([1, 3]);
    ctx.beginPath();
    ctx.arc(x, y, r + 10, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    if (!target) return;
    const tip = y - r - 18;
    ctx.fillStyle = '#d9c6e4';
    ctx.fillRect(x - 2, tip - 2, 5, 1);
    ctx.fillRect(x - 1, tip - 1, 3, 1);
    ctx.fillRect(x, tip, 1, 1);
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('NEXT', x + 0.5, tip - 5);
  }
}
