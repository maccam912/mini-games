// Run manually to regenerate the local, offline game engines.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dest = fileURLToPath(new URL('../games/timberline-dash/vendor/', import.meta.url));
const cwd = mkdtempSync(path.join(tmpdir(), 'timberline-vendor-'));
try {
  execFileSync(
    'npm',
    ['install', '--no-audit', '--no-fund', '@babylonjs/core@9.37.0', 'cannon-es@0.20.0', 'esbuild@0.28.2'],
    { cwd, stdio: 'inherit' }
  );
  const entries = {
    babylon: [
      ['Engine', 'Engines/engine'],
      ['Scene', 'scene'],
      ['TargetCamera', 'Cameras/targetCamera'],
      ['Vector3', 'Maths/math.vector'],
      ['Color3, Color4', 'Maths/math.color'],
      ['Mesh', 'Meshes/mesh'],
      ['VertexData', 'Meshes/mesh.vertexData'],
      ['TransformNode', 'Meshes/transformNode'],
      ['StandardMaterial', 'Materials/standardMaterial'],
      ['HemisphericLight', 'Lights/hemisphericLight'],
      ['DirectionalLight', 'Lights/directionalLight']
    ]
      .map(([names, file]) => `export { ${names} } from '@babylonjs/core/${file}.js';`)
      .join('\n'),
    cannon: "export { World, Body, Box, Vec3, SAPBroadphase } from 'cannon-es';"
  };
  for (const [name, source] of Object.entries(entries)) {
    writeFileSync(path.join(cwd, name + '.js'), source);
    execFileSync(
      path.join(cwd, 'node_modules/.bin/esbuild'),
      [
        name + '.js',
        '--bundle',
        '--format=esm',
        '--minify',
        '--target=es2020',
        '--legal-comments=inline',
        '--outfile=' + path.join(dest, name + '.js')
      ],
      { cwd }
    );
  }
  for (const [source, target] of [
    ['@babylonjs/core/license.md', 'Babylon-LICENSE.txt'],
    ['@babylonjs/core/NOTICE.md', 'Babylon-NOTICE.txt'],
    ['cannon-es/LICENSE', 'Cannon-LICENSE.txt']
  ]) {
    copyFileSync(path.join(cwd, 'node_modules', source), path.join(dest, target));
  }
} finally {
  rmSync(cwd, { recursive: true, force: true });
}
