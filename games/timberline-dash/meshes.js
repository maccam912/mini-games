import { Mesh, VertexData } from './vendor/babylon.js';

const palette = new Map();
function rgb(hex) {
  if (!palette.has(hex)) {
    const value = parseInt(hex.slice(1), 16);
    palette.set(
      hex,
      [value >> 16, (value >> 8) & 255, value & 255].map((channel) => channel / 255)
    );
  }
  return palette.get(hex);
}
const sub = (a, b) => a.map((n, i) => n - b[i]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => {
  const len = Math.hypot(...a) || 1;
  return a.map((n) => n / len);
};

// Batch each stretch of scenery into one flat-shaded, vertex-coloured mesh.
export class Geometry {
  positions = [];
  indices = [];
  colors = [];
  normals = [];

  face(a, b, c, inside, color) {
    let normal = unit(cross(sub(b, a), sub(c, a)));
    const outward = sub(a, inside);
    if (normal.reduce((sum, n, i) => sum + n * outward[i], 0) < 0) {
      [b, c] = [c, b];
      normal = normal.map((n) => -n);
    }
    const start = this.positions.length / 3;
    this.positions.push(...a, ...b, ...c);
    this.indices.push(start, start + 2, start + 1);
    const tint = rgb(color);
    for (let i = 0; i < 3; i++) {
      this.colors.push(...tint, 1);
      this.normals.push(...normal);
    }
  }

  rings(rows, center, color) {
    const n = rows[0].length;
    const shade = (i, j) => (typeof color === 'function' ? color(i, j) : color);
    for (let j = 1; j < rows.length; j++) {
      for (let i = 0; i < n; i++) {
        const k = (i + 1) % n;
        this.face(rows[j - 1][i], rows[j - 1][k], rows[j][i], center, shade(i, j - 1));
        this.face(rows[j][i], rows[j - 1][k], rows[j][k], center, shade(i, j - 1));
      }
    }
    for (const j of [0, rows.length - 1]) {
      for (let i = 1; i < n - 1; i++)
        this.face(rows[j][0], rows[j][i], rows[j][i + 1], center, shade(i, Math.max(0, j - 1)));
    }
  }

  box(x, y, z, w, h, d, color) {
    this.rings(
      [-1, 1].map((s) =>
        [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1]
        ].map(([a, b]) => [x + (a * w) / 2, y + (s * h) / 2, z + (b * d) / 2])
      ),
      [x, y, z],
      color
    );
  }

  // Cross sections perpendicular to the y axis.
  hill(x, y, z, rows, sides, color, phase = 0.25) {
    this.rings(
      rows.map(([dy, rx, rz, ox = 0, oz = 0]) =>
        Array.from({ length: sides }, (_, i) => {
          const a = (i * Math.PI * 2) / sides + phase;
          return [x + ox + rx * Math.cos(a), y + dy, z + oz + rz * Math.sin(a)];
        })
      ),
      [x, y + (rows[0][0] + rows.at(-1)[0]) * 0.5, z],
      color
    );
  }

  // Cross sections perpendicular to the z axis, for the fox's tapered silhouette.
  fur(rows, color) {
    const n = 8;
    this.rings(
      rows.map(([z, y, w, h, x = 0]) =>
        Array.from({ length: n }, (_, i) => {
          const a = ((i + 0.5) * 2 * Math.PI) / n;
          return [x + Math.cos(a) * w, y + Math.sin(a) * h, z];
        })
      ),
      [rows[1][4] ?? 0, rows[1][1], rows[1][0]],
      color
    );
  }

  beam(a, b, radius, color, sides = 5) {
    const axis = unit(sub(b, a));
    const u = unit(cross(axis, Math.abs(axis[1]) < 0.8 ? [0, 1, 0] : [1, 0, 0]));
    const v = cross(axis, u);
    this.rings(
      [a, b].map((p) =>
        Array.from({ length: sides }, (_, i) => {
          const angle = ((i + 0.5) * Math.PI * 2) / sides;
          return p.map((n, j) => n + radius * (Math.cos(angle) * u[j] + Math.sin(angle) * v[j]));
        })
      ),
      a.map((n, i) => (n + b[i]) / 2),
      color
    );
  }

  mesh(name, scene, material) {
    const mesh = new Mesh(name, scene);
    const data = new VertexData();
    Object.assign(data, {
      positions: this.positions,
      indices: this.indices,
      colors: this.colors,
      normals: this.normals
    });
    data.applyToMesh(mesh);
    mesh.material = material;
    mesh.isPickable = false;
    return mesh;
  }
}
