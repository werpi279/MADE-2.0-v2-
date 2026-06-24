import * as THREE from 'three';
import type { Renderer, AppScene, FeedbackState } from '../../types/modules';

// Default renderer. V7: adds highlights, influence blob, ghost preview, nav sphere, bubble.
export class ThreeRenderer implements Renderer {
  private readonly webgl: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private container: HTMLElement | null = null;
  private activeParts: THREE.Mesh[] = [];

  constructor() {
    this.webgl = new THREE.WebGLRenderer({ antialias: true });
    this.webgl.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    this.camera.position.set(0, 1.2, 3);
    this.camera.lookAt(0, 0, 0);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(5, 10, 5);
    this.scene.add(sun);
  }

  mount(container: HTMLElement): void {
    this.container = container;
    container.appendChild(this.webgl.domElement);
    this.resize();
    window.addEventListener('resize', this.resize);
  }

  render(appScene: AppScene, _fb: FeedbackState): void {
    // Remove previous frame's part meshes (preserve lights)
    for (const m of this.activeParts) this.scene.remove(m);
    this.activeParts = [];

    for (const mesh of appScene.parts) {
      this.scene.add(mesh);
      this.activeParts.push(mesh);
    }
    if (appScene.previewMesh) {
      this.scene.add(appScene.previewMesh);
      this.activeParts.push(appScene.previewMesh);
    }

    this.webgl.render(this.scene, this.camera);
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    this.webgl.dispose();
  }

  private readonly resize = (): void => {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.webgl.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };
}
