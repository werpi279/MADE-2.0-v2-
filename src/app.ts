import { createModules, type Modules } from './modules/index';
import { emptyGraph } from './types/intent-graph';
import type { IntentGraph } from './types/intent-graph';
import type { AppScene, FeedbackState } from './types/modules';

export class MADEApp {
  private readonly m: Modules;
  private graph: IntentGraph;
  private running = false;
  private rotY = 0;

  constructor(container: HTMLElement) {
    this.m = createModules();
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
    // V2+: handTracking.track() -> gestureRecognizer.recognize() -> spatialMapping.mapStroke()
    // V3+: interpreter.update() fills graph.hypotheses; lock/reject commits to graph.nodes
    // V0: drive the placeholder mesh directly to confirm the pipeline is wired

    const mesh = this.m.geometryEngine.assemble(this.graph);

    // Rotate the placeholder so V0 is visually alive
    if (mesh) {
      this.rotY += 0.005;
      mesh.rotation.y = this.rotY;
      mesh.rotation.x = 0.25;
    }

    const scene: AppScene = {
      parts: mesh ? [mesh] : [],
      previewMesh: null,
    };

    const fb: FeedbackState = {
      showNavSphere: false,
      navSphereOpacity: 0,
    };

    this.m.renderer.render(scene, fb);
  }
}
