import {
  Mesh, IcosahedronGeometry, MeshStandardMaterial,
  CylinderGeometry, BufferGeometry,
  CatmullRomCurve3, TubeGeometry, Vector3,
} from 'three';

// ── Clay material (shared look across all primitive surfaces) ───────────────

const CLAY_MAT = new MeshStandardMaterial({ color: 0xc4845a, roughness: 0.88, metalness: 0 });

/** Starting mesh — icosahedron subdiv-3, warm terracotta clay. */
export function createPlaceholderMesh(): Mesh {
  const geo = new IcosahedronGeometry(0.55, 3);
  const mat = new MeshStandardMaterial({ color: 0xc4845a, roughness: 0.88, metalness: 0 });
  return new Mesh(geo, mat);
}

// ── TubeBuilder ─────────────────────────────────────────────────────────────
// V3: coil drawing. Catmull-Rom tube follows the fingertip path.

const MIN_DIST  = 0.04;
const MAX_PTS   = 120;
const RADIAL    = 8;

export class TubeBuilder {
  private pts: Vector3[] = [];
  private radius = 0.05;
  readonly liveMesh: Mesh;

  constructor() {
    this.liveMesh = new Mesh(new BufferGeometry(), CLAY_MAT);
    this.liveMesh.visible = false;
  }

  start(pos: Vector3, radius: number): void {
    this.pts   = [pos.clone()];
    this.radius = radius;
    this.liveMesh.visible = false;
  }

  addPoint(pos: Vector3, radius: number): void {
    if (!this.pts.length) return;
    this.radius = radius;
    if (pos.distanceTo(this.pts[this.pts.length - 1]) < MIN_DIST) return;
    if (this.pts.length >= MAX_PTS) this.pts.shift();
    this.pts.push(pos.clone());
    this._rebuild();
  }

  commit(): Mesh | null {
    if (this.pts.length < 3) { this.cancel(); return null; }
    const mesh = new Mesh(this.liveMesh.geometry.clone(), CLAY_MAT.clone());
    this.cancel();
    return mesh;
  }

  cancel(): void {
    this.pts = [];
    this.liveMesh.visible = false;
    this.liveMesh.geometry.dispose();
    this.liveMesh.geometry = new BufferGeometry();
  }

  get active(): boolean { return this.pts.length > 0; }

  private _rebuild(): void {
    if (this.pts.length < 2) return;
    const curve = new CatmullRomCurve3(this.pts);
    const segs  = Math.min(this.pts.length * 3, 240);
    this.liveMesh.geometry.dispose();
    this.liveMesh.geometry = new TubeGeometry(curve, segs, this.radius, RADIAL, false);
    this.liveMesh.visible  = true;
  }
}

// ── FrameExtruder ────────────────────────────────────────────────────────────
// V3: two-hand frame gesture → cylinder extrusion with live preview.

const PREVIEW_MAT = new MeshStandardMaterial({
  color: 0xc4845a, roughness: 0.88, metalness: 0, transparent: true, opacity: 0.55,
});

export class FrameExtruder {
  readonly previewMesh: Mesh;
  private savedCenter = new Vector3();
  private savedRadius = 0.1;
  private savedHeight = 0.02;

  constructor() {
    this.previewMesh = new Mesh(new CylinderGeometry(0.1, 0.1, 0.02, 32), PREVIEW_MAT);
    this.previewMesh.visible = false;
  }

  update(center: Vector3, radius: number, height: number): void {
    this.savedCenter.copy(center);
    this.savedRadius = radius;
    this.savedHeight = height;
    this.previewMesh.geometry.dispose();
    this.previewMesh.geometry = new CylinderGeometry(radius, radius, Math.max(height, 0.02), 32);
    this.previewMesh.position.copy(center);
    this.previewMesh.visible = true;
  }

  commit(): Mesh {
    const geo = new CylinderGeometry(this.savedRadius, this.savedRadius, Math.max(this.savedHeight, 0.05), 32);
    const mat = new MeshStandardMaterial({ color: 0xc4845a, roughness: 0.88, metalness: 0 });
    const mesh = new Mesh(geo, mat);
    mesh.position.copy(this.savedCenter);
    this.previewMesh.visible = false;
    return mesh;
  }

  cancel(): void {
    this.previewMesh.visible = false;
  }
}
