import type { Mesh, Stroke, IntentGraph, Hypothesis, Pt2D, Quat, PartNode, Transform } from './intent-graph';

// --- Supporting value types ---

export type HandLandmark = { x: number; y: number; z: number };

/** One detected hand: 21 landmarks + MediaPipe handedness label. */
export interface DetectedHand {
  landmarks: HandLandmark[];   // 21 points, normalised [0,1]
  handedness: 'Left' | 'Right';
}

export interface PoseState {
  pinch: number;        // 0–1 pinch strength (thumb+index proximity)
  openness: number;     // 0–1 hand openness (average finger extension)
  cup: number;          // 0–1 cupped-palm strength
  grip: boolean;        // all fingers tightly curled
  framePose: boolean;   // L-shape: thumb + index extended, rest curled
  toss: boolean;        // quick upward flick (needs temporal tracking; stub=false)
  wristRoll: number;    // radians — angle of wrist→index-MCP vector
  penDown: boolean;     // pinch crossed engagement threshold
  hand: 'left' | 'right' | null;
  indexTipNorm: Pt2D | null;    // normalised [0,1] screen pos of index tip
  palmCenterNorm: Pt2D | null;  // normalised palm centroid
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
  poseStates: PoseState[];  // one per detected hand
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
  strokes?: Stroke[];         // committed strokes (rendered as lines)
  activeStroke?: Pt2D[];      // in-progress stroke (bright highlight)
  workpieceTransform?: Transform;
}

export interface FeedbackState {
  highlightedNode?: NodeId;
  influenceBlob?: { position: [number, number, number]; radius: number };
  bubbleViz?: { center: [number, number, number]; radius: number; state: 'active' | 'cage' | 'mask' };
  navSphere: { visible: boolean; state: 'idle' | 'highlight' | 'ghost' };
}

export interface UiEvent {
  kind: 'lock' | 'reject' | 'redo' | 'dwell' | 'force';
  nodeId?: NodeId;
  timestamp: number;
}

export interface SatisfactionState {
  score: number;
  frustrated: boolean;
  recognizerConfidenceLow: boolean;
  showForceInput: boolean;
  priors: Record<string, number>;
}

// --- Module interfaces (the fixed spine contracts) ---

export interface HandTracking {
  /** Optional async init — called once before the main loop starts. */
  setup?(): Promise<void>;
  /** Returns 0–2 detected hands for the current video frame. */
  track(video: HTMLVideoElement, timestamp: number): DetectedHand[];
}

export interface GestureRecognizer {
  /** Returns one PoseState per detected hand, same indexing as input. */
  recognize(hands: DetectedHand[]): PoseState[];
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
  export(fmt: 'obj' | 'glb'): Promise<Blob>;
}
