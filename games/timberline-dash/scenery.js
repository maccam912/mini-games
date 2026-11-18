import { Geometry } from './meshes.js';
import { DECK_WIDTH, randomSequence } from './trail.js';

function spruce(g, x, y, z, h, rand) {
  g.box(x, y + h * 0.16, z, h * 0.085, h * 0.36, h * 0.085, '#795e4c');
  const pine = rand() > 0.5 ? ['#224f50', '#326359', '#437966'] : ['#305b59', '#447469', '#538675'];
  for (let j = 0; j < 3; j++) {
    const base = h * (0.19 + j * 0.19);
    const r = h * (0.27 - j * 0.055);
    g.hill(
      x,
      y + base,
      z,
      [
        [0, r, r],
        [h * (0.46 - j * 0.015), 0.015, 0.015]
      ],
      6,
      pine[j],
      j * 0.32
    );
  }
}

function highlands(g, s, rand) {
  for (let z = 2; z < s.length; z += 9) {
    for (const side of [-1, 1]) {
      const x = side * (8 + rand() * 18);
      const top = -3 - rand() * 6;
      const radius = 5 + rand() * 8;
      g.hill(
        x,
        top,
        z,
        [
          [-18, radius * 0.7, radius],
          [-4, radius * 1.15, radius],
          [0, radius * 0.66, radius * 0.7]
        ],
        7,
        (i, j) => (j === 1 ? ['#719275', '#77967a', '#64866d'][i % 3] : '#697f7c')
      );
      for (let j = 0; j < 5; j++) {
        const tx = x + (rand() - 0.5) * radius * 0.9;
        // Keep the camera and the perpendicular trestle clear around bends.
        const height = z < 11 || z > s.length - 12 ? -top - 0.6 : 2.5 + rand() * 6;
        spruce(g, tx, top - 0.6, z + (rand() - 0.5) * radius * 0.7, Math.max(2, height), rand);
      }
    }
  }
}

function gate(g, h) {
  const z = h.at;
  if (h.kind === 'jump') {
    g.beam([-2.19, 0.31, z - 0.08], [2.13, 0.31, z + 0.08], 0.34, '#a85634', 9);
    for (const x of [-1.65, -1.4, 1.4, 1.65])
      g.beam([x, 0.31, z + x * 0.038], [x + 0.1, 0.31, z + (x + 0.1) * 0.038], 0.355, '#f7cb81', 9);
    g.beam([0.72, 0.46, z], [0.92, 0.76, z + 0.02], 0.105, '#975332');
    return;
  }
  for (const side of [-1, 1]) {
    g.box(side * 2.12, 1.28, z, 0.2, 2.56, 0.3, '#624437');
    g.box(side * 2.12, 2.54, z, 0.28, 0.12, 0.36, '#daaa6b');
  }
  g.box(0, 2.3, z, 4.48, 0.22, 0.48, '#916f4b');
  g.box(0, 1.51, z, 4.3, 1.46, 0.19, '#e5a431');
  g.box(0, 0.83, z, 4.3, 0.11, 0.22, '#633e32');
  for (const x of [-1.55, 0, 1.55]) {
    g.beam([x - 0.25, 1.77, z - 0.12], [x, 1.47, z - 0.12], 0.096, '#433e36', 4);
    g.beam([x, 1.47, z - 0.12], [x + 0.25, 1.77, z - 0.12], 0.096, '#433e36', 4);
  }
}

export function buildSection(s, scene, mat) {
  const g = new Geometry();
  const rand = randomSequence(s.seed);
  highlands(g, s, rand);
  const begin = s.index ? DECK_WIDTH / 2 : -9;
  const end = s.length + DECK_WIDTH / 2;
  const length = end - begin;
  for (const side of [-1, 1]) {
    const x = side * 1.72;
    g.box(x, -0.48, (begin + end) / 2, 0.4, 0.65, length, '#745140');
    for (let z = begin + 1.4; z < end - 1; z += 5.8) {
      g.box(x, -5, z, 0.34, 9.5, 0.44, '#765a4b');
      g.box(x, 0.2, z, 0.2, 0.54, 0.26, '#7b5642');
      g.box(x, 0.49, z, 0.23, 0.09, 0.29, '#e4b460');
      if (z + 5.8 < end) g.beam([x, -3.7, z], [x, -0.7, z + 5.8], 0.17, '#a17a55', 4);
    }
  }
  const boards = ['#b78559', '#c79666', '#d1a373', '#bc8b60', '#c2946a'];
  for (let z = begin; z < end - 0.001; z += 0.63) {
    const d = Math.min(0.63, end - z);
    g.box(
      0,
      -0.105,
      z + d / 2,
      DECK_WIDTH - 0.035 * rand(),
      0.21,
      Math.max(0.03, d - 0.023),
      boards[Math.floor(rand() * boards.length)]
    );
    if (d > 0.15) {
      for (const x of [-1.7, 1.7]) g.box(x, 0.003, z + d * 0.48, 0.047, 0.009, 0.049, '#826346');
      if (rand() < 0.54) {
        const x = (rand() - 0.5) * 3.3,
          grain = 0.19 + rand() * 0.71;
        g.face(
          [x - grain / 2, 0.005, z + d * 0.24],
          [x + grain / 2, 0.005, z + d * 0.26],
          [x + 0.06, 0.005, z + d * 0.32],
          [x, 0, z],
          '#ac8059'
        );
      }
    }
  }
  for (const h of s.hazards) gate(g, h);
  const sign = s.side === 'right' ? 1 : -1;
  // A painted switchback arrow faces the player at the far edge of the junction.
  const z = s.length + 1.78;
  g.box(0, 0.65, z, 0.2, 1.3, 0.2, '#684d40');
  g.box(0, 1.53, z, 1.69, 0.89, 0.15, '#194e4b');
  g.box(0, 1.53, z - 0.09, 0.97, 0.13, 0.04, '#fff0bd');
  for (const dy of [-1, 1])
    g.beam([0.22 * sign, 1.53 + 0.25 * dy, z - 0.13], [0.52 * sign, 1.53, z - 0.13], 0.09, '#fff0bd', 4);
  for (let j = 0; j < 4; j++) {
    for (const x of [-1.95, 1.95]) g.box(x, 0.012, s.length - 1 - j * 1.4, 0.24, 0.02, 0.65, '#f2c16d');
  }
  const mesh = g.mesh('trestle ' + s.index, scene, mat);
  mesh.position.set(s.x, 0, s.z);
  mesh.rotation.y = s.heading;
  mesh.freezeWorldMatrix();
  return mesh;
}

