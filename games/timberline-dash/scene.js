import {
  Engine,
  Scene,
  TargetCamera,
  TransformNode,
  StandardMaterial,
  Color3,
  Color4,
  Vector3,
  HemisphericLight,
  DirectionalLight
} from './vendor/babylon.js';
import { Geometry } from './meshes.js';
import { buildSection, buildHorizon, buildSky } from './scenery.js';

function courier(scene, material) {
  const root = new TransformNode('courier', scene);
  const body = new TransformNode('stride', scene);
  body.parent = root;
  const fur = new Geometry();
  const amber = '#df682b',
    dark = '#643f37',
    cream = '#fff0cb';
  fur.fur(
    [
      [-0.64, 0.62, 0.16, 0.17],
      [-0.41, 0.64, 0.3, 0.32],
      [0.24, 0.7, 0.29, 0.32],
      [0.47, 0.75, 0.19, 0.23]
    ],
    amber
  );
  fur.fur(
    [
      [0.25, 0.91, 0.19, 0.22],
      [0.41, 0.96, 0.36, 0.3],
      [0.63, 0.92, 0.31, 0.24],
      [0.86, 0.82, 0.1, 0.1]
    ],
    (i) => (i >= 4 ? cream : '#e97a34')
  );
  fur.fur(
    [
      [0.79, 0.84, 0.105, 0.085],
      [0.87, 0.84, 0.092, 0.069],
      [0.91, 0.84, 0.062, 0.045]
    ],
    '#393a37'
  );
  for (const side of [-1, 1]) {
    const x = side * 0.235;
    fur.hill(
      x,
      1.09,
      0.38,
      [
        [0, 0.15, 0.135],
        [0.27, 0.043, 0.038, side * 0.055],
        [0.34, 0.006, 0.006, side * 0.06]
      ],
      4,
      (i, j) => (j ? dark : '#d86529')
    );
    fur.box(side * 0.257, 1.0, 0.666, 0.065, 0.073, 0.063, '#33352f');
  }
  // Canvas mailbag with a buckled flap and two brass rivets.
  fur.fur(
    [
      [-0.26, 0.68, 0.287, 0.31],
      [-0.19, 0.68, 0.3, 0.33],
      [-0.12, 0.68, 0.3, 0.32]
    ],
    '#5d4e37'
  );
  fur.box(0.21, 0.8, -0.13, 0.27, 0.31, 0.43, '#285d58');
  fur.box(0.22, 0.961, -0.14, 0.29, 0.055, 0.45, '#548b78');
  fur.box(0.23, 0.84, -0.351, 0.072, 0.14, 0.023, '#cda056');
  fur.box(0.23, 0.87, -0.367, 0.081, 0.048, 0.025, '#f4ce78');
  fur.mesh('red fox and mailbag', scene, material).parent = body;
  const brush = new Geometry();
  brush.fur(
    [
      [0.08, 0, 0.11, 0.13],
      [-0.23, 0.02, 0.21, 0.19],
      [-0.53, 0.16, 0.24, 0.23],
      [-0.83, 0.32, 0.17, 0.17],
      [-1.07, 0.46, 0.025, 0.025]
    ],
    (i, j) => (j >= 3 ? cream : i > 3 ? '#bd5228' : amber)
  );
  const tail = brush.mesh('white tipped brush', scene, material);
  tail.parent = body;
  tail.position.set(0, 0.59, -0.49);
  const legs = [];
  for (const x of [-0.19, 0.19])
    for (const z of [-0.37, 0.28]) {
      const limb = new Geometry();
      limb.beam([0, 0, 0], [0, -0.25, -0.035], 0.1, amber, 5);
      limb.beam([0, -0.23, -0.035], [0, -0.47, 0.035], 0.078, dark, 5);
      limb.fur(
        [
          [-0.04, -0.46, 0.07, 0.06],
          [0.05, -0.46, 0.083, 0.071],
          [0.15, -0.48, 0.048, 0.04]
        ],
        dark
      );
      const mesh = limb.mesh('paw', scene, material);
      mesh.parent = body;
      mesh.position.set(x, 0.53, z);
      legs.push(mesh);
    }
  return { root, body, tail, legs };
}

