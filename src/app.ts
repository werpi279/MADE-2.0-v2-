import { createModules, type Modules } from './modules/index';
import { emptyGraph } from './types/intent-graph';
import type { IntentGraph, Stroke, Quat } from './types/intent-graph';
import type { AppScene, FeedbackState, PoseState } from './types/modules';

const IDENTITY_QUAT: Quat = { x: 0, y: 0, z: 0, w: 1 };

export class MADEApp {
  private readonly m: Modules;
  private graph: IntentGraph;
  private video: HTMLVideoElement | null = null;
  private running = false;

  // V2 stroke collection
  private strokes: Stroke[] = [];
  private activePoints: { x: number; y: number }[] = [];
  private strokeActive = false;

  // V3+ voice events (accumulated between frames)
  private pendingVoice: import('./types/modules').VoiceEvent[] = [];

  // Status callback for main.ts to update the overlay
  onStatus?: (msg: string) => void;

  constructor(container: HTMLElement) {
    this.m     = createModules();
    this.graph  = this.m.store.load();
    this.m.renderer.mount(container);
    this.m.speech.onEvent(e => this.pendingVoice.push(e));
  }

  setVideo(video: HTMLVideoElement): void { this.video = video; }

  async setup(): Promise<void> {
    if (this.m.handTracking.setup) {
      this.onStatus?.('Loading hand tracking model…');
      await this.m.handTracking.setup();
      this.onStatus?.('Ready — show your hands');
    }
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    requestAnimationFrame(this.loop);
  }

  stop(): void { this.running = false; }

  /** Lock the top hypothesis into a stable PartNode. */
  lockTop(): void {
    const h = this.graph.hypotheses[0];
    if (!h) return;
    const edit = this.m.interpreter.commit(h);
    this._applyEdit(edit);
    this.graph.hypotheses = [];
    this.graph.strokes = [];
    this.strokes = [];
    this.m.store.save(this.graph);
  }

  /** Discard current strokes and hypotheses (fresh start). */
  reject(): void {
    this.graph.hypotheses = [];
    this.graph.strokes = [];
    this.strokes = [];
    this.activePoints = [];
    this.strokeActive = false;
  }

  /** Force a concept on the most recently locked node. */
  forceConcept(label: string): void {
    const last = this.graph.nodes[this.graph.nodes.length - 1];
    if (!last) return;
    const edit = this.m.interpreter.force(label, last.id);
    this._applyEdit(edit);
    this.m.store.save(this.graph);
  }

  getTopHypothesis() { return this.graph.hypotheses[0] ?? null; }
  getGraph() { return this.graph; }

  private readonly loop = (timestamp: number): void => {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    this.tick(timestamp);
  };

