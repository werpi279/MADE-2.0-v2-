import * as THREE from 'three';
import type { GeometryEngine, SculptOp } from '../../types/modules';
import type { IntentGraph, Mesh } from '../../types/intent-graph';
import { SculptEngine } from './sculpt-engine';
import { BubbleRegion } from './bubble-region';
import { createPlaceholderMesh } from './primitives';

// V1: sculpt engine wired. V3+: assemble builds from graph.nodes using TubeBuilder/FrameExtruder/CSG.
// Swappable to SdfVoxelEngine via config.geometryEngine = 'sdf-voxel'.

export class MeshEngine implements GeometryEngine {
  private readonly placeholder: Mesh;
  // Per-mesh SculptEngine cache — keyed by mesh UUID.
  // A new engine is built on first sculpt call and reused until the mesh is replaced.
  private readonly engines = new Map<string, SculptEngine>();

  constructor() {
    this.placeholder = createPlaceholderMesh();
  }

  assemble(graph: IntentGraph): Mesh | null {
    // V3+: walk graph.nodes, place parts, blend joints, snap constraints.
    // For now, return the placeholder so the renderer always has something to display.
    if (graph.nodes.length === 0) return this.placeholder;
    return this.placeholder;
  }

  sculpt(mesh: Mesh, op: SculptOp): Mesh {
    const engine = this._engine(mesh);
    const localPt = new THREE.Vector3(...op.position);

    switch (op.kind) {
      case 'push':
      case 'pull': {
        const hit  = engine.query(localPt);
        const sign = op.kind === 'push' ? 1 : -1;
        const delta = hit.normal.multiplyScalar(sign * op.magnitude);
        engine.deform(localPt, delta, op.radius);
        break;
      }
      case 'smooth': {
        // Zero delta → positions unchanged, Laplacian smooth still runs over
        // every vertex inside the falloff radius.
        engine.deform(localPt, new THREE.Vector3(), op.radius);
        break;
      }
      case 'scale': {
        const bubble = new BubbleRegion(localPt, op.radius, engine.getPositions());
        engine.scaleCapture(bubble.weights, localPt, 1 + op.magnitude);
        break;
      }
    }

    return mesh;
  }

  /** Call after a sculpt session ends so the BVH is rebuilt once (not per frame). */
  rebuildBVH(mesh: Mesh): void {
    this.engines.get(mesh.uuid)?.rebuildBVH();
  }

  private _engine(mesh: Mesh): SculptEngine {
    let e = this.engines.get(mesh.uuid);
    if (!e) {
      e = new SculptEngine(mesh as THREE.Mesh);
      this.engines.set(mesh.uuid, e);
    }
    return e;
  }
}
