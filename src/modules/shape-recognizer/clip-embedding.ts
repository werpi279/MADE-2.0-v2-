import type { ShapeRecognizer, ConceptScore } from '../../types/modules';

// V4: transformers.js CLIP-style embedding over an open word list.
// Runs on WebGPU (integrated GPU OK) with WASM fallback.
// Returns empty array until V4 — Interpreter falls through to constructive hypothesis.
export class ClipEmbeddingRecognizer implements ShapeRecognizer {
  recognize(_sketch: ImageData, _vocab: string[]): ConceptScore[] {
    return [];
  }
}