  private tick(timestamp: number): void {
    // ── Hand tracking ───────────────────────────────────────────────────────
    const hands = this.video
      ? this.m.handTracking.track(this.video, timestamp)
      : [];

    const poses: PoseState[] = hands.length
      ? this.m.gestureRecognizer.recognize(hands)
      : [];

    // ── Pick dominant (right) + non-dominant (left) hand ────────────────────
    // In the mirrored camera feed, the user's right hand appears on the image
    // left (x < 0.5 for lm[9]). MediaPipe reports it as 'Right' after we flip.
    const dominant    = poses.find(p => p.hand === 'right') ?? null;
    const nonDominant = poses.find(p => p.hand === 'left')  ?? null;

    // ── Stroke collection (dominant hand) ───────────────────────────────────
    if (dominant?.penDown && dominant.indexTipNorm) {
      if (!this.strokeActive) {
        this.activePoints = [];
        this.strokeActive = true;
      }
      this.activePoints.push(dominant.indexTipNorm);
    } else if (this.strokeActive) {
      if (this.activePoints.length >= 3) {
        const stroke = this.m.spatialMapping.mapStroke(
          this.activePoints,
          IDENTITY_QUAT,  // V2: always screen-parallel; V3+ uses workpiece quat
        );
        this.strokes.push(stroke);
        this.graph.strokes = [...this.strokes];
      }
      this.strokeActive = false;
      this.activePoints = [];
    }

    // ── Voice command dispatch ───────────────────────────────────────────────
    const voice = this.pendingVoice.splice(0);
    for (const ev of voice) {
      if (ev.kind === 'command') {
        if (ev.intent === 'lock')   { this.lockTop();  break; }
        if (ev.intent === 'reject') { this.reject();   break; }
        if (ev.intent?.startsWith('concept:')) {
          const label = ev.intent.slice('concept:'.length);
          this.forceConcept(label);
          break;
        }
      }
    }

    // ── Interpreter (V3+) ───────────────────────────────────────────────────
    if (this.graph.strokes.length) {
      this.graph.hypotheses = this.m.interpreter.update(
        this.graph.strokes, voice, { graph: this.graph, poseStates: poses }
      );
    }

    // ── Assemble scene ──────────────────────────────────────────────────────
    const mesh = this.m.geometryEngine.assemble(this.graph);

    const topH = this.graph.hypotheses[0];

    const scene: AppScene = {
      parts:        mesh ? [mesh] : [],
      previewMesh:  topH?.previewMesh ?? null,
      strokes:      this.strokes,
      activeStroke: this.strokeActive && this.activePoints.length >= 2
        ? this.activePoints.map(p => {
            // Convert normalised → scene coords (matches ScreenPlaneMapping)
            return { x: (0.5 - p.x) * 4.0, y: (0.5 - p.y) * 3.0 };
          })
        : undefined,
    };

    // ── Nav sphere state ────────────────────────────────────────────────────
    const ndPinch = nonDominant?.pinch ?? 0;
    const sphereState =
      ndPinch > 0.7  ? 'highlight' as const :
      ndPinch > 0.3  ? 'highlight' as const : 'idle' as const;

    const fb: FeedbackState = {
      navSphere: { visible: true, state: sphereState },
    };

    this.m.renderer.render(scene, fb);

    // ── Status update ────────────────────────────────────────────────────────
    if (this.onStatus) {
      const hCount = hands.length;
      if (hCount === 0) {
        this.onStatus('No hands detected');
      } else if (this.strokeActive) {
        this.onStatus(`Drawing stroke (${this.activePoints.length} pts)`);
      } else if (topH) {
        this.onStatus(`Hypothesis: ${topH.concept} (${(topH.score * 100).toFixed(0)}%)`);
      } else {
        this.onStatus(`${hCount} hand${hCount > 1 ? 's' : ''} · ${this.strokes.length} stroke${this.strokes.length !== 1 ? 's' : ''}`);
      }
    }
  }

  private _applyEdit(edit: import('./types/modules').GraphEdit): void {
    switch (edit.type) {
      case 'add-node':
        if (edit.data) {
          // Build a minimal PartNode from the edit data
          const id = edit.nodeId ?? `node-${Date.now()}`;
          this.graph.nodes.push({
            id,
            concept: edit.data.concept ?? 'unknown',
            form: edit.data.form ?? 'primitive',
            params: edit.data.params ?? { size: [1, 1, 1], proportion: [1, 1, 1], orientation: IDENTITY_QUAT },
            transform: edit.data.transform ?? { position: [0, 0, 0], rotation: IDENTITY_QUAT, scale: [1, 1, 1] },
            sourceStrokes: edit.data.sourceStrokes ?? [],
          });
        }
        break;
      case 'force-concept':
        if (edit.nodeId && edit.data?.concept) {
          const node = this.graph.nodes.find(n => n.id === edit.nodeId);
          if (node) node.concept = edit.data.concept;
        }
        break;
      case 'remove-node':
        if (edit.nodeId) {
          this.graph.nodes = this.graph.nodes.filter(n => n.id !== edit.nodeId);
        }
        break;
    }
  }
}
