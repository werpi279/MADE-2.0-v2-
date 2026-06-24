import * as THREE from 'three';
import type { Interpreter, GraphEdit, Context, VoiceEvent, ShapeRecognizer } from '../../types/modules';
import type { Stroke, Hypothesis, Pt2D } from '../../types/intent-graph';

// Sketch canvas: strokes → 224×224 greyscale image for CLIP
const SKETCH_SIZE = 224;
const SKETCH_SCALE_X = SKETCH_SIZE / 4.0;  // scene X range ≈ ±2
const SKETCH_SCALE_Y = SKETCH_SIZE / 3.0;  // scene Y range ≈ ±1.5

// Open shape vocabulary for CLIP zero-shot
const SHAPE_VOCAB = ['sphere', 'cylinder', 'box', 'cone', 'ring', 'tube', 'dome'];

// Hysteresis: prevent flickering between classes
const HYSTERESIS_ALPHA = 0.35;  // how fast new scores replace old

// ── Preview materials ───────────────────────────────────────────────────────
const PREVIEW_MAT = new THREE.MeshStandardMaterial({
  color: 0xc4845a, roughness: 0.88, metalness: 0, transparent: true, opacity: 0.55,
});

type PrimKind = 'sphere' | 'cylinder' | 'box';

interface Metrics {
  cx: number; cy: number;
  width: number; height: number;
  circularity: number;
  aspect: number;
}

function measureStrokes(strokes: Stroke[]): Metrics | null {
  const pts: Pt2D[] = strokes.flatMap(s => s.points2D);
  if (pts.length < 3) return null;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const width  = maxX - minX;
  const height = maxY - minY;

  const dists  = pts.map(p => Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2));
  const meanR  = dists.reduce((a, b) => a + b, 0) / dists.length;
  const stdR   = meanR > 0
    ? Math.sqrt(dists.reduce((s, d) => s + (d - meanR) ** 2, 0) / dists.length)
    : 0;
  const circularity = meanR > 0 ? Math.max(0, 1 - stdR / meanR) : 0;

  const minDim = Math.min(width, height);
  const maxDim = Math.max(width, height);
  const aspect = minDim > 0.001 ? maxDim / minDim : 1;

  return { cx, cy, width, height, circularity, aspect };
}

function classify(m: Metrics): PrimKind {
  if (m.circularity > 0.65 && m.aspect < 1.6) return 'sphere';
  if (m.aspect > 1.8) return 'cylinder';
  return 'box';
}

function primSize(kind: PrimKind, m: Metrics): [number, number, number] {
  const r = Math.max((m.width + m.height) / 4, 0.1);
  switch (kind) {
    case 'sphere':   return [r * 2, r * 2, r * 2];
    case 'cylinder': return [Math.max(m.width, 0.1), Math.max(m.height, 0.1), Math.max(m.width, 0.1)];
    case 'box':      return [Math.max(m.width, 0.1), Math.max(m.height, 0.1), Math.max(Math.min(m.width, m.height) * 0.5, 0.05)];
  }
}

function buildGeo(kind: PrimKind, size: [number, number, number]): THREE.BufferGeometry {
  const [w, h] = size;
  switch (kind) {
    case 'sphere':   return new THREE.SphereGeometry(w / 2, 16, 12);
    case 'cylinder': return new THREE.CylinderGeometry(w / 2, w / 2, h, 12);
    case 'box':      return new THREE.BoxGeometry(...size);
  }
}

function makePreview(kind: PrimKind, m: Metrics): THREE.Mesh {
  const size = primSize(kind, m);
  const mesh = new THREE.Mesh(buildGeo(kind, size), PREVIEW_MAT.clone());
  mesh.position.set(m.cx, m.cy, 0);
  mesh.userData = { concept: kind, size, cx: m.cx, cy: m.cy };
  return mesh;
}

function constructiveScore(kind: PrimKind, m: Metrics): number {
  switch (kind) {
    case 'sphere':   return Math.max(0.5, m.circularity);
    case 'cylinder': return Math.min(1, 0.5 + (m.aspect - 1.8) / 3);
    case 'box':      return 0.6;
  }
}

// ── Voice keyword → concept bias ────────────────────────────────────────────
const WORD_TO_CONCEPT: Record<string, PrimKind> = {
  sphere: 'sphere', ball: 'sphere', globe: 'sphere', round: 'sphere', orb: 'sphere',
  cylinder: 'cylinder', tube: 'cylinder', pipe: 'cylinder', column: 'cylinder',
  box: 'box', cube: 'box', block: 'box', flat: 'box', slab: 'box',
};

