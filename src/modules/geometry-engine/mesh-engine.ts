import * as THREE from 'three';
import type { GeometryEngine, SculptOp } from '../../types/modules';
import type { IntentGraph, Mesh } from '../../types/intent-graph';

// V1: port v1 engine here — three + three-mesh-bvh + three-bvh-csg + Laplacian sculpt.
// V0: returns a placeholder box so the renderer has something to display.
export class MeshEngine implements GeometryEngine {
  private readonly placeholder: THREE.Mesh;

  constructor() {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x4a90d9 });
    this.placeholder = new THREE.Mesh(geo, mat);
  }

  assemble(graph: IntentGraph): Mesh | null {
    if (graph.nodes.length === 0) return this.placeholder;
    // V1+: walk graph.nodes, assemble parts, blend joints, snap constraints
    return this.placeholder;
  }

  sculpt(mesh: Mesh, _op: SculptOp): Mesh {
    // V1+: Laplacian push/pull/scale/smooth with hand-openness falloff
    return mesh;
  }
}
