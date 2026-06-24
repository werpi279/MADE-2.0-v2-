import type { ShapeRecognizer, ConceptScore } from '../../types/modules';

// Lazy-loaded zero-shot-image-classification pipeline.
// Async inference runs in the background; recognize() returns the latest cached scores.
// Model: Xenova/clip-vit-base-patch32 (~350 MB, downloaded once from HuggingFace Hub).
// Swappable to a sketch-tuned ViT via config.ts without touching the spine.
export class ClipEmbeddingRecognizer implements ShapeRecognizer {
  private pipe: ((img: HTMLCanvasElement, labels: string[]) => Promise<Array<{ label: string; score: number }>>) | null = null;
  private loadState: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
  private running = false;
  private cached: ConceptScore[] = [];

  recognize(sketch: ImageData, vocab: string[]): ConceptScore[] {
    if (this.loadState === 'idle') this._load();
    if (this.loadState === 'ready' && !this.running) {
      this._infer(sketch, vocab).catch(() => { /* keep cached */ });
    }
    return this.cached;
  }

  private async _load(): Promise<void> {
    this.loadState = 'loading';
    try {
      const { pipeline } = await import('@huggingface/transformers');
      const p = await pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32');
      // Wrap into our expected signature: (canvas, labels) → scores
      this.pipe = async (canvas, labels) => {
        const results = await (p as any)(canvas, labels);
        return Array.isArray(results) ? results : [];
      };
      this.loadState = 'ready';
    } catch (err) {
      console.warn('ClipEmbeddingRecognizer: pipeline load failed', err);
      this.loadState = 'failed';
    }
  }

  private async _infer(sketch: ImageData, vocab: string[]): Promise<void> {
    if (!this.pipe || this.running) return;
    this.running = true;
    try {
      const canvas = _imageDataToCanvas(sketch);
      const raw = await this.pipe(canvas, vocab);
      this.cached = raw.map(r => ({ concept: r.label, score: r.score }));
    } finally {
      this.running = false;
    }
  }
}

function _imageDataToCanvas(img: ImageData): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width  = img.width;
  c.height = img.height;
  c.getContext('2d')!.putImageData(img, 0, 0);
  return c;
}