function voiceBias(voice: VoiceEvent[]): Record<PrimKind, number> {
  const bias: Record<PrimKind, number> = { sphere: 0, cylinder: 0, box: 0 };
  for (const ev of voice) {
    for (const kw of ev.keywords ?? []) {
      const concept = WORD_TO_CONCEPT[kw];
      if (concept) bias[concept] = Math.min(1, bias[concept] + 0.25);
    }
  }
  return bias;
}

function renderSketch(strokes: Stroke[]): ImageData | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width  = SKETCH_SIZE;
    canvas.height = SKETCH_SIZE;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, SKETCH_SIZE, SKETCH_SIZE);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.lineCap   = 'round';

    for (const s of strokes) {
      if (s.points2D.length < 2) continue;
      ctx.beginPath();
      for (let i = 0; i < s.points2D.length; i++) {
        const px = SKETCH_SIZE / 2 + s.points2D[i].x * SKETCH_SCALE_X;
        const py = SKETCH_SIZE / 2 - s.points2D[i].y * SKETCH_SCALE_Y;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    return ctx.getImageData(0, 0, SKETCH_SIZE, SKETCH_SIZE);
  } catch {
    return null;
  }
}

// Propose-only: never commits silently.
// commit() promotes on user lock; force() is a deterministic label override.
export class HypothesisEngine implements Interpreter {
  private readonly sr: ShapeRecognizer | null;
  private smoothed: Record<string, number> = {};

  constructor(shapeRecognizer?: ShapeRecognizer) {
    this.sr = shapeRecognizer ?? null;
  }

  update(strokes: Stroke[], voice: VoiceEvent[], _ctx: Context): Hypothesis[] {
    if (strokes.length === 0) { this.smoothed = {}; return []; }

    const m = measureStrokes(strokes);
    if (!m) return [];

    const kind    = classify(m);
    const base    = constructiveScore(kind, m);
    const bias    = voiceBias(voice);

    // CLIP retrieval scores (async, may be stale by a frame)
    const clipScores: Record<string, number> = {};
    if (this.sr) {
      const sketch = renderSketch(strokes);
      if (sketch) {
        const cs = this.sr.recognize(sketch, SHAPE_VOCAB);
        for (const { concept, score } of cs) clipScores[concept] = score;
      }
    }

    // Blend constructive + CLIP + voice bias, then smooth (hysteresis)
    const rawScores: Record<PrimKind, number> = { sphere: 0, cylinder: 0, box: 0 };
    for (const k of Object.keys(rawScores) as PrimKind[]) {
      const clip  = clipScores[k] ?? 0;
      const v     = bias[k] ?? 0;
      rawScores[k] = k === kind
        ? base * 0.6 + clip * 0.25 + v * 0.15
        : clip * 0.5 + v * 0.2;
    }

    // Exponential moving average to prevent hypothesis flickering
    for (const k of Object.keys(rawScores) as PrimKind[]) {
      const prev = this.smoothed[k] ?? rawScores[k];
      this.smoothed[k] = prev * (1 - HYSTERESIS_ALPHA) + rawScores[k] * HYSTERESIS_ALPHA;
    }

    // Top hypothesis = winner of smoothed scores
    const best = (Object.keys(this.smoothed) as PrimKind[])
      .reduce((a, b) => this.smoothed[a] > this.smoothed[b] ? a : b, kind);

    const preview = makePreview(best, m);
    return [{ kind: 'constructive', concept: best, score: Math.max(0.4, this.smoothed[best]), previewMesh: preview }];
  }

  commit(h: Hypothesis): GraphEdit {
    const ud  = h.previewMesh?.userData ?? {};
    const id  = `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const size: [number, number, number] = ud.size ?? [1, 1, 1];
    return {
      type: 'add-node',
      nodeId: id,
      data: {
        id,
        concept:  h.concept,
        form:     'primitive',
        params:   { size, proportion: [1, 1, 1], orientation: { x: 0, y: 0, z: 0, w: 1 } },
        transform: {
          position: [ud.cx ?? 0, ud.cy ?? 0, 0],
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale:    [1, 1, 1],
        },
        sourceStrokes: [],
      },
    };
  }

  force(label: string, target: string): GraphEdit {
    return { type: 'force-concept', nodeId: target, data: { concept: label } };
  }
}