export function buildHorizon(scene, mat) {
  const g = new Geometry();
  const rand = randomSequence(509675);
  for (let i = 0; i < 42; i++) {
    const angle = (i * 2 * Math.PI) / 42;
    const dist = 124 + rand() * 46;
    const x = Math.sin(angle) * dist,
      z = Math.cos(angle) * dist;
    const h = 31 + rand() * 40;
    const r = 21 + rand() * 24;
    const n = 9;
    const phase = rand() * 2;
    const points = Array.from({ length: n }, (_, j) => {
      const a = (j * 2 * Math.PI) / n + phase;
      return [Math.cos(a) * r * (0.82 + rand() * 0.3), Math.sin(a) * r * (0.82 + rand() * 0.3), rand()];
    });
    const ox = (rand() - 0.5) * r * 1.12;
    const levels = [
      [0, 1],
      [0.48, 0.62],
      [0.73, 0.32],
      [1, 0.012]
    ];
    const rows = levels.map(([level, width], j) =>
      points.map(([dx, dz, noise]) => [
        x + dx * width + ox * level,
        -24 + h * (level + (j === 2 ? (noise - 0.5) * 0.33 : 0)),
        z + dz * width
      ])
    );
    g.rings(rows, [x, -19, z], (face, band) =>
      band === 2
        ? ['#fff2dc', '#e1e3d9', '#d0d9db'][face % 3]
        : ['#647f98', '#8b8394', '#637a91', '#71899e'][face % 4]
    );
  }
  // Lower ridges and a river fill the valley below the trestles.
  for (let i = 0; i < 29; i++) {
    const a = (i * 2 * Math.PI) / 29,
      r = 80 + rand() * 18,
      h = 14 + rand() * 13;
    g.hill(
      Math.sin(a) * r,
      -24,
      Math.cos(a) * r,
      [
        [0, 34, 34],
        [h * 0.61, 19, 21],
        [h, 3, 6]
      ],
      8,
      '#608b81',
      a
    );
  }
  g.box(0, -21, 0, 450, 1, 450, '#75aca6');
  return g.mesh('alpine skyline', scene, mat);
}

export function buildSky(scene, material) {
  const g = new Geometry();
  const sun = [27, 53, 206];
  const rim = Array.from({ length: 36 }, (_, i) => {
    const a = (i * Math.PI) / 18;
    return [sun[0] + 12 * Math.cos(a), sun[1] + 12 * Math.sin(a), sun[2]];
  });
  for (let i = 0; i < rim.length; i++)
    g.face(sun, rim[i], rim[(i + 1) % rim.length], [27, 53, 207], '#ffb371');
  const rand = randomSequence(6237);
  for (let i = 0; i < 26; i++) {
    const a = (i * Math.PI) / 13;
    const x = 196 * Math.sin(a),
      z = 196 * Math.cos(a);
    const y = 29 + rand() * 32,
      size = 3 + rand() * 5;
    for (let j = 0; j < 3; j++) {
      const offset = (j - 1) * size;
      const h = size * (j === 1 ? 0.8 : 0.38);
      g.hill(
        x + Math.cos(a) * offset,
        y,
        z - Math.sin(a) * offset,
        [
          [0, size * 1.3, size * 0.37],
          [h * 0.33, size * 1.4, size * 0.4],
          [h, size * 0.5, size * 0.22]
        ],
        7,
        (_side, band) => (band ? '#ffe5bb' : '#f8d4b0'),
        a
      );
    }
  }
  const mesh = g.mesh('sun and cirrus', scene, material);
  mesh.applyFog = false;
  return mesh;
}
