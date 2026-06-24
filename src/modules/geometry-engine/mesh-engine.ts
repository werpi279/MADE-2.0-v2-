import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { GeometryEngine, SculptOp } from '../../types/modules';
import type { IntentGraph, Mesh, PartNode } from '../../types/intent-graph';
import { SculptEngine } from './sculpt-engine';
import { BubbleRegion } from './bubble-region';
import { createPlaceholderMesh } from './primitives';

const CLAY_MAT = new THREE.MeshStandardMaterial({ color: 0xc4845a, roughness: 0.88, metalness: 0 });

// V1: sculpt engine wired. V3: assemble builds from graph.nodes.
// V3+: TubeBuilder/FrameExtruder/CSG blend joints. Swap to SdfVoxelEngine via config.
export class MeshEngine implements GeometryEngine {
  private readonly placeholder: Mesh;
  private readonly engines = new Map<string, SculptEngine>();
  private assemblyCache: { key: string; mesh: THREE.Mesh } | null = null;

  constructor() {
    this.placeholder = createPlaceholderMesh();
  }

  assemble(graph: IntentGraph): Mesh | null {
    if (graph.nodes.length === 0) return this.placeholder;

    const key = _nodesKey(graph.nodes);
    if (this.assemblyCache?.key === key) return this.assemblyCache.mesh;

    const geos: THREE.BufferGeometry[] = [];
    for (const node of graph.nodes) {
      const geo = _nodeGeo(node);
      // Bake transform into geometry so we can merge heterogeneous primitives
      const m4 = new THREE.Matrix4().compose(
        new THREE.Vector3(...node.transform.position),
        new THREE.Quaternion(node.transform.rotation.x, node.transform.rotation.y,
                             node.transform.rotation.z, node.transform.rotation.w),
        new THREE.Vector3(...node.transform.scale),
      );
      geo.applyMatrix4(m4);
      geo.computeVertexNormals();
      geos.push(geo);
    }

    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos) ?? geos[0];
    merged.computeVertexNormals();

    const mesh = new THREE.Mesh(merged, CLAY_MAT.clone());
    this.assemblyCache = { key, mesh };
    return mesh;
  }

  sculpt(mesh: Mesh, op: SculptOp): Mesh {
    const engine  = this._engine(mesh);
    const localPt = new THREE.Vector3(...op.position);

    switch (op.kind) {
      case 'push':
      case 'pull': {
        const hit   = engine.query(localPt);
        const sign  = op.kind === 'push' ? 1 : -1;
        const delta = hit.normal.multiplyScalar(sign * op.magnitude);
        engine.deform(localPt, delta, op.radius);
        break;
      }
      case 'smooth':
        engine.deform(localPt, new THREE.Vector3(), op.radius);
        break;
      case 'scale': {
        const bubble = new BubbleRegion(localPt, op.radius, engine.getPositions());
        engine.scaleCapture(bubble.weights, localPt, 1 + op.magnitude);
        break;
      }
    }
    return mesh;
  }

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

function _nodeGeo(node: PartNode): THREE.BufferGeometry {
  const [w, h, d] = node.params.size;
  switch (node.concept) {
    case 'sphere':   return new THREE.SphereGeometry(w / 2, 16, 12);
    case 'cylinder': return new THREE.CylinderGeometry(w / 2, w / 2, h, 12);
    default:         return new THREE.BoxGeometry(w, h, d);
  }
}

function _nodesKey(nodes: PartNode[]): string {
  return nodes.map(n =>
    `${n.id}:${n.concept}:${n.params.size.join(',')}:${n.transform.position.join(',')}`
  ).join('|');
}
