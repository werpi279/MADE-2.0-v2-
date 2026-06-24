import { createModules, type Modules } from './modules/index';
import { emptyGraph } from './types/intent-graph';
import type { IntentGraph } from './types/intent-graph';
import type { AppScene, FeedbackState } from './types/modules';

export class MADEApp {
  private readonly m: Modules;
  private graph: IntentGraph;
  private running = false;

  constructor(container: HTMLElement) {
    this.m    = createModules();
    this.graph = this.m.store.load();
    this.m.renderer.mount(container);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    requestAnimationFrame(this.loop);
  }

  stop(): void {
    this.running = false;
  }

  private readonly loop = (): void => {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    this.tick();
  };

  private tick(): void {
    // V2+: handTracking.track() → gestureRecognizer.recognize() → spatialMapping.mapStroke()
    //       → interpreter.update() fills graph.hypotheses; lock/reject commits to graph.nodes
    // V0/V1: assemble shows placeholder; renderer drives idle rotation.

    const mesh = this.m.geometryEngine.assemble(this.graph);

    const scene: AppScene = {
      parts:             mesh ? [mesh] : [],
      previewMesh:       null,
      // no workpieceTransform → renderer uses idle rotation until V2
    };

    const fb: FeedbackState = {
      navSphere: { visible: true, state: 'idle' },
      // influenceBlob and bubbleViz absent → hidden
    };

    this.m.renderer.render(scene, fb);
  }
}
