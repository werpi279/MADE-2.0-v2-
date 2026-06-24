import type { Mesh, Stroke, IntentGraph, Hypothesis, Pt2D, Quat, PartNode } from './intent-graph';

// --- Supporting value types ---

export type HandLandmark = { x: number; y: number; z: number };
export type HandFrame = HandLandmark[][];  // [hand_index][landmark_index]

export interface PoseState {
  pinch: number;       // 0–1 dominant hand pinch strength
  openness: number;    // 0–1 hand openness
  cup: number;         // 0–1 cupped-palm strength
  grip: boolean;
  framePose: boolean;
  toss: boolean;
  wristRoll: number;   // radians
  penDown: boolean;    // dominant hand engaged (pinch threshold crossed)
  hand: 'left' | 'right' | null;
}

export interface VoiceEvent {
  kind: 'command' | 'ambient';
  text: string;
  intent?: string;
  keywords?: string[];
}

export interface ConceptScore {
  concept: string;
  score: number;
}

export interface Context {
  graph: IntentGraph;
  poseState: PoseState;
}

export interface GraphEdit {
  type: 'add-node' | 'update-node' | 'remove-node' | 'force-concept';
  nodeId?: string;
  data?: Partial<PartNode>;
}

export type NodeId = string;

export interface FormRequest {
  concept: string;
  sketch?: ImageData;
  params?: Record<string, unknown>;
}

export interface GenerationOpts {
  prompt?: string;
  quality?: 'fast' | 'full';
}

export interface SculptOp {
  kind: 'push' | 'pull' | 'scale' | 'smooth';
  position: [number, number, number];
  radius: number;
  magnitude: number;
}

export interface AppScene {
  parts: Mesh[];
  previewMesh: Mesh | null;
  /** Drives the renderer's workpiece Group. Omit to let the renderer use idle rotation. */
  workpieceTransform?: import('./intent-graph').Transform;
}

export interface FeedbackState {
  highlightedNode?: NodeId;
  /** Show translucent blob at this workpiece-local position with given falloff radius. */
  influenceBlob?: { position: [number, number, number]; radius: number };
  /** Show bubble region sphere in workpiece-local space. */
  bubbleViz?: { center: [number, number, number]; radius: number; state: 'active' | 'cage' | 'mask' };
  /** Navigation sphere visual state. */
  navSphere: { visible: boolean; state: 'idle' | 'highlight' | 'ghost' };
}

export interface UiEvent {
  kind: 'lock' | 'reject' | 'redo' | 'dwell' | 'force';
  nodeId?: NodeId;
  timestamp: number;
}

export interface SatisfactionState {
  score: number;                   // 0–1
  frustrated: boolean;
  recognizerConfidenceLow: boolean;
  showForceInput: boolean;
  priors: Record<string, number>;  // concept -> weight boost, in-session only
}

// --- Module interfaces (the fixed spine contracts) ---
// Swap = provide another implementation of the same interface in config.ts.
// NEVER change these signatures — that would be changing the spine.

export interface HandTracking {
  track(frame: VideoFrame): HandFrame[];
}

export interface GestureRecognizer {
  recognize(hands: HandFrame[]): PoseState;
}

export interface SpatialMapping {
  mapStroke(pointer: Pt2D[], orientation: Quat): Stroke;
}

export interface Speech {
  onEvent(cb: (e: VoiceEvent) => void): void;
}

export interface ShapeRecognizer {
  recognize(sketch: ImageData, vocab: string[]): ConceptScore[];
}

export interface Interpreter {
  update(strokes: Stroke[], voice: VoiceEvent[], ctx: Context): Hypothesis[];
  commit(h: Hypothesis): GraphEdit;
  force(label: string, target: NodeId): GraphEdit;
}

export interface FormProvider {
  provide(req: FormRequest): Promise<Mesh | null>;
}

export interface GenerationBackend {
  generate(image: ImageData, opts: GenerationOpts): Promise<Mesh>;
}

export interface GeometryEngine {
  assemble(graph: IntentGraph): Mesh | null;
  sculpt(mesh: Mesh, op: SculptOp): Mesh;
}

export interface Renderer {
  mount(container: HTMLElement): void;
  render(scene: AppScene, fb: FeedbackState): void;
  dispose(): void;
}

export interface SatisfactionSignal {
  update(events: UiEvent[]): SatisfactionState;
}

export interface Store {
  save(graph: IntentGraph): void;
  load(): IntentGraph;
  export(fmt: 'obj' | 'glb'): Blob;
}
