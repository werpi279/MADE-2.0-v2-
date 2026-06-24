import type { Mesh as ThreeMesh } from 'three';

// All engines produce THREE.Mesh at the rendering boundary.
// An SDF/voxel engine swap must convert to ThreeMesh before returning.
export type Mesh = ThreeMesh;

// --- Primitive geometry types ---

export interface Pt2D {
  x: number;
  y: number;
}

export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface Transform {
  position: [number, number, number];
  rotation: Quat;
  scale: [number, number, number];
}

// --- Live layer ---

export interface Stroke {
  points2D: Pt2D[];
  planeOrientation: Quat;
  engaged: boolean;
}

export interface Hypothesis {
  kind: 'constructive' | 'retrieval';
  concept: string;
  score: number;
  previewMesh: Mesh | null;
}

// --- Stable layer ---

export interface PartNode {
  id: string;
  concept: string;
  name?: string;
  form: 'primitive' | 'generated' | 'retrieved';
  params: {
    size: [number, number, number];
    proportion: [number, number, number];
    orientation: Quat;
  };
  transform: Transform;
  sourceStrokes: number[];
}

export interface Attachment {
  from: string;
  to: string;
  joinType: 'blend' | 'snap' | 'csg-union';
  blendStrength: number;
}

export interface Constraint {
  kind: 'round' | 'mirror-symmetric' | 'flat-bottomed' | 'locked-dimension';
  target?: string;
  value?: number;
}

// --- The Spine ---
// The intent graph is the fixed data contract. Modules read and write it;
// the propose->lock/reject loop advances it. Never bypass this schema.

export interface IntentGraph {
  // Live: what is being interpreted right now
  strokes: Stroke[];
  hypotheses: Hypothesis[];
  // Stable: the committed recipe the GeometryEngine builds
  nodes: PartNode[];
  edges: Attachment[];
  constraints: Constraint[];
}

export function emptyGraph(): IntentGraph {
  return {
    strokes: [],
    hypotheses: [],
    nodes: [],
    edges: [],
    constraints: [],
  };
}
