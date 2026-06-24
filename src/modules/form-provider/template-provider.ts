import * as THREE from 'three';
import type { FormProvider, FormRequest } from '../../types/modules';
import type { Mesh } from '../../types/intent-graph';

const CLAY = new THREE.MeshStandardMaterial({ color: 0xc4845a, roughness: 0.88, metalness: 0 });

type Builder = () => THREE.Mesh;

function _mesh(geo: THREE.BufferGeometry, size: [number, number, number]): THREE.Mesh {
  const m = new THREE.Mesh(geo, CLAY.clone());
  m.userData = { size };
  return m;
}

// Namer tier: maps concept keywords → parametric template meshes.
// Returns null for unknown concepts → falls through to GenerationProvider.
const TEMPLATES = new Map<string, Builder>([
  ['sphere',   () => _mesh(new THREE.SphereGeometry(0.5, 16, 12),         [1, 1, 1])],
  ['ball',     () => _mesh(new THREE.SphereGeometry(0.5, 16, 12),         [1, 1, 1])],
  ['globe',    () => _mesh(new THREE.SphereGeometry(0.5, 16, 12),         [1, 1, 1])],
  ['orb',      () => _mesh(new THREE.SphereGeometry(0.5, 16, 12),         [1, 1, 1])],
  ['cylinder', () => _mesh(new THREE.CylinderGeometry(0.25, 0.25, 1, 12), [0.5, 1, 0.5])],
  ['tube',     () => _mesh(new THREE.CylinderGeometry(0.25, 0.25, 1, 12), [0.5, 1, 0.5])],
  ['pipe',     () => _mesh(new THREE.CylinderGeometry(0.25, 0.25, 1, 12), [0.5, 1, 0.5])],
  ['column',   () => _mesh(new THREE.CylinderGeometry(0.2,  0.2,  1.5, 12), [0.4, 1.5, 0.4])],
  ['box',      () => _mesh(new THREE.BoxGeometry(1, 1, 1),                [1, 1, 1])],
  ['cube',     () => _mesh(new THREE.BoxGeometry(1, 1, 1),                [1, 1, 1])],
  ['block',    () => _mesh(new THREE.BoxGeometry(1.5, 0.75, 0.75),        [1.5, 0.75, 0.75])],
  ['slab',     () => _mesh(new THREE.BoxGeometry(2, 0.2, 1),              [2, 0.2, 1])],
  ['disc',     () => _mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.15, 24), [1.2, 0.15, 1.2])],
  ['cone',     () => _mesh(new THREE.ConeGeometry(0.5, 1, 12),            [1, 1, 1])],
  ['pyramid',  () => _mesh(new THREE.ConeGeometry(0.5, 1, 4),             [1, 1, 1])],
  ['ring',     () => _mesh(new THREE.TorusGeometry(0.5, 0.15, 8, 24),     [1.3, 1.3, 0.3])],
  ['torus',    () => _mesh(new THREE.TorusGeometry(0.5, 0.15, 8, 24),     [1.3, 1.3, 0.3])],
  ['donut',    () => _mesh(new THREE.TorusGeometry(0.5, 0.15, 8, 24),     [1.3, 1.3, 0.3])],
  ['dome',     () => _mesh(new THREE.SphereGeometry(0.6, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), [1.2, 0.6, 1.2])],
]);

export class TemplateProvider implements FormProvider {
  async provide(req: FormRequest): Promise<Mesh | null> {
    const key = req.concept.toLowerCase().trim();
    const build = TEMPLATES.get(key);
    return build ? build() : null;
  }
}
