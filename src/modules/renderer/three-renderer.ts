import * as THREE from 'three';
import type { Renderer, AppScene, FeedbackState } from '../../types/modules';
import { NavSphere } from './nav-sphere';
import { InfluenceBlob } from './influence-blob';
import { BubbleViz } from './bubble-viz';

// V7: add highlights, ghost preview, magnitude readouts.
// V1: workpiece group, nav sphere, influence blob, bubble viz, hemisphere lighting.
export class ThreeRenderer implements Renderer {
  private readonly webgl: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly workpiece: THREE.Group;
  private readonly navSphere: NavSphere;
  private readonly blob: InfluenceBlob;
  private readonly bubbleViz: BubbleViz;
  private container: HTMLElement | null = null;
  private activeParts: THREE.Mesh[] = [];
  private idleRotY = 0;  // slow idle rotation while no gesture navigation is active

  constructor() {
    this.webgl = new THREE.WebGLRenderer({ antialias: true });
    this.webgl.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    this.camera.position.set(0, 0, 5);
    this.camera.lookAt(0, 0, 0);

    // v1 lighting — hemisphere gives warm/cool contrast to the clay surface
    this.scene.add(new THREE.HemisphereLight(0x8899bb, 0x443322, 0.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(3, 5, 4);
    this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.2));

    // Workpiece group: all parts + nav sphere + influence blob + bubble viz move together
    this.workpiece  = new THREE.Group();
    this.navSphere  = new NavSphere();
    this.blob       = new InfluenceBlob();
    this.bubbleViz  = new BubbleViz();

    this.workpiece.add(this.navSphere.object);
    this.workpiece.add(this.blob.object);
    this.workpiece.add(this.bubbleViz.object);
    this.scene.add(this.workpiece);
  }

  mount(container: HTMLElement): void {
    this.container = container;
    container.appendChild(this.webgl.domElement);
    this.resize();
    window.addEventListener('resize', this.resize);
  }

  render(appScene: AppScene, fb: FeedbackState): void {
    // ── Parts ─────────────────────────────────────────────────────────────────
    for (const m of this.activeParts) this.workpiece.remove(m);
    this.activeParts = [];

    for (const mesh of appScene.parts) {
      this.workpiece.add(mesh);
      this.activeParts.push(mesh);
    }
    if (appScene.previewMesh) {
      this.workpiece.add(appScene.previewMesh);
      this.activeParts.push(appScene.previewMesh);
    }

    // ── Workpiece transform ────────────────────────────────────────────────
    if (appScene.workpieceTransform) {
      const { position: p, rotation: r, scale: s } = appScene.workpieceTransform;
      this.workpiece.position.set(...p);
      this.workpiece.quaternion.set(r.x, r.y, r.z, r.w);
      this.workpiece.scale.set(...s);
    } else {
      // Idle rotation until V2 gesture navigation takes over
      this.idleRotY += 0.004;
      this.workpiece.rotation.y = this.idleRotY;
      this.workpiece.rotation.x = 0.2;
    }

    // ── Nav sphere ────────────────────────────────────────────────────────
    this.navSphere.object.visible = fb.navSphere.visible;
    if (fb.navSphere.visible) {
      this.navSphere.setState(fb.navSphere.state);
    }

    // ── Influence blob ────────────────────────────────────────────────────
    if (fb.influenceBlob) {
      this.blob.show(new THREE.Vector3(...fb.influenceBlob.position), fb.influenceBlob.radius);
    } else {
      this.blob.hide();
    }

    // ── Bubble viz ────────────────────────────────────────────────────────
    if (fb.bubbleViz) {
      this.bubbleViz.show(
        new THREE.Vector3(...fb.bubbleViz.center),
        fb.bubbleViz.radius,
        fb.bubbleViz.state,
      );
    } else {
      this.bubbleViz.hide();
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