const mix = (a, b, t) => a + (b - a) * t;
export class AlpineScene {
  constructor(canvas) {
    this.engine = new Engine(
      canvas,
      true,
      { alpha: true, stencil: false, powerPreference: 'high-performance' },
      false
    );
    this.engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 1.6));
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0, 0, 0, 0);
    this.scene.skipPointerMovePicking = true;
    this.scene.fogMode = Scene.FOGMODE_LINEAR;
    this.scene.fogStart = 42;
    this.scene.fogEnd = 240;
    this.scene.fogColor = Color3.FromHexString('#c2c2bb');
    this.camera = new TargetCamera('chase', new Vector3(0, 3, -5), this.scene);
    this.camera.minZ = 0.1;
    this.camera.maxZ = 330;
    this.camera.fov = 0.91;
    const hemi = new HemisphericLight('skylight', new Vector3(0, 1, 0), this.scene);
    hemi.intensity = 0.85;
    hemi.groundColor = Color3.FromHexString('#aeaba0');
    const sun = new DirectionalLight('afternoon sun', new Vector3(0.62, -0.9, 0.4), this.scene);
    sun.intensity = 0.57;
    sun.diffuse = Color3.FromHexString('#ffdfb6');
    this.mat = new StandardMaterial('trail colours', this.scene);
    this.mat.specularColor = Color3.Black();
    this.mat.backFaceCulling = false;
    this.mat.freeze();
    const skyMaterial = new StandardMaterial('unlit sky', this.scene);
    skyMaterial.disableLighting = true;
    skyMaterial.emissiveColor = Color3.White();
    skyMaterial.backFaceCulling = false;
    this.sky = buildSky(this.scene, skyMaterial);
    this.horizon = buildHorizon(this.scene, this.mat);
    this.fox = courier(this.scene, this.mat);
    const shade = new Geometry();
    shade.hill(
      0,
      0,
      0,
      [
        [0, 0.31, 0.68],
        [0.009, 0.31, 0.68]
      ],
      12,
      '#765c4a'
    );
    this.shadow = shade.mesh('contact shadow', this.scene, this.mat);
    this.sections = new Map();
    this.look = new Vector3();
    this.phase = 0;
    this.yaw = 0;
    this.crouch = 1;
    this.resize = new ResizeObserver(() => this.engine.resize());
    this.resize.observe(canvas);
  }

  reset(run) {
    for (const mesh of this.sections.values()) mesh.dispose();
    this.sections.clear();
    this.yaw = run.current.heading;
    this.crouch = 1;
    this.phase = 0;
    this.draw(run, 0);
  }

  draw(run, dt) {
    for (const s of run.sections) {
      if (!this.sections.has(s.index)) this.sections.set(s.index, buildSection(s, this.scene, this.mat));
    }
    for (const [i, mesh] of this.sections)
      if (i < run.index - 1) {
        mesh.dispose();
        this.sections.delete(i);
      }
    const { x, z } = run.player.position;
    this.yaw = mix(this.yaw, run.current.heading, 1 - Math.exp(-dt * 8));
    const dx = Math.sin(this.yaw),
      dz = Math.cos(this.yaw);
    this.horizon.position.set(x, 0, z);
    this.sky.position.set(x, 0, z);
    const feet = run.footY;
    const fox = this.fox;
    this.phase += dt * run.speed * 2.1;
    this.crouch = mix(this.crouch, run.sliding ? 0.4 : 1, 1 - Math.exp(-dt * 25));
    fox.root.position.set(x, feet, z);
    fox.root.rotation.y = this.yaw;
    fox.body.scaling.set(1, this.crouch, run.sliding ? 1.12 : 1);
    const stride = !run.sliding && run.grounded;
    fox.body.position.y = stride ? Math.abs(Math.sin(this.phase)) * 0.045 : 0;
    fox.body.rotation.x = run.grounded ? 0 : -Math.max(-0.22, Math.min(0.22, run.player.velocity.y * 0.028));
    fox.tail.rotation.y = 0.17 * Math.sin(this.phase * 0.65) + 0.27;
    fox.tail.rotation.x = -0.08 + 0.16 * Math.cos(this.phase);
    fox.legs.forEach((leg, i) => {
      leg.rotation.x = stride ? 0.63 * Math.sin(this.phase + (i === 1 || i === 2 ? Math.PI : 0)) : -0.46;
    });
    this.shadow.position.set(x, 0.014, z);
    this.shadow.rotation.y = this.yaw;
    this.shadow.setEnabled(!run.missed);
    const shadowScale = Math.max(0.4, 1 - Math.max(feet, 0) * 0.28);
    this.shadow.scaling.set(shadowScale, 1, shadowScale);
    const chase = 6.1;
    const rise = Math.max(0, feet) * 0.24;
    this.camera.position.set(x - dx * chase + dz * 0.48, 2.95 + rise, z - dz * chase - dx * 0.48);
    this.look.set(x + dx * 5.0, 1.02 + rise, z + dz * 5.0);
    this.camera.setTarget(this.look);
    this.scene.render();
  }
}
