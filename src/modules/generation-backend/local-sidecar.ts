import type { GenerationBackend, GenerationOpts } from '../../types/modules';
import type { Mesh } from '../../types/intent-graph';

// V6: spawns TripoSR Python sidecar via Tauri IPC; CPU-only, ~1-2 min on target hardware.
// Stub throws so callers know generation is unavailable in the browser build.
export class LocalSidecar implements GenerationBackend {
  async generate(_image: ImageData, _opts: GenerationOpts): Promise<Mesh> {
    throw new Error('LocalSidecar: requires Tauri app shell (V6)');
  }
}
