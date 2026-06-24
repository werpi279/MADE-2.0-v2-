import * as THREE from 'three';
import type { Renderer, AppScene, FeedbackState } from '../../types/modules';
import type { Stroke } from '../../types/intent-graph';
import type { Pt2D } from '../../types/intent-graph';
import { NavSphere } from './nav-sphere';
import { InfluenceBlob } from './influence-blob';
import { BubbleViz } from './bubble-viz';

const STROKE_MAT_COMMITTED = new THREE.LineBasicMaterial({ color: 0x5566aa, linewidth: 2 });
const STROKE_MAT_ACTIVE    = new THREE.LineBasicMaterial({ color: 0xaabbff, linewidth: 3 });

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
  private strokeLines: THREE.Line[] = [];
  private idleRotY = 0;

  constructor() {
    // Try progressively simpler/more-permissive WebGL configurations.
    // failIfMajorPerformanceCaveat:false allows software/Mesa fallback.
    // alpha:false eliminates one EGL surface requirement that can fail on
    // Intel + ANGLE/EGL.  precision:'mediump' reduces shader complexity.
    const configs: THREE.WebGLRendererParameters[] = [
      { antialias: true,  failIfMajorPerformanceCaveat: false },
      { antialias: false, failIfMajorPerformanceCaveat: false },
      { antialias: false, failIfMajorPerformanceCaveat: false, alpha: false },
      { antialias: false, failIfMajorPerformanceCaveat: false, alpha: false, powerPreference: 'low-power' },
      { antialias: false, failIfMajorPerformanceCaveat: false, alpha: false, powerPreference: 'low-power', precision: 'mediump' },
      { antialias: false, failIfMajorPerformanceCaveat: false, alpha: false, depth: false, stencil: false, precision: 'lowp' },
    ];

    let renderer: THREE.WebGLRenderer | null = null;
    for (const cfg of configs) {
      try { renderer = new THREE.WebGLRenderer(cfg); break; } catch { /* try next */ }
    }

    if (!renderer) {
      // FEATURE_FAILURE_EGL_POT / FEATURE_FAILURE_WEBGL_EXHAUSTED_DRIVERS:
      // Firefox's ANGLE EGL backend failed on every attempt.
      // Throwing here lets main.ts surface the fix instructions.
      throw Object.assign(
        new Error('WEBGL_UNAVAILABLE'),
        { isWebGLUnavailable: true },
      );
    }
    this.webgl = renderer;
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

    // ── Node highlight (emissive glow on newly locked node) ───────────────
    const highlight = !!fb.highlightedNode;
    for (const m of this.activeParts) {
      if (m instanceof THREE.Mesh) {
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.emissive?.setHex(highlight ? 0x88ff88 : 0x000000);
        mat.emissiveIntensity = highlight ? 0.35 : 0;
      }
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

    // ── Strokes ───────────────────────────────────────────────────────────
    for (const l of this.strokeLines) { this.workpiece.remove(l); l.geometry.dispose(); }
    this.strokeLines = [];

    const toLines = (pts: Pt2D[], mat: THREE.LineBasicMaterial): THREE.Line => {
      const v3 = pts.map(p => new THREE.Vector3(p.x, p.y, 0));
      const geo = new THREE.BufferGeometry().setFromPoints(v3);
      const line = new THREE.Line(geo, mat);
      this.workpiece.add(line);
      this.strokeLines.push(line);
      return line;
    };

    if (appScene.strokes) {
      for (const s of appScene.strokes) {
        if (s.points2D.length >= 2) {
          // Apply plane orientation: rotate the flat stroke into the draw plane
          const q = new THREE.Quaternion(s.planeOrientation.x, s.planeOrientation.y,
                                         s.planeOrientation.z, s.planeOrientation.w);
          const line = toLines(s.points2D, STROKE_MAT_COMMITTED);
          line.quaternion.copy(q);
        }
      }
    }
    if (appScene.activeStroke && appScene.activeStroke.length >= 2) {
      toLines(appScene.activeStroke.map(p => p), STROKE_MAT_ACTIVE);
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
